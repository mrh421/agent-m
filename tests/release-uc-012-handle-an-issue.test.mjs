// Release tests of UC-012 "Handle an issue: bug fix or specification change", on the issue's page: each requirement UC-012 realises, checked from what the author reads on the page and from the requests the fixture
// servers received — evolution through the specification, the impact list of a changed requirement, the origin of every artifact, code only through a pull request, the participants and the capabilities the work
// needs, the derivation seeing the existing requirements, a change under the existing name, one click per decision, and no mail and no personal data of a mail reaching a participant that writes or a repository.
// TST-585301 maps every requirement UC-012 realises to a release test that guards it.
// Run: node --test tests/release-uc-012-handle-an-issue.test.mjs
//
// Module: MOD-maintenance-pages
// Module: MOD-issue-handling
// Guards: UC-012
// Level: release
//
// Written for the release testing of sprint 141 by developer-opus-e (ITM-585), who implemented none of ITM-581, ITM-582, ITM-583, ITM-584, ITM-654, ITM-1245, ITM-1247, ITM-1248, ITM-1250 or ITM-1256 and no UC-012
// production behaviour (RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER). The world is tests/uc-012-harness.mjs. The release team works from the specification and the page: each case ends at what a person reads on
// the page and at the request a fixture received. Readings the texts leave open, which the cases state:
//   - CODE ENTERS THE DEFAULT BRANCH THROUGH A PULL REQUEST WITH GREEN CI names no automatic check. In UC-012 it is read as: the fix's Run writes to the default branch the job's start record only, no code and no test,
//     and the issue is closed with its link only once the fix's pull request is merged; that the merge waits for green CI is the product's branch protection and Definition of Done (UC-002), not this page.
//   - A PROCESS MODEL ORGANISES PEOPLE AND AGENTS is read in UC-012 through its actors: the decisions are the author's, a person's clicks, and the work is handed to a participant, "the model endpoint or agent the author
//     hands the work to" (UC-012, Actors); a person of the register is therefore no participant the analysis is handed to.
//   - ONE CLICK PER DECISION names no automatic check. It is read as: a decision whose inputs are complete is written by the click itself — a class, a rejection with its reason, a change saved —, with no further click.
//   - An issue from a mail is an issue whose text is neutral and lists the `MAIL-` identifier of its report (UC-038), while the mail itself stays in the mailbox the Bridge lab-pc-4 serves.

import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { testDeclarations } from "../src/test-document/index.mjs";
import { withMailIds } from "../src/mail-records/index.mjs";
import { ADDRESS, CI_AGENT, CI_NO_RUN, CI_NO_WRITE, ERIKA, LOCAL, PERSON, PRODUCT_URL, READER, SECRET, SOURCE, analysed, buttonsOf, byClass, changeOf, decided, drafted, everyWrite, fixOf, flush, issueNow, issueOf,
  issueWrites, jobFiles, mailOf, one, open, queueFiles, queued, restoreWorld, saved, start, textOf, trusted, waitFor, writtenFiles } from "./uc-012-harness.mjs";

// The map reads files only and draws no page, so that there is no world to put back after it.
afterEach(() => { if (globalThis.document) restoreWorld(); });

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const UC = "docs/use-cases/UC-012-turn-an-issue-into-a-specification-change.md";
const SELF = "tests/release-uc-012-handle-an-issue.test.mjs";

// ---------------------------------------------------------------- the map

// Each requirement UC-012 realises, with the release tests of this file that guard it.
const EVIDENCE = {
  "EVOLUTION ENTERS THROUGH THE SPECIFICATION": [[SELF, "TST-585302"]],
  "A REQUIREMENT IS NOT CHANGED WITHOUT AN IMPACT LIST": [[SELF, "TST-585303"]],
  "EVERY ARTIFACT NAMES ITS ORIGIN": [[SELF, "TST-585304"]],
  "CODE ENTERS THE DEFAULT BRANCH THROUGH A PULL REQUEST WITH GREEN CI": [[SELF, "TST-585305"]],
  "A PROCESS MODEL ORGANISES PEOPLE AND AGENTS": [[SELF, "TST-585306"]],
  "A ROLE NAMES THE CAPABILITIES IT NEEDS": [[SELF, "TST-585307"]],
  "A PARTICIPANT DECLARES ITS CAPABILITIES": [[SELF, "TST-585308"]],
  "DERIVATION SEES THE EXISTING REQUIREMENTS": [[SELF, "TST-585309"]],
  "A CHANGE IS PROPOSED UNDER THE EXISTING NAME": [[SELF, "TST-585310"]],
  "ONE CLICK PER DECISION": [[SELF, "TST-585311"]],
  "A PARTICIPANT THAT WRITES TO A REPOSITORY NEVER RECEIVES A MAIL": [[SELF, "TST-585312"]],
  "NO PERSONAL DATA FROM A MAIL ENTERS A REPOSITORY": [[SELF, "TST-585313"]],
};

