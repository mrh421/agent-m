// Release tests of ITM-987 — UC-041 step 6 on the sprint-record close: the close of a sprint adds the feedback's new items to the backlog in the close's one commit, each item with an identifier that no history of the
// repository holds, and a draft whose item fails a check writes nothing. The behaviour is UC-041 (docs/use-cases/UC-041-close-a-sprint.md, step 6: "the review and the retrospective ..., the new backlog items from the
// feedback, and the moved items"), the SPEC's A SPRINT ENDS WITH A REVIEW OF ITS INCREMENT ("the feedback, which enters the backlog as items"), THE NAME IS THE ID AND IT SURVIVES ("a withdrawn identifier is never
// reused") and A BACKLOG ITEM NAMES WHAT IT REALISES, as docs/architecture/MOD-work-plans.md states `closeSprint` ("adds the feedback's new items to the backlog as `saveItems` does ...; all in one commit. Errors: ...
// `ItemsRefused { findings }`, and the host's") and the writer `sprint-record` ("an agent's close through `closeSprint`, with the job's provenance lines").
// Run: node --test tests/release-itm-987-close-new-items.test.mjs
//
// Module: MOD-work-plans
// Guards: A SPRINT ENDS WITH A REVIEW OF ITS INCREMENT; THE NAME IS THE ID AND IT SURVIVES; A BACKLOG ITEM NAMES WHAT IT REALISES; A BACKLOG ITEM NAMES THE MODULES IT CHANGES; UC-041
// Level: release
//
// Written for the release testing of sprint 123 by a participant who implemented none of ITM-987 (RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER). The implementers' cases (tests/work-plans-close-new-items.test.mjs)
// call `closeSprint` over a fake host that answers from fixed lists; these cases run the close as the workflow runs it: the check `sprint-record-checks` on the draft, then the writer `sprint-record` of `workStrategies` with
// the job's context, over a controlled repository host, tests/memory-host.mjs, whose commits are real: a file written stays in its tree, a file deleted is gone from it, the head moves with each commit, and the history
// the host reads is the list of the commits that were made to it (every path of each, added or deleted). The expected values are written here from the texts and from the host's own history, and none is read from the code.
// Readings the texts leave open, taken here:
//   - "each with an identifier no history holds" is read on the host's history: an identifier is held by the history when a path of any commit, or of the head, carries it (`docs/backlog/ITM-<n>-...`); the case computes
//     that set itself from the commits the host kept and from the head's files, and asks that no new item takes an identifier in it and that no two new items share one. Which number the next one is, is not asked.
//   - "a withdrawn identifier" is an item that a commit added and a later commit deleted (ITM-004 and ITM-005 below, which the files of the head no longer hold, and an item that the first close wrote and a person then deleted).
//   - "all in one commit" is read as: the host received one commit for the close, and it holds the sprint's record and every new item's file and no other file.
//   - "nothing is written" for a refusal is read as: the host received no commit, so its head, its files and its history are as they were before the close.
//   - "as `saveItems` does" is read as: the item files the close writes are those, by path and by text, that `saveItems` writes for the same items on an equal repository, including a `builds_on` that names another new item by its title.
//   - The sprint of the cases is team1/01, whose selection is ITM-001 (its pull request merged) and ITM-002 (its pull request open, so it is not done and the close decides it); team1/02 selects ITM-003 (merged).

import test from "node:test";
import assert from "node:assert/strict";
import { artifactSchemas, readDocument } from "../src/documents/index.mjs";
import { planSchemas, saveItems, workStrategies } from "../src/work-plans/index.mjs";
import { memoryHost } from "./memory-host.mjs";

const lines = (...rows) => `${rows.join("\n")}\n`;
const ADDRESS = "https://github.com/acme/product";
const H1 = "a1".repeat(20), H3 = "a3".repeat(20);
const JOB_ID = "JOB-20261019-0900-ab12";
const CLOSER = { name: "closer-bot", model: "model-x" };
const RECORD_01 = "docs/backlog/sprints/team1/01.md", RECORD_02 = "docs/backlog/sprints/team1/02.md";
const ITEM_PATH = /^docs\/backlog\/(ITM-\d{3,})-[^/]+\.md$/;
const ANY_ITEM = /(?:^|\/)(ITM-\d{3,})-/;
const REALISES = "A BACKLOG ITEM NAMES WHAT IT REALISES", MODULES = "A BACKLOG ITEM NAMES THE MODULES IT CHANGES";

