# Module: MOD-job-runner
# Guards: THE CORRECTION LOOP HAS A FIXED LIMIT; THE ROUNDS ARE COUNTED AND SHOWN; A REVIEWER'S FINDING IS A WARNING
# Guards: A DRAFT THAT FAILS A CHECK GOES BACK TO ITS PARTICIPANT; AN ERROR MUST BE FIXED, A WARNING FIXED OR JUSTIFIED
# Guards: WHAT A PERSON DECIDES IS NOT SENT BACK; A FINDING READS LIKE A COMPILER MESSAGE
# Level: component
"""SPEC: the correction loop of every job.

Fixture jobs of the catalogue's kinds are prepared and run with MOD-job-runner's prepareJob and runJob. The drivers are
fixture participants that answer from a list and keep every input they were sent; the checks are stand-ins that find what
each run sets — the strategies the kinds name come from modules that do not offer them yet. Each run's result, its round
record (roundsText) and every input its participants received are returned, and compared here. Asked through node
(tests/jsrun.py).
"""
import re
import unittest

from jsrun import js

RUNS = r"""
const findingOf = (fields) => ({ artifact: "docs/use-cases/UC-001-x.md", line: 3, kind: "error",
  rule: "A USE CASE REALISES NAMED REQUIREMENTS", what: "realises \"EXPORT\" matches no requirement",
  fix: "use an existing name or remove the line", ...fields });
let find = () => [];
const standIns = {
  preconditions: { "rests-on-accepted": async () => null, "architecture-ready": async () => null },
  recipes: Object.fromEntries(["chosen-requirements", "use-cases", "chapters-for-requirements", "source-excerpt",
    "spec-with-queues", "whole-spec", "accepted-use-cases", "whole-architecture", "chapters-for-architecture"]
    .map((name) => [name, async () => [{ name, text: `the text of ${name}`, size: 0, sources: [], required: true }]])),
  checks: Object.fromEntries(["document-schema", "graph-checks stand-in", "candidate-classes", "requirement-form"]
    .map((name) => [name, (draft) => (name === "graph-checks stand-in" ? find(draft) : [])])),
  steps: { "due-diligence": async (draft) => ({ draft, findings: [] }) },
  writers: Object.fromEntries(["open-files", "queue-entries"].map((name) => [name,
    async (result) => ({ commits: [], files: [], pullRequest: null, shown: result.draft })])),
};
for (const [category, strategies] of Object.entries(standIns)) for (const [name, strategy] of Object.entries(strategies)) {
  try { jobRunner.registerStrategies("tests/test_correction_loop.py", { [category]: { [name]: strategy } }); }
  catch (error) { if (error.name !== "DuplicateStrategy") throw error; }
}
const participant = (name, model) => ({ name, type: "CLI agent", model, context: 200000, price: null,
  capabilities: ["draft text"], place: "this machine", route: "bridge lab-pc agent claude" });
const drafterP = participant("drafter-a", "example-model"), reviewerP = participant("reviewer-c", "other-model");
const driver = (who, answers) => { const inputs = []; return { participant: who, inputs, async send(input) {
  inputs.push(input); const next = answers.shift(); return { text: JSON.stringify(next), usage: null }; } }; };
const line = (f) => textTools.formatFinding(f);
const files = (text) => ({ files: [{ path: "docs/use-cases/UC-001-x.md", text, class: "new" }] });
async function run(kindName, { drafterAnswers, reviewerAnswers = null, limit, attended = true }) {
  const kind = await jobCatalogue.kindOf(kindName);
  const context = { kind, params: {}, product: { address: "https://github.com/alice/product", snapshot: null, host: null },
    instance: { snapshot: null, host: null }, connect: async () => null, participants: [drafterP, reviewerP],
    places: { sources: {}, mailbox: null }, gates: [], person: "alice", now: new Date(), agentM: { version: "unreleased",
    commit: "0".repeat(40) }, jobId: "JOB-20261011-0800-abcd" };
  const reviewers = reviewerAnswers ? [reviewerP] : [];
  // These runs drive the loop with the findings they set. Their drafts are no documents of the artifact model, which the
  // runner's own check document-schema judges (tests/job-runner-document-schema.test.mjs), so their kinds run without it; and
  // the runner registers graph-checks itself (tests/job-runner-graph-checks.test.mjs), so its stand-in, registered under a name
  // of its own, is put in its place.
  const prepared = await jobRunner.prepareJob(kindName, context, { drafter: drafterP, reviewers, limit });
  const job = { ...prepared, kind: { ...prepared.kind, checks: prepared.kind.checks.filter((check) => check !== "document-schema")
    .map((check) => (check === "graph-checks" ? "graph-checks stand-in" : check)) } };
  const drafter = driver(drafterP, drafterAnswers);
  const reviewerDrivers = reviewerAnswers ? [driver(reviewerP, reviewerAnswers)] : [];
  const result = await jobRunner.runJob(job, { drafter, reviewers: reviewerDrivers }, { attended, context });
  const findings = [...result.rounds.flatMap((round) => round.findings), ...result.remaining, ...result.forPerson];
  return { asked: drafter.inputs.length, stopped: result.stoppedBecause, draft: result.draft,
    remaining: result.remaining.map(line), forPerson: result.forPerson.map(line), findings: findings.map(line),
    sent: drafter.inputs.map((input) => input.prompt + "\n" + input.findings.map(line).join("\n")),
    record: jobRunner.roundsText(result.rounds, result.remaining, result.forPerson, result.stoppedBecause, job.limit) };
}
const out = {};

find = (draft) => [findingOf({ what: `draft ${draft.files[0].text} realises an unknown name` })];
out.limit = await run("derive-use-cases", { limit: 3, drafterAnswers: [1, 2, 3].map((n) => ({ draft: files(String(n)) })) });
out.unchanged = await run("derive-use-cases", { limit: 3, drafterAnswers: [1, 1].map((n) => ({ draft: files(String(n)) })) });

const unknown = findingOf({});
find = (draft) => (JSON.stringify(draft).includes("EXPORT") ? [unknown] : []);
const corrected = files("realises: SAVE");
out.corrected = await run("derive-use-cases", { drafterAnswers: [{ draft: files("realises: EXPORT") },
  { draft: corrected, answers: [{ finding: line(unknown), how: "fixed" }] }] });
out.correctedDraft = corrected;
out.loopOff = await run("derive-use-cases", { limit: 1, drafterAnswers: [{ draft: files("realises: EXPORT") }] });

for (const kind of ["warning", "error"]) {
  const found = findingOf({ kind, rule: "ONE STATEMENT PER REQUIREMENT", what: "the rule contains \"and\"" });
  find = () => [found];
  out[`justified ${kind}`] = await run("derive-use-cases", { drafterAnswers: [{ draft: files("x") },
    { draft: files("x"), answers: [{ finding: line(found), how: "justified", text: "the two clauses name one condition" }] }] });
}

find = () => [];
const review = { findings: [{ artifact: "MOD-x", line: 4, rule: "DEVELOP AGAINST INTERFACES", what: "uses MOD-y's code",
  fix: "use its interface" }] };
const warning = line({ ...review.findings[0], kind: "warning" });
const architecture = { files: [{ path: "docs/architecture/MOD-x.md", text: "MOD-x", class: "new" }] };
out.reviewAnswered = await run("derive-architecture", { reviewerAnswers: [{ draft: review }, { draft: review }],
  drafterAnswers: [{ draft: architecture }, { draft: architecture, answers: [{ finding: warning, how: "answered",
    text: "it uses MOD-y's interface, as its Uses say" }] }] });
out.reviewUnanswered = await run("derive-architecture", { reviewerAnswers: [{ draft: review }, { draft: review }],
  drafterAnswers: [{ draft: architecture }, { draft: architecture }] });
return out;
"""

