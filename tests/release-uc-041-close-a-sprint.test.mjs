// Release tests of the requirements UC-041 "Close a sprint with review and retrospective" realises, each checked from what a person reads on the dashboard, from the records a close commits and from the
// refusals a person meets: each team closing its own sprints, a sprint holding its items until they reach the default branch, the gate at a sprint branch's merge decided within the team's role assignment,
// an agent's review that names its sources, and an agent's retrospective whose changes are proposals. TST-991301 maps every requirement UC-041 realises to the release tests that guard it: this file's,
// tests/test_time_box_close.py's, and those other writers wrote.
// Run: node --test tests/release-uc-041-close-a-sprint.test.mjs
//
// Module: MOD-work-plans
// Module: MOD-product-process
// Module: MOD-implementation-pages
// Guards: UC-041
// Level: release
//
// Written for the release testing of sprint 142 by developer-opus-e (ITM-991), who implemented none of ITM-618, ITM-619, ITM-620, ITM-986, ITM-1010, ITM-1032, ITM-1033, ITM-1232 and ITM-785, nor the
// behaviour any case of this file guards. Of the code UC-041's flow runs, developer-opus-e built ITM-987 (closeSprint writes the feedback's new items in its one commit), ITM-1171 (targetBranch, the branch
// an item's work is merged into) and ITM-1260 and ITM-1264 (Progress, Backlog and Implement read the view stored for their commit); the requirements that behaviour serves are mapped in BUILT_BY_WRITER to the
// release tests other writers wrote, and no case here guards them (RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER). The world is tests/uc-041-harness.mjs': the agent's close through the real job runner,
// and the pages behind tests/uc-032-harness.mjs' fake of GitHub. Where the code and the SPEC or UC-041 disagree the case follows the text and is marked `todo` with the word FINDING.
// Readings the texts leave open, which the cases state:
//   - "the gate at its end" (A PHASE OR A TIME BOX MAY HAVE A BRANCH OF ITS OWN), whose decider A GATE IS DECIDED WITHIN THE JOB'S ROLE ASSIGNMENT binds, is read for the shipped Scrum model as its gate out of
//     its last phase, Sprint Retrospective → Sprint Planning, which the Product Owner decides after the review; the job's role assignment is the one of the team whose sprint it is.
//   - "every change it recommends is an open entry of a SPEC change queue" (the check of AN AGENT'S RETROSPECTIVE CHANGES NO PROCESS BY ITSELF) is read for each change whose `goes` is the process model,
//     the Definition of Done or a participant's instructions; a change to the team agreement is no rule of the process.

import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { testDeclarations } from "../src/test-document/index.mjs";
import { readDocument } from "../src/documents/index.mjs";
import { declarationSchema, productWorkflow, recordGateDecision, roleAssignmentSchema } from "../src/product-process/index.mjs";
import { conflicts, heldItems } from "../src/work-plans/index.mjs";
import { CLOSE, PULLS, RECORD, SPRINT, closeWorld, documentsOf, open, part, plain, sprintPath } from "./uc-041-harness.mjs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const UC = "docs/use-cases/UC-041-close-a-sprint.md";
const SELF = "tests/release-uc-041-close-a-sprint.test.mjs";
const PY = "tests/test_time_box_close.py";

// ---------------------------------------------------------------- the map

