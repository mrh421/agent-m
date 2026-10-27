// file-edit.mjs — editing a reviewed file on the dashboard (MOD-review-pages, Parts): the editor opens on the file's
// current text, shows the descriptor's marks, and saves through MOD-artifact-edits on the blob it opened; for a decision or a module, *Check this edit* stands beside it.
//
// Module: MOD-review-pages

import { fallbackEditLinks, saveFile } from "../artifact-edits/index.mjs";
import { artifactSchemas, documentFindings, readDocument } from "../documents/index.mjs";
import { renderArtifact } from "../markdown-render/index.mjs";
import { explain, readProblem, runPanel } from "../site-frame/index.mjs";
import { parseSpec } from "../spec-document/index.mjs";
import { graphFindings, storedGraph } from "../trace-graph/index.mjs";
import { finding } from "../text-tools/index.mjs";
import { runOnTab } from "../runtimes/index.mjs";
import { button, el, link, openEditor, openGithubEditor, parseServer, tokenStep } from "./common.mjs";
import { byClassChecked, connectionsOf, loadStage, participantList, preparedRun } from "./jobs.mjs";

const SCHEMA = { "use-case": "useCase", "architecture-decision": "decision", module: "module" };
const REALISES = "A USE CASE REALISES NAMED REQUIREMENTS";

