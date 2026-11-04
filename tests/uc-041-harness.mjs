// The harness of the system and release tests of UC-041 (Close a sprint with review and retrospective): a product whose team1 sprint has ended, closed by an agent through the real job of the kind
// `close-sprint` — MOD-job-runner's prepareJob and runJob over MOD-job-catalogue's definition, with MOD-work-plans' recipe `sprint-facts`, check `sprint-record-checks` and writer `sprint-record` — behind a host
// held in memory; the start of that job by MOD-workflow-entries' `onSchedule` in temporary git repositories laid out as a product's job workflow lays them out; and the pages Progress and Backlog of
// MOD-implementation-pages drawn over the files the close leaves, through tests/uc-032-harness.mjs' `open`. Nothing reaches the network. It holds no test and no expected result: what it builds are inputs, and
// every test states its own expected values.
// Imported by tests/system-uc-041-close-a-sprint.test.mjs, tests/release-uc-041-close-a-sprint.test.mjs and, through node, tests/test_time_box_close.py.
//
// Module: MOD-work-plans
// Module: MOD-workflow-entries
// Module: MOD-implementation-pages
// Level: system
//
// Authored by developer-opus-e (ITM-991). The product (`shop()`) is tests/uc-032-harness.mjs' product — a Scrum product of two teams, its items ITM-001 to ITM-010 —, with these changes: team1's sprint 02
// selects ITM-001 and ITM-002 on its own branch sprint/team1/02, its closer is the agent closer-bot, and the Product Owner ended it on 2026-10-30; ITM-001's pull request 1 is merged into sprint/team1/02,
// ITM-002's pull request 2 is open; the pull request 9 of sprint/team1/02 into main is open; team2 runs its sprint 01 with ITM-003; the test file tests/store.test.mjs declares TST-001, which guards RULE ONE;
// the issue 7 was opened during the sprint, the issue 8 before it; the branch test-results holds a record of pull request 1's head; its SPEC holds, after RULE ONE to RULE FOUR, the three requirements
// that govern the process — THE PROCESS MODEL IS DECLARED PER PRODUCT, A PRODUCT DECLARES ITS DEFINITION OF DONE and AN AGENT'S RETROSPECTIVE CHANGES NO PROCESS BY ITSELF —, so that a retrospective's change
// has a section to be proposed in.

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { kindOf } from "../src/job-catalogue/index.mjs";
import { prepareJob, registerStrategies, runJob } from "../src/job-runner/index.mjs";
import { jobWorkflowFiles } from "../src/runtimes/index.mjs";
import { workStrategies } from "../src/work-plans/index.mjs";
import { ADDRESS, HEAD, PARTICIPANTS, documentsOf, itemPath, itemText, lines, open, part, plain, pr, product, specOf, sprintPath, sprintText } from "./uc-032-harness.mjs";

export { ADDRESS, documentsOf, itemPath, itemText, lines, open, part, plain, pr, product, sprintPath, sprintText };
registerStrategies("tests/uc-041-harness.mjs", workStrategies);

const blobOf = (text) => createHash("sha1").update(`blob ${Buffer.byteLength(text)}\0`).update(text).digest("hex");
export const RECORD = sprintPath("team1", 2);
export const SPRINT = "team1/02";
export const BRANCH = "sprint/team1/02";

// ---------------------------------------------------------------- the product

/** The participant the close of team1/02 is assigned to: an agent of the instance's list, a CI agent. */
export const CLOSER = { name: "closer-bot", type: "CI agent", model: "model-x", context: 400000, price: null,
  capabilities: ["draft text", "read the repository", "write to the repository"], place: "GitHub's hosted runners", route: "ci hosted secret CLOSER_KEY" };
const TEST_FILE = lines("// TST-001 · level: unit · module: MOD-store", "// guards: RULE ONE", "// given: a store", "// input: a read", "// expect: its text", 'test("a store reads", () => {});');
const FAILED_JOB = lines("---", "id: JOB-20261024-1000-a002", "kind: implement", "works_on:", "  - ITM-002", "participant: dev-a", "model: example-model", "route: ci hosted", "started_by: alice",
  "start: 2026-10-24 10:00 UTC", "agent_m: unknown, commit unknown", "limit: 1", "---", "## Destinations", "", "## Parameters", "", "```json", "{}", "```", "", "## End", "", "at: 2026-10-24 11:00 UTC",
  "state: failed", "");
