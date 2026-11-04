// The harness of the system and release tests of UC-027 (Configure continuous integration): the route `schedule` of MOD-test-pages, drawn in the small DOM of tests/site-frame-dom.mjs, over a fixture
// GitHub and a fixture GitLab server — one product repository each, kept in memory, that answers MOD-repository-hosts' interface as the page and MOD-test-schedule call it (repositoryInfo, readSnapshot,
// createBranch, commitFiles, openPullRequest, listCiRuns, ciRunLabels, listTags, mergePullRequest, setPipelineSchedule, webLinks) — and the instance that holds the register of participants. The server keeps its
// commits, branches, tags, pull requests, the runs its CI service started and, on GitLab, the project's pipeline schedules; a commit lands on its branch and a merge moves the default branch, so that a page drawn
// again reads what was merged. The server's pages are those MOD-repository-hosts' own `webLinks` gives for the address (through `connect`, which sends no request). It holds no test and no expected result:
// what it builds are inputs, and every test states its own expected values. Nothing reaches the network.
// Imported by tests/system-uc-027-configure-continuous-integration.test.mjs and tests/release-uc-027-configure-continuous-integration.test.mjs.
//
// Module: MOD-test-pages
// Module: MOD-test-schedule
// Level: system
//
// Authored by developer-opus-e (ITM-772). The product (`shop`) is alice/shop: a README, the resource list naming the paid endpoint oracle with the CI secret ci:ORACLE_KEY, and test files whose
// declarations are three unit tests (one of them calls oracle), one component test, two system tests and one release test. The instance alice/agent-m lists the participants lab-runner (a CI agent with
// "run code and tests" on the self-hosted runner labelled lab), hosted-ci (a CI agent with "run code and tests" on the server's hosted runners) and writer (a CLI agent without it).

import "./site-frame-dom.mjs";
import { createHash } from "node:crypto";
import { until } from "./prompt-bar.d/until.mjs";

const { connect, parseAddress } = await import("../src/repository-hosts/index.mjs");
const { view } = await import("../src/test-pages/index.mjs");

export { until };
export const ADDRESSES = { github: "https://github.com/alice/shop", gitlab: "https://gitlab.example.org/alice/shop" };
export const INSTANCES = { github: "https://github.com/alice/agent-m", gitlab: "https://gitlab.example.org/alice/agent-m" };
export const SCHEDULE = "docs/tests/schedule.md";
export const GENERATED = { github: ".github/workflows/agent-m-tests.yml", gitlab: ".gitlab/agent-m-tests.yml" };
export const lines = (...all) => `${all.join("\n")}\n`;
const blobSha = (text) => createHash("sha1").update(`blob ${Buffer.byteLength(text)}\0`).update(text).digest("hex");
const failure = (name, fields = {}) => Object.assign(new Error(`${name} ${JSON.stringify(fields)}`), { name, ...fields });

// ---------------------------------------------------------------- the instance and the product's files

export const REGISTER = lines("# Participants of this instance", "", "**REGISTER**", "", "The participants of the test instance.", "",
  "| Name | Type | Model | Context | Price | Capabilities | Processing place | Route |", "|---|---|---|---|---|---|---|---|",
  "| lab-runner | CI agent | example-model | 200000 | — | draft text, run code and tests | this machine | ci runner:lab secret LAB_KEY |",
  "| hosted-ci | CI agent | example-model | 200000 | — | draft text, run code and tests | the server | ci hosted secret CI_KEY |",
  "| writer | CLI agent | example-model | 200000 | — | draft text, read the repository | this machine | bridge lab-pc agent claude |");

const RESOURCE_HEAD = ["| Name | Kind | Address | Pin | Licence | Maintainer | Route | Processing place | Paid | Secret |", "|---|---|---|---|---|---|---|---|---|---|"];
/** The product's docs/resources.md holding `rows` (resource rows as Markdown). */
export const resources = (...rows) => lines("# Resources of this product", "", "**REGISTER**", "", "The resources.", "", ...RESOURCE_HEAD, ...rows);
export const ORACLE = "| oracle | endpoint | https://api.example.org/v1 | example-model | — | — | runner:cpu | the vendor | yes | ci:ORACLE_KEY |";

