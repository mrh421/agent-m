// Release tests of the requirements UC-017 "Configure the participants of the instance" realises, each checked from what an author does on the Participants page and reads in the register `docs/participants.md`
// that the page commits: one list for the instance, five types, the capabilities, the place and the model a participant declares, the context that a job is checked against and the price that usage is priced at,
// the places a restricted source permits, no key in the repository, the author's commit made directly and in one click, the folded explanations, the self-hosted runner refused for a public product (routesFor), a
// Bridge behind NAT reached through the tunnel's two ends, and the agents a Bridge finds on its computer. The page is the real route `participants` of MOD-settings-pages shown by the frame, over a fake GitHub
// server and real Bridges on computers of fixture agents (tests/uc-017-harness.mjs). TST-375301 maps every requirement UC-017 realises to the release test that guards it. The checks SPEC.md names for these
// requirements are those of tests/test_participants.py and the files named there; the older tests of the page declare the levels unit and system.
// Run: node --test tests/release-uc-017-configure-participants.test.mjs
//
// Module: MOD-settings-pages
// Module: MOD-participant-list
// Module: MOD-bridge-client
// Module: MOD-bridge-jobs
// Module: MOD-agent-processes
// Guards: UC-017
// Level: release
//
// Written for the release testing of sprint 142 by developer-sonnet-j (ITM-375). The `Agent-M-Participant` trailers of the code UC-017's flow runs name developer-sonnet-a, -b, -c, -d, developer-opus-a, -b and
// developer-sol-c, and the commits of ITM-352, ITM-353, ITM-354 and ITM-473 carry none; developer-sonnet-j built one commit of it, ITM-1186, which exports CAPABILITIES and PRESETS from participants.mjs and takes
// the note on the prompt bar off the Participants page. No case of this file guards that behaviour (RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER); the exports are used by none of them, and the prompt bar's
// offer, which that commit's note stated, is UC-049's. Where the page and the SPEC or UC-017 disagreed, the case would follow the text and be marked `todo` with the word FINDING; none of this file's does (the
// findings stand in tests/system-uc-017-participants-through-the-frame.test.mjs). Readings the texts leave open, which the cases state:
//   - "an instance lists all its participants in the one list `docs/participants.md` of its own repository, and a product assigns its roles from that list" (PARTICIPANTS ARE CONFIGURED ONCE PER INSTANCE) is read as
//     every save of the page writing the one file, whatever the type, and as a product's role assignment being resolved against the names of that file: the participant a product names is found there.
//   - "presets the capabilities typical for the type" (UC-017 4) is read, with the table of UC-017's types, as the capabilities typical for the type being among those the page ticks: a person all, a model endpoint draft
//     text, and the other three types at least read, write, run code and tests.
//   - "a job can check before it sends that everything fits" and "Left empty, a job is not sent to it" (UC-017 3) are read as MOD-participant-list's `eligible`, given the size of the job: a participant whose context is
//     smaller than the size, or declares none, is left out with a reason.
//   - "a cost only when its runtime reports one, or when the runtime reports usage and the participant declares a price" (NO COST IS GUESSED) is read as MOD-job-ledger's `jobCost` over the usage that a real
//     Bridge reports for an agent's answer and the price a participant of the register declares.
//   - "the dashboard writes only as a commit made with that person's own token to the default branch" (A PERSON'S OWN INPUT IS COMMITTED DIRECTLY) is read as the writes the host sees being the blobs, the tree, the
//     commit and the move of the default branch, and no branch, pull request or issue.
//   - "an SSH reverse tunnel that this machine opens to a jump host ... and a forward from the person's own machine" (A BRIDGE BEHIND NAT IS REACHED THROUGH A REVERSE TUNNEL) is read as the two commands the page
//     writes for the two ends (MOD-bridge-client's `tunnelCommands`) and as what they do: each end a TCP forward on the loopback. The jump host's end and the person's end are two ports of this one machine.

import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { testDeclarations } from "../src/test-document/index.mjs";
import { installDocument } from "./settings-pages-harness.mjs";
import { ALPHA, INSTANCE, OPEN, PARTICIPANTS, PRODUCT_TOKEN, REGISTER, TOKEN, addParticipant, byClass, byTag, choose, click, commitsOf, computer, forward, freePort, instanceFiles, modelServer, one, page,
  productOf, put, registerOf, save, saveButton, settle, startBridge } from "./uc-017-harness.mjs";

installDocument();
const { view } = await import("../src/settings-pages/index.mjs");
const { registerStrategies } = await import("../src/job-runner/index.mjs");
for (const strategies of view.strategies) registerStrategies("tests/release-uc-017-configure-participants.test.mjs", strategies);
const { documentFindings, readDocument } = await import("../src/documents/index.mjs");
const { eligible, participantSchema, participantsOf } = await import("../src/participant-list/index.mjs");
const { bridgeAt, ask, testBridge, tunnelCommands } = await import("../src/bridge-client/index.mjs");
const { jobCost } = await import("../src/job-ledger/index.mjs");
const { routesFor } = await import("../src/runtimes/index.mjs");
const { connect, parseAddress } = await import("../src/repository-hosts/index.mjs");
const { permittedPlaces, sourceSchemas } = await import("../src/source-register/index.mjs");

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const UC = "docs/use-cases/UC-017-configure-participants.md";
const SELF = "tests/release-uc-017-configure-participants.test.mjs";
const CODING = ["draft text", "read the repository", "write to the repository", "run code and tests", "use tools"];
const textOf = (node) => node.textContent.replace(/\s+/g, " ");
const participantsIn = (shown) => participantsOf(readDocument(participantSchema(), PARTICIPANTS, registerOf(shown)));
/** The errors the register's schema finds in the text of a register. */
const errorsOf = (text) => documentFindings(participantSchema(), readDocument(participantSchema(), PARTICIPANTS, text)).filter((found) => found.kind === "error");
const rules = (text) => errorsOf(text).map((found) => found.rule);
const folds = (root) => byTag(root, "details").filter((node) => String(node.className).split(" ").includes("explain"));
/** Every text any commit of any repository of the world wrote: files and messages. */
const written = (shown) => [INSTANCE, "acme/alpha", "acme/beta", "acme/open"].flatMap((repository) => { try { return shown.world.commits(repository); } catch { return []; } })
  .flatMap((commit) => [commit.message, ...Object.values(commit.files)]).join("\n");
