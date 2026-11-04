// MOD-review-pages' history of a kind (ITM-898), as the accepted text of docs/architecture/MOD-review-pages.md states it:
// "`<k>` — … and a link to `<k>/history`." and "`<k>/history` — the history of the kind's changes: its approval records, newest first, each with the file it names, the person who
// committed it and the date; opened only from the link on `<k>`." and, in its Uses, "MOD-repository-hosts.readHistory — on `<k>/history` only, the commits that added the approval
// records under `docs/approvals/`, each with its author and date." The address of the page is `#<route>/id=history`, as `<k>/all` is `#<route>/id=all` (ITM-898's Outcome).
// Run: node --test tests/review-pages-history.test.mjs
//
// Module: MOD-review-pages
// Guards: UC-008; UC-023; STATUS IS DERIVED FROM THE RECORDS; AN APPROVAL NAMES THE EXACT TEXT; A PAGE LOAD READS THE REPOSITORY IN BATCHES; A REMOTE INTERFACE NAMES HOW IT FAILS
// Level: component
//
// The pages run as they are over MOD-repository-hosts' real GitHub host, behind a fake GitHub that records every request and answers as GitHub's REST API and GraphQL API answer
// (the repository, the commit of its default branch and its tree, "List commits" with its path filter, "Get a commit" with its files, the files one by one and in a batch). The
// real MOD-approvals, MOD-documents and MOD-browser-store run as they are. Nothing reaches the network: `fetch` is replaced for the length of one page.
// Readings the test takes where the module file leaves one open (each quoted sentence is the module file's; the reading adds nothing to it but what is named):
//   - "a link to `<k>/history`": `<k>` ends with it, as the last element of the page, an <a> whose href is `#<route>/id=history`; the link's text is not fixed.
//   - "its approval records, newest first, each with the file it names, the person who committed it and the date": one <tr data-id="<identifier of the record>"> for each record,
//     in a table, with three <td> — the file the record names (its `file` line, as it was when the record was written; for a record of a SPEC change entry, which names no `file`,
//     its `proposal`), the person (the account the host names for the commit's author, else the author's name) and the date (the commit's date, as the host gives it, whole).
//     Records of one commit stand in the order the commit's changes list them; commits stand as readHistory lists them, newest first.
//   - "the kind's approval records": the records whose identifier is one of the kind's files in the default branch (use cases UC-…, decisions ARC-…, modules MOD-…), and for the
//     SPEC change entries those whose identifier starts with `spec-`. Each is read by its text, and only those of the kind are read.
//   - The commits come from one readHistory of `docs/approvals`; the page makes no read of the history for a record by itself.
// Each test states its input and its expected result before it runs (given / input / expect). The counter-proofs are recorded in the pull request.

import { emptyStorage } from "./review-pages-harness.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { openStore, writeSetting } from "../src/browser-store/index.mjs";
import { connect, parseAddress } from "../src/repository-hosts/index.mjs";

const pages = await import("../src/review-pages/index.mjs");

// ---------------------------------------------------------------- the repository, with the history of its approval records

const REPO = "alice/thesis-tool";
const ADDRESS = `https://github.com/${REPO}`;
const TOKEN = "github_pat_ALICEthesisHISTORY0123456789abcdef";
const text = (...lines) => `${lines.join("\n")}\n`;
const sha1 = (s) => createHash("sha1").update(s).digest("hex");
const blobOf = (body) => sha1(`blob ${Buffer.byteLength(body)}\0${body}`);
const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } });
const recordOf = (id, kind, path, body) => [`docs/approvals/${id}-${blobOf(body).slice(0, 12)}.md`, text(`kind: ${kind}`, `file: ${path}`, `blob: ${blobOf(body)}`)];

const useCase = (n, title) => text(`# UC-0${n} ${title}`, "", `**Goal.** ${title}.`);
const UC42_OLD = useCase(42, "Extend a loan once"), UC42 = useCase(42, "Extend a loan"), UC43 = useCase(43, "Return a book"), UC44 = useCase(44, "Reserve a book");
const UC45 = useCase(45, "Renew a card"), UC41 = useCase(41, "Check out a book");
const ARC1 = text("# ARC-001 Lending as a whole"), MOD_DESK = text("# MOD-desk The desk");
const PATH = { 41: "docs/use-cases/UC-041-check-out-a-book.md", 42: "docs/use-cases/UC-042-extend-a-loan.md", 43: "docs/use-cases/UC-043-give-back-a-book.md",
  uc43old: "docs/use-cases/UC-043-return-a-book.md", 44: "docs/use-cases/UC-044-reserve-a-book.md", 45: "docs/use-cases/UC-045-renew-a-card.md",
  arc: "docs/architecture/ARC-001-lending.md", mod: "docs/architecture/MOD-desk.md" };
