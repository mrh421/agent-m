// Agent M's own `setup` (tests/test-schedule-setup.sh, the `setup` of docs/tests/schedule.md) installs the Electron that the tests
// which start Electron use, into a folder the schedule's `cache` names, so that those tests find it there and fetch nothing from
// the npm registry while they run (ITM-1306). The setup runs in the job `agent-m setup`, which fills the cache, and again in every
// test job after the cache is restored: where the Electron stands already, it installs nothing.
// Run: node --test tests/test-schedule-setup-electron.test.mjs
//
// Module: MOD-test-schedule
// Guards: A TEST THAT FLIPS ON THE SAME COMMIT IS FLAKY
// Level: system
//
// Each test states its input and its expected result before it runs (given / input / expect). The script runs unchanged under `sh`,
// as the schedule's `setup` runs it, with `$HOME` a scratch folder and with `sudo`, `apt-get`, `openbox` and `npm` found first on the
// PATH as scripts of this file: `sudo` runs its command; `apt-get` installs from the cache (a call with `--no-download` ends with 0)
// and refuses every other call; `openbox` answers its version; `npm` records its arguments, one call per line, and ends with 0. A call
// of `npm` that installs electron@44.5.1 leaves, as npm does, the package without its executable: `node_modules/electron/install.js`
// under its `--prefix`, a script that records `install.js` among the calls when node runs it (the real one downloads `dist/electron`).

import assert from "node:assert/strict";
import test, { after } from "node:test";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const SETUP = new URL("../tests/test-schedule-setup.sh", import.meta.url);

const work = mkdtempSync(join(tmpdir(), "agent-m-1306-setup-"));
after(() => rmSync(work, { recursive: true, force: true }));
const shim = join(work, "bin");
mkdirSync(shim);
for (const [name, body] of [
  ["sudo", '#!/bin/sh\nexec "$@"\n'],
  ["apt-get", '#!/bin/sh\ncase " $* " in *" --no-download "*) exit 0;; esac\necho "E: a call outside the cache path: $*" >&2\nexit 100\n'],
  ["openbox", "#!/bin/sh\necho openbox 3.6.1\n"],
  ["npm", `#!/bin/sh
echo "$*" >> "$FAKE_NPM"
case " $* " in *" electron@44.5.1 "*)
  prefix=""; previous=""
  for argument in "$@"; do [ "$previous" = "--prefix" ] && prefix="$argument"; previous="$argument"; done
  mkdir -p "$prefix/node_modules/electron"
  printf '%s\\n' 'require("node:fs").appendFileSync(process.env.FAKE_NPM, "install.js\\n");' > "$prefix/node_modules/electron/install.js";;
esac
exit 0
`],
]) {
  writeFileSync(join(shim, name), body);
  chmodSync(join(shim, name), 0o755);
}

let counter = 0;
// Run the setup on a machine whose home is a scratch folder; `prepare(home)` puts what the machine holds before the run. Returns the
// status, the stderr, the home and npm's calls.
function run(prepare = () => {}) {
  const dir = join(work, `machine-${counter++}`);
  const home = join(dir, "home");
  mkdirSync(home, { recursive: true });
  prepare(home);
  const calls = join(dir, "npm-calls");
  writeFileSync(calls, "");
  const done = spawnSync("sh", [SETUP.pathname], {
    cwd: dir, encoding: "utf8", timeout: 20000,
    env: { PATH: `${shim}:${process.env.PATH}`, HOME: home, FAKE_NPM: calls },
  });
  return { status: done.status, stderr: done.stderr, home, npm: readFileSync(calls, "utf8").split("\n").filter(Boolean) };
}

// TST-1306001 · level: system · module: MOD-test-schedule
// guards: A TEST THAT FLIPS ON THE SAME COMMIT IS FLAKY
// given: a machine whose home holds no folder agent-m-electron-44 (the cache was not restored)
// input: tests/test-schedule-setup.sh, run under `sh`
// expect: exit code 0; npm is called exactly once for Electron, with `install --no-save --prefix <home>/agent-m-electron-44 electron@44.5.1`, and after it the package's install.js runs, which downloads the executable
test("TST-1306001: the setup installs Electron 44.5.1 and its executable into the home's folder agent-m-electron-44 where it is missing", () => {
  const result = run();
  assert.equal(result.status, 0, result.stderr);
  const electron = result.npm.filter((call) => /electron|install\.js/.test(call));
  assert.deepEqual(electron, [`install --no-save --prefix ${join(result.home, "agent-m-electron-44")} electron@44.5.1`, "install.js"]);
});

// TST-1306002 · level: system · module: MOD-test-schedule
// guards: A TEST THAT FLIPS ON THE SAME COMMIT IS FLAKY
// given: a machine whose home holds the Electron executable at agent-m-electron-44/node_modules/electron/dist/electron (the cache was restored)
// input: tests/test-schedule-setup.sh, run under `sh`
// expect: exit code 0; npm is not called for Electron, and is still called for the Bridge app's packages (`--prefix src/bridge-build`), which shows that the record of npm's calls is read
test("TST-1306002: the setup installs nothing for Electron where the restored cache holds it", () => {
  const result = run((home) => {
    const dist = join(home, "agent-m-electron-44/node_modules/electron/dist");
    mkdirSync(dist, { recursive: true });
    writeFileSync(join(dist, "electron"), "#!/bin/sh\nexit 0\n");
    chmodSync(join(dist, "electron"), 0o755);
  });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.npm.filter((call) => /electron|install\.js/.test(call)), []);
  assert.ok(result.npm.some((call) => call.includes("--prefix src/bridge-build")), `npm's calls: ${JSON.stringify(result.npm)}`);
});