const unquote = (text) => text.trim().replace(/^["']|["']$/g, "");

function schemaOf(kind) {
  return artifactSchemas()[SCHEMA[kind.kind]];
}

function listLines(text, key) {
  const lines = text.split(/\r?\n/);
  if (lines[0] !== "---") return [];
  const found = [];
  for (let at = 1; at < lines.length && lines[at] !== "---"; at++) {
    const start = new RegExp(`^${key}:\\s*(.*)$`).exec(lines[at]);
    if (!start) continue;
    if (start[1].trim()) found.push({ value: unquote(start[1]), line: at + 1 });
    for (let row = at + 1; row < lines.length && /^\s/.test(lines[row]); row++) {
      const item = /^\s*-\s*(.+?)\s*$/.exec(lines[row]);
      if (item) found.push({ value: unquote(item[1]), line: row + 1 });
    }
    return found;
  }
  return found;
}

function unmatchedRealises(artifact, text, requirements) {
  return listLines(text, "realises")
    .filter(({ value }) => value && !requirements.has(value))
    .map(({ value, line }) => finding({ artifact, line, kind: "error", rule: REALISES,
      what: `realises "${value}", which matches no requirement`, fix: "use an existing requirement name or remove it" }));
}

// GitHub's pages of MOD-artifact-edits' fallbackEditLinks, one item each: the link and, for a page that writes a text, the text to paste; a page that deletes
// a file (its text null) carries none. false, drawing nothing, for a refusal.
export function fallbackPages(target, pages) {
  if (pages.refused) return false;
  const list = el("ul", "pages");
  for (const page of pages) {
    list.append(el("li", null, link(page.url, "github-page", page.text === null ? `Open GitHub's page that deletes ${page.path}` : `Open GitHub's page for ${page.path}`),
      page.differs ? el("p", "problem", "The file differs on the default branch; compare before committing.") : "",
      page.text === null ? "" : el("pre", "clipboard-text", page.text)));
  }
  target.replaceChildren(el("p", null, "There is no token: GitHub's page opens for each file, and you commit them there."), list);
  return true;
}

const KIND = "review-architecture";
const WARNING = "warning";

// *Check this edit* (UC-023 step 3): the kind `review-architecture` run on the edited file as its draft. Nothing is sent while the section is drawn or the panel is shown: Run is the
// one click that starts the job, and the job has no record, so nothing is committed.
// The findings of the reviewer's draft as warnings, in MOD-text-tools' form.
const warningsOf = (draft) => (Array.isArray(draft?.findings) ? draft.findings : []).map((each) =>
  finding({ artifact: String(each.artifact), line: Number.isInteger(each.line) && each.line >= 1 ? each.line : 1, kind: WARNING, rule: String(each.rule), what: String(each.what), fix: String(each.fix) }));

/**
 * offerCheck(where, file, editor, onFindings) -> Promise<Element> — the section *Check this edit*, appended beside the editor: the participants that can draft text, the button that shows
 * the run panel for the editor's text as it stands, and Run. `onFindings(findings)` is called with the reviewer's findings, each a warning, when the job has run.
 */
export async function offerCheck(where, file, editor, onFindings) {
  const { target, token } = where;
  const section = el("section", "check-edit", el("h3", null, "Check this edit"));
  target.append(section);
  let stage;
  try {
    stage = await loadStage(where, KIND);
  } catch (failure) {
    section.append(readProblem(failure, Boolean(token)));
    return section;
  }
  const { definition, participants, instanceSnapshot, product, needs, drafters } = stage;
  const offered = participantList(drafters, participants, product, needs);
  const shown = el("section", "stage");
  const prepare = button("btn prepare", "Check this edit");
  section.append(el("section", "reviewers", el("h4", null, "Reviewing participant"), offered), prepare, shown);

  async function run(ready) {
    const result = el("section", "job");
    shown.append(result);
    try {
      if (!ready.offer || !ready.offer.available || ready.offer.route.kind !== "tab") {
        throw Object.assign(new Error(ready.offer?.reason ?? "this check runs in this tab: choose a participant whose route is the tab"), { name: "RouteUnavailable" });
      }
      const outcome = await runOnTab(ready.prepared, ready.jobContext, connectionsOf([ready.prepared.drafter].filter(Boolean), where.context.store), { host: where.host, record: null });
      const found = warningsOf(outcome.draft);
      onFindings(found);
      result.append(el("p", "ran", found.length ? `${found.length} finding${found.length === 1 ? "" : "s"}, shown beside the edit as warnings.` : "No finding."));
    } catch (failure) {
      result.append(el("p", "result problem", `${failure.name}: ${failure.message}`));
    }
  }

  prepare.addEventListener("click", async () => {
    shown.replaceChildren();
    const chosen = drafters.find((participant) => byClassChecked(offered, participant.name));
    if (!chosen) { shown.append(el("p", "problem", "Choose the participant that reviews.")); return; }
    const draft = { files: [{ path: file.path, class: "change", of: file.id, text: editor.text() }] };
    try {
      const ready = await preparedRun({ ...where, definition, jobKind: KIND, params: { draft }, chosen, participants, instanceSnapshot, product, needs });
      shown.append(runPanel(ready.prepared, { onRun: () => run(ready) }));
    } catch (failure) {
      shown.append(readProblem(failure, Boolean(token)));
    }
  });
  return section;
}

// showFileEdit(where, kind, file) — the page that edits `file`; the editor it opened, or nothing where it opened none.
export async function showFileEdit(where, kind, file) {
  const { target, snapshot, token, host, context } = where;
  const body = await snapshot.read(file.path);
  if (body === null) {
    target.append(el("p", "problem", `No ${kind.noun} ${file.id} on the default branch.`));
    return;
  }
  target.append(el("h2", null, `Edit ${file.id}`), explain(kind.explain.edit ?? kind.explain.one));
  if (!token && parseServer(context) === "gitlab") {
    target.append(renderArtifact(body), el("p", "problem", "A GitLab product is written with the project's own token. ",
      tokenStep(context)));
    return;
  }

  const schema = schemaOf(kind);
  const spec = await snapshot.read("SPEC.md");
  const requirements = spec === null ? new Set() : new Set(parseSpec(spec).requirements.keys());
  const openedBlob = snapshot.blob(file.path);
  const saved = el("div", "saved");
  const editorBox = el("div", "editor-box");
  target.append(editorBox, saved);

  // The findings across artifacts (graphFindings) of a decision or a module are the stored graph's of the commit opened, handed to the editor when
  // they are in: the page never builds a graph, so an edit is checked across artifacts by the workflow once it is committed.
  let editor = null;
  // The findings of *Check this edit*, each a warning: they stand beside the marks of the schema and the graph while the text is edited.
  let reviewed = [];
  const storedFindings = kind.kind === "use-case" ? null
    : storedGraph(snapshot, snapshot.commit).then((graph) => graphFindings(graph).filter((found) => found.artifact === file.id), () => []);
  async function acrossArtifacts(own) {
    const found = await storedFindings;
    if (editor) editor.setMarks([...own, ...found]);
  }
  const marks = (text) => {
    const document = readDocument(schema, file.path, text);
    const found = documentFindings(schema, document);
    if (kind.kind === "use-case") found.push(...unmatchedRealises(document.id ?? file.id, text, requirements));
    else acrossArtifacts([...found, ...reviewed]).catch(() => {});
    return [...found, ...reviewed];
  };
  const disabledReason = (text) => {
    const id = readDocument(schema, file.path, text).id;
    return id === file.id ? null : `the identifier changed from ${file.id} to ${id ?? "none"}; keep ${file.id}.`;
  };
  const fallbackFor = (text) => fallbackEditLinks([{ path: file.path, text, existing: openedBlob !== null }], snapshot);

  async function save(text) {
    if (!token) {
      const pages = fallbackFor(text);
      if (!fallbackPages(saved, pages)) return { kind: "failed", reason: "a GitLab product is written with the project's own token." };
      await openGithubEditor(pages[0]);
      return { kind: "failed", reason: "there is no token, so nothing was committed from here: the text is on the clipboard and GitHub's editor is open." };
    }
    try {
      const outcome = await saveFile(host, { path: file.path, text, openedBlob, openedId: file.id });
      if (outcome.refused === "changed meanwhile") return { kind: "refused", newer: outcome.current ?? "" };
      if (outcome.refused === "identifier changed") {
        return { kind: "failed", reason: `the identifier changed from ${outcome.openedId} to ${outcome.nowId ?? "none"}; keep ${outcome.openedId}.` };
      }
      const commit = `${snapshot.repository.web}/commit/${outcome.commit}`;
      await where.shownAgain(file.id, el("p", "saved-note", "Saved in ", link(commit, null, `commit ${outcome.commit.slice(0, 7)}`), "."));
      return { kind: "saved", link: commit };
    } catch (failure) {
      if (failure.name === "PermissionMissing" && fallbackPages(saved, fallbackFor(text))) {
        return { kind: "failed", reason: failure.message };
      }
      return { kind: "failed", reason: `${failure.name}: ${failure.message}` };
    }
  }

  editor = openEditor(editorBox, body, { marks, save, disabledReason });
  // An edit of the architecture may be checked before it is saved (UC-023 step 3): the check saves nothing, and needs the person's token for the job's person.
  if (token && kind.kind !== "use-case") await offerCheck(where, file, editor, (found) => { reviewed = found; editor.setMarks(marks(editor.text())); });
  return editor;
}
