// MOD-review-pages asks for the graph of a commit's own files with that commit (ITM-1121), as the accepted text of docs/architecture/MOD-review-pages.md states it: "A graph of a commit's own
// files is asked for with that commit, so that the graph `onMainChanged` stored for it is read where there is one (MOD-workflow-entries)", with the rule that a page reads the stored graph and never
// builds one — not where none is stored, which the page then says, and not over an edited text, whose findings across artifacts are the stored graph's; and `A PAGE LOAD READS THE REPOSITORY IN BATCHES`.
// Run: node --test tests/review-pages-stored-graph.test.mjs
//
// Module: MOD-review-pages
// Guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES; AN ARCHITECTURE CHANGE IS NOT ACCEPTED WITHOUT AN IMPACT LIST; UC-023
// Level: unit
//
// The product is a Host of this file's own over one repository in memory with a history (the product of tests/review-pages-stored-impacts.test.mjs, MOD-reader accepted and changed since), keeping to
// MOD-repository-hosts' interface; its snapshots offer `readOn`, and the branch `trace-cache` holds the graph `<head>.json.gz` (tests/stored-graph-fake.mjs) where the case says so, and no stored impact
// list. Every call is recorded. The real MOD-approvals, MOD-trace-graph and MOD-documents run. Nothing reaches the network. Where the module file leaves a reading open, the test states the one it takes,
// and the pull request names it:
//   - A "graph read" is a read of `<head>.json.gz` on the branch `trace-cache`; a graph is "built" when a file only the graph reads (the fixture's code file and test file) is read.
//   - The call sites that ask for a graph of the snapshot read at the head of the default branch ask with the snapshot's commit: Review all (graphOnce), the draft pages, the arrangement, the SPEC entry
//     pages, the editor.
// Each test states its input and its expected result before it runs (given / input / expect). The counter-proofs are recorded in the pull request.

import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { blobOf, byClass, draw, failure, find, GITHUB, text, until, fetched } from "./review-pages-draft-world.mjs";

import { storedGraphReadOn } from "./stored-graph-fake.mjs";

test.afterEach(() => { assert.deepEqual(fetched.splice(0), [], "no request left the fixtures"); });

const SPEC = text("# Fixture - Specification", "", "## 1. Rules", "", "**RULE ONE** *(Product Owner)*", "First rule.", "*Check:* `tests/reader.test.mjs`", "",
  "**RULE TWO** *(Product Owner)*", "Second rule.", "*Check:* `tests/reader.test.mjs`");
const UC1 = text("---", "id: UC-001", "title: Read a book", "area: reading", "actors:", "  - Member", "realises:", "  - RULE ONE", "---", "# UC-001 Read a book", "", "**Goal.** Read.");
const ARC1 = text("---", "id: ARC-001", "title: ARC-001 title", "forced_by:", "  - RULE ONE", "designs:", "  - MOD-reader", "---", "# ARC-001 ARC-001 title", "", "## Context", "", "Books are read.",
  "", "## Decision", "", "Reading is one module.", "", "## Alternatives", "", "None.", "", "## Consequences", "", "Folders.");
const module_ = (realises, sentence) => text("---", "id: MOD-reader", "title: MOD-reader title", "folder: src/reader/", "realises:", ...realises.map((name) => `  - ${name}`), "follows:", "  - ARC-001",
  "uses:", "provides:", "  - lend", "---", "# MOD-reader MOD-reader title", "", "## Responsibility", "", sentence, "", "## Parts", "", "- `index.mjs`", "", "## Data", "", "Nothing.", "",
  "## Interfaces", "", "- `lend(book) -> loan` - lends a book.", "", "## Files", "", "None.", "", "## Uses", "", "Nothing.");
