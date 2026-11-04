// MOD-review-pages' routes for architecture decisions and module files (ITM-440), as the accepted text of
// docs/architecture/MOD-review-pages.md states them: the descriptors `decision` and `module` and their routes `decision`, `module`,
// `decision/<id>` and `module/<id>` — the files with their status; one file rendered with its diagrams, changed since acceptance as its
// difference to its last accepted text, with its section of what it rests on that is not accepted; Accept, naming the blob shown, refused
// for a file that names a requirement or use case not accepted, which is named (UC-022 step 10, 10a; A MODULE FILE IS REVIEWED AS AN
// ARCHITECTURE DECISION IS; ARCHITECTURE RESTS ON ACCEPTED ARTIFACTS). Review all, the sections of rounds and due diligence, drafting and
// the impact list of a change are other items'.
// Run: node --test tests/review-pages-architecture.test.mjs
//
// Module: MOD-review-pages
// Guards: UC-022; A MODULE FILE IS REVIEWED AS AN ARCHITECTURE DECISION IS; ARCHITECTURE RESTS ON ACCEPTED ARTIFACTS; STATUS IS DERIVED FROM THE RECORDS; A CHANGED FILE IS SHOWN AGAINST ITS LAST ACCEPTED TEXT; ACCEPTANCE IS A COMMIT BY THE ACCEPTING PERSON; AN APPROVAL NAMES THE EXACT TEXT; DIAGRAMS ARE MERMAID IN MARKDOWN; WITHOUT A TOKEN, GITHUB'S WEB INTERFACE IS THE FALLBACK
// Level: unit
//
// The document is the small DOM of tests/site-frame-dom.mjs, imported unchanged; the repository is a Host of the tests' own over one
// repository in memory with a history, keeping to MOD-repository-hosts' interface, every call recorded. The real MOD-approvals,
// MOD-documents and MOD-browser-store run as they are. Nothing reaches the network. Where the module file leaves a reading open, the test
// states the one it takes, and the pull request names it:
//   - The descriptors are keyed by the kind MOD-approvals gives the files: `architecture-decision` and `module`; both are under the menu
//     entry `architecture`; a record is "kind: architecture-decision" or "kind: module".
//   - The section of what a file rests on is a <section class="rests-on"> with one <li class="open-name"> for each requirement or use
//     case the file names that is not accepted (MOD-approvals' acceptanceBlockers); it is there only while some are open, and a file
//     with such a section offers an Accept that is disabled, and no GitHub page (UC-023 4b). A blocker that appears after the page was built is refused by
//     acceptShown and named in the message.
//   - The rows, the tick, the status badges, the difference and the GitHub fallback are those of the use cases' route, which the
//     tests of ITM-355 pin; these tests ask them of the new kinds once.
// Each test states its input and its expected result before it runs (given / input / expect). The counter-proofs are recorded in the pull request.

import "./site-frame-dom.mjs";
import { until } from "./review-pages-wait.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { withStoredGraph } from "./stored-graph-fake.mjs";

// Every commit the fakes of this file make is its own: MOD-trace-graph's storedGraph keeps a commit's graph for the page.
let commitsMade = 0;

// A localStorage of the file's own, for MOD-browser-store.
const kept = new Map();
globalThis.localStorage = { getItem: (k) => (kept.has(k) ? kept.get(k) : null), setItem: (k, v) => { kept.set(k, String(v)); },
  removeItem: (k) => { kept.delete(k); }, key: (i) => [...kept.keys()][i] ?? null, get length() { return kept.size; } };
const { openStore, writeSetting } = await import("../src/browser-store/index.mjs");
const pages = await import("../src/review-pages/index.mjs").catch((error) => ({ error }));
const routeOf = (name) => pages.view?.routes.find((candidate) => candidate.name === name);

// ---------------------------------------------------------------- the product

const text = (...lines) => `${lines.join("\n")}\n`;
const blobOf = (body) => createHash("sha1").update(`blob ${Buffer.byteLength(body)}\0${body}`).digest("hex");
const failure = (name, message, fields = {}) => Object.assign(new Error(message), { name }, fields);
const ON_GITHUB = { server: "github", origin: "https://github.com", path: "alice/thesis-tool", web: "https://github.com/alice/thesis-tool" };
const TOKEN = { value: "github_pat_ALICEthesisTOOL0123456789abcdef", name: "Agent M · thesis-tool", expires: "2027-01-01" };

const RULE = "A LOAN HAS A DUE DATE";
const SPEC = text("# Thesis tool — Specification", "", "## Lending", "", `**${RULE}** *(Product Owner)*`,
  "Every loan states the date by which the book is returned.", "*Check:* `tests/loan.test.mjs`");
const useCase = (id, title) => text("---", `id: ${id}`, `title: ${title}`, "area: lending", "actors:", "  - Member", "realises:", `  - ${RULE}`,
  "---", `# ${id} ${title}`, "", "**Goal.** The member borrows a book.");
