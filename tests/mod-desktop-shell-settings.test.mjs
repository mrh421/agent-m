// Module: MOD-desktop-shell
// Guards: UC-003; UC-044; THE BRIDGE IS CONFIGURED IN ITS WINDOW OR FROM AN EXPORT; THE BRIDGE OPENS ITS TUNNELS ITSELF; THE BRIDGE CREATES ITS OWN SSH KEY
// Level: unit

import test from "node:test";
import assert from "node:assert/strict";
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import Module from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { exportSettings } from "../src/browser-store/index.mjs";
import { loadSettings, saveSettings, takeExport } from "../src/desktop-shell/settings.mjs";
import { ssh2NodePath } from "./ssh2-fixture.mjs";

const jumpHost = { hostname: "jump.example.test", user: "bridge", sshPort: 2222, portRange: [40100, 40199], login: { user: "web", password: "must-not-persist" } };
const bridge = { port: 4111, token: "paired-token" };
const folder = () => mkdtempSync(join(tmpdir(), "agent-m-291-settings-"));
const settingsFile = (dataFolder) => join(dataFolder, "settings.json");
const ssh2Cache = join(tmpdir(), "agent-m-291-desktop-settings-ssh2-1.17.0");
let sshRuntimeFailure;

function plainExport(settings, instance = "example/agent-m") {
  return JSON.stringify({ "agent-m-settings": 1, instance, exported: "2026-10-13T00:00:00.000Z", locked: false, foreign: {}, settings });
}

function sshRuntime() {
  if (sshRuntimeFailure) throw sshRuntimeFailure;
  try {
    return ssh2NodePath(ssh2Cache);
  } catch (failure) { sshRuntimeFailure = failure; throw failure; }
}

async function composeForTest() {
  process.env.NODE_PATH = sshRuntime();
  Module._initPaths();
  return import("../src/desktop-shell/compose.mjs");
}

// TST-291001 · level: unit · module: MOD-desktop-shell
// guards: THE BRIDGE IS CONFIGURED IN ITS WINDOW OR FROM AN EXPORT
// given: a fresh controlled Bridge data folder and bounded manual settings with browser-only secrets beside them
// input: saveSettings then loadSettings through the public desktop settings interface
// expect: only the canonical private settings fields persist and restart reads those same bytes
// Planted fault: persisting jump-host login or an endpoint key makes the key-set and jump-host assertions fail.
test("TST-291001: MOD-desktop-shell saves bounded private settings", () => {
  const dataFolder = folder();
  try {
    const settings = saveSettings(dataFolder, {
      name: "lab", port: 4711, agents: [{ name: "codex", folder: "/tmp/codex" }], products: ["https://github.com/example/product"], every: 120,
      paused: true, jumpHost,
      tunnels: [{ direction: "reverse", jumpHost: jumpHost.hostname, user: jumpHost.user, sshPort: jumpHost.sshPort, remotePort: 4111, bind: "127.0.0.1", bridgePort: 4711, keyFile: "foreign-key", password: "must-not-persist" }],
      repositoryToken: "must-not-persist", endpoint: "must-not-persist", mailbox: "must-not-persist", signIn: "must-not-persist",
    });
    const disk = JSON.parse(readFileSync(settingsFile(dataFolder), "utf8"));
    assert.deepEqual(settings, disk, "failure node: settings writer returns exactly the persisted private contract");
    assert.deepEqual(Object.keys(disk).sort(), ["agent-m-bridge-settings", "agents", "every", "jumpHost", "name", "paused", "port", "products", "tunnels"], "failure node: persisted settings exclude browser and mail secrets");
    assert.deepEqual(disk.jumpHost, { hostname: jumpHost.hostname, user: jumpHost.user, sshPort: jumpHost.sshPort }, "failure node: only the Bridge jump-host fields persist");
    assert.equal(disk.tunnels[0].keyFile, join(dataFolder, "ssh", "id_ed25519"));
    assert.deepEqual(loadSettings(dataFolder), disk, "failure node: restart reads the canonical persisted settings");
  } finally { rmSync(dataFolder, { recursive: true, force: true }); }
});

