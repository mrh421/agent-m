// buildPlatform of MOD-bridge-build (ITM-961) — the accepted text of docs/architecture/MOD-bridge-build.md, blob 279df7dc: "buildPlatform(config: { platform:
// "macos" | "windows" | "linux", checkout: string, tag: string, folder: string }) -> Promise<PlatformBuild> — on a runner of that platform, from the instance's
// checkout at the release tag: installs the app's packages from the lockfile; builds the platform's files with electron-builder, signs them, and notarises the
// macOS ones; writes the platform's feed file, the detached signatures and the checksums; checks each code signature with the platform's own verifier and each
// detached signature with the public key; and runs the tunnel check above." Errors: SecretMissing — "before anything is built" —, BuildFailed, NotarisationFailed,
// SignatureInvalid { file }, NativeAddonFound { file }, TunnelCheckFailed; "with any of them the platform's files are not handed on". The tunnel check: "each
// platform's packaged app opens a reverse tunnel and a forward to a test SSH server and answers a request through them".
// Run: node --test tests/bridge-build-build-platform.test.mjs
//
// Module: MOD-bridge-build
// Guards: THE BRIDGE IS ONE FILE PER PLATFORM; THE BRIDGE IS BUILT FROM THE DASHBOARD'S CODE; THE BRIDGE IS SIGNED BY ITS PUBLISHER; UC-044
// Level: unit
//
// Building Electron for a platform does not run in CI (it belongs to the overnight runs), so the tests put fakes of the programs buildPlatform starts on the PATH:
// npm (it "installs" a fake electron-builder, and on request a compiled addon), electron-builder (it reads the configuration it is given and writes the files
// that configuration names, with an unpacked app), and the platform's verifiers codesign, spctl, xcrun and powershell. The packaged app is a small program that
// does what the Bridge does at start — it reads its settings from the per-user data folder below its home and opens the tunnels with MOD-tunnels — so the tunnel
// check runs for real, against its own test SSH server on loopback. A case that checks only how the app is started gives it an app that records its arguments
// and ends, so that the build ends with the app's end. The checkout is a made-up git repository. Nothing reaches the network, and no test sleeps.
// Each test states its given / input / expect before it runs. The counter-proofs are recorded in the pull request.

