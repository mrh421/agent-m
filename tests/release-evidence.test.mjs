// Versions, release candidates and the release (ITM-254) — MOD-release-evidence's nextVersion, startReleaseCandidate,
// releaseReport and acceptAndRelease, as the accepted text of docs/architecture/MOD-release-evidence.md states them:
// the next version of a product's own line; the release candidate tagged and its complete run queued; the release
// test report of a candidate whose run has ended; and, on the person's one click, the report, its approval record
// with every known limitation and the changelog entry in one commit, then the tag on the tested commit.
// reportsAwaitingAcceptance (ITM-239) is covered below; the audit (auditRows, auditDocument, UC-030) is not.
// Run: node --test tests/release-evidence.test.mjs
//
// Module: MOD-release-evidence
// Guards: UC-013; CALENDAR VERSIONS; EVERY PRODUCT HAS ITS OWN VERSION LINE; A RELEASE IS TAGGED AND LOGGED; A VERSION IS NOT REWRITTEN
// Guards: A RELEASE RUNS EVERY TEST AT EVERY LEVEL; RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER
// Guards: THE RELEASE TEST REPORT IS ACCEPTED BY A PERSON; A RED RELEASE IS ACCEPTED ONLY WITH ITS LIMITATIONS RECORDED
// Guards: ACCEPTING THE RELEASE TEST REPORT RELEASES
// Level: unit
//
// The host and the snapshots are fakes, kept to MOD-repository-hosts' interface (paths, read(path), blob(path),
// repositoryInfo, readSnapshot, listTags, commitFiles, createTag) — one repository in memory, no fetch, no network,
// nothing sleeps or waits. Each test states its input and its expected result before it runs. The counter-proofs are
// recorded in the pull request.

import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { nextVersion, startReleaseCandidate, releaseReport, acceptAndRelease, reportsAwaitingAcceptance } from "../src/release-evidence/index.mjs";
import { readDocument } from "../src/documents/index.mjs";
import { approvalSchema, statusOf } from "../src/approvals/index.mjs";
import { storedGraphReadOn, withStoredGraph } from "./stored-graph-fake.mjs";

// ================================================================== fakes

const blobSha = (text) => {
  const body = Buffer.from(text, "utf8");
  return createHash("sha1").update(`blob ${body.length}\0`).update(body).digest("hex");
};
const failure = (name, fields = {}) => Object.assign(new Error(`${name} ${JSON.stringify(fields)}`), { name, ...fields });
const globPattern = (pattern) => new RegExp(`^${pattern.split("*").map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join(".*")}$`);

