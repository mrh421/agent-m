// The harness of the system and release tests of UC-010 (Run a job in GitHub Actions): the product and the instance are git repositories on disk — a bare origin for each, the clone the dashboard
// works in, and the checkouts a job workflow makes — laid out as MOD-runtimes' job workflow lays them out (the workspace holds `product/` and `instance/`). The dashboard's side is the real MOD-runtimes
// (`queueJob`, `jobWorkflowFiles`) and the real MOD-settings-pages over a host that is MOD-repository-hosts' host of a local clone; the job's side is the real entries of MOD-workflow-entries,
// run in-process by `runEntry` as `node src/workflow-entries/main.mjs <entry>` runs them, over the real MOD-job-runner, MOD-job-catalogue and MOD-endpoint-calls. The model endpoint is a fake `fetch`
// that answers as an OpenAI-compatible endpoint does and records every request. Nothing reaches the network. It holds no test and no expected result: what it builds are inputs, and every test states
// its own expected values.
// Imported by tests/system-uc-010-run-a-job-in-github-actions.test.mjs and tests/release-uc-010-run-a-job-in-github-actions.test.mjs.
//
// Module: MOD-workflow-entries
// Module: MOD-runtimes
// Module: MOD-job-ledger
// Module: MOD-settings-pages
// Module: MOD-repository-hosts
// Module: MOD-endpoint-calls
// Module: MOD-review-pages
// Module: MOD-job-runner
// Module: MOD-job-catalogue
// Module: MOD-approvals
// Level: system
//
// Authored by developer-sonnet-k (ITM-373), who built none of ITM-311, ITM-312, ITM-316, ITM-317, ITM-322, ITM-351, ITM-363, ITM-365, ITM-366 or ITM-390 and no UC-010 production behaviour; its one change
// in these modules, ITM-1259, is UC-012's closing of issues by a merged merge request on GitLab.
//
// The product is alice/thesis-tool with the SPEC rule A LOAN HAS A DUE DATE and the use cases UC-001 and UC-002. The instance holds Agent M's AGENTS.md, the book, and the participant ci-bot, a CI agent
// whose key is the Actions secret FIXTURE_KEY; the person's Agent M token is the secret AGENT_M_TOKEN. The page's side (the Settings page, the drafting page of the use cases) is drawn into the fixture DOM
// of tests/review-pages-harness.mjs, over a product and an instance that are the clones of the two origins.

