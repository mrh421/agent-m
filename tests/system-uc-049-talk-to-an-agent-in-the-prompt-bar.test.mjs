// UC-049 "Talk to an agent in the prompt bar" as a system path: the author talks to a participant in the prompt bar of the dashboard — MOD-site-frame's real `startPage` on the review page, the real MOD-prompt-bar, MOD-job-runner, MOD-runtimes,
// MOD-job-catalogue (the kind `converse`), MOD-participant-list and the real GitHub host, served in memory with the harness of tests/uc-019-prompt-bar-harness.mjs and the layer of tests/uc-049-world.mjs — and walks the main flow (steps 1
// to 6) and the alternative flows 1a, 1b, 2a, 3a, 3b, 3c, 4a, 4b, 4c, 4d, 4e, 5a, 6a, 6b and 6c. A model endpoint is a fixture, a Bridge is a fixture, the repository host is a fixture, and the job workflow is the real entry of
// MOD-workflow-entries run on fixture checkouts. Nothing reaches the network: a request to any other origin fails the test.
// Run: node --test tests/system-uc-049-talk-to-an-agent-in-the-prompt-bar.test.mjs
//
// Module: MOD-prompt-bar; MOD-site-frame; MOD-job-runner; MOD-runtimes; MOD-participant-list; MOD-workflow-entries
// Guards: UC-049; THE PAGE NAMES WHERE IT SENDS; A CONVERSATION IS WRITTEN TO A REPOSITORY ONLY WHEN RECORDING IS ON; A RECORDED CONVERSATION IS KEPT WHERE IT WAS HELD; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK
// Guards: A PARTICIPANT DECLARES ITS CAPABILITIES; A PARTICIPANT DECLARES WHERE IT PROCESSES DATA; A TOKEN GOES ONLY TO THE SERVER THAT ISSUED IT; NO SECRET IN THE REPOSITORY; NO SERVER; ONE CLICK PER DECISION; EVERY STEP EXPLAINS ITSELF
// Level: system
//
// Each test states its input and its expected result in its own text (given / input / expect), from UC-049, before it runs; none reads an expected value from a document or from the page. The conversation of the page is the
// bar's `ul.conversation`; the model endpoint answers the replies a test scripts (an answer in the kind's form, or the tool calls of a model that can use tools). Where the page and UC-049 disagree the test follows UC-049, and
// is marked a finding with `todo`: the case is red on main until the page changes. The counter-proofs are recorded in the pull request.

import test from "node:test";
import assert from "node:assert/strict";
import { INSTRUCTION, LOAN, UC7, UC7_PATH, UC8, UC8_PATH, all, barOf, changed, conversationRecords, draft, goTo, keptDraft, namedButton, one, onRequirementPage, onUseCase, press, proposalWrites, recordTexts, rest, review, run, save, scenario, send, statusOf, useCases } from "./uc-019-prompt-bar-harness.mjs";
import { AGENT, CI_AGENT, DRAFTER, HANDY, RUN_URL, SUBAGENT, TOOLER, answer, barText, calls, conversationOf, followClock, free, registerOf, sendNow, textOfSent, watch, withWorkflow } from "./uc-049-world.mjs";
import { appendToRecord } from "../src/job-ledger/index.mjs";
import { byClass, until } from "./review-pages-draft-world.mjs";

// A person's click is made trusted by the document of the harness; a script's click is marked `scripted` (tests/review-pages-harness.mjs).
globalThis.reviewPagesScriptedWithin = [];
const scripted = (node) => node.dispatchEvent(Object.assign(new Event("click"), { scripted: true }));
const register = (...rows) => ({ "docs/participants.md": registerOf(...rows) });
const UNREACHED_ENDPOINT = "| nowhere | model endpoint | nowhere-model | 200000 | - | draft text | this machine | endpoint missing |";
const UNREACHED_AGENT = "| far-agent | CLI agent | far-model | 200000 | - | draft text | this machine | bridge nobridge agent claude |";
const select = (s, name) => { const selector = all(barOf(s), "select", "participant")[0]; assert.ok(selector, `known positive: the bar offers a choice (${barText(s).slice(-200)})`); selector.value = name; };

// TST-513001 · level: system · module: MOD-prompt-bar · MOD-site-frame · MOD-job-runner
// guards: UC-049; THE PAGE NAMES WHERE IT SENDS; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK; EVERY STEP EXPLAINS ITSELF
// given: the specification browser of the product at its default branch; the register offers drafter (a model endpoint at "this machine") and tooler (a model endpoint at "Anthropic, USA"); both endpoints are configured in this browser; recording is off
// input: the page opened; tooler chosen in the selector; the message "Which rules does this page list?" written, and then Send pressed; then the answer, a second message "And the second one?" and Send
// expect: above the input the bar names each participant with its place ("drafter — this machine", "tooler — Anthropic, USA") and a folded "What is this?" explains the bar; writing sends nothing; Send sends exactly one request, to tooler's endpoint, naming the destination before it is made ("Sent to: tooler — Anthropic, USA"); the message holds the person's words, the page as the author sees it (the view, the product, the version and the requirements listed) and the chapters of the book for requirements; the answer appears in the conversation under tooler's name; the second message carries the conversation so far (the first message and its answer) (flow: UC-049 main flow (1, 2, 3, 5, 6))
test("main flow: the bar names the participant with its place, Send is the decision, the participant is given the page, and the conversation goes on", async () => {
  const s = await scenario({ instanceFiles: register(DRAFTER, TOOLER), answers: [{ answer: "It lists A LOAN HAS A DUE DATE and A BOOK IS SHELVED." }] });
  const w = watch(s, { script: [answer("It lists A LOAN HAS A DUE DATE and A BOOK IS SHELVED."), answer("The second one is A BOOK IS SHELVED.")] });
  assert.ok(barText(s).includes("drafter — this machine") && barText(s).includes("tooler — Anthropic, USA"), barText(s));
  assert.equal(all(barOf(s), "details").some((node) => node.textContent.includes("What is this?")), true, "a folded What is this? explains the bar");
  select(s, "tooler");
  one(barOf(s), "textarea", "instruction").value = "Which rules does this page list?";
  await rest(s);
  assert.deepEqual(w.endpoint(), [], "nothing is sent while the person has only written");
  await sendNow(s, "Which rules does this page list?", { participant: "tooler" });
  await free(s);
  assert.equal(w.endpoint().length, 1);
  assert.match(statusOf(s).textContent, /^Sent to:tooler — Anthropic, USA/);
  const first = textOfSent(w.endpoint()[0]);
  for (const part of ["Which rules does this page list?", "Current requirements", "https://github.com/akmaier/lending-tool", "Version: main", "A LOAN HAS A DUE DATE", "A BOOK IS SHELVED", "Requirements Engineering in Practice"]) {
    assert.ok(first.includes(part), `the first message holds ${part}`);
  }
  assert.ok(conversationOf(s).some((line) => line.includes("tooler") && line.includes("It lists A LOAN HAS A DUE DATE")), conversationOf(s).join(" | "));
  await sendNow(s, "And the second one?", { participant: "tooler" });
  await free(s);
  const second = textOfSent(w.endpoint()[1]);
  assert.ok(second.includes("Which rules does this page list?") && second.includes("It lists A LOAN HAS A DUE DATE"), "the second message carries the conversation so far");
  assert.ok(second.includes("And the second one?"));
  assert.deepEqual(w.github().filter((request) => request.method !== "GET"), [], "no message of the conversation is written anywhere");
  w.stop();
});

