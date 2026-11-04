// MOD-browser-store keeps a CLI session's declaration under `session:<bridge>:<agent>` and an endpoint's place, context and CI secret (ITM-1185).
//
// Module: MOD-browser-store
// Guards: UC-049; UC-044; THE PROMPT BAR'S ENDPOINTS AND CLI SESSIONS ARE BOUND AS PARTICIPANTS ARE; CONFIGURATION LIVES IN THE BROWSER
// Level: unit
//
// Run: node --test tests/browser-store-session-declaration.test.mjs
//
// The tests use constructed values and a Map-backed localStorage only. They make no network request.

import test from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import {
  StoreError,
  clearSetting,
  exportSettings,
  importSettings,
  listSettings,
  openStore,
  readExport,
  readSetting,
  secretValues,
  writeSetting,
} from "../src/browser-store/index.mjs";

const INSTANCE = "akmaier/agent-m";
const PREFIX = `agent-m:${INSTANCE}:`;
const SESSION = "session:lab:claude";
const SESSION_VALUE = { place: "this computer", context: 200000, model: "claude-opus-5", capabilities: ["read the repository", "draft text", "write to the repository", "run code and tests"] };
const ENDPOINT = "endpoint:hub";
const ENDPOINT_VALUE = { url: "https://models.example.test/v1", kind: "openai", model: "hub-1", key: "endpoint-key-constructed-001", bridge: "lab", place: "Anthropic, USA", context: 128000, secret: "HUB_API_KEY" };

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
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
  Object.defineProperty(globalThis, "crypto", { value: webcrypto, configurable: true, writable: true });
}

// TST-1185001 · level: unit · module: MOD-browser-store
// guards: UC-049; UC-044; THE PROMPT BAR'S ENDPOINTS AND CLI SESSIONS ARE BOUND AS PARTICIPANTS ARE; CONFIGURATION LIVES IN THE BROWSER
// given: an instance store and a CLI session declaration { place, context, model, capabilities } for the Bridge lab and its agent claude
// input: writeSetting(store, "session:lab:claude", declaration), then readSetting on a reopened store
// expect: the write is accepted and the declaration is read back whole, with no field added or dropped, under the key prefix of the instance
test("TST-1185001: a CLI session's declaration is kept under session:<bridge>:<agent> and read back whole", () => {
  const storage = memoryStorage();
  install(storage);

  writeSetting(openStore(INSTANCE), SESSION, SESSION_VALUE);

  assert.deepEqual(readSetting(openStore(INSTANCE), SESSION), SESSION_VALUE);
  assert.notEqual(storage.getItem(PREFIX + SESSION), null, "the declaration stands under the instance's prefix in localStorage");
});

// TST-1185002 · level: unit · module: MOD-browser-store
// guards: UC-049; UC-044; EVERY SETTING IS REACHED FROM ONE PAGE; A BROWSER SETTING IS TESTED AND CLEARED WHERE IT IS SHOWN; A CLEAR IS A REAL CLEAR
// given: a stored session declaration, an endpoint with a key, and a Bridge token
// input: listSettings, secretValues, then clearSetting on the session
// expect: the session is listed with the seven SettingInfo fields, secret false, setUpIn "bridge" and a nonempty grants; secretValues holds no session field; clear removes its raw entry
test("TST-1185002: the session is listed as a setting that is not secret, set up where the Bridge is paired, and clears for real", () => {
  const storage = memoryStorage();
  install(storage);
  const store = openStore(INSTANCE);
  writeSetting(store, SESSION, SESSION_VALUE);
  writeSetting(store, "bridge:lab", { address: "http://127.0.0.1:8111", token: "bridge-token-constructed-002" });

  const info = listSettings(store).find((setting) => setting.key === SESSION);
  assert.ok(info, "the session is listed");
  assert.deepEqual(Object.keys(info).sort(), ["expires", "grants", "key", "label", "lastTest", "secret", "setUpIn"]);
  assert.equal(info.secret, false);
  assert.equal(info.setUpIn, "bridge");
  assert.equal(typeof info.grants, "string");
  assert.ok(info.grants.length > 0, "it says what it grants");
  assert.ok(info.label.includes("lab") && info.label.includes("claude"), "its label names the Bridge and the agent");
  assert.equal(info.expires, null);
  assert.equal(info.lastTest, null);

  const secrets = secretValues(store);
  assert.deepEqual(secrets, ["bridge-token-constructed-002"], "only the Bridge's token is a secret value");

  clearSetting(store, SESSION);
  assert.equal(storage.getItem(PREFIX + SESSION), null, "Clear removes the raw entry");
  assert.equal(listSettings(store).some((setting) => setting.key === SESSION), false);
});

