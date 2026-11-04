// The checks of buildPlatform (docs/architecture/MOD-bridge-build.md, Interfaces): a compiled Node addon in the app, each platform's own verifier of a
// code signature, and the tunnel check — "each platform's packaged app opens a reverse tunnel and a forward to a test SSH server and answers a request
// through them before anything is published" (Data). Each failure is one of the module's errors.
//
// Module: MOD-bridge-build

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import http from "node:http";
import net from "node:net";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { ReleaseError } from "./publish.mjs";

// Runs a program and waits for it: { code, output } — standard output and standard error together.
export function run(command, args, { cwd, env } = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { cwd, env, shell: globalThis.process.platform === "win32" && command !== "powershell", stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    child.stdout.on("data", (chunk) => { output += chunk; });
    child.stderr.on("data", (chunk) => { output += chunk; });
    child.on("error", (error) => resolve({ code: -1, output: String(error.message) }));
    child.on("close", (code) => resolve({ code, output }));
  });
}

// The first compiled Node addon, a `.node` file, below `root`, as a path relative to `base`; null when there is none.
export function nativeAddon(root, base = root) {
  let entries;
  try {
    entries = readdirSync(root, { withFileTypes: true });
  } catch {
    return null;
  }
  for (const entry of entries) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) {
      const found = nativeAddon(path, base);
      if (found) return found;
    } else if (entry.name.endsWith(".node")) {
      return relative(base, path);
    }
  }
  return null;
}

// The first compiled Node addon in the packages the app carries (MOD-bridge-build, "What the app carries": "the packages above that the app needs at
// run time"): those package.json names under `dependencies`, and, in the installed tree, the `dependencies` of each,
// recursively; optional dependencies are not installed, and the build tools (devDependencies and what only they reach) do not ship. A package is
// found in its own node_modules first, then in the installed tree's. As a path relative to `stage`; null when there is none.
export function shippedAddon(stage) {
  const installed = join(stage, "node_modules");
  const readJson = (path) => { try { return JSON.parse(readFileSync(path, "utf8")); } catch { return null; } };
  const seen = new Set();
  const queue = Object.keys(readJson(join(stage, "package.json"))?.dependencies ?? {}).map((name) => join(installed, name));
  while (queue.length) {
    const folder = queue.shift();
    if (seen.has(folder)) continue;
    seen.add(folder);
    const addon = nativeAddon(folder, stage);
    if (addon) return addon;
    for (const name of Object.keys(readJson(join(folder, "package.json"))?.dependencies ?? {})) {
      const nested = join(folder, "node_modules", name);
      queue.push(existsSync(nested) ? nested : join(installed, name));
    }
  }
  return null;
}

// Each platform's own verifier of the code signature (ARC-050), and the publisher's name it reads from the signed file: macOS's codesign lists the
// signing certificates, the first being the Developer ID Application certificate of the publisher, whose name follows its type; Windows's
// Get-AuthenticodeSignature gives the status and the signer certificate's simple name. Linux checks no code signature and reads no name (null).
// `app` is the unpacked macOS app, `installer` the Windows installer; `file` is the name of the released file the signature belongs to. Where the
// signature holds but the verifier reads no name, the signature is not accepted: SignatureInvalid.
export async function verifyCodeSignature({ platform, app, installer, file, env }) {
  const failed = (verifier, result) => new ReleaseError("SignatureInvalid", { file }, `${file}: ${verifier} does not accept its code signature: ${result.output.trim().slice(-500)}`);
  const nameless = (verifier) => new ReleaseError("SignatureInvalid", { file }, `${file}: ${verifier} reads no publisher name from its code signature`);
  if (platform === "macos") {
    for (const [command, args] of [
      ["codesign", ["--verify", "--deep", "--strict", app]],
      ["spctl", ["--assess", "--type", "execute", app]],
      ["xcrun", ["stapler", "validate", app]],
    ]) {
      const result = await run(command, args, { env });
      if (result.code !== 0) throw failed(command, result);
    }
    const shown = await run("codesign", ["-dvv", app], { env });
    if (shown.code !== 0) throw failed("codesign", shown);
    const name = /^Authority=(?:Developer ID Application: )?(\S.*)$/m.exec(shown.output)?.[1]?.trim();
    if (!name) throw nameless("codesign");
    return name;
  }
  if (platform === "windows") {
    const object = `(Get-AuthenticodeSignature -LiteralPath '${installer.replaceAll("'", "''")}')`;
    const result = await run("powershell", ["-NoProfile", "-Command", `${object}.Status; ${object}.SignerCertificate.GetNameInfo('SimpleName', $false)`], { env });
    const [status, name] = result.output.trim().split(/\r?\n/).map((line) => line.trim());
    if (result.code !== 0 || status !== "Valid") throw failed("Get-AuthenticodeSignature", result);
    if (!name) throw nameless("Get-AuthenticodeSignature");
    return name;
  }
  return null;
}

