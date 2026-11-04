// UC-006 system test for approving a specification change through the same services used by MOD-review-pages:
// the SPEC-entry page reads an open queue entry, shows current text, proposal, difference, rationale and impact, accepts
// through MOD-spec-changes.acceptEntries, edits through saveEntry, offers the instance no-token record fallback, and the
// instance workflow applies that record from a temporary git repository.
// Run: node --test tests/system-uc-006-approve-spec-change.test.mjs
//
// Module: MOD-review-pages · MOD-spec-changes · MOD-workflow-entries
// Guards: UC-006; A SPECIFICATION CHANGE IS APPROVED BEFORE IT IS WRITTEN; NO PROPOSAL WITHOUT THE CURRENT TEXT BESIDE IT
// Guards: THE APPROVED TEXT IS TAKEN VERBATIM; THE GATE IS RECORDED; THE REPLACED TEXT STAYS REACHABLE
// Guards: A REQUIREMENT IS NOT CHANGED WITHOUT AN IMPACT LIST; AN APPROVAL NAMES THE EXACT TEXT; A STALE APPROVAL IS NOT APPLIED
// Guards: THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK; WITHOUT A TOKEN, GITHUB'S WEB INTERFACE IS THE FALLBACK
// Guards: EDITS ARE PREPARED ON THE DASHBOARD; ACCEPTANCE IS A COMMIT BY THE ACCEPTING PERSON
// Guards: AN ACCEPTED SPEC CHANGE IS WRITTEN WITH ITS APPROVAL; WITHOUT A TOKEN, THE INSTANCE'S WORKFLOW WRITES THE CHANGE
// Guards: A QUEUE IS ACCEPTED IN ITS ORDER; SEVERAL FILES ARE ACCEPTED IN ONE CLICK
// Level: system
//
// The browser is the DOM harness of tests/review-pages-harness.mjs, imported unchanged. The product repository,
// the instance source-register repository and GitHub are fixtures: the review page uses in-memory Host objects, and the
// instance workflow path uses a temporary git origin plus checkout. Each test states its input, precondition and
// expected result before it runs. Counter-proof notes are recorded in the sprint review; fixture counter-proofs are
// included here as known positives and stale/refused flows.

import "./review-pages-harness.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { withStoredGraph } from "./stored-graph-fake.mjs";

const { openStore, writeSetting } = await import("../src/browser-store/index.mjs");
const pages = await import("../src/review-pages/index.mjs").catch((error) => ({ error }));
const entries = await import("../src/workflow-entries/main.mjs").catch((error) => ({ error }));

const route = pages.view?.routes.find((candidate) => candidate.name === "spec-entry");
const { runEntry } = entries;

// ---------------------------------------------------------------- the product and the instance

const text = (...lines) => `${lines.join("\n")}\n`;
const pad2 = (n) => String(n).padStart(2, "0");
const blobOf = (body) => createHash("sha1").update(`blob ${Buffer.byteLength(body)}\0${body}`).digest("hex");
const failure = (name, message, fields = {}) => Object.assign(new Error(message), { name, ...fields });

const PRODUCT = { server: "github", origin: "https://github.com", path: "alice/spec-product", web: "https://github.com/alice/spec-product" };
const INSTANCE = { server: "github", origin: "https://github.com", path: "alice/agent-m", web: "https://github.com/alice/agent-m" };
const TOKEN = { value: "github_pat_ALICEspecPRODUCT0123456789abcdef", name: "Agent M - spec-product", expires: "2027-01-01" };
const NOW = new Date("2026-03-01T10:00:00Z");
const WHEN = "2026-03-01 10:00 UTC";

const SAMPLE = "A SAMPLE RULE";
const ADDED_RULE = "AN ADDED RULE";
const WRITE_RULE = "A WRITE RULE";