// A row of each type that breaks no rule; `with` replaces cells.
const ROWS = {
  person: ["p-1", "person", "—", "—", "—", "draft text", "—", "account github.com/p-1"],
  "model endpoint": ["m-1", "model endpoint", "llama", "—", "—", "draft text", "FAU data centre (EU)", "endpoint campus"],
  "CI agent": ["c-1", "CI agent", "gpt-5", "—", "—", CODING.join(", "), "GitHub hosted runner", "ci hosted secret MODEL_KEY"],
  "CLI agent": ["l-1", "CLI agent", "codex", "—", "—", CODING.join(", "), "this machine", "bridge laptop agent codex"],
  "sandboxed agent": ["s-1", "sandboxed agent", "codex", "—", "—", CODING.join(", "), "a container", "bridge sandbox agent codex"],
};
const rowText = (kind, cells = {}) => {
  const columns = ["Name", "Type", "Model", "Context", "Price", "Capabilities", "Processing place", "Route"];
  return `| ${ROWS[kind].map((value, index) => cells[columns[index]] ?? value).join(" | ")} |`;
};
/** The person ticks or unticks the capability `name`. */
async function tick(main, name, on) {
  const box = byClass(main, "participant-capability").find((each) => each.value === name);
  box.checked = on;
  box.dispatchEvent(new Event("change"));
  await settle();
}

// ---------------------------------------------------------------- the map

// Each requirement UC-017 realises, with the release test that guards it.
const EVIDENCE = {
  "PARTICIPANTS ARE CONFIGURED ONCE PER INSTANCE": [[SELF, "TST-375302"]],
  "A PARTICIPANT HAS ONE OF FIVE TYPES": [[SELF, "TST-375303"]],
  "A PARTICIPANT DECLARES ITS CAPABILITIES": [[SELF, "TST-375304"]],
  "A PARTICIPANT DECLARES WHERE IT PROCESSES DATA": [[SELF, "TST-375305"]],
  "A PARTICIPANT BASED ON A LANGUAGE MODEL NAMES ITS MODEL": [[SELF, "TST-375306"]],
  "NO REQUIREMENT IS LEFT OUT OF THE CONTEXT SILENTLY": [[SELF, "TST-375307"]],
  "NO COST IS GUESSED": [[SELF, "TST-375308"]],
  "RESTRICTED CONTENT GOES ONLY WHERE ITS SOURCE PERMITS": [[SELF, "TST-375309"]],
  "NO SECRET IN THE REPOSITORY": [[SELF, "TST-375310"]],
  "A PERSON'S OWN INPUT IS COMMITTED DIRECTLY": [[SELF, "TST-375311"]],
  "ONE CLICK PER DECISION": [[SELF, "TST-375312"]],
  "EVERY STEP EXPLAINS ITSELF": [[SELF, "TST-375313"]],
  "A SELF-HOSTED RUNNER SERVES AGENT M ONLY FROM A PRIVATE REPOSITORY": [[SELF, "TST-375314"]],
  "A BRIDGE BEHIND NAT IS REACHED THROUGH A REVERSE TUNNEL": [[SELF, "TST-375315"]],
  "THE BRIDGE FINDS THE INSTALLED AGENTS": [[SELF, "TST-375316"]],
};

// TST-375301 · level: release · module: system
// guards: UC-017
// given: UC-017 as committed text, whose `realises` lists fifteen requirements, and the release tests named in EVIDENCE
// input: read UC-017's list of the requirements it realises, and the declarations of the test file named for each
// expect: known positive — UC-017 realises these fifteen requirements; the map holds exactly them; each has a release test named; each test named stands in its file with the level release and guards that requirement; every case of this file declares the level release and guards UC-017
test("TST-375301: UC-017 every requirement it realises has a release test that guards it", () => {
  const front = /^realises:\n((?:  - .*\n)+)/m.exec(read(UC))?.[1] ?? "";
  const realised = front.split("\n").filter(Boolean).map((line) => line.replace(/^ {2}- /, ""));
  assert.equal(realised.length, 15, "known positive: UC-017 realises fifteen requirements");
  assert.deepEqual([...realised].sort(), Object.keys(EVIDENCE).sort(), "the map holds exactly the requirements UC-017 realises");
  for (const [requirement, named] of Object.entries(EVIDENCE)) {
    assert.ok(named.length > 0, `${requirement}: a release test is named`);
    for (const [file, id] of named) {
      assert.ok(existsSync(new URL(`../${file}`, import.meta.url)), `${requirement}: ${file} exists`);
      const found = testDeclarations(file, read(file)).find((each) => each.id === id);
      assert.ok(found, `${requirement}: ${id} is declared in ${file}`);
      assert.equal(found.level, "release", `${id} is a release test`);
      assert.ok((found.guards ?? []).includes(requirement), `${id} guards ${requirement}`);
    }
  }
  for (const own of testDeclarations(SELF, read(SELF))) assert.deepEqual([own.level, own.guards.includes("UC-017")], ["release", true], own.id);
});

// ---------------------------------------------------------------- the register: one list, five types, what a participant declares

