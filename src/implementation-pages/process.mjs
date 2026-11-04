// The route `process` — How this product is developed (MOD-implementation-pages, docs/architecture/
// MOD-implementation-pages.md; Interfaces: view, route process; UC-002). It shows the catalogue's shipped models in their two
// groups, by their kind, each with what its `about` holds (step 2); the declared model's roles, each with who may hold it, whether one
// participant fills it or several may, the capabilities it needs (step 4), and a link to the Roles page, where they are
// filled (UC-048); phases, each with the roles that work in it, transitions,
// verification pairs, gates and branches; the available practices; what the product's process requirements add, or that
// it has none (7a); the Definition of Done; all beside a form from the declaration's schema
// (`MOD-product-process.declarationSchema`), with each finding of `declarationFindings` beside its field — among them a
// participant the declaration names, which names roles only —; and *Save*, offered only without an error, which writes
// the product's `docs/process.md` with `saveFile` as the person's own commit, naming the declared model's version by the
// commit of the instance its catalogue was read at. Who fills the roles is the product's role assignment's (UC-048), not
// this route's. When the author selects another model than the declared one, the kinds of artifact the declared model's
// phases produce and the selected one's do not are listed, none of them deleted (3b).
//
// Two gaps ITM-221 left in `schemaForm` are closed here, at the caller: it hands over a document whose edited section
// keeps the rows it was read with, not those of the text just typed — so, before `declarationFindings` judges the
// document and before `saveFile` writes it, it is written with `writeDocument` and read back with `readDocument`
// (`reread`, below); and its one Save is offered only once the form is connected and its own queued focus runs — so the
// route calls `schemaForm` and inserts what it returns into the page in the one turn of that call, never after an
// `await`.
//
// ITM-240 closes six gaps ITM-223's system and release tests of UC-002 found (F1 to F6, below), each at this route: F1
// at the process-vs-rules table (`shownBefore`); F2 and F3 beside phases and branches (`renderPanels`'s phasesPanel,
// `branchEndGate`); F4 beside practices (`practicesWithAdds`, read with the catalogue's own `modelSchema.practice`);
// F5 beside a process requirement's gate (`renderPanels`'s requirementsPanel); F6 at a role's missing-capability link
// (`roleInfo`).
//
// ITM-780 (UC-031 6a): when the catalogue as it stands holds another version of the declared model than the commit the
// declaration's `model_version` names — the two `version`s differ —, `versionChange` shows, before *Save* names the new
// commit, the workflows under each version side by side, the difference of the two model files, and what becomes invalid
// (`declarationFindings` of the declaration as it would be saved, `roleAssignmentFindings` against the new workflow). The
// product keeps the version it declared: nothing is written. Not part of this item: how the dashboard reaches this route.
//
// Module: MOD-implementation-pages

import { explain, schemaForm, chosenProduct } from "../site-frame/index.mjs";
import { readSetting } from "../browser-store/index.mjs";
import { readDocument, writeDocument, documentFindings } from "../documents/index.mjs";
import { catalogue, modelSchema, modelFindings, modelDiagram, planGrid } from "../model-catalogue/index.mjs";
import { participantSchema } from "../participant-list/index.mjs";
import { declarationSchema, declarationFindings, roleAssignmentFindings, roleAssignmentSchema, workflowOf } from "../product-process/index.mjs";
import { sourceSchemas } from "../source-register/index.mjs";
import { showDifference, renderMermaid } from "../markdown-render/index.mjs";
import { saveFile } from "../artifact-edits/index.mjs";
import { heads } from "./routes.mjs";

const DECLARATION_PATH = "docs/process.md";
const PARTICIPANTS_PATH = "docs/participants.md";
const SPEC_PATH = "SPEC.md";
const SOURCES_PATH = "docs/sources.md";
const ASSIGNMENT_FILE = /^docs\/role-assignments\/([^/]+)\.md$/;

// F1 (UC-002 step 1): whether this module has already rendered the process-vs-rules table once before. A plain
// module-level flag — in memory for this page's lifetime only, never written to the browser's storage, so it is no
// setting: it starts false again on every fresh load of this module and nothing here ever reads or writes a store for
// it.
let shownBefore = false;

// The two groups UC-002 step 2 shows the shipped models in, each the kind of model the catalogue says it is; and where an
// instance's own models are kept, by which a model of the instance is told from a shipped one (THE CATALOGUE IS DATA: no
// model is named here).
const GROUPS = [
  { label: "Plan-driven", kind: "planned" },
  { label: "Agile", kind: "pulled" },
];
const INSTANCE_MODELS = "docs/process-models/";

// A plain element with a class and children — the module runs in a browser, where `document` is global.
function el(name, className, ...children) {
  const node = document.createElement(name);
  if (className) node.className = className;
  node.append(...children);
  return node;
}