const moduleText = (id) => lines("---", `id: ${id}`, `title: ${id}`, `folder: src/${id.slice(4)}/`, "realises:", "follows:", "  - ARC-001", "uses: []", "provides:", "  - f", "---",
  `# ${id} ${id}`, "", "## Responsibility", "", "r", "", "## Parts", "", "p", "", "## Data", "", "d", "", "## Interfaces", "", "- `f` — i", "", "## Files", "", "f", "", "## Uses", "", "u");
const itemText = (id, title) => lines("---", `id: ${id}`, `title: ${title}`, "level: module", "realises:", "  - UC-001", "modules:", "  - MOD-store", "builds_on: []", "tests:", "  - unit",
  "origin:", "  - UC-001", "---", `# ${id} ${title}`, "", "## Outcome", "", "o", "", "## Acceptance", "", "a");
const sprintText = (number, selection) => lines("---", `sprint: ${number}`, "goal: The fixture sprint", "start: 2026-10-12", "end: 2026-10-19", "closer: alice", "branch:", "selection:",
  ...selection.map((each) => `  - ${each}`), "---", `# team1 Sprint ${number}`);
const pullRequest = (number, id, state, head) => ({ number, title: `${id}: the work`, branch: `job/${id}`, base: "main", head, state, draft: false, url: `${ADDRESS}/pull/${number}`,
  opened: "2026-10-13T08:00:00Z", merged: state === "merged" ? "2026-10-14T09:30:00Z" : null, closed: null, body: "" });
const PULLS = [pullRequest(1, "ITM-001", "merged", H1), pullRequest(2, "ITM-002", "open", "a2".repeat(20)), pullRequest(3, "ITM-003", "merged", H3)];
const PRODUCT = () => ({
  "SPEC.md": "# Fixture\n", "docs/use-cases/UC-001-store.md": "# UC-001 store\n",
  "docs/architecture/MOD-store.md": moduleText("MOD-store"), "docs/architecture/MOD-pages.md": moduleText("MOD-pages"),
  "docs/backlog/ITM-001-a.md": itemText("ITM-001", "First work"), "docs/backlog/ITM-002-b.md": itemText("ITM-002", "Second work"), "docs/backlog/ITM-003-c.md": itemText("ITM-003", "Third work"),
  [RECORD_01]: sprintText(1, ["ITM-001", "ITM-002"]), [RECORD_02]: sprintText(2, ["ITM-003"]),
});

// The controlled repository: tests/memory-host.mjs over the product's files, with the pull requests and the issues a close reads, the branch test-results (no record on it), and a history that is the list of the commits
// the host was given, newest first, each with the paths it added and deleted, as a server reports them.
function repository() {
  const files = PRODUCT();
  const memory = memoryHost(files);
  const results = { paths: [], blob: () => null, read: async () => null };
  const host = {
    ...memory.host,
    async readSnapshot(ref) { return ref === "test-results" ? results : memory.host.readSnapshot(ref); },
    async readHistory() {
      const made = memory.commits().map((call, at) => ({ commit: `commit-${at + 1}`, parents: [], date: "2026-10-18T10:00:00Z", message: call.message, author: { account: null, name: "x" },
        changes: call.files.map((file) => ({ path: file.path, change: file.delete ? "deleted" : "added" })) }));
      const first = { commit: "commit-0", parents: [], date: "2026-10-01T10:00:00Z", message: "first", author: { account: null, name: "x" }, changes: Object.keys(files).map((path) => ({ path, change: "added" })) };
      return [...made.reverse(), first];
    },
    async listPullRequests() { return PULLS; },
    async listIssues() { return []; },
    async createBranch() {},
  };
  return { host, files: memory.files, commits: memory.commits, head: async () => (await host.readSnapshot("main")).commit };
}
const write = async (repo, change) => repo.host.commitFiles({ branch: "main", expectedHead: await repo.head(), message: "a person's own commit", files: [change] });
// An item that a commit adds and a later commit deletes: its identifier is withdrawn.
async function withdraw(repo, id) {
  const path = `docs/backlog/${id}-idea.md`;
  await write(repo, { path, text: itemText(id, `Idea ${id}`) });
  await write(repo, { path, delete: true });
}
// Every item identifier the repository has held: in a path of any commit it was given, or of its head.
async function everHeld(repo) {
  const held = new Set(Object.keys(repo.files()).map((path) => ANY_ITEM.exec(path)?.[1]).filter(Boolean));
  for (const entry of await repo.host.readHistory(null, { ref: "main" })) for (const { path } of entry.changes) if (ANY_ITEM.test(path)) held.add(ANY_ITEM.exec(path)[1]);
  return held;
}

