// requirements-draft.mjs — a draft of requirements from the conversation (MOD-review-pages, Parts; Interfaces: `draft`, UC-019 8, 8a, 9, 9a): the candidates each with its class beside the requirement
// it refers to, the sections `entrySections` composes from them and the classes as the author leaves them, and Save, which saves each composed section with `proposeSection` as an entry of its
// section's queue, only on the section the job read. A conflict the author has not decided is kept out of what is composed and saved.
//
// Module: MOD-review-pages
//
// A SPEC EDIT IS SAVED AS A PROPOSAL; A CONFLICT IS DECIDED BY A PERSON; THE PERSON WHO PROMPTS IS A SOURCE; A SAVE IS REFUSED WHEN THE TEXT CHANGED MEANWHILE; A REFUSED SAVE KEEPS THE EDIT; THE
// DASHBOARD WRITES ONLY ON A PERSON'S CLICK. Nothing is written before Save. A draft that was saved in a commit, or discarded, is dropped from the conversation: `drop` is called then.

import { showDifference } from "../markdown-render/index.mjs";
import { entrySections, proposeSection } from "../spec-changes/index.mjs";
import { parseSpec, sectionText } from "../spec-document/index.mjs";
import { blobSha } from "../text-tools/index.mjs";
import { explain } from "../site-frame/index.mjs";
import { candidateRows, editedResult } from "./candidates.mjs";
import { el, button, link, refusalText } from "./common.mjs";
import { fallbackPages } from "./file-edit.mjs";
import { sourcesOf } from "./spec-entries.mjs";

const SPEC = "SPEC.md";

/**
 * requirementsDraft({ snapshot, host, token, context, draft, trailers, drop }) -> Promise<Element> — the page of the draft of requirements `draft` (a ConversationDraft): `snapshot` the default
 * branch as the page read it, `trailers` the provenance lines of what is saved, `drop()` called once the sections are saved in a commit, and on Discard. The section a draft's parameters name (`section`, else the section of its first requirement) is opened on the
 * blob in its `version`, every other on the blob the page read.
 */
export async function requirementsDraft({ snapshot, host, token, context, draft, trailers, drop = () => {} }) {
  const { result, params } = draft;
  const spec = (await snapshot.read(SPEC)) ?? "";
  const parsed = parseSpec(spec);
  const { register } = await sourcesOf({ snapshot, context });
  const opened = new Map();
  for (const section of parsed.sections) opened.set(section.heading, await blobSha(sectionText(spec, section.heading)));
  const named = params.section ?? parsed.requirements.get((params.requirements ?? [])[0])?.section;
  if (named && params.version) opened.set(named, params.version);

  const panel = el("section", "requirements-result", el("h3", null, "Requirement candidates"), explain("candidate-classes"));
  const list = el("ul", "candidates"), composed = el("section", "composed-sections");
  const showComposed = () => {
    try {
      const edited = editedResult(panel, result);
      const sections = entrySections(spec, edited.draft, edited.classes, params.source);
      composed.replaceChildren(el("h4", null, "Composed sections"), ...sections.map((section) =>
        el("section", "composed-section", el("h5", null, section.anchor), showDifference(sectionText(spec, section.anchor), section.text))));
    } catch (failure) {
      composed.replaceChildren(el("p", "result problem", refusalText(failure)));
    }
  };
  candidateRows(list, result, parsed, params.source, register, showComposed);
  panel.append(list, composed);
  showComposed();

  const newer = el("div", "newer"), status = el("div", "saved");
  const save = button("btn save", "Save");
  save.addEventListener("click", async () => {
    save.disabled = true;
    newer.replaceChildren();
    status.replaceChildren();
    try {
      const edited = editedResult(panel, result);
      const sections = entrySections(spec, edited.draft, edited.classes, params.source);
      const info = await host.repositoryInfo();
      const latest = await host.readSnapshot(info.defaultBranch);
      for (const section of sections) {
        const current = sectionText((await latest.read(SPEC)) ?? "", section.anchor);
        if (await blobSha(current) !== opened.get(section.anchor)) {
          newer.replaceChildren(el("p", null, "Nothing was saved: the section changed meanwhile. The draft stays beside the newer section."),
            el("pre", null, current), showDifference(current, section.text));
          return;
        }
      }
      const saved = [];
      for (const section of sections) {
        saved.push(await proposeSection(host, { target: SPEC, anchor: section.anchor, until: section.until, text: section.text,
          why: `Drafted from ${params.source} on the person's instruction.`, origin: "the prompt bar", person: token?.name ?? "anonymous",
          openedBlob: opened.get(section.anchor), openedHead: snapshot.commit, trailers }));
      }
      const fallback = saved.flatMap((each) => each.fallback ?? []);
      if (fallback.length) {
        fallbackPages(status, fallback);
        return;
      }
      drop();
      status.replaceChildren(el("p", "entry", `Saved ${sections.length} proposed section${sections.length === 1 ? "" : "s"} in `,
        link(`${snapshot.repository.web}/commit/${saved.at(-1)?.commit}`, null, "this commit"), "."));
    } catch (failure) {
      status.replaceChildren(el("p", "result problem", refusalText(failure)));
    } finally {
      save.disabled = false;
    }
  });
  const discard = button("btn discard", "Discard");
  discard.addEventListener("click", () => {
    drop();
    panel.replaceChildren(el("p", null, "The draft was discarded. Nothing was written."));
  });
  panel.append(el("div", "actions", save, discard), status, newer);
  return panel;
}