// Each requirement UC-041 realises, with the release tests that guard it: this file's, tests/test_time_box_close.py's, and those other writers wrote.
const EVIDENCE = {
  "A SPRINT ENDS WITH A REVIEW OF ITS INCREMENT": [["tests/release-itm-987-close-new-items.test.mjs", "TST-987301"], ["tests/release-itm-987-close-new-items.test.mjs", "TST-987302"],
    ["tests/release-itm-1330-sprint-ended-is-drawn-as-ended.test.mjs", "TST-1330101"]],
  "A SPRINT ENDS WITH A RETROSPECTIVE": [[PY, "TST-991401"], ["tests/release-itm-987-close-new-items.test.mjs", "TST-987304"]],
  "A PHASE OR A TIME BOX MAY HAVE A BRANCH OF ITS OWN": [["tests/release-itm-1171-target-branch.test.mjs", "TST-1171101"], ["tests/release-sprint-06-uc-002-implementation-pages.test.mjs", "TST-472502"]],
  "A PRODUCT DECLARES ITS DEFINITION OF DONE": [["tests/test_definition_of_done.py", "TST-788002"], ["tests/release-sprint-06-uc-002-implementation-pages.test.mjs", "TST-472499"]],
  "A TIME BOX WORKS ONLY ON WHAT WAS SELECTED FOR IT": [["tests/release-itm-1264-implement-stored-view.test.mjs", "TST-1264303"], ["tests/release-itm-1327-selection-notice.test.mjs", "TST-1327101"]],
  "A BACKLOG ITEM NAMES WHAT IT REALISES": [["tests/release-itm-987-close-new-items.test.mjs", "TST-987303"], ["tests/release-uc-032-the-backlog-and-its-items.test.mjs", "TST-803102"]],
  "PROGRESS AND JOB STATE ARE DERIVED, NOT STORED": [["tests/release-itm-1260-stored-views.test.mjs", "TST-1260401"], ["tests/release-uc-035-progress.test.mjs", "TST-806108"],
    ["tests/release-uc-032-derived-state-and-sprints.test.mjs", "TST-803110"]],
  "CLOSING A SPRINT CAN BE ASSIGNED TO A PARTICIPANT": [[PY, "TST-991402"], ["tests/release-uc-032-derived-state-and-sprints.test.mjs", "TST-803112"]],
  "A SPRINT CLOSED BY AN AGENT STARTS BY ITSELF": [[PY, "TST-991403"]],
  "AN AGENT'S REVIEW NAMES WHERE ITS FEEDBACK CAME FROM": [[PY, "TST-991404"], [SELF, "TST-991305"]],
  "AN AGENT'S RETROSPECTIVE CHANGES NO PROCESS BY ITSELF": [[PY, "TST-991406"], [SELF, "TST-991306"]],
  "EVERY TEAM RUNS SPRINTS OF ITS OWN": [[SELF, "TST-991302"]],
  "A SPRINT HOLDS ITS ITEMS UNTIL THEY REACH THE DEFAULT BRANCH": [[SELF, "TST-991303"]],
  "A GATE IS DECIDED WITHIN THE JOB'S ROLE ASSIGNMENT": [[SELF, "TST-991304"]],
};
// The requirements whose behaviour on UC-041's path this file's writer built: guarded here only by the release tests other writers wrote.
const BUILT_BY_WRITER = {
  "A SPRINT ENDS WITH A REVIEW OF ITS INCREMENT": "ITM-987, the feedback's new items written in the close's one commit",
  "A BACKLOG ITEM NAMES WHAT IT REALISES": "ITM-987, the close's new items checked as saveItems checks them",
  "A PHASE OR A TIME BOX MAY HAVE A BRANCH OF ITS OWN": "ITM-1171, targetBranch",
  "PROGRESS AND JOB STATE ARE DERIVED, NOT STORED": "ITM-1260 and ITM-1264, the views Progress, Backlog and Implement read for their commit",
  "A TIME BOX WORKS ONLY ON WHAT WAS SELECTED FOR IT": "ITM-1264, Implement judging its items from the backlog's view of the head",
};
// The findings of this file: the case, and the module it points to.
const FINDINGS = {};

