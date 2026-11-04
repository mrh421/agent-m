// Independent release coverage for ITM-276's source Bridge pairing app.
// Run: node --test tests/release-itm-276-desktop-shell.test.mjs
//
// Module: MOD-desktop-shell
// Level: release
// Guards: UC-044; UC-003; THE BRIDGE RUNS AS AN APP; THE BRIDGE SHOWS ITS PAIRING TOKEN IN ITS WINDOW; THE BRIDGE IS PAIRED ONCE
// Guards: THE LOCAL BRIDGE BINDS TO LOOPBACK ONLY

import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, rmdirSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createServer } from "node:net";
import { wait } from "./desktop-shell.d/wait.mjs";
import test, { after, before } from "node:test";

const root = new URL("..", import.meta.url).pathname;
const appEnvironment = { ...process.env, NODE_PATH: [join(root, "src/bridge-build/node_modules"), process.env.NODE_PATH].filter(Boolean).join(delimiter) };

// Electron's windows show on the screen unless a virtual screen holds them. These tests therefore run only on Linux, under
// xvfb-run, as on the CI; elsewhere each is skipped with this reason, and Electron is neither installed nor started.
const NO_VIRTUAL_SCREEN = process.platform === "linux" ? false
  : "needs a virtual screen: runs only on Linux under xvfb-run, as on the CI; elsewhere Electron's windows would show";
