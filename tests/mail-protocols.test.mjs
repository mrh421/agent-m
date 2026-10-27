// The Bridge's test of a mailbox over IMAP and SMTP (ITM-420) — MOD-mail-protocols' mailHandlers, as
// docs/architecture/MOD-mail-protocols.md and ITM-420 state it: operation `test` logs in to IMAP only over TLS or
// STARTTLS, opens named folders read-only and counts their mails, recognises Drafts and Sent by special-use markings,
// logs in to SMTP over TLS and disconnects without sending, keeps the mailbox password only for the request, and returns
// named errors. The local servers below are loopback fixtures; nothing reaches a server off this computer.
// Run: node --test tests/mail-protocols.test.mjs
//
// Module: MOD-mail-protocols
// Guards: UC-037; A MAILBOX IS REACHED THROUGH ITS PROVIDER'S WEB API OR THROUGH THE BRIDGE; THE MAIL SERVER IS REACHED ONLY OVER TLS
// Guards: READING THE MAILBOX CHANGES NOTHING IN IT; THE BRIDGE HOLDS THE MAILBOX PASSWORD ONLY FOR ONE REQUEST
// Level: unit

import test from "node:test";
import assert from "node:assert/strict";
import { PASSWORD, assertModule, connection, withServers, runTest } from "./mail-protocols-fixture.mjs";

// TST-420001 · level: unit · module: MOD-mail-protocols
// guards: UC-037; A MAILBOX IS REACHED THROUGH ITS PROVIDER'S WEB API OR THROUGH THE BRIDGE; THE MAIL SERVER IS REACHED ONLY OVER TLS
// given: local IMAP and SMTP fixture servers on loopback; both offer STARTTLS and accept the marker password only after TLS; IMAP has INBOX with 2 mails, Reports with 1, and special-use Drafts and Sent
// input: the handler `POST /v1/mail/test` receives the mailbox connection and empty args
// expect: the answer has the counts of INBOX and Reports, Drafts and Sent true, sending "works", route "imap", and a non-empty encryption text; both logins happened after TLS, and the password appears in no plaintext command
test("TST-420001: mailHandlers test counts folders and verifies SMTP only over TLS", async () => {
  assertModule();
  await withServers(async (imap, smtp) => {
    const answer = await runTest(connection(imap, smtp));
    assert.deepEqual(answer.counts, { INBOX: 2, Reports: 1 });
    assert.equal(answer.drafts, true);
    assert.equal(answer.sent, true);
    assert.equal(answer.sending, "works");
    assert.equal(answer.route, "imap");
    assert.equal(typeof answer.encryption, "string");
    assert.ok(answer.encryption.length > 0);
    assert.ok(imap.logs.logins.every((login) => login.secure), "IMAP login after TLS");
    assert.ok(smtp.logs.auths.every((login) => login.secure), "SMTP auth after TLS");
    const plaintext = [...imap.logs.commands, ...smtp.logs.commands].filter((entry) => !entry.secure).map((entry) => entry.line).join("\n");
    assert.ok(!plaintext.includes(PASSWORD), plaintext);
  });
});

// TST-420002 · level: unit · module: MOD-mail-protocols
// guards: READING THE MAILBOX CHANGES NOTHING IN IT
// given: the same local IMAP fixture, recording every IMAP command
// input: the mailbox test handler
// expect: each named folder is opened with EXAMINE; no SELECT, STORE, COPY, MOVE, EXPUNGE or non-peek FETCH is issued; SMTP receives no MAIL, RCPT or DATA command
test("TST-420002: mailHandlers test opens IMAP folders read-only and sends no mail", async () => {
  assertModule();
  await withServers(async (imap, smtp) => {
    await runTest(connection(imap, smtp));
    const imapCommands = imap.logs.commands.map((entry) => entry.line.toUpperCase());
    assert.ok(imapCommands.some((line) => /\bEXAMINE\b.*INBOX/.test(line)), "INBOX examined");
    assert.ok(imapCommands.some((line) => /\bEXAMINE\b.*REPORTS/.test(line)), "Reports examined");
    assert.equal(imapCommands.some((line) => /\b(SELECT|STORE|COPY|MOVE|EXPUNGE)\b/.test(line)), false);
    assert.equal(imapCommands.some((line) => /\bFETCH\b/.test(line) && !/\bBODY\.PEEK\b|RFC822\.PEEK/.test(line)), false);
    const smtpCommands = smtp.logs.commands.map((entry) => entry.line.toUpperCase());
    assert.equal(smtpCommands.some((line) => /^(MAIL|RCPT|DATA)\b/.test(line)), false);
  });
});

