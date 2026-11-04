// System coverage for UC-017 Configure the participants of the instance, walked as an author meets it: the frame started at the fragment #participants over the module view of MOD-settings-pages, against
// MOD-repository-hosts' real GitHub host answered by a fake GitHub server that holds the instance and two products (tests/uc-017-harness.mjs); and the Bridges of this browser are real MOD-bridge-http
// servers over MOD-bridge-jobs' real handlers, on "computers" that are folders of fixture agent executables (claude, codex, opencode), one of them reached at a forwarded address, one through the jump host's
// HTTPS address behind its own login. The flow map (TST-375201) names, for every step of the main flow, every alternative flow and the postcondition, the executable tests that walk it, the finding where the
// page does otherwise, or the reason it is not walked. The cases walk the main flow for each type — a person, a model endpoint, a CI agent on GitHub's machines and on a self-hosted runner, a CLI agent by the
// Bridge it runs on and one of the agents that Bridge offers, a sandboxed agent at the tunnel's local address, a CLI agent behind NAT through the jump host, a subagent — and the alternative flows 3a, 3b, 5a,
// 6a and 7a. No request leaves the process.
// Run: node --test tests/system-uc-017-participants-through-the-frame.test.mjs
//
// Module: MOD-settings-pages
// Module: MOD-participant-list
// Module: MOD-bridge-client
// Module: MOD-bridge-jobs
// Module: MOD-agent-processes
// Guards: UC-017
// Level: system
//
// Authored by developer-sonnet-j (ITM-375). The `Agent-M-Participant` trailers of the code UC-017's flow runs (src/settings-pages/participants.mjs, src/participant-list/, src/bridge-client/, src/bridge-jobs/,
// src/agent-processes/, and the files they call) name developer-sonnet-a (ITM-899), developer-sonnet-b (ITM-1019, ITM-1031), developer-sonnet-c (ITM-999), developer-sonnet-d (ITM-352, ITM-960, ITM-995, ITM-998),
// developer-opus-a (ITM-1233, ITM-1237), developer-opus-b (ITM-1230, ITM-1233, ITM-1239, ITM-1243) and developer-sol-c; the commits of ITM-326 carry the line `developer-sonnet-b`, and those of ITM-352, ITM-353,
// ITM-354 and ITM-473 (team 2, sprints 41 to 44) none. developer-sonnet-j built one commit of that flow: ITM-1186, which exports CAPABILITIES and PRESETS from participants.mjs and takes the note on the
// prompt bar off the Participants page (it stands on the endpoints page). No case of this file guards either: the postcondition's sentence on the prompt bar is named in NOT_WALKED. Where the page and UC-017
// disagree the case follows UC-017 and is marked `todo` with the word FINDING and its module (named in FLOW_FINDINGS). Each case states its input and its expected values in its own text and proves them against a
// known positive in the same case; none reads an expected result from the SPEC, a use case or an architecture file, but the flow map, which holds the expected passages itself and checks that UC-017 still says
// them. Readings the texts leave open, which the cases state:
//   - "The author opens **Participants** on the dashboard" (1) is read as the frame shown at the fragment #participants: the route `participants` of MOD-settings-pages.
//   - "the agent, chosen from those that Bridge offers" (3) is read as the agent the author picks with *List agents* and the one-click *Add*; the field also takes a typed name, which TST-375217 holds against UC-017.
//   - "Agent M sends a harmless request through the Bridge the participant names and shows what answered" (6) is read as the fixture executable of the agent being started once with the short question the Bridge
//     asks, and the page showing that the agent answered, with its version.
//   - "names the reason — not running, wrong address, token missing" (6a) is read as the reason the page gives for a Bridge no process listens at (not running or wrong address), a Bridge with no pairing token,
//     a Bridge that refuses its token, and a jump host that refuses its login.
//   - "saves nothing until the author decides to save untested" (6a) is read as: the Save control stays withheld after a failed test until the person presses *Save untested*, and one click on Save then commits.
//   - "lists the products and roles" (7a) is read as the product's address, the role assignment's file and the role, for each product from this browser's list that names the participant.

import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { testDeclarations } from "../src/test-document/index.mjs";
import { installDocument } from "./settings-pages-harness.mjs";
import { ALPHA, BETA, INSTANCE, JUMP, LOGIN, ORIGIN, PARTICIPANTS, PRODUCT_TOKEN, REGISTER, TOKEN, addParticipant, byClass, byTag, choose, click, commitsOf, computer, forward, freePort, instanceFiles,
  modelServer, one, page, productOf, put, registerOf, save, saveButton, settle, startBridge } from "./uc-017-harness.mjs";

installDocument();
// The entry page registers the strategies of the views the frame loads before it starts the frame (src/site-frame/start.mjs); this file does the same for the view it opens, once.
const { view } = await import("../src/settings-pages/index.mjs");
const { registerStrategies } = await import("../src/job-runner/index.mjs");
for (const strategies of view.strategies) registerStrategies("tests/system-uc-017-participants-through-the-frame.test.mjs", strategies);
const { readDocument } = await import("../src/documents/index.mjs");
const { participantSchema, participantsOf } = await import("../src/participant-list/index.mjs");

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const UC = "docs/use-cases/UC-017-configure-participants.md";
const SELF = "tests/system-uc-017-participants-through-the-frame.test.mjs";
const RELEASE = "tests/release-uc-017-configure-participants.test.mjs";
const OLDER = "tests/system-uc-017-configure-participants.test.mjs", PAGE = "tests/settings-pages-participants.test.mjs", BRIDGE = "tests/bridge-jobs-agents.test.mjs";
const ALL_CAPABILITIES = ["draft text", "read the repository", "write to the repository", "run code and tests", "use tools", "reach the web"];
const CODING = ["draft text", "read the repository", "write to the repository", "run code and tests", "use tools"];
/** The rows of the register in the world's instance repository, as the participants they read as. */
const participantsIn = (shown) => participantsOf(readDocument(participantSchema(), PARTICIPANTS, registerOf(shown)));
const lastRow = (shown) => participantsIn(shown).at(-1);
const folds = (root) => byTag(root, "details").filter((node) => String(node.className).split(" ").includes("explain"));
/** Every text any commit of any repository of the world wrote: files and messages. */
const written = (shown) => [INSTANCE, "acme/alpha", "acme/beta"].flatMap((repository) => { try { return shown.world.commits(repository); } catch { return []; } })
  .flatMap((commit) => [commit.message, ...Object.values(commit.files)]).join("\n");
const textOf = (node) => node.textContent.replace(/\s+/g, " ");
/** The person ticks or unticks the capability `name`. */
async function tick(main, name, on) {
  const box = byClass(main, "participant-capability").find((each) => each.value === name);
  box.checked = on;
  box.dispatchEvent(new Event("change"));
  await settle();
}

// ---------------------------------------------------------------- the flow map

