// MOD-trace-pages' specification view reads the product's links file and the instance's register entries through Snapshot.readMany: on the
// default branch the person's own source is looked up in docs/sources.md and in the entries of docs/sources/, and an opened requirement shows its sources
// from the same files, at any version; these files are named to readMany before they are read, so that a host that can batch fetches them together.
//
// Run: node --test tests/trace-pages-register-batch.test.mjs
//
// Module: MOD-trace-pages
// Guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES; THE PERSON WHO PROMPTS IS A SOURCE
// Level: unit
//
// The route is called through its public Route.render with Hosts of the test's own, which keep to MOD-repository-hosts' interface (readSnapshot,
// repositoryInfo, listTags) and write nothing. Every call the Snapshots receive is recorded in one list, in the order it was made: `many <paths>` for
// readMany, `read <path>` for read. Each case states its expected list in its own text; none is read from a document. Readings the cases take, each from
// the sentence quoted:
// - "one batch of the files it shows" (SPEC.md, A PAGE LOAD READS THE REPOSITORY IN BATCHES): the links file and the register entries are asked for in
//   one readMany call where they stand in one snapshot; where the product's and the instance's snapshots are two, the register's entries are asked for in
//   one call of the instance's snapshot, and the links file, a batch of one file, by its own read.
// - "It reads the product's snapshot at the chosen version" (MOD-trace-pages, Files): the register is looked up for the prompt bar's person only on the default
//   branch; at a released version no file of the register is asked for until a requirement is opened.
// - "Sources — each with the version and the part the product links" (UC-020 step 5): opening a requirement reads the same files, and they are named to readMany
//   in one call for the drawing the requirement is opened in, however many requirements are opened in it.

import test from "node:test";
import assert from "node:assert/strict";
import { document, find, until } from "./trace-pages-harness.mjs";
import { storedGraphReadOn } from "./stored-graph-fake.mjs";

const { view } = await import("../src/trace-pages/index.mjs");
const route = view.routes.find((candidate) => candidate.name === "trace");

const SPEC = "# Fixture — Specification\n\n## First section\n\n**FIRST RULE** *(Source one)*\nFirst rule.\n*Check:* at review.\n";
// The group file of the fixture: one group, which holds FIRST RULE; the cases open that group (ITM-595: the tree is the group file's).
const GROUP_FILE = "docs/groups/requirements.md", GROUPS = "- First group\n  - FIRST RULE\n";
const SHA = "0".repeat(64);
const PERSON = "SRC-acme-person", OTHER = "SRC-other-person";
const LINKS = `# The sources this product meets\n\n| Source | Version | Hash | Part |\n|---|---|---|---|\n| ${PERSON} | 2026-10-11 | ${SHA} | |\n`;
const entryText = (id, account) => `---\nid: ${id}\ntitle: A person\nkind: person\nauthority: normative\nlicence: may be republished — fixture\nidentifier: ${account}\n---\n# ${id} A person\n\nA fixture source.\n\n## Versions\n\n| Version | Date | Edition | Read from | Files |\n|---|---|---|---|---|\n| \`2026-10-11\` | 2026-10-11 | the fixture | this repository | one file, hashed only |\n`;
const PERSON_FILE = `docs/sources/${PERSON}.md`, OTHER_FILE = `docs/sources/${OTHER}.md`;
const REGISTER = { [PERSON_FILE]: entryText(PERSON, "github.com/acme"), [OTHER_FILE]: entryText(OTHER, "github.com/other") };
const REPOSITORY = { server: "github", origin: "https://github.com", path: "acme/agent-m", web: "https://github.com/acme/agent-m" };

// A Host whose Snapshots hold `files`, with the graph of each ref stored on trace-cache as the workflow "main changed" stores it (tests/stored-graph-fake.mjs); every
// call to a Snapshot is noted in `events` under `label` (`readOn <branch> <path>` for readOn). `pinned`: the Host hands the same Snapshot for a ref every
// time, as the dashboard's host does while a page loads. `batching: false`: its Snapshots have no readMany.
// Each Host's commits are its own (`<ref>@<n>`), since MOD-trace-graph's storedGraph keeps a commit's graph for the page (the module).
let hosts = 0;
function recordingHost({ label, files, events, pinned = false, batching = true }) {
  const held = new Map(), host = ++hosts;
  const make = (ref) => {
    const commit = `${ref}@${host}`;
    const stored = storedGraphReadOn({ commit, paths: Object.keys(files), read: async (path) => files[path] ?? null });
    const snapshot = {
      ref, commit, repository: REPOSITORY, paths: Object.keys(files), blob: () => null,
      async read(path) { events.push(`${label} read ${path}`); return files[path] ?? null; },
      async readOn(branch, path, options) { events.push(`${label} readOn ${branch} ${path}`); return stored(branch, path, options); },
    };
    if (batching) snapshot.readMany = async (paths) => { events.push(`${label} many ${paths.join(",")}`); };
    return snapshot;
  };
  return {
    async readSnapshot(ref) {
      if (!pinned) return make(ref);
      if (!held.has(ref)) held.set(ref, make(ref));
      return held.get(ref);
    },
    async repositoryInfo() { return { defaultBranch: "main", visibility: "public", canWrite: false, archived: false, description: "" }; },
    async listTags() { return []; },
  };
}

