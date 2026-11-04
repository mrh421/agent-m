// MOD-workflow-entries' entry onRecordsChanged resumes the jobs of its route that wait at a gate (ITM-791), as the accepted text of
// docs/architecture/MOD-workflow-entries.md states it: "onRecordsChanged — on a push to `docs/jobs/` or `docs/gates/` of a product: … The entry
// resumes each job of this route whose gate is now recorded (`A JOB STOPS AT EVERY GATE`)"; UC-034 step 7 on the CI route; MOD-product-process'
// `gateStates`: a gate is `passed` when a record of its decider passed it; SPEC: "A job that reaches a gate of the product's workflow waits in the
// state *waiting at a gate* until the decision of that gate's decider is recorded", "A gate's decision recorded by the participant that did the work
// the gate checks does not pass it".
// Run: node --test tests/workflow-entries-resume-gate.test.mjs
//
// Module: MOD-workflow-entries
// Guards: A JOB STOPS AT EVERY GATE; A GATE IS NOT DECIDED BY THE PARTICIPANT WHOSE WORK IT CHECKS; UC-034
// Level: unit
//
// Deterministic, no network: the product and the instance are temporary git repositories laid out as the job workflow lays them out (the
// workspace holds `product/` and `instance/`), as tests/workflow-entries-job-workflow.test.mjs lays them out. The product declares the shipped
// model scrum, whose gate `Development → Sprint Review` is decided by the Product Owner. Where the module file leaves a reading open, the test
// states the one it takes, and the pull request names it:
//   - A job waits at a gate when its record's last `## Gate reached` names the gate and nothing has resumed it (MOD-job-ledger's jobState).
//   - "Resumes" is the resumption MOD-job-ledger appends: a `## Resumed` part naming the gate record, committed with the person's token; the job's
//     state is then no longer `waiting at a gate`.
//   - "The participant whose work the gate checks" is the participant of the waiting job; a gate record whose `decider` is that participant does not
//     resume the job, though its role is the gate's.

import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { appendToRecord, startRecord } from "../src/job-ledger/index.mjs";

process.env.GIT_CONFIG_GLOBAL = "/dev/null";
process.env.GIT_CONFIG_SYSTEM = "/dev/null";
process.env.GIT_TERMINAL_PROMPT = "0";

const entries = await import("../src/workflow-entries/main.mjs").catch((error) => ({ error }));
const { runEntry } = entries;

// ---------------------------------------------------------------- the fixtures

const text = (...lines) => `${lines.join("\n")}\n`;
const NOW = new Date("2026-10-08T09:00:00Z");
const TOKEN = "ghp_ALICEagentMtoken0123456789abcdef";
const KEY = "sk-FIXTURE-KEY-0123456789abcdef";
const GATE = "Development → Sprint Review";
const GATE_FILE = "docs/gates/20261008-0850-development-sprint-review-a1b2.md";
const JOB = "JOB-20261008-0800-a1b2", LAB_JOB = "JOB-20261008-0801-c3d4";

const PARTICIPANTS = text("# Participants of this instance", "",
  "| Name | Type | Model | Context | Price | Capabilities | Processing place | Route |", "|---|---|---|---|---|---|---|---|",
  "| ci-bot | CI agent | fixture-llm | 100000 | — | read the repository, write to the repository | GitHub's hosted runners | ci hosted secret FIXTURE_KEY |");
const declaration = (version) => text("---", "model: scrum", "model_file: src/model-catalogue/models/scrum.md", `model_version: ${version}`, "---",
  "# Process", "", "## Practices", "", "- none", "", "## Branches", "", "| Phase or time box | Branch |", "|---|---|", "| Sprint | sprint/<team>/<nn> |", "",
  "## Definition of Done", "", "The job rules hold; no condition is added.");
const gateRecord = (decider) => text("---", `gate: ${GATE}`, `job: ${JOB}`, `decider: ${decider}`, "role: Product Owner", "decision: passed", "on:",
  "  - 0123456789abcdef0123456789abcdef01234567", "date: 2026-10-08", "---", "# Gate record", "", "## Reason", "", "every selected item meets its acceptance criteria");

