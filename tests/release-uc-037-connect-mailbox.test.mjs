// Release tests of UC-037 "Connect a mailbox": one or more for each requirement UC-037 realises, each run over the dashboard as a person uses it — the main page started by MOD-site-frame's startPage with
// the route `mailbox` of MOD-settings-pages, the Bridge as MOD-desktop-shell's compose builds it with local IMAP and SMTP servers, and fixtures of Microsoft's sign-in service and of Microsoft Graph
// (tests/uc-037-world.mjs) —, and one release case that checks that every realised requirement is guarded by a release case of this file and that the system test walks the main flow and every
// alternative flow ITM-433 names.
// Run: node --test tests/release-uc-037-connect-mailbox.test.mjs (it needs imapflow and nodemailer: npm install --prefix src/bridge-build --omit=dev --ignore-scripts, as CI does)
//
// Module: MOD-settings-pages; MOD-mail-routes; MOD-browser-store; MOD-bridge-client; MOD-mail-protocols
// Guards: UC-037; RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER
// Level: release
//
// Each test states its precondition (given), its input and its expected result (expect) in its own text, before it runs; no expected result is read from a document — the one case that reads UC-037 and
// the system test compares their lists with the lists this file states. Written for ITM-433 by tester-opus-mail, a participant who implemented none of ITM-419 to ITM-430 nor the change by which the
// dashboard reaches the route `mailbox` (RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER). Where the dashboard and UC-037 disagree the case follows UC-037 and is marked `todo` with the word FINDING.
// The counter-proofs are recorded in the pull request.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import net from "node:net";
import { networkInterfaces } from "node:os";
import { testDeclarations } from "../src/test-document/index.mjs";
import { bridgeAt, settingsOf } from "../src/bridge-client/index.mjs";
import { mailbox } from "../src/mail-routes/index.mjs";
import { mailId } from "../src/mail-records/index.mjs";
import {
  CLIENT, GRAPH_TOKEN, JUMP, PASSWORD, REFRESH_TOKEN, SCOPES, rawMail,
  byClass, connectAMailbox, explanationText, fillImap, filesUnder, hashTo, one, openDashboard, press, put, signInWithMicrosoft, storageText, storeAndTest, storedMailbox, textOf, tick, waitFor,
} from "./uc-037-world.mjs";

const ROOT = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, ROOT), "utf8");
const SELF = "tests/release-uc-037-connect-mailbox.test.mjs";
const SYSTEM = "tests/system-uc-037-connect-mailbox.test.mjs";
const lineOf = (p) => textOf(byClass(p.main(), "settings-mailbox")[0]);
const carries = (request, secret) => JSON.stringify(request).includes(secret);
const WRITES = /\b(SELECT|STORE|APPEND|EXPUNGE|COPY|MOVE|DELETE|RENAME|CREATE)\b/i;

// The requirements UC-037 realises, as this file states them.
const REALISED = [
  "A MAILBOX IS REACHED THROUGH ITS PROVIDER'S WEB API OR THROUGH THE BRIDGE", "AN API MAILBOX IS OPENED BY THE PROVIDER'S SIGN-IN", "THE MAIL SIGN-IN ASKS ONLY FOR READING, DRAFTING AND SENDING",
  "THE MAIL SIGN-IN TOKEN GOES ONLY TO ITS PROVIDER", "THE MAILBOX PASSWORD IS STORED ONLY AFTER ITS OWN DISCLOSURE", "THE MAILBOX PASSWORD LEAVES THE BROWSER ONLY TO THE BRIDGE",
  "A MAILBOX THROUGH THE JUMP HOST IS NAMED AS READABLE THERE", "THE BRIDGE HOLDS THE MAILBOX PASSWORD ONLY FOR ONE REQUEST", "THE MAIL SERVER IS REACHED ONLY OVER TLS",
  "READING THE MAILBOX CHANGES NOTHING IN IT", "THE SHARED PAGES ORIGIN IS DISCLOSED", "CONFIGURATION IS STORED IN LOCALSTORAGE, NOT IN A COOKIE", "A CREDENTIAL IS NEVER PLACED IN A URL",
  "A CLEAR IS A REAL CLEAR", "NO SECRET IN THE REPOSITORY", "THE LOCAL BRIDGE BINDS TO LOOPBACK ONLY", "THE LOCAL BRIDGE REQUIRES A TOKEN", "THE PLACES A MAILBOX'S MAIL MAY GO ARE CONFIGURED",
  "A PLACE OUTSIDE THE EU IS NAMED AS NOT COMPLIANT", "A MAIL IS FOUND AGAIN BY ITS IDENTIFIER", "MAIL STAYS IN THE MAILBOX", "ONE CLICK PER DECISION", "EVERY STEP EXPLAINS ITSELF",
];
// The flows the system test walks, as ITM-433 names them.
const FLOWS = ["UC-037 main flow, steps 1, 4, 5, 6, 7 and 8, on the IMAP route", "UC-037 main flow, steps 1, 2, 3, 5, 7 and 8, on the web-API route",
  ...["2a", "3a", "3b", "4a", "4b", "6a", "7a", "7b", "7c", "7d", "8a", "1a"].map((flow) => `UC-037 alternative ${flow}`)];

function ucRealises() {
  const names = [];
  let inRealises = false;
  for (const line of read("docs/use-cases/UC-037-connect-a-mailbox.md").split("\n")) {
    if (line === "realises:") { inRealises = true; continue; }
    if (!inRealises) continue;
    if (line.startsWith("  - ")) names.push(line.slice(4));
    else break;
  }
  return names;
}

