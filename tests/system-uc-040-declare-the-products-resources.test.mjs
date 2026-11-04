// UC-040 "Declare the product's resources" as a system path: each step of the main flow (1 to 8) for a repository, a compute resource on a Bridge and a compute resource on a runner, and the
// alternatives 1a, 1b, 2a, 2c, 3a, 4a, 4c, 7a, 7b, 7c, 9a and 9b, through MOD-site-frame's frame — startPage over the module view of MOD-settings-pages, the routes `resources` (a product's list)
// and `resources/instance` (the fragment #resources, which names no product) opened at their fragments — against MOD-repository-hosts' real GitHub host for the instance, the product and the
// repositories it declares (connect, readSnapshot, saveFile's commit), answered by a fake of fetch over repositories that hold files (tests/settings-pages-sources.d/github.mjs), and a fake Bridge
// at 127.0.0.1 that answers the harmless requests of a check. Every step is reached by a person's input: a chosen kind, a typed name and address, a typed list, a press of a button. Nothing
// reaches the network: every request is recorded.
// Run: node --test tests/system-uc-040-declare-the-products-resources.test.mjs
//
// Module: MOD-settings-pages; MOD-resource-list
// Guards: UC-040; A PRODUCT DECLARES ITS RESOURCES; THE INSTANCE DECLARES ITS OWN RESOURCES; INSTANCE AND PRODUCT RESOURCES ARE INDEPENDENT; A PINNED RESOURCE MOVES ONLY WHEN A PERSON MOVES IT
// Guards: A RESTRICTED RESOURCE IS REFERENCED, NEVER COPIED; A RESOURCE ENTRY NAMES ITS SECRET, NOT ITS VALUE; A RESOURCE CREDENTIAL GOES ONLY TO ITS RESOURCE; A RESOURCE IS PINNED TO AN EXACT STATE
// Guards: A RESOURCE DECLARES ITS LICENCE; A RESOURCE NAMES ITS MAINTAINER; A RESOURCE DECLARES WHERE IT PROCESSES DATA; A COMPUTE RESOURCE IS REACHED THROUGH THE BRIDGE OR A SELF-HOSTED RUNNER
// Guards: A JOB RUNS ONLY WHERE ITS RESOURCES ARE REACHABLE; A PERSON'S OWN INPUT IS COMMITTED DIRECTLY; ONE CLICK PER DECISION; EVERY STEP EXPLAINS ITSELF; NO SECRET IN THE REPOSITORY
// Level: system
//
// Each test names its input and states its expected result in its own text (given / input / expect) from UC-040 and the requirements it realises; none reads an expected value from the page's code.
// The instance is akmaier/agent-m (its Pages address https://akmaier.github.io/agent-m/docs/index.html), the product https://github.com/alice/thesis-tool, a private repository that holds Agent M's
// job workflow; the repositories it declares are alice/dlls, alice/dlls2 and, not readable with the token, alice/hidden. The counter-proofs are recorded in the pull request.
//
// Readings the texts leave open, which the tests state (the pull request names them with their sources):
//   - The page lists a resource for *Check* once it is in the list, so a person presses Check after Save, not before it (UC-040 steps 7 and 8 name Check first). Alternatives 3a and 7a say that
//     nothing is saved until the check succeeds or the author saves it unchecked: the tests take it that Save is possible whether or not a check was made, and that a check writes nothing.
//   - A new entry of the kind compute leaves its route and processing place to the person (UC-040 step 3: "the author names it ... and the route"; step 6: "asks otherwise"); the list's form shows
//     them as missing until typed. A compute resource's "what it is" (SLURM cluster, GPU machine) has no column in the list and is not tested.
//   - "No secret value" is tested over the commits of every repository the world holds, for each secret value a test places in the browser or on a Bridge; "no restricted content", over the
//     commits and over the requests: no file of a declared repository is read, and its text stands in no commit.
//
// Left out, because the page does not do it yet, and named in the pull request:
//   - Step 3, data and model: *+ Add resource* does not read the Hub for them (only Check does, TST-1041021); alternative 3c, a gated model's token.
//   - Step 3, repository: the licence file, the date of the last commit and the number of committers of the last year (ITM-1027 built MOD-reuse-facts' repositoryFacts; no route of
//     MOD-settings-pages calls it).
//   - Step 9: that the job pages offer only the runtimes and participants that reach a resource (ITM-1029 built the recipe resource-pins and MOD-runtimes' routesFor takes the needs; the pages that
//     start a job hand it none, src/review-pages/jobs.mjs). Test TST-1041015 walks the chain of the two modules instead, without a page.
//   - Alternative 3a, "shows how to add it to the token"; alternative 7c, a Move for an endpoint's pin; step 7, "the served identifier becomes its pin"; step 6, "presets this machine"; alternative
//     4c, the wording "bus factor 1" (the page warns that the maintainer is a single person).

import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { setMaxListeners } from "node:events";
import { installDocument, byTag } from "./settings-pages-harness.mjs";
import { press, storedKeys } from "./settings-pages-setup.d/dom.mjs";
import { withClass } from "./settings-pages-sources.d/github.mjs";
import { visit as visitFrame, click, settle, go } from "./settings-pages-sources.d/frame.mjs";

installDocument();
setMaxListeners(100); // each visit starts a frame on a window of its own
// The entry page registers the strategies of the views the frame loads before it starts the frame (src/site-frame/start.mjs); this file does the same for the view it opens, once.
const { view } = await import("../src/settings-pages/index.mjs");
const { registerStrategies } = await import("../src/job-runner/index.mjs");
for (const strategies of view.strategies) registerStrategies("tests/system-uc-040-declare-the-products-resources.test.mjs", strategies);

const INSTANCE = "akmaier/agent-m";
const PRODUCT = "https://github.com/alice/thesis-tool";
const PRODUCT_REPO = "alice/thesis-tool";
const FRAGMENT = `#resources/product=${encodeURIComponent(PRODUCT)}`;
const TOKEN = "github_pat_INSTANCE0123456789abcdefghij";
const PRODUCT_TOKEN = "github_pat_PRODUCT0123456789abcdefghijk";
const BRIDGE_TOKEN = "bridge-token-0123456789";
const RESOURCE_KEY = "sk-llm-key-0123456789abcdef";
const OLD = "b".repeat(40);
const CONTENT = "TEXT-OF-A-FILE-IN-THE-DECLARED-REPOSITORY";

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
function visit(t, fragment, { productFiles = { "docs/resources.md": PRODUCT_LIST, ...WORKFLOW }, instanceFiles = { "docs/resources.md": INSTANCE_LIST, "docs/participants.md": PARTICIPANTS },
  visibility = "private", bridges = {} } = {}) {
  return visitFrame(t, fragment, {
    repositories: { [INSTANCE]: { files: instanceFiles }, [PRODUCT_REPO]: { files: productFiles, visibility },
      "alice/dlls": { files: { "README.md": CONTENT } }, "alice/dlls2": { files: { "README.md": CONTENT } } },
    settings: { "github-token": { value: TOKEN, name: "Agent M · akmaier/agent-m", expires: "2027-01-01" }, products: [PRODUCT],
      [`github-token:${PRODUCT_REPO}`]: { value: PRODUCT_TOKEN, name: "Agent M · alice/thesis-tool", expires: "2027-01-01" },
      ...Object.fromEntries(Object.entries(bridges).map(([name, kept]) => [`bridge:${name}`, typeof kept === "string" ? { address: kept, token: BRIDGE_TOKEN } : kept])) },
  });
}

