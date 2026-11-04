// MOD-settings-pages' route `resources` — a product's resources, or the instance's where the page names no product (UC-040, with 1a, 2c, 7b and 9a): the list `docs/resources.md`
// of the repository the page is drawn for, grouped by kind, each entry with its pin, licence, maintainer, route, processing place and the name of its secret; *+ Add resource*,
// *Edit the list* and *Copy from the instance* open the list in a form from MOD-resource-list's schema, whose findings stand beside their fields, and *Save* commits it as the person's own
// commit on the blob it was opened on (MOD-artifact-edits' saveFile); *Remove* opens the form without the entry and, with a newer state beside the pin, lists the jobs and tests that name the resource (MOD-resource-list's namedBy; listed, not changed); *Check* reads a repository's head through its host, shows a newer state beside the pin, and *Move* — one click — commits the new pin; a compute resource reached by a runner is
// checked by a check job, which the page prepares and shows in MOD-site-frame's run panel and queues, on the person's click, with MOD-runtimes' queueJob. Each step carries its folded
// explanation, a topic of MOD-site-frame's explanations (EVERY STEP EXPLAINS ITSELF). The route `resources/instance` is this route with no product, since a route is named by the first part of its fragment.
//
// Module: MOD-settings-pages
//
// Where the texts leave a reading open, this file states the one it takes:
//   - The list is read at the head of the default branch of the repository the page is drawn for: the product's, else the instance's. A repository without the file has an empty list under the title
//     `# Resources of <the repository>`.
//   - The pin of a repository is its head on the repository's default branch, read through the host of its address with the stored token of its server; the Hub's revision for data and a model is read with
//     MOD-reuse-facts' hubFacts, with the key kept in this browser under `resource-key:<name>` where the entry's secret is `browser`, and moved as a repository's pin is. A repository's licence and maintainer are read by no interface of this page: the person enters them.
//   - *Check* through a Bridge asks the Bridge the entry's route names, kept in this browser as `bridge:<name>` (MOD-bridge-client's probe): an endpoint for its served models, with the endpoint configuration
//     { name, kind: "openai-compatible", baseUrl: its address, model: its pin, key }, compute for its partitions, an agent with the harmless request of the probe `agent` for the agent named like the entry. It writes nothing.
//   - A check job needs a participant of the instance's register of the type CI agent that MOD-runtimes' routesFor offers the route `ci runner:<label>` for the resource's route; the first one is the
//     job's drafter. The job's context is built here from what the page has read, as MOD-runtimes' tabContext builds the tab's: the job is queued, not run in the tab.
//   - The check job works on UC-040: a job's `works_on` holds identifiers, never a resource's name; the resource is the job's parameter `resource`, which MOD-resource-list's recipe reads.
//   - The form is given the draft list as the text of its rows, read back (draftText), since writeDocument refuses a row whose licence is not entered yet and the form is where that is shown.
//   - *Move*, *Save* and *Run* act on the person's own click only (THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK); a click the page itself dispatched writes nothing.

import { saveFile } from "../artifact-edits/index.mjs";
import { bridgeAt, probe, settingsOf } from "../bridge-client/index.mjs";
import { readSetting, secretValues, writeSetting } from "../browser-store/index.mjs";
import { readDocument, readRegister, writeDocument } from "../documents/index.mjs";
import { newJobId } from "../job-ledger/index.mjs";
import { prepareJob } from "../job-runner/index.mjs";
import { participantSchema, participantsOf } from "../participant-list/index.mjs";
import { connect, parseAddress } from "../repository-hosts/index.mjs";
import { hubFacts } from "../reuse-facts/index.mjs";
import { checkPlan, namedBy, newerState, readPin, resourceFindings, resourceSchema } from "../resource-list/index.mjs";
import { queueJob, routesFor } from "../runtimes/index.mjs";
import { explain, runPanel, schemaForm } from "../site-frame/index.mjs";
import { credentialsFor } from "./products.mjs";
import { heads } from "./routes.mjs";

