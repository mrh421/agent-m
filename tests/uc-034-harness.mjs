// The harness of the system and release tests of UC-034 (Implement backlog items with a coding agent): two worlds, both over the real modules and behind fakes of GitHub's API, no request leaves the process.
//   - `teams()`: the route `implement` of MOD-implementation-pages drawn for a Scrum product of two teams whose running sprints select items, with the pull requests of the jobs, their checks and the merge — through
//     tests/uc-024-harness.mjs' openImplement, which this file takes as it is — over the product of tests/uc-032-harness.mjs, whose items, modules, sprints and role assignments it extends.
//   - `jobPage()`: the route `job` of MOD-main-page drawn for a job of that product that waits at a gate, with the writes of one commit answered and kept, as a person who holds a role of one team or of the other presses *Pass gate*.
// It holds no test and no expected result: what it builds are inputs, and every test states its own expected values.
// Imported by tests/system-uc-034-implement-backlog-items.test.mjs and tests/release-uc-034-implement-backlog-items.test.mjs.
//
// Module: MOD-implementation-pages
// Module: MOD-main-page
// Module: MOD-product-process
// Module: MOD-workflow-entries
// Level: system
//
// Authored by developer-sonnet-j (ITM-805). The product of `teams()` is tests/uc-032-harness.mjs' Scrum product without a time box and with the work-in-progress limit 2 (the fixture model fixture-scrum-wip: the roles Owner, Builders and
// Checker, the gate Building → Checking decided by the Owner and the gate Checking → Closing decided by the CI check `release-tests`), of the teams team1 (the Owner alice, the builder dev-a) and team2 (the Owner bob, the builder dev-b); team1 runs
// its sprint 02 on the branch sprint/team1/02 with ITM-001 (merged), ITM-002 (an open pull request) and ITM-003 (ready), team2 its sprint 01 on sprint/team2/01 with ITM-011 (ready, MOD-news). The instance holds the model, the participants
// and the book as tests/uc-024-harness.mjs gives them.

import "./site-frame-dom.mjs";
import { backlogProduct, instance, openImplement } from "./uc-024-harness.mjs";
import { MODELS, itemPath, itemText, sprintPath, sprintText, lines } from "./uc-032-harness.mjs";
import { INSTANCE, PRODUCT, browser, draw, headOf, network, timers, withEnd } from "./main-page-home-harness.mjs";
import { writeSetting } from "../src/browser-store/index.mjs";
import { startRecord, appendToRecord } from "../src/job-ledger/index.mjs";
import { view } from "../src/main-page/index.mjs";

export { backlogProduct, instance, openImplement, MODELS, itemPath, itemText, sprintPath, sprintText, lines };
export { found, textOf, startRecords, jobRecord, jobPull, jobCheck, quiet, servers, fieldOf, jobOf, CHECK_JOB, STORE_TEST, testFileOf, PARTICIPANTS, REPO, walk } from "./uc-024-harness.mjs";
export { pr } from "./uc-032-harness.mjs";
export { byClass } from "./main-page-home-harness.mjs";
export { decision, moduleText } from "./uc-045-harness.mjs";

// ---------------------------------------------------------------- the implement page over two teams

/**
 * teams({ files, over }) -> { files, instance } — the files of the product (alice/thesis-tool) and of the instance (akmaier/agent-m) for openImplement: tests/uc-032-harness.mjs' Scrum product with team1's running sprint 02 selecting ITM-001, ITM-002
 * and ITM-003 and team2's running sprint 01 selecting ITM-011 (MOD-news), `files` laid over the product's (a path set to null is left out) and `over` over the instance's.
 */
export async function teams({ files = {}, over = {} } = {}) {
  const product = await backlogProduct({
    [itemPath(11)]: itemText(11, { modules: ["MOD-news"] }),
    [sprintPath("team2", 1)]: sprintText({ n: 1, goal: "News", selection: ["ITM-011"], branch: "sprint/team2/01" }),
    ...files,
  });
  for (const path of Object.keys(product)) if (product[path] === null) delete product[path];
  return { files: product, instance: instance({ "docs/process-models/fixture.md": MODELS.scrum, "docs/participants.md": product["docs/participants.md"], ...over }) };
}

// ---------------------------------------------------------------- the job page of a job that waits at a gate

