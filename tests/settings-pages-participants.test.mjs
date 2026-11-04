// MOD-settings-pages — the participants route (ITM-352, ITM-353).
// Run: node --test tests/settings-pages-participants.test.mjs
//
// Module: MOD-settings-pages
// Guards: UC-017; PARTICIPANTS ARE CONFIGURED ONCE PER INSTANCE; A PARTICIPANT HAS ONE OF FIVE TYPES
// Guards: A PARTICIPANT DECLARES ITS CAPABILITIES; A PARTICIPANT DECLARES WHERE IT PROCESSES DATA
// Guards: A PARTICIPANT BASED ON A LANGUAGE MODEL NAMES ITS MODEL; RESTRICTED CONTENT GOES ONLY WHERE ITS SOURCE PERMITS
// Guards: A PERSON'S OWN INPUT IS COMMITTED DIRECTLY; NO SECRET IN THE REPOSITORY; EVERY STEP EXPLAINS ITSELF
// Level: unit
//
// The route is driven only through MOD-settings-pages' public view. The DOM is the browser stand-in of tests/site-frame-dom.mjs,
// because the route uses MOD-site-frame's schemaForm and folded explanations. The instance host is local to this file: it
// exposes docs/participants.md and docs/sources/SRC-*.md, and records the one commit saveFile makes.

import "./site-frame-dom.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";

const { view } = await import("../src/settings-pages/index.mjs");
const { openStore, readSetting, writeSetting } = await import("../src/browser-store/index.mjs");
const { readDocument } = await import("../src/documents/index.mjs");
const { participantSchema, participantsOf } = await import("../src/participant-list/index.mjs");

const INSTANCE = "fixture/agent-m";
const PARTICIPANTS = "docs/participants.md";
const VERSION = "a1b2c3d4e5f60718293a4b5c6d7e8f9012345678";
const MODEL_PATH = "docs/process-models/team-scrum.md";
const PRODUCT_ALPHA = "https://github.com/acme/product-alpha";
const PRODUCT_BETA = "https://github.com/acme/product-beta";
const EMPTY_PARTICIPANTS = `# Participants of this instance

| Name | Type | Model | Context | Price | Capabilities | Processing place | Route |
|---|---|---|---|---|---|---|---|
`;
const USED_PARTICIPANTS = `# Participants of this instance

| Name | Type | Model | Context | Price | Capabilities | Processing place | Route |
|---|---|---|---|---|---|---|---|
| alice | person | — | — | — | read the repository, write to the repository | — | account github.com/alice |
| dev-a | CLI agent | codex | 200000 | — | read the repository, write to the repository, run code and tests | this machine | bridge laptop agent codex |
| dev-b | CLI agent | codex | 200000 | — | read the repository, write to the repository, run code and tests | this machine | bridge laptop agent codex |
`;

const INSTANCE_SPEC = "# Fixture instance\n\n## Process\n\nNo process requirement.\n";
const MODEL_TEXT = [
  "---",
  "name: team-scrum",
  "kind: pulled",
  "adapted_from: scrum",
  "measure: remaining items per time box",
  "---",
  "# Scrum with a person as Product Owner",
  "",
  "## Phases",
  "",
  "| Name | Role | Produces |",
  "|---|---|---|",
  "| Sprint Planning | Product Owner | ITM |",
  "| Development | Developers | MOD, TST |",
  "| Sprint Review | Product Owner | sprint record |",
  "| Sprint Retrospective | Scrum Master | sprint record |",
  "",
  "## Transitions",
  "",
  "| From | To | Kind |",
  "|---|---|---|",
  "| Sprint Planning | Development | sequence |",
  "| Development | Sprint Review | sequence |",
  "| Sprint Review | Sprint Retrospective | sequence |",
  "| Sprint Retrospective | Sprint Planning | back |",
  "",
  "## Verification pairs",
  "",
  "| Phase | Checked by |",
  "|---|---|",
  "| Development | Sprint Review |",
  "",
  "## Roles",
  "",
  "| Name | Filled by | How many | Capabilities |",
  "|---|---|---|---|",
  "| Product Owner | person | one | read the repository, write to the repository |",
  "| Scrum Master | either | one | read the repository |",
  "| Developers | agent | several | read the repository, write to the repository, run code and tests |",
  "",
  "## Flow control",
  "",
  "| Kind | Value |",
  "|---|---|",
  "| WIP limit | — |",
  "| Time box | 1 week |",
  "| Sprints | yes |",
  "",
].join("\n");

class Storage {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
  get length() { return this.values.size; }
  key(index) { return [...this.values.keys()][index] ?? null; }
}

function descendants(root, predicate) {
  const found = [];
  (function visit(node) {
    for (const child of node.childNodes ?? []) {
      if (child.nodeType === 1) {
        if (predicate(child)) found.push(child);
        visit(child);
      }
    }
  })(root);
  return found;
}
const byClass = (root, name) => descendants(root, (node) => (node.className ?? "").split(" ").includes(name));
const byTag = (root, name) => descendants(root, (node) => node.localName === name);
const one = (root, name) => { const found = byClass(root, name); assert.equal(found.length, 1, `exactly one .${name}`); return found[0]; };
const settle = () => new Promise((resolve) => setTimeout(resolve, 15));
const fire = async (node, type) => { node.dispatchEvent(new Event(type)); await settle(); };
// A person's click: a browser marks it trusted (`isTrusted`); node marks every Event untrusted, as a script's.
const click = async (node) => { node.dispatchEvent(Object.defineProperty(new Event("click"), "isTrusted", { value: true })); await settle(); };
const put = async (node, value, type = "input") => { node.value = value; await fire(node, type); };
const saveOf = (root) => byTag(root, "button").filter((button) => button.textContent === "Save").at(-1);
const rowTextOf = (root) => byTag(one(root, "participants-form-box"), "textarea")[0].value;
const folded = (root) => byTag(root, "details");
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
function withFetch(t, implementation) {
  const prior = globalThis.fetch;
  globalThis.fetch = implementation;
  t.after(() => { globalThis.fetch = prior; });
}

function route() {
  const found = view.routes.find((candidate) => candidate.name === "participants");
  assert.ok(found, "view exposes the public participants Route");
  assert.equal(found.entry, "settings");
  assert.equal(typeof found.render, "function");
  return found;
}

function blobSha(text) {
  const body = Buffer.from(text, "utf8");
  return createHash("sha1").update(Buffer.from(`blob ${body.length}\0`, "utf8")).update(body).digest("hex");
}

function sourceText({ id, title, licence, places }) {
  return ["---", `id: ${id}`, `title: ${title}`, "kind: document", "authority: normative", `licence: ${licence}`,
    ...(places ? ["places:", ...places.map((place) => `  - ${place}`)] : []), "---", `# ${id} ${title}`, "",
    "## Versions", "", "| Version | Date | Edition | Read from | Files |", "|---|---|---|---|---|",
    "| fixture | 2026-10-13 | — | fixture | listed below |", ""].join("\n");
}

function processText() {
  return [
    "---",
    "model: team-scrum",
    `model_file: ${MODEL_PATH}`,
    `model_version: ${VERSION}`,
    "---",
    "# How the fixture product is developed",
    "",
    "## Practices",
    "",
    "- none",
    "",
    "## Branches",
    "",
    "| Phase or time box | Branch |",
    "|---|---|",
    "",
    "## Definition of Done",
    "",
    "The job rules hold for every pull request; no condition is added.",
    "",
  ].join("\n");
}

function assignmentText(title, rows) {
  return [`# ${title}`, "", "## Roles", "", "| Role | Participants |", "|---|---|",
    ...rows.map(([role, names]) => `| ${role} | ${names.join(", ")} |`), ""].join("\n");
}

function productFiles(assignments) {
  return {
    "docs/process.md": processText(),
    ...Object.fromEntries(Object.entries(assignments).map(([name, rows]) =>
      [`docs/role-assignments/${name}.md`, assignmentText(name, rows)])),
  };
}

function productHost(files, commits) {
  const current = { ...files };
  return {
    repositoryInfo: async () => ({ defaultBranch: "main", visibility: "private", canWrite: true }),
    readSnapshot: async () => ({ commit: "p".repeat(40), paths: Object.keys(current).sort(),
      read: async (path) => current[path] ?? null,
      blob: (path) => current[path] === undefined || current[path] === null ? null : blobSha(current[path]) }),
    commitFiles: async (change) => {
      commits.push(change);
      for (const file of change.files) current[file.path] = file.text;
      return { commit: `${commits.length}`.repeat(40).slice(0, 40) };
    },
    webLinks: () => ({}),
  };
}

function fixtureProductHosts() {
  return {
    [PRODUCT_ALPHA]: productFiles({ "team-one": [
      ["Product Owner", ["alice"]],
      ["Scrum Master", ["alice"]],
      ["Developers", ["dev-a"]],
    ] }),
    [PRODUCT_BETA]: productFiles({ "team-web": [
      ["Product Owner", ["alice"]],
      ["Scrum Master", ["dev-a"]],
      ["Developers", ["alice"]],
    ] }),
  };
}

function instanceProcessFiles() {
  return { "SPEC.md": INSTANCE_SPEC, [MODEL_PATH]: MODEL_TEXT };
}

