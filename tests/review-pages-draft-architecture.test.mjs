// MOD-review-pages' start of the architecture's derivation (ITM-442), as the accepted text of docs/architecture/MOD-review-pages.md states it: "`<k>/draft` — drafting: …
// for the architecture, what the derivation covers, its preconditions, the drafting and the reviewing participant — a reviewer offered only if it differs from the drafter in
// participant and model —; then the run panel and *Run*. A job the person starts here and waits for runs in this tab, attended … A job on another route — a CI agent … — is queued
// there", and UC-022 steps 1 to 4 and the alternative flows 1a, 1b, 1c, 2a, 3a, 4a: what the derivation covers — every requirement and every use case, no selection —; the findings
// of the precondition `architecture-ready`; the drafting and the reviewing participant, each one that can draft text with where it processes data, a participant whose place a linked
// source forbids left out, a reviewer only if it differs from the drafter, Run not offered with its reason when none does; the run panel of `derive-architecture`, what does not fit
// named; Run, one click, the job run in this tab or queued on another route; nothing sent without the click.
// Run: node --test tests/review-pages-draft-architecture.test.mjs
//
// Module: MOD-review-pages
// Guards: UC-022; THE FIRST ARCHITECTURE IS DESIGNED AS A WHOLE; ARCHITECTURE IS DESIGNED ONLY AGAINST ACCEPTED USE CASES; NO REVIEWER IS THE DRAFTER; THE PAGE NAMES WHERE IT SENDS; RESTRICTED CONTENT GOES ONLY WHERE ITS SOURCE PERMITS; NOTHING IS LEFT OUT OF AN ARCHITECTURE PROMPT SILENTLY; ONE CLICK PER DECISION; EVERY STEP EXPLAINS ITSELF
// Level: unit
//
// This imports the browser harness of tests/review-pages-harness.mjs unchanged. The product is a fixture behind a Host of the tests' own that keeps to MOD-repository-hosts'
// interface; the instance is a read-only snapshot of this repository, whose book is on the disk, with the register of participants the test gives. The model endpoints are fixtures
// standing behind the global `fetch`, which the test replaces and restores. The real MOD-job-runner, MOD-runtimes, MOD-job-ledger, MOD-approvals, MOD-spec-changes, MOD-source-register,
// MOD-trace-graph, MOD-participant-list and MOD-site-frame run as they are, the strategies registered as the view hands them to the frame; the step `due-diligence`, which no module
// registers yet, is a stub of this file. Where the module file leaves a reading open, the test states the one it takes, and the pull request names it:
//   - The address of the page is the decision route with the id `draft` — #decision/id=draft.
//   - The page holds <section class="covers"> whose <li class="requirement"> and <li class="use-case"> name every requirement and every use case, and no input to select among them.
//   - The precondition's finding is a <p class="finding error|warning"> in <section class="readiness">; beside an open use case, <a class="review-link"> to #use-case/id=<id>; beside open SPEC
//     changes, <a class="decide-first"> to #spec-entry; beside an existing architecture, <a class="change-architecture"> to #decision, the list from which a decision is changed (UC-023).
//   - <li class="participant"> for each participant able to draft text whose place no linked source forbids, as on the page of use cases; <li class="reviewer"> with <input class="reviewer">
//     (a radio) for each participant offered as reviewer once a drafter is chosen; none before; <p class="no-reviewer"> with the reason when none differs from the drafter.
//   - <button class="prepare"> shows the run panel; Run is the panel's own button. A reviewer that cannot be offered is a finding of the panel under NO REVIEWER IS THE DRAFTER, and the panel
//     offers no Run. After a run in the tab the page shows <p class="ran">; the draft that waits for the author is not part of this item.
//   - A linked source is one the product's docs/sources.md holds a row of; its places are those MOD-source-register's permittedPlaces gives its register entry in the instance.
// Each test states its input and its expected result before it runs (given / input / expect). The counter-proofs are recorded in the pull request.

import "./review-pages-harness.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { approvalSchema } from "../src/approvals/index.mjs";
import { writeDocument } from "../src/documents/index.mjs";
import { withStoredGraph } from "./stored-graph-fake.mjs";
import { until as settled } from "./review-pages-wait.mjs";

// Every commit the fakes of this file make is its own: MOD-trace-graph's storedGraph keeps a commit's graph for the page.
let commitsMade = 0;

const { openStore, writeSetting } = await import("../src/browser-store/index.mjs");
const { registerStrategies } = await import("../src/job-runner/index.mjs");
const pages = await import("../src/review-pages/index.mjs").catch((error) => ({ error }));
// The route as the frame shows it: the one its `module` gives, which carries `leave` and `unsaved` (MOD-site-frame's Route).
const route = await pages.view?.routes.find((candidate) => candidate.name === "decision")?.module();
(pages.view?.strategies ?? []).forEach((strategies, at) => registerStrategies(`tests/review-pages-draft-architecture.test.mjs#${at}`, strategies));
// The step due-diligence is registered by no module yet; a stub stands for it, and gives way when a module registers it.
try { registerStrategies("tests/review-pages-draft-architecture.test.mjs#stub", { steps: { "due-diligence": async (draft) => ({ draft, findings: [] }) } }); } catch { /* registered by a module */ }

// ---------------------------------------------------------------- the product

const text = (...lines) => `${lines.join("\n")}\n`;
const blobOf = (body) => createHash("sha1").update(`blob ${Buffer.byteLength(body)}\0${body}`).digest("hex");
const failure = (name, message, fields = {}) => Object.assign(new Error(message), { name }, fields);
const ON_GITHUB = { server: "github", origin: "https://github.com", path: "alice/thesis-tool", web: "https://github.com/alice/thesis-tool" };
const TOKEN = { value: "github_pat_ALICEthesisTOOL0123456789abcdef", name: "Agent M · thesis-tool", expires: "2027-01-01" };
const RULE = "A LOAN HAS A DUE DATE", OTHER = "A BOOK IS SHELVED";
const SPEC = text("# Thesis tool — Specification", "", "## Lending", "", `**${RULE}** *(Product Owner)*`, "Every loan states the date by which the book is returned.",
  "*Check:* `tests/loan.test.mjs`", "", `**${OTHER}** *(Product Owner)*`, "Every book stands on a shelf.", "*Check:* `tests/shelf.test.mjs`");
const useCase = (id, title, goal, realises) => text("---", `id: ${id}`, `title: ${title}`, "area: lending", "actors:", "  - Member", "realises:",
  ...realises.map((name) => `  - ${name}`), "---", `# ${id} ${title}`, "", `**Goal.** ${goal}`);
const UC1_PATH = "docs/use-cases/UC-001-check-out-a-book.md", UC2_PATH = "docs/use-cases/UC-002-extend-a-loan.md";
const UC1 = useCase("UC-001", "Check out a book", "The member borrows a book.", [RULE]);
const UC2 = useCase("UC-002", "Extend a loan", "The member extends a loan once.", [OTHER]);
const accepted = (id, path, body) => ({ [`docs/approvals/${id}-${blobOf(body).slice(0, 12)}.md`]: writeDocument(approvalSchema, { fields: { kind: "use-case", file: path, blob: blobOf(body) } }) });
// Every use case accepted, no architecture, no SPEC change open: a product from which the first architecture can be derived.
const READY = { "README.md": "# Thesis tool\n", "SPEC.md": SPEC, [UC1_PATH]: UC1, [UC2_PATH]: UC2, ...accepted("UC-001", UC1_PATH, UC1), ...accepted("UC-002", UC2_PATH, UC2) };
const WORKFLOW = ".github/workflows/agent-m-jobs.yml";
const ARC_PATH = "docs/architecture/ARC-001-the-whole-system.md";
const ARC_DRAFT_PATH = "docs/architecture/ARC-900-system.md";
const MOD_DRAFT_PATH = "docs/architecture/MOD-lending.md";
const QUEUE = "docs/spec-freigaben/2026-10-01_lending";
const SECRET_LINK = text("# Requirement sources of the thesis tool", "", "| Source | Version | Hash | Part |", "|---|---|---|---|", `| SRC-secret | 1 | ${"ab".repeat(32)} | |`);
const NPM_GPL = "https://registry.npmjs.org/gpl-lib";
const NPM_MIT = "https://registry.npmjs.org/mit-lib";
const NPM_MISSING = "https://registry.npmjs.org/missing-lib";
const NPM_BLOCKED = "https://registry.npmjs.org/blocked-lib";

// ---------------------------------------------------------------- the hosts

