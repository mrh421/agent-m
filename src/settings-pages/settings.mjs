// MOD-settings-pages' implemented Settings slice: the endpoint settings MOD-browser-store already enumerates.

import { clearEverything, clearSetting, exportSettings, importSettings, listSettings, readExport, readSetting, secretValues, writeSetting } from "../browser-store/index.mjs";
import { testEndpoint } from "../endpoint-calls/index.mjs";
import { notificationState, switchOff, switchOn, testNotification } from "../notifications/index.mjs";
import { confirmDecision, explain } from "../site-frame/index.mjs";
import { readDocument, readRegister, writeDocument } from "../documents/index.mjs";
import { participantSchema } from "../participant-list/index.mjs";
import { declarationSchema } from "../product-process/index.mjs";
import { sourceSchemas } from "../source-register/index.mjs";
import { resourceSchema } from "../resource-list/index.mjs";
import { settingsSchemas, pseudonymisationOf, namedPersonFindings } from "../personal-data/index.mjs";
import { saveFile } from "../artifact-edits/index.mjs";
import { endpointLacks, recordingOf, recordingSchema } from "../prompt-bar/index.mjs";
import { gitlabVariableScopes, jobWorkflowFiles } from "../runtimes/index.mjs";
import { checkProduct, credentialsFor, tokenKeyAddress, tokenRefusal, tokenSettingKey, route as addProductRoute } from "./products.mjs";
import { connect, HostError, parseAddress } from "../repository-hosts/index.mjs";
import { bridgeAt, pair, probe, settingsOf, testBridge } from "../bridge-client/index.mjs";
import { actionsOffer, bridgeFailureText, contextFromTest, bridgeSettings as endpointBridgeSettings, CHOOSE_BRIDGE_DISCLOSURE, CHOOSE_BRIDGE_TEXT, CLEARED_TEXT, namesNoBridge, recordTest, refusedText, route as endpointsRoute, runsOnActions, testThroughActions } from "./endpoints.mjs";
import { route as bridgeRoute } from "./bridge.mjs";
import { mailboxSetting } from "./mailbox.mjs";
import { settingsSubject } from "./subject.mjs";
import { heads } from "./routes.mjs";

// The Settings page's own context, held by the context its tabs' forms open in.
const PAGE = Symbol("the Settings page's own context");
// The sentence a line's Clear hands to the page it draws again, which shows it where the line stood.
const CLEARED = Symbol("what the page's own render confirms");

// The tab each Settings page shows, by the page's own context: a render the page asks for itself keeps the tab the person
// chose; Settings opened anew, with a context of its own, shows its first tab.
const chosenTabs = new WeakMap();

// The element each Settings page is drawn in, by the context the frame gave it: its text is what the subject carries besides the settings' states.
const drawnOn = new WeakMap();

// The page keeps the instance and the product it was given in objects of its own, so that connecting their hosts again changes nothing its caller holds.
const pageContext = (given) => ({ ...given, instance: given.instance && { ...given.instance }, product: given.product && { ...given.product } });

function el(name, className, ...children) {
  const node = document.createElement(name);
  if (className) node.className = className;
  node.append(...children);
  return node;
}

function attribute(node, name, value) {
  if (typeof node.setAttribute === "function") node.setAttribute(name, value);
  else node[name] = String(value);
}

function endpointName(key) {
  return key.slice("endpoint:".length);
}

function endpointConfig(name, setting) {
  return { name, kind: setting.kind, baseUrl: setting.url, model: setting.model, key: setting.key ?? null };
}

function resultText(result, baseUrl) {
  if (result.works) return `✓ ${result.model} is working.`;
  return refusedText(result.diagnosis, baseUrl);
}

// The state of an endpoint's line: one that runs through GitHub Actions says so, with its CI secret; one the browser refused says why, plainly (UC-003 4a).
function endpointStateText(setting, lastTest) {
  if (runsOnActions(setting)) return `Runs through GitHub Actions with the CI secret ${setting.secret}. ${stateText(lastTest)}`;
  if (lastTest?.outcome === "refused" && lastTest.browser) return refusedText({ routes: ["ci", "bridge"], message: "" }, setting.url).replace(/^✗ /, "Refused: ");
  return stateText(lastTest);
}

function stateText(lastTest) {
  if (!lastTest) return "Not set.";
  if (lastTest.outcome === "working") return `Works. Last successful test: ${lastTest.at}.`;
  return "Refused.";
}

function sharedPagesNotice(context) {
  const owner = String(context.instance?.repository ?? "").split("/")[0];
  return `Everything Agent M stores in this browser is stored for the address https://${owner}.github.io — every GitHub Pages site under that same ${owner}.github.io domain can read it.`;
}

function endpointLine(target, context, info) {
  const name = endpointName(info.key);
  const setting = readSetting(context.store, info.key);
  if (!setting) return null;
  const key = el("input", "settings-endpoint-key");
  const show = el("button", "settings-endpoint-show btn small", "Show");
  const test = el("button", "settings-endpoint-test btn", "Test");
  const change = el("button", "settings-endpoint-change btn", "Change");
  const clear = el("button", "settings-endpoint-clear btn", "Clear");
  const result = el("p", "settings-endpoint-result");
  const status = el("p", "settings-endpoint-status", endpointStateText(setting, readSetting(context.store, `last-test:${info.key}`) ?? info.lastTest));
  const offerSlot = el("div", "settings-endpoint-actions-slot");
  // What it lacks for the prompt bar to offer it, named where it is configured (UC-049 1b).
  const lacks = endpointLacks(setting);
  const notOffered = lacks.length ? el("p", "notice settings-endpoint-lacks", `The prompt bar does not offer it: it lacks ${lacks.join(" and ")}. Press Change to enter ${lacks.length === 1 ? "it" : "them"}.`) : null;
  key.type = "password";
  key.value = setting.key ?? "";
  key.autocomplete = "off";
  key.spellcheck = false;

  show.addEventListener("click", () => {
    const hidden = key.type === "password";
    key.type = hidden ? "text" : "password";
    show.textContent = hidden ? "Hide" : "Show";
  });
  test.addEventListener("click", async () => {
    if (namesNoBridge(setting)) {
      result.textContent = `${CHOOSE_BRIDGE_TEXT}Press Change to choose it.`;
      return;
    }
    if (setting.bridge) {
      let bridgeSettings;
      try { bridgeSettings = endpointBridgeSettings(context.store, setting.bridge); } catch (error) {
        result.textContent = bridgeFailureText(error);
        return;
      }
      if (!bridgeSettings) {
        result.textContent = `The endpoint names Bridge ${setting.bridge}, but this browser does not keep it. Change the endpoint or set up that Bridge.`;
        return;
      }
      result.textContent = `Testing the endpoint through Bridge ${setting.bridge}…`;
      try {
        const checked = await probe(bridgeAt(bridgeSettings), "endpoint-test", endpointConfig(name, setting));
        const lastTest = recordTest(context.store, info.key, checked);
        result.textContent = resultText(checked);
        status.textContent = stateText(lastTest);
      } catch (error) {
        result.textContent = bridgeFailureText(error);
      }
      return;
    }
    if (runsOnActions(setting)) {
      await testThroughActions(context, name, result);
      status.textContent = endpointStateText(setting, readSetting(context.store, `last-test:${info.key}`));
      return;
    }
    result.textContent = "Testing the endpoint…";
    const checked = await testEndpoint(endpointConfig(name, setting));
    const lastTest = recordTest(context.store, info.key, checked);
    result.textContent = resultText(checked, setting.url) + await contextFromTest(context.store, info.key, endpointConfig(name, setting), checked);
    status.textContent = endpointStateText(setting, lastTest);
    if (notOffered && endpointLacks(readSetting(context.store, info.key)).length === 0) { notOffered.hidden = true; notOffered.replaceChildren(); }
    const offer = !checked.works && checked.diagnosis?.routes?.includes("ci") ? actionsOffer(context, name, result) : null;
    offerSlot.replaceChildren(...(offer ? [offer] : []));
  });
  change.addEventListener("click", () => context.go("endpoints", { name }));
  clear.addEventListener("click", async () => {
    clearSetting(context.store, info.key);
    clearSetting(context.store, `last-test:${info.key}`);
    await route.render(target, { ...context, [CLEARED]: CLEARED_TEXT }, {});
  });

  return el("section", "settings-endpoint panel",
    el("h3", null, info.label),
    el("p", null, `Model: ${setting.model}`),
    status,
    ...(notOffered ? [notOffered] : []),
    el("p", null, el("label", null, "API key ", key, " ", show)),
    el("p", "settings-endpoint-disclosure", namesNoBridge(setting) ? CHOOSE_BRIDGE_DISCLOSURE : setting.bridge
      ? `Agent M sends one short test request to Bridge ${setting.bridge}. Its optional endpoint key is inside that Bridge request; Bridge and jump-host credentials are sent only as authorisation headers, never in a URL or repository.`
      : `Agent M sends one short test request to ${setting.url}. Its optional key is sent only in that request's authorisation header, never in a URL or repository.${Number(setting.context) > 0 ? "" : " Where no context is entered, it then reads the model's context from the endpoint's list of models, with the same key."}`),
    el("p", null, test, " ", change, " ", clear),
    el("div", "settings-endpoint-explanation", explain("endpoint-test")),
    result,
    offerSlot,
  );
}

const lastTestOf = (store, key) => readSetting(store, `last-test:${key}`);