async function drawn({ product, instance, ref = "main" }) {
  const target = document.createElement("div");
  document.body.append(target);
  const context = { page: "review", instance: { repository: "acme/agent-m", host: instance }, product: { address: "https://github.com/acme/library", kind: "github", host: product }, store: {}, go() {} };
  const params = { key: "specification", ref };
  await route.render(target, context, params);
  // A group opened is a subject with the person's source and reads nothing; a requirement opened would also read the register for its traces.
  find(target, (node) => node.localName === "button" && node.className.includes("spec-group-toggle"))[0]?.dispatchEvent(new Event("click"));
  return route.subject(params, context);
}
const register = (events) => events.filter((event) => event.includes("docs/sources"));

// CASE ITM-833-01
// TST-833001 · level: unit · module: MOD-trace-pages
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES
// given: one Host for the product and the instance, which hands the same Snapshot for main each time; that Snapshot holds SPEC.md, docs/sources.md and two register entries
// input: the specification route drawn at main, its first group opened, the subject asked for
// expect: of the calls that name a file of the register, the first is one readMany of docs/sources.md and the two entries, in that order; the three files are then read once each; readMany was called once in all — the trace graph for the counts of the groups is the stored one, read by one readOn of ("trace-cache", "main.json.gz"), and is not built; known positive: the subject's source is SRC-acme-person
test("on the default branch the links file and the register entries are named to readMany together before they are read", async () => {
  const events = [];
  const host = recordingHost({ label: "host", files: { "SPEC.md": SPEC, [GROUP_FILE]: GROUPS, "docs/sources.md": LINKS, ...REGISTER }, events, pinned: true });
  const subject = await drawn({ product: host, instance: host });
  assert.equal(register(events)[0], `host many docs/sources.md,${PERSON_FILE},${OTHER_FILE}`);
  assert.deepEqual(register(events).slice(1).sort(), [`host read docs/sources.md`, `host read ${OTHER_FILE}`, `host read ${PERSON_FILE}`].sort());
  assert.equal(events.filter((event) => event.startsWith("host many")).length, 1);
  assert.deepEqual(events.filter((event) => event.startsWith("host readOn")), [`host readOn trace-cache main@${hosts}.gaps.json`, `host readOn trace-cache main@${hosts}.json.gz`], "no gaps stored: the trace graph is the stored one");
  assert.equal(subject.paramsFor({ name: "po-opus" }).source, PERSON);
});

// CASE ITM-833-02
// TST-833002 · level: unit · module: MOD-trace-pages
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES
// given: a product Host whose Snapshot holds SPEC.md and docs/sources.md, and an instance Host, another one, whose Snapshot holds the two register entries
// input: the specification route drawn at main, its first group opened, the subject asked for
// expect: the instance's Snapshot is told the two entries in one readMany, before it reads them once each; the product's Snapshot is told nothing to readMany — its trace graph is the stored one, one readOn of ("trace-cache", "main.json.gz") — and reads docs/sources.md once; known positive: the subject's source is SRC-acme-person
test("where the register is another snapshot's, its entries are named to readMany together and the links file is read by itself", async () => {
  const events = [];
  const product = recordingHost({ label: "product", files: { "SPEC.md": SPEC, [GROUP_FILE]: GROUPS, "docs/sources.md": LINKS }, events });
  const instance = recordingHost({ label: "instance", files: REGISTER, events });
  const subject = await drawn({ product, instance });
  const instanceCalls = events.filter((event) => event.startsWith("instance "));
  assert.equal(instanceCalls[0], `instance many ${PERSON_FILE},${OTHER_FILE}`);
  assert.deepEqual(instanceCalls.slice(1).sort(), [`instance read ${OTHER_FILE}`, `instance read ${PERSON_FILE}`].sort());
  assert.deepEqual(events.filter((event) => event.startsWith("product many")), []);
  assert.deepEqual(events.filter((event) => event.startsWith("product readOn")), [`product readOn trace-cache main@${hosts - 1}.gaps.json`, `product readOn trace-cache main@${hosts - 1}.json.gz`]);
  assert.deepEqual(events.filter((event) => event === "product read docs/sources.md"), ["product read docs/sources.md"]);
  assert.equal(subject.paramsFor({ name: "po-opus" }).source, PERSON);
});

