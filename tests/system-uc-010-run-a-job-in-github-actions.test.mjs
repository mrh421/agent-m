// System tests of UC-010 "Run a job in GitHub Actions": the precondition (the job workflow installed from the Settings page, its two secrets named and never asked for), the main flow from the start of a job
// on the CI route to its artifacts committed open together with its end record, the start from the dashboard and the start from the server's own page, the alternative flows 3a (a secret is missing)
// and 4a (the result equals the current artifacts), and the postcondition (artifacts of the kind the browser produces, nothing accepted). TST-373201 maps every flow of UC-010 to the system test that walks it.
// Run: node --test tests/system-uc-010-run-a-job-in-github-actions.test.mjs
//
// Module: MOD-workflow-entries
// Module: MOD-runtimes
// Module: MOD-job-ledger
// Module: MOD-settings-pages
// Module: MOD-repository-hosts
// Module: MOD-endpoint-calls
// Guards: UC-010
// Level: system
//
// Written for ITM-373 by developer-sonnet-k, who built none of the items UC-010 builds on (RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER). The world is tests/uc-010-harness.mjs: the product alice/thesis-tool and the
// instance are git repositories on disk; the Settings page and the drafting page are drawn into the fixture DOM over clones of them; the entries of MOD-workflow-entries run in-process, as `node
// src/workflow-entries/main.mjs <entry>` runs them, in checkouts made as the job workflow makes them; the model endpoint is a fake `fetch`. Each test states its input and its expected result in its own text
// (given / input / expect) from UC-010, before it runs; none reads an expected value from a document. The counter-proofs are recorded in the pull request. The tests that draw the drafting page come last, because
// drawing it registers the review pages' strategies with the job runner, which the entries register themselves. Readings the texts leave open, which the cases state:
//   - "A job started from the dashboard on the CI route" is read as the commit of MOD-runtimes' queueJob on the route `ci hosted` with the start record a run panel of the review pages makes (src/review-pages/jobs.mjs
//     startRecord): the route `use-case/<id>/prompt` of ITM-363 no longer exists (ITM-551 removed it), and the prompt bar runs a change-use-case in the tab (UC-049 4a.1). The job is a change-use-case of UC-001.
//   - The endpoint a CI agent's job calls is read from the record's parameter `endpoint` ({ name, kind, baseUrl, model }), the only place MOD-workflow-entries says a record carries it (tests/workflow-entries-job-workflow.test.mjs
//     takes the same reading); TST-373211 reads the record the drafting page writes and follows the text where it names none.
//   - TST-373203, TST-373204, TST-373206 and TST-373207 run the entry on one machine that holds the token and the key, the mode of tests/workflow-entries-job-workflow.test.mjs (the entry reads the part from
//     AGENT_M_PART and runs whole where it is not set); the workflow's two machines are walked by TST-373209.
//   - "from GitHub's Actions page" (step 1) is read as MOD-runtimes' table reads it — "a start from the server's own page, with a job's identifier (UC-010, UC-024)", the workflow's inputs being job, task,
//     endpoint and secret — as a start with the input job naming a record (TST-373205); onDispatch's further mode, which writes a missing record from the inputs kind, participant, works_on and parameters,
//     is walked by TST-373204 as the module file states it. That the Actions page offers no such inputs, so that no record can be written from it, is a gap between UC-010 step 1 and MOD-runtimes, named in the pull request.
//   - "Together with the job's end record" (step 4) is read as the same run: the artifacts' commit and the end's commit are made one after the other by the one entry run.
//   - "The workflow fails with a message naming the secret" (3a) is read as the entry's status `not run`, which the command line prints and ends with the exit code 1.

import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { testDeclarations } from "../src/test-document/index.mjs";
import { statuses } from "../src/approvals/index.mjs";
import { ACCEPTED, ENDPOINT, INSTRUCTION, KEY, RULE, TOKEN, UC1, UC1_CHANGED, UC1_TEXT, UC2, UC2_TEXT, UC3, UC3_TEXT, WORKFLOW, commandLine, dispatchRun, endpoint, environment, find, install, installFast, openSettings,
  pushRun, queueFromDashboard, runAddress, runOnDraftingPage, workflowFiles, workflowLine, workflowRun, world } from "./uc-010-harness.mjs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const SELF = "tests/system-uc-010-run-a-job-in-github-actions.test.mjs";
