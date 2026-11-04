// The Settings page's Install writes Agent M's job workflow in a browser (ITM-1202): MOD-runtimes' jobWorkflowFiles, which the page's
// line "whether Agent M's job workflow is installed, with Install" calls (MOD-settings-pages), gives the job workflow's files where the
// module is loaded as a browser loads it — without a disk, reading its templates workflow/github.yml and workflow/gitlab.yml from its own
// address (MOD-runtimes, Parts; Responsibility: "The page uses it in a browser") —, and one click on Install commits them
// (ONE CLICK PER DECISION). The files the page commits are the ones jobWorkflowFiles gives in Node on the same fixture.
// Run: node --test tests/runtimes-job-workflow-install-browser.test.mjs
//
// Module: MOD-runtimes
// Guards: UC-010; ONE CLICK PER DECISION; A HOSTED JOB AUTHENTICATES ITS AGENT WITH A CI SECRET; A HOSTED JOB WRITES WITH THE PERSON'S TOKEN FROM A CI SECRET
// Level: unit
//
// This file loads src/runtimes/ci.mjs first, at its own address, as a browser loads it: process.getBuiltinModule gives no node:fs, and
// fetch answers each file: address with the real file there, noting it. Both are put back after that load, and only then is the Settings
// page loaded, which imports that same ci.mjs; the modules ci.mjs imports are loaded the same way, as a browser loads them. A second copy
// of ci.mjs, ci.mjs?node, loaded with the disk, gives the expected files. The repository servers are fixtures in memory, as in
// tests/settings-pages-settings-regressions.test.mjs and tests/settings-pages-job-workflow-gitlab-ci.test.mjs. Nothing reaches the network.
// Each test states its input and its expected result before it runs.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

const CI_MODULE = new URL("../src/runtimes/ci.mjs", import.meta.url);
const TEMPLATE_FILES = ["github.yml", "gitlab.yml"].map((name) => new URL(`../src/runtimes/workflow/${name}`, import.meta.url).href);

// ci.mjs, loaded as a browser loads it, before anything else imports it; every address it and its imports fetch as they load.
const fetched = [];
{
  const saved = { getBuiltinModule: process.getBuiltinModule, fetch: globalThis.fetch };
  process.getBuiltinModule = (name) => (name === "node:fs" ? undefined : saved.getBuiltinModule.call(process, name));
  globalThis.fetch = async (url) => {
    fetched.push(String(url));
    return new Response(readFileSync(new URL(url), "utf8"), { status: 200 });
  };
  try {
    await import(CI_MODULE);
  } finally {
    process.getBuiltinModule = saved.getBuiltinModule;
    globalThis.fetch = saved.fetch;
  }
}
const { view } = await import("../src/settings-pages/index.mjs");
const { openStore, writeSetting } = await import("../src/browser-store/index.mjs");
const inNode = await import(new URL("?node", CI_MODULE));

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
  "| hosted-ci | CI agent | gpt-5 | 200000 | — | draft text, read the repository, write to the repository, run code and tests, use tools | hosted runner | ci hosted secret HOSTED_KEY |",
  "| gpu-ci | CI agent | gpt-5 | 200000 | — | draft text, read the repository, write to the repository, run code and tests, use tools | lab GPU runner | ci runner:gpu secret GPU_KEY |");
const instanceHost = {
  async repositoryInfo() { return { defaultBranch: "main", canWrite: true, visibility: "private" }; },
  async readSnapshot() {
    return { commit: INSTANCE_COMMIT, paths: ["docs/participants.md"], blob: () => "b".repeat(40), async read(path) { return path === "docs/participants.md" ? PARTICIPANTS : null; } };
  },
};

// A writable product on `address` with the files given, no job workflow among them; its host notes each commit.
function product(address, writes, initial = {}) {
  const files = new Map(Object.entries(initial));
  let commit = "1".repeat(40);
  const blob = (body) => createHash("sha1").update(`blob ${Buffer.byteLength(body)}\0${body}`).digest("hex");
  return {
    address,
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
        return { commit, url: `${address}/commit/${commit}` };
      },
      async ciVariableScopes() { return []; },
    },
  };
}