// TST-585301 · level: release · module: system
// guards: UC-012
// given: UC-012 as committed text, whose `realises` lists twelve requirements, and the release tests named in EVIDENCE
// input: read UC-012's list of the requirements it realises, and the declarations of the test files named for each
// expect: known positive — UC-012 realises these twelve requirements; each has at least one test named; each test named stands in its file with the level release and guards that requirement
test("TST-585301: UC-012 every requirement it realises has a release test that guards it", () => {
  const front = /^realises:\n((?:  - .*\n)+)/m.exec(read(UC))?.[1] ?? "";
  const realised = front.split("\n").filter(Boolean).map((line) => line.replace(/^ {2}- /, ""));
  assert.equal(realised.length, 12, "known positive: UC-012 realises twelve requirements");
  assert.deepEqual([...realised].sort(), Object.keys(EVIDENCE).sort(), "the map holds exactly the requirements UC-012 realises");
  for (const [requirement, tests] of Object.entries(EVIDENCE)) {
    assert.ok(tests.length > 0, `${requirement}: a test is named`);
    for (const [file, id] of tests) {
      assert.ok(existsSync(new URL(`../${file}`, import.meta.url)), `${requirement}: ${file} exists`);
      const declared = testDeclarations(file, read(file)).find((each) => each.id === id);
      assert.ok(declared, `${requirement}: ${id} is declared in ${file}`);
      assert.equal(declared.level, "release", `${id} is a release test`);
      assert.ok((declared.guards ?? []).includes(requirement), `${id} guards ${requirement}`);
    }
  }
});

// ---------------------------------------------------------------- the fixtures of the cases

const NAMING = "The export is cut off after the second page; FIRST RULE says nothing about page counts.";
const NEW = { name: "EVERY EXPORT KEEPS ALL PAGES", rule: "An export holds every page of the document.", check: "tests/unit.test.mjs", constrains: "product", passage: "cut off after the second page", class: "new" };
const CHANGED = { name: "FIRST RULE", rule: "The first rule holds for every page of an export.", check: "tests/unit.test.mjs", constrains: "product", passage: "cut off after the second page", class: "change", of: "FIRST RULE" };
const AS_CHANGE = { class: "change", reasoning: "The SPEC says nothing about page counts: a requirement is missing." };
const AS_BUG = { class: "bug", reasoning: "FIRST RULE holds, and the code breaks it.", wrong: ["src/store/read.mjs"] };

/** The issue 5 opened, analysed by local-llm as `analysis` proposes, and its class `cls` confirmed by the person's click. */
async function confirmed(w, cls) {
  const detail = await analysed(await open(w, 5));
  await decided(detail, cls);
  return detail;
}

// ---------------------------------------------------------------- evolution enters through the specification