// What a person sees and presses.
const entry = (page, name) => byTag(page.main(), "section").find((section) => byTag(section, "h4")[0]?.textContent === name);
const names = (page) => byTag(page.main(), "h4").map((heading) => heading.textContent);
const line = (page, name, className) => withClass(entry(page, name), className)[0]?.textContent;
const labelled = (root, text) => byTag(root, "button").find((button) => button.textContent === text);
const formOf = (page) => withClass(page.main(), "schema-form")[0];
const areaOf = (page) => byTag(formOf(page), "textarea")[0];
const saveOf = (page) => byTag(formOf(page), "button").at(-1);
const marks = (page) => withClass(formOf(page), "marks")[0]?.textContent ?? "";
const result = (page) => withClass(page.main(), "resources-result")[0].textContent;
const note = (page) => withClass(page.main(), "resources-note")[0].textContent;
const typeInto = async (area, text) => { area.value = text; area.dispatchEvent(new Event("input")); await settle(); };
const commitsOf = (page, repository) => page.world.commits(repository);
const filesOf = (page, repository) => page.world.files(repository);
// The head the world gives a repository at its first state: the SHA-1 of "<owner>/<name>#0" (tests/settings-pages-sources.d/github.mjs).
const headOf = (repository) => createHash("sha1").update(`${repository}#0`).digest("hex");
async function add(page, kind, name, address) {
  const adding = withClass(page.main(), "resources-adding")[0];
  byTag(adding, "select")[0].value = kind;
  const [nameField, addressField] = byTag(adding, "input");
  nameField.value = name;
  addressField.value = address;
  await click(labelled(adding, "+ Add resource"));
}
// A Bridge at 127.0.0.1:<port>: the fake answers the probe `probe` of `answers` and records every request that reaches it. A request to anything else goes on to the world.
function bridgeAnswering(answers) {
  const calls = [], inner = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    const address = String(url);
    if (!address.startsWith("http://127.0.0.1:")) return inner(url, init);
    calls.push({ url: address, init });
    const probe = address.split("/").at(-1);
    return answers[probe] instanceof Error ? Promise.reject(answers[probe]) : new Response(JSON.stringify(answers[probe]), { status: 200 });
  };
  return calls;
}
// Every secret value a test places is in no commit of any repository, whatever its file or message.
const SECRETS = [TOKEN, PRODUCT_TOKEN, BRIDGE_TOKEN, RESOURCE_KEY];
const allCommits = (page) => [INSTANCE, PRODUCT_REPO, "alice/dlls", "alice/dlls2"].flatMap((repository) => commitsOf(page, repository));
const secretsInCommits = (page) => SECRETS.filter((secret) => allCommits(page).some((commit) => JSON.stringify(commit.files).includes(secret) || String(commit.message).includes(secret)));
const readContent = (page) => page.world.requests.filter((request) => ["alice/dlls", "alice/dlls2"].includes(request.repository) && (/\/contents\//.test(request.url.pathname) || request.url.origin !== "https://api.github.com"));

// TST-1041001 · level: system · module: MOD-settings-pages; MOD-resource-list
// guards: UC-040; A PRODUCT DECLARES ITS RESOURCES; EVERY STEP EXPLAINS ITSELF
// given: this browser keeps the product with its token; its docs/resources.md names the repository dlls (pinned, MIT, maintained by the Acme organisation) and the compute resource cluster (runner gpu)
// input: open the address #resources/product=<the product>
// expect: UC-040 step 1 "Agent M shows the declared resources grouped by kind, each with its pin, licence, maintainer and route. A folded What is this? explains the three-way difference above with the (flow: UC-040 steps 1 and 2) examples": the page is headed "Resources", names the product's repository, shows the groups "Repository" and "Compute" and in them dlls and cluster, each with the lines Pin, Licence, Maintainer and Route as the list holds them; one folded What is this? (closed) names resource, requirement source and participant, holds the examples of the three and links UC-015 and UC-017 (alternatives 2a and 2b); step 2 "each kind carries one sentence and an example": the explanation of the kinds is folded and holds an example of each of the six kinds; the page writes nothing
test("UC-040 steps 1 and 2 — through the frame, the page lists the declared resources by kind with their pin, licence, maintainer and route, and explains itself", async (t) => {
  const page = await visit(t, FRAGMENT);
  assert.equal(byTag(page.main(), "h2")[0].textContent, "Resources");
  assert.ok(page.main().textContent.includes("alice/thesis-tool"));
  assert.deepEqual(byTag(page.main(), "h3").map((heading) => heading.textContent), ["Repository", "Compute"]);
  assert.deepEqual(names(page), ["dlls", "cluster"]);
  assert.equal(line(page, "dlls", "resource-pin"), `Pin: ${OLD}`);
  assert.equal(line(page, "dlls", "resource-licence"), "Licence: MIT");
  assert.equal(line(page, "dlls", "resource-maintainer"), "Maintainer: the Acme organisation");
  assert.equal(line(page, "dlls", "resource-route"), "Route: read on its host");
  assert.equal(line(page, "cluster", "resource-route"), "Route: runner:gpu");
  const folded = byTag(page.main(), "details");
  assert.ok(folded.length >= 1 && folded.every((each) => !each.hasAttribute("open")), "the explanations are folded");
  const text = folded.map((each) => each.textContent).join("\n");
  for (const word of ["resource", "requirement source", "participant", "speech-dlls", "Llama-3.1-8B", "Alex", "vLLM", "EU AI Act", "Claude Code"]) assert.ok(text.includes(word), `the explanations name ${word}`);
  const anchors = folded.flatMap((each) => byTag(each, "a")).map((anchor) => anchor.getAttribute("href"));
  for (const href of ["#use-case/id=UC-015", "#use-case/id=UC-017"]) assert.ok(anchors.includes(href), `the page links ${href}`);
  for (const example of ["speech-dlls", "Hugging Face dataset", "Hugging Face model", "SLURM cluster", "vLLM or Ollama", "agent service"]) assert.ok(text.includes(example), `a kind carries its example ${example}`);
  assert.deepEqual(page.world.requests.filter((request) => request.method !== "GET" && request.url.pathname !== "/graphql"), []);
});

// TST-1041002 · level: system · module: MOD-settings-pages; MOD-resource-list
// guards: UC-040; A RESOURCE IS PINNED TO AN EXACT STATE; A RESOURCE DECLARES ITS LICENCE; A RESOURCE NAMES ITS MAINTAINER; A RESOURCE ENTRY NAMES ITS SECRET, NOT ITS VALUE; A PERSON'S OWN INPUT IS COMMITTED DIRECTLY; ONE CLICK PER DECISION; A RESTRICTED RESOURCE IS REFERENCED, NEVER COPIED
// given: the page of TST-1041001; the repository alice/dlls2 is readable with the product's token and holds a file whose text is the sentinel; the instance's list is the one of the fixture
// input: choose the kind repository, name the resource "tools", paste https://github.com/alice/dlls2, press "+ Add resource"; type into the list its licence "MIT", its maintainer "the Acme organisation" and its secret "ci:DLLS_TOKEN"; press Save; press Check on tools
// expect: step 3 "Agent M reads the current commit with the stored token of that server and pins it": the form's list holds the new row pinned to the head of alice/dlls2 (a full commit of 40 digits), and (flow: UC-040 steps 2 to 5, 7 and 8) until the licence and the maintainer are typed it names A RESOURCE DECLARES ITS LICENCE and A RESOURCE NAMES ITS MAINTAINER and Save is disabled; nothing is committed before Save; step 8 "Save — one click. Agent M commits the entry to docs/resources.md of the product repository: name, kind, address, pin, licence, maintainer, route, processing place, name of the secret — never its value, never restricted content": one press gives one commit to alice/thesis-tool, made with the product's token, holding only docs/resources.md with the old rows byte for byte and the new row; no commit anywhere else; no commit holds a token or the sentinel; no request reads a file of alice/dlls2; step 7 "reads the resource on its host": Check says tools stands at its pin and writes nothing
test("UC-040 steps 2 to 8 — through the frame, a repository is added, pinned to its head, described and saved in one commit of docs/resources.md", async (t) => {
  const page = await visit(t, FRAGMENT);
  await add(page, "repository", "tools", "https://github.com/alice/dlls2");
  const head = /\| tools \| repository \| https:\/\/github\.com\/alice\/dlls2 \| ([0-9a-f]{40}) \|/.exec(areaOf(page).value)?.[1];
  assert.ok(head, "the row is pinned to a full commit");
  assert.equal(head, headOf("alice/dlls2"), "the pin is the head of alice/dlls2");
  assert.match(marks(page), /A RESOURCE DECLARES ITS LICENCE/);
  assert.match(marks(page), /A RESOURCE NAMES ITS MAINTAINER/);
  assert.equal(saveOf(page).disabled, true);
  assert.equal(commitsOf(page, PRODUCT_REPO).length, 0, "nothing is committed before Save");
  await typeInto(areaOf(page), areaOf(page).value.replace(/\| tools \| repository \| ([^|]+) \| ([0-9a-f]{40}) \| — \| — \| ([^|]+) \| — \| — \| — \|/, "| tools | repository | $1 | $2 | MIT | the Acme organisation | $3 | — | — | ci:DLLS_TOKEN |"));
  assert.equal(saveOf(page).disabled, false);
  await click(saveOf(page));
  assert.equal(commitsOf(page, PRODUCT_REPO).length, 1, "one click, one commit");
  const commit = commitsOf(page, PRODUCT_REPO)[0];
  assert.deepEqual(Object.keys(commit.files), ["docs/resources.md"]);
  assert.equal(commit.files["docs/resources.md"], list("thesis-tool", DLLS, CLUSTER, `| tools | repository | https://github.com/alice/dlls2 | ${head} | MIT | the Acme organisation | read on its host | — | — | ci:DLLS_TOKEN |`));
  assert.equal(commit.authorization, `Bearer ${PRODUCT_TOKEN}`);
  assert.equal(allCommits(page).length, 1);
  assert.deepEqual(secretsInCommits(page), []);
  assert.equal(JSON.stringify(commit.files).includes(CONTENT), false);
  assert.deepEqual(readContent(page), []);
  assert.deepEqual(names(page), ["dlls", "tools", "cluster"]);
  await click(labelled(entry(page, "tools"), "Check"));
  assert.match(withClass(entry(page, "tools"), "resource-current")[0].textContent, new RegExp(`^✓ https://github.com/alice/dlls2 stands at its pin, ${head}\\.$`));
  assert.equal(allCommits(page).length, 1, "Check writes nothing");
});

// TST-1041003 · level: system · module: MOD-settings-pages; MOD-resource-list
// guards: UC-040; A COMPUTE RESOURCE IS REACHED THROUGH THE BRIDGE OR A SELF-HOSTED RUNNER; A RESOURCE DECLARES WHERE IT PROCESSES DATA; A RESOURCE IS PINNED TO AN EXACT STATE; A RESOURCE CREDENTIAL GOES ONLY TO ITS RESOURCE
// given: the page of TST-1041001; this browser keeps the Bridge hpc (address http://127.0.0.1:4712, a pairing token), whose fake answers the harmless request for the partitions with debug (up) and gpu (drain)
// input: choose the kind compute, name "alex", give the address "alex.nhr.fau.de", press "+ Add resource"; type the route "bridge hpc" and the place "NHR@FAU, Erlangen" into the list and press Save; press Check on alex
// expect: step 3 "the author names it and the route: a Bridge, chosen by its name": a compute resource needs no pin (the software environment on it is pinned in the product's job files, not here); the form (flow: UC-040 steps 3, 6, 7 and 8) opens naming that the route and the processing place are missing (A RESOURCE DECLARES WHERE IT PROCESSES DATA) and Save is disabled; nothing is committed before Save; with the route and the place, one press of Save gives one commit holding only docs/resources.md with the row, a dash as its pin; step 7 "through the Bridge the route names, with its token, a harmless request — for a SLURM cluster the partition list": Check makes one request, to http://127.0.0.1:4712/v1/probes/partitions, with the pairing token in the Bridge's header and none in its address, and shows "✓ The Bridge hpc lists the partitions: debug (up), gpu (drain)."; no further commit, no request to GitHub, and no commit holds a token
test("UC-040 steps 3, 6, 7, 8 — through the frame, a compute resource on a Bridge is declared with its route and place, saved in one commit and checked by a harmless request", async (t) => {
  const page = await visit(t, FRAGMENT, { bridges: { hpc: "http://127.0.0.1:4712" } });
  await add(page, "compute", "alex", "alex.nhr.fau.de");
  assert.match(marks(page), /A RESOURCE DECLARES WHERE IT PROCESSES DATA/);
  assert.equal(saveOf(page).disabled, true);
  const row = (route, place) => `| alex | compute | alex.nhr.fau.de | — | — | — | ${route} | ${place} | — | — |`;
  assert.ok(areaOf(page).value.includes(row("—", "—")), "known positive: the draft row stands in the form with its route and place left out");
  assert.equal(allCommits(page).length, 0, "nothing is committed before Save");
  await typeInto(areaOf(page), areaOf(page).value.replace(row("—", "—"), row("bridge hpc", "NHR@FAU, Erlangen")));
  assert.equal(saveOf(page).disabled, false);
  await click(saveOf(page));
  assert.equal(commitsOf(page, PRODUCT_REPO).length, 1);
  assert.deepEqual(Object.keys(commitsOf(page, PRODUCT_REPO)[0].files), ["docs/resources.md"]);
  assert.equal(commitsOf(page, PRODUCT_REPO)[0].files["docs/resources.md"], list("thesis-tool", DLLS, CLUSTER, row("bridge hpc", "NHR@FAU, Erlangen")));
  const calls = bridgeAnswering({ partitions: { answer: { partitions: [{ name: "debug", state: "up" }, { name: "gpu", state: "drain" }] } } });
  const before = page.world.requests.length;
  await click(labelled(entry(page, "alex"), "Check"));
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "http://127.0.0.1:4712/v1/probes/partitions");
  assert.equal(JSON.stringify(calls[0].init.headers).includes(BRIDGE_TOKEN), true, "the token is in the Bridge's header");
  assert.equal(calls[0].url.includes(BRIDGE_TOKEN), false, "and not in its address");
  assert.equal(withClass(entry(page, "alex"), "resource-bridge-answer")[0].textContent, "✓ The Bridge hpc lists the partitions: debug (up), gpu (drain).");
  assert.equal(page.world.requests.length, before, "no request to GitHub");
  assert.equal(allCommits(page).length, 1);
  assert.deepEqual(secretsInCommits(page), []);
});

// TST-1041004 · level: system · module: MOD-settings-pages; MOD-resource-list
// guards: UC-040; A COMPUTE RESOURCE IS REACHED THROUGH THE BRIDGE OR A SELF-HOSTED RUNNER; A JOB RUNS ONLY WHERE ITS RESOURCES ARE REACHABLE; ONE CLICK PER DECISION; A PERSON'S OWN INPUT IS COMMITTED DIRECTLY
// given: the product is private and holds Agent M's job workflow; the instance's register holds the CI agent ci-drafter on `ci runner:gpu secret CI_KEY`
// input: choose the kind compute, name "gpu-box", give the address "gpu01.example.org", press "+ Add resource"; type the route "runner:gpu" and the place "the group's workstation"; press Save; open the page again; press Check on gpu-box; a click a script makes on Run; the person's click on Run
// expect: Save gives one commit holding only docs/resources.md with the row; 7b "The route is a self-hosted runner. The browser cannot reach it; Agent M offers a check job on that runner label through the (flow: UC-040 steps 3, 7 and 7b) product's workflow and shows its result on the dashboard": Check names the job and the runner gpu and shows the run panel naming ci-drafter, with a button Run, and writes nothing; the script's click writes nothing; the person's click gives one commit that adds one file docs/jobs/JOB-<date>-<time>-<4 hex>.md to alice/thesis-tool and changes no other, made with the product's token; the record names the kind check-resource, the participant ci-drafter, the route "ci runner:gpu" and the resource gpu-box; docs/resources.md is not among the files of that commit; nothing is committed to the instance
test("UC-040 step 7b — through the frame, a compute resource on a runner is checked by a check job that is shown first and queued on the person's click", async (t) => {
  const page = await visit(t, FRAGMENT);
  await add(page, "compute", "gpu-box", "gpu01.example.org");
  const row = (route, place) => `| gpu-box | compute | gpu01.example.org | — | — | — | ${route} | ${place} | — | — |`;
  await typeInto(areaOf(page), areaOf(page).value.replace(row("—", "—"), row("runner:gpu", "the group's workstation")));
  await click(saveOf(page));
  assert.equal(commitsOf(page, PRODUCT_REPO).length, 1);
  assert.deepEqual(Object.keys(commitsOf(page, PRODUCT_REPO)[0].files), ["docs/resources.md"]);
  assert.equal(commitsOf(page, PRODUCT_REPO)[0].files["docs/resources.md"], list("thesis-tool", DLLS, CLUSTER, row("runner:gpu", "the group's workstation")));
  await go(page, "#resources");
  await go(page, FRAGMENT);
  await click(labelled(entry(page, "gpu-box"), "Check"));
  assert.match(withClass(entry(page, "gpu-box"), "resource-runner")[0].textContent, /^The check runs as the job JOB-\d{8}-\d{4}-[0-9a-f]{4} on the runner gpu, with the participant ci-drafter\.$/);
  const panel = withClass(entry(page, "gpu-box"), "run-panel")[0];
  assert.match(panel.textContent, /ci-drafter/);
  const run = labelled(panel, "Run");
  assert.ok(run, "the run panel offers Run");
  assert.equal(commitsOf(page, PRODUCT_REPO).length, 1, "Check writes nothing");
  await press(run);
  await settle();
  assert.equal(commitsOf(page, PRODUCT_REPO).length, 1, "a click a script makes writes nothing");
  await click(run);
  assert.equal(commitsOf(page, PRODUCT_REPO).length, 2);
  const commit = commitsOf(page, PRODUCT_REPO)[1];
  const paths = Object.keys(commit.files);
  assert.equal(paths.length, 1);
  assert.match(paths[0], /^docs\/jobs\/JOB-\d{8}-\d{4}-[0-9a-f]{4}\.md$/);
  for (const word of ["check-resource", "ci-drafter", "ci runner:gpu", "gpu-box"]) assert.ok(commit.files[paths[0]].includes(word), `the job record names ${word}`);
  assert.equal(commit.authorization, `Bearer ${PRODUCT_TOKEN}`);
  assert.equal(commitsOf(page, INSTANCE).length, 0);
  assert.deepEqual(secretsInCommits(page), []);
});

// TST-1041005 · level: system · module: MOD-settings-pages; MOD-resource-list
// guards: UC-040; A JOB RUNS ONLY WHERE ITS RESOURCES ARE REACHABLE
// given: the product is public (a self-hosted runner serves a private repository only) and holds Agent M's job workflow; its list names cluster on the runner gpu; the instance's register holds ci-drafter on `ci runner:gpu`
// input: press Check on cluster
// expect: 9b "No runtime reaches the resource. The job is not offered; Agent M names the resource and the missing route": the page says that no CI agent of the instance reaches the runner gpu and that nothing (flow: UC-040 steps 7b and 9b) can check cluster until one does, gives the reason (the runner serves private repositories only), offers no Run, and writes nothing
test("UC-040 steps 7b, 9b — through the frame, a check job is not offered where no runtime reaches the resource, and the page names the resource and the route", async (t) => {
  const page = await visit(t, FRAGMENT, { visibility: "public" });
  await click(labelled(entry(page, "cluster"), "Check"));
  const said = withClass(entry(page, "cluster"), "resource-no-runner")[0].textContent;
  assert.match(said, /^No CI agent of the instance reaches the runner gpu: .*private.*Nothing can check cluster until one does\.$/);
  assert.equal(Boolean(labelled(entry(page, "cluster"), "Run")), false, "no Run is offered");
  assert.equal(allCommits(page).length, 0);
});

// TST-1041006 · level: system · module: MOD-settings-pages; MOD-resource-list
// guards: UC-040; A PERSON'S OWN INPUT IS COMMITTED DIRECTLY; ONE CLICK PER DECISION
// given: the product holds the job record docs/jobs/JOB-20261005-1432-7f3a.md whose inputs pin dlls, the record JOB-20261005-1500-aaaa whose inputs pin another resource, the test tests/dlls.test.mjs that names dlls and tests/other.test.mjs that does not
// input: press Remove on dlls; press Save
// expect: 1a "Agent M lists the jobs and tests that name it; they are listed, not changed, and the removal is committed on Save": Remove lists the first record and tests/dlls.test.mjs in the entry and neither of (flow: UC-040 alternative 1a) the others, and writes nothing; Save gives one commit holding only docs/resources.md, whose list lacks dlls and holds the other rows byte for byte; the job record and the tests stand as they were
test("UC-040 alternative 1a — through the frame, Remove lists the jobs and tests that name the resource and Save commits the removal alone", async (t) => {
  const record = (id, name) => `---\nid: ${id}\nkind: implement\ninputs:\n  - ${name}@${OLD}\nlimit: 5\n---\n`;
  const files = { "docs/resources.md": PRODUCT_LIST, ...WORKFLOW, "docs/jobs/JOB-20261005-1432-7f3a.md": record("JOB-20261005-1432-7f3a", "dlls"),
    "docs/jobs/JOB-20261005-1500-aaaa.md": record("JOB-20261005-1500-aaaa", "cluster-two"), "tests/dlls.test.mjs": "// guards the library dlls\n", "tests/other.test.mjs": "// guards another\n" };
  const page = await visit(t, FRAGMENT, { productFiles: files });
  const before = { ...filesOf(page, PRODUCT_REPO) };
  await click(labelled(entry(page, "dlls"), "Remove"));
  const named = withClass(entry(page, "dlls"), "resource-named-by")[0].textContent;
  assert.ok(named.includes("docs/jobs/JOB-20261005-1432-7f3a.md") && named.includes("tests/dlls.test.mjs"), named);
  assert.ok(!named.includes("JOB-20261005-1500-aaaa") && !named.includes("tests/other.test.mjs"), named);
  assert.equal(allCommits(page).length, 0, "listing writes nothing");
  assert.equal(areaOf(page).value.includes("| dlls |"), false, "the form opens without the entry");
  await click(saveOf(page));
  assert.equal(commitsOf(page, PRODUCT_REPO).length, 1);
  assert.deepEqual(Object.keys(commitsOf(page, PRODUCT_REPO)[0].files), ["docs/resources.md"]);
  assert.equal(commitsOf(page, PRODUCT_REPO)[0].files["docs/resources.md"], list("thesis-tool", CLUSTER));
  assert.deepEqual({ ...filesOf(page, PRODUCT_REPO), "docs/resources.md": before["docs/resources.md"] }, before, "no other file changed");
});

// TST-1041007 · level: system · module: MOD-settings-pages; MOD-resource-list
// guards: UC-040; THE INSTANCE DECLARES ITS OWN RESOURCES; INSTANCE AND PRODUCT RESOURCES ARE INDEPENDENT; A PERSON'S OWN INPUT IS COMMITTED DIRECTLY
// given: the instance's list holds shared-llm and cluster; the product's list holds dlls and cluster
// input: open #resources (which names no product); read the page; choose the kind compute, name "alex", address "alex.nhr.fau.de", press "+ Add resource"; type the route "bridge hpc" and the place; press Save; then open the product's page and press Save of a new entry there
// expect: 1b "Settings → Instance resources runs the same steps 2–8 and commits to docs/resources.md of the instance repository; no product's list changes": the page is headed "Instance resources", names akmaier/agent-m, (flow: UC-040 alternative 1b) lists shared-llm and cluster and not dlls, and offers no Copy from the instance; the Save gives one commit to akmaier/agent-m, made with the instance's token, holding only docs/resources.md with the instance's rows and the new one; the product's repository has no commit and its list is byte for byte the same; and the other way round: a Save in the product's page leaves the instance's list byte for byte as the first Save wrote it
test("UC-040 alternative 1b — through the frame, the instance's list is declared by the same steps and a save in one list leaves the other unchanged", async (t) => {
  const page = await visit(t, "#resources");
  assert.equal(byTag(page.main(), "h2")[0].textContent, "Instance resources");
  assert.ok(page.main().textContent.includes(INSTANCE));
  assert.deepEqual(names(page), ["cluster", "shared-llm"]);
  assert.equal(Boolean(labelled(page.main(), "Copy from the instance")), false, "no Copy from the instance is offered");
  const productList = filesOf(page, PRODUCT_REPO)["docs/resources.md"];
  await add(page, "compute", "alex", "alex.nhr.fau.de");
  const row = (route, place) => `| alex | compute | alex.nhr.fau.de | — | — | — | ${route} | ${place} | — | — |`;
  await typeInto(areaOf(page), areaOf(page).value.replace(row("—", "—"), row("bridge hpc", "NHR@FAU, Erlangen")));
  await click(saveOf(page));
  assert.equal(commitsOf(page, INSTANCE).length, 1);
  assert.deepEqual(Object.keys(commitsOf(page, INSTANCE)[0].files), ["docs/resources.md"]);
  const written = list("agent-m", LLM, CLUSTER, row("bridge hpc", "NHR@FAU, Erlangen"));
  assert.equal(commitsOf(page, INSTANCE)[0].files["docs/resources.md"], written);
  assert.equal(commitsOf(page, INSTANCE)[0].authorization, `Bearer ${TOKEN}`);
  assert.equal(commitsOf(page, PRODUCT_REPO).length, 0);
  assert.equal(filesOf(page, PRODUCT_REPO)["docs/resources.md"], productList);
  await go(page, FRAGMENT);
  await add(page, "compute", "second", "second.example.org");
  const second = (route, place) => `| second | compute | second.example.org | — | — | — | ${route} | ${place} | — | — |`;
  await typeInto(areaOf(page), areaOf(page).value.replace(second("—", "—"), second("runner:gpu", "the group's workstation")));
  await click(saveOf(page));
  assert.equal(commitsOf(page, PRODUCT_REPO).length, 1);
  assert.equal(filesOf(page, PRODUCT_REPO)["docs/resources.md"], list("thesis-tool", DLLS, CLUSTER, second("runner:gpu", "the group's workstation")));
  assert.equal(commitsOf(page, INSTANCE).length, 1, "the instance has no further commit");
  assert.equal(filesOf(page, INSTANCE)["docs/resources.md"], written, "the instance's list is as the first Save wrote it");
});

// TST-1041008 · level: system · module: MOD-settings-pages; MOD-resource-list
// guards: UC-040; INSTANCE AND PRODUCT RESOURCES ARE INDEPENDENT; ONE CLICK PER DECISION
// given: the instance's list holds shared-llm and cluster; the product's list holds dlls and cluster
// input: on the product's page choose shared-llm in "An instance resource" and press "Copy from the instance"; press Save; then change the place of shared-llm in the instance's page and press Save; then change its place in the product's page and press Save
// expect: 2c "Agent M offers Copy from the instance: the entry is copied into the product's list, where it is edited and saved like any other. The copy is not linked; a later change on either side leaves the (flow: UC-040 alternative 2c) other unchanged": only shared-llm is offered (cluster is the product's already); the form holds the copy of the instance's row; the first Save gives one commit to the product with dlls, cluster and the copy byte for byte as the instance's row, and none to the instance, whose list is as it was; the change in the instance's page leaves the product's list byte for byte as it was; the change in the product's page leaves the instance's list byte for byte as the previous Save wrote it
test("UC-040 alternative 2c — through the frame, an instance resource is copied into the product's list and the two copies are not linked", async (t) => {
  const page = await visit(t, FRAGMENT);
  const choice = withClass(page.main(), "resources-copy-choice")[0];
  assert.deepEqual(byTag(choice, "option").map((option) => option.value), ["shared-llm"]);
  choice.value = "shared-llm";
  await click(labelled(page.main(), "Copy from the instance"));
  assert.ok(areaOf(page).value.includes(LLM), "the form holds the instance's row");
  await click(saveOf(page));
  const copied = list("thesis-tool", DLLS, CLUSTER, LLM);
  assert.equal(commitsOf(page, PRODUCT_REPO).length, 1);
  assert.equal(commitsOf(page, PRODUCT_REPO)[0].files["docs/resources.md"], copied);
  assert.equal(commitsOf(page, INSTANCE).length, 0);
  assert.equal(filesOf(page, INSTANCE)["docs/resources.md"], INSTANCE_LIST);
  const moved = (text, place) => text.replace("the group's workstation", place);
  await go(page, "#resources");
  const instanceArea = areaOf(await openEdit(page));
  await typeInto(instanceArea, moved(instanceArea.value, "the instance's server room"));
  await click(saveOf(page));
  assert.equal(commitsOf(page, INSTANCE).length, 1);
  assert.equal(filesOf(page, INSTANCE)["docs/resources.md"], moved(INSTANCE_LIST, "the instance's server room"));
  assert.equal(filesOf(page, PRODUCT_REPO)["docs/resources.md"], copied, "the product's copy did not follow");
  await go(page, FRAGMENT);
  const productArea = areaOf(await openEdit(page));
  await typeInto(productArea, productArea.value.replace("the group's workstation", "the product's own machine"));
  await click(saveOf(page));
  assert.equal(commitsOf(page, PRODUCT_REPO).length, 2);
  assert.equal(filesOf(page, PRODUCT_REPO)["docs/resources.md"], moved(copied, "the product's own machine"));
  assert.equal(filesOf(page, INSTANCE)["docs/resources.md"], moved(INSTANCE_LIST, "the instance's server room"), "the instance's list did not follow");
});
// *Edit the list* opens the list in the form; the page is returned.
async function openEdit(page) {
  await click(labelled(page.main(), "Edit the list"));
  return page;
}

// TST-1041009 · level: system · module: MOD-settings-pages; MOD-resource-list
// guards: UC-040; A PINNED RESOURCE MOVES ONLY WHEN A PERSON MOVES IT; ONE CLICK PER DECISION; A PERSON'S OWN INPUT IS COMMITTED DIRECTLY
// given: the product's list pins dlls to the commit of 40 "b" and a second repository, other, to the commit of 40 "b" as well; the repository alice/dlls stands at its head (the SHA-1 of "alice/dlls#0"); the product holds the job record docs/jobs/JOB-20261005-1432-7f3a.md whose inputs pin dlls and the test tests/dlls.test.mjs that names it
// input: add the entry "tools" (alice/dlls2) and save; press Check on dlls; a click a script makes on Move; the person's click on Move; press Check on dlls again
// expect: a Save of another entry leaves the pin of dlls as it was (byte for byte); 9a "A newer state exists upstream — a newer commit. The dashboard shows it beside the pin with the jobs that use the resource; (flow: UC-040 alternative 9a) the pin changes only when the author presses Move — one click — which commits the new pin to docs/resources.md": Check writes nothing and shows the head beside the pin "bbbb…" with the job record and the test that name dlls and a button Move; the script's click writes nothing; the person's click writes one commit holding only docs/resources.md in which only the pin of dlls is the head (the other rows, other among them, byte for byte), made with the product's token; the entry then reads Pin: <the head>, and a second Check says it stands at its pin and offers no Move
test("UC-040 alternative 9a — through the frame, a newer state upstream is shown beside the pin and the pin moves by the person's click alone", async (t) => {
  const other = DLLS.replace("| dlls | repository | https://github.com/alice/dlls |", "| other | repository | https://github.com/alice/other |");
  const files = { "docs/resources.md": list("thesis-tool", DLLS, other, CLUSTER), ...WORKFLOW, "docs/jobs/JOB-20261005-1432-7f3a.md": `---\nid: JOB-20261005-1432-7f3a\nkind: implement\ninputs:\n  - dlls@${OLD}\nlimit: 5\n---\n`,
    "tests/dlls.test.mjs": "// guards the library dlls\n" };
  const page = await visit(t, FRAGMENT, { productFiles: files });
  await add(page, "repository", "tools", "https://github.com/alice/dlls2");
  await typeInto(areaOf(page), areaOf(page).value.replace(/\| tools \| repository \| ([^|]+) \| ([0-9a-f]{40}) \| — \| — \|/, "| tools | repository | $1 | $2 | MIT | the Acme organisation |"));
  await click(saveOf(page));
  const afterSave = filesOf(page, PRODUCT_REPO)["docs/resources.md"];
  assert.equal(commitsOf(page, PRODUCT_REPO).length, 1);
  assert.ok(afterSave.includes(DLLS) && afterSave.includes(other), "the Save of another entry leaves the pins of dlls and other as they were");
  const head = headOf("alice/dlls");
  await click(labelled(entry(page, "dlls"), "Check"));
  assert.equal(commitsOf(page, PRODUCT_REPO).length, 1, "Check writes nothing");
  assert.equal(withClass(entry(page, "dlls"), "resource-newer")[0].textContent, `A newer state exists upstream: ${head}. The pin is ${OLD}.`);
  const named = withClass(entry(page, "dlls"), "resource-named-by")[0].textContent;
  assert.ok(named.includes("docs/jobs/JOB-20261005-1432-7f3a.md") && named.includes("tests/dlls.test.mjs"), named);
  const move = labelled(entry(page, "dlls"), "Move");
  assert.ok(move, "the page offers Move");
  await press(move);
  await settle();
  assert.equal(commitsOf(page, PRODUCT_REPO).length, 1, "a click a script makes writes nothing");
  await click(move);
  assert.equal(commitsOf(page, PRODUCT_REPO).length, 2);
  const commit = commitsOf(page, PRODUCT_REPO)[1];
  assert.deepEqual(Object.keys(commit.files), ["docs/resources.md"]);
  assert.equal(commit.files["docs/resources.md"], afterSave.replace(DLLS, DLLS.replace(OLD, head)));
  assert.equal(commit.authorization, `Bearer ${PRODUCT_TOKEN}`);
  assert.equal(line(page, "dlls", "resource-pin"), `Pin: ${head}`);
  await click(labelled(entry(page, "dlls"), "Check"));
  assert.equal(withClass(entry(page, "dlls"), "resource-current")[0].textContent, `✓ https://github.com/alice/dlls stands at its pin, ${head}.`);
  assert.equal(Boolean(labelled(entry(page, "dlls"), "Move")), false, "no Move is offered");
  assert.equal(commitsOf(page, INSTANCE).length, 0);
});

const LLM_ROW_ONLY = { "docs/resources.md": list("thesis-tool", DLLS, LLM), ...WORKFLOW };

// TST-1041010 · level: system · module: MOD-settings-pages; MOD-resource-list
// guards: UC-040; A PINNED RESOURCE MOVES ONLY WHEN A PERSON MOVES IT; A RESOURCE CREDENTIAL GOES ONLY TO ITS RESOURCE
// given: the product's list pins the endpoint shared-llm to the served model "example-model"; this browser keeps the Bridge workstation, whose fake answers the harmless request for the served models with "other-model" and "example-model-2"
// input: press Check on shared-llm
// expect: 7 "through the Bridge the route names, with its token, a harmless request — for an endpoint the list of served models — and shows what answered": one request, to (flow: UC-040 steps 7 and 7c) http://127.0.0.1:4711/v1/probes/endpoint-models; 7c "The endpoint serves a different model than the one pinned earlier. Agent M shows both identifiers; the pin changes only if the author chooses Move": the entry shows the pin "example-model" and the served models "other-model, example-model-2"; nothing is committed and the list in the repository is byte for byte as it was
test("UC-040 steps 7, 7c — through the frame, an endpoint that serves another model shows both identifiers and its pin stays", async (t) => {
  const page = await visit(t, FRAGMENT, { productFiles: LLM_ROW_ONLY, bridges: { workstation: "http://127.0.0.1:4711" } });
  const calls = bridgeAnswering({ "endpoint-models": { answer: { models: ["other-model", "example-model-2"] } } });
  await click(labelled(entry(page, "shared-llm"), "Check"));
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "http://127.0.0.1:4711/v1/probes/endpoint-models");
  assert.equal(line(page, "shared-llm", "resource-pin"), "Pin: example-model");
  assert.equal(withClass(entry(page, "shared-llm"), "resource-bridge-answer")[0].textContent, "✓ The Bridge workstation serves: other-model, example-model-2.");
  assert.equal(allCommits(page).length, 0);
  assert.equal(filesOf(page, PRODUCT_REPO)["docs/resources.md"], LLM_ROW_ONLY["docs/resources.md"]);
});