// TST-433801 · level: release · module: MOD-settings-pages
// guards: UC-037; RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER
// given: the twenty-three requirements this file states as those UC-037 realises; UC-037's own list; the declarations of this file and of the system test of UC-037
// input: compare the two lists; read the guards of every release case of this file and the flows the system test declares
// expect: UC-037 realises exactly the twenty-three requirements stated here; each of them is guarded by at least one release case of this file other than this one, each declared at level release; the system test declares every case at level system and walks the main flow on the IMAP route and on the web-API route and the alternative flows 2a, 3a, 3b, 4a, 4b, 6a, 7a, 7b, 7c, 7d, 8a and 1a
test("TST-433801: every requirement UC-037 realises has a release case, and the system test walks every flow", () => {
  assert.equal(REALISED.length, 23, "known positive: twenty-three requirements are stated");
  assert.deepEqual(ucRealises(), REALISED, "UC-037 realises the requirements stated here");
  const own = testDeclarations(SELF, read(SELF)).filter((declaration) => declaration.id !== "TST-433801");
  assert.ok(own.length >= 20, "known positive: the release cases of this file are found");
  assert.ok(own.every((declaration) => declaration.level === "release"), "every case of this file is level release");
  for (const requirement of REALISED) assert.ok(own.some((declaration) => declaration.guards.includes(requirement)), `${requirement} has a release case`);
  const system = testDeclarations(SYSTEM, read(SYSTEM));
  assert.ok(system.length >= 14, "known positive: the cases of the system test are found");
  assert.ok(system.every((declaration) => declaration.level === "system"), "every case of the system test is level system");
  const declared = system.map((declaration) => `${declaration.expect ?? ""}`).join("\n");
  for (const flow of FLOWS) assert.ok(declared.includes(flow), `the system test walks ${flow}`);
});

