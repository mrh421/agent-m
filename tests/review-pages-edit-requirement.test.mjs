// MOD-review-pages' routes for editing a requirement (ITM-359), as the accepted text of docs/architecture/MOD-review-pages.md states them: "`requirement/<name>/edit`
// and `requirements/new` for a requirement — the editor with live preview and the descriptor's marks; for a requirement, its SPEC section, a *Why* field and its
// impact list, saved as an entry of its section's queue (`A SPEC EDIT IS SAVED AS A PROPOSAL`); `requirements/new` with the four fields empty, for the
// SPEC section the specification browser hands it (UC-018 3d) … every save only on the blob the file or section was opened on", and the item's Outcome: the editor opens
// on the requirement's SPEC section, its blob noted; the marks of requirementFindings without blocking, a Why field, the impact list; for a changed name the page says
// that the name is the identifier, and the impact list shows what names the old one; Save goes through proposeSection, links the commit and opens the new entry in
// spec-entry; another open proposal on the same section is named; a refused save keeps the edit beside the newer text; without a token, GitHub's pages open per file;
// on GitLab without a token there is no Save. For UC-018 steps 1 to 7 for a requirement and the alternative flows 3a, 3c, 4a, 4b, 5a, 6a, 6b, 7a.
// Run: node --test tests/review-pages-edit-requirement.test.mjs
//
// Module: MOD-review-pages
// Guards: UC-018; A SPEC EDIT IS SAVED AS A PROPOSAL; A REQUIREMENT IS NOT CHANGED WITHOUT AN IMPACT LIST; A RENAMED REQUIREMENT IS WITHDRAWN AND ADDED; A REQUIREMENT HAS FOUR FIELDS; THE NAME IS THE ID AND IT SURVIVES; A SAVE IS REFUSED WHEN THE TEXT CHANGED MEANWHILE; A REFUSED SAVE KEEPS THE EDIT; NO PROPOSAL WITHOUT THE CURRENT TEXT BESIDE IT; WITHOUT A TOKEN, GITHUB'S WEB INTERFACE IS THE FALLBACK; A GITLAB PRODUCT IS WRITTEN WITH A TOKEN; ONE CLICK PER DECISION; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK
// Level: unit
//
// This imports the browser harness of tests/review-pages-harness.mjs unchanged. The product is a fixture behind a Host of the tests' own, which keeps to
// MOD-repository-hosts' interface (repositoryInfo with canWrite, readSnapshot, readHistory, commitFiles made only on the head that was read, else `Moved`). The real
// MOD-markdown-render (its editor), MOD-spec-changes, MOD-spec-document, MOD-trace-graph, MOD-artifact-edits and MOD-text-tools run as they are. Nothing reaches the
// network. Where the module file leaves a reading open, the test states the one it takes, and the pull request names it:
//   - The frame reads the parts of an address as `key=value`, so the routes are `requirement` with the part `name=<NAME>` — #requirement/name=A%20LOAN%20HAS%20A%20DUE%20DATE —
//     and `requirements` with the part `section=<the section's heading line>` — #requirements/section=## 1. Lending —, the section the specification browser hands it.
//   - The editor holds the whole section of the requirement (the editor's one text area), as proposeSection takes the whole section's new text; for a new requirement the
//     section followed by a blank line and the four fields empty: `****`, an empty line for the rule and `*Check:*`. The Why field is <textarea class="why">.
//   - The page holds <ul class="impact"> with an <li> for each requirement the edit changes, withdraws or adds ("<name> — changed|withdrawn|added" and, where an
//     artifact names it, ", named by <ids>"), recomputed at each input; <p class="rename"> says the name is the identifier when a name changed; <ul class="others"> names
//     the other open proposals on the same section, each a link to its entry; after a save <p class="entry"> links the commit and the entry in spec-entry, and <ul class="also">
//     names the entries the save replaces in other queues; without a token <a class="github-page"> for each file; on GitLab without a token the editor is not opened.
//   - A save with an empty Why field is not sent: the editor says so.
//   - Without a token the person of the edit is "anonymous".
// Each test states its input and its expected result before it runs (given / input / expect). The counter-proofs are recorded in the pull request.

