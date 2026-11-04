// The world of the system and release tests of UC-039 "Reply to the mails of an issue" (tests/system-uc-039-reply-to-the-mails-of-an-issue.test.mjs, tests/release-uc-039-reply-to-the-mails-of-an-issue.test.mjs) — a helper, no test of its own, and it holds no
// expected result. The page is started by MOD-site-frame's startPage on the main page over the view of MOD-maintenance-pages, at the fragment of the route `replies`, in the browser, the repositories and the clock of
// tests/maintenance-pages-world.mjs (the issues of alice/product, the participants' register, the model endpoints ep1 and ep2). Over that world this file puts the two mailbox routes of UC-039:
//   - the Bridge route: the Bridge lab-pc-4 on the loopback answers every /v1/mail/<operation> with the real mailHandlers of MOD-mail-protocols, which talk over STARTTLS to a local IMAP server and a local SMTP server
//     of this file (copies of the servers of tests/mail-protocols-send.test.mjs, with APPEND, STORE and EXPUNGE; the SMTP server keeps each mail it is given and relays nothing; `refuseMail` makes it answer a finished
//     DATA with 554); /v1/ask answers a CLI agent the participant names;
//   - the Microsoft route: a fixture server of Microsoft Graph, replacing graph.microsoft.com (the folders inbox, drafts and sentitems and any folder by its display name; a message's raw form; a draft created from its
//     raw form; the provider's send, which moves the draft to the sent items), with the stand-in of the sign-in library's client (globalThis.msal) as tests/mail-routes-graph-draft.test.mjs has it.
// Nothing reaches the network; every request the mailbox servers and the fixtures received is kept.
//
// Module: MOD-maintenance-pages; MOD-mail-handling
// Level: system

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import net from "node:net";
import tls from "node:tls";
import { writeSetting } from "../src/browser-store/index.mjs";
import { startPage } from "../src/site-frame/index.mjs";
import { BRIDGE, ERIKA, PRODUCT_URL, buttonsOf, byClass, flush, mailOf, one, pages, standard, trusted, waitFor, world } from "./maintenance-pages-world.mjs";
import { fragmentOf } from "../src/site-frame/routing.mjs";

export const PASSWORD = "uc-039-marker-password-969";
export const ACCOUNT = "reports@example.org";
const CRLF = "\r\n";
const UID_VALIDITY = 7;
const GRAPH = "https://graph.microsoft.com/v1.0";
const GRAPH_TOKEN = "eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.SECRET-GRAPH-TOKEN-969";

/** A mail in its raw form, as a mailbox holds it. Its Message-ID is the one tests/maintenance-pages-world.mjs' mailOf(key) names, so that the identifier is the same. */
export function rawMail(key, { from = `"${ERIKA.name}" <${ERIKA.address}>`, replyTo = null, subject = `Subject ${key}`, inReplyTo = null, references = null, date = "Sun, 18 Oct 2026 08:00:00 +0000", body = "Hello,\r\nthe export fails.\r\nKind regards", to = ACCOUNT } = {}) {
  return [`Message-ID: <${key}@mail.example.invalid>`, `Date: ${date}`, `From: ${from}`, ...(replyTo ? [`Reply-To: ${replyTo}`] : []), `To: ${to}`, `Subject: ${subject}`,
    ...(inReplyTo ? [`In-Reply-To: ${inReplyTo}`] : []), ...(references ? [`References: ${references}`] : []), "MIME-Version: 1.0", "Content-Type: text/plain; charset=utf-8", "", body, ""].join(CRLF);
}

/** A draft of Agent M's in the raw form of a mailbox's Drafts: one To, In-Reply-To and References from the reporter's mail, the mark Agent M sets on the drafts it stores. */
export function rawDraft(key, { to = `"${ERIKA.name}" <${ERIKA.address}>`, subject = `Re: Subject ${key}`, body = "We fixed it in version 1.5." } = {}) {
  return [`Message-ID: <draft-${key}@example.org>`, "Date: Mon, 19 Oct 2026 08:00:00 +0000", `From: ${ACCOUNT}`, `To: ${to}`, `Subject: ${subject}`, `In-Reply-To: <${key}@mail.example.invalid>`, `References: <${key}@mail.example.invalid>`,
    "X-Agent-M-Draft: 1", "MIME-Version: 1.0", "Content-Type: text/plain; charset=utf-8", "", body, ""].join(CRLF);
}

