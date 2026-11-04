// MOD-review-pages' drafting of use cases (ITM-362), as the accepted text of docs/architecture/MOD-review-pages.md states it: "`<k>/draft` — drafting: for use
// cases, the requirements to cover — by default those no use case realises …; the drafting … participant …; then the run panel and *Run*. A job the person
// starts here and waits for runs in this tab, attended … A kind whose result does not wait — drafting use cases — writes its files open at once, and they
// appear in the list. A job on another route — a CI agent … — is queued there and followed on the page", and UC-007 steps 1 to 6 and the alternative flows 4a, 4b:
// the requirements to cover (by default those no use case realises), the participants that can draft text each with where it processes data and its routes, the
// run panel of `derive-use-cases` and *Run*, one click; the job run in this tab, attended, whose files are written open at once in one commit and appear in the
// list, with the rounds and what the loop left; beside an open use case a job wrote, the notes of that job's end record; a job on the CI route queued there and
// not run in the tab; nothing written without the click; the view hands the frame the strategies the kind uses in the tab.
// Run: node --test tests/review-pages-draft-use-cases.test.mjs
//
// Module: MOD-review-pages
// Guards: UC-007; UC-010; ONE CLICK PER DECISION; THE PAGE NAMES WHERE IT SENDS; A GENERATED ARTIFACT IS A PROPOSAL; A REVIEWED ARTIFACT ENTERS THE DEFAULT BRANCH AS OPEN; THE ROUNDS ARE COUNTED AND SHOWN; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK; A JOB IS RECORDED IN ITS PRODUCT REPOSITORY
// Level: unit
//
// This imports the browser harness of tests/review-pages-harness.mjs unchanged. The product is a fixture behind a Host of the tests' own that keeps to
// MOD-repository-hosts' interface (repositoryInfo, readSnapshot, readHistory, commitFiles made only on the head that was read, else `Moved`); the instance is a
// read-only snapshot of this repository, whose book is on the disk, with the register of participants the test gives. The model endpoint is a fixture standing
// behind the global `fetch`, which the test replaces and restores. The real MOD-job-runner, MOD-runtimes, MOD-job-ledger, MOD-approvals, MOD-spec-changes,
// MOD-artifact-edits, MOD-source-register, MOD-trace-graph, MOD-participant-list and MOD-site-frame run as they are, the strategies registered as the view hands
// them to the frame. Where the module file leaves a reading open, the test states the one it takes, and the pull request names it:
//   - The address of the page is the use-case route with the id `draft` — #use-case/id=draft —, as `all` is Review all: the frame reads the parts of an address
//     as `key=value`, and a part without `=` names nothing.
//   - The page holds <input class="requirement"> for each requirement of the SPEC, checked by default for each that no use case realises; <li class="participant">
//     for each participant able to draft text, with <input class="participant"> (a radio), <span class="place"> and <span class="route"> (the route's kind, and,
//     for a route that cannot be taken, <span class="reason"> with why); <button class="prepare"> shows the run panel; Run is the panel's own button.
//   - After a run the page shows <p class="rounds"> "Correction rounds: n", <ul class="left"> with a <li> for each finding the loop left, <ul class="written"> with a
//     <li> for each file written, and a link to the list; for a job queued on another route, <p class="queued"> with the job's identifier.
//   - Beside an open use case a job wrote, <section class="job-notes"> holds the notes of that job's end record (`note: …` lines) that name the use case.
//   - Agent M's version, which the job's record names, is read as the instance's commit, as no text names another source of it.
// Each test states its input and its expected result before it runs (given / input / expect). The counter-proofs are recorded in the pull request.

import "./review-pages-harness.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { approvalSchema } from "../src/approvals/index.mjs";
import { writeDocument } from "../src/documents/index.mjs";
import { storedGraphBytes, withStoredGraph } from "./stored-graph-fake.mjs";

// Every commit the fakes of this file make is its own: MOD-trace-graph's storedGraph keeps a commit's graph for the page.
let commitsMade = 0;

const { openStore, writeSetting } = await import("../src/browser-store/index.mjs");
const { registerStrategies } = await import("../src/job-runner/index.mjs");
const pages = await import("../src/review-pages/index.mjs").catch((error) => ({ error }));
const route = pages.view?.routes.find((candidate) => candidate.name === "use-case");
(pages.view?.strategies ?? []).forEach((strategies, at) => registerStrategies(`tests/review-pages-draft-use-cases.test.mjs#${at}`, strategies));

// ---------------------------------------------------------------- the product

const text = (...lines) => `${lines.join("\n")}\n`;
const blobOf = (body) => createHash("sha1").update(`blob ${Buffer.byteLength(body)}\0${body}`).digest("hex");
const failure = (name, message, fields = {}) => Object.assign(new Error(message), { name }, fields);
const ON_GITHUB = { server: "github", origin: "https://github.com", path: "alice/thesis-tool", web: "https://github.com/alice/thesis-tool" };
const TOKEN = { value: "github_pat_ALICEthesisTOOL0123456789abcdef", name: "Agent M · thesis-tool", expires: "2027-01-01" };
const RULE = "A LOAN HAS A DUE DATE", OTHER = "A BOOK IS SHELVED", UNKNOWN = "AN UNKNOWN RULE";
const SPEC = text("# Thesis tool — Specification", "", "## Lending", "", `**${RULE}** *(Product Owner)*`, "Every loan states the date by which the book is returned.",
  "*Check:* `tests/loan.test.mjs`", "", `**${OTHER}** *(Product Owner)*`, "Every book stands on a shelf.", "*Check:* `tests/shelf.test.mjs`");
