// status.mjs — statuses: the status of every reviewed file of a snapshot, from one pass over docs/approvals/; and
// statusOf: the status of one reviewed file; removedFiles: the decisions and module files removed since their acceptance, from the same
// pass; lastAcceptedText: the text that the most recent record of an identifier names (MOD-approvals, Interfaces).
//
// Module: MOD-approvals
//
// STATUS IS DERIVED FROM THE RECORDS: a reviewed file counts as accepted exactly when an approval record names its
// current blob SHA. A record's own path names what it approves and the blob it names,
// docs/approvals/<ID>-<blob12>.md — the first twelve hex digits of the 40-hex blob its text would also state
// (MOD-approvals, Data; AN APPROVAL NAMES THE EXACT TEXT). A snapshot already holds every path and every blob SHA of
// its tree in memory (MOD-repository-hosts, Snapshot: paths, blob), so status is derived from the names alone, matched
// by identifier — so a renamed file keeps its status, as MOD-approvals' statusOf states it: no record's text is read,
// and statuses crosses no network. lastAcceptedText does: it reads the repository, the history of the records and the text
// itself through the host it is given. Host, Snapshot and HistoryEntry are MOD-repository-hosts' types.

import { readDocument } from "../documents/index.mjs";
import { kindOfIdentifier } from "../identifiers/index.mjs";
import { blobSha } from "../text-tools/index.mjs";
import { HostError } from "../repository-hosts/index.mjs";
// The schema is loaded by index.mjs, once, and used here only when a function is called: that is after both have loaded.
import { approvalSchema } from "./index.mjs";

// The approval record's `kind` for a reviewed file's identifier kind (MOD-approvals, Data: kind is one of use-case,
// architecture-decision, module, spec, release-report). reviewedFile derives the three a reviewed file's own folder gives
// by the identifier scheme — UC in docs/use-cases/, ARC and MOD in docs/architecture/; a release test report is
// releaseReport's (below), and spec names no such file.
const RECORD_KIND = { UC: "use-case", ARC: "architecture-decision", MOD: "module" };

// A reviewed file's identifier and kind from its path, by the naming rules ONE USE CASE, ONE FILE
// (docs/use-cases/UC-<nnn>-<slug>.md), ONE ARCHITECTURE DECISION, ONE FILE (docs/architecture/ARC-<nnn>-<slug>.md) and
// ONE MODULE, ONE FILE (docs/architecture/MOD-<slug>.md, the whole slug its identifier) — or null for a path that is
// none of them. The exact digit counts of each kind are MOD-identifiers' (kindOfIdentifier), not repeated here. accept.mjs reads a shown
// removal's identifier with it.
export function reviewedFile(path) {
  const name = path.split("/").pop() ?? "";
  if (!name.endsWith(".md")) return null;
  const stem = name.slice(0, -3);
  if (path.startsWith("docs/architecture/") && kindOfIdentifier(stem) === "MOD") {
    return { id: stem, kind: RECORD_KIND.MOD };
  }
  const m = /^([A-Z]+-\d+)-/.exec(stem);
  if (!m) return null;
  const kind = kindOfIdentifier(m[1]);
  if (path.startsWith("docs/use-cases/") && kind === "UC") return { id: m[1], kind: RECORD_KIND.UC };
  if (path.startsWith("docs/architecture/") && kind === "ARC") return { id: m[1], kind: RECORD_KIND.ARC };
  return null;
}

// An approval record's identifier and the first twelve hex digits of the blob its own name says it approves, from its
// path docs/approvals/<ID>-<blob12>.md (MOD-approvals, Data) — or null for a path of no such shape
// (docs/approvals/README.md among them).
const RECORD_NAME = /^docs\/approvals\/([^/]+)-([0-9a-f]{12})\.md$/;
function approvalRecord(path) {
  const m = RECORD_NAME.exec(path);
  return m ? { id: m[1], blob12: m[2] } : null;
}

