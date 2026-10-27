// Each place that runs jobs registers, with its job runner, every strategy that the kinds offered there name — so that MOD-job-runner's prepareJob, which checks every strategy a kind
// and its reviewer kind name before anything runs (src/job-runner/prepare.mjs), never refuses an offered kind with UnknownStrategy for a strategy a module builds but the place left out.
//
// Module: MOD-workflow-entries, MOD-site-frame, MOD-prompt-bar, MOD-desktop-shell
// Guards: ONE DEFINITION, THREE DRIVERS; AGENT M WORKS WITHOUT A LOCAL INSTALLATION
// Level: component
//
// The places, each a program of its own, each run here in a child process of its own, since the registry lives for the life of a program:
//   - CI: a product's job workflow on the agent's machine, composed by MOD-workflow-entries' composeProduct (src/workflow-entries/compose.mjs) with `job.part` `agent`, as onRecordsChanged
//     and onDispatch compose it before they prepare a job;
//   - the tab: each entry page, its views read from the `data-views` of the script tag that starts it (index.html, docs/index.html), loaded with MOD-site-frame's loadView and registered
//     with registerViews — what start.mjs and dashboard-app.mjs do —, which also registers MOD-prompt-bar's handOverStrategies;
//   - the Bridge: MOD-desktop-shell's registerBridgeStrategiesOnce.
// The kinds offered at a place are read from the catalogue (MOD-job-catalogue's kindNames): every kind, except, in CI, on the main page and on the Bridge, the mail kinds propose-issues,
// rewrite-without-persons and draft-replies, whose strategies MOD-workflow-entries and MOD-desktop-shell state are not registered ("no mail reaches CI"; "a mail kind runs in the page") and
// which only the dashboard's maintenance pages start. A strategy a module builds is one of the sets the module files' `provides` name (`…Strategies`), imported from the module's index.mjs; a
// strategy no module builds yet — a writer or recipe another item adds — cannot be registered anywhere, and is reported apart, never as a registration a place left out.
// Whether a name is registered is shown through the runner's own refusal, as the neighbouring tests show it: registering a new strategy under the name throws DuplicateStrategy naming the
// owner that registered it first. The probe is first shown to detect a name no module offers (a known positive). No request is made: the child's fetch throws.
// Planted fault (counter-proof, run while writing this test): removing ["MOD-result-records", resultRecords, "resultStrategies"] from compose.mjs' OFFERED makes the CI test fail, naming
// propose-tests, write-tests and run-tests with test-selection, test-proposals, commit-and-levels and result-record; removing resultStrategies from handOverStrategies makes the main
// page's test fail the same way; removing resourceStrategies from the Bridge's STRATEGIES makes the Bridge's test fail naming resource-pins and resource-check.

import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const MAIL_KINDS = ["propose-issues", "rewrite-without-persons", "draft-replies"];

