// MOD-model-catalogue — process models and practices as data, and their validation (docs/architecture/MOD-model-catalogue.md):
// its interface. Of it, ITM-215 builds what UC-002 needs: Model, Catalogue, catalogue, modelSchema and modelFindings, and the
// shipped catalogue as data — the book's models in models/ and its practices in practices/, each file naming the chapter
// it follows. ITM-229 adds a model's `## About` and Model.about: what UC-002 shows beside each model. ITM-258 adds reading
// a kind's explanation in parentheses in a phase's Produces, and a stated Time box of none as no time box. planGrid gives
// each accepted requirement every phase of a planned model (plan.mjs). modelDiagram draws the supplied model (diagram.mjs).
//
// Module: MOD-model-catalogue
//
// It belongs to Process (ARC-042). It runs unchanged in a browser and in Node. When it is loaded, it reads its own data files
// once: its two schemas, model.schema.md and practice.schema.md, in MOD-documents' language; its list of shipped files,
// shipped.md; and each file the list names — from the disk in Node, from the module's own address in a browser. A browser
// cannot list a folder: the list says which models and practices the module ships, and its code names none of them (THE
// CATALOGUE IS DATA). A file that cannot be read, or a schema that breaks the language, stops the module's load, as
// MOD-documents' file says of a broken schema. The instance's own models it reads through the snapshot its caller gives.
// Nothing is written. It uses MOD-documents and MOD-text-tools only through their index.mjs. Every other file of this folder
// is private to it.

// Schema and Document, in the types below, are MOD-documents' types of those names; Finding is MOD-text-tools', and
// Snapshot MOD-repository-hosts'.
import { documentFindings, loadSchema, readDocument } from "../documents/index.mjs";
import { validate } from "./validate.mjs";

export { planGrid } from "./plan.mjs";
export { modelDiagram } from "./diagram.mjs";

/**
 * A process model read by its schema: its name; its kind of work, planned or pulled; the model it was adapted from, or null;
 * the measure of its progress; what its `## About` says — the risk it manages well, the risk it accepts, an example project
 * it suits and the chapter of the book that explains it —, or null for a model without one; its phases, each with the roles
 * that work in it and the kinds of artifact it produces — a kind's explanation in parentheses in its file dropped —; the
 * transitions between them; its verification pairs; its gates, each with the two phases it stands between, the artifacts
 * it checks, the condition that must hold and its decider — a role of the model, or `check: <CI check name>`; its roles,
 * each with who may fill it — person, agent or either —, whether one participant fills it or several may, and the
 * capabilities it needs; its flow control — the
 * work-in-progress limit, the time box, null also for a file's stated `none`, whether the work runs in sprints —, or null
 * where it has none; its version, the blob that the instance's snapshot names for the path of its file, or null where the
 * snapshot does not hold that path; and that path in the instance repository. A value its file leaves out, or writes in a
 * form the schema does not read, is "" — [] for a list, null for a value of the flow control.
 * @typedef {{ name: string, kind: string, adaptedFrom: string | null, measure: string,
 *   about: { manages: string, accepts: string, example: string, chapter: string } | null,
 *   phases: Array<{ name: string, roles: string[], produces: string[] }>,
 *   transitions: Array<{ from: string, to: string, kind: string }>,
 *   pairs: Array<{ phase: string, checkedBy: string }>,
 *   gates: Array<{ from: string, to: string, artifacts: string, condition: string, decider: string }>,
 *   roles: Array<{ name: string, filledBy: string, howMany: string, capabilities: string[] }>,
 *   flow: { wip: number | null, timeBox: string | null, sprints: boolean } | null,
 *   version: string | null, path: string }} Model
 */

/**
 * What catalogue returns: the models — the shipped ones in the order of the module's list, then the instance's own in the
 * order of their paths —; the shipped practices, in the order of the list, each with the names of the models it fits and its
 * path; and the findings of each model, by its path.
 * @typedef {{ models: Model[], practices: Array<{ name: string, fits: string[], path: string }>,
 *   findings: Record<string, Finding[]> }} Catalogue
 */

const OWNER = "MOD-model-catalogue";
// The module's folder in the repository of Agent M and of every instance, a fork of it: where its shipped files stand.
const FOLDER = "src/model-catalogue/";
// An instance's own model: docs/process-models/<name>.md of the instance repository.
const INSTANCE_MODEL = /^docs\/process-models\/[^/]+\.md$/;

const disk = globalThis.process?.getBuiltinModule?.("node:fs");

// One of the module's own files: from the disk in Node, from the module's own address in a browser.
const own = (url) => (disk ? disk.readFileSync(url, "utf8") : ownFile(url));

