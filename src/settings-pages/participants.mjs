// MOD-settings-pages' participants route (UC-017): the instance's docs/participants.md register in a form from
// MOD-participant-list's schema, with route-specific presets before the row is saved through saveFile as the person's commit.
// Bridge agent discovery/testing and product-use checks for changed participants are kept local to this route.
//
// Module: MOD-settings-pages

import { saveFile } from "../artifact-edits/index.mjs";
import { listSettings, readSetting, secretValues, writeSetting } from "../browser-store/index.mjs";
import { bridgeAt, probe, settingsOf, testBridge } from "../bridge-client/index.mjs";
import { readDocument, writeDocument } from "../documents/index.mjs";
import { testEndpoint } from "../endpoint-calls/index.mjs";
import { participantSchema, participantsOf, reachedThrough } from "../participant-list/index.mjs";
import { declarationSchema, roleAssignmentFindings, roleAssignmentSchema, productWorkflow } from "../product-process/index.mjs";
import { connect, parseAddress } from "../repository-hosts/index.mjs";
import { permittedPlaces, sourceSchemas } from "../source-register/index.mjs";
import { explain, schemaForm } from "../site-frame/index.mjs";
import { finding } from "../text-tools/index.mjs";
import { recordTest } from "./endpoints.mjs";
import { credentialsFor } from "./products.mjs";
import { heads } from "./routes.mjs";

const PATH = "docs/participants.md";
const DECLARATION = "docs/process.md";
const SOURCE_PATH = /^docs\/sources\/SRC-[^/]+\.md$/;
const ASSIGNMENT_FILE = /^docs\/role-assignments\/([^/]+)\.md$/;
const COLUMNS = ["Name", "Type", "Model", "Context", "Price", "Capabilities", "Processing place", "Route"];
const TYPES = ["person", "model endpoint", "CI agent", "CLI agent", "sandboxed agent"];
export const CAPABILITIES = ["draft text", "read the repository", "write to the repository", "run code and tests", "use tools", "reach the web"];
const HEADER = `| ${COLUMNS.join(" | ")} |\n|${COLUMNS.map(() => "---|").join("")}`;
const EMPTY = `# Participants of this instance\n\n${HEADER}\n`;
export const PRESETS = {
  person: CAPABILITIES,
  "model endpoint": ["draft text"],
  "CI agent": ["draft text", "read the repository", "write to the repository", "run code and tests", "use tools"],
  "CLI agent": ["draft text", "read the repository", "write to the repository", "run code and tests", "use tools"],
  "sandboxed agent": ["draft text", "read the repository", "write to the repository", "run code and tests", "use tools"],
};
const TYPE_TOPIC = {
  person: "participant-person",
  "model endpoint": "participant-model-endpoint",
  "CI agent": "participant-ci-agent",
  "CLI agent": "participant-cli-agent",
  "sandboxed agent": "participant-sandboxed-agent",
};
const BRIDGE_TYPES = new Set(["CLI agent", "sandboxed agent"]);

const unquoted = (value) => String(value ?? "").trim().replace(/^`|`$/g, "");
const text = (value) => (value === undefined || value === null || value === "—" ? "" : String(value));
const listedValues = (value) => (Array.isArray(value) ? value.map(text).filter(Boolean)
  : text(value).split(",").map((part) => part.trim()).filter(Boolean));
const assignmentName = (path) => ASSIGNMENT_FILE.exec(text(path))?.[1] ?? text(path);

function el(name, className, ...children) {
  const node = document.createElement(name);
  if (className) node.className = className;
  node.append(...children);
  return node;
}

function option(value, label = value) {
  const node = el("option", null, label);
  node.value = value;
  return node;
}

function listed(store, prefix) {
  return listSettings(store)
    .filter((setting) => setting.key.startsWith(prefix))
    .map((setting) => setting.key.slice(prefix.length));
}

const endpointNames = (store) => listed(store, "endpoint:");
const bridgeNames = (store) => listed(store, "bridge:");

function participantText(snapshotText) {
  return typeof snapshotText === "string" && snapshotText.trim() ? snapshotText : EMPTY;
}

function participantDocument(text) {
  return readDocument(participantSchema(), PATH, participantText(text));
}

function participantRows(text) {
  return participantDocument(text).sections.flatMap((section) => section.rows ?? []);
}

async function openedRegister(host) {
  const { defaultBranch } = await host.repositoryInfo();
  const snapshot = await host.readSnapshot(defaultBranch);
  const text = participantText(await snapshot.read(PATH));
  const openedBlob = snapshot.blob(PATH);
  const sources = [];
  const { entry } = sourceSchemas();
  for (const path of (snapshot.paths ?? []).filter((each) => SOURCE_PATH.test(each)).sort()) {
    const sourceText = await snapshot.read(path);
    if (sourceText) sources.push(readDocument(entry, path, sourceText));
  }
  return { text, openedBlob, sources, snapshot };
}