import "./review-pages-harness.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { withStoredGraph } from "./stored-graph-fake.mjs";
import { until as settled } from "./review-pages-wait.mjs";

// Every commit the fakes of this file make is its own: MOD-trace-graph's storedGraph keeps a commit's graph for the page.
let commitsMade = 0;

const { openStore, writeSetting } = await import("../src/browser-store/index.mjs");
const pages = await import("../src/review-pages/index.mjs").catch((error) => ({ error }));
const editRoute = pages.view?.routes.find((candidate) => candidate.name === "requirement");
const newRoute = pages.view?.routes.find((candidate) => candidate.name === "requirements");

// ---------------------------------------------------------------- the product

const text = (...lines) => `${lines.join("\n")}\n`;
const blobOf = (body) => createHash("sha1").update(`blob ${Buffer.byteLength(body)}\0${body}`).digest("hex");
const failure = (name, message, fields = {}) => Object.assign(new Error(message), { name }, fields);
const GITHUB = { server: "github", origin: "https://github.com", path: "alice/thesis-tool", web: "https://github.com/alice/thesis-tool" };
const GITLAB = { server: "gitlab", origin: "https://gitlab.example.org", path: "alice/thesis-tool", web: "https://gitlab.example.org/alice/thesis-tool" };
const TOKEN = { value: "github_pat_ALICEthesisTOOL0123456789abcdef", name: "Agent M · thesis-tool", expires: "2027-01-01" };
const LOAN = "A LOAN HAS A DUE DATE", SHELF = "A BOOK IS SHELVED", CARD = "A MEMBER HAS A CARD";
const LENDING = text("## 1. Lending", "", `**${LOAN}** *(Product Owner)*`, "Every loan states the date by which the book is returned.", "*Check:* `tests/loan.test.mjs`", "",
  `**${SHELF}** *(Product Owner)*`, "Every book stands on a shelf.", "");
const READING = text("## 2. Reading", "", `**${CARD}** *(Product Owner)*`, "Every member holds a card.", "*Check:* `tests/card.test.mjs`");
const HEAD = text("# Thesis tool — Specification", "");
const SPEC = HEAD + LENDING + READING;
const HEADING = "## 1. Lending";
const useCase = text("---", "id: UC-001", "title: Check out a book", "area: lending", "actors:", "  - Member", "realises:", `  - ${LOAN}`, "---", "# UC-001 Check out a book", "", "**Goal.** Borrow a book.");
const FILES = { "README.md": "# Thesis tool\n", "SPEC.md": SPEC, "docs/use-cases/UC-001-check-out-a-book.md": useCase };

// ---------------------------------------------------------------- the fake host

function fakeHost(files = FILES, { repository = GITHUB, canWrite = true } = {}) {
  const calls = [], commits = new Map();
  let made = 0, head = null;
  const commitOf = (tree, parent) => {
    const sha = createHash("sha1").update(`commit ${++made} of the file's ${++commitsMade}`).digest("hex");
    commits.set(sha, { tree, parent });
    return sha;
  };
  head = commitOf(new Map(Object.entries(files)), null);
  const bareSnapshotAt = (sha, ref) => {
    const { tree } = commits.get(sha);
    return { repository, ref, commit: sha, paths: [...tree.keys()].sort(), read: async (path) => (tree.has(path) ? tree.get(path) : null),
      blob: (path) => (tree.has(path) ? blobOf(tree.get(path)) : null) };
  };
  // Each snapshot serves the graph the push job stores for its commit (tests/stored-graph-fake.mjs); a page reads it and never builds one (MOD-trace-graph).
  const snapshotAt = (...args) => withStoredGraph(bareSnapshotAt(...args));
  return {
    files: () => Object.fromEntries(commits.get(head).tree), head: () => head,
    writes: () => calls.filter((call) => call.fn === "commitFiles").map((call) => call.change),
    land(changed) { head = commitOf(new Map([...commits.get(head).tree, ...Object.entries(changed)]), head); },
    host: {
      async repositoryInfo() { return { defaultBranch: "main", visibility: "public", canWrite, archived: false, description: "" }; },
      async readSnapshot(ref) {
        if (ref === "main") return snapshotAt(head, "main");
        if (commits.has(ref)) return snapshotAt(ref, ref);
        throw failure("NotFound", `${ref} was not found`);
      },
      async readHistory() { return []; },
      async commitFiles(change) {
        calls.push({ fn: "commitFiles", change: structuredClone(change) });
        if (change.branch !== "main" || change.expectedHead !== head) throw failure("Moved", "the branch moved", { head });
        head = commitOf(new Map([...commits.get(head).tree, ...change.files.map((file) => [file.path, file.text])]), head);
        return { commit: head, url: `${repository.web}/commit/${head}` };
      },
    },
  };
}

