// spec-entries.mjs — the service the descriptor of the SPEC change entries names (MOD-review-pages, Parts): what the one review flow in flow.mjs
// asks of a kind whose files are the entries of a change queue — their groups and states, one entry with its sections, and the acceptance through
// MOD-spec-changes' acceptEntries, and the rejection of one entry through its rejectEntry. It draws no page of its own; flow.mjs does.
//
// Module: MOD-review-pages
//
// A QUEUE IS ACCEPTED IN ITS ORDER; A STALE APPROVAL IS NOT APPLIED; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK. Every state comes from
// MOD-spec-changes' queues and entryView; nothing is written here but by acceptEntries and rejectEntry. An entry is addressed as spec-<queue folder>-<NN>, the form of
// its approval record.

import { queues, entryView, acceptEntries, rejectEntry } from "../spec-changes/index.mjs";
import { sectionText } from "../spec-document/index.mjs";
import { blobSha } from "../text-tools/index.mjs";
import { sourceSchemas } from "../source-register/index.mjs";
import { approvalSchema } from "../approvals/index.mjs";
import { readDocument, writeDocument } from "../documents/index.mjs";
import { entrySections } from "./sections.mjs";
import { el } from "./common.mjs";

const ENTRY_PREFIX = "spec-";
const pad2 = (number) => String(number).padStart(2, "0");
const shortOf = (folder) => folder.slice(folder.lastIndexOf("/") + 1);
// The identifier of an entry by the folder of its queue and its number, the form of its approval record.
export const entryId = (folder, number) => `${ENTRY_PREFIX}${shortOf(folder)}-${pad2(number)}`;
const idOf = (queue, number) => entryId(queue.folder, number);
// An entry a person may accept: one that no record or decision decides.
const acceptable = (item) => item.state === "open" || item.state === "stale";
// An entry a person may tick: also one that waits for its anchor, which goes with the entry that creates it.
const tickable = (item) => acceptable(item) || item.state === "waiting for its anchor";
// The rows Review all shows: the entries a click may accept, and those that wait for an anchor an entry of the sequence creates. rows: { id, state, after }.
const sequenceOf = (rows) => {
  const inside = new Set(rows.filter((row) => row.state === "open" || row.state === "stale").map((row) => row.id));
  for (let grew = true; grew;) {
    grew = false;
    for (const row of rows) if (row.state === "waiting for its anchor" && row.after && inside.has(row.after) && !inside.has(row.id)) { inside.add(row.id); grew = true; }
  }
  return rows.filter((row) => inside.has(row.id));
};
const shownOf = (queue, item, view) => ({ queue: queue.folder, entry: item.number, proposalBlob: view.proposal.blob, sectionBlob: view.current?.blob ?? "" });
// The tick of the list: the proposal's blob from the queue's tree, the section that holds now from its target read once (no impact list).
const tickOf = async (queue, item, readOnce) => {
  const targetText = await readOnce(item.file);
  const heldNow = typeof targetText === "string" ? sectionText(targetText, item.anchor) : null;
  return { queue: queue.folder, entry: item.number, proposalBlob: item.proposal.blob, sectionBlob: heldNow === null ? "" : await blobSha(heldNow) };
};

// The files the entry page reads from `snapshot` for its sources: the product's links file and, on a page that shows the instance itself, the register beside it.
const LINKS = "docs/sources.md";
const isRegisterEntry = (path) => /^docs\/sources\/[^/]+\.md$/.test(path);
const sourcePaths = (snapshot, context) => [LINKS, ...(context.product ? [] : snapshot.paths.filter(isRegisterEntry))];

// The product's links and the instance's register, which acceptEntries checks every requirement's source against. A caller that holds the instance's snapshot already
// passes it as `instanceSnapshot`, and it is not built again; every other caller builds it here.
export async function sourcesOf({ snapshot, context, instanceSnapshot }) {
  const { entry: entrySchema, links: linksSchema } = sourceSchemas();
  let holder = snapshot;
  if (context.product) {
    if (instanceSnapshot) holder = instanceSnapshot;
    else {
      const { defaultBranch } = await context.instance.host.repositoryInfo();
      holder = await context.instance.host.readSnapshot(defaultBranch);
    }
  }
  const links = readDocument(linksSchema, LINKS, (await snapshot.read(LINKS)) ?? "");
  const registerPaths = holder.paths.filter(isRegisterEntry);
  // A product's register stands in the instance's snapshot, which no read of this page has asked for yet: its files in one batch (on the instance's own page the entry page's batch holds them).
  if (context.product && registerPaths.length) await holder.readMany?.(registerPaths);
  const register = await Promise.all(registerPaths
    .map(async (path) => readDocument(entrySchema, path, (await holder.read(path)) ?? "")));
  return { links, register };
}