const ID = "JOB-20261016-1000-9a01";
const BLOB = "b".repeat(40);
export const GATE_JOB = ID, GATE = "Building → Checking";
const assignmentOf = (owner, builder) => lines("# Role assignment", "", "## Roles", "", "| Role | Participants |", "|---|---|", `| Owner | ${owner} |`, `| Builders | ${builder} |`, `| Checker | ${builder} |`);
const PROCESS = (version) => lines("---", "model: fixture-scrum-wip", "model_file: docs/process-models/fixture.md", `model_version: ${version}`, "---", "# Process", "", "## Practices", "", "- none", "", "## Branches", "",
  "| Phase or time box | Branch |", "|---|---|", "| Sprint | sprint/<team>/<nn> |", "", "## Definition of Done", "", "The job rules hold; no condition is added.");
const MODULE = (id) => lines("---", `id: ${id}`, `title: The module ${id}`, `folder: src/${id.slice(4)}/`, "realises:", "  - FIRST RULE", "follows:", "  - ARC-001", "uses: []", "provides:", "  - read", "---", `# ${id} The module ${id}`);
const ITEM = (id, modules) => lines("---", `id: ${id}`, "title: The work", "level: module", "realises:", "  - FIRST RULE", "modules:", ...modules.map((module) => `  - ${module}`), "builds_on: []", "tests:", "  - unit", "origin:", "  - the fixture", "---",
  `# ${id} The work`, "", "## Outcome", "", "The work.", "", "## Acceptance", "", "- a unit test.");

/** The job `JOB-20261016-1000-9a01` (kind implement, participant dev-a, the item ITM-003, the route ci hosted) taken and waiting at the gate `Building → Checking`, decided by the role Owner. */
export function waitingJob({ participant = "dev-a", item = "ITM-003", gate = GATE, decider = "Owner" } = {}) {
  const { path, text } = startRecord({ id: ID, kind: "implement", worksOn: [item], participant, model: "model-x", route: "ci hosted", run: null, retries: null, startedBy: "alice", start: new Date("2026-10-16T10:00:00Z"),
    agentM: { version: "2026.1.0", commit: "abc1234" }, inputs: [`docs/backlog/${item}-work.md@${BLOB}`], limit: 5, task: "in parameters", conversation: null, destinations: [], params: { items: [item], merges: "agent" } });
  const taken = appendToRecord(text, { part: "taken", at: new Date("2026-10-16T10:00:00Z"), by: "https://github.com/alice/product/actions/runs/1" });
  return { path, text: appendToRecord(taken, { part: "gate reached", at: new Date("2026-10-16T10:30:00Z"), gate, decider }) };
}

const CAN = "read the repository, write to the repository, run code and tests, use tools";
/** The participants of the instance of `jobPage`: the people alice and bob and the builders dev-a and dev-b, on CI, at this machine. */
export const PEOPLE = lines("# Participants of this instance", "", "**REGISTER**", "", "The participants of the test instance.", "", "| Name | Type | Model | Context | Price | Capabilities | Processing place | Route |",
  "|---|---|---|---|---|---|---|---|", "| alice | person | — | — | — | read the repository, write to the repository | — | account github.com/alice |", "| bob | person | — | — | — | read the repository, write to the repository | — | account github.com/bob |",
  `| dev-a | model endpoint | model-c | 200000 | — | ${CAN} | this machine | ci hosted secret DEV_KEY |`, `| dev-b | model endpoint | model-d | 200000 | — | ${CAN} | this machine | ci hosted secret DEV_KEY |`);

/** The files of alice/product: the Scrum product of two teams, team1's running sprint holding ITM-003 (whose job waits at the gate), team2's holding ITM-011; the job records given; `files` laid over them. */
export function jobProduct({ jobs = [waitingJob()], files = {} } = {}) {
  const base = {
    "SPEC.md": lines("# Product — Specification", "", "## 1. Section", "", "**FIRST RULE** *(Product Owner)*", "The first rule holds.", "*Check:* no automatic check; at review.", ""),
    "docs/process.md": PROCESS(headOf(INSTANCE)), ".github/workflows/agent-m-jobs.yml": "name: agent-m jobs\n",
    "docs/role-assignments/team1.md": assignmentOf("alice", "dev-a"), "docs/role-assignments/team2.md": assignmentOf("bob", "dev-b"),
    "docs/architecture/MOD-mail.md": MODULE("MOD-mail"), "docs/architecture/MOD-news.md": MODULE("MOD-news"),
    [itemPath(3)]: ITEM("ITM-003", ["MOD-mail"]), [itemPath(11)]: ITEM("ITM-011", ["MOD-news"]),
    [sprintPath("team1", 2)]: sprintText({ n: 2, goal: "Mail", selection: ["ITM-003"], branch: "sprint/team1/02" }),
    [sprintPath("team2", 1)]: sprintText({ n: 1, goal: "News", selection: ["ITM-011"], branch: "sprint/team2/01" }),
    ...Object.fromEntries(jobs.map(({ path, text }) => [path, text])),
    ...files,
  };
  for (const path of Object.keys(base)) if (base[path] === null) delete base[path];
  return base;
}

