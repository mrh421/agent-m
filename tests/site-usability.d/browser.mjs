// The controlled Electron that tests/site-usability.test.mjs draws the site's pages in, and the wait that bounds every condition by
// the clock. It is the engine
// (Electron 44.5.1 from npm, under xvfb-run and openbox on Linux, driven over the Chrome DevTools Protocol), so that the page has the
// geometry a browser gives it. Staging holds the lock of tests/desktop-shell.test.mjs while Electron is fetched and openbox installed,
// and releases it before the window opens: those are the steps two test files must not do at once. It is test code; it holds no
// expected result.
//
// Module: MOD-site-frame
// Level: system

import { existsSync, mkdirSync, mkdtempSync, rmSync, rmdirSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { spawn, spawnSync } from "node:child_process";

const electronCache = join(tmpdir(), "agent-m-904-site-usability-electron-44");
const nativeFixtureLock = join(tmpdir(), "agent-m-276-native-fixture-lock");
const executableOf = (installed) => process.platform === "darwin" ? join(installed, "dist/Electron.app/Contents/MacOS/Electron") : join(installed, "dist/electron");

// until(name, condition, limitMs = 30000) -> Promise<any> — the first truthy value `condition` returns; it is tried every 100 ms and a
// try that has not answered by the deadline is given up. At the deadline it throws "<name> did not hold within <n> s" and the last error that a try really gave
// ("none" if none did): the deadline cutting off a try in flight is no error of the try.
export async function until(name, condition, limitMs = 30000) {
  const deadline = Date.now() + limitMs;
  let lastError;
  const cutOff = new Error("deadline");
  for (;;) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) break;
    let timer;
    try {
      const value = await Promise.race([condition(), new Promise((_, reject) => { timer = setTimeout(() => reject(cutOff), remaining); })]);
      if (value) return value;
    } catch (failure) { if (failure !== cutOff) lastError = failure; } finally { clearTimeout(timer); }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`${name} did not hold within ${limitMs / 1000} s; last error: ${lastError?.message ?? "none"}`);
}

// again(name, attempt, { answerWithin = 3000, limit = 30000 }) -> Promise<any> — what `attempt(answerWithin)` gives. An attempt is given `answerWithin` ms
// to answer and is made again when it does not, until `limit` ms are over; at the limit it throws as `until` does. A command or an evaluation sent while a
// document is replaced is sometimes never answered, and one that is given the whole wait cannot be sent again. Only a call that does no harm when it runs
// twice is made through `again`: a slow call that is still running is not sent again and again, so it is given `answerWithin` of its own.
export async function again(name, attempt, { answerWithin = 3000, limit = 30000 } = {}) {
  const answer = await until(name, async () => ({ value: await attempt(answerWithin) }), limit);
  return answer.value;
}

// configure(page, method, params, options) -> Promise<object> — the answer of a command that sets up the window's page or the check; the command is sent
// again, within `options.limit`, until it is answered.
export const configure = (page, method, params = {}, options) => again(`${method} is answered`, (within) => page.call(method, params, within), options);

// readyPage(page, options) -> Promise<void> — the setup of a window's page, which openWindow runs: the page domain is enabled, so that a script can be added
// to every new document, and a first evaluation has run in the document that is open, or the first one after a navigation is never answered.
export async function readyPage(page, options) {
  await configure(page, "Page.enable", {}, options);
  await again("the open document answers", (within) => page.evaluate("document.readyState", within), options);
}

async function acquireLock() {
  for (let n = 0; n < 240; n += 1) {
    try { mkdirSync(nativeFixtureLock); return; } catch (error) { if (error.code !== "EEXIST") throw error; }
    await new Promise((resolve) => setTimeout(resolve, 125));
  }
  throw new Error("Timed out waiting for the controlled Electron fixture lock.");
}

function runtime() {
  // Where Agent M's schedule `setup` (tests/test-schedule-setup.sh) installs Electron, a path the schedule's `cache` names: first.
  const setUp = join(homedir(), "agent-m-electron-44/node_modules/electron");
  if (existsSync(executableOf(setUp))) return executableOf(setUp);
  const bundled = "/private/tmp/agent-m-electron-44/node_modules/electron";
  if (existsSync(executableOf(bundled))) return executableOf(bundled);
  const installed = join(electronCache, "node_modules/electron");
  if (!existsSync(executableOf(installed))) {
    const install = spawnSync("npm", ["install", "--no-save", "--prefix", electronCache, "electron@44.5.1"], { encoding: "utf8", timeout: 40000 });
    if (install.status !== 0) throw new Error(`Electron package staging failed: ${install.stderr}`);
    const binary = spawnSync(process.execPath, [join(installed, "install.js")], { encoding: "utf8", timeout: 40000 });
    if (binary.status !== 0) throw new Error(`Electron binary staging failed: ${binary.stderr}`);
  }
  if (!existsSync(executableOf(installed))) throw new Error("Electron 44.5.1 was not acquired.");
  return executableOf(installed);
}