// TST-375302 · level: release · module: system
// guards: PARTICIPANTS ARE CONFIGURED ONCE PER INSTANCE; UC-017
// given: an instance with an empty register; the product acme/alpha, whose role assignment team-one names dev-b for the Product Owner and for Developers and ghost for the Scrum Master, and which this browser lists
// input: the author saves the participants dev-a (a person) and dev-b (a CI agent) in two saves; then presses Change on dev-b and reads the products
// expect: known positive — both saves write the one file docs/participants.md, the second on the first's, and the instance holds no other file whose name says participants; the register lists dev-a and dev-b in that order; a product's role assignment is read against that list: the page lists acme/alpha and the roles Product Owner and Developers for dev-b, and no role of ghost, who is in no register; the products receive no commit
test("TST-375302: the instance lists all its participants in the one register docs/participants.md, and a product's role assignment is read against it", async (t) => {
  const shown = await page(t, { settings: { products: [ALPHA], "github-token:acme/alpha": { value: PRODUCT_TOKEN, name: "p", expires: "2027-01-01" } },
    products: { "acme/alpha": productOf({ "team-one": [["Product Owner", ["dev-b"]], ["Scrum Master", ["ghost"]], ["Developers", ["dev-b"]]] }) } });
  const main = shown.main();
  await addParticipant(main, "person");
  await put(main, "participant-name", "dev-a");
  await put(main, "participant-account", "github.com/dev-a");
  await save(main);
  assert.deepEqual(commitsOf(shown).map((commit) => Object.keys(commit.files)), [[PARTICIPANTS]], "known positive: the file");
  await addParticipant(main, "CI agent");
  await put(main, "participant-name", "dev-b");
  await put(main, "participant-model", "gpt-5");
  await put(main, "participant-secret-name", "MODEL_KEY");
  await save(main);
  assert.deepEqual(commitsOf(shown).map((commit) => Object.keys(commit.files)), [[PARTICIPANTS], [PARTICIPANTS]]);
  assert.deepEqual(participantsIn(shown).map((row) => row.name), ["dev-a", "dev-b"]);
  assert.deepEqual(Object.keys(shown.world.files(INSTANCE)).filter((path) => /participant/i.test(path)), [PARTICIPANTS]);
  await click(byClass(main, "participant-change").find((button) => button.textContent.includes("dev-b")));
  const use = textOf(one(main, "participant-product-use"));
  assert.match(use, /acme\/alpha.*team-one: Product Owner.*team-one: Developers \(docs\/role-assignments\/team-one\.md\)/);
  assert.doesNotMatch(use, /Scrum Master|ghost/);
  assert.deepEqual([commitsOf(shown, "acme/alpha").length], [0]);
});

// TST-375303 · level: release · module: system
// guards: A PARTICIPANT HAS ONE OF FIVE TYPES; UC-017
// given: a register with one row of each of the five types, and the same row of a person with the type robot
// input: read the register with the schema of the register; the author opens + Add participant and reads the choice of type
// expect: known positive — the five rows break no rule; the row of type robot is an error under the rule that a participant has one of five types; the choice of type offers person, model endpoint, CI agent, CLI agent and sandboxed agent and no other
test("TST-375303: a participant is a person, a model endpoint, a CI agent, a CLI agent or a sandboxed agent, and nothing else", async (t) => {
  assert.deepEqual(errorsOf(REGISTER(...Object.keys(ROWS).map((kind) => rowText(kind)))), [], "known positive: each type is accepted");
  assert.ok(rules(REGISTER(rowText("person", { Type: "robot" }))).includes("A PARTICIPANT HAS ONE OF FIVE TYPES"));
  const shown = await page(t);
  const main = shown.main();
  await click(one(main, "participants-add"));
  assert.deepEqual(byTag(one(main, "participant-type"), "option").map((option) => option.value).filter(Boolean), ["person", "model endpoint", "CI agent", "CLI agent", "sandboxed agent"]);
});

// TST-375304 · level: release · module: system
// guards: A PARTICIPANT DECLARES ITS CAPABILITIES; UC-017
// given: an instance with an empty register; a register row of a person with the capabilities draft text and fly, and one with none
// input: the author adds a participant of each type and reads the capabilities the page presets; then unticks every capability of a CI agent and presses Save, ticks one and presses Save
// expect: known positive — a person has all six presets ticked; a model endpoint draft text; each of the other three types at least read the repository, write to the repository and run code and tests, and a CLI and a sandboxed agent use tools too; a capability outside the six, or none, is an error under the rule that a participant declares its capabilities; with none ticked the click on Save commits nothing, and with one ticked it commits that one
test("TST-375304: a participant declares its capabilities, which the page presets by type, and a row without any or with another is refused", async (t) => {
  assert.deepEqual(rules(REGISTER(rowText("person"))), [], "known positive: a row with its capabilities");
  assert.ok(rules(REGISTER(rowText("person", { Capabilities: "draft text, fly" }))).includes("A PARTICIPANT DECLARES ITS CAPABILITIES"));
  assert.ok(rules(REGISTER(rowText("person", { Capabilities: "—" }))).includes("A PARTICIPANT DECLARES ITS CAPABILITIES"));
  const shown = await page(t, { settings: { "endpoint:campus": { url: "https://models.example/v1", kind: "openai-compatible", model: "llama", key: "k" } } });
  const main = shown.main();
  const ticked = () => byClass(main, "participant-capability").filter((box) => box.checked).map((box) => box.value);
  const presets = {};
  for (const kind of Object.keys(ROWS)) { await addParticipant(main, kind); presets[kind] = ticked(); }
  assert.deepEqual(presets.person, ["draft text", "read the repository", "write to the repository", "run code and tests", "use tools", "reach the web"]);
  assert.deepEqual(presets["model endpoint"], ["draft text"]);
  for (const kind of ["CI agent", "CLI agent", "sandboxed agent"]) for (const name of ["read the repository", "write to the repository", "run code and tests"]) assert.ok(presets[kind].includes(name), `${kind}: ${name}`);
  for (const kind of ["CLI agent", "sandboxed agent"]) assert.ok(presets[kind].includes("use tools"), `${kind}: use tools`);
  await addParticipant(main, "CI agent");
  await put(main, "participant-name", "ci-a");
  await put(main, "participant-model", "gpt-5");
  await put(main, "participant-secret-name", "MODEL_KEY");
  for (const name of ticked()) await tick(main, name, false);
  await click(saveButton(main));
  assert.equal(commitsOf(shown).length, 0, "no capability, no commit");
  await tick(main, "draft text", true);
  await save(main);
  assert.deepEqual(participantsIn(shown).map((row) => [row.name, row.capabilities]), [["ci-a", ["draft text"]]]);
});

