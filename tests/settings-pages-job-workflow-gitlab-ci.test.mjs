// The settings page installs Agent M's job workflow on a GitLab product without replacing the product's own .gitlab-ci.yml (ITM-548) —
// MOD-settings-pages' line "whether Agent M's job workflow is installed, with Install" (docs/architecture/MOD-settings-pages.md,
// Interfaces: settings; Files: "Agent M's job workflow files of a product"), which uses MOD-runtimes' jobWorkflowFiles: the
// `.gitlab-ci.yml` it commits is the product's own text with the three additions, every other line kept, so the page passes the
// product's `.gitlab-ci.yml` it reads from the snapshot, the way it reads the other files of the job workflow. Where the include: of
// that file is not a list, the page shows the refusal's message in the job workflow line, offers no Install and writes nothing.
// Run: node --test tests/settings-pages-job-workflow-gitlab-ci.test.mjs
//
// Module: MOD-settings-pages
// Guards: UC-010; UC-027; GITLAB PRODUCTS ARE SUPPORTED; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK
// Level: unit
//
// The repository servers are fixtures in memory: a GitLab product whose snapshot holds the files given, and an instance whose
// participants register has two CI participants. The expected text of the committed `.gitlab-ci.yml` is written in the test. Nothing
// reaches the network. Each test states its input and its expected result before it runs. The counter-proofs are recorded in the
// pull request.

import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { view } from "../src/settings-pages/index.mjs";
import { openStore, writeSetting } from "../src/browser-store/index.mjs";

class Element {
  constructor(name) { this.localName = name; this.childNodes = []; this.className = ""; this.value = ""; this.type = ""; this.checked = false; this.disabled = false; this.attributes = new Map(); this.listeners = []; }
  append(...nodes) { for (const node of nodes.flat()) this.childNodes.push(typeof node === "string" ? new Text(node) : node); }
  replaceChildren(...nodes) { this.childNodes = []; this.append(...nodes); }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  addEventListener(type, listener) { this.listeners.push([type, listener]); }
  fire(type, event = {}) { return Promise.all(this.listeners.filter(([kind]) => kind === type).map(([, listener]) => listener({ type, target: this, currentTarget: this, ...event }))); }
  focus() {}
  get textContent() { return this.childNodes.map((child) => child.textContent).join(""); }
  set textContent(value) { this.replaceChildren(String(value)); }
}
class Text { constructor(value) { this.value = String(value); } get textContent() { return this.value; } }
class Storage {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
  get length() { return this.values.size; }
  key(index) { return [...this.values.keys()][index] ?? null; }
}

globalThis.document = { createElement: (name) => new Element(name) };

function descendants(root, predicate) {
  const found = [];
  (function visit(node) { for (const child of node.childNodes ?? []) { if (child instanceof Element) { if (predicate(child)) found.push(child); visit(child); } } })(root);
  return found;
}
const byClass = (root, name) => descendants(root, (node) => node.className.split(" ").includes(name));
const click = (node, isTrusted = false) => node.fire("click", { isTrusted });
const settingsRoute = () => view.routes.find((candidate) => candidate.name === "settings");

const INSTANCE_COMMIT = "0123456789abcdef0123456789abcdef01234567";
const text = (...lines) => `${lines.join("\n")}\n`;
const PARTICIPANTS = text("# Participants of this instance", "", "**REGISTER**", "",
  "| Name | Type | Model | Context | Price | Capabilities | Processing place | Route |",
  "|---|---|---|---|---|---|---|---|",
  "| hosted-ci | CI agent | gpt-5 | 200000 | — | draft text, read the repository, write to the repository, run code and tests, use tools | GitHub hosted runner | ci hosted secret HOSTED_KEY |");

const instanceHost = {
  async repositoryInfo() { return { defaultBranch: "main", canWrite: true, visibility: "private" }; },
  async readSnapshot() {
    return { commit: INSTANCE_COMMIT, paths: ["docs/participants.md"], blob: () => "b".repeat(40), async read(path) { return path === "docs/participants.md" ? PARTICIPANTS : null; } };
  },
};

function gitlabProduct(writes, initial = {}) {
  const files = new Map(Object.entries(initial));
  let commit = "1".repeat(40);
  const blob = (body) => createHash("sha1").update(`blob ${Buffer.byteLength(body)}\0${body}`).digest("hex");
  return {
    address: "https://gitlab.example.test/fixture/product",
    host: {
      async repositoryInfo() { return { defaultBranch: "main", canWrite: true, visibility: "private" }; },
      async readSnapshot() {
        const opened = new Map(files), head = commit;
        return { commit: head, paths: [...opened.keys()], blob(path) { return opened.has(path) ? blob(opened.get(path)) : null; }, async read(path) { return opened.get(path) ?? null; } };
      },
      async commitFiles(change) {
        writes.push(change);
        for (const file of change.files) files.set(file.path, file.text);
        commit = `${Number.parseInt(commit.slice(0, 8), 16) + 1}`.padStart(40, "0");
        return { commit, url: `https://gitlab.example.test/fixture/product/-/commit/${commit}` };
      },
    },
  };
}