function fakeProduct(files = READY) {
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
  const snapshotAt = (...args) => withStoredGraph(bareSnapshotAt(...args));
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

// The instance: this repository's files from the disk — its book among them —, with the register of participants the test gives and the register entries `entries` adds.
const ROOT = new URL("../", import.meta.url);
const onDisk = (path) => { try { return readFileSync(new URL(path, ROOT), "utf8"); } catch { return null; } };
const REGISTER_HEAD = onDisk("docs/participants.md").split("\n").filter((line, at, all) => at <= all.findIndex((each) => each.startsWith("|---"))).join("\n");
const registerOf = (...rows) => `${REGISTER_HEAD}\n${rows.join("\n")}\n`;
const row = (name, model, place, route, context = 200000) => `| ${name} | model endpoint | ${model} | ${context} | — | draft text | ${place} | ${route} |`;
const DRAFTER = row("drafter-a", "model-a", "this machine", "endpoint ep1");
const REVIEWER = row("reviewer-b", "model-b", "this machine", "endpoint ep2");
const TWIN = row("twin-a", "model-a", "this machine", "endpoint ep3");
const FAR = row("far-c", "model-c", "a server in Singapore", "endpoint ep4");
const SMALL = row("small-d", "model-d", "this machine", "endpoint ep5", 50000);
const CI_ROW = "| ci-agent | CI agent | model-x | 200000 | — | draft text | GitHub Actions in the USA | ci hosted secret CI_KEY |";
const READER_ROW = "| reader | person | — | — | — | read the repository | — | the GitHub account `reader` |";
const SECRET_ENTRY = text("---", "id: SRC-secret", "title: Secret rules", "kind: document", "authority: normative", "licence: restricted — internal use only", "places:", "  - this machine", "---",
  "# SRC-secret Secret rules", "", "## Versions", "", "| Version | Date | Edition | Read from | Files |", "|---|---|---|---|---|", "| 1 | 2026-10-01 | v1 | here | 1 file |");
function fakeInstance(register, entries = {}) {
  const snapshot = { repository: { server: "github", origin: "https://github.com", path: "alice/agent-m", web: "https://github.com/alice/agent-m" }, ref: "main",
    commit: "abc123def4567890abc123def4567890abc123de", paths: Object.keys(entries), read: async (path) => (path === "docs/participants.md" ? register : path in entries ? entries[path] : onDisk(path)), blob: () => null };
  return { host: { async repositoryInfo() { return { defaultBranch: "main", visibility: "public", canWrite: false, archived: false, description: "" }; },
    async readSnapshot() { return snapshot; } } };
}

// The model endpoints behind the global fetch: ep1 answers the architecture, ep2 the reviewer's findings (none); every request is kept.
let requests = [];
const realFetch = globalThis.fetch;
function endpointsAnswer() {
  requests = [];
  globalThis.fetch = async (url) => {
    requests.push(String(url));
    const draft = String(url).includes("ep2") ? { findings: [] } : { files: [] };
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ draft, answers: [] }) } }], usage: { prompt_tokens: 10, completion_tokens: 5 } }),
      { status: 200, headers: { "content-type": "application/json" } });
  };
}
test.afterEach(() => { globalThis.fetch = realFetch; });

function modelAnswer(body) {
  return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(body) } }],
    usage: { prompt_tokens: 10, completion_tokens: 5 } }), { status: 200, headers: { "content-type": "application/json" } });
}

function packageData(licence) {
  return { license: licence, "dist-tags": { latest: "1.1.0" }, versions: { "1.0.0": {}, "1.1.0": {} },
    time: { "1.0.0": "2023-01-01T00:00:00.000Z", "1.1.0": "2024-01-01T00:00:00.000Z" } };
}

const REVIEW_FINDING = { artifact: ARC_DRAFT_PATH, line: 19, kind: "warning", rule: "AN ARCHITECTURE IS CHECKED WHEN IT IS COMPLETE",
  what: "the system boundary is unclear", fix: "state the system boundary" };
const findingLine = (found) => `${found.artifact}:${found.line}: ${found.kind}: ${found.what} [${found.rule}] — ${found.fix}.`;

function architectureDraft({ candidate = "gpl-lib", alternative = "missing-lib", repository = "" } = {}) {
  return { files: [{
    path: ARC_DRAFT_PATH,
    class: "new",
    text: text(
      "---",
      "id: ARC-900",
      "title: System",
      "forced_by:",
      `  - ${RULE}`,
      "---",
      "# ARC-900 System",
      "",
      "## Context",
      "",
      "The library supports loans.",
      "",
      "## Decision",
      "",
      "| Candidate | Ecosystem | Repository | Role |",
      "|---|---|---|---|",
      `| ${candidate} | npm | ${repository} | chosen |`,
      "",
      "## Alternatives",
      "",
      "| Candidate | Ecosystem | Repository |",
      "|---|---|---|",
      `| ${alternative} | npm | |`,
      "",
      "## Consequences",
      "",
      "The chosen package is reused."
    ),
  }, {
    path: MOD_DRAFT_PATH,
    class: "new",
    text: text(
      "---",
      "id: MOD-lending",
      "title: Lending",
      "folder: src/lending/",
      "realises:",
      `  - ${RULE}`,
      "follows:",
      "  - ARC-900",
      "uses:",
      "provides:",
      "  - loans",
      "---",
      "# MOD-lending Lending",
      "",
      "## Responsibility",
      "",
      "It manages loans.",
      "",
      "## Parts",
      "",
      "- `index.mjs`",
      "",
      "## Data",
      "",
      "No data.",
      "",
      "## Interfaces",
      "",
      "- `loans`",
      "",
      "## Files",
      "",
      "It writes nothing.",
      "",
      "## Uses",
      "",
      "None."
    ),
  }] };
}

let drafterBodies = [];
function endpointsAndRegistries({ drafts = [architectureDraft()], reviewerFindings = [[]], registry = {} } = {}) {
  requests = [];
  drafterBodies = [];
  const calls = { ep1: 0, ep2: 0 };
  globalThis.fetch = async (input, init = {}) => {
    const href = String(input?.url ?? input);
    requests.push(href);
    if (href.includes("ep1.example.test")) drafterBodies.push(String(init.body ?? ""));
    if (href.includes("ep1.example.test")) {
      const at = calls.ep1++;
      return modelAnswer({ draft: drafts[Math.min(at, drafts.length - 1)], answers: at === 0 ? [] : [
        { finding: findingLine(REVIEW_FINDING), how: "answered", text: "the boundary is in the context" },
      ] });
    }
    if (href.includes("ep2.example.test")) {
      const at = calls.ep2++;
      return modelAnswer({ draft: { findings: reviewerFindings[Math.min(at, reviewerFindings.length - 1)] ?? [] }, answers: [] });
    }
    if (Object.hasOwn(registry, href)) {
      const answer = registry[href];
      if (answer instanceof Error) throw answer;
      return new Response(JSON.stringify(answer), { status: 200, headers: { "content-type": "application/json" } });
    }
    if ([NPM_GPL, NPM_MIT, NPM_MISSING, NPM_BLOCKED].includes(href)) {
      return new Response(JSON.stringify({ message: "not found" }), { status: 404, headers: { "content-type": "application/json" } });
    }
    return new Response(JSON.stringify({}), { status: 404, headers: { "content-type": "application/json" } });
  };
  return calls;
}

// ---------------------------------------------------------------- the page