/** A test file's text: one declaration for each entry `[level, paid]`, numbered from `from`; built by join, so that no line of this file is a declaration. */
export const testFile = (entries, from) => entries.map(([level, paid], at) => ["// TST-" + String(from + at).padStart(3, "0") + " · level: " + level + " · module: MOD-store",
  "// guards: A SAMPLE REQUIREMENT", "// given: g", "// input: i", "// expect: e", ...(paid ? ["// paid: " + paid] : []), "test(\"t\", () => {});", ""].join("\n")).join("\n");

/** The schedule file: the front matter `front` (lines), then ## Levels with `rows`, each [row, every commit, pull request, nightly, release candidate, on demand, runs on] with "✓" or "". */
export function scheduleText(rows, front = ["nightly: 02:00"]) {
  return lines("---", ...front, "---", "## Levels", "", "| Row | every commit | pull request | nightly | release candidate | on demand | runs on |", "|---|---|---|---|---|---|---|",
    ...rows.map((cells) => `| ${cells.join(" | ")} |`.replace(/ {2}\|/g, " |")));
}
const T = "✓";
/** The rows of the book's default: unit, component and system on every occasion; paid nightly, on a release candidate and on demand; release and user on a release candidate and on demand. */
export const BOOK_ROWS = () => [["unit", T, T, T, T, T, ""], ["component", T, T, T, T, T, ""], ["system", T, T, T, T, T, ""], ["paid", "", "", T, T, T, ""], ["release", "", "", "", T, T, ""],
  ["user", "", "", "", T, T, ""]];

/** shop({ files }) -> the files of alice/shop, `files` laid over them (a path set to null is left out). */
export function shop(files = {}) {
  const all = { "README.md": "# Shop\n", "docs/resources.md": resources(ORACLE),
    "tests/store.test.mjs": testFile([["unit"], ["unit", "oracle"], ["unit"], ["component"]], 1), "tests/shop.test.mjs": testFile([["system", "oracle"], ["system"], ["release"]], 10), ...files };
  for (const path of Object.keys(all)) if (all[path] === null) delete all[path];
  return all;
}

// ---------------------------------------------------------------- the fixture server

/**
 * server(kind, { files, visibility }) -> the product alice/shop on a fixture GitHub ("github") or GitLab ("gitlab") server: `files` is the tree of the first commit of its default branch main.
 * -> { kind, address, links, host, writes, pulls, runs, labels, schedules, tags, head(ref), tree(ref), ci(commit, state, run), tag(name, commit) }:
 *   writes     every write the host was asked, in its order: [name, ...arguments].
 *   pulls      the pull requests opened; runs the runs the CI service started (CiRun with the branch it ran on); labels the runner labels a run asks for, by its id; schedules the project's pipeline
 *              schedules on GitLab.
 *   tags       the tags of the repository, { name, commit }; tag(name, commit) sets one, which listTags(pattern) answers with * as its only wildcard.
 *   ci(...)    the CI service starts a run on `commit`: `state` (queued, running, success, failure, …), `run` its other fields (event, workflow, started, branch); the default event is the one a pull
 *              request starts on that server, the workflow the generated file's.
 */
