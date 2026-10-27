// MOD-agent-enclosure — the enclosure every coding agent a Bridge starts runs in (ARC-054), as docs/architecture/MOD-agent-enclosure.md
// states it: the places that hold credentials hidden, nothing writable but the agent's home and the folders the Bridge names, an
// environment chosen rather than inherited, and per platform a Seatbelt profile (macOS), bubblewrap's arguments (Linux) or the Bridge's own
// account (Windows); whether it works, and the one-time step where it does not.
// Run: node --test tests/agent-enclosure.test.mjs
//
// Module: MOD-agent-enclosure
// Guards: NO MODEL READS A CREDENTIAL; A LOCAL AGENT USES THE PERSON'S OWN LOGIN
// Level: unit
//
// Fast and without network. The profile, the arguments and the Windows commands are checked by construction on every platform; on macOS the
// profile also runs, around a probe in Node that tries what an agent's tool would try, over fixture files and a fixture socket in a
// temporary folder that stands for the person's home, the Bridge's data folder and the agent's working folder. No credential of the computer
// is read: the keychain is probed with a public root certificate. The same probe run without the enclosure is the known positive of each
// negative. Linux and Windows are not run here: bubblewrap and a second account need such a computer.

import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { agentEnclosure } from "../src/agent-enclosure/index.mjs";
import { agentEnvironment, hiddenPaths } from "../src/agent-enclosure/holders.mjs";
import { seatbeltProfile } from "../src/agent-enclosure/seatbelt.mjs";
import { bubblewrapArgs } from "../src/agent-enclosure/bubblewrap.mjs";
import { accountName } from "../src/agent-enclosure/account.mjs";

const SECRET = "ghp_FIXTUREnotArealToken0123456789abcd";

// A computer in a temporary folder: the person's home with the git login's places, the Bridge's data folder with its pairing token, and an
// agent's working folder with the Bridge's clones and one job's checkout.
function computer(t) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "am-enc-")));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const person = join(root, "person"), data = join(root, "data"), folder = join(root, "work");
  for (const dir of [join(person, ".ssh"), join(person, ".config", "gh"), data, join(folder, "instance"), join(folder, "products", "p"), join(folder, "jobs", "J")]) mkdirSync(dir, { recursive: true });
  writeFileSync(join(person, ".ssh", "id_fixture"), `${SECRET}\n`);
  writeFileSync(join(person, ".git-credentials"), `https://x:${SECRET}@github.com\n`);
  writeFileSync(join(person, ".config", "gh", "hosts.yml"), `oauth_token: ${SECRET}\n`);
  writeFileSync(join(person, ".gitconfig"), "[user]\n\tname = Fixture\n");
  writeFileSync(join(data, "pairing-token"), `${SECRET}\n`);
  writeFileSync(join(folder, "instance", "AGENTS.md"), "the instance\n");
  writeFileSync(join(folder, "jobs", "J", "README.md"), "the checkout\n");
  return { root, person, data, folder, checkout: join(folder, "jobs", "J"), socket: join(root, "a.sock") };
}