// TST-1041011 · level: system · module: MOD-settings-pages; MOD-resource-list
// guards: UC-040; A RESOURCE CREDENTIAL GOES ONLY TO ITS RESOURCE; THE LOCAL BRIDGE REQUIRES A TOKEN; ONE CLICK PER DECISION
// given: the product's list names shared-llm on `bridge workstation`; four browsers: one keeps no Bridge of that name, one keeps it at an address where nothing answers, one keeps it and the fake refuses its token (401), one keeps it without a token
// input: in each, press Check on shared-llm; in the first, then press Edit the list, change the processing place and press Save
// expect: 7a "The Bridge the route names does not answer. Agent M names the reason — not running, wrong address, token missing — and saves nothing until the author decides to save unchecked": the entry says (flow: UC-040 alternative 7a) "This browser does not keep Bridge workstation.", "The Bridge gave no answer", "The Bridge refused its pairing token." and "The Bridge has no pairing token." in turn, and no check makes a commit; the author's own Save of the list, unchecked, gives one commit with the changed place and no other change
test("UC-040 alternative 7a — through the frame, a Bridge that does not answer is named with the reason, and the check saves nothing", async (t) => {
  const check = async (bridges, answer) => {
    const page = await visit(t, FRAGMENT, { productFiles: LLM_ROW_ONLY, bridges });
    if (answer) answer();
    await click(labelled(entry(page, "shared-llm"), "Check"));
    assert.equal(allCommits(page).length, 0, "a check saves nothing");
    return withClass(entry(page, "shared-llm"), "resource-bridge-answer")[0].textContent;
  };
  const refusing = (status) => () => {
    const inner = globalThis.fetch;
    globalThis.fetch = async (url, init) => (String(url).startsWith("http://127.0.0.1:") ? new Response(JSON.stringify({ error: "token" }), { status }) : inner(url, init));
  };
  assert.equal(await check({}), "✗ This browser does not keep Bridge workstation.");
  assert.match(await check({ workstation: "http://127.0.0.1:4711" }, () => bridgeAnswering({ "endpoint-models": new TypeError("fetch failed") })), /^✗ The Bridge gave no answer: fetch failed.* — nothing was read\.$/);
  assert.equal(await check({ workstation: "http://127.0.0.1:4711" }, refusing(401)), "✗ The Bridge refused its pairing token. — nothing was read.");
  assert.equal(await check({ workstation: { address: "http://127.0.0.1:4711" } }), "✗ The Bridge has no pairing token. — nothing was read.");
  const page = await visit(t, FRAGMENT, { productFiles: LLM_ROW_ONLY });
  await click(labelled(entry(page, "shared-llm"), "Check"));
  await click(labelled(page.main(), "Edit the list"));
  await typeInto(areaOf(page), areaOf(page).value.replace("the group's workstation", "the group's server"));
  await click(saveOf(page));
  assert.equal(commitsOf(page, PRODUCT_REPO).length, 1, "the author's own Save, unchecked, gives one commit");
  assert.equal(filesOf(page, PRODUCT_REPO)["docs/resources.md"], LLM_ROW_ONLY["docs/resources.md"].replace("the group's workstation", "the group's server"));
});