const READER_PATH = "docs/architecture/MOD-reader.md", ARC1_PATH = "docs/architecture/ARC-001-reading.md";
const READER_BEFORE = module_(["RULE ONE", "UC-001"], "It does one thing.");
const READER_AFTER = module_(["RULE ONE", "RULE TWO"], "It does one thing, and does it well.");
const BASE = { "README.md": "# Fixture\n", "SPEC.md": SPEC, "docs/use-cases/UC-001-read-a-book.md": UC1, [ARC1_PATH]: ARC1, [READER_PATH]: READER_BEFORE,
  "tests/reader.test.mjs": text("// TST-801 · level: unit · module: MOD-reader", "// guards: RULE ONE"), "src/reader/read.mjs": "export const read = 1;\n" };
const recordOf = (id, kind, path, body) => [`docs/approvals/${id}-${blobOf(body).slice(0, 12)}.md`, text(`kind: ${kind}`, `file: ${path}`, `blob: ${blobOf(body)}`)];
const STEPS = [BASE, Object.fromEntries([recordOf("UC-001", "use-case", "docs/use-cases/UC-001-read-a-book.md", UC1), recordOf("ARC-001", "architecture-decision", ARC1_PATH, ARC1),
  recordOf("MOD-reader", "module", READER_PATH, READER_BEFORE)]), { [READER_PATH]: READER_AFTER }];

// A Host of this file's own. `storedGraph`: whether the branch trace-cache holds the graph of the head commit. Each Host's commits are its own: MOD-trace-graph's storedGraph
// keeps a commit's graph for the page (the module), so two tests never share a commit.
let products = 0;
function fakeProduct({ storedGraph }) {
  const commits = new Map(), calls = [], product = ++products;
  let made = 0, head = null;
  for (const files of STEPS) {
    const sha = createHash("sha1").update(`product ${product} commit ${++made}`).digest("hex");
    commits.set(sha, { tree: new Map([...(head ? commits.get(head).tree : []), ...Object.entries(files)]), parent: head, date: `2026-10-0${made}T10:00:00Z` });
    head = sha;
  }
  const snapshotAt = (sha, ref) => {
    const { tree } = commits.get(sha);
    const stored = storedGraphReadOn({ commit: sha, paths: [...tree.keys()], read: async (each) => tree.get(each) ?? null });
    return { repository: GITHUB, ref, commit: sha, paths: [...tree.keys()].sort(), read: async (path) => { calls.push({ fn: "read", path }); return tree.has(path) ? tree.get(path) : null; },
      readMany: async (paths) => { calls.push({ fn: "readMany", sha, paths }); },
      readOn: async (branch, path, options) => {
        calls.push({ fn: "readOn", branch, path });
        return storedGraph && sha === head ? stored(branch, path, options) : null;
      },
      blob: (path) => (tree.has(path) ? blobOf(tree.get(path)) : null) };
  };
  return {
    calls, head: () => head,
    host: {
      async repositoryInfo() { calls.push({ fn: "repositoryInfo" }); return { defaultBranch: "main", visibility: "public", canWrite: true, archived: false, description: "" }; },
      async readSnapshot(ref) {
        calls.push({ fn: "readSnapshot", ref });
        if (ref === "main") return snapshotAt(head, "main");
        if (commits.has(ref)) return snapshotAt(ref, ref);
        throw failure("NotFound", `${ref} was not found`);
      },
      async readHistory(path, { ref = "main", limit } = {}) {
        calls.push({ fn: "readHistory", path });
        const found = [];
        for (let sha = ref === "main" ? head : ref; sha; sha = commits.get(sha).parent) {
          const here = commits.get(sha), before = here.parent ? commits.get(here.parent).tree.get(path) : undefined;
          if (here.tree.get(path) !== before) found.push({ commit: sha, parents: here.parent ? [here.parent] : [], date: here.date, message: "", author: { account: null, name: "x" }, changes: [] });
        }
        return limit ? found.slice(0, limit) : found;
      },
      async readFileAt(path, shas) {
        calls.push({ fn: "readFileAt", path, shas });
        return new Map(shas.map((sha) => [sha, commits.get(sha).tree.get(path) ?? null]));
      },
      async commitFiles() { throw failure("Unexpected", "nothing is written"); },
    },
  };
}

