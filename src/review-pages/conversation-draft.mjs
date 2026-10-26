// conversation-draft.mjs — the route `draft` (MOD-review-pages, Interfaces: `draft`; UC-049 steps 5 and 6, UC-019 steps 7 to 9): the draft of the conversation that MOD-prompt-bar keeps for the
// subject the address names, shown against the current text before anything can be saved. Files each in the editor as their difference (file-drafts.mjs); requirements as the sections
// `entrySections` composes (requirements-draft.mjs); an architecture file with the rounds of its job and its due diligence. Save and Discard are the person's decisions, and a draft saved or discarded is dropped from the conversation.
//
// Module: MOD-review-pages
//
// A DRAFTED CHANGE IS SHOWN AGAINST THE CURRENT TEXT; AN ARTIFACT RECORDS THE VERSION THAT PRODUCED IT; A CONVERSATION IS WRITTEN TO A REPOSITORY ONLY WHEN RECORDING IS ON; THE DASHBOARD WRITES ONLY ON A
// PERSON'S CLICK. The commit's provenance lines name the Agent M version, the kind, the participant and its model and the rounds, and no message of the conversation.
//
// The impact list of a change of the architecture is MOD-trace-graph's architectureImpact over the graph of the default branch, the file's current text as before and the draft as after.

import { artifactSchemas, documentFindings, readDocument } from "../documents/index.mjs";
import { statuses } from "../approvals/index.mjs";
import { provenanceLines } from "../job-runner/index.mjs";
import { dropDraft, latestDraft } from "../prompt-bar/index.mjs";
import { explain, readProblem } from "../site-frame/index.mjs";
import { formatFinding } from "../text-tools/index.mjs";
import { el, link, readPlace } from "./common.mjs";
import { fileDrafts } from "./file-drafts.mjs";
import { loadStage } from "./jobs.mjs";
import { requirementsDraft } from "./requirements-draft.mjs";
import { changeImpact, dueDiligenceSection, graphOnce, roundsSection, splitDueDiligence } from "./sections.mjs";

// The schema of the kind of reviewed file that owns a path, among those of MOD-documents.
const OWNERS = [[/^docs\/use-cases\/UC-[^/]+\.md$/, "useCase"], [/^docs\/architecture\/ARC-[^/]+\.md$/, "decision"], [/^docs\/architecture\/MOD-[^/]+\.md$/, "module"]];

// The first error its owner's schema finds in the text of a file, written with the path; null for a file no schema owns and for one without an error.
function ownerError(path, text) {
  const owner = OWNERS.find(([pattern]) => pattern.test(path));
  if (!owner) return null;
  const schema = artifactSchemas()[owner[1]];
  const error = documentFindings(schema, readDocument(schema, path, text)).find((each) => each.kind === "error");
  return error ? `${path}: ${error.what}` : null;
}

// The rounds, and the findings the loop left, as the draft shows them: each finding in its one fixed text form (`A FINDING READS LIKE A COMPILER MESSAGE`).
function roundsAndLeft(result) {
  const left = el("ul", "left");
  for (const found of result.remaining) left.append(el("li", "left", formatFinding(found)));
  return [el("p", "rounds", `Correction rounds: ${result.rounds.length}`), explain("correction-loop"), left];
}

const ARCHITECTURE_FILE = /^docs\/architecture\/(ARC|MOD)-[^/]+\.md$/;

// The files of a draft: a change of a use case or of the architecture drafts `files`, a conversation `edits`.
const filesOf = (draft) => (draft.kind === "converse" ? draft.result.draft.edits : draft.result.draft.files) ?? [];

async function showFiles(where, draft, trailers, target, drop, hold) {
  const { snapshot, host } = where;
  const params = draft.params;
  // The text the job read: for the file the subject names, the blob in `version`; for any other, the one the page read.
  const named = params.useCase ?? params.target;
  const namedPath = named === undefined ? null : [...statuses(snapshot)].find(([, each]) => each.id === named)?.[0] ?? null;
  const versionOf = (path) => (path === namedPath && params.version ? params.version : undefined);
  const architecture = draft.kind === "change-architecture";
  // The impact list of each architecture file the draft changes, from the file on the default branch to the draft; derived before the editors open.
  const impacts = new Map(), graphOf = graphOnce(snapshot);
  if (architecture) {
    for (const drafted of filesOf(draft)) {
      if (!ARCHITECTURE_FILE.test(drafted.path)) continue;
      const current = await snapshot.read(drafted.path);
      if (current !== null) impacts.set(drafted.path, await changeImpact({ path: drafted.path }, { text: current }, drafted.text, graphOf));
    }
  }
  const extras = (path, text) => {
    const diligence = architecture ? splitDueDiligence(text).section : null;
    const impact = impacts.get(path);
    return [...(diligence === null ? [] : [dueDiligenceSection(diligence)]), ...(impact ? [impact.problem ?? impact.shown] : [])];
  };
  const check = draft.kind === "converse" ? ownerError : () => null;
  if (typeof draft.result.draft.answer === "string") target.append(el("div", "answer", draft.result.draft.answer));
  target.append(...roundsAndLeft(draft.result));
  if (architecture) target.append(roundsSection(draft.result.rounds, draft.result.stoppedBecause));
  const { drafts, discard, saved, leave } = await fileDrafts({ files: filesOf(draft), snapshot, host, trailers, versionOf, check, extras, drop });
  target.append(explain("draft-difference"), drafts, discard, saved);
  hold(leave);
}

