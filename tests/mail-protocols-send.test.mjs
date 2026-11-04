// The Bridge keeps a reply draft and sends only the bytes a person confirmed (ITM-823) — MOD-mail-protocols' mailHandlers,
// operations store-draft, update-draft, show-draft, confirm-send and send, as docs/architecture/MOD-mail-protocols.md states
// them. The local IMAP and SMTP servers of this file serve one mailbox over STARTTLS on loopback; the SMTP server keeps every
// mail it is given in memory and relays nothing; nothing reaches a server off this computer.
// Open values of the accepted file, which no test asserts: the confirmation's lifetime ("valid for minutes"); the arguments
// of the operations (here `draft`; `ref` and `draft`; `ref`; `ref` and `sha256`; `confirmation`) and the answer of
// confirm-send (here `{ confirmation, expiresAt }`) and of send (here `{ sentAt }`).
// Run: node --test tests/mail-protocols-send.test.mjs
//
// Module: MOD-mail-protocols
// Guards: UC-039; A REPLY DRAFT IS KEPT IN THE MAILBOX'S DRAFTS FOLDER; EVERY OUTGOING MAIL IS RELEASED BY A PERSON
// Guards: THE MAIL SERVER IS REACHED ONLY OVER TLS; THE BRIDGE HOLDS THE MAILBOX PASSWORD ONLY FOR ONE REQUEST
// Guards: UC-037; A MAILBOX IS REACHED THROUGH ITS PROVIDER'S WEB API OR THROUGH THE BRIDGE (the SMTP account and the sender a connection names)
// Level: unit

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import net from "node:net";
import tls from "node:tls";

const loaded = await import("../src/mail-protocols/index.mjs").catch((error) => ({ error }));
const { mailHandlers } = loaded;

const PASSWORD = "mail-protocols-marker-password-823";
const ACCOUNT = "reports@example.org";
const CRLF = "\r\n";
const UID_VALIDITY = 7;

const raw = (lines) => lines.join(CRLF) + CRLF;
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");

const A1 = raw(["Message-ID: <a1@example.org>", "Date: Mon, 05 Oct 2026 09:00:00 +0000", "From: Ada Reporter <ada@example.net>",
  "To: reports@example.org", "Subject: Login fails", "Content-Type: text/plain; charset=utf-8", "", "The login page shows an error."]);
const A2 = raw(["Message-ID: <a2@example.org>", "In-Reply-To: <a1@example.org>", "References: <a1@example.org>", "Date: Tue, 06 Oct 2026 10:30:00 +0000",
  "From: Bo Writer <bo@example.net>", "To: reports@example.org", "Cc: Cy Copy <cy@example.net>", "Subject: Re: Login fails",
  "Content-Type: text/plain; charset=utf-8", "", "It also fails on Safari."]);
const S1 = raw(["Message-ID: <s1@example.org>", "Date: Mon, 05 Oct 2026 11:00:00 +0000", "From: reports@example.org",
  "To: Ada Reporter <ada@example.net>", "Subject: Re: Login fails", "Content-Type: text/plain; charset=utf-8", "", "We look into it."]);

const BO = { name: "Bo Writer", address: "bo@example.net" };
const MAIL_A2 = { id: "MAIL-58d1373af240df45", messageId: "<a2@example.org>", inReplyTo: "<a1@example.org>", references: ["<a1@example.org>"],
  from: BO, replyTo: [], to: [{ name: null, address: ACCOUNT }], cc: [{ name: "Cy Copy", address: "cy@example.net" }], subject: "Re: Login fails",
  date: "2026-10-06T10:30:00.000Z", text: "It also fails on Safari.", attachments: [], folder: "INBOX" };
const DRAFT = { replyTo: MAIL_A2, to: BO, subject: "Re: Login fails", body: "Which version of Safari is it?\n" };
const DRAFT_EDITED = { ...DRAFT, body: "Which version of Safari, and on which system?\n" };

