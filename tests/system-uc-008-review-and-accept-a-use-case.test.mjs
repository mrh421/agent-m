// System coverage for UC-008 Review and accept a use case, walked through the dashboard: the main flow, steps 1 to 6, and the alternative flows 1a, 2a, 3a, 3b, 3c, 3d, 3e, 3f, 4a and 5a. The page is MOD-site-frame's real review
// page, or the real route `use-case` of MOD-review-pages, over the real MOD-repository-hosts host of GitHub or of a GitLab server, MOD-approvals, MOD-documents, MOD-job-runner and MOD-work-plans, behind fixture servers
// for GitHub, a GitLab server and one model endpoint (tests/uc-008-harness.mjs); step 6 runs with a product whose model pulls its work from a backlog. No request leaves the process.
// Run: node --test tests/system-uc-008-review-and-accept-a-use-case.test.mjs
//
// Module: MOD-review-pages
// Module: MOD-approvals
// Guards: UC-008
// Level: system
//
// Authored by developer-sonnet-j (ITM-372), who implemented none of ITM-333, ITM-334, ITM-342, ITM-355, ITM-356, ITM-358, ITM-1266, ITM-1267, ITM-1319 or ITM-1323 and no UC-008 production behaviour.
// Where the pages and UC-008 disagree the case follows UC-008 and is marked { todo } with the finding it reports; no finding is open.
// Each test states its input and its expected values in its own text; none reads an expected result from the SPEC, a use case or an architecture file, but the flow map (TST-372201), which holds the expected passages itself
// and checks that UC-008 still says them. A person's click is the page's own listener called with a trusted event; a script's click is made by `scripted()`; no input event of the operating system is made. Readings the texts
// leave open, which the cases state:
//   - "the dashboard computes the git blob SHA of the text it shows" is read as: the approval record names the blob of the file at the commit the page was drawn from, which is also the blob the page prints as "Text shown".
//   - "the same click" (step 6) is read as: the click on Accept starts the check once the acceptance's commit is written, and the items are committed after it.
//   - "under the reviewer's account" is read as: every request that writes carries the token this browser stores for the product, and none carries the instance's token.
//   - "each one read" (3d) is read as: a use case whose own page the reviewer has opened.

import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { P41, P42, P43, P44, UC41, UC42, UC43, UC43_OLD, UC44_EDITED, TOKENS, areaOf, backlogItem, badgeOf, blobOf, buttonsNamed, byClass, click, find, idsIn, linksOf, listOf, mergedPull, pageText,
  reasonField, record, rowOf, saveButton, scripted, tick, tickOf, typeInto, until, withProduct, world } from "./uc-008-harness.mjs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const exists = (path) => existsSync(new URL(`../${path}`, import.meta.url));
const UC = "docs/use-cases/UC-008-review-and-accept-a-use-case.md";
const SELF = "tests/system-uc-008-review-and-accept-a-use-case.test.mjs";

// ---------------------------------------------------------------- the flow map

// The passages of UC-008 the system test walks, each with the tests that walk it; a passage the page does otherwise is a finding, a todo test that fails now and names what the page does instead.
const FLOW_EVIDENCE = {
  "main-1-selects-a-product": { uc: "opens the instance's dashboard and selects a product", evidence: [[SELF, "TST-372202"]] },
  "main-1-lists-with-status": { uc: "lists every use case of that product with its derived status: open, accepted, or changed since acceptance", evidence: [[SELF, "TST-372202"]] },
  "main-2-text-and-diagram": { uc: "The reviewer opens a use case; the dashboard renders its text and Mermaid diagram.", evidence: [[SELF, "TST-372202"]] },
  "main-3-one-click": { uc: "The reviewer presses **Accept** — one click.", evidence: [[SELF, "TST-372203"]] },
  "main-4-record": { uc: "commits `docs/approvals/UC-<nnn>-<sha>.md`, a three-line record, under the reviewer's own account.", evidence: [[SELF, "TST-372203"]] },
  "main-5-accepted": { uc: "The dashboard shows the use case as accepted, because a record now names its current SHA.", evidence: [[SELF, "TST-372203"]] },
  "main-6-names-the-participant": { uc: "by the participant that the page named, with its processing place, beside **Accept**", evidence: [[SELF, "TST-372204"]] },
  "main-6-one-item-per-module": { uc: "add one backlog item for each of them that no item not yet done names, realising the use case (UC-032), under the reviewer's account.", evidence: [[SELF, "TST-372204"]] },
  "1a-private": { uc: "1a. The product repository is private.", evidence: [[SELF, "TST-372205"]] },
  "2a-changed": { uc: "2a. The use case changed since it was last accepted.", evidence: [[SELF, "TST-372206"]] },
  "2a-renamed": { uc: "also when the file was renamed since", evidence: [[SELF, "TST-372206"]] },
  "main-2-opens-a-use-case-from-the-list": { uc: "The reviewer opens a use case;", evidence: [[SELF, "TST-372216"]] },
  "3a-edit": { uc: "3a. The reviewer wants to change the text.", evidence: [[SELF, "TST-372207"]] },
  "3b-no-token": { uc: "3b. No token is stored.", evidence: [[SELF, "TST-372208"]] },
  "3c-gitlab": { uc: "3c. The product is on a GitLab server and no token for it is stored.", evidence: [[SELF, "TST-372209"]] },
  "3d-accept-ticked": { uc: "3d. The reviewer wants to accept several use cases at once.", evidence: [[SELF, "TST-372211"]] },
  "3d-each-not-accepted-has-a-tick-box": { uc: "Each use case not accepted has an empty tick box", evidence: [[SELF, "TST-372212"]] },
  "3e-review-all": { uc: "3e. The reviewer wants to accept every open use case at once.", evidence: [[SELF, "TST-372213"]] },
  "3f-reject": { uc: "3f. The reviewer rejects.", evidence: [[SELF, "TST-372214"]] },
  "4a-no-write-access": { uc: "4a. The reviewer has no write access.", evidence: [[SELF, "TST-372210"]] },
  "5a-edited-after": { uc: "5a. The file is edited after acceptance.", evidence: [[SELF, "TST-372215"]] },
  "post-record-and-prose": { uc: "An approval record names the file and the SHA of the accepted text; the commit names who and when.", evidence: [[SELF, "TST-372203"]] },
};
const FLOW_FINDINGS = {
};