const READING = text(
  "## 1. Reading", "",
  `**${SAMPLE}** *(Fixture PO)*`,
  "A reader reads a file whole.",
  "*Check:* `tests/sample.test.mjs`",
  "",
);
const READING_NEW = READING.replace("whole.", "whole, or says why not.");
const ADDED = text(
  "## 1a. Added", "",
  `**${ADDED_RULE}** *(Fixture PO)*`,
  "A reader sees what was added.",
  "*Check:* no automatic check; at review",
  "",
);
const ADDED_NEW = ADDED.replace("what was added.", "what was added, and when.");
const WRITING = text(
  "## 2. Writing", "",
  `**${WRITE_RULE}** *(Fixture PO)*`,
  "A writer writes a file whole.",
  "*Check:* no automatic check; at review",
);
const WRITING_NEW = WRITING.replace("whole.", "entirely.");
const WRITING_OTHER = WRITING.replace("whole.", "in one piece.");
const HEAD = text("# Fixture product - Specification", "");
const SPEC = HEAD + READING + WRITING;

const USE_CASE = text(
  "---",
  "id: UC-001",
  "title: Read a file",
  "area: reading",
  "actors:",
  "  - Reader",
  "realises:",
  `  - ${SAMPLE}`,
  "---",
  "# UC-001 Read a file",
  "",
  `**Goal.** The reader reads a file whole, as ${SAMPLE} says.`,
);
const ENTRY_PO = text(
  "---",
  "id: SRC-fixture-po",
  "title: Fixture PO",
  "kind: document",
  "authority: normative",
  "licence: may be republished - fixture",
  "---",
  "# SRC-fixture-po Fixture PO",
  "",
  "A fixture source.",
);
const LINKS = text(
  "# The sources this product meets", "",
  "| Source | Version | Hash | Part |",
  "|---|---|---|---|",
  `| SRC-fixture-po | 2026-10-05 | ${"0".repeat(64)} | |`,
);

const QUEUE = "docs/spec-freigaben/2026-03-01_sample";
const DECISIONS = text("# Decisions - queue 2026-03-01 sample", "", "Append-only.");
const entry = (nr, anchor, proposal) => ({ nr, anchor, proposal, slug: `entry-${nr}` });
const E05 = entry(5, "## 1. Reading", READING_NEW + ADDED);
const E06 = entry(6, "## 1a. Added", ADDED_NEW);
const E07 = entry(7, "## 2. Writing", WRITING_NEW);
const proposalPath = (item) => `${QUEUE}/${pad2(item.nr)}-${item.slug}.md`;
const rationalePath = (item) => `${QUEUE}/${pad2(item.nr)}-${item.slug}.begruendung.md`;
const entryId = (item) => `spec-2026-03-01_sample-${pad2(item.nr)}`;
const recordPath = (item, blob = blobOf(item.proposal)) => `docs/approvals/spec-2026-03-01_sample-${pad2(item.nr)}-${blob.slice(0, 12)}.md`;
const rowFor = (item, blob = blobOf(item.proposal)) => `| ${WHEN} | ${item.nr} | uebernommen | approval:${recordPath(item, blob).slice("docs/approvals/".length)} |\n`;
const recordText = (item, section) => text(
  "kind: spec",
  `queue: ${QUEUE}`,
  `entry: ${pad2(item.nr)}`,
  `proposal: ${proposalPath(item)}`,
  `blob: ${blobOf(item.proposal)}`,
  "target: SPEC.md",
  `anchor: ${item.anchor}`,
  `section: ${blobOf(section)}`,
);
const fieldsOf = (body) => Object.fromEntries(body.trim().split("\n").map((line) => {
  const at = line.indexOf(":");
  return [line.slice(0, at), line.slice(at + 1).trim()];
}));

function queueIndex(entries) {
  return text(
    "# SPEC approvals - queue 2026-03-01 · sample",
    "",
    "**Zieldatei aller Einträge:** `SPEC.md`",
    "",
    "| Nr | Datei | Anker (Überschrift, wortgetreu) | bis (exklusiv) | Commits |",
    "|---|---|---|---|---|",
    ...entries.map((item) => `| ${pad2(item.nr)} | \`SPEC.md\` | ${item.anchor} | — | — |`),
  );
}

