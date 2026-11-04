// UC-017 as a system path through the Participants settings page: the participant register is opened from the public
// settings route, type-specific controls are filled, Bridge agent discovery/testing is served by fixture handlers, and
// commits are captured by fixture repository hosts. No real network is used.
// Run: node --test tests/system-uc-017-configure-participants.test.mjs
//
// Module: MOD-settings-pages; MOD-participant-list; MOD-bridge-client; MOD-bridge-jobs; MOD-agent-processes
// Guards: UC-017; PARTICIPANTS ARE CONFIGURED ONCE PER INSTANCE; A PARTICIPANT HAS ONE OF FIVE TYPES
// Guards: A PARTICIPANT DECLARES ITS CAPABILITIES; A PARTICIPANT DECLARES WHERE IT PROCESSES DATA
// Guards: A PARTICIPANT BASED ON A LANGUAGE MODEL NAMES ITS MODEL; NO REQUIREMENT IS LEFT OUT OF THE CONTEXT SILENTLY
// Guards: NO COST IS GUESSED; RESTRICTED CONTENT GOES ONLY WHERE ITS SOURCE PERMITS; NO SECRET IN THE REPOSITORY
// Guards: A PERSON'S OWN INPUT IS COMMITTED DIRECTLY; ONE CLICK PER DECISION; EVERY STEP EXPLAINS ITSELF
// Guards: A SELF-HOSTED RUNNER SERVES AGENT M ONLY FROM A PRIVATE REPOSITORY; A BRIDGE BEHIND NAT IS REACHED THROUGH A REVERSE TUNNEL
// Guards: THE BRIDGE FINDS THE INSTALLED AGENTS
// Level: system
//
// The harness copies the local fixture-host pattern of tests/settings-pages-participants.test.mjs so this independent
// system test drives the same public route but does not edit product code or existing tests. Each case states the path it
// guards before it runs. Counter-proof evidence is recorded in the final report.

import "./site-frame-dom.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";

const { view } = await import("../src/settings-pages/index.mjs");
const { openStore, readSetting, writeSetting } = await import("../src/browser-store/index.mjs");
const { readDocument } = await import("../src/documents/index.mjs");
const { participantSchema } = await import("../src/participant-list/index.mjs");

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
const one = (root, name) => {
  const found = byClass(root, name);
  assert.equal(found.length, 1, `exactly one .${name}`);
  return found[0];
};
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
    async page() { const target = document.createElement("div"); document.body.append(target); await route().render(target, context, {}); await settle(); return target; } };
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

async function fillCommon(page, fields) {
  await put(one(page, "participant-name"), fields.name);
  if (fields.model !== undefined) await put(one(page, "participant-model"), fields.model);
  if (fields.context !== undefined) await put(one(page, "participant-context"), fields.context);
  if (fields.price !== undefined) await put(one(page, "participant-price"), fields.price);
  if (fields.place !== undefined) await put(one(page, "participant-place"), fields.place);
}