const UC1 = useCase("UC-001", "Borrow a book"), UC2 = useCase("UC-002", "Reserve a book");
const DIAGRAM = ["", "```mermaid", "flowchart LR", "    Desk --> Shelf", "```", ""];
const decision = (id, title, forced, sentence = "The desk and the shelf are two modules.") => text("---", `id: ${id}`, `title: ${title}`, "forced_by:",
  ...forced.map((name) => `  - ${name}`), "---", `# ${id} ${title}`, "", "## Context", "", "Books are lent at a desk.", "", "## Decision", "", sentence,
  ...DIAGRAM, "## Alternatives", "", "One module.", "", "## Consequences", "", "Two folders.");
const module_ = (id, title, realises, sentence = "It lends a book.") => text("---", `id: ${id}`, `title: ${title}`, "folder: src/lending/", "realises:",
  ...realises.map((name) => `  - ${name}`), "follows:", "  - ARC-001", "uses:", "provides:", "  - lend", "---", `# ${id} ${title}`, "", "## Responsibility", "",
  sentence, ...DIAGRAM, "## Parts", "", "- `index.mjs`", "", "## Data", "", "Nothing.", "", "## Interfaces", "", "- `lend`", "", "## Files", "", "None.", "",
  "## Uses", "", "Nothing.");
const A = (n, slug) => `docs/architecture/ARC-00${n}-${slug}.md`;
const M = (slug) => `docs/architecture/MOD-${slug}.md`;
const ARC1 = decision("ARC-001", "Lending is a desk", [RULE, "UC-001"]);
const ARC2 = decision("ARC-002", "Books are shelved", [RULE]);
const ARC3_OLD = decision("ARC-003", "Loans are dated", [RULE], "Every loan has a date.");
const ARC3 = decision("ARC-003", "Loans are dated", [RULE], "Every loan has a due date.");
const ARC4 = decision("ARC-004", "Reservations are queued", ["UC-002"]);
const MOD_READER = module_("MOD-reader", "Reading a book", [RULE, "UC-001"]);
const MOD_WRITER = module_("MOD-writer", "Lending a book", [RULE]);
const MOD_LISTER_OLD = module_("MOD-lister", "Listing books", [RULE], "It lists the books.");
const MOD_LISTER = module_("MOD-lister", "Listing books", [RULE], "It lists the books on the shelf.");
const MOD_FINER = module_("MOD-finer", "Fining a member", ["A FINE IS CHARGED PER DAY", "UC-002"]);
const recordOf = (id, kind, path, body) => [`docs/approvals/${id}-${blobOf(body).slice(0, 12)}.md`, text(`kind: ${kind}`, `file: ${path}`, `blob: ${blobOf(body)}`)];
// ARC-001, MOD-reader and UC-001 accepted; ARC-003 and MOD-lister accepted at an earlier text and edited since; ARC-002, ARC-004, MOD-writer and
// MOD-finer open. ARC-004 names UC-002, which is open; MOD-finer names a requirement the SPEC does not hold and UC-002.
const STEPS = [
  { "README.md": "# Thesis tool\n", "SPEC.md": SPEC, "docs/use-cases/UC-001-borrow-a-book.md": UC1, "docs/use-cases/UC-002-reserve-a-book.md": UC2,
    [A(1, "lending")]: ARC1, [A(2, "shelves")]: ARC2, [A(3, "dates")]: ARC3_OLD, [A(4, "queue")]: ARC4,
    [M("reader")]: MOD_READER, [M("writer")]: MOD_WRITER, [M("lister")]: MOD_LISTER_OLD, [M("finer")]: MOD_FINER },
  Object.fromEntries([recordOf("UC-001", "use-case", "docs/use-cases/UC-001-borrow-a-book.md", UC1), recordOf("ARC-001", "architecture-decision", A(1, "lending"), ARC1),
    recordOf("ARC-003", "architecture-decision", A(3, "dates"), ARC3_OLD), recordOf("MOD-reader", "module", M("reader"), MOD_READER),
    recordOf("MOD-lister", "module", M("lister"), MOD_LISTER_OLD)]),
  { [A(3, "dates")]: ARC3, [M("lister")]: MOD_LISTER },
];

// ---------------------------------------------------------------- the fake host

