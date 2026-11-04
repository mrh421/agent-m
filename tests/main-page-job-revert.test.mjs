// MOD-main-page's route `job` — a commit written after the cancel is flagged and *Revert* is offered (ITM-1023), as the accepted text of docs/architecture/MOD-main-page.md (Interfaces: `job`, :121-123) and UC-036 (6a) state it:
// "*Cancel* for a queued, running or waiting job, whose end, cancelled, MOD-runtimes' `cancelJob` appends once its runtime confirms, and beside a commit written after the cancel, *Revert* (`revertAfterCancel`)"; "If the job later
// pushes anyway, Agent M flags the commit as written after the cancel, and offers to revert it."
// Run: node --test tests/main-page-job-revert.test.mjs
//
// Module: MOD-main-page
// Guards: A CANCELLED JOB WRITES NOTHING MORE; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK; ONE CLICK PER DECISION; UC-036
// Level: unit
//
// The real MOD-job-ledger, MOD-runtimes, MOD-repository-hosts, MOD-browser-store and MOD-site-frame run as they are; only `fetch` is faked: by tests/main-page-home-harness.mjs (the fake GitHub) and, over it, by this file, which answers
// GitHub's lists and reads for alice/product as the REST and GraphQL APIs document them: the commits of the branch named after the job and the files of each, the texts of files at commits (one GraphQL request; the harness answers the query of named files), the branch's reference,
// and the writes of one commit (the tree, the commit and the move of the ref), keeping what it was given. The product's token is stored. No request leaves the fixtures; nothing sleeps.
//
// Readings the module file leaves open, which the tests state (the pull request names them):
//   - For a job whose state is cancelled, the page has <section class="job-after-cancel"> when MOD-runtimes' liveState reports commits in writtenAfterCancel: <li class="job-after-cancel-commit"> per commit (its first twelve digits) and
//     one <button class="job-revert"> "Revert" beside them, which reverts all of them (one commit, as revertAfterCancel does). A job without such a commit, and a job that is not cancelled, has neither.
//   - A click of the person (an event the browser made) opens MOD-site-frame's confirmDecision (<section class="decision">, its confirm button "Revert the commits"); a click a script makes, and a declined dialog, write nothing.
//     <p class="job-revert-result"> says what came of it: the new commit's first twelve digits, or the failure's message (for Moved, that the branch moved and nothing was written).

import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { view } from "../src/main-page/index.mjs";
import { startRecord, appendToRecord } from "../src/job-ledger/index.mjs";
import { INSTANCE, PRODUCT, browser, byClass, draw, instanceFiles, network, smallProduct, timers, withEnd } from "./main-page-home-harness.mjs";

const job = view.routes.find((candidate) => candidate.name === "job");
const ID = "JOB-20261016-1000-7b01";
let net;
afterEach(() => { net?.restore(); timers.restore(); document.body.replaceChildren(); });

const flush = async () => { for (let n = 0; n < 80; n += 1) await new Promise((resolve) => setImmediate(resolve)); };
const trusted = async (node) => { const event = new Event("click"); Object.defineProperty(event, "isTrusted", { value: true }); node.dispatchEvent(event); await flush(); };
const walk = (root, match) => { const found = []; (function visit(node) { for (const child of node.children ?? []) { if (typeof child === "string") continue; if (match(child)) found.push(child); visit(child); } })(root); return found; };
const buttonsOf = (root, text) => walk(root, (node) => node.localName === "button" && node.textContent === text);
const sha = (n) => String(n).repeat(40);

