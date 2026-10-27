// reject.mjs — rejectEntry (MOD-spec-changes, Parts: reject.mjs; Interfaces: rejectEntry): a SPEC change entry that was shown leaves its queue.
//
// Module: MOD-spec-changes
//
// A PROPOSAL IS REJECTED WITH A REASON · A REJECTION REMOVES THE PROPOSAL (UC-006 4a): the entry's proposal, its rationale and its row of the queue's
// index leave in one commit, through MOD-approvals' commitRejection — under the person's account, the reason in its message, or, without a token,
// GitHub's pages for the same files. No approval record and no decision row is written, and the SPEC is not touched. A queue whose last entry leaves
// goes with it, every file of its folder: a queue of no entry decides nothing, and the entries the index keeps are those no rejection took. A STALE
// APPROVAL IS NOT APPLIED: the proposal and the section beside it must still have the blobs that were shown (as acceptEntries checks them).

import { commitRejection } from "../approvals/index.mjs";
import { blobSha } from "../text-tools/index.mjs";
import { queueAt, spanText } from "./queues.mjs";

const pad2 = (number) => String(number).padStart(2, "0");
const failure = (name, message, fields) => Object.assign(new Error(message), { name, ...fields });

// The index's text without the row of entry `number` of its entry table — the table under the header row that starts `| Nr |` —, every other byte as it
// was. A row is a line of the table whose first cell is the number, written with or without its leading zero.
function withoutRow(index, number) {
  const lines = index.split(/(?<=\n)/);
  const header = lines.findIndex((line) => /^\|\s*Nr\s*\|/.test(line));
  for (let at = header + 2; header >= 0 && at < lines.length && lines[at].startsWith("|"); at++) {
    if (Number(/^\|\s*(\d+)\s*\|/.exec(lines[at])?.[1]) === number) return [...lines.slice(0, at), ...lines.slice(at + 1)].join("");
  }
  return index;
}

/**
 * rejectEntry(host: Host, shown: { queue: string, entry: number, proposalBlob: string, sectionBlob: string }, person: string, reason: string) ->
 *   Promise<{ commit: string } | { fallback: Array<{ url: string, path: string, text: string | null, differs: boolean }> }> — the entry that was shown
 * leaves its queue (`queue` is Queue.folder): in one commit on the default branch, on the head it read, under the person's account, with the reason in
 * its message, its proposal and its rationale are deleted and its row of the index removed; where it was the queue's last entry, every file of the
 * queue's folder is deleted. Without a token nothing is written and GitHub's pages for the same files come back: the page that deletes each, the editor
 * of the index with its new text. Throws, before anything is written: a TypeError for a reason that is missing or blank; ChangedSinceShown { queue,
 * entry } when the queue no longer holds the entry, or its proposal or the section beside it no longer has the blob shown (`sectionBlob` "" for none);
 * NothingToReject { queue, entry } for an entry that is approved or in SPEC. Crosses the network, through the host; fails with its failures, unchanged,
 * and with TokenRequired on GitLab without a token.
 * @param {object} host
 * @param {{ queue: string, entry: number, proposalBlob: string, sectionBlob: string }} shown
 * @param {string} person
 * @param {string} reason
 */
export async function rejectEntry(host, shown, person, reason) {
  const { defaultBranch } = await host.repositoryInfo();
  const head = await host.readSnapshot(defaultBranch);
  const queue = await queueAt(head, shown.queue);
  const entry = queue?.entries.find((each) => each.number === shown.entry);
  const id = `spec-${shown.queue.split("/").pop()}-${pad2(shown.entry)}`;
  const changed = (why) => failure("ChangedSinceShown", `${id} ${why} after it was shown: nothing is written`, { queue: shown.queue, entry: shown.entry });
  if (!entry) throw changed("left its queue");
  if (entry.decision !== null || entry.state === "approved") {
    throw failure("NothingToReject", `${id} is ${entry.state}: there is nothing to reject`, { queue: shown.queue, entry: shown.entry });
  }
  if (entry.proposal.blob !== shown.proposalBlob) throw changed("changed");
  const target = await head.read(entry.file);
  const section = typeof target === "string" ? spanText(target, entry.anchor, entry.until) : null;
  if ((section === null ? "" : await blobSha(section)) !== shown.sectionBlob) throw changed("had its SPEC section changed");

  const last = queue.entries.length === 1;
  const own = [entry.proposal.path, entry.rationale].filter((path) => path && head.paths.includes(path));
  const deleted = last ? head.paths.filter((path) => path.startsWith(`${queue.folder}/`)) : own;
  const files = deleted.map((path) => ({ path, delete: true }));
  if (!last) files.push({ path: `${queue.folder}/index.md`, text: withoutRow((await head.read(`${queue.folder}/index.md`)) ?? "", entry.number) });
  return commitRejection(host, head, { id, files }, person, reason);
}
