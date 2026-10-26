// The tools grep and glob of a model endpoint in a job's checkout (MOD-checkout-tools, Parts: search.mjs).
//
// Module: MOD-checkout-tools
//
// Ported from opencode v1.19.0, packages/opencode/src/tool/grep.ts and glob.ts (https://github.com/anomalyco/opencode): at most 100 results, and their
// forms — "Found N matches", each file's path followed by `  Line n: text`, the note on truncated results, "No files found". Changed: plain JavaScript; the
// files are those `git ls-files -co --exclude-standard` lists, matched in JavaScript instead of by ripgrep; the paths of the checkout and the
// restricted-source rule of Agent M.
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

import { execFile } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { basename, dirname, join, relative, sep } from "node:path";
import { promisify } from "node:util";
import { NO_CHECKOUT, barred, inside, rootOf } from "./paths.mjs";

const LIMIT = 100;
const MAX_LINE_LENGTH = 2000;
const run = promisify(execFile);

// The files git lists below a folder — tracked and untracked, not ignored —, relative to it, in sorted order.
async function listed(dir) {
  const { stdout } = await run("git", ["ls-files", "-co", "--exclude-standard", "-z"], { cwd: dir, maxBuffer: 256 * 1024 * 1024 });
  return [...new Set(stdout.split("\0").filter(Boolean))].sort();
}

// A glob as the body of a regular expression: `**/` any folders, `**` anything, `*` and `?` within one name, `{a,b}` either, `[...]` a class.
function globBody(glob) {
  let body = "";
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === "*" && glob[i + 1] === "*") {
      i += 1;
      if (glob[i + 1] === "/") { i += 1; body += "(?:.*/)?"; } else body += ".*";
    } else if (c === "*") body += "[^/]*";
    else if (c === "?") body += "[^/]";
    else if (c === "{" && glob.indexOf("}", i) > i) {
      const end = glob.indexOf("}", i);
      body += `(?:${glob.slice(i + 1, end).split(",").map(globBody).join("|")})`;
      i = end;
    } else if (c === "[" && glob.indexOf("]", i + 1) > i) {
      const end = glob.indexOf("]", i + 1);
      body += glob.slice(i, end + 1).replace(/^\[!/, "[^");
      i = end;
    } else body += c.replace(/[.+^$()|\\{}[\]]/g, "\\$&");
  }
  return body;
}

// Whether a path matches a glob: a glob without "/" is matched against the file's name at any depth, as ripgrep does, one with "/" against the path.
const matcher = (glob) => {
  const pattern = new RegExp(`^${globBody(glob)}$`);
  return (path) => pattern.test(glob.includes("/") ? path : path.split("/").pop());
};

const posix = (path) => path.split(sep).join("/");

/**
 * grep({ pattern, path?, include? }, context) -> Promise<string> — the lines that match the regular expression `pattern` in the files git lists below `path`
 * (a folder or a file; the checkout by default), only those whose name matches the glob `include` where it is given; at most 100, in opencode's form. A
 * file of a restricted source the drafter's place is not allowed is not read, and its refusal is named at the end.
 */
export async function grep({ pattern, path, include }, context) {
  if (!pattern) return "pattern is required";
  const root = rootOf(context);
  if (!root) return NO_CHECKOUT;
  const at = inside(root, path ?? ".");
  if (at.refused) return at.refused;
  let regex;
  try { regex = new RegExp(pattern); } catch (error) { return `Invalid pattern: ${error.message}`; }
  let isFile = false;
  try { isFile = statSync(at.path).isFile(); } catch { return "No files found"; }
  const dir = isFile ? dirname(at.path) : at.path, only = isFile ? basename(at.path) : null;
  const wanted = include ? matcher(include) : () => true;
  const rows = [], refused = [];
  files: for (const file of await listed(dir)) {
    if ((only && file !== only) || !wanted(file)) continue;
    const absolute = join(dir, file);
    const why = barred(context, posix(relative(root, absolute)));
    if (why) { refused.push(why); continue; }
    let bytes;
    try { bytes = readFileSync(absolute); } catch { continue; }
    if (bytes.subarray(0, 4096).includes(0)) continue;
    const lines = bytes.toString("utf8").split(/\r?\n/);
    for (let index = 0; index < lines.length; index++) {
      if (!regex.test(lines[index])) continue;
      const text = lines[index].length > MAX_LINE_LENGTH ? `${lines[index].slice(0, MAX_LINE_LENGTH)}...` : lines[index];
      rows.push({ path: absolute, line: index + 1, text });
      if (rows.length === LIMIT) break files;
    }
  }
  const output = [];
  if (rows.length === 0) output.push("No files found");
  else {
    const truncated = rows.length === LIMIT;
    output.push(`Found ${rows.length} matches${truncated ? " (more matches available)" : ""}`);
    let current = "";
    for (const match of rows) {
      if (current !== match.path) {
        if (current !== "") output.push("");
        current = match.path;
        output.push(`${match.path}:`);
      }
      output.push(`  Line ${match.line}: ${match.text}`);
    }
    if (truncated) output.push("", "(Results truncated. Consider using a more specific path or pattern.)");
  }
  if (refused.length) output.push("", ...refused);
  return output.join("\n");
}

/**
 * glob({ pattern, path? }, context) -> Promise<string> — the files git lists below the folder `path` (the checkout by default) whose path matches the glob
 * `pattern`, each as its full path, at most 100, in opencode's form.
 */
export async function glob({ pattern, path }, context) {
  const root = rootOf(context);
  if (!root) return NO_CHECKOUT;
  const at = inside(root, path ?? ".");
  if (at.refused) return at.refused;
  try { if (statSync(at.path).isFile()) return `glob path must be a directory: ${at.path}`; } catch { return "No files found"; }
  const matches = matcher(pattern);
  const files = (await listed(at.path)).filter(matches).slice(0, LIMIT);
  if (files.length === 0) return "No files found";
  const output = files.map((file) => join(at.path, file));
  if (files.length === LIMIT) output.push("", `(Results are truncated: showing first ${LIMIT} results. Consider using a more specific path or pattern.)`);
  return output.join("\n");
}