const PARAMS = { useCase: "UC-001", instruction: INSTRUCTION, endpoint: ENDPOINT };
const SECRETS_PAGE = "https://github.com/alice/thesis-tool/settings/secrets/actions";
// The state of a checkout as git reports it: the empty text for a clean one.
const dirty = (folder) => spawnSync("git", ["status", "--porcelain"], { cwd: folder, encoding: "utf8" }).stdout.trim();

// ---------------------------------------------------------------- the map

// Each flow of UC-010, with the system test that walks it.
const FLOWS = {
  "precondition, the job workflow installed and its secrets named": [[SELF, "TST-373202"]],
  "precondition, billed per use": [[SELF, "TST-373210"]],
  "main flow, 1 to 5 from a job queued by the dashboard": [[SELF, "TST-373203"], [SELF, "TST-373209"]],
  "main flow, 1 from the dashboard's page": [[SELF, "TST-373211"]],
  "main flow, 1 from the server's own page": [[SELF, "TST-373204"], [SELF, "TST-373205"]],
  "3a": [[SELF, "TST-373206"]],
  "4a": [[SELF, "TST-373207"]],
  "postcondition": [[SELF, "TST-373208"]],
};

// TST-373201 · level: system · module: system
// guards: UC-010
// given: UC-010 as committed text, whose alternative flows are 3a and 4a, and the system tests named in FLOWS
// input: read UC-010's alternative flows, and the declarations of the test files named for each flow
// expect: known positive — UC-010 names the two alternative flows 3a and 4a; FLOWS holds each of them, the main flow, the precondition and the postcondition; each test named stands in its file with the level system and guards UC-010
test("TST-373201: UC-010 every flow has a system test that walks it", () => {
  const text = read("docs/use-cases/UC-010-run-a-job-in-github-actions.md");
  const alternatives = [...text.matchAll(/^- \*\*(\d+[a-z])\. /gm)].map((match) => match[1]);
  assert.deepEqual(alternatives, ["3a", "4a"], "known positive: UC-010's alternative flows");
  for (const flow of alternatives) assert.ok(Object.keys(FLOWS).includes(flow), `${flow} has a system test`);
  for (const [flow, tests] of Object.entries(FLOWS)) {
    for (const [file, id] of tests) {
      assert.ok(existsSync(new URL(`../${file}`, import.meta.url)), `${flow}: ${file} exists`);
      const declared = testDeclarations(file, read(file)).find((each) => each.id === id);
      assert.ok(declared, `${flow}: ${id} is declared in ${file}`);
      assert.equal(declared.level, "system", `${id} is a system test`);
      assert.ok((declared.guards ?? []).includes("UC-010"), `${id} guards UC-010`);
    }
  }
});

// ---------------------------------------------------------------- the precondition

// TST-373202 · level: system · module: system
// guards: UC-010; NO SECRET IN THE REPOSITORY; EVERY SETTING IS REACHED FROM ONE PAGE; ONE CLICK PER DECISION
// given: the product alice/thesis-tool without the job workflow, the instance with the CI agent ci-bot whose key is the secret FIXTURE_KEY, and the person's token stored in the browser
// input: the person opens the Repositories tab of the Settings page, reads the line of Agent M's job workflow, and presses Install
// expect: before the click the line says Not installed and names the secrets AGENT_M_TOKEN and FIXTURE_KEY, with a link to the product's Actions secrets page and no field for a value; Install makes one commit on main that adds exactly the files the generated job workflow consists of; afterwards the line says Installed; the committed files hold neither the person's token nor the key, and name each secret as an Actions secret
test("TST-373202: UC-010 precondition — the job workflow is installed in one click and its secrets are named, never asked for", async () => {
  endpoint();
  await world({}, async (w) => {
    const target = await openSettings(w);
    const line = workflowLine(target);
    assert.match(line.textContent, /Not installed/);
    assert.match(line.textContent, /AGENT_M_TOKEN/);
    assert.match(line.textContent, /FIXTURE_KEY/);
    const links = find(line, (node) => node.localName === "a");
    assert.ok(links.some((link) => link.href === SECRETS_PAGE), `the secrets page is linked: ${links.map((link) => link.href)}`);
    assert.equal(find(line, (node) => ["input", "textarea"].includes(node.localName)).length, 0, "the line asks for no value");

    const head = w.head();
    const installed = await install(target, w);
    assert.match(installed.textContent, /Committed/);
    assert.equal(w.subjects().length, 2, "one commit");
    assert.equal(w.subjects()[0], "Install Agent M job workflow");
    const expected = workflowFiles(w);
    assert.ok(expected.length >= 2, "known positive: the generated job workflow has files");
    for (const file of expected) assert.equal(w.fileAt(file.path), file.text, `${file.path} is committed as generated`);
    assert.deepEqual(w.paths().filter((path) => ![UC1, UC2, "README.md", "SPEC.md"].includes(path)).sort(), expected.map((file) => file.path).sort(), "nothing else is added");
    assert.notEqual(w.head(), head);
    const files = expected.map((file) => file.text).join("\n");
    assert.ok(!files.includes(TOKEN) && !files.includes(KEY), "no secret value in the files");
    assert.match(w.fileAt(WORKFLOW), /secrets\.AGENT_M_TOKEN/);
    assert.match(w.fileAt(WORKFLOW), /secrets\.FIXTURE_KEY/);
    assert.match(workflowLine(await openSettings(w)).textContent, /Installed/);
  });
});

