// A start refused as Moved names the collision at the moved head (ITM-1333; UC-032 6c) — MOD-work-plans' startSprint, where the host
// refuses the commit with Moved { head }, reads `held` again at that head (heldItems of its sprint records, items and module files and
// of the product's pull requests) and refuses the start with SprintRefused where another team's sprint holds an item that `conflicts`
// names there; otherwise Moved stands. Nothing is written then, and no branch is created.
// Run: node --test tests/work-plans-start-moved-collision.test.mjs
//
// Module: MOD-work-plans
// Guards: UC-032; SPRINTS OF DIFFERENT TEAMS CHANGE NO MODULE THE OTHER CHANGES OR USES
// Level: unit
//
// The host is a fake of MOD-repository-hosts' Host: readSnapshot (a different set of files at the head that was read and at the moved
// head), listPullRequests (none), repositoryInfo (default branch main), createBranch and commitFiles, each write recorded. commitFiles
// refuses as the host does when the branch has moved: an error named Moved naming MOVED_HEAD. Nothing reaches the network.

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

const itemText = (id, module) => ["---", `id: ${id}`, `title: ${id} the work`, "level: module", "realises:", "  - UC-032", "modules:",
  `  - ${module}`, "builds_on: []", "tests:", "  - unit", "origin:", "  - UC-032", "---", `# ${id} ${id} the work`, "", "## Outcome", "", "Done.", "",
  "## Acceptance", "", "- a unit test.", ""].join("\n");
const moduleText = (id) => ["---", `id: ${id}`, "title: A module", `folder: src/${id.slice(4)}/`, "realises:", "follows:", "  - ARC-001", "uses:", "provides:",
  "  - read", "---", "# A module", ""].join("\n");
const sprintText = (item) => `---\nsprint: 1\ngoal: g\nstart: 2026-10-12\nend:\ncloser: bob\nbranch:\nselection:\n  - ${item}\n---\n# team2 Sprint 01\n`;

const BASE = {
  "docs/architecture/MOD-store.md": moduleText("MOD-store"),
  "docs/backlog/ITM-001-store.md": itemText("ITM-001", "MOD-store"),
};
// At the moved head, team2 has committed its sprint 01, which holds ITM-009 of MOD-store; the other moved head holds no such sprint.
const COLLIDING = { ...BASE, "docs/backlog/ITM-009-store-too.md": itemText("ITM-009", "MOD-store"), "docs/backlog/sprints/team2/01.md": sprintText("ITM-009") };
const FREE = { ...BASE, "docs/backlog/ITM-009-store-too.md": itemText("ITM-009", "MOD-store") };

// A fake host: BASE at HEAD, `atMoved` at MOVED_HEAD; commitFiles throws Moved and writes nothing.
function hostWith(atMoved) {
  const calls = [];
  const filesOf = (ref) => (ref === MOVED_HEAD ? atMoved : BASE);
  return {
    calls,
    async repositoryInfo() { return { defaultBranch: "main" }; },
    async readSnapshot(ref) {
      const files = filesOf(ref);
      return { ref, commit: ref, paths: Object.keys(files), blob: (p) => (p in files ? `blob-${p}` : null), read: async (p) => files[p] ?? null };
    },
    async listPullRequests() { return []; },
    async createBranch(name, from) { calls.push(["createBranch", name, from]); },
    async commitFiles(change) {
      calls.push(["commitFiles", change.branch, change.expectedHead]);
      throw Object.assign(new Error(`main has moved on to ${MOVED_HEAD.slice(0, 12)} since it was read.`), { name: "Moved", head: MOVED_HEAD });
    },
  };
}
const context = () => ({ states: [{ item: "ITM-001", state: "ready", reason: null, job: null, pullRequest: null }],
  model: { name: "team-scrum", kind: "pulled", flow: { wip: null, timeBox: "1 week", sprints: true } }, declaration, held: [],
  architecture: [{ kind: "module", path: "docs/architecture/MOD-store.md", id: "MOD-store", fields: { id: "MOD-store", uses: [] } }],
  running: null, head: HEAD, trailers: [] });
const SPRINT = { team: "team1", goal: "Store", start: "2026-10-12", closer: "alice", selection: ["ITM-001"] };
const failure = (p) => Promise.resolve(p).then(() => null, (e) => e);

// TST-1333001 · level: unit · module: MOD-work-plans
// guards: UC-032; SPRINTS OF DIFFERENT TEAMS CHANGE NO MODULE THE OTHER CHANGES OR USES
// given: team1 starts ITM-001 (MOD-store) at HEAD, where no sprint holds anything; the host refuses the commit as Moved naming MOVED_HEAD, at which team2's sprint 01 holds ITM-009, an item of MOD-store
// input: startSprint(host, team1's sprint selecting ITM-001, context at HEAD)
// expect: rejects with SprintRefused, whose reasons name team2's sprint team2/01, the held item ITM-009 and the module MOD-store; the commit was tried once and refused, and no branch was created
test("startSprint — a start refused as Moved is refused as SprintRefused naming the sprint, item and module that collide at the moved head", async () => {
  const host = hostWith(COLLIDING);
  const refused = await failure(startSprint(host, SPRINT, context()));
  assert.equal(refused?.name, "SprintRefused", String(refused));
  const reasons = refused.reasons.join(" ");
  assert.match(reasons, /team2\/01/);
  assert.match(reasons, /ITM-009/);
  assert.match(reasons, /MOD-store/);
  assert.deepEqual(host.calls, [["commitFiles", "main", HEAD]], "the commit was refused and no branch was created");
});

// TST-1333002 · level: unit · module: MOD-work-plans
// guards: UC-032; SPRINTS OF DIFFERENT TEAMS CHANGE NO MODULE THE OTHER CHANGES OR USES
// given: the same start and the same Moved refusal, but at MOVED_HEAD no sprint holds an item (ITM-009 is in the backlog only)
// input: startSprint(host, team1's sprint selecting ITM-001, context at HEAD)
// expect: rejects with Moved, as the host refused it; no branch was created
test("startSprint — a start refused as Moved stands as Moved where no sprint holds a colliding item at the moved head", async () => {
  const host = hostWith(FREE);
  const refused = await failure(startSprint(host, SPRINT, context()));
  assert.equal(refused?.name, "Moved", String(refused));
  assert.deepEqual(host.calls, [["commitFiles", "main", HEAD]]);
});