function bridgeLine(target, context) {
  const setting = readSetting(context.store, "bridge");
  if (!setting) return null;
  const token = el("input", "settings-bridge-token");
  const show = el("button", "settings-bridge-show btn small", "Show");
  const change = el("button", "settings-bridge-change btn", "Change");
  const clear = el("button", "settings-bridge-clear btn", "Clear");
  const test = el("button", "settings-bridge-test btn", "Test");
  const result = el("p", "settings-bridge-result");
  const status = el("p", "settings-bridge-status", stateText(lastTestOf(context.store, "bridge")));
  token.type = "password";
  token.value = setting.token ?? "";
  token.autocomplete = "off";
  token.spellcheck = false;
  show.addEventListener("click", () => {
    const hidden = token.type === "password";
    token.type = hidden ? "text" : "password";
    show.textContent = hidden ? "Hide" : "Show";
  });
  // The same test as a Bridge kept by name: MOD-bridge-client's testBridge on the Bridge at the stored address, with the stored token.
  test.addEventListener("click", async () => {
    let lastTest;
    try {
      result.textContent = `Testing the Bridge at ${setting.address}…`;
      await testBridge(bridgeAt({ address: setting.address, token: setting.token }));
      lastTest = { at: new Date().toISOString(), outcome: "working" };
      result.textContent = `✓ The Bridge answers at ${setting.address}.`;
    } catch (error) {
      lastTest = { at: new Date().toISOString(), outcome: "refused" };
      result.textContent = `✗ ${bridgeTestFailure(error)}`;
    }
    writeSetting(context.store, "last-test:bridge", lastTest);
    status.textContent = stateText(lastTest);
  });
  change.addEventListener("click", () => context.go("bridge", {}));
  clear.addEventListener("click", async () => {
    clearSetting(context.store, "bridge");
    clearSetting(context.store, "last-test:bridge");
    await route.render(target, context);
  });
  return el("section", "settings-bridge panel",
    el("h3", null, "Bridge"), status,
    el("p", null, `Address: ${setting.address}`),
    el("p", null, el("label", null, "Pairing token ", token, " ", show)),
    explain("settings-bridge-stored"),
    el("p", null, test, " ", change, " ", clear), result,
  );
}

// What a failed Bridge or jump-host test says, as far as a browser lets a page know why.
function bridgeTestFailure(error) {
  if (error?.name === "NoAnswer") return `The Bridge gave no answer. Possible causes: ${error.likely?.join(", ") ?? "its address"}.`;
  if (error?.name === "TokenRefused") return "The Bridge refused its pairing token. Copy its current token and pair it again.";
  if (error?.name === "JumpHostLoginRefused") return "The jump host refused its web login. Check that login in Bridge settings and save it again.";
  if (error?.name === "JumpHostMissing") return "This Bridge is reached through the jump host, and no jump host is stored. Set it up on the Bridge page.";
  if (error?.name === "Timeout") return "The Bridge did not answer in time. Check that it is running, then test again.";
  return error?.message ?? String(error);
}

// The agents on the Bridge `name` that the instance's participants name: the rows of docs/participants.md whose route is `bridge <name> agent <agent>`.
async function participantsOnBridge(host, name) {
  const { defaultBranch } = await host.repositoryInfo();
  const text = await (await host.readSnapshot(defaultBranch)).read("docs/participants.md");
  if (text === null || text === undefined) return [];
  return readRegister(participantSchema(), "docs/participants.md", text).rows
    .map(({ cells }) => ({ name: cells.Name, route: /^bridge (\S+) agent (\S+)$/.exec(String(cells.Route ?? "").trim()) }))
    .filter(({ route }) => route && route[1] === name).map((row) => `${row.name} (${row.route[2]})`);
}

// The resources of the list docs/resources.md of a repository whose route is exactly `bridge <name>`, by their names (MOD-resource-list, Data: Route); a repository that holds no list has none.
async function resourcesOnBridge(host, name) {
  const { defaultBranch } = await host.repositoryInfo();
  const snapshot = await host.readSnapshot(defaultBranch);
  if (!snapshot.paths.includes("docs/resources.md")) return [];
  const text = await snapshot.read("docs/resources.md");
  if (text === null || text === undefined) return [];
  return readRegister(resourceSchema(), "docs/resources.md", text).rows
    .filter(({ cells }) => /^bridge (\S+)$/.exec(String(cells.Route ?? "").trim())?.[1] === name).map(({ cells }) => cells.Name);
}

// What clearing the Bridge `name` stops working in this browser, said before it is cleared (UC-042, 2a): the endpoints, the participants, the resources of the instance and of the chosen
// product, and the mailbox that name it. Participants and resources that cannot be read are said to be unread, never left out as if there were none.
async function clearingConsequence(context, name) {
  const endpoints = listSettings(context.store).filter((setting) => setting.key.startsWith("endpoint:"))
    .filter((setting) => readSetting(context.store, setting.key)?.bridge === name).map((setting) => endpointName(setting.key));
  let participants = [], unread = null;
  if (context.instance?.host) {
    try { participants = await participantsOnBridge(context.instance.host, name); } catch (error) { unread = error?.message ?? String(error); }
  }
  const lists = [];
  for (const [label, host] of [["instance", context.instance?.host], ["product", context.product?.host]]) {
    if (!host) continue;
    try { lists.push({ label, names: await resourcesOnBridge(host, name), unread: null }); } catch (error) { lists.push({ label, names: [], unread: error?.message ?? String(error) }); }
  }
  const mailbox = readSetting(context.store, "mailbox")?.imap?.bridge === name;
  const plural = (list, one, many) => (list.length === 1 ? one : many);
  const sentences = [
    ...(endpoints.length ? [`${plural(endpoints, "The endpoint", "The endpoints")} ${endpoints.join(", ")} ${plural(endpoints, "names", "name")} it.`] : []),
    ...(participants.length ? [`${plural(participants, "The participant", "The participants")} ${participants.join(", ")} ${plural(participants, "names", "name")} it.`] : []),
    ...(unread ? [`The participants could not be read (${unread}), so those that name it are not listed.`] : []),
    ...lists.flatMap(({ label, names, unread: why }) => [
      ...(names.length ? [`${plural(names, "The resource", "The resources")} ${names.join(", ")} of the ${label} ${plural(names, "names", "name")} it.`] : []),
      ...(why ? [`The ${label}'s resources could not be read (${why}), so those that name it are not listed.`] : []),
    ]),
    ...(mailbox ? ["The mailbox connection names it."] : []),
  ];
  return sentences.length ? `${sentences.join(" ")} ${unread && sentences.length === 1 ? "" : "They will have no Bridge to go through."}`.trim() : "Nothing in this browser names this Bridge.";
}

// The Bridges this browser keeps, each under its name: `bridge:<name>`.
function bridgeNamedLine(target, context, info) {
  const name = info.key.slice("bridge:".length);
  const entry = readSetting(context.store, info.key);
  if (!entry || typeof entry !== "object") return null;
  const token = el("input", "settings-bridge-named-token");
  const show = el("button", "settings-bridge-named-show btn small", "Show");
  const test = el("button", "settings-bridge-named-test btn", "Test");
  const change = el("button", "settings-bridge-named-change btn", "Change");
  const clear = el("button", "settings-bridge-named-clear btn", "Clear");
  const result = el("p", "settings-bridge-named-result");
  const status = el("p", "settings-bridge-named-status", stateText(info.lastTest));
  token.type = "password";
  token.value = entry.token ?? "";
  token.autocomplete = "off";
  token.spellcheck = false;
  const where = () => (typeof entry.address === "string" ? entry.address : `port ${entry.port} of the jump host`);
  show.addEventListener("click", () => {
    const hidden = token.type === "password";
    token.type = hidden ? "text" : "password";
    show.textContent = hidden ? "Hide" : "Show";
  });
  change.addEventListener("click", () => context.go("bridge", { name }));
  test.addEventListener("click", async () => {
    let lastTest;
    try {
      const settings = settingsOf({ name, ...entry }, readSetting(context.store, "jump-host"));
      result.textContent = `Testing ${name} at ${settings.address}…`;
      await testBridge(bridgeAt(settings));
      lastTest = { at: new Date().toISOString(), outcome: "working" };
      result.textContent = `✓ ${name} answers at ${settings.address}.`;
    } catch (error) {
      lastTest = { at: new Date().toISOString(), outcome: "refused" };
      result.textContent = `✗ ${bridgeTestFailure(error)}`;
    }
    writeSetting(context.store, `last-test:${info.key}`, lastTest);
    status.textContent = stateText(lastTest);
  });
  clear.addEventListener("click", async () => {
    const consequence = await clearingConsequence(context, name);
    if (typeof globalThis.confirm !== "function" || !globalThis.confirm(`Clear the Bridge ${name} from this browser? ${consequence}`)) return;
    clearSetting(context.store, info.key);
    clearSetting(context.store, `last-test:${info.key}`);
    await route.render(target, context, {});
  });
  return el("section", "settings-bridge-named panel",
    el("h3", null, "Bridge: ", el("span", "settings-bridge-named-name", name)), status,
    el("p", null, `Reached at: ${where()}`),
    el("p", null, el("label", null, "Pairing token ", token, " ", show)),
    explain("settings-bridge-named"),
    el("p", null, test, " ", change, " ", clear), result,
  );
}

function jumpHostLine(target, context) {
  const setting = readSetting(context.store, "jump-host");
  if (!setting) return null;
  const test = el("button", "settings-jump-host-test btn", "Test");
  const result = el("p", "settings-jump-host-result");
  const status = el("p", "settings-jump-host-status", stateText(readSetting(context.store, "last-test:jump-host")));
  test.addEventListener("click", async () => {
    if (!setting.httpsAddress) { result.textContent = "No HTTPS address is stored for the jump host, so there is nothing to call."; return; }
    let outcome = "working";
    try {
      result.textContent = `Calling ${setting.httpsAddress}…`;
      // The jump host serves only the paths of Bridges: the path asked for is answered by its web server after the login, not by a Bridge,
      // and the placeholder in the token header is no secret.
      await testBridge(bridgeAt({ address: setting.httpsAddress, token: "jump-host-test", ...(setting.login ? { login: setting.login } : {}) }));
      result.textContent = `✓ The jump host's web server answers at ${setting.httpsAddress}.`;
    } catch (error) {
      if (error?.name === "BridgeFailed" || (error?.name === "TokenRefused" && setting.login)) {
        result.textContent = `✓ The jump host's web server answers at ${setting.httpsAddress} and accepted its login.`;
      } else {
        outcome = "refused";
        result.textContent = error?.name === "JumpHostLoginRefused" ? "✗ The jump host's web server refused its login. Check the web login and save it again."
          : `✗ ${bridgeTestFailure(error)}`;
      }
    }
    const lastTest = { at: new Date().toISOString(), outcome };
    writeSetting(context.store, "last-test:jump-host", lastTest);
    status.textContent = stateText(lastTest);
  });
  const change = el("button", "settings-jump-host-change btn", "Change");
  const clear = el("button", "settings-jump-host-clear btn", "Clear");
  change.addEventListener("click", () => context.go("bridge", {}));
  clear.addEventListener("click", async () => {
    clearSetting(context.store, "jump-host");
    await route.render(target, context);
  });
  return el("section", "settings-jump-host panel",
    el("h3", null, "Jump host"),
    el("p", null, `Host: ${setting.hostname}`),
    el("p", null, `HTTPS address: ${setting.httpsAddress ?? "Not configured."}`),
    explain("settings-jump-host"),
    status, el("p", null, test, " ", change, " ", clear), result,
  );
}