// TST-1380001 · level: unit · module: MOD-agent-enclosure
// guards: NO MODEL READS A CREDENTIAL; A LOCAL AGENT USES THE PERSON'S OWN LOGIN
// given: the Bridge's environment with PATH, LANG and TERM, a token in GH_TOKEN, a key in ANTHROPIC_API_KEY, an SSH agent, a session bus and the person's HOME
// input: agentEnvironment for macOS and for Windows, with the agent's home and the identity { name: "Fixture Person", email: "fixture@example.org" }
// expect: on macOS PATH, LANG and TERM are kept; HOME is the agent's home, XDG_CONFIG_HOME, XDG_DATA_HOME, XDG_CACHE_HOME, XDG_STATE_HOME and TMPDIR lie in it; GIT_TERMINAL_PROMPT is 0 and the four git identity variables name the identity; GH_TOKEN, ANTHROPIC_API_KEY, SSH_AUTH_SOCK and DBUS_SESSION_BUS_ADDRESS are absent and no value holds the token; on Windows USERPROFILE, APPDATA, LOCALAPPDATA, TEMP and TMP lie in the account's home and PATH begins with its own folders of programs; counter-proof: PATH, the one variable passed as it is, is there
test("TST-1380001: the agent's environment is chosen, not inherited", () => {
  const env = { PATH: "/usr/bin:/bin", LANG: "de_DE.UTF-8", TERM: "xterm", GH_TOKEN: SECRET, ANTHROPIC_API_KEY: "sk-ant-fixture", SSH_AUTH_SOCK: "/tmp/agent.sock",
    DBUS_SESSION_BUS_ADDRESS: "unix:path=/run/user/501/bus", HOME: "/Users/person", SystemRoot: "C:\\Windows" };
  const identity = { name: "Fixture Person", email: "fixture@example.org" };
  const mac = agentEnvironment({ platform: "darwin", env, home: "/work/home", identity });
  assert.equal(mac.PATH, env.PATH, "counter-proof: PATH is passed as it is");
  assert.equal(mac.LANG, env.LANG);
  assert.equal(mac.TERM, env.TERM);
  assert.equal(mac.HOME, "/work/home");
  for (const name of ["XDG_CONFIG_HOME", "XDG_DATA_HOME", "XDG_CACHE_HOME", "XDG_STATE_HOME", "TMPDIR"]) assert.ok(mac[name].startsWith("/work/home/"), `${name} lies in the home: ${mac[name]}`);
  assert.equal(mac.GIT_TERMINAL_PROMPT, "0");
  assert.deepEqual([mac.GIT_AUTHOR_NAME, mac.GIT_COMMITTER_NAME, mac.GIT_AUTHOR_EMAIL, mac.GIT_COMMITTER_EMAIL], ["Fixture Person", "Fixture Person", "fixture@example.org", "fixture@example.org"]);
  for (const name of ["GH_TOKEN", "ANTHROPIC_API_KEY", "SSH_AUTH_SOCK", "DBUS_SESSION_BUS_ADDRESS"]) assert.equal(name in mac, false, `${name} is not passed`);
  assert.equal(Object.values(mac).some((value) => value.includes(SECRET)), false, "no value holds the token");

  const win = agentEnvironment({ platform: "win32", env, home: "C:\\Users\\agentm-0123456789ab", identity });
  assert.equal(win.USERPROFILE, "C:\\Users\\agentm-0123456789ab");
  for (const name of ["APPDATA", "LOCALAPPDATA", "TEMP", "TMP"]) assert.ok(win[name].startsWith("C:\\Users\\agentm-0123456789ab\\"), `${name}: ${win[name]}`);
  assert.equal(win.SystemRoot, "C:\\Windows");
  assert.ok(win.PATH.startsWith("C:\\Users\\agentm-0123456789ab\\"), `the account's own programs come first: ${win.PATH}`);
  assert.equal("GH_TOKEN" in win, false);
});

// TST-1380002 · level: unit · module: MOD-agent-enclosure
// guards: NO MODEL READS A CREDENTIAL
// given: the person's home /Users/person and the Bridge's data folder /Users/person/Library/Application Support/io.github.acme.agent-m.bridge
// input: hiddenPaths for macOS and for Linux
// expect: both hide the data folder and, in the person's home, .ssh, .git-credentials, .config/git/credentials, .netrc, .cache/git/credential, .git-credential-cache, .config/gh and .config/glab-cli; macOS also Library/Keychains; counter-proof: the person's home itself is not hidden
test("TST-1380002: the places that hold the Bridge's and the git login's credentials are hidden", () => {
  const dataFolder = "/Users/person/Library/Application Support/io.github.acme.agent-m.bridge";
  const login = [".ssh", ".git-credentials", ".config/git/credentials", ".netrc", ".cache/git/credential", ".git-credential-cache", ".config/gh", ".config/glab-cli"].map((place) => `/Users/person/${place}`);
  const mac = hiddenPaths({ platform: "darwin", dataFolder, personHome: "/Users/person" });
  const linux = hiddenPaths({ platform: "linux", dataFolder, personHome: "/Users/person" });
  for (const path of [dataFolder, ...login]) {
    assert.ok(mac.includes(path), `macOS hides ${path}`);
    assert.ok(linux.includes(path), `Linux hides ${path}`);
  }
  assert.ok(mac.includes("/Users/person/Library/Keychains"));
  assert.equal(mac.includes("/Users/person"), false, "counter-proof: the home itself stays readable");
});

