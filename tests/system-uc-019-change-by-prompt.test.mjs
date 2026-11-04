// System coverage for UC-019 Change a specification or a use case by prompt. This guard ties each flow of the accepted use case to
// executable evidence through the prompt bar and the review pages' route `draft` (the tests of ITM-507 and ITM-508 and the flows below),
// or to a finding that names what the code does instead, across the specification browser, the review pages, the prompt bar, the job
// runner, runtime routes and artifact edits.
// Run: node --test tests/system-uc-019-change-by-prompt.test.mjs
//
// Module: MOD-review-pages; MOD-prompt-bar; MOD-artifact-edits; MOD-runtimes
// Guards: UC-019
// Level: system
//
// Authored by developer-sonnet-e (ITM-514), who implemented none of ITM-507, ITM-508 or ITM-551.
// Input: UC-019 as committed text, the executable evidence files named below, and the open page of a use case with the prompt bar.
// Precondition: ITM-504, ITM-506, ITM-507 and ITM-508 are merged.
// Expected result: every flow below is covered by executable evidence that asserts nothing the accepted UC-019 replaced, or is a finding
// - a todo test below, or in the release file named - that fails now and names what the code does instead. The findings:
// the participants offered (UC019-S9) and the count of requirements and use cases when a context is too small (UC019-S10).
//
// The page, the servers and the person's actions are the harness of tests/uc-019-prompt-bar-harness.mjs: the real
// MOD-site-frame, MOD-prompt-bar and MOD-review-pages over GitHub and a drafting endpoint served in memory; no request leaves the process.
// Each test states its input and its expected values in its own text; none reads an expected result from the SPEC, a use case or an
// architecture file. The flow map (TST-377001) takes the use case as its input and holds the expected passages itself.

import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { lineDiff } from "../src/text-tools/index.mjs";
import { buttonsNamed, until } from "./review-pages-draft-world.mjs";
import { LOAN, UC7, UC7_PATH, UC8, UC8_PATH, all, barOf, changed, conversationRecords, goTo, keptDraft, messageLines, namedButton, onUseCase, one, press, recordTexts, rest, review, scenario,
  send, sentText, statusOf, useCaseSection, useCases } from "./uc-019-prompt-bar-harness.mjs";

const ROOT = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, ROOT), "utf8");
const exists = (path) => existsSync(new URL(path, ROOT));
const UC = "docs/use-cases/UC-019-change-a-specification-or-use-case-by-prompt.md";
const SELF = "tests/system-uc-019-change-by-prompt.test.mjs";
const REQUIREMENTS = "tests/system-uc-019-change-requirements-by-prompt.test.mjs";
const HARNESS = "tests/uc-019-prompt-bar-harness.mjs";
const RELEASE_REQUIREMENTS = "tests/release-uc-019-change-requirements-by-prompt.test.mjs";
const DRAFT = "tests/review-pages-conversation-draft.test.mjs";
const SUBJECT = "tests/trace-pages-subject.test.mjs";

