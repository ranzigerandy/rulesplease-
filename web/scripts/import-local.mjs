import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { ConvexHttpClient } from "convex/browser";
import dotenv from "dotenv";
import { api } from "../convex/_generated/api.js";

dotenv.config({ path: resolve(fileURLToPath(new URL("..", import.meta.url)), ".env.local") });

const args = new Map();
for (let index = 2; index < process.argv.length; index += 1) {
  const key = process.argv[index];
  if (key.startsWith("--")) args.set(key, process.argv[index + 1] ?? true);
}
const ownerId = args.get("--owner-id");
const dryRun = args.has("--dry-run");
if (!ownerId) {
  throw new Error("Usage: npm run import:local -- --owner-id user_... [--dry-run]");
}

const webRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const projectRoot = resolve(webRoot, "..");
const state = JSON.parse(await readFile(resolve(projectRoot, "data/state.json"), "utf8"));
const summary = { games: 0, chunks: 0, messages: 0, citations: 0 };
const compact = (value) => JSON.parse(JSON.stringify(value));

if (dryRun) {
  for (const game of state.games ?? []) {
    summary.games += 1;
    summary.messages += (state.messages?.[String(game.id)] ?? []).length;
    summary.citations += (state.messages?.[String(game.id)] ?? []).reduce(
      (total, message) => total + (message.citations?.length ?? 0),
      0,
    );
    try {
      const index = JSON.parse(
        await readFile(resolve(projectRoot, `data/indexes/${game.id}.json`), "utf8"),
      );
      summary.chunks += index.chunks?.length ?? 0;
    } catch {}
  }
  console.log(JSON.stringify(summary, null, 2));
  process.exit(0);
}

const url = process.env.NEXT_PUBLIC_CONVEX_URL ?? process.env.CONVEX_URL;
const secret = process.env.RULES_PLEASE_MIGRATION_SECRET;
if (!url || !secret) {
  throw new Error("NEXT_PUBLIC_CONVEX_URL and RULES_PLEASE_MIGRATION_SECRET are required");
}
const client = new ConvexHttpClient(url);

for (const game of state.games ?? []) {
  let index = { pages: [], chunks: [] };
  try {
    index = JSON.parse(
      await readFile(resolve(projectRoot, `data/indexes/${game.id}.json`), "utf8"),
    );
  } catch {
    console.warn(`No index found for BGG ${game.id}; importing metadata only.`);
  }
  const imported = await client.mutation(api.migrations.importGame, {
    secret,
    ownerId: String(ownerId),
    game: compact({
      bggId: Number(game.id),
      name: game.name,
      year: game.year ?? undefined,
      rank: game.rank ?? undefined,
      average: game.average ?? undefined,
      usersRated: game.users ?? undefined,
      isExpansion: Boolean(game.expansion),
      sourceUrl: game.sourceUrl ?? undefined,
      sourceConfidence: game.sourceConfidence ?? undefined,
      pageCount: Number(game.pageCount ?? index.pages?.length ?? 0),
      chunkCount: Number(game.chunkCount ?? index.chunks?.length ?? 0),
      extractedChars: Number(
        game.extractedChars ??
          (index.pages ?? []).reduce((total, page) => total + (page.text?.length ?? 0), 0),
      ),
      localFileName: game.pdfPath ? basename(game.pdfPath) : undefined,
      status: game.status ?? "failed",
      statusLabel: game.statusLabel ?? game.status ?? "Unknown",
      statusMessage: game.statusMessage ?? "Imported from the local prototype.",
      progress: Number(game.progress ?? 0),
      addedAt: Date.parse(game.addedAt) || Date.now(),
      updatedAt: Date.parse(game.updatedAt) || Date.now(),
    }),
  });
  summary.games += 1;

  const chunks = (index.chunks ?? []).map((chunk) => ({
    page: Number(chunk.page ?? 0),
    text: chunk.text ?? "",
    sourceUrl: chunk.sourceUrl ?? game.sourceUrl ?? `legacy://bgg/${game.id}`,
    sourceLabel: chunk.sourceLabel ?? `${game.name} legacy rulebook`,
    checksum: createHash("sha256")
      .update(`${chunk.page ?? 0}\n${chunk.text ?? ""}`)
      .digest("hex"),
    embedding:
      Array.isArray(chunk.embedding) && chunk.embedding.length === 1536
        ? chunk.embedding
        : undefined,
  }));
  for (let offset = 0; offset < chunks.length; offset += 25) {
    summary.chunks += await client.mutation(api.migrations.importChunks, {
      secret,
      rulebookId: imported.rulebookId,
      chunks: compact(chunks.slice(offset, offset + 25)),
    });
  }

  const messages = (state.messages?.[String(game.id)] ?? []).map((message, index) => ({
    index,
    role: message.role === "assistant" ? "assistant" : "user",
    text: message.text ?? "",
    citations: (message.citations ?? []).map((citation) => ({
      page: Number(citation.page ?? 0),
      quote: citation.quote ?? "",
      sourceUrl: citation.sourceUrl ?? game.sourceUrl ?? `legacy://bgg/${game.id}`,
      sourceLabel: citation.sourceLabel ?? `${game.name} legacy rulebook`,
    })),
  }));
  for (let offset = 0; offset < messages.length; offset += 20) {
    summary.messages += await client.mutation(api.migrations.importMessages, {
      secret,
      bggId: Number(game.id),
      rulebookId: imported.rulebookId,
      chatThreadId: imported.chatThreadId,
      messages: messages.slice(offset, offset + 20),
    });
  }
  summary.citations += messages.reduce(
    (total, message) => total + message.citations.length,
    0,
  );
}

console.log(JSON.stringify(summary, null, 2));
