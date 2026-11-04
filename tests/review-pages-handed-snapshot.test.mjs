// MOD-review-pages' routes draw from the snapshot the frame hands them (ITM-716): MOD-site-frame's Route `reads` is given "the repository the
// route shows as the frame has read it for the page", and the frame calls it before `render`. The route then reads no default branch of its own
// while it draws; after a decision it writes — Accept, Save, Reject — the page "is drawn again with the commit named" (MOD-review-pages'
// Interfaces, `<k>/<id>`): read through `readSnapshot` at the commit the write returned, not through the default branch.
// Run: node --test tests/review-pages-handed-snapshot.test.mjs
//
// Module: MOD-review-pages
// Guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES
// Level: unit
//
// node has no DOM: tests/review-pages-harness.mjs gives the frame's fixture DOM. The repository is a fixture behind a Host of the test's own, as
// MOD-repository-hosts states it — one repository in memory with its commits, whose default branch is `main`; repositoryInfo, readSnapshot at
// the branch or at a commit, readHistory and commitFiles —; every call recorded. Nothing reaches the network. A click is answered by a handler
// that waits for the host; the test waits for the turns of the event loop in which it answers. The counter-proofs are recorded in the pull request.

import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { emptyStorage } from "./review-pages-harness.mjs";
import { until } from "./review-pages-wait.mjs";

const { openStore, writeSetting } = await import("../src/browser-store/index.mjs");
const pages = await import("../src/review-pages/index.mjs");
// The route as the frame shows it: the one its `module` gives, which carries `reads` (MOD-site-frame's Route).
const route = await pages.view.routes.find((candidate) => candidate.name === "use-case").module();

const text = (...lines) => `${lines.join("\n")}\n`;
const blobOf = (body) => createHash("sha1").update(`blob ${Buffer.byteLength(body)}\0${body}`).digest("hex");
const failure = (name, message, fields = {}) => Object.assign(new Error(message), { name }, fields);

const ON_GITHUB = { server: "github", origin: "https://github.com", path: "alice/thesis-tool", web: "https://github.com/alice/thesis-tool" };
const TOKEN = { value: "github_pat_ALICEthesisTOOL0123456789abcdef", name: "Agent M · thesis-tool", expires: "2027-01-01" };
const SPEC = text("# Thesis tool — Specification", "", "## Lending", "", "**A LOAN HAS A DUE DATE** *(Product Owner)*",
  "Every loan states the date by which the book is returned.", "*Check:* `tests/loan.test.mjs`");
const P41 = "docs/use-cases/UC-041-check-out-a-book.md";
const UC41 = text("---", "id: UC-041", "title: Check out a book", "area: lending", "actors:", "  - Member", "realises:", "  - A LOAN HAS A DUE DATE",
  "---", "# UC-041 Check out a book", "", "**Goal.** The member borrows a book at the desk.");