function fakeHost({ steps = STEPS, refuse = null, graphStored = true } = {}) {
  const calls = [], commits = new Map();
  let made = 0, head = null;
  const commitOf = (tree, parent) => {
    const sha = createHash("sha1").update(`commit ${++made} of the file's ${++commitsMade}`).digest("hex");
    commits.set(sha, { tree, parent, date: `2026-10-0${made}T10:00:00Z` });
    return sha;
  };
  for (const files of steps) head = commitOf(new Map([...(head ? commits.get(head).tree : []), ...Object.entries(files)]), head);
  const bareSnapshotAt = (sha) => {
    const { tree } = commits.get(sha);
    return { repository: ON_GITHUB, ref: sha, commit: sha, paths: [...tree.keys()].sort(),
      read: async (path) => (tree.has(path) ? tree.get(path) : null),
      blob: (path) => (tree.has(path) ? blobOf(tree.get(path)) : null) };
  };
  // Each snapshot serves the graph the push job stores for its commit (tests/stored-graph-fake.mjs), unless `graphStored` is false; a page reads it and never
  // builds one (MOD-trace-graph).
  const snapshotAt = (...args) => (graphStored ? withStoredGraph(bareSnapshotAt(...args)) : bareSnapshotAt(...args));
  return {
    head: () => head,
    writes: () => calls.filter((call) => call.fn === "commitFiles"),
    land(changed) { head = commitOf(new Map([...commits.get(head).tree, ...Object.entries(changed)]), head); },
    host: {
      async repositoryInfo() { return { defaultBranch: "main", visibility: "public", canWrite: true, archived: false, description: "" }; },
      async readFileAt(path, shas) {
        return new Map(shas.map((sha) => [sha, commits.get(sha)?.tree.get(path) ?? null]));
      },
      async readSnapshot(ref) {
        if (ref === "main") return { ...snapshotAt(head), ref };
        if (commits.has(ref)) return snapshotAt(ref);
        throw failure("NotFound", `${ref} was not found`, { what: ref });
      },
      async readHistory(path, { ref = "main", limit } = {}) {
        const found = [];
        for (let sha = ref === "main" ? head : ref; sha; sha = commits.get(sha).parent) {
          const here = commits.get(sha), before = here.parent ? commits.get(here.parent).tree.get(path) : undefined;
          if (here.tree.get(path) !== before) found.push({ commit: sha, parents: here.parent ? [here.parent] : [], date: here.date, message: "", author: { account: null, name: "x" }, changes: [] });
        }
        return limit ? found.slice(0, limit) : found;
      },
      async commitFiles(change) {
        calls.push({ fn: "commitFiles", change: structuredClone(change) });
        if (refuse) throw refuse;
        if (change.branch !== "main" || change.expectedHead !== head) throw failure("Moved", "the branch moved", { head });
        head = commitOf(new Map([...commits.get(head).tree, ...change.files.map((f) => [f.path, f.text])]), head);
        return { commit: head, url: `${ON_GITHUB.web}/commit/${head}` };
      },
    },
  };
}

// ---------------------------------------------------------------- the page

async function show(fake, route, params = {}, { token = true } = {}) {
  assert.ok(routeOf(route), `the route ${route}: ${pages.error?.message}`);
  const store = openStore(token ? "alice/agent-m" : "nobody/agent-m");
  if (token) writeSetting(store, "github-token:alice/thesis-tool", TOKEN);
  const target = document.createElement("div");
  document.body.append(target);
  target.went = [];
  await routeOf(route).render(target, { page: "review", instance: { repository: "alice/agent-m", host: fake.host }, store, go(...where) { target.went.push(where); },
    product: { address: ON_GITHUB.web, kind: "github", host: fake.host } }, params);
  return target;
}
function find(root, match) {
  const found = [];
  (function walk(node) { for (const kid of node.childNodes) { if (kid.nodeType === 1) { if (match(kid)) found.push(kid); walk(kid); } } })(root);
  return found;
}
const byClass = (root, name, className) => find(root, (node) => node.localName === name && node.className.split(" ").includes(className));
// A person's click: a browser marks it trusted (`isTrusted`); node marks every Event untrusted, as a script's.
const click = (node) => node.dispatchEvent(Object.defineProperty(new Event("click"), "isTrusted", { value: true }));
const rowOf = (target, id) => find(target, (node) => node.localName === "tr" && node.getAttribute("data-id") === id)[0];
const badgeOf = (root) => byClass(root, "span", "badge")[0]?.textContent;
const rowsOf = (target) => find(target, (node) => node.localName === "tr" && node.getAttribute("data-id")).map((row) => row.getAttribute("data-id"));

// ---------------------------------------------------------------- the routes

// TST-472605 · level: unit · module: MOD-review-pages
// guards: UC-022; A MODULE FILE IS REVIEWED AS AN ARCHITECTURE DECISION IS
// given: the view the module offers
// input: its routes
// expect: the routes use-case, decision, module, spec-entry, release-report, requirement, requirements, draft and arrange, the middle two of the first three under the menu entry architecture, with the titles of their kinds
test("MOD-review-pages view — the routes decision and module join the use cases' route", () => {
  assert.ok(pages.view, `the view: ${pages.error?.message}`);
  assert.deepEqual(pages.view.routes.map((route) => route.name), ["use-case", "decision", "module", "spec-entry", "release-report", "requirement", "requirements", "draft", "arrange"]);
  assert.deepEqual(pages.view.routes.slice(1, 3).map((route) => [route.entry, route.title]), [["architecture", "Architecture decisions"], ["architecture", "Module files"]]);
});