// Whether the export would carry the mailbox's sign-in tokens: the sign-in library's keys are no setting of their own, so the export itself says.
async function carriesSignIn(store) {
  return Object.keys(JSON.parse(await exportSettings(store)).foreign ?? {}).length > 0;
}

function exportNotice(store, signIn) {
  const secrets = listSettings(store)
    .filter((setting) => setting.secret && (readSetting(store, setting.key) !== null || (setting.key === "mailbox-sign-in" && signIn)))
    .map((setting) => `${setting.label} (${setting.grants})`);
  const contained = secrets.length ? secrets.join("; ") : "no stored secret";
  return `This file contains every stored token, key and password. Whoever holds it can use: ${contained}. You may lock it with a passphrase; it cannot be recovered.`;
}

// Import settings stores nothing while the file holds a token of the other kind of server than its key names: each token the file holds is connected,
// with MOD-repository-hosts' `connect`, to the repository its key names (tokenKeyAddress) before the file is imported, and a refusal of `connect`
// refuses the import, with a line that names the key and never the token (`connect`'s message never holds it). A key that names no readable repository has no host to refuse it.
async function refuseWrongTokens(context, text, passphrase) {
  const { settings } = await readExport(text, passphrase);
  for (const [key, entry] of Object.entries(settings)) {
    const address = tokenKeyAddress(key, context.instance?.repository);
    const refused = tokenRefusal(context.store, address, key, entry?.value, entry?.name);
    if (refused) throw new Error(`Nothing was imported: ${refused}`);
  }
}

function exportImportControls(context, signIn) {
  const notice = el("p", "settings-export-notice", exportNotice(context.store, signIn));
  const passphrase = el("input", "settings-export-passphrase");
  const download = el("button", "settings-export-download btn primary", "Export settings");
  const file = el("input", "settings-import-file");
  const importPassphrase = el("input", "settings-import-passphrase");
  const result = el("p", "settings-import-result");
  passphrase.type = "password";
  passphrase.autocomplete = "new-password";
  importPassphrase.type = "password";
  importPassphrase.autocomplete = "current-password";
  file.type = "file";
  file.accept = "application/json";
  download.addEventListener("click", async () => {
    try {
      const text = await exportSettings(context.store, passphrase.value);
      const blob = new Blob([text], { type: "application/json" });
      const address = URL.createObjectURL(blob);
      const link = el("a");
      link.href = address;
      link.download = "agent-m-settings.json";
      link.click();
      URL.revokeObjectURL(address);
      result.textContent = "Settings export is ready.";
    } catch (error) {
      result.textContent = error.message;
    }
  });
  file.addEventListener("change", async () => {
    const chosen = file.files?.[0];
    if (!chosen) return;
    try {
      const text = await chosen.text();
      await refuseWrongTokens(context, text, importPassphrase.value);
      const imported = await importSettings(context.store, text, importPassphrase.value);
      reconnectHosts(context);
      result.textContent = `Added: ${imported.added.join(", ") || "none"}. Kept: ${imported.kept.join(", ") || "none"}.`;
    } catch (error) {
      result.textContent = error.message;
    }
  });
  return el("section", "settings-export-import panel",
    el("h3", null, "Export and import settings"),
    notice,
    el("p", null, el("label", null, "Optional export passphrase ", passphrase)),
    download,
    el("p", null, el("label", null, "Import settings file ", file)),
    el("p", null, el("label", null, "Import passphrase ", importPassphrase)),
    explain("settings-export-import"),
    result,
  );
}

// A host keeps the token it was connected with. After a token is cleared or stored, the page connects its instance and its product again with what the
// store holds (MOD-repository-hosts.connect, as repositoryLine's Test does with the stored token), so that no later request carries a cleared token and the next one carries a stored one.
function reconnectHosts(context) {
  const reconnect = (address) => connect(address, { ...credentialsFor(context.store, address), secrets: secretValues(context.store) });
  if (context.instance?.host) context.instance.host = reconnect(parseAddress(`https://github.com/${context.instance.repository}`));
  if (context.product?.host) context.product.host = reconnect(parseAddress(context.product.address));
}

// This browser's identifier (MOD-browser-store's key `browser`): an identifier only, so its line shows it and Clear; nothing to test or change.
function browserIdLine(target, context) {
  const id = readSetting(context.store, "browser");
  const shown = typeof id === "string" && id !== "" ? id : null;
  const clear = el("button", "settings-browser-id-clear btn", "Clear");
  clear.addEventListener("click", async () => {
    clearSetting(context.store, "browser");
    await route.render(target, context, {});
  });
  return el("section", "settings-browser-id panel",
    el("h3", null, "Browser identifier"),
    el("p", null, shown === null ? "not set" : el("span", "settings-browser-id-value", shown)),
    ...(shown === null ? [] : [el("p", null, clear)]));
}

// The mails marked not an issue (MOD-browser-store's key `not-an-issue`): identifiers only, so its line says how many are marked and has Clear after one confirmation; nothing to test or change.
function notAnIssueLine(target, context) {
  const marks = readSetting(context.store, "not-an-issue");
  const count = Array.isArray(marks) ? marks.length : 0;
  const clear = el("button", "settings-not-an-issue-clear btn", "Clear");
  clear.addEventListener("click", async () => {
    const decision = await confirmDecision({ title: "Clear the mails marked not an issue?", lines: [`${count} mail${count === 1 ? "" : "s"} marked in this browser will be proposed again at the next reading of the mailbox.`], confirm: "Clear the marks" });
    if (!decision.confirmed) return;
    clearSetting(context.store, "not-an-issue");
    await route.render(target, context, {});
  });
  return el("section", "settings-not-an-issue panel",
    el("h3", null, "Mails marked not an issue"),
    el("p", null, count === 0 ? "not set" : `${count} mail${count === 1 ? "" : "s"} marked`),
    ...(count === 0 ? [] : [el("p", null, clear)]));
}

function browserClearControls(context) {
  const clear = el("button", "settings-clear-everything btn", "Clear everything in this browser");
  const acknowledgement = el("input", "settings-clear-ack");
  const result = el("p", "settings-clear-result");
  acknowledgement.type = "checkbox";
  clear.disabled = true;
  acknowledgement.addEventListener("change", () => { clear.disabled = !acknowledgement.checked; });
  clear.addEventListener("click", () => {
    clearEverything(context.store);
    reconnectHosts(context);
    clear.disabled = true;
    acknowledgement.checked = false;
    result.textContent = "Every Agent M setting for this instance is cleared from this browser.";
  });
  return el("section", "settings-clear panel",
    el("h3", null, "Clear this browser"),
    el("p", null, "This removes this instance's stored settings from localStorage and does not change a repository."),
    explain("settings-clear-everything"),
    el("p", null, el("label", null, acknowledgement, " I understand this clears every Agent M setting in this browser.")),
    clear, result,
  );
}