// The passages of UC-017 the system tests walk, each with the executable tests that walk it: this file's cases, and the older tests of the Participants page, which declare the level system or unit.
const FLOW_EVIDENCE = {
  "main-1-open": { uc: "The author opens **Participants** on the dashboard and chooses **+ Add participant**.", evidence: [[SELF, "TST-375202"], [OLDER, "TST-375001"]] },
  "main-2-explained": { uc: "A folded **What is this?** explains each type with an example and what\n   it means for cost, speed and control.", evidence: [[SELF, "TST-375202"], [OLDER, "TST-375001"]] },
  "main-3-person": { uc: "**Person:** the account on GitHub or on the GitLab server;", evidence: [[SELF, "TST-375203"], [OLDER, "TST-375001"]] },
  "main-3-endpoint": { uc: "**Model endpoint:** which configured endpoint and model (the key itself is set up in UC-003 and\n     stays in the browser);", evidence: [[SELF, "TST-375203"], [OLDER, "TST-375001"]] },
  "main-3-ci": { uc: "**CI agent:** which model, and where it runs — on GitHub's machines, or on a\n     **self-hosted runner** the person installed on a machine or VM they control.", evidence: [[SELF, "TST-375203"], [SELF, "TST-375209"], [OLDER, "TST-375001"]] },
  "main-3-secret": { uc: "The key is named\n     as an Actions secret, never entered here.", evidence: [[SELF, "TST-375203"], [OLDER, "TST-375001"]] },
  "main-3-cli": { uc: "**CLI agent / sandboxed agent:** the Bridge it runs on, chosen among the Bridges this browser keeps under their\n     names", evidence: [[SELF, "TST-375204"], [OLDER, "TST-375002"]] },
  "main-3-forward": { uc: "on this computer, at a forwarded address, for a sandbox the tunnel's local address, or through the jump\n     host for a machine behind NAT (UC-011, 1a and 1c)", evidence: [[SELF, "TST-375205"], [SELF, "TST-375206"]] },
  "main-3-agent": { uc: "the agent, chosen from those that Bridge offers (UC-044)", evidence: [[SELF, "TST-375204"], [BRIDGE, "TST-472077"]] },
  "main-3-same-bridge": { uc: "Several participants may name the\n     same Bridge and agent: each job starts its own process there (UC-011, 1d).", evidence: [[SELF, "TST-375204"]] },
  "main-3-subagent": { uc: "A **subagent** — an agent that another\n     CLI agent starts, such as a Claude Code subagent — names, instead of a Bridge, the participant that starts it", evidence: [[SELF, "TST-375207"], [PAGE, "TST-999001"]] },
  "main-3-model": { uc: "Every participant that works with a language model names its model", evidence: [[SELF, "TST-375204"], [SELF, "TST-375203"]] },
  "main-3-context-price": { uc: "Such a participant also names how many tokens its model's context holds", evidence: [[SELF, "TST-375203"], [RELEASE, "TST-375307"], [RELEASE, "TST-375308"]] },
  "main-3-cost": { uc: "Left empty, a job is\n   not sent to it, and its costs are shown as usage with *price unknown*.", evidence: [[RELEASE, "TST-375307"], [RELEASE, "TST-375308"]] },
  "main-4-presets": { uc: "Agent M presets the capabilities typical for the type", evidence: [[SELF, "TST-375203"], [RELEASE, "TST-375304"]] },
  "main-4-tools": { uc: "For a model endpoint,\n   *use tools* is preset from the endpoint's test (UC-003, step 5).", evidence: [[SELF, "TST-375203"]] },
  "main-5-place": { uc: "The author states where the participant processes data. Agent M presets it where it can tell", evidence: [[SELF, "TST-375204"], [RELEASE, "TST-375305"]] },
  "main-6-test": { uc: "For a CLI or sandboxed agent, the author presses **Test**; Agent M sends a harmless request through\n   the Bridge the participant names and shows what answered.", evidence: [[SELF, "TST-375204"], [SELF, "TST-375205"], [SELF, "TST-375206"]] },
  "main-7-save": { uc: "The author presses **Save** — one click. Agent M commits the participant to\n   `docs/participants.md` of the instance", evidence: [[SELF, "TST-375203"], [SELF, "TST-375204"], [RELEASE, "TST-375311"], [RELEASE, "TST-375312"]] },
  "main-7-no-key": { uc: "processing place — no key.", evidence: [[SELF, "TST-375203"], [SELF, "TST-375208"], [RELEASE, "TST-375310"]] },
  "3a-endpoint-not-configured": { uc: "**3a. The endpoint is not configured yet.**", evidence: [[SELF, "TST-375208"], [OLDER, "TST-375003"]] },
  "3b-ssh-alternative": { uc: "**3b. The author wants a workflow to use an agent behind SSH without a self-hosted runner.**", evidence: [[SELF, "TST-375209"], [OLDER, "TST-375003"]] },
  "5a-restricted-places": { uc: "**5a. A participant processes data outside places that some sources permit.**", evidence: [[SELF, "TST-375210"], [RELEASE, "TST-375309"], [OLDER, "TST-375004"]] },
  "6a-bridge-silent": { uc: "**6a. The Bridge does not answer.** Agent M names the reason — not running, wrong address, token missing — and saves nothing until the author decides to save untested.", evidence: [[SELF, "TST-375211"], [OLDER, "TST-375002"]] },
  "7a-used-participant": { uc: "**7a. The author changes a participant that products already use.**", evidence: [[SELF, "TST-375212"], [OLDER, "TST-375005"]] },
  "postcondition-listed": { uc: "The instance lists the participant with type, capabilities and processing place; no key is in the\n  repository.", evidence: [[SELF, "TST-375203"], [SELF, "TST-375204"], [RELEASE, "TST-375310"]] },
  "main-3-model-preset": { uc: "and\n     the **model** the agent is configured to use, for example `claude-opus-5-5`.", evidence: [[SELF, "TST-375213"]] },
  "main-5-self-hosted-place": { uc: "The author states where the participant processes data. Agent M presets it where it can tell", evidence: [[SELF, "TST-375214"]] },
  "main-3-offered-agent": { uc: "the agent, chosen from those that Bridge offers (UC-044)", evidence: [[SELF, "TST-375216"]] },
  "main-3-price": { uc: "its price per million input and\n   output tokens, so that the usage a runtime reports can be priced", evidence: [[SELF, "TST-375215"]] },
  "main-6-explained": { uc: "For a CLI or sandboxed agent, the author presses **Test**", evidence: [[SELF, "TST-375217"]] },
};
// The passages the page does otherwise: the finding, its case, and the module it points to.
const FLOW_FINDINGS = {
};
// The passages no code of this product carries here, with the reason.
const NOT_WALKED = {
  "postcondition-jobs": { uc: "The participant does the jobs of the product's workflow its roles give it.", reason: "the jobs a participant does are UC-048's and UC-038's, whose batteries walk them; this file ends at the register" },
  "postcondition-prompt-bar": { uc: "The prompt bar offers the model endpoints\n  and CLI sessions this browser configures, not the participants of this list (UC-049).", reason: "the prompt bar's offer is UC-049's; developer-sonnet-j built the Participants page's side of it (ITM-1186 took the note off the page), so a case of it is another participant's" },
  "postcondition-roles": { uc: "A product's role assignment can give it roles that need no more than its capabilities (UC-048).", reason: "giving a participant a role is UC-048's, whose battery walks it" },
  "main-3-runner-refusal": { uc: "Agent M\n     reads that product repository's visibility and refuses a public one, with the reason", reason: "the refusal is MOD-runtimes' routesFor, called when a product's job is routed, not when a participant is saved; tests/release-uc-017-configure-participants.test.mjs TST-375314 calls it over a register this page saved" },
};

