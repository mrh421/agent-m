# Module: MOD-run-planner
# Guards: A RUN EXECUTES THE PROCESS MODEL OVER A SELECTION; A RUN CONTINUES WITHOUT A CLICK BETWEEN ITS JOBS; A RUN FOLLOWS THE MODULES' INTERFACES; A RUN SETS UP CI BEFORE IT IMPLEMENTS; A RUN HAS LIMITS FIXED AT ITS START; A RUN ENDS WITH THE VALIDATION OF ITS MODULES
# Level: release
"""SPEC section 13 - the check named tests/test_process_run.py, for the six requirements whose Check sentence names it.

The cases live in tests/test_process_run.md. This file only loads them and asks node to run the real MOD-run-planner (runOf, nextActions), MOD-progress-measures (productFacts), MOD-job-ledger (startRecord, appendToRecord,
listJobs), MOD-trace-graph and MOD-test-schedule over tests/uc-043-harness.mjs: the planned product alice/thesis-tool behind a fake of GitHub, and the run's participant of UC-043 played by the harness's `carryOut`, which
only asks nextActions and writes the records MOD-job-ledger defines. The fakes only hold files and answer requests; every record is written by the code under test and read back by listJobs. A case's `expected` names what it asserts.

Written for ITM-1045 by developer-sonnet-k, who implemented none of MOD-run-planner (RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER; the trailers of its code name developer-sonnet-a, developer-sonnet-b, developer-sonnet-d and others).

Readings of the SPEC's wording that the pull request names:
 - "from one start" is read as one record of a run in the product's repository and no click of a person after it; "the jobs of every phase" as the jobs of the steps of the plan's phases, Implementation and Testing;
   "in the model's order" as: a step of a later phase starts only once the steps of the earlier phase are done (the V-model's transition Implementation to Testing is a sequence).
 - "a fixture run of five jobs" is read as a run over five steps of the plan whose CI configuration stands; "a gate decided by a person" as a job that has reached a gate whose decider is the Reviewer.
 - "modules A -> B -> C and D" is read as four modules of one subsystem, C using B and B using A, D using nothing, whose steps stand in the plan in the order C, D, B, A.
 - "a run whose reported cost reaches its limit starts no further job and says why" is read as a run in the state `held by a limit` whose next actions start nothing and hold, with a reason that names the cost.
 - "the dashboard shows for its selection what each module realises" is read as the modules view of MOD-trace-pages drawn for the modules of the selection (the parameter `modules`, as the release tests of UC-025 read it).
A case that fails because the code lacks behaviour is marked expectedFailure and names its finding in its comment.
"""
import json
import re
import unittest
from pathlib import Path

from jsrun import js

DATA = Path(__file__).with_suffix(".md")
ROOT = Path(__file__).resolve().parents[1]
EXECUTES = "A RUN EXECUTES THE PROCESS MODEL OVER A SELECTION"
CONTINUES = "A RUN CONTINUES WITHOUT A CLICK BETWEEN ITS JOBS"
INTERFACES = "A RUN FOLLOWS THE MODULES' INTERFACES"
CI = "A RUN SETS UP CI BEFORE IT IMPLEMENTS"
LIMITS = "A RUN HAS LIMITS FIXED AT ITS START"
VALIDATION = "A RUN ENDS WITH THE VALIDATION OF ITS MODULES"

