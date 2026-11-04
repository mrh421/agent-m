// accept.mjs — acceptShown, acceptanceBlockers and fallbackAcceptLink (MOD-approvals, Parts: accept.mjs; Interfaces: acceptShown,
// acceptanceBlockers, fallbackAcceptLink): composing an acceptance as one commit, the blockers of a reviewed file, and GitHub's
// prefilled page. The records of SPEC entries are MOD-spec-changes', and statusOf and lastAcceptedText are status.mjs's.
//
// Module: MOD-approvals
//
// ACCEPTANCE IS A COMMIT BY THE ACCEPTING PERSON: acceptShown writes with the host it is given, which the caller connected with
// the person's token, so the commit is under the person's account. AN APPROVAL NAMES THE EXACT TEXT: a record names the blob
// that was shown, and a file whose blob on the head is another gets none. SEVERAL FILES ARE ACCEPTED IN ONE CLICK: one commit,
// one record per file. ARCHITECTURE RESTS ON ACCEPTED ARTIFACTS: a file that names a requirement or a use case that is not
// accepted gets none. A requirement is accepted when the SPEC holds it — one that stands only in an open queue is not —, a use
// case when `statuses` gives it accepted on the same head. Host, Snapshot and WebLinks are MOD-repository-hosts' types.

import { artifactSchemas, readDocument, writeDocument } from "../documents/index.mjs";
import { kindOfIdentifier } from "../identifiers/index.mjs";
import { connect } from "../repository-hosts/index.mjs";
import { parseSpec } from "../spec-document/index.mjs";
// The schema is loaded by index.mjs, once, and used here only when a function is called: that is after both have loaded.
import { approvalSchema } from "./index.mjs";
import { statuses, reviewedFile, EMPTY_BLOB } from "./status.mjs";

const SPEC_PATH = "SPEC.md";

// A failure of the module's own, by name, with the fields its message names.
const failure = (name, message, fields) => Object.assign(new Error(message), { name, ...fields });

// For each kind of reviewed file `statuses` gives: the schema that reads it, and the key under which it names what it rests on —
// a use case the requirements it realises, a decision what forces it (requirements and use cases), a module what it realises.
const READ_BY = { "use-case": "useCase", "architecture-decision": "decision", module: "module" };
const NAMES_UNDER = { "use-case": "realises", "architecture-decision": "forced_by", module: "realises" };

/**
 * acceptanceBlockers(path: string, snapshot: Snapshot) -> Promise<string[]> — the requirements and use cases the reviewed file at
 * `path` names that are not accepted, in the order the file names them: a requirement the SPEC of the snapshot does not hold,
 * a use case that no record of the snapshot names the current text of or that is none of the product's. Empty when the file
 * rests only on accepted artifacts, for a release test report, and for a path that holds no reviewed file. Reads the file, and the SPEC where the file
 * names a requirement, through the snapshot.
 * @param {string} path
 * @param {{ paths: string[], blob: (path: string) => string | null, read: (path: string) => Promise<string | null> }} snapshot
 * @returns {Promise<string[]>}
 */
export async function acceptanceBlockers(path, snapshot) {
  const reviewed = statuses(snapshot);
  const file = reviewed.get(path);
  // A release test report names no requirement and no use case: it rests on nothing.
  const body = file && file.kind !== "release-report" ? await snapshot.read(path) : null;
  if (body === null) return [];
  const named = [readDocument(artifactSchemas()[READ_BY[file.kind]], path, body).fields[NAMES_UNDER[file.kind]] ?? []].flat();
  const useCases = new Map([...reviewed.values()].filter((each) => each.kind === "use-case").map((each) => [each.id, each.status]));
  const isUseCase = (name) => kindOfIdentifier(name) === "UC";
  const spec = named.every(isUseCase) ? null : parseSpec((await snapshot.read(SPEC_PATH)) ?? "");
  return named.filter((name) => (isUseCase(name) ? useCases.get(name) !== "accepted" : !spec.requirements.has(name)));
}