// TST-420003 · level: unit · module: MOD-mail-protocols
// guards: THE MAIL SERVER IS REACHED ONLY OVER TLS; THE BRIDGE HOLDS THE MAILBOX PASSWORD ONLY FOR ONE REQUEST
// given: local IMAP and SMTP servers that do not offer STARTTLS
// input: the mailbox test handler
// expect: it fails with code/name `no-encryption`, naming one of the servers; neither server receives LOGIN, AUTHENTICATE or AUTH, and no plaintext command contains the marker password
test("TST-420003: mailHandlers test refuses a server without TLS before login", async () => {
  assertModule();
  await withServers(async (imap, smtp) => {
    await assert.rejects(runTest(connection(imap, smtp)), (error) => {
      assert.equal(error.code ?? error.name, "no-encryption");
      assert.match(error.message, /127\.0\.0\.1|IMAP|SMTP|TLS/i);
      return true;
    });
    const all = [...imap.logs.commands, ...smtp.logs.commands];
    assert.equal(all.some((entry) => /\b(LOGIN|AUTHENTICATE|AUTH)\b/i.test(entry.line)), false);
    assert.equal(all.some((entry) => entry.line.includes(PASSWORD)), false);
  }, { imap: { advertiseStartTls: false }, smtp: { advertiseStartTls: false } });
});

// TST-420004 · level: unit · module: MOD-mail-protocols
// guards: THE BRIDGE HOLDS THE MAILBOX PASSWORD ONLY FOR ONE REQUEST; UC-037
// given: an IMAP server over STARTTLS that refuses the marker password with its answer
// input: the mailbox test handler
// expect: it fails with code/name `login-refused`, preserving the server's answer
test("TST-420004: mailHandlers test preserves a refused-login answer", async () => {
  assertModule();
  await withServers(async (imap, smtp) => {
    await assert.rejects(runTest(connection(imap, smtp)), (error) => {
      assert.equal(error.code ?? error.name, "login-refused");
      assert.match(error.message, /AUTHENTICATIONFAILED Invalid credentials/);
      return true;
    });
  }, { imap: { allowLogin: false } });
});

// TST-420005 · level: unit · module: MOD-mail-protocols
// guards: UC-037
// given: an IMAP server over STARTTLS that has INBOX but no Missing folder
// input: the mailbox test handler for folders INBOX and Missing
// expect: it fails with code/name `not-found`, naming the Missing folder
test("TST-420005: mailHandlers test names a missing folder as not-found", async () => {
  assertModule();
  await withServers(async (imap, smtp) => {
    await assert.rejects(runTest(connection(imap, smtp, ["INBOX", "Missing"])), (error) => {
      assert.equal(error.code ?? error.name, "not-found");
      assert.match(error.message, /Missing/);
      return true;
    });
  });
});

