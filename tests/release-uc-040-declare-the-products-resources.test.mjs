// Independent release tests of UC-040 Declare the product's resources: the main flow for a repository, a compute resource on a Bridge and a compute resource on a runner, and the alternatives 1b, 2c, 3a, 7a, 9a
// and 9b, through MOD-site-frame's frame and MOD-settings-pages' routes `resources` and `resources/instance`, against MOD-repository-hosts' real GitHub host answered by a fake of fetch, and a fake Bridge; and the
// release-level trace from every requirement UC-040 realises to the executable evidence that checks it. Written by developer-sonnet-f, who built none of the route (ITM-642, ITM-996, ITM-960, ITM-1040: RELEASE
// TESTS ARE NOT WRITTEN BY THE IMPLEMENTER). Each test states its input and its expected result in its own text (given / input / expect); every expected value is taken from the use case's step as quoted in the
// test or from the fixture the test builds, none from the code and none read from a document when the test runs, except the trace, which reads UC-040 and SPEC.md as its input. The page is found by what the use
// case names - the headings "Resources" and "Instance resources", a resource by its name, the lines Pin, Licence, Maintainer and Route, the buttons "+ Add resource", "Edit the list", "Copy from the instance",
// "Check", "Move", "Remove" and "Save", the folded "What is this?" - never by the route's class names or ids.
// The harness is the helpers of the module's own tests: tests/settings-pages-harness.mjs, tests/settings-pages-setup.d/dom.mjs, tests/settings-pages-sources.d/github.mjs and tests/settings-pages-sources.d/frame.mjs (a
// fixture DOM, a fake localStorage, GitHub, the frame opened at a fragment).
// Run: node --test tests/release-uc-040-declare-the-products-resources.test.mjs
//
// Module: MOD-settings-pages; MOD-resource-list; MOD-site-frame
// Guards: UC-040; A PRODUCT DECLARES ITS RESOURCES; THE INSTANCE DECLARES ITS OWN RESOURCES; INSTANCE AND PRODUCT RESOURCES ARE INDEPENDENT; A PINNED RESOURCE MOVES ONLY WHEN A PERSON MOVES IT
// Guards: A RESTRICTED RESOURCE IS REFERENCED, NEVER COPIED; A RESOURCE ENTRY NAMES ITS SECRET, NOT ITS VALUE; A COMPUTE RESOURCE IS REACHED THROUGH THE BRIDGE OR A SELF-HOSTED RUNNER; A JOB RUNS ONLY WHERE ITS RESOURCES ARE REACHABLE
// Level: release
//
// Where the page and UC-040 disagree the test follows UC-040, and a test that fails on the page as it stands is marked { todo } with the finding it reports, as the other release tests of the product do. The findings:
//   - the list's form checks nothing once the person has edited the list (a secret's value, a route that is no Bridge or runner, a kind that is no kind are committed as typed);
//   - SPEC.md names tests/test_resources.py and tests/test_no_secret_written.py as the checks of fourteen requirements UC-040 realises, and neither file exists.
// Steps and alternatives the page does not do yet are not tested here and are named in tests/system-uc-040-declare-the-products-resources.test.mjs.

import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { setMaxListeners } from "node:events";
import { installDocument, byTag } from "./settings-pages-harness.mjs";
import { press } from "./settings-pages-setup.d/dom.mjs";
import { visit as visitFrame, click, settle, go } from "./settings-pages-sources.d/frame.mjs";
import { testDeclarations } from "../src/test-document/index.mjs";

installDocument();
setMaxListeners(100);
// The entry page registers the strategies of the views the frame loads before it starts the frame (src/site-frame/start.mjs); this file does the same for the view it opens, once.
const { view } = await import("../src/settings-pages/index.mjs");
const { registerStrategies } = await import("../src/job-runner/index.mjs");
for (const strategies of view.strategies) registerStrategies("tests/release-uc-040-declare-the-products-resources.test.mjs", strategies);

const ROOT = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, ROOT), "utf8");
const SYSTEM = "tests/system-uc-040-declare-the-products-resources.test.mjs";