const PROPOSAL = "docs/spec-freigaben/2026-02-01_other/01-lending.md";
const SPEC_BLOB = blobOf("a proposal");
const SPEC_RECORD = [`docs/approvals/spec-2026-02-01_other-01-${SPEC_BLOB.slice(0, 12)}.md`, text("kind: spec", "queue: docs/spec-freigaben/2026-02-01_other", "entry: 01",
  `proposal: ${PROPOSAL}`, `blob: ${SPEC_BLOB}`, "target: SPEC.md", "anchor: ## 2. Writing", `section: ${blobOf("a section")}`)];

// The records, each added by one commit: [path, text].
const R = { uc42old: recordOf("UC-042", "use-case", PATH[42], UC42_OLD), uc43: recordOf("UC-043", "use-case", PATH.uc43old, UC43), uc44: recordOf("UC-044", "use-case", PATH[44], UC44),
  uc45: recordOf("UC-045", "use-case", PATH[45], UC45), uc42: recordOf("UC-042", "use-case", PATH[42], UC42), arc1: recordOf("ARC-001", "architecture-decision", PATH.arc, ARC1),
  mod: recordOf("MOD-desk", "module", PATH.mod, MOD_DESK), spec: SPEC_RECORD };

// The commits that touched the repository, newest first: sha, the account GitHub names for the author (null where it names none), the author's name, the date, and the files added.
const sha = (n) => String(n).repeat(40).slice(0, 40);
const COMMITS = [
  { sha: sha(6), login: "alice-a", name: "Alice A", date: "2026-10-05T12:00:00Z", added: ["src/code.mjs"] },
  { sha: sha(5), login: "bob-b", name: "Bob B", date: "2026-10-04T09:00:00Z", added: [R.uc42[0]] },
  { sha: sha(4), login: null, name: "Dana D", date: "2026-10-02T11:30:00Z", added: [R.arc1[0], R.spec[0]] },
  { sha: sha(3), login: "alice-a", name: "Alice A", date: "2026-10-01T10:00:00Z", added: [R.uc44[0], R.mod[0], R.uc45[0]] },
  { sha: sha(2), login: "bob-b", name: "Bob B", date: "2026-09-03T08:00:00Z", added: [R.uc43[0]] },
  { sha: sha(1), login: "carol-c", name: "Carol C", date: "2026-09-01T08:00:00Z", added: [R.uc42old[0]] },
];
const APPROVAL_COMMITS = COMMITS.filter((commit) => commit.added.some((path) => path.startsWith("docs/approvals/")));

// The default branch: the use cases (UC-043 renamed since it was accepted), a decision and a module, and every record. UC-041 has no record.
const HEAD_FILES = { "README.md": "# Thesis tool\n", "SPEC.md": text("# Thesis tool - Specification"), "src/code.mjs": "export {};\n", [PATH[41]]: UC41, [PATH[42]]: UC42, [PATH[43]]: UC43,
  [PATH[44]]: UC44, [PATH[45]]: UC45, [PATH.arc]: ARC1, [PATH.mod]: MOD_DESK, ...Object.fromEntries(Object.values(R)) };

