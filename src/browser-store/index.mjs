// MOD-browser-store — one person's configuration in their browser (docs/architecture/MOD-browser-store.md): its public
// interface. It stores and clears the implemented catalogue keys under the instance's localStorage prefix and lists
// their metadata without returning stored values. The implemented catalogue includes instance and product tokens,
// products, notifications, endpoints, the paired Bridge, each Bridge under its name, the jump host, named remote sessions and recorded setting tests.
// Its canonical settings export is implemented in export.mjs. expiringSoon names the stored tokens that expire within
// fourteen days or have expired.
//
// Module: MOD-browser-store
//
// catalogue.mjs names every key this item's catalogue knows; store.mjs reads, writes and clears localStorage under the
// instance's prefix and throws StoreError. Every other file of this folder is private to it.

import { isKnownKey } from "./catalogue.mjs";
import { getRaw, openInstanceStorage, removeRaw, setRaw, StoreError, tabStorage } from "./store.mjs";
import { removeSignIn, signInOf, viewOfStorage } from "./sign-in.mjs";
import { moveLegacyKeys } from "./legacy-keys.mjs";
export { exportSettings, importSettings, readExport } from "./export.mjs";

export { StoreError };

// The mailbox's sign-in: no key of its own, the sign-in library's keys for the connection.
const MAILBOX_SIGN_IN = "mailbox-sign-in";

// openStore(instance: string) -> Store — the store for the instance "owner/repository" in this browser; the entries an earlier
// dashboard kept under `agent-m.` are moved into the instance's keys first (legacy-keys.mjs). Throws StorageUnavailable.
export function openStore(instance) {
  const store = openInstanceStorage(instance);
  moveLegacyKeys(store, instance);
  return store;
}

