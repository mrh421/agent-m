// UC-037 "Connect a mailbox" as a system path: the dashboard's main page, started by MOD-site-frame's startPage, where the person opens Settings → Mailbox and presses Connect a mailbox, which opens
// MOD-settings-pages' route `mailbox`. On the IMAP route the connection goes through the Bridge as MOD-desktop-shell's compose builds it (ITM-430), whose mailHandlers of MOD-mail-protocols talk over
// STARTTLS to a local IMAP server and a local SMTP server; on the web-API route Microsoft's sign-in service and Microsoft Graph are fixtures. It walks the main flow on both routes and the alternative flows
// 2a, 3a, 3b, 4a, 4b, 6a, 7a, 7b, 7c, 7d, 8a and 1a. The world is tests/uc-037-world.mjs.
// Run: node --test tests/system-uc-037-connect-mailbox.test.mjs (it needs imapflow and nodemailer: npm install --prefix src/bridge-build --omit=dev --ignore-scripts, as CI does)
//
// Module: MOD-settings-pages; MOD-mail-routes; MOD-browser-store; MOD-bridge-client; MOD-mail-protocols
// Guards: UC-037; A MAILBOX IS REACHED THROUGH ITS PROVIDER'S WEB API OR THROUGH THE BRIDGE; AN API MAILBOX IS OPENED BY THE PROVIDER'S SIGN-IN; THE MAILBOX PASSWORD IS STORED ONLY AFTER ITS OWN DISCLOSURE
// Guards: A MAILBOX THROUGH THE JUMP HOST IS NAMED AS READABLE THERE; THE MAIL SERVER IS REACHED ONLY OVER TLS; READING THE MAILBOX CHANGES NOTHING IN IT; A PLACE OUTSIDE THE EU IS NAMED AS NOT COMPLIANT
// Guards: CONFIGURATION IS STORED IN LOCALSTORAGE, NOT IN A COOKIE; A CLEAR IS A REAL CLEAR; THE PLACES A MAILBOX'S MAIL MAY GO ARE CONFIGURED
// Level: system
//
// Each test states its precondition (given), its input and its expected result (expect) in its own text, from UC-037, before it runs; the expected results are written here, none is read from a document.
// Where the dashboard and UC-037 disagree the test follows UC-037, is marked `todo` with the word FINDING, and the pull request names the finding. Written for ITM-433 by tester-opus-mail, who implemented
// none of ITM-419 to ITM-430 (RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER). The counter-proofs are recorded in the pull request.

import test from "node:test";
import assert from "node:assert/strict";
import { exportSettings } from "../src/browser-store/index.mjs";
import { view as maintenanceView } from "../src/maintenance-pages/index.mjs";
import { view as settingsView } from "../src/settings-pages/index.mjs";
import {
  ACCOUNT, CLIENT, GRAPH_TOKEN, JUMP, MS_ADDRESS, PASSWORD, REFRESH_TOKEN, SCOPES, SIGN_IN,
  byClass, connectAMailbox, explanationText, fillImap, filesUnder, hashTo, importSettingsFile, one, openDashboard, press, put, signInWithMicrosoft, storageText, storeAndTest, storedMailbox, textOf, tick, waitFor,
} from "./uc-037-world.mjs";

const lineOf = (p) => textOf(byClass(p.main(), "settings-mailbox")[0]);
const partsOf = (p) => one(p.main(), "mailbox-parts").children.filter((item) => typeof item !== "string").map((item) => textOf(item));
const carries = (request, secret) => JSON.stringify(request).includes(secret);
const WRITES = /\b(SELECT|STORE|APPEND|EXPUNGE|COPY|MOVE|DELETE|RENAME|CREATE)\b/i;

