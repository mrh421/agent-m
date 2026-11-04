// MOD-review-pages' requirement edit without a token (ITM-592), as UC-018 4a states it for a requirement: "No token is stored (GitHub). *Save* opens GitHub's own pages, one per
// file, each with its text on the clipboard and never in the link: … for a requirement, its new-file page for each new file of the queue entry and its editor for the queue's
// `index.md` where the queue exists. The dashboard compares each file with the default branch before opening GitHub and warns if one already differs", and the item's Outcome:
// the pages of a requirement edit carry each file's text and warn when one differs, as on the use-case path. The editor of a requirement is the one of tests/review-pages-edit-requirement.test.mjs,
// whose test of the pages' links (TST-472634) holds unchanged.
// Run: node --test tests/review-pages-edit-requirement-pages.test.mjs
//
// Module: MOD-review-pages
// Guards: UC-018; WITHOUT A TOKEN, GITHUB'S WEB INTERFACE IS THE FALLBACK; NO TEXT TRAVELS IN A URL
// Level: unit
//
// This imports the browser harness of tests/review-pages-harness.mjs unchanged. The product is a fixture behind a Host of the tests' own, which keeps to
// MOD-repository-hosts' interface (repositoryInfo with canWrite, readSnapshot, commitFiles made only on the head that was read). The real MOD-markdown-render (its editor),
// MOD-spec-changes, MOD-spec-document, MOD-trace-graph, MOD-artifact-edits and MOD-text-tools run as they are. Nothing reaches the network. Where the module file leaves a
// reading open, the test states the one it takes, and the pull request names it:
//   - A page's text is shown in <pre class="clipboard-text"> in the same <li> as its <a class="github-page">, as the use-case path shows it (tests/review-pages-use-cases.test.mjs, src/review-pages/file-edit.mjs); a file that differs is warned about in <p class="problem"> of that <li> with the words "differs on the default branch".
//   - The default branch moving between the two readings of one snapshot is stood in for by a snapshot whose `paths` names one more file in its last reading than in the earlier
//     ones: the fixture counts the readings of a first, unwarned Save and adds the file at that last reading of a second one. The file that appeared is the index of the queue the entry
//     starts, which the edit began without (MOD-artifact-edits' fallbackEditLinks: "`differs` says that the default branch, as the snapshot holds it, no longer has the file as the
//     edit started").
//   - Without a token the person of the edit is "anonymous"; the entry of the section "## 1. Lending" is written as <queue>/01-lending.md with its rationale <queue>/01-lending.begruendung.md.
// Each test states its input and its expected result before it runs (given / input / expect). The counter-proofs are recorded in the pull request.

import "./review-pages-harness.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { storedGraphReadOn } from "./stored-graph-fake.mjs";

const { openStore } = await import("../src/browser-store/index.mjs");
const pages = await import("../src/review-pages/index.mjs").catch((error) => ({ error }));
const editRoute = pages.view?.routes.find((candidate) => candidate.name === "requirement");

// ---------------------------------------------------------------- the product

const text = (...lines) => `${lines.join("\n")}\n`;
const blobOf = (body) => createHash("sha1").update(`blob ${Buffer.byteLength(body)}\0${body}`).digest("hex");
const failure = (name, message, fields = {}) => Object.assign(new Error(message), { name }, fields);
const GITHUB = { server: "github", origin: "https://github.com", path: "alice/thesis-tool", web: "https://github.com/alice/thesis-tool" };
const LOAN = "A LOAN HAS A DUE DATE", SHELF = "A BOOK IS SHELVED", CARD = "A MEMBER HAS A CARD";
const LENDING = text("## 1. Lending", "", `**${LOAN}** *(Product Owner)*`, "Every loan states the date by which the book is returned.", "*Check:* `tests/loan.test.mjs`", "",
  `**${SHELF}** *(Product Owner)*`, "Every book stands on a shelf.", "");
const READING = text("## 2. Reading", "", `**${CARD}** *(Product Owner)*`, "Every member holds a card.", "*Check:* `tests/card.test.mjs`");
const HEAD = text("# Thesis tool — Specification", "");
const SPEC = HEAD + LENDING + READING;
const FILES = { "README.md": "# Thesis tool\n", "SPEC.md": SPEC };
const QUEUE = "docs/spec-freigaben/lending";
const EDITED = LENDING.replace("returned.", "returned, or renewed.");
const WHY = "Because it is clearer.";

