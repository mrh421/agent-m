// MOD-settings-pages' Bridge configuration route (UC-044).  Pairing is the only operation here that contacts a
// Bridge; the jump-host record is browser configuration and its Save button deliberately makes no request.

import { allocatePort, bridgeAt, pair, proxyConfiguration, settingsOf, testBridge, tunnelCommands } from "../bridge-client/index.mjs";
import { clearSetting, listSettings, readSetting, writeSetting } from "../browser-store/index.mjs";
import { endpointLacks } from "../prompt-bar/index.mjs";
import { explain } from "../site-frame/index.mjs";
import { CAPABILITIES, PRESETS } from "./participants.mjs";
import { heads } from "./routes.mjs";

function el(name, className, ...children) {
  const node = document.createElement(name);
  if (className) node.className = className;
  node.append(...children);
  return node;
}
// A part of the page under its heading: the frame's panel.
const part = (heading, ...nodes) => el("section", "panel", el("h3", null, heading), ...nodes);

// The system of the browser, from its user agent: the file of the release for it is the installer or the image MOD-bridge-build makes for that platform. The macOS .zip is the updater's, and no person downloads it.
const BRIDGE_FILE = { windows: /\.exe$/i, macos: /\.dmg$/i, linux: /\.AppImage$/i };
function systemOf(agent) {
  const text = String(agent ?? "");
  if (/Android/i.test(text)) return null;
  if (/Windows/i.test(text)) return "windows";
  if (/Macintosh|Mac OS X/i.test(text)) return "macos";
  if (/X11|Linux/i.test(text)) return "linux";
  return null;
}
const megabytes = (size) => `${(size / 1e6).toFixed(1)} MB`;

// The download of the Bridge (UC-044 steps 1 and 2): the latest release of the instance, the one file of it for this computer's system with its size and the SHA-256 the server reports for it — or, where it reports none,
// a link to the release's checksum file —, the explanation of the two levels and, folded beside it, why the system may warn. A release that cannot be read is said so; the page stands.
// The section is drawn at once, with its heading and the explanation of the levels; its file stands in it once the release is read (`done`), so that the rest of the page does not wait for the server.
function downloadSection(context) {
  const host = context.instance?.host;
  if (typeof host?.listReleaseAssets !== "function") return null;
  const section = el("section", "bridge-download panel", el("h3", null, "Get the Bridge"), explain("bridge-levels"));
  return { section, done: offerFile(host, section) };
}

// The publisher to look for: the name of the line `Publisher (<system>): <name>` that the release's notes hold for the system (MOD-bridge-build writes one for macOS and one for Windows, none for Linux, where the
// system checks no code signature); null where the notes hold none, and then no name is written.
const PUBLISHER_LABEL = { windows: "Windows", macos: "macOS" };
function publisherOf(notes, system) {
  const label = PUBLISHER_LABEL[system];
  const line = label === undefined ? null : new RegExp(`^Publisher \\(${label}\\): (.+)$`, "m").exec(String(notes ?? ""));
  const name = line?.[1].trim() ?? "";
  return name === "" ? null : name;
}

async function offerFile(host, section) {
  let publisher = null;
  try {
    const { assets, notes } = await host.listReleaseAssets("latest");
    const system = systemOf(globalThis.navigator?.userAgent);
    const file = system === null ? undefined : assets.find((asset) => BRIDGE_FILE[system].test(asset.name));
    if (file === undefined) {
      section.append(el("p", "bridge-no-file", "The release holds no file for this system."));
    } else {
      const link = el("a", "bridge-file", file.name);
      link.setAttribute("href", file.url);
      section.append(el("p", null, link, ...(file.size === null ? [] : [" ", el("span", "bridge-size", megabytes(file.size))])));
      if (file.sha256 !== null) {
        section.append(el("p", null, "SHA-256 ", el("code", "bridge-sha256", file.sha256)));
      } else {
        const sums = assets.find((asset) => asset.name === "SHA256SUMS");
        if (sums !== undefined) {
          const sumsLink = el("a", "bridge-checksums", "Open the release's checksum file");
          sumsLink.setAttribute("href", sums.url);
          section.append(el("p", null, sumsLink));
        }
      }
      publisher = publisherOf(notes, system);
      section.append(publisher === null ? el("p", "bridge-no-publisher", "The release names no publisher for this system.")
        : el("p", null, "Publisher to look for: ", el("span", "bridge-publisher", publisher)));
    }
  } catch (failure) {
    section.append(el("p", "bridge-download-problem", `The Bridge's release could not be read: ${failure?.message ?? failure}.`));
  }
  const warning = explain("bridge-signed-warning", "Why this warning?");
  if (publisher !== null) warning.append(el("p", "bridge-publisher-in-warning", `The publisher to look for: ${publisher}.`));
  section.append(warning);
}

