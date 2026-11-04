// MOD-settings-pages' endpoint configuration route (UC-003). The endpoint call and its
// diagnosis remain MOD-endpoint-calls' responsibility; this route owns only the browser form and
// the conversion between the browser-store record and EndpointConfig.

import { modelContext, testEndpoint } from "../endpoint-calls/index.mjs";
import { bridgeAt, probe, settingsOf } from "../bridge-client/index.mjs";
import { clearSetting, listSettings, readSetting, writeSetting } from "../browser-store/index.mjs";
import { explain } from "../site-frame/index.mjs";
import { endpointLacks, endpointsOffered, followJob, spawnEndpointJob } from "../prompt-bar/index.mjs";
import { heads } from "./routes.mjs";

function el(name, className, ...children) {
  const node = document.createElement(name);
  if (className) node.className = className;
  node.append(...children);
  return node;
}

function option(value, label) {
  const node = el("option", null, label);
  node.value = value;
  return node;
}

// An old value that says it goes through a Bridge and names none (ITM-269): every test of it asks for a named choice first.
export const namesNoBridge = (setting) => setting?.throughBridge === true && !(typeof setting.bridge === "string" && setting.bridge);
export const CHOOSE_BRIDGE_DISCLOSURE = "This endpoint was stored as going through a Bridge, and no Bridge is named. Choose the Bridge that reaches it; nothing is sent until you do.";
export const CHOOSE_BRIDGE_TEXT = "This endpoint was stored for a Bridge without naming it. Choose the Bridge that reaches it before testing; nothing was sent. ";
// What a Clear of an endpoint says, in its form and on its line of the Settings page (UC-003 2b).
export const CLEARED_TEXT = "The endpoint configuration is cleared from this browser.";

function endpointKey(name) {
  return name ? `endpoint:${name}` : null;
}

// recordTest(store, key, checked) -> { at, outcome, tools? } — the endpoint's last test, kept beside it as the Settings page shows
// it on the endpoint's line (A BROWSER SETTING IS TESTED AND CLEARED WHERE IT IS SHOWN): when it ran, whether the
// endpoint answered and, where the test reached the model, whether the model called the tool it was offered (`tools`, which the
// participants route presets *use tools* from; left out where the test did not reach the model). The form's Save and test and the
// line's Test record it alike.
// contextFromTest(store, key, config, checked) -> Promise<string> — after a working test of an endpoint that declares no context, its model's context in tokens
// as the endpoint states it (MOD-endpoint-calls' modelContext), kept with the endpoint; the sentence the page adds to the test's outcome, or "".
export async function contextFromTest(store, key, config, checked) {
  const setting = readSetting(store, key);
  if (!checked.works || !setting || Number(setting.context) > 0) return "";
  const tokens = await modelContext(config);
  if (!tokens) return " The endpoint does not state its model's context in tokens: enter it with Change.";
  writeSetting(store, key, { ...readSetting(store, key), context: tokens });
  return ` Context: ${tokens} tokens, as the endpoint states it.`;
}

export function recordTest(store, key, checked) {
  // `browser` marks a refusal of the browser itself — the endpoint does not accept calls from a web page —, which the Settings page says plainly (UC-003 4a).
  const browser = !checked.works && Boolean(checked.diagnosis?.routes?.includes("ci") && checked.diagnosis?.routes?.includes("bridge"));
  const lastTest = { at: new Date().toISOString(), outcome: checked.works ? "working" : "refused", ...(checked.works ? { tools: checked.tools === true } : {}), ...(browser ? { browser: true } : {}) };
  writeSetting(store, `last-test:${key}`, lastTest);
  return lastTest;
}

function sharedPagesNotice(context) {
  const owner = String(context.instance?.repository ?? "").split("/")[0];
  return `Everything Agent M stores in this browser is stored for the address https://${owner}.github.io — every GitHub Pages site under that same ${owner}.github.io domain can read it.`;
}

