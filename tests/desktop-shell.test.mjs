// Module: MOD-desktop-shell
// Guards: UC-044; UC-003; THE BRIDGE RUNS AS AN APP; THE BRIDGE SHOWS ITS PAIRING TOKEN IN ITS WINDOW; THE BRIDGE IS PAIRED ONCE; THE LOCAL BRIDGE BINDS TO LOOPBACK ONLY
// Level: component
import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, rmdirSync, statSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createServer } from "node:net";
import { wait } from "./desktop-shell.d/wait.mjs";
import { unusedPorts } from "./desktop-shell.d/ports.mjs";

const root = new URL("..", import.meta.url).pathname;
const appEnvironment = { ...process.env, NODE_PATH: [join(root, "src/bridge-build/node_modules"), process.env.NODE_PATH].filter(Boolean).join(delimiter) };

// Electron's windows show on the screen unless a virtual screen holds them. These tests therefore run only on Linux, under
// xvfb-run, as on the CI; elsewhere each is skipped with this reason, and Electron is neither installed nor started.
const NO_VIRTUAL_SCREEN = process.platform === "linux" ? false
  : "needs a virtual screen: runs only on Linux under xvfb-run, as on the CI; elsewhere Electron's windows would show";
const electronCache = join(tmpdir(), "agent-m-276-component-electron-44");
const nativeFixtureLock = join(tmpdir(), "agent-m-276-native-fixture-lock");
let nativeFixtureLockHeld = false;
let runtimeFailure;
let virtualDisplayFailure;
let windowManagerFailure;
const tokenOf = (folder) => readFileSync(join(folder, "pairing-token"), "utf8").trim();
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
  let answer;
  try { answer = await within(new Promise((resolve, reject) => { socket.addEventListener("message", ({ data }) => { const value = JSON.parse(data); if (value.id === 1) resolve(value); }); socket.addEventListener("error", reject, { once: true }); socket.addEventListener("close", () => reject(new Error(`CDP ${method} closed before responding.`)), { once: true }); socket.send(JSON.stringify({ id: 1, method, params })); }), `CDP ${method} response`); }
  finally { socket.close(); }
  if (answer.error) throw new Error(`CDP ${method} failed: ${answer.error.message}`);
  return answer.result;
};
const evaluate = async (url, expression) => {
  const result = await cdp(url, "Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(`CDP evaluation failed: ${result.exceptionDetails.text}`);
  return result.result.value;
};
const nativeClipboardEquals = async (app, value) => await evaluate(app.main, `(async () => { const electron = process.getBuiltinModule('module').createRequire(process.cwd() + '/src/desktop-shell/main.mjs')('electron'); return await electron.clipboard.readText() === ${JSON.stringify(value)}; })()`);

async function launch({ folder = mkdtempSync(join(tmpdir(), "agent-m-276-test-")), port, debug, inspect, dataFolder = true, environment = {}, instance = "release-owner/release-frame", origin = "https://release-owner.github.io" } = {}) {
  // The ports this launch does not get are chosen together, so that no two of them are the same.
  if (port === undefined || debug === undefined || inspect === undefined) {
    const [chosenPort, chosenDebug, chosenInspect] = await unusedPorts(3);
    port ??= chosenPort; debug ??= chosenDebug; inspect ??= chosenInspect;
  }
  const executable = await runtime();
  const args = [...(process.platform === "linux" ? ["--no-sandbox"] : []), `--inspect=${inspect}`, `--remote-debugging-port=${debug}`, "src/desktop-shell/main.mjs", `--instance=${instance}`, `--origin=${origin}`, `--port=${port}`];
  if (dataFolder) args.push(`--data-folder=${folder}`);
  const launched = electronCommand(executable, args);
  const child = spawn(launched.command, launched.arguments_, { cwd: root, detached: process.platform === "linux", env: { ...appEnvironment, ...environment }, stdio: ["ignore", "pipe", "pipe"] });
  let stdout = "", stderr = "", spawnError = null, debugTargets = "";
  child.stdout.on("data", (chunk) => { stdout = `${stdout}${chunk}`.slice(-4000); });
  child.stderr.on("data", (chunk) => { stderr = `${stderr}${chunk}`.slice(-4000); });
  child.on("error", (error) => { spawnError = error; });
  const exited = new Promise((resolve) => child.once("exit", resolve));
  const stopped = () => { if (spawnError || child.exitCode !== null || child.signalCode !== null) throw new Error(`Electron exited=${child.exitCode}; signal=${child.signalCode}; error=${spawnError?.code ?? null}`); };
  try {
    const page = await wait("the window page appears among the debugging targets", async () => {
      try {
        const targets = await (await fetch(`http://127.0.0.1:${debug}/json/list`)).json();
        debugTargets = JSON.stringify(targets.map(({ type, url }) => ({ type, url })));
        return targets.find((candidate) => candidate.url.startsWith("agent-m://"));
      } catch (error) { debugTargets = `${error.name}: ${error.message}`; throw error; }
    }, stopped);
    const browser = await wait("the browser debugging address answers", async () => (await (await fetch(`http://127.0.0.1:${debug}/json/version`)).json()).webSocketDebuggerUrl, stopped);
    const main = await wait("the main process inspector address answers", async () => (await (await fetch(`http://127.0.0.1:${inspect}/json/list`)).json())[0]?.webSocketDebuggerUrl, stopped);
    return { browser, child, exited, folder, main, origin, page, port };
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

async function quit(app) {
  await wait("the Quit button is shown", async () => await evaluate(app.page.webSocketDebuggerUrl, "[...document.querySelectorAll('button')].some(x => x.textContent === 'Quit')"));
  try { await evaluate(app.page.webSocketDebuggerUrl, "[...document.querySelectorAll('button')].find(x => x.textContent === 'Quit').click()"); } catch {}
  await wait("the Bridge stops answering on its port", async () => { try { await fetch(`http://127.0.0.1:${app.port}/v1/pair`); return false; } catch { return true; } });
  let timeout;
  try { await Promise.race([app.exited, new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error("Electron did not exit after Quit.")), 30000); })]); }
  finally { clearTimeout(timeout); }
}
async function clean(app) { try { await quit(app); } finally { if (app.child.exitCode === null) app.child.kill(); } }

