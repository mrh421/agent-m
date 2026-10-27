// Giving up the increment of a closed sprint whose branch was not merged (UC-041 7b) — MOD-work-plans' giveUpIncrement as the
// accepted text of docs/architecture/MOD-work-plans.md states it: "appends `## Increment given up` with the date, the person
// and the reason, in one commit; the sprint then holds none of its items (UC-041 7b). Errors: `NotFound { path }`,
// `NotClosed` for a sprint without `## Review`, `Merged` for a sprint whose branch's pull request is merged, and the host's."
// Run: node --test tests/work-plans-give-up-increment.test.mjs
//
// Module: MOD-work-plans
// Guards: A SPRINT HOLDS ITS ITEMS UNTIL THEY REACH THE DEFAULT BRANCH; UC-041; ONE CLICK PER DECISION
// Level: unit
//
// The host is a fake of MOD-repository-hosts' Host with the product's files at one head: readSnapshot, repositoryInfo (its
// default branch main), listPullRequests (the pull requests given, filtered by its `state` and `branch` as the host's own
// function filters them) and commitFiles, each call recorded; nothing reaches the network. The functions are taken from the
// module's namespace, so that a function the module does not give fails the test by its assertion. Readings the texts
// leave open, which the tests state: `by:` names the Product Owner's role — the commit, made with the person's token, names
// the person —; `at:` is the day of the commit in UTC.

import test from "node:test";
import assert from "node:assert/strict";
import { readDocument } from "../src/documents/index.mjs";
import * as workPlans from "../src/work-plans/index.mjs";

const HEAD = "a1b2c3d4e5f60718293a4b5c6d7e8f9012345678";
const TRAILERS = ["Agent-M-Job: JOB-20261020-0900-ab12"];
const PATH = "docs/backlog/sprints/team1/01.md";
const BRANCH = "sprint/team1/01";
const RUNNING = ["---", "sprint: 1", "goal: The store", "start: 2026-10-07", "end: 2026-10-13", "closer: alice", `branch: ${BRANCH}`,
  "selection:", "  - ITM-001", "  - ITM-003", "---", "# team1 Sprint 01", ""].join("\n");
const CLOSED = `${RUNNING}\n## Review\n\nThe increment is ITM-001.\n\n## Unfinished items\n\nto the backlog: ITM-003\ninto the next sprint:\n\n`
  + "ITM-003 waits.\n\n## Retrospective\n\n- change, to team agreement: merge sooner.\n";
const pullRequest = (number, branch, base, state) => ({ number, title: `Pull request ${number}`, branch, base, head: "b".repeat(40), state,
  draft: false, url: `https://example.org/pull/${number}`, opened: "2026-10-08T08:00:00Z", merged: state === "merged" ? "2026-10-09T08:00:00Z" : null,
  closed: state === "open" ? null : "2026-10-09T08:00:00Z" });
// ITM-001 merged into the sprint's branch; the branch's own pull request into main open.
const PULLS = [pullRequest(3, "work/ITM-001", BRANCH, "merged"), pullRequest(9, BRANCH, "main", "open")];

function hostWith(files, pulls = PULLS) {
  const calls = [];
  return {
    calls,
    async repositoryInfo() { calls.push(["repositoryInfo"]); return { defaultBranch: "main" }; },
    async readSnapshot(ref) {
      calls.push(["readSnapshot", ref]);
      return { ref, commit: HEAD, paths: Object.keys(files), blob: (p) => (p in files ? `blob-${p}` : null), read: async (p) => files[p] ?? null };
    },
    async listPullRequests(filter = {}) {
      calls.push(["listPullRequests", filter]);
      return pulls.filter((p) => (!filter.state || filter.state === "all" || p.state === filter.state) && (!filter.branch || p.branch === filter.branch));
    },
    async commitFiles(change) { calls.push(["commitFiles", change]); return { commit: "c".repeat(40), url: "https://example.org/c" }; },
  };
}
const committed = (host) => host.calls.filter(([what]) => what === "commitFiles").map(([, change]) => change);
const failure = (p) => Promise.resolve(p).then(() => null, (e) => e);
const giveUp = (host, sprint, reason) => workPlans.giveUpIncrement(host, sprint, reason, { head: HEAD, trailers: TRAILERS });

