// Module: MOD-desktop-shell
import { createRequire } from "node:module";
import { join, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import electron from "electron";
import { installedAgents } from "../agent-processes/index.mjs";
import { listJobs, testAccess } from "../bridge-jobs/index.mjs";
import { readBuild } from "./build.mjs";
import { compose } from "./compose.mjs";
import { createUpdates } from "./updates.mjs";
import { loadSettings, saveSettings, setJumpHost, takeExport } from "./settings.mjs";

let tray;

const option = (arguments_, name) => arguments_.find((value) => value.startsWith(`${name}=`))?.slice(name.length + 1);
const options = (arguments_ = process.argv.slice(2)) => ({ instance: option(arguments_, "--instance"), origin: option(arguments_, "--origin"), dataFolder: option(arguments_, "--data-folder"), port: Number(option(arguments_, "--port") ?? 4711) });
const pagesLocation = (instance) => {
  const [owner, repository] = instance.split("/");
  if (!owner || !repository) throw new TypeError("--instance must be owner/repository.");
  return { hostname: `${owner}.github.io`, pathname: `/${repository}` };
};
const defaultDataFolder = (electron, instance) => {
  const [owner, repository] = instance.split("/");
  return join(electron.app.getPath("appData"), `io.github.${owner}.${repository}.bridge`);
};
const platformName = () => process.platform === "darwin" ? "macos" : process.platform === "win32" ? "windows" : "linux";
const repositoryAddress = (value) => /:\/\//.test(value) || value.startsWith("git@") || value.startsWith("/") ? value : `https://github.com/${value}`;
const sourceRoot = resolve(new URL("../", import.meta.url).pathname);
const ownFile = (pathname, repository) => {
  const prefix = `/${repository}/`;
  if (!pathname.startsWith(prefix)) return null;
  const local = resolve(sourceRoot, pathname.slice(prefix.length));
  return local.startsWith(`${sourceRoot}${sep}`) ? local : null;
};
function registerProtocol(electron, instance) {
  const { hostname, pathname } = pagesLocation(instance);
  electron.protocol.handle("agent-m", async (request) => {
    const url = new URL(request.url);
    if (url.hostname !== hostname) return new Response("Not found", { status: 404 });
    const file = ownFile(url.pathname, pathname.slice(1));
    if (!file) return new Response("Not found", { status: 404 });
    return electron.net.fetch(pathToFileURL(file).href);
  });
  return `agent-m://${hostname}${pathname}/desktop-shell/window.html`;
}
// The updates of a packaged app: electron-updater's autoUpdater and the key built into the app; null for a start from the source folder, which offers no update.
// electron-updater is one of the Bridge build's packages, found as MOD-tunnels finds ssh2. Where it cannot be had the Bridge runs as it is and says so on its Updates view.
function updatesOf(config) {
  if (!config.updateKey) return null;
  try {
    const { autoUpdater } = createRequire(new URL("../bridge-build/package.json", import.meta.url))("electron-updater");
    return createUpdates({ updater: autoUpdater, key: config.updateKey, version: config.version, instance: config.instance });
  } catch (failure) {
    console.error(`The Bridge's updates are not available: ${failure.message}`);
    return null;
  }
}
const show = (window) => { if (window.isMinimized()) window.restore(); window.show(); window.focus(); };

export async function start(electron, supplied = {}) {
  const given = typeof supplied === "string" ? { ...options(), dataFolder: supplied } : { ...options(), ...supplied };
  // A start that names its instance on the command line is a start from the source folder; any other start is the packaged app's.
  const build = given.instance ? null : readBuild(given.resources ?? process.resourcesPath);
  const config = build ? { ...given, instance: build.instance, origin: build.origin, updateKey: build.updateKey, version: build.version } : given;
  config.dataFolder ??= defaultDataFolder(electron, config.instance);
  if (!electron.app.requestSingleInstanceLock()) { electron.app.exit(); return null; }
  electron.protocol.registerSchemesAsPrivileged?.([{ scheme: "agent-m", privileges: { standard: true, secure: true, supportFetchAPI: true } }]);
  await electron.app.whenReady();
  const page = registerProtocol(electron, config.instance);
  const stored = loadSettings(config.dataFolder, { port: config.port });
  let bridge = null, paused = stored.paused, quitting = false, startupFailure = null;
  const updates = updatesOf(config);
  // The first reading of the update feed, at start; the window's Updates view waits for it, and a feed that fails only says so in its state.
  const firstReading = updates ? updates.start().catch(() => {}) : null;
  const noUpdates = { version: config.version ?? null, offer: null, ready: false, refused: "This build offers no update.", error: null };
  const window = new electron.BrowserWindow({ webPreferences: { preload: new URL("./preload.cjs", import.meta.url).pathname, contextIsolation: true, nodeIntegration: false } });
  window.webContents.setWindowOpenHandler(({ url }) => { electron.shell.openExternal(url); return { action: "deny" }; });
  window.webContents.on("will-navigate", (event, url) => { if (!url.startsWith("agent-m://")) { event.preventDefault(); electron.shell.openExternal(url); } });
  const bridgeState = async () => startupFailure ? { failure: startupFailure }
    : ({ address: bridge.address, token: bridge.token, instance: config.instance, paused, pairedWith: bridge.pairedWith(), settings: bridge.settings, publicKey: bridge.key.publicKey, tunnels: await bridge.tunnels() });
  // The enclosure of an offered agent, by its name; and, for each offered agent with a working folder, whether its enclosure works — else why, and the
  // one-time step — and whether the agent is logged in there.
  const enclosureFor = (name) => {
    const offered = (bridge.settings.agents ?? []).find((agent) => agent.name === name && agent.folder);
    if (!offered) throw new TypeError("This Bridge offers no such agent with a working folder.");
    return bridge.enclosures(offered.folder);
  };
  const enclosureStates = async () => {
    const states = {};
    for (const { name, folder } of (bridge.settings.agents ?? []).filter((agent) => agent.folder)) {
      const enclosure = bridge.enclosures(folder), state = await enclosure.works();
      let loggedIn = false;
      if (state.works) {
        await enclosure.prepare({ writable: [], readable: [] });
        loggedIn = (await installedAgents({ enclosure, workdir: folder })).find((agent) => agent.name === name)?.loggedIn === true;
      }
      states[name] = { ...state, loggedIn };
    }
    return states;
  };
  const restart = async () => {
    if (bridge) await bridge.close();
    bridge = await compose({ instance: repositoryAddress(config.instance), origin: config.origin, dataFolder: config.dataFolder, port: config.port, paused: () => paused, version: config.version });
    startupFailure = null;
    return bridgeState();
  };
  electron.ipcMain.handle("bridge-state", async (_event, action, value) => {
    if (!action) return bridgeState();
    // The Updates view (UC-044 7a): the state, the click Download, the second click Install and restart (the window's decision names the running jobs first).
    if (action === "updates") { await firstReading; return updates ? updates.state() : noUpdates; }
    if (action === "check-updates") return updates ? updates.check() : noUpdates;
    if (action === "download-update") return updates ? updates.download() : noUpdates;
    if (action === "install-update") {
      if (!updates) throw new TypeError("This build offers no update.");
      return updates.install(value);
    }
    if (startupFailure) return bridgeState();
    if (action === "agents") return { platform: platformName(), agents: await installedAgents(), selected: bridge.settings.agents, enclosures: await enclosureStates() };
    // The one-time step of an agent's enclosure, where the Bridge can take it (on Windows, through the elevation prompt), and the agent's own login step,
    // in a terminal in its enclosure (ARC-054).
    if (action === "enclosure-setup") return enclosureFor(value?.name).setUp();
    if (action === "agent-login") {
      const agent = (await installedAgents()).find((each) => each.name === value?.name);
      if (!agent?.login) throw new TypeError("This agent names no login step.");
      const [command, ...args] = agent.login.split(" ");
      await enclosureFor(agent.name).openTerminal(command, args);
      return { opened: true };
    }
    if (action === "save-agents") {
      saveSettings(config.dataFolder, { ...bridge.settings, agents: Array.isArray(value?.agents) ? value.agents : [], paused });
      return restart();
    }
    // The jobs this Bridge took and that still run, which the window's Quit names (UC-044 7b).
    if (action === "running-jobs") return { jobs: listJobs().filter((job) => job.state === "running") };
    if (action === "test-access") return { results: await testAccess({ instance: repositoryAddress(config.instance), products: bridge.settings.products }) };
    if (action === "settings") return { settings: bridge.settings };
    if (action === "tunnels") return { publicKey: bridge.key.publicKey, tunnels: await bridge.tunnels() };
    if (action === "save-settings") {
      saveSettings(config.dataFolder, { ...bridge.settings, ...value, paused });
      return restart();
    }
    if (action === "save-jump-host") {
      setJumpHost(config.dataFolder, value);
      return restart();
    }
    if (action === "import-settings") {
      const taken = await takeExport(config.dataFolder, {
        instance: config.instance,
        ownComputer: Boolean(value?.ownComputer),
        bridge: value?.bridge,
        passphrase: value?.passphrase ?? "",
        name: value?.name,
      }, value?.text ?? "");
      if (taken.pairingToken) await bridge.pairAnew(taken.pairingToken);
      paused = taken.paused;
      return { ...(await restart()), taken: { products: taken.products, jumpHost: taken.jumpHost, tunnels: taken.tunnels } };
    }
    throw new TypeError("Unknown Bridge window request.");
  });
  electron.ipcMain.handle("choose-folder", async () => {
    const answer = await electron.dialog.showOpenDialog(window, { properties: ["openDirectory"] });
    return answer.canceled ? null : answer.filePaths[0] ?? null;
  });
  electron.ipcMain.handle("pair-anew", async () => { bridge.token = await bridge.pairAnew(); return bridge.token; });
  electron.ipcMain.handle("copy", (_event, text) => electron.clipboard.writeText(String(text)));
  electron.ipcMain.handle("pause", async () => { paused = true; await bridge.pauseWatching?.(); saveSettings(config.dataFolder, { ...bridge.settings, paused }); return paused; });
  electron.ipcMain.handle("resume", async () => { paused = false; saveSettings(config.dataFolder, { ...bridge.settings, paused }); bridge.resumeWatching?.(); return paused; });
  electron.ipcMain.handle("retry-port", async (_event, port) => {
    config.port = Number(port);
    saveSettings(config.dataFolder, { ...loadSettings(config.dataFolder, { port: config.port }), port: config.port, paused });
    return restart();
  });
  electron.ipcMain.handle("quit", () => electron.app.quit());
  // The tray's Quit: with jobs running, the window shows the decision that names them (the same as its own Quit); with none, the app quits at once.
  const quitFromTray = () => {
    if (listJobs().some((job) => job.state === "running")) { show(window); window.webContents.send("quit-requested"); } else electron.app.quit();
  };
  electron.app.on("second-instance", () => show(window));
  if (process.platform === "linux") {
    window.on("close", (event) => { if (!quitting) event.preventDefault(); });
  } else if (electron.Tray) {
    tray = new electron.Tray(electron.nativeImage.createFromPath(join(sourceRoot, "desktop-shell", "icons", "tray.png")));
    tray.setContextMenu(electron.Menu.buildFromTemplate([{ label: "Open Agent M Bridge", click: () => show(window) }, { label: "Pause", click: () => { paused = true; } }, { label: "Resume", click: () => { paused = false; } }, { label: "Quit", click: () => quitFromTray() }]));
    tray.on("click", () => show(window));
    window.on("close", (event) => { if (!quitting) { event.preventDefault(); window.hide(); } });
  }
  electron.app.on("before-quit", (event) => {
    if (quitting) return;
    quitting = true;
    if (!bridge) return;
    event.preventDefault();
    bridge.close().finally(() => electron.app.exit());
  });
  try { await restart(); }
  catch (failure) { startupFailure = { name: failure.name, message: failure.message, folder: failure.folder ?? null }; }
  await window.loadURL(page);
  return bridge ?? { failure: startupFailure, close: async () => {} };
}

start(electron).catch((failure) => { console.error(failure.message); electron.app?.quit?.(); });