// TST-375201 · level: system · module: system
// guards: UC-017
// given: UC-017 as committed text, the executable tests named in FLOW_EVIDENCE, the findings named in FLOW_FINDINGS and the flows named in NOT_WALKED (the jobs a participant does, the prompt bar's offer, the roles it is given, and the routing of a job to a runner, which other items carry)
// input: compare every passage of the main flow, steps 1 to 7, of the alternative flows and of the postcondition with its executable evidence, its finding or the reason it is not walked
// expect: every named passage stands in UC-017; every evidence file exists and declares its TST id, this file's cases at the level system and the release file's at the level release; every finding's case stands in its file with the todo naming FINDING and its module; every alternative flow UC-017 names is among the passages; known positive: UC-017 names exactly the five alternative flows 3a, 3b, 5a, 6a and 7a, and each of the seven main steps has a passage
test("TST-375201: UC-017 every passage of the main flow and of each alternative flow has an executable test, a finding or a stated reason", () => {
  const uc = read(UC).replace(/\s+/g, " ");
  const missing = [];
  for (const [name, { uc: needle, evidence }] of Object.entries(FLOW_EVIDENCE)) {
    assert.ok(uc.includes(needle.replace(/\s+/g, " ")), `${name}: UC-017 says "${needle}"`);
    assert.ok(evidence.length > 0, `${name}: a test is named`);
    for (const [file, id] of evidence) {
      assert.ok(existsSync(new URL(`../${file}`, import.meta.url)), `${name}: ${file} exists`);
      const declared = testDeclarations(file, read(file)).find((each) => each.id === id);
      if (!declared) missing.push(`${name}: ${id} in ${file}`);
      else if (file === SELF) assert.equal(declared.level, "system", `${id} is a system test`);
      else if (file === RELEASE) assert.equal(declared.level, "release", `${id} is a release test`);
    }
  }
  assert.deepEqual(missing, [], "every evidence test is declared in its file");
  for (const [name, { uc: needle, finding, file, test: id, module }] of Object.entries(FLOW_FINDINGS)) {
    assert.ok(uc.includes(needle.replace(/\s+/g, " ")), `${name}: UC-017 says "${needle}"`);
    assert.ok(read(file).includes(`// ${id} `), `${name}: ${id} stands in ${file}`);
    assert.ok(read(file).includes(`todo: "FINDING ${finding} (${module})`), `${name}: the todo of ${id} names FINDING ${finding} and ${module}`);
  }
  for (const [name, { uc: needle, reason }] of Object.entries(NOT_WALKED)) {
    assert.ok(uc.includes(needle.replace(/\s+/g, " ")), `${name}: UC-017 says "${needle}"`);
    assert.ok(reason.length > 20, `${name}: its reason is stated`);
  }
  const flows = [...uc.matchAll(/- \*\*(\d+[a-z])\. /g)].map((match) => match[1]).sort();
  assert.deepEqual(flows, ["3a", "3b", "5a", "6a", "7a"], "known positive: UC-017 names these five alternative flows");
  const walked = new Set(Object.keys({ ...FLOW_EVIDENCE, ...FLOW_FINDINGS, ...NOT_WALKED }).map((key) => key.split("-")[0]));
  assert.deepEqual(flows.filter((flow) => !walked.has(flow)), [], "each alternative flow is among the passages");
  const steps = new Set(Object.keys({ ...FLOW_EVIDENCE, ...FLOW_FINDINGS, ...NOT_WALKED }).filter((key) => key.startsWith("main-")).map((key) => Number(key.split("-")[1])));
  assert.deepEqual([...steps].sort((a, b) => a - b), [1, 2, 3, 4, 5, 6, 7], "each step of the main flow is among the passages");
  for (const own of testDeclarations(SELF, read(SELF))) assert.deepEqual([own.level, own.guards.includes("UC-017")], ["system", true], own.id);
  assert.ok(existsSync(new URL(`../${RELEASE}`, import.meta.url)), "the release file exists");
});

// ---------------------------------------------------------------- the main flow

// TST-375202 · level: system · module: system
// guards: UC-017; EVERY STEP EXPLAINS ITSELF; ONE CLICK PER DECISION
// given: the frame at #participants over an instance with an empty register
// input: the author reads the page, presses + Add participant, then picks each of the five types in turn
// expect: known positive — the page is headed Participants and lists no participant, + Add participant is there and no form is open; after the press only the choice of type stands, with no form for a row; each type, once picked, opens a form for a row and above it a folded What is this? whose text is not empty and differs from every other type's; nothing was written
test("TST-375202: UC-017 1, 2 the author opens Participants, chooses + Add participant and picks a type, and each type opens its own form with a folded explanation", async (t) => {
  const shown = await page(t);
  const main = shown.main();
  assert.deepEqual([byTag(main, "h2")[0].textContent, byClass(main, "participants-add").length, byClass(main, "schema-form").length], ["Participants", 1, 0], "known positive: the page and its button");
  assert.match(one(main, "participants-list").textContent, /No participants are registered yet/);
  await click(one(main, "participants-add"));
  assert.equal(byClass(main, "schema-form").length, 0, "the type is chosen before a form for a row opens");
  const texts = new Set();
  for (const kind of ["person", "model endpoint", "CI agent", "CLI agent", "sandboxed agent"]) {
    await choose(main, "participant-type", kind);
    assert.equal(byClass(main, "schema-form").length, 1, `${kind}: a form for the row opens`);
    const first = folds(one(main, "participant-type-fields"))[0];
    assert.ok(first && !first.hasAttribute("open") && byTag(first, "summary")[0].textContent === "What is this?", `${kind}: a folded What is this?`);
    const text = first.textContent.replace(/What is this\?/, "").trim();
    assert.ok(text.length > 40, `${kind}: the explanation says something`);
    texts.add(text);
  }
  assert.equal(texts.size, 5, "each type has an explanation of its own");
  assert.deepEqual(commitsOf(shown), [], "nothing was written");
});

