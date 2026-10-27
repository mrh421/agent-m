// The world of the system and release tests of UC-037 "Connect a mailbox" (tests/system-uc-037-connect-mailbox.test.mjs, tests/release-uc-037-connect-mailbox.test.mjs) — a helper, no test of its own, and it holds no
// expected result. The page is MOD-site-frame's real `startPage` on the main page over the view of MOD-settings-pages, in the browser and the repositories of tests/main-page-home-harness.mjs (the instance
// alice/agent-m at https://alice.github.io/agent-m/, whose docs/participants.md declares the processing places of the rows a test names). Over that world this file puts what UC-037 reaches:
//   - the Bridge as MOD-desktop-shell's `compose` builds it (ITM-430), on the loopback, paired with the origin https://alice.github.io — the same start as tests/mod-desktop-shell-mail-composition.test.mjs, with its
//     stand-in for ssh2 — answering every /v1/mail/<operation> with the real mailHandlers of MOD-mail-protocols; the browser's requests to it are made over node:http with the Origin header a browser sets;
//   - the jump host's web server: requests to https://jump.example.test/bridge/<name>/… are kept and passed to the same composed Bridge, as the proxy configuration of MOD-bridge-client forwards them;
//   - a local IMAP server and a local SMTP server (STARTTLS, a self-signed certificate; LOGIN and AUTH accepted only after TLS and only with the marker password); `startTls: false` makes one offer no
//     encryption, `refuseAuth` makes the SMTP server refuse every login; each keeps every command, every login and whether it came after TLS;
//   - Microsoft's sign-in service: the lookup of a domain (200 for the domain contoso-uni.example, 400 for every other) and the stand-in of the sign-in library's client at globalThis.msal, put there after
//     MOD-mail-routes has loaded the library — its loginPopup answers as the test says (signed in; a permission declined; the registration refused) and keeps what it was asked and what the page showed when
//     the window opened; acquireTokenSilent answers the token of the accounts signed in in this browser, or, with `expired`, that the sign-in has expired;
//   - Microsoft Graph: a fixture answering the folders inbox, drafts, sentitems and any folder by its display name with their counts, keeping every request.
// Every request the page makes passes one layer that keeps it with its address, method, headers and body (`p.requests`). Nothing reaches the network.
//
// Module: MOD-settings-pages; MOD-mail-routes; MOD-browser-store; MOD-bridge-client; MOD-mail-protocols
// Level: system

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import http from "node:http";
import Module from "node:module";
import net from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import tls from "node:tls";
import { clearSetting, openStore, writeSetting } from "../src/browser-store/index.mjs";
import { startPage } from "../src/site-frame/index.mjs";
import { view as settingsView } from "../src/settings-pages/index.mjs";
import { INSTANCE, PRODUCT, browser, instanceFiles, network, smallProduct } from "./main-page-home-harness.mjs";
import { fixtureStorage } from "./site-frame-start.d/dom.mjs";

export const ORIGIN = "https://alice.github.io";
export const PASSWORD = "uc-037-marker-password-433";
export const ACCOUNT = "reports@example.org";
export const MS_ADDRESS = "reports@contoso-uni.example";
export const CLIENT = "11111111-2222-3333-4444-555555555555";
export const GRAPH_TOKEN = "eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.SECRET-GRAPH-TOKEN-433";
export const SCOPES = ["Mail.ReadWrite", "Mail.Send", "offline_access"];
export const JUMP = "https://jump.example.test";
const GRAPH = "https://graph.microsoft.com/v1.0";
// The fetch the fixture page starts with (tests/site-frame-start.d/dom.mjs puts one in place that refuses every request): each dashboard is opened over it, never over the layer of a dashboard opened before.
const BASE_FETCH = globalThis.fetch;
const CRLF = "\r\n";

// ---------------------------------------------------------------- the participants' register

const ROW = (name, place) => `| ${name} | model endpoint | ${name}-model | 200000 | — | draft text | ${place} | endpoint ep1 |`;
export const ROWS = [ROW("local-llm", "this machine"), ROW("campus-llm", "FAU data centre (EU)"), ROW("cloud-llm", "a provider in the USA")];
const REGISTER = (rows) => ["# Participants of this instance", "", "**REGISTER**", "", "The participants of the test instance.", "",
  "| Name | Type | Model | Context | Price | Capabilities | Processing place | Route |", "|---|---|---|---|---|---|---|---|", ...rows, ""].join("\n");

// ---------------------------------------------------------------- the mail servers