// CASE ITM-833-03
// TST-833003 · level: unit · module: MOD-trace-pages
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES
// given: the Host of case 1 without readMany on its Snapshots
// input: the specification route drawn at main, its first group opened, the subject asked for
// expect: the three files of the register are read once each by read, no call is refused, and the subject's source is SRC-acme-person
test("a snapshot without readMany is read file by file as before", async () => {
  const events = [];
  const host = recordingHost({ label: "host", files: { "SPEC.md": SPEC, [GROUP_FILE]: GROUPS, "docs/sources.md": LINKS, ...REGISTER }, events, pinned: true, batching: false });
  const subject = await drawn({ product: host, instance: host });
  assert.deepEqual(register(events).sort(), [`host read docs/sources.md`, `host read ${OTHER_FILE}`, `host read ${PERSON_FILE}`].sort());
  assert.equal(subject.paramsFor({ name: "po-opus" }).source, PERSON);
});

// CASE ITM-833-04
// TST-833004 · level: unit · module: MOD-trace-pages
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES
// given: the Host of case 1, and a ref v1.0 that is not the default branch
// input: the specification route drawn at v1.0, its first group opened
// expect: no call names docs/sources.md or an entry of the register, nothing is told to readMany, and the trace graph for the counts of the groups is the stored one of v1.0, one readOn of ("trace-cache", "v1.0.json.gz")
test("at a released version no file of the register is asked for", async () => {
  const events = [];
  const host = recordingHost({ label: "host", files: { "SPEC.md": SPEC, [GROUP_FILE]: GROUPS, "docs/sources.md": LINKS, ...REGISTER }, events, pinned: true });
  await drawn({ product: host, instance: host, ref: "v1.0" });
  assert.deepEqual(register(events), []);
  assert.deepEqual(events.filter((event) => event.startsWith("host many")), []);
  assert.deepEqual(events.filter((event) => event.startsWith("host readOn")), [`host readOn trace-cache v1.0@${hosts}.gaps.json`, `host readOn trace-cache v1.0@${hosts}.json.gz`]);
});

// An opened requirement (ITM-846): the specification of the cases below holds two requirements that name the person's source, SRC-acme-person, as their source.
const SPEC_TWO = "# Fixture — Specification\n\n## First section\n\n**FIRST RULE** *(SRC-acme-person)*\nFirst rule.\n*Check:* at review.\n\n**SECOND RULE** *(SRC-acme-person)*\nSecond rule.\n*Check:* at review.\n";

// The specification route drawn at `ref`, then each requirement of `names` opened in turn, each waited for until it no longer says it is reading. -> { target, calls } where
// `calls` are the calls the Snapshots received from the opening on (not those of drawing the page).
async function opened({ product, instance, events, ref = "main", names }) {
  const target = document.createElement("div");
  document.body.append(target);
  const context = { page: "review", instance: { repository: "acme/agent-m", host: instance }, product: { address: "https://github.com/acme/library", kind: "github", host: product }, store: {}, go() {} };
  await route.render(target, context, { key: "specification", ref });
  const from = events.length;
  for (const name of names) {
    find(target, (node) => node.localName === "button" && node.textContent === name)[0].dispatchEvent(new Event("click"));
    await until(() => find(target, (node) => node.className === "traces-reading").length === 0);
  }
  return { target, calls: events.slice(from) };
}
const SOURCES_SHOWN = "A person — version 2026-10-11";

// CASE ITM-846-01
// TST-846001 · level: unit · module: MOD-trace-pages
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES
// given: one Host for the product and the instance, which hands the same Snapshot for main each time; that Snapshot holds SPEC.md (two requirements naming SRC-acme-person), docs/sources.md and two register entries
// input: the specification route drawn at main, then the requirement FIRST RULE opened
// expect: of the calls the opening makes that name a file of the register, the first is one readMany of docs/sources.md and the two entries, in that order; the three files are then read once each; the opening told readMany of the register once; known positive: the Sources of the opened requirement read "A person — version 2026-10-11"
test("an opened requirement names the links file and the register entries to readMany together before it reads them", async () => {
  const events = [];
  const host = recordingHost({ label: "host", files: { "SPEC.md": SPEC_TWO, "docs/sources.md": LINKS, ...REGISTER }, events, pinned: true });
  const { target, calls } = await opened({ product: host, instance: host, events, names: ["FIRST RULE"] });
  assert.equal(register(calls)[0], `host many docs/sources.md,${PERSON_FILE},${OTHER_FILE}`);
  assert.deepEqual(register(calls).slice(1).sort(), [`host read docs/sources.md`, `host read ${OTHER_FILE}`, `host read ${PERSON_FILE}`].sort());
  assert.equal(register(calls).filter((event) => event.startsWith("host many")).length, 1);
  assert.ok(target.textContent.includes(SOURCES_SHOWN), "known positive: the sources are shown");
});