function sharedPagesNotice(context) {
  const owner = String(context.instance?.repository ?? "").split("/")[0];
  return `Everything Agent M stores in this browser is stored for the address https://${owner}.github.io — every GitHub Pages site under that same ${owner}.github.io domain can read it.`;
}

function failureText(error) {
  if (error?.name === "TokenRefused") return "The Bridge refused this pairing token. Copy its current token and pair again.";
  if (error?.name === "JumpHostLoginRefused") return "The jump host refused its login. Check the jump-host login and save it again.";
  if (error?.name === "NoAnswer") return `The Bridge gave no answer. Check ${error.likely?.join(", ") ?? "its address"}.`;
  if (error?.name === "Timeout") return "The Bridge did not answer in time. Check that it is running, then pair again.";
  return `The Bridge could not be paired: ${error?.message ?? error}.`;
}

function testFailureText(error) {
  if (error?.name === "JumpHostMissing") return "This Bridge is reached through the jump host, and no jump host is stored. Set it up below.";
  if (["TokenRefused", "JumpHostLoginRefused", "NoAnswer", "Timeout"].includes(error?.name)) return failureText(error).replace("pair again", "test again");
  return `The Bridge could not be tested: ${error?.message ?? error}.`;
}

// The CLI session a Bridge offers for one agent (UC-049 1b): the place where it processes data, its context in tokens, its model and its capabilities, kept as `session:<bridge>:<agent>` in the shape of an endpoint's declaration.
// What is kept prefills the form; where nothing is kept the capabilities are the preset of a CLI agent (UC-017), and a session lacking a place, a context or a model is named as not offered in the prompt bar.
function sessionForm(store, bridge, agent) {
  const key = `session:${bridge}:${agent.name}`;
  const kept = readSetting(store, key);
  const place = el("input", "bridge-session-place");
  const contextSize = el("input", "bridge-session-context");
  const model = el("input", "bridge-session-model");
  const capabilities = CAPABILITIES.map((capability) => {
    const box = el("input", "bridge-session-capability");
    box.type = "checkbox";
    box.value = capability;
    box.checked = (Array.isArray(kept?.capabilities) ? kept.capabilities : PRESETS["CLI agent"]).includes(capability);
    return box;
  });
  const lacks = el("div", "bridge-session-lacks-slot");
  const save = el("button", "bridge-session-save btn primary", "Save session");
  const result = el("p", "bridge-session-result");
  place.placeholder = "Provider and country, or this machine";
  contextSize.placeholder = "Context in tokens";
  contextSize.inputMode = "numeric";
  model.placeholder = "Model name";
  place.value = kept?.place ?? "";
  contextSize.value = kept?.context ? String(kept.context) : "";
  model.value = kept?.model ?? "";
  for (const input of [place, contextSize, model]) { input.autocomplete = "off"; input.spellcheck = false; }
  const nameWhatLacks = (setting) => {
    const missing = endpointLacks(setting);
    lacks.replaceChildren(...(missing.length
      ? [el("p", "notice bridge-session-lacks", `The prompt bar does not offer ${agent.name}: it lacks ${missing.join(" and ")}. Enter ${missing.length === 1 ? "it" : "them"} below and save.`)] : []));
  };
  nameWhatLacks(kept);
  save.addEventListener("click", () => {
    const value = {};
    if (place.value.trim()) value.place = place.value.trim();
    const tokens = Number(contextSize.value.trim());
    if (Number.isInteger(tokens) && tokens > 0) value.context = tokens;
    if (model.value.trim()) value.model = model.value.trim();
    value.capabilities = capabilities.filter((box) => box.checked).map((box) => box.value);
    try {
      writeSetting(store, key, value);
      result.textContent = `The session ${agent.name} of ${bridge} is kept in this browser.`;
    } catch (error) {
      result.textContent = `The session could not be kept: ${error?.message ?? error}.`;
    }
    nameWhatLacks(value);
  });
  return el("section", "bridge-session panel",
    el("h4", null, "CLI session: ", el("span", "bridge-session-agent", agent.name)), lacks,
    el("p", null, el("label", null, "Processing place ", place)),
    el("p", null, el("label", null, "Context (tokens) ", contextSize)),
    el("p", null, el("label", null, "Model ", model)),
    el("p", null, "Capabilities ", ...capabilities.flatMap((box) => [el("label", null, box, ` ${box.value}`), " "])),
    el("p", null, save), result);
}