// TST-1238001 · level: unit · module: MOD-desktop-shell
// guards: THE BRIDGE IS CONFIGURED IN ITS WINDOW OR FROM AN EXPORT
// given: a Bridge data folder that already exists with mode 755 (skipped on Windows, where modes do not apply)
// input: loadSettings(dataFolder) through the public desktop settings interface, as the Bridge reads its settings at start
// expect: the data folder has mode 700 afterwards, readable and writable by its user only
// Planted fault: giving mode 700 only to a folder the Bridge creates leaves the found folder at 755 and fails the mode assertion.
test("TST-1238001: MOD-desktop-shell makes an existing data folder its user's alone when it reads its settings", { skip: process.platform === "win32" ? "file modes do not apply on Windows" : false }, () => {
  const dataFolder = folder();
  try {
    chmodSync(dataFolder, 0o755);
    assert.equal(statSync(dataFolder).mode & 0o777, 0o755, "precondition: the found data folder is 755");
    loadSettings(dataFolder);
    assert.equal(statSync(dataFolder).mode & 0o777, 0o700, "failure node: loadSettings leaves a found data folder readable by others");
  } finally { rmSync(dataFolder, { recursive: true, force: true }); }
});

// TST-291002 · level: unit · module: MOD-desktop-shell
// guards: UC-044; THE BRIDGE OPENS ITS TUNNELS ITSELF
// given: a matching plain canonical export with one named bridge through the jump host and browser-only secrets
// input: takeExport selects that named Bridge for this desktop Bridge
// expect: the reverse plan keeps remote port 4111 and loopback bridge port 4711 while secrets stay out of settings
// Planted fault: reading remote-session instead of bridge:<name> makes this import report MissingTunnelSettings.
test("TST-291002: MOD-desktop-shell imports a named Bridge-through-jump-host entry as one reverse plan", async () => {
  const dataFolder = folder();
  try {
    saveSettings(dataFolder, { name: "manual", port: 5511, products: [], every: 123, paused: true, jumpHost: null, tunnels: [] });
    const text = plainExport({
      products: ["https://github.com/example/product"], "jump-host": jumpHost, "bridge:lab": bridge, "bridge:direct": { address: "http://127.0.0.1:4711", token: "direct-token" },
      "github-token": { token: "must-not-persist" }, "endpoint:openai": { key: "must-not-persist" }, "mailbox": { imap: { password: "must-not-persist" } },
    });
    const taken = await takeExport(dataFolder, { instance: "example/agent-m", ownComputer: false, bridge: "lab" }, text);
    assert.deepEqual(taken.products, ["https://github.com/example/product"]);
    assert.equal(taken.name, "lab");
    assert.equal(taken.port, 5511, "failure node: import preserves the existing local Bridge API port");
    assert.equal(taken.paused, true, "failure node: import preserves the current explicit pause state");
    assert.equal(taken.pairingToken, "paired-token");
    assert.deepEqual(taken.tunnels, [{ direction: "reverse", jumpHost: jumpHost.hostname, user: jumpHost.user, sshPort: jumpHost.sshPort, remotePort: 4111, bind: "127.0.0.1", bridgePort: 5511, keyFile: join(dataFolder, "ssh", "id_ed25519") }], "failure node: named Bridge choice takes its reverse plan only");
    assert.deepEqual(Object.keys(JSON.parse(readFileSync(settingsFile(dataFolder), "utf8"))).sort(), ["agent-m-bridge-settings", "agents", "every", "jumpHost", "name", "paused", "port", "products", "tunnels"], "failure node: import persists only the Bridge contract");
  } finally { rmSync(dataFolder, { recursive: true, force: true }); }
});

// TST-291003 · level: unit · module: MOD-desktop-shell
// guards: THE BRIDGE IS CONFIGURED IN ITS WINDOW OR FROM AN EXPORT
// given: existing persisted Bridge settings and a complete export for a different instance
// input: takeExport reads the foreign export for this instance
// expect: WrongInstance is named before the persisted settings change
// Planted fault: moving the write before the instance check changes the settings bytes and fails this case.
test("TST-291003: MOD-desktop-shell refuses a foreign instance before writing", async () => {
  const dataFolder = folder();
  try {
    saveSettings(dataFolder, { name: "before", port: 4711, products: [], every: 300, paused: false, jumpHost: null, tunnels: [] });
    const before = readFileSync(settingsFile(dataFolder));
    await assert.rejects(takeExport(dataFolder, { instance: "example/agent-m", ownComputer: true }, plainExport({}, "other/instance")), { name: "WrongInstance" });
    assert.deepEqual(readFileSync(settingsFile(dataFolder)), before, "failure node: rejected foreign export leaves persisted settings byte-identical");
  } finally { rmSync(dataFolder, { recursive: true, force: true }); }
});