const newItem = (title, over = {}) => ({ fields: { title, level: "module", realises: ["UC-001"], modules: ["MOD-pages"], tests: ["unit"], origin: ["UC-001"], ...over },
  sections: [{ heading: "## Outcome", text: `\n${title}.\n\n` }, { heading: "## Acceptance", text: "\n- a unit test.\n" }] });
const COUNT = newItem("Count the stored rows"), WARN = newItem("Warn on a full store");
// The draft of a close-sprint job: the shape of closeSprint's `close`, clean for the check sprint-record-checks.
const draftOf = (sprint, newItems, over = {}) => ({ sprint,
  review: { feedback: [{ line: "No stakeholder took part; issue 7 shows the export works", goes: "noted", item: null }, ...newItems.map((each) => ({ line: `Feedback for ${each.fields.title}`, goes: "new item", item: null }))],
    tookPart: [], sources: ["issues of sprint team1/01"] },
  unfinished: sprint === "team1/01" ? [{ item: "ITM-002", to: "next sprint", reason: "its pull request is still open" }] : [],
  retrospective: [{ text: "Review pull requests the same day", kind: "went well", goes: null }], newItems, ...over });

// The job of the kind close-sprint as the workflow holds it: the check on the draft, and the writer with the job's context over the repository at its head now.
async function job(repo, draft) {
  const product = await repo.host.readSnapshot("main");
  const instance = { repository: { server: "github", path: "acme/agent-m", web: "https://github.com/acme/agent-m" }, ref: "main", commit: "d".repeat(40), paths: ["SPEC.md"], blob: () => null, read: async () => "# Instance\n" };
  const context = { kind: { name: "close-sprint" }, params: { sprint: draft.sprint }, product: { address: ADDRESS, snapshot: product, host: repo.host },
    instance: { snapshot: instance, host: null, checkout: null }, connect: async () => null, participants: [], places: { sources: {}, mailbox: null, contents: [] }, gates: [], person: "alice",
    now: new Date("2026-10-19T08:00:00Z"), agentM: { version: "unreleased", commit: "a".repeat(40) }, jobId: JOB_ID };
  const result = { draft, drafter: CLOSER, rounds: [{ number: 1 }] };
  return { findings: workStrategies.checks["sprint-record-checks"](draft), write: () => workStrategies.writers["sprint-record"](result, context) };
}
const failure = (promise) => Promise.resolve(promise).then(() => null, (error) => error);
// What a close changed in the repository: the paths whose text differs between two states of its files.
const changedPaths = (before, after) => [...new Set([...Object.keys(before), ...Object.keys(after)])].filter((path) => before[path] !== after[path]).sort();
const itemsAdded = (before, after) => Object.keys(after).filter((path) => !(path in before) && ITEM_PATH.test(path)).sort();
const item = (text, path) => readDocument(artifactSchemas().item, path, text);
const headings = (text, path) => readDocument(planSchemas.sprint, path, text).appended.map((section) => section.heading);

