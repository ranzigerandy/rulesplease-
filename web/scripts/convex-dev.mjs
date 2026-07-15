import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { spawn } from "node:child_process";
import process from "node:process";

const once = process.argv.includes("--once");
const envPath = resolve(".env.local");
const envContents = existsSync(envPath) ? readFileSync(envPath, "utf8") : "";
const linked = /^CONVEX_DEPLOYMENT=(?!anonymous)/m.test(envContents);
const signedIn = existsSync(resolve(homedir(), ".convex", "config.json"));
const command = process.platform === "win32" ? "npx.cmd" : "npx";

let args;
if (process.env.CONVEX_DEPLOY_KEY || linked) {
  args = ["convex", "dev"];
} else if (signedIn) {
  args = [
    "convex",
    "dev",
    "--configure",
    "new",
    "--dev-deployment",
    "cloud",
    "--project",
    "rules-please",
  ];
} else {
  console.error(
    "Rules Please uses a persistent Convex cloud deployment. Run `npx convex login` in web/ first, then retry.",
  );
  process.exit(1);
}
if (once) args.push("--once");

const child = spawn(command, args, { stdio: "inherit", shell: false });
child.on("exit", (code) => process.exit(code ?? 1));
