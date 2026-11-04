// MOD-review-pages' list gives a tick to every file not accepted, read or not, as UC-008 3d states it — "Each use case not accepted has an empty tick box on the list, read or not;
// the reviewer ticks the ones to accept. Accept ticked writes one commit with one record per ticked file, each naming the text the page read of it." — and as SEVERAL FILES ARE ACCEPTED IN ONE CLICK
// asks of a batch: "ticked on their list, or shown together on one review page", "each naming the text the page read of that file". A file this tab has shown is
// accepted with the text it showed; a file changed since is left out and named.
// Run: node --test tests/review-pages-tick-only-read.test.mjs
//
// Module: MOD-review-pages
// Guards: UC-008; SEVERAL FILES ARE ACCEPTED IN ONE CLICK; AN APPROVAL NAMES THE EXACT TEXT
// Level: unit
//
// The module runs in a browser, and node has no DOM: tests/review-pages-harness.mjs takes the one of tests/site-frame-dom.mjs, with which the renderer runs as it is. The
// repository is a Host of the tests' own over one repository in memory with a history, keeping to MOD-repository-hosts' interface; the real MOD-approvals, MOD-documents
// and MOD-browser-store run as they are. Nothing reaches the network. Reading the test takes where the texts leave one open, and the pull request names it:
//   - MOD-review-pages' "each with its status and a tick" names the tick of UC-008 3d: a file is read when the tab has drawn its page, `<k>/<id>`, or the page `<k>/all`
//     that shows it; what was shown is kept on the screen only, so a tab that has drawn none of the pages has shown none.
//   - The tick names the blob that was shown, and a file that changed after it was shown keeps its tick, which Accept ticked leaves out and names.
// What this tab has shown is kept for the host of the repository the page shows, so each test draws a product of its own, with a host of its own.
// Each test states its input and its expected result before it runs (given / input / expect). The counter-proofs are recorded in the pull request.

import { emptyStorage } from "./review-pages-harness.mjs";
import { until } from "./review-pages-wait.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";

const { openStore, writeSetting } = await import("../src/browser-store/index.mjs");
const pages = await import("../src/review-pages/index.mjs").catch((error) => ({ error }));
const route = pages.view?.routes.find((candidate) => candidate.name === "use-case");

// ---------------------------------------------------------------- the product

const text = (...lines) => `${lines.join("\n")}\n`;
const blobOf = (body) => createHash("sha1").update(`blob ${Buffer.byteLength(body)}\0${body}`).digest("hex");
const failure = (name, message, fields = {}) => Object.assign(new Error(message), { name }, fields);
const TOKEN = { value: "github_pat_ALICEthesisTOOL0123456789abcdef", name: "Agent M · thesis-tool", expires: "2027-01-01" };
// The product of a test: a repository of its own on GitHub.
const productOf = (number) => ({ server: "github", origin: "https://github.com", path: `alice/thesis-tool-${number}`, web: `https://github.com/alice/thesis-tool-${number}` });

const SPEC = text("# Thesis tool — Specification", "", "## Lending", "", "**A LOAN HAS A DUE DATE** *(Product Owner)*",
  "Every loan states the date by which the book is returned.", "*Check:* `tests/loan.test.mjs`");
const useCase = (id, title, sentence) => text("---", `id: ${id}`, `title: ${title}`, "area: lending", "actors:", "  - Member", "realises:", "  - A LOAN HAS A DUE DATE",
  "---", `# ${id} ${title}`, "", `**Goal.** ${sentence}`);