/**
 * jobPage(person, { files }) -> { net, seen, draw(), restore() } — the route `job` of MOD-main-page for the job GATE_JOB of alice/product, the person being the name the product's stored token carries. `seen` keeps the writes of one commit the fake answers:
 * { trees, commits, moves }. `net` is tests/main-page-home-harness.mjs' fake of GitHub; `draw()` draws the page and returns its element.
 */
const GLOBALS = ["window", "document", "location", "localStorage", "sessionStorage"];
export function jobPage(person, { files = jobProduct(), participants = null, model = MODELS.scrum } = {}) {
  // The browser fixture of the main page replaces the document and the window the implementation pages draw into; they are put back when the page is left.
  const saved = GLOBALS.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]);
  const net = network({ [PRODUCT]: files, [INSTANCE]: { "SPEC.md": "# Instance — Specification\n", "docs/participants.md": participants ?? PEOPLE, "docs/process-models/fixture.md": model } });
  net.install();
  const seen = { trees: [], commits: [], moves: 0 };
  const inner = globalThis.fetch;
  const json = (body) => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(typeof input === "object" && !(input instanceof URL) ? input.url : String(input));
    const method = String(init.method ?? "GET").toUpperCase();
    if (url.host === "api.github.com" && url.pathname === `/repos/${INSTANCE}/commits/${headOf(INSTANCE)}`) return inner(new URL(`https://api.github.com/repos/${INSTANCE}/commits/main`), init);
    if (url.host === "api.github.com" && url.pathname.startsWith(`/repos/${PRODUCT}/git/`) && !url.pathname.includes("/git/trees/")) {
      if (method === "GET" && url.pathname.endsWith("/git/ref/heads/main")) return json({ object: { sha: headOf(PRODUCT) } });
      if (method === "GET" && url.pathname.includes("/git/commits/")) return json({ tree: { sha: "tree-1" } });
      if (method === "POST" && url.pathname.endsWith("/git/commits")) { seen.commits.push(JSON.parse(init.body)); return json({ sha: "commit-2" }); }
      if (method === "PATCH") { seen.moves += 1; return json({}); }
    }
    if (url.host === "api.github.com" && method === "POST" && url.pathname === `/repos/${PRODUCT}/git/trees`) { seen.trees.push(JSON.parse(init.body)); return json({ sha: "tree-2" }); }
    return inner(input, init);
  };
  const context = browser();
  writeSetting(context.store, `github-token:${PRODUCT}`, { value: "github_pat_HOME827PRODUCT0123456789abcdefg", name: person, expires: "2027-01-01" });
  const route = view.routes.find((candidate) => candidate.name === "job");
  return { net, seen, context, draw: () => draw(route, context, { id: ID }), restore: () => {
    net.restore();
    timers.restore();
    for (const [name, descriptor] of saved) { if (descriptor) Object.defineProperty(globalThis, name, descriptor); else delete globalThis[name]; }
  } };
}

/** The job `job` (waitingJob() where none is given) with its end appended, in `state` ("done", "failed" or "cancelled"), as the runtime writes it. */
export const ended = (state, job = waitingJob()) => ({ path: job.path, text: withEnd(job.text, state) });
/** A gate record `docs/gates/<name>.md` of the gate GATE for the job GATE_JOB: decided by `decider` in the role `role`, `decision` ("passed" or "rejected") with its `reason`. */
export const gateRecord = ({ decider = "alice", role = "Owner", decision = "passed", reason = null, name = "20261016-1100-building-checking-a1b2", gate = GATE } = {}) => ({ path: `docs/gates/${name}.md`,
  text: lines("---", `gate: ${gate}`, `job: ${ID}`, `decider: ${decider}`, `role: ${role}`, `decision: ${decision}`, "on:", `  - docs/backlog/ITM-003-work.md@${BLOB}`, "date: 2026-10-16 11:00 UTC", "---", `# ${gate}`, "",
    ...(reason ? ["## Reason", "", reason] : [])) });