// `count` different free ports of loopback. All are held at once while they are found, and only then released: a port closed before the next is taken may
// be handed out again, and two of the app's ports would then be one.
async function freePorts(count) {
  const servers = [];
  try {
    for (let index = 0; index < count; index += 1) {
      const server = net.createServer();
      servers.push(server);
      await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
    }
    return servers.map((server) => server.address().port);
  } finally {
    await Promise.all(servers.map((server) => new Promise((resolve) => (server.listening ? server.close(() => resolve()) : resolve()))));
  }
}

function fetchOnce(port) {
  return new Promise((resolve) => {
    const request = http.get({ host: "127.0.0.1", port, path: "/", timeout: 2000, agent: false }, (response) => {
      let body = "";
      response.on("data", (chunk) => { body += chunk; });
      response.on("end", () => resolve({ status: response.statusCode, body }));
    });
    request.on("timeout", () => request.destroy());
    request.on("error", () => resolve(null));
  });
}

// A test SSH server that takes any login, opens the reverse listener a client asks for (tcpip-forward) and answers a forwarded connection
// (direct-tcpip) from a small web server of its own. Returns { port, answerPort, close }.
async function testSshServer(ssh2) {
  const { Server, utils } = ssh2;
  const failed = (reason) => new ReleaseError("TunnelCheckFailed", { reason }, `the tunnel check failed: ${reason}`);
  // ssh2 cannot parse about one in 230 of the ed25519 keys it generates; the host key is generated again until it parses (as MOD-tunnels does for its own key).
  let hostKey;
  for (let attempt = 0; attempt < 64 && !hostKey; attempt += 1) {
    const { private: candidate } = utils.generateKeyPairSync("ed25519");
    if (!(utils.parseKey(candidate) instanceof Error)) hostKey = candidate;
  }
  if (!hostKey) throw failed("ssh2 generated no host key that it can parse");
  const sockets = new Set();
  const answer = http.createServer((_request, response) => response.end("ok"));
  const answerPort = await new Promise((resolve) => answer.listen(0, "127.0.0.1", () => resolve(answer.address().port)));
  const listeners = [];
  const onClient = (client) => {
    client.on("error", () => {});
    client.on("authentication", (context) => context.accept());
    client.on("request", (accept, reject, name, info) => {
      if (name !== "tcpip-forward") return reject();
      const listener = net.createServer((socket) => client.forwardOut(info.bindAddr, info.bindPort, "127.0.0.1", socket.remotePort ?? 0, (error, stream) => {
        if (error) return socket.destroy();
        socket.pipe(stream).pipe(socket);
        stream.once("error", () => socket.destroy());
        socket.once("error", () => stream.destroy());
      }));
      listeners.push(listener);
      listener.once("error", () => reject());
      listener.listen(info.bindPort, "127.0.0.1", () => accept());
    });
    client.on("tcpip", (accept, reject) => {
      const upstream = net.connect(answerPort, "127.0.0.1");
      upstream.once("connect", () => {
        const stream = accept();
        sockets.add(stream);
        stream.pipe(upstream).pipe(stream);
        stream.once("error", () => upstream.destroy());
        upstream.once("error", () => stream.destroy());
      });
      upstream.once("error", () => reject());
    });
  };
  let server;
  try {
    server = new Server({ hostKeys: [hostKey] }, onClient);
  } catch (error) {
    answer.close();
    throw failed(String(error?.message ?? error));
  }
  const port = await new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server.address().port)));
  return {
    port,
    answerPort,
    close() {
      for (const listener of listeners) listener.close();
      for (const stream of sockets) stream.destroy();
      answer.close();
      server.close();
    },
  };
}

