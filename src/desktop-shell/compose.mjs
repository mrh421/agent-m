// Module: MOD-desktop-shell
import { bridgeApi, pairAnew, serveBridge } from "../bridge-http/index.mjs";
import { jobHandlers, startWatching, stopWatching } from "../bridge-jobs/index.mjs";
import { mailHandlers } from "../mail-protocols/index.mjs";
import { registerStrategies } from "../job-runner/index.mjs";
import * as approvals from "../approvals/index.mjs";
import * as specChanges from "../spec-changes/index.mjs";
import * as artifactEdits from "../artifact-edits/index.mjs";
import * as sourceRegister from "../source-register/index.mjs";
import * as workPlans from "../work-plans/index.mjs";
import * as runPlanner from "../run-planner/index.mjs";
import * as runtimes from "../runtimes/index.mjs";
import { closeTunnels, ensureKey, openTunnels, tunnelHandlers } from "../tunnels/index.mjs";
import { loadSettings } from "./settings.mjs";

const STRATEGIES = [["MOD-approvals", approvals, "approvalStrategies"], ["MOD-spec-changes", specChanges, "specStrategies"],
  ["MOD-artifact-edits", artifactEdits, "editStrategies"], ["MOD-source-register", sourceRegister, "sourceStrategies"],
  ["MOD-work-plans", workPlans, "workStrategies"], ["MOD-run-planner", runPlanner, "runStrategies"], ["MOD-runtimes", runtimes, "routeStrategies"]];
let strategiesRegistered = false;

export function composeJobHandlers(settings) {
  return jobHandlers({ agents: settings.agents ?? [] });
}

export function composeBridgeHandlers(settings) {
  return { jobs: composeJobHandlers(settings), mail: mailHandlers(), tunnels: tunnelHandlers };
}

export function bridgeStrategyRegistrations() {
  return STRATEGIES.filter(([_owner, module, name]) => module[name]).map(([owner, module, name]) => ({ owner, name, strategies: module[name] }));
}

export function registerBridgeStrategiesOnce() {
  if (strategiesRegistered) return;
  strategiesRegistered = true;
  for (const { owner, strategies } of bridgeStrategyRegistrations()) registerStrategies(owner, strategies);
}

export function composeWatchConfig(settings, instance, onSkipped) {
  return {
    bridgeName: settings.name,
    agents: settings.agents ?? [],
    products: (settings.products ?? []).map((address) => ({ address })),
    every: settings.every * 1000,
    instance,
    ...(onSkipped ? { onSkipped } : {}),
  };
}

export function createBridgeJobRuntime(settings, { instance, paused, startWatching, stopWatching, onSkipped }) {
  const config = composeWatchConfig(settings, instance, onSkipped);
  let watching = false;
  const start = () => {
    registerBridgeStrategiesOnce();
    if (watching || paused()) return;
    startWatching(config);
    watching = true;
  };
  const stop = async (reason) => {
    if (!watching) return;
    watching = false;
    await stopWatching(reason);
  };
  return { start, pause: () => stop("pause"), resume: start, close: () => stop("quit") };
}

export async function compose({ instance, origin, dataFolder, port = bridgeApi.defaultPort, paused = () => false, version = null }) {
  const settings = loadSettings(dataFolder, port === 0 ? {} : { port });
  const key = await ensureKey(dataFolder);
  // The pair answer names the Bridge by the settings in force and its release by build.json's version, null for a start without it.
  const bridge = await serveBridge({ host: "127.0.0.1", port: port === 0 ? 0 : settings.port, origin, dataFolder, paused, name: () => settings.name, version },
    composeBridgeHandlers(settings));
  await openTunnels(dataFolder, settings.tunnels, Number(new URL(bridge.address).port));
  const jobs = createBridgeJobRuntime(settings, { instance, paused, startWatching, stopWatching });
  jobs.start();
  return {
    instance,
    origin,
    settings,
    key,
    ...bridge,
    pairAnew: (token = null) => pairAnew(dataFolder, token),
    tunnels: () => tunnelHandlers["GET /v1/tunnels"]().then((answer) => answer.tunnels),
    pauseWatching: () => jobs.pause(),
    resumeWatching: () => jobs.resume(),
    close: async () => { await jobs.close(); await closeTunnels(); await bridge.close(); },
  };
}
