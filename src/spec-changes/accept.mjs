// accept.mjs — what the reviewer sees of an entry before accepting it, and accepting entries in their queue's order (MOD-spec-changes,
// Interfaces: entryView, acceptEntries, applyApproved). ITM-339 builds entryView; ITM-340 builds acceptEntries and applyApproved.
//
// Module: MOD-spec-changes
//
// entryView reads one queue's entry through queues.mjs and the files it names. acceptEntries and applyApproved are one planner, which
// takes the entries to write from the entries shown, or from the records no decision row names, and computes the files of one commit:
// the same checks, the same bytes. Where the module file leaves a reading open, this file states the one it takes:
//
//   - `queue` is the queue's folder as Queue.folder gives it, docs/spec-freigaben/<folder>; a queue or an entry the snapshot does not
//     hold is a RangeError (entryView) or a refusal (acceptEntries, applyApproved).
//   - `current` is the section that holds now — the entry's span, every section from its anchor up to its `until` (queues.mjs spanText): MOD-spec-document's sectionText of the entry's target — the file its own row names —
//     for its anchor, with the blob of those exact bytes. Where the target does not hold the anchor — a new section, or an entry
//     that waits for its anchor — or the snapshot cannot read the target, there is none and `current` is null; `createdBy` names
//     the entry that creates the anchor.
//   - `impact` lists the names of the proposal against the names of the section that holds now, so a new section adds all of them:
//     first the names the proposal no longer holds (withdrawn), then the names it states, in its order, that the section did not
//     hold (added) or holds with another source, rule or check (changed). A name it states word for word is not listed. Each name
//     comes with the identifier of every artifact that names it, once, in the order MOD-trace-graph's requirementImpact lists them.
//   - A rationale the queue does not hold is the empty text.
//
// The planner works queue by queue, in the order of the folders' names, each in the order of its index, an entry after the entry of any queue that creates its anchor, on the target as the entries before it have
// left it:
//   - `sectionBlob` of a shown entry is the blob of the section shown beside the proposal (entryView's current.blob), checked against
//     the section as it stands when the entry is applied: of two entries that replace one section, the second is stale. For an entry
//     shown with none — it waits for its anchor — it is "": the target, as it was read, must then not hold the anchor, and the
//     entry before it that creates the anchor has written the section it replaces. An entry whose anchor the target does not hold
//     when its turn comes is refused, naming the entry that creates it, or saying that none does.
//   - A record's `section` is the blob of the section the entry replaces, as it stands when the entry is applied; a record's name is
//     spec-<queue folder>-<NN>-<the first twelve digits of the proposal's blob>.md and its text is what MOD-documents writes for
//     MOD-approvals' schema. A decision row is appended to the bytes of the queue's entscheidungen.md, which a rewrite of the table
//     would change where an earlier form of its rows stands.
//   - acceptEntries writes nothing while any entry is refused, and names every one: also an entry or a queue that the repository lacks,
//     and a proposal or a target that is gone. applyApproved refuses record by record; it takes the target, the anchor and the proposal
//     of an entry from the queue's index and refuses a record that names others or lacks a field; it leaves alone a record that a
//     decision row names, also where its entry has left the index, and a record of an entry that a decision row names; it reads the
//     product's links from docs/sources.md and the whole register from docs/sources/, so that an item names the longest title, linked
//     or not.
//   - The commit's message names the entries and, as MOD-approvals' acceptShown does, the person who accepted.

import { parseSpec, renamedRequirements, sectionText } from "../spec-document/index.mjs";
import { blobSha, lineDiff } from "../text-tools/index.mjs";
import { requirementImpact, storedGraph, storedReferences, traceGraph } from "../trace-graph/index.mjs";
import { readDocument, writeDocument } from "../documents/index.mjs";
import { approvalSchema } from "../approvals/index.mjs";
import { sourceFindings, sourceSchemas } from "../source-register/index.mjs";
import { queuesAt, queues, replaceSpan, spanText } from "./queues.mjs";

// Whether a requirement stated by the proposal is another than the one the section holds under its name: its source, rule or check.
const differs = (was, is) => was.source !== is.source || was.rule !== is.rule || was.check !== is.check;

// The trace graph of a snapshot, built once for as long as the snapshot object lives (a snapshot is one repository at one commit and does not change), so that N open entries of one snapshot build one graph
// and not N: entryView's signature is unchanged. The promise is kept, so that entries asked at once share the build; a build that failed is not kept, and the next call builds it again.
const GRAPHS = new WeakMap();
export function graphOf(snapshot) {
  if (!GRAPHS.has(snapshot)) {
    const built = traceGraph(snapshot);
    GRAPHS.set(snapshot, built);
    built.catch(() => { if (GRAPHS.get(snapshot) === built) GRAPHS.delete(snapshot); });
  }
  return GRAPHS.get(snapshot);
}

