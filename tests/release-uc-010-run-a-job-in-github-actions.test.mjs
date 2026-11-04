// Release tests of UC-010 "Run a job in GitHub Actions": each requirement UC-010 realises, checked from the files the job workflow consists of, the commits the origin received and the requests the fixture endpoint
// received — one definition for the three drivers, a runtime that is interchangeable, a generated artifact that is a proposal and enters the default branch as open, no secret in the repository, a job recorded in
// its product repository, no local installation, the agent authenticated with a CI secret, and the person's token read from a CI secret by the writing machine alone. TST-373301 maps every requirement
// UC-010 realises to a release test that guards it; `A JOB RECORD STARTS NO CI RUN` is the one the item leaves out.
// Run: node --test tests/release-uc-010-run-a-job-in-github-actions.test.mjs
//
// Module: MOD-workflow-entries
// Module: MOD-runtimes
// Module: MOD-job-ledger
// Module: MOD-settings-pages
// Module: MOD-repository-hosts
// Module: MOD-endpoint-calls
// Guards: UC-010
// Level: release
//
// Written for the release testing of sprint 141 by developer-sonnet-k (ITM-373), who built none of the items UC-010 builds on (RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER). The world is
// tests/uc-010-harness.mjs. The release team works from the specification and the files: each case ends at what the origin holds and at the request a fixture received. The tests that draw a page come last,
// because drawing one registers the review pages' strategies with the job runner, which the entries register themselves. Readings the texts leave open, which the cases state:
//   - A JOB RECORD STARTS NO CI RUN is realised by UC-010 and is not part of this item: its release test needs MOD-test-schedule's ciConfiguration (UC-027), which this file does not run.
//   - "Three drivers" (ONE DEFINITION, THREE DRIVERS) are the browser's tab, the GitHub Actions workflow and the local Bridge; the Bridge's driver sends the same prepared prompt as the tab's (MOD-runtimes' bridgeDriver
//     hands driverPrompt(input) on), so that the tab stands for it here and the workflow is compared with the tab.
//   - "The same kind of artifact in all three runtimes" is read as the files the job drafts, by path and by text, being those the CI route commits.
//   - "The runner machine the agent works on receives only the key of the participant the job names" is read on the workflow's file (the secrets each job names) and on the entry (the key it reads on the agent's
//     machine); that GitHub sends a job's runner only the secrets the job names is the server's (MOD-runtimes, Data).
//   - "A job on the server's own machines pushes … with the person's token, never with the workflow's built-in token" is read on the file as the absence of the built-in token (GITHUB_TOKEN, github.token) from the
//     job workflow, whose permissions are read only. The two machines are run with the kind decide-gate, whose writer reads no history (a writer that does, the use cases', fails on the agent's machine:
//     TST-373209 of tests/system-uc-010-run-a-job-in-github-actions.test.mjs).

import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { testDeclarations } from "../src/test-document/index.mjs";
import { statuses } from "../src/approvals/index.mjs";
import { routesFor } from "../src/runtimes/index.mjs";
import { ACCEPTED, ENDPOINT, GATE_DRAFT, GATE_PATH, INSTRUCTION, KEY, TOKEN, UC1, UC1_CHANGED, UC1_TEXT, WORKFLOW, agentEnvironment, approvalOf, endpoint, entry, gateText, git, installFast,
  pushRun, queueFromDashboard, queueGate, runAddress, runInTab, runOnDraftingPage, workflowFiles, workflowRun, world, writingEnvironment } from "./uc-010-harness.mjs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const SELF = "tests/release-uc-010-run-a-job-in-github-actions.test.mjs";
const PARAMS = { useCase: "UC-001", instruction: INSTRUCTION, endpoint: ENDPOINT };
const SENTENCE = "You change a use case of a product as the person's instruction says.";
const OTHER_KEY = "sk-OTHER-KEY-0123456789abcdef";
const BOT = { name: "ci-bot", type: "CI agent", model: "fixture-llm", context: 200000, price: null, capabilities: ["draft text", "read the repository"], place: "GitHub's hosted runners", route: "ci hosted secret FIXTURE_KEY" };
// The jobs of a workflow file by their name, each with the text of its body.
const jobsOf = (text) => {
  const body = text.slice(text.indexOf("\njobs:") + 6);
  const heads = [...body.matchAll(/^ {2}([a-z0-9-]+):\s*$/gm)];
  return new Map(heads.map((head, at) => [head[1], body.slice(head.index, heads[at + 1]?.index ?? body.length)]));
};
// The secrets a job's text names, by their literal names.
const secretsOf = (jobText) => [...new Set([...jobText.matchAll(/secrets\.([A-Z0-9_]+)/g)].map((match) => match[1]))].sort();

