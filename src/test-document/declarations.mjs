// Declarations — finding the test declarations in a file's text, and which files are test files (MOD-test-document, Data).
//
// Module: MOD-test-document
//
// A declaration is a block of comment lines directly before a test case, in the comment marker of the file's language —
// `//`, `#`, `--`, `;` or the ` *` of a block comment, each after any indentation — or, for a manual test of level
// `user`, the same lines under a heading `### TST-<nnn> <title>` of a Markdown file (`path` ending `.md`). Its first line
// names the identifier, `TST-<nnn>`, and may pack further `key: value` parts after it on the same line, separated by
// ` · `; each following line is one whole `key: value` — even where its value itself holds ` · `, as UC-047's own
// notification text does: that does not split the line, and does not end the declaration (the reason of this item's
// rejection in sprint 08, docs/gates/20261007-1317-development-release-testing-a439.md). A declaration ends at the
// first line that is not a comment line of this form (in a Markdown file, not a plain `key: value` line); a missing key
// reads `null`.

const MARKERS = ["//", "#", "--", ";", "*"];
const PACK_SEPARATOR = " · ";
const FIRST_LINE = /^TST-(\d+)$/;
const KEY_LINE = /^([a-z]+):(.*)$/;
const HEADING = /^### (TST-\d+)\b(.*)$/;
// A string literal, an escaped quote inside it read as part of it; a loop header whose body opens on its line, `for (…) {`.
const STRING_LITERAL = /"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|`((?:[^`\\]|\\.)*)`/;
const LOOP_HEADER = /^\s*for\s*\(.*\)\s*\{\s*$/;
const DEFINED_NAME = /\b(?:def|function|func)\s+([A-Za-z_]\w*)/;
const FIELD_KEYS = ["level", "module", "guards", "given", "input", "expect", "runs", "phrasings", "paid"];

// A test file (MOD-test-document, Data): a file under a folder named `test`, `tests` or `__tests__`, or a file named as tests are
// named in its language — `*.test.mjs`, `test_*.py`, `*_test.go` and the like —; a Markdown file under such a folder holds manual
// tests, and is a test file as every file under one is. A test's name begins `test_`, ends `_test` or has `.test` or `.spec`
// before its extension.
const TEST_FOLDERS = new Set(["test", "tests", "__tests__"]);
const TEST_NAME = /^test_.|_test\.[A-Za-z0-9]+$|\.(?:test|spec)\.[A-Za-z0-9]+$/;

// The text as its lines, in order, each without its line ending (LF or CR LF).
function splitLines(text) {
  return text.split("\n").map((line) => (line.endsWith("\r") ? line.slice(0, -1) : line));
}

// `line` with its leading comment marker — one of MARKERS, after any indentation — and one layer of the whitespace that
// follows it removed; `null` where `line` carries none of MARKERS.
function commentContent(line) {
  const trimmed = line.replace(/^[ \t]+/, "");
  const marker = MARKERS.find((m) => trimmed.startsWith(m));
  return marker === undefined ? null : trimmed.slice(marker.length).replace(/^[ \t]+/, "");
}

// A fresh set of fields, every key named under Data `null`.
function emptyFields() {
  return Object.fromEntries(FIELD_KEYS.map((key) => [key, null]));
}

// Reads one `key: value` part into `fields`: `guards` splits its value at `;`, `runs` and `phrasings` read theirs as a
// number, every other key keeps its value trimmed, read whole. A key that is not one of FIELD_KEYS is passed over.
function applyField(fields, key, rawValue) {
  if (!FIELD_KEYS.includes(key)) return;
  const value = rawValue.trim();
  if (key === "guards") fields.guards = value.split(";").map((part) => part.trim()).filter((part) => part !== "");
  else if (key === "runs" || key === "phrasings") fields[key] = value === "" ? null : Number(value);
  else fields[key] = value;
}

// The title a test case gives itself on `line`, the first line after its declaration (MOD-test-document, Data): its first
// string literal, or else the name it defines; `null` where `line` is absent or holds neither.
function titleOn(line) {
  if (line === undefined) return null;
  const literal = STRING_LITERAL.exec(line);
  if (literal !== null) return (literal[1] ?? literal[2] ?? literal[3]).replace(/\\(["'`\\])/g, "$1").trim();
  const defined = DEFINED_NAME.exec(line);
  return defined === null ? null : defined[1];
}

// One declaration under construction (its identifier, fields, path and first line), flattened to a TestDeclaration.
function toDeclaration(entry) {
  return { id: entry.id, title: entry.title, ...entry.fields, path: entry.path, line: entry.line };
}

// isTestFile(path: string) -> boolean — whether a path is a test file, as defined above. The folders of a path are all its parts
// but the last, which is the file's name: a file called `tests` is under no folder named tests.
export function isTestFile(path) {
  const parts = path.split("/");
  return parts.slice(0, -1).some((folder) => TEST_FOLDERS.has(folder)) || TEST_NAME.test(parts[parts.length - 1]);
}

// isNamedTestFile(path: string) -> boolean — whether a path is named as tests are named in its language, as defined above,
// wherever it lies: the files a test runner runs. A helper, a fixture or a Markdown file of manual tests is a test file by its
// folder alone and is none; Markdown is no language whose tests a runner runs, whatever the file is called.
export function isNamedTestFile(path) {
  const name = path.split("/").pop();
  return !name.endsWith(".md") && TEST_NAME.test(name);
}

// testDeclarations(path: string, text: string) -> TestDeclaration[] — every test declaration of a test file, in order,
// as MOD-test-document's Data states them. `path` names the declarations it returns, and selects the form read: a
// Markdown file (`path` ending `.md`) by its headings, any other by its comment lines. It never throws on content: a
// declaration missing a key is read with that key `null`, and a file with no declaration yields none.
export function testDeclarations(path, text) {
  const p = typeof path === "string" ? path : String(path ?? "");
  const t = typeof text === "string" ? text : String(text ?? "");
  return p.endsWith(".md") ? markdownDeclarations(p, t) : commentDeclarations(p, t).filter((each) => each.id !== null);
}

// unidentifiedDeclarations(path: string, text: string) -> TestDeclaration[] — every block of comment lines of a test file
// that is written as a declaration but whose first line names no identifier: in its place, `key: value` parts with keys
// of the declaration. Each is read as a declaration is read, with `id` `null`, in order; testDeclarations gives none of
// them. The first line of a block is a comment line after a line that is none, so the key lines below an identifier are
// that declaration's own. A Markdown file holds no comment lines, and yields none. It never throws on content.
export function unidentifiedDeclarations(path, text) {
  const p = typeof path === "string" ? path : String(path ?? "");
  const t = typeof text === "string" ? text : String(text ?? "");
  return p.endsWith(".md") ? [] : commentDeclarations(p, t).filter((each) => each.id === null);
}

// Whether a comment's content opens with a `key: value` part whose key is one of the declaration's.
const opensWithField = (content) => FIELD_KEYS.includes(KEY_LINE.exec(content.split(PACK_SEPARATOR)[0].trim())?.[1]);

// A `/` follows a token after which a regular expression may stand, not a division: nothing, an operator or an opening
// bracket, or a keyword that takes a value. After a name, a number, `)` or `]` it divides.
const REGEX_MAY_FOLLOW = /^$|[(,=:[!&|?{;+\-*%<>~^]$|\b(?:return|typeof|case|in|of|delete|void|throw|else|do|yield|await)$/;

// The index of the `/` that closes the regular-expression literal opening at `line[start]`, an escaped character and a character
// class `[…]` read as part of it; -1 where the line holds no closing `/`.
function regexEnd(line, start) {
  let inClass = false;
  for (let i = start + 1; i < line.length; i += 1) {
    const c = line[i];
    if (c === "\\") i += 1;
    else if (c === "[") inClass = true;
    else if (c === "]") inClass = false;
    else if (c === "/" && !inClass) return i;
  }
  return -1;
}

// Whether a template string is still open at the end of `line`, given whether one is open at its start. An unescaped backquote
// opens or closes one; outside a template string, a backquote inside a `"…"` or `'…'` literal (an escaped quote read as part of
// it), a regular-expression literal or after `//` opens none. The reader is no JavaScript parser: a literal ends at its line's
// end at the latest, and a `/` with no closing `/` on its line divides.
function templateOpenAfter(line, open) {
  let quote = null;
  for (let i = 0; i < line.length; i += 1) {
    const c = line[i];
    if (c === "\\") { i += 1; continue; }
    if (open) { if (c === "`") open = false; continue; }
    if (quote !== null) { if (c === quote) quote = null; continue; }
    if (c === "`") open = true;
    else if (c === '"' || c === "'") quote = c;
    else if (c === "/" && line[i + 1] === "/") break;
    else if (c === "/" && line[i + 1] !== "*" && REGEX_MAY_FOLLOW.test(line.slice(0, i).trimEnd())) {
      const end = regexEnd(line, i);
      if (end !== -1) i = end;
    }
  }
  return open;
}

// testDeclarations for any file read by its comment lines (every language but Markdown). A comment-shaped line inside a
// template string spanning lines is no comment line, and starts no declaration. A declaration before a loop header
// `for (…) {` stands before the loop's body: its title is read on the line after the header. A declaration's fields end at its
// first comment line not of their form, but its title is read on the first line after the whole block of comment lines it
// stands in — past a `Planted fault:` line or a field's value continued over further comment lines —: every declaration of
// the block waits for that line. It reads, besides, each block whose first comment line opens with a field in place of an
// identifier, as a declaration with `id` `null`; the caller keeps the ones it gives.
function commentDeclarations(path, text) {
  const declarations = [];
  let current = null;
  let untitled = [];
  let inString = false;
  let inBlock = false; // whether the line before is a comment line
  const lines = splitLines(text);
  for (let i = 0; i < lines.length; i += 1) {
    if (inString) {
      // a line inside a string literal that spans lines (a template string): no comment line of the file, whatever it holds
      inString = templateOpenAfter(lines[i], true);
      inBlock = false;
      continue;
    }
    const content = commentContent(lines[i]);
    const opensBlock = !inBlock;
    inBlock = content !== null;
    if (content === null) {
      inString = templateOpenAfter(lines[i], false);
      if (untitled.length && LOOP_HEADER.test(lines[i])) { current = null; continue; } // the test case is the loop's body
      for (const waiting of untitled) waiting.title = titleOn(lines[i]);
      untitled = [];
      current = null;
      continue;
    }
    if (current !== null) {
      const key = KEY_LINE.exec(content);
      if (key !== null) { applyField(current.fields, key[1], key[2]); continue; }
      current = null; // this comment line does not continue the declaration — it may still start a new one below
    }
    const parts = content.split(PACK_SEPARATOR);
    const id = FIRST_LINE.test(parts[0].trim()) ? parts[0].trim() : null;
    if (id === null && !(opensBlock && opensWithField(content))) continue;
    current = { id, title: null, fields: emptyFields(), path, line: i + 1 };
    for (const part of id === null ? parts : parts.slice(1)) {
      const key = KEY_LINE.exec(part.trim());
      if (key !== null) applyField(current.fields, key[1], key[2]);
    }
    declarations.push(current);
    untitled.push(current);
  }
  return declarations.map(toDeclaration);
}

// testDeclarations for a Markdown file, read by its headings `### TST-<nnn> <title>`.
function markdownDeclarations(path, text) {
  const declarations = [];
  let current = null;
  const lines = splitLines(text);
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (current !== null) {
      const key = KEY_LINE.exec(line);
      if (key !== null) { applyField(current.fields, key[1], key[2]); continue; }
      current = null;
    }
    const heading = HEADING.exec(line);
    if (heading === null) continue;
    current = { id: heading[1], title: heading[2].trim() || null, fields: emptyFields(), path, line: i + 1 };
    declarations.push(current);
  }
  return declarations.map(toDeclaration);
}
