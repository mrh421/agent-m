# Module: MOD-bridge-build
# Guards: THE BRIDGE IS ONE FILE PER PLATFORM; THE BRIDGE IS SIGNED BY ITS PUBLISHER; THE BRIDGE IS UPDATED ONLY BY THE PERSON'S CHOICE
# Level: release
"""SPEC sections 14 and 16 - the check named tests/test_bridge_release.py.

The cases and their expected results live in tests/test_bridge_release.md. This file loads them and drives, in Node, the real publishRelease and
buildPlatform of MOD-bridge-build (the release build's own functions) and the Bridge's app entry of MOD-desktop-shell with its updates, over the
constructed Electron of tests/desktop-shell.d/entry.mjs. Written by a participant who built none of the Bridge items (RELEASE TESTS ARE NOT WRITTEN BY THE
IMPLEMENTER). The three platforms' real packaged apps and Apple's and Microsoft's verifiers cannot run here; what the repository can show is shown, and what it cannot
is named in the pull request.
"""
import json
import re
import subprocess
import unittest
from pathlib import Path

DATA = Path(__file__).with_suffix(".md")
ROOT = Path(__file__).resolve().parents[1]

JS_CHECK = r"""
import assert from "node:assert/strict";
import { createHash, createPublicKey, generateKeyPairSync, sign, verify } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, existsSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { pathToFileURL } from "node:url";

const SRC = (path) => pathToFileURL(join(process.cwd(), "src", path)).href;
const TESTS = (path) => pathToFileURL(join(process.cwd(), "tests", path)).href;
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

// ---------------------------------------------------------------- the release: what the repository builds and publishes
const VERSION = "2026.10.0", TAG = "v2026.10.0", COMMIT = "9f1c2b7e0a5d4c3b2a1908f7e6d5c4b3a2918070";
const LOCK = JSON.parse(readFileSync("src/bridge-build/package-lock.json", "utf8")).packages;
const MANIFEST = JSON.parse(readFileSync("src/bridge-build/package.json", "utf8"));
const CARRIED = [...new Set(["electron", ...Object.keys(MANIFEST.dependencies ?? {})])];
const FILES = {
  macos: [`Agent-M-Bridge-${VERSION}-macos.dmg`, `Agent-M-Bridge-${VERSION}-macos.zip`, "latest-mac.yml"],
  windows: [`Agent-M-Bridge-${VERSION}-windows.exe`, "latest.yml"],
  linux: [`Agent-M-Bridge-${VERSION}-linux.AppImage`, "latest-linux.yml"],
};
const PUBLISHERS = { macos: "Example Lab (ABCDE12345)", windows: "Example Lab GmbH", linux: null };

function publisherKey() {
  const { privateKey } = generateKeyPairSync("ed25519");
  return privateKey.export({ type: "pkcs8", format: "pem" });
}

// The three platforms' builds as each buildPlatform leaves them in its folder: the files, platform-build.json with the checksums and detached signatures.
function builds(root, pem, { publishers = PUBLISHERS, skip = [], tamper = null, foreign = null } = {}) {
  const folders = [];
  const other = foreign ? publisherKey() : null;
  for (const [platform, names] of Object.entries(FILES)) {
    if (skip.includes(platform)) continue;
    const folder = join(root, platform);
    mkdirSync(folder, { recursive: true });
    const files = names.map((name) => {
      const bytes = Buffer.from(`the bytes of ${name}`);
      writeFileSync(join(folder, name), tamper === name ? Buffer.from("other bytes, written after the build") : bytes);
      const signer = foreign === name ? other : pem;
      return { name, size: bytes.length, sha256: sha256(bytes), signature: sign(null, bytes, signer).toString("base64") };
    });
    writeFileSync(join(folder, "platform-build.json"), JSON.stringify({ platform, version: VERSION, folder, publisher: publishers[platform], files }));
    folders.push(folder);
  }
  return folders;
}

function fakeHost() {
  const calls = [];
  return {
    calls,
    async listTags(pattern) { return [{ name: TAG, commit: COMMIT }].filter((each) => !pattern || each.name === pattern); },
    async publishRelease(tag, release) {
      calls.push({ tag, release });
      return { tag, name: release.name, published: "2026-10-18", notes: release.notes,
        assets: release.files.map((file) => ({ name: file.name, size: file.bytes.length, url: `https://example.org/${file.name}`, sha256: sha256(file.bytes) })) };
    },
  };
}

// The npm registry, faked where registryFacts reads it: every package carried answers an MIT licence.
function fakeRegistry() {
  const real = globalThis.fetch;
  globalThis.fetch = async (address) => {
    const url = String(address);
    const body = url.startsWith("https://api.npmjs.org/") ? { downloads: 100 } : (() => {
      const name = decodeURIComponent(url.slice("https://registry.npmjs.org/".length));
      const version = LOCK[`node_modules/${name}`]?.version ?? "1.0.0";
      return { name, license: "MIT", "dist-tags": { latest: version }, versions: { [version]: {} }, time: { [version]: "2025-08-20T00:00:00.000Z" } };
    })();
    return { ok: true, status: 200, statusText: "OK", async json() { return body; } };
  };
  return () => { globalThis.fetch = real; };
}

async function publishing(options = {}) {
  const { publishRelease } = await import(SRC("bridge-build/index.mjs"));
  const root = mkdtempSync(join(tmpdir(), "bridge-release-"));
  const pem = publisherKey();
  const before = process.env.BRIDGE_UPDATE_KEY;
  process.env.BRIDGE_UPDATE_KEY = pem;
  const undo = fakeRegistry();
  const host = fakeHost();
  try {
    const folders = builds(root, pem, options);
    let error = null, result = null;
    try { result = await publishRelease(host, { tag: TAG, folders }); } catch (caught) { error = caught; }
    return { host, error, result, pem };
  } finally {
    undo();
    if (before === undefined) delete process.env.BRIDGE_UPDATE_KEY; else process.env.BRIDGE_UPDATE_KEY = before;
    rmSync(root, { recursive: true, force: true });
  }
}

const downloadable = (names) => Object.fromEntries(["macos", "windows", "linux"].map((platform) => [platform,
  names.filter((name) => new RegExp(`^Agent-M-Bridge-${VERSION.replaceAll(".", "\\.")}-${platform}\\.(dmg|exe|AppImage)$`).test(name))]));

async function oneFilePerPlatform() {
  const { builderConfig } = await import(SRC("bridge-build/builder.mjs"));
  const { appDescription } = await import(SRC("desktop-shell/index.mjs"));
  const configs = Object.fromEntries(["macos", "windows", "linux"].map((platform) => [platform,
    builderConfig(appDescription, { platform, version: VERSION, appId: "io.github.alice.agent-m.bridge", owner: "alice", repository: "agent-m", folders: ["desktop-shell"], resources: "r", output: "o" })]));
  const targets = (config) => (config.mac ?? config.win ?? config.linux).target.map((each) => `${each.target}:${each.arch.join("+")}`);
  const names = (config) => (config.mac ?? config.win ?? config.linux).artifactName;
  const run = await publishing();
  const names_ = run.error ? [] : run.host.calls[0].release.files.map((file) => file.name);
  return {
    targets: Object.fromEntries(Object.entries(configs).map(([platform, config]) => [platform, targets(config)])),
    artifactNames: Object.fromEntries(Object.entries(configs).map(([platform, config]) => [platform, names(config)])),
    windowsInstaller: { oneClick: configs.windows.nsis.oneClick, perMachine: configs.windows.nsis.perMachine, executionLevel: configs.windows.win.requestedExecutionLevel },
    carriesItsRuntime: Object.values(configs).every((config) => config.electronVersion === MANIFEST.devDependencies.electron && config.asar === true),
    nodeIsNotAnOption: Object.values(configs).every((config) => config.electronFuses.runAsNode === false && config.electronFuses.enableNodeOptionsEnvironmentVariable === false),
    published: run.error ? String(run.error) : "published",
    downloadablePerPlatform: Object.fromEntries(Object.entries(downloadable(names_)).map(([platform, list]) => [platform, list.length])),
    downloadableFiles: Object.values(downloadable(names_)).flat().sort(),
  };
}

async function missingBuild(input) {
  const run = await publishing({ skip: [input.platform] });
  return { error: run.error?.name ?? null, platform: run.error?.platform ?? null, published: run.host.calls.length };
}

async function refused(input) {
  const options = {
    tampered: { tamper: FILES.windows[0] },
    "another-key": { foreign: FILES.macos[0] },
    "no-macos-publisher": { publishers: { ...PUBLISHERS, macos: null } },
    "blank-windows-publisher": { publishers: { ...PUBLISHERS, windows: "   " } },
  }[input.fault];
  const run = await publishing(options);
  return { error: run.error?.name ?? null, file: run.error?.file ?? null, platform: run.error?.platform ?? null, published: run.host.calls.length };
}

async function signed() {
  const run = await publishing();
  assert.equal(run.error, null, String(run.error));
  const { release } = run.host.calls[0];
  const byName = new Map(release.files.map((file) => [file.name, Buffer.from(file.bytes)]));
  const publicKey = createPublicKey(run.pem);
  const everyFileSigned = [...byName.keys()].filter((name) => !name.endsWith(".sig")).every((name) =>
    byName.has(`${name}.sig`) && verify(null, byName.get(name), publicKey, Buffer.from(byName.get(`${name}.sig`).toString("utf8").trim(), "base64")));
  const sums = byName.get("SHA256SUMS").toString("utf8").trim().split("\n");
  const sumsMatch = [...byName.keys()].filter((name) => !name.endsWith(".sig") && name !== "SHA256SUMS").every((name) => sums.includes(`${sha256(byName.get(name))}  ${name}`));
  const everything = release.files.map((file) => Buffer.from(file.bytes).toString("utf8")).join("\n") + release.notes;
  return {
    everyFileSigned, sumsMatch,
    publisherLines: release.notes.split("\n").filter((line) => line.startsWith("Publisher (")),
    privateKeyPublished: everything.includes("PRIVATE KEY"),
  };
}

async function secrets(input) {
  const { buildPlatform } = await import(SRC("bridge-build/index.mjs"));
  const all = { macos: ["BRIDGE_UPDATE_KEY", "BRIDGE_MACOS_CERTIFICATE", "BRIDGE_MACOS_CERTIFICATE_PASSWORD", "BRIDGE_NOTARY_KEY", "BRIDGE_NOTARY_KEY_ID", "BRIDGE_NOTARY_ISSUER"],
    windows: ["BRIDGE_UPDATE_KEY", "BRIDGE_WINDOWS_CERTIFICATE", "BRIDGE_WINDOWS_CERTIFICATE_PASSWORD"], linux: ["BRIDGE_UPDATE_KEY"] };
  const saved = { ...process.env };
  const outcome = {};
  try {
    for (const platform of input.platforms) {
      outcome[platform] = [];
      for (const missing of all[platform]) {
        for (const name of Object.keys(process.env)) if (name.startsWith("BRIDGE_")) delete process.env[name];
        for (const name of all[platform]) if (name !== missing) process.env[name] = "x";
        const folder = mkdtempSync(join(tmpdir(), "bridge-secret-"));
        try {
          await buildPlatform({ platform, checkout: join(folder, "no-checkout"), tag: TAG, folder: join(folder, "out") });
          outcome[platform].push(`${missing}: built`);
        } catch (error) {
          outcome[platform].push(`${missing}: ${error.name} ${error.secret ?? ""}`.trim() + (existsSync(join(folder, "out")) ? " (wrote files)" : ""));
        } finally { rmSync(folder, { recursive: true, force: true }); }
      }
    }
    // The known positive: with every secret of Linux present, buildPlatform goes on to read the checkout and fails there, not at a secret.
    for (const name of Object.keys(process.env)) if (name.startsWith("BRIDGE_")) delete process.env[name];
    process.env.BRIDGE_UPDATE_KEY = "x";
    const folder = mkdtempSync(join(tmpdir(), "bridge-secret-"));
    try { await buildPlatform({ platform: "linux", checkout: join(folder, "no-checkout"), tag: TAG, folder: join(folder, "out") }); outcome.complete = "built"; }
    catch (error) { outcome.complete = error.name; } finally { rmSync(folder, { recursive: true, force: true }); }
  } finally { for (const name of Object.keys(process.env)) if (name.startsWith("BRIDGE_")) delete process.env[name]; Object.assign(process.env, saved); }
  return outcome;
}

// ---------------------------------------------------------------- the update: the app's entry over a constructed Electron
async function updating(input) {
  const { startEntry, stopEntry, temporary } = await import(TESTS("desktop-shell.d/entry.mjs"));
  const { unusedPorts } = await import(TESTS("desktop-shell.d/ports.mjs"));
  const { saveSettings } = await import(SRC("desktop-shell/settings.mjs"));
  const publisher = generateKeyPairSync("ed25519"), stranger = generateKeyPairSync("ed25519");
  const BASE = "https://github.com/alice/agent-m/releases/latest/download/";
  const FILE = "Agent-M-Bridge-2026.11.0-linux.AppImage";
  const BYTES = Buffer.from("the new Bridge, as the publisher built it");
  const FEED = Buffer.from(`version: 2026.11.0\nfiles:\n  - url: ${FILE}\n    sha512: SHA512OFTHEFILE\n    size: ${BYTES.length}\n`);
  const signedBy = (pair, bytes) => Buffer.from(sign(null, bytes, pair.privateKey).toString("base64"));
  const feedSigner = input.feedSignedBy === "stranger" ? stranger : publisher;
  const fileSigner = input.fileSignedBy === "stranger" ? stranger : publisher;
  const held = new Map([[`${BASE}latest-linux.yml`, FEED], [`${BASE}latest-linux.yml.sig`, signedBy(feedSigner, FEED)], [`${BASE}${FILE}`, BYTES], [`${BASE}${FILE}.sig`, signedBy(fileSigner, BYTES)]]);
  const calls = [];
  const folder = temporary();
  const file = join(folder, FILE);
  globalThis.__agentMUpdater = {
    autoDownload: true, autoInstallOnAppQuit: true,
    async checkForUpdates() { calls.push("checkForUpdates"); return { updateInfo: { version: "2026.11.0", files: [{ url: FILE, sha512: "SHA512OFTHEFILE", size: BYTES.length }], releaseNotes: "Fixes the tunnels." } }; },
    async downloadUpdate() { calls.push("downloadUpdate"); writeFileSync(file, BYTES); return [file]; },
    quitAndInstall() { calls.push("quitAndInstall"); },
  };
  globalThis.__agentMHttpsGet = (url, callback) => {
    const found = held.has(String(url));
    const response = Object.assign(Readable.from(found ? [held.get(String(url))] : []), { statusCode: found ? 200 : 404, headers: {} });
    queueMicrotask(() => callback(response));
    return { on() { return this; } };
  };
  const appData = temporary(), resources = temporary();
  const [port] = await unusedPorts(1);
  const BUILD = { instance: "alice/agent-m", appId: "io.github.alice.agent-m.bridge", origin: "https://alice.github.io", version: "2026.10.0", commit: COMMIT };
  saveSettings(join(appData, BUILD.appId), { name: "lab", port, agents: [], products: [], every: 300, paused: true, jumpHost: null, tunnels: [] });
  writeFileSync(join(resources, "build.json"), JSON.stringify(BUILD));
  writeFileSync(join(resources, "update-key.pem"), publisher.publicKey.export({ type: "spki", format: "pem" }));
  const started = await startEntry({ resources, appData, platform: "linux", argv: [] });
  const out = {};
  try {
    assert.equal(started.outcome.kind, "loaded", `the entry started (errors: ${started.errors.join(" | ")})`);
    const ask = (action, value) => started.fake.handlers["bridge-state"]({}, action, value);
    const state = await ask("updates");
    out.offered = state.offer?.version ?? null;
    out.notes = state.offer?.notes ?? null;
    out.refusedAtOffer = state.refused;
    out.downloadedBeforeClick = calls.includes("downloadUpdate");
    out.autoDownload = globalThis.__agentMUpdater.autoDownload;
    if (state.offer) {
      const after = await ask("download-update");
      out.readyAfterDownload = after.ready;
      out.refusedAtDownload = after.refused;
      out.fileKept = existsSync(file);
      out.installWithoutDecision = await ask("install-update").then(() => "installed", (error) => error.name);
      out.installedBeforeConfirm = calls.includes("quitAndInstall");
      out.installAfterDecision = await ask("install-update", { confirmed: true }).then(() => "installed", (error) => error.name);
      out.installs = calls.filter((call) => call === "quitAndInstall").length;
    }
  } finally {
    await stopEntry(started);
    delete globalThis.__agentMHttpsGet; delete globalThis.__agentMUpdater;
    for (const each of [appData, resources, folder]) rmSync(each, { recursive: true, force: true });
  }
  return out;
}

const KINDS = { "one-file-per-platform": oneFilePerPlatform, "missing-build": missingBuild, refused, signed, secrets, updating };
"""


