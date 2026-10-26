// Independent ITM-418 requirements release battery, authored by Developer terra-d, and moved to the prompt bar and the review pages' route `draft` by ITM-514.
// Successor: Team 2 Developer itm475-integration; implemented no UC-019 production behavior.
// Original cases: TST-418101..104 by terra-d. Added cases: TST-418105..121 and counterproofs by the successor.
// TST-418122..123 retain terra-d (Harvey)'s original TST-418127/130 assertions; transferred by developer-terra-e,
// who implemented no UC-019 production behavior. Original assertion checkpoint: b0ce6dc86108c3ccf73b2d7b1ea94e48961cfdda.
// TST-418124: independent actual-CI correction regression by developer-terra-e; no production implementation.
// ITM-514: the flows of TST-418101..123 go through the prompt bar and the route `draft` (developer-sonnet-e, who implemented none of ITM-507, ITM-508 or ITM-551);
// TST-418120 and TST-418124 start the actual workflow entry from the record the test writes, since the bar offers no hand-over yet (TST-377013).
// Module: MOD-review-pages; MOD-trace-pages; MOD-site-frame; MOD-prompt-bar; MOD-spec-changes; MOD-source-register; MOD-job-runner; MOD-runtimes
// Guards: UC-019
// Level: release
// Run: node --test tests/release-uc-019-change-requirements-by-prompt.test.mjs
// All endpoint and repository traffic is controlled by the harness of tests/uc-019-prompt-bar-harness.mjs, whose global fetch answers
// in-memory servers and refuses every other origin; no paid service is called. Each test states its input and its expected values in its own text.

import test, { after } from "node:test";
import assert from "node:assert/strict";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { ask, bridgeAt } from "../src/bridge-client/index.mjs";
import { startRecord } from "../src/job-ledger/index.mjs";
import { scenario, onRequirementPage, run, send, review, save, goTo, press, rest, statusOf, barOf, keptDraft, sentText, targetsOf, messageLines, all, one, row, namedButton, draft, candidate,
  SOURCE, LOAN, SHELF, CONFLICT, CHANGED, INSTRUCTION, SPEC, CURRENT_RULE, proposalWrites, proposalTexts, recordTexts, assertProposal } from "./uc-019-prompt-bar-harness.mjs";

// UC-only exclusions from this requirements battery:
// A CHANGED FILE IS SHOWN AGAINST ITS LAST ACCEPTED TEXT: UC-019 6b applies this to a reviewed use-case file;
//   requirements proposals are instead shown beside the current SPEC section.
// A PROMPTED USE-CASE CHANGE SEES ITS NEIGHBOURS: only use-case targets have realised requirements and neighbour use cases.
// NO USE CASE IS LEFT OUT OF A PROMPT SILENTLY: the use-case context branch is distinct from the requirement context.
// AN EDITED FILE KEEPS ITS IDENTIFIER: its SPEC rule enumerates use cases, architecture decisions and tests;
//   requirement names follow the separate change/rename rules below.

const resultOf = (s) => one(s.target, "section", "requirements-result");
const roundsOf = (s) => keptDraft(s).result.rounds;
const brokenThenFixed = () => [draft(candidate({ check: "" })), draft()];

// TST-418101
// level: release
// module: MOD-review-pages; MOD-prompt-bar; MOD-source-register
// guards: UC-019; THE PERSON WHO PROMPTS IS A SOURCE
// given: author github.com/akmaier uses their instance to edit bob/lending-tool; only SRC-author is linked
// input: the page of the requirement, the instruction in the bar, Send, Review the draft and Save
// expect: the author is not mistaken for bob; the bar sends, the draft kept carries the source SRC-author, and the proposal names SRC-author, despite the different product owner
test("TST-418101: prompting source follows the author account, not the product owner", async () => {
  const s = await scenario({ owner: "bob" });
  await onRequirementPage(s);
  await send(s);
  assert.doesNotMatch(statusOf(s).textContent, /Nothing was sent/, "the linked author source is available when the product owner differs");
  await review(s);
  assert.equal(keptDraft(s).params.source, SOURCE);
  await until(s, () => all(s.target, "section", "requirements-result").length === 1);
  await save(s);
  assert.match(assertProposal(s), /SRC-author/);
});

// TST-418102
// level: release
// module: MOD-prompt-bar; MOD-runtimes
// guards: UC-019; ONE DEFINITION, THREE DRIVERS
// given: the endpoint record names paired Bridge release-bridge, with its configured loopback address and token
// input: the prompt bar sends the message for the open requirement, which the conversation hands on to change-requirements (UC-049 4a.1)
// expect: no direct model request; every exchange goes to that named Bridge — the conversation's, then one POST /v1/ask of change-requirements that carries the same instruction and the requirement A LOAN HAS A DUE DATE
test("TST-418102: a named Bridge endpoint uses the Bridge transport from the bar", async () => {
  const s = await scenario({ bridge: true });
  const positive = await ask(bridgeAt({ address: "http://127.0.0.1:9418", token: "fixture-pairing-token" }),
    { endpoint: { name: "fixture", baseUrl: "https://fixture-endpoint.example.test/v1", kind: "openai-compatible", model: "fixture-model", key: null } }, INSTRUCTION);
  assert.deepEqual(JSON.parse(positive.text).draft, draft(), "known positive: the actual Bridge client reads the fixture draft");
  assert.deepEqual(s.bridgeRequests.map((request) => [request.method, new URL(request.url).pathname]), [["POST", "/v1/ask"], ["GET", "/v1/ask/fixture-ask"]]);
  assert.ok(s.bridgeRequests.every((request) => request.headers["x-agent-m-bridge-token"] === "fixture-pairing-token"));
  s.bridgeRequests.length = 0;
  await run(s);
  assert.equal(s.endpointRequests.length, 0, "a named Bridge endpoint is never contacted directly");
  const asks = s.bridgeRequests.filter((request) => request.method === "POST" && request.url.endsWith("/v1/ask") && JSON.stringify(request.body).includes("You change requirements of a product"));
  assert.equal(asks.length, 1, "the change goes through the configured named Bridge in one exchange");
  assert.ok(s.bridgeRequests.some((request) => request.method === "POST" && JSON.stringify(request.body).includes("You answer a person's message about the page")), "the conversation went through the Bridge too");
  assert.match(JSON.stringify(asks[0].body), /Make the due date visible\./);
  assert.match(JSON.stringify(asks[0].body), /A LOAN HAS A DUE DATE/);
  await save(s);
  assertProposal(s);
});

// TST-418103
// level: release
// module: MOD-review-pages; MOD-source-register
// guards: UC-019; A CONFLICT IS DECIDED BY A PERSON
// given: a candidate from SRC-author (advisory) conflicts with LOAN from SRC-policy (normative)
// input: Send, Review the draft and inspect the undecided conflict beside the existing requirement (UC-019 8a)
// expect: both sources and both authorities are visible in that conflict's panel before any decision or write
test("TST-418103: the conflict panel shows both sources and their authority", async () => {
  const s = await scenario({ answers: [draft(candidate({ name: CONFLICT, class: "conflict", rule: "Every loan may hide its due date." }))] });
  await run(s);
  const conflict = row(s, CONFLICT);
  for (const text of [SOURCE, "advisory", "SRC-policy", "normative"]) assert.ok(conflict.textContent.includes(text), `the conflict shows ${text}`);
  assert.equal(proposalWrites(s).length, 0);
});

