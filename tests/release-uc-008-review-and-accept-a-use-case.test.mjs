// Release tests of UC-008 Review and accept a use case, on the pages of the use cases: the requirements UC-008 realises, each checked from what a reviewer reads on the page and from the requests the fixture servers received —
// the exact text an approval names, no text in a URL, GitHub's web interface without a token, a GitLab product written with a token, acceptance as the accepting person's commit, the gate recorded, a rejection with a
// reason that removes the proposal, a changed file against its last accepted text, the status derived from the records, and the dashboard's writes only on a person's click. TST-372301 maps every requirement UC-008
// realises to a release test that guards it.
// Run: node --test tests/release-uc-008-review-and-accept-a-use-case.test.mjs
//
// Module: MOD-review-pages
// Module: MOD-approvals
// Guards: UC-008
// Level: release
//
// Written for the release testing of sprint 141 by developer-sonnet-j (ITM-372), who implemented none of ITM-333, ITM-334, ITM-342, ITM-355, ITM-356, ITM-358, ITM-1266, ITM-1267, ITM-1319 or ITM-1323 and no UC-008 production
// behaviour (RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER). The world is tests/uc-008-harness.mjs: the real review pages and the real MOD-repository-hosts, MOD-approvals, MOD-documents and MOD-job-runner behind
// fixture servers for GitHub, a GitLab server and a model endpoint. The release team works from the specification and the pages: each case ends at what a person reads on the page and at the request the fixture received.
// Readings the texts leave open, which the cases state:
//   - "the commit names who and when" (UC-008 postcondition, THE GATE IS RECORDED) is read as: the commit is made with the person's token and sets no author or committer of its own, so the server names the account
//     and the time, and its message names the person; the page's History of use cases then lists the file, the person and the date the server gives.
//   - "the text the reviewer saw" is read as the text of the file at the commit the page was drawn from, which the page prints as "Text shown: blob <first twelve characters>".
//   - A requirement UC-008 realises has a release test when a test of level `release` whose declaration guards it stands in the map of TST-372301.

import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { testDeclarations } from "../src/test-document/index.mjs";
import { P41, P42, P43, P44, UC41, UC42, UC43, UC43_OLD, UC44_EDITED, TOKENS, areaOf, badgeOf, blobOf, buttonsNamed, byClass, click, find, idsIn, linksOf, record, reasonField, rowOf, saveButton,
  scripted, tick, tickOf, typeInto, until, withProduct, world } from "./uc-008-harness.mjs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const exists = (path) => existsSync(new URL(`../${path}`, import.meta.url));
const UC = "docs/use-cases/UC-008-review-and-accept-a-use-case.md";
const SELF = "tests/release-uc-008-review-and-accept-a-use-case.test.mjs";
const at = (w, id) => `#use-case/id=${id}/product=${encodeURIComponent(w.address)}`;
const hrefs = (target) => linksOf(target).map((link) => link.getAttribute("href") ?? "");
const resultOf = (target) => byClass(target, "p", "result").map((node) => node.textContent).join(" ");

// ---------------------------------------------------------------- the map

// Each requirement UC-008 realises, with the release tests that guard it: this file's, and those of the other items that already did.
const EVIDENCE = {
  "AN APPROVAL NAMES THE EXACT TEXT": [[SELF, "TST-372302"]],
  "STATUS IS DERIVED FROM THE RECORDS": [[SELF, "TST-372311"], ["tests/release-itm-690-approval-records.test.mjs", "TST-690001"]],
  "EDITS ARE PREPARED ON THE DASHBOARD": [["tests/release-uc-023-review-pages.test.mjs", "TST-739109"]],
  "NO TEXT TRAVELS IN A URL": [[SELF, "TST-372303"]],
  "THE PROSE IS AUTHORITATIVE, THE DIAGRAM IS THE OVERVIEW": [["tests/markdown-render-release-20.test.mjs", "TST-342008"]],
  "THE GATE IS RECORDED": [[SELF, "TST-372307"]],
  "THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK": [[SELF, "TST-372312"], ["tests/release-itm-1319-accepting-adds-items.test.mjs", "TST-1319201"]],
  "WITHOUT A TOKEN, GITHUB'S WEB INTERFACE IS THE FALLBACK": [[SELF, "TST-372304"]],
  "ONE CLICK PER DECISION": [[SELF, "TST-372306"]],
  "ACCEPTANCE IS A COMMIT BY THE ACCEPTING PERSON": [[SELF, "TST-372306"]],
  "A GITLAB PRODUCT IS WRITTEN WITH A TOKEN": [[SELF, "TST-372305"]],
  "SEVERAL FILES ARE ACCEPTED IN ONE CLICK": [["tests/release-itm-1319-accept-ticked-and-all-shown.test.mjs", "TST-1319206"], [SELF, "TST-372306"]],
  "A CHANGED FILE IS SHOWN AGAINST ITS LAST ACCEPTED TEXT": [[SELF, "TST-372310"]],
  "A PROPOSAL IS REJECTED WITH A REASON": [[SELF, "TST-372308"]],
  "A REJECTION REMOVES THE PROPOSAL": [[SELF, "TST-372309"]],
  "ACCEPTING A USE CASE PUTS THE MODULES IT CHANGES INTO THE BACKLOG": [["tests/release-itm-1319-accepting-adds-items.test.mjs", "TST-1319201"]],
};