function certPair() {
  const folder = mkdtempSync(join(tmpdir(), "agent-m-uc037-cert-"));
  const key = join(folder, "key.pem"), cert = join(folder, "cert.pem");
  execFileSync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "1", "-subj", "/CN=localhost", "-keyout", key, "-out", cert], { stdio: "ignore" });
  return { key: readFileSync(key), cert: readFileSync(cert) };
}
const TLS = certPair();
const listening = (server) => new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", () => { server.off("error", reject); resolve(); }); });
async function closing(fixture) {
  for (const socket of fixture.sockets) socket.destroy();
  await new Promise((resolve) => fixture.server.close(() => resolve()));
}
const upgrade = (socket, attach, sockets) => {
  const secured = new tls.TLSSocket(socket, { isServer: true, secureContext: tls.createSecureContext(TLS) });
  sockets.add(secured);
  secured.on("close", () => sockets.delete(secured));
  secured.on("error", () => {});
  attach(secured, true);
};
function lines(socket, handle) {
  let buffer = "";
  socket.on("data", (chunk) => {
    buffer += chunk.toString("utf8");
    for (let at = buffer.indexOf(CRLF); at >= 0; at = buffer.indexOf(CRLF)) { const line = buffer.slice(0, at); buffer = buffer.slice(at + 2); handle(line); }
  });
}

/** A mail in its raw form, as a mailbox holds it, with the Message-ID <key@mail.example.invalid>. */
export function rawMail(key, { subject = `Subject ${key}`, body = "Hello,\r\nthe export fails.\r\nKind regards" } = {}) {
  return [`Message-ID: <${key}@mail.example.invalid>`, "Date: Sun, 18 Oct 2026 08:00:00 +0000", "From: \"Erika Mustermann\" <erika@example.invalid>", `To: ${ACCOUNT}`, `Subject: ${subject}`,
    "MIME-Version: 1.0", "Content-Type: text/plain; charset=utf-8", "", body, ""].join(CRLF);
}
/** The mails the mailbox holds where a test names none: four in INBOX, two in the folder Reports into which the person files reported mails. */
export const MAILS = { INBOX: [rawMail("first"), rawMail("second"), rawMail("third"), rawMail("fourth")], Reports: [rawMail("filed", { subject: "Filed report" }), rawMail("filed-2")] };

// The envelope of a raw mail, as the IMAP server of tests/uc-039-world.mjs gives it (the Bridge finds a mail by the Message-ID of its envelope).
const nstring = (value) => (value === undefined || value === null ? "NIL" : `"${String(value).replace(/(["\\])/g, "\\$1")}"`);
const headerOf = (message, name) => new RegExp(`^${name}: (.*)$`, "im").exec(message)?.[1] ?? null;
const addressOf = (value) => {
  if (value === null) return "NIL";
  const found = /^(?:"?(.*?)"? )?<?([^@<>\s]+)@([^<>\s]+)>?$/.exec(value);
  return found ? `((${nstring(found[1])} NIL ${nstring(found[2])} ${nstring(found[3])}))` : "NIL";
};
const envelope = (message) => `ENVELOPE (${nstring(headerOf(message, "Date"))} ${nstring(headerOf(message, "Subject"))} ${addressOf(headerOf(message, "From"))} ${addressOf(headerOf(message, "From"))} ${addressOf(headerOf(message, "From"))} ${addressOf(headerOf(message, "To"))} NIL NIL NIL ${nstring(headerOf(message, "Message-ID"))})`;

/**
 * The IMAP server: `folders` maps a folder to the raw mails it holds (MAILS where none is given); Drafts and Sent are there as well, announced with their special use. `startTls: false` makes it offer no
 * encryption. Keeps `logs.commands` ({ secure, line }), `logs.logins` ({ secure, user, password }) and `folders` as it holds them ({ uid, raw }).
 */
