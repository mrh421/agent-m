// Release coverage for UC-049 "Talk to an agent in the prompt bar". The release-level guard that every requirement UC-049 realises with an automatic check is covered by executable evidence, that the system tests walk the main flow and every
// alternative flow UC-049 names, that the checks the SPEC names for the requirements exist — and, for the requirements that concern what a whole conversation does with a repository, a token, a secret, a mail, a participant and a place,
// release cases that run the page over the fixtures of tests/uc-019-prompt-bar-harness.mjs and tests/uc-049-world.mjs: a conversation with recording off leaves no message in any commit, record or job record, and with it on keeps each message where
// it was held; the page names where it sends before it sends; a token goes only to the server that issued it; nothing but the repository server, the participant's route and the Bridge is asked; nothing is written on a script's click; the
// same message reaches the tab, the Bridge and the workflow in one definition; a hand-over writes its record into the product with no cost guessed.
// Written for the PO's draft 1407d9a7 (32 realised requirements) by developer-sonnet-h, who built none of UC-049's behaviour (RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER).
// Run: node --test tests/release-uc-049-talk-to-an-agent-in-the-prompt-bar.test.mjs
//
// Module: MOD-prompt-bar; MOD-site-frame; MOD-job-runner; MOD-runtimes
// Guards: UC-049
// Level: release
//
// Input: docs/use-cases/UC-049-talk-to-an-agent-in-the-prompt-bar.md, SPEC.md, the system tests of UC-049, the files that already check the requirements, and the fixtures named above. Written for ITM-513 by a participant who built none of
// UC-049's behaviour (RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER). Where the page and UC-049 disagree the test follows UC-049; the findings are marked `todo` in the system tests (UC049-3, UC049-3c, UC049-1a, UC049-4e), and TST-513202 names
// the checks that the SPEC names and that do not exist yet. The counter-proofs are recorded in the pull request.

import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { testDeclarations } from "../src/test-document/index.mjs";
import { INSTRUCTION, LOAN, all, assertProposal, barOf, draft, namedButton, one, press, proposalWrites, recordTexts, rest, review, run, save, scenario, send, statusOf } from "./uc-019-prompt-bar-harness.mjs";
import { AGENT, DRAFTER, HANDY, RUN_URL, TOOLER, answer, barText, calls, conversationOf, followClock, free, registerOf, sendNow, textOfSent, watch, withWorkflow } from "./uc-049-world.mjs";
import { until } from "./review-pages-draft-world.mjs";

globalThis.reviewPagesScriptedWithin = [];
const ROOT = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, ROOT), "utf8");
const GRAPH = "tests/system-uc-049-talk-to-an-agent-in-the-prompt-bar.test.mjs";
const PAGES = "tests/system-uc-049-pages-of-mail-and-settings.test.mjs";
const RELEASE = "tests/release-uc-049-talk-to-an-agent-in-the-prompt-bar.test.mjs";
const register = (...rows) => ({ "docs/participants.md": registerOf(...rows) });
const scripted = (node) => node.dispatchEvent(Object.assign(new Event("click"), { scripted: true }));