// TST-372301 · level: release · module: system
// guards: UC-008
// given: UC-008 as committed text, whose `realises` lists sixteen requirements, and the release tests named in EVIDENCE
// input: read UC-008's list of the requirements it realises, and the declarations of the test files named for each
// expect: known positive — UC-008 realises these sixteen requirements; each has at least one test named; each test named stands in its file with the level release and guards that requirement
test("TST-372301: UC-008 every requirement it realises has a release test that guards it", () => {
  const front = /^realises:\n((?:  - .*\n)+)/m.exec(read(UC))?.[1] ?? "";
  const realised = front.split("\n").filter(Boolean).map((line) => line.replace(/^ {2}- /, ""));
  assert.equal(realised.length, 16, "known positive: UC-008 realises sixteen requirements");
  assert.deepEqual([...realised].sort(), Object.keys(EVIDENCE).sort(), "the map holds exactly the requirements UC-008 realises");
  for (const [requirement, tests] of Object.entries(EVIDENCE)) {
    assert.ok(tests.length > 0, `${requirement}: a test is named`);
    for (const [file, id] of tests) {
      assert.ok(exists(file), `${requirement}: ${file} exists`);
      const declared = testDeclarations(file, read(file)).find((each) => each.id === id);
      assert.ok(declared, `${requirement}: ${id} is declared in ${file}`);
      assert.equal(declared.level, "release", `${id} is a release test`);
      assert.ok((declared.guards ?? []).includes(requirement), `${id} guards ${requirement}`);
    }
  }
});

// ---------------------------------------------------------------- an approval names the exact text

// TST-372302 · level: release · module: system
// guards: AN APPROVAL NAMES THE EXACT TEXT; UC-008
// given: the page of UC-041, open, drawn from the default branch; a token; then another writer's commit changes UC-041 on the default branch, as the counter-proof
// input: the reviewer clicks Accept on the page as it was drawn; then the page is drawn again and the reviewer clicks Accept
// expect: the first click writes nothing and the page says UC-041 changed since it was shown; the second makes one commit of one record docs/approvals/UC-041-<twelve hex digits>.md of the three lines kind: use-case, file: docs/use-cases/UC-041-check-out-a-book.md and blob: <the git blob SHA, worked out here, of the text now on the branch>; the file name's digits are the first twelve of that blob and the ones the page printed as "Text shown"; the blob is not the first text's
test("TST-372302: UC-008 an approval names the file and the git blob SHA of the text the reviewer saw, and not a text that changed after it", async () => {
  const w = await world();
  const page = await w.open(at(w, "UC-041"));
  const shown = /Text shown: blob ([0-9a-f]{12})/.exec(page.target.textContent)?.[1];
  assert.equal(shown, blobOf(UC41).slice(0, 12), "the page prints the blob of the text it shows");
  const changed = UC41.replace("borrows a book at the desk.", "borrows a book at the desk, twice.");
  await w.land({ [P41]: changed });
  click(buttonsNamed(page.target, "Accept")[0]);
  await until(() => /UC-041: changed since shown/.test(page.target.textContent), "the refusal");
  assert.deepEqual(w.writes(), [], "a text that changed after it was shown is not accepted");
  const again = await w.open(at(w, "UC-041"));
  const shownNow = /Text shown: blob ([0-9a-f]{12})/.exec(again.target.textContent)?.[1];
  click(buttonsNamed(again.target, "Accept")[0]);
  await until(() => w.writes().length === 1, "the commit");
  const [[path, body], ...more] = Object.entries(w.writes()[0].files);
  assert.equal(more.length, 0, "one record");
  assert.equal(body, `kind: use-case\nfile: ${P41}\nblob: ${blobOf(changed)}\n`, "the three lines");
  assert.equal(path, `docs/approvals/UC-041-${blobOf(changed).slice(0, 12)}.md`);
  assert.equal(shownNow, blobOf(changed).slice(0, 12), "the digits the page printed");
  assert.notEqual(blobOf(changed), blobOf(UC41), "counter-proof: it is not the first text's");
});

// ---------------------------------------------------------------- no text travels in a URL