// TST-375203 · level: system · module: system
// guards: UC-017; PARTICIPANTS ARE CONFIGURED ONCE PER INSTANCE; A PARTICIPANT HAS ONE OF FIVE TYPES; A PARTICIPANT DECLARES ITS CAPABILITIES; A PARTICIPANT BASED ON A LANGUAGE MODEL NAMES ITS MODEL; NO SECRET IN THE REPOSITORY; A PERSON'S OWN INPUT IS COMMITTED DIRECTLY
// given: the frame at #participants over an empty register; this browser keeps the endpoint campus (model llama-campus, with a key) whose last test said it answered in text only, the endpoint toolbox (model llama-tools) whose last test said the model called the tool it was offered, and the instance's token
// input: the author adds a person (account github.com/akmaier), a model endpoint (campus, context 120000, place FAU data centre (EU)), a CI agent on GitHub's machines (model gpt-5, secret MODEL_KEY, place GitHub hosted runner) and a model endpoint on toolbox, pressing Save once for each
// expect: known positive — four commits to the instance, each under the instance's token and holding docs/participants.md alone, the register at the end holds the four rows in order; the person has all six capabilities, no model and no place and the route account github.com/akmaier; the model endpoint on campus has the model llama-campus and the route endpoint campus, its capability draft text and no use tools (the test said text only); the CI agent has the five coding capabilities, the model gpt-5 and the route ci hosted secret MODEL_KEY; the endpoint on toolbox has draft text and use tools (the test said the model used the tool); the key of the endpoint stays in this browser and in no commit
test("TST-375203: UC-017 3, 4, 7 the author saves a person, a model endpoint and a CI agent, each with a click, into the one register, without a key", async (t) => {
  const shown = await page(t, { settings: { "endpoint:campus": { url: "https://models.example/v1", kind: "openai-compatible", model: "llama-campus", key: "endpoint-secret-key" },
    "last-test:endpoint:campus": { tools: false }, "endpoint:toolbox": { url: "https://tools.example/v1", kind: "openai-compatible", model: "llama-tools", key: "toolbox-secret-key" }, "last-test:endpoint:toolbox": { tools: true } } });
  const main = shown.main();
  await addParticipant(main, "person");
  await put(main, "participant-name", "akmaier");
  await put(main, "participant-account", "github.com/akmaier");
  await save(main);
  assert.equal(commitsOf(shown).length, 1, "known positive: one click, one commit");
  await addParticipant(main, "model endpoint");
  await put(main, "participant-name", "campus-model");
  await put(main, "participant-context", "120000");
  await put(main, "participant-place", "FAU data centre (EU)");
  assert.equal(one(main, "participant-endpoint").value, "campus", "the configured endpoint is chosen");
  await save(main);
  await addParticipant(main, "CI agent");
  await put(main, "participant-name", "ci-writer");
  await put(main, "participant-model", "gpt-5");
  await put(main, "participant-secret-name", "MODEL_KEY");
  await save(main);
  await addParticipant(main, "model endpoint");
  await put(main, "participant-name", "toolbox-model");
  await choose(main, "participant-endpoint", "toolbox");
  await put(main, "participant-place", "FAU data centre (EU)");
  await save(main);
  const commits = commitsOf(shown);
  assert.deepEqual(commits.map((commit) => [Object.keys(commit.files), commit.authorization]), [0, 1, 2, 3].map(() => [[PARTICIPANTS], `Bearer ${TOKEN}`]));
  const rows = participantsIn(shown);
  assert.deepEqual(rows.map((row) => [row.name, row.type, row.model, row.place, row.route]), [
    ["akmaier", "person", null, null, "account github.com/akmaier"],
    ["campus-model", "model endpoint", "llama-campus", "FAU data centre (EU)", "endpoint campus"],
    ["ci-writer", "CI agent", "gpt-5", "GitHub hosted runner", "ci hosted secret MODEL_KEY"],
    ["toolbox-model", "model endpoint", "llama-tools", "FAU data centre (EU)", "endpoint toolbox"]]);
  assert.deepEqual(rows.map((row) => row.capabilities), [ALL_CAPABILITIES, ["draft text"], CODING, ["draft text", "use tools"]]);
  assert.equal(rows[1].context, 120000);
  assert.ok(!written(shown).includes("endpoint-secret-key") && !written(shown).includes("toolbox-secret-key") && !written(shown).includes(TOKEN), "no key and no token in any commit");
  assert.equal(JSON.parse(globalThis.localStorage.getItem("agent-m:akmaier/agent-m:endpoint:campus")).key, "endpoint-secret-key", "the key stays in this browser");
});

// TST-375204 · level: system · module: system
// guards: UC-017; THE BRIDGE FINDS THE INSTALLED AGENTS; A PARTICIPANT BASED ON A LANGUAGE MODEL NAMES ITS MODEL; ONE CLICK PER DECISION; NO SECRET IN THE REPOSITORY; A PERSON'S OWN INPUT IS COMMITTED DIRECTLY
// given: a computer with claude (logged in) and codex (installed, not logged in) and no opencode, a real Bridge on it offering all three agents, kept by this browser under the name laptop at its loopback address with its pairing token
// input: the author adds a CLI agent claude-lap, chooses the Bridge laptop, presses List agents, adds the agent the Bridge offers as ready, names its model claude-opus-5-5, presses Test and Save; then adds claude-lap-2 on the same Bridge and the same agent and presses Save
// expect: known positive — List agents says the Bridge laptop answered and offers "Add claude" alone, says codex is not ready (not logged in) and opencode is missing; Add fills the agent claude; Test says claude answered with its version 2.1.300 and the computer's claude was started once with its short task; Save makes one commit with the row of type CLI agent, the model claude-opus-5-5, the route bridge laptop agent claude, the five coding capabilities and a processing place that names this machine or the Bridge's computer; the second participant on the same Bridge and agent is saved as well, with the same route; the Bridge's token is in no commit
test("TST-375204: UC-017 3, 5, 6, 7 a CLI agent is added by the Bridge it runs on and an agent that Bridge offers, tested through the Bridge and saved, and a second participant may name the same Bridge and agent", async (t) => {
  const machine = computer({ claude: { loggedIn: true }, codex: { loggedIn: false } });
  const bridge = await startBridge(t, machine, { name: "laptop", offered: ["claude", "codex", "opencode"] });
  const shown = await page(t, { settings: { "bridge:laptop": { address: bridge.address, token: bridge.token } } });
  const main = shown.main();
  await addParticipant(main, "CLI agent");
  await put(main, "participant-name", "claude-lap");
  assert.equal(one(main, "participant-bridge").value, "laptop", "the Bridge this browser keeps is chosen");
  await click(one(main, "participant-list-agents"));
  const listed = one(main, "participant-agent-list-result");
  assert.match(listed.textContent, /Bridge laptop answered/, "known positive: the Bridge answered");
  assert.deepEqual(byClass(main, "participant-agent-offer").map((button) => button.textContent), ["Add claude"]);
  assert.match(one(main, "participant-agent-unready").textContent, /codex is not ready \(not logged in\)/);
  assert.match(one(main, "participant-agent-missing").textContent, /opencode is missing/);
  await click(byClass(main, "participant-agent-offer")[0]);
  assert.equal(one(main, "participant-agent").value, "claude");
  await put(main, "participant-model", "claude-opus-5-5");
  await click(one(main, "participant-agent-test"));
  assert.equal(one(main, "participant-agent-test-result").textContent, "claude answered (2.1.300).");
  assert.equal(machine.calls().filter((line) => /claude -p --output-format json/.test(line)).length, 1, "the computer's claude was asked once");
  assert.ok(!machine.calls().some((line) => /codex exec/.test(line)), "no other agent was given a task");
  await save(main);
  assert.equal(commitsOf(shown).length, 1, "one click, one commit");
  const row = lastRow(shown);
  assert.deepEqual([row.name, row.type, row.model, row.route, row.capabilities], ["claude-lap", "CLI agent", "claude-opus-5-5", "bridge laptop agent claude", CODING]);
  assert.match(row.place, /this machine|laptop/);
  await addParticipant(main, "CLI agent");
  await put(main, "participant-name", "claude-lap-2");
  await put(main, "participant-model", "claude-opus-5-5");
  await put(main, "participant-agent", "claude");
  await save(main);
  assert.deepEqual(participantsIn(shown).map((each) => [each.name, each.route]), [["claude-lap", "bridge laptop agent claude"], ["claude-lap-2", "bridge laptop agent claude"]]);
  assert.ok(!written(shown).includes(bridge.token), "the Bridge's token is in no commit");
});