const FLOW_EVIDENCE = {
  "1-specification-browser-draft-route": {
    uc: "With a requirement open in the specification browser (UC-020)",
    evidence: [[REQUIREMENTS, "TST-418007"]],
  },
  "4b-specification-browser-source": {
    uc: "the author has no source of their own that the product links",
    evidence: [[REQUIREMENTS, "TST-418008"]],
  },
  "main-1-3-instruction-in-the-prompt-bar": {
    uc: "writes the instruction in the prompt bar (UC-049)",
    evidence: [[SELF, "TST-377004"], [REQUIREMENTS, "TST-418001"], [SUBJECT, "TST-600150"], [SUBJECT, "TST-600151"]],
  },
  "main-4-complete-context": {
    uc: "the use case, every requirement it realises, and every other use case",
    evidence: [["tests/approvals-strategies.test.mjs", "TST-472023"], [SELF, "TST-377004"]],
  },
  "main-5-send": {
    uc: "The author presses **Send**",
    evidence: [[SELF, "TST-377005"]],
  },
  "5a-send-not-pressed": {
    uc: "The author does not press Send",
    evidence: [[SELF, "TST-377005"]],
  },
  "main-6-endpoint-participant-returns-draft": {
    uc: "The drafter returns the changed text",
    evidence: [[DRAFT, "TST-507020"], [SELF, "TST-377004"]],
  },
  "main-7-correction-loop": {
    uc: "The correction loop",
    evidence: [[DRAFT, "TST-507021"], ["tests/specification-and-design-drafting-together.test.mjs", "TST-476060"]],
  },
  "main-8-editor-and-difference": {
    uc: "current text line by line",
    evidence: [[DRAFT, "TST-507020"], ["tests/markdown-render-release-20.test.mjs", "TST-343005"]],
  },
  "main-9-save-records-the-version-not-the-instruction": {
    uc: "never the instruction",
    evidence: [[DRAFT, "TST-507022"], [SELF, "TST-377009"]],
  },
  "4a-context-too-small": {
    uc: "The context does not fit into the chosen drafter",
    evidence: [[SELF, "TST-377006"]],
  },
  "6a-bridge-agent-returns-draft": {
    uc: "The drafter is a CLI session",
    evidence: [["tests/runtimes-bridge.test.mjs", "TST-472698"]],
  },
  "6c-unusable-answer": {
    uc: "The drafter returns nothing usable",
    evidence: [[SELF, "TST-377015"]],
  },
  "7a-findings-left-identifier-restored": {
    uc: "The loop ends with findings left",
    evidence: [[DRAFT, "TST-507021"], ["tests/specification-and-design-drafting-together.test.mjs", "TST-476060"]],
  },
  "7a-findings-left-in-compiler-form": {
    uc: "the remaining findings in the same compiler form",
    evidence: [[RELEASE_REQUIREMENTS, "TST-418126"]],
  },
  "7b-dropped-realises-name-shown-as-diff": {
    uc: "The drafter dropped a name from `realises`",
    evidence: [[SELF, "TST-377003"], ["tests/markdown-render-release-20.test.mjs", "TST-342009"]],
  },
  "8-follow-up-instruction-in-the-prompt-bar": {
    uc: "writes a follow-up instruction in the prompt bar",
    evidence: [[SELF, "TST-377007"]],
  },
  "8-follow-up-repeats-5-to-7-on-the-draft": {
    uc: "which repeats steps 5–7 on the current draft",
    evidence: [[SELF, "TST-377012"]],
  },
  "8b-several-use-cases-each-with-its-difference": {
    uc: "Each file is shown with its own difference",
    evidence: [[DRAFT, "TST-507022"]],
  },
  "8c-discard": {
    uc: "The author discards the draft",
    evidence: [[DRAFT, "TST-507026"]],
  },
  "9a-target-changed": {
    uc: "The target changed while the drafter was drafting",
    evidence: [[DRAFT, "TST-507023"], [DRAFT, "TST-507024"]],
  },
  "7-limit-named-before-the-first-round": {
    uc: "named in the conversation (default 5)",
    evidence: [[RELEASE_REQUIREMENTS, "TST-418125"]],
  },
  "6b-work-handed-to-github-actions": {
    uc: "The work is handed to GitHub Actions",
    evidence: [[SELF, "TST-377008"], [SELF, "TST-377013"]],
  },
  "main-2-offers-only-participants-that-can-draft": {
    uc: "Agent M offers there only those that can draft text",
    evidence: [[SELF, "TST-377010"]],
  },
  "precondition-configured-in-this-browser": {
    uc: "is configured in this browser (UC-049)",
    evidence: [[SELF, "TST-377016"]],
  },
  "3a-nothing-configured-can-draft": {
    uc: "Nothing configured can draft text.",
    evidence: [[SELF, "TST-377016"]],
  },
  "3a-links-uc-003": {
    uc: "links to the configuration of endpoints (UC-003)",
    evidence: [[SELF, "TST-377017"]],
  },
};

// The parts of a flow the code does otherwise, each a todo test that fails now and names what the code does instead.
const FLOW_FINDINGS = {
  "4a-counts-of-requirements-and-use-cases": { uc: "Agent M says how many requirements or use cases there are", finding: "UC019-S10", file: SELF, test: "TST-377011" },
  "4a-counts-in-the-bar": { uc: "Agent M says how many requirements or use cases there are", finding: "UC019-S10", file: RELEASE_REQUIREMENTS, test: "TST-418121" },
};

