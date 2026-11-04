// The install of xvfb and openbox from the cached archives does not spend its time before and in dpkg (ITM-1193), now in
// `tests/test-schedule-setup.sh` — Agent M's own `setup` (docs/tests/schedule.md), run in every test job before its tests
// (MOD-test-schedule, Parts, *Agent M's own `command` and `setup`*). The script starts, before it installs anything and in the
// background, the read of dpkg's file lists (dpkg reads one small file per installed package before it installs anything, and on
// a runner whose disk is cold that read is the slow part of the install), and before it calls apt it takes away the four programs
// that apt and dpkg would run around the install and that a throwaway runner has no use for: the pre-configure hook of debconf
// (`/usr/sbin/dpkg-preconfigure`), update-notifier's check of the available updates after dpkg
// (`/usr/lib/update-notifier/update-motd-updates-available`), and needrestart's two hooks (`/usr/lib/needrestart/apt-pinvoke` and
// `dpkg-status`) — on a runner of GitHub Actions only, and without failing where a program cannot be taken away (SPEC.md,
// A PULL REQUEST'S CI RUNS WITHIN TWO MINUTES). These are the checks the file of the same name made on the transitional
// `.github/workflows/tests.yml`, carried over onto the script that took that step's place (ITM-476).
// Run: node --test tests/test-schedule-dpkg-time.test.mjs
//
// Module: MOD-test-schedule
// Guards: A PULL REQUEST'S CI RUNS WITHIN TWO MINUTES
// Level: system
//
// Each test states its input and its expected result before it runs (given / input / expect). The script runs unchanged under
// `sh`, as the schedule's `setup` runs it, with the paths of the machine moved into a scratch folder (`$HOME`, the four programs
// above, `/var/lib/dpkg/info`) and with `sudo`, `apt-get`, `npm`, `openbox` and, in the warm-up cases, `cat` found first on the
// PATH as scripts of this file:
//   - `apt-get` is the model of the hooks: when it is called it records, for each of the four programs in the order above,
//     `hook-ran:<name>` if the file that stands for the program is executable and `hook-skipped:<name>` if it is not (apt and dpkg
//     run a hook only if they can execute it), then `install-from-cache` for a call with `--no-download`; any other call stops
//     with exit code 100, so that a script that leaves the cache path fails loudly.
//   - `sudo` runs its command, or, when FAKE_SUDO_DENY is set, refuses `chmod -x` with exit code 1 (a machine where the programs
//     cannot be taken away).
//   - `npm` and `openbox` do nothing and end with 0; a call of `npm` that installs electron@44.5.1 leaves, as npm does, the
//     package's `node_modules/electron/install.js` under its `--prefix`, here a script that does nothing.
//   - `cat` records the files it is given and then waits one second, so that a read that the script waits for takes a second
//     longer than one that it does not.
// The counter-proof of the cases on the hooks is the same script with the `chmod` replaced by `true` (the model then records
// `hook-ran:` for each); that of the cases on the warm-up is the same script with its `&` removed (the script then waits for the
// read).

import assert from "node:assert/strict";
import test, { after } from "node:test";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { spawnSync } from "node:child_process";

const SETUP = "tests/test-schedule-setup.sh";
// The setup script as committed.
const script = () => readFileSync(new URL(`../${SETUP}`, import.meta.url), "utf8");

// The programs the setup takes away, in the order the model of apt reports them.
const HOOKS = [
  "/usr/sbin/dpkg-preconfigure",
  "/usr/lib/update-notifier/update-motd-updates-available",
  "/usr/lib/needrestart/apt-pinvoke",
  "/usr/lib/needrestart/dpkg-status",
];
const skipped = HOOKS.map((hook) => `hook-skipped:${basename(hook)}`);
const ran = HOOKS.map((hook) => `hook-ran:${basename(hook)}`);

const APT = `#!/bin/bash
echo "apt-get $*" >> "$FAKE_CALLS"
for hook in $FAKE_HOOKS; do
  if [ -x "$hook" ]; then echo "hook-ran:$(basename "$hook")" >> "$FAKE_EVENTS"; else echo "hook-skipped:$(basename "$hook")" >> "$FAKE_EVENTS"; fi
done
case " $* " in *" --no-download "*) echo install-from-cache >> "$FAKE_EVENTS"; exit 0;; esac
echo "E: a call outside the cache path: $*" >&2
exit 100
`;
const SUDO = `#!/bin/bash
if [ -n "$FAKE_SUDO_DENY" ] && [ "$1" = chmod ] && [ "$2" = -x ]; then echo "sudo: chmod refused" >&2; exit 1; fi
exec "$@"
`;
const NPM = `#!/bin/bash
case " $* " in *" electron@44.5.1 "*)
  prefix=""; previous=""
  for argument in "$@"; do [ "$previous" = "--prefix" ] && prefix="$argument"; previous="$argument"; done
  mkdir -p "$prefix/node_modules/electron" && : > "$prefix/node_modules/electron/install.js";;
esac
exit 0
`;
const CAT = `#!/bin/bash
for file in "$@"; do echo "$file" >> "$FAKE_READ"; done
sleep 1
`;

