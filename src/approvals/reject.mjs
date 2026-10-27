// reject.mjs — rejectShown and commitRejection (MOD-approvals, Parts: reject.mjs; Interfaces: rejectShown, commitRejection): rejecting a use case, an
// architecture decision or a module file that was shown, and the one commit of any rejection — or, without a token, GitHub's pages for it.
//
// Module: MOD-approvals
//
// A PROPOSAL IS REJECTED WITH A REASON: nothing is read or written without a reason. A REJECTION REMOVES THE PROPOSAL: the file returns to the text the
// most recent approval record of its identifier names (lastAcceptedText), at the path it has now, or leaves the working tree when no record names
// one; no record is written. A STALE APPROVAL IS NOT APPLIED: the head must still hold the blob that was shown. WITHOUT A TOKEN, GITHUB'S WEB
// INTERFACE IS THE FALLBACK: where the host may not write, the same files are handed back as MOD-artifact-edits' pages, as MOD-spec-changes'
// proposeSection hands back an edit. Host and Snapshot are MOD-repository-hosts' types.

import { fallbackEditLinks } from "../artifact-edits/index.mjs";
import { lastAcceptedText, statuses } from "./status.mjs";

// The kinds of reviewed file a rejection takes back: those of the proposals the review pages offer (a release test report is decided by its release).
const REJECTABLE = new Set(["use-case", "architecture-decision", "module"]);

const failure = (name, message, fields) => Object.assign(new Error(message), { name, ...fields });

// The reason as typed, without its surrounding blanks; a TypeError for none, or one of blanks only.
function reasonOf(reason) {
  if (typeof reason !== "string" || reason.trim() === "") throw new TypeError("a rejection states its reason: nothing is written without one");
  return reason.trim();
}

/**
 * commitRejection(host: Host, head: Snapshot, rejection: { id: string, files: Array<{ path: string, text: string } | { path: string, delete: true }> },
 * person: string, reason: string) -> Promise<{ commit: string } | { fallback: Array<{ url: string, path: string, text: string | null, differs: boolean }> }>
 * — the files of a rejection of `id` in one commit on the default branch, on the head that was read, with the host's token, so under the person's
 * account; its message names `id`, the person and the reason. Where the host may not write (no token: RepositoryInfo.canWrite false), or GitHub refuses
 * the commit for a missing write permission, nothing is written and GitHub's pages for the same files come back instead (MOD-artifact-edits'
 * fallbackEditLinks, a deleted file as its text null). Throws a TypeError for a reason that is missing or blank, and TokenRequired for a product on a
 * GitLab server without a token, before anything is written. rejectShown commits through it, and so does MOD-spec-changes' rejectEntry. Crosses the
 * network, through the host; fails with its failures, unchanged.
 * @param {object} host
 * @param {{ repository: object, commit: string, paths: string[] }} head
 * @param {{ id: string, files: Array<object> }} rejection
 * @param {string} person
 * @param {string} reason
 */
export async function commitRejection(host, head, { id, files }, person, reason) {
  const message = `reject ${id} (Agent M dashboard)\n\nRejected by ${person}.\n\nReason: ${reasonOf(reason)}\n`;
  const info = await host.repositoryInfo();
  const pages = () => {
    const found = fallbackEditLinks(files.map((file) => ({ path: file.path, text: file.delete ? null : file.text, existing: head.paths.includes(file.path) })), head);
    if (found.refused) throw failure("TokenRequired", "a GitLab product is written with the project's own token", {});
    return { fallback: found };
  };
  if (!info.canWrite) return pages();
  try {
    const { commit } = await host.commitFiles({ branch: info.defaultBranch, expectedHead: head.commit, files, message });
    return { commit };
  } catch (refused) {
    if (refused?.name === "PermissionMissing" && head.repository?.server !== "gitlab") return pages();
    throw refused;
  }
}

/**
 * rejectShown(host: Host, shown: { path: string, blob: string }, person: string, reason: string) -> Promise<{ commit: string } | { fallback: Array<{
 * url: string, path: string, text: string | null, differs: boolean }> }> — rejects the reviewed file that was shown: in one commit on the default
 * branch, on the head it read, under the person's account, with the reason in its message, the file's text becomes the one the most recent approval
 * record of its identifier names, or the file is deleted when no record names one. No record is written. Without a token, nothing is written and GitHub's
 * pages for the same change come back: the editor of the file with the accepted text, or the page that deletes it. Throws, before anything is written: a
 * TypeError for a reason that is missing or blank, and for a path that is no use case, decision or module file; ChangedSinceShown { path } when the head
 * no longer holds the blob shown; NothingToReject { path } when the blob shown is the accepted text. Crosses the network, through the host; fails with
 * its failures, unchanged — Moved, TokenRefused, PermissionMissing on GitLab, RateLimited, Unreachable, NotFound —, and with TokenRequired on GitLab
 * without a token.
 * @param {object} host
 * @param {{ path: string, blob: string }} shown
 * @param {string} person
 * @param {string} reason
 */
export async function rejectShown(host, shown, person, reason) {
  reasonOf(reason);
  const { defaultBranch } = await host.repositoryInfo();
  const head = await host.readSnapshot(defaultBranch);
  if (head.blob(shown.path) !== shown.blob) throw failure("ChangedSinceShown", `${shown.path} changed after it was shown: nothing is written`, { path: shown.path });
  const file = statuses(head).get(shown.path);
  if (!file || !REJECTABLE.has(file.kind)) throw new TypeError(`rejectShown: ${shown.path} is no use case, architecture decision or module file`);
  const last = await lastAcceptedText(file.id, host);
  if (last?.blob === shown.blob) throw failure("NothingToReject", `${file.id} is accepted as shown: there is nothing to reject`, { path: shown.path });
  const files = last ? [{ path: shown.path, text: last.text }] : [{ path: shown.path, delete: true }];
  return commitRejection(host, head, { id: file.id, files }, person, reason);
}