const cancelledJob = (state) => {
  const { path, text } = startRecord({ id: ID, kind: "implement-item", worksOn: ["ITM-0900"], participant: "dev-cli", model: "model-x", route: "bridge lab-pc-4", run: null, retries: null, startedBy: "alice",
    start: new Date("2026-10-16T10:00:00Z"), agentM: { version: "2026.1.0", commit: "abc1234" }, inputs: [], limit: 5, task: "in parameters", conversation: null, destinations: [], params: {} });
  const taken = appendToRecord(text, { part: "taken", at: new Date("2026-10-16T10:00:00Z"), by: "lab-pc-4" });
  return { path, text: withEnd(taken, state) };
};
// The branch of the job: 3 and 2 after the cancel (11:00), 1 before it.
const commitOf = (n, date, parent, message) => ({ sha: sha(n), parents: parent ? [{ sha: sha(parent) }] : [], author: { login: "dev" }, commit: { author: { name: "Dev" }, committer: { date }, message } });
const COMMITS = [commitOf(3, "2026-10-16T11:30:00Z", 2, "Add the new file"), commitOf(2, "2026-10-16T11:10:00Z", 1, "Change the kept file"), commitOf(1, "2026-10-16T10:30:00Z", null, "First work")];
const FILES = { [sha(3)]: [{ filename: "src/new.txt", status: "added" }], [sha(2)]: [{ filename: "src/kept.txt", status: "modified" }, { filename: "src/gone.txt", status: "removed" }], [sha(1)]: [{ filename: "src/kept.txt", status: "added" }] };
const BEFORE = { [`${sha(1)}:src/kept.txt`]: "kept text before the cancel", [`${sha(1)}:src/gone.txt`]: "gone text before the cancel" };

