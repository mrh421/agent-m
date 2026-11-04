// The start of the Bridge's app, src/desktop-shell/main.mjs, in a real Electron from the source folder — a helper of the native tests of MOD-desktop-shell, no test of its own. It stages the Electron of
// the tests (npm, once per cache folder), puts it under a virtual screen on Linux as tests/desktop-shell.test.mjs does, starts the entry with the command-line arguments of a start from the source folder
// and stops it. The Bridge's window is not driven here: a test speaks to the Bridge through its API on loopback. It holds no expected result.
//
// Module: MOD-desktop-shell
// Level: unit

import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, rmdirSync } from "node:fs";
import { homedir } from "node:os";
import { delimiter, join } from "node:path";
import assert from "node:assert/strict";

const root = new URL("../../", import.meta.url).pathname;
const appEnvironment = { ...process.env, NODE_PATH: [join(root, "src/bridge-build/node_modules"), process.env.NODE_PATH].filter(Boolean).join(delimiter) };

// Electron's windows show on the screen unless a virtual screen holds them. The native tests therefore run only on Linux, under xvfb-run, as on the CI; elsewhere each is skipped with this reason, and
// Electron is neither installed nor started.
export const NO_VIRTUAL_SCREEN = process.platform === "linux" ? false
  : "needs a virtual screen: runs only on Linux under xvfb-run, as on the CI; elsewhere Electron's windows would show";

const scrub = (value) => String(value).replace(/[A-Za-z0-9_-]{32,}/g, "[redacted]");
const evidence = (stage, result) => {
  const found = { stage, status: result.status, signal: result.signal, error: result.error?.code ?? null, stdout: scrub(result.stdout), stderr: scrub(result.stderr) };
  process.stdout.write(`native-fixture ${JSON.stringify(found)}\n`);
  return found;
};

// holdLock(path) / releaseLock(path) — the one lock the native Electron tests of a machine share: a folder that exists while a file holds it. holdLock waits for it up to 30 s and throws after that.
let held = null;
export async function holdLock(path) {
  for (let n = 0; n < 240; n += 1) {
    try { mkdirSync(path); held = path; return; }
    catch (failure) { if (failure.code !== "EEXIST") throw failure; }
    await new Promise((resolve) => setTimeout(resolve, 125));
  }
  throw new Error("Timed out waiting for the native Electron fixture lock.");
}
export function releaseLock() { if (held) { rmdirSync(held); held = null; } }

let runtimeFailure, displayFailure, managerFailure;

// stageElectron(cache) -> Promise<string> — the Electron 44.5.1 executable, installed into `cache` with npm on first use.
async function stageElectron(cache) {
  const executableOf = (installed) => process.platform === "darwin" ? join(installed, "dist/Electron.app/Contents/MacOS/Electron") : join(installed, "dist/electron");
  const installed = join(cache, "node_modules/electron");
  if (runtimeFailure) throw runtimeFailure;
  const acquire = (stage, command, args) => {
    const started = Date.now(), result = spawnSync(command, args, { encoding: "utf8", timeout: 40000 });
    const found = evidence(`Electron ${stage}`, result);
    if (result.status !== 0) throw new Error(`Electron ${stage} failed after ${Date.now() - started}ms; ${JSON.stringify(found)}`);
  };
  // Where Agent M's schedule `setup` (tests/test-schedule-setup.sh) installs Electron, a path the schedule's `cache` names: first.
  const setUp = join(homedir(), "agent-m-electron-44/node_modules/electron");
  if (existsSync(executableOf(setUp))) return executableOf(setUp);
  try {
    if (!existsSync(executableOf(installed))) {
      acquire("package acquisition", "npm", ["install", "--no-save", "--prefix", cache, "electron@44.5.1"]);
      acquire("binary acquisition", process.execPath, [join(installed, "install.js")]);
    }
    assert.equal(existsSync(executableOf(installed)), true, "Electron 44.5.1 executable was not acquired.");
    return executableOf(installed);
  } catch (failure) { runtimeFailure = failure; throw failure; }
}

