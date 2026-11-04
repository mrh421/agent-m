// edit.mjs — editing a requirement on the dashboard (MOD-review-pages, Parts; Interfaces: `requirement/<name>/edit`, `requirements/new`): the editor of MOD-markdown-render on the
// requirement's SPEC section, with the marks of the SPEC's requirements, a Why field and the impact list; Save goes through MOD-spec-changes' proposeSection as an entry of the
// section's queue. The flow reaches it through the descriptor's `edit` (UC-018 for a requirement).
//
// Module: MOD-review-pages
//
// A SPEC EDIT IS SAVED AS A PROPOSAL; A REQUIREMENT IS NOT CHANGED WITHOUT AN IMPACT LIST; A RENAMED REQUIREMENT IS WITHDRAWN AND ADDED; A SAVE IS REFUSED WHEN THE TEXT CHANGED
// MEANWHILE; A REFUSED SAVE KEEPS THE EDIT; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK. The page uses the editor only through its interface (the marks callback, the save
// callback and its outcomes); it neither reaches into the editor's elements nor withholds its Save: where there is to be no Save, the editor is not opened.

import { renderArtifact } from "../markdown-render/index.mjs";
import { parseSpec, renamedRequirements, requirementFindings, sectionText } from "../spec-document/index.mjs";
import { proposeSection } from "../spec-changes/index.mjs";
import { waitingQueues } from "../progress-measures/index.mjs";
import { blobSha } from "../text-tools/index.mjs";
import { requirementImpact, storedGraph } from "../trace-graph/index.mjs";
import { explain, readProblem } from "../site-frame/index.mjs";
import { arrangeLink, asOfLine, el, link, reviewLink, openEditor, parseServer, tokenStep } from "./common.mjs";
import { fallbackPages } from "./file-edit.mjs";
import { entryId } from "./spec-entries.mjs";

const SPEC = "SPEC.md";
// A new requirement's four fields, empty, after the section: its name, the source between *( and )*, the rule, the check.
const EMPTY_FIELDS = "****\n\n*Check:*\n";

const same = (a, b) => a.source === b.source && a.rule === b.rule && a.check === b.check;

// The requirements an edit of a section changes, withdraws or adds, each with the artifacts that name it: a changed name is the old one withdrawn and the new one added.
export function impactOf(graph, before, after) {
  const was = parseSpec(before).requirements, is = parseSpec(after).requirements;
  const { withdrawn, added } = renamedRequirements(before, after);
  const namedBy = (name) => [...new Set(requirementImpact(graph, name).map((place) => place.id))];
  return [...[...is.keys()].filter((name) => was.has(name) && !same(was.get(name), is.get(name))).map((name) => ({ name, change: "changed", by: namedBy(name) })),
    ...withdrawn.map((name) => ({ name, change: "withdrawn", by: namedBy(name) })), ...added.map((name) => ({ name, change: "added", by: [] }))];
}

/**
 * showEdit(where, kind, params) — the page of a requirement's edit (`kind.fresh` false, the part `name`) or of a new requirement (`kind.fresh` true, the part `section`);
 * the editor it opened, which the route's `leave` closes, or nothing where it opened none.
 */