// TST-372303 · level: release · module: system
// guards: NO TEXT TRAVELS IN A URL; UC-008
// given: a GitHub product with no token of its own stored; UC-041 never accepted, UC-043 changed since its acceptance; the reviewer's edit of UC-041 and the reasons typed for the rejections
// input: the reviewer opens UC-041 and UC-043, edits UC-041 and presses Save, rejects UC-043 and UC-041 with a reason; every address a page of them offers to GitHub is read
// expect: the addresses are GitHub's new-file page of the repository — whose query holds only `filename`, the path of the record, and `value`, the record —, GitHub's editor for a file and GitHub's page that deletes a file, the last two with no query; no address holds a word of UC-041's or UC-043's text, of the edit or of the title; the address for the new file does hold the record, its three lines (known positive)
test("TST-372303: UC-008 a link that prepares a commit in GitHub carries at most a file path and an approval record, never the reviewed text", async () => {
  const w = await world({ token: false });
  const text = ["borrows a book", "Goal.", "Check out a book", "returns a book and the card", "Return a book", "sequenceDiagram", "with a receipt", "A LOAN HAS A DUE DATE"];
  const seen = [];
  const external = (target) => hrefs(target).filter((href) => /^https?:/.test(href));
  const one = await w.open(at(w, "UC-041"));
  seen.push(...external(one.target));
  const record41 = record("UC-041", P41, UC41);
  const accept = new URL(seen.find((href) => href.includes("/new/main")));
  assert.equal(accept.searchParams.get("value"), record41[1], "known positive: the new-file address holds the record");
  assert.deepEqual([...accept.searchParams.keys()].sort(), ["filename", "value"], "and its path, nothing else");
  await one.go(withProduct(byClass(one.target, "a", "edit-link")[0].getAttribute("href"), w.address));
  Object.defineProperty(globalThis, "navigator", { value: { clipboard: { writeText: async () => {} } }, configurable: true, writable: true });
  const opened = [];
  globalThis.open = (address) => { opened.push(address); return null; };
  typeInto(areaOf(one.target), UC41.replace("borrows a book at the desk.", "borrows a book at the desk, with a receipt."));
  click(saveButton(one.target));
  await until(() => opened.length === 1, "GitHub's editor");
  seen.push(...opened, ...external(one.target));
  for (const id of ["UC-041", "UC-043"]) {
    const page = await w.open(at(w, id));
    reasonField(page.target).value = `the reason for ${id}`;
    click(byClass(page.target, "button", "reject")[0]);
    await until(() => byClass(page.target, "pre", "commit-message").length === 1, `the pages that reject ${id}`);
    seen.push(...external(page.target));
  }
  const addresses = [...new Set(seen)].map((href) => new URL(href));
  assert.ok(addresses.length >= 5, `the new-file pages, the editor and the delete page were offered: ${seen.length}`);
  for (const address of addresses) {
    const kind = /^\/alice\/thesis-tool\/(new|edit|delete)\/main/.exec(address.pathname)?.[1];
    assert.ok(kind, `${address.href} is a page of GitHub's web interface for this repository`);
    assert.deepEqual([...address.searchParams.keys()].sort(), kind === "new" ? ["filename", "value"] : [], `${address.href} holds ${kind === "new" ? "the path and the record" : "no query"}`);
    const readable = decodeURIComponent(address.href);
    for (const word of text) assert.ok(!readable.includes(word), `${address.href} holds no "${word}"`);
  }
});

// ---------------------------------------------------------------- without a token

