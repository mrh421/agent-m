// MOD-progress-measures' progressView and backlogView (ITM-1260), as the accepted text of docs/architecture/MOD-progress-measures.md states them: "`ProgressView` — what the
// route `progress` shows of one commit … `teams` are the teams of the role assignments and the sprints, each with its running sprint — its newest whose record holds no
// `## Review` —, or null; … `merges` for each done item of the sprint the time of the earliest merged pull request that names it, in its branch or its title …; `blocked` the
// items the running sprints hold, in a model with sprints"; "`BacklogView` — what the route `backlog` shows of one commit … `rows` are every item of the backlog, each after the
// items it builds on, as `itemStates` orders them; `kept` what keeps an item from each team other than the one whose sprint holds it …; `lastEnded` the team's last sprint that
// has ended, with its items and their merges …; `uncovered` the accepted requirements and use cases no item realises"; and "Each holds what its page shows and nothing else: no
// record's text, no pull request".
// Run: node --test tests/progress-measures-views.test.mjs
//
// Module: MOD-progress-measures
// Guards: PROGRESS AND JOB STATE ARE DERIVED, NOT STORED; PROGRESS IS SHOWN IN THE MODEL'S OWN MEASURE; UC-035; UC-032
// Level: unit
//
// The product is a small Scrum-with-limit fixture of two teams held in memory behind a host of this file's own; its facts are read with productFacts' scope `work`, and the SPEC's
// requirements are added as the scope `all` reads them. Nothing reaches the network. Where the texts leave a reading open, the test states the one it takes: a running sprint's
// item is { item, path, title, state, changes, uses }; a sprint's `name` is `<team>/<nn>`. Each test states its input and its expected result before it runs (given / input /
// expect).

import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import * as measures from "../src/progress-measures/index.mjs";

const lines = (...rows) => `${rows.join("\n")}\n`;
const blobOf = (content) => createHash("sha1").update(content).digest("hex");
const ADDRESS = "https://github.com/acme/product";
const COMMIT = "c".repeat(40);
const NOW = new Date("2026-10-22T12:00:00Z");
const MARKER = "MARKER-OF-A-JOB-RECORD-1260";
const JOB = "JOB-20261021-0900-a1b2";

const SPEC = lines("# SPEC", "", "## 1. Rules", "", "**RULE ONE** *(PO)*", "The first rule.", "*Check:* no automatic check; at review.", "",
  "**RULE TWO** *(PO)*", "The second rule, which no item realises.", "*Check:* no automatic check; at review.");
const DECLARATION = lines("---", "model: fixture-scrum-wip", "model_file: docs/process-models/fixture.md", `model_version: ${"a".repeat(40)}`, "---", "# How the product is developed", "",
  "## Practices", "", "- none", "", "## Definition of Done", "", "The job rules hold.");
const assignment = (team, owner, builder) => lines(`# ${team}`, "", "## Roles", "", "| Role | Participants |", "|---|---|", `| Owner | ${owner} |`, `| Builders | ${builder} |`, `| Checker | ${builder} |`);
const item = (n, module, realises = "RULE ONE") => lines("---", `id: ITM-00${n}`, `title: The work of item ${n}`, "level: module", "realises:", `  - ${realises}`, "modules:", `  - ${module}`,
  "builds_on: []", "tests:", "  - unit", "origin:", "  - RULE ONE", "---", `# ITM-00${n} The work of item ${n}`, "", "## Outcome", "", `What item ${n} delivers.`, "", "## Acceptance", "", "- a unit test.");
const CLOSE = ["", "## Review", "", "What was done is done.", "", "## Unfinished items", "", "to the backlog:", "into the next sprint:", "", "## Retrospective", "", "- change: smaller items."];
const sprint = ({ n, start, end = "", goal, selection, closed = false }) => lines("---", `sprint: ${n}`, `goal: ${goal}`, `start: ${start}`, `end: ${end}`, "closer: alice", "branch:",
  "selection:", ...selection.map((each) => `  - ${each}`), "---", `# Sprint ${n}`, ...(closed ? CLOSE : []));
const JOB_RECORD = lines("---", `id: ${JOB}`, "kind: implement", "works_on:", "  - ITM-002", "participant: dev-a", "model: example-model", "route: ci hosted", "started_by: alice",
  "start: 2026-10-21 09:00 UTC", "agent_m: unknown, commit unknown", "limit: 1", "---", "## Destinations", "", MARKER, "", "## Parameters", "", "```json", "{}", "```");
const USE_CASE = lines("---", "id: UC-001", "title: Read a file", "area: 1", "actors:", "  - Reader", "realises:", "  - RULE ONE", "---", "# UC-001 Read a file");