import test from "node:test";
import assert from "node:assert/strict";
import { createHash, createPublicKey, generateKeyPairSync, verify } from "node:crypto";
import { chmodSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { buildPlatform } from "../src/bridge-build/index.mjs";
import { appDescription } from "../src/desktop-shell/index.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const TAG = "v2026.10.0";
const VERSION = "2026.10.0";
// The files of MOD-bridge-build's table, by platform: the dmg and the zip of macOS, the installer of Windows, the AppImage of Linux.
const TABLE = {
  macos: [`Agent-M-Bridge-${VERSION}-macos.dmg`, `Agent-M-Bridge-${VERSION}-macos.zip`],
  windows: [`Agent-M-Bridge-${VERSION}-windows.exe`],
  linux: [`Agent-M-Bridge-${VERSION}-linux.AppImage`],
};
const FEEDS = { macos: "latest-mac.yml", windows: "latest.yml", linux: "latest-linux.yml" };
// The secrets of the release workflow's environment (Data), by platform.
const SECRETS = {
  macos: ["BRIDGE_UPDATE_KEY", "BRIDGE_MACOS_CERTIFICATE", "BRIDGE_MACOS_CERTIFICATE_PASSWORD", "BRIDGE_NOTARY_KEY", "BRIDGE_NOTARY_KEY_ID", "BRIDGE_NOTARY_ISSUER"],
  windows: ["BRIDGE_UPDATE_KEY", "BRIDGE_WINDOWS_CERTIFICATE", "BRIDGE_WINDOWS_CERTIFICATE_PASSWORD"],
  linux: ["BRIDGE_UPDATE_KEY"],
};

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const { privateKey } = generateKeyPairSync("ed25519");
const PRIVATE_PEM = privateKey.export({ type: "pkcs8", format: "pem" });
const PUBLIC_PEM = createPublicKey(PRIVATE_PEM).export({ type: "spki", format: "pem" });

// ---- the fakes (CommonJS programs without an extension, started through their shebang) ----

const FAKE_NPM = `#!/usr/bin/env node
const fs = require("node:fs"), path = require("node:path");
fs.appendFileSync(process.env.FAKE_LOG, JSON.stringify({ tool: "npm", args: process.argv.slice(2), cwd: process.cwd(), secrets: Object.keys(process.env).filter((n) => n.startsWith("BRIDGE_") && process.env[n]) }) + "\\n");
if (process.argv[2] === "ci") {
  const bin = path.join(process.cwd(), "node_modules", ".bin");
  fs.mkdirSync(bin, { recursive: true });
  fs.copyFileSync(process.env.FAKE_BUILDER, path.join(bin, "electron-builder"));
  fs.chmodSync(path.join(bin, "electron-builder"), 0o755);
  if (process.env.FAKE_TOOL_ADDON) {
    // Build tools hold compiled addons: electron-builder's tree, and a package only the tools reach.
    for (const file of ["@electron-internal/extract-zip/index.darwin-universal.node", "electron-builder/node_modules/app-builder-bin/native.node"]) {
      fs.mkdirSync(path.dirname(path.join(process.cwd(), "node_modules", file)), { recursive: true });
      fs.writeFileSync(path.join(process.cwd(), "node_modules", file), "compiled");
    }
  }
  if (process.env.FAKE_TRANSITIVE_ADDON) {
    // A shipped package (ssh2) needs another package (asn1), which holds a compiled addon.
    const at = (...parts) => path.join(process.cwd(), "node_modules", ...parts);
    fs.mkdirSync(at("ssh2"), { recursive: true });
    fs.writeFileSync(at("ssh2", "package.json"), JSON.stringify({ name: "ssh2", dependencies: { asn1: "0.2.6" }, optionalDependencies: { cpu: "1" } }));
    fs.mkdirSync(at("asn1", "build"), { recursive: true });
    fs.writeFileSync(at("asn1", "package.json"), JSON.stringify({ name: "asn1" }));
    fs.writeFileSync(at("asn1", "build", "native.node"), "compiled");
  }
  if (process.env.FAKE_ADDON) {
    const dir = path.join(process.cwd(), "node_modules", "ssh2", "build", "Release");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "sshcrypto.node"), "compiled");
  }
}
`;

const FAKE_BUILDER = `#!/usr/bin/env node
const fs = require("node:fs"), path = require("node:path");
const args = process.argv.slice(2);
const configFile = args[args.indexOf("--config") + 1];
const config = JSON.parse(fs.readFileSync(configFile, "utf8"));
const platform = args.includes("--mac") ? "macos" : args.includes("--win") ? "windows" : "linux";
const key = { macos: "mac", windows: "win", linux: "linux" }[platform];
const [build, updateKey] = config.extraResources.map((each) => fs.readFileSync(each.from, "utf8"));
fs.appendFileSync(process.env.FAKE_LOG, JSON.stringify({
  tool: "electron-builder", args: args.filter((a) => a !== configFile), cwd: process.cwd(), src: fs.readdirSync("src").sort(), platform,
  secrets: Object.keys(process.env).filter((n) => n.startsWith("BRIDGE_") && process.env[n]), build: JSON.parse(build), updateKey,
  env: { CSC_LINK: process.env.CSC_LINK, CSC_KEY_PASSWORD: process.env.CSC_KEY_PASSWORD, APPLE_API_KEY_ID: process.env.APPLE_API_KEY_ID, APPLE_API_ISSUER: process.env.APPLE_API_ISSUER, APPLE_API_KEY: fs.existsSync(process.env.APPLE_API_KEY || "") ? fs.readFileSync(process.env.APPLE_API_KEY, "utf8") : null },
}) + "\\n");
fs.copyFileSync(configFile, path.join(process.env.FAKE_CONFIGS, platform + ".json"));
const out = config.directories.output;
fs.mkdirSync(out, { recursive: true });
const EXT = { dmg: "dmg", zip: "zip", nsis: "exe", AppImage: "AppImage" };
const put = (name) => fs.writeFileSync(path.join(out, name), "the bytes of " + name);
for (const target of config[key].target) {
  const name = config[key].artifactName.replace("\${ext}", EXT[target.target]);
  put(name);
  put(name + ".blockmap");
}
put({ macos: "latest-mac.yml", windows: "latest.yml", linux: "latest-linux.yml" }[platform]);
const app = {
  macos: path.join(out, "mac-universal", config.productName + ".app", "Contents", "MacOS", config.productName),
  windows: path.join(out, "win-unpacked", config.productName + ".exe"),
  linux: path.join(out, "linux-unpacked", config.executableName),
}[platform];
fs.mkdirSync(path.dirname(app), { recursive: true });
fs.copyFileSync(process.env.FAKE_APP, app);
fs.chmodSync(app, 0o755);
`;

// The packaged app: at start it reads the Bridge's settings from its per-user data folder, answers HTTP on the settings' port and opens the tunnels with MOD-tunnels.
const fakeApp = () => `#!/usr/bin/env node
const fs = require("node:fs"), path = require("node:path"), http = require("node:http");
const find = (dir, depth) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const found = path.join(dir, entry.name);
    if (entry.isFile() && entry.name === "settings.json") return found;
    if (entry.isDirectory() && depth > 0) { const inner = find(found, depth - 1); if (inner) return inner; }
  }
  return null;
};
fs.appendFileSync(process.env.FAKE_LOG, JSON.stringify({ tool: "app", args: process.argv.slice(2) }) + "\\n");
const file = find(process.env.HOME, 6);
if (!file) process.exit(3);
const settings = JSON.parse(fs.readFileSync(file, "utf8"));
http.createServer((_request, response) => { response.writeHead(401); response.end("a token is required"); }).listen(settings.port, "127.0.0.1");
import(${JSON.stringify(pathToFileURL(join(ROOT, "src", "tunnels", "index.mjs")).href)}).then(({ openTunnels }) => openTunnels(path.dirname(file), settings.tunnels, settings.port));
`;

// A packaged app that records the arguments it is started with and ends with code 0, opening nothing: the tunnel check then ends as soon as it sees the app end.
const RECORDING_APP = `#!/usr/bin/env node
require("node:fs").appendFileSync(process.env.FAKE_LOG, JSON.stringify({ tool: "app", args: process.argv.slice(2) }) + "\\n");
`;

// The platform's verifiers. With FAKE_TAMPER a verifier is the point where the detached signature of a file changes after it was written.
const FAKE_VERIFIER = `#!/usr/bin/env node
const fs = require("node:fs"), path = require("node:path");
const tool = path.basename(process.argv[1]);
fs.appendFileSync(process.env.FAKE_LOG, JSON.stringify({ tool, args: process.argv.slice(2) }) + "\\n");
if (tool === "codesign" && process.env.FAKE_TAMPER) fs.writeFileSync(process.env.FAKE_TAMPER, Buffer.alloc(64).toString("base64"));
if (tool === "codesign" && process.argv.includes("-dvv") && !process.env.FAKE_NO_NAME) console.error("Executable=/app\\nAuthority=Developer ID Application: Example Lab (ABCDE12345)\\nAuthority=Developer ID Certification Authority\\nAuthority=Apple Root CA\\nTeamIdentifier=ABCDE12345");
if (tool === "powershell") console.log(process.env.FAKE_NO_NAME ? "Valid" : "Valid\\nExample Lab GmbH");
`;

const executable = (path, content) => { writeFileSync(path, content); chmodSync(path, 0o755); };

// One run's setting: the fakes on the PATH, the secrets of the platform in the environment, and the checkout, a git repository at the tag. `app` is the
// packaged app's program, the one that opens the tunnels where none is given.
function setting(platform, { env = {}, app = fakeApp() } = {}) {
  const root = mkdtempSync(join(tmpdir(), "bridge-build-platform-"));
  const bin = join(root, "bin");
  const configs = join(root, "configs");
  mkdirSync(bin);
  mkdirSync(configs);
  executable(join(bin, "npm"), FAKE_NPM);
  executable(join(root, "fake-builder"), FAKE_BUILDER);
  executable(join(root, "fake-app"), app);
  for (const tool of ["codesign", "spctl", "xcrun", "powershell"]) executable(join(bin, tool), FAKE_VERIFIER);

  const checkout = join(root, "checkout");
  const write = (path, content) => { mkdirSync(join(checkout, path, ".."), { recursive: true }); writeFileSync(join(checkout, path), content); };
  mkdirSync(checkout);
  for (const file of ["package.json", "package-lock.json"]) cpSync(join(ROOT, "src", "bridge-build", file), join(checkout, "src", "bridge-build", file), { recursive: true });
  write("src/desktop-shell/main.mjs", 'import "../tunnels/index.mjs";\n');
  write("src/desktop-shell/window.html", "<!doctype html>\n");
  write("src/desktop-shell/preload.cjs", "// preload\n");
  write("src/tunnels/index.mjs", "export const tunnels = 1;\n");
  write("src/unrelated/index.mjs", "export const unrelated = 1;\n");
  write("LICENSE", "MIT\n");
  const git = (...args) => spawnSync("git", ["-c", "user.name=probe", "-c", "user.email=probe@example.org", ...args], { cwd: checkout, encoding: "utf8" });
  git("init", "-q", "-b", "main");
  git("add", "-A");
  git("commit", "-q", "-m", "the release");
  git("remote", "add", "origin", "https://github.com/probe/agent-m.git");
  git("tag", TAG);
  const commit = git("rev-parse", "HEAD").stdout.trim();

  const names = [...new Set([...SECRETS.macos, ...SECRETS.windows, "PATH", "FAKE_LOG", "FAKE_CONFIGS", "FAKE_BUILDER", "FAKE_APP", "FAKE_ADDON", "FAKE_TOOL_ADDON", "FAKE_TRANSITIVE_ADDON", "FAKE_TAMPER", "FAKE_NO_NAME"])];
  const before = Object.fromEntries(names.map((name) => [name, process.env[name]]));
  for (const name of SECRETS[platform]) process.env[name] = name === "BRIDGE_UPDATE_KEY" ? PRIVATE_PEM : `value of ${name}`;
  Object.assign(process.env, { PATH: `${bin}${delimiter}${process.env.PATH}`, FAKE_LOG: join(root, "log.jsonl"), FAKE_CONFIGS: configs, FAKE_BUILDER: join(root, "fake-builder"), FAKE_APP: join(root, "fake-app"), ...env });
  const folder = join(root, "folder");
  return {
    checkout, folder, commit, root, configs,
    build: () => buildPlatform({ platform, checkout, tag: TAG, folder }),
    calls: () => (existsSync(join(root, "log.jsonl")) ? readFileSync(join(root, "log.jsonl"), "utf8").trim().split("\n").filter(Boolean).map((line) => JSON.parse(line)) : []),
    config: (which = platform) => JSON.parse(readFileSync(join(configs, `${which}.json`), "utf8")),
    settle() {
      for (const [name, value] of Object.entries(before)) { if (value === undefined) delete process.env[name]; else process.env[name] = value; }
      rmSync(root, { recursive: true, force: true });
    },
  };
}

const rejection = async (promise) => { try { await promise; } catch (error) { return error; } assert.fail("expected buildPlatform to reject"); };
const names = (folder) => (existsSync(folder) ? readdirSync(folder).sort() : []);

// TST-961001 · level: unit · module: MOD-bridge-build
// guards: THE BRIDGE IS SIGNED BY ITS PUBLISHER; UC-044
// given: for each platform, a checkout at the tag and the fakes, and the environment holding every secret of that platform except one — the update key, then each certificate, password and notary value in turn
// input: buildPlatform({ platform, checkout, tag, folder }) with that one secret missing
// expect: it rejects with SecretMissing naming that secret; npm and electron-builder are never started, and the folder is never made
test("buildPlatform — a missing secret gives SecretMissing naming it, before anything is built", async () => {
  for (const platform of ["macos", "windows", "linux"]) {
    const run = setting(platform);
    try {
      for (const secret of SECRETS[platform]) {
        const value = process.env[secret];
        delete process.env[secret];
        const error = await rejection(run.build());
        assert.equal(error.name, "SecretMissing", `${platform}: ${secret}`);
        assert.equal(error.secret, secret);
        assert.deepEqual(run.calls(), [], `${platform}: nothing is started without ${secret}`);
        assert.equal(existsSync(run.folder), false);
        process.env[secret] = value;
      }
    } finally { run.settle(); }
  }
});

// TST-961002 · level: unit · module: MOD-bridge-build
// guards: THE BRIDGE IS SIGNED BY ITS PUBLISHER; UC-044
// given: a macOS build whose files are written and whose detached signature of the disk image is changed by the time the platform's verifiers have run (the counter-proof of a build that hands on a file whose signature fails)
// input: buildPlatform({ platform: "macos", checkout, tag, folder })
// expect: it rejects with SignatureInvalid naming the disk image; the verifiers did run; the folder holds no platform-build.json and none of the build's files
test("buildPlatform — a detached signature that does not hold gives SignatureInvalid, and no file is handed on", async () => {
  const run = setting("macos");
  process.env.FAKE_TAMPER = join(run.folder, `${TABLE.macos[0]}.sig`);
  try {
    const error = await rejection(run.build());
    assert.equal(error.name, "SignatureInvalid");
    assert.equal(error.file, TABLE.macos[0]);
    assert.ok(run.calls().some((call) => call.tool === "codesign"), "the platform's verifier ran");
    assert.deepEqual(names(run.folder), [], "no file of the build is handed on");
  } finally { run.settle(); }
});

// TST-961003 · level: unit · module: MOD-bridge-build
// guards: THE BRIDGE IS BUILT FROM THE DASHBOARD'S CODE; UC-044
// given: a Linux build whose installed packages hold a compiled Node addon, node_modules/ssh2/build/Release/sshcrypto.node
// input: buildPlatform({ platform: "linux", checkout, tag, folder })
// expect: it rejects with NativeAddonFound naming that file as a path below the app; electron-builder is never started and no file is handed on
test("buildPlatform — a .node file in the app gives NativeAddonFound naming it", async () => {
  const run = setting("linux", { env: { FAKE_ADDON: "1" } });
  try {
    const error = await rejection(run.build());
    assert.equal(error.name, "NativeAddonFound");
    assert.equal(error.file, join("node_modules", "ssh2", "build", "Release", "sshcrypto.node"));
    assert.ok(run.calls().some((call) => call.tool === "npm"), "the packages were installed");
    assert.ok(!run.calls().some((call) => call.tool === "electron-builder"), "nothing was built");
    assert.deepEqual(names(run.folder), []);
  } finally { run.settle(); }
});

// TST-961007 · level: unit · module: MOD-bridge-build
// guards: THE BRIDGE IS BUILT FROM THE DASHBOARD'S CODE; UC-044
// given: a Linux build whose installed tree holds compiled addons in its build tools only — node_modules/@electron-internal/extract-zip/index.darwin-universal.node and node_modules/electron-builder/node_modules/app-builder-bin/native.node — and none in the packages the app ships (package.json's dependencies)
// input: buildPlatform({ platform: "linux", checkout, tag, folder })
// expect: it does not reject with NativeAddonFound: electron-builder is started and the AppImage is handed on
// Planted fault: a scan of the whole installed tree finds the build tools' addon and rejects.
test("buildPlatform — a .node file in the build tools only, which the app does not ship, gives no NativeAddonFound", async () => {
  const run = setting("linux", { env: { FAKE_TOOL_ADDON: "1" } });
  try {
    const result = await run.build();
    assert.ok(run.calls().some((call) => call.tool === "electron-builder"), "electron-builder was started");
    assert.ok(result.files.some((file) => file.name.endsWith(".AppImage")), "the AppImage is handed on");
  } finally { run.settle(); }
});

// TST-961008 · level: unit · module: MOD-bridge-build
// guards: THE BRIDGE IS BUILT FROM THE DASHBOARD'S CODE; UC-044
// given: a Linux build in which ssh2, a package the app ships, depends on asn1 (and optionally on cpu), and asn1 holds node_modules/asn1/build/native.node; the build tools hold addons too
// input: buildPlatform
// expect: it rejects with NativeAddonFound naming node_modules/asn1/build/native.node, a path below the app; electron-builder is never started and no file is handed on
// Planted fault: a scan that stops at the packages package.json names, without their dependencies, misses it; a scan of the whole tree names the build tools' addon instead of this one.
test("buildPlatform — a .node file in a package a shipped package depends on gives NativeAddonFound", async () => {
  const run = setting("linux", { env: { FAKE_TRANSITIVE_ADDON: "1", FAKE_TOOL_ADDON: "1" } });
  try {
    const error = await rejection(run.build());
    assert.equal(error.name, "NativeAddonFound");
    assert.equal(error.file, join("node_modules", "asn1", "build", "native.node"));
    assert.ok(!run.calls().some((call) => call.tool === "electron-builder"), "nothing was built");
    assert.deepEqual(names(run.folder), []);
  } finally { run.settle(); }
});

// TST-961009 · level: unit · module: MOD-bridge-build
// guards: THE BRIDGE IS ONE FILE PER PLATFORM; UC-044
// given: a Linux build and a macOS build, the packaged app of each a program that records the arguments it is started with and then ends with code 0, opening no tunnel, so that each build ends when the app ends and not at the tunnel check's limit of 60 s (the tunnels are TST-961005's)
// input: buildPlatform for each; the tunnel check starts the packaged app
// expect: on Linux the app is started with --no-sandbox (a runner's unpacked chrome-sandbox is not set-user-id root, and Electron then refuses to start; the check measures the tunnels, not the sandbox); on macOS it is started without arguments; each build then rejects with TunnelCheckFailed for the app's end, code 0
// Planted fault: starting the Linux app without the argument, as the first real nightly run did (SUID sandbox helper not configured), or passing it on macOS too, fails.
test("buildPlatform — the tunnel check starts the packaged Linux app without Electron's sandbox, and no other app with an argument", async () => {
  const started = async (platform) => {
    const run = setting(platform, { app: RECORDING_APP });
    try {
      const error = await rejection(run.build());
      assert.equal(error.name, "TunnelCheckFailed", platform);
      assert.match(error.reason, /^the packaged app ended with code 0\b/, platform);
      return run.calls().filter((call) => call.tool === "app").map((call) => call.args);
    } finally { run.settle(); }
  };
  assert.deepEqual(await started("linux"), [["--no-sandbox"]]);
  assert.deepEqual(await started("macos"), [[]]);
});

// TST-961004 · level: unit · module: MOD-bridge-build
// guards: THE BRIDGE IS ONE FILE PER PLATFORM; THE BRIDGE IS BUILT FROM THE DASHBOARD'S CODE; THE BRIDGE IS SIGNED BY ITS PUBLISHER; UC-044
// given: for each platform a checkout at the tag, the fakes, and MOD-desktop-shell's appDescription; electron-builder's configuration is read from the file the fake is given
// input: buildPlatform for macos, windows and linux
// expect: each configuration carries appDescription's product name, main entry, window, preload, icon of the platform and resource names, and Electron's fuses; the files electron-builder writes by the names of the configuration are exactly the table's — the dmg and the zip, the installer of one user without administrator's rights, the AppImage — and the result lists them with their blockmaps and the feed
test("buildPlatform — electron-builder's configuration is made from appDescription and names the four files of the table", async () => {
  for (const platform of ["macos", "windows", "linux"]) {
    const run = setting(platform);
    try {
      const result = await run.build();
      const config = run.config();
      assert.equal(config.productName, appDescription.productName);
      assert.equal(config.extraMetadata.main, appDescription.main);
      for (const path of [appDescription.main, appDescription.window, appDescription.preload]) assert.ok(config.files.includes(path), `${platform}: ${path} is carried`);
      assert.equal(config[{ macos: "mac", windows: "win", linux: "linux" }[platform]].icon, appDescription.icons[platform]);
      assert.deepEqual(config.extraResources.map((each) => each.to), [appDescription.resources.build, appDescription.resources.updateKey]);
      assert.equal(config.appId, "io.github.probe.agent-m.bridge");
      assert.deepEqual([config.electronFuses.runAsNode, config.electronFuses.enableNodeOptionsEnvironmentVariable, config.electronFuses.enableNodeCliInspectArguments, config.electronFuses.onlyLoadAppFromAsar], [false, false, false, true]);
      assert.equal(config.electronFuses.enableEmbeddedAsarIntegrityValidation, platform !== "linux");
      const expected = [...TABLE[platform].flatMap((name) => [name, `${name}.blockmap`]), FEEDS[platform]].sort();
      assert.deepEqual(result.files.map((file) => file.name), expected, `${platform}: the files of the build`);
      assert.deepEqual(names(run.folder).filter((name) => !name.endsWith(".sig")), [...expected, "SHA256SUMS", "platform-build.json"].sort());
      if (platform === "macos") assert.deepEqual(config.mac.target.map((each) => each.arch), [["universal"], ["universal"]]);
      if (platform === "windows") assert.deepEqual([config.win.requestedExecutionLevel, config.nsis.oneClick, config.nsis.perMachine], ["asInvoker", true, false]);
    } finally { run.settle(); }
  }
});

// TST-961005 · level: component · module: MOD-bridge-build
// guards: THE BRIDGE IS ONE FILE PER PLATFORM; THE BRIDGE IS BUILT FROM THE DASHBOARD'S CODE; THE BRIDGE IS SIGNED BY ITS PUBLISHER; UC-044
// given: a Linux build with the fakes and a test update key; a packaged app that opens the tunnels its settings name; a checkout whose entry reaches src/tunnels and not src/unrelated
// input: buildPlatform({ platform: "linux", checkout, tag, folder })
// expect: the AppImage, its feed and their blockmaps stand in the folder, each with a <file>.sig that the public half of the key verifies and that equals the result's signature; SHA256SUMS has the AppImage's line `<sha256>  <name>`; platform-build.json equals the result; the packages were installed from the lockfile without optional ones, with no secret in the environment of npm or electron-builder; the app carries src/desktop-shell and src/tunnels, and build.json and update-key.pem hold the instance, the version, the commit and the public key; the tunnel check passed
test("buildPlatform — the Linux build writes the AppImage with its detached signature, SHA256SUMS and platform-build.json", async () => {
  const run = setting("linux");
  try {
    const result = await run.build();
    const appImage = TABLE.linux[0];
    assert.equal(result.platform, "linux");
    assert.equal(result.version, VERSION);
    assert.equal(result.folder, run.folder);
    for (const file of result.files) {
      const bytes = readFileSync(join(run.folder, file.name));
      assert.deepEqual([file.size, file.sha256], [bytes.length, sha256(bytes)], file.name);
      const signature = readFileSync(join(run.folder, `${file.name}.sig`), "utf8");
      assert.equal(signature, file.signature);
      assert.match(signature, /^[A-Za-z0-9+/]+=*$/, `${file.name}.sig is base64 on one line`);
      assert.ok(verify(null, bytes, createPublicKey(PRIVATE_PEM), Buffer.from(signature, "base64")), `${file.name}.sig holds`);
    }
    const bytes = readFileSync(join(run.folder, appImage));
    assert.ok(readFileSync(join(run.folder, "SHA256SUMS"), "utf8").split("\n").includes(`${sha256(bytes)}  ${appImage}`), "the AppImage's line of SHA256SUMS");
    assert.deepEqual(JSON.parse(readFileSync(join(run.folder, "platform-build.json"), "utf8")), result);
    const [install, build] = run.calls();
    assert.deepEqual([install.tool, install.args], ["npm", ["ci", "--omit=optional", "--ignore-scripts"]]);
    assert.deepEqual([install.secrets, build.secrets], [[], []]);
    assert.deepEqual(build.src, ["desktop-shell", "tunnels"]);
    assert.deepEqual(build.build, { instance: "probe/agent-m", appId: "io.github.probe.agent-m.bridge", origin: "https://probe.github.io", version: VERSION, commit: run.commit });
    assert.equal(build.updateKey, PUBLIC_PEM);
  } finally { run.settle(); }
});

// The occasions of Agent M's schedule on which the real build runs: those whose test jobs carry no time limit — the nightly run, a release
// candidate, a start by hand —, so never a commit's or a pull request's CI (A PULL REQUEST'S CI RUNS WITHIN TWO MINUTES). Every test job of the
// schedule names its occasion in AGENT_M_OCCASION.
const REAL_BUILD = ["nightly", "release-candidate", "on-demand"].includes(process.env.AGENT_M_OCCASION) && process.platform === "linux";

// A virtual display for the packaged app's tunnel check where the machine has none, as xvfb-run gives one: Xvfb on a free display number, which it
// writes to its file descriptor 3. Resolves with the display and the function that ends it; where a display is set, with that one.
function virtualDisplay() {
  if (process.env.DISPLAY) return Promise.resolve({ display: process.env.DISPLAY, end: () => {} });
  return new Promise((resolve, reject) => {
    const server = spawn("Xvfb", ["-displayfd", "3", "-screen", "0", "1280x1024x24", "-nolisten", "tcp"], { stdio: ["ignore", "ignore", "pipe", "pipe"] });
    let said = "";
    server.on("error", reject);
    server.on("close", (code) => reject(new Error(`Xvfb ended with ${code} before it named its display`)));
    server.stdio[3].on("data", (chunk) => {
      said += chunk;
      const number = /^(\d+)\n/.exec(said);
      if (number) resolve({ display: `:${number[1]}`, end: () => server.kill("SIGTERM") });
    });
  });
}

// TST-961006 · level: component · module: MOD-bridge-build
// guards: THE BRIDGE IS ONE FILE PER PLATFORM; THE BRIDGE IS SIGNED BY ITS PUBLISHER; UC-044
// given: a Linux runner with Xvfb, a checkout of this repository's src/ at a tag, and a test update key; the real npm, electron-builder and Electron — which the nightly run, a release candidate and a start by hand run (AGENT_M_OCCASION nightly, release-candidate or on-demand), never a pull request's CI
// input: buildPlatform({ platform: "linux", checkout, tag, folder }), with a virtual display where the runner has none
// expect: the folder holds the .AppImage, its <file>.sig that the public half of the test key verifies, and the line of SHA256SUMS for it
test("buildPlatform — the real Linux build writes the AppImage, its detached signature and its SHA256SUMS line", { skip: REAL_BUILD ? false : "runs on a Linux runner on the nightly run, a release candidate and a start by hand (AGENT_M_OCCASION)", timeout: 1_800_000 }, async () => {
  const root = mkdtempSync(join(tmpdir(), "bridge-build-real-"));
  const before = process.env.BRIDGE_UPDATE_KEY;
  const display = process.env.DISPLAY;
  const screen = await virtualDisplay();
  process.env.DISPLAY = screen.display;
  try {
    const checkout = join(root, "checkout");
    mkdirSync(checkout);
    cpSync(join(ROOT, "src"), join(checkout, "src"), { recursive: true, filter: (path) => !path.includes("node_modules") });
    cpSync(join(ROOT, "LICENSE"), join(checkout, "LICENSE"));
    const git = (...args) => spawnSync("git", ["-c", "user.name=probe", "-c", "user.email=probe@example.org", ...args], { cwd: checkout, encoding: "utf8" });
    git("init", "-q", "-b", "main");
    git("add", "-A");
    git("commit", "-q", "-m", "the release");
    git("remote", "add", "origin", "https://github.com/probe/agent-m.git");
    git("tag", TAG);
    process.env.BRIDGE_UPDATE_KEY = PRIVATE_PEM;
    const folder = join(root, "folder");
    const result = await buildPlatform({ platform: "linux", checkout, tag: TAG, folder });
    const appImage = result.files.find((file) => file.name.endsWith(".AppImage"));
    const bytes = readFileSync(join(folder, appImage.name));
    assert.ok(verify(null, bytes, createPublicKey(PRIVATE_PEM), Buffer.from(readFileSync(join(folder, `${appImage.name}.sig`), "utf8"), "base64")));
    assert.ok(readFileSync(join(folder, "SHA256SUMS"), "utf8").split("\n").includes(`${sha256(bytes)}  ${appImage.name}`));
  } finally {
    if (before === undefined) delete process.env.BRIDGE_UPDATE_KEY; else process.env.BRIDGE_UPDATE_KEY = before;
    if (display === undefined) delete process.env.DISPLAY; else process.env.DISPLAY = display;
    screen.end();
    rmSync(root, { recursive: true, force: true });
  }
});

// TST-1082001 · level: unit · module: MOD-bridge-build
// guards: THE BRIDGE IS SIGNED BY ITS PUBLISHER; UC-044
// given: a build for each platform, whose verifiers read a name: macOS's codesign (-dvv) lists the Authority "Developer ID Application: Example Lab (ABCDE12345)" first; Windows's PowerShell gives the status Valid and the signer's name "Example Lab GmbH"; Linux has no verifier
// input: buildPlatform for each platform
// expect: the PlatformBuild and the platform-build.json it wrote record publisher "Example Lab (ABCDE12345)" for macOS, "Example Lab GmbH" for Windows and null for Linux
// Planted fault: a publisher left null, or taken from another line (the certificate authority), fails the name.
test("buildPlatform — the publisher is the name the platform's own verifier reads from the signed file; Linux records none", async () => {
  const expected = { macos: "Example Lab (ABCDE12345)", windows: "Example Lab GmbH", linux: null };
  for (const platform of ["macos", "windows", "linux"]) {
    const run = setting(platform);
    try {
      const built = await run.build();
      assert.equal(built.publisher, expected[platform], `${platform}: the PlatformBuild`);
      assert.equal(JSON.parse(readFileSync(join(run.folder, "platform-build.json"), "utf8")).publisher, expected[platform], `${platform}: platform-build.json`);
    } finally { run.settle(); }
  }
});

// TST-1082002 · level: unit · module: MOD-bridge-build
// guards: THE BRIDGE IS SIGNED BY ITS PUBLISHER; UC-044
// given: macOS and Windows builds whose verifiers accept the signature but read no name
// input: buildPlatform for each
// expect: it rejects with SignatureInvalid naming the released file, and the folder holds none of the build's files
// Planted fault: recording an empty publisher and handing the files on leaves files in the folder.
test("buildPlatform — a verifier that reads no name gives SignatureInvalid, and no file is handed on", async () => {
  for (const platform of ["macos", "windows"]) {
    const run = setting(platform, { env: { FAKE_NO_NAME: "1" } });
    try {
      const error = await rejection(run.build());
      assert.equal(error.name, "SignatureInvalid", platform);
      assert.equal(error.file, TABLE[platform][0], platform);
      assert.deepEqual(names(run.folder), [], `${platform}: no file is handed on`);
    } finally { run.settle(); }
  }
});