// The read-write round trip of the gap ITM-221 left: a document a form hands over keeps an edited section's rows as
// they stood when it was opened, not those of the text just typed. Writing it and reading it again reparses them, so
// that declarationFindings and saveFile judge and write the rows the person now sees.
const reread = (schema, path, document) => readDocument(schema, path, writeDocument(schema, document));

// The model of `models` whose path is `file`, or null.
const modelAt = (models, file) => models.find((model) => model.path === file) ?? null;

// F3 (UC-002 step 5): the model's own gate at the end of a branch given to `at` — a phase, or the sprint (any branch
// key that names no phase of `workflow`): for a phase, the gate that leaves it; for the sprint, the gate back to the
// model's first phase. "The model's own" excludes a gate added by a process requirement or by a practice, since those
// are not what a phase's or a sprint's branch merges into. Null where the model has no such gate.
function branchEndGate(workflow, at) {
  const ownGates = workflow.gates.filter((gate) => !gate.addedBy && !gate.practice);
  const isPhase = workflow.phases.some((phase) => phase.name === at);
  return ownGates.find((gate) => (isPhase ? gate.from === at : gate.to === workflow.phases[0]?.name)) ?? null;
}

// The elements below `root`, in tree order, that `match` accepts — node has no querySelector, and nothing else here
// needs one.
function elementsOf(root, match) {
  const found = [];
  (function walk(node) { for (const kid of node.childNodes) { if (kid.nodeType === 1) { if (match(kid)) found.push(kid); walk(kid); } } })(root);
  return found;
}

// The input of the form's field for `key`.
const fieldInput = (form, key) => elementsOf(form, (node) => node.getAttribute("data-key") === key)[0]
  ?.getElementsByTagName("input")[0];

// Sets a field's value as a person's typing does: the value, then the input event the field listens for.
function setField(form, key, value) {
  const input = fieldInput(form, key);
  input.value = value;
  input.dispatchEvent(new Event("input"));
}