function cell(value) {
  if (value === undefined || value === null || value === "") return "—";
  if (Array.isArray(value)) return value.map((item) => String(item).replace(/\|/g, "\\|")).join(", ");
  return String(value).replace(/\|/g, "\\|");
}

function withDraftRow(text, row) {
  const line = `| ${COLUMNS.map((column) => cell(row[column])).join(" | ")} |`;
  const base = participantText(text).replace(/\s*$/, "");
  return `${base}\n${line}\n`;
}

function withChangedRow(sourceText, originalName, row) {
  const base = participantText(sourceText).replace(/\s*$/, "");
  const lines = base.split("\n");
  const found = participantRows(base).find((candidate) => text(candidate.cells.Name) === originalName);
  if (!found) return withDraftRow(base, row);
  lines[found.line - 1] = `| ${COLUMNS.map((column) => cell(row[column])).join(" | ")} |`;
  return `${lines.join("\n")}\n`;
}

function firstEndpoint(store) {
  const [name] = endpointNames(store);
  return name ?? "";
}

function typePreset(type) {
  return [...(PRESETS[type] ?? [])];
}

function routeOf(type, state) {
  if (type === "person") return state.account.trim() ? `account ${state.account.trim()}` : "";
  if (type === "model endpoint") return state.endpoint.trim() ? `endpoint ${state.endpoint.trim()}` : "";
  if (type === "CI agent") {
    const secret = state.secret.trim(), label = state.runnerLabel.trim();
    if (!secret) return "";
    if (state.runner !== "self-hosted") return `ci hosted secret ${secret}`;
    return label ? `ci runner:${label} secret ${secret}` : "";
  }
  if (BRIDGE_TYPES.has(type)) {
    if (state.reach === "through") return state.through ? `through ${state.through}` : "";
    const bridge = state.bridge.trim(), agent = state.agent.trim();
    return bridge && agent ? `bridge ${bridge} agent ${agent}` : "";
  }
  return "";
}

function modelOf(type, state, store) {
  if (type === "person") return "";
  if (type === "model endpoint") {
    const setting = readSetting(store, `endpoint:${state.endpoint}`);
    return typeof setting?.model === "string" && setting.model ? setting.model : state.endpointModel.trim();
  }
  return state.model.trim();
}

function rowOf(type, state, store) {
  const row = {
    Name: state.name.trim(),
    Type: type,
    Capabilities: state.capabilities,
    Route: routeOf(type, state),
  };
  if (type !== "person") {
    row.Model = modelOf(type, state, store);
    if (state.context.trim() !== "") row.Context = Number(state.context.trim());
    if (state.price.trim()) row.Price = state.price.trim();
    row["Processing place"] = state.place.trim();
  }
  return row;
}

function draftDocument(openedText, type, state, store, originalName = null) {
  const row = rowOf(type, state, store);
  const text = originalName ? withChangedRow(openedText, originalName, row) : withDraftRow(openedText, row);
  return readDocument(participantSchema(), PATH, text);
}

function sourcePlaceWarnings(sources) {
  return (document) => document.sections.flatMap((section) => section.rows ?? []).flatMap((row) => {
    const place = unquoted(row.cells["Processing place"]);
    const name = unquoted(row.cells.Name);
    if (!place || place === "—") return [];
    return sources.flatMap((source) => {
      const allowed = permittedPlaces(source);
      if (allowed === "any") return [];
      const ok = allowed.some((each) => each === place);
      if (ok) return [];
      const permits = allowed.length ? allowed.join(", ") : "no processing place";
      return finding({ artifact: PATH, line: row.line, kind: "warning", rule: "RESTRICTED CONTENT GOES ONLY WHERE ITS SOURCE PERMITS",
        what: `${source.id} permits ${permits}, not ${place} for ${name}`,
        fix: "choose an allowed processing place before assigning this participant to work with that source" });
    });
  });
}

function endpointSetting(state) {
  const name = state.endpoint.trim();
  if (!name) return null;
  const setting = { url: state.endpointUrl.trim(), kind: state.endpointKind, model: state.endpointModel.trim() };
  const key = state.endpointKey.trim();
  if (key) setting.key = key;
  return { key: `endpoint:${name}`, setting };
}

function endpointConfig(state) {
  return { name: state.endpoint.trim(), kind: state.endpointKind, baseUrl: state.endpointUrl.trim(),
    model: state.endpointModel.trim(), key: state.endpointKey.trim() || null };
}

function endpointTestResultText(result) {
  if (result.works) return `${result.model} is working.`;
  const routes = result.diagnosis?.routes?.length ? ` Try this job through ${result.diagnosis.routes.join(" or ")}.` : "";
  return `${result.diagnosis?.message ?? "The endpoint refused the test request."}${routes}`;
}