// The impact list of a proposal against the section that holds now (both texts, "" for none): every name withdrawn, added or
// changed, with the identifiers of the artifacts that name it. The graph is the one stored for the snapshot's commit, read only when a name is
// touched; a page never builds it.
// `elsewhere` (the requirements the whole target holds, by name) is given where the section that holds now is none — the entry's anchor is not in the target: a name the target already holds is then no addition,
// it is changed when its source, rule or check differs from the target's, and not named otherwise.
// `build` is proposeSection's alone: where no graph is stored for the snapshot's commit — the head a job has just committed on —, the graph is built from the snapshot (graphOf).
export async function impactOf(snapshot, before, after, elsewhere = null, build = false) {
  const was = parseSpec(before).requirements, is = parseSpec(after).requirements;
  const { withdrawn, added } = renamedRequirements(before, after);
  const named = [
    ...withdrawn.map((name) => ({ name, change: "withdrawn" })),
    ...[...is.keys()].flatMap((name) => {
      if (added.includes(name) && elsewhere?.has(name)) return differs(elsewhere.get(name), is.get(name)) ? [{ name, change: "changed" }] : [];
      if (added.includes(name)) return [{ name, change: "added" }];
      return differs(was.get(name), is.get(name)) ? [{ name, change: "changed" }] : [];
    }),
  ];
  if (named.length === 0) return [];
  // What names each requirement, as stored beside the commit's graph (MOD-trace-graph's storedReferences: a name it holds no entry for is named by nothing); the
  // graph itself only where those are not stored.
  const stored = await storedReferences(snapshot, snapshot.commit);
  const graph = stored ? null : await storedGraph(snapshot, snapshot.commit).catch((failure) => {
    if (build && failure?.name === "GraphNotStored") return graphOf(snapshot);
    throw failure;
  });
  return named.map(({ name, change }) => ({
    name, change, referencedBy: stored ? [...(stored.get(name) ?? [])] : [...new Set(requirementImpact(graph, name).map((place) => place.id))],
  }));
}

// The entry `entry` of the queue `queue` that the snapshot holds, with the target's text, the section or span of the target that holds now (null where the target lacks the anchor or cannot be read) and the
// proposal's text. `fnName` names the caller in the RangeError for a queue or an entry the snapshot does not hold. It reads no rationale, and with `issues` false the queue's
// entries give no issue, so that none is read for it either.
async function entryTexts(fnName, queue, entry, snapshot, issues = true) {
  const [found] = await queuesAt(snapshot, [queue], { issues });
  const item = found?.entries.find((candidate) => candidate.number === entry);
  if (!item) throw new RangeError(`${fnName}: the snapshot holds no entry ${entry} of the queue ${queue}`);
  const targetText = await snapshot.read(item.file);
  const heldNow = typeof targetText === "string" ? spanText(targetText, item.anchor, item.until) : null;
  const proposalText = item.proposal.path ? (await snapshot.read(item.proposal.path)) ?? "" : "";
  return { item, targetText, heldNow, proposalText };
}

/**
 * entryImpact(queue: string, entry: number, snapshot: Snapshot) -> Promise<Array<{ name: string, change: "changed" | "withdrawn" | "added",
 *   referencedBy: string[] }>> — what one entry changes, withdraws or adds, each requirement with what names it, from the entry's queue, its target
 * and its proposal (MOD-spec-changes, Interfaces); it reads no rationale. Crosses the network and fails as queues does; a queue or an entry the
 * snapshot does not hold is a RangeError.
 */
export async function entryImpact(queue, entry, snapshot) {
  return impactOfTexts(snapshot, await entryTexts("entryImpact", queue, entry, snapshot, false));
}

// The one definition of an entry's impact list, from the texts entryTexts read: entryImpact gives it, and entryView gives it from the texts it has read already, so that no file is read twice.
const impactOfTexts = (snapshot, { targetText, heldNow, proposalText }) =>
  impactOf(snapshot, heldNow ?? "", proposalText, heldNow === null && typeof targetText === "string" ? parseSpec(targetText).requirements : null);

