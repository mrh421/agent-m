// A refused Start sprint leaves no branch (ITM-1329) — MOD-work-plans' startSprint writes the record's commit and creates the
// sprint's own branch; when the default branch has moved the commit is refused (Moved), and then nothing may have been written,
// so no branch `sprint/<team>/<nn>` stands at the old head. The branch is created only once the record is committed, from the head
// that commit was written on.
// Run: node --test tests/work-plans-start-refused.test.mjs
//
// Module: MOD-work-plans
// Guards: A PHASE OR A TIME BOX MAY HAVE A BRANCH OF ITS OWN; UC-032
// Level: unit
//
// The host is a fake of MOD-repository-hosts' Host with the product's files at one head: readSnapshot, repositoryInfo (its default
// branch main), createBranch and commitFiles, each call recorded in order. With `moved`, commitFiles refuses as the host does
// when the branch is no longer at the head the commit was made on: an error named Moved. Nothing reaches the network.

import test from "node:test";
import assert from "node:assert/strict";
import { readDocument } from "../src/documents/index.mjs";
import { declarationSchema } from "../src/product-process/index.mjs";
import { startSprint } from "../src/work-plans/index.mjs";

const HEAD = "a1b2c3d4e5f60718293a4b5c6d7e8f9012345678";
const MOVED_HEAD = "f".repeat(40);

const declaration = readDocument(declarationSchema, "docs/process.md", [
  "---", "model: team-scrum", "model_file: docs/process-models/team-scrum.md",
  "model_version: a1b2c3d4e5f60718293a4b5c6d7e8f9012345678", "---", "# How the product is developed", "",
  "## Roles", "", "The roles of team-scrum.", "", "## Practices", "", "- none", "", "## Branches", "",
  "| Phase or time box | Branch |", "|---|---|", "| Sprint | `sprint/<team>/<nn>` |", "",
  "## Definition of Done", "", "The job rules hold.", "",
].join("\n"));

const ARCHITECTURE = [{ kind: "module", path: "docs/architecture/MOD-store.md", id: "MOD-store", fields: { id: "MOD-store", uses: [] } }];
const FILES = {
  "docs/backlog/ITM-001-store.md": [
    "---", "id: ITM-001", "title: ITM-001 the work", "level: module", "realises:", "  - UC-032", "modules:", "  - MOD-store",
    "builds_on: []", "tests:", "  - unit", "origin:", "  - UC-032", "---", "# ITM-001 ITM-001 the work", "", "## Outcome", "", "Done.", "",
    "## Acceptance", "", "- a unit test.", "",
  ].join("\n"),
};

// A fake host with FILES at HEAD; with `moved`, commitFiles throws Moved and writes nothing.
function hostWith({ moved = false } = {}) {
  const calls = [];
  return {
    calls,
    async repositoryInfo() { return { defaultBranch: "main" }; },
    async readSnapshot(ref) {
      return { ref, commit: HEAD, paths: Object.keys(FILES), blob: (p) => (p in FILES ? `blob-${p}` : null), read: async (p) => FILES[p] ?? null };
    },
    async listPullRequests() { return []; },
    async createBranch(name, from) { calls.push(["createBranch", name, from]); },
    async commitFiles(change) {
      calls.push(["commitFiles", change.branch, change.expectedHead]);
      if (moved) throw Object.assign(new Error(`main has moved on to ${MOVED_HEAD.slice(0, 12)} since it was read.`), { name: "Moved", head: MOVED_HEAD });
      return { commit: "c".repeat(40), url: "https://example.org/c" };
    },
  };
}
const context = () => ({ states: [{ item: "ITM-001", state: "ready", reason: null, job: null, pullRequest: null }],
  model: { name: "team-scrum", kind: "pulled", flow: { wip: null, timeBox: "1 week", sprints: true } }, declaration, held: [],
  architecture: ARCHITECTURE, running: null, head: HEAD, trailers: [] });
const SPRINT = { team: "team1", goal: "Store", start: "2026-10-12", closer: "alice", selection: ["ITM-001"] };
const failure = (p) => Promise.resolve(p).then(() => null, (e) => e);
const written = (host) => host.calls.filter(([what]) => what === "createBranch");

// TST-1329001 · level: unit · module: MOD-work-plans
// guards: A PHASE OR A TIME BOX MAY HAVE A BRANCH OF ITS OWN; UC-032
// given: a product whose team1 has no sprint, the declaration's sprint branch `sprint/<team>/<nn>`, ITM-001 ready; the default branch has moved, so the host refuses the record's commit as Moved; and, as the counter-proof, the same start on a host whose branch has not moved
// input: startSprint(host, team1's sprint selecting ITM-001, context at HEAD), once with the moved host and once with the other
// expect: the moved host: startSprint rejects with Moved and createBranch was never called, so no sprint/team1/01 stands; the counter-proof: the start on the current head resolves and createBranch was called once with sprint/team1/01 at HEAD
test("startSprint — a start refused as Moved creates no branch; a start that succeeds creates its branch", async () => {
  const stale = hostWith({ moved: true });
  const refused = await failure(startSprint(stale, SPRINT, context()));
  assert.equal(refused?.name, "Moved", String(refused));
  assert.deepEqual(written(stale), [], "no branch is created by a refused start");

  const current = hostWith();
  const result = await startSprint(current, SPRINT, context());
  assert.equal(result.path, "docs/backlog/sprints/team1/01.md");
  assert.deepEqual(written(current), [["createBranch", "sprint/team1/01", HEAD]]);
});

// TST-1329002 · level: unit · module: MOD-work-plans
// guards: A PHASE OR A TIME BOX MAY HAVE A BRANCH OF ITS OWN; UC-032
// given: the same product and start on a host whose default branch has not moved
// input: startSprint(host, team1's sprint selecting ITM-001, context at HEAD)
// expect: exactly two writes, the commit first — commitFiles on main at HEAD — and then createBranch of sprint/team1/01 at the same HEAD
test("startSprint — a start that is written sends the record's commit first, then creates the branch from the same head", async () => {
  const host = hostWith();
  await startSprint(host, SPRINT, context());
  assert.deepEqual(host.calls, [["commitFiles", "main", HEAD], ["createBranch", "sprint/team1/01", HEAD]]);
});
