// The Electron that tests/site-usability.d/browser.mjs stages for the site's tests (site-usability, site-accessibility,
// markdown-render-918-diagram-drawn, release-itm-1174-917-rendered) is first looked for where Agent M's own `setup`
// (tests/test-schedule-setup.sh) installs it, `$HOME/agent-m-electron-44`, a folder the schedule's `cache` names; only where it is
// not there does the helper install it from the npm registry itself (ITM-1306). So a registry that does not answer while the tests run
// changes no outcome once the setup has run.
// Run: node --test tests/site-usability-electron-from-setup.test.mjs
//
// Module: MOD-site-frame
// Guards: A TEST THAT FLIPS ON THE SAME COMMIT IS FLAKY
// Level: system
//
// Each test states its input and its expected result before it runs (given / input / expect). The helper runs in a node process of
// its own, with `$HOME` and the temporary folder (where the helper keeps its own install and its lock) moved into a scratch folder,
// and with npm's registry an address on loopback where nothing listens. The Electron of the setup is a stand-in file at the place of
// the executable; it is never started.

import assert from "node:assert/strict";
import test, { after } from "node:test";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = new URL("..", import.meta.url).pathname;
const HELPER = new URL("../tests/site-usability.d/browser.mjs", import.meta.url).href;
const BUNDLED = "/private/tmp/agent-m-electron-44/node_modules/electron";
const executableOf = (installed) => process.platform === "darwin" ? join(installed, "dist/Electron.app/Contents/MacOS/Electron") : join(installed, "dist/electron");

const work = mkdtempSync(join(tmpdir(), "agent-m-1306-site-"));
after(() => rmSync(work, { recursive: true, force: true }));
// A port on loopback where nothing listens: one the system gave and that is closed again.
const closedPort = () => new Promise((resolve) => { const server = createServer(); server.listen(0, "127.0.0.1", () => { const { port } = server.address(); server.close(() => resolve(port)); }); });

let counter = 0;
// The helper's staging in a node process of its own, on a machine whose home holds the setup's Electron when `setUp` is true. Returns
// the status, what it printed and the stand-in's path.
async function stage({ setUp }) {
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
  const done = spawnSync(process.execPath, ["--input-type=module", "-e", `const helper = await import(${JSON.stringify(HELPER)}); console.log("EXECUTABLE " + await helper.stageElectron());`], {
    cwd: ROOT, encoding: "utf8", timeout: 60000,
    env: { ...process.env, HOME: home, TMPDIR: temporary, npm_config_registry: `http://127.0.0.1:${port}/`, npm_config_fetch_retries: "0", npm_config_cache: join(dir, "npm-cache") },
  });
  return { status: done.status, output: `${done.stdout}${done.stderr}`, standIn };
}

// TST-1306101 · level: system · module: MOD-site-frame
// guards: A TEST THAT FLIPS ON THE SAME COMMIT IS FLAKY
// given: a home that holds Electron where the setup installs it (agent-m-electron-44/node_modules/electron), an empty temporary folder, and npm's registry an address where nothing listens
// input: stageElectron() of tests/site-usability.d/browser.mjs
// expect: exit code 0; it gives the executable in the home's folder agent-m-electron-44, and nothing fails at "Electron package staging"
test("TST-1306101: the site's Electron is taken from the setup's folder, and the registry is not asked", async () => {
  const result = await stage({ setUp: true });
  assert.equal(result.status, 0, result.output);
  assert.match(result.output, new RegExp(`EXECUTABLE ${result.standIn.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\n`));
  assert.doesNotMatch(result.output, /Electron package staging failed/);
});

// TST-1306102 · level: system · module: MOD-site-frame
// guards: A TEST THAT FLIPS ON THE SAME COMMIT IS FLAKY
// given: the machine of TST-1306101 without the setup's Electron in the home
// input: stageElectron() of tests/site-usability.d/browser.mjs
// expect: a status other than 0 and "Electron package staging failed": the helper's own install asks the registry, which does not answer, so the case above is able to fail. Skipped, and says so, where a bundled Electron stands at /private/tmp/agent-m-electron-44
test("TST-1306102: without the setup's Electron the helper asks the registry, and a registry that does not answer fails the staging", async (t) => {
  if (existsSync(executableOf(BUNDLED))) { t.skip(`a bundled Electron stands at ${BUNDLED}, which the helper takes before it asks the registry`); return; }
  const result = await stage({ setUp: false });
  assert.notEqual(result.status, 0, result.output);
  assert.match(result.output, /Electron package staging failed/);
});