// A job of the participant ci-bot that took its work and reached the gate, on the route given.
function waitingJob(id, agentM, route = "ci hosted") {
  const { path, text: start } = startRecord({ id, kind: "decide-gate", worksOn: ["A LOAN HAS A DUE DATE"], participant: "ci-bot", model: "fixture-llm", route, run: null,
    retries: null, startedBy: "alice", start: new Date("2026-10-08T08:00:00Z"), agentM, inputs: [], limit: 2,
    destinations: [{ participant: "ci-bot", place: "GitHub's hosted runners", parts: [] }], params: {} });
  const taken = appendToRecord(start, { part: "taken", at: new Date("2026-10-08T08:30:00Z"), by: "https://github.com/alice/thesis-tool/actions/runs/1" });
  return [path, appendToRecord(taken, { part: "gate reached", at: new Date("2026-10-08T08:40:00Z"), gate: GATE, decider: "Product Owner" })];
}

function git(cwd, ...args) {
  const r = spawnSync("git", args, { cwd, encoding: "utf8" });
  if (r.status !== 0) throw new Error(`git ${args.join(" ")} failed in ${cwd}: ${r.stderr}`);
  return r.stdout.trim();
}
function write(root, files) {
  for (const [path, body] of Object.entries(files)) {
    mkdirSync(join(root, path, ".."), { recursive: true });
    writeFileSync(join(root, path), body);
  }
}
// A bare origin whose `main` holds `files`, and the clone of it the workflow checks out into `folder`.
// Git starts `git maintenance run --auto --detach` after a push it receives, a commit and a fetch (git 2.55 on the CI runners). That process detaches and goes on
// writing into the repository (its lock, objects/) a moment after the command that started it has returned, so a repository removed straight after the command
// can still be written to (ENOTEMPTY). The repositories of these tests need no maintenance: it is off in each.
const NO_MAINTENANCE = ["-c", "gc.auto=0", "-c", "maintenance.auto=false", "-c", "receive.autogc=false"];
const quiet = (dir) => { for (const [key, value] of [["gc.auto", "0"], ["maintenance.auto", "false"], ["receive.autogc", "false"]]) git(dir, "config", key, value); };
function repository(root, name, files, folder) {
  const origin = join(root, `${name}.git`), seed = join(root, `${name}-seed`);
  git(root, "init", "-q", "--bare", "-b", "main", origin);
  quiet(origin);
  git(root, "clone", "-q", ...NO_MAINTENANCE, origin, seed);
  quiet(seed);
  git(seed, "config", "user.name", "Seed");
  git(seed, "config", "user.email", "seed@example.org");
  write(seed, files);
  git(seed, "add", "-A");
  git(seed, "commit", "-q", "-m", "first");
  git(seed, "push", "-q", "origin", "HEAD:refs/heads/main");
  mkdirSync(join(folder, ".."), { recursive: true });
  git(root, "clone", "-q", ...NO_MAINTENANCE, origin, folder);
  quiet(folder);
  git(folder, "config", "user.name", "Alice Agent M token");
  git(folder, "config", "user.email", "alice@example.org");
  return origin;
}
// The workspace of a job workflow: product/ and instance/ (`product` is the product's origin, where the entry pushes); `files(agentM)` are the product's files beyond its README.
async function withWorkspace(files, run) {
  const root = mkdtempSync(join(tmpdir(), "agent-m-resume-"));
  const workspace = join(root, "ws");
  try {
    repository(root, "instance", { "README.md": "# Instance\n", "SPEC.md": "# Spec\n", "docs/participants.md": PARTICIPANTS }, join(workspace, "instance"));
    const agentM = { version: "2026.10.0", commit: git(join(workspace, "instance"), "rev-parse", "HEAD") };
    const product = repository(root, "product", { "README.md": "# Thesis tool\n", "docs/process.md": declaration(agentM.commit), ...files(agentM) }, join(workspace, "product"));
    return await run({ workspace, head: git(join(workspace, "product"), "rev-parse", "HEAD"), productDir: join(workspace, "product"), product });
  } finally { rmSync(root, { recursive: true, force: true }); }
}
const environment = (w) => ({ GITHUB_ACTIONS: "true", GITHUB_EVENT_NAME: "push", GITHUB_WORKSPACE: w.workspace, GITHUB_SERVER_URL: "https://github.com",
  GITHUB_REPOSITORY: "alice/thesis-tool", GITHUB_REF_NAME: "main", GITHUB_SHA: w.head, GITHUB_RUN_ID: "4711", GITHUB_ACTOR: "alice",
  AGENT_M_RUNNER: "hosted", AGENT_M_PRODUCT_DIR: w.productDir, AGENT_M_TOKEN_NAME: "AGENT_M_TOKEN", AGENT_M_KEY_NAMES: "FIXTURE_KEY", AGENT_M_TOKEN: TOKEN, FIXTURE_KEY: KEY });