// TST-377001
// level: system
// module: MOD-review-pages; MOD-artifact-edits; MOD-runtimes
// guards: UC-019
// given: UC-019 as committed text, the executable tests named in FLOW_EVIDENCE and the findings named in FLOW_FINDINGS
// input: compare every main-flow segment and named alternative with its executable evidence or its finding
// expect: every named passage stands in UC-019; every evidence file exists and contains its TST id; every finding's test stands in its file with the todo naming the finding
test("TST-377001: UC-019 system coverage names the main flow and each required alternative", () => {
  const uc = read(UC).replace(/\s+/g, " ");
  for (const [flow, { uc: needle, evidence }] of Object.entries(FLOW_EVIDENCE)) {
    assert.ok(uc.includes(needle), `${flow}: UC-019 contains ${needle}`);
    assert.ok(evidence.length > 0, `${flow}: evidence is named`);
    for (const [file, id] of evidence) {
      assert.ok(exists(file), `${flow}: evidence file exists: ${file}`);
      assert.ok(read(file).includes(id), `${flow}: ${file} contains ${id}`);
    }
  }
  for (const [flow, { uc: needle, finding, file, test: id }] of Object.entries(FLOW_FINDINGS)) {
    assert.ok(uc.includes(needle), `${flow}: UC-019 contains ${needle}`);
    assert.ok(read(file).includes(`// ${id}\n`), `${flow}: ${id} stands in ${file}`);
    assert.ok(read(file).includes(`todo: "FINDING ${finding} `), `${flow}: the todo of ${id} names FINDING ${finding}`);
  }
});

// TST-377002
// level: system
// module: MOD-review-pages; MOD-runtimes
// guards: UC-019
// given: the harness of the system tests and the Bridge evidence file named for UC-019
// input: inspect their fixture boundaries
// expect: the endpoint participant is a fixture behind a replaced fetch that refuses every other origin, and the Bridge path returns a draft from the Bridge
test("TST-377002: UC-019 system evidence includes the fixture endpoint and Bridge routes", () => {
  const harness = read(HARNESS);
  assert.ok(harness.includes("globalThis.fetch = "), "the fetch is replaced");
  assert.ok(harness.includes("https://fixture-endpoint.example.test"), "the endpoint participant is a fixture");
  assert.ok(harness.includes("outside.push"), "a request to any other origin is recorded and refused");

  const bridge = read("tests/runtimes-bridge.test.mjs");
  assert.ok(bridge.includes("from the Bridge"), "the Bridge fixture returns the draft");
  assert.ok(bridge.includes("POST /v1/ask"), "the Bridge driver uses the Bridge ask API");
  assert.ok(bridge.includes("TST-472698"), "the Bridge driver evidence is present");
});

// TST-377003
// level: system
// module: MOD-markdown-render; MOD-text-tools
// guards: UC-019
// given: a current use case that realises two requirements and a draft that drops one of the names
// input: the same line-diff boundary that the dashboard difference uses
// expect: the dropped `realises` name is observable as a removed line, not hidden as a clean unchanged draft
test("TST-377003: UC-019 7b makes a dropped realised name visible in the difference", () => {
  const current = ["---", "id: UC-007", "realises:", "  - A LOAN HAS A DUE DATE", "  - A FINE HAS A REASON", "---", "# UC-007 Loan", ""].join("\n");
  const draft = ["---", "id: UC-007", "realises:", "  - A LOAN HAS A DUE DATE", "---", "# UC-007 Loan", ""].join("\n");
  const diff = lineDiff(current, draft);
  assert.ok(diff.some((line) => line.op === "removed" && line.text === "  - A FINE HAS A REASON"), "the dropped requirement name is highlighted as removed");
  assert.ok(!diff.some((line) => line.op === "added" && line.text.includes("A FINE HAS A REASON")), "the drop is not transformed into a new added name");
});

// ---------------------------------------------------------------- the flows through the prompt bar

const ALIGN = "align UC-007 and UC-008 with the new rule";
const filesDraft = (...files) => ({ files });