export const route = {
  ...heads.process,

  async render(target, context) {
    // The empty product is the instance itself (MOD-site-frame's ViewContext).
    const { instance } = context;
    const product = context.product ?? instance;

    const [productInfo, instanceInfo] = await Promise.all([product.host.repositoryInfo(), instance.host.repositoryInfo()]);
    const [productSnapshot, instanceSnapshot] = await Promise.all([
      product.host.readSnapshot(productInfo.defaultBranch), instance.host.readSnapshot(instanceInfo.defaultBranch)]);

    const [declarationText, participantsText, instanceSpecText, cat] = await Promise.all([
      productSnapshot.read(DECLARATION_PATH), instanceSnapshot.read(PARTICIPANTS_PATH), instanceSnapshot.read(SPEC_PATH),
      catalogue(instanceSnapshot)]);

    const openedDeclaration = declarationText != null ? readDocument(declarationSchema, DECLARATION_PATH, declarationText) : null;
    let openedBlob = declarationText != null ? productSnapshot.blob(DECLARATION_PATH) : null;
    // A real Document for workflowOf even for a product without a declaration yet: readDocument never throws on the
    // content, so the empty text reads as a document with no fields and no sections.
    const declarationForWorkflow = readDocument(declarationSchema, DECLARATION_PATH, declarationText ?? "");
    let workflowDeclaration = declarationForWorkflow;

    const participants = readDocument(participantSchema(), PARTICIPANTS_PATH, participantsText ?? "");

    const instanceSpec = instanceSpecText ?? "";
    const declaredModel = openedDeclaration ? modelAt(cat.models, String(openedDeclaration.fields.model_file ?? "")) : null;
    let activeModel = declaredModel;
    let panelsReady = false;

    // F4 (step 6): each catalogue practice's own "## Adds", read from its file in the instance's snapshot — the path
    // `catalogue` names it at, shipped or the instance's own — with the catalogue's own practice schema. A practice
    // whose file this instance's snapshot does not hold (never so for a shipped one, since the instance is the
    // repository that ships them) adds "": nothing crashes, and nothing is shown for it.
    const practicesWithAdds = await Promise.all(cat.practices.map(async (practice) => {
      const text = await instanceSnapshot.read(practice.path);
      const document = text != null ? readDocument(modelSchema.practice, practice.path, text) : null;
      const adds = document?.sections.find((section) => section.heading === "## Adds")?.text ?? "";
      return { ...practice, adds, document };
    }));

    target.replaceChildren();
    const page = el("article", "process-page");
    target.append(page);

    // UC-031 6a: the declared model under the version the declaration names, beside the one as it stands.
    const change = declaredModel ? await versionChange() : null;
    if (change) page.append(change);

    // F1 (step 1): the process-vs-rules table (explain's own "process-model" topic) unfolded this module's first
    // render, folded at every later one — `shownBefore`, in memory only.
    const processVsRules = explain("process-model");
    if (!shownBefore) processVsRules.setAttribute("open", "");
    shownBefore = true;

    // Step 2/3: the catalogue's models, in their two groups, each with its About, and a card to choose it.
    const lost = el("p", "lost-artifacts");
    const modelsSection = el("section", "models", el("h2", null, "Process model"),
      el("div", "process-vs-rules", processVsRules), lost);
    const isOwn = (model) => model.path.startsWith(INSTANCE_MODELS);
    for (const group of GROUPS) {
      const groupModels = cat.models.filter((model) => !isOwn(model) && model.kind === group.kind);
      const groupEl = el("div", "model-group", el("h3", null, group.label),
        ...groupModels.map((model) => modelCard(model)));
      modelsSection.append(groupEl);
    }
    // The instance's own models, adapted from a shipped one, offered beside the shipped ones.
    const own = cat.models.filter(isOwn);
    if (own.length) modelsSection.append(el("div", "model-group", el("h3", null, "This instance"), ...own.map((model) => modelCard(model))));
    page.append(modelsSection);

    // The form from the declaration's schema — findings beside its fields, Save only without an error.
    const form = schemaForm(declarationSchema, openedDeclaration, {
      onSave: async (edited) => {
        const withVersion = { ...edited, fields: { ...edited.fields, model_version: instanceSnapshot.commit } };
        const text = writeDocument(declarationSchema, withVersion);
        const result = await saveFile(product.host, { path: DECLARATION_PATH, text, openedBlob });
        if (result.refused) {
          notice.textContent = "This declaration changed meanwhile; your edit is kept here, unsaved.";
          return;
        }
        notice.textContent = "";
        openedBlob = result.blob;
      },
      // writeDocument, inside reread, refuses a document missing a required value (model among them, before a model is
      // picked): documentFindings, which schemaForm always runs beside this, already names that finding on its own
      // field, so declarationFindings — which needs a document at least that complete — adds nothing here instead of
      // throwing through the form's one call to both.
      extraChecks: (live) => {
        try {
          workflowDeclaration = reread(declarationSchema, DECLARATION_PATH, live);
          if (panelsReady) {
            activeModel = modelAt(cat.models, String(workflowDeclaration.fields.model_file ?? "")) ?? activeModel;
            renderPanels(activeModel);
          }
          return declarationFindings(workflowDeclaration, cat, participants, instanceSpec);
        } catch {
          return [];
        }
      },
    });
    // Inserted in the same turn schemaForm returns it, so its queued focus finds the form already in the page.
    page.append(form);

    const notice = el("p", "save-notice");
    form.append(notice);
    const extra = el("div", "workflow-extra");
    form.append(extra);

    // The section that shows what the model's new version changes, or null where the declaration names no version or the
    // model's file is the same at that commit and now.
    async function versionChange() {
      const declaredCommit = String(openedDeclaration.fields.model_version ?? "");
      if (!declaredCommit) return null;
      let declaredSnapshot;
      try {
        declaredSnapshot = await instance.host.readSnapshot(declaredCommit);
      } catch (e) {
        // The commit the declaration names cannot be read: the page stands as for an unchanged model, with this one line.
        return el("p", "warn", `The version the declaration names, commit ${declaredCommit}, cannot be read: ${e?.message ?? String(e)}`);
      }
      const before = modelAt((await catalogue(declaredSnapshot)).models, declaredModel.path);
      if (!before || before.version === declaredModel.version) return null;

      const workflowAt = async (snapshot, catalogueAt, model) => {
        const names = workflowOf(openedDeclaration, model, [], instanceSpec).practices;
        const practices = (await Promise.all(catalogueAt.practices.filter((practice) => names.includes(practice.name)).map(async (practice) => {
          const text = await snapshot.read(practice.path);
          return text != null ? readDocument(modelSchema.practice, practice.path, text) : null;
        }))).filter(Boolean);
        return workflowOf(openedDeclaration, model, practices, instanceSpec);
      };
      const workflowBefore = await workflowAt(declaredSnapshot, await catalogue(declaredSnapshot), before);
      const workflowNow = await workflowAt(instanceSnapshot, cat, declaredModel);
      const side = (className, label, workflow) => el("div", className, el("h4", null, label),
        el("ul", "phases", ...workflow.phases.map((phase) =>
          el("li", null, `${phase.name} (${phase.roles.join(", ")}) → ${phase.produces.join(", ")}`))),
        el("ul", "gates", ...workflow.gates.filter((gate) => !gate.addedBy).map((gate) =>
          el("li", null, `${gate.name}: ${gate.artifacts} — ${gate.condition} — decided by ${gate.decider}`))),
        el("ul", "roles", ...workflow.roles.map((role) => el("li", null, `${role.name} (${role.filledBy})`))));

      const [textBefore, textNow] = await Promise.all([declaredSnapshot.read(before.path), instanceSnapshot.read(declaredModel.path)]);
      const wouldBeSaved = { ...openedDeclaration, fields: { ...openedDeclaration.fields, model_version: instanceSnapshot.commit } };
      const declarationProblems = declarationFindings(wouldBeSaved, cat, participants, instanceSpec);

      const { entry: entrySchema, links: linksSchema } = sourceSchemas();
      const sourcesText = await productSnapshot.read(SOURCES_PATH);
      const linked = sourcesText != null ? readDocument(linksSchema, SOURCES_PATH, sourcesText).sections[0]?.rows ?? [] : [];
      const sources = (await Promise.all(linked.map(async ({ cells }) => {
        const path = `docs/sources/${cells.Source}.md`;
        const entry = await instanceSnapshot.read(path);
        return entry != null ? readDocument(entrySchema, path, entry) : null;
      }))).filter(Boolean);
      const assignments = await Promise.all(productSnapshot.paths.filter((path) => ASSIGNMENT_FILE.test(path)).sort()
        .map(async (path) => readDocument(roleAssignmentSchema, path, await productSnapshot.read(path))));
      const assignmentProblems = roleAssignmentFindings(assignments, workflowNow, participants, sources);

      const listed = (className, findings) => el("ul", className, ...findings.map((finding) =>
        el("li", null, `${finding.kind}: ${finding.what}`)));
      const difference = el("div", "version-difference", showDifference(textBefore ?? "", textNow ?? ""));
      return el("section", "version-change", el("h3", null, `${declaredModel.name} has a new version`),
        el("div", "version-workflows", side("version-before", "As declared", workflowBefore), side("version-after", "As it stands", workflowNow)),
        difference,
        el("h4", null, "What becomes invalid"),
        listed("version-declaration-findings", declarationProblems), listed("version-assignment-findings", assignmentProblems));
    }

    function modelCard(model) {
      const card = el("div", "model-card",
        el("h4", null, model.name),
        el("p", null, `manages: ${model.about?.manages ?? ""}`),
        el("p", null, `accepts: ${model.about?.accepts ?? ""}`),
        el("p", null, `example: ${model.about?.example ?? ""}`),
        el("p", null, `chapter: ${model.about?.chapter ?? ""}`));
      card.setAttribute("data-model", model.name);
      const choose = el("button", "btn", "Choose");
      choose.type = "button";
      choose.addEventListener("click", () => pick(model));
      card.append(choose);
      return card;
    }

    // The author selects a model (step 3): its name, file and the version — the commit the catalogue was read at — go
    // into the form's fields, as a person's typing does, so the rest of the page answers through the same reactivity;
    // the workflow panels and the lost-artifacts notice (3b) are drawn for it.
    function pick(model) {
      activeModel = model;
      setField(form, "model", model.name);
      setField(form, "model_file", model.path);
      setField(form, "model_version", instanceSnapshot.commit);
      renderPanels(model);
      lost.textContent = lostArtifacts(declaredModel, model);
    }

    panelsReady = true;
    renderPanels(declaredModel);

    // The panels beside the form that follow the live declaration's selected model and practices: the roles, each with how
    // many fill it and what it needs (step 4),
    // phases/transitions/pairs/gates and branches (step 5), the available practices (step 6), what the process
    // requirements add or that there are none (step 7, 7a), and the Definition of Done's preset rules (step 8).
    function renderPanels(model) {
      extra.replaceChildren();
      if (!model) return;
      const selectedPracticeNames = workflowOf(workflowDeclaration, model, [], instanceSpec).practices;
      const selectedPractices = practicesWithAdds.filter((practice) => selectedPracticeNames.includes(practice.name))
        .map((practice) => practice.document).filter(Boolean);
      const workflow = workflowOf(workflowDeclaration, model, selectedPractices, instanceSpec);

      const rolesPanel = el("section", "roles-panel", el("h3", null, "Roles"), explain("roles-and-participants"));
      for (const role of workflow.roles) rolesPanel.append(roleInfo(role));
      extra.append(rolesPanel);

      const phasesPanel = el("section", "phases-panel", el("h3", null, "Phases and gates"),
        explain("phases-and-gates"), explain("branch-of-its-own"),
        el("ul", "phases", ...workflow.phases.map((phase) =>
          el("li", null, `${phase.name} (${phase.roles.join(", ")}) → ${phase.produces.join(", ")}`))),
        // F2: the transitions between the phases, and which phases pair for verification, beside the phases and gates.
        el("ul", "transitions", ...workflow.transitions.map((transition) =>
          el("li", null, `${transition.from} → ${transition.to} (${transition.kind})`))),
        el("ul", "verification-pairs", ...workflow.pairs.map((pair) =>
          el("li", null, `${pair.phase} checked by ${pair.checkedBy}`))),
        el("ul", "gates", ...workflow.gates.filter((gate) => !gate.addedBy).map((gate) =>
          el("li", null, `${gate.name}: ${gate.artifacts} — ${gate.condition} — decided by ${gate.decider}${gate.practice ? ` — practice: ${gate.practice}` : ""}`))),
        // F3: beside a branch, the gate at its end — merging it into the default branch (`WORK MERGES INTO THE
        // DEFAULT BRANCH UNLESS A BRANCH IS SET`), decided by the model's own gate that leaves the phase, or, for the
        // sprint, the model's own gate back to its first phase.
        el("ul", "branches", ...Object.entries(workflow.branches).map(([at, branch]) => {
          const gate = branchEndGate(workflow, at);
          const end = gate
            ? ` — merging it into the default branch is the gate at its end: ${gate.from} → ${gate.to}, ${gate.artifacts} — ${gate.condition}, decided by ${gate.decider}`
            : "";
          return el("li", null, `${at}: ${branch}${end}`);
        })));
      extra.append(phasesPanel);

      // F4: each practice beside what it adds, read from its file with the catalogue's practice schema.
      const practicesPanel = el("section", "practices-panel", el("h3", null, "Practices"), explain("practices"),
        el("ul", "practices-available", ...practicesWithAdds.map((practice) =>
          el("li", "practice", el("div", null, `${practice.name} (fits: ${practice.fits.join(", ")})`),
            el("div", "practice-adds", practice.adds)))));
      extra.append(practicesPanel);

      // F5: a gate a process requirement adds, with the two phases it stands between.
      const added = workflow.gates.filter((gate) => gate.addedBy);
      const requirementsPanel = el("section", "process-requirements", el("h3", null, "Process requirements"),
        explain("process-requirements"),
        added.length
          ? el("ul", null, ...added.map((gate) =>
            el("li", null, `${gate.name}: ${gate.from} → ${gate.to} — ${gate.artifacts} (${gate.addedBy.source ?? "no such requirement"})`)))
          : el("p", null, "This product has no process requirements yet."));
      extra.append(requirementsPanel);

      const donePanel = el("section", "done-panel", el("h3", null, "Definition of Done"), explain("definition-of-done"),
        el("ul", "done-rules", ...workflow.done.map((rule) => el("li", null, rule))));
      extra.append(donePanel);
    }

    // A role, who may hold it, whether one participant fills it or several may, and its capabilities (step 4), and where it
    // is filled: the Roles page.
    function roleInfo(role) {
      const block = el("div", "role-info", el("strong", null, `${role.name} (${role.filledBy})`),
        el("p", "how-many", role.howMany === "one" ? "one participant fills it" : "several participants may fill it"),
        el("p", null, `needs: ${role.capabilities.join(", ")}`));
      block.setAttribute("data-role", role.name);
      // Who fills the role is the product's role assignment's, chosen on the Roles page (UC-048), not this route's.
      const link = el("a", null, "Roles");
      link.href = "#roles";
      block.append(el("p", null, "who fills it: ", link));
      return block;
    }
  },
};

