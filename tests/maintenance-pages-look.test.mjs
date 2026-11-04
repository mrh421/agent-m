// The maintenance pages wear the site's one look (ITM-1446): each button the routes mail, replies, replies/<issue>, issues and issue/<number> draw carries the frame's class btn, and the table
// fix-expectations carries the frame's class list (look.css: ".btn", ".list").
// Run: node --test tests/maintenance-pages-look.test.mjs
//
// Module: MOD-maintenance-pages
// Guards: EVERY PAGE SHARES ONE LOOK AND WORKS ON A PHONE; THE SITE WEARS THE PATTERN RECOGNITION LAB'S LOOK
// Level: unit
//
// The expected results are written here from the item's Acceptance ("every button of the mail, replies and issue pages carries `btn`, and the table `fix-expectations` carries `list`") and from the classes
// look.css styles, and none is read from the code. Readings taken where the texts leave one open:
//   - A button is an element <button>; a table is an element <table>. A link is not checked.
//   - "A hit whose element a scoped rule already styles is left": look.css scopes a button rule to .prompt-bar and .arrange, and a table rule to .md; an element inside one of them is not a finding.
//   - The pages are drawn over the world of tests/maintenance-pages-world.mjs; only the buttons a drawn state holds are checked. Each test states the buttons it found, so that a state that draws none fails.
// The known positive is an element in the look; the counter-proofs are in the pull request.

import "./site-frame-dom.mjs";
import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { PRODUCT_URL } from "./main-page-home-harness.mjs";
import { startRecord } from "../src/job-ledger/index.mjs";
import { connect, parseAddress } from "../src/repository-hosts/index.mjs";
import { registerStrategies } from "../src/job-runner/index.mjs";
import { byClass, itemOf, mailOf, one, opened, pages, read, restoreWorld, start, trusted, waitFor, walk, world, issueRecord, textOf, routeNamed } from "./maintenance-pages-world.mjs";

for (const [at, strategies] of (pages.view?.strategies ?? []).entries()) {
  try { registerStrategies(`tests/maintenance-pages-look.test.mjs#${at}`, strategies); } catch { /* registered by the page's own view */ }
}
afterEach(restoreWorld);

const classes = (node) => (node.className ?? "").split(" ").filter(Boolean);
const within = (node, scopes) => { for (let up = node.parentNode; up; up = up.parentNode) if (classes(up).some((name) => scopes.includes(name))) return true; return false; };
const buttonsIn = (target) => walk(target, (node) => node.localName === "button" && !within(node, ["prompt-bar", "arrange"]));
const text = (node) => textOf(node).trim().slice(0, 40);
// The findings of one drawn page: what is not the frame's look, each named by its element.
const buttonFindings = (target) => buttonsIn(target).filter((node) => !classes(node).includes("btn")).map((node) => `button "${text(node)}" (${node.className}) has no class btn`);
const tableFindings = (target) => walk(target, (node) => node.localName === "table" && !within(node, ["md"])).filter((node) => !classes(node).includes("list"))
  .map((node) => `table "${text(node)}" (${node.className}) has no class list`);
const namesOf = (target) => buttonsIn(target).map((node) => classes(node)[0]);

// TST-1446001 · level: unit · module: MOD-maintenance-pages
// guards: EVERY PAGE SHARES ONE LOOK AND WORKS ON A PHONE
// given: a button with class btn and a table with class list, made by hand; a bare button and a bare table made by hand; a bare button inside .prompt-bar
// input: the checks (buttons, tables) applied to each
// expect: known positive — the element in the look is no finding; known negative — the bare button and the bare table are one finding each; a button inside .prompt-bar, which look.css styles by its own rule, is none
test("TST-1446001: an element in the look passes the checks, and a bare button and a bare table are findings", () => {
  const inLook = document.createElement("div");
  const button = document.createElement("button"), table = document.createElement("table");
  button.className = "btn"; table.className = "list";
  inLook.append(button, table);
  assert.deepEqual([...buttonFindings(inLook), ...tableFindings(inLook)], [], "an element in the look passes");
  const bare = document.createElement("div");
  bare.append(document.createElement("button"), document.createElement("table"));
  assert.equal([...buttonFindings(bare), ...tableFindings(bare)].length, 2, "known negative: a bare button and a bare table are one finding each");
  const scoped = document.createElement("div"), bar = document.createElement("div");
  bar.className = "prompt-bar";
  bar.append(document.createElement("button"));
  scoped.append(bar);
  assert.deepEqual(buttonFindings(scoped), [], "a button a scoped rule styles is left");
});