export const ENDED = ["", "## Ended", "", "at: 2026-10-30"];
/** team1's sprint 02: `over` laid over its fields (n, goal, start, end, closer, branch, selection, tail). */
export const team1Sprint = (over = {}) => sprintText({ n: 2, goal: "Store and show", start: "2026-10-20", closer: CLOSER.name, branch: BRANCH, selection: ["ITM-001", "ITM-002"], tail: ENDED, ...over });
export const team2Sprint = (over = {}) => sprintText({ n: 1, goal: "Mail", start: "2026-10-22", closer: "bob", selection: ["ITM-003"], ...over });

/** shop({ files }) -> the files of the product, `files` laid over them (a path set to null is left out). */
export const SPEC = specOf("RULE ONE", "RULE TWO", "RULE THREE", "RULE FOUR", "THE PROCESS MODEL IS DECLARED PER PRODUCT", "A PRODUCT DECLARES ITS DEFINITION OF DONE",
  "AN AGENT'S RETROSPECTIVE CHANGES NO PROCESS BY ITSELF");
export const shop = ({ files = {} } = {}) => product({ files: { [RECORD]: team1Sprint(), [sprintPath("team2", 1)]: team2Sprint(), "tests/store.test.mjs": TEST_FILE, "SPEC.md": SPEC,
  "docs/jobs/JOB-20261024-1000-a002.md": FAILED_JOB, ...files } });

export const PULLS = [pr(1, "ITM-001", "merged", "2026-10-20T09:00:00Z", "2026-10-21T10:00:00Z", { base: BRANCH }), pr(2, "ITM-002", "open", "2026-10-21T12:00:00Z", null, { base: BRANCH }),
  { ...pr(9, "sprint team1/02", "open", "2026-10-30T12:00:00Z", null, { branch: BRANCH, base: "main" }), title: "The increment of sprint team1/02" }];
export const issue = (number, title, opened, closed = null) => ({ number, title, body: "", labels: [], state: closed ? "closed" : "open", url: `${ADDRESS}/issues/${number}`, opened, closed, comments: [] });
export const ISSUES = [issue(7, "The export misses its header", "2026-10-25T10:00:00Z"), issue(8, "An older question", "2026-09-01T10:00:00Z")];
const RUN_RECORD = (head) => lines("---", `commit: ${head}`, "levels:", "  - unit", "occasion: commit", "participant: ci", "date: 2026-10-21 11:00 UTC", "---", "## Outcomes", "",
  "| Test | Level | Outcome | Runs |", "|---|---|---|---|", "| TST-001 | unit | passed |  |");

// ---------------------------------------------------------------- the close by its agent

/** A clean close of team1/02, of the form closeSprint takes: the sprint, the review with its sources, ITM-002 into the next sprint, and a retrospective. */
export const CLOSE = () => ({ sprint: SPRINT,
  review: { feedback: [{ line: "No stakeholder took part; the issue 7 asks for a header in the export", goes: "noted", item: null }], tookPart: [],
    sources: ["issue #7", "the job records of sprint team1/02", "the result records of sprint team1/02"] },
  unfinished: [{ item: "ITM-002", to: "next sprint", reason: "its pull request is still open" }],
  retrospective: [{ text: "The fixtures were quick to build", kind: "went well", goes: null }, { text: "Review pull requests the same day", kind: "change", goes: "team agreement" }] });

/**
 * closeWorld({ files, pullRequests, issues, now }) -> the product behind a host held in memory, and the job of kind close-sprint for team1/02:
 *   files         the product's files (default shop()); each commit of the host changes them and moves the head on.
 *   pullRequests  what the host lists (default PULLS); issues what it lists (default ISSUES), or null for a host that gives none (NotSupported).
 * -> { files, commits, context(), run(answers), recipe(), check(draft) }: `run` prepares the job with the drafter CLOSER and runs it unattended, as CI and a Bridge run it, with a driver that answers `answers`
 * in turn — each an object sent as the draft of the answer's envelope, or a function of the input it was sent —, and resolves to { result, failed, inputs, commits }; nobody attends, so the writer writes at
 * once. `failed` is null, or the name and message of what the run threw — a refusal of the writer —, `result` then null.
 */