// TST-477005 · level: component · module: MOD-desktop-shell
// guards: UC-044; UC-003; THE BRIDGE RUNS AS AN APP; THE BRIDGE SHOWS ITS PAIRING TOKEN IN ITS WINDOW; THE BRIDGE IS PAIRED ONCE; THE LOCAL BRIDGE BINDS TO LOOPBACK ONLY
// given: the actual Electron entry launched with its forked pairing page, a pairing token written to its private folder, and the release origin
// input: read the page, request /v1/pair with the token from the right and a foreign origin, copy the address and the token to the native clipboard, and press Pair anew then confirm
// expect: the page is agent-m://release-owner.github.io/release-frame/desktop-shell/window.html without Node access; the right origin gets 200 and the other 403; the native clipboard receives the address and the token; after Pair anew the old token gets 401 and the rotated token 200
test("TST-276001: the actual Electron entry renders its forked pairing page and rotates its token", { timeout: 120000, concurrency: false, skip: NO_VIRTUAL_SCREEN }, async () => {
  const app = await launch();
  try {
    const token = await wait("the pairing token file exists", () => existsSync(join(app.folder, "pairing-token")) && tokenOf(app.folder));
    assert.equal(app.page.url, "agent-m://release-owner.github.io/release-frame/desktop-shell/window.html");
    await wait("the Pair anew button is shown", async () => await evaluate(app.page.webSocketDebuggerUrl, "[...document.querySelectorAll('button')].some(x => x.textContent === 'Pair anew')"));
    assert.deepEqual(await evaluate(app.page.webSocketDebuggerUrl, "({ frame: document.body.innerText.includes('What is this?'), node: [typeof window.require, typeof window.process], local: performance.getEntriesByType('resource').every(x => x.name.startsWith('agent-m://')) })"), { frame: true, node: ["undefined", "undefined"], local: true });
    const pair = (value, origin = app.origin) => fetch(`http://127.0.0.1:${app.port}/v1/pair`, { headers: { origin, "x-agent-m-bridge-token": value } });
    assert.equal((await pair(token)).status, 200);
    assert.equal((await pair(token, "https://other.example")).status, 403);
    const sentinel = "agent-m-276-clipboard-sentinel";
    assert.equal(await evaluate(app.main, `(async () => { const electron = process.getBuiltinModule('module').createRequire(process.cwd() + '/src/desktop-shell/main.mjs')('electron'); await electron.clipboard.writeText(${JSON.stringify(sentinel)}); return await electron.clipboard.readText() === ${JSON.stringify(sentinel)}; })()`), true, "native clipboard sentinel");
    await evaluate(app.page.webSocketDebuggerUrl, "[...document.querySelectorAll('button')].find(x => x.textContent === 'Copy address').click()");
    const address = `http://127.0.0.1:${app.port}`;
    const addressProbe = { display: await evaluate(app.page.webSocketDebuggerUrl, `document.querySelectorAll('code')[0].textContent === ${JSON.stringify(address)}`), clipboard: await wait("the native clipboard holds the address", async () => await nativeClipboardEquals(app, address)) };
    assert.deepEqual(addressProbe, { display: true, clipboard: true }, "Copy address reaches the native clipboard");
    await evaluate(app.page.webSocketDebuggerUrl, "[...document.querySelectorAll('button')].find(x => x.textContent === 'Copy token').click()");
    assert.equal(await wait("the native clipboard holds the token", async () => await nativeClipboardEquals(app, token)), true, "Copy token reaches the native clipboard");
    await evaluate(app.page.webSocketDebuggerUrl, "[...document.querySelectorAll('button')].find(x => x.textContent === 'Pair anew').click()");
    await evaluate(app.page.webSocketDebuggerUrl, "document.querySelector('.decision button:last-child').click()");
    const rotated = await wait("the pairing token is rotated", () => { const value = tokenOf(app.folder); return value !== token && value; });
    assert.equal((await pair(token)).status, 401);
    assert.equal((await pair(rotated)).status, 200);
  } catch (failure) { throw new Error(`${failure.message}; page=${app.page.url}`); }
  finally { await clean(app); }
});