// The child: registers as the place does, then probes every strategy each offered kind and its reviewer kind name. Prints { probe, kinds: { <kind>: { missing, unbuilt } } }.
const CHILD = String.raw`
const [root, place, arg] = process.argv.slice(1);
const at = (path) => new URL(path, "file://" + root).href;
globalThis.fetch = async () => { throw new Error("registering and probing make no request"); };
const fs = await import("node:fs");
const { registerStrategies } = await import(at("src/job-runner/index.mjs"));
const { kindNames, kindOf } = await import(at("src/job-catalogue/index.mjs"));
const { readDocument, loadSchema } = await import(at("src/documents/index.mjs"));

if (place === "ci") {
  const { composeProduct } = await import(at("src/workflow-entries/compose.mjs"));
  composeProduct({ entry: "onRecordsChanged", service: "github", event: { name: "push", payload: null }, checkout: "/nonexistent/product", repository: "https://github.com/acme/product",
    branch: "main", agentM: { commit: "a".repeat(40) }, token: null, now: new Date("2026-10-27T08:00:00Z"),
    job: { runner: "hosted", productDir: "/nonexistent/product", instanceDir: "/nonexistent/instance", actor: "alice", runUrl: null, tokenName: "AGENT_M_TOKEN", personToken: null,
      keys: {}, summaryFile: null, part: "agent", resultDir: arg, agentKey: null, modelUser: null, keyHolder: null, outputFile: null } });
} else if (place === "bridge") {
  const { registerBridgeStrategiesOnce } = await import(at("src/desktop-shell/compose.mjs"));
  registerBridgeStrategiesOnce();
} else {
  const html = fs.readFileSync(root + arg, "utf8");
  const tag = /<script\b[^>]*\bsrc="[^"]*(?:start|dashboard-app)\.mjs"[^>]*>/s.exec(html)?.[0] ?? "";
  const slugs = (/data-views="([^"]*)"/.exec(tag)?.[1] ?? "").split(/\s+/).filter(Boolean);
  if (!slugs.length) throw new Error(arg + ": no script tag that starts the page names its views");
  const { loadView } = await import(at("src/site-frame/routing.mjs"));
  const { registerViews } = await import(at("src/site-frame/register.mjs"));
  const views = [];
  for (const slug of slugs) views.push([slug, await loadView(slug)]);
  registerViews(views);
}

// Whether a module registered the name: a new strategy under it is refused, naming another owner first. A name the probe takes is registered under the probe from then on.
const PROBE = "probe-of-this-test";
function registeredByModule(category, name) {
  try {
    registerStrategies(PROBE, { [category]: { [name]: async () => [] } });
    return false;
  } catch (error) {
    if (error.name !== "DuplicateStrategy") throw error;
    return error.owners[0] !== PROBE;
  }
}

// Every strategy some module builds: the sets the module files provide (MOD-job-runner's registerStrategies is the registry, no set), from the module's folder.
const built = new Map();
for (const file of fs.readdirSync(root + "docs/architecture").filter((name) => name.startsWith("MOD-"))) {
  const text = fs.readFileSync(root + "docs/architecture/" + file, "utf8");
  const front = /^---\n([\s\S]*?)\n---/.exec(text)?.[1] ?? "";
  const folder = /^folder:\s*(\S+)/m.exec(front)?.[1];
  const provides = (/^provides:\n((?:  - .*\n?)*)/m.exec(front)?.[1] ?? "").split("\n").map((line) => line.replace(/^  - /, "").trim()).filter((name) => /^(?!register)[a-z]\w*Strategies$/.test(name));
  if (!folder || !provides.length) continue;
  const module = await import(at(folder.replace(/\/?$/, "/") + "index.mjs"));
  for (const name of provides) {
    const value = module[name];
    const sets = typeof value === "function" ? [value({})] : Array.isArray(value) ? value : value ? [value] : [];
    for (const set of sets) for (const [category, strategies] of Object.entries(set)) for (const strategy of Object.keys(strategies ?? {})) built.set(category + ":" + strategy, true);
  }
}

const named = (kind) => [...kind.preconditions.map((name) => ["preconditions", name]), ...kind.recipes.map(({ name }) => ["recipes", name]),
  ...kind.checks.map((name) => ["checks", name]), ...kind.steps.map((name) => ["steps", name]), ["writers", kind.writer]];
const probe = registeredByModule("recipes", "a-name-no-module-offers");
const kinds = {};
for (const name of await kindNames()) {
  const kind = await kindOf(name);
  const definitions = [kind, kind.reviewer ? await kindOf(kind.reviewer) : null].filter(Boolean);
  const missing = [], unbuilt = [];
  for (const [category, strategy] of definitions.flatMap(named)) {
    if (registeredByModule(category, strategy)) continue;
    (built.has(category + ":" + strategy) ? missing : unbuilt).push(category + " " + strategy);
  }
  kinds[name] = { missing: [...new Set(missing)], unbuilt: [...new Set(unbuilt)] };
}
console.log(JSON.stringify({ probe, kinds }));
`;