// TST-372304 · level: release · module: system
// guards: WITHOUT A TOKEN, GITHUB'S WEB INTERFACE IS THE FALLBACK; UC-008
// given: a GitHub product with no token of its own stored (the instance's token is stored and is none for it); UC-041 never accepted, UC-043 changed since its acceptance; a clipboard and a window that record what they are given; as the counter-proof the same product with its token
// input: the reviewer clicks Accept of UC-041; presses Reject on UC-043 with a reason and on UC-041 with a reason; edits UC-041 and presses Save; and, with the token, clicks Accept
// expect: Accept is no button but GitHub's new-file page with the record prefilled; Reject lists, for UC-043, GitHub's editor for the file with the restored text to paste, and for UC-041 GitHub's page that deletes the file, each with the commit message "reject <id>" and the reason; Save puts the edited text on the clipboard and opens GitHub's editor for the file; no request that writes reaches the server and nothing is committed; counter-proof — with the token the same Accept makes one commit and opens no window and offers no GitHub page
test("TST-372304: UC-008 without a token accepting, rejecting and editing open GitHub's web interface with the commit prepared as far as GitHub allows", async () => {
  const w = await world({ token: false });
  const one = await w.open(at(w, "UC-041"));
  assert.equal(buttonsNamed(one.target, "Accept").length, 0, "no Accept button");
  const accept = byClass(one.target, "a", "github-page")[0];
  assert.equal(new URL(accept.getAttribute("href")).searchParams.get("value"), record("UC-041", P41, UC41)[1], "GitHub's new-file page, the record prefilled");
  const pages = {};
  for (const id of ["UC-043", "UC-041"]) {
    const page = await w.open(at(w, id));
    reasonField(page.target).value = `the reason for ${id}`;
    click(byClass(page.target, "button", "reject")[0]);
    await until(() => byClass(page.target, "pre", "commit-message").length === 1, `GitHub's pages for ${id}`);
    pages[id] = { links: hrefs(page.target).filter((href) => /^https:\/\/github\.com\/alice\/thesis-tool\/(edit|delete)\//.test(href)), message: byClass(page.target, "pre", "commit-message")[0].textContent, restored: byClass(page.target, "div", "reject-result")[0].textContent };
  }
  assert.deepEqual(pages["UC-043"].links, [`https://github.com/alice/thesis-tool/edit/main/${P43}`], "the editor for the changed file");
  assert.ok(pages["UC-043"].restored.includes("The member returns a book at the desk.") && !pages["UC-043"].restored.includes("and the card"), "with the restored text to paste, the text the record names");
  assert.deepEqual(pages["UC-041"].links, [`https://github.com/alice/thesis-tool/delete/main/${P41}`], "the page that deletes the file never accepted");
  for (const id of ["UC-043", "UC-041"]) assert.equal(pages[id].message, `reject ${id}\n\nReason: the reason for ${id}\n`, `the commit message to use for ${id}`);
  await one.go(withProduct(byClass(one.target, "a", "edit-link")[0].getAttribute("href"), w.address));
  const asked = { clipboard: [], opened: [] };
  Object.defineProperty(globalThis, "navigator", { value: { clipboard: { writeText: async (written) => { asked.clipboard.push(written); } } }, configurable: true, writable: true });
  globalThis.open = (address) => { asked.opened.push(address); return null; };
  const edited = UC41.replace("borrows a book at the desk.", "borrows a book at the desk, with a receipt.");
  typeInto(areaOf(one.target), edited);
  click(saveButton(one.target));
  await until(() => asked.opened.length === 1, "GitHub's editor");
  assert.deepEqual([asked.clipboard, asked.opened], [[edited], [`https://github.com/alice/thesis-tool/edit/main/${P41}`]]);
  assert.deepEqual([w.writes(), w.writers()], [[], []], "nothing is committed and no write is sent");
  const signed = await world();
  const own = await signed.open(at(signed, "UC-041"));
  asked.opened.length = 0;
  click(buttonsNamed(own.target, "Accept")[0]);
  await until(() => signed.writes().length === 1, "counter-proof: the commit");
  assert.deepEqual([asked.opened.length, byClass(own.target, "a", "github-page").length], [0, 0], "counter-proof: no window and no GitHub page");
});

// ---------------------------------------------------------------- a GitLab product

// TST-372305 · level: release · module: system
// guards: A GITLAB PRODUCT IS WRITTEN WITH A TOKEN; UC-008
// given: a product on a GitLab server with UC-041 never accepted and UC-043 changed since its acceptance; no token for the project stored in one world (the instance's GitHub token is stored), the project's token in another
// input: without the token the reviewer opens the list, Review all, UC-041 and UC-043, and presses Reject on UC-041 with a reason; with the token the reviewer clicks Accept on UC-041, saves an edit of UC-043 and rejects UC-043's sibling UC-044
// expect: without the token there is no Accept, no Accept ticked, no Accept all, no Edit and no tick; no address of GitHub's or of GitLab's web interface is offered, and the step that stores the token is linked; Reject names the token's step and writes nothing; with the token each of the three decisions is one commit on the GitLab server carrying the project's token in its PRIVATE-TOKEN header and no token of GitHub: the record of UC-041, the edited UC-043 alone, and the deletion of UC-044's file
test("TST-372305: UC-008 accepting, editing and rejecting in a GitLab product require a stored token and there is no web-interface fallback", async () => {
  const none = await world({ server: "gitlab", token: false });
  const web = (target) => hrefs(target).filter((href) => /^https?:/.test(href));
  for (const route of [`#use-case/product=${encodeURIComponent(none.address)}`, at(none, "all"), at(none, "UC-041"), at(none, "UC-043")]) {
    const page = await none.open(route);
    assert.equal(buttonsNamed(page.target, "Accept").length + buttonsNamed(page.target, "Accept all 3 shown").length + byClass(page.target, "button", "accept-ticked").length, 0, `${route}: no Accept`);
    assert.equal(byClass(page.target, "a", "edit-link").length + find(page.target, (node) => node.localName === "input").length, 0, `${route}: no Edit and no tick`);
    assert.deepEqual(web(page.target), [], `${route}: no address of a web interface`);
    assert.ok(hrefs(page.target).some((href) => href === `#add/${encodeURIComponent(none.address)}`), `${route}: the step that stores the token is linked`);
  }
  const page = await none.open(at(none, "UC-041"));
  reasonField(page.target).value = "not wanted";
  click(byClass(page.target, "button", "reject")[0]);
  await until(() => /GitLab product is written with the project's own token/.test(page.target.textContent), "the token's step");
  assert.deepEqual([none.writes(), none.writers()], [[], []], "nothing is written");
  const w = await world({ server: "gitlab" });
  const accept = await w.open(at(w, "UC-041"));
  click(buttonsNamed(accept.target, "Accept")[0]);
  await until(() => w.writes().length === 1, "the acceptance");
  const edit = await w.open(withProduct("#use-case/id=UC-043/edit=1", w.address));
  const edited = UC43.replace("and the card at the desk.", "and the card at the desk, with a receipt.");
  typeInto(areaOf(edit.target), edited);
  click(saveButton(edit.target));
  await until(() => w.writes().length === 2, "the edit");
  const reject = await w.open(at(w, "UC-044"));
  reasonField(reject.target).value = "not wanted";
  click(byClass(reject.target, "button", "reject")[0]);
  await until(() => w.writes().length === 3, "the rejection");
  const [accepted, saved, rejected] = w.writes();
  assert.deepEqual(accepted.files, Object.fromEntries([record("UC-041", P41, UC41)]), "the record of UC-041");
  assert.deepEqual(saved.files, { [P43]: edited }, "the edited UC-043 alone");
  assert.deepEqual([rejected.files, rejected.deleted], [{}, [P44]], "the deletion of UC-044's file");
  assert.deepEqual([...new Set(w.writers().map((request) => request.authorization))], [TOKENS.gitlab.value], "the project's token, and none of GitHub's");
});

// ---------------------------------------------------------------- acceptance is the accepting person's commit

// TST-372306 · level: release · module: system
// guards: ACCEPTANCE IS A COMMIT BY THE ACCEPTING PERSON; ONE CLICK PER DECISION; SEVERAL FILES ARE ACCEPTED IN ONE CLICK; UC-008
// given: the four use cases of a GitHub product, token named "github.com/alice", and of a GitLab product, token named "gitlab.example.org/alice"; the instance's own token is stored too
// input: on GitHub the reviewer clicks Accept on UC-041 in one world, opens the pages of UC-041 and UC-044, then the list, ticks UC-041 and UC-044 and clicks Accept ticked in another, and clicks Accept all 3 shown on Review all in a third; on GitLab the reviewer clicks Accept on UC-041
// expect: each click is one commit on the default branch that adds only files under docs/approvals/, one record per use case accepted — one, two, three, one —, each named UC-<nnn>-<twelve hex digits>.md; its message names the person the token is stored under ("Accepted by github.com/alice", "Accepted by gitlab.example.org/alice"); every request that writes carries that product's token and none the instance's; no other file is committed
test("TST-372306: UC-008 an acceptance, of one use case, of the ticked ones or of all shown, is one commit made with the accepting person's own token that adds approval records", async () => {
  const recordsOf = (write) => Object.keys(write.files).sort();
  const onlyRecords = (write, ids) => assert.deepEqual(recordsOf(write).map((path) => path.replace(/-[0-9a-f]{12}\.md$/, "")), ids.map((id) => `docs/approvals/${id}`));
  const single = await world();
  click(buttonsNamed((await single.open(at(single, "UC-041"))).target, "Accept")[0]);
  await until(() => single.writes().length === 1, "Accept");
  onlyRecords(single.writes()[0], ["UC-041"]);
  assert.match(single.writes()[0].message, /Accepted by github\.com\/alice/);
  const ticked = await world();
  const list = await ticked.open(at(ticked, "UC-041"));
  await list.go(at(ticked, "UC-044"));
  await list.go(`#use-case/product=${encodeURIComponent(ticked.address)}`);
  tick(tickOf(list.target, "UC-041")); tick(tickOf(list.target, "UC-044"));
  click(byClass(list.target, "button", "accept-ticked")[0]);
  await until(() => ticked.writes().length === 1, "Accept ticked");
  onlyRecords(ticked.writes()[0], ["UC-041", "UC-044"]);
  assert.match(ticked.writes()[0].message, /Accepted by github\.com\/alice/);
  const all = await world();
  const review = await all.open(at(all, "all"));
  click(buttonsNamed(review.target, "Accept all 3 shown")[0]);
  await until(() => all.writes().length === 1, "Accept all");
  onlyRecords(all.writes()[0], ["UC-041", "UC-043", "UC-044"]);
  assert.match(all.writes()[0].message, /Accepted by github\.com\/alice/);
  for (const each of [single, ticked, all]) assert.deepEqual([...new Set(each.writers().map((request) => request.authorization))], [`Bearer ${TOKENS.github.value}`], "the person's token, not the instance's");
  const lab = await world({ server: "gitlab" });
  click(buttonsNamed((await lab.open(at(lab, "UC-041"))).target, "Accept")[0]);
  await until(() => lab.writes().length === 1, "Accept on GitLab");
  onlyRecords(lab.writes()[0], ["UC-041"]);
  assert.match(lab.writes()[0].message, /Accepted by gitlab\.example\.org\/alice/);
  assert.deepEqual([...new Set(lab.writers().map((request) => request.authorization))], [TOKENS.gitlab.value]);
});

// ---------------------------------------------------------------- the gate is recorded

// TST-372307 · level: release · module: system
// guards: THE GATE IS RECORDED; UC-008
// given: the four use cases of a GitHub product, the reviewer's token named "github.com/alice"; the server gives the commits of docs/approvals with the account of the token that made them and the day they were committed, 2026-11-01
// input: the reviewer accepts UC-041; the reviewer opens the History of use cases
// expect: the commit is made with the person's token and holds no `author` and no `committer` of its own, so that the server names the account and the time; its message names the person and the use case; the record names the file and the blob of the text decided; the History lists one row, the file docs/use-cases/UC-041-check-out-a-book.md, the person alice and the date 2026-11-01T10:00:00Z
test("TST-372307: UC-008 an acceptance records who decided, when, and on which text", async () => {
  const w = await world();
  const page = await w.open(at(w, "UC-041"));
  click(buttonsNamed(page.target, "Accept")[0]);
  await until(() => w.writes().length === 1, "the acceptance");
  const made = w.writers().find((request) => request.path.endsWith("/git/commits")).body;
  assert.equal(w.writers().find((request) => request.path.endsWith("/git/commits")).authorization, `Bearer ${TOKENS.github.value}`, "made with the person's token");
  assert.equal(Object.hasOwn(made, "author") || Object.hasOwn(made, "committer"), false, "no author and no committer of the dashboard's own");
  assert.match(made.message, /Accepted by github\.com\/alice/);
  assert.match(made.message, /UC-041/);
  assert.equal(w.writes()[0].files[record("UC-041", P41, UC41)[0]], record("UC-041", P41, UC41)[1], "the record names the file and the blob of the text decided");
  await page.go(at(w, "history"));
  const rows = find(page.target, (node) => node.localName === "tr").map((row) => row.textContent);
  assert.deepEqual(rows, ["FilePersonDate", `${P41}alice2026-11-01T10:00:00Z`]);
});

// ---------------------------------------------------------------- a proposal is rejected with a reason

// TST-372308 · level: release · module: system
// guards: A PROPOSAL IS REJECTED WITH A REASON; UC-008
// given: UC-041 never accepted, UC-043 changed since its acceptance, UC-042 accepted, a token; as the counter-proof, the use cases rejected without a reason
// input: the reviewer opens each; presses Reject with the field empty, then with blanks only, then a script presses it with a reason, then the reviewer presses it with a reason
// expect: Reject stands beside Accept on UC-041 and UC-043, with a field for the reason, and not on UC-042, which is accepted and offers no Accept; with no reason and with blanks nothing is written, the page says so and the focus is in the field; a script's click writes nothing; the reviewer's click with a reason makes one commit
test("TST-372308: UC-008 Reject is offered beside Accept for every use case that can be accepted, and writes only once a reason is typed", async () => {
  const w = await world();
  const accepted = await w.open(at(w, "UC-042"));
  assert.equal(byClass(accepted.target, "button", "reject").length + buttonsNamed(accepted.target, "Accept").length, 0, "counter-proof: an accepted use case offers neither");
  for (const id of ["UC-041", "UC-043"]) {
    const page = await w.open(at(w, id));
    assert.equal(buttonsNamed(page.target, "Accept").length, 1, `${id}: known positive: Accept is offered`);
    assert.equal(byClass(page.target, "button", "reject").length, 1, `${id}: Reject beside it`);
    assert.equal(byClass(page.target, "textarea", "reject-reason").length, 1, `${id}: with a field for the reason`);
  }
  const page = await w.open(at(w, "UC-041"));
  click(byClass(page.target, "button", "reject")[0]);
  await w.quiet();
  assert.deepEqual(w.writes(), [], "no reason, nothing written");
  assert.match(page.target.textContent, /Type the reason for rejecting first: nothing was written\./, "and the page says so");
  assert.equal(document.activeElement, reasonField(page.target), "the focus is in the field");
  reasonField(page.target).value = "   \n  ";
  click(byClass(page.target, "button", "reject")[0]);
  await w.quiet();
  assert.deepEqual(w.writes(), [], "blanks only, nothing written");
  reasonField(page.target).value = "not wanted";
  byClass(page.target, "button", "reject")[0].dispatchEvent(scripted());
  await w.quiet();
  assert.deepEqual(w.writes(), [], "a script's click writes nothing");
  click(byClass(page.target, "button", "reject")[0]);
  await until(() => w.writes().length === 1, "the rejection");
});

// TST-372309 · level: release · module: system
// guards: A REJECTION REMOVES THE PROPOSAL; UC-008
// given: UC-043, accepted twice — first as "returns a book at the desk" on 2026-09-01, then as "returns a book at the desk, with the card" on 2026-10-01 — and changed since; UC-041, never accepted; UC-044, shown to the reviewer and then changed by another writer; a token
// input: the reviewer rejects UC-043 with the reason "the card is out of scope", UC-041 with "not wanted", and UC-044 with "late"
// expect: UC-043's rejection is one commit of its file alone, with the text of the most recent record (the second), not the first, and no record, its message holding the reason and UC-043; UC-043 is then accepted; UC-041's is one commit that deletes its file and writes nothing else, the reason in its message, and the list holds it no more; UC-044's, whose text changed after it was shown, writes nothing and the page says so and is drawn again with the text as it stands
test("TST-372309: UC-008 a rejection is one commit with the reason in its message that restores the text the most recent record names, or removes a file no record names", async () => {
  const middle = UC43_OLD.replace("returns a book at the desk.", "returns a book at the desk, with the card.");
  const [middlePath, middleText] = record("UC-043", P43, middle);
  const w = await world({ files: { [middlePath]: middleText }, history: [middle], dates: { [middlePath]: "2026-10-01T10:00:00Z" } });
  const first = await w.open(at(w, "UC-043"));
  reasonField(first.target).value = "the card is out of scope";
  click(byClass(first.target, "button", "reject")[0]);
  await until(() => w.writes().length === 1, "the rejection of UC-043");
  assert.deepEqual(w.writes()[0].files, { [P43]: middle }, "the text of the most recent record, and no record");
  assert.match(w.writes()[0].message, /the card is out of scope/);
  assert.match(w.writes()[0].message, /UC-043/);
  await until(() => badgeOf(first.target) === "accepted", "UC-043 shown as accepted");
  const second = await w.open(at(w, "UC-041"));
  reasonField(second.target).value = "not wanted";
  click(byClass(second.target, "button", "reject")[0]);
  await until(() => w.writes().length === 2, "the rejection of UC-041");
  assert.deepEqual([Object.keys(w.writes()[1].files), w.writes()[1].deleted], [[], [P41]], "one commit that deletes the file and writes nothing else");
  assert.match(w.writes()[1].message, /not wanted/);
  const list = await w.open();
  assert.ok(!idsIn(list.target).includes("UC-041"), "the list holds it no more");
  const third = await w.open(at(w, "UC-044"));
  await w.land({ [P44]: UC44_EDITED });
  reasonField(third.target).value = "late";
  click(byClass(third.target, "button", "reject")[0]);
  await until(() => /UC-044 changed after it was shown, so nothing was written/.test(third.target.textContent), "the refusal");
  assert.equal(w.writes().length, 2, "nothing more is written");
  assert.match(third.target.textContent, /for a week/, "the page is drawn again with the text as it stands");
});

// ---------------------------------------------------------------- a changed file against its last accepted text

// TST-372310 · level: release · module: system
// guards: A CHANGED FILE IS SHOWN AGAINST ITS LAST ACCEPTED TEXT; UC-008
// given: UC-043 with two approval records — the earlier names "returns a book at the desk" (2026-09-01), the later "returns a book at the desk, with the card" (2026-10-01) — and the file now "returns a book and the card at the desk"; as the counter-proof, the earlier record alone
// input: the reviewer opens UC-043 in each
// expect: with two records the difference is to the later text: its sentence marked removed, the new one added, and the earlier sentence appears nowhere in the difference; with the earlier record alone the difference is to the earlier text
test("TST-372310: UC-008 a changed use case is compared with the text of its most recent record, and not with an older one", async () => {
  const middle = UC43_OLD.replace("returns a book at the desk.", "returns a book at the desk, with the card.");
  const [middlePath, middleText] = record("UC-043", P43, middle);
  const two = await world({ files: { [middlePath]: middleText }, history: [middle], dates: { [middlePath]: "2026-10-01T10:00:00Z" } });
  const both = byClass((await two.open(at(two, "UC-043"))).target, "pre", "diff")[0].textContent;
  assert.match(both, /- \*\*Goal\.\*\* The member returns a book at the desk, with the card\./, "the later text is the one compared");
  assert.match(both, /\+ \*\*Goal\.\*\* The member returns a book and the card at the desk\./);
  assert.ok(!both.includes("returns a book at the desk.\n") && !/- \*\*Goal\.\*\* The member returns a book at the desk\.\n/.test(both), "the earlier sentence is nowhere in the difference");
  const one = await world();
  const alone = byClass((await one.open(at(one, "UC-043"))).target, "pre", "diff")[0].textContent;
  assert.match(alone, /- \*\*Goal\.\*\* The member returns a book at the desk\./, "counter-proof: with the earlier record alone, the earlier text is compared");
});

// ---------------------------------------------------------------- the status is derived from the records

// TST-372311 · level: release · module: system
// guards: STATUS IS DERIVED FROM THE RECORDS; UC-008
// given: UC-042 with a record naming its current text, UC-043 with a record naming an earlier text, UC-041 with none; a second product in which UC-042's file was renamed and edited after its record, the record still naming the old path; the records are the product's only memory
// input: the reviewer opens the list in each
// expect: UC-042 accepted, UC-043 changed since acceptance, UC-041 open; in the second product UC-042 is changed since acceptance under its new path — a renamed file keeps its identity — and the first product's UC-042 is still accepted; nothing is written by drawing the lists
test("TST-372311: UC-008 a use case is accepted exactly when a record names its current blob, open when none names it, and changed when a record names an earlier text", async () => {
  const w = await world();
  const list = await w.open();
  assert.deepEqual(["UC-041", "UC-042", "UC-043"].map((id) => badgeOf(rowOf(list.target, id))), ["open", "accepted", "changed since acceptance"]);
  const renamed = "docs/use-cases/UC-042-lengthen-a-loan.md";
  const moved = await world({ files: { [P42]: null, [renamed]: UC42.replace("extends a loan once.", "extends a loan twice.") }, history: [UC42] });
  const after = await moved.open();
  assert.equal(badgeOf(rowOf(after.target, "UC-042")), "changed since acceptance", "a renamed and edited file keeps its identity, and its status");
  const link = find(rowOf(after.target, "UC-042"), (node) => node.localName === "a")[0];
  assert.equal(link.textContent, "UC-042");
  assert.deepEqual([w.writers(), moved.writers()], [[], []], "nothing is written");
  assert.equal(badgeOf(rowOf((await w.open()).target, "UC-042")), "accepted", "the first product's UC-042 is still accepted");
});

// ---------------------------------------------------------------- the dashboard writes only on a person's click

// TST-372312 · level: release · module: system
// guards: THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK; UC-008
// given: a GitHub product with a token and the four use cases; a script that clicks every control that writes
// input: each page is drawn and read, the list after the pages of UC-041 and UC-044; a script clicks Accept, Accept ticked (two ticked), Accept all 3 shown, Reject (a reason typed) and Save (an edit typed); then the person clicks the same controls
// expect: drawing writes nothing; a click a script makes on any of the five writes nothing; the person's click on Accept makes one commit — known positive: the controls were wired and pressable
test("TST-372312: UC-008 the dashboard writes to the repository only as the direct result of a person's click", async () => {
  const w = await world();
  const one = await w.open(at(w, "UC-041"));
  const all = await w.open(at(w, "all"));
  const edit = await w.open(withProduct("#use-case/id=UC-044/edit=1", w.address));
  const list = await w.open(at(w, "UC-041"));
  await list.go(at(w, "UC-044"));
  await list.go(`#use-case/product=${encodeURIComponent(w.address)}`);
  assert.deepEqual([w.writes(), w.writers()], [[], []], "drawing writes nothing");
  tick(tickOf(list.target, "UC-041")); tick(tickOf(list.target, "UC-044"));
  reasonField(one.target).value = "not wanted";
  typeInto(areaOf(edit.target), UC44_EDITED);
  const controls = [buttonsNamed(one.target, "Accept")[0], byClass(list.target, "button", "accept-ticked")[0], buttonsNamed(all.target, "Accept all 3 shown")[0], byClass(one.target, "button", "reject")[0], saveButton(edit.target)];
  assert.ok(controls.every(Boolean), "known positive: the five controls stand on the pages");
  for (const control of controls) control.dispatchEvent(scripted());
  await w.quiet();
  assert.deepEqual([w.writes(), w.writers()], [[], []], "a script's click writes nothing");
  click(controls[0]);
  await until(() => w.writes().length === 1, "known positive: the person's click");
});