function rationale(item) {
  return text(
    `# ${item.anchor}: fixture change`,
    "",
    "**The change.** Changes a fixture requirement section.",
    "",
    "**Why.** The fixture reviewer needs a proposed wording beside the current section.",
    "",
    "**Impact list.**",
    "- fixture impact",
    "",
    "**Origin.** fixture source passage.",
  );
}

function productFiles({ entries = [E05, E06, E07], spec = SPEC, decisions = DECISIONS, extra = {} } = {}) {
  const files = {
    "README.md": "# Fixture product\n",
    "SPEC.md": spec,
    "docs/sources.md": LINKS,
    "docs/use-cases/UC-001-read-a-file.md": USE_CASE,
    [`${QUEUE}/index.md`]: queueIndex(entries),
    [`${QUEUE}/entscheidungen.md`]: decisions,
    ...extra,
  };
  for (const item of entries) {
    files[proposalPath(item)] = item.proposal;
    files[rationalePath(item)] = rationale(item);
  }
  return files;
}

const instanceSourceFiles = () => ({
  "README.md": "# Fixture instance\n",
  "docs/sources.md": LINKS,
  "docs/sources/SRC-fixture-po.md": ENTRY_PO,
});

// Each host's commits are its own: MOD-trace-graph's storedGraph keeps a commit's graph for the page, so two hosts never share a commit. Every snapshot's
// readOn serves the graph the workflow "main changed" stores for its commit (tests/stored-graph-fake.mjs), which a page reads and never builds.
let hosts = 0;
function memoryHost({ files = productFiles(), repository = PRODUCT, canWrite = true } = {}) {
  const calls = [], commits = new Map(), host = ++hosts;
  let made = 0, head = null;
  const commitOf = (tree, parent) => {
    const sha = createHash("sha1").update(`host ${host} commit ${++made}`).digest("hex");
    commits.set(sha, { tree, parent, date: `2026-03-0${Math.min(made, 9)}T10:00:00Z` });
    return sha;
  };
  head = commitOf(new Map(Object.entries(files)), null);
  const snapshotAt = (sha, ref = sha) => {
    const { tree } = commits.get(sha);
    return withStoredGraph({
      repository, ref, commit: sha, paths: [...tree.keys()].sort(),
      read: async (path) => (tree.has(path) ? tree.get(path) : null),
      blob: (path) => (tree.has(path) ? blobOf(tree.get(path)) : null),
    });
  };
  return {
    calls: () => calls,
    head: () => head,
    files: () => Object.fromEntries(commits.get(head).tree),
    writes: () => calls.filter((call) => call.fn === "commitFiles"),
    land(changed) { head = commitOf(new Map([...commits.get(head).tree, ...Object.entries(changed)]), head); },
    host: {
      async repositoryInfo() {
        calls.push({ fn: "repositoryInfo" });
        return { defaultBranch: "main", visibility: "public", canWrite, archived: false, description: "" };
      },
      async readSnapshot(ref) {
        calls.push({ fn: "readSnapshot", ref });
        if (ref === "main") return snapshotAt(head, "main");
        if (commits.has(ref)) return snapshotAt(ref, ref);
        throw failure("NotFound", `${ref} was not found`, { what: ref });
      },
      async readHistory(path, { ref = "main", limit } = {}) {
        calls.push({ fn: "readHistory", path });
        const out = [];
        for (let sha = ref === "main" ? head : ref; sha; sha = commits.get(sha).parent) {
          const here = commits.get(sha), before = here.parent ? commits.get(here.parent).tree.get(path) : undefined;
          if (here.tree.get(path) !== before) out.push({ commit: sha, parents: here.parent ? [here.parent] : [], date: here.date,
            message: "", author: { account: "alice", name: "Alice" }, changes: [{ path, change: before === undefined ? "added" : "modified" }] });
        }
        return limit ? out.slice(0, limit) : out;
      },
      async commitFiles(change) {
        calls.push({ fn: "commitFiles", change: structuredClone(change) });
        if (!canWrite) throw failure("PermissionMissing", "the host has no stored token");
        if (change.branch !== "main" || change.expectedHead !== head) throw failure("Moved", "the branch moved", { head });
        head = commitOf(new Map([...commits.get(head).tree, ...change.files.map((file) => [file.path, file.text])]), head);
        return { commit: head, url: `${repository.web}/commit/${head}` };
      },
    },
  };
}