const electronCache = join(tmpdir(), "agent-m-276-release-electron-44");
const nativeFixtureLock = join(tmpdir(), "agent-m-276-native-fixture-lock");
let nativeFixtureLockHeld = false;
let runtimeFailure;
let virtualDisplayFailure;
let windowManagerFailure;
const token = (folder) => readFileSync(join(folder, "pairing-token"), "utf8").trim();
const scrub = (value) => String(value).replace(/[A-Za-z0-9_-]{32,}/g, "[redacted]");
const within = async (promise, name) => {
  let timeout;
  try { return await Promise.race([promise, new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error(`${name} timed out.`)), 5000); })]); }
  finally { clearTimeout(timeout); }
};
const acquireNativeFixtureLock = async () => {
  for (let n = 0; n < 240; n += 1) {
    try { mkdirSync(nativeFixtureLock); nativeFixtureLockHeld = true; return; }
    catch (failure) { if (failure.code !== "EEXIST") throw failure; }
    await new Promise((resolve) => setTimeout(resolve, 125));
  }
  throw new Error("Timed out waiting for the native Electron fixture lock.");
};
const releaseNativeFixtureLock = () => { if (nativeFixtureLockHeld) { rmdirSync(nativeFixtureLock); nativeFixtureLockHeld = false; } };
const commandEvidence = (stage, result) => {
  const evidence = { stage, status: result.status, signal: result.signal, error: result.error?.code ?? null, stdout: scrub(result.stdout), stderr: scrub(result.stderr) };
  process.stdout.write(`native-fixture ${JSON.stringify(evidence)}\n`);
  return evidence;
};
const publicUbuntuPackage = (uri) => {
  try {
    const parsed = new URL(uri);
    return ["http:", "https:"].includes(parsed.protocol) && !parsed.username && !parsed.password && ["azure.archive.ubuntu.com", "archive.ubuntu.com"].includes(parsed.hostname) && (parsed.pathname === "/ubuntu" || parsed.pathname.startsWith("/ubuntu/"));
  } catch { return false; }
};
const credentialBearingUri = (uri) => { try { const parsed = new URL(uri); return Boolean(parsed.username || parsed.password); } catch { return false; } };
const sanitizedCliText = (value) => scrub(String(value).replace(/(https?:\/\/)[^/\s@]*@/gi, "$1[redacted]@"));
const recordedPackagePlan = (output) => String(output).split(/\r?\n/).flatMap((line) => {
  const match = /^'([^']+)'\s+(\S+)\s+(\d+)\s+(\S+)$/.exec(line);
  if (!match) return [];
  const [, uri, filename, bytes, digest] = match, md5 = /^(?:MD5Sum:)?([a-f0-9]{32})$/i.exec(digest)?.[1] ?? null, evidence = { filename, bytes: Number(bytes), md5, digest: md5 ?? scrub(digest), observation: md5 ? undefined : "unrecognized-digest" };
  if (uri.startsWith("mirror+file:")) return [{ transport: "mirror+file", ...evidence }];
  if (credentialBearingUri(uri)) return [{ transport: "credential-rejected", ...evidence }];
  if (publicUbuntuPackage(uri)) return [{ transport: new URL(uri).protocol.slice(0, -1), uri, ...evidence }];
  return [{ transport: "unrecorded", ...evidence }];
});
const publicMirrors = () => {
  try {
    return readFileSync("/etc/apt/apt-mirrors.txt", "utf8").split(/\r?\n/).map((line) => line.trim().split(/\s+/, 1)[0]).filter((uri) => publicUbuntuPackage(uri));
  } catch { return []; }
};
const diagnosticEvidence = (stage, evidence) => process.stdout.write(`native-fixture ${JSON.stringify({ stage, ...evidence })}\n`);
const diagnoseOpenboxAcquisition = () => {
  try {
    const started = Date.now();
    const resolution = spawnSync("sudo", ["apt-get", "--print-uris", "--yes", "--no-install-recommends", "install", "openbox"], { encoding: "utf8", timeout: 6000 });
    const packages = recordedPackagePlan(resolution.stdout);
    const font = packages.find((candidate) => candidate.filename.startsWith("fonts-urw-base35_") && candidate.filename.endsWith("_all.deb"));
    diagnosticEvidence("Linux Openbox diagnostic plan", { status: resolution.status, signal: resolution.signal, error: resolution.error?.code ?? null, elapsedMs: Date.now() - started, stdout: sanitizedCliText(resolution.stdout), stderr: sanitizedCliText(resolution.stderr), packages, mirrors: packages.some((candidate) => candidate.transport === "mirror+file") ? publicMirrors() : [], observation: !packages.length ? "unparseable-print-uris" : !font ? "fonts-package-not-resolved" : !font.md5 ? "font-digest-not-md5" : !font.uri?.startsWith("http://") ? "font-uri-not-direct-http" : "direct-http-font-uri" });
    if (!font?.uri?.startsWith("http://") || !font.md5) return;
    for (const scheme of ["http", "https"]) {
      const folder = mkdtempSync(join(tmpdir(), "agent-m-276-openbox-diagnostic-")), archive = join(folder, font.filename), uri = `${scheme}:${font.uri.slice("http:".length)}`;
      try {
        const acquired = Date.now(), result = spawnSync("curl", ["-q", "--fail", "--silent", "--show-error", "--location", "--proto", `=${scheme}`, "--proto-redir", `=${scheme}`, "--connect-timeout", "2", "--max-time", "5", "--output", archive, "--write-out", "%{http_code} %{size_download} %{time_total}", uri], { encoding: "utf8", timeout: 6000 });
        const body = existsSync(archive) ? readFileSync(archive) : null;
        diagnosticEvidence("Linux Openbox package probe", { scheme, status: result.status, signal: result.signal, error: result.error?.code ?? null, elapsedMs: Date.now() - acquired, stdout: sanitizedCliText(result.stdout), stderr: sanitizedCliText(result.stderr), expectedBytes: font.bytes, actualBytes: body?.length ?? 0, expectedMd5: font.md5, actualMd5: body ? createHash("md5").update(body).digest("hex") : null, bytesMatch: body?.length === font.bytes, hashMatch: body ? createHash("md5").update(body).digest("hex") === font.md5 : false });
      } finally { rmSync(folder, { recursive: true, force: true }); }
    }
  } catch (failure) { diagnosticEvidence("Linux Openbox diagnostic", { observation: "diagnostic-error", error: failure.code ?? failure.name }); }
};
const prepareNativeFixture = async () => {
  const modules = spawnSync(process.execPath, ["--input-type=module", "-e", "await import('./src/desktop-shell/compose.mjs')"], { cwd: root, env: appEnvironment, encoding: "utf8", timeout: 5000 });
  const moduleEvidence = commandEvidence("Bridge app module staging", modules);
  assert.equal(modules.status, 0, `Bridge app modules did not load; ${JSON.stringify(moduleEvidence)}`);
  const executable = await runtime();
  electronCommand(executable, []);
  await acquireNativeFixtureLock();
  try {
    process.stdout.write(`native-fixture ${JSON.stringify({ stage: "ready", electron: "44.5.1", executable })}\n`);
  } catch (failure) { releaseNativeFixtureLock(); throw failure; }
};
if (!NO_VIRTUAL_SCREEN) {
  before(prepareNativeFixture);
  after(releaseNativeFixtureLock);
}

