// The writer `sprint-record` of MOD-work-plans' `workStrategies` (ITM-620), as the accepted text of docs/architecture/MOD-work-plans.md states it (blob ee571b6be5a5484c57d66e0f110c9aa2a1d82b5b,
// workStrategies, :253-254): "writer `sprint-record` — an agent's close through `closeSprint`, with the job's provenance lines, under the closer's name; the proposals of the retrospective stay proposals."
// and `closeSprint` (:222-232). Run: node --test tests/work-plans-sprint-record-writer.test.mjs
//
// Module: MOD-work-plans
// Guards: UC-041; A SPRINT ENDS WITH A REVIEW OF ITS INCREMENT; AN AGENT'S RETROSPECTIVE CHANGES NO PROCESS BY ITSELF; A SPRINT ENDS WITH A RETROSPECTIVE; AN AGENT'S REVIEW NAMES WHERE ITS FEEDBACK CAME FROM
// Level: unit
//
// The readings are the item's (ITM-620, settled by the Product Owner): the draft is `closeSprint`'s `close`; `facts` are `sprintFacts` of the same sprint, computed as the recipe `sprint-facts` computes them (the writer calls the recipe's
// function); `architecture` is the module files of the job's snapshot; `head` is the snapshot's commit; `trailers` are `provenanceLines` of the job, the participant's name among them. The product is a fixture held in memory behind a host
// of this file's own, which keeps the commits it is given; nothing reaches the network. Each test states its input and its expected result before it runs (given / input / expect). The counter-proofs are recorded in the pull request.

import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import * as workPlans from "../src/work-plans/index.mjs";
import { prepareJob, registerStrategies } from "../src/job-runner/index.mjs";
import { kindOf } from "../src/job-catalogue/index.mjs";
import { queues } from "../src/spec-changes/index.mjs";

const lines = (...rows) => `${rows.join("\n")}\n`;
const blobOf = (text) => createHash("sha1").update(text).digest("hex");
const DECLARED = "5".repeat(40), H1 = "a1".repeat(20);
const ADDRESS = "https://github.com/acme/product";

const item = (id, extra = []) => lines("---", `id: ${id}`, `title: ${id} item`, "level: module", "realises:", "  - UC-001", "modules:", "  - MOD-store", ...extra, "tests:", "  - unit",
  "origin:", "  - UC-001", "---", `# ${id} item`, "", "## Outcome", "", "o", "", "## Acceptance", "", "a");
const sprint = (number, selection) => lines("---", `sprint: ${number}`, "goal: The fixture sprint", "start: 2026-10-12", "end: 2026-10-19", "closer: alice", "branch:", "selection:", ...selection.map((each) => `  - ${each}`), "---",
  `# team1 Sprint ${number}`);
const JOB = lines("---", "id: JOB-20261014-0900-a1b2", "kind: implement", "works_on:", "  - ITM-002", "route: ci hosted", "started_by: alice", "start: 2026-10-14 09:00 UTC",
  "agent_m: unknown, commit unknown", "limit: 1", "---", "## Destinations", "", "## Parameters", "", "```json", "{}", "```");
const OTHER_JOB = JOB.replace("JOB-20261014-0900-a1b2", "JOB-20261014-1000-c3d4").replace("ITM-002", "ITM-003");
const DECLARATION = lines("---", "model: scrum", "model_file: src/model-catalogue/models/scrum.md", `model_version: ${DECLARED}`, "---", "# Process", "", "## Practices", "", "- none", "", "## Branches", "",
  "| Phase or time box | Branch |", "|---|---|", "| Sprint | sprint/<team>/<nn> |", "", "## Definition of Done", "", "The job rules hold; no condition is added.");
const TEST_FILE = lines("// TST-001 · level: unit · module: MOD-store", "// guards: UC-001", "// given: a store", "// input: a read", "// expect: its text", 'test("a store reads", () => {});');
const RUN_RECORD = lines("---", `commit: ${H1}`, "levels:", "  - unit", "occasion: commit", "participant: ci", "date: 2026-10-14 10:00 UTC", "---", "## Outcomes", "", "| Test | Level | Outcome | Runs |", "|---|---|---|---|",
  "| TST-001 | unit | passed |  |");
