// MOD-checkout-tools — the tools a model endpoint works with in a job's checkout, as strategies of the job runner, and the prompt it reads first.
//
// Module: MOD-checkout-tools
//
// Node only: the GitHub runner and the Bridge register these strategies for the model endpoints whose jobs they run; the browser does not. Each tool
// works inside `context.product.checkout` and answers with a text the participant reads, a refusal or a failure included; it throws nothing.

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { edit } from "./edit.mjs";
import { read, write } from "./files.mjs";
import { glob, grep } from "./search.mjs";
import { bashTool } from "./shell.mjs";
import { webfetch } from "./webfetch.mjs";

const PROMPT = new URL("./prompt.md", import.meta.url);

// A tool whose own failure, such as a file it may not open, is answered as text rather than thrown, so that every call gets a result.
const answering = (tool) => async (args, context) => {
  try {
    return await tool(args ?? {}, context);
  } catch (error) {
    return `${error?.message ?? error}`;
  }
};

/**
 * checkoutStrategies({ hidden }: { hidden: string[] }) -> { tools: Record<string, (args, context) => Promise<string>> } — the strategies of the tools read,
 * write, edit, bash, grep, glob and webfetch, by the names MOD-job-catalogue's tools.md gives them; `hidden` names the environment variables — the endpoint's
 * key, every variable a CI secret fills — that a command of bash does not receive.
 */
export function checkoutStrategies({ hidden = [] } = {}) {
  const tools = { read, write, edit, bash: bashTool(hidden), grep, glob, webfetch };
  return { tools: Object.fromEntries(Object.entries(tools).map(([name, tool]) => [name, answering(tool)])) };
}

// Whether the folder is a git checkout, and on which branch.
function gitOf(folder) {
  const git = (...args) => execFileSync("git", args, { cwd: folder, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  try { return `yes, on the branch ${git("symbolic-ref", "--short", "HEAD")}`; } catch { /* not on a branch, or no checkout */ }
  try { return git("rev-parse", "--is-inside-work-tree") === "true" ? "yes, on no branch" : "no"; } catch { return "no"; }
}

/**
 * checkoutPrompt({ folder, now }: { folder: string, now: Date }) -> Promise<string> — the prompt of this module's prompt.md with its environment filled in:
 * the working folder, the platform, the date of `now`, and whether the folder is a git checkout on which branch.
 */
export async function checkoutPrompt({ folder, now }) {
  const values = { folder, platform: process.platform, date: now.toISOString().slice(0, 10), git: gitOf(folder) };
  return readFileSync(PROMPT, "utf8").replace(/\{(folder|platform|date|git)\}/g, (_, name) => values[name]).trimEnd();
}
