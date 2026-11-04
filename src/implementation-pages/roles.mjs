// The route `roles` — Roles (MOD-implementation-pages, docs/architecture/MOD-implementation-pages.md; Interfaces: view, route
// roles; UC-048): the roles of the product's process, each with who may fill it — a person, an agent or either —, how many fill
// it, the capabilities it needs, and the participants of the instance's list that may hold it, each with where it processes
// data — a role no participant can hold names the capability none has, and links to the participants (3b); the product's role
// assignments — its teams, in a model with sprints —, each with who fills which role and the findings of
// roleAssignmentFindings beside it, given the entries of the instance's source register that the product's docs/sources.md
// links (3c); + Team in a model with sprints (2a), and Fill the roles for a product that has no role assignment yet; Change,
// which opens an assignment's form in place (4a); the form's findings, kept up to date with each tick, Save disabled while one
// of them is an error — no person for a role that needs one (3a), a second participant for a role one fills (3d) — and a
// warning shown beside an enabled Save (3c); Save, which writes the role assignment with saveFile as the person's own commit;
// and Remove team, refused while a sprint of the team holds an item (heldItems; 4b). Each step carries its folded What is
// this?, MOD-site-frame's explain of a topic of its explanations.md. The layout is the one of #uc and #arc: a head, panels,
// list tables, buttons — no style of its own.
//
// Module: MOD-implementation-pages
//
// The page is written as HTML into the target, and each control is looked up by its own attribute selector. For a team's removal
// the product's pull requests are read with MOD-repository-hosts' listPullRequests and handed to heldItems; when they cannot be
// read they are "unknown", and every item its sprints selected and did not send back counts as held, never guessed released.

import { readDocument } from "../documents/index.mjs";
import { catalogue, modelSchema } from "../model-catalogue/index.mjs";
import { eligible, participantSchema, participantsOf } from "../participant-list/index.mjs";
import { sourceSchemas } from "../source-register/index.mjs";
import { declarationSchema, roleAssignmentFindings, roleAssignmentSchema, workflowOf } from "../product-process/index.mjs";
import { heldItems, planSchemas } from "../work-plans/index.mjs";
import { saveFile } from "../artifact-edits/index.mjs";
import { explain } from "../site-frame/index.mjs";
import { heads } from "./routes.mjs";

const DECLARATION = "docs/process.md";
const PARTICIPANTS = "docs/participants.md";
const SOURCES = "docs/sources.md";
const ASSIGNMENT_FILE = /^docs\/role-assignments\/([^/]+)\.md$/;
const SPRINT_FILE = /^docs\/backlog\/sprints\/[^/]+\/\d+\.md$/;
const NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const h = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const text = (value) => (typeof value === "string" ? value : value === null || value === undefined ? "" : String(value));
const list = (value) => (Array.isArray(value) ? value.map(text) : text(value).split(",").map((part) => part.trim()).filter(Boolean));
const listed = (names) => (names.length < 2 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`);
const nameOf = (path) => ASSIGNMENT_FILE.exec(text(path))?.[1] ?? "";
const pathOf = (name) => `docs/role-assignments/${name}.md`;

// A topic's folded What is this?, as the HTML of the element MOD-site-frame's explain gives.
function folded(topic) {
  const holder = document.createElement("div");
  holder.append(explain(topic));
  return holder.innerHTML;
}

// Findings as a list, each with what to do: an error marked as a warning is, a warning muted.
const findingsList = (found) => (found.length ? `<ul class="small">${found.map((f) => `<li class="${f.kind === "error" ? "warn" : "muted"}">`
  + `${h(f.what)} — ${h(f.fix)}</li>`).join("")}</ul>` : "");

// Whether a participant's type fits who may fill a role: a person, an agent — any other type —, or either.
const fits = (filledBy, participant) => (filledBy === "person" ? participant.type === "person"
  : filledBy === "agent" ? participant.type !== "person" : true);

// The participants of the role assignment for a role, from its ## Roles table.
const holdersIn = (assignment, role) => list((assignment?.sections ?? []).flatMap((s) => s.rows ?? [])
  .find((row) => text(row.cells.Role) === role)?.cells.Participants);

// The text of a role assignment: its title, and ## Roles with one row for each role that has participants.
function assignmentText(name, holders) {
  const rows = [...holders].filter(([, names]) => names.length).map(([role, names]) => `| ${role} | ${names.join(", ")} |`);
  return [`# ${name}`, "", "## Roles", "", "| Role | Participants |", "|---|---|", ...rows, ""].join("\n");
}