// CASE ITM-846-02
// TST-846002 · level: unit · module: MOD-trace-pages
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES
// given: a product Host whose Snapshot at the tag v1.0 holds SPEC.md and docs/sources.md, and an instance Host, another one, whose Snapshot holds the two register entries
// input: the specification route drawn at v1.0, a released version, then the requirement FIRST RULE opened
// expect: the instance's Snapshot is told the two entries in one readMany, before it reads them once each; the product's Snapshot is told no file of the register and reads docs/sources.md once; known positive: the Sources read "A person — version 2026-10-11"
test("an opened requirement at a released version names the register's entries to the instance's snapshot together and reads the links file by itself", async () => {
  const events = [];
  const product = recordingHost({ label: "product", files: { "SPEC.md": SPEC_TWO, "docs/sources.md": LINKS }, events });
  const instance = recordingHost({ label: "instance", files: REGISTER, events });
  const { target, calls } = await opened({ product, instance, events, ref: "v1.0", names: ["FIRST RULE"] });
  const instanceCalls = calls.filter((event) => event.startsWith("instance "));
  assert.equal(instanceCalls[0], `instance many ${PERSON_FILE},${OTHER_FILE}`);
  assert.deepEqual(instanceCalls.slice(1).sort(), [`instance read ${OTHER_FILE}`, `instance read ${PERSON_FILE}`].sort());
  assert.deepEqual(register(calls).filter((event) => event.startsWith("product many")), []);
  assert.deepEqual(calls.filter((event) => event === "product read docs/sources.md"), ["product read docs/sources.md"]);
  assert.ok(target.textContent.includes(SOURCES_SHOWN), "known positive: the sources are shown");
});

// CASE ITM-846-03
// TST-846003 · level: unit · module: MOD-trace-pages
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES
// given: the Host of case 1 without readMany on its Snapshots
// input: the specification route drawn at main, then FIRST RULE opened
// expect: the three files of the register are read once each by read, no call is refused, and the Sources read "A person — version 2026-10-11"
test("an opened requirement on a snapshot without readMany reads the register file by file as before", async () => {
  const events = [];
  const host = recordingHost({ label: "host", files: { "SPEC.md": SPEC_TWO, "docs/sources.md": LINKS, ...REGISTER }, events, pinned: true, batching: false });
  const { target, calls } = await opened({ product: host, instance: host, events, names: ["FIRST RULE"] });
  assert.deepEqual(register(calls).sort(), [`host read docs/sources.md`, `host read ${OTHER_FILE}`, `host read ${PERSON_FILE}`].sort());
  assert.ok(target.textContent.includes(SOURCES_SHOWN), "known positive: the sources are shown");
});

// CASE ITM-846-04
// TST-846004 · level: unit · module: MOD-trace-pages
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES
// given: the Host of case 1
// input: the specification route drawn at main, then FIRST RULE opened and SECOND RULE opened
// expect: the two openings together tell readMany the register once (one call naming docs/sources.md) and read each of its three files once
test("two requirements opened in one drawing name the register to readMany once", async () => {
  const events = [];
  const host = recordingHost({ label: "host", files: { "SPEC.md": SPEC_TWO, "docs/sources.md": LINKS, ...REGISTER }, events, pinned: true });
  const { target, calls } = await opened({ product: host, instance: host, events, names: ["FIRST RULE", "SECOND RULE"] });
  assert.equal(register(calls).filter((event) => event.startsWith("host many")).length, 1);
  assert.deepEqual(register(calls).filter((event) => event.startsWith("host read")).sort(), [`host read docs/sources.md`, `host read ${OTHER_FILE}`, `host read ${PERSON_FILE}`].sort());
  assert.equal(find(target, (node) => node.className === "requirement-opened").filter((node) => node.textContent !== "").length, 2, "known positive: both requirements are open");
});

// CASE ITM-846-05
// TST-846005 · level: unit · module: MOD-trace-pages
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES
// given: the product Host of case 2, and an instance Host whose Snapshot holds no entry of the register
// input: the specification route drawn at v1.0, then FIRST RULE opened
// expect: no call names an entry of the register, docs/sources.md is read once by the product's Snapshot, and the Sources read "SRC-acme-person — no linked version"
test("an opened requirement whose register holds no entry names none to readMany and says its source has no linked version", async () => {
  const events = [];
  const product = recordingHost({ label: "product", files: { "SPEC.md": SPEC_TWO, "docs/sources.md": LINKS }, events });
  const instance = recordingHost({ label: "instance", files: {}, events });
  const { target, calls } = await opened({ product, instance, events, ref: "v1.0", names: ["FIRST RULE"] });
  assert.deepEqual(register(calls), ["product read docs/sources.md"]);
  assert.ok(target.textContent.includes("SRC-acme-person — no linked version"), "the source is named without a linked version");
});
