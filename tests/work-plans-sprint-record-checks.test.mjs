// The check `sprint-record-checks` of MOD-work-plans' workStrategies (ITM-619; UC-041 steps 2 to 6), as docs/architecture/MOD-work-plans.md:247-250 states it: "an agent's review that does not name the
// sources of its feedback, or does not say that no stakeholder took part when none did (`AN AGENT'S REVIEW NAMES WHERE ITS FEEDBACK CAME FROM`); a retrospective without an entry; a change to the
// process written as applied rather than proposed (`AN AGENT'S RETROSPECTIVE CHANGES NO PROCESS BY ITSELF`)".
// Run: node --test tests/work-plans-sprint-record-checks.test.mjs
//
// Module: MOD-work-plans
// Guards: UC-041; AN AGENT'S REVIEW NAMES WHERE ITS FEEDBACK CAME FROM; AN AGENT'S RETROSPECTIVE CHANGES NO PROCESS BY ITSELF; A SPRINT ENDS WITH A RETROSPECTIVE
// Level: unit
//
// The check is called as the job runner calls a check, check(draft, context), with the draft of a job of the kind `close-sprint`, which has the shape of closeSprint's `close`
// (MOD-work-plans.md:222-227): { sprint, review: { feedback: [{ line, goes, item }], tookPart: [name], sources: [name] | null }, unfinished, retrospective: [{ text, kind, goes }], newItems }.
// A `close-sprint` job is always an agent's, so every draft it checks is an agent's review. The readings settled in the item (065ceac0), each stated by the test that takes it:
//   - Each name in `tookPart` must be one whose feedback the review recorded: it stands in a feedback line or among the sources (compared without regard to case).
//   - An empty `tookPart` passes only when a feedback line says that no stakeholder took part.
//   - An entry of kind `change` without `goes` is an error; a draft with a key outside the shape of `close` (at its top, in the review or in an entry of the retrospective) is an error.
// A finding is MOD-text-tools' finding: an error that names its rule. A clean draft gives none. The counter-proofs are recorded in the pull request.

import test from "node:test";
import assert from "node:assert/strict";

const { workStrategies } = await import("../src/work-plans/index.mjs");
const check = workStrategies.checks?.["sprint-record-checks"];

const REVIEW_RULE = "AN AGENT'S REVIEW NAMES WHERE ITS FEEDBACK CAME FROM";
const RETRO_RULE = "A SPRINT ENDS WITH A RETROSPECTIVE";
const PROCESS_RULE = "AN AGENT'S RETROSPECTIVE CHANGES NO PROCESS BY ITSELF";

const feedback = (line) => ({ line, goes: "noted", item: null });
const draft = (over = {}) => ({
  sprint: "team1/01",
  review: { feedback: [feedback("Issue #12 asks for a dark mode (issue tracker).")], tookPart: [], sources: ["issue #12"], ...(over.review ?? {}) },
  unfinished: [],
  retrospective: [{ text: "Jobs failed twice on the same test.", kind: "did not go well", goes: null }],
  newItems: [],
  ...Object.fromEntries(Object.entries(over).filter(([key]) => key !== "review")),
});
// The draft of the first test: a review that records no stakeholder feedback and says so.
const NONE = "No stakeholder took part; no feedback came from one.";
const clean = (over = {}) => draft({ ...over, review: { feedback: [feedback(NONE), feedback("Issue #12 asks for a dark mode.")], tookPart: [], sources: ["issue #12", "job JOB-20261010-0900-aaaa"], ...(over.review ?? {}) } });
const run = (value) => {
  assert.equal(typeof check, "function", "workStrategies offers the check sprint-record-checks");
  return check(value, { params: {} });
};
const rules = (found) => found.map((each) => each.rule);

// TST-619001 · level: unit · module: MOD-work-plans
// guards: UC-041; AN AGENT'S REVIEW NAMES WHERE ITS FEEDBACK CAME FROM
// given: an agent's close whose review names its sources and says that no stakeholder took part, with a retrospective whose one change is a proposal (goes: "team agreement")
// input: the check on that draft
// expect: no finding — the known positive of every test below
test("sprint-record-checks — a review with sources that says no stakeholder took part, and a retrospective of proposals, gives no finding", async () => {
  const found = await run(clean({ retrospective: [{ text: "Gates cost time.", kind: "change", goes: "team agreement" }, { text: "Reviews were quick.", kind: "went well", goes: null }] }));
  assert.deepEqual(found, []);
});

