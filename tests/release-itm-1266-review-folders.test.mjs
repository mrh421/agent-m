// Release tests of ITM-1266 — a review page reads only the folders it shows of its commit's tree. The behaviour is MOD-repository-hosts' `readSnapshot(ref, { folders })` and its `OutsideSnapshot`,
// each review route's `folders(params)` (MOD-review-pages) and the frame's load (MOD-site-frame, Route `folders`: "the frame reads the snapshot of the page with them … a route that names none is
// given the whole tree"), seen as UC-008 steps 1 and 2 and UC-020 steps 1 to 5 show them to a person: the list of the use cases with their statuses, one use case, the architecture, the
// specification with the entries that wait.
// Run: node --test tests/release-itm-1266-review-folders.test.mjs
//
// Module: MOD-site-frame; MOD-review-pages; MOD-repository-hosts
// Guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES; STATUS IS DERIVED FROM THE RECORDS; UC-008; UC-020
// Level: release
//
// Written for the release testing of sprint 110 by a participant who implemented none of ITM-1266 (RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER). The world is the one of the page tests
// (tests/app-harness.mjs: the real app src/site-frame/dashboard-app.mjs over a counting fake GitHub that serves the batch request and the query of folders' entries) with the fixture product
// tests/fixtures/architecture. The implementer's tests (tests/repository-hosts-snapshot-folders.test.mjs, TST-1266101 to 1266110 of tests/load-per-view.test.mjs) count the requests of one
// route over their fixture; these cases look at what a person sees on every address and at the commit a move between addresses reads. Readings the texts leave open, which the cases state:
//   - "shows what it showed before": the page's text is judged by the facts of the fixture (which files are accepted, changed or open, what a file says), written in each case; the same
//     expectations hold of the app before the change (the cases of content, TST-1266301, pass there).
//   - "a move between routes reads the same pinned commit": the snapshot the load pinned is read again, when the route moved to needs folders it lacks, at the commit it pinned — whatever the branch
//     stands at by then — and the page shows that commit's files (MOD-site-frame, Route `folders`; the frame's `holdFolders`).
//   - "a path outside the folders fails by name": OutsideSnapshot names the path; a path inside the folders that the commit lacks is still null, and a path that only begins like a folder
//     (docs/use-cases-old/…, SPEC.md.bak) is outside.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { blobSha } from "../src/text-tools/index.mjs";
import { sectionText } from "../src/spec-document/index.mjs";
import { connect, parseAddress } from "../src/repository-hosts/index.mjs";
import { repoServer, openDashboard, REPO, TOKEN, askedFor } from "./app-harness.mjs";
import { recordText, approvalPath, reviewedRecord } from "./approval-records.mjs";

// ---------------------------------------------------------------- the product: tests/fixtures/architecture with records, a queue and files beside the folders

const FIX = fileURLToPath(new URL("./fixtures/architecture/", import.meta.url));
const base = {};
// The fixture keeps its test file as tests/reader.test.js.fixture, so that node --test tests/ does not run it; the walk builds it back under its name.
(function walk(dir) {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) walk(p); else base[relative(FIX, p).split("\\").join("/").replace(/\.fixture$/, "")] = readFileSync(p, "utf8");
  }
})(FIX);
const UC1 = "docs/use-cases/UC-001-read-a-file.md", UC2 = "docs/use-cases/UC-002-show-the-status.md";
const ARC = "docs/architecture/ARC-001-static-client.md", READER = "docs/architecture/MOD-reader.md";
const OPEN = "docs/spec-freigaben/2026-09-02_open";
// Files that lie beside the folders a page reads and begin like them, and a job record and a source the review pages do not show.
const BESIDE = { "docs/use-cases-old/UC-099-old.md": "# UC-099 Old\n", "docs/approvals-old/x.md": "old\n", "SPEC.md.bak": "# backup\n", "docs/jobs/JOB-1.md": "# JOB-1\n" };
const sorted = (list) => [...list].sort();
const count = (requests, what) => requests.filter((r) => r === what).length;