def fence(body: str, heading: str) -> str:
    match = re.search(rf"^### {re.escape(heading)}\n\n```[a-z]*\n(.*?)\n```", body, re.M | re.S)
    if not match:
        raise AssertionError(f"missing fenced block under {heading}")
    return match.group(1)


def cases() -> list[dict]:
    text = DATA.read_text(encoding="utf-8")
    found = []
    for match in re.finditer(r"^## (?P<name>[^\n]+)\n(?P<body>.*?)(?=^## |\Z)", text, re.M | re.S):
        found.append({"name": match.group("name"), "case": json.loads(fence(match.group("body"), "Case"))})
    if not found:
        raise AssertionError("no cases loaded")
    return found


def result(case: dict) -> dict:
    code = (JS_CHECK + f"\nconst input = {json.dumps(case['input'])};"
            "\nprocess.stdout.write(JSON.stringify(await KINDS[input.kind](input)));\nprocess.exit(0);")
    run = subprocess.run(["node", "--input-type=module", "-e", code], cwd=ROOT, capture_output=True, text=True, timeout=120)
    if run.returncode != 0:
        raise AssertionError(run.stderr.strip()[-1500:])
    return json.loads(run.stdout)


def of_kind(*kinds: str) -> list[dict]:
    found = [loaded for loaded in cases() if loaded["case"]["input"]["kind"] in kinds]
    if not found:
        raise AssertionError(f"no case of kind {kinds}")
    return found