// TST-1380003 · level: unit · module: MOD-agent-enclosure
// guards: NO MODEL READS A CREDENTIAL
// given: the writable folders /w/home and /w/jobs/J, the hidden places /d and /h/.ssh, the SSH agent's socket /s/agent "1".sock
// input: seatbeltProfile
// expect: the profile allows by default, then denies every write, then allows writing the two folders, /private/tmp and /dev, and only then denies reading and writing /d and /h/.ssh — a later rule overrides an earlier one —; it refuses the keychain's three services, connections to the socket and to launchd's SSH agent; the quote in the socket's path is escaped; counter-proof: no rule allows writing the home of the person
test("TST-1380003: the Seatbelt profile allows writing only where the agent works and hides the credential holders", () => {
  const profile = seatbeltProfile({ writable: ["/w/home", "/w/jobs/J"], hidden: ["/d", "/h/.ssh"], sockets: ['/s/agent "1".sock'] });
  const at = (text) => { const index = profile.indexOf(text); assert.notEqual(index, -1, `the profile holds ${text}:\n${profile}`); return index; };
  const allowDefault = at("(allow default)"), denyWrite = at("(deny file-write*)"), allowWrite = at("(allow file-write*");
  const hide = at("(deny file-read* file-write*");
  assert.ok(allowDefault < denyWrite && denyWrite < allowWrite && allowWrite < hide, "default, then no write, then the writable folders, then the hidden places");
  for (const path of ['(subpath "/w/home")', '(subpath "/w/jobs/J")', '(subpath "/private/tmp")', '(subpath "/dev")']) assert.ok(profile.indexOf(path, allowWrite) > allowWrite && profile.indexOf(path, allowWrite) < hide, `writable: ${path}`);
  for (const path of ['(subpath "/d")', '(subpath "/h/.ssh")']) assert.ok(profile.indexOf(path, hide) > hide, `hidden: ${path}`);
  for (const service of ["com.apple.SecurityServer", "com.apple.securityd.xpc", "com.apple.secd"]) at(`(global-name "${service}")`);
  at("(deny network-outbound");
  at('agent \\"1\\"');
  at("com\\.apple\\.launchd");
  assert.equal(/allow file-write\*[^)]*"\/h"\)/.test(profile), false, "counter-proof: the person's home is not writable");
});

// TST-1380004 · level: unit · module: MOD-agent-enclosure
// guards: NO MODEL READS A CREDENTIAL
// given: the writable folders /w/home and /w/jobs/J, the hidden folder /d, the hidden file /h/.netrc, the runtime folder /run/user/1000, the working folder /w/jobs/J
// input: bubblewrapArgs
// expect: in this order: --die-with-parent, --new-session, --unshare-pid, the whole file system read-only (--ro-bind / /), a new /dev and /proc, a private /tmp; the two folders bound writable; the runtime folder and /d replaced by an empty tmpfs and /h/.netrc by /dev/null — each after the binds, so that a hidden place inside a writable folder stays hidden —; --chdir /w/jobs/J last; counter-proof: no argument binds the person's home writable
test("TST-1380004: bubblewrap's arguments bind everything read-only, the work writable, and hide the credential holders after it", () => {
  const args = bubblewrapArgs({ writable: ["/w/home", "/w/jobs/J"], hidden: [{ path: "/d", directory: true }, { path: "/h/.netrc", directory: false }], runtimeDir: "/run/user/1000", workdir: "/w/jobs/J" });
  const joined = args.join(" ");
  const at = (text) => { const index = joined.indexOf(text); assert.notEqual(index, -1, `the arguments hold ${text}: ${joined}`); return index; };
  assert.deepEqual(args.slice(0, 3), ["--die-with-parent", "--new-session", "--unshare-pid"]);
  const ro = at("--ro-bind / /"), dev = at("--dev /dev"), proc = at("--proc /proc"), tmp = at("--tmpfs /tmp");
  const home = at("--bind /w/home /w/home"), job = at("--bind /w/jobs/J /w/jobs/J");
  const runtime = at("--tmpfs /run/user/1000"), data = at("--tmpfs /d"), netrc = at("--ro-bind /dev/null /h/.netrc");
  assert.ok(ro < dev && dev < proc && proc < tmp && tmp < home && home < job && job < runtime && job < data && job < netrc, joined);
  assert.deepEqual(args.slice(-2), ["--chdir", "/w/jobs/J"]);
  assert.equal(/--bind \/h /.test(joined), false, "counter-proof: the person's home is not bound writable");
});