# The adapter. `input.kind` is one of: "waves" (a run over `selection` of the planned product or of the chain of four modules, carried out by the run's participant until nextActions starts nothing), "gate" (the same, with one job
# that reaches a gate), "limit" (a run with a cost limit, one job ended at a reported cost), "validation" (the modules view that a run ends with, drawn for the modules of its selection). The value is what the case may state.
WORLD = r"""
const url = (path) => `file://${ROOT}/${path}`;
const h = await import(url("tests/uc-043-harness.mjs"));
const STEPS = h.STEPS;
const PHASE = { "ITM-101": "Implementation", "ITM-102": "Implementation", "ITM-103": "Implementation", "ITM-104": "Testing", "ITM-105": "Testing", "ITM-106": "Testing" };
const MODULE = { "ITM-201": "MOD-a", "ITM-202": "MOD-b", "ITM-203": "MOD-c", "ITM-204": "MOD-d" };
const GATE = "Validation & Verification → Operation & Maintenance";
const nameOf = (step) => MODULE[step] ?? step;

async function opened(input) {
  const files = input.product === "chain" ? await h.chainFiles({ uses: input.uses }) : await h.productFiles();
  const world = await h.openWorld({ files });
  const selection = input.selection ?? (input.product === "chain" ? h.CHAIN : STEPS);
  await world.startRun({ selection, limits: input.limits ?? h.LIMITS });
  if (input.ci !== false) await world.setUpCi();
  return world;
}
const observed = async (world, result) => {
  const rows = await world.rows();
  const jobs = rows.filter((row) => row.record.kind !== "run");
  const facts = await world.facts();
  return {
    waves: result.waves.map((wave) => wave.map((each) => nameOf(each.worksOn ?? each.kind))), refused: result.refused !== null, reason: result.refused,
    clicks: result.clicks, runRecords: rows.filter((row) => row.record.kind === "run").length, jobRecords: jobs.length,
    jobsNamingTheRun: jobs.filter((row) => row.record.run === h.RUN_ID).length,
    started: result.waves.flat().map((each) => nameOf(each.worksOn ?? each.kind)).sort(),
    kinds: [...new Set(result.waves.flat().map((each) => each.kind))].sort(),
    states: Object.fromEntries(facts.plan.states.map((state) => [state.item, state.state])), done: facts.plan.states.filter((state) => state.state === "done").map((state) => nameOf(state.item)),
    cycleNames: [...new Set(result.refused?.match(/MOD-[a-z]+/g) ?? [])].sort(),
    runState: (await world.run()).state, configured: facts.ci.configured, drift: facts.ci.drift.length,
  };
};

async function waves(input) {
  const world = await opened(input);
  try {
    const result = await world.carryOut();
    const out = await observed(world, result);
    // A step of a later phase started in a round in which a step of an earlier phase had not been done before the round began.
    const done = new Set();
    out.earlyTesting = [];
    for (const wave of result.waves) {
      const open = STEPS.filter((step) => PHASE[step] === "Implementation" && !done.has(step));
      for (const each of wave) if (PHASE[each.worksOn] === "Testing" && open.length) out.earlyTesting.push(each.worksOn);
      for (const each of wave) done.add(each.worksOn);
    }
    return out;
  } finally { world.restore(); }
}

async function gate(input) {
  const world = await opened(input);
  try {
    const result = await world.carryOut({ finish: (action) => (action.worksOn === input.gateStep ? null : "done"), onStart: async (action, job) => { if (action.worksOn === input.gateStep) await world.reachGate(job, GATE, "Reviewer"); } });
    const out = await observed(world, result);
    out.waitingAt = Object.entries(out.states).filter(([, state]) => state === "blocked").map(([step]) => step);
    out.notStarted = Object.entries(out.states).filter(([, state]) => state.startsWith("waiting")).map(([step]) => step);
    out.done = Object.entries(out.states).filter(([, state]) => state === "done").map(([step]) => step);
    return out;
  } finally { world.restore(); }
}

async function limit(input) {
  const world = await opened({ limits: { jobsAtOnce: 3, cost: input.cost, rounds: 5 } });
  try {
    const [first] = await world.next();
    const job = await world.begin(first);
    await world.end(job, "done", { amount: input.reported });
    world.merge(first.worksOn, job);
    const actions = await world.next();
    const hold = actions.find((action) => action.do === "hold");
    return { state: (await world.run()).state, starts: actions.filter((action) => action.do === "start").map((action) => action.worksOn), holds: Boolean(hold), mentionsCost: /cost/.test(hold?.reason ?? "") };
  } finally { world.restore(); }
}

async function validation(input) {
  const u25 = await import(url("tests/uc-025-harness.mjs"));
  const { target } = await u25.open(u25.hostOf(), { key: "modules", ref: "main", modules: input.modules.join(",") });
  return { rows: u25.rowsOf(target), all: u25.rowsOf((await u25.open()).target) };
}

const KINDS = { waves, gate, limit, validation };
return await KINDS[input.kind](input);
"""


def cases(section: str, data: Path = DATA) -> list[dict]:
    text = data.read_text(encoding="utf-8")
    body = re.search(rf"^## {re.escape(section)}\n(.*?)(?=^## |\Z)", text, re.M | re.S)
    if not body:
        raise AssertionError(f"missing section {section}")
    found = [{"name": m.group(1), "case": json.loads(m.group(2))}
             for m in re.finditer(r"^### ([^\n]+)\n\n```json\n(.*?)\n```", body.group(1), re.M | re.S)]
    if not found:
        raise AssertionError(f"no cases under {section}")
    return found