function inlineEndpointChecks(type, state) {
  if (type !== "model endpoint" || !state.inlineEndpoint) return [];
  const found = [];
  const add = (what, fix) => found.push(finding({ artifact: PATH, line: 1, kind: "error", rule: "CONFIGURATION LIVES IN THE BROWSER", what, fix }));
  if (!state.endpoint.trim()) add("the inline endpoint has no name", "enter the endpoint name");
  if (!state.endpointUrl.trim()) add(`endpoint ${state.endpoint.trim() || "the inline endpoint"} has no URL`, "enter the endpoint URL");
  if (!state.endpointModel.trim()) add(`endpoint ${state.endpoint.trim() || "the inline endpoint"} has no model`, "enter the endpoint model");
  return found;
}

function agentTestChecks(type, state) {
  if (!BRIDGE_TYPES.has(type) || state.agentTest?.ok !== false || state.saveUntested) return [];
  return [finding({ artifact: PATH, line: 1, kind: "error", rule: "ONE CLICK PER DECISION",
    what: `the test of ${state.agent || "the agent"} through Bridge ${state.bridge || "the chosen Bridge"} failed`,
    fix: "fix the Bridge or choose Save untested before saving this participant" })];
}

// An agent the Bridge's own listing does not offer is refused before Save (UC-017 3, "chosen from those that Bridge
// offers"); `offered` is that listing, by Bridge name. A Bridge that has not answered is 6a's: its test decides.
function offeredAgentChecks(type, state, offered) {
  const agents = BRIDGE_TYPES.has(type) && state.reach !== "through" ? offered.get(state.bridge) : undefined;
  const agent = state.agent.trim();
  if (!agents || !agent || agents.includes(agent)) return [];
  return [finding({ artifact: PATH, line: 1, kind: "error", rule: "THE BRIDGE FINDS THE INSTALLED AGENTS",
    what: `Bridge ${state.bridge} does not offer the agent ${agent}`,
    fix: agents.length ? `choose one of the agents it offers: ${agents.join(", ")}` : "choose an agent the Bridge offers" })];
}

// A price the participant list would read as none is refused before Save (NO COST IS GUESSED): the drafted row is read with
// MOD-participant-list's participantsOf, the one reading of a price, and PRICE_HINT, the Price field's hint, is a price it reads.
const PRICE_HINT = "2.00 / 8.00 USD per million tokens";
function priceChecks(type, state, store) {
  const price = state.price.trim();
  if (!price) return [];
  const [drafted] = participantsOf(readDocument(participantSchema(), PATH, withDraftRow(EMPTY, rowOf(type, state, store))));
  if (drafted?.price) return [];
  return [finding({ artifact: PATH, line: 1, kind: "error", rule: "NO COST IS GUESSED",
    what: `the price ${price} is not read as a price, so a cost would be shown as unknown`,
    fix: `write it as <input> / <output> <currency> per million tokens, for example ${PRICE_HINT}, or leave it empty` })];
}

// The place Agent M can tell for a CI agent (UC-017 5): the runner it runs on.
function runnerPlace(state) {
  return state.runner === "self-hosted" ? `self-hosted runner ${state.runnerLabel.trim()}`.trim() : "GitHub hosted runner";
}

function bridgeSettingsOf(store, name) {
  const entry = readSetting(store, `bridge:${name}`);
  if (!entry || typeof entry !== "object") throw new Error(`This browser does not keep Bridge ${name}.`);
  return settingsOf({ name, ...entry }, readSetting(store, "jump-host"));
}

function bridgeFailureText(error) {
  if (error?.name === "TokenMissing") return "The Bridge has no pairing token.";
  if (error?.name === "TokenRefused") return "The Bridge refused its pairing token.";
  if (error?.name === "JumpHostMissing") return error.message;
  if (error?.name === "JumpHostLoginRefused") return "The jump host refused its login.";
  if (error?.name === "Timeout") return "The Bridge request timed out.";
  if (error?.name === "NoAnswer") return `${error.message} Likely: ${error.likely?.join(", ") ?? "not running or wrong address"}.`;
  if (error?.name === "BridgeFailed") return `The Bridge refused the request: ${error.message}`;
  return `The Bridge could not be reached: ${error?.message ?? error}.`;
}

function productHostOf(context, web) {
  const injected = context.productHosts instanceof Map ? context.productHosts.get(web) : context.productHosts?.[web];
  if (injected) return injected;
  const address = parseAddress(web);
  return connect(address, { ...credentialsFor(context.store, address), secrets: secretValues(context.store) });
}

function browserProducts(store) {
  const products = readSetting(store, "products");
  return Array.isArray(products) ? products.filter((product) => typeof product === "string" && product.trim()) : [];
}

function rolesNaming(assignment, participantName) {
  return assignment.sections.flatMap((section) => section.rows ?? []).filter((row) => listedValues(row.cells.Participants).includes(participantName))
    .map((row) => ({ assignment: assignmentName(assignment.path), path: assignment.path, role: text(row.cells.Role) }));
}