export function server(kind, { files = shop(), visibility = "public" } = {}) {
  const address = parseAddress(ADDRESSES[kind]);
  const links = connect(address).webLinks();
  const commits = new Map(), branches = new Map();
  const writes = [], pulls = [], runs = [], labels = {}, schedules = [], tags = [];
  let made = 0, ran = 0;
  const newCommit = (tree) => { made += 1; const sha = createHash("sha1").update(`${kind} commit ${made}`).digest("hex"); commits.set(sha, tree); return sha; };
  branches.set("main", newCommit({ ...files }));
  const commitOf = (ref) => branches.get(ref) ?? (commits.has(ref) ? ref : null);
  const pullUrl = (number) => (kind === "github" ? `${address.web}/pull/${number}` : `${address.web}/-/merge_requests/${number}`);
  const host = {
    async repositoryInfo() { return { defaultBranch: "main", visibility, canWrite: true, archived: false, description: "", greenToMerge: null }; },
    async readSnapshot(ref) {
      const commit = commitOf(ref);
      if (commit === null) throw failure("NotFound", { ref });
      const tree = commits.get(commit);
      return { repository: address, ref, commit, paths: Object.keys(tree).sort(), blob: (path) => (Object.hasOwn(tree, path) ? blobSha(tree[path]) : null),
        read: async (path) => (Object.hasOwn(tree, path) ? tree[path] : null), readMany: async () => {} };
    },
    async createBranch(name, from) {
      writes.push(["createBranch", name, from]);
      if (branches.has(name)) throw failure("Exists", { branch: name });
      if (!commits.has(from)) throw failure("NotFound", { ref: from });
      branches.set(name, from);
    },
    async commitFiles(change) {
      writes.push(["commitFiles", structuredClone(change)]);
      if (branches.get(change.branch) !== change.expectedHead) throw failure("Moved", { head: branches.get(change.branch) ?? null });
      const tree = { ...commits.get(change.expectedHead) };
      for (const file of change.files) { if (file.delete) delete tree[file.path]; else tree[file.path] = file.text; }
      const commit = newCommit(tree);
      branches.set(change.branch, commit);
      return { commit, url: `${address.web}/commit/${commit}` };
    },
    async openPullRequest(request) {
      writes.push(["openPullRequest", structuredClone(request)]);
      const number = 7 + pulls.length;
      const pull = { number, title: request.title, branch: request.branch, base: request.base, head: branches.get(request.branch), mergeCommit: null, state: "open", draft: false,
        url: pullUrl(number), opened: "2026-11-01T10:00:00Z", merged: null, closed: null, body: request.body };
      pulls.push(pull);
      return structuredClone(pull);
    },
    async listCiRuns({ commit, branch, workflow, event, newest } = {}) {
      let found = runs.filter((run) => (commit === undefined || run.commit === commit) && (branch === undefined || run.branch === branch)
        && (event === undefined || run.event === event) && (workflow === undefined || kind === "gitlab" || run.workflow === workflow));
      if (newest) found = [...found].sort((a, b) => String(b.started ?? "").localeCompare(String(a.started ?? ""))).slice(0, newest);
      return found.map(({ branch: _, ...run }) => ({ ...run }));
    },
    async listTags(pattern) {
      const matching = pattern === undefined ? /^/ : new RegExp(`^${pattern.split("*").map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join(".*")}$`);
      return tags.filter((each) => matching.test(each.name)).map((each) => ({ ...each }));
    },
    async ciRunLabels(id) { return [...(labels[id] ?? [])]; },
    async mergePullRequest(number, expectedHead) {
      writes.push(["mergePullRequest", number, expectedHead]);
      const pull = pulls.find((each) => each.number === number);
      if (!pull || pull.state !== "open") throw failure("NotFound", { number });
      if (branches.get(pull.branch) !== expectedHead) throw failure("Moved", { head: branches.get(pull.branch) });
      const merged = newCommit({ ...commits.get(expectedHead) });
      branches.set(pull.base, merged);
      Object.assign(pull, { state: "merged", mergeCommit: merged, merged: "2026-11-01T11:00:00Z", closed: "2026-11-01T11:00:00Z" });
      return { commit: merged };
    },
    async setPipelineSchedule(schedule) {
      writes.push(["setPipelineSchedule", structuredClone(schedule)]);
      if (kind === "github") throw failure("NotSupported", { what: "a pipeline schedule on GitHub" });
      const at = schedules.findIndex((each) => each.description === schedule.description);
      const kept = { id: String(at === -1 ? schedules.length + 1 : schedules[at].id), ...structuredClone(schedule) };
      if (at === -1) schedules.push(kept); else schedules[at] = kept;
      return { id: kept.id, url: links.pipelineSchedules };
    },
    webLinks: () => links,
  };
  const ci = (commit, state, run = {}) => {
    ran += 1;
    const id = String(100 + ran);
    runs.push({ id, workflow: "agent-m-tests.yml", commit, event: kind === "github" ? "pull_request" : "merge_request_event", state, url: links.run(id), started: "2026-11-01T10:05:00Z",
      ended: null, branch: null, ...run });
    return id;
  };
  return { kind, address, links, host, writes, pulls, runs, labels, schedules, tags, ci, tag: (name, commit) => { tags.push({ name, commit }); }, head: (ref = "main") => commitOf(ref), tree: (ref = "main") => ({ ...commits.get(commitOf(ref)) }) };
}