// TST-477006 · level: component · module: MOD-desktop-shell
// guards: UC-044; UC-003; THE BRIDGE RUNS AS AN APP; THE BRIDGE SHOWS ITS PAIRING TOKEN IN ITS WINDOW; THE BRIDGE IS PAIRED ONCE; THE LOCAL BRIDGE BINDS TO LOOPBACK ONLY
// given: the actual Electron entry launched with its pairing token written
// input: press Pause, send a work request to the Bridge, press Resume, send it again, then press Quit
// expect: while paused the work request is refused with 503; after Resume the real server refuses the unlisted kind with 404; after Quit the Bridge no longer answers
test("TST-276002: pause refuses new work, resume restores the real server refusal, and Quit stops it", { timeout: 120000, concurrency: false, skip: NO_VIRTUAL_SCREEN }, async () => {
  const app = await launch();
  let didQuit = false;
  try {
    const token = await wait("the pairing token file exists", () => existsSync(join(app.folder, "pairing-token")) && tokenOf(app.folder));
    const work = () => fetch(`http://127.0.0.1:${app.port}/v1/probes/unlisted-kind`, { method: "POST", headers: { origin: app.origin, "x-agent-m-bridge-token": token, "content-type": "application/json" }, body: JSON.stringify({ args: {} }) });
    await wait("the Pause button is shown", async () => await evaluate(app.page.webSocketDebuggerUrl, "[...document.querySelectorAll('button')].some(x => x.textContent === 'Pause')"));
    await evaluate(app.page.webSocketDebuggerUrl, "[...document.querySelectorAll('button')].find(x => x.textContent === 'Pause').click()");
    await wait("the Resume button is shown", async () => await evaluate(app.page.webSocketDebuggerUrl, "[...document.querySelectorAll('button')].some(x => x.textContent === 'Resume')"));
    assert.equal((await work()).status, 503);
    await evaluate(app.page.webSocketDebuggerUrl, "[...document.querySelectorAll('button')].find(x => x.textContent === 'Resume').click()");
    await wait("the Pause button is shown again", async () => await evaluate(app.page.webSocketDebuggerUrl, "[...document.querySelectorAll('button')].some(x => x.textContent === 'Pause')"));
    assert.equal((await work()).status, 404);
    await quit(app);
    didQuit = true;
    await assert.rejects(fetch(`http://127.0.0.1:${app.port}/v1/pair`));
  } finally { if (!didQuit) await clean(app); }
});