// ---------------------------------------------------------------- the main flow

// TST-373203 · level: system · module: system
// guards: UC-010; ONE DEFINITION, THREE DRIVERS; A GENERATED ARTIFACT IS A PROPOSAL; A REVIEWED ARTIFACT ENTERS THE DEFAULT BRANCH AS OPEN; A JOB IS RECORDED IN ITS PRODUCT REPOSITORY
// given: the product with the job workflow installed from the Settings page, UC-001 accepted by an approval record, the CI agent ci-bot; the job change-use-case of UC-001 queued on the route ci hosted by MOD-runtimes' queueJob with the instruction INSTRUCTION and the endpoint in its parameters; the fixture endpoint answers UC-001 with the alternative flow 2a added
// input: step 1 the start record committed; steps 2 to 4 the push starts the job workflow, which runs onRecordsChanged on a runner with the secrets AGENT_M_TOKEN and FIXTURE_KEY; step 5 the use cases of the product read as the dashboard reads them
// expect: the queue commit holds the one file docs/jobs/<job>.md, whose route is ci hosted and whose parameters hold the instruction; the entry ends done naming the job; the endpoint is asked once, at its address, with the key as its authorisation and a request that begins with Agent M's AGENTS.md and holds the instruction, UC-001, UC-002 and the rule A LOAN HAS A DUE DATE; main then holds, in order, the queue commit, the taking naming the run's address, the commit that writes UC-001 with the alternative flow 2a and the commit that ends the job; the record ends done naming that commit as its result and the run as its log; the product has no other branch; UC-001 is no longer the accepted text but changed, and UC-002 is as it was
test("TST-373203: UC-010 the main flow — a job queued on the CI route is run by the job workflow and commits its artifacts open with its end record", async () => {
  const requests = endpoint();
  await world({ product: ACCEPTED }, async (w) => {
    await install(await openSettings(w), w);
    assert.equal(statuses(await w.snapshot()).get(UC1).status, "accepted", "known positive: UC-001 is accepted before the run");

    const queued = await queueFromDashboard(w, { params: PARAMS });
    assert.equal(w.subjects()[0], `Queue job ${queued.id}: change-use-case`);
    assert.deepEqual(w.paths().filter((path) => path.startsWith("docs/jobs/")), [`docs/jobs/${queued.id}.md`]);
    const start = w.fileAt(queued.path);
    assert.match(start, /^route: ci hosted$/m);
    assert.ok(start.includes(INSTRUCTION), "the parameters hold the instruction");

    const { status, run } = await pushRun(w);
    assert.equal(status.outcome, "done", status.summary);
    assert.ok(status.summary.includes(queued.id), status.summary);
    assert.equal(requests.length, 1, "the endpoint is asked once");
    assert.equal(requests[0].address, "https://llm.example.test/v1/chat/completions");
    assert.equal(requests[0].headers.Authorization, `Bearer ${KEY}`);
    const sent = JSON.parse(requests[0].body).messages.map((message) => message.content).join("\n");
    assert.ok(sent.startsWith(read("AGENTS.md").slice(0, 200)), "the request begins with AGENTS.md");
    for (const wanted of [INSTRUCTION, UC1_TEXT, UC2_TEXT, RULE]) assert.ok(sent.includes(wanted), `the request holds ${wanted.slice(0, 40)}`);

    const subjects = w.subjects();
    assert.equal(subjects.length, 6, subjects.join(" | "));
    assert.deepEqual(subjects.slice(0, 4), [`end ${queued.id}: done`, "draft UC-001 as open files", `take ${queued.id} (${runAddress(run.id)})`, `Queue job ${queued.id}: change-use-case`]);
    assert.equal(w.fileAt(UC1), UC1_CHANGED);
    assert.equal(w.fileAt(UC2), UC2_TEXT, "UC-002 is as it was");
    const record = w.fileAt(queued.path);
    assert.match(record, new RegExp(`## Taken[^]*by: ${runAddress(run.id).replaceAll(".", "\\.")}`));
    const written = w.commitWithSubject("draft UC-001 as open files");
    assert.match(written, /^[0-9a-f]{40}$/, "the commit that writes UC-001 is found");
    assert.match(record, /## End[^]*state: done/);
    assert.ok(record.includes(written), "the end names the writing commit as its result");
    assert.match(record, new RegExp(`log: ${runAddress(run.id).replaceAll(".", "\\.")}`));
    assert.deepEqual(w.branches(), ["main"], "the product has no other branch");

    const after = statuses(await w.snapshot());
    assert.equal(after.get(UC1).status, "changed", "the text is no longer the accepted one");
    assert.equal(after.get(UC2).status, "open", "UC-002 is as it was, and no record names it");
  });
});

// TST-373204 · level: system · module: system
// guards: UC-010; A JOB IS RECORDED IN ITS PRODUCT REPOSITORY; A HOSTED JOB AUTHENTICATES ITS AGENT WITH A CI SECRET
// given: the product with the job workflow installed and no record of the job JOB-20261030-0905-d1e2; a start from GitHub's Actions page by alice with the inputs job, kind change-use-case, participant ci-bot, works_on UC-001 and the parameters with the instruction and the endpoint; the fixture endpoint answers UC-001 with the alternative flow 2a added
// input: step 1 the workflow's event workflow_dispatch; steps 2 to 4 onDispatch with the secrets AGENT_M_TOKEN and FIXTURE_KEY
// expect: the entry ends done naming the job; main holds, in order, the start record committed by the run — docs/jobs/JOB-20261030-0905-d1e2.md with the kind, the route ci hosted, alice as who started it and the instruction —, the taking naming the run's address, the commit that writes UC-001 with the alternative flow 2a and the end; the record ends done; UC-001 on main is the changed text
test("TST-373204: UC-010 the main flow — a start from the server's own page writes the job's record and runs the job", async () => {
  const requests = endpoint();
  const id = "JOB-20261030-0905-d1e2";
  await world({}, async (w) => {
    await install(await openSettings(w), w);
    const inputs = { job: id, kind: "change-use-case", participant: "ci-bot", works_on: "UC-001", parameters: JSON.stringify(PARAMS) };
    const { status, run } = await dispatchRun(w, inputs);
    assert.equal(status.outcome, "done", status.summary);
    assert.ok(status.summary.includes(id), status.summary);
    assert.equal(requests.length, 1);
    assert.equal(requests[0].headers.Authorization, `Bearer ${KEY}`);
    assert.deepEqual(w.subjects().slice(0, 4), [`end ${id}: done`, "draft UC-001 as open files", `take ${id} (${runAddress(run.id)})`, `Queue job ${id}: change-use-case`]);
    const record = w.fileAt(`docs/jobs/${id}.md`);
    assert.match(record, /^kind: change-use-case$/m);
    assert.match(record, /^route: ci hosted$/m);
    assert.match(record, /^started_by: alice$/m);
    assert.ok(record.includes(INSTRUCTION));
    assert.match(record, /## End[^]*state: done/);
    assert.equal(w.fileAt(UC1), UC1_CHANGED);
  });
});

// TST-373205 · level: system · module: system
// guards: UC-010
// given: the product with the job workflow installed, whose file declares the inputs GitHub's Actions page offers for a start, and a job change-use-case of UC-001 that the dashboard queued on the route ci hosted
// input: step 1 from GitHub's Actions page — the author starts the workflow with the input job naming that record; steps 2 to 4 onDispatch with the secrets AGENT_M_TOKEN and FIXTURE_KEY
// expect: known positive — the file declares the input job, as required; the entry ends done naming the job; main holds, in order, the queue commit, the taking naming the run's address, the commit that writes UC-001 with the alternative flow 2a and the end; the record ends done
test("TST-373205: UC-010 the main flow — a start from GitHub's Actions page with the identifier of a queued job runs that job", async () => {
  const requests = endpoint();
  await world({}, async (w) => {
    await installFast(w);
    const declared = /workflow_dispatch:\s*\n\s*inputs:\s*\n((?:\s{6,}.*\n)+)/.exec(w.fileAt(WORKFLOW))?.[1] ?? "";
    assert.match(declared, /^ {6}job:\n(?: {8}.*\n)*? {8}required: true$/m, "known positive: the input job is declared and required");
    const queued = await queueFromDashboard(w, { params: PARAMS });
    const { status, run } = await dispatchRun(w, { job: queued.id });
    assert.equal(status.outcome, "done", status.summary);
    assert.ok(status.summary.includes(queued.id), status.summary);
    assert.equal(requests.length, 1);
    assert.deepEqual(w.subjects().slice(0, 4), [`end ${queued.id}: done`, "draft UC-001 as open files", `take ${queued.id} (${runAddress(run.id)})`, `Queue job ${queued.id}: change-use-case`]);
    assert.equal(w.fileAt(UC1), UC1_CHANGED);
    assert.match(w.fileAt(queued.path), /## End[^]*state: done/);
  });
});

// ---------------------------------------------------------------- 3a: a secret is missing

// TST-373206 · level: system · module: system
// guards: UC-010; A HOSTED JOB AUTHENTICATES ITS AGENT WITH A CI SECRET; A HOSTED JOB WRITES WITH THE PERSON'S TOKEN FROM A CI SECRET; NO SECRET IN THE REPOSITORY
// given: the product with the job workflow installed and the job queued as in the main flow; a run in which GitHub gives the step an empty FIXTURE_KEY, as it does for a secret that is not set; then one in which AGENT_M_TOKEN is empty; then one with both
// input: onRecordsChanged for each, and the command line `node src/workflow-entries/main.mjs onRecordsChanged` for the first
// expect: 3a — with the key empty and with the token empty the entry ends not run and its summary names FIXTURE_KEY and AGENT_M_TOKEN respectively; the origin's main is as it was, the job is not taken, the checkout is clean and the endpoint is not asked; the command line prints the message naming FIXTURE_KEY and ends with the exit code 1; known positive — with both secrets the job is run and the command line of a run with no queued job ends with the exit code 0
test("TST-373206: UC-010 3a a missing secret fails the run with a message that names it, and nothing is written", async () => {
  const requests = endpoint();
  await world({}, async (w) => {
    await installFast(w);
    await queueFromDashboard(w, { params: PARAMS });
    const head = w.head();
    for (const [extra, name] of [[{ FIXTURE_KEY: "" }, "FIXTURE_KEY"], [{ AGENT_M_TOKEN: "" }, "AGENT_M_TOKEN"]]) {
      const { status, run } = await pushRun(w, extra);
      assert.equal(status.outcome, "not run", name);
      assert.match(status.summary, new RegExp(name), name);
      assert.equal(w.head(), head, `${name}: the origin is as it was`);
      assert.ok(!w.subjects().some((subject) => subject.startsWith("take ")), `${name}: the job is not taken`);
      assert.equal(requests.length, 0, `${name}: the endpoint is not asked`);
      assert.equal(dirty(run.productDir), "", `${name}: the checkout is clean`);
    }
    const failed = commandLine("onRecordsChanged", environment(w, w.checkout(), { FIXTURE_KEY: "" }));
    assert.equal(failed.status, 1, failed.stderr);
    assert.match(failed.stdout, /FIXTURE_KEY/);
    assert.equal(w.head(), head, "the command line wrote nothing");
    const positive = await pushRun(w);
    assert.equal(positive.status.outcome, "done", "known positive: with both secrets the job is run");
    assert.equal(requests.length, 1);
    const idle = commandLine("onRecordsChanged", environment(w, w.checkout()));
    assert.equal(idle.status, 0, `known positive: a run with no queued job ends well — ${idle.stdout}${idle.stderr}`);
    assert.match(idle.stdout, /nothing to do/);
  });
});

// ---------------------------------------------------------------- 4a: the result equals the current artifacts

// TST-373207 · level: system · module: system
// guards: UC-010; A JOB IS RECORDED IN ITS PRODUCT REPOSITORY; A REVIEWED ARTIFACT ENTERS THE DEFAULT BRANCH AS OPEN
// given: the product with the job workflow installed whose UC-001 already is the text the fixture endpoint answers; the job change-use-case of UC-001 queued on the route ci hosted
// input: onRecordsChanged with the secrets
// expect: 4a — the entry ends done and its summary says no change; main holds, in order, the end, the taking and the queue commit and no commit of an artifact; UC-001 and UC-002 are byte for byte as they were; the record ends done with the result no change
test("TST-373207: UC-010 4a a result equal to the current artifacts commits nothing and is reported as no change", async () => {
  const requests = endpoint();
  await world({ product: { [UC1]: UC1_CHANGED } }, async (w) => {
    await installFast(w);
    const queued = await queueFromDashboard(w, { params: PARAMS });
    const { status, run } = await pushRun(w);
    assert.equal(status.outcome, "done", status.summary);
    assert.match(status.summary, /no change/);
    assert.equal(requests.length, 1, "known positive: the endpoint was asked");
    assert.deepEqual(w.subjects().slice(0, 3), [`end ${queued.id}: done`, `take ${queued.id} (${runAddress(run.id)})`, `Queue job ${queued.id}: change-use-case`]);
    assert.equal(w.fileAt(UC1), UC1_CHANGED);
    assert.equal(w.fileAt(UC2), UC2_TEXT);
    assert.match(w.fileAt(queued.path), /## End[^]*state: done[^]*results:[^]*no change/);
  });
});

// ---------------------------------------------------------------- the postcondition

// TST-373208 · level: system · module: system
// guards: UC-010; A GENERATED ARTIFACT IS A PROPOSAL; A RECORD IS EVIDENCE, NOT A PROPOSAL
// given: the product with the job workflow installed, UC-001 accepted by an approval record and the job change-use-case of UC-001 run on the route ci hosted
// input: the files of the product after the run, read as the dashboard reads them
// expect: the artifact is a use case of the same kind the browser produces: the file at the path of UC-001 whose front matter names the identifier UC-001 and the requirement it realises; no approval record was added by the run — docs/approvals/ holds the one record there was —; UC-001 reads as changed, not accepted; the job's record is listed as no proposal
test("TST-373208: UC-010 postcondition — the artifact is of the kind the browser produces, and nothing counts as accepted", async () => {
  endpoint();
  await world({ product: ACCEPTED }, async (w) => {
    await installFast(w);
    const queued = await queueFromDashboard(w, { params: PARAMS });
    assert.equal((await pushRun(w)).status.outcome, "done");
    assert.deepEqual(w.paths().filter((path) => path.startsWith("docs/approvals/")), Object.keys(ACCEPTED), "the run added no approval record");
    const text = w.fileAt(UC1);
    assert.match(text, /^id: UC-001$/m);
    assert.match(text, new RegExp(`^  - ${RULE}$`, "m"));
    assert.match(text, /^## Alternative flows$/m);
    const rows = statuses(await w.snapshot());
    assert.equal(rows.get(UC1).status, "changed");
    assert.equal(rows.get(UC1).kind, "use-case");
    assert.ok(!rows.has(queued.path), "the job's record is no proposal");
  });
});

// ---------------------------------------------------------------- the workflow's two machines

// TST-373209 · level: system · module: system
// guards: UC-010; A HOSTED JOB AUTHENTICATES ITS AGENT WITH A CI SECRET; A HOSTED JOB WRITES WITH THE PERSON'S TOKEN FROM A CI SECRET
// given: the product with the job workflow installed, the job change-use-case of UC-001 queued on the route ci hosted with the endpoint in its parameters, and a push run as the job workflow's jobs run it: the plan on a machine that holds no secret, the agent's machine with the key and no token, the writing machine with the token
// input: chooseAgentKey, then onRecordsChanged and leaveResult on the agent's machine, then writeResult on the writing machine
// expect: the plan names the agent's job 1; the agent's machine ends done and writes nothing to the origin; the writing machine ends done; main then holds, in order, the queue commit, the taking, the commit that writes UC-001 with the alternative flow 2a and the end, and the record ends done
test("TST-373209: UC-010 the main flow — on the workflow's two machines the agent's result is written by the machine that holds the token", { todo: "FINDING UC010-F4 — on the agent's machine, which holds no token, the writer open-files reads the repository's history (src/artifact-edits/strategies.mjs:117, host.readHistory), and a host of a clone without a token has no history: throughClone answers NotSupported \"the history needs the server's API, which a clone without a token does not reach; store a token first\" (src/repository-hosts/index.mjs:160-166, history: without(\"the history\")), so that the job change-use-case ends failed with nothing written, while UC-010 (Main flow, 4) has the workflow commit the artifacts and MOD-runtimes' Data (A run has two machines) gives the agent's machine no token — an item for MOD-repository-hosts (history through a clone) or MOD-artifact-edits (the writer)" }, async () => {
  const requests = endpoint();
  await world({}, async (w) => {
    await installFast(w);
    const queued = await queueFromDashboard(w, { params: PARAMS });
    const head = w.head();
    const { plan, chosen, agent, left, written } = await workflowRun(w);
    assert.equal(plan.outcome, "done", plan.summary);
    assert.equal(chosen, "1", "known positive: the plan names the agent's job of the key");
    assert.equal(requests.length, 1, "known positive: the agent's machine asked the endpoint with the key");
    assert.equal(requests[0].headers.Authorization, `Bearer ${KEY}`);
    assert.equal(left.outcome, "done", left.summary);
    assert.equal(agent.outcome, "done", agent.summary);
    assert.equal(written.outcome, "done", written.summary);
    assert.notEqual(w.head(), head);
    assert.equal(w.fileAt(UC1), UC1_CHANGED);
    assert.match(w.fileAt(queued.path), /## End[^]*state: done/);
  });
});

// ---------------------------------------------------------------- the pages that draw the drafting page

// TST-373210 · level: system · module: system
// guards: UC-010
// given: the product with the job workflow installed, the instance with the CI agent ci-bot, and the drafting page of the use cases, where the person has chosen ci-bot for the requirement A LOAN HAS A DUE DATE
// input: the person presses Prepare and reads the run panel
// expect: known positive — the run panel is the one of ci-bot; it names that the calls are billed per use by the agent's provider
test("TST-373210: UC-010 precondition — the run panel says that the calls are billed per use", async () => {
  endpoint();
  await world({}, async (w) => {
    await installFast(w);
    const { shown } = await runOnDraftingPage(w);
    assert.match(shown, /ci-bot/, "known positive: the panel is the one of ci-bot");
    assert.match(shown, /billed per (use|call)/i);
  });
});

// TST-373211 · level: system · module: system
// guards: UC-010; A HOSTED JOB AUTHENTICATES ITS AGENT WITH A CI SECRET
// given: the product with the job workflow installed, the CI agent ci-bot, the requirement A LOAN HAS A DUE DATE, and the drafting page of the use cases, where the person chooses ci-bot and presses Run (the fixture endpoint answers the new use case UC-003)
// input: step 1 the click on Run, which queues the job; then the push starts the job workflow, which runs onRecordsChanged with the secrets AGENT_M_TOKEN and FIXTURE_KEY
// expect: the page says that the job is queued on the route ci hosted; the run ends done and the endpoint is asked with the key; the job's record ends done and main holds UC-003 as the endpoint answered it
test("TST-373211: UC-010 the main flow — a job the dashboard's page queues is run by the job workflow", async () => {
  const requests = endpoint({ files: [{ path: UC3, text: UC3_TEXT, class: "new" }] });
  await world({}, async (w) => {
    await installFast(w);
    const { queued, problem } = await runOnDraftingPage(w);
    assert.ok(queued, `the page queues the job: ${problem?.textContent}`);
    assert.match(queued.textContent, /ci hosted/);
    const id = /JOB-\d{8}-\d{4}-[0-9a-f]{4}/.exec(queued.textContent)[0];
    const { status } = await pushRun(w);
    assert.equal(status.outcome, "done", status.summary);
    assert.equal(requests.length >= 1 && requests[0].headers.Authorization, `Bearer ${KEY}`);
    assert.match(w.fileAt(`docs/jobs/${id}.md`), /## End[^]*state: done/);
    assert.equal(w.fileAt(UC3), UC3_TEXT);
  });
});
