// The Electron that the native tests of the Bridge's app start (tests/desktop-shell.test.mjs, and tests/desktop-shell-bridge-jobs.test.mjs
// through tests/desktop-shell.d/electron.mjs) is first looked for where Agent M's own `setup` (tests/test-schedule-setup.sh) installs
// it, `$HOME/agent-m-electron-44`, a folder the schedule's `cache` names; only where it is not there do they install it from the npm
// registry themselves (ITM-1306). So a registry that does not answer while the tests run changes no outcome once the setup has run.
// Run: node --test tests/desktop-shell-electron-from-setup.test.mjs
//
// Module: MOD-desktop-shell
// Guards: A TEST THAT FLIPS ON THE SAME COMMIT IS FLAKY
// Level: component
//
// Each test states its input and its expected result before it runs (given / input / expect). The staging runs in a node process of
// its own, with `$HOME` and the temporary folder (where the tests keep their own install and their lock) moved into a scratch folder,
// and with npm's registry an address on loopback where nothing listens. The Electron of the setup is a stand-in file at the place of
// the executable that ends at once.

import assert from "node:assert/strict";
import test, { after } from "node:test";
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = new URL("..", import.meta.url).pathname;
const HELPER = new URL("../tests/desktop-shell.d/electron.mjs", import.meta.url).href;
const executableOf = (installed) => process.platform === "darwin" ? join(installed, "dist/Electron.app/Contents/MacOS/Electron") : join(installed, "dist/electron");
const escaped = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const work = mkdtempSync(join(tmpdir(), "agent-m-1306-desktop-"));
after(() => rmSync(work, { recursive: true, force: true }));
// A port on loopback where nothing listens: one the system gave and that is closed again.
const closedPort = () => new Promise((resolve) => { const server = createServer(); server.listen(0, "127.0.0.1", () => { const { port } = server.address(); server.close(() => resolve(port)); }); });

let counter = 0;
// A machine for a node process of its own: a home that holds the setup's Electron when `setUp` is true, an empty temporary folder, and
// npm's registry closed. Returns the environment, the temporary folder and the stand-in's path.
async function machine({ setUp }) {
  const dir = join(work, `machine-${counter++}`);
  const home = join(dir, "home"), temporary = join(dir, "tmp");
  mkdirSync(home, { recursive: true });
  mkdirSync(temporary);
  const standIn = executableOf(join(home, "agent-m-electron-44/node_modules/electron"));
  if (setUp) {
    mkdirSync(dirname(standIn), { recursive: true });
    writeFileSync(standIn, "#!/bin/sh\nexit 1\n");
    chmodSync(standIn, 0o755);
  }
  const port = await closedPort();
  const env = { ...process.env, HOME: home, TMPDIR: temporary, npm_config_registry: `http://127.0.0.1:${port}/`, npm_config_fetch_retries: "0", npm_config_cache: join(dir, "npm-cache") };
  return { env, temporary, standIn };
}
// stageApp(<temporary>/cache) of tests/desktop-shell.d/electron.mjs in a node process of its own. Returns the status, what it printed and the stand-in's path.
async function stageApp({ setUp }) {
  const { env, temporary, standIn } = await machine({ setUp });
  const done = spawnSync(process.execPath, ["--input-type=module", "-e", `const helper = await import(${JSON.stringify(HELPER)}); console.log("EXECUTABLE " + await helper.stageApp(${JSON.stringify(join(temporary, "cache"))}));`], { cwd: ROOT, encoding: "utf8", timeout: 60000, env });
  return { status: done.status, output: `${done.stdout}${done.stderr}`, standIn };
}

// TST-1306201 · level: component · module: MOD-desktop-shell
// guards: A TEST THAT FLIPS ON THE SAME COMMIT IS FLAKY
// given: a home that holds Electron where the setup installs it (agent-m-electron-44/node_modules/electron), an empty cache folder of the file's own, and npm's registry an address where nothing listens
// input: stageApp(cache) of tests/desktop-shell.d/electron.mjs
// expect: exit code 0; it gives the executable in the home's folder agent-m-electron-44, and no stage "Electron package acquisition" is recorded
test("TST-1306201: the Bridge app's Electron is taken from the setup's folder, and the registry is not asked", async () => {
  const result = await stageApp({ setUp: true });
  assert.equal(result.status, 0, result.output);
  assert.match(result.output, new RegExp(`EXECUTABLE ${escaped(result.standIn)}\\n`));
  assert.doesNotMatch(result.output, /"stage":"Electron package acquisition"/);
});

// TST-1306202 · level: component · module: MOD-desktop-shell
// guards: A TEST THAT FLIPS ON THE SAME COMMIT IS FLAKY
// given: the machine of TST-1306201 without the setup's Electron in the home
// input: stageApp(cache) of tests/desktop-shell.d/electron.mjs
// expect: a status other than 0 and "Electron package acquisition failed": the helper's own install asks the registry, which does not answer, so the case above is able to fail
test("TST-1306202: without the setup's Electron the helper asks the registry, and a registry that does not answer fails the acquisition", async () => {
  const result = await stageApp({ setUp: false });
  assert.notEqual(result.status, 0, result.output);
  assert.match(result.output, /Electron package acquisition failed/);
});

// TST-1306203 · level: component · module: MOD-desktop-shell
// guards: A TEST THAT FLIPS ON THE SAME COMMIT IS FLAKY
// given: the machine of TST-1306201, on Linux with xvfb-run and openbox installed, as the CI's setup leaves it
// input: tests/desktop-shell.test.mjs run by node with a name pattern that none of its cases matches, so that only its staging before the cases runs
// expect: its staging records the stage "ready" with the executable in the home's folder agent-m-electron-44, and no stage "Electron package acquisition". Skipped, and says so, off Linux, where that file stages nothing
test("TST-1306203: the staging of tests/desktop-shell.test.mjs takes the setup's Electron, and the registry is not asked", { skip: process.platform === "linux" ? false : "the file stages Electron only on Linux, under xvfb-run" }, async () => {
  const { env, standIn } = await machine({ setUp: true });
  const done = spawnSync(process.execPath, ["--test-name-pattern=^no case of the file has this name$", "tests/desktop-shell.test.mjs"], { cwd: ROOT, encoding: "utf8", timeout: 60000, env });
  const output = `${done.stdout}${done.stderr}`;
  assert.match(output, new RegExp(`"stage":"ready","electron":"44\\.5\\.1","executable":"${escaped(standIn)}"`), output);
  assert.doesNotMatch(output, /"stage":"Electron package acquisition"/);
});