// TST-433701 · level: system · module: MOD-settings-pages · MOD-browser-store · MOD-bridge-client · MOD-mail-protocols · MOD-mail-routes
// guards: UC-037; A MAILBOX IS REACHED THROUGH ITS PROVIDER'S WEB API OR THROUGH THE BRIDGE; THE MAILBOX PASSWORD IS STORED ONLY AFTER ITS OWN DISCLOSURE; READING THE MAILBOX CHANGES NOTHING IN IT; CONFIGURATION IS STORED IN LOCALSTORAGE, NOT IN A COOKIE
// given: the instance alice/agent-m with its token in this browser; the Bridges lab-pc (this computer's loopback, the composed Bridge) and gpu-box (through the jump host); the IMAP server holds four mails in INBOX and two in Reports, Drafts and Sent marked; participants declare this machine, FAU data centre (EU) and a provider in the USA
// input: Settings → Connect a mailbox; the address me@gmail.com typed, then reports@example.org; the IMAP and SMTP servers (127.0.0.1, their ports, STARTTLS); the notice ticked and the marker password; folders "INBOX, Reports"; the place this machine ticked; Store and test, one click; then the same instance opened in another browser
// expect: Settings shows the mailbox as not set with Connect a mailbox, which opens the page Connect a mailbox; Gmail's address preselects the IMAP route with imap.gmail.com 993 TLS and smtp.gmail.com 587 STARTTLS and the account the address, and a folded What is this? explains both routes; for reports@example.org the IMAP route; INBOX is the preset folder; no place is preset; this computer's Bridge lab-pc is preset; after the click "✓ Stored and tested through lab-pc", INBOX: 4 mails, Reports: 2 mails, Drafts and Sent found, sending works, the route imap and the encryption; the connection is in localStorage under agent-m:alice/agent-m:mailbox with the route imap, the Bridge lab-pc, the folders and the place; no cookie is written and no address holds the password; the IMAP server saw LOGIN only after TLS, EXAMINE only and no command that changes a mail; the SMTP server saw AUTH after TLS and no MAIL, RCPT or DATA; the password went only to lab-pc; the mailbox is shown connected with its route, folders, places and Disconnect; the other browser shows no mailbox (flow: UC-037 main flow, steps 1, 4, 5, 6, 7 and 8, on the IMAP route, and the postcondition)
test("main flow on the IMAP route: Settings → Connect a mailbox, the servers, the notice and the password, the Bridge, the folders and a place, Store and test through the composed Bridge", async () => {
  const p = await openDashboard();
  let other = null, stopped = false;
  try {
    await waitFor(() => /Mailbox: not set/.test(textOf(p.main())), "the mailbox not set on Settings");
    assert.equal(textOf(one(p.main(), "mailbox-setting-open")), "Connect a mailbox");
    const page = await connectAMailbox(p);
    assert.match(globalThis.location.hash, /^#mailbox/, "the route mailbox is shown");
    await put(one(page, "mailbox-address"), "me@gmail.com");
    assert.equal(one(page, "mailbox-route").value, "imap");
    assert.deepEqual([one(page, "mailbox-imap-host").value, String(one(page, "mailbox-imap-port").value), one(page, "mailbox-imap-security").value], ["imap.gmail.com", "993", "tls"]);
    assert.deepEqual([one(page, "mailbox-smtp-host").value, String(one(page, "mailbox-smtp-port").value), one(page, "mailbox-smtp-security").value], ["smtp.gmail.com", "587", "starttls"]);
    assert.equal(one(page, "mailbox-account").value, "me@gmail.com");
    const routes = byClass(page, "explain").find((node) => /two ways to connect a mailbox/i.test(explanationText(node)));
    assert.ok(routes && /web API/.test(explanationText(routes)) && /IMAP and SMTP/.test(explanationText(routes)) && !routes.open, "a folded What is this? explains the two routes");
    assert.equal(one(page, "mailbox-folders").value, "INBOX", "INBOX is preset");
    assert.deepEqual(byClass(page, "mailbox-place").filter((box) => box.checked), [], "no place is preset");
    assert.equal(one(page, "mailbox-bridge").value, "lab-pc", "this computer's Bridge is preset");
    await fillImap(p);
    assert.equal(one(page, "mailbox-route").value, "imap", "reports@example.org is on the IMAP route");
    assert.equal(p.imap.logs.logins.length + p.smtp.logs.auths.length, 0, "nothing reached a mail server before Store and test");
    const answer = await storeAndTest(p);
    assert.equal(answer, "✓ Stored and tested through lab-pc.");
    const parts = partsOf(p);
    for (const part of ["✓ INBOX: 4 mails", "✓ Reports: 2 mails", "✓ Drafts folder found", "✓ Sent folder found"]) assert.ok(parts.includes(part), `${part} is shown`);
    assert.ok(parts.some((part) => /^✓ Sending works/.test(part)), "sending works is shown");
    assert.ok(parts.some((part) => /^Route: imap · Encryption: \S+/.test(part)), "the route and the encryption are shown");
    const stored = storedMailbox(p);
    assert.deepEqual({ ...stored, imap: { ...stored.imap, imap: { ...stored.imap.imap, port: 0 }, smtp: { ...stored.imap.smtp, port: 0 } } }, {
      address: ACCOUNT, route: "imap", folders: ["INBOX", "Reports"], places: [{ place: "this machine", outsideEu: false }],
      imap: { bridge: "lab-pc", jumpHostNoted: false, imap: { host: "127.0.0.1", port: 0, security: "starttls" }, smtp: { host: "127.0.0.1", port: 0, security: "starttls" }, account: ACCOUNT, password: PASSWORD },
    });
    assert.deepEqual(p.writes, [], "no cookie is written");
    assert.ok(!String(globalThis.location.hash).includes(PASSWORD), "the address holds no password");
    const imapLines = p.imap.logs.commands.map((command) => command.line);
    assert.ok(p.imap.logs.logins.length > 0 && p.imap.logs.logins.every((login) => login.secure && login.password === PASSWORD), "known positive: the Bridge logged in, after TLS only");
    assert.ok(imapLines.some((line) => /\bEXAMINE INBOX\b/.test(line)) && imapLines.some((line) => /\bEXAMINE Reports\b/.test(line)), "known positive: each folder was opened read-only");
    assert.deepEqual(imapLines.filter((line) => WRITES.test(line)), [], "no command changed the mailbox");
    assert.ok(p.smtp.logs.auths.length > 0 && p.smtp.logs.auths.every((auth) => auth.secure), "the SMTP login came after TLS");
    assert.deepEqual(p.smtp.logs.commands.filter((command) => /^(MAIL|RCPT|DATA)\b/i.test(command.line)), [], "nothing was sent");
    const withPassword = p.requests.filter((request) => carries(request, PASSWORD));
    assert.ok(withPassword.length > 0, "known positive: the password left the browser once");
    assert.deepEqual([...new Set(withPassword.map((request) => request.origin))], [p.bridge.address], "the password went to the Bridge lab-pc only");
    assert.match(lineOf(p), /Connected: reports@example\.org · IMAP through lab-pc · folders INBOX, Reports · processing places this machine/);
    assert.ok(byClass(p.main(), "mailbox-disconnect").length === 1, "Disconnect is offered");
    await p.stop();
    stopped = true;
    other = await openDashboard({ bridges: [] });
    await waitFor(() => byClass(other.main(), "mailbox-setting-open").length === 1, "Settings in the other browser");
    assert.match(textOf(other.main()), /Mailbox: not set/, "another browser shows no mailbox");
    assert.equal(storedMailbox(other), null);
  } finally {
    if (!stopped) await p.stop();
    await other?.stop();
  }
});

// TST-433702 · level: system · module: MOD-settings-pages · MOD-mail-routes · MOD-browser-store
// guards: UC-037; AN API MAILBOX IS OPENED BY THE PROVIDER'S SIGN-IN; A MAILBOX IS REACHED THROUGH ITS PROVIDER'S WEB API OR THROUGH THE BRIDGE; READING THE MAILBOX CHANGES NOTHING IN IT
// given: the instance at https://alice.github.io/agent-m/; Microsoft's sign-in service knows the domain contoso-uni.example; Microsoft Graph holds 7 mails in the inbox and 2 in Receipts, Drafts and Sent Items
// input: Connect a mailbox; reports@contoso-uni.example typed; the return address copied; the client identifier entered; Sign in with Microsoft; folders "INBOX, Receipts"; Store and test
// expect: the web-API route is preselected, naming Microsoft 365; Microsoft's page for a new app registration is linked, with the name Agent M, the kind single-page application and the return address https://alice.github.io/agent-m/, which Copy puts on the clipboard; a folded explanation names the administrators; before Microsoft's window opens the page names Mail.ReadWrite, Mail.Send and offline_access, and the window is asked for exactly these; "✓ Stored and tested through Microsoft Graph" with INBOX: 7 mails, Receipts: 2 mails, Drafts and Sent found and sending works; the connection stores the route graph, the client identifier and the account and no password; every request to Graph is a GET; no request went to a Bridge; the mailbox is shown connected on the web API (flow: UC-037 main flow, steps 1, 2, 3, 5, 7 and 8, on the web-API route)
test("main flow on the web-API route: the app registration's steps, the permissions named before Microsoft's window, Store and test through Microsoft Graph", async () => {
  const p = await openDashboard();
  try {
    const page = await connectAMailbox(p);
    await put(one(page, "mailbox-address"), MS_ADDRESS);
    assert.equal(one(page, "mailbox-route").value, "graph");
    assert.match(textOf(one(page, "mailbox-route-reason")), /Microsoft 365/);
    assert.equal(one(page, "mailbox-app-registration-link").getAttribute("href"), "https://entra.microsoft.com");
    const steps = textOf(one(page, "mailbox-app-registration-steps"));
    assert.match(steps, /Agent M/);
    assert.match(steps, /single-page application/);
    assert.equal(textOf(one(page, "mailbox-return-address")), "https://alice.github.io/agent-m/");
    await press(one(page, "mailbox-return-address-copy"));
    assert.deepEqual(p.clipboard, ["https://alice.github.io/agent-m/"]);
    assert.ok(byClass(page, "explain").some((node) => /administrators/.test(explanationText(node)) && !node.open), "a folded explanation says whom to ask");
    const said = await signInWithMicrosoft(p);
    assert.match(said, /Signed in as reports@contoso-uni\.example/);
    assert.deepEqual(p.signIn.seen.logins.map((login) => login.scopes), [SCOPES], "Microsoft's window is asked for exactly the three permissions");
    for (const scope of SCOPES) assert.ok(p.signIn.seen.pageAtLogin[0].includes(scope), `${scope} is named before the window opens`);
    await put(one(page, "mailbox-folders"), "INBOX, Receipts");
    assert.equal(await storeAndTest(p), "✓ Stored and tested through Microsoft Graph.");
    const parts = partsOf(p);
    for (const part of ["✓ INBOX: 7 mails", "✓ Receipts: 2 mails", "✓ Drafts folder found", "✓ Sent folder found"]) assert.ok(parts.includes(part), `${part} is shown`);
    assert.ok(parts.some((part) => /^✓ Sending works/.test(part)));
    assert.deepEqual(storedMailbox(p), { address: MS_ADDRESS, route: "graph", folders: ["INBOX", "Receipts"], places: [], graph: { clientId: CLIENT, account: MS_ADDRESS } });
    assert.ok(p.graph.requests.length >= 4, "known positive: Graph was asked");
    assert.deepEqual(p.graph.requests.filter((request) => request.method !== "GET"), [], "Graph is only read");
    assert.deepEqual(p.requests.filter((request) => request.origin === p.bridge.address || request.origin === JUMP), [], "no request went to a Bridge");
    assert.match(lineOf(p), /reports@contoso-uni\.example · Microsoft 365 \(web API\) · folders INBOX, Receipts/);
  } finally { await p.stop(); }
});

// TST-433703 · level: system · module: MOD-settings-pages · MOD-mail-routes
// guards: UC-037
// given: the web-API route for reports@contoso-uni.example; Microsoft refuses the app registration (AADSTS700016: the application is not found in the directory)
// input: Sign in with Microsoft; then Connect over IMAP meanwhile
// expect: the page names what to ask the administrators for — a single-page application named Agent M, the return address https://alice.github.io/agent-m/ and the permissions Mail.ReadWrite, Mail.Send and offline_access —, says the IMAP route can serve meanwhile and offers it; nothing is stored; the offer switches the form to the IMAP route (flow: UC-037 alternative 2a)
test("alternative 2a: a refused app registration names what to ask the administrators for and offers the IMAP route meanwhile", async () => {
  const p = await openDashboard({ fragment: "#mailbox", signIn: { login: SIGN_IN.registrationRefused } });
  try {
    await waitFor(() => byClass(p.main(), "mailbox-store-test").length === 1, "the page");
    const said = await signInWithMicrosoft(p);
    assert.match(said, /administrators/);
    assert.match(said, /single-page application/);
    assert.match(said, /Agent M/);
    assert.ok(said.includes("https://alice.github.io/agent-m/"), "the return address is named");
    for (const scope of SCOPES) assert.ok(said.includes(scope), `${scope} is named`);
    assert.match(said, /IMAP/);
    const offer = one(p.main(), "mailbox-use-imap");
    assert.equal(offer.hidden, false, "the IMAP route is offered");
    assert.equal(storedMailbox(p), null, "nothing is stored");
    await press(offer);
    assert.equal(one(p.main(), "mailbox-route").value, "imap");
  } finally { await p.stop(); }
});

// TST-433704 · level: system · module: MOD-settings-pages · MOD-mail-routes
// guards: UC-037; AN API MAILBOX IS OPENED BY THE PROVIDER'S SIGN-IN
// given: the web-API route for reports@contoso-uni.example; in Microsoft's window the person declines the permission Mail.Send
// input: Sign in with Microsoft; then Store and test
// expect: the page says the permission Mail.Send was not granted and that without it replies cannot be sent; nothing was stored — Store and test asks to sign in first, and localStorage holds no mailbox (flow: UC-037 alternative 3a)
test("alternative 3a: a declined permission is named with what would not work, and nothing is stored", async () => {
  const p = await openDashboard({ fragment: "#mailbox", signIn: { login: SIGN_IN.declined("Mail.Send") } });
  try {
    await waitFor(() => byClass(p.main(), "mailbox-store-test").length === 1, "the page");
    const said = await signInWithMicrosoft(p);
    assert.match(said, /Mail\.Send was not granted/);
    assert.match(said, /replies cannot be sent/);
    assert.match(said, /Nothing was stored/);
    assert.equal(storedMailbox(p), null);
    assert.match(await storeAndTest(p), /Sign in with Microsoft first\. Nothing was stored/);
    assert.equal(storedMailbox(p), null, "nothing is stored");
  } finally { await p.stop(); }
});

// TST-433705 · level: system · module: MOD-settings-pages · MOD-mail-routes · MOD-browser-store
// guards: UC-037
// given: a connection on the web-API route stored and tested; then the sign-in kept in this browser expires
// input: Test on the connected mailbox; Sign in with Microsoft, which the page offers; Test again
// expect: the Test says the sign-in has expired and offers Sign in with Microsoft; the connection stays stored, shown as untested; the sign-in opens Microsoft's window for the stored client identifier and address; afterwards the connection is the one stored before — address, folders, places and client identifier unchanged —, and the next Test works through Graph (flow: UC-037 alternative 3b)
test("alternative 3b: an expired sign-in is asked again in Microsoft's window at the next use, and nothing else changes", async () => {
  const p = await openDashboard();
  try {
    await connectAMailbox(p);
    await signInWithMicrosoft(p);
    assert.match(await storeAndTest(p), /✓ Stored and tested/);
    const before = storedMailbox(p);
    p.signIn.state.expired = true;
    await press(one(p.main(), "mailbox-test"));
    await waitFor(() => /expired/.test(textOf(one(p.main(), "mailbox-line-result"))), "the expired sign-in");
    assert.match(textOf(one(p.main(), "mailbox-line-result")), /sign in with Microsoft again/i);
    assert.deepEqual(storedMailbox(p), before, "the connection stays stored");
    assert.match(lineOf(p), /untested/);
    const logins = p.signIn.seen.logins.length;
    await press(one(p.main(), "mailbox-renew"));
    await waitFor(() => /Signed in/.test(textOf(one(p.main(), "mailbox-line-result"))), "the renewed sign-in");
    assert.equal(p.signIn.seen.logins.length, logins + 1, "Microsoft's window was opened once more");
    assert.equal(p.signIn.seen.configs.at(-1).auth.clientId, CLIENT);
    assert.equal(p.signIn.seen.logins.at(-1).loginHint, MS_ADDRESS);
    assert.deepEqual(storedMailbox(p), before, "nothing else changed");
    await press(one(p.main(), "mailbox-test"));
    await waitFor(() => /✓ Tested/.test(textOf(one(p.main(), "mailbox-line-result"))), "the test after signing in");
    assert.match(lineOf(p), /Connected:/);
  } finally { await p.stop(); }
});

// TST-433706 · level: system · module: MOD-settings-pages · MOD-browser-store
// guards: UC-037; THE MAILBOX PASSWORD IS STORED ONLY AFTER ITS OWN DISCLOSURE
// given: the IMAP route on the page Connect a mailbox, every other field filled in
// input: the notice not ticked; Store and test
// expect: the notice names alice.github.io, the sites of alice, reading all mail and sending in its name, the Bridge as the only server, and an owner used for nothing else; the password field stays disabled; Store and test says to read the notice and that nothing was stored; localStorage holds no mailbox and no password; no request reached the Bridge or a mail server (flow: UC-037 alternative 4a)
test("alternative 4a: without the notice ticked the password field stays disabled and nothing is stored", async () => {
  const p = await openDashboard();
  try {
    await connectAMailbox(p);
    await fillImap(p, { tickNotice: false });
    const notice = textOf(one(p.main(), "mailbox-password-notice"));
    for (const words of ["stored in this browser", "alice.github.io", "the sites of alice", "read all mail", "send mail in its name", "no server except the Bridge", "owner you use for nothing else"]) assert.ok(notice.includes(words), `the notice says ${words}`);
    assert.equal(one(p.main(), "mailbox-password").disabled, true, "the password field stays disabled");
    assert.match(await storeAndTest(p), /Read the notice.*Nothing was stored/);
    assert.equal(storedMailbox(p), null);
    assert.ok(!storageText(p).includes(PASSWORD));
    assert.deepEqual(p.requests.filter((request) => request.origin === p.bridge.address), [], "nothing reached the Bridge");
    assert.equal(p.imap.logs.commands.length + p.smtp.logs.commands.length, 0, "nothing reached a mail server");
  } finally { await p.stop(); }
});

// TST-433707 · level: system · module: MOD-settings-pages · MOD-bridge-client · MOD-mail-protocols
// guards: UC-037; A MAILBOX THROUGH THE JUMP HOST IS NAMED AS READABLE THERE; A MAILBOX IS REACHED THROUGH ITS PROVIDER'S WEB API OR THROUGH THE BRIDGE
// given: the IMAP route filled in; the Bridges lab-pc (loopback) and gpu-box (through the jump host https://jump.example.test)
// input: gpu-box chosen and its notice not ticked, Store and test; lab-pc chosen, Store and test; gpu-box chosen again, its notice ticked, Store and test
// expect: for gpu-box the page states that the password and the mails pass the jump host and that whoever administers it can read them; unticked, nothing is stored and nothing reaches a Bridge; with lab-pc no such notice is shown and the connection is stored with jumpHostNoted false; with gpu-box ticked the connection is stored naming gpu-box with jumpHostNoted true, and its test went to the jump host's address of gpu-box and to no other Bridge (flow: UC-037 alternative 4b and main flow step 4.4)
test("alternative 4b: without the jump host's notice ticked nothing is stored, and another Bridge may be chosen", async () => {
  const p = await openDashboard();
  try {
    await connectAMailbox(p);
    await fillImap(p, { bridge: "gpu-box" });
    assert.equal(one(p.main(), "mailbox-jump-notice").hidden, false, "the jump host's notice is shown");
    assert.match(textOf(one(p.main(), "mailbox-jump-notice")), /pass the jump host.*administers the jump host can read them/);
    assert.match(await storeAndTest(p), /jump host.*Nothing was stored/);
    assert.equal(storedMailbox(p), null);
    assert.deepEqual(p.requests.filter((request) => request.origin === JUMP || request.origin === p.bridge.address), [], "nothing reached a Bridge");
    await put(one(p.main(), "mailbox-bridge"), "lab-pc");
    assert.equal(one(p.main(), "mailbox-jump-notice").hidden, true, "no notice for this computer's Bridge");
    assert.match(await storeAndTest(p), /✓ Stored and tested through lab-pc/);
    assert.equal(storedMailbox(p).imap.jumpHostNoted, false);
    const before = p.requests.length;
    await put(one(p.main(), "mailbox-bridge"), "gpu-box");
    await tick(one(p.main(), "mailbox-jump-notice-read"));
    assert.match(await storeAndTest(p), /✓ Stored and tested through gpu-box/);
    assert.deepEqual([storedMailbox(p).imap.bridge, storedMailbox(p).imap.jumpHostNoted], ["gpu-box", true]);
    const sent = p.requests.slice(before).filter((request) => carries(request, PASSWORD));
    assert.ok(sent.length > 0 && sent.every((request) => request.address.startsWith(`${JUMP}/bridge/gpu-box/`)), "the test went to gpu-box through the jump host only");
  } finally { await p.stop(); }
});

// TST-433708 · level: system · module: MOD-settings-pages · MOD-browser-store
// guards: UC-037; A PLACE OUTSIDE THE EU IS NAMED AS NOT COMPLIANT; THE PLACES A MAILBOX'S MAIL MAY GO ARE CONFIGURED
// given: the IMAP route filled in, with a provider in the USA ticked besides this machine; later, the connected mailbox
// input: Store and test with the notice not ticked; the notice ticked, Store and test; then Processing places on the connected mailbox: FAU data centre (EU) ticked and a provider in the USA unticked, Save places; then a provider in the USA ticked again, Save places without and with the notice
// expect: the page states before saving that processing personal data there does not comply with the GDPR and the EU AI Act and that the connection records it; unticked nothing is stored; ticked, the connection records the place outside the EU with notCompliantNoted; Processing places shows the same list of places, saves the changed places and says a mail already handed on is not recalled; the place outside the EU, ticked again after it was dropped, is recorded only after the same notice is read (flow: UC-037 alternative 6a, and main flow step 6)
test("step 6 and alternative 6a: a place outside the EU is named as not compliant before saving, and the places are changed later with the same list and notice", async () => {
  const p = await openDashboard();
  try {
    await connectAMailbox(p);
    await fillImap(p, { places: ["this machine", "a provider in the USA"] });
    const notice = one(p.main(), "mailbox-place-notice");
    assert.equal(notice.hidden, false);
    assert.match(textOf(notice), /does not comply with the EU's rules — the GDPR for transferring personal data, and the EU AI Act\. You can still allow it; this connection will record that you did\./);
    assert.match(await storeAndTest(p), /outside the EU.*Nothing was stored/);
    assert.equal(storedMailbox(p), null);
    await tick(one(p.main(), "mailbox-place-notice-read"));
    assert.match(await storeAndTest(p), /✓ Stored and tested/);
    assert.deepEqual(storedMailbox(p).places, [{ place: "this machine", outsideEu: false }, { place: "a provider in the USA", outsideEu: true, notCompliantNoted: true }]);
    await press(one(p.main(), "mailbox-places-change"));
    await waitFor(() => byClass(p.main(), "mailbox-line-place").length > 0, "Processing places");
    const boxes = () => byClass(p.main(), "mailbox-line-place");
    assert.deepEqual(boxes().map((box) => box.getAttribute("data-place")), ["this machine", "FAU data centre (EU)", "a provider in the USA"], "the same list of places");
    for (const box of boxes()) await tick(box, ["this machine", "FAU data centre (EU)"].includes(box.getAttribute("data-place")));
    await press(one(p.main(), "mailbox-places-save"));
    assert.match(textOf(one(p.main(), "mailbox-line-result")), /not recalled/);
    assert.deepEqual(storedMailbox(p).places, [{ place: "this machine", outsideEu: false }, { place: "FAU data centre (EU)", outsideEu: false }]);
    await press(one(p.main(), "mailbox-places-change"));
    await waitFor(() => boxes().length > 0, "Processing places again");
    for (const box of boxes()) await tick(box, box.getAttribute("data-place") !== "this machine");
    assert.match(textOf(one(p.main(), "mailbox-line-place-notice")), /does not comply with the EU's rules/);
    await press(one(p.main(), "mailbox-places-save"));
    assert.match(textOf(one(p.main(), "mailbox-line-result")), /outside the EU.*Nothing was changed/);
    assert.deepEqual(storedMailbox(p).places.map((each) => each.place), ["this machine", "FAU data centre (EU)"]);
    await tick(one(p.main(), "mailbox-line-place-notice-read"));
    await press(one(p.main(), "mailbox-places-save"));
    assert.deepEqual(storedMailbox(p).places, [{ place: "FAU data centre (EU)", outsideEu: false }, { place: "a provider in the USA", outsideEu: true, notCompliantNoted: true }]);
  } finally { await p.stop(); }
});

// TST-433709 · level: system · module: MOD-settings-pages · MOD-bridge-client
// guards: UC-037; A MAILBOX IS REACHED THROUGH ITS PROVIDER'S WEB API OR THROUGH THE BRIDGE
// given: the IMAP route filled in; the Bridge gone, stored at a loopback address where nothing listens, and the Bridge wrong-token, the composed Bridge stored with a token it never issued
// input: gone chosen, Store and test; Set up a Bridge; wrong-token chosen, Store and test
// expect: for gone the page names the Bridge and the reason — not running or a wrong address —, says the connection is stored and shown as untested, and offers Set up a Bridge, which opens the page of the Bridges (UC-011); for wrong-token it names the refused token; each time the connection is stored and the mailbox shown as untested; no mail server was reached (flow: UC-037 alternative 7a)
test("alternative 7a: a Bridge that does not answer is named with the reason, linked to setting up a Bridge, and the connection is stored untested", async () => {
  const p = await openDashboard({ bridges: ["lab-pc", "gone", "wrong-token"] });
  try {
    await connectAMailbox(p);
    await fillImap(p, { bridge: "gone" });
    const said = await storeAndTest(p);
    assert.match(said, /The Bridge gone did not answer/);
    assert.match(said, /not running/);
    assert.match(said, /wrong address/);
    assert.match(said, /stored and shown as untested/);
    assert.equal(storedMailbox(p)?.imap.bridge, "gone", "the connection is stored");
    assert.match(lineOf(p), /untested/);
    const setup = one(p.main(), "mailbox-bridge-setup");
    assert.equal(setup.hidden, false, "Set up a Bridge is offered");
    await put(one(p.main(), "mailbox-bridge"), "wrong-token");
    const refused = await storeAndTest(p);
    assert.match(refused, /The Bridge wrong-token did not answer/);
    assert.match(refused, /token/);
    assert.equal(storedMailbox(p)?.imap.bridge, "wrong-token");
    assert.match(lineOf(p), /untested/);
    assert.equal(p.imap.logs.commands.length + p.smtp.logs.commands.length, 0, "no mail server was reached");
    await press(one(p.main(), "mailbox-bridge-setup"));
    assert.match(globalThis.location.hash, /^#bridge/, "Set up a Bridge opens the page of the Bridges");
  } finally { await p.stop(); }
});

// TST-433710 · level: system · module: MOD-settings-pages · MOD-mail-protocols · MOD-bridge-client
// guards: UC-037; THE MAIL SERVER IS REACHED ONLY OVER TLS
// given: an IMAP server at 127.0.0.1 that offers no STARTTLS; the SMTP server at localhost; the connection through lab-pc with STARTTLS for both
// input: Store and test; then the IMAP encryption set to none, Store and test
// expect: each time the page names the server 127.0.0.1, says the Bridge sent no login to it and that the password would travel in clear text, and asks to correct the port or encryption; the IMAP server saw no LOGIN or AUTHENTICATE and the SMTP server no AUTH; the connection is stored and shown as untested (flow: UC-037 alternative 7b)
test("alternative 7b: a server that offers no encryption gets no login, and the page names it", async () => {
  const p = await openDashboard({ imap: { startTls: false } });
  try {
    await connectAMailbox(p);
    await fillImap(p, { smtpHost: "localhost" });
    for (const security of ["starttls", "none"]) {
      await put(one(p.main(), "mailbox-imap-security"), security);
      const said = await storeAndTest(p);
      assert.match(said, /^✗ 127\.0\.0\.1 offers no encryption\./, `${security}: the server is named`);
      assert.match(said, /sent no login/);
      assert.match(said, /clear text/);
      assert.match(said, /port or the encryption/);
    }
    assert.ok(p.imap.logs.commands.length > 0, "known positive: the Bridge spoke to the IMAP server");
    assert.deepEqual(p.imap.logs.commands.filter((command) => /\b(LOGIN|AUTHENTICATE)\b/i.test(command.line)), [], "no login was sent to the IMAP server");
    assert.deepEqual(p.smtp.logs.auths, [], "no login was sent to the SMTP server");
    assert.match(lineOf(p), /untested/);
  } finally { await p.stop(); }
});

// TST-433711 · level: system · module: MOD-settings-pages · MOD-mail-protocols
// guards: UC-037
// given: the IMAP route filled in with a password the IMAP server refuses
// input: Store and test
// expect: the page shows the server's answer (AUTHENTICATIONFAILED, Invalid credentials) and a folded explanation that some providers require an app password instead of the account password when two-factor login is on; the connection is stored and shown as untested (flow: UC-037 alternative 7c)
test("alternative 7c: a refused login shows the server's answer and explains the app password", async () => {
  const p = await openDashboard();
  try {
    await connectAMailbox(p);
    await fillImap(p, { password: "not-the-password-433" });
    const said = await storeAndTest(p);
    assert.match(said, /refused the login/);
    assert.match(said, /Invalid credentials|AUTHENTICATIONFAILED/);
    const explained = byClass(one(p.main(), "mailbox-result-explanation"), "explain");
    assert.equal(explained.length, 1, "a folded explanation is added");
    assert.match(explanationText(explained[0]), /some providers require an app password instead of the account password when two-factor login is on/);
    assert.ok(!explained[0].open, "it is folded");
    assert.match(lineOf(p), /untested/);
  } finally { await p.stop(); }
});

// TST-433712 · level: system · module: MOD-settings-pages · MOD-mail-routes
// guards: UC-037
// given: the web-API route; the person's sign-in grants Mail.ReadWrite and offline_access but not Mail.Send
// input: Sign in with Microsoft; Store and test
// expect: the reading is shown — INBOX: 7 mails, Drafts and Sent found — and, separately, that sending does not work; the page says reading mails (UC-038) works and sending replies (UC-039) does not (flow: UC-037 alternative 7d, on the web-API route)
test("alternative 7d on the web-API route: reading and sending are shown separately", async () => {
  const p = await openDashboard({ signIn: { granted: ["Mail.ReadWrite", "offline_access"] } });
  try {
    await connectAMailbox(p);
    await signInWithMicrosoft(p);
    const said = await storeAndTest(p);
    assert.match(said, /Reading is possible, sending is not/);
    assert.match(said, /UC-038/);
    assert.match(said, /UC-039/);
    const parts = partsOf(p);
    assert.ok(parts.includes("✓ INBOX: 7 mails"), "the reading is shown");
    assert.ok(parts.some((part) => /^✗ Sending does not work/.test(part)), "sending is shown separately");
  } finally { await p.stop(); }
});

// TST-433713 · level: system · module: MOD-settings-pages · MOD-mail-protocols · MOD-mail-routes
// guards: UC-037
// given: the IMAP route through lab-pc; the IMAP server accepts the password, the SMTP server refuses every login
// input: Store and test
// expect: UC-037 7d: "Agent M shows both results separately; reading (UC-038) is possible, sending (UC-039) is not": the reading is shown — INBOX: 4 mails and Reports: 2 mails — and, separately, that sending does not work. FINDING UC037-7d-imap: the Bridge's test (MOD-mail-protocols' testMailbox) throws on the SMTP server's refusal, so the page shows only "the mail server refused the login" and no reading; MOD-mail-routes' interface gives `sending: "works" | string` for this (flow: UC-037 alternative 7d, on the IMAP route)
test("alternative 7d on the IMAP route: reading and sending are shown separately",
  async () => {
  const p = await openDashboard({ smtp: { refuseAuth: true } });
  try {
    await connectAMailbox(p);
    await fillImap(p);
    const said = await storeAndTest(p);
    assert.ok(p.smtp.logs.auths.length > 0, "known positive: the SMTP server refused a login");
    const parts = partsOf(p);
    assert.ok(parts.includes("✓ INBOX: 4 mails") && parts.includes("✓ Reports: 2 mails"), `the reading is shown (the page said: ${said})`);
    assert.ok(parts.some((part) => /^✗ Sending does not work/.test(part)), "sending is shown separately");
    assert.match(said, /Reading is possible, sending is not/);
  } finally { await p.stop(); }
});

// TST-433714 · level: system · module: MOD-settings-pages · MOD-maintenance-pages
// guards: UC-037
// given: the web-API route stored and tested with a sign-in that does not grant Mail.Send, so that the test showed sending does not work
// input: the page where replies are sent (the route replies of the main page) opened
// expect: UC-037 7d: "the dashboard says so where a reply would be sent": the page of replies says that sending does not work for this mailbox. FINDING UC037-7d-replies: the result of the mailbox's test keeps no record that sending failed (`last-test:mailbox` holds the outcome working), and the page of replies says nothing about it (flow: UC-037 alternative 7d)
test("alternative 7d: the dashboard says where a reply would be sent that sending does not work", async () => {
  const p = await openDashboard({ signIn: { granted: ["Mail.ReadWrite", "offline_access"] }, views: [settingsView, maintenanceView] });
  try {
    await connectAMailbox(p);
    await signInWithMicrosoft(p);
    assert.match(await storeAndTest(p), /sending is not/, "known positive: the test found sending not working");
    await hashTo("#replies");
    await waitFor(() => byClass(p.main(), "read-replies").length === 1, "the page of replies");
    assert.match(textOf(p.main()), /send(ing)?[^.]*(does not|cannot|not) work|cannot be sent|Mail\.Send/i, "the page of replies says sending does not work");
  } finally { await p.stop(); }
});

// TST-433715 · level: system · module: MOD-settings-pages · MOD-browser-store
// guards: UC-037; A CLEAR IS A REAL CLEAR
// given: a connection on the IMAP route stored and tested; then, in a browser of its own, a connection on the web-API route stored and tested, whose sign-in wrote the library's cache keys
// input: Disconnect, confirmed once, on each
// expect: one confirmation is asked, naming the password or the sign-in token; afterwards localStorage holds no mailbox entry, no record of its test, no password, and on the web-API route no sign-in token, refresh token or cache key of the client; the page says nothing is stored and that issues and their mail identifiers are not touched; on the web-API route it links Microsoft's page where the app's access is withdrawn; nothing was written to a repository (flow: UC-037 alternative 8a)
test("alternative 8a: Disconnect asks once and removes the connection with its password or sign-in token from localStorage", async () => {
  for (const route of ["imap", "graph"]) {
    const p = await openDashboard();
    try {
      await connectAMailbox(p);
      if (route === "imap") await fillImap(p); else await signInWithMicrosoft(p);
      assert.match(await storeAndTest(p), /✓ Stored and tested/);
      const secret = route === "imap" ? PASSWORD : GRAPH_TOKEN;
      assert.ok(storageText(p).includes(secret), `known positive: the ${route} secret is stored`);
      await press(one(p.main(), "mailbox-disconnect"));
      assert.equal(p.confirms.length, 1, "one confirmation");
      assert.match(p.confirms[0], route === "imap" ? /password/ : /sign-in token/);
      const kept = storageText(p);
      for (const gone of [secret, REFRESH_TOKEN, "agent-m:alice/agent-m:mailbox=", "last-test:mailbox", `msal.3.token.keys.${CLIENT}`]) assert.ok(!kept.includes(gone), `${route}: ${gone} is removed`);
      const said = textOf(one(p.main(), "mailbox-disconnected"));
      assert.match(said, /Nothing is stored/);
      assert.match(said, /Issues and their mail identifiers are not touched/);
      if (route === "graph") assert.equal(one(p.main(), "mailbox-withdrawal-link").getAttribute("href"), "https://myapps.microsoft.com");
      assert.deepEqual(p.requests.filter((request) => request.origin === "https://api.github.com" && request.method !== "GET"), [], "nothing was written to a repository");
    } finally { await p.stop(); }
  }
});

// TST-433716 · level: system · module: MOD-settings-pages · MOD-browser-store · MOD-mail-routes · MOD-bridge-client
// guards: UC-037
// given: browser A with a connection on the IMAP route through lab-pc, stored and tested, and the settings file exported from it; browser B of the same instance, with no mailbox; then the same for the web-API route, whose sign-in has expired by the time browser B uses it
// input: in browser B, Settings → Import settings with A's file; Test on the mailbox; on the web-API route Sign in with Microsoft, then Test
// expect: before the import browser B shows no mailbox; the import adds the mailbox and, on the web-API route, the sign-in; the mailbox is shown with its address and route, the password or the sign-in token included in B's localStorage; on the IMAP route Test works through lab-pc with the imported password; on the web-API route Test says the sign-in has expired and offers Sign in with Microsoft, after which Test works (flow: UC-037 alternative 1a, and 3b)
test("alternative 1a: another browser has no mailbox until Import settings brings the whole connection, and an expired sign-in is renewed by signing in once more", async () => {
  for (const route of ["imap", "graph"]) {
    const a = await openDashboard();
    let b = null;
    try {
      await connectAMailbox(a);
      if (route === "imap") await fillImap(a); else await signInWithMicrosoft(a);
      assert.match(await storeAndTest(a), /✓ Stored and tested/);
      const file = await exportSettings(a.store);
      b = await openDashboard({ bridge: a.bridge, bridges: [], signIn: { expired: route === "graph" } });
      await waitFor(() => byClass(b.main(), "mailbox-setting-open").length === 1, "Settings in browser B");
      assert.match(textOf(b.main()), /Mailbox: not set/, "browser B shows no mailbox before the import");
      const said = await importSettingsFile(b, file);
      assert.match(said, /Added: .*mailbox/);
      await hashTo("#mailbox");
      await waitFor(() => byClass(b.main(), "mailbox-test").length === 1, "the connected mailbox in browser B");
      assert.match(lineOf(b), route === "imap" ? /reports@example\.org · IMAP through lab-pc/ : /reports@contoso-uni\.example · Microsoft 365/, "the imported mailbox is shown");
      assert.ok(storageText(b).includes(route === "imap" ? PASSWORD : GRAPH_TOKEN), "the password or the sign-in token came along");
      if (route === "graph") {
        await press(one(b.main(), "mailbox-test"));
        await waitFor(() => /expired/.test(textOf(one(b.main(), "mailbox-line-result"))), "the expired sign-in");
        await press(one(b.main(), "mailbox-renew"));
        await waitFor(() => /Signed in/.test(textOf(one(b.main(), "mailbox-line-result"))), "the renewed sign-in");
      }
      await press(one(b.main(), "mailbox-test"));
      await waitFor(() => /✓ Tested|✗/.test(textOf(one(b.main(), "mailbox-line-result"))), "the test in browser B");
      assert.match(textOf(one(b.main(), "mailbox-line-result")), route === "imap" ? /✓ Tested\. INBOX: 4 mails/ : /✓ Tested\. INBOX: 7 mails/);
    } finally {
      await b?.stop();
      await a.stop();
    }
  }
});