async function runtime() {
  const bundled = "/private/tmp/agent-m-electron-44/node_modules/electron";
  const executableOf = (installed) => process.platform === "darwin" ? join(installed, "dist/Electron.app/Contents/MacOS/Electron") : join(installed, "dist/electron");
  // Where Agent M's schedule `setup` (tests/test-schedule-setup.sh) installs Electron, a path the schedule's `cache` names: first.
  const setUp = join(homedir(), "agent-m-electron-44/node_modules/electron");
  if (existsSync(executableOf(setUp))) return executableOf(setUp);
  if (existsSync(executableOf(bundled))) return executableOf(bundled);
  if (runtimeFailure) throw runtimeFailure;
  const installed = join(electronCache, "node_modules/electron");
  const acquire = (stage, command, arguments_) => {
    const started = Date.now(), result = spawnSync(command, arguments_, { encoding: "utf8", timeout: 40000 });
    const evidence = commandEvidence(`Electron ${stage}`, result);
    if (result.status !== 0) throw new Error(`Electron ${stage} failed after ${Date.now() - started}ms; ${JSON.stringify(evidence)}`);
  };
  try {
    if (!existsSync(executableOf(installed))) {
      acquire("package acquisition", "npm", ["install", "--no-save", "--prefix", electronCache, "electron@44.5.1"]);
      acquire("binary acquisition", process.execPath, [join(installed, "install.js")]);
    }
    assert.equal(existsSync(executableOf(installed)), true, "Electron 44.5.1 executable was not acquired.");
    return executableOf(installed);
  } catch (failure) { runtimeFailure = failure; throw failure; }
}

const electronCommand = (executable, arguments_) => {
  if (process.platform !== "linux") return { command: executable, arguments_ };
  if (virtualDisplayFailure) throw virtualDisplayFailure;
  const probe = spawnSync("xvfb-run", ["--help"], { encoding: "utf8", timeout: 5000 });
  const displayEvidence = commandEvidence("Linux virtual display probe", probe);
  if (probe.status !== 0) {
    virtualDisplayFailure = new Error(`Linux virtual display probe failed; ${JSON.stringify(displayEvidence)}`);
    throw virtualDisplayFailure;
  }
  const manager = spawnSync("openbox", ["--version"], { encoding: "utf8", timeout: 5000 });
  commandEvidence("Linux Openbox initial probe", manager);
  if (manager.status !== 0) {
    if (windowManagerFailure) throw windowManagerFailure;
    diagnoseOpenboxAcquisition();
    const started = Date.now(), install = spawnSync("sudo", ["apt-get", "-o", "Debug::Acquire::http=true", "-o", "DPkg::Lock::Timeout=50", "-o", "Acquire::Retries=3", "install", "--yes", "--no-install-recommends", "openbox"], { encoding: "utf8", timeout: 60000 });
    const installEvidence = commandEvidence("Linux Openbox install", install);
    let available = spawnSync("openbox", ["--version"], { encoding: "utf8", timeout: 5000 });
    let availableEvidence = commandEvidence("Linux Openbox ready probe", available);
    const locked = install.status !== 0 && /lock-frontend/.test(String(install.stderr));
    if (locked) {
      for (let n = 0; n < 160 && available.status !== 0; n += 1) {
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250);
        available = spawnSync("openbox", ["--version"], { encoding: "utf8", timeout: 5000 });
        availableEvidence = commandEvidence("Linux Openbox ready probe", available);
      }
    }
    if ((!locked && install.status !== 0) || available.status !== 0) {
      windowManagerFailure = new Error(`Linux Openbox fixture failed after ${Date.now() - started}ms; install=${JSON.stringify(installEvidence)}; probe=${JSON.stringify(availableEvidence)}`);
      throw windowManagerFailure;
    }
  }
  return { command: "xvfb-run", arguments_: ["--auto-servernum", "--server-args=-screen 0 1280x1024x24", "sh", "-c", "openbox >/dev/null 2>&1 & wm=$!; trap 'kill \"$wm\" 2>/dev/null; wait \"$wm\" 2>/dev/null' EXIT INT TERM; \"$@\"; status=$?; exit \"$status\"", "agent-m-xvfb-openbox", executable, ...arguments_] };
};