async function renderLine(product) {
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: new Storage() });
  const browserStore = openStore("fixture/instance");
  writeSetting(browserStore, "gitlab-token:gitlab.example.test/fixture/product", { value: "glpat_fixture" });
  const target = document.createElement("div");
  await settingsRoute().render(target, { instance: { repository: "fixture/instance", host: instanceHost }, product, store: browserStore, go() {} }, {});
  click(byClass(target, "settings-tab")[1]);
  return byClass(target, "settings-job-workflow")[0];
}

const OWN = 'stages:\n  - build\n\ninclude:\n  - local: ".gitlab/agent-m-tests.yml"\n\nbuild:\n  stage: build\n  script:\n    - make\n';
const MERGED = 'spec:\n  inputs:\n    job:\n      default: ""\n    task:\n      default: ""\n    endpoint:\n      default: ""\n    secret:\n      default: ""\n---\n'
  + 'stages:\n  - build\n\ninclude:\n  - local: ".gitlab/agent-m-tests.yml"\n'
  + '  - local: ".gitlab/agent-m-jobs.yml"\n    inputs:\n      job: $[[ inputs.job ]]\n      task: $[[ inputs.task ]]\n      endpoint: $[[ inputs.endpoint ]]\n      secret: $[[ inputs.secret ]]\n'
  + '  - local: ".gitlab/agent-m-main-changed.yml"\n'
  + '\nbuild:\n  stage: build\n  script:\n    - make\n';

// TST-548101 · level: unit · module: MOD-settings-pages
// guards: UC-010; UC-027; GITLAB PRODUCTS ARE SUPPORTED; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK
// given: a writable GitLab product whose .gitlab-ci.yml has its own stages, an include list of one entry and a job, and no job workflow
// input: the person opens Repositories, reads the job workflow line, and clicks Install; then the page is opened on the product as committed
// expect: the line says not installed and offers Install; Install is one product commit that writes .gitlab/agent-m-jobs.yml, .gitlab/agent-m-main-changed.yml and a .gitlab-ci.yml whose text is exactly the product's own text with the header, the entry and its three inputs and the entry of .gitlab/agent-m-main-changed.yml added and nothing else changed; on the product as committed the line says installed and offers no Install
test("TST-548101: Install adds the job workflow to a GitLab product's own .gitlab-ci.yml and keeps its other lines", async () => {
  const writes = [];
  const line = await renderLine(gitlabProduct(writes, { ".gitlab-ci.yml": OWN }));
  assert.ok(line, "failure node: the product settings section shows Agent M's job workflow line");
  assert.match(line.textContent, /not installed|different/i);

  await click(byClass(line, "settings-job-workflow-install")[0], true);
  assert.equal(writes.length, 1, "Install is one product commit");
  assert.deepEqual(writes[0].files.map((file) => file.path).sort(), [".gitlab-ci.yml", ".gitlab/agent-m-jobs.yml", ".gitlab/agent-m-main-changed.yml"]);
  assert.equal(writes[0].files.find((file) => file.path === ".gitlab-ci.yml").text, MERGED);

  const committed = Object.fromEntries(writes[0].files.map((file) => [file.path, file.text]));
  const installed = await renderLine(gitlabProduct([], committed));
  assert.match(installed.textContent, /installed/i);
  assert.doesNotMatch(installed.textContent, /not installed|different/i);
  assert.equal(byClass(installed, "settings-job-workflow-install").length, 0, "files that hold the workflow need no Install");
});

// TST-548102 · level: unit · module: MOD-settings-pages
// guards: UC-010; UC-027; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK
// given: a writable GitLab product whose .gitlab-ci.yml has include: as a single string
// input: the person opens Repositories and reads the job workflow line
// expect: the line shows a message that names .gitlab-ci.yml and its include:, offers no Install, and nothing is written
test("TST-548102: an include: that is not a list is shown as a message and offers no Install", async () => {
  const writes = [];
  const line = await renderLine(gitlabProduct(writes, { ".gitlab-ci.yml": 'include: ".gitlab/other.yml"\nbuild:\n  script: make\n' }));
  assert.ok(line, "failure node: the product settings section shows Agent M's job workflow line");
  assert.match(line.textContent, /\.gitlab-ci\.yml/);
  assert.match(line.textContent, /include/);
  assert.equal(byClass(line, "settings-job-workflow-install").length, 0, "no Install is offered");
  assert.equal(writes.length, 0, "nothing is written");
});
