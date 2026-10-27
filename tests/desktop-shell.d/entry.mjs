// The Bridge's app entry, src/desktop-shell/main.mjs, started over a constructed Electron — a helper of the tests of MOD-desktop-shell, no test of its
// own. The constructed Electron is a small object that records what the entry asks of it, opens no window and answers the ipc requests the window makes
// through `handlers`. The Bridge's server is the real one, on loopback. The two modules the shell composes that need packages of the Bridge build are
// replaced by doubles (below). It holds no expected result.
//
// Module: MOD-desktop-shell
// Level: unit

import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

// `import electron from "electron"` of the entry resolves to the constructed Electron of the running case. The two modules the shell
// composes that need packages of the Bridge build — MOD-tunnels (ssh2) and MOD-mail-protocols (imapflow, nodemailer) — are replaced by
// doubles with the same exports: these cases read what the entry does with its resources, and open no tunnel and touch no mailbox.
const ELECTRON = "export default new Proxy({}, { get: (_, name) => globalThis.__agentMEntryElectron?.[name] });";
// electron-updater, of the Bridge build's packages: its `autoUpdater` is the fake a case puts in globalThis.__agentMUpdater.
// The shell requires it as it requires ssh2 (createRequire), so the double is a file of CommonJS.
const UPDATER_FILE = join(mkdtempSync(join(tmpdir(), "agent-m-updater-")), "electron-updater.cjs");
writeFileSync(UPDATER_FILE, "module.exports = { get autoUpdater() { return globalThis.__agentMUpdater; } };");
// node:https, whose `get` a case may put in globalThis.__agentMHttpsGet (the update feed's reading); without one it is the real one.
const HTTPS = 'import * as real from "node:https"; export const get = (...given) => (globalThis.__agentMHttpsGet ?? real.get)(...given); export default { ...real, get };';
const DOUBLES = {
  "/src/tunnels/index.mjs": `export const ensureKey = async () => ({ publicKey: "ssh-ed25519 AAAA double", fingerprint: "SHA256:double" });
    export const openTunnels = async () => {}; export const closeTunnels = async () => {}; export const tunnelState = () => [];
    export const tunnelHandlers = { "GET /v1/tunnels": async () => ({ tunnels: [] }) };`,
  "/src/mail-protocols/index.mjs": "export const mailHandlers = () => ({});",
  // MOD-agent-enclosure needs a Seatbelt, bubblewrap or a second account, which a CI runner has not; its double starts the fixture agents as they are.
  // What the enclosure does is tests/agent-enclosure.test.mjs's.
  "/src/agent-enclosure/index.mjs": `export const agentEnclosure = ({ folder }) => ({ home: folder + "/home", works: async () => ({ works: true }), prepare: async () => {},
    setUp: async () => ({ done: true, reason: null }), openTerminal: async () => {}, wrap: (command, args) => ({ command, args, env: { ...process.env }, input: null }) });`,
};
const moduleUrl = (source) => `data:text/javascript,${encodeURIComponent(source)}`;
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === "electron") return { url: moduleUrl(ELECTRON), shortCircuit: true };
    if (specifier === "node:https" && !context.parentURL?.startsWith("data:")) return { url: moduleUrl(HTTPS), shortCircuit: true };
    if (specifier === "electron-updater") return { url: pathToFileURL(UPDATER_FILE).href, shortCircuit: true };
    const resolved = next(specifier, context);
    const double = Object.entries(DOUBLES).find(([tail]) => resolved.url.endsWith(tail));
    return double ? { url: moduleUrl(double[1]), shortCircuit: true } : resolved;
  },
});

export const TOKEN_HEADER = "x-agent-m-bridge-token";
export const temporary = () => mkdtempSync(join(tmpdir(), "agent-m-entry-"));

function constructedElectron(appData) {
  const exits = [];
  const handlers = {};
  const record = { trays: [], windows: [], loadedUrl: null, quits: 0, exits, appEvents: {}, sent: [], shown: 0 };
  let settle;
  const outcome = new Promise((resolve) => { settle = resolve; });
  record.outcome = outcome;
  class Tray {
    constructor(image) { this.image = image; record.trays.push(this); }
    setContextMenu(menu) { this.menu = menu; }
    on() {}
  }
  class BrowserWindow {
    constructor() { this.webContents = { setWindowOpenHandler() {}, on() {}, send: (...message) => { record.sent.push(message); } }; record.windows.push(this); }
    on() {}
    isMinimized() { return false; }
    show() { record.shown += 1; } focus() {} restore() {} hide() {}
    async loadURL(url) { record.loadedUrl = url; settle({ kind: "loaded", url }); }
  }
  Object.assign(record, {
    app: {
      requestSingleInstanceLock: () => true,
      whenReady: async () => {},
      getPath: (name) => { assert.equal(name, "appData"); return appData; },
      on: (name, handler) => { record.appEvents[name] = handler; },
      quit: () => { record.quits += 1; settle({ kind: "quit" }); },
      exit: () => { exits.push(true); record.exited?.(); },
    },
    protocol: { registerSchemesAsPrivileged() {}, handle() {} },
    ipcMain: { handle: (name, handler) => { handlers[name] = handler; } },
    handlers,
    shell: { openExternal() {} },
    BrowserWindow,
    Tray,
    Menu: { buildFromTemplate: (template) => ({ template }) },
    nativeImage: { createFromPath: (path) => ({ path }) },
  });
  record.exited = null;
  record.whenExited = new Promise((resolve) => { record.exited = resolve; });
  return record;
}

let counter = 0;
// Starts the entry as Electron would: with these command-line arguments and this resources folder. Resolves with what the
// entry did — it loaded its window, or it asked to quit — together with what it printed as an error.
export async function startEntry({ resources, argv = [], appData, platform = null }) {
  const fake = constructedElectron(appData);
  const errors = [];
  const savedPlatform = Object.getOwnPropertyDescriptor(process, "platform");
  if (platform) Object.defineProperty(process, "platform", { configurable: true, value: platform });
  const saved = { argv: process.argv, resourcesPath: process.resourcesPath, error: console.error };
  globalThis.__agentMEntryElectron = fake;
  process.argv = [process.argv[0], "src/desktop-shell/main.mjs", ...argv];
  process.resourcesPath = resources;
  console.error = (...parts) => { errors.push(parts.join(" ")); };
  try {
    counter += 1;
    await import(`../../src/desktop-shell/main.mjs?case=${counter}`);
    const outcome = await Promise.race([fake.outcome, new Promise((_, reject) => setTimeout(() => reject(new Error("The entry neither loaded its window nor asked to quit.")), 5000))]);
    return { fake, outcome, errors };
  } finally {
    if (platform) Object.defineProperty(process, "platform", savedPlatform);
    process.argv = saved.argv; process.resourcesPath = saved.resourcesPath; console.error = saved.error;
  }
}

export async function stopEntry(started) {
  if (started.outcome.kind !== "loaded") return;
  started.fake.appEvents["before-quit"]({ preventDefault() {} });
  await started.fake.whenExited;
}

export const bridgeAsks = (port, origin, token) => fetch(`http://127.0.0.1:${port}/v1/pair`, { headers: { origin, ...(token ? { [TOKEN_HEADER]: token } : {}) } });
export const refused = async (port) => { try { await fetch(`http://127.0.0.1:${port}/v1/pair`); return false; } catch { return true; } };
export const bridgeSettings = (port) => ({ name: "lab", port, agents: [], products: [], every: 300, paused: true, jumpHost: null, tunnels: [] });