// TST-987301 · level: release · module: MOD-work-plans
// guards: A SPRINT ENDS WITH A REVIEW OF ITS INCREMENT; THE NAME IS THE ID AND IT SURVIVES; UC-041
// given: a product repository on a controlled host, with the open sprint team1/01, the items ITM-001 to ITM-003, and a history in which ITM-004 and ITM-005 were added and deleted; a clean draft of the close with two feedback lines going to new items, "Count the stored rows" and "Warn on a full store", both realising UC-001 and changing MOD-pages
// input: the check sprint-record-checks on the draft; then the writer sprint-record of the job; the identifiers the repository has ever held, computed from the host's commits and head before the close (the known positive: they hold ITM-004 and ITM-005, which no file holds)
// expect: the check finds nothing; the host received one more commit, and it holds the sprint's record and the two new items' files and no other file; the record keeps its text and gains ## Review, ## Unfinished items and ## Retrospective in that order; the two items read back with the titles, realises and modules drafted, with identifiers that differ from each other and are not among those held before; the outcome names the commit, which is the head now, and the three files
// Planted fault: closeSprint without its new items (`items` left empty in src/work-plans/saves.mjs) writes the record alone and the case fails on the files; the items written in a second commitFiles gives two commits and fails the count; the identifiers taken without the host's history (the loop over readHistory left out of itemFiles) give ITM-004, held by the history, and fail the identifiers.
test("TST-987301 the sprint-record close writes the new items with the sprint's record in one commit, each with an identifier the repository never held", async () => {
  const repo = repository();
  await withdraw(repo, "ITM-004");
  await withdraw(repo, "ITM-005");
  const held = await everHeld(repo);
  assert.equal(held.has("ITM-004") && held.has("ITM-005") && !(`docs/backlog/ITM-004-idea.md` in repo.files()), true, "known positive: the history holds the withdrawn identifiers, the head's files do not");
  const before = repo.files(), commitsBefore = repo.commits().length;
  const closing = await job(repo, draftOf("team1/01", [COUNT, WARN]));
  assert.deepEqual(closing.findings, [], "the draft is clean");
  const outcome = await closing.write();
  assert.equal(repo.commits().length, commitsBefore + 1, "one commit for the close");
  const [commit] = repo.commits().slice(-1);
  const after = repo.files();
  const added = itemsAdded(before, after);
  assert.equal(added.length, 2, `two item files are new: ${JSON.stringify(added)}`);
  assert.deepEqual(changedPaths(before, after), [RECORD_01, ...added].sort(), "the close changed the record and the two item files, no other file");
  assert.deepEqual(commit.files.map((file) => file.path).sort(), [RECORD_01, ...added].sort(), "the one commit holds exactly those files");
  assert.equal(after[RECORD_01].startsWith(before[RECORD_01].trimEnd()), true, "the record keeps its text");
  assert.deepEqual(headings(after[RECORD_01], RECORD_01), ["## Review", "## Unfinished items", "## Retrospective"]);
  const ids = added.map((path) => ITEM_PATH.exec(path)[1]);
  assert.deepEqual(added.map((path) => item(after[path], path).fields.id), ids, "each item's identifier is the one of its file name");
  assert.equal(new Set(ids).size, 2, `the two identifiers differ: ${ids}`);
  assert.deepEqual(ids.filter((id) => held.has(id)), [], `no new item takes an identifier the repository held: ${ids}`);
  const titles = added.map((path) => item(after[path], path).fields.title).sort();
  assert.deepEqual(titles, ["Count the stored rows", "Warn on a full store"]);
  for (const path of added) assert.deepEqual([item(after[path], path).fields.realises, item(after[path], path).fields.modules], [["UC-001"], ["MOD-pages"]]);
  assert.deepEqual([outcome.commits, outcome.files.slice().sort()], [[await repo.head()], [RECORD_01, ...added].sort()]);
  assert.equal(commit.message.includes(`Agent-M-Job: ${JOB_ID}`), true, "the commit carries the job's provenance lines");
});