// The per-user data folder of an app, in the platform's place for it (MOD-desktop-shell, Data), below the home the check gives the app.
const dataFolderIn = (platform, home, appId) => join(platform === "macos" ? join(home, "Library", "Application Support") : platform === "windows" ? join(home, "AppData", "Roaming") : join(home, ".config"), appId);

/**
 * The tunnel check: starts the packaged app with a home of its own whose settings name a reverse tunnel and a forward to a test SSH server, and waits
 * until a request through each is answered. Errors: TunnelCheckFailed { reason }.
 */
export async function tunnelCheck({ platform, executable, appId, ssh2, timeout = 60_000 }) {
  const failed = (reason) => new ReleaseError("TunnelCheckFailed", { reason }, `the tunnel check failed: ${reason}`);
  const home = mkdtempSync(join(tmpdir(), "bridge-tunnel-check-"));
  let server = null;
  let child = null;
  try {
    server = await testSshServer(ssh2);
    const [bridgePort, reversePort, forwardPort] = await freePorts(3);
    const plan = (direction, remotePort) => ({ direction, jumpHost: "127.0.0.1", user: "check", sshPort: server.port, remotePort, bind: "127.0.0.1", bridgePort, keyFile: "ssh/id_ed25519" });
    const dataFolder = dataFolderIn(platform, home, appId);
    mkdirSync(dataFolder, { recursive: true });
    writeFileSync(join(dataFolder, "settings.json"), JSON.stringify({
      "agent-m-bridge-settings": 1, name: "tunnel-check", port: bridgePort, agents: [], products: [], every: 300, paused: false,
      jumpHost: { hostname: "127.0.0.1", user: "check", sshPort: server.port }, tunnels: [plan("reverse", reversePort), plan("forward", forwardPort)],
    }));
    let exited = null;
    // On Linux the check starts Electron without its sandbox: the unpacked chrome-sandbox of a runner is not set-user-id root, and Electron then refuses to
    // start. The check measures the tunnels, not the sandbox.
    child = spawn(executable, platform === "linux" ? ["--no-sandbox"] : [], {
      env: { ...globalThis.process.env, HOME: home, USERPROFILE: home, XDG_CONFIG_HOME: join(home, ".config"), APPDATA: join(home, "AppData", "Roaming") },
      stdio: ["ignore", "ignore", "pipe"],
    });
    let stderr = "";
    child.stderr.on("data", (chunk) => { stderr = (stderr + chunk).slice(-500); });
    child.on("error", (error) => { exited = `could not be started: ${error.message}`; });
    child.on("close", (code) => { exited ??= `ended with code ${code} ${stderr.trim()}`; });
    const through = { reverse: null, forward: null };
    for (const deadline = Date.now() + timeout; Date.now() < deadline;) {
      if (exited) throw failed(`the packaged app ${exited}`);
      through.reverse ??= (await fetchOnce(reversePort))?.status ? "answered" : null;
      through.forward ??= (await fetchOnce(forwardPort))?.body === "ok" ? "answered" : null;
      if (through.reverse && through.forward) return;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw failed(`no request was answered through the ${through.reverse ? "forward" : "reverse tunnel"} within ${timeout / 1000} seconds`);
  } finally {
    child?.kill("SIGKILL");
    server?.close();
    rmSync(home, { recursive: true, force: true });
  }
}

// ssh2, from the app's packages as the build installed them, else from this module's own.
export function loadSsh2(appFolder) {
  for (const base of [join(appFolder, "package.json"), new URL("./package.json", import.meta.url)]) {
    try {
      return createRequire(base)("ssh2");
    } catch { /* the next place */ }
  }
  throw new ReleaseError("TunnelCheckFailed", { reason: "ssh2 is not installed" }, "the tunnel check failed: ssh2 is not installed");
}