export async function imapServer({ folders = MAILS, startTls = true } = {}) {
  const logs = { commands: [], logins: [] };
  const sockets = new Set();
  const held = {};
  for (const [name, raws] of Object.entries({ Drafts: [rawMail("draft")], Sent: [rawMail("sent-1"), rawMail("sent-2")], ...folders })) held[name] = raws.map((raw, at) => ({ uid: at + 1, raw: Buffer.from(raw) }));
  const server = net.createServer((socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
    socket.on("error", () => {});
    let active = socket, secure = false, folder = null;
    const write = (line) => active.write(line + CRLF);
    const attach = (stream, isSecure) => { active = stream; secure = isSecure; lines(stream, handle); };
    const handle = (line) => {
      logs.commands.push({ secure, line });
      const [tag, verb = "", ...rest] = line.split(" ");
      const command = verb.toUpperCase();
      const ok = (text) => write(`${tag} OK ${text}`);
      const quoted = [...line.matchAll(/"([^"]*)"/g)].map((match) => match[1]);
      if (command === "CAPABILITY") { write(`* CAPABILITY IMAP4rev1 NAMESPACE SPECIAL-USE UIDPLUS${!secure && startTls ? " STARTTLS" : " AUTH=PLAIN"}`); ok("CAPABILITY completed"); return; }
      if (command === "STARTTLS") {
        if (!startTls) { write(`${tag} BAD STARTTLS not offered`); return; }
        active.write(`${tag} OK Begin TLS negotiation${CRLF}`, () => { active.removeAllListeners("data"); upgrade(active, attach, sockets); });
        return;
      }
      if (command === "LOGIN") {
        logs.logins.push({ secure, user: quoted[0], password: quoted[1] });
        if (secure && quoted[1] === PASSWORD) ok("LOGIN completed"); else write(`${tag} NO [AUTHENTICATIONFAILED] Invalid credentials (Failure)`);
        return;
      }
      if (command === "NAMESPACE") { write('* NAMESPACE (("" "/")) NIL NIL'); ok("NAMESPACE completed"); return; }
      if (command === "LIST" || command === "LSUB") {
        write('* LIST (\\Drafts) "/" "Drafts"'); write('* LIST (\\Sent) "/" "Sent"');
        for (const name of Object.keys(held)) if (!["Drafts", "Sent"].includes(name)) write(`* LIST () "/" "${name}"`);
        ok(`${command} completed`); return;
      }
      if (command === "EXAMINE" || command === "SELECT") {
        const name = quoted.at(-1) ?? rest.join(" ");
        if (!Object.hasOwn(held, name)) { write(`${tag} NO [NONEXISTENT] Mailbox doesn't exist: ${name}`); return; }
        folder = name;
        write(`* ${held[name].length} EXISTS`); write("* OK [UIDVALIDITY 7] valid"); write(`* OK [UIDNEXT ${held[name].length + 1}] next`);
        ok(`[${command === "EXAMINE" ? "READ-ONLY" : "READ-WRITE"}] ${command} completed`); return;
      }
      if (command === "UID" && rest[0]?.toUpperCase() === "FETCH") {
        const wanted = rest[1], items = line.slice(line.indexOf("(")).toUpperCase();
        for (const message of held[folder] ?? []) {
          if (!wanted.split(",").some((part) => { const [from, to] = part.split(":"); return message.uid >= Number(from) && message.uid <= (to === undefined ? Number(from) : to === "*" ? Infinity : Number(to)); })) continue;
          const head = `* ${message.uid} FETCH (UID ${message.uid}${items.includes("ENVELOPE") ? ` ${envelope(message.raw.toString("utf8"))}` : ""}`;
          if (items.includes("BODY")) active.write(Buffer.concat([Buffer.from(`${head} BODY[] {${message.raw.length}}${CRLF}`), message.raw, Buffer.from(`)${CRLF}`)]));
          else write(`${head})`);
        }
        ok("UID FETCH completed"); return;
      }
      if (command === "LOGOUT") { write("* BYE"); ok("LOGOUT completed"); active.end(); return; }
      ok(`${command} completed`);
    };
    attach(socket, false);
    write("* OK fixture IMAP ready");
  });
  await listening(server);
  return { server, sockets, logs, folders: held, port: server.address().port };
}

/** The SMTP server: AUTH accepted only after TLS and with the marker password, unless `refuseAuth`; it accepts no mail. Keeps `logs.commands` and `logs.auths` ({ secure, user, password }). */
export async function smtpServer({ startTls = true, refuseAuth = false } = {}) {
  const logs = { commands: [], auths: [] };
  const sockets = new Set();
  const server = net.createServer((socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
    socket.on("error", () => {});
    let active = socket, secure = false;
    const write = (line) => active.write(line + CRLF);
    const attach = (stream, isSecure) => { active = stream; secure = isSecure; lines(stream, handle); };
    const handle = (line) => {
      logs.commands.push({ secure, line });
      const [word = "", method, token] = line.split(" ");
      const command = word.toUpperCase();
      if (command === "EHLO" || command === "HELO") { write("250-localhost"); if (!secure && startTls) write("250-STARTTLS"); write("250 AUTH PLAIN LOGIN"); return; }
      if (command === "STARTTLS") {
        if (!startTls) { write("454 TLS not available"); return; }
        active.write(`220 Ready to start TLS${CRLF}`, () => { active.removeAllListeners("data"); upgrade(active, attach, sockets); });
        return;
      }
      if (command === "AUTH") {
        const parts = Buffer.from(String(method).toUpperCase() === "PLAIN" ? token ?? "" : "", "base64").toString("utf8").split("\0");
        logs.auths.push({ secure, user: parts.at(-2) ?? "", password: parts.at(-1) ?? "" });
        write(!refuseAuth && secure && parts.at(-1) === PASSWORD ? "235 2.7.0 Authentication successful" : "535 5.7.8 Authentication credentials invalid");
        return;
      }
      if (command === "MAIL" || command === "RCPT" || command === "DATA") { write("503 this fixture accepts no mail"); return; }
      if (command === "QUIT") { write("221 bye"); active.end(); return; }
      write("250 OK");
    };
    attach(socket, false);
    write("220 fixture SMTP ready");
  });
  await listening(server);
  return { server, sockets, logs, port: server.address().port };
}