# The conflict run needs a check that finds the conflict on derive-requirements; it is its own call, so that its stand-in
# for candidate-classes finds what the other runs' check does not. The runner registers candidate-classes itself
# (tests/job-runner-candidate-classes.test.mjs), so the stand-in is registered under a name of this run's own, which the
# run puts in the kind's place.
CONFLICT = r"""
const conflict = { artifact: "SPEC.md", line: 9, kind: "error", rule: "A CONFLICT IS DECIDED BY A PERSON",
  what: "\"EXPORT AS CSV\" contradicts EXPORT IS A PDF", fix: "decide which holds" };
const standIns = {
  recipes: Object.fromEntries(["source-excerpt", "spec-with-queues", "chapters-for-requirements"]
    .map((name) => [name, async () => [{ name, text: `the text of ${name}`, size: 0, sources: [], required: true }]])),
  checks: { "requirement-form": () => [], "candidate-classes stand-in": () => [conflict] },
  writers: { "queue-entries": async () => ({ commits: [], files: [], pullRequest: null, shown: null }) },
};
for (const [category, strategies] of Object.entries(standIns)) for (const [name, strategy] of Object.entries(strategies)) {
  try { jobRunner.registerStrategies("tests/test_correction_loop.py", { [category]: { [name]: strategy } }); }
  catch (error) { if (error.name !== "DuplicateStrategy") throw error; }
}
const drafterP = { name: "drafter-a", type: "CLI agent", model: "example-model", context: 200000, price: null,
  capabilities: ["draft text"], place: "this machine", route: "bridge lab-pc agent claude" };
const inputs = [];
const candidates = { candidates: [{ name: "EXPORT AS CSV", rule: "r", check: "c", constrains: "product", passage: "p",
  class: "conflict", of: "EXPORT IS A PDF" }] };
const drafter = { participant: drafterP, async send(input) { inputs.push(input); return { text: JSON.stringify({ draft: candidates }),
  usage: null }; } };
const kind = await jobCatalogue.kindOf("derive-requirements");
const context = { kind, params: {}, product: { address: "https://github.com/alice/product", snapshot: null, host: null },
  instance: { snapshot: null, host: null }, connect: async () => null, participants: [drafterP],
  places: { sources: {}, mailbox: null }, gates: [], person: "alice", now: new Date(), agentM: { version: "unreleased",
  commit: "0".repeat(40) }, jobId: null };
// This run drives the loop with the finding it sets. Its candidate is no requirement as the artifact model reads one, which the
// runner's own check requirement-form judges (tests/job-runner-requirement-form.test.mjs), so its kind runs without it, and
// with the stand-in in the place of candidate-classes.
const prepared = await jobRunner.prepareJob("derive-requirements", context, { drafter: drafterP, reviewers: [] });
const job = { ...prepared, kind: { ...prepared.kind, checks: prepared.kind.checks.filter((check) => check !== "requirement-form")
  .map((check) => (check === "candidate-classes" ? "candidate-classes stand-in" : check)) } };
const result = await jobRunner.runJob(job, { drafter, reviewers: [] }, { attended: true, context });
return { conflict: textTools.formatFinding(conflict), forPerson: result.forPerson.map(textTools.formatFinding),
  sent: inputs.map((input) => input.prompt + "\n" + input.findings.map(textTools.formatFinding).join("\n")),
  findings: [...result.rounds.flatMap((r) => r.findings), ...result.remaining, ...result.forPerson].map(textTools.formatFinding) };
"""

