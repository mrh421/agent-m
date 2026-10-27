// MOD-settings-pages' route `mailbox` (UC-037 steps 1 to 8): the address and the route routeFor preselects; for the IMAP route the servers, the password behind its notice
// and the Bridge the connection goes through; for the Microsoft route the app registration's steps, the client identifier and Sign in with Microsoft; the folders, the
// processing places, and Store and test; and the connected mailbox (mailboxLine, also on the Settings page): its route, folders and places, Test, Disconnect and the places changed later (ITM-429).
//
// Module: MOD-settings-pages
//
// Where the texts leave a reading open, this file states the one it takes:
//   - "This computer's" Bridge is one reached on the loopback (MOD-bridge-client's handle route `loopback`): it is preset.
//   - The usual encryption for a port is that of UC-037 step 4.1: IMAP 993 TLS; SMTP 587 STARTTLS and 465 TLS. Another port presets nothing.
//   - A place is inside the EU when it is `this machine` (the example connection of MOD-mail-routes gives it outsideEu false) or its words name the EU, the
//     European Union or a member state; any other declared place is outside it.
//   - A Bridge at a port of the jump host is reached through the jump host, whether by its HTTPS address or by the forward: the forward ends on it too.
//   - The return address of the app registration is MOD-identifiers' pagesAddress of the instance. Sign in does not store the connection (the sign-in library keeps its own token
//     cache as it signs in): Store and test stores it — the address, the route, the folders, the places and the client identifier with the account, no password — and is refused
//     while no account is signed in. A declined permission is named with what would not work without it; a refused registration says what to ask the administrators for and
//     offers the IMAP route; an expired sign-in is shown at the use that finds it, with the sign-in offered again, the connection stored and shown as untested.
//   - The connected mailbox is one block, mailboxLine, that this page shows above its form and the Settings page shows in the tab Endpoints & Agents: the same code in both.
//     A connection with no record of a test (`last-test:mailbox`), as an import brings it, is shown as connected and untested. Disconnect asks once, with globalThis.confirm as
//     the Settings page's other Clear controls do, and then clears the setting `mailbox` with the sign-in library's keys for it and the record of its test. Changed places are
//     stored only after the notice of a place outside the EU not yet recorded for this connection has been read; the list is the participants' and the connection's own places.

import { bridgeAt, settingsOf } from "../bridge-client/index.mjs";
import { clearSetting, listSettings, readSetting, writeSetting } from "../browser-store/index.mjs";
import { readRegister } from "../documents/index.mjs";
import { mailbox, providerLinks, routeFor, signIn } from "../mail-routes/index.mjs";
import { pagesAddress } from "../identifiers/index.mjs";
import { participantSchema } from "../participant-list/index.mjs";
import { explain } from "../site-frame/index.mjs";

const SECURITY_OF_PORT = { imap: { 993: "tls" }, smtp: { 587: "starttls", 465: "tls" } };
const MEMBER_STATES = ["Austria", "Belgium", "Bulgaria", "Croatia", "Cyprus", "Czechia", "Czech Republic", "Denmark", "Estonia", "Finland", "France", "Germany",
  "Greece", "Hungary", "Ireland", "Italy", "Latvia", "Lithuania", "Luxembourg", "Malta", "Netherlands", "Poland", "Portugal", "Romania", "Slovakia", "Slovenia",
  "Spain", "Sweden"];
const INSIDE_THE_EU = new RegExp(`\\b(?:EU|European Union|${MEMBER_STATES.join("|")})\\b`, "i");

// Whether a processing place, as a participant declares it, is outside the EU.
export const isOutsideEu = (place) => !(place.trim().toLowerCase() === "this machine" || INSIDE_THE_EU.test(place));

function el(name, className, ...children) {
  const node = document.createElement(name);
  if (className) node.className = className;
  node.append(...children);
  return node;
}
const labelled = (text, ...nodes) => el("p", null, el("label", null, text, " ", ...nodes));

// The Bridges this browser keeps under their names, with how each is reached: { name, entry, settings | null, route, throughJumpHost }.
function bridgesOf(store) {
  const jumpHost = readSetting(store, "jump-host");
  return listSettings(store).filter((info) => info.key.startsWith("bridge:")).map((info) => {
    const name = info.key.slice("bridge:".length);
    const entry = readSetting(store, info.key) ?? {};
    let settings = null, route = null;
    try { settings = settingsOf({ name, ...entry }, jumpHost); route = bridgeAt(settings).route; } catch { /* a Bridge at a port with no jump host stays unreachable */ }
    return { name, entry, settings, route, throughJumpHost: Number.isInteger(entry.port) || route === "jump-host" };
  }).sort((a, b) => a.name.localeCompare(b.name));
}