function certPair() {
  const folder = mkdtempSync(join(tmpdir(), "agent-m-uc039-cert-"));
  const key = join(folder, "key.pem"), cert = join(folder, "cert.pem");
  execFileSync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "1", "-subj", "/CN=localhost", "-keyout", key, "-out", cert], { stdio: "ignore" });
  return { key: readFileSync(key), cert: readFileSync(cert) };
}
const TLS = certPair();
const listening = (server) => new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
const closed = (server) => new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
const upgrade = (socket, attach) => {
  const secured = new tls.TLSSocket(socket, { isServer: true, secureContext: tls.createSecureContext(TLS) });
  secured.on("error", () => {});
  attach(secured, true);
};

// The envelope of a raw mail, as the IMAP server of tests/mail-protocols-read.test.mjs gives it (the Bridge finds a mail by the Message-ID of its envelope).
const nstring = (value) => (value === undefined || value === null ? "NIL" : `"${String(value).replace(/(["\\])/g, "\\$1")}"`);
const headerOf_ = (message, name) => new RegExp(`^${name}: (.*)$`, "im").exec(message)?.[1] ?? null;
const addressOf = (value) => {
  if (value === null) return "NIL";
  const found = /^(?:"?(.*?)"? )?<?([^@<>\s]+)@([^<>\s]+)>?$/.exec(value);
  return found ? `((${nstring(found[1])} NIL ${nstring(found[2])} ${nstring(found[3])}))` : "NIL";
};
const envelope = (message) => `ENVELOPE (${nstring(headerOf_(message, "Date"))} ${nstring(headerOf_(message, "Subject"))} ${addressOf(headerOf_(message, "From"))} ${addressOf(headerOf_(message, "From"))} ${addressOf(headerOf_(message, "Reply-To") ?? headerOf_(message, "From"))} ${addressOf(headerOf_(message, "To"))} ${addressOf(headerOf_(message, "Cc"))} NIL ${nstring(headerOf_(message, "In-Reply-To"))} ${nstring(headerOf_(message, "Message-ID"))})`;

