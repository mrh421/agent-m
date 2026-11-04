// strategies.mjs — the recipes and the precondition of approvalStrategies (MOD-approvals, Parts: strategies.mjs; Interfaces:
// approvalStrategies). Of it, ITM-332 builds the recipes `use-cases` and `use-case-with-neighbours` and the precondition
// `rests-on-accepted` for requirements and use cases. ITM-437 builds the recipe `accepted-use-cases` and the precondition
// `architecture-ready`, ITM-465 its reading of a decision row; ITM-724 the recipe `whole-architecture` and the architecture's part of
// `rests-on-accepted`.
//
// Module: MOD-approvals
//
// Strategies, JobContext and Part are MOD-job-runner's types, Finding MOD-text-tools'. A strategy reads the product of the
// job's context through its snapshot: the use cases and the SPEC, and the status of every use case from the records beside
// them (statuses). The job's parameters are read by name: `useCase`, the identifier of the use case a change is asked of;
// `requirements`, the names, and `useCases`, the identifiers, of the selection a job rests on, and `steps` and `items`, the steps of the plan and items of the backlog
// whose `realises` it rests on too; `architecture`, true when the job rests on the architecture too.

import { artifactSchemas, readDocument } from "../documents/index.mjs";
import { parseSpec } from "../spec-document/index.mjs";
import { finding } from "../text-tools/index.mjs";
import { statuses } from "./status.mjs";

const SPEC_PATH = "SPEC.md";
const ACCEPTED_FIRST = "NOTHING IS IMPLEMENTED BEFORE IT IS ACCEPTED";
const ONLY_ACCEPTED = "ARCHITECTURE IS DESIGNED ONLY AGAINST ACCEPTED USE CASES";
const AS_A_WHOLE = "THE FIRST ARCHITECTURE IS DESIGNED AS A WHOLE";

// The kinds of reviewed file that make up a product's architecture: a decision and a module file. A use case and a release test
// report are reviewed files too, and no part of it.
const ARCHITECTURE_KINDS = { "architecture-decision": true, module: true };

// A failure of the module's own, by name, with the fields its message names.
const failure = (name, message, fields) => Object.assign(new Error(message), { name, ...fields });

// Every use case of the product, in the order its files stand in the snapshot: its identifier, path, status and text, and the
// document that the use-case schema reads from the text.
async function useCasesOf(snapshot) {
  const found = [];
  for (const [path, { id, kind, status }] of statuses(snapshot)) {
    if (kind !== "use-case") continue;
    const text = await snapshot.read(path);
    found.push({ id, path, status, text, document: readDocument(artifactSchemas().useCase, path, text) });
  }
  return found;
}

// Every architecture decision and module file of the product, in the order its files stand: its identifier, path, status and text,
// and the document that the schema of its format reads from the text.
async function architectureOf(snapshot) {
  const schemas = { "architecture-decision": artifactSchemas().decision, module: artifactSchemas().module };
  const found = [];
  for (const [path, { id, kind, status }] of statuses(snapshot)) {
    if (!(kind in schemas)) continue;
    const text = await snapshot.read(path);
    found.push({ id, path, status, text, document: readDocument(schemas[kind], path, text), schema: schemas[kind] });
  }
  return found;
}

// The part of a use case: its file's path and its status in its name, the whole file as its text. The job runner sets its size
// and the recipe it fills.
const partOf = ({ path, status, text }) => ({ name: `${path} — ${status}`, text, size: 0, sources: [], required: true });

// The part of a requirement, named by it: the requirement as the SPEC states it — its name and source, its rule, its check.
const requirementPart = ({ name, source, rule, check }) => ({ name, size: 0, sources: [], required: true,
  text: [`**${name}**${source === null ? "" : ` *(${source})*`}`, rule, check === null ? null : `*Check:* ${check}`]
    .filter((line) => line !== null).join("\n") });