// ---------------------------------------------------------------- the page

function clearStore() {
  while (globalThis.localStorage.length) globalThis.localStorage.removeItem(globalThis.localStorage.key(0));
}

function storeWithToken({ product = true, token = true } = {}) {
  clearStore();
  const store = openStore("alice/agent-m");
  if (token && product) writeSetting(store, `github-token:${PRODUCT.path}`, TOKEN);
  if (token && !product) writeSetting(store, "github-token", TOKEN);
  return store;
}

async function showProduct(fake, params = {}, options = {}) {
  assert.ok(route, `spec-entry route: ${pages.error?.message}`);
  const instance = options.instance ?? memoryHost({ files: instanceSourceFiles(), repository: INSTANCE });
  const target = document.createElement("div");
  document.body.append(target);
  await route.render(target, {
    page: "review",
    instance: { repository: INSTANCE.path, host: instance.host },
    product: { address: PRODUCT.web, kind: "github", host: fake.host },
    store: storeWithToken({ product: true, token: options.token ?? true }),
    go() {},
  }, params);
  return target;
}

async function showInstance(fake, params = {}, options = {}) {
  assert.ok(route, `spec-entry route: ${pages.error?.message}`);
  const target = document.createElement("div");
  document.body.append(target);
  await route.render(target, {
    page: "review",
    instance: { repository: INSTANCE.path, host: fake.host },
    store: storeWithToken({ product: false, token: options.token ?? true }),
    go() {},
  }, params);
  return target;
}

function find(root, match) {
  const found = [];
  (function walk(node) {
    for (const kid of node.childNodes) {
      if (kid.nodeType === 1) {
        if (match(kid)) found.push(kid);
        walk(kid);
      }
    }
  })(root);
  return found;
}
const byClass = (root, name, className) => find(root, (node) => node.localName === name && node.className.split(" ").includes(className));
const click = (node) => node.dispatchEvent(new Event("click"));
const tick = (box, checked = true) => { box.checked = checked; box.dispatchEvent(new Event("change")); };
const buttonOf = (target, label) => find(target, (node) => node.localName === "button" && node.textContent === label)[0];
const rowOf = (target, id) => find(target, (node) => node.localName === "tr" && node.getAttribute("data-id") === id)[0];
const boxOf = (target, id) => find(rowOf(target, id), (node) => node.localName === "input")[0];
const textAreaOf = (target) => find(target, (node) => node.localName === "textarea" && !node.className.split(" ").includes("why"))[0];
const whyOf = (target) => byClass(target, "textarea", "why")[0];
const type = (target, value) => {
  const area = textAreaOf(target);
  area.value = value;
  area.dispatchEvent(new Event("input"));
};
async function until(condition, what) {
  const limit = Date.now() + 10000;
  while (Date.now() < limit) {
    if (condition()) return;
    await new Promise((resolve) => setImmediate(resolve));
  }
  if (condition()) return;
  assert.fail(`waited for ${what}`);
}
const written = (fake) => Object.fromEntries(fake.writes()[0].change.files.map((file) => [file.path, file.text]));

// ---------------------------------------------------------------- the temporary workflow repository

function git(cwd, ...args) {
  const result = spawnSync("git", args, { cwd, encoding: "utf8",
    env: { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_SYSTEM: "/dev/null", GIT_TERMINAL_PROMPT: "0" } });
  if (result.status !== 0) throw new Error(`git ${args.join(" ")} failed in ${cwd}: ${result.stderr}`);
  return result.stdout.trim();
}