function repositoryLine(target, context, info) {
  if (info.key !== "github-token" && info.key !== "products" &&
    !info.key.startsWith("github-token:") && !info.key.startsWith("gitlab-token:")) return null;
  if (info.key === "products") {
    const change = el("button", "settings-repository-change btn", "Add or remove products");
    const clear = el("button", "settings-repository-clear btn", "Clear");
    const status = el("p", "settings-repository-status", "Product addresses are stored in this browser.");
    change.addEventListener("click", () => context.go("add-product", {}));
    clear.addEventListener("click", async () => {
      if (typeof globalThis.confirm !== "function" || !globalThis.confirm("Clear all managed products and their stored tokens from this browser?")) return;
      for (const web of readSetting(context.store, "products") ?? []) clearProductToken(context.store, web);
      clearSetting(context.store, info.key);
      reconnectHosts(context);
      status.textContent = "Cleared from this browser with every product's own token.";
      await route.render(target, context, {});
    });
    return el("section", "settings-repository panel", el("h3", null, info.label), status,
      explain("settings-products-stored"),
      el("p", null, change, " ", clear));
  }
  const stored = readSetting(context.store, info.key);
  const value = el("input", "settings-repository-secret");
  const show = el("button", "settings-repository-show btn small", "Show");
  const acknowledgement = el("input", "settings-repository-ack");
  const expiry = el("input", "settings-repository-expiry");
  const save = el("button", "settings-repository-save btn primary", "Save");
  const test = el("button", "settings-repository-test btn", "Test");
  const clear = el("button", "settings-repository-clear btn", "Clear");
  const change = el("button", "settings-repository-change btn", "Change");
  const result = el("p", "settings-repository-result");
  const address = repositoryAddress(context, info.key);
  const links = address ? connect(address, {}).webLinks() : null;
  const renewal = el("a", "settings-repository-renew", "Renew token ↗");
  if (links) renewal.href = links.projectTokens ?? links.tokens;
  else renewal.textContent = "Renewal link needs a repository address.";
  const status = el("p", "settings-repository-status", repositoryStatus(info, stored));
  const secret = stored?.value ?? "";
  value.type = "password";
  value.value = secret;
  value.autocomplete = "off";
  value.spellcheck = false;
  expiry.type = "date";
  expiry.value = stored?.expires ?? new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10);
  acknowledgement.type = "checkbox";
  acknowledgement.checked = Boolean(readSetting(context.store, "acknowledged:shared-origin"));
  acknowledgement.disabled = true;
  value.disabled = true;
  expiry.disabled = true;
  save.disabled = true;
  // UC-042 step 2: Change opens the form — the notice, I have read this and Save — in place; until then none of it is shown.
  const notice = el("p", "notice settings-repository-shared-origin", sharedPagesNotice(context));
  const acknowledgementLine = el("p", null, el("label", null, acknowledgement, " I have read this."));
  notice.hidden = acknowledgementLine.hidden = save.hidden = true;
  show.addEventListener("click", () => {
    const hidden = value.type === "password";
    value.type = hidden ? "text" : "password";
    show.textContent = hidden ? "Hide" : "Show";
  });
  acknowledgement.addEventListener("change", () => {
    if (acknowledgement.checked) writeSetting(context.store, "acknowledged:shared-origin", new Date().toISOString().slice(0, 10));
    else clearSetting(context.store, "acknowledged:shared-origin");
    value.disabled = expiry.disabled = save.disabled = !acknowledgement.checked;
    if (acknowledgement.checked) value.focus();
  });
  change.addEventListener("click", () => {
    notice.hidden = acknowledgementLine.hidden = save.hidden = false;
    acknowledgement.disabled = false;
    const alreadyAcknowledged = Boolean(readSetting(context.store, "acknowledged:shared-origin"));
    acknowledgement.checked = alreadyAcknowledged;
    if (alreadyAcknowledged) {
      value.disabled = expiry.disabled = save.disabled = false;
      result.textContent = "The shared-browser notice was already acknowledged in this browser.";
      value.focus();
    } else {
      result.textContent = "Read the shared-browser notice, then acknowledge it before saving a replacement token.";
      acknowledgement.focus();
    }
  });
  save.addEventListener("click", () => {
    const next = value.value.trim();
    if (!acknowledgement.checked || !next || !expiry.value) { result.textContent = "Acknowledge the notice, paste the token, and enter its expiry date first."; return; }
    const refused = tokenRefusal(context.store, address, info.key, next, stored?.name ?? info.label);
    if (refused) { result.textContent = `Nothing was stored: ${refused}`; return; }
    writeSetting(context.store, info.key, { ...stored, value: next, name: stored?.name ?? info.label, expires: expiry.value, stored: new Date().toISOString().slice(0, 10) });
    clearSetting(context.store, `last-test:${info.key}`);
    reconnectHosts(context);
    status.textContent = repositoryStatus({ ...info, expires: expiry.value, lastTest: null }, readSetting(context.store, info.key));
    result.textContent = "Saved in this browser. Test it before using it.";
  });
  test.addEventListener("click", async () => {
    const setting = readSetting(context.store, info.key);
    if (!setting?.value) { result.textContent = "Save a token before testing it."; return; }
    if (!address) { result.textContent = "This stored token has no readable repository address to test. Change or clear it in this browser."; return; }
    result.textContent = "Testing the repository token…";
    let lastTest;
    try {
      await connect(address, { token: setting.value, tokenName: setting.name ?? info.label }).repositoryInfo();
      lastTest = { at: new Date().toISOString(), outcome: "working" };
      result.textContent = "✓ The repository token is working.";
    } catch (error) {
      result.textContent = `✗ ${error.message}`;
      if (!(error instanceof HostError) || error.name !== "TokenRefused") return;
      lastTest = { at: new Date().toISOString(), outcome: "refused" };
    }
    writeSetting(context.store, `last-test:${info.key}`, lastTest);
    status.textContent = repositoryStatus({ ...info, lastTest }, setting);
  });
  clear.addEventListener("click", () => {
    const consequence = info.key === "github-token"
      ? "Without it, accepting and editing go through GitHub's own pages, products cannot be added, and private repositories cannot be read."
      : "Without it, this product can be read only if it is public, and nothing can be accepted or saved in it.";
    if (!globalThis.confirm(`Clear this token from this browser? ${consequence}`)) return;
    clearSetting(context.store, info.key);
    clearSetting(context.store, `last-test:${info.key}`);
    reconnectHosts(context);
    value.value = "";
    status.textContent = `Cleared from this browser. ${consequence}`;
  });
  return el("section", "settings-repository panel",
    el("h3", null, info.label), status,
    el("p", null, el("label", null, "Stored token ", value, " ", show)),
    el("p", null, `Expires on `, expiry, " ", renewal),
    explain("settings-token-stored"),
    notice, acknowledgementLine,
    el("p", null, change, " ", save, " ", test, " ", clear), result,
  );
}

const repositoryAddress = (context, key) => tokenKeyAddress(key, context.instance?.repository);

function repositoryStatus(info, stored) {
  if (!stored?.value) return "Not set.";
  const test = info.lastTest;
  const tested = test?.outcome === "working" ? ` Works. Last successful test: ${test.at}.` : test?.outcome === "refused" ? " Refused." : "";
  if (!info.expires) return `Stored in this browser.${tested}`;
  const days = Math.ceil((Date.parse(info.expires) - Date.now()) / 86400000);
  const expiry = days <= 14 ? `Expires on ${info.expires}; renew soon.` : `Expires on ${info.expires}.`;
  return `${expiry}${tested}`;
}

// The repositories the notice of *Recording conversations* must not leave out: the instance's and each product this browser keeps (the
// setting `products`), each with what its server reports of its visibility — a product asked with the credentials the page already
// uses for it (`credentialsFor`). A repository whose information cannot be read is `visibility: null`, never taken for private.
async function repositoryVisibilities(context) {
  const visibility = async (name, info) => {
    try { return { name, visibility: (await info()).visibility }; } catch { return { name, visibility: null }; }
  };
  const products = (readSetting(context.store, "products") ?? []).map((web) => visibility(web, async () => {
    const address = parseAddress(web);
    const checked = await checkProduct(address, credentialsFor(context.store, address));
    if (!checked.ok) throw checked.error;
    return checked.info;
  }));
  return Promise.all([visibility(context.instance.repository, () => context.instance.host.repositoryInfo()), ...products]);
}

const RECORDING_STATEMENTS = [
  "Every message of a conversation in the prompt bar, the person's and the participant's, will be committed to the repository of the page the conversation is held on, under docs/conversations/.",
  "It stays in that repository's history.",
  "For each repository the server reports as public, the conversations held on its pages will be published.",
];

// UC-042 step 3 and 3b: the instance's line *Recording conversations*. `load()` reads the switch from the instance's default branch with
// MOD-prompt-bar's recordingOf, once, when the tab that holds the line is shown; *Switch on* builds the notice and shows it before
// anything is saved, and *Save* writes only after *I have read this* and on a person's click; *Switch off* is saved at once, on a person's
// click, and the page says that written records stay.
function recordingControls(context) {
  const schema = recordingSchema();
  const state = el("p", "settings-recording-state", "Recording conversations is not read yet.");
  const switchOn = el("button", "settings-recording-on btn", "Switch on");
  const switchOff = el("button", "settings-recording-off btn", "Switch off");
  const publicLine = el("p", "settings-recording-public"), unknownLine = el("p", "settings-recording-unknown"), noneLine = el("p", "settings-recording-none");
  const ack = el("input", "settings-recording-ack"), save = el("button", "settings-recording-save btn primary", "Save");
  const notice = el("div", "notice settings-recording-notice");
  const result = el("p", "settings-recording-result");
  const controls = el("p", null, switchOn, " ", switchOff);
  const node = el("section", "settings-recording panel", el("h3", null, "Instance · Recording conversations"), state,
    controls, notice, result,
    el("div", "settings-recording-explanation", explain("recording-conversations")));
  ack.type = "checkbox";
  switchOn.hidden = switchOff.hidden = notice.hidden = true;
  let openedBlob = null, loaded = false;
  const show = (on) => {
    state.textContent = `Recording conversations is ${on ? "on" : "off"}.`;
    switchOn.hidden = on;
    switchOff.hidden = !on;
    notice.hidden = true;
  };
  const load = async () => {
    if (loaded) return;
    loaded = true;
    const host = context.instance?.host;
    if (!host) { controls.replaceChildren(); state.textContent = "The instance repository is not connected, so the switch cannot be read."; return; }
    try {
      const snapshot = await host.readSnapshot((await host.repositoryInfo()).defaultBranch);
      const on = await recordingOf(snapshot);
      openedBlob = snapshot.blob(schema.path);
      show(on);
    } catch (error) { controls.replaceChildren(); state.textContent = `The switch could not be read: ${error?.message ?? error}`; }
  };
  // The file as recording.schema.md states it, written on the blob it was opened on (A SAVE IS REFUSED WHEN THE TEXT CHANGED MEANWHILE).
  const write = async (next) => {
    const text = writeDocument(schema, { kind: schema.schema, path: schema.path, id: null, title: null,
      fields: { recording: next }, sections: [], appended: [], body: `${schema.title}\n` });
    try {
      const saved = await saveFile(context.instance?.host, { path: schema.path, text, openedBlob });
      if (saved.refused) { result.textContent = "The switch changed meanwhile; nothing was written."; return false; }
      openedBlob = saved.blob;
      return true;
    } catch (error) { result.textContent = error?.message ?? String(error); return false; }
  };
  switchOn.addEventListener("click", async () => {
    result.textContent = "Asking each repository's server whether it is public…";
    const repositories = await repositoryVisibilities(context);
    const named = (visibility) => repositories.filter((repository) => repository.visibility === visibility).map((repository) => repository.name);
    const publics = named("public"), unknown = named(null);
    publicLine.textContent = `Reported as public: ${publics.join(", ")}.`;
    unknownLine.textContent = `Could not be read, so visibility not known: ${unknown.join(", ")}.`;
    noneLine.textContent = "No repository is reported as public.";
    publicLine.hidden = !publics.length;
    unknownLine.hidden = !unknown.length;
    noneLine.hidden = publics.length > 0;
    ack.checked = false;
    ack.disabled = false;
    save.disabled = true;
    notice.replaceChildren(el("div", "settings-recording-statements", ...RECORDING_STATEMENTS.map((statement) => el("p", null, statement))),
      publicLine, unknownLine, noneLine, el("p", null, el("label", null, ack, " I have read this."), " ", save));
    result.textContent = "";
    notice.hidden = false;
    ack.focus();
  });
  ack.addEventListener("change", () => { save.disabled = !ack.checked; });
  save.addEventListener("click", async (event) => {
    if (!event.isTrusted) return;
    if (!ack.checked) { result.textContent = "Tick I have read this before saving."; return; }
    if (await write("on")) { show(true); result.textContent = "Saved in the instance repository."; }
  });
  switchOff.addEventListener("click", async (event) => {
    if (!event.isTrusted) return;
    if (await write("off")) {
      show(false);
      result.textContent = "Records already written stay in the history of the repositories they were written to.";
    }
  });
  return { node, load };
}