// ---------------------------------------------------------------- the Bridge as compose builds it

const SSH2_FIXTURE = join(tmpdir(), "agent-m-433-ssh2-fixture");
function fakeSsh2Module() {
  const folder = join(SSH2_FIXTURE, "node_modules", "ssh2");
  mkdirSync(folder, { recursive: true });
  writeFileSync(join(folder, "package.json"), JSON.stringify({ name: "ssh2", version: "1.17.0", main: "index.js" }));
  writeFileSync(join(folder, "index.js"), `
    const publicKey = "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIFVDLTAzNy1jb25uZWN0LWEtbWFpbGJveC00MzM";
    const publicBuffer = Buffer.from(publicKey);
    exports.Client = class { on() { return this; } once() { return this; } connect() {} end() {} };
    exports.utils = {
      generateKeyPairSync() { return { private: "fixture-private-key", public: publicKey }; },
      parseKey() { return { type: "ssh-ed25519", getPublicSSH() { return publicBuffer; } }; }
    };
  `);
  assert.ok(existsSync(join(folder, "index.js")));
  return join(SSH2_FIXTURE, "node_modules");
}
let composeModule;

/** The Bridge MOD-desktop-shell's compose starts, on 127.0.0.1, for the instance alice/agent-m and its origin. Keeps its console lines; `close()` stops it and removes its data folder. */
export async function composedBridge() {
  process.env.NODE_PATH = fakeSsh2Module();
  Module._initPaths();
  composeModule ??= await import("../src/desktop-shell/compose.mjs");
  const root = mkdtempSync(join(tmpdir(), "agent-m-433-bridge-"));
  const logged = [];
  const prior = { info: console.info, log: console.log, warn: console.warn, error: console.error };
  for (const name of Object.keys(prior)) console[name] = (...parts) => logged.push(parts.map(String).join(" "));
  const paused = { value: false };
  const bridge = await composeModule.compose({ instance: INSTANCE, origin: ORIGIN, dataFolder: join(root, "data"), port: 0, paused: () => paused.value });
  return { address: bridge.address, token: bridge.token, dataFolder: join(root, "data"), logged, paused,
    async close() { Object.assign(console, prior); await bridge.close().catch(() => {}); rmSync(root, { recursive: true, force: true }); } };
}

/** Every file below a folder. */
export function filesUnder(folder) {
  if (!existsSync(folder)) return [];
  return readdirSync(folder, { withFileTypes: true }).flatMap((entry) => (entry.isDirectory() ? filesUnder(join(folder, entry.name)) : [join(folder, entry.name)]));
}

// A browser's request to a Bridge on the loopback, made over node:http: the address, method, headers and body the page gives, and the Origin header the browser sets. A refused connection is the
// TypeError a browser's fetch rejects with.
function overHttp(address, init, origin) {
  const target = new URL(address);
  const headers = { ...(init.headers ?? {}), Origin: origin, connection: "close" };
  return new Promise((resolve, reject) => {
    const request = http.request({ host: target.hostname, port: target.port, path: `${target.pathname}${target.search}`, method: init.method ?? "GET", headers, agent: false }, (response) => {
      const chunks = [];
      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () => {
        const answer = {};
        for (const [name, value] of Object.entries(response.headers)) if (typeof value === "string") answer[name] = value;
        resolve(new Response(response.statusCode === 204 ? null : Buffer.concat(chunks), { status: response.statusCode, headers: answer }));
      });
    });
    request.on("error", (error) => reject(new TypeError(`fetch failed: ${error.message}`)));
    request.end(init.body ?? undefined);
  });
}

// ---------------------------------------------------------------- Microsoft

