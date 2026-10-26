// The tool edit of a model endpoint in a job's checkout (MOD-checkout-tools, Parts: edit.mjs): one exact text replaced, found by opencode's matcher.
//
// Module: MOD-checkout-tools
//
// Ported from opencode v2.1.4, packages/core/src/tool/plugin/edit.ts (https://github.com/anomalyco/opencode): the matcher — exact, then typographic quotes,
// dashes and spaces made plain, then each line without its trailing whitespace — on the LF view of a file, its line endings kept, and its error messages.
// No Levenshtein cascade. Changed: plain JavaScript; the paths of the checkout and the restricted-source rule of Agent M; no permission, formatter or LSP.
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

import { readFileSync, writeFileSync } from "node:fs";
import { NO_CHECKOUT, barred, inside, rootOf } from "./paths.mjs";

const crlf = "\r\n";
const BOM = "﻿";

const normalizeForMatch = (value) => value
  .replace(/[‘’‚‛]/g, "'")
  .replace(/[“”„‟]/g, '"')
  .replace(/[‐‑‒–—―−]/g, "-")
  .replace(/[  -   　]/g, " ");

const findOccurrences = (content, search) => {
  const result = [];
  let offset = 0;
  while ((offset = content.indexOf(search, offset)) !== -1) {
    result.push({ start: offset, end: offset + search.length });
    offset += search.length;
  }
  return result;
};

const findLineOccurrences = (content, search) => {
  const trailingNewline = search.endsWith("\n");
  const expected = search.split("\n");
  if (trailingNewline) expected.pop();
  const lines = [...content.matchAll(/[^\n]*(?:\n|$)/g)]
    .filter((match) => match[0] !== "")
    .map((match) => {
      const newline = match[0].endsWith("\n");
      const text = newline ? match[0].slice(0, -1) : match[0];
      return { start: match.index, end: match.index + match[0].length, text, contentEnd: match.index + text.length - (text.endsWith("\r") ? 1 : 0), newline };
    });
  const candidates = lines.flatMap((line, index) => {
    const actual = lines.slice(index, index + expected.length);
    if (actual.length !== expected.length) return [];
    if (!actual.every((item, lineIndex) => normalizeForMatch(item.text.trimEnd()) === normalizeForMatch(expected[lineIndex].trimEnd()))) return [];
    const last = actual.at(-1);
    if (trailingNewline && !last.newline) return [];
    return [{ start: line.start, end: trailingNewline ? last.end : last.contentEnd }];
  });
  return candidates.reduce((result, candidate) => {
    if (result.some((match) => match.end > candidate.start && match.start < candidate.end)) return result;
    result.push(candidate);
    return result;
  }, []);
};

/** lineEnding(text, fallback) -> "\r\n" | "\n" — the dominant line ending in text, or fallback when there is none. */
export const lineEnding = (text, fallback) => {
  const crlfCount = text.split(crlf).length - 1;
  const lfCount = text.split("\n").length - 1 - crlfCount;
  if (crlfCount === lfCount) return fallback;
  return crlfCount > lfCount ? crlf : "\n";
};

/**
 * For each line of `after`, the index of the `before` line it keeps (longest common subsequence) or, between kept lines, the line it takes the place of;
 * undefined for lines with no counterpart.
 */
const alignLines = (before, after) => {
  const width = after.length + 1;
  const table = new Uint32Array((before.length + 1) * width);
  for (let i = before.length - 1; i >= 0; i--) {
    for (let j = after.length - 1; j >= 0; j--) {
      table[i * width + j] = before[i] === after[j] ? table[(i + 1) * width + j + 1] + 1 : Math.max(table[(i + 1) * width + j], table[i * width + j + 1]);
    }
  }
  const result = [];
  const gap = { before: [], after: [] };
  const flush = () => {
    gap.after.forEach((j, k) => (result[j] = gap.before[k]));
    gap.before = [];
    gap.after = [];
  };
  let i = 0;
  let j = 0;
  while (i < before.length && j < after.length) {
    if (before[i] === after[j]) {
      flush();
      result[j++] = i++;
      continue;
    }
    if (table[(i + 1) * width + j] >= table[i * width + j + 1]) gap.before.push(i++);
    else gap.after.push(j++);
  }
  while (i < before.length) gap.before.push(i++);
  while (j < after.length) gap.after.push(j++);
  flush();
  return result;
};

/**
 * Joins the replacement's lines with line endings taken from the matched source region. A replacement line that keeps a region line reuses that line's
 * ending; a line that changes in place reuses the ending of the line it replaces; only lines beyond those take `fallback`.
 */