// TST-377004
// level: system
// module: MOD-review-pages; MOD-site-frame; MOD-prompt-bar
// guards: UC-019; THE PAGE NAMES WHERE IT SENDS; A PROMPTED USE-CASE CHANGE SEES ITS NEIGHBOURS
// given: the page of UC-007 with UC-007 and UC-008 in the product, and this browser's configuration offering the endpoint drafter (this machine, draft text) and the CLI session release-bridge:observer (Anthropic, USA, read the repository only)
// input: the author writes "align UC-007 and UC-008 with the new rule" in the bar without naming a target, and presses Send with drafter
// expect: before Send the bar names drafter with its place, the only participant that can draft text, and not observer, and nothing has been sent; the one request holds the instruction, the file of UC-007 as the target, the requirement A LOAN HAS A DUE DATE it realises and UC-008 as another use case; the bar names "drafter — this machine" as the destination
test("TST-377004: UC-019 1-3 the instruction is written in the prompt bar and the open use case is the target", async () => {
  const s = await scenario({ extraFiles: useCases, answers: [filesDraft(changed("UC-007", UC7_PATH, UC7), changed("UC-008", UC8_PATH, UC8))] });
  await onUseCase(s);
  assert.equal(one(barOf(s), "span", "participant").textContent, "drafter — this machine");
  assert.equal(all(barOf(s), "option").length, 0, "observer cannot draft text, so there is nothing to choose among");
  assert.equal(s.endpointRequests.length, 0);
  await send(s, ALIGN, { participant: "drafter" });
  assert.equal(s.endpointRequests.length, 1);
  assert.ok(sentText(s).includes(ALIGN));
  const section = useCaseSection(s);
  assert.ok(section.indexOf(`### ${UC7_PATH}`) >= 0 && section.indexOf(`### ${UC8_PATH}`) > section.indexOf(`### ${UC7_PATH}`), "UC-007 is the target, UC-008 another use case");
  assert.ok(section.includes(`### ${LOAN}`), "the requirement UC-007 realises");
  assert.match(statusOf(s).textContent, /^Sent to:drafter — this machine/);
  assert.equal(s.product.writes.length, 0);
});

// TST-377005
// level: system
// module: MOD-prompt-bar; MOD-review-pages
// guards: UC-019; ONE CLICK PER DECISION; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK
// given: the page of UC-007 and an instruction written in the bar
// input: wait without pressing Send; then press Send once
// expect: without Send no request goes to the endpoint and nothing is written; Send makes exactly one request, and still writes nothing
test("TST-377005: UC-019 5 and 5a Send is the decision to send", async () => {
  const s = await scenario({ extraFiles: useCases, answers: [filesDraft(changed("UC-007", UC7_PATH, UC7))] });
  await onUseCase(s);
  one(barOf(s), "textarea", "instruction").value = "add error handling to UC-007";
  await rest(s);
  assert.equal(s.endpointRequests.length, 0, "without Send nothing is sent");
  assert.equal(s.product.writes.length, 0);
  await send(s, "add error handling to UC-007");
  assert.equal(s.endpointRequests.length, 1, "Send makes one request");
  assert.equal(s.product.writes.length, 0);
});

// TST-377006
// level: system
// module: MOD-prompt-bar; MOD-job-runner; MOD-review-pages
// guards: UC-019; NO USE CASE IS LEFT OUT OF A PROMPT SILENTLY
// given: the page of UC-007, the participant drafter whose context holds 1 token, and observer, whose context holds 200000 but which cannot draft text and is not offered
// input: the author writes an instruction and presses Send with drafter
// expect: nothing is sent and nothing is written; the bar says "Nothing was sent." and "drafter does not hold this message: its context holds 1 tokens", and "No offered participant has a larger context."; observer is not offered, so it is not named as one to choose
test("TST-377006: UC-019 4a a context that does not fit sends nothing and names no larger participant where none is offered", async () => {
  const s = await scenario({ extraFiles: useCases, context: 1 });
  await onUseCase(s);
  await send(s, ALIGN, { participant: "drafter" });
  const said = statusOf(s).textContent;
  assert.match(said, /^Nothing was sent\./);
  assert.match(said, /drafter does not hold this message: its context holds 1 tokens, the job needs about \d+\./);
  assert.match(said, /No offered participant has a larger context\./);
  assert.doesNotMatch(said, /observer/);
  assert.equal(s.endpointRequests.length, 0);
  assert.equal(s.product.writes.length, 0);
});

// TST-377007
// level: system
// module: MOD-prompt-bar; MOD-review-pages; MOD-site-frame
// guards: UC-019
// given: the draft of UC-007 and UC-008 on the route draft, with the added alternative flow 2b
// input: the author writes the follow-up "make 2b say what is logged" in the bar and presses Send; the participant answers it with a draft of the same kind (the change kind reads only a draft)
// expect: nothing is written before the author's Save; the follow-up goes to the endpoint on the author's Send only, and the draft as it stands - its added line "2b. The service fails." - is among what the participant is given
test("TST-377007: UC-019 8 a follow-up instruction in the prompt bar goes with the draft as it stands", async () => {
  const s = await scenario({ extraFiles: useCases, answers: [filesDraft(changed("UC-007", UC7_PATH, UC7), changed("UC-008", UC8_PATH, UC8)), filesDraft(changed("UC-007", UC7_PATH, UC7), changed("UC-008", UC8_PATH, UC8))] });
  await onUseCase(s);
  await send(s, ALIGN);
  await review(s);
  assert.equal(all(s.target, "div", "draft").length, 2, "the draft is on the page");
  const asked = s.endpointRequests.length;
  one(barOf(s), "textarea", "instruction").value = "make 2b say what is logged";
  await rest(s);
  assert.equal(s.endpointRequests.length, asked, "the follow-up is not sent before Send");
  await send(s, "make 2b say what is logged");
  assert.equal(s.endpointRequests.length, asked + 1);
  assert.ok(sentText(s, asked).includes("make 2b say what is logged"));
  assert.ok(sentText(s, asked).includes("2b. The service fails."), "the draft as it stands is given with the follow-up");
  assert.equal(s.product.writes.length, 0);
});