// TST-987302 · level: release · module: MOD-work-plans
// guards: THE NAME IS THE ID AND IT SURVIVES; A SPRINT ENDS WITH A REVIEW OF ITS INCREMENT; UC-041
// given: a repository as in TST-987301 with ITM-004 added and deleted; the sprint team1/01 closed with two new items; a person then deletes the second of them with a commit of their own; then the sprint team1/02 closed with one new item, "Show the count on the page"
// input: the writer sprint-record twice, with the person's commit between; the identifiers the repository has ever held before the second close, computed from the host's commits and head (the known positive: they hold the deleted item, whose file the head no longer has)
// expect: the item of the second close takes an identifier that is not among those held before it, the deleted item's among them; it is none of the two identifiers of the first close either; the second close is one commit of the record of team1/02 and that one item file
// Planted fault: the identifiers taken from the files of the head alone (the loop over readHistory left out of itemFiles in src/work-plans/saves.mjs) give the deleted item's identifier again and the case fails on it.
test("TST-987302 an item that a close wrote and a person deleted is withdrawn: the next close does not give its identifier again", async () => {
  const repo = repository();
  await withdraw(repo, "ITM-004");
  const first = await (await job(repo, draftOf("team1/01", [COUNT, WARN]))).write();
  const firstIds = first.files.filter((path) => ITEM_PATH.test(path)).map((path) => ITEM_PATH.exec(path)[1]).sort();
  assert.equal(firstIds.length, 2);
  const deleted = first.files.find((path) => ITEM_PATH.test(path) && ITEM_PATH.exec(path)[1] === firstIds[1]);
  await write(repo, { path: deleted, delete: true });
  const held = await everHeld(repo);
  assert.equal(held.has(firstIds[1]) && !(deleted in repo.files()), true, "known positive: the deleted item is held by the history and has no file at the head");
  const before = repo.files(), commitsBefore = repo.commits().length;
  const second = await (await job(repo, draftOf("team1/02", [newItem("Show the count on the page")]))).write();
  const added = itemsAdded(before, repo.files());
  assert.equal(added.length, 1, JSON.stringify(added));
  const id = ITEM_PATH.exec(added[0])[1];
  assert.equal(held.has(id), false, `the new identifier ${id} is not among those the repository held: ${[...held].sort()}`);
  assert.equal(firstIds.includes(id), false, `nor one of the first close's: ${firstIds}`);
  assert.equal(repo.commits().length, commitsBefore + 1, "one commit for the second close");
  assert.deepEqual(changedPaths(before, repo.files()), [RECORD_02, ...added].sort());
  assert.deepEqual(second.files.slice().sort(), [RECORD_02, ...added].sort());
});

// TST-987303 · level: release · module: MOD-work-plans
// guards: A BACKLOG ITEM NAMES WHAT IT REALISES; A BACKLOG ITEM NAMES THE MODULES IT CHANGES; UC-041
// given: a repository as in TST-987301 without the withdrawn items, its sprint team1/01 open; a draft with two new items of which the first is sound and the second realises nothing, and a draft whose second item names no module; the corrected draft, both items sound
// input: the writer sprint-record on each refused draft, then on the corrected draft; the host's head, files and commits before and after each
// expect: each refused draft is refused with ItemsRefused whose findings hold an error of the rule A BACKLOG ITEM NAMES WHAT IT REALISES saying the item realises nothing, or of the rule A BACKLOG ITEM NAMES THE MODULES IT CHANGES saying the item names no module the architecture describes; after each the host's head, files and number of commits are as before, so that the sound first item and the record are not written either and the sprint is still open; the corrected draft then closes the sprint in one commit (the known positive that the draft was refused for its item alone)
// Planted fault: the error findings not thrown (the `throw new WorkPlansError("ItemsRefused", ...)` left out of itemFiles in src/work-plans/saves.mjs) writes the item that realises nothing and the case fails on the refusal; the record committed before the items are checked changes the head of a refused close and fails the unchanged head (and the later write of the close with Moved).
test("TST-987303 a close with a new item that fails a check is refused, and nothing of the close is written", async () => {
  const repo = repository();
  const sound = newItem("Count the stored rows");
  const drafts = [[REALISES, /realises nothing/, newItem("Warn on a full store", { realises: [] })], [MODULES, /names no module/, newItem("Warn on a full store", { modules: [] })]];
  for (const [rule, what, bad] of drafts) {
    const before = { head: await repo.head(), files: repo.files(), commits: repo.commits().length };
    const refused = await failure((await job(repo, draftOf("team1/01", [sound, bad]))).write());
    assert.equal(refused?.name, "ItemsRefused", `${rule}: ${refused}`);
    assert.equal(refused.findings.some((one) => one.kind === "error" && one.rule === rule && what.test(one.what)), true, JSON.stringify(refused.findings));
    assert.deepEqual([await repo.head(), repo.files(), repo.commits().length], [before.head, before.files, before.commits], `${rule}: nothing was written`);
    assert.deepEqual(headings(repo.files()[RECORD_01], RECORD_01), [], "the sprint is still open");
  }
  const commitsBefore = repo.commits().length;
  const corrected = await (await job(repo, draftOf("team1/01", [sound, newItem("Warn on a full store")]))).write();
  assert.equal(repo.commits().length, commitsBefore + 1, "known positive: the corrected draft closes in one commit");
  assert.equal(corrected.files.length, 3);
});