function settingFrom(fields) {
  const value = {
    url: fields.url.value.trim(),
    kind: fields.kind.value,
    model: fields.model.value.trim(),
  };
  const key = fields.key.value.trim();
  if (key) value.key = key;
  const bridge = fields.bridge.value.trim();
  if (bridge) value.bridge = bridge;
  // The place where it processes data, its model's context in tokens and the name of the CI secret that holds its key (UC-003 step 2): the secret by name only.
  const place = fields.place.value.trim();
  if (place) value.place = place;
  const contextSize = Number(fields.context.value.trim());
  if (Number.isInteger(contextSize) && contextSize > 0) value.context = contextSize;
  const secret = fields.secret.value.trim();
  if (secret) value.secret = secret;
  return value;
}

function endpointConfig(name, setting) {
  return {
    name,
    kind: setting.kind,
    baseUrl: setting.url,
    model: setting.model,
    key: setting.key ?? null,
  };
}

// showResult(result, checked) — the outcome of a test in the result paragraph: a working endpoint with whether the model called the tool it was
// offered (UC-003 step 5, 5a) — *can use tools* or *text only*, the endpoint's message, if it gave one, folded beside *text only* —, or the failure.
function showResult(result, checked, baseUrl) {
  if (!checked.works) { result.textContent = resultText(checked, baseUrl); return; }
  const nodes = [`✓ ${checked.model} is working, ${checked.tools ? "can use tools" : "text only"}.`];
  if (!checked.tools && checked.toolMessage) {
    nodes.push(" ", el("details", "endpoint-tool-message", el("summary", null, "The endpoint's message"), checked.toolMessage));
  }
  result.replaceChildren(...nodes);
}

function resultText(result, baseUrl) {
  return refusedText(result.diagnosis, baseUrl);
}

/**
 * refusedText(diagnosis: Diagnosis, baseUrl: string) -> string — a failed test as this page says it (UC-003 4a). An endpoint the browser may not call — a
 * diagnosis whose routes are GitHub Actions and a Bridge — is said plainly, by its host: `<host> does not accept calls from a web page; run it through GitHub
 * Actions (CI secret) or a Bridge.`, with the browser's own words, such as "Failed to fetch", only after it in parentheses; any other failure is the endpoint's message, with the routes that would work.
 */
export function refusedText(diagnosis, baseUrl) {
  if (diagnosis.routes.includes("ci") && diagnosis.routes.includes("bridge")) {
    let host = baseUrl;
    try { host = new URL(baseUrl).host; } catch { /* the address as it was written */ }
    return `✗ ${host} does not accept calls from a web page; run it through GitHub Actions (CI secret) or a Bridge.${diagnosis.message ? ` (The browser said: ${diagnosis.message})` : ""}`;
  }
  const alternatives = diagnosis.routes.length ? ` Try this job through ${diagnosis.routes.map((route) => route === "ci" ? "CI" : "the Bridge").join(" or ")}.` : "";
  return `✗ ${diagnosis.message}${alternatives}`;
}

/** secretNameFor(name: string) -> string — the CI secret a key is stored as when the endpoint names none: its name in capitals, then `_API_KEY`. */
export const secretNameFor = (name) => `${String(name).toUpperCase().replace(/[^A-Z0-9_]/g, "_").replace(/^(?=[0-9])/, "_")}_API_KEY`;

/** ACTIONS_TEST_TASK — the task of the test job an endpoint is tested with on GitHub Actions. */
export const ACTIONS_TEST_TASK = "This is a test of the endpoint. Answer with the one word: ok.";

/**
 * actionsOffer(context, name, result) -> Element | null — for an endpoint the browser may not call (its last test refused it with GitHub Actions among the routes),
 * whose key this browser keeps: what one click does, said before it, and the button that does it (UC-003 4a). The click stores the key as the GitHub Actions secret
 * of the repository the job workflow runs in — the chosen product's, else the instance's — sealed for GitHub and sent only to GitHub's API with the token stored for
 * that repository (MOD-repository-hosts' setCiSecret); it then keeps the secret's name with the endpoint, beside the key this browser keeps, so that the endpoint
 * runs through GitHub Actions; and it spawns one test job of the endpoint there (MOD-prompt-bar's spawnEndpointJob, the kind `converse`, ACTIONS_TEST_TASK),
 * follows it, and shows its outcome in `result` as the endpoint's test, recorded as `last-test:endpoint:<name>`. Null where nothing of this applies.
 */