// The IMAP server. `folders` maps a folder to its messages as raw texts; the folders Drafts and Sent are there as well, announced with their special use. The server keeps what a test needs to look at: `folders`
// ({ uid, raw, deleted }), every command with whether the connection was encrypted, every login.
async function imapServer(seed) {
  const logs = { commands: [], logins: [] };
  const folders = { INBOX: [], Drafts: [], Sent: [] };
  const nextUid = {};
  for (const [name, raws] of Object.entries({ ...folders, ...seed })) {
    folders[name] = raws.map((raw, at) => ({ uid: at + 1, raw: Buffer.from(raw) }));
    nextUid[name] = raws.length + 1;
  }
  const server = net.createServer((socket) => {
    let active = socket, secure = false, pending = Buffer.alloc(0), literal = null, tail = null, folder = null;
    const write = (data) => active.write(Buffer.concat([Buffer.from(data), Buffer.from(CRLF)]));
    const attach = (stream, isSecure) => {
      active = stream; secure = isSecure;
      stream.on("error", () => {});
      stream.on("data", (chunk) => { pending = Buffer.concat([pending, chunk]); drain(); });
    };
    const drain = () => {
      for (;;) {
        if (literal) {
          if (pending.length < literal.size) return;
          tail = { ...literal, bytes: Buffer.from(pending.subarray(0, literal.size)) };
          pending = pending.subarray(literal.size); literal = null; continue;
        }
        const at = pending.indexOf(CRLF);
        if (at < 0) return;
        const line = pending.subarray(0, at).toString("utf8");
        pending = pending.subarray(at + 2);
        if (tail) {
          const done = tail; tail = null;
          const uid = nextUid[done.folder]++;
          folders[done.folder].push({ uid, raw: done.bytes });
          write(`${done.tag} OK [APPENDUID ${UID_VALIDITY} ${uid}] APPEND completed`);
          continue;
        }
        handle(line);
      }
    };
    const handle = (line) => {
      logs.commands.push({ secure, line });
      const [tag, verb, ...rest] = line.split(" ");
      const command = verb.toUpperCase();
      const ok = (text) => write(`${tag} OK ${text}`);
      const quoted = [...line.matchAll(/"([^"]*)"/g)].map((match) => match[1]);
      if (command === "CAPABILITY") { write(`* CAPABILITY IMAP4rev1 NAMESPACE SPECIAL-USE UIDPLUS${secure ? " AUTH=PLAIN" : " STARTTLS"}`); ok("done"); return; }
      if (command === "STARTTLS") { active.write(`${tag} OK Begin TLS negotiation${CRLF}`, () => { active.removeAllListeners("data"); upgrade(active, attach); }); return; }
      if (command === "LOGIN") {
        logs.logins.push({ secure, user: quoted[0], password: quoted[1] });
        secure && quoted[1] === PASSWORD ? ok("LOGIN completed") : write(`${tag} NO AUTHENTICATIONFAILED Invalid credentials`);
        return;
      }
      if (command === "NAMESPACE") { write('* NAMESPACE (("" "/")) NIL NIL'); ok("NAMESPACE completed"); return; }
      if (command === "LIST") {
        write('* LIST (\\Drafts) "/" "Drafts"'); write('* LIST (\\Sent) "/" "Sent"');
        for (const name of Object.keys(folders)) if (!["Drafts", "Sent"].includes(name)) write(`* LIST () "/" "${name}"`);
        ok("LIST completed"); return;
      }
      if (command === "EXAMINE" || command === "SELECT") {
        const name = quoted.at(-1) ?? rest.join(" ");
        if (!Object.hasOwn(folders, name)) { write(`${tag} NO [NONEXISTENT] Mailbox doesn't exist: ${name}`); return; }
        folder = name;
        write(`* ${folders[name].length} EXISTS`); write(`* OK [UIDVALIDITY ${UID_VALIDITY}] valid`); write(`* OK [UIDNEXT ${nextUid[name]}] next`);
        ok(`[${command === "EXAMINE" ? "READ-ONLY" : "READ-WRITE"}] ${command} completed`); return;
      }
      if (command === "APPEND") {
        const size = /\{(\d+)\+?\}$/.exec(line);
        literal = { tag, folder: rest[0].replace(/^"|"$/g, ""), size: Number(size[1]) };
        if (!line.endsWith("+}")) write("+ Ready for literal data");
        return;
      }
      if (command === "UID" && rest[0].toUpperCase() === "FETCH") {
        const wanted = rest[1], items = line.slice(line.indexOf("(")).toUpperCase();
        for (const message of folders[folder]) {
          if (!wanted.split(",").some((part) => { const [from, to] = part.split(":"); return message.uid >= Number(from) && message.uid <= (to === undefined ? Number(from) : to === "*" ? Infinity : Number(to)); })) continue;
          const text = message.raw.toString("utf8");
          const head = `* ${message.uid} FETCH (UID ${message.uid}${items.includes("ENVELOPE") ? ` ${envelope(text)}` : ""}`;
          if (items.includes("BODY")) active.write(Buffer.concat([Buffer.from(`${head} BODY[] {${message.raw.length}}${CRLF}`), message.raw, Buffer.from(`)${CRLF}`)]));
          else write(`${head})`);
        }
        ok("UID FETCH completed"); return;
      }
      if (command === "UID" && rest[0].toUpperCase() === "STORE") {
        for (const message of folders[folder]) if (message.uid === Number(rest[1])) message.deleted = /\\Deleted/i.test(line);
        ok("UID STORE completed"); return;
      }
      if (command === "EXPUNGE" || (command === "UID" && rest[0].toUpperCase() === "EXPUNGE")) {
        folders[folder] = folders[folder].filter((message) => !message.deleted);
        ok("EXPUNGE completed"); return;
      }
      if (command === "LOGOUT") { write("* BYE"); ok("LOGOUT completed"); active.end(); return; }
      ok(`${command} completed`);
    };
    attach(socket, false);
    write("* OK fixture IMAP ready");
  });
  await listening(server);
  return { server, logs, get folders() { return folders; }, port: server.address().port };
}

