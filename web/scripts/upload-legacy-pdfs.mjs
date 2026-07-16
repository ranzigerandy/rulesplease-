import { readFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ConvexHttpClient } from "convex/browser";
import dotenv from "dotenv";
import { api } from "../convex/_generated/api.js";

const webRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const projectRoot = resolve(webRoot, "..");
dotenv.config({ path: resolve(webRoot, ".env.local") });

const url = process.env.NEXT_PUBLIC_CONVEX_URL ?? process.env.CONVEX_URL;
const secret = process.env.RULES_PLEASE_MIGRATION_SECRET;
if (!url || !secret) throw new Error("Convex URL and migration secret are required");

const client = new ConvexHttpClient(url);
const state = JSON.parse(await readFile(resolve(projectRoot, "data/state.json"), "utf8"));

for (const game of state.games ?? []) {
  if (!game.pdfPath) continue;
  const bytes = await readFile(game.pdfPath);
  const uploadUrl = await client.mutation(api.migrations.generateRulebookUploadUrl, { secret });
  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: { "Content-Type": "application/pdf" },
    body: bytes,
  });
  if (!response.ok) throw new Error(`Upload failed for ${game.name}: ${response.status}`);
  const { storageId } = await response.json();
  try {
    await client.mutation(api.migrations.attachLegacyRulebookFile, {
      secret,
      bggId: Number(game.id),
      storageId,
      localFileName: basename(game.pdfPath),
    });
    console.log(`Uploaded ${game.name}`);
  } catch (error) {
    console.warn(`Skipped ${game.name}: ${error instanceof Error ? error.message.split("\n")[0] : "not found"}`);
  }
}