const connection = (imap, smtp) => ({
  address: ACCOUNT, route: "imap", folders: ["INBOX"], places: [],
  imap: { bridge: "lab-bridge", jumpHostNoted: false,
    imap: { host: "127.0.0.1", port: imap.port, security: "starttls" },
    smtp: { host: "127.0.0.1", port: smtp.port, security: "starttls" }, account: ACCOUNT, password: PASSWORD },
});

function certPair() {
  const folder = mkdtempSync(join(tmpdir(), "agent-m-mail-cert-"));
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

// The IMAP fixture. `folders` maps a folder to its messages `{ uid, raw, deleted }`; APPEND, STORE of \Deleted and EXPUNGE change them;
// it advertises UIDPLUS and answers an APPEND with its new uid.
async function imapServer() {
  const logs = { commands: [], logins: [] };
  const folders = { INBOX: [{ uid: 1, raw: Buffer.from(A1) }, { uid: 2, raw: Buffer.from(A2) }], Drafts: [], Sent: [{ uid: 1, raw: Buffer.from(S1) }] };
  const nextUid = { INBOX: 3, Drafts: 1, Sent: 2 };
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
      if (command === "STARTTLS") {
        active.write(`${tag} OK Begin TLS negotiation${CRLF}`, () => { active.removeAllListeners("data"); upgrade(active, attach); });
        return;
      }
      if (command === "LOGIN") {
        logs.logins.push({ secure, user: quoted[0], password: quoted[1] });
        secure && quoted[1] === PASSWORD ? ok("LOGIN completed") : write(`${tag} NO AUTHENTICATIONFAILED Invalid credentials`);
        return;
      }
      if (command === "NAMESPACE") { write('* NAMESPACE (("" "/")) NIL NIL'); ok("NAMESPACE completed"); return; }
      if (command === "LIST") {
        write('* LIST (\\Drafts) "/" "Drafts"'); write('* LIST (\\Sent) "/" "Sent"'); write('* LIST () "/" "INBOX"');
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
        const wanted = rest[1];
        for (const message of folders[folder]) {
          if (!wanted.split(",").some((part) => { const [from, to] = part.split(":"); return message.uid >= Number(from) && message.uid <= (to === undefined ? Number(from) : to === "*" ? Infinity : Number(to)); })) continue;
          active.write(Buffer.concat([Buffer.from(`* ${message.uid} FETCH (UID ${message.uid} BODY[] {${message.raw.length}}${CRLF}`), message.raw, Buffer.from(`)${CRLF}`)]));
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
  return { server, logs, folders, port: server.address().port };
}

// The SMTP fixture: it accepts the marker password only after TLS and keeps each mail it is given; `refuseMail` answers a finished DATA with 554.
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

async function withMailbox(fn, smtpOptions) {
  const imap = await imapServer();
  const smtp = await smtpServer(smtpOptions);
  try { return await fn(imap, smtp); } finally { await Promise.all([closed(imap.server), closed(smtp.server)]); }
}

async function call(operation, connectionValue, args = {}) {
  if (!mailHandlers) throw new Error(`mailHandlers: ${loaded.error?.message}`);
  return mailHandlers()[`POST /v1/mail/${operation}`]({ params: { operation }, body: { connection: connectionValue, args } });
}

// A stored, shown and confirmed draft: the steps a person's send goes through before `send`.
async function confirmed(imap, smtp, draft = DRAFT) {
  const c = connection(imap, smtp);
  const ref = await call("store-draft", c, { draft });
  const shown = await call("show-draft", c, { ref });
  const { confirmation } = await call("confirm-send", c, { ref, sha256: shown.sha256 });
  return { c, ref, shown, confirmation };
}

const header = (bytes, name) => new RegExp(`^${name}: (.*(?:\\r\\n[ \\t].*)*)$`, "im").exec(bytes.toString("utf8"))?.[1] ?? null;
const refused = (code) => (error) => { assert.equal(error.code, code); return true; };

// TST-823001 · level: unit · module: MOD-mail-protocols
// guards: UC-039; A REPLY DRAFT IS KEPT IN THE MAILBOX'S DRAFTS FOLDER
// given: a local IMAP fixture over STARTTLS with INBOX holding a1 and a2 (a2 carries Message-ID <a2@example.org> and References <a1@example.org>), an empty Drafts and Sent holding s1; a local SMTP fixture
// input: the handler `POST /v1/mail/store-draft` with args { draft } replying to a2, addressed to Bo Writer <bo@example.net>, with a subject and a body
// expect: the answer is a ref { route: "bridge", uid: 1, uidValidity: 7 }; Drafts holds exactly one message with that uid whose In-Reply-To is <a2@example.org>, References are <a1@example.org> <a2@example.org>, To is Bo Writer <bo@example.net> and which has no Cc and no Bcc; its subject and text are the draft's; INBOX and Sent are as they were; the SMTP fixture received no MAIL, RCPT or DATA
test("TST-823001: store-draft keeps the reply in Drafts with In-Reply-To, References and one recipient", async () => {
  await withMailbox(async (imap, smtp) => {
    const ref = await call("store-draft", connection(imap, smtp), { draft: DRAFT });
    assert.deepEqual(ref, { route: "bridge", uid: 1, uidValidity: 7 });
    assert.equal(imap.folders.Drafts.length, 1);
    const stored = imap.folders.Drafts[0].raw;
    assert.equal(header(stored, "In-Reply-To"), "<a2@example.org>");
    assert.equal(header(stored, "References")?.split(/\s+/).join(" "), "<a1@example.org> <a2@example.org>");
    assert.match(header(stored, "To"), /^"?Bo Writer"? <bo@example\.net>$/);
    assert.equal(header(stored, "Cc"), null);
    assert.equal(header(stored, "Bcc"), null);
    assert.equal(header(stored, "Subject"), "Re: Login fails");
    assert.match(stored.toString("utf8"), /Which version of Safari is it\?/);
    assert.deepEqual(imap.folders.INBOX.map((message) => message.raw.toString()), [A1, A2]);
    assert.deepEqual(imap.folders.Sent.map((message) => message.raw.toString()), [S1]);
    assert.ok(imap.logs.logins.length > 0, "positive: the IMAP fixture was logged in to");
    assert.equal(smtp.logs.commands.some((entry) => /^(MAIL|RCPT|DATA)\b/i.test(entry.line)), false);
  });
});

// TST-823002 · level: unit · module: MOD-mail-protocols
// guards: A REPLY DRAFT IS KEPT IN THE MAILBOX'S DRAFTS FOLDER
// given: the fixture of TST-823001 in which the draft of that test was stored
// input: `update-draft` with args { ref, draft } where the draft has the body "Which version of Safari, and on which system?"
// expect: the answer is a ref that is not the first one and names the message now in Drafts; Drafts holds exactly that one message, with the new body, not the old, and still In-Reply-To <a2@example.org> and one recipient; INBOX and Sent are as they were
test("TST-823002: update-draft replaces the Bridge's own draft in Drafts", async () => {
  await withMailbox(async (imap, smtp) => {
    const c = connection(imap, smtp);
    const first = await call("store-draft", c, { draft: DRAFT });
    const second = await call("update-draft", c, { ref: first, draft: DRAFT_EDITED });
    assert.notDeepEqual(second, first);
    assert.equal(second.route, "bridge");
    assert.equal(second.uidValidity, 7);
    assert.deepEqual(imap.folders.Drafts.map((message) => message.uid), [second.uid]);
    const stored = imap.folders.Drafts[0].raw.toString("utf8");
    assert.match(stored, /on which system\?/);
    assert.doesNotMatch(stored, /Safari is it\?/);
    assert.match(stored, /^In-Reply-To: <a2@example\.org>$/m);
    assert.deepEqual(imap.folders.INBOX.map((message) => message.raw.toString()), [A1, A2]);
    assert.deepEqual(imap.folders.Sent.map((message) => message.raw.toString()), [S1]);
  });
});

// TST-823003 · level: unit · module: MOD-mail-protocols
// guards: EVERY OUTGOING MAIL IS RELEASED BY A PERSON
// given: the fixture of TST-823001 with the draft stored; the SHA-256 of the stored bytes is computed here with node:crypto from the fixture's own copy
// input: `show-draft` with args { ref }
// expect: the answer has the ref, sha256 equal to that SHA-256, from reports@example.org, to [Bo Writer <bo@example.net>], cc [], the subject "Re: Login fails", a body containing "Which version of Safari is it?" and attachments []; the fixture's Drafts is unchanged and is opened only with EXAMINE
test("TST-823003: show-draft gives the stored draft as a ShownMail with the SHA-256 of its bytes", async () => {
  await withMailbox(async (imap, smtp) => {
    const c = connection(imap, smtp);
    const ref = await call("store-draft", c, { draft: DRAFT });
    const before = Buffer.from(imap.folders.Drafts[0].raw);
    imap.logs.commands.length = 0;
    const shown = await call("show-draft", c, { ref });
    assert.deepEqual(shown.ref, ref);
    assert.equal(shown.sha256, sha(before));
    assert.equal(shown.from.address, ACCOUNT);
    assert.deepEqual(shown.to, [BO]);
    assert.deepEqual(shown.cc, []);
    assert.equal(shown.subject, "Re: Login fails");
    assert.match(shown.body, /Which version of Safari is it\?/);
    assert.deepEqual(shown.attachments, []);
    assert.deepEqual(imap.folders.Drafts[0].raw, before);
    const lines = imap.logs.commands.map((entry) => entry.line);
    assert.ok(lines.some((line) => /EXAMINE "?Drafts"?$/.test(line)), "positive: Drafts was opened, read-only");
    assert.equal(lines.some((line) => /\b(SELECT|STORE|EXPUNGE|APPEND)\b/i.test(line)), false);
  });
});

// TST-823004 · level: unit · module: MOD-mail-protocols
// guards: EVERY OUTGOING MAIL IS RELEASED BY A PERSON; THE MAIL SERVER IS REACHED ONLY OVER TLS
// given: the fixture of TST-823001 with the draft stored, shown (its sha256 and the fixture's bytes noted) and confirmed with confirm-send for { ref, sha256 }
// input: `send` with args { confirmation }
// expect: the answer has a sentAt that is a valid date; the SMTP fixture received exactly one mail, byte for byte the bytes shown (SHA-256 equal to the shown sha256), with envelope sender reports@example.org and the one recipient bo@example.net, and its AUTH, MAIL, RCPT and DATA came after TLS; Sent now holds s1 and a copy of the same bytes; Drafts is empty
test("TST-823004: send sends the very bytes shown over TLS, copies them to Sent and removes the draft", async () => {
  await withMailbox(async (imap, smtp) => {
    const { c, shown, confirmation } = await confirmed(imap, smtp);
    const shownBytes = Buffer.from(imap.folders.Drafts[0].raw);
    assert.equal(sha(shownBytes), shown.sha256);
    const answer = await call("send", c, { confirmation });
    assert.ok(!Number.isNaN(Date.parse(answer.sentAt)), `sentAt ${answer.sentAt}`);
    assert.equal(smtp.messages.length, 1);
    assert.equal(sha(smtp.messages[0].bytes), shown.sha256);
    assert.deepEqual([smtp.messages[0].from, smtp.messages[0].to], [ACCOUNT, ["bo@example.net"]]);
    assert.ok(smtp.logs.auths.length > 0 && smtp.logs.auths.every((login) => login.secure), "SMTP login after TLS");
    assert.ok(smtp.logs.commands.filter((entry) => /^(MAIL|RCPT|DATA)\b/i.test(entry.line)).every((entry) => entry.secure), "MAIL, RCPT, DATA after TLS");
    assert.equal(smtp.messages[0].secure, true);
    assert.deepEqual(imap.folders.Sent.map((message) => sha(message.raw)), [sha(S1), shown.sha256]);
    assert.deepEqual(imap.folders.Drafts, []);
  });
});

// TST-823005 · level: unit · module: MOD-mail-protocols
// guards: EVERY OUTGOING MAIL IS RELEASED BY A PERSON
// given: the fixture of TST-823001 with the draft stored, shown and confirmed; afterwards the fixture's copy of the draft is changed (the body is edited, as in the person's own mail program)
// input: `send` with args { confirmation }
// expect: it fails with code `confirmation-refused`; the SMTP fixture received no MAIL, RCPT or DATA and holds no mail; Sent is as it was; the changed draft is still in Drafts
test("TST-823005: send refuses a draft changed after the confirmation and sends nothing", async () => {
  await withMailbox(async (imap, smtp) => {
    const { c, confirmation } = await confirmed(imap, smtp);
    imap.folders.Drafts[0].raw = Buffer.from(imap.folders.Drafts[0].raw.toString("utf8").replace("Which version", "Which edition"));
    const changed = Buffer.from(imap.folders.Drafts[0].raw);
    await assert.rejects(call("send", c, { confirmation }), refused("confirmation-refused"));
    assert.ok(imap.logs.logins.length > 0, "positive: the Drafts were reached");
    assert.deepEqual(smtp.messages, []);
    assert.equal(smtp.logs.commands.some((entry) => /^(MAIL|RCPT|DATA)\b/i.test(entry.line)), false);
    assert.deepEqual(imap.folders.Sent.map((message) => message.raw.toString()), [S1]);
    assert.deepEqual(imap.folders.Drafts.map((message) => message.raw), [changed]);
  });
});

// TST-823006 · level: unit · module: MOD-mail-protocols
// guards: EVERY OUTGOING MAIL IS RELEASED BY A PERSON
// given: the fixture of TST-823001 with the draft stored, shown and confirmed, and sent once with that confirmation; afterwards the same bytes are put back into Drafts under the same uid, so that only the spent confirmation can stop a second send
// input: `send` with the same args { confirmation } a second time
// expect: it fails with code `confirmation-refused`; the SMTP fixture still holds exactly the one mail of the first send; Sent holds s1 and one copy only; the put-back draft is still in Drafts
test("TST-823006: a spent confirmation sends nothing", async () => {
  await withMailbox(async (imap, smtp) => {
    const { c, confirmation } = await confirmed(imap, smtp);
    const bytes = Buffer.from(imap.folders.Drafts[0].raw);
    await call("send", c, { confirmation });
    assert.equal(smtp.messages.length, 1);
    imap.folders.Drafts.push({ uid: 1, raw: bytes });
    await assert.rejects(call("send", c, { confirmation }), refused("confirmation-refused"));
    assert.equal(smtp.messages.length, 1);
    assert.equal(imap.folders.Sent.length, 2);
    assert.equal(imap.folders.Drafts.length, 1);
  });
});

// TST-823007 · level: unit · module: MOD-mail-protocols
// guards: EVERY OUTGOING MAIL IS RELEASED BY A PERSON
// given: the fixture of TST-823001 with the draft stored, shown and confirmed, but an SMTP fixture that answers the end of DATA with "554 5.3.0 fixture refuses this mail"
// input: `send` with args { confirmation }
// expect: it fails with code `upstream-failed` and a message containing the SMTP server's answer "fixture refuses this mail"; the draft is still in Drafts with the bytes shown; Sent holds only s1
test("TST-823007: an SMTP failure answers upstream-failed and leaves the draft in Drafts", async () => {
  await withMailbox(async (imap, smtp) => {
    const { c, shown, confirmation } = await confirmed(imap, smtp);
    await assert.rejects(call("send", c, { confirmation }), (error) => {
      assert.equal(error.code, "upstream-failed");
      assert.match(error.message, /fixture refuses this mail/);
      return true;
    });
    assert.equal(smtp.logs.commands.some((entry) => /^DATA\b/i.test(entry.line)), true, "positive: the SMTP fixture was asked to take the mail");
    assert.deepEqual(imap.folders.Drafts.map((message) => sha(message.raw)), [shown.sha256]);
    assert.deepEqual(imap.folders.Sent.map((message) => message.raw.toString()), [S1]);
  }, { refuseMail: true });
});

// TST-823008 · level: unit · module: MOD-mail-protocols
// guards: THE BRIDGE HOLDS THE MAILBOX PASSWORD ONLY FOR ONE REQUEST
// given: the fixtures of TST-823001 with the marker password; every write function of node:fs and the process output are watched from after the certificate is made
// input: `store-draft`, `update-draft`, `show-draft`, `confirm-send` and `send`, each once, on the same draft
// expect: all five answered and the mail sent; no file is written, created, truncated or removed; nothing written to stdout or stderr contains the marker password; no answer contains it
test("TST-823008: draft, confirmation and send write no file and no output holds the marker password", async (t) => {
  const writes = [], output = [];
  for (const name of ["writeFile", "writeFileSync", "appendFile", "appendFileSync", "createWriteStream", "mkdir", "mkdirSync", "rename", "renameSync", "unlink", "unlinkSync", "rm", "rmSync", "truncate", "truncateSync"]) {
    const original = fs[name];
    t.mock.method(fs, name, function (...args) { writes.push(`${name} ${String(args[0])}`); return original.apply(this, args); });
  }
  for (const stream of [process.stdout, process.stderr]) {
    const original = stream.write;
    t.mock.method(stream, "write", function (chunk, ...rest) { output.push(String(chunk)); return original.call(this, chunk, ...rest); });
  }
  syncBuiltinESMExports();
  const answers = [];
  try {
    await withMailbox(async (imap, smtp) => {
      const c = connection(imap, smtp);
      const first = await call("store-draft", c, { draft: DRAFT });
      const ref = await call("update-draft", c, { ref: first, draft: DRAFT_EDITED });
      const shown = await call("show-draft", c, { ref });
      const confirmation = await call("confirm-send", c, { ref, sha256: shown.sha256 });
      const sent = await call("send", c, { confirmation: confirmation.confirmation });
      answers.push(first, ref, shown, confirmation, sent);
      assert.equal(smtp.messages.length, 1, "positive: the mail was sent");
    });
  } finally { t.mock.restoreAll(); syncBuiltinESMExports(); }
  assert.equal(answers.length, 5);
  assert.deepEqual(writes, []);
  assert.equal(output.some((text) => text.includes(PASSWORD)), false);
  assert.equal(JSON.stringify(answers).includes(PASSWORD), false);
});

// TST-823009 · level: unit · module: MOD-mail-protocols
// guards: EVERY OUTGOING MAIL IS RELEASED BY A PERSON
// given: the fixture of TST-823001 with the draft stored, shown and confirmed; the clock of the process is then moved one day on (a day is not "minutes"; the accepted file names no number, and none is asserted)
// input: `confirm-send` is read for its expiresAt first, then `send` with args { confirmation }
// expect: expiresAt is a date later than the moment of the confirmation; `send` fails with code `confirmation-refused`; the SMTP fixture holds no mail; the draft is still in Drafts
test("TST-823009: an expired confirmation sends nothing", async (t) => {
  await withMailbox(async (imap, smtp) => {
    const c = connection(imap, smtp);
    const ref = await call("store-draft", c, { draft: DRAFT });
    const shown = await call("show-draft", c, { ref });
    t.mock.timers.enable({ apis: ["Date"], now: Date.parse("2026-10-17T12:00:00Z") });
    const { confirmation, expiresAt } = await call("confirm-send", c, { ref, sha256: shown.sha256 });
    assert.ok(Date.parse(expiresAt) > Date.parse("2026-10-17T12:00:00Z"), `expiresAt ${expiresAt}`);
    t.mock.timers.tick(24 * 60 * 60 * 1000);
    await assert.rejects(call("send", c, { confirmation }), refused("confirmation-refused"));
    t.mock.timers.reset();
    assert.deepEqual(smtp.messages, []);
    assert.equal(imap.folders.Drafts.length, 1);
  });
});

// TST-823010 · level: unit · module: MOD-mail-protocols
// guards: A REPLY DRAFT IS KEPT IN THE MAILBOX'S DRAFTS FOLDER
// given: the fixture of TST-823001 whose Drafts holds, besides the draft of the Bridge, the person's own draft at uid 50 (UIDVALIDITY 7) written by hand
// input: `update-draft` with args { ref: { route: "bridge", uid: 50, uidValidity: 99 }, draft } (a stale ref), then the same with uidValidity 7 (a ref to a draft the Bridge did not write)
// expect: both fail with code `not-found`; the person's draft is still in Drafts byte for byte; no draft was added
test("TST-823010: update-draft removes only the Bridge's own draft; a stale ref answers not-found", async () => {
  await withMailbox(async (imap, smtp) => {
    const own = Buffer.from(raw(["Message-ID: <p1@example.org>", "From: reports@example.org", "To: bo@example.net", "Subject: My own draft", "", "Not written by the Bridge."]));
    imap.folders.Drafts.push({ uid: 50, raw: own });
    for (const uidValidity of [99, 7]) {
      await assert.rejects(call("update-draft", connection(imap, smtp), { ref: { route: "bridge", uid: 50, uidValidity }, draft: DRAFT }), refused("not-found"));
    }
    assert.ok(imap.logs.logins.length > 0, "positive: the Drafts were reached");
    assert.deepEqual(imap.folders.Drafts.map((message) => [message.uid, message.raw]), [[50, own]]);
  });
});

// A connection that names the SMTP server's own login and a sender (MOD-mail-routes' MailConnection, MOD-mail-protocols' mailHandlers; UC-037 step 4.1,
// UC-039 step 4): the fixture's connection with `account` changed and `smtpAccount` and `sender` added where given. The addresses are fixture values.
const AUTHOR = "author@example.org";
const withFields = (imap, smtp, fields) => {
  const base = connection(imap, smtp);
  return { ...base, imap: { ...base.imap, ...fields } };
};
const confirmedOn = async (c, draft = DRAFT) => {
  const ref = await call("store-draft", c, { draft });
  const shown = await call("show-draft", c, { ref });
  const { confirmation } = await call("confirm-send", c, { ref, sha256: shown.sha256 });
  return { ref, shown, confirmation };
};

// TST-1771001 · level: unit · module: MOD-mail-protocols
// guards: UC-037; A MAILBOX IS REACHED THROUGH ITS PROVIDER'S WEB API OR THROUGH THE BRIDGE
// given: the fixtures of TST-823001; a connection whose `account` is "shared-login@example.org" (the IMAP login of an Exchange shared mailbox) and whose `smtpAccount` is "author@example.org"
// input: `test`, then `store-draft`, `show-draft`, `confirm-send` and `send` of the reply to a2
// expect: every IMAP LOGIN names the user "shared-login@example.org" and every SMTP AUTH the user "author@example.org", and each was made at least once; the mail was sent
test("TST-1771001: the IMAP server is logged in to with account, the SMTP server with smtpAccount", async () => {
  await withMailbox(async (imap, smtp) => {
    const c = withFields(imap, smtp, { account: "shared-login@example.org", smtpAccount: AUTHOR });
    await call("test", c);
    const { confirmation } = await confirmedOn(c);
    await call("send", c, { confirmation });
    assert.equal(smtp.messages.length, 1, "positive: the mail was sent");
    assert.ok(imap.logs.logins.length > 0 && smtp.logs.auths.length > 0, "positive: both servers were logged in to");
    assert.deepEqual([...new Set(imap.logs.logins.map((login) => login.user))], ["shared-login@example.org"]);
    assert.deepEqual([...new Set(smtp.logs.auths.map((login) => login.user))], [AUTHOR]);
  });
});

// TST-1771002 · level: unit · module: MOD-mail-protocols
// guards: UC-037; UC-039; A MAILBOX IS REACHED THROUGH ITS PROVIDER'S WEB API OR THROUGH THE BRIDGE
// given: the fixtures of TST-823001; a connection of the address reports@example.org whose `account` is "author@example.org" and whose `sender` is { name: "Reports Desk", address: "desk@example.org" }, an address other than the connection's
// input: `store-draft`, `show-draft`, `confirm-send` and `send` of the reply to a2
// expect: the draft in Drafts is From "Reports Desk" <desk@example.org> with Reply-To reports@example.org; show-draft gives from { name: "Reports Desk", address: "desk@example.org" }; the SMTP envelope's sender is desk@example.org, the recipient bo@example.net, and the bytes sent are the bytes shown
test("TST-1771002: a sender of another address is the From and the envelope sender, with the connection's address as Reply-To", async () => {
  await withMailbox(async (imap, smtp) => {
    const c = withFields(imap, smtp, { account: AUTHOR, sender: { name: "Reports Desk", address: "desk@example.org" } });
    const { shown, confirmation } = await confirmedOn(c);
    const stored = imap.folders.Drafts[0].raw;
    assert.match(header(stored, "From"), /^"?Reports Desk"? <desk@example\.org>$/);
    assert.equal(header(stored, "Reply-To"), ACCOUNT);
    assert.deepEqual(shown.from, { name: "Reports Desk", address: "desk@example.org" });
    await call("send", c, { confirmation });
    assert.equal(smtp.messages.length, 1);
    assert.deepEqual([smtp.messages[0].from, smtp.messages[0].to], ["desk@example.org", ["bo@example.net"]]);
    assert.equal(sha(smtp.messages[0].bytes), shown.sha256);
  });
});

// TST-1771003 · level: unit · module: MOD-mail-protocols
// guards: UC-037; UC-039; A MAILBOX IS REACHED THROUGH ITS PROVIDER'S WEB API OR THROUGH THE BRIDGE
// given: the fixtures of TST-823001; a connection of the address reports@example.org whose `account` is "author@example.org" and whose `sender` is { name: null, address: "reports@example.org" }, the connection's own address
// input: `store-draft`, `show-draft`, `confirm-send` and `send` of the reply to a2
// expect: the draft in Drafts is From reports@example.org with no display name and has no Reply-To; the SMTP envelope's sender is reports@example.org
test("TST-1771003: a sender of the connection's own address is the From and the envelope sender, without Reply-To", async () => {
  await withMailbox(async (imap, smtp) => {
    const c = withFields(imap, smtp, { account: AUTHOR, sender: { name: null, address: ACCOUNT } });
    const { confirmation } = await confirmedOn(c);
    const stored = imap.folders.Drafts[0].raw;
    assert.equal(header(stored, "From"), ACCOUNT);
    assert.equal(header(stored, "Reply-To"), null);
    await call("send", c, { confirmation });
    assert.equal(smtp.messages.length, 1);
    assert.equal(smtp.messages[0].from, ACCOUNT);
  });
});

// TST-1771004 · level: unit · module: MOD-mail-protocols
// guards: UC-037; UC-039; A MAILBOX IS REACHED THROUGH ITS PROVIDER'S WEB API OR THROUGH THE BRIDGE
// given: the fixtures of TST-823001; a connection of the address reports@example.org whose `account` is "author@example.org" and which names neither `smtpAccount` nor `sender` (the known positive: a connection as it was before these fields)
// input: `store-draft`, `show-draft`, `confirm-send` and `send` of the reply to a2
// expect: the draft in Drafts is From author@example.org and has no Reply-To; every IMAP LOGIN and every SMTP AUTH names the user author@example.org; the SMTP envelope's sender is author@example.org
test("TST-1771004: a connection without smtpAccount and sender logs in and sends with account, as before", async () => {
  await withMailbox(async (imap, smtp) => {
    const c = withFields(imap, smtp, { account: AUTHOR });
    const { confirmation } = await confirmedOn(c);
    const stored = imap.folders.Drafts[0].raw;
    assert.equal(header(stored, "From"), AUTHOR);
    assert.equal(header(stored, "Reply-To"), null);
    await call("send", c, { confirmation });
    assert.equal(smtp.messages.length, 1);
    assert.equal(smtp.messages[0].from, AUTHOR);
    assert.deepEqual([...new Set(imap.logs.logins.map((login) => login.user))], [AUTHOR]);
    assert.deepEqual([...new Set(smtp.logs.auths.map((login) => login.user))], [AUTHOR]);
  });
});