function browser(t, { files = {}, settings = {}, visibility = "private", products = {} } = {}) {
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: new Storage() });
  const store = openStore(INSTANCE);
  for (const [key, value] of Object.entries(settings)) writeSetting(store, key, value);
  const current = { [PARTICIPANTS]: EMPTY_PARTICIPANTS, ...files };
  const commits = [];
  const productCommits = {};
  const productHosts = Object.fromEntries(Object.entries(products).map(([web, productFiles]) => {
    productCommits[web] = [];
    return [web, productHost(productFiles, productCommits[web])];
  }));
  const host = {
    repositoryInfo: async () => ({ defaultBranch: "main", visibility, canWrite: true }),
    readSnapshot: async () => ({ commit: "h".repeat(40), paths: Object.keys(current).sort(),
      read: async (path) => current[path] ?? null,
      blob: (path) => current[path] === undefined || current[path] === null ? null : blobSha(current[path]) }),
    commitFiles: async (change) => {
      commits.push(change);
      for (const file of change.files) current[file.path] = file.text;
      return { commit: `${commits.length}`.repeat(40).slice(0, 40) };
    },
    webLinks: () => ({}),
  };
  t.after(() => { document.body.replaceChildren(); });
  const context = { page: "review", instance: { repository: INSTANCE, host }, product: null, store, productHosts, go() {} };
  return { store, commits, files: current, context, productCommits,
    async page(params = {}) { const target = document.createElement("div"); document.body.append(target); await route().render(target, context, params); await settle(); return target; } };
}

async function addParticipant(page, type) {
  await click(one(page, "participants-add"));
  assert.equal(byClass(page, "schema-form").length, 0, "the participant type is chosen before the schema form opens");
  await put(one(page, "participant-type"), type, "change");
  return one(page, "participants-form-box");
}

async function save(page) {
  const button = saveOf(one(page, "participants-form-box"));
  assert.ok(button, "schemaForm exposes Save");
  assert.equal(button.disabled, false, "Save is available");
  await click(button);
  await untilSaved(page);
}

// The wait for what a click on Save comes to. The route commits the register with saveFile, which hashes the saved text with
// crypto.subtle.digest (MOD-text-tools' blobSha) on node's threadpool after the commit; only then does it draw the list and keep an
// inline endpoint, and last write the paragraph `participants-result` ("Saved.", or why nothing was saved). So no count of turns or
// milliseconds bounds the click: the wait ends when that paragraph has text, fails by name when it says anything but "Saved.",
// and the deadline only names a page that never settles.
const SETTLES_WITHIN_MS = 10_000;
async function untilSaved(page) {
  const said = () => one(page, "participants-result").textContent;
  const deadline = Date.now() + SETTLES_WITHIN_MS;
  while (said() === "") {
    if (Date.now() > deadline) assert.fail(`waited for the page to say the participant was saved; it said nothing within ${SETTLES_WITHIN_MS} ms`);
    await new Promise((resolve) => setTimeout(resolve, 1));
  }
  assert.equal(said(), "Saved.", "the page says the participant was saved");
}

function rowsOf(text) {
  return readDocument(participantSchema(), PARTICIPANTS, text).sections[0].rows.map((row) => row.cells);
}
const committedRows = (b) => rowsOf(b.commits.at(-1).files.find((file) => file.path === PARTICIPANTS).text);
const changeButton = (root, name) => {
  const button = byClass(root, "participant-change").find((candidate) => candidate.textContent.includes(name));
  assert.ok(button, `change button for ${name}`);
  return button;
};

// TST-352001 · level: unit · module: MOD-settings-pages
// guards: UC-017; PARTICIPANTS ARE CONFIGURED ONCE PER INSTANCE; A PARTICIPANT HAS ONE OF FIVE TYPES; A PARTICIPANT DECLARES ITS CAPABILITIES; A PERSON'S OWN INPUT IS COMMITTED DIRECTLY
// given: the public participants Route, an empty instance register, and browser settings with one endpoint and one Bridge
// input: each of the five participant types is selected, its type-specific fields are filled, and Save is clicked once
// expect: each type is drafted in MOD-site-frame's schemaForm, then saved as one commit of docs/participants.md with one row whose type, capability preset, processing place and route match the controls; no endpoint key is committed; the page lists the saved participant afterwards
test("participants — each participant type is added through the schema form and saved in one commit", async (t) => {
  const fixtures = [
    { type: "person", name: "akmaier", fields: { account: "github.com/akmaier" }, place: undefined,
      capabilities: ["draft text", "read the repository", "write to the repository", "run code and tests", "use tools", "reach the web"],
      route: "account github.com/akmaier" },
    { type: "model endpoint", name: "campus-model", settings: { "endpoint:campus": { url: "https://models.example/v1", kind: "openai-compatible", model: "llama-campus", key: "endpoint-secret" } },
      fields: { endpoint: "campus", place: "FAU data centre (EU)" }, place: "FAU data centre (EU)", capabilities: ["draft text"], route: "endpoint campus" },
    { type: "CI agent", name: "ci-writer", fields: { model: "gpt-5", runner: "github-hosted", secret: "MODEL_KEY", place: "GitHub hosted runner" },
      place: "GitHub hosted runner", capabilities: ["draft text", "read the repository", "write to the repository", "run code and tests", "use tools"], route: "ci hosted secret MODEL_KEY" },
    { type: "CLI agent", name: "codex-local", settings: { "bridge:laptop": { address: "http://127.0.0.1:8787", token: "bridge-token" } },
      fields: { model: "gpt-5", bridge: "laptop", agent: "codex", place: "this machine" },
      place: "this machine", capabilities: ["draft text", "read the repository", "write to the repository", "run code and tests", "use tools"], route: "bridge laptop agent codex" },
    { type: "sandboxed agent", name: "codex-sandbox", settings: { "bridge:sandbox": { address: "http://127.0.0.1:8788", token: "bridge-token" } },
      fields: { model: "gpt-5-mini", bridge: "sandbox", agent: "codex", place: "sandbox vm" },
      place: "sandbox vm", capabilities: ["draft text", "read the repository", "write to the repository", "run code and tests", "use tools"], route: "bridge sandbox agent codex" },
  ];

  for (const fixture of fixtures) {
    const b = browser(t, { settings: fixture.settings ?? {} });
    const page = await b.page();
    const form = await addParticipant(page, fixture.type);
    await put(one(page, "participant-name"), fixture.name);
    if (fixture.fields.account) await put(one(page, "participant-account"), fixture.fields.account);
    if (fixture.fields.endpoint) await put(one(page, "participant-endpoint"), fixture.fields.endpoint, "change");
    if (fixture.fields.model) await put(one(page, "participant-model"), fixture.fields.model);
    if (fixture.fields.runner) await put(one(page, "participant-runner"), fixture.fields.runner, "change");
    if (fixture.fields.secret) await put(one(page, "participant-secret-name"), fixture.fields.secret);
    if (fixture.fields.bridge) await put(one(page, "participant-bridge"), fixture.fields.bridge, "change");
    if (fixture.fields.agent) await put(one(page, "participant-agent"), fixture.fields.agent);
    if (fixture.fields.place) await put(one(page, "participant-place"), fixture.fields.place);
    assert.ok(byClass(form, "schema-form").length === 1 || byClass(page, "schema-form").length === 1, "the route uses schemaForm");
    assert.match(rowTextOf(page), new RegExp(`\\| ${fixture.name} \\| ${fixture.type.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} \\|`));
    await save(page);
    assert.equal(b.commits.length, 1, `${fixture.type}: one commit`);
    assert.deepEqual(b.commits[0].files.map((file) => file.path), [PARTICIPANTS], `${fixture.type}: only the participant register`);
    const row = committedRows(b).at(-1);
    assert.equal(row.Name, fixture.name);
    assert.equal(row.Type, fixture.type);
    assert.deepEqual(row.Capabilities, fixture.capabilities);
    if (fixture.place) assert.equal(row["Processing place"], fixture.place);
    assert.equal(row.Route, fixture.route);
    assert.doesNotMatch(b.commits[0].files[0].text, /endpoint-secret|bridge-token/);
    assert.match(one(page, "participants-list").textContent, new RegExp(`${fixture.name}.*${fixture.type}`, "s"));
  }
});

// TST-352002 · level: unit · module: MOD-settings-pages
// guards: A PARTICIPANT BASED ON A LANGUAGE MODEL NAMES ITS MODEL
// given: a Bridge named laptop and the CLI-agent participant route
// input: the author chooses that Bridge and agent but leaves Model empty
// expect: the route preview names the chosen Bridge, but schemaForm keeps Save disabled because Model is required
test("participants — a CLI agent names its Bridge route, and without a model cannot be saved", async (t) => {
  const b = browser(t, { settings: { "bridge:laptop": { address: "http://127.0.0.1:8787", token: "bridge-token" } } });
  const page = await b.page();
  await addParticipant(page, "CLI agent");
  await put(one(page, "participant-name"), "codex-local");
  await put(one(page, "participant-bridge"), "laptop", "change");
  await put(one(page, "participant-agent"), "codex");
  await put(one(page, "participant-place"), "this machine");
  assert.match(one(page, "participant-route-preview").textContent, /bridge laptop agent codex/);
  assert.match(rowTextOf(page), /bridge laptop agent codex/);
  const button = saveOf(one(page, "participants-form-box"));
  assert.equal(button.disabled, true);
  assert.match(one(page, "participants-form-box").textContent, /Model/);
  assert.deepEqual(b.commits, []);
});