const run = (w) => { assert.ok(runEntry, `runEntry: ${entries.error?.message}`); return runEntry("onRecordsChanged", environment(w), { now: NOW }); };
const fileAt = (w, path) => git(w.product, "show", `main:${path}`).concat("\n");
const headOf = (w) => git(w.product, "rev-parse", "main");

// ---------------------------------------------------------------- the tests

// TST-479151 · level: unit · module: MOD-workflow-entries
// guards: A JOB STOPS AT EVERY GATE; UC-034
// given: a product declaring the model scrum, whose gate `Development → Sprint Review` the Product Owner decides; a job of the route `ci hosted` waiting at that gate, another of the route `ci runner:lab` waiting at it too, and a gate record on main by `alice`, who is not the job's participant, with the role Product Owner, passing the gate
// input: onRecordsChanged on the push of the gate record, the environment of the hosted runner
// expect: outcome `done`, the summary naming the job; the job's record gains a `## Resumed` part naming the gate record, in one commit "resume <job>: …" on main; the other route's job is left byte for byte as it was
test("onRecordsChanged — a job waiting at a gate goes on once the gate's decider has recorded the decision", async () => {
  await withWorkspace((agentM) => ({ [GATE_FILE]: gateRecord("alice"), ...Object.fromEntries([waitingJob(JOB, agentM), waitingJob(LAB_JOB, agentM, "ci runner:lab")]) }), async (w) => {
    const lab = fileAt(w, `docs/jobs/${LAB_JOB}.md`);
    const status = await run(w);
    assert.equal(status.outcome, "done");
    assert.match(status.summary, new RegExp(JOB));
    assert.match(fileAt(w, `docs/jobs/${JOB}.md`), new RegExp(`## Gate reached[^]*## Resumed[^]*gate record: ${GATE_FILE}`));
    assert.equal(git(w.product, "log", "-1", "--format=%s", "main").startsWith(`resume ${JOB}`), true);
    assert.equal(git(w.product, "rev-list", "--count", `${w.head}..main`), "1");
    assert.equal(fileAt(w, `docs/jobs/${LAB_JOB}.md`), lab, "the job of another route is left as it is");
  });
});

// TST-479152 · level: unit · module: MOD-workflow-entries
// guards: A GATE IS NOT DECIDED BY THE PARTICIPANT WHOSE WORK IT CHECKS
// given: the same product, the job waiting at the gate being ci-bot's, and a gate record on main whose decider is `ci-bot`, with the role Product Owner, passing the gate
// input: onRecordsChanged
// expect: outcome `nothing to do`; the job's record unchanged; no commit on main
test("onRecordsChanged — the implementer's own gate record leaves the job waiting", async () => {
  await withWorkspace((agentM) => ({ [GATE_FILE]: gateRecord("ci-bot"), ...Object.fromEntries([waitingJob(JOB, agentM)]) }), async (w) => {
    const before = fileAt(w, `docs/jobs/${JOB}.md`);
    const status = await run(w);
    assert.equal(status.outcome, "nothing to do");
    assert.equal(fileAt(w, `docs/jobs/${JOB}.md`), before);
    assert.equal(headOf(w), w.head);
  });
});