// TST-418104
// level: release
// module: MOD-prompt-bar; MOD-review-pages; MOD-site-frame
// guards: UC-019; THE PAGE NAMES WHERE IT SENDS
// given: a returned draft on the route draft and a follow-up instruction written in the bar; the participant answers the follow-up with a draft of the same kind (the change kind reads only a draft)
// input: write the follow-up "Make the display final." without pressing Send, then press Send
// expect: before Send no further request is made; Send makes exactly one further exchange to the participant named by the bar ("Sent to: drafter — this machine"), whose message holds the follow-up and the draft as it stands - its rule "Every loan visibly displays its due date." - and nothing is written
test("TST-418104: a follow-up in the bar is sent only on Send, with the draft as it stands", async () => {
  const s = await scenario({ answers: [draft(), draft()] });
  await run(s);
  assert.equal(s.endpointRequests.length, 1);
  one(barOf(s), "textarea", "instruction").value = "Make the display final.";
  await rest(s);
  assert.equal(s.endpointRequests.length, 1, "nothing is sent before Send");
  await send(s, "Make the display final.");
  assert.equal(s.endpointRequests.length, 2);
  assert.match(statusOf(s).textContent, /^Sent to:drafter — this machine/);
  assert.ok(sentText(s, 1).includes("Make the display final."));
  assert.ok(sentText(s, 1).includes("Every loan visibly displays its due date."), "the current draft goes with the follow-up");
  assert.equal(s.product.writes.length, 0);
});

// TST-418105
// level: release
// module: MOD-prompt-bar; MOD-participant-list; MOD-site-frame
// guards: UC-019; A PARTICIPANT DECLARES ITS CAPABILITIES; A PARTICIPANT DECLARES WHERE IT PROCESSES DATA; EVERY STEP EXPLAINS ITSELF
// given: a draft-capable endpoint participant (drafter, this machine) and a read-only one (observer, Anthropic, USA), and a CI agent that the bar does not offer
// input: open the page of the requirement, read the bar, choose drafter, Send and Review the draft
// expect: the bar names drafter with its place, the only participant that can do the kind, and neither observer nor the CI agent, and there is nothing to choose among; nothing is sent before Send; the bar and the draft page each hold a folded "What is this?"
test("TST-418105: offered participants, processing places and folded explanations are visible", async () => {
  const s = await scenario();
  await onRequirementPage(s);
  assert.equal(one(barOf(s), "span", "participant").textContent, "drafter — this machine");
  assert.equal(all(barOf(s), "option").length, 0, "observer cannot draft text, so there is nothing to choose among");
  assert.equal(s.endpointRequests.length, 0);
  const explanations = () => all(s.body, "details").filter((node) => node.textContent.includes("What is this?"));
  assert.ok(explanations().length >= 2, "the page and the bar explain themselves");
  assert.ok(all(barOf(s), "details").some((node) => node.textContent.includes("What is this?") && !node.open), "the bar's explanation is folded");
  await send(s, INSTRUCTION, { participant: "drafter" });
  await review(s);
  assert.ok(all(s.target, "details").some((node) => node.textContent.includes("What is this?") && !node.open), "the draft page's explanation is folded");
  assert.equal(all(resultOf(s), "details").length > 0, true);
});

// TST-418106
// level: release
// module: MOD-prompt-bar; MOD-spec-changes; MOD-job-runner
// guards: UC-019; DERIVATION SEES THE EXISTING REQUIREMENTS; A PROMPTED REQUIREMENT CHANGE FOLLOWS THE DERIVATION RULES; A REQUIREMENTS JOB RECEIVES THE CHAPTER ON REQUIREMENTS ENGINEERING; THE PAGE NAMES WHERE IT SENDS
// given: two SPEC requirements and an actual open proposal generated by the bar's draft and its Save
// input: on a new page of that repository write the instruction in the bar; Send
// expect: no send before Send; the bar names "drafter — this machine" as the destination; the endpoint receives the instruction, both SPEC rules, the queued rule, and chapter 8 byte-for-byte
test("TST-418106: complete SPEC, open queues and the whole original chapter reach the participant", async () => {
  const queued = await scenario({ answers: [draft(candidate({ name: "A LOAN IS RENEWABLE", class: "new", of: undefined, rule: "Every loan permits renewal." }))] });
  await run(queued); await save(queued);
  const extraFiles = Object.fromEntries(Object.entries(queued.product.files).filter(([path]) => path.startsWith("docs/spec-freigaben/")));
  assert.ok(Object.keys(extraFiles).length >= 4, "known positive: a real open queue was generated");
  const s = await scenario({ extraFiles });
  await onRequirementPage(s);
  one(barOf(s), "textarea", "instruction").value = INSTRUCTION;
  await rest(s);
  assert.equal(s.endpointRequests.length, 0);
  await send(s);
  assert.match(statusOf(s).textContent, /^Sent to:drafter — this machine/);
  const text = sentText(s);
  for (const required of [INSTRUCTION, LOAN, SHELF, CURRENT_RULE, "Every book has a shelf.", "A LOAN IS RENEWABLE", "Every loan permits renewal.", s.chapter]) assert.ok(text.includes(required), `complete input includes ${required.slice(0, 70)}`);
  assert.equal(proposalWrites(s).length, 0);
});

// TST-418107
// level: release
// module: MOD-prompt-bar; MOD-job-runner
// guards: UC-019; NO REQUIREMENT IS LEFT OUT OF THE CONTEXT SILENTLY
// given: the complete requirements/chapter context and a participant, drafter, with a one-token capacity; observer holds 200000 but cannot draft text, so the bar does not offer it
// input: the page of the requirement, choose drafter, Send (UC-019 4a)
// expect: nothing is sent and nothing is written; the bar says "Nothing was sent.", "drafter does not hold this message: its context holds 1 tokens" and "No offered participant has a larger context."
test("TST-418107: a too-small context stops without truncation or a send", async () => {
  const s = await scenario({ context: 1 });
  await onRequirementPage(s);
  await send(s, INSTRUCTION, { participant: "drafter" });
  assert.match(statusOf(s).textContent, /^Nothing was sent\./);
  assert.match(statusOf(s).textContent, /drafter does not hold this message: its context holds 1 tokens, the job needs about \d+\./);
  assert.match(statusOf(s).textContent, /No offered participant has a larger context\./);
  assert.equal(s.endpointRequests.length, 0); assert.equal(s.product.writes.length, 0);
});