const P41 = "docs/use-cases/UC-041-check-out-a-book.md", P42 = "docs/use-cases/UC-042-extend-a-loan.md";
const P43 = "docs/use-cases/UC-043-return-a-book.md", P44 = "docs/use-cases/UC-044-reserve-a-book.md";
const UC41 = useCase("UC-041", "Check out a book", "The member borrows a book at the desk.");
const UC42 = useCase("UC-042", "Extend a loan", "The member extends a loan once.");
const UC43_OLD = useCase("UC-043", "Return a book", "The member returns a book at the desk.");
const UC43 = useCase("UC-043", "Return a book", "The member returns a book and the card at the desk.");
const UC44 = useCase("UC-044", "Reserve a book", "The member reserves a book that is out.");
const UC44_EDITED = useCase("UC-044", "Reserve a book", "The member reserves a book that is out, for a week.");
const recordOf = (id, path, body) => [`docs/approvals/${id}-${blobOf(body).slice(0, 12)}.md`, text("kind: use-case", `file: ${path}`, `blob: ${blobOf(body)}`)];
// UC-041 and UC-044 open, UC-042 accepted, UC-043 changed since its earlier text was accepted.
const STEPS = [
  { "README.md": "# Thesis tool\n", "SPEC.md": SPEC, [P41]: UC41, [P42]: UC42, [P43]: UC43_OLD, [P44]: UC44 },
  Object.fromEntries([recordOf("UC-042", P42, UC42), recordOf("UC-043", P43, UC43_OLD)]),
  { [P43]: UC43 },
];

// ---------------------------------------------------------------- the fake host

function fakeHost(repository) {
  const calls = [], commits = new Map();
  let made = 0, head = null;
  const commitOf = (tree, parent) => {
    const sha = createHash("sha1").update(`commit ${++made}`).digest("hex");
    commits.set(sha, { tree, parent, date: `2026-10-0${made}T10:00:00Z` });
    return sha;
  };
  for (const files of STEPS) head = commitOf(new Map([...(head ? commits.get(head).tree : []), ...Object.entries(files)]), head);
  const snapshotAt = (sha) => {
    const { tree } = commits.get(sha);
    return { repository, ref: sha, commit: sha, paths: [...tree.keys()].sort(), readMany: async () => {}, read: async (path) => (tree.has(path) ? tree.get(path) : null),
      blob: (path) => (tree.has(path) ? blobOf(tree.get(path)) : null) };
  };
  return {
    head: () => head,
    writes: () => calls.filter((call) => call.fn === "commitFiles"),
    // Another writer's commit on `main`: each path of `changed` set to its text.
    land(changed) { head = commitOf(new Map([...commits.get(head).tree, ...Object.entries(changed)]), head); },
    host: {
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
      async commitFiles(change) {
        calls.push({ fn: "commitFiles", change: structuredClone(change) });
        if (change.branch !== "main" || change.expectedHead !== head) throw failure("Moved", "the branch moved", { head });
        head = commitOf(new Map([...commits.get(head).tree, ...change.files.map((f) => [f.path, f.text])]), head);
        return { commit: head, url: `${repository.web}/commit/${head}` };
      },
    },
  };
}

// ---------------------------------------------------------------- the page

// The page of the route as the frame draws it for the product of the test; `token: false` stores none.
async function show(fake, repository, params = {}, { token = true } = {}) {
  emptyStorage();
  const store = openStore("alice/agent-m");
  if (token) writeSetting(store, `github-token:${repository.path}`, TOKEN);
  const target = document.createElement("div");
  document.body.append(target);
  await route.render(target, { page: "review", instance: { repository: "alice/agent-m", host: fake.host }, store, go() {},
    product: { address: repository.web, kind: "github", host: fake.host } }, params);
  return target;
}
function find(root, match) {
  const found = [];
  (function walk(node) { for (const kid of node.childNodes) { if (kid.nodeType === 1) { if (match(kid)) found.push(kid); walk(kid); } } })(root);
  return found;
}
const byClass = (root, name, className) => find(root, (node) => node.localName === name && node.className.split(" ").includes(className));
const rowOf = (target, id) => find(target, (node) => node.localName === "tr" && node.getAttribute("data-id") === id)[0];
const badgeOf = (row) => byClass(row, "span", "badge")[0]?.textContent;
const IDS = ["UC-041", "UC-042", "UC-043", "UC-044"];
// The identifiers of the rows that carry a tick, in the table of the list that holds the open and changed files first.
const tickedIn = (target) => IDS.filter((id) => byClass(rowOf(target, id), "input", "tick").length > 0);
const tick = (box, on = true) => { box.checked = on; box.dispatchEvent(new Event("change")); };
const click = (node) => node.dispatchEvent(new Event("click"));