// TST-1185003 · level: unit · module: MOD-browser-store
// guards: UC-049; UC-044; SETTINGS ARE EXPORTED AND IMPORTED WITH THEIR SECRETS; AN EXPORT CAN BE LOCKED WITH A PASSPHRASE
// given: one browser holding a session declaration and an endpoint, and an empty browser of the same instance
// input: exportSettings (plain and locked), readExport, then importSettings into the empty browser
// expect: both exports carry the session whole; readExport returns it; the import adds the session key and the empty browser reads it back whole
test("TST-1185003: the export and the import carry a session declaration like every other non-secret setting", async () => {
  install(memoryStorage());
  const source = openStore(INSTANCE);
  writeSetting(source, SESSION, SESSION_VALUE);
  writeSetting(source, ENDPOINT, ENDPOINT_VALUE);

  const plain = await exportSettings(source);
  assert.deepEqual(JSON.parse(plain).settings[SESSION], SESSION_VALUE);
  const locked = await exportSettings(source, "constructed passphrase");
  assert.equal(locked.includes("claude-opus-5"), false, "the locked file shows no field of the declaration");
  assert.deepEqual((await readExport(locked, "constructed passphrase")).settings[SESSION], SESSION_VALUE);
  assert.deepEqual((await readExport(plain)).settings[SESSION], SESSION_VALUE);

  install(memoryStorage());
  const destination = openStore(INSTANCE);
  const result = await importSettings(destination, plain);
  assert.deepEqual(result.added.sort(), [ENDPOINT, SESSION].sort());
  assert.deepEqual(result.kept, []);
  assert.deepEqual(readSetting(destination, SESSION), SESSION_VALUE);
});

// TST-1185004 · level: unit · module: MOD-browser-store
// guards: UC-049; UC-003; CONFIGURATION LIVES IN THE BROWSER; A STORED SECRET IS HIDDEN UNTIL SHOWN
// given: an endpoint { url, kind, model, key, bridge, place, context, secret } where secret is the name of a CI secret
// input: writeSetting, readSetting on a reopened store, listSettings and secretValues
// expect: the endpoint is read back whole; it is listed as secret; secretValues holds its key and neither its secret name, its place nor its context
test("TST-1185004: an endpoint keeps its place, context and CI secret name whole, and only its key counts as secret", () => {
  install(memoryStorage());
  writeSetting(openStore(INSTANCE), ENDPOINT, ENDPOINT_VALUE);
  const store = openStore(INSTANCE);

  assert.deepEqual(readSetting(store, ENDPOINT), ENDPOINT_VALUE);
  assert.equal(listSettings(store).find((setting) => setting.key === ENDPOINT).secret, true);
  assert.deepEqual(secretValues(store), [ENDPOINT_VALUE.key]);
});

// TST-1185005 · level: unit · module: MOD-browser-store
// guards: UC-049; CONFIGURATION LIVES IN THE BROWSER; THE PROMPT BAR'S ENDPOINTS AND CLI SESSIONS ARE BOUND AS PARTICIPANTS ARE
// given: a store holding the products setting, and keys that are no family of the catalogue: session, sessions:lab:claude, session-lab:claude, agent-session:lab:claude
// input: writeSetting with each such key
// expect: each throws UnknownSetting naming the key and writes no byte
test("TST-1185005: a key outside the catalogue is still refused, session-like ones included", () => {
  const storage = memoryStorage();
  install(storage);
  const store = openStore(INSTANCE);
  writeSetting(store, "products", []);
  const before = storage.snapshot();

  for (const key of ["session", "sessions:lab:claude", "session-lab:claude", "agent-session:lab:claude"]) {
    assert.throws(() => writeSetting(store, key, SESSION_VALUE),
      (error) => error instanceof StoreError && error.name === "UnknownSetting" && error.key === key, key);
  }
  assert.deepEqual(storage.snapshot(), before, "a refused key writes nothing");
});