// TST-418108
// level: release
// module: MOD-review-pages; MOD-job-runner; MOD-documents
// guards: UC-019; A CANDIDATE IS NEW, A CHANGE, A DUPLICATE OR A CONFLICT; EXACT DUPLICATES ARE FOUND WITHOUT A MODEL
// given: one new, changed, restated and conflicting candidate, with the restatement wrongly classed new
// input: Send through the deterministic correction loop, correcting the duplicate classification, and Review the draft
// expect: the duplicate finding names LOAN before any extra model classification; the draft exposes all four actual classes
test("TST-418108: deterministic duplicate correction retains the four candidate classes", async () => {
  const fresh = candidate({ name: "A LOAN IS RENEWABLE", rule: "Every loan permits renewal.", class: "new", of: undefined });
  const duplicate = candidate({ name: "A DUE DATE IS STATED", rule: CURRENT_RULE, class: "new", of: undefined });
  const conflict = candidate({ name: CONFLICT, rule: "Every loan may hide its due date.", class: "conflict" });
  const s = await scenario({ answers: [draft(fresh, candidate(), duplicate, conflict), draft(fresh, candidate(), { ...duplicate, class: "duplicate", of: LOAN }, conflict)] });
  await run(s);
  assert.equal(s.endpointRequests.length, 2);
  assert.match(sentText(s, 1), /EXACT DUPLICATES ARE FOUND WITHOUT A MODEL/);
  assert.match(sentText(s, 1), /class it as duplicate of A LOAN HAS A DUE DATE/);
  assert.deepEqual(all(resultOf(s), "select", "class").map((node) => node.value), ["new", "change", "duplicate", "conflict"]);
});

// TST-418109
// level: release
// module: MOD-review-pages; MOD-spec-changes; MOD-markdown-render
// guards: UC-019; A CHANGE IS PROPOSED UNDER THE EXISTING NAME; A DRAFTED CHANGE IS SHOWN AGAINST THE CURRENT TEXT
// given: a changed candidate whose display name differs from its existing target
// input: inspect its current-text difference on the route draft, then Save
// expect: old and new lines are shown before Save; the proposal retains LOAN, excludes the candidate name, and preserves SHELF
test("TST-418109: a changed rule is compared and proposed under its existing identifier", async () => {
  const s = await scenario(); await run(s);
  assert.ok(one(row(s), "section", "current-requirement").textContent.includes(CURRENT_RULE));
  const difference = one(row(s), "section", "candidate-difference");
  assert.ok(difference.textContent.includes(CURRENT_RULE));
  assert.ok(difference.textContent.includes(candidate().rule));
  await save(s);
  const text = assertProposal(s);
  assert.ok(text.includes(`**${LOAN}**`)); assert.ok(!text.includes(`**${CHANGED}**`));
  assert.ok(text.includes(`**${SHELF}** *(SRC-policy)*\nEvery book has a shelf.`));
});

// TST-418110
// level: release
// module: MOD-prompt-bar; MOD-review-pages; MOD-spec-changes; MOD-job-runner
// guards: UC-019; A SPEC EDIT IS SAVED AS A PROPOSAL; A GENERATED ARTIFACT IS A PROPOSAL; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK; ONE CLICK PER DECISION; AN ARTIFACT RECORDS THE VERSION THAT PRODUCED IT
// given: an untouched page, an instruction typed in the bar and an editable draft
// input: pause before Send and before Save, then press each once
// expect: no request and no write before Send; none to the repository after it; one Save writes one open queue, unchanged SPEC and the provenance lines Agent-M-Version, Agent-M-Kind: change-requirements, Agent-M-Participant: drafter, Agent-M-Model: fixture-model, Agent-M-Rounds: 1, with no Agent-M-Job line, no line naming the instruction and no job record
test("TST-418110: explicit Send and one Save preserve proposal state and complete provenance", async () => {
  const s = await scenario(); await onRequirementPage(s);
  one(barOf(s), "textarea", "instruction").value = INSTRUCTION;
  await rest(s);
  assert.equal(s.product.writes.length, 0); assert.equal(s.endpointRequests.length, 0);
  await send(s); await review(s);
  assert.equal(proposalWrites(s).length, 0);
  assert.equal(s.endpointRequests.length, 1);
  await save(s); assertProposal(s);
  const write = proposalWrites(s)[0], lines = messageLines(write);
  assert.ok(lines.some((line) => line.startsWith("Agent-M-Version: ")));
  for (const trailer of ["Agent-M-Kind: change-requirements", "Agent-M-Participant: drafter", "Agent-M-Model: fixture-model", "Agent-M-Rounds: 1"]) assert.ok(lines.includes(trailer), trailer);
  assert.ok(lines.every((line) => !line.startsWith("Agent-M-Job:") && !line.includes("Agent-M-Instruction") && !line.includes(INSTRUCTION)), "no job line, no line names the instruction");
  const decisions = Object.entries(write.files).find(([path]) => path.endsWith("/entscheidungen.md"));
  assert.ok(decisions); assert.doesNotMatch(decisions[1], /akzeptiert|accepted/i);
  assert.equal(recordTexts(s).length, 0);
});

// TST-418111
// level: release
// module: MOD-review-pages; MOD-spec-changes
// guards: UC-019; A SAVE IS REFUSED WHEN THE TEXT CHANGED MEANWHILE; A REFUSED SAVE KEEPS THE EDIT
// given: an exact authored draft followed by a concurrent target-section change
// input: Save
// expect: zero additional write and the exact draft retained beside that newer section
test("TST-418111: stale Save retains the exact edit beside the newer baseline", async () => {
  const s = await scenario(); await run(s);
  const edit = one(row(s), "textarea", "candidate-rule"); edit.value = "Every loan shows the person's retained edit."; edit.dispatchEvent(new Event("input"));
  await s.product.change("SPEC.md", SPEC.replace(CURRENT_RULE, "Every loan states its revised due date."));
  const before = s.product.writes.length; await save(s);
  assert.equal(s.product.writes.length, before);
  assert.equal(edit.value, "Every loan shows the person's retained edit.");
  assert.match(one(s.target, "div", "newer").textContent, /Every loan states its revised due date\./);
});

// TST-418112
// level: release
// module: MOD-review-pages; MOD-job-runner
// guards: UC-019; A CONFLICT IS DECIDED BY A PERSON; WHAT A PERSON DECIDES IS NOT SENT BACK
// given: one otherwise valid conflicting requirement beside a valid change
// input: Send, Review the draft, Save while undecided; in a second page choose new and Save
// expect: one endpoint call and one correction round in each, no automatic conflict correction; undecided: the proposal does not hold the conflict's rule; decided: it holds the person's exact decision
test("TST-418112: the person alone decides a conflict without another participant call", async () => {
  const answers = [draft(candidate(), candidate({ name: CONFLICT, class: "conflict", rule: "Every loan may hide its due date." }))];
  const undecided = await scenario({ answers }); await run(undecided);
  assert.equal(undecided.endpointRequests.length, 1);
  assert.equal(one(undecided.target, "p", "rounds").textContent, "Correction rounds: 1");
  await save(undecided);
  assert.ok(!assertProposal(undecided).includes("Every loan may hide its due date."));
  assert.equal(undecided.endpointRequests.length, 1);
  const decided = await scenario({ answers }); await run(decided);
  const choice = one(row(decided, CONFLICT), "select", "class"); choice.value = "new"; choice.dispatchEvent(new Event("change"));
  await save(decided); assert.match(assertProposal(decided), /Every loan may hide its due date\./); assert.equal(decided.endpointRequests.length, 1);
});