// TST-987304 · level: release · module: MOD-work-plans
// guards: A SPRINT ENDS WITH A REVIEW OF ITS INCREMENT; A SPRINT ENDS WITH A RETROSPECTIVE; UC-041
// given: two equal repositories; on the first the sprint team1/01 is closed with two new items, on the second with none (newItems empty)
// input: the writer sprint-record on each; the files each host changed
// expect: the first changed the record and two item files (the known positive that the comparison sees item files); the second received one commit, which holds the sprint's record alone, with ## Review, ## Unfinished items and ## Retrospective, and the item files of its head are those it had before
// Planted fault: items written for a close that has none (a stub item in the files of closeSprint) adds a file to the second commit and the case fails on its files.
test("TST-987304 a close without new items commits the sprint's record alone", async () => {
  const withItems = repository(), without = repository();
  const filesBefore = without.files(), commitsBefore = without.commits().length;
  await (await job(withItems, draftOf("team1/01", [COUNT, WARN]))).write();
  assert.equal(itemsAdded(PRODUCT(), withItems.files()).length, 2, "known positive: a close with new items adds two item files");
  const outcome = await (await job(without, draftOf("team1/01", []))).write();
  assert.equal(without.commits().length, commitsBefore + 1);
  assert.deepEqual(changedPaths(filesBefore, without.files()), [RECORD_01]);
  assert.deepEqual(outcome.files, [RECORD_01]);
  assert.deepEqual(headings(without.files()[RECORD_01], RECORD_01), ["## Review", "## Unfinished items", "## Retrospective"]);
  assert.deepEqual(Object.keys(without.files()).filter((path) => ITEM_PATH.test(path)), Object.keys(filesBefore).filter((path) => ITEM_PATH.test(path)));
});