// TST-375305 · level: release · module: system
// guards: A PARTICIPANT DECLARES WHERE IT PROCESSES DATA; UC-017
// given: an instance with an empty register and the Bridge laptop kept by this browser; a register row of a CLI agent without a place and the same row with one; a row of a person
// input: the author adds a CLI agent, reads the place Agent M presets, empties it and presses Save, then writes a place and presses Save
// expect: known positive — a CLI agent's row with a place breaks no rule and a person's row with none breaks none; the CLI agent's row without a place is an error under the rule that a participant states where it processes data; the page presets this machine for a CLI agent; with the place emptied the click on Save commits nothing, and with a place written it commits that place
test("TST-375305: a participant that is not a person states where it processes data, which the page presets for a CLI agent as this machine", async (t) => {
  assert.deepEqual(rules(REGISTER(rowText("CLI agent"), rowText("person"))), [], "known positive: a place, and a person's none");
  assert.ok(rules(REGISTER(rowText("CLI agent", { "Processing place": "—" }))).includes("A PARTICIPANT DECLARES WHERE IT PROCESSES DATA"));
  const shown = await page(t, { settings: { "bridge:laptop": { address: "http://127.0.0.1:9", token: "unused" } } });
  const main = shown.main();
  await addParticipant(main, "CLI agent");
  assert.equal(one(main, "participant-place").value, "this machine");
  await put(main, "participant-name", "dev-a");
  await put(main, "participant-model", "codex");
  await put(main, "participant-agent", "codex");
  await put(main, "participant-place", "");
  await click(saveButton(main));
  assert.equal(commitsOf(shown).length, 0, "no place, no commit");
  await put(main, "participant-place", "the lab computer");
  await save(main);
  assert.deepEqual(participantsIn(shown).map((row) => [row.name, row.place]), [["dev-a", "the lab computer"]]);
});

// TST-375306 · level: release · module: system
// guards: A PARTICIPANT BASED ON A LANGUAGE MODEL NAMES ITS MODEL; UC-017
// given: an instance with an empty register and the Bridge laptop kept by this browser; the rows of the four types that work with a language model, with and without their model, and the row of a person
// input: read the register with the schema of the register; the author adds a CLI agent without a model and presses Save, then names the model and presses Save
// expect: known positive — each of the model endpoint, the CI agent, the CLI agent and the sandboxed agent, with its model, breaks no rule, and a person's row with none breaks none; each of the four without its model is an error under the rule that such a participant names its model; the click on Save with no model commits nothing, and with the model named commits it
test("TST-375306: a participant that works with a language model names it, and a person names none", async (t) => {
  const models = ["model endpoint", "CI agent", "CLI agent", "sandboxed agent"];
  assert.deepEqual(errorsOf(REGISTER(...models.map((kind) => rowText(kind)), rowText("person"))), [], "known positive: with its model, and a person without");
  for (const kind of models) assert.ok(rules(REGISTER(rowText(kind, { Model: "—" }))).includes("A PARTICIPANT BASED ON A LANGUAGE MODEL NAMES ITS MODEL"), kind);
  const shown = await page(t, { settings: { "bridge:laptop": { address: "http://127.0.0.1:9", token: "unused" } } });
  const main = shown.main();
  await addParticipant(main, "CLI agent");
  await put(main, "participant-name", "dev-a");
  await put(main, "participant-agent", "codex");
  await click(saveButton(main));
  assert.equal(commitsOf(shown).length, 0, "no model, no commit");
  await put(main, "participant-model", "codex-model");
  await save(main);
  assert.deepEqual(participantsIn(shown).map((row) => [row.name, row.model]), [["dev-a", "codex-model"]]);
});

// ---------------------------------------------------------------- what a job is checked against: context, price, places

// TST-375307 · level: release · module: system
// guards: NO REQUIREMENT IS LEFT OUT OF THE CONTEXT SILENTLY; UC-017
// given: an instance with an empty register
// input: the author saves three CI agents, small with the context 1000, big with 200000 and none with no context; Agent M asks which of them may do a job of 5000 tokens, and of 500 tokens
// expect: known positive — for 5000 tokens big is eligible; small is left out with a reason that names its 1000 and the job's 5000; none is left out with a reason that it declares no context size; for 500 tokens small is eligible too, and none is still left out
test("TST-375307: a participant whose context does not hold the job, or declares none, is left out with the reason, and no job is sent to it", async (t) => {
  const shown = await page(t);
  const main = shown.main();
  for (const [name, context] of [["small", "1000"], ["big", "200000"], ["none", ""]]) {
    await addParticipant(main, "CI agent");
    await put(main, "participant-name", name);
    await put(main, "participant-model", "gpt-5");
    await put(main, "participant-secret-name", "MODEL_KEY");
    if (context) await put(main, "participant-context", context);
    await save(main);
  }
  const participants = participantsIn(shown);
  assert.deepEqual(participants.map((row) => row.context), [1000, 200000, null]);
  const large = eligible(participants, { capabilities: [], size: 5000 });
  assert.deepEqual(large.eligible.map((row) => row.name), ["big"], "known positive: the participant whose context holds the job");
  const reasons = Object.fromEntries(large.leftOut.map(({ participant, reasons: why }) => [participant.name, why.join("; ")]));
  assert.match(reasons.small, /1000.*5000/);
  assert.match(reasons.none, /declares no context size/);
  assert.deepEqual(eligible(participants, { capabilities: [], size: 500 }).eligible.map((row) => row.name), ["small", "big"]);
});