// The kinds of artifact `before`'s phases produce that `after`'s do not (3b); "" where there is nothing to lose,
// including while no model was declared yet.
function lostArtifacts(before, after) {
  if (!before || !after || before.name === after.name) return "";
  const had = new Set(before.phases.flatMap((phase) => phase.produces));
  const now = new Set(after.phases.flatMap((phase) => phase.produces));
  const missing = [...had].filter((kind) => !now.has(kind));
  if (!missing.length) return "";
  return `${before.name} produced ${missing.join(", ")}, which ${after.name} does not; nothing is deleted.`;
}

// ---- The route `models` — the instance's process models (UC-031 steps 1 and 2b). It lists the catalogue of the instance's snapshot: the shipped
// models, then the instance's own, each with its kind of work, the products of this browser whose declaration names it (each address of the
// setting `products` connected with MOD-site-frame's `chosenProduct`, its `docs/process.md` read with that product's host through a snapshot narrowed to that file; an address that
// cannot be read is shown with its reason) and the catalogue's findings for it. A shipped model offers *Adapt*, an instance's model *Edit*,
// the page *+ New model*; they lead to `#models/name=<name>`, `+ New model` to `#models/name=` (the frame reads only `key=value` parts).

function link(label, className, href) {
  const anchor = el("a", className, label);
  anchor.setAttribute("href", href);
  return anchor;
}