// TST-1232002 · level: unit · module: MOD-work-plans
// guards: A SPRINT HOLDS ITS ITEMS UNTIL THEY REACH THE DEFAULT BRANCH; UC-041; ONE CLICK PER DECISION
// given: team1's sprint 01, closed (its record holds ## Review), on its own branch sprint/team1/01 whose pull request into main is open; ITM-001 merged into that branch
// input: giveUpIncrement(host, "team1/01", "the store is built anew", { head: HEAD, trailers })
// expect: one commit on main at HEAD of the sprint's file only, its text the record followed by ## Increment given up with at (the day of the commit, UTC), by Product Owner and the reason; the job's trailers in the message; planSchemas.sprint reads the section back; the result is the commit
test("giveUpIncrement — a closed sprint whose branch is not merged gets ## Increment given up with the day, the person and the reason, in one commit", async () => {
  assert.equal(typeof workPlans.giveUpIncrement, "function", "MOD-work-plans gives giveUpIncrement");
  const host = hostWith({ [PATH]: CLOSED });
  const before = new Date().toISOString().slice(0, 10);
  const result = await giveUp(host, "team1/01", "the store is built anew");
  const after = new Date().toISOString().slice(0, 10);
  const [change] = committed(host);
  assert.equal(committed(host).length, 1);
  assert.equal(change.branch, "main");
  assert.equal(change.expectedHead, HEAD);
  assert.deepEqual(change.files.map((f) => f.path), [PATH]);
  assert.ok(change.message.endsWith(TRAILERS[0]), change.message);
  assert.ok(change.files[0].text.startsWith(CLOSED), "the record is only appended to");
  const section = readDocument(workPlans.planSchemas.sprint, PATH, change.files[0].text).appended.find((s) => s.heading === "## Increment given up");
  assert.ok(section, "the record holds ## Increment given up as an appended section of the sprint's schema");
  assert.ok([before, after].includes(section.fields.at), section.fields.at);
  assert.equal(section.fields.by, "Product Owner");
  assert.equal(section.fields.reason, "the store is built anew");
  assert.deepEqual(result, { commit: "c".repeat(40) });
});

// TST-1232003 · level: unit · module: MOD-work-plans
// guards: A SPRINT HOLDS ITS ITEMS UNTIL THEY REACH THE DEFAULT BRANCH; UC-041
// given: the sprint's record as giveUpIncrement wrote it, and the same record closed only; ITM-001 merged into the sprint's branch, which is not merged into main
// input: heldItems over each record and the pull requests
// expect: closed only, team1/01 holds ITM-001 (known positive); given up, it holds none of its items
test("giveUpIncrement — the sprint it gives up holds none of its items", async () => {
  assert.equal(typeof workPlans.giveUpIncrement, "function", "MOD-work-plans gives giveUpIncrement");
  const host = hostWith({ [PATH]: CLOSED });
  await giveUp(host, "team1/01", "the store is built anew");
  const record = (text) => readDocument(workPlans.planSchemas.sprint, PATH, text);
  const held = (text) => workPlans.heldItems([record(text)], [], [], PULLS).map((entry) => entry.item);
  assert.deepEqual(held(CLOSED), ["ITM-001"], "known positive: closed, the sprint holds its item merged into its branch");
  assert.deepEqual(held(committed(host)[0].files[0].text), [], "given up, it holds none");
});

// TST-1232004 · level: unit · module: MOD-work-plans
// guards: UC-041; A SPRINT HOLDS ITS ITEMS UNTIL THEY REACH THE DEFAULT BRANCH
// given: (a) no record of team1/99; (b) team1/01 running — no ## Review; (c) team1/01 closed, its branch's pull request into main merged
// input: giveUpIncrement of each
// expect: (a) NotFound naming docs/backlog/sprints/team1/99.md; (b) NotClosed; (c) Merged; nothing committed in any; known positive: the closed sprint with its branch's pull request open is given up (TST-1232002)
test("giveUpIncrement — refused with NotFound, NotClosed or Merged, nothing written", async () => {
  assert.equal(typeof workPlans.giveUpIncrement, "function", "MOD-work-plans gives giveUpIncrement");
  const missing = hostWith({ [PATH]: CLOSED });
  const notFound = await failure(giveUp(missing, "team1/99", "gone"));
  assert.equal(notFound?.name, "NotFound", String(notFound));
  assert.equal(notFound.path, "docs/backlog/sprints/team1/99.md");
  const running = hostWith({ [PATH]: RUNNING });
  assert.equal((await failure(giveUp(running, "team1/01", "gone")))?.name, "NotClosed");
  const merged = hostWith({ [PATH]: CLOSED }, [PULLS[0], pullRequest(9, BRANCH, "main", "merged")]);
  assert.equal((await failure(giveUp(merged, "team1/01", "gone")))?.name, "Merged");
  for (const host of [missing, running, merged]) assert.deepEqual(committed(host), []);
});