function participantsForFindings(document) {
  return { ...document, sections: document.sections.map((section) => ({ ...section,
    rows: (section.rows ?? []).map((row) => ({ ...row, cells: { ...row.cells, Capabilities: listedValues(row.cells.Capabilities) } })),
  })) };
}

async function productBasisOf(context, web, specText) {
  const host = productHostOf(context, web);
  const { defaultBranch } = await host.repositoryInfo();
  const snapshot = await host.readSnapshot(defaultBranch);
  const declarationText = await snapshot.read(DECLARATION);
  if (!declarationText) return null;
  const declaration = readDocument(declarationSchema, DECLARATION, declarationText);
  // The product's workflow as it declared it: the model at the instance's commit its declaration names.
  const workflow = await productWorkflow(declaration, (commit) => context.instance.host.readSnapshot(commit), specText ?? "");
  if (workflow === null) return null;
  const assignments = await Promise.all((snapshot.paths ?? []).filter((path) => ASSIGNMENT_FILE.test(path)).sort()
    .map(async (path) => readDocument(roleAssignmentSchema, path, await snapshot.read(path))));
  return { web, workflow, assignments };
}

async function productUseBasis(context, opened) {
  const products = browserProducts(context.store);
  if (!products.length) return [];
  const specText = await opened.snapshot.read("SPEC.md");
  const basis = [];
  for (const web of products) {
    try {
      const product = await productBasisOf(context, web, specText);
      if (product) basis.push(product);
    } catch {
      // A product that cannot currently be read cannot prove that it names this participant.
    }
  }
  return basis;
}

function productUseFromBasis(product, participantName, participantsDoc) {
  const { web, workflow, assignments } = product;
  const roles = assignments.flatMap((assignment) => rolesNaming(assignment, participantName));
  if (!roles.length) return null;
  const usedPaths = new Set(roles.map((role) => role.path));
  const findings = roleAssignmentFindings(assignments, workflow, participantsForFindings(participantsDoc), [])
    .filter((found) => usedPaths.has(found.artifact) && text(found.what).includes(participantName));
  return { web, roles, findings };
}

async function productUseFor(context, opened, participantName, participantsDoc, basis = null) {
  if (!participantName) return [];
  const products = await (basis ?? productUseBasis(context, opened));
  return products.map((product) => productUseFromBasis(product, participantName, participantsDoc)).filter(Boolean);
}

function renderProductUse(box, uses) {
  if (!uses.length) { box.replaceChildren(); return; }
  const section = el("section", "participant-product-use", el("h4", null, "Products using this participant"));
  for (const use of uses) {
    const roles = el("ul", "participant-product-roles", ...use.roles.map((role) =>
      el("li", null, `${role.assignment}: ${role.role} (${role.path})`)));
    const findings = use.findings.length ? el("ul", "participant-product-findings", ...use.findings.map((found) =>
      el("li", found.kind === "error" ? "warn" : "muted", `${found.artifact}: ${found.what} — ${found.fix}`))) : null;
    section.append(el("div", "participant-product", el("p", null, use.web), roles, ...(findings ? [findings] : [])));
  }
  box.replaceChildren(section);
}

function renderList(box, text, onChange = null) {
  const participants = participantsOf(participantDocument(text));
  box.replaceChildren(...(participants.length ? participants.map((participant) =>
    el("li", "participants-row", `${participant.name} — ${participant.type}; capabilities: ${participant.capabilities?.join(", ") ?? "none"}; `
      + `place: ${participant.place ?? "—"}; route: ${participant.route}`,
    ...(onChange ? [" ", (() => {
      const change = el("button", "participant-change btn small", `Change ${participant.name}`);
      change.type = "button";
      change.addEventListener("click", () => onChange(participant.name));
      return change;
    })()] : []))) : [el("li", null, "No participants are registered yet.")]));
}

function control(label, input) {
  return el("p", null, el("label", null, label, " ", input));
}

