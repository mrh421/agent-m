// Offering a kind's tools to a drafter and carrying out their calls (MOD-job-runner, Parts: tools.mjs): the `ToolUse` of an
// exchange, and the built-in tools `list-files`, `read-file`, `search-files`, `propose-edit` and `hand-over`.
//
// Module: MOD-job-runner
//
// A model endpoint works in the execution loop of the book (Vibe Coding, ch. 11): the model proposes a call, the runner carries it out
// deterministically and returns a text, which the participant reads — a refusal included. The tools are described in data
// (MOD-job-catalogue's tools.md); a strategy here only carries a call out. Nothing a tool does writes anywhere: the product is read
// from the snapshot the job read, and what a participant proposes — the new text of a document, a hand-over — is held in the exchange
// and put into the draft by `withHeld`, for a person to save or to hand over.
//
// A strategy is handed the job's context with `exchange` added: the drafter the exchange is with, and what the exchange holds.

import { kindOf, toolsOf } from "../job-catalogue/index.mjs";
import { misfit } from "./loop.mjs";
import { registered, strategyOf } from "./registry.mjs";

const refusal = (why) => `refused: ${why}`;
// The most files one search-files call reads.
const SEARCH_LIMIT = 200;

/**
 * offerTools(kind, drafter, context) -> Promise<{ use: ToolUse, held } | null> — the ToolUse of one exchange with the drafter, and what the
 * exchange holds. A drafter whose type is `model endpoint` and that declares `use tools`, for a kind that names tools, is offered the kind's
 * tools in its order, less every tool whose capability it does not declare, every tool no program registered — the browser registers none of
 * MOD-checkout-tools' — and every tool the job's parameter `refuses` names; any other drafter gets null. `limit` is the kind's `toolLimit`, null where the kind states none. `call` checks a call's arguments against the tool's schema with the runner's own
 * `misfit`, and answers a tool not offered, or arguments the schema refuses, with a refusal.
 */
export async function offerTools(kind, drafter, context) {
  const named = kind.tools ?? [];
  if (!drafter || drafter.type !== "model endpoint" || !drafter.capabilities.includes("use tools") || named.length === 0) return null;
  const refuses = Array.isArray(context.params.refuses) ? context.params.refuses : [];
  const definitions = (await toolsOf(named)).filter((tool) => drafter.capabilities.includes(tool.needs) && registered("tools", tool.name) && !refuses.includes(tool.name));
  const held = { edits: new Map(), handOver: null };
  const here = { ...context, exchange: { drafter, held } };
  const call = async (name, args) => {
    const tool = definitions.find((each) => each.name === name);
    if (!tool) return refusal(`${name} is not offered here`);
    const why = misfit(args, tool.input, "the call");
    return why ? refusal(why) : strategyOf("tools", name)(args, here);
  };
  return { use: { definitions: definitions.map(({ name, description, input }) => ({ name, description, input })), call,
    limit: kind.toolLimit }, held };
}

/**
 * withHeld(draft, held, refuses = []) -> unknown — the draft with what its exchange held: the edits proposed by `propose-edit` added to the draft's own
 * `edits`, the later edit of a path replacing the earlier in its place, and the proposed hand-over as `handOver`. What the draft holds of a tool
 * `refuses` names — `edits` for `propose-edit`, `handOver` for `hand-over` — is dropped, whether the exchange held it or the answer gave it
 * (MOD-job-runner, ToolUse). A draft that is not an object leaves it as it is.
 */
export function withHeld(draft, held, refuses = []) {
  if (draft === null || typeof draft !== "object" || Array.isArray(draft)) return draft;
  const refused = (name) => refuses.includes(name);
  const without = { ...draft };
  if (refused("propose-edit")) delete without.edits;
  if (refused("hand-over")) delete without.handOver;
  if (!held) return without;
  draft = without;
  const added = {};
  if (held.edits.size && !refused("propose-edit")) {
    const edits = new Map((Array.isArray(draft.edits) ? draft.edits : []).map((edit) => [edit.path, edit]));
    for (const [path, text] of held.edits) edits.set(path, { path, text });
    added.edits = [...edits.values()];
  }
  if (held.handOver && !refused("hand-over")) added.handOver = held.handOver;
  return { ...draft, ...added };
}