// ---------------------------------------------------------------- the lists

// TST-472606 · level: unit · module: MOD-review-pages
// guards: STATUS IS DERIVED FROM THE RECORDS; A MODULE FILE IS REVIEWED AS AN ARCHITECTURE DECISION IS; EVERY STEP EXPLAINS ITSELF
// given: a product with four decisions — ARC-001 accepted, ARC-003 changed since acceptance, ARC-002 and ARC-004 open — and four module files — MOD-reader accepted, MOD-lister changed, MOD-writer and MOD-finer open —, and a token
// input: the routes decision and module rendered with no id
// expect: for the decisions a row for each in the order of the identifiers, with its link to #decision/id=<id>/product=<the product's address, encoded>, its title and its status — open, accepted, changed since acceptance — and a tick on each file not accepted, before and after the pages of ARC-002 and ARC-004 and of MOD-finer and MOD-lister were shown; for the modules the same under #module/id=<id>/product=<the product's address, encoded>; the folded What is this?; nothing written
test("MOD-review-pages decision and module — the lists: every file with its status and a tick", async () => {
  const fake = fakeHost();
  const decisions = await show(fake, "decision");
  const whole = (page) => find(page, (node) => node.localName === "table" && node.parentNode === page)[0];
  const firstPart = (page) => find(page, (node) => node.localName === "section" && node.className.split(" ").includes("open-changes"))[0];
  assert.deepEqual(rowsOf(whole(decisions)), ["ARC-001", "ARC-002", "ARC-003", "ARC-004"]);
  assert.deepEqual(rowsOf(firstPart(decisions)), ["ARC-002", "ARC-003", "ARC-004"], "the open and changed files first");
  assert.deepEqual(rowsOf(whole(decisions)).map((id) => badgeOf(rowOf(decisions, id))), ["accepted", "open", "changed since acceptance", "open"]);
  assert.match(rowOf(decisions, "ARC-003").textContent, /Loans are dated/);
  assert.equal(find(rowOf(decisions, "ARC-003"), (node) => node.localName === "a")[0].getAttribute("href"), `#decision/id=ARC-003/product=${encodeURIComponent(ON_GITHUB.web)}`);
  assert.deepEqual(rowsOf(whole(decisions)).filter((id) => byClass(rowOf(decisions, id), "input", "tick").length), ["ARC-002", "ARC-003", "ARC-004"], "every decision not accepted has a tick before any is shown");
  for (const id of ["ARC-002", "ARC-004"]) await show(fake, "decision", { id });
  const decisionsRead = await show(fake, "decision");
  assert.deepEqual(rowsOf(whole(decisionsRead)).filter((id) => byClass(rowOf(decisionsRead, id), "input", "tick").length), ["ARC-002", "ARC-003", "ARC-004"], "still a tick on each decision not accepted, shown or not");

  const modules = await show(fake, "module");
  assert.deepEqual(rowsOf(whole(modules)), ["MOD-finer", "MOD-lister", "MOD-reader", "MOD-writer"]);
  assert.deepEqual(rowsOf(firstPart(modules)), ["MOD-finer", "MOD-lister", "MOD-writer"], "the open and changed files first");
  assert.deepEqual(rowsOf(whole(modules)).map((id) => badgeOf(rowOf(modules, id))), ["open", "changed since acceptance", "accepted", "open"]);
  assert.match(rowOf(modules, "MOD-lister").textContent, /Listing books/);
  assert.equal(find(rowOf(modules, "MOD-lister"), (node) => node.localName === "a")[0].getAttribute("href"), `#module/id=MOD-lister/product=${encodeURIComponent(ON_GITHUB.web)}`);
  assert.deepEqual(rowsOf(whole(modules)).filter((id) => byClass(rowOf(modules, id), "input", "tick").length), ["MOD-finer", "MOD-lister", "MOD-writer"], "every module not accepted has a tick before any is shown");
  for (const id of ["MOD-finer", "MOD-lister"]) await show(fake, "module", { id });
  const modulesRead = await show(fake, "module");
  assert.deepEqual(rowsOf(whole(modulesRead)).filter((id) => byClass(rowOf(modulesRead, id), "input", "tick").length), ["MOD-finer", "MOD-lister", "MOD-writer"], "still a tick on each module not accepted, shown or not");
  assert.ok(byClass(decisions, "details", "explain").length >= 1 && byClass(modules, "details", "explain").length >= 1, "a folded What is this?");
  assert.equal(fake.writes().length, 0, "nothing written");
});

// ---------------------------------------------------------------- one file

