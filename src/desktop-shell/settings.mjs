// MOD-desktop-shell's private settings file and canonical dashboard-export takeover.

import { chmodSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { hostname } from "node:os";
import { join } from "node:path";
import { bridgeApi } from "../bridge-http/index.mjs";
import { tunnelCommands } from "../bridge-client/index.mjs";
import { readExport } from "../browser-store/index.mjs";

const VERSION = 1;
const SETTINGS_FILE = "settings.json";
const fields = ["agent-m-bridge-settings", "name", "port", "agents", "products", "every", "paused", "jumpHost", "tunnels"];

const keyFile = (dataFolder) => join(dataFolder, "ssh", "id_ed25519");
const fileOf = (dataFolder) => join(dataFolder, SETTINGS_FILE);
const namedError = (name, message) => Object.assign(new Error(message), { name });
const object = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const port = (value) => Number.isInteger(value) && value >= 1 && value <= 65535;
const text = (value) => typeof value === "string" ? value : null;

function defaults(dataFolder, supplied = {}) {
  return {
    "agent-m-bridge-settings": VERSION,
    name: supplied.name ?? hostname(),
    port: supplied.port ?? bridgeApi.defaultPort,
    agents: supplied.agents ?? [],
    products: supplied.products ?? [],
    every: supplied.every ?? 300,
    paused: supplied.paused ?? false,
    jumpHost: supplied.jumpHost ?? null,
    tunnels: supplied.tunnels ?? [],
  };
}

function jumpHostOf(value) {
  if (!object(value)) return null;
  return { hostname: text(value.hostname), user: text(value.user), sshPort: value.sshPort };
}

function agentOf(value) {
  if (!object(value)) return null;
  const name = text(value.name);
  const folder = text(value.folder);
  return name && folder ? { name, folder } : null;
}

function tunnelOf(dataFolder, value) {
  if (!object(value)) return null;
  return {
    direction: value.direction,
    jumpHost: text(value.jumpHost),
    user: text(value.user),
    sshPort: value.sshPort,
    remotePort: value.remotePort,
    bind: value.bind,
    bridgePort: value.bridgePort,
    keyFile: keyFile(dataFolder),
  };
}

function canonical(dataFolder, value) {
  const input = defaults(dataFolder, value);
  for (const field of fields) input[field] = value?.[field] ?? input[field];
  const settings = Object.fromEntries(fields.map((field) => [field, input[field]]));
  settings.jumpHost = jumpHostOf(settings.jumpHost);
  settings.agents = Array.isArray(settings.agents) ? settings.agents.map(agentOf).filter(Boolean) : null;
  settings.products = Array.isArray(settings.products) ? settings.products.filter((item) => typeof item === "string") : null;
  settings.tunnels = Array.isArray(settings.tunnels) ? settings.tunnels.map((plan) => tunnelOf(dataFolder, plan)).filter(Boolean) : null;
  if (settings["agent-m-bridge-settings"] !== VERSION || typeof settings.name !== "string" || !settings.name ||
    !port(settings.port) || !settings.products || !Number.isInteger(settings.every) || settings.every < 1 ||
    typeof settings.paused !== "boolean" || !settings.agents || !settings.tunnels ||
    (settings.jumpHost && (!settings.jumpHost.hostname || !settings.jumpHost.user || !port(settings.jumpHost.sshPort))) ||
    settings.tunnels.some((plan) => !["forward", "reverse"].includes(plan.direction) || !plan.jumpHost || !plan.user ||
      !port(plan.sshPort) || !port(plan.remotePort) || !["127.0.0.1", "::1"].includes(plan.bind) || !port(plan.bridgePort))) {
    throw namedError("InvalidSettings", "Bridge settings are invalid.");
  }
  return settings;
}

// The Bridge's per-user data folder is its user's alone, whether the Bridge created it or found it: the access of the group
// and of others is removed; the user's own access stays as it is, so that a folder the user cannot write is still reported.
function ownFolder(dataFolder) {
  mkdirSync(dataFolder, { recursive: true, mode: 0o700 });
  chmodSync(dataFolder, statSync(dataFolder).mode & 0o700);
}

export function loadSettings(dataFolder, supplied = {}) {
  if (existsSync(dataFolder)) ownFolder(dataFolder);
  if (!existsSync(fileOf(dataFolder))) return canonical(dataFolder, supplied);
  return canonical(dataFolder, JSON.parse(readFileSync(fileOf(dataFolder), "utf8")));
}

// setJumpHost(dataFolder, { hostname, user, sshPort }) — keeps the jump host the person entered in the window (UC-044 6a.1): hostname and SSH user trimmed, the SSH port 22 where none is given. An empty hostname, an
// empty user and a port outside 1 to 65535 are refused with InvalidSettings, and nothing is written. The other settings stay as they are.
export function setJumpHost(dataFolder, value) {
  const hostname = text(value?.hostname)?.trim(), user = text(value?.user)?.trim();
  const sshPort = value?.sshPort === undefined || value.sshPort === null || String(value.sshPort).trim() === "" ? 22 : Number(value.sshPort);
  if (!hostname || !user || !port(sshPort)) throw namedError("InvalidSettings", "The jump host needs a hostname, an SSH user and an SSH port from 1 to 65535.");
  return saveSettings(dataFolder, { ...loadSettings(dataFolder), jumpHost: { hostname, user, sshPort } });
}

export function saveSettings(dataFolder, value) {
  const settings = canonical(dataFolder, value);
  ownFolder(dataFolder);
  writeFileSync(fileOf(dataFolder), JSON.stringify(settings), { encoding: "utf8", mode: 0o600 });
  return settings;
}

function jumpHostBridges(settings) {
  return Object.entries(settings).flatMap(([key, value]) => {
    if (!key.startsWith("bridge:") || !object(value) || !port(value.port)) return [];
    return [{ name: key.slice("bridge:".length), port: value.port, token: text(value.token) }];
  });
}

export async function takeExport(dataFolder, choice, text) {
  const exported = await readExport(text, choice?.passphrase ?? "");
  if (exported.instance !== choice?.instance) throw namedError("WrongInstance", "This settings export belongs to another Agent M instance.");
  const jumpHost = exported.settings["jump-host"] ?? null;
  const bridges = jumpHostBridges(exported.settings);
  const selected = choice?.ownComputer ? bridges : bridges.filter((bridge) => bridge.name === choice?.bridge);
  if (!object(jumpHost) || !selected.length) throw namedError("MissingTunnelSettings", "The export has no selected Bridge-through-jump-host setting and jump host.");

  const previous = loadSettings(dataFolder);
  const localPort = previous.port;
  const key = keyFile(dataFolder);
  const tunnels = selected.map((bridge) => {
    const plans = tunnelCommands(jumpHost, bridge, localPort, { remote: key, local: key }).plans;
    return plans.find((plan) => plan.direction === (choice?.ownComputer ? "forward" : "reverse"));
  });
  const first = selected[0];
  const settings = saveSettings(dataFolder, {
    ...previous,
    name: choice?.ownComputer ? choice?.name ?? previous.name : first.name,
    port: localPort,
    products: exported.settings.products ?? [],
    jumpHost,
    tunnels,
  });
  return { ...settings, pairingToken: choice?.ownComputer ? null : first.token ?? null };
}