// TST-375001 · level: system · module: MOD-settings-pages; MOD-participant-list
// guards: UC-017; PARTICIPANTS ARE CONFIGURED ONCE PER INSTANCE; A PARTICIPANT HAS ONE OF FIVE TYPES; A PARTICIPANT DECLARES ITS CAPABILITIES; A PARTICIPANT DECLARES WHERE IT PROCESSES DATA; A PARTICIPANT BASED ON A LANGUAGE MODEL NAMES ITS MODEL; NO COST IS GUESSED; NO SECRET IN THE REPOSITORY; A PERSON'S OWN INPUT IS COMMITTED DIRECTLY; ONE CLICK PER DECISION; EVERY STEP EXPLAINS ITSELF
// given: the public Participants settings route, an empty instance participants register, one configured model endpoint and one Bridge setting
// input: the author adds a person, a model endpoint, a CI agent, a CLI agent and a sandboxed agent, filling the type-specific fields and pressing Save once for each
// expect: each type opens with folded explanations and schemaForm, presets its typical capabilities, commits exactly docs/participants.md with type, model/context/price where required, capabilities, processing place and route, and commits no endpoint key or Bridge token (flow: UC-017 main flow)
test("TST-375001: UC-017 main flow saves each participant type from the Participants page", async (t) => {
  const fixtures = [
    { type: "person", fields: { name: "akmaier" }, account: "github.com/akmaier",
      capabilities: ["draft text", "read the repository", "write to the repository", "run code and tests", "use tools", "reach the web"],
      route: "account github.com/akmaier" },
    { type: "model endpoint", settings: { "endpoint:campus": { url: "https://models.example/v1", kind: "openai-compatible", model: "llama-campus", key: "endpoint-secret" } },
      fields: { name: "campus-model", context: "120000", price: "1.00 / 2.00 EUR per million tokens", place: "FAU data centre (EU)" },
      endpoint: "campus", model: "llama-campus", place: "FAU data centre (EU)", capabilities: ["draft text"], route: "endpoint campus" },
    { type: "CI agent", fields: { name: "ci-writer", model: "gpt-5", context: "200000", price: "2.00 / 8.00 USD per million tokens", place: "GitHub hosted runner" },
      runner: "github-hosted", secret: "MODEL_KEY", model: "gpt-5", place: "GitHub hosted runner",
      capabilities: ["draft text", "read the repository", "write to the repository", "run code and tests", "use tools"],
      route: "ci hosted secret MODEL_KEY" },
    { type: "CLI agent", settings: { "bridge:laptop": { address: "http://127.0.0.1:8787", token: "bridge-token" } },
      fields: { name: "codex-local", model: "codex-cli", context: "200000", place: "this machine" },
      bridge: "laptop", agent: "codex", model: "codex-cli", place: "this machine",
      capabilities: ["draft text", "read the repository", "write to the repository", "run code and tests", "use tools"],
      route: "bridge laptop agent codex" },
    { type: "sandboxed agent", settings: { "bridge:sandbox": { address: "http://127.0.0.1:8788", token: "bridge-token" } },
      fields: { name: "codex-sandbox", model: "codex-sandbox", context: "200000", place: "sandbox vm" },
      bridge: "sandbox", agent: "codex", model: "codex-sandbox", place: "sandbox vm",
      capabilities: ["draft text", "read the repository", "write to the repository", "run code and tests", "use tools"],
      route: "bridge sandbox agent codex" },
  ];

  for (const fixture of fixtures) {
    const b = browser(t, { settings: fixture.settings ?? {} });
    const page = await b.page();
    await addParticipant(page, fixture.type);
    await fillCommon(page, fixture.fields);
    if (fixture.account) await put(one(page, "participant-account"), fixture.account);
    if (fixture.endpoint) await put(one(page, "participant-endpoint"), fixture.endpoint, "change");
    if (fixture.runner) await put(one(page, "participant-runner"), fixture.runner, "change");
    if (fixture.secret) await put(one(page, "participant-secret-name"), fixture.secret);
    if (fixture.bridge) await put(one(page, "participant-bridge"), fixture.bridge, "change");
    if (fixture.agent) await put(one(page, "participant-agent"), fixture.agent);

    assert.equal(byClass(page, "schema-form").length, 1, `${fixture.type}: participant row is edited through schemaForm`);
    assert.ok(folded(page).some((details) => !details.hasAttribute("open") && byTag(details, "summary")[0]?.textContent === "What is this?"),
      `${fixture.type}: a folded What is this? explains the step`);
    assert.match(rowTextOf(page), new RegExp(`\\| ${fixture.fields.name} \\| ${fixture.type.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} \\|`));
    await save(page);

    assert.equal(b.commits.length, 1, `${fixture.type}: one click creates one commit`);
    assert.deepEqual(b.commits[0].files.map((file) => file.path), [PARTICIPANTS], `${fixture.type}: only the register is written`);
    assert.doesNotMatch(b.commits[0].files[0].text, /endpoint-secret|bridge-token/);
    const row = committedRows(b).at(-1);
    assert.equal(row.Name, fixture.fields.name);
    assert.equal(row.Type, fixture.type);
    if (fixture.model === undefined) assert.equal(row.Model ?? "", "", `${fixture.type}: no model is named`);
    else assert.equal(row.Model, fixture.model);
    assert.deepEqual(row.Capabilities, fixture.capabilities);
    if (fixture.place === undefined) assert.equal(row["Processing place"] ?? "", "", `${fixture.type}: no processing place is named`);
    else assert.equal(row["Processing place"], fixture.place);
    assert.equal(row.Route, fixture.route);
    assert.match(one(page, "participants-list").textContent, new RegExp(`${fixture.fields.name}.*${fixture.type}`, "s"));
  }
});