export function actionsOffer(context, name, result) {
  const key = `endpoint:${name}`;
  const setting = readSetting(context.store, key);
  const repository = jobRepository(context);
  if (!setting?.key || setting.bridge || !repository?.host?.setCiSecret) return null;
  const secret = setting.secret || secretNameFor(name);
  const where = repository.ofProduct ? repository.address : repository.label;
  const lacking = endpointLacks(setting);
  const go = el("button", "endpoint-actions btn primary", "Store the key as a GitHub secret and test on GitHub Actions");
  const said = el("p", "endpoint-actions-consent",
    `One click: Agent M stores this endpoint's API key as the GitHub Actions secret ${secret} of ${where}, sealed with the repository's public key and sent only to GitHub's API with the token stored for that repository. `
    + `It then keeps the secret's name with the endpoint — the key stays in this browser — and spawns one test job of ${setting.model} on GitHub Actions; each message to this endpoint then becomes a job there.`
    + (lacking.length ? ` The test job is a job of this endpoint: first enter ${lacking.join(" and ")} with Change and save.` : ""));
  go.addEventListener("click", async (event) => {
    if (event?.isTrusted !== true || go.disabled) return;
    go.disabled = true;
    const missing = endpointLacks(readSetting(context.store, key));
    if (missing.length) {
      result.textContent = `Enter ${missing.join(" and ")} first and save: the test job is a job of this endpoint, which declares them.`;
      go.disabled = false;
      return;
    }
    try {
      result.textContent = `Storing the secret ${secret} in ${where}…`;
      await repository.host.setCiSecret(secret, setting.key);
    } catch (error) {
      result.textContent = `✗ The secret was not stored: ${error?.message ?? error}`;
      go.disabled = false;
      return;
    }
    writeSetting(context.store, key, { ...setting, secret });
    clearSetting(context.store, `last-test:${key}`);
    await context.endpointsChanged?.();
    await testOnActions(context, name, repository, result);
  });
  return el("div", "endpoint-actions-offer", said, el("p", null, go));
}

// The repository a job of this page runs in: the chosen product's, else the instance's.
function jobRepository(context) {
  return context.product ? { address: context.product.address, host: context.product.host, ofProduct: true }
    : context.instance?.host ? { address: null, host: context.instance.host, ofProduct: false, label: context.instance.repository } : null;
}

/** runsOnActions(setting) -> boolean — whether an endpoint's setting runs through GitHub Actions: it names a CI secret and no Bridge. */
export const runsOnActions = (setting) => Boolean(setting?.secret) && !setting.bridge;

/**
 * testThroughActions(context, name, result) -> Promise<void> — an endpoint that runs through GitHub Actions, tested there: one test job spawned on a person's click,
 * followed, its outcome shown in `result` and recorded as the endpoint's test.
 */
export async function testThroughActions(context, name, result) {
  const repository = jobRepository(context);
  if (!repository) { result.textContent = "No repository is connected to spawn the test job in."; return; }
  await testOnActions(context, name, repository, result, "");
}

