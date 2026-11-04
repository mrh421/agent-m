// The issue route reads the backlog through the artifacts' schemas (ITM-1298) — MOD-issue-handling's `moveToBacklog` reads the backlog's items and the module files through MOD-documents' `artifactSchemas`
// and `readDocument`, as its accepted text names them among its Uses (docs/architecture/MOD-issue-handling.md, Uses): "`MOD-documents.artifactSchemas`, `MOD-documents.readDocument` — the item and module
// schemas, the module files of the architecture that `saveItems` checks the item against, and an existing item that takes this issue as a further origin"; UC-033 4a.
// Run: node --test tests/issue-handling-backlog-schemas-1298.test.mjs
//
// Module: MOD-issue-handling
// Guards: THE BACKLOG LIVES IN THE PRODUCT REPOSITORY; UC-033
// Level: unit
//
// The host is a fake of MOD-repository-hosts' Host with the product's files at one head, as tests/issue-handling-backlog.test.mjs builds it; nothing reaches the network. Readings the texts leave open,
// which the tests state (the pull request names them):
//   - The backlog's folder is the SPEC's own: "A product's backlog is kept as Markdown under `docs/backlog/`" (THE BACKLOG LIVES IN THE PRODUCT REPOSITORY). The module keeps that one folder name, to
//     choose the backlog's items among the item schema's files; which file is an item, its identifier and its list fields come from `artifactSchemas` and `readDocument`. So a plan step, a file of the
//     item schema under `docs/plan/`, is no item of the backlog that a further issue is added to (UC-033 4a: "the issue describes the work of an existing item").
//   - The module's own files hold no path pattern of an item or a module file and no split of a list field: each is MOD-documents' (ITM-1298, Acceptance).

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import * as handling from "../src/issue-handling/index.mjs";

const HEAD = "a1b2c3d4e5f60718293a4b5c6d7e8f9012345678";
const ISSUE = { number: 58, address: "https://github.com/alice/thesis-tool/issues/58" };

const moduleText = (id, folder) => ["---", `id: ${id}`, `title: ${id}`, `folder: ${folder}`, "realises: []", "follows:", "  - ARC-001", "uses: []", "provides: []", "---", `# ${id} ${id}`, "",
  "## Responsibility", "", "It exports.", "", "## Parts", "", "- index.mjs", "", "## Data", "", "Nothing.", "", "## Interfaces", "", "None.", "", "## Files", "", "None.", "", "## Uses", "", "None.", ""].join("\n");
const itemText = (id, title, origin) => ["---", `id: ${id}`, `title: ${title}`, "level: module", "realises:", "  - EXPORT IS A PDF", "modules:", "  - MOD-export", "tests:", "  - unit", "origin:", ...origin.map((each) => `  - ${each}`), "---",
  `# ${id} ${title}`, "", "## Outcome", "", "Done.", "", "## Acceptance", "", "- a unit test.", ""].join("\n");
// The backlog holds ITM-001; the plan holds the step ITM-002, a file of the item schema outside the backlog.
const FILES = () => ({ "docs/architecture/MOD-export.md": moduleText("MOD-export", "src/export/"),
  "docs/backlog/ITM-001-the-first.md": itemText("ITM-001", "The first", ["https://github.com/alice/thesis-tool/issues/12"]),
  "docs/plan/ITM-002-a-step.md": itemText("ITM-002", "A step", ["https://github.com/alice/thesis-tool/issues/13"]) });

function hostWith(files) {
  const calls = [];
  return {
    calls,
    async repositoryInfo() { return { defaultBranch: "main" }; },
    async readSnapshot(ref) { calls.push(["readSnapshot", ref]); return { ref, commit: HEAD, paths: Object.keys(files), blob: (path) => (path in files ? `blob-${path}` : null), read: async (path) => files[path] ?? null }; },
    async readHistory() { return []; },
    async commitFiles(change) { calls.push(["commitFiles", change]); return { commit: "c".repeat(40), url: "https://example.org/c" }; },
    async commentOnIssue(number, body) { calls.push(["commentOnIssue", number, body]); },
    async setIssueLabels(number, change) { calls.push(["setIssueLabels", number, change]); },
    webLinks() { return { file: (path, ref) => `https://github.com/alice/thesis-tool/blob/${ref}/${path}` }; },
  };
}
const failure = (promise) => Promise.resolve(promise).then(() => null, (error) => error);
const committed = (host) => host.calls.filter(([what]) => what === "commitFiles").map(([, change]) => change);
const writtenPaths = (change) => (change.files ?? change.changes ?? []).map((file) => file.path);

