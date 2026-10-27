// A hand-over the prompt bar runs in this tab keeps its task or is refused — MOD-prompt-bar's send.mjs `whyNot(prepared, offered)`, as
// docs/architecture/MOD-prompt-bar.md states it (Interfaces, startPromptBar; UC-049 4a.1): a hand-over prepared with its task as `instruction`, of a kind that
// takes no instruction, is named with MOD-job-runner's `taskRefusal` finding, so that nothing runs, rather than run without its task. A message of the bar
// (the kind `converse`) and a hand-over of a kind that takes the task are not kept from being sent by it.
// Run: node --test tests/prompt-bar-hand-over-task.test.mjs
//
// Module: MOD-prompt-bar
// Guards: UC-049
// Level: unit
//
// The kinds are those of the catalogue as kindOf reads them. A prepared job is built here with only what whyNot reads — its kind, its parameters, no blocking
// finding and no participant it does not fit —, so that any line whyNot gives comes from the task. Nothing reaches the network.

import test from "node:test";
import assert from "node:assert/strict";
import { kindNames, kindOf } from "../src/job-catalogue/index.mjs";
import { whyNot } from "../src/prompt-bar/send.mjs";

const TASK = "Tell the member the due date, token heron-8048";
const RULE = "THE HAND-OVER NAMES THE TASK IN ITS WORDS";
const preparedOf = (kind, params) => ({ kind, params, blocking: [], notFitting: [] });
const OFFERED = [{ name: "drafter", context: 200000 }];

// TST-8048008 · level: unit · module: MOD-prompt-bar
// guards: UC-049
// given: every kind of the catalogue whose result waits for a person (`review: person`) — those the tab runs a hand-over of —, each prepared with the task as `instruction`; known positives — the message kind converse with the person's words, and change-use-case with the task, give no line
// input: whyNot(prepared, offered) for each
// expect: a kind whose recipes name `instruction` gives no line; any other gives exactly one line, the finding as the bar shows it: "error: the kind <kind> takes no instruction …(UC-049 4a) — … [THE HAND-OVER NAMES THE TASK IN ITS WORDS]"; at least one kind of the catalogue is refused so (propose-items)
test("whyNot — a hand-over run in the tab of a kind that takes no instruction is named and kept from running", async () => {
  for (const name of ["converse", "change-use-case"]) {
    assert.deepEqual(whyNot(preparedOf(await kindOf(name), { instruction: TASK }), OFFERED), [], `known positive: ${name}`);
  }
  const refused = [];
  for (const name of await kindNames()) {
    const kind = await kindOf(name);
    if (kind.participant === "none" || kind.review !== "person") continue;
    const lines = whyNot(preparedOf(kind, { instruction: TASK }), OFFERED);
    if (kind.recipes.some((recipe) => recipe.name === "instruction")) {
      assert.deepEqual(lines, [], `${name} takes the task`);
      continue;
    }
    refused.push(name);
    assert.equal(lines.length, 1, name);
    assert.match(lines[0], new RegExp(`^error: the kind ${name} takes no instruction[^\\n]*UC-049 4a[^\\n]*\\[${RULE}\\]$`), name);
  }
  assert.ok(refused.includes("propose-items"), `propose-items is refused: ${refused.join(", ")}`);
});

// TST-8048009 · level: unit · module: MOD-prompt-bar
// guards: UC-049
// given: propose-items, which takes no instruction, prepared without an instruction, with one of blanks, and with the task
// input: whyNot for each
// expect: no line without an instruction or with blanks — no task is given, so none is dropped —; one line with the task
test("whyNot — no task, no refusal: only a task given to a kind that takes none is refused", async () => {
  const kind = await kindOf("propose-items");
  assert.deepEqual(whyNot(preparedOf(kind, {}), OFFERED), []);
  assert.deepEqual(whyNot(preparedOf(kind, { instruction: "   " }), OFFERED), []);
  assert.equal(whyNot(preparedOf(kind, { instruction: TASK }), OFFERED).length, 1);
});