// TST-1446002 · level: unit · module: MOD-maintenance-pages
// guards: EVERY PAGE SHARES ONE LOOK AND WORKS ON A PHONE
// given: the world with two mails in the mailbox and the product alice/product
// input: the route mail drawn; the person's click on Read mailbox
// expect: Read mailbox, and then Create issue, Add to #n and Not an issue of each mail, are drawn, and every button of the page carries the class btn
test("TST-1446002: the buttons of the mail page carry the frame's class btn", async () => {
  const one_ = await mailOf("one", { subject: "Export fails", text: "The export fails." });
  const w = world({ mails: [one_], reading: [one_], issues: [issueRecord(3, "open", [])] });
  const target = await opened(w, {}, "mail");
  assert.deepEqual(namesOf(target), ["read-mailbox"], "Read mailbox is drawn");
  await trusted(one(target, "read-mailbox"));
  await waitFor(() => byClass(target, "mail-decided").length > 0 || byClass(target, "mailbox-problem").length > 0);
  assert.ok(itemOf(target, one_.id), "the mail is listed");
  for (const wanted of ["create-issue", "add-to-issue", "not-an-issue"]) assert.ok(namesOf(itemOf(target, one_.id)).includes(wanted), `${wanted} is drawn`);
  assert.deepEqual(buttonFindings(target), []);
});

// TST-1446003 · level: unit · module: MOD-maintenance-pages
// guards: EVERY PAGE SHARES ONE LOOK AND WORKS ON A PHONE
// given: the standard fixture of the replies page: the closed issue 4 listing four mails (one with a draft), an answer received (5), an open issue (6)
// input: the route replies after Read replies; the routes replies/4, replies/5 and replies/6
// expect: Read replies, Open, and on the issues the buttons Save draft, Send, Write the reply myself, No reply, Remove the label and Ask the reporter are drawn, and every button of every page carries the class btn
test("TST-1446003: the buttons of the replies pages carry the frame's class btn", async () => {
  const { w, target } = await start();
  assert.deepEqual(namesOf(target), ["read-replies"], "Read replies is drawn");
  await read(target);
  const pagesDrawn = [target];
  for (const issue of ["4", "5", "6"]) pagesDrawn.push(await opened(w, { issue, product: PRODUCT_URL }));
  const names = pagesDrawn.flatMap(namesOf);
  for (const wanted of ["issue-link", "save-draft", "send-reply", "write-reply", "no-reply", "remove-label", "ask-reporter"]) assert.ok(names.includes(wanted), `${wanted} is drawn: ${names.join(", ")}`);
  assert.deepEqual(pagesDrawn.flatMap(buttonFindings), []);
});

// TST-1446004 · level: unit · module: MOD-maintenance-pages
// guards: EVERY PAGE SHARES ONE LOOK AND WORKS ON A PHONE
// given: the world with an unclassified open issue 5, an open issue 6 labelled defect and an open issue 7 labelled change
// input: the route issue for each
// expect: the buttons Bug, Change, Not reproducible and Reject issue of the class step are drawn, and every button of the three pages carries the class btn
test("TST-1446004: the buttons of the issue pages carry the frame's class btn", async () => {
  const record = (number, labels) => ({ number, title: `Export loses pages ${number}`, body: "FIRST RULE is broken.", state: "open", labels, comments: [] });
  const w = world({ mails: [], issues: [record(5, []), record(6, ["defect"]), record(7, ["change"])] });
  w.context.product = { address: PRODUCT_URL, kind: "github", host: connect(parseAddress(PRODUCT_URL), { token: "github_pat_HOME827PRODUCT0123456789abcdefg" }), tokenStored: true };
  const drawn = [];
  for (const number of ["5", "6", "7"]) {
    const detail = await opened(w, { number }, "issue");
    await waitFor(() => byClass(detail, "set-class").length > 0 && byClass(detail, "issue-analysis").length > 0);
    drawn.push(detail);
  }
  const names = drawn.flatMap(namesOf);
  for (const wanted of ["set-class", "reject"]) assert.ok(names.includes(wanted), `${wanted} is drawn: ${names.join(", ")}`);
  assert.deepEqual(drawn.flatMap(buttonFindings), []);
});