// TST-352003 · level: unit · module: MOD-settings-pages
// guards: UC-003; NO SECRET IN THE REPOSITORY
// given: no model endpoint is configured in this browser
// input: the author chooses model endpoint, fills the UC-003 endpoint fields in place, and saves the participant
// expect: the UC-003 fields are visible in the participants route, the endpoint is kept in the browser, and the committed participant row names the endpoint without committing its key
test("participants — with no configured endpoint, UC-003 endpoint fields open in place and no key is committed", async (t) => {
  const b = browser(t);
  const page = await b.page();
  await addParticipant(page, "model endpoint");
  assert.ok(one(page, "participant-endpoint-inline"));
  await put(one(page, "participant-name"), "inline-model");
  await put(one(page, "participant-endpoint-name"), "inline");
  await put(one(page, "participant-endpoint-url"), "https://models.example/v1");
  await put(one(page, "participant-endpoint-model"), "llama-inline");
  await put(one(page, "participant-endpoint-key"), "super-secret");
  await put(one(page, "participant-place"), "EU provider");
  await save(page);
  assert.equal(readSetting(b.store, "endpoint:inline").key, "super-secret");
  assert.equal(committedRows(b).at(-1).Route, "endpoint inline");
  assert.equal(committedRows(b).at(-1).Model, "llama-inline");
  assert.doesNotMatch(b.commits[0].files[0].text, /super-secret/);
});

// TST-352004 · level: unit · module: MOD-settings-pages
// guards: RESTRICTED CONTENT GOES ONLY WHERE ITS SOURCE PERMITS; EVERY STEP EXPLAINS ITSELF
// given: the instance register has a restricted source allowed only at FAU data centre (EU)
// input: the author chooses a self-hosted CI agent whose processing place is US cloud
// expect: the self-hosted runner explanation is shown folded, and before Save the source that does not allow that place is named
test("participants — self-hosted runners are explained, and source place restrictions are named before save", async (t) => {
  const b = browser(t, { visibility: "public", files: {
    "docs/sources/SRC-secret.md": sourceText({ id: "SRC-secret", title: "Secret Source", licence: "restricted — contract",
      places: ["FAU data centre (EU)"] }),
  } });
  const page = await b.page();
  await addParticipant(page, "CI agent");
  await put(one(page, "participant-name"), "ci-private");
  await put(one(page, "participant-model"), "gpt-5");
  await put(one(page, "participant-runner"), "self-hosted", "change");
  await put(one(page, "participant-secret-name"), "MODEL_KEY");
  await put(one(page, "participant-place"), "US cloud");
  assert.match(one(page, "participant-runner-explanation").textContent, /self-hosted runner serves private repositories only/i);
  assert.match(one(page, "participant-runner-explanation").textContent, /public/i);
  assert.match(one(page, "participants-form-box").textContent, /SRC-secret/);
  assert.match(one(page, "participants-form-box").textContent, /US cloud/);
  const explanations = folded(page);
  assert.ok(explanations.length >= 4, "the route folds its explanations");
  assert.ok(explanations.every((details) => !details.hasAttribute("open")));
  assert.ok(explanations.every((details) => byTag(details, "summary")[0]?.textContent === "What is this?"));
});

// TST-353001 · level: unit · module: MOD-settings-pages
// guards: UC-017; THE BRIDGE FINDS THE INSTALLED AGENTS; A BRIDGE BEHIND NAT IS REACHED THROUGH A REVERSE TUNNEL
// given: this browser keeps one direct Bridge and one Bridge reached through the jump host, and each Bridge reports its offered agents
// input: the author chooses each Bridge on a CLI participant and asks for its agents, then clicks a ready offered agent
// expect: the route calls testBridge for the chosen Bridge only; ready agents are offered as one-click additions; the clicked agent fills Agent, Route and the Bridge computer as Processing place and leaves Model as the author left it, empty, since the Bridge reports no model; missing or not-ready agents are not added
test("participants — offered Bridge agents are listed, and a ready one is added in one click", async (t) => {
  const calls = [];
  withFetch(t, async (url, init = {}) => {
    calls.push({ url: String(url), init });
    if (String(url) === "http://127.0.0.1:4711/v1/pair") return json({ bridge: { name: "laptop", version: "1", platform: "darwin" } });
    if (String(url) === "http://127.0.0.1:4711/v1/agents") return json({ agents: [
      { name: "codex", version: "1.2.3", ready: true, loggedIn: true },
      { name: "claude", version: "2.0.0", ready: false, loggedIn: false },
    ], missing: [{ name: "opencode" }] });
    if (String(url) === "https://jump.example.test/bridge/gpu/v1/pair") return json({ bridge: { name: "gpu", version: "1", platform: "linux" } });
    if (String(url) === "https://jump.example.test/bridge/gpu/v1/agents") return json({ agents: [
      { name: "opencode", version: "0.9.0", ready: true, loggedIn: true },
    ], missing: [] });
    throw new Error(`unexpected request ${url}`);
  });
  const b = browser(t, { settings: {
    "bridge:laptop": { address: "http://127.0.0.1:4711", token: "laptop-token" },
    "jump-host": { hostname: "jump.example.test", user: "bridge-user", sshPort: 2222, portRange: [40100, 40103],
      httpsAddress: "https://jump.example.test", login: { user: "alice", password: "proxy-password" } },
    "bridge:gpu": { port: 40100, token: "gpu-token" },
  } });
  const page = await b.page();
  await addParticipant(page, "CLI agent");
  await put(one(page, "participant-name"), "codex-local");
  await put(one(page, "participant-bridge"), "laptop", "change");
  await click(one(page, "participant-list-agents"));
  assert.deepEqual(calls.map((call) => [call.url, call.init.method, call.init.headers["x-agent-m-bridge-token"]]), [
    ["http://127.0.0.1:4711/v1/pair", "GET", "laptop-token"],
    ["http://127.0.0.1:4711/v1/agents", "GET", "laptop-token"],
  ]);
  assert.deepEqual(byClass(page, "participant-agent-offer").map((button) => button.textContent), ["Add codex"]);
  assert.match(one(page, "participant-agent-list-result").textContent, /claude.*not ready|opencode.*missing/s);
  await click(one(page, "participant-agent-offer"));
  assert.equal(one(page, "participant-agent").value, "codex");
  assert.equal(one(page, "participant-model").value, "");
  assert.equal(one(page, "participant-place").value, "laptop Bridge's computer");
  assert.match(rowTextOf(page), /bridge laptop agent codex/);

  await put(one(page, "participant-bridge"), "gpu", "change");
  await click(one(page, "participant-list-agents"));
  assert.deepEqual(calls.slice(2).map((call) => [call.url, call.init.method, call.init.headers["x-agent-m-bridge-token"], call.init.headers.Authorization]), [
    ["https://jump.example.test/bridge/gpu/v1/pair", "GET", "gpu-token", `Basic ${Buffer.from("alice:proxy-password").toString("base64")}`],
    ["https://jump.example.test/bridge/gpu/v1/agents", "GET", "gpu-token", `Basic ${Buffer.from("alice:proxy-password").toString("base64")}`],
  ]);
  assert.deepEqual(byClass(page, "participant-agent-offer").map((button) => button.textContent), ["Add opencode"]);
  await click(one(page, "participant-agent-offer"));
  assert.equal(one(page, "participant-agent").value, "opencode");
  assert.equal(one(page, "participant-place").value, "gpu Bridge's computer");
});

// TST-353002 · level: unit · module: MOD-settings-pages
// guards: UC-017; ONE CLICK PER DECISION; THE BRIDGE FINDS THE INSTALLED AGENTS; A REMOTE INTERFACE NAMES HOW IT FAILS
// given: a CLI participant row naming a stored Bridge and agent
// input: Test succeeds once; then, on another page, Test cannot reach the Bridge and the author chooses Save untested
// expect: probe is called with kind agent and the selected agent; the successful answer is shown; the failure reason is shown, Save is withheld while the failed test stands, and Save becomes available only after Save untested is clicked
test("participants — Test probes the selected agent, and a failed Bridge test withholds Save until save untested", async (t) => {
  const calls = [];
  withFetch(t, async (url, init = {}) => {
    calls.push({ url: String(url), init });
    if (calls.length === 1) return json({ answer: { answered: true, version: "1.2.3" } });
    throw new TypeError("blocked by browser");
  });
  const settings = { "bridge:laptop": { address: "http://127.0.0.1:4711", token: "laptop-token" } };
  const ok = browser(t, { settings });
  let page = await ok.page();
  await addParticipant(page, "CLI agent");
  await put(one(page, "participant-name"), "codex-local");
  await put(one(page, "participant-model"), "codex");
  await put(one(page, "participant-bridge"), "laptop", "change");
  await put(one(page, "participant-agent"), "codex");
  await put(one(page, "participant-place"), "this machine");
  await click(one(page, "participant-agent-test"));
  assert.equal(calls[0].url, "http://127.0.0.1:4711/v1/probes/agent");
  assert.equal(calls[0].init.method, "POST");
  assert.deepEqual(JSON.parse(calls[0].init.body), { args: { agent: "codex" } });
  assert.match(one(page, "participant-agent-test-result").textContent, /answered|1\.2\.3/);
  await save(page);
  assert.equal(ok.commits.length, 1);

  const failed = browser(t, { settings });
  page = await failed.page();
  await addParticipant(page, "CLI agent");
  await put(one(page, "participant-name"), "codex-local");
  await put(one(page, "participant-model"), "codex");
  await put(one(page, "participant-bridge"), "laptop", "change");
  await put(one(page, "participant-agent"), "codex");
  await put(one(page, "participant-place"), "this machine");
  await click(one(page, "participant-agent-test"));
  assert.match(one(page, "participant-agent-test-result").textContent, /blocked by browser|gave no answer/i);
  assert.equal(saveOf(one(page, "participants-form-box")).disabled, true);
  await click(one(page, "participant-save-untested"));
  assert.equal(saveOf(one(page, "participants-form-box")).disabled, false);
  await save(page);
  assert.equal(failed.commits.length, 1);
});