// ---------------------------------------------------------------- the fake host: a product no token can write to

// `moves`, once armed, makes the last reading of `paths` name the index of the queue as well: { at: <the number of the reading> }.
function fakeHost(files = FILES) {
  const calls = [], tree = new Map(Object.entries(files)), head = createHash("sha1").update("commit 1").digest("hex");
  const state = { armed: false, moves: false, readings: 0, at: null, began: { lacking: [], extra: [] } };
  // `moves`, once armed, puts the default branch on another commit than the page opened on. The graph of the default branch's commit is stored on trace-cache, as the workflow
  // "main changed" stores it (tests/stored-graph-fake.mjs); building it reads the tree, not the snapshot's counted paths.
  const read = async (path) => (tree.has(path) ? tree.get(path) : null);
  const stored = storedGraphReadOn({ commit: head, get paths() { return [...tree.keys()].sort(); }, read });
  const snapshot = (ref) => ({ repository: GITHUB, ref, commit: state.armed && state.moves ? "m".repeat(40) : head, read, readOn: stored, blob: (path) => (tree.has(path) ? blobOf(tree.get(path)) : null),
    get paths() {
      const held = [...tree.keys()].sort();
      if (!state.armed) return held;
      state.readings += 1;
      return state.readings === state.at ? [...held, `${QUEUE}/index.md`] : held;
    } });
  return {
    writes: () => calls, state,
    host: {
      async repositoryInfo() { return { defaultBranch: "main", visibility: "public", canWrite: false, archived: false, description: "" }; },
      async readSnapshot(ref) {
        if (ref === "main") return snapshot("main");
        // The commit the edit was opened on is the head; the repository as it stood then lacks `began.lacking` and holds `began.extra` besides, and its paths are not counted.
        if (ref === head) return { repository: GITHUB, ref, commit: head, read: async (path) => (tree.has(path) ? tree.get(path) : null), blob: () => null,
          paths: [...[...tree.keys()].filter((path) => !state.began.lacking.includes(path)), ...state.began.extra].sort() };
        throw failure("NotFound", `${ref} was not found`);
      },
      async readHistory() { return []; },
      async commitFiles(change) { calls.push(change); throw failure("PermissionMissing", "the token cannot write"); },
    },
  };
}

// ---------------------------------------------------------------- the page

async function showEdit(fake) {
  assert.ok(editRoute, `the route: ${pages.error?.message}`);
  const store = openStore("nobody/agent-m");
  const target = document.createElement("div");
  document.body.append(target);
  await editRoute.render(target, { page: "review", instance: { repository: "alice/agent-m", host: fake.host }, store, go() {},
    product: { address: GITHUB.web, kind: "github", host: fake.host } }, { name: LOAN });
  return target;
}
function find(root, match) {
  const found = [];
  (function walk(node) { for (const kid of node.childNodes) { if (kid.nodeType === 1) { if (match(kid)) found.push(kid); walk(kid); } } })(root);
  return found;
}
const byClass = (root, name, className) => find(root, (node) => node.localName === name && node.className.split(" ").includes(className));
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
const saveOf = (target) => find(target, (node) => node.localName === "button" && node.textContent === "Save")[0];

// Edits the rule, gives a Why and clicks Save; returns once GitHub's pages are listed.
async function saveWithoutToken(fake) {
  const target = await showEdit(fake);
  areaOf(target).value = EDITED;
  areaOf(target).dispatchEvent(new Event("input"));
  byClass(target, "textarea", "why")[0].value = WHY;
  fake.state.armed = true;
  saveOf(target).dispatchEvent(new Event("click"));
  await until(() => byClass(target, "a", "github-page").length >= 4, "GitHub's pages");
  return target;
}
// The pages of the list: for each, its path (the words after "Open GitHub's page for "), its link, its text and its warnings.
function listed(target) {
  return byClass(target, "ul", "pages")[0].childNodes.filter((node) => node.nodeType === 1).map((item) => {
    const link = byClass(item, "a", "github-page")[0];
    return { path: link.textContent.replace("Open GitHub's page for ", ""), href: link.getAttribute("href"), clipboard: byClass(item, "pre", "clipboard-text").map((node) => node.textContent),
      warnings: byClass(item, "p", "problem").map((node) => node.textContent) };
  });
}