// ---------------------------------------------------------------- the ticks

// TST-1349001 · level: unit · module: MOD-review-pages
// guards: UC-008; SEVERAL FILES ARE ACCEPTED IN ONE CLICK
// given: a product whose `main` holds UC-041 and UC-044 open, UC-042 accepted and UC-043 changed since acceptance; a token; this tab has drawn no page of a use case
// input: the route use-case drawn as the list
// expect: known positive — a row for each of the four use cases with its status, and Accept ticked, which cannot be pressed yet; every use case not accepted has a tick, read or not: UC-041, UC-043 and UC-044, and the accepted UC-042 none
test("TST-1349001 use-case list — every use case not accepted has a tick, whether the tab has shown it or not", async () => {
  assert.ok(route, `the route use-case: ${pages.error?.message}`);
  const product = productOf(1);
  const target = await show(fakeHost(product), product);
  assert.deepEqual(IDS.map((id) => badgeOf(rowOf(target, id))), ["open", "accepted", "changed since acceptance", "open"], "known positive: the four use cases are listed");
  assert.equal(byClass(target, "button", "accept-ticked")[0]?.disabled, true, "known positive: Accept ticked is there, and nothing is ticked");
  assert.deepEqual(tickedIn(target), ["UC-041", "UC-043", "UC-044"], "every use case not accepted has a tick");
});

// TST-1349002 · level: unit · module: MOD-review-pages
// guards: UC-008; SEVERAL FILES ARE ACCEPTED IN ONE CLICK
// given: the product of TST-1349001, a token
// input: the page of UC-041 drawn, then the page of UC-043; the list drawn again
// expect: a tick on UC-041 and UC-043, whose pages were shown, and on UC-044, which was not; none on UC-042, which is accepted
test("TST-1349002 use-case list — a use case shown and one not shown both have a tick", async () => {
  assert.ok(route, `the route use-case: ${pages.error?.message}`);
  const product = productOf(2), fake = fakeHost(product);
  await show(fake, product, { id: "UC-041" });
  await show(fake, product, { id: "UC-043" });
  assert.deepEqual(tickedIn(await show(fake, product)), ["UC-041", "UC-043", "UC-044"]);
});

// TST-1349003 · level: unit · module: MOD-review-pages
// guards: UC-008; SEVERAL FILES ARE ACCEPTED IN ONE CLICK; AN APPROVAL NAMES THE EXACT TEXT
// given: the product of TST-1349001, a token; the pages of UC-041 and UC-044 shown; then another writer's commit changed UC-044 on `main`
// input: the list drawn; UC-041 and UC-044 ticked; a click on Accept ticked
// expect: known positive — UC-044 still has its tick, the page of its earlier text having been shown; one commit holding one record, UC-041's, naming the blob that was shown; none for UC-044, whose tick names the earlier blob, which is left out and named with the reason that it changed since it was shown, and is still open; UC-041 is accepted
test("TST-1349003 use-case list — the tick names the blob that was shown, and a use case changed since is left out and named", async () => {
  assert.ok(route, `the route use-case: ${pages.error?.message}`);
  const product = productOf(3), fake = fakeHost(product);
  for (const id of ["UC-041", "UC-044"]) await show(fake, product, { id });
  fake.land({ [P44]: UC44_EDITED });
  const target = await show(fake, product);
  for (const id of ["UC-041", "UC-044"]) assert.equal(byClass(rowOf(target, id), "input", "tick").length, 1, `known positive: ${id} has a tick`);
  for (const id of ["UC-041", "UC-044"]) tick(byClass(rowOf(target, id), "input", "tick")[0]);
  click(byClass(target, "button", "accept-ticked")[0]);
  await until(target, () => fake.writes().length === 1, "the commit");
  const [name, body] = recordOf("UC-041", P41, UC41);
  assert.deepEqual(fake.writes()[0].change.files, [{ path: name, text: body }], "one record, UC-041's, naming the blob shown");
  await until(target, () => badgeOf(rowOf(target, "UC-041")) === "accepted", "UC-041 accepted");
  assert.match(target.textContent, /UC-044 was left out: changed since shown/, "UC-044 is left out and named with the reason");
  assert.equal(badgeOf(rowOf(target, "UC-044")), "open", "and still open");
});

