// MOD-review-pages shows a decision put back after its accepted removal (ITM-1314) as changed, with its text against the empty text, as the
// accepted texts state it: `<k>/<id>` shows a file "changed since acceptance, its difference to the text the most recent approval record of its
// identifier names (A CHANGED FILE IS SHOWN AGAINST ITS LAST ACCEPTED TEXT)"; the record of an accepted removal names the empty text's blob
// (MOD-approvals, Data, blob), so the text it names is the empty text. Run: node --test tests/review-pages-put-back-after-removal.test.mjs
//
// Module: MOD-review-pages
// Guards: A CHANGED FILE IS SHOWN AGAINST ITS LAST ACCEPTED TEXT; UC-023
// Level: unit
//
// This imports the browser harness of tests/review-pages-harness.mjs unchanged. The repository is a Host of the test's own over one repository in
// memory with a history, keeping to MOD-repository-hosts' interface, as tests/review-pages-changed-file-rendered.test.mjs keeps one; a step of the
// history may remove a file. The real MOD-approvals, MOD-documents and MOD-browser-store run as they are. Nothing reaches the network. Each test
// states its input and its expected result before it runs; the counter-proofs are recorded in the pull request.

import "./review-pages-harness.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";

const { openStore, writeSetting } = await import("../src/browser-store/index.mjs");
const pages = await import("../src/review-pages/index.mjs").catch((error) => ({ error }));

const text = (...lines) => `${lines.join("\n")}\n`;
const blobOf = (body) => createHash("sha1").update(`blob ${Buffer.byteLength(body)}\0${body}`).digest("hex");
const failure = (name, message, fields = {}) => Object.assign(new Error(message), { name }, fields);
const EMPTY = "e69de29bb2d1d6434b8b29ae775ad8c2e48c5391";
const ON_GITHUB = { server: "github", origin: "https://github.com", path: "alice/thesis-tool", web: "https://github.com/alice/thesis-tool" };
const TOKEN = { value: "github_pat_ALICEthesisTOOL0123456789abcdef", name: "Agent M · thesis-tool", expires: "2027-01-01" };
const recordOf = (id, path, blob) => [`docs/approvals/${id}-${blob.slice(0, 12)}.md`, text("kind: architecture-decision", `file: ${path}`, `blob: ${blob}`)];

const RULE = "A LOAN HAS A DUE DATE";
const SPEC = text("# Thesis tool — Specification", "", "## Lending", "", `**${RULE}** *(Product Owner)*`,
  "Every loan states the date by which the book is returned.", "*Check:* `tests/loan.test.mjs`");
const decision = (id, title, sentence) => text("---", `id: ${id}`, `title: ${title}`, "forced_by:", `  - ${RULE}`, "---", `# ${id} ${title}`, "",
  "## Context", "", "Books are lent at a desk.", "", "## Decision", "", sentence, "", "## Alternatives", "", "None.", "", "## Consequences", "", "None.");
const ARC1_PATH = "docs/architecture/ARC-001-lending.md", ARC3_PATH = "docs/architecture/ARC-003-shelf.md";
const ARC1 = decision("ARC-001", "Lending as a whole", "Lending is a desk and a shelf.");
const ARC3_OLD = decision("ARC-003", "The shelf", "Books stand on a shelf.");
const ARC3 = decision("ARC-003", "The shelf", "Books stand on a shelf by their number.");
// ARC-001 and ARC-003 accepted; ARC-003 removed and its removal accepted; ARC-003 put back with another text.
const STEPS = [
  { write: { "README.md": "# Thesis tool\n", "SPEC.md": SPEC, [ARC1_PATH]: ARC1, [ARC3_PATH]: ARC3_OLD } },
  { write: Object.fromEntries([recordOf("ARC-001", ARC1_PATH, blobOf(ARC1)), recordOf("ARC-003", ARC3_PATH, blobOf(ARC3_OLD))]) },
  { remove: [ARC3_PATH] },
  { write: Object.fromEntries([recordOf("ARC-003", ARC3_PATH, EMPTY)]) },
  { write: { [ARC3_PATH]: ARC3 } },
];