// TST-1380005 · level: unit · module: MOD-agent-enclosure
// guards: NO MODEL READS A CREDENTIAL
// given: a Bridge whose data folder holds agent-account.json with the account's password, on Windows
// input: the account's name, and wrap("claude", ["-p", "--output-format", "json"], { workdir: C:\work\jobs\J, writable: [C:\work\jobs\J] }) of its enclosure
// expect: the name is agentm- and the first twelve hex digits of the SHA-256 of the data folder's path; the command is powershell.exe with -EncodedCommand, whose script is launcher.ps1 followed by one call of Invoke-Launch with -Account <name>, -Directory C:\work\jobs\J, -Program claude and -ArgumentLine the command line `-p --output-format json` in base64; the password reaches the launcher only as the first line of its input, in no argument, not in the script and in no variable; the environment names the account's profile; launcher.ps1 loads the account's profile, reads the password from the first line, and puts the program in a job object that ends it with the launcher; setup.ps1 makes a local account whose password never expires, hidden from the sign-in screen; counter-proof: the input holds the password
test("TST-1380005: on Windows the agent runs as the Bridge's own account, its password only in the launcher's input", (t) => {
  const machine = computer(t);
  const password = "Fixture-Passw0rd-not-real";
  writeFileSync(join(machine.data, "agent-account.json"), JSON.stringify({ account: accountName(machine.data), password }));
  const name = accountName(machine.data);
  assert.equal(name, `agentm-${createHash("sha256").update(machine.data).digest("hex").slice(0, 12)}`);
  assert.ok(name.length <= 20);
  const enclosure = agentEnclosure({ dataFolder: machine.data, folder: "C:\\work", platform: "win32", env: { PATH: "C:\\Windows\\system32", SystemDrive: "C:" }, personHome: "C:\\Users\\person", identity: { name: null, email: null } });
  const wrapped = enclosure.wrap("claude", ["-p", "--output-format", "json"], { workdir: "C:\\work\\jobs\\J", writable: ["C:\\work\\jobs\\J"] });
  assert.equal(wrapped.command, "powershell.exe");
  assert.equal(wrapped.args.at(-2), "-EncodedCommand", wrapped.args.join(" "));
  const script = Buffer.from(wrapped.args.at(-1), "base64").toString("utf16le");
  const launcher = readFileSync(new URL("../src/agent-enclosure/launcher.ps1", import.meta.url), "utf8");
  assert.ok(script.startsWith(launcher), "the script is the launcher");
  const call = /^Invoke-Launch -Account '([^']*)' -Directory '([^']*)' -Program '([^']*)' -ArgumentLine '([^']*)'$/m.exec(script);
  assert.ok(call, script.slice(-400));
  assert.deepEqual(call.slice(1, 4), [name, "C:\\work\\jobs\\J", "claude"]);
  assert.equal(Buffer.from(call[4], "base64").toString("utf8"), "-p --output-format json");
  assert.equal(wrapped.input, `${password}\n`, "counter-proof: the launcher's input holds the password");
  assert.equal(wrapped.args.some((arg) => arg.includes(password)) || script.includes(password), false, "no argument and not the script holds the password");
  assert.equal(Object.values(wrapped.env).some((each) => each.includes(password)), false, "no variable holds the password");
  assert.equal(wrapped.env.USERPROFILE, `C:\\Users\\${name}`);
  for (const text of ["LoadUserProfile", "ReadLine()", "JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE", "AssignProcessToJobObject", "RedirectStandardInput"]) assert.ok(launcher.includes(text), `launcher.ps1 holds ${text}`);
  const setup = readFileSync(new URL("../src/agent-enclosure/setup.ps1", import.meta.url), "utf8");
  for (const text of ["New-LocalUser", "PasswordNeverExpires", "SpecialAccounts\\UserList"]) assert.ok(setup.includes(text), `setup.ps1 holds ${text}`);
});