// TST-354001 · level: unit · module: MOD-settings-pages
// guards: UC-017; A ROLE NAMES THE CAPABILITIES IT NEEDS; PARTICIPANTS ARE CONFIGURED ONCE PER INSTANCE
// given: the browser's product list holds two products whose role assignments name dev-a, and dev-a is in the instance
// input: the author opens Change for dev-a, then removes write to the repository before saving the changed participant
// expect: the participants page lists both products and the roles that name dev-a before Save; after the capability is removed, MOD-product-process' roleAssignmentFindings is shown for the assignment that is now invalid, naming the Developers role and the missing write to the repository capability; Save changes only docs/participants.md
test("participants — changing a used participant lists product roles and invalid assignments before save", async (t) => {
  const products = fixtureProductHosts();
  const b = browser(t, { files: { [PARTICIPANTS]: USED_PARTICIPANTS, ...instanceProcessFiles() },
    settings: { products: [PRODUCT_ALPHA, PRODUCT_BETA] }, products });
  const page = await b.page();
  await click(changeButton(page, "dev-a"));

  let use = one(page, "participant-product-use");
  assert.match(use.textContent, /product-alpha/);
  assert.match(use.textContent, /team-one/);
  assert.match(use.textContent, /Developers/);
  assert.match(use.textContent, /product-beta/);
  assert.match(use.textContent, /team-web/);
  assert.match(use.textContent, /Scrum Master/);

  const write = byClass(page, "participant-capability").find((box) => box.value === "write to the repository");
  assert.ok(write, "write capability checkbox");
  write.checked = false;
  await fire(write, "change");

  use = one(page, "participant-product-use");
  assert.match(use.textContent, /docs\/role-assignments\/team-one\.md/);
  assert.match(use.textContent, /holder dev-a of the role Developers lacks the capability write to the repository/);
  assert.doesNotMatch(use.textContent, /team-web.*lacks the capability write to the repository/s);

  await save(page);
  assert.equal(b.commits.length, 1);
  assert.deepEqual(b.commits[0].files.map((file) => file.path), [PARTICIPANTS]);
  assert.deepEqual(Object.values(b.productCommits), [[], []]);
  const rows = committedRows(b);
  assert.equal(rows.length, 3);
  const dev = rows.find((row) => row.Name === "dev-a");
  assert.ok(dev);
  assert.deepEqual(dev.Capabilities, ["read the repository", "run code and tests"]);
});

// TST-354002 · level: unit · module: MOD-settings-pages
// guards: UC-017; PARTICIPANTS ARE CONFIGURED ONCE PER INSTANCE
// given: the browser's product list holds two products, but none of their role assignments names dev-b
// input: the author opens Change for dev-b and saves the changed participant
// expect: no product-use list is shown for dev-b, and Save still changes docs/participants.md once
test("participants — a participant no product uses saves without the product-use list", async (t) => {
  const products = fixtureProductHosts();
  const b = browser(t, { files: { [PARTICIPANTS]: USED_PARTICIPANTS, ...instanceProcessFiles() },
    settings: { products: [PRODUCT_ALPHA, PRODUCT_BETA] }, products });
  const page = await b.page();
  await click(changeButton(page, "dev-b"));
  assert.equal(byClass(page, "participant-product-use").length, 0);
  await put(one(page, "participant-place"), "lab machine");
  assert.equal(byClass(page, "participant-product-use").length, 0);

  await save(page);
  assert.equal(b.commits.length, 1);
  const dev = committedRows(b).find((row) => row.Name === "dev-b");
  assert.ok(dev);
  assert.equal(dev["Processing place"], "lab machine");
});

// TST-352005 · level: unit · module: MOD-settings-pages
// guards: UC-017; A PARTICIPANT DECLARES WHERE IT PROCESSES DATA
// given: the public participants Route, an empty register, and a Bridge and an endpoint kept in this browser
// input: the author chooses each type in turn and has not typed a processing place
// expect: the place is preset where it can be told — CI agent "GitHub hosted runner", CLI agent "this machine", sandboxed agent "sandbox" — and is empty for a model endpoint, where Agent M cannot tell, and absent for a person; a preset place is changed by typing
test("participants — the processing place is preset by type where it can be told, and changeable", async (t) => {
  const b = browser(t, { settings: { "bridge:laptop": { address: "http://127.0.0.1:8787", token: "bridge-token" },
    "endpoint:campus": { url: "https://models.example/v1", kind: "openai-compatible", model: "llama-campus" } } });
  const page = await b.page();
  const expected = [["CI agent", "GitHub hosted runner"], ["CLI agent", "this machine"], ["sandboxed agent", "sandbox"], ["model endpoint", ""]];
  for (const [type, place] of expected) {
    await addParticipant(page, type);
    assert.equal(one(page, "participant-place").value, place, `${type}: preset processing place`);
  }
  await addParticipant(page, "person");
  assert.equal(byClass(page, "participant-place").length, 0, "a person has no processing place");
  await addParticipant(page, "CLI agent");
  await put(one(page, "participant-place"), "lab machine");
  assert.equal(one(page, "participant-place").value, "lab machine");
  assert.match(rowTextOf(page), /\| lab machine \|/);
});

// TST-352006 · level: unit · module: MOD-settings-pages
// guards: UC-017; A PARTICIPANT HAS ONE OF FIVE TYPES; NO SECRET IN THE REPOSITORY
// given: the public participants Route, an empty register, and the CI-agent form with its runner on the server's machines
// input: the author chooses the self-hosted runner, types the runner's label gpu and the key's secret name MODEL_KEY, saves; and, on another page, leaves the label empty
// expect: no runner-label field while the runner is the server's own; with the self-hosted runner a runner-label field, the route preview "ci runner:gpu secret MODEL_KEY" and, after Save, that route in the committed row; with the label empty Save is withheld
test("participants — a CI agent's route is written in the schema's form, with the runner's label for a self-hosted runner", async (t) => {
  const b = browser(t);
  const page = await b.page();
  await addParticipant(page, "CI agent");
  assert.equal(byClass(page, "participant-runner-label").length, 0, "no label field while the runner is the server's own");
  await put(one(page, "participant-name"), "ci-gpu");
  await put(one(page, "participant-model"), "gpt-5");
  await put(one(page, "participant-secret-name"), "MODEL_KEY");
  assert.equal(one(page, "participant-route-preview").textContent, "ci hosted secret MODEL_KEY");
  await put(one(page, "participant-runner"), "self-hosted", "change");
  assert.equal(one(page, "participant-route-preview").textContent, "", "a self-hosted runner without its label has no route yet");
  assert.equal(saveOf(one(page, "participants-form-box")).disabled, true, "Save is withheld without the label");
  await put(one(page, "participant-runner-label"), "gpu");
  await put(one(page, "participant-place"), "lab machine");
  assert.equal(one(page, "participant-route-preview").textContent, "ci runner:gpu secret MODEL_KEY");
  await save(page);
  assert.equal(b.commits.length, 1);
  assert.equal(committedRows(b).at(-1).Route, "ci runner:gpu secret MODEL_KEY");
  assert.doesNotMatch(b.commits[0].files[0].text, /workflow/);
});