// The model file each product of this browser declares, or the reason it could not be read: { address, modelFile } | { address, reason }.
// modelFile is null for a product without a declaration.
async function declarationsOf(context) {
  const { store } = context;
  return Promise.all((readSetting(store, "products") ?? []).map(async (address) => {
    try {
      const product = await chosenProduct({ store, fragment: `#models/product=${encodeURIComponent(address)}` });
      const { defaultBranch } = await product.host.repositoryInfo();
      const declaration = await (await product.host.readSnapshot(defaultBranch, { folders: [DECLARATION_PATH] })).read(DECLARATION_PATH);
      const modelFile = declaration == null ? null : String(readDocument(declarationSchema, DECLARATION_PATH, declaration).fields.model_file ?? "");
      return { address, modelFile };
    } catch (failure) {
      return { address, reason: String(failure?.message ?? failure) };
    }
  }));
}

// The products among `declarations` whose declaration names the model file `path`, as a list; and the products that could not be read, with their reasons, as a
// list (null where every one could be). The list of the models and the editor of a model both draw them (UC-031 1 and 6a).
const productsDeclaring = (declarations, path) => el("ul", "products", ...declarations.filter((declaration) => declaration.modelFile === path).map((declaration) => el("li", null, declaration.address)));
const unreadableOf = (declarations) => {
  const unreadable = declarations.filter((declaration) => declaration.reason !== undefined);
  return unreadable.length ? el("ul", "unreadable", ...unreadable.map((declaration) => el("li", "source", `${declaration.address}: ${declaration.reason}`))) : null;
};