const GRAPH_ONLY = ["src/reader/read.mjs", "tests/reader.test.mjs"];
const counted = (fake) => ({
  graphReads: fake.calls.filter((call) => call.fn === "readOn" && call.path === `${fake.head()}.json.gz`).length,
  built: fake.calls.filter((call) => call.fn === "read" && GRAPH_ONLY.includes(call.path)).length,
});
const impactOf = (target) => byClass(target, "section", "change-impact")[0];

// TST-1121001 · level: unit · module: MOD-review-pages
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES; AN ARCHITECTURE CHANGE IS NOT ACCEPTED WITHOUT AN IMPACT LIST; UC-023
// given: MOD-reader accepted and changed since; the branch trace-cache holds the graph of the head commit and no stored impact list
// input: the route module with the id all (Review all of the architecture)
// expect: the impact list is derived and shown for MOD-reader; the stored graph is read once, and no file only the graph reads is read
test("module/all — Review all of the architecture reads the graph stored for the commit and builds none", async () => {
  const fake = fakeProduct({ storedGraph: true });
  const { target } = await draw(fake, "module", { id: "all" });
  assert.ok(impactOf(target), "the impact list is derived");
  assert.match(impactOf(target).textContent, /MOD-reader/);
  const counts = counted(fake);
  assert.equal(counts.graphReads, 1, "the stored graph is read once");
  assert.equal(counts.built, 0, "no graph is built from the files");
});

// TST-1121002 · level: unit · module: MOD-review-pages
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES; UC-023
// given: the same repository without a stored graph
// input: the route module with the id all
// expect: no impact list: in its place "The impact list could not be derived: the trace graph of <the head's first 12 characters> is not stored yet …"; the graph is asked for once from trace-cache and, there being none, is not built (no file only the graph reads is read) — the counter-proof of TST-1121001
test("module/all — without a stored graph the page says so and builds none", async () => {
  const fake = fakeProduct({ storedGraph: false });
  const { target } = await draw(fake, "module", { id: "all" });
  assert.equal(impactOf(target), undefined, "no impact list without the stored graph");
  const problems = find(target, (node) => node.localName === "p" && node.className === "problem").map((node) => node.textContent);
  assert.deepEqual(problems.filter((line) => line.startsWith("The impact list could not be derived: ")).length, 1, problems.join(" | "));
  assert.ok(problems.some((line) => line.includes(`the trace graph of ${fake.head().slice(0, 12)} is not stored yet`)), problems.join(" | "));
  const counts = counted(fake);
  assert.equal(counts.graphReads, 1, "the stored graph is asked for once");
  assert.equal(counts.built, 0, "no graph is built from the files");
});

// TST-1121003 · level: unit · module: MOD-review-pages
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES; EDITS ARE PREPARED ON THE DASHBOARD
// given: the repository with the stored graph; MOD-reader opened in the editor and its text edited
// input: the route module/MOD-reader/edit, then a change of the text
// expect: the findings across artifacts are the stored graph's: it is read once from trace-cache when the editor opens, and the change of the text reads it no more and builds no graph over the edited text — no file only the graph reads is read
test("module/<id>/edit — the findings across artifacts come from the stored graph; an edited text builds no graph", async () => {
  const fake = fakeProduct({ storedGraph: true });
  const { target } = await draw(fake, "module", { id: "MOD-reader", edit: "1" });
  await until(() => counted(fake).graphReads === 1, "the stored graph read for the editor");
  const area = find(target, (node) => node.localName === "textarea")[0];
  assert.ok(area, "known positive: the editor is open");
  area.value = READER_AFTER.replace("does it well.", "does it very well.");
  area.dispatchEvent(new Event("input"));
  await new Promise((resolve) => setTimeout(resolve, 50));
  assert.deepEqual(counted(fake), { graphReads: 1, built: 0 }, "an edited text reads no graph and builds none");
});