const INSTANCE = "akmaier/agent-m";
const PRODUCT = "https://github.com/alice/thesis-tool";
const PRODUCT_REPO = "alice/thesis-tool";
const FRAGMENT = `#resources/product=${encodeURIComponent(PRODUCT)}`;
const TOKEN = "github_pat_INSTANCE0123456789abcdefghij";
const PRODUCT_TOKEN = "github_pat_PRODUCT0123456789abcdefghijk";
const BRIDGE_TOKEN = "bridge-token-0123456789";
const OLD = "b".repeat(40);
const SENTINEL = "TEXT-OF-A-FILE-IN-THE-DECLARED-REPOSITORY";
// The head the world gives a repository at its first state: the SHA-1 of "<owner>/<name>#0".
const headOf = (repository) => createHash("sha1").update(`${repository}#0`).digest("hex");

const HEADER = "| Name | Kind | Address | Pin | Licence | Maintainer | Route | Processing place | Paid | Secret |\n|---|---|---|---|---|---|---|---|---|---|";
const list = (title, ...rows) => `# Resources of ${title}\n\n${HEADER}\n${rows.join("\n")}\n`;
const DLLS = `| dlls | repository | https://github.com/alice/dlls | ${OLD} | MIT | the Acme organisation | read on its host | — | — | — |`;
const CLUSTER = "| cluster | compute | cluster.example.org | — | — | — | runner:gpu | NHR@FAU, Erlangen | — | — |";
const LLM = "| shared-llm | endpoint | http://workstation.example.org:8000/v1 | example-model | — | — | bridge workstation | the group's workstation | no | ci:LLM_KEY |";
const PRODUCT_LIST = list("thesis-tool", DLLS, CLUSTER);
const INSTANCE_LIST = list("agent-m", LLM, CLUSTER);
const PARTICIPANTS = ["# Participants of this instance", "",
  "| Name | Type | Model | Context | Price | Capabilities | Processing place | Route |", "|---|---|---|---|---|---|---|---|",
  "| ci-drafter | CI agent | ci-model | 200000 | — | draft text, run code and tests | GitHub Actions in the USA | ci runner:gpu secret CI_KEY |", ""].join("\n");
const WORKFLOW = { ".github/workflows/agent-m-jobs.yml": "name: Agent M jobs\n" };

// A person opens the page at `fragment`: the frame started on the module view of MOD-settings-pages, over this browser's store with the instance's token, the product with its own, and the Bridges `bridges`.
function visit(t, fragment, { productFiles = { "docs/resources.md": PRODUCT_LIST, ...WORKFLOW }, visibility = "private", bridges = {} } = {}) {
  return visitFrame(t, fragment, {
    repositories: { [INSTANCE]: { files: { "docs/resources.md": INSTANCE_LIST, "docs/participants.md": PARTICIPANTS } }, [PRODUCT_REPO]: { files: productFiles, visibility },
      "alice/dlls": { files: { "README.md": SENTINEL } }, "alice/dlls2": { files: { "README.md": SENTINEL } } },
    settings: { "github-token": { value: TOKEN, name: "Agent M - akmaier/agent-m", expires: "2027-01-01" }, products: [PRODUCT],
      [`github-token:${PRODUCT_REPO}`]: { value: PRODUCT_TOKEN, name: "Agent M - alice/thesis-tool", expires: "2027-01-01" },
      ...Object.fromEntries(Object.entries(bridges).map(([name, address]) => [`bridge:${name}`, { address, token: BRIDGE_TOKEN }])) },
  });
}

// What the use case names, found by what a person sees.
const heading = (page) => byTag(page.main(), "h2")[0]?.textContent;
const resourceNamed = (page, name) => byTag(page.main(), "section").find((section) => byTag(section, "h4")[0]?.textContent === name);
const resourceNames = (page) => byTag(page.main(), "h4").map((each) => each.textContent);
const lineOf = (page, name, label) => byTag(resourceNamed(page, name), "p").find((each) => each.textContent.startsWith(`${label}:`))?.textContent;
const buttonIn = (root, text) => byTag(root, "button").find((button) => button.textContent === text);
const labelledField = (page, text) => byTag(byTag(page.main(), "label").find((each) => each.textContent.trim().startsWith(text)), "input")[0];
const kindChoice = (page) => byTag(page.main(), "select").find((select) => byTag(select, "option").some((option) => option.value === "repository"));
const listText = (page) => byTag(page.main(), "textarea")[0];
const saveButton = (page) => byTag(page.main(), "button").filter((button) => button.textContent === "Save").at(-1);
const typeInto = async (field, text) => { field.value = text; field.dispatchEvent(new Event("input")); await settle(); };
const commitsOf = (page, repository) => page.world.commits(repository);
const filesOf = (page, repository) => page.world.files(repository);
const allCommits = (page) => [INSTANCE, PRODUCT_REPO, "alice/dlls", "alice/dlls2"].flatMap((repository) => commitsOf(page, repository));
const holdsASecret = (page) => [TOKEN, PRODUCT_TOKEN, BRIDGE_TOKEN].filter((secret) => allCommits(page).some((commit) => JSON.stringify(commit.files).includes(secret) || String(commit.message).includes(secret)));
async function addResource(page, kind, name, address) {
  kindChoice(page).value = kind;
  labelledField(page, "Name").value = name;
  labelledField(page, "Address").value = address;
  await click(buttonIn(page.main(), "+ Add resource"));
}
function bridgeAnswering(answers) {
  const calls = [], inner = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    if (!String(url).startsWith("http://127.0.0.1:")) return inner(url, init);
    calls.push({ url: String(url), init });
    return new Response(JSON.stringify(answers[String(url).split("/").at(-1)]), { status: 200 });
  };
  return calls;
}

