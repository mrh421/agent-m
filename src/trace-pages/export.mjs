// The extras of the audit view (UC-030 step 5 and 5a): Export saves the audit document in the browser, with one click; Commit export, offered to a person with write access,
// commits the same document to docs/audits/<tag>.md through MOD-artifact-edits' saveFile, as the person's own input, on the person's click (THE DASHBOARD WRITES ONLY ON A
// PERSON'S CLICK). The document is MOD-release-evidence's auditDocument of the audit the page draws; nothing else is written.
//
// Module: MOD-trace-pages

import { saveFile } from "../artifact-edits/index.mjs";
import { auditDocument } from "../release-evidence/index.mjs";

/**
 * exportControls(el, { audit, release, host, head, canWrite }) -> Element — the buttons Export and, where `canWrite`, Commit export, with the line that says what a click did.
 * `el(name, className, ...children)` makes an element; `audit` and `release` are auditRows' result and the release ({ tag, commit }); `host` is the product's Host and `head` its
 * default branch's snapshot, from which the file of an earlier export is opened on its blob.
 */
export function exportControls(el, { audit, release, host, head, canWrite }) {
  const path = `docs/audits/${release.tag}.md`;
  const said = el("p", "audit-export-said");
  const text = () => auditDocument(audit, release);

  const save = el("button", "audit-export btn", "Export");
  save.setAttribute("type", "button");
  save.addEventListener("click", () => {
    const blob = new Blob([text()], { type: "text/markdown" });
    const address = URL.createObjectURL(blob);
    const link = el("a");
    link.href = address;
    link.download = `${release.tag}.md`;
    link.click();
    URL.revokeObjectURL(address);
  });

  const buttons = [save];
  if (canWrite) {
    const commit = el("button", "audit-commit-export btn", "Commit export");
    commit.setAttribute("type", "button");
    commit.addEventListener("click", async (event) => {
      if (event?.isTrusted === false) return;
      said.textContent = "Committing the export…";
      try {
        const out = await saveFile(host, { path, text: text(), openedBlob: head.blob(path), openedId: null });
        said.textContent = out.refused ? `Nothing was committed: ${path} changed meanwhile.` : `Committed ${path} in commit ${out.commit.slice(0, 7)}.`;
      } catch (failure) {
        said.textContent = `Nothing was committed: ${failure?.message ?? failure}`;
      }
    });
    buttons.push(commit);
  }
  return el("div", "audit-export", ...buttons, said);
}
