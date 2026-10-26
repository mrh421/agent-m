// A hosted job of the prompt bar's kind `converse` writes what its participant proposed (UC-049 4f), as docs/architecture/MOD-workflow-entries.md states it: "A job whose draft holds
// a hand-over (MOD-job-runner's `hand-over`, UC-049 4f) is followed in the same run, with the same participant and driver, by a job of the kind it names, where that kind's result waits
// for a person (`review: person`) and the hand-over works on no item of the backlog or step of the plan: its parameters the job's `source`, those MOD-job-runner's `handOverParams` gives for
// what it works on, and its task as `instruction`; prepared, and run unattended, so that its writer writes at once — a change of requirements as an open entry of a new queue, a use case or an
// architecture file as open; no job writes an approval record. A hand-over of any other kind, or one whose job does not start, is not run, and the job's end names it with why. The end lists
// every result of both: their commits, their files and pull requests, and their writers' notes." And MOD-job-runner's built-in writer `proposed-edits`: the edits of a `converse` job nobody attends,
// in one commit on a new branch `agent-m/<job>` and a pull request of it, never a commit on the default branch.
// Run: node --test tests/workflow-entries-converse-proposals.test.mjs
//
// Module: MOD-workflow-entries · MOD-job-runner
// Guards: UC-049; A CI AGENT'S DRAFT ENTERS AS OPEN; A REQUIREMENT IS NOT CHANGED WITHOUT AN IMPACT LIST; AN ARCHITECTURE CHANGE IS NOT ACCEPTED WITHOUT AN IMPACT LIST; NOTHING IS IMPLEMENTED BEFORE IT IS ACCEPTED; A SPEC EDIT IS SAVED AS A PROPOSAL
// Level: component
//
// Deterministic, no network: the product and the instance are temporary git repositories laid out as the job workflow lays them out (the fixture of
// tests/workflow-entries-design-kinds.test.mjs is the model), the instance holding the participant, the register entries of the book — chapters 8 to 12, which the recipes
// `chapters-for-requirements` and `chapters-for-architecture` read — and of the person's source, which the product links. One fake `fetch` stands for the world: the model endpoint
// (OpenAI-compatible), which answers by the kind whose prompt it is sent — the converse prompt, or a change kind's —, and the repository server's API — the history of the product, which the
// writer `open-files` reads, and the pull request the writer `proposed-edits` opens. The jobs run from their records (onRecordsChanged); the last test runs one whose task travels with its
// hand-over (onDispatch), whose kinds only read and draft text, so that it runs through Agent M's own job runner calling the endpoint, and a fixture `opencode` on the PATH shows it is not started. Where the module files leave a reading open, the test states the one it takes, and the pull request names it:
//   - A result line of the end is a commit, a file path, a pull request's address, a writer's note as `note: <note>`, or a hand-over not run as `not run: <kind> — <why>`.
//   - "The status of a reviewed file" is MOD-approvals' statuses over the product's default branch; a file the run changed is not accepted.
// Each test states its input and its expected result before it runs (given / input / expect). The counter-proofs are recorded in the pull request.

import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startRecord } from "../src/job-ledger/index.mjs";
import { statuses } from "../src/approvals/index.mjs";
import { architectureImpact, traceGraph } from "../src/trace-graph/index.mjs";

process.env.GIT_CONFIG_GLOBAL = "/dev/null";
process.env.GIT_CONFIG_SYSTEM = "/dev/null";
process.env.GIT_TERMINAL_PROMPT = "0";

const entries = await import("../src/workflow-entries/main.mjs").catch((error) => ({ error }));
const { runEntry } = entries;
const REAL_GIT = spawnSync("sh", ["-c", "command -v git"], { encoding: "utf8" }).stdout.trim();
const REAL_SLEEP = spawnSync("sh", ["-c", "command -v sleep"], { encoding: "utf8" }).stdout.trim();

// ---------------------------------------------------------------- the fixtures

const text = (...lines) => `${lines.join("\n")}\n`;
const sha256 = (body) => createHash("sha256").update(body).digest("hex");
const blobOf = (body) => createHash("sha1").update(`blob ${Buffer.byteLength(body)}\0${body}`).digest("hex");
const NOW = new Date("2026-10-26T09:00:00Z");
const TOKEN = "ghp_ALICEagentMtoken0123456789abcdef";
const KEY = "sk-FIXTURE-KEY-0123456789abcdef";
const ENDPOINT = { name: "fixture", kind: "openai-compatible", baseUrl: "https://llm.example.test/v1", model: "fixture-llm" };