const PATH = "docs/resources.md";
const PARTICIPANTS = "docs/participants.md";
const COLUMNS = ["Name", "Kind", "Address", "Pin", "Licence", "Maintainer", "Route", "Processing place", "Paid", "Secret"];
const KINDS = ["repository", "data", "model", "compute", "endpoint", "agent"];
const WORKFLOWS = [".github/workflows/agent-m-jobs.yml", ".gitlab/agent-m-jobs.yml"];
const JOB_RECORD = /^docs\/jobs\/(JOB-[^/]+)\.md$/;
const HEADER = `| ${COLUMNS.join(" | ")} |\n|${COLUMNS.map(() => "---|").join("")}`;

function el(name, className, ...children) {
  const node = document.createElement(name);
  if (className) node.className = className;
  node.append(...children);
  return node;
}

// The Secret column as the page says it: the name of a secret, `ci:<NAME>` or `browser`, and nothing else — a value written there is never shown again (A RESOURCE ENTRY NAMES ITS SECRET, NOT ITS VALUE).
const SECRET_NAME = /^(?:ci:[A-Za-z_][A-Za-z0-9_]*|browser)$/;
const secretShown = (value) => (value === undefined || value === null || value === "" || SECRET_NAME.test(String(value)) ? shown(value) : "not the name of a secret (not shown)");

// A value of a cell as the page says it: a value left out is the dash.
const shown = (value) => (value === undefined || value === null || value === "" ? "—" : String(value));

// The Resource a row of the list is (MOD-resource-list's type): a value left out is null, the Paid mark a boolean.
const resourceOf = ({ cells: c }) => ({ name: c.Name, kind: c.Kind, address: c.Address, pin: c.Pin ?? null, licence: c.Licence ?? null, maintainer: c.Maintainer ?? null,
  route: c.Route ?? "", place: c["Processing place"] ?? null, paid: c.Paid === "yes" ? true : c.Paid === "no" ? false : null, secret: c.Secret ?? null,
  capabilities: c.Capabilities ?? null, role: c.Role ?? null });

const rowsOf = (document_) => document_.sections[0]?.rows ?? [];
// The text of a draft list: the lead of the opened text, the header, and one line per row. A draft may hold a row the schema refuses (a licence not entered yet), which writeDocument does not
// write: the form shows what is missing, and Save writes through writeDocument only when nothing is.
const draftText = (document_) => {
  const lead = document_.title === null || document_.title === undefined ? "" : `# ${document_.title}\n\n`;
  const lines = rowsOf(document_).map(({ cells }) => `| ${COLUMNS.map((column) => (cells[column] === undefined || cells[column] === "" ? "—" : cells[column])).join(" | ")} |`);
  return `${lead}${HEADER}\n${lines.join("\n")}${lines.length ? "\n" : ""}`;
};
const textOf = (document_, rows) => writeDocument(resourceSchema(), { ...document_, sections: [{ ...document_.sections[0], rows }] });

// The list of a repository at the head of its default branch: the snapshot, the text (null: there is no file yet), the blob it was opened on and the document.
async function openList(host, label) {
  const info = await host.repositoryInfo();
  const snapshot = await host.readSnapshot(info.defaultBranch);
  const text = await snapshot.read(PATH);
  const empty = `# Resources of ${label}\n\n${HEADER}\n`;
  return { snapshot, visibility: info.visibility, text, blob: snapshot.blob(PATH), document: readDocument(resourceSchema(), PATH, text ?? empty) };
}

// The snapshot of the page after a save: the saved commit, and the list as saved, so that what reads the list from the snapshot (the recipe resource-check, the pins, the jobs and tests that
// name a resource) reads the saved text and not the one the page opened; every other file is the snapshot's.
const savedSnapshot = (snapshot, text, outcome) => ({
  ...snapshot,
  commit: outcome.commit,
  paths: snapshot.paths.includes(PATH) ? snapshot.paths : [...snapshot.paths, PATH],
  blob: (path) => (path === PATH ? outcome.blob : snapshot.blob(path)),
  read: async (path) => (path === PATH ? text : snapshot.read(path)),
});

// The head of the repository an address names, on its default branch, with the stored token of its server: the reader readPin is handed.
async function repositoryHead(store, address) {
  const parsed = parseAddress(address);
  const host = connect(parsed, { ...(credentialsFor(store, parsed) ?? {}), secrets: secretValues(store) });
  const { defaultBranch } = await host.repositoryInfo();
  const commit = (await host.readSnapshot(defaultBranch)).commit;
  if (commit === null) throw Object.assign(new Error(`${address} holds no commit yet`), { name: "NotFound" });
  return commit;
}