// TST-472607 · level: unit · module: MOD-review-pages
// guards: DIAGRAMS ARE MERMAID IN MARKDOWN; A MODULE FILE IS REVIEWED AS AN ARCHITECTURE DECISION IS; AN APPROVAL NAMES THE EXACT TEXT
// given: MOD-writer, open, whose text holds a Mermaid diagram, and a token
// input: the route module rendered with the id MOD-writer
// expect: its identifier and title, the status open, its prose, its diagram handed to the renderer, the first twelve digits of the blob of the text shown, one Accept, no difference, and no section of what it rests on (it names only what is accepted); nothing written
test("MOD-review-pages module/<id> — a module file rendered with its diagram and Accept", async () => {
  const fake = fakeHost();
  const target = await show(fake, "module", { id: "MOD-writer" });

  assert.match(find(target, (node) => node.localName === "h2")[0].textContent, /^MOD-writer Lending a book/);
  assert.equal(badgeOf(target), "open");
  assert.match(target.textContent, /It lends a book\./);
  const unrendered = byClass(target, "div", "unrendered");
  assert.equal(unrendered.length, 1, "its diagram is handed to the renderer");
  assert.match(unrendered[0].textContent, /flowchart LR/);
  assert.ok(target.textContent.includes(blobOf(MOD_WRITER).slice(0, 12)), "the blob of the text shown");
  assert.equal(byClass(target, "button", "accept").length, 1);
  assert.equal(byClass(target, "section", "accepted-diff").length, 0);
  assert.equal(byClass(target, "section", "rests-on").length, 0, "it rests on accepted artifacts only");
  assert.equal(fake.writes().length, 0, "nothing written");
});

// TST-472608 · level: unit · module: MOD-review-pages
// guards: A CHANGED FILE IS SHOWN AGAINST ITS LAST ACCEPTED TEXT
// given: ARC-003, changed since its earlier text was accepted, and ARC-001, accepted
// input: the route decision rendered for each
// expect: for ARC-003 a difference headed "Changed since it was last accepted", the earlier sentence removed and the new one added; for ARC-001 no difference and no Accept
test("MOD-review-pages decision/<id> — a changed decision is shown with its difference to the last accepted text", async () => {
  const fake = fakeHost();
  const changed = await show(fake, "decision", { id: "ARC-003" });

  assert.equal(badgeOf(changed), "changed since acceptance");
  const diff = byClass(changed, "section", "accepted-diff")[0];
  assert.ok(diff, "a difference");
  assert.match(diff.textContent, /Changed since it was last accepted/);
  const shown = byClass(diff, "pre", "diff")[0].textContent;
  assert.match(shown, /- Every loan has a date\./);
  assert.match(shown, /\+ Every loan has a due date\./);
  assert.equal(byClass(changed, "button", "accept").length, 1);

  const accepted = await show(fake, "decision", { id: "ARC-001" });
  assert.equal(byClass(accepted, "section", "accepted-diff").length, 0);
  assert.equal(byClass(accepted, "button", "accept").length, 0);
  assert.equal(byClass(accepted, "section", "rests-on").length, 0);
});

// TST-680101 · level: unit · module: MOD-review-pages
// guards: AN ARCHITECTURE CHANGE IS NOT ACCEPTED WITHOUT AN IMPACT LIST; UC-023
// given: ARC-003 and MOD-lister, each accepted at an earlier text and edited since; ARC-001 accepted, MOD-writer never accepted
// input: the routes decision and module rendered for each
// expect: for each changed file a section "Impact of this change" between the difference and Accept, with its folded explanation; for MOD-lister the module itself as affected, changed; for ARC-003 that no module follows it; none for the accepted ARC-001 and none for the open MOD-writer
test("MOD-review-pages decision/<id> and module/<id> — a change to an accepted file shows its impact list beside the difference, before Accept", async () => {
  const fake = fakeHost();
  const decision = await show(fake, "decision", { id: "ARC-003" });
  const [impact] = byClass(decision, "section", "change-impact");
  assert.ok(impact, "the impact list of ARC-003");
  assert.match(impact.textContent, /Impact of this change/);
  assert.match(impact.textContent, /none — no module follows this decision/);
  assert.equal(byClass(impact, "details", "explain").length, 1, "its folded What is this?");
  const order = decision.textContent;
  assert.ok(order.indexOf("Changed since it was last accepted") < order.indexOf("Impact of this change"), "beside the difference, after it");
  assert.equal(byClass(decision, "button", "accept").length, 1, "Accept, once the list is shown");

  const module = await show(fake, "module", { id: "MOD-lister" });
  const [moduleImpact] = byClass(module, "section", "change-impact");
  assert.ok(moduleImpact, "the impact list of MOD-lister");
  assert.match(moduleImpact.textContent, /MOD-lister — changed/);
  assert.equal(byClass(module, "button", "accept").length, 1);

  assert.equal(byClass(await show(fake, "decision", { id: "ARC-001" }), "section", "change-impact").length, 0, "an accepted file has none");
  assert.equal(byClass(await show(fake, "module", { id: "MOD-writer" }), "section", "change-impact").length, 0, "an open file is no change");
  assert.equal(fake.writes().length, 0, "nothing written");
});