async function jobWorkflowLine(chosen, tokenKey) {
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: new Storage() });
  const browserStore = openStore("fixture/instance");
  writeSetting(browserStore, tokenKey, { value: "token_fixture" });
  const target = document.createElement("div");
  await settingsRoute().render(target, { instance: { repository: "fixture/instance", host: instanceHost }, product: chosen, store: browserStore, go() {} }, {});
  click(byClass(target, "settings-tab")[1]);
  return byClass(target, "settings-job-workflow")[0];
}

const INSTANCE = { repository: "fixture/instance", commit: INSTANCE_COMMIT };
const SECRETS = { token: "AGENT_M_TOKEN", keys: ["HOSTED_KEY", "GPU_KEY"] };
const OWN_GITLAB_CI = 'stages:\n  - build\n\ninclude:\n  - local: ".gitlab/agent-m-tests.yml"\n\nbuild:\n  stage: build\n  script:\n    - make\n';

// TST-1202201 · level: unit · module: MOD-runtimes
// guards: UC-010; ONE CLICK PER DECISION; A HOSTED JOB AUTHENTICATES ITS AGENT WITH A CI SECRET; A HOSTED JOB WRITES WITH THE PERSON'S TOKEN FROM A CI SECRET
// given: ci.mjs loaded as a browser loads it, without a disk; the instance fixture/instance at INSTANCE_COMMIT, whose participants register has the CI participants hosted-ci (key HOSTED_KEY) and gpu-ci (runner gpu, key GPU_KEY); a writable GitHub product with no job workflow, and a writable GitLab product whose own .gitlab-ci.yml has stages, an include list and a job
// input: for each product, the person opens Repositories on the Settings page, reads the job workflow line, and clicks Install once
// expect: ci.mjs read workflow/github.yml and workflow/gitlab.yml from its own address with fetch as it loaded; the line says not installed and offers Install; the click is one product commit on main whose files are, path for path and byte for byte, those ci.mjs?node — loaded with the disk — gives for the same server, instance, secrets AGENT_M_TOKEN, HOSTED_KEY and GPU_KEY, the runner gpu and, on GitLab, the product's own .gitlab-ci.yml
test("TST-1202201: in a browser, Install on the Settings page commits the job workflow files Node gives, on GitHub and on GitLab", async () => {
  for (const address of TEMPLATE_FILES) assert.ok(fetched.includes(address), `ci.mjs read ${address} from its own address, as a browser does`);
  const cases = [
    ["github", "https://github.com/fixture/product", "github-token:fixture/product", {}, null],
    ["gitlab", "https://gitlab.example.test/fixture/product", "gitlab-token:gitlab.example.test/fixture/product", { ".gitlab-ci.yml": OWN_GITLAB_CI }, OWN_GITLAB_CI],
  ];
  for (const [server, address, tokenKey, initial, gitlabCi] of cases) {
    const expected = inNode.jobWorkflowFiles(server, INSTANCE, SECRETS, ["gpu"], gitlabCi);
    const writes = [];
    const line = await jobWorkflowLine(product(address, writes, initial), tokenKey);
    assert.ok(line, `${server}: failure node: the product settings section shows Agent M's job workflow line`);
    assert.match(line.textContent, /not installed|different/i, `${server}: ${line.textContent}`);
    const install = byClass(line, "settings-job-workflow-install")[0];
    assert.ok(install, `${server}: the line offers Install: ${line.textContent}`);

    await click(install, true);
    assert.equal(writes.length, 1, `${server}: Install is one product commit`);
    assert.equal(writes[0].branch, "main");
    assert.deepEqual(Object.fromEntries(writes[0].files.map((file) => [file.path, file.text])),
      Object.fromEntries(expected.map((file) => [file.path, file.text])), `${server}: the files committed are those Node gives`);
  }
});