// TST-585302 · level: release · module: system
// guards: EVOLUTION ENTERS THROUGH THE SPECIFICATION; UC-012
// given: the open issue 5 of alice/product that changes behaviour, analysed as a change; known positive and counter-proof: the same issue analysed as a bug
// input: the author confirms the class change, drafts the change and saves it; in a second world the author confirms the class bug
// expect: for the change the page offers the change and no fix; Save writes files under docs/spec-freigaben/ and the job's record under docs/jobs/ only — no SPEC.md, no code, no test; for the bug the page offers the fix (the counter-proof: a fix is offered only where the SPEC is right)
test("TST-585302: UC-012 an issue that changes behaviour becomes a specification change first, and no code change is offered for it", async () => {
  const w = start({ issues: [issueOf(5, NAMING)], analysis: AS_CHANGE, change: { candidates: [NEW] } });
  const detail = await confirmed(w, "change");
  await waitFor(() => changeOf(detail) !== undefined);
  assert.equal(fixOf(detail), undefined, "no fix for a change");
  await saved(await drafted(detail));
  const paths = writtenFiles(w).map((entry) => entry.path);
  assert.ok(paths.some((path) => path.startsWith("docs/spec-freigaben/")), `a queue is written: ${paths}`);
  assert.deepEqual(paths.filter((path) => !path.startsWith("docs/spec-freigaben/") && !path.startsWith("docs/jobs/")), [], "nothing but the queue and the job's record");
  restoreWorld();

  const bug = start({ issues: [issueOf(5, NAMING)], analysis: AS_BUG });
  const fixed = await confirmed(bug, "bug");
  await waitFor(() => fixOf(fixed) !== undefined);
  assert.ok(fixOf(fixed), "counter-proof: a bug is offered its fix");
  assert.equal(changeOf(fixed), undefined);
});

// ---------------------------------------------------------------- the impact list

// TST-585303 · level: release · module: system
// guards: A REQUIREMENT IS NOT CHANGED WITHOUT AN IMPACT LIST; UC-012
// given: the open issue 5, confirmed as a change; the participant drafts a change of the existing FIRST RULE, which the use cases UC-001 and UC-002 realise and the test TST-001 guards; the issue's text names none of them
// input: the author drafts the change from the issue and saves it
// expect: before Save no file of the queue is written; the saved queue's files name, for FIRST RULE, the artifacts that reference it — UC-001, UC-002 and TST-001 — as part of the proposal
test("TST-585303: UC-012 a change of an existing requirement from an issue carries the list of the artifacts that reference it", async () => {
  const w = start({ issues: [issueOf(5, NAMING)], analysis: AS_CHANGE, change: { candidates: [CHANGED] } });
  const detail = await drafted(await confirmed(w, "change"));
  assert.deepEqual(queueFiles(w), [], "nothing is written before Save");
  await saved(detail);
  const proposal = queueFiles(w).map((entry) => entry.content).join("\n");
  for (const id of ["UC-001", "UC-002", "TST-001"]) assert.ok(proposal.includes(id), `the impact list names ${id}:\n${proposal}`);
});

// ---------------------------------------------------------------- every artifact names its origin

// TST-585304 · level: release · module: system
// guards: EVERY ARTIFACT NAMES ITS ORIGIN; UC-012
// given: the open issue 5; in one world it is confirmed as a change and the change saved; in another it is confirmed as a bug and its fix queued with ci-bot
// input: Save of the change; Run of the fix
// expect: the entry's rationale has the line "**Issue:** #5 of https://github.com/alice/product" (UC-012 step 6: each entry names the issue; MOD-spec-changes, Data: the rationale's line) and names the issue and the person's source SRC-alice; the fix's job record works on https://github.com/alice/product/issues/5
test("TST-585304: UC-012 the change and the fix name the issue they came from", async () => {
  const w = start({ issues: [issueOf(5, NAMING)], analysis: AS_CHANGE, change: { candidates: [NEW] } });
  await saved(await drafted(await confirmed(w, "change")));
  const files = queueFiles(w);
  const rationale = files.find((entry) => entry.path.endsWith(".begruendung.md"))?.content ?? "";
  assert.ok(rationale.split("\n").includes(`**Issue:** #5 of ${PRODUCT_URL}`), "the entry's rationale has the line Issue naming the issue and the product's address");
  assert.ok(rationale.includes(`issue #5 of ${PRODUCT_URL}`) && rationale.includes(SOURCE), rationale);
  restoreWorld();

  const bug = start({ issues: [issueOf(5, NAMING)], analysis: AS_BUG });
  await queued(await confirmed(bug, "bug"));
  const record = jobFiles(bug).find((entry) => entry.content.includes("kind: fix-bug"));
  assert.ok(record?.content.includes(ADDRESS(5)), record?.content);
});

// ---------------------------------------------------------------- code enters through a pull request