// ---------------------------------------------------------------- the page

async function showEdit(fake, params, { token = true, repository = GITHUB } = {}) {
  const route = "name" in params ? editRoute : newRoute;
  assert.ok(route, `the route: ${pages.error?.message}`);
  const store = openStore(token ? "alice/agent-m" : "nobody/agent-m");
  if (token) writeSetting(store, repository.server === "gitlab" ? "gitlab-token:gitlab.example.org/alice/thesis-tool" : "github-token:alice/thesis-tool", TOKEN);
  const target = document.createElement("div");
  document.body.append(target);
  await route.render(target, { page: "review", instance: { repository: "alice/agent-m", host: fake.host }, store, go() {},
    product: { address: repository.web, kind: repository.server, host: fake.host } }, params);
  return target;
}
function find(root, match) {
  const found = [];
  (function walk(node) { for (const kid of node.childNodes) { if (kid.nodeType === 1) { if (match(kid)) found.push(kid); walk(kid); } } })(root);
  return found;
}
const byClass = (root, name, className) => find(root, (node) => node.localName === name && node.className.split(" ").includes(className));
const click = (node) => node.dispatchEvent(new Event("click"));
async function until(condition, what) {
  const limit = Date.now() + 2000;
  while (Date.now() < limit) {
    if (condition()) return;
    await new Promise((resolve) => setImmediate(resolve));
  }
  assert.fail(`waited for ${what}`);
}
// The editor's text area is the first one on the page; the Why field is the one of its class.
const areaOf = (target) => find(target, (node) => node.localName === "textarea" && !node.className.split(" ").includes("why"))[0];
const whyOf = (target) => byClass(target, "textarea", "why")[0];
const saveOf = (target) => find(target, (node) => node.localName === "button" && node.textContent === "Save")[0];
function type(target, value) {
  const area = areaOf(target);
  area.value = value;
  area.dispatchEvent(new Event("input"));
}
const withWhy = (target, why = "Because it is clearer.") => { whyOf(target).value = why; };
const NAME = (name) => ({ name });
const proposals = (fake) => fake.writes().flatMap((change) => change.files).filter((file) => /\/\d\d-[^/]*\.md$/.test(file.path) && !file.path.endsWith(".begruendung.md"));

// ---------------------------------------------------------------- opened, edited, saved

// TST-472626 · level: unit · module: MOD-review-pages
// guards: UC-018; NO PROPOSAL WITHOUT THE CURRENT TEXT BESIDE IT; A REQUIREMENT HAS FOUR FIELDS; ONE STATEMENT PER REQUIREMENT; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK
// given: the requirement A LOAN HAS A DUE DATE in the section "1. Lending", whose other requirement A BOOK IS SHELVED lacks its check
// input: the page #requirement/name=A LOAN HAS A DUE DATE
// expect: the editor holding the section byte for byte; the mark of the missing check on the line of the other requirement, without blocking Save; a Why field; an empty impact list; nothing written
test("requirement/<name> — the editor opens on the requirement's section with the marks of requirementFindings, a Why field and an impact list", async () => {
  const fake = fakeHost();
  const target = await showEdit(fake, NAME(LOAN));
  assert.equal(areaOf(target).value, LENDING);
  assert.match(byClass(target, "ol", "marks")[0].textContent, /A REQUIREMENT HAS FOUR FIELDS/);
  assert.ok(whyOf(target), "a Why field");
  assert.ok(saveOf(target), "Save is there");
  assert.equal(byClass(target, "ul", "impact")[0].childNodes.length, 0, "nothing changed yet");
  assert.equal(fake.writes().length, 0, "nothing written");
});