// electronCommand(executable, args) -> { command, args } — on Linux the command under xvfb-run with the window manager openbox (installed where missing); elsewhere the executable itself.
function electronCommand(executable, args) {
  if (process.platform !== "linux") return { command: executable, args };
  if (displayFailure) throw displayFailure;
  const probe = spawnSync("xvfb-run", ["--help"], { encoding: "utf8", timeout: 5000 });
  const displayEvidence = evidence("Linux virtual display probe", probe);
  if (probe.status !== 0) {
    displayFailure = new Error(`Linux virtual display probe failed; ${JSON.stringify(displayEvidence)}`);
    throw displayFailure;
  }
  const manager = spawnSync("openbox", ["--version"], { encoding: "utf8", timeout: 5000 });
  evidence("Linux Openbox initial probe", manager);
  if (manager.status !== 0) {
    if (managerFailure) throw managerFailure;
    const started = Date.now(), install = spawnSync("sudo", ["apt-get", "-o", "Debug::Acquire::http=true", "-o", "DPkg::Lock::Timeout=50", "-o", "Acquire::Retries=3", "install", "--yes", "--no-install-recommends", "openbox"], { encoding: "utf8", timeout: 60000 });
    const installEvidence = evidence("Linux Openbox install", install);
    let available = spawnSync("openbox", ["--version"], { encoding: "utf8", timeout: 5000 });
    let availableEvidence = evidence("Linux Openbox ready probe", available);
    const locked = install.status !== 0 && /lock-frontend/.test(String(install.stderr));
    if (locked) {
      for (let n = 0; n < 160 && available.status !== 0; n += 1) {
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250);
        available = spawnSync("openbox", ["--version"], { encoding: "utf8", timeout: 5000 });
        availableEvidence = evidence("Linux Openbox ready probe", available);
      }
    }
    if ((!locked && install.status !== 0) || available.status !== 0) {
      managerFailure = new Error(`Linux Openbox fixture failed after ${Date.now() - started}ms; install=${JSON.stringify(installEvidence)}; probe=${JSON.stringify(availableEvidence)}`);
      throw managerFailure;
    }
  }
  return { command: "xvfb-run", args: ["--auto-servernum", "--server-args=-screen 0 1280x1024x24", "sh", "-c", "openbox >/dev/null 2>&1 & wm=$!; trap 'kill \"$wm\" 2>/dev/null; wait \"$wm\" 2>/dev/null' EXIT INT TERM; \"$@\"; status=$?; exit \"$status\"", "agent-m-xvfb-openbox", executable, ...args] };
}

// stageApp(cache) -> Promise<string> — what a file stages before its tests: that the Bridge's modules load with the packages of the Bridge build, the Electron and, on Linux, the virtual screen. Returns the executable.
export async function stageApp(cache) {
  const modules = spawnSync(process.execPath, ["--input-type=module", "-e", "await import('./src/desktop-shell/compose.mjs')"], { cwd: root, env: appEnvironment, encoding: "utf8", timeout: 5000 });
  const moduleEvidence = evidence("Bridge app module staging", modules);
  assert.equal(modules.status, 0, `Bridge app modules did not load; ${JSON.stringify(moduleEvidence)}`);
  const executable = await stageElectron(cache);
  electronCommand(executable, []);
  return executable;
}

// startApp({ executable, dataFolder, port, environment, instance, origin }) -> { child, exited, output, alive, stop } — the entry src/desktop-shell/main.mjs started from the source folder, as the native tests start
// it, with the instance and the origin on its command line and `environment` added to the environment of the process. `output()` is the tail of what it wrote; `alive()` throws once it has exited; `stop()` ends it
// and what it started, and resolves once it has exited.
export function startApp({ executable, dataFolder, port, environment = {}, instance = "release-owner/release-frame", origin = "https://release-owner.github.io" }) {
  const args = [...(process.platform === "linux" ? ["--no-sandbox"] : []), "src/desktop-shell/main.mjs", `--instance=${instance}`, `--origin=${origin}`, `--port=${port}`, `--data-folder=${dataFolder}`];
  const launched = electronCommand(executable, args);
  const child = spawn(launched.command, launched.args, { cwd: root, detached: process.platform === "linux", env: { ...appEnvironment, ...environment }, stdio: ["ignore", "pipe", "pipe"] });
  let text = "", spawnError = null;
  for (const stream of [child.stdout, child.stderr]) stream.on("data", (chunk) => { text = `${text}${chunk}`.slice(-4000); });
  child.on("error", (error) => { spawnError = error; });
  const exited = new Promise((resolve) => child.once("exit", resolve));
  const stop = async () => {
    if (child.exitCode === null && child.signalCode === null) {
      try { process.platform === "linux" ? process.kill(-child.pid, "SIGTERM") : child.kill(); } catch { child.kill(); }
      let timer;
      try { await Promise.race([exited, new Promise((resolve) => { timer = setTimeout(resolve, 10000); })]); } finally { clearTimeout(timer); }
      if (child.exitCode === null && child.signalCode === null) { try { process.platform === "linux" ? process.kill(-child.pid, "SIGKILL") : child.kill("SIGKILL"); } catch { child.kill("SIGKILL"); } }
    }
    child.stdout.destroy(); child.stderr.destroy(); child.unref();
  };
  // Throws once the app has exited: for the `fatal` of wait(), which ends a wait on an app that is gone.
  const alive = () => { if (spawnError || child.exitCode !== null || child.signalCode !== null) throw new Error(`Electron exited=${child.exitCode}; signal=${child.signalCode}; error=${spawnError?.code ?? null}; output=${scrub(text)}`); };
  return { child, exited, output: () => scrub(text), alive, stop };
}