// TST-372201 · level: system · module: system
// guards: UC-008
// given: UC-008 as committed text, the executable tests named in FLOW_EVIDENCE and the findings named in FLOW_FINDINGS
// input: compare every passage of the main flow and of the alternative flows 1a, 2a, 3a, 3b, 3c, 3d, 3e, 3f, 4a and 5a with its executable evidence or its finding
// expect: every named passage stands in UC-008; every evidence file exists and contains its TST id; every finding's test stands in its file with the todo naming the finding; every alternative flow UC-008 names is among the passages
test("TST-372201: UC-008 system coverage names the main flow and every alternative flow", () => {
  const uc = read(UC).replace(/\s+/g, " ");
  for (const [flow, { uc: needle, evidence }] of Object.entries(FLOW_EVIDENCE)) {
    assert.ok(uc.includes(needle.replace(/\s+/g, " ")), `${flow}: UC-008 contains ${needle}`);
    assert.ok(evidence.length > 0, `${flow}: evidence is named`);
    for (const [file, id] of evidence) {
      assert.ok(exists(file), `${flow}: evidence file exists: ${file}`);
      assert.ok(read(file).includes(`// ${id} `), `${flow}: ${file} contains ${id}`);
    }
  }
  for (const [flow, { uc: needle, finding, file, test: id }] of Object.entries(FLOW_FINDINGS)) {
    assert.ok(uc.includes(needle.replace(/\s+/g, " ")), `${flow}: UC-008 contains ${needle}`);
    assert.ok(exists(file), `${flow}: ${file} exists`);
    assert.ok(read(file).includes(`// ${id} `), `${flow}: ${id} stands in ${file}`);
    assert.ok(read(file).includes(`todo: "FINDING ${finding} `), `${flow}: the todo of ${id} names FINDING ${finding}`);
  }
  const named = [...uc.matchAll(/\*\*(\d[a-z])\. /g)].map((m) => m[1]).sort();
  assert.deepEqual(named, ["1a", "2a", "3a", "3b", "3c", "3d", "3e", "3f", "4a", "5a"], "known positive: UC-008 names these ten alternative flows");
  const walked = new Set(Object.keys({ ...FLOW_EVIDENCE, ...FLOW_FINDINGS }).map((key) => key.slice(0, 2)));
  assert.deepEqual(named.filter((flow) => !walked.has(flow)), [], "each alternative flow is among the passages");
});

// ---------------------------------------------------------------- steps 1 and 2

// TST-372202 · level: system · module: system
// guards: UC-008; STATUS IS DERIVED FROM THE RECORDS; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK
// given: the instance's dashboard with a product alice/thesis-tool whose default branch holds four use cases — UC-041 and UC-044 with no approval record, UC-042 with a record naming its current text, UC-043 with a record naming an earlier text, UC-041 with a Mermaid diagram; the reviewer's token for the product is stored
// input: the reviewer opens the dashboard on the use cases of no product, chooses the product in the product selector, and opens UC-041
// expect: before the choice the list holds no use case of the product; after it the address names the product and the list holds UC-041, UC-042, UC-043 and UC-044, their statuses open, accepted, changed since acceptance and open; UC-041's page names its identifier and title, prints its prose, hands its diagram to the renderer, prints the first twelve characters of the blob of the text shown and offers one Accept; nothing is written by any of it
test("TST-372202: UC-008 1 and 2 the reviewer chooses a product, reads every use case with its derived status, and opens one with its text and diagram", async () => {
  const w = await world();
  const page = await w.open("#use-case");
  assert.deepEqual(idsIn(page.target), [], "before the choice: the instance's own use cases, which the fixture instance does not hold");
  page.select.value = w.address;
  page.select.dispatchEvent(new Event("change"));
  await w.quiet();
  assert.match(page.location.hash, new RegExp(`product=${encodeURIComponent(w.address).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`), "the address names the product");
  assert.deepEqual([...new Set(idsIn(page.target))].sort(), ["UC-041", "UC-042", "UC-043", "UC-044"]);
  assert.deepEqual(["UC-041", "UC-042", "UC-043", "UC-044"].map((id) => badgeOf(rowOf(page.target, id))), ["open", "accepted", "changed since acceptance", "open"]);
  await page.go(`#use-case/id=UC-041/product=${encodeURIComponent(w.address)}`);
  assert.match(find(page.target, (node) => node.localName === "h2")[0].textContent, /^UC-041 Check out a book/, "identifier and title");
  assert.equal(badgeOf(page.target), "open");
  assert.match(pageText(page.target), /The member borrows a book at the desk\./, "its prose");
  assert.match(byClass(page.target, "div", "unrendered")[0]?.textContent ?? "", /sequenceDiagram/, "its diagram is handed to the renderer");
  assert.ok(pageText(page.target).includes(`Text shown: blob ${blobOf(UC41).slice(0, 12)}`), "the blob of the text shown");
  assert.equal(buttonsNamed(page.target, "Accept").length, 1, "one Accept");
  assert.deepEqual(w.writers(), [], "nothing is written");
  assert.deepEqual(w.outside, [], "no request left the fixtures");
});

// ---------------------------------------------------------------- steps 3 to 5