// TST-472627 · level: unit · module: MOD-review-pages
// guards: UC-018; A REQUIREMENT IS NOT CHANGED WITHOUT AN IMPACT LIST
// given: the editor on the section; UC-001 names A LOAN HAS A DUE DATE
// input: the rule of A LOAN HAS A DUE DATE edited
// expect: the impact list names it as changed, named by UC-001; the other requirement not at all
test("requirement/<name> — the impact list shows the requirement the edit changes, and what names it", async () => {
  const fake = fakeHost();
  const target = await showEdit(fake, NAME(LOAN));
  type(target, LENDING.replace("returned.", "returned, or renewed."));
  const impact = byClass(target, "ul", "impact")[0].textContent;
  assert.match(impact, new RegExp(`${LOAN} — changed, named by UC-001`));
  assert.ok(!impact.includes(SHELF), "the other requirement is not listed");
});

// TST-472628 · level: unit · module: MOD-review-pages
// guards: UC-018; A SPEC EDIT IS SAVED AS A PROPOSAL; ONE CLICK PER DECISION
// given: the editor with the rule edited and a Why
// input: a click on Save
// expect: one commit holding the index of the section's queue docs/spec-freigaben/lending, the proposal — the section as edited, byte for byte — and its rationale; SPEC.md untouched; the page links the commit and the new entry, #spec-entry/id=spec-<queue>-01
test("requirement/<name> — Save writes the edited section as an entry and links the commit and the entry", async () => {
  const fake = fakeHost();
  const target = await showEdit(fake, NAME(LOAN));
  const edited = LENDING.replace("returned.", "returned, or renewed.");
  type(target, edited);
  withWhy(target);
  click(saveOf(target));
  await until(() => byClass(target, "p", "entry").length === 1, "the entry");
  assert.equal(fake.writes().length, 1, "one commit");
  const [change] = fake.writes();
  assert.ok(!change.files.some((file) => file.path === "SPEC.md"), "SPEC.md is not touched");
  assert.equal(proposals(fake).length, 1);
  assert.equal(proposals(fake)[0].text, edited);
  assert.match(change.files.find((file) => file.path.endsWith(".begruendung.md")).text, /Because it is clearer\./);
  const entry = byClass(target, "p", "entry")[0];
  const hrefs = find(entry, (node) => node.localName === "a").map((node) => node.getAttribute("href"));
  assert.ok(hrefs.includes(`https://github.com/alice/thesis-tool/commit/${fake.head()}`), `the commit: ${hrefs}`);
  assert.equal(change.files.find((file) => file.path.endsWith("/index.md")).path, "docs/spec-freigaben/lending/index.md", "the queue is the section's");
  assert.ok(hrefs.some((href) => /^#spec-entry\/id=spec-[^/]+-01\/product=/.test(href)), `the entry: ${hrefs}`);
});

// TST-472629 · level: unit · module: MOD-review-pages
// guards: UC-018
// given: the editor with a rule edited and no Why
// input: a click on Save
// expect: nothing written; the editor says a Why is needed
test("requirement/<name> — a save without a Why is not sent", async () => {
  const fake = fakeHost();
  const target = await showEdit(fake, NAME(LOAN));
  type(target, LENDING.replace("returned.", "returned, or renewed."));
  click(saveOf(target));
  await until(() => /Why/.test(byClass(target, "p", "result")[0]?.textContent ?? ""), "the answer");
  assert.equal(fake.writes().length, 0);
});

// ---------------------------------------------------------------- a new requirement

// TST-472630 · level: unit · module: MOD-review-pages
// guards: UC-018; A REQUIREMENT HAS FOUR FIELDS; A SPEC EDIT IS SAVED AS A PROPOSAL
// given: the section "1. Lending", handed in by the specification browser
// input: the page #requirements/section=## 1. Lending; then the four fields written and a Why; then Save
// expect: the editor opens on the section followed by the four empty fields, whose marks name the missing fields; after writing them the impact list names the new requirement as added; Save writes one entry whose proposal is the section with the new requirement
test("requirements/new — the four empty fields in the section handed in, saved as an entry", async () => {
  const fake = fakeHost();
  const target = await showEdit(fake, { section: HEADING });
  assert.equal(areaOf(target).value, `${LENDING}****\n\n*Check:*\n`);
  assert.ok(byClass(target, "ol", "marks")[0].textContent.length > 0, "marks on the empty fields");
  const block = text(`**${CARD}** *(Product Owner)*`, "Every member holds a card.", "*Check:* `tests/card.test.mjs`");
  const written = `${LENDING}\n${block}`.replace(CARD, "A MEMBER IS REGISTERED").replace("holds a card", "is registered");
  type(target, written);
  assert.match(byClass(target, "ul", "impact")[0].textContent, /A MEMBER IS REGISTERED — added/);
  assert.equal(byClass(target, "p", "rename").length, 0, "an added requirement is no rename");
  withWhy(target, "A new rule.");
  click(saveOf(target));
  await until(() => byClass(target, "p", "entry").length === 1, "the entry");
  assert.equal(proposals(fake)[0].text, written);
});

// ---------------------------------------------------------------- a rename

// TST-472631 · level: unit · module: MOD-review-pages
// guards: UC-018; A RENAMED REQUIREMENT IS WITHDRAWN AND ADDED; THE NAME IS THE ID AND IT SURVIVES
// given: the editor on A LOAN HAS A DUE DATE, which UC-001 names
// input: the name changed to A LOAN IS DUE
// expect: the page says the name is the identifier and that the change is the old name withdrawn and the new one added; the impact list shows the old name withdrawn, named by UC-001, and the new one added; after Save the rationale names both
test("requirement/<name> — a changed name is shown as the old one withdrawn and the new one added, with what names the old one", async () => {
  const fake = fakeHost();
  const target = await showEdit(fake, NAME(LOAN));
  const renamed = LENDING.replace(LOAN, "A LOAN IS DUE");
  assert.equal(byClass(target, "p", "rename").length, 0, "known positive: no notice before the rename");
  type(target, renamed);
  assert.match(byClass(target, "p", "rename")[0].textContent, /name is the identifier/i);
  const impact = byClass(target, "ul", "impact")[0].textContent;
  assert.match(impact, new RegExp(`${LOAN} — withdrawn, named by UC-001`));
  assert.match(impact, /A LOAN IS DUE — added/);
  withWhy(target);
  click(saveOf(target));
  await until(() => byClass(target, "p", "entry").length === 1, "the entry");
  const rationale = fake.writes()[0].files.find((file) => file.path.endsWith(".begruendung.md")).text;
  assert.ok(rationale.includes(LOAN) && rationale.includes("A LOAN IS DUE"), rationale);
});

// ---------------------------------------------------------------- another proposal

// TST-472632 · level: unit · module: MOD-review-pages
// guards: UC-018; NO PROPOSAL WITHOUT THE CURRENT TEXT BESIDE IT; A SPEC EDIT IS SAVED AS A PROPOSAL
// given: an open entry of another queue that proposes the same section "1. Lending"
// input: the page of the requirement; then Save
// expect: the page names that entry among the other open proposals on the section, with a link to it; after Save the open entry that replaces the same section is named
test("requirement/<name> — another open proposal on the same section is named", async () => {
  const OTHER = "docs/spec-freigaben/2026-03-01_sample";
  const proposed = LENDING.replace("returned.", "returned in a week.");
  const fake = fakeHost({ ...FILES,
    [`${OTHER}/index.md`]: text("# SPEC approvals — queue 2026-03-01 · sample", "", "| Nr | Datei | Anker (Überschrift, wortgetreu) | bis (exklusiv) | Commits |", "|---|---|---|---|---|",
      `| 01 | \`SPEC.md\` | ${HEADING} | — | — |`, "| 02 | `SPEC.md` | ## 2. Reading | — | — |", `| 03 | \`SPEC.md\` | ${HEADING} | — | — |`),
    [`${OTHER}/02-entry.md`]: READING.replace("a card.", "a card, always."), [`${OTHER}/03-entry.md`]: LENDING.replace("returned.", "returned soon."),
    [`${OTHER}/entscheidungen.md`]: text("# Decisions", "", "| Date | Entry | Decision | Reference |", "|---|---|---|---|",
      "| 2026-03-01 10:00 UTC | 3 | uebernommen | approval:spec-2026-03-01_sample-03-aaaaaaaaaaaa.md |"),
    [`${OTHER}/01-entry.md`]: proposed, [`${OTHER}/01-entry.begruendung.md`]: text("# A change", "", "**The change.** A sample.") });
  const target = await showEdit(fake, NAME(LOAN));
  const others = byClass(target, "ul", "others")[0];
  assert.match(others.textContent, /spec-2026-03-01_sample-01/);
  assert.equal(find(others, (node) => node.localName === "a")[0].getAttribute("href"), `#spec-entry/id=spec-2026-03-01_sample-01/product=${encodeURIComponent(GITHUB.web)}`);
  assert.doesNotMatch(others.textContent, /sample-02/, "another section is not the same");
  assert.doesNotMatch(others.textContent, /sample-03/, "an entry in the SPEC is no proposal");
  type(target, LENDING.replace("returned.", "returned, or renewed."));
  withWhy(target);
  click(saveOf(target));
  await until(() => byClass(target, "p", "entry").length === 1, "the entry");
  assert.match(byClass(target, "ul", "also")[0].textContent, /spec-2026-03-01_sample-01/);
});

// ---------------------------------------------------------------- a refused save

// TST-472633 · level: unit · module: MOD-review-pages
// guards: UC-018; A SAVE IS REFUSED WHEN THE TEXT CHANGED MEANWHILE; A REFUSED SAVE KEEPS THE EDIT
// given: the editor with an edit and a Why; then another writer changes the section on the default branch
// input: a click on Save
// expect: nothing written; the edit stays in the text area; the newer version of the section is beside it
test("requirement/<name> — a save the text changed under is refused, and the edit stays beside the newer text", async () => {
  const fake = fakeHost();
  const target = await showEdit(fake, NAME(LOAN));
  const edited = LENDING.replace("returned.", "returned, or renewed.");
  type(target, edited);
  withWhy(target);
  const newer = LENDING.replace("returned.", "returned on time.");
  fake.land({ "SPEC.md": HEAD + newer + READING });
  click(saveOf(target));
  await until(() => byClass(target, "div", "newer")[0].textContent.includes("returned on time."), "the newer text");
  assert.equal(fake.writes().length, 0, "nothing written");
  assert.equal(areaOf(target).value, edited, "the edit stays");
  assert.match(byClass(target, "div", "newer")[0].textContent, /returned, or renewed\./);
});

// TST-1398001 · level: unit · module: MOD-review-pages
// guards: UC-018; A SAVE IS REFUSED WHEN THE TEXT CHANGED MEANWHILE; A REFUSED SAVE KEEPS THE EDIT
// given: the editor with an edit ("returned, or renewed.") and a Why; another writer changes the rule on the default branch to "returned on time."; Save is refused and the newer section shown
// input: the author merges ("returned on time, or renewed."); a third writer changes the rule to "returned on time, at the desk."; Save; the author merges again ("returned on time, at the desk, or renewed."); Save
// expect: counter-proof: the save after the further change is refused again, nothing written, the newest section beside the edit; then the merged section is written once, as the proposal of one entry
test("requirement/<name> — after a refused save, the merged section is saved against the newer version", async () => {
  const fake = fakeHost();
  const target = await showEdit(fake, NAME(LOAN));
  const newerShows = (words) => byClass(target, "div", "newer").length > 0 && byClass(target, "div", "newer")[0].textContent.includes(words);
  type(target, LENDING.replace("returned.", "returned, or renewed."));
  withWhy(target);
  fake.land({ "SPEC.md": HEAD + LENDING.replace("returned.", "returned on time.") + READING });
  click(saveOf(target));
  await settled(target, () => newerShows("returned on time."), "the newer section");
  type(target, LENDING.replace("returned.", "returned on time, or renewed."));
  fake.land({ "SPEC.md": HEAD + LENDING.replace("returned.", "returned on time, at the desk.") + READING });
  click(saveOf(target));
  await settled(target, () => newerShows("returned on time, at the desk."), "the newest section");
  assert.equal(fake.writes().length, 0, "counter-proof: a further change after the refusal refuses the save again");
  const merged = LENDING.replace("returned.", "returned on time, at the desk, or renewed.");
  type(target, merged);
  click(saveOf(target));
  await settled(target, () => byClass(target, "p", "entry").length === 1 || newerShows("returned on time, at the desk."), "the answer to the save of the merged section");
  assert.equal(fake.writes().length, 1, "the merged section is written once");
  assert.deepEqual(proposals(fake).map((file) => file.text), [merged], "the proposal is the merged section");
});

// ---------------------------------------------------------------- without a token

// TST-472634 · level: unit · module: MOD-review-pages
// guards: UC-018; WITHOUT A TOKEN, GITHUB'S WEB INTERFACE IS THE FALLBACK; NO TEXT TRAVELS IN A URL
// given: a GitHub product whose host cannot write (no token), the editor with an edit and a Why
// input: a click on Save
// expect: nothing written; GitHub's pages offered, one for each file of the entry, none with the text in its address
test("requirement/<name> — without a token on GitHub, GitHub's pages open per file", async () => {
  const fake = fakeHost(FILES, { canWrite: false });
  const target = await showEdit(fake, NAME(LOAN), { token: false });
  type(target, LENDING.replace("returned.", "returned, or renewed."));
  withWhy(target);
  click(saveOf(target));
  await until(() => byClass(target, "a", "github-page").length >= 2, "GitHub's pages");
  assert.equal(fake.writes().length, 0, "nothing written");
  for (const page of byClass(target, "a", "github-page")) {
    assert.ok(page.getAttribute("href").startsWith("https://github.com/alice/thesis-tool/"), page.getAttribute("href"));
    assert.ok(!decodeURIComponent(page.getAttribute("href")).includes("renewed"), "no text in the address");
  }
});

// TST-472635 · level: unit · module: MOD-review-pages
// guards: UC-018; A GITLAB PRODUCT IS WRITTEN WITH A TOKEN
// given: a GitLab product, no token stored
// input: the page of the requirement
// expect: the section shown, but no editor and no Save; the token's step linked; nothing written
test("requirement/<name> — on GitLab without a token there is no Save", async () => {
  const fake = fakeHost(FILES, { repository: GITLAB, canWrite: false });
  const target = await showEdit(fake, NAME(LOAN), { token: false, repository: GITLAB });
  assert.match(target.textContent, new RegExp(LOAN), "known positive: the section is shown");
  assert.equal(find(target, (node) => node.localName === "textarea").length, 0, "no editor");
  assert.equal(find(target, (node) => node.localName === "button" && node.textContent === "Save").length, 0, "no Save");
  assert.equal(find(target, (node) => node.localName === "a" && node.getAttribute("href")?.startsWith("#add/")).length >= 1, true, "the token's step");
  assert.equal(fake.writes().length, 0);
});

// TST-472636 · level: unit · module: MOD-review-pages
// guards: UC-018
// given: the SPEC, which holds no requirement NO SUCH RULE
// input: the page #requirement/name=NO SUCH RULE
// expect: the page names the requirement as missing; no editor; nothing written
test("requirement/<name> — a requirement the SPEC does not hold is said so", async () => {
  const fake = fakeHost();
  const target = await showEdit(fake, NAME("NO SUCH RULE"));
  assert.match(target.textContent, /No requirement NO SUCH RULE/);
  assert.equal(find(target, (node) => node.localName === "textarea").length, 0);
  assert.equal(fake.writes().length, 0);
});