// TST-1019001 · level: unit · module: MOD-settings-pages
// guards: UC-017; A PARTICIPANT HAS ONE OF FIVE TYPES
// given: the public participants Route, an empty register and the CI-agent form, once with the runner on the server's machines and once with the self-hosted runner (which adds the runner's label); every control of the form (its inputs and its selects, the capability boxes among them) is read from the page
// input: for each control in turn, the form is filled with one set of values, the control is changed to another value (a text to another text, a select to its other option, a box toggled), and Save is clicked once
// expect: no control is a Workflow field (no .participant-workflow, no label "Workflow"); known positive: the form holds the name, model, context, price, processing place, runner, key secret name and capability controls (and the runner's label in the self-hosted form); every one of them changes the row that is saved — the row after the change differs from the row saved without it —, so that no field is drawn that is not saved; counter-proof: a control the row does not hold (the Workflow field as it stood) leaves the row as it was, and fails this test
test("participants — every control of a CI agent's form changes the saved row, and no Workflow field is drawn", async (t) => {
  const BASE = { "participant-name": "ci-writer", "participant-model": "gpt-5", "participant-context": "100000", "participant-price": "1 / 2 USD per million tokens",
    "participant-place": "GitHub hosted runner", "participant-secret-name": "MODEL_KEY", "participant-runner-label": "gpu" };
  const OTHER = { "participant-name": "ci-writer-2", "participant-model": "gpt-6", "participant-context": "200000", "participant-price": "3 / 4 USD per million tokens",
    "participant-place": "lab machine", "participant-secret-name": "OTHER_KEY", "participant-runner-label": "lab" };
  const controlsOf = (page) => [...byTag(one(page, "participant-type-fields"), "input"), ...byTag(one(page, "participant-type-fields"), "select")];
  const nameOf = (control, at) => (control.className.split(" ").find((name) => name.startsWith("participant-")) ?? "control") + (control.type === "checkbox" ? `:${control.value}` : "") + `#${at}`;
  async function opened(runner) {
    const b = browser(t);
    const page = await b.page();
    await addParticipant(page, "CI agent");
    if (runner === "self-hosted") await put(one(page, "participant-runner"), "self-hosted", "change");
    for (const control of controlsOf(page)) {
      const given = control.className.split(" ").find((name) => BASE[name] !== undefined);
      if (given) await put(control, BASE[given]);
    }
    return { b, page };
  }
  async function savedRow(runner, change) {
    const { b, page } = await opened(runner);
    if (change) {
      await change(page);
      // A control the change brought in (the runner's label) is filled as the rest are.
      for (const control of controlsOf(page)) {
        const given = control.className.split(" ").find((name) => BASE[name] !== undefined);
        if (given && control.value === "") await put(control, BASE[given]);
      }
    }
    await save(page);
    return JSON.stringify(committedRows(b).at(-1));
  }
  for (const runner of ["github-hosted", "self-hosted"]) {
    const probe = await opened(runner);
    const controls = controlsOf(probe.page);
    const names = controls.map(nameOf);
    assert.equal(byClass(probe.page, "participant-workflow").length, 0, `${runner}: no Workflow field is drawn`);
    assert.equal(byTag(one(probe.page, "participant-type-fields"), "label").some((label) => /^Workflow\b/.test(label.textContent)), false, `${runner}: no label Workflow`);
    for (const known of ["participant-name", "participant-model", "participant-context", "participant-price", "participant-place", "participant-runner", "participant-secret-name"]) {
      assert.equal(names.some((name) => name.startsWith(known)), true, `known positive: ${runner} form holds ${known}`);
    }
    assert.equal(names.some((name) => name.startsWith("participant-runner-label")), runner === "self-hosted", `${runner}: the runner's label belongs to the self-hosted form`);
    const baseline = await savedRow(runner, null);
    for (let at = 0; at < controls.length; at += 1) {
      const row = await savedRow(runner, async (page) => {
        const control = controlsOf(page)[at];
        if (control.type === "checkbox") { control.checked = !control.checked; await fire(control, "change"); return; }
        if (control.localName === "select") {
          const other = byTag(control, "option").map((option) => option.value).find((value) => value !== control.value);
          await put(control, other, "change");
          return;
        }
        const given = control.className.split(" ").find((name) => OTHER[name] !== undefined);
        await put(control, OTHER[given] ?? `${control.value}x`);
      });
      assert.notEqual(row, baseline, `${runner}: changing ${names[at]} changes the saved row`);
    }
  }
});

// TST-1031002 · level: unit · module: MOD-settings-pages
// guards: UC-040; UC-017; ONE SYSTEM IN TWO ROLES IS TWO ENTRIES
// given: the public participants Route and an empty register; this browser keeps no endpoint
// input: the route opened with the parameters type "model endpoint" and address "http://workstation.example.org:8000/v1"
// expect: the form of a new participant is open ("Add participant"), its type reads "model endpoint" and its endpoint URL reads the address — the endpoint is configured inline, as for a browser that keeps none —; the register is not written
test("participants — opened with a type and an address, the form of a new participant shows them filled in", async (t) => {
  const b = browser(t);
  const page = await b.page({ type: "model endpoint", address: "http://workstation.example.org:8000/v1" });
  assert.equal(one(page, "participants-add-panel").hidden, false);
  assert.equal(one(page, "participant-type").value, "model endpoint");
  assert.equal(one(page, "participant-endpoint-url").value, "http://workstation.example.org:8000/v1");
  assert.deepEqual(b.commits, []);
});

// TST-1031003 · level: unit · module: MOD-settings-pages
// guards: UC-040; UC-017
// given: this browser keeps the endpoint campus at https://models.example/v1; and, in another browser, only the endpoint other at https://other.example/v1
// input: the route opened with type "model endpoint" and the address https://models.example/v1; and with the address http://workstation.example.org:8000/v1
// expect: for the address a kept endpoint has, the endpoint is that one (the select reads campus); for an address none has, the endpoint URL of an inline form reads the address, whatever endpoints are kept; and with the type "CLI agent" the form is open with that type
test("participants — the address picks the kept endpoint that has it, or is the URL of a new one", async (t) => {
  const settings = { "endpoint:campus": { url: "https://models.example/v1", kind: "openai-compatible", model: "llama-campus" } };
  const known = await browser(t, { settings }).page({ type: "model endpoint", address: "https://models.example/v1" });
  assert.equal(one(known, "participant-endpoint").value, "campus");
  const unknown = await browser(t, { settings: { "endpoint:other": { url: "https://other.example/v1", kind: "openai-compatible", model: "m" } } })
    .page({ type: "model endpoint", address: "http://workstation.example.org:8000/v1" });
  assert.equal(one(unknown, "participant-endpoint-url").value, "http://workstation.example.org:8000/v1");
  const agent = await browser(t).page({ type: "CLI agent", address: "https://agents.example.org/coder" });
  assert.equal(one(agent, "participants-add-panel").hidden, false);
  assert.equal(one(agent, "participant-type").value, "CLI agent");
});

// TST-1031004 · level: unit · module: MOD-settings-pages
// guards: UC-040; UC-017
// given: the same registers
// input: the route opened with no parameters, with only an address, and with a type no participant has
// expect: counter-proof: the form of a new participant stays closed (hidden), the type empty, and no endpoint URL is drawn — a form without the parameters stays empty
test("participants — without a type and an address the form stays closed and empty", async (t) => {
  for (const params of [{}, { address: "http://workstation.example.org:8000/v1" }, { type: "robot", address: "x" }]) {
    const page = await browser(t).page(params);
    assert.equal(one(page, "participants-add-panel").hidden, true, JSON.stringify(params));
    assert.equal(Boolean(one(page, "participant-type").value), false, JSON.stringify(params));
    assert.equal(byClass(page, "participant-endpoint-url").length, 0, JSON.stringify(params));
  }
});

// TST-352007 · level: unit · module: MOD-settings-pages
// guards: UC-017; PARTICIPANTS ARE CONFIGURED ONCE PER INSTANCE
// given: a register with three CI agents: one on the schema's route "ci runner:gpu secret GPU_KEY", and two saved earlier in the form "workflow agent-m.yml on github-hosted secret OLD_KEY" and "workflow agent-m.yml on self-hosted secret SELF_KEY"
// input: the author opens Change for each
// expect: the runner, the runner's label and the secret are read back from the route — gpu / GPU_KEY, the server's own runner / OLD_KEY, and, for the earlier self-hosted form, the label self-hosted (the label every self-hosted runner has) / SELF_KEY — and the route preview shows each in the schema's form
test("participants — Change reads a CI agent's route in the schema's form and in the form saved earlier", async (t) => {
  const row = (name, route) => `| ${name} | CI agent | gpt-5 | — | — | draft text, read the repository | lab machine | ${route} |`;
  const register = `${EMPTY_PARTICIPANTS}${[
    row("ci-gpu", "ci runner:gpu secret GPU_KEY"),
    row("ci-old", "workflow agent-m.yml on github-hosted secret OLD_KEY"),
    row("ci-old-self", "workflow agent-m.yml on self-hosted secret SELF_KEY"),
  ].join("\n")}\n`;
  const expected = [
    ["ci-gpu", "self-hosted", "gpu", "GPU_KEY", "ci runner:gpu secret GPU_KEY"],
    ["ci-old", "github-hosted", undefined, "OLD_KEY", "ci hosted secret OLD_KEY"],
    ["ci-old-self", "self-hosted", "self-hosted", "SELF_KEY", "ci runner:self-hosted secret SELF_KEY"],
  ];
  for (const [name, runner, label, secret, preview] of expected) {
    const b = browser(t, { files: { [PARTICIPANTS]: register } });
    const page = await b.page();
    await click(changeButton(page, name));
    assert.equal(one(page, "participant-runner").value, runner, `${name}: runner`);
    if (label === undefined) assert.equal(byClass(page, "participant-runner-label").length, 0, `${name}: no label field`);
    else assert.equal(one(page, "participant-runner-label").value, label, `${name}: label`);
    assert.equal(one(page, "participant-secret-name").value, secret, `${name}: secret`);
    assert.equal(one(page, "participant-route-preview").textContent, preview, `${name}: route`);
  }
});

// A subagent is a CLI or sandboxed agent that another CLI agent of the register starts; its route is `through <participant>` (MOD-participant-list, Data: Route; reachedThrough).
const HEAD = "| Name | Type | Model | Context | Price | Capabilities | Processing place | Route |\n|---|---|---|---|---|---|---|---|";
const CAPS = "read the repository, write to the repository, run code and tests";
const AGENTS_REGISTER = `# Participants of this instance\n\n${HEAD}\n`
  + `| alice | person | — | — | — | ${CAPS} | — | account github.com/alice |\n`
  + `| dev-a | CLI agent | codex | 200000 | — | ${CAPS} | this machine | bridge laptop agent codex |\n`
  + `| dev-c | CLI agent | claude | 200000 | — | ${CAPS} | this machine | bridge laptop agent claude |\n`
  + `| box | sandboxed agent | codex | 200000 | — | ${CAPS} | sandbox vm | bridge sandbox agent codex |\n`;