// TST-479153 · level: unit · module: MOD-workflow-entries
// guards: A JOB STOPS AT EVERY GATE
// given: the same product with the job waiting at the gate and no gate record
// input: onRecordsChanged
// expect: outcome `nothing to do`; the job's record unchanged; no commit on main
test("onRecordsChanged — a job waiting at a gate stays waiting while no decision is recorded", async () => {
  await withWorkspace((agentM) => Object.fromEntries([waitingJob(JOB, agentM)]), async (w) => {
    const before = fileAt(w, `docs/jobs/${JOB}.md`);
    const status = await run(w);
    assert.equal(status.outcome, "nothing to do");
    assert.equal(fileAt(w, `docs/jobs/${JOB}.md`), before);
    assert.equal(headOf(w), w.head);
  });
});

// ---------------------------------------------------------------- a gate that is rejected (ITM-1412)
//
// UC-034 7a / UC-024 10a: "The gate record states the rejection and its reason. The job ends, and the item returns to *ready* with the reason attached" (the job's end is MOD-job-ledger's
// `## End`, whose state `failed` the item states derive from). MOD-product-process: a waiting job "is resumed by its route once the record is on the branch" — the route notices a rejected
// record too, and where a passed one resumes the job, a rejected one ends it. Readings taken, which the pull request names:
//   - The record that ends the job is the one `gateStates` calls `rejected` for the gate the job last reached — a record of the gate's deciding role, the newest — and it ends the job it names
//     in `job:`; a rejection that names another job, or none, ends none, so that a job which reaches the gate later is not ended by an earlier job's rejection.
//   - The end is `failed`, with no results, and its reason names the gate, the gate record's path and the record's `## Reason`, on one line.
//   - Like a passed record, a rejected one decided by the job's own participant does not count (`A GATE IS NOT DECIDED BY THE PARTICIPANT WHOSE WORK IT CHECKS`).

const REJECTED_FILE = "docs/gates/20261008-0855-development-sprint-review-c3d4.md";
const REASON = "The review found no test.";
const rejectedRecord = (decider, job = JOB) => text("---", `gate: ${GATE}`, `job: ${job}`, `decider: ${decider}`, "role: Product Owner", "decision: rejected", "on:",
  "  - 0123456789abcdef0123456789abcdef01234567", "date: 2026-10-08 08:55 UTC", "---", "# Gate record", "", "**REGISTER**", "", "## Reason", "", REASON);