/** The product: UC-001 and ARC-001 accepted, UC-002 and MOD-reader accepted in an earlier text and edited since (their earlier texts are the server's history), one change queue whose entry waits. */
async function product() {
  const f = { ...base, "docs/use-cases/README.md": "# Use cases\n\nThe overview.\n", "docs/approvals/README.md": "# Approval records\n", ...BESIDE };
  const history = [];
  const rec = async (id, path, text) => {
    if (text !== f[path]) history.push(text);
    f[approvalPath(id, await blobSha(text))] = recordText(reviewedRecord(path, await blobSha(text)));
  };
  await rec("UC-001", UC1, f[UC1]);
  await rec("UC-002", UC2, f[UC2].replace("Show the status", "Show a status"));
  await rec("ARC-001", ARC, f[ARC]);
  await rec("MOD-reader", READER, f[READER].replace("Reads files at", "Reads a file at"));
  const section = sectionText(f["SPEC.md"], "## 1. Rules");
  f[`${OPEN}/index.md`] = "# Queue\n\n**Zieldatei aller Einträge:** `products/fixture/SPEC.md`\n\n| Nr | Datei | Anker (Überschrift, wortgetreu) | bis (exklusiv) | Commits |\n|---|---|---|---|---|\n| 01 | `SPEC.md` | ## 1. Rules | — | — |\n";
  f[`${OPEN}/01-more.md`] = `${section}\n**RULE TWO** *(PO, 2026-09-02)*\nA second rule.\n*Check:* none\n`;
  f[`${OPEN}/01-more.begruendung.md`] = "# Why\n\nA second rule.\n";
  f[`${OPEN}/entscheidungen.md`] = "# Decisions\n\nAppend-only.\n";
  return { files: f, history };
}
const serverOf = async () => { const { files, history } = await product(); return repoServer({ files, history }); };

// TST-1266301 · level: release · module: MOD-site-frame, MOD-review-pages
// guards: STATUS IS DERIVED FROM THE RECORDS; UC-008; UC-020
// given: the fixture product — UC-001 accepted, UC-002 accepted in an earlier text and edited since; ARC-001 accepted, MOD-reader changed since acceptance, MOD-review resting on UC-002, which is not accepted; one change queue whose entry waits — and files beside the folders (docs/use-cases-old/, docs/approvals-old/, SPEC.md.bak, a job record); a token
// input: open each address of the review pages in a load of its own: #uc, #uc/UC-002, #use-case, #use-case/id=UC-001, #use-case/id=all, #arc, #arc/MOD-review, #decision/id=ARC-001, #module/id=MOD-reader, #spec, #spec-entry, #spec-entry/id=spec-2026-09-02_open-01
// expect: each page shows what the fixture says — the use cases with accepted and changed since acceptance, the difference of UC-002 to its accepted text, the architecture files with their statuses, MOD-review naming UC-002 as what it rests on and offering no Accept, the difference and impact list of MOD-reader, the entry that waits on #spec and its text on its own page —, no page is a failure (none says it could not be drawn or names a path outside its snapshot) and none shows a file beside the folders (UC-099); the same expectations hold of the app before the change
// Planted fault: the module files' `file` folders without `docs/use-cases` and the SPEC (`file: ARCHITECTURE_LIST` for MODULES in src/review-pages/kinds.mjs) make #arc/MOD-review read a use case outside its snapshot, and the case fails on that page's text.
test("every address of the review pages shows what it showed, from its folders, with no read outside them", async () => {
  const cases = [
    ["#uc", [/UC-001/, /UC-002/, /<span class="badge b-accepted">accepted<\/span>/, /<span class="badge b-changed">changed since acceptance<\/span>/]],
    ["#uc/UC-002", [/Show a status/, /Changed since it was last accepted/, /<span class="ddel">- title: Show a status/]],
    ["#use-case", [/UC-001/, /UC-002/, /accepted/, /changed since acceptance/]],
    ["#use-case/id=UC-001", [/Read a file/]],
    ["#use-case/id=all", [/UC-002/, /Accept all/]],
    ["#arc", [/ARC-001/, /MOD-reader/, /MOD-page/, /MOD-review/]],
    ["#arc/MOD-review", [/Rests on what is not accepted/, /<li class="open-name">UC-002<\/li>/]],
    ["#decision/id=ARC-001", [/ARC-001/]],
    ["#module/id=MOD-reader", [/MOD-reader/, /Changed since it was last accepted/]],
    ["#spec", [/SPEC changes waiting for acceptance/, /href="#spec-entry\/id=spec-2026-09-02_open-01"/]],
    ["#spec-entry", [/spec-2026-09-02_open-01|2026-09-02_open/]],
    ["#spec-entry/id=spec-2026-09-02_open-01", [/A second rule/]],
  ];
  for (const [hash, expected] of cases) {
    const srv = await serverOf();
    const page = await openDashboard({ server: srv, hash });
    const main = page.main();
    assert.doesNotMatch(main, /could not be drawn|outside what this snapshot|OutsideSnapshot/, `${hash}: ${main.slice(0, 300)}`);
    for (const pattern of expected) assert.match(main, pattern, `${hash}`);
    assert.doesNotMatch(main, /UC-099/, `${hash}: a file beside the folders is not shown`);
  }
});