export const modelsRoute = {
  ...heads.models,

  async render(target, context, params = {}) {
    // `models/<name>` (UC-031 steps 2 to 6): the editor; `models` alone: the list.
    if (params.name !== undefined) return editor(target, context, params.name);
    const { instance } = context;
    const { defaultBranch } = await instance.host.repositoryInfo();
    const [cat, declarations] = await Promise.all([
      instance.host.readSnapshot(defaultBranch).then((snapshot) => catalogue(snapshot)), declarationsOf(context)]);

    const row = (model, button) => {
      const findings = cat.findings[model.path] ?? [];
      const item = el("li", "model", el("h4", null, model.name),
        el("span", "kind", model.kind), explain("model-kind"),
        productsDeclaring(declarations, model.path), explain("model-products"));
      if (findings.length) {
        item.append(el("ul", "findings", ...findings.map((finding) => el("li", null, `${finding.kind}: ${finding.what}`))), explain("model-findings"));
      }
      item.setAttribute("data-model", model.name);
      item.append(button);
      return item;
    };
    const to = (model) => `#models/name=${encodeURIComponent(model.name)}`;
    const isOwn = (model) => model.path.startsWith(INSTANCE_MODELS);

    const shipped = el("section", "shipped-models", el("h3", null, "Shipped models"), explain("models-shipped"),
      el("ul", null, ...cat.models.filter((model) => !isOwn(model)).map((model) => row(model, link("Adapt", "adapt", to(model))))));
    const own = el("section", "own-models", el("h3", null, "This instance's models"), explain("models-own"),
      el("ul", null, ...cat.models.filter(isOwn).map((model) => row(model, link("Edit", "edit", to(model))))),
      link("+ New model", "new-model", "#models/name="));

    const page = el("article", "models-page", el("h2", null, "Process models"));
    page.append(...[unreadableOf(declarations), shipped, own].filter(Boolean));
    target.replaceChildren(page);
  },
};

// ---- The route `models/<name>` — the editor of a process model (UC-031 steps 2 to 6, 2a, 4a, 5a and 6b). A shipped model's name opens *Adapt*: a
// copy of its file under a new name, with `adapted_from` naming it; an instance's model opens itself (*Edit*); the empty name opens *+ New model*,
// which first asks for the kind of work and then opens a definition of that kind with its sections empty. The form is MOD-site-frame's schemaForm
// over `modelSchema.model`, with `modelFindings` beside their fields while the author types, and *Save* offered only without an error. Beside it
// the live diagram of `modelDiagram`, drawn with `renderMermaid`, and, for a planned model, the preview of `planGrid` for a product of this browser
// the author picks, its accepted requirements those of its facts (`productFacts`, read once on that pick). *Save* writes
// `docs/process-models/<name>.md` of the instance with `saveFile`, as the person's own commit, only on the blob the editor opened at that path; a
// file changed meanwhile is not written, and both versions are shown (6b). *Discard* leads back to the list: the draft is kept on the screen only
// (4a — the module's Uses name no write to the browser's store).

// A Finding's identity: every field of MOD-text-tools' Finding — artifact, line, kind, rule, what, fix.
const identity = ({ artifact, line, kind, rule, what, fix }) => JSON.stringify([artifact, line, kind, rule, what, fix]);

// The findings of modelFindings beyond the model's schema: those documentFindings does not also give for the same document.
// schemaForm shows documentFindings' own beside their fields already, so that each finding is shown once.
function beyondSchema(document) {
  const schemaOwn = new Set(documentFindings(modelSchema.model, document).map(identity));
  return modelFindings(document).filter((found) => !schemaOwn.has(identity(found)));
}

// The file of the instance's model named `name`.
const modelPath = (name) => `${INSTANCE_MODELS}${name}.md`;

// The definition + New model opens for the kind of work picked (2a): the kind, the measure where only one fits it, each section of the model's
// schema as a table without rows, and for pulled work the flow control's three rows, their values left out.
function emptyDefinition(kind) {
  const table = (heading, columns) => `${heading}\n\n| ${columns.join(" | ")} |\n|${columns.map(() => "---|").join("")}\n`;
  const sections = [table("## Phases", ["Name", "Role", "Produces"]), table("## Transitions", ["From", "To", "Kind"]),
    table("## Verification pairs", ["Phase", "Checked by"]), table("## Gates", ["Between", "Artifacts", "Condition", "Decider"]),
    table("## Roles", ["Name", "Filled by", "How many", "Capabilities"])];
  if (kind === "pulled") sections.push(`${table("## Flow control", ["Kind", "Value"])}| WIP limit | — |\n| Time box | — |\n| Sprints | no |\n`);
  const measure = kind === "planned" ? "measure: plan entries per phase\n" : "";
  return `---\nkind: ${kind}\n${measure}---\n# New model\n\n${sections.join("\n")}`;
}