const useCase = (id, title, goal, realises = [RULE]) => text("---", `id: ${id}`, `title: ${title}`, "area: lending", "actors:", "  - Member", "realises:",
  ...realises.map((name) => `  - ${name}`), "---", `# ${id} ${title}`, "", `**Goal.** ${goal}`);
const UC_PATH = (id, slug) => `docs/use-cases/${id}-${slug}.md`;
const FILES = { "README.md": "# Thesis tool\n", "SPEC.md": SPEC,
  [UC_PATH("UC-001", "check-out-a-book")]: useCase("UC-001", "Check out a book", "The member borrows a book."),
  [UC_PATH("UC-002", "extend-a-loan")]: useCase("UC-002", "Extend a loan", "The member extends a loan once.") };
const WORKFLOW = ".github/workflows/agent-m-jobs.yml";

// ---------------------------------------------------------------- the hosts

// The branch trace-cache of a product whose head's graph is not stored yet: latest.json names `earlier.commit`, whose graph, built from `earlier.files`, it holds; with
// `earlier.files` null it holds neither latest.json nor that graph.
function latestOnly(earlier) {
  return async (branch, path, options) => {
    if (branch !== "trace-cache" || earlier.files === null) return null;
    if (path === "latest.json") return `{"commit":"${earlier.commit}"}\n`;
    if (path === `${earlier.commit}.json.gz` && options?.bytes) {
      return storedGraphBytes({ paths: Object.keys(earlier.files), read: async (each) => earlier.files[each] ?? null, commit: earlier.commit });
    }
    return null;
  };
}

function fakeProduct(files = FILES, { earlier = null } = {}) {
  const calls = [], commits = new Map();
  let made = 0, head = null;
  const commitOf = (tree, parent) => {
    const sha = createHash("sha1").update(`commit ${++made} of the file's ${++commitsMade}`).digest("hex");
    commits.set(sha, { tree, parent });
    return sha;
  };
  head = commitOf(new Map(Object.entries(files)), null);
  const bareSnapshotAt = (sha, ref) => {
    const { tree } = commits.get(sha);
    return { repository: ON_GITHUB, ref, commit: sha, paths: [...tree.keys()].sort(), read: async (path) => (tree.has(path) ? tree.get(path) : null),
      blob: (path) => (tree.has(path) ? blobOf(tree.get(path)) : null) };
  };
  // Each snapshot serves the graph the push job stores for its commit (tests/stored-graph-fake.mjs); a page reads it and never builds one (MOD-trace-graph).
  const snapshotAt = (...args) => (earlier === null ? withStoredGraph(bareSnapshotAt(...args)) : { ...bareSnapshotAt(...args), readOn: latestOnly(earlier) });
  return {
    files: () => Object.fromEntries(commits.get(head).tree),
    writes: () => calls.filter((call) => call.fn === "commitFiles").map((call) => call.change),
    host: {
      async repositoryInfo() { return { defaultBranch: "trunk", visibility: "public", canWrite: true, archived: false, description: "" }; },
      async readSnapshot(ref) {
        if (ref === "trunk") return snapshotAt(head, "trunk");
        if (commits.has(ref)) return snapshotAt(ref, ref);
        throw failure("NotFound", `${ref} was not found`);
      },
      async readHistory() { return []; },
      async commitFiles(change) {
        calls.push({ fn: "commitFiles", change: structuredClone(change) });
        if (change.branch !== "trunk" || change.expectedHead !== head) throw failure("Moved", "the branch moved", { head });
        head = commitOf(new Map([...commits.get(head).tree, ...change.files.map((file) => [file.path, file.text])]), head);
        return { commit: head, url: `${ON_GITHUB.web}/commit/${head}` };
      },
    },
  };
}

// The instance: this repository's files from the disk — its book among them —, with the register of participants the test gives.
const ROOT = new URL("../", import.meta.url);
const onDisk = (path) => { try { return readFileSync(new URL(path, ROOT), "utf8"); } catch { return null; } };
const REGISTER_HEAD = onDisk("docs/participants.md").split("\n").filter((line, at, all) => at <= all.findIndex((each) => each.startsWith("|---"))).join("\n");
const registerOf = (...rows) => `${REGISTER_HEAD}\n${rows.join("\n")}\n`;
const ENDPOINT_ROW = "| drafter-a | model endpoint | example-model | 200000 | — | draft text | this machine | endpoint ep1 |";
const CI_ROW = "| ci-agent | CI agent | model-x | 200000 | — | draft text | GitHub Actions in the USA | ci hosted secret CI_KEY |";
const READER_ROW = "| reader | person | — | — | — | read the repository | — | the GitHub account `reader` |";
function fakeInstance(register) {
  const snapshot = { repository: { server: "github", origin: "https://github.com", path: "alice/agent-m", web: "https://github.com/alice/agent-m" }, ref: "main",
    commit: "abc123def4567890abc123def4567890abc123de", paths: [], read: async (path) => (path === "docs/participants.md" ? register : onDisk(path)), blob: () => null };
  return { host: { async repositoryInfo() { return { defaultBranch: "main", visibility: "public", canWrite: false, archived: false, description: "" }; },
    async readSnapshot() { return snapshot; } } };
}