TEMPLATE = re.compile(r"^[^\s:]+:\d+: (error|warning): .+ \[[A-Z][A-Z0-9 ,'-]*[A-Z0-9]\] — .+\.$")


class CorrectionLoop(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.runs = js(RUNS)
        cls.conflict = js(CONFLICT)

    # TST-475002 · level: component · module: MOD-job-runner
    # guards: THE CORRECTION LOOP HAS A FIXED LIMIT; THE ROUNDS ARE COUNTED AND SHOWN; A REVIEWER'S FINDING IS A WARNING; A DRAFT THAT FAILS A CHECK GOES BACK TO ITS PARTICIPANT; AN ERROR MUST BE FIXED, A WARNING FIXED OR JUSTIFIED; WHAT A PERSON DECIDES IS NOT SENT BACK; A FINDING READS LIKE A COMPILER MESSAGE
    # given: fixture jobs with a participant that answers from a list and a stand-in check that always finds an error
    # input: one run where the error is never fixed (limit) and one where the draft stays unchanged
    # expect: the never-fixing participant is asked 3 times, stops at limit, 1 error remains; the unchanged draft is asked 2 times, stops as unchanged, 1 error remains
    def test_a_participant_that_never_fixes_its_error_is_asked_exactly_limit_times_or_once_more_than_a_round_without_change(self):
        limit, unchanged = self.runs["limit"], self.runs["unchanged"]
        self.assertEqual((limit["asked"], limit["stopped"], len(limit["remaining"])), (3, "limit", 1))
        self.assertEqual((unchanged["asked"], unchanged["stopped"], len(unchanged["remaining"])), (2, "unchanged", 1))

    # TST-475003 · level: component · module: MOD-job-runner
    # guards: THE CORRECTION LOOP HAS A FIXED LIMIT; THE ROUNDS ARE COUNTED AND SHOWN; A REVIEWER'S FINDING IS A WARNING; A DRAFT THAT FAILS A CHECK GOES BACK TO ITS PARTICIPANT; AN ERROR MUST BE FIXED, A WARNING FIXED OR JUSTIFIED; WHAT A PERSON DECIDES IS NOT SENT BACK; A FINDING READS LIKE A COMPILER MESSAGE
    # given: the limit run of the fixture jobs, with its round record (roundsText)
    # input: the round record of the run that reached the limit
    # expect: the record has the headings Round 1, 2, 3 and the line 'stopped because: limit · limit: 3'
    def test_the_rounds_are_counted_and_shown(self):
        record = self.runs["limit"]["record"]
        self.assertEqual(re.findall(r"^### Round (\d+)", record, re.M), ["1", "2", "3"])
        self.assertIn("stopped because: limit · limit: 3", record)

    # TST-475004 · level: component · module: MOD-job-runner
    # guards: THE CORRECTION LOOP HAS A FIXED LIMIT; THE ROUNDS ARE COUNTED AND SHOWN; A REVIEWER'S FINDING IS A WARNING; A DRAFT THAT FAILS A CHECK GOES BACK TO ITS PARTICIPANT; AN ERROR MUST BE FIXED, A WARNING FIXED OR JUSTIFIED; WHAT A PERSON DECIDES IS NOT SENT BACK; A FINDING READS LIKE A COMPILER MESSAGE
    # given: a fixture participant that fixes the finding in its second answer
    # input: a draft that fails a check is run through the loop
    # expect: the participant is asked 2 times, the run stops as passed with no finding remaining, and the person gets the corrected draft
    def test_a_draft_that_fails_a_check_goes_back_and_the_person_sees_only_the_corrected_draft(self):
        corrected = self.runs["corrected"]
        self.assertEqual((corrected["asked"], corrected["stopped"], corrected["remaining"]), (2, "passed", []))
        self.assertEqual(corrected["draft"], self.runs["correctedDraft"])

    # TST-475005 · level: component · module: MOD-job-runner
    # guards: THE CORRECTION LOOP HAS A FIXED LIMIT; THE ROUNDS ARE COUNTED AND SHOWN; A REVIEWER'S FINDING IS A WARNING; A DRAFT THAT FAILS A CHECK GOES BACK TO ITS PARTICIPANT; AN ERROR MUST BE FIXED, A WARNING FIXED OR JUSTIFIED; WHAT A PERSON DECIDES IS NOT SENT BACK; A FINDING READS LIKE A COMPILER MESSAGE
    # given: the same failing draft with the correction loop switched off
    # input: the run with the loop off
    # expect: the participant is asked once, stops at limit, and the error remains for the person ('matches no requirement')
    def test_counter_proof_with_the_loop_switched_off_the_person_sees_the_error(self):
        off = self.runs["loopOff"]
        self.assertEqual((off["asked"], off["stopped"], len(off["remaining"])), (1, "limit", 1))
        self.assertIn("matches no requirement", off["remaining"][0])

    # TST-475006 · level: component · module: MOD-job-runner
    # guards: THE CORRECTION LOOP HAS A FIXED LIMIT; THE ROUNDS ARE COUNTED AND SHOWN; A REVIEWER'S FINDING IS A WARNING; A DRAFT THAT FAILS A CHECK GOES BACK TO ITS PARTICIPANT; AN ERROR MUST BE FIXED, A WARNING FIXED OR JUSTIFIED; WHAT A PERSON DECIDES IS NOT SENT BACK; A FINDING READS LIKE A COMPILER MESSAGE
    # given: fixture runs where the participant answers a finding with a justification, once for a warning and once for an error
    # input: the justified warning run and the justified error run
    # expect: the justified warning ends the loop (passed, nothing remaining); the unfixed error does not (unchanged, 1 remaining)
    def test_a_justified_warning_ends_the_loop_an_unfixed_error_does_not(self):
        warning, error = self.runs["justified warning"], self.runs["justified error"]
        self.assertEqual((warning["stopped"], warning["remaining"]), ("passed", []))
        self.assertEqual((error["stopped"], len(error["remaining"])), ("unchanged", 1))

    # TST-475007 · level: component · module: MOD-job-runner
    # guards: THE CORRECTION LOOP HAS A FIXED LIMIT; THE ROUNDS ARE COUNTED AND SHOWN; A REVIEWER'S FINDING IS A WARNING; A DRAFT THAT FAILS A CHECK GOES BACK TO ITS PARTICIPANT; AN ERROR MUST BE FIXED, A WARNING FIXED OR JUSTIFIED; WHAT A PERSON DECIDES IS NOT SENT BACK; A FINDING READS LIKE A COMPILER MESSAGE
    # given: fixture runs with a reviewer whose finding is answered with a justification in one run and left unanswered in the other
    # input: the answered and the unanswered review runs
    # expect: the answered finding ends the loop (passed, nothing remaining); the unanswered one stops as unchanged with 1 remaining, a warning
    def test_a_reviewers_finding_answered_with_a_justification_ends_the_loop_an_unanswered_one_does_not(self):
        answered, unanswered = self.runs["reviewAnswered"], self.runs["reviewUnanswered"]
        self.assertEqual((answered["stopped"], answered["remaining"]), ("passed", []))
        self.assertEqual(unanswered["stopped"], "unchanged")
        self.assertEqual(len(unanswered["remaining"]), 1)
        self.assertIn(": warning: ", unanswered["remaining"][0], "a reviewer's finding is a warning")

    # TST-475008 · level: component · module: MOD-job-runner
    # guards: THE CORRECTION LOOP HAS A FIXED LIMIT; THE ROUNDS ARE COUNTED AND SHOWN; A REVIEWER'S FINDING IS A WARNING; A DRAFT THAT FAILS A CHECK GOES BACK TO ITS PARTICIPANT; AN ERROR MUST BE FIXED, A WARNING FIXED OR JUSTIFIED; WHAT A PERSON DECIDES IS NOT SENT BACK; A FINDING READS LIKE A COMPILER MESSAGE
    # given: a derive-requirements run whose candidate is a conflict finding that a person must decide
    # input: the run and every message sent to the participant
    # expect: the conflict is in forPerson and in no message sent to the participant
    def test_a_conflict_finding_appears_in_no_message_to_the_participant(self):
        conflict = self.conflict
        self.assertEqual(conflict["forPerson"], [conflict["conflict"]], "known positive: the conflict was found")
        for message in conflict["sent"]:
            self.assertNotIn("contradicts EXPORT IS A PDF", message)

    # TST-475009 · level: component · module: MOD-job-runner
    # guards: THE CORRECTION LOOP HAS A FIXED LIMIT; THE ROUNDS ARE COUNTED AND SHOWN; A REVIEWER'S FINDING IS A WARNING; A DRAFT THAT FAILS A CHECK GOES BACK TO ITS PARTICIPANT; AN ERROR MUST BE FIXED, A WARNING FIXED OR JUSTIFIED; WHAT A PERSON DECIDES IS NOT SENT BACK; A FINDING READS LIKE A COMPILER MESSAGE
    # given: all findings of the fixture runs and the conflict run
    # input: every finding formatted with formatFinding
    # expect: more than 5 findings found, and each one matches the compiler-message template (artifact:line: kind: what [RULE] — fix.)
    def test_every_finding_of_the_fixture_runs_matches_the_template(self):
        findings = [f for run in self.runs.values() if isinstance(run, dict) and "findings" in run for f in run["findings"]]
        findings += self.conflict["findings"]
        self.assertGreater(len(findings), 5, "known positive: the runs found findings")
        for found in findings:
            self.assertRegex(found, TEMPLATE)


if __name__ == "__main__":
    unittest.main()
