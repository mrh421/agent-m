// The world of the release check tests/test_release_run.py: one product in memory, its default branch, its tags and its branch `test-results`, behind a Host that keeps a log of every
// call that writes, and the steps by which a case drives it — the release candidate started, records of tests added, the default branch moved on, the release accepted through
// MOD-release-evidence, or the release panel of the dashboard pressed. Each step returns what a person (or a reader of the repository) would see afterwards: the refusal's name, the tags and
// the commits they stand on, the writes, and the files the release committed. It holds no test and no expected result: the cases (tests/test_release_run.md) state those.
// Imported by tests/test_release_run.py through node (tests/jsrun.py).
//
// Module: MOD-release-evidence
// Level: release
//
// Written by developer-sonnet-l (ITM-1434), who built none of the behaviour it drives. The Host is kept to MOD-repository-hosts' interface (repositoryInfo, readSnapshot, listTags, commitFiles,
// createTag), as the unit tests of the module keep it; nothing reaches the network.
//
// The product: SPEC.md with one requirement, A SAMPLE RULE; tests/sample.test.mjs declaring the tests the case lists, each guarding it; a schedule naming a participant for the person-run levels; a
// CHANGELOG.md; and, where the case gives `last`, the report of the last release, which names the commit whose records the rates are compared with. The candidate is the commit the default branch
// stands at when the release candidate is started.

import { createHash } from "node:crypto";
import { startReleaseCandidate, releaseReport, acceptAndRelease } from "../src/release-evidence/index.mjs";
import { withStoredGraph } from "./stored-graph-fake.mjs";

const blobOf = (text) => createHash("sha1").update(`blob ${Buffer.byteLength(text)}\0`).update(text).digest("hex");
const failure = (name, fields = {}) => Object.assign(new Error(`${name} ${JSON.stringify(fields)}`), { name, ...fields });
const globPattern = (pattern) => new RegExp(`^${(pattern ?? "*").split("*").map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join(".*")}$`);

const WORKFLOW_PATH = ".github/workflows/agent-m-jobs.yml";
const SCHEDULE_PATH = "docs/tests/schedule.md";
const VERSION = "2026.4.0";
const PERSON = "akmaier";
const TODAY = "2026-11-02";

// ---------------------------------------------------------------- the product's files

const scheduleText = () => {
  const rows = ["unit", "component", "system", "paid", "release", "user"].map((level) => `| ${level} | ✓ | ✓ | ✓ | ✓ | ✓ | ${level === "release" || level === "user" ? "tester-b" : ""} |`);
  return ["---", "nightly: 02:00", "---", "## Levels", "", "| Row | every commit | pull request | nightly | release candidate | on demand | runs on |",
    "|---|---|---|---|---|---|---|", ...rows, ""].join("\n");
};
const SPEC = ["# Fixture product — Specification", "", "## Section", "", "**A SAMPLE RULE** *(Product Owner)*", "A sample rule.", "*Check:* `tests/sample.test.mjs`", ""].join("\n");
const testFile = (tests) => tests.map((t) => ["// " + t.id, "// level: " + t.level, "// guards: A SAMPLE RULE", ...(t.rate ? ["// runs: 10", "// phrasings: 2"] : []), ""].join("\n")).join("\n");

function recordText(commit, rows, n, uncommitted = false) {
  const levels = [...new Set(rows.map((row) => row[1]))];
  return ["---", `commit: ${commit}`, "levels:", ...levels.map((level) => `  - ${level}`), "occasion: release-candidate", "participant: ci", `date: 2026-11-0${n} 10:00 UTC`, ...(uncommitted ? ["uncommitted: true"] : []), "---", "## Outcomes", "",
    "| Test | Level | Outcome | Runs |", "|---|---|---|---|", ...rows.map((row) => `| ${row.join(" | ")} |`), ""].join("\n");
}

function lastReportText(commit, rateTests) {
  return ["---", "version: 2026.3.0", "candidate: v2026.3.0-rc.1", `commit: ${commit}`, "date: 2026-09-01", "---", "## Limitations", "", "## Levels", "",
    "| Level | Passed | Failed | Flaky | Not run |", "|---|---|---|---|---|", "| unit | 1 | 0 | 0 | 0 |", "", "## Tests", "", "| Test | Level | Outcome | Guards |", "|---|---|---|---|",
    ...rateTests.map((id) => `| ${id} | unit | 8 of 10 | A SAMPLE RULE |`), "", "## Requirements", "", "| Requirement | Level | Tests | Outcome |", "|---|---|---|---|",
    `| A SAMPLE RULE | unit | ${rateTests.join(", ")} | passed |`, "", "## Changelog entry", "", "Earlier release.", ""].join("\n");
}

// ---------------------------------------------------------------- the Host