// The model endpoint ep1 behind the global fetch: it answers the drafts given in turn (the last again); every request is kept.
let requests = [];
const realFetch = globalThis.fetch;
function endpointAnswers(...drafts) {
  requests = [];
  const queue = [...drafts];
  globalThis.fetch = async (url) => {
    requests.push(String(url));
    const draft = queue.length > 1 ? queue.shift() : queue[0];
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ draft, answers: [] }) } }], usage: { prompt_tokens: 10, completion_tokens: 5 } }),
      { status: 200, headers: { "content-type": "application/json" } });
  };
}
test.afterEach(() => { globalThis.fetch = realFetch; });
// A drafted new use case in the five parts a use case holds, with the Mermaid diagram its schema requires.
const body = (realises) => useCase("UC-900", "Shelve a book", "The member shelves a book.", realises) + text("", "## Actors", "", "- **Member**", "", "## Precondition", "",
  "- The book is in the library.", "", "## Main flow", "", "1. The member puts the book on its shelf.", "", "```mermaid", "flowchart LR", "    Member --> Shelf", "```", "",
  "## Alternative flows", "", "- **1a. The shelf is full.** The member asks for another shelf.",
  "", "## Postcondition", "", "- The book stands on a shelf.");
const drafted = (realises, path = UC_PATH("UC-900", "shelve-a-book")) => ({ files: [{ path, class: "new", text: body(realises) }] });

// ---------------------------------------------------------------- the page

async function show(fake, params = { id: "draft" }, { register = registerOf(ENDPOINT_ROW, CI_ROW, READER_ROW), token = true } = {}) {
  assert.ok(route, `the route use-case: ${pages.error?.message}`);
  const store = openStore(token ? "alice/agent-m" : "nobody/agent-m");
  if (token) writeSetting(store, "github-token:alice/thesis-tool", TOKEN);
  writeSetting(store, "endpoint:ep1", { url: "https://ep1.example.test/v1", kind: "openai-compatible", model: "m", throughBridge: false });
  const target = document.createElement("div");
  document.body.append(target);
  const context = { page: "review", instance: { repository: "alice/agent-m", host: fakeInstance(register).host }, store, go() {},
    product: { address: ON_GITHUB.web, kind: "github", host: fake.host } };
  await route.render(target, context, params);
  return target;
}
function find(root, match) {
  const found = [];
  (function walk(node) { for (const kid of node.childNodes) { if (kid.nodeType === 1) { if (match(kid)) found.push(kid); walk(kid); } } })(root);
  return found;
}
const byClass = (root, name, className) => find(root, (node) => node.localName === name && node.className.split(" ").includes(className));
const click = (node) => node.dispatchEvent(new Event("click"));
async function until(condition, what) {
  const limit = Date.now() + 2000;
  while (Date.now() < limit) {
    if (condition()) return;
    await new Promise((resolve) => setImmediate(resolve));
  }
  assert.fail(`waited for ${what}`);
}
const runButtons = (root) => find(root, (node) => node.localName === "button" && node.textContent === "Run");
const participantBox = (target, name) => byClass(target, "input", "participant").find((box) => box.value === name);
function choose(target, name) {
  const box = participantBox(target, name);
  box.checked = true;
  box.dispatchEvent(new Event("change"));
}
async function panelFor(target, name) {
  choose(target, name);
  click(byClass(target, "button", "prepare")[0]);
  await until(() => byClass(target, "section", "run-panel").length === 1, "the run panel");
}
const rowOf = (target, id) => find(target, (node) => node.localName === "tr" && node.getAttribute("data-id") === id)[0];

// ---------------------------------------------------------------- the strategies

// TST-472614 · level: unit · module: MOD-review-pages
// guards: A GENERATED ARTIFACT IS A PROPOSAL; A REVIEWED ARTIFACT ENTERS THE DEFAULT BRANCH AS OPEN
// given: the view of the module
// input: its strategies, as the frame registers them
// expect: they hold the recipes chosen-requirements, use-cases and chapters-for-requirements, the precondition rests-on-accepted and the writer open-files that the kind derive-use-cases names
test("view — hands the frame the strategies the kind derive-use-cases uses in the tab", () => {
  assert.ok(pages.view, `the view: ${pages.error?.message}`);
  const names = (category) => pages.view.strategies.flatMap((strategies) => Object.keys(strategies[category] ?? {}));
  for (const recipe of ["chosen-requirements", "use-cases", "chapters-for-requirements"]) assert.ok(names("recipes").includes(recipe), recipe);
  assert.ok(names("preconditions").includes("rests-on-accepted"));
  assert.ok(names("writers").includes("open-files"));
});

// ---------------------------------------------------------------- the list leads here

// TST-472615 · level: unit · module: MOD-review-pages
// guards: EVERY STEP EXPLAINS ITSELF; UC-007
// given: the list of use cases of a product with a token
// input: the route use-case with no id
// expect: a link "Draft use cases" to #use-case/id=draft/product=<the product's address, percent-encoded>
test("use-case — the list's Draft use cases leads to the drafting page", async () => {
  const fake = fakeProduct();
  const target = await show(fake, {});
  const links = find(target, (node) => node.localName === "a" && node.getAttribute("href") === `#use-case/id=draft/product=${encodeURIComponent(ON_GITHUB.web)}`);
  assert.equal(links.length, 1);
  assert.match(links[0].textContent, /Draft use cases/);
});