function files() {
  const all = {
    "SPEC.md": SPEC, "docs/process.md": DECLARATION, "docs/process-models/fixture.md": readFileSync(new URL("./fixtures/flow/scrum-wip.md", import.meta.url), "utf8"),
    "docs/role-assignments/team1.md": assignment("team1", "alice", "dev-a"), "docs/role-assignments/team2.md": assignment("team2", "bob", "dev-b"),
    "docs/backlog/ITM-001-item-1.md": item(1, "MOD-store"), "docs/backlog/ITM-002-item-2.md": item(2, "MOD-pages"), "docs/backlog/ITM-003-item-3.md": item(3, "MOD-mail"),
    "docs/backlog/ITM-004-item-4.md": item(4, "MOD-feed", "UC-099"),
    "docs/backlog/sprints/team1/03.md": sprint({ n: 3, start: "2026-10-20", goal: "Store and show", selection: ["ITM-001", "ITM-002"] }),
    "docs/backlog/sprints/team2/02.md": sprint({ n: 2, start: "2026-10-06", end: "2026-10-12", goal: "Mail", selection: ["ITM-003"], closed: true }),
    [`docs/jobs/${JOB}.md`]: JOB_RECORD, "docs/use-cases/UC-001-read-a-file.md": USE_CASE,
  };
  all[`docs/approvals/UC-001-${blobOf(USE_CASE).slice(0, 12)}.md`] = lines("---", "kind: use-case", "file: docs/use-cases/UC-001-read-a-file.md", `blob: ${blobOf(USE_CASE)}`, "---", "# Approval");
  return all;
}

const pr = (number, id, state, opened, merged = null) => ({ number, title: `${id}: the work of ${id}`, branch: `work/${id}`, base: "main", head: String(number).repeat(40).slice(0, 40), state,
  draft: false, url: `${ADDRESS}/pull/${number}`, opened, merged, closed: merged, body: `the body of #${number}`, mergeCommit: merged ? "f".repeat(40) : null });
const PULL_REQUESTS = [pr(1, "ITM-001", "merged", "2026-10-20T09:00:00Z", "2026-10-21T10:00:00Z"), pr(2, "ITM-002", "open", "2026-10-21T12:00:00Z"),
  pr(3, "ITM-003", "merged", "2026-10-07T09:00:00Z", "2026-10-08T10:15:00Z")];

function hostOf(held) {
  const snapshot = () => ({ repository: { server: "github", path: "acme/product", web: ADDRESS }, ref: "main", commit: COMMIT, paths: Object.keys(held),
    blob: (path) => (Object.hasOwn(held, path) ? blobOf(held[path]) : null), read: async (path) => (Object.hasOwn(held, path) ? held[path] : null), readMany: async () => {} });
  return {
    async repositoryInfo() { return { defaultBranch: "main", visibility: "public", canWrite: true, archived: false, description: "" }; },
    async readSnapshot() { return snapshot(); },
    async listPullRequests() { return PULL_REQUESTS; },
    async containsCommit() { return false; },
  };
}

async function factsOf() {
  const product = hostOf(files());
  const instance = hostOf({ "SPEC.md": "# Instance\n", "docs/process-models/fixture.md": files()["docs/process-models/fixture.md"] });
  const facts = await measures.productFacts(product, await instance.readSnapshot("main"), () => instance.readSnapshot("main"), NOW, { scope: "work" });
  return { ...facts, requirements: ["RULE ONE", "RULE TWO"] };
}
const plain = (value) => JSON.parse(JSON.stringify(value));

// TST-1260001 · level: unit · module: MOD-progress-measures
// guards: PROGRESS IS SHOWN IN THE MODEL'S OWN MEASURE; UC-035; PROGRESS AND JOB STATE ARE DERIVED, NOT STORED
// given: team1's sprint 03 runs since 2026-10-20 with ITM-001 (merged by pull request 1 at 2026-10-21T10:00Z) and ITM-002 (pull request 2 open, job JOB-20261021-0900-a1b2 working on it); team2's sprint 02 is closed; ITM-004 realises UC-099, which is not accepted, and no sprint selects it
// input: progressView(facts, 2026-10-22T12:00Z)
// expect: commit ccc…c, declared, the model fixture-scrum-wip with sprints and the limit 2; teams team1 and team2 in this order; team1's sprint team1/03 with its goal, start, closer, not final and endable, its items ITM-001 done changing MOD-store and ITM-002 in progress changing MOD-pages, and merges [{ item: ITM-001, at: 2026-10-21T10:00:00.000Z }]; team2 with no sprint; gates as gateOverview gives them; blocked those of blocked(facts) among ITM-001 and ITM-002 alone — ITM-004, which blocked(facts) lists, is not among them —; who as whoWorksOnWhat gives it
test("progressView gives each team's running sprint with its items, their states and modules, and the merges of its done items", async () => {
  const facts = await factsOf();
  const view = measures.progressView(facts, NOW);
  assert.equal(view.commit, COMMIT);
  assert.equal(view.declared, true);
  assert.equal(view.modelFile, "docs/process-models/fixture.md");
  assert.deepEqual([view.model.name, view.model.sprints, view.model.wip], ["fixture-scrum-wip", true, 2]);
  assert.deepEqual(view.teams.map((team) => team.team), ["team1", "team2"]);
  const team1 = view.teams[0].sprint;
  assert.deepEqual([team1.name, team1.path, team1.goal, team1.start, team1.closer, team1.final, team1.endable],
    ["team1/03", "docs/backlog/sprints/team1/03.md", "Store and show", "2026-10-20", "alice", false, true]);
  assert.deepEqual(team1.items.map((each) => [each.item, each.state.state, each.changes]), [["ITM-001", "done", ["MOD-store"]], ["ITM-002", "in progress", ["MOD-pages"]]]);
  assert.deepEqual(team1.merges, [{ item: "ITM-001", at: "2026-10-21T10:00:00.000Z" }]);
  assert.equal(view.teams[1].sprint, null);
  assert.deepEqual(plain(view.gates), plain(measures.gateOverview(facts)));
  const all = measures.blocked(facts);
  assert.ok(all.some((entry) => entry.item === "ITM-004"), "known positive: ITM-004 is blocked in the facts");
  assert.deepEqual(plain(view.blocked), plain(all.filter((entry) => ["ITM-001", "ITM-002"].includes(entry.item))));
  assert.deepEqual(plain(view.who), plain(measures.whoWorksOnWhat(facts)));
});