async function show(where, params, hold) {
  const { target, context } = where;
  target.append(el("h2", null, "The draft of the conversation"));
  const key = params.subject ?? null;
  const draft = key === null ? null : latestDraft(context.store, key);
  if (draft === null) {
    target.append(el("p", "none", "There is no draft of the conversation for this page."), ...(key === null ? [] : [link(`#${key}`, "back", "Back to the page")]));
    return;
  }
  if (draft.result.stoppedBecause === "unusable" || !draft.result.draft) {
    target.append(el("p", "unusable", "The participant's answer could not be read. Nothing was written."),
      el("details", "raw", el("summary", null, "The raw answer"), el("pre", "answer", String(draft.result.raw ?? ""))));
    return;
  }
  const { participants, instanceSnapshot } = await loadStage(where, draft.kind);
  const participant = participants.find((each) => each.name === draft.participant) ?? { name: draft.participant, model: null };
  const drop = () => dropDraft(context.store, key);
  const commit = instanceSnapshot.commit ?? "unknown";
  const trailers = provenanceLines({ agentM: { version: commit, commit }, jobId: null, kind: draft.kind, participant, rounds: draft.result.rounds.length });
  if (draft.kind === "change-requirements") {
    target.append(...roundsAndLeft(draft.result), await requirementsDraft({ ...where, draft, trailers, drop }));
  } else {
    await showFiles(where, draft, trailers, target, drop, hold);
  }
}

// What the route's `leave` and `unsaved` ask: the editors of the page drawn last, or null where it drew none. A render that started earlier and ends later is not that page.
let held = null, latest = 0;

async function render(target, context, params) {
  const mine = ++latest;
  held = null;
  const where = await readPlace(target, context);
  if (where === null) return;
  try {
    await show(where, params, (editors) => { if (mine === latest) held = editors; });
  } catch (failure) {
    target.append(readProblem(failure, Boolean(where.token)));
  }
}

// The name of what a draft changes: the use case or the file it names, else the requirements it names, else nothing.
function changedBy(params) {
  const file = params.useCase ?? params.target;
  if (typeof file === "string") return file;
  return Array.isArray(params.requirements) && params.requirements.length ? params.requirements.join(", ") : null;
}

// The subject of this page (MOD-prompt-bar, Subject): the draft's own, as context, so that a follow-up in the bar is handed on to the draft's kind on the same target (UC-049 4a.1) and its
// answer is a newer draft that this route shows. `key` is the subject the draft was drafted on, and `draftRoute` the address of this route for it, the key percent-encoded as subjects.mjs writes it. Its parameters are the draft's own plus
// `draft`, the conversation's draft as it stands (its `result`; an edit open in an editor and not saved is the page's), which the change kinds hand over with their recipe `draft?`. Without a draft for
// the subject the address names, null: the frame's default stands.
function subject(params, context) {
  const key = params.subject ?? null;
  const draft = key === null ? null : latestDraft(context.store, key);
  if (draft === null) return null;
  return { key, title: changedBy(draft.params) ?? draftRoute.title, entry: null, paramsFor: () => ({ ...draft.params, draft: draft.result }),
    draftRoute: `draft/subject=${encodeURIComponent(key)}`, withhold: null, refuses: [] };
}

// The frame asks this before it shows another route: the editors of the page drawn last close, asking first, or stay (UC-018 7a).
function leave() {
  if (held === null) return true;
  const closed = held.close();
  if (closed) held = null;
  return closed;
}

export const draftRoute = { name: "draft", entry: null, title: "The draft of the conversation", render, subject, leave, unsaved: () => held !== null && held.unsaved() };