// In a browser: the module's own file, from the address the module itself was loaded from. Throws an Error naming the file
// and the server's status when it is not served.
async function ownFile(url) {
  const answer = await fetch(url);
  if (!answer.ok) throw new Error(`${OWNER}: its ${url.pathname} was not served (${answer.status})`);
  return answer.text();
}

// The files the list of shipped files names, in its order: each on a line of its own, as `- ` and its path in the folder in
// backticks.
const listed = (text) => text.split("\n").map((line) => /^- `([^`]+)`\s*$/.exec(line)?.[1]).filter(Boolean);

const MODEL = loadSchema(await own(new URL("./model.schema.md", import.meta.url)), OWNER);
const PRACTICE = loadSchema(await own(new URL("./practice.schema.md", import.meta.url)), OWNER);
const SHIPPED = listed(await own(new URL("./shipped.md", import.meta.url)));

// The shipped files in the folder `prefix` — models/ or practices/ —, in the order of the list, each read with `schema` at
// its path in the repository.
async function shipped(prefix, schema) {
  return Promise.all(SHIPPED.filter((file) => file.startsWith(prefix))
    .map(async (file) => readDocument(schema, FOLDER + file, await own(new URL(`./${file}`, import.meta.url)))));
}

const SHIPPED_MODELS = await shipped("models/", MODEL);
const SHIPPED_PRACTICES = await shipped("practices/", PRACTICE);

// The kinds of artifact a phase may produce, each optionally followed in its file by an explanation in parentheses that
// no check reads (MOD-model-catalogue.md, Data: Schema model, ## Phases). The column Produces cannot name them itself —
// its value would then have to allow that explanation too, so it is read as text, and validate.mjs checks a phase's
// produced kinds, their explanations already dropped, against this list.
const KINDS = ["requirements", "UC", "ARC", "MOD", "TST", "ITM", "sprint record"];

const text = (value) => (typeof value === "string" ? value : "");
const list = (value) => (Array.isArray(value) ? [...value] : []);
// A kind in Produces with its explanation in parentheses dropped, the kind what stood before it, trimmed; unchanged
// where it names none (MOD-model-catalogue.md, Data: Schema model, ## Phases).
const EXPLAINED = /[ \t]*\([^()]*\)\s*$/;
const kindOf = (produced) => produced.replace(EXPLAINED, "").trim();
// A Time box of none is no time box (MOD-model-catalogue.md, Data: Schema model, ## Flow control).
const timeBoxOf = (value) => (value === "none" ? null : value);

// The line of a front matter key, counted as MOD-documents counts it for its findings: the line --- first, then each key on
// a line of its own and each item of a list on one more; line 1 for a key the document lacks.
function keyLine(fields, wanted) {
  let line = 2;
  for (const [key, value] of Object.entries(fields)) {
    if (key === wanted) return line;
    line += 1 + (Array.isArray(value) ? value.length : 0);
  }
  return 1;
}

// The two phases a gate stands between, written `<phase> → <phase>`; without the arrow, the whole text as the first.
function between(written) {
  const at = written.indexOf("→");
  return at < 0 ? { from: written, to: "" } : { from: written.slice(0, at).trim(), to: written.slice(at + 1).trim() };
}

// The parts of a definition read with the model's schema, each with the line it stands on: what a Model holds, and what
// validate.mjs compares. A phase's Produces holds each kind with its explanation in parentheses dropped. The flow
// control keeps each other value as it was read — a WIP limit that is no number included —, except a Time box of none,
// read as null, the same as one left out.
function partsOf(document) {
  const section = (heading) => document.sections.find((s) => s.heading === heading);
  const rows = (heading) => section(heading)?.rows ?? [];
  const flow = section("## Flow control");
  const flowValue = (kind) => flow?.rows?.find((row) => row.cells.Kind === kind)?.cells.Value ?? null;
  return {
    artifact: document.id ?? document.path,
    name: text(document.fields.name),
    kind: text(document.fields.kind),
    adaptedFrom: text(document.fields.adapted_from) || null,
    measure: text(document.fields.measure),
    measureLine: keyLine(document.fields, "measure"),
    phases: rows("## Phases").map(({ line, cells }) =>
      ({ line, name: text(cells.Name), roles: list(cells.Role), produces: list(cells.Produces).map(kindOf) })),
    transitions: rows("## Transitions").map(({ line, cells }) =>
      ({ line, from: text(cells.From), to: text(cells.To), kind: text(cells.Kind) })),
    pairs: rows("## Verification pairs").map(({ line, cells }) =>
      ({ line, phase: text(cells.Phase), checkedBy: text(cells["Checked by"]) })),
    gates: rows("## Gates").map(({ line, cells }) => ({ line, ...between(text(cells.Between)), artifacts: text(cells.Artifacts),
      condition: text(cells.Condition), decider: text(cells.Decider) })),
    roles: rows("## Roles").map(({ line, cells }) =>
      ({ line, name: text(cells.Name), filledBy: text(cells["Filled by"]), howMany: text(cells["How many"]),
        capabilities: list(cells.Capabilities) })),
    flow: flow ? { line: flow.line, wip: flowValue("WIP limit"), timeBox: timeBoxOf(flowValue("Time box")),
      sprints: flowValue("Sprints") === "yes" } : null,
  };
}

// What a definition's `## About` says, its lines as the model's schema reads them, a line left out "" — or null without the
// section.
function aboutOf(document) {
  const about = document.sections.find((section) => section.heading === "## About");
  return about ? { manages: text(about.fields?.manages), accepts: text(about.fields?.accepts),
    example: text(about.fields?.example), chapter: text(about.fields?.chapter) } : null;
}