// The processing places the instance's participants declare, once each, in the order they stand.
async function placesOf(host) {
  const { defaultBranch } = await host.repositoryInfo();
  const text = await (await host.readSnapshot(defaultBranch)).read("docs/participants.md");
  if (text === null || text === undefined) return [];
  const places = readRegister(participantSchema(), "docs/participants.md", text).rows.map(({ cells }) => String(cells["Processing place"] ?? "").trim())
    .filter((place) => place && place !== "—");
  return [...new Set(places)];
}

const SCOPES = ["Mail.ReadWrite", "Mail.Send", "offline_access"];
const WITHOUT = {
  "Mail.ReadWrite": "mails cannot be read and no draft can be created",
  "Mail.Send": "replies cannot be sent; reading mails and creating drafts still work",
  offline_access: "the sign-in is not kept: you sign in again at every use",
};

// What a failed sign-in says, for the page's return address (UC-037 3a, 2a).
function signInFailure(error, returnAddress) {
  if (error?.name === "PermissionDeclined") {
    const explained = WITHOUT[error.permission];
    return `✗ The permission ${error.permission} was not granted${explained ? `: without it ${explained}` : ""}. Nothing was stored.`;
  }
  if (error?.name === "RegistrationRefused") {
    return `✗ Microsoft refused the registration: ${error.message} Your institution may allow app registrations only to its administrators. Ask them to register a single-page application `
      + `named Agent M with the return address ${returnAddress} and the permissions ${SCOPES.join(", ")}. Until it is registered, the IMAP route can serve if your provider also offers IMAP.`;
  }
  return `✗ ${error?.message ?? error}`;
}

// What a failed test through Microsoft Graph says.
const graphFailureText = (error) => (error?.name === "SignInExpired"
  ? "✗ The sign-in has expired: sign in with Microsoft again. The connection is stored and shown as untested."
  : `✗ ${error?.message ?? error} The connection is stored and shown as untested.`);

const failureText = (error, connection) => {
  const bridge = connection.imap.bridge;
  if (error?.name === "BridgeUnavailable") {
    const causes = error.likely?.length ? ` Possible causes: ${error.likely.join(", ")}.` : "";
    return `✗ The Bridge ${bridge} did not answer: ${error.reason}.${causes} The connection is stored and shown as untested.`;
  }
  if (error?.name === "NoEncryption") return `✗ ${error.server} offers no encryption. The Bridge sent no login to it: the password would travel in clear text. Correct the port or the encryption setting.`;
  if (error?.name === "LoginRefused") return `✗ The mail server refused the login: ${error.answer}`;
  if (error?.name === "FolderNotFound") return `✗ The folder ${error.folder} does not exist in this mailbox. Correct the folders.`;
  if (error?.name === "Unreachable") return `✗ The mail server could not be reached: ${error.reason}`;
  return `✗ The mailbox could not be tested: ${error?.message ?? error}`;
};

const PLACE_NOTICE = "Processing personal data there does not comply with the EU's rules — the GDPR for transferring personal data, and the EU AI Act. You can still allow it; this connection will record that you did.";
const placeEntry = (place) => (isOutsideEu(place) ? { place, outsideEu: true, notCompliantNoted: true } : { place, outsideEu: false });