// TST-513002 · level: system · module: MOD-prompt-bar · MOD-job-catalogue
// guards: UC-049; ONE DEFINITION, THREE DRIVERS
// given: the page of TST-513001
// input: a message sent to drafter
// expect: UC-049 step 3 says the system prompt holds "Agent M's rules for what the participant drafts — everything is a proposal; a change of the SPEC is saved as a queue entry": the message the participant receives says that what it drafts is a proposal and that a change of the SPEC becomes a queue entry. FINDING: the message of the kind `converse` holds neither (it says only to change nothing the person did not ask for), so this case is red on main until the prompt carries the rules (flow: UC-049 main flow (3))
test("main flow (3): the system prompt carries the rules for what the participant drafts", async () => {
  const s = await scenario({ instanceFiles: register(DRAFTER), answers: [{ answer: "x" }] });
  const w = watch(s, { script: [answer("Understood.")] });
  await sendNow(s, INSTRUCTION);
  await free(s);
  const text = textOfSent(w.endpoint()[0]);
  assert.match(text, /proposal/i, "what the participant drafts is a proposal");
  assert.match(text, /queue entry/i, "a change of the SPEC is saved as a queue entry");
  w.stop();
});

// TST-513003 · level: system · module: MOD-prompt-bar · MOD-runtimes · MOD-repository-hosts
// guards: UC-049; A TOKEN GOES ONLY TO THE SERVER THAT ISSUED IT; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK; NO SERVER
// given: tooler declares "use tools" and "read the repository"; its endpoint first asks for list-files and read-file of SPEC.md, then answers
// input: a message sent to tooler
// expect: the request offers the kind's tools (list-files, read-file, search-files, propose-edit, hand-over); the loop runs in this tab: the tab reads the product through the repository server's API with the author's token of that product — every request the message makes to the product's server carries that token and no other — and returns the results to the endpoint in a second request (two tool results); the answer appears; nothing is written to any repository (flow: UC-049 main flow (4, endpoint that can use tools))
test("main flow (4): a model endpoint that can use tools works in a loop in the tab, reading the product with the author's token and writing nothing", async () => {
  const s = await scenario({ instanceFiles: register(TOOLER), answers: [{ answer: "x" }] });
  const w = watch(s, { script: [calls({ id: "c1", name: "list-files", args: { folder: "" } }, { id: "c2", name: "read-file", args: { path: "SPEC.md" } }), answer("There are two rules: A LOAN HAS A DUE DATE and A BOOK IS SHELVED.")] });
  await sendNow(s, "What rules are there?");
  await free(s);
  const [first, second] = w.bodies();
  assert.deepEqual(first.tools.map((tool) => tool.function.name), ["list-files", "read-file", "search-files", "propose-edit", "hand-over"]);
  assert.equal(w.endpoint().length, 2, "the endpoint was asked twice: the call, then the answer");
  assert.deepEqual(second.messages.map((message) => message.role), ["user", "assistant", "tool", "tool"]);
  assert.ok(second.messages.at(-1).content.includes("A LOAN HAS A DUE DATE"), "the result of read-file reached the endpoint");
  const product = w.github().filter((request) => request.path.startsWith("/repos/akmaier/lending-tool"));
  assert.ok(product.length > 0, "known positive: the tab asked the product's server during the message");
  for (const request of product) assert.equal(request.headers.Authorization, "Bearer github_pat_FIXTURE0123456789", "with the author's token of that product, and no other");
  assert.ok(w.endpoint().every((request) => !JSON.stringify(request.headers).includes("github_pat_")), "the token went to the repository server only, never to the endpoint");
  assert.ok(conversationOf(s).some((line) => line.includes("There are two rules")));
  assert.deepEqual(w.github().filter((request) => request.method !== "GET"), [], "the loop writes nothing");
  w.stop();
});

// TST-513004 · level: system · module: MOD-prompt-bar · MOD-runtimes
// guards: UC-049; A PARTICIPANT DECLARES ITS CAPABILITIES
// given: drafter declares "draft text" only
// input: a message sent to drafter
// expect: exactly one request to the endpoint, which offers no tools; the answer is text and appears in the conversation (flow: UC-049 main flow (4, endpoint without use tools))
test("main flow (4): a model endpoint without the capability use tools answers once", async () => {
  const s = await scenario({ instanceFiles: register(DRAFTER), answers: [{ answer: "x" }] });
  const w = watch(s, { script: [answer("It is the specification browser.")] });
  await sendNow(s, "What is this page?");
  await free(s);
  assert.equal(w.endpoint().length, 1);
  assert.equal(w.bodies()[0].tools, undefined, "no tool is offered");
  assert.ok(conversationOf(s).some((line) => line.includes("It is the specification browser.")));
  w.stop();
});

