// MOD-workflow-entries registers MOD-run-planner's `runStrategies` with the job runner where an entry composes a product (ITM-568), as the accepted text of
// docs/architecture/MOD-workflow-entries.md states it: "composes the shared modules — registering with the job runner the strategies of the services whose kinds may run in CI",
// its Uses naming `MOD-run-planner.runStrategies`. composeProduct (src/workflow-entries/compose.mjs) registers the strategies of the modules that offer them, once for the program.
// Run: node --test tests/workflow-entries-run-strategies.test.mjs
//
// Module: MOD-workflow-entries
// Guards: ONE DEFINITION, THREE DRIVERS; UC-010
// Level: component
//
// The environment is a made-up one, of the form CiEnvironment gives; no checkout is read, no request is made (a fetch that fails the test replaces the real one). Whether a name is registered
// is shown through the runner's own refusal: registering the same recipe under another owner throws DuplicateStrategy naming the first owner. The test states its input and its expected result
// before it runs (given / input / expect); the counter-proof is recorded in the pull request.

import test from "node:test";
import assert from "node:assert/strict";
import { registerStrategies } from "../src/job-runner/index.mjs";
import { composeProduct } from "../src/workflow-entries/compose.mjs";

// TST-568009 · level: component · module: MOD-workflow-entries
// guards: ONE DEFINITION, THREE DRIVERS; UC-010
// given: a product's job-workflow environment, and nothing registered with the job runner yet; a probe that, before composing, registers the name `implementation-inputs` under another owner
// input: composeProduct(env), then registerStrategies("probe", { recipes: { "implementation-inputs": … } })
// expect: before composing the probe's name is free (the same registration is first shown to succeed under a name no module offers); after composing, registering `implementation-inputs` throws DuplicateStrategy { strategy: "implementation-inputs", owners: ["MOD-run-planner", "probe"] }
test("composing a product registers the recipe implementation-inputs under MOD-run-planner — MOD-workflow-entries", async () => {
  const real = globalThis.fetch, calls = [];
  globalThis.fetch = async (...args) => { calls.push(args); throw new Error("composing must make no request"); };
  try {
    registerStrategies("probe", { recipes: { "a-name-no-module-offers": async () => [] } });
    const env = { entry: "onRecordsChanged", service: "github", event: { name: "push", payload: null }, checkout: "/nonexistent/product", repository: "https://github.com/acme/product",
      branch: "main", agentM: { commit: "a".repeat(40) }, token: null, now: new Date("2026-10-16T08:00:00Z"),
      job: { runner: "hosted", productDir: "/nonexistent/product", instanceDir: "/nonexistent/instance", actor: "alice", runUrl: null, tokenName: "AGENT_M_TOKEN", personToken: "ghp_FIXTURE0123456789",
        keys: {}, summaryFile: null } };
    composeProduct(env);
    assert.throws(() => registerStrategies("probe", { recipes: { "implementation-inputs": async () => [] } }),
      (error) => error.name === "DuplicateStrategy" && error.strategy === "implementation-inputs" && JSON.stringify(error.owners) === JSON.stringify(["MOD-run-planner", "probe"]));
  } finally {
    globalThis.fetch = real;
  }
  assert.deepEqual(calls, []);
});