// A fake GitHub holding `files` at the head of `commits`, recording every request. refuseList: the answer of "List commits" is a used-up rate limit.
function fakeGitHub({ files = HEAD_FILES, commits = COMMITS, refuseList = false } = {}) {
  const requests = [], named = [];
  const head = commits[0].sha, prefix = `/repos/${REPO}`;
  const fetch = async (input, init = {}) => {
    const url = new URL(String(input));
    requests.push({ method: init.method ?? "GET", url });
    if (url.origin === "https://raw.githubusercontent.com") {
      const path = decodeURIComponent(url.pathname.slice(`/${REPO}/${head}/`.length));
      named.push(path);
      return path in files ? new Response(files[path]) : json({ message: "Not Found" }, 404);
    }
    if (url.origin !== "https://api.github.com") return json({ message: "Not Found" }, 404);
    if (url.pathname === "/graphql") {
      const repository = {};
      for (const [, alias, expression] of JSON.parse(init.body).query.matchAll(/(\w+):object\(expression:("(?:[^"\\]|\\.)*")\)/g)) {
        const path = JSON.parse(expression).slice(head.length + 1);
        named.push(path);
        repository[alias] = path in files ? { text: files[path], isTruncated: false } : null;
      }
      return json({ data: { repository } });
    }
    if (url.pathname === prefix) return json({ default_branch: "main", visibility: "public", private: false, permissions: { push: true }, archived: false, description: "" });
    if (url.pathname === `${prefix}/commits/main`) return json({ sha: head, commit: { tree: { sha: "t" } } });
    if (url.pathname === `${prefix}/git/trees/${head}`) return json({ tree: Object.entries(files).map(([path, body]) => ({ path, type: "blob", sha: blobOf(body) })) });
    if (url.pathname === `${prefix}/commits`) {
      if (refuseList) return json({ message: "API rate limit exceeded" }, 403, { "x-ratelimit-remaining": "0", "x-ratelimit-limit": "60", "x-ratelimit-reset": "1790000000" });
      // "List commits": the commits that changed the path, from the commit `sha` (the head where none is given), newest first, `per_page` to a page.
      const under = url.searchParams.get("path"), from = url.searchParams.get("sha");
      const per = Number(url.searchParams.get("per_page") ?? 30), page = Number(url.searchParams.get("page") ?? 1);
      const found = commits.slice(from ? commits.findIndex((commit) => commit.sha === from) : 0).filter((commit) => !under || commit.added.some((path) => path.startsWith(under)));
      return json(found.slice((page - 1) * per, page * per).map((commit) => ({ sha: commit.sha,
        parents: commits[commits.indexOf(commit) + 1] ? [{ sha: commits[commits.indexOf(commit) + 1].sha }] : [], author: commit.login ? { login: commit.login } : null,
        commit: { author: { name: commit.name, date: commit.date }, committer: { date: commit.date }, message: "a commit" } })));
    }
    const detail = new RegExp(`^${prefix}/commits/([0-9a-f]{40})$`).exec(url.pathname);
    if (detail) return json({ sha: detail[1], files: (commits.find((commit) => commit.sha === detail[1])?.added ?? []).map((filename) => ({ filename, status: "added" })) });
    if (url.pathname.startsWith(`${prefix}/contents/`)) {
      const path = decodeURIComponent(url.pathname.slice(`${prefix}/contents/`.length));
      named.push(path);
      return path in files ? new Response(files[path]) : json({ message: "Not Found" }, 404);
    }
    return json({ message: "Not Found" }, 404);
  };
  // The requests by what they ask for.
  const count = (match) => requests.filter((request) => match(request.url)).length;
  return { fetch, requests, named,
    counts: () => ({ repository: count((u) => u.pathname === prefix), commit: count((u) => u.pathname === `${prefix}/commits/main`), tree: count((u) => u.pathname.startsWith(`${prefix}/git/trees/`)),
      list: count((u) => u.pathname === `${prefix}/commits`), detail: count((u) => /\/commits\/[0-9a-f]{40}$/.test(u.pathname)), batch: count((u) => u.pathname === "/graphql"),
      raw: count((u) => u.origin === "https://raw.githubusercontent.com"), contents: count((u) => u.pathname.startsWith(`${prefix}/contents/`)), all: requests.length }),
    lists: () => requests.filter((request) => request.url.pathname === `${prefix}/commits`).map((request) => request.url.searchParams.get("path")),
    // What each "List commits" asked for: the path, the commit it starts from, and the size and number of the page.
    listQueries: () => requests.filter((request) => request.url.pathname === `${prefix}/commits`).map(({ url }) => ({ path: url.searchParams.get("path")?.replace(/\/$/, ""),
      from: url.searchParams.get("sha"), per: url.searchParams.get("per_page"), page: url.searchParams.get("page") })) };
}

// ---------------------------------------------------------------- the page

// Draws `<route>` with `params` of the product over the real GitHub host behind `fake`, a token stored or none. The instance is never read.
async function draw(route, params, fake, { token = true } = {}) {
  const real = globalThis.fetch;
  globalThis.fetch = fake.fetch;
  try {
    emptyStorage();
    const store = openStore("alice/agent-m");
    if (token) writeSetting(store, `github-token:${REPO}`, { value: TOKEN, name: "Agent M - thesis-tool", expires: "2027-01-01" });
    const host = connect(parseAddress(ADDRESS), token ? { token: TOKEN } : {});
    const unread = async () => { throw new Error("the instance is not read to show a history"); };
    const target = document.createElement("div");
    document.body.append(target);
    const context = { page: "review", instance: { repository: "alice/agent-m", host: { repositoryInfo: unread, readSnapshot: unread } }, product: { address: ADDRESS, kind: "github", host }, store, go() {} };
    const drawn = pages.view.routes.find((candidate) => candidate.name === route);
    assert.ok(drawn, `the route ${route}`);
    await drawn.render(target, context, params);
    return { target, drawn, context };
  } finally {
    globalThis.fetch = real;
  }
}
function elements(root) {
  const found = [];
  (function walk(node) { for (const kid of node.childNodes) { if (kid.nodeType === 1) { found.push(kid); walk(kid); } } })(root);
  return found;
}
const classesOf = (node) => node.className.split(" ").filter(Boolean);
// What the history shows, as strings only: for each record its identifier, the file it names, the person and the date.
const rowsOf = (target) => elements(target).filter((node) => node.localName === "tr" && node.getAttribute("data-id") !== null)
  .map((row) => [row.getAttribute("data-id"), ...row.children.filter((cell) => cell.localName === "td").map((cell) => cell.textContent)]);
const problemsOf = (target) => elements(target).filter((node) => node.localName === "p" && classesOf(node).includes("problem")).map((node) => node.textContent);

// ---------------------------------------------------------------- the link on the list

// TST-898001 · level: component · module: MOD-review-pages
// guards: UC-008; UC-023
// given: the default branch of the fixture; a token stored, or none
// input: the routes use-case, decision, module and spec-entry drawn as the list
// expect: on each, with and without a token, the last element of the page is a link whose address is #<route>/id=history/product=<the product's address, percent-encoded>
for (const token of [true, false]) {
  test(`TST-898001 the list of each kind ends with a link to its history, ${token ? "with" : "without"} a token`, async () => {
    const ends = {};
    for (const route of ["use-case", "decision", "module", "spec-entry"]) {
      const { target } = await draw(route, {}, fakeGitHub(), { token });
      const last = target.children.at(-1);
      ends[route] = [last.localName, last.getAttribute("href")];
    }
    assert.deepEqual(ends, Object.fromEntries(["use-case", "decision", "module", "spec-entry"].map((route) => [route, ["a", `#${route}/id=history/product=${encodeURIComponent(ADDRESS)}`]])));
  });
}

// TST-898002 · level: component · module: MOD-review-pages
// guards: UC-008
// given: the default branch of the fixture; a token stored
// input: the route use-case drawn as the list
// expect: no request asks for "List commits": the history is read only on its own page
test("TST-898002 the list reads no history", async () => {
  const fake = fakeGitHub();
  await draw("use-case", {}, fake);
  assert.equal(fake.counts().list + fake.counts().detail, 0);
});

// ---------------------------------------------------------------- the history, where the commits are present

// TST-898003 · level: component · module: MOD-review-pages
// guards: UC-008; STATUS IS DERIVED FROM THE RECORDS; AN APPROVAL NAMES THE EXACT TEXT
// given: five commits added the use cases' records — UC-042 (older text) by carol-c on 2026-09-01, UC-043 by bob-b on 2026-09-03 (the file has been renamed since), UC-044 and UC-045 together with MOD-desk's record by alice-a on 2026-10-01, UC-042 (current text) by bob-b on 2026-10-04 — and one commit of code and two of other kinds' records between them
// input: the route use-case drawn with the id history, a token stored
// expect: five rows, newest first, each with the identifier, the file the record names (UC-043's as it was named), the person and the date as the host gives it; no record of another kind
test("TST-898003 use-case history — the approval records of the use cases, newest first, each with its file, its person and its date", async () => {
  const { target } = await draw("use-case", { id: "history" }, fakeGitHub());
  assert.deepEqual(rowsOf(target), [
    ["UC-042", PATH[42], "bob-b", "2026-10-04T09:00:00Z"],
    ["UC-044", PATH[44], "alice-a", "2026-10-01T10:00:00Z"],
    ["UC-045", PATH[45], "alice-a", "2026-10-01T10:00:00Z"],
    ["UC-043", PATH.uc43old, "bob-b", "2026-09-03T08:00:00Z"],
    ["UC-042", PATH[42], "carol-c", "2026-09-01T08:00:00Z"],
  ]);
  assert.deepEqual(problemsOf(target), []);
});

// TST-898004 · level: component · module: MOD-review-pages
// guards: UC-023; STATUS IS DERIVED FROM THE RECORDS
// given: the same repository; ARC-001's record was added by Dana D, whom GitHub names no account for, on 2026-10-02, together with the record of the SPEC change entry spec-2026-02-01_other-01; MOD-desk's by alice-a on 2026-10-01
// input: the routes decision, module and spec-entry drawn with the id history
// expect: decision: one row, ARC-001 with its file, "Dana D" and the date; module: one row, MOD-desk with alice-a and 2026-10-01T10:00:00Z; spec-entry: one row, the entry with its proposal, "Dana D" and the date — each page lists the records of its own kind only
test("TST-898004 decision, module and SPEC entry history — each lists the records of its own kind, a person without an account by name", async () => {
  const shown = {};
  for (const route of ["decision", "module", "spec-entry"]) shown[route] = rowsOf((await draw(route, { id: "history" }, fakeGitHub())).target);
  assert.deepEqual(shown, {
    decision: [["ARC-001", PATH.arc, "Dana D", "2026-10-02T11:30:00Z"]],
    module: [["MOD-desk", PATH.mod, "alice-a", "2026-10-01T10:00:00Z"]],
    "spec-entry": [["spec-2026-02-01_other-01", PROPOSAL, "Dana D", "2026-10-02T11:30:00Z"]],
  });
});

// ---------------------------------------------------------------- the requests of one click

const RECORDS_OF_USE_CASES = [R.uc42old[0], R.uc43[0], R.uc44[0], R.uc45[0], R.uc42[0]].sort();

// TST-898005 · level: component · module: MOD-review-pages
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES
// given: the fixture's five commits that touched docs/approvals and one that did not; a token stored
// input: one click on the link of the use cases' history: the route use-case drawn with the id history
// expect: 11 requests — the repository, the commit of its default branch and its tree once each (3); the GraphQL request of greenToMerge beside the repository (1, ITM-1170); "List commits" once, with the path docs/approvals (1); "Get a commit" once for each of the five commits (5); the texts of the five use-case records in 1 batch of GraphQL; no file by itself; no request on the raw host
test("TST-898005 use-case history with a token — 11 requests: the snapshot, one list of the commits, one for each commit, one batch of the records' texts", async () => {
  const fake = fakeGitHub();
  await draw("use-case", { id: "history" }, fake);
  // ITM-1170: the fake counts every POST /graphql as a batch; the second is greenToMerge's, beside the repository's record.
  assert.deepEqual(fake.counts(), { repository: 1, commit: 1, tree: 1, list: 1, detail: APPROVAL_COMMITS.length, batch: 2, raw: 0, contents: 0, all: 11 });
  assert.deepEqual(fake.lists().map((path) => path.replace(/\/$/, "")), ["docs/approvals"]);
  assert.deepEqual([...fake.named].sort(), RECORDS_OF_USE_CASES);
});

// TST-898006 · level: component · module: MOD-review-pages
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES
// given: the same repository; no token stored
// input: one click on the link of the use cases' history
// expect: 14 requests — the same 3, 1 and 5, and the five records each on GitHub's raw host (5); no request to GraphQL; no file by itself
test("TST-898006 use-case history without a token — 14 requests: the snapshot, one list of the commits, one for each commit, the five records each on the raw host", async () => {
  const fake = fakeGitHub();
  await draw("use-case", { id: "history" }, fake, { token: false });
  assert.deepEqual(fake.counts(), { repository: 1, commit: 1, tree: 1, list: 1, detail: APPROVAL_COMMITS.length, batch: 0, raw: 5, contents: 0, all: 14 });
  assert.deepEqual([...fake.named].sort(), RECORDS_OF_USE_CASES);
});

// ---------------------------------------------------------------- no subject, no queue read

// The queue of one SPEC change entry beside the SPEC it changes, which the page of the SPEC change entries reads to give the prompt bar its subject.
const QUEUE = "docs/spec-freigaben/2026-03-01_sample";
const WITH_QUEUE = { ...HEAD_FILES, "SPEC.md": text("# Thesis tool - Specification", "", "## 2. Writing", "", "**A WRITE RULE** *(Product Owner)*", "A writer writes a file whole.", "*Check:* none"),
  [`${QUEUE}/index.md`]: text("# SPEC approvals - queue 2026-03-01 · sample", "", "**Zieldatei aller Einträge:** `SPEC.md`", "",
    "| Nr | Datei | Anker (Überschrift, wortgetreu) | bis (exklusiv) | Commits |", "|---|---|---|---|---|", "| 07 | `SPEC.md` | ## 2. Writing | — | — |"),
  [`${QUEUE}/entscheidungen.md`]: text("# Decisions - queue 2026-03-01 sample", "", "Append-only."),
  [`${QUEUE}/07-entry-7.md`]: text("## 2. Writing", "", "**A WRITE RULE** *(Product Owner)*", "A writer writes a file entirely.", "*Check:* none"),
  [`${QUEUE}/07-entry-7.begruendung.md`]: text("# ## 2. Writing: a change", "", "**The change.** A sample change.") };

// TST-898007 · level: component · module: MOD-review-pages
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES
// given: a repository that holds a change queue with one entry beside the SPEC, and the fixture's records; a token stored
// input: the route spec-entry drawn with the id history; then the subject the page gives the prompt bar
// expect: no file of the queue and not the SPEC is read; the page gives no subject (null): a history names no entry
test("TST-898007 SPEC entry history — reads no queue and gives the prompt bar no subject", async () => {
  const fake = fakeGitHub({ files: WITH_QUEUE });
  const { target, drawn, context } = await draw("spec-entry", { id: "history" }, fake);
  assert.deepEqual(fake.named.filter((path) => path.startsWith(QUEUE) || path === "SPEC.md"), []);
  assert.equal(rowsOf(target).length, 1);
  assert.equal(drawn.subject({ id: "history" }, context), null);
});

// ---------------------------------------------------------------- where the commits are absent, or the read fails

// TST-898008 · level: component · module: MOD-review-pages
// guards: UC-008
// given: a repository that no commit has ever added an approval record to (no file under docs/approvals/)
// input: the route use-case drawn with the id history, a token stored
// expect: no row and no problem; "List commits" was asked once and no commit was read nor any text — the one GraphQL request is greenToMerge's beside the repository (ITM-1170)
test("TST-898008 use-case history of a repository without records — no row, no problem, nothing read for a record", async () => {
  const files = Object.fromEntries(Object.entries(HEAD_FILES).filter(([path]) => !path.startsWith("docs/approvals/")));
  const fake = fakeGitHub({ files, commits: COMMITS.filter((commit) => !commit.added.some((path) => path.startsWith("docs/approvals/"))) });
  const { target } = await draw("use-case", { id: "history" }, fake);
  assert.deepEqual([rowsOf(target).length, problemsOf(target)], [0, []]);
  const seen = fake.counts();
  assert.deepEqual([seen.list, seen.detail, seen.batch, seen.contents, seen.raw], [1, 0, 1, 0, 0], "the one batch is greenToMerge's GraphQL request (ITM-1170), no record's text");
});

// TST-898009 · level: component · module: MOD-review-pages
// guards: A REMOTE INTERFACE NAMES HOW IT FAILS
// given: the fixture; the server answers "List commits" with a used-up rate limit
// input: the route use-case drawn with the id history, no token stored
// expect: one problem paragraph, the host's failure as the other pages draw a failed read — it says that GitHub's request limit for this network, for requests without a token, is used up — and no row
test("TST-898009 use-case history when the list of the commits is refused — the host's failure drawn as a problem, and no row", async () => {
  const { target } = await draw("use-case", { id: "history" }, fakeGitHub({ refuseList: true }), { token: false });
  const problems = problemsOf(target);
  assert.deepEqual([problems.length, problems[0]?.startsWith("GitHub's request limit for this network, for requests without a token is used up"), rowsOf(target).length], [1, true, 0]);
});

// ---------------------------------------------------------------- twenty commits to a page, and Older
//
// The accepted text (MOD-review-pages.md, `<k>/history`): "…read twenty commits of `docs/approvals/` at a time, and *Older* for the next twenty, read from the parent of the last
// commit shown", through readHistory's `ref` and `limit` (MOD-repository-hosts.md:179). Readings the tests take:
//   - The first page starts from the commit of the default branch's snapshot; *Older* is an <a> whose text is "Older", on a page that shows twenty commits whose last has a parent, and
//     whose address (#<route>/id=history/<name>=<value> …) the tests follow by drawing the route with the parameters that address carries, whatever their names.
//   - The next page starts from the parent of the last commit shown, whether or not that parent touched `docs/approvals/`.
//   - A page of twenty commits may show fewer than twenty rows: a commit that added only the records of another kind adds no row to this kind's page.
//   - TST-898005 and TST-898006 keep their numbers (10 and 14): their repository has five commits that touched `docs/approvals/`, which one page of twenty holds.

const pad = (k) => String(k).padStart(3, "0");
const stamp = (k) => new Date(Date.UTC(2026, 8, 1, 0, k)).toISOString().replace(".000Z", "Z");
// n commits that each added one record, oldest first: UC-<k>'s, but ARC-<k>'s where k is a multiple of three; one commit of code on top, and, directly older than the commits in `gaps`, one more
// commit of code. The use cases and decisions the records name stand on the default branch.
function longHistory(n, gaps = [26, 6]) {
  const files = { "README.md": "# Thesis tool\n", "src/code.mjs": "export {};\n" }, commits = [];
  for (let k = n; k >= 1; k -= 1) {
    const arc = k % 3 === 0, id = `${arc ? "ARC" : "UC"}-${pad(k)}`, path = arc ? `docs/architecture/ARC-${pad(k)}-decision.md` : `docs/use-cases/UC-${pad(k)}-case.md`;
    const body = text(`# ${id} Number ${k}`), [recordPath, recordText] = recordOf(id, arc ? "architecture-decision" : "use-case", path, body);
    files[path] = body;
    files[recordPath] = recordText;
    commits.push({ sha: `a${String(k).padStart(39, "0")}`, login: "alice-a", name: "Alice A", date: stamp(k), added: [recordPath] });
    if (gaps.includes(k)) commits.push({ sha: `b${String(k).padStart(39, "0")}`, login: "alice-a", name: "Alice A", date: stamp(k), added: ["src/code.mjs"] });
  }
  commits.unshift({ sha: `c${"0".repeat(39)}`, login: "alice-a", name: "Alice A", date: stamp(n + 1), added: ["src/code.mjs"] });
  return { files, commits };
}
const useCaseRows = (ks) => ks.map((k) => [`UC-${pad(k)}`, `docs/use-cases/UC-${pad(k)}-case.md`, "alice-a", stamp(k)]);
// The address of the link whose text is "Older" as the parameters the route is drawn with: #<route>/<name>=<value>/… without the product.
function olderOf(target) {
  const link = elements(target).find((node) => node.localName === "a" && node.textContent === "Older");
  if (!link) return null;
  return Object.fromEntries(link.getAttribute("href").slice(1).split("/").slice(1).filter((part) => !part.startsWith("product=")).map((part) => {
    const at = part.indexOf("=");
    return [part.slice(0, at), decodeURIComponent(part.slice(at + 1))];
  }));
}

// TST-898010 · level: component · module: MOD-review-pages
// guards: UC-008; STATUS IS DERIVED FROM THE RECORDS
// given: 45 commits that each added one record — UC-<k> by commit k, but ARC-<k> where k is a multiple of three — beneath a commit of code, with one more commit of code directly older than commit 26
// input: the route use-case drawn with the id history, a token stored
// expect: the rows of the twenty newest commits that touched docs/approvals (commits 45 down to 26): the 13 use cases among them, newest first — 44, 43, 41, 40, 38, 37, 35, 34, 32, 31, 29, 28, 26 — and a link Older; "List commits" asked once, for docs/approvals, from the head, 20 to a page, page 1
test("TST-898010 use-case history, first page — twenty commits, the rows of the use cases among them, and Older", async () => {
  const fake = fakeGitHub(longHistory(45));
  const { target } = await draw("use-case", { id: "history" }, fake);
  assert.deepEqual(rowsOf(target), useCaseRows([44, 43, 41, 40, 38, 37, 35, 34, 32, 31, 29, 28, 26]));
  assert.notEqual(olderOf(target), null);
  assert.deepEqual(fake.listQueries(), [{ path: "docs/approvals", from: `c${"0".repeat(39)}`, per: "20", page: "1" }]);
});

// TST-898011 · level: component · module: MOD-review-pages
// guards: UC-008; STATUS IS DERIVED FROM THE RECORDS
// given: the same 45 commits; the first page drawn
// input: the link Older of the first page followed (the route drawn with the parameters of its address)
// expect: the rows of the next twenty commits that touched docs/approvals (25 down to 6): 25, 23, 22, 20, 19, 17, 16, 14, 13, 11, 10, 8, 7 — and a link Older; "List commits" asked once, for docs/approvals, from the parent of the last commit shown (commit 26), which is the commit of code directly older than it, 20 to a page, page 1
test("TST-898011 use-case history, Older — the next twenty commits, read from the parent of the last commit shown", async () => {
  const history = longHistory(45);
  const first = await draw("use-case", { id: "history" }, fakeGitHub(history));
  const fake = fakeGitHub(history);
  const { target } = await draw("use-case", { id: "history", ...olderOf(first.target) }, fake);
  assert.deepEqual(rowsOf(target), useCaseRows([25, 23, 22, 20, 19, 17, 16, 14, 13, 11, 10, 8, 7]));
  assert.notEqual(olderOf(target), null);
  assert.deepEqual(fake.listQueries(), [{ path: "docs/approvals", from: `b${String(26).padStart(39, "0")}`, per: "20", page: "1" }]);
});

// TST-898012 · level: component · module: MOD-review-pages
// guards: UC-008; STATUS IS DERIVED FROM THE RECORDS
// given: the same 45 commits; the second page drawn by Older
// input: the link Older of the second page followed
// expect: the rows of the last five commits (5 down to 1): 5, 4, 2, 1 (commit 3 added a decision's record); no link Older; "List commits" asked from the commit of code directly older than commit 6, the parent of the last commit shown
test("TST-898012 use-case history, the last page — the rest of the commits and no Older", async () => {
  const history = longHistory(45);
  const first = await draw("use-case", { id: "history" }, fakeGitHub(history));
  const second = await draw("use-case", { id: "history", ...olderOf(first.target) }, fakeGitHub(history));
  const fake = fakeGitHub(history);
  const { target } = await draw("use-case", { id: "history", ...olderOf(second.target) }, fake);
  assert.deepEqual(rowsOf(target), useCaseRows([5, 4, 2, 1]));
  assert.equal(olderOf(target), null);
  assert.deepEqual(fake.listQueries().map((query) => query.from), [`b${String(6).padStart(39, "0")}`]);
});

// TST-898013 · level: component · module: MOD-review-pages
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES
// given: this repository's size: 236 commits that each added one record (158 use cases', and 78 decisions' where k is a multiple of three) — the 45-commit fixture's rule; the unbounded page of the first version of this item cost 244 and 423 on the real repository
// input: one click on the history of the use cases, then one on Older, with a token and without
// expect: a page costs the snapshot (3), one "List commits" (1), "Get a commit" for each of the twenty commits (20) and the texts of the use-case records of the page — with a token 1 GraphQL batch, without one request each on the raw host. With a token the GraphQL request of greenToMerge goes beside the repository (1, ITM-1170). First page (commits 236 to 217: 14 use cases): 26 requests with a token, 38 without. Second page (216 to 197: 13 use cases): 26 with, 37 without. Neither depends on the 236 commits
for (const token of [true, false]) {
  test(`TST-898013 use-case history at this repository's size — 20 commits to a page, ${token ? "with" : "without"} a token`, async () => {
    const history = longHistory(236);
    const one = fakeGitHub(history), two = fakeGitHub(history);
    const first = await draw("use-case", { id: "history" }, one, { token });
    await draw("use-case", { id: "history", ...olderOf(first.target) }, two, { token });
    assert.deepEqual([one.counts(), two.counts()], token
      ? [{ repository: 1, commit: 1, tree: 1, list: 1, detail: 20, batch: 2, raw: 0, contents: 0, all: 26 }, { repository: 1, commit: 1, tree: 1, list: 1, detail: 20, batch: 2, raw: 0, contents: 0, all: 26 }]
      : [{ repository: 1, commit: 1, tree: 1, list: 1, detail: 20, batch: 0, raw: 14, contents: 0, all: 38 }, { repository: 1, commit: 1, tree: 1, list: 1, detail: 20, batch: 0, raw: 13, contents: 0, all: 37 }]);
  });
}