/**
 * entryView(queue: string, entry: number, snapshot: Snapshot) -> Promise<{ current: { text: string, blob: string } | null,
 *   proposal: { text: string, blob: string }, difference: DiffLine[], rationale: string, impact: Array<{ name: string,
 *   change: "changed" | "withdrawn" | "added", referencedBy: string[] }>, state: string, createdBy: { queue: string, entry: number } | null, issue: { number: number, product: string } | null }> — what the
 * reviewer sees (MOD-spec-changes, Interfaces): the section that holds now beside the proposal, their difference, the rationale
 * and the impact list as entryImpact gives it (NO PROPOSAL WITHOUT THE CURRENT TEXT BESIDE IT, A REQUIREMENT IS NOT CHANGED WITHOUT AN IMPACT LIST).
 */
export async function entryView(queue, entry, snapshot) {
  const texts = await entryTexts("entryView", queue, entry, snapshot);
  const { item, heldNow, proposalText } = texts;
  const rationale = item.rationale ? (await snapshot.read(item.rationale)) ?? "" : "";
  return {
    current: heldNow === null ? null : { text: heldNow, blob: await blobSha(heldNow) },
    proposal: { text: proposalText, blob: item.proposal.blob },
    difference: lineDiff(heldNow ?? "", proposalText),
    rationale,
    impact: await impactOfTexts(snapshot, texts),
    state: item.state,
    createdBy: item.createdBy,
    issue: item.issue,
  };
}

// ---------------------------------------------------------------- accepting

const APPROVALS = "docs/approvals/";
const SPEC_RECORD = /^docs\/approvals\/spec-[^/]+\.md$/;
const SPEC_KEYS = ["kind", "queue", "entry", "proposal", "blob", "target", "anchor", "section"];
// The record a row of entscheidungen.md names, approval:<file> in its fourth cell (MOD-spec-changes, Data).
const DECISION_REFERENCE = /\|\s*approval:([^\s|]+)\s*\|/g;
const pad2 = (number) => String(number).padStart(2, "0");

// The row appended to a queue's entscheidungen.md: when, the entry, the decision, the record (MOD-spec-changes, Data).
const decisionRow = (number, recordFile, now) => `| ${now.toISOString().slice(0, 16).replace("T", " ")} UTC | ${number} | uebernommen | approval:${recordFile} |\n`;