// TST-477007 · level: component · module: MOD-desktop-shell
// guards: UC-044; UC-003; THE BRIDGE RUNS AS AN APP; THE BRIDGE SHOWS ITS PAIRING TOKEN IN ITS WINDOW; THE BRIDGE IS PAIRED ONCE; THE LOCAL BRIDGE BINDS TO LOOPBACK ONLY
// given: the Bridge's default port is occupied by another server
// input: launch the Electron entry on that port, then type a free replacement port and press Use this port
// expect: the page shows Agent M Bridge could not start with port 4712 offered; the replacement port starts the same real composition and answers /v1/pair with 200 for the written token
test("TST-276003: an occupied port is visible and its replacement starts the same real composition", { timeout: 120000, concurrency: false, skip: NO_VIRTUAL_SCREEN }, async () => {
  const occupied = createServer(), [port] = await unusedPorts(1);
  await new Promise((resolve, reject) => { occupied.once("error", reject); occupied.listen(port, "127.0.0.1", resolve); });
  let app;
  try {
    app = await launch({ port });
    await wait("the window shows that the Bridge could not start", async () => await evaluate(app.page.webSocketDebuggerUrl, "document.body.innerText.includes('Agent M Bridge could not start')"));
    assert.equal(await evaluate(app.page.webSocketDebuggerUrl, "document.querySelector('input[type=number]')?.value"), "4712");
    const [replacement] = await unusedPorts(1);
    await evaluate(app.page.webSocketDebuggerUrl, `document.querySelector('input[type=number]').value=${replacement}; [...document.querySelectorAll('button')].find(x => x.textContent === 'Use this port').click()`);
    await wait("the Copy token button is shown", async () => await evaluate(app.page.webSocketDebuggerUrl, "[...document.querySelectorAll('button')].some(x => x.textContent === 'Copy token')"));
    const token = await wait("the pairing token file exists", () => existsSync(join(app.folder, "pairing-token")) && tokenOf(app.folder));
    assert.equal((await fetch(`http://127.0.0.1:${replacement}/v1/pair`, { headers: { origin: app.origin, "x-agent-m-bridge-token": token } })).status, 200);
  } finally { await new Promise((resolve) => occupied.close(resolve)); if (app) await clean(app); }
});