// TST-418113
// level: release
// module: MOD-prompt-bar; MOD-review-pages; MOD-job-runner
// guards: UC-019; A DRAFT THAT FAILS A CHECK GOES BACK TO ITS PARTICIPANT; A FINDING READS LIKE A COMPILER MESSAGE; AN ERROR MUST BE FIXED, A WARNING FIXED OR JUSTIFIED; THE ROUNDS ARE COUNTED AND SHOWN
// given: a candidate missing its check, followed by the corrected candidate
// input: Send and Review the draft
// expect: the same endpoint receives draft and compiler-complete finding; only the corrected draft reaches the editor; both rounds are shown on the draft page ("Correction rounds: 2") and kept with the first round's finding
test("TST-418113: an invalid draft goes back with its complete compiler finding", async () => {
  const s = await scenario({ answers: brokenThenFixed() }); await run(s);
  assert.equal(s.endpointRequests.length, 2);
  const correction = sentText(s, 1);
  assert.match(correction, /A DUE DATE IS VISIBLE:\d+: error: no check \[A REQUIREMENT HAS FOUR FIELDS\].*add a line/);
  assert.match(correction, /Current draft to change/);
  assert.equal(one(row(s), "textarea", "candidate-check").value, candidate().check);
  assert.equal(one(s.target, "p", "rounds").textContent, "Correction rounds: 2");
  assert.equal(roundsOf(s).length, 2);
  assert.match(JSON.stringify(roundsOf(s)[0].findings), /A REQUIREMENT HAS FOUR FIELDS/);
});

// TST-418114
// level: release
// module: MOD-prompt-bar; MOD-review-pages; MOD-job-runner
// guards: UC-019; AN ERROR MUST BE FIXED, A WARNING FIXED OR JUSTIFIED
// given: a rule with a conjunction, followed by the same rule and a one-line justification of its exact finding
// input: Send and Review the draft
// expect: two exchanges, justified warning kept with the draft, no remaining finding on the page and no silent rewrite of the author's rule
test("TST-418114: a warning ends only after its one-line justification", async () => {
  const both = draft(candidate({ rule: "Every loan shows its due date and its renewal limit." }));
  const s = await scenario({ answers: [both, (requests) => {
    const message = requests.at(-1).body.messages[0].content;
    const line = message.split("\n").find((line) => line.includes(": warning:") && line.includes("[ONE STATEMENT PER REQUIREMENT]"));
    assert.ok(line, "the participant receives the warning to justify");
    return { draft: both, answers: [{ finding: line, how: "justified", text: "Both displays form one visible state." }] };
  }] }); await run(s);
  assert.equal(s.endpointRequests.length, 2);
  assert.equal(all(one(s.target, "ul", "left"), "li").length, 0);
  assert.match(JSON.stringify(roundsOf(s)), /Both displays form one visible state\./);
  assert.equal(one(row(s), "textarea", "candidate-rule").value, both.candidates[0].rule);
});

// TST-418115
// level: release
// module: MOD-prompt-bar; MOD-review-pages; MOD-job-runner
// guards: UC-019; THE CORRECTION LOOP HAS A FIXED LIMIT; THE ROUNDS ARE COUNTED AND SHOWN; A FINDING READS LIKE A COMPILER MESSAGE
// given: five different invalid drafts that cannot trigger an unchanged-round early stop
// input: Send, then Review the draft
// expect: exactly five exchanges; the bar and the draft page show five rounds; the draft page lists the finding left in the compiler form, with its artifact "VISIBLE DUE DATE 4", a line, the kind error, the rule by name and the correction expected; the draft the bar kept holds the finding with its artifact "VISIBLE DUE DATE 4", a line, the kind error and the rule; the loop stopped because of the limit
test("TST-418115: the declared five-round cap retains the remaining findings", async () => {
  const answers = Array.from({ length: 5 }, (_, i) => draft(candidate({ name: `VISIBLE DUE DATE ${i}`, check: "" })));
  const s = await scenario({ answers }); await onRequirementPage(s); await send(s);
  assert.equal(s.endpointRequests.length, 5);
  assert.match(statusOf(s).textContent, /Rounds: 5/);
  await review(s);
  assert.equal(one(s.target, "p", "rounds").textContent, "Correction rounds: 5");
  assert.match(one(s.target, "ul", "left").textContent, /^VISIBLE DUE DATE 4:\d+: error: no check \[A REQUIREMENT HAS FOUR FIELDS\].*add a line/);
  const [left] = keptDraft(s).result.remaining;
  assert.deepEqual([left.artifact, left.kind, left.rule, left.line >= 1], ["VISIBLE DUE DATE 4", "error", "A REQUIREMENT HAS FOUR FIELDS", true]);
  assert.equal(keptDraft(s).result.stoppedBecause, "limit");
});

// TST-418116
// level: release
// module: MOD-prompt-bar; MOD-review-pages; MOD-job-runner
// guards: UC-019; THE CORRECTION LOOP HAS A FIXED LIMIT; A DRAFT THAT FAILS A CHECK GOES BACK TO ITS PARTICIPANT
// given: the same invalid draft on every exchange
// input: Send, then Review the draft
// expect: the unchanged finding ends the loop after two exchanges, with its remaining finding on the page and no proposal
test("TST-418116: an unchanged finding stops early without writing a proposal", async () => {
  const s = await scenario({ answers: [draft(candidate({ check: "" }))] }); await run(s);
  assert.equal(s.endpointRequests.length, 2); assert.equal(proposalWrites(s).length, 0);
  assert.match(one(s.target, "ul", "left").textContent, /no check/);
  assert.equal(keptDraft(s).result.stoppedBecause, "unchanged");
});