// TST-1260002 · level: unit · module: MOD-progress-measures
// guards: UC-032; PROGRESS AND JOB STATE ARE DERIVED, NOT STORED; SPRINTS OF DIFFERENT TEAMS CHANGE NO MODULE THE OTHER CHANGES OR USES
// given: the same facts, the SPEC's requirements RULE ONE and RULE TWO among them, and the accepted use case UC-001
// input: backlogView(facts, 2026-10-22T12:00Z)
// expect: one row per item in the order of facts.plan.states, each with its path, title, what it realises and the state facts.plan.states gives it; ITM-002 held by team1/03 of team1 and kept from team2 by team1/03, which holds ITM-002; team1 running team1/03 with its selection ITM-001, ITM-002 and its owner alice, and no sprint that has ended; team2 running none, its last ended sprint team2/02 from 2026-10-06 with its item ITM-003 and the merge of ITM-003 at 2026-10-08T10:15:00.000Z; uncovered: the requirement RULE TWO and the use case UC-001
test("backlogView gives every item with its state, hold and what keeps it, each team's running and last ended sprint, and what no item realises", async () => {
  const facts = await factsOf();
  const view = measures.backlogView(facts, NOW);
  assert.equal(view.commit, COMMIT);
  assert.deepEqual(view.rows.map((row) => row.item), facts.plan.states.map((state) => state.item));
  assert.deepEqual(plain(view.rows.map((row) => row.state)), plain(facts.plan.states));
  const two = view.rows.find((row) => row.item === "ITM-002");
  assert.deepEqual([two.path, two.title, two.realises], ["docs/backlog/ITM-002-item-2.md", "The work of item 2", ["RULE ONE"]]);
  assert.deepEqual([two.held?.sprint, two.held?.team], ["team1/03", "team1"]);
  assert.deepEqual(two.kept.map((kept) => [kept.team, kept.sprint, kept.item]), [["team2", "team1/03", "ITM-002"]]);
  const [team1, team2] = view.teams;
  assert.deepEqual([team1.team, team1.owner, team1.running?.name, team1.running?.selection, team1.lastEnded], ["team1", "alice", "team1/03", ["ITM-001", "ITM-002"], null]);
  assert.equal(team2.running, null);
  assert.deepEqual([team2.lastEnded.name, team2.lastEnded.start, team2.lastEnded.items, team2.lastEnded.merges],
    ["team2/02", "2026-10-06", ["ITM-003"], [{ item: "ITM-003", at: "2026-10-08T10:15:00.000Z" }]]);
  assert.deepEqual(view.uncovered, { requirements: ["RULE TWO"], useCases: ["UC-001"] });
});

// TST-1260003 · level: unit · module: MOD-progress-measures
// guards: PROGRESS AND JOB STATE ARE DERIVED, NOT STORED
// given: the same facts, whose job record holds the marker MARKER-OF-A-JOB-RECORD-1260 in its body and whose pull requests each hold a body "the body of #<n>"
// input: progressView and backlogView, as JSON
// expect: ITM-003 and ITM-004, which no running sprint selects, stand nowhere in progressView's text; neither text holds the marker or a pull request's body — counter-proof: the record's text, which the facts' snapshot reads, holds the marker
test("the views hold no item outside the running sprints in progress, and no record's text or pull request", async () => {
  const facts = await factsOf();
  assert.match(await facts.snapshot.read(`docs/jobs/${JOB}.md`), new RegExp(MARKER), "known positive: the record holds the marker");
  const progress = JSON.stringify(measures.progressView(facts, NOW));
  const backlog = JSON.stringify(measures.backlogView(facts, NOW));
  for (const outside of ["ITM-003", "ITM-004"]) assert.ok(!progress.includes(outside), `${outside} is not in progressView`);
  for (const [name, text] of [["progress", progress], ["backlog", backlog]]) {
    assert.ok(!text.includes(MARKER), `${name}: no record's text`);
    assert.ok(!text.includes("the body of #"), `${name}: no pull request`);
  }
});