// The SPEC changes that are open, by their proposals' paths, in the order the files stand: the entries of the change queues
// (docs/spec-freigaben/<queue>/NN-<slug>.md, where the queue has its index.md) that neither an approval record nor a decision row
// decides (MOD-spec-changes, Data: "open — no approval record names its proposal and no decision row names the commit that wrote it into
// the SPEC"; STATUS IS DERIVED FROM THE RECORDS). A record is docs/approvals/spec-<queue folder>-<NN>-<blob12>.md: it names the entry <NN>
// of that queue, whatever blob it names — a record of an earlier text of the proposal makes the entry stale, which is MOD-spec-changes'
// state of its own, not open. A decision row is a line of the queue's own entscheidungen.md, a register without a header,
// `| <time> | <entry> | uebernommen | <commit> |`: it decides the entry of its queue whose number is its second cell when its fourth cell
// names a commit — a commit's identifier, short or whole — or an approval record (`approval:<file>`), as the dashboard writes it. The
// snapshot holds no history, so that the commit is not looked up.
const SPEC_RECORD = /^docs\/approvals\/spec-(.+)-(\d{2})-[0-9a-f]{12}\.md$/;
const DECISION_ROW = /^\|[^|]*\|\s*(\d+)\s*\|\s*uebernommen\s*\|\s*(?:[0-9a-f]{7,40}|approval:\S+)\s*\|\s*$/;
async function openSpecChanges(snapshot) {
  const records = snapshot.paths.map((path) => SPEC_RECORD.exec(path)).filter(Boolean);
  const named = new Set(records.map((record) => `${record[1]}#${record[2]}`));
  const open = [];
  for (const index of snapshot.paths.filter((path) => /^docs\/spec-freigaben\/[^/]+\/index\.md$/.test(path))) {
    const queue = index.slice(0, index.lastIndexOf("/")), folder = queue.slice(queue.lastIndexOf("/") + 1);
    const decided = new Set(((await snapshot.read(`${queue}/entscheidungen.md`)) ?? "").split(/\r?\n/)
      .map((line) => DECISION_ROW.exec(line)).filter(Boolean).map((row) => row[1].padStart(2, "0")));
    for (const path of snapshot.paths) {
      const entry = path.startsWith(`${queue}/`) ? /^(\d{2,})-[^/]*\.md$/.exec(path.slice(queue.length + 1)) : null;
      if (!entry || path.endsWith(".begruendung.md")) continue;
      const number = entry[1].padStart(2, "0");
      if (!named.has(`${folder}#${number}`) && !decided.has(number)) open.push(path);
    }
  }
  return open;
}

// The values of a parameter that is a list of texts; none for any other.
const listOf = (value) => (Array.isArray(value) ? value.filter((each) => typeof each === "string") : []);

// How a use case that is not accepted stands, by its status.
const NOT_ACCEPTED = { open: "is open", changed: "has changed since it was accepted" };

// What the steps of the plan and the items of the backlog of a job's parameters `steps` and `items` name under `realises`, read with the item schema: the
// requirements, by their names, and the use cases, by their identifiers. A name that is no step or item of the product's files names none.
async function realisedBy(snapshot, names) {
  const realised = { requirements: [], useCases: [] };
  for (const name of names) {
    const file = /^ITM-\d+$/.test(name) ? new RegExp(`^docs/(?:plan|backlog)/${name}-[^/]+\\.md$`) : null;
    const path = file && snapshot.paths.find((each) => file.test(each));
    if (!path) continue;
    for (const value of listOf([readDocument(artifactSchemas().item, path, (await snapshot.read(path)) ?? "").fields.realises ?? []].flat())) {
      (/^UC-\d+$/.test(value) ? realised.useCases : realised.requirements).push(value);
    }
  }
  return realised;
}

/**
 * approvalStrategies: Strategies — the strategies this module offers the job runner (ARC-046):
 * - recipe `use-cases`: every use case of the product as one part per file, whose name holds the file's path and the use case's
 *   status — open, accepted or changed — and whose text is the file; the part carries the use case as an artifact, its
 *   identifier and the key of the use-case format (artifactSchemas), against which `candidate-classes` classifies a draft;
 * - recipe `use-case-with-neighbours`: the use case the parameter `useCase` names, as a part like those of `use-cases`; then one
 *   part for each requirement it realises that the SPEC holds, named by the requirement, holding its text from the SPEC, in the
 *   order the use case names them; then every other use case as a part like the first. Throws UseCaseNotFound { useCase } when
 *   the product has no use case of that identifier;
 * - recipe `accepted-use-cases`: the use cases a record names the current text of, as parts like those of `use-cases` but
 *   without an artifact, one per file, in the order the files stand;
 * - precondition `architecture-ready`: one finding, the first that holds of: an error under THE FIRST ARCHITECTURE IS DESIGNED
 *   AS A WHOLE when the product has an architecture decision or module file already, pointing to UC-023; an error under
 *   ARCHITECTURE IS DESIGNED ONLY AGAINST ACCEPTED USE CASES naming each use case that is open or changed; a warning under THE
 *   FIRST ARCHITECTURE IS DESIGNED AS A WHOLE naming, by its proposal's path, each SPEC change that is open — an entry of a
 *   change queue that neither an approval record nor a decision row naming the commit that wrote it into the SPEC decides (a
 *   record of an earlier text of its proposal makes it stale, not open); none when the product is ready;
 * - recipe `whole-architecture`: every architecture decision and module file as one part, in the order the files stand, like the
 *   parts of `use-cases`; the part carries the file as an artifact, its identifier and the key of its format (artifactSchemas);
 * - precondition `rests-on-accepted`: one error finding, under NOTHING IS IMPLEMENTED BEFORE IT IS ACCEPTED, that names every
 *   requirement of the parameter `requirements` that the SPEC does not hold and every use case of the parameter `useCases` that
 *   no record names the current text of, or that is no use case of the product — and so for every requirement and use case that a
 *   step or item of the parameters `steps` and `items` names under `realises`, read with the item schema —, and, when the parameter `architecture` is true,
 *   by its path every decision and module file that is open or changed; none when all are accepted, or when the job
 *   names no selection.
 */