// TST-418117
// level: release
// module: MOD-prompt-bar; MOD-job-runner
// guards: UC-019; A DRAFT THAT FAILS A CHECK GOES BACK TO ITS PARTICIPANT; A GENERATED ARTIFACT IS A PROPOSAL
// given: a participant repeatedly returning malformed artifact text (UC-019 6c)
// input: Send
// expect: two correction exchanges, a named unusable result, exact raw answer folded, no Review the draft, no candidate editor, and no write or proposal
test("TST-418117: an unusable answer remains folded and cannot be saved", async () => {
  const raw = "not an artifact: retained verbatim";
  const s = await scenario({ answers: [raw] }); await onRequirementPage(s); await send(s);
  assert.equal(s.endpointRequests.length, 2);
  assert.match(statusOf(s).textContent, /The participant's answer could not be read\. Nothing was changed\./);
  const folded = one(statusOf(s), "details", "raw"); assert.ok(!folded.open);
  assert.equal(one(folded, "pre").textContent, raw);
  assert.equal(all(barOf(s), "button", "review").length, 0);
  assert.equal(all(s.target, "section", "requirements-result").length, 0);
  assert.equal(s.product.writes.length, 0); assert.equal(proposalWrites(s).length, 0); assert.equal(s.product.files["SPEC.md"], SPEC);
});

// TST-418118
// level: release
// module: MOD-review-pages; MOD-spec-changes
// guards: UC-019; A RENAMED REQUIREMENT IS WITHDRAWN AND ADDED
// given: the UC-018 requirement editor that UC-019's freely editable requirement result relies on
// input: rename LOAN to CHANGED, inspect its impact, then Save once with a reason
// expect: the impact explicitly withdraws LOAN and adds CHANGED; the proposal has only the new name, while SPEC remains unchanged
test("TST-418118: a manual requirement rename is proposed as withdrawal plus addition", async () => {
  const s = await scenario(); await onRequirementPage(s);
  const area = all(s.target, "textarea").find((node) => !node.className.split(/\s+/).includes("why"));
  assert.ok(area); area.value = area.value.replace(`**${LOAN}**`, `**${CHANGED}**`); area.dispatchEvent(new Event("input"));
  assert.match(one(s.target, "ul", "impact").textContent, /A LOAN HAS A DUE DATE.*withdrawn.*A DUE DATE IS VISIBLE.*added/s);
  one(s.target, "textarea", "why").value = "Use the displayed name.";
  await save(s);
  assert.equal(s.product.files["SPEC.md"], SPEC); assert.equal(proposalWrites(s).length, 1);
  const text = proposalTexts(s).join("\n"); assert.ok(text.includes(`**${CHANGED}**`)); assert.ok(!text.includes(`**${LOAN}**`));
});

// TST-418119
// level: release
// module: MOD-prompt-bar; MOD-review-pages; MOD-spec-changes
// guards: UC-019; A SAVE IS REFUSED WHEN THE TEXT CHANGED MEANWHILE; A DRAFTED CHANGE IS SHOWN AGAINST THE CURRENT TEXT; THE PAGE NAMES WHERE IT SENDS
// given: a draft, then a newer SPEC section while the author is still on the page, and the page drawn again
// input: write a further instruction in the bar, Send, Review the draft, inspect the current text, then Save
// expect: the new message carries the newer section, the draft shows the newer section as the current text, and Save writes one proposal on it without a refusal
test("TST-418119: a message sent after the section changed uses the latest section as its Save baseline", async () => {
  const s = await scenario({ answers: [draft(), draft(candidate({ rule: "Every loan displays its final due date." }))] }); await run(s);
  const newer = SPEC.replace(CURRENT_RULE, "Every loan states its revised due date."); await s.product.change("SPEC.md", newer);
  await onRequirementPage(s);
  await send(s, "Make the display final.");
  await review(s);
  assert.equal(s.endpointRequests.length, 2);
  assert.match(sentText(s, 1), /Every loan states its revised due date\./);
  assert.match(one(row(s), "section", "current-requirement").textContent, /Every loan states its revised due date\./);
  await save(s); assert.equal(proposalWrites(s).length, 1); assert.equal(s.product.files["SPEC.md"], newer);
});

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const git = (cwd, ...args) => {
  const result = spawnSync("git", args, { cwd, encoding: "utf8", env: { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_SYSTEM: "/dev/null", GIT_TERMINAL_PROMPT: "0" } });
  assert.equal(result.status, 0, result.stderr);
  return args[0] === "show" ? result.stdout : result.stdout.trim();
};
function workflowRepository(root, name, files) {
  const origin = join(root, `${name}.git`), checkout = join(root, "ws", name);
  git(root, "init", "-q", "--bare", "-b", "main", origin);
  git(root, "clone", "-q", origin, checkout);
  git(checkout, "config", "user.name", "Independent release fixture");
  git(checkout, "config", "user.email", "fixture@example.org");
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(join(checkout, path, ".."), { recursive: true }); writeFileSync(join(checkout, path), text);
  }
  git(checkout, "add", "-A"); git(checkout, "commit", "-q", "-m", "Fixture baseline");
  git(checkout, "push", "-q", "origin", "HEAD:refs/heads/main");
  return { origin, checkout, commit: git(checkout, "rev-parse", "HEAD") };
}

async function withWorkflow(s, answers, verify) {
  const root = mkdtempSync(join(tmpdir(), "agent-m-418-ci-"));
  try {
    mkdirSync(join(root, "ws"));
    const instance = workflowRepository(root, "instance", s.instance.files);
    const agentM = { version: "2026.10.0", commit: instance.commit }, id = "JOB-20261014-0900-a418";
    const record = startRecord({ id, kind: "change-requirements", worksOn: [LOAN], participant: "ci-drafter", model: "ci-model", route: "ci hosted",
      run: null, retries: null, startedBy: "github.com/akmaier", start: new Date("2026-10-14T09:00:00Z"), agentM,
      inputs: [LOAN], limit: 5, destinations: [{ participant: "ci-drafter", place: "GitHub Actions in the USA", parts: [LOAN] }],
      params: { requirements: [LOAN], source: SOURCE, instruction: INSTRUCTION,
        endpoint: { name: "fixture", kind: "openai-compatible", baseUrl: "https://fixture-endpoint.example.test/v1", model: "ci-model" } } });
    const product = workflowRepository(root, "product", { ...Object.fromEntries(Object.entries(s.product.files).filter(([path]) => !path.startsWith("docs/jobs/"))), [record.path]: record.text });
    const environment = { GITHUB_ACTIONS: "true", GITHUB_EVENT_NAME: "push", GITHUB_WORKSPACE: join(root, "ws"),
      GITHUB_SERVER_URL: "https://github.com", GITHUB_REPOSITORY: s.repo, GITHUB_REF_NAME: "main", GITHUB_SHA: product.commit,
      GITHUB_RUN_ID: "418", GITHUB_ACTOR: "akmaier", AGENT_M_RUNNER: "hosted", AGENT_M_PRODUCT_DIR: product.checkout,
      AGENT_M_TOKEN_NAME: "AGENT_M_TOKEN", AGENT_M_KEY_NAMES: "CI_KEY", AGENT_M_TOKEN: "github_pat_fixture-person-token", CI_KEY: "fixture-model-key" };
    // CI owns a fresh registry in its own process, not the dashboard's already-registered strategies.
    const script = `import {runEntry} from ${JSON.stringify(new URL("../src/workflow-entries/main.mjs", import.meta.url).href)};
      const answers=${JSON.stringify(answers)},requests=[]; globalThis.fetch=async(url,init={})=>{if(!String(url).startsWith("https://fixture-endpoint.example.test/"))throw Error("uncontrolled request: "+url);requests.push(JSON.parse(init.body));return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify({draft:answers[Math.min(requests.length-1,answers.length-1)],answers:[]})}}]}),{status:200})};
      const status=await runEntry("onRecordsChanged",${JSON.stringify(environment)},{now:new Date("2026-10-14T09:01:00Z")});console.log(JSON.stringify({status,requests}));`;
    const env = { ...process.env }; delete env.NODE_TEST_CONTEXT;
    const invoked = spawnSync(process.execPath, ["--input-type=module", "-e", script], { cwd: ROOT, env, encoding: "utf8", timeout: 15000 });
    assert.equal(invoked.status, 0, invoked.stderr);
    const { status, requests } = JSON.parse(invoked.stdout);
    await verify({ status, requests, agentM, record, product });
  } finally { rmSync(root, { recursive: true, force: true }); }
}