// The blob of the empty text: what the default branch holds of a removed decision or module file, and the blob the record of its removal
// names — git's blob of "", as MOD-approvals' Data states it (blob). A constant, not `await blobSha("")` at load: a top-level await would make
// this module, which is in a cycle with index.mjs, evaluate asynchronously, and change the order in which the modules that import it run.
export const EMPTY_BLOB = "e69de29bb2d1d6434b8b29ae775ad8c2e48c5391";

// The one pass over docs/approvals/ that statuses and removedFiles share: for each identifier a record names, the first twelve hex digits
// of every blob its records' names say they approve. Reads no record's text.
function recordsById(snapshot) {
  const byId = new Map();
  for (const path of snapshot.paths) {
    const record = approvalRecord(path);
    if (!record) continue;
    if (!byId.has(record.id)) byId.set(record.id, []);
    byId.get(record.id).push(record.blob12);
  }
  return byId;
}

/**
 * statuses(snapshot: Snapshot) -> Map<string, { id: string, kind: string, status: "open" | "accepted" | "changed" }> —
 * the status of every reviewed file of a snapshot, keyed by path; computed in one pass over docs/approvals/.
 * @param {{ paths: string[], blob: (path: string) => string | null }} snapshot
 * @returns {Map<string, { id: string, kind: string, status: "open" | "accepted" | "changed" }>}
 */
export function statuses(snapshot) {
  const records = recordsById(snapshot);
  const out = new Map();
  for (const path of snapshot.paths) {
    const file = reviewedFileOrReport(path);
    if (!file) continue;
    const blob12s = records.get(file.id) ?? [];
    const blob = snapshot.blob(path);
    const status = blob12s.some((blob12) => typeof blob === "string" && blob.startsWith(blob12)) ? "accepted"
      : blob12s.length ? "changed" : "open";
    out.set(path, { id: file.id, kind: file.kind, status });
  }
  return out;
}

/**
 * removedFiles(snapshot: Snapshot) -> Array<{ id: string, kind: "architecture-decision" | "module" }> — every decision or module file that a
 * record names and of whose identifier the snapshot holds no file, and whose removal no record accepts: no record of that identifier names the
 * empty text's blob. Its path and last accepted text are those lastAcceptedText gives for the identifier. Computed in the same pass over
 * docs/approvals/ as statuses, from the records' names alone, in the order of the identifiers; reads no record's text.
 * @param {{ paths: string[] }} snapshot
 * @returns {Array<{ id: string, kind: "architecture-decision" | "module" }>}
 */