// TST-1298001 · level: unit · module: MOD-issue-handling
// guards: THE BACKLOG LIVES IN THE PRODUCT REPOSITORY; UC-033
// given: known positive first — the backlog holds ITM-001 under docs/backlog/; the plan holds the step ITM-002 under docs/plan/, a file of the item schema outside the backlog; the issue 58
// input: moveToBacklog(host, issue 58, null, "ITM-001"), then, on a fresh host, moveToBacklog(host, issue 58, null, "ITM-002")
// expect: known positive: ITM-001 is found and its file docs/backlog/ITM-001-the-first.md committed, the result's item ITM-001; ITM-002 is no item of the backlog: NotFound naming docs/backlog/ITM-002-*.md, nothing committed, no comment and no label
test("moveToBacklog — an existing item is one of the backlog; a plan step of the same schema is not found and nothing is written (UC-033 4a)", async () => {
  const known = hostWith(FILES());
  const done = await handling.moveToBacklog(known, ISSUE, null, "ITM-001");
  assert.equal(done.item, "ITM-001", "known positive: an item of the backlog takes the issue");
  assert.equal(committed(known).length, 1);

  const host = hostWith(FILES());
  const refused = await failure(handling.moveToBacklog(host, ISSUE, null, "ITM-002"));
  assert.equal(refused?.name, "NotFound", `a plan step is no item of the backlog: ${refused?.message ?? "it was written"}`);
  assert.equal(refused.path, "docs/backlog/ITM-002-*.md");
  assert.deepEqual(committed(host), [], "nothing is committed");
  assert.deepEqual(host.calls.filter(([what]) => what === "commentOnIssue" || what === "setIssueLabels"), [], "no comment and no label");
});

// The code lines of the module's own files: every line that is not a comment.
const HERE = new URL("../src/issue-handling/", import.meta.url);
const codeLines = (text) => text.split("\n").filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line));
// A path pattern of an item or a module file, or a folder of them, written into the code, and a split of a list field by commas.
const OWN_RULES = [/ITM-\\d/, /MOD-\[/, /docs\\\/(backlog|plan|architecture)\\\//, /\.split\(\s*["'],\s*["']\s*\)/];
const ownRules = (text) => codeLines(text).filter((line) => OWN_RULES.some((rule) => rule.test(line)));

// TST-1298002 · level: unit · module: MOD-issue-handling
// guards: THE BACKLOG LIVES IN THE PRODUCT REPOSITORY; UC-033
// given: known positive first — the lines `const MODULE_FILE = /^docs\/architecture\/MOD-[^/]+\.md$/;`, `const ITEM_IDENTIFIER = /\/(ITM-\d{3,})-[^/]*\.md$/;` and a split `String(value).split(",")`, each found; a comment naming docs/backlog/ITM-<nnn> is not; the files of src/issue-handling/
// input: every code line of every .mjs file of src/issue-handling/
// expect: the planted lines are found and the comment is not; no line of the module holds a path pattern of an item or a module file, or a split of a list field by commas
test("src/issue-handling holds no path pattern of an item or a module file and no list split of its own", () => {
  const planted = ["const MODULE_FILE = /^docs\\/architecture\\/MOD-[^/]+\\.md$/;", "const ITEM_IDENTIFIER = /\\/(ITM-\\d{3,})-[^/]*\\.md$/;", "const listOf = (value) => String(value).split(\",\");", "// the item docs/backlog/ITM-<nnn>-<slug>.md, as /^docs\\/backlog\\/ITM-\\d/"].join("\n");
  assert.deepEqual(ownRules(planted).length, 3, "known positive: the three planted lines are found, the comment is not");
  const found = readdirSync(HERE).filter((name) => name.endsWith(".mjs")).flatMap((name) => ownRules(readFileSync(new URL(name, HERE), "utf8")).map((line) => `${name}: ${line.trim()}`));
  assert.deepEqual(found, []);
});