// TST-513005 · level: system · module: MOD-prompt-bar · MOD-runtimes · MOD-bridge-client
// guards: UC-049; THE PAGE NAMES WHERE IT SENDS; A PARTICIPANT DECLARES WHERE IT PROCESSES DATA
// given: agent-cli, a CLI agent on the paired Bridge release-bridge at "this machine", and drafter, whose endpoint is reached directly
// input: a message sent to agent-cli
// expect: the Bridge receives the message as one ask of the agent claude, with the pairing token, whose input holds the person's words and the page; no request goes to a model endpoint; the answer appears in the conversation (flow: UC-049 main flow (4, CLI agent))
test("main flow (4): a CLI agent receives the message through its Bridge", async () => {
  const s = await scenario({ bridge: true, instanceFiles: register(AGENT), answers: [{ answer: "x" }] });
  const w = watch(s, { script: [answer("The Bridge's agent answers.")] });
  assert.ok(barText(s).includes("agent-cli — this machine"), barText(s));
  await sendNow(s, "Look at this page.");
  await free(s);
  assert.equal(w.asks.length, 1);
  assert.equal(w.asks[0].agent, "claude");
  assert.ok(w.asks[0].input.includes("Look at this page.") && w.asks[0].input.includes("A LOAN HAS A DUE DATE"), "the ask holds the person's words and the page");
  assert.deepEqual(w.endpoint(), [], "no model endpoint is asked");
  assert.ok(w.bridge().every((request) => request.headers["x-agent-m-bridge-token"] === "fixture-pairing-token"), "every call to the Bridge carries the pairing token");
  assert.ok(conversationOf(s).some((line) => line.includes("The Bridge's agent answers.")));
  w.stop();
});

// TST-513006 · level: system · module: MOD-prompt-bar · MOD-participant-list
// guards: UC-049
// given: the register lists a model endpoint whose endpoint is configured nowhere in this browser, and a CLI agent on a Bridge this browser has not paired
// input: the page opened
// expect: the prompt bar is not shown — the footer holds no bar — and nothing was asked of any model; with the same register and the endpoint `fixture` configured (a known positive) the bar is shown (flow: UC-049 alternative 1a)
test("alternative 1a: with no participant offered the prompt bar is not shown", async () => {
  await scenario({ instanceFiles: register(UNREACHED_ENDPOINT, UNREACHED_AGENT) }).catch((failure) => { if (!/the prompt bar is drawn/.test(failure.message)) throw failure; });
  assert.deepEqual(byClass(document.body, "section", "prompt-bar"), [], "no bar is drawn");
  assert.deepEqual(byClass(document.body, "footer", "site-frame-prompt-bar").flatMap((footer) => footer.children ?? []), [], "the footer holds nothing");
  const reached = await scenario({ instanceFiles: register(UNREACHED_ENDPOINT, UNREACHED_AGENT, DRAFTER) });
  assert.equal(all(reached.footer, "section", "prompt-bar").length, 1, "known positive: with a participant that is reached the bar is shown");
});

// TST-513007 · level: system · module: MOD-prompt-bar · MOD-participant-list
// guards: UC-049; A PARTICIPANT DECLARES WHERE IT PROCESSES DATA
// given: the register lists drafter, sub-cli (a subagent that agent-cli starts), agent-cli (a CLI agent on the paired Bridge) and ci-agent (a CI agent)
// input: the page opened
// expect: the bar offers drafter and agent-cli, each with its place, and neither the subagent nor the CI agent (flow: UC-049 alternative 1b)
test("alternative 1b: a participant reached only through another one is not offered", async () => {
  const s = await scenario({ bridge: true, instanceFiles: register(DRAFTER, SUBAGENT, AGENT, CI_AGENT) });
  const text = barText(s);
  assert.ok(text.includes("drafter — this machine") && text.includes("agent-cli — this machine"), text);
  assert.ok(!text.includes("sub-cli") && !text.includes("ci-agent"), "the subagent and the CI agent are not offered");
  assert.equal(all(barOf(s), "option").length, 2);
});

// TST-513008 · level: system · module: MOD-prompt-bar · MOD-trace-pages
// guards: UC-049
// given: the product has a release v1.0.0; the specification browser shows that version, with A LOAN HAS A DUE DATE open
// input: the message "Make the due date visible." sent to drafter
// expect: the participant is given the version as the page shows it ("Version: v1.0.0") and the requirement as it reads there; the message is of the kind that answers about the page, not of the kind that drafts a change of requirements (no "The requirements to change" part), and the bar offers no Review the draft: a change is drafted only against the current text (flow: UC-049 alternative 2a)
test("alternative 2a: at a released version the participant is given that version and nothing is drafted against it", async () => {
  const s = await scenario({ instanceFiles: register(DRAFTER) });
  const w = watch(s, { script: [answer("At v1.0.0 the rule reads: every loan states its due date.")] });
  await goTo(s, `#trace/key=specification/ref=v1.0.0/product=${encodeURIComponent(s.address)}`);
  await press(s, one(s.target, "button", "spec-group-toggle"));
  await press(s, all(s.target, "button", "requirement-name").find((button) => button.textContent === LOAN));
  await sendNow(s, INSTRUCTION);
  await free(s);
  const sent = textOfSent(w.endpoint()[0]);
  assert.ok(sent.includes("Version: v1.0.0"), "the version is given");
  assert.ok(sent.includes("Every loan states its due date."), "the requirement as it reads there");
  assert.ok(!sent.includes("The requirements to change"), "no change of requirements is drafted");
  assert.equal(all(barOf(s), "button", "review").length, 0, "no draft is offered for review");
  w.stop();
});