// The folders and files of the repository that ITM-1266's Outcome sets aside as never looked at by a review page's list, and, for each address, the folders it cannot do without.
const NEVER = ["tests", "src", "docs/gates", "docs/backlog", "docs/jobs"];
const NEEDS = {
  "#uc": ["docs/use-cases", "docs/approvals"], "#use-case": ["docs/use-cases", "docs/approvals"], "#arc": ["docs/architecture", "docs/approvals"], "#decision": ["docs/architecture", "docs/approvals"],
  "#module": ["docs/architecture", "docs/approvals"], "#spec": ["SPEC.md", "docs/spec-freigaben", "docs/approvals"], "#spec-entry": ["SPEC.md", "docs/spec-freigaben"],
};

// TST-1266302 · level: release · module: MOD-site-frame, MOD-review-pages, MOD-repository-hosts
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES; UC-008; UC-020
// given: the product of TST-1266301, whose tree also holds tests/, src/ and vendor/ (the fixture's), a job record and files beside the folders; a token
// input: open the lists #uc, #use-case, #arc, #decision, #module, #spec and #spec-entry, each in a load of its own
// expect: each load sends the commit once, its folders in one request and no tree request; the folders it names include the ones its list cannot do without (use cases or architecture, the records; for #spec the SPEC and the queues) and none of tests, src, docs/gates, docs/backlog or docs/jobs; the batch requests name no file outside what the folders hold
// Planted fault: the frame reading the whole tree for the review addresses (`foldersOf` giving null in src/site-frame/dashboard-app.mjs) sends the tree request and none for folders, and the case fails on the first address.
test("a list page names the folders it needs, none of the folders it never looks at, and reads no tree", async () => {
  for (const hash of Object.keys(NEEDS)) {
    const srv = await serverOf();
    const page = await openDashboard({ server: srv, hash });
    assert.equal(count(page.requests, "commit"), 1, `${hash}: the commit once`);
    assert.equal(count(page.requests, "folders"), 1, `${hash}: the folders in one request`);
    assert.equal(count(page.requests, "tree"), 0, `${hash}: no tree request`);
    const named = srv.folders[0];
    for (const needed of askedFor(NEEDS[hash])) assert.ok(named.includes(needed), `${hash} names ${needed}: ${named}`);
    for (const never of NEVER) assert.equal(named.includes(never) || named.includes(`${never}/`), false, `${hash} names ${never}`);
    const parentOf = (path) => path.slice(0, Math.max(path.lastIndexOf("/"), 0));
    const inside = (path) => named.some((folder) => (folder.endsWith("/") ? parentOf(path) === folder.slice(0, -1) : path === folder || path.startsWith(`${folder}/`)));
    assert.deepEqual(srv.batches.flat().filter((path) => !inside(path)), [], `${hash}: no file read outside the folders`);
  }
});

// ---------------------------------------------------------------- a move between routes reads the pinned commit

const NEWER = "d".repeat(40);
const OLDER = "c0ffee".padEnd(40, "0");
/**
 * Two commits of the product on one fake GitHub: the one the page loads (the harness's c0ffee…) and a newer one, which the branch stands at once `moved` is set — its SPEC reworded, and a use case UC-050
 * added. A request that names the older commit, in its address or in a query of its folders, is answered by the first, whatever the branch stands at. `asked` keeps the address and body of every request.
 */