// A Bridge this browser keeps, with *Test*: the two requests of testBridge, then a form for each CLI session the Bridge lists ready. Drawing it sends nothing.
function keptBridge(store, entry) {
  const test = el("button", "bridge-kept-test btn", "Test");
  const result = el("p", "bridge-kept-result");
  const sessions = el("div", "bridge-kept-sessions");
  test.addEventListener("click", async () => {
    try {
      const settings = settingsOf(entry, readSetting(store, "jump-host"));
      result.textContent = `Testing ${entry.name} at ${settings.address}…`;
      const ready = (await testBridge(bridgeAt(settings))).agents.filter((agent) => agent.ready);
      result.textContent = ready.length ? `✓ ${entry.name} offers ${ready.map((agent) => agent.name).join(", ")}.` : `✓ ${entry.name} answers and offers no CLI session that is ready.`;
      sessions.replaceChildren(...ready.map((agent) => sessionForm(store, entry.name, agent)));
    } catch (error) {
      result.textContent = `✗ ${testFailureText(error)}`;
      sessions.replaceChildren();
    }
  });
  return el("section", "bridge-kept panel", el("h4", null, "Bridge: ", el("span", "bridge-kept-name", entry.name)), el("p", null, test), result, sessions);
}

function applyBridge(fields, setting) {
  fields.address.value = setting?.address ?? "http://127.0.0.1:4711";
  fields.token.value = setting?.token ?? "";
}

function applyJumpHost(fields, setting) {
  fields.hostname.value = setting?.hostname ?? "";
  fields.user.value = setting?.user ?? "";
  fields.sshPort.value = String(setting?.sshPort ?? 22);
  fields.portFirst.value = String(setting?.portRange?.[0] ?? 40100);
  fields.portLast.value = String(setting?.portRange?.[1] ?? 40199);
  fields.httpsAddress.value = setting?.httpsAddress ?? "";
  fields.loginUser.value = setting?.login?.user ?? "";
  fields.loginPassword.value = setting?.login?.password ?? "";
}

function trustedHttpsAddress(value) {
  let url;
  try { url = new URL(value); } catch { return null; }
  return url.protocol === "https:" && !url.username && !url.password ? url.toString().replace(/\/$/, "") : null;
}

function remoteSessions(store) {
  return listSettings(store)
    .filter((setting) => setting.key.startsWith("remote-session:"))
    .map((setting) => {
      const session = readSetting(store, setting.key);
      return session && typeof session === "object" ? { ...session, name: setting.key.slice("remote-session:".length) } : null;
    })
    .filter(Boolean);
}

// The Bridges this browser keeps under their names: { name, address, token } or { name, port, token }.
function namedBridges(store) {
  return listSettings(store)
    .filter((setting) => setting.key.startsWith("bridge:"))
    .map((setting) => {
      const entry = readSetting(store, setting.key);
      return entry && typeof entry === "object" ? { ...entry, name: setting.key.slice("bridge:".length) } : null;
    })
    .filter(Boolean);
}

function instanceOrigin() {
  const origin = globalThis.location?.origin;
  return typeof origin === "string" && origin.startsWith("https://") ? origin : null;
}

function usableJumpHost(jumpHost) {
  return jumpHost && typeof jumpHost.hostname === "string" && jumpHost.hostname && typeof jumpHost.user === "string" && jumpHost.user
    && Number.isInteger(jumpHost.sshPort) && Array.isArray(jumpHost.portRange);
}