function atPlace(place, arg = "") {
  return JSON.parse(execFileSync(process.execPath, ["--input-type=module", "-e", CHILD, ROOT, place, arg], { cwd: ROOT, encoding: "utf8", timeout: 60000, stdio: ["ignore", "pipe", "pipe"] }));
}

// The kinds offered at the place whose strategies a module builds but the place did not register, each with those names; and the probe's known positive.
function leftOut(result, offered) {
  assert.equal(result.probe, false, "failure node: the probe finds a name no module offers unregistered (known positive)");
  return Object.fromEntries(Object.entries(result.kinds).filter(([kind, { missing }]) => offered(kind) && missing.length).map(([kind, { missing }]) => [kind, missing]));
}
const notMail = (kind) => !MAIL_KINDS.includes(kind);

// TST-1281001 · level: component · module: MOD-workflow-entries
// guards: ONE DEFINITION, THREE DRIVERS; AGENT M WORKS WITHOUT A LOCAL INSTALLATION
// given: a product's job workflow on the agent's machine, composed with composeProduct (job.part `agent`, a result folder already prepared), in a program of its own
// input: every kind of the catalogue but the mail kinds propose-issues, rewrite-without-persons and draft-replies; for each, every strategy it and its reviewer kind name
// expect: every such strategy that a module builds is registered — none is left out, so that prepareJob refuses no such kind with UnknownStrategy (propose-tests, run-tests, write-tests,
//   implement, refactor, fix-bug, check-resource, decide-gate and set-up-ci among them); the probe finds a name no module offers unregistered
test("TST-1281001 the CI agent's machine registers every strategy a module builds for the kinds offered in CI", () => {
  const resultDir = mkdtempSync(join(tmpdir(), "agent-m-places-"));
  try {
    writeFileSync(join(resultDir, "deferred.json"), JSON.stringify({ pullRequests: [], ends: [] }));
    assert.deepEqual(leftOut(atPlace("ci", resultDir), notMail), {});
  } finally {
    rmSync(resultDir, { recursive: true, force: true });
  }
});

// TST-1281002 · level: component · module: MOD-prompt-bar
// guards: ONE DEFINITION, THREE DRIVERS
// given: the main page (index.html) as start.mjs registers it — its views from its script tag's data-views, loaded with loadView, registered with registerViews, which adds the bar's handOverStrategies —, in a program of its own
// input: every kind of the catalogue but the mail kinds, which a hand-over of the bar prepares in the tab before it queues the job; for each, every strategy it and its reviewer kind name
// expect: every such strategy that a module builds is registered; the probe finds a name no module offers unregistered
test("TST-1281002 the main page registers every strategy a module builds for the kinds a hand-over prepares", () => {
  assert.deepEqual(leftOut(atPlace("tab", "index.html"), notMail), {});
});

// TST-1281003 · level: component · module: MOD-site-frame
// guards: ONE DEFINITION, THREE DRIVERS
// given: the dashboard (docs/index.html) as dashboard-app.mjs registers it — every view its script tag names, and MOD-prompt-bar's handOverStrategies —, in a program of its own
// input: every kind of the catalogue, the mail kinds included, which the maintenance pages start; for each, every strategy it and its reviewer kind name
// expect: every such strategy that a module builds is registered; the probe finds a name no module offers unregistered
test("TST-1281003 the dashboard registers every strategy a module builds for every kind", () => {
  assert.deepEqual(leftOut(atPlace("tab", "docs/index.html"), () => true), {});
});

// TST-1281004 · level: component · module: MOD-desktop-shell
// guards: ONE DEFINITION, THREE DRIVERS
// given: the Bridge's job runner as registerBridgeStrategiesOnce fills it, in a program of its own
// input: every kind of the catalogue but the mail kinds; for each, every strategy it and its reviewer kind name
// expect: every such strategy that a module builds is registered; the probe finds a name no module offers unregistered
test("TST-1281004 the Bridge registers every strategy a module builds for the kinds a Bridge runs", () => {
  assert.deepEqual(leftOut(atPlace("bridge"), notMail), {});
});
