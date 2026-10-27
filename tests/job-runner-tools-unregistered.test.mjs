// MOD-job-runner's offer of a kind's tools to a model endpoint (ToolUse) in a program that registered only some of them: as docs/architecture/MOD-job-runner.md states it, the
// runner offers "only the tools whose capability the drafter declares, that a program registered, and that the job's parameter `refuses` does not name", so that a browser, which
// registers no tool of MOD-checkout-tools, never offers a model one whose call would fail with UnknownStrategy.
// Run: node --test tests/job-runner-tools-unregistered.test.mjs
//
// Module: MOD-job-runner
// Guards: ONE DEFINITION, THREE DRIVERS; A PARTICIPANT DECLARES ITS CAPABILITIES
// Level: unit
//
// The kind is converse as the catalogue gives it, its tools replaced by read-file — a built-in the runner registers itself — and bash — a tool of tools.md that only a program in
// Node registers (MOD-checkout-tools). This process is the browser's case: nothing registers bash until the known positive does. Nothing reaches the network.

import test from "node:test";
import assert from "node:assert/strict";
import { registerStrategies } from "../src/job-runner/index.mjs";
import { offerTools } from "../src/job-runner/tools.mjs";
import { kindOf } from "../src/job-catalogue/index.mjs";

const DRAFTER = { name: "browser-endpoint", type: "model endpoint", model: "fixture-llm", context: 100000, place: "this machine",
  capabilities: ["draft text", "read the repository", "run code and tests", "use tools"] };
const snapshot = { commit: "c0ffee", paths: ["README.md"], read: async (path) => (path === "README.md" ? "# Fixture\n" : null) };
const context = { params: {}, product: { snapshot }, places: { sources: {}, mailbox: null, contents: [] } };

// TST-2026201 · level: unit · module: MOD-job-runner
// guards: ONE DEFINITION, THREE DRIVERS; A PARTICIPANT DECLARES ITS CAPABILITIES
// given: a kind that names read-file and bash, a model endpoint that declares use tools and the capabilities of both, and a program that registered no strategy `bash`
// input: offerTools for that kind and drafter; then the offer's call of bash and of read-file; then, as the known positive, the same once a strategy bash is registered
// expect: the offer holds read-file alone; its call of bash answers a refusal that bash is not offered, and throws nothing — no UnknownStrategy —; its call of read-file answers README.md's text; once bash is registered, the offer holds read-file and bash
test("TST-2026201: a tool no program registered is not offered, so its call is refused and never fails as UnknownStrategy", async () => {
  const kind = { ...(await kindOf("converse")), tools: ["read-file", "bash"], toolLimit: 5 };
  const offered = await offerTools(kind, DRAFTER, context);
  assert.deepEqual(offered.use.definitions.map((tool) => tool.name), ["read-file"]);
  assert.match(await offered.use.call("bash", { command: "ls" }), /^refused: bash is not offered here/);
  assert.equal(await offered.use.call("read-file", { path: "README.md" }), "# Fixture\n");
  registerStrategies("tests/job-runner-tools-unregistered.test.mjs", { tools: { bash: async () => "ran" } });
  const registered = await offerTools(kind, DRAFTER, context);
  assert.deepEqual(registered.use.definitions.map((tool) => tool.name), ["read-file", "bash"], "known positive: a registered bash is offered");
  assert.equal(await registered.use.call("bash", { command: "ls" }), "ran");
});