// TST-372203 · level: system · module: system
// guards: UC-008; AN APPROVAL NAMES THE EXACT TEXT; ACCEPTANCE IS A COMMIT BY THE ACCEPTING PERSON; ONE CLICK PER DECISION; STATUS IS DERIVED FROM THE RECORDS; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK
// given: the product of TST-372202 on the dashboard's page of UC-041, open; the reviewer's token for the product, named "github.com/alice", and the instance's own token, both stored; known negative first — a click a script makes on Accept
// input: a script clicks Accept; then the reviewer clicks Accept once; the page of UC-041 and the list are read afterwards
// expect: the script's click writes nothing; the reviewer's click makes exactly one commit on the default branch, on the head the page was drawn from, of exactly one file docs/approvals/UC-041-<first twelve characters of the blob>.md of the three lines kind: use-case, file: docs/use-cases/UC-041-check-out-a-book.md and blob: <the blob of the text shown>; the commit's message names the person the token is stored under ("Accepted by github.com/alice") and UC-041; every request that writes carries the product's token and none the instance's; the page then shows UC-041 as accepted with no Accept, and names the commit; opened again the list shows UC-041 accepted and the other three as before
test("TST-372203: UC-008 3 to 5 one click on Accept commits the three-line record that names the blob shown, under the reviewer's own token, and the use case is accepted", async () => {
  const w = await world();
  const page = await w.open(`#use-case/id=UC-041/product=${encodeURIComponent(w.address)}`);
  const head = w.head();
  const accept = buttonsNamed(page.target, "Accept")[0];
  accept.dispatchEvent(scripted());
  await w.quiet();
  assert.deepEqual(w.writes(), [], "known negative: a click a script makes writes nothing");
  assert.equal(badgeOf(page.target), "open");
  click(accept);
  await until(() => w.writes().length === 1, "the commit");
  await until(() => badgeOf(page.target) === "accepted", "the page shows UC-041 accepted");
  const [write, ...more] = w.writes();
  assert.equal(more.length, 0, "one click, one commit");
  const [name, body] = record("UC-041", P41, UC41);
  assert.deepEqual(write.files, { [name]: body }, "exactly the record that names the blob shown");
  assert.equal(body, `kind: use-case\nfile: ${P41}\nblob: ${blobOf(UC41)}\n`, "three lines");
  assert.match(write.message, /Accepted by github\.com\/alice/, "the commit names the person");
  assert.match(write.message, /UC-041/);
  assert.notEqual(w.head(), head, "the default branch moved on by that commit");
  assert.deepEqual([...new Set(w.writers().map((request) => request.authorization))], [`Bearer ${TOKENS.github.value}`], "every write carries the reviewer's token for the product, none the instance's");
  assert.equal(buttonsNamed(page.target, "Accept").length, 0, "no Accept any more");
  assert.ok(pageText(page.target).includes("Accepted in commit"), "the commit is named");
  const again = await w.open();
  assert.deepEqual(["UC-041", "UC-042", "UC-043", "UC-044"].map((id) => badgeOf(rowOf(again.target, id))), ["accepted", "accepted", "changed since acceptance", "open"]);
});

// ---------------------------------------------------------------- step 6

const ITEMS = [{ module: "MOD-reader", realises: "UC-041" }, { module: "MOD-shelf", realises: "UC-041" }];
const accepted = async (page) => {
  await until(() => byClass(page.target, "p", "result").some((node) => node.textContent.startsWith("Accepted in commit")), "the acceptance");
  await until(() => byClass(page.target, "p", "affected-result").length > 0, "the check of the modules");
};

// TST-372204 · level: system · module: system
// guards: UC-008; ACCEPTING A USE CASE PUTS THE MODULES IT CHANGES INTO THE BACKLOG; THE PAGE NAMES WHERE IT SENDS; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK; ACCEPTANCE IS A COMMIT BY THE ACCEPTING PERSON
// given: a product whose docs/process.md declares Scrum, a model that pulls its work from a backlog, with the architecture MOD-reader and MOD-shelf and an item ITM-001 not yet done that names MOD-shelf; the register's participant drafter-a, a model endpoint at "this machine", whose answer for UC-041 is an item for MOD-reader and one for MOD-shelf; a second product, declaring the V-model, a planned one; known positive first — the page of UC-041 with Accept
// input: the page of UC-041 is drawn and read; the reviewer clicks Accept once; the same in the planned product
// expect: known positive — Accept is offered; before the click one note beside Accept names drafter-a and the place "this machine", and the endpoint was not asked and nothing was written; after it the first commit is UC-041's record alone, then a commit queues the check's job record, then one commit holds exactly one new item, realising UC-041 and naming MOD-reader and not MOD-shelf, because ITM-001 is not done, its message naming the participant drafter-a that the page named; every request that writes carries the product's token and none the instance's; the endpoint was asked; in the planned product the click writes the record alone, names no participant, and asks no endpoint
test("TST-372204: UC-008 6 in a model that pulls its work from a backlog the same click has the named participant check the modules and adds an item for each that no item not yet done names", async () => {
  const w = await world({ model: "scrum", answers: ITEMS, files: { "docs/backlog/ITM-001-shelve-books.md": backlogItem("ITM-001", "MOD-shelf") } });
  const page = await w.open(`#use-case/id=UC-041/product=${encodeURIComponent(w.address)}`);
  assert.equal(buttonsNamed(page.target, "Accept").length, 1, "known positive: Accept is offered");
  const note = byClass(page.target, "p", "affected-check");
  assert.equal(note.length, 1, "one note beside Accept");
  assert.deepEqual([byClass(note[0], "span", "participant").map((each) => each.textContent), byClass(note[0], "span", "place").map((each) => each.textContent)], [["drafter-a"], ["this machine"]]);
  assert.equal(w.asked.endpoint, 0, "the endpoint is not asked before the click");
  assert.deepEqual(w.writes(), [], "nothing is written before the click");
  click(buttonsNamed(page.target, "Accept")[0]);
  await accepted(page);
  const commits = w.writes();
  assert.deepEqual(Object.keys(commits[0].files), [record("UC-041", P41, UC41)[0]], "the first commit is UC-041's record alone");
  assert.match(commits[1].message, /^Queue job JOB-/, "then the job's record is queued");
  const items = commits.flatMap((commit) => Object.entries(commit.files).filter(([path]) => path.startsWith("docs/backlog/ITM-")).map(([path, body]) => ({ path, body, message: commit.message })));
  assert.equal(items.length, 1, `one new item: ${JSON.stringify(commits.map((commit) => Object.keys(commit.files)))}`);
  assert.deepEqual([listOf(items[0].body, "realises"), listOf(items[0].body, "modules")], [["UC-041"], ["MOD-reader"]], "an item for MOD-reader, realising UC-041; none for MOD-shelf, which ITM-001 names");
  assert.match(items[0].message, /Agent-M-Participant: drafter-a/, "the participant the page named checked");
  assert.ok(commits.findIndex((commit) => Object.keys(commit.files).includes(items[0].path)) > 0, "the item is committed after the record's commit");
  assert.ok(w.asked.endpoint > 0, "the endpoint was asked");
  assert.deepEqual([...new Set(w.writers().map((request) => request.authorization))], [`Bearer ${TOKENS.github.value}`], "every write carries the reviewer's token for the product, none the instance's");
  const finished = await world({ model: "scrum", answers: ITEMS, files: { "docs/backlog/ITM-001-shelve-books.md": backlogItem("ITM-001", "MOD-shelf") }, pulls: [mergedPull("ITM-001", 7)] });
  const done = await finished.open(`#use-case/id=UC-041/product=${encodeURIComponent(finished.address)}`);
  click(buttonsNamed(done.target, "Accept")[0]);
  await accepted(done);
  const newModules = finished.writes().flatMap((commit) => Object.entries(commit.files).filter(([path]) => /^docs\/backlog\/ITM-00[2-9]/.test(path)).map(([, body]) => listOf(body, "modules")[0])).sort();
  assert.deepEqual(newModules, ["MOD-reader", "MOD-shelf"], "counter-proof: once ITM-001 is done, MOD-shelf gets an item too");
  const planned = await world({ model: "v-model", answers: ITEMS });
  const flat = await planned.open(`#use-case/id=UC-041/product=${encodeURIComponent(planned.address)}`);
  assert.equal(buttonsNamed(flat.target, "Accept").length, 1, "known positive: Accept is offered in the planned product");
  assert.equal(byClass(flat.target, "p", "affected-check").length, 0, "no participant is named");
  click(buttonsNamed(flat.target, "Accept")[0]);
  await until(() => planned.writes().length === 1, "the planned product's commit");
  await w.quiet();
  assert.deepEqual(planned.writes().map((commit) => Object.keys(commit.files)), [[record("UC-041", P41, UC41)[0]]], "the record alone");
  assert.equal(planned.asked.endpoint, 0, "no endpoint is asked");
});