function writeFiles(root, files) {
  for (const [path, body] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), body);
  }
}

function gitFixture(files) {
  const root = mkdtempSync(join(tmpdir(), "agent-m-uc006-"));
  const origin = join(root, "origin.git"), seed = join(root, "seed"), clone = join(root, "clone");
  git(root, "init", "-q", "--bare", "-b", "main", origin);
  git(root, "clone", "-q", origin, seed);
  git(seed, "config", "user.name", "Alice Approver");
  git(seed, "config", "user.email", "alice@example.org");
  writeFiles(seed, files);
  git(seed, "add", "-A");
  git(seed, "commit", "-q", "-m", "approval committed without the dashboard");
  git(seed, "push", "-q", "origin", "HEAD:refs/heads/main");
  git(root, "clone", "-q", origin, clone);
  git(clone, "config", "user.name", "agent-m apply-approvals");
  git(clone, "config", "user.email", "41898282+github-actions[bot]@users.noreply.github.com");
  return { root, origin, clone, head: git(clone, "rev-parse", "HEAD") };
}

async function withGitInstance(files, run) {
  const fixture = gitFixture(files);
  try {
    return await run(fixture);
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
}

function workflowEnv(fixture, extra = {}) {
  return {
    GITHUB_ACTIONS: "true",
    GITHUB_EVENT_NAME: "push",
    GITHUB_WORKSPACE: fixture.clone,
    GITHUB_SERVER_URL: "https://github.com",
    GITHUB_REPOSITORY: INSTANCE.path,
    GITHUB_REF_NAME: "main",
    GITHUB_SHA: fixture.head,
    GITHUB_TOKEN: "ghp_ALICEworkflowTOKEN0123456789abcdef",
    ...extra,
  };
}

// TST-371001 · level: system · module: MOD-review-pages; MOD-spec-changes
// guards: UC-006; A SPECIFICATION CHANGE IS APPROVED BEFORE IT IS WRITTEN; NO PROPOSAL WITHOUT THE CURRENT TEXT BESIDE IT; THE APPROVED TEXT IS TAKEN VERBATIM; THE GATE IS RECORDED; THE REPLACED TEXT STAYS REACHABLE; A REQUIREMENT IS NOT CHANGED WITHOUT AN IMPACT LIST; AN APPROVAL NAMES THE EXACT TEXT; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK; AN ACCEPTED SPEC CHANGE IS WRITTEN WITH ITS APPROVAL
// given: a product whose queue has entry 07 replacing "## 2. Writing"; the product links Fixture PO and the instance register holds that source
// input: open the SPEC-entry page and click Accept once
// expect: before the click nothing is written; the page shows current text, proposal, diff, rationale and impact; after the click one commit holds the approval record, SPEC and decisions, with the proposal bytes in SPEC and the old section reachable at the head read
test("TST-371001: UC-006 main flow accepts one SPEC entry from the review page", async () => {
  const fake = memoryHost();
  const before = fake.head();
  const target = await showProduct(fake, { id: entryId(E07) });

  assert.match(byClass(target, "section", "current")[0].textContent, /A writer writes a file whole/);
  assert.match(byClass(target, "section", "proposal")[0].textContent, /A writer writes a file entirely/);
  assert.match(byClass(target, "section", "difference")[0].textContent, /\+ A writer writes a file entirely\./);
  assert.match(byClass(target, "section", "difference")[0].textContent, /- A writer writes a file whole\./);
  assert.match(byClass(target, "section", "rationale")[0].textContent, /fixture reviewer needs a proposed wording/);
  assert.match(byClass(target, "section", "impact-list")[0].textContent, new RegExp(`${WRITE_RULE} - changed|${WRITE_RULE} — changed`));
  assert.equal(fake.writes().length, 0, "no write before the person's click");

  click(buttonOf(target, "Accept"));
  await until(() => /Accepted in commit/.test(byClass(target, "p", "result")[0]?.textContent ?? ""), "acceptance result");

  assert.equal(fake.writes().length, 1);
  const files = written(fake);
  assert.deepEqual(Object.keys(files).sort(), [recordPath(E07), `${QUEUE}/entscheidungen.md`, "SPEC.md"].sort());
  assert.equal(files["SPEC.md"], HEAD + READING + WRITING_NEW, "the approved proposal text is written byte for byte");
  assert.match(files[`${QUEUE}/entscheidungen.md`], new RegExp(`approval:${recordPath(E07).slice("docs/approvals/".length)}`));
  assert.deepEqual(fieldsOf(files[recordPath(E07)]), fieldsOf(recordText(E07, WRITING)));
  assert.match(fake.writes()[0].change.message, /Agent M - spec-product/);
  assert.equal((await (await fake.host.readSnapshot(before)).read("SPEC.md")), SPEC, "the replaced text is reachable at the head read");
  assert.match(target.textContent, /in SPEC/);
});

// TST-371002 · level: system · module: MOD-review-pages; MOD-spec-changes
// guards: UC-006; EDITS ARE PREPARED ON THE DASHBOARD; A REQUIREMENT IS NOT CHANGED WITHOUT AN IMPACT LIST; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK
// given: the same product and an open entry 07
// input: open its edit page, change the proposal, give a Why, and click Save
// expect: one commit changes only the entry proposal and rationale in its own queue; SPEC.md is not written; before Save nothing is written
test("TST-371002: UC-006 3a saves different wording in the entry's own queue", async () => {
  const fake = memoryHost();
  const target = await showProduct(fake, { id: entryId(E07), edit: "1" });
  const edited = WRITING_NEW.replace("entirely.", "entirely, without paraphrase.");

  assert.equal(textAreaOf(target).value, WRITING_NEW);
  assert.match(byClass(target, "ul", "impact")[0].textContent, new RegExp(`${WRITE_RULE} - changed|${WRITE_RULE} — changed`));
  type(target, edited);
  whyOf(target).value = "The reviewer wants the exact wording to be explicit.";
  assert.equal(fake.writes().length, 0, "no write before Save");

  click(buttonOf(target, "Save"));
  await until(() => byClass(target, "p", "entry").length === 1, "saved entry link");

  assert.equal(fake.writes().length, 1);
  const out = written(fake);
  assert.deepEqual(Object.keys(out).sort(), [proposalPath(E07), rationalePath(E07)].sort());
  assert.equal(out[proposalPath(E07)], edited);
  assert.match(out[rationalePath(E07)], /The reviewer wants the exact wording to be explicit/);
  assert.ok(!Object.keys(out).includes("SPEC.md"), "editing an entry does not write the SPEC");
});

// TST-371003 · level: system · module: MOD-review-pages; MOD-spec-changes
// guards: UC-006; A QUEUE IS ACCEPTED IN ITS ORDER; SEVERAL FILES ARE ACCEPTED IN ONE CLICK; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK
// given: a queue whose entry 05 creates heading "## 1a. Added" and entry 06 changes it
// input: first open the page of entry 06, then the list, tick only 06 and click Accept ticked; then in a fresh repository open the pages of entries 05 and 06, then the list, tick 05 and 06 and click Accept ticked once
// expect: 06 alone is refused and names 05; with both entries one commit writes 05 before 06; doing nothing on an entry page writes nothing and leaves it open
test("TST-371003: UC-006 4d accepts ticked queue entries in queue order and names a missing creator", async () => {
  const rejectPath = memoryHost();
  const oneEntry = await showProduct(rejectPath, { id: entryId(E05) });
  assert.ok(buttonOf(oneEntry, "Accept"), "the entry could be accepted");
  assert.equal(rejectPath.writes().length, 0, "UC-006 4a postcondition before a decision: no record is committed");
  assert.match(oneEntry.textContent, /open/, "the entry stays open until another commit removes it");

  const refusedHost = memoryHost();
  await showProduct(refusedHost, { id: entryId(E06) });
  const refused = await showProduct(refusedHost);
  tick(boxOf(refused, entryId(E06)));
  click(buttonOf(refused, "Accept ticked (1)"));
  await until(() => /entry 06/.test(byClass(refused, "p", "result")[0]?.textContent ?? ""), "refusal naming entry 06");
  assert.match(byClass(refused, "p", "result")[0].textContent, /05/);
  assert.equal(refusedHost.writes().length, 0);

  const acceptedHost = memoryHost();
  await showProduct(acceptedHost, { id: entryId(E05) });
  await showProduct(acceptedHost, { id: entryId(E06) });
  const accepted = await showProduct(acceptedHost);
  tick(boxOf(accepted, entryId(E05)));
  tick(boxOf(accepted, entryId(E06)));
  click(buttonOf(accepted, "Accept ticked (2)"));
  await until(() => /Accepted in commit/.test(byClass(accepted, "p", "result")[0]?.textContent ?? ""), "batch acceptance result");

  assert.equal(acceptedHost.writes().length, 1);
  const files = written(acceptedHost);
  assert.equal(files["SPEC.md"], HEAD + READING_NEW + ADDED_NEW + WRITING);
  const decisions = files[`${QUEUE}/entscheidungen.md`];
  assert.ok(decisions.indexOf(`approval:${recordPath(E05).slice("docs/approvals/".length)}`) < decisions.indexOf(`approval:${recordPath(E06).slice("docs/approvals/".length)}`));
  assert.deepEqual(Object.keys(files).sort(), [recordPath(E05), recordPath(E06), `${QUEUE}/entscheidungen.md`, "SPEC.md"].sort());
});

// TST-371004 · level: system · module: MOD-review-pages; MOD-spec-changes
// guards: UC-006; A STALE APPROVAL IS NOT APPLIED; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK
// given: entry 07 was shown with the blob of its proposal
// input: another commit changes the proposal before the reviewer clicks Accept, then the reviewer clicks Accept
// expect: nothing is written by the acceptance attempt, and the page names the stale proposal
test("TST-371004: UC-006 5a refuses a SPEC entry whose proposal changed after it was shown", async () => {
  const fake = memoryHost();
  const target = await showProduct(fake, { id: entryId(E07) });
  fake.land({ [proposalPath(E07)]: WRITING_NEW.replace("entirely.", "completely.") });

  click(buttonOf(target, "Accept"));
  await until(() => /proposal/.test(byClass(target, "p", "result")[0]?.textContent ?? ""), "stale refusal");

  assert.equal(fake.writes().length, 0);
  assert.match(byClass(target, "p", "result")[0].textContent, /entry 07/);
  assert.match(byClass(target, "p", "result")[0].textContent, /proposal/);
});

// TST-371005 · level: system · module: MOD-review-pages; MOD-spec-changes
// guards: UC-006; WITHOUT A TOKEN, GITHUB'S WEB INTERFACE IS THE FALLBACK; EDITS ARE PREPARED ON THE DASHBOARD
// given: the instance's own SPEC queue entry is open, and the browser stores no token
// input: open the entry page, then open the edit page, edit the proposal, give a Why and click Save
// expect: accepting offers GitHub's new-file page for the approval record; editing offers GitHub pages for the proposal and rationale; no repository write is made from the dashboard
test("TST-371005: UC-006 4b offers GitHub fallback pages for the instance without a token", async () => {
  const fake = memoryHost({ files: { ...productFiles({ entries: [E07] }), "docs/sources/SRC-fixture-po.md": ENTRY_PO }, repository: INSTANCE, canWrite: false });
  const page = await showInstance(fake, { id: entryId(E07) }, { token: false });

  assert.equal(byClass(page, "button", "accept").length, 0);
  const offered = byClass(page, "a", "github-page")[0];
  assert.ok(offered.getAttribute("href").startsWith("https://github.com/alice/agent-m/new/"));
  assert.match(byClass(page, "code", "record-path")[0].textContent, new RegExp(recordPath(E07)));
  assert.ok(!decodeURIComponent(offered.getAttribute("href")).includes("A writer writes a file entirely"), "the reviewed text is not in the URL");
  assert.equal(fake.writes().length, 0);

  const editPage = await showInstance(fake, { id: entryId(E07), edit: "1" }, { token: false });
  type(editPage, WRITING_NEW.replace("entirely.", "entirely, as shown."));
  whyOf(editPage).value = "The GitHub web editor should carry the entry files.";
  click(buttonOf(editPage, "Save"));
  await until(() => byClass(editPage, "a", "github-page").length === 2, "GitHub edit pages");
  assert.deepEqual(byClass(editPage, "a", "github-page").map((link) => link.textContent).sort(), [
    `Open GitHub's page for ${proposalPath(E07)}`,
    `Open GitHub's page for ${rationalePath(E07)}`,
  ].sort());
  assert.equal(fake.writes().length, 0);
});

// TST-371006 · level: system · module: MOD-workflow-entries; MOD-spec-changes
// guards: UC-006; WITHOUT A TOKEN, THE INSTANCE'S WORKFLOW WRITES THE CHANGE; THE APPROVED TEXT IS TAKEN VERBATIM; A STALE APPROVAL IS NOT APPLIED
// given: a person committed the approval record of the instance's own SPEC entry through GitHub's web interface, and no decision row names it
// input: run the instance workflow entry onApprovalsCommitted from a temporary checkout
// expect: one workflow commit writes only SPEC.md and the queue decisions; the approval record stays as the person committed it
test("TST-371006: UC-006 4c applies an instance approval through the workflow", async () => {
  assert.ok(runEntry, `runEntry: ${entries.error?.message}`);
  const files = {
    ...productFiles({ entries: [E07], extra: { [recordPath(E07)]: recordText(E07, WRITING) } }),
    "docs/sources/SRC-fixture-po.md": ENTRY_PO,
  };

  await withGitInstance(files, async (fixture) => {
    const status = await runEntry("onApprovalsCommitted", workflowEnv(fixture), { now: NOW });
    assert.equal(status.outcome, "done");
    assert.match(status.summary, new RegExp(recordPath(E07).slice("docs/approvals/".length)));
    const after = git(fixture.origin, "rev-parse", "main");
    assert.notEqual(after, fixture.head);
    assert.equal(git(fixture.origin, "rev-parse", `${after}^`), fixture.head);
    assert.deepEqual(git(fixture.origin, "diff", "--name-only", fixture.head, after).split("\n").sort(), ["SPEC.md", `${QUEUE}/entscheidungen.md`].sort());
    assert.equal(`${git(fixture.origin, "show", `${after}:SPEC.md`)}\n`, HEAD + READING + WRITING_NEW);
    assert.equal(`${git(fixture.origin, "show", `${after}:${QUEUE}/entscheidungen.md`)}\n`, DECISIONS + rowFor(E07));
    assert.equal(`${git(fixture.origin, "show", `${after}:${recordPath(E07)}`)}\n`, recordText(E07, WRITING));
  });

  await withGitInstance({
    ...productFiles({ entries: [E07], spec: HEAD + READING + WRITING_OTHER, extra: { [recordPath(E07)]: recordText(E07, WRITING) } }),
    "docs/sources/SRC-fixture-po.md": ENTRY_PO,
  }, async (fixture) => {
    const status = await runEntry("onApprovalsCommitted", workflowEnv(fixture), { now: NOW });
    assert.equal(status.outcome, "failed");
    assert.match(status.summary, /refused|stale/i);
    assert.equal(git(fixture.origin, "rev-parse", "main"), fixture.head, "the stale approval writes nothing");
  });
});