export const route = {
  ...heads.roles,

  async render(target, context) {
    // The empty product is the instance itself (MOD-site-frame's ViewContext).
    const { instance } = context;
    const product = context.product ?? instance;
    const [productInfo, instanceInfo] = await Promise.all([product.host.repositoryInfo(), instance.host.repositoryInfo()]);
    const [productSnapshot, instanceSnapshot] = await Promise.all([
      product.host.readSnapshot(productInfo.defaultBranch), instance.host.readSnapshot(instanceInfo.defaultBranch)]);
    const [declarationText, participantsText, specText, sourcesText, cat] = await Promise.all([
      productSnapshot.read(DECLARATION), instanceSnapshot.read(PARTICIPANTS), instanceSnapshot.read("SPEC.md"),
      productSnapshot.read(SOURCES), catalogue(instanceSnapshot)]);

    const declaration = readDocument(declarationSchema, DECLARATION, declarationText ?? "");
    const model = cat.models.find((m) => m.path === text(declaration.fields.model_file)) ?? null;
    const spec = specText ?? "";
    const participantsDoc = readDocument(participantSchema(), PARTICIPANTS, participantsText ?? "");
    const participants = participantsOf(participantsDoc);

    // The practices the declaration names, from their files, for the roles they add.
    const named = model ? workflowOf(declaration, model, [], spec).practices : [];
    const practices = (await Promise.all(cat.practices.filter((p) => named.includes(p.name)).map(async (p) => {
      const practiceText = await instanceSnapshot.read(p.path);
      return practiceText != null ? readDocument(modelSchema.practice, p.path, practiceText) : null;
    }))).filter(Boolean);
    const workflow = model ? workflowOf(declaration, model, practices, spec) : null;
    const sprints = model?.flow?.sprints === true;

    // The entries of the instance's source register the product links, for the places a holder's data may go.
    const { entry: entrySchema, links: linksSchema } = sourceSchemas();
    const linked = sourcesText != null ? readDocument(linksSchema, SOURCES, sourcesText).sections[0]?.rows ?? [] : [];
    const sources = (await Promise.all(linked.map(async ({ cells }) => {
      const path = `docs/sources/${cells.Source}.md`;
      const entry = await instanceSnapshot.read(path);
      return entry != null ? readDocument(entrySchema, path, entry) : null;
    }))).filter(Boolean);

    const assignments = await Promise.all(productSnapshot.paths.filter((p) => ASSIGNMENT_FILE.test(p)).sort()
      .map(async (p) => readDocument(roleAssignmentSchema, p, await productSnapshot.read(p))));
    const findings = workflow ? roleAssignmentFindings(assignments, workflow, participantsDoc, sources) : [];

    // The findings of a role assignment of this name and these holders, read together with the product's other ones.
    function findingsOf(name, holders) {
      const path = pathOf(name);
      const edited = readDocument(roleAssignmentSchema, path, assignmentText(name, holders));
      return roleAssignmentFindings([...assignments.filter((a) => a.path !== path), edited], workflow, participantsDoc, sources)
        .filter((f) => f.artifact === path);
    }

    // Who may hold a role: the participants of the right type that have every capability it needs.
    const mayHold = (role) => eligible(participants.filter((p) => fits(role.filledBy, p)), { capabilities: role.capabilities }).eligible;
    const whoText = (p) => `${h(p.name)} <span class="muted small">(${h(p.type)}${p.place ? `, ${h(p.place)}` : ""})</span>`;
    function missingText(role) {
      const candidates = participants.filter((p) => fits(role.filledBy, p));
      const lacking = role.capabilities.filter((c) => !candidates.some((p) => p.capabilities.includes(c)));
      return `<span class="warn">no participant has ${h(lacking.length ? listed(lacking) : `all of ${listed(role.capabilities)}`)}</span>`
        + ` — <a href="#participants">add a participant who has it</a>`;
    }

    let editing = null; // { name, isNew } — the assignment whose form is open, in memory only

    // The form's choices: the participants offered for a role — those who may hold it, and any who hold it now without
    // being one of them, so that they can be taken off —; the name typed; the participants ticked.
    const offeredFor = (role, held) => [...new Set([...mayHold(role), ...participants.filter((p) => held.includes(p.name))])];
    const formName = () => (editing.isNew ? text(target.querySelector("[data-team-name]")?.value).trim() : editing.name);
    const formHolders = () => new Map(workflow.roles.map((role) => [role.name, participants.map((p) => p.name)
      .filter((who) => target.querySelector(`[data-hold="${role.name}|${who}"]`)?.checked === true)]));

    const rolesPanel = () => `<section class="panel" data-part="roles"><h3>The roles of <code>${h(model.name)}</code></h3>
      <table class="list"><thead><tr><th>Role</th><th>Filled by</th><th>How many</th><th>Needs</th><th>Who may hold it</th></tr></thead><tbody>
      ${workflow.roles.map((role) => {
        const may = mayHold(role);
        return `<tr data-role="${h(role.name)}"><td data-label="Role">${h(role.name)}</td><td data-label="Filled by">${h(role.filledBy)}</td><td data-label="How many">${h(role.howMany)}</td>
          <td class="small" data-label="Needs">${role.capabilities.map(h).join(", ")}</td><td data-label="Who may hold it">${may.length ? may.map(whoText).join("<br>") : missingText(role)}</td></tr>`;
      }).join("")}</tbody></table>
      ${folded("roles-and-participants")}</section>`;

    const assignmentPanel = (assignment) => {
      const name = nameOf(assignment.path);
      return `<section class="panel" data-assignment="${h(name)}"><h3>${h(name)}</h3>
        <table class="list"><thead><tr><th>Role</th><th>Participants</th></tr></thead><tbody>
        ${workflow.roles.map((role) => `<tr data-role="${h(role.name)}"><td data-label="Role">${h(role.name)}</td><td data-label="Participants">${holdersIn(assignment, role.name).map(h).join(", ")
          || "<span class=\"warn\">none</span>"}</td></tr>`).join("")}</tbody></table>
        ${findingsList(findings.filter((f) => f.artifact === assignment.path))}
        <p><button class="btn" data-edit="${h(name)}">Change</button>${sprints ? ` <button class="btn" data-remove="${h(name)}">Remove team</button>` : ""}</p>
        <div data-remove-result="${h(name)}"></div>
        ${folded("role-assignment")}</section>`;
    };

    const editPanel = () => {
      const current = editing.isNew ? null : assignments.find((a) => nameOf(a.path) === editing.name);
      const ticked = new Map();
      const rows = workflow.roles.map((role) => {
        const held = holdersIn(current, role.name);
        const offered = offeredFor(role, held);
        ticked.set(role.name, offered.filter((p) => held.includes(p.name)).map((p) => p.name));
        const ticks = offered.map((p) => `<label><input type="checkbox" data-hold="${h(role.name)}|${h(p.name)}"${held.includes(p.name) ? " checked" : ""}>
          ${whoText(p)}</label>`).join("<br>");
        return `<tr data-role="${h(role.name)}"><td data-label="Role">${h(role.name)}</td><td data-label="How many">${h(role.howMany)}</td><td data-label="Participants">${ticks || missingText(role)}</td></tr>`;
      }).join("");
      const found = findingsOf(editing.name ?? "", ticked);
      return `<section class="panel" data-edit-assignment="${h(editing.name ?? "new")}">
        <h3>${editing.isNew ? (sprints ? "A new team" : "Fill the roles") : `Change ${h(editing.name)}`}</h3>
        ${editing.isNew ? `<p><label>${sprints ? "The team's name" : "The role assignment's name"} <input data-team-name value=""></label></p>` : ""}
        <table class="list"><thead><tr><th>Role</th><th>How many</th><th>Participants</th></tr></thead><tbody>${rows}</tbody></table>
        <p><button class="btn primary" data-save-assignment${found.some((f) => f.kind === "error") ? " disabled" : ""}>Save</button>
          <button class="btn" data-cancel-edit>Cancel</button></p>
        <div data-assignment-result>${findingsList(found)}</div>
        ${folded("assign-participants")}</section>`;
    };

    const show = () => {
      const add = workflow && (sprints || !assignments.length)
        ? `<p><button class="btn primary" data-add-team>${sprints ? "+ Team" : "Fill the roles"}</button></p>` : "";
      const head = `<section class="head"><h2>Roles</h2>
        <p class="muted">Who fills the roles of the product's process: its role assignments under <code>docs/role-assignments/</code>${sprints
          ? ", one per team" : ""}.</p>
        ${!declarationText ? `<p class="warn">This product declares no process model yet: <code>docs/process.md</code> names it (UC-002).</p>`
          : !model ? `<p class="warn">The declaration names the model file <code>${h(declaration.fields.model_file)}</code>, which the catalogue does not hold.</p>` : ""}
        ${add}${folded("fill-the-roles")}</section>`;
      if (!workflow) { target.innerHTML = head; return; }
      target.innerHTML = `${head}${rolesPanel()}${assignments.map(assignmentPanel).join("")}${editing ? editPanel() : ""}`;
      wire();
    };

    const reload = () => route.render(target, context);

    // The form's findings and Save, after each tick.
    function refresh() {
      const found = findingsOf(formName(), formHolders());
      const save = target.querySelector("[data-save-assignment]");
      if (save) save.disabled = found.some((f) => f.kind === "error");
      const out = target.querySelector("[data-assignment-result]");
      if (out) out.innerHTML = findingsList(found);
    }

    function wire() {
      target.querySelectorAll("[data-add-team]").forEach((b) => b.addEventListener("click", () => { editing = { name: null, isNew: true }; show(); }));
      for (const assignment of assignments) {
        const name = nameOf(assignment.path);
        target.querySelectorAll(`[data-edit="${name}"]`).forEach((b) => b.addEventListener("click", () => { editing = { name, isNew: false }; show(); }));
        target.querySelectorAll(`[data-remove="${name}"]`).forEach((b) => b.addEventListener("click", (ev) => remove(name, ev)));
      }
      if (!editing) return;
      for (const role of workflow.roles) {
        for (const who of participants.map((p) => p.name)) {
          target.querySelectorAll(`[data-hold="${role.name}|${who}"]`).forEach((box) => box.addEventListener("change", refresh));
        }
      }
      target.querySelectorAll("[data-cancel-edit]").forEach((b) => b.addEventListener("click", () => { editing = null; show(); }));
      target.querySelectorAll("[data-save-assignment]").forEach((b) => b.addEventListener("click", (ev) => save(ev)));
    }

    async function save(ev) {
      if (ev?.isTrusted === false) return;
      const out = target.querySelector("[data-assignment-result]");
      const name = formName();
      if (!NAME.test(name)) { out.innerHTML = `<p class="warn">Name it in lower-case letters and digits, words joined by -, such as team3.</p>`; return; }
      if (editing.isNew && assignments.some((a) => nameOf(a.path) === name)) {
        out.innerHTML = `<p class="warn">${h(name)} has a role assignment already; open it with Change.</p>`;
        return;
      }
      const holders = formHolders();
      const found = findingsOf(name, holders);
      // Save is disabled while the form has an error; a click that reaches here all the same writes nothing.
      if (found.some((f) => f.kind === "error")) { out.innerHTML = findingsList(found); return; }
      const path = pathOf(name);
      out.innerHTML = `<p class="muted">Saving…</p>`;
      try {
        const result = await saveFile(product.host, { path, text: assignmentText(name, holders),
          openedBlob: editing.isNew ? null : productSnapshot.blob(path) });
        if (result.refused) {
          out.innerHTML = `<p class="warn">${h(path)} changed since this page read it; nothing is saved. Reload the page and change it again.</p>`;
          return;
        }
        editing = null;
        await reload();
      } catch (e) {
        out.innerHTML = `<p class="warn">${h(e?.message ?? String(e))}</p>`;
      }
    }

    // A team is removed from the default branch as it stands now: its sprints are read there, and the removal is committed
    // only on that head.
    async function remove(name, ev) {
      if (ev?.isTrusted === false) return;
      const out = target.querySelector(`[data-remove-result="${name}"]`);
      try {
        const head = await product.host.readSnapshot((await product.host.repositoryInfo()).defaultBranch);
        const records = await Promise.all(head.paths.filter((p) => SPRINT_FILE.test(p)).sort()
          .map(async (p) => readDocument(planSchemas.sprint, p, await head.read(p))));
        let pullRequests = "unknown";
        try { pullRequests = await product.host.listPullRequests({ state: "all" }); } catch { /* unread: every selected item counts as held */ }
        const held = heldItems(records, [], [], pullRequests).filter((entry) => entry.team === name);
        if (held.length) {
          out.innerHTML = `<p class="warn">${h(name)} is not removed: its sprints hold ${h(listed(held.map((x) => `${x.item} (${x.sprint})`)))}.</p>
            <p class="muted small">An item stays held until a pull request with its change is merged into the default branch.${pullRequests === "unknown"
    ? " The pull requests could not be read, so every item a sprint selected and did not send back counts as held." : ""}</p>`;
          return;
        }
        await product.host.commitFiles({ branch: productInfo.defaultBranch, expectedHead: head.commit,
          files: [{ path: pathOf(name), delete: true }], message: `Remove team ${name} (Agent M dashboard)` });
        await reload();
      } catch (e) {
        out.innerHTML = `<p class="warn">${h(e?.message ?? String(e))}</p>`;
      }
    }

    show();
  },
};