export async function showEdit(where, kind, params) {
  const { target, snapshot, host, token, context } = where;
  target.append(el("h2", null, kind.fresh ? "New requirement" : `Edit ${params.name ?? "a requirement"}`), explain(kind.explain.edit));
  const spec = await snapshot.read(SPEC);
  const heading = kind.fresh ? params.section : (spec === null ? undefined : parseSpec(spec).requirements.get(params.name ?? "")?.section);
  const section = spec !== null && heading ? sectionText(spec, heading) : null;
  if (section === null || section === undefined) {
    target.append(el("p", "problem", kind.fresh ? "Name the section of the SPEC the new requirement goes into." : `No requirement ${params.name} in the SPEC on the default branch.`));
    return;
  }
  if (!token && parseServer(context) === "gitlab") {
    target.append(renderArtifact(section), el("p", "problem", "A GitLab product is written with the project's own token. ", tokenStep(context)));
    return;
  }
  // The other open proposals on the section come from the waiting queues (MOD-progress-measures' waitingQueues), with the line As of while they are of an earlier commit.
  let graph, all, asOf;
  try {
    graph = await storedGraph(snapshot, snapshot.commit);
    ({ queues: all, asOf } = await waitingQueues(snapshot));
  } catch (failure) {
    target.append(readProblem(failure, Boolean(token)));
    return;
  }
  // The blob the next save is compared with: the section's as opened, and after a refusal the newer one shown beside the edit (UC-018 5a).
  let openedBlob = await blobSha(section);
  const initial = kind.fresh ? `${section.replace(/\n*$/, "\n\n")}${EMPTY_FIELDS}` : section;

  const others = el("ul", "others");
  for (const queue of all) {
    for (const entry of queue.entries) {
      if (entry.file !== SPEC || entry.anchor !== heading || entry.state === "in SPEC") continue;
      const id = entryId(queue.folder, entry.number);
      others.append(el("li", null, reviewLink(context, `#spec-entry/id=${encodeURIComponent(id)}`, null, id), ` — ${entry.state}`));
    }
  }
  const impact = el("ul", "impact");
  const rename = el("div", "renamed");
  const why = el("textarea", "why");
  why.setAttribute("aria-label", "Why");
  const editorBox = el("div", "editor-box"), saved = el("div", "saved");

  // The marks of the edited section and, with them, its impact list: the editor calls this at each input.
  const marks = (text) => {
    const rows = impactOf(graph, section, text);
    impact.replaceChildren(...rows.map((row) => el("li", null, `${row.name} — ${row.change}${row.by.length ? `, named by ${row.by.join(", ")}` : ""}`)));
    const renamed = rows.some((row) => row.change === "withdrawn") && rows.some((row) => row.change === "added");
    rename.replaceChildren(...(renamed ? [el("p", "rename", "The name is the identifier: a changed name is saved as the old requirement withdrawn and the new one added. "
      + "Below, what names the old one.")] : []));
    return requirementFindings(parseSpec(text));
  };

  async function save(text) {
    const reason = String(why.value ?? "").trim();
    if (!reason) return { kind: "failed", reason: "say why in the Why field." };
    try {
      const outcome = await proposeSection(host, { target: SPEC, anchor: heading, until: null, text, why: reason, origin: "the dashboard",
        person: token?.name ?? "anonymous", openedBlob, openedHead: snapshot.commit });
      if (outcome.refused) {
        openedBlob = typeof outcome.current === "string" ? await blobSha(outcome.current) : null;
        return { kind: "refused", newer: outcome.current ?? "" };
      }
      if (outcome.fallback) {
        return fallbackPages(saved, outcome.fallback) ? { kind: "failed", reason: "there is no token, so nothing was committed from here." }
          : { kind: "failed", reason: "a GitLab product is written with the project's own token." };
      }
      const id = entryId(outcome.queue, outcome.entry);
      const commit = `${snapshot.repository.web}/commit/${outcome.commit}`;
      const also = el("ul", "also");
      for (const replaced of outcome.alsoReplacing) also.append(el("li", null, entryId(replaced.queue, replaced.entry)));
      saved.replaceChildren(el("p", "entry", "Saved as ", reviewLink(context, `#spec-entry/id=${encodeURIComponent(id)}`, null, id), " in ", link(commit, null, "this commit"), "."), also);
      return { kind: "saved", link: commit };
    } catch (failure) {
      return { kind: "failed", reason: `${failure.name}: ${failure.message}` };
    }
  }

  // The editor changes text only, never a group: moving the requirement to another group is the arrangement's (UC-018 3e).
  target.append(el("h3", null, "Other open proposals on this section"), ...[asOfLine(asOf)].filter(Boolean), others, editorBox, el("h3", null, "Why"), why, el("h3", null, "Impact list"), rename, impact, saved,
    arrangeLink(context, kind));
  return openEditor(editorBox, initial, { marks, save });
}
