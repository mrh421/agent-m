// The editor with its live preview and its marks (MOD-markdown-render, Interfaces: openEditor, Editor, SaveOutcome).
//
// Module: MOD-markdown-render
//
// The Markdown in a text area and its preview beside it, rendered again on every input (EDITS ARE PREPARED ON THE DASHBOARD);
// beside the text one row per line, holding the caller's marks of that line in the one form of a finding, which block
// nothing. Save hands the text to the caller's save; on `refused` the edit stays in the text area, and the newer version is
// shown beside it with the difference (A REFUSED SAVE KEEPS THE EDIT).

import { formatFinding } from "../text-tools/index.mjs";
import { renderArtifact } from "./render.mjs";
import { difference } from "./difference.mjs";

// An element with its class and its children.
function element(name, className, ...children) {
  const e = document.createElement(name);
  if (className) e.className = className;
  e.append(...children);
  return e;
}

// openEditor(target: Element, text: string, options: { marks: (text: string) -> Finding[], save: (text: string) ->
// Promise<SaveOutcome>, disabledReason?: (text: string) -> string | null }) -> Editor — the editor of `text`, drawn into
// `target`.
export function openEditor(target, text, { marks, save, disabledReason = () => null }) {
  const area = element("textarea");
  area.value = text;
  area.setAttribute("spellcheck", "false");
  area.setAttribute("aria-label", "Markdown");
  const rows = element("ol", "marks"), preview = element("div", "preview");
  preview.setAttribute("tabindex", "0");
  const button = element("button", "btn", "Save");
  button.setAttribute("type", "button");
  const result = element("p", "result"), newer = element("div", "newer");
  let currentMarks = [];
  let lastSaved = area.value;
  let saving = false;
  // The one rule of unsaved changes: the text differs from the text the editor was opened with or last saved. `close` asks by it, and so does a route through `unsaved`.
  const unsaved = () => area.value !== lastSaved;
  target.replaceChildren(element("div", "editor", element("div", "text", area, rows), preview), element("p", null, button), result,
    newer);

  // One row per line of the text, and on to the line of the last mark, each holding the caller's marks of its line.
  function showMarks(findings) {
    const lines = Math.max(area.value.split("\n").length, ...findings.map((f) => f.line));
    rows.replaceChildren(...Array.from({ length: lines }, (_, i) =>
      element("li", null, ...findings.filter((f) => f.line === i + 1).map((f) => element("div", null, formatFinding(f))))));
  }
  function update() {
    preview.replaceChildren(renderArtifact(area.value));
    currentMarks = marks(area.value);
    showMarks(currentMarks);
    const reason = disabledReason(area.value);
    button.disabled = saving || Boolean(reason);
    if (reason) result.replaceChildren(`Save is disabled: ${reason}`);
    else if (/^Save is disabled: /.test(result.textContent)) result.replaceChildren();
  }
  area.addEventListener("input", update);

  button.addEventListener("click", async () => {
    const edited = area.value;
    const disabled = disabledReason(edited);
    if (disabled) {
      update();
      return;
    }
    saving = true;
    button.disabled = true;
    newer.replaceChildren();
    try {
      const answer = await save(edited);
      if (answer.kind === "saved") {
        lastSaved = edited;
        const link = element("a", null, answer.link);
        link.setAttribute("href", answer.link);
        result.replaceChildren("Saved — ", link);
      } else if (answer.kind === "refused") {
        result.replaceChildren("Nothing was saved: the text was changed meanwhile. Your edit stays in the editor; the newer version " +
          "is beside it.");
        newer.replaceChildren(
          element("div", "side",
            element("section", null, element("h3", null, "Your edit, as you saved it"), element("pre", null, edited)),
            element("section", null, element("h3", null, "The newer version"), element("pre", null, answer.newer))),
          element("h4", null, "Difference — from the newer version to your edit"),
          difference(answer.newer, edited));
      } else {
        result.replaceChildren(`Nothing was saved: ${answer.reason}`);
      }
    } finally {
      saving = false;
      update();
    }
  });

  update();
  return {
    text: () => area.value,
    setMarks(findings) {
      currentMarks = findings;
      showMarks(currentMarks);
    },
    showDraft(draft, against) {
      area.value = draft;
      update();
      newer.replaceChildren(element("h4", null, "Difference — from the current text to the draft"), difference(against, draft));
    },
    unsaved,
    close() {
      if (unsaved() && !confirm("Discard unsaved changes?")) return false;
      target.replaceChildren();
      return true;
    },
  };
}