// TST-375308 · level: release · module: system
// guards: NO COST IS GUESSED; UC-017
// given: a computer with claude (logged in) and a real Bridge on it, whose claude reports 5 input and 1 output tokens for its answer; an instance whose register the author fills with the CI agent priced (price 1.00 / 2.00 USD per million tokens) and the CI agent unpriced (none)
// input: ask claude through the Bridge for an answer; price the usage it reported for each participant; and a job that reported no usage for the priced one
// expect: known positive — the Bridge reports the usage of 5 and 1 tokens; for the priced participant the cost is known, 0.000007 USD, from the usage at the declared price; for the unpriced participant the cost is not known and the usage is kept, never an amount of zero; the priced participant with no usage has no known cost either
test("TST-375308: a cost is shown only from a reported cost or from reported usage at a declared price, and otherwise as unknown", async (t) => {
  const machine = computer({ claude: { loggedIn: true } });
  const bridge = await startBridge(t, machine, { name: "laptop", offered: ["claude"] });
  const shown = await page(t);
  const main = shown.main();
  for (const [name, price] of [["priced", "1.00 / 2.00 USD per million tokens"], ["unpriced", ""]]) {
    await addParticipant(main, "CI agent");
    await put(main, "participant-name", name);
    await put(main, "participant-model", "gpt-5");
    await put(main, "participant-secret-name", "MODEL_KEY");
    if (price) await put(main, "participant-price", price);
    await save(main);
  }
  const [priced, unpriced] = participantsIn(shown);
  assert.deepEqual(priced.price, { input: 1, output: 2, currency: "USD" });
  assert.equal(unpriced.price, null);
  const answer = await ask(bridgeAt({ address: bridge.address, token: bridge.token }), { agent: "claude" }, "Say hi.");
  assert.deepEqual([answer.usage.inputTokens, answer.usage.outputTokens], [5, 1], "known positive: the runtime reports its usage");
  assert.deepEqual(jobCost(answer.usage, priced), { known: true, amount: 0.000007, currency: "USD", basis: "usage at the declared price" });
  assert.deepEqual(jobCost(answer.usage, unpriced), { known: false, usage: answer.usage });
  assert.equal(jobCost(null, priced).known, false);
});

// TST-375309 · level: release · module: system
// guards: RESTRICTED CONTENT GOES ONLY WHERE ITS SOURCE PERMITS; UC-017
// given: the instance registers the source SRC-secret, restricted, which permits only FAU data centre (EU), and the source SRC-open, which may be republished; the register holds the person alice
// input: the author saves the CI agents ci-us (US cloud) and ci-fau (FAU data centre (EU)); Agent M asks who may be given the content of SRC-secret, and who the content of SRC-open
// expect: known positive — the places SRC-secret permits are FAU data centre (EU) and SRC-open permits any; ci-fau is eligible for the content of SRC-secret; ci-us is left out with a reason that names its place US cloud and SRC-secret, and so is alice, who declares no place; both agents were saved, ci-us too, and every participant is eligible for the content of SRC-open, where no place is asked
test("TST-375309: the content of a restricted source is given only to a participant whose processing place the source permits, though a participant elsewhere can be saved", async (t) => {
  const entry = (id, licence, places) => ["---", `id: ${id}`, `title: ${id}`, "kind: document", "authority: normative", `licence: ${licence}`, ...(places ? ["places:", ...places.map((place) => `  - ${place}`)] : []), "---", `# ${id} ${id}`, "",
    "## Versions", "", "| Version | Date | Edition | Read from | Files |", "|---|---|---|---|---|", "| fixture | 2026-10-13 | — | fixture | listed below |", ""].join("\n");
  const secret = entry("SRC-secret", "restricted - contract", ["FAU data centre (EU)"]), open = entry("SRC-open", "may be republished — fixture");
  const alice = rowText("person", { Name: "alice", Route: "account github.com/alice" });
  const shown = await page(t, { instance: instanceFiles(REGISTER(alice), { "docs/sources/SRC-secret.md": secret, "docs/sources/SRC-open.md": open }) });
  const main = shown.main();
  for (const [name, place] of [["ci-us", "US cloud"], ["ci-fau", "FAU data centre (EU)"]]) {
    await addParticipant(main, "CI agent");
    await put(main, "participant-name", name);
    await put(main, "participant-model", "gpt-5");
    await put(main, "participant-secret-name", "MODEL_KEY");
    await put(main, "participant-place", place);
    await save(main);
  }
  const participants = participantsIn(shown);
  assert.deepEqual(participants.map((row) => row.name), ["alice", "ci-us", "ci-fau"], "both agents were saved");
  const { entry: schema } = sourceSchemas();
  const allowed = permittedPlaces(readDocument(schema, "docs/sources/SRC-secret.md", secret));
  assert.deepEqual([allowed, permittedPlaces(readDocument(schema, "docs/sources/SRC-open.md", open))], [["FAU data centre (EU)"], "any"], "known positive: what the sources permit");
  const given = eligible(participants, { capabilities: [], places: [{ from: "SRC-secret", allowed }] });
  assert.deepEqual(given.eligible.map((row) => row.name), ["ci-fau"]);
  const why = Object.fromEntries(given.leftOut.map(({ participant, reasons }) => [participant.name, reasons.join("; ")]));
  assert.match(why["ci-us"], /US cloud.*SRC-secret/);
  assert.match(why.alice, /declares no processing place.*SRC-secret/);
  assert.equal(eligible(participants, { capabilities: [] }).eligible.length, 3, "a source that permits any place asks none");
});

// ---------------------------------------------------------------- the repository, the click and the explanations