export const approvalStrategies = {
  recipes: {
    "use-cases": async (context) => (await useCasesOf(context.product.snapshot)).map((each) => ({ ...partOf(each),
      artifacts: [{ id: each.id,
        keys: artifactSchemas().useCase.key.map((field) => String(each.document.fields[field] ?? "")) }] })),
    "whole-architecture": async (context) => (await architectureOf(context.product.snapshot)).map((each) => ({ ...partOf(each),
      artifacts: [{ id: each.id, keys: each.schema.key.map((field) => String(each.document.fields[field] ?? "")) }] })),
    "accepted-use-cases": async (context) => (await useCasesOf(context.product.snapshot))
      .filter((each) => each.status === "accepted").map(partOf),
    "use-case-with-neighbours": async (context, params) => {
      const { snapshot } = context.product;
      const all = await useCasesOf(snapshot);
      const target = all.find((each) => each.id === params.useCase);
      if (!target) {
        throw failure("UseCaseNotFound", `the product has no use case ${params.useCase}`, { useCase: params.useCase });
      }
      const spec = parseSpec((await snapshot.read(SPEC_PATH)) ?? "");
      const realised = [...new Set([target.document.fields.realises ?? []].flat())]
        .map((name) => spec.requirements.get(name)).filter((requirement) => requirement !== undefined);
      return [partOf(target), ...realised.map(requirementPart), ...all.filter((each) => each !== target).map(partOf)];
    },
  },
  preconditions: {
    "architecture-ready": async (context) => {
      const { snapshot, address } = context.product;
      const reviewed = [...statuses(snapshot).values()];
      const notAccepted = reviewed.filter((each) => each.kind === "use-case" && each.status !== "accepted");
      const changes = await openSpecChanges(snapshot);
      const found = (kind, rule, what, fix) => finding({ artifact: address, line: 1, kind, rule, what, fix });
      if (reviewed.some((each) => each.kind in ARCHITECTURE_KINDS)) {
        return found("error", AS_A_WHOLE, "the product has an architecture already: a first architecture is not drafted beside it",
          "change the architecture instead (UC-023)");
      }
      if (notAccepted.length > 0) {
        return found("error", ONLY_ACCEPTED, `use cases that are not accepted: ${notAccepted.map((each) =>
          `${each.id} (${NOT_ACCEPTED[each.status]})`).join("; ")}`, "accept them first (UC-008)");
      }
      return changes.length === 0 ? null : found("warning", AS_A_WHOLE,
        `SPEC changes that are open, which the architecture is not derived from: ${changes.join("; ")}`,
        "decide them first (UC-006), or go on: the architecture is derived from the SPEC as it stands");
    },
    "rests-on-accepted": async (context) => {
      const { snapshot, address } = context.product;
      const realised = await realisedBy(snapshot, [...listOf(context.params.steps), ...listOf(context.params.items)]);
      const requirements = [...new Set([...listOf(context.params.requirements), ...realised.requirements])];
      const useCases = [...new Set([...listOf(context.params.useCases), ...realised.useCases])];
      const spec = parseSpec((await snapshot.read(SPEC_PATH)) ?? "");
      const status = new Map([...statuses(snapshot).values()].filter((each) => each.kind === "use-case")
        .map((each) => [each.id, each.status]));
      const open = [
        ...requirements.filter((name) => !spec.requirements.has(name))
          .map((name) => `the requirement ${name} is not in the SPEC`),
        ...useCases.filter((id) => status.get(id) !== "accepted").map((id) =>
          `the use case ${id} ${NOT_ACCEPTED[status.get(id)] ?? "is no use case of the product"}`),
        ...(context.params.architecture === true ? [...statuses(snapshot)]
          .filter(([, each]) => each.kind in ARCHITECTURE_KINDS && each.status !== "accepted")
          .map(([path, each]) => `the architecture file ${path} ${NOT_ACCEPTED[each.status]}`) : []),
      ];
      return open.length === 0 ? null : finding({ artifact: address, line: 1, kind: "error", rule: ACCEPTED_FIRST,
        what: `the job rests on what is not accepted: ${open.join("; ")}`,
        fix: "accept them first, or take them out of the job's selection" });
    },
  },
};