// TST-1041012 · level: system · module: MOD-settings-pages; MOD-resource-list
// guards: UC-040; A RESOURCE IS PINNED TO AN EXACT STATE; A PERSON'S OWN INPUT IS COMMITTED DIRECTLY; A RESTRICTED RESOURCE IS REFERENCED, NEVER COPIED
// given: the repository https://github.com/alice/hidden is not readable with the stored token (its host answers not found)
// input: choose the kind repository, name "hidden", paste its address, press "+ Add resource"; then type the pin (40 hex digits), the licence "restricted — internal" and the maintainer "the Acme organisation" and press Save
// expect: 3a "A private repository is not readable with the stored token. Agent M says so ...; nothing is saved until the check succeeds or the author saves it unchecked": the page says that the head of the (flow: UC-040 alternative 3a) repository could not be read; the form opens with the row but without a pin, names A RESOURCE IS PINNED TO AN EXACT STATE and Save is disabled; nothing is committed; once the person has typed the pin, the licence and the maintainer, the Save gives one commit holding the row with the typed pin; no commit holds a token
test("UC-040 alternative 3a — through the frame, a repository the token cannot read is named, nothing is saved until the person saves it unchecked with a pin they paste", async (t) => {
  const page = await visit(t, FRAGMENT);
  await add(page, "repository", "hidden", "https://github.com/alice/hidden");
  assert.match(note(page), /^The head of https:\/\/github\.com\/alice\/hidden could not be read \(/);
  assert.match(marks(page), /A RESOURCE IS PINNED TO AN EXACT STATE/);
  assert.equal(saveOf(page).disabled, true);
  assert.equal(allCommits(page).length, 0, "nothing is saved before the person saves");
  const pin = "d".repeat(40);
  await typeInto(areaOf(page), areaOf(page).value.replace(/\| hidden \| repository \| ([^|]+) \| — \| — \| — \|/, `| hidden | repository | $1 | ${pin} | restricted — internal | the Acme organisation |`));
  await click(saveOf(page));
  assert.equal(commitsOf(page, PRODUCT_REPO).length, 1);
  assert.equal(commitsOf(page, PRODUCT_REPO)[0].files["docs/resources.md"], list("thesis-tool", DLLS, CLUSTER,
    `| hidden | repository | https://github.com/alice/hidden | ${pin} | restricted — internal | the Acme organisation | read on its host | — | — | — |`));
  assert.deepEqual(secretsInCommits(page), []);
});

// TST-1041013 · level: system · module: MOD-settings-pages; MOD-resource-list
// guards: UC-040; A RESTRICTED RESOURCE IS REFERENCED, NEVER COPIED; A RESOURCE DECLARES ITS LICENCE; A RESOURCE NAMES ITS MAINTAINER
// given: the repository alice/dlls is readable with the token and holds a file whose text is the sentinel; the product's list is empty of it
// input: add the repository "lib" (https://github.com/alice/dlls); type the licence "unknown" and the maintainer "@alice" (one account); press Save; read the entry; open the list with Edit the list
// expect: 4a "The licence is unknown. The resource is treated as restricted until someone records a licence": the folded explanation of the licence says that an unknown licence counts as restricted and, for a (flow: UC-040 alternatives 4a, 4b and 4c) licence that does not allow redistribution, "only the address and the pin are written to the repository; the content stays where it is"; the one commit holds docs/resources.md alone, with the address and the pin and no text of the repository; no request reads a file of alice/dlls; 4b "the resource entry does not make this a requirement, and links UC-004 to register the licence as a source and UC-015 to link it": the explanation links #use-case/id=UC-004 and #use-case/id=UC-015; 4c "The maintainer is a single person. Agent M shows bus factor 1 beside the entry, with the folded explanation of the PEAKS example; the entry is saved as entered": the entry carries a warning that the maintainer is a single person and names A RESOURCE NAMES ITS MAINTAINER, the explanation names the bus factor and the PEAKS system, and Save was possible
test("UC-040 alternatives 4a, 4b, 4c — through the frame, an unknown licence counts as restricted and only the address and pin are written; a single maintainer is warned of", async (t) => {
  const page = await visit(t, FRAGMENT);
  await add(page, "repository", "lib", "https://github.com/alice/dlls");
  const pin = headOf("alice/dlls");
  await typeInto(areaOf(page), areaOf(page).value.replace(/\| lib \| repository \| ([^|]+) \| ([0-9a-f]{40}) \| — \| — \|/, "| lib | repository | $1 | $2 | unknown | @alice |"));
  const explanation = formOf(page).parentNode.textContent;
  assert.match(explanation, /An unknown licence counts as restricted until\s+someone records it\./);
  assert.match(explanation, /only\s+the address and the pin are written to the repository; the content stays where it is\./);
  const anchors = byTag(formOf(page).parentNode, "a").map((anchor) => anchor.getAttribute("href"));
  for (const href of ["#use-case/id=UC-004", "#use-case/id=UC-015"]) assert.ok(anchors.includes(href), `the explanation links ${href}`);
  assert.match(explanation, /bus factor/);
  assert.match(explanation, /PEAKS/);
  await click(saveOf(page));
  assert.equal(commitsOf(page, PRODUCT_REPO).length, 1, "saved as entered");
  assert.deepEqual(Object.keys(commitsOf(page, PRODUCT_REPO)[0].files), ["docs/resources.md"]);
  assert.ok(commitsOf(page, PRODUCT_REPO)[0].files["docs/resources.md"].includes(`| lib | repository | https://github.com/alice/dlls | ${pin} | unknown | @alice |`));
  assert.equal(JSON.stringify(commitsOf(page, PRODUCT_REPO)[0].files).includes(CONTENT), false);
  assert.deepEqual(readContent(page), []);
  const warning = withClass(entry(page, "lib"), "resource-findings")[0].textContent;
  assert.match(warning, /^warning: lib: its maintainer is a single person/);
  assert.match(warning, /A RESOURCE NAMES ITS MAINTAINER/);
});

// TST-1041014 · level: system · module: MOD-settings-pages; MOD-resource-list
// guards: UC-040; A RESOURCE ENTRY NAMES ITS SECRET, NOT ITS VALUE; A RESOURCE CREDENTIAL GOES ONLY TO ITS RESOURCE; NO SECRET IN THE REPOSITORY
// given: the product's list holds shared-llm with the secret `browser` and dlls with the secret `ci:DLLS_TOKEN`; this browser keeps the Bridge workstation, whose fake answers the served models
// input: read the entries; type the key "sk-llm-key-…" into the key field of shared-llm and press Save key; press Check on shared-llm; type the same key for the Hub model tiny (secret `browser`), press Save key and Check on tiny (the Hub's fake answers the revision); press Edit the list, change the processing place of shared-llm and press Save
// expect: 5 "the author says where it is held: as a CI secret — only its name — or as a key in this browser, stored in localStorage and sent only to that resource's server": the entry of shared-llm reads (flow: UC-040 step 5) "Secret: browser" and has a field for a key and none for dlls (whose entry reads "Secret: ci:DLLS_TOKEN"); Save key stores the key in this browser's localStorage, once, and nowhere else, and writes nothing to any repository; Check of shared-llm goes to the Bridge alone, and neither its address, its headers nor its body hold the key (the endpoint is asked with no key); Check of tiny sends the key to huggingface.co in a header and in no address, and to no request of GitHub; the Save of the list gives one commit, which holds the secret's name `browser` and not the key, and no request URL of the world holds the key
test("UC-040 step 5 — through the frame, a secret is named in the list and a key kept in this browser stays in it", async (t) => {
  const dllsWithSecret = DLLS.replace(/\| — \|$/, "| ci:DLLS_TOKEN |");
  const browserLlm = LLM.replace("ci:LLM_KEY", "browser");
  const tiny = `| tiny | model | someone/tiny | ${OLD} | MIT | someone | read on its host | — | — | browser |`;
  const page = await visit(t, FRAGMENT, { productFiles: { "docs/resources.md": list("thesis-tool", dllsWithSecret, browserLlm, tiny), ...WORKFLOW }, bridges: { workstation: "http://127.0.0.1:4711" } });
  assert.equal(line(page, "shared-llm", "resource-secret"), "Secret: browser");
  assert.equal(line(page, "dlls", "resource-secret"), "Secret: ci:DLLS_TOKEN");
  assert.equal(withClass(entry(page, "shared-llm"), "resource-key-input").length, 1);
  assert.equal(withClass(entry(page, "dlls"), "resource-key-input").length, 0);
  const field = withClass(entry(page, "shared-llm"), "resource-key-input")[0];
  field.value = RESOURCE_KEY;
  await click(labelled(entry(page, "shared-llm"), "Save key"));
  assert.deepEqual(storedKeys().filter((key) => key.endsWith("resource-key:shared-llm")).length, 1);
  assert.deepEqual(storedKeys().filter((key) => globalThis.localStorage.getItem(key).includes(RESOURCE_KEY)).map((key) => key.split(":").slice(-2).join(":")), ["resource-key:shared-llm"]);
  assert.equal(allCommits(page).length, 0);
  const calls = bridgeAnswering({ "endpoint-models": { answer: { models: ["served-a"] } } });
  await click(labelled(entry(page, "shared-llm"), "Check"));
  assert.equal(calls.length, 1);
  assert.equal(JSON.stringify(calls[0]).includes(RESOURCE_KEY), false, "the key goes to no Bridge");
  assert.equal(JSON.parse(calls[0].init.body).args.key, null);
  // The Hub model tiny names the same secret; its key goes to the Hub (the resource's own server) and to no other.
  withClass(entry(page, "tiny"), "resource-key-input")[0].value = RESOURCE_KEY;
  await click(labelled(entry(page, "tiny"), "Save key"));
  const hub = [], inner = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    if (!String(url).startsWith("https://huggingface.co/")) return inner(url, init);
    hub.push({ url: String(url), init });
    return new Response(JSON.stringify({ sha: OLD, cardData: { license: "mit" }, gated: false }), { status: 200 });
  };
  const elsewhere = page.world.requests.length;
  await click(labelled(entry(page, "tiny"), "Check"));
  assert.equal(hub.length, 1);
  assert.equal(JSON.stringify(hub[0].init.headers).includes(RESOURCE_KEY), true, "known positive: the request to the resource's own server carries the key");
  assert.equal(String(hub[0].url).includes(RESOURCE_KEY), false, "and the address does not");
  assert.equal(page.world.requests.slice(elsewhere).some((request) => request.authorization?.includes(RESOURCE_KEY) || request.url.href.includes(RESOURCE_KEY)), false, "no request to GitHub carries it");
  assert.equal(calls.length, 1, "and the Bridge was asked once, before");
  await click(labelled(page.main(), "Edit the list"));
  await typeInto(areaOf(page), areaOf(page).value.replace("the group's workstation", "the group's server"));
  await click(saveOf(page));
  assert.equal(commitsOf(page, PRODUCT_REPO).length, 1);
  assert.ok(commitsOf(page, PRODUCT_REPO)[0].files["docs/resources.md"].includes("| no | browser |"));
  assert.deepEqual(secretsInCommits(page), []);
  assert.equal(page.world.requests.some((request) => request.url.href.includes(RESOURCE_KEY)), false);
});