const SUBAGENT_REGISTER = `${AGENTS_REGISTER}| helper | CLI agent | codex | 100000 | — | ${CAPS} | this machine | through dev-a |\n`;
const optionsOf = (select) => byTag(select, "option").map((option) => option.value);

// TST-999001 · level: unit · module: MOD-settings-pages
// guards: UC-017; PARTICIPANTS ARE CONFIGURED ONCE PER INSTANCE
// given: the register lists a person alice, the CLI agents dev-a and dev-c, and the sandboxed agent box; the author adds a CLI agent, and then a sandboxed agent
// input: for each type: name it helper, see that participant-reach offers bridge and through, choose "through", look at the select participant-through, choose dev-a, enter the model and the place, Save
// expect: participant-through offers exactly dev-a and dev-c (the CLI agents of the register — not alice, not the sandboxed agent box); the route preview reads "through dev-a"; no Bridge select, no agent field and no Test is shown; Save is available, makes one commit of docs/participants.md only, and the new row has the chosen type and the Route `through dev-a`; the rows already there are unchanged
test("participants — a CLI or sandboxed agent is saved as a subagent through one of the register's CLI agents", async (t) => {
  for (const type of ["CLI agent", "sandboxed agent"]) {
    const b = browser(t, { files: { [PARTICIPANTS]: AGENTS_REGISTER } });
    const page = await b.page();
    await addParticipant(page, type);
    await put(one(page, "participant-name"), "helper");
    assert.deepEqual(optionsOf(one(page, "participant-reach")), ["bridge", "through"], type);
    assert.equal(byClass(page, "participant-bridge").length, 1, `${type}: the Bridge is offered while it is reached on a Bridge`);
    await put(one(page, "participant-reach"), "through", "change");
    assert.deepEqual(optionsOf(one(page, "participant-through")), ["dev-a", "dev-c"], type);
    await put(one(page, "participant-through"), "dev-a", "change");
    await put(one(page, "participant-model"), "codex");
    await put(one(page, "participant-place"), "this machine");
    assert.equal(one(page, "participant-route-preview").textContent, "through dev-a", type);
    for (const gone of ["participant-bridge", "participant-agent", "participant-list-agents", "participant-agent-test"]) assert.equal(byClass(page, gone).length, 0, `${type}: no .${gone}`);
    await save(page);
    assert.equal(b.commits.length, 1, `${type}: one commit`);
    assert.deepEqual(b.commits[0].files.map((file) => file.path), [PARTICIPANTS]);
    const rows = committedRows(b);
    assert.deepEqual(rows.slice(0, 4).map((row) => [row.Name, row.Route]), [["alice", "account github.com/alice"], ["dev-a", "bridge laptop agent codex"], ["dev-c", "bridge laptop agent claude"], ["box", "bridge sandbox agent codex"]]);
    assert.deepEqual([rows[4].Name, rows[4].Type, rows[4].Route], ["helper", type, "through dev-a"]);
  }
});

// TST-999002 · level: unit · module: MOD-settings-pages
// guards: UC-017
// given: the register holds the subagent helper (a CLI agent, route `through dev-a`) beside alice, dev-a, dev-c and box
// input: open Change for helper; look at the form; change its processing place to "lab machine"; Save
// expect: participant-reach reads "through", participant-through reads "dev-a" and offers exactly dev-a and dev-c (not helper itself, not box, not alice); the route preview reads "through dev-a" and the draft row in the form holds `through dev-a`; no Bridge select is shown; Save is available and makes one commit in which helper has the place "lab machine" and the Route `through dev-a`, and the other four rows are as they were
test("participants — Change keeps a subagent's route through its CLI agent instead of blanking it", async (t) => {
  const b = browser(t, { files: { [PARTICIPANTS]: SUBAGENT_REGISTER } });
  const page = await b.page();
  await click(changeButton(page, "helper"));
  assert.equal(one(page, "participant-reach").value, "through");
  assert.equal(one(page, "participant-through").value, "dev-a");
  assert.deepEqual(optionsOf(one(page, "participant-through")), ["dev-a", "dev-c"]);
  assert.equal(one(page, "participant-route-preview").textContent, "through dev-a");
  assert.match(rowTextOf(page), /\| helper \| CLI agent \| codex \| 100000 \| — \| .* \| this machine \| through dev-a \|/);
  assert.equal(byClass(page, "participant-bridge").length, 0);
  await put(one(page, "participant-place"), "lab machine");
  await save(page);
  assert.equal(b.commits.length, 1);
  const rows = committedRows(b);
  assert.deepEqual(rows.map((row) => row.Name), ["alice", "dev-a", "dev-c", "box", "helper"]);
  const helper = rows.find((row) => row.Name === "helper");
  assert.deepEqual([helper["Processing place"], helper.Route], ["lab machine", "through dev-a"]);
  assert.deepEqual(rows.filter((row) => row.Name !== "helper").map((row) => row.Route),
    ["account github.com/alice", "bridge laptop agent codex", "bridge laptop agent claude", "bridge sandbox agent codex"]);
});

// TST-999003 · level: unit · module: MOD-settings-pages
// guards: UC-017
// given: the same register; dev-a is reached on a Bridge (route `bridge laptop agent codex`), and this browser keeps the Bridge laptop
// input: open Change for dev-a and look at how it is reached; then choose "through" and look at the choices; then choose "bridge" again
// expect: participant-reach first reads "bridge" and the Bridge select is shown (a CLI agent that is no subagent is unchanged); after "through" participant-through offers dev-c and helper but not dev-a itself; after "bridge" the Bridge select is back and the route preview reads "bridge laptop agent codex"
test("participants — a CLI agent reached on a Bridge is offered as a subagent except from itself, and can go back to its Bridge", async (t) => {
  const b = browser(t, { files: { [PARTICIPANTS]: SUBAGENT_REGISTER }, settings: { "bridge:laptop": { address: "http://127.0.0.1:8787", token: "bridge-token" } } });
  const page = await b.page();
  await click(changeButton(page, "dev-a"));
  assert.equal(one(page, "participant-reach").value, "bridge");
  assert.equal(byClass(page, "participant-bridge").length, 1);
  await put(one(page, "participant-reach"), "through", "change");
  assert.deepEqual(optionsOf(one(page, "participant-through")), ["dev-c", "helper"]);
  await put(one(page, "participant-reach"), "bridge", "change");
  assert.equal(byClass(page, "participant-bridge").length, 1);
  assert.equal(one(page, "participant-route-preview").textContent, "bridge laptop agent codex");
});

// ---------------------------------------------------------------- use tools is preset from the endpoint's last test (ITM-998)

const LAST = (tools) => ({ at: "2026-10-19T10:00:00.000Z", outcome: "working", ...(tools === undefined ? {} : { tools }) });
const ENDPOINT_OF = (model) => ({ url: `https://${model}.example/v1`, kind: "openai-compatible", model });
const checkedCapabilities = (page) => byClass(page, "participant-capability").filter((box) => box.checked).map((box) => box.value);
const CALLED_THE_TOOL = { choices: [{ message: { content: null, tool_calls: [{ id: "1", type: "function", function: { name: "agent_m_probe", arguments: "{}" } }] } }] };

// TST-998002 · level: unit · module: MOD-settings-pages
// guards: UC-017; A PARTICIPANT DECLARES ITS CAPABILITIES
// given: this browser keeps three endpoints: one whose last test says the model called the tool (tools true), one whose says it answered in text only (tools false), one never tested; and a fourth whose last test was refused (no tools)
// input: the author adds a participant of the type model endpoint and chooses each endpoint
// expect: with the first, the capability "use tools" is ticked beside "draft text", and the saved row holds both; with the others only "draft text" is ticked and the saved row holds only that
test("participants — a model endpoint's use tools is preset from its endpoint's last test", async (t) => {
  const cases = [["called", LAST(true), ["draft text", "use tools"]], ["text", LAST(false), ["draft text"]], ["fresh", undefined, ["draft text"]],
    ["refused", { at: "2026-10-19T10:00:00.000Z", outcome: "refused" }, ["draft text"]]];
  for (const [name, last, expected] of cases) {
    const settings = { [`endpoint:${name}`]: ENDPOINT_OF(name), ...(last ? { [`last-test:endpoint:${name}`]: last } : {}) };
    const b = browser(t, { settings });
    const page = await b.page();
    await addParticipant(page, "model endpoint");
    assert.equal(one(page, "participant-endpoint").value, name);
    assert.deepEqual(checkedCapabilities(page), expected, `${name}: ticked capabilities`);
    await put(one(page, "participant-name"), `model-${name}`);
    await put(one(page, "participant-place"), "FAU data centre (EU)");
    await save(page);
    assert.deepEqual(committedRows(b).at(-1).Capabilities, expected, `${name}: saved capabilities`);
  }
});