// TST-375205 · level: system · module: system
// guards: UC-017; THE BRIDGE FINDS THE INSTALLED AGENTS; A PARTICIPANT HAS ONE OF FIVE TYPES
// given: a computer with codex (logged in), a real Bridge on it offering codex, and a forward on the loopback that carries the connections made to its local port to that Bridge — the tunnel's local address; this browser keeps the Bridge under the name sandbox at http://localhost:<that port>
// input: the author adds a sandboxed agent codex-box, chooses the Bridge sandbox, presses List agents, adds the offered codex, names its model and place (a container) and presses Test and Save
// expect: known positive — the list offers "Add codex" and the Bridge answered; Test says codex answered; the commit holds the row of type sandboxed agent with the route bridge sandbox agent codex and the place the author named; with the forward closed, Test says that the Bridge gave no answer and Save is withheld
test("TST-375205: UC-017 3, 6 a sandboxed agent is reached by the tunnel's local address, listed, tested and saved", async (t) => {
  const machine = computer({ codex: { loggedIn: true } });
  const bridge = await startBridge(t, machine, { name: "sandbox", offered: ["codex"] });
  const tunnel = await forward(t, bridge.port);
  const shown = await page(t, { settings: { "bridge:sandbox": { address: `http://localhost:${tunnel.port}`, token: bridge.token } } });
  const main = shown.main();
  await addParticipant(main, "sandboxed agent");
  await put(main, "participant-name", "codex-box");
  await click(one(main, "participant-list-agents"));
  assert.deepEqual(byClass(main, "participant-agent-offer").map((button) => button.textContent), ["Add codex"], "known positive: the Bridge in the sandbox answers through the tunnel");
  await click(byClass(main, "participant-agent-offer")[0]);
  await put(main, "participant-model", "codex-model");
  await put(main, "participant-place", "a container on this computer");
  await click(one(main, "participant-agent-test"));
  assert.match(one(main, "participant-agent-test-result").textContent, /codex answered/);
  await save(main);
  const row = lastRow(shown);
  assert.deepEqual([row.type, row.route, row.place], ["sandboxed agent", "bridge sandbox agent codex", "a container on this computer"]);
  await tunnel.close();
  await addParticipant(main, "sandboxed agent");
  await put(main, "participant-name", "codex-box-2");
  await put(main, "participant-model", "codex-model");
  await put(main, "participant-place", "a container on this computer");
  await put(main, "participant-agent", "codex");
  await click(one(main, "participant-agent-test"));
  assert.match(one(main, "participant-agent-test-result").textContent, /gave no answer/);
  assert.equal(saveButton(main).disabled, true, "Save is withheld");
  assert.equal(commitsOf(shown).length, 1, "nothing more was committed");
});

// TST-375206 · level: system · module: system
// guards: UC-017; A BRIDGE BEHIND NAT IS REACHED THROUGH A REVERSE TUNNEL; NO SECRET IN THE REPOSITORY
// given: a computer behind NAT with claude (logged in) and a real Bridge on it; this browser keeps the jump host jump.example.test (HTTPS address and the web server's login alice) and the Bridge gpu at port 40100 of its range; the fake of the jump host's web server asks that login and forwards /bridge/gpu to the Bridge
// input: the author adds a CLI agent claude-gpu, chooses the Bridge gpu, presses List agents, adds claude, names its model and presses Test and Save
// expect: known positive — the requests reach the jump host's address https://jump.example.test/bridge/gpu/v1/pair and /v1/agents and /v1/probes/agent, each with the web server's login and the Bridge's token; the offered claude is added, Test says claude answered, the commit holds the route bridge gpu agent claude; neither the Bridge's token nor the web server's password stands in any commit
test("TST-375206: UC-017 3, 6 a CLI agent behind NAT is reached through the jump host's HTTPS address with its login, listed, tested and saved", async (t) => {
  const machine = computer({ claude: { loggedIn: true } });
  const bridge = await startBridge(t, machine, { name: "gpu", offered: ["claude"] });
  const shown = await page(t, { jump: { gpu: bridge.port }, settings: { "bridge:gpu": { port: 40100, token: bridge.token },
    "jump-host": { hostname: "jump.example.test", user: "bridge-user", sshPort: 22, portRange: [40100, 40103], httpsAddress: JUMP, login: LOGIN } } });
  const main = shown.main();
  await addParticipant(main, "CLI agent");
  await put(main, "participant-name", "claude-gpu");
  await choose(main, "participant-bridge", "gpu");
  await click(one(main, "participant-list-agents"));
  await click(byClass(main, "participant-agent-offer")[0]);
  await put(main, "participant-model", "claude-opus-5-5");
  await click(one(main, "participant-agent-test"));
  assert.match(one(main, "participant-agent-test-result").textContent, /claude answered/);
  await save(main);
  const login = `Basic ${Buffer.from(`${LOGIN.user}:${LOGIN.password}`).toString("base64")}`;
  assert.deepEqual(shown.network.seen.map((request) => [request.url, request.authorization]), ["pair", "agents", "probes/agent"].map((tail) => [`${JUMP}/bridge/gpu/v1/${tail}`, login]));
  assert.equal(lastRow(shown).route, "bridge gpu agent claude");
  assert.ok(!written(shown).includes(bridge.token) && !written(shown).includes(LOGIN.password), "neither the Bridge's token nor the web server's password is in a commit");
});

// TST-375207 · level: system · module: system
// guards: UC-017; A PARTICIPANT HAS ONE OF FIVE TYPES; PARTICIPANTS ARE CONFIGURED ONCE PER INSTANCE
// given: the instance's register holds the person alice, the CLI agent dev-a (route bridge laptop agent codex) and the model endpoint campus-model
// input: the author adds a CLI agent sub-a and chooses to have it started by another CLI agent; reads the choice of starters; names the agent and presses Save
// expect: known positive — dev-a is a CLI agent and is the one starter offered (alice and campus-model are no CLI agents); the form asks no Bridge and no agent for a subagent; the commit holds the row sub-a with the route through dev-a and no Bridge; a sandboxed agent saved the same way is a subagent too
test("TST-375207: UC-017 3 a subagent names the CLI agent that starts it instead of a Bridge", async (t) => {
  const register = REGISTER("| alice | person | — | — | — | read the repository | — | account github.com/alice |",
    "| dev-a | CLI agent | codex | 200000 | — | read the repository, write to the repository, run code and tests | this machine | bridge laptop agent codex |",
    "| campus-model | model endpoint | llama | — | — | draft text | FAU data centre (EU) | endpoint campus |");
  const shown = await page(t, { instance: instanceFiles(register) });
  const main = shown.main();
  await addParticipant(main, "CLI agent");
  await put(main, "participant-name", "sub-a");
  await put(main, "participant-model", "claude-opus-5-5");
  await choose(main, "participant-reach", "through");
  assert.deepEqual(byTag(one(main, "participant-through"), "option").map((option) => option.value), ["dev-a"], "known positive: the CLI agent of the register is the starter");
  assert.equal(byClass(main, "participant-bridge").length + byClass(main, "participant-agent").length, 0, "no Bridge and no agent is asked");
  await save(main);
  const row = lastRow(shown);
  assert.deepEqual([row.name, row.type, row.route], ["sub-a", "CLI agent", "through dev-a"]);
  assert.equal(commitsOf(shown).length, 1);
});