// readSetting(store, key) -> the value kept under `key`, or null when it is not set.
export function readSetting(store, key) {
  const raw = getRaw(store, key);
  if (raw === null) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

// writeSetting(store, key, value) -> void — stores `value` under a key of the catalogue. Throws UnknownSetting for any
// other key, and StorageUnavailable. Sets no cookie and puts nothing into an address.
export function writeSetting(store, key, value) {
  if (!isKnownKey(key)) throw new StoreError("UnknownSetting", { key }, `${key} is not a setting MOD-browser-store keeps.`);
  setRaw(store, key, JSON.stringify(value));
}

// readTabValue(store, key) -> the value this browser tab keeps under `key` for the instance, or null. No other tab reads
// it. Throws StorageUnavailable.
export function readTabValue(store, key) {
  const raw = tabStorage().getItem(store.prefix + key);
  if (raw === null || raw === undefined) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

// writeTabValue(store, key, value) -> void — keeps `value` in this tab's sessionStorage under the instance's prefix, or
// removes it for null. A tab value is no setting: it is neither listed, exported nor imported. Throws
// StorageUnavailable.
export function writeTabValue(store, key, value) {
  const storage = tabStorage();
  if (value === null) { storage.removeItem(store.prefix + key); return; }
  try {
    storage.setItem(store.prefix + key, JSON.stringify(value));
  } catch {
    throw new StoreError("StorageUnavailable", {}, "sessionStorage refused to store this value.");
  }
}

// clearSetting(store, key) -> void — removes the entry from localStorage itself, not only from a form (A CLEAR IS A
// REAL CLEAR).
// The sign-in library's keys for the connection the `mailbox` entry names, as the store holds them now.
function signInOfStore(store) {
  return signInOf(viewOfStorage(store.storage), readSetting(store, "mailbox")?.graph?.clientId);
}

export function clearSetting(store, key) {
  const signIn = key === "mailbox" || key === MAILBOX_SIGN_IN ? signInOfStore(store) : null;
  if (key !== MAILBOX_SIGN_IN) removeRaw(store, key);
  if (signIn) removeSignIn(store.storage, signIn);
}

// clearEverything(store) -> void — removes every raw localStorage entry of this instance, including an entry that no
// longer belongs to the current catalogue, while leaving every other instance and unrelated browser state untouched.
export function clearEverything(store) {
  const signIn = signInOfStore(store);
  for (let index = store.storage.length - 1; index >= 0; index -= 1) {
    const storageKey = store.storage.key(index);
    if (storageKey?.startsWith(store.prefix)) store.storage.removeItem(storageKey);
  }
  removeSignIn(store.storage, signIn);
}

const LITERAL_SETTING_KEYS = ["github-token", "products", "notifications", "notified", "bridge", "jump-host", "mailbox", "browser", "not-an-issue", MAILBOX_SIGN_IN];

function settingDescription(key) {
  if (key === "mailbox") return { label: "Mailbox", secret: true, grants: "access to the mailbox", setUpIn: "mailbox" };
  if (key === MAILBOX_SIGN_IN) return { label: "Mailbox sign-in", secret: true, grants: "access to the Microsoft 365 mailbox", setUpIn: "mailbox" };
  if (key === "not-an-issue") return { label: "Mails marked not an issue", secret: false, grants: "the list of mails this browser does not propose again", setUpIn: "mail" };
  if (key === "browser") return { label: "Browser identifier", secret: false, grants: "this browser's name in the job records its tab takes", setUpIn: "settings" };
  if (key === "github-token") return { label: "GitHub token", secret: true, grants: "writes — commits, issues, pull requests, workflow runs and Actions secrets — to every repository it was given, under your account", setUpIn: "settings" };
  if (key === "products") return { label: "Products", secret: false, grants: "the managed product list", setUpIn: "add-product" };
  if (key === "notifications") return { label: "Notifications", secret: false, grants: "acceptance notifications", setUpIn: "notifications" };
  if (key === "notified") return { label: "Notified files", secret: false, grants: "the record of notified files", setUpIn: "notifications" };
  if (key === "bridge") return { label: "Bridge", secret: true, grants: "access to the paired Bridge", setUpIn: "bridge" };
  if (key === "jump-host") return { label: "Jump host", secret: true, grants: "access to the configured jump host", setUpIn: "bridge" };
  if (key.startsWith("github-token:")) return { label: `GitHub token: ${key.slice("github-token:".length)}`, secret: true, grants: "writes — commits, issues, pull requests, workflow runs and Actions secrets — to the one GitHub product it was created for, under your account", setUpIn: "add-product" };
  if (key.startsWith("gitlab-token:")) return { label: `GitLab token: ${key.slice("gitlab-token:".length)}`, secret: true, grants: "writes — commits — to the one GitLab project it was created for, with the role it was given there", setUpIn: "add-product" };
  if (key.startsWith("endpoint:")) return { label: `Endpoint: ${key.slice("endpoint:".length)}`, secret: true, grants: "access to a model endpoint", setUpIn: "endpoints" };
  if (key.startsWith("session:")) return { label: `CLI session: ${key.slice("session:".length)}`, secret: false, grants: "the place, context, model and capabilities declared for a CLI session a Bridge offers, which the prompt bar offers", setUpIn: "bridge" };
  if (key.startsWith("bridge:")) return { label: `Bridge: ${key.slice("bridge:".length)}`, secret: true, grants: "hands jobs to this Bridge and the CLI sessions it offers, which work there with that computer's own credentials", setUpIn: "bridge" };
  if (key.startsWith("remote-session:")) return { label: `Remote session: ${key.slice("remote-session:".length)}`, secret: true, grants: "access to a remote Bridge session", setUpIn: "bridge" };
  if (key.startsWith("last-test:")) return { label: `Last test: ${key.slice("last-test:".length)}`, secret: false, grants: "the recorded result of a setting test", setUpIn: "settings" };
  if (key.startsWith("resource-key:")) return { label: `Resource key: ${key.slice("resource-key:".length)}`, secret: true, grants: "access to one resource's own server", setUpIn: "resources" };
  if (key.startsWith("acknowledged:")) return { label: `Acknowledged: ${key.slice("acknowledged:".length)}`, secret: false, grants: "the recorded acknowledgement date", setUpIn: "settings" };
  return null;
}

function storedSettingKeys(store) {
  const keys = [];
  for (let index = 0; index < store.storage.length; index += 1) {
    const storageKey = store.storage.key(index);
    if (!storageKey?.startsWith(store.prefix)) continue;
    const key = storageKey.slice(store.prefix.length);
    if (!isKnownKey(key) || LITERAL_SETTING_KEYS.includes(key)) continue;
    keys.push(key);
  }
  return keys.sort();
}

function expiryOf(value) {
  return value && typeof value === "object" && typeof value.expires === "string" ? value.expires : null;
}

function lastTestOf(store, key) {
  const value = readSetting(store, `last-test:${key}`);
  if (!value || typeof value !== "object" || typeof value.at !== "string" || typeof value.outcome !== "string") return null;
  return { at: value.at, outcome: value.outcome };
}

// listSettings(store) -> SettingInfo[] — every implemented literal setting, set or not, and stored instances of the
// implemented dynamic families. It reads only this instance's localStorage keys and never returns stored values,
// including credentials.
export function listSettings(store) {
  return [...LITERAL_SETTING_KEYS, ...storedSettingKeys(store)].map((key) => {
    const description = settingDescription(key);
    return { key, ...description, expires: expiryOf(readSetting(store, key)), lastTest: lastTestOf(store, key) };
  });
}

// The days a token's warning begins before its recorded expiry (A TOKEN'S EXPIRY IS WARNED OF IN ADVANCE).
const WARN_DAYS = 14;
const DAY_MS = 864e5;

// The whole days from the UTC date of `now` to the date `expires` ("YYYY-MM-DD"), negative once it is past; null where
// `expires` is no date.
function daysUntil(expires, now) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(expires);
  if (!match) return null;
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.round((Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) - today) / DAY_MS);
}