const RECORD_PATH = `runs/${H1}/20261014-1000-commit-aaaa.md`;

function productFiles() {
  const files = {
    "SPEC.md": "# Fixture\n", "docs/process.md": DECLARATION, "docs/use-cases/UC-001-store.md": "# UC-001 store\n",
    "docs/backlog/ITM-001-a.md": item("ITM-001"), "docs/backlog/ITM-002-b.md": item("ITM-002", ["builds_on:", "  - ITM-001"]), "docs/backlog/ITM-003-c.md": item("ITM-003"),
    "docs/backlog/sprints/team1/01.md": sprint(1, ["ITM-001", "ITM-002"]), "docs/backlog/sprints/team1/02.md": sprint(2, ["ITM-003"]),
    "docs/jobs/JOB-20261014-0900-a1b2.md": JOB, "docs/jobs/JOB-20261014-1000-c3d4.md": OTHER_JOB, "tests/store.test.mjs": TEST_FILE,
  };
  files[`docs/approvals/UC-001-${blobOf(files["docs/use-cases/UC-001-store.md"]).slice(0, 12)}.md`] = "kind: use-case\n";
  return files;
}

const snapshotOf = (files, web) => ({ repository: { server: "github", path: "acme/product", web }, ref: "main", commit: "c".repeat(40), paths: Object.keys(files),
  blob: (path) => (Object.hasOwn(files, path) ? blobOf(files[path]) : null), read: async (path) => (Object.hasOwn(files, path) ? files[path] : null) });
const named = (name) => Object.assign(new Error(name), { name });
const pullRequest = (number, id, state, head) => ({ number, title: `${id}: the work`, branch: `job/${id}`, base: "main", head, state, draft: false, url: `${ADDRESS}/pull/${number}`,
  opened: "2026-10-13T08:00:00Z", merged: state === "merged" ? "2026-10-14T09:30:00Z" : null, closed: null, body: "" });
const issue = (number, opened, closed = null, comments = []) => ({ number, title: `Issue ${number}`, body: "", labels: [], state: closed ? "closed" : "open", url: `${ADDRESS}/issues/${number}`, opened, closed, comments });

// The context of a close-sprint job; the host answers readSnapshot (the product, the branch test-results), listPullRequests and listIssues.
function contextOf({ params = { sprint: "team1/01" }, issues = [issue(7, "2026-10-14T10:00:00Z"), issue(8, "2026-09-01T10:00:00Z")], noIssues = false, files = productFiles(),
  instanceWeb = "https://github.com/acme/agent-m", instanceSpec = "# Instance\n" } = {}) {
  const asked = [];
  const product = snapshotOf(files, ADDRESS);
  const results = { paths: [RECORD_PATH], blob: () => null, read: async (path) => (path === RECORD_PATH ? RUN_RECORD : null) };
  const host = {
    async readSnapshot(ref) { asked.push(["readSnapshot", ref]); if (ref === "test-results") return results; return product; },
    async listPullRequests() { return [pullRequest(1, "ITM-001", "merged", H1), pullRequest(2, "ITM-002", "open", "a2".repeat(20))]; },
    async listIssues(filter) { asked.push(["listIssues", filter]); if (noIssues) throw named("NotSupported"); return issues; },
  };
  // The instance, at its own address unless `instanceWeb` names another: it keeps what is committed to it, its head moving on with each commit.
  const instanceFiles = { "SPEC.md": instanceSpec }, instanceCommits = [];
  const instanceHead = () => String(instanceCommits.length + 1).padStart(40, "e");
  const instanceAt = () => ({ ...snapshotOf(instanceFiles, instanceWeb), commit: instanceHead() });
  const instance = instanceAt();
  const instanceHost = { async readSnapshot(ref) { asked.push(["instance", ref]); return instanceAt(); },
    async repositoryInfo() { return { defaultBranch: "main", canWrite: true }; },
    async commitFiles(change) {
      if (change.expectedHead !== instanceHead()) throw Object.assign(named("Moved"), { head: instanceHead() });
      instanceCommits.push(change);
      for (const file of change.files) { if (file.delete) delete instanceFiles[file.path]; else instanceFiles[file.path] = file.text; }
      return { commit: instanceHead() };
    } };
  return { asked, instanceFiles, instanceCommits, context: { kind: null, params, product: { address: ADDRESS, snapshot: product, host }, instance: { snapshot: instance, host: instanceHost, checkout: null }, connect: async () => null,
    participants: [], places: { sources: {}, mailbox: null, contents: [] }, gates: [], person: "alice", now: new Date("2026-10-19T08:00:00Z"), agentM: { version: "unreleased", commit: "a".repeat(40) }, jobId: null } };
}
const recipe = (setting) => workPlans.workStrategies.recipes["sprint-facts"](setting.context, setting.context.params);
const byName = (parts, name) => parts.find((part) => part.name === name);


