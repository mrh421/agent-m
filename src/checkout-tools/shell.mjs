// The tool bash of a model endpoint in a job's checkout (MOD-checkout-tools, Parts: shell.mjs): one command run by the shell, in the checkout.
//
// Module: MOD-checkout-tools
//
// Ported from opencode v1.19.0, packages/opencode/src/tool/shell.ts and truncate.ts (https://github.com/anomalyco/opencode): the default timeout of two
// minutes, SIGTERM and SIGKILL three seconds later, the combined output's tail of 2000 lines and 50 KB with the whole saved to a file, and the words of a
// timeout. Changed: plain JavaScript; the command's process group is ended with MOD-agent-processes' stopTree; the exit code is part of the text the model
// reads; the variables a CI secret fills are not in the command's environment; no permission scan of the command.
//
// MIT License
//
// Copyright (c) 2025 opencode
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.

import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { stopTree } from "../agent-processes/index.mjs";
import { NO_CHECKOUT, inside, rootOf } from "./paths.mjs";

const DEFAULT_TIMEOUT = 2 * 60 * 1000;
const FORCE_KILL_AFTER = 3000;
const MAX_LINES = 2000;
const MAX_BYTES = 50 * 1024;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// The shell and its arguments for one command: bash where it is installed, else sh; cmd.exe on Windows.
function shellOf(command) {
  if (process.platform === "win32") return [process.env.ComSpec || "cmd.exe", ["/d", "/s", "/c", command]];
  return [existsSync("/bin/bash") ? "/bin/bash" : "/bin/sh", ["-c", command]];
}

// Whether any process of the child's group still runs; on Windows, whether the child has not exited.
function groupAlive(child) {
  if (process.platform === "win32") return child.exitCode === null && child.signalCode === null;
  try { process.kill(-child.pid, 0); return true; } catch { return false; }
}

// SIGTERM to the command's whole process group, then SIGKILL to what is left of it after three seconds.
async function terminate(child) {
  await stopTree(child, "SIGTERM").catch(() => {});
  for (let waited = 0; waited < FORCE_KILL_AFTER && groupAlive(child); waited += 50) await sleep(50);
  if (groupAlive(child)) await stopTree(child, "SIGKILL").catch(() => {});
}

// The last MAX_LINES lines of a text, and of them at most MAX_BYTES, with whether anything was cut.
function tail(text) {
  const ended = text.endsWith("\n");
  let lines = (ended ? text.slice(0, -1) : text).split("\n");
  let cut = false;
  if (lines.length > MAX_LINES) { lines = lines.slice(-MAX_LINES); cut = true; }
  let bytes = Buffer.byteLength(lines.join("\n"), "utf8");
  while (bytes > MAX_BYTES && lines.length > 1) {
    bytes -= Buffer.byteLength(lines[0], "utf8") + 1;
    lines.shift();
    cut = true;
  }
  if (bytes > MAX_BYTES) {
    lines = [Buffer.from(lines[0], "utf8").subarray(-MAX_BYTES).toString("utf8")];
    cut = true;
  }
  return { text: `${lines.join("\n")}${ended && lines.join("") !== "" ? "\n" : ""}`, cut };
}

/**
 * bashTool(hidden: string[]) -> (args, context) => Promise<string> — the tool bash, which runs `command` with the shell in the checkout, or in its folder
 * `workdir`, ends its whole process group after `timeout` ms (two minutes by default), and answers the tail of its combined output — the whole saved to a
 * file outside the checkout where it was cut — with its exit code. The environment variables named in `hidden` are not in the command's environment.
 */
export function bashTool(hidden) {
  return async ({ command, timeout, workdir }, context) => {
    const root = rootOf(context);
    if (!root) return NO_CHECKOUT;
    let cwd = root;
    if (workdir !== undefined && workdir !== null) {
      const at = inside(root, workdir);
      if (at.refused) return at.refused;
      cwd = at.path;
    }
    if (timeout !== undefined && timeout !== null && !(timeout > 0)) return `Invalid timeout value: ${timeout}. Timeout must be a positive number.`;
    const limit = timeout ?? DEFAULT_TIMEOUT;
    const env = { ...process.env };
    for (const name of hidden) delete env[name];
    const [shell, args] = shellOf(command);
    const child = spawn(shell, args, { cwd, env, stdio: ["ignore", "pipe", "pipe"], detached: process.platform !== "win32", windowsHide: true });
    const chunks = [];
    child.stdout.on("data", (chunk) => chunks.push(chunk));
    child.stderr.on("data", (chunk) => chunks.push(chunk));
    const exited = new Promise((resolve) => {
      child.once("error", (error) => resolve({ code: null, signal: null, error }));
      child.once("exit", (code, signal) => resolve({ code, signal, error: null }));
    });
    const closed = new Promise((resolve) => child.once("close", resolve));
    let timer;
    const expired = await Promise.race([exited.then(() => false), new Promise((resolve) => { timer = setTimeout(() => resolve(true), limit); })]);
    clearTimeout(timer);
    if (expired) await terminate(child);
    const end = await exited;
    // A process the command left running may hold the output open; what it has written by now is kept, and the rest is not waited for.
    await Promise.race([closed, sleep(100)]);
    child.stdout.destroy();
    child.stderr.destroy();
    if (end.error) return `The command could not be started: ${end.error.message}`;
    const raw = Buffer.concat(chunks).toString("utf8");
    const shown = tail(raw);
    let output = shown.text || "(no output)";
    if (shown.cut) {
      const file = join(mkdtempSync(join(tmpdir(), "agent-m-output-")), "output.txt");
      writeFileSync(file, raw);
      output = `...output truncated...\n\nFull output saved to: ${file}\n\n${output}`;
    }
    const meta = [];
    if (expired) {
      meta.push(`shell tool terminated command after exceeding timeout ${limit} ms. If this command is expected to take longer and is not waiting for interactive input, retry with a larger timeout value in milliseconds.`);
    }
    meta.push(end.code === null ? `exit code: none, the command was ended by ${end.signal ?? "a signal"}` : `exit code: ${end.code}`);
    return `${output}\n\n<shell_metadata>\n${meta.join("\n")}\n</shell_metadata>`;
  };
}