export const route = {
  ...heads.participants,
  async render(target, context, params = {}) {
    let opened;
    try { opened = await openedRegister(context.instance.host); } catch (error) {
      target.replaceChildren(el("section", "head", el("h2", null, "Participants")), el("p", "participants-unreadable", `The participants register could not be read: ${error?.message ?? error}.`));
      return;
    }

    let startEdit = () => {};
    const list = el("ul", "participants-list");
    renderList(list, opened.text, (name) => startEdit(name));

    const add = el("button", "participants-add btn primary", "+ Add participant");
    const panel = el("section", "participants-add-panel panel");
    panel.hidden = true;
    const panelTitle = el("h3", null, "Add participant");
    const type = el("select", "participant-type", option("", "Choose type"), ...TYPES.map((name) => option(name)));
    const fieldsBox = el("div", "participant-type-fields");
    const formBox = el("div", "participants-form-box");
    const productUseBox = el("div", "participant-product-use-box");
    const result = el("p", "participants-result");
    let editing = null;
    let productUseTicket = 0;
    const offered = new Map(); // the agents each Bridge's last listing offered, kept while the page is open
    let placeInput = null;
    const productUseBase = productUseBasis(context, opened).catch(() => []);
    const state = {
      name: "", account: "", endpoint: "", endpointUrl: "", endpointKind: "openai-compatible", endpointModel: "", endpointKey: "",
      inlineEndpoint: false, model: "", context: "", price: "", place: "", runner: "github-hosted", runnerLabel: "", secret: "",
      bridge: "", agent: "", reach: "bridge", through: "", capabilities: [], agentList: null, agentListText: "", agentTest: null, saveUntested: false,
    };

    // A model endpoint's *use tools* is preset from its endpoint's last test (UC-017 step 3): ticked where the model called the tool it was
    // offered, unticked where it answered in text only; an endpoint never tested, or whose test did not reach the model, changes nothing, and no other capability is touched.
    let capabilityBoxes = [];
    function presetTools() {
      const tested = readSetting(context.store, `last-test:endpoint:${state.endpoint.trim()}`);
      if (typeof tested?.tools !== "boolean") return;
      state.capabilities = CAPABILITIES.filter((name) => (name === "use tools" ? tested.tools : state.capabilities.includes(name)));
      for (const box of capabilityBoxes) box.checked = state.capabilities.includes(box.value);
    }

    function setType(next, values = {}) {
      state.name = ""; state.account = ""; state.endpoint = ""; state.endpointUrl = ""; state.endpointKind = "openai-compatible";
      state.endpointModel = ""; state.endpointKey = ""; state.inlineEndpoint = false; state.model = ""; state.context = "";
      state.price = ""; state.place = ""; state.runner = "github-hosted"; state.runnerLabel = ""; state.secret = ""; state.bridge = "";
      state.agent = ""; state.reach = "bridge"; state.through = ""; state.capabilities = typePreset(next); state.agentList = null; state.agentListText = ""; state.agentTest = null;
      state.saveUntested = false;
      if (next === "model endpoint") {
        state.endpoint = firstEndpoint(context.store);
        state.inlineEndpoint = state.endpoint === "";
        presetTools();
      }
      if (BRIDGE_TYPES.has(next)) state.bridge = bridgeNames(context.store)[0] ?? "";
      if (next === "CI agent") state.place = runnerPlace(state);
      if (next === "CLI agent") state.place = "this machine";
      if (next === "sandboxed agent") state.place = "sandbox";
      Object.assign(state, values);
    }

    function buildForm() {
      result.textContent = "";
      if (!type.value) { fieldsBox.replaceChildren(); formBox.replaceChildren(); productUseBox.replaceChildren(); return; }
      const document = draftDocument(opened.text, type.value, state, context.store, editing?.name ?? null);
      const checks = (document) => [...inlineEndpointChecks(type.value, state), ...agentTestChecks(type.value, state),
        ...offeredAgentChecks(type.value, state, offered), ...priceChecks(type.value, state, context.store),
        ...sourcePlaceWarnings(opened.sources)(document)];
      async function save(document) {
        const text = writeDocument(participantSchema(), document);
        const endpoint = state.inlineEndpoint ? endpointSetting(state) : null;
        const saved = await saveFile(context.instance.host, { path: PATH, text, openedBlob: opened.openedBlob, openedId: null });
        if (saved.refused === "changed meanwhile") {
          result.textContent = "Nothing was saved: the participants register changed meanwhile. Reload the page and try again.";
          return;
        }
        if (saved.refused === "identifier changed") {
          result.textContent = "Nothing was saved: the participants register changed its identifier.";
          return;
        }
        if (endpoint) writeSetting(context.store, endpoint.key, endpoint.setting);
        opened = { ...opened, text, openedBlob: saved.blob };
        renderList(list, opened.text, (name) => startEdit(name));
        editing = null;
        panel.hidden = true;
        result.textContent = "Saved.";
      }
      formBox.replaceChildren(schemaForm(participantSchema(), document, { onSave: save, extraChecks: checks }));
      if (type.value === "CI agent") formBox.append(explain("ci-ssh-alternative"));
      updateProductUse(document);
    }

    async function updateProductUse(document) {
      const ticket = ++productUseTicket;
      productUseBox.replaceChildren();
      if (!editing) return;
      const uses = await productUseFor(context, opened, editing.name, document, productUseBase);
      if (ticket === productUseTicket && editing) renderProductUse(productUseBox, uses);
    }

    function rebuild() {
      fieldsBox.replaceChildren(...fieldsFor(type.value));
      buildForm();
    }

    // `around` wraps the change of the state, for a field whose change moves another (the runner's label, the place).
    function textInput(className, key, placeholder = "", around = (apply) => apply()) {
      const input = el("input", className);
      input.value = state[key];
      input.placeholder = placeholder;
      input.autocomplete = "off";
      input.spellcheck = false;
      input.addEventListener("input", () => {
        around(() => { state[key] = input.value; });
        buildForm();
        routePreview.textContent = routeOf(type.value, state);
      });
      return input;
    }

    // A change of the runner moves the place with it while the place is still the one Agent M preset; a place the author typed stays.
    function followRunner(apply) {
      const preset = state.place === runnerPlace(state);
      apply();
      if (preset) state.place = runnerPlace(state);
      if (placeInput) placeInput.value = state.place;
    }

    function selectInput(className, key, values) {
      const input = el("select", className, ...values.map((value) => option(value)));
      input.value = state[key];
      input.addEventListener("change", () => {
        state[key] = input.value;
        if (key === "endpoint") presetTools();
        buildForm();
        routePreview.textContent = routeOf(type.value, state);
      });
      return input;
    }

    const routePreview = el("code", "participant-route-preview");

    function capabilitiesBox() {
      const inputs = CAPABILITIES.map((capability) => {
        const box = el("input", "participant-capability");
        box.type = "checkbox";
        box.value = capability;
        box.checked = state.capabilities.includes(capability);
        box.addEventListener("change", () => {
          state.capabilities = CAPABILITIES.filter((name) => inputs.some((candidate) => candidate.value === name && candidate.checked));
          buildForm();
        });
        return box;
      });
      capabilityBoxes = inputs;
      return el("fieldset", "participant-capabilities", el("legend", null, "Capabilities"),
        ...inputs.map((box) => el("p", null, el("label", null, box, " ", box.value))), explain("capabilities-and-place"));
    }

    function commonControls(typeName) {
      const controls = [control("Name", textInput("participant-name", "name", "participant-name"))];
      if (typeName !== "person" && typeName !== "model endpoint") {
        controls.push(control("Model", textInput("participant-model", "model", "model name")));
      }
      placeInput = null;
      if (typeName !== "person") {
        placeInput = textInput("participant-place", "place", "where data is processed");
        controls.push(control("Context", textInput("participant-context", "context", "tokens")),
          control("Price", textInput("participant-price", "price", PRICE_HINT)),
          control("Processing place", placeInput));
      }
      controls.push(capabilitiesBox());
      return controls;
    }

    function endpointControls() {
      const names = endpointNames(context.store);
      if (!names.length || state.inlineEndpoint) {
        state.inlineEndpoint = true;
        const name = textInput("participant-endpoint-name", "endpoint", "endpoint name");
        const url = textInput("participant-endpoint-url", "endpointUrl", "http://localhost:11434/v1");
        const kind = selectInput("participant-endpoint-kind", "endpointKind", ["openai-compatible", "anthropic"]);
        const model = textInput("participant-endpoint-model", "endpointModel", "model name");
        const key = textInput("participant-endpoint-key", "endpointKey", "optional API key");
        key.type = "password";
        const test = el("button", "participant-endpoint-test btn", "Test endpoint");
        test.type = "button";
        const testResult = el("p", "participant-endpoint-test-result");
        test.addEventListener("click", async () => {
          const endpoint = endpointSetting(state);
          if (!endpoint || !state.endpointUrl.trim() || !state.endpointModel.trim()) {
            testResult.textContent = "Enter the endpoint name, URL and model first.";
            return;
          }
          writeSetting(context.store, endpoint.key, endpoint.setting);
          testResult.textContent = "Testing the endpoint...";
          try {
            const checked = await testEndpoint(endpointConfig(state));
            recordTest(context.store, endpoint.key, checked);
            presetTools();
            buildForm();
            testResult.textContent = endpointTestResultText(checked);
          } catch (error) {
            testResult.textContent = `The endpoint could not be tested: ${error?.message ?? error}.`;
          }
        });
        return [el("div", "participant-endpoint-inline",
          el("h4", null, "Configure a model endpoint"), control("Name", name), control("Endpoint URL", url), control("Kind", kind),
          control("Model", model), control("API key", key), el("p", null, test), testResult,
          explain("endpoint-url"), explain("endpoint-model"), explain("endpoint-key"), explain("endpoint-test"))];
      }
      state.inlineEndpoint = false;
      return [control("Endpoint", selectInput("participant-endpoint", "endpoint", names))];
    }

    function ciControls() {
      const runner = el("select", "participant-runner", option("github-hosted"), option("self-hosted"));
      runner.value = state.runner;
      runner.addEventListener("change", () => { followRunner(() => { state.runner = runner.value; }); rebuild(); });
      const explainRunner = el("p", "participant-runner-explanation", state.runner === "self-hosted"
        ? "A self-hosted runner serves private repositories only; on a public repository Agent M refuses a job that would run on it, because outside pull requests could run code on that machine."
        : "A hosted runner runs on the forge's machines and uses a secret by name; no key is stored in the participants register.");
      return [control("Runner", runner),
        ...(state.runner === "self-hosted" ? [control("Runner label", textInput("participant-runner-label", "runnerLabel", "gpu", followRunner))] : []),
        control("Key secret name", textInput("participant-secret-name", "secret", "ACTIONS_SECRET_NAME")), explainRunner,
        explain("ci-agent-runner"), explain("ci-ssh-alternative"), explain("job-workflow")];
    }

    function chosenBridge() {
      return bridgeAt(bridgeSettingsOf(context.store, state.bridge));
    }

    async function listBridgeAgents() {
      state.agentListText = "Reading the Bridge's agents...";
      state.agentList = null;
      rebuild();
      try {
        state.agentList = await testBridge(chosenBridge());
        offered.set(state.bridge, (state.agentList.agents ?? []).map((agent) => agent.name));
        state.agentListText = `Bridge ${state.agentList.bridge?.name ?? state.bridge} answered.`;
      } catch (error) {
        state.agentList = null;
        state.agentListText = bridgeFailureText(error);
      }
      rebuild();
    }

    function addOfferedAgent(agent) {
      const computer = state.agentList?.bridge?.name ?? state.bridge;
      // The Bridge names no model for its agents (GET /v1/agents: name, version, ready, loggedIn): the model is the author's to name (UC-017 3).
      state.agent = agent.name;
      state.place = `${computer} Bridge's computer`;
      state.agentTest = null;
      state.saveUntested = false;
      rebuild();
    }

    async function testAgent() {
      if (!state.agent.trim()) {
        state.agentTest = { ok: false, text: "Choose an agent before testing it." };
        state.saveUntested = false;
        rebuild();
        return;
      }
      state.agentTest = { ok: null, text: `Testing ${state.agent} through Bridge ${state.bridge}...` };
      state.saveUntested = false;
      rebuild();
      try {
        const answer = await probe(chosenBridge(), "agent", { agent: state.agent.trim() });
        const version = answer?.version ? ` (${answer.version})` : "";
        state.agentTest = { ok: true, text: `${state.agent} answered${version}.` };
      } catch (error) {
        state.agentTest = { ok: false, text: bridgeFailureText(error) };
      }
      rebuild();
    }

    function agentListView() {
      const children = [];
      if (state.agentListText) children.push(el("p", null, state.agentListText));
      for (const agent of state.agentList?.agents ?? []) {
        if (agent.ready) {
          const add = el("button", "participant-agent-offer btn small", `Add ${agent.name}`);
          add.addEventListener("click", () => addOfferedAgent(agent));
          children.push(el("p", null, add, ` ${agent.version ?? ""}`));
        } else {
          children.push(el("p", "participant-agent-unready", `${agent.name} is not ready${agent.loggedIn === false ? " (not logged in)" : ""}.`));
        }
      }
      for (const agent of state.agentList?.missing ?? []) {
        children.push(el("p", "participant-agent-missing", `${agent.name} is missing.`));
      }
      return el("div", "participant-agent-list-result", ...children);
    }

    function throughControls() {
      const starters = participantsOf(participantDocument(opened.text)).filter((each) => each.type === "CLI agent" && each.name !== editing?.name).map((each) => each.name);
      if (!starters.includes(state.through)) state.through = starters[0] ?? "";
      const through = el("select", "participant-through", ...starters.map((name) => option(name)));
      through.value = state.through;
      through.addEventListener("change", () => { state.through = through.value; buildForm(); routePreview.textContent = routeOf(type.value, state); });
      return [control("Started by the CLI agent", through)];
    }

    function bridgeControls() {
      const reach = el("select", "participant-reach", option("bridge", "On a Bridge"), option("through", "Started by another CLI agent (a subagent)"));
      reach.value = state.reach;
      reach.addEventListener("change", () => { state.reach = reach.value; rebuild(); });
      if (state.reach === "through") return [control("How it is reached", reach), ...throughControls()];
      const names = bridgeNames(context.store);
      const bridge = el("select", "participant-bridge", ...(names.length ? names : [""]).map((name) => option(name)));
      bridge.value = state.bridge;
      bridge.addEventListener("change", () => {
        state.bridge = bridge.value;
        state.agent = "";
        state.agentList = null;
        state.agentListText = "";
        state.agentTest = null;
        state.saveUntested = false;
        buildForm();
        routePreview.textContent = routeOf(type.value, state);
      });
      const agent = el("input", "participant-agent");
      agent.value = state.agent;
      agent.placeholder = "codex";
      agent.autocomplete = "off";
      agent.spellcheck = false;
      agent.addEventListener("input", () => {
        state.agent = agent.value;
        state.agentTest = null;
        state.saveUntested = false;
        buildForm();
        routePreview.textContent = routeOf(type.value, state);
      });
      const listAgents = el("button", "participant-list-agents btn", "List agents");
      listAgents.type = "button";
      listAgents.addEventListener("click", listBridgeAgents);
      const test = el("button", "participant-agent-test btn", "Test");
      test.type = "button";
      test.addEventListener("click", testAgent);
      const testResult = el("p", "participant-agent-test-result", state.agentTest?.text ?? "");
      const saveUntested = el("button", "participant-save-untested btn", "Save untested");
      saveUntested.type = "button";
      saveUntested.addEventListener("click", () => { state.saveUntested = true; buildForm(); });
      const testLine = el("p", null, test);
      if (state.agentTest?.ok === false && !state.saveUntested) testLine.append(" ", saveUntested);
      return [control("How it is reached", reach), control("Bridge", bridge), el("p", null, listAgents), agentListView(), control("Agent", agent),
        testLine, testResult, explain("agent-test")];
    }

    function fieldsFor(typeName) {
      if (!typeName) return [];
      routePreview.textContent = routeOf(typeName, state);
      return [
        el("h3", null, `${editing ? "Change" : "Add"} ${typeName}`),
        explain(TYPE_TOPIC[typeName]),
        ...commonControls(typeName),
        ...(typeName === "person" ? [control("Account", textInput("participant-account", "account", "github.com/name"))] : []),
        ...(typeName === "model endpoint" ? endpointControls() : []),
        ...(typeName === "CI agent" ? ciControls() : []),
        ...(BRIDGE_TYPES.has(typeName) ? bridgeControls() : []),
        el("p", null, "Route ", routePreview),
      ];
    }

    function stateFromCells(cells) {
      const route = text(cells.Route);
      // The schema's form `ci hosted secret <NAME>` / `ci runner:<label> secret <NAME>`, and the form saved earlier,
      // `workflow <file> on github-hosted|self-hosted secret <NAME>`, whose self-hosted runner names no label: every
      // self-hosted runner carries the label self-hosted (as settings.mjs's ciRoute reads it).
      const current = /^ci (?:hosted|runner:(\S+)) secret (\S+)$/.exec(route);
      const earlier = /^workflow (.*?) on (github-hosted|self-hosted) secret (.*)$/.exec(route);
      const ci = current ? { runner: current[1] === undefined ? "github-hosted" : "self-hosted", label: current[1] ?? "", secret: current[2] }
        : earlier ? { runner: earlier[2], label: earlier[2] === "self-hosted" ? "self-hosted" : "", secret: earlier[3] } : null;
      const bridge = /^bridge (.*?) agent (.*)$/.exec(route);
      return {
        name: text(cells.Name),
        model: text(cells.Model),
        context: text(cells.Context),
        price: text(cells.Price),
        place: text(cells["Processing place"]),
        capabilities: listedValues(cells.Capabilities),
        account: route.startsWith("account ") ? route.slice("account ".length) : "",
        endpoint: route.startsWith("endpoint ") ? route.slice("endpoint ".length) : "",
        runner: ci?.runner ?? "github-hosted",
        runnerLabel: ci?.label ?? "",
        secret: ci?.secret ?? "",
        bridge: bridge?.[1] ?? "",
        agent: bridge?.[2] ?? "",
        reach: reachedThrough({ route }) === null ? "bridge" : "through",
        through: reachedThrough({ route }) ?? "",
      };
    }

    function startAdd() {
      editing = null;
      panelTitle.textContent = "Add participant";
      panel.hidden = false;
      type.value = "";
      setType("");
      rebuild();
    }

    startEdit = (name) => {
      const row = participantRows(opened.text).find((candidate) => text(candidate.cells.Name) === name);
      if (!row) return;
      editing = { name };
      panelTitle.textContent = `Change ${name}`;
      panel.hidden = false;
      type.value = text(row.cells.Type);
      setType(type.value, stateFromCells(row.cells));
      rebuild();
    };

    add.addEventListener("click", startAdd);
    type.addEventListener("change", () => { setType(type.value); rebuild(); });

    panel.append(panelTitle, control("Type", type), fieldsBox, formBox, productUseBox, result);
    target.replaceChildren(el("section", "head", el("h2", null, "Participants")), el("p", null, add), panel, list);

    // Opened with the parameters `type` and `address` (a resource's *Add as participant*, UC-040 2a): the form of a new participant of that type, with the address where it belongs —
    // the kept endpoint that has this address, else the URL of a new one. Without both, or with a type no participant has, the page is as it is without them.
    if (TYPES.includes(params.type) && typeof params.address === "string" && params.address.trim() !== "") {
      startAdd();
      const address = params.address.trim();
      let values = {};
      if (params.type === "model endpoint") {
        const kept = endpointNames(context.store).find((name) => readSetting(context.store, `endpoint:${name}`)?.url === address);
        values = kept ? { endpoint: kept } : { endpoint: "", endpointUrl: address, inlineEndpoint: true };
      }
      type.value = params.type;
      setType(params.type, values);
      rebuild();
    }
  },
};
