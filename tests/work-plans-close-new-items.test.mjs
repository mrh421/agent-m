// ITM-987 — closing a sprint adds the feedback's new items to the backlog, in the close's one commit (UC-041 step 6), as the accepted text of docs/architecture/MOD-work-plans.md (b65cefcc9) states
// closeSprint: it "adds the feedback's new items to the backlog as `saveItems` does, and records for each unfinished item whether it goes back to the backlog or into the team's next sprint; all in one commit",
// with the errors "`ItemsRefused { findings }`, and the host's"; and saveItems: "`backlogFindings` first, and with an error finding nothing is written; [...] a new item gets an identifier that no history holds".
// Run: node --test tests/work-plans-close-new-items.test.mjs
//
// Module: MOD-work-plans
// Guards: UC-041; A SPRINT ENDS WITH A REVIEW OF ITS INCREMENT; A BACKLOG ITEM NAMES WHAT IT REALISES; THE NAME IS THE ID AND IT SURVIVES
// Level: unit
//
// The host is a fake of MOD-repository-hosts' Host with the product's files at one head: readSnapshot, repositoryInfo (its default branch main), readHistory (a withdrawn ITM-1400 that no file holds) and
// commitFiles, each call recorded; nothing reaches the network. The new items are Documents as saveItems takes them, without an identifier. closeSprint's types stay as they are: `written` names the item
// files beside the record. Each test states its input and its expected result before it runs (given / input / expect). The one-commit check is a function of this file, and its counter-proof is a case of
// its own: the commits of a close that wrote the items in a second commit fail it.

import test from "node:test";
import assert from "node:assert/strict";
import { artifactSchemas, readDocument } from "../src/documents/index.mjs";
import { closeSprint, planSchemas } from "../src/work-plans/index.mjs";

const HEAD = "a1b2c3d4e5f60718293a4b5c6d7e8f9012345678";
const TRAILERS = ["Agent-M-Job: JOB-20261030-0900-ab12"];
const RECORD = "docs/backlog/sprints/team1/01.md";
const OPEN = "---\nsprint: 1\ngoal: g\nstart: 2026-10-12\nend: 2026-10-18\ncloser: alice\nbranch:\nselection:\n  - ITM-001\n---\n# team1 Sprint 01\n";

const moduleFile = (id) => ({ kind: "module", path: `docs/architecture/${id}.md`, id, fields: { id, uses: [] } });
const ARCHITECTURE = [moduleFile("MOD-store"), moduleFile("MOD-pages")];
const itemText = (id, title) => ["---", `id: ${id}`, `title: ${title}`, "level: module", "realises:", "  - UC-032", "modules:", "  - MOD-store", "builds_on: []", "tests:", "  - unit",
  "origin:", "  - UC-032", "---", `# ${id} ${title}`, "", "## Outcome", "", "Done.", "", "## Acceptance", "", "- a unit test.", ""].join("\n");
const FILES = { [RECORD]: OPEN, "docs/backlog/ITM-001-store.md": itemText("ITM-001", "Read the store"), "docs/backlog/ITM-003-mail.md": itemText("ITM-003", "Send the mail") };
// The history holds ITM-1400, withdrawn: higher than any file's (the highest file is ITM-003).
const HISTORY = [{ commit: "h1", changes: [{ path: "docs/backlog/ITM-1400-withdrawn.md", from: null }] }];

const FACTS = { increment: [{ item: "ITM-001", pullRequest: "#7", realises: ["UC-032"], tests: ["tests/store.test.mjs"] }], notDone: [],
  numbers: { failedJobs: 0, retriedJobs: 0, correctionRounds: 0, waitingAtGates: "0 hours", waitingForAPerson: "0 hours", flakyTests: [], cost: "unknown" } };
const newItem = (title, over = {}) => ({ fields: { title, level: "module", realises: ["UC-032"], modules: ["MOD-pages"], tests: ["unit"], origin: ["UC-032"], ...over },
  sections: [{ heading: "## Outcome", text: `\n${title}.\n\n` }, { heading: "## Acceptance", text: "\n- a unit test.\n" }] });
const COUNT = newItem("Count the stored rows");
const WARN = newItem("Warn on a full store");
const close = (newItems) => ({ sprint: "team1/01",
  review: { feedback: [{ line: "Show how many rows the store holds.", goes: "new item", item: null }, { line: "Warn before the store is full.", goes: "new item", item: null }],
    tookPart: ["alice"], sources: null },
  unfinished: [], retrospective: [{ text: "Write the feedback down as it comes.", kind: "change", goes: "team agreement" }], newItems });