// TST-1380006 · level: unit · module: MOD-agent-enclosure
// guards: NO MODEL READS A CREDENTIAL
// given: a Linux computer whose PATH holds no bwrap, and a Windows Bridge whose data folder holds no agent-account.json
// input: works() of each enclosure
// expect: Linux answers that it does not work, naming bubblewrap in its reason and an administrator installing the package bubblewrap as its one-time step; Windows answers that it does not work, naming the account in its reason and an administrator confirming that the Bridge makes it as its step; counter-proof: on macOS, where sandbox-exec is part of the system, works() answers that it works
test("TST-1380006: an enclosure that cannot work says why and names its one-time step", async (t) => {
  const machine = computer(t);
  const empty = join(machine.root, "empty-bin");
  mkdirSync(empty);
  const linux = await agentEnclosure({ dataFolder: machine.data, folder: machine.folder, platform: "linux", env: { PATH: empty }, personHome: machine.person, identity: { name: null, email: null } }).works();
  assert.equal(linux.works, false);
  assert.match(linux.reason, /bubblewrap|bwrap/);
  assert.match(linux.setup, /administrator installs the package bubblewrap/);
  const windows = await agentEnclosure({ dataFolder: machine.data, folder: "C:\\work", platform: "win32", env: { PATH: empty }, personHome: machine.person, identity: { name: null, email: null } }).works();
  assert.equal(windows.works, false);
  assert.match(windows.reason, new RegExp(accountName(machine.data)));
  assert.match(windows.setup, /administrator confirms/);
  if (process.platform !== "darwin") { t.diagnostic("the counter-proof needs macOS"); return; }
  assert.deepEqual(await agentEnclosure({ dataFolder: machine.data, folder: machine.folder, personHome: machine.person }).works(), { works: true }, "counter-proof: macOS encloses");
});

// The probe an agent's tool would be: it tries each way to a credential and says what it got, as JSON on its standard output.
const PROBE = `
const fs = require("node:fs"), net = require("node:net"), { spawnSync } = require("node:child_process");
const [data, person, checkout, instance, socket] = process.argv.slice(2);
const read = (path) => { try { return fs.readFileSync(path, "utf8").includes(${JSON.stringify(SECRET)}) ? "secret" : "read"; } catch (error) { return error.code; } };
const write = (path) => { try { fs.writeFileSync(path, "x"); return "written"; } catch (error) { return error.code; } };
const keychain = spawnSync("/usr/bin/security", ["find-certificate", "-c", "Apple Root CA", "/System/Library/Keychains/SystemRootCertificates.keychain"]).status;
const found = { data: read(data + "/pairing-token"), ssh: read(person + "/.ssh/id_fixture"), credentials: read(person + "/.git-credentials"), gh: read(person + "/.config/gh/hosts.yml"),
  gitconfig: write(person + "/.gitconfig"), instance: write(instance + "/planted"), checkout: write(checkout + "/new.txt"), home: write(process.env.HOME + "/new.txt"),
  readme: read(checkout + "/README.md"), env: Object.values(process.env).some((value) => value.includes(${JSON.stringify(SECRET)})), sshAuthSock: process.env.SSH_AUTH_SOCK ?? null,
  homeVar: process.env.HOME, keychain };
const c = net.connect(socket);
c.on("data", (d) => { found.socket = String(d); console.log(JSON.stringify(found)); process.exit(0); });
c.on("error", (error) => { found.socket = error.code; console.log(JSON.stringify(found)); process.exit(0); });
`;

const ran = (command, args, options) => new Promise((resolve, reject) => {
  const child = spawn(command, args, options);
  let out = "", err = "";
  child.stdout.on("data", (chunk) => { out += chunk; });
  child.stderr.on("data", (chunk) => { err += chunk; });
  child.on("error", reject);
  child.on("close", (status) => resolve({ status, out, err }));
});