// The SMTP server: it accepts the marker password only after TLS and keeps each mail it is given; `refuseMail` answers a finished DATA with 554.
async function smtpServer({ refuseMail = false } = {}) {
  const logs = { commands: [], auths: [] };
  const messages = [];
  const server = net.createServer((socket) => {
    let active = socket, secure = false, buffer = "", inData = false, data = [], from = null, to = [];
    const write = (text) => active.write(text + CRLF);
    const attach = (stream, isSecure) => {
      active = stream; secure = isSecure;
      stream.on("error", () => {});
      stream.on("data", (chunk) => {
        buffer += chunk.toString("utf8");
        for (let at = buffer.indexOf(CRLF); at >= 0; at = buffer.indexOf(CRLF)) { const line = buffer.slice(0, at); buffer = buffer.slice(at + 2); handle(line); }
      });
    };
    const handle = (line) => {
      if (inData) {
        if (line !== ".") { data.push(line.startsWith("..") ? line.slice(1) : line); return; }
        inData = false;
        if (refuseMail) { write("554 5.3.0 fixture refuses this mail"); return; }
        messages.push({ secure, from, to, bytes: Buffer.from(data.join(CRLF) + CRLF) });
        write("250 2.0.0 queued"); return;
      }
      logs.commands.push({ secure, line });
      const [word, ...rest] = line.split(" ");
      const command = word.toUpperCase();
      if (command === "EHLO" || command === "HELO") { write("250-localhost"); if (!secure) write("250-STARTTLS"); write("250 AUTH PLAIN LOGIN"); return; }
      if (command === "STARTTLS") { active.write(`220 Ready to start TLS${CRLF}`, () => { active.removeAllListeners("data"); upgrade(active, attach); }); return; }
      if (command === "AUTH") {
        const [, user, password] = Buffer.from(rest[1] ?? "", "base64").toString("utf8").split("\0");
        logs.auths.push({ secure, user, password });
        write(secure && password === PASSWORD ? "235 2.7.0 Authentication successful" : "535 5.7.8 Authentication credentials invalid"); return;
      }
      if (command === "MAIL") { from = /<([^>]*)>/.exec(line)[1]; to = []; write("250 OK"); return; }
      if (command === "RCPT") { to.push(/<([^>]*)>/.exec(line)[1]); write("250 OK"); return; }
      if (command === "DATA") { inData = true; data = []; write("354 End data with <CR><LF>.<CR><LF>"); return; }
      if (command === "QUIT") { write("221 bye"); active.end(); return; }
      write("250 OK");
    };
    attach(socket, false);
    write("220 fixture SMTP ready");
  });
  await listening(server);
  return { server, logs, messages, port: server.address().port };
}