// TST-1041015 · level: system · module: MOD-resource-list; MOD-runtimes
// guards: UC-040; A JOB RUNS ONLY WHERE ITS RESOURCES ARE REACHABLE
// given: a list of four resources: dlls read on its host, cluster on the runner gpu, hpc on the Bridge hpc, and the endpoint local-llm called at its own address; the instance's register holds the CI agents ci-gpu on `ci runner:gpu secret K` and ci-hosted on `ci hosted secret K`, both in a private product that holds the job workflow
// input: reachableBy over the list; routesFor for each CI agent with the needs it gives
// expect: 9 "Agent M offers only the runtimes and participants that reach it by its route": the needs are cluster (runner:gpu) and hpc (bridge hpc) and not dlls or local-llm; for the need cluster alone ci-gpu is (flow: UC-040 steps 9 and 9b) offered and ci-hosted is not; for the needs cluster and hpc neither is offered; 9b "No runtime reaches the resource. The job is not offered; Agent M names the resource and the missing route": the reason of a refused offer names the resource and its route (cluster and runner:gpu; hpc and bridge hpc). This walks the chain of the two modules without a page: the pages that start a job hand routesFor no needs
test("UC-040 steps 9, 9b — the routes of a job's participants reach only the resources the list says they reach, and a refusal names the resource and the route", async () => {
  const { reachableBy } = await import("../src/resource-list/index.mjs");
  const { routesFor } = await import("../src/runtimes/index.mjs");
  const resource = (name, kind, route) => ({ name, kind, address: "x", pin: null, licence: null, maintainer: null, route, place: null, paid: null, secret: null });
  const list = [resource("dlls", "repository", "read on its host"), resource("cluster", "compute", "runner:gpu"), resource("hpc", "compute", "bridge hpc"), resource("local-llm", "endpoint", "http://localhost:8000/v1")];
  const needs = reachableBy(list);
  assert.deepEqual(needs, [{ resource: "cluster", route: "runner:gpu" }, { resource: "hpc", route: "bridge hpc" }]);
  const gpu = { name: "ci-gpu", route: "ci runner:gpu secret K" }, hosted = { name: "ci-hosted", route: "ci hosted secret K" };
  const product = { visibility: "private", jobWorkflow: true };
  const offered = (participant, wanted) => routesFor(participant, [gpu, hosted], product, wanted).map((offer) => offer.available);
  assert.deepEqual(offered(gpu, []), [true], "known positive: with no need the runner's agent is offered");
  assert.deepEqual(offered(gpu, [needs[0]]), [true]);
  assert.deepEqual(offered(hosted, [needs[0]]), [false]);
  assert.deepEqual(offered(gpu, needs), [false]);
  const refusal = routesFor(hosted, [gpu, hosted], product, [needs[0]])[0].reason;
  assert.ok(refusal.includes("cluster") && refusal.includes("runner:gpu"), refusal);
  const second = routesFor(gpu, [gpu, hosted], product, needs)[0].reason;
  assert.ok(second.includes("hpc") && second.includes("bridge hpc"), second);
});