async function branchThatMoves() {
  const { files, history } = await product();
  const older = await repoServer({ files, history });
  const newer = await repoServer({ files: { ...files, "SPEC.md": files["SPEC.md"].replace("The first rule.", "The first rule, reworded in a newer commit."),
    "docs/use-cases/UC-050-newer.md": "---\nid: UC-050\ntitle: A newer use case\narea: 1\nactors:\n  - Reader\nrealises: []\n---\n# UC-050 A newer use case\n" }, history, head: NEWER });
  const state = { moved: false, asked: [] };
  const requests = [], taken = new Map([[older, 0], [newer, 0]]);
  const fetch = async (input, init = {}) => {
    const url = new URL(typeof input === "object" && !(input instanceof URL) ? input.url : String(input));
    state.asked.push({ address: `${url.pathname}${url.search}`, body: typeof init.body === "string" ? init.body : "" });
    const text = `${url.pathname} ${init.body ?? ""}`;
    const chosen = text.includes(NEWER) || (state.moved && /\/commits\/main$|\/git\/ref\/heads\/main$/.test(url.pathname)) ? newer : older;
    try { return await chosen.fetch(input, init); } finally {
      for (const server of [older, newer]) { requests.push(...server.requests.slice(taken.get(server))); taken.set(server, server.requests.length); }
    }
  };
  return { state, fetch, requests, get pending() { return older.pending + newer.pending; } };
}
// The commits the reads of folders named: a tree of "<commit>:<folder>", or a commit's own entries (a tree read without recursive).
const commitsOfFolders = (asked) => asked.map((request) => /\/git\/trees\/([0-9a-f]{40})(:[^?]*)?(\?.*)?$/.exec(request.address))
  .filter((match) => match && (match[2] || !String(match[3] ?? "").includes("recursive"))).map((match) => match[1]);

// TST-1266303 · level: release · module: MOD-site-frame, MOD-repository-hosts
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES; UC-020
// given: the product at the commit c0ffee…, loaded at #uc; a token; the branch then moves to a newer commit that rewords the SPEC and adds the use case UC-050
// input: the person moves to #use-case (the same folders), and then to #spec, whose folders the snapshot lacks; then back to #uc
// expect: the move to #use-case sends no request for folders; the move to #spec reads the commit it pinned again with the folders of the specification — the address of its commit request names c0ffee…, never the branch main, and its reads of folders name only c0ffee… — and shows that commit's SPEC and the entry that waits; the move back to #uc names c0ffee… again and its list does not show UC-050; at no point does a request name the newer commit
// Planted fault: the frame reading the branch in place of the pinned commit when it holds folders anew (`readSnapshot(T.ref, …)` in place of `readSnapshot(state.commit, …)` in holdFolders of src/site-frame/dashboard-app.mjs) reads the newer commit, and the case fails on the branch being read again.
test("a move to a route whose folders the snapshot lacks reads the pinned commit again, and shows that commit", async () => {
  const world = await branchThatMoves();
  const page = await openDashboard({ server: world, hash: "#uc" });
  assert.match(page.main(), /UC-001/);
  assert.deepEqual([...new Set(commitsOfFolders(world.state.asked))], [OLDER], "known positive: the load named the older commit");
  world.state.moved = true;
  const same = await page.go("#use-case");
  assert.equal(count(same, "folders"), 0, "the same folders are held: no request for them");
  const before = world.state.asked.length;
  const spec = await page.go("#spec");
  assert.equal(count(spec, "folders"), 1, "the folders of the specification are read");
  const afterSpec = world.state.asked.slice(before);
  assert.equal(afterSpec.some((request) => /\/commits\/main$/.test(request.address)), false, "the branch is not read again");
  assert.equal(afterSpec.some((request) => request.address.endsWith(`/commits/${OLDER}`)), true, "the pinned commit is read");
  assert.deepEqual([...new Set(commitsOfFolders(afterSpec))], [OLDER]);
  assert.match(page.main(), /SPEC changes waiting for acceptance/);
  assert.match(page.main(), /spec-2026-09-02_open-01/);
  assert.doesNotMatch(page.main(), /reworded in a newer commit/);
  const mark = world.state.asked.length;
  await page.go("#uc");
  assert.deepEqual([...new Set(commitsOfFolders(world.state.asked.slice(mark)))], [OLDER]);
  assert.doesNotMatch(page.main(), /UC-050/, "the newer commit's use case is not shown");
  assert.match(page.main(), /UC-001/);
  assert.equal(world.state.asked.some((request) => request.address.includes(NEWER) || request.body.includes(NEWER)), false, "no request names the newer commit");
});