export const route = {
  ...heads.bridge,
  async render(target, context, params = {}) {
    const address = el("input", "bridge-address");
    const token = el("input", "bridge-token");
    const show = el("button", "bridge-show btn small", "Show");
    const pairButton = el("button", "bridge-pair btn primary", "Pair Bridge");
    const clear = el("button", "bridge-clear btn", "Clear");
    const result = el("p", "bridge-result");
    const hostname = el("input", "jump-host-name");
    const user = el("input", "jump-host-user");
    const sshPort = el("input", "jump-host-ssh-port");
    const portFirst = el("input", "jump-host-port-first");
    const portLast = el("input", "jump-host-port-last");
    const httpsAddress = el("input", "jump-host-https-address");
    const httpsBridgeToken = el("input", "jump-host-bridge-token");
    const showHttpsBridgeToken = el("button", "jump-host-bridge-show btn small", "Show");
    const loginUser = el("input", "jump-host-login-user");
    const loginPassword = el("input", "jump-host-login-password");
    const showLoginPassword = el("button", "jump-host-login-show btn small", "Show");
    const saveJumpHost = el("button", "jump-host-save btn primary", "Save HTTPS connection");
    const jumpResult = el("p", "jump-host-result");
    const throughName = el("input", "bridge-through-jump-name");
    const throughToken = el("input", "bridge-through-jump-token");
    const showThroughToken = el("button", "bridge-through-jump-show btn small", "Show");
    const addThrough = el("button", "bridge-through-jump-add btn primary", "+ Bridge through the jump host");
    const throughResult = el("p", "bridge-through-jump-result");
    const throughCommands = el("pre", "bridge-through-jump-commands");
    const bridgeApache = el("pre", "bridge-proxy-apache");
    const bridgeNginx = el("pre", "bridge-proxy-nginx");
    const remoteSessionSelect = el("select", "remote-session-select");
    const remoteSessionName = el("input", "remote-session-name");
    const remoteSessionToken = el("input", "remote-session-token");
    const showRemoteSessionToken = el("button", "remote-session-show btn small", "Show");
    const remoteKey = el("input", "remote-session-reverse-key");
    const localKey = el("input", "remote-session-forward-key");
    const saveRemoteSession = el("button", "remote-session-save btn primary", "Save remote session");
    const remoteResult = el("p", "remote-session-result");
    const remoteCommands = el("pre", "remote-session-commands");
    const copyRemoteCommands = el("button", "remote-session-copy-commands btn small", "Copy commands");
    const remoteApache = el("pre", "remote-session-proxy-apache");
    const remoteNginx = el("pre", "remote-session-proxy-nginx");
    const httpsExplanation = el("details", "explain",
      el("summary", null, "What is this?"),
      el("p", null, "Use an HTTPS address with a certificate your browser trusts. The jump host's web login is separate from the Bridge address and pairing token, and the web server must require that login before forwarding to the Bridge."),
      el("p", null, "The jump host must allow this dashboard's Pages origin only. Saving this configuration stores it in this browser and does not contact the HTTPS address; it remains untested until you choose a later Bridge action."));
    const bridgeFields = { address, token };
    const jumpFields = { hostname, user, sshPort, portFirst, portLast, httpsAddress, loginUser, loginPassword };

    address.placeholder = "Bridge address";
    token.type = "password";
    token.placeholder = "Copied pairing token";
    hostname.placeholder = "Jump-host name";
    user.placeholder = "SSH user";
    sshPort.type = portFirst.type = portLast.type = "number";
    httpsAddress.placeholder = "Trusted HTTPS Bridge address";
    httpsBridgeToken.type = "password";
    httpsBridgeToken.placeholder = "Copied Bridge pairing token";
    loginUser.placeholder = "Jump-host web login";
    loginPassword.type = "password";
    loginPassword.placeholder = "Jump-host web password";
    throughName.placeholder = "Name of the Bridge";
    throughToken.type = "password";
    throughToken.placeholder = "Copied Bridge token";
    remoteSessionName.placeholder = "Remote session name";
    remoteSessionToken.type = "password";
    remoteSessionToken.placeholder = "Copied remote Bridge token";
    remoteKey.placeholder = "Remote SSH key file";
    localKey.placeholder = "Local SSH key file";
    remoteKey.value = "~/.ssh/agent-m-remote";
    localKey.value = "~/.ssh/agent-m-local";
    for (const input of [address, token, hostname, user, httpsAddress, httpsBridgeToken, loginUser, loginPassword]) { input.autocomplete = "off"; input.spellcheck = false; }
    applyBridge(bridgeFields, readSetting(context.store, "bridge"));
    applyJumpHost(jumpFields, readSetting(context.store, "jump-host"));
    const changing = typeof params.name === "string" ? namedBridges(context.store).find((item) => item.name === params.name) : null;
    if (changing) {
      try { address.value = settingsOf(changing, readSetting(context.store, "jump-host")).address; } catch { /* a port with no jump host: no address to show */ }
      token.value = changing.token ?? "";
    }
    const savedBridge = readSetting(context.store, "bridge");
    if (savedBridge?.address?.startsWith("https://")) httpsBridgeToken.value = savedBridge.token ?? "";

    const sessions = remoteSessions(context.store);
    const selectedName = sessions.some((session) => session.name === params.name) ? params.name : sessions.at(-1)?.name ?? "";
    function selectedSession() { return sessions.find((session) => session.name === remoteSessionSelect.value) ?? null; }
    function applyRemoteSession(session) {
      remoteSessionSelect.value = session?.name ?? "";
      remoteSessionName.value = session?.name ?? "";
      remoteSessionToken.value = session?.token ?? "";
    }
    function renderRemoteSetup(session) {
      if (!session) { remoteCommands.textContent = ""; remoteApache.textContent = ""; remoteNginx.textContent = ""; return; }
      const jumpHost = readSetting(context.store, "jump-host");
      const origin = instanceOrigin();
      if (!usableJumpHost(jumpHost) || !origin) return;
      const commands = tunnelCommands(jumpHost, session, undefined, { remote: remoteKey.value.trim(), local: localKey.value.trim() });
      remoteCommands.textContent = `${commands.reverse}\n\n${commands.forward}\n\n${commands.service}`;
      const allSessions = remoteSessions(context.store);
      remoteApache.textContent = proxyConfiguration(jumpHost, allSessions, origin, "apache");
      remoteNginx.textContent = proxyConfiguration(jumpHost, allSessions, origin, "nginx");
    }
    function renderBridgeProxies() {
      const jumpHost = readSetting(context.store, "jump-host");
      const origin = instanceOrigin();
      const through = namedBridges(context.store).filter((item) => Number.isInteger(item.port));
      if (!usableJumpHost(jumpHost) || !origin || !through.length) { bridgeApache.textContent = ""; bridgeNginx.textContent = ""; return; }
      bridgeApache.textContent = proxyConfiguration(jumpHost, through, origin, "apache");
      bridgeNginx.textContent = proxyConfiguration(jumpHost, through, origin, "nginx");
    }
    renderBridgeProxies();
    for (const session of sessions) remoteSessionSelect.append(el("option", null, session.name));
    applyRemoteSession(sessions.find((session) => session.name === selectedName) ?? null);
    renderRemoteSetup(selectedSession());

    show.addEventListener("click", () => {
      const hidden = token.type === "password";
      token.type = hidden ? "text" : "password";
      show.textContent = hidden ? "Hide" : "Show";
    });
    for (const [secret, toggle] of [[httpsBridgeToken, showHttpsBridgeToken], [loginPassword, showLoginPassword]]) {
      toggle.addEventListener("click", () => {
        const hidden = secret.type === "password";
        secret.type = hidden ? "text" : "password";
        toggle.textContent = hidden ? "Hide" : "Show";
      });
    }
    pairButton.addEventListener("click", async () => {
      const copiedToken = token.value.trim();
      if (!address.value.trim() || !copiedToken) { result.textContent = "Enter the Bridge address and copied pairing token first."; return; }
      result.textContent = "Pairing the Bridge…";
      try {
        const settings = await pair(address.value.trim(), copiedToken);
        if (typeof settings.name === "string" && settings.name) {
          writeSetting(context.store, `bridge:${settings.name}`, { address: settings.address, token: settings.token });
          // Keep the legacy single `bridge` as the Bridge paired last while named Bridge callers use `bridge:<name>`.
          writeSetting(context.store, "bridge", { address: settings.address, token: settings.token });
          applyBridge(bridgeFields, settings);
          result.textContent = `The Bridge ${settings.name} is paired in this browser.`;
        } else {
          writeSetting(context.store, "bridge", settings);
          applyBridge(bridgeFields, settings);
          result.textContent = "The Bridge is paired in this browser.";
        }
      } catch (error) {
        result.textContent = failureText(error);
      }
    });
    clear.addEventListener("click", async () => {
      clearSetting(context.store, "bridge");
      applyBridge(bridgeFields, null);
      result.textContent = "The Bridge setting is cleared from this browser.";
    });
    saveJumpHost.addEventListener("click", () => {
      const trustedAddress = httpsAddress.value.trim() ? trustedHttpsAddress(httpsAddress.value.trim()) : null;
      if (httpsAddress.value.trim() && !trustedAddress) { jumpResult.textContent = "Enter a trusted HTTPS Bridge address without a credential in its URL."; return; }
      const saved = {
        hostname: hostname.value.trim(), user: user.value.trim(), sshPort: Number(sshPort.value), portRange: [Number(portFirst.value), Number(portLast.value)],
        ...(trustedAddress ? { httpsAddress: trustedAddress } : {}),
        ...(loginUser.value.trim() || loginPassword.value ? { login: { user: loginUser.value.trim(), password: loginPassword.value } } : {}),
      };
      writeSetting(context.store, "jump-host", saved);
      const copiedToken = httpsBridgeToken.value.trim();
      if (trustedAddress && copiedToken) writeSetting(context.store, "bridge", { address: trustedAddress, token: copiedToken });
      jumpResult.textContent = "The HTTPS jump-host connection is saved in this browser and remains untested. It has not contacted that address.";
    });
    showThroughToken.addEventListener("click", () => {
      const hidden = throughToken.type === "password";
      throughToken.type = hidden ? "text" : "password";
      showThroughToken.textContent = hidden ? "Hide" : "Show";
    });
    addThrough.addEventListener("click", () => {
      const jumpHost = readSetting(context.store, "jump-host");
      const name = throughName.value.trim();
      const copied = throughToken.value.trim();
      if (!usableJumpHost(jumpHost)) { throughResult.textContent = "The jump host is required; set it up before adding a Bridge through it."; return; }
      if (!name || !copied) { throughResult.textContent = "Enter the Bridge's name and its copied token first."; return; }
      const current = namedBridges(context.store).filter((item) => Number.isInteger(item.port));
      try {
        const port = current.find((item) => item.name === name)?.port ?? allocatePort(jumpHost.portRange, current);
        writeSetting(context.store, `bridge:${name}`, { port, token: copied });
        const commands = tunnelCommands(jumpHost, { name, port }, undefined, { remote: remoteKey.value.trim(), local: localKey.value.trim() });
        throughCommands.textContent = `${commands.reverse}\n\n${commands.forward}\n\n${commands.service}`;
        renderBridgeProxies();
        throughResult.textContent = `${name} is kept at port ${port} of the jump host. The commands are setup text only; they have not started a tunnel or tested an HTTPS connection.`;
      } catch (error) {
        throughResult.textContent = error?.name === "NoFreePort" ? error.message : `A Bridge through the jump host needs valid settings: ${error?.message ?? error}`;
      }
    });
    remoteSessionSelect.addEventListener("change", () => {
      applyRemoteSession(selectedSession());
      renderRemoteSetup(selectedSession());
    });
    showRemoteSessionToken.addEventListener("click", () => {
      const hidden = remoteSessionToken.type === "password";
      remoteSessionToken.type = hidden ? "text" : "password";
      showRemoteSessionToken.textContent = hidden ? "Hide" : "Show";
    });
    saveRemoteSession.addEventListener("click", () => {
      const jumpHost = readSetting(context.store, "jump-host");
      const name = remoteSessionName.value.trim();
      const token = remoteSessionToken.value.trim();
      if (!usableJumpHost(jumpHost)) { remoteResult.textContent = "The jump host is required; set it up before adding a remote session."; return; }
      if (!name || !token) { remoteResult.textContent = "Enter a remote-session name and copied Bridge token first."; return; }
      const current = remoteSessions(context.store);
      const previous = current.find((session) => session.name === name);
      try {
        const port = previous?.port ?? allocatePort(jumpHost.portRange, current);
        const stored = { port, token };
        const session = { ...stored, name };
        writeSetting(context.store, `remote-session:${name}`, stored);
        sessions.splice(0, sessions.length, ...remoteSessions(context.store));
        remoteSessionSelect.replaceChildren(...sessions.map((item) => el("option", null, item.name)));
        applyRemoteSession(session);
        renderRemoteSetup(session);
        remoteResult.textContent = "Remote-session setup text is ready. It has not started a tunnel or tested an HTTPS connection.";
      } catch (error) {
        remoteResult.textContent = error?.name === "NoFreePort" ? error.message : `Remote-session setup needs valid settings: ${error?.message ?? error}`;
      }
    });
    copyRemoteCommands.addEventListener("click", async () => {
      const text = remoteCommands.textContent;
      if (!text) { remoteResult.textContent = "Select or save a remote session before copying its commands."; return; }
      try {
        if (!globalThis.navigator?.clipboard?.writeText) throw new Error("Clipboard access is not available in this browser.");
        await globalThis.navigator.clipboard.writeText(text);
        remoteResult.textContent = "Tunnel commands copied.";
      } catch (error) { remoteResult.textContent = error.message; }
    });

    const kept = namedBridges(context.store);
    const download = downloadSection(context);
    target.replaceChildren(
      el("section", "head", el("h2", null, "Connect a Bridge")),
      ...(download ? [download.section] : []),
      el("p", "notice bridge-shared-origin", sharedPagesNotice(context)),
      el("p", null, "The copied pairing token is sent only to the Bridge address when you choose Pair Bridge."),
      el("p", null, el("label", null, "Bridge address ", address)),
      el("p", null, el("label", null, "Pairing token ", token, " ", show)),
      el("p", null, pairButton, " ", clear),
      explain("bridge-pairing"), result,
      ...(kept.length ? [part("CLI sessions of the Bridges this browser keeps",
          el("p", null, "Test a Bridge to list the CLI sessions it offers. Declare where each processes data, its context in tokens, its model and its capabilities: the prompt bar offers a session once it has them.")),
        ...kept.map((entry) => keptBridge(context.store, entry))] : []),
      part("Trusted HTTPS jump host",
      httpsExplanation,
      el("p", null, el("label", null, "Host ", hostname)),
      el("p", null, el("label", null, "SSH user ", user)),
      el("p", null, el("label", null, "SSH port ", sshPort)),
      el("p", null, el("label", null, "Forwarded-port range ", portFirst, " to ", portLast)),
      el("p", null, el("label", null, "HTTPS Bridge address ", httpsAddress)),
      el("p", null, el("label", null, "Copied Bridge token ", httpsBridgeToken, " ", showHttpsBridgeToken)),
      el("p", null, el("label", null, "Web login ", loginUser)),
      el("p", null, el("label", null, "Web password ", loginPassword, " ", showLoginPassword)),
      el("p", null, saveJumpHost), jumpResult),
      part("+ Bridge through the jump host",
      el("p", null, "Name the Bridge as it reports itself. It takes the lowest free port of the jump host's range. The commands are setup text only; they do not start a tunnel or test HTTPS."),
      el("p", null, el("label", null, "Bridge name ", throughName)),
      el("p", null, el("label", null, "Copied Bridge token ", throughToken, " ", showThroughToken)),
      el("p", null, addThrough), throughResult,
      el("h4", null, "Tunnel commands for this Bridge"), throughCommands,
      el("h4", null, "Apache HTTPS proxy configuration for every Bridge through the jump host"), bridgeApache,
      el("h4", null, "nginx HTTPS proxy configuration for every Bridge through the jump host"), bridgeNginx),
      part("Remote session",
      el("p", null, "Add or select a remote Bridge session. The commands and proxy configuration are setup text only; they do not start a tunnel or test HTTPS."),
      el("p", null, el("label", null, "Stored session ", remoteSessionSelect)),
      el("p", null, el("label", null, "Session name ", remoteSessionName)),
      el("p", null, el("label", null, "Copied remote Bridge token ", remoteSessionToken, " ", showRemoteSessionToken)),
      el("p", null, el("label", null, "Remote SSH key file ", remoteKey)),
      el("p", null, el("label", null, "Local SSH key file ", localKey)),
      el("p", null, saveRemoteSession), remoteResult,
      el("h4", null, "Tunnel commands"), remoteCommands, copyRemoteCommands,
      el("h4", null, "Apache HTTPS proxy configuration"), remoteApache,
      el("h4", null, "nginx HTTPS proxy configuration"), remoteNginx),
    );
    address.focus();
    await download?.done;
  },
};