// TST-987305 · level: release · module: MOD-work-plans
// guards: A SPRINT ENDS WITH A REVIEW OF ITS INCREMENT; THE NAME IS THE ID AND IT SURVIVES; UC-041
// given: two equal repositories; two new items, "Count the stored rows" and "Show the count on the page", the second building on the first by its title; the close on the first, and saveItems on the second with the same items and the architecture's module files of its head
// input: the writer sprint-record on the first; saveItems on the second; the item files each wrote, by path and by text; the same comparison with a changed title on the second
// expect: the two repositories hold the same item files, path for path and text for text (the close adds the items as saveItems does); the second item's builds_on is the first item's identifier, not its title; the comparison with a changed title finds a difference (the known positive that the comparison sees the text)
// Planted fault: closeSprint without its new items (`items` left empty in src/work-plans/saves.mjs) writes no item file and the case fails on the comparison with the files saveItems writes.
test("TST-987305 the items a close adds are the items saveItems adds for the same drafts, a builds_on by title turned into the identifier", async () => {
  const first = newItem("Count the stored rows"), second = newItem("Show the count on the page", { builds_on: ["Count the stored rows"] });
  const closing = repository(), saving = repository();
  await (await job(closing, draftOf("team1/01", [first, second]))).write();
  const architecture = [];
  const snapshot = await saving.host.readSnapshot("main");
  for (const path of snapshot.paths.filter((each) => /^docs\/architecture\/MOD-[^/]+\.md$/.test(each))) architecture.push(readDocument(artifactSchemas().module, path, await snapshot.read(path)));
  const saved = async (items) => {
    const twin = repository();
    const twinSnapshot = await twin.host.readSnapshot("main");
    await saveItems(twin.host, { items, removed: [] }, { architecture, head: twinSnapshot.commit, trailers: [] });
    return Object.fromEntries(itemsAdded(PRODUCT(), twin.files()).map((path) => [path, twin.files()[path]]));
  };
  const closed = Object.fromEntries(itemsAdded(PRODUCT(), closing.files()).map((path) => [path, closing.files()[path]]));
  assert.equal(Object.keys(closed).length, 2);
  assert.deepEqual(closed, await saved([first, second]), "the close wrote the item files saveItems writes");
  assert.notDeepEqual(closed, await saved([first, newItem("Show the count on a page", { builds_on: ["Count the stored rows"] })]), "known positive: the comparison sees a changed title");
  const [firstPath, secondPath] = Object.keys(closed).sort();
  const byTitle = Object.fromEntries(Object.entries(closed).map(([path, text]) => [item(text, path).fields.title, item(text, path)]));
  assert.deepEqual(byTitle["Show the count on the page"].fields.builds_on, [byTitle["Count the stored rows"].fields.id]);
  assert.equal([firstPath, secondPath].length, 2);
});

// TST-987306 · level: release · module: MOD-work-plans
// guards: A SPRINT ENDS WITH A REVIEW OF ITS INCREMENT; A SPRINT ENDS WITH A RETROSPECTIVE; UC-041
// given: a repository as in TST-987301 without the withdrawn items; a draft with two sound new items that leaves the unfinished ITM-002 undecided; the same draft without a retrospective; the sprint closed once, and the same draft again after it
// input: the check sprint-record-checks and the writer sprint-record on each; the host's head, files and number of commits before and after
// expect: the undecided draft is refused with Undecided naming ITM-002; the draft without a retrospective is found by the check (an error of the rule A SPRINT ENDS WITH A RETROSPECTIVE) and refused by the writer with RetrospectiveMissing; the draft for the closed sprint is refused with AlreadyClosed; after each the host's head, files and commits are as before, so that no new item is written by a close that is refused for another reason
// Planted fault: the refusal Undecided thrown after the commit instead of before it (the check of the undecided items moved behind commitFiles in closeSprint) leaves the close written and refused, and the case fails on the changed head.
test("TST-987306 a close refused for another reason writes no new item either", async () => {
  const repo = repository();
  const unchanged = async (before, name, why) => assert.deepEqual([await repo.head(), repo.files(), repo.commits().length], before, `${name}: ${why}`);
  const state = async () => [await repo.head(), repo.files(), repo.commits().length];
  const refusals = [["Undecided", draftOf("team1/01", [COUNT, WARN], { unfinished: [] })], ["RetrospectiveMissing", draftOf("team1/01", [COUNT, WARN], { retrospective: [] })]];
  for (const [name, draft] of refusals) {
    const before = await state();
    const closing = await job(repo, draft);
    if (name === "RetrospectiveMissing") assert.equal(closing.findings.some((one) => one.kind === "error" && one.rule === "A SPRINT ENDS WITH A RETROSPECTIVE"), true, JSON.stringify(closing.findings));
    const refused = await failure(closing.write());
    assert.equal(refused?.name, name, String(refused));
    if (name === "Undecided") assert.deepEqual(refused.items, ["ITM-002"]);
    await unchanged(before, name, "nothing was written");
  }
  await (await job(repo, draftOf("team1/01", [COUNT, WARN]))).write();
  const closed = await state();
  const again = await failure((await job(repo, draftOf("team1/01", [newItem("Show the count on the page")]))).write());
  assert.equal(again?.name, "AlreadyClosed", String(again));
  await unchanged(closed, "AlreadyClosed", "nothing was written");
});
