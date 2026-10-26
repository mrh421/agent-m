// The tools read and write of a model endpoint in a job's checkout (MOD-checkout-tools, Parts: files.mjs).
//
// Module: MOD-checkout-tools
//
// Ported from opencode v1.19.0, packages/opencode/src/tool/read.ts and write.ts (https://github.com/anomalyco/opencode): read's limits — 2000 lines, 2000
// characters a line, 50 KB —, its `N: ` prefix, its closing lines, its refusal of a binary file, its listing of a folder and its "did you mean"; write's
// folders created and byte-order mark kept. Changed: plain JavaScript; the paths of the checkout and the restricted-source rule of Agent M; no permission,
// LSP, image or PDF attachment; write also keeps a file's CRLF line endings.
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

import { closeSync, createReadStream, mkdirSync, openSync, readFileSync, readSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { basename, dirname, extname, join } from "node:path";
import { NO_CHECKOUT, barred, inside, rootOf } from "./paths.mjs";
import { lineEnding } from "./edit.mjs";

const DEFAULT_READ_LIMIT = 2000;
const MAX_LINE_LENGTH = 2000;
const MAX_LINE_SUFFIX = `... (line truncated to ${MAX_LINE_LENGTH} chars)`;
const MAX_BYTES = 50 * 1024;
const MAX_BYTES_LABEL = `${MAX_BYTES / 1024} KB`;
const SAMPLE_BYTES = 4096;
const BOM = "﻿";
const BINARY_EXTENSIONS = new Set([".zip", ".tar", ".gz", ".exe", ".dll", ".so", ".class", ".jar", ".war", ".7z", ".doc", ".docx", ".xls", ".xlsx", ".ppt",
  ".pptx", ".odt", ".ods", ".odp", ".bin", ".dat", ".obj", ".o", ".a", ".lib", ".wasm", ".pyc", ".pyo"]);

function miss(filepath) {
  const dir = dirname(filepath), base = basename(filepath).toLowerCase();
  let items = [];
  try {
    items = readdirSync(dir).filter((item) => item.toLowerCase().includes(base) || base.includes(item.toLowerCase())).map((item) => join(dir, item)).slice(0, 3);
  } catch { items = []; }
  return items.length > 0 ? `File not found: ${filepath}\n\nDid you mean one of these?\n${items.join("\n")}` : `File not found: ${filepath}`;
}

function list(filepath) {
  return readdirSync(filepath, { withFileTypes: true }).map((item) => {
    if (item.isDirectory()) return `${item.name}/`;
    if (!item.isSymbolicLink()) return item.name;
    try { return statSync(join(filepath, item.name)).isDirectory() ? `${item.name}/` : item.name; } catch { return item.name; }
  }).sort((a, b) => a.localeCompare(b));
}

function sample(filepath, size) {
  if (size === 0) return Buffer.alloc(0);
  const fd = openSync(filepath, "r");
  try {
    const bytes = Buffer.alloc(Math.min(SAMPLE_BYTES, size));
    const read = readSync(fd, bytes, 0, bytes.length, 0);
    return bytes.subarray(0, read);
  } finally { closeSync(fd); }
}

function isBinaryFile(filepath, bytes) {
  if (BINARY_EXTENSIONS.has(extname(filepath).toLowerCase())) return true;
  if (bytes.length === 0) return false;
  let nonPrintableCount = 0;
  for (const byte of bytes) {
    if (byte === 0) return true;
    if (byte < 9 || (byte > 13 && byte < 32)) nonPrintableCount++;
  }
  return nonPrintableCount / bytes.length > 0.3;
}

// The lines from `offset` on, at most `limit` of them and MAX_BYTES together; `count` is every line read, which is all of the file unless the bytes ran out.
async function lines(filepath, { limit, offset }) {
  const start = offset - 1;
  const raw = [];
  const flags = { bytes: 0, count: 0, cut: false, more: false };
  const stream = createReadStream(filepath, { encoding: "utf8" });
  const reader = createInterface({ input: stream, crlfDelay: Infinity });
  try {
    for await (let text of reader) {
      if (flags.count === 0 && text.startsWith(BOM)) text = text.slice(1);
      flags.count += 1;
      if (flags.count <= start) continue;
      if (raw.length >= limit) {
        flags.more = true;
        continue;
      }
      const line = text.length > MAX_LINE_LENGTH ? text.substring(0, MAX_LINE_LENGTH) + MAX_LINE_SUFFIX : text;
      const size = Buffer.byteLength(line, "utf-8") + (raw.length > 0 ? 1 : 0);
      if (flags.bytes + size <= MAX_BYTES) {
        raw.push(line);
        flags.bytes += size;
        continue;
      }
      flags.cut = true;
      flags.more = true;
      break;
    }
  } finally {
    reader.close();
    stream.destroy();
  }
  return { raw, count: flags.count, cut: flags.cut, more: flags.more, offset };
}

/**
 * read({ path, offset?, limit? }, context) -> Promise<string> — the file at `path` inside the job's checkout, each line as `N: text`, from line `offset`
 * (1 by default), at most `limit` lines (2000 by default) and 50 KB, with the line telling how to go on; a folder's entries; a refusal of a binary file, of a
 * path outside the checkout and of a restricted source's content the drafter's place is not allowed.
 */
export async function read({ path, offset, limit }, context) {
  const root = rootOf(context);
  if (!root) return NO_CHECKOUT;
  const at = inside(root, path);
  if (at.refused) return at.refused;
  const why = barred(context, at.relative);
  if (why) return why;
  const filepath = at.path;
  let stat;
  try { stat = statSync(filepath); } catch { return miss(filepath); }
  if (stat.isDirectory()) {
    const items = list(filepath);
    const count = limit ?? DEFAULT_READ_LIMIT;
    const from = offset || 1;
    const sliced = items.slice(from - 1, from - 1 + count);
    const truncated = from - 1 + sliced.length < items.length;
    return [`<path>${filepath}</path>`, "<type>directory</type>", "<entries>", sliced.join("\n"),
      truncated ? `\n(Showing ${sliced.length} of ${items.length} entries. Use 'offset' parameter to read beyond entry ${from + sliced.length})` : `\n(${items.length} entries)`,
      "</entries>"].join("\n");
  }
  if (isBinaryFile(filepath, sample(filepath, stat.size))) return `Cannot read binary file: ${filepath}`;
  const file = await lines(filepath, { limit: limit ?? DEFAULT_READ_LIMIT, offset: offset || 1 });
  if (file.count < file.offset && !(file.count === 0 && file.offset === 1)) return `Offset ${file.offset} is out of range for this file (${file.count} lines)`;
  let output = [`<path>${filepath}</path>`, "<type>file</type>", "<content>\n"].join("\n");
  output += file.raw.map((line, i) => `${i + file.offset}: ${line}`).join("\n");
  const last = file.offset + file.raw.length - 1;
  const next = last + 1;
  if (file.cut) output += `\n\n(Output capped at ${MAX_BYTES_LABEL}. Showing lines ${file.offset}-${last}. Use offset=${next} to continue.)`;
  else if (file.more) output += `\n\n(Showing lines ${file.offset}-${last} of ${file.count}. Use offset=${next} to continue.)`;
  else output += `\n\n(End of file - total ${file.count} lines)`;
  return `${output}\n</content>`;
}

/**
 * write({ path, content }, context) -> Promise<string> — the file at `path` inside the job's checkout written with `content`, its folders created; the
 * byte-order mark of the file, or of the content, kept, and a file's CRLF line endings kept where the content has none of its own.
 */
export async function write({ path, content }, context) {
  const root = rootOf(context);
  if (!root) return NO_CHECKOUT;
  const at = inside(root, path);
  if (at.refused) return at.refused;
  let existing = null;
  try {
    existing = readFileSync(at.path, "utf8");
  } catch (error) {
    if (error?.code === "EISDIR") return `Path is a directory, not a file: ${path}`;
    if (error?.code !== "ENOENT") return `Unable to write ${path}: ${error?.message ?? error}`;
  }
  const bom = existing?.startsWith(BOM) || content.startsWith(BOM);
  let text = content.startsWith(BOM) ? content.slice(1) : content;
  if (existing !== null && lineEnding(existing, "\n") === "\r\n" && !text.includes("\r\n")) text = text.replaceAll("\n", "\r\n");
  mkdirSync(dirname(at.path), { recursive: true });
  writeFileSync(at.path, `${bom ? BOM : ""}${text}`);
  return "Wrote file successfully.";
}