function productListControls(target, context) {
  const products = readSetting(context.store, "products");
  if (!Array.isArray(products) || !products.length) return null;
  const lines = products.map((web) => {
    const test = el("button", "settings-product-test btn", "Test");
    const remove = el("button", "settings-product-remove btn", "Remove");
    const result = el("p", "settings-product-list-result");
    test.addEventListener("click", async () => {
      try {
        const address = parseAddress(web);
        result.textContent = "Testing the product repository…";
        const checked = await checkProduct(address, credentialsFor(context.store, address));
        result.textContent = checked.ok ? `✓ ${web} is reachable.` : `✗ ${checked.error.message}`;
      } catch (error) { result.textContent = `✗ ${error.message}`; }
    });
    remove.addEventListener("click", async () => {
      if (typeof globalThis.confirm !== "function" || !globalThis.confirm(`Remove ${web} and its stored token from this browser?`)) return;
      clearProductToken(context.store, web);
      writeSetting(context.store, "products", products.filter((candidate) => candidate !== web));
      reconnectHosts(context);
      await route.render(target, context, {});
    });
    return el("section", "settings-product-list-item", el("h4", null, web),
      explain("settings-product-address"),
      el("p", null, test, " ", remove), result);
  });
  return el("section", "settings-product-list panel", el("h3", null, "Managed products"),
    explain("settings-managed-products"), ...lines);
}

function clearProductToken(store, web) {
  const key = tokenSettingKey(parseAddress(web));
  clearSetting(store, key);
  clearSetting(store, `last-test:${key}`);
}

function notificationsControls(context) {
  const result = el("p", "settings-notifications-result");
  const state = notificationState(context.store);
  const status = el("p", "settings-notifications-status", state.on ? "On." : "Off.");
  const on = el("button", "settings-notifications-on btn", "Switch on");
  const test = el("button", "settings-notifications-test btn", "Test");
  const off = el("button", "settings-notifications-off btn", "Switch off");
  const refresh = (next) => {
    status.textContent = next.on ? `On. ${next.notified} ${next.notified === 1 ? "file" : "files"} notified. Agent M checks every five minutes only while a dashboard page is open; checks go to repository servers with this browser's tokens.`
      : next.permission === "denied" ? "Blocked. Allow notifications for this site in the browser's own site settings, then reload."
        : next.available === "from the Home Screen" ? "On iPhone or iPad, add this site to the Home Screen before switching notifications on."
          : next.available === "no" ? "Notifications are not available in this browser." : "Off.";
    on.disabled = next.on || next.permission === "denied";
    test.disabled = !next.on;
    off.disabled = !next.on;
  };
  refresh(state);
  on.addEventListener("click", async () => {
    try { refresh(await switchOn(context.store)); }
    catch (error) { result.textContent = error.message; }
  });
  test.addEventListener("click", async () => {
    try { await testNotification(); result.textContent = "Test notification sent."; }
    catch (error) { result.textContent = error.message; }
  });
  off.addEventListener("click", async () => {
    await switchOff(context.store);
    refresh(notificationState(context.store));
    result.textContent = "Off. Browser permission remains until you remove it in browser settings.";
  });
  return el("section", "settings-notifications panel",
    el("h3", null, "Notifications"), status,
    el("p", null, on, " ", test, " ", off),
    explain("settings-notifications"), result,
  );
}

function remoteSessionLine(target, context, info) {
  if (!info.key.startsWith("remote-session:")) return null;
  const session = readSetting(context.store, info.key);
  if (!session) return null;
  const token = el("input", "settings-remote-session-token");
  const show = el("button", "settings-remote-session-show btn small", "Show");
  const test = el("button", "settings-remote-session-test btn", "Test");
  const change = el("button", "settings-remote-session-change btn", "Change");
  const clear = el("button", "settings-remote-session-clear btn", "Clear");
  const result = el("p", "settings-remote-session-result");
  const status = el("p", "settings-remote-session-status", stateText(info.lastTest));
  token.type = "password";
  token.value = session.token ?? "";
  token.autocomplete = "off";
  token.spellcheck = false;
  show.addEventListener("click", () => {
    const hidden = token.type === "password";
    token.type = hidden ? "text" : "password";
    show.textContent = hidden ? "Hide" : "Show";
  });
  change.addEventListener("click", () => context.go("bridge", { name: info.key.slice("remote-session:".length) }));
  test.addEventListener("click", async () => {
    if (!Number.isInteger(session.port) || !session.token) { result.textContent = "This remote session needs a forwarded port and copied Bridge token before it can be tested."; return; }
    result.textContent = `Testing the forwarded Bridge at localhost:${session.port}…`;
    try {
      await pair(`http://localhost:${session.port}`, session.token);
      const lastTest = { at: new Date().toISOString(), outcome: "working" };
      writeSetting(context.store, `last-test:${info.key}`, lastTest);
      status.textContent = stateText(lastTest);
      result.textContent = `✓ The forwarded Bridge answers at localhost:${session.port}.`;
    } catch (error) {
      const lastTest = { at: new Date().toISOString(), outcome: "refused" };
      writeSetting(context.store, `last-test:${info.key}`, lastTest);
      status.textContent = stateText(lastTest);
      result.textContent = `✗ ${error.message}`;
    }
  });
  clear.addEventListener("click", async () => {
    clearSetting(context.store, info.key);
    clearSetting(context.store, `last-test:${info.key}`);
    result.textContent = "Cleared from this browser.";
    await route.render(target, context, {});
  });
  return el("section", "settings-remote-session panel",
    el("h3", null, info.label), status,
    el("p", null, `Forwarded port: ${session.port ?? "Not configured."}`),
    el("p", null, el("label", null, "Copied Bridge token ", token, " ", show)),
    el("p", null, "Tunnel commands and proxy configuration are prepared on the Bridge page; no tunnel is started here."),
    explain("settings-remote-session"),
    el("p", null, test, " ", change, " ", clear), result,
  );
}

// A CLI session a Bridge offers, kept under `session:<bridge>:<agent>` (MOD-browser-store): its line shows the label and no value; Test asks the Bridge `<bridge>` whether it still offers `<agent>`.
function sessionLine(target, context, info) {
  if (!info.key.startsWith("session:") || !readSetting(context.store, info.key)) return null;
  const rest = info.key.slice("session:".length);
  const bridgeName = rest.slice(0, rest.lastIndexOf(":")), agent = rest.slice(rest.lastIndexOf(":") + 1);
  const test = el("button", "settings-session-test btn", "Test");
  const change = el("button", "settings-session-change btn", "Change");
  const clear = el("button", "settings-session-clear btn", "Clear");
  const result = el("p", "settings-session-result");
  const status = el("p", "settings-session-status", stateText(info.lastTest));
  change.addEventListener("click", () => context.go("bridge", { name: bridgeName }));
  test.addEventListener("click", async () => {
    let lastTest;
    try {
      const entry = readSetting(context.store, `bridge:${bridgeName}`);
      if (!entry || typeof entry !== "object") throw new Error(`This browser does not keep a Bridge named ${bridgeName}. Pair it on the Bridge page.`);
      const settings = settingsOf({ name: bridgeName, ...entry }, readSetting(context.store, "jump-host"));
      result.textContent = `Asking ${bridgeName} at ${settings.address} for its agents…`;
      const answer = await testBridge(bridgeAt(settings));
      const offered = (answer.agents ?? []).some((candidate) => candidate.name === agent);
      lastTest = { at: new Date().toISOString(), outcome: offered ? "working" : "refused" };
      result.textContent = offered ? `✓ ${bridgeName} still offers ${agent}.` : `✗ ${bridgeName} answers, but does not offer ${agent}.`;
    } catch (error) {
      lastTest = { at: new Date().toISOString(), outcome: "refused" };
      result.textContent = `✗ ${bridgeTestFailure(error)}`;
    }
    writeSetting(context.store, `last-test:${info.key}`, lastTest);
    status.textContent = stateText(lastTest);
  });
  clear.addEventListener("click", async () => {
    clearSetting(context.store, info.key);
    clearSetting(context.store, `last-test:${info.key}`);
    await route.render(target, context, {});
  });
  return el("section", "settings-session panel", el("h3", null, info.label), status, el("p", null, test, " ", change, " ", clear), result);
}

function ciRoute(text) {
  const route = String(text ?? "").trim();
  const current = /^ci\s+(hosted|runner:(\S+))\s+secret\s+(\S+)$/.exec(route);
  if (current) return { runner: current[2] ?? null, secret: current[3] };
  const legacy = /^workflow\s+\S+\s+on\s+(github-hosted|self-hosted)\s+secret\s+(\S+)$/.exec(route);
  if (legacy) return { runner: legacy[1] === "github-hosted" ? null : legacy[1], secret: legacy[2] };
  return null;
}

async function jobWorkflowInput(context) {
  if (!context.instance?.host) throw new Error("The instance repository is not connected.");
  const { defaultBranch } = await context.instance.host.repositoryInfo();
  const snapshot = await context.instance.host.readSnapshot(defaultBranch);
  const participants = await snapshot.read("docs/participants.md");
  const rows = participants ? readRegister(participantSchema(), "docs/participants.md", participants).rows : [];
  const ci = rows.map(({ cells }) => ciRoute(cells.Route)).filter(Boolean);
  // Beside the CI secrets of the participants' routes, the CI secret each of this browser's endpoints names (THE PROMPT BAR'S ENDPOINTS AND CLI SESSIONS ARE BOUND AS
  // PARTICIPANTS ARE; ITM-1188's decision): the job workflow reads only keys it names.
  const endpointSecrets = listSettings(context.store).filter((setting) => setting.key.startsWith("endpoint:"))
    .map((setting) => readSetting(context.store, setting.key)?.secret).filter((name) => typeof name === "string" && /^[A-Za-z_][A-Za-z0-9_]*$/.test(name));
  const keys = [...new Set([...ci.map((route) => route.secret), ...endpointSecrets])];
  const runners = [...new Set(ci.map((route) => route.runner).filter(Boolean))];
  return {
    instance: { repository: context.instance.repository, commit: snapshot.commit },
    secrets: { token: "AGENT_M_TOKEN", keys },
    runners,
  };
}

