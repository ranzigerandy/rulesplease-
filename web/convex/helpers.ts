import { env, type ActionCtx, type MutationCtx, type QueryCtx } from "./_generated/server";

export async function requireUserId(ctx: QueryCtx | MutationCtx | ActionCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (identity === null) {
    throw new Error("Not authenticated");
  }
  return identity.subject;
}

export function requireConfiguredSecret(
  supplied: string,
  environmentName: "RULES_PLEASE_WORKER_SECRET" | "RULES_PLEASE_MIGRATION_SECRET",
) {
  const configured = env[environmentName];
  if (!configured || supplied !== configured) {
    throw new Error("Unauthorized");
  }
}