// TST-513009 · level: system · module: MOD-prompt-bar · MOD-job-runner
// guards: UC-049; THE PAGE NAMES WHERE IT SENDS
// given: drafter's context holds 1 500 tokens, which the page and its chapters do not fit into; and, in a second page, a participant with a larger context is offered beside it
// input: a message sent to drafter
// expect: nothing is sent; the bar says that nothing was sent, which participant does not hold the message and how many tokens it holds against how many the message needs; with no larger participant it says so; with a larger one it offers it by name; nothing is left out silently (the message is not shortened and sent) (flow: UC-049 alternative 3a)
test("alternative 3a: a message that does not fit is not sent, and a participant with a larger context is offered", async () => {
  const small = ROW_SMALL("drafter", 1500);
  const alone = await scenario({ instanceFiles: register(small) });
  const w = watch(alone);
  await sendNow(alone, "What do I see?");
  assert.deepEqual(w.endpoint(), [], "nothing is sent");
  assert.match(statusOf(alone).textContent, /Nothing was sent\./);
  assert.match(statusOf(alone).textContent, /drafter does not hold this message: its context holds 1500 tokens, the job needs about \d+/);
  assert.match(statusOf(alone).textContent, /No offered participant has a larger context\./);
  w.stop();
  const both = await scenario({ instanceFiles: register(small, ROW_SMALL("big-drafter", 1000000)) });
  const v = watch(both, { script: [answer("Now it fits.")] });
  select(both, "drafter");
  await sendNow(both, "What do I see?", { participant: "drafter" });
  assert.deepEqual(v.endpoint(), [], "nothing is sent to the participant that cannot hold it");
  assert.match(statusOf(both).textContent, /big-drafter/, "a participant with a larger context is offered by name");
  v.stop();
});
const ROW_SMALL = (name, context) => `| ${name} | model endpoint | ${name}-model | ${context} | - | draft text | this machine | endpoint fixture |`;

// ---------------------------------------------------------------- the hand-over to GitHub Actions (4a, 4b, 4c, 4d) and Stop (5a)

const HAND_OVER = { kind: "converse", works_on: [LOAN], task: "Run the tests of the loan page and tell me which fail" };
const proposalOf = (s) => one(barOf(s), "section", "hand-over");
const followingOf = (s) => all(barOf(s), "section", "following").map((node) => node.textContent).join(" ");
const queuedRecord = (s) => Object.entries(s.product.files).find(([path]) => path.startsWith("docs/jobs/JOB-"));
// The person asks handy; the answer proposes the hand-over; the proposal is checked.
async function proposes(s, w) {
  await sendNow(s, "Please run the tests of this page.", { participant: "handy" });
  await free(s);
  await until(() => all(barOf(s), "section", "hand-over").length > 0 && !proposalOf(s).textContent.includes("Checking"), "the hand-over is checked");
  void w;
}
const handOverButton = (s) => all(proposalOf(s), "button", "queue")[0];
const handedOver = async (options = {}) => {
  const s = await scenario({ instanceFiles: register(DRAFTER, HANDY), ...options });
  const w = watch(s, { script: [answer("I will hand this on.", { handOver: HAND_OVER })] });
  const clock = followClock();
  await proposes(s, w);
  return { s, w, clock, done: () => { clock.stop(); w.stop(); } };
};