const work = mkdtempSync(join(tmpdir(), "agent-m-1193-"));
after(() => rmSync(work, { recursive: true, force: true }));
const shim = join(work, "bin");
const catShim = join(work, "cat-bin");
mkdirSync(shim);
mkdirSync(catShim);
for (const [dir, name, body] of [[shim, "apt-get", APT], [shim, "sudo", SUDO], [shim, "openbox", "#!/bin/bash\necho openbox 3.6.1\n"], [shim, "npm", NPM],
  [catShim, "cat", CAT]]) {
  writeFileSync(join(dir, name), body);
  chmodSync(join(dir, name), 0o755);
}

let counter = 0;
// A machine: its own home, a file for each of the four programs (executable), its folder of dpkg's file lists with five lists, and its record.
function machine() {
  const dir = join(work, `machine-${counter++}`);
  const host = { dir, home: join(dir, "home"), hooks: HOOKS.map((hook) => join(dir, "hooks", basename(hook))), info: join(dir, "info"), events: join(dir, "events"), calls: join(dir, "calls"), read: join(dir, "read") };
  mkdirSync(host.home, { recursive: true });
  mkdirSync(join(dir, "hooks"));
  mkdirSync(host.info);
  for (const name of ["a", "b", "c", "d", "e"]) writeFileSync(join(host.info, `${name}.list`), "/usr/bin/x\n");
  for (const hook of host.hooks) {
    writeFileSync(hook, "#!/bin/sh\nexit 0\n");
    chmodSync(hook, 0o755);
  }
  for (const file of [host.events, host.calls, host.read]) writeFileSync(file, "");
  return host;
}
const lines = (path) => readFileSync(path, "utf8").split("\n").filter(Boolean);
const executable = (path) => (statSync(path).mode & 0o111) !== 0;
// Run a script on a machine as the schedule's setup runs (`sh <file>`), with the machine's paths in place of the runner's. `env` adds to the environment;
// `shims` is the PATH folders of the case, before the system's. Returns the status, the stderr, the seconds the script took and what the shims recorded.
function run(script, host, { env = {}, shims = shim } = {}) {
  let moved = script.replaceAll("/var/lib/dpkg/info", host.info);
  HOOKS.forEach((hook, index) => { moved = moved.replaceAll(hook, host.hooks[index]); });
  const started = Date.now();
  const file = join(host.dir, "setup.sh");
  writeFileSync(file, moved);
  const done = spawnSync("sh", [file], {
    cwd: host.dir,
    encoding: "utf8",
    timeout: 20000,
    stdio: ["ignore", "pipe", "pipe"],
    env: { PATH: `${shims}:${process.env.PATH}`, HOME: host.home, FAKE_EVENTS: host.events, FAKE_CALLS: host.calls, FAKE_HOOKS: host.hooks.join(" "), FAKE_READ: host.read, ...env },
  });
  return { status: done.status, stderr: done.stderr, seconds: (Date.now() - started) / 1000, events: lines(host.events), calls: lines(host.calls) };
}
// The same script with the removal of the programs made a no-op.
const withoutRemoval = (text) => {
  assert.match(text, /sudo chmod -x "\$hook"/, 'the script takes each program away with sudo chmod -x "$hook" (known positive of the replacement below)');
  return text.replace(/sudo chmod -x "\$hook"/, "true");
};
// Wait up to five seconds for the file `path` to hold `count` lines.
async function linesOf(path, count) {
  for (let waited = 0; waited < 5000; waited += 100) {
    if (lines(path).length >= count) break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return lines(path);
}

// TST-1193001 · level: system · module: MOD-test-schedule
// guards: A PULL REQUEST'S CI RUNS WITHIN TWO MINUTES
// given: tests/test-schedule-setup.sh, a machine of GitHub Actions (GITHUB_ACTIONS is set) on which the four programs are executable and the cache holds the archives
// input: tests/test-schedule-setup.sh, run under `sh` against the model of apt
// expect: exit code 0; when apt is called none of the four programs is executable (`hook-skipped:` for each, in the order dpkg-preconfigure, update-motd-updates-available, apt-pinvoke, dpkg-status), and apt installs from the cache (`install-from-cache`), in this order and nothing else; afterwards none is executable
// Planted fault: a script that leaves one of the four programs executable records `hook-ran:` for it (TST-1193002 shows the model able to).
test("setup: the setup takes the hooks of debconf, update-notifier and needrestart away before apt runs them", () => {
  const host = machine();
  const result = run(script(), host, { env: { GITHUB_ACTIONS: "true" } });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.events, [...skipped, "install-from-cache"]);
  assert.deepEqual(host.hooks.map(executable), [false, false, false, false], "none of the four is executable afterwards");
});