const CLOSER = { name: "closer-bot", model: "model-x" };
const JOB_ID = "JOB-20261019-0900-ab12";
const CLOSE = { sprint: "team1/01",
  review: { feedback: [{ line: "No stakeholder took part; issue 7 shows the export works", goes: "noted", item: null }], tookPart: [], sources: ["issues of sprint team1/01"] },
  unfinished: [{ item: "ITM-002", to: "next sprint", reason: "its pull request is still open" }],
  retrospective: [{ text: "Review pull requests the same day", kind: "change", goes: "team agreement" }, { text: "The fixtures were quick to build", kind: "went well", goes: null }], newItems: [] };

// The setting of a job of the kind close-sprint, with a host that keeps what is committed.
function jobOf({ close = CLOSE, files = productFiles(), params = { sprint: "team1/01" }, instanceWeb, instanceSpec } = {}) {
  const setting = contextOf({ params, files, instanceWeb, instanceSpec });
  const commits = [];
  const host = setting.context.product.host;
  host.repositoryInfo = async () => ({ defaultBranch: "main", canWrite: true });
  host.commitFiles = async (request) => { commits.push(request); return { commit: "d".repeat(40) }; };
  const context = { ...setting.context, kind: { name: "close-sprint" }, jobId: JOB_ID };
  const result = { draft: close, drafter: CLOSER, rounds: [{ number: 1 }, { number: 2 }] };
  return { context, result, commits, files, instanceFiles: setting.instanceFiles, instanceCommits: setting.instanceCommits,
    write: () => workPlans.workStrategies.writers["sprint-record"](result, context) };
}

