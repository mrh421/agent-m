// decision.mjs — the dialog of a decision (docs/architecture/MOD-site-frame.md, Parts; Interfaces: confirmDecision).
//
// Module: MOD-site-frame
// index.mjs exports `confirmDecision`.

// confirmDecision(decision) -> Promise<{ confirmed: boolean, reason: string | null }> — the single small confirmation
// surface used by the Bridge frame. The result is produced only by the person's button click.
export function confirmDecision({ title, lines, confirm, reason = false }) {
  return new Promise((resolve) => {
    const dialog = document.createElement("section");
    dialog.className = "decision";
    const heading = document.createElement("h2");
    heading.textContent = title;
    dialog.append(heading);
    for (const line of lines ?? []) {
      const paragraph = document.createElement("p");
      paragraph.textContent = line;
      dialog.append(paragraph);
    }
    const reasonField = reason ? document.createElement("textarea") : null;
    if (reasonField) {
      reasonField.setAttribute("aria-label", "Reason");
      dialog.append(reasonField);
    }
    const cancel = document.createElement("button");
    cancel.className = "btn";
    cancel.textContent = "Cancel";
    const accept = document.createElement("button");
    accept.className = "btn";
    accept.textContent = confirm;
    const answer = (confirmed) => {
      dialog.remove();
      resolve({ confirmed, reason: confirmed && reasonField ? reasonField.value : null });
    };
    cancel.addEventListener("click", () => answer(false));
    accept.addEventListener("click", () => answer(true));
    dialog.append(cancel, accept);
    document.body.append(dialog);
  });
}