// ---------------------------------------------------------------- the product's files

const trimmed = (folder) => (folder === "." ? "" : folder.replace(/^\/+/, "").replace(/\/+$/, ""));
const within = (path, folder) => path === trimmed(folder) || path.startsWith(`${trimmed(folder)}/`);

/**
 * sourcesOf(context, path) -> string[] — the sources of every `context.places.contents` entry that names the path or a folder above it, once each: what a
 * part holding that file carries (RESTRICTED CONTENT GOES ONLY WHERE ITS SOURCE PERMITS).
 */
export function sourcesOf(context, path) {
  const sources = (context.places?.contents ?? []).filter(({ paths }) => paths.some((each) => within(path, each))).map(({ source }) => source);
  return [...new Set(sources)];
}

/**
 * withheld(context, path) -> string | null — the refusal a tool answers for a path whose content is a restricted source's that does not allow the place of
 * the exchange's drafter, naming the source and the place; null where every source of the path allows it.
 */
export function withheld(context, path) {
  const { place } = context.exchange.drafter;
  const source = sourcesOf(context, path).find((each) => !(context.places.sources?.[each] ?? []).includes(place));
  return source ? refusal(`${path} holds content of ${source}, which may not go to ${place ?? "an unknown place"}`) : null;
}
const barred = (path, context) => withheld(context, path);

// ---------------------------------------------------------------- the paths propose-edit refuses

const outside = (path) => refusal(`${path} is outside docs/; code, tests and workflows reach the default branch by a pull request, through hand-over`);
const record = (path) => refusal(`${path} is a record, written once as evidence of what happened`);
const RECORDS = ["docs/approvals/", "docs/gates/", "docs/jobs/", "docs/conversations/", "docs/test-results/", "docs/tests/"];
const SETTINGS_FILES = ["docs/settings.md", "docs/collaborators.md", "docs/conversation-recording.md"];

/** refusedEdit(path: string) -> string | null — why `propose-edit` refuses a document, naming where it is changed; null for one it holds (MOD-job-runner). */
export function refusedEdit(path) {
  if (path === "SPEC.md") return refusal("SPEC.md is changed by a job of change-requirements, from the requirements page");
  if (!path.startsWith("docs/") || path.split("/").includes("..")) return outside(path);
  if (path.startsWith("docs/use-cases/")) return refusal(`${path} is a use case, changed by a job of change-use-case, from the use case's page`);
  if (path.startsWith("docs/architecture/")) {
    return refusal(`${path} is architecture, changed by a job of change-architecture, from the architecture page`);
  }
  if (RECORDS.some((folder) => path.startsWith(folder))) return record(path);
  if (path.startsWith("docs/spec-freigaben/")) return refusal(`${path} is a change queue, whose entries a change of requirements writes`);
  if (SETTINGS_FILES.includes(path)) return refusal(`${path} is a settings file, changed on the settings page, which states a notice first`);
  return null;
}