// The first name `<name>-adapted`, `<name>-adapted-2`, … that no model of the catalogue has and no file of the instance holds.
function adaptedName(name, cat, snapshot) {
  const taken = (candidate) => cat.models.some((model) => model.name === candidate) || snapshot.paths.includes(modelPath(candidate));
  let candidate = `${name}-adapted`;
  for (let n = 2; taken(candidate); n++) candidate = `${name}-adapted-${n}`;
  return candidate;
}

async function editor(target, context, name) {
  const { instance, store } = context;
  const reading = declarationsOf(context); // the products' declarations, read beside the instance's snapshot (UC-031 6a)
  const { defaultBranch } = await instance.host.repositoryInfo();
  const snapshot = await instance.host.readSnapshot(defaultBranch);
  const cat = await catalogue(snapshot);
  const declarations = await reading;
  const page = el("article", "model-editor");
  target.replaceChildren(page);

  if (name === "") {
    // 2a: the kind of work first; the form follows it.
    page.append(el("h2", null, "New model"));
    const choice = el("section", "kind-choice", el("h3", null, "The kind of work"), explain("model-kind"));
    for (const kind of ["planned", "pulled"]) {
      const button = el("button", "btn", kind);
      button.type = "button";
      button.setAttribute("data-kind", kind);
      button.addEventListener("click", () => {
        choice.remove();
        open(readDocument(modelSchema.model, modelPath("new-model"), emptyDefinition(kind)));
      });
      choice.append(button);
    }
    page.append(choice, link("Discard", "discard", "#models"));
    return;
  }

  const model = cat.models.find((candidate) => candidate.name === name);
  const text = model ? await snapshot.read(model.path) : null;
  if (text == null) {
    page.append(el("h2", null, "Process model"), el("p", "unknown-model", `The catalogue of this instance holds no model named ${name}.`),
      link("Process models", "back", "#models"));
    return;
  }
  if (model.path.startsWith(INSTANCE_MODELS)) {
    page.append(el("h2", null, `Edit ${name}`));
    open(readDocument(modelSchema.model, model.path, text));
    return;
  }
  // Adapt (step 2): the shipped file under a new name, naming the model it was adapted from.
  const copyName = adaptedName(name, cat, snapshot);
  const shipped = readDocument(modelSchema.model, modelPath(copyName), text);
  const copy = { ...shipped, fields: { ...shipped.fields, name: copyName, adapted_from: name } };
  page.append(el("h2", null, `Adapt ${name}`));
  open(readDocument(modelSchema.model, copy.path, writeDocument(modelSchema.model, copy)));

  // The editor on `opened`: the form, the live diagram, the plan's preview for a planned model, and Save.
  function open(opened) {
    const notice = el("div", "save-notice");
    const diagram = el("div", "model-diagram");
    const grid = el("div", "plan-grid");
    const preview = el("section", "plan-preview", el("h3", null, "The plan for a product"), explain("process-model"));
    const saved = new Map(); // the blob each path was saved with from this editor, the version a second save starts from
    let current = null; // the Model the form holds now, as the catalogue reads it
    let chosen = null; // the product picked for the preview: { address, requirements } | { address, reason }
    let turn = 0;

    // Where the definition is saved: the file named by the name typed, or, while none is, where it was opened.
    const placed = (document) => ({ ...document, path: document.fields.name ? modelPath(String(document.fields.name)) : opened.path });

    // 6a: the products of this browser that declare the model the definition would be saved as, beside the form; those that could not be read, as the list shows them.
    // The form's extraChecks draw them when it opens and at every typing.
    const users = el("div", "model-users");
    const usersPart = el("section", "model-products", el("h3", null, "Products that declare this model"), explain("model-products"), users);
    const showUsers = (path) => users.replaceChildren(...[productsDeclaring(declarations, path), unreadableOf(declarations)].filter(Boolean));

    // The Model the definition typed is, read by the catalogue itself from a snapshot that holds only that file; null for a definition that
    // cannot be written yet (a required value left out) or that stands at no path of an instance's model.
    async function modelOfTyped(document) {
      let typed;
      try {
        typed = writeDocument(modelSchema.model, document);
      } catch {
        return null;
      }
      const only = { repository: snapshot.repository, ref: snapshot.ref, commit: snapshot.commit, paths: [document.path],
        read: async (path) => (path === document.path ? typed : null), readMany: async () => {}, blob: () => null };
      return (await catalogue(only)).models.find((candidate) => candidate.path === document.path) ?? null;
    }

    // The diagram and the preview follow the definition typed; the newest typing wins, and a definition that cannot be read leaves the last.
    async function follow(document) {
      const mine = ++turn;
      const typed = await modelOfTyped(document);
      if (mine !== turn || !typed) return;
      current = typed;
      const drawn = await renderMermaid(modelDiagram(typed));
      if (mine !== turn) return;
      diagram.replaceChildren(drawn);
      showPreview();
    }

    // Step 5 and 5a: every accepted requirement of the product picked once in every phase, with the count; a product without one shows the
    // phases empty. Only for a planned model.
    function showPreview() {
      preview.hidden = current?.kind !== "planned";
      if (preview.hidden || !chosen) return grid.replaceChildren();
      if (chosen.reason !== undefined) return grid.replaceChildren(el("p", "preview-unreadable", `${chosen.address}: ${chosen.reason}`));
      const { entries, count } = planGrid(chosen.requirements, current);
      const none = chosen.requirements.length ? [] : [el("p", "preview-none", `${chosen.address} has no accepted requirements yet: the plan's phases stay empty.`)];
      grid.replaceChildren(el("p", "plan-count", count), ...none, el("ul", "plan-phases", ...current.phases.map((phase) => {
        const item = el("li", "plan-phase", el("h4", null, phase.name),
          el("ul", null, ...entries.filter((entry) => entry.phase === phase.name).map((entry) => el("li", null, entry.requirement))));
        item.setAttribute("data-phase", phase.name);
        return item;
      })));
    }

    // The product the author picks: its facts read once, for its accepted requirements.
    async function pick(address) {
      grid.replaceChildren(el("p", null, `Reading the accepted requirements of ${address} …`));
      try {
        const product = await chosenProduct({ store, fragment: `#models/product=${encodeURIComponent(address)}` });
        // MOD-progress-measures is imported only here, on the first pick: the routes `models` and `process` load nothing of it before.
        const { productFacts } = await import("../progress-measures/index.mjs");
        const facts = await productFacts(product.host, snapshot, (commit) => instance.host.readSnapshot(commit), new Date(), { scope: "all" });
        chosen = Array.isArray(facts.requirements) ? { address, requirements: facts.requirements }
          : { address, reason: "its accepted requirements cannot be read." };
      } catch (failure) {
        chosen = { address, reason: String(failure?.message ?? failure) };
      }
      showPreview();
    }

    const form = schemaForm(modelSchema.model, opened, {
      extraChecks: (live) => {
        const document = placed(live);
        showUsers(document.path);
        follow(document);
        return beyondSchema(document);
      },
      onSave: async (live) => {
        const document = placed(live);
        const typed = writeDocument(modelSchema.model, document);
        const openedBlob = saved.has(document.path) ? saved.get(document.path) : snapshot.blob(document.path);
        let result;
        try {
          result = await saveFile(instance.host, { path: document.path, text: typed, openedBlob, openedId: null });
        } catch (failure) {
          notice.replaceChildren(el("p", "save-failed", `Nothing was saved: ${failure?.message ?? failure}`));
          return;
        }
        if (result.refused) {
          // 6b: nothing is written; the version in the repository beside the author's, for the author to decide.
          notice.replaceChildren(el("p", "save-refused", `${document.path} changed in the repository since this editor opened it, so nothing was written. `
            + "Your definition stays in the form. Below, the version in the repository against yours: keep yours and save it once you have taken the "
            + "newer one into it, or discard yours."), showDifference(result.current ?? "", typed));
          return;
        }
        saved.set(document.path, result.blob);
        const declaring = declarations.some((declaration) => declaration.modelFile === document.path);
        notice.replaceChildren(el("p", "saved", `Saved as ${document.path}.`),
          ...(declaring ? [el("p", "saved-products", "Products that declare it:"), productsDeclaring(declarations, document.path)] : []),
          link("Process models", "back", "#models"));
      },
    });
    // 2a, "Agent M adapts the form to it": a planned definition's form has no part `## Flow control`, which MOD-model-catalogue gives "for
    // `pulled` only". The form follows the kind the definition is opened with.
    if (opened.fields.kind === "planned") {
      for (const part of elementsOf(form, (node) => node.getAttribute("data-section") === "## Flow control")) part.remove();
    }
    // Inserted in the same turn schemaForm returns it, so that its queued focus finds it in the page.
    page.append(usersPart, el("section", "model-form", explain("model-findings"), form), notice,
      el("section", "model-picture", el("h3", null, "Phases, verification pairs and gates"), explain("phases-and-gates"), diagram));
    for (const address of readSetting(store, "products") ?? []) {
      const button = el("button", "btn", address);
      button.type = "button";
      button.setAttribute("data-preview-product", address);
      button.addEventListener("click", () => pick(address));
      preview.append(button);
    }
    preview.append(grid);
    page.append(preview, link("Discard", "discard", "#models"));
    showPreview();
  }
}