// The findings of the list's entries as schemaForm places them: at the line of the entry's row.
const checksOf = (document_) => {
  const rows = rowsOf(document_);
  return resourceFindings(rows.map(resourceOf)).map((found) => ({ ...found, line: rows[found.line - 1]?.line ?? found.line }));
};

export const route = {
  ...heads.resources,
  async render(target, context) {
    const product = context.product;
    const place = product ? { host: product.host, label: product.address, address: product.address, ofInstance: false }
      : { host: context.instance.host, label: context.instance.repository, address: null, ofInstance: true };
    const heading = el("section", "head", el("h2", null, product ? "Resources" : "Instance resources"));
    let opened;
    try {
      opened = await openList(place.host, place.label);
    } catch (error) {
      target.replaceChildren(heading, el("p", "resources-unreadable", `The resources of ${place.label} could not be read: ${error?.message ?? error}.`));
      return;
    }

    const result = el("p", "resources-result");
    const formBox = el("div", "resources-form");
    const list = el("div", "resources-list");
    const note = el("p", "resources-note");

    // ------------------------------------------------------------ the form: the list, with the findings of its schema and of MOD-resource-list, saved as the person's commit
    function openForm(document_, said = "") {
      note.textContent = said;
      // The form is given the document as the text of its rows reads back, so that a row added or removed has its line.
      const again = readDocument(resourceSchema(), PATH, draftText(document_));
      formBox.replaceChildren(explain("resource-licence"), schemaForm(resourceSchema(), again, {
        extraChecks: checksOf,
        async onSave(saved) {
          result.textContent = "";
          const text = writeDocument(resourceSchema(), saved);
          try {
            const outcome = await saveFile(place.host, { path: PATH, text, openedBlob: opened.blob, openedId: null });
            if (outcome.refused) {
              result.textContent = `${PATH} changed since this page read it; nothing was written. Your edit stays in the form; open the page again to read the newer file.`;
              return;
            }
            opened = { ...opened, text, blob: outcome.blob, document: readDocument(resourceSchema(), PATH, text), snapshot: savedSnapshot(opened.snapshot, text, outcome) };
            formBox.replaceChildren();
            note.textContent = "";
            draw();
            result.textContent = `✓ ${PATH} is saved in ${place.label} (commit ${String(outcome.commit).slice(0, 7)}).`;
          } catch (error) {
            result.textContent = `✗ ${error?.message ?? error} — nothing was written.`;
          }
        },
      }));
    }

    // The jobs and tests that name a resource, listed and not changed (UC-040, 1a and 9a): the paths of the job records whose inputs pin it and of the tests that name it.
    async function namedList(resource) {
      try {
        const { jobs, tests } = await namedBy(opened.snapshot, resource.name);
        const items = [...jobs.map((path) => el("li", "resource-named-job", path)), ...tests.map((path) => el("li", "resource-named-test", path))];
        return el("div", "resource-named-by", el("p", null, items.length ? `${resource.name} is named by these jobs and tests; they are listed, not changed:` : `No job or test names ${resource.name}.`), el("ul", null, ...items));
      } catch (error) {
        return el("div", "resource-named-by", el("p", null, `The jobs and tests that name ${resource.name} could not be read: ${error?.message ?? error}.`));
      }
    }

    // ------------------------------------------------------------ a check through the Bridge the route names: one harmless probe, shown, and nothing written
    const keyOf = (resource) => {
      if (resource.secret !== "browser") return null;
      const kept = readSetting(context.store, `resource-key:${resource.name}`);
      const value = typeof kept === "string" ? kept : kept?.value;
      return typeof value === "string" && value ? value : null;
    };
    async function checkThroughBridge(resource, plan, out) {
      const said = (mark, text) => out.replaceChildren(el("p", "resource-bridge-answer", `${mark} ${text}`));
      const kept = readSetting(context.store, `bridge:${plan.bridge}`);
      if (!kept || typeof kept !== "object") return said("✗", `This browser does not keep Bridge ${plan.bridge}.`);
      out.replaceChildren(el("p", "resource-working", `Asking the Bridge ${plan.bridge}…`));
      try {
        const bridge = bridgeAt(settingsOf({ name: plan.bridge, ...kept }, readSetting(context.store, "jump-host")));
        if (plan.probe === "partitions") {
          const { partitions } = await probe(bridge, "partitions", {});
          return said("✓", `The Bridge ${plan.bridge} lists the partitions: ${partitions.map((each) => `${each.name} (${each.state})`).join(", ")}.`);
        }
        if (plan.probe === "answers") {
          const answer = await probe(bridge, "agent", { agent: resource.name });
          return said("✓", `The Bridge ${plan.bridge} got an answer from ${resource.name}${answer?.version ? ` (${answer.version})` : ""}.`);
        }
        // No key goes to the Bridge: a resource's key leaves the browser only to that resource's own server (A RESOURCE CREDENTIAL GOES ONLY TO ITS RESOURCE),
        // and a request to the Bridge is a request to another origin. An endpoint that needs its key answers with its diagnosis, which is shown.
        const answer = await probe(bridge, "endpoint-models", { name: resource.name, kind: "openai-compatible", baseUrl: resource.address, model: resource.pin ?? "", key: null });
        if (answer?.diagnosis) return said("✗", `The Bridge ${plan.bridge} could not list the models: ${answer.diagnosis.message}`);
        return said("✓", `The Bridge ${plan.bridge} serves: ${answer.models.join(", ")}.`);
      } catch (error) {
        return said("✗", `${error?.message ?? error} — nothing was read.`);
      }
    }

    // The field of a key kept in this browser (secret `browser`): stored as `resource-key:<name>` on the person's click, hidden until shown, and written nowhere else.
    function keyFieldOf(resource) {
      const input = el("input", "resource-key-input");
      input.type = "password";
      input.autocomplete = "off";
      input.spellcheck = false;
      const state = el("p", "resource-key-state");
      const stateText = () => (keyOf(resource) ? "A key is stored in this browser." : "No key is stored in this browser.");
      state.textContent = stateText();
      const save = el("button", "resource-key-save btn", "Save key");
      save.addEventListener("click", (event) => {
        if (!event.isTrusted) return;
        const value = String(input.value ?? "").trim();
        if (!value) { state.textContent = "Enter the key first."; return; }
        try {
          writeSetting(context.store, `resource-key:${resource.name}`, { value, stored: new Date().toISOString() });
          input.value = "";
          input.type = "password";
          state.textContent = stateText();
        } catch (error) {
          state.textContent = `✗ ${error?.message ?? error} — the key was not stored.`;
        }
      });
      const show = el("button", "resource-key-show btn", "Show");
      show.addEventListener("click", () => {
        const hidden = input.type === "password";
        if (hidden) { const kept = keyOf(resource); if (kept && !input.value) input.value = kept; }
        input.type = hidden ? "text" : "password";
        show.textContent = hidden ? "Hide" : "Show";
      });
      return el("div", "resource-key", el("label", null, "Key kept in this browser ", input), " ", save, " ", show, state);
    }

    // The Hub's revision and licence of an identifier, with the key kept in this browser for the entry that names it.
    const hubRevisionOf = async (id) => {
      const named = rowsOf(opened.document).map(resourceOf).find((each) => each.address === id);
      // A Hub that does not answer a browser (HubBlocked) is, for readPin, a reader that rejects with a plain Error: it names the Hub and asks for a pasted revision.
      const facts = await hubFacts(id, named ? keyOf(named) ?? undefined : undefined).catch((error) => { throw error?.name === "HubBlocked" ? new Error(error.message, { cause: error }) : error; });
      const revision = facts.find((each) => each.what === "revision")?.value;
      if (!revision) throw new Error(`the Hub gave no revision for ${id}`);
      return { revision, licence: facts.find((each) => each.what === "licence")?.value ?? null };
    };

    // ------------------------------------------------------------ a repository's pin: the head upstream, a newer state beside the pin, and Move
    async function checkPinned(resource, out) {
      let upstream;
      try {
        upstream = await readPin(resource, { repositoryHead: (address) => repositoryHead(context.store, address), hubRevision: hubRevisionOf });
      } catch (error) {
        out.replaceChildren(el("p", "resource-unreachable", `✗ ${error?.message ?? error} — the pin stays as it is.`));
        return;
      }
      const state = newerState(resource, upstream);
      if (!state.newer) {
        out.replaceChildren(el("p", "resource-current", `✓ ${resource.address} stands at its pin, ${resource.pin}.`));
        return;
      }
      const lines = [el("p", "resource-newer", `A newer state exists upstream: ${state.upstream.value}. The pin is ${resource.pin}.`), explain("resource-move")];
      const move = el("button", "resource-move btn", "Move");
      move.addEventListener("click", async (event) => {
        if (!event.isTrusted) return;
        move.disabled = true;
        const rows = rowsOf(opened.document).map((row) => (row.cells.Name === resource.name ? { ...row, cells: { ...row.cells, Pin: state.upstream.value } } : row));
        const text = textOf(opened.document, rows);
        try {
          const outcome = await saveFile(place.host, { path: PATH, text, openedBlob: opened.blob, openedId: null });
          if (outcome.refused) {
            result.textContent = `${PATH} changed since this page read it; nothing was written. Open the page again to read the newer file.`;
            move.disabled = false;
            return;
          }
          opened = { ...opened, text, blob: outcome.blob, document: readDocument(resourceSchema(), PATH, text), snapshot: savedSnapshot(opened.snapshot, text, outcome) };
          draw();
          result.textContent = `✓ The pin of ${resource.name} is now ${state.upstream.value} (commit ${String(outcome.commit).slice(0, 7)}).`;
        } catch (error) {
          result.textContent = `✗ ${error?.message ?? error} — nothing was written.`;
          move.disabled = false;
        }
      });
      out.replaceChildren(...lines, await namedList(resource), el("p", null, move));
    }

    // ------------------------------------------------------------ a compute resource reached by a runner: a check job, prepared, shown in the run panel and queued on a click
    async function checkOnRunner(resource, label, out) {
      out.replaceChildren(el("p", "resource-working", `Preparing the check job for the runner ${label}…`));
      try {
        const instanceInfo = await context.instance.host.repositoryInfo();
        const instanceSnapshot = place.ofInstance ? opened.snapshot : await context.instance.host.readSnapshot(instanceInfo.defaultBranch);
        const register = await instanceSnapshot.read(PARTICIPANTS);
        const participants = register === null ? [] : participantsOf(readRegister(participantSchema(), PARTICIPANTS, register).document);
        const jobWorkflow = WORKFLOWS.some((path) => opened.snapshot.paths.includes(path));
        const need = [{ resource: resource.name, route: `runner:${label}` }];
        let drafter = null, refusal = null;
        for (const candidate of participants.filter((each) => each.type === "CI agent")) {
          const offers = routesFor(candidate, participants, { visibility: opened.visibility, jobWorkflow }, need);
          const taken = offers.find((offer) => offer.route.kind === "ci" && offer.route.runner === label);
          if (taken?.available) { drafter = { participant: candidate, route: taken.route }; break; }
          refusal ??= taken?.reason ?? null;
        }
        if (drafter === null) {
          out.replaceChildren(el("p", "resource-no-runner", `No CI agent of the instance reaches the runner ${label}${refusal ? `: ${refusal}` : ""}. Nothing can check ${resource.name} until one does.`));
          return;
        }
        const credentials = place.address ? credentialsFor(context.store, parseAddress(place.address)) : context.store && credentialsFor(context.store, parseAddress(`https://github.com/${context.instance.repository}`));
        const person = credentials?.tokenName ?? (credentials?.token ? "a reviewer" : null);
        const taken = new Set(opened.snapshot.paths.map((path) => JOB_RECORD.exec(path)?.[1]).filter(Boolean));
        const now = new Date();
        const id = newJobId(now, taken);
        const commit = instanceSnapshot.commit ?? "unknown";
        const agentM = { version: commit, commit };
        const params = { resource: resource.name, instruction: `Check the resource ${resource.name}.` };
        const jobContext = { kind: null, params, product: { address: place.address ?? instanceSnapshot.repository.web, snapshot: opened.snapshot, host: place.host },
          instance: { snapshot: instanceSnapshot, host: context.instance.host, checkout: null }, connect: async () => null, participants,
          places: { sources: {}, mailbox: null, contents: [] }, gates: [], person, now, agentM, jobId: id };
        const prepared = await prepareJob("check-resource", jobContext, { drafter: drafter.participant, reviewers: [] });
        const start = { id, kind: "check-resource", worksOn: ["UC-040"], participant: drafter.participant.name, model: drafter.participant.model ?? null, route: `ci runner:${label}`,
          run: null, retries: null, startedBy: person, start: now, agentM, inputs: prepared.parts.map((part) => part.name), limit: prepared.limit, task: "in parameters",
          conversation: null, destinations: prepared.destinations.map((each) => ({ participant: each.participant.name, place: each.place ?? "", parts: each.parts })), params };
        const panel = runPanel(prepared, {
          async onRun() {
            if (person === null) {
              out.append(el("p", "resource-no-token", "No token that writes to this repository is stored in this browser, so the job cannot be queued."));
              return;
            }
            try {
              const queued = await queueJob(place.host, start, drafter.route, opened.snapshot.commit);
              out.append(el("p", "resource-queued", `Queued as ${id} on the runner ${label} (commit ${String(queued.commit).slice(0, 7)}); its result is on the job dashboard.`));
            } catch (error) {
              out.append(el("p", "resource-queue-failed", `✗ ${error?.name ?? "Error"}: ${error?.message ?? error} — nothing was queued.`));
            }
          },
        });
        out.replaceChildren(el("p", "resource-runner", `The check runs as the job ${id} on the runner ${label}, with the participant ${drafter.participant.name}.`), explain("resource-check"), panel);
      } catch (error) {
        out.replaceChildren(el("p", "resource-check-failed", `✗ ${error?.name ?? "Error"}: ${error?.message ?? error}`));
      }
    }

    // ------------------------------------------------------------ Check, by the resource's plan
    async function check(resource, out) {
      let plan;
      try {
        plan = checkPlan(resource);
      } catch (error) {
        out.replaceChildren(el("p", "resource-no-route", `✗ ${error?.message ?? error}`));
        return;
      }
      if (plan.how === "check job on a runner") await checkOnRunner(resource, plan.label, out);
      else if (plan.how === "probe through the Bridge") {
        await checkThroughBridge(resource, plan, out);
      } else if (resource.kind === "repository" || resource.kind === "data" || resource.kind === "model") await checkPinned(resource, out);
      else out.replaceChildren(el("p", "resource-own-address", `${resource.name} is called at its own address; there is nothing to read here.`));
    }

    // ------------------------------------------------------------ the entries, by kind
    // An endpoint or an agent that also works on the product is a participant too, and a separate entry (UC-040 2a): *Add as participant* opens the participants route with the
    // participant type that kind stands for and the resource's address, and writes nothing.
    const PARTICIPANT_TYPE = { endpoint: "model endpoint", agent: "CLI agent" };
    function participantButton(resource) {
      if (!PARTICIPANT_TYPE[resource.kind]) return [];
      const button = el("button", "resource-add-participant btn", "Add as participant");
      button.addEventListener("click", () => context.go("participants", { type: PARTICIPANT_TYPE[resource.kind], address: resource.address }));
      return [" ", button];
    }
    function entryOf(resource, row) {
      const out = el("div", "resource-out");
      const checkButton = el("button", "resource-check btn", "Check");
      checkButton.addEventListener("click", () => check(resource, out));
      const removeButton = el("button", "resource-remove btn", "Remove");
      removeButton.addEventListener("click", async () => {
        out.replaceChildren(await namedList(resource));
        const rows = rowsOf(opened.document).filter((each) => each !== row);
        openForm({ ...opened.document, sections: [{ ...opened.document.sections[0], rows }] }, `Removing ${resource.name}: Save commits the removal.`);
      });
      const section = el("section", "resource panel",
        el("h4", null, resource.name),
        el("p", "resource-address", resource.address),
        el("p", "resource-pin", `Pin: ${shown(resource.pin)}`),
        el("p", "resource-licence", `Licence: ${shown(resource.licence)}`),
        el("p", "resource-maintainer", `Maintainer: ${shown(resource.maintainer)}`),
        el("p", "resource-route", `Route: ${shown(resource.route)}`),
        el("p", "resource-place", `Processing place: ${shown(resource.place)}`),
        el("p", "resource-secret", `Secret: ${secretShown(resource.secret)}`),
        el("ul", "resource-findings", ...resourceFindings([resource]).map((found) => el("li", found.kind, `${found.kind}: ${found.what} — ${found.fix} [${found.rule}]`))),
        ...(resource.secret === "browser" ? [keyFieldOf(resource)] : []),
        el("p", null, checkButton, " ", removeButton, ...participantButton(resource)), out);
      section.setAttribute("data-resource", resource.name);
      return section;
    }

    function draw() {
      const rows = rowsOf(opened.document);
      const resources = rows.map((row) => ({ row, resource: resourceOf(row) }));
      const byKind = KINDS.flatMap((kind) => {
        const own = resources.filter((each) => each.resource.kind === kind);
        return own.length ? [el("section", "resources-kind", el("h3", null, `${kind[0].toUpperCase()}${kind.slice(1)}`), ...own.map(({ resource, row }) => entryOf(resource, row)))] : [];
      });
      list.replaceChildren(...(resources.length ? byKind : [el("p", "resources-empty", `${place.label} declares no resource yet.`)]));
    }
    draw();

    // ------------------------------------------------------------ + Add resource, Edit the list, Copy from the instance
    const kindSelect = el("select", "resources-kind-select", ...KINDS.map((kind) => { const option = el("option", null, kind); option.value = kind; return option; }));
    const nameInput = el("input", "resources-name");
    const addressInput = el("input", "resources-address");
    for (const input of [nameInput, addressInput]) { input.autocomplete = "off"; input.spellcheck = false; }
    const add = el("button", "resources-add btn primary", "+ Add resource");
    add.addEventListener("click", async () => {
      const kind = kindSelect.value, name = nameInput.value.trim(), address = addressInput.value.trim();
      if (!name || !address) { note.textContent = "Name the resource and give its address first."; return; }
      const cells = { Name: name, Kind: kind, Address: address, Route: kind === "compute" ? "" : "read on its host" };
      let said = "";
      if (kind === "repository") {
        try {
          cells.Pin = await repositoryHead(context.store, address);
          said = `Pinned to the head of ${address}: ${cells.Pin}. Enter its licence and maintainer.`;
        } catch (error) {
          said = `The head of ${address} could not be read (${error?.message ?? error}); enter the pin by hand.`;
        }
      }
      openForm({ ...opened.document, sections: [{ ...opened.document.sections[0], rows: [...rowsOf(opened.document), { line: null, cells }] }] }, said);
    });
    const edit = el("button", "resources-edit btn", "Edit the list");
    edit.addEventListener("click", () => openForm(opened.document, ""));

    const copyBox = el("div", "resources-copy");
    if (product) {
      try {
        const own = new Set(rowsOf(opened.document).map((row) => row.cells.Name));
        const instanceList = await openList(context.instance.host, context.instance.repository);
        const offered = rowsOf(instanceList.document).filter((row) => !own.has(row.cells.Name));
        if (offered.length) {
          const choice = el("select", "resources-copy-choice", ...offered.map((row) => { const option = el("option", null, `${row.cells.Name} · ${row.cells.Kind}`); option.value = row.cells.Name; return option; }));
          const copy = el("button", "resources-copy-button btn", "Copy from the instance");
          copy.addEventListener("click", () => {
            const row = offered.find((each) => each.cells.Name === choice.value);
            openForm({ ...opened.document, sections: [{ ...opened.document.sections[0], rows: [...rowsOf(opened.document), { line: null, cells: { ...row.cells } }] }] },
              `${row.cells.Name} is copied from the instance's list; the copy is not linked, so a later change on either side leaves the other unchanged.`);
          });
          copyBox.append(el("p", null, el("label", null, "An instance resource ", choice), " ", copy), explain("resource-copy"));
        }
      } catch { /* the instance's list could not be read: nothing is offered to copy */ }
    }

    target.replaceChildren(heading,
      el("p", "muted", `Repository: ${place.label}`),
      el("p", "resources-where", `Save writes ${PATH} in ${place.label} as your own commit, and writes nothing else.`),
      explain("resources"), list,
      el("div", "resources-adding panel", explain("resource-kind"), el("p", null, el("label", null, "Kind ", kindSelect), " ", el("label", null, "Name ", nameInput), " ",
        el("label", null, "Address ", addressInput), " ", add, " ", edit)),
      copyBox, note, formBox, result);
    nameInput.focus();
  },
};
