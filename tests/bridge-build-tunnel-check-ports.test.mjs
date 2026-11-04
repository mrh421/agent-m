// The ports of the tunnel check (ITM-1436) — the accepted text of docs/architecture/MOD-bridge-build.md: "each platform's packaged app opens a reverse
// tunnel and a forward to a test SSH server and answers a request through them before anything is published". The check gives the app three ports in its
// settings: the Bridge's own port, the reverse tunnel's and the forward's. When two of them are one port, the app's Bridge holds the forward's port, the
// forward cannot listen (MOD-tunnels names it port-taken and retries), the forward's request is answered by the Bridge, and the check ends at its limit with
// "no request was answered through the forward" — the stall the probe of ITM-1436 showed on CI, where the system handed one free port out twice.
// Run: node --test tests/bridge-build-tunnel-check-ports.test.mjs
//
// Module: MOD-bridge-build
// Guards: THE BRIDGE OPENS ITS TUNNELS ITSELF; A TEST THAT FLIPS ON THE SAME COMMIT IS FLAKY
// Level: unit
//
// The system's choice of a free port is made deterministic here: while the check runs, a server asked to listen on port 0 of loopback is given the first
// port of a fixed set of free ports that no such server holds at that moment — as the system may do, since a port closed again is free again. The packaged
// app is a small program that does what the Bridge does at start: it reads its settings, answers HTTP on the settings' port and opens the tunnels with
// MOD-tunnels, in a process of its own, where the ports are the system's. Nothing reaches the network.
// Each test states its given / input / expect before it runs. The counter-proofs are recorded in the pull request.

import test from "node:test";
import assert from "node:assert/strict";
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import net from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { tunnelCheck } from "../src/bridge-build/check.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const ssh2 = createRequire(join(ROOT, "src", "bridge-build", "package.json"))("ssh2");

// The packaged app: it records the ports its settings name, answers HTTP on the Bridge's port with 401, and opens the tunnels with MOD-tunnels.
const app = (record) => `#!/usr/bin/env node
const fs = require("node:fs"), path = require("node:path"), http = require("node:http");
const find = (dir, depth) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const found = path.join(dir, entry.name);
    if (entry.isFile() && entry.name === "settings.json") return found;
    if (entry.isDirectory() && depth > 0) { const inner = find(found, depth - 1); if (inner) return inner; }
  }
  return null;
};
const file = find(process.env.HOME, 6);
const settings = JSON.parse(fs.readFileSync(file, "utf8"));
fs.writeFileSync(${JSON.stringify(record)}, JSON.stringify({ bridge: settings.port, tunnels: settings.tunnels.map((plan) => [plan.direction, plan.remotePort]) }));
http.createServer((_request, response) => { response.writeHead(401); response.end("a token is required"); }).listen(settings.port, "127.0.0.1");
import(${JSON.stringify(pathToFileURL(join(ROOT, "src", "tunnels", "index.mjs")).href)}).then(({ openTunnels }) => openTunnels(path.dirname(file), settings.tunnels, settings.port));
`;

// Free ports of loopback, all held at once while they are found and then released.
async function freePorts(count) {
  const servers = await Promise.all(Array.from({ length: count }, () => new Promise((resolve) => { const server = net.createServer(); server.listen(0, "127.0.0.1", () => resolve(server)); })));
  const ports = servers.map((server) => server.address().port);
  await Promise.all(servers.map((server) => new Promise((resolve) => server.close(resolve))));
  return ports;
}

// While `body` runs, a server of this process asked to listen on port 0 of loopback gets the first port of `pool` that no such server holds.
async function withPortsHandedOutAgain(pool, body) {
  const createServer = net.createServer;
  const held = new Set();
  net.createServer = (...args) => {
    const server = createServer(...args);
    const listen = server.listen.bind(server);
    server.listen = (port, host, callback) => {
      if (port !== 0 || host !== "127.0.0.1") return listen(port, host, callback);
      const chosen = pool.find((each) => !held.has(each));
      held.add(chosen);
      server.once("close", () => held.delete(chosen));
      return listen(chosen, host, callback);
    };
    return server;
  };
  try { return await body(); } finally { net.createServer = createServer; }
}

// TST-1436001 · level: unit · module: MOD-bridge-build
// guards: THE BRIDGE OPENS ITS TUNNELS ITSELF; A TEST THAT FLIPS ON THE SAME COMMIT IS FLAKY
// given: a system that hands a free port of loopback out again as soon as it is closed (the first free port of a fixed set that no server holds); a packaged app that records the ports of its settings, answers HTTP on the Bridge's port and opens the tunnels with MOD-tunnels; the check's limit of 15 s
// input: tunnelCheck({ platform: "linux", executable, appId, ssh2, timeout: 15000 })
// expect: the settings name three different ports for the Bridge, the reverse tunnel and the forward, and the check resolves: a request through each tunnel is answered
// Planted fault: taking each port with a server closed before the next is taken (check.mjs's freePort as before ITM-1436) gives the three one port, and the check ends with "no request was answered through the forward within 15 seconds".
test("tunnelCheck — the Bridge, the reverse tunnel and the forward get three different ports, also where the system hands a closed port out again", async () => {
  const folder = mkdtempSync(join(tmpdir(), "bridge-tunnel-check-ports-"));
  try {
    const record = join(folder, "ports.json");
    const executable = join(folder, "app");
    writeFileSync(executable, app(record));
    chmodSync(executable, 0o755);
    const pool = await freePorts(8);
    let outcome = "resolved";
    await withPortsHandedOutAgain(pool, async () => {
      try { await tunnelCheck({ platform: "linux", executable, appId: "io.github.probe.agent-m.bridge", ssh2, timeout: 15_000 }); } catch (error) { outcome = `${error.name}: ${error.reason}`; }
    });
    const ports = JSON.parse(readFileSync(record, "utf8"));
    const named = [ports.bridge, ...ports.tunnels.map(([, port]) => port)];
    assert.deepEqual(ports.tunnels.map(([direction]) => direction), ["reverse", "forward"]);
    assert.equal(new Set(named).size, 3, `the Bridge, the reverse tunnel and the forward: ${named.join(", ")}`);
    assert.equal(outcome, "resolved");
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
});