// TST-291004 · level: unit · module: MOD-desktop-shell
// guards: UC-044; THE BRIDGE IS CONFIGURED IN ITS WINDOW OR FROM AN EXPORT
// given: a locked matching canonical export with one Bridge through the jump host and a passphrase held only in memory
// input: takeExport selects the person's own computer, then reads the same export with a wrong passphrase
// expect: the own-computer choice takes its forward plan only and the wrong passphrase names WrongPassphrase
// Planted fault: retaining the export's token for own-computer mode makes the pairing-token assertion fail.
test("TST-291004: MOD-desktop-shell reads a locked own-computer export as one forward plan", async () => {
  const dataFolder = folder();
  try {
    const encrypted = await exportSettings({
      prefix: "agent-m:example/agent-m:", storage: new MapStorage({ products: ["https://github.com/example/product"], "jump-host": jumpHost, "bridge:lab": bridge }),
    }, "correct passphrase");
    const taken = await takeExport(dataFolder, { instance: "example/agent-m", ownComputer: true, passphrase: "correct passphrase" }, encrypted);
    assert.equal(taken.pairingToken, null, "failure node: own-computer import does not rotate pairing to a remote Bridge token");
    assert.deepEqual(taken.tunnels, [{ direction: "forward", jumpHost: jumpHost.hostname, user: jumpHost.user, sshPort: jumpHost.sshPort, remotePort: 4111, bind: "127.0.0.1", bridgePort: 4711, keyFile: join(dataFolder, "ssh", "id_ed25519") }], "failure node: own-computer choice takes each Bridge-through-jump-host forward plan only");
    await assert.rejects(takeExport(dataFolder, { instance: "example/agent-m", ownComputer: true, passphrase: "wrong passphrase" }, encrypted), { name: "WrongPassphrase" });
  } finally { rmSync(dataFolder, { recursive: true, force: true }); }
});

// TST-291005 · level: unit · module: MOD-desktop-shell
// guards: UC-003; THE LOCAL BRIDGE BINDS TO LOOPBACK ONLY; THE BRIDGE IS CONFIGURED IN ITS WINDOW OR FROM AN EXPORT
// given: a fresh controlled Bridge folder, a real pinned ssh2 runtime, and the production composition entry
// input: compose requests its established ephemeral listener port 0, then persisted settings are asked to save port 0
// expect: compose listens on an assigned loopback port while persisted settings still reject port 0 as invalid
// Planted fault: passing port 0 into persisted settings makes the final InvalidSettings assertion fail.
test("TST-291005: MOD-desktop-shell keeps ephemeral compose port separate from persisted settings", async () => {
  const dataFolder = folder();
  try {
    const { compose } = await composeForTest();
    const bridge = await compose({ instance: "example/agent-m", origin: "https://example.github.io", dataFolder, port: 0 });
    try {
      assert.match(bridge.address, /^http:\/\/127\.0\.0\.1:(?!4711$)\d+$/, "failure node: composition gives port 0 only to the loopback listener");
      assert.equal(bridge.settings.port, 4711, "composition retains the validated persisted default");
      assert.throws(() => saveSettings(dataFolder, { ...bridge.settings, port: 0 }), { name: "InvalidSettings" }, "persisted port 0 remains invalid");
    } finally { await bridge.close(); }
  } finally { rmSync(dataFolder, { recursive: true, force: true }); }
});