// TST-998003 · level: unit · module: MOD-settings-pages
// guards: UC-017
// given: two kept endpoints, tooled whose last test says tools true and plain whose says tools false; the author adds a model endpoint participant and also ticks "run code and tests" by hand
// input: the endpoint select is changed to plain and back to tooled
// expect: "use tools" is ticked for tooled, unticked for plain and ticked again for tooled; the capability the author ticked by hand stays ticked throughout
test("participants — choosing another endpoint changes use tools with its last test and leaves the other capabilities", async (t) => {
  const settings = { "endpoint:plain": ENDPOINT_OF("plain"), "last-test:endpoint:plain": LAST(false), "endpoint:tooled": ENDPOINT_OF("tooled"), "last-test:endpoint:tooled": LAST(true) };
  const b = browser(t, { settings });
  const page = await b.page();
  await addParticipant(page, "model endpoint");
  await put(one(page, "participant-endpoint"), "tooled", "change");
  const box = (name) => byClass(page, "participant-capability").find((candidate) => candidate.value === name);
  box("run code and tests").checked = true;
  await fire(box("run code and tests"), "change");
  assert.deepEqual(checkedCapabilities(page), ["draft text", "run code and tests", "use tools"]);
  await put(one(page, "participant-endpoint"), "plain", "change");
  assert.deepEqual(checkedCapabilities(page), ["draft text", "run code and tests"]);
  await put(one(page, "participant-endpoint"), "tooled", "change");
  assert.deepEqual(checkedCapabilities(page), ["draft text", "run code and tests", "use tools"]);
});

// TST-998004 · level: unit · module: MOD-settings-pages
// guards: UC-017; UC-003
// given: no endpoint kept, so that the form configures one in place; the endpoint answers the test request with a call of the probe tool (and in a second case with text only)
// input: the author fills the endpoint's name, URL and model and presses Test endpoint
// expect: after a test in which the model called the tool, "use tools" is ticked; after one in which it answered in text only, it is not
test("participants — testing a new endpoint in place presets use tools from that test", async (t) => {
  for (const [answer, expected] of [[CALLED_THE_TOOL, ["draft text", "use tools"]], [{ choices: [{ message: { content: "no tools" } }] }, ["draft text"]]]) {
    withFetch(t, async () => json(answer));
    const b = browser(t);
    const page = await b.page();
    await addParticipant(page, "model endpoint");
    await put(one(page, "participant-endpoint-name"), "inline");
    await put(one(page, "participant-endpoint-url"), "https://models.example/v1");
    await put(one(page, "participant-endpoint-model"), "llama-inline");
    await click(one(page, "participant-endpoint-test"));
    assert.deepEqual(checkedCapabilities(page), expected);
  }
});

// TST-1096001 · level: unit · module: MOD-settings-pages
// guards: UC-017; THE MODEL DETERMINES THE PHASES AND THE GATES; PARTICIPANTS ARE CONFIGURED ONCE PER INSTANCE
// given: two products whose declarations name the model docs/process-models/team-scrum.md at the commit VERSION; an instance that held the model at VERSION with the role Developers needing read, write and run code and tests, and holds it now, on its default branch, with the role needing one more capability, "sign releases"; dev-a holds the first three
// input: the author opens Change for dev-a, unchecks "write to the repository", and the page lists the product use
// expect: the instance was asked for its snapshot at VERSION; the list says that holder dev-a of the role Developers lacks the capability write to the repository, and does not say that it lacks "sign releases" (the model is read as the product declared it, at model_version, not as the instance holds it now)
// Planted fault: reading the instance's current catalogue, as productBasisOf did, adds "sign releases" to what dev-a lacks and never asks for VERSION.
test("participants — each product's roles are read from the model at the version its declaration names", async (t) => {
  const products = fixtureProductHosts();
  const b = browser(t, { files: { [PARTICIPANTS]: USED_PARTICIPANTS, ...instanceProcessFiles(), [MODEL_PATH]: MODEL_TEXT.replace("run code and tests |", "run code and tests, sign releases |") },
    settings: { products: [PRODUCT_ALPHA, PRODUCT_BETA] }, products });
  const asked = [];
  const current = b.context.instance.host.readSnapshot;
  b.context.instance.host.readSnapshot = async (ref) => {
    asked.push(ref);
    if (ref !== VERSION) return current(ref);
    const files = { ...instanceProcessFiles(), [PARTICIPANTS]: USED_PARTICIPANTS };
    return { commit: VERSION, paths: Object.keys(files).sort(), read: async (path) => files[path] ?? null, blob: (path) => (files[path] === undefined ? null : blobSha(files[path])) };
  };
  const page = await b.page();
  await click(changeButton(page, "dev-a"));
  const write = byClass(page, "participant-capability").find((box) => box.value === "write to the repository");
  write.checked = false;
  await fire(write, "change");
  const use = one(page, "participant-product-use");
  assert.ok(asked.includes(VERSION), `the instance was read at ${VERSION}; asked: ${asked.join(", ")}`);
  assert.match(use.textContent, /holder dev-a of the role Developers lacks the capability write to the repository/);
  assert.doesNotMatch(use.textContent, /sign releases/);
});

// ---------------------------------------------------------------- what Add fills from a Bridge or a runner (ITM-1437)

// The Bridge laptop as fixture handlers answer it: it offers claude (ready) and codex (installed, not logged in), and opencode is missing on its computer.
function laptopAnswers(t, calls = []) {
  withFetch(t, async (url, init = {}) => {
    calls.push({ url: String(url), init });
    if (String(url) === "http://127.0.0.1:4711/v1/pair") return json({ bridge: { name: "laptop", version: "1", platform: "darwin" } });
    if (String(url) === "http://127.0.0.1:4711/v1/agents") return json({ agents: [
      { name: "claude", version: "2.1.300", ready: true, loggedIn: true },
      { name: "codex", version: "1.2.3", ready: false, loggedIn: false },
    ], missing: [{ name: "opencode" }] });
    throw new Error("unexpected request " + url);
  });
  return calls;
}
const LAPTOP = { "bridge:laptop": { address: "http://127.0.0.1:4711", token: "laptop-token" } };

// TST-1437001 · level: unit · module: MOD-settings-pages
// guards: UC-017; A PARTICIPANT BASED ON A LANGUAGE MODEL NAMES ITS MODEL
// given: this browser keeps the Bridge laptop, whose answer to List agents offers claude, ready, and names no model for it (the Bridge's GET /v1/agents gives name, version, ready and loggedIn)
// input: the author adds a CLI agent, types the model claude-opus-5-5, presses List agents and Add claude; then, on a second form, presses List agents and Add claude without typing a model, and then names the model claude-sonnet-5-5 and saves
// expect: known positive — Add fills the agent claude, the route bridge laptop agent claude and the place laptop Bridge's computer; the model stays claude-opus-5-5, as the author typed it, and the draft row holds it; on the second form the model stays empty, never claude, the agent's name, and Save is withheld until a model is named; the saved row has the model claude-sonnet-5-5; counter-proof: with Add writing the agent's name into Model, as it did, the field reads claude and the case fails
test("participants — Add of an offered agent leaves the model the author names, never the agent's name", async (t) => {
  laptopAnswers(t);
  const b = browser(t, { settings: LAPTOP });
  const page = await b.page();
  await addParticipant(page, "CLI agent");
  await put(one(page, "participant-name"), "claude-lap");
  await put(one(page, "participant-model"), "claude-opus-5-5");
  await click(one(page, "participant-list-agents"));
  await click(one(page, "participant-agent-offer"));
  assert.deepEqual([one(page, "participant-agent").value, one(page, "participant-route-preview").textContent, one(page, "participant-place").value],
    ["claude", "bridge laptop agent claude", "laptop Bridge's computer"], "known positive: the offered agent is added");
  assert.equal(one(page, "participant-model").value, "claude-opus-5-5", "the model the author typed stays");
  assert.match(rowTextOf(page), /\| claude-lap \| CLI agent \| claude-opus-5-5 \|/);

  await addParticipant(page, "CLI agent");
  await put(one(page, "participant-name"), "claude-lap-2");
  await click(one(page, "participant-list-agents"));
  await click(one(page, "participant-agent-offer"));
  assert.equal(one(page, "participant-agent").value, "claude", "known positive: the agent is added");
  assert.equal(one(page, "participant-model").value, "", "the agent's name is no model");
  assert.equal(saveOf(one(page, "participants-form-box")).disabled, true, "Save is withheld until a model is named");
  await put(one(page, "participant-model"), "claude-sonnet-5-5");
  await save(page);
  assert.deepEqual([committedRows(b).at(-1).Model, committedRows(b).at(-1).Route], ["claude-sonnet-5-5", "bridge laptop agent claude"]);
});