// ---------------------------------------------------------------- the alternative flows

// TST-375208 · level: system · module: system
// guards: UC-017; NO SECRET IN THE REPOSITORY; CONFIGURATION LIVES IN THE BROWSER
// given: this browser keeps no endpoint; a model server on the loopback answers the short request of an endpoint test with the text "ok"
// input: the author adds a model endpoint; reads the form; fills the endpoint's name (inline), address, model and key in place, presses Test endpoint, names the participant and its place and presses Save
// expect: known positive — with no endpoint kept the endpoint's fields (name, URL, kind, model, key) and its test stand in the Participants form and the page stays at #participants; Test endpoint sends exactly one request to the model server under the bearer key and says the model is working; the endpoint with its key is kept in this browser as endpoint:inline; the commit holds the participant with the route endpoint inline and the model, and not the key
test("TST-375208: UC-017 3a an endpoint not configured yet is configured in place, with its test request, and its key stays in the browser", async (t) => {
  const server = await modelServer(t);
  const shown = await page(t);
  const main = shown.main();
  await addParticipant(main, "model endpoint");
  for (const className of ["participant-endpoint-name", "participant-endpoint-url", "participant-endpoint-kind", "participant-endpoint-model", "participant-endpoint-key", "participant-endpoint-test"]) one(main, className);
  assert.equal(shown.location.hash, "#participants", "known positive: the author does not leave the page");
  await put(main, "participant-endpoint-name", "inline");
  await put(main, "participant-endpoint-url", server.url);
  await put(main, "participant-endpoint-model", "tiny-model");
  await put(main, "participant-endpoint-key", "inline-secret-key");
  await click(one(main, "participant-endpoint-test"));
  assert.equal(server.requests.length, 1, "one short request");
  assert.equal(server.requests[0].authorization, "Bearer inline-secret-key");
  assert.match(one(main, "participant-endpoint-test-result").textContent, /tiny-model is working/);
  await put(main, "participant-name", "inline-model");
  await put(main, "participant-place", "this machine");
  await save(main);
  const row = lastRow(shown);
  assert.deepEqual([row.name, row.model, row.route], ["inline-model", "tiny-model", "endpoint inline"]);
  assert.deepEqual(JSON.parse(globalThis.localStorage.getItem("agent-m:akmaier/agent-m:endpoint:inline")), { url: server.url, kind: "openai-compatible", model: "tiny-model", key: "inline-secret-key" });
  assert.ok(!written(shown).includes("inline-secret-key"), "the key is in no commit");
});

// TST-375209 · level: system · module: system
// guards: UC-017; EVERY STEP EXPLAINS ITSELF; A SELF-HOSTED RUNNER SERVES AGENT M ONLY FROM A PRIVATE REPOSITORY
// given: the frame at #participants over an empty register
// input: the author adds a CI agent and reads the form on GitHub's machines; chooses a self-hosted runner and reads it again
// expect: known positive — on GitHub's machines the form has a folded explanation of the SSH alternative; it names the SSH key as an Actions secret on GitHub, a host that GitHub's machines can reach from the internet, and the runner as the recommendation, and is folded; on a self-hosted runner the form asks the runner's label and says that a self-hosted runner serves private repositories only and that a public repository's job is refused
test("TST-375209: UC-017 3, 3b a CI agent's form explains the self-hosted runner's private-only rule and the SSH alternative with its cost", async (t) => {
  const shown = await page(t);
  const main = shown.main();
  await addParticipant(main, "CI agent");
  const ssh = folds(one(main, "participants-form-box")).concat(folds(one(main, "participant-type-fields"))).map(textOf).find((text) => /SSH/.test(text));
  assert.ok(ssh, "known positive: an explanation of the SSH alternative");
  assert.match(ssh, /SSH key/);
  assert.match(ssh, /Actions secret/);
  assert.match(ssh, /internet/);
  assert.match(ssh, /runner is the recommended way|recommend/i);
  assert.ok(folds(one(main, "participant-type-fields")).concat(folds(one(main, "participants-form-box"))).filter((node) => /SSH/.test(textOf(node))).every((node) => !node.hasAttribute("open")), "folded");
  assert.equal(byClass(main, "participant-runner-label").length, 0, "no label is asked of GitHub's machines");
  await choose(main, "participant-runner", "self-hosted");
  assert.equal(byClass(main, "participant-runner-label").length, 1, "a self-hosted runner has a label");
  const runner = textOf(one(main, "participant-runner-explanation"));
  assert.match(runner, /private repositories only/);
  assert.match(runner, /public/);
});

// TST-375210 · level: system · module: system
// guards: UC-017; RESTRICTED CONTENT GOES ONLY WHERE ITS SOURCE PERMITS
// given: the instance registers the source SRC-secret with a restricted licence that permits only the place FAU data centre (EU), and the source SRC-open that permits any place
// input: the author adds a CI agent that processes data in US cloud and reads the form; changes the place to FAU data centre (EU) and reads the form; sets US cloud again and presses Save
// expect: known positive — with US cloud the form lists SRC-secret as permitting FAU data centre (EU), not US cloud, for the participant, and does not list SRC-open; with FAU data centre (EU) the form lists none; the participant with US cloud can be saved: one commit holding it
test("TST-375210: UC-017 5a a participant outside the places a source permits is listed against that source and can still be saved", async (t) => {
  const entry = (id, licence, places) => ["---", `id: ${id}`, `title: ${id}`, "kind: document", "authority: normative", `licence: ${licence}`, ...(places ? ["places:", ...places.map((place) => `  - ${place}`)] : []), "---", `# ${id} ${id}`, "",
    "## Versions", "", "| Version | Date | Edition | Read from | Files |", "|---|---|---|---|---|", "| fixture | 2026-10-13 | — | fixture | listed below |", ""].join("\n");
  const shown = await page(t, { instance: instanceFiles(REGISTER(), { "docs/sources/SRC-secret.md": entry("SRC-secret", "restricted - contract", ["FAU data centre (EU)"]), "docs/sources/SRC-open.md": entry("SRC-open", "may be republished — fixture") }) });
  const main = shown.main();
  await addParticipant(main, "CI agent");
  await put(main, "participant-name", "ci-us");
  await put(main, "participant-model", "gpt-5");
  await put(main, "participant-secret-name", "MODEL_KEY");
  await put(main, "participant-place", "US cloud");
  const listed = textOf(one(main, "participants-form-box"));
  assert.match(listed, /SRC-secret permits FAU data centre \(EU\), not US cloud for ci-us/, "known positive: the source is listed");
  assert.ok(!listed.includes("SRC-open"), "a source that permits any place is not listed");
  await put(main, "participant-place", "FAU data centre (EU)");
  assert.ok(!textOf(one(main, "participants-form-box")).includes("SRC-secret"), "an allowed place lists none");
  await put(main, "participant-place", "US cloud");
  await save(main);
  assert.equal(commitsOf(shown).length, 1, "the participant is saved");
  assert.equal(lastRow(shown).place, "US cloud");
});