// TST-619002 · level: unit · module: MOD-work-plans
// guards: UC-041; AN AGENT'S REVIEW NAMES WHERE ITS FEEDBACK CAME FROM
// given: the clean draft, then the same with the sources null, and with the sources empty
// input: the check on each
// expect: the clean one gives no finding; each of the others gives exactly one error under AN AGENT'S REVIEW NAMES WHERE ITS FEEDBACK CAME FROM, naming the sources
test("sprint-record-checks — a review that names no source is an error", async () => {
  assert.deepEqual(await run(clean()), []);
  for (const sources of [null, []]) {
    const found = await run(clean({ review: { sources } }));
    assert.deepEqual(rules(found), [REVIEW_RULE], String(JSON.stringify(sources)));
    assert.equal(found[0].kind, "error");
    assert.match(found[0].what, /sources/);
  }
});

// TST-619003 · level: unit · module: MOD-work-plans
// guards: UC-041; AN AGENT'S REVIEW NAMES WHERE ITS FEEDBACK CAME FROM
// given: a review with a stakeholder, Erika, in tookPart: first her feedback is recorded in a feedback line, then she stands among the sources, then neither; and a review with two names of which one is recorded
// input: the check on each
// expect: no finding while the feedback of each name is recorded in a line or among the sources (without regard to case); one error naming the name whose feedback is recorded nowhere
test("sprint-record-checks — a stakeholder who took part must have feedback recorded in a line or among the sources", async () => {
  const line = draft({ review: { feedback: [feedback("Erika asked for a smaller export (mail MAIL-ca171c6d1e8e76f0).")], tookPart: ["Erika"], sources: ["mail MAIL-ca171c6d1e8e76f0"] } });
  assert.deepEqual(await run(line), [], "recorded in a feedback line");
  const among = draft({ review: { feedback: [feedback("A smaller export is wanted.")], tookPart: ["erika"], sources: ["interview notes of Erika"] } });
  assert.deepEqual(await run(among), [], "recorded among the sources, whatever the case");
  const nowhere = await run(draft({ review: { feedback: [feedback("A smaller export is wanted.")], tookPart: ["Erika"], sources: ["issue #12"] } }));
  assert.deepEqual(rules(nowhere), [REVIEW_RULE]);
  assert.match(nowhere[0].what, /Erika/);
  const two = await run(draft({ review: { feedback: [feedback("Erika asked for a smaller export.")], tookPart: ["Erika", "Frank"], sources: ["issue #12"] } }));
  assert.deepEqual(rules(two), [REVIEW_RULE]);
  assert.match(two[0].what, /Frank/);
  assert.doesNotMatch(two[0].what, /Erika/);
});

// TST-619004 · level: unit · module: MOD-work-plans
// guards: UC-041; AN AGENT'S REVIEW NAMES WHERE ITS FEEDBACK CAME FROM
// given: a review with an empty tookPart and no feedback line that says no stakeholder took part; then one with such a line
// input: the check on each
// expect: the first gives one error under AN AGENT'S REVIEW NAMES WHERE ITS FEEDBACK CAME FROM saying that the review must state that no stakeholder took part; the second none
test("sprint-record-checks — an empty tookPart passes only when a feedback line says that no stakeholder took part", async () => {
  const silent = await run(draft());
  assert.deepEqual(rules(silent), [REVIEW_RULE]);
  assert.match(silent[0].what, /no stakeholder took part/);
  assert.deepEqual(await run(clean()), []);
  assert.deepEqual(rules(await run(draft({ review: { feedback: [], tookPart: [], sources: ["issue #12"] } }))), [REVIEW_RULE], "no feedback line at all");
  const other = await run(draft({ review: { feedback: [feedback("A stakeholder was asked, but did not answer in time.")], tookPart: [], sources: ["issue #12"] } }));
  assert.deepEqual(rules(other), [REVIEW_RULE], "a line that merely mentions a stakeholder does not say that none took part");
});

// TST-619005 · level: unit · module: MOD-work-plans
// guards: UC-041; A SPRINT ENDS WITH A RETROSPECTIVE
// given: the clean draft with an empty retrospective
// input: the check on it
// expect: one error under A SPRINT ENDS WITH A RETROSPECTIVE
test("sprint-record-checks — a retrospective without an entry is an error", async () => {
  const found = await run(clean({ retrospective: [] }));
  assert.deepEqual(rules(found), [RETRO_RULE]);
  assert.equal(found[0].kind, "error");
});