/** Microsoft Graph's fixture: `folders` maps inbox, drafts, sentitems and display names to their counts; every request is kept in `requests`. */
function graphFixture(folders) {
  const graph = { requests: [] };
  const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  graph.fetch = async (address, init = {}) => {
    const url = new URL(address);
    const path = decodeURIComponent(url.pathname).replace("/v1.0", "");
    graph.requests.push({ address: url.href, method: String(init.method ?? "GET").toUpperCase(), headers: { ...(init.headers ?? {}) } });
    if (!/^Bearer /.test(init.headers?.Authorization ?? "")) return json({ error: { code: "InvalidAuthenticationToken" } }, 401);
    if (path === "/me/mailFolders") {
      const wanted = /displayName eq '(.*)'/.exec(url.searchParams.get("$filter") ?? "")?.[1];
      return json({ value: wanted !== undefined && Object.hasOwn(folders, wanted) ? [{ id: `id-${wanted}`, totalItemCount: folders[wanted] }] : [] });
    }
    const one = /^\/me\/mailFolders\/([^/]+)$/.exec(path);
    if (one && Object.hasOwn(folders, one[1])) return json({ id: one[1], totalItemCount: folders[one[1]] });
    return json({ error: { code: "ErrorItemNotFound" } }, 404);
  };
  return graph;
}

const libraryError = (name, errorCode, errorMessage) => Object.assign(new Error(`${errorCode}: ${errorMessage}`), { name, errorCode, errorMessage, subError: "" });
export const SIGN_IN = {
  ok: () => null,
  declined: (permission) => () => libraryError("ServerError", "access_denied", `AADSTS65004: User declined to consent to access the app. The permission ${permission} was not granted.`),
  registrationRefused: () => libraryError("ServerError", "invalid_client", "AADSTS700016: Application with identifier '11111111-2222-3333-4444-555555555555' was not found in the directory 'contoso-uni.example'."),
};

export const REFRESH_TOKEN = "M.C537_BAY.0.U.-SECRET-REFRESH-TOKEN-433";
// The keys the sign-in library writes in localStorage for its token cache, as src/browser-store/sign-in.mjs reads the vendored library's names: the token list of the client, an access and a
// refresh token entry carrying the person's home account and the token as its secret, the account entry, and the shared list of account entries.
function cacheKeys(storage, clientId, username, scopes) {
  const home = "x.y", account = `${home}-login.windows.net-t`;
  const access = `${home}-login.windows.net-accesstoken-${clientId}-t-${scopes.join(" ").toLowerCase()}`, refresh = `${home}-login.windows.net-refreshtoken-${clientId}--`;
  storage.setItem(`msal.3.token.keys.${clientId}`, JSON.stringify({ idToken: [], accessToken: [access], refreshToken: [refresh] }));
  storage.setItem(access, JSON.stringify({ homeAccountId: home, credentialType: "AccessToken", clientId, secret: GRAPH_TOKEN, target: scopes.join(" ") }));
  storage.setItem(refresh, JSON.stringify({ homeAccountId: home, credentialType: "RefreshToken", clientId, secret: REFRESH_TOKEN }));
  storage.setItem(account, JSON.stringify({ homeAccountId: home, username, environment: "login.windows.net", realm: "t" }));
  storage.setItem("msal.3.account.keys", JSON.stringify([account]));
  storage.setItem(`msal.${clientId}.active-account`, JSON.stringify({ homeAccountId: home }));
}
// The accounts and the access token the cache of this browser holds for a client: what the library finds in localStorage.
function cached(storage, clientId) {
  const lists = JSON.parse(storage.getItem(`msal.3.token.keys.${clientId}`) ?? "null");
  const access = lists?.accessToken?.map((name) => JSON.parse(storage.getItem(name) ?? "null")).find(Boolean) ?? null;
  const accounts = (JSON.parse(storage.getItem("msal.3.account.keys") ?? "[]")).map((name) => JSON.parse(storage.getItem(name) ?? "null")).filter((entry) => entry && entry.homeAccountId === access?.homeAccountId);
  return { access, accounts: accounts.map((entry) => ({ username: entry.username, homeAccountId: entry.homeAccountId, tenantId: "t" })) };
}

/**
 * The sign-in library's stand-in of one browser, at globalThis.msal. `login`: what Microsoft's window ends with — SIGN_IN.ok(), or a function giving the library's error; `granted`: the scopes a
 * signed-in token holds; `expired`: whether the sign-in kept in this browser has run out. A sign-in writes the library's cache keys into this browser's localStorage, and the accounts and the token
 * are read from there. Keeps `logins` (what loginPopup was asked), `pageAtLogin` (the page's text when Microsoft's window opened) and `silent` (the scopes acquireTokenSilent was asked for).
 */
