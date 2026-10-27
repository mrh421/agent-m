// A hand-over's task is never dropped silently on the dashboard's side — MOD-runtimes' handOverJob(prepared, route, start, host, head, task, target), as
// docs/architecture/MOD-runtimes.md states it (Interfaces: handOverJob): a hand-over of a kind that takes no instruction — whose recipes do not name MOD-job-runner's
// built-in recipe `instruction` — is refused before anything is written, with the finding MOD-job-runner's `taskRefusal` gives, since its task would reach no prompt
// (UC-049 4a: the hand-over names the task in its words, and the job starts with the task as the workflow's input).
// Run: node --test tests/runtimes-hand-over-task.test.mjs
//
// Module: MOD-runtimes
// Guards: UC-049; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK
// Level: unit
//
// The kinds are those of the catalogue as kindOf reads them, enumerated with kindNames, so that a kind added later is covered by this file without a change to it.
// A kind without a participant (`participant: none`) is not one a hand-over may start: the tool `hand-over` refuses it (MOD-job-runner), so it is left out here. The
// repository server is the fake host of tests/runtimes-hand-over-fixture.mjs, the Bridge a fixture behind the global `fetch`. Nothing reaches the network.

import test from "node:test";
import assert from "node:assert/strict";
import * as runtimes from "../src/runtimes/index.mjs";
import { kindNames, kindOf } from "../src/job-catalogue/index.mjs";
import { finding } from "../src/text-tools/index.mjs";
import { BRIDGE_ROUTE, CI_HOSTED, START, TASK, bridgeNamed, fakeHost, installBridge, preparedOf, restoreFetch } from "./runtimes-hand-over-fixture.mjs";

test.afterEach(restoreFetch);

const NO_ENDPOINT = { endpoint: null, bridge: null };
const RULE = "THE HAND-OVER NAMES THE TASK IN ITS WORDS";
const takesInstruction = (kind) => kind.recipes.some((recipe) => recipe.name === "instruction");

// The kinds a hand-over may start: every kind of the catalogue with a participant.
async function startable() {
  const kinds = [];
  for (const name of await kindNames()) {
    const kind = await kindOf(name);
    if (kind.participant !== "none") kinds.push(kind);
  }
  return kinds;
}

// TST-8048001 · level: unit · module: MOD-runtimes
// guards: UC-049; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK
// given: every kind of the catalogue a hand-over may start, read with kindOf; known positives — implement, propose-tests, run-tests and check-resource take the instruction, and decide-gate does not
// input: handOverJob on the CI route with a task, the prepared job carrying the kind's definition and nothing else that would refuse it
// expect: a kind whose recipes name `instruction` is handed over (one commit, one start); every other kind rejects with name NotStartable and exactly one finding: kind "error", artifact the kind's name, rule "THE HAND-OVER NAMES THE TASK IN ITS WORDS", whose `what` names the kind and "UC-049", valid as MOD-text-tools makes a finding; nothing committed, no workflow started
test("handOverJob — every kind a hand-over may start either takes the instruction or is refused when a task is given", async () => {
  const kinds = await startable();
  const byName = new Map(kinds.map((kind) => [kind.name, kind]));
  for (const name of ["implement", "propose-tests", "run-tests", "check-resource"]) assert.ok(takesInstruction(byName.get(name)), `known positive: ${name} takes the instruction`);
  assert.equal(takesInstruction(byName.get("decide-gate")), false, "known positive: decide-gate takes none");

  for (const kind of kinds) {
    const run = fakeHost({});
    const handing = runtimes.handOverJob(preparedOf({ kind }), CI_HOSTED, START, run.host, run.head(), TASK, NO_ENDPOINT);
    if (takesInstruction(kind)) {
      await handing;
      assert.deepEqual([run.writes.length, run.starts.length], [1, 1], `${kind.name}: handed over`);
      continue;
    }
    await assert.rejects(handing, (error) => {
      assert.equal(error.name, "NotStartable", kind.name);
      assert.equal(error.findings.length, 1, kind.name);
      const [found] = error.findings;
      assert.deepEqual([found.kind, found.artifact, found.rule], ["error", kind.name, RULE], kind.name);
      for (const word of [kind.name, "UC-049"]) assert.ok(found.what.includes(word), `${kind.name}: what names ${word}: ${found.what}`);
      assert.deepEqual(finding(found), found, `${kind.name}: a finding as MOD-text-tools makes one`);
      return true;
    });
    assert.deepEqual([run.writes.length, run.starts.length], [0, 0], `${kind.name}: nothing written or started`);
  }
});

// TST-8048002 · level: unit · module: MOD-runtimes
// guards: UC-049; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK
// given: the kind decide-gate, which takes no instruction; known positive first — the kind run-tests, which takes it, handed over to the same Bridge
// input: handOverJob on the Bridge route with a task
// expect: run-tests is handed over (one request to the Bridge); decide-gate rejects with name NotStartable and the one finding under "THE HAND-OVER NAMES THE TASK IN ITS WORDS"; nothing committed and no request to the Bridge — nothing is queued
test("handOverJob — a kind that takes no instruction queues nothing on a Bridge either", async () => {
  const positive = fakeHost({});
  const reached = installBridge(() => positive.writes.length);
  await runtimes.handOverJob(preparedOf({ kind: await kindOf("run-tests") }), BRIDGE_ROUTE, START, positive.host, positive.head(), TASK, { endpoint: null, bridge: bridgeNamed("lab-pc") });
  assert.ok(reached.requests.length > 0, "known positive: run-tests reaches the Bridge");
  restoreFetch();

  const run = fakeHost({});
  const lab = installBridge(() => run.writes.length);
  await assert.rejects(runtimes.handOverJob(preparedOf({ kind: await kindOf("decide-gate") }), BRIDGE_ROUTE, START, run.host, run.head(), TASK, { endpoint: null, bridge: bridgeNamed("lab-pc") }),
    (error) => error.name === "NotStartable" && error.findings.length === 1 && error.findings[0].rule === RULE);
  assert.deepEqual([run.writes.length, run.starts.length, lab.requests.length], [0, 0, 0], "nothing written, started or handed over");
});
