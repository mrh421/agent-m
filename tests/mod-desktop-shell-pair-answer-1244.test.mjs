// MOD-desktop-shell — the start passes the Bridge's name and release to its server (ITM-1244): the server is started "with the name of the
// settings in force and the version of `build.json`, `null` for a start without it" (MOD-desktop-shell, Interfaces: Start), so that the
// pair answer names this Bridge and its release.
// Run: node --test tests/mod-desktop-shell-pair-answer-1244.test.mjs
//
// Module: MOD-desktop-shell
// Guards: UC-044; UC-011; THE BRIDGE IS CONFIGURED IN ITS WINDOW OR FROM AN EXPORT
// Level: unit
//
// These cases start the app's real entry, src/desktop-shell/main.mjs, over a constructed Electron (tests/desktop-shell.d/entry.mjs). The
// Bridge's server is the real one, on loopback, and is asked over HTTP. No other service is contacted.

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { unusedPorts } from "./desktop-shell.d/ports.mjs";
import { bridgeAsks, bridgeSettings, startEntry, stopEntry, temporary } from "./desktop-shell.d/entry.mjs";
import { saveSettings } from "../src/desktop-shell/settings.mjs";

const BUILD = { instance: "alice/agent-m", appId: "io.github.alice.agent-m.bridge", origin: "https://alice.github.io", version: "2026.10.0", commit: "0123456789abcdef0123456789abcdef01234567" };

const pairAnswer = async (port, folder, origin) => {
  const token = readFileSync(join(folder, "pairing-token"), "utf8").trim();
  const answer = await bridgeAsks(port, origin, token);
  assert.equal(answer.status, 200, "known positive: the Bridge answers its origin with the token in force");
  return answer.json();
};

// A start from the source folder: the instance, its origin, the port and the data folder from the command line; no build.json.
const sourceStart = (resources, appData, port, data) => startEntry({ resources, appData,
  argv: ["--instance=alice/agent-m", "--origin=https://alice.github.io", `--port=${port}`, `--data-folder=${data}`] });

// TST-1244105 · level: unit · module: MOD-desktop-shell
// guards: UC-044; THE BRIDGE IS CONFIGURED IN ITS WINDOW OR FROM AN EXPORT
// given: a packaged app — a resources folder holding build.json of version 2026.10.0 — whose settings name the Bridge "lab-pc" at a free port
// input: the entry's start, then GET /v1/pair from build.json's origin with the pairing token
// expect: the answer's bridge is { name: "lab-pc", version: "2026.10.0", platform: process.platform }
// Planted fault: starting the server without the settings' name or without build.json's version makes the answer "Bridge" or "unreleased", and the deepEqual fails.
test("TST-1244105: a packaged start answers the pair request with the settings' name and build.json's version", async () => {
  const appData = temporary(), resources = temporary();
  writeFileSync(join(resources, "build.json"), JSON.stringify(BUILD));
  const [port] = await unusedPorts(1);
  const folder = join(appData, BUILD.appId);
  saveSettings(folder, { ...bridgeSettings(port), name: "lab-pc" });
  const started = await startEntry({ resources, appData });
  try {
    assert.equal(started.outcome.kind, "loaded", `the entry started (errors: ${started.errors.join(" | ")})`);
    const { bridge } = await pairAnswer(port, folder, BUILD.origin);
    assert.deepEqual(bridge, { name: "lab-pc", version: "2026.10.0", platform: process.platform }, "failure node: the pair answer of the composed server");
  } finally { await stopEntry(started); rmSync(appData, { recursive: true, force: true }); rmSync(resources, { recursive: true, force: true }); }
});

// TST-1244106 · level: unit · module: MOD-desktop-shell
// guards: UC-044; UC-011
// given: a start from the source folder — no build.json, the instance and origin on the command line — whose settings name the Bridge "lab-pc"
// input: the entry's start, then GET /v1/pair from the origin with the pairing token
// expect: the answer's bridge is { name: "lab-pc", version: null, platform: process.platform }, the key version present with null
// Planted fault: passing no version to the server, or "unreleased", makes the version absent or a text, and the assertions fail.
test("TST-1244106: a start without build.json answers the pair request with version null", async () => {
  const appData = temporary(), resources = temporary(), data = temporary();
  const [port] = await unusedPorts(1);
  saveSettings(data, { ...bridgeSettings(port), name: "lab-pc" });
  const started = await sourceStart(resources, appData, port, data);
  try {
    assert.equal(started.outcome.kind, "loaded", `the entry started (errors: ${started.errors.join(" | ")})`);
    const { bridge } = await pairAnswer(port, data, BUILD.origin);
    assert.ok(Object.hasOwn(bridge, "version"), "the answer names the version, null included");
    assert.deepEqual(bridge, { name: "lab-pc", version: null, platform: process.platform });
  } finally { await stopEntry(started); for (const folder of [appData, resources, data]) rmSync(folder, { recursive: true, force: true }); }
});

// TST-1244107 · level: unit · module: MOD-desktop-shell
// guards: UC-044; THE BRIDGE IS CONFIGURED IN ITS WINDOW OR FROM AN EXPORT
// given: a running Bridge started from the source folder whose settings name it "lab-pc"
// input: GET /v1/pair; the window's request "save-settings" with the name "gpu-box"; GET /v1/pair again
// expect: the first answer's bridge.name is "lab-pc", the second's "gpu-box" — the name of the settings in force
// Planted fault: starting the server with a fixed name, or with the name of the settings read at the first start, makes the second answer differ from "gpu-box".
test("TST-1244107: after the name is changed in the window, the pair answer carries the new name", async () => {
  const appData = temporary(), resources = temporary(), data = temporary();
  const [port] = await unusedPorts(1);
  saveSettings(data, { ...bridgeSettings(port), name: "lab-pc" });
  const started = await sourceStart(resources, appData, port, data);
  try {
    assert.equal(started.outcome.kind, "loaded", `the entry started (errors: ${started.errors.join(" | ")})`);
    assert.equal((await pairAnswer(port, data, BUILD.origin)).bridge.name, "lab-pc");
    await started.fake.handlers["bridge-state"]({}, "save-settings", { name: "gpu-box" });
    assert.equal((await pairAnswer(port, data, BUILD.origin)).bridge.name, "gpu-box", "failure node: the name of the settings in force");
  } finally { await stopEntry(started); for (const folder of [appData, resources, data]) rmSync(folder, { recursive: true, force: true }); }
});