/**
 * acceptShown(host: Host, shown: Array<{ path: string, blob: string }>, person: string) -> Promise<{ commit: string,
 * recorded: string[], leftOut: Array<{ path: string, reason: "changed since shown" | "rests on what is not accepted",
 * names: string[] }> }> — accepts every reviewed file that was shown in one commit on the default branch of the host, on the
 * head it read, with the token the host was connected with: one record `docs/approvals/<id>-<blob12>.md` for each, naming the
 * blob that was shown. A file whose blob on that head is not the one shown — also one that is gone — gets no record and is left
 * out with the reason "changed since shown" and no name. A shown file with the empty text's blob is a removal: it is recorded, naming the
 * empty text's blob, while the head holds no file of its identifier, and left out as "changed since shown" when the head holds one; a file with blockers (acceptanceBlockers on that head) gets none and is
 * left out with the reason "rests on what is not accepted" and its blockers as names. `recorded` holds the paths of the files
 * that got a record, `leftOut` the others, each in the order shown. The commit's message names the accepting person and the
 * files accepted. A shown path is a reviewed file — a use case, a decision or a module file —: another file that stands on the
 * head as shown throws a TypeError, before anything is written. Crosses the network, through the host; fails with its failures,
 * unchanged — Moved, SecretRefused, TokenRefused, PermissionMissing, RateLimited, Unreachable —, and with NothingToAccept
 * { leftOut } when every file was left out; nothing is written then.
 * @param {object} host
 * @param {Array<{ path: string, blob: string }>} shown
 * @param {string} person
 */
export async function acceptShown(host, shown, person) {
  const { defaultBranch } = await host.repositoryInfo();
  const head = await host.readSnapshot(defaultBranch);
  const reviewed = statuses(head);
  const files = [], recorded = [], ids = [], leftOut = [];
  const held = new Set([...reviewed.values()].map((each) => each.id));
  for (const { path, blob } of shown) {
    let file;
    if (blob === EMPTY_BLOB) {
      // A removal: recorded while the head holds no file of its identifier; it names nothing, so nothing blocks it.
      file = reviewedFile(path);
      if (file === null) throw new TypeError(`acceptShown: ${path} is no use case, decision or module file`);
      if (held.has(file.id)) {
        leftOut.push({ path, reason: "changed since shown", names: [] });
        continue;
      }
    } else {
      if (head.blob(path) !== blob) {
        leftOut.push({ path, reason: "changed since shown", names: [] });
        continue;
      }
      const names = await acceptanceBlockers(path, head);
      if (names.length > 0) {
        leftOut.push({ path, reason: "rests on what is not accepted", names });
        continue;
      }
      file = reviewed.get(path);
    }
    const { id, kind } = file;
    const text = writeDocument(approvalSchema, { fields: { kind, file: path, blob } });
    files.push({ path: `docs/approvals/${id}-${blob.slice(0, 12)}.md`, text });
    recorded.push(path);
    ids.push(id);
  }
  if (files.length === 0) throw failure("NothingToAccept", "every file shown was left out: nothing is written", { leftOut });
  const message = `accept ${ids.join(", ")} (Agent M dashboard)\n\nAccepted by ${person}.\n`;
  const { commit } = await host.commitFiles({ branch: defaultBranch, expectedHead: head.commit, files, message });
  return { commit, recorded, leftOut };
}

/**
 * fallbackAcceptLink(record: { path: string, text: string }, snapshot: Snapshot) -> { url: string, path: string, text: string } |
 * { refused: "gitlab" } — without a token, the new-file page of the product's repository on GitHub, prefilled with the record's
 * path and the record and nothing else (NO TEXT TRAVELS IN A URL), as MOD-repository-hosts' webLinks builds it; the path and the
 * record are returned as well, for a copy button when the prefill does not arrive. A product on a GitLab server has no such page,
 * and the link is refused (A GITLAB PRODUCT IS WRITTEN WITH A TOKEN). The page is the one of the branch webLinks names, `main`
 * until ITM-452. Makes no request.
 * @param {{ path: string, text: string }} record
 * @param {{ repository: object }} snapshot
 */
export function fallbackAcceptLink({ path, text }, snapshot) {
  const url = connect(snapshot.repository).webLinks().newFile(path, text);
  return url === null ? { refused: "gitlab" } : { url, path, text };
}