function signInStandIn(page, { login = SIGN_IN.ok(), granted = SCOPES, expired = false } = {}) {
  const seen = { logins: [], pageAtLogin: [], silent: [], configs: [] };
  const state = { expired, login, granted };
  globalThis.msal = {
    createStandardPublicClientApplication: async (config) => {
      seen.configs.push(structuredClone(config));
      const clientId = config.auth.clientId;
      return {
        loginPopup: async (request) => {
          seen.logins.push(structuredClone(request));
          seen.pageAtLogin.push(page());
          const failed = state.login?.();
          if (failed) throw failed;
          const username = request.loginHint ?? MS_ADDRESS;
          cacheKeys(globalThis.localStorage, clientId, username, state.granted);
          state.expired = false;
          return { account: { username, homeAccountId: "x.y", tenantId: "t" }, accessToken: GRAPH_TOKEN, scopes: [...state.granted] };
        },
        getAllAccounts: () => cached(globalThis.localStorage, clientId).accounts,
        acquireTokenSilent: async (request) => {
          seen.silent.push([...request.scopes]);
          const { access } = cached(globalThis.localStorage, clientId);
          if (state.expired || !access) throw libraryError("InteractionRequiredAuthError", "interaction_required", "AADSTS700084: The refresh token was issued to a single page app and has expired.");
          return { accessToken: access.secret, scopes: [...state.granted] };
        },
      };
    },
  };
  return { seen, state };
}

// ---------------------------------------------------------------- the dashboard

const text = (node) => String(node?.textContent ?? "").replace(/\s+/g, " ");
const flush = async () => { for (let n = 0; n < 40; n += 1) await new Promise((resolve) => setImmediate(resolve)); };
const realTimeout = globalThis.setTimeout;
export const waitFor = async (condition, what = "the condition") => {
  for (let n = 0; n < 600 && !condition(); n += 1) await new Promise((resolve) => realTimeout(resolve, 10));
  await flush();
  assert.ok(condition(), `waited for ${what}`);
};

/**
 * Opens the dashboard of the instance alice/agent-m in a browser of its own at `fragment` (Settings, where none is given). Precondition the test names:
 *   - `bridges`: the Bridges this browser keeps — `lab-pc` on this computer's loopback (the composed Bridge, with its pairing token), `gpu-box` through the jump host at port 40100 of its range
 *     (the jump host stored with its HTTPS address and web-server login), `wrong-token` (the composed Bridge with a token it never issued), `gone` (an address where nothing listens);
 *   - `imap`, `smtp`: the options of the mail servers; `graphFolders`: the folders Microsoft Graph holds; `signIn`: the stand-in's options; `rows`: the participants' register;
 *   - `storage`: a localStorage to start with (a browser that has been used before); `bridge`: a composed Bridge to share with an earlier browser; `views`: the views the main page serves
 *     (the settings pages' where none are given).
 * Returns the page's main element and what the fixtures kept; `stop()` closes what it started and must be called in a `finally`.
 */
