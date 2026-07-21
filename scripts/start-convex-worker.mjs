import { execFileSync, spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const webRoot = resolve(root, "web");
const command = process.platform === "win32" ? "npx.cmd" : "npx";
const lines = execFileSync(command, ["convex", "env", "list"], {
  cwd: webRoot,
  encoding: "utf8",
  shell: process.platform === "win32",
}).trim().split(/\r?\n/);
const values = Object.fromEntries(lines.map((line) => {
  const separator = line.indexOf("=");
  return separator === -1 ? [line, ""] : [line.slice(0, separator), line.slice(separator + 1)];
}));

const webEnv = existsSync(resolve(webRoot, ".env.local"))
  ? Object.fromEntries(readFileSync(resolve(webRoot, ".env.local"), "utf8")
      .split(/\r?\n/)
      .filter((line) => line.includes("="))
      .map((line) => {
        const separator = line.indexOf("=");
        return [line.slice(0, separator), line.slice(separator + 1)];
      }))
  : {};
const convexUrl = webEnv.NEXT_PUBLIC_CONVEX_URL;
const siteUrl = convexUrl ? convexUrl.replace(".convex.cloud", ".convex.site") : undefined;

if (!siteUrl || !values.RULES_PLEASE_WORKER_SECRET || !values.OPENAI_API_KEY) {
  throw new Error("Convex URL, worker secret, or OpenAI key is not configured.");
}

const child = spawn("python", ["convex_worker.py"], {
  cwd: root,
  env: {
    ...process.env,
    CONVEX_SITE_URL: siteUrl,
    RULES_PLEASE_WORKER_SECRET: values.RULES_PLEASE_WORKER_SECRET,
    OPENAI_API_KEY: values.OPENAI_API_KEY,
  },
  stdio: "inherit",
});
child.on("exit", (code) => process.exit(code ?? 1));