// The Microsoft Graph of the fixture: `folders` maps inbox, drafts, sentitems and any other display name to its messages ({ id, raw }); every request is kept. `refuseSend` answers the provider's send with 403.
function graphFixture(seed, { refuseSend = false } = {}) {
  const folders = { inbox: [], drafts: [], sentitems: [] };
  let count = 0;
  for (const [name, raws] of Object.entries(seed)) folders[name] = raws.map((raw) => ({ id: `AAMk-${name}-${count += 1}=`, raw }));
  const graph = { requests: [], folders, token: GRAPH_TOKEN };
  const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
  const holder = (id) => Object.values(folders).find((list) => list.some((each) => each.id === id));
  graph.fetch = async (address, init = {}) => {
    const request = { address: String(address), method: init.method ?? "GET", headers: init.headers ?? {}, body: init.body ?? null };
    graph.requests.push(request);
    const url = new URL(request.address);
    const path = decodeURIComponent(url.pathname).replace("/v1.0", "");
    if (request.method === "GET" && path === "/me/mailFolders") {
      const wanted = /displayName eq '(.*)'/.exec(url.searchParams.get("$filter") ?? "")?.[1];
      return json({ value: wanted !== undefined && Object.hasOwn(folders, wanted) ? [{ id: wanted, totalItemCount: folders[wanted].length }] : [] });
    }
    const listed = /^\/me\/mailFolders\/([^/]+)\/messages$/.exec(path);
    if (request.method === "GET" && listed) {
      const list = folders[listed[1]];
      if (!list) return json({ error: { code: "ErrorFolderNotFound" } }, 404);
      return json({ value: list.map((each) => ({ id: each.id, internetMessageId: /^Message-ID: (.*)$/im.exec(each.raw)?.[1].trim() ?? null })) });
    }
    if (request.method === "GET" && /^\/me\/mailFolders\/[^/]+$/.test(path)) return json({ id: path.split("/").at(-1), totalItemCount: 0 });
    if (request.method === "POST" && path === "/me/messages") {
      const id = `AAMk-new-${count += 1}=`;
      folders.drafts.push({ id, raw: Buffer.from(String(request.body), "base64").toString("utf8") });
      return json({ id }, 201);
    }
    const one = /^\/me\/messages\/([^/]+)(\/\$value|\/send)?$/.exec(path);
    const list = one && holder(one[1]);
    if (!one || !list) return json({ error: { code: "ErrorItemNotFound" } }, 404);
    const message = list.find((each) => each.id === one[1]);
    if (request.method === "GET" && one[2] === "/$value") return new Response(message.raw, { status: 200, headers: { "Content-Type": "text/plain" } });
    if (request.method === "DELETE" && !one[2]) { list.splice(list.indexOf(message), 1); return new Response(null, { status: 204 }); }
    if (request.method === "POST" && one[2] === "/send") {
      if (refuseSend) return json({ error: { code: "ErrorSendAsDenied", message: "The provider refuses this mail." } }, 403);
      list.splice(list.indexOf(message), 1);
      folders.sentitems.push(message);
      return new Response(null, { status: 202 });
    }
    return json({ error: { code: "ErrorInvalidRequest" } }, 400);
  };
  return graph;
}

const BRIDGE_STATUS = { "confirmation-refused": 409, "no-encryption": 502, "login-refused": 502, "upstream-failed": 502, "not-found": 404 };
const reply = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

/**
 * The Bridge's mail operations over the local servers, and its /v1/ask for the CLI agent: a fetch that answers what the Bridge lab-pc-4 does and passes every other request on. The real mailHandlers answer; an error of
 * theirs is the Bridge's error answer (the status of the protocol table, `{ error, message }`). Every call is kept in `calls` with the connection it carried.
 */
function bridgeOver(inner, state, mailHandlers) {
  return async (input, init = {}) => {
    const url = new URL(typeof input === "object" && !(input instanceof URL) ? input.url : String(input));
    const method = String(init.method ?? "GET").toUpperCase();
    if (mailHandlers && url.origin === BRIDGE && url.pathname.startsWith("/v1/mail/")) {
      const operation = url.pathname.slice("/v1/mail/".length);
      const body = JSON.parse(init.body);
      state.calls.push({ operation, args: body.args, connection: body.connection });
      if (state.down) return reply({ error: "paused", message: "The Bridge is paused." }, 503);
      try {
        const handler = mailHandlers()[`POST /v1/mail/${operation}`];
        return reply(await handler({ params: { operation }, body }));
      } catch (error) {
        return reply({ error: error.code ?? "invalid-request", message: error.message }, BRIDGE_STATUS[error.code] ?? 400);
      }
    }
    // testBridge's two requests, which the prompt bar sends when it is drawn: the Bridge names itself and lists the agents of `state.agents`, ready.
    if (url.origin === BRIDGE && url.pathname === "/v1/pair" && method === "GET") return reply({ bridge: { name: "lab-pc-4", version: "1.0.0", platform: "linux" }, origin: "https://alice.github.io" });
    if (url.origin === BRIDGE && url.pathname === "/v1/agents" && method === "GET") return reply({ agents: state.agents.map((name) => ({ name, version: "1.0.0", ready: true, loggedIn: true })), missing: [] });
    if (url.origin === BRIDGE && url.pathname === "/v1/ask" && method === "POST") {
      state.asks.push(JSON.parse(init.body));
      return reply({ ask: "ask-1" });
    }
    if (url.origin === BRIDGE && url.pathname === "/v1/ask/ask-1") {
      return reply({ state: "done", text: JSON.stringify({ draft: { replies: state.texts }, answers: [] }), calls: [], usage: null, error: null });
    }
    return inner(input, init);
  };
}