// On GitLab, which gives a job every CI/CD variable not scoped to an environment, the scope each variable the job workflow reads needs (MOD-runtimes'
// gitlabVariableScopes), and the state of the project's variables as its server lists them — names and scopes, never a value. The setup is called safe only
// where every variable stands with exactly the scopes it needs; a variable missing a scope, one with another scope, and a list the server refuses are named.
async function gitlabScopes(host, secrets) {
  const needed = gitlabVariableScopes(secrets);
  const list = el("ul", "settings-job-workflow-scopes",
    ...needed.map(({ name, scopes }) => el("li", null, `${name}: environment scope ${scopes.join(" and ")}${scopes.length > 1 ? ", one variable for each" : ""}`)));
  const state = el("p", "settings-job-workflow-scope-state");
  let listed;
  try { listed = await host.ciVariableScopes(); }
  catch (error) {
    state.textContent = `The scopes cannot be checked here (${error.message}). Until each variable stands with exactly the scopes above, the job workflow is not safe: `
      + "an unscoped variable reaches every job, the agent's among them.";
    return [list, state];
  }
  const findings = [];
  for (const { name, scopes } of needed) {
    const has = listed.filter((variable) => variable.name === name).map((variable) => variable.scope);
    for (const scope of scopes.filter((each) => !has.includes(each))) findings.push(`${name} has no variable of the scope ${scope}`);
    for (const scope of has.filter((each) => !scopes.includes(each))) findings.push(`${name} has the scope ${scope}, which reaches ${scope === "*" ? "every job" : "jobs it should not"}`);
  }
  state.textContent = findings.length === 0 ? "Every variable stands with exactly the scopes above: the job workflow is safe."
    : `Not safe: ${findings.join("; ")}.`;
  return [list, state];
}

async function jobWorkflowLine(context, { address, defaultBranch, snapshot, canWrite }) {
  const status = el("p", "settings-job-workflow-status");
  const result = el("p", "settings-job-workflow-result");
  const secretList = el("p", "settings-job-workflow-secrets");
  const secretsPage = el("a", "settings-job-workflow-secrets-link", "Open the repository's secrets page");
  secretsPage.href = connect(address, {}).webLinks().secrets;
  const install = el("button", "settings-job-workflow-install btn primary", "Install");
  let offerInstall = false, scopes = null;
  let files = [], expectedHead = snapshot.commit;
  try {
    const input = await jobWorkflowInput(context);
    // On GitLab the product's own .gitlab-ci.yml at this head is given to be added to, as the other files are read below; null where it has none.
    const gitlabCi = address.server === "gitlab" ? (await snapshot.read(".gitlab-ci.yml")) ?? null : null;
    files = jobWorkflowFiles(address.server, input.instance, input.secrets, input.runners, gitlabCi);
    const current = await Promise.all(files.map(async (file) => [file.path, await snapshot.read(file.path)]));
    const missing = current.filter(([, text]) => text === null || text === undefined).map(([path]) => path);
    const different = current.filter(([, text], index) => text !== null && text !== undefined && text !== files[index].text).map(([path]) => path);
    const installed = missing.length === 0 && different.length === 0;
    status.textContent = installed ? "Installed for this instance commit."
      : missing.length === files.length ? "Not installed."
        : `Workflow files are different from this instance commit: ${[...missing, ...different].join(", ")}.`;
    secretList.textContent = `Secrets named: ${[input.secrets.token, ...input.secrets.keys].join(", ") || input.secrets.token}. `;
    if (address.server === "gitlab") scopes = await gitlabScopes(context.product.host, input.secrets);
    offerInstall = !installed && canWrite;
  } catch (error) {
    status.textContent = `The workflow state cannot be read: ${error.message}`;
    secretList.textContent = "Secrets named: AGENT_M_TOKEN.";
  }
  install.addEventListener("click", async (event) => {
    if (!event.isTrusted) return;
    try {
      const { commit } = await context.product.host.commitFiles({
        branch: defaultBranch,
        expectedHead,
        files,
        message: "Install Agent M job workflow",
      });
      status.textContent = "Installed for this instance commit.";
      install.hidden = true;
      install.disabled = true;
      result.textContent = commit ? `Committed ${commit}.` : "Committed.";
    } catch (error) {
      result.textContent = error.message;
    }
  });
  return el("section", "settings-job-workflow panel",
    el("h4", null, "Agent M's job workflow"),
    status,
    secretList,
    ...(scopes ?? []),
    el("p", null, secretsPage),
    explain("settings-job-workflow"),
    ...(offerInstall ? [el("p", null, install)] : []),
    result,
  );
}

// The ways from a product's section to the guided pages of what the product's repository keeps (UC-015 step 1: "In the product's view, the author opens Requirement sources").
// The frame's `go` adds the chosen product to the address.
function productLinks(context) {
  const sources = el("button", "settings-product-sources btn", "Requirement sources");
  sources.addEventListener("click", () => context.go("sources", {}));
  return el("p", "settings-product-links", sources);
}

// The files of the default branch that still name a collaborator who withdrew (UC-042 5a), by MOD-personal-data's namedPersonFindings, in the order of the repository's paths; the register of consent itself is not among them.
async function filesNamingWithdrawn(host, branch, name, registerPath, collaboratorsDocument) {
  const snapshot = await host.readSnapshot(branch);
  const paths = (snapshot.paths ?? []).filter((path) => path !== registerPath);
  await snapshot.readMany?.(paths);
  const named = [];
  for (const path of paths) {
    const text = await snapshot.read(path);
    if (typeof text === "string" && namedPersonFindings(text, path, { names: [name], addresses: [], phones: [], accounts: [] }, collaboratorsDocument, []).length > 0) named.push(path);
  }
  return named;
}