function makeHost(initial) {
  const commits = new Map(), branches = new Map(), tagMap = new Map(), calls = [], written = new Set();
  let made = 0;
  const makeCommit = (files) => {
    const sha = createHash("sha1").update(`commit ${(made += 1)} ${JSON.stringify(Object.keys(files))}`).digest("hex");
    commits.set(sha, new Map(Object.entries(files)));
    return sha;
  };
  branches.set("main", makeCommit(initial));
  const treeOf = (ref) => commits.get(branches.get(ref));
  return {
    calls, written,
    head: () => branches.get("main"),
    tags: () => Object.fromEntries(tagMap),
    land(files) { branches.set("main", makeCommit({ ...Object.fromEntries(treeOf("main")), ...files })); },
    setBranch(name, files) { branches.set(name, makeCommit(files)); },
    async repositoryInfo() { return { defaultBranch: "main", visibility: "public", canWrite: true, archived: false, description: "" }; },
    async readSnapshot(ref) {
      const sha = branches.get(ref) ?? tagMap.get(ref) ?? (commits.has(ref) ? ref : null);
      if (!sha) throw failure("NotFound", { what: ref });
      const tree = commits.get(sha);
      return withStoredGraph({
        repository: { server: "github", origin: "https://github.com", path: "org/product", web: "https://github.com/org/product" },
        ref, commit: sha, paths: [...tree.keys()],
        read: async (path) => (tree.has(path) ? tree.get(path) : null),
        blob: (path) => (tree.has(path) ? blobOf(tree.get(path)) : null),
      });
    },
    async listTags(pattern) {
      const re = globPattern(pattern);
      return [...tagMap.entries()].filter(([name]) => re.test(name)).map(([name, commit]) => ({ name, commit }));
    },
    async createTag(name, commit) {
      calls.push({ fn: "createTag", name, commit });
      if (tagMap.has(name)) throw failure("TagExists", { commit: tagMap.get(name) });
      tagMap.set(name, commit);
    },
    async commitFiles(change) {
      calls.push({ fn: "commitFiles", paths: change.files.map((file) => file.path) });
      const head = branches.get(change.branch);
      if (head !== change.expectedHead) throw failure("Moved", { head });
      const files = Object.fromEntries(commits.get(head));
      for (const file of change.files) files[file.path] = file.text;
      const sha = makeCommit(files);
      branches.set(change.branch, sha);
      written.add(sha);
      return { commit: sha, url: `https://github.com/org/product/commit/${sha}` };
    },
  };
}

// ---------------------------------------------------------------- the world of a case

function build(c) {
  const files = {
    [WORKFLOW_PATH]: "name: Agent M jobs\n", [SCHEDULE_PATH]: scheduleText(), "SPEC.md": SPEC, "CHANGELOG.md": "# Changelog\n",
    "tests/sample.test.mjs": testFile(c.tests),
  };
  const results = {};
  if (c.last) files["docs/tests/releases/v2026.3.0.md"] = lastReportText(c.last.commit, c.tests.filter((t) => t.rate).map((t) => t.id));
  if (c.last) results[`runs/${c.last.commit}/20260901-1000-release-candidate-aaaa.md`] = recordText(c.last.commit, c.last.records, 1);
  const host = makeHost(files);
  host.setBranch("test-results", results);
  return { c, host, results, candidate: null, earlier: new Set(), changelog: "", serial: 1 };
}

// A record of the candidate's commit (where `on` is "candidate"), of another commit, or of the last release's.
function addRecords(world, step) {
  const commit = step.on === "other" ? "d".repeat(40) : world.candidate ?? world.host.head();
  world.serial += 1;
  world.results[`runs/${commit}/2026110${world.serial % 10}-1000-release-candidate-${String(world.serial).padStart(4, "0")}.md`] = recordText(commit, step.add, world.serial % 10, step.uncommitted === true);
  world.host.setBranch("test-results", { ...world.results });
}

const labelOf = (world, sha) => (sha === world.candidate ? "candidate commit" : world.earlier.has(sha) ? "earlier candidate" : world.host.written.has(sha) ? "a commit the release wrote" : sha.slice(0, 7));

// The candidate is the commit the default branch stands at now; the one before it, if any, is an earlier candidate.
function newCandidate(world) {
  if (world.candidate) world.earlier.add(world.candidate);
  world.candidate = world.host.head();
}

// The report as it is shown: composed from the newest candidate's commit, the records and the changelog entry the run keeps (releaseReport), and its blob.
async function shownBlob(world, stale) {
  const tags = await world.host.listTags(`v${VERSION}-rc.*`);
  if (!tags.length) return "0".repeat(40);
  const tag = tags[tags.length - 1];
  const at = await world.host.readSnapshot(tag.name);
  const results = await world.host.readSnapshot("test-results");
  const { text } = await releaseReport(at, results, { version: VERSION, tag: tag.name, commit: at.commit, changelog: world.changelog });
  const blob = blobOf(text);
  return stale ? (blob[0] === "0" ? "1" : "0") + blob.slice(1) : blob;
}

// ---------------------------------------------------------------- the dashboard's release panel