// ---------------------------------------------------------------- the selection and the participants

// TST-472616 · level: unit · module: MOD-review-pages
// guards: UC-007; THE PAGE NAMES WHERE IT SENDS; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK; EVERY STEP EXPLAINS ITSELF
// given: a product with the requirements A LOAN HAS A DUE DATE (realised by UC-001 and UC-002) and A BOOK IS SHELVED (realised by none); the register with a model endpoint and a CI agent that declare draft text and a person that does not; the product holds no job workflow
// input: the page #use-case/id=draft
// expect: both requirements listed, only the unrealised one checked; the two drafting participants listed, each with where it processes data and its route — the endpoint's the tab, the CI agent's one that cannot be taken, with the reason naming the workflow file —, the person not; no Run on the page; the explanations of the selection and of the participant folded in it; nothing written, nothing sent
test("use-case/draft — the requirements to cover by default, and the participants with their places and routes", async () => {
  endpointAnswers(drafted([OTHER]));
  const fake = fakeProduct();
  const target = await show(fake);
  const boxes = byClass(target, "input", "requirement");
  assert.deepEqual(boxes.map((box) => box.value).sort(), [OTHER, RULE].sort());
  assert.deepEqual(boxes.filter((box) => box.checked).map((box) => box.value), [OTHER], "by default those no use case realises");
  const participants = byClass(target, "li", "participant");
  assert.deepEqual(participants.map((item) => item.getAttribute("data-name")).sort(), ["ci-agent", "drafter-a"]);
  const endpoint = participants.find((item) => item.getAttribute("data-name") === "drafter-a");
  assert.match(byClass(endpoint, "span", "place")[0].textContent, /this machine/);
  assert.match(byClass(endpoint, "span", "route")[0].textContent, /tab/);
  const ci = participants.find((item) => item.getAttribute("data-name") === "ci-agent");
  assert.match(byClass(ci, "span", "place")[0].textContent, /GitHub Actions in the USA/);
  assert.match(byClass(ci, "span", "reason")[0].textContent, /agent-m-jobs\.yml/);
  assert.equal(runButtons(target).length, 0, "no Run on the page");
  assert.ok(find(target, (node) => node.localName === "details").length >= 2, "the explanations are folded");
  assert.equal(fake.writes().length, 0, "nothing written");
  assert.equal(requests.length, 0, "nothing sent");
});

// The line a drafting page shows above what it draws from a graph of an earlier commit.
const asOfLines = (target) => byClass(target, "p", "graph-as-of").map((node) => node.textContent);
const NEWER = "A LOAN IS RENEWED ONCE";
const WITH_NEWER = { ...FILES, "SPEC.md": SPEC + text("", `**${NEWER}** *(Product Owner)*`, "A loan is renewed at most once.", "*Check:* `tests/renew.test.mjs`") };
const EARLIER = "e1".repeat(20);

// TST-1300006 · level: unit · module: MOD-review-pages
// guards: UC-007; A PAGE LOAD READS THE REPOSITORY IN BATCHES
// given: (a) the product of TST-472616, the graph of its head stored; (b) a head whose SPEC adds A LOAN IS RENEWED ONCE, whose graph trace-cache does not hold, a latest.json naming an earlier commit and that commit's graph, built from the files of (a) (A BOOK IS SHELVED realised by no use case there)
// input: the page #use-case/id=draft for each
// expect: (a) no line data of an earlier graph (no p.graph-as-of); (b) the three requirements of the head's SPEC listed — the head's own statement —, A BOOK IS SHELVED checked by the earlier graph's gaps, and one p.graph-as-of reading "As of <earlier, 7>: the trace graph of the newest commit, <head, 7>, is being stored."; nothing written, nothing sent
test("use-case/draft — while the head's graph is not stored, the page draws from the graph stored last and says so in one line", async () => {
  endpointAnswers(drafted([OTHER]));
  assert.deepEqual(asOfLines(await show(fakeProduct())), [], "the head's own graph: no line");
  const fake = fakeProduct(WITH_NEWER, { earlier: { commit: EARLIER, files: FILES } });
  const target = await show(fake);
  const boxes = byClass(target, "input", "requirement");
  assert.deepEqual(boxes.map((box) => box.value).sort(), [OTHER, RULE, NEWER].sort(), "the requirements are the head's SPEC's");
  assert.deepEqual(boxes.filter((box) => box.checked).map((box) => box.value), [OTHER], "checked by the earlier graph's gaps");
  const head = (await fake.host.readSnapshot("trunk")).commit;
  assert.deepEqual(asOfLines(target), [`As of ${EARLIER.slice(0, 7)}: the trace graph of the newest commit, ${head.slice(0, 7)}, is being stored.`]);
  assert.equal(fake.writes().length, 0, "nothing written");
  assert.equal(requests.length, 0, "nothing sent");
});