// The connected mailbox of this browser (UC-037 steps 8, 6a, 8a): its address, route, folders and allowed places with its state, Test, Disconnect and Processing places.
// -> { node, refresh } — `refresh` shows the stored connection anew; with none stored the block holds an empty .mailbox-connected and nothing to press.
export function mailboxLine(context, { changed = () => {} } = {}) {
  const store = context.store;
  const node = el("section", "settings-mailbox panel");
  const result = el("p", "mailbox-line-result"), disconnected = el("p", "mailbox-disconnected");
  const text = el("p", "mailbox-connected");
  let renewal = null; // *Sign in with Microsoft*, offered after a Test that found the sign-in expired

  const stateOf = () => {
    const last = readSetting(store, "last-test:mailbox");
    if (last?.outcome === "working") return { connected: true, words: `connected; last successful test ${String(last.at).slice(0, 10)}` };
    return { connected: false, words: last?.outcome === "refused" ? "connected, untested: the last test was refused" : "connected, untested" };
  };

  async function test(stored) {
    result.textContent = "Testing the mailbox…";
    let outcome = "refused", sending;
    try {
      let tested;
      if (stored.route === "graph") tested = await mailbox(stored, null).test();
      else {
        const bridge = bridgesOf(store).find((each) => each.name === stored.imap.bridge);
        if (!bridge?.settings) throw Object.assign(new Error(`${stored.imap.bridge} is not a Bridge this browser keeps, or is reached through a jump host that is not stored.`), { name: "BridgeUnavailable", reason: "no such Bridge" });
        tested = await mailbox(stored, bridgeAt(bridge.settings)).test();
      }
      outcome = "working";
      sending = tested.sending;
      const counts = Object.entries(tested.counts ?? {}).map(([folder, count]) => `${folder}: ${count} mails`).join(" · ");
      result.textContent = `✓ Tested. ${counts}${counts ? " · " : ""}${tested.drafts ? "Drafts found" : "Drafts not found"} · ${tested.sent ? "Sent found" : "Sent not found"} · ${tested.sending === "works" ? "sending works" : `sending does not work: ${tested.sending}`} · route ${tested.route} · ${tested.encryption}`;
    } catch (error) {
      result.textContent = stored.route === "graph" ? graphFailureText(error) : failureText(error, stored);
      renewal = stored.route === "graph" && error?.name === "SignInExpired" ? renewalButton(stored) : null;
    }
    writeSetting(store, "last-test:mailbox", { at: new Date().toISOString(), outcome, ...(sending === undefined ? {} : { sending }) });
    show();
  }

  // *Sign in with Microsoft* after an expired sign-in: the provider's window opens for the stored client identifier and address; the stored connection is written again with the signed-in
  // account and nothing else changed. It tests nothing: the next Test does.
  function renewalButton(stored) {
    const button = el("button", "mailbox-renew btn primary", "Sign in with Microsoft");
    button.addEventListener("click", async () => {
      result.textContent = "Opening Microsoft's sign-in window…";
      try {
        const { account } = await signIn(stored.graph.clientId, stored.address);
        const now = readSetting(store, "mailbox") ?? stored;
        writeSetting(store, "mailbox", { ...now, graph: { ...now.graph, account } });
        renewal = null;
        show();
        result.textContent = `Signed in as ${account}. Press Test.`;
      } catch (error) {
        let returnAddress = "";
        try { returnAddress = pagesAddress(context.instance.repository); } catch { /* none */ }
        result.textContent = signInFailure(error, returnAddress);
      }
    });
    return button;
  }

  async function disconnect(stored) {
    if (typeof globalThis.confirm !== "function" || !globalThis.confirm(`Disconnect the mailbox ${stored.address}? Its ${stored.route === "graph" ? "sign-in token" : "password"} is removed from this browser. Issues and their mail identifiers are not touched.`)) return;
    const graph = stored.route === "graph";
    clearSetting(store, "mailbox");
    clearSetting(store, "last-test:mailbox");
    result.textContent = "";
    disconnected.replaceChildren(`Disconnected. Nothing is stored of this connection in this browser: the ${graph ? "sign-in token" : "password"} is removed too. Issues and their mail identifiers are not touched.`);
    if (graph) {
      const link = el("a", "mailbox-withdrawal-link", "Microsoft's page where the app's access is withdrawn ↗");
      link.setAttribute("href", providerLinks().accessWithdrawal);
      link.setAttribute("target", "_blank"); link.setAttribute("rel", "noopener");
      disconnected.append(" Withdraw the app's access there as well: ", link);
    }
    show();
  }

  async function changePlaces(stored, panel) {
    const ticked = new Set(stored.places.map((each) => each.place));
    const noted = new Set(stored.places.filter((each) => each.notCompliantNoted).map((each) => each.place));
    let offered = [];
    if (context.instance?.host) {
      try { offered = await placesOf(context.instance.host); } catch (error) { panel.replaceChildren(el("p", null, `The participants could not be read (${error?.message ?? error}), so no processing place can be offered.`)); return; }
    }
    const places = [...offered, ...stored.places.map((each) => each.place).filter((place) => !offered.includes(place))];
    const boxes = places.map((place) => {
      const box = el("input", "mailbox-line-place");
      box.type = "checkbox"; box.checked = ticked.has(place); box.setAttribute("data-place", place);
      return box;
    });
    const notice = el("p", "notice mailbox-line-place-notice", PLACE_NOTICE), read = el("input", "mailbox-line-place-notice-read");
    read.type = "checkbox";
    const needsNotice = () => boxes.some((box) => box.checked && isOutsideEu(box.getAttribute("data-place")) && !noted.has(box.getAttribute("data-place")));
    const sync = () => { notice.hidden = read.hidden = !needsNotice(); if (notice.hidden) read.checked = false; };
    for (const box of boxes) box.addEventListener("change", sync);
    sync();
    const save = el("button", "mailbox-places-save btn primary", "Save places");
    save.addEventListener("click", () => {
      if (needsNotice() && !read.checked) { result.textContent = "A place outside the EU is ticked: read the notice and tick I have read this. Nothing was changed."; return; }
      const now = readSetting(store, "mailbox");
      if (!now) { result.textContent = "The mailbox is no longer connected. Nothing was changed."; return; }
      const next = boxes.filter((box) => box.checked).map((box) => box.getAttribute("data-place"))
        .map((place) => now.places?.find((each) => each.place === place) ?? placeEntry(place));
      writeSetting(store, "mailbox", { ...now, places: next });
      result.textContent = "Saved. A mail already handed to a participant is not recalled.";
      show();
    });
    panel.replaceChildren(el("h4", null, "Processing places"), ...boxes.map((box) => el("p", null, el("label", null, box, " ", box.getAttribute("data-place")))),
      notice, el("p", null, el("label", null, read, " I have read this")), el("p", null, save));
  }

  function show() {
    const stored = readSetting(store, "mailbox");
    if (!stored?.imap && !stored?.graph) { text.textContent = ""; node.replaceChildren(text, result, disconnected); changed(); return; }
    const { connected, words } = stateOf();
    const how = stored.graph ? "Microsoft 365 (web API)" : `IMAP through ${stored.imap.bridge}`;
    const places = (stored.places ?? []).length ? stored.places.map((each) => (each.outsideEu ? `${each.place} (outside the EU)` : each.place)).join(", ") : "none: mails are only read, never handed to a participant";
    text.textContent = `${connected ? "Connected: " : ""}${stored.address} · ${how} · folders ${stored.folders.join(", ")} · processing places ${places}${connected ? "" : " · untested"}`;
    disconnected.replaceChildren();
    const testButton = el("button", "mailbox-test btn", "Test"), disconnectButton = el("button", "mailbox-disconnect btn", "Disconnect");
    const placesButton = el("button", "mailbox-places-change btn", "Processing places"), panel = el("div", "mailbox-places-panel");
    testButton.addEventListener("click", () => test(stored));
    disconnectButton.addEventListener("click", () => disconnect(stored));
    placesButton.addEventListener("click", () => changePlaces(readSetting(store, "mailbox") ?? stored, panel));
    node.replaceChildren(el("h3", null, "Mailbox"), text, el("p", "mailbox-state", words), el("p", null, testButton, " ", placesButton, " ", disconnectButton), panel, result, ...(renewal ? [el("p", null, renewal)] : []), disconnected);
    changed();
  }
  show();
  return { node, refresh: show };
}