/** The world: the cancelled job; GitHub's answers for its branch; `moved` makes the move of the ref refused (422) as GitHub does when the branch moved. Returns what was written. */
function world({ state = "cancelled", commits = COMMITS, moved = false } = {}) {
  net = network({ [PRODUCT]: smallProduct({ jobs: [cancelledJob(state)] }), [INSTANCE]: instanceFiles() }, { bridgeLists: null });
  net.install();
  const seen = { trees: [], commits: [], moves: 0, history: 0 };
  const inner = globalThis.fetch;
  const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(typeof input === "object" && !(input instanceof URL) ? input.url : String(input));
    const method = String(init.method ?? "GET").toUpperCase();
    const repo = `/repos/${PRODUCT}`;
    if (url.host === "api.github.com" && url.pathname === `${repo}/commits` && url.searchParams.get("sha") === ID) { seen.history += 1; return json(commits); }
    if (url.host === "api.github.com" && url.pathname === `${repo}/commits` ) return json({ message: "No commit found for SHA" }, 404);
    const detail = /^\/repos\/alice\/product\/commits\/([0-9a-f]{40})$/.exec(url.pathname);
    if (url.host === "api.github.com" && detail) return json({ files: FILES[detail[1]] ?? [] });
    if (url.host === "api.github.com" && url.pathname === `${repo}/pulls`) return json([]);
    if (url.host === "api.github.com" && url.pathname === `${repo}/actions/runs`) return json({ workflow_runs: [] });
    if (url.href === "https://api.github.com/graphql" && method === "POST" && /\bf\d+:object\(expression:/.test(JSON.parse(init.body).query)) {
      const query = JSON.parse(init.body).query;
      const data = {};
      for (const [, key, expression] of query.matchAll(/(f\d+):object\(expression:("(?:[^"\\]|\\.)*")\)/g)) {
        const text = BEFORE[JSON.parse(expression)];
        data[key] = text === undefined ? null : { text, isTruncated: false };
      }
      return json({ data: { repository: data } });
    }
    if (url.host === "api.github.com" && url.pathname.startsWith(`${repo}/git/`) && !url.pathname.includes("/git/trees/")) {
      if (method === "GET" && url.pathname.endsWith(`/git/ref/heads/${ID}`)) return json({ object: { sha: sha(3) } });
      if (method === "GET" && url.pathname.includes("/git/commits/")) return json({ tree: { sha: "tree-1" } });
      if (method === "POST" && url.pathname.endsWith("/git/commits")) { seen.commits.push(JSON.parse(init.body)); return json({ sha: sha(9) }); }
      if (method === "PATCH") { if (moved) return json({ message: "Update is not a fast forward" }, 422); seen.moves += 1; return json({}); }
    }
    if (url.host === "api.github.com" && method === "POST" && url.pathname === `${repo}/git/trees`) { seen.trees.push(JSON.parse(init.body)); return json({ sha: "tree-2" }); }
    return inner(input, init);
  };
  return { seen, context: browser() };
}
const drawJob = (context) => draw(job, context, { id: ID });
const dialog = () => byClass(document.body, "decision")[0];

// TST-1023101 · level: unit · module: MOD-main-page
// guards: A CANCELLED JOB WRITES NOTHING MORE; UC-036
// given: a cancelled job whose branch has two commits after the cancel and one before it; and one whose branch has none after it; and a done job with the same branch
// input: the route job drawn for each
// expect: the first page flags the two later commits (twelve digits each, not the earlier one) and has one button Revert; the second and the done job's page have no flag and no Revert; drawing writes nothing
test("TST-1023101 a cancelled job's page flags the commits written after the cancel and offers Revert; a job without one offers none", async () => {
  const flagged = world();
  const target = await drawJob(flagged.context);
  const items = byClass(target, "job-after-cancel-commit").map((node) => node.textContent);
  assert.deepEqual(items.map((text) => text.slice(0, 12)), [sha(3).slice(0, 12), sha(2).slice(0, 12)]);
  assert.equal(buttonsOf(target, "Revert").length, 1);
  assert.deepEqual([flagged.seen.trees, flagged.seen.commits, flagged.seen.moves], [[], [], 0]);
  net.restore();
  document.body.replaceChildren();
  const quiet = world({ commits: [COMMITS[2]] });
  const page = await drawJob(quiet.context);
  assert.deepEqual([byClass(page, "job-after-cancel").length, buttonsOf(page, "Revert").length], [0, 0]);
  net.restore();
  document.body.replaceChildren();
  const done = world({ state: "done" });
  const finished = await drawJob(done.context);
  assert.deepEqual([byClass(finished, "job-after-cancel").length, buttonsOf(finished, "Revert").length], [0, 0]);
});

// TST-1023102 · level: unit · module: MOD-main-page
// guards: A CANCELLED JOB WRITES NOTHING MORE; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK; ONE CLICK PER DECISION; UC-036
// given: the cancelled job with two commits after the cancel; the branch stands at the newest of them
// input: a click a script makes on Revert; the person's click on Revert with the dialog declined (its button Cancel); the person's click and the dialog's Revert the commits
// expect: the script's click opens no dialog and the declined one writes nothing; the confirmed click writes exactly one commit on the job's branch (the ref moved once): a tree that gives src/kept.txt and src/gone.txt their text from before the cancel and deletes src/new.txt; the page names the new commit
test("TST-1023102 one confirmed click reverts the commits in one commit, and a script's click or a declined dialog writes nothing", async () => {
  const { seen, context } = world();
  const target = await drawJob(context);
  const revert = buttonsOf(target, "Revert")[0];
  revert.dispatchEvent(new Event("click"));
  await flush();
  assert.equal(dialog(), undefined);
  await trusted(revert);
  assert.ok(dialog(), "the person's click opens the dialog");
  await trusted(buttonsOf(dialog(), "Cancel")[0]);
  assert.deepEqual([seen.trees, seen.commits, seen.moves], [[], [], 0]);
  await trusted(revert);
  await trusted(buttonsOf(dialog(), "Revert the commits")[0]);
  assert.equal(seen.trees.length, 1);
  assert.equal(seen.moves, 1);
  const byPath = Object.fromEntries(seen.trees[0].tree.map((entry) => [entry.path, entry]));
  assert.deepEqual(Object.keys(byPath).sort(), ["src/gone.txt", "src/kept.txt", "src/new.txt"]);
  assert.equal(byPath["src/kept.txt"].content, "kept text before the cancel");
  assert.equal(byPath["src/gone.txt"].content, "gone text before the cancel");
  assert.equal(byPath["src/new.txt"].sha, null, "the added file is removed");
  assert.deepEqual(seen.commits[0].parents, [sha(3)]);
  assert.equal(byClass(target, "job-revert-result")[0].textContent.includes(sha(9).slice(0, 12)), true, byClass(target, "job-revert-result")[0]?.textContent);
});

// TST-1023103 · level: unit · module: MOD-main-page
// guards: A CANCELLED JOB WRITES NOTHING MORE
// given: the cancelled job; the branch moved after it was read (GitHub refuses the move of the ref with 422)
// input: the person's click on Revert and the dialog's Revert the commits
// expect: no ref was moved; the page says that the branch moved and nothing was written
test("TST-1023103 where the branch moved meanwhile, the page says so and nothing is written", async () => {
  const { seen, context } = world({ moved: true });
  const target = await drawJob(context);
  await trusted(buttonsOf(target, "Revert")[0]);
  await trusted(buttonsOf(dialog(), "Revert the commits")[0]);
  assert.equal(seen.moves, 0);
  assert.match(byClass(document.body, "job-revert-result")[0].textContent, /moved meanwhile: nothing was written/i);
});