const cdp = async (url, method, params = {}) => {
  const socket = new WebSocket(url);
  await within(new Promise((resolve, reject) => { socket.addEventListener("open", resolve, { once: true }); socket.addEventListener("error", reject, { once: true }); socket.addEventListener("close", () => reject(new Error(`CDP ${method} closed before opening.`)), { once: true }); }), `CDP ${method} connection`);
  try {
    const reply = await within(new Promise((resolve, reject) => {
      socket.addEventListener("message", ({ data }) => { const result = JSON.parse(data); if (result.id === 1) resolve(result); });
      socket.addEventListener("error", reject, { once: true });
      socket.addEventListener("close", () => reject(new Error(`CDP ${method} closed before responding.`)), { once: true });
      socket.send(JSON.stringify({ id: 1, method, params }));
    }), `CDP ${method} response`);
    if (reply.error) throw new Error(reply.error.message);
    return reply.result;
  } finally { socket.close(); }
};
const evaluate = async (url, expression) => {
  const result = await cdp(url, "Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(`CDP evaluation failed: ${result.exceptionDetails.text}`);
  return result.result.value;
};
const port = async () => await new Promise((resolve, reject) => { const server = createServer(); server.once("error", reject); server.listen(0, "127.0.0.1", () => { const { port: value } = server.address(); server.close((failure) => failure ? reject(failure) : resolve(value)); }); });

async function launch() {
  const dataFolder = mkdtempSync(join(tmpdir(), "agent-m-release-276-"));
  const apiPort = await port(), debugPort = await port(), inspectPort = await port();
  const instance = "release-fork/paired-bridge", origin = "https://release-fork.github.io";
  const executable = await runtime();
  const args = [...(process.platform === "linux" ? ["--no-sandbox"] : []), `--inspect=${inspectPort}`, `--remote-debugging-port=${debugPort}`, "src/desktop-shell/main.mjs", `--instance=${instance}`, `--origin=${origin}`, `--port=${apiPort}`, `--data-folder=${dataFolder}`];
  const launched = electronCommand(executable, args);
  const child = spawn(launched.command, launched.arguments_, { cwd: root, detached: process.platform === "linux", env: appEnvironment, stdio: ["ignore", "pipe", "pipe"] });
  let stdout = "", stderr = "", spawnError = null, debugTargets = "";
  child.stdout.on("data", (chunk) => { stdout = `${stdout}${chunk}`.slice(-4000); });
  child.stderr.on("data", (chunk) => { stderr = `${stderr}${chunk}`.slice(-4000); });
  child.on("error", (error) => { spawnError = error; });
  const exited = new Promise((resolve) => child.once("exit", resolve));
  const stopped = () => { if (spawnError || child.exitCode !== null || child.signalCode !== null) throw new Error(`Electron exited=${child.exitCode}; signal=${child.signalCode}; error=${spawnError?.code ?? null}`); };
  try {
    const page = await wait("the window page appears among the debugging targets", async () => {
      try {
        const targets = await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json();
        debugTargets = JSON.stringify(targets.map(({ type, url }) => ({ type, url })));
        return targets.find((item) => item.url.startsWith("agent-m://"));
      } catch (error) { debugTargets = `${error.name}: ${error.message}`; throw error; }
    }, stopped);
    const main = await wait("the main process inspector address answers", async () => (await (await fetch(`http://127.0.0.1:${inspectPort}/json/list`)).json())[0]?.webSocketDebuggerUrl, stopped);
    return { port: apiPort, child, folder: dataFolder, exited, instance, main, origin, page };
  } catch (failure) {
    const processes = process.platform === "linux" ? spawnSync("ps", ["-eo", "pid,ppid,stat,args"], { encoding: "utf8", timeout: 1000 }).stdout?.split("\n").filter((line) => /electron|Xvfb|openbox|agent-m-xvfb/.test(line)).join("\n") : "";
    const evidence = { argv: [launched.command, ...launched.arguments_], cwd: root, pid: child.pid, exit: child.exitCode, signal: child.signalCode, error: spawnError?.code ?? null, stdout: scrub(stdout), stderr: scrub(stderr), debugTargets, processes: scrub(processes) };
    if (child.exitCode === null) {
      try { process.platform === "linux" ? process.kill(-child.pid, "SIGTERM") : child.kill(); } catch { child.kill(); }
    }
    await within(exited, "Electron startup cleanup").catch(() => {});
    child.stdout.destroy(); child.stderr.destroy(); child.unref();
    throw new Error(`${failure.message}; Electron startup=${JSON.stringify(evidence)}`, { cause: failure });
  }
}
async function stop(app) {
  try {
    try { await click(app.page, "Quit"); } catch {}
    await wait("the Bridge stops answering on its port", async () => { try { await fetch(`http://127.0.0.1:${app.port}/v1/pair`); return false; } catch { return true; } });
    let timeout;
    try { await Promise.race([app.exited, new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error("Electron did not exit after Quit.")), 30000); })]); }
    finally { clearTimeout(timeout); }
  } finally { if (app.child.exitCode === null) app.child.kill(); }
}
const click = (page, label) => evaluate(page.webSocketDebuggerUrl, `[...document.querySelectorAll('button')].find((button) => button.textContent === ${JSON.stringify(label)}).click()`);