// The test job of an endpoint on GitHub Actions, spawned and followed; its outcome is the endpoint's test. `stored` is said before each line: that the secret was stored, or nothing.
async function testOnActions(context, name, repository, result, stored = "The secret is stored. ") {
  const key = `endpoint:${name}`;
  const participant = endpointsOffered(context.store).find((each) => each.name === name);
  if (!participant) { result.textContent = `${stored}The endpoint lacks a place, a context or a model, so no test job was spawned.`; return; }
  try {
    const host = repository.host;
    const address = repository.address ?? (await host.readSnapshot((await host.repositoryInfo()).defaultBranch)).repository.web;
    result.textContent = `${stored}Spawning the test job on GitHub Actions…`;
    const spawned = await spawnEndpointJob({ kind: "converse", task: ACTIONS_TEST_TASK, participant, store: context.store, instance: context.instance,
      page: { address, host }, ofProduct: repository.ofProduct, conversation: null });
    if (spawned.refused) {
      result.textContent = `${stored}No test job was spawned: ${spawned.refused}.${spawned.needsWorkflow ? " Install Agent M's job workflow in the product section of Settings, then test again." : ""}`;
      return;
    }
    const follower = followJob({ id: spawned.id, address, host, store: context.store, show: (view) => {
      if (view.end === null) {
        result.textContent = `${stored}Test job ${spawned.id}: ${view.state ?? "queued"} on GitHub Actions${view.address ? ` — ${view.address}` : ""}.`
          + (view.missingSecret ? ` Not run: the secret ${view.missingSecret} is missing from the job workflow; install it again from Settings.` : "");
        return;
      }
      follower?.stop();
      const works = view.end.state === "done" && Boolean(view.answer);
      recordTest(context.store, key, { works, tools: false });
      result.textContent = works ? `✓ ${participant.model} answered through GitHub Actions (${spawned.id}): ${view.answer.trim()}`
        : `✗ The test job ${spawned.id} ended ${view.end.state}${view.end.reason ? `: ${view.end.reason}` : ""}${view.address ? ` — ${view.address}` : ""}`;
      context.endpointsChanged?.();
    } });
  } catch (error) {
    result.textContent = `${stored}The test job could not be spawned: ${error?.message ?? error}`;
  }
}

export function bridgeFailureText(error) {
  if (error?.name === "TokenRefused") return "The Bridge refused its pairing token. Copy its current token and pair it again.";
  if (error?.name === "JumpHostLoginRefused") return "The jump host refused its web login. Check that login in Bridge settings and save it again.";
  if (error?.name === "JumpHostMissing") return "This Bridge is reached through the jump host, and no jump host is stored. Set it up on the Bridge page.";
  if (error?.name === "NoAnswer") return `The Bridge gave no answer. Check ${error.likely?.join(", ") ?? "its address"}.`;
  if (error?.name === "Timeout") return "The Bridge did not answer in time. Check that it is running, then test again.";
  if (error?.name === "BridgeFailed") return `The Bridge could not test this endpoint: ${error.message}`;
  return `The Bridge could not test this endpoint: ${error?.message ?? error}.`;
}

function bridgeNames(store) {
  return listSettings(store)
    .filter((setting) => setting.key.startsWith("bridge:"))
    .map((setting) => setting.key.slice("bridge:".length));
}

export function bridgeSettings(store, name) {
  if (!name) return null;
  const entry = readSetting(store, `bridge:${name}`);
  if (!entry || typeof entry !== "object") return null;
  return settingsOf({ name, ...entry }, readSetting(store, "jump-host"));
}

function applySetting(fields, name, setting) {
  fields.place.value = setting?.place ?? "";
  fields.context.value = setting?.context ? String(setting.context) : "";
  fields.secret.value = setting?.secret ?? "";
  fields.name.value = name;
  fields.url.value = setting?.url ?? "";
  fields.kind.value = setting?.kind ?? "openai-compatible";
  fields.model.value = setting?.model ?? "";
  fields.key.value = setting?.key ?? "";
  fields.bridge.value = setting?.bridge ?? "";
}

// What this page says of the prompt bar (UC-049 1a): when it appears.
export const PROMPT_BAR_NOTE = "The prompt bar appears once an endpoint is configured in this browser or a Bridge it keeps offers a CLI session.";