// TST-375211 · level: system · module: system
// guards: UC-017; ONE CLICK PER DECISION; NO SECRET IN THE REPOSITORY
// given: a real Bridge on a computer with claude (logged in); this browser keeps the Bridges gone (nothing listens at its address), bare (no pairing token), wrong (another token than the Bridge's) and, through the jump host, behind (the web server's login kept wrong); and the Bridge good
// input: for each Bridge the author adds a CLI agent, names the agent claude and presses Test; reads the result and Save; presses Save untested and Save
// expect: known positive — through good the test says claude answered and Save is open without Save untested; gone says the Bridge gave no answer and names not running and wrong address among the likely causes; bare says it has no pairing token; wrong says it refused its pairing token; behind says the jump host refused its login; in each of those four Save is withheld and nothing is committed, no Save untested is offered after the good test, and after Save untested one click on Save commits the row, once
test("TST-375211: UC-017 6a a Bridge that does not answer is named with its reason, and nothing is saved until the author saves untested", async (t) => {
  const machine = computer({ claude: { loggedIn: true } });
  const bridge = await startBridge(t, machine, { name: "good", offered: ["claude"] });
  const closed = await freePort();
  const settings = { "bridge:good": { address: bridge.address, token: bridge.token }, "bridge:gone": { address: `http://127.0.0.1:${closed}`, token: bridge.token },
    "bridge:bare": { address: bridge.address }, "bridge:wrong": { address: bridge.address, token: "another-token" }, "bridge:behind": { port: 40100, token: bridge.token },
    "jump-host": { hostname: "jump.example.test", user: "bridge-user", sshPort: 22, portRange: [40100, 40103], httpsAddress: JUMP, login: { user: "alice", password: "not-the-password" } } };
  const shown = await page(t, { settings, jump: { behind: bridge.port } });
  const main = shown.main();
  const attempt = async (name, bridgeName) => {
    await addParticipant(main, "CLI agent");
    await put(main, "participant-name", name);
    await put(main, "participant-model", "claude-opus-5-5");
    await choose(main, "participant-bridge", bridgeName);
    await put(main, "participant-agent", "claude");
    await click(one(main, "participant-agent-test"));
    return textOf(one(main, "participant-agent-test-result"));
  };
  assert.equal(await attempt("via-good", "good"), "claude answered (2.1.300).", "known positive: a Bridge that answers");
  assert.equal(byClass(main, "participant-save-untested").length, 0, "no Save untested after a test that worked");
  assert.equal(saveButton(main).disabled, false);
  await save(main);
  assert.equal(commitsOf(shown).length, 1);
  const reasons = { gone: /gave no answer.*not running.*wrong address|gave no answer.*wrong address.*not running/, bare: /no pairing token/, wrong: /refused its pairing token/, behind: /jump host refused its login/ };
  let committed = 1;
  for (const [name, reason] of Object.entries(reasons)) {
    const said = await attempt(`via-${name}`, name);
    assert.match(said, reason, name);
    assert.equal(saveButton(main).disabled, true, `${name}: Save is withheld`);
    assert.equal(commitsOf(shown).length, committed, `${name}: nothing is committed`);
    await click(one(main, "participant-save-untested"));
    assert.equal(saveButton(main).disabled, false, `${name}: Save untested opens Save`);
    await save(main);
    committed += 1;
    assert.equal(commitsOf(shown).length, committed, `${name}: one click commits`);
  }
  assert.ok(!written(shown).includes("another-token") && !written(shown).includes("not-the-password") && !written(shown).includes(bridge.token));
});

// TST-375212 · level: system · module: system
// guards: UC-017; PARTICIPANTS ARE CONFIGURED ONCE PER INSTANCE; A PERSON'S OWN INPUT IS COMMITTED DIRECTLY
// given: the register holds alice and dev-a (read and write the repository, run code and tests); this browser lists the products acme/alpha (team-one: Developers dev-a, Product Owner and Scrum Master alice) and acme/beta (team-web: Scrum Master dev-a, Developers and Product Owner alice), both declaring the Scrum model
// input: the author presses Change on dev-a, reads the products, unticks write to the repository, reads the products again and presses Save
// expect: known positive — the page lists the product alpha with the file docs/role-assignments/team-one.md and the role Developers, and the product beta with team-web and Scrum Master; after the capability is removed the page shows that the holder dev-a of the role Developers lacks write to the repository for team-one and nothing of the kind for team-web (a Scrum Master needs only reading); Save commits the register alone: one commit to the instance, none to either product
test("TST-375212: UC-017 7a a changed participant that products use lists the products and roles, and the assignments the change makes invalid", async (t) => {
  const register = REGISTER("| alice | person | — | — | — | read the repository, write to the repository | — | account github.com/alice |",
    "| dev-a | CLI agent | codex | 200000 | — | read the repository, write to the repository, run code and tests | this machine | bridge laptop agent codex |");
  const shown = await page(t, { instance: instanceFiles(register), settings: { products: [ALPHA, BETA],
    "github-token:acme/alpha": { value: PRODUCT_TOKEN, name: "p", expires: "2027-01-01" }, "github-token:acme/beta": { value: PRODUCT_TOKEN, name: "p", expires: "2027-01-01" } },
  products: { "acme/alpha": productOf({ "team-one": [["Product Owner", ["alice"]], ["Scrum Master", ["alice"]], ["Developers", ["dev-a"]]] }),
    "acme/beta": productOf({ "team-web": [["Product Owner", ["alice"]], ["Scrum Master", ["dev-a"]], ["Developers", ["alice"]]] }) } });
  const main = shown.main();
  await click(byClass(main, "participant-change").find((button) => button.textContent.includes("dev-a")));
  let use = textOf(one(main, "participant-product-use"));
  assert.match(use, /acme\/alpha.*team-one: Developers \(docs\/role-assignments\/team-one\.md\)/, "known positive: alpha and its role");
  assert.match(use, /acme\/beta.*team-web: Scrum Master \(docs\/role-assignments\/team-web\.md\)/);
  assert.doesNotMatch(use, /lacks the capability/, "nothing is invalid yet");
  await tick(main, "write to the repository", false);
  use = textOf(one(main, "participant-product-use"));
  assert.match(use, /docs\/role-assignments\/team-one\.md: the holder dev-a of the role Developers lacks the capability write to the repository/);
  assert.doesNotMatch(use, /team-web\.md: the holder/, "a Scrum Master needs reading alone");
  await save(main);
  assert.deepEqual([commitsOf(shown).length, commitsOf(shown, "acme/alpha").length, commitsOf(shown, "acme/beta").length], [1, 0, 0]);
  assert.deepEqual(participantsIn(shown).find((row) => row.name === "dev-a").capabilities, ["read the repository", "run code and tests"]);
});

