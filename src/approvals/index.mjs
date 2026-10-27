// MOD-approvals — approval records and the status of reviewed files (docs/architecture/MOD-approvals.md): its interface.
// It provides approvalSchema, the approval record's schema, and statuses, the status — open, accepted or
// changed — of every reviewed file of a snapshot from one pass over docs/approvals/ (status.mjs); approvalStrategies with
// the recipes use-cases and use-case-with-neighbours and the precondition rests-on-accepted for requirements and use cases
// (strategies.mjs), its other recipes and preconditions are not built yet; acceptShown, acceptanceBlockers and
// fallbackAcceptLink (accept.mjs); rejectShown and commitRejection, rejecting what was shown (reject.mjs); lastAcceptedText, the text
// the most recent record of an identifier names (status.mjs); and statusOf, the status of one reviewed file (status.mjs).
//
// Module: MOD-approvals
//
// It belongs to Specification and design (ARC-041). It runs unchanged in a browser and in Node. Its one read is that of
// its own data file approval-record.schema.md — the approval record's schema, in MOD-documents' language —, once, when
// the module is loaded: from the disk in Node, from the module's own address in a browser. A schema that cannot be read,
// or that breaks the language, stops the module's load, as MOD-documents' file says of a broken schema: it stops that
// module, never a single document. statuses reads nothing itself: it is given a snapshot already held in memory (every
// path and every blob SHA of the tree), and derives status from the records' own names, matched by identifier
// (MOD-identifiers.kindOfIdentifier) — it never reads a record's text. The strategies read the use cases and the SPEC through
// the product's snapshot of the job's context, whose read fetches a file once. lastAcceptedText, acceptShown and
// acceptanceBlockers read through the host and the snapshot they are given, and fallbackAcceptLink asks MOD-repository-hosts
// for the address of a page without making a request. rejectShown and commitRejection read and write through the host they are given, and
// hand back MOD-artifact-edits' pages without a token. It uses MOD-artifact-edits, MOD-documents, MOD-identifiers, MOD-repository-hosts,
// MOD-spec-document and MOD-text-tools only through their index.mjs. Every other file of this folder is private to it.

// Schema, in the type below, is MOD-documents' type of that name; Snapshot is MOD-repository-hosts'.
import { loadSchema } from "../documents/index.mjs";

const OWNER = "MOD-approvals";
const SCHEMA_FILE = new URL("./approval-record.schema.md", import.meta.url);
const disk = globalThis.process?.getBuiltinModule?.("node:fs");

// In a browser: the module's own file, from the address the module itself was loaded from. Throws an Error naming the
// file and the server's status when it is not served.
async function ownFile(url) {
  const answer = await fetch(url);
  if (!answer.ok) throw new Error(`${OWNER}: its ${url.pathname} was not served (${answer.status})`);
  return answer.text();
}

/**
 * approvalSchema: Schema — the approval record's schema, read from this module's data file approval-record.schema.md
 * with MOD-documents' loadSchema: for MOD-documents and for the modules that read records (MOD-spec-changes,
 * MOD-release-evidence).
 */
export const approvalSchema = loadSchema(
  disk ? disk.readFileSync(SCHEMA_FILE, "utf8") : await ownFile(SCHEMA_FILE), OWNER);

export { statuses, statusOf, lastAcceptedText } from "./status.mjs";
export { acceptShown, acceptanceBlockers, fallbackAcceptLink } from "./accept.mjs";
export { rejectShown, commitRejection } from "./reject.mjs";
export { approvalStrategies } from "./strategies.mjs";