// A host over a repository in memory: `main` at one commit holding the SPEC and UC-041, which no record names — it is open.
function fakeHost() {
  const calls = [], commits = new Map();
  let made = 0;
  const commitOf = (tree, parent) => {
    const sha = createHash("sha1").update(`commit ${++made}`).digest("hex");
    commits.set(sha, { tree, parent, date: `2026-10-0${made}T10:00:00Z` });
    return sha;
  };
  let head = commitOf(new Map(Object.entries({ "README.md": "# Thesis tool\n", "SPEC.md": SPEC, [P41]: UC41 })), null);
  const snapshotAt = (sha, ref = sha) => {
    const { tree } = commits.get(sha);
    return { repository: ON_GITHUB, ref, commit: sha, paths: [...tree.keys()].sort(), readMany: async () => {},
      read: async (path) => (tree.has(path) ? tree.get(path) : null), blob: (path) => (tree.has(path) ? blobOf(tree.get(path)) : null) };
  };
  return {
    head: () => head,
    calls,
    snapshotAt,
    writes: () => calls.filter((call) => call.fn === "commitFiles"),
    host: {
      async repositoryInfo() {
        calls.push({ fn: "repositoryInfo" });
        return { defaultBranch: "main", visibility: "public", canWrite: true, archived: false, description: "" };
      },
      async readSnapshot(ref) {
        calls.push({ fn: "readSnapshot", ref });
        if (ref === "main") return snapshotAt(head, "main");
        if (commits.has(ref)) return snapshotAt(ref);
        throw failure("NotFound", `${ref} was not found`, { what: ref });
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
      async commitFiles(change) {
        calls.push({ fn: "commitFiles", change: structuredClone(change) });
        if (change.branch !== "main" || change.expectedHead !== head) throw failure("Moved", "the branch moved", { head });
        const tree = new Map(commits.get(head).tree);
        for (const file of change.files) { if (file.delete) tree.delete(file.path); else tree.set(file.path, file.text); }
        head = commitOf(tree, head);
        return { commit: head, url: `${ON_GITHUB.web}/commit/${head}` };
      },
    },
  };
}

// The frame's hand-over: `reads` is given the snapshot the frame read — here `main` resolved to its commit, as the live page holds it —, then `render`.
async function shown(fake, params) {
  emptyStorage();
  const store = openStore("alice/agent-m");
  writeSetting(store, "github-token:alice/thesis-tool", TOKEN);
  const context = { page: "review", instance: { repository: "alice/agent-m", host: fake.host }, store, go() {},
    product: { address: ON_GITHUB.web, kind: "github", host: fake.host, tokenStored: true } };
  const target = document.createElement("div");
  document.body.append(target);
  await route.reads(params, fake.snapshotAt(fake.head()));
  await route.render(target, context, params);
  return target;
}
function find(root, match) {
  const found = [];
  (function walk(node) { for (const kid of node.childNodes) { if (kid.nodeType === 1) { if (match(kid)) found.push(kid); walk(kid); } } })(root);
  return found;
}
const byClass = (root, name, className) => find(root, (node) => node.localName === name && node.className.split(" ").includes(className));
const click = (node) => node.dispatchEvent(new Event("click"));
// The reads of the repository the page sent after the write: what it was drawn again from.
const afterWrite = (fake) => fake.calls.slice(fake.calls.findIndex((call) => call.fn === "commitFiles") + 1).filter((call) => call.fn === "readSnapshot" || call.fn === "repositoryInfo");

// TST-716001 · level: unit · module: MOD-review-pages
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES
// given: UC-041 open on `main`; the route `use-case` handed, through its `reads`, the snapshot of `main`'s commit
// input: render the list, then use-case/id=UC-041, each after its `reads`
// expect: both pages drawn from the handed snapshot — the list names UC-041, the page shows its Accept —; neither asks repositoryInfo nor reads a snapshot
test("MOD-review-pages use-case — the list and one file are drawn from the snapshot the frame hands, with no repositoryInfo and no snapshot of their own", async () => {
  const fake = fakeHost();
  assert.equal(typeof route.reads, "function", "the route takes the frame's snapshot through `reads`");
  const list = await shown(fake, {});
  assert.match(list.textContent, /UC-041/, "the list is drawn");
  const one = await shown(fake, { id: "UC-041" });
  assert.equal(byClass(one, "button", "accept").length, 1, "one file is drawn, with its Accept");
  assert.deepEqual(fake.calls.filter((call) => call.fn === "repositoryInfo" || call.fn === "readSnapshot"), [], "no repositoryInfo, no snapshot read by the route");
});

// TST-716002 · level: unit · module: MOD-review-pages
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES
// given: use-case/id=UC-041 drawn from the handed snapshot, with a token
// input: click Accept
// expect: one commit; the page is drawn again from readSnapshot at the commit the write returned — the only read after the write, no repositoryInfo and no read of `main` —, and shows UC-041 accepted (the known positive that the new commit is the one shown)
test("MOD-review-pages use-case/<id> — after Accept the page is drawn again at the commit the write named", async () => {
  const fake = fakeHost();
  const target = await shown(fake, { id: "UC-041" });
  click(byClass(target, "button", "accept")[0]);
  await until(target, () => fake.writes().length === 1, "the commit");
  await until(target, () => byClass(target, "span", "badge")[0]?.textContent === "accepted", "the page to show UC-041 accepted");
  assert.deepEqual(afterWrite(fake), [{ fn: "readSnapshot", ref: fake.head() }], "drawn again at the commit the write returned");
});

// TST-716003 · level: unit · module: MOD-review-pages
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES
// given: use-case/id=UC-041/edit=1 drawn from the handed snapshot, with a token
// input: change the text and click Save
// expect: one commit of the use case; the page is drawn again from readSnapshot at the commit the write returned — the only read after the write —, showing the saved text
test("MOD-review-pages use-case/<id>/edit — after Save the page is drawn again at the commit the write named", async () => {
  const fake = fakeHost();
  const target = await shown(fake, { id: "UC-041", edit: "1" });
  const area = find(target, (node) => node.localName === "textarea" && !node.className.split(" ").includes("reject-reason"))[0];
  area.value = UC41.replace("at the desk.", "at the desk, with a receipt.");
  area.dispatchEvent(new Event("input"));
  click(find(target, (node) => node.localName === "button" && node.textContent === "Save")[0]);
  await until(target, () => fake.writes().length === 1, "the commit");
  await until(target, () => target.textContent.includes("with a receipt") && find(target, (node) => node.localName === "textarea" && !node.className.split(" ").includes("reject-reason")).length === 0, "the use case shown again");
  assert.deepEqual(afterWrite(fake), [{ fn: "readSnapshot", ref: fake.head() }], "drawn again at the commit the write returned");
});

// TST-716004 · level: unit · module: MOD-review-pages
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES; A PROPOSAL IS REJECTED WITH A REASON
// given: use-case/id=UC-041 drawn from the handed snapshot, with a token
// input: type a reason and click Reject
// expect: one commit; the page is drawn again from readSnapshot at the commit the write returned — the only read after the write —, and names that commit
test("MOD-review-pages use-case/<id> — after Reject the page is drawn again at the commit the write named", async () => {
  const fake = fakeHost();
  const target = await shown(fake, { id: "UC-041" });
  byClass(target, "textarea", "reject-reason")[0].value = "Not needed.";
  click(byClass(target, "button", "reject")[0]);
  await until(target, () => fake.writes().length === 1, "the commit");
  await until(target, () => target.textContent.includes(`Rejected in commit ${fake.head().slice(0, 7)}`), "the page drawn again");
  assert.deepEqual(afterWrite(fake), [{ fn: "readSnapshot", ref: fake.head() }], "drawn again at the commit the write returned");
});