const RULE = "A LOAN HAS A DUE DATE";
const RULE_TEXT = "Every loan states the date by which the book is returned.";
const SPEC = text("# Thesis tool — Specification", "", "## Lending", "", `**${RULE}** *(SRC-fixture-po)*`, RULE_TEXT, "*Check:* `tests/loan.test.mjs`");
const useCase = (goal) => text("---", "id: UC-001", "title: Check out a book", "area: lending", "actors:", "  - Member", "realises:", `  - ${RULE}`, "---",
  "# UC-001 Check out a book", "", `**Goal.** ${goal}`);
const UC_PATH = "docs/use-cases/UC-001-check-out-a-book.md";
const UC_BEFORE = useCase("The member borrows a book at the desk.");
const UC_AFTER = useCase("The member borrows a book at the desk and is told the date it is due.");
const DIAGRAM = ["", "```mermaid", "flowchart LR", "    Desk --> Shelf", "```", ""];
const decision = (decided) => text("---", "id: ARC-001", "title: Lending is a desk", "forced_by:", `  - ${RULE}`, "---", "# ARC-001 Lending is a desk", "", "## Context", "",
  "Books are lent at a desk.", "", "## Decision", "", decided, ...DIAGRAM, "## Alternatives", "", "One module.", "", "## Consequences", "", "Two folders.");
const ARC_PATH = "docs/architecture/ARC-001-lending-is-a-desk.md";
const ARC_BEFORE = decision("The desk and the shelf are two modules.");
const ARC_AFTER = decision("The desk and the shelf are two modules, and the desk tells the due date.");
const MOD_PATH = "docs/architecture/MOD-reader.md";
const MOD_READER = text("---", "id: MOD-reader", "title: Reading a book", "folder: src/reader/", "realises:", `  - ${RULE}`, "follows:", "  - ARC-001", "uses:", "provides:",
  "  - lend", "---", "# MOD-reader Reading a book", "", "## Responsibility", "", "It lends a book.", ...DIAGRAM, "## Parts", "", "- `index.mjs`", "", "## Data", "", "Nothing.", "",
  "## Interfaces", "", "- `lend`", "", "## Files", "", "None.", "", "## Uses", "", "Nothing.");
// The approval records of the use case, the decision and the module as they stand: each is accepted before the run.
const RECORDS = Object.fromEntries([["UC-001", UC_BEFORE], ["ARC-001", ARC_BEFORE], ["MOD-reader", MOD_READER]]
  .map(([id, body]) => [`docs/approvals/${id}-${blobOf(body).slice(0, 12)}.md`, text("---", `id: ${id}`, "kind: approval", "---", `# Approval of ${id}`)]));

const PO = "SRC-fixture-po";
const PO_ENTRY = text("---", `id: ${PO}`, "title: Fixture PO", "kind: document", "authority: normative", "licence: may be republished — fixture", "---",
  `# ${PO} Fixture PO`, "", "A fixture source.", "", "## Versions", "", "| Version | Date | Edition | Read from | Files |", "|---|---|---|---|---|",
  `| \`2026-10-05\` | 2026-10-05 | — | the fixture | 1 file, listed below; version hash \`${"1".repeat(64)}\` |`, "", "### Files of 2026-10-05", "", "| File | SHA-256 |", "|---|---|",
  `| \`po.md\` | \`${"a".repeat(64)}\` |`);
const CHAPTERS = [8, 9, 10, 11, 12].map((n) => [`${String(n).padStart(2, "0")}_chapter-${n}.md`, `Chapter ${n} of the fixture book.\n`]);
const BOOK_ENTRY = text("---", "id: SRC-vibe-coding", "title: Vibe Coding", "kind: document", "authority: normative", "licence: may be republished — fixture", "---",
  "# SRC-vibe-coding Vibe Coding", "", "## Versions", "", "| Version | Date | Edition | Read from | Files |", "|---|---|---|---|---|",
  `| \`2026-10-05\` | 2026-10-05 | — | the fixture | ${CHAPTERS.length} files, listed below; version hash \`${sha256(CHAPTERS.map(([name, body]) => `${sha256(body)}  ${name}\n`).join(""))}\` |`,
  "", "### Files of 2026-10-05", "", "| File | SHA-256 |", "|---|---|", ...CHAPTERS.map(([name, body]) => `| \`${name}\` | \`${sha256(body)}\` |`));
const LINKS = text("# The sources this product meets", "", "| Source | Version | Hash | Part |", "|---|---|---|---|", `| ${PO} | 2026-10-05 | ${"1".repeat(64)} | |`);

const PARTICIPANTS = text("# Participants of this instance", "",
  "| Name | Type | Model | Context | Price | Capabilities | Processing place | Route |", "|---|---|---|---|---|---|---|---|",
  "| ci-bot | CI agent | fixture-llm | 100000 | — | draft text, read the repository | GitHub's hosted runners | ci hosted secret FIXTURE_KEY |");