// TST-477008 · level: component · module: MOD-desktop-shell
// guards: UC-044; UC-003; THE BRIDGE RUNS AS AN APP; THE BRIDGE SHOWS ITS PAIRING TOKEN IN ITS WINDOW; THE BRIDGE IS PAIRED ONCE; THE LOCAL BRIDGE BINDS TO LOOPBACK ONLY
// given: an existing private folder that is not writable (mode 0500)
// input: launch the Electron entry with that folder
// expect: the page shows that Agent M Bridge could not start and names NotWritable; no pairing-token file exists in the folder
test("TST-276004: an unwritable private folder is shown without starting a server", { timeout: 120000, concurrency: false, skip: NO_VIRTUAL_SCREEN }, async () => {
  const folder = mkdtempSync(join(tmpdir(), "agent-m-276-readonly-"));
  chmodSync(folder, 0o500);
  const app = await launch({ folder });
  try {
    await wait("the window shows that the Bridge could not start", async () => await evaluate(app.page.webSocketDebuggerUrl, "document.body.innerText.includes('Agent M Bridge could not start')"));
    assert.equal(await evaluate(app.page.webSocketDebuggerUrl, "document.body.innerText.includes('NotWritable')"), true);
    assert.equal(existsSync(join(folder, "pairing-token")), false);
  } finally { chmodSync(folder, 0o700); await clean(app); }
});

// TST-477009 · level: component · module: MOD-desktop-shell
// guards: UC-044; UC-003; THE BRIDGE RUNS AS AN APP; THE BRIDGE SHOWS ITS PAIRING TOKEN IN ITS WINDOW; THE BRIDGE IS PAIRED ONCE; THE LOCAL BRIDGE BINDS TO LOOPBACK ONLY
// given: the production default data folder (no folder given) for an instance owned by a fresh owner
// input: launch the Electron entry with its default folder
// expect: the instance folder has mode 0700 and its pairing-token file has mode 0600
test("TST-276006: the production default stores the instance token privately", { timeout: 120000, concurrency: false, skip: NO_VIRTUAL_SCREEN }, async () => {
  const owner = `agentm276${Date.now()}`, instance = `${owner}/bridge`;
  const appData = process.platform === "darwin" ? join(process.env.HOME, "Library", "Application Support") : join(process.env.XDG_CONFIG_HOME ?? join(process.env.HOME, ".config"));
  const folder = join(appData, `io.github.${owner}.bridge.bridge`);
  const app = await launch({ dataFolder: false, instance });
  try {
    await wait("the pairing token file exists in the platform data folder", () => existsSync(join(folder, "pairing-token")));
    assert.equal(statSync(folder).mode & 0o777, 0o700);
    assert.equal(statSync(join(folder, "pairing-token")).mode & 0o777, 0o600);
  } finally { await clean(app); rmSync(folder, { recursive: true, force: true }); }
});