// TST-418120
// level: release
// module: MOD-workflow-entries; MOD-spec-changes; MOD-job-runner
// guards: UC-019; A CI AGENT'S DRAFT ENTERS AS OPEN; ONE DEFINITION, THREE DRIVERS; AN ARTIFACT RECORDS THE VERSION THAT PRODUCED IT
// given: the product of the bar's page and a local workflow workspace with the endpoint-bearing record contract used by the existing working CI runner (the record is written by the test, since the bar offers no hand-over: TST-377013)
// input: invoke the real onRecordsChanged entry on a fresh queued CI record
// expect: the actual workflow writes an undecided queue to main with provenance, never SPEC or an acceptance
test("TST-418120: the actual CI entry commits requirements only as an open proposal", async () => {
  const s = await scenario();
  assert.equal(s.endpointRequests.length, 0); assert.equal(proposalWrites(s).length, 0);
  await withWorkflow(s, [draft()], async ({ status, requests, agentM, product }) => {
    assert.equal(status.outcome, "done", status.summary); assert.equal(requests.length, 1);
    assert.ok(requests[0].messages[0].content.includes(INSTRUCTION)); assert.ok(requests[0].messages[0].content.includes(SHELF));
    assert.equal(git(product.origin, "show", "main:SPEC.md"), SPEC);
    const paths = git(product.origin, "ls-tree", "-r", "--name-only", "main").split("\n");
    assert.ok(paths.some((path) => path.endsWith(".begruendung.md")));
    assert.ok(!paths.some((path) => path.startsWith("docs/approvals/")));
    const decisions = paths.find((path) => path.endsWith("/entscheidungen.md")); assert.ok(decisions);
    assert.doesNotMatch(git(product.origin, "show", `main:${decisions}`), /akzeptiert|accepted/i);
    const messages = git(product.origin, "log", "--format=%B", "main");
    for (const line of [`Agent-M-Version: ${agentM.version}`, "Agent-M-Participant: ci-drafter", "Agent-M-Model: ci-model", "Agent-M-Rounds: 1"]) assert.ok(messages.includes(line), line);
    assert.ok(!messages.split("\n").some((l) => l.includes("Agent-M-Instruction") || l.includes(INSTRUCTION)), "no line names the instruction");
  });
});

// TST-418121
// level: release
// module: MOD-prompt-bar; MOD-job-runner
// guards: UC-019; THE PAGE NAMES WHERE IT SENDS
// given: two existing requirements and no use-case input in the requirements branch
// input: the page of the requirement, an instruction in the bar, Send
// expect: the bar states how many requirements and how many use cases the message holds - 2 requirements and 0 use cases - with the destination
test("TST-418121: the bar states included requirement and use-case counts with its destination", { todo: "FINDING UC019-S10 - the bar names its destination (\"Sent to: drafter — this machine\", onSend in MOD-prompt-bar's bar.mjs) but not how many requirements or use cases the message holds; the run panel that stated them (src/site-frame/run-panel.mjs) is not part of the bar" }, async () => {
  const s = await scenario(); await onRequirementPage(s); await send(s);
  assert.match(statusOf(s).textContent, /^Sent to:drafter — this machine/, "known positive: the destination is named");
  assert.match(statusOf(s).textContent, /2\s+(?:existing\s+)?requirements?\s+(?:included|sent)/i);
  assert.match(statusOf(s).textContent, /0\s+use[ -]cases?\s+(?:included|sent)/i);
});

// TST-418122
// level: release
// module: MOD-job-runner; MOD-runtimes; MOD-review-pages
// guards: UC-019; AN ERROR MUST BE FIXED, A WARNING FIXED OR JUSTIFIED
// given: a warning-containing rule, whose next answer retains it and justifies the exact finding received
// input: Send; fixture participant echoes that finding in answers with how justified and a one-line reason
// expect: the justified warning ends after two rounds with no remaining warning and its reason kept with the draft
test("TST-418122: a warning justified using the received finding ends the loop", async () => {
  const warning = draft(candidate({ rule: "Every loan shows a due date and a time." }));
  const s = await scenario({ answers: [warning, (requests) => {
    const prompt = requests.at(-1).body.messages.map((message) => message.content).join("\n");
    const finding = prompt.split("\n").find((line) => line.includes(": warning:") && line.includes("[ONE STATEMENT PER REQUIREMENT]"));
    assert.ok(finding, "the participant receives the warning to answer");
    return { draft: warning, answers: [{ finding, how: "justified", text: "Date and time are one displayed timestamp." }] };
  }] });
  await run(s);
  assert.equal(s.endpointRequests.length, 2);
  assert.equal(all(one(s.target, "ul", "left"), "li").length, 0, "the justified warning is settled");
  assert.match(JSON.stringify(roundsOf(s)), /Date and time are one displayed timestamp\./);
});

// TST-418123
// level: release
// module: MOD-review-pages; MOD-job-runner; MOD-runtimes
// guards: UC-019; THE ROUNDS ARE COUNTED AND SHOWN
// given: a two-round job whose first draft lacks a check and whose second draft fixes it
// input: Send and Review the draft; inspect the draft page and the draft the bar kept
// expect: the page shows two rounds; the kept draft holds both rounds and the first round's finding "no check"
test("TST-418123: the page and the kept draft show the correction rounds and their findings", async () => {
  const s = await scenario({ answers: brokenThenFixed() }); await run(s);
  assert.match(one(s.target, "p", "rounds").textContent, /2/);
  assert.equal(roundsOf(s).length, 2);
  assert.match(JSON.stringify(roundsOf(s)[0].findings), /no check/);
  assert.deepEqual(roundsOf(s)[1].findings, [], "the second round passes");
});

// TST-418124
// level: release
// module: MOD-workflow-entries; MOD-endpoint-calls; MOD-job-runner; MOD-spec-changes
// guards: UC-019; A DRAFT THAT FAILS A CHECK GOES BACK TO ITS PARTICIPANT; A FINDING READS LIKE A COMPILER MESSAGE; A CI AGENT'S DRAFT ENTERS AS OPEN; ONE DEFINITION, THREE DRIVERS; AN ARTIFACT RECORDS THE VERSION THAT PRODUCED IT
// given: the established local-origin CI fixture; a first candidate has an empty check and the second corrects it
// input: invoke actual onRecordsChanged in a fresh process with controlled endpoint answers on a fresh queued CI record
// expect: two actual model requests; the second contains the exact rejected draft and canonical finding; the corrected proposal stays open, SPEC unchanged, with two-round provenance
test("TST-418124: the actual CI correction request carries its rejected draft and canonical finding", async () => {
  const s = await scenario();
  assert.equal(s.endpointRequests.length, 0); assert.equal(proposalWrites(s).length, 0);
  const invalid = draft(candidate({ check: "" }));
  await withWorkflow(s, [invalid, draft()], async ({ status, requests, agentM, record, product }) => {
    assert.equal(status.outcome, "done", status.summary);
    assert.equal(requests.length, 2, "the actual CI entry makes two model exchanges");
    const correction = requests[1].messages.map((message) => message.content).join("\n");
    assert.ok(correction.includes(JSON.stringify(invalid, null, 2)), "the second actual CI request contains the exact rejected draft");
    const job = git(product.origin, "show", `main:${record.path}`);
    const finding = job.split("\n").find((line) => line.startsWith(`- ${CHANGED}:`) && line.includes(": error: no check [A REQUIREMENT HAS FOUR FIELDS]"));
    assert.ok(finding, "the actual CI job record retains the first-round finding");
    const canonical = finding.slice(2);
    assert.match(canonical, /^A DUE DATE IS VISIBLE:\d+: error: no check \[A REQUIREMENT HAS FOUR FIELDS\] — add a line \*Check:\* that names the test guarding the rule, or says: no automatic check; at review\.$/);
    assert.ok(correction.includes(canonical), "the second actual CI request contains the recorded canonical finding verbatim");
    assert.match(job, /Round 1.*no check.*Round 2.*stopped because: passed/s);
    assert.equal(git(product.origin, "show", "main:SPEC.md"), SPEC);
    const paths = git(product.origin, "ls-tree", "-r", "--name-only", "main").split("\n");
    assert.ok(!paths.some((path) => path.startsWith("docs/approvals/")));
    const decisions = paths.find((path) => path.endsWith("/entscheidungen.md")); assert.ok(decisions);
    assert.doesNotMatch(git(product.origin, "show", `main:${decisions}`), /akzeptiert|accepted/i);
    const proposals = paths.filter((path) => /\/\d\d-[^/]+\.md$/.test(path) && !path.endsWith(".begruendung.md"));
    assert.equal(proposals.length, 1, "the actual workflow writes one corrected proposal");
    const proposal = git(product.origin, "show", `main:${proposals[0]}`);
    assert.ok(proposal.includes(candidate().rule)); assert.ok(proposal.includes(candidate().check));
    const messages = git(product.origin, "log", "--format=%B", "main");
    for (const line of [`Agent-M-Version: ${agentM.version}`, "Agent-M-Participant: ci-drafter", "Agent-M-Model: ci-model", "Agent-M-Rounds: 2"]) assert.ok(messages.includes(line), line);
    assert.ok(!messages.split("\n").some((l) => l.includes("Agent-M-Instruction") || l.includes(INSTRUCTION)), "no line names the instruction");
  });
});