// TST-1380007 · level: unit · module: MOD-agent-enclosure
// guards: NO MODEL READS A CREDENTIAL
// given: on macOS, a fixture computer — the person's home with .ssh/id_fixture, .git-credentials, .config/gh/hosts.yml and .gitconfig, the Bridge's data folder with its pairing token, an agent's working folder with the clone of the instance and the job's checkout —, a fixture SSH agent socket that answers "hello", and a Bridge whose environment holds a token in GH_TOKEN and the socket in SSH_AUTH_SOCK
// input: the probe run in the agent's enclosure — wrap(node, [probe, …], { workdir: the checkout, writable: [the checkout] }) after prepare —, and the same probe run as a plain child with the Bridge's environment
// expect: in the enclosure, the pairing token, the SSH key, git's credentials and gh's token cannot be read (EPERM), the person's .gitconfig and the clone of the instance cannot be written (EPERM), the checkout and the agent's home can, the checkout's README is read, no variable holds the token, SSH_AUTH_SOCK is not set, HOME is the agent's home, the keychain does not find the public root certificate (44) and the socket refuses (EPERM); counter-proof: as a plain child each of them is read or written, the variable holds the token, the keychain finds the certificate (0) and the socket answers
test("TST-1380007: on macOS an enclosed agent reaches no credential, and the same probe outside it reaches each", async (t) => {
  if (process.platform !== "darwin") { t.skip("Seatbelt runs on macOS only"); return; }
  const machine = computer(t);
  const probe = join(machine.root, "probe.cjs");
  writeFileSync(probe, PROBE);
  const server = createServer((connection) => connection.end("hello"));
  await new Promise((resolve) => server.listen(machine.socket, resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const bridgeEnv = { PATH: process.env.PATH, HOME: machine.person, GH_TOKEN: SECRET, SSH_AUTH_SOCK: machine.socket };
  const args = [probe, machine.data, machine.person, machine.checkout, join(machine.folder, "instance"), machine.socket];

  const plain = JSON.parse((await ran(process.execPath, args, { env: bridgeEnv })).out);
  assert.deepEqual([plain.data, plain.ssh, plain.credentials, plain.gh], ["secret", "secret", "secret", "secret"], "known positive: a plain child reads every holder");
  assert.deepEqual([plain.gitconfig, plain.instance, plain.env, plain.keychain, plain.socket], ["written", "written", true, 0, "hello"], "known positive: and writes, sees, finds and connects");

  const enclosure = agentEnclosure({ dataFolder: machine.data, folder: machine.folder, platform: "darwin", env: bridgeEnv, personHome: machine.person, identity: { name: "Fixture", email: "f@example.org" } });
  await enclosure.prepare({ writable: [machine.checkout], readable: [join(machine.folder, "instance")] });
  const wrapped = enclosure.wrap(process.execPath, args, { workdir: machine.checkout, writable: [machine.checkout] });
  const done = await ran(wrapped.command, wrapped.args, { cwd: machine.checkout, env: wrapped.env });
  assert.equal(done.status, 0, done.err);
  const inside = JSON.parse(done.out);
  assert.deepEqual([inside.data, inside.ssh, inside.credentials, inside.gh], ["EPERM", "EPERM", "EPERM", "EPERM"], JSON.stringify(inside));
  assert.deepEqual([inside.gitconfig, inside.instance], ["EPERM", "EPERM"], "neither the person's git configuration nor the Bridge's clone is written");
  assert.deepEqual([inside.checkout, inside.home, inside.readme], ["written", "written", "read"], "the agent works in its checkout and its home");
  assert.equal(inside.env, false);
  assert.equal(inside.sshAuthSock, null);
  assert.equal(inside.homeVar, enclosure.home);
  assert.equal(inside.keychain, 44, "the keychain finds nothing");
  assert.equal(inside.socket, "EPERM", "the SSH agent's socket refuses");
  assert.equal(readFileSync(join(machine.person, ".gitconfig"), "utf8"), "x", "the plain child's write stands, the enclosed one's did not happen");
  assert.equal(existsSync(join(enclosure.home, "new.txt")), true);
});