// TST-1193002 · level: system · module: MOD-test-schedule
// guards: A PULL REQUEST'S CI RUNS WITHIN TWO MINUTES
// given: the machine of TST-1193001
// input: the same script with `sudo chmod -x "$hook"` replaced by `true`, run under `sh` against the model of apt
// expect: exit code 0; the model records `hook-ran:` for each of the four and then `install-from-cache`, which shows that the model sees a hook where the script leaves it
// Planted fault: a model whose apt records `hook-skipped:` whatever the file's mode fails this case and TST-1193001.
test("setup: the same script without the removal leaves the hooks to run, as apt would run them", () => {
  const host = machine();
  const result = run(withoutRemoval(script()), host, { env: { GITHUB_ACTIONS: "true" } });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.events, [...ran, "install-from-cache"]);
  assert.deepEqual(host.hooks.map(executable), [true, true, true, true]);
});

// TST-1193003 · level: system · module: MOD-test-schedule
// guards: A PULL REQUEST'S CI RUNS WITHIN TWO MINUTES
// given: a machine that is no runner of GitHub Actions (GITHUB_ACTIONS is not set) on which the four programs are executable
// input: tests/test-schedule-setup.sh, run under `sh` against the model of apt
// expect: exit code 0; the four programs are still executable afterwards and apt runs them (`hook-ran:` for each): the script changes nothing on a machine that is not a throwaway runner
// Planted fault: a script that takes the programs away without asking for GITHUB_ACTIONS fails.
test("setup: the setup leaves the hooks alone on a machine that is not a runner of GitHub Actions", () => {
  const host = machine();
  const result = run(script(), host);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.events, [...ran, "install-from-cache"]);
  assert.deepEqual(host.hooks.map(executable), [true, true, true, true]);
});

// TST-1193004 · level: system · module: MOD-test-schedule
// guards: A PULL REQUEST'S CI RUNS WITHIN TWO MINUTES
// given: a machine of GitHub Actions where sudo refuses `chmod` (FAKE_SUDO_DENY), on which the four programs are executable
// input: tests/test-schedule-setup.sh, run under `sh` against the model of apt
// expect: exit code 0 and `install-from-cache`: programs that cannot be taken away only make the install slower, they do not fail the setup
// Planted fault: the removal without `|| true` stops the script with exit code 1 (TST-1193005).
test("setup: hooks that cannot be taken away do not fail the setup", () => {
  const host = machine();
  const result = run(script(), host, { env: { GITHUB_ACTIONS: "true", FAKE_SUDO_DENY: "1" } });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.events, [...ran, "install-from-cache"]);
});

// TST-1193005 · level: system · module: MOD-test-schedule
// guards: A PULL REQUEST'S CI RUNS WITHIN TWO MINUTES
// given: the machine of TST-1193004
// input: the same script with `|| true` removed after the removal of a program, run under `sh` against the model of apt
// expect: exit code 1 and no `install-from-cache`, which shows that TST-1193004 is able to fail
// Planted fault: a script whose removal ignores the refusal in another way passes TST-1193004 and fails this case, which then names the way.
test("setup: the removal without its guard against a refusal stops the script, as TST-1193004 would show", () => {
  const text = script();
  const guarded = /sudo chmod -x "\$hook" \|\| true/;
  assert.match(text, guarded, "the script ignores a refusal of the removal with || true (known positive of the replacement below)");
  const host = machine();
  const result = run(text.replace(guarded, (match) => match.replace(" || true", "")), host, { env: { GITHUB_ACTIONS: "true", FAKE_SUDO_DENY: "1" } });
  assert.equal(result.status, 1, result.stderr);
  assert.deepEqual(result.events, []);
});