const pullOf = (branch, state) => ({ number: 9, title: `${branch}: fix-bug`, branch, base: "main", head: "2".repeat(40), mergeCommit: state === "merged" ? "3".repeat(40) : null, state, draft: false,
  url: `${PRODUCT_URL}/pull/9`, opened: "2026-10-29T09:10:00Z", merged: state === "merged" ? "2026-10-29T09:50:00Z" : null, closed: state === "merged" ? "2026-10-29T09:50:00Z" : null, body: `Job: ${branch}` });
const NO_FACTS = async () => ({ pullRequest: null, commits: [], files: [], reviews: [], checks: [], read: async () => null });

// TST-585305 · level: release · module: system
// guards: CODE ENTERS THE DEFAULT BRANCH THROUGH A PULL REQUEST WITH GREEN CI; UC-012
// given: the open issue 5, confirmed as a bug; ci-bot can run code and tests; the fix's pull request #9 is open in one world and merged in another
// input: the author queues the fix with ci-bot; opens the issue again
// expect: the analysis and the fix's Run write to the product the jobs' records under docs/jobs/ only, the fix's among them, and no code and no test; while #9 is open the page offers no Close with links and the issue stays open; once #9 is merged the page offers Close with links (known positive)
test("TST-585305: UC-012 the fix writes no code to the default branch, and the issue is closed only after its pull request is merged", async () => {
  for (const state of ["open", "merged"]) {
    const w = start({ issues: [issueOf(5, NAMING)], analysis: AS_BUG, pulls: (branch) => (/^JOB-/.test(branch ?? "") ? pullOf(branch, state) : null), facts: NO_FACTS });
    const before = writtenFiles(w).length;
    await queued(await confirmed(w, "bug"));
    const written = writtenFiles(w).slice(before).map((entry) => entry.path);
    assert.ok(written.every((path) => path.startsWith("docs/jobs/")), `only job records: ${written}`);
    assert.ok(jobFiles(w).some((entry) => entry.content.includes("kind: fix-bug")), "the fix's record is written");
    const again = await open(w, 5);
    await waitFor(() => byClass(again, "fix-pull").length > 0 || byClass(again, "issue-problem").length > 0);
    assert.match(textOf(one(again, "fix-pull")), new RegExp(`is ${state}`));
    assert.equal(byClass(again, "close-with-links").length, state === "merged" ? 1 : 0, `Close with links for a pull request ${state}`);
    assert.equal(issueNow(w, 5).state, "open");
    restoreWorld();
  }
});

// ---------------------------------------------------------------- people and agents

// TST-585306 · level: release · module: system
// guards: A PROCESS MODEL ORGANISES PEOPLE AND AGENTS; UC-012
// given: the register lists local-llm (a model endpoint), ci-bot (a CI agent) and alice (a person), each declaring draft text; the open issue 5, not classified
// input: the author opens the issue; clicks a class by a script, then by the person
// expect: the analysis is offered to the agents local-llm and ci-bot, and not to the person alice; the script's click sets no label; the person's click sets it
test("TST-585306: UC-012 the work is handed to agents and the decision is the person's", async () => {
  const w = start({ issues: [issueOf(5, NAMING)], rows: [LOCAL, CI_AGENT, PERSON] });
  const detail = await open(w, 5);
  await waitFor(() => byClass(detail, "participant").length > 0);
  assert.deepEqual(byClass(one(detail, "issue-analysis"), "participant").map((radio) => radio.value).sort(), ["ci-bot", "local-llm"]);
  byClass(detail, "set-class").find((node) => node.getAttribute("data-class") === "bug").dispatchEvent(new Event("click"));
  await flush();
  assert.deepEqual(issueNow(w, 5).labels, [], "a script's click decides nothing");
  await decided(detail, "bug");
  assert.deepEqual(issueNow(w, 5).labels, ["defect"]);
});

// ---------------------------------------------------------------- the capabilities the work needs