/**
 * Starts the page of the route `replies` as a person opens it: the frame's startPage on the main page over the view of MOD-maintenance-pages, at the fragment of the route, over the mailbox of `route` ("imap": the
 * Bridge lab-pc-4 with the local IMAP and SMTP servers; "graph": the fixture of Microsoft Graph). `inbox` and `reports` name the mails the mailbox holds (raw texts), `drafts` and `sent` the folders of the same names;
 * `issues`, `places`, `rows` and `texts` are those of tests/maintenance-pages-world.mjs. `settings` are further settings the browser's store holds — the endpoints and CLI sessions the prompt bar offers (UC-049 1) — and `agents`
 * the names the Bridge lab-pc-4 lists ready. `folders` is the connection's list of folders to search. Returns the page's main element and what the fixtures kept;
 * `stop()` closes the servers and must be called in a `finally`.
 */
export async function openReplies({ route = "graph", inbox, reports = [], drafts = [], sent = [], issues, rows, places, texts = [], folders = ["INBOX"], refuseMail = false, refuseSend = false, fragment = "#replies", answer = null, createStatus = null, settings = {}, agents = [] }) {
  const f = await standard();
  const w = world({ mails: [], drafts: [], issues: issues ?? f.issues, ...(rows ? { rows } : {}), ...(places ? { places } : {}), texts, createStatus, ...(answer ? { answer } : {}) });
  const state = { calls: [], asks: [], texts, down: false, agents };
  for (const [key, value] of Object.entries(settings)) writeSetting(w.context.store, key, value);
  let imap = null, smtp = null, graph = null, layer = null;
  const realSetInterval = globalThis.setInterval;
  const base = { address: ACCOUNT, folders, places: places ?? [{ place: "this machine", outsideEu: false }] };
  if (route === "imap") {
    imap = await imapServer({ INBOX: inbox, Reports: reports, Drafts: drafts, Sent: sent });
    smtp = await smtpServer({ refuseMail });
    writeSetting(w.context.store, "mailbox", { ...base, route: "imap", imap: { bridge: "lab-pc-4", jumpHostNoted: false,
      imap: { host: "127.0.0.1", port: imap.port, security: "starttls" }, smtp: { host: "127.0.0.1", port: smtp.port, security: "starttls" }, account: ACCOUNT, password: PASSWORD } });
    // The Bridge's mail operations need imapflow and nodemailer (src/bridge-build/package.json), which only the Graph route does not.
    const { mailHandlers } = await import("../src/mail-protocols/index.mjs");
    layer = (base) => bridgeOver(base, state, mailHandlers);
  } else {
    graph = graphFixture({ inbox, Reports: reports, drafts, sentitems: sent }, { refuseSend });
    writeSetting(w.context.store, "mailbox", { ...base, route: "graph", graph: { clientId: "11111111-2222-3333-4444-555555555555", account: ACCOUNT } });
    globalThis.msal = {
      createStandardPublicClientApplication: async () => ({
        getAllAccounts: () => [{ username: ACCOUNT, homeAccountId: "x.y" }],
        acquireTokenSilent: async () => ({ accessToken: GRAPH_TOKEN, scopes: ["Mail.ReadWrite", "Mail.Send", "offline_access"], account: { username: ACCOUNT } }),
      }),
    };
    layer = (base) => {
      const inner = bridgeOver(base, state, null);
      return async (input, init) => (String(typeof input === "object" && !(input instanceof URL) ? input.url : input).startsWith(`${GRAPH}/`) ? graph.fetch(input, init) : inner(input, init));
    };
  }
  // The world assigns its fetch again whenever the product repository commits (a job record is written): every fetch assigned from now on is wrapped in this file's layer, so that the mailbox keeps answering.
  let current = layer(globalThis.fetch);
  Object.defineProperty(globalThis, "fetch", { configurable: true, get: () => current, set: (value) => { current = layer(value); } });
  globalThis.setInterval = () => 1;
  globalThis.location.hash = fragment;
  await startPage({ page: "main", views: [pages.view] });
  const stop = async () => {
    Object.defineProperty(globalThis, "fetch", { configurable: true, writable: true, value: current });
    globalThis.setInterval = realSetInterval;
    delete globalThis.msal;
    await Promise.all([imap && closed(imap.server), smtp && closed(smtp.server)].filter(Boolean));
  };
  const main = () => document.body.getElementsByTagName("main")[0];
  await waitFor(() => main() !== undefined && main().children.length > 0);
  return { w, main, state, imap, smtp, graph, stop, mails: f.mails, ids: Object.fromEntries(await Promise.all(Object.keys(f.mails).map(async (key) => [key, (await mailOf(key)).id]))), go: (to) => { globalThis.location.hash = to; } };
}