async function productControls(context) {
  if (!context.product) return el("section", "settings-product panel",
    el("p", null, "Choose a product to edit its repository settings."),
    explain("settings-product-none"));
  const { settings, collaborators } = await settingsSchemas();
  let repository;
  try { repository = await context.product.host.repositoryInfo(); }
  catch (error) {
    return el("section", "settings-product panel",
      el("h3", null, `Product · ${context.product.address}`), productLinks(context),
      el("p", "settings-product-read-only", `Repository metadata is unavailable: ${error.message}`),
      explain("settings-product-unavailable"));
  }
  const { defaultBranch } = repository;
  const address = parseAddress(context.product.address);
  const credential = credentialsFor(context.store, address);
  const canWrite = Boolean(credential?.token && repository.canWrite === true);
  const snapshot = await context.product.host.readSnapshot(defaultBranch);
  const workflow = await jobWorkflowLine(context, { address, defaultBranch, snapshot, canWrite });
  const settingsText = await snapshot.read(settings.path);
  const collaboratorsText = await snapshot.read(collaborators.path);
  const legacyOff = (text) => /(^|\n)- pseudonymisation: off(?:\n|$)/.test(text ?? "");
  const settingState = (document, text) => legacyOff(text) ? "off" : pseudonymisationOf(document);
  let settingsDocument = readDocument(settings, settings.path, settingsText ?? "# Settings of this product\n");
  const newCollaborators = `# Collaborators of ${address.path}\n\n| Name | Account | Agreed |\n|---|---|---|\n`;
  let collaboratorsBytes = collaboratorsText ?? newCollaborators;
  let collaboratorsDocument = readDocument(collaborators, collaborators.path, collaboratorsBytes);
  let settingsBlob = snapshot.blob(settings.path), collaboratorsBlob = snapshot.blob(collaborators.path);
  let settingsBytes = settingsText ?? "# Settings of this product\n";
  const legacyCollaborators = [...collaboratorsBytes.matchAll(/^\|\s*([^|]+?)\s*\|\s*@?([^|]+?)\s*\|\s*(\d{4}-\d{2}-\d{2})\s*\|\s*$/gm)]
    .map((row) => ({ name: row[1].trim(), account: row[2].trim().replace(/^@/, ""), agreed: row[3] }));
  const collaboratorRows = legacyCollaborators.length ? legacyCollaborators : (collaboratorsDocument.sections[0]?.rows ?? [])
    .map((row) => ({ name: row.cells.Name, account: String(row.cells.Account ?? "").replace(/^@/, ""), agreed: row.cells["Agreed on"] ?? row.cells.Agreed ?? "recorded" }));
  const state = el("p", "settings-pseudonymisation-state", `Pseudonymisation is ${settingState(settingsDocument, settingsBytes)}.`);
  const collaboratorRecords = el("ul", "settings-collaborator-records", ...collaboratorRows.map((row) => el("li", null, `${row.name} · @${row.account} · agreed on ${row.agreed}`)));
  const access = repository.canWrite === true ? "writable" : repository.canWrite === false ? "read-only" : "not reported";
  if (!canWrite) {
    const tokenStep = el("button", "settings-product-token-step btn", "Open the token step of UC-001");
    tokenStep.addEventListener("click", () => context.go("add-product", { address: context.product.address }));
    const reason = credential?.token ? "The repository reports this credential cannot write." : "This browser has no token that can write to this product.";
    return el("section", "settings-product panel",
      el("h3", null, `Product · ${context.product.address}`), productLinks(context),
      el("p", "settings-product-access", `Repository access: ${access}.`),
      el("p", "settings-product-read-only", `Read-only: ${reason} `, tokenStep),
      state,
      explain("settings-product-read-only"),
      workflow,
      el("h4", null, "Collaborators"),
      el("ul", "settings-collaborator-records", ...collaboratorRows.map((row) => el("li", null, `${row.name} · @${row.account} · agreed on ${row.agreed}`))));
  }
  const off = el("input", "settings-pseudonymisation-off"); off.type = "checkbox"; off.checked = settingState(settingsDocument, settingsBytes) === "off";
  const acknowledgement = el("input", "settings-pseudonymisation-ack"); acknowledgement.type = "checkbox";
  const save = el("button", "settings-pseudonymisation-save btn primary", "Save pseudonymisation");
  const pseudoResult = el("p", "settings-pseudonymisation-result");
  save.addEventListener("click", async (event) => {
    if (!event.isTrusted) return;
    if (off.checked && !acknowledgement.checked) { pseudoResult.textContent = "Tick I have read this before switching pseudonymisation off."; return; }
    const legacy = /(^|\n)- pseudonymisation: (?:on|off)(?=\n|$)/;
    const edited = { ...settingsDocument, fields: { ...settingsDocument.fields, pseudonymisation: off.checked ? "off" : "on" } };
    const text = legacy.test(settingsBytes) ? (off.checked ? settingsBytes.replace(legacy, "$1- pseudonymisation: off") : settingsBytes.replace(legacy, ""))
      : (writeDocument(settings, edited) || `---\npseudonymisation: ${off.checked ? "off" : "on"}\n---\n# Settings of this product\n`);
    let result;
    try { result = await saveFile(context.product.host, { path: settings.path, text, openedBlob: settingsBlob }); } catch (error) { pseudoResult.textContent = error?.message ?? String(error); return; }
    if (result.refused) { pseudoResult.textContent = "Product settings changed meanwhile; nothing was written."; return; }
    settingsBlob = result.blob; settingsBytes = text; settingsDocument = readDocument(settings, settings.path, text);
    state.textContent = `Pseudonymisation is ${settingState(settingsDocument, settingsBytes)}.`;
    pseudoResult.textContent = "Saved in the product repository.";
  });
  const name = el("input", "settings-collaborator-name"), account = el("input", "settings-collaborator-account");
  const agreed = el("input", "settings-collaborator-agreed"); agreed.type = "checkbox";
  const agreedDate = el("input", "settings-collaborator-agreed-date"); agreedDate.type = "date"; agreedDate.value = new Date().toISOString().slice(0, 10);
  const add = el("button", "settings-collaborator-save btn primary", "Save collaborator"); const collabResult = el("p", "settings-collaborator-result");
  // The host's refusal of a save (SecretRefused, Moved, …) is shown in the result line, as the recording's write shows it, and the save does not go on.
  const saveCollaborators = async (text) => {
    try { return await saveFile(context.product.host, { path: collaborators.path, text, openedBlob: collaboratorsBlob }); } catch (error) { collabResult.textContent = error?.message ?? String(error); return null; }
  };
  const namedFiles = el("div", "settings-collaborator-named");
  const removeName = el("input", "settings-collaborator-remove-name"), removeAccount = el("input", "settings-collaborator-remove-account");
  const remove = el("button", "settings-collaborator-remove btn", "Remove collaborator consent");
  add.addEventListener("click", async (event) => {
    if (!event.isTrusted) return;
    if (!agreed.checked) { collabResult.textContent = "Tick that this person has agreed to be named."; return; }
    const legacyRows = [...collaboratorsBytes.matchAll(/^\|\s*([^|]+?)\s*\|\s*@?([^|]+?)\s*\|\s*(\d{4}-\d{2}-\d{2})\s*\|\s*$/gm)];
    if (legacyRows.length || /\| Name \| Account \| Agreed on \|/.test(collaboratorsBytes)) {
      const date = agreedDate.value;
      const text = `${collaboratorsBytes}${collaboratorsBytes.endsWith("\n") ? "" : "\n"}| ${name.value.trim()} | @${account.value.trim().replace(/^@/, "")} | ${date} |\n`;
      const result = await saveCollaborators(text); if (!result) return;
      if (result.refused) { collabResult.textContent = "Collaborators changed meanwhile; nothing was written."; return; }
      collaboratorsBlob = result.blob; collaboratorsBytes = text;
      const records = el("li", null, `${name.value.trim()} · @${account.value.trim().replace(/^@/, "")} · agreed on ${date}`);
      collaboratorRecords.append(records);
      collabResult.textContent = "Saved in the product repository."; return;
    }
    const rows = collaboratorsDocument.sections[0]?.rows ?? [];
    const edited = { ...collaboratorsDocument, sections: [{ ...(collaboratorsDocument.sections[0] ?? { heading: "# Collaborators of this product", line: 1, text: "", rows: [] }), rows: [...rows, { line: null, cells: { Name: name.value.trim(), Account: account.value.trim(), Agreed: "yes" } }] }] };
    const text = writeDocument(collaborators, edited) || `${newCollaborators}| ${name.value.trim()} | ${account.value.trim()} | yes |\n`;
    const result = await saveCollaborators(text); if (!result) return;
    if (result.refused) { collabResult.textContent = "Collaborators changed meanwhile; nothing was written."; return; }
    collaboratorsBlob = result.blob; collaboratorsDocument = readDocument(collaborators, collaborators.path, text);
    collaboratorRecords.append(el("li", null, `${name.value.trim()} · @${account.value.trim().replace(/^@/, "")} · agreed on recorded`));
    collabResult.textContent = "Saved in the product repository.";
  });
  remove.addEventListener("click", async (event) => {
    if (!event.isTrusted) return;
    const wantedName = removeName.value.trim(), wantedAccount = removeAccount.value.trim().replace(/^@/, "");
    if (!wantedName || !wantedAccount) { collabResult.textContent = "Enter the collaborator name and account to remove consent."; return; }
    const legacyRows = [...collaboratorsBytes.matchAll(/^\|\s*([^|]+?)\s*\|\s*@?([^|]+?)\s*\|\s*(\d{4}-\d{2}-\d{2})\s*\|\s*$/gm)];
    const legacy = legacyRows.find((row) => row[1].trim() === wantedName && row[2].trim().replace(/^@/, "") === wantedAccount);
    let text;
    if (legacy) text = `${collaboratorsBytes.slice(0, legacy.index)}${collaboratorsBytes.slice(legacy.index + legacy[0].length).replace(/^\n/, "")}`;
    else {
      const rows = collaboratorsDocument.sections[0]?.rows ?? [];
      const kept = rows.filter((row) => row.cells.Name !== wantedName || String(row.cells.Account ?? "").replace(/^@/, "") !== wantedAccount);
      if (kept.length === rows.length) { collabResult.textContent = "No matching consenting collaborator is stored."; return; }
      text = writeDocument(collaborators, { ...collaboratorsDocument, sections: [{ ...collaboratorsDocument.sections[0], rows: kept }] });
    }
    const result = await saveCollaborators(text); if (!result) return;
    if (result.refused) { collabResult.textContent = "Collaborators changed meanwhile; nothing was written."; return; }
    collaboratorsBlob = result.blob; collaboratorsBytes = text; collaboratorsDocument = readDocument(collaborators, collaborators.path, text);
    collaboratorRecords.replaceChildren(...Array.from(collaboratorRecords.childNodes).filter((node) => !node.textContent.startsWith(`${wantedName} · @${wantedAccount} ·`)));
    collabResult.textContent = "Removed this collaborator's consent record; earlier commits keep the name in the history. ";
    if (result.commit) { const address = parseAddress(context.product.address); const link = el("a", "settings-collaborator-withdrawal-commit", "View removal commit"); link.href = `${address.web}/${address.server === "gitlab" ? "-/commit" : "commit"}/${result.commit}`; collabResult.append(link); }
    try {
      const named = await filesNamingWithdrawn(context.product.host, defaultBranch, wantedName, collaborators.path, collaboratorsDocument);
      namedFiles.replaceChildren(...(named.length ? [el("p", null, `${named.length === 1 ? "This file on" : "These files on"} the default branch still ${named.length === 1 ? "names" : "name"} ${wantedName}; change ${named.length === 1 ? "it" : "them"}:`),
        el("ul", "settings-collaborator-named-files", ...named.map((path) => el("li", null, path)))]
        : [el("p", "settings-collaborator-named-none", `No file on the default branch still names ${wantedName}.`)]));
    } catch (error) { namedFiles.replaceChildren(el("p", "warn", `The files that still name ${wantedName} could not be read: ${error?.message ?? error}`)); }
  });
  const publication = repository.visibility === "public" ? `${address.server === "github" ? "GitHub" : "GitLab"} reports ${address.path} as public: the data will be published — anyone on the internet can read it.` : `The repository is not reported public; use only a protected, non-public data space.`;
  return el("section", "settings-product panel",
    el("h3", null, `Product · ${context.product.address}`), productLinks(context), state,
    explain("settings-product-records"),
    workflow,
    el("p", null, el("label", null, off, " Switch pseudonymisation off")),
    el("p", "notice", "With pseudonymisation on, report data is rewritten without persons while keeping its technical content."),
    el("p", "notice", `With pseudonymisation off, report data from mails — the names, addresses and other details of the people who write — enters the issues and the repository of ${address.path} unchanged. This is advisable only on a protected, non-public data space. Issue texts themselves stay neutral either way. ${publication} Data already written remains in history; removing that data requires a history rewrite.`),
    el("p", null, el("label", null, acknowledgement, " I have read this."), " ", save), pseudoResult,
    el("h4", null, "Collaborators"),
    collaboratorRecords,
    el("p", null, el("label", null, "Name ", name)), el("p", null, el("label", null, "Account ", account)),
    el("p", null, el("label", null, agreed, " This person has agreed to be named."), " ", el("label", null, "Consent date ", agreedDate), " ", add),
    el("h4", null, "Remove collaborator consent"),
    el("p", null, el("label", null, "Name ", removeName)), el("p", null, el("label", null, "Account ", removeAccount)),
    el("p", null, "Earlier commits keep the name in the history. ", remove), collabResult, namedFiles);
}

// ---------------------------------------------------------------- the repository settings (UC-042 step 3)

const PARTICIPANT_REGISTER = "docs/participants.md", RESOURCE_REGISTER = "docs/resources.md", PROCESS_DECLARATION = "docs/process.md", LINKED_SOURCES = "docs/sources.md", SCHEDULE_FILE = "docs/tests/schedule.md";
const NOT_SET = "not set";
// The instance's own list is the route `resources` with no product: the empty product, which the frame's `go` reads as the instance itself.
const INSTANCE_RESOURCES = ["resources", { product: "" }];

const plural = (count, one) => `${count} ${count === 1 ? one : `${one}s`}`;
const rowsIn = (schema, path, text) => (typeof text === "string" ? readRegister(schema, path, text).rows.length : 0);
const countSummary = (count, one) => (count ? plural(count, one) : NOT_SET);
// The names of the files directly below a folder of a snapshot, without their extension, in the snapshot's order.
const namesBelow = (snapshot, folder, prefix = "") => snapshot.paths.filter((path) => path.startsWith(`${folder}/${prefix}`) && path.endsWith(".md") && !path.slice(folder.length + 1).includes("/"))
  .map((path) => path.slice(folder.length + 1, -".md".length));
const declarationOf = async (snapshot) => {
  const text = await snapshot.read(PROCESS_DECLARATION);
  return typeof text === "string" ? readDocument(declarationSchema, PROCESS_DECLARATION, text) : null;
};

