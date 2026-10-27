// Module: MOD-desktop-shell
// Guards: UC-011; ONE DEFINITION, THREE DRIVERS; A LOCAL AGENT USES THE PERSON'S OWN LOGIN; THE LOCAL BRIDGE REQUIRES A TOKEN
// Level: component
//
// ITM-367: the desktop shell composes the Bridge as a route for its configured agents' jobs.
// The tests exercise the composition seam without starting a native window or a loopback server.

import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import Module from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

function fakeSsh2Module(root) {
  const folder = join(root, "node_modules", "ssh2");
  mkdirSync(folder, { recursive: true });
  writeFileSync(join(folder, "package.json"), JSON.stringify({ name: "ssh2", version: "1.17.0", main: "index.js" }));
  writeFileSync(join(folder, "index.js"), `
    const publicKey = "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIGpvYnMtY29tcG9zaXRpb24tZml4dHVyZQ==";
    const publicBuffer = Buffer.from(publicKey);
    exports.Client = class { on() { return this; } once() { return this; } connect() {} end() {} };
    exports.utils = {
      generateKeyPairSync() { return { private: "fixture-private-key", public: publicKey }; },
      parseKey() { return { type: "ssh-ed25519", getPublicSSH() { return publicBuffer; } }; }
    };
  `);
  assert.equal(existsSync(join(folder, "index.js")), true, "known positive: local ssh2 fixture is present");
  return join(root, "node_modules");
}

async function desktopShellModule(root) {
  process.env.NODE_PATH = fakeSsh2Module(root);
  Module._initPaths();
  return import(`../src/desktop-shell/compose.mjs?itm367=${Date.now()}`);
}

const settings = {
  name: "lab-pc",
  agents: [{ name: "opencode", folder: "/tmp/agent-m-opencode" }],
  products: ["https://github.com/acme/product-a", "https://github.com/acme/product-b"],
  every: 7,
};

// TST-367001 · level: component · module: MOD-desktop-shell
// guards: UC-011; A LOCAL AGENT USES THE PERSON'S OWN LOGIN
// given: desktop settings with the Bridge name, one offered agent with its working folder, two served products and a seven-second interval
// input: composeWatchConfig(settings, instance)
// expect: the watch configuration names the Bridge, passes the offered agents unchanged, converts products to address records, converts seconds to milliseconds and carries the instance address
// Planted fault: passing settings.every through as seconds makes the interval assertion fail.
test("TST-367001: desktop settings become MOD-bridge-jobs watch configuration", async () => {
  const root = mkdtempSync(join(tmpdir(), "agent-m-367-compose-"));
  try {
    const mod = await desktopShellModule(root);
    assert.equal(typeof mod.composeWatchConfig, "function", "failure node: desktop composition exposes its watch configuration");
    assert.deepEqual(mod.composeWatchConfig(settings, "https://github.com/acme/agent-m"), {
      bridgeName: "lab-pc",
      agents: settings.agents,
      products: [{ address: settings.products[0] }, { address: settings.products[1] }],
      every: 7000,
      instance: "https://github.com/acme/agent-m",
    });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// TST-367002 · level: component · module: MOD-desktop-shell
// guards: ONE DEFINITION, THREE DRIVERS
// given: the desktop composition module
// input: bridgeStrategyRegistrations()
// expect: the Bridge registers exactly the sets MOD-desktop-shell's Uses name that modules build: approvals, SPEC changes, artifact edits, source register, reuse facts, resource list,
//   work plans (workStrategies), run planner, test schedule, result records, issue handling and runtimes (routeStrategies) — MOD-product-process' processStrategies is built by no module yet
// Planted fault: leaving sourceStrategies, workStrategies, runStrategies, resultStrategies or routeStrategies out makes the registration list assertion fail.
test("TST-367002: desktop composition names the Bridge-runnable job strategy modules", async () => {
  const root = mkdtempSync(join(tmpdir(), "agent-m-367-strategies-"));
  try {
    const mod = await desktopShellModule(root);
    assert.equal(typeof mod.bridgeStrategyRegistrations, "function", "failure node: desktop composition exposes its strategy registrations");
    assert.deepEqual(mod.bridgeStrategyRegistrations().map(({ owner, name }) => `${owner}.${name}`), [
      "MOD-approvals.approvalStrategies",
      "MOD-spec-changes.specStrategies",
      "MOD-artifact-edits.editStrategies",
      "MOD-source-register.sourceStrategies",
      "MOD-reuse-facts.reuseStrategies",
      "MOD-resource-list.resourceStrategies",
      "MOD-work-plans.workStrategies",
      "MOD-run-planner.runStrategies",
      "MOD-test-schedule.scheduleStrategies",
      "MOD-result-records.resultStrategies",
      "MOD-issue-handling.issueStrategies",
      "MOD-runtimes.routeStrategies",
    ]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// TST-367003 · level: component · module: MOD-desktop-shell
// guards: UC-011; THE LOCAL BRIDGE REQUIRES A TOKEN
// given: a constructed watcher runtime whose start and stop calls are observed, initially not paused
// input: start, start again, pause, resume, resume again, close
// expect: watching starts once, pause stops with reason "pause" without a second start, resume starts once, and close stops with reason "quit"
// Planted fault: not guarding repeated starts makes the duplicate-start assertion fail.
test("TST-367003: desktop composition starts, pauses, resumes and quits Bridge job watching once", async () => {
  const root = mkdtempSync(join(tmpdir(), "agent-m-367-runtime-"));
  try {
    const mod = await desktopShellModule(root);
    assert.equal(typeof mod.createBridgeJobRuntime, "function", "failure node: desktop composition exposes the watching lifecycle");
    const events = [];
    let paused = false;
    const runtime = mod.createBridgeJobRuntime(settings, {
      instance: "https://github.com/acme/agent-m",
      paused: () => paused,
      startWatching: (config) => events.push(["start", config.bridgeName, config.every]),
      stopWatching: async (reason) => events.push(["stop", reason]),
    });
    runtime.start();
    runtime.start();
    await runtime.pause();
    paused = false;
    runtime.resume();
    runtime.resume();
    await runtime.close();
    assert.deepEqual(events, [["start", "lab-pc", 7000], ["stop", "pause"], ["start", "lab-pc", 7000], ["stop", "quit"]]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