function fakeHost(steps) {
  const commits = new Map();
  let made = 0, head = null;
  for (const { write = {}, remove = [] } of steps) {
    const tree = new Map([...(head ? commits.get(head).tree : []), ...Object.entries(write)]);
    for (const path of remove) tree.delete(path);
    const sha = createHash("sha1").update(`commit ${++made}`).digest("hex");
    commits.set(sha, { tree, parent: head, date: `2026-10-0${made}T10:00:00Z` });
    head = sha;
  }
  const snapshotAt = (sha) => {
    const { tree } = commits.get(sha);
    return { repository: ON_GITHUB, ref: sha, commit: sha, paths: [...tree.keys()].sort(), read: async (path) => (tree.has(path) ? tree.get(path) : null),
      blob: (path) => (tree.has(path) ? blobOf(tree.get(path)) : null) };
  };
  return {
    async repositoryInfo() { return { defaultBranch: "main", visibility: "public", canWrite: true, archived: false, description: "" }; },
    async readSnapshot(ref) {
      if (ref === "main") return { ...snapshotAt(head), ref };
      if (commits.has(ref)) return snapshotAt(ref);
      throw failure("NotFound", `${ref} was not found`, { what: ref });
    },
    async readHistory(path, { ref = "main", limit } = {}) {
      const found = [];
      for (let sha = ref === "main" ? head : ref; sha; sha = commits.get(sha).parent) {
        const here = commits.get(sha), before = here.parent ? commits.get(here.parent).tree.get(path) : undefined;
        if (here.tree.get(path) !== before) found.push({ commit: sha, parents: here.parent ? [here.parent] : [], date: here.date, message: "", author: { account: null, name: "x" }, changes: [] });
      }
      return limit ? found.slice(0, limit) : found;
    },
  };
}

function elements(root) {
  const found = [];
  (function walk(node) { for (const kid of node.childNodes) { if (kid.nodeType === 1) { found.push(kid); walk(kid); } } })(root);
  return found;
}
const byClass = (root, name, className) => elements(root).filter((node) => node.localName === name && node.className.split(" ").includes(className));

// TST-1314003 · level: unit · module: MOD-review-pages
// guards: A CHANGED FILE IS SHOWN AGAINST ITS LAST ACCEPTED TEXT; UC-023
// given: ARC-003 accepted, removed, its removal accepted by a record naming the empty text's blob, and put back with another text; a token stored for the product
// input: the route decision drawn for ARC-003
// expect: ARC-003 shown as changed since acceptance; its difference section holds no problem and a difference whose every line is one of the put-back text's lines, marked added, the line "Books stand on a shelf by their number." among them, and none marked removed or the same
test("TST-1314003 decision/<id> — a decision put back after its accepted removal is shown as changed, its text against the empty text", async () => {
  const route = pages.view?.routes.find((candidate) => candidate.name === "decision");
  assert.ok(route, `the route decision: ${pages.error?.message}`);
  const host = fakeHost(STEPS);
  const store = openStore("alice/agent-m");
  writeSetting(store, "github-token:alice/thesis-tool", TOKEN);
  const target = document.createElement("div");
  document.body.append(target);
  await route.render(target, { page: "review", instance: { repository: "alice/agent-m", host }, store, go() {},
    product: { address: ON_GITHUB.web, kind: "github", host } }, { id: "ARC-003" });

  assert.ok(target.textContent.includes("changed since acceptance"), "shown as changed since acceptance");
  const [diff] = byClass(target, "section", "accepted-diff");
  assert.ok(diff, "a difference section");
  assert.deepEqual(byClass(diff, "p", "problem").map((p) => p.textContent), [], "no problem in the difference");
  const rows = byClass(diff, "pre", "diff").flatMap((pre) => elements(pre).filter((node) => node.localName === "span"));
  assert.deepEqual(rows.map((row) => row.className), ARC3.split("\n").slice(0, -1).map(() => "dadd"), "every line of the put-back text, added");
  assert.ok(rows.some((row) => row.textContent === "+ Books stand on a shelf by their number."), "the new sentence added");
});