// TST-375310 · level: release · module: system
// guards: NO SECRET IN THE REPOSITORY; UC-017
// given: a computer with claude (logged in), a real Bridge on it with the pairing token T, kept by this browser as laptop; the instance's token and a model endpoint's key K the author types into the inline form
// input: the author saves a model endpoint with a new endpoint (name inline, key K), a CI agent that names the Actions secret MODEL_KEY, and a CLI agent on the Bridge laptop, tested and saved
// expect: known positive — the endpoint with its key K is kept in this browser and its key stands nowhere else, the commits are made under the instance's token, the register names the CI secret MODEL_KEY and the Bridge laptop by name; no commit of any repository, in a file or in a message, holds K, T or the instance's token
test("TST-375310: no key, token or password of a participant is written into the repository, only the name of its CI secret and of its Bridge", async (t) => {
  const machine = computer({ claude: { loggedIn: true } });
  const bridge = await startBridge(t, machine, { name: "laptop", offered: ["claude"] });
  const server = await modelServer(t);
  const key = "sk-endpoint-0123456789abcdef";
  const shown = await page(t, { settings: { "bridge:laptop": { address: bridge.address, token: bridge.token } } });
  const main = shown.main();
  await addParticipant(main, "model endpoint");
  await put(main, "participant-name", "campus-model");
  await put(main, "participant-endpoint-name", "inline");
  await put(main, "participant-endpoint-url", server.url);
  await put(main, "participant-endpoint-model", "tiny-model");
  await put(main, "participant-endpoint-key", key);
  await put(main, "participant-place", "this machine");
  await save(main);
  await addParticipant(main, "CI agent");
  await put(main, "participant-name", "ci-writer");
  await put(main, "participant-model", "gpt-5");
  await put(main, "participant-secret-name", "MODEL_KEY");
  await save(main);
  await addParticipant(main, "CLI agent");
  await put(main, "participant-name", "claude-lap");
  await put(main, "participant-model", "claude-opus-5-5");
  await click(one(main, "participant-list-agents"));
  await click(byClass(main, "participant-agent-offer")[0]);
  await put(main, "participant-model", "claude-opus-5-5");
  await click(one(main, "participant-agent-test"));
  await save(main);
  assert.equal(JSON.parse(globalThis.localStorage.getItem("agent-m:akmaier/agent-m:endpoint:inline")).key, key, "known positive: the key is kept in this browser");
  assert.deepEqual(commitsOf(shown).map((commit) => commit.authorization), [1, 2, 3].map(() => `Bearer ${TOKEN}`));
  assert.deepEqual(participantsIn(shown).map((row) => row.route), ["endpoint inline", "ci hosted secret MODEL_KEY", "bridge laptop agent claude"]);
  const everything = written(shown);
  for (const [what, secret] of [["the endpoint's key", key], ["the Bridge's token", bridge.token], ["the instance's token", TOKEN]]) assert.ok(!everything.includes(secret), `${what} is in no commit`);
});

// TST-375311 · level: release · module: system
// guards: A PERSON'S OWN INPUT IS COMMITTED DIRECTLY; UC-017
// given: an instance with an empty register, the author's token in this browser, and a fake GitHub that records every request it is sent
// input: the author adds a person and presses Save
// expect: known positive — one commit, under the author's token, holding docs/participants.md alone, with a message naming the file; the requests that write include the move of the default branch main to the commit and are none but the blobs, the tree, the commit and that move, so none creates a branch, a pull request or an issue; the register on the default branch holds the participant the moment Save returns
test("TST-375311: a participant the author saves is committed to the default branch under the author's own token, with no pull request", async (t) => {
  const shown = await page(t);
  const main = shown.main();
  await addParticipant(main, "person");
  await put(main, "participant-name", "akmaier");
  await put(main, "participant-account", "github.com/akmaier");
  assert.equal(commitsOf(shown).length, 0);
  await save(main);
  const commits = commitsOf(shown);
  assert.deepEqual(commits.map((commit) => [Object.keys(commit.files), commit.authorization]), [[[PARTICIPANTS], `Bearer ${TOKEN}`]], "known positive: one commit by the author");
  assert.match(commits[0].message, /participants\.md/);
  const writes = shown.world.requests.filter((request) => request.method !== "GET" && request.url.pathname !== "/graphql").map((request) => `${request.method} ${request.url.pathname.split("/").slice(4).join("/")}`);
  const allowed = ["PATCH git/refs/heads/main", "POST git/blobs", "POST git/commits", "POST git/trees"];
  assert.ok(writes.includes("PATCH git/refs/heads/main"), "the default branch is moved to the commit");
  assert.deepEqual(writes.filter((write) => !allowed.includes(write)), [], "no branch, pull request or issue is made");
  assert.deepEqual(participantsIn(shown).map((row) => row.name), ["akmaier"]);
});

// TST-375312 · level: release · module: system
// guards: ONE CLICK PER DECISION; UC-017
// given: an instance with an empty register, a model endpoint campus and the Bridge laptop kept by this browser
// input: for each of the five types the author fills the inputs the type asks for and presses Save once
// expect: known positive — before the press nothing is committed; the one press commits the participant, whatever the type: the count of commits grows by one, the page says Saved. and closes the form, and the list holds the participant; no second press, confirmation or step follows
test("TST-375312: a participant of any type is saved with one click once its inputs are complete", async (t) => {
  const shown = await page(t, { settings: { "endpoint:campus": { url: "https://models.example/v1", kind: "openai-compatible", model: "llama", key: "k" }, "bridge:laptop": { address: "http://127.0.0.1:9", token: "unused" } } });
  const main = shown.main();
  const inputs = {
    person: async () => put(main, "participant-account", "github.com/one"),
    "model endpoint": async () => put(main, "participant-place", "FAU data centre (EU)"),
    "CI agent": async () => { await put(main, "participant-model", "gpt-5"); await put(main, "participant-secret-name", "MODEL_KEY"); },
    "CLI agent": async () => { await put(main, "participant-model", "codex-model"); await put(main, "participant-agent", "codex"); },
    "sandboxed agent": async () => { await put(main, "participant-model", "codex-model"); await put(main, "participant-agent", "codex"); await put(main, "participant-place", "a container"); },
  };
  let committed = 0;
  for (const [kind, fill] of Object.entries(inputs)) {
    await addParticipant(main, kind);
    await put(main, "participant-name", `one-${kind.replace(/ /g, "-")}`);
    await fill();
    assert.equal(commitsOf(shown).length, committed, `${kind}: nothing before the click`);
    await click(saveButton(main));
    committed += 1;
    assert.equal(commitsOf(shown).length, committed, `${kind}: one click, one commit`);
    assert.equal(textOf(one(main, "participants-result")), "Saved.", kind);
    assert.equal(one(main, "participants-add-panel").hidden, true, `${kind}: the form closes`);
    assert.match(textOf(one(main, "participants-list")), new RegExp(`one-${kind.replace(/ /g, "-")}`), `${kind}: listed`);
  }
});