// A fake MOD-repository-hosts' Host: one repository in memory. branchFiles seeds the default branch's one commit;
// extraCommits seeds further commits (by label) a test can tag or read directly, as a candidate's own commit —
// starting a candidate tags a commit that already stands, it never makes one. tags seeds existing tags (name -> a
// label of extraCommits, or "default" for the default branch's own commit). branches seeds further named refs this
// repository holds besides the default branch (MOD-result-records' own "test-results", by name).
function fakeHost({ defaultBranch = "main", branchFiles = {}, extraCommits = {}, tags = {}, branches: extraBranches = {} } = {}) {
  const commits = new Map();
  const branches = new Map();
  const tagMap = new Map();
  let made = 0;
  const makeCommit = (files) => {
    const sha = createHash("sha1").update(`commit ${(made += 1)} ${JSON.stringify(Object.keys(files))} ${Math.random()}`).digest("hex");
    commits.set(sha, new Map(Object.entries(files)));
    return sha;
  };
  const defaultCommit = makeCommit(branchFiles);
  branches.set(defaultBranch, defaultCommit);
  const shaOf = { default: defaultCommit };
  for (const [label, files] of Object.entries(extraCommits)) shaOf[label] = makeCommit(files);
  for (const [name, label] of Object.entries(tags)) tagMap.set(name, shaOf[label]);
  for (const [name, files] of Object.entries(extraBranches)) branches.set(name, makeCommit(files));

  const calls = [];
  return {
    calls,
    shaOf,
    land(files) { branches.set(defaultBranch, makeCommit({ ...Object.fromEntries(commits.get(branches.get(defaultBranch))), ...files })); },
    // A further named branch (MOD-result-records' "test-results", by name), added once the commit a test wants to
    // reference from it (such as a candidate's own, learned from shaOf after fakeHost built it) is known.
    addBranch(name, files) { branches.set(name, makeCommit(files)); },
    tagOf: (name) => tagMap.get(name),
    async repositoryInfo() {
      return { defaultBranch, visibility: "public", canWrite: true, archived: false, description: "" };
    },
    async readSnapshot(ref) {
      const sha = branches.get(ref) ?? tagMap.get(ref) ?? (commits.has(ref) ? ref : null);
      if (!sha) throw failure("NotFound", { what: ref });
      const tree = commits.get(sha);
      // The graph of every commit is stored on trace-cache, as the workflow "main changed" stores it (tests/stored-graph-fake.mjs).
      return withStoredGraph({
        repository: { server: "github", origin: "https://github.com", path: "org/product", web: "https://github.com/org/product" },
        ref, commit: sha, paths: [...tree.keys()],
        read: async (path) => (tree.has(path) ? tree.get(path) : null),
        blob: (path) => (tree.has(path) ? blobSha(tree.get(path)) : null),
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
      calls.push({ fn: "commitFiles", change: structuredClone(change) });
      const head = branches.get(change.branch);
      if (head !== change.expectedHead) throw failure("Moved", { head });
      const files = Object.fromEntries(commits.get(head));
      for (const f of change.files) files[f.path] = f.text;
      const sha = makeCommit(files);
      branches.set(change.branch, sha);
      return { commit: sha, url: `https://github.com/org/product/commit/${sha}` };
    },
  };
}

// A fixture snapshot (MOD-repository-hosts' Snapshot) over a plain object of files — for releaseReport's `at` and
// `results`, which this item's functions never write through. With `commit`, the branch trace-cache holds the graph of these files as that
// commit's, as the workflow "main changed" stores it (tests/stored-graph-fake.mjs); MOD-trace-graph's storedGraph keeps a commit's graph, so two
// snapshots of different files are given different commits.
function fixtureSnapshot(files, commit = null) {
  const read = async (path) => (Object.hasOwn(files, path) ? files[path] : null);
  return {
    paths: Object.keys(files),
    blob: (path) => (Object.hasOwn(files, path) ? blobSha(files[path]) : null),
    read,
    ...(commit ? { readOn: storedGraphReadOn({ paths: Object.keys(files), read, commit }) } : {}),
  };
}

const WORKFLOW_PATH = ".github/workflows/agent-m-jobs.yml";
const SCHEDULE_PATH = "docs/tests/schedule.md";

// A product's schedule.md (schedule.schema.md): the six rows, each row's "runs on" from `runsOn` (by level), defaults
// empty — valid and ticked for release candidate throughout, as default-schedule.md is.
function scheduleText(runsOn = {}) {
  const rows = ["unit", "component", "system", "paid", "release", "user"]
    .map((level) => `| ${level} | ✓ | ✓ | ✓ | ✓ | ✓ | ${runsOn[level] ?? ""} |`);
  return ["---", "nightly: 02:00", "---", "## Levels", "", "| Row | every commit | pull request | nightly | release candidate | on demand | runs on |",
    "|---|---|---|---|---|---|---|", ...rows, ""].join("\n");
}

// ================================================================== nextVersion

// TST-472466 · level: unit · module: MOD-release-evidence
// guards: CALENDAR VERSIONS; EVERY PRODUCT HAS ITS OWN VERSION LINE
// given: this product's own release tags v2026.3.0 and v2026.3.1, and its own candidate tag v2026.3.1-rc.2, today 2026-10-07
// input: nextVersion(tags, "minor", today)
// expect: 2026.4.0 — the candidate tag is not a release and is passed over (from the product's own tags only)
test("nextVersion — a minor step by default, from the product's own release tags only", () => {
  const tags = ["v2026.3.0", "v2026.3.1", "v2026.3.1-rc.2"];
  assert.equal(nextVersion(tags, "minor", "2026-10-07"), "2026.4.0");
});

// TST-472467 · level: unit · module: MOD-release-evidence
// guards: CALENDAR VERSIONS
// given: the same tags, today 2026-10-07
// input: nextVersion(tags, "patch", today)
// expect: 2026.3.2 — the minor stays, the patch steps
test("nextVersion — a patch step keeps the minor and steps the patch", () => {
  const tags = ["v2026.3.0", "v2026.3.1"];
  assert.equal(nextVersion(tags, "patch", "2026-10-07"), "2026.3.2");
});

// TST-472468 · level: unit · module: MOD-release-evidence
// guards: CALENDAR VERSIONS
// given: the latest release tag v2025.9.3, today 2026-01-05 — the year changed since the last release
// input: nextVersion(tags, "minor", today), and again with "patch"
// expect: 2026.1.0 both times — the new year overrides the step asked (1a)
// counter-proof: planting `if (!latest || latest.year !== year) return step === "patch" ? ... : ...;` (mixing in the
//                step on a new year) in version.mjs fails this test's second assertion
test("nextVersion — YYYY.1.0 in a new year, whatever step is asked (1a)", () => {
  const tags = ["v2025.9.3"];
  assert.equal(nextVersion(tags, "minor", "2026-01-05"), "2026.1.0");
  assert.equal(nextVersion(tags, "patch", "2026-01-05"), "2026.1.0");
});

// TST-472469 · level: unit · module: MOD-release-evidence
// guards: CALENDAR VERSIONS
// given: no release tag at all
// input: nextVersion([], "minor", "2026-10-07")
// expect: 2026.1.0 — a product with nothing to bump starts its line the same way a new year does
test("nextVersion — a product with no release tag yet starts at YYYY.1.0", () => {
  assert.equal(nextVersion([], "minor", "2026-10-07"), "2026.1.0");
});

// ================================================================== startReleaseCandidate

const CANDIDATE_VERSION = "2026.4.0";
const PARTICIPANT_IMPLEMENTER = "developer-sonnet-b";
const PARTICIPANT_RUNNER = "developer-sonnet-e";

function jobRecordText({ id, kind, participant, worksOn }) {
  return ["---", `id: ${id}`, `kind: ${kind}`, "works_on:", ...worksOn.map((w) => `  - ${w}`),
    `participant: ${participant}`, "route: tab", "started_by: po-opus", "start: 2026-10-01 09:00 UTC",
    "agent_m: 2026.9.0, commit aaaaaaaaaaaa", "limit: 5", "---", "## Destinations", "",
    `- ${participant}, at this machine: the item.`, "", "## Parameters", "", "```json", "{}", "```", "",
  ].join("\n");
}

function candidateHost({ runsOn, tags = {}, jobs = {} } = {}) {
  const branchFiles = {
    [WORKFLOW_PATH]: "name: Agent M jobs\n",
    [SCHEDULE_PATH]: scheduleText(runsOn),
    ...Object.fromEntries(Object.entries(jobs).map(([id, job]) => [`docs/jobs/${id}.md`, jobRecordText({ id, ...job })])),
  };
  return fakeHost({ defaultBranch: "main", branchFiles, extraCommits: { candidate: { ...branchFiles } }, tags });
}

const CANDIDATE_RUNNERS = { release: PARTICIPANT_RUNNER, user: PARTICIPANT_RUNNER };

// TST-472470 · level: unit · module: MOD-release-evidence
// guards: A RELEASE RUNS EVERY TEST AT EVERY LEVEL
// given: a product with no release candidate tagged yet, its schedule naming a runner for "release" and "user", one prior implement job by a different participant
// input: startReleaseCandidate(host, "2026.4.0", <candidate commit>, "a changelog entry", "akmaier")
// expect: candidate "v2026.4.0-rc.1" (the next free N, here 1); a commitFiles call queuing the run (MOD-job-ledger's own record format), whose "## Parameters" json names the candidate's version, tag and commit and keeps the changelog entry given
test("startReleaseCandidate — the next free N, and the complete run queued with the candidate's version, tag and changelog entry", async () => {
  const host = candidateHost({
    runsOn: CANDIDATE_RUNNERS,
    jobs: { "JOB-20261001-0900-aaaa": { kind: "implement", participant: PARTICIPANT_IMPLEMENTER, worksOn: ["ITM-200"] } },
  });
  const result = await startReleaseCandidate(host, CANDIDATE_VERSION, host.shaOf.candidate, "a changelog entry", "akmaier");
  assert.equal(result.candidate, "v2026.4.0-rc.1");
  assert.ok(typeof result.run === "string" && result.run.length > 0);
  const queued = host.calls.find((c) => c.fn === "commitFiles");
  assert.ok(queued, "the job's start record is committed");
  const [{ text }] = queued.change.files;
  assert.match(text, /"version": "2026\.4\.0"/);
  assert.match(text, /"tag": "v2026\.4\.0-rc\.1"/);
  assert.match(text, /a changelog entry/);
});

// TST-472471 · level: unit · module: MOD-release-evidence
// guards: A RELEASE RUNS EVERY TEST AT EVERY LEVEL
// given: the product already carries v2026.4.0-rc.1 and v2026.4.0-rc.3 (not rc.2)
// input: startReleaseCandidate(host, "2026.4.0", commit, "entry", "akmaier")
// expect: candidate "v2026.4.0-rc.4" — the greatest existing N plus one, not the first free gap
test("startReleaseCandidate — the next free N is the greatest existing one plus one", async () => {
  const host = candidateHost({
    runsOn: CANDIDATE_RUNNERS,
    tags: { "v2026.4.0-rc.1": "default", "v2026.4.0-rc.3": "default" },
  });
  const result = await startReleaseCandidate(host, CANDIDATE_VERSION, host.shaOf.candidate, "entry", "akmaier");
  assert.equal(result.candidate, "v2026.4.0-rc.4");
});

// TST-472472 · level: unit · module: MOD-release-evidence
// guards: A VERSION IS NOT REWRITTEN
// given: v2026.4.0-rc.1 already tagged on a commit other than the one given now (the rare race of two concurrent clicks naming the same N)
// input: startReleaseCandidate with a host whose createTag always refuses with TagExists for that exact name
// expect: rejects with name TagExists
// counter-proof: planting `try { await host.createTag(...) } catch {}` (swallowing the failure) in candidate.mjs fails
//                this test's assert.rejects
test("startReleaseCandidate — TagExists propagates from the host's createTag", async () => {
  const host = candidateHost({ runsOn: CANDIDATE_RUNNERS });
  const real = host.createTag.bind(host);
  host.createTag = async (name, commit) => { throw failure("TagExists", { commit: "deadbeef" }); };
  await assert.rejects(
    () => startReleaseCandidate(host, CANDIDATE_VERSION, host.shaOf.candidate, "entry", "akmaier"),
    (error) => error.name === "TagExists",
  );
  void real;
});

// TST-472473 · level: unit · module: MOD-release-evidence
// guards: A RELEASE RUNS EVERY TEST AT EVERY LEVEL
// given: a schedule whose "user" row names no one ("release" does)
// input: startReleaseCandidate(host, ...)
// expect: rejects NoRunner, naming the level "user"
// counter-proof: planting `if (level !== "release" && level !== "user")` as `if (level !== "user")` (dropping the
//                "release"-only guard so "release" row is also checked here, double-reporting) still names "user"
//                first in this fixture and would pass; instead planting the loop to `continue` unconditionally before
//                the empty-runner check fails this test, since no NoRunner is ever thrown
test("startReleaseCandidate — NoRunner naming a person-run level the schedule names no one for", async () => {
  const host = candidateHost({ runsOn: { release: PARTICIPANT_RUNNER } }); // user: left out
  await assert.rejects(
    () => startReleaseCandidate(host, CANDIDATE_VERSION, host.shaOf.candidate, "entry", "akmaier"),
    (error) => error.name === "NoRunner" && error.level === "user",
  );
});

// TST-472474 · level: unit · module: MOD-release-evidence
// guards: RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER
// given: the schedule's "release" row names PARTICIPANT_IMPLEMENTER; every recorded implement job also names PARTICIPANT_IMPLEMENTER — no other participant has ever implemented anything
// input: startReleaseCandidate(host, ...)
// expect: rejects NoRunner naming "release" — only the implementer could run the release tests (2a)
// counter-proof: planting `implementers.size > 0` as `implementers.size > 1` in candidate.mjs's checkRunners fails
//                this test's assert.rejects (one implementer, as here, would no longer be caught)
test("startReleaseCandidate — NoRunner naming \"release\" where only the implementer could run the release tests (2a)", async () => {
  const host = candidateHost({
    runsOn: { release: PARTICIPANT_IMPLEMENTER, user: PARTICIPANT_RUNNER },
    jobs: {
      "JOB-20261001-0900-aaaa": { kind: "implement", participant: PARTICIPANT_IMPLEMENTER, worksOn: ["ITM-200"] },
      "JOB-20261002-0900-bbbb": { kind: "implement", participant: PARTICIPANT_IMPLEMENTER, worksOn: ["ITM-201"] },
    },
  });
  await assert.rejects(
    () => startReleaseCandidate(host, CANDIDATE_VERSION, host.shaOf.candidate, "entry", "akmaier"),
    (error) => error.name === "NoRunner" && error.level === "release",
  );
});

// TST-472475 · level: unit · module: MOD-release-evidence
// guards: RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER
// given: the schedule's "release" row names PARTICIPANT_RUNNER, who differs from the recorded implementer
// input: startReleaseCandidate(host, ...)
// expect: resolves (no NoRunner) — a known positive beside the counter-proof above, since a negative result (no rejection) is otherwise unverified (CLAUDE.md §6a Nr. 2)
test("startReleaseCandidate — no NoRunner where the release row's runner differs from every recorded implementer", async () => {
  const host = candidateHost({
    runsOn: CANDIDATE_RUNNERS,
    jobs: { "JOB-20261001-0900-aaaa": { kind: "implement", participant: PARTICIPANT_IMPLEMENTER, worksOn: ["ITM-200"] } },
  });
  const result = await startReleaseCandidate(host, CANDIDATE_VERSION, host.shaOf.candidate, "entry", "akmaier");
  assert.equal(result.candidate, "v2026.4.0-rc.1");
});

// ================================================================== releaseReport

const CANDIDATE_COMMIT = "c".repeat(40);
const SPEC_TEXT = ["# Fixture product — Specification", "", "## Section", "",
  "**A SAMPLE REQUIREMENT** *(Product Owner)*", "A sample rule.", "*Check:* `tests/sample.test.mjs`", ""].join("\n");
const TEST_FILE = ["// TST-001", "// level: unit", "// guards: A SAMPLE REQUIREMENT", ""].join("\n");

function runRecord({ commit, rows }) {
  const table = ["| Test | Level | Outcome | Runs |", "|---|---|---|---|", ...rows.map((r) => `| ${r.join(" | ")} |`)].join("\n");
  return ["---", `commit: ${commit}`, "levels:", "  - unit", "occasion: release-candidate", "participant: ci",
    "date: 2026-10-07 10:00 UTC", "---", "## Outcomes", "", table, ""].join("\n");
}

// TST-472476 · level: unit · module: MOD-release-evidence
// guards: UC-013; A RELEASE RUNS EVERY TEST AT EVERY LEVEL
// given: a repository holding SPEC.md (one requirement) and one test file (TST-001, guarding it), and a result record of the candidate's commit where TST-001 passed
// input: releaseReport(at, results, { version, tag, commit, changelog })
// expect: the text holds every part in the module's own order — "## Limitations" first, then "## Levels", "## Tests", "## Requirements", "## Changelog entry" —; Limitations empty (the run is green); complete true; failing and worse both empty
test("releaseReport — its parts in the module's own order, Limitations first, complete and green", async () => {
  const at = fixtureSnapshot({ "SPEC.md": SPEC_TEXT, "tests/sample.test.mjs": TEST_FILE }, CANDIDATE_COMMIT);
  const results = fixtureSnapshot({
    [`runs/${CANDIDATE_COMMIT}/20261007-1000-release-candidate-aaaa.md`]: runRecord({ commit: CANDIDATE_COMMIT, rows: [["TST-001", "unit", "passed", ""]] }),
  });
  const candidate = { version: "2026.4.0", tag: "v2026.4.0-rc.1", commit: CANDIDATE_COMMIT, changelog: "Adds the sample feature." };
  const { text, complete, failing, worse } = await releaseReport(at, results, candidate);
  const order = ["## Limitations", "## Levels", "## Tests", "## Requirements", "## Changelog entry"].map((h) => text.indexOf(h));
  assert.ok(order.every((i) => i >= 0), "every part stands in the text");
  assert.deepEqual(order, order.slice().sort((a, b) => a - b), "in the module's own order, Limitations first");
  assert.equal(complete, true);
  assert.deepEqual(failing, []);
  assert.deepEqual(worse, []);
  assert.match(text, /A SAMPLE REQUIREMENT/);
  assert.match(text, /TST-001/);
  assert.match(text, /Adds the sample feature\./);
});

// TST-472477 · level: unit · module: MOD-release-evidence
// guards: A RELEASE RUNS EVERY TEST AT EVERY LEVEL
// given: the same repository, but the branch test-results holds no record of the candidate's commit at all
// input: releaseReport(at, results, candidate)
// expect: complete false — a test that has not run on the candidate's commit leaves the report incomplete
// counter-proof: planting `let complete = false;` as the initial value (never set back from the "not run" condition,
//                always false) would pass this one alone; instead planting `if (t.outcome === "not run") complete =
//                true;` (inverted) in report.mjs fails this test's assert.equal
test("releaseReport — incomplete while a test has not run on the candidate's commit", async () => {
  const at = fixtureSnapshot({ "SPEC.md": SPEC_TEXT, "tests/sample.test.mjs": TEST_FILE }, CANDIDATE_COMMIT);
  const results = fixtureSnapshot({});
  const candidate = { version: "2026.4.0", tag: "v2026.4.0-rc.1", commit: CANDIDATE_COMMIT, changelog: "Entry." };
  const { complete } = await releaseReport(at, results, candidate);
  assert.equal(complete, false);
});

const LAST_RELEASE_COMMIT = "e".repeat(40);
// The candidate of the rate case holds other files than CANDIDATE_COMMIT's, so it is a commit of its own.
const RATE_CANDIDATE_COMMIT = "d".repeat(40);
const RATE_TEST_FILE = ["// TST-010", "// level: unit", "// guards: A SAMPLE REQUIREMENT", "// runs: 10", "// phrasings: 2", ""].join("\n");

function lastReleaseReportText(commit) {
  return ["---", "version: 2026.3.0", "candidate: v2026.3.0-rc.1", `commit: ${commit}`, "date: 2026-09-01", "---",
    "## Limitations", "", "## Levels", "", "| Level | Passed | Failed | Flaky | Not run |", "|---|---|---|---|---|",
    "| unit | 1 | 0 | 0 | 0 |", "", "## Tests", "",
    "| Test | Level | Outcome | Guards |", "|---|---|---|---|", "| TST-010 | unit | 8 of 10 | A SAMPLE REQUIREMENT |", "",
    "## Requirements", "", "| Requirement | Level | Tests | Outcome |", "|---|---|---|---|",
    "| A SAMPLE REQUIREMENT | unit | TST-010 | passed |", "", "## Changelog entry", "", "Earlier release.", "",
  ].join("\n");
}

// TST-472478 · level: unit · module: MOD-release-evidence
// guards: A MODEL-DEPENDENT TEST IS MEASURED AS A RATE
// given: `at` (the candidate's own commit) already holds the last release's own report, docs/tests/releases/ v2026.3.0.md, naming its tested commit LAST_RELEASE_COMMIT; the branch test-results records TST-010 at "8 of 10" on LAST_RELEASE_COMMIT and "6 of 10" on the candidate's commit
// input: releaseReport(at, results, { version: "2026.4.0", ... })
// expect: "## Limitations" names TST-010 rate — the last release's commit is read from the report `at` already holds, not left null
// counter-proof: planting `const lastRelease = null;` (ignoring the report `at` holds) in report.mjs fails this
//                test's assert.match
test("releaseReport — a worse model-dependent rate is read against the last release's commit, found in the report `at` already holds", async () => {
  const at = fixtureSnapshot({
    "SPEC.md": SPEC_TEXT, "tests/rate.test.mjs": RATE_TEST_FILE,
    "docs/tests/releases/v2026.3.0.md": lastReleaseReportText(LAST_RELEASE_COMMIT),
  }, RATE_CANDIDATE_COMMIT);
  const results = fixtureSnapshot({
    [`runs/${LAST_RELEASE_COMMIT}/20260901-1000-release-candidate-aaaa.md`]: runRecord({ commit: LAST_RELEASE_COMMIT, rows: [["TST-010", "unit", "passed", "8 of 10"]] }),
    [`runs/${RATE_CANDIDATE_COMMIT}/20261007-1000-release-candidate-bbbb.md`]: runRecord({ commit: RATE_CANDIDATE_COMMIT, rows: [["TST-010", "unit", "failed", "6 of 10"]] }),
  });
  const candidate = { version: "2026.4.0", tag: "v2026.4.0-rc.1", commit: RATE_CANDIDATE_COMMIT, changelog: "Entry." };
  const { text, worse } = await releaseReport(at, results, candidate);
  assert.deepEqual(worse, ["TST-010"]);
  const limitations = text.slice(text.indexOf("## Limitations"), text.indexOf("## Levels"));
  assert.match(limitations, /TST-010/);
});

// ================================================================== acceptAndRelease
//
// acceptAndRelease recomputes the report itself (releaseReport, above) from the host alone: the candidate's own tag,
// the branch test-results, and the run-tests job that carries the changelog entry. A fixture host therefore holds a
// candidate commit (SPEC.md and test files), its tag, a test-results branch with its run records, and a run-tests
// job record naming the candidate and the changelog — never a report committed ahead of time (po-opus's rejection of
// #200, gate docs/gates/20261007-2016-development-release-testing-45b3.md). The blob a test passes in as `report.blob`
// is always the one releaseReport's own output hashes to, computed here the same way acceptAndRelease computes it, so
// that a test fixture is never out of step with the module's own canonical text.

const ACCEPT_VERSION = "2026.4.0";
const ACCEPT_TAG = "v2026.4.0-rc.1";
const ACCEPT_PATH = `docs/tests/releases/v${ACCEPT_VERSION}.md`;
const MULTI_TEST_FILE = [
  "// TST-001", "// level: unit", "// guards: A SAMPLE REQUIREMENT", "",
  "// TST-002", "// level: unit", "// guards: A SAMPLE REQUIREMENT", "",
  "// TST-010", "// level: unit", "// guards: A SAMPLE REQUIREMENT", "// runs: 10", "// phrasings: 2", "",
].join("\n");

function runTestsJobText({ id, tag, version, commit, changelog }) {
  return ["---", `id: ${id}`, "kind: run-tests", "works_on:", `  - ${commit}`, "participant:", "model:",
    "route: ci hosted", "run:", "retries:", "started_by: akmaier", "start: 2026-10-07 20:00 UTC",
    "agent_m: unknown, commit unknown", "limit: 1", "---", "## Destinations", "", "", "## Parameters", "",
    "```json", JSON.stringify({ candidate: { version, tag, commit }, changelog }, null, 2), "```", "",
  ].join("\n");
}

// A fixture host for acceptAndRelease: the candidate's own commit (SPEC.md and the given test files, plus any extra
// files such as a last release's own report), tagged ACCEPT_TAG; the branch test-results with the candidate's own
// run record (runsRows) and any extra records given (an earlier release's, for a rate comparison); the default
// branch with CHANGELOG.md and the run-tests job naming the candidate and the changelog. The candidate's own commit
// is read back from the host once fakeHost has made it (shaOf.candidate, a real git-style SHA fakeHost computes, not
// a fixed fixture constant), since the job record and the result records must name that exact commit.
function acceptHost({ testFiles = { "tests/sample.test.mjs": TEST_FILE }, extraAtFiles = {}, runsRows,
  extraResultsFiles = {}, changelog = "Adds the sample feature.", tags = {} } = {}) {
  const host = fakeHost({
    defaultBranch: "main",
    branchFiles: { "CHANGELOG.md": "# Changelog\n" },
    extraCommits: { candidate: { "SPEC.md": SPEC_TEXT, ...testFiles, ...extraAtFiles } },
    tags: { [ACCEPT_TAG]: "candidate", ...tags },
  });
  const commit = host.shaOf.candidate;
  const jobId = "JOB-20261007-2000-f00d";
  host.land({ [`docs/jobs/${jobId}.md`]: runTestsJobText({ id: jobId, tag: ACCEPT_TAG, version: ACCEPT_VERSION, commit, changelog }) });
  host.addBranch("test-results", {
    [`runs/${commit}/20261007-1000-release-candidate-aaaa.md`]: runRecord({ commit, rows: runsRows }),
    ...extraResultsFiles,
  });
  return host;
}

// The blob acceptAndRelease would recompute for this fixture's own candidate, results and changelog — what a test
// passes in as the report it was shown, computed the same way (releaseReport), never hand-written.
async function acceptBlob(host, changelog) {
  const at = await host.readSnapshot(ACCEPT_TAG);
  const results = await host.readSnapshot("test-results");
  const { text } = await releaseReport(at, results, { version: ACCEPT_VERSION, tag: ACCEPT_TAG, commit: at.commit, changelog });
  return blobSha(text);
}

// TST-472479 · level: unit · module: MOD-release-evidence
// guards: THE RELEASE TEST REPORT IS ACCEPTED BY A PERSON; ACCEPTING THE RELEASE TEST REPORT RELEASES; A RELEASE IS TAGGED AND LOGGED
// given: a green, complete candidate (TST-001 passed); the default branch moves on (an unrelated commit lands) after the report's blob was shown and before Accept and release is clicked
// input: acceptAndRelease(host, { path, blob }, { limitations: {} }, "akmaier", "2026-10-07")
// expect: resolves with a commit and tag "v2026.4.0"; the tag stands on the candidate's own tested commit, not the just-made commit or the moved branch's new head (4b); the ONE commit holds the report's own text at ACCEPT_PATH together with the approval record and the changelog entry
// counter-proof: committing only the approval record and the changelog entry, leaving the report's own file out of
//                `files` (the defect po-opus's rejection names), fails this test's assert.ok(after.paths.includes(...))
test("acceptAndRelease — one commit of the report, its approval record and the changelog entry, then the tag on the candidate's own commit, also when the default branch moved on (4b)", async () => {
  const host = acceptHost({ runsRows: [["TST-001", "unit", "passed", ""]] });
  const blob = await acceptBlob(host, "Adds the sample feature.");
  host.land({ "README.md": "unrelated change\n" }); // the default branch moved on since the report was shown
  const { commit, tag } = await acceptAndRelease(host, { path: ACCEPT_PATH, blob }, { limitations: {} }, "akmaier", "2026-10-07");
  assert.equal(tag, "v2026.4.0");
  assert.ok(commit);
  assert.equal(host.tagOf("v2026.4.0"), host.shaOf.candidate, "the tag stands on the candidate's own tested commit");
  const after = await host.readSnapshot("main");
  assert.ok(after.paths.includes(ACCEPT_PATH), "the report's own text was committed, in the same commit");
  assert.match(await after.read(ACCEPT_PATH), /commit: [0-9a-f]{40}/);
  assert.match(await after.read("CHANGELOG.md"), /## v2026\.4\.0 — 2026-10-07/);
  assert.match(await after.read("CHANGELOG.md"), /Adds the sample feature\./);
  const approvalPath = [...after.paths].find((p) => p.startsWith("docs/approvals/release-v2026.4.0-"));
  assert.ok(approvalPath, "the approval record was committed");
  assert.match(await after.read(approvalPath), /kind: release-report/);
});

// TST-472480 · level: unit · module: MOD-release-evidence
// guards: A RED RELEASE IS ACCEPTED ONLY WITH ITS LIMITATIONS RECORDED
// given: a candidate with a failing test (TST-002) and a model-dependent test (TST-010) whose rate, 6 of 10, is worse than the last release's own report names (8 of 10) — that report already stands in the candidate's own commit, under docs/tests/releases/
// input: acceptAndRelease(host, { path, blob }, { limitations: {} }, "akmaier", "2026-10-07")
// expect: rejects LimitationMissing, naming both TST-002 and TST-010 (3a, 3b)
// counter-proof: planting `const missing = [];` in report.mjs's acceptAndRelease (nothing ever missing) fails this
//                test's assert.rejects
test("acceptAndRelease — LimitationMissing naming each failing test and worse rate without its reason (3a, 3b)", async () => {
  const host = acceptHost({
    testFiles: { "tests/sample.test.mjs": MULTI_TEST_FILE },
    extraAtFiles: { "docs/tests/releases/v2026.3.0.md": lastReleaseReportText(LAST_RELEASE_COMMIT) },
    runsRows: [["TST-001", "unit", "passed", ""], ["TST-002", "unit", "failed", ""], ["TST-010", "unit", "passed", "6 of 10"]],
    extraResultsFiles: {
      [`runs/${LAST_RELEASE_COMMIT}/20260901-1000-release-candidate-aaaa.md`]: runRecord({ commit: LAST_RELEASE_COMMIT, rows: [["TST-010", "unit", "passed", "8 of 10"]] }),
    },
  });
  const blob = await acceptBlob(host, "Adds the sample feature.");
  await assert.rejects(
    () => acceptAndRelease(host, { path: ACCEPT_PATH, blob }, { limitations: {} }, "akmaier", "2026-10-07"),
    (error) => error.name === "LimitationMissing" && error.tests.includes("TST-002") && error.tests.includes("TST-010"),
  );
});

// TST-472481 · level: unit · module: MOD-release-evidence
// guards: A RED RELEASE IS ACCEPTED ONLY WITH ITS LIMITATIONS RECORDED
// given: the same candidate, now with a reason recorded for both
// input: acceptAndRelease(host, { path, blob }, { limitations: { "TST-002": "known flaky fixture", "TST-010": "model drift (accepted)" } }, ...)
// expect: resolves (no LimitationMissing) — the known positive beside the rejection above
test("acceptAndRelease — resolves once every failing test and worse rate has its reason recorded", async () => {
  const host = acceptHost({
    testFiles: { "tests/sample.test.mjs": MULTI_TEST_FILE },
    extraAtFiles: { "docs/tests/releases/v2026.3.0.md": lastReleaseReportText(LAST_RELEASE_COMMIT) },
    runsRows: [["TST-001", "unit", "passed", ""], ["TST-002", "unit", "failed", ""], ["TST-010", "unit", "passed", "6 of 10"]],
    extraResultsFiles: {
      [`runs/${LAST_RELEASE_COMMIT}/20260901-1000-release-candidate-aaaa.md`]: runRecord({ commit: LAST_RELEASE_COMMIT, rows: [["TST-010", "unit", "passed", "8 of 10"]] }),
    },
  });
  const blob = await acceptBlob(host, "Adds the sample feature.");
  const decision = { limitations: { "TST-002": "known flaky fixture", "TST-010": "model drift (accepted)" } };
  const { tag } = await acceptAndRelease(host, { path: ACCEPT_PATH, blob }, decision, "akmaier", "2026-10-07");
  assert.equal(tag, "v2026.4.0");
});

// TST-472482 · level: unit · module: MOD-release-evidence
// guards: A RELEASE RUNS EVERY TEST AT EVERY LEVEL
// given: a candidate whose test-results branch holds no record of TST-001 at all
// input: acceptAndRelease(host, { path, blob }, { limitations: {} }, ...)
// expect: rejects Incomplete
// counter-proof: planting `if (complete)` in place of `if (!complete)` in report.mjs's acceptAndRelease fails this
//                test's assert.rejects
test("acceptAndRelease — Incomplete while a test has not run on the candidate's commit", async () => {
  const host = acceptHost({ runsRows: [] });
  const blob = await acceptBlob(host, "Adds the sample feature.");
  await assert.rejects(
    () => acceptAndRelease(host, { path: ACCEPT_PATH, blob }, { limitations: {} }, "akmaier", "2026-10-07"),
    (error) => error.name === "Incomplete",
  );
});

// TST-472483 · level: unit · module: MOD-release-evidence
// guards: A VERSION IS NOT REWRITTEN
// given: a green, complete candidate, but v2026.4.0 already stands as a tag (on a commit other than the candidate's)
// input: acceptAndRelease(host, { path, blob }, { limitations: {} }, ...)
// expect: rejects TagExists; the existing tag still names its original commit, not moved (4a)
// counter-proof: removing the listTags precheck and swallowing the final createTag's error (both — the host's own
//                createTag would otherwise still refuse) fails this test's assert.rejects
test("acceptAndRelease — TagExists, an existing tag not moved (4a)", async () => {
  const host = acceptHost({ runsRows: [["TST-001", "unit", "passed", ""]], tags: { "v2026.4.0": "default" } });
  const originalTagCommit = host.tagOf("v2026.4.0");
  const blob = await acceptBlob(host, "Adds the sample feature.");
  await assert.rejects(
    () => acceptAndRelease(host, { path: ACCEPT_PATH, blob }, { limitations: {} }, "akmaier", "2026-10-07"),
    (error) => error.name === "TagExists",
  );
  assert.equal(host.tagOf("v2026.4.0"), originalTagCommit, "the existing tag was not moved");
});

// TST-472484 · level: unit · module: MOD-release-evidence
// guards: UC-047; A PERSON IS TOLD WHAT WAITS FOR THEIR ACCEPTANCE
// given: the newest candidate tag and its run-tests record, first without an End, then with End state done
// input: reportsAwaitingAcceptance(host, snapshot)
// expect: no report while the run has not ended; its version, candidate, record and record blob after it ends done; no report after the release report exists
test("reportsAwaitingAcceptance — a candidate's complete run waits, but an unfinished or accepted one does not", async () => {
  const path = "docs/jobs/JOB-20261008-0900-aaaa.md";
  const base = ["---", "id: JOB-20261008-0900-aaaa", "kind: run-tests", "works_on:", "  - aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "route: ci hosted", "started_by: akmaier", "start: 2026-10-08 09:00 UTC", "agent_m: unknown, commit unknown", "limit: 1", "---",
    "## Destinations", "", "## Parameters", "", "```json",
    '{"candidate":{"version":"2026.4.0","tag":"v2026.4.0-rc.1","commit":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}}', "```", ""].join("\n");
  const host = { listTags: async () => [{ name: "v2026.4.0-rc.1", commit: "a".repeat(40) }] };
  const snapshot = fixtureSnapshot({ [path]: `${base}\n## End\n\nat: 2026-10-08 10:00 UTC\nstate: done\n` });
  assert.equal(await reportsAwaitingAcceptance(host, fixtureSnapshot({ [path]: base })), null);
  assert.deepEqual(await reportsAwaitingAcceptance(host, snapshot), {
    version: "2026.4.0", candidate: "v2026.4.0-rc.1", record: path, blob: snapshot.blob(path),
  });
  const accepted = fixtureSnapshot({ [path]: `${base}\n## End\n\nat: 2026-10-08 10:00 UTC\nstate: done\n`,
    "docs/tests/releases/v2026.4.0.md": "accepted report" });
  assert.equal(await reportsAwaitingAcceptance(host, accepted), null);
});

// TST-472485 · level: unit · module: MOD-release-evidence
// guards: UC-047; A PERSON IS TOLD WHAT WAITS FOR THEIR ACCEPTANCE
// given: completed candidates in calendar versions 2026.9.0 and 2026.10.0, where only the latter's run is newest
// input: reportsAwaitingAcceptance(host, snapshot)
// expect: the 2026.10.0 report waits; numeric calendar components, not lexical text, decide newest
test("reportsAwaitingAcceptance — calendar version 2026.10.0 is newer than 2026.9.0", async () => {
  const path = "docs/jobs/JOB-20261010-0900-bbbb.md";
  const text = ["---", "id: JOB-20261010-0900-bbbb", "kind: run-tests", "works_on:", "  - bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    "route: ci hosted", "started_by: akmaier", "start: 2026-10-10 09:00 UTC", "agent_m: unknown, commit unknown", "limit: 1", "---",
    "## Destinations", "", "## Parameters", "", "```json",
    '{"candidate":{"version":"2026.10.0","tag":"v2026.10.0-rc.1","commit":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"}}', "```", "",
    "## End", "", "at: 2026-10-10 10:00 UTC", "state: done", ""].join("\n");
  const snapshot = fixtureSnapshot({ [path]: text });
  const host = { listTags: async () => [
    { name: "v2026.9.0-rc.1", commit: "a".repeat(40) }, { name: "v2026.10.0-rc.1", commit: "b".repeat(40) },
  ] };
  assert.deepEqual(await reportsAwaitingAcceptance(host, snapshot), {
    version: "2026.10.0", candidate: "v2026.10.0-rc.1", record: path, blob: snapshot.blob(path),
  });
});

// ================================================================== the approval record's limitation lines (ITM-934)

// The approval record that acceptAndRelease committed for the fixture's release, read back from the default branch.
async function approvalRecordOf(host) {
  const after = await host.readSnapshot("main");
  const path = [...after.paths].find((p) => p.startsWith("docs/approvals/release-v2026.4.0-"));
  assert.ok(path, "the approval record was committed");
  return { after, path, text: await after.read(path) };
}

// TST-934001 · level: unit · module: MOD-release-evidence
// guards: A RED RELEASE IS ACCEPTED ONLY WITH ITS LIMITATIONS RECORDED; ACCEPTING THE RELEASE TEST REPORT RELEASES
// given: a green, complete candidate (TST-001 passed), no failing test and no worse rate
// input: acceptAndRelease(host, { path, blob }, { limitations: {} }, "akmaier", "2026-10-07"), then the approval record read back from the default branch
// expect: the record is exactly the three lines kind, file and blob; it holds no line that begins with `limitation` (MOD-approvals: `limitation` is "one line per failing test or worse rate ... zero or more", so none for a green release)
// counter-proof: passing `limitation: []` again in report.mjs's writeDocument call writes the line `limitation:` and fails this test
test("TST-934001 acceptAndRelease — the approval record of a green release holds no limitation line", async () => {
  const host = acceptHost({ runsRows: [["TST-001", "unit", "passed", ""]] });
  const blob = await acceptBlob(host, "Adds the sample feature.");
  await acceptAndRelease(host, { path: ACCEPT_PATH, blob }, { limitations: {} }, "akmaier", "2026-10-07");
  const { text } = await approvalRecordOf(host);
  assert.equal(text, `kind: release-report\nfile: ${ACCEPT_PATH}\nblob: ${blob}\n`);
  assert.equal(text.split("\n").filter((line) => line.startsWith("limitation")).length, 0);
});

// TST-934002 · level: unit · module: MOD-release-evidence
// guards: A RED RELEASE IS ACCEPTED ONLY WITH ITS LIMITATIONS RECORDED
// given: a candidate with a failing test (TST-002) and a model-dependent test (TST-010) whose rate, 6 of 10, is worse than the last release's 8 of 10; a reason recorded for each
// input: acceptAndRelease(host, { path, blob }, { limitations: { "TST-002": ..., "TST-010": ... } }, ...), then the approval record read back
// expect: exactly two `limitation:` lines, in the order of the identifiers, each `<id> — <reason>`; read back through approvalSchema, the two items
// counter-proof: omitting the key whenever `ids` is not empty (the fix applied one condition too wide) fails this test's line count
test("TST-934002 acceptAndRelease — a red release's record holds one limitation line per failing test and worse rate", async () => {
  const host = acceptHost({
    testFiles: { "tests/sample.test.mjs": MULTI_TEST_FILE },
    extraAtFiles: { "docs/tests/releases/v2026.3.0.md": lastReleaseReportText(LAST_RELEASE_COMMIT) },
    runsRows: [["TST-001", "unit", "passed", ""], ["TST-002", "unit", "failed", ""], ["TST-010", "unit", "passed", "6 of 10"]],
    extraResultsFiles: {
      [`runs/${LAST_RELEASE_COMMIT}/20260901-1000-release-candidate-aaaa.md`]: runRecord({ commit: LAST_RELEASE_COMMIT, rows: [["TST-010", "unit", "passed", "8 of 10"]] }),
    },
  });
  const blob = await acceptBlob(host, "Adds the sample feature.");
  const decision = { limitations: { "TST-002": "known flaky fixture", "TST-010": "model drift, accepted" } };
  await acceptAndRelease(host, { path: ACCEPT_PATH, blob }, decision, "akmaier", "2026-10-07");
  const { text, path } = await approvalRecordOf(host);
  const items = ["TST-002 — known flaky fixture", "TST-010 — model drift, accepted"];
  assert.equal(text, `kind: release-report\nfile: ${ACCEPT_PATH}\nblob: ${blob}\nlimitation: ${items[0]}\nlimitation: ${items[1]}\n`);
  assert.deepEqual(readDocument(approvalSchema, path, text).fields.limitation, items);
});

// TST-934003 · level: unit · module: MOD-release-evidence
// guards: A RED RELEASE IS ACCEPTED ONLY WITH ITS LIMITATIONS RECORDED
// given: a candidate with one failing test (TST-002) and its reason recorded
// input: acceptAndRelease(...), then the approval record read back
// expect: exactly one `limitation:` line, `limitation: TST-002 — known flaky fixture` — the known positive beside the green record's none
test("TST-934003 acceptAndRelease — one limitation gives one limitation line", async () => {
  const host = acceptHost({
    testFiles: { "tests/sample.test.mjs": MULTI_TEST_FILE },
    runsRows: [["TST-001", "unit", "passed", ""], ["TST-002", "unit", "failed", ""], ["TST-010", "unit", "passed", "10 of 10"]],
  });
  const blob = await acceptBlob(host, "Adds the sample feature.");
  await acceptAndRelease(host, { path: ACCEPT_PATH, blob }, { limitations: { "TST-002": "known flaky fixture" } }, "akmaier", "2026-10-07");
  const { text } = await approvalRecordOf(host);
  assert.deepEqual(text.split("\n").filter((line) => line.startsWith("limitation")), ["limitation: TST-002 — known flaky fixture"]);
});

// TST-934004 · level: unit · module: MOD-release-evidence
// guards: THE RELEASE TEST REPORT IS ACCEPTED BY A PERSON; STATUS IS DERIVED FROM THE RECORDS
// given: the record of a green release, committed by acceptAndRelease; its callers that read it are MOD-approvals' statusOf and approvalSchema's reader (audit.mjs reads the same record through readDocument)
// input: statusOf(report path, report blob, default branch); readDocument(approvalSchema, path, record text)
// expect: the report is "accepted"; the record reads back with kind release-report, the report's file and blob, and `limitation` undefined (the reader of the audit takes that as no limitation)
// counter-proof: a record with the wrong blob (the report changed after it was accepted) makes statusOf answer "changed", so the first assertion is not vacuous
test("TST-934004 acceptAndRelease — the green record is still read as the accepted report's record", async () => {
  const host = acceptHost({ runsRows: [["TST-001", "unit", "passed", ""]] });
  const blob = await acceptBlob(host, "Adds the sample feature.");
  await acceptAndRelease(host, { path: ACCEPT_PATH, blob }, { limitations: {} }, "akmaier", "2026-10-07");
  const { after, path, text } = await approvalRecordOf(host);
  assert.equal(statusOf(ACCEPT_PATH, after.blob(ACCEPT_PATH), after), "accepted");
  const { fields } = readDocument(approvalSchema, path, text);
  assert.deepEqual([fields.kind, fields.file, fields.blob, fields.limitation], ["release-report", ACCEPT_PATH, blob, undefined]);
  const moved = { ...after, blob: (p) => (p === ACCEPT_PATH ? "0".repeat(40) : after.blob(p)) };
  assert.equal(statusOf(ACCEPT_PATH, moved.blob(ACCEPT_PATH), moved), "changed");
});