const isTokenKey = (key) => key === "github-token" || key.startsWith("github-token:") || key.startsWith("gitlab-token:");

// expiringSoon(store, now) -> { key, expires }[] — every stored token whose recorded expiry is within fourteen days of
// `now`, or past. A token with no recorded expiry is not named. It reads only this store and returns no token value.
export function expiringSoon(store, now) {
  return listSettings(store)
    .filter((setting) => isTokenKey(setting.key) && typeof setting.expires === "string")
    .filter((setting) => { const days = daysUntil(setting.expires, now); return days !== null && days <= WARN_DAYS; })
    .map((setting) => ({ key: setting.key, expires: setting.expires }));
}

const text = (value) => typeof value === "string" ? value : null;

function secretOf(key, value) {
  if (!value || typeof value !== "object") return null;
  if (key === "github-token" || key.startsWith("github-token:") || key.startsWith("gitlab-token:")) return text(value.value);
  if (key.startsWith("endpoint:")) return text(value.key);
  if (key.startsWith("resource-key:")) return text(value.value);
  if (key === "bridge" || key.startsWith("bridge:") || key.startsWith("remote-session:")) return text(value.token);
  if (key === "mailbox") return text(value.imap?.password);
  if (key === "jump-host") return text(value.login) ?? text(value.login?.password);
  return null;
}

// secretValues(store) -> string[] — the actual credential strings in the implemented catalogue families. It deliberately
// omits configuration values, labels, products, notifications and recorded test metadata.
export function secretValues(store) {
  const keys = ["github-token", "bridge", "jump-host", "mailbox", ...storedSettingKeys(store)];
  return [...keys.map((key) => secretOf(key, readSetting(store, key))).filter((value) => value !== null), ...signInOfStore(store).secrets];
}