// TST-1041016 · level: system · module: MOD-settings-pages; MOD-resource-list
// guards: UC-040; ONE SYSTEM IN TWO ROLES IS TWO ENTRIES; ONE CLICK PER DECISION
// given: the product's list holds the endpoint shared-llm and the repository dlls; the participants route is among the frame's routes
// input: press Add as participant on shared-llm; follow the fragment the frame wrote
// expect: 2a "a link opens UC-017 with type and address prefilled. The two entries share no fields": a repository has no such button; the press writes nothing, sets a fragment that names the route (flow: UC-040 alternative 2a) participants and the type "model endpoint" and the address http://workstation.example.org:8000/v1, and the participants page opened at it holds that type and that address in its form
test("UC-040 alternative 2a — through the frame, a system that also works on the product opens the participants page with its type and address", async (t) => {
  const page = await visit(t, FRAGMENT, { productFiles: LLM_ROW_ONLY });
  assert.equal(Boolean(labelled(entry(page, "dlls"), "Add as participant")), false, "no Add as participant is offered");
  assert.ok(labelled(entry(page, "dlls"), "Check"), "known positive: the repository's entry has its buttons");
  await click(labelled(entry(page, "shared-llm"), "Add as participant"));
  const fragment = decodeURIComponent(page.location.hash);
  assert.match(fragment, /^#participants/);
  assert.ok(fragment.includes("model endpoint") && fragment.includes("http://workstation.example.org:8000/v1"), fragment);
  assert.equal(allCommits(page).length, 0);
  await go(page, page.location.hash);
  assert.equal(byTag(page.main(), "h2")[0].textContent, "Participants");
  const values = byTag(page.main(), "input").map((input) => input.value).concat(byTag(page.main(), "select").map((select) => select.value), byTag(page.main(), "textarea").map((area) => area.value));
  assert.ok(values.includes("model endpoint") || values.some((value) => value.includes("model endpoint")), "the type is prefilled");
  assert.ok(values.some((value) => value.includes("http://workstation.example.org:8000/v1")), "the address is prefilled");
});

// TST-1041021 · level: system · module: MOD-settings-pages; MOD-resource-list
// guards: UC-040; A PINNED RESOURCE MOVES ONLY WHEN A PERSON MOVES IT; A RESOURCE IS PINNED TO AN EXACT STATE; ONE CLICK PER DECISION
// given: the product's list pins the Hub model someone/tiny (resource "tiny") to the revision of 40 "b"; the Hub's fake answers a revision of 40 "c"; a second browser where the Hub does not answer
// input: press Check on tiny; a click a script makes on Move; the person's click on Move; in the second browser press Check on tiny
// expect: 9a "a newer commit, revision or served model ... the pin changes only when the author presses Move": Check reads the Hub (one request to huggingface.co) and writes nothing, shows the revision of 40 "c" beside (flow: UC-040 alternatives 3b and 9a) the pin and Move; the script's click writes nothing; the person's click gives one commit changing only the pin of tiny; 3b "The Hub does not answer the browser. The author pastes the revision from the Hub ...": where the Hub does not answer, the entry says that the Hub did not answer for tiny and that a full revision is to be pasted instead, offers no Move and writes nothing
test("UC-040 alternatives 3b, 9a — through the frame, a Hub model's newer revision moves by the person's click, and a Hub that does not answer is named", async (t) => {
  const tiny = `| tiny | model | someone/tiny | ${OLD} | MIT | someone | read on its host | — | — | — |`;
  const files = { "docs/resources.md": list("thesis-tool", DLLS, tiny), ...WORKFLOW };
  const newer = "c".repeat(40);
  const hubAnswering = (answer) => {
    const calls = [], inner = globalThis.fetch;
    globalThis.fetch = async (url, init = {}) => {
      if (!String(url).startsWith("https://huggingface.co/")) return inner(url, init);
      calls.push(String(url));
      if (answer instanceof Error) throw answer;
      return new Response(JSON.stringify(answer), { status: 200 });
    };
    return calls;
  };
  const page = await visit(t, FRAGMENT, { productFiles: files });
  const calls = hubAnswering({ sha: newer, cardData: { license: "mit" }, gated: false });
  await click(labelled(entry(page, "tiny"), "Check"));
  assert.equal(calls.length, 1);
  assert.equal(allCommits(page).length, 0, "Check writes nothing");
  assert.equal(withClass(entry(page, "tiny"), "resource-newer")[0].textContent, `A newer state exists upstream: ${newer}. The pin is ${OLD}.`);
  const move = labelled(entry(page, "tiny"), "Move");
  await press(move);
  await settle();
  assert.equal(allCommits(page).length, 0, "a click a script makes writes nothing");
  await click(move);
  assert.equal(commitsOf(page, PRODUCT_REPO).length, 1);
  assert.equal(commitsOf(page, PRODUCT_REPO)[0].files["docs/resources.md"], list("thesis-tool", DLLS, tiny.replace(OLD, newer)));
  const silent = await visit(t, FRAGMENT, { productFiles: files });
  hubAnswering(new TypeError("Failed to fetch"));
  await click(labelled(entry(silent, "tiny"), "Check"));
  assert.equal(withClass(entry(silent, "tiny"), "resource-unreachable")[0].textContent, "✗ the Hub did not answer for tiny (someone/tiny); paste a full revision instead — the pin stays as it is.");
  assert.equal(Boolean(labelled(entry(silent, "tiny"), "Move")), false, "no Move is offered");
  assert.equal(allCommits(silent).length, 0);
});

// ---------------------------------------------------------------- findings: each follows UC-040 or a requirement it realises, fails on the page as it stands, and is marked { todo } with the finding it reports

const FORM_FINDING = "src/site-frame/forms.mjs:80-81 (documentNow) hands a section the person edited over as { heading, line, text } with no rows; documentFindings (forms.mjs:102) and the page's extraChecks (src/settings-pages/resources.mjs:63 rowsOf, called by checksOf) find no row in it and report nothing, and Save writes the typed text (resources.mjs:129 writeDocument) unchecked";

// TST-1041017 · level: system · module: MOD-settings-pages; MOD-site-frame
// guards: UC-040; A RESOURCE ENTRY NAMES ITS SECRET, NOT ITS VALUE; NO SECRET IN THE REPOSITORY
// given: the page of TST-1041003
// input: add the compute resource "alex"; type the route "bridge hpc", the place and, as its secret, the value "sk-live-0123456789abcdef"; press Save
// expect: 8 "name of the secret — never its value": the form names A RESOURCE ENTRY NAMES ITS SECRET, NOT ITS VALUE and Save is disabled, and the value stands in no commit (flow: UC-040 steps 5 and 8)
test("UC-040 step 8 — through the frame, a secret's value typed into the list is refused and never committed", async (t) => {
    const page = await visit(t, FRAGMENT);
    await add(page, "compute", "alex", "alex.nhr.fau.de");
    await typeInto(areaOf(page), areaOf(page).value.replace("| alex | compute | alex.nhr.fau.de | — | — | — | — | — | — | — |", "| alex | compute | alex.nhr.fau.de | — | — | — | bridge hpc | NHR@FAU, Erlangen | — | sk-live-0123456789abcdef |"));
    assert.match(marks(page), /A RESOURCE ENTRY NAMES ITS SECRET, NOT ITS VALUE/);
    assert.equal(saveOf(page).disabled, true);
    if (!saveOf(page).disabled) await click(saveOf(page));
    assert.equal(allCommits(page).some((commit) => JSON.stringify(commit.files).includes("sk-live-0123456789abcdef")), false, "the value stands in no commit");
  });

// TST-1041018 · level: system · module: MOD-settings-pages; MOD-site-frame
// guards: UC-040; A COMPUTE RESOURCE IS REACHED THROUGH THE BRIDGE OR A SELF-HOSTED RUNNER; THE RESOURCE KIND IS ONE OF A CLOSED SET
// given: the page of TST-1041003
// input: add the compute resource "alex"; type the route "ssh alex" and a place; press Save
// expect: 3 "the route: a Bridge ... or a self-hosted runner": the form names A COMPUTE RESOURCE IS REACHED THROUGH THE BRIDGE OR A SELF-HOSTED RUNNER and Save is disabled; nothing is committed (flow: UC-040 steps 3 and 8)
test("UC-040 step 3 — through the frame, a compute route that is neither a Bridge nor a runner is refused and not committed", async (t) => {
    const page = await visit(t, FRAGMENT);
    await add(page, "compute", "alex", "alex.nhr.fau.de");
    await typeInto(areaOf(page), areaOf(page).value.replace("| alex | compute | alex.nhr.fau.de | — | — | — | — | — | — | — |", "| alex | compute | alex.nhr.fau.de | — | — | — | ssh alex | NHR@FAU, Erlangen | — | — |"));
    assert.match(marks(page), /A COMPUTE RESOURCE IS REACHED THROUGH THE BRIDGE OR A SELF-HOSTED RUNNER/);
    assert.equal(saveOf(page).disabled, true);
    if (!saveOf(page).disabled) await click(saveOf(page));
    assert.equal(commitsOf(page, PRODUCT_REPO).length, 0);
  });

// TST-1041019 · level: system · module: MOD-settings-pages; MOD-resource-list
// guards: UC-040; A JOB RUNS ONLY WHERE ITS RESOURCES ARE REACHABLE
// given: the page of TST-1041004, in which the person has just saved the resource "gpu-box" on the runner gpu and has not opened the page again
// input: press Check on gpu-box
// expect: 7b "Agent M offers a check job on that runner label through the product's workflow": the page shows the run panel for the job, as it does for a resource that stood in the list when the page was opened (flow: UC-040 steps 7 and 7b)
test("UC-040 step 7b — through the frame, a runner resource just saved can be checked without opening the page again",
  async (t) => {
    const page = await visit(t, FRAGMENT);
    await add(page, "compute", "gpu-box", "gpu01.example.org");
    await typeInto(areaOf(page), areaOf(page).value.replace("| gpu-box | compute | gpu01.example.org | — | — | — | — | — | — | — |", "| gpu-box | compute | gpu01.example.org | — | — | — | runner:gpu | the group's workstation | — | — |"));
    await click(saveOf(page));
    await click(labelled(entry(page, "gpu-box"), "Check"));
    assert.ok(withClass(entry(page, "gpu-box"), "run-panel")[0], withClass(entry(page, "gpu-box"), "resource-out")[0].textContent);
  });

// TST-1041020 · level: system · module: MOD-settings-pages; MOD-site-frame
// guards: UC-040; EVERY STEP EXPLAINS ITSELF
// given: the page of TST-1041004 (a private product with the job workflow, cluster on the runner gpu), whose Check shows the folded explanation of the check; the same page checks a resource on a Bridge (TST-1041003)
// input: press Check on cluster and read the explanation the page shows
// expect: the explanation does not say that the page makes no request through a Bridge, since Check makes it (flow: UC-040 step 7)
test("UC-040 step 7 — through the frame, the explanation of Check does not deny the check through a Bridge that the page makes",
  async (t) => {
    const page = await visit(t, FRAGMENT);
    await click(labelled(entry(page, "cluster"), "Check"));
    const text = withClass(entry(page, "cluster"), "resource-out")[0].textContent.replace(/\s+/g, " ");
    assert.match(text, /A check makes one harmless request to the resource/, "known positive: the explanation of the check is shown");
    assert.doesNotMatch(text, /which this page does not make yet/);
  });
