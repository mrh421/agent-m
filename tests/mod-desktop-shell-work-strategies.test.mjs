// Module: MOD-desktop-shell
// Guards: ONE DEFINITION, THREE DRIVERS; UC-011; UC-045
// Level: component
//
// ITM-610: the desktop shell registers MOD-work-plans' `workStrategies`, whose first recipe is `architecture-and-model`, with the job runner of the Bridge, as MOD-desktop-shell's Uses state it
// ("the registry of the Bridge's job runner, filled with the strategies of every kind a Bridge may run: [...] `MOD-work-plans.workStrategies`"). No window and no server is started;
// no request is made (a fetch that fails the test replaces the real one). Whether a name is registered is shown through the runner's own refusal: registering the same recipe under
// another owner throws DuplicateStrategy naming the first owner. The list of the registrations as a whole is TST-367002's.

import assert from "node:assert/strict";
import test from "node:test";
import { registerStrategies } from "../src/job-runner/index.mjs";
import { bridgeStrategyRegistrations, registerBridgeStrategiesOnce } from "../src/desktop-shell/compose.mjs";

// TST-610008 · level: component · module: MOD-desktop-shell
// guards: ONE DEFINITION, THREE DRIVERS; UC-045
// given: the desktop composition module and nothing registered with the job runner yet; a probe that, before the Bridge registers, registers a recipe under a name no module offers
// input: bridgeStrategyRegistrations(), then registerBridgeStrategiesOnce(), then registerStrategies("probe", { recipes: { "architecture-and-model": … } })
// expect: the registrations list MOD-work-plans' workStrategies, whose strategies offer the recipe `architecture-and-model`; registering them all raises no DuplicateStrategy; afterwards registering the recipe architecture-and-model throws DuplicateStrategy { strategy: "architecture-and-model", owners: ["MOD-work-plans", "probe"] }; no request is made
// Planted fault: leaving workStrategies out of the registered list makes the DuplicateStrategy assertion fail.
test("the Bridge registers the recipe architecture-and-model under MOD-work-plans — MOD-desktop-shell", () => {
  const real = globalThis.fetch, calls = [];
  globalThis.fetch = async (...args) => { calls.push(args); throw new Error("registering must make no request"); };
  try {
    registerStrategies("probe", { recipes: { "a-recipe-no-module-offers": async () => [] } });
    const work = bridgeStrategyRegistrations().find(({ owner }) => owner === "MOD-work-plans");
    assert.equal(work?.name, "workStrategies", "failure node: the list names MOD-work-plans.workStrategies");
    assert.equal(typeof work.strategies?.recipes?.["architecture-and-model"], "function");
    assert.doesNotThrow(() => registerBridgeStrategiesOnce());
    assert.throws(() => registerStrategies("probe", { recipes: { "architecture-and-model": async () => [] } }),
      (error) => error.name === "DuplicateStrategy" && error.strategy === "architecture-and-model" && JSON.stringify(error.owners) === JSON.stringify(["MOD-work-plans", "probe"]));
  } finally {
    globalThis.fetch = real;
  }
  assert.deepEqual(calls, []);
});