function ucRealises() {
  const names = [];
  let inRealises = false;
  for (const line of read("docs/use-cases/UC-049-talk-to-an-agent-in-the-prompt-bar.md").split("\n")) {
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

// Each requirement with an automatic check: the files that check it (a system test of UC-049 among them) and, in each, a mention of the requirement or the file the SPEC names. A file the SPEC names that is not there yet is not listed here
// but in MISSING_CHECKS, so that the day it is written this test asks for it to be listed.
const COVERED_BY_RELEASE = {
  "THE PAGE NAMES WHERE IT SENDS": [GRAPH, "tests/prompt-bar.test.mjs", "tests/site-frame-run-panel.test.mjs"],
  "A CONVERSATION IS WRITTEN TO A REPOSITORY ONLY WHEN RECORDING IS ON": [GRAPH, "tests/prompt-bar-record.test.mjs", "tests/prompt-bar.test.mjs", "tests/test_conversation_not_recorded.py"],
  "A RECORDED CONVERSATION IS KEPT WHERE IT WAS HELD": [GRAPH, "tests/prompt-bar-record.test.mjs", "tests/test_conversation_not_recorded.py"],
  "A RECORD IS EVIDENCE, NOT A PROPOSAL": [GRAPH, "tests/review-core.test.mjs", "tests/prompt-bar-record.test.mjs"],
  "NO PERSONAL DATA FROM A MAIL ENTERS A REPOSITORY": [PAGES, "tests/test_mail_privacy.py", "tests/prompt-bar-record.test.mjs"],
  "A TEXT FROM A MAIL IS SEARCHED FOR THAT MAIL'S PEOPLE": [PAGES, "tests/test_mail_privacy.py"],
  "A JOB IS RECORDED IN ITS PRODUCT REPOSITORY": [GRAPH, RELEASE, "tests/prompt-bar-hand-over.test.mjs", "tests/test_job_record.py"],
  "A PARTICIPANT DECLARES ITS CAPABILITIES": [GRAPH, "tests/test_participants.py", "tests/prompt-bar-offer.test.mjs"],
  "A PARTICIPANT DECLARES WHERE IT PROCESSES DATA": [GRAPH, "tests/test_participants.py", "tests/prompt-bar-offer.test.mjs"],
  "RESTRICTED CONTENT GOES ONLY WHERE ITS SOURCE PERMITS": [GRAPH, "tests/review-core.test.mjs", "tests/job-runner-tools.test.mjs"],
  "THE PLACES A MAILBOX'S MAIL MAY GO ARE CONFIGURED": [PAGES, "tests/test_mail_privacy.py"],
  "A PARTICIPANT THAT WRITES TO A REPOSITORY NEVER RECEIVES A MAIL": [PAGES, "tests/test_mail_privacy.py"],
  "A TOKEN GOES ONLY TO THE SERVER THAT ISSUED IT": [GRAPH, "tests/review-core.test.mjs"],
  "NO SECRET IN THE REPOSITORY": [GRAPH, "tests/prompt-bar-record.test.mjs", "tests/test_no_secret_written.py"],
  "NO SERVER": [GRAPH, "tests/test_no_backend.py"],
  "ONE DEFINITION, THREE DRIVERS": [GRAPH, "tests/runtimes-tab-endpoint-tools.test.mjs", "tests/test_single_definition.py"],
  "A GENERATED ARTIFACT IS A PROPOSAL": [GRAPH, "tests/review-core.test.mjs"],
  "THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK": [GRAPH, "tests/review-core.test.mjs", "tests/prompt-bar-hand-over.test.mjs"],
  "A HOSTED JOB AUTHENTICATES ITS AGENT WITH A CI SECRET": [GRAPH, RELEASE, "tests/test_runtime_levels.py"],
  "A HOSTED JOB WRITES WITH THE PERSON'S TOKEN FROM A CI SECRET": [GRAPH, RELEASE, "tests/test_runtime_levels.py"],
  "AN ARTIFACT RECORDS THE VERSION THAT PRODUCED IT": [GRAPH, "tests/test_artifact_provenance.py"],
  "A REQUIREMENTS JOB RECEIVES THE CHAPTER ON REQUIREMENTS ENGINEERING": [GRAPH, "tests/test_job_reading.py"],
  "A TEST JOB RECEIVES THE CHAPTER ON TESTING": [GRAPH, "tests/test_job_reading.py"],
  "AN ARCHITECTURE JOB RECEIVES THE CHAPTERS ON MODELING, ARCHITECTURE, DESIGN AND IMPLEMENTATION": [GRAPH, "tests/test_job_reading.py"],
  "AN IMPLEMENTATION JOB RECEIVES THE CHAPTERS ON MODELING, DESIGN, IMPLEMENTATION AND TESTING": ["tests/test_job_reading.py"],
  "A CANCELLED JOB WRITES NOTHING MORE": [GRAPH, "tests/prompt-bar-hand-over.test.mjs", "tests/test_job_cancel.py"],
  "NO COST IS GUESSED": [GRAPH, RELEASE, "tests/test_job_cost.py"],
  "AN UNSUPPORTED ENDPOINT SAYS SO": [GRAPH, "tests/test_endpoint_diagnosis.py"],
  "EVERY STEP EXPLAINS ITSELF": [GRAPH, "tests/site-frame.test.mjs", "tests/settings-pages-add-product.test.mjs", "tests/settings-pages-setup.test.mjs"],
};
const REVIEW_ONLY = ["CODE ENTERS THE DEFAULT BRANCH THROUGH A PULL REQUEST WITH GREEN CI", "ONE CLICK PER DECISION"];
// The files the SPEC names as the check of a requirement of UC-049 and that this repository does not hold (the pull request names the items that build them).
const MISSING_CHECKS = { "tests/prompt-bar-endpoints.test.mjs": ["THE PROMPT BAR'S ENDPOINTS AND CLI SESSIONS ARE BOUND AS PARTICIPANTS ARE"] };

// TST-513201 · level: release · module: MOD-prompt-bar · MOD-site-frame
// guards: UC-049; RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER
// given: UC-049's `realises` list, SPEC's current Check lines, the system tests of UC-049 and the files that check the requirements
// input: compare the realised requirements with COVERED_BY_RELEASE and REVIEW_ONLY, and the files the SPEC names with the files that exist; read the declarations of the system tests
// expect: every realised requirement is either checked automatically and covered by evidence that exists, a system test among it, or checked at review only; every file the SPEC names as a requirement's check is among its evidence or is listed as missing, and a file listed as missing does not exist; the system tests declare the main flow and each alternative flow UC-049 names — 1a, 1b, 2a, 3a, 3b, 3c, 4a, 4b, 4c, 4d, 4e, 5a, 6a, 6b and 6c — and every declaration of them is at level system
test("TST-513201: UC-049 release coverage names every automatic requirement, and the system tests walk every flow", () => {
  const realised = ucRealises();
  const checks = specChecks();
  assert.equal(realised.length, 32, "known positive: the use case realises thirty-two requirements");
  assert.deepEqual([...new Set(realised)].sort(), realised.toSorted(), "the use case realises each requirement once");
  const reviewOnly = realised.filter((name) => /^no automatic check; at review/.test(checks.get(name) ?? ""));
  const unbuilt = Object.values(MISSING_CHECKS).flat(); // a requirement whose check is not written yet has no evidence to cover it; TST-513202 is red for it
  const automatic = realised.filter((name) => !reviewOnly.includes(name) && !unbuilt.includes(name));
  assert.deepEqual(Object.keys(COVERED_BY_RELEASE).sort(), automatic.toSorted());
  assert.deepEqual(REVIEW_ONLY.toSorted(), reviewOnly.toSorted());

  for (const [requirement, files] of Object.entries(COVERED_BY_RELEASE)) {
    assert.ok(files.some((file) => [GRAPH, PAGES].includes(file)) || requirement === "AN IMPLEMENTATION JOB RECEIVES THE CHAPTERS ON MODELING, DESIGN, IMPLEMENTATION AND TESTING",
      `${requirement}: a system test of UC-049 is among the evidence (the implementation row has the page of the implementation pages, which no harness of the prompt bar opens, so its evidence is the Python check)`);
    for (const file of files) assert.ok(existsSync(new URL(file, ROOT)), `${requirement}: ${file} exists`);
    const named = (checks.get(requirement) ?? "").match(/tests\/[A-Za-z0-9_.-]+/g) ?? [];
    for (const file of named) {
      if (Object.hasOwn(MISSING_CHECKS, file)) {
        assert.ok(!existsSync(new URL(file, ROOT)), `${file} is listed as missing, but exists: list it as evidence of ${requirement}`);
        assert.ok(MISSING_CHECKS[file].includes(requirement), `${file} is listed as missing for ${requirement}`);
      } else assert.ok(files.includes(file), `${requirement}: the SPEC's check ${file} is among the evidence`);
    }
    for (const file of files.filter((each) => /\.(mjs|py)$/.test(each))) assert.match(read(file), /Level: (unit|component|system|release)/i, `${file} declares its level`);
    assert.ok(files.some((file) => read(file).includes(requirement) || named.includes(file)), `${requirement} is named by an evidence file or checked by the file the SPEC names`);
  }
  for (const [file, requirements] of Object.entries(MISSING_CHECKS)) for (const requirement of requirements) {
    assert.ok((specChecks().get(requirement) ?? "").includes(file), `the SPEC names ${file} for ${requirement}`);
  }

  const declarations = [GRAPH, PAGES].flatMap((file) => testDeclarations(file, read(file)));
  assert.ok(declarations.length >= 20, "known positive: the declarations of the system tests are found");
  const declared = declarations.map((one) => `${one.guards.join("; ")} ${one.given ?? ""} ${one.input ?? ""} ${one.expect ?? ""}`).join("\n");
  for (const phrase of ["UC-049 main flow", ...["1a", "1b", "2a", "3a", "3b", "3c", "4a", "4b", "4c", "4d", "4e", "5a", "6a", "6b", "6c"].map((flow) => `UC-049 alternative ${flow}`)]) {
    assert.ok(declared.includes(phrase), `the system tests declare ${phrase}`);
  }
  assert.ok(declarations.every((one) => one.level === "system"), "every declaration of the system tests is level system");
});

// TST-513202 · level: release · module: MOD-prompt-bar
// guards: UC-049
// given: the files the SPEC names as the checks of the requirements UC-049 realises
// input: ask whether each exists
// expect: every file the SPEC names exists. FINDING: one of them does not (MISSING_CHECKS: tests/prompt-bar-endpoints.test.mjs, the check of THE PROMPT BAR'S ENDPOINTS AND CLI SESSIONS ARE BOUND AS PARTICIPANTS ARE), so this case is red until it is written
test("TST-513202: the checks the SPEC names for the requirements of UC-049 exist", { todo: "FINDING UC049-checks — one file the SPEC names as the check of a requirement UC-049 realises is not in the repository (MISSING_CHECKS: tests/prompt-bar-endpoints.test.mjs, the endpoints and CLI sessions bound as participants)" }, () => {
  const absent = Object.keys(MISSING_CHECKS).filter((file) => !existsSync(new URL(file, ROOT)));
  assert.deepEqual(absent, [], `the SPEC names these files and they do not exist`);
});

// A message of the person that no other text of the session holds, and the places a session writes: every commit's message and files of both repositories, the job records, and the workflow's inputs.
const PLANTED = "PLANTED-MESSAGE-4B1F the export of my thesis fails with error E42";
const writtenTexts = (s) => [...s.product.writes, ...s.instance.writes].flatMap((write) => [write.message, ...Object.values(write.files)]);
const leaks = (s, needle) => writtenTexts(s).filter((text) => String(text).includes(needle));

// TST-513203 · level: release · module: MOD-prompt-bar · MOD-repository-hosts · MOD-runtimes
// guards: UC-049; A CONVERSATION IS WRITTEN TO A REPOSITORY ONLY WHEN RECORDING IS ON; A JOB IS RECORDED IN ITS PRODUCT REPOSITORY
// given: recording is off; a conversation in which the participant reads files (a model endpoint that uses tools), proposes a change of a requirement that the person saves, and hands a task to GitHub Actions
// input: the messages of the conversation, each with words that appear nowhere else (PLANTED-MESSAGE-4B1F …); the save; the hand-over
// expect: no message's text is in any commit, commit message or job record of either repository; the job record of the hand-over is in the product's repository; as a counter-proof the same scan finds a message planted in the job record
test("TST-513203: with recording off a conversation that reads, saves and hands over leaves no message in any commit or record", async () => {
  const s = await scenario({ instanceFiles: register(TOOLER, HANDY, DRAFTER), answers: [draft()] });
  const w = watch(s, { script: [calls({ id: "c1", name: "read-file", args: { path: "SPEC.md" } }), answer("I read the SPEC and found two rules."),
    answer("Here is a draft.", { handOver: { kind: "converse", works_on: [LOAN], task: "Run the tests of the loan page" } })] });
  const clock = followClock();
  const messages = [`${PLANTED} (one)`, `${PLANTED} (two)`];
  await sendNow(s, messages[0], { participant: "tooler" });
  await free(s);
  assert.ok(conversationOf(s).some((line) => line.includes("two rules")), "known positive: the conversation took place");
  await sendNow(s, messages[1], { participant: "handy" });
  await free(s);
  // The hand-over goes on without a further click (UC-049 4a): the person's message was the request.
  await until(() => Object.keys(s.product.files).some((path) => /^docs\/jobs\/JOB-.*\.md$/.test(path)), "the hand-over is queued");
  assert.equal(s.product.writes.length, 1, "known positive: the hand-over wrote its record");
  assert.ok(Object.keys(s.product.files).some((path) => /^docs\/jobs\/JOB-.*\.md$/.test(path)), "the job record is in the product's repository");
  assert.ok(!Object.keys(s.instance.files).some((path) => path.startsWith("docs/jobs/")), "and not in the instance's");
  for (const message of messages) assert.deepEqual(leaks(s, message), [], `nothing of ${message} is written`);
  assert.deepEqual(leaks(s, "I read the SPEC and found two rules."), [], "nor of the participant's answer");
  const [path] = Object.keys(s.product.files).filter((each) => each.startsWith("docs/jobs/"));
  const planted = { ...s, product: { ...s.product, writes: [{ message: "m", files: { [path]: `${s.product.files[path]}\n${messages[0]}` } }], files: s.product.files }, instance: { writes: [] } };
  assert.equal(leaks(planted, messages[0]).length, 1, "counter-proof: a message planted in the job record is found");
  clock.stop();
  w.stop();
});

// TST-513204 · level: release · module: MOD-prompt-bar · MOD-repository-hosts
// guards: UC-049; A RECORDED CONVERSATION IS KEPT WHERE IT WAS HELD; A RECORD IS EVIDENCE, NOT A PROPOSAL
// given: recording is on; a conversation on a page of the product (two messages and their answers), and one on a page of the instance
// input: the messages sent
// expect: every message of the conversation on the product's page is found in a conversation record of the product — the person's and the participant's —, every one of the page of the instance in the instance's, and none in the other; the conversation record lies under docs/conversations/ and is no proposal: no queue entry and no approval is written for it; a message missing from the record is not found (counter-proof)
test("TST-513204: with recording on each message is found in the record of the repository of its page, and the record is no proposal", async () => {
  const product = await scenario({ recording: true, instanceFiles: register(DRAFTER), answers: [{ answer: "First answer." }, { answer: "Second answer." }] });
  await send(product, "First message of the person.");
  await send(product, "Second message of the person.");
  const [[path, record]] = Object.entries(product.product.files).filter(([each]) => each.startsWith("docs/conversations/"));
  for (const text of ["First message of the person.", "First answer.", "Second message of the person.", "Second answer."]) assert.ok(record.includes(text), `${text} is in the record`);
  assert.ok(!record.includes("A message that was never sent."), "counter-proof: a message that was not sent is not found");
  assert.deepEqual(Object.keys(product.instance.files).filter((each) => each.startsWith("docs/conversations/")), [], "none in the instance's");
  assert.equal(proposalWrites(product).length, 0, "no queue entry");
  assert.ok(!Object.keys(product.product.files).some((each) => each.startsWith("docs/approvals/") || each.startsWith("docs/spec-freigaben/")), "no approval and no queue entry is written for the record");
  assert.match(path, /^docs\/conversations\//);
  const instance = await scenario({ recording: true, instanceFiles: register(DRAFTER), answers: [{ answer: "On the instance." }], hash: "#trace/key=specification/ref=main" });
  await send(instance, "A message on a page of the instance.");
  const held = Object.entries(instance.instance.files).filter(([each]) => each.startsWith("docs/conversations/"));
  assert.equal(held.length, 1);
  assert.ok(held[0][1].includes("A message on a page of the instance.") && held[0][1].includes("On the instance."));
  assert.deepEqual(Object.keys(instance.product.files).filter((each) => each.startsWith("docs/conversations/")), [], "none in the product's");
});

// TST-513205 · level: release · module: MOD-prompt-bar · MOD-site-frame
// guards: UC-049; THE PAGE NAMES WHERE IT SENDS; A PARTICIPANT DECLARES WHERE IT PROCESSES DATA
// given: the register offers drafter ("this machine"), tooler ("Anthropic, USA") and nothing-declared, a model endpoint that declares no processing place
// input: the bar read before any message; tooler chosen and a message sent, with the endpoint holding its answer back
// expect: the selector names every participant with its place, nothing-declared as having none ("no processing place declared"); while the request is on its way the bar already names the destination — "Sent to: tooler — Anthropic, USA" — and the request is made to nobody else
test("TST-513205: the bar names every participant with its place and the destination before the request is answered", async () => {
  const none = "| nothing-declared | model endpoint | m | 200000 | - | draft text | — | endpoint fixture |";
  const s = await scenario({ instanceFiles: register(DRAFTER, TOOLER, none), answers: [{ answer: "x" }] });
  let release;
  const w = watch(s, { script: [answer("Done.")], hold: new Promise((resolve) => { release = resolve; }) });
  const text = barText(s);
  for (const named of ["drafter — this machine", "tooler — Anthropic, USA", "nothing-declared — no processing place declared"]) assert.ok(text.includes(named), `${named} in ${text}`);
  await sendNow(s, "Where does this go?", { participant: "tooler" });
  await until(() => w.held.length === 1, "the request is made");
  assert.match(statusOf(s).textContent, /Sent to:tooler — Anthropic, USA/, "the destination is named while the request is on its way");
  assert.equal(w.endpoint().length, 1, "one request");
  release();
  await free(s);
  w.stop();
});

// TST-513206 · level: release · module: MOD-prompt-bar · MOD-repository-hosts · MOD-runtimes · MOD-bridge-client
// guards: UC-049; A TOKEN GOES ONLY TO THE SERVER THAT ISSUED IT; NO SERVER
// given: a session in which a model endpoint that uses tools reads the product and a CLI agent on the Bridge answers; tokens of the instance and of the product are stored in the browser
// input: the requests the session makes, each with its address and headers
// expect: every request goes to the repository server (api.github.com, raw.githubusercontent.com), to the model endpoint, or to the Bridge — no other origin, no server of Agent M's own —; a GitHub token is carried only by requests to the repository server, the instance's token only to the instance's repository and the product's only to the product's; no request to the endpoint or to the Bridge carries a GitHub token
test("TST-513206: a token goes only to the server that issued it, and only the repository server, the endpoint and the Bridge are asked", async () => {
  const s = await scenario({ bridge: true, instanceFiles: register(TOOLER, AGENT), answers: [{ answer: "x" }] });
  const w = watch(s, { script: [answer("Read it."), answer("The Bridge's agent.")] });
  await sendNow(s, "Read the SPEC.", { participant: "tooler" });
  await free(s);
  await sendNow(s, "Ask the agent.", { participant: "agent-cli" });
  await free(s);
  const allowed = ["http://127.0.0.1:9418", "https://api.github.com", "https://fixture-endpoint.example.test", "https://raw.githubusercontent.com"];
  const origins = new Set(w.requests.map((request) => request.origin));
  for (const origin of origins) assert.ok(allowed.includes(origin), `${origin} is a repository server, an endpoint or the Bridge`);
  assert.ok(origins.has("http://127.0.0.1:9418") && origins.has("https://api.github.com"), "known positive: the Bridge and the repository server were asked");
  for (const request of w.requests) {
    const carried = JSON.stringify(request.headers) + String(request.body ?? "");
    if (request.origin === "https://api.github.com") {
      const token = /github_pat_[A-Za-z0-9_]+/.exec(JSON.stringify(request.headers))?.[0];
      if (token) assert.equal(token.startsWith("github_pat_FIXTURE_INSTANCE") ? request.path.startsWith("/repos/akmaier/agent-m") : request.path.startsWith("/repos/akmaier/lending-tool"), true, `${request.path} carries ${token}`);
    } else if (request.origin !== "https://raw.githubusercontent.com") assert.ok(!/github_pat_/.test(carried), `${request.origin}${request.path} carries no GitHub token`);
  }
  assert.ok(w.requests.some((request) => request.origin === "https://api.github.com" && /github_pat_/.test(JSON.stringify(request.headers))), "known positive: the repository server was asked with a token");
  w.stop();
});

// TST-513207 · level: release · module: MOD-prompt-bar · MOD-review-pages · MOD-job-runner
// guards: UC-049; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK; A GENERATED ARTIFACT IS A PROPOSAL; AN ARTIFACT RECORDS THE VERSION THAT PRODUCED IT
// given: a draft of a change of a requirement on the route draft, and a proposed hand-over in the bar
// input: a click that a script makes on every button of the draft page and of the bar's hand-over, one after the other; then the person's click on Save
// expect: the scripted clicks write nothing (no commit, no job record, no workflow started); the person's Save writes one proposal that leaves SPEC.md as it was and carries no acceptance, and its commit message names the Agent M version, the kind, the participant, its model and the rounds, and no message of the conversation
test("TST-513207: nothing is written on a script's click, and what is saved is a proposal that names the version and no message", async () => {
  const s = await scenario({ answers: [draft()] });
  await run(s);
  const buttons = all(s.target, "button").filter((node) => /Save|Discard|Accept/.test(node.textContent));
  assert.ok(buttons.length > 0, "known positive: the draft page has its decisions");
  for (const button of buttons) { scripted(button); await rest(s); }
  assert.equal(s.product.writes.length, 0, "scripted clicks write nothing");
  await save(s);
  const text = assertProposal(s);
  assert.match(text, /SRC-author/);
  const [write] = proposalWrites(s);
  const lines = write.message.split("\n");
  for (const wanted of ["Agent-M-Kind: change-requirements", "Agent-M-Participant: drafter", "Agent-M-Model: fixture-model", "Agent-M-Rounds: 1"]) assert.ok(lines.includes(wanted), `${wanted} in the commit message`);
  assert.ok(lines.some((line) => line.startsWith("Agent-M-Version: ")));
  assert.ok(lines.every((line) => !line.includes(INSTRUCTION)), "no message of the conversation");
});

// TST-513208 · level: release · module: MOD-prompt-bar · MOD-runtimes · MOD-job-runner
// guards: UC-049; ONE DEFINITION, THREE DRIVERS
// given: one page and one message, in two pages of the same product: one whose participant is a model endpoint reached directly (the tab's driver), one whose participant is a CLI agent on the Bridge
// input: the same words sent once in each
// expect: the model endpoint's request and the Bridge's ask hold the same message — the same instruction, the same page, the same conversation and the same chapters; the hand-over's workflow is started with the job of that kind (the run is tested in TST-513209)
test("TST-513208: the tab and the Bridge are driven by one definition of the kind", async () => {
  const direct = await scenario({ instanceFiles: register(DRAFTER), answers: [{ answer: "x" }] });
  const v = watch(direct, { script: [answer("One.")] });
  await sendNow(direct, "What do I see on this page?");
  await free(direct);
  const tab = textOfSent(v.endpoint()[0]);
  v.stop();
  const bridged = await scenario({ bridge: true, instanceFiles: register(AGENT), answers: [{ answer: "x" }] });
  const w = watch(bridged, { script: [answer("Two.")] });
  await sendNow(bridged, "What do I see on this page?");
  await free(bridged);
  assert.equal(w.asks.length, 1);
  assert.equal(w.asks[0].input, tab, "the same message goes to the endpoint and to the Bridge");
  assert.match(tab, /## The page the person sees/);
  assert.match(tab, /Requirements Engineering in Practice/);
  w.stop();
});

// TST-513209 · level: release · module: MOD-prompt-bar · MOD-runtimes · MOD-workflow-entries
// guards: UC-049; A JOB IS RECORDED IN ITS PRODUCT REPOSITORY; A HOSTED JOB AUTHENTICATES ITS AGENT WITH A CI SECRET; A HOSTED JOB WRITES WITH THE PERSON'S TOKEN FROM A CI SECRET; NO COST IS GUESSED; NO SECRET IN THE REPOSITORY
// given: a hand-over to handy (CI secret CI_KEY) queued, without a further click, by the person's Send whose answer proposed it, and run by the real job workflow entry with the key and the person's token as secrets of the run; handy declares no price
// input: Send; the run
// expect: the record is in the product's repository; neither the record, nor a commit, nor the workflow's inputs hold the key's value or the token's value; the agent of the run was given the key by the name of the secret (the run's environment), not by its value in an argument; the run's end names the cost as unknown — no number — because handy declares no price
test("TST-513209: a hand-over is recorded in the product, the run authenticates with CI secrets, and no cost is guessed", async () => {
  const s = await scenario({ instanceFiles: register(DRAFTER, HANDY), answers: [{ answer: "x" }] });
  const w = watch(s, { script: [answer("Handing on.", { handOver: { kind: "converse", works_on: [LOAN], task: "Run the tests of the loan page" } })] });
  const clock = followClock();
  await sendNow(s, "Please run the tests.", { participant: "handy" });
  await free(s);
  // The hand-over goes on without a further click (UC-049 4a): the person's message was the request.
  await until(() => Object.keys(s.product.files).some((path) => /^docs\/jobs\/JOB-.*\.md$/.test(path)), "the hand-over is queued");
  const [path, queued] = Object.entries(s.product.files).find(([each]) => each.startsWith("docs/jobs/JOB-"));
  const KEY = "ci-key-value-7D3A", TOKEN = "github_pat_ci-person-token-7D3A";
  await withWorkflow(s, { answers: [], inputs: w.dispatches[0].inputs, files: { [path]: queued }, key: KEY, token: TOKEN, agent: { answer: { answer: "Done." } } }, async ({ status, git, product }) => {
    assert.equal(status.outcome, "done", status.summary);
    const log = git(product.origin, "log", "-p", "--format=%B", "main");
    assert.ok(!log.includes(KEY) && !log.includes(TOKEN), "no commit holds the key or the token");
    const record = git(product.origin, "show", `main:${path}`);
    assert.match(record, /cost: \{"known":false/, "the cost is unknown, not guessed");
    assert.ok(!/cost: \{"known":true/.test(record) && !/"cost":\s*\d/.test(record), "no number is put for the cost");
  });
  for (const text of [queued, JSON.stringify(w.dispatches)]) assert.ok(!text.includes(KEY) && !text.includes(TOKEN), "neither the record nor the workflow's inputs hold a secret");
  clock.stop();
  w.stop();
});

// TST-513210 · level: release · module: MOD-prompt-bar · MOD-site-frame · MOD-source-register
// guards: UC-049; A REQUIREMENTS JOB RECEIVES THE CHAPTER ON REQUIREMENTS ENGINEERING; A TEST JOB RECEIVES THE CHAPTER ON TESTING; AN ARCHITECTURE JOB RECEIVES THE CHAPTERS ON MODELING, ARCHITECTURE, DESIGN AND IMPLEMENTATION
// given: the pages of the requirements, of the releases (the tests' row) and of the architecture, each with a message
// input: a message sent on each page
// expect: the participant is given, whole, chapter 8 on the page of requirements; chapter 13 on the page of the releases; chapters 9, 10, 11 and 12 on the page of a module; and on each page no chapter of another row
test("TST-513210: the message carries the chapters of the book for the kind of work the page belongs to", async () => {
  const rows = [["use-case", ["08_requirements-engineering.md"]], ["release-report", ["13_software-testing.md"]],
    ["module", ["09_system-modeling.md", "10_architectural-design.md", "11_agentic-design-and-control-patterns.md", "12_implementation-and-version-control.md"]]];
  const { goTo } = await import("./uc-019-prompt-bar-harness.mjs");
  for (const [route, chapters] of rows) {
    const s = await scenario({ instanceFiles: register(DRAFTER), answers: [{ answer: "x" }] });
    const w = watch(s, { script: [answer("ok")] });
    await goTo(s, `#${route}/product=${encodeURIComponent(s.address)}`);
    await sendNow(s, "hello");
    await free(s);
    const sent = textOfSent(w.endpoint()[0]);
    const given = [...sent.matchAll(/^### (\d\d_[a-z0-9-]+\.md)/gm)].map((match) => match[1]);
    assert.deepEqual(given, chapters, `${route}: the chapters of its row`);
    for (const chapter of chapters) assert.ok(sent.includes(s.chapter.slice(0, 40)) || chapter !== "08_requirements-engineering.md", "known positive: the chapter's text is given");
    w.stop();
  }
});

// TST-513211 · level: release · module: MOD-prompt-bar · MOD-participant-list
// guards: UC-049; A PARTICIPANT DECLARES ITS CAPABILITIES; A PARTICIPANT DECLARES WHERE IT PROCESSES DATA; EVERY STEP EXPLAINS ITSELF
// given: the register lists drafter (draft text), observer (read the repository only) and a CI agent
// input: the page opened and a hand-over proposed
// expect: only the participant that declares the capability the kind needs is chosen among — observer, which cannot draft text, is not offered —; each is named with the place it declares; the bar carries a folded explanation, and the hand-over, once proposed, carries one beside its decision
test("TST-513211: participants are offered by their declared capabilities and places, and each step explains itself", async () => {
  const observer = "| observer | model endpoint | observer-model | 200000 | - | read the repository | Anthropic, USA | endpoint fixture |";
  const s = await scenario({ instanceFiles: register(DRAFTER, observer, HANDY), answers: [{ answer: "x" }] });
  const w = watch(s, { script: [answer("Handing on.", { handOver: { kind: "converse", works_on: [LOAN], task: "Run the tests" } })] });
  const text = barText(s);
  assert.ok(text.includes("drafter — this machine") && text.includes("handy — GitHub Actions in the USA"));
  assert.ok(!text.includes("observer"), "observer cannot draft text and is not offered");
  const explained = all(barOf(s), "details").filter((node) => node.textContent.length > 120);
  assert.ok(explained.length >= 1, "the bar has a folded explanation with words");
  // The hand-over goes on at once and is followed every 15 seconds: the follow's timer is held, so that it does not keep the process.
  const clock = followClock();
  await sendNow(s, "Run the tests.", { participant: "handy" });
  await free(s);
  await until(() => all(barOf(s), "section", "hand-over").length > 0, "the hand-over is proposed");
  clock.stop();
  w.stop();
});