// TST-433802 · level: release · module: MOD-settings-pages · MOD-mail-routes · MOD-bridge-client
// guards: UC-037; A MAILBOX IS REACHED THROUGH ITS PROVIDER'S WEB API OR THROUGH THE BRIDGE
// given: the Bridges lab-pc (this computer) and gpu-box (through the jump host), both the composed Bridge; Microsoft's sign-in service knows contoso-uni.example
// input: three connections stored and tested in turn: reports@contoso-uni.example on the route the page preselects; me@gmail.com on the route the page preselects, through gpu-box, its servers set to the local mail servers; reports@example.org through lab-pc
// expect: the Microsoft 365 mailbox is on the route graph and is tested through Microsoft Graph with no request to a Bridge; Gmail's is on the route imap with Gmail's servers preset, and its test goes to gpu-box through the jump host and to no request at lab-pc's address; the other mailbox's test goes to lab-pc's address and not to gpu-box
test("TST-433802: a Microsoft 365 mailbox is reached through Graph, a Gmail and any other mailbox through the Bridge its connection names", async () => {
  const p = await openDashboard();
  try {
    const page = await connectAMailbox(p);
    await signInWithMicrosoft(p);
    assert.equal(one(page, "mailbox-route").value, "graph");
    assert.match(await storeAndTest(p), /through Microsoft Graph/);
    assert.ok(p.graph.requests.length > 0, "known positive: Graph was asked");
    assert.deepEqual(p.requests.filter((request) => request.origin === p.bridge.address || request.origin === JUMP), [], "no Bridge was asked for the Microsoft 365 mailbox");
    let mark = p.requests.length;
    await put(one(page, "mailbox-address"), "me@gmail.com");
    assert.deepEqual([one(page, "mailbox-route").value, one(page, "mailbox-imap-host").value, one(page, "mailbox-smtp-host").value], ["imap", "imap.gmail.com", "smtp.gmail.com"]);
    await fillImap(p, { address: "me@gmail.com", bridge: "gpu-box" });
    await tick(one(page, "mailbox-jump-notice-read"));
    assert.match(await storeAndTest(p), /✓ Stored and tested through gpu-box/);
    let tested = p.requests.slice(mark).filter((request) => /\/v1\/mail\//.test(request.address));
    assert.ok(tested.length > 0 && tested.every((request) => request.address.startsWith(`${JUMP}/bridge/gpu-box/`)), "Gmail's mailbox went through gpu-box only");
    mark = p.requests.length;
    await fillImap(p, { bridge: "lab-pc" });
    assert.match(await storeAndTest(p), /✓ Stored and tested through lab-pc/);
    tested = p.requests.slice(mark).filter((request) => /\/v1\/mail\//.test(request.address));
    assert.ok(tested.length > 0 && tested.every((request) => request.origin === p.bridge.address), "the other mailbox went through lab-pc only");
  } finally { await p.stop(); }
});

// TST-433803 · level: release · module: MOD-settings-pages · MOD-mail-routes
// guards: UC-037; AN API MAILBOX IS OPENED BY THE PROVIDER'S SIGN-IN
// given: the page Connect a mailbox for reports@contoso-uni.example; then the same page on the IMAP route with no password entered
// input: Sign in with Microsoft and Store and test; then, on the IMAP route with the notice ticked and the password empty, Store and test
// expect: the web-API mailbox is opened by Microsoft's window (one loginPopup) and stored with no password and no IMAP part, and no request carries a password field; the IMAP route asks for the password: Store and test says to enter it and stores nothing new
test("TST-433803: a Microsoft 365 mailbox is opened by Microsoft's sign-in and asks for no password; the IMAP route asks for one", async () => {
  const p = await openDashboard();
  try {
    await connectAMailbox(p);
    await signInWithMicrosoft(p);
    assert.match(await storeAndTest(p), /✓ Stored and tested through Microsoft Graph/);
    assert.equal(p.signIn.seen.logins.length, 1, "Microsoft's window opened once");
    const stored = storedMailbox(p);
    assert.equal(stored.route, "graph");
    assert.equal(stored.imap, undefined);
    assert.ok(!/password/i.test(JSON.stringify(stored)), "no password is stored");
    assert.ok(!p.requests.some((request) => /"password"/.test(request.body ?? "")), "no request carries a password");
    await put(one(p.main(), "mailbox-route"), "imap");
    await fillImap(p, { password: "" });
    assert.match(await storeAndTest(p), /Enter the password\. Nothing was stored/);
    assert.equal(storedMailbox(p).route, "graph", "nothing new was stored");
  } finally { await p.stop(); }
});

// TST-433804 · level: release · module: MOD-settings-pages · MOD-mail-routes
// guards: UC-037; THE MAIL SIGN-IN ASKS ONLY FOR READING, DRAFTING AND SENDING
// given: the web-API route for reports@contoso-uni.example with the client identifier of the app registration
// input: Sign in with Microsoft; Store and test
// expect: Microsoft's window is asked for exactly Mail.ReadWrite, Mail.Send and offline_access, at the tenant of contoso-uni.example; every token taken for the test is asked for exactly these three; the page named them before the window opened
test("TST-433804: the sign-in asks for exactly Mail.ReadWrite, Mail.Send and offline_access", async () => {
  const p = await openDashboard();
  try {
    await connectAMailbox(p);
    await signInWithMicrosoft(p);
    assert.match(await storeAndTest(p), /✓ Stored and tested/);
    assert.deepEqual(p.signIn.seen.logins.map((login) => login.scopes), [SCOPES]);
    assert.ok(p.signIn.seen.silent.length > 0, "known positive: a token was taken for the test");
    assert.ok(p.signIn.seen.silent.every((scopes) => JSON.stringify(scopes) === JSON.stringify(SCOPES)), "every token is asked for the three permissions");
    assert.equal(p.signIn.seen.configs[0].auth.authority, "https://login.microsoftonline.com/contoso-uni.example");
    for (const scope of SCOPES) assert.ok(p.signIn.seen.pageAtLogin[0].includes(scope), `${scope} was named before the window opened`);
  } finally { await p.stop(); }
});

// TST-433805 · level: release · module: MOD-settings-pages · MOD-mail-routes · MOD-bridge-client
// guards: UC-037; THE MAIL SIGN-IN TOKEN GOES ONLY TO ITS PROVIDER; A CREDENTIAL IS NEVER PLACED IN A URL
// given: a connection on the web-API route and, after it, one on the IMAP route through lab-pc, each stored and tested, then tested again from the connected mailbox
// input: every request the page made; the page's address; every link the page shows
// expect: the sign-in token is carried by requests to https://graph.microsoft.com only, in their Authorization header only; no request's address, no page address and no link holds the sign-in token, the mailbox password or the Bridge's pairing token
test("TST-433805: the sign-in token goes only to Microsoft Graph, and no credential is placed in an address", async () => {
  const p = await openDashboard();
  try {
    await connectAMailbox(p);
    await signInWithMicrosoft(p);
    assert.match(await storeAndTest(p), /✓ Stored and tested/);
    await press(one(p.main(), "mailbox-test"));
    await waitFor(() => /✓ Tested/.test(textOf(one(p.main(), "mailbox-line-result"))), "the test of the connected mailbox");
    const withToken = p.requests.filter((request) => carries(request, GRAPH_TOKEN));
    assert.ok(withToken.length > 0, "known positive: the token went to Graph");
    assert.ok(withToken.every((request) => request.origin === "https://graph.microsoft.com"), "the token went to Graph only");
    assert.ok(withToken.every((request) => request.headers.Authorization === `Bearer ${GRAPH_TOKEN}` && !carries({ ...request, headers: {} }, GRAPH_TOKEN)), "only in the Authorization header");
    await put(one(p.main(), "mailbox-route"), "imap");
    await fillImap(p);
    assert.match(await storeAndTest(p), /✓ Stored and tested through lab-pc/);
    const hrefs = [];
    (function visit(node) { for (const child of node.children ?? []) { if (typeof child === "string") continue; if (child.getAttribute?.("href")) hrefs.push(child.getAttribute("href")); visit(child); } })(document.body);
    assert.ok(hrefs.length > 0, "known positive: the page shows links");
    for (const secret of [GRAPH_TOKEN, PASSWORD, p.bridge.token]) {
      assert.ok(!p.requests.some((request) => request.address.includes(secret)), "no request's address holds a credential");
      assert.ok(!String(globalThis.location.hash).includes(secret) && !String(globalThis.location.pathname).includes(secret), "the page's address holds no credential");
      assert.ok(!hrefs.some((href) => href.includes(secret)), "no link holds a credential");
    }
  } finally { await p.stop(); }
});

// TST-433806 · level: release · module: MOD-settings-pages · MOD-browser-store
// guards: UC-037; THE MAILBOX PASSWORD IS STORED ONLY AFTER ITS OWN DISCLOSURE; THE SHARED PAGES ORIGIN IS DISCLOSED
// given: the IMAP route on the page Connect a mailbox of the instance at https://alice.github.io/agent-m/, every field but the notice filled in
// input: Store and test before the notice is ticked; the notice ticked, the password entered, Store and test
// expect: the notice stands before the password field and says that every GitHub Pages site under alice.github.io can read the password and that with it anyone can read all mail and send mail in the mailbox's name; before the tick the password field is disabled, nothing is stored and no part of this browser's storage holds the password; after the tick the connection with the password is stored
test("TST-433806: the password is stored only after the notice naming the shared Pages origin and what the password grants", async () => {
  const p = await openDashboard();
  try {
    await connectAMailbox(p);
    await fillImap(p, { tickNotice: false });
    const page = textOf(p.main());
    const notice = textOf(one(p.main(), "mailbox-password-notice"));
    assert.match(notice, /Every GitHub Pages site under alice\.github\.io can read it/);
    assert.match(notice, /anyone can read all mail in this mailbox and send mail in its name/);
    assert.ok(page.indexOf(notice) >= 0 && page.indexOf(notice) < page.indexOf("Password What is this?"), "the notice stands before the password field");
    assert.equal(one(p.main(), "mailbox-password").disabled, true);
    assert.match(await storeAndTest(p), /Nothing was stored/);
    assert.ok(!storageText(p).includes(PASSWORD) && storedMailbox(p) === null, "nothing is stored before the notice");
    await tick(one(p.main(), "mailbox-password-notice-read"));
    await put(one(p.main(), "mailbox-password"), PASSWORD);
    assert.match(await storeAndTest(p), /✓ Stored and tested/);
    assert.equal(storedMailbox(p).imap.password, PASSWORD, "stored after the notice");
  } finally { await p.stop(); }
});

// TST-433807 · level: release · module: MOD-settings-pages · MOD-mail-routes · MOD-bridge-client
// guards: UC-037; THE MAILBOX PASSWORD LEAVES THE BROWSER ONLY TO THE BRIDGE
// given: two Bridges stored — lab-pc on the loopback and gpu-box through the jump host —; the connection through lab-pc
// input: a whole session: Store and test; Test from the connected mailbox; Processing places changed and saved; the Settings page opened
// expect: every request that carries the password goes to lab-pc's address, and carries it in its body only; no request to gpu-box, the jump host, GitHub or Microsoft carries it
test("TST-433807: during a whole session the password leaves the browser only to the Bridge the connection names", async () => {
  const p = await openDashboard();
  try {
    await connectAMailbox(p);
    await fillImap(p, { bridge: "lab-pc" });
    assert.match(await storeAndTest(p), /✓ Stored and tested through lab-pc/);
    await press(one(p.main(), "mailbox-test"));
    await waitFor(() => /✓ Tested/.test(textOf(one(p.main(), "mailbox-line-result"))), "the second test");
    await press(one(p.main(), "mailbox-places-change"));
    await waitFor(() => byClass(p.main(), "mailbox-line-place").length > 0, "Processing places");
    await press(one(p.main(), "mailbox-places-save"));
    await hashTo("#settings");
    await waitFor(() => byClass(p.main(), "mailbox-setting-open").length === 1, "Settings");
    const withPassword = p.requests.filter((request) => carries(request, PASSWORD));
    assert.ok(withPassword.length >= 2, "known positive: the password went to the Bridge with each test");
    assert.ok(withPassword.every((request) => request.origin === p.bridge.address), "only to lab-pc");
    assert.ok(withPassword.every((request) => (request.body ?? "").includes(PASSWORD) && !request.address.includes(PASSWORD) && !JSON.stringify(request.headers).includes(PASSWORD)), "in the body only");
  } finally { await p.stop(); }
});

// TST-433808 · level: release · module: MOD-settings-pages
// guards: UC-037; A MAILBOX THROUGH THE JUMP HOST IS NAMED AS READABLE THERE
// given: two IMAP connections to save: one through gpu-box, reached through the jump host, and one through lab-pc, on this computer
// input: gpu-box chosen, Store and test before and after its notice is ticked; lab-pc chosen, Store and test
// expect: for gpu-box the page states before saving that the jump host can read the password and the mails, and the connection is stored only after the notice is ticked, with jumpHostNoted true; for lab-pc no such notice is shown and the connection is stored with jumpHostNoted false
test("TST-433808: a connection through the jump host is stored only after the notice that the jump host can read it", async () => {
  const p = await openDashboard();
  try {
    await connectAMailbox(p);
    await fillImap(p, { bridge: "gpu-box" });
    assert.equal(one(p.main(), "mailbox-jump-notice").hidden, false);
    assert.match(textOf(one(p.main(), "mailbox-jump-notice")), /The password and the mails pass the jump host.*can read them there/);
    assert.match(await storeAndTest(p), /Nothing was stored/);
    assert.equal(storedMailbox(p), null, "not stored before the notice");
    await tick(one(p.main(), "mailbox-jump-notice-read"));
    assert.match(await storeAndTest(p), /✓ Stored and tested through gpu-box/);
    assert.deepEqual([storedMailbox(p).imap.bridge, storedMailbox(p).imap.jumpHostNoted], ["gpu-box", true]);
    await put(one(p.main(), "mailbox-bridge"), "lab-pc");
    assert.equal(one(p.main(), "mailbox-jump-notice").hidden, true, "no notice for this computer's Bridge");
    assert.match(await storeAndTest(p), /✓ Stored and tested through lab-pc/);
    assert.deepEqual([storedMailbox(p).imap.bridge, storedMailbox(p).imap.jumpHostNoted], ["lab-pc", false]);
  } finally { await p.stop(); }
});

// TST-433809 · level: release · module: MOD-mail-protocols · MOD-settings-pages
// guards: UC-037; THE BRIDGE HOLDS THE MAILBOX PASSWORD ONLY FOR ONE REQUEST
// given: the composed Bridge with its data folder and its console; a connection with the marker password through it
// input: Store and test; Test from the connected mailbox
// expect: the mail servers received the marker password; afterwards no file below the Bridge's data folder and no line the Bridge wrote to its console holds it
test("TST-433809: after the tests no file and no log line of the Bridge holds the mailbox password", async () => {
  const p = await openDashboard();
  try {
    await connectAMailbox(p);
    await fillImap(p);
    assert.match(await storeAndTest(p), /✓ Stored and tested/);
    await press(one(p.main(), "mailbox-test"));
    await waitFor(() => /✓ Tested/.test(textOf(one(p.main(), "mailbox-line-result"))), "the second test");
    assert.ok(p.imap.logs.logins.some((login) => login.password === PASSWORD), "known positive: the Bridge was given the password");
    const files = filesUnder(p.bridge.dataFolder);
    assert.ok(files.length > 0, "known positive: the Bridge keeps files");
    for (const file of files) assert.ok(!readFileSync(file).toString("latin1").includes(PASSWORD), `${file} does not hold the password`);
    assert.ok(p.bridge.logged.length > 0, "known positive: the Bridge wrote log lines");
    assert.ok(!p.bridge.logged.join("\n").includes(PASSWORD), "no log line holds the password");
  } finally { await p.stop(); }
});

// TST-433810 · level: release · module: MOD-mail-protocols · MOD-settings-pages
// guards: UC-037; THE MAIL SERVER IS REACHED ONLY OVER TLS
// given: an IMAP server and an SMTP server that offer no STARTTLS; then, in a browser of its own, servers that offer it
// input: Store and test with STARTTLS for both, in each browser
// expect: without STARTTLS neither server receives LOGIN, AUTHENTICATE or AUTH and the page says the server offers no encryption; with STARTTLS every login reaches the servers only after TLS
test("TST-433810: a login reaches a mail server only over TLS", async () => {
  const plain = await openDashboard({ imap: { startTls: false }, smtp: { startTls: false } });
  try {
    await connectAMailbox(plain);
    await fillImap(plain);
    assert.match(await storeAndTest(plain), /offers no encryption/);
    assert.ok(plain.imap.logs.commands.length > 0, "known positive: the IMAP server was reached");
    assert.deepEqual(plain.imap.logs.commands.filter((command) => /\b(LOGIN|AUTHENTICATE)\b/i.test(command.line)), []);
    assert.deepEqual(plain.smtp.logs.auths, []);
  } finally { await plain.stop(); }
  const secured = await openDashboard();
  try {
    await connectAMailbox(secured);
    await fillImap(secured);
    assert.match(await storeAndTest(secured), /✓ Stored and tested/);
    assert.ok(secured.imap.logs.logins.length > 0 && secured.imap.logs.logins.every((login) => login.secure));
    assert.ok(secured.smtp.logs.auths.length > 0 && secured.smtp.logs.auths.every((auth) => auth.secure));
  } finally { await secured.stop(); }
});

// TST-433811 · level: release · module: MOD-mail-protocols · MOD-mail-routes · MOD-settings-pages
// guards: UC-037; READING THE MAILBOX CHANGES NOTHING IN IT; MAIL STAYS IN THE MAILBOX
// given: the IMAP server holds mails from Erika Mustermann whose subject and text carry needle words; Microsoft Graph holds folders; connections on both routes
// input: on the IMAP route Store and test, Test, and the filed mail found again through the stored connection; on the web-API route Store and test and Test
// expect: the IMAP server saw EXAMINE and no SELECT, STORE, APPEND, EXPUNGE, COPY or MOVE and no FETCH of a body without PEEK; every folder holds the very bytes it held; Microsoft Graph saw only GET requests; no needle — sender, address, subject or sentence — is in this browser's storage or in any request to GitHub, to Microsoft or to the Bridge
test("TST-433811: connecting and testing a mailbox changes nothing in it, and its mails go nowhere else", async () => {
  const NEEDLES = ["Erika", "erika@example.invalid", "NEEDLE-SUBJECT-433", "NEEDLE-SENTENCE-433"];
  const folders = { INBOX: [rawMail("n1", { subject: "NEEDLE-SUBJECT-433 export", body: "NEEDLE-SENTENCE-433 the export fails.\r\nKind regards" })], Reports: [rawMail("filed", { subject: "NEEDLE-SUBJECT-433 filed" })] };
  const p = await openDashboard({ imap: { folders } });
  try {
    const before = Object.fromEntries(Object.entries(p.imap.folders).map(([name, list]) => [name, list.map((each) => each.raw.toString("latin1"))]));
    await connectAMailbox(p);
    await fillImap(p);
    assert.match(await storeAndTest(p), /✓ Stored and tested/);
    await press(one(p.main(), "mailbox-test"));
    await waitFor(() => /✓ Tested/.test(textOf(one(p.main(), "mailbox-line-result"))), "the second test");
    const stored = storedMailbox(p);
    const found = await mailbox(stored, bridgeAt(settingsOf({ name: "lab-pc", address: p.bridge.address, token: p.bridge.token }, null))).find(await mailId({ messageId: "<filed@mail.example.invalid>", bytes: null }));
    assert.equal(found?.subject, "NEEDLE-SUBJECT-433 filed", "known positive: the mail was read");
    const lines = p.imap.logs.commands.map((command) => command.line);
    assert.ok(lines.some((line) => /\bEXAMINE\b/.test(line)), "known positive: folders were opened");
    assert.deepEqual(lines.filter((line) => WRITES.test(line)), [], "no command changed the mailbox");
    assert.deepEqual(lines.filter((line) => /FETCH/i.test(line) && /BODY\[/i.test(line) && !/PEEK/i.test(line)), [], "no FETCH marks a mail as read");
    assert.deepEqual(Object.fromEntries(Object.entries(p.imap.folders).map(([name, list]) => [name, list.map((each) => each.raw.toString("latin1"))])), before, "the mailbox holds what it held");
    await put(one(p.main(), "mailbox-route"), "graph");
    await put(one(p.main(), "mailbox-folders"), "INBOX");
    await signInWithMicrosoft(p);
    assert.match(await storeAndTest(p), /✓ Stored and tested through Microsoft Graph/);
    assert.ok(p.graph.requests.length > 0 && p.graph.requests.every((request) => request.method === "GET"), "Graph is only read");
    const kept = storageText(p);
    for (const needle of NEEDLES) {
      assert.ok(!kept.includes(needle), `${needle} is not in this browser's storage`);
      assert.ok(!p.requests.some((request) => carries(request, needle)), `${needle} is in no request`);
    }
  } finally { await p.stop(); }
});

// TST-433812 · level: release · module: MOD-mail-routes · MOD-mail-protocols · MOD-settings-pages
// guards: UC-037; A MAIL IS FOUND AGAIN BY ITS IDENTIFIER
// given: a reported mail filed into the folder Reports; the connection stored by the page once with the preset folder INBOX and once with the folders "INBOX, Reports"
// input: the mail's MAIL- identifier looked up through each stored connection and its Bridge; an identifier no mail has, looked up too
// expect: through the connection naming Reports the mail is found, in the folder Reports; through the connection with INBOX only it is not found (null) and never another mail; the unknown identifier is not found (null)
test("TST-433812: a mail filed into a folder the connection names is found again by its identifier, and no guess is made", async () => {
  const p = await openDashboard();
  try {
    await connectAMailbox(p);
    const via = () => mailbox(storedMailbox(p), bridgeAt(settingsOf({ name: "lab-pc", address: p.bridge.address, token: p.bridge.token }, null)));
    const filed = await mailId({ messageId: "<filed@mail.example.invalid>", bytes: null });
    await fillImap(p, { folders: "INBOX" });
    assert.match(await storeAndTest(p), /✓ Stored and tested/);
    assert.deepEqual(storedMailbox(p).folders, ["INBOX"]);
    assert.equal(await via().find(filed), null, "not found where the folder is not named");
    await put(one(p.main(), "mailbox-folders"), "INBOX, Reports");
    assert.match(await storeAndTest(p), /✓ Stored and tested/);
    const found = await via().find(filed);
    assert.equal(found?.id, filed);
    assert.equal(found?.folder, "Reports");
    assert.equal(await via().find("MAIL-0000000000000000"), null, "an identifier with no mail is not found");
  } finally { await p.stop(); }
});

// TST-433813 · level: release · module: MOD-settings-pages · MOD-browser-store
// guards: UC-037; THE PLACES A MAILBOX'S MAIL MAY GO ARE CONFIGURED
// given: participants declaring this machine, FAU data centre (EU) and a provider in the USA
// input: Connect a mailbox; Store and test with no place ticked; then Processing places: this machine and FAU data centre (EU) ticked, Save places
// expect: the page lists the three declared places, none ticked; the connection stored with no place, and the mailbox says mails are only read, never handed to a participant; after the change the connection names exactly this machine and FAU data centre (EU)
test("TST-433813: the connection names the processing places its mails may go to, none until the person ticks one", async () => {
  const p = await openDashboard();
  try {
    await connectAMailbox(p);
    assert.deepEqual(byClass(p.main(), "mailbox-place").map((box) => [box.getAttribute("data-place"), Boolean(box.checked)]), [["this machine", false], ["FAU data centre (EU)", false], ["a provider in the USA", false]]);
    await fillImap(p, { places: [] });
    assert.match(await storeAndTest(p), /✓ Stored and tested/);
    assert.deepEqual(storedMailbox(p).places, []);
    assert.match(lineOf(p), /processing places none: mails are only read, never handed to a participant/);
    await press(one(p.main(), "mailbox-places-change"));
    await waitFor(() => byClass(p.main(), "mailbox-line-place").length > 0, "Processing places");
    for (const box of byClass(p.main(), "mailbox-line-place")) await tick(box, box.getAttribute("data-place") !== "a provider in the USA");
    await press(one(p.main(), "mailbox-places-save"));
    assert.deepEqual(storedMailbox(p).places, [{ place: "this machine", outsideEu: false }, { place: "FAU data centre (EU)", outsideEu: false }]);
  } finally { await p.stop(); }
});

// TST-433814 · level: release · module: MOD-settings-pages
// guards: UC-037; A PLACE OUTSIDE THE EU IS NAMED AS NOT COMPLIANT
// given: the IMAP route filled in
// input: this machine and FAU data centre (EU) ticked; then a provider in the USA ticked as well, Store and test before and after its notice is read
// expect: for places inside the EU no notice is shown; for the place in the USA the page states before saving that processing personal data there does not comply with the GDPR for transferring personal data and the EU AI Act; nothing is stored until the notice is ticked; then the place is stored as outside the EU with the notice recorded
test("TST-433814: a place outside the EU is named as not compliant before the connection is saved", async () => {
  const p = await openDashboard();
  try {
    await connectAMailbox(p);
    await fillImap(p, { places: ["this machine", "FAU data centre (EU)"] });
    assert.equal(one(p.main(), "mailbox-place-notice").hidden, true, "no notice for places inside the EU");
    for (const box of byClass(p.main(), "mailbox-place")) if (box.getAttribute("data-place") === "a provider in the USA") await tick(box);
    assert.equal(one(p.main(), "mailbox-place-notice").hidden, false);
    assert.match(textOf(one(p.main(), "mailbox-place-notice")), /does not comply with the EU's rules — the GDPR for transferring personal data, and the EU AI Act/);
    assert.match(await storeAndTest(p), /Nothing was stored/);
    assert.equal(storedMailbox(p), null);
    await tick(one(p.main(), "mailbox-place-notice-read"));
    assert.match(await storeAndTest(p), /✓ Stored and tested/);
    assert.deepEqual(storedMailbox(p).places.find((each) => each.place === "a provider in the USA"), { place: "a provider in the USA", outsideEu: true, notCompliantNoted: true });
  } finally { await p.stop(); }
});

// TST-433815 · level: release · module: MOD-settings-pages · MOD-browser-store
// guards: UC-037; CONFIGURATION IS STORED IN LOCALSTORAGE, NOT IN A COOKIE
// given: a browser whose document records every cookie written
// input: a connection on the IMAP route and then one on the web-API route, each stored and tested
// expect: the connection is in localStorage under the instance's key agent-m:alice/agent-m:mailbox, and the sign-in in the library's keys there; no cookie is written
test("TST-433815: the mailbox connection is kept in localStorage and no cookie is written", async () => {
  const p = await openDashboard();
  try {
    await connectAMailbox(p);
    await fillImap(p);
    assert.match(await storeAndTest(p), /✓ Stored and tested/);
    assert.equal(storedMailbox(p).route, "imap");
    await put(one(p.main(), "mailbox-route"), "graph");
    await put(one(p.main(), "mailbox-folders"), "INBOX");
    await signInWithMicrosoft(p);
    assert.match(await storeAndTest(p), /✓ Stored and tested/);
    assert.equal(storedMailbox(p).route, "graph");
    assert.ok(storageText(p).includes(`msal.3.token.keys.${CLIENT}`), "the sign-in is in localStorage");
    assert.deepEqual(p.writes, [], "no cookie is written");
  } finally { await p.stop(); }
});

// TST-433816 · level: release · module: MOD-settings-pages · MOD-browser-store
// guards: UC-037; A CLEAR IS A REAL CLEAR
// given: a connection on the web-API route stored and tested, then one on the IMAP route stored and tested over it, in a browser whose sign-in wrote the library's keys
// input: Disconnect, confirmed; then the page Connect a mailbox and Settings opened again
// expect: localStorage holds no mailbox entry, no password, no sign-in token, no refresh token and no key of the sign-in library for the client; the form opened again holds no password; Settings shows the mailbox as not set
test("TST-433816: Disconnect removes the connection and its secrets from localStorage, not only from the form", async () => {
  const p = await openDashboard();
  try {
    await connectAMailbox(p);
    await signInWithMicrosoft(p);
    assert.match(await storeAndTest(p), /✓ Stored and tested/);
    await put(one(p.main(), "mailbox-route"), "imap");
    await fillImap(p);
    assert.match(await storeAndTest(p), /✓ Stored and tested/);
    const before = storageText(p);
    assert.ok(before.includes(PASSWORD), "known positive: the password is stored");
    await press(one(p.main(), "mailbox-disconnect"));
    const after = storageText(p);
    for (const gone of [PASSWORD, "agent-m:alice/agent-m:mailbox="]) assert.ok(!after.includes(gone), `${gone} is removed`);
    await hashTo("#settings");
    await waitFor(() => byClass(p.main(), "mailbox-setting-open").length === 1, "Settings");
    assert.match(textOf(p.main()), /Mailbox: not set/);
    await hashTo("#mailbox");
    await waitFor(() => byClass(p.main(), "mailbox-password").length === 1, "the page Connect a mailbox");
    assert.equal(one(p.main(), "mailbox-password").value ?? "", "", "the form holds no password");
  } finally { await p.stop(); }
});

// TST-433817 · level: release · module: MOD-settings-pages · MOD-browser-store
// guards: UC-037; A CLEAR IS A REAL CLEAR
// given: a connection on the web-API route stored and tested, whose sign-in wrote the library's cache keys — the access token, the refresh token, the account — into localStorage
// input: Disconnect, confirmed
// expect: no key of the sign-in library for the client remains, and neither the sign-in token nor the refresh token is anywhere in localStorage
test("TST-433817: Disconnect on the web-API route removes the sign-in token from localStorage", async () => {
  const p = await openDashboard();
  try {
    await connectAMailbox(p);
    await signInWithMicrosoft(p);
    assert.match(await storeAndTest(p), /✓ Stored and tested/);
    assert.ok(storageText(p).includes(REFRESH_TOKEN), "known positive: the sign-in is kept");
    await press(one(p.main(), "mailbox-disconnect"));
    const after = storageText(p);
    for (const gone of [GRAPH_TOKEN, REFRESH_TOKEN, `msal.3.token.keys.${CLIENT}`, `msal.${CLIENT}.`]) assert.ok(!after.includes(gone), `${gone} is removed`);
  } finally { await p.stop(); }
});

// TST-433818 · level: release · module: MOD-settings-pages · MOD-browser-store · MOD-bridge-client
// guards: UC-037; NO SECRET IN THE REPOSITORY
// given: the instance repository alice/agent-m read by the dashboard; connections on both routes, stored and tested, and the places changed
// input: every request the dashboard made to GitHub
// expect: the dashboard read the instance repository and wrote nothing to it; no request to GitHub holds the mailbox password, the sign-in token, the refresh token or the Bridge's pairing token
test("TST-433818: connecting a mailbox writes no secret to a repository", async () => {
  const p = await openDashboard();
  try {
    await connectAMailbox(p);
    await signInWithMicrosoft(p);
    assert.match(await storeAndTest(p), /✓ Stored and tested/);
    await put(one(p.main(), "mailbox-route"), "imap");
    await fillImap(p, { places: ["this machine", "FAU data centre (EU)"] });
    assert.match(await storeAndTest(p), /✓ Stored and tested/);
    await press(one(p.main(), "mailbox-places-change"));
    await waitFor(() => byClass(p.main(), "mailbox-line-place").length > 0, "Processing places");
    await press(one(p.main(), "mailbox-places-save"));
    const github = p.requests.filter((request) => request.origin === "https://api.github.com");
    assert.ok(github.length > 0, "known positive: the instance repository was read");
    assert.deepEqual(github.filter((request) => request.method !== "GET"), [], "nothing was written to a repository");
    for (const secret of [PASSWORD, GRAPH_TOKEN, REFRESH_TOKEN, p.bridge.token]) assert.ok(!github.some((request) => carries(request, secret)), "no secret goes to GitHub");
  } finally { await p.stop(); }
});

// TST-433819 · level: release · module: MOD-bridge-client · MOD-settings-pages
// guards: UC-037; THE LOCAL BRIDGE BINDS TO LOOPBACK ONLY
// given: the Bridge lab-pc, which the page presets as this computer's Bridge; an address of this computer that is not the loopback
// input: the address of lab-pc; a TCP connection to its port at 127.0.0.1 and at the other address
// expect: lab-pc's address is http://127.0.0.1:<port>; the connection at 127.0.0.1 is accepted and the one at the other address is refused
test("TST-433819: this computer's Bridge listens on the loopback only", async () => {
  const p = await openDashboard();
  try {
    await connectAMailbox(p);
    assert.equal(one(p.main(), "mailbox-bridge").value, "lab-pc");
    const address = new URL(p.bridge.address);
    assert.equal(address.hostname, "127.0.0.1");
    const other = Object.values(networkInterfaces()).flat().find((each) => each && each.family === "IPv4" && !each.internal)?.address;
    assert.ok(other, "known positive: this computer has an address that is not the loopback");
    const reach = (host) => new Promise((resolve) => {
      const socket = net.connect({ host, port: Number(address.port) });
      socket.once("connect", () => { socket.destroy(); resolve(true); });
      socket.once("error", () => resolve(false));
    });
    assert.equal(await reach("127.0.0.1"), true, "accepted on the loopback");
    assert.equal(await reach(other), false, `refused at ${other}`);
  } finally { await p.stop(); }
});

// TST-433820 · level: release · module: MOD-bridge-client · MOD-settings-pages · MOD-mail-protocols
// guards: UC-037; THE LOCAL BRIDGE REQUIRES A TOKEN
// given: the composed Bridge stored twice: as wrong-token with a token it never issued, and as lab-pc with its pairing token
// input: Store and test through wrong-token; then through lab-pc
// expect: through wrong-token the page says the Bridge refused its token and no mail server is reached; through lab-pc the test works
test("TST-433820: the Bridge refuses a request without its pairing token", async () => {
  const p = await openDashboard({ bridges: ["lab-pc", "wrong-token"] });
  try {
    await connectAMailbox(p);
    await fillImap(p, { bridge: "wrong-token" });
    assert.match(await storeAndTest(p), /refused its pairing token/);
    assert.equal(p.imap.logs.commands.length + p.smtp.logs.commands.length, 0, "no mail server was reached");
    await put(one(p.main(), "mailbox-bridge"), "lab-pc");
    assert.match(await storeAndTest(p), /✓ Stored and tested through lab-pc/);
  } finally { await p.stop(); }
});

// TST-433821 · level: release · module: MOD-settings-pages
// guards: UC-037; ONE CLICK PER DECISION
// given: the IMAP route with every input complete; then the connected mailbox
// input: one click on Store and test; one click on Disconnect
// expect: the one click stores the connection and tests it — one request to the Bridge's test, the parts shown —; the one click on Disconnect, with the one confirmation UC-037 asks for, removes the connection
test("TST-433821: Store and test is one click, and Disconnect one click with its one confirmation", async () => {
  const p = await openDashboard();
  try {
    await connectAMailbox(p);
    await fillImap(p);
    const before = p.requests.length;
    assert.match(await storeAndTest(p), /✓ Stored and tested/);
    assert.ok(storedMailbox(p) !== null, "stored");
    assert.equal(p.requests.slice(before).filter((request) => request.address.endsWith("/v1/mail/test")).length, 1, "tested once");
    assert.ok(one(p.main(), "mailbox-parts").children.length > 0, "the parts are shown");
    await press(one(p.main(), "mailbox-disconnect"));
    assert.equal(p.confirms.length, 1);
    assert.equal(storedMailbox(p), null);
  } finally { await p.stop(); }
});

// TST-433822 · level: release · module: MOD-settings-pages
// guards: UC-037; EVERY STEP EXPLAINS ITSELF
// given: the page Connect a mailbox
// input: the folded explanations of its steps; a refused login
// expect: folded explanations, each closed, explain the two routes, the app registration and whom to ask, where a provider lists its server settings, the app password with 2-Step Verification, and the processing places; after a refused login one more explains the app password
test("TST-433822: every step of connecting a mailbox carries its folded explanation", async () => {
  const p = await openDashboard();
  try {
    await connectAMailbox(p);
    const texts = () => byClass(p.main(), "explain").map((node) => ({ text: explanationText(node), open: Boolean(node.open) }));
    for (const [step, words] of [["the routes", /two ways to connect a mailbox/], ["the app registration", /administrators/], ["the servers", /usually lists these settings/], ["the app password", /2-Step Verification/], ["the processing places", /Processing places are the places/]]) {
      const found = texts().find((each) => words.test(each.text));
      assert.ok(found, `${step} is explained`);
      assert.equal(found.open, false, `${step}: folded`);
    }
    await fillImap(p, { password: "not-the-password-433" });
    assert.match(await storeAndTest(p), /refused the login/);
    assert.equal(byClass(one(p.main(), "mailbox-result-explanation"), "explain").length, 1, "the refused login is explained");
  } finally { await p.stop(); }
});