const COUNT_PATH = "docs/backlog/ITM-1401-count-the-stored-rows.md";
const WARN_PATH = "docs/backlog/ITM-1402-warn-on-a-full-store.md";

// A fake host with FILES at HEAD and HISTORY as the default branch's history.
function hostWith(files = FILES, history = HISTORY) {
  const calls = [];
  return {
    calls,
    async repositoryInfo() { calls.push(["repositoryInfo"]); return { defaultBranch: "main" }; },
    async readSnapshot(ref) {
      calls.push(["readSnapshot", ref]);
      return { ref, commit: HEAD, paths: Object.keys(files), blob: (p) => (p in files ? `blob-${p}` : null), read: async (p) => { calls.push(["read", p]); return files[p] ?? null; } };
    },
    async readHistory(path, options) { calls.push(["readHistory", path, options]); return history; },
    async commitFiles(change) { calls.push(["commitFiles", change]); return { commit: "c".repeat(40), url: "https://example.org/c" }; },
  };
}
const committed = (host) => host.calls.filter(([what]) => what === "commitFiles").map(([, change]) => change);
const failure = (p) => Promise.resolve(p).then(() => null, (e) => e);

// The one-commit check: exactly one commit was made, and it holds every one of `paths`.
const inOneCommit = (commits, paths) => commits.length === 1 && paths.every((path) => commits[0].files.some((file) => file.path === path));

// TST-987001 · level: unit · module: MOD-work-plans
// guards: UC-041; A SPRINT ENDS WITH A REVIEW OF ITS INCREMENT; THE NAME IS THE ID AND IT SURVIVES
// given: team1's open sprint 01; the backlog's files ITM-001 and ITM-003, and a history that holds the withdrawn ITM-1400; a close with two feedback lines going to new items and two new items without an identifier, "Count the stored rows" and "Warn on a full store", both realising UC-032 and changing MOD-pages
// input: closeSprint(host, the close, context at HEAD with the job's trailers)
// expect: the inOneCommit check holds: one commit on main at HEAD of the sprint's record, docs/backlog/ITM-1401-count-the-stored-rows.md and docs/backlog/ITM-1402-warn-on-a-full-store.md; the record is only appended to, its ## Review first; each item file reads back with its identifier, ITM-1401 and ITM-1402, which no history holds; the history was asked for the default branch; repositoryInfo was asked once; the result is { commit, written } with written naming the three files
test("closeSprint — a close with two new items commits the sprint record and both item files in one commit, each with an identifier no history holds", async () => {
  const host = hostWith();
  const result = await closeSprint(host, close([COUNT, WARN]), { facts: FACTS, architecture: ARCHITECTURE, head: HEAD, trailers: TRAILERS });
  const commits = committed(host);
  assert.ok(inOneCommit(commits, [RECORD, COUNT_PATH, WARN_PATH]), `one commit of the record and both items: ${JSON.stringify(commits.map((c) => c.files.map((f) => f.path)))}`);
  const [change] = commits;
  assert.deepEqual([change.branch, change.expectedHead], ["main", HEAD]);
  assert.deepEqual(change.files.map((f) => f.path).sort(), [COUNT_PATH, WARN_PATH, RECORD].sort());
  assert.ok(change.message.endsWith(TRAILERS[0]), change.message);
  const textOf = (path) => change.files.find((f) => f.path === path).text;
  assert.ok(textOf(RECORD).startsWith(OPEN), "the record is only appended to");
  assert.equal(readDocument(planSchemas.sprint, RECORD, textOf(RECORD)).appended[0].heading, "## Review");
  const schema = artifactSchemas().item;
  assert.deepEqual([readDocument(schema, COUNT_PATH, textOf(COUNT_PATH)).fields.id, readDocument(schema, WARN_PATH, textOf(WARN_PATH)).fields.id], ["ITM-1401", "ITM-1402"]);
  const asked = host.calls.filter(([what]) => what === "readHistory");
  assert.ok(asked.length >= 1 && asked.every(([, , options]) => options?.ref === "main"), JSON.stringify(asked));
  assert.equal(host.calls.filter(([what]) => what === "repositoryInfo").length, 1);
  assert.equal(result.commit, "c".repeat(40));
  assert.deepEqual([...result.written].sort(), [COUNT_PATH, WARN_PATH, RECORD].sort());
});