// TST-680102 · level: unit · module: MOD-review-pages
// guards: AN ARCHITECTURE CHANGE IS NOT ACCEPTED WITHOUT AN IMPACT LIST
// given: MOD-lister changed since acceptance, and a host whose branch trace-cache holds no graph of the commit shown — the page derives the impact list from the stored graph only (MOD-review-pages: "The graph is the one `onMainChanged` stored for the commit shown (MOD-workflow-entries), read through `storedGraph`; no page builds a graph")
// input: the route module rendered for MOD-lister
// expect: the page says that the impact list could not be derived, naming the graph not stored, and that the change cannot be accepted without it; no Accept; counter-proof: the same page on a host that holds the graph offers Accept
test("MOD-review-pages module/<id> — a change whose impact list cannot be derived is not offered for acceptance", async () => {
  const good = await show(fakeHost(), "module", { id: "MOD-lister" });
  assert.equal(byClass(good, "button", "accept").length, 1, "known positive: Accept with the list");
  const target = await show(fakeHost({ graphStored: false }), "module", { id: "MOD-lister" });
  assert.match(target.textContent, /The impact list could not be derived: the trace graph of [0-9a-f]{12} is not stored yet[^]* — without it, this change cannot be accepted\./);
  assert.equal(byClass(target, "button", "accept").length, 0);
  assert.equal(byClass(target, "section", "change-impact").length, 0);
});

// ---------------------------------------------------------------- accepting

// TST-472609 · level: unit · module: MOD-review-pages
// guards: ACCEPTANCE IS A COMMIT BY THE ACCEPTING PERSON; AN APPROVAL NAMES THE EXACT TEXT; STATUS IS DERIVED FROM THE RECORDS
// given: ARC-002 and MOD-writer, open, each resting on accepted artifacts only, and a token
// input: a click on Accept of each, on a page of its own
// expect: one commit on `main`, on the head that was read, naming the person, holding one record — "kind: architecture-decision" and the decision's path and blob, "kind: module" and the module's — at docs/approvals/<id>-<blob12>.md; the page then shows it accepted with no Accept
test("MOD-review-pages decision/<id> and module/<id> — Accept writes one record naming the blob shown", async () => {
  for (const [route, id, path, body, kind] of [["decision", "ARC-002", A(2, "shelves"), ARC2, "architecture-decision"], ["module", "MOD-writer", M("writer"), MOD_WRITER, "module"]]) {
    const fake = fakeHost();
    const read = fake.head();
    const target = await show(fake, route, { id });
    click(byClass(target, "button", "accept")[0]);
    await until(target, () => fake.writes().length === 1, `the commit of ${id}`);

    const [{ change }] = fake.writes();
    const [recordPath, recordText] = recordOf(id, kind, path, body);
    assert.equal(change.expectedHead, read, `${id}: on the head that was read`);
    assert.deepEqual(change.files, [{ path: recordPath, text: recordText }], `${id}: one record, naming the blob shown`);
    assert.match(change.message, new RegExp(`Accepted by ${TOKEN.name}`));
    await until(target, () => badgeOf(target) === "accepted", `${id} to be shown accepted`);
    assert.equal(byClass(target, "button", "accept").length, 0);
  }
});

// TST-680209 · level: unit · module: MOD-review-pages
// guards: EDITS ARE PREPARED ON THE DASHBOARD; A SAVE IS REFUSED WHEN THE TEXT CHANGED MEANWHILE; UC-022
// given: the descriptor table gives architecture decisions and module files Save "file", as it gives use cases; ARC-002 and MOD-writer, open, each opened in the editor on its edit route
// input: the text edited, then a click on Save; and a click a script makes on Save of the same editor first
// expect: after the script's click nothing is committed; after the person's click one commit on the head that was read holding only that file with the edited text and no record; the file is shown again from its page
test("MOD-review-pages decision/<id>/edit and module/<id>/edit — Save commits the edited file, which is shown again", async () => {
  for (const [route, id, path, body] of [["decision", "ARC-002", A(2, "shelves"), ARC2], ["module", "MOD-writer", M("writer"), MOD_WRITER]]) {
    const fake = fakeHost();
    const read = fake.head();
    const target = await show(fake, route, { id, edit: "1" });
    const area = find(target, (node) => node.localName === "textarea")[0];
    const save = find(target, (node) => node.localName === "button" && node.textContent === "Save")[0];
    assert.ok(area && save, `${id}: the editor with its Save`);
    assert.equal(area.value, body, `${id}: the editor holds the file byte for byte`);
    const edited = body.replace("two modules", "two small modules").replace("It lends a book.", "It lends a book to a member.");
    assert.notEqual(edited, body);
    area.value = edited;
    area.dispatchEvent(new Event("input"));
    save.dispatchEvent(new Event("click")); // a script's click: node's Event is untrusted
    for (let turn = 0; turn < 40; turn++) await new Promise((resolve) => setImmediate(resolve));
    assert.equal(fake.writes().length, 0, `${id}: a script's click commits nothing`);
    click(save);
    await until(target, () => fake.writes().length === 1, `the commit of ${id}`);
    const [{ change }] = fake.writes();
    assert.equal(change.expectedHead, read, `${id}: on the head the editor opened`);
    assert.deepEqual(change.files, [{ path, text: edited }], `${id}: only the file, with the edited text`);
    await until(target, () => find(target, (node) => node.localName === "textarea" && !node.className.split(" ").includes("reject-reason")).length === 0 && target.textContent.includes(route === "decision" ? "two small modules" : "to a member"), `${id} to be shown again`);
    assert.equal(badgeOf(target), "open", `${id}: shown again from its page, open`);
    assert.ok(find(target, (node) => node.localName === "a" && (node.getAttribute("href") ?? "").endsWith(`/commit/${fake.head()}`)).length >= 1, `${id}: the commit is linked`);
  }
});