// TST-377008
// level: system
// module: MOD-prompt-bar; MOD-review-pages; MOD-runtimes
// guards: UC-019; UC-049; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK
// given: the page of a use case, and a participant whose answer proposes handing a task on
// input: the author presses Send
// expect: the bar shows the proposal with its kind, what it works on and its task; it offers no button *Hand over*, and nothing is queued or written - no job record, no commit
test("TST-377008: UC-019 6b a proposed hand-over is shown and nothing is queued", async () => {
  const proposal = { answer: "This needs a run of the tests.", handOver: { kind: "implement-item", works_on: ["ITM-001"], task: "Run the tests of UC-007." } };
  const s = await scenario({ extraFiles: useCases, answers: [proposal] });
  await goTo(s, `#use-case/product=${encodeURIComponent(s.address)}`);
  await send(s, "run the tests");
  const hand = one(barOf(s), "section", "hand-over");
  assert.match(hand.textContent, /Kind: implement-item/);
  assert.match(hand.textContent, /Works on: ITM-001/);
  assert.match(hand.textContent, /Task: Run the tests of UC-007\./);
  assert.equal(all(barOf(s), "button").filter((button) => /Hand over/.test(button.textContent)).length, 0, "the bar offers no Hand over");
  assert.equal(s.product.writes.length, 0);
  assert.equal(recordTexts(s).length, 0);
});

// TST-377009
// level: system
// module: MOD-review-pages; MOD-artifact-edits; MOD-prompt-bar
// guards: UC-019; AN ARTIFACT RECORDS THE VERSION THAT PRODUCED IT; A CONVERSATION IS WRITTEN TO A REPOSITORY ONLY WHEN RECORDING IS ON
// given: the draft of UC-007 and UC-008 for the instruction "align UC-007 and UC-008 with the new rule", recording off
// input: Review the draft, then press Save
// expect: one commit holds both files as drafted; its message holds Agent-M-Kind: change-use-case, Agent-M-Participant: drafter, Agent-M-Model: fixture-model and Agent-M-Rounds: 1, an Agent-M-Version line, and no line that holds the instruction; no file names the instruction; no job record and no conversation record is written
test("TST-377009: UC-019 9 Save records the participant, model, version and rounds, never the instruction", async () => {
  const s = await scenario({ extraFiles: useCases, answers: [filesDraft(changed("UC-007", UC7_PATH, UC7), changed("UC-008", UC8_PATH, UC8))] });
  await onUseCase(s);
  await send(s, ALIGN);
  await review(s);
  assert.equal(s.product.writes.length, 0, "a draft alone writes nothing");
  await press(s, namedButton(all(s.target, "div", "draft")[0], "Save"));
  assert.equal(s.product.writes.length, 1, "one commit");
  const [write] = s.product.writes;
  assert.deepEqual(Object.keys(write.files), [UC7_PATH, UC8_PATH]);
  const lines = messageLines(write);
  for (const wanted of ["Agent-M-Kind: change-use-case", "Agent-M-Participant: drafter", "Agent-M-Model: fixture-model", "Agent-M-Rounds: 1"]) assert.ok(lines.includes(wanted), `${wanted} in ${write.message}`);
  assert.ok(lines.some((line) => line.startsWith("Agent-M-Version: ")), `a version line in ${write.message}`);
  assert.ok(lines.every((line) => !line.includes(ALIGN) && !line.startsWith("Agent-M-Instruction")), "no line names the instruction");
  assert.ok(Object.values(write.files).every((body) => !body.includes(ALIGN) && !body.includes("Agent-M-")), "no file names the instruction or a trailer");
  assert.equal(recordTexts(s).length, 0);
  assert.equal(conversationRecords(s).length, 0, "recording is off: nothing of the conversation is written");
});