const THREE = registerOf(DRAFTER, REVIEWER, TWIN, FAR, SMALL, CI_ROW, READER_ROW);
async function show(fake, { register = THREE, entries = {}, token = true } = {}) {
  assert.ok(route, `the route decision: ${pages.error?.message}`);
  const store = openStore(token ? "alice/agent-m" : "nobody/agent-m");
  if (token) writeSetting(store, "github-token:alice/thesis-tool", TOKEN);
  for (const name of ["ep1", "ep2", "ep3", "ep4", "ep5"]) writeSetting(store, `endpoint:${name}`, { url: `https://${name}.example.test/v1`, kind: "openai-compatible", model: "m", throughBridge: false });
  const target = document.createElement("div");
  document.body.append(target);
  const context = { page: "review", instance: { repository: "alice/agent-m", host: fakeInstance(register, entries).host }, store, go() {},
    product: { address: ON_GITHUB.web, kind: "github", host: fake.host } };
  await route.render(target, context, { id: "draft" });
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
const choose = (target, role, name) => {
  const box = byClass(target, "input", role).find((each) => each.value === name);
  assert.ok(box, `${name} is offered as ${role}`);
  box.checked = true;
  box.dispatchEvent(new Event("change"));
};
const namesOf = (target, role) => byClass(target, "li", role).map((item) => item.getAttribute("data-name")).sort();
async function panelFor(target, drafter, reviewer) {
  choose(target, "participant", drafter);
  if (reviewer) choose(target, "reviewer", reviewer);
  click(byClass(target, "button", "prepare")[0]);
  await until(() => byClass(target, "section", "run-panel").length === 1, "the run panel");
  return byClass(target, "section", "run-panel")[0];
}
const linksTo = (target, href) => find(target, (node) => node.localName === "a" && node.getAttribute("href") === href);

// ---------------------------------------------------------------- what the derivation covers

// TST-442001 · level: unit · module: MOD-review-pages
// guards: THE FIRST ARCHITECTURE IS DESIGNED AS A WHOLE; UC-022
// given: a product whose use cases UC-001 and UC-002 are accepted, with the requirements A LOAN HAS A DUE DATE and A BOOK IS SHELVED, and no architecture
// input: the page #decision/id=draft
// expect: the requirements and the use cases listed as covered, all four, and no input — no checkbox, no choice — to select among them; the folded explanation of an architecture; nothing written, nothing sent
test("decision/draft — the derivation covers every requirement and every use case, and offers no selection", async () => {
  endpointsAnswer();
  const fake = fakeProduct();
  const target = await show(fake);
  const covers = byClass(target, "section", "covers")[0];
  assert.ok(covers, "known positive: the page is drawn");
  assert.deepEqual(byClass(covers, "li", "requirement").map((item) => item.textContent).sort(), [OTHER, RULE].sort());
  assert.deepEqual(byClass(covers, "li", "use-case").map((item) => item.textContent).sort(), ["UC-001", "UC-002"]);
  assert.equal(find(target, (node) => node.localName === "input" && node.type === "checkbox").length, 0, "no selection");
  assert.equal(find(target, (node) => node.localName === "select").length, 0, "no selection");
  assert.match(find(target, (node) => node.localName === "details")[0].textContent, /architecture/);
  assert.equal(fake.writes().length, 0, "nothing written");
  assert.equal(requests.length, 0, "nothing sent");
});

// ---------------------------------------------------------------- the findings of the precondition

// TST-442002 · level: unit · module: MOD-review-pages
// guards: ARCHITECTURE IS DESIGNED ONLY AGAINST ACCEPTED USE CASES; UC-022
// given: a product whose use case UC-002 is open (no approval record), UC-001 accepted
// input: the page; then the choice of drafter-a and reviewer-b and the run panel
// expect: an error finding naming UC-002 and not UC-001, with a link Review UC-002 to #use-case/id=UC-002/product=<the product's address, percent-encoded>; the run panel offers no Run and lists the finding as blocking; nothing sent
test("decision/draft — an open use case is named with the link to its review, and nothing is derived", async () => {
  endpointsAnswer();
  const files = { ...READY };
  for (const path of Object.keys(files)) if (path.startsWith("docs/approvals/UC-002")) delete files[path];
  const open = fakeProduct(files);
  const target = await show(open);
  const finding = byClass(target, "p", "finding")[0];
  assert.ok(finding, "a finding is shown");
  assert.ok(finding.className.split(" ").includes("error"));
  assert.match(finding.textContent, /UC-002/);
  assert.ok(!/UC-001/.test(finding.textContent), "the accepted use case is not named");
  assert.equal(linksTo(target, `#use-case/id=UC-002/product=${encodeURIComponent(ON_GITHUB.web)}`).length, 1);
  assert.equal(linksTo(target, `#use-case/id=UC-001/product=${encodeURIComponent(ON_GITHUB.web)}`).length, 0);
  const panel = await panelFor(target, "drafter-a", "reviewer-b");
  assert.equal(runButtons(panel).length, 0, "no Run");
  assert.match(byClass(panel, "li", "blocking")[0].textContent, /UC-002/);
  assert.equal(requests.length, 0, "nothing sent");
});

// TST-442003 · level: unit · module: MOD-review-pages
// guards: THE FIRST ARCHITECTURE IS DESIGNED AS A WHOLE; UC-022
// given: a product whose use cases are accepted and whose change queue holds an entry no record decides
// input: the page; then the choice of drafter-a and reviewer-b and the run panel
// expect: a warning finding naming the entry's proposal, with a link to #spec-entry/product=<the product's address, percent-encoded> to decide it first; the run panel still offers Run — the SPEC change is the person's choice, not a block
test("decision/draft — an open SPEC change is named with the choice to decide it first, and Run is still offered", async () => {
  endpointsAnswer();
  const entry = `${QUEUE}/01-a-rule.md`;
  const fake = fakeProduct({ ...READY, [`${QUEUE}/index.md`]: text("# SPEC approvals — queue lending", "", "| Nr | Datei |", "|---|---|", "| 01 | `SPEC.md` |"),
    [entry]: text("**A NEW RULE** *(Product Owner)*", "A rule.") });
  const target = await show(fake);
  const finding = byClass(target, "p", "finding")[0];
  assert.ok(finding, "a finding is shown");
  assert.ok(finding.className.split(" ").includes("warning"));
  assert.ok(finding.textContent.includes(entry), finding.textContent);
  assert.equal(linksTo(target, `#spec-entry/product=${encodeURIComponent(ON_GITHUB.web)}`).length, 1);
  const panel = await panelFor(target, "drafter-a", "reviewer-b");
  assert.equal(runButtons(panel).length, 1, "Run is offered");
  assert.equal(requests.length, 0, "nothing sent");
});

// TST-442004 · level: unit · module: MOD-review-pages
// guards: THE FIRST ARCHITECTURE IS DESIGNED AS A WHOLE; UC-022
// given: a product that holds an architecture decision already, ARC-001
// input: the page; then the run panel
// expect: an error finding saying the product has an architecture, with a link naming UC-023 to #decision/product=<the product's address, percent-encoded>; the run panel offers no Run
test("decision/draft — an existing architecture leads to UC-023, and no first architecture is drafted beside it", async () => {
  endpointsAnswer();
  const fake = fakeProduct({ ...READY, [ARC_PATH]: text("---", "id: ARC-001", "title: The whole system", "---", "# ARC-001 The whole system") });
  const target = await show(fake);
  const finding = byClass(target, "p", "finding")[0];
  assert.ok(finding, "a finding is shown");
  assert.ok(finding.className.split(" ").includes("error"));
  assert.match(finding.textContent, /architecture already/);
  const leading = linksTo(target, `#decision/product=${encodeURIComponent(ON_GITHUB.web)}`);
  assert.ok(leading.some((each) => /UC-023/.test(each.textContent)), "a link names UC-023");
  const panel = await panelFor(target, "drafter-a", "reviewer-b");
  assert.equal(runButtons(panel).length, 0, "no Run");
});

// ---------------------------------------------------------------- the participants

// TST-442005 · level: unit · module: MOD-review-pages
// guards: NO REVIEWER IS THE DRAFTER; UC-022
// given: the register holds drafter-a (model-a), twin-a (model-a), reviewer-b (model-b), far-c, small-d, a CI agent and a person that cannot draft text
// input: the page; then drafter-a chosen as drafter
// expect: before the choice, no reviewer offered; the drafters are the six that can draft text, each with its place; after it, the reviewers are reviewer-b, far-c and small-d — not drafter-a, not twin-a, which uses drafter-a's model
test("decision/draft — a reviewer is offered only if it differs from the drafter in participant and in model", async () => {
  endpointsAnswer();
  const target = await show(fakeProduct());
  assert.deepEqual(namesOf(target, "participant"), ["ci-agent", "drafter-a", "far-c", "reviewer-b", "small-d", "twin-a"]);
  assert.match(byClass(byClass(target, "li", "participant").find((item) => item.getAttribute("data-name") === "reviewer-b"), "span", "place")[0].textContent, /this machine/);
  assert.deepEqual(namesOf(target, "reviewer"), [], "none before a drafter is chosen");
  choose(target, "participant", "drafter-a");
  assert.deepEqual(namesOf(target, "reviewer"), ["ci-agent", "far-c", "reviewer-b", "small-d"]);
  for (const box of byClass(target, "input", "participant")) box.checked = false; // a browser unchecks the other radios of the group
  choose(target, "participant", "reviewer-b");
  assert.deepEqual(namesOf(target, "reviewer"), ["ci-agent", "drafter-a", "far-c", "small-d", "twin-a"], "the offer follows the drafter");
  assert.equal(requests.length, 0, "nothing sent");
});

// TST-442006 · level: unit · module: MOD-review-pages
// guards: NO REVIEWER IS THE DRAFTER; UC-022
// given: a register whose only participants that can draft text are drafter-a and twin-a, which use the same model
// input: drafter-a chosen; then Show the run panel
// expect: no reviewer offered and a paragraph naming the reason — no other participant uses another model; the panel states the reason as a finding of NO REVIEWER IS THE DRAFTER and offers no Run; nothing sent
test("decision/draft — when no reviewer differs from the drafter, Run is not offered and the reason is named", async () => {
  endpointsAnswer();
  const target = await show(fakeProduct(), { register: registerOf(DRAFTER, TWIN, READER_ROW) });
  choose(target, "participant", "drafter-a");
  assert.deepEqual(namesOf(target, "reviewer"), []);
  assert.match(byClass(target, "p", "no-reviewer")[0].textContent, /another model/);
  click(byClass(target, "button", "prepare")[0]);
  await until(() => byClass(target, "section", "run-panel").length === 1, "the run panel");
  const panel = byClass(target, "section", "run-panel")[0];
  assert.equal(runButtons(panel).length, 0, "no Run");
  assert.match(byClass(panel, "li", "blocking")[0].textContent, /NO REVIEWER IS THE DRAFTER/);
  assert.match(byClass(panel, "li", "blocking")[0].textContent, /another model/);
  assert.equal(requests.length, 0, "nothing sent");
});

// TST-442007 · level: unit · module: MOD-review-pages
// guards: RESTRICTED CONTENT GOES ONLY WHERE ITS SOURCE PERMITS; UC-022
// given: the product links the restricted source SRC-secret, whose register entry permits the place "this machine"; the participants far-c (a server in Singapore) and ci-agent (GitHub Actions in the USA) process data elsewhere
// input: the page; drafter-a chosen; and, as a known positive, the same page of a product that links no restricted source
// expect: far-c and ci-agent are offered neither as drafter nor as reviewer; the others are; on the product without the link, both are offered
test("decision/draft — a participant whose place a linked source forbids is left out as drafter and as reviewer", async () => {
  endpointsAnswer();
  const unlinked = await show(fakeProduct());
  assert.ok(namesOf(unlinked, "participant").includes("far-c") && namesOf(unlinked, "participant").includes("ci-agent"), "known positive: offered without the link");
  const target = await show(fakeProduct({ ...READY, "docs/sources.md": SECRET_LINK }), { entries: { "docs/sources/SRC-secret.md": SECRET_ENTRY } });
  assert.deepEqual(namesOf(target, "participant"), ["drafter-a", "reviewer-b", "small-d", "twin-a"]);
  choose(target, "participant", "drafter-a");
  assert.deepEqual(namesOf(target, "reviewer"), ["reviewer-b", "small-d"]);
});

// TST-1142005 · level: unit · module: MOD-review-pages
// guards: RESTRICTED CONTENT GOES ONLY WHERE ITS SOURCE PERMITS; UC-022
// given: the instance's register holds the restricted source SRC-secret (permitting "this machine" only), which the product does not link; the participants far-c and ci-agent process data elsewhere
// input: the page of a product that links no source
// expect: far-c and ci-agent are offered (the offer is judged against the places of the sources the product links, which the job's parts can carry; the context's places take every restricted source, MOD-source-register's restrictedPlaces)
test("decision/draft — an unlinked restricted source of the register leaves no participant out of the offer", async () => {
  endpointsAnswer();
  const target = await show(fakeProduct(), { entries: { "docs/sources/SRC-secret.md": SECRET_ENTRY } });
  assert.ok(namesOf(target, "participant").includes("far-c") && namesOf(target, "participant").includes("ci-agent"), namesOf(target, "participant").join(", "));
});

// ---------------------------------------------------------------- the run panel

// TST-442008 · level: unit · module: MOD-review-pages
// guards: THE PAGE NAMES WHERE IT SENDS; NOTHING IS LEFT OUT OF AN ARCHITECTURE PROMPT SILENTLY; ONE CLICK PER DECISION; UC-022
// given: the ready product; drafter-a and reviewer-b chosen
// input: Show the run panel
// expect: two destinations — drafter-a as drafter and reviewer-b as reviewer, each with its place — each receiving seven parts: SPEC.md, both use cases and chapters 9 to 12 of the book; in it the only Run; nothing written, nothing sent
test("decision/draft — the run panel names every destination and every part, and Run is the panel's own", async () => {
  endpointsAnswer();
  const fake = fakeProduct();
  const target = await show(fake);
  const panel = await panelFor(target, "drafter-a", "reviewer-b");
  const destinations = byClass(panel, "section", "destination");
  assert.equal(destinations.length, 2);
  assert.match(destinations[0].textContent, /drafter-a — drafter/);
  assert.match(destinations[1].textContent, /reviewer-b — reviewer/);
  for (const destination of destinations) {
    assert.match(destination.textContent, /this machine/);
    const sent = byClass(destination, "li", "part").map((item) => item.textContent.split(" — ")[0]);
    assert.deepEqual(sent, ["SPEC.md", UC1_PATH, UC2_PATH, ...["09_system-modeling.md", "10_architectural-design.md", "11_agentic-design-and-control-patterns.md", "12_implementation-and-version-control.md"]]);
  }
  assert.equal(runButtons(target).length, 1, "one Run");
  assert.equal(runButtons(panel).length, 1, "and it is the panel's");
  assert.equal(fake.writes().length, 0, "nothing written");
  assert.equal(requests.length, 0, "nothing sent");
});

// TST-442009 · level: unit · module: MOD-review-pages
// guards: NOTHING IS LEFT OUT OF AN ARCHITECTURE PROMPT SILENTLY; UC-022
// given: the ready product; small-d, whose context holds 50000 tokens, chosen as drafter, with reviewer-b
// input: Show the run panel
// expect: the panel names small-d as unable to hold what it would receive, with the size and its context; it offers no Run; nothing written, nothing sent
test("decision/draft — a participant whose context is too small is named, and Run is not offered", async () => {
  endpointsAnswer();
  const fake = fakeProduct();
  const target = await show(fake);
  const panel = await panelFor(target, "small-d", "reviewer-b");
  const notFitting = byClass(panel, "p", "not-fitting");
  assert.equal(notFitting.length, 1);
  assert.match(notFitting[0].textContent, /small-d/);
  assert.match(notFitting[0].textContent, /50000/);
  assert.equal(runButtons(target).length, 0, "no Run");
  assert.equal(fake.writes().length, 0, "nothing written");
  assert.equal(requests.length, 0, "nothing sent");
});

// ---------------------------------------------------------------- Run

// TST-442010 · level: unit · module: MOD-review-pages
// guards: ONE CLICK PER DECISION; THE PAGE NAMES WHERE IT SENDS; A JOB IS RECORDED IN ITS PRODUCT REPOSITORY; UC-022
// given: the panel of drafter-a with reviewer-b, whose endpoints answer an empty architecture and no findings
// input: a click on Run
// expect: the job runs in this tab: one request to each endpoint, the record of one job of the kind derive-architecture in docs/jobs/ — its start with taking in one commit, its end in another —, naming every requirement and use case it works on; the page says the job ran
test("decision/draft — Run starts one job in this tab, attended", async () => {
  endpointsAnswer();
  const fake = fakeProduct();
  const target = await show(fake);
  await panelFor(target, "drafter-a", "reviewer-b");
  click(runButtons(target)[0]);
  await until(() => byClass(target, "p", "ran").length === 1, "the job's end");
  assert.equal(requests.length, 2, "one exchange with each endpoint");
  assert.ok(requests[0].includes("ep1") && requests[1].includes("ep2"), requests.join(", "));
  const records = fake.writes().filter((change) => change.files.some((file) => file.path.startsWith("docs/jobs/")));
  assert.equal(records.length, 2, "the record: start with taking, then the end");
  const start = records[0].files[0].text;
  assert.match(start, /^kind: derive-architecture$/m);
  for (const name of [RULE, OTHER, "UC-001", "UC-002"]) assert.ok(start.includes(`  - ${name}\n`), `${name} is worked on`);
  assert.match(byClass(target, "p", "ran")[0].textContent, /JOB-\d{8}-\d{4}-[0-9a-f]{4}/);
});

// TST-442011 · level: unit · module: MOD-review-pages
// guards: A JOB IS RECORDED IN ITS PRODUCT REPOSITORY; ONE CLICK PER DECISION; UC-022
// given: a product that holds the job workflow; the CI agent chosen as drafter, with reviewer-b
// input: the run panel, Run
// expect: nothing sent to any endpoint; one commit holding the job's start record in docs/jobs/ and nothing else; the page says the job is queued, naming its identifier; the record names the route ci hosted
test("decision/draft — a job on the CI route is queued there and not run in the tab", async () => {
  endpointsAnswer();
  const fake = fakeProduct({ ...READY, [WORKFLOW]: "name: Agent M jobs\n" });
  const target = await show(fake);
  await panelFor(target, "ci-agent", "reviewer-b");
  click(runButtons(target)[0]);
  await until(() => byClass(target, "p", "queued").length === 1, "the queueing");
  assert.equal(requests.length, 0, "nothing sent from the tab");
  assert.equal(fake.writes().length, 1, "one commit");
  assert.deepEqual(fake.writes()[0].files.map((file) => file.path.replace(/JOB-[^.]+/, "JOB")), ["docs/jobs/JOB.md"]);
  assert.match(byClass(target, "p", "queued")[0].textContent, /JOB-\d{8}-\d{4}-[0-9a-f]{4}/);
  assert.match(fake.writes()[0].files[0].text, /^route: ci hosted$/m);
});

// ---------------------------------------------------------------- after Run

// TST-443001 · level: unit · module: MOD-review-pages
// guards: UC-022; THE ROUNDS ARE COUNTED AND SHOWN; A REUSE DECISION RECORDS ITS DUE DILIGENCE; A REVIEW FINDING IS WEIGHED BEFORE IT IS ACTED ON
// given: a run returns a decision and a module; the reviewer leaves one warning that the drafter answers; the product has MIT as LICENSE; the registry knows gpl-lib and not missing-lib
// input: Run on decision/draft
// expect: the page shows the drafted files in order, the answered finding in the rounds, the due-diligence table with gpl-lib marked not known to be compatible and missing-lib as not found, and the reuse candidates as choices
// TST-584004 · level: unit · module: MOD-review-pages
// guards: UC-022; THE ROUNDS ARE COUNTED AND SHOWN; A REUSE DECISION RECORDS ITS DUE DILIGENCE; A REVIEW FINDING IS WEIGHED BEFORE IT IS ACTED ON
// given: a run returns a decision and a module; the reviewer leaves one warning that the drafter answers; the product has MIT as LICENSE; the registry knows gpl-lib and not missing-lib
// input: Run on decision/draft
// expect: the page shows the drafted files in order, the answered finding in the rounds, the due-diligence table with gpl-lib marked not known to be compatible and missing-lib as not found, and the reuse candidates as choices
test("decision/draft - after Run shows the architecture draft, rounds, due diligence and candidate choices", async () => {
  endpointsAndRegistries({
    reviewerFindings: [[REVIEW_FINDING], []],
    registry: { [NPM_GPL]: packageData("GPL-3.0") },
  });
  const target = await show(fakeProduct({ ...READY, LICENSE: "MIT License\n" }));
  await panelFor(target, "drafter-a", "reviewer-b");
  click(runButtons(target)[0]);
  await until(() => byClass(target, "section", "architecture-result").length === 1, "the architecture result");

  const result = byClass(target, "section", "architecture-result")[0];
  assert.deepEqual(byClass(result, "section", "draft-file").map((file) => file.getAttribute("data-path")), [ARC_DRAFT_PATH, MOD_DRAFT_PATH]);
  assert.match(byClass(result, "section", "rounds")[0].textContent, /answered: the boundary is in the context/);
  const diligence = byClass(result, "section", "due-diligence")[0].textContent;
  assert.match(diligence, /gpl-lib/);
  assert.match(diligence, /not known to be compatible/);
  assert.match(diligence, /missing-lib/);
  assert.match(diligence, /not found/);
  assert.ok(byClass(result, "input", "reuse-candidate").some((box) => /gpl-lib/.test(box.value)));
});

// TST-443002 · level: unit · module: MOD-review-pages
// guards: UC-022; A PRODUCT DECLARES ITS LICENCE; A REUSED LICENCE IS SHOWN AGAINST THE PRODUCT'S
// given: a run returns a decision whose chosen package has MIT, but the product has no LICENSE
// input: Run on decision/draft
// expect: the due-diligence section says why compatibility was not checked and every shown candidate row says not checked
// TST-584005 · level: unit · module: MOD-review-pages
// guards: UC-022; A PRODUCT DECLARES ITS LICENCE; A REUSED LICENCE IS SHOWN AGAINST THE PRODUCT'S
// given: a run returns a decision whose chosen package has MIT, but the product has no LICENSE
// input: Run on decision/draft
// expect: the due-diligence section says why compatibility was not checked and every shown candidate row says not checked
test("decision/draft - after Run, without LICENSE, due diligence is shown as not checked", async () => {
  endpointsAndRegistries({
    drafts: [architectureDraft({ candidate: "mit-lib", alternative: "missing-lib" })],
    registry: { [NPM_MIT]: packageData("MIT") },
  });
  const target = await show(fakeProduct());
  await panelFor(target, "drafter-a", "reviewer-b");
  click(runButtons(target)[0]);
  await until(() => byClass(target, "section", "architecture-result").length === 1, "the architecture result");

  const diligence = byClass(target, "section", "due-diligence")[0].textContent;
  assert.match(diligence, /No product LICENSE was found/);
  assert.match(diligence, /mit-lib \(npm\) - chosen\s+MIT\s+not checked/);
});

// TST-443003 · level: unit · module: MOD-review-pages
// guards: A REVIEWED ARTIFACT ENTERS THE DEFAULT BRANCH AS OPEN; A GENERATED ARTIFACT IS A PROPOSAL; ONE CLICK PER DECISION
// given: the architecture draft waits for the author after Run
// input: the author changes the decision text and clicks Write proposals
// expect: one non-job commit writes the changed drafted architecture file as an open proposal
// TST-584006 · level: unit · module: MOD-review-pages
// guards: A REVIEWED ARTIFACT ENTERS THE DEFAULT BRANCH AS OPEN; A GENERATED ARTIFACT IS A PROPOSAL; ONE CLICK PER DECISION
// given: the architecture draft waits for the author after Run
// input: the author changes the decision text and clicks Write proposals
// expect: one non-job commit writes the changed drafted architecture file as an open proposal
test("decision/draft - Write proposals writes the draft as the author left it", async () => {
  endpointsAndRegistries({ registry: { [NPM_GPL]: packageData("GPL-3.0") } });
  const fake = fakeProduct({ ...READY, LICENSE: "MIT License\n" });
  const target = await show(fake);
  await panelFor(target, "drafter-a", "reviewer-b");
  click(runButtons(target)[0]);
  await until(() => byClass(target, "section", "architecture-result").length === 1, "the architecture result");

  const decision = byClass(target, "textarea", "draft-text").find((box) => box.getAttribute("data-path") === ARC_DRAFT_PATH);
  decision.value = decision.value.replace("The chosen package is reused.", "The author kept the package.");
  click(byClass(target, "button", "write-proposals")[0]);
  await until(() => byClass(target, "p", "written").length === 1, "the write result");

  const proposalWrites = fake.writes().filter((change) => change.files.some((file) => !file.path.startsWith("docs/jobs/")));
  assert.equal(proposalWrites.length, 1);
  assert.ok(proposalWrites[0].files.some((file) => file.path.startsWith("docs/architecture/ARC-") && file.text.includes("The author kept the package.")));
});

// TST-443004 · level: unit · module: MOD-review-pages
// guards: A REUSE DECISION RECORDS ITS DUE DILIGENCE; ONE CLICK PER DECISION
// given: the due-diligence step marks a blocked npm registry and the product has a CI route available
// input: Run, then Write proposals
// expect: nothing is written, the registry npm is named, and the page offers a route that can fetch the facts elsewhere
// TST-584007 · level: unit · module: MOD-review-pages
// guards: A REUSE DECISION RECORDS ITS DUE DILIGENCE; ONE CLICK PER DECISION
// given: the due-diligence step marks a blocked npm registry and the product has a CI route available
// input: Run, then Write proposals
// expect: nothing is written, the registry npm is named, and the page offers a route that can fetch the facts elsewhere
test("decision/draft - a blocked registry keeps Write proposals from writing and names another route", async () => {
  endpointsAndRegistries({
    drafts: [architectureDraft({ candidate: "blocked-lib", alternative: "missing-lib" })],
    registry: { [NPM_BLOCKED]: new TypeError("Failed to fetch") },
  });
  const fake = fakeProduct({ ...READY, LICENSE: "MIT License\n", [WORKFLOW]: "name: Agent M jobs\n" });
  const target = await show(fake);
  await panelFor(target, "drafter-a", "reviewer-b");
  click(runButtons(target)[0]);
  await until(() => byClass(target, "section", "architecture-result").length === 1, "the architecture result");
  assert.match(byClass(target, "ul", "step-findings")[0].textContent, /registry npm/);

  click(byClass(target, "button", "write-proposals")[0]);
  await until(() => byClass(target, "p", "due-diligence-missing").length === 1, "the refusal");
  const message = byClass(target, "p", "due-diligence-missing")[0].textContent;
  assert.match(message, /npm/);
  assert.match(message, /ci hosted/);
  const proposalWrites = fake.writes().filter((change) => change.files.some((file) => !file.path.startsWith("docs/jobs/")));
  assert.equal(proposalWrites.length, 0);
});

// TST-443005 · level: unit · module: MOD-review-pages
// guards: AN ARCHITECTURE DRAFT IS CHECKED BEFORE A PERSON SEES IT; UC-022
// given: the architecture draft waits after Run and the checker's later drafter answer returns a checked draft
// input: the author edits the decision text and clicks Check this edit
// expect: the page runs the architecture check again from the edited draft and replaces the shown draft with the checked result
// TST-584008 · level: unit · module: MOD-review-pages
// guards: AN ARCHITECTURE DRAFT IS CHECKED BEFORE A PERSON SEES IT; UC-022
// given: the architecture draft waits after Run and the checker's later drafter answer returns a checked draft
// input: the author edits the decision text and clicks Check this edit
// expect: the page runs the architecture check again from the edited draft and replaces the shown draft with the checked result
test("decision/draft - Check this edit runs the whole draft again", async () => {
  const checked = architectureDraft({ candidate: "mit-lib", alternative: "missing-lib" });
  checked.files[0].text = checked.files[0].text.replace("The chosen package is reused.", "The checked draft came back.");
  const calls = endpointsAndRegistries({
    drafts: [architectureDraft({ candidate: "mit-lib", alternative: "missing-lib" }), checked],
    registry: { [NPM_MIT]: packageData("MIT") },
  });
  const target = await show(fakeProduct({ ...READY, LICENSE: "MIT License\n" }));
  await panelFor(target, "drafter-a", "reviewer-b");
  click(runButtons(target)[0]);
  await until(() => byClass(target, "section", "architecture-result").length === 1, "the architecture result");

  const decision = byClass(target, "textarea", "draft-text").find((box) => box.getAttribute("data-path") === ARC_DRAFT_PATH);
  decision.value = decision.value.replace("The chosen package is reused.", "The author changed the draft.");
  click(byClass(target, "button", "check-edit")[0]);
  await until(() => byClass(target, "p", "checked-edit").length === 1, "the checked edit");
  assert.ok(calls.ep1 >= 2, "the correction loop can redraft from the edited draft when checks find work");
  assert.ok(calls.ep2 >= 2, "the reviewer checks the edited draft");
  assert.match(decision.value, /The checked draft came back/);
});

// TST-1392001 · level: unit · module: MOD-review-pages
// guards: UC-022; WHAT A PERSON DECIDES IS NOT SENT BACK
// given: the ready product; the reviewer finds once that the requirement A BOOK IS SHELVED cannot be kept by the architecture, under A CONFLICT IS DECIDED BY A PERSON, which derive-architecture leaves to the person; a second run whose reviewer finds nothing
// input: Run on decision/draft, drafter-a with reviewer-b; the shown architecture draft is read
// expect: known positive — the graph check's finding on MOD-lending is sent back and stands in the drafter's second request; the conflict stands in no request to the drafter; the shown draft lists it in <ul class="for-person"> in the compiler form, with its file, line, rule and text, and the rounds do not hold it; counter-proof — the run without it shows no such list
test("decision/draft - a finding only the author decides is shown with the draft, apart from the rounds", async () => {
  const conflict = { artifact: ARC_DRAFT_PATH, line: 9, kind: "warning", rule: "A CONFLICT IS DECIDED BY A PERSON",
    what: `the requirement ${OTHER} cannot be kept by this architecture`, fix: "the author decides whether to keep the requirement" };
  const calls = endpointsAndRegistries({ reviewerFindings: [[conflict]], registry: { [NPM_GPL]: packageData("GPL-3.0") } });
  const target = await show(fakeProduct({ ...READY, LICENSE: "MIT License\n" }));
  await panelFor(target, "drafter-a", "reviewer-b");
  click(runButtons(target)[0]);
  await until(() => byClass(target, "section", "architecture-result").length === 1, "the architecture result");
  assert.ok(calls.ep1 >= 2 && /designed by no decision/.test(drafterBodies[1]), "known positive: a finding sent back stands in the drafter's next request");
  assert.ok(drafterBodies.every((body) => !body.includes(conflict.what)), "the conflict is not sent back");
  const result = byClass(target, "section", "architecture-result")[0];
  const line = `${ARC_DRAFT_PATH}:9: warning: the requirement ${OTHER} cannot be kept by this architecture [A CONFLICT IS DECIDED BY A PERSON] — the author decides whether to keep the requirement`;
  assert.deepEqual(byClass(result, "ul", "for-person").flatMap((list) => find(list, (node) => node.localName === "li").map((item) => item.textContent)), [line], "the author is shown it");
  assert.ok(byClass(result, "section", "rounds").every((rounds) => !rounds.textContent.includes(conflict.what)), "apart from the rounds");

  endpointsAndRegistries({ reviewerFindings: [[]], registry: { [NPM_GPL]: packageData("GPL-3.0") } });
  const plain = await show(fakeProduct({ ...READY, LICENSE: "MIT License\n" }));
  await panelFor(plain, "drafter-a", "reviewer-b");
  click(runButtons(plain)[0]);
  await until(() => byClass(plain, "section", "architecture-result").length === 1, "the architecture result");
  assert.equal(byClass(plain, "ul", "for-person").length, 0, "counter-proof: nothing for the person, no list");
});

// ---------------------------------------------------------------- the reuse candidate the author chooses (ITM-1393)

// UC-022 step 8: the author may "pick a different alternative for a reuse decision"; 7a: a candidate not found in its registry "is not proposed". The readings (the pull request names them):
// picking a candidate makes it the chosen one in the decision's text — its name, ecosystem and repository take the place of the drafted chosen one's in `## Decision`, and the drafted one's
// take the picked one's place in `## Alternatives` —, so that Write proposals writes the draft as the person left it and the step due-diligence, run again then (MOD-job-runner's writeResult),
// marks it chosen; the listing of a candidate not found is its row of the due-diligence table, which names the address queried.

// TST-1393001 · level: unit · module: MOD-review-pages
// guards: UC-022; A REUSE DECISION RECORDS ITS DUE DILIGENCE
// given: the draft shown after Run, whose decision ARC-900 chooses mit-lib against gpl-lib, both known to the registry; the product's LICENSE is MIT
// input: the author picks gpl-lib among the reuse candidates of ARC-900, and presses Write proposals
// expect: known positive — the choices are mit-lib (npm) - chosen and gpl-lib (npm), and the drafted decision names mit-lib as chosen; the decision written names gpl-lib as the chosen candidate under Decision and mit-lib under Alternatives, and its due-diligence row of gpl-lib is marked chosen
test("decision/draft - the reuse candidate the author picks is the one Write proposals writes as chosen", async () => {
  endpointsAndRegistries({ drafts: [architectureDraft({ candidate: "mit-lib", alternative: "gpl-lib" })], registry: { [NPM_MIT]: packageData("MIT"), [NPM_GPL]: packageData("GPL-3.0") } });
  const fake = fakeProduct({ ...READY, LICENSE: "MIT License\n" });
  const target = await show(fake);
  await panelFor(target, "drafter-a", "reviewer-b");
  click(runButtons(target)[0]);
  await settled(target, () => byClass(target, "section", "architecture-result").length === 1, "the architecture result");
  const choices = byClass(target, "input", "reuse-candidate");
  assert.deepEqual(choices.map((box) => box.value), ["mit-lib (npm) - chosen", "gpl-lib (npm)"], "known positive: both are choices");
  const decision = byClass(target, "textarea", "draft-text").find((box) => box.getAttribute("data-path") === ARC_DRAFT_PATH);
  assert.match(decision.value, /^\| mit-lib \| npm \|[^\n]*\| chosen \|$/m, "known positive: the draft chooses mit-lib");

  const other = choices.find((box) => box.value === "gpl-lib (npm)");
  other.checked = true;
  other.dispatchEvent(new Event("change"));
  click(byClass(target, "button", "write-proposals")[0]);
  await settled(target, () => byClass(target, "p", "written").length === 1, "the write result");

  const written = fake.writes().flatMap((change) => change.files).find((file) => file.path.startsWith("docs/architecture/ARC-"))?.text ?? "";
  const section = (heading) => new RegExp(`^## ${heading}\\n([^]*?)(?=^## )`, "m").exec(written)?.[1] ?? "";
  assert.match(section("Decision"), /^\| gpl-lib \| npm \|[^\n]*\| chosen \|$/m, "gpl-lib is the chosen candidate");
  assert.doesNotMatch(section("Decision"), /mit-lib/, "mit-lib is not chosen");
  assert.match(section("Alternatives"), /^\| mit-lib \| npm \|/m, "mit-lib is an alternative");
  assert.match(section("Due diligence"), /^\| gpl-lib \(npm\) - chosen \|/m, "the due diligence marks gpl-lib chosen");
});

// TST-1393002 · level: unit · module: MOD-review-pages
// guards: UC-022; DUE DILIGENCE IS FETCHED, NOT RECALLED
// given: the draft shown after Run, whose decision ARC-900 chooses missing-lib, which the registry does not know, against mit-lib, which it knows
// input: the reuse candidates the page offers for ARC-900 are read
// expect: known positive — the due-diligence table lists missing-lib as not found - the name may be invented, with the address queried, https://registry.npmjs.org/missing-lib; mit-lib (npm) is offered as a choice; missing-lib is not proposed: no choice names it
test("decision/draft - a reuse candidate its registry does not know is not offered as a choice", async () => {
  endpointsAndRegistries({ drafts: [architectureDraft({ candidate: "missing-lib", alternative: "mit-lib" })], registry: { [NPM_MIT]: packageData("MIT") } });
  const target = await show(fakeProduct({ ...READY, LICENSE: "MIT License\n" }));
  await panelFor(target, "drafter-a", "reviewer-b");
  click(runButtons(target)[0]);
  await settled(target, () => byClass(target, "section", "architecture-result").length === 1, "the architecture result");
  const missing = find(byClass(target, "section", "due-diligence")[0], (node) => node.localName === "tr").map((each) => each.textContent).find((each) => each.includes("missing-lib")) ?? "";
  assert.match(missing, /not found - the name may be invented/, "known positive: the table lists it as not found");
  assert.ok(missing.includes(NPM_MISSING), "known positive: with the address queried");
  const choices = byClass(target, "input", "reuse-candidate").map((box) => box.value);
  assert.ok(choices.includes("mit-lib (npm)"), `known positive: the candidate that exists is offered: ${choices.join(", ")}`);
  assert.ok(!choices.some((value) => value.startsWith("missing-lib")), `missing-lib is not proposed: ${choices.join(", ")}`);
});

// ---------------------------------------------------------------- the draft explains its step (ITM-1394)

// EVERY STEP EXPLAINS ITSELF; UC-022 step 8, the draft shown after Run, which asks the author to review it, change it, choose a library and press Write proposals; and 7c, where the
// author decides on a licence "with a folded explanation of what a licence permits". The readings (the pull request names them): the step's own explanation is the topic the kind
// names as `loop`, as the use cases' draft does, and for the architecture that is `architecture-reviewer` — what the rounds, the findings left and a finding only the author decides
// are; the due-diligence table carries `due-diligence`; while a row's compatibility with the product's licence reads other than `yes` — not known to be compatible, or not checked —,
// the table carries `licence-permits` once, below it, and the rows stay as MOD-reuse-facts writes them.
const EXPLAINED = (node) => node.localName === "details" && find(node, (each) => each.localName === "summary")[0]?.textContent === "What is this?";
const foldedText = (root) => find(root, EXPLAINED).map((each) => each.textContent.replace(/\s+/g, " "));
const DUE_DILIGENCE_TEXT = /^What is this\? ?Before you accept a library, Agent M does a due diligence/;
const LICENCE_TEXT = /^What is this\? ?A licence is the permission under which you may use someone else's software/;
const NPM_MIT_TWO = "https://registry.npmjs.org/mit-two";
async function draftShown({ product = { ...READY, LICENSE: "MIT License\n" }, draft = architectureDraft(), registry = { [NPM_GPL]: packageData("GPL-3.0") }, reviewerFindings = [[]] } = {}) {
  endpointsAndRegistries({ drafts: [draft], reviewerFindings, registry });
  const target = await show(fakeProduct(product));
  await panelFor(target, "drafter-a", "reviewer-b");
  click(runButtons(target)[0]);
  await settled(target, () => byClass(target, "section", "architecture-result").length === 1, "the architecture result");
  return target;
}

// TST-1394001 · level: unit · module: MOD-review-pages
// guards: EVERY STEP EXPLAINS ITSELF; UC-022
// given: the ready product, whose LICENSE is MIT; a run whose reviewer leaves one warning that the drafter answers, so that the draft shown after Run holds its rounds
// input: Run on decision/draft, drafter-a with reviewer-b; the folded explanations of <section class="architecture-result"> are read
// expect: known positive — the drafting page's folded explanations stand outside the result, the first of them what an architecture is; the result's first folded explanation, a details with the summary What is this?, is the topic architecture-reviewer — "Before you see the draft, a second participant, the reviewing participant," — and stands before the rounds
test("decision/draft - the draft shown after Run carries a folded explanation of the step it asks of the author", async () => {
  const target = await draftShown({ reviewerFindings: [[REVIEW_FINDING], []] });
  assert.match(foldedText(target)[0], /^What is this\? ?An architecture is the fundamental organization of a system/, "known positive: the drafting page explains itself");
  const result = byClass(target, "section", "architecture-result")[0];
  const inside = foldedText(result);
  assert.ok(inside.length > 0, "the shown draft carries a folded explanation of its own");
  assert.match(inside[0], /^What is this\? ?Before you see the draft, a second participant, the reviewing participant,/);
  const kids = [...result.childNodes].filter((node) => node.nodeType === 1);
  assert.ok(kids.findIndex(EXPLAINED) >= 0 && kids.findIndex(EXPLAINED) < kids.findIndex((node) => node.className === "rounds"), "the explanation stands before the rounds");
});

// TST-1394002 · level: unit · module: MOD-review-pages
// guards: EVERY STEP EXPLAINS ITSELF; A REUSED LICENCE IS SHOWN AGAINST THE PRODUCT'S; UC-022
// given: (a) an MIT product whose drafted ARC-900 chooses mit-lib (MIT) against gpl-lib (GPL-3.0); (b) the same product with mit-lib against mit-two, both MIT; (c) a product without LICENSE, with mit-lib against mit-two
// input: Run on decision/draft for each; the folded explanations of <section class="due-diligence"> are read, and its rows
// expect: (a) known positive — gpl-lib's row reads not known to be compatible; the section carries the explanation of due diligence ("Before you accept a library, Agent M does a due diligence") and, once, the explanation of what a licence permits ("A licence is the permission …"), naming a permissive and a copyleft licence; (b) counter-proof — every row reads yes: the explanation of due diligence stands, and none of what a licence permits; (c) every row reads not checked: the explanation of what a licence permits stands once
test("decision/draft - the due-diligence table explains itself, and what a licence permits while a candidate's licence is not known to be compatible", async () => {
  const sectionOf = (target) => byClass(target, "section", "due-diligence")[0];
  const compatibility = (target) => find(sectionOf(target), (node) => node.localName === "td" && /^Compatible/.test(node.getAttribute("data-label") ?? "")).map((cell) => cell.textContent.trim());
  const registry = { [NPM_MIT]: packageData("MIT"), [NPM_GPL]: packageData("GPL-3.0"), [NPM_MIT_TWO]: packageData("MIT") };

  const marked = await draftShown({ draft: architectureDraft({ candidate: "mit-lib", alternative: "gpl-lib" }), registry });
  assert.deepEqual(compatibility(marked), ["yes", "not known to be compatible"], "known positive: gpl-lib's row says so");
  const folded = foldedText(sectionOf(marked));
  assert.equal(folded.filter((each) => DUE_DILIGENCE_TEXT.test(each)).length, 1, `the table carries the explanation of due diligence: ${folded.length} found`);
  const licence = folded.filter((each) => LICENCE_TEXT.test(each));
  assert.equal(licence.length, 1, "the explanation of what a licence permits, once");
  assert.match(licence[0], /permissive/);
  assert.match(licence[0], /copyleft/);

  const fine = await draftShown({ draft: architectureDraft({ candidate: "mit-lib", alternative: "mit-two" }), registry });
  assert.deepEqual(compatibility(fine), ["yes", "yes"]);
  assert.equal(foldedText(sectionOf(fine)).filter((each) => DUE_DILIGENCE_TEXT.test(each)).length, 1, "the explanation of due diligence stands");
  assert.equal(foldedText(sectionOf(fine)).filter((each) => LICENCE_TEXT.test(each)).length, 0, "counter-proof: no candidate to decide on, no explanation of a licence");

  const unchecked = await draftShown({ product: READY, draft: architectureDraft({ candidate: "mit-lib", alternative: "mit-two" }), registry });
  assert.deepEqual(compatibility(unchecked), ["not checked", "not checked"]);
  assert.equal(foldedText(sectionOf(unchecked)).filter((each) => LICENCE_TEXT.test(each)).length, 1, "a licence not checked is decided with the explanation");
});

// ---------------------------------------------------------------- leaving the draft (ITM-671)

// UC-018 7a: "The author leaves the editor with unsaved changes. The dashboard asks before discarding", and MOD-review-pages' edit routes' `leave` (ITM-603). The drafted files of `<k>/draft` are
// edited in textareas; the route's `leave` asks "Discard unsaved changes?" when one of them differs from the text drafted or last written, and a refusal keeps the page. The readings (the pull
// request names them): the text the page drafted, or last wrote or checked, is the text "unsaved" is measured against; a page that has shown no draft lets itself be left.
const QUESTION = "Discard unsaved changes?";
async function withConfirm(answers, body) {
  const prior = Object.getOwnPropertyDescriptor(globalThis, "confirm");
  const asked = [];
  Object.defineProperty(globalThis, "confirm", { configurable: true, value: (message) => { asked.push(message); return answers.shift(); } });
  try { await body(asked); } finally { if (prior) Object.defineProperty(globalThis, "confirm", prior); else delete globalThis.confirm; }
}
async function afterRun(fake = fakeProduct({ ...READY, LICENSE: "MIT License\n" })) {
  endpointsAndRegistries({ registry: { [NPM_GPL]: packageData("GPL-3.0") } });
  const target = await show(fake);
  await panelFor(target, "drafter-a", "reviewer-b");
  click(runButtons(target)[0]);
  await until(() => byClass(target, "section", "architecture-result").length === 1, "the architecture result");
  return { target, fake, decision: byClass(target, "textarea", "draft-text").find((box) => box.getAttribute("data-path") === ARC_DRAFT_PATH) };
}

// TST-067105 · level: unit · module: MOD-review-pages
// guards: UC-018; UC-022
// given: the architecture draft shown after Run, the decision's text changed, and a confirmation that first declines, then accepts
// input: route.leave() twice; route.unsaved() before and after the change
// expect: leave is a function; unsaved is false before the change and true after; the first leave returns false and asks "Discard unsaved changes?" once, and the text is still there; the second returns true and asks again
test("decision/draft - leave asks when a drafted file was edited, keeps the page when declined and lets go when accepted", async () => {
  await withConfirm([false, true], async (asked) => {
    const { target, decision } = await afterRun();
    assert.equal(typeof route.leave, "function", "the route gives the frame a leave");
    assert.equal(route.unsaved(), false);
    decision.value = decision.value.replace("The chosen package is reused.", "The author changed it.");
    assert.equal(route.unsaved(), true);
    assert.deepEqual(asked, []);
    assert.equal(route.leave(), false);
    assert.deepEqual(asked, [QUESTION]);
    assert.match(decision.value, /The author changed it\./);
    assert.equal(byClass(target, "section", "architecture-result").length, 1, "the page stays");
    assert.equal(route.leave(), true);
    assert.deepEqual(asked, [QUESTION, QUESTION]);
  });
});

// TST-067106 · level: unit · module: MOD-review-pages
// guards: UC-018; UC-022
// given: the architecture draft shown after Run with no edit, and a confirmation that would decline
// input: route.leave()
// expect: counter-proof — an unedited draft lets itself be left: true, nothing asked
test("decision/draft - an unedited draft lets itself be left without asking", async () => {
  await withConfirm([false], async (asked) => {
    await afterRun();
    assert.equal(route.unsaved(), false);
    assert.equal(route.leave(), true);
    assert.deepEqual(asked, []);
  });
});

// TST-067107 · level: unit · module: MOD-review-pages
// guards: UC-018; UC-022; ONE CLICK PER DECISION
// given: the architecture draft shown after Run, its text changed and Write proposals pressed, which writes it; a confirmation that would decline
// input: route.leave()
// expect: counter-proof — what was written is saved: unsaved is false; changed again after the write, it is unsaved once more, and back to the written text it is not; leave then returns true and asks nothing
test("decision/draft - after Write proposals the written text is not unsaved, a later change is", async () => {
  await withConfirm([false], async (asked) => {
    const { target, decision } = await afterRun();
    decision.value = decision.value.replace("The chosen package is reused.", "The author kept the package.");
    assert.equal(route.unsaved(), true, "known positive: the change is unsaved");
    click(byClass(target, "button", "write-proposals")[0]);
    await until(() => byClass(target, "p", "written").length === 1, "the write result");
    assert.equal(route.unsaved(), false);
    const written = decision.value;
    decision.value += "\nA line after the write.\n";
    assert.equal(route.unsaved(), true, "a change after the write is unsaved again");
    decision.value = written;
    assert.equal(route.unsaved(), false);
    assert.equal(route.leave(), true);
    assert.deepEqual(asked, []);
  });
});

// TST-067110 · level: unit · module: MOD-review-pages
// guards: UC-018; UC-022
// given: the architecture draft shown after Run, the decision's text changed, and Check this edit pressed, which draws the checked draft again
// input: route.unsaved() after the check, and route.leave()
// expect: counter-proof — the checked draft is the text shown now, not an edit: unsaved is false, and leave returns true and asks nothing
test("decision/draft - after Check this edit the checked draft is not unsaved", async () => {
  const checked = architectureDraft({ candidate: "mit-lib", alternative: "missing-lib" });
  checked.files[0].text = checked.files[0].text.replace("The chosen package is reused.", "The checked draft came back.");
  endpointsAndRegistries({
    drafts: [architectureDraft({ candidate: "mit-lib", alternative: "missing-lib" }), checked],
    registry: { [NPM_MIT]: packageData("MIT") },
  });
  await withConfirm([false], async (asked) => {
    const target = await show(fakeProduct({ ...READY, LICENSE: "MIT License\n" }));
    await panelFor(target, "drafter-a", "reviewer-b");
    click(runButtons(target)[0]);
    await until(() => byClass(target, "section", "architecture-result").length === 1, "the architecture result");
    const decision = byClass(target, "textarea", "draft-text").find((box) => box.getAttribute("data-path") === ARC_DRAFT_PATH);
    decision.value += "\nAn edit of the author.\n";
    assert.equal(route.unsaved(), true, "known positive: the change is unsaved");
    click(byClass(target, "button", "check-edit")[0]);
    await until(() => byClass(target, "p", "checked-edit").length === 1, "the checked edit");
    assert.equal(route.unsaved(), false);
    assert.equal(route.leave(), true);
    assert.deepEqual(asked, []);
  });
});

// TST-111503 · level: unit · module: MOD-review-pages
// guards: UC-022; UC-023; DEVELOP AGAINST INTERFACES
// given: the architecture draft shown after Run (the drafter asked once), the decision's text changed by one added line that breaks no check and that the reviewer finds nothing in
// input: Check this edit
// expect: the page begins with the edited draft, as a whole (MOD-runtimes' hook `from`): the first request to the drafter after the check carries the edited sentence (without `from` it is the job's ordinary prompt), the reviewer checks the draft, and the job has no record: no commit is made
test("decision/draft - Check this edit begins with the edited draft and writes no record", async () => {
  const calls = endpointsAndRegistries({ drafts: [architectureDraft({ candidate: "mit-lib", alternative: "missing-lib" })], registry: { [NPM_MIT]: packageData("MIT") } });
  const fake = fakeProduct({ ...READY, LICENSE: "MIT License\n" });
  const target = await show(fake);
  await panelFor(target, "drafter-a", "reviewer-b");
  click(runButtons(target)[0]);
  await until(() => byClass(target, "section", "architecture-result").length === 1, "the architecture result");
  const asked = { drafter: calls.ep1, reviewer: calls.ep2 }, writes = fake.writes().length;
  assert.doesNotMatch(drafterBodies.join("\n"), /The author added this sentence\./, "known positive: the sentence is not in what the Run sent");
  const decision = byClass(target, "textarea", "draft-text").find((box) => box.getAttribute("data-path") === ARC_DRAFT_PATH);
  decision.value = decision.value.replace("The chosen package is reused.", "The chosen package is reused. The author added this sentence.");
  click(byClass(target, "button", "check-edit")[0]);
  await until(() => byClass(target, "p", "checked-edit").length === 1, "the checked edit");
  assert.ok(calls.ep1 > asked.drafter, "known positive: the checks sent the draft back to the drafter");
  assert.match(drafterBodies[asked.drafter], /The author added this sentence\./, "the first request after the check carries the edited draft");
  assert.ok(calls.ep2 > asked.reviewer, "the reviewer checks the edited draft");
  assert.equal(fake.writes().length, writes, "no record: nothing was committed");
});