// TST-585307 · level: release · module: system
// guards: A ROLE NAMES THE CAPABILITIES IT NEEDS; UC-012
// given: the register lists local-llm (draft text), checker (read the repository only), ci-bot (write to the repository, run code and tests) and ci-runner (run code and tests, not write to the repository); the open issue 5, confirmed as a bug
// input: the author opens the issue, confirms the bug, and opens the fix
// expect: the analysis, which needs draft text, is offered to local-llm, ci-bot and ci-runner, not to checker; the fix, which needs both write to the repository and run code and tests, is offered to ci-bot alone
test("TST-585307: UC-012 the analysis and the fix are offered only to participants with every capability they need", async () => {
  const w = start({ issues: [issueOf(5, NAMING)], analysis: AS_BUG, rows: [LOCAL, READER, CI_AGENT, CI_NO_WRITE] });
  const detail = await open(w, 5);
  await waitFor(() => byClass(detail, "participant").length > 0);
  assert.deepEqual(byClass(one(detail, "issue-analysis"), "participant").map((radio) => radio.value).sort(), ["ci-bot", "ci-runner", "local-llm"]);
  await decided(detail, "bug");
  await waitFor(() => fixOf(detail) !== undefined && byClass(fixOf(detail), "fix-participant").length > 0);
  assert.deepEqual(byClass(fixOf(detail), "fix-participant").map((radio) => radio.value), ["ci-bot"]);
});

// TST-585308 · level: release · module: system
// guards: A PARTICIPANT DECLARES ITS CAPABILITIES; UC-012
// given: the open issue 5, confirmed as a bug; the register lists local-llm and ci-bot, which declares write to the repository and run code and tests; counter-proof: the same ci-bot declared without run code and tests
// input: the author confirms the bug and opens the fix, in each world
// expect: with the declaration ci-bot is offered for the fix; without it no participant is, the page says that no participant that can run code and tests is configured and leads to UC-017, and offers no run panel
test("TST-585308: UC-012 what a participant declares decides whether the fix is handed to it", async () => {
  for (const [row, offered] of [[CI_AGENT, true], [CI_NO_RUN, false]]) {
    const w = start({ issues: [issueOf(5, NAMING)], rows: [LOCAL, row] });
    const detail = await decided(await open(w, 5), "bug");
    await waitFor(() => fixOf(detail) !== undefined && (byClass(fixOf(detail), "fix-participant").length > 0 || byClass(fixOf(detail), "issue-no-fixer").length > 0));
    assert.deepEqual(byClass(fixOf(detail), "fix-participant").map((radio) => radio.value), offered ? ["ci-bot"] : []);
    assert.equal(byClass(fixOf(detail), "issue-no-fixer").length, offered ? 0 : 1);
    if (!offered) assert.match(textOf(one(fixOf(detail), "issue-no-fixer")), /No participant that can run code and tests is configured/);
    restoreWorld();
  }
});

// ---------------------------------------------------------------- the derivation sees the existing requirements

const QUEUE = "docs/spec-freigaben/2026-10-01a_fixture";
const OPEN_QUEUE = {
  [`${QUEUE}/index.md`]: "# SPEC approvals — queue 2026-10-01a · fixture\n\n| Nr | Datei | Anker (Überschrift, wortgetreu) | bis (exklusiv) | Commits |\n|---|---|---|---|---|\n| 1 | `SPEC.md` | ## 1. Section | — | |\n",
  [`${QUEUE}/entscheidungen.md`]: "# Decisions\n\nAppend-only.\n",
  [`${QUEUE}/01-rules.md`]: "## 1. Section\n\n**FIRST RULE** *(PO)*\nThe first rule holds.\n*Check:* `tests/unit.test.mjs`\n\n**SECOND RULE** *(PO)*\nThe second rule holds.\n*Check:* no automatic check; at review.\n\n**THIRD RULE** *(PO)*\nThe third rule holds for an open queue.\n*Check:* no automatic check; at review.\n",
  [`${QUEUE}/01-rules.begruendung.md`]: "# Reason\n\nWhy.\n",
};

// TST-585309 · level: release · module: system
// guards: DERIVATION SEES THE EXISTING REQUIREMENTS; UC-012
// given: the product's SPEC holds FIRST RULE and SECOND RULE; an open queue proposes THIRD RULE ("The third rule holds for an open queue."); the open issue 5 names FIRST RULE only, confirmed as a change
// input: the author drafts the change from the issue with local-llm
// expect: what the participant receives for the change holds every requirement of the product — "The first rule holds.", "The second rule holds." and the open queue's "The third rule holds for an open queue." — and the issue's text
test("TST-585309: UC-012 the change drafted from an issue is derived against every requirement of the SPEC and of its open queues", async () => {
  const w = start({ issues: [issueOf(5, NAMING)], analysis: AS_CHANGE, change: { candidates: [NEW] }, product: OPEN_QUEUE });
  await drafted(await confirmed(w, "change"));
  const sent = w.kept.endpoint.filter((request) => !JSON.stringify(request.body).includes("Propose its `class`")).map((request) => JSON.stringify(request.body));
  assert.ok(sent.length >= 1, "the change was asked for");
  for (const wanted of ["The first rule holds.", "The second rule holds.", "The third rule holds for an open queue.", "cut off after the second page"]) assert.ok(sent[0].includes(wanted), `the change receives ${wanted}`);
});