const PRODUCT_FILES = { "README.md": "# Thesis tool\n", "SPEC.md": SPEC, "docs/sources.md": LINKS, [UC_PATH]: UC_BEFORE, [ARC_PATH]: ARC_BEFORE, [MOD_PATH]: MOD_READER, ...RECORDS };
const INSTRUCTION = "Tell the member the due date";
const JOB = "JOB-20261026-0800-a1b2";
const converseStart = (agentM, params = {}) => ({ id: JOB, kind: "converse", worksOn: ["https://github.com/alice/thesis-tool"], participant: "ci-bot", model: "fixture-llm",
  route: "ci hosted", run: null, retries: null, startedBy: "alice", start: new Date("2026-10-26T08:00:00Z"), agentM, inputs: [], limit: 2,
  destinations: [{ participant: "ci-bot", place: "GitHub's hosted runners", parts: ["instruction"] }], params: { endpoint: ENDPOINT, instruction: INSTRUCTION, source: PO, ...params } });
const recordFile = (start) => { const { path, text: body } = startRecord(start); return [path, body]; };

function git(cwd, ...args) {
  const r = spawnSync(REAL_GIT, args, { cwd, encoding: "utf8" });
  if (r.status !== 0) throw new Error(`git ${args.join(" ")} failed in ${cwd}: ${r.stderr}`);
  return r.stdout.trim();
}
function write(root, files) {
  for (const [path, body] of Object.entries(files)) {
    mkdirSync(join(root, path, ".."), { recursive: true });
    writeFileSync(join(root, path), body);
  }
}
// A bare origin whose `main` holds `files`, and the clone of it the workflow checks out into `folder`; no git maintenance in either (as tests/workflow-entries-design-kinds.test.mjs).
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

// The workspace of a job workflow: product/ and instance/, the product holding the converse job's record.
async function withWorkspace(params, run, { extraBin = null } = {}) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "agent-m-converse-")));
  const workspace = join(root, "ws");
  try {
    const instance = repository(root, "instance", { "README.md": "# Instance\n", "docs/participants.md": PARTICIPANTS, [`docs/sources/${PO}.md`]: PO_ENTRY,
      "docs/sources/SRC-vibe-coding.md": BOOK_ENTRY, ...Object.fromEntries(CHAPTERS.map(([name, body]) => [`docs/sources/SRC-vibe-coding/2026-10-05/${name}`, body])) },
    join(workspace, "instance"));
    const agentM = { version: "2026.10.0", commit: git(join(workspace, "instance"), "rev-parse", "HEAD") };
    const start = typeof params === "function" ? params(agentM) : converseStart(agentM, params);
    const product = repository(root, "product", { ...PRODUCT_FILES, ...Object.fromEntries([recordFile(start)]) }, join(workspace, "product"));
    const base = git(product, "rev-parse", "main");
    return await run({ root, workspace, product, instance, agentM, base, head: git(join(workspace, "product"), "rev-parse", "HEAD"), productDir: join(workspace, "product"), extraBin });
  } finally { rmSync(root, { recursive: true, force: true }); }
}

const environment = (w, extra = {}) => ({ GITHUB_ACTIONS: "true", GITHUB_EVENT_NAME: "push", GITHUB_WORKSPACE: w.workspace, GITHUB_SERVER_URL: "https://github.com",
  GITHUB_REPOSITORY: "alice/thesis-tool", GITHUB_REF_NAME: "main", GITHUB_SHA: w.head, GITHUB_RUN_ID: "4711", GITHUB_ACTOR: "alice",
  AGENT_M_RUNNER: "hosted", AGENT_M_PRODUCT_DIR: w.productDir, AGENT_M_TOKEN_NAME: "AGENT_M_TOKEN", AGENT_M_KEY_NAMES: "FIXTURE_KEY", AGENT_M_TOKEN: TOKEN,
  FIXTURE_KEY: KEY, ...extra });