// TST-1193006 · level: system · module: MOD-test-schedule
// guards: A PULL REQUEST'S CI RUNS WITHIN TWO MINUTES
// given: tests/test-schedule-setup.sh, a machine whose folder of dpkg's file lists holds five lists, and a `cat` that records its files and then waits one second
// input: tests/test-schedule-setup.sh, run under `sh`
// expect: exit code 0 within half a second, although the read takes a second: the script does not wait for it; and within five seconds the five lists have been given to `cat`
// Planted fault: a script that waits for the read takes more than half a second (TST-1193007); one that reads no list records fewer than five files.
test("setup: the setup reads dpkg's file lists in the background, without waiting for the read", async () => {
  const host = machine();
  const result = run(script(), host, { shims: `${catShim}:${shim}` });
  assert.equal(result.status, 0, result.stderr);
  assert.ok(result.seconds < 0.5, `the script returned after ${result.seconds} s`);
  const files = await linesOf(host.read, 5);
  assert.deepEqual(files.map((file) => file.replace(/^.*\//, "")).sort(), ["a.list", "b.list", "c.list", "d.list", "e.list"]);
});

// TST-1193007 · level: system · module: MOD-test-schedule
// guards: A PULL REQUEST'S CI RUNS WITHIN TWO MINUTES
// given: the machine of TST-1193006
// input: the same script with the `&` that puts the read into the background removed, run under `sh`
// expect: exit code 0 after at least 0.9 seconds: the script now waits for the read, which shows that TST-1193006 is able to fail
// Planted fault: a `cat` that returns at once fails this case and passes TST-1193006 whatever the script does.
test("setup: the same script without the background waits for the read, as TST-1193006 would show", () => {
  const text = script();
  const background = /\s&\s*\)/;
  assert.match(text, background, "the read ends in & before the closing parenthesis (known positive of the replacement below)");
  const host = machine();
  const result = run(text.replace(background, ")"), host, { shims: `${catShim}:${shim}` });
  assert.equal(result.status, 0, result.stderr);
  assert.ok(result.seconds >= 0.9, `the script returned after ${result.seconds} s`);
});

// TST-1193008 · level: system · module: MOD-test-schedule
// guards: A PULL REQUEST'S CI RUNS WITHIN TWO MINUTES
// given: tests/test-schedule-setup.sh and the committed .github/workflows/agent-m-tests.yml
// input: the lines of the script; the steps of each job of the workflow that runs the tests of a row (`runTests`)
// expect: the read of dpkg's file lists (`/var/lib/dpkg/info/*.list`) is the script's first command, before the removal of the programs and before the first call of apt-get; and in every job that runs tests the step that runs the setup (`sh tests/test-schedule-setup.sh`) comes before the step that runs the tests
// Planted fault: the read after the install, or no such read, or a test job that runs its tests before the setup, fails.
test("setup: the read of dpkg's file lists starts the script, and the setup precedes the tests in every test job", () => {
  const text = script().split("\n");
  const command = (line) => line.trim() !== "" && !/^\s*#/.test(line);
  const at = (pattern) => text.findIndex((line) => command(line) && pattern.test(line));
  const warm = at(/\/var\/lib\/dpkg\/info\/\*\.list/);
  const first = text.findIndex((line) => command(line) && !/^set /.test(line.trim()));
  assert.ok(warm >= 0, "the script reads dpkg's file lists");
  assert.equal(warm, first, `the read is the first command (line ${warm + 1}, first command at line ${first + 1})`);
  assert.ok(warm < at(/chmod -x/) && warm < at(/apt-get/), "the read comes before the removal and before apt-get");
  const workflow = readFileSync(new URL("../.github/workflows/agent-m-tests.yml", import.meta.url), "utf8");
  const body = workflow.slice(workflow.indexOf("\njobs:\n") + 7);
  const keys = [...body.matchAll(/^ {2}([A-Za-z0-9_-]+):\s*$/gm)];
  const jobs = keys.map((key, i) => body.slice(key.index, keys[i + 1]?.index ?? body.length)).filter((job) => /main\.mjs runTests/.test(job));
  assert.ok(jobs.length > 0, "the workflow has jobs that run tests");
  for (const job of jobs) {
    const setup = job.indexOf(`sh ${SETUP}`), tests = job.indexOf("main.mjs runTests");
    assert.ok(setup >= 0 && setup < tests, `${job.split("\n")[0].trim()} runs the setup before its tests`);
  }
});

// TST-1193009 · level: system · module: MOD-test-schedule
// guards: A PULL REQUEST'S CI RUNS WITHIN TWO MINUTES
// given: a machine of GitHub Actions on which update-notifier's program is not installed (its file is missing) and the other three programs are executable
// input: tests/test-schedule-setup.sh, run under `sh` against the model of apt
// expect: exit code 0; dpkg-preconfigure, apt-pinvoke and dpkg-status are not executable when apt is called (`hook-skipped:` for each) and apt installs from the cache: a program that is not there, in the middle of the list, does not stop the removal of the others
// Planted fault: a script that stops at the first missing program leaves apt-pinvoke and dpkg-status executable and fails.
test("setup: a hook that is not installed does not stop the removal of the others", () => {
  const host = machine();
  rmSync(host.hooks[1]);
  const result = run(script(), host, { env: { GITHUB_ACTIONS: "true" } });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.events.filter((event) => !event.endsWith("update-motd-updates-available")), ["hook-skipped:dpkg-preconfigure", "hook-skipped:apt-pinvoke", "hook-skipped:dpkg-status", "install-from-cache"]);
  assert.deepEqual([host.hooks[0], host.hooks[2], host.hooks[3]].map(executable), [false, false, false]);
});