// TST-1300007 · level: unit · module: MOD-review-pages
// guards: UC-007; A PAGE LOAD READS THE REPOSITORY IN BATCHES
// given: a product whose branch trace-cache holds neither the head's graph nor a latest.json
// input: the page #use-case/id=draft
// expect: the page shows the problem "the trace graph of <head> is not stored yet" (GraphNotStored, as before), no requirement to cover and no line of an earlier graph; nothing written
test("use-case/draft — with neither graph stored, the page names the GraphNotStored problem", async () => {
  const fake = fakeProduct(FILES, { earlier: { commit: EARLIER, files: null } });
  const target = await show(fake);
  const head = (await fake.host.readSnapshot("trunk")).commit;
  assert.match(target.textContent, new RegExp(`the trace graph of ${head.slice(0, 12)} is not stored yet`));
  assert.deepEqual(byClass(target, "input", "requirement"), []);
  assert.deepEqual(asOfLines(target), []);
  assert.equal(fake.writes().length, 0);
});

// TST-494007 · level: unit · module: MOD-review-pages
// guards: UC-017; UC-049; UC-007
// given: a register with the CLI agent lead (route `bridge lab-pc agent claude`), the subagent sub (route `through lead`) and the subagent orphan (route `through nobody`), each declaring draft text; the product holds no job workflow
// input: the page #use-case/id=draft
// expect: lead and sub are listed, orphan is not (its route reaches no CLI agent of the register); the route of lead reads "bridge lab-pc", and the route of sub reads "bridge lab-pc" too — the route of the participant it is reached through — and not "no route of a job"
test("use-case/draft — a subagent is listed with the route of the participant it is reached through", async () => {
  const lead = "| lead | CLI agent | model-y | 200000 | — | draft text | this machine | bridge lab-pc agent claude |";
  const sub = "| sub | CLI agent | model-z | 200000 | — | draft text | this machine | through lead |";
  const orphan = "| orphan | CLI agent | model-w | 200000 | — | draft text | this machine | through nobody |";
  const fake = fakeProduct();
  const target = await show(fake, { id: "draft" }, { register: registerOf(lead, sub, orphan) });
  const listed = byClass(target, "li", "participant");
  assert.deepEqual(listed.map((item) => item.getAttribute("data-name")).sort(), ["lead", "sub"]);
  const routeOfName = (name) => byClass(listed.find((item) => item.getAttribute("data-name") === name), "span", "route")[0].textContent;
  assert.equal(routeOfName("lead"), "bridge lab-pc");
  assert.equal(routeOfName("sub"), "bridge lab-pc");
});

// ---------------------------------------------------------------- the run panel

// TST-472617 · level: unit · module: MOD-review-pages
// guards: THE PAGE NAMES WHERE IT SENDS; ONE CLICK PER DECISION; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK; UC-007
// given: the page with the requirement A BOOK IS SHELVED checked
// input: choosing the endpoint participant and pressing Show the run panel
// expect: the run panel of derive-use-cases — the destination drafter-a, where it processes data, the parts sent: the requirement, every existing use case, the book's chapter 8 —, and in it the only Run; nothing written, nothing sent
test("use-case/draft — Run is offered only from the run panel, which states what is sent where", async () => {
  endpointAnswers(drafted([OTHER]));
  const fake = fakeProduct();
  const target = await show(fake);
  await panelFor(target, "drafter-a");
  const panel = byClass(target, "section", "run-panel")[0];
  assert.match(panel.textContent, /drafter-a/);
  assert.match(panel.textContent, /this machine/);
  assert.match(panel.textContent, new RegExp(OTHER));
  assert.match(panel.textContent, /UC-001/);
  assert.match(panel.textContent, /Correction rounds: at most 5/);
  const sent = byClass(panel, "li", "part").map((item) => item.textContent.split(" — ")[0]);
  assert.ok(sent.includes(OTHER) && !sent.includes(RULE), `the requirement chosen is sent, and no other: ${sent.join("; ")}`);
  assert.equal(runButtons(target).length, 1, "one Run");
  assert.equal(runButtons(panel).length, 1, "and it is the panel's");
  assert.equal(fake.writes().length, 0, "nothing written");
  assert.equal(requests.length, 0, "nothing sent");
});

// ---------------------------------------------------------------- Run in the tab

// TST-472618 · level: unit · module: MOD-review-pages
// guards: A REVIEWED ARTIFACT ENTERS THE DEFAULT BRANCH AS OPEN; A GENERATED ARTIFACT IS A PROPOSAL; A JOB IS RECORDED IN ITS PRODUCT REPOSITORY; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK; UC-007
// given: the page with the panel of the endpoint participant, whose endpoint answers a use case that realises A BOOK IS SHELVED
// input: a click on Run
// expect: one request to the endpoint; the use case written as a new file under docs/use-cases/ in one commit, beside the job's record in docs/jobs/ (its start and taking in one commit, its end in another); the page naming the file written; after a new draw of the list, the file listed as open
test("use-case/draft — Run runs the job in this tab and writes the drafted use case open, in one commit", async () => {
  endpointAnswers(drafted([OTHER]));
  const fake = fakeProduct();
  const target = await show(fake);
  await panelFor(target, "drafter-a");
  click(runButtons(target)[0]);
  await until(() => byClass(target, "ul", "written").length === 1, "the result");
  assert.equal(requests.length, 1, "one exchange");
  const written = fake.writes().filter((change) => change.files.some((file) => file.path.startsWith("docs/use-cases/")));
  assert.equal(written.length, 1, "the use cases are one commit");
  assert.deepEqual(written[0].files.map((file) => file.path), [UC_PATH("UC-003", "shelve-a-book")]);
  const records = fake.writes().filter((change) => change.files.some((file) => file.path.startsWith("docs/jobs/")));
  assert.equal(records.length, 2, "the record: start with taking, then the end");
  assert.match(byClass(target, "ul", "written")[0].textContent, /UC-003/);
  const list = await show(fake, {});
  assert.equal(byClass(rowOf(list, "UC-003"), "span", "badge")[0].textContent, "open");
});