import "./review-pages-harness.mjs";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { approvalSchema } from "../src/approvals/index.mjs";
import { writeDocument } from "../src/documents/index.mjs";
import { cpSync, mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { connect, parseAddress } from "../src/repository-hosts/index.mjs";
import { appendToRecord, newJobId, startRecord } from "../src/job-ledger/index.mjs";
import { jobWorkflowFiles, queueJob } from "../src/runtimes/index.mjs";
import { withStoredGraph } from "./stored-graph-fake.mjs";

process.env.GIT_CONFIG_GLOBAL = "/dev/null";
process.env.GIT_CONFIG_SYSTEM = "/dev/null";
process.env.GIT_TERMINAL_PROMPT = "0";

const entries = await import("../src/workflow-entries/main.mjs").catch((error) => ({ error }));
export const { runEntry } = entries;
export const entriesError = entries.error ?? null;

export const text = (...lines) => `${lines.join("\n")}\n`;
export { appendToRecord, startRecord };

// ---------------------------------------------------------------- the fixtures

export const NOW = new Date("2026-10-30T09:00:00Z");
export const PRODUCT_URL = "https://github.com/alice/thesis-tool";
export const INSTANCE_REPO = "akmaier/agent-m";
/** The person's Agent M token, the CI secret AGENT_M_TOKEN. */
export const TOKEN = "ghp_ALICEagentMtoken0123456789abcdef";
/** The key of the CI agent ci-bot, the CI secret FIXTURE_KEY. */
export const KEY = "sk-FIXTURE-KEY-0123456789abcdef";
export const ENDPOINT = { name: "fixture", kind: "openai-compatible", baseUrl: "https://llm.example.test/v1", model: "fixture-llm" };
const ENDPOINT_ORIGIN = new URL(ENDPOINT.baseUrl).origin;
export const RULE = "A LOAN HAS A DUE DATE";
export const UC1 = "docs/use-cases/UC-001-check-out-a-book.md";
export const UC2 = "docs/use-cases/UC-002-extend-a-loan.md";
export const INSTRUCTION = "Add the alternative flow 2a: the book is reserved by another member, the loan is refused.";
export const WORKFLOW = ".github/workflows/agent-m-jobs.yml";

export const PARTICIPANTS = text("# Participants of this instance", "",
  "| Name | Type | Model | Context | Price | Capabilities | Processing place | Route |", "|---|---|---|---|---|---|---|---|",
  "| ci-bot | CI agent | fixture-llm | 200000 | — | draft text, read the repository | GitHub's hosted runners | ci hosted secret FIXTURE_KEY |");

const useCase = (id, title, goal) => text("---", `id: ${id}`, `title: ${title}`, "area: lending", "actors:", "  - Member", "realises:", `  - ${RULE}`, "---", `# ${id} ${title}`, "",
  `**Goal.** ${goal}`, "", "## Actors", "", "- **Member**", "", "## Precondition", "", "- The member is signed in.", "", "## Main flow", "", "1. The member picks a book.",
  "2. The member confirms the loan.", "", "```mermaid", "flowchart LR", "    Member --> Loan", "```", "", "## Alternative flows", "", "- **1a. The book is out.** The member is told when it is back.", "", "## Postcondition", "",
  "- The loan states its due date.");
export const UC1_TEXT = useCase("UC-001", "Check out a book", "The member borrows a book.");
export const UC2_TEXT = useCase("UC-002", "Extend a loan", "The member extends a loan once.");
/** UC-001 changed as INSTRUCTION asks: the alternative flow 2a added. */
export const UC1_CHANGED = UC1_TEXT.replace("## Postcondition", "- **2a. The book is reserved.** The loan is refused and the member is told so.\n\n## Postcondition");
/** A use case the drafting page's job writes new: UC-003. */
export const UC3 = "docs/use-cases/UC-003-return-a-book.md";
export const UC3_TEXT = text("---", "id: UC-003", "title: Return a book", "area: lending", "actors:", "  - Member", "realises:", `  - ${RULE}`, "---", "# UC-003 Return a book", "", "**Goal.** The member returns a book.", "", "## Actors", "",
  "- **Member**", "", "## Precondition", "", "- The member holds a loan.", "", "## Main flow", "", "1. The member hands the book in.", "", "```mermaid", "flowchart LR", "    Member --> Book", "```", "", "## Alternative flows", "", "- **1a. The book is late.** The member is told.", "",
  "## Postcondition", "", "- The loan is closed.");
const SPEC = text("# Thesis tool — Specification", "", "## Lending", "", `**${RULE}** *(Product Owner)*`, "Every loan states the date by which the book is returned.", "*Check:* `tests/loan.test.mjs`");
export const PRODUCT_FILES = { "README.md": "# Thesis tool\n", "SPEC.md": SPEC, [UC1]: UC1_TEXT, [UC2]: UC2_TEXT };

const blobOf = (body) => createHash("sha1").update(`blob ${Buffer.byteLength(body)}\0${body}`).digest("hex");
/** The approval record that names UC-001's text as it stands in the product: a person accepted it. The product of `world({ product: ACCEPTED })` holds it. */
export const ACCEPTED = { [`docs/approvals/UC-001-${blobOf(UC1_TEXT).slice(0, 12)}.md`]: writeDocument(approvalSchema, { fields: { kind: "use-case", file: UC1, blob: blobOf(UC1_TEXT) } }) };

/** The approval record by which a person accepts the text `body` of the use case at `path`. -> { path, text }. */
export const approvalOf = (path, body) => ({ path: `docs/approvals/${/UC-\d+/.exec(path)[0]}-${blobOf(body).slice(0, 12)}.md`, text: writeDocument(approvalSchema, { fields: { kind: "use-case", file: path, blob: blobOf(body) } }) });

const ROOT = new URL("../", import.meta.url);
const onDisk = (path) => readFileSync(new URL(path, ROOT), "utf8");
const BOOK = "docs/sources/SRC-vibe-coding/2026-10-05/";
const BOOK_FILES = Object.fromEntries([["docs/sources/SRC-vibe-coding.md", onDisk("docs/sources/SRC-vibe-coding.md")],
  ...readdirSync(new URL(BOOK, ROOT)).map((name) => [BOOK + name, onDisk(BOOK + name)])]);
export const INSTANCE_FILES = { "AGENTS.md": onDisk("AGENTS.md"), "README.md": "# Agent M\n", "docs/participants.md": PARTICIPANTS, ...BOOK_FILES };

// ---------------------------------------------------------------- git

export function git(cwd, ...args) {
  const r = spawnSync("git", args, { cwd, encoding: "utf8" });
  if (r.status !== 0) throw new Error(`git ${args.join(" ")} failed in ${cwd}: ${r.stderr}`);
  return r.stdout.trim();
}
export function write(root, files) {
  for (const [path, body] of Object.entries(files)) {
    mkdirSync(join(root, path, ".."), { recursive: true });
    writeFileSync(join(root, path), body);
  }
}
// Git starts `git maintenance run --auto --detach` after a push it receives, a commit and a fetch; that process goes on writing into the repository a moment after the command has returned, so a
// repository removed straight after can still be written to (ENOTEMPTY). The repositories of these tests need no maintenance: it is off in each.
const NO_MAINTENANCE = ["-c", "gc.auto=0", "-c", "maintenance.auto=false", "-c", "receive.autogc=false"];
const quiet = (dir) => { for (const [key, value] of [["gc.auto", "0"], ["maintenance.auto", "false"], ["receive.autogc", "false"]]) git(dir, "config", key, value); };
/** A bare origin whose `main` holds `files`, and the seed clone it was made through. -> the origin's folder. */
function origin(root, name, files) {
  const bare = join(root, `${name}.git`), seed = join(root, `${name}-seed`);
  git(root, "init", "-q", "--bare", "-b", "main", bare);
  quiet(bare);
  git(root, "clone", "-q", ...NO_MAINTENANCE, bare, seed);
  quiet(seed);
  git(seed, "config", "user.name", "Seed");
  git(seed, "config", "user.email", "seed@example.org");
  write(seed, files);
  git(seed, "add", "-A");
  git(seed, "commit", "-q", "-m", "first");
  git(seed, "push", "-q", "origin", "HEAD:refs/heads/main");
  return bare;
}
/** A clone of an origin into `folder`, committing as the person whose token pushes. */
export function clone(root, bare, folder) {
  mkdirSync(join(folder, ".."), { recursive: true });
  git(root, "clone", "-q", ...NO_MAINTENANCE, bare, folder);
  quiet(folder);
  git(folder, "config", "user.name", "Alice Agent M token");
  git(folder, "config", "user.email", "alice@example.org");
  return folder;
}

// The default instance's bare origin, made on first use in a folder of its own that is removed when the program ends.
let template = null;
function defaultInstance() {
  if (template === null) {
    const folder = mkdtempSync(join(tmpdir(), "agent-m-uc010-instance-"));
    template = origin(folder, "instance", INSTANCE_FILES);
    process.on("exit", () => rmSync(folder, { recursive: true, force: true }));
  }
  return template;
}

/**
 * world({ product, instance }, run) — the product and the instance as origins, the dashboard's clone of the product, and `checkout()`, which makes the workspace of one job workflow run (a clone of
 * the product's origin as it stands now and of the instance's), as GitHub's checkout does. `product` and `instance` are files added to or replacing the defaults.
 * -> what `run` returns; the folders are removed after it.
 */
export async function world({ product = {}, instance = {} } = {}, run) {
  const root = mkdtempSync(join(tmpdir(), "agent-m-uc010-"));
  try {
    // The instance holds the book and AGENTS.md, which a git repository takes a second to make: the default instance is made once and copied.
    let instanceOrigin;
    if (Object.keys(instance).length === 0) {
      instanceOrigin = join(root, "instance.git");
      cpSync(defaultInstance(), instanceOrigin, { recursive: true });
    } else instanceOrigin = origin(root, "instance", { ...INSTANCE_FILES, ...instance });
    const productOrigin = origin(root, "product", { ...PRODUCT_FILES, ...product });
    const dashboardClone = clone(root, productOrigin, join(root, "dashboard"));
    const instanceClone = clone(root, instanceOrigin, join(root, "dashboard-instance"));
    const instanceHead = git(instanceOrigin, "rev-parse", "main");
    let runs = 0;
    const w = {
      root, instanceOrigin, productOrigin, dashboardClone, instanceHead,
      /**
       * The product's host as the dashboard's page holds it: MOD-repository-hosts' host of a clone that pushes to the origin, with the repository's facts a server would report. The page reads the
       * branch again before it acts, so the clone is first brought to the origin's head, as a page reads the server's.
       */
      dashboardHost() {
        git(dashboardClone, "pull", "-q", "--ff-only", "origin", "main");
        return { ...connect(parseAddress(PRODUCT_URL), { clone: dashboardClone, token: TOKEN }), async repositoryInfo() { return { defaultBranch: "main", canWrite: true, visibility: "private", archived: false, description: "" }; } };
      },
      /** The instance's host as the dashboard's page holds it: a clone of the instance's origin, read-only (the page never writes the instance in these tests). */
      instanceHost() {
        return { ...connect(parseAddress(`https://github.com/${INSTANCE_REPO}`), { clone: instanceClone }), async repositoryInfo() { return { defaultBranch: "main", canWrite: false, visibility: "public", archived: false, description: "" }; } };
      },
      /** The workspace of one run of the job workflow: product/ and instance/, cloned now. */
      checkout() {
        runs += 1;
        const workspace = join(root, `ws${runs}`);
        clone(root, productOrigin, join(workspace, "product"));
        clone(root, instanceOrigin, join(workspace, "instance"));
        return { workspace, productDir: join(workspace, "product"), id: String(4700 + runs) };
      },
      /** The product's default branch as the origin holds it now, as a snapshot. */
      snapshot() { return this.dashboardHost().readSnapshot("main"); },
      head: () => git(productOrigin, "rev-parse", "main"),
      subjects: () => git(productOrigin, "log", "--format=%s", "main").split("\n"),
      fileAt: (path) => { const r = spawnSync("git", ["show", `main:${path}`], { cwd: productOrigin, encoding: "utf8" }); return r.status === 0 ? r.stdout : null; },
      commitWithSubject: (subject) => git(productOrigin, "log", "-1", "--format=%H", "--fixed-strings", `--grep=${subject}`, "main"),
      paths: () => git(productOrigin, "ls-tree", "-r", "--name-only", "main").split("\n"),
      branches: () => git(productOrigin, "branch", "--list").replace(/[* ]/g, "").split("\n").filter(Boolean),
      everyCommit: () => git(productOrigin, "log", "-p", "--all"),
    };
    return await run(w);
  } finally { rmSync(root, { recursive: true, force: true }); }
}

// ---------------------------------------------------------------- the dashboard's start

/**
 * startOf(w, participant, id, params) — the JobStart a run panel of the review pages makes for a job on the route of the CI participant `participant` (src/review-pages/jobs.mjs): the kind
 * change-use-case, the use case UC-001 as what it works on, the participant and its model, the route `ci hosted`, the person who clicked, the commit of the instance it runs, and the kind's parameters.
 */
export const startOf = (w, { id, params = { useCase: "UC-001", instruction: INSTRUCTION }, route = "ci hosted" }) => ({ id, kind: "change-use-case", worksOn: ["UC-001"], participant: "ci-bot",
  model: "fixture-llm", route, run: null, retries: null, startedBy: "alice", start: NOW, agentM: { version: w.instanceHead, commit: w.instanceHead }, inputs: [], limit: 5,
  destinations: [{ participant: "ci-bot", place: "GitHub's hosted runners", parts: ["use-case-with-neighbours"] }], params });

/** The dashboard's click: the start record committed by MOD-runtimes' queueJob on the CI route, on the head the page read. -> { id, path, commit }. */
export async function queueFromDashboard(w, options = {}) {
  const host = w.dashboardHost();
  const head = (await host.readSnapshot("main")).commit;
  const taken = new Set(w.paths().map((path) => /^docs\/jobs\/(JOB-.*)\.md$/.exec(path)?.[1]).filter(Boolean));
  const id = options.id ?? newJobId(NOW, taken);
  const { path, commit } = await queueJob(host, startOf(w, { ...options, id }), { kind: "ci", runner: "hosted" }, head);
  return { id, path, commit };
}

/** The files MOD-runtimes' jobWorkflowFiles gives for GitHub, the instance at `w.instanceHead`, the token AGENT_M_TOKEN and the key FIXTURE_KEY. */
export const workflowFiles = (w, { runners = [], keys = ["FIXTURE_KEY"] } = {}) => jobWorkflowFiles("github", { repository: INSTANCE_REPO, commit: w.instanceHead }, { token: "AGENT_M_TOKEN", keys }, runners);

// ---------------------------------------------------------------- the model endpoint

/**
 * endpoint({ files, draft }) — the fake model endpoint behind the global `fetch`: it answers the draft `draft`, by default the draft of `files` ({ path, text, class, of }), as an OpenAI-compatible
 * endpoint does, and records every request. -> the list of requests, each { address, method, headers, body }; `elsewhere` holds the requests to the server's API, `outside` any other.
 */
export function endpoint({ files = [{ path: UC1, text: UC1_CHANGED, class: "change", of: "UC-001" }], draft = { files } } = {}) {
  const requests = [];
  requests.elsewhere = [];
  requests.outside = [];
  globalThis.fetch = async (address, init = {}) => {
    // The server's API, which the writer asks for the repository's history: a repository whose history lists no commit that removed a file. Every other request goes to the model endpoint.
    if (new URL(String(address)).origin === "https://api.github.com") {
      requests.elsewhere.push({ address: String(address), method: init.method ?? "GET" });
      return new Response("[]", { status: 200, headers: { "content-type": "application/json" } });
    }
    if (new URL(String(address)).origin !== ENDPOINT_ORIGIN) {
      requests.outside.push(String(address));
      return Promise.reject(new TypeError(`the test's network refuses ${address}`));
    }
    requests.push({ address: String(address), method: init.method, headers: init.headers ?? {}, body: init.body ?? "" });
    const content = JSON.stringify({ draft, answers: [] });
    return new Response(JSON.stringify({ choices: [{ message: { content } }], usage: { prompt_tokens: 120, completion_tokens: 30 } }), { status: 200 });
  };
  return requests;
}

// ---------------------------------------------------------------- a kind whose writer needs no history

// The kind decide-gate, whose recipe and writer no module offers (as tests/workflow-entries-job-workflow.test.mjs has it): the recipe gives a fixture, the writer commits the gate's record through the
// product's host on the head it reads — or commits nothing where it stands already. A job of this kind shows the entries' two machines without the history, which the writer of the use cases reads.
export const GATE_PATH = "docs/gates/GATE-fixture.md";
export const gateText = (decision, reason) => text("# Gate fixture", "", `decision: ${decision}`, `reason: ${reason}`);
export const GATE_REASON = "every artifact meets the condition";
/** The draft the fixture endpoint answers for decide-gate. */
export const GATE_DRAFT = { decision: "passed", reason: GATE_REASON };
let gateKindRegistered = false;
export async function registerGateKind() {
  if (gateKindRegistered) return;
  gateKindRegistered = true;
  const { registerStrategies } = await import("../src/job-runner/index.mjs");
  registerStrategies("tests/uc-010-harness.mjs#decide-gate", {
    recipes: { "gate-inputs": async () => [{ name: "gate-inputs", text: "gate fixture checks docs/a.md", size: 0, sources: [], required: true }] },
    writers: { "gate-record": async (result, context) => {
      const host = context.product.host, head = await host.readSnapshot("HEAD"), body = gateText(result.draft.decision, result.draft.reason);
      if ((await head.read(GATE_PATH)) === body) return { commits: [], files: [], pullRequest: null, shown: null, notes: [] };
      const { commit } = await host.commitFiles({ branch: "main", expectedHead: head.commit, files: [{ path: GATE_PATH, text: body }], message: "gate fixture decided" });
      return { commits: [commit], files: [GATE_PATH], pullRequest: null, shown: null, notes: [] };
    } },
  });
}
/** The dashboard's click for a job decide-gate of the CI agent ci-bot: queueJob on the route ci hosted. -> { id, path, commit }. */
export async function queueGate(w) {
  await registerGateKind();
  const host = w.dashboardHost();
  const head = (await host.readSnapshot("main")).commit;
  const id = newJobId(NOW, new Set(w.paths().map((path) => /^docs\/jobs\/(JOB-.*)\.md$/.exec(path)?.[1]).filter(Boolean)));
  const start = { id, kind: "decide-gate", worksOn: [RULE], participant: "ci-bot", model: "fixture-llm", route: "ci hosted", run: null, retries: null, startedBy: "alice", start: NOW,
    agentM: { version: w.instanceHead, commit: w.instanceHead }, inputs: [], limit: 2, destinations: [{ participant: "ci-bot", place: "GitHub's hosted runners", parts: ["gate-inputs"] }], params: { endpoint: ENDPOINT } };
  const { path, commit } = await queueJob(host, start, { kind: "ci", runner: "hosted" }, head);
  return { id, path, commit };
}

// ---------------------------------------------------------------- the entries

/** What the job workflow's job gives an entry (src/runtimes/workflow/github.yml), with the secrets it filled; `extra` replaces or, as undefined, removes a variable. */
export const environment = (w, run, extra = {}) => ({ GITHUB_ACTIONS: "true", GITHUB_EVENT_NAME: "push", GITHUB_WORKSPACE: run.workspace, GITHUB_SERVER_URL: "https://github.com",
  GITHUB_REPOSITORY: "alice/thesis-tool", GITHUB_REF_NAME: "main", GITHUB_SHA: w.head(), GITHUB_RUN_ID: run.id, GITHUB_ACTOR: "alice",
  AGENT_M_RUNNER: "hosted", AGENT_M_PRODUCT_DIR: run.productDir, AGENT_M_TOKEN_NAME: "AGENT_M_TOKEN", AGENT_M_KEY_NAMES: "FIXTURE_KEY", AGENT_M_TOKEN: TOKEN, FIXTURE_KEY: KEY, ...extra });

/** The run's address a job's record names. */
export const runAddress = (id) => `https://github.com/alice/thesis-tool/actions/runs/${id}`;

/** entry(name, env) — MOD-workflow-entries' runEntry, with the moment fixed. */
export function entry(name, env) {
  if (!runEntry) throw new Error(`runEntry: ${entriesError?.message}`);
  return runEntry(name, env, { now: NOW });
}

/** A push to the default branch that changed docs/jobs/: onRecordsChanged in a checkout made now, with `extra` in the environment. -> { status, run }. */
export async function pushRun(w, extra = {}) {
  const run = w.checkout();
  return { status: await entry("onRecordsChanged", environment(w, run, extra)), run };
}

/** A start from the server's own page: onDispatch in a checkout made now, the event's payload a file holding `inputs`. -> { status, run }. */
export async function dispatchRun(w, inputs, extra = {}) {
  const run = w.checkout();
  const payload = join(w.root, `event-${run.id}.json`);
  writeFileSync(payload, JSON.stringify({ inputs }));
  return { status: await entry("onDispatch", environment(w, run, { GITHUB_EVENT_NAME: "workflow_dispatch", GITHUB_EVENT_PATH: payload, ...extra })), run };
}

/**
 * workflowRun(w) — a push to the default branch run as the job workflow's jobs run it (src/runtimes/workflow/github.yml): the plan chooses the key of the run's job on a machine that holds no secret
 * (chooseAgentKey), the agent's machine runs the job and leaves its result (onRecordsChanged, leaveResult), the writing machine, a checkout of its own, writes it (writeResult).
 * -> { plan, chosen: the output `agent`, agent, left, written, run: the agent's checkout }.
 */
export async function workflowRun(w) {
  const output = join(w.root, `output-${Date.now()}.txt`);
  writeFileSync(output, "");
  const plan = await entry("chooseAgentKey", environment(w, w.checkout(), { AGENT_M_TOKEN: undefined, FIXTURE_KEY: undefined, GITHUB_OUTPUT: output }));
  const chosen = /^agent=(\d+)$/m.exec(readFileSync(output, "utf8"))?.[1] ?? null;
  const run = w.checkout();
  const agent = await entry("onRecordsChanged", agentEnvironment(w, run, { AGENT_M_KEY: chosen }));
  const left = await entry("leaveResult", agentEnvironment(w, run, { AGENT_M_KEY: chosen }));
  const written = await entry("writeResult", writingEnvironment(w));
  return { plan, chosen, agent, left, written, run };
}

/** The same entry run as a child process, `node src/workflow-entries/main.mjs <entry>` as the job workflow runs it, with exactly this environment. -> { status, stdout, stderr }. */
export function commandLine(name, env) {
  const clean = Object.fromEntries(Object.entries(env).filter(([, value]) => value !== undefined));
  const r = spawnSync(process.execPath, [new URL("../src/workflow-entries/main.mjs", import.meta.url).pathname, name], {
    env: { PATH: process.env.PATH, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_SYSTEM: "/dev/null", GIT_TERMINAL_PROMPT: "0", ...clean }, encoding: "utf8" });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}

// The two machines of a run of the job workflow (MOD-runtimes, Data): the agent's machine holds no token and the one key at its place among the key names, and leaves its result in a folder; the
// writing machine, a checkout of its own, holds the token and every key, and writes the result it finds there.
/** The environment of the agent's machine of a run whose checkout is `run`. */
export const agentEnvironment = (w, run, extra = {}) => environment(w, run, { AGENT_M_PART: "agent", AGENT_M_TOKEN: undefined, AGENT_M_RESULT_DIR: join(w.root, "result"), AGENT_M_KEY: "1", ...extra });
/** The environment of the writing machine, in a checkout made now. */
export function writingEnvironment(w, extra = {}) {
  const run = w.checkout();
  return environment(w, run, { AGENT_M_PART: "write", AGENT_M_RESULT_DIR: join(w.root, "result"), ...extra });
}

// ---------------------------------------------------------------- the dashboard's pages

const { openStore, writeSetting } = await import("../src/browser-store/index.mjs");
/** The person's token for the product, as the Settings page stores it. */
export const PRODUCT_TOKEN = { value: "github_pat_ALICEthesisTOOL0123456789abcdef", name: "Agent M · thesis-tool", expires: "2027-01-01" };

/** The elements under `root` for which `match` holds, in document order. */
export function find(root, match) {
  const found = [];
  (function walk(node) { for (const kid of node.childNodes ?? []) { if (kid.nodeType === 1) { if (match(kid)) found.push(kid); walk(kid); } } })(root);
  return found;
}
/** The elements under `root` that carry the class `className`. */
export const withClass = (root, className) => find(root, (node) => String(node.className).split(" ").includes(className));
export const click = (node) => node.dispatchEvent(new Event("click"));
export async function until(condition, what) {
  const limit = Date.now() + 5000;
  while (Date.now() < limit) {
    if (condition()) return;
    await new Promise((resolve) => setImmediate(resolve));
  }
  throw new Error(`waited for ${what}`);
}

/** The context a page of the dashboard is drawn with: the instance's repository and host, the browser's store holding the person's token for the product, and the product chosen. */
export function pageContext(w) {
  // The tab shows the instance's Pages address, from which MOD-runtimes' queueJob opens the browser's store of the instance.
  globalThis.location = { hostname: "akmaier.github.io", pathname: "/agent-m/", origin: "https://akmaier.github.io", href: "https://akmaier.github.io/agent-m/" };
  const store = openStore(INSTANCE_REPO);
  writeSetting(store, "github-token:alice/thesis-tool", PRODUCT_TOKEN);
  // The endpoint of the CI agent ci-bot, as the Endpoints page stores it under `endpoint:<name>`; queueJob puts its address and model into the start of a job on the CI route. No key: the key is the secret FIXTURE_KEY.
  writeSetting(store, "endpoint:ci-bot", { kind: ENDPOINT.kind, url: ENDPOINT.baseUrl, model: ENDPOINT.model });
  const real = w.dashboardHost();
  // A page reads the trace graph that the push job stores for the commit (MOD-trace-graph), which the fixture serves for every snapshot.
  const host = { ...real, readSnapshot: async (ref) => withStoredGraph(await real.readSnapshot(ref)) };
  return { page: "review", instance: { repository: INSTANCE_REPO, host: w.instanceHost() }, store, go() {}, product: { address: PRODUCT_URL, kind: "github", host } };
}

/** The Settings page of the chosen product on its Repositories tab, drawn. -> the element. */
export async function openSettings(w) {
  const { view } = await import("../src/settings-pages/index.mjs");
  const target = document.createElement("div");
  document.body.append(target);
  await view.routes.find((route) => route.name === "settings").render(target, pageContext(w), {});
  click(withClass(target, "settings-tab")[1]);
  await until(() => withClass(target, "settings-job-workflow").length > 0, "the job workflow line");
  return target;
}
/** The line of Agent M's job workflow on the Settings page. */
export const workflowLine = (target) => withClass(target, "settings-job-workflow")[0];

/** Install pressed on the line, and the line drawn again once the commit is made. -> the line. */
export async function install(target, w) {
  const before = w.subjects().length;
  click(withClass(workflowLine(target), "settings-job-workflow-install")[0]);
  await until(() => w.subjects().length > before, "the commit of Install");
  await until(() => /Committed/.test(workflowLine(target).textContent), "the line says it committed");
  return workflowLine(target);
}

/**
 * installFast(w) — the job workflow's files committed as Install commits them (the same files, the same message, one commit on the head the page would read), without drawing the Settings page, for the
 * tests whose subject is not that page. TST-373202 and the main flow of TST-373203 press Install.
 */
export async function installFast(w) {
  const host = w.dashboardHost();
  await host.commitFiles({ branch: "main", expectedHead: (await host.readSnapshot("main")).commit, files: workflowFiles(w).map(({ path, text }) => ({ path, text })), message: "Install Agent M job workflow" });
}

/**
 * runInTab(w, params) — the job change-use-case run in this tab, as the page runs it: the participant ep1, a model endpoint that the browser calls, with the same endpoint and key and the same
 * parameters as the job of the CI route. The result is MOD-job-runner's JobResult, whose draft is the files the kind drafted; nothing is written (a person saves a draft). Registers the strategies of the
 * review pages with the job runner, as the frame does for a page's view.
 */
export async function runInTab(w, params = { useCase: "UC-001", instruction: INSTRUCTION }) {
  const pages = await import("../src/review-pages/index.mjs");
  const { kindOf } = await import("../src/job-catalogue/index.mjs");
  const { prepareJob, registerStrategies } = await import("../src/job-runner/index.mjs");
  const { tabContext, runOnTab } = await import("../src/runtimes/index.mjs");
  (pages.view.strategies ?? []).forEach((strategies, at) => registerStrategies(`tests/uc-010-harness.mjs#${at}`, strategies));
  const host = w.dashboardHost();
  const drafter = { name: "ep1", type: "model endpoint", model: ENDPOINT.model, context: 200000, price: null, capabilities: ["draft text", "read the repository"], place: "this machine", route: "endpoint ep1" };
  const context = tabContext({ kind: await kindOf("change-use-case"), params, product: { address: PRODUCT_URL, snapshot: await host.readSnapshot("main"), host },
    instance: { snapshot: await w.instanceHost().readSnapshot("main"), host: w.instanceHost() }, participants: [drafter], places: { sources: {}, mailbox: null }, gates: [], person: "alice",
    agentM: { version: w.instanceHead, commit: w.instanceHead }, jobId: null });
  const prepared = await prepareJob("change-use-case", context, { drafter, reviewers: [] });
  return runOnTab(prepared, context, { endpoints: { ep1: { config: { ...ENDPOINT, key: KEY }, bridge: null } }, bridges: {} }, { host, record: null });
}

/**
 * The drafting page of the use cases (`use-case/draft`), where the person chooses the CI agent for the requirement RULE and presses Run, and the line that says the job is queued waited for.
 * -> { target, queued: the line }. Registers the strategies of the review pages with the job runner, as the frame does for a page's view.
 */
export async function runOnDraftingPage(w, participant = "ci-bot") {
  const pages = await import("../src/review-pages/index.mjs");
  const { registerStrategies } = await import("../src/job-runner/index.mjs");
  (pages.view.strategies ?? []).forEach((strategies, at) => registerStrategies(`tests/uc-010-harness.mjs#${at}`, strategies));
  const target = document.createElement("div");
  document.body.append(target);
  await pages.view.routes.find((route) => route.name === "use-case").render(target, pageContext(w), { id: "draft" });
  for (const box of withClass(target, "requirement")) { box.checked = box.value === RULE; box.dispatchEvent(new Event("change")); }
  const chosen = withClass(target, "participant").find((box) => box.localName === "input" && box.value === participant);
  chosen.checked = true;
  chosen.dispatchEvent(new Event("change"));
  click(withClass(target, "prepare")[0]);
  await until(() => withClass(target, "run-panel").length === 1, "the run panel");
  const panel = withClass(target, "run-panel")[0];
  const run = find(panel, (node) => node.localName === "button" && node.textContent === "Run")[0];
  const shown = panel.textContent;
  click(run);
  await until(() => withClass(target, "queued").length === 1 || withClass(target, "problem").length > 0, "the job queued");
  return { target, shown, queued: withClass(target, "queued")[0], problem: withClass(target, "problem")[0] };
}