const walk = (root, match) => { const found = []; (function visit(node) { for (const kid of node.childNodes) if (kid.nodeType === 1) { if (match(kid)) found.push(kid); visit(kid); } })(root); return found; };
const byClass = (root, tag, name) => walk(root, (e) => e.localName === tag && e.className.split(" ").includes(name));
const typeInto = (field, text) => { field.value = text; field.dispatchEvent(new Event("input")); };

async function panel(world, step) {
  if (!world.dom) {
    await import("./site-frame-dom.mjs");
    world.dom = { route: (await import("../src/test-pages/release.mjs")).route, until: (await import("./prompt-bar.d/until.mjs")).until };
  }
  const { route, until } = world.dom;
  const context = { page: "releases", instance: { repository: "org/product" }, product: { address: "https://github.com/org/product", kind: "github", host: world.host }, store: null, go() {} };
  const text = () => world.target.textContent;
  if (step.do === "panel-open") {
    world.target = document.createElement("div");
    document.body.append(world.target);
    await route.render(world.target, context, {});
  } else if (step.do === "panel-start") {
    typeInto(byClass(world.target, "input", "version")[0], VERSION);
    typeInto(byClass(world.target, "textarea", "changelog")[0], step.changelog);
    typeInto(byClass(world.target, "input", "person")[0], PERSON);
    world.changelog = step.changelog;
    newCandidate(world);
    byClass(world.target, "button", "start")[0].dispatchEvent(new Event("click"));
    await until(() => /Queued run: \S/.test(text()), "the candidate and its queued run");
  } else if (step.do === "panel-check") {
    const area = byClass(world.target, "div", "report")[0];
    const before = area.childNodes[0];
    byClass(world.target, "button", "refresh")[0].dispatchEvent(new Event("click"));
    await until(() => area.childNodes[0] !== before, "the report drawn again");
  } else if (step.do === "panel-accept") {
    typeInto(byClass(world.target, "input", "person")[0], PERSON);
    for (const field of byClass(world.target, "input", "reason")) typeInto(field, step.reasons?.[field.dataset.id] ?? "");
    const result = byClass(world.target, "p", "result").at(-1);
    result.textContent = "";
    byClass(world.target, "button", "accept")[0].dispatchEvent(new Event("click"));
    await until(() => result.textContent.trim() !== "" && result.textContent !== "Releasing…", "the answer to Accept and release");
  }
  const buttons = walk(world.target, (e) => e.localName === "button").map((b) => b.textContent);
  const result = byClass(world.target, "p", "result").at(-1)?.textContent ?? "";
  return { buttons, reasonIds: byClass(world.target, "input", "reason").map((f) => f.dataset.id), result,
    incomplete: /has not finished at every level/.test(text()) };
}

// ---------------------------------------------------------------- one step

async function perform(world, step) {
  const { host } = world;
  let error = null, tests = null, ui = null;
  const before = host.calls.length;
  try {
    if (step.do === "records") addRecords(world, step);
    else if (step.do === "land") host.land({ "README.md": "an unrelated change\n" });
    else if (step.do === "tag") await host.createTag(step.name, "d".repeat(40));
    else if (step.do === "start") {
      newCandidate(world);
      world.changelog = step.changelog;
      await startReleaseCandidate(host, VERSION, world.candidate, step.changelog, PERSON);
    } else if (step.do === "accept") {
      const blob = await shownBlob(world, step.stale === true);
      await acceptAndRelease(host, { path: `docs/tests/releases/v${VERSION}.md`, blob }, { limitations: step.limitations ?? {} }, PERSON, TODAY);
    } else if (step.do.startsWith("panel-")) ui = await panel(world, step);
    else throw new Error(`unknown step ${step.do}`);
  } catch (e) {
    if (!e.name || e.name === "Error" || e.name === "TypeError" || e.name === "AssertionError") throw e;
    error = e.name;
    tests = e.tests ?? null;
  }
  const calls = host.calls.slice(before);
  const main = await host.readSnapshot("main");
  const approvalPath = main.paths.find((p) => p.startsWith(`docs/approvals/release-v${VERSION}-`));
  const writtenByRelease = calls.filter((call) => call.fn === "commitFiles").at(-1)?.paths ?? null;
  return {
    do: step.do, error, tests,
    tags: Object.fromEntries(Object.entries(host.tags()).map(([name, sha]) => [name, labelOf(world, sha)])),
    writes: host.calls.filter((call) => call.fn === "commitFiles").length,
    order: calls.map((call) => call.fn),
    lastWrite: writtenByRelease,
    changelog: await main.read("CHANGELOG.md"),
    report: main.paths.includes(`docs/tests/releases/v${VERSION}.md`),
    reportBlob: main.blob(`docs/tests/releases/v${VERSION}.md`),
    approval: approvalPath ? await main.read(approvalPath) : null,
    ui,
  };
}

/** run(c) -> one observation per step of the case. */
export async function run(c) {
  const world = build(c);
  const seen = [];
  for (const step of c.steps) seen.push(await perform(world, step));
  return seen;
}