// TST-375002 · level: system · module: MOD-settings-pages; MOD-bridge-client; MOD-bridge-jobs; MOD-agent-processes
// guards: UC-017; THE BRIDGE FINDS THE INSTALLED AGENTS; A BRIDGE BEHIND NAT IS REACHED THROUGH A REVERSE TUNNEL; A PARTICIPANT BASED ON A LANGUAGE MODEL NAMES ITS MODEL; ONE CLICK PER DECISION; NO SECRET IN THE REPOSITORY
// given: this browser keeps a direct Bridge and a Bridge reached through the jump host, and fixture Bridge handlers answer pair, agent-list and probe requests
// input: the author chooses the jump-host Bridge on a CLI participant, lists offered agents, adds a ready agent, names its model, tests it successfully and saves; then another Bridge probe fails and the author chooses Save untested
// expect: only fixture handlers are called; the offered ready agent fills Agent, processing place and route and leaves Model empty for the author to name, since the Bridge reports no model; the probe body names that agent; secrets stay out of the commit; on failure Save is withheld until Save untested (flow: UC-017 main flow step 6 and alternative 6a)
test("TST-375002: UC-017 lists Bridge-offered agents, tests them, and handles Bridge failure 6a", async (t) => {
  const calls = [];
  withFetch(t, async (url, init = {}) => {
    calls.push({ url: String(url), init });
    if (String(url) === "https://jump.example.test/bridge/gpu/v1/pair") return json({ bridge: { name: "gpu", version: "1", platform: "linux" } });
    if (String(url) === "https://jump.example.test/bridge/gpu/v1/agents") return json({ agents: [
      { name: "codex", version: "2.1.0", ready: true, loggedIn: true },
      { name: "claude", version: "3.0.0", ready: false, loggedIn: false },
    ], missing: [{ name: "opencode" }] });
    if (String(url) === "https://jump.example.test/bridge/gpu/v1/probes/agent") return json({ answer: { answered: true, version: "2.1.0" } });
    if (String(url) === "http://127.0.0.1:4711/v1/probes/agent") throw new TypeError("blocked by browser");
    throw new Error(`unexpected request ${url}`);
  });

  const settings = {
    "bridge:laptop": { address: "http://127.0.0.1:4711", token: "laptop-token" },
    "jump-host": { hostname: "jump.example.test", user: "bridge-user", sshPort: 2222, portRange: [40100, 40103],
      httpsAddress: "https://jump.example.test", login: { user: "alice", password: "proxy-password" } },
    "bridge:gpu": { port: 40100, token: "gpu-token" },
  };
  const b = browser(t, { settings });
  let page = await b.page();
  await addParticipant(page, "CLI agent");
  await put(one(page, "participant-name"), "codex-gpu");
  await put(one(page, "participant-bridge"), "gpu", "change");
  await click(one(page, "participant-list-agents"));
  assert.deepEqual(calls.map((call) => [call.url, call.init.method, call.init.headers["x-agent-m-bridge-token"], call.init.headers.Authorization]), [
    ["https://jump.example.test/bridge/gpu/v1/pair", "GET", "gpu-token", `Basic ${Buffer.from("alice:proxy-password").toString("base64")}`],
    ["https://jump.example.test/bridge/gpu/v1/agents", "GET", "gpu-token", `Basic ${Buffer.from("alice:proxy-password").toString("base64")}`],
  ]);
  assert.deepEqual(byClass(page, "participant-agent-offer").map((button) => button.textContent), ["Add codex"]);
  assert.match(one(page, "participant-agent-list-result").textContent, /claude.*not ready|opencode.*missing/s);
  await click(one(page, "participant-agent-offer"));
  assert.equal(one(page, "participant-agent").value, "codex");
  assert.equal(one(page, "participant-model").value, "", "the agent's name is no model; the author names it");
  assert.equal(one(page, "participant-place").value, "gpu Bridge's computer");
  assert.match(rowTextOf(page), /bridge gpu agent codex/);
  await put(one(page, "participant-model"), "gpt-5-codex");
  await click(one(page, "participant-agent-test"));
  assert.deepEqual(JSON.parse(calls[2].init.body), { args: { agent: "codex" } });
  assert.match(one(page, "participant-agent-test-result").textContent, /codex answered \(2\.1\.0\)/);
  await save(page);
  assert.equal(b.commits.length, 1);
  assert.doesNotMatch(b.commits[0].files[0].text, /gpu-token|proxy-password/);
  assert.equal(committedRows(b).at(-1).Route, "bridge gpu agent codex");

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
  assert.equal(failed.commits.length, 0);
  await click(one(page, "participant-save-untested"));
  assert.equal(saveOf(one(page, "participants-form-box")).disabled, false);
  await save(page);
  assert.equal(failed.commits.length, 1);
});