// TST-592001 · level: unit · module: MOD-review-pages
// guards: UC-018; WITHOUT A TOKEN, GITHUB'S WEB INTERFACE IS THE FALLBACK; NO TEXT TRAVELS IN A URL
// given: a GitHub product whose host cannot write (no token), whose default branch holds no queue of the person; the editor with the rule of A LOAN HAS A DUE DATE edited and a Why
// input: a click on Save
// expect: nothing committed; four pages — the queue's index, its decisions file, the entry's proposal and its rationale —, each with exactly one text beside its link; the proposal's text is the section as edited, byte for byte; the rationale's text holds the Why; the index's text names the section; no address holds a word of the text; no page is warned about
test("requirement/<name> — without a token each of GitHub's pages carries its file's text, the proposal byte for byte", async () => {
  const fake = fakeHost();
  const target = await saveWithoutToken(fake);
  assert.equal(fake.writes().length, 0, "nothing committed");
  const found = listed(target);
  assert.deepEqual(found.map((page) => page.path.replace(QUEUE, "<queue>")).sort(),
    ["<queue>/01-lending.begruendung.md", "<queue>/01-lending.md", "<queue>/entscheidungen.md", "<queue>/index.md"]);
  for (const page of found) assert.equal(page.clipboard.length, 1, `${page.path}: one text beside the link`);
  const textOf = (suffix) => found.find((page) => page.path.endsWith(suffix)).clipboard[0];
  assert.equal(textOf("/01-lending.md"), EDITED, "the proposal, byte for byte");
  assert.match(textOf("/01-lending.begruendung.md"), /Because it is clearer\./);
  assert.match(textOf("/index.md"), /\| 01 \| `SPEC.md` \| ## 1\. Lending \|/);
  for (const page of found) {
    assert.ok(page.href.startsWith("https://github.com/alice/thesis-tool/"), page.href);
    assert.ok(!decodeURIComponent(page.href).includes("renewed"), "no text in the address");
    assert.deepEqual(page.warnings, [], `${page.path}: no warning where nothing differs`);
  }
});

// TST-592002 · level: unit · module: MOD-review-pages
// guards: UC-018; WITHOUT A TOKEN, GITHUB'S WEB INTERFACE IS THE FALLBACK
// given: the product of TST-592001, whose default branch gains the queue's index between two readings of one snapshot — the file the edit began without
// input: a click on Save
// expect: the page of the index carries the warning that the file differs on the default branch, beside its text; no other page carries a warning, and each other page still carries its text
test("requirement/<name> — without a token a file that already differs is warned about on its page", async () => {
  const counting = fakeHost();
  await saveWithoutToken(counting);
  const last = counting.state.readings;
  assert.ok(last > 0, "known positive: the unwarned save read the paths");
  const fake = fakeHost();
  fake.state.at = last;
  const target = await saveWithoutToken(fake);
  const found = listed(target);
  const index = found.find((page) => page.path === `${QUEUE}/index.md`);
  assert.equal(index.warnings.length, 1, "the index is warned about");
  assert.match(index.warnings[0], /differs on the default branch/);
  assert.equal(index.clipboard.length, 1, "its text is beside the warning");
  for (const page of found.filter((each) => each !== index)) {
    assert.deepEqual(page.warnings, [], `${page.path}: no warning`);
    assert.equal(page.clipboard.length, 1, `${page.path}: its text`);
  }
});

// TST-611006 · level: unit · module: MOD-review-pages
// guards: UC-018; WITHOUT A TOKEN, GITHUB'S WEB INTERFACE IS THE FALLBACK
// given: the product of TST-592001, whose default branch has moved to another commit since the editor was opened, and whose repository at the commit it was opened on held the index of the queue the edit starts, which the default branch no longer holds
// input: a click on Save
// expect: the page of the index carries one warning that the file differs on the default branch, beside its text; no other page carries a warning
test("requirement/<name> — without a token a file the default branch lost since the edit began is warned about on its page", async () => {
  const fake = fakeHost();
  fake.state.began.extra = [`${QUEUE}/index.md`];
  fake.state.moves = true;
  const found = listed(await saveWithoutToken(fake));
  assert.deepEqual(found.filter((page) => page.warnings.length > 0).map((page) => page.path), [`${QUEUE}/index.md`]);
  assert.match(found.find((page) => page.path === `${QUEUE}/index.md`).warnings[0], /differs on the default branch/);
  assert.equal(found.find((page) => page.path === `${QUEUE}/index.md`).clipboard.length, 1, "its text is beside the warning");
});
