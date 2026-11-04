// MOD-job-runner's registeredAll: "makes every registration handed to registerLater that is not made yet, each once, in the order handed"; a failed registration is not made, so it stays and is made at the next call.
// Run: node --test tests/job-runner-lazy-registration-retry.test.mjs
//
// Module: MOD-job-runner
// Guards: EVERY PAGE LOADS IN UNDER THREE SECONDS
// Level: unit
//
// The registrations are fixtures that count their calls and register one tool each; nothing reaches the network.

import test from "node:test";
import assert from "node:assert/strict";
import { registerStrategies, registerLater, registeredAll, registered } from "../src/job-runner/registry.mjs";

// TST-1346001 · level: unit · module: MOD-job-runner
// guards: EVERY PAGE LOADS IN UNDER THREE SECONDS
// given: three registrations handed to registerLater in order, the first of which throws at its first call and registers the tool retry-a at its second, the second and third each registering a tool (retry-b, retry-c)
// input: registeredAll, which rejects with the first one's error; then registeredAll again; then registeredAll a third time
// expect: the first call rejects and registered("tools", "retry-a") is false; the second call resolves and retry-a, retry-b and retry-c are registered, the registrations having run in the order a, a, b, c; the third call runs nothing, so no registration has run twice after it was made
test("TST-1346001: a lazy registration that fails is made at the next call, the ones after it follow in order, and a made one is not run again", async () => {
  const calls = [];
  let attempts = 0;
  registerLater(async () => {
    calls.push("a");
    if (++attempts === 1) throw new Error("network error");
    registerStrategies("retry-test", { tools: { "retry-a": async () => "a" } });
  });
  registerLater(async () => { calls.push("b"); registerStrategies("retry-test", { tools: { "retry-b": async () => "b" } }); });
  registerLater(async () => { calls.push("c"); registerStrategies("retry-test", { tools: { "retry-c": async () => "c" } }); });
  await assert.rejects(registeredAll(), /network error/);
  assert.equal(registered("tools", "retry-a"), false);
  await registeredAll();
  assert.deepEqual(["retry-a", "retry-b", "retry-c"].map((name) => registered("tools", name)), [true, true, true],
    "the failed registration was made at the second call and the ones after it followed");
  assert.deepEqual(calls, ["a", "a", "b", "c"]);
  await registeredAll();
  assert.deepEqual(calls, ["a", "a", "b", "c"], "a third call runs nothing: a made registration is not run again");
});