// ---------------------------------------------------------------- the findings: where the page and UC-017 disagree

// TST-375213 · level: system · module: system
// guards: UC-017; A PARTICIPANT BASED ON A LANGUAGE MODEL NAMES ITS MODEL
// given: a real Bridge on a computer with claude (logged in) offering it, kept by this browser as laptop
// input: the author adds a CLI agent, chooses the Bridge, presses List agents and adds the offered claude with its one click, and reads the field Model
// expect: known positive — the Agent field holds claude and the route reads bridge laptop agent claude; the Model field does not hold claude, the agent's name, so that two Claude Code participants on different models can name different ones
test("TST-375213: UC-017 3 adding an offered agent leaves the model to the author instead of naming the agent as the model", async (t) => {
  const machine = computer({ claude: { loggedIn: true } });
  const bridge = await startBridge(t, machine, { name: "laptop", offered: ["claude"] });
  const shown = await page(t, { settings: { "bridge:laptop": { address: bridge.address, token: bridge.token } } });
  const main = shown.main();
  await addParticipant(main, "CLI agent");
  await click(one(main, "participant-list-agents"));
  await click(byClass(main, "participant-agent-offer")[0]);
  assert.deepEqual([one(main, "participant-agent").value, textOf(one(main, "participant-route-preview"))], ["claude", "bridge laptop agent claude"], "known positive: the agent is added");
  assert.notEqual(one(main, "participant-model").value, "claude", "the model is no agent's name");
});

// TST-375214 · level: system · module: system
// guards: UC-017; A PARTICIPANT DECLARES WHERE IT PROCESSES DATA
// given: the frame at #participants over an empty register
// input: the author adds a CI agent, reads the place Agent M presets for GitHub's machines, chooses a self-hosted runner and reads the place again
// expect: known positive — for GitHub's machines the place is GitHub hosted runner; for a self-hosted runner it is not GitHub hosted runner
test("TST-375214: UC-017 5 a CI agent on a self-hosted runner is not given the place GitHub hosted runner", async (t) => {
  const shown = await page(t);
  const main = shown.main();
  await addParticipant(main, "CI agent");
  assert.equal(one(main, "participant-place").value, "GitHub hosted runner", "known positive: GitHub's machines are told");
  await choose(main, "participant-runner", "self-hosted");
  assert.notEqual(one(main, "participant-place").value, "GitHub hosted runner", "a self-hosted runner is not GitHub's machine");
});

// TST-375215 · level: system · module: system
// guards: UC-017; NO COST IS GUESSED
// given: the frame at #participants over an empty register
// input: the author adds a CI agent whose price they write as the field's hint says, input / output per million tokens ("2.00 / 8.00"), and reads the form; the register is read as the participants Agent M works with
// expect: known positive — a price written in the form the register states ("2.00 / 8.00 USD per million tokens") is saved and read as a price of 2 and 8 USD; the price as typed ("2.00 / 8.00"), which the register reads as no price, is not saved without a word: the form tells the author that this price is not read, so a job's cost is not shown as unknown for a participant whose author declared a price
test("TST-375215: UC-017 3 a price that the register cannot read is not saved without a word", async (t) => {
  const shown = await page(t);
  const main = shown.main();
  const add = async (name, price) => {
    await addParticipant(main, "CI agent");
    await put(main, "participant-name", name);
    await put(main, "participant-model", "gpt-5");
    await put(main, "participant-secret-name", "MODEL_KEY");
    await put(main, "participant-price", price);
  };
  await add("priced", "2.00 / 8.00 USD per million tokens");
  await save(main);
  assert.deepEqual(participantsIn(shown).at(-1).price, { input: 2, output: 8, currency: "USD" }, "known positive: the stated form is read");
  await add("typed", "2.00 / 8.00");
  const findings = byClass(one(main, "participants-form-box"), "findings").map(textOf).join(" ");
  assert.match(findings, /price/i, "the form tells the author that this price is not read");
});

// TST-375216 · level: system · module: system
// guards: UC-017; THE BRIDGE FINDS THE INSTALLED AGENTS
// given: a real Bridge on a computer with claude (logged in) offering only claude, kept by this browser as laptop
// input: the author adds a CLI agent on the Bridge laptop, lists its agents, and then types an agent the Bridge does not offer (banana) in place of the offered one and presses Save
// expect: known positive — List agents offers claude alone, and the participant naming claude is saved; the participant naming banana, which the Bridge does not offer, is not saved
test("TST-375216: UC-017 3 a CLI agent that the Bridge does not offer cannot be saved", async (t) => {
  const machine = computer({ claude: { loggedIn: true } });
  const bridge = await startBridge(t, machine, { name: "laptop", offered: ["claude"] });
  const shown = await page(t, { settings: { "bridge:laptop": { address: bridge.address, token: bridge.token } } });
  const main = shown.main();
  await addParticipant(main, "CLI agent");
  await put(main, "participant-name", "agent-a");
  await put(main, "participant-model", "claude-opus-5-5");
  await click(one(main, "participant-list-agents"));
  assert.deepEqual(byClass(main, "participant-agent-offer").map((button) => button.textContent), ["Add claude"], "known positive: the Bridge offers claude");
  await click(byClass(main, "participant-agent-offer")[0]);
  await save(main);
  assert.equal(lastRow(shown).route, "bridge laptop agent claude", "known positive: the offered agent is saved");
  await addParticipant(main, "CLI agent");
  await put(main, "participant-name", "agent-b");
  await put(main, "participant-model", "claude-opus-5-5");
  await put(main, "participant-agent", "banana");
  await click(saveButton(main));
  assert.equal(commitsOf(shown).length, 1, "a name the Bridge does not offer is not saved");
});

// TST-375217 · level: system · module: system
// guards: UC-017; EVERY STEP EXPLAINS ITSELF
// given: a real Bridge with claude, kept by this browser as laptop; the frame at #participants
// input: the author adds a CLI agent and reads the folded explanations of the form
// expect: known positive — every fold of the form has the summary What is this?, the type's and the capabilities' and place's among them, and one fold says that a failed test saves nothing until the author saves it untested
test("TST-375217: UC-017 6 the step Test carries a folded explanation", async (t) => {
  const machine = computer({ claude: { loggedIn: true } });
  const bridge = await startBridge(t, machine, { name: "laptop", offered: ["claude"] });
  const shown = await page(t, { settings: { "bridge:laptop": { address: bridge.address, token: bridge.token } } });
  const main = shown.main();
  await addParticipant(main, "CLI agent");
  const all = folds(main).map(textOf);
  assert.ok(all.length >= 2 && all.every((text) => text.startsWith("What is this?")), "known positive: the type and capabilities are explained, folded");
  assert.ok(all.some((text) => /untested/i.test(text)), "the step Test is explained: a failed test saves nothing until the author saves it untested");
});