// One entry as its page draws it: its sections beside the other proposals on the same section and its queue's order, what holds it back or what a click accepts.
async function described(all, queue, item, snapshot, context, hrefOf) {
  const id = idOf(queue, item.number);
  const view = await entryView(queue.folder, item.number, snapshot);
  const others = all.flatMap((other) => other.entries.filter((each) => idOf(other, each.number) !== id && each.anchor === item.anchor && each.state !== "in SPEC")
    .map((each) => ({ id: idOf(other, each.number), state: each.state })));
  const order = queue.entries.map((each) => ({ number: each.number, anchor: each.anchor, state: each.state }));
  const result = { title: `${shortOf(queue.folder)} · entry ${pad2(item.number)}`, status: view.state.replaceAll(" ", "-"), label: view.state,
    nodes: entrySections(view, others, order, hrefOf), hold: null, shown: null, record: null, edit: view.state === "open" };
  if (view.state === "waiting for its anchor") {
    result.shown = [shownOf(queue, item, view)];
    result.hold = el("p", "waits", view.createdBy === null ? "Its heading is in no entry of the queue: it cannot be accepted."
      : `It goes only with or after entry ${pad2(view.createdBy)}, which creates its heading: accept them together.`);
    return result;
  }
  if (!acceptable(item)) return result;
  result.shown = [shownOf(queue, item, view)];
  // Without a token the instance's own SPEC is written by its workflow from the record alone; a product has no such workflow.
  if (!context.product && view.current !== null) {
    result.record = { path: `docs/approvals/${id}-${view.proposal.blob.slice(0, 12)}.md`,
      text: writeDocument(approvalSchema, { fields: { kind: "spec", queue: queue.folder, entry: pad2(item.number), proposal: item.proposal.path,
        blob: view.proposal.blob, target: item.file, anchor: item.anchor, section: view.current.blob } }) };
  }
  return result;
}

export const queueService = {
  idOf: (each) => entryId(each.queue, each.entry),
  // Whether an approval record's identifier is a SPEC change entry's, the form entryId gives.
  owns: () => (id) => id.startsWith(ENTRY_PREFIX),
  // A product's SPEC is written with the product's own token, whichever server it is on.
  tokenRequired: (context) => Boolean(context.product),
  tokenNote: "A product's SPEC is written with the product's own token. ",
  reviewAll: true,

  // The queues, newest first, each as a group of its entries.
  async groups({ snapshot, token }) {
    const groups = [], texts = new Map();
    const readOnce = (path) => { if (!texts.has(path)) texts.set(path, snapshot.read(path)); return texts.get(path); };
    for (const queue of await queues(snapshot)) {
      const entries = [];
      for (const item of queue.entries) {
        let tick = null;
        if (token && tickable(item)) tick = await tickOf(queue, item, readOnce);
        entries.push({ after: item.createdBy === null || item.createdBy === undefined ? null : idOf(queue, item.createdBy), id: idOf(queue, item.number), name: pad2(item.number), title: item.anchor, status: item.state.replaceAll(" ", "-"), label: item.state, tick });
      }
      groups.push({ key: shortOf(queue.folder), title: queue.title || shortOf(queue.folder), entries });
    }
    return groups;
  },

  // One entry: null where no queue holds it; else its state, its sections, what holds it back, what a click accepts, and the record without a token.
  async view({ snapshot, context }, id, hrefOf) {
    const all = await queues(snapshot);
    const queue = all.find((candidate) => candidate.entries.some((item) => idOf(candidate, item.number) === id));
    const item = queue?.entries.find((each) => idOf(queue, each.number) === id);
    if (!item) return null;
    // The files the entry's page and its subject read, asked for in one batch: the target, the proposal, the rationale, and the sources the subject needs.
    await snapshot.readMany?.([item.file, item.proposal.path, item.rationale, ...sourcePaths(snapshot, context)].filter(Boolean));
    return described(all, queue, item, snapshot, context, hrefOf);
  },

  // Review all: every entry a click may accept (open, or stale) or that waits for an entry of the sequence, each as view gives it, in the order of the entries' identifiers; the files of all of them are asked for in one batch.
  async all({ snapshot, context }, hrefOf) {
    const all = await queues(snapshot);
    const rows = all.flatMap((queue) => queue.entries.map((item) => ({ queue, item, id: idOf(queue, item.number), state: item.state,
      after: item.createdBy === null ? null : idOf(queue, item.createdBy) })));
    const reviewable = sequenceOf(rows).sort((a, b) => a.id.localeCompare(b.id));
    await snapshot.readMany?.([...new Set(reviewable.flatMap(({ item }) => [item.file, item.proposal.path, item.rationale]).concat(sourcePaths(snapshot, context)).filter(Boolean))]);
    const entries = [];
    for (const { queue, item, id, after } of reviewable) entries.push({ id, after, ...(await described(all, queue, item, snapshot, context, hrefOf)) });
    return entries;
  },

  // How many entries Review all shows, from the groups of the list.
  count: (groups) => sequenceOf(groups.flatMap((group) => group.entries).map((entry) => ({ id: entry.id, state: entry.label, after: entry.after }))).length,

  // The entries of `shown` whose proposal or section is no longer what was shown, read from the default branch now: { entry, reason }.
  async changedSince({ host }, shown) {
    const { defaultBranch } = await host.repositoryInfo();
    const now = await host.readSnapshot(defaultBranch);
    const left = [];
    for (const each of shown) {
      const view = await entryView(each.queue, each.entry, now);
      if (view.proposal.blob !== each.proposalBlob || (view.current?.blob ?? "") !== each.sectionBlob) {
        left.push({ path: entryId(each.queue, each.entry), reason: "it changed after it was shown", names: [] });
      }
    }
    return left;
  },

  // The entries shown, accepted in one commit by acceptEntries; its refusal comes back as a text, the commit with nothing left out otherwise.
  async accept(where, shown, person) {
    const result = await acceptEntries(where.host, shown, person, new Date(), await sourcesOf(where));
    if (result.refused) {
      return { refusal: result.refused.map(({ queue, entry, reason }) => `entry ${pad2(entry)} of ${shortOf(queue)}: ${reason}`).join(" ") };
    }
    return { commit: result.commit, leftOut: [] };
  },

  // The entry shown, rejected with the person's reason by rejectEntry: { commit }, or, without a token, GitHub's pages { fallback }.
  reject: (where, shown, person, reason) => rejectEntry(where.host, shown, person, reason),
};