// ---------------------------------------------------------------- what a person does, and what a test reads

export const dialog = () => byClass(document.body, "decision")[0];
export async function hashTo(fragment) {
  globalThis.location.hash = fragment;
  globalThis.window.dispatchEvent(new Event("hashchange"));
  await flush();
}
export async function readReplies(p) {
  await trusted(one(p.main(), "read-replies"));
  await waitFor(() => byClass(p.main(), "replies-group").length > 0 || byClass(p.main(), "reply-mail").length > 0 || byClass(p.main(), "replies-problem").length > 0);
  return p.main();
}
export async function openIssue(p, number) {
  await hashTo(fragmentOf("replies", { issue: String(number), product: PRODUCT_URL }));
  await waitFor(() => byClass(p.main(), "reply-mail").length > 0 || byClass(p.main(), "reply-problem").length > 0);
  return p.main();
}
export async function openIssueAfterReading(p, number) {
  await readReplies(p);
  return openIssue(p, number);
}
export async function lastly(p, fn) {
  try { return await fn(); } finally { await p.stop(); }
}
export const comments = (p) => p.w.kept.github.filter((request) => request.method === "POST" && request.path.endsWith("/comments")).map((request) => JSON.parse(request.body).body);
export const writes = (p) => p.w.kept.github.filter((request) => request.method !== "GET");
export const graphWrites = (p) => p.graph.requests.filter((request) => request.method !== "GET");
export const sends = (p) => p.graph.requests.filter((request) => request.method === "POST" && /\/send$/.test(request.address));
// The header lines of a raw text (unfolded) and its decoded body.
export const headerOf = (raw, name) => raw.split(/\r?\n\r?\n/)[0].replace(/\r?\n[ \t]+/g, " ").split(/\r?\n/).filter((line) => line.toLowerCase().startsWith(`${name.toLowerCase()}:`)).map((line) => line.slice(name.length + 1).trim());
export const bodyOf = (raw) => { const [head, ...rest] = raw.split(/\r?\n\r?\n/); const text = rest.join("\n\n"); return /base64/i.test(head) ? Buffer.from(text.replace(/\s+/g, ""), "base64").toString("utf8") : text; };
export const draftsOf = (p) => p.graph.folders.drafts.map((each) => each.raw);
export async function choose(p, name = "Reviewer Rae", participant = 0) {
  await waitFor(() => byClass(p.main(), "participant").length > 0);
  const radio = byClass(p.main(), "participant")[participant];
  radio.checked = true;
  one(p.main(), "person").value = name;
  radio.dispatchEvent(new Event("change"));
  await waitFor(() => byClass(p.main(), "run-panel").length > 0);
}
export async function run(p) {
  const button = buttonsOf(one(p.main(), "run-panel"), "Run")[0];
  button.dispatchEvent(new Event("click"));
  await flush();
  const clickedByScript = p.w.kept.endpoint.length + p.state.asks.length;
  await trusted(button);
  await waitFor(() => byClass(p.main(), "reply-drafted").length > 0 || byClass(p.main(), "reply-problem").length > 0);
  return clickedByScript;
}