// TST-472619 · level: unit · module: MOD-review-pages
// guards: THE ROUNDS ARE COUNTED AND SHOWN; UC-007
// given: an endpoint whose first answer realises a name the SPEC does not hold and whose second realises A BOOK IS SHELVED
// input: Run on the panel
// expect: the page says "Correction rounds: 2" and lists no finding left
test("use-case/draft — the rounds are shown, and nothing is left when the loop passes", async () => {
  endpointAnswers(drafted([UNKNOWN]), drafted([OTHER]));
  const fake = fakeProduct();
  const target = await show(fake);
  await panelFor(target, "drafter-a");
  click(runButtons(target)[0]);
  await until(() => byClass(target, "p", "rounds").length === 1, "the rounds");
  assert.equal(byClass(target, "p", "rounds")[0].textContent, "Correction rounds: 2");
  assert.equal(byClass(target, "li", "left").length, 0, "nothing left");
});

// TST-472620 · level: unit · module: MOD-review-pages
// guards: THE ROUNDS ARE COUNTED AND SHOWN; UC-007
// given: an endpoint that always answers a use case without its section Postcondition
// input: Run on the panel
// expect: the page shows the rounds and, among what the loop left, the finding that names the missing section
test("use-case/draft — what the loop left is shown beside the rounds", async () => {
  const flawed = drafted([OTHER]);
  flawed.files[0].text = flawed.files[0].text.replace(/\n## Postcondition[^]*$/, "");
  endpointAnswers(flawed);
  const fake = fakeProduct();
  const target = await show(fake);
  await panelFor(target, "drafter-a");
  click(runButtons(target)[0]);
  await until(() => byClass(target, "ul", "written").length === 1, "the result");
  assert.ok(byClass(target, "li", "left").length >= 1, "a finding is left");
  assert.match(byClass(target, "ul", "left")[0].textContent, /## Postcondition/);
  assert.match(byClass(target, "p", "rounds")[0].textContent, /^Correction rounds: [2-9]/);
});

// ITM-1386 (UC007-F3): THE ROUNDS ARE COUNTED AND SHOWN asks "the findings of each round … shown with the draft". The reading taken: after Run, the drafting page of the use
// cases shows the rounds as the architecture's are shown, by MOD-review-pages' one section of rounds (sections.mjs roundsSection) — <section class="rounds">, a
// <section class="round" data-number="n"> for each round headed "Round n — …", its findings each in a <li class="finding">, the last round's findings marked left unless
// the loop passed, and <p class="left-count">.
const roundBlocks = (target) => byClass(byClass(target, "section", "rounds")[0] ?? target, "section", "round");

// TST-1386001 · level: unit · module: MOD-review-pages
// guards: THE ROUNDS ARE COUNTED AND SHOWN; UC-007
// given: an endpoint whose first answer is a use case without its section Postcondition and whose second is the use case corrected, so that round 1 finds the missing section and round 2 finds nothing
// input: Run on the panel
// expect: known positive — "Correction rounds: 2" and the use case written; the page holds one section of rounds with two rounds: round 1 headed "Round 1 — …" with a finding naming ## Postcondition, not marked left; round 2 headed "Round 2 — no finding"; "Left: none"
test("use-case/draft — after Run, each round is shown with its findings, round 1's although the loop passed", async () => {
  const flawed = drafted([OTHER]);
  flawed.files[0].text = flawed.files[0].text.replace(/\n## Postcondition[^]*$/, "");
  endpointAnswers(flawed, drafted([OTHER]));
  const fake = fakeProduct();
  const target = await show(fake);
  await panelFor(target, "drafter-a");
  click(runButtons(target)[0]);
  await until(() => byClass(target, "ul", "written").length === 1, "the result");
  assert.equal(byClass(target, "p", "rounds")[0].textContent, "Correction rounds: 2", "known positive: the rounds are counted");
  assert.match(byClass(target, "ul", "written")[0].textContent, /UC-003/, "known positive: the use case is written");
  assert.equal(byClass(target, "section", "rounds").length, 1, "one section of rounds");
  const rounds = roundBlocks(target);
  assert.deepEqual(rounds.map((block) => block.getAttribute("data-number")), ["1", "2"]);
  assert.match(find(rounds[0], (node) => node.localName === "h4")[0].textContent, /^Round 1 — /);
  const first = byClass(rounds[0], "li", "finding");
  assert.ok(first.some((item) => /## Postcondition/.test(item.textContent)), `round 1's finding names the section: ${first.map((item) => item.textContent).join(" | ")}`);
  assert.equal(byClass(rounds[0], "li", "left").length, 0, "round 1's findings are not left");
  assert.equal(find(rounds[1], (node) => node.localName === "h4")[0].textContent, "Round 2 — no finding");
  assert.equal(byClass(target, "p", "left-count")[0].textContent, "Left: none");
});

// TST-1386002 · level: unit · module: MOD-review-pages
// guards: THE ROUNDS ARE COUNTED AND SHOWN; UC-007
// given: an endpoint that always answers a use case without its section Postcondition, so that the loop stops with the finding left
// input: Run on the panel
// expect: the section of rounds holds as many rounds as "Correction rounds: n" counts; the last round's finding naming ## Postcondition is marked left, no earlier round's is; the count of left findings is the number of items of ul.left; counter-proof of TST-1386001's "Left: none"
test("use-case/draft — after Run, the last round's findings are marked left when the loop stops with them", async () => {
  const flawed = drafted([OTHER]);
  flawed.files[0].text = flawed.files[0].text.replace(/\n## Postcondition[^]*$/, "");
  endpointAnswers(flawed);
  const fake = fakeProduct();
  const target = await show(fake);
  await panelFor(target, "drafter-a");
  click(runButtons(target)[0]);
  await until(() => byClass(target, "ul", "written").length === 1, "the result");
  const counted = Number(/^Correction rounds: (\d+)$/.exec(byClass(target, "p", "rounds")[0].textContent)?.[1]);
  const rounds = roundBlocks(target);
  assert.ok(counted >= 2, "known positive: the loop ran more than one round");
  assert.equal(rounds.length, counted, "each round counted is shown");
  const last = rounds[rounds.length - 1];
  assert.ok(byClass(last, "li", "left").some((item) => /## Postcondition/.test(item.textContent)), "the last round's finding is marked left");
  for (const block of rounds.slice(0, -1)) assert.equal(byClass(block, "li", "left").length, 0, `round ${block.getAttribute("data-number")} has nothing left`);
  const leftItems = find(byClass(target, "ul", "left")[0], (node) => node.localName === "li").length;
  assert.equal(byClass(target, "p", "left-count")[0].textContent, leftItems === 1 ? "Left: 1 finding" : `Left: ${leftItems} findings`);
});

// TST-472621 · level: unit · module: MOD-review-pages
// guards: UC-007
// given: an endpoint that always answers a use case that realises no requirement
// input: Run on the panel; then the page of the use case written
// expect: the use case is written, and beside it on its own page the note of the job's end record — the use case realises no requirement (UC-007 4b) —; the page of UC-001 shows no such notes
test("use-case/draft — the note of the job stands beside the use case it concerns", async () => {
  endpointAnswers(drafted([]));
  const fake = fakeProduct();
  const target = await show(fake);
  await panelFor(target, "drafter-a");
  click(runButtons(target)[0]);
  await until(() => byClass(target, "ul", "written").length === 1, "the result");
  const one = await show(fake, { id: "UC-003" });
  const notes = byClass(one, "section", "job-notes");
  assert.equal(notes.length, 1);
  assert.match(notes[0].textContent, /UC-003 realises no requirement/);
  const other = await show(fake, { id: "UC-001" });
  assert.equal(byClass(other, "section", "job-notes").length, 0);
});

// ---------------------------------------------------------------- another route

// TST-472622 · level: unit · module: MOD-review-pages
// guards: A JOB IS RECORDED IN ITS PRODUCT REPOSITORY; ONE CLICK PER DECISION; UC-007
// given: a product that holds the job workflow, the CI agent among the participants
// input: choosing the CI agent, the run panel, Run
// expect: nothing sent to any endpoint; one commit holding the job's start record in docs/jobs/ and nothing else; the page says the job is queued, naming its identifier, and writes no use case
test("use-case/draft — a job on the CI route is queued there and not run in the tab", async () => {
  endpointAnswers(drafted([OTHER]));
  const fake = fakeProduct({ ...FILES, [WORKFLOW]: "name: Agent M jobs\n" });
  const target = await show(fake);
  await panelFor(target, "ci-agent");
  click(runButtons(target)[0]);
  await until(() => byClass(target, "p", "queued").length === 1, "the queueing");
  assert.equal(requests.length, 0, "nothing sent from the tab");
  assert.equal(fake.writes().length, 1, "one commit");
  assert.deepEqual(fake.writes()[0].files.map((file) => file.path.replace(/JOB-[^.]+/, "JOB")), ["docs/jobs/JOB.md"]);
  assert.match(byClass(target, "p", "queued")[0].textContent, /JOB-\d{8}-\d{4}-[0-9a-f]{4}/);
  const record = fake.writes()[0].files[0].text;
  assert.match(record, /^route: ci hosted$/m, "the record names the route");
  assert.ok(!record.includes("## Taken"), "and is not taken by the tab");
  assert.ok(!Object.keys(fake.files()).some((path) => path.startsWith("docs/use-cases/UC-003")), "no use case written");
});

// TST-472623 · level: unit · module: MOD-review-pages
// guards: A REVIEWED ARTIFACT ENTERS THE DEFAULT BRANCH AS OPEN; UC-007
// given: a use case a job wrote, with a note of that job, which a person has since accepted by a record naming its text
// input: the page of that use case
// expect: no notes of the job: they stand beside an open use case only
test("use-case/<id> — the notes of the job are not shown beside a use case that is accepted", async () => {
  endpointAnswers(drafted([]));
  const fake = fakeProduct();
  const target = await show(fake);
  await panelFor(target, "drafter-a");
  click(runButtons(target)[0]);
  await until(() => byClass(target, "ul", "written").length === 1, "the result");
  const path = UC_PATH("UC-003", "shelve-a-book");
  assert.equal(byClass(await show(fake, { id: "UC-003" }), "section", "job-notes").length, 1, "known positive: shown while open");
  await fake.host.commitFiles({ branch: "trunk", expectedHead: (await fake.host.readSnapshot("trunk")).commit,
    files: [{ path: "docs/approvals/UC-003-" + blobOf(fake.files()[path]).slice(0, 12) + ".md", text: writeDocument(approvalSchema, { fields: { kind: "use-case", file: path, blob: blobOf(fake.files()[path]) } }) }], message: "accept" });
  const accepted = await show(fake, { id: "UC-003" });
  assert.equal(byClass(accepted, "span", "badge")[0].textContent, "accepted");
  assert.equal(byClass(accepted, "section", "job-notes").length, 0);
});

// TST-472624 · level: unit · module: MOD-review-pages
// guards: THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK; THE PAGE NAMES WHERE IT SENDS
// given: the drafting page without a token
// input: the page
// expect: the requirements and the participants are shown; no way to the run panel; the token's step linked; nothing written
test("use-case/draft — without a token the run panel is not offered, and the token's step is linked", async () => {
  const fake = fakeProduct();
  const target = await show(fake, { id: "draft" }, { token: false });
  assert.equal(byClass(target, "input", "requirement").length, 2, "known positive: the page is drawn");
  assert.equal(byClass(target, "button", "prepare").length, 0);
  assert.equal(find(target, (node) => node.localName === "a" && node.getAttribute("href")?.startsWith("#add/")).length >= 1, true);
  assert.equal(fake.writes().length, 0);
});

// TST-472625 · level: unit · module: MOD-review-pages
// guards: THE PAGE NAMES WHERE IT SENDS; UC-007
// given: the page, whose selection the person changes: A LOAN HAS A DUE DATE ticked, A BOOK IS SHELVED unticked
// input: the run panel; then Run
// expect: the panel's parts name the requirement ticked and not the one unticked; the job's record names the selection as the requirements it works on
test("use-case/draft — the selection the person made is what the panel shows and the job works on", async () => {
  endpointAnswers(drafted([RULE]));
  const fake = fakeProduct();
  const target = await show(fake);
  for (const box of byClass(target, "input", "requirement")) {
    box.checked = box.value === RULE;
    box.dispatchEvent(new Event("change"));
  }
  await panelFor(target, "drafter-a");
  const sent = byClass(byClass(target, "section", "run-panel")[0], "li", "part").map((item) => item.textContent.split(" — ")[0]);
  assert.ok(sent.includes(RULE) && !sent.includes(OTHER), sent.join("; "));
  click(runButtons(target)[0]);
  await until(() => byClass(target, "ul", "written").length === 1, "the result");
  const record = fake.writes().find((change) => change.files.some((file) => file.path.startsWith("docs/jobs/"))).files[0].text;
  assert.match(record, new RegExp(`^works_on:\\n  - ${RULE}\\n`, "m"));
});

// ---------------------------------------------------------------- what the panel names besides: the route (ITM-1379)

// UC-010 (Precondition): on the server's runners "the calls are billed per use by the agent's provider — the run panel says so"; MOD-site-frame's runPanel: "What the panel of a
// use case names besides — the route, the gates the jobs will meet — the view shows beside it." Reading taken: the view appends that line to the panel's element, as the drafting
// of requirements appends its count of existing requirements; it reads <p class="route-billing">.
const billing = (target) => byClass(byClass(target, "section", "run-panel")[0], "p", "route-billing");

// TST-1379001 · level: unit · module: MOD-review-pages
// guards: UC-010; EVERY STEP EXPLAINS ITSELF
// given: a product that holds the job workflow, the CI agent ci-agent among the participants (route ci hosted), the requirement A BOOK IS SHELVED checked
// input: choosing ci-agent and pressing Show the run panel
// expect: the run panel holds one p.route-billing that names the route ci hosted and says the calls are billed per use by the agent's provider; nothing written, nothing sent
test("use-case/draft — on the server's runners, the run panel says the calls are billed per use by the agent's provider", async () => {
  endpointAnswers(drafted([OTHER]));
  const fake = fakeProduct({ ...FILES, [WORKFLOW]: "name: Agent M jobs\n" });
  const target = await show(fake);
  await panelFor(target, "ci-agent");
  const lines = billing(target);
  assert.equal(lines.length, 1, "one line beside the panel of ci-agent");
  assert.match(lines[0].textContent, /ci hosted/);
  assert.match(lines[0].textContent, /billed per use by the agent's provider/);
  assert.equal(fake.writes().length, 0, "nothing written");
  assert.equal(requests.length, 0, "nothing sent");
});

// TST-1379002 · level: unit · module: MOD-review-pages
// guards: UC-010
// given: the same product and page, the model endpoint drafter-a among the participants (route the tab)
// input: choosing drafter-a and pressing Show the run panel
// expect: known positive — the run panel is the one of drafter-a; counter-proof: it holds no p.route-billing and says nothing of calls billed per use, the job not being on the server's runners
test("use-case/draft — a job in this tab is not said to be billed per use on the server's runners", async () => {
  endpointAnswers(drafted([OTHER]));
  const fake = fakeProduct({ ...FILES, [WORKFLOW]: "name: Agent M jobs\n" });
  const target = await show(fake);
  await panelFor(target, "drafter-a");
  const panel = byClass(target, "section", "run-panel")[0];
  assert.match(panel.textContent, /drafter-a/, "known positive: the panel of drafter-a");
  assert.equal(billing(target).length, 0);
  assert.doesNotMatch(panel.textContent, /billed per use/);
});