// The instance's four settings and the product's six: the title of the line, the route its *Edit* opens, and the summary read from the repository's snapshot.
const INSTANCE_SETTINGS = [
  ["Participants", "participants", async (snapshot) => countSummary(rowsIn(participantSchema(), PARTICIPANT_REGISTER, await snapshot.read(PARTICIPANT_REGISTER)), "participant")],
  ["Source library", "library", async (snapshot) => countSummary(namesBelow(snapshot, "docs/sources", "SRC-").length, "source")],
  ["Process models", "models", async (snapshot) => countSummary(namesBelow(snapshot, "docs/process-models").length, "model")],
  ["Resources", INSTANCE_RESOURCES, async (snapshot) => countSummary(rowsIn(resourceSchema(), RESOURCE_REGISTER, await snapshot.read(RESOURCE_REGISTER)), "resource")],
];
const PRODUCT_SETTINGS = [
  ["Process model", "process", async (snapshot) => (await declarationOf(snapshot))?.fields.model ?? NOT_SET],
  ["Role assignments", "roles", async (snapshot) => namesBelow(snapshot, "docs/role-assignments").join(", ") || NOT_SET],
  ["Definition of Done", "process", async (snapshot) => {
    const section = (await declarationOf(snapshot))?.sections.find((candidate) => candidate.heading === "## Definition of Done");
    return section?.text.trim().split("\n")[0] || NOT_SET;
  }],
  ["Test schedule", "schedule", async (snapshot) => (snapshot.paths.includes(SCHEDULE_FILE) ? "set" : NOT_SET)],
  ["Linked sources", "sources", async (snapshot) => countSummary(rowsIn(sourceSchemas().links, LINKED_SOURCES, await snapshot.read(LINKED_SOURCES)), "linked source")],
  ["Resources", "resources", async (snapshot) => countSummary(rowsIn(resourceSchema(), RESOURCE_REGISTER, await snapshot.read(RESOURCE_REGISTER)), "resource")],
];

// The topic of MOD-site-frame's explanations behind each line, in the order of the settings above, and behind each section.
const INSTANCE_TOPICS = ["settings-line-participants", "settings-line-library", "settings-line-models", "settings-line-instance-resources"];
const PRODUCT_TOPICS = ["settings-line-process", "settings-line-roles", "settings-line-done", "settings-line-schedule", "settings-line-sources", "settings-line-product-resources"];

// One section of lines: each setting is a line with its title, its summary and *Edit*, which opens the route of the setting. `load()` reads the repository's default branch once,
// when the tab that holds the section is shown, and fills the summaries; a repository that cannot be read leaves each summary saying so.
function repositorySettings(context, { className, heading, topic, topics, settings, hostOf }) {
  const lines = settings.map(([title, route], index) => {
    const summary = el("span", "settings-repository-setting-summary", "Not read yet.");
    const edit = el("button", "settings-repository-setting-edit btn", "Edit");
    edit.addEventListener("click", () => context.go(...[route].flat()));
    return { node: el("div", "settings-repository-setting", el("strong", "settings-repository-setting-title", title), " ", summary, " ", edit, explain(topics[index])), summary };
  });
  const node = el("section", `${className} panel`, el("h3", null, heading), explain(topic), ...lines.map((line) => line.node));
  let loaded = false;
  const load = async () => {
    if (loaded) return;
    loaded = true;
    try {
      const host = hostOf();
      const snapshot = await host.readSnapshot((await host.repositoryInfo()).defaultBranch);
      for (const [index, [, , summaryOf]] of settings.entries()) lines[index].summary.textContent = await summaryOf(snapshot);
    } catch (error) {
      for (const line of lines) line.summary.textContent = `Could not be read: ${error?.message ?? error}`;
    }
  };
  return { node, load };
}

// The tabs of the page: the one whose id `chosenId` names is selected, else the first; `choose` hears each id selected.
function tabbedSettings(panes, chosenId, choose) {
  const tabs = el("div", "settings-tabs");
  attribute(tabs, "role", "tablist");
  const buttons = [];
  const select = (selected) => {
    for (const { button, pane, id } of buttons) {
      const chosen = button === selected;
      attribute(button, "aria-selected", String(chosen));
      button.className = chosen ? "settings-tab btn primary" : "settings-tab btn";
      button.tabIndex = chosen ? 0 : -1;
      pane.hidden = !chosen;
      if (chosen) choose(id);
    }
    selected.focus();
  };
  for (const pane of panes) {
    attribute(pane.node, "role", "tabpanel");
    attribute(pane.node, "aria-label", pane.name);
    const button = el("button", "settings-tab btn", pane.name);
    attribute(button, "role", "tab");
    attribute(button, "aria-controls", pane.id);
    pane.node.id = pane.id;
    button.addEventListener("click", () => select(button));
    button.addEventListener("keydown", (event) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault();
      const index = buttons.findIndex((candidate) => candidate.button === button);
      select(buttons[(index + (event.key === "ArrowRight" ? 1 : buttons.length - 1)) % buttons.length].button);
    });
    buttons.push({ button, pane: pane.node, id: pane.id });
    tabs.append(button);
  }
  select((buttons.find((entry) => entry.id === chosenId) ?? buttons[0]).button);
  return { tabs, panels: panes.map((pane) => pane.node) };
}

function configurationControls(context) {
  const endpoint = el("button", "settings-endpoint-configure btn", "Configure a model endpoint");
  const bridge = el("button", "settings-bridge-configure btn", "Configure the Agent M Bridge");
  endpoint.addEventListener("click", () => context.go("endpoints", {}));
  bridge.addEventListener("click", () => context.go("bridge", {}));
  return el("p", "settings-configure", endpoint, " ", bridge);
}

export const route = {
  ...heads.settings,
  subject: (params, context) => settingsSubject(context, () => drawnOn.get(context)?.textContent ?? ""),
  async render(target, given) {
    drawnOn.set(given, target);
    // A line that renders the page again hands back the context of its tab; the page keeps its own.
    const context = given[PAGE] ?? pageContext(given);
    // UC-042 steps 2 and 3, UC-011 step 1, UC-044 step 4: the forms that set up a model endpoint or the Bridge open in
    // place, in the tab Endpoints & Agents under its buttons, one at a time; Add a product opens in the tab Repositories,
    // under the product list. Every other route, and these from other pages, go through the page's own context.
    // Each opens as a card, as a setting line is one; empty, the card is not shown.
    const form = el("div", "settings-configure-form panel");
    const productForm = el("div", "settings-product-form panel");
    form.hidden = productForm.hidden = true;
    // The endpoints this browser keeps, one line each, listed anew whenever the endpoint form in place stored, tested or
    // cleared one (UC-042 step 2), while the form stays open with its result.
    const endpoints = el("div", "settings-endpoints");
    const listEndpoints = () => endpoints.replaceChildren(...listSettings(context.store)
      .filter((setting) => setting.key.startsWith("endpoint:"))
      .map((setting) => endpointLine(target, inPlace, setting))
      .filter(Boolean));
    const inPlace = {
      ...context,
      [PAGE]: context,
      async go(name, params = {}) {
        const [guided, place] = { endpoints: [endpointsRoute, form], bridge: [bridgeRoute, form],
          "add-product": [addProductRoute, productForm] }[name] ?? [];
        if (!guided) return context.go(name, params);
        place.hidden = false;
        await guided.render(place, inPlace, params);
      },
      endpointsChanged: listEndpoints,
      // A form opened here that stores a token tells the page, which then connects its hosts with what the store holds.
      tokenStored: () => reconnectHosts(context),
    };
    listEndpoints();
    const bridge = bridgeLine(target, inPlace);
    const jumpHost = jumpHostLine(target, inPlace);
    const remoteSessions = listSettings(context.store).map((info) => remoteSessionLine(target, inPlace, info)).filter(Boolean);
    const sessions = listSettings(context.store).map((info) => sessionLine(target, inPlace, info)).filter(Boolean);
    const namedBridges = listSettings(context.store).filter((info) => info.key.startsWith("bridge:"))
      .map((info) => bridgeNamedLine(target, inPlace, info)).filter(Boolean);
    const general = el("section", "settings-tab-panel",
      el("h3", null, "General · this browser"),
      el("div", "settings-browser-explanation", explain("endpoint-route")),
      el("p", "notice settings-shared-origin", sharedPagesNotice(context)),
      browserIdLine(target, context), notAnIssueLine(target, context), exportImportControls(context, await carriesSignIn(context.store)), browserClearControls(context));
    const product = await productControls(context);
    const recording = recordingControls(context);
    const instanceSettings = repositorySettings(inPlace, { className: "settings-instance-settings", heading: "Instance · settings kept in its repository", topic: "settings-instance-lines", topics: INSTANCE_TOPICS, settings: INSTANCE_SETTINGS, hostOf: () => context.instance.host });
    const productSettings = context.product && repositorySettings(inPlace, { className: "settings-product-settings", heading: "Product · settings kept in its repository", topic: "settings-product-lines", topics: PRODUCT_TOPICS, settings: PRODUCT_SETTINGS, hostOf: () => context.product.host });
    const productList = productListControls(target, context);
    const repositories = el("section", "settings-tab-panel",
      el("h3", null, "Repositories · browser credentials and product records"),
      ...listSettings(context.store).flatMap((info) => {
        const line = repositoryLine(target, inPlace, info);
        return !line ? [] : info.key === "products" ? [line, productForm] : [line];
      }),
      recording.node, instanceSettings.node, ...(productList ? [productList] : []), product, ...(productSettings ? [productSettings.node] : []));
    const endpointPane = el("section", "settings-tab-panel",
      el("h3", null, "Endpoints & Agents · this browser"),
      configurationControls(inPlace), form,
      ...(bridge ? [bridge] : []), ...namedBridges, ...(jumpHost ? [jumpHost] : []),
      ...remoteSessions, ...sessions,
      mailboxSetting(inPlace),
      ...(given[CLEARED] ? [el("p", "settings-endpoint-cleared", given[CLEARED])] : []),
      endpoints);
    const usability = el("section", "settings-tab-panel",
      el("h3", null, "Usability · this browser"), notificationsControls(context));
    const tabbed = tabbedSettings([
      { name: "General", id: "settings-general", node: general },
      { name: "Repositories", id: "settings-repositories", node: repositories },
      { name: "Endpoints & Agents", id: "settings-endpoints-agents", node: endpointPane },
      { name: "Usability", id: "settings-usability", node: usability },
    ], chosenTabs.get(context), (id) => { chosenTabs.set(context, id); if (id === "settings-repositories") { recording.load(); instanceSettings.load(); productSettings?.load(); } });
    target.replaceChildren(el("section", "head", el("h2", null, "Settings")), tabbed.tabs, ...tabbed.panels);
  },
};