// TST-987002 · level: unit · module: MOD-work-plans
// guards: A BACKLOG ITEM NAMES WHAT IT REALISES; UC-041
// given: team1's open sprint 01 and the same backlog; a close with two new items, "Count the stored rows" realising UC-032 and "Warn on a full store" realising nothing
// input: closeSprint(host, the close, context at HEAD)
// expect: refused with ItemsRefused, whose findings hold an error of the rule A BACKLOG ITEM NAMES WHAT IT REALISES saying that the item realises nothing; nothing is committed — neither the record nor the first item
test("closeSprint — a new item that realises nothing is refused with ItemsRefused, and nothing is written", async () => {
  const host = hostWith();
  const refused = await failure(closeSprint(host, close([COUNT, newItem("Warn on a full store", { realises: [] })]), { facts: FACTS, architecture: ARCHITECTURE, head: HEAD, trailers: [] }));
  assert.equal(refused?.name, "ItemsRefused", String(refused));
  assert.ok(Array.isArray(refused.findings) && refused.findings.some((one) => one.kind === "error" && one.rule === "A BACKLOG ITEM NAMES WHAT IT REALISES" && /realises nothing/.test(one.what)), JSON.stringify(refused.findings));
  assert.deepEqual(committed(host), []);
});

// TST-987003 · level: unit · module: MOD-work-plans
// guards: UC-041
// given: the commits a close makes, as commitFiles receives them: (a) one commit of the record and both item files; (b) the record in a first commit and both item files in a second
// input: inOneCommit(commits, [the record, both item files]) on each
// expect: (a) holds, the known positive; (b) fails — the counter-proof: a close that wrote the items in a second commit fails the one-commit check of TST-987001
test("the one-commit check holds for one commit of the record and the items, and fails when the items stand in a second commit", () => {
  const files = (...paths) => paths.map((path) => ({ path, text: "x" }));
  assert.equal(inOneCommit([{ files: files(RECORD, COUNT_PATH, WARN_PATH) }], [RECORD, COUNT_PATH, WARN_PATH]), true);
  assert.equal(inOneCommit([{ files: files(RECORD) }, { files: files(COUNT_PATH, WARN_PATH) }], [RECORD, COUNT_PATH, WARN_PATH]), false);
});

// TST-987004 · level: unit · module: MOD-work-plans
// guards: UC-041; A SPRINT ENDS WITH A REVIEW OF ITS INCREMENT
// given: team1's open sprint 01 and a backlog of fifty items besides ITM-001 and ITM-003, on a fake host whose snapshot counts each read; known positive: TST-987001's close with two new items over the same backlog, which reads the item files
// input: closeSprint(host, a close with newItems [], context at HEAD)
// expect: one commit of the sprint's record only; the snapshot was asked to read the sprint's record and no item file, and readHistory was not asked; the known positive's close read item files and asked readHistory
test("closeSprint — a close without new items reads the sprint's record and no item file, and asks no history", async () => {
  const many = Object.fromEntries(Array.from({ length: 50 }, (_, n) => {
    const id = `ITM-${String(100 + n).padStart(3, "0")}`;
    return [`docs/backlog/${id}-work.md`, itemText(id, `Work ${n}`)];
  }));
  const itemReads = (host) => host.calls.filter(([what, path]) => what === "read" && path !== RECORD);
  const known = hostWith({ ...FILES, ...many });
  await closeSprint(known, close([COUNT, WARN]), { facts: FACTS, architecture: ARCHITECTURE, head: HEAD, trailers: [] });
  assert.ok(itemReads(known).length > 0 && known.calls.some(([what]) => what === "readHistory"), "known positive: a close with new items reads the items and the history");
  const host = hostWith({ ...FILES, ...many });
  const result = await closeSprint(host, close([]), { facts: FACTS, architecture: ARCHITECTURE, head: HEAD, trailers: [] });
  assert.deepEqual(committed(host).map((c) => c.files.map((f) => f.path)), [[RECORD]]);
  assert.deepEqual(result.written, [RECORD]);
  assert.deepEqual(host.calls.filter(([what]) => what === "read").map(([, path]) => path), [RECORD]);
  assert.equal(host.calls.filter(([what]) => what === "readHistory").length, 0);
});
