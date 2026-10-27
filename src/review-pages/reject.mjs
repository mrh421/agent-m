// reject.mjs — the Reject beside Accept (MOD-review-pages, Parts): a field for the reason and the button that rejects what the page shows, through the
// service of the page's kind (MOD-approvals' rejectShown, MOD-spec-changes' rejectEntry). It draws one section; flow.mjs places it.
//
// Module: MOD-review-pages
//
// A PROPOSAL IS REJECTED WITH A REASON: a click without a reason writes nothing, says so and puts the focus in the field. THE DASHBOARD WRITES ONLY ON A
// PERSON'S CLICK: the button answers a person's click only (common.mjs). WITHOUT A TOKEN, GITHUB'S WEB INTERFACE IS THE FALLBACK: the service hands back
// GitHub's pages, which are listed with the reason to commit them with. A text that changed after it was shown is not rejected: the page is drawn again.

import { explain } from "../site-frame/index.mjs";
import { button, el, tokenStep } from "./common.mjs";
import { fallbackPages } from "./file-edit.mjs";

/**
 * rejectSection(where, id, fallbackTopic: string, reject: (reason: string) => Promise<{ commit } | { fallback }>, redraw: (message: Element) =>
 *   Promise<void>) -> Element — the section that rejects `id`: its explanation, the reason field with its label, and Reject; `fallbackTopic` the
 *   explanation of GitHub's pages that the kind's descriptor names.
 */
export function rejectSection(where, id, fallbackTopic, reject, redraw) {
  const reason = el("textarea", "reject-reason");
  reason.setAttribute("rows", "3");
  const go = button("btn reject", "Reject");
  const note = el("div", "reject-result");
  go.addEventListener("click", async () => {
    const typed = String(reason.value ?? "").trim();
    if (!typed) {
      reason.setAttribute("aria-invalid", "true");
      note.replaceChildren(el("p", "problem", "Type the reason for rejecting first: nothing was written."));
      reason.focus();
      return;
    }
    reason.setAttribute("aria-invalid", "false");
    go.disabled = true;
    try {
      const done = await reject(typed);
      if (done.commit) { await redraw(el("p", "result", `Rejected in commit ${done.commit.slice(0, 7)}.`)); return; }
      fallbackPages(note, done.fallback);
      const message = `reject ${id}\n\nReason: ${typed}\n`;
      const copy = button("btn copy", "Copy");
      copy.addEventListener("click", () => globalThis.navigator?.clipboard?.writeText?.(message));
      note.append(explain(fallbackTopic), el("p", null, "Commit each page with this message:"), el("pre", "commit-message", message), copy);
      go.disabled = false;
    } catch (failure) {
      go.disabled = false;
      if (failure.name === "ChangedSinceShown") {
        await redraw(el("p", "result problem", `${id} changed after it was shown, so nothing was written. This is the page as it stands now.`));
      } else if (failure.name === "TokenRequired") {
        note.replaceChildren(el("p", "problem", "A GitLab product is written with the project's own token. ", tokenStep(where.context)));
      } else {
        note.replaceChildren(el("p", "result problem", `${failure.name}: ${failure.message}`));
      }
    }
  });
  return el("section", "panel reject", el("h3", null, `Reject ${id}`), explain("rejecting"), el("label", null, "Reason for rejecting ", reason), go, note);
}