// TST-418125
// level: release
// module: MOD-prompt-bar; MOD-job-runner
// guards: UC-019; THE CORRECTION LOOP HAS A FIXED LIMIT
// given: the page of the requirement and a participant able to draft
// input: an instruction in the bar and Send, with the exchange not yet answered
// expect: the conversation names the limit of correction rounds ("at most 5") before the first round
test("TST-418125: the bar names the limit of correction rounds before the first round", async () => {
  const s = await scenario({ answers: [draft()] }); await onRequirementPage(s);
  await send(s);
  assert.match(statusOf(s).textContent, /at most 5/);
});

// TST-418126
// level: release
// module: MOD-review-pages; MOD-job-runner
// guards: UC-019; A FINDING READS LIKE A COMPILER MESSAGE
// given: five different invalid drafts, the loop ended by its limit with the finding of the last one left
// input: Send, Review the draft; read the finding left on the draft page
// expect: the finding reads in the compiler form with its artifact and line, its kind and the rule by name: "VISIBLE DUE DATE 4:<line>: error: no check [A REQUIREMENT HAS FOUR FIELDS]" followed by the correction expected
test("TST-418126: a finding left on the draft page reads like a compiler message", async () => {
  const answers = Array.from({ length: 5 }, (_, i) => draft(candidate({ name: `VISIBLE DUE DATE ${i}`, check: "" })));
  const s = await scenario({ answers }); await onRequirementPage(s); await send(s); await review(s);
  assert.match(one(s.target, "ul", "left").textContent, /VISIBLE DUE DATE 4:\d+: error: no check \[A REQUIREMENT HAS FOUR FIELDS\].*add a line/);
});