// TST-377014
// level: system
// module: MOD-prompt-bar; MOD-job-runner; MOD-participant-list
// guards: UC-019; A PARTICIPANT DECLARES ITS CAPABILITIES
// given: the page of UC-007, and a participant, observer, that declares only the capability "read repository", beside drafter
// input: the author presses Send
// expect: observer is not offered, so it is not chosen: the message goes to drafter alone ("Sent to:" names drafter and not observer), and the endpoint receives one request
test("TST-377014: UC-019 3a a participant that cannot draft text is not offered, so the message goes to the one that can", async () => {
  const s = await scenario({ extraFiles: useCases, answers: [filesDraft(changed("UC-007", UC7_PATH, UC7))] });
  await onUseCase(s);
  await send(s, ALIGN);
  const said = statusOf(s).textContent;
  assert.match(said, /^Sent to:drafter — this machine/);
  assert.doesNotMatch(said, /observer/);
  assert.equal(s.endpointRequests.length, 1);
});

// TST-377015
// level: system
// module: MOD-prompt-bar; MOD-job-runner; MOD-review-pages
// guards: UC-019; A GENERATED ARTIFACT IS A PROPOSAL
// given: the page of UC-007 and a participant that returns "not an artifact: retained verbatim" at every exchange
// input: the author presses Send
// expect: two exchanges (the answer and its correction); the bar says "The participant's answer could not be read. Nothing was changed." and shows the raw answer folded, exactly "not an artifact: retained verbatim"; it offers no Review the draft; nothing is written
test("TST-377015: UC-019 6c an unusable answer is named, its raw text folded, and nothing is written", async () => {
  const raw = "not an artifact: retained verbatim";
  const s = await scenario({ extraFiles: useCases, answers: [raw] });
  await onUseCase(s);
  await send(s, ALIGN);
  assert.equal(s.endpointRequests.length, 2);
  assert.match(statusOf(s).textContent, /The participant's answer could not be read\. Nothing was changed\./);
  const folded = one(statusOf(s), "details", "raw");
  assert.ok(!folded.open, "the raw answer is folded");
  assert.equal(one(folded, "pre").textContent, raw);
  assert.equal(all(barOf(s), "button", "review").length, 0);
  assert.equal(s.product.writes.length, 0);
  assert.equal(keptDraft(s), null);
});

// ---------------------------------------------------------------- findings: what the code does instead

// TST-377010
// level: system
// module: MOD-prompt-bar; MOD-browser-store
// guards: UC-019
// given: the page of UC-007 in a browser whose configuration holds the endpoint drafter (draft text) and the CLI session release-bridge:observer (it reads the repository only), in an instance whose participant list holds a further model endpoint, listed, that can draft text; then a browser whose configuration holds the observer session only
// input: read what the bar offers; then, in the second browser, put the cursor in the bar's input and read what the page says
// expect: the bar offers drafter only, neither the observer session nor listed, which the participant list holds and this browser does not configure; in the second browser the bar offers no participant and no Send to choose, says that no endpoint or CLI session of this browser can do converse — the bar's one kind — and that it needs "draft text", and does not name the observer
test("TST-377010: UC-019 2 and 3a the bar offers only what this browser configures that can draft text", async () => {
  const rows = read("docs/participants.md").split("\n");
  const listed = `${rows.slice(0, rows.findIndex((line) => line.startsWith("|---")) + 1).join("\n")}\n`
    + "| listed | model endpoint | listed-model | 200000 | - | draft text | this machine | endpoint drafter |\n";
  const s = await scenario({ extraFiles: useCases, instanceFiles: { "docs/participants.md": listed } });
  await onUseCase(s);
  assert.equal(one(barOf(s), "span", "participant").textContent, "drafter — this machine");
  assert.equal(all(barOf(s), "option").length, 0, "the observer session cannot draft text and listed is not configured here: nothing to choose among");
  const none = await scenario({ extraFiles: useCases, drafting: false });
  await onUseCase(none);
  // The bar reads the page's subject when it is used (the input takes focus), so the offer now belongs to the page of the use case.
  one(barOf(none), "textarea", "instruction").dispatchEvent(new Event("focus"));
  await rest(none);
  await rest(none);
  assert.equal(all(barOf(none), "span", "participant").length + all(barOf(none), "select", "participant").length, 0, "nothing is offered");
  const said = barOf(none).textContent;
  assert.match(said, /No endpoint or CLI session of this browser can do converse: it needs draft text\./);
  assert.doesNotMatch(said, /observer/);
});

// TST-377016
// level: system
// module: MOD-prompt-bar; MOD-browser-store
// guards: UC-019
// given: the page of UC-007, a browser whose configuration holds a model endpoint, and an instance whose participant list is empty; then a browser whose configuration holds nothing that can draft text
// input: read what the bar offers
// expect: the bar offers the browser's configured endpoint, named with its place, although the instance's list holds no participant; with nothing configured that can draft text it says that no endpoint or CLI session of this browser can do converse
test("TST-377016: UC-019 precondition and 3a the bar offers what is configured in this browser", async () => {
  const s = await scenario({ extraFiles: useCases, instanceFiles: { "docs/participants.md": "" } });
  await onUseCase(s);
  assert.equal(all(barOf(s), "span", "participant").length + all(barOf(s), "select", "participant").length, 1, "the configured endpoint is offered");
  assert.equal(one(barOf(s), "span", "participant").textContent, "drafter — this machine");
  const none = await scenario({ extraFiles: useCases, drafting: false });
  await onUseCase(none);
  one(barOf(none), "textarea", "instruction").dispatchEvent(new Event("focus"));
  await rest(none);
  await rest(none);
  assert.match(barOf(none).textContent, /No endpoint or CLI session of this browser can do converse/);
});

// TST-377017
// level: system
// module: MOD-prompt-bar
// guards: UC-019
// given: the page of UC-007 in a browser whose configuration holds nothing that can draft text
// input: read the bar's message and press its link
// expect: the link reads "Set up endpoints" and opens the route endpoints, the configuration of endpoints (UC-003), not the route participants
test("TST-377017: UC-019 3a the link opens the configuration of endpoints", async () => {
  const none = await scenario({ extraFiles: useCases, drafting: false });
  await onUseCase(none);
  one(barOf(none), "textarea", "instruction").dispatchEvent(new Event("focus"));
  await rest(none);
  await rest(none);
  assert.equal(buttonsNamed(barOf(none), "Set up participants").length, 0, "the link to participants is gone");
  await press(none, namedButton(barOf(none), "Set up endpoints"));
  assert.match(none.location.hash, /^#endpoints/);
});

// TST-377011
// level: system
// module: MOD-prompt-bar; MOD-job-runner
// guards: UC-019; NO USE CASE IS LEFT OUT OF A PROMPT SILENTLY
// given: the page of UC-007 with UC-007 and UC-008 in the product, and a participant whose context holds 1 token
// input: Send
// expect: the bar says how many use cases and requirements there are and how much fits
test("TST-377011: UC-019 4a the bar says how many requirements and use cases there are", { todo: "FINDING UC019-S10 - the bar says only \"<participant> does not hold this message: its context holds <n> tokens, the job needs about <m>\" and the participant to choose (whyNot in MOD-prompt-bar's send.mjs); it does not say how many requirements or use cases the message holds" }, async () => {
  const s = await scenario({ extraFiles: useCases, context: 1 });
  await onUseCase(s);
  await send(s, ALIGN, { participant: "drafter" });
  assert.match(statusOf(s).textContent, /2 use cases/);
});

// TST-377012
// level: system
// module: MOD-prompt-bar; MOD-review-pages; MOD-site-frame
// guards: UC-019
// given: the draft of UC-007 on the route draft, and a participant that answers a further change as a draft of the same kind
// input: the author writes a follow-up instruction in the bar and presses Send
// expect: the follow-up is a change of the use case again (steps 5 to 7 repeat), and the bar offers *Review the draft* for the newer draft
test("TST-377012: UC-019 8 a follow-up instruction repeats steps 5 to 7 and gives a newer draft", async () => {
  const s = await scenario({ extraFiles: useCases, answers: [filesDraft(changed("UC-007", UC7_PATH, UC7))] });
  await onUseCase(s);
  await send(s, "add error handling to UC-007");
  await review(s);
  await send(s, "make 2b say what is logged");
  assert.equal(all(barOf(s), "button", "review").length, 1, statusOf(s).textContent);
});

// TST-377013
// level: system
// module: MOD-prompt-bar; MOD-runtimes
// guards: UC-019; UC-049; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK; A CONVERSATION IS WRITTEN TO A REPOSITORY ONLY WHEN RECORDING IS ON
// given: the page of a use case with UC-007 and UC-008 in the product, recording off; the participant answers with a hand-over of the kind derive-use-cases — whose result does not wait for the author, so that the tab does not run it (UC-049 4a.2) — on the requirement A LOAN HAS A DUE DATE with the task HANDED_TASK
// input: the author presses Send on MESSAGE — no further click
// expect: the bar shows Kind: derive-use-cases, Works on: the requirement, the task, and no button Hand over; exactly one job record is written, for the kind derive-use-cases on the requirement with the route "ci hosted", and it holds neither the author's message nor the participant's answer nor the words of the task; exactly one start of agent-m-jobs.yml on main carries the task byte for byte, and no conversation record exists
const HANDED_TASK = "Add the alternative flow 2b to UC-007: when the service fails, Agent M reports the error and writes nothing.";
const MESSAGE = "please run the correction loop for this change on GitHub Actions";
const ANSWER = "This is work for GitHub Actions, where the correction loop runs.";
test("TST-377013: UC-019 6b the work the tab does not run is handed to GitHub Actions from the bar, without a further click", async () => {
  const proposal = { answer: ANSWER, handOver: { kind: "derive-use-cases", works_on: [LOAN], task: HANDED_TASK } };
  // This browser's endpoint drafter is called through the Bridge release-bridge and names the CI secret FIXTURE_KEY, so its message goes through the Bridge and its route is "endpoint drafter secret FIXTURE_KEY", which a hand-over takes as "ci hosted"; the product answers its pull requests with [] and records each start of the workflow.
  const s = await scenario({ extraFiles: useCases, answers: [proposal], bridge: true, secret: "FIXTURE_KEY" });
  const starts = [], served = s.product.fetch;
  s.product.fetch = async (url, init = {}) => {
    const method = (init.method ?? "GET").toUpperCase();
    if (method === "GET" && url.pathname === `/repos/${s.repo}/pulls`) return new Response("[]", { status: 200, headers: { "content-type": "application/json" } });
    if (method === "POST" && url.pathname === `/repos/${s.repo}/actions/workflows/agent-m-jobs.yml/dispatches`) { starts.push(JSON.parse(init.body)); return new Response(null, { status: 204 }); }
    return served(url, init);
  };
  await goTo(s, `#use-case/product=${encodeURIComponent(s.address)}`);
  // The bar follows the handed-over job by a poll every 15 seconds until its record has an end; the fixture's record has none, so the test lets that timer not hold the process.
  const setTimer = globalThis.setTimeout;
  globalThis.setTimeout = (callback, delay, ...more) => { const timer = setTimer(callback, delay, ...more); if (delay >= 10000) timer.unref?.(); return timer; };
  try {
    await send(s, MESSAGE, { participant: "drafter" });
    await until(() => recordTexts(s).length > 0 || /Nothing was queued/.test(statusOf(s).textContent), "the hand-over goes on");
    await rest(s);
  } finally { globalThis.setTimeout = setTimer; }
  const hand = one(barOf(s), "section", "hand-over");
  for (const line of ["Kind: derive-use-cases", `Works on: ${LOAN}`, `Task: ${HANDED_TASK}`]) assert.ok(hand.textContent.includes(line), `${line} in ${hand.textContent}`);
  assert.equal(buttonsNamed(barOf(s), "Hand over").length, 0, "no click is asked for");
  const records = recordTexts(s);
  assert.equal(records.length, 1, `one job record: ${statusOf(s).textContent}`);
  for (const line of ["kind: derive-use-cases", "route: ci hosted", `  - ${LOAN}`]) assert.ok(records[0].includes(line), `${line} in ${records[0]}`);
  for (const words of [MESSAGE, ANSWER, HANDED_TASK, "correction loop"]) assert.ok(!records[0].includes(words), `the record holds no ${words}`);
  assert.doesNotMatch(records[0], /^conversation:[ \t]*\S/m, "the record names no conversation");
  assert.equal(s.product.writes.length, 1, "one commit: the job record");
  assert.equal(conversationRecords(s).length, 0, "recording is off: no conversation record");
  assert.equal(starts.length, 1, "the workflow is started once");
  assert.equal(starts[0].ref, "main");
  assert.equal(starts[0].inputs.task, HANDED_TASK, "the task reaches the workflow byte for byte");
  assert.match(starts[0].inputs.job, /^JOB-\d{8}-\d{4}-[0-9a-f]{4}$/);
  assert.ok(Object.keys(s.product.files).includes(`docs/jobs/${starts[0].inputs.job}.md`), "the workflow is started for the job that was recorded");
});