export const route = {
  name: "mailbox",
  entry: "settings",
  title: "Mailbox",
  async render(target, context) {
    const store = context.store;
    const owner = String(context.instance?.repository ?? "").split("/")[0];
    const address = el("input", "mailbox-address");
    const routeSelect = el("select", "mailbox-route", el("option", null, "imap"), el("option", null, "graph"));
    const reason = el("p", "mailbox-route-reason");
    const imapHost = el("input", "mailbox-imap-host"), imapPort = el("input", "mailbox-imap-port"), imapSecurity = el("select", "mailbox-imap-security");
    const smtpHost = el("input", "mailbox-smtp-host"), smtpPort = el("input", "mailbox-smtp-port"), smtpSecurity = el("select", "mailbox-smtp-security");
    const account = el("input", "mailbox-account");
    const passwordRead = el("input", "mailbox-password-notice-read");
    const password = el("input", "mailbox-password");
    const bridgeSelect = el("select", "mailbox-bridge");
    const jumpNotice = el("p", "notice mailbox-jump-notice", "The password and the mails pass the jump host on their way to this Bridge. Whoever administers the jump host can read them there.");
    const jumpRead = el("input", "mailbox-jump-notice-read");
    const folders = el("input", "mailbox-folders");
    const placesBox = el("div", "mailbox-places");
    const placesResult = el("p", "mailbox-places-result");
    const placeNotice = el("p", "notice mailbox-place-notice", PLACE_NOTICE);
    const placeRead = el("input", "mailbox-place-notice-read");
    const storeTest = el("button", "mailbox-store-test btn primary", "Store and test");
    const result = el("p", "mailbox-result");
    const resultExplanation = el("div", "mailbox-result-explanation");
    const setup = el("button", "mailbox-bridge-setup btn", "Set up a Bridge");
    const parts = el("ul", "mailbox-parts");
    const line = mailboxLine(context);
    const returnAddress = (() => { try { return pagesAddress(context.instance.repository); } catch { return ""; } })();
    const clientId = el("input", "mailbox-client-id");
    clientId.value = ""; clientId.autocomplete = "off"; clientId.spellcheck = false;
    const registrationLink = el("a", "mailbox-app-registration-link", "Open Microsoft's page for a new app registration ↗");
    registrationLink.setAttribute("href", providerLinks().appRegistration);
    registrationLink.setAttribute("target", "_blank"); registrationLink.setAttribute("rel", "noopener");
    const returnShown = el("code", "mailbox-return-address", returnAddress);
    const copyReturn = el("button", "mailbox-return-address-copy btn small", "Copy");
    const copied = el("span", "mailbox-return-address-copied");
    const signInButton = el("button", "mailbox-sign-in btn primary", "Sign in with Microsoft");
    const signInResult = el("p", "mailbox-sign-in-result");
    const useImap = el("button", "mailbox-use-imap btn", "Connect over IMAP meanwhile");
    useImap.hidden = true;
    let signedInAccount = null;
    const imapPart = el("div", "mailbox-imap");
    const graphPart = el("div", "mailbox-graph");
    graphPart.hidden = true;
    imapPart.hidden = false;

    for (const input of [address, imapHost, smtpHost, account, password, folders]) { input.autocomplete = "off"; input.spellcheck = false; }
    for (const select of [imapSecurity, smtpSecurity]) for (const value of ["tls", "starttls", "none"]) select.append(el("option", null, value));
    for (const checkbox of [passwordRead, jumpRead, placeRead]) checkbox.type = "checkbox";
    password.type = "password";
    password.disabled = true;
    address.placeholder = "name@example.org";
    imapPort.value = "993"; imapSecurity.value = "tls"; smtpPort.value = "587"; smtpSecurity.value = "starttls";
    routeSelect.value = "imap";
    folders.value = "INBOX";
    jumpNotice.hidden = true; placeNotice.hidden = true; setup.hidden = true;
    jumpRead.hidden = true; placeRead.hidden = true;

    const showRoute = () => { graphPart.hidden = routeSelect.value !== "graph"; imapPart.hidden = routeSelect.value === "graph"; };
    routeSelect.addEventListener("change", showRoute);
    copyReturn.addEventListener("click", async () => {
      try { await globalThis.navigator.clipboard.writeText(returnAddress); copied.textContent = "Return address copied."; } catch (error) { copied.textContent = `Not copied: ${error?.message ?? error}`; }
    });
    signInButton.addEventListener("click", async () => {
      useImap.hidden = true;
      const id = clientId.value.trim();
      if (!id) { signInResult.textContent = "Enter the app's client identifier first: it comes from the app registration above."; return; }
      signInResult.textContent = "Opening Microsoft's sign-in window…";
      try {
        const { account: signed } = await signIn(id, address.value.trim() || null);
        signedInAccount = signed;
        signInResult.textContent = `Signed in as ${signed}. Press Store and test.`;
      } catch (error) {
        signedInAccount = null;
        signInResult.textContent = signInFailure(error, returnAddress);
        useImap.hidden = error?.name !== "RegistrationRefused";
      }
    });
    useImap.addEventListener("click", () => { routeSelect.value = "imap"; showRoute(); });

    let accountTouched = false;
    const syncAccount = () => { if (!accountTouched) account.value = address.value.trim(); };
    account.addEventListener("change", () => { accountTouched = true; });
    address.addEventListener("change", async () => {
      try {
        const found = await routeFor(address.value);
        routeSelect.value = found.route;
        reason.textContent = found.reason;
        showRoute();
        if (found.servers) {
          imapHost.value = found.servers.imap.host; imapPort.value = String(found.servers.imap.port); imapSecurity.value = found.servers.imap.security;
          smtpHost.value = found.servers.smtp.host; smtpPort.value = String(found.servers.smtp.port); smtpSecurity.value = found.servers.smtp.security;
        }
      } catch (error) { reason.textContent = error?.message ?? String(error); }
      syncAccount();
    });
    imapPort.addEventListener("change", () => { const security = SECURITY_OF_PORT.imap[Number(imapPort.value)]; if (security) imapSecurity.value = security; });
    smtpPort.addEventListener("change", () => { const security = SECURITY_OF_PORT.smtp[Number(smtpPort.value)]; if (security) smtpSecurity.value = security; });
    passwordRead.addEventListener("change", () => { password.disabled = !passwordRead.checked; });

    const bridges = bridgesOf(store);
    bridgeSelect.append(el("option", null, ""), ...bridges.map((bridge) => el("option", null, bridge.name)));
    for (const option of bridgeSelect.childNodes) option.value = option.textContent;
    bridgeSelect.value = bridges.find((bridge) => bridge.route === "loopback")?.name ?? "";
    const chosen = () => bridges.find((bridge) => bridge.name === bridgeSelect.value) ?? null;
    const showJumpNotice = () => { jumpNotice.hidden = !chosen()?.throughJumpHost; jumpRead.hidden = jumpNotice.hidden; jumpRead.checked = false; };
    bridgeSelect.addEventListener("change", showJumpNotice);
    showJumpNotice();

    const placeBoxes = [];
    const showPlaceNotice = () => {
      const outside = placeBoxes.some(({ box, place }) => box.checked && isOutsideEu(place));
      placeNotice.hidden = !outside; placeRead.hidden = placeNotice.hidden;
      if (!outside) placeRead.checked = false;
    };
    if (context.instance?.host) {
      try {
        for (const place of await placesOf(context.instance.host)) {
          const box = el("input", "mailbox-place");
          box.type = "checkbox";
          box.setAttribute("data-place", place);
          box.addEventListener("change", showPlaceNotice);
          placeBoxes.push({ box, place });
          placesBox.append(el("p", null, el("label", null, box, " ", place)));
        }
      } catch (error) {
        placesResult.textContent = `The participants could not be read (${error?.message ?? error}), so no processing place can be offered.`;
      }
    }

    const showConnected = line.refresh;

    // The tested mailbox's parts, shown (the same for both routes).
    function showTested(tested, where) {
      result.textContent = `✓ Stored and tested${where}.`;
      for (const [folder, count] of Object.entries(tested.counts ?? {})) parts.append(el("li", null, `✓ ${folder}: ${count} mails`));
      parts.append(el("li", null, tested.drafts ? "✓ Drafts folder found" : "✗ Drafts folder not found"), el("li", null, tested.sent ? "✓ Sent folder found" : "✗ Sent folder not found"));
      if (tested.sending === "works") parts.append(el("li", null, "✓ Sending works (nothing was sent to find out)"));
      else {
        parts.append(el("li", null, `✗ Sending does not work: ${tested.sending}`));
        result.textContent = "Reading is possible, sending is not: reading mails (UC-038) works, sending replies (UC-039) does not until this is corrected.";
      }
      parts.append(el("li", null, `Route: ${tested.route} · Encryption: ${tested.encryption}`));
    }

    async function storeAndTestMicrosoft(say) {
      const mail = address.value.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) { say("Enter the mail address first. Nothing was stored."); return; }
      if (!clientId.value.trim()) { say("Enter the client identifier of your Microsoft app first. Nothing was stored."); return; }
      if (!signedInAccount) { say("Sign in with Microsoft first. Nothing was stored."); return; }
      const ticked = placeBoxes.filter(({ box }) => box.checked).map(({ place }) => place);
      if (ticked.some(isOutsideEu) && !placeRead.checked) { say("A place outside the EU is ticked: read the notice and tick I have read this. Nothing was stored."); return; }
      const connection = {
        address: mail, route: "graph",
        folders: folders.value.split(",").map((name) => name.trim()).filter(Boolean),
        places: ticked.map(placeEntry),
        graph: { clientId: clientId.value.trim(), account: signedInAccount },
      };
      if (!connection.folders.length) connection.folders = ["INBOX"];
      writeSetting(store, "mailbox", connection);
      say("Stored in this browser. Testing through Microsoft Graph…");
      let outcome = "refused", sending;
      try {
        const tested = await mailbox(connection, null).test();
        showTested(tested, " through Microsoft Graph");
        outcome = "working";
        sending = tested.sending;
      } catch (error) {
        say(graphFailureText(error));
      }
      writeSetting(store, "last-test:mailbox", { at: new Date().toISOString(), outcome, ...(sending === undefined ? {} : { sending }) });
      showConnected();
    }

    storeTest.addEventListener("click", async () => {
      parts.replaceChildren(); resultExplanation.replaceChildren(); setup.hidden = true;
      const say = (text) => { result.textContent = text; };
      if (routeSelect.value === "graph") { await storeAndTestMicrosoft(say); return; }
      const mail = address.value.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) { say("Enter the mail address first. Nothing was stored."); return; }
      if (!imapHost.value.trim() || !smtpHost.value.trim()) { say("Enter the IMAP and the SMTP server. Nothing was stored."); return; }
      if (!passwordRead.checked) { say("Read the notice about the password and tick I have read this before entering it. Nothing was stored."); return; }
      if (!password.value) { say("Enter the password. Nothing was stored."); return; }
      const bridge = chosen();
      if (!bridge) { say("Choose the Bridge this connection goes through (a Bridge paired on the Bridge page). Nothing was stored."); return; }
      if (bridge.throughJumpHost && !jumpRead.checked) { say("This Bridge is reached through the jump host: read the notice and tick I have read this. Nothing was stored."); return; }
      const ticked = placeBoxes.filter(({ box }) => box.checked).map(({ place }) => place);
      if (ticked.some(isOutsideEu) && !placeRead.checked) { say("A place outside the EU is ticked: read the notice and tick I have read this. Nothing was stored."); return; }
      const server = (host, port, security) => ({ host: host.value.trim(), port: Number(port.value), security: security.value });
      const connection = {
        address: mail, route: "imap",
        folders: folders.value.split(",").map((name) => name.trim()).filter(Boolean),
        places: ticked.map(placeEntry),
        imap: { bridge: bridge.name, jumpHostNoted: bridge.throughJumpHost, imap: server(imapHost, imapPort, imapSecurity), smtp: server(smtpHost, smtpPort, smtpSecurity),
          account: account.value.trim() || mail, password: password.value },
      };
      if (!connection.folders.length) connection.folders = ["INBOX"];
      writeSetting(store, "mailbox", connection);
      say("Stored in this browser. Testing through the Bridge…");
      let outcome = "refused", sending;
      try {
        if (!bridge.settings) throw Object.assign(new Error(`${bridge.name} is reached through the jump host, and none is stored.`), { name: "BridgeUnavailable", reason: "no jump host is stored" });
        const tested = await mailbox(connection, bridgeAt(bridge.settings)).test();
        outcome = "working";
        sending = tested.sending;
        say(`✓ Stored and tested through ${bridge.name}.`);
        for (const [folder, count] of Object.entries(tested.counts ?? {})) parts.append(el("li", null, `✓ ${folder}: ${count} mails`));
        parts.append(el("li", null, tested.drafts ? "✓ Drafts folder found" : "✗ Drafts folder not found"), el("li", null, tested.sent ? "✓ Sent folder found" : "✗ Sent folder not found"));
        if (tested.sending === "works") parts.append(el("li", null, "✓ Sending works (a login to the SMTP server; nothing was sent)"));
        else {
          parts.append(el("li", null, `✗ Sending does not work: ${tested.sending}`));
          say("Reading is possible, sending is not: reading mails (UC-038) works, sending replies (UC-039) does not until this is corrected.");
        }
        parts.append(el("li", null, `Route: ${tested.route} · Encryption: ${tested.encryption}`));
      } catch (error) {
        say(failureText(error, connection));
        if (error?.name === "LoginRefused") resultExplanation.append(explain("gmail-app-password"));
        if (error?.name === "BridgeUnavailable") setup.hidden = false;
      }
      writeSetting(store, "last-test:mailbox", { at: new Date().toISOString(), outcome, ...(sending === undefined ? {} : { sending }) });
      showConnected();
    });
    setup.addEventListener("click", () => context.go("bridge", {}));

    // Opened with a stored connection (the Settings page's Change), the form shows its fields; a password or a token is never put back into a field.
    const stored = readSetting(store, "mailbox");
    if (stored) {
      address.value = stored.address ?? "";
      routeSelect.value = stored.route === "graph" ? "graph" : "imap";
      showRoute();
      folders.value = (stored.folders ?? []).join(", ");
      const held = new Set((stored.places ?? []).map((each) => each.place));
      for (const { box, place } of placeBoxes) box.checked = held.has(place);
      for (const place of held) {
        if (placeBoxes.some((each) => each.place === place)) continue;
        const box = el("input", "mailbox-place");
        box.type = "checkbox"; box.checked = true; box.setAttribute("data-place", place);
        box.addEventListener("change", showPlaceNotice);
        placeBoxes.push({ box, place });
        placesBox.append(el("p", null, el("label", null, box, " ", place)));
      }
      if (stored.graph) {
        clientId.value = stored.graph.clientId ?? "";
        signedInAccount = stored.graph.account ?? null;
      } else if (stored.imap) {
        imapHost.value = stored.imap.imap.host; imapPort.value = String(stored.imap.imap.port); imapSecurity.value = stored.imap.imap.security;
        smtpHost.value = stored.imap.smtp.host; smtpPort.value = String(stored.imap.smtp.port); smtpSecurity.value = stored.imap.smtp.security;
        account.value = stored.imap.account ?? ""; accountTouched = true;
        if (bridges.some((bridge) => bridge.name === stored.imap.bridge)) bridgeSelect.value = stored.imap.bridge;
        showJumpNotice();
      }
      showPlaceNotice();
    }

    target.replaceChildren(
      el("h2", null, "Connect a mailbox"),
      labelled("Mail address", address),
      labelled("Route", routeSelect), reason, explain("mailbox-routes"),
      graphPart, imapPart,
      el("h3", null, "Folders"),
      labelled("Folders to read, separated by commas", folders),
      el("h3", null, "Where the mail may be processed"),
      placesBox, placesResult, placeNotice, el("p", null, el("label", null, placeRead, " I have read this")), explain("mailbox-processing-places"),
      el("p", null, storeTest), result, resultExplanation, setup, parts, line.node,
    );
    imapPart.append(
      el("h3", null, "Servers"),
      labelled("IMAP server", imapHost, " port ", imapPort, " encryption ", imapSecurity),
      labelled("SMTP server", smtpHost, " port ", smtpPort, " encryption ", smtpSecurity),
      labelled("Account", account), explain("mail-server-settings"),
      el("h3", null, "Password"),
      el("p", "notice mailbox-password-notice", `The password is stored in this browser. Every GitHub Pages site under ${owner}.github.io can read it — here: the sites of ${owner}. With it, anyone can read all mail in this mailbox and send mail in its name. It goes to no server except the Bridge this connection names. Recommended: run this instance under a GitHub owner you use for nothing else.`),
      el("p", null, el("label", null, passwordRead, " I have read this")),
      labelled("Password", password), explain("gmail-app-password"),
      el("h3", null, "Bridge"),
      labelled("Bridge", bridgeSelect), jumpNotice, el("p", null, el("label", null, jumpRead, " I have read this")),
    );
    graphPart.append(
      el("h3", null, "Register the app"),
      el("div", "mailbox-app-registration-steps",
        el("p", null, "To sign in with Microsoft, register an app with Microsoft once: ", registrationLink),
        el("p", null, "Enter the name Agent M and choose the kind single-page application. As its return address enter: ", returnShown, " ", copyReturn, copied),
        el("p", null, "Then copy the app's client ID into the field below.")),
      explain("mailbox-app-registration"),
      labelled("Client ID of the app", clientId),
      el("h3", null, "Sign in"),
      el("p", "notice mailbox-permissions", "Agent M asks Microsoft for three permissions and nothing else. Mail.ReadWrite: read mail and create drafts; Microsoft offers no narrower permission for drafts, "
        + "and it would also allow changing and deleting mail, which Agent M never does. Mail.Send: send mail, only when you send a reply. offline_access: stay signed in."),
      el("p", null, signInButton), signInResult, el("p", null, useImap),
    );
  },
};

/**
 * mailboxSetting(context) -> Element — the mailbox among the settings of this browser (the tab Endpoints & Agents of the page `settings`): not set, with *Connect a mailbox*; or the
 * connected mailbox as `mailboxLine` shows it, with *Change*. Both open the route `mailbox` (`context.go("mailbox", {})`).
 */
export function mailboxSetting(context) {
  const block = el("section", "mailbox-setting");
  const state = el("p", "mailbox-setting-state");
  const open = el("button", "mailbox-setting-open btn", "");
  open.addEventListener("click", () => context.go("mailbox", {}));
  let line = null; // mailboxLine calls `changed` while it is made, before `line` is set
  function draw() {
    if (!line) return;
    const set = readSetting(context.store, "mailbox") !== null;
    state.textContent = set ? "" : "Mailbox: not set";
    open.textContent = set ? "Change" : "Connect a mailbox";
    block.replaceChildren(...(set ? [line.node] : [state, line.node]), el("p", null, open));
  }
  line = mailboxLine(context, { changed: draw });
  draw();
  return block;
}