// Counterproofs are requested explicitly; ordinary CI still runs every behavior case. Each fault is confined to a copied
// source tree. The same unchanged case must fail normally, then pass after byte-exact restoration, before its receipt is emitted.
// ITM-514: the faults go into the files the bar and the route `draft` use. A path is joined from its parts.
const at = (...parts) => join(...parts);
const FAULTS = [
  { ids: ["TST-418001"], file: at("src", "trace-pages", "subject.mjs"), from: 'if (name !== undefined && shown.onDefaultBranch) return changing(', to: 'if (false) return changing(' },
  { ids: ["TST-418003"], file: at("src", "trace-pages", "subject.mjs"), from: 'return { requirements: [...names], source: shown.source };', to: 'return { requirements: [...names].slice(0, 1), source: shown.source };' },
  { ids: ["TST-418002", "TST-418003", "TST-418110"], file: at("src", "spec-changes", "propose.mjs"), from: 'files.push({ path: proposalPath, text: change.text }', to: 'files.push({ path: change.target, text: change.text }' },
  { ids: ["TST-418004"], file: at("src", "review-pages", "subjects.mjs"), from: 'if (facts.source === null) throw missingSource();', to: 'if (false) throw missingSource();' },
  { ids: ["TST-418005", "TST-418112"], file: at("src", "spec-changes", "propose.mjs"), from: 'candidate && each.class !== "conflict" && ["new", "change", "duplicate"].includes(each.class)', to: 'candidate && ["new", "change", "duplicate", "conflict"].includes(each.class)' },
  { ids: ["TST-418006", "TST-418111"], file: at("src", "review-pages", "requirements-draft.mjs"), from: 'if (await blobSha(current) !== opened.get(section.anchor))', to: 'if (false)' },
  { ids: ["TST-418101"], file: at("src", "review-pages", "subjects.mjs"), from: 'context.product ? await defaultSnapshot(context.instance.host) : snapshot', to: 'snapshot' },
  { ids: ["TST-418102"], file: at("src", "runtimes", "tab.mjs"), from: 'if (entry.bridge !== null)', to: 'if (false)' },
  { ids: ["TST-418103"], file: at("src", "review-pages", "candidates.mjs"), from: 'entry?.fields.authority ?? "authority not registered"', to: '"authority not registered"' },
  { ids: ["TST-418104", "TST-377007"], file: at("src", "review-pages", "conversation-draft.mjs"), from: 'paramsFor: () => ({ ...draft.params, draft: draft.result })', to: 'paramsFor: () => ({ ...draft.params })' },
  { ids: ["TST-418105", "TST-377004", "TST-418001"], file: at("src", "prompt-bar", "offer.mjs"), from: 'participant.place ?? "no processing place declared"', to: '"no processing place declared"' },
  { ids: ["TST-418105", "TST-418001", "TST-377010"], file: at("src", "prompt-bar", "bar.mjs"), from: 'offered = eligible(reached, { capabilities: kind.needs }).eligible;', to: 'offered = eligible(reached, { capabilities: [] }).eligible;' },
  { ids: ["TST-418106"], file: at("src", "spec-changes", "strategies.mjs"), from: 'for (const queue of await queues(snapshot))', to: 'for (const queue of [])' },
  { ids: ["TST-418107", "TST-377006"], file: at("src", "prompt-bar", "send.mjs"), from: '...prepared.notFitting.map(', to: '...[].map(' },
  { ids: ["TST-418108"], file: at("src", "job-runner", "builtins.mjs"), from: 'if (decided.decidedBy === "rule" &&', to: 'if (false && decided.decidedBy === "rule" &&' },
  { ids: ["TST-418109"], file: at("src", "review-pages", "candidates.mjs"), from: 'showDifference(held?.rule ?? "", rule.value)', to: 'renderArtifact(held?.rule ?? "")' },
  { ids: ["TST-418113", "TST-418124"], file: at("src", "job-runner", "driver-prompt.mjs"), from: 'if (input.findings?.length)', to: 'if (false)' },
  { ids: ["TST-418114", "TST-418122"], file: at("src", "job-runner", "loop.mjs"), from: 'settled.add(line(found))', to: 'settled.delete(line(found))' },
  { ids: ["TST-418115"], file: at("src", "job-runner", "loop.mjs"), from: 'number >= prepared.limit', to: 'number >= 3' },
  { ids: ["TST-418116"], file: at("src", "job-runner", "loop.mjs"), from: 'number > 1 && now.length && same(now, open)', to: 'false' },
  { ids: ["TST-418117", "TST-377015"], file: at("src", "prompt-bar", "bar.mjs"), from: 'if (result.stoppedBecause === "unusable" || draft === null || draft === undefined) {', to: 'if (false) {' },
  { ids: ["TST-418118"], file: at("src", "review-pages", "edit.mjs"), from: '...withdrawn.map((name)', to: '...[].map((name)' },
  { ids: ["TST-418120"], file: at("src", "spec-changes", "propose.mjs"), from: 'files.push({ path: `${base}.md`, text: section.text }', to: 'files.push({ path: "SPEC.md", text: section.text }' },
  { ids: ["TST-418123"], file: at("src", "review-pages", "conversation-draft.mjs"), from: 'target.append(...roundsAndLeft(draft.result), await requirementsDraft(', to: 'target.append(await requirementsDraft(' },
  { ids: ["TST-418124"], file: at("src", "endpoint-calls", "index.mjs"), from: 'driverRequest(config, driverPrompt(input), options.signal)', to: 'driverRequest(config, input.prompt, options.signal)' },
  { ids: ["TST-377005"], file: at("src", "prompt-bar", "bar.mjs"), from: 'send.addEventListener("click", onSend);', to: 'input.addEventListener("input", onSend);' },
  { ids: ["TST-377008"], file: at("src", "prompt-bar", "bar.mjs"), from: 'if (draft.handOver) {', to: 'if (false) {' },
  { ids: ["TST-377004"], file: at("src", "review-pages", "subjects.mjs"), from: 'params: { [kind.change.parameter]: id, version: snapshot.blob(path) } };', to: 'params: { [kind.change.parameter]: "UC-008", version: snapshot.blob(path) } };' },
  { ids: ["TST-377009"], file: at("src", "review-pages", "conversation-draft.mjs"), from: 'rounds: draft.result.rounds.length', to: 'rounds: 0' },
];
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
async function counterproofs() {
  const temporary = realpathSync(mkdtempSync(join(tmpdir(), "agent-m-418-fault-"))), copied = join(temporary, "agent-m");
  const tests = ["tests/system-uc-019-change-requirements-by-prompt.test.mjs", "tests/system-uc-019-change-by-prompt.test.mjs", "tests/release-uc-019-change-requirements-by-prompt.test.mjs"];
  const helpers = ["tests/app-harness.mjs", "tests/review-pages-draft-world.mjs", "tests/review-pages-harness.mjs", "tests/markdown-render-dom.mjs", "tests/site-frame-dom.mjs", "tests/uc-019-prompt-bar-harness.mjs"];
  const receipts = [], receiptPath = join(tmpdir(), `agent-m-418-counterproof-${process.pid}.json`);
  try {
    cpSync(join(ROOT, "src"), join(copied, "src"), { recursive: true, filter: (path) => !path.split(/[\\/]/).includes("node_modules") });
    cpSync(join(ROOT, "docs"), join(copied, "docs"), { recursive: true });
    mkdirSync(join(copied, "tests"), { recursive: true });
    for (const file of [...tests, ...helpers]) cpSync(join(ROOT, file), join(copied, file));
    const testHashes = Object.fromEntries(tests.map((path) => [path, hash(readFileSync(join(copied, path)))]));
    for (const fault of FAULTS) {
      const path = join(copied, fault.file), original = readFileSync(path), text = original.toString();
      assert.ok(text.includes(fault.from), `known-positive fault point: ${fault.file}: ${fault.from}`);
      const mutated = Buffer.from(text.replace(fault.from, fault.to)); assert.notDeepEqual(mutated, original);
      const argv = [process.execPath, "--test", "--test-reporter=tap", "--test-name-pattern", fault.ids.join("|"), ...tests.map((path) => join(copied, path))];
      const env = { ...process.env, AGENT_M_418_FAULT_CHILD: "1" }; delete env.NODE_TEST_CONTEXT;
      const invoke = () => spawnSync(argv[0], argv.slice(1), { cwd: copied, env, encoding: "utf8", timeout: 60000, maxBuffer: 16 * 1024 * 1024 });
      const started = new Date().toISOString(); writeFileSync(path, mutated);
      const failed = invoke(); writeFileSync(path, original);
      const restoredHash = hash(readFileSync(path)), passed = invoke(), ended = new Date().toISOString();
      const nodes = Object.fromEntries(fault.ids.map((id) => [id, failed.stdout.match(new RegExp(`^not ok \\d+ - ${id}:[\\s\\S]*?(?=\\n# Subtest:|\\n1\\.\\.)`, "m"))?.[0] ?? null]));
      const receipt = { ...fault, participant: "developer-sonnet-e", sourceCommit: git(ROOT, "rev-parse", "HEAD"),
        testsUncommitted: git(ROOT, "diff", "HEAD", "--", ...tests) !== "", cwd: copied, argv,
        environment: { AGENT_M_418_FAULT_CHILD: "1", NODE_TEST_CONTEXT: null },
        sourceHashes: { original: hash(original), planted: hash(mutated), restored: restoredHash }, testHashes, started, ended,
        red: { status: failed.status, signal: failed.signal, error: failed.error?.code ?? null, nodes, stdout: failed.stdout, stderr: failed.stderr },
        green: { status: passed.status, signal: passed.signal, error: passed.error?.code ?? null, stdout: passed.stdout, stderr: passed.stderr } };
      receipts.push(receipt); writeFileSync(receiptPath, JSON.stringify(receipts, null, 2));
      assert.equal(restoredHash, hash(original), "exact source bytes are restored before the positive");
      assert.equal(failed.status, 1, failed.stderr); assert.equal(failed.signal, null); assert.equal(failed.error, undefined);
      for (const id of fault.ids) assert.ok(nodes[id], `${id}: an actual named failure node, not an import or launcher failure`);
      assert.equal(passed.status, 0, passed.stdout + passed.stderr); assert.equal(passed.signal, null); assert.equal(passed.error, undefined);
      for (const id of fault.ids) assert.match(passed.stdout, new RegExp(`^ok \\d+ - ${id}:`, "m"));
      for (const [file, expected] of Object.entries(testHashes)) assert.equal(hash(readFileSync(join(copied, file))), expected, "test bytes stay unchanged");
      console.log(`ITM-418-counterproof ${JSON.stringify({ ids: fault.ids, source: fault.file, sourceHashes: receipt.sourceHashes, red: 1, green: 0, receiptPath })}`);
    }
  } finally { rmSync(temporary, { recursive: true, force: true }); }
}
if (process.env.AGENT_M_418_COUNTERPROOF === "1" && !process.env.AGENT_M_418_FAULT_CHILD) after(counterproofs);

// Waits, with the servers settled, until a condition holds.
async function until(s, condition) {
  for (let turn = 0; turn < 200 && !condition(); turn += 1) await rest(s);
  assert.ok(condition(), "the condition did not hold");
}