// TST-291007 · level: component · module: MOD-desktop-shell
// guards: UC-044; THE BRIDGE OPENS ITS TUNNELS ITSELF; THE BRIDGE CREATES ITS OWN SSH KEY
// given: persisted desktop settings with one canonical reverse tunnel plan, a pinned ssh2@1.17.0 loopback jump host, and the production compose entry
// input: compose starts the Bridge, opens the stored tunnel, and the authenticated tunnel-state route is fetched through the forwarded reverse listener
// expect: the forwarded route reports the actual open tunnel state, then compose.close clears runtime tunnel state and closes the server lifecycle
// Planted fault: omitting openTunnels from compose.mjs leaves the tunnel state empty and the forwarded route unreachable.
test("TST-291007: MOD-desktop-shell compose opens persisted tunnel plans through the real runtime", () => {
  const dataFolder = folder();
  const settingsSource = new URL("../src/desktop-shell/settings.mjs", import.meta.url).href;
  const composeSource = new URL("../src/desktop-shell/compose.mjs", import.meta.url).href;
  const bridgeHttpSource = new URL("../src/bridge-http/index.mjs", import.meta.url).href;
  const script = `
    import { createRequire } from "node:module";
    import net from "node:net";
    const require = createRequire(import.meta.url);
    const { Server, utils } = require("ssh2");
    const { saveSettings } = await import(${JSON.stringify(settingsSource)});
    const { compose } = await import(${JSON.stringify(composeSource)});
    const { bridgeApi } = await import(${JSON.stringify(bridgeHttpSource)});
    const listen = (server) => new Promise((resolve, reject) => server.listen(0, "127.0.0.1", (error) => error ? reject(error) : resolve(server.address().port)));
    const close = (server) => server ? new Promise((resolve) => server.close(resolve)) : Promise.resolve();
    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const reserveBridge = net.createServer();
    const bridgePort = await listen(reserveBridge);
    await close(reserveBridge);
    const reserveRemote = net.createServer();
    const remotePort = await listen(reserveRemote);
    await close(reserveRemote);
    let remote;
    const ssh = new Server({ hostKeys: [utils.generateKeyPairSync("rsa", { bits: 2048 }).private] }, (client) => {
      client.on("error", () => {});
      client.on("authentication", (context) => context.accept());
      client.on("request", async (accept, reject, name, info) => {
        if (name !== "tcpip-forward") return reject();
        remote = net.createServer((socket) => client.forwardOut(info.bindAddr, info.bindPort, socket.remoteAddress, socket.remotePort, (error, stream) => {
          if (error) return socket.destroy(error);
          socket.pipe(stream).pipe(socket);
        }));
        await new Promise((resolve, rejectListen) => remote.listen(info.bindPort, info.bindAddr, (error) => error ? rejectListen(error) : resolve()));
        accept();
      });
    });
    const sshPort = await listen(ssh);
    saveSettings(process.argv[1], {
      name: "desktop-bridge",
      port: bridgePort,
      agents: [],
      products: [],
      every: 300,
      paused: false,
      jumpHost: { hostname: "127.0.0.1", user: "fixture", sshPort },
      tunnels: [{ direction: "reverse", jumpHost: "127.0.0.1", user: "fixture", sshPort, remotePort, bind: "127.0.0.1", bridgePort }],
    });
    const bridge = await compose({ instance: "example/agent-m", origin: "https://owner.github.io", dataFolder: process.argv[1] });
    try {
      for (let attempt = 0; attempt < 80 && (await bridge.tunnels())[0]?.state !== "open"; attempt += 1) await wait(10);
      const openState = (await bridge.tunnels())[0];
      const response = await fetch("http://127.0.0.1:" + remotePort + "/v1/tunnels", { headers: { Origin: "https://owner.github.io", [bridgeApi.tokenHeader]: bridge.token } });
      const body = await response.json();
      await bridge.close();
      const closedState = await bridge.tunnels();
      await close(remote);
      await close(ssh);
      if (openState?.state !== "open" || response.status !== 200 ||
        JSON.stringify(body) !== JSON.stringify({ tunnels: [{ name: "reverse:127.0.0.1:" + remotePort, kind: "reverse", state: "open", reason: null }] }) ||
        closedState.length !== 0) throw Error(JSON.stringify({ openState, status: response.status, body, closedState }));
      console.log("desktop-compose-reverse-positive");
    } catch (error) {
      try { await bridge.close(); } catch {}
      try { await close(remote); } catch {}
      try { await close(ssh); } catch {}
      throw error;
    }
  `;
  try {
    const result = spawnSync(process.execPath, ["--input-type=module", "-e", script, dataFolder], { encoding: "utf8", timeout: 40_000, env: { ...process.env, NODE_PATH: sshRuntime() } });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /desktop-compose-reverse-positive/);
  } finally { rmSync(dataFolder, { recursive: true, force: true }); }
});

class MapStorage {
  #entries;
  constructor(values) { this.#entries = Object.entries(values).map(([key, value]) => [`agent-m:example/agent-m:${key}`, JSON.stringify(value)]); }
  get length() { return this.#entries.length; }
  key(index) { return this.#entries[index]?.[0] ?? null; }
  getItem(key) { return this.#entries.find(([stored]) => stored === key)?.[1] ?? null; }
}