// ---------------------------------------------------------------- a path outside the folders fails by name

const failure = (promise) => Promise.resolve(promise).then(() => null, (error) => error);

// TST-1266304 · level: release · module: MOD-repository-hosts
// guards: A REMOTE INTERFACE NAMES HOW IT FAILS; A PAGE LOAD READS THE REPOSITORY IN BATCHES
// given: the product of TST-1266301 on the fake GitHub of the page tests, with docs/use-cases-old/UC-099-old.md, docs/approvals-old/x.md and SPEC.md.bak beside the folders and a job record; a host with a token
// input: readSnapshot("main", { folders: ["docs/use-cases/", "docs/approvals", "SPEC.md"] }); then read of docs/use-cases-old/UC-099-old.md and of SPEC.md.bak, blob of docs/jobs/JOB-1.md, readMany of a file inside and a file outside, read of a file inside the folders that the commit lacks and of one that it holds; and a list of folders with a part ".." or a leading slash
// expect: the paths are exactly the files of the three — the folder given with a slash included, nothing that only begins like a folder name —, each with its blob; each read outside fails with OutsideSnapshot naming the path, blob too, readMany naming the outside one and fetching neither; no request is sent for any of them; the missing file inside answers null and the held one its text; a list of folders that is not a list of paths in the repository is a TypeError
// Planted fault: the check of the folders comparing by the beginning of the path alone (`startsWith(folder)` in place of `startsWith(folder + "/")` in readSnapshot of src/repository-hosts/index.mjs) admits docs/use-cases-old/UC-099-old.md, and the case fails on its read, which is answered in place of refused.
test("a path outside the folders fails by name, one that only begins like a folder is outside, and a missing file inside is null", async () => {
  const { files, history } = await product();
  const srv = await repoServer({ files, history });
  const real = globalThis.fetch;
  globalThis.fetch = srv.fetch;
  try {
    const host = connect(parseAddress(`https://github.com/${REPO}`), { token: TOKEN });
    const snapshot = await host.readSnapshot("main", { folders: ["docs/use-cases/", "docs/approvals", "SPEC.md"] });
    const held = Object.keys(files).filter((path) => path.startsWith("docs/use-cases/") || path.startsWith("docs/approvals/") || path === "SPEC.md");
    assert.ok(held.length >= 8, "known positive: the folders hold files");
    assert.deepEqual(sorted(snapshot.paths), sorted(held));
    for (const path of held) assert.equal(snapshot.blob(path), await blobSha(files[path]), path);
    const before = srv.requests.length;
    for (const outside of ["docs/use-cases-old/UC-099-old.md", "SPEC.md.bak", "docs/approvals-old/x.md"]) {
      const refused = await failure(snapshot.read(outside));
      assert.equal(refused?.name, "OutsideSnapshot", outside);
      assert.equal(refused.path, outside);
      assert.match(refused.message, new RegExp(outside.replace(/[.]/g, "\\.")));
    }
    let blobError = null;
    try { snapshot.blob("docs/jobs/JOB-1.md"); } catch (error) { blobError = error; }
    assert.equal(blobError?.name, "OutsideSnapshot");
    assert.equal(blobError.path, "docs/jobs/JOB-1.md");
    const many = await failure(snapshot.readMany([UC1, "docs/jobs/JOB-1.md"]));
    assert.equal(many?.name, "OutsideSnapshot");
    assert.equal(many.path, "docs/jobs/JOB-1.md");
    assert.equal(srv.requests.length, before, "no request is sent for a path outside the folders, nor for the file read with it");
    assert.equal(await snapshot.read("docs/use-cases/UC-404-missing.md"), null, "inside the folders a file the commit lacks is null");
    assert.equal(await snapshot.read("SPEC.md"), files["SPEC.md"]);
    for (const bad of [["../docs"], ["/docs"], ["docs//use-cases"], []]) {
      const refused = await failure(host.readSnapshot("main", { folders: bad }));
      assert.equal(refused?.name, "TypeError", JSON.stringify(bad));
    }
  } finally { globalThis.fetch = real; }
});