// TST-472610 · level: unit · module: MOD-review-pages
// guards: ARCHITECTURE RESTS ON ACCEPTED ARTIFACTS; UC-022
// given: ARC-004, which names UC-002, a use case that is open; MOD-finer, which names a requirement the SPEC does not hold; and, to show a file that names accepted artifacts only, ARC-002
// input: the routes decision and module rendered for each
// expect: for ARC-004 a section of what it rests on that is not accepted, naming it and UC-002 and no other; for MOD-finer the same naming A FINE IS CHARGED PER DAY and UC-002, in the order the file names them; on either one button Accept, disabled, and no GitHub page; nothing written; ARC-002 has no such section
test("MOD-review-pages decision/<id> and module/<id> — a file that names what is not accepted is shown with it named, and not accepted", async () => {
  const fake = fakeHost();
  assert.equal(byClass(await show(fake, "decision", { id: "ARC-002" }), "section", "rests-on").length, 0, "known positive: ARC-002 rests on accepted artifacts");

  for (const [route, id, named] of [["decision", "ARC-004", ["UC-002"]], ["module", "MOD-finer", ["A FINE IS CHARGED PER DAY", "UC-002"]]]) {
    const target = await show(fake, route, { id });
    const [section, ...more] = byClass(target, "section", "rests-on");
    assert.equal(more.length, 0, id);
    assert.ok(section.textContent.includes(id), `${id}: the section names the file`);
    assert.deepEqual(byClass(section, "li", "open-name").map((item) => item.textContent), named, id);
    const accepts = byClass(target, "button", "accept");
    assert.equal(accepts.length, 1, `${id}: one Accept`);
    assert.equal(accepts[0].disabled, true, `${id}: Accept is disabled`);
    assert.equal(byClass(target, "a", "github-page").length, 0, `${id}: no GitHub page`);
  }
  assert.equal(fake.writes().length, 0, "nothing written");
});

// TST-1315001 · level: unit · module: MOD-review-pages
// guards: ARCHITECTURE RESTS ON ACCEPTED ARTIFACTS; ONE CLICK PER DECISION; UC-023
// given: ARC-004, open, which names UC-002, a use case that no approval record names; and a token
// input: the route decision rendered for ARC-004, then a person's click on its Accept; then the same page on a product where a record names UC-002's text, and a person's click on its Accept
// expect: the section of what it rests on that is not accepted, naming UC-002, and after it one button Accept, disabled; the click commits nothing and the page still shows the section and the disabled Accept; known positive: with the record, no such section and one button Accept, enabled, whose click commits one record naming ARC-004's path and blob at docs/approvals/ARC-004-<blob12>.md on the head that was read
test("MOD-review-pages decision/<id> — a decision that rests on what is not accepted shows Accept disabled, and a click writes nothing", async () => {
  const fake = fakeHost();
  const target = await show(fake, "decision", { id: "ARC-004" });
  const [section] = byClass(target, "section", "rests-on");
  assert.ok(section, "the section of what it rests on");
  assert.deepEqual(byClass(section, "li", "open-name").map((item) => item.textContent), ["UC-002"]);
  const accepts = byClass(target, "button", "accept");
  assert.equal(accepts.length, 1, "one Accept");
  assert.equal(accepts[0].textContent, "Accept");
  assert.equal(accepts[0].disabled, true, "disabled");
  const shown = [...target.childNodes];
  assert.ok(shown.indexOf(section) >= 0 && shown.indexOf(section) < shown.indexOf(accepts[0]), "Accept stands beside the section, after it");
  click(accepts[0]);
  for (let turn = 0; turn < 40; turn++) await new Promise((resolve) => setImmediate(resolve));
  assert.equal(fake.writes().length, 0, "a click on the disabled Accept commits nothing");
  assert.equal(byClass(target, "section", "rests-on").length, 1, "the page is as it was");
  assert.equal(byClass(target, "button", "accept")[0]?.disabled, true, "still disabled");

  const accepted = [STEPS[0], { ...STEPS[1], ...Object.fromEntries([recordOf("UC-002", "use-case", "docs/use-cases/UC-002-reserve-a-book.md", UC2)]) }, STEPS[2]];
  const free = fakeHost({ steps: accepted });
  const read = free.head();
  const positive = await show(free, "decision", { id: "ARC-004" });
  assert.equal(byClass(positive, "section", "rests-on").length, 0, "known positive: UC-002 is named by a record, nothing is open");
  const [enabled, ...rest] = byClass(positive, "button", "accept");
  assert.equal(rest.length, 0, "known positive: one Accept");
  assert.notEqual(enabled.disabled, true, "known positive: Accept is enabled");
  click(enabled);
  await until(target, () => free.writes().length === 1, "the commit of ARC-004");
  const [{ change }] = free.writes();
  const [recordPath, recordText] = recordOf("ARC-004", "architecture-decision", A(4, "queue"), ARC4);
  assert.equal(change.expectedHead, read, "on the head that was read");
  assert.deepEqual(change.files, [{ path: recordPath, text: recordText }], "one record, naming the blob shown");
});