export const route = {
  ...heads.endpoints,
  async render(target, context, params = {}) {
    const requestedName = typeof params.name === "string" ? params.name : "";
    const loadedSetting = readSetting(context.store, endpointKey(requestedName));
    const knownBridgeNames = bridgeNames(context.store);
    const selectedBridge = typeof loadedSetting?.bridge === "string" ? loadedSetting.bridge : "";
    // An old value that says it goes through a Bridge and names none asks for a named choice before it is tested.
    let awaitingChoice = namesNoBridge(loadedSetting);
    const options = selectedBridge && !knownBridgeNames.includes(selectedBridge)
      ? [...knownBridgeNames, selectedBridge] : knownBridgeNames;
    const name = el("input", "endpoint-name");
    const url = el("input", "endpoint-url");
    const kind = el("select", "endpoint-kind",
      el("option", null, "openai-compatible"),
      el("option", null, "anthropic"));
    const model = el("input", "endpoint-model");
    const key = el("input", "endpoint-key");
    const place = el("input", "endpoint-place");
    const contextSize = el("input", "endpoint-context");
    const secret = el("input", "endpoint-secret");
    const bridge = el("select", "endpoint-bridge",
      ...(awaitingChoice ? [option("", "Choose a Bridge")] : []),
      option("", "Direct browser request"),
      ...options.map((name) => option(name, name)));
    const show = el("button", "endpoint-show btn small", "Show");
    const disclosure = el("p", "endpoint-disclosure");
    const test = el("button", "endpoint-test btn primary", "Save and test");
    const clear = el("button", "endpoint-clear btn", "Clear");
    const result = el("p", "endpoint-result");
    const offerSlot = el("div", "endpoint-actions-slot");
    const fields = { name, url, kind, model, key, bridge, place, context: contextSize, secret };

    const discloseDestination = () => {
      if (awaitingChoice) {
        disclosure.textContent = CHOOSE_BRIDGE_DISCLOSURE;
        return;
      }
      let configuredBridge = null;
      try { configuredBridge = bridgeSettings(context.store, bridge.value); } catch { configuredBridge = null; }
      disclosure.textContent = bridge.value
        ? `Agent M sends one short test request to the Bridge ${bridge.value} at ${configuredBridge?.address ?? "the Bridge you set up"}. The endpoint key is inside that Bridge request, and its pairing token and any jump-host login are authorisation headers, never URLs or repository data.`
        : "Agent M sends one short test request to this endpoint. Its optional key is sent only in that request's authorisation header, never in a URL or repository. Where no context is entered, it then reads the model's context from the endpoint's list of models, with the same key.";
    };

    name.placeholder = "Endpoint name";
    url.placeholder = "Endpoint address";
    model.placeholder = "Model name";
    key.type = "password";
    key.placeholder = "Optional API key";
    place.placeholder = "Provider and country, or this machine";
    contextSize.placeholder = "Context in tokens";
    contextSize.inputMode = "numeric";
    secret.placeholder = "Name of the CI secret, e.g. NVIDIA_API_KEY";
    for (const input of [name, url, model, key, place, contextSize, secret]) { input.autocomplete = "off"; input.spellcheck = false; }

    show.addEventListener("click", () => {
      const hidden = key.type === "password";
      key.type = hidden ? "text" : "password";
      show.textContent = hidden ? "Hide" : "Show";
    });

    applySetting(fields, requestedName, loadedSetting);
    discloseDestination();
    bridge.addEventListener("change", () => { awaitingChoice = false; discloseDestination(); });

    test.addEventListener("click", async () => {
      const chosenName = name.value.trim();
      if (!chosenName || !url.value.trim() || !model.value.trim()) {
        result.textContent = "Enter an endpoint name, URL and model first.";
        return;
      }
      if (awaitingChoice) {
        const setup = el("button", "endpoint-bridge-setup btn", "Set up the Bridge");
        setup.addEventListener("click", () => context.go("bridge", {}));
        result.replaceChildren(CHOOSE_BRIDGE_TEXT, setup);
        return;
      }
      const stored = settingFrom(fields);
      const storeKey = endpointKey(chosenName);
      offerSlot.replaceChildren();
      writeSetting(context.store, storeKey, stored);
      // A value just stored starts untested; an earlier test of the name never sticks to it.
      clearSetting(context.store, `last-test:${storeKey}`);
      // On the Settings page, the stored endpoints are listed anew once the outcome is known (UC-042 step 2).
      try {
        if (stored.bridge) {
          let settings;
          try { settings = bridgeSettings(context.store, stored.bridge); } catch (error) {
            const setup = el("button", "endpoint-bridge-setup btn", "Set up the Bridge");
            setup.addEventListener("click", () => context.go("bridge", { name: stored.bridge }));
            result.replaceChildren(`${bridgeFailureText(error)} Its endpoint setting remains stored. `, setup);
            return;
          }
          if (!settings) {
            const setup = el("button", "endpoint-bridge-setup btn", "Set up the Bridge");
            setup.addEventListener("click", () => context.go("bridge", { name: stored.bridge }));
            result.replaceChildren(`The endpoint names Bridge ${stored.bridge}, but this browser does not keep it. Its endpoint setting remains stored. `, setup);
            return;
          }
          result.textContent = `Testing the endpoint through Bridge ${stored.bridge}…`;
          try {
            const checked = await probe(bridgeAt(settings), "endpoint-test", endpointConfig(chosenName, stored));
            recordTest(context.store, storeKey, checked);
            showResult(result, checked, stored.url);
          } catch (error) {
            result.textContent = bridgeFailureText(error);
          }
          return;
        }
        // One that runs through GitHub Actions is tested there: Save and test spawns its test job, as Test on its line of the Settings page does.
        if (runsOnActions(stored)) {
          const said = `Stored. ${chosenName} names the CI secret ${stored.secret}: it runs through GitHub Actions, and the prompt bar spawns a job for each message. `;
          result.textContent = said;
          const repository = jobRepository(context);
          if (repository) await testOnActions(context, chosenName, repository, result, said);
          return;
        }
        result.textContent = "Testing the endpoint…";
        const checked = await testEndpoint(endpointConfig(chosenName, stored));
        recordTest(context.store, storeKey, checked);
        showResult(result, checked, stored.url);
        const stated = await contextFromTest(context.store, storeKey, endpointConfig(chosenName, stored), checked);
        if (stated) {
          result.append(stated);
          contextSize.value = String(readSetting(context.store, storeKey)?.context ?? "");
        }
        if (!checked.works && checked.diagnosis?.routes?.includes("ci")) {
          const offer = actionsOffer(context, chosenName, result);
          offerSlot.replaceChildren(...(offer ? [offer] : []));
        }
      } finally {
        await context.endpointsChanged?.();
      }
    });

    clear.addEventListener("click", async () => {
      awaitingChoice = false;
      const chosenName = name.value.trim();
      if (chosenName) {
        clearSetting(context.store, endpointKey(chosenName));
        clearSetting(context.store, `last-test:${endpointKey(chosenName)}`);
      }
      applySetting(fields, "", null);
      result.textContent = CLEARED_TEXT;
      await context.endpointsChanged?.();
    });

    target.replaceChildren(
      el("section", "head", el("h2", null, "Configure a model endpoint")),
      el("p", "muted", "Store an endpoint in this browser, then make one short test request."),
      el("details", "explain", el("summary", null, "What is this?"), el("p", "muted prompt-bar-note", PROMPT_BAR_NOTE)),
      // A stored endpoint names what it lacks for the prompt bar to offer it (UC-049 1b).
      ...(loadedSetting && endpointLacks(loadedSetting).length
        ? [el("p", "notice endpoint-lacks", `The prompt bar does not offer ${requestedName}: it lacks ${endpointLacks(loadedSetting).join(" and ")}. Enter ${endpointLacks(loadedSetting).length === 1 ? "it" : "them"} below and save.`)] : []),
      el("p", null, el("label", null, "Name ", name)),
      el("p", null, el("label", null, "Endpoint URL ", url)),
      explain("endpoint-url"),
      el("p", null, el("label", null, "Kind ", kind)),
      explain("endpoint-kind"),
      el("p", null, el("label", null, "Model ", model)),
      explain("endpoint-model"),
      el("p", null, el("label", null, "API key ", key, " ", show)),
      explain("endpoint-key"),
      el("p", null, el("label", null, "Bridge ", bridge)),
      explain("endpoint-route"),
      el("p", null, el("label", null, "Processing place ", place)),
      el("p", null, el("label", null, "Context (tokens) ", contextSize)),
      el("p", null, el("label", null, "CI secret of the key ", secret)),
      explain("endpoint-declaration"),
      el("p", "notice endpoint-shared-origin", sharedPagesNotice(context)),
      disclosure,
      el("p", null, test, " ", clear),
      explain("endpoint-test"),
      explain("endpoint-clear"),
      result,
      offerSlot,
    );
    name.focus();
  },
};