// ---------------------------------------------------------------- the map

// Each requirement UC-010 realises, with the release tests of this file that guard it.
const EVIDENCE = {
  "NO SECRET IN THE REPOSITORY": [[SELF, "TST-373302"]],
  "A GENERATED ARTIFACT IS A PROPOSAL": [[SELF, "TST-373303"]],
  "A REVIEWED ARTIFACT ENTERS THE DEFAULT BRANCH AS OPEN": [[SELF, "TST-373304"]],
  "AGENT M WORKS WITHOUT A LOCAL INSTALLATION": [[SELF, "TST-373305"]],
  "A HOSTED JOB AUTHENTICATES ITS AGENT WITH A CI SECRET": [[SELF, "TST-373306"]],
  "A HOSTED JOB WRITES WITH THE PERSON'S TOKEN FROM A CI SECRET": [[SELF, "TST-373307"]],
  "ONE DEFINITION, THREE DRIVERS": [[SELF, "TST-373308"]],
  "A RUNTIME IS INTERCHANGEABLE": [[SELF, "TST-373309"]],
  "A JOB IS RECORDED IN ITS PRODUCT REPOSITORY": [[SELF, "TST-373310"]],
};
const LEFT_OUT = ["A JOB RECORD STARTS NO CI RUN"];

// TST-373301 · level: release · module: system
// guards: UC-010
// given: UC-010 as committed text, whose `realises` lists ten requirements, and the release tests named in EVIDENCE
// input: read UC-010's list of the requirements it realises, and the declarations of the test files named for each
// expect: known positive — UC-010 realises these ten requirements; nine have at least one test named and the tenth, A JOB RECORD STARTS NO CI RUN, is the one the item leaves out; each test named stands in its file with the level release and guards that requirement
test("TST-373301: UC-010 every requirement it realises has a release test that guards it", () => {
  const text = read("docs/use-cases/UC-010-run-a-job-in-github-actions.md");
  const front = text.slice(text.indexOf("realises:"), text.indexOf("\n---", text.indexOf("realises:")));
  const realised = [...front.matchAll(/^ {2}- (.+)$/gm)].map((match) => match[1]);
  assert.equal(realised.length, 10, "known positive: UC-010 realises ten requirements");
  for (const name of realised) assert.ok(name in EVIDENCE || LEFT_OUT.includes(name), `${name} has a release test or is left out`);
  assert.deepEqual(Object.keys(EVIDENCE).filter((name) => !realised.includes(name)), [], "EVIDENCE names no requirement UC-010 does not realise");
  for (const [name, tests] of Object.entries(EVIDENCE)) {
    assert.ok(tests.length > 0, `${name} names a test`);
    for (const [file, id] of tests) {
      assert.ok(existsSync(new URL(`../${file}`, import.meta.url)), `${name}: ${file} exists`);
      const declared = testDeclarations(file, read(file)).find((each) => each.id === id);
      assert.ok(declared, `${name}: ${id} is declared in ${file}`);
      assert.equal(declared.level, "release", `${id} is a release test`);
      assert.ok((declared.guards ?? []).includes(name), `${id} guards ${name}`);
    }
  }
});

// ---------------------------------------------------------------- NO SECRET IN THE REPOSITORY