// TST-1349004 · level: unit · module: MOD-review-pages
// guards: UC-008; SEVERAL FILES ARE ACCEPTED IN ONE CLICK
// given: the product of TST-1349001, a token
// input: the review page `use-case/id=all` drawn; the list drawn
// expect: known positive — the review page shows UC-041, UC-043 and UC-044; a tick on those three, which were shown together on one review page, and none on UC-042, which is accepted
test("TST-1349004 use-case list — the use cases shown together on the review page have a tick", async () => {
  assert.ok(route, `the route use-case: ${pages.error?.message}`);
  const product = productOf(4), fake = fakeHost(product);
  const all = await show(fake, product, { id: "all" });
  assert.deepEqual(byClass(all, "section", "review-file").map((section) => section.getAttribute("data-id")), ["UC-041", "UC-043", "UC-044"], "known positive: the review page shows three");
  assert.deepEqual(tickedIn(await show(fake, product)), ["UC-041", "UC-043", "UC-044"]);
});

// TST-1349005 · level: unit · module: MOD-review-pages
// guards: UC-008; SEVERAL FILES ARE ACCEPTED IN ONE CLICK
// given: two products on GitHub, each a repository of its own with its own host, holding the same use cases, a token for each
// input: the page of UC-041 of the first product drawn; the list of the first product drawn; the list of the second product drawn
// expect: each product's list has a tick on each of its own use cases not accepted, UC-041, UC-043 and UC-044
test("TST-1349005 use-case list — each product's list ticks its own use cases not accepted", async () => {
  assert.ok(route, `the route use-case: ${pages.error?.message}`);
  const first = productOf(5), second = productOf(6), fake = fakeHost(first), other = fakeHost(second);
  await show(fake, first, { id: "UC-041" });
  assert.deepEqual(tickedIn(await show(fake, first)), ["UC-041", "UC-043", "UC-044"], "the first product");
  assert.deepEqual(tickedIn(await show(other, second)), ["UC-041", "UC-043", "UC-044"], "the second product");
});

// TST-1349006 · level: unit · module: MOD-review-pages
// guards: UC-008; WITHOUT A TOKEN, GITHUB'S WEB INTERFACE IS THE FALLBACK
// given: the product of TST-1349001 and no token stored in this browser
// input: the page of UC-041 drawn; the list drawn
// expect: known positive — the list shows UC-041 open; no tick on any row and no Accept ticked, as before: a tick needs the token
test("TST-1349006 use-case list without a token — a use case shown has no tick", async () => {
  assert.ok(route, `the route use-case: ${pages.error?.message}`);
  const product = productOf(7), fake = fakeHost(product);
  await show(fake, product, { id: "UC-041" }, { token: false });
  const target = await show(fake, product, {}, { token: false });
  assert.equal(badgeOf(rowOf(target, "UC-041")), "open", "known positive: the list shows UC-041");
  assert.deepEqual([tickedIn(target), byClass(target, "button", "accept-ticked").length], [[], 0]);
});
