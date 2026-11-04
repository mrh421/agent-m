// entry-edit.mjs — editing an open SPEC entry in place (MOD-review-pages, Parts; Interfaces: an open SPEC entry saved in place, in its own queue; UC-006 3a, UC-018 1a): the editor
// of MOD-markdown-render on the entry's proposal, a Why field and the impact list against the section that holds now; Save goes through MOD-spec-changes' saveEntry into the
// entry's own queue. The flow reaches it through the SPEC-entry descriptor's `save: "entry"`.
//
// Module: MOD-review-pages
//
// A SPEC EDIT IS SAVED AS A PROPOSAL; A SAVE IS REFUSED WHEN THE TEXT CHANGED MEANWHILE; A REFUSED SAVE KEEPS THE EDIT; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK. The editor is
// used only through openEditor, and where there is to be no Save it is not opened: only an open entry is edited, and a GitLab product without a token is shown the proposal only.

import { renderArtifact } from "../markdown-render/index.mjs";
import { entryView, queues, saveEntry } from "../spec-changes/index.mjs";
import { parseSpec, requirementFindings } from "../spec-document/index.mjs";
import { explain, readProblem } from "../site-frame/index.mjs";
import { storedGraph } from "../trace-graph/index.mjs";
import { impactOf } from "./edit.mjs";
import { fallbackPages } from "./file-edit.mjs";
import { el, link, reviewLink, openEditor, openGithubEditor, parseServer, tokenStep } from "./common.mjs";
import { entryId } from "./spec-entries.mjs";

const pad2 = (number) => String(number).padStart(2, "0");

/**
 * showEntryEdit(where, kind, id) — the page that edits the open entry `id` in place; the editor it opened, or nothing where it opened none.
 */
export async function showEntryEdit(where, kind, id) {
  const { target, snapshot, host, token, context } = where;
  let queue, item, view, graph;
  try {
    queue = (await queues(snapshot)).find((candidate) => candidate.entries.some((each) => entryId(candidate.folder, each.number) === id));
    item = queue?.entries.find((each) => entryId(queue.folder, each.number) === id);
    if (item) {
      view = await entryView(queue.folder, item.number, snapshot);
      graph = await storedGraph(snapshot, snapshot.commit);
    }
  } catch (failure) {
    target.append(readProblem(failure, Boolean(token)));
    return;
  }
  const back = reviewLink(context, `#${kind.route}/id=${encodeURIComponent(id)}`, "btn", "Back to the entry");
  if (!item) {
    target.append(el("p", "problem", `No ${kind.noun} ${id} on the default branch.`), reviewLink(context, `#${kind.route}`, null, `All ${kind.plural}`));
    return;
  }
  target.append(el("h2", null, `Edit entry ${pad2(item.number)} of ${queue.folder.slice(queue.folder.lastIndexOf("/") + 1)}`), explain(kind.explain.edit), back);
  if (view.state !== "open") {
    target.append(el("p", "problem", `The entry is not open: it is ${view.state}. Only an open entry is edited.`));
    return;
  }
  if (!token && parseServer(context) === "gitlab") {
    target.append(renderArtifact(view.proposal.text), el("p", "problem", "A GitLab product is written with the project's own token. ", tokenStep(context)));
    return;
  }
  const before = view.current?.text ?? "";
  const impact = el("ul", "impact"), rename = el("div", "renamed");
  const why = el("textarea", "why");
  why.setAttribute("aria-label", "Why");
  const editorBox = el("div", "editor-box"), saved = el("div", "saved");

  // The marks of the edited proposal and, with them, its impact list: the editor calls this at each input.
  const marks = (text) => {
    const rows = impactOf(graph, before, text);
    impact.replaceChildren(...rows.map((row) => el("li", null, `${row.name} — ${row.change}${row.by.length ? `, named by ${row.by.join(", ")}` : ""}`)));
    const renamed = rows.some((row) => row.change === "withdrawn") && rows.some((row) => row.change === "added");
    rename.replaceChildren(...(renamed ? [el("p", "rename", "The name is the identifier: a changed name is saved as the old requirement withdrawn and the new one added.")] : []));
    return requirementFindings(parseSpec(text));
  };

  async function save(text) {
    const reason = String(why.value ?? "").trim();
    if (!reason) return { kind: "failed", reason: "say why in the Why field." };
    try {
      const outcome = await saveEntry(host, { queue: queue.folder, entry: item.number, text, why: reason, person: token?.name ?? "anonymous", openedBlob: view.proposal.blob, openedHead: snapshot.commit });
      if (outcome.refused === "changed meanwhile") return { kind: "refused", newer: outcome.current ?? "" };
      if (outcome.refused === "not open") return { kind: "failed", reason: `the entry is no longer open: it is ${outcome.state}.` };
      if (outcome.fallback) {
        fallbackPages(saved, outcome.fallback);
        await openGithubEditor(outcome.fallback[0]);
        return { kind: "failed", reason: "there is no token, so nothing was committed from here: the proposal is on the clipboard and GitHub's editor is open." };
      }
      const commit = `${snapshot.repository.web}/commit/${outcome.commit}`;
      await where.shownAgain(id, el("p", "entry", "Saved in place: ", reviewLink(context, `#${kind.route}/id=${encodeURIComponent(id)}`, null, id), " in ", link(commit, null, "this commit"), "."));
      return { kind: "saved", link: commit };
    } catch (failure) {
      return { kind: "failed", reason: `${failure.name}: ${failure.message}` };
    }
  }

  target.append(editorBox, el("h3", null, "Why"), why, el("h3", null, "Impact list"), rename, impact, saved);
  return openEditor(editorBox, view.proposal.text, { marks, save });
}