// TST-1412001 · level: unit · module: MOD-workflow-entries
// guards: A JOB STOPS AT EVERY GATE; THE GATE IS RECORDED; UC-034; UC-024
// given: the product of TST-479151 with its job waiting at the gate `Development → Sprint Review` and another of the route `ci runner:lab` waiting at it, and a gate record on main by `alice`, the Product Owner, who is not the job's participant, naming the job, `decision: rejected`, reason "The review found no test."
// input: onRecordsChanged on the push of the gate record, the environment of the hosted runner; then onRecordsChanged again
// expect: outcome `done`, the summary naming the job; in one commit "end <job>: failed" the job's record gains an `## End` of state failed with no results, whose reason names the gate, `docs/gates/20261008-0855-development-sprint-review-c3d4.md` and "The review found no test.", and gains no `## Resumed`; the other route's job is left byte for byte as it was; the second run is `nothing to do` and commits nothing
test("onRecordsChanged — a job waiting at a gate that is rejected ends failed, naming the gate record and its reason", async () => {
  await withWorkspace((agentM) => ({ [REJECTED_FILE]: rejectedRecord("alice"), ...Object.fromEntries([waitingJob(JOB, agentM), waitingJob(LAB_JOB, agentM, "ci runner:lab")]) }), async (w) => {
    const lab = fileAt(w, `docs/jobs/${LAB_JOB}.md`);
    const status = await run(w);
    assert.equal(status.outcome, "done");
    assert.match(status.summary, new RegExp(JOB));
    const record = fileAt(w, `docs/jobs/${JOB}.md`);
    assert.match(record, /## End[^]*state: failed/);
    assert.match(record, new RegExp(`## End[^]*reason: [^\\n]*${GATE}[^\\n]*${REJECTED_FILE}[^\\n]*${REASON.replace(/\./g, "\\.")}`));
    assert.doesNotMatch(record, /## Resumed/);
    assert.equal(git(w.product, "rev-list", "--count", `${w.head}..main`), "1");
    assert.equal(git(w.product, "log", "-1", "--format=%s", "main"), `end ${JOB}: failed`);
    assert.equal(fileAt(w, `docs/jobs/${LAB_JOB}.md`), lab, "the job of another route is left as it is");
    const after = headOf(w);
    git(w.productDir, "pull", "-q", "--ff-only");
    const again = await run({ ...w, head: after });
    assert.equal(again.outcome, "nothing to do", again.summary);
    assert.equal(headOf(w), after, "an ended job is not ended again");
  });
});

// TST-1412002 · level: unit · module: MOD-workflow-entries
// guards: A JOB STOPS AT EVERY GATE; UC-034; UC-024
// given: the product of TST-1412001 with the job waiting at the gate, and a gate record on main by `alice` that passes the gate and names the job (the counter-proof: the passed record of TST-479151)
// input: onRecordsChanged
// expect: outcome `done`; the job's record gains `## Resumed` naming the gate record and no `## End`
test("onRecordsChanged — a passed record still resumes the job and ends nothing", async () => {
  await withWorkspace((agentM) => ({ [GATE_FILE]: gateRecord("alice"), ...Object.fromEntries([waitingJob(JOB, agentM)]) }), async (w) => {
    const status = await run(w);
    assert.equal(status.outcome, "done");
    const record = fileAt(w, `docs/jobs/${JOB}.md`);
    assert.match(record, new RegExp(`## Resumed[^]*gate record: ${GATE_FILE}`));
    assert.doesNotMatch(record, /## End/);
  });
});

// TST-1412003 · level: unit · module: MOD-workflow-entries
// guards: A GATE IS NOT DECIDED BY THE PARTICIPANT WHOSE WORK IT CHECKS; A JOB STOPS AT EVERY GATE
// given: the product of TST-1412001 with the job waiting at the gate being ci-bot's, and a gate record on main, rejecting the gate and naming the job, whose decider is `ci-bot` (known positive: the same record decided by `alice` ends the job, TST-1412001)
// input: onRecordsChanged
// expect: outcome `nothing to do`; the job's record unchanged; no commit on main
test("onRecordsChanged — the implementer's own rejection leaves the job waiting", async () => {
  await withWorkspace((agentM) => ({ [REJECTED_FILE]: rejectedRecord("ci-bot"), ...Object.fromEntries([waitingJob(JOB, agentM)]) }), async (w) => {
    const before = fileAt(w, `docs/jobs/${JOB}.md`);
    const status = await run(w);
    assert.equal(status.outcome, "nothing to do");
    assert.equal(fileAt(w, `docs/jobs/${JOB}.md`), before);
    assert.equal(headOf(w), w.head);
  });
});

// TST-1412004 · level: unit · module: MOD-workflow-entries
// guards: A JOB STOPS AT EVERY GATE
// given: the product of TST-1412001 with the job waiting at the gate, and a gate record on main by `alice` that rejects the gate and names another job, JOB-20261008-0799-ffff (known positive: naming the job ends it, TST-1412001)
// input: onRecordsChanged
// expect: outcome `nothing to do`; the job's record unchanged; no commit on main
test("onRecordsChanged — a rejection that names another job ends no job", async () => {
  await withWorkspace((agentM) => ({ [REJECTED_FILE]: rejectedRecord("alice", "JOB-20261008-0799-ffff"), ...Object.fromEntries([waitingJob(JOB, agentM)]) }), async (w) => {
    const before = fileAt(w, `docs/jobs/${JOB}.md`);
    const status = await run(w);
    assert.equal(status.outcome, "nothing to do");
    assert.equal(fileAt(w, `docs/jobs/${JOB}.md`), before);
    assert.equal(headOf(w), w.head);
  });
});