// TST-991301 · level: release · module: system
// guards: UC-041
// given: UC-041 as committed text, whose `realises` lists fourteen requirements, and the release tests named in EVIDENCE
// input: read UC-041's list of the requirements it realises, and the declarations of the test files named for each
// expect: known positive — UC-041 realises these fourteen requirements; each has at least one release test named; each test named stands in its file with the level release and guards that requirement; no case of this file or of tests/test_time_box_close.py guards a requirement in BUILT_BY_WRITER; each finding's case carries a todo naming FINDING and its module
test("TST-991301: UC-041 every requirement it realises has a release test that guards it", () => {
  const front = /^realises:\n((?:  - .*\n)+)/m.exec(read(UC))?.[1] ?? "";
  const realised = front.split("\n").filter(Boolean).map((line) => line.replace(/^ {2}- /, ""));
  assert.equal(realised.length, 14, "known positive: UC-041 realises fourteen requirements");
  assert.deepEqual([...realised].sort(), Object.keys(EVIDENCE).sort(), "the map holds exactly the requirements UC-041 realises");
  for (const [requirement, named] of Object.entries(EVIDENCE)) {
    assert.ok(named.length > 0, `${requirement}: a release test is named`);
    for (const [file, id] of named) {
      assert.ok(existsSync(new URL(`../${file}`, import.meta.url)), `${requirement}: ${file} exists`);
      const declared = testDeclarations(file, read(file)).find((each) => each.id === id);
      assert.ok(declared, `${requirement}: ${id} is declared in ${file}`);
      assert.equal(declared.level, "release", `${id} is a release test`);
      assert.ok((declared.guards ?? []).includes(requirement), `${id} guards ${requirement}`);
    }
  }
  const own = [...testDeclarations(SELF, read(SELF)), ...testDeclarations(PY, read(PY))];
  for (const requirement of Object.keys(BUILT_BY_WRITER)) assert.deepEqual(own.filter((each) => (each.guards ?? []).includes(requirement)).map((each) => each.id), [], `${requirement} is left to other writers`);
  for (const [id, { finding, module }] of Object.entries(FINDINGS)) assert.ok(read(SELF).includes(`todo: "FINDING ${finding} (${module})`), `${id} names FINDING ${finding} and ${module}`);
});

// ---------------------------------------------------------------- each team, its sprints and what they hold

// TST-991302 · level: release · module: system
// guards: EVERY TEAM RUNS SPRINTS OF ITS OWN; UC-041
// given: the product of tests/uc-041-harness.mjs: team1's sprint team1/02 has ended; team2 runs its sprint team2/01 with ITM-003; known positive first — Progress shows both teams' sprints
// input: closer-bot closes team1/02 through its close job; the Product Owner opens Progress
// expect: known positive — before, Progress shows team1/02 and team2/01; the close writes team1's record alone, and team2/01's record is byte-identical; afterwards Progress says team1 has no running sprint and still shows team2's sprint team2/01 with ITM-003
test("TST-991302: closing one team's sprint leaves the other team's running sprint as it was", async () => {
  const w = await closeWorld();
  const progress = async () => { const page = await open("progress", {}, { files: w.files, pullRequests: PULLS }); try { return page.html(); } finally { page.done(); } };
  const before = await progress();
  assert.match(plain(part(before, 'data-team="team1"')), /team1\/02/, "known positive: team1's sprint is shown");
  assert.match(plain(part(before, 'data-team="team2"')), /team2\/01/, "known positive: team2's sprint is shown");
  const team2 = w.files[sprintPath("team2", 1)];
  assert.equal((await w.run([CLOSE()])).failed, null);
  assert.deepEqual(w.commits.flatMap((commit) => commit.files.map((each) => each.path)), [RECORD]);
  assert.equal(w.files[sprintPath("team2", 1)], team2, "team2's record is byte-identical");
  const after = await progress();
  assert.match(plain(part(after, 'data-team="team1"')), /no running sprint/);
  assert.match(plain(part(after, 'data-team="team2"')), /team2\/01[\s\S]*ITM-003/);
});

// TST-991303 · level: release · module: system
// guards: A SPRINT HOLDS ITS ITEMS UNTIL THEY REACH THE DEFAULT BRANCH; UC-041
// given: the product of tests/uc-041-harness.mjs: team1/02 selects ITM-001, whose pull request is merged into the sprint's branch sprint/team1/02, and ITM-002, whose pull request is open; the pull request 9 of sprint/team1/02 into main is open; ITM-005 changes MOD-store, as ITM-001 does
// input: what the sprints hold before the close; after closer-bot's close, which sends ITM-002 into the next sprint, read with the pull requests and with them unknown (a host that could not read them); and after pull request 9 is merged into main; and what keeps ITM-005 from team2 at each
// expect: before the close team1/02 holds ITM-001 and ITM-002; after it, ITM-001 alone, whether the pull requests are read or unknown, and ITM-005 is kept from team2 by team1/02's ITM-001 and the module MOD-store; once pull request 9 is merged, team1/02 holds nothing and ITM-005 is kept from team2 by nothing
test("TST-991303: a closed sprint holds its done items until its branch reaches the default branch, and none it sent on", async () => {
  const w = await closeWorld();
  const holds = (pulls) => { const { sprints, items, architecture } = documentsOf(w.files); return heldItems(sprints, items, architecture, pulls); };
  const ofTeam1 = (held) => held.filter((each) => each.sprint === SPRINT).map((each) => each.item);
  const keeps = (pulls) => { const { items, architecture } = documentsOf(w.files); return conflicts(items.find((each) => each.id === "ITM-005"), "team2", holds(pulls), architecture); };
  assert.deepEqual(ofTeam1(holds(PULLS)), ["ITM-001", "ITM-002"]);
  assert.equal((await w.run([CLOSE()])).failed, null);
  assert.deepEqual(ofTeam1(holds(PULLS)), ["ITM-001"]);
  assert.deepEqual(ofTeam1(holds("unknown")), ["ITM-001"], "an item sent on is not held, though the pull requests are unknown");
  assert.deepEqual(keeps(PULLS), [{ sprint: SPRINT, team: "team1", item: "ITM-001", module: "MOD-store" }]);
  const merged = PULLS.map((each) => (each.number === 9 ? { ...each, state: "merged", merged: "2026-11-01T10:00:00Z", closed: "2026-11-01T10:00:00Z" } : each));
  assert.deepEqual(ofTeam1(holds(merged)), []);
  assert.deepEqual(keeps(merged), []);
});