// TST-619006 · level: unit · module: MOD-work-plans
// guards: UC-041; AN AGENT'S RETROSPECTIVE CHANGES NO PROCESS BY ITSELF
// given: a retrospective whose entry of kind change has no `goes`; then the same entry with goes "Definition of Done", "process model" and "a participant's instructions"
// input: the check on each
// expect: the first gives one error under AN AGENT'S RETROSPECTIVE CHANGES NO PROCESS BY ITSELF naming the entry; the others none — closeSprint writes them as "change, to <goes>", a proposal to where it goes
test("sprint-record-checks — a change without the place it is proposed to is an error, one with it a proposal", async () => {
  const bare = await run(clean({ retrospective: [{ text: "Run the tests twice.", kind: "change", goes: null }] }));
  assert.deepEqual(rules(bare), [PROCESS_RULE]);
  assert.match(bare[0].what, /Run the tests twice\./);
  for (const goes of ["Definition of Done", "process model", "a participant's instructions"]) {
    assert.deepEqual(await run(clean({ retrospective: [{ text: "Run the tests twice.", kind: "change", goes }] })), [], goes);
  }
  assert.deepEqual(await run(clean({ retrospective: [{ text: "It went well.", kind: "went well", goes: null }] })), [], "an entry that is no change needs no place");
});

// TST-619007 · level: unit · module: MOD-work-plans
// guards: UC-041; AN AGENT'S RETROSPECTIVE CHANGES NO PROCESS BY ITSELF
// given: the clean draft with a key outside the shape of close — a `files` list to write at its top, a `writes` key in the review, a `file` key in a retrospective entry
// input: the check on each
// expect: one error each under AN AGENT'S RETROSPECTIVE CHANGES NO PROCESS BY ITSELF naming the key: nothing of the process may be written by the draft itself
test("sprint-record-checks — a draft with a key outside the shape of close, such as a file to write, is an error", async () => {
  const top = await run(clean({ files: [{ path: "docs/process.md", text: "changed" }] }));
  assert.deepEqual(rules(top), [PROCESS_RULE]);
  assert.match(top[0].what, /files/);
  const inReview = await run(clean({ review: { writes: ["docs/process.md"] } }));
  assert.deepEqual(rules(inReview), [PROCESS_RULE]);
  assert.match(inReview[0].what, /writes/);
  const inEntry = await run(clean({ retrospective: [{ text: "Change the model.", kind: "change", goes: "process model", file: "docs/process-models/x.md" }] }));
  assert.deepEqual(rules(inEntry), [PROCESS_RULE]);
  assert.match(inEntry[0].what, /file/);
});

// TST-619008 · level: unit · module: MOD-work-plans
// guards: UC-041
// given: a draft with several faults at once: no sources, an empty tookPart without the statement, no retrospective, and a key to write
// input: the check on it
// expect: one error for each of the four, in the order of the review's, the retrospective's and the process's rules; each finding is MOD-text-tools' finding with the line 1
test("sprint-record-checks — every fault of a draft is found, each once", async () => {
  const found = await run({ sprint: "team1/01", review: { feedback: [], tookPart: [], sources: null }, unfinished: [], retrospective: [], newItems: [], files: [] });
  assert.deepEqual(rules(found), [REVIEW_RULE, REVIEW_RULE, RETRO_RULE, PROCESS_RULE]);
  for (const each of found) assert.deepEqual(Object.keys(each).sort(), ["artifact", "fix", "kind", "line", "rule", "what"]);
  assert.ok(found.every((each) => each.line === 1 && each.kind === "error"));
});

// TST-619009 · level: unit · module: MOD-work-plans
// guards: UC-041
// given: the module's workStrategies
// input: its recipes and checks
// expect: the recipe architecture-and-model, built before, is still there beside the check sprint-record-checks, and the recipes are those built so far, architecture-and-model, backlog-inputs (ITM-615) and sprint-facts (ITM-618): nothing already registered changes
test("workStrategies — adds the check and changes no registration", () => {
  assert.equal(typeof workStrategies.recipes["architecture-and-model"], "function");
  assert.equal(typeof workStrategies.checks?.["sprint-record-checks"], "function");
  assert.deepEqual(Object.keys(workStrategies.recipes), ["architecture-and-model", "backlog-inputs", "sprint-facts"]);
});