// TST-513010 · level: system · module: MOD-prompt-bar · MOD-runtimes · MOD-workflow-entries
// guards: UC-049; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK; A HOSTED JOB WRITES WITH THE PERSON'S TOKEN FROM A CI SECRET; A HOSTED JOB AUTHENTICATES ITS AGENT WITH A CI SECRET; A JOB IS RECORDED IN ITS PRODUCT REPOSITORY; NO SECRET IN THE REPOSITORY
// given: handy, a model endpoint at "GitHub Actions in the USA" with the CI secret CI_KEY, that can run code and tests; the product holds Agent M's job workflow; handy answers a message by proposing to hand over a converse job on A LOAN HAS A DUE DATE with a task
// input: the person's Send, whose answer proposes the hand-over — no further click —; the run (the real entry onDispatch on fixture checkouts; the conversation's kind runs through Agent M's own job runner, calling the fixture endpoint); the next poll
// expect: the proposal shows the kind, what it works on, the task, "handy — GitHub Actions in the USA" and the route "ci hosted", and no button Hand over; the hand-over goes on at once and commits one file, the record of the job, which names the participant, the model, the route and what it works on and holds none of the conversation's messages and not the task (the record says the task travels with the hand-over); the job workflow is started once with the job and the task as its inputs; the bar says waiting for GitHub Actions; the run ends done in its record without a commit of the task, and the bar shows the end (flow: UC-049 alternative 4a)
test("alternative 4a: the participant proposes a hand-over, which is queued without a further click and starts the workflow with the task, and the run's end is shown", async () => {
  const { s, w, clock, done } = await handedOver();
  const text = proposalOf(s).textContent;
  for (const part of ["Kind: converse", `Works on: ${LOAN}`, `Task: ${HAND_OVER.task}`, "Participant: handy — GitHub Actions in the USA", "Route: ci hosted"]) assert.ok(text.includes(part), `${part} in ${text}`);
  assert.equal(handOverButton(s), undefined, "no click is asked for");
  await until(() => s.product.writes.length === 1, "the hand-over is queued at once");
  assert.equal(s.product.writes.length, 1, "one commit");
  const [path, record] = queuedRecord(s);
  assert.deepEqual(Object.keys(s.product.writes[0].files), [path], "the record of the job is the one file");
  for (const part of ["participant: handy", "model: handy-model", "route: ci hosted", `- ${LOAN}`, "kind: converse", "task: with the hand-over"]) assert.ok(record.includes(part), `${part} in the record`);
  for (const secret of ["Please run the tests of this page.", "I will hand this on.", HAND_OVER.task, "CI_KEY=", "fixture-model-key"]) assert.ok(!record.includes(secret), `the record holds nothing of ${secret}`);
  assert.equal(w.dispatches.length, 1);
  assert.deepEqual(Object.keys(w.dispatches[0].inputs).sort(), ["endpoint", "job", "secret", "task"]);
  assert.equal(w.dispatches[0].inputs.secret, "CI_KEY", "the input secret is the name of the endpoint's CI secret, never its value");
  assert.equal(w.dispatches[0].inputs.task, HAND_OVER.task);
  assert.ok(followingOf(s).includes("waiting for GitHub Actions") && followingOf(s).includes("State: queued"), followingOf(s));
  // The runner takes the job (the run is listed), and the next poll shows its address.
  s.product.change(path, appendToRecord(record, { part: "taken", at: new Date("2026-10-19T12:00:30Z"), by: RUN_URL }));
  w.runs.push({ id: "7", workflow: "agent-m-jobs.yml", commit: "c0", event: "workflow_dispatch", status: "in_progress", conclusion: null, url: RUN_URL });
  await rest(s);
  await clock.tick();
  await rest(s);
  await until(() => followingOf(s).includes("State: running"), "the job runs");
  assert.ok(followingOf(s).includes(RUN_URL) && followingOf(s).includes("waiting for GitHub Actions"), followingOf(s));
  // The run itself: the real entry of the job workflow, on fixture checkouts, with the coding agent a fixture executable.
  await withWorkflow(s, { answers: [], inputs: w.dispatches[0].inputs, files: { [path]: record }, agent: { answer: { answer: "Two tests fail: loan.test.mjs and shelf.test.mjs." } } }, async ({ status, git, product, log }) => {
    assert.equal(status.outcome, "done", status.summary);
    assert.ok(log.includes("Two tests fail"), "the run leaves the agent's answer in its log");
    const after = git(product.origin, "show", `main:${path}`);
    assert.match(after, /## End[\s\S]*state: done/);
    const messages = git(product.origin, "log", "--format=%B", "main");
    assert.ok(!messages.includes(HAND_OVER.task), "no commit message holds the task");
    assert.ok(!git(product.origin, "show", `main:${path}`).includes(HAND_OVER.task), "the record still holds no task");
    s.product.change(path, after);
    w.runs[0].status = "completed";
    w.runs[0].conclusion = "success";
  });
  await clock.tick();
  await rest(s);
  await until(() => followingOf(s).includes("Ended: done"), `the end is shown: ${followingOf(s)}`);
  assert.ok(!followingOf(s).includes("waiting for GitHub Actions"));
  done();
});

// TST-513011 · level: system · module: MOD-prompt-bar · MOD-job-ledger
// guards: UC-049; PROGRESS AND JOB STATE ARE DERIVED, NOT STORED
// given: a conversation with a message and its answer, and a job handed over from it (the record queued in the product); then the tab is closed — the page opened again in a new tab, whose storage is empty — while the product keeps the record
// input: the page opened in the new tab
// expect: the conversation is gone — the bar shows none of its messages and follows no job —, and the job's record is still in the product repository, naming the participant and what it works on (flow: UC-049 alternative 4b)
test("alternative 4b: when the tab is closed the conversation is gone and the job's record remains", async () => {
  const { s, done } = await handedOver();
  const [path, record] = queuedRecord(s);
  assert.ok(conversationOf(s).length > 0 && followingOf(s).includes("Handed over"), "known positive: the first tab held a conversation and followed the job");
  done();
  const reopened = await scenario({ instanceFiles: register(DRAFTER, HANDY), extraFiles: { [path]: record } });
  assert.deepEqual(conversationOf(reopened), [], "the conversation is gone");
  assert.equal(followingOf(reopened), "", "no job is followed");
  assert.match(reopened.product.files[path], /participant: handy[\s\S]*works_on:[\s\S]*A LOAN HAS A DUE DATE|works_on:[\s\S]*A LOAN HAS A DUE DATE[\s\S]*participant: handy/, "the record shows what the job was");
});

// TST-513012 · level: system · module: MOD-prompt-bar · MOD-runtimes
// guards: UC-049; EVERY STEP EXPLAINS ITSELF
// given: a product that holds no job workflow
// input: the participant proposes a hand-over
// expect: nothing is handed over — no Hand over, no write, no workflow started —; the conversation says what is missing (the job workflow) and links the route that sets it up (settings); following the link goes there (flow: UC-049 alternative 4c)
test("alternative 4c: a product without the job workflow gets nothing handed over, and the bar says what is missing and links setting it up", async () => {
  const s = await scenario({ instanceFiles: register(DRAFTER, HANDY) });
  delete s.product.files[".github/workflows/agent-m-jobs.yml"];
  const w = watch(s, { script: [answer("I will hand this on.", { handOver: HAND_OVER })] });
  await proposes(s, w);
  const text = proposalOf(s).textContent;
  assert.equal(all(proposalOf(s), "button", "queue").length, 0, "no Hand over is offered");
  assert.match(text, /job workflow/i, "it says the job workflow is missing");
  assert.deepEqual([s.product.writes.length, w.dispatches.length], [0, 0]);
  const link = all(proposalOf(s), "a").concat(all(proposalOf(s), "button")).find((node) => /Set up the job workflow/.test(node.textContent));
  assert.ok(link, `a link to the settings: ${text}`);
  await press(s, link);
  assert.match(s.location.hash, /^#settings/, "the link goes to the route that sets it up");
  w.stop();
});

// TST-513013 · level: system · module: MOD-prompt-bar · MOD-workflow-entries · MOD-endpoint-calls
// guards: UC-049; AN UNSUPPORTED ENDPOINT SAYS SO
// given: a hand-over to handy whose endpoint GitHub's runners cannot reach (the fixture's fetch fails in the run) and whose coding agent fails
// input: the person's click on Hand over; the run (the real entry on fixture checkouts); the next poll
// expect: the run ends failed and its record names the reason — the run failed against the endpoint, why, and the routes that would work: a self-hosted runner, or a Bridge —; the bar shows the end as failed with that reason (flow: UC-049 alternative 4d)
test("alternative 4d: when GitHub's runners cannot reach the endpoint the run fails and names the reason and the routes that would work", async () => {
  const { s, w, clock, done } = await handedOver();
  const [path, record] = queuedRecord(s);
  await withWorkflow(s, { answers: [], inputs: w.dispatches[0].inputs, files: { [path]: record }, agent: { fail: "connection refused" }, fail: "fetch failed" }, async ({ status, git, product }) => {
    assert.equal(status.outcome, "failed");
    const after = git(product.origin, "show", `main:${path}`);
    assert.match(after, /state: failed/);
    assert.match(after, /The routes that would work: a self-hosted runner, or a Bridge\./);
    assert.match(after, /the run failed against the endpoint https:\/\/fixture-endpoint\.example\.test\/v1 \(fixture-model\)/);
    s.product.change(path, after);
  });
  await clock.tick();
  await rest(s);
  await until(() => followingOf(s).includes("Ended: failed"), `the failure is shown: ${followingOf(s)}`);
  assert.match(followingOf(s), /routes that would work/);
  done();
});

// TST-513014 · level: system · module: MOD-prompt-bar · MOD-runtimes
// guards: UC-049; A CANCELLED JOB WRITES NOTHING MORE; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK
// given: a message that is still running in the tab (the endpoint has not answered)
// input: the person's click on Stop; then the endpoint is let to answer
// expect: the message is aborted — the bar can be used again, nothing was written to any repository, and the answer that comes too late is not added to the conversation (flow: UC-049 alternative 5a)
test("alternative 5a: Stop ends the loop in the tab and nothing is written", async () => {
  const s = await scenario({ instanceFiles: register(DRAFTER) });
  let release;
  const w = watch(s, { script: [answer("Too late.")], hold: new Promise((resolve) => { release = resolve; }) });
  await sendNow(s, "Take your time.");
  await until(() => w.held.length === 1, "the message is running");
  assert.equal(one(barOf(s), "button", "send").disabled, true, "known positive: the message is running");
  await press(s, one(barOf(s), "button", "stop"));
  await free(s);
  release();
  await rest(s);
  assert.ok(!conversationOf(s).some((line) => line.includes("Too late.")), "an answer after Stop is not shown");
  assert.deepEqual(w.github().filter((request) => request.method !== "GET"), []);
  w.stop();
});

// TST-513015 · level: system · module: MOD-prompt-bar · MOD-runtimes
// guards: UC-049; A CANCELLED JOB WRITES NOTHING MORE
// given: a job handed over to GitHub Actions and taken by the run, which the server lists as running
// input: the person's click on Stop
// expect: the CI is asked to cancel the run once; the bar shows cancelled and the record ends cancelled; nothing more is committed to the product after the cancel (the only commit is the record of the hand-over and its end) (flow: UC-049 alternative 5a)
test("alternative 5a: Stop cancels a run in GitHub Actions and commits nothing more", async () => {
  const { s, w, clock, done } = await handedOver();
  const [path, record] = queuedRecord(s);
  s.product.change(path, appendToRecord(record, { part: "taken", at: new Date("2026-10-19T12:00:30Z"), by: RUN_URL }));
  w.runs.push({ id: "7", workflow: "agent-m-jobs.yml", commit: "c0", event: "workflow_dispatch", status: "in_progress", conclusion: null, url: RUN_URL });
  await clock.tick();
  await rest(s);
  await until(() => followingOf(s).includes("State: running"), "the job runs");
  const writes = s.product.writes.length;
  await press(s, one(barOf(s), "button", "stop"));
  await until(() => followingOf(s).includes("State: cancelled"), `the cancel is shown: ${followingOf(s)}`);
  assert.deepEqual(w.cancels, ["7"], "the run is cancelled once");
  assert.match(s.product.files[path], /## End[\s\S]*state: cancelled/);
  assert.equal(s.product.writes.length, writes + 1, "the only commit after the cancel is the end of the record");
  await clock.tick();
  await rest(s);
  assert.equal(s.product.writes.length, writes + 1, "nothing more is written");
  done();
});

// ---------------------------------------------------------------- the answer's edits (6a, 6b), recording (6c) and a restricted source (4e)

const ALIGN = "align UC-007 and UC-008 with the new rule";
const filesDraft = (...files) => ({ files });
const draftOf = (s) => all(s.target, "div", "draft")[0];

// TST-513016 · level: system · module: MOD-prompt-bar · MOD-review-pages
// guards: UC-049; A GENERATED ARTIFACT IS A PROPOSAL; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK
// given: the page of the use case UC-007, and a participant whose answer proposes an edit of UC-007 and of UC-008
// input: Send; Review the draft; the person's click on Discard
// expect: the proposed edits open in the editor as their difference against the current text (the added line of 2b is marked); before the person's decision nothing is written; Discard writes nothing — no commit, no job record, no conversation record — and the draft is gone from the tab (flow: UC-049 main flow (5, 6); UC-049 alternative 6a)
test("main flow (5, 6) and alternative 6a: a proposed edit opens as a difference, and discarding it writes nothing", async () => {
  const s = await scenario({ extraFiles: useCases, answers: [filesDraft(changed("UC-007", UC7_PATH, UC7), changed("UC-008", UC8_PATH, UC8))] });
  await onUseCase(s);
  await send(s, ALIGN);
  await review(s);
  assert.equal(all(s.target, "div", "draft").length, 2, "one draft per file");
  assert.match(draftOf(s).textContent, /2b\. The service fails\./, "the difference shows the added line");
  assert.equal(s.product.writes.length, 0, "a draft alone writes nothing");
  await press(s, namedButton(s.target, "Discard"));
  assert.equal(s.product.writes.length, 0, "Discard writes nothing");
  assert.equal(recordTexts(s).length, 0);
  assert.equal(conversationRecords(s).length, 0);
  assert.equal(keptDraft(s) ?? null, null, "the draft is dropped from the tab");
});

// TST-513017 · level: system · module: MOD-prompt-bar · MOD-review-pages · MOD-artifact-edits
// guards: UC-049; A SAVE IS REFUSED WHEN THE TEXT CHANGED MEANWHILE; UC-018
// given: the draft of UC-007 shown in the editor; another writer then changes UC-007 on the default branch
// input: the person's click on Save
// expect: nothing is written; the page says the file changed, and the edit stays in the editor beside the newer version (flow: UC-049 alternative 6b)
test("alternative 6b: when the file changed while the participant worked nothing is written and the edit stays beside the newer text", async () => {
  const s = await scenario({ extraFiles: useCases, answers: [filesDraft(changed("UC-007", UC7_PATH, UC7))] });
  await onUseCase(s);
  await send(s, "add the failing service");
  await review(s);
  const newer = UC7.replace("1. The author starts.", "1. The author starts the lending.");
  await s.product.change(UC7_PATH, newer);
  await press(s, namedButton(draftOf(s), "Save"));
  assert.equal(s.product.writes.length, 0, "nothing is written");
  assert.match(s.target.textContent, /changed|newer|meanwhile/i, "the page says the text changed");
  assert.ok(s.target.textContent.includes("The service fails.") && s.target.textContent.includes("The author starts the lending."), "the edit stays beside the newer version");
});

// TST-513018 · level: system · module: MOD-prompt-bar · MOD-repository-hosts
// guards: UC-049; A CONVERSATION IS WRITTEN TO A REPOSITORY ONLY WHEN RECORDING IS ON; A RECORDED CONVERSATION IS KEPT WHERE IT WAS HELD; A RECORD IS EVIDENCE, NOT A PROPOSAL; ONE CLICK PER DECISION
// given: the instance records conversations (docs/conversation-recording.md says so); the page is the specification browser of the product akmaier/lending-tool
// input: the bar read; "Hello, what is this?" sent to drafter and answered; a second message sent
// expect: the bar says above the selector that the conversation is recorded; the first Send commits a conversation record docs/conversations/<yyyymmdd>-<hhmm>-<4 hex>.md in the product's repository — not the instance's — as a commit, then the answer is appended to the same record, each message its own section with the participant and its model and the page it was held on; the second message and its answer are appended to the same file, nothing earlier changed; no commit touches the instance's repository; the record is no proposal (no queue entry, no approval) (flow: UC-049 alternative 6c)
test("alternative 6c: with recording on every message is appended to the conversation record of the repository of its page", async () => {
  const s = await scenario({ recording: true, instanceFiles: register(DRAFTER), answers: [{ answer: "It is the specification browser." }, { answer: "Two requirements." }] });
  assert.equal(one(barOf(s), "p", "recording").hidden, false, "the bar says above the selector that the conversation is recorded");
  assert.match(one(barOf(s), "p", "recording").textContent, /recorded in the repository of the page it is held on/);
  const recordsBefore = conversationRecords(s).length;
  await send(s, "Hello, what is this?");
  const records = conversationRecords(s);
  assert.equal(recordsBefore, 0);
  assert.equal(records.length, 1, "one conversation record");
  const [[path, text]] = records;
  assert.match(path, /^docs\/conversations\/\d{8}-\d{4}-[0-9a-f]{4}\.md$/);
  assert.ok(s.product.files[path], "in the repository of the page the conversation is held on");
  assert.ok(!s.instance.files[path], "and not in the instance's");
  assert.ok(text.includes("Hello, what is this?") && text.includes("It is the specification browser."), "the person's message and the answer");
  assert.ok(text.includes("drafter") && text.includes("model: drafter-model"), "with the participant and its model");
  assert.ok(text.includes("Current requirements"), "and the page it was held on");
  assert.ok(s.product.writes.length >= 2, "each message is its own commit");
  await send(s, "How many requirements?");
  const [[again, later]] = conversationRecords(s);
  assert.equal(again, path, "the same record");
  assert.ok(later.startsWith(text.trimEnd()) || later.includes(text.split("\n").slice(0, 8).join("\n")), "nothing earlier changed");
  assert.ok(later.includes("How many requirements?") && later.includes("Two requirements."));
  assert.deepEqual(s.instance.writes.filter((write) => Object.keys(write.files).some((file) => file.startsWith("docs/conversations/"))), [], "the instance holds no part of it");
  assert.equal(proposalWrites(s).length, 0, "the record is no proposal");
});

// TST-513019 · level: system · module: MOD-prompt-bar · MOD-repository-hosts
// guards: UC-049; A CONVERSATION IS WRITTEN TO A REPOSITORY ONLY WHEN RECORDING IS ON
// given: recording is off (no switch file), the page of the product
// input: two messages sent and answered, one of them drafting a change of requirements, then Review the draft and Save
// expect: no message of the conversation is written to any repository — no docs/conversations/ file anywhere, and no text of any message in any commit —; what the author saved is written as an open proposal, and the commit names no message (flow: UC-049 postcondition)
test("postcondition: with recording off only what the author saved is written, and nothing of the conversation", async () => {
  const s = await scenario({ answers: [draft(), draft()] });
  assert.equal(one(barOf(s), "p", "recording").hidden, true, "the bar says nothing of recording");
  await run(s);
  assert.equal(s.product.writes.length, 0, "no write before Save");
  await save(s);
  assert.equal(proposalWrites(s).length, 1, "the saved proposal");
  assert.equal(conversationRecords(s).length, 0);
  const written = [...s.product.writes, ...s.instance.writes].flatMap((write) => [write.message, ...Object.values(write.files)]).join("\n");
  assert.ok(!written.includes(INSTRUCTION), "no message of the conversation is in any commit");
  assert.deepEqual(s.instance.writes, [], "the instance is written nowhere");
});

// TST-513024 · level: system · module: MOD-prompt-bar · MOD-job-runner · MOD-source-register
// guards: UC-049; RESTRICTED CONTENT GOES ONLY WHERE ITS SOURCE PERMITS
// given: the product holds the content of the source SRC-restricted at docs/sources/SRC-restricted/handbook.md (reading: the source's content lies in a folder of the product named by the source); the source's entry says its licence is restricted and its content may go to "this machine" only; tooler works at "Anthropic, USA" and asks for read-file of that path
// input: a message sent to tooler, whose endpoint asks for the file and then answers
// expect: the tool refuses and says why — the result the endpoint receives names the source SRC-restricted and the place "Anthropic, USA" — and does not hold the text of the file; the participant continues (the answer is shown). FINDING: the context the bar prepares a message with names no restricted source (places.sources and places.contents are empty in src/prompt-bar/send.mjs), so nothing is refused and the endpoint receives the text: this case is red on main until the bar gives the tool the places of the sources (flow: UC-049 alternative 4e)
test("alternative 4e: a tool refuses content of a source whose licence does not allow the participant's place", async () => {
  const restricted = ["---", "id: SRC-restricted", "title: A restricted handbook", "kind: document", "authority: informational", "identifier: Handbook", "licence: restricted - internal", "places:", "  - this machine", "content_repository: https://github.com/akmaier/lending-tool", "---",
    "# SRC-restricted A restricted handbook", "", "## Versions", "", "| Version | Date | Edition | Read from | Files |", "|---|---|---|---|---|", "| `1` | 2026-10-13 | fixture | this repository | one file, hashed only |", ""].join("\n");
  const s = await scenario({ instanceFiles: { ...register(TOOLER), "docs/sources/SRC-restricted.md": restricted }, extraFiles: { "docs/sources/SRC-restricted/handbook.md": "RESTRICTED-HANDBOOK-TEXT: never for the USA.\n" }, answers: [{ answer: "x" }] });
  const w = watch(s, { script: [calls({ id: "c1", name: "read-file", args: { path: "docs/sources/SRC-restricted/handbook.md" } }), answer("I could not read it, so I answer without it.")] });
  await sendNow(s, "Summarise the handbook.");
  await free(s);
  const result = w.bodies()[1].messages.at(-1).content;
  assert.match(result, /SRC-restricted/, "the refusal names the source");
  assert.match(result, /Anthropic, USA/, "and the place");
  assert.ok(!result.includes("RESTRICTED-HANDBOOK-TEXT"), "the text of the file is not given");
  assert.ok(conversationOf(s).some((line) => line.includes("without it")), "the participant continues");
  w.stop();
});

// TST-513026 · level: system · module: MOD-prompt-bar · MOD-repository-hosts
// guards: UC-049; A RECORDED CONVERSATION IS KEPT WHERE IT WAS HELD
// given: the instance records conversations; the page is a page of the instance itself (the specification browser without a product)
// input: a message sent to drafter and answered
// expect: the conversation record is in the instance's repository under docs/conversations/ and in no product's (flow: UC-049 alternative 6c)
test("alternative 6c: a conversation held on a page of the instance is recorded in the instance's repository", async () => {
  const s = await scenario({ recording: true, instanceFiles: register(DRAFTER), answers: [{ answer: "ok" }], hash: "#trace/key=specification/ref=main" });
  await send(s, "A message held on the instance's page.");
  const inInstance = Object.entries(s.instance.files).filter(([path]) => path.startsWith("docs/conversations/"));
  assert.equal(inInstance.length, 1);
  assert.ok(inInstance[0][1].includes("A message held on the instance's page."));
  assert.deepEqual(Object.keys(s.product.files).filter((path) => path.startsWith("docs/conversations/")), []);
});

// TST-513027 · level: system · module: MOD-prompt-bar · MOD-workflow-entries · MOD-spec-changes
// guards: UC-049; A GENERATED ARTIFACT IS A PROPOSAL
// given: handy proposes handing over a change of the requirement A LOAN HAS A DUE DATE (the kind change-requirements, whose result waits for the person, and which handy can do); the page of the requirement, whose subject gives the person's own source
// input: Send — no further click —; Review the draft; Save
// expect: UC-049 4a.1: the change runs in this tab at once, its draft is shown for review, nothing is written before Save and no job is queued; Save commits the change as an open proposal — a queue entry with its rationale —, SPEC.md stays as it was and no approval record is written (flow: UC-049 alternative 4a)
test("alternative 4a: a hand-over of a change of requirements runs in the tab without a click, and Save commits an open proposal", async () => {
  const s = await scenario({ instanceFiles: register(DRAFTER, HANDY), answers: [{ answer: "x" }] });
  const w = watch(s, { script: [answer("Handing on.", { handOver: { kind: "change-requirements", works_on: [LOAN], task: "Make the due date visible." } }), { envelope: { draft: draft(), answers: [] } }] });
  await onRequirementPage(s); // the page of the requirement, whose subject gives the person's own source
  await sendNow(s, "Please change this rule.", { participant: "handy" });
  await free(s);
  await until(() => all(barOf(s), "button", "review").length > 0, "the draft of the hand-over is ready");
  assert.equal(all(barOf(s), "button", "queue").length, 0, "no click is asked for");
  assert.equal(s.product.writes.length, 0, "nothing is written before Save");
  assert.equal(w.dispatches.length, 0, "no job is queued");
  await review(s);
  await until(() => all(s.target, "section", "requirements-result").length === 1, `the draft of the requirements: ${s.target.textContent}`);
  await save(s);
  assert.equal(proposalWrites(s).length, 1, "an open proposal is committed");
  assert.ok(!Object.keys(s.product.files).some((path) => path.startsWith("docs/approvals/")), "no approval record is written");
  w.stop();
});