// TST-375003 · level: system · module: MOD-settings-pages
// guards: UC-017; EVERY STEP EXPLAINS ITSELF; NO SECRET IN THE REPOSITORY
// given: the Participants page with no endpoint configured, and the CI-agent form on a self-hosted runner
// input: the author opens the model-endpoint inline form, then opens a CI-agent participant and reads the runner/SSH explanations
// expect: the inline endpoint fields stay on the Participants page and include UC-003's endpoint test request; the CI form explains the SSH-without-runner alternative, naming the SSH key as an Actions secret, internet reachability and the runner recommendation (flow: UC-017 alternative 3a; UC-017 alternative 3b)
test("TST-375003: UC-017 alternatives 3a and 3b are present on the Participants page", async (t) => {
  const missing = [];
  let b = browser(t);
  let page = await b.page();
  await addParticipant(page, "model endpoint");
  const inline = one(page, "participant-endpoint-inline");
  assert.ok(one(page, "participant-endpoint-name"));
  assert.ok(one(page, "participant-endpoint-url"));
  assert.ok(one(page, "participant-endpoint-model"));
  assert.ok(one(page, "participant-endpoint-key"));
  if (!byTag(inline, "button").some((button) => /test/i.test(button.textContent))) {
    missing.push("UC-017 3a: no UC-003 endpoint test request is rendered in the inline endpoint form");
  }
  await put(one(page, "participant-name"), "inline-model");
  await put(one(page, "participant-endpoint-name"), "inline");
  await put(one(page, "participant-endpoint-url"), "https://models.example/v1");
  await put(one(page, "participant-endpoint-model"), "llama-inline");
  await put(one(page, "participant-endpoint-key"), "super-secret");
  await put(one(page, "participant-place"), "EU provider");
  await save(page);
  assert.equal(readSetting(b.store, "endpoint:inline").key, "super-secret");
  assert.doesNotMatch(b.commits[0].files[0].text, /super-secret/);

  b = browser(t);
  page = await b.page();
  await addParticipant(page, "CI agent");
  await put(one(page, "participant-runner"), "self-hosted", "change");
  const text = one(page, "participants-form-box").textContent.replace(/\s+/g, " ");
  if (!/reach an agent behind SSH|SSH key\s+has to be stored as an Actions secret/i.test(text)) {
    missing.push("UC-017 3b: no explanation says the SSH key has to be stored as an Actions secret");
  }
  if (!/reachable from the internet by GitHub's machines/i.test(text)) {
    missing.push("UC-017 3b: no explanation says the SSH host must be reachable from the internet");
  }
  if (!/runner is the recommended way|recommends? the runner/i.test(text)) {
    missing.push("UC-017 3b: no explanation recommends the runner");
  }
  assert.deepEqual(missing, []);
});