// TST-375313 · level: release · module: system
// guards: EVERY STEP EXPLAINS ITSELF; UC-017
// given: an instance with an empty register, no model endpoint and no Bridge kept by this browser
// input: the author adds a participant of each type and reads the folded explanations of its form
// expect: known positive — for each type the form holds a folded What is this? for the type and one for capabilities and place, each with text; the form of a CI agent holds one that names the self-hosted runner and one that names SSH; the form of a model endpoint with no endpoint kept holds the four explanations of the endpoint's address, model, key and test (the frame reports a topic it lacks and shows none, so an empty fold is a missing explanation); every fold is closed
test("TST-375313: every step of adding a participant carries a folded explanation with text", async (t) => {
  const shown = await page(t);
  const main = shown.main();
  const seen = {};
  for (const kind of Object.keys(ROWS)) {
    await addParticipant(main, kind);
    seen[kind] = folds(main).map(textOf);
    for (const fold of folds(main)) assert.ok(!fold.hasAttribute("open"), `${kind}: folded`);
    assert.ok(seen[kind].length >= 2, `${kind}: the type and the capabilities`);
    for (const text of seen[kind]) assert.ok(text.replace("What is this?", "").trim().length > 20, `${kind}: a fold with text: ${text.slice(0, 40)}`);
  }
  assert.ok(seen["CI agent"].some((text) => /self-hosted runner/i.test(text)), "known positive: the runner is explained");
  assert.ok(seen["CI agent"].some((text) => /SSH/.test(text) && /recommended/i.test(text)), "the SSH alternative is explained, with the runner as the recommendation");
  assert.ok(seen["model endpoint"].length >= 6, "the endpoint's four steps and the type and capabilities");
});

// ---------------------------------------------------------------- the runner, the tunnel, the agents

// TST-375314 · level: release · module: system
// guards: A SELF-HOSTED RUNNER SERVES AGENT M ONLY FROM A PRIVATE REPOSITORY; UC-017
// given: the author saves the CI agent ci-lab on the self-hosted runner with the label lab and ci-gh on GitHub's machines; the fake GitHub holds the private repository acme/alpha and the public repository acme/open, both with Agent M's job workflow
// input: Agent M reads each product's visibility from its server and asks routesFor for each participant's route for a job of that product; and for a product whose server reports it internal
// expect: known positive — acme/alpha is reported private and acme/open public; for acme/alpha the self-hosted runner lab is offered; for acme/open it is refused, with a reason that names the runner lab and the visibility public; for a product reported internal it is refused too, naming internal; GitHub's machines are offered for each of them
test("TST-375314: a job of a public product is refused on a self-hosted runner, with the reason, and a private product's is offered it", async (t) => {
  const shown = await page(t, { products: { "acme/alpha": productOf({ "team-one": [["Developers", ["ci-lab"]]] }), "acme/open": { visibility: "public", files: { "README.md": "open\n" } } } });
  const main = shown.main();
  await addParticipant(main, "CI agent");
  await put(main, "participant-name", "ci-lab");
  await put(main, "participant-model", "gpt-5");
  await choose(main, "participant-runner", "self-hosted");
  await put(main, "participant-runner-label", "lab");
  await put(main, "participant-secret-name", "MODEL_KEY");
  await save(main);
  await addParticipant(main, "CI agent");
  await put(main, "participant-name", "ci-gh");
  await put(main, "participant-model", "gpt-5");
  await put(main, "participant-secret-name", "MODEL_KEY");
  await save(main);
  const participants = participantsIn(shown);
  const [lab, hosted] = participants;
  assert.equal(lab.route, "ci runner:lab secret MODEL_KEY");
  const visibilityOf = async (web) => (await connect(parseAddress(web), { token: PRODUCT_TOKEN }).repositoryInfo()).visibility;
  assert.deepEqual([await visibilityOf(ALPHA), await visibilityOf(OPEN)], ["private", "public"], "known positive: what the server reports");
  const offer = async (participant, visibility) => routesFor(participant, participants, { visibility, jobWorkflow: true }, [])[0];
  assert.equal((await offer(lab, "private")).available, true);
  const refused = await offer(lab, await visibilityOf(OPEN));
  assert.equal(refused.available, false);
  assert.match(refused.reason, /lab.*public/);
  const internal = await offer(lab, "internal");
  assert.equal(internal.available, false);
  assert.match(internal.reason, /internal/);
  for (const visibility of ["private", "public", "internal"]) assert.equal((await offer(hosted, visibility)).available, true, `GitHub's machines: ${visibility}`);
});