// The files of one acceptance, computed from `snapshot` alone. items: the entries to write, each { queue, entry, proposalBlob,
// sectionBlob, record: the record's path, claims?: what a committed record says of its entry }; loaded: the queues of the snapshot by
// folder; sources: the product's links and the register; verb: how the reviewer knew the text ("shown", "approved"); records: whether
// the records are written too. -> { files: Map(path -> text), applied: [{ item, id }], refused: [{ item, reason }] }
async function plan(snapshot, loaded, items, { sources, now, verb, records }) {
  const texts = new Map(), initial = new Map(), changed = new Set(), files = new Map(), applied = [], refused = [];
  const get = async (path) => {
    if (!texts.has(path)) {
      const text = await snapshot.read(path);
      texts.set(path, text);
      initial.set(path, text);
    }
    return texts.get(path);
  };
  const put = (path, text) => { texts.set(path, text); changed.add(path); };
  const refuse = (item, reason) => refused.push({ item, reason });

  // The items queue by queue, in the order of their folders and each in the order of its index; an item whose anchor another item's entry creates
  // goes after that item, wherever its queue stands.
  const position = (item) => loaded.get(item.queue)?.entries.findIndex((each) => each.number === item.entry) ?? -1;
  const sorted = [...items].sort((a, b) => (a.queue === b.queue ? position(a) - position(b) : a.queue < b.queue ? -1 : 1));
  const creatorIn = (item) => {
    const by = loaded.get(item.queue)?.entries.find((each) => each.number === item.entry)?.createdBy ?? null;
    return by && sorted.find((other) => other.queue === by.queue && other.entry === by.entry);
  };
  const ordered = [];
  const place = (item, seen = new Set()) => {
    if (ordered.includes(item) || seen.has(item)) return;
    seen.add(item);
    const creator = creatorIn(item);
    if (creator) place(creator, seen);
    ordered.push(item);
  };
  for (const item of sorted) place(item);

  const rows = new Map();
  for (const item of ordered) {
    const folder = item.queue;
    const queue = loaded.get(folder) ?? null;
    if (queue === null) { refuse(item, `the queue ${folder} is not in the repository`); continue; }
    const entry = queue.entries.find((each) => each.number === item.entry);
    if (!entry) { refuse(item, "the entry is no longer in the queue's index"); continue; }
    if (entry.decision !== null) { refuse(item, "already written into the SPEC"); continue; }
    const claims = item.claims;
    if (claims && claims.anchor !== entry.anchor) { refuse(item, `the record's anchor “${claims.anchor}” is not the queue's anchor “${entry.anchor}” for entry ${pad2(entry.number)}`); continue; }
    if (claims && claims.target !== entry.file) { refuse(item, `the record names the target ${claims.target}, not the entry's ${entry.file}`); continue; }
    if (claims && claims.proposal !== entry.proposal.path) { refuse(item, `the record names the proposal ${claims.proposal}, not the entry's ${entry.proposal.path}`); continue; }
    const proposal = entry.proposal.path ? await get(entry.proposal.path) : null;
    if (typeof proposal !== "string") { refuse(item, "the proposal no longer exists"); continue; }
    if (entry.proposal.blob !== item.proposalBlob) { refuse(item, `the proposal changed after it was ${verb} — open it again`); continue; }
    const unsourced = sourceFindings([...parseSpec(proposal).requirements.values()], sources.links, sources.register);
    if (unsourced.length) {
      refuse(item, `a requirement of its proposal names no source the product links: ${unsourced.map((each) => `${each.artifact} (${each.what})`).join("; ")}`);
      continue;
    }
    const spec = await get(entry.file);
    if (typeof spec !== "string") { refuse(item, `the target ${entry.file} does not exist`); continue; }
    const before = spanText(spec, entry.anchor, entry.until);
    if (before === null) {
      const by = entry.createdBy;
      const named = by === null ? null : `entry ${pad2(by.entry)}${by.queue === folder ? "" : ` of the queue ${by.queue.split("/").pop()}`}`;
      refuse(item, by === null ? `its heading “${entry.anchor}” is not in ${entry.file}, and no entry of the queue creates it`
        : `its heading “${entry.anchor}” is created by ${by.queue === folder ? `${named} of the queue` : named} — it goes only with or after ${named}`);
      continue;
    }
    if (item.sectionBlob === "") {
      if (sectionText(initial.get(entry.file), entry.anchor) !== null) {
        refuse(item, `the SPEC holds the section “${entry.anchor}”, which was not shown beside it — the section changed after it was ${verb} — open it again`);
        continue;
      }
    } else if (await blobSha(before) !== item.sectionBlob) {
      refuse(item, `the SPEC section changed after it was ${verb} — open it again`);
      continue;
    }
    put(entry.file, replaceSpan(spec, entry.anchor, entry.until, proposal));
    const recordFile = item.record.slice(APPROVALS.length);
    if (records) {
      files.set(item.record, writeDocument(approvalSchema, { fields: { kind: "spec", queue: queue.folder, entry: pad2(entry.number),
        proposal: entry.proposal.path, blob: item.proposalBlob, target: entry.file, anchor: entry.anchor, section: await blobSha(before) } }));
    }
    rows.set(folder, [...(rows.get(folder) ?? []), decisionRow(entry.number, recordFile, now)]);
    applied.push({ item, id: `spec-${folder.split("/").pop()}-${pad2(entry.number)}` });
  }
  for (const [folder, added] of [...rows].sort(([a], [b]) => (a < b ? -1 : 1))) {
    const decisions = (await get(`${folder}/entscheidungen.md`)) ?? "";
    put(`${folder}/entscheidungen.md`, (decisions && !decisions.endsWith("\n") ? `${decisions}\n` : decisions) + added.join(""));
  }
  for (const path of changed) files.set(path, texts.get(path));
  return { files, applied, refused };
}

/**
 * acceptEntries(host: Host, shown: Array<{ queue: string, entry: number, proposalBlob: string, sectionBlob: string }>, person: string,
 *   now: Date, sources: { links: Document, register: Document[] }) -> Promise<{ commit: string } | { refused: Array<{ queue: string,
 *   entry: number, reason: string }> }> — accepts the entries shown in one commit on the default branch of the host, on the head it
 * read, with the token the host was connected with, so under the person's account: for each, in the order of its queue's index, its
 * approval record, the target's section replaced by the proposal byte for byte, and its decision row (A QUEUE IS ACCEPTED IN ITS
 * ORDER). While any entry is refused — its proposal or section no longer has the blob that was shown, a requirement of its proposal
 * names no source the product links, its anchor is created by an entry that is not accepted with it — nothing is written, and every
 * such entry is named with the reason. Nothing shown is a TypeError. Crosses the network, through the host; fails with its failures,
 * unchanged — Moved, SecretRefused, TokenRefused, PermissionMissing, RateLimited, Unreachable —, and writes nothing then.
 */