// TST-375004 · level: system · module: MOD-settings-pages; MOD-participant-list
// guards: UC-017; RESTRICTED CONTENT GOES ONLY WHERE ITS SOURCE PERMITS; A SELF-HOSTED RUNNER SERVES AGENT M ONLY FROM A PRIVATE REPOSITORY; EVERY STEP EXPLAINS ITSELF
// given: the instance contains a restricted source that permits only FAU data centre (EU), while the author adds a self-hosted CI agent that processes data in US cloud
// input: the CI-agent participant is filled, the self-hosted runner is selected, and Save is pressed
// expect: the folded runner explanation says private repositories only, the form lists the source/place warning before Save, and the participant can still be saved to docs/participants.md (flow: UC-017 alternative 5a)
test("TST-375004: UC-017 alternative 5a names restricted sources and still permits saving", async (t) => {
  const b = browser(t, { visibility: "public", files: {
    "docs/sources/SRC-secret.md": sourceText({ id: "SRC-secret", title: "Secret Source", licence: "restricted - contract",
      places: ["FAU data centre (EU)"] }),
  } });
  const page = await b.page();
  await addParticipant(page, "CI agent");
  await put(one(page, "participant-name"), "ci-private");
  await put(one(page, "participant-model"), "gpt-5");
  await put(one(page, "participant-context"), "200000");
  await put(one(page, "participant-price"), "2.00 / 8.00 USD per million tokens");
  await put(one(page, "participant-runner"), "self-hosted", "change");
  await put(one(page, "participant-runner-label"), "private-lab");
  await put(one(page, "participant-secret-name"), "MODEL_KEY");
  await put(one(page, "participant-place"), "US cloud");

  assert.match(one(page, "participant-runner-explanation").textContent, /self-hosted runner serves private repositories only/i);
  assert.match(one(page, "participant-runner-explanation").textContent, /public/i);
  assert.match(one(page, "participants-form-box").textContent, /SRC-secret/);
  assert.match(one(page, "participants-form-box").textContent, /US cloud/);
  await save(page);
  assert.equal(b.commits.length, 1);
  const row = committedRows(b).at(-1);
  assert.equal(row.Name, "ci-private");
  assert.equal(row["Processing place"], "US cloud");
});

// TST-375005 · level: system · module: MOD-settings-pages; MOD-participant-list
// guards: UC-017; PARTICIPANTS ARE CONFIGURED ONCE PER INSTANCE; NO REQUIREMENT IS LEFT OUT OF THE CONTEXT SILENTLY
// given: two fixture product repositories name participant dev-a in role assignments, and dev-a currently has the capabilities those roles need
// input: the author changes dev-a on the Participants page and removes write to the repository
// expect: the page lists the products and roles that use dev-a, shows the assignment that is now invalid and the missing capability, saves only docs/participants.md, and writes no product repository (flow: UC-017 alternative 7a)
test("TST-375005: UC-017 alternative 7a lists products and invalid role assignments before saving", async (t) => {
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
  const dev = committedRows(b).find((row) => row.Name === "dev-a");
  assert.ok(dev);
  assert.deepEqual(dev.Capabilities, ["read the repository", "run code and tests"]);
});