// TST-375315 · level: release · module: system
// guards: A BRIDGE BEHIND NAT IS REACHED THROUGH A REVERSE TUNNEL; UC-017
// given: a computer behind NAT with claude (logged in) and a real Bridge on it; a jump host jump.example.test with a port range; the two tunnel commands the dashboard writes for the Bridge gpu at the port P of the range, and what they do: the reverse tunnel carries the connections made to the jump host's loopback port R to the Bridge, the forward carries those made to the person's port P to R (two ports of this machine); this browser keeps the Bridge gpu at port P
// input: the author adds a CLI agent on the Bridge gpu, lists its agents, adds claude, presses Test and Save; then with the forward closed and the reverse open presses Test again; then with the forward open and the reverse closed
// expect: known positive — the reverse command binds the jump host's loopback 127.0.0.1 and ends at the Bridge's port, the forward binds the person's loopback, and no command names 0.0.0.0; through both ends the page lists the agents, Test says claude answered and Save commits the route bridge gpu agent claude; with the forward closed Test says the Bridge gave no answer and Save is withheld; with the reverse closed it says so too
test("TST-375315: a Bridge behind NAT is reached by the reverse tunnel and the forward, and by neither alone", async (t) => {
  const machine = computer({ claude: { loggedIn: true } });
  const bridge = await startBridge(t, machine, { name: "gpu", offered: ["claude"] });
  const port = await freePort();
  const commands = tunnelCommands({ hostname: "jump.example.test", user: "bridge-user", sshPort: 22, portRange: [port, port + 3] }, { name: "gpu", port }, bridge.port, { remote: "~/.ssh/agent-m-lab", local: "~/.ssh/agent-m" });
  assert.match(commands.reverse, new RegExp(`-R 127\\.0\\.0\\.1:${port}:127\\.0\\.0\\.1:${bridge.port} bridge-user@jump\\.example\\.test$`), "known positive: the reverse command ends at the Bridge");
  assert.match(commands.forward, new RegExp(`-L 127\\.0\\.0\\.1:${port}:127\\.0\\.0\\.1:${port} bridge-user@jump\\.example\\.test$`));
  assert.ok(!commands.reverse.includes("0.0.0.0") && !commands.forward.includes("0.0.0.0"));
  assert.deepEqual(commands.plans.map((plan) => [plan.direction, plan.bind]), [["reverse", "127.0.0.1"], ["forward", "127.0.0.1"]]);
  const reverse = await forward(t, bridge.port);
  let local = await forward(t, reverse.port, port);
  const shown = await page(t, { settings: { "bridge:gpu": { port, token: bridge.token }, "jump-host": { hostname: "jump.example.test", user: "bridge-user", sshPort: 22, portRange: [port, port + 3] } } });
  const main = shown.main();
  await addParticipant(main, "CLI agent");
  await put(main, "participant-name", "claude-gpu");
  await put(main, "participant-model", "claude-opus-5-5");
  await click(one(main, "participant-list-agents"));
  await click(byClass(main, "participant-agent-offer")[0]);
  await click(one(main, "participant-agent-test"));
  assert.match(textOf(one(main, "participant-agent-test-result")), /claude answered/);
  await save(main);
  assert.deepEqual(participantsIn(shown).map((row) => row.route), ["bridge gpu agent claude"]);
  const attempt = async (name) => {
    await addParticipant(main, "CLI agent");
    await put(main, "participant-name", name);
    await put(main, "participant-model", "claude-opus-5-5");
    await put(main, "participant-agent", "claude");
    await click(one(main, "participant-agent-test"));
    return [textOf(one(main, "participant-agent-test-result")), saveButton(main).disabled];
  };
  await local.close();
  const noForward = await attempt("no-forward");
  assert.match(noForward[0], /gave no answer/);
  assert.equal(noForward[1], true, "Save is withheld without the forward");
  local = await forward(t, reverse.port, port);
  assert.match((await attempt("with-both"))[0], /claude answered/, "known positive: the forward back");
  await reverse.close();
  const noReverse = await attempt("no-reverse");
  assert.match(noReverse[0], /gave no answer/);
  assert.equal(noReverse[1], true, "Save is withheld without the reverse tunnel");
  assert.equal(commitsOf(shown).length, 1);
});

// TST-375316 · level: release · module: system
// guards: THE BRIDGE FINDS THE INSTALLED AGENTS; UC-017
// given: a computer with claude (logged in, version 2.1.300), codex (logged in, version 1.2.3) and no opencode; a real Bridge that the person chose claude and opencode for, and a second that was chosen codex too
// input: ask the first Bridge which agents it finds, directly and through the page's List agents; then the second
// expect: known positive — the first Bridge lists claude with its version 2.1.300, ready and logged in, and names opencode as missing; codex, installed and not chosen, is in neither list, and the page offers Add claude alone; the second Bridge lists codex with its version 1.2.3 as well, and the page offers Add claude and Add codex
test("TST-375316: the Bridge lists the installed agents with their versions and offers only those the person chose", async (t) => {
  const machine = computer({ claude: { loggedIn: true }, codex: { loggedIn: true } });
  const first = await startBridge(t, machine, { name: "first", offered: ["claude", "opencode"] });
  const second = await startBridge(t, machine, { name: "second", offered: ["claude", "codex"] });
  const shown = await page(t, { settings: { "bridge:first": { address: first.address, token: first.token }, "bridge:second": { address: second.address, token: second.token } } });
  const main = shown.main();
  const found = await testBridge(bridgeAt({ address: first.address, token: first.token }));
  assert.deepEqual([found.agents, found.missing], [[{ name: "claude", version: "2.1.300", ready: true, loggedIn: true }], [{ name: "opencode" }]], "known positive: installed and chosen");
  await addParticipant(main, "CLI agent");
  await choose(main, "participant-bridge", "first");
  await click(one(main, "participant-list-agents"));
  assert.deepEqual(byClass(main, "participant-agent-offer").map((button) => button.textContent), ["Add claude"]);
  assert.match(textOf(one(main, "participant-agent-list-result")), /opencode is missing/);
  assert.ok(!textOf(one(main, "participant-agent-list-result")).includes("codex"), "installed and not chosen: not listed");
  await choose(main, "participant-bridge", "second");
  await click(one(main, "participant-list-agents"));
  assert.deepEqual(byClass(main, "participant-agent-offer").map((button) => button.textContent), ["Add claude", "Add codex"]);
  assert.match(textOf(one(main, "participant-agent-list-result")), /1\.2\.3/);
});