export async function openDashboard({ fragment = "#settings", bridges = ["lab-pc", "gpu-box"], imap = {}, smtp = {}, graphFolders = { inbox: 7, Receipts: 2, drafts: 0, sentitems: 5 }, signIn = {}, rows = ROWS, storage = null, bridge = null, views = [settingsView] } = {}) {
  Object.defineProperty(globalThis, "fetch", { configurable: true, writable: true, value: BASE_FETCH });
  const files = { ...instanceFiles(), "docs/participants.md": REGISTER(rows) };
  const repositories = network({ [INSTANCE]: files, [PRODUCT]: smallProduct() });
  repositories.install();
  const context = browser();
  // The small DOM of the harness keeps an element's children in `children` and lacks `childNodes`, which a browser's element has and the page reads of a select's options: it is given here.
  const prototype = Object.getPrototypeOf(document.createElement("div"));
  if (!Object.getOwnPropertyDescriptor(prototype, "childNodes")) Object.defineProperty(prototype, "childNodes", { configurable: true, get() { return this.children; } });
  prototype.hasAttribute ??= function hasAttribute(name) { return this.getAttribute(name) !== null && this.getAttribute(name) !== undefined; };
  if (storage) Object.defineProperty(globalThis, "localStorage", { configurable: true, value: storage });
  const store = openStore(INSTANCE);
  for (const name of ["bridge:lab-pc-4", "bridge:lab-pc-5"]) clearSetting(store, name);
  const servers = { imap: await imapServer(imap), smtp: await smtpServer(smtp) };
  const ownBridge = !bridge;
  const composed = bridge ?? await composedBridge();
  if (!storage) {
    if (bridges.includes("lab-pc")) writeSetting(store, "bridge:lab-pc", { address: composed.address, token: composed.token });
    if (bridges.includes("gpu-box")) {
      writeSetting(store, "bridge:gpu-box", { port: 40100, token: composed.token });
      writeSetting(store, "jump-host", { hostname: "jump.example.test", user: "agentm", sshPort: 22, portRange: [40100, 40102], httpsAddress: JUMP, login: { user: "proxy-user", password: "web-login-433" } });
    }
    if (bridges.includes("wrong-token")) writeSetting(store, "bridge:wrong-token", { address: composed.address, token: "a-token-the-bridge-never-issued" });
    if (bridges.includes("gone")) {
      const free = net.createServer();
      await listening(free);
      const port = free.address().port;
      await new Promise((resolve) => free.close(resolve));
      writeSetting(store, "bridge:gone", { address: `http://127.0.0.1:${port}`, token: "gone-token" });
    }
  }
  const graph = graphFixture(graphFolders);
  const requests = [];
  const writes = [];
  const lookups = [];
  let inner = globalThis.fetch;
  const main = () => document.body.getElementsByTagName("main")[0];
  const signInState = signInStandIn(() => text(main()), signIn);
  const layer = async (input, init = {}) => {
    const address = String(typeof input === "object" && !(input instanceof URL) ? input.url : input);
    const url = new URL(address);
    requests.push({ address: url.href, origin: url.origin, method: String(init.method ?? "GET").toUpperCase(), headers: { ...(init.headers ?? {}) }, body: init.body === undefined ? null : String(init.body) });
    if (url.origin === composed.address) return overHttp(url.href, init, ORIGIN);
    if (url.origin === JUMP && url.pathname.startsWith("/bridge/gpu-box/")) return overHttp(`${composed.address}${url.pathname.slice("/bridge/gpu-box".length)}${url.search}`, init, ORIGIN);
    if (url.origin === "https://login.microsoftonline.com") {
      const domain = url.pathname.split("/")[1];
      lookups.push(domain);
      return new Response("{}", { status: domain === "contoso-uni.example" ? 200 : 400 });
    }
    if (url.href.startsWith(`${GRAPH}/`)) return graph.fetch(url.href, init);
    if (/^http:\/\/127\.0\.0\.1:\d+$/.test(url.origin)) return overHttp(url.href, init, ORIGIN);
    return inner(input, init);
  };
  // The harness assigns its fetch again when a repository changes: what it assigns is the layer's inner fetch from then on, so that every request still passes the layer.
  Object.defineProperty(globalThis, "fetch", { configurable: true, get: () => layer, set: (value) => { inner = value; } });
  Object.defineProperty(document, "cookie", { configurable: true, get: () => "", set: (value) => writes.push(`cookie=${value}`) });
  const clipboard = [];
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: { clipboard: { writeText: async (value) => { clipboard.push(value); } }, userAgent: "fixture" } });
  const confirms = [];
  globalThis.confirm = (question) => { confirms.push(question); return true; };
  const realSetInterval = globalThis.setInterval;
  globalThis.setInterval = () => 1;
  globalThis.location.hash = fragment;
  await startPage({ page: "main", views });
  await waitFor(() => main() !== undefined && main().children.length > 0, "the page");
  const stop = async () => {
    Object.defineProperty(globalThis, "fetch", { configurable: true, writable: true, value: inner });
    globalThis.setInterval = realSetInterval;
    delete globalThis.msal;
    delete globalThis.confirm;
    repositories.restore();
    await Promise.all([closing(servers.imap), closing(servers.smtp)]);
    if (ownBridge) await composed.close();
    document.body.replaceChildren();
  };
  return { main, store, context, requests, writes, lookups, clipboard, confirms, graph, signIn: signInState, ...servers, bridge: composed, stop, storage: globalThis.localStorage };
}

// ---------------------------------------------------------------- what a person does, and what a test reads

function descendants(root, predicate) {
  const found = [];
  (function visit(node) { for (const child of node?.childNodes ?? node?.children ?? []) { if (child && child.nodeType !== 3 && typeof child !== "string") { if (predicate(child)) found.push(child); visit(child); } } })(root);
  return found;
}
export const byClass = (root, name) => descendants(root, (node) => String(node.className ?? "").split(/\s+/).includes(name));
export const one = (root, name) => { const found = byClass(root, name); assert.equal(found.length, 1, `exactly one .${name}`); return found[0]; };
export const textOf = text;
/**
 * The text of a folded explanation: its summary and its body. The small DOM of the harness has no HTML sanitiser, so MOD-markdown-render shows the topic's Markdown as escaped source in the
 * `innerHTML` of an element: that source is read, its markup and entities undone.
 */