function electronCommand(executable, arguments_) {
  if (process.platform !== "linux") return { command: executable, arguments_ };
  const display = spawnSync("xvfb-run", ["--help"], { encoding: "utf8", timeout: 5000 });
  if (display.status !== 0) throw new Error(`Linux virtual display unavailable: ${display.stderr}`);
  let openbox = spawnSync("openbox", ["--version"], { encoding: "utf8", timeout: 5000 });
  if (openbox.status !== 0) {
    const install = spawnSync("sudo", ["apt-get", "-o", "DPkg::Lock::Timeout=50", "-o", "Acquire::Retries=3", "install", "--yes", "--no-install-recommends", "openbox"], { encoding: "utf8", timeout: 60000 });
    if (install.status !== 0) throw new Error(`Linux Openbox installation failed: ${install.stderr}`);
    openbox = spawnSync("openbox", ["--version"], { encoding: "utf8", timeout: 5000 });
  }
  if (openbox.status !== 0) throw new Error(`Linux Openbox unavailable: ${openbox.stderr}`);
  return { command: "xvfb-run", arguments_: ["--auto-servernum", "--server-args=-screen 0 1280x1024x24", "sh", "-c", "openbox >/dev/null 2>&1 & wm=$!; trap 'kill \"$wm\" 2>/dev/null; wait \"$wm\" 2>/dev/null' EXIT INT TERM; \"$@\"; status=$?; exit \"$status\"", "agent-m-xvfb-openbox", executable, ...arguments_] };
}

const freePort = () => new Promise((resolve) => { const s = createServer(); s.listen(0, "127.0.0.1", () => { const value = s.address().port; s.close(() => resolve(value)); }); });

// The main process of the window: Electron's light theme, a hidden window that loads the address it is given. It is exported.
// The first load is superseded by the checks' own first Page.navigate
// when it is not yet finished; Electron then rejects it with ERR_ABORTED, which is no failure of the window, so only another error quits the app.
export const ENTRY = `import electron from "electron"; const start = async () => { const url = process.argv.find((value) => value.startsWith("--fixture-url="))?.slice("--fixture-url=".length); if (!url) throw new Error("Missing --fixture-url."); await electron.app.whenReady(); electron.app.dock?.hide(); electron.nativeTheme.themeSource = "light"; const window = new electron.BrowserWindow({ show: false, webPreferences: { contextIsolation: true, nodeIntegration: false, backgroundThrottling: false } }); electron.app.on("window-all-closed", () => electron.app.quit()); await window.loadURL(url).catch((failure) => { if (failure.code !== "ERR_ABORTED") throw failure; }); }; start().catch((failure) => { console.error(failure.message); electron.app?.quit?.(); });`;

async function session(url) {
  const socket = new WebSocket(url);
  await until("the DevTools socket opens", () => new Promise((resolve, reject) => {
    if (socket.readyState === 1) resolve(true);
    socket.addEventListener("open", () => resolve(true), { once: true });
    socket.addEventListener("error", () => reject(new Error("the DevTools socket failed")), { once: true });
  }), 15000);
  let nextId = 1;
  const pending = new Map();
  socket.addEventListener("message", ({ data }) => {
    const value = JSON.parse(data), done = pending.get(value.id);
    if (!done) return;
    pending.delete(value.id);
    if (value.error) done.reject(new Error(value.error.message)); else done.resolve(value.result);
  });
  const call = (method, params = {}, within = 30000) => new Promise((resolve, reject) => {
    const id = nextId++;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`${method} was not answered within ${within / 1000} s`)); }, within);
    pending.set(id, { resolve: (value) => { clearTimeout(timer); resolve(value); }, reject: (failure) => { clearTimeout(timer); reject(failure); } });
    socket.send(JSON.stringify({ id, method, params }));
  });
  return {
    call,
    // evaluate(expression) -> the value the expression gives in the page, which may be a promise; an exception in the page throws here.
    // `within` is how long the answer may take: an evaluation sent while a document is being replaced can be lost, so a caller that can send it again gives it a short time.
    async evaluate(expression, within = 30000) {
      const answer = await call("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }, within);
      if (answer.exceptionDetails) throw new Error(`The page threw: ${answer.exceptionDetails.exception?.description ?? answer.exceptionDetails.text}`);
      return answer.result.value;
    },
    close() { socket.close(); },
  };
}

