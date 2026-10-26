# Module: MOD-desktop-shell
# Guards: THE BRIDGE IS CONFIGURED IN ITS WINDOW OR FROM AN EXPORT
# Level: release
"""SPEC section 14 - the check named tests/test_bridge_settings.py.

The cases and their expected results live in tests/test_bridge_settings.md. This file loads them and drives, in Node, the Bridge's real window (src/desktop-shell/window.mjs, in a small
EventTarget DOM, as a person presses and types in it) over the real app entry (src/desktop-shell/main.mjs) started on a constructed Electron (tests/desktop-shell.d/entry.mjs), with the
real server on loopback, the real settings file and a fixture settings export written by the dashboard's own writer (MOD-browser-store's exportSettings). Written by a participant who built
none of the Bridge items (RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER).
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
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const SRC = (path) => pathToFileURL(join(process.cwd(), "src", path)).href;
const TESTS = (path) => pathToFileURL(join(process.cwd(), "tests", path)).href;
const ORIGIN = "https://carol.github.io";

// ---------------------------------------------------------------- the window's DOM, as the window's own tests make it
class Text { constructor(value) { this.value = String(value); } get textContent() { return this.value; } }
class Element extends EventTarget {
  constructor(name) { super(); this.localName = name; this.childNodes = []; this.attributes = new Map(); this.className = ""; this.value = ""; this.type = ""; this.checked = false; this.innerHTML = ""; this.parentNode = null; }
  append(...nodes) { for (const node of nodes.flat()) { const child = typeof node === "string" ? new Text(node) : node; this.childNodes.push(child); child.parentNode = this; } }
  replaceChildren(...nodes) { this.childNodes = []; this.append(...nodes); }
  remove() { if (this.parentNode) this.parentNode.childNodes.splice(this.parentNode.childNodes.indexOf(this), 1); }
  get textContent() { return this.childNodes.map((child) => child.textContent).join(""); }
  set textContent(value) { this.replaceChildren(String(value)); }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  getElementsByTagName(name) { return descendants(this, (node) => node.localName === name); }
}
class Storage { constructor() { this.values = new Map(); } getItem(key) { return this.values.get(key) ?? null; } setItem(key, value) { this.values.set(key, String(value)); } removeItem(key) { this.values.delete(key); } get length() { return this.values.size; } key(index) { return [...this.values.keys()][index] ?? null; } }
const descendants = (root, predicate) => { const found = []; const visit = (node) => { for (const child of node.childNodes ?? []) { if (child instanceof Element) { if (predicate(child)) found.push(child); visit(child); } } }; visit(root); return found; };
const settle = () => new Promise((resolve) => setTimeout(resolve, 30));
// The agents are found by running each CLI, so the view takes a moment: wait, at most three seconds, until the condition holds.
const until = async (condition) => { for (let i = 0; i < 100 && !condition(); i += 1) await settle(); };

// ---------------------------------------------------------------- the Bridge's app and its window
const { startEntry, stopEntry, temporary, bridgeAsks } = await import(TESTS("desktop-shell.d/entry.mjs"));
const { unusedPorts } = await import(TESTS("desktop-shell.d/ports.mjs"));
const { saveSettings } = await import(SRC("desktop-shell/settings.mjs"));
const { exportSettings } = await import(SRC("browser-store/index.mjs"));

// The computer has Claude Code installed (a fixture executable) and no other agent.
function computer() {
  const root = temporary();
  const bin = join(root, "bin");
  mkdirSync(bin);
  writeFileSync(join(bin, "claude"), `#!/bin/sh\ncase "$*" in '--version') echo '2.1.300';; 'auth status') echo '{"authMethod":"claude.ai"}';; *) exit 64;; esac\n`, { mode: 0o755 });
  chmodSync(join(bin, "claude"), 0o755);
  process.env.PATH = bin;
  return root;
}

async function opened() {
  const root = computer();
  const appData = temporary(), data = temporary(), resources = temporary();
  const [first, second] = await unusedPorts(2);
  saveSettings(data, { name: "before", port: first, agents: [], products: [], every: 300, paused: true, jumpHost: null, tunnels: [] });
  const entry = await startEntry({ resources, appData, platform: "linux", argv: ["--instance=carol/product-x", `--origin=${ORIGIN}`, `--port=${first}`, `--data-folder=${data}`] });
  assert.equal(entry.outcome.kind, "loaded", `the entry started (errors: ${entry.errors.join(" | ")})`);
  const handlers = entry.fake.handlers;
  const document = { createElement: (name) => new Element(name), createTextNode: (value) => new Text(value) };
  document.head = document.createElement("head"); document.body = document.createElement("body");
  globalThis.document = document;
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: new Storage() });
  const browser = new EventTarget();
  const location = { hash: "#pairing" };
  Object.defineProperty(globalThis, "location", { configurable: true, value: location });
  Object.defineProperty(globalThis, "window", { configurable: true, value: browser });
  browser.bridge = {
    state: (action, value) => handlers["bridge-state"]({}, action, value),
    chooseFolder: () => handlers["choose-folder"]({}), copy: (text) => handlers.copy({}, text), pairAnew: () => handlers["pair-anew"]({}),
    pause: () => handlers.pause({}), resume: () => handlers.resume({}), retryPort: (port) => handlers["retry-port"]({}, port), quit: () => handlers.quit({}),
  };
  await import(`${SRC("desktop-shell/window.mjs")}?window=${Date.now()}`);
  const body = document.body;
  const redraw = async () => { browser.dispatchEvent(new Event("hashchange")); await settle(); };
  const button = (label) => descendants(body, (node) => node.localName === "button" && node.textContent === label);
  const press = async (label, last = false) => { const control = last ? button(label).at(-1) : button(label)[0]; assert.ok(control, `${label} is in the window`); control.dispatchEvent(new Event("click")); await settle(); };
  const fieldOf = (label) => { const caption = descendants(body, (node) => node.localName === "label" && node.textContent.trim() === label)[0]; assert.ok(caption, `${label} is in the window`); return descendants(caption, (node) => ["input", "textarea"].includes(node.localName))[0]; };
  const type = (label, value) => { fieldOf(label).value = String(value); };
  // A view is drawn once the app's main process has answered, which on a loaded computer takes longer than one settle: wait until the view with this heading is drawn anew.
  const view = (heading) => descendants(body, (node) => node.localName === "h1" && node.textContent === heading)[0];
  const drawnAnew = async (heading, action) => { const before = view(heading); await action(); await until(() => view(heading) && view(heading) !== before); };
  const HEADINGS = { Agents: "Bridge agents", Pairing: "Agent M Bridge pairing", Settings: "Bridge settings", Tunnels: "Tunnels" };
  const goTo = (label) => drawnAnew(HEADINGS[label], async () => { await press(label); await redraw(); });
  await redraw();
  const dataFiles = (folder = data) => readdirSync(folder, { recursive: true }).filter((name) => statSync(join(folder, name)).isFile()).sort();
  return {
    first, second, data, body, handlers, press, type, fieldOf, goTo, drawnAnew, redraw, descendants,
    settingsFile: () => JSON.parse(readFileSync(join(data, "settings.json"), "utf8")),
    token: () => readFileSync(join(data, "pairing-token"), "utf8").trim(),
    // The token while Pair anew may still be writing it: none yet is no token.
    tokenWritten: () => { try { return readFileSync(join(data, "pairing-token"), "utf8").trim(); } catch { return ""; } },
    everythingWritten: () => dataFiles().map((name) => readFileSync(join(data, name), "utf8")).join("\n"),
    answers: async (port, token) => (await bridgeAsks(port, ORIGIN, token)).status,
    refusedAt: async (port) => (await bridgeAsks(port, ORIGIN, null)).status,
    done: async () => { await stopEntry(entry); for (const folder of [root, appData, data, resources]) rmSync(folder, { recursive: true, force: true }); },
  };
}

// ---------------------------------------------------------------- the cases
async function setInTheWindow(input) {
  const app = await opened();
  try {
    const out = {};
    const firstToken = app.token();
    await app.goTo("Settings");
    app.type("Name", input.name); app.type("Port", app.second); app.type("Products", input.products.join("\n")); app.type("Interval seconds", input.every);
    // Save settings restarts the Bridge on the port set; the view is drawn anew once it has.
    await app.drawnAnew("Bridge settings", () => app.press("Save settings"));
    const saved = app.settingsFile();
    out.afterSettings = { ...saved, port: saved.port === app.second ? "the port set" : saved.port };
    out.portSetIsServed = await app.answers(app.second, firstToken);
    out.oldPortIsFree = await app.refusedAt(app.first).then(() => "answers", () => "refused");
    out.tokenKeptByASettingsSave = app.token() === firstToken;
    await app.goTo("Tunnels");
    app.type("Jump host", input.jumpHost.hostname); app.type("SSH user", input.jumpHost.user); app.type("SSH port", input.jumpHost.sshPort);
    await app.drawnAnew("Tunnels", () => app.press("Save jump host"));
    out.jumpHost = app.settingsFile().jumpHost;
    await app.goTo("Agents");
    const rowOfClaude = () => app.descendants(app.body, (node) => node.localName === "p" && app.descendants(node, (child) => child.localName === "strong" && child.textContent === "claude").length)[0];
    await until(() => rowOfClaude());
    const row = rowOfClaude();
    assert.ok(row, "the installed agent is listed");
    app.descendants(row, (node) => node.type === "checkbox")[0].checked = true;
    app.type("Working folder", input.agentFolder);
    await app.press("Save agents");
    await until(() => /Saved \d+ agent\(s\)\./.test(app.body.textContent));
    out.agents = app.settingsFile().agents;
    await app.goTo("Pairing");
    await app.press("Pair anew"); await app.press("Pair anew", true);
    // Pair anew writes the new token and then draws the window anew: wait until the window shows a token other than the first, the one written.
    await until(() => { const written = app.tokenWritten(); return written && written !== firstToken && app.body.textContent.includes(written); });
    const fresh = app.token();
    out.pairedAnew = { differs: fresh !== firstToken, oldToken: await app.answers(app.second, firstToken), newToken: await app.answers(app.second, fresh), shownInWindow: app.body.textContent.includes(fresh) };
    const final = app.settingsFile();
    out.final = { name: final.name, port: final.port === app.second ? "the port set" : final.port, products: final.products, every: final.every, jumpHost: final.jumpHost, agents: final.agents };
    return out;
  } finally { await app.done(); }
}

const KEYS = (text) => text.split("\n");
async function exportOf(kind, instance = "carol/product-x") {
  const entries = {
    products: ["https://github.com/alice/from-the-export-a", "https://github.com/alice/from-the-export-b"],
    "jump-host": { hostname: "jump.from-export.example", user: "exportuser", sshPort: 2200, portRange: [40100, 40199], login: { user: "web", password: "must-not-persist-web" } },
    "bridge:gpu-box": { port: 40111, token: "token-of-gpu-box" },
    "bridge:lab-pc": { port: 40112, token: "token-of-lab-pc" },
    "github-token": { value: "must-not-persist-github" }, "endpoint:main": { key: "must-not-persist-endpoint" }, mailbox: { imap: { password: "must-not-persist-mail" } },
  };
  const storage = new class { #e = Object.entries(entries).map(([key, value]) => [`agent-m:${instance}:${key}`, JSON.stringify(value)]); get length() { return this.#e.length; } key(i) { return this.#e[i]?.[0] ?? null; } getItem(k) { return this.#e.find(([s]) => s === k)?.[1] ?? null; } }();
  return exportSettings({ prefix: `agent-m:${instance}:`, storage }, kind === "locked" ? "correct horse" : "");
}

async function imported(input) {
  const app = await opened();
  try {
    const out = {};
    const firstToken = app.token();
    await app.goTo("Settings");
    app.type("Name", "set-in-the-window"); app.type("Products", "https://github.com/alice/set-in-the-window"); app.type("Interval seconds", 77);
    await app.drawnAnew("Bridge settings", () => app.press("Save settings"));
    out.before = { name: app.settingsFile().name, products: app.settingsFile().products, every: app.settingsFile().every };
    const text = await exportOf(input.export, input.instance);
    await app.goTo("Settings");
    app.fieldOf("Settings export").value = text;
    app.fieldOf("Passphrase").value = input.passphrase ?? "";
    app.fieldOf("Bridge name").value = input.bridge ?? "";
    app.fieldOf("This is my own computer").checked = Boolean(input.ownComputer);
    const settingsBefore = readFileSync(join(app.data, "settings.json"), "utf8");
    await app.press("Import settings export");
    // A locked export is opened with a key made from the passphrase, which takes a moment: wait until the window says what happened.
    await until(() => /Import refused|Taken over/.test(app.body.textContent));
    const after = app.settingsFile();
    const shown = app.body.textContent;
    out.refused = shown.match(/Import refused: [^.]*\./)?.[0] ?? null;
    if (out.refused) out.settingsFileUnchanged = readFileSync(join(app.data, "settings.json"), "utf8") === settingsBefore;
    else {
      out.settings = { name: after.name, products: after.products, every: after.every, jumpHost: after.jumpHost,
        tunnels: after.tunnels.map((plan) => ({ direction: plan.direction, jumpHost: plan.jumpHost, user: plan.user, sshPort: plan.sshPort, remotePort: plan.remotePort, bind: plan.bind, bridgePortIsItsOwn: plan.bridgePort === after.port })) };
      out.ownPortKept = after.port === app.first;
      out.pairingToken = app.token() === firstToken ? "kept" : app.token();
      out.oldTokenStillAnswers = await app.answers(app.first, firstToken);
      out.newTokenAnswers = await app.answers(app.first, app.token());
    }
    out.nothingElseKept = !/must-not-persist/.test(app.everythingWritten());
    out.settingsKeys = Object.keys(app.settingsFile()).sort();
    return out;
  } finally { await app.done(); }
}

const KINDS = { "set-in-the-window": setInTheWindow, imported };
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
            "\nprocess.stdout.write('@@RESULT@@' + JSON.stringify(await KINDS[input.kind](input)));\nprocess.exit(0);")
    run = subprocess.run(["node", "--input-type=module", "-e", code], cwd=ROOT, capture_output=True, text=True, timeout=120)
    if run.returncode != 0:
        raise AssertionError(run.stderr.strip()[-1500:])
    return json.loads(run.stdout.split("@@RESULT@@", 1)[1])


def of_kind(kind: str) -> list[dict]:
    found = [loaded for loaded in cases() if loaded["case"]["input"]["kind"] == kind]
    if not found:
        raise AssertionError(f"no case of kind {kind}")
    return found


class TestBridgeSettings(unittest.TestCase):
    # TST-1056101 · level: release · module: MOD-desktop-shell
    # guards: THE BRIDGE IS CONFIGURED IN ITS WINDOW OR FROM AN EXPORT
    # given: the Bridge's app running with its window, on a computer that has one supported agent installed; the Bridge was paired with a first token
    # input: in the window, set the name, the port, the served products and the interval and press Save settings; set the jump host and press Save jump host; tick the installed agent, give it a working folder and press Save agents; press Pair anew and confirm
    # expect: every setting is kept as it was set in the settings file (the name, the port the Bridge then listens on, the products, the interval, the jump host, the agent with its working folder), the pairing token is kept by a save of settings and replaced by Pair anew, after which the old token is refused and the new one answered
    def test_every_setting_is_kept_as_it_was_set_in_the_window(self):
        for loaded in of_kind("set-in-the-window"):
            with self.subTest(case=loaded["name"]):
                self.assertEqual(result(loaded["case"]), loaded["case"]["expected"])

    # TST-1056102 · level: release · module: MOD-desktop-shell
    # guards: THE BRIDGE IS CONFIGURED IN ITS WINDOW OR FROM AN EXPORT
    # given: a Bridge whose settings were set in the window, and a fixture settings export written by the dashboard's own writer, plain or locked, with products, the jump host, two Bridges reached through it and secrets (a repository token, an endpoint key, a mailbox password, the jump host's web login)
    # input: in the window, Import settings export for the Bridge named in the export, for the person's own computer, with a wrong passphrase, and for an export of another instance
    # expect: the part the export holds is taken from the file (the products, the jump host, the named Bridge's name and its token as the pairing token, the reverse tunnel with its port on the jump host; for the own computer a forward for each Bridge and the name and token kept); the Bridge's own port and the interval stay; no secret of the export is written anywhere; an export of another instance and a wrong passphrase are refused and change nothing
    def test_the_part_an_export_holds_is_taken_from_the_file_and_nothing_else(self):
        for loaded in of_kind("imported"):
            with self.subTest(case=loaded["name"]):
                self.assertEqual(result(loaded["case"]), loaded["case"]["expected"])


if __name__ == "__main__":
    unittest.main()
