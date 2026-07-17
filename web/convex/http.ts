import { httpRouter } from "convex/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { env, httpAction } from "./_generated/server";

const http = httpRouter();

function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function authorizeWorker(request: Request) {
  const secret = env.RULES_PLEASE_WORKER_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    throw new Error("Unauthorized");
  }
}

async function body<T>(request: Request): Promise<T> {
  const length = Number(request.headers.get("content-length") ?? "0");
  if (length > 7_500_000) throw new Error("Request body is too large");
  return (await request.json()) as T;
}

type JobLease = { jobId: Id<"ingestionJobs">; leaseToken: string };
type HeartbeatInput = JobLease & {
  phase: string;
  progress: number;
  statusMessage: string;
  leaseMs: number;
};
type PrepareInput = JobLease & {
  source: {
    url: string;
    label: string;
    language: string;
    edition?: string;
    confidence: string;
    reviewStatus: "approved" | "review_required";
  };
};
type ChunkInput = JobLease & {
  chunks: Array<{
    page: number;
    text: string;
    sourceUrl: string;
    sourceLabel: string;
    checksum: string;
    embedding?: number[];
  }>;
};
type CompleteInput = JobLease & {
  result: {
    pageCount: number;
    chunkCount: number;
    extractedChars: number;
    embeddingModel?: string;
    documentHash: string;
    localFileName?: string;
    storageId?: Id<"_storage">;
  };
};
type FailInput = JobLease & { error: string; reviewRequired: boolean };

const claim = httpAction(async (ctx, request) => {
  try {
    authorizeWorker(request);
    const input = await body<{ workerId?: string; leaseMs?: number }>(request);
    const claimed = await ctx.runMutation(internal.workers.claim, {
      workerId: String(input.workerId ?? "python-worker"),
      leaseToken: crypto.randomUUID(),
      leaseMs: Number(input.leaseMs ?? 300_000),
    });
    return json(claimed);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Invalid request" }, 401);
  }
});

const heartbeat = httpAction(async (ctx, request) => {
  try {
    authorizeWorker(request);
    const input = await body<HeartbeatInput>(request);
    await ctx.runMutation(internal.workers.heartbeat, input);
    return json({ ok: true });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Invalid request" }, 400);
  }
});

const prepare = httpAction(async (ctx, request) => {
  try {
    authorizeWorker(request);
    const input = await body<PrepareInput>(request);
    const prepared = await ctx.runMutation(
      internal.workers.prepareRulebook,
      input,
    );
    return json(prepared);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Invalid request" }, 400);
  }
});

const requestApproval = httpAction(async (ctx, request) => {
  try {
    authorizeWorker(request);
    const input = await body<JobLease>(request);
    await ctx.runMutation(internal.workers.requestApproval, input);
    return json({ ok: true });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Invalid request" }, 400);
  }
});

const chunks = httpAction(async (ctx, request) => {
  try {
    authorizeWorker(request);
    const input = await body<ChunkInput>(request);
    const inserted = await ctx.runMutation(internal.workers.upsertChunks, input);
    return json({ inserted });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Invalid request" }, 400);
  }
});

const complete = httpAction(async (ctx, request) => {
  try {
    authorizeWorker(request);
    const input = await body<CompleteInput>(request);
    await ctx.runMutation(internal.workers.complete, input);
    return json({ ok: true });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Invalid request" }, 400);
  }
});

const fail = httpAction(async (ctx, request) => {
  try {
    authorizeWorker(request);
    const input = await body<FailInput>(request);
    await ctx.runMutation(internal.workers.fail, input);
    return json({ ok: true });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Invalid request" }, 400);
  }
});

const uploadUrl = httpAction(async (ctx, request) => {
  try {
    authorizeWorker(request);
    return json({ uploadUrl: await ctx.storage.generateUploadUrl() });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Unauthorized" }, 401);
  }
});

http.route({ path: "/worker/jobs/claim", method: "POST", handler: claim });
http.route({ path: "/worker/jobs/heartbeat", method: "POST", handler: heartbeat });
http.route({ path: "/worker/jobs/prepare", method: "POST", handler: prepare });
http.route({ path: "/worker/jobs/request-approval", method: "POST", handler: requestApproval });
http.route({ path: "/worker/jobs/chunks", method: "POST", handler: chunks });
http.route({ path: "/worker/jobs/complete", method: "POST", handler: complete });
http.route({ path: "/worker/jobs/fail", method: "POST", handler: fail });
http.route({ path: "/worker/rulebooks/upload-url", method: "POST", handler: uploadUrl });

export default http;