// withStderr(failure, stderr) -> Error — `failure` with the tail of the Electron child's stderr (its last 500 characters) after its message, or the word that the child wrote
// nothing; the child's stderr is kept in memory by openWindow (`stderr()` of its result) and no other line writes it.
export function withStderr(failure, stderr) {
  if (stderr === undefined) return failure;
  const text = String(stderr ?? "").trim();
  const shown = text ? `the Electron child's stderr, its last ${Math.min(text.length, 500)} characters: ${text.slice(-500)}` : "the Electron child wrote nothing to its stderr";
  const error = new Error(`${failure?.message ?? failure}; ${shown}`, { cause: failure });
  return error;
}

// stageElectron() -> Promise<string> — the Electron executable, fetched and ready, and openbox installed where the screen is virtual.
export async function stageElectron() {
  await acquireLock();
  try {
    const started = Date.now();
    const executable = runtime();
    console.log(`site-usability staging: Electron ready after ${Date.now() - started} ms`);
    electronCommand(executable, []);
    console.log(`site-usability staging: display and window manager ready after ${Date.now() - started} ms`);
    return executable;
  } finally { rmdirSync(nativeFixtureLock); }
}

// openWindow(executable, address) -> Promise<{ page, close, stderr }> — a hidden Electron window that has loaded `address`; `page` is the
// DevTools session of its page (call, evaluate, close). `close` ends the page's session and the Electron, and removes its folder. `stderr()` is the
// tail of what the Electron wrote to its stderr so far (4000 characters at most; on Linux its stdout too, where xvfb-run puts its stderr). A failure of openWindow carries that tail (withStderr); `limit` is how long the
// window's page may take to appear among the debugging targets; `launch` ({ command, arguments_ }), where given, is started as it is, instead of the Electron behind the virtual display and the window manager
// (electronCommand): a stand-in that is no browser asks for neither (ITM-1020).
export async function openWindow(executable, address, { limit = 30000, launch = null } = {}) {
  const debug = await freePort();
  const folder = mkdtempSync(join(tmpdir(), "agent-m-904-entry-"));
  const entry = join(folder, "main.mjs");
  writeFileSync(entry, ENTRY);
  const launched = launch ?? electronCommand(executable, [...(process.platform === "linux" ? ["--no-sandbox"] : []), `--remote-debugging-port=${debug}`, `--user-data-dir=${join(folder, "data")}`, entry, `--fixture-url=${address}`]);
  const child = spawn(launched.command, launched.arguments_, { detached: process.platform === "linux", stdio: ["ignore", "pipe", "pipe"] });
  let stdout = "", stderr = "", spawnError = null, page = null;
  child.stdout.on("data", (chunk) => { stdout = `${stdout}${chunk}`.slice(-4000); });
  child.stderr.on("data", (chunk) => { stderr = `${stderr}${chunk}`.slice(-4000); });
  child.on("error", (error) => { spawnError = error; });
  // What the child wrote to its stderr. On Linux the child runs behind xvfb-run, which folds the child's stderr into its own stdout, so there it is the stdout too.
  const written = () => `${stderr}${process.platform === "linux" ? stdout : ""}`;
  const close = () => {
    page?.close();
    if (child.exitCode === null) {
      if (process.platform === "linux" && child.pid) { try { process.kill(-child.pid, "SIGTERM"); } catch { child.kill(); } } else child.kill();
    }
    child.stdout.destroy(); child.stderr.destroy(); child.unref();
    // The browser may still be writing its data folder as it ends: removal is tried again, and a folder that stays is left to the system's temporary folder.
    try { rmSync(folder, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }); } catch { /* left behind */ }
  };
  try {
    const target = await until("the window's page appears among the debugging targets", async () => {
      if (spawnError || child.exitCode !== null) throw new Error(`Electron stopped; exit=${child.exitCode}; error=${spawnError?.code ?? null}; stdout=${stdout}; stderr=${stderr}`);
      return (await (await fetch(`http://127.0.0.1:${debug}/json/list`)).json()).find((item) => item.url.startsWith("http://127.0.0.1"))?.webSocketDebuggerUrl;
    }, limit);
    page = await session(target);
    await readyPage(page);
    await until(`the window shows ${address}`, async () => (await page.evaluate("location.href", 3000)) === address);
    return { page, close, stderr: written };
  } catch (failure) { close(); throw failure.message.includes("; stderr=") ? failure : withStderr(failure, written()); }
}
