// The classes of an issue and the person's one click on the class (MOD-issue-handling, Parts: classes.mjs; Interfaces: IssueClass, confirmClass).
// Of it, ITM-582 builds IssueClass and confirmClass, ITM-583 closeWithLinks.
//
// Module: MOD-issue-handling
//
// The class of an issue is recorded only as one of MOD-mail-records' labels on it (Data): bug as `defect`, change as `change`, not
// reproducible as `not-reproducible`. Where the module file leaves a reading open, this file states the one it takes:
//   - A rejection comments the reason, trimmed and nothing else, and then closes the issue, so that a refused comment leaves the issue open;
//     it touches no label (UC-012 4a: nothing else changes).
//   - A rejection without a reason, a class outside the four and an issue that is no positive integer are a TypeError before the host is called.
//   - The host's failures — Access's TokenRefused, MissingPermission, RateLimited, Unreachable — pass unchanged.
//   - Closing with links (ITM-583): the note `closed-with` names one address — MOD-mail-records' text has room for one, the pull request's or the commit's —, the pull request's where `links.pullRequest` is given, else the commit's; it names an item only where
//     `links.item` is given. The note is made before the issue is closed, so that a refused comment leaves the issue open. An issue that is no positive integer, or links that give neither address, are a TypeError before the host is called.
//   - The issue is read first, with the host's readIssue (ITM-1292): one already closed with the very note it would write is left as it is, so that the writer job of each route, which runs onPullRequestClosed on the same merge, notes and closes it once.

import { issueLabels, noteText } from "../mail-records/index.mjs";

/**
 * IssueClass — the four classes of an issue. *Bug*: the SPEC is right, code or a test is wrong; *change*: the SPEC is wrong, incomplete or silent for the
 * case — a missing requirement is a change, not a bug (UC-012); *not reproducible*; *rejected*: the issue is closed with its reason and nothing else changes.
 */
export const IssueClass = Object.freeze({ bug: "bug", change: "change", notReproducible: "not-reproducible", rejected: "rejected" });

const LABEL_OF = new Map([[IssueClass.bug, issueLabels.defect], [IssueClass.change, issueLabels.change], [IssueClass.notReproducible, issueLabels.notReproducible]]);

/**
 * confirmClass(host, issue, cls, reason) -> Promise<void> — the person's one click on the class: sets the label of a class and removes the other two;
 * for *rejected*, comments the reason and closes the issue. Crosses the network to the product's tracker.
 */
export async function confirmClass(host, issue, cls, reason) {
  if (!Number.isInteger(issue) || issue < 1) throw new TypeError(`confirmClass: ${issue} is no issue number`);
  if (!Object.values(IssueClass).includes(cls)) throw new TypeError(`confirmClass: ${cls} is no class of an issue`);
  if (cls === IssueClass.rejected) {
    if (typeof reason !== "string" || reason.trim() === "") throw new TypeError("confirmClass: a rejected issue is closed with a reason");
    await host.commentOnIssue(issue, reason.trim());
    await host.setIssueState(issue, "closed");
    return;
  }
  const label = LABEL_OF.get(cls);
  await host.setIssueLabels(issue, { add: [label], remove: [...LABEL_OF.values()].filter((other) => other !== label) });
}

/**
 * closeWithLinks(host, issue, links) -> Promise<void> — the comment `closed-with` on the issue, naming the pull request's address (else the commit's) and the item where there is one, and then the issue closed, unless the issue is already closed with that very note; run when the pull request of a bug fix or of an
 * item from the issue is merged. Crosses the network to the product's tracker. Errors: a TypeError for an issue that is no number or for links that give neither a pull request nor a commit; Access's TokenRefused, PermissionMissing, RateLimited, Unreachable.
 */
export async function closeWithLinks(host, issue, links) {
  if (!Number.isInteger(issue) || issue < 1) throw new TypeError(`closeWithLinks: ${issue} is no issue number`);
  const address = links?.pullRequest || links?.commit || null;
  if (typeof address !== "string") throw new TypeError("closeWithLinks: an issue is closed with the address of a pull request or of a commit");
  const note = noteText("closed-with", links.item ?? null, new Date().toISOString().slice(0, 10), address);
  const current = await host.readIssue(issue);
  if (current.state === "closed" && current.comments.some((comment) => comment.body === note)) return;
  await host.commentOnIssue(issue, note);
  await host.setIssueState(issue, "closed");
}