export async function closeWorld({ files: given, pullRequests = PULLS, issues = ISSUES, now = new Date("2026-10-31T08:00:00Z") } = {}) {
  const files = given ?? await shop();
  const commits = [];
  let head = 1;
  const commit = () => String(head).padStart(40, "a");
  const snapshot = () => ({ repository: { server: "github", path: "akmaier/agent-m", web: ADDRESS }, ref: "main", commit: commit(), paths: Object.keys(files),
    blob: (path) => (Object.hasOwn(files, path) ? blobOf(files[path]) : null), read: async (path) => (Object.hasOwn(files, path) ? files[path] : null) });
  const pullOne = pullRequests.find((each) => each.number === 1);
  const results = { paths: pullOne ? [`runs/${pullOne.head}/20261021-1100-commit-aaaa.md`] : [], blob: () => null,
    read: async (path) => (pullOne && path.startsWith(`runs/${pullOne.head}/`) ? RUN_RECORD(pullOne.head) : null) };
  const named = (name) => Object.assign(new Error(name), { name });
  const host = {
    async repositoryInfo() { return { defaultBranch: "main", visibility: "private", canWrite: true, archived: false, description: "" }; },
    async readSnapshot(ref) { return ref === "test-results" ? results : snapshot(); },
    async readHistory() { return []; },
    async listPullRequests() { return structuredClone(pullRequests); },
    async listIssues() { if (issues === null) throw named("NotSupported"); return structuredClone(issues); },
    async createBranch() {},
    async commitFiles(change) {
      if (change.expectedHead !== commit()) throw Object.assign(named("Moved"), { head: commit() });
      commits.push(structuredClone(change));
      for (const file of change.files) { if (file.delete) delete files[file.path]; else files[file.path] = file.text; }
      head += 1;
      return { commit: commit(), url: `${ADDRESS}/commit/${commit()}` };
    },
  };
  // The instance is the product itself, as in tests/uc-032-harness.mjs: the declared model is read from it at the version its declaration names.
  const context = async (params = { sprint: SPRINT }) => {
    const shown = snapshot();
    return { kind: await kindOf("close-sprint"), params, product: { address: ADDRESS, snapshot: shown, host }, instance: { snapshot: shown, host: { readSnapshot: async () => snapshot() }, checkout: null },
      connect: async () => null, participants: [CLOSER], places: { sources: {}, mailbox: null, contents: [] }, gates: [], person: CLOSER.name, now, agentM: { version: "unreleased", commit: HEAD },
      jobId: "JOB-20261031-0800-c041" };
  };
  return {
    files, commits, context,
    async recipe(params) { return workStrategies.recipes["sprint-facts"](await context(params), params ?? { sprint: SPRINT }); },
    check: (draft) => workStrategies.checks["sprint-record-checks"](draft),
    async run(answers, params) {
      const job = await context(params);
      const prepared = await prepareJob("close-sprint", job, { drafter: CLOSER, reviewers: [] });
      const inputs = [];
      const queue = [...answers];
      const drafter = { participant: CLOSER, inputs, async send(input) {
        inputs.push(input);
        if (queue.length === 0) throw new Error("the closer was asked more often than the test gives answers");
        const next = queue.shift();
        return { text: JSON.stringify({ draft: typeof next === "function" ? next(input) : next, answers: [] }), usage: null };
      } };
      try {
        return { prepared, result: await runJob(prepared, { drafter, reviewers: [] }, { attended: false, context: job }), failed: null, inputs, commits };
      } catch (error) {
        return { prepared, result: null, failed: { name: error.name, message: error.message }, inputs, commits };
      }
    },
  };
}

// ---------------------------------------------------------------- the schedule of the product's job workflow

process.env.GIT_CONFIG_GLOBAL = "/dev/null";
process.env.GIT_CONFIG_SYSTEM = "/dev/null";
process.env.GIT_TERMINAL_PROMPT = "0";
const REGISTER = lines("# Participants of this instance", "", "| Name | Type | Model | Context | Price | Capabilities | Processing place | Route |", "|---|---|---|---|---|---|---|---|",
  `| ${CLOSER.name} | CI agent | ${CLOSER.model} | 400000 | — | ${CLOSER.capabilities.join(", ")} | ${CLOSER.place} | ${CLOSER.route} |`,
  "| alice | person | — | — | — | draft text, read the repository, write to the repository | — | ci hosted secret CLOSER_KEY |");
const git = (cwd, ...args) => {
  const run = spawnSync("git", args, { cwd, encoding: "utf8" });
  if (run.status !== 0) throw new Error(`git ${args.join(" ")} failed in ${cwd}: ${run.stderr}`);
  return run.stdout.trim();
};
const write = (root, files) => { for (const [path, text] of Object.entries(files)) { mkdirSync(join(root, path, ".."), { recursive: true }); writeFileSync(join(root, path), text); } };
function repository(root, name, files, folder) {
  const origin = join(root, `${name}.git`), seed = join(root, `${name}-seed`);
  git(root, "init", "-q", "--bare", "-b", "main", origin);
  git(root, "clone", "-q", origin, seed);
  git(seed, "config", "user.name", "Seed");
  git(seed, "config", "user.email", "seed@example.org");
  write(seed, files);
  git(seed, "add", "-A");
  git(seed, "commit", "-q", "-m", "first");
  git(seed, "push", "-q", "origin", "HEAD:refs/heads/main");
  git(root, "clone", "-q", origin, folder);
  git(folder, "config", "user.name", "Alice Agent M token");
  git(folder, "config", "user.email", "alice@example.org");
}