const fileAt = (w, path, ref = "main") => `${git(w.product, "show", `${ref}:${path}`)}\n`;
const pathsAt = (w, ref = "main") => git(w.product, "ls-tree", "-r", "--name-only", ref).split("\n").filter(Boolean);
const endOf = (w) => fileAt(w, `docs/jobs/${JOB}.md`).split(/^## End$/m)[1] ?? "";
// The commits the run made on any branch, beyond the product's first state, and every path they touched.
const madeSince = (w) => git(w.product, "rev-list", "--all", `^${w.base}`).split("\n").filter(Boolean);
const touched = (w) => [...new Set(madeSince(w).flatMap((sha) => git(w.product, "diff-tree", "--no-commit-id", "--name-only", "-r", sha).split("\n").filter(Boolean)))];
// A snapshot of the product's main for MOD-approvals' statuses and MOD-trace-graph's traceGraph: its paths, each file's blob and text.
function snapshotAt(w, ref = "main") {
  const blobs = new Map(git(w.product, "ls-tree", "-r", ref).split("\n").filter(Boolean).map((line) => { const [meta, path] = line.split("\t"); return [path, meta.split(" ")[2]]; }));
  return { paths: [...blobs.keys()], blob: (path) => blobs.get(path) ?? null, read: async (path) => (blobs.has(path) ? fileAt(w, path, ref) : null) };
}

// The world: the model endpoint, which answers by the prompt it is sent — a change kind's draft for the prompt of that kind, the conversation's draft for any other —, and the repository
// server's API: the product's history, answered from its origin by git, and the pull requests, of which every opening is kept.
const PROMPTS = { "change-requirements": "You change requirements of a product", "change-use-case": "You change a use case of a product", "change-architecture": "You change the architecture of a product" };
function fakeWorld(drafts, w) {
  const requests = [], pulls = [];
  globalThis.fetch = async (address, init = {}) => {
    const url = String(address), body = String(init.body ?? "");
    requests.push({ address: url, method: init.method ?? "GET", body });
    if (url.startsWith("https://llm.example.test/")) {
      const kind = Object.keys(PROMPTS).find((name) => body.includes(PROMPTS[name])) ?? "converse";
      const content = JSON.stringify({ draft: drafts[kind], answers: [] });
      return new Response(JSON.stringify({ choices: [{ message: { content } }], usage: { prompt_tokens: 120, completion_tokens: 30 } }), { status: 200 });
    }
    if (url === "https://api.github.com/repos/alice/thesis-tool/pulls" && (init.method ?? "GET") === "POST") {
      const asked = JSON.parse(body);
      pulls.push(asked);
      return new Response(JSON.stringify({ number: 7, title: asked.title, head: { ref: asked.head, sha: "0".repeat(40) }, base: { ref: asked.base, sha: "0".repeat(40) }, state: "open",
        merged_at: null, draft: false, body: asked.body, html_url: "https://github.com/alice/thesis-tool/pull/7", created_at: NOW.toISOString(), closed_at: null }), { status: 201 });
    }
    const listed = /^https:\/\/api\.github\.com\/repos\/alice\/thesis-tool\/commits\?/.exec(url);
    const one = /^https:\/\/api\.github\.com\/repos\/alice\/thesis-tool\/commits\/([0-9a-f]{40})\?/.exec(url);
    if (listed) {
      const page = Number(new URL(url).searchParams.get("page") ?? "1");
      const shas = page === 1 ? git(w.product, "log", "--format=%H", "main").split("\n").filter(Boolean) : [];
      return new Response(JSON.stringify(shas.map((sha) => ({ sha, parents: git(w.product, "log", "-1", "--format=%P", sha).split(" ").filter(Boolean).map((p) => ({ sha: p })),
        author: null, commit: { author: { name: "x" }, committer: { date: "2026-10-26T08:00:00Z" }, message: git(w.product, "log", "-1", "--format=%s", sha) } }))), { status: 200 });
    }
    if (one) {
      const changes = git(w.product, "diff-tree", "--no-commit-id", "--name-status", "-r", "--root", one[1]).split("\n").filter(Boolean).map((line) => line.split("\t"));
      const status = { A: "added", M: "modified", D: "removed" };
      return new Response(JSON.stringify({ files: changes.map(([s, filename]) => ({ filename, status: status[s] ?? "modified" })) }), { status: 200 });
    }
    return new Response(JSON.stringify({ message: "not found" }), { status: 404 });
  };
  return { requests, pulls, prompted: (kind) => requests.filter((each) => each.address.startsWith("https://llm.example.test/") && each.body.includes(PROMPTS[kind])).length };
}
const run = (w) => { assert.ok(runEntry, `runEntry: ${entries.error?.message}`); return runEntry("onRecordsChanged", environment(w), { now: NOW }); };
const answer = (handOver, extra = {}) => ({ answer: "Done as you asked.", ...(handOver ? { handOver } : {}), ...extra });
const noApprovalWritten = (w) => assert.deepEqual(touched(w).filter((path) => path.startsWith("docs/approvals/")), [], "no approval record is written by the job");

// ---------------------------------------------------------------- a hand-over to the change of requirements

// TST-1360101 · level: component · module: MOD-workflow-entries
// guards: UC-049; A CI AGENT'S DRAFT ENTERS AS OPEN; A REQUIREMENT IS NOT CHANGED WITHOUT AN IMPACT LIST; A SPEC EDIT IS SAVED AS A PROPOSAL
// given: a product with the requirement A LOAN HAS A DUE DATE, the person's source SRC-fixture-po linked, and a queued hosted job of `converse` whose parameters hold that source; the endpoint answers the conversation with a hand-over { kind change-requirements, works_on [the requirement], task "say the due date" } and the change of requirements with one candidate that changes the requirement
// input: onRecordsChanged
// expect: outcome `done`; the endpoint was sent the prompt of change-requirements once, with no person's click between; one new queue under docs/spec-freigaben/ holds the entry — its rationale with an impact list naming UC-001 — and no approval record names it: the entry is open; SPEC.md is byte-identical; the job's end says `state: done` and lists the writer's commit and the queue's files; no approval record is written
test("TST-1360101: a hosted converse job's hand-over to change-requirements runs in the same run and ends in an open SPEC change entry", async () => {
  await withWorkspace({}, async (w) => {
    const world = fakeWorld({ converse: answer({ kind: "change-requirements", works_on: [RULE], task: "say the due date" }),
      "change-requirements": { candidates: [{ name: RULE, rule: `${RULE_TEXT} The member is told the date.`, check: "`tests/loan.test.mjs`", constrains: "product", passage: "§2",
        class: "change", of: RULE }] } }, w);
    const status = await run(w); if (process.env.DEBUG_1360) console.log("DEBUG", status, fileAt(w, `docs/jobs/${JOB}.md`), git(w.product, "log", "--all", "--stat", "--format=%H %s %D"));
    assert.equal(status.outcome, "done", status.summary);
    assert.equal(world.prompted("change-requirements"), 1, "the change of requirements ran once, in the same run");
    const queued = touched(w).filter((path) => path.startsWith("docs/spec-freigaben/"));
    assert.ok(queued.some((path) => path.endsWith("/index.md")) && queued.some((path) => /\/\d\d-[^/]+\.md$/.test(path) && !path.endsWith(".begruendung.md")), queued.join(", "));
    const rationale = queued.find((path) => path.endsWith(".begruendung.md"));
    assert.ok(rationale, "a rationale is written");
    assert.match(fileAt(w, rationale), /\*\*Impact list\.\*\*[^]*UC-001/, "the impact list names the use case that realises the requirement");
    assert.equal(fileAt(w, "SPEC.md"), SPEC, "SPEC.md is byte-identical");
    noApprovalWritten(w);
    const end = endOf(w);
    assert.match(end, /state: done/);
    const writer = git(w.product, "log", "--format=%H", "--grep=Agent-M-Kind: change-requirements", "main").split("\n").filter(Boolean);
    assert.equal(writer.length, 1, "one commit of the change's writer");
    assert.ok(end.includes(writer[0]), "the end lists the writer's commit");
    assert.ok(end.includes(rationale), "the end lists the queue's files");
  });
});

// TST-1360102 · level: component · module: MOD-workflow-entries
// guards: UC-049; THE PERSON WHO PROMPTS IS A SOURCE
// given: the same product, and a hosted converse job whose parameters hold no `source`; the endpoint answers the same hand-over to change-requirements
// input: onRecordsChanged
// expect: outcome `done`; the prompt of change-requirements is never sent; nothing under docs/spec-freigaben/ is written; the end lists a line `not run: change-requirements — ` naming THE PERSON WHO PROMPTS IS A SOURCE
test("TST-1360102: a hand-over to change-requirements without the person's own source is not run, and the end says why", async () => {
  await withWorkspace({ source: undefined }, async (w) => {
    const world = fakeWorld({ converse: answer({ kind: "change-requirements", works_on: [RULE], task: "say the due date" }), "change-requirements": { candidates: [] } }, w);
    const status = await run(w); if (process.env.DEBUG_1360) console.log("DEBUG", status, fileAt(w, `docs/jobs/${JOB}.md`), git(w.product, "log", "--all", "--stat", "--format=%H %s %D"));
    assert.equal(status.outcome, "done", status.summary);
    assert.equal(world.prompted("change-requirements"), 0);
    assert.deepEqual(touched(w).filter((path) => path.startsWith("docs/spec-freigaben/")), []);
    assert.match(endOf(w), /not run: change-requirements — [^\n]*THE PERSON WHO PROMPTS IS A SOURCE/);
  });
});

// ---------------------------------------------------------------- a hand-over to the change of a use case

// TST-1360103 · level: component · module: MOD-workflow-entries
// guards: UC-049; A CI AGENT'S DRAFT ENTERS AS OPEN
// given: the use case UC-001, accepted (an approval record names its text); a hosted converse job; the endpoint answers the conversation with a hand-over { kind change-use-case, works_on [UC-001] } and the change of the use case with UC-001's new text, classed a change of UC-001
// input: onRecordsChanged
// expect: outcome `done`; the prompt of change-use-case was sent (as many rounds as its loop takes); UC-001's file on main is the drafted text; its status is not accepted — known positive: before the run it was accepted —; no approval record is written; the end lists the writer's commit and UC-001's path
test("TST-1360103: a use case edit proposed in a hosted job is committed as not accepted", async () => {
  await withWorkspace({}, async (w) => {
    const before = statuses(snapshotAt(w, w.base));
    assert.equal([...before.values()].find((each) => each.id === "UC-001").status, "accepted", "known positive: UC-001 is accepted before the run");
    const world = fakeWorld({ converse: answer({ kind: "change-use-case", works_on: ["UC-001"], task: "tell the due date" }),
      "change-use-case": { files: [{ path: UC_PATH, text: UC_AFTER, class: "change", of: "UC-001" }] } }, w);
    const status = await run(w); if (process.env.DEBUG_1360) console.log("DEBUG", status, fileAt(w, `docs/jobs/${JOB}.md`), git(w.product, "log", "--all", "--stat", "--format=%H %s %D"));
    assert.equal(status.outcome, "done", status.summary);
    assert.ok(world.prompted("change-use-case") >= 1, "the change of the use case ran, in the same run");
    assert.equal(fileAt(w, UC_PATH), UC_AFTER);
    assert.notEqual([...statuses(snapshotAt(w)).values()].find((each) => each.id === "UC-001").status, "accepted", "the changed use case is not accepted");
    noApprovalWritten(w);
    const writer = git(w.product, "log", "--format=%H", "--grep=Agent-M-Kind: change-use-case", "main").split("\n").filter(Boolean);
    assert.equal(writer.length, 1);
    const end = endOf(w);
    assert.ok(end.includes(writer[0]) && end.includes(UC_PATH), end);
  });
});

// ---------------------------------------------------------------- a hand-over to the change of the architecture

// TST-1360104 · level: component · module: MOD-workflow-entries
// guards: UC-049; AN ARCHITECTURE CHANGE IS NOT ACCEPTED WITHOUT AN IMPACT LIST; A CI AGENT'S DRAFT ENTERS AS OPEN
// given: the accepted decision ARC-001 and the module MOD-reader, which follows it; a hosted converse job; the endpoint answers the conversation with a hand-over { kind change-architecture, works_on [ARC-001] } and the change of the architecture with ARC-001's new text, classed a change of ARC-001
// input: onRecordsChanged
// expect: outcome `done`; the prompt of change-architecture was sent (as many rounds as its loop takes); ARC-001's file on main is the drafted text, its status no longer accepted; the impact list of the change — MOD-trace-graph's architectureImpact on main's graph, from the text last accepted to the text on main — names MOD-reader; no approval record is written; the end lists the writer's commit and ARC-001's path
test("TST-1360104: an architecture change handed over in a hosted job is committed open, and keeps its impact list", async () => {
  await withWorkspace({}, async (w) => {
    const world = fakeWorld({ converse: answer({ kind: "change-architecture", works_on: ["ARC-001"], task: "the desk tells the due date" }),
      "change-architecture": { files: [{ path: ARC_PATH, text: ARC_AFTER, class: "change", of: "ARC-001" }] } }, w);
    const status = await run(w); if (process.env.DEBUG_1360) console.log("DEBUG", status, fileAt(w, `docs/jobs/${JOB}.md`), git(w.product, "log", "--all", "--stat", "--format=%H %s %D"));
    assert.equal(status.outcome, "done", status.summary);
    assert.ok(world.prompted("change-architecture") >= 1, `the change of the architecture ran, in the same run: ${endOf(w)}`);
    assert.equal(fileAt(w, ARC_PATH), ARC_AFTER);
    const now = snapshotAt(w);
    assert.equal([...statuses(now).values()].find((each) => each.id === "ARC-001").status, "changed", "the decision is changed since its acceptance, not accepted");
    const impact = architectureImpact(await traceGraph(now), [{ path: ARC_PATH, before: ARC_BEFORE, after: fileAt(w, ARC_PATH) }]);
    assert.ok(impact.modules.some((each) => each.id === "MOD-reader"), JSON.stringify(impact));
    noApprovalWritten(w);
    const writer = git(w.product, "log", "--format=%H", "--grep=Agent-M-Kind: change-architecture", "main").split("\n").filter(Boolean);
    assert.equal(writer.length, 1);
    assert.ok(endOf(w).includes(writer[0]) && endOf(w).includes(ARC_PATH));
  });
});

// ---------------------------------------------------------------- the conversation's own edits, and a hand-over not run

// TST-1360106 · level: component · module: MOD-workflow-entries · MOD-job-runner
// guards: UC-049; A CI AGENT'S DRAFT ENTERS AS OPEN; CODE ENTERS THE DEFAULT BRANCH THROUGH A PULL REQUEST WITH GREEN CI
// given: a hosted converse job; the endpoint answers the conversation with the edits docs/notes.md (a document it may propose) and SPEC.md (one it may not), and no hand-over
// input: onRecordsChanged
// expect: outcome `done`; main holds no docs/notes.md and SPEC.md is byte-identical; the branch agent-m/<job> holds docs/notes.md as drafted, in one commit whose message ends with the job's provenance lines; one pull request of that branch into main was opened; the end lists that commit, docs/notes.md, the pull request's address and a note naming SPEC.md as not written; no approval record is written
test("TST-1360106: a hosted converse job's edits are written as a pull request, and its record lists them", async () => {
  await withWorkspace({}, async (w) => {
    const notes = text("# Notes", "", "The desk tells the due date.");
    const world = fakeWorld({ converse: answer(null, { edits: [{ path: "docs/notes.md", text: notes }, { path: "SPEC.md", text: "# changed\n" }] }) }, w);
    const status = await run(w); if (process.env.DEBUG_1360) console.log("DEBUG", status, fileAt(w, `docs/jobs/${JOB}.md`), git(w.product, "log", "--all", "--stat", "--format=%H %s %D"));
    assert.equal(status.outcome, "done", status.summary);
    assert.ok(!pathsAt(w).includes("docs/notes.md"), `main holds no proposed document: ${pathsAt(w).join(" ")}`);
    assert.equal(fileAt(w, "SPEC.md"), SPEC);
    const branch = `agent-m/${JOB}`;
    assert.equal(fileAt(w, "docs/notes.md", branch), notes);
    const commit = git(w.product, "rev-parse", branch);
    assert.match(git(w.product, "log", "-1", "--format=%B", commit), new RegExp(`Agent-M-Job: ${JOB}[^]*Agent-M-Kind: converse`));
    assert.equal(world.pulls.length, 1);
    assert.deepEqual([world.pulls[0].head, world.pulls[0].base], [branch, "main"]);
    const end = endOf(w);
    for (const result of [commit, "docs/notes.md", "https://github.com/alice/thesis-tool/pull/7"]) assert.ok(end.includes(result), `the end lists ${result}`);
    assert.match(end, /note: [^\n]*SPEC\.md/);
    noApprovalWritten(w);
  });
});

// TST-1360107 · level: component · module: MOD-workflow-entries
// guards: UC-049; NOTHING IS IMPLEMENTED BEFORE IT IS ACCEPTED; A JOB GOES ONLY TO A HOLDER OF ITS ROLE
// given: a hosted converse job; the endpoint answers with a hand-over { kind implement, works_on [ITM-004] }; and, in a second run, { kind change-use-case, works_on [ITM-004, UC-001] }
// input: onRecordsChanged for each
// expect: outcome `done` both times; no request carries another prompt than the conversation's; the end lists `not run: implement — ` and `not run: change-use-case — `, each naming why; nothing but the job's own record is written
test("TST-1360107: a hand-over of a kind that does not wait for a person, or one that works on an item of the plan, is not run in the hosted job", async () => {
  for (const handOver of [{ kind: "implement", works_on: ["ITM-004"], task: "build it" }, { kind: "change-use-case", works_on: ["ITM-004", "UC-001"], task: "change it" }]) {
    await withWorkspace({}, async (w) => {
      const world = fakeWorld({ converse: answer(handOver) }, w);
      const status = await run(w); if (process.env.DEBUG_1360) console.log("DEBUG", status, fileAt(w, `docs/jobs/${JOB}.md`), git(w.product, "log", "--all", "--stat", "--format=%H %s %D"));
      assert.equal(status.outcome, "done", status.summary);
      assert.equal(world.requests.filter((each) => each.address.startsWith("https://llm.example.test/")).length, 1, "only the conversation was sent");
      assert.match(endOf(w), new RegExp(`not run: ${handOver.kind} — \\S`));
      assert.deepEqual(touched(w), [`docs/jobs/${JOB}.md`]);
    });
  }
});

// ---------------------------------------------------------------- the job whose task travels with its hand-over (the endpoint's own job spawned by the bar)

// TST-1360108 · level: component · module: MOD-workflow-entries
// guards: UC-049; A CI AGENT'S DRAFT ENTERS AS OPEN; A HOSTED JOB AUTHENTICATES ITS AGENT WITH A CI SECRET; A CONVERSATION IS WRITTEN TO A REPOSITORY ONLY WHEN RECORDING IS ON
// given: a queued converse job of the endpoint's own (route ci hosted, task `with the hand-over`, `declares` draft text and read the repository, the person's source as its parameter); the model endpoint answers the conversation with a hand-over { kind change-use-case, works_on [UC-001] } and the change of the use case with UC-001's new text; an executable `opencode` on the PATH that notes every start
// input: onDispatch with the inputs job, task "Tell the member the due date, token heron-1360", the endpoint and the secret FIXTURE_KEY
// expect: outcome `done`; opencode is never started — a kind that only reads and drafts runs through Agent M's own job runner, calling the endpoint itself —; the endpoint is sent the conversation and then the change of the use case; UC-001's file on main is the drafted text and not accepted; the job's end lists the writer's commit and UC-001's path; no file and no commit message of the product holds heron-1360; no approval record is written
test("TST-1360108: the endpoint's own converse job, dispatched with its task, runs through Agent M's job runner and lists the hand-over's result in its record", async () => {
  const TASK = "Tell the member the due date, token heron-1360";
  const declared = (agentM) => ({ ...converseStart(agentM, { endpoint: undefined, instruction: undefined }), participant: "fixture-endpoint", task: "with the hand-over",
    declares: { context: 100000, capabilities: ["draft text", "read the repository"] }, destinations: [{ participant: "fixture-endpoint", place: "GitHub's hosted runners", parts: ["instruction"] }] });
  await withWorkspace(declared, async (w) => {
    const world = fakeWorld({ converse: answer({ kind: "change-use-case", works_on: ["UC-001"], task: "tell the due date" }),
      "change-use-case": { files: [{ path: UC_PATH, text: UC_AFTER, class: "change", of: "UC-001" }] } }, w);
    const bin = join(w.root, "bin"), started = join(w.root, "opencode-started");
    mkdirSync(bin);
    writeFileSync(started, "");
    writeFileSync(join(bin, "git"), `#!/bin/sh\nexec ${REAL_GIT} "$@"\n`, { mode: 0o755 });
    writeFileSync(join(bin, "sleep"), `#!/bin/sh\nexec ${REAL_SLEEP} "$@"\n`, { mode: 0o755 });
    writeFileSync(join(bin, "opencode"), `#!/bin/sh\necho "$1" >> ${started}\ncase "$1" in --version) echo 1.4.0;; auth) echo '1 credentials';; esac\n`, { mode: 0o755 });
    const saved = { PATH: process.env.PATH, FIXTURE_KEY: process.env.FIXTURE_KEY };
    Object.assign(process.env, { PATH: bin, FIXTURE_KEY: KEY });
    try {
      const payload = join(w.root, "event.json");
      writeFileSync(payload, JSON.stringify({ inputs: { job: JOB, task: TASK, endpoint: JSON.stringify({ kind: ENDPOINT.kind, baseUrl: ENDPOINT.baseUrl, model: ENDPOINT.model }), secret: "FIXTURE_KEY" } }));
      const status = await runEntry("onDispatch", environment(w, { GITHUB_EVENT_NAME: "workflow_dispatch", GITHUB_EVENT_PATH: payload, GITHUB_STEP_SUMMARY: join(w.root, "summary.md") }), { now: NOW });
      assert.equal(status.outcome, "done", status.summary);
      assert.ok(!readFileSync(started, "utf8").includes("run"), "opencode is never started to run a job");
      const calls = world.requests.filter((each) => each.address.startsWith("https://llm.example.test/"));
      assert.ok(calls.length >= 2, "the endpoint is called for the conversation and for the change of the use case");
      assert.ok(world.prompted("change-use-case") >= 1, "the change of the use case ran, in the same run");
      assert.equal(fileAt(w, UC_PATH), UC_AFTER);
      assert.notEqual([...statuses(snapshotAt(w)).values()].find((each) => each.id === "UC-001").status, "accepted");
      const writer = git(w.product, "log", "--format=%H", "--grep=Agent-M-Kind: change-use-case", "main").split("\n").filter(Boolean);
      assert.equal(writer.length, 1);
      const end = endOf(w);
      assert.ok(end.includes(writer[0]) && end.includes(UC_PATH), end);
      const everything = madeSince(w).map((sha) => git(w.product, "show", sha)).join("\n");
      assert.ok(!everything.includes("heron-1360"), "the task is written nowhere");
      noApprovalWritten(w);
    } finally {
      for (const name of ["PATH", "FIXTURE_KEY"]) { if (saved[name] === undefined) delete process.env[name]; else process.env[name] = saved[name]; }
    }
  });
});