// Planted fault: changing the `127.0.0.1` host in src/desktop-shell/compose.mjs to `0.0.0.0` reaches the real
// server BindRefused check before token creation, so the private-token precondition fails; restoring that byte-exact
// source makes this positive pass.
// TST-276901 · level: release · module: MOD-desktop-shell
// guards: UC-044; UC-003; THE BRIDGE RUNS AS AN APP; THE BRIDGE SHOWS ITS PAIRING TOKEN IN ITS WINDOW; THE BRIDGE IS PAIRED ONCE; THE LOCAL BRIDGE BINDS TO LOOPBACK ONLY
// given: Electron 44.5.1 is acquired in the established temporary fixture and the production source entry is started for a fork identity with an empty private data folder
// input: inspect the actual renderer's exposed surface and pair once through the real displayed loopback address
// expect: the fork-local window has only the fixed preload controls and no Node globals; the address is loopback; the configured origin and private token pair, while another origin is refused
test("TST-276901: actual forked Electron source keeps its renderer private and pairs only on configured loopback", { timeout: 60000, concurrency: false, skip: NO_VIRTUAL_SCREEN }, async () => {
  const app = await launch();
  try {
    const pairingToken = await wait("the pairing token file exists", () => existsSync(join(app.folder, "pairing-token")) && token(app.folder));
    const expectedAddress = `http://127.0.0.1:${app.port}`;
    await wait("the pairing window is shown", async () => await evaluate(app.page.webSocketDebuggerUrl, "document.body.innerText.includes('Agent M Bridge pairing')"));
    assert.equal(app.page.url, "agent-m://release-fork.github.io/paired-bridge/desktop-shell/window.html");
    assert.deepEqual(await evaluate(app.page.webSocketDebuggerUrl, "({ calls: Object.keys(window.bridge).sort(), node: [typeof window.process, typeof window.require], address: [...document.querySelectorAll('code')][0].textContent })"), {
      calls: ["chooseFolder", "copy", "onQuitRequested", "pairAnew", "pause", "quit", "resume", "retryPort", "state"], node: ["undefined", "undefined"], address: expectedAddress,
    }, "failure node: the only renderer privilege is the fixed preload API");
    const pair = (origin) => fetch(`${expectedAddress}/v1/pair`, { headers: { origin, "x-agent-m-bridge-token": pairingToken } });
    assert.equal((await pair(app.origin)).status, 200, "known positive: the configured page origin pairs with the real loopback server");
    assert.equal((await pair("https://unrelated.example")).status, 403, "failure node: a non-configured origin is refused");
  } finally { await stop(app); }
});