/**
 * scheduled({ sprints, items, today }) -> Promise<{ status, records }> — the product's schedule runs MOD-workflow-entries' onSchedule once on `today` (default 2026-10-31), the product being a git repository
 * that holds the job workflow's file, a Scrum declaration, the items `items` ({ path: text }, default ITM-001 and ITM-002 as tests/uc-032-harness.mjs writes them) and the sprint records `sprints` ({ path:
 * text }), the instance one whose participants are closer-bot (a CI agent) and alice (a person, whose row names a route of CI all the same, so that only her type keeps her sprint from a job). `records`
 * are the texts of the job records the run committed.
 */
export async function scheduled({ sprints, items = { [itemPath(1)]: itemText(1, { modules: ["MOD-store"] }), [itemPath(2)]: itemText(2, { modules: ["MOD-pages"] }) }, today = "2026-10-31" }) {
  const { runEntry } = await import("../src/workflow-entries/main.mjs");
  const root = mkdtempSync(join(tmpdir(), "agent-m-uc-041-"));
  const workspace = join(root, "ws");
  mkdirSync(workspace, { recursive: true });
  try {
    repository(root, "instance", { "README.md": "# Instance\n", "SPEC.md": "# Spec\n", "docs/participants.md": REGISTER }, join(workspace, "instance"));
    const agentM = git(join(workspace, "instance"), "rev-parse", "HEAD");
    const workflow = Object.fromEntries(jobWorkflowFiles("github", { repository: "alice/agent-m", commit: agentM }, { token: "AGENT_M_TOKEN", keys: ["CLOSER_KEY"] }, []).map((file) => [file.path, file.text]));
    const declaration = lines("---", "model: scrum", "model_file: src/model-catalogue/models/scrum.md", `model_version: ${agentM}`, "---", "# Process", "", "## Practices", "", "- none", "", "## Branches", "",
      "| Phase or time box | Branch |", "|---|---|", "| Sprint | sprint/<team>/<nn> |", "", "## Definition of Done", "", "The job rules hold; no condition is added.");
    const productDir = join(workspace, "product");
    repository(root, "product", { "README.md": "# Shop\n", "docs/process.md": declaration, ...items, ...workflow, ...sprints }, productDir);
    const before = git(productDir, "rev-parse", "HEAD");
    const status = await runEntry("onSchedule", { GITHUB_ACTIONS: "true", GITHUB_EVENT_NAME: "schedule", GITHUB_WORKSPACE: workspace, GITHUB_SERVER_URL: "https://github.com", GITHUB_REPOSITORY: "alice/shop",
      GITHUB_REF_NAME: "main", GITHUB_SHA: before, GITHUB_RUN_ID: "4141", GITHUB_ACTOR: "alice", AGENT_M_RUNNER: "hosted", AGENT_M_PRODUCT_DIR: productDir, AGENT_M_TOKEN_NAME: "AGENT_M_TOKEN",
      AGENT_M_KEY_NAMES: "CLOSER_KEY", AGENT_M_TOKEN: "ghp_ALICEagentMtoken0123456789abcdef", CLOSER_KEY: "sk-CLOSER-0123456789abcdef" }, { now: new Date(`${today}T06:00:00Z`) });
    git(productDir, "pull", "-q", "--ff-only", "origin", "main");
    const paths = git(productDir, "diff", "--name-only", before, "HEAD").split("\n").filter((path) => path.startsWith("docs/jobs/"));
    return { status, records: paths.map((path) => git(productDir, "show", `HEAD:${path}`)) };
  } finally { rmSync(root, { recursive: true, force: true }); }
}

/** The register of tests/uc-032-harness.mjs with the closer's row: the instance's participants as the pages read them. */
export const PARTICIPANTS_WITH_CLOSER = PARTICIPANTS.replace(/\n$/, `\n| ${CLOSER.name} | CI agent | ${CLOSER.model} | 400000 | — | ${CLOSER.capabilities.join(", ")} | ${CLOSER.place} | ${CLOSER.route} |\n`);
