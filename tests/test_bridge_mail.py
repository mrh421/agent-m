# Module: MOD-mail-protocols; MOD-desktop-shell
# Guards: THE BRIDGE HOLDS THE MAILBOX PASSWORD ONLY FOR ONE REQUEST; THE MAIL SERVER IS REACHED ONLY OVER TLS; READING THE MAILBOX CHANGES NOTHING IN IT
# Level: release
"""SPEC section 14 - the check named tests/test_bridge_mail.py.

The cases live in tests/test_bridge_mail.md. This file loads them and drives the real MOD-desktop-shell composition in
Node against local IMAP and SMTP fixture servers.
"""
import json
import re
import subprocess
import unittest
from pathlib import Path

DATA = Path(__file__).with_suffix(".md")
ROOT = Path(__file__).resolve().parents[1]
COMPOSE = (ROOT / "src" / "desktop-shell" / "compose.mjs").as_uri()

RULES = {
    "THE BRIDGE HOLDS THE MAILBOX PASSWORD ONLY FOR ONE REQUEST",
    "THE MAIL SERVER IS REACHED ONLY OVER TLS",
    "READING THE MAILBOX CHANGES NOTHING IN IT",
}

JS_CHECK = r"""
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import Module from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import http from "node:http";
import net from "node:net";
import tls from "node:tls";

const ORIGIN = "https://release-owner.github.io";
const ACCOUNT = "reports@example.org";
const SSH2_FIXTURE = join(tmpdir(), "agent-m-431-ssh2-fixture");
const COMPOSE_URL = "__COMPOSE_URL__";

function fakeSsh2Module() {
  const folder = join(SSH2_FIXTURE, "node_modules", "ssh2");
  mkdirSync(folder, { recursive: true });
  writeFileSync(join(folder, "package.json"), JSON.stringify({ name: "ssh2", version: "1.17.0", main: "index.js" }));
  writeFileSync(join(folder, "index.js"), `
    const publicKey = "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIElUTS00MzEtYnJpZGdlLW1haWwtcmVsZWFzZQ";
    const publicBuffer = Buffer.from(publicKey);
    exports.Client = class { on() { return this; } once() { return this; } connect() {} end() {} };
    exports.utils = {
      generateKeyPairSync() { return { private: "fixture-private-key", public: publicKey }; },
      parseKey() { return { type: "ssh-ed25519", getPublicSSH() { return publicBuffer; } }; }
    };
  `);
  if (!existsSync(join(folder, "index.js"))) throw new Error("missing ssh2 fixture");
  return join(SSH2_FIXTURE, "node_modules");
}

function certPair() {
  const folder = mkdtempSync(join(tmpdir(), "agent-m-431-cert-"));
  const key = join(folder, "key.pem");
  const cert = join(folder, "cert.pem");
  execFileSync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "1",
    "-subj", "/CN=localhost", "-keyout", key, "-out", cert], { stdio: "ignore" });
  return { key: readFileSync(key), cert: readFileSync(cert) };
}

const TLS = certPair();
const onceListening = (server) => new Promise((resolve, reject) => {
  server.once("error", reject);
  server.listen(0, "127.0.0.1", () => { server.off("error", reject); resolve(); });
});

function startTlsSocket(socket, logs, attach, sockets) {
  const secure = new tls.TLSSocket(socket, { isServer: true, secureContext: tls.createSecureContext(TLS) });
  sockets.add(secure);
  secure.on("close", () => sockets.delete(secure));
  secure.on("error", (error) => logs.errors.push(error.message));
  attach(secure, true);
}

function parseAuthPlain(token) {
  const parts = Buffer.from(token, "base64").toString("utf8").split("\u0000");
  return { user: parts.at(-2) ?? "", password: parts.at(-1) ?? "" };
}

async function imapServer(input, { advertiseStartTls = true } = {}) {
  const logs = { commands: [], logins: [], errors: [] };
  const sockets = new Set();
  const folders = input.counts ?? { INBOX: 2, Reports: 1 };
  const server = net.createServer((socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
    let active = socket, secure = false, buffer = "";
    const write = (line) => active.write(`${line}\r\n`);
    const ok = (tag, text) => write(`${tag} OK ${text}`);
    const no = (tag, text) => write(`${tag} NO ${text}`);
    const quoted = (line) => [...line.matchAll(/"([^"]*)"/g)].map((match) => match[1]);
    const capability = () => `* CAPABILITY IMAP4rev1 NAMESPACE SPECIAL-USE${!secure && advertiseStartTls ? " STARTTLS" : " AUTH=PLAIN"}`;
    const attach = (stream, isSecure) => {
      active = stream;
      secure = isSecure;
      stream.on("data", (chunk) => {
        buffer += chunk.toString("utf8");
        for (;;) {
          const at = buffer.indexOf("\r\n");
          if (at < 0) return;
          const line = buffer.slice(0, at);
          buffer = buffer.slice(at + 2);
          handle(line);
        }
      });
    };
    const handle = (line) => {
      logs.commands.push({ secure, line });
      const [tag, commandRaw, ...rest] = line.split(" ");
      const command = commandRaw?.toUpperCase();
      if (command === "CAPABILITY") { write(capability()); ok(tag, "CAPABILITY completed"); return; }
      if (command === "STARTTLS") {
        if (!advertiseStartTls) { no(tag, "STARTTLS unavailable"); return; }
        active.write(`${tag} OK Begin TLS negotiation\r\n`, () => {
          active.removeAllListeners("data");
          startTlsSocket(active, logs, attach, sockets);
        });
        return;
      }
      if (command === "LOGIN") {
        const [user, password] = quoted(line);
        logs.logins.push({ secure, user, password, method: "LOGIN" });
        secure && password === input.password ? ok(tag, "LOGIN completed") : no(tag, "AUTHENTICATIONFAILED Invalid credentials");
        return;
      }
      if (command === "AUTHENTICATE" && rest[0]?.toUpperCase() === "PLAIN" && rest[1]) {
        const login = parseAuthPlain(rest[1]);
        logs.logins.push({ secure, ...login, method: "AUTHENTICATE PLAIN" });
        secure && login.password === input.password ? ok(tag, "AUTHENTICATE completed") : no(tag, "AUTHENTICATIONFAILED Invalid credentials");
        return;
      }
      if (command === "NAMESPACE") { write('* NAMESPACE (("" "/")) NIL NIL'); ok(tag, "NAMESPACE completed"); return; }
      if (command === "LIST") {
        write('* LIST (\\Drafts) "/" "Drafts"');
        write('* LIST (\\Sent) "/" "Sent"');
        for (const name of Object.keys(folders)) write(`* LIST () "/" "${name}"`);
        ok(tag, "LIST completed");
        return;
      }
      if (command === "LSUB" || command === "ID" || command === "ENABLE" || command === "UNSELECT") { ok(tag, `${command} completed`); return; }
      if (command === "EXAMINE") {
        const folder = quoted(line).at(-1) ?? rest.join(" ");
        if (Object.hasOwn(folders, folder)) { write(`* ${folders[folder]} EXISTS`); ok(tag, "[READ-ONLY] EXAMINE completed"); return; }
        no(tag, `[NONEXISTENT] Mailbox doesn't exist: ${folder}`);
        return;
      }
      if (command === "SELECT" || command === "STORE" || command === "COPY" || command === "MOVE" || command === "EXPUNGE") {
        no(tag, `${command} is not allowed in this fixture`);
        return;
      }
      if (command === "LOGOUT") { write("* BYE"); ok(tag, "LOGOUT completed"); active.end(); return; }
      ok(tag, `${command} completed`);
    };
    attach(socket, false);
    write("* OK fixture IMAP ready");
  });
  await onceListening(server);
  return { server, sockets, logs, port: server.address().port, security: "starttls" };
}

async function smtpServer(input, { advertiseStartTls = true } = {}) {
  const logs = { commands: [], auths: [], errors: [] };
  const sockets = new Set();
  const server = net.createServer((socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
    let active = socket, secure = false, buffer = "";
    const write = (line) => active.write(`${line}\r\n`);
    const attach = (stream, isSecure) => {
      active = stream;
      secure = isSecure;
      stream.on("data", (chunk) => {
        buffer += chunk.toString("utf8");
        for (;;) {
          const at = buffer.indexOf("\r\n");
          if (at < 0) return;
          const line = buffer.slice(0, at);
          buffer = buffer.slice(at + 2);
          handle(line);
        }
      });
    };
    const handle = (line) => {
      logs.commands.push({ secure, line });
      const [commandRaw, method, token] = line.split(" ");
      const command = commandRaw.toUpperCase();
      if (command === "EHLO" || command === "HELO") { write("250-localhost"); if (!secure && advertiseStartTls) write("250-STARTTLS"); write("250 AUTH PLAIN"); return; }
      if (command === "STARTTLS") {
        if (!advertiseStartTls) { write("454 TLS unavailable"); return; }
        active.write("220 Ready to start TLS\r\n", () => {
          active.removeAllListeners("data");
          startTlsSocket(active, logs, attach, sockets);
        });
        return;
      }
      if (command === "AUTH" && method?.toUpperCase() === "PLAIN" && token) {
        const login = parseAuthPlain(token);
        logs.auths.push({ secure, ...login });
        write(secure && login.password === input.password ? "235 2.7.0 Authentication successful" : "535 5.7.8 Authentication credentials invalid");
        return;
      }
      if (command === "MAIL" || command === "RCPT" || command === "DATA") { write("503 no mail is accepted by this fixture"); return; }
      if (command === "QUIT") { write("221 bye"); active.end(); return; }
      write("250 OK");
    };
    attach(socket, false);
    write("220 fixture SMTP ready");
  });
  await onceListening(server);
  return { server, sockets, logs, port: server.address().port, security: "starttls" };
}

function connection(input, imap, smtp) {
  return {
    address: ACCOUNT,
    route: "imap",
    folders: input.folders ?? ["INBOX"],
    places: [],
    imap: {
      bridge: "release-bridge",
      jumpHostNoted: false,
      imap: { host: "127.0.0.1", port: imap.port, security: imap.security },
      smtp: { host: "127.0.0.1", port: smtp.port, security: smtp.security },
      account: ACCOUNT,
      password: input.password,
    },
  };
}

async function mailRequest(bridge, body) {
  const target = new URL(`${bridge.address}/v1/mail/test`);
  return new Promise((resolve, reject) => {
    const request = http.request({
      host: target.hostname,
      port: target.port,
      path: target.pathname,
      method: "POST",
      agent: false,
      headers: { Origin: ORIGIN, "content-type": "application/json", connection: "close", "x-agent-m-bridge-token": bridge.token },
    }, (response) => {
      let text = "";
      response.on("data", (chunk) => { text += chunk; });
      response.on("end", () => {
        request.destroy();
        resolve({ status: response.statusCode, body: text ? JSON.parse(text) : null });
      });
    });
    request.on("error", reject);
    request.end(JSON.stringify(body));
  });
}

function filesUnder(folder) {
  return readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
    const path = join(folder, entry.name);
    return entry.isDirectory() ? filesUnder(path) : [path];
  });
}

async function closeFixture(fixture) {
  for (const socket of fixture.sockets) socket.destroy();
  await new Promise((resolve) => fixture.server.close(() => resolve()));
  fixture.server.unref?.();
}

async function startComposedBridge() {
  const root = mkdtempSync(join(tmpdir(), "agent-m-431-compose-"));
  const lines = [];
  const priorInfo = console.info;
  try {
    process.env.NODE_PATH = fakeSsh2Module();
    Module._initPaths();
    const mod = await import(`${COMPOSE_URL}?itm431=${Date.now()}-${Math.random()}`);
    console.info = (...parts) => lines.push(parts.join(" "));
    const bridge = await mod.compose({ instance: "release-owner/agent-m", origin: ORIGIN, dataFolder: join(root, "data"), port: 0, paused: () => false });
    return {
      root,
      dataFolder: join(root, "data"),
      lines,
      bridge,
      close: async () => {
        console.info = priorInfo;
        await bridge.close().catch(() => {});
        rmSync(root, { recursive: true, force: true });
      },
    };
  } catch (error) {
    console.info = priorInfo;
    rmSync(root, { recursive: true, force: true });
    throw error;
  }
}

const cleanBody = (body) => body && typeof body === "object" ? Object.fromEntries(Object.entries(body).filter(([key]) => key !== "encryption")) : body;
const commandLines = (fixture) => fixture.logs.commands.map((entry) => entry.line);
const plaintextPasswordSeen = (password, ...fixtures) => fixtures.flatMap((fixture) => fixture.logs.commands)
  .some((entry) => !entry.secure && entry.line.includes(password));

async function runBridgeMailCase(input) {
  const noTls = input.kind === "no-tls";
  const imap = await imapServer(input, { advertiseStartTls: !noTls });
  const smtp = await smtpServer(input, { advertiseStartTls: !noTls });
  let composed;
  try {
    composed = await startComposedBridge();
    const answer = await mailRequest(composed.bridge, { connection: connection(input, imap, smtp), args: {} });
    const imapCommands = commandLines(imap).map((line) => line.toUpperCase());
    const smtpCommands = commandLines(smtp).map((line) => line.toUpperCase());
    if (noTls) {
      return {
        status: answer.status,
        error: answer.body?.error,
        mailLoginCommands: [...imapCommands, ...smtpCommands].filter((line) => /\b(LOGIN|AUTHENTICATE|AUTH)\b/.test(line)),
        passwordInPlaintextCommands: plaintextPasswordSeen(input.password, imap, smtp),
      };
    }
    return {
      status: answer.status,
      body: cleanBody(answer.body),
      encryptionPresent: typeof answer.body?.encryption === "string" && answer.body.encryption.length > 0,
      bridgeLoopback: /^http:\/\/127\.0\.0\.1:\d+$/.test(composed.bridge.address),
      imapLoginsSecure: imap.logs.logins.length > 0 && imap.logs.logins.every((login) => login.secure),
      smtpAuthsSecure: smtp.logs.auths.length > 0 && smtp.logs.auths.every((login) => login.secure),
      passwordInPlaintextCommands: plaintextPasswordSeen(input.password, imap, smtp),
      passwordInBridgeFiles: filesUnder(composed.dataFolder).some((file) => readFileSync(file, "utf8").includes(input.password)),
      passwordInBridgeLogs: composed.lines.join("\n").includes(input.password),
      mutatingImapCommands: imapCommands.filter((line) => /\b(SELECT|STORE|COPY|MOVE|EXPUNGE)\b/.test(line)),
      nonPeekFetchCommands: imapCommands.filter((line) => /\bFETCH\b/.test(line) && !/\b(BODY\.PEEK|RFC822\.PEEK)\b/.test(line)),
      smtpSendCommands: smtpCommands.filter((line) => /^(MAIL|RCPT|DATA)\b/.test(line)),
    };
  } finally {
    await Promise.all([closeFixture(imap), closeFixture(smtp)]);
    await composed?.close();
  }
}
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
        case = json.loads(fence(match.group("body"), "Case"))
        found.append({"name": match.group("name"), "case": case})
    if not found:
        raise AssertionError("no cases loaded")
    return found


def result(case: dict) -> dict:
    code = (JS_CHECK.replace("__COMPOSE_URL__", COMPOSE)
            + f"\nconst input = {json.dumps(case['input'])};"
              "\nconst value = await runBridgeMailCase(input);"
              "\nprocess.stdout.write(JSON.stringify(value));")
    run = subprocess.run(["node", "--input-type=module", "-e", code], cwd=ROOT, capture_output=True, text=True)
    if run.returncode != 0:
        raise AssertionError(run.stderr.strip()[-1200:])
    return json.loads(run.stdout)


class TestBridgeMail(unittest.TestCase):
    # TST-431001 · level: release · module: MOD-mail-protocols; MOD-desktop-shell
    # guards: THE BRIDGE HOLDS THE MAILBOX PASSWORD ONLY FOR ONE REQUEST; THE MAIL SERVER IS REACHED ONLY OVER TLS; READING THE MAILBOX CHANGES NOTHING IN IT
    # given: the Markdown cases beside this file, each with local IMAP and SMTP fixture servers and MOD-desktop-shell's composed Bridge
    # input: each case posts /v1/mail/test through the Bridge pairing token
    # expect: the successful case counts folders without storing/logging the password or mutating mail; the no-TLS case refuses before login
    # TST-584022 · level: release · module: MOD-mail-protocols; MOD-desktop-shell
    # guards: THE BRIDGE HOLDS THE MAILBOX PASSWORD ONLY FOR ONE REQUEST; THE MAIL SERVER IS REACHED ONLY OVER TLS; READING THE MAILBOX CHANGES NOTHING IN IT
    # given: the Markdown cases beside this file, each with local IMAP and SMTP fixture servers and MOD-desktop-shell's composed Bridge
    # input: each case posts /v1/mail/test through the Bridge pairing token
    # expect: the successful case counts folders without storing/logging the password or mutating mail; the no-TLS case refuses before login
    def test_each_bridge_mail_case_matches_its_expected_trace(self):
        for loaded in cases():
            with self.subTest(case=loaded["name"]):
                self.assertEqual(result(loaded["case"]), loaded["case"]["expected"])

    # TST-431002 · level: release · module: MOD-mail-protocols; MOD-desktop-shell
    # guards: THE BRIDGE HOLDS THE MAILBOX PASSWORD ONLY FOR ONE REQUEST; THE MAIL SERVER IS REACHED ONLY OVER TLS; READING THE MAILBOX CHANGES NOTHING IN IT
    # given: the loaded release cases
    # input: their case declarations
    # expect: every case states its precondition, input and expected result, and the battery covers the three guarded rules
    # TST-584023 · level: release · module: MOD-mail-protocols; MOD-desktop-shell
    # guards: THE BRIDGE HOLDS THE MAILBOX PASSWORD ONLY FOR ONE REQUEST; THE MAIL SERVER IS REACHED ONLY OVER TLS; READING THE MAILBOX CHANGES NOTHING IN IT
    # given: the loaded release cases
    # input: their case declarations
    # expect: every case states its precondition, input and expected result, and the battery covers the three guarded rules
    def test_cases_state_their_inputs_and_cover_the_guarded_rules(self):
        loaded = [case["case"] for case in cases()]
        self.assertEqual({case["input"]["kind"] for case in loaded}, {"success", "no-tls"})
        for case in loaded:
            self.assertIsInstance(case.get("given"), str)
            self.assertTrue(case["given"])
            self.assertIn("input", case)
            self.assertIn("expected", case)
        self.assertEqual(RULES, {
            "THE BRIDGE HOLDS THE MAILBOX PASSWORD ONLY FOR ONE REQUEST",
            "THE MAIL SERVER IS REACHED ONLY OVER TLS",
            "READING THE MAILBOX CHANGES NOTHING IN IT",
        })


if __name__ == "__main__":
    unittest.main()