// ---------------------------------------------------------------- the trace from the requirements UC-040 realises to the evidence that checks them

function ucRealises() {
  const names = [];
  let inRealises = false;
  for (const line of read("docs/use-cases/UC-040-declare-the-products-resources.md").split("\n")) {
    if (line === "realises:") { inRealises = true; continue; }
    if (!inRealises) continue;
    if (line.startsWith("  - ")) names.push(line.slice(4));
    else if (line === "---") break;
  }
  return names;
}
function specChecks() {
  const checks = new Map();
  const pattern = /^\*\*(.+?)\*\*[\s\S]*?\*Check:\* ([^\n]*(?:\n(?!\*\*|## ).*)*)/gm;
  let match;
  while ((match = pattern.exec(read("SPEC.md")))) checks.set(match[1], match[2].replace(/\s+/g, " ").trim());
  return checks;
}
const named = (check) => check.match(/tests\/[A-Za-z0-9_.-]+/g) ?? [];

// TST-1041101 · level: release · module: MOD-settings-pages; MOD-resource-list
// guards: UC-040; RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER
// given: UC-040's `realises` list and the UC-040 system test
// input: read the declarations of the system test
// expect: the use case realises 26 requirements, each once (known positive); the system test declares every step of the main flow, 1 to 9, and each alternative 1a, 1b, 2a, 2c, 3a, 4a, 4b, 4c, 7a, 7b, 7c, 9a and 9b, and every declaration of it is at level system
test("TST-1041101: the system test declares every step and every alternative flow of UC-040", () => {
  const realised = ucRealises();
  assert.equal(realised.length, 26, "known positive: the use case realises twenty-six requirements");
  assert.deepEqual([...new Set(realised)].sort(), realised.toSorted(), "each requirement once");
  const declarations = testDeclarations(SYSTEM, read(SYSTEM));
  assert.ok(declarations.length >= 16, `known positive: the declarations of the system test are found (${declarations.length})`);
  assert.ok(declarations.every((one) => one.level === "system"), "every declaration of the system test is level system");
  // The flows a case walks stand in its comment block - guards, given, input and expect, whose lines may wrap -; the guards name the use case alone.
  const rows = read(SYSTEM).split("\n");
  const block = (one) => { const text = []; for (let at = one.line - 1; at < rows.length && /^\s*\/\//.test(rows[at]); at += 1) text.push(rows[at].replace(/^\s*\/\/\s?/, "")); return text.join(" "); };
  const guards = declarations.flatMap((one) => [...block(one).matchAll(/UC-040 (?:steps?|alternatives?) [^)\n;]*/g)].map((match) => match[0].trim()));
  assert.ok(guards.length >= 16, `known positive: the system test names the steps it walks (${guards.length})`);
  const named = guards.join(" ");
  const steps = new Set();
  for (const guard of guards) {
    const text = guard.replace(/^UC-040 (?:steps?|alternatives?) /, "");
    for (const [, from, to] of text.matchAll(/\b(\d) to (\d)\b/g)) for (let at = Number(from); at <= Number(to); at += 1) steps.add(at);
    for (const [, number] of text.matchAll(/\b(\d)(?![a-z]| to)/g)) steps.add(Number(number));
  }
  for (let step = 1; step <= 9; step += 1) assert.ok(steps.has(step), `the system test walks step ${step}`);
  for (const alternative of ["1a", "1b", "2a", "2c", "3a", "4a", "4b", "4c", "7a", "7b", "7c", "9a", "9b"]) assert.ok(new RegExp(`\\b${alternative}\\b`).test(named), `the system test walks alternative ${alternative}`);
});

// TST-1041110 · level: release · module: MOD-settings-pages; MOD-resource-list
// guards: UC-040
// given: UC-040's `realises` list, SPEC's current Check lines and the files of tests/
// input: for each realised requirement read the Check line; list the files it names that do not exist; list the requirements with an automatic check that neither the system test (by its guards) nor an existing named file checks
// expect: every requirement UC-040 realises has a Check line in the SPEC; every file a Check line names exists; every requirement with an automatic check is guarded by the system test or checked by an existing file
test("TST-1041110: every automatic requirement UC-040 realises is checked by evidence that exists",
  { todo: "FINDING ITM-1130 (test_resources.py) and ITM-1131 (test_no_secret_written.py) — SPEC.md names tests/test_resources.py as the check of twelve requirements UC-040 realises and tests/test_no_secret_written.py as the check of two; neither file exists, so A RESOURCE IS USED, A PARTICIPANT DEVELOPS has no executable evidence at all and the others are checked by the system test alone (a backlog item to be added by the Product Owner)." }, () => {
    const checks = specChecks();
    const guardedBySystem = new Set(testDeclarations(SYSTEM, read(SYSTEM)).flatMap((one) => one.guards.flatMap((guard) => guard.split(";").map((part) => part.trim()))));
    const absent = new Set(), unchecked = [];
    for (const requirement of ucRealises()) {
      const check = checks.get(requirement);
      assert.ok(check !== undefined, `${requirement}: the SPEC states a check`);
      if (/^no automatic check; at review/.test(check)) continue;
      for (const file of named(check).filter((each) => !existsSync(new URL(each, ROOT)))) absent.add(file);
      if (!guardedBySystem.has(requirement) && !named(check).some((file) => existsSync(new URL(file, ROOT)))) unchecked.push(requirement);
    }
    assert.deepEqual([...absent], [], "files the SPEC names as checks and that do not exist");
    assert.deepEqual(unchecked, [], "requirements with no evidence");
  });

// ---------------------------------------------------------------- the flow, as a person reads and presses it

// TST-1041102 · level: release · module: MOD-settings-pages; MOD-site-frame
// guards: UC-040; A PRODUCT DECLARES ITS RESOURCES; THE INSTANCE DECLARES ITS OWN RESOURCES
// given: this browser keeps the product with its token; the product's docs/resources.md names the repository dlls (MIT, the Acme organisation) and the compute resource cluster (runner gpu); the instance's names shared-llm and cluster
// input: open #resources/product=<the product>; then open #resources
// expect: step 1 "Agent M shows the declared resources grouped by kind, each with its pin, licence, maintainer and route": the first page is headed "Resources", has the groups Repository and Compute, shows dlls with "Pin: <the commit>", "Licence: MIT", "Maintainer: the Acme organisation", "Route: read on its host" and cluster with "Route: runner:gpu"; a folded "What is this?" (closed) names what a resource, a requirement source and a participant are; 1b "Settings → Instance resources": the second is headed "Instance resources", lists the instance's two resources and not dlls; neither page writes anything
test("release · UC-040 1–2 and 1b: the page shows the declared resources by kind, folded explanation included, and the instance has a list of its own", async (t) => {
  const page = await visit(t, FRAGMENT);
  assert.equal(heading(page), "Resources");
  assert.deepEqual(byTag(page.main(), "h3").map((each) => each.textContent), ["Repository", "Compute"]);
  assert.deepEqual(resourceNames(page), ["dlls", "cluster"]);
  assert.equal(lineOf(page, "dlls", "Pin"), `Pin: ${OLD}`);
  assert.equal(lineOf(page, "dlls", "Licence"), "Licence: MIT");
  assert.equal(lineOf(page, "dlls", "Maintainer"), "Maintainer: the Acme organisation");
  assert.equal(lineOf(page, "dlls", "Route"), "Route: read on its host");
  assert.equal(lineOf(page, "cluster", "Route"), "Route: runner:gpu");
  const folded = byTag(page.main(), "details").filter((each) => /requirement source/.test(each.textContent));
  assert.equal(folded.length, 1, "one folded explanation of the three things");
  assert.equal(folded[0].hasAttribute("open"), false);
  assert.match(byTag(folded[0], "summary")[0].textContent, /What is this\?/);
  const instance = await visit(t, "#resources");
  assert.equal(heading(instance), "Instance resources");
  assert.deepEqual(resourceNames(instance), ["cluster", "shared-llm"]);
  assert.deepEqual(allCommits(page).concat(allCommits(instance)), []);
});

// TST-1041103 · level: release · module: MOD-settings-pages; MOD-resource-list
// guards: UC-040; A PRODUCT DECLARES ITS RESOURCES; A RESTRICTED RESOURCE IS REFERENCED, NEVER COPIED; A RESOURCE ENTRY NAMES ITS SECRET, NOT ITS VALUE
// given: the page of TST-1041102; alice/dlls2 is readable with the product's token and holds a file whose text is a sentinel
// input: choose the kind repository, name "tools", paste https://github.com/alice/dlls2, press "+ Add resource"; type the licence "MIT", the maintainer "the Acme organisation" and the secret "ci:DLLS_TOKEN" into the row; press "Save" once; press "Check" on tools
// expect: step 3 "Agent M reads the current commit ... and pins it": the row is pinned to the head of alice/dlls2 (the SHA-1 of "alice/dlls2#0"); nothing is committed before Save; step 8 "Save — one click ... commits the entry to docs/resources.md of the product repository: name, kind, address, pin, licence, maintainer, route, ... name of the secret — never its value, never restricted content": one commit to alice/thesis-tool, made with the product's token, changing only docs/resources.md, whose rows are the two old ones byte for byte and the new one; no other repository has a commit; no commit holds a token or the sentinel; step 7: Check says that tools stands at its pin, and writes nothing
test("release · UC-040 2–8: a repository is added, pinned to its head and saved as one commit of docs/resources.md, with no secret and no content of the repository in it", async (t) => {
  const page = await visit(t, FRAGMENT);
  await addResource(page, "repository", "tools", "https://github.com/alice/dlls2");
  assert.ok(listText(page).value.includes(`| tools | repository | https://github.com/alice/dlls2 | ${headOf("alice/dlls2")} |`), "pinned to the head");
  assert.equal(allCommits(page).length, 0, "nothing is committed before Save");
  await typeInto(listText(page), listText(page).value.replace(/\| tools \| repository \| ([^|]+) \| ([0-9a-f]{40}) \| — \| — \| ([^|]+) \| — \| — \| — \|/, "| tools | repository | $1 | $2 | MIT | the Acme organisation | $3 | — | — | ci:DLLS_TOKEN |"));
  await click(saveButton(page));
  assert.equal(commitsOf(page, PRODUCT_REPO).length, 1, "one click, one commit");
  const commit = commitsOf(page, PRODUCT_REPO)[0];
  assert.deepEqual(Object.keys(commit.files), ["docs/resources.md"]);
  assert.equal(commit.files["docs/resources.md"], list("thesis-tool", DLLS, CLUSTER, `| tools | repository | https://github.com/alice/dlls2 | ${headOf("alice/dlls2")} | MIT | the Acme organisation | read on its host | — | — | ci:DLLS_TOKEN |`));
  assert.equal(commit.authorization, `Bearer ${PRODUCT_TOKEN}`);
  assert.equal(allCommits(page).length, 1);
  assert.deepEqual(holdsASecret(page), []);
  assert.equal(JSON.stringify(commit.files).includes(SENTINEL), false);
  await click(buttonIn(resourceNamed(page, "tools"), "Check"));
  assert.match(resourceNamed(page, "tools").textContent, new RegExp(`stands at its pin, ${headOf("alice/dlls2")}`));
  assert.equal(allCommits(page).length, 1, "Check writes nothing");
});

// TST-1041104 · level: release · module: MOD-settings-pages; MOD-resource-list
// guards: UC-040; A COMPUTE RESOURCE IS REACHED THROUGH THE BRIDGE OR A SELF-HOSTED RUNNER; A RESOURCE DECLARES WHERE IT PROCESSES DATA
// given: the page of TST-1041102; this browser keeps the Bridge hpc (http://127.0.0.1:4712) whose fake answers the harmless request for the partitions with debug (up) and gpu (drain)
// input: choose the kind compute, name "alex", address "alex.nhr.fau.de", press "+ Add resource"; type the route "bridge hpc" and the place "NHR@FAU, Erlangen" into the row; press "Save"; press "Check" on alex
// expect: step 3 "compute: ... the route: a Bridge, chosen by its name": the row has no pin (a dash); Save is not offered while the route and the place are left out; one commit holds only docs/resources.md with the row; step 7 "through the Bridge the route names, with its token, a harmless request — for a SLURM cluster the partition list": Check asks http://127.0.0.1:4712/v1/probes/partitions once, with the pairing token in a header and not in the address, shows the partitions debug (up) and gpu (drain), and writes nothing; no commit holds a token
test("release · UC-040 3, 6–8: a compute resource on a Bridge is declared with its route and place and checked by a harmless request through that Bridge", async (t) => {
  const page = await visit(t, FRAGMENT, { bridges: { hpc: "http://127.0.0.1:4712" } });
  await addResource(page, "compute", "alex", "alex.nhr.fau.de");
  assert.equal(saveButton(page).disabled, true, "Save waits for the route and the place");
  const row = "| alex | compute | alex.nhr.fau.de | — | — | — | bridge hpc | NHR@FAU, Erlangen | — | — |";
  await typeInto(listText(page), listText(page).value.replace("| alex | compute | alex.nhr.fau.de | — | — | — | — | — | — | — |", row));
  assert.equal(saveButton(page).disabled, false);
  await click(saveButton(page));
  assert.equal(commitsOf(page, PRODUCT_REPO).length, 1);
  assert.deepEqual(Object.keys(commitsOf(page, PRODUCT_REPO)[0].files), ["docs/resources.md"]);
  assert.ok(commitsOf(page, PRODUCT_REPO)[0].files["docs/resources.md"].includes(row));
  const calls = bridgeAnswering({ partitions: { answer: { partitions: [{ name: "debug", state: "up" }, { name: "gpu", state: "drain" }] } } });
  await click(buttonIn(resourceNamed(page, "alex"), "Check"));
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "http://127.0.0.1:4712/v1/probes/partitions");
  assert.ok(JSON.stringify(calls[0].init.headers).includes(BRIDGE_TOKEN) && !calls[0].url.includes(BRIDGE_TOKEN));
  assert.ok(resourceNamed(page, "alex").textContent.includes("debug (up), gpu (drain)"));
  assert.equal(allCommits(page).length, 1);
  assert.deepEqual(holdsASecret(page), []);
});

// TST-1041105 · level: release · module: MOD-settings-pages; MOD-resource-list
// guards: UC-040; A JOB RUNS ONLY WHERE ITS RESOURCES ARE REACHABLE
// given: a private product with Agent M's job workflow, whose list names cluster on the runner gpu; the instance's register holds the CI agent ci-drafter on `ci runner:gpu secret CI_KEY`; the same product public
// input: press "Check" on cluster; press "Run"; then the same Check on the public product
// expect: 7b "The route is a self-hosted runner. The browser cannot reach it; Agent M offers a check job on that runner label through the product's workflow": the page names the job, the runner gpu and ci-drafter and offers "Run"; Check writes nothing; one press of Run gives one commit to alice/thesis-tool adding one file under docs/jobs/ and changing no other, made with the product's token; 9b "No runtime reaches the resource. The job is not offered; Agent M names the resource and the missing route": on the public product the page says that no CI agent reaches the runner gpu and that nothing can check cluster, offers no Run and writes nothing
test("release · UC-040 7b and 9b: a resource on a runner is checked by a job the person starts, and where no runtime reaches it the job is not offered", async (t) => {
  const page = await visit(t, FRAGMENT);
  await click(buttonIn(resourceNamed(page, "cluster"), "Check"));
  assert.match(resourceNamed(page, "cluster").textContent, /on the runner gpu, with the participant ci-drafter/);
  assert.equal(allCommits(page).length, 0, "Check writes nothing");
  const run = buttonIn(resourceNamed(page, "cluster"), "Run");
  assert.ok(run, "the job is offered");
  await click(run);
  assert.equal(commitsOf(page, PRODUCT_REPO).length, 1);
  const added = Object.keys(commitsOf(page, PRODUCT_REPO)[0].files);
  assert.equal(added.length, 1);
  assert.match(added[0], /^docs\/jobs\/JOB-[^/]+\.md$/);
  assert.equal(commitsOf(page, PRODUCT_REPO)[0].authorization, `Bearer ${PRODUCT_TOKEN}`);
  const publicPage = await visit(t, FRAGMENT, { visibility: "public" });
  await click(buttonIn(resourceNamed(publicPage, "cluster"), "Check"));
  assert.match(resourceNamed(publicPage, "cluster").textContent, /No CI agent of the instance reaches the runner gpu.*Nothing can check cluster until one does\./);
  assert.equal(Boolean(buttonIn(resourceNamed(publicPage, "cluster"), "Run")), false, "no Run is offered");
  assert.equal(allCommits(publicPage).length, 0);
});

// TST-1041106 · level: release · module: MOD-settings-pages; MOD-resource-list
// guards: UC-040; INSTANCE AND PRODUCT RESOURCES ARE INDEPENDENT; THE INSTANCE DECLARES ITS OWN RESOURCES
// given: the instance's list holds shared-llm and cluster; the product's list holds dlls and cluster
// input: on the product's page choose shared-llm in "An instance resource", press "Copy from the instance" and "Save"; on #resources change the place of shared-llm and press "Save"; on the product's page change the place of its copy and press "Save"
// expect: 2c "the entry is copied into the product's list, where it is edited and saved like any other. The copy is not linked; a later change on either side leaves the other unchanged": only shared-llm is offered; the first Save commits the copy to the product alone and leaves the instance's list byte for byte; the change on the instance's page leaves the product's list byte for byte and commits to the instance alone (1b); the change on the product's page leaves the instance's list as the second Save wrote it
test("release · UC-040 1b and 2c: an instance resource is copied into the product's list, and a later change on either side leaves the other list unchanged", async (t) => {
  const page = await visit(t, FRAGMENT);
  const choice = byTag(byTag(page.main(), "label").find((each) => each.textContent.trim().startsWith("An instance resource")), "select")[0];
  assert.deepEqual(byTag(choice, "option").map((option) => option.value), ["shared-llm"]);
  choice.value = "shared-llm";
  await click(buttonIn(page.main(), "Copy from the instance"));
  await click(saveButton(page));
  const copied = list("thesis-tool", DLLS, CLUSTER, LLM);
  assert.equal(commitsOf(page, PRODUCT_REPO).length, 1);
  assert.equal(filesOf(page, PRODUCT_REPO)["docs/resources.md"], copied);
  assert.equal(commitsOf(page, INSTANCE).length, 0);
  assert.equal(filesOf(page, INSTANCE)["docs/resources.md"], INSTANCE_LIST);
  await go(page, "#resources");
  await click(buttonIn(page.main(), "Edit the list"));
  await typeInto(listText(page), listText(page).value.replace("the group's workstation", "the instance's server room"));
  await click(saveButton(page));
  const instanceNow = INSTANCE_LIST.replace("the group's workstation", "the instance's server room");
  assert.equal(commitsOf(page, INSTANCE).length, 1);
  assert.equal(filesOf(page, INSTANCE)["docs/resources.md"], instanceNow);
  assert.equal(filesOf(page, PRODUCT_REPO)["docs/resources.md"], copied, "the product's copy did not follow");
  await go(page, FRAGMENT);
  await click(buttonIn(page.main(), "Edit the list"));
  await typeInto(listText(page), listText(page).value.replace("the group's workstation", "the product's own machine"));
  await click(saveButton(page));
  assert.equal(filesOf(page, PRODUCT_REPO)["docs/resources.md"], copied.replace("the group's workstation", "the product's own machine"));
  assert.equal(filesOf(page, INSTANCE)["docs/resources.md"], instanceNow, "the instance's list did not follow");
  assert.equal(commitsOf(page, INSTANCE).length, 1);
});

// TST-1041107 · level: release · module: MOD-settings-pages; MOD-resource-list
// guards: UC-040; A PINNED RESOURCE MOVES ONLY WHEN A PERSON MOVES IT
// given: the product's list pins dlls and a second repository, other, to the commit of 40 "b"; alice/dlls stands at its head (the SHA-1 of "alice/dlls#0")
// input: press "Check" on dlls; press "Check" on dlls and "Move" by a click a script makes; press "Move" as a person
// expect: 9a "A newer state exists upstream — a newer commit. The dashboard shows it beside the pin ...; the pin changes only when the author presses Move — one click — which commits the new pin to docs/resources.md": Check shows the head beside the pin and the button Move and writes nothing; the script's click writes nothing; the person's one click gives one commit, to alice/thesis-tool, changing only docs/resources.md and in it only the pin of dlls (other and cluster byte for byte); the entry then reads "Pin: <the head>"
test("release · UC-040 9a: a newer state upstream is shown beside the pin, and the pin moves in one click of the person and in no other way", async (t) => {
  const other = DLLS.replace("| dlls | repository | https://github.com/alice/dlls |", "| other | repository | https://github.com/alice/other |");
  const page = await visit(t, FRAGMENT, { productFiles: { "docs/resources.md": list("thesis-tool", DLLS, other, CLUSTER), ...WORKFLOW } });
  await click(buttonIn(resourceNamed(page, "dlls"), "Check"));
  assert.ok(resourceNamed(page, "dlls").textContent.includes(headOf("alice/dlls")), "the newer state is shown");
  assert.equal(lineOf(page, "dlls", "Pin"), `Pin: ${OLD}`, "and the pin is as it was");
  assert.equal(allCommits(page).length, 0, "Check writes nothing");
  const move = buttonIn(resourceNamed(page, "dlls"), "Move");
  assert.ok(move, "Move is offered");
  await press(move);
  await settle();
  assert.equal(allCommits(page).length, 0, "a click a script makes writes nothing");
  await click(move);
  assert.equal(commitsOf(page, PRODUCT_REPO).length, 1);
  assert.deepEqual(Object.keys(commitsOf(page, PRODUCT_REPO)[0].files), ["docs/resources.md"]);
  assert.equal(commitsOf(page, PRODUCT_REPO)[0].files["docs/resources.md"], list("thesis-tool", DLLS.replace(OLD, headOf("alice/dlls")), other, CLUSTER));
  assert.equal(lineOf(page, "dlls", "Pin"), `Pin: ${headOf("alice/dlls")}`);
  assert.equal(commitsOf(page, INSTANCE).length, 0);
});

// TST-1041108 · level: release · module: MOD-settings-pages; MOD-resource-list
// guards: UC-040; A PINNED RESOURCE MOVES ONLY WHEN A PERSON MOVES IT; ONE CLICK PER DECISION
// given: https://github.com/alice/hidden is not readable with the stored token; the product's list names shared-llm on `bridge workstation`, and this browser keeps no Bridge of that name
// input: press "Check" on shared-llm; add the repository "hidden" at that address
// expect: 7a "The Bridge the route names does not answer. Agent M names the reason ... and saves nothing": the entry says that this browser does not keep Bridge workstation, and nothing is committed; 3a "A private repository is not readable with the stored token. Agent M says so ... nothing is saved until the check succeeds or the author saves it unchecked": the page says the head of the repository could not be read, the row stands in the form without a pin, Save is not offered, and nothing is committed
test("release · UC-040 3a and 7a: what cannot be reached is named, and nothing is saved by the check or the failed read", async (t) => {
  const page = await visit(t, FRAGMENT, { productFiles: { "docs/resources.md": list("thesis-tool", DLLS, LLM), ...WORKFLOW } });
  await click(buttonIn(resourceNamed(page, "shared-llm"), "Check"));
  assert.match(resourceNamed(page, "shared-llm").textContent, /This browser does not keep Bridge workstation\./);
  assert.equal(allCommits(page).length, 0);
  await addResource(page, "repository", "hidden", "https://github.com/alice/hidden");
  assert.match(page.main().textContent, /The head of https:\/\/github\.com\/alice\/hidden could not be read/);
  assert.ok(listText(page).value.includes("| hidden | repository | https://github.com/alice/hidden | — |"), "the row stands without a pin");
  assert.equal(saveButton(page).disabled, true);
  assert.equal(allCommits(page).length, 0);
});

// ---------------------------------------------------------------- findings

// TST-1041109 · level: release · module: MOD-settings-pages; MOD-site-frame
// guards: UC-040; A RESOURCE ENTRY NAMES ITS SECRET, NOT ITS VALUE; NO SECRET IN THE REPOSITORY
// given: the page of TST-1041104 without the Bridge
// input: add the compute resource "alex"; type the route "bridge hpc", the place and, as its secret, the value "sk-live-0123456789abcdef" into the row; press "Save"
// expect: step 8 "name of the secret — never its value": the value stands in no commit of any repository
test("release · UC-040 8: a secret's value typed into the list is never committed", async (t) => {
    const page = await visit(t, FRAGMENT);
    await addResource(page, "compute", "alex", "alex.nhr.fau.de");
    await typeInto(listText(page), listText(page).value.replace("| alex | compute | alex.nhr.fau.de | — | — | — | — | — | — | — |", "| alex | compute | alex.nhr.fau.de | — | — | — | bridge hpc | NHR@FAU, Erlangen | — | sk-live-0123456789abcdef |"));
    if (!saveButton(page).disabled) await click(saveButton(page));
    assert.equal(allCommits(page).some((commit) => JSON.stringify(commit.files).includes("sk-live-0123456789abcdef")), false);
  });