class TestBridgeRelease(unittest.TestCase):
    # TST-1056001 · level: release · module: MOD-bridge-build
    # guards: THE BRIDGE IS ONE FILE PER PLATFORM
    # given: the release build's configuration for each of the three platforms (MOD-bridge-build's Data table) and a release published from three intact platform builds
    # input: the electron-builder target, architecture and file name of each platform; the installer's options on Windows; the files the release publishes
    # expect: macOS is one disk image (Apple silicon and Intel in one file) and the zip electron-updater needs, Windows one installer for x64 that asks for no administrator, Linux one AppImage for x64, each named Agent-M-Bridge-<version>-<platform>.<ext>; the app carries its own Electron (the version the manifest pins, in an archive) and the fuses leave no way to run it as plain Node, so no other runtime is installed or needed; the release offers exactly one downloadable file per platform
    def test_the_release_yields_one_file_per_platform_that_carries_its_own_runtime(self):
        for loaded in of_kind("one-file-per-platform"):
            with self.subTest(case=loaded["name"]):
                self.assertEqual(result(loaded["case"]), loaded["case"]["expected"])

    # TST-1056002 · level: release · module: MOD-bridge-build
    # guards: THE BRIDGE IS ONE FILE PER PLATFORM
    # given: three platform builds of which one is missing: the macOS, the Windows or the Linux build
    # input: publishRelease over the folders that remain
    # expect: BuildMissing naming the missing platform, and nothing is published
    def test_a_release_without_the_file_of_one_platform_is_not_published(self):
        for loaded in of_kind("missing-build"):
            with self.subTest(case=loaded["name"]):
                self.assertEqual(result(loaded["case"]), loaded["case"]["expected"])

    # TST-1056003 · level: release · module: MOD-bridge-build
    # guards: THE BRIDGE IS SIGNED BY ITS PUBLISHER
    # given: three platform builds with one fault each: a file whose bytes changed after the build; a file whose detached signature is another key's; a macOS build that records no publisher (its signature or notarisation was not verified by the platform's verifier); a Windows build whose publisher is blank
    # input: publishRelease over the folders
    # expect: the release is refused with SignatureInvalid naming the file, or BuildMissing naming the platform, and nothing is published
    def test_the_release_refuses_to_publish_a_file_whose_signature_cannot_be_verified(self):
        for loaded in of_kind("refused"):
            with self.subTest(case=loaded["name"]):
                self.assertEqual(result(loaded["case"]), loaded["case"]["expected"])

    # TST-1056004 · level: release · module: MOD-bridge-build
    # guards: THE BRIDGE IS SIGNED BY ITS PUBLISHER
    # given: three intact platform builds (the counter-proof of TST-1056003)
    # input: publishRelease
    # expect: every published file has a detached signature that holds against the publisher's public key; SHA256SUMS lists each file's SHA-256; the notes name the publisher of macOS and of Windows and none for Linux; the private key is in no published file or note
    def test_a_release_of_verified_files_is_published_with_every_signature_and_the_publishers_names(self):
        for loaded in of_kind("signed"):
            with self.subTest(case=loaded["name"]):
                self.assertEqual(result(loaded["case"]), loaded["case"]["expected"])

    # TST-1056005 · level: release · module: MOD-bridge-build
    # guards: THE BRIDGE IS SIGNED BY ITS PUBLISHER
    # given: an environment that lacks exactly one of a platform's secrets, in turn
    # input: buildPlatform for that platform
    # expect: SecretMissing naming the secret, before a checkout is read or a file is written
    def test_a_platform_is_not_built_without_the_publishers_secrets(self):
        for loaded in of_kind("secrets"):
            with self.subTest(case=loaded["name"]):
                self.assertEqual(result(loaded["case"]), loaded["case"]["expected"])

    # TST-1056006 · level: release · module: MOD-desktop-shell
    # guards: THE BRIDGE IS UPDATED ONLY BY THE PERSON'S CHOICE
    # given: the packaged app started over a constructed Electron (build.json of 2026.10.0, the publisher's public key), a newer release 2026.11.0 in the feed, and in turn: everything signed by the publisher; the feed signed by another key; the file signed by another key
    # input: the window's requests: the state of the updates, Download, Install and restart without the decision, Install and restart with it
    # expect: the signed newer release is offered with its notes and nothing is downloaded until Download; the update installs only after the person's decision and once (the counter-proof); a feed with an invalid signature offers nothing; a file with an invalid signature is deleted, is never installable, and the app is never asked to install
    def test_an_update_is_offered_and_installed_only_on_the_persons_click_and_only_with_a_valid_signature(self):
        for loaded in of_kind("updating"):
            with self.subTest(case=loaded["name"]):
                self.assertEqual(result(loaded["case"]), loaded["case"]["expected"])


if __name__ == "__main__":
    unittest.main()