// TST-477010 · level: component · module: MOD-desktop-shell
// guards: UC-044; UC-003; THE BRIDGE RUNS AS AN APP; THE BRIDGE SHOWS ITS PAIRING TOKEN IN ITS WINDOW; THE BRIDGE IS PAIRED ONCE; THE LOCAL BRIDGE BINDS TO LOOPBACK ONLY
// given: the actual Electron entry launched with its window visible
// input: close the window natively, then start a second source instance twice, minimizing the window between the starts
// expect: the first window is hidden (macOS) or stays visible (Linux) with the Bridge still answering /v1/pair with 200; each second start exits and restores the first window visible and not minimized
test("TST-276005: native close behavior and a second source start restore the first window", { timeout: 120000, concurrency: false, skip: NO_VIRTUAL_SCREEN }, async () => {
  const app = await launch();
  const second = [];
  try {
    const token = await wait("the pairing token file exists", () => existsSync(join(app.folder, "pairing-token")) && tokenOf(app.folder));
    const state = "process.getBuiltinModule('module').createRequire(process.cwd() + '/src/desktop-shell/main.mjs')('electron').BrowserWindow.getAllWindows()[0]";
    assert.equal(await evaluate(app.main, `${state}.isVisible()`), true);
    await evaluate(app.main, `${state}.close()`);
    await wait("the first window closed natively (hidden on macOS, still visible on Linux)", async () => await evaluate(app.main, process.platform === "linux" ? `!${state}.isDestroyed() && ${state}.isVisible()` : `!${state}.isDestroyed() && !${state}.isVisible()`));
    assert.equal((await fetch(`http://127.0.0.1:${app.port}/v1/pair`, { headers: { origin: app.origin, "x-agent-m-bridge-token": token } })).status, 200);
    const startSecond = async () => {
      const launched = electronCommand(await runtime(), [...(process.platform === "linux" ? ["--no-sandbox"] : []), "src/desktop-shell/main.mjs", "--instance=release-owner/release-frame", "--origin=https://release-owner.github.io", `--data-folder=${app.folder}`, `--port=${app.port}`]);
      const child = spawn(launched.command, launched.arguments_, { cwd: root, env: appEnvironment, detached: process.platform === "darwin", stdio: "ignore" });
      child.unref(); second.push(child); return { child, exited: new Promise((resolve) => child.once("exit", resolve)) };
    };
    const observeSecond = async () => await evaluate(app.main, "(() => { globalThis.__agentMSecondInstanceCount ??= 0; process.getBuiltinModule('module').createRequire(process.cwd() + '/src/desktop-shell/main.mjs')('electron').app.once('second-instance', () => { globalThis.__agentMSecondInstanceCount += 1; }); return globalThis.__agentMSecondInstanceCount; })()");
    let count = await observeSecond(), started = await startSecond();
    await wait("the first window counts the second start", async () => await evaluate(app.main, `globalThis.__agentMSecondInstanceCount === ${count + 1}`));
    await within(started.exited, "second source start exit");
    await wait("the first window is visible and not minimised", async () => await evaluate(app.main, `${state}.isVisible() && !${state}.isMinimized()`));
    await evaluate(app.main, `${state}.minimize()`);
    try { await wait("the first window is minimised", async () => await evaluate(app.main, `${state}.isMinimized()`)); }
    catch (failure) {
      if (process.platform !== "linux") throw failure;
      const manager = await evaluate(app.main, "(() => { try { const text = process.getBuiltinModule('child_process').execFileSync('xprop', ['-root', '_NET_SUPPORTING_WM_CHECK'], { encoding: 'utf8' }); return { available: true, windowManager: text.includes('_NET_SUPPORTING_WM_CHECK') }; } catch (error) { return { available: false, error: error.code ?? error.name }; } })()");
      const candidates = ["openbox", "fluxbox", "metacity", "xfwm4", "mutter", "kwin_x11"].map((command) => {
        const result = spawnSync(command, ["--version"], { encoding: "utf8", timeout: 5000 });
        return { command, status: result.status, signal: result.signal, error: result.error?.code ?? null };
      });
      throw new Error(`${failure.message}; xprop=${JSON.stringify(manager)}; candidates=${JSON.stringify(candidates)}`);
    }
    count = await observeSecond(); started = await startSecond();
    await wait("the first window counts the second start", async () => await evaluate(app.main, `globalThis.__agentMSecondInstanceCount === ${count + 1}`));
    await within(started.exited, "second source start exit");
    await wait("the first window is visible and not minimised", async () => await evaluate(app.main, `${state}.isVisible() && !${state}.isMinimized()`));
    assert.equal((await fetch(`http://127.0.0.1:${app.port}/v1/pair`, { headers: { origin: app.origin, "x-agent-m-bridge-token": token } })).status, 200);
  } finally {
    for (const child of second) child.kill();
    try {
      await evaluate(app.main, "process.getBuiltinModule('module').createRequire(process.cwd() + '/src/desktop-shell/main.mjs')('electron').app.quit()");
      await wait("the Bridge stops answering on its port", async () => { try { await fetch(`http://127.0.0.1:${app.port}/v1/pair`); return false; } catch { return true; } });
      await within(app.exited, "Electron main-process quit");
    } finally { if (app.child.exitCode === null) app.child.kill(); }
  }
});