// A definition as a Model, with its version.
function modelOf(document, version) {
  const { artifact, flow, measureLine, ...parts } = partsOf(document);
  const unlined = (entries) => entries.map(({ line, ...entry }) => entry);
  return {
    ...parts,
    about: aboutOf(document),
    phases: unlined(parts.phases),
    transitions: unlined(parts.transitions),
    pairs: unlined(parts.pairs),
    gates: unlined(parts.gates),
    roles: unlined(parts.roles),
    flow: flow && { wip: typeof flow.wip === "number" ? flow.wip : null,
      timeBox: typeof flow.timeBox === "string" ? flow.timeBox : null, sprints: flow.sprints },
    version,
    path: document.path,
  };
}

/**
 * modelSchema: { model: Schema, practice: Schema } — the two schemas the module owns, loaded: a process model's, for a shipped
 * model and for `docs/process-models/<name>.md` of the instance, and a practice's. For reading, writing and checking
 * through MOD-documents, and for the form a person edits a model in.
 */
export const modelSchema = Object.freeze({ model: MODEL, practice: PRACTICE });

/**
 * modelFindings(model: Document) -> Finding[] — every rule a definition must keep, in the order of their lines, each an
 * error on the line of the part that causes it and naming the requirement it applies: what the model's schema decides,
 * through MOD-documents' documentFindings — no declaration of planned or pulled; a measure that does not fit the kind of
 * work; a gate without artifacts, without a condition or without a decider; a role without capabilities, or without how
 * many fill it; a phase without a role; every other value left out where required, or not of its type —, and what it
 * cannot, in validate.mjs — a transition naming a phase that is not defined, or a phase no transition reaches from the first
 * phase; a verification pair naming a missing phase; a phase naming a role, or a gate a decider, that the model does not
 * define; a gate that checks a kind of
 * artifact no earlier phase produces; for pulled work, neither a time box nor a work-in-progress limit, or both; for pulled
 * work that names no time box, the measure remaining items per time box, which does not fit it. A finding
 * names the file of the model, which has no identifier. A definition with an error finding can be declared by no product.
 * @param {Document} model — a definition, as readDocument returns it with modelSchema.model
 * @returns {Finding[]}
 */
export function modelFindings(model) {
  return [...documentFindings(MODEL, model), ...validate(partsOf(model), KINDS)].sort((a, b) => a.line - b.line);
}

/**
 * catalogue(instance: Snapshot) -> Promise<Catalogue> — the shipped models and practices, and the instance's own models —
 * the files `docs/process-models/<name>.md` its snapshot holds —, each model with its findings. A shipped model is offered
 * for adapting, never for editing in place. Over the instance's snapshot at the commit a product's declaration names, it
 * holds the instance's models as they stood at that commit: the version the product declared (UC-031 6a). The instance's
 * models are read through the snapshot — all of them named to its readMany first, one batch request of up to a hundred files
 * where the host has one —, so the call crosses the network, and it fails as the snapshot's read fails: NotFound,
 * TokenRefused, PermissionMissing, RateLimited or Unreachable.
 * @param {Snapshot} instance — the instance repository at one commit, as MOD-repository-hosts' readSnapshot gives it
 * @returns {Promise<Catalogue>}
 */
export async function catalogue(instance) {
  const paths = instance.paths.filter((path) => INSTANCE_MODEL.test(path)).sort();
  // The texts are named to the snapshot first (Snapshot.readMany), which fetches them in batches of a hundred where the host can
  // and reads nothing ahead elsewhere; the reads below then find them held. A snapshot without readMany is read file by file.
  await instance.readMany?.(paths);
  const documents = [...SHIPPED_MODELS,
    ...await Promise.all(paths.map(async (path) => readDocument(MODEL, path, await instance.read(path))))];
  return {
    models: documents.map((document) => modelOf(document, instance.blob(document.path))),
    practices: SHIPPED_PRACTICES.map((practice) =>
      ({ name: text(practice.fields.name), fits: list(practice.fields.fits), path: practice.path })),
    findings: Object.fromEntries(documents.map((document) => [document.path, modelFindings(document)])),
  };
}