// TST-1437002 · level: unit · module: MOD-settings-pages
// guards: UC-017; A PARTICIPANT DECLARES WHERE IT PROCESSES DATA
// given: the public participants Route and an empty register
// input: the author adds a CI agent and reads the place; chooses a self-hosted runner and reads it; types the runner's label lab and reads it; chooses GitHub's machines again and reads it; then, on another form, types the place lab machine before choosing a self-hosted runner with the label gpu; then saves a self-hosted CI agent with the label lab without touching the place
// expect: known positive — on GitHub's machines the place is GitHub hosted runner; on a self-hosted runner it is that runner's place, self-hosted runner, and with the label lab self-hosted runner lab, never GitHub hosted runner; back on GitHub's machines it is GitHub hosted runner again; a place the author typed is kept whatever the runner; the saved self-hosted row has the place self-hosted runner lab and the route ci runner:lab secret MODEL_KEY; counter-proof: a runner change that leaves the preset of GitHub's machines, as it did, keeps GitHub hosted runner and the case fails
test("participants — a CI agent on a self-hosted runner is preset with that runner's place, not GitHub's", async (t) => {
  const b = browser(t);
  const page = await b.page();
  await addParticipant(page, "CI agent");
  assert.equal(one(page, "participant-place").value, "GitHub hosted runner", "known positive: GitHub's machines");
  await put(one(page, "participant-runner"), "self-hosted", "change");
  assert.equal(one(page, "participant-place").value, "self-hosted runner");
  await put(one(page, "participant-runner-label"), "lab");
  assert.equal(one(page, "participant-place").value, "self-hosted runner lab");
  await put(one(page, "participant-runner"), "github-hosted", "change");
  assert.equal(one(page, "participant-place").value, "GitHub hosted runner");

  await addParticipant(page, "CI agent");
  await put(one(page, "participant-place"), "lab machine");
  await put(one(page, "participant-runner"), "self-hosted", "change");
  await put(one(page, "participant-runner-label"), "gpu");
  assert.equal(one(page, "participant-place").value, "lab machine", "the place the author typed is kept");

  await addParticipant(page, "CI agent");
  await put(one(page, "participant-name"), "ci-lab");
  await put(one(page, "participant-model"), "gpt-5");
  await put(one(page, "participant-secret-name"), "MODEL_KEY");
  await put(one(page, "participant-runner"), "self-hosted", "change");
  await put(one(page, "participant-runner-label"), "lab");
  await save(page);
  const row = committedRows(b).at(-1);
  assert.deepEqual([row["Processing place"], row.Route], ["self-hosted runner lab", "ci runner:lab secret MODEL_KEY"]);
});

// TST-1437003 · level: unit · module: MOD-settings-pages
// guards: UC-017; THE BRIDGE FINDS THE INSTALLED AGENTS
// given: this browser keeps the Bridge laptop, whose answer to List agents offers claude (ready) and codex (not logged in) and names opencode as missing
// input: the author adds a CLI agent with a model and a place, presses List agents and types each of banana, opencode, codex and claude into Agent; saves claude; then adds another CLI agent on the same Bridge and types banana
// expect: known positive — with claude the form says nothing of an agent not offered and Save commits the route bridge laptop agent claude; with codex, which the Bridge offers though it is not logged in, Save is open; with banana and with opencode Save is withheld and the form says that Bridge laptop does not offer it and names claude and codex; on the next form, without listing again, banana is withheld the same way and nothing more is committed; counter-proof: with the agent's field taken as any text, as it was, banana is open to Save and the case fails
test("participants — an agent the listed Bridge does not offer is not saved", async (t) => {
  const calls = laptopAnswers(t);
  const b = browser(t, { settings: LAPTOP });
  const page = await b.page();
  const fill = async (name) => {
    await addParticipant(page, "CLI agent");
    await put(one(page, "participant-name"), name);
    await put(one(page, "participant-model"), "claude-opus-5-5");
    await put(one(page, "participant-place"), "this machine");
  };
  const withheld = () => saveOf(one(page, "participants-form-box")).disabled;
  const said = () => one(page, "participants-form-box").textContent;
  await fill("agent-a");
  await click(one(page, "participant-list-agents"));
  assert.deepEqual(calls.map((call) => call.url), ["http://127.0.0.1:4711/v1/pair", "http://127.0.0.1:4711/v1/agents"]);
  for (const agent of ["banana", "opencode"]) {
    await put(one(page, "participant-agent"), agent);
    assert.equal(withheld(), true, agent + ": Save is withheld");
    assert.ok(said().includes("Bridge laptop does not offer the agent " + agent), agent + ": the form says the Bridge does not offer it");
    assert.match(said(), /claude, codex/);
  }
  await put(one(page, "participant-agent"), "codex");
  assert.equal(withheld(), false, "codex is offered, though not logged in");
  await put(one(page, "participant-agent"), "claude");
  assert.equal(withheld(), false, "known positive: claude is offered");
  assert.doesNotMatch(said(), /does not offer/);
  await save(page);
  assert.equal(committedRows(b).at(-1).Route, "bridge laptop agent claude");

  await fill("agent-b");
  await put(one(page, "participant-agent"), "banana");
  assert.equal(withheld(), true, "the Bridge's listing holds for the next form");
  assert.ok(said().includes("Bridge laptop does not offer the agent banana"));
  assert.equal(b.commits.length, 1, "nothing more is committed");
});

// The participants the list reads from the register the last commit wrote (MOD-participant-list's participantsOf).
const committedParticipants = (b) => participantsOf(readDocument(participantSchema(), PARTICIPANTS,
  b.commits.at(-1).files.find((file) => file.path === PARTICIPANTS).text));

// TST-1438001 · level: unit · module: MOD-settings-pages
// guards: UC-017; NO COST IS GUESSED
// given: the public participants Route and an empty register
// input: the author adds a CI agent with a model and a key's secret and types the price 2.00 / 8.00 into Price; then types 2.00 / 8.00 USD per million tokens and presses Save
// expect: with 2.00 / 8.00 Save is withheld and the form's findings name that price and the form <input> / <output> <currency> per million tokens; nothing is committed; known positive: with 2.00 / 8.00 USD per million tokens no finding names a price, Save commits one row, and the participant list reads its price as 2 and 8 USD; counter-proof: with the price taken as any text, as it was, 2.00 / 8.00 is open to Save and the case fails
test("participants — a price the participant list cannot read is refused, naming the form it reads", async (t) => {
  const b = browser(t);
  const page = await b.page();
  await addParticipant(page, "CI agent");
  await put(one(page, "participant-name"), "ci-priced");
  await put(one(page, "participant-model"), "gpt-5");
  await put(one(page, "participant-secret-name"), "MODEL_KEY");
  const withheld = () => saveOf(one(page, "participants-form-box")).disabled;
  const said = () => byClass(one(page, "participants-form-box"), "findings").map((list) => list.textContent).join(" ");
  await put(one(page, "participant-price"), "2.00 / 8.00");
  assert.equal(withheld(), true, "Save is withheld for a price the list reads as none");
  assert.ok(said().includes("2.00 / 8.00"), "the form names the price it does not read");
  assert.ok(said().includes("<input> / <output> <currency> per million tokens"), "the form names the form it reads");
  assert.deepEqual(b.commits, [], "nothing is committed");
  await put(one(page, "participant-price"), "2.00 / 8.00 USD per million tokens");
  assert.equal(withheld(), false, "known positive: the list's form is open to Save");
  assert.doesNotMatch(said(), /per million tokens/, "known positive: no finding names a price");
  await save(page);
  assert.equal(b.commits.length, 1);
  assert.deepEqual(committedParticipants(b).at(-1).price, { input: 2, output: 8, currency: "USD" }, "known positive: the list reads the saved price");
});

// TST-1438002 · level: unit · module: MOD-settings-pages
// guards: UC-017; NO COST IS GUESSED
// given: the public participants Route and an empty register
// input: the author adds a CI agent with a model and a key's secret, reads the hint of Price, types exactly that hint as the price, and presses Save
// expect: the hint is not empty; typed as it stands, Save commits one row whose price the participant list reads as a price, not as none; counter-proof: the hint as it was, input / output USD per million tokens, is read as none and the case fails
test("participants — the Price field's hint is a price the participant list reads", async (t) => {
  const b = browser(t);
  const page = await b.page();
  await addParticipant(page, "CI agent");
  await put(one(page, "participant-name"), "ci-hinted");
  await put(one(page, "participant-model"), "gpt-5");
  await put(one(page, "participant-secret-name"), "MODEL_KEY");
  const hint = one(page, "participant-price").placeholder;
  assert.notEqual(hint, "", "the Price field shows a hint");
  await put(one(page, "participant-price"), hint);
  await save(page);
  assert.notEqual(committedParticipants(b).at(-1).price, null, `the list reads the hint ${hint} as a price`);
});

// TST-1439001 · level: unit · module: MOD-settings-pages
// guards: UC-017; EVERY STEP EXPLAINS ITSELF
// given: the public participants Route, an empty register and a Bridge laptop kept by this browser
// input: the author adds a CLI agent, then a sandboxed agent, and reads what follows the step Test
// expect: for each, the element right after the Test's result is a folded explanation — summary What is this?, closed — of the topic agent-test: it says the test sends a harmless request through the Bridge and that nothing is saved until the author saves it untested; known positive: the form carries other folds whose summary is What is this?; counter-proof: without explain("agent-test") at the step Test the element after the result is no fold and the case fails
test("participants — the step Test of a CLI or sandboxed agent carries the folded explanation agent-test", async (t) => {
  for (const type of ["CLI agent", "sandboxed agent"]) {
    const b = browser(t, { settings: { "bridge:laptop": { address: "http://127.0.0.1:7801", token: "pairing-token" } } });
    const page = await b.page();
    await addParticipant(page, type);
    assert.ok(folded(page).some((details) => byTag(details, "summary")[0]?.textContent === "What is this?"), `${type}: known positive: the form folds its explanations`);
    const fold = one(page, "participant-agent-test-result").nextSibling;
    assert.equal(fold?.localName, "details", `${type}: the step Test is followed by a fold`);
    assert.equal(fold.hasAttribute("open"), false, `${type}: the fold is closed`);
    assert.equal(byTag(fold, "summary")[0]?.textContent, "What is this?", `${type}: the fold's summary`);
    assert.match(fold.textContent, /harmless request through the Bridge/, `${type}: the fold explains the test`);
    assert.match(fold.textContent, /untested/, `${type}: the fold says nothing is saved until saved untested`);
  }
});