// TST-620001 · level: unit · module: MOD-work-plans
// guards: UC-041; A SPRINT ENDS WITH A REVIEW OF ITS INCREMENT; A SPRINT ENDS WITH A RETROSPECTIVE
// given: the fixture product, the sprint team1/01 (ITM-001 merged, ITM-002 in progress) and a clean close that decides ITM-002 and has a retrospective
// input: the writer sprint-record
// expect: one commit on the default branch, at the snapshot's head, of the sprint's record alone; the record keeps what it had and gains `## Review` (the increment ITM-001 merged with pull request 1, ITM-002 not done), `## Unfinished items` and `## Retrospective`; the outcome names the commit and the file, a pull request is none, nothing is shown
// Planted fault: writing the review without the facts leaves the increment out; committing a second file, or on another head, changes the request.
test("the writer closes the sprint through closeSprint: one commit of the record, with the facts' increment and the retrospective", async () => {
  const job = jobOf();
  const outcome = await job.write();
  assert.equal(job.commits.length, 1);
  const [request] = job.commits;
  assert.equal(request.branch, "main");
  assert.equal(request.expectedHead, "c".repeat(40));
  assert.deepEqual(request.files.map((each) => each.path), ["docs/backlog/sprints/team1/01.md"]);
  const record = request.files[0].text;
  assert.ok(record.startsWith(job.files["docs/backlog/sprints/team1/01.md"].trimEnd()), "the record keeps what it had");
  assert.match(record, /## Review[\s\S]*- ITM-001, merged with 1; realises UC-001; guarded by TST-001\./);
  assert.match(record, /Not done:\n- ITM-002: in progress/);
  assert.match(record, /## Unfinished items[\s\S]*- ITM-002: into the next sprint — its pull request is still open/);
  assert.match(record, /## Retrospective[\s\S]*- change, to team agreement: Review pull requests the same day/);
  assert.deepEqual([outcome.commits, outcome.files, outcome.pullRequest, outcome.shown], [["d".repeat(40)], ["docs/backlog/sprints/team1/01.md"], null, null]);
});

// TST-620002 · level: unit · module: MOD-work-plans
// guards: UC-041; PROGRESS AND JOB STATE ARE DERIVED, NOT STORED
// given: the same product; the recipe sprint-facts run on the same job for the same sprint; a close that decides no unfinished item
// input: the writer
// expect: the facts the writer uses are the recipe's: the writer's review names every item of the recipe's increment with its pull request, and it refuses the close with Undecided naming exactly the items the recipe's facts hold as not done (ITM-002), writing nothing
// Planted fault: facts computed another way (every item of the backlog, or none) change the increment or the refused items.
test("the facts are the recipe's: the review lists its increment, and Undecided names what the recipe holds as not done", async () => {
  const job = jobOf();
  const facts = JSON.parse((await workPlans.workStrategies.recipes["sprint-facts"](job.context, job.context.params)).find((part) => part.name === "facts of sprint team1/01").text);
  await job.write();
  for (const done of facts.increment) assert.ok(job.commits[0].files[0].text.includes(`- ${done.item}, merged with ${done.pullRequest};`), done.item);
  const undecided = jobOf({ close: { ...CLOSE, unfinished: [] } });
  await assert.rejects(undecided.write(), (error) => error.name === "Undecided" && JSON.stringify(error.items) === JSON.stringify(facts.notDone.map((each) => each.item)));
  assert.deepEqual(undecided.commits, []);
});

// TST-620003 · level: unit · module: MOD-work-plans
// guards: UC-041; AN ARTIFACT RECORDS THE VERSION THAT PRODUCED IT
// given: the job JOB-20261019-0900-ab12 of the kind close-sprint, drafted by the participant closer-bot of model-x after two rounds, run from Agent M's commit aaaa…
// input: the writer
// expect: the commit's message names the sprint and ends with the provenance lines of provenanceLines for this job — the Agent M version and commit, the job, the kind close-sprint, the participant closer-bot, its model and 2 rounds — so that the closer's name stands in the commit
// Planted fault: trailers left out, or those of another job or participant, change the message.
test("the commit's message carries the job's provenance lines, with the closer's name", async () => {
  const job = jobOf();
  await job.write();
  const message = job.commits[0].message;
  assert.match(message, /^Close sprint team1\/01/);
  for (const line of [`Agent-M-Version: unreleased, commit ${"a".repeat(40)}`, `Agent-M-Job: ${JOB_ID}`, "Agent-M-Kind: close-sprint", "Agent-M-Participant: closer-bot", "Agent-M-Model: model-x", "Agent-M-Rounds: 2"]) {
    assert.ok(message.includes(line), line);
  }
});

// TST-620004 · level: unit · module: MOD-work-plans
// guards: UC-041; A SPRINT ENDS WITH A RETROSPECTIVE; AN AGENT'S RETROSPECTIVE CHANGES NO PROCESS BY ITSELF
// given: a close with a proposal for the process model in its retrospective; a close without a retrospective; a sprint whose record already holds `## Review`
// input: the writer on each
// expect: the proposal stands in the record as a line of the retrospective ("change, to process model: …") and no other file of the product is written — docs/process.md is not in the commit; the close without a retrospective is refused with RetrospectiveMissing, the closed sprint with AlreadyClosed, and nothing is committed in either case
// Planted fault: writing the proposal into docs/process.md, or committing before the refusal, changes the files or the commits.
test("a proposal of the retrospective stays a proposal, and a close that closeSprint refuses writes nothing", async () => {
  const proposing = jobOf({ close: { ...CLOSE, retrospective: [{ text: "Add a review gate", kind: "change", goes: "process model" }] } });
  await proposing.write();
  assert.deepEqual(proposing.commits[0].files.map((each) => each.path), ["docs/backlog/sprints/team1/01.md"]);
  assert.match(proposing.commits[0].files[0].text, /- change, to process model: Add a review gate/);
  const bare = jobOf({ close: { ...CLOSE, retrospective: [] } });
  await assert.rejects(bare.write(), (error) => error.name === "RetrospectiveMissing");
  const files = productFiles();
  files["docs/backlog/sprints/team1/01.md"] += "\n## Review\n\nclosed already\n";
  const closed = jobOf({ files });
  await assert.rejects(closed.write(), (error) => error.name === "AlreadyClosed");
  assert.deepEqual([bare.commits, closed.commits], [[], []]);
});

// TST-1403001 · level: unit · module: MOD-work-plans
// guards: UC-041; A SPRINT ENDS WITH A REVIEW OF ITS INCREMENT
// given: the fixture product; a job of the kind close-sprint whose parameter sprint is team1/01; a clean close in the form of close-sprint's answer, which names no sprint (the key `sprint` is left out)
// input: the writer sprint-record
// expect: no failure; one commit, of docs/backlog/sprints/team1/01.md alone, whose message begins "Close sprint team1/01"; the record keeps what it had and gains ## Review with team1/01's increment, ITM-001 merged with 1
// Planted fault: the writer taking the sprint from the draft fails with UnknownWork, the job naming no sprint, and commits nothing.
test("a close answered without a sprint closes the sprint the job's parameter names", async () => {
  const { sprint: _, ...answer } = CLOSE;
  const job = jobOf({ close: answer });
  const outcome = await job.write();
  assert.equal(job.commits.length, 1);
  assert.deepEqual(job.commits[0].files.map((each) => each.path), ["docs/backlog/sprints/team1/01.md"]);
  assert.match(job.commits[0].message, /^Close sprint team1\/01/);
  const record = job.commits[0].files[0].text;
  assert.ok(record.startsWith(job.files["docs/backlog/sprints/team1/01.md"].trimEnd()), "the record keeps what it had");
  assert.match(record, /## Review[\s\S]*- ITM-001, merged with 1;/);
  assert.deepEqual(outcome.files, ["docs/backlog/sprints/team1/01.md"]);
});

// TST-1403002 · level: unit · module: MOD-work-plans
// guards: UC-041; A SPRINT ENDS WITH A REVIEW OF ITS INCREMENT
// given: the fixture product; a job of the kind close-sprint whose parameter sprint is team1/01; a close whose draft names another sprint, team1/02, and decides ITM-002, which team1/01 holds as not done
// input: the writer sprint-record
// expect: the close is recorded for team1/01, whatever the draft holds: one commit, of docs/backlog/sprints/team1/01.md alone, its message beginning "Close sprint team1/01", the record gaining ## Review with ITM-001 merged with 1; team1/02's record is in no commit
// Planted fault: the writer taking the sprint from the draft closes team1/02 — its record is committed, with team1/02's facts, in which ITM-003 is not done and undecided, so the close is refused with Undecided.
test("the sprint closed is the job's parameter, not the sprint the draft names", async () => {
  const job = jobOf({ close: { ...CLOSE, sprint: "team1/02" } });
  await job.write();
  assert.equal(job.commits.length, 1);
  assert.deepEqual(job.commits[0].files.map((each) => each.path), ["docs/backlog/sprints/team1/01.md"]);
  assert.match(job.commits[0].message, /^Close sprint team1\/01/);
  assert.match(job.commits[0].files[0].text, /## Review[\s\S]*- ITM-001, merged with 1;/);
});

const REVIEW_RULE = "AN AGENT'S REVIEW NAMES WHERE ITS FEEDBACK CAME FROM";
const refusal = (promise) => Promise.resolve(promise).then(() => null, (error) => error);
// The result as the job runner hands it to the writer when nobody attends and the loop ended with the review's finding still open (MOD-job-runner, runJob: "it calls the kind's writer at once [...], which
// refuses by name what it must not write").
const leftOpen = (job) => Object.assign(job.result, { stoppedBecause: "unchanged",
  remaining: [{ artifact: "the record of sprint team1/01", line: 1, kind: "error", rule: REVIEW_RULE, what: "the review names no sources of its feedback", fix: "name each source" }] });

// TST-1404001 · level: unit · module: MOD-work-plans
// guards: AN AGENT'S REVIEW NAMES WHERE ITS FEEDBACK CAME FROM; UC-041
// given: the fixture product and the sprint team1/01; a close whose review names its sources ["issues of sprint team1/01"] (the known positive); the same close with its sources [] and with its sources null, each handed to the writer as an unattended job's result whose loop ended unchanged with the review's finding open
// input: the writer sprint-record on each
// expect: known positive — one commit, whose record holds "Sources of the feedback: issues of sprint team1/01."; the close with sources [] and the one with sources null are each refused with ReviewRefused, whose findings are errors under AN AGENT'S REVIEW NAMES WHERE ITS FEEDBACK CAME FROM naming the sources, and nothing is committed: no record says "Sources of the feedback: none."
// Planted fault: the writer handing the draft to closeSprint unchecked records the review with "Sources of the feedback: none." (sources []) or with no sources line at all (sources null).
test("an agent's review that names no source of its feedback is refused by name, and nothing is recorded", async () => {
  const known = jobOf();
  await known.write();
  assert.equal(known.commits.length, 1);
  assert.ok(known.commits[0].files[0].text.includes("Sources of the feedback: issues of sprint team1/01."), "known positive: the sources are recorded");
  for (const sources of [[], null]) {
    const job = jobOf({ close: { ...CLOSE, review: { ...CLOSE.review, sources } } });
    leftOpen(job);
    const refused = await refusal(job.write());
    assert.equal(refused?.name, "ReviewRefused", `${JSON.stringify(sources)}: ${refused}`);
    assert.ok(refused.findings.length > 0 && refused.findings.every((each) => each.kind === "error" && each.rule === REVIEW_RULE), JSON.stringify(refused.findings));
    assert.ok(refused.findings.some((each) => /sources/.test(each.what)), JSON.stringify(refused.findings));
    assert.deepEqual(job.commits, [], `${JSON.stringify(sources)}: nothing is committed`);
  }
});

// TST-1404002 · level: unit · module: MOD-work-plans
// guards: AN AGENT'S REVIEW NAMES WHERE ITS FEEDBACK CAME FROM; UC-041
// given: the fixture product and the sprint team1/01; closes whose review names its sources: (a) the known positive, whose feedback line says that no stakeholder took part; (b) no one in tookPart and no line that says no stakeholder took part; (c) the stakeholder Erika in tookPart, her feedback recorded among the sources as "mail MAIL-ca171c6d1e8e76f0 of Erika"; (d) Erika in tookPart, her feedback recorded in no line and no source
// input: the writer sprint-record on each, as an unattended job's result
// expect: (a) and (c) are each committed once, (c)'s record naming Erika among who took part and her mail among the sources; (b) is refused with ReviewRefused, its finding under AN AGENT'S REVIEW NAMES WHERE ITS FEEDBACK CAME FROM saying that the review does not state that no stakeholder took part, and (d) with ReviewRefused naming Erika; nothing is committed for (b) or (d)
// Planted fault: a writer that checks only that sources are named records (b) and (d).
test("an agent's review says that no stakeholder took part unless one did, and names where a stakeholder's feedback is recorded", async () => {
  const quiet = [{ line: "Issue 7 shows the export works", goes: "noted", item: null }];
  const sources = ["issues of sprint team1/01"];
  const said = jobOf();
  const listed = jobOf({ close: { ...CLOSE, review: { feedback: quiet, tookPart: ["Erika"], sources: [...sources, "mail MAIL-ca171c6d1e8e76f0 of Erika"] } } });
  for (const job of [said, listed]) {
    leftOpen(job);
    await job.write();
    assert.equal(job.commits.length, 1, "known positive: the review is recorded");
  }
  assert.match(listed.commits[0].files[0].text, /Took part: Erika\.[\s\S]*Sources of the feedback: .*mail MAIL-ca171c6d1e8e76f0 of Erika\./);
  const silent = jobOf({ close: { ...CLOSE, review: { feedback: quiet, tookPart: [], sources } } });
  const nowhere = jobOf({ close: { ...CLOSE, review: { feedback: quiet, tookPart: ["Erika"], sources } } });
  for (const [job, named] of [[silent, /no stakeholder took part/], [nowhere, /Erika/]]) {
    leftOpen(job);
    const refused = await refusal(job.write());
    assert.equal(refused?.name, "ReviewRefused", String(refused));
    assert.ok(refused.findings.some((each) => each.rule === REVIEW_RULE && named.test(each.what)), JSON.stringify(refused.findings));
    assert.deepEqual(job.commits, []);
  }
});

// TST-620005 · level: unit · module: MOD-work-plans
// guards: UC-041
// given: workStrategies registered with the job runner, and the kind close-sprint, whose writer is named sprint-record
// input: the job prepared by the job runner for the kind
// expect: the job runner finds every strategy the kind names — the recipe, the check and the writer — and prepares the job without UnknownStrategy; the kind's writer is among workStrategies' writers
// Planted fault: leaving the writer out of workStrategies makes the preparation fail with UnknownStrategy naming sprint-record.
test("workStrategies offers the writer the kind close-sprint names, so that the job is prepared without UnknownStrategy", async () => {
  registerStrategies("tests/work-plans-sprint-record-writer.test.mjs", workPlans.workStrategies);
  const kind = await kindOf("close-sprint");
  assert.equal(kind.writer, "sprint-record");
  assert.equal(typeof workPlans.workStrategies.writers["sprint-record"], "function");
  const prepared = await prepareJob("close-sprint", { ...jobOf().context, kind }, { drafter: null, reviewers: [] });
  assert.equal(prepared.kind.name, "close-sprint");
});

// A retrospective that recommends a change to each of the three places of the process and one to the team agreement.
const PROCESS_CHANGES = [["Add a review phase", "process model"], ["A release test for every item", "Definition of Done"], ["closer-bot reads the issues first", "a participant's instructions"]];
const PROPOSING = { ...CLOSE, retrospective: [...PROCESS_CHANGES.map(([text, goes]) => ({ text, kind: "change", goes })), { text: "Pair on reviews", kind: "change", goes: "team agreement" },
  { text: "The fixtures were quick to build", kind: "went well", goes: null }] };
// A SPEC that holds the three requirements governing the process, in two numbered sections and after a third section that holds none of them.
const PROCESS_SECTION = lines("## 5. Process models", "", "**THE PROCESS MODEL IS DECLARED PER PRODUCT** *(PO)*", "A product declares one model.", "*Check:* `tests/a.py`");
const JOBS_SECTION = lines("## 13. Jobs", "", "**A PRODUCT DECLARES ITS DEFINITION OF DONE** *(PO)*", "A product declares its Definition of Done.", "*Check:* `tests/b.py`", "",
  "**AN AGENT'S RETROSPECTIVE CHANGES NO PROCESS BY ITSELF** *(PO)*", "A rule of the process changes only through the SPEC.", "*Check:* `tests/c.py`");
const SPEC = lines("# Specification", "", "## 1. Other", "", "**ANOTHER RULE** *(PO)*", "Another rule.", "*Check:* `tests/d.py`").concat(PROCESS_SECTION, JOBS_SECTION);
// The two proposals the close's changes give: each section as it holds, with a requirement appended for each change whose rule is the change, its source and check left for the person.
const PROPOSALS = { "## 5. Process models": lines(PROCESS_SECTION, "**ADD A REVIEW PHASE** *()*", "Add a review phase"),
  "## 13. Jobs": lines(JOBS_SECTION, "**A RELEASE TEST FOR EVERY ITEM** *()*", "A release test for every item", "", "**CLOSER-BOT READS THE ISSUES FIRST** *()*", "closer-bot reads the issues first") };
// Every entry of every queue `files` hold, with its anchor, its state and its proposal's text.
const entriesOf = async (files) => {
  const snapshot = snapshotOf(files, ADDRESS);
  return Promise.all((await queues(snapshot)).flatMap((queue) => queue.entries.map(async (entry) => ({ anchor: entry.anchor, state: entry.state, proposal: await snapshot.read(entry.proposal.path) }))));
};

// TST-1406001 · level: unit · module: MOD-work-plans
// guards: AN AGENT'S RETROSPECTIVE CHANGES NO PROCESS BY ITSELF; UC-041
// given: the fixture product, its instance at another address, whose SPEC.md holds THE PROCESS MODEL IS DECLARED PER PRODUCT in "## 5. Process models", A PRODUCT DECLARES ITS DEFINITION OF DONE and AN AGENT'S RETROSPECTIVE CHANGES NO PROCESS BY ITSELF in "## 13. Jobs", and no queue; closer-bot's close of team1/01 whose retrospective recommends "Add a review phase" to the process model, "A release test for every item" to the Definition of Done, "closer-bot reads the issues first" to a participant's instructions, "Pair on reviews" to the team agreement, and notes one thing that went well
// input: the writer sprint-record
// expect: the product gets one commit, of the sprint's record alone, which holds the five lines of the retrospective; the instance gets two commits, of files under docs/spec-freigaben/ alone, each under the job's provenance lines (Agent-M-Participant: closer-bot); its queues hold exactly two entries, both open: one anchored at "## 5. Process models", whose proposal is that section as it holds with the requirement "**ADD A REVIEW PHASE** *()*" / "Add a review phase" appended, and one anchored at "## 13. Jobs", with "**A RELEASE TEST FOR EVERY ITEM** *()*" / "A release test for every item" and "**CLOSER-BOT READS THE ISSUES FIRST** *()*" / "closer-bot reads the issues first" appended; no proposal holds "Pair on reviews"; the instance's SPEC.md and the product's docs/process.md are byte-identical
test("each change an agent's retrospective recommends to the process is a new requirement of an open entry for the section that governs it, and nothing of the process is written", async () => {
  const job = jobOf({ close: PROPOSING, instanceSpec: SPEC });
  const process = job.files["docs/process.md"];
  await job.write();
  assert.deepEqual(job.commits.map((commit) => commit.files.map((each) => each.path)), [["docs/backlog/sprints/team1/01.md"]]);
  for (const entry of PROPOSING.retrospective) assert.ok(job.commits[0].files[0].text.includes(`${entry.goes ? `, to ${entry.goes}` : ""}: ${entry.text}\n`), entry.text);
  assert.equal(job.instanceCommits.length, 2);
  for (const commit of job.instanceCommits) {
    assert.ok(commit.files.every((each) => each.path.startsWith("docs/spec-freigaben/")), JSON.stringify(commit.files.map((each) => each.path)));
    assert.ok(commit.message.includes("\nAgent-M-Participant: closer-bot\n"), commit.message);
  }
  const entries = await entriesOf(job.instanceFiles);
  assert.deepEqual(entries.map((entry) => [entry.anchor, entry.state, entry.proposal]).sort(), Object.entries(PROPOSALS).map(([anchor, proposal]) => [anchor, "open", proposal]).sort());
  assert.equal(job.instanceFiles["SPEC.md"], SPEC);
  assert.equal(job.files["docs/process.md"], process);
});

// TST-1406002 · level: unit · module: MOD-work-plans
// guards: AN AGENT'S RETROSPECTIVE CHANGES NO PROCESS BY ITSELF; UC-041
// given: the same close, of a product that is its own instance — the job's instance stands at the product's address, as a hosted job of Agent M holds it in two checkouts —, whose SPEC.md is the SPEC of TST-1406001
// input: the writer sprint-record
// expect: everything is committed through the product's host: first the sprint's record, then two commits of files under docs/spec-freigaben/ alone; the queues of the product's files with those commits hold the two open entries of TST-1406001, with the same anchors and proposals; nothing is committed through the instance's host
test("a product that is its own instance gets the entries through the product's host, after its record", async () => {
  const job = jobOf({ close: PROPOSING, instanceWeb: ADDRESS, files: { ...productFiles(), "SPEC.md": SPEC } });
  await job.write();
  assert.deepEqual(job.instanceCommits, []);
  assert.equal(job.commits.length, 3);
  assert.deepEqual(job.commits[0].files.map((each) => each.path), ["docs/backlog/sprints/team1/01.md"]);
  const files = { ...job.files };
  for (const commit of job.commits.slice(1)) {
    assert.ok(commit.files.every((each) => each.path.startsWith("docs/spec-freigaben/")), JSON.stringify(commit.files.map((each) => each.path)));
    for (const file of commit.files) files[file.path] = file.text;
  }
  const entries = await entriesOf(files);
  assert.deepEqual(entries.map((entry) => [entry.anchor, entry.state, entry.proposal]).sort(), Object.entries(PROPOSALS).map(([anchor, proposal]) => [anchor, "open", proposal]).sort());
});