// TST-1446005 · level: unit · module: MOD-maintenance-pages
// guards: EVERY PAGE SHARES ONE LOOK AND WORKS ON A PHONE
// given: the issue 6 labelled defect, its fix job and its open pull request #9, which changes the expected result of the test TST-100 of a changed test file; the same pull request merged
// input: the route issue 6 for each
// expect: the open pull request shows the table fix-expectations with class list; the merged one shows Close with links, and every button carries the class btn
test("TST-1446005: the fix's table of expectations carries the class list and its Close with links the class btn", async () => {
  const ADDRESS = `${PRODUCT_URL}/issues/6`;
  const JOB = "JOB-20261029-0900-c3d4";
  const RECORD = startRecord({ id: JOB, kind: "fix-bug", worksOn: [ADDRESS], participant: "ci-bot", model: "fixture-llm", route: "ci hosted", run: null, retries: null, startedBy: "alice", start: new Date("2026-10-29T09:00:00Z"),
    agentM: { version: "unreleased", commit: "f".repeat(40) }, inputs: [], limit: 2, destinations: [{ participant: "ci-bot", place: "GitHub's hosted runners", parts: [] }], params: { issue: 6 } });
  const declared = (expect) => ["// TST-100 · level: unit · module: MOD-store", "// guards: FIRST RULE", "// given: a store", "// input: the export", `// expect: ${expect}`, 'test("TST-100", () => {});', ""].join("\n");
  const texts = { base: { "tests/store.test.mjs": declared("the export holds two pages") }, head: { "tests/store.test.mjs": declared("the export holds three pages") } };
  for (const state of ["open", "merged"]) {
    const w = world({ mails: [], issues: [{ number: 6, title: "Export loses pages 6", body: "FIRST RULE is broken.", state: "open", labels: ["defect"], comments: [] }], product: { [RECORD.path]: RECORD.text } });
    const pull = { number: 9, title: `${JOB}: fix-bug`, branch: JOB, base: "main", head: "2".repeat(40), mergeCommit: state === "merged" ? "3".repeat(40) : null, state, draft: false, url: `${PRODUCT_URL}/pull/9`,
      opened: "2026-10-29T09:10:00Z", merged: state === "merged" ? "2026-10-29T09:50:00Z" : null, closed: state === "merged" ? "2026-10-29T09:50:00Z" : null, body: `Job: ${JOB}` };
    const real = connect(parseAddress(PRODUCT_URL), { token: "github_pat_HOME827PRODUCT0123456789abcdefg" });
    const host = { ...real, readHistory: async () => [], listPullRequests: async ({ branch }) => (branch === JOB ? [pull] : []),
      pullRequestFacts: async () => ({ pullRequest: pull, commits: [], files: [{ path: "tests/store.test.mjs", change: "modified" }], reviews: [], checks: [], read: async (path, side) => texts[side][path] ?? null }) };
    w.context.product = { address: PRODUCT_URL, kind: "github", host, tokenStored: true };
    const detail = await opened(w, { number: "6" }, "issue");
    await waitFor(() => byClass(detail, "fix-expectations").length > 0 || byClass(detail, "close-with-links").length > 0 || byClass(detail, "issue-problem").length > 0);
    if (state === "open") {
      assert.equal(byClass(detail, "fix-expectations").length, 1, "the table is drawn");
      assert.deepEqual(tableFindings(detail), []);
    } else {
      assert.ok(namesOf(detail).includes("close-with-links"), "Close with links is drawn");
    }
    assert.deepEqual(buttonFindings(detail), []);
    restoreWorld();
  }
});
