// MOD-browser-store writes a CLI session's key only with both its names: a non-empty Bridge name and a non-empty agent name (`session:<bridge>:<agent>`) (ITM-1313).
//
// Module: MOD-browser-store
// Guards: UC-049; THE PROMPT BAR'S ENDPOINTS AND CLI SESSIONS ARE BOUND AS PARTICIPANTS ARE; CONFIGURATION LIVES IN THE BROWSER
// Level: unit
//
// Run: node --test tests/browser-store-session-key-names.test.mjs
//
// The tests use constructed values and a Map-backed localStorage only. They make no network request.

import test from "node:test";
import assert from "node:assert/strict";
import { StoreError, listSettings, openStore, readSetting, writeSetting } from "../src/browser-store/index.mjs";

const INSTANCE = "akmaier/agent-m";
const PREFIX = `agent-m:${INSTANCE}:`;
const SESSION = "session:lab:claude";
const SESSION_VALUE = { place: "this computer", context: 200000, model: "claude-opus-5", capabilities: ["read the repository"] };

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
    get length() { return values.size; },
    key: (index) => [...values.keys()][index] ?? null,
    snapshot: () => [...values.entries()].sort(),
  };
}

function install(storage) {
  Object.defineProperty(globalThis, "localStorage", { value: storage, configurable: true, writable: true });
}

// TST-1313001 · level: unit · module: MOD-browser-store
// guards: UC-049; THE PROMPT BAR'S ENDPOINTS AND CLI SESSIONS ARE BOUND AS PARTICIPANTS ARE; CONFIGURATION LIVES IN THE BROWSER
// given: an instance store that holds the setting products and the session lab:claude
// input: writeSetting(store, key, declaration) for session:lab (no agent), session:lab: (an empty agent) and session::claude (an empty Bridge)
// expect: each throws a StoreError named UnknownSetting whose key is the key written, and localStorage is, entry for entry, what it was before
test("TST-1313001: a session key lacking its Bridge name or its agent name is refused and writes nothing", () => {
  const storage = memoryStorage();
  install(storage);
  const store = openStore(INSTANCE);
  writeSetting(store, "products", []);
  writeSetting(store, SESSION, SESSION_VALUE);
  const before = JSON.stringify(storage.snapshot());

  for (const key of ["session:lab", "session:lab:", "session::claude"]) {
    assert.throws(
      () => writeSetting(store, key, SESSION_VALUE),
      (error) => error instanceof StoreError && error.name === "UnknownSetting" && error.key === key,
      JSON.stringify(key),
    );
  }

  assert.equal(JSON.stringify(storage.snapshot()), before, "a refused key writes nothing");
});

// TST-1313002 · level: unit · module: MOD-browser-store
// guards: UC-049; CONFIGURATION LIVES IN THE BROWSER
// given: an empty instance store (counter-proof of TST-1313001: the refusal does not take the key with both names)
// input: writeSetting(store, "session:lab:claude", declaration), then readSetting and listSettings on a store opened again
// expect: the write is accepted and stands in localStorage under the instance's prefix; the declaration is read back whole; the setting is listed as "CLI session: lab:claude"
test("TST-1313002: a session key with both its names is kept, read back whole and listed", () => {
  const storage = memoryStorage();
  install(storage);

  writeSetting(openStore(INSTANCE), SESSION, SESSION_VALUE);

  const reopened = openStore(INSTANCE);
  assert.deepEqual(JSON.parse(storage.getItem(PREFIX + SESSION)), SESSION_VALUE);
  assert.deepEqual(readSetting(reopened, SESSION), SESSION_VALUE);
  assert.ok(listSettings(reopened).some((setting) => setting.key === SESSION && setting.label === "CLI session: lab:claude"));
});