/** The instance alice/agent-m on the server of `kind`, holding the register `register`. */
export function instanceHost(kind, register = REGISTER) {
  const address = parseAddress(INSTANCES[kind]);
  return {
    async repositoryInfo() { return { defaultBranch: "main", visibility: "public", canWrite: true, archived: false, description: "", greenToMerge: null }; },
    async readSnapshot() {
      return { repository: address, ref: "main", commit: "e".repeat(40), paths: ["docs/participants.md"], blob: () => blobSha(register),
        read: async (path) => (path === "docs/participants.md" ? register : null) };
    },
  };
}

// ---------------------------------------------------------------- the page

/** open(world, { register }) -> Promise<Element> — the route schedule drawn for the product of `world` (a `server`), with the person's token stored. */
export async function open(world, { register = REGISTER } = {}) {
  const route = view.routes.find((candidate) => candidate.name === "schedule");
  const context = { page: "main", instance: { repository: "alice/agent-m", host: instanceHost(world.kind, register) }, store: null, go() {},
    product: { address: world.address.web, kind: world.kind, host: world.host, tokenStored: true } };
  const target = document.createElement("div");
  document.body.append(target);
  await route.render(target, context, {});
  return target;
}

export function descendants(root, predicate) {
  const found = [];
  (function visit(node) { for (const child of node?.childNodes ?? []) { if (child.nodeType === 1) { if (predicate(child)) found.push(child); visit(child); } } })(root);
  return found;
}
export const byClass = (root, name) => descendants(root, (node) => (node.className ?? "").split(" ").includes(name));
export const byTag = (root, name) => descendants(root, (node) => node.localName === name);
export const text = (node) => (node?.textContent ?? "").replace(/\s+/g, " ").trim();
export const buttonOf = (root, label) => descendants(root, (node) => node.localName === "button" && node.textContent === label).at(-1);
export const rowOf = (page, row) => descendants(page, (node) => node.localName === "tr" && node.getAttribute("data-row") === row)[0];
export const cellOf = (page, row, column) => descendants(rowOf(page, row), (node) => node.localName === "td" && node.getAttribute("data-column") === column)[0];
export const boxOf = (page, row, column) => byTag(cellOf(page, row, column), "input").find((input) => input.getAttribute("type") === "checkbox");
export const fieldOf = (page, key) => descendants(page, (node) => node.getAttribute?.("data-key") === key)[0];
/** A person's click on `button`, as the page listens for it: a click the browser marks trusted (THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK). */
export const click = (button) => button.dispatchEvent(Object.defineProperty(new Event("click"), "isTrusted", { value: true }));
/** The person changes `control` (a box ticked or not, a choice, a field): its value set, then the event the page listens for. */
export function change(control, value) {
  if (control.getAttribute("type") === "checkbox") { control.checked = value; control.dispatchEvent(new Event("change")); return; }
  control.value = value;
  control.dispatchEvent(new Event(control.localName === "select" ? "change" : "input"));
}
/** Save pressed, and the wait until the pull request and its CI are shown. */
export async function save(page) {
  click(buttonOf(page, "Save"));
  await until(() => byClass(byClass(page, "schedule-proposal")[0], "ci-state").length || byClass(page, "save-failed").length, "the pull request and its CI, or the refusal, shown");
}
export const proposalOf = (page) => byClass(page, "schedule-proposal")[0];
export const writesOf = (world, name) => world.writes.filter(([call]) => call === name);