export async function acceptEntries(host, shown, person, now, sources) {
  if (!Array.isArray(shown) || shown.length === 0) throw new TypeError("acceptEntries: nothing is shown");
  const { defaultBranch } = await host.repositoryInfo();
  const head = await host.readSnapshot(defaultBranch);
  const folders = [...new Set(shown.map(({ queue }) => queue))];
  // One read of all the queues, so that a file they share, the target above all, is read once.
  const read = await queuesAt(head, folders);
  const loaded = new Map(folders.map((folder, at) => [folder, read[at]]));
  const items = shown.map(({ queue, entry: number, proposalBlob, sectionBlob }) => ({ queue, entry: number, proposalBlob, sectionBlob,
    record: `${APPROVALS}spec-${queue.split("/").pop()}-${pad2(number)}-${String(proposalBlob).slice(0, 12)}.md` }));
  const { files, applied, refused } = await plan(head, loaded, items, { sources, now, verb: "shown", records: true });
  if (refused.length) return { refused: refused.map(({ item, reason }) => ({ queue: item.queue, entry: item.entry, reason })) };
  const message = `accept ${applied.map(({ id }) => id).join(", ")} (Agent M dashboard)\n\nAccepted by ${person}.\n`;
  const { commit } = await host.commitFiles({ branch: defaultBranch, expectedHead: head.commit,
    files: [...files].map(([path, text]) => ({ path, text })), message });
  return { commit };
}

// The product's links and the instance's register, read from docs/sources.md and every entry directly under docs/sources/.
async function sourcesOf(snapshot) {
  const { entry: entrySchema, links: linksSchema } = sourceSchemas();
  const links = readDocument(linksSchema, "docs/sources.md", (await snapshot.read("docs/sources.md")) ?? "");
  const paths = snapshot.paths.filter((path) => /^docs\/sources\/[^/]+\.md$/.test(path));
  const register = await Promise.all(paths.map(async (path) => readDocument(entrySchema, path, (await snapshot.read(path)) ?? "")));
  return { links, register };
}

/**
 * applyApproved(snapshot: Snapshot, now: Date) -> Promise<{ files: Record<string, string>, applied: string[], refused: Array<{
 *   record: string, reason: string }> }> — for every record of kind spec under docs/approvals/ that no decision row names, and whose
 * entry no decision row names, and whose queue the snapshot holds, queues in the order of their folders' names and each in the order of its index: the same checks as acceptEntries makes —
 * the proposal and the section still have the blobs the record names, the record's anchor, target and proposal are its entry's,
 * every requirement of the proposal names a source the repository links — and the same bytes: the target with the section replaced
 * and the queue's decisions with the row appended. `applied` names the records applied, `refused` the others with the reason; a
 * record that fails a check changes nothing. It writes nothing itself: the instance's workflow commits `files`.
 */
export async function applyApproved(snapshot, now) {
  const read = await queues(snapshot);
  const decided = new Set();
  for (const queue of read) {
    const rows = (await snapshot.read(`${queue.folder}/entscheidungen.md`)) ?? "";
    for (const row of rows.matchAll(DECISION_REFERENCE)) decided.add(`${APPROVALS}${row[1]}`);
  }
  const loaded = new Map(read.map((queue) => [queue.folder, queue]));
  const items = [], refused = [];
  for (const path of snapshot.paths) {
    if (!SPEC_RECORD.test(path) || decided.has(path)) continue;
    const fields = readDocument(approvalSchema, path, (await snapshot.read(path)) ?? "").fields;
    if (fields.kind !== "spec") continue;
    const missing = SPEC_KEYS.filter((key) => !fields[key]);
    if (missing.length) { refused.push({ record: path, reason: `the record lacks ${missing.join(", ")}` }); continue; }
    const number = /^\d+$/.test(fields.entry) ? Number(fields.entry) : null;
    if (number === null) { refused.push({ record: path, reason: `the record's entry “${fields.entry}” is not a number` }); continue; }
    const queue = fields.queue.replace(/\/+$/, "");
    // A record whose queue the snapshot does not hold is not applied: its queue's decisions are in the history (THE REPLACED TEXT STAYS REACHABLE).
    if (!loaded.has(queue) || loaded.get(queue).entries.find((each) => each.number === number)?.decision) continue;
    items.push({ queue, entry: number, proposalBlob: fields.blob, sectionBlob: fields.section, record: path,
      claims: { anchor: fields.anchor, target: fields.target, proposal: fields.proposal } });
  }
  const done = await plan(snapshot, loaded, items, { sources: await sourcesOf(snapshot), now, verb: "approved", records: false });
  return { files: Object.fromEntries(done.files), applied: done.applied.map(({ item }) => item.record),
    refused: [...refused, ...done.refused.map(({ item, reason }) => ({ record: item.record, reason }))] };
}