// ---------------------------------------------------------------- the gate at the merge of a sprint's branch

const MODEL = "src/model-catalogue/models/scrum.md";
const assignmentOf = (team, owner) => readDocument(roleAssignmentSchema, `docs/role-assignments/${team}.md`,
  [`# ${team}`, "", "## Roles", "", "| Role | Participants |", "|---|---|", `| Product Owner | ${owner} |`, "| Scrum Master | sm-bot |", "| Developers | dev-a |", ""].join("\n"));

// TST-991304 · level: release · module: system
// guards: A GATE IS DECIDED WITHIN THE JOB'S ROLE ASSIGNMENT; UC-041
// given: a product that declares the shipped Scrum model with the branch sprint/<team>/<nn> for each sprint; team1's role assignment gives the Product Owner to alice, team2's to bob; team1/02 was closed by closer-bot, and its branch's pull request is https://github.com/akmaier/agent-m/pull/9; a host that keeps what is committed
// input: decide the gate Sprint Retrospective → Sprint Planning of team1/02, passed, on that pull request: by bob, with team1's assignment; by alice, with closer-bot and alice as those whose work it checks, alice having closed it; by alice, with closer-bot alone
// expect: bob is refused, "not a holder of the deciding role", holders alice, and alice who closed it, "did the work this gate checks"; neither writes anything; alice, who did not close it, passes: one commit of one gate record under docs/gates/ naming the gate, decider alice, role Product Owner, decision passed, and the pull request
test("TST-991304: the gate at a sprint branch's merge is passed only by its team's Product Owner, and not by one who closed the sprint", async () => {
  const files = { [MODEL]: read(MODEL) };
  const instance = { ref: "main", commit: "e".repeat(40), paths: Object.keys(files), blob: () => null, read: async (path) => files[path] ?? null };
  const declaration = readDocument(declarationSchema, "docs/process.md", ["---", "model: scrum", `model_file: ${MODEL}`, `model_version: ${instance.commit}`, "---", "# Process", "", "## Practices", "", "- none", "",
    "## Branches", "", "| Phase or time box | Branch |", "|---|---|", "| Sprint | sprint/<team>/<nn> |", "", "## Definition of Done", "", "The job rules hold; no condition is added.", ""].join("\n"));
  const workflow = await productWorkflow(declaration, async () => instance, "# Spec\n");
  const gate = workflow.gates.find((each) => each.from === "Sprint Retrospective" && each.to === "Sprint Planning");
  assert.equal(gate?.decider, "Product Owner", "known positive: the Product Owner decides the sprint's last gate");
  const commits = [];
  const host = { repositoryInfo: async () => ({ defaultBranch: "main" }), commitFiles: async (change) => { commits.push(change); return { commit: "d".repeat(40), url: "https://example.test/commit/d" }; } };
  const decide = (name, workBy) => recordGateDecision(host, { gate: gate.name, job: null, decider: { name, kind: "person" }, role: "Product Owner", decision: "passed", reason: null,
    on: ["https://github.com/akmaier/agent-m/pull/9"] }, { workflow, assignment: assignmentOf("team1", "alice"), workBy, head: "1".repeat(40), now: new Date("2026-11-01T09:00:00Z"), trailers: [] });
  const refused = async (promise) => { try { await promise; return null; } catch (error) { return { name: error.name, reason: error.reason, holders: error.holders }; } };
  assert.deepEqual(await refused(decide("bob", ["closer-bot"])), { name: "MayNotDecide", reason: "not a holder of the deciding role", holders: ["alice"] });
  assert.deepEqual(await refused(decide("alice", ["closer-bot", "alice"])), { name: "MayNotDecide", reason: "did the work this gate checks", holders: ["alice"] });
  assert.equal(commits.length, 0, "nothing is written for a refused decision");
  const passed = await decide("alice", ["closer-bot"]);
  assert.equal(commits.length, 1);
  assert.match(passed.path, /^docs\/gates\//);
  const record = commits[0].files[0].text;
  for (const line of [`gate: ${gate.name}`, "decider: alice", "role: Product Owner", "decision: passed", "https://github.com/akmaier/agent-m/pull/9"]) assert.ok(record.includes(line), `the record holds "${line}"`);
});

// ---------------------------------------------------------------- an agent's review and retrospective

// TST-991305 · level: release · module: system
// guards: AN AGENT'S REVIEW NAMES WHERE ITS FEEDBACK CAME FROM; UC-041
// given: the product of tests/uc-041-harness.mjs; closer-bot answers every request with a close whose review names no source
// input: the close job of team1/02 runs unattended, as CI and a Bridge run it, until its loop ends
// expect: known positive — closer-bot is sent the finding under AN AGENT'S REVIEW NAMES WHERE ITS FEEDBACK CAME FROM; no review is recorded that names no source: the record of team1/02 holds no ## Review, or one that names the sources of its feedback
test("TST-991305: an agent's review that names no source of its feedback is not recorded", async () => {
  const w = await closeWorld();
  const close = CLOSE();
  close.review.sources = [];
  const { inputs } = await w.run([close, close, close, close, close]);
  assert.ok(inputs[1].findings.some((each) => each.rule === "AN AGENT'S REVIEW NAMES WHERE ITS FEEDBACK CAME FROM"), "known positive: the finding is sent back");
  const record = w.files[RECORD];
  assert.ok(!/\n## Review\n/.test(record) || /Sources of the feedback: (?!none\.)\S/.test(record), record);
});

// TST-991306 · level: release · module: system
// guards: AN AGENT'S RETROSPECTIVE CHANGES NO PROCESS BY ITSELF; UC-041
// given: the product of tests/uc-041-harness.mjs, whose docs/spec-freigaben/ holds no queue
// input: closer-bot's retrospective proposes three changes — to the process model "Add a review phase", to the Definition of Done "A release test for every item", to a participant's instructions "closer-bot reads the issues first" — and one to the team agreement; the close job runs
// expect: known positive — the record of team1/02 holds the four changes with where each goes, and docs/process.md is byte-identical; every change to the process model, the Definition of Done or a participant's instructions is an open entry of a SPEC change queue: files under docs/spec-freigaben/ are written, and an entry's proposal holds each of the three texts
test("TST-991306: each change an agent's retrospective recommends to the process is an open entry of a SPEC change queue", async () => {
  const w = await closeWorld();
  const process = w.files["docs/process.md"];
  const changes = [["Add a review phase", "process model"], ["A release test for every item", "Definition of Done"], ["closer-bot reads the issues first", "a participant's instructions"], ["Pair on reviews", "team agreement"]];
  const close = { ...CLOSE(), retrospective: changes.map(([text, goes]) => ({ text, kind: "change", goes })) };
  assert.equal((await w.run([close])).failed, null);
  for (const [text, goes] of changes) assert.ok(w.files[RECORD].includes(`- change, to ${goes}: ${text}`), `known positive: the record holds ${text}`);
  assert.equal(w.files["docs/process.md"], process, "known positive: the process is unchanged");
  const queued = Object.entries(w.files).filter(([path]) => path.startsWith("docs/spec-freigaben/")).map(([, text]) => text).join("\n");
  for (const [text] of changes.slice(0, 3)) assert.ok(queued.includes(text), `an open entry proposes "${text}"`);
});