// TST-373302 · level: release · module: system
// guards: NO SECRET IN THE REPOSITORY; UC-010
// given: the job workflow installed; a run of the job with the token AGENT_M_TOKEN and the key FIXTURE_KEY set; and a run in which the endpoint, a leaky one, quotes the key in the use case it drafts
// input: every commit of the product's origin, on every branch, searched for the token and the key — after the Install, after the queueing, after each run
// expect: known positive — the normal run writes UC-001 changed; no commit of either run holds the token or the key, and the job workflow's files name the secrets and hold no value; the leaky run writes nothing of the draft — UC-001 as it was —, its record ends failed and does not hold the key
test("TST-373302: UC-010 no commit of the product holds the token or the key", async () => {
  const holds = (w) => [TOKEN, KEY].filter((secret) => w.everyCommit().includes(secret));
  endpoint();
  await world({}, async (w) => {
    await installFast(w);
    const queued = await queueFromDashboard(w, { params: PARAMS });
    assert.deepEqual(holds(w), [], "after the queueing");
    assert.equal((await pushRun(w)).status.outcome, "done");
    assert.equal(w.fileAt(UC1), UC1_CHANGED, "known positive: the run wrote the use case");
    assert.deepEqual(holds(w), [], "after a normal run");
    assert.ok(!w.fileAt(queued.path).includes(KEY));
  });
  endpoint({ files: [{ path: UC1, text: `${UC1_CHANGED}\nauthorised with ${KEY}\n`, class: "change", of: "UC-001" }] });
  await world({}, async (w) => {
    await installFast(w);
    const queued = await queueFromDashboard(w, { params: PARAMS });
    const { status } = await pushRun(w);
    assert.equal(status.outcome, "failed");
    assert.equal(w.fileAt(UC1), UC1_TEXT, "nothing of the draft is written");
    assert.deepEqual(holds(w), [], "after a leaky run");
    assert.match(w.fileAt(queued.path), /## End[^]*state: failed/);
  });
});

// ---------------------------------------------------------------- A GENERATED ARTIFACT IS A PROPOSAL

// TST-373303 · level: release · module: system
// guards: A GENERATED ARTIFACT IS A PROPOSAL; UC-010
// given: UC-001 accepted by an approval record, and the job change-use-case of UC-001 run on the CI route
// input: the product after the run, read as the dashboard reads it; then a person's approval record that names the changed text
// expect: the run added no approval record; UC-001 reads as changed, not accepted; counter-proof — after a person's record names the changed text, UC-001 reads as accepted
test("TST-373303: UC-010 what the CI route generates counts as a proposal until a person accepts it", async () => {
  endpoint();
  await world({ product: ACCEPTED }, async (w) => {
    await installFast(w);
    assert.equal(statuses(await w.snapshot()).get(UC1).status, "accepted", "known positive: accepted before the run");
    await queueFromDashboard(w, { params: PARAMS });
    assert.equal((await pushRun(w)).status.outcome, "done");
    assert.deepEqual(w.paths().filter((path) => path.startsWith("docs/approvals/")), Object.keys(ACCEPTED), "the run wrote no approval record");
    assert.equal(statuses(await w.snapshot()).get(UC1).status, "changed");
    const host = w.dashboardHost();
    await host.commitFiles({ branch: "main", expectedHead: (await host.readSnapshot("main")).commit, files: [approvalOf(UC1, UC1_CHANGED)], message: "Accept UC-001" });
    assert.equal(statuses(await w.snapshot()).get(UC1).status, "accepted", "counter-proof: a record that names the text accepts it");
  });
});

// ---------------------------------------------------------------- A REVIEWED ARTIFACT ENTERS THE DEFAULT BRANCH AS OPEN

// TST-373304 · level: release · module: system
// guards: A REVIEWED ARTIFACT ENTERS THE DEFAULT BRANCH AS OPEN; UC-010
// given: the product whose UC-001 no approval record names, and the job change-use-case of UC-001 run on the CI route
// input: the commits of the product's origin after the run; the use cases read as the dashboard reads them; then a person's approval record naming the changed text
// expect: UC-001's changed text is written by a commit on the default branch itself — the product has no other branch and the commit is an ancestor of main —; UC-001 reads as open; counter-proof — once a record names the changed text it reads as accepted
test("TST-373304: UC-010 the use case enters the default branch directly and counts as open", async () => {
  endpoint();
  await world({}, async (w) => {
    await installFast(w);
    assert.equal(statuses(await w.snapshot()).get(UC1).status, "open", "known positive: open before the run");
    await queueFromDashboard(w, { params: PARAMS });
    assert.equal((await pushRun(w)).status.outcome, "done");
    const written = w.commitWithSubject("draft UC-001 as open files");
    assert.match(written, /^[0-9a-f]{40}$/);
    assert.equal(git(w.productOrigin, "merge-base", "--is-ancestor", written, "main"), "", "the commit is on the default branch");
    assert.deepEqual(w.branches(), ["main"], "no branch, so no pull request");
    assert.equal(git(w.productOrigin, "show", "--format=", "--name-only", written), UC1);
    assert.equal(statuses(await w.snapshot()).get(UC1).status, "open");
    const host = w.dashboardHost();
    await host.commitFiles({ branch: "main", expectedHead: (await host.readSnapshot("main")).commit, files: [approvalOf(UC1, UC1_CHANGED)], message: "Accept UC-001" });
    assert.equal(statuses(await w.snapshot()).get(UC1).status, "accepted", "counter-proof: a record that names the text accepts it");
  });
});

// ---------------------------------------------------------------- AGENT M WORKS WITHOUT A LOCAL INSTALLATION

// TST-373305 · level: release · module: system
// guards: AGENT M WORKS WITHOUT A LOCAL INSTALLATION; UC-010
// given: the CI agent ci-bot, whose route is the server's own runners; a product with the job workflow and one without; a job that needs no resource, and jobs that need a compute resource reached by the runner gpu and a machine reached by a Bridge; a run of the job change-use-case
// input: routesFor for each; the requests of the run
// expect: the job that needs no resource is offered on the server's own runners (ci, hosted) where the product has the job workflow, and the offer names the missing file where it has not; counter-proof — a job needing a compute resource of the runner gpu, and one needing a machine of a Bridge, are not offered there; the run needed no Bridge: every request it made went to the model endpoint or the server's API, and none to a loopback address
test("TST-373305: UC-010 a job that needs no local resource runs on the server's machines with nothing installed", async () => {
  const requests = endpoint();
  const offers = (product, needs) => routesFor(BOT, [BOT], product, needs).filter((offer) => offer.route.kind === "ci" && offer.route.runner === "hosted");
  const withWorkflow = { visibility: "private", jobWorkflow: true };
  assert.deepEqual(offers(withWorkflow, []).map((offer) => offer.available), [true]);
  const without = offers({ ...withWorkflow, jobWorkflow: false }, []);
  assert.equal(without[0].available, false);
  assert.match(without[0].reason, /agent-m-jobs\.yml/);
  assert.equal(offers(withWorkflow, [{ resource: "cluster", route: "runner:gpu" }])[0].available, false, "a compute resource of a runner is not reached");
  assert.equal(offers(withWorkflow, [{ resource: "lab-pc", route: "bridge lab-pc" }])[0].available, false, "a machine of a Bridge is not reached");
  await world({}, async (w) => {
    await installFast(w);
    await queueFromDashboard(w, { params: PARAMS });
    assert.equal((await pushRun(w)).status.outcome, "done");
    assert.equal(requests.length, 1, "known positive: the endpoint was asked");
    assert.deepEqual(requests.outside, [], "no request left the model endpoint and the server's API");
    assert.ok([...requests, ...requests.elsewhere].every((request) => !/127\.0\.0\.1|localhost|\[::1\]/.test(request.address)), "no request to a loopback address");
  });
});

// ---------------------------------------------------------------- A HOSTED JOB AUTHENTICATES ITS AGENT WITH A CI SECRET

// TST-373306 · level: release · module: system
// guards: A HOSTED JOB AUTHENTICATES ITS AGENT WITH A CI SECRET; UC-010
// given: the job workflow generated for the keys FIXTURE_KEY and OTHER_KEY of two CI agents; a copy of it with the agent's job of FIXTURE_KEY reading AGENT_M_TOKEN as well, and a copy with a key written into the file; the agent's machine of a run of the job of FIXTURE_KEY, whose environment holds FIXTURE_KEY and, wrongly, OTHER_KEY
// input: the secrets each job of the file names; the run of onRecordsChanged on the agent's machine
// expect: the plan reads no secret; the agent's job of no key reads none; the agent's job of the key n reads that key alone — FIXTURE_KEY for 1, OTHER_KEY for 2 — and never AGENT_M_TOKEN; each secret is named by its literal name; the file holds no key; counter-proof — the copy that reads the token in the agent's job and the copy that holds a key are found by the same check; the run calls the endpoint with the key FIXTURE_KEY and never sends OTHER_KEY
test("TST-373306: UC-010 the agent's job reads the key of its participant from a CI secret and no other secret", async () => {
  const requests = endpoint({ draft: GATE_DRAFT });
  const agentsRead = (text) => Object.fromEntries([...jobsOf(text)].filter(([name]) => /-agent-\d+$/.test(name)).map(([name, body]) => [name, secretsOf(body)]));
  const clean = (text, values) => {
    const reads = agentsRead(text);
    return reads["hosted-agent-0"].length === 0 && reads["hosted-agent-1"].join() === "FIXTURE_KEY" && reads["hosted-agent-2"].join() === "OTHER_KEY"
      && secretsOf(jobsOf(text).get("hosted-plan")).length === 0 && !/secrets\[/.test(text) && values.every((value) => !text.includes(value));
  };
  await world({}, async (w) => {
    const [jobs] = workflowFiles(w, { keys: ["FIXTURE_KEY", "OTHER_KEY"] });
    assert.equal(jobs.path, WORKFLOW);
    assert.deepEqual(Object.keys(agentsRead(jobs.text)), ["hosted-agent-0", "hosted-agent-1", "hosted-agent-2"], "known positive: the agent's jobs are found");
    assert.ok(clean(jobs.text, ["sk-", KEY]), "the generated workflow reads each key in the job of its agent alone");
    const withToken = jobs.text.replace("      FIXTURE_KEY: ${{ secrets.FIXTURE_KEY }}\n", "      FIXTURE_KEY: ${{ secrets.FIXTURE_KEY }}\n      AGENT_M_TOKEN: ${{ secrets.AGENT_M_TOKEN }}\n");
    assert.notEqual(withToken, jobs.text, "the copy with the token is a copy");
    assert.equal(clean(withToken, ["sk-", KEY]), false, "counter-proof: the token in an agent's job is found");
    const withKey = jobs.text.replace("FIXTURE_KEY: ${{ secrets.FIXTURE_KEY }}\n", `FIXTURE_KEY: ${KEY}\n`);
    assert.notEqual(withKey, jobs.text);
    assert.equal(clean(withKey, ["sk-", KEY]), false, "counter-proof: a key written into the file is found");

    await installFast(w);
    await queueGate(w);
    const status = await entry("onRecordsChanged", agentEnvironment(w, w.checkout(), { AGENT_M_KEY_NAMES: "FIXTURE_KEY OTHER_KEY", AGENT_M_KEY: "1", OTHER_KEY }));
    assert.equal(status.outcome, "done", status.summary);
    assert.equal(requests.length, 1);
    assert.equal(requests[0].headers.Authorization, `Bearer ${KEY}`);
    assert.ok(!JSON.stringify(requests).includes(OTHER_KEY), "the other participant's key reaches no request");
  });
});

// ---------------------------------------------------------------- A HOSTED JOB WRITES WITH THE PERSON'S TOKEN FROM A CI SECRET

// TST-373307 · level: release · module: system
// guards: A HOSTED JOB WRITES WITH THE PERSON'S TOKEN FROM A CI SECRET; UC-010
// given: the job workflow installed; a run of the job decide-gate in two machines — the agent's machine, whose environment holds the key and no token, and the writing machine, whose environment holds the token — and a run whose agent, led astray, pushes a change of .github/workflows/
// input: the file's jobs; onRecordsChanged and leaveResult on the agent's machine; writeResult on the writing machine
// expect: the file names no built-in token (GITHUB_TOKEN, github.token) and gives the workflow read access only; the token is read in the job that writes, which runs no entry of the agent, and in no agent's job; the job that writes deletes the result through the server's API with the token; the agent's machine writes nothing to the origin, and after writeResult the origin holds the taking, the gate's record and the end; counter-proof — a result that changes a workflow file is refused: the origin holds neither its branch nor the gate's record
test("TST-373307: UC-010 the writing machine writes the agent's result with the person's token, and the agent's machine never holds it", async () => {
  const requests = endpoint({ draft: GATE_DRAFT });
  await world({}, async (w) => {
    await installFast(w);
    const text = w.fileAt(WORKFLOW);
    assert.ok(!/GITHUB_TOKEN|github\.token/.test(text), "no built-in token");
    assert.match(text, /^permissions:\n {2}contents: read$/m);
    const jobs = jobsOf(text);
    const writer = jobs.get("hosted");
    assert.match(writer, /AGENT_M_TOKEN: \$\{\{ secrets\.AGENT_M_TOKEN \}\}/, "known positive: the job that writes reads the token");
    assert.ok(/main\.mjs writeResult/.test(writer) && !/main\.mjs (onRecordsChanged|onDispatch)/.test(writer), "the job that writes runs no entry of the agent");
    assert.match(writer, /-X DELETE[^]*actions\/artifacts/, "it deletes the result");
    assert.match(writer, /Bearer \$AGENT_M_TOKEN/, "with the token");
    for (const [name, body] of jobs) if (/-agent-\d+$/.test(name) || /-plan$/.test(name)) assert.ok(!/AGENT_M_TOKEN/.test(body), `${name} does not read the token`);

    const queued = await queueGate(w);
    const head = w.head();
    const agent = w.checkout();
    const ran = await entry("onRecordsChanged", agentEnvironment(w, agent));
    assert.equal(ran.outcome, "done", ran.summary);
    assert.equal(requests.length, 1);
    assert.equal((await entry("leaveResult", agentEnvironment(w, agent))).outcome, "done");
    assert.equal(w.head(), head, "the agent's machine writes nothing to the origin");
    const written = await entry("writeResult", writingEnvironment(w));
    assert.equal(written.outcome, "done", written.summary);
    assert.deepEqual(w.subjects().slice(0, 3), [`end ${queued.id}: done`, "gate fixture decided", `take ${queued.id} (${runAddress(agent.id)})`]);
    assert.equal(w.fileAt(GATE_PATH), gateText(GATE_DRAFT.decision, GATE_DRAFT.reason));
  });
  endpoint({ draft: GATE_DRAFT });
  await world({}, async (w) => {
    await installFast(w);
    const queued = await queueGate(w);
    const agent = w.checkout();
    assert.equal((await entry("onRecordsChanged", agentEnvironment(w, agent))).outcome, "done");
    git(agent.productDir, "checkout", "-q", "-b", "led-astray");
    writeFileSync(`${agent.productDir}/.github/workflows/steal.yml`, "on: push\n");
    git(agent.productDir, "add", "-A");
    git(agent.productDir, "commit", "-q", "-m", "a workflow of its own");
    git(agent.productDir, "push", "-q", "origin", "led-astray");
    assert.equal((await entry("leaveResult", agentEnvironment(w, agent))).outcome, "done");
    const refused = await entry("writeResult", writingEnvironment(w));
    assert.equal(refused.outcome, "failed");
    assert.match(refused.summary, /steal\.yml/);
    assert.deepEqual(w.branches(), ["main"], "counter-proof: the branch is not on the origin");
    assert.equal(w.fileAt(GATE_PATH), null, "counter-proof: the gate's record is not written");
    assert.match(w.fileAt(queued.path), /## End[^]*state: failed/);
  });
});

// ---------------------------------------------------------------- the tests that draw a page

// TST-373308 · level: release · module: system
// guards: ONE DEFINITION, THREE DRIVERS; UC-010
// given: the job change-use-case of UC-001 run on the CI route and, with the same instruction and endpoint, in the tab; the folder src/ of the repository
// input: the requests the fixture endpoint received from each run; every file below src/ searched for the first sentence of the kind's prompt; the files of the generated job workflow searched for it
// expect: known positive — the sentence stands in src/job-catalogue/kinds/change-use-case/prompt.md and in no other file below src/; the request of the CI run and the request of the tab both hold the prompt from that sentence to the heading of the conversation byte for byte alike; the generated workflow files hold none of its text
test("TST-373308: UC-010 the CI route sends the one definition of the prompt that the tab sends", async () => {
  const requests = endpoint();
  await world({}, async (w) => {
    await installFast(w);
    await queueFromDashboard(w, { params: PARAMS });
    assert.equal((await pushRun(w)).status.outcome, "done");
    await runInTab(w, PARAMS);
    assert.equal(requests.length, 2, "one request from the CI run, one from the tab");
    const promptOf = (request) => {
      const sent = JSON.parse(request.body).messages.map((message) => message.content).join("\n");
      return sent.slice(sent.indexOf(SENTENCE), sent.indexOf("## The conversation so far"));
    };
    const [fromCi, fromTab] = requests.map(promptOf);
    assert.ok(fromCi.startsWith(SENTENCE) && fromCi.includes("## The person's instruction"), "known positive: the prompt is found in the CI run's request");
    assert.ok(fromCi.includes(INSTRUCTION));
    assert.equal(fromCi, fromTab, "the same prompt from both drivers");
    const holders = readdirSync(new URL("../src/", import.meta.url), { recursive: true })
      .filter((path) => /\.(mjs|md|yml|json|html|css)$/.test(path) && !/(^|\/)(node_modules|vendor)\//.test(path))
      .filter((path) => readFileSync(new URL(`../src/${path}`, import.meta.url), "utf8").includes(SENTENCE));
    assert.deepEqual(holders, ["job-catalogue/kinds/change-use-case/prompt.md"], "the prompt stands once");
    for (const file of workflowFiles(w)) assert.ok(!file.text.includes("You change a use case") && !file.text.includes("## The person's instruction"), `${file.path} holds no prompt`);
  });
});

// TST-373309 · level: release · module: system
// guards: A RUNTIME IS INTERCHANGEABLE; UC-010
// given: the job change-use-case of UC-001 with the instruction and the endpoint, run on the CI route and, with the same inputs and the same answer of the endpoint, in the tab
// input: the files the tab's run drafts, and the files the CI route committed
// expect: the tab drafts one file, at the path of UC-001, as a change of UC-001; the CI route commits one artifact, at that path, with that text byte for byte, and besides it only the job's record; the kind of artifact is the same
test("TST-373309: UC-010 the same job gives the same artifact on the CI route and in the tab", async () => {
  endpoint();
  await world({}, async (w) => {
    await installFast(w);
    const installed = w.head();
    await queueFromDashboard(w, { params: PARAMS });
    assert.equal((await pushRun(w)).status.outcome, "done");
    const result = await runInTab(w, PARAMS);
    assert.equal(result.draft.files.length, 1);
    const [drafted] = result.draft.files;
    assert.equal(drafted.path, UC1);
    assert.equal(drafted.class, "change");
    assert.equal(drafted.of, "UC-001");
    assert.equal(w.fileAt(drafted.path), drafted.text, "the CI route commits what the tab drafts");
    const written = git(w.productOrigin, "diff", "--name-only", installed, "main").split("\n").filter((path) => !path.startsWith("docs/jobs/"));
    assert.deepEqual(written, [UC1], "the CI route wrote that one artifact and the job's record");
  });
});

// TST-373310 · level: release · module: system
// guards: A JOB IS RECORDED IN ITS PRODUCT REPOSITORY; UC-010
// given: the job workflow installed; the drafting page of the use cases, where the person chooses ci-bot and presses Run; and the job change-use-case of UC-001 queued and run on the CI route
// input: the commit of the page's click; the product's record of the job after the run; the instance's origin
// expect: the click is one commit that adds the one file docs/jobs/<job>.md to the product and nothing else, which names the kind, what the job works on, the participant ci-bot, the route ci hosted, the start and its inputs; the instance's origin is as it was; after the run the record of the job that ran ends with its state done, its results naming the commit that wrote the use case and its log the run's address
test("TST-373310: UC-010 a job is recorded in its product repository, at its start and at its end", async () => {
  endpoint();
  await world({}, async (w) => {
    await installFast(w);
    const instanceHead = git(w.instanceOrigin, "rev-parse", "main");
    const before = w.head();
    const { queued } = await runOnDraftingPage(w);
    const id = /JOB-\d{8}-\d{4}-[0-9a-f]{4}/.exec(queued.textContent)[0];
    assert.equal(git(w.productOrigin, "rev-list", "--count", `${before}..main`), "1", "one commit");
    assert.equal(git(w.productOrigin, "show", "--format=", "--name-only", "main"), `docs/jobs/${id}.md`);
    const start = w.fileAt(`docs/jobs/${id}.md`);
    for (const line of [/^id: JOB-/m, /^kind: derive-use-cases$/m, /^works_on:\n {2}- A LOAN HAS A DUE DATE$/m, /^participant: ci-bot$/m, /^route: ci hosted$/m, /^start: .+ UTC$/m, /^inputs:\n {2}- /m]) assert.match(start, line);
    assert.equal(git(w.instanceOrigin, "rev-parse", "main"), instanceHead, "the instance's repository is as it was");

    const second = await queueFromDashboard(w, { params: PARAMS });
    const { run } = await pushRun(w);
    const ended = w.fileAt(second.path);
    assert.match(ended, /## End[^]*state: done/);
    assert.ok(ended.includes(w.commitWithSubject("draft UC-001 as open files")), "the results name the commit that wrote the use case");
    assert.ok(ended.includes(`log: ${runAddress(run.id)}`));
  });
});