// TST-472611 · level: unit · module: MOD-review-pages
// guards: ARCHITECTURE RESTS ON ACCEPTED ARTIFACTS; ONE CLICK PER DECISION
// given: the page of ARC-002 built while the requirement it names is in the SPEC; then another writer's commit removes that requirement from the SPEC
// input: a click on Accept of ARC-002
// expect: no commit; the refusal said, naming ARC-002, that it rests on what is not accepted, and the requirement
test("MOD-review-pages decision/<id> — a requirement that left the SPEC after the page was built refuses the click, and is named", async () => {
  const fake = fakeHost();
  const target = await show(fake, "decision", { id: "ARC-002" });
  fake.land({ "SPEC.md": text("# Thesis tool — Specification", "", "## Lending") });
  click(byClass(target, "button", "accept")[0]);
  await until(target, () => /rests on what is not accepted/.test(target.textContent), "the refusal");

  assert.equal(fake.writes().length, 0, "no commit");
  assert.match(target.textContent, /ARC-002: rests on what is not accepted \(A LOAN HAS A DUE DATE\)/);
  assert.notEqual(byClass(target, "button", "accept")[0].disabled, true, "pressable again");
});

// ---------------------------------------------------------------- without a token, and an unknown file

// TST-472612 · level: unit · module: MOD-review-pages
// guards: WITHOUT A TOKEN, GITHUB'S WEB INTERFACE IS THE FALLBACK; NO TEXT TRAVELS IN A URL
// given: a GitHub product and no token stored; ARC-002, open
// input: the route decision rendered with the id ARC-002
// expect: no Accept; a link to GitHub's new-file page whose address holds the record's path and the record, nothing else; nothing written
test("MOD-review-pages decision/<id> — without a token on GitHub: GitHub's prefilled page for the record", async () => {
  const fake = fakeHost();
  const target = await show(fake, "decision", { id: "ARC-002" }, { token: false });

  assert.equal(byClass(target, "button", "accept").length, 0);
  const link = byClass(target, "a", "github-page")[0];
  assert.ok(link, "a link to GitHub's page");
  const page = new URL(link.getAttribute("href"));
  const [recordPath, recordText] = recordOf("ARC-002", "architecture-decision", A(2, "shelves"), ARC2);
  assert.equal(page.origin + page.pathname, "https://github.com/alice/thesis-tool/new/main");
  assert.deepEqual([...page.searchParams.keys()].sort(), ["filename", "value"]);
  assert.equal(page.searchParams.get("filename"), recordPath);
  assert.equal(page.searchParams.get("value"), recordText);
  assert.equal(fake.writes().length, 0);
});

// TST-472613 · level: unit · module: MOD-review-pages
// guards: STATUS IS DERIVED FROM THE RECORDS
// given: the product above
// input: the route module rendered with an identifier no file has
// expect: the statement that there is no module file MOD-nothing on the default branch, a link to all module files, no Accept
test("MOD-review-pages module/<id> — a module file that does not exist is said so", async () => {
  const target = await show(fakeHost(), "module", { id: "MOD-nothing" });

  assert.match(target.textContent, /No module file MOD-nothing on the default branch/);
  assert.equal(find(target, (node) => node.localName === "a" && node.getAttribute("href") === `#module/product=${encodeURIComponent(ON_GITHUB.web)}`).length, 1);
  assert.equal(byClass(target, "button", "accept").length, 0);
});