export function explanationText(node) {
  const html = descendants(node, () => true).map((each) => each.innerHTML ?? "").join(" ");
  const source = html.replace(/<[^>]*>/g, " ").replace(/&#39;/g, "'").replace(/&quot;/g, "\"").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
  return `${text(node)} ${source}`.replace(/\s+/g, " ");
}
export { flush, fixtureStorage };
export const press = async (node) => { const event = new Event("click"); Object.defineProperty(event, "isTrusted", { value: true }); node.dispatchEvent(event); await flush(); };
export const put = async (node, value) => { node.value = value; node.dispatchEvent(new Event("change")); node.dispatchEvent(new Event("input")); await flush(); };
export const tick = async (node, checked = true) => { node.checked = checked; node.dispatchEvent(new Event("change")); await flush(); };
export const hashTo = async (fragment) => { globalThis.location.hash = fragment; globalThis.window.dispatchEvent(new Event("hashchange")); await flush(); };
/** The connection this browser stores, as its localStorage holds it under the instance's key: the parsed value, or null. */
export const storedMailbox = (p) => { const raw = p.storage.getItem(`agent-m:${INSTANCE}:mailbox`); return raw === null ? null : JSON.parse(raw); };
/** Every key and value of this browser's localStorage, as text. */
export const storageText = (p) => { const all = []; for (let n = 0; n < p.storage.length; n += 1) { const key = p.storage.key(n); all.push(`${key}=${p.storage.getItem(key)}`); } return all.join("\n"); };
/** Settings → Mailbox: the settings page's Connect a mailbox (or Change), and the page of the route `mailbox` it opens. */
export async function connectAMailbox(p) {
  await waitFor(() => byClass(p.main(), "mailbox-setting-open").length === 1, "the mailbox's line on the Settings page");
  const button = one(p.main(), "mailbox-setting-open");
  await press(button);
  if (globalThis.location.hash.includes("mailbox")) globalThis.window.dispatchEvent(new Event("hashchange"));
  await waitFor(() => byClass(p.main(), "mailbox-store-test").length === 1, "the page Connect a mailbox");
  await flush();
  return p.main();
}
/** The person fills in an IMAP connection: the address, the servers with their ports and encryption, the notice ticked and the password, the Bridge, the folders and the places. */
export async function fillImap(p, { address = ACCOUNT, imapHost = "127.0.0.1", smtpHost = "127.0.0.1", imapSecurity = "starttls", smtpSecurity = "starttls", tickNotice = true, password = PASSWORD, bridge = null, folders = "INBOX, Reports", places = ["this machine"] } = {}) {
  const page = p.main();
  await put(one(page, "mailbox-address"), address);
  await put(one(page, "mailbox-imap-host"), imapHost);
  await put(one(page, "mailbox-imap-port"), String(p.imap.port));
  await put(one(page, "mailbox-imap-security"), imapSecurity);
  await put(one(page, "mailbox-smtp-host"), smtpHost);
  await put(one(page, "mailbox-smtp-port"), String(p.smtp.port));
  await put(one(page, "mailbox-smtp-security"), smtpSecurity);
  if (tickNotice) await tick(one(page, "mailbox-password-notice-read"));
  if (!one(page, "mailbox-password").disabled) await put(one(page, "mailbox-password"), password);
  if (bridge !== null) await put(one(page, "mailbox-bridge"), bridge);
  await put(one(page, "mailbox-folders"), folders);
  for (const box of byClass(page, "mailbox-place")) await tick(box, places.includes(box.getAttribute("data-place")));
}
/** Store and test, one click, and the page's answer. */
export async function storeAndTest(p) {
  // The click's handler writes its first answer before it awaits anything: a refusal, or "Testing …" until the test's answer replaces it.
  await press(one(p.main(), "mailbox-store-test"));
  await waitFor(() => !/Testing/.test(textOf(one(p.main(), "mailbox-result"))), "the answer of Store and test");
  return textOf(one(p.main(), "mailbox-result"));
}
/** The Microsoft route as a person takes it: the address, the client identifier, Sign in with Microsoft, and the page's answer to the sign-in. */
export async function signInWithMicrosoft(p, { address = MS_ADDRESS, clientId = CLIENT } = {}) {
  await put(one(p.main(), "mailbox-address"), address);
  await put(one(p.main(), "mailbox-client-id"), clientId);
  await press(one(p.main(), "mailbox-sign-in"));
  await waitFor(() => !/Opening/.test(textOf(one(p.main(), "mailbox-sign-in-result"))), "the answer of the sign-in");
  return textOf(one(p.main(), "mailbox-sign-in-result"));
}
/** Import settings on the Settings page: the file `text` chosen in its file field, and the page's answer. */
export async function importSettingsFile(p, text) {
  const field = one(p.main(), "settings-import-file");
  field.files = [{ name: "agent-m-settings.json", text: async () => text }];
  field.dispatchEvent(new Event("change"));
  await waitFor(() => textOf(one(p.main(), "settings-import-result")) !== "", "the answer of the import");
  return textOf(one(p.main(), "settings-import-result"));
}