// TST-1246101 · level: unit · module: MOD-mail-protocols
// guards: UC-037; THE MAIL SERVER IS REACHED ONLY OVER TLS
// given: the local IMAP fixture over STARTTLS accepting the marker password; the local SMTP fixture over STARTTLS refusing every login with "535 5.7.8 Authentication credentials invalid"
// input: the handler `POST /v1/mail/test` receives the mailbox connection and empty args
// expect: UC-037 7d — the answer has the counts of INBOX (2) and Reports (1), Drafts and Sent true, route "imap", and `sending` is the SMTP server's answer, containing "535 5.7.8 Authentication credentials invalid"; the SMTP login was sent after TLS
test("TST-1246101: mailHandlers test answers the reading and the SMTP server's refusal as sending", async () => {
  assertModule();
  await withServers(async (imap, smtp) => {
    const answer = await runTest(connection(imap, smtp));
    assert.ok(smtp.logs.auths.length > 0, "known positive: the SMTP server received a login and refused it");
    assert.ok(smtp.logs.auths.every((login) => login.secure), "SMTP auth after TLS");
    assert.deepEqual(answer.counts, { INBOX: 2, Reports: 1 });
    assert.equal(answer.drafts, true);
    assert.equal(answer.sent, true);
    assert.equal(answer.route, "imap");
    assert.equal(typeof answer.sending, "string");
    assert.notEqual(answer.sending, "works");
    assert.match(answer.sending, /535 5\.7\.8 Authentication credentials invalid/);
  }, { smtp: { allowAuth: false } });
});

// TST-1246102 · level: unit · module: MOD-mail-protocols
// guards: UC-037
// given: the local IMAP and SMTP fixtures over STARTTLS, both accepting the marker password
// input: the mailbox test handler
// expect: the answer has the counts of INBOX (2) and Reports (1) and `sending` exactly "works"
test("TST-1246102: mailHandlers test answers sending works when the SMTP login is accepted", async () => {
  assertModule();
  await withServers(async (imap, smtp) => {
    const answer = await runTest(connection(imap, smtp));
    assert.deepEqual(answer.counts, { INBOX: 2, Reports: 1 });
    assert.equal(answer.sending, "works");
  });
});

// TST-1246103 · level: unit · module: MOD-mail-protocols
// guards: UC-037
// given: the local IMAP fixture over STARTTLS refusing the login with "AUTHENTICATIONFAILED Invalid credentials"; the local SMTP fixture accepting it
// input: the mailbox test handler
// expect: UC-037 7c — the test fails with code/name `login-refused`, preserving the IMAP server's answer; no answer with counts is given
test("TST-1246103: mailHandlers test still fails when the IMAP login is refused", async () => {
  assertModule();
  await withServers(async (imap, smtp) => {
    await assert.rejects(runTest(connection(imap, smtp)), (error) => {
      assert.equal(error.code ?? error.name, "login-refused");
      assert.match(error.message, /AUTHENTICATIONFAILED Invalid credentials/);
      return true;
    });
  }, { imap: { allowLogin: false } });
});

// TST-1246104 · level: unit · module: MOD-mail-protocols
// guards: THE MAIL SERVER IS REACHED ONLY OVER TLS; UC-037
// given: the local IMAP fixture over STARTTLS accepting the marker password; the local SMTP fixture that does not offer STARTTLS
// input: the mailbox test handler
// expect: UC-037 7b — the test fails with code/name `no-encryption` naming the SMTP server; the SMTP server receives no AUTH command and no command carrying the marker password
test("TST-1246104: mailHandlers test still fails with no-encryption when the SMTP server offers no TLS", async () => {
  assertModule();
  await withServers(async (imap, smtp) => {
    await assert.rejects(runTest(connection(imap, smtp)), (error) => {
      assert.equal(error.code ?? error.name, "no-encryption");
      assert.match(error.message, /SMTP/);
      return true;
    });
    assert.ok(imap.logs.logins.length > 0, "known positive: the IMAP step ran and logged in");
    assert.ok(smtp.logs.commands.length > 0, "known positive: the SMTP server was reached");
    assert.equal(smtp.logs.auths.length, 0);
    assert.equal(smtp.logs.commands.some((entry) => /^AUTH\b/i.test(entry.line) || entry.line.includes(PASSWORD)), false);
  }, { smtp: { advertiseStartTls: false } });
});