// ---------------------------------------------------------------- 1a

// TST-372205 · level: system · module: system
// guards: UC-008; CONFIGURATION LIVES IN THE BROWSER
// given: a private product on GitHub, which answers a request without its token, and a request with a token that does not reach it, as GitHub answers a private repository (404); the product's token stored in one world, none in another, another account's token in a third; known positive first — with the product's own token the list holds the four use cases
// input: the reviewer opens the use cases of the product in each world
// expect: known positive — with the token that reaches the repository the four use cases are listed; with none the page says that the repository is private or does not exist and that this browser stores no token that reaches it, links the step that stores the token, and lists no use case; with a token that does not reach it nothing is listed either and the page does not print any text of the product
test("TST-372205: UC-008 1a a private product is read with the token this browser stores, and without a token that reaches it the page says so and shows nothing", async () => {
  const reached = await world({ private: TOKENS.github.value });
  const known = await reached.open();
  assert.deepEqual([...new Set(idsIn(known.target))].sort(), ["UC-041", "UC-042", "UC-043", "UC-044"], "known positive: the token that reaches the repository reads it");
  const none = await world({ private: TOKENS.github.value, token: false });
  const without = await none.open();
  assert.deepEqual(idsIn(without.target), [], "no use case is listed");
  assert.match(pageText(without.target), /This repository is private or does not exist, and this browser stores no token that reaches it\./);
  assert.ok(linksOf(without.target).some((link) => /^#add/.test(link.getAttribute("href") ?? "")), "the step that stores the token is linked");
  assert.ok(!/Check out a book|Extend a loan/.test(pageText(without.target)), "no text of the product is shown");
  const other = await world({ private: "github_pat_ANOTHERaccount0123456789abcdef" });
  const wrong = await other.open();
  assert.deepEqual(idsIn(wrong.target), [], "a token that does not reach it lists no use case");
  assert.ok(!/Check out a book|Extend a loan/.test(pageText(wrong.target)), "and shows no text of the product");
});

// ---------------------------------------------------------------- 2a

// TST-372206 · level: system · module: system
// guards: UC-008; A CHANGED FILE IS SHOWN AGAINST ITS LAST ACCEPTED TEXT; STATUS IS DERIVED FROM THE RECORDS
// given: UC-043 changed since its last acceptance, whose record names the earlier sentence "returns a book at the desk"; a second product in which UC-043 was renamed to docs/use-cases/UC-043-give-back-a-book.md and changed since, its record still naming the old path; UC-042, accepted, as a counter-proof
// input: the reviewer opens UC-043 in each product, and UC-042
// expect: UC-043's page headed "Changed since it was last accepted" shows above its text the difference, the earlier sentence marked removed and the new one added, and one Accept; in the product where it was renamed the difference is shown against the text the record names at the old path, the earlier sentence removed and the renamed file's sentence added; UC-042 shows no difference
test("TST-372206: UC-008 2a a use case changed since it was accepted is shown as the difference to the text its most recent record names, also after a rename", async () => {
  const w = await world();
  const page = await w.open(`#use-case/id=UC-043/product=${encodeURIComponent(w.address)}`);
  const diff = byClass(page.target, "section", "accepted-diff")[0];
  assert.ok(diff, "a difference");
  assert.match(diff.textContent, /Changed since it was last accepted/);
  const shown = byClass(diff, "pre", "diff")[0].textContent;
  assert.match(shown, /- \*\*Goal\.\*\* The member returns a book at the desk\./, "the earlier sentence removed");
  assert.match(shown, /\+ \*\*Goal\.\*\* The member returns a book and the card at the desk\./, "the new sentence added");
  assert.ok(pageText(page.target).indexOf("Changed since it was last accepted") < pageText(page.target).indexOf("The file as it will be accepted"), "above the text");
  assert.equal(buttonsNamed(page.target, "Accept").length, 1);
  const renamed = await world({ files: { [P43]: null, "docs/use-cases/UC-043-give-back-a-book.md": UC43_OLD.replace("returns a book at the desk", "gives back a book at the desk") } });
  const moved = await renamed.open(`#use-case/id=UC-043/product=${encodeURIComponent(renamed.address)}`);
  assert.equal(badgeOf(moved.target), "changed since acceptance", "the renamed file keeps its identity");
  const renamedDiff = byClass(moved.target, "pre", "diff")[0].textContent;
  assert.match(renamedDiff, /- \*\*Goal\.\*\* The member returns a book at the desk\./, "the text the record names, at the old path");
  assert.match(renamedDiff, /\+ \*\*Goal\.\*\* The member gives back a book at the desk\./);
  await page.go(`#use-case/id=UC-042/product=${encodeURIComponent(w.address)}`);
  assert.equal(byClass(page.target, "section", "accepted-diff").length, 0, "counter-proof: an accepted use case shows no difference");
});

// ---------------------------------------------------------------- 3a

// TST-372207 · level: system · module: system
// guards: UC-008; EDITS ARE PREPARED ON THE DASHBOARD; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK; ACCEPTANCE IS A COMMIT BY THE ACCEPTING PERSON
// given: UC-041, open, on the dashboard's page; the reviewer's token for the product
// input: the reviewer follows Edit, changes "at the desk." to "at the desk, with a receipt.", a script clicks Save, the reviewer clicks Save; then the reviewer clicks Accept on the page that follows
// expect: the editor holds the file byte for byte, with a live preview; the script's click writes nothing; the reviewer's Save makes one commit of exactly docs/use-cases/UC-041-check-out-a-book.md with the edited text and no record, with the product's token; the use case is shown again from step 2: open, its prose with the receipt, one Accept, and the blob of the new text; Accept then records the new blob, not the old
test("TST-372207: UC-008 3a the reviewer edits the text with a live preview, Save commits it under their account, and the use case is shown again with its new SHA", async () => {
  const w = await world();
  const page = await w.open(`#use-case/id=UC-041/product=${encodeURIComponent(w.address)}`);
  const edit = byClass(page.target, "a", "edit-link")[0];
  await page.go(withProduct(edit.getAttribute("href"), w.address));
  const area = areaOf(page.target);
  assert.equal(area.value, UC41, "the editor holds the use case byte for byte");
  assert.ok(byClass(page.target, "ol", "marks").length > 0 || find(page.target, (node) => /preview/i.test(node.className ?? "")).length > 0, "marks and a live preview stand beside the text");
  const edited = UC41.replace("borrows a book at the desk.", "borrows a book at the desk, with a receipt.");
  typeInto(area, edited);
  saveButton(page.target).dispatchEvent(scripted());
  await w.quiet();
  assert.deepEqual(w.writes(), [], "a click a script makes writes nothing");
  click(saveButton(page.target));
  await until(() => w.writes().length === 1, "the save");
  const [{ files }] = w.writes();
  assert.deepEqual(files, { [P41]: edited }, "the use case alone, with the edited text, and no approval record");
  assert.deepEqual([...new Set(w.writers().map((request) => request.authorization))], [`Bearer ${TOKENS.github.value}`]);
  await until(() => areaOf(page.target) === undefined && pageText(page.target).includes("with a receipt"), "the use case shown again");
  assert.equal(badgeOf(page.target), "open");
  assert.ok(pageText(page.target).includes(`Text shown: blob ${blobOf(edited).slice(0, 12)}`), "the blob of the new text");
  click(buttonsNamed(page.target, "Accept")[0]);
  await until(() => w.writes().length === 2, "the acceptance");
  assert.deepEqual(Object.keys(w.writes()[1].files), [record("UC-041", P41, edited)[0]], "the record names the new text");
});

// ---------------------------------------------------------------- 3b

// TST-372208 · level: system · module: system
// guards: UC-008; WITHOUT A TOKEN, GITHUB'S WEB INTERFACE IS THE FALLBACK; NO TEXT TRAVELS IN A URL; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK
// given: the product of TST-372202 on GitHub, with no token of its own stored in this browser (the instance's token is stored, and is none for this product); a clipboard and a window that record what they are given
// input: the reviewer opens UC-041; follows Edit, changes the text and clicks Save
// expect: no Accept; a link to GitHub's new-file page of the repository whose address holds the record's path as `filename` and the record as `value` and nothing else — no word of the use case —, and beside it the exact path and the record, each with a copy button; Save writes nothing and puts the edited text on the clipboard and opens GitHub's editor for the file with no text in the address; no commit is made and no request that writes is sent
test("TST-372208: UC-008 3b without a token Accept is GitHub's new-file page prefilled with the record, with the path and the record to copy, and editing opens GitHub's editor with the text on the clipboard", async () => {
  const w = await world({ token: false });
  const page = await w.open(`#use-case/id=UC-041/product=${encodeURIComponent(w.address)}`);
  assert.equal(buttonsNamed(page.target, "Accept").length, 0, "no Accept");
  const link = byClass(page.target, "a", "github-page")[0];
  assert.ok(link, "a link to GitHub's page");
  const url = new URL(link.getAttribute("href")), [recordPath, recordText] = record("UC-041", P41, UC41);
  assert.equal(url.origin + url.pathname, "https://github.com/alice/thesis-tool/new/main");
  assert.deepEqual([...url.searchParams.keys()].sort(), ["filename", "value"], "the path and the record, nothing else");
  assert.equal(url.searchParams.get("filename"), recordPath);
  assert.equal(url.searchParams.get("value"), recordText);
  for (const part of ["borrows a book", "Goal.", "Check out a book", "sequenceDiagram"]) assert.ok(!decodeURIComponent(link.getAttribute("href")).includes(part), `the address holds no "${part}"`);
  assert.equal(byClass(page.target, "code", "record-path")[0]?.textContent, recordPath, "the exact path");
  assert.equal(byClass(page.target, "pre", "record")[0]?.textContent, recordText, "the record");
  assert.ok(byClass(page.target, "button", "copy").length >= 2, "a copy button for the path and one for the record");
  await page.go(withProduct(byClass(page.target, "a", "edit-link")[0].getAttribute("href"), w.address));
  const edited = UC41.replace("borrows a book at the desk.", "borrows a book at the desk, with a receipt.");
  typeInto(areaOf(page.target), edited);
  const asked = { clipboard: [], opened: [] };
  Object.defineProperty(globalThis, "navigator", { value: { clipboard: { writeText: async (written) => { asked.clipboard.push(written); } } }, configurable: true, writable: true });
  globalThis.open = (address) => { asked.opened.push(address); return null; };
  click(saveButton(page.target));
  await until(() => asked.opened.length === 1, "GitHub's editor");
  assert.deepEqual(asked.clipboard, [edited], "the edited text is on the clipboard");
  assert.deepEqual(asked.opened, [`https://github.com/alice/thesis-tool/edit/main/${P41}`], "GitHub's editor, with only the path in the address");
  assert.deepEqual(w.writes(), [], "the dashboard commits nothing");
  assert.deepEqual(w.writers(), [], "and sends no write");
});

// ---------------------------------------------------------------- 3c

// TST-372209 · level: system · module: system
// guards: UC-008; A GITLAB PRODUCT IS WRITTEN WITH A TOKEN; WITHOUT A TOKEN, GITHUB'S WEB INTERFACE IS THE FALLBACK
// given: a product on a GitLab server, gitlab.example.org/team/product, with the same four use cases; no token for the project stored in one world (the instance's GitHub token is stored, and is none for a GitLab server), the project's token in another
// input: the reviewer opens the list and UC-041 in each, and in the second clicks Accept
// expect: without the token the use case is read and shown; there is no Accept, no tick, no Accept ticked and no Edit, no link to a GitHub page, and a link to the step that stores the project's token, #add with the product's address; nothing is written; with the token Accept is offered and one click makes one commit on the GitLab server, of the record that names the blob shown, which carries the project's token and no GitHub token
test("TST-372209: UC-008 3c a GitLab product without a token is read and offers no Accept or Save but a link to the token's step, and with the token it is written", async () => {
  const w = await world({ server: "gitlab", token: false });
  const page = await w.open(`#use-case/id=UC-041/product=${encodeURIComponent(w.address)}`);
  assert.match(pageText(page.target), /The member borrows a book at the desk\./, "the use case is read and shown");
  assert.equal(buttonsNamed(page.target, "Accept").length, 0, "no Accept");
  assert.equal(byClass(page.target, "a", "edit-link").length, 0, "no way to save");
  assert.equal(linksOf(page.target).filter((link) => /github\.com/.test(link.getAttribute("href") ?? "")).length, 0, "no GitHub page");
  assert.deepEqual(linksOf(page.target).filter((link) => /^#add/.test(link.getAttribute("href") ?? "")).map((link) => link.getAttribute("href")), [`#add/${encodeURIComponent(w.address)}`], "the step that stores the project's token");
  await page.go(`#use-case/product=${encodeURIComponent(w.address)}`);
  assert.equal(find(page.target, (node) => node.localName === "input").length + byClass(page.target, "button", "accept-ticked").length, 0, "no tick, no Accept ticked");
  assert.deepEqual(w.writes(), [], "nothing is written");
  const signed = await world({ server: "gitlab" });
  const own = await signed.open(`#use-case/id=UC-041/product=${encodeURIComponent(signed.address)}`);
  click(buttonsNamed(own.target, "Accept")[0]);
  await until(() => signed.writes().length === 1, "the commit on the GitLab server");
  assert.deepEqual(signed.writes()[0].files, Object.fromEntries([record("UC-041", P41, UC41)]), "the record that names the blob shown");
  assert.deepEqual([...new Set(signed.writers().map((request) => request.authorization))], [TOKENS.gitlab.value], "the project's token, and no GitHub token");
});

// ---------------------------------------------------------------- 4a

// TST-372210 · level: system · module: system
// guards: UC-008; ACCEPTANCE IS A COMMIT BY THE ACCEPTING PERSON; WITHOUT A TOKEN, GITHUB'S WEB INTERFACE IS THE FALLBACK
// given: a token stored that may not write to the repository: the server refuses every write 403; known positive first — the same page where the server accepts the write
// input: the reviewer clicks Accept on UC-041
// expect: known positive — where writes are accepted the click makes one commit; where they are refused the page says in the host's words that the token may not write to the repository, offers GitHub's new-file page with the record's path and the record and nothing else, nothing is committed, and UC-041 is still open
test("TST-372210: UC-008 4a a reviewer without write access is told so and offered the GitHub path, and nothing is committed", async () => {
  const open = await world();
  const known = await open.open(`#use-case/id=UC-041/product=${encodeURIComponent(open.address)}`);
  click(buttonsNamed(known.target, "Accept")[0]);
  await until(() => open.writes().length === 1, "known positive: the commit");
  const w = await world({ denyWrites: true });
  const page = await w.open(`#use-case/id=UC-041/product=${encodeURIComponent(w.address)}`);
  click(buttonsNamed(page.target, "Accept")[0]);
  await until(() => byClass(page.target, "a", "github-page").length === 1, "the GitHub path");
  assert.match(byClass(page.target, "p", "result")[0].textContent, /may not write to https:\/\/github\.com\/alice\/thesis-tool/, "the refusal in the host's words");
  const url = new URL(byClass(page.target, "a", "github-page")[0].getAttribute("href")), [recordPath, recordText] = record("UC-041", P41, UC41);
  assert.equal(url.origin + url.pathname, "https://github.com/alice/thesis-tool/new/main");
  assert.deepEqual([url.searchParams.get("filename"), url.searchParams.get("value"), [...url.searchParams.keys()].length], [recordPath, recordText, 2]);
  assert.deepEqual(w.writes(), [], "nothing is committed");
  assert.equal(badgeOf(page.target), "open", "still open");
});

// ---------------------------------------------------------------- 3d

// TST-372211 · level: system · module: system
// guards: UC-008; SEVERAL FILES ARE ACCEPTED IN ONE CLICK; AN APPROVAL NAMES THE EXACT TEXT; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK
// given: the reviewer's token; the pages of UC-041, UC-043 and UC-044 opened, then the list of the four use cases; UC-041, UC-043 and UC-044 ticked and UC-043 unticked again; then another writer's commit changed UC-044 on the default branch; known negative first — Accept ticked is not pressable with nothing ticked
// input: a script clicks Accept ticked; the reviewer clicks it
// expect: known negative — with nothing ticked Accept ticked is disabled, and it reads (2) with two ticked; the script's click writes nothing; the reviewer's click makes one commit of exactly one record, UC-041's, naming the blob that was shown, and none for UC-043, which was unticked; UC-044 is left out and named with the reason that it changed since it was shown, and is still open; UC-041 is accepted
test("TST-372211: UC-008 3d Accept ticked writes one commit with one record per ticked use case, each naming the text shown, and a use case changed after it was shown is left out and named", async () => {
  const w = await world();
  const page = await w.open();
  for (const id of ["UC-041", "UC-043", "UC-044"]) await page.go(`#use-case/id=${id}/product=${encodeURIComponent(w.address)}`);
  await page.go(`#use-case/product=${encodeURIComponent(w.address)}`);
  const bar = () => byClass(page.target, "button", "accept-ticked")[0];
  assert.equal(bar().disabled, true, "known negative: nothing ticked, not pressable");
  tick(tickOf(page.target, "UC-043")); tick(tickOf(page.target, "UC-043"), false);
  tick(tickOf(page.target, "UC-041")); tick(tickOf(page.target, "UC-044"));
  assert.match(bar().textContent, /\(2\)/, "two ticked");
  await w.land({ [P44]: UC44_EDITED });
  bar().dispatchEvent(scripted());
  await w.quiet();
  assert.equal(w.writes().length, 0, "a click a script makes writes nothing");
  click(bar());
  await until(() => w.writes().length === 1, "the commit");
  assert.deepEqual(w.writes()[0].files, Object.fromEntries([record("UC-041", P41, UC41)]), "one record, UC-041's, naming the blob shown");
  await until(() => badgeOf(rowOf(page.target, "UC-041")) === "accepted", "UC-041 accepted");
  assert.match(pageText(page.target), /UC-044 was left out: changed since shown/, "UC-044 is left out and named with the reason");
  assert.equal(badgeOf(rowOf(page.target, "UC-044")), "open", "and still open");
});

// TST-372212 · level: system · module: system
// guards: UC-008; SEVERAL FILES ARE ACCEPTED IN ONE CLICK
// given: the four use cases with the reviewer's token; the reviewer has opened the page of UC-041 and no other use case's page; known positive first — the page of UC-041 was drawn
// input: the reviewer opens the list
// expect: known positive — UC-041 has a tick; UC-043 and UC-044, not opened, have one too: every use case not accepted has a tick box (akmaier, 2026-11-01)
test("TST-372212: UC-008 3d every use case not accepted has a tick box, read or not", async () => {
  const w = await world();
  const page = await w.open(`#use-case/id=UC-041/product=${encodeURIComponent(w.address)}`);
  assert.equal(badgeOf(page.target), "open", "known positive: UC-041's page was drawn");
  await page.go(`#use-case/product=${encodeURIComponent(w.address)}`);
  assert.equal(byClass(rowOf(page.target, "UC-041"), "input", "tick").length, 1, "known positive: the use case read has a tick");
  assert.deepEqual(["UC-043", "UC-044"].filter((id) => byClass(rowOf(page.target, id), "input", "tick").length > 0), ["UC-043", "UC-044"], "a use case not read has one too");
});

// ---------------------------------------------------------------- 3e

// TST-372213 · level: system · module: system
// guards: UC-008; SEVERAL FILES ARE ACCEPTED IN ONE CLICK; A CHANGED FILE IS SHOWN AGAINST ITS LAST ACCEPTED TEXT; AN APPROVAL NAMES THE EXACT TEXT
// given: the four use cases with the reviewer's token: UC-041 and UC-044 new, UC-043 changed, UC-042 accepted; then another writer's commit changed UC-044 on the default branch
// input: the reviewer opens Review all; reads the page; clicks Accept all 3 shown
// expect: UC-041, UC-043 and UC-044 stand on one page in sequence, not UC-042; UC-043 as its difference to the last accepted text, UC-041 and UC-044 in full; the button reads Accept all 3 shown; the click makes one commit of one record each for UC-041 and UC-043, naming the blobs shown, and none for UC-044, which changed after the page was built, left out and named; UC-041 and UC-043 are accepted afterwards and UC-044 is still open
test("TST-372213: UC-008 3e Review all shows every open or changed use case in sequence, and Accept all N shown writes one commit with one record each, leaving out and naming one that changed", async () => {
  const w = await world();
  const page = await w.open(`#use-case/id=all/product=${encodeURIComponent(w.address)}`);
  const sections = byClass(page.target, "section", "review-file");
  assert.deepEqual(sections.map((section) => section.getAttribute("data-id")), ["UC-041", "UC-043", "UC-044"], "in sequence, the accepted one not shown");
  assert.equal(byClass(sections[1], "section", "accepted-diff").length, 1, "a changed one as its difference");
  assert.match(byClass(sections[1], "pre", "diff")[0].textContent, /\+ \*\*Goal\.\*\* The member returns a book and the card at the desk\./);
  assert.equal(byClass(sections[0], "section", "accepted-diff").length + byClass(sections[2], "section", "accepted-diff").length, 0, "a new one in full");
  assert.match(sections[0].textContent, /The member borrows a book at the desk\./);
  assert.equal(buttonsNamed(page.target, "Accept all 3 shown").length, 1);
  await w.land({ [P44]: UC44_EDITED });
  click(buttonsNamed(page.target, "Accept all 3 shown")[0]);
  await until(() => w.writes().length === 1, "the commit");
  assert.deepEqual(w.writes()[0].files, Object.fromEntries([record("UC-041", P41, UC41), record("UC-043", P43, UC43)]), "one record each for UC-041 and UC-043, naming the blobs shown");
  await until(() => /UC-044 was left out/.test(pageText(page.target)), "UC-044 named");
  assert.match(pageText(page.target), /UC-044 was left out: changed since shown/);
  const list = await w.open();
  assert.deepEqual(["UC-041", "UC-042", "UC-043", "UC-044"].map((id) => badgeOf(rowOf(list.target, id))), ["accepted", "accepted", "accepted", "open"]);
});

// ---------------------------------------------------------------- 3f

// TST-372214 · level: system · module: system
// guards: UC-008; A PROPOSAL IS REJECTED WITH A REASON; A REJECTION REMOVES THE PROPOSAL; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK
// given: the product of TST-372202: UC-043 changed since its last acceptance, UC-041 never accepted; the reviewer's token
// input: on UC-043 the reviewer clicks Reject with the field empty, then types "the card is out of scope" and clicks Reject; then on UC-041 types "not wanted" and clicks Reject
// expect: Reject with no reason writes nothing and says so; the rejection of UC-043 is one commit of the file docs/use-cases/UC-043-return-a-book.md alone, with the text its most recent record names and no record, whose message holds the reason, and UC-043 is then shown as accepted; the rejection of UC-041, which no record names, is one commit that deletes docs/use-cases/UC-041-check-out-a-book.md and writes nothing else, its message holding "not wanted", and UC-041 is no longer listed
test("TST-372214: UC-008 3f Reject needs a reason and restores the text the most recent record names, or removes a use case no record names, in one commit", async () => {
  const w = await world();
  const page = await w.open(`#use-case/id=UC-043/product=${encodeURIComponent(w.address)}`);
  click(byClass(page.target, "button", "reject")[0]);
  await w.quiet();
  assert.deepEqual(w.writes(), [], "Reject with no reason writes nothing");
  assert.match(pageText(page.target), /Type the reason for rejecting first: nothing was written\./);
  reasonField(page.target).value = "the card is out of scope";
  click(byClass(page.target, "button", "reject")[0]);
  await until(() => w.writes().length === 1, "the rejection of UC-043");
  assert.deepEqual(w.writes()[0].files, { [P43]: UC43_OLD }, "the text its most recent record names, alone, and no record");
  assert.match(w.writes()[0].message, /the card is out of scope/, "the reason is in the message");
  await until(() => badgeOf(page.target) === "accepted", "UC-043 shown as accepted");
  await page.go(`#use-case/id=UC-041/product=${encodeURIComponent(w.address)}`);
  reasonField(page.target).value = "not wanted";
  click(byClass(page.target, "button", "reject")[0]);
  await until(() => w.writes().length === 2, "the rejection of UC-041");
  const removal = w.writes()[1];
  assert.deepEqual([Object.keys(removal.files), removal.deleted ?? []], [[], [P41]], "one commit that deletes the file and writes nothing else");
  assert.match(removal.message, /not wanted/);
  await page.go(`#use-case/product=${encodeURIComponent(w.address)}`);
  assert.ok(!idsIn(page.target).includes("UC-041"), "UC-041 is no longer listed");
});

// ---------------------------------------------------------------- 5a

// TST-372215 · level: system · module: system
// guards: UC-008; STATUS IS DERIVED FROM THE RECORDS
// given: UC-042 accepted by a record that names its current text; a second product in which the same file was edited after the record was committed ("twice" for "once") and whose records are the same files; known positive first
// input: the reviewer opens the list in each, and the page of UC-042 in the second
// expect: known positive — in the first UC-042 is accepted; in the second the list and the page show it as changed since acceptance, the page with the difference to the accepted text and one Accept; the records of the two products are the same files with the same texts, nothing has reset a status, and the page wrote nothing
test("TST-372215: UC-008 5a a file edited after acceptance is shown as changed since acceptance without anyone resetting a status", async () => {
  const first = await world();
  const before = await first.open();
  assert.equal(badgeOf(rowOf(before.target, "UC-042")), "accepted", "known positive: UC-042 is accepted");
  const edited = UC42.replace("extends a loan once.", "extends a loan twice.");
  const second = await world({ files: { [P42]: edited }, history: [UC42] });
  const list = await second.open();
  assert.equal(badgeOf(rowOf(list.target, "UC-042")), "changed since acceptance");
  await list.go(`#use-case/id=UC-042/product=${encodeURIComponent(second.address)}`);
  assert.equal(badgeOf(list.target), "changed since acceptance");
  assert.match(byClass(list.target, "pre", "diff")[0].textContent, /- \*\*Goal\.\*\* The member extends a loan once\./);
  assert.equal(buttonsNamed(list.target, "Accept").length, 1);
  const recordsOf = (w) => Object.fromEntries(Object.entries(w.files()).filter(([path]) => path.startsWith("docs/approvals/")));
  assert.deepEqual(recordsOf(second), recordsOf(first), "the same records: nothing was reset");
  assert.deepEqual(second.writers(), [], "the page wrote nothing");
});

// TST-372216 · level: system · module: system
// guards: UC-008
// given: the instance's dashboard with the product chosen, on the list of its use cases, which links each use case to its page
// input: the reviewer follows the link of UC-043 as the browser does, by setting the address to the link's own
// expect: known positive — the list has a link for UC-043; UC-008 step 2 says the reviewer opens a use case of that product: the page shows UC-043 of the product, "Return a book", with its difference to the last accepted text
test("TST-372216: UC-008 2 a use case is opened from the list of the product chosen", async () => {
  const w = await world();
  const page = await w.open();
  const link = find(rowOf(page.target, "UC-043"), (node) => node.localName === "a")[0];
  assert.ok(link, "known positive: the list links UC-043");
  await page.go(link.getAttribute("href"));
  assert.match(find(page.target, (node) => node.localName === "h2")[0]?.textContent ?? "", /^UC-043 Return a book/, "the page of UC-043 of the product");
  assert.equal(byClass(page.target, "section", "accepted-diff").length, 1);
});