/** The built-in tools, registered by the runner itself: each carries one call out and returns what the participant reads. */
export const tools = {
  // The paths of the product's snapshot under a folder, one per line, in the snapshot's order.
  "list-files": async ({ folder }, context) => {
    const under = trimmed(folder);
    return context.product.snapshot.paths.filter((path) => under === "" || path.startsWith(`${under}/`)).join("\n");
  },
  // One file's text at the commit the job read, or a refusal.
  "read-file": async ({ path }, context) => {
    const why = barred(path, context);
    if (why) return why;
    const text = await context.product.snapshot.read(path);
    return text === null ? refusal(`no file ${path}`) : text;
  },
  // Each line of the product's files that holds the text, as <path>:<line number>: <line>; the files of a restricted source the drafter's
  // place is not allowed are not read, and each is named in a refusal at the end.
  // Searches the files below `path` — a file, or a folder ending in "/" — or every file; it refuses to read more than SEARCH_LIMIT files, naming how many there are,
  // so that a search reads in a page what the page can hold and the participant narrows it with `path`.
  "search-files": async ({ text, path = "" }, context) => {
    const { snapshot } = context.product;
    const scope = String(path).replace(/^\.?\/+/, "");
    const paths = scope ? snapshot.paths.filter((each) => each === scope || each.startsWith(scope.endsWith("/") ? scope : `${scope}/`)) : snapshot.paths;
    if (paths.length > SEARCH_LIMIT) {
      return refusal(`${scope ? `${scope} holds` : "the repository holds"} ${paths.length} files, more than the ${SEARCH_LIMIT} one search reads; name a file or a folder as path — SPEC.md, docs/use-cases/, docs/architecture/`);
    }
    const refused = paths.map((each) => [each, barred(each, context)]).filter(([, why]) => why);
    const open = paths.filter((each) => !refused.some(([barredPath]) => barredPath === each));
    await snapshot.readMany?.(open);
    const found = [];
    for (const path of open) {
      const content = await snapshot.read(path);
      if (content === null) continue;
      content.split("\n").forEach((line, at) => { if (line.includes(text)) found.push(`${path}:${at + 1}: ${line}`); });
    }
    return [...found, ...refused.map(([, why]) => why)].join("\n");
  },
  // Holds the new text of one document below docs/ in the exchange — the later edit of a path replaces the earlier — and writes nothing.
  "propose-edit": async ({ path, text }, context) => {
    const why = refusedEdit(path);
    if (why) return why;
    context.exchange.held.edits.set(path, text);
    return `proposed: ${path} is held for the person, who may save it`;
  },
  // Holds a proposed hand-over in the exchange and queues nothing itself: the prompt bar, or the program that runs an unattended job, carries it out (UC-049 4a, 4f).
  "hand-over": async ({ kind, works_on, task }, context) => {
    let definition;
    try {
      definition = await kindOf(kind);
    } catch (error) {
      if (error.name === "UnknownKind") return refusal(`the catalogue holds no kind ${kind}`);
      throw error;
    }
    if (definition.participant === "none") return refusal(`${kind} has no participant`);
    context.exchange.held.handOver = { kind, works_on, task };
    return `proposed: a job of ${kind} goes on once you have answered: what it drafts is a proposal for the person`;
  },
};

// ---------------------------------------------------------------- the parameters of a hand-over's job

// An item of the backlog or a step of the plan, by its identifier.
const PLANNED = /^ITM-\d+$/;

/**
 * handOverParams(worksOn: string[], snapshot: Snapshot) -> Record<string, unknown> — the parameters a hand-over's job takes for what it works on, by the keys the kinds'
 * strategies read: `requirements` for the names in capitals that are neither an identifier nor a web address — an entry with a lowercase letter, such as a section, names no requirement —, `useCases` for the use cases and `useCase` beside it for one alone, `steps`
 * for the plan's steps — the ITM-<n> the snapshot holds as a file under docs/plan/ — and `items` for the other ITM-<n>; a key it would leave empty is left out.
 */
export function handOverParams(worksOn, snapshot) {
  const names = [worksOn].flat().filter(Boolean).map(String);
  const useCases = names.filter((name) => /^UC-\d+$/.test(name));
  const planned = names.filter((name) => PLANNED.test(name));
  const steps = planned.filter((name) => snapshot.paths.some((path) => path.startsWith(`docs/plan/${name}-`)));
  const items = planned.filter((name) => !steps.includes(name));
  // A requirement is named in capitals, as the SPEC writes it; any other entry — a section, a file, a place for something new — names none,
  // and the task in the model's words carries it.
  const requirements = names.filter((name) => !/^[A-Z]+-[A-Za-z0-9-]+$/.test(name) && !/^https?:\/\//.test(name) && !/[a-z]/.test(name));
  return { ...(requirements.length ? { requirements } : {}), ...(useCases.length ? { useCases } : {}), ...(useCases.length === 1 ? { useCase: useCases[0] } : {}),
    ...(items.length ? { items } : {}), ...(steps.length ? { steps } : {}) };
}