export function removedFiles(snapshot) {
  const held = new Set(snapshot.paths.map((path) => reviewedFile(path)?.id).filter(Boolean));
  const removal = EMPTY_BLOB.slice(0, 12);
  return [...recordsById(snapshot)]
    .filter(([id, blob12s]) => ["ARC", "MOD"].includes(kindOfIdentifier(id)) && !held.has(id) && !blob12s.includes(removal))
    .map(([id]) => ({ id, kind: RECORD_KIND[kindOfIdentifier(id)] }))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

// A release test report's identifier and kind from its path docs/tests/releases/v<YYYY.MINOR.PATCH>.md — the record's
// identifier is release-v<version> (MOD-approvals, Data) — or null for a path that is none.
function releaseReport(path) {
  const m = /^docs\/tests\/releases\/(v\d{4}\.\d+\.\d+)\.md$/.exec(path);
  return m ? { id: `release-${m[1]}`, kind: "release-report" } : null;
}

// Every reviewed file a snapshot's statuses lists — a use case, an architecture decision, a module, a release test report
// (MOD-approvals, Responsibility) — by its identifier and kind, or null; statuses and statusOf both read it.
function reviewedFileOrReport(path) {
  return reviewedFile(path) ?? releaseReport(path);
}

/**
 * statusOf(path: string, blob: string, snapshot: Snapshot) -> "open" | "accepted" | "changed" — the status of one reviewed
 * file from the records in the same snapshot, matched by the identifier in the file name, so a renamed file keeps its
 * status: accepted when a record of the identifier names `blob`, changed when records name only earlier texts, open when
 * none exists. A record whose identifier is another kind's is not counted: only the record names of the file's own
 * identifier are. Reads no record's text. Throws NotReviewed for a path that is no reviewed file.
 * @param {string} path
 * @param {string} blob
 * @param {{ paths: string[] }} snapshot
 * @returns {"open" | "accepted" | "changed"}
 */
export function statusOf(path, blob, snapshot) {
  const file = reviewedFileOrReport(path);
  if (!file) throw Object.assign(new Error(`statusOf: ${path} is no reviewed file`), { name: "NotReviewed" });
  const blob12s = snapshot.paths.map(approvalRecord).filter((record) => record?.id === file.id).map((record) => record.blob12);
  return blob12s.some((blob12) => blob.startsWith(blob12)) ? "accepted" : blob12s.length ? "changed" : "open";
}

// Whether a record's content names what its name says: the blob its name's twelve hex digits begin, and — for a reviewed file
// — a file whose identifier is its name's (a release test report's record names its report's file the same way).
function namesWhatItsNameSays(path, fields) {
  const named = approvalRecord(path);
  if (!named || typeof fields.blob !== "string" || !fields.blob.startsWith(named.blob12)) return false;
  const file = typeof fields.file === "string" ? reviewedFileOrReport(fields.file) : null;
  return file !== null && file.id === named.id;
}

/**
 * lastAcceptedText(id: string, host: Host) -> Promise<{ text: string, blob: string, path: string } | null> — the text that the
 * most recent approval record of the identifier `id` names, with the blob the record names and the path the file had when it
 * was accepted (the record's `file`), also when the file has been renamed since; null when no record names the identifier.
 * The records of an identifier are those of the default branch whose names carry it (docs/approvals/<id>-<blob12>.md); the
 * most recent is the one whose commit, found in the history of the record, was committed last — the date as the server gives
 * it, in its own offset; two records committed at the same instant are not told apart. The text is the file at the commit that
 * added that record, where the file still has the path the record names, read with one host.readFileAt(file, [that commit]) —
 * no snapshot of that commit — except where the record names the empty text's blob, a removal's (EMPTY_BLOB): the empty text is
 * given then, and no file is read. Crosses the network, through the host; fails with its failures, unchanged — TokenRefused,
 * RateLimited, NotFound, Unreachable —, and with NotFound { what: the file } when the file did not hold the text the record
 * names at the commit that added the record: no text there, or a text whose blob SHA (MOD-text-tools.blobSha) is not the
 * record's; no other text is given for it. The check hashes the text already read and makes no request. A record whose content
 * names another blob than its name, or a file of another identifier, counts as no record: the most recent record that names
 * what its name says is taken, and null returned when none does.
 * @param {string} id
 * @param {object} host
 * @returns {Promise<{ text: string, blob: string, path: string } | null>}
 */
export async function lastAcceptedText(id, host) {
  const { defaultBranch } = await host.repositoryInfo();
  const head = await host.readSnapshot(defaultBranch);
  const records = head.paths.filter((path) => approvalRecord(path)?.id === id);
  if (records.length === 0) return null;
  const added = await Promise.all(records.map(async (path) => {
    const [adding] = await host.readHistory(path, { ref: head.commit, limit: 1, changes: false });
    return { path, commit: adding.commit, at: Date.parse(adding.date) };
  }));
  // AN APPROVAL NAMES THE EXACT TEXT: a record's name only points at it; one whose content names another blob than its name,
  // or a file of another identifier, counts as no record, and the next most recent is taken.
  let last = null, file = null, blob = null;
  for (const each of [...added].sort((a, b) => b.at - a.at)) {
    const fields = readDocument(approvalSchema, each.path, await head.read(each.path)).fields;
    if (!namesWhatItsNameSays(each.path, fields)) continue;
    ({ file, blob } = fields);
    last = each;
    break;
  }
  if (last === null) return null;
  // A removal's record names the empty text: that text is known, and where the record was added no file stands to read.
  if (blob === EMPTY_BLOB) return { text: "", blob, path: file };
  const text = (await host.readFileAt(file, [last.commit])).get(last.commit);
  if (typeof text !== "string" || await blobSha(text) !== blob) {
    throw new HostError("NotFound", { what: file }, `${file} did not hold the text ${last.path} names when the record was added`);
  }
  return { text, blob, path: file };
}