// ---------------------------------------------------------------- a change under the existing name

// TST-585310 · level: release · module: system
// guards: A CHANGE IS PROPOSED UNDER THE EXISTING NAME; UC-012
// given: the open issue 5, confirmed as a change; the participant drafts a change of FIRST RULE ("The first rule holds for every page of an export.")
// input: the author drafts the change and saves it
// expect: the page lists the candidate FIRST RULE as a change, beside FIRST RULE's current rule "The first rule holds."; the saved entry proposes the new rule under the name FIRST RULE and adds no requirement of another name
test("TST-585310: UC-012 a change of an existing requirement is proposed under its name, beside its current text", async () => {
  const w = start({ issues: [issueOf(5, NAMING)], analysis: AS_CHANGE, change: { candidates: [CHANGED] } });
  const detail = await drafted(await confirmed(w, "change"));
  const candidate = byClass(changeOf(detail), "candidate")[0];
  assert.equal(candidate.getAttribute("data-name"), "FIRST RULE");
  assert.equal(candidate.getAttribute("data-class"), "change");
  assert.equal(textOf(one(candidate, "candidate-refers")), "FIRST RULE: The first rule holds.");
  await saved(detail);
  const entry = queueFiles(w).find((file) => /\/\d\d-[^/]*\.md$/.test(file.path) && !file.path.endsWith(".begruendung.md"));
  assert.ok(entry, `an entry is written: ${queueFiles(w).map((file) => file.path)}`);
  assert.ok(entry.content.includes("**FIRST RULE**") && entry.content.includes(CHANGED.rule), entry.content);
  assert.deepEqual([...entry.content.matchAll(/^\*\*([A-Z][A-Z' ,-]+)\*\*/gm)].map((match) => match[1]).filter((name) => !["FIRST RULE", "SECOND RULE"].includes(name)), [], "no requirement of another name");
});

// ---------------------------------------------------------------- one click per decision

// TST-585311 · level: release · module: system
// guards: ONE CLICK PER DECISION; UC-012
// given: the open issue 5, analysed as a change, and the change drafted; the open issue 9 with the reason for its rejection typed
// input: one click on Confirm change; one click on Save; one click on Reject issue
// expect: after the one click on Confirm change the issue carries the label change; after the one click on Save the queue is written in one commit; after the one click on Reject issue the issue 9 is closed with its reason; none of them asks for a further click
test("TST-585311: UC-012 a class, a change and a rejection each take one click", async () => {
  const w = start({ issues: [issueOf(5, NAMING), issueOf(9, NAMING)], analysis: AS_CHANGE, change: { candidates: [NEW] } });
  const detail = await analysed(await open(w, 5));
  await decided(detail, "change");
  assert.deepEqual(issueNow(w, 5).labels, ["change"]);
  await drafted(detail);
  const commits = () => w.kept.github.filter((request) => request.method === "POST" && request.path.endsWith("/git/commits")).length;
  const before = commits();
  await saved(detail);
  assert.equal(commits() - before, 1, "one commit");
  assert.ok(queueFiles(w).length >= 2, "the queue's files");

  const nine = await open(w, 9);
  await waitFor(() => byClass(nine, "reject").length > 0);
  one(nine, "reject-reason").value = "Duplicate of #5.";
  one(nine, "reject-reason").dispatchEvent(new Event("input"));
  await trusted(one(nine, "reject"));
  await waitFor(() => byClass(nine, "issue-rejected").length > 0 || byClass(nine, "issue-problem").length > 0);
  assert.equal(issueNow(w, 9).state, "closed");
  assert.deepEqual(issueNow(w, 9).comments, ["Duplicate of #5."]);
});

// ---------------------------------------------------------------- mail

/** The world of an issue created from a mail: the issue 5's text is neutral and lists the mail's identifier; the mail, from Erika Mustermann with the report SECRET, stays in the mailbox. */
async function fromMail(over = {}) {
  const mail = await mailOf("report");
  const w = start({ mails: [mail], issues: [issueOf(5, withMailIds("The export of a long document stops after the second page; FIRST RULE.", [mail.id]))], ...over });
  return { w, mail };
}
const MAIL_WORDS = [ERIKA.name, ERIKA.address, SECRET, "Erika"];
const holdsMail = (text) => MAIL_WORDS.filter((word) => text.includes(word));

// TST-585312 · level: release · module: system
// guards: A PARTICIPANT THAT WRITES TO A REPOSITORY NEVER RECEIVES A MAIL; UC-012
// given: the open issue 5 created from a mail (UC-038), its text neutral and listing the mail's MAIL- identifier; the mail from Erika Mustermann, reporting "the export of my thesis fails with error E42", in the mailbox of the Bridge lab-pc-4; the issue confirmed as a bug; ci-bot writes to the repository
// input: the author queues the fix with ci-bot
// expect: known positive — the run panel names what ci-bot receives, among it the part "issue #5"; it names nothing of the mail, not its text, its sender's name or address, and no part from the mailbox; the job's record holds none of them; no request for a mail reached the Bridge
test("TST-585312: UC-012 the fix of an issue from a mail is given the neutral issue, never the mail", async () => {
  const { w } = await fromMail({ analysis: AS_BUG });
  const detail = await queued(await confirmed(w, "bug"));
  const panel = textOf(one(fixOf(detail), "run-panel"));
  assert.ok(panel.includes("issue #5"), `known positive: the panel names the issue's part: ${panel.slice(0, 400)}`);
  assert.ok(!/MAIL-|mailbox/i.test(panel), "no part from the mailbox");
  assert.deepEqual(holdsMail(panel), [], "the participant receives nothing of the mail");
  const record = jobFiles(w).find((entry) => entry.content.includes("kind: fix-bug"));
  assert.ok(record, "the fix is queued");
  assert.deepEqual(holdsMail(record.content), []);
  assert.deepEqual(w.kept.bridge.map((each) => each.operation), [], "no mail is read");
});

// TST-585313 · level: release · module: system
// guards: NO PERSONAL DATA FROM A MAIL ENTERS A REPOSITORY; UC-012
// given: the open issue 5 created from a mail from Erika Mustermann (erika@example.invalid); known positive: the scan below finds the planted address in a text that holds it
// input: the author analyses the issue, confirms the class change, drafts the change and saves it; in a second world confirms the class bug and queues the fix; in a third rejects it with a reason
// expect: the queue, the fix's record and the rejection's comment are written; no file, commit, comment or label the page sent to the product, in any of the three, holds the sender's name, address or the mail's text
test("TST-585313: UC-012 nothing the page writes while handling an issue from a mail holds personal data of the mail", async () => {
  assert.deepEqual(holdsMail(`planted: ${ERIKA.address}`), [ERIKA.address], "known positive: the scan finds a planted address");
  const change = await fromMail({ analysis: AS_CHANGE, change: { candidates: [NEW] } });
  await saved(await drafted(await confirmed(change.w, "change")));
  assert.ok(queueFiles(change.w).length > 0, "the queue is written");
  assert.deepEqual(holdsMail(everyWrite(change.w)), []);
  restoreWorld();

  const bug = await fromMail({ analysis: AS_BUG });
  await queued(await confirmed(bug.w, "bug"));
  assert.ok(jobFiles(bug.w).length > 0, "the record is written");
  assert.deepEqual(holdsMail(everyWrite(bug.w)), []);
  restoreWorld();

  const rejected = await fromMail();
  const detail = await open(rejected.w, 5);
  await waitFor(() => byClass(detail, "reject").length > 0);
  one(detail, "reject-reason").value = "Not a defect of this product.";
  one(detail, "reject-reason").dispatchEvent(new Event("input"));
  await trusted(one(detail, "reject"));
  await waitFor(() => issueNow(rejected.w, 5).state === "closed");
  assert.ok(issueWrites(rejected.w).length > 0, "the rejection is written");
  assert.deepEqual(holdsMail(everyWrite(rejected.w)), []);
});