const withRegionEndings = (region, replacement, fallback) => {
  const before = region.split(/\r?\n/);
  const endings = [...region.matchAll(/\r?\n/g)].map((match) => match[0]);
  const after = replacement.split("\n");
  const key = (line) => normalizeForMatch(line.trimEnd());
  const source = alignLines(before.map(key), after.map(key));
  return after.map((line, index) => (index === after.length - 1 ? line : line + (endings[source[index]] ?? fallback))).join("");
};

/** Number of sorted positions strictly before offset. */
const countBefore = (positions, offset) => {
  let low = 0;
  let high = positions.length;
  while (low < high) {
    const middle = (low + high) >> 1;
    if (positions[middle] < offset) low = middle + 1;
    else high = middle;
  }
  return low;
};

/**
 * Matches against the LF view Read shows the model, then maps offsets back to the source, so CRLF and mixed line endings neither block matches nor leak
 * into untouched regions.
 */
const matchView = (source, oldString, newString) => {
  const view = source.replaceAll(crlf, "\n");
  const removed = [...source.matchAll(/\r\n/g)].map((match, index) => match.index - index);
  const fileEnding = lineEnding(source, "\n");
  const search = oldString.replaceAll(crlf, "\n");
  const replacement = newString.replaceAll(crlf, "\n");
  const exact = findOccurrences(view, search);
  // These one-to-one mappings preserve offsets into the LF view.
  const unicode = exact.length > 0 ? [] : findOccurrences(normalizeForMatch(view), normalizeForMatch(search));
  const trailing = exact.length > 0 || unicode.length > 0 ? [] : findLineOccurrences(view, search);
  return {
    matches: (exact.length > 0 ? exact : unicode.length > 0 ? unicode : trailing).map((match) => ({
      start: match.start + countBefore(removed, match.start),
      end: match.end + countBefore(removed, match.end),
    })),
    replace: (match) => {
      const region = source.slice(match.start, match.end);
      return withRegionEndings(region, replacement, lineEnding(region, fileEnding));
    },
  };
};

/**
 * edit({ path, oldString, newString, replaceAll? }, context) -> Promise<string> — replaces oldString in the file at `path` inside the job's checkout with
 * newString, once, or at every occurrence with replaceAll; keeps the file's byte-order mark and its line endings. Answers what it did, or why it did not, in
 * opencode's words.
 */
export async function edit({ path, oldString, newString, replaceAll }, context) {
  if (oldString === newString) return "No changes to apply: oldString and newString are identical.";
  if (oldString === "") return "oldString must not be empty. Use write to create or overwrite a file.";
  const root = rootOf(context);
  if (!root) return NO_CHECKOUT;
  const at = inside(root, path);
  if (at.refused) return at.refused;
  const why = barred(context, at.relative);
  if (why) return why;
  let original;
  try {
    original = readFileSync(at.path, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") return `File not found: ${path}`;
    if (error?.code === "EISDIR") return `Path is a directory, not a file: ${path}`;
    return `Unable to edit ${path}: ${error?.message ?? error}`;
  }
  const bom = original.startsWith(BOM);
  const source = bom ? original.slice(1) : original;
  // Strings that differ only in \r ask to change line endings themselves, so they apply to the exact bytes. Every other edit matches the LF view read
  // shows the model and keeps the file's endings.
  const endingsOnly = oldString.replaceAll("\r", "") === newString.replaceAll("\r", "");
  const { matches, replace } = endingsOnly
    ? { matches: findOccurrences(source, oldString), replace: () => newString }
    : matchView(source, oldString, newString);
  const replacements = matches.length;
  if (replacements === 0) return `Could not find oldString in ${path}. It must match exactly, including whitespace and indentation.`;
  if (replacements > 1 && replaceAll !== true) {
    return `Found ${replacements} matches for oldString, but expected exactly one. Add more surrounding context to make oldString unique, or set replaceAll to true to replace every occurrence.`;
  }
  const replaced = (replaceAll === true ? matches : matches.slice(0, 1)).toReversed()
    .reduce((content, match) => `${content.slice(0, match.start)}${replace(match)}${content.slice(match.end)}`, source);
  if (replaced === source) {
    return endingsOnly ? `No changes to apply: ${path} already has those line endings.`
      : `No changes to apply: the edit leaves ${path} unchanged. Line endings follow the file; to change them, write \\r explicitly in oldString or newString.`;
  }
  const withBom = bom || replaced.startsWith(BOM);
  writeFileSync(at.path, `${withBom ? BOM : ""}${replaced.startsWith(BOM) ? replaced.slice(1) : replaced}`);
  return `Edited ${path} (${replacements} replacement${replacements === 1 ? "" : "s"})`;
}