def run_world(argument: dict) -> dict:
    return js(f"const input = {json.dumps(argument)}; const ROOT = {json.dumps(str(ROOT))};\n{WORLD}")


def check(test: unittest.TestCase, section: str, only: str) -> None:
    chosen = [loaded for loaded in cases(section) if loaded["name"].startswith(only)]
    if not chosen:
        raise AssertionError(f"no case of {section} starts with {only!r}")
    for loaded in chosen:
        with test.subTest(case=loaded["name"]):
            got = run_world(loaded["case"]["input"])
            wanted = loaded["case"]["expected"]
            test.assertEqual({key: got.get(key) for key in wanted}, wanted)


class TestProcessRun(unittest.TestCase):
    # TST-1045401 · level: release · module: MOD-run-planner
    # guards: A RUN EXECUTES THE PROCESS MODEL OVER A SELECTION
    # given: the V-model fixture with three accepted modules MOD-store, MOD-pages and MOD-mail, its plan of six steps (three modules, two subsystem integrations, the system), both gates before Implementation recorded, no CI configuration, and one run started over the six steps
    # input: the run carried out by the run's participant, from its one start, until nextActions gives nothing to start
    # expect: from the one start the jobs of both phases of the plan are started for all three modules — the CI setup and one implementation job for each of the six steps — in four rounds that follow the modules' interfaces, with one run record, a record for each job, no click and no refusal
    def test_one_start_yields_the_jobs_of_every_phase_for_all_three_modules(self):
        check(self, EXECUTES, "A V-model fixture")

    # TST-1045402 · level: release · module: MOD-run-planner
    # guards: A RUN EXECUTES THE PROCESS MODEL OVER A SELECTION
    # given: the same run
    # input: the rounds of the run, with the phase of each step (ITM-101 to ITM-103 Implementation, ITM-104 to ITM-106 Testing)
    # expect: in the model's order — no step of the phase Testing starts in a round in which a step of the phase Implementation has not been done before the round began, as the V-model's transition Implementation to Testing is a sequence. FINDING UC043-F11 (MOD-run-planner)
    @unittest.expectedFailure
    def test_the_phases_follow_the_models_order(self):
        # FINDING UC043-F11 (MOD-run-planner) - nextActions (src/run-planner/next.mjs:125-134) takes the steps in the plan's order but starts a step as soon as `startable` admits it and the modules it uses are done, never
        # asking whether the steps of an earlier phase are done: ITM-105 (Testing) starts in the round of ITM-102 (Implementation). MOD-run-planner's text says the steps are taken "in the order of the modules' interfaces
        # and of the model's phases and gates", and UC-043 says that in a V-model "the Testing phase runs after Implementation".
        check(self, EXECUTES, "The phases")

    # TST-1045403 · level: release · module: MOD-run-planner
    # guards: A RUN CONTINUES WITHOUT A CLICK BETWEEN ITS JOBS
    # given: a run over five steps of the planned product with the CI configuration in place and no gate a person has to decide
    # input: the run started once and carried out
    # expect: one start and no further click — one run record, five jobs that name the run, every step done, no refusal, no click, the run still running until its participant ends it
    def test_a_run_of_five_jobs_without_a_gate_needs_one_start_and_no_further_click(self):
        check(self, CONTINUES, "A run of five jobs")

    # TST-1045404 · level: release · module: MOD-run-planner
    # guards: A RUN CONTINUES WITHOUT A CLICK BETWEEN ITS JOBS
    # given: the same run in which the job of ITM-101 reaches the gate Validation & Verification → Operation & Maintenance, decided by the Reviewer, a person's, and waits there
    # input: the run carried out
    # expect: counter-proof — the run waits at that gate and nowhere else: the steps that depend on ITM-101 (ITM-102 and ITM-104) are not started, the steps that do not (ITM-103 and ITM-105) are done, and the run is in the state waiting at a gate
    def test_with_a_gate_decided_by_a_person_the_run_waits_there_and_nowhere_else(self):
        check(self, CONTINUES, "With a gate")

    # TST-1045405 · level: release · module: MOD-run-planner
    # guards: A RUN FOLLOWS THE MODULES' INTERFACES
    # given: four modules of one subsystem, MOD-c using MOD-b, MOD-b using MOD-a and MOD-d using nothing, whose steps stand in the plan in the order C, D, B, A
    # input: a run over the four steps carried out
    # expect: C starts after B and B after A, while D runs alongside A: the rounds are D and A, then B, then C
    def test_a_module_starts_after_the_modules_it_uses_while_an_unrelated_one_runs_alongside(self):
        check(self, INTERFACES, "Modules A")

    # TST-1045406 · level: release · module: MOD-run-planner
    # guards: A RUN FOLLOWS THE MODULES' INTERFACES
    # given: the same four modules with MOD-a also using MOD-c, so that A, C and B use each other in a ring
    # input: the run started and asked for its next actions before any job starts
    # expect: counter-proof — the cycle is refused before the run starts anything and named: one refusal that names MOD-a, MOD-b and MOD-c and the rule, no job record besides the run's
    def test_a_cycle_in_the_interfaces_is_refused_before_the_run_starts_and_named(self):
        check(self, INTERFACES, "A cycle")

    # TST-1045407 · level: release · module: MOD-run-planner
    # guards: A RUN SETS UP CI BEFORE IT IMPLEMENTS
    # given: the planned product with no CI configuration generated from its test schedule, and a run over ITM-101 and ITM-103, both ready
    # input: the run carried out
    # expect: the first job is the CI setup and no implementation job is started before it; once the configuration stands, generated from the book's default schedule with no difference from it, the two steps are implemented
    def test_a_run_whose_product_has_no_ci_configuration_creates_it_before_its_first_implementation_job(self):
        check(self, CI, "No CI")

    # TST-1045408 · level: release · module: MOD-run-planner
    # guards: A RUN SETS UP CI BEFORE IT IMPLEMENTS
    # given: the same product with the CI configuration in place
    # input: the same run carried out
    # expect: counter-proof — no CI setup is started: the first round is the two steps
    def test_a_run_whose_product_has_its_configuration_starts_no_ci_setup(self):
        check(self, CI, "CI in place")

    # TST-1045409 · level: release · module: MOD-run-planner
    # guards: A RUN HAS LIMITS FIXED AT ITS START
    # given: a run over the six steps with a cost limit of 5, whose first job ended at a cost the runtime reported as 6
    # input: the run read and asked for its next actions
    # expect: the run is held by a limit, starts no further job and says why: one action, hold, whose reason names the cost. FINDING UC043-F4 (MOD-run-planner)
    @unittest.expectedFailure
    def test_a_run_whose_reported_cost_reaches_its_limit_starts_no_further_job_and_says_why(self):
        # FINDING UC043-F4 (MOD-run-planner) - nextActions (src/run-planner/next.mjs:110) ends a run that is stopped or finished only; a run `held by a limit` is given the starts of every step that `startable` admits and
        # the action `hold` is never given: the run reads as held (TST-1045410) and goes on all the same.
        check(self, LIMITS, "A run whose reported cost reaches")

    # TST-1045410 · level: release · module: MOD-run-planner
    # guards: A RUN HAS LIMITS FIXED AT ITS START
    # given: the same run with a cost limit of 5 whose first job ended at a cost the runtime reported as 3
    # input: the run read and asked for its next actions
    # expect: counter-proof — below the limit the run continues: its state is running and the steps that are ready start
    def test_below_the_limit_the_run_continues(self):
        check(self, LIMITS, "Below the limit")

    # TST-1045411 · level: release · module: MOD-run-planner
    # guards: A RUN HAS LIMITS FIXED AT ITS START
    # given: the same run with a cost limit of 5 whose first job ended at a cost the runtime reported as 6
    # input: the run read
    # expect: the limit is read: the run is held by a limit (the part of the requirement the code carries)
    def test_a_reported_cost_at_the_limit_holds_the_run(self):
        check(self, LIMITS, "The limit is read")

    # TST-1045412 · level: release · module: MOD-trace-pages
    # guards: A RUN ENDS WITH THE VALIDATION OF ITS MODULES
    # given: the fixture product of tests/uc-025-harness.mjs, which has four modules, and a run whose selection is MOD-store and MOD-pages
    # input: the modules view a run ends with, drawn for the modules of the selection
    # expect: the rows of the view are MOD-pages and MOD-store alone, each with what it realises, its code and tests, and the gaps of those two; known positive: without a selection the view shows all four modules. FINDING UC025-R1 (MOD-trace-pages)
    @unittest.expectedFailure
    def test_a_run_ends_with_the_view_of_the_modules_of_its_selection(self):
        # FINDING UC025-R1 (MOD-trace-pages), the finding of TST-741112 - the modules view reads only `key` and `ref` of its params and has no filter, so it shows every module of the version.
        check(self, VALIDATION, "The modules")


if __name__ == "__main__":
    unittest.main()
