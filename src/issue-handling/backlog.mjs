// The item prefilled from an issue and the issue moved into the backlog (MOD-issue-handling, Parts: backlog.mjs; Interfaces: backlogItemFrom, moveToBacklog), as UC-033 steps 2 to 4 and 4a, 4b state them.
//
// Module: MOD-issue-handling
//
// Where the module file leaves a reading open, this file states the one it takes:
//   - `backlogItemFrom` gives `{ item: { fields, sections } }`, the form MOD-work-plans' `saveItems` takes: the fields title, level (module), realises, modules, tests (unit) and origin (the issue's address), and the sections ## Outcome (the issue's text,
//     its comments not among it) and ## Acceptance. `NotClassified` is thrown for every class but bug and change (UC-033, Precondition: "classified as *bug* or *change*").
//   - `moveToBacklog` reads the default branch's head and the module files of the architecture itself, since its interface gives neither. The item is committed by `saveItems` first, then the comment, then the label. The comment is MOD-mail-records'
//     `noteText("item-added", <item>, <date>, <link>)`; the link is the item file's page on the product's server (`webLinks().file`), since the module knows no instance, and so no address on the dashboard.
//   - A comment refused for want of the permission (`PermissionMissing`), or for want of a token (`NotSupported`, which MOD-repository-hosts' commentOnIssue gives only without a token, before any request), returns `{ item, comment: { text, issue } }` and sets no
//     label (a token that may not comment may not label): UC-033 4b names both, "No token for the issue tracker is stored, or the token may not comment". Any other failure of the comment or of the label passes unchanged, the item being committed
//     already. With `existing`, the item of that identifier is rewritten with the issue's address added to its origins, and the `item` given is not used; an identifier the backlog lacks is `NotFound { path }`, with nothing written.
//   - The module files, the items and their identifiers are read through MOD-documents (ITM-1298): a path is a module file or an item where `readDocument` gives it an identifier under the module or the item schema, whose path patterns those are.
//     The one folder name kept is the backlog's, `docs/backlog/`, the SPEC's own (THE BACKLOG LIVES IN THE PRODUCT REPOSITORY): an item of the schema under `docs/plan/` is a plan step, no item of the backlog. A list field is the list `readDocument` gives.

import { artifactSchemas, readDocument } from "../documents/index.mjs";
import { issueLabels, noteText } from "../mail-records/index.mjs";
import { saveItems } from "../work-plans/index.mjs";
import { IssueClass } from "./classes.mjs";

const BACKLOG = "docs/backlog/";
const ACCEPTANCE = {
  [IssueClass.bug]: "- A unit test that fails on the reported behaviour passes after the fix.",
  [IssueClass.change]: "- Unit tests guard each requirement the change names.",
};

// A failure of the module's own, by name, with the fields its message names.
const failure = (name, message, fields) => Object.assign(new Error(message), { name, ...fields });
const unique = (values) => [...new Set(values)];
// The identifier a path gives under a schema, read from the path alone: null for a file that is none of the schema's.
const identifierOf = (schema, path) => readDocument(schema, path, "").id;

/**
 * backlogItemFrom(issue, cls, analysis, changed) -> { item } — the backlog item a person checks before adding it (UC-033 step 2): its title from the issue's title, its outcome from the issue's description, its origin the issue's address, what it
 * realises — for a bug the requirement the analysis names as violated, for a change the requirements `changed` names, each once —, and the modules the analysis names. Pure; no place is given, since a backlog keeps no order of its own.
 * Errors: NotClassified for a class that is neither bug nor change — no item is offered.
 */
export function backlogItemFrom(issue, cls, analysis, changed) {
  if (cls !== IssueClass.bug && cls !== IssueClass.change) {
    throw failure("NotClassified", `Issue ${issue?.number} is not classified as a bug or a change (${String(cls)}), so no backlog item is offered; see UC-012, step 2.`, { issue: issue?.number ?? null });
  }
  const realises = cls === IssueClass.bug ? (analysis?.violated ? [analysis.violated] : []) : unique(changed ?? []);
  return {
    item: {
      fields: { title: issue.title, level: "module", realises, modules: unique(analysis?.modules ?? []), tests: ["unit"], origin: [issue.address] },
      sections: [{ heading: "## Outcome", text: `\n${String(issue.body ?? "").trim()}\n\n` }, { heading: "## Acceptance", text: `\n${ACCEPTANCE[cls]}\n` }],
    },
  };
}

/**
 * moveToBacklog(host, issue, item, existing) -> Promise<{ item: string, comment: { text: string, issue: string } | null }> — the person's one click *Add* (UC-033 step 4): the item — the one backlogItemFrom prefilled and the person checked, or, when `existing` names
 * an item, that item with this issue added to its origins — written through MOD-work-plans' saveItems; then the comment `item-added` on the issue, naming the item and its address, and the label `backlog`. When the token may not comment, the item is written all the
 * same and the comment's text and the issue's address are returned for the person to copy (UC-033 4b) — as they are when no token is stored. Crosses the network. Errors: saveItems' own — nothing is written then —, NotFound for an `existing` the backlog lacks, and the host's.
 */
export async function moveToBacklog(host, issue, item, existing) {
  const { defaultBranch } = await host.repositoryInfo();
  const snapshot = await host.readSnapshot(defaultBranch);
  const schemas = artifactSchemas();
  const architecture = await Promise.all(snapshot.paths.filter((path) => identifierOf(schemas.module, path) !== null).sort().map(async (path) => readDocument(schemas.module, path, (await snapshot.read(path)) ?? "")));

  let written = item;
  if (existing !== null && existing !== undefined) {
    const path = snapshot.paths.find((each) => each.startsWith(BACKLOG) && identifierOf(schemas.item, each) === existing);
    if (!path) throw failure("NotFound", `${existing} is no item of the backlog at ${snapshot.commit}.`, { path: `${BACKLOG}${existing}-*.md` });
    const held = readDocument(schemas.item, path, (await snapshot.read(path)) ?? "");
    const origin = [].concat(held.fields.origin ?? []);
    written = { fields: { ...held.fields, origin: origin.includes(issue.address) ? origin : [...origin, issue.address] }, sections: held.sections };
  }
  const saved = await saveItems(host, { items: [written], removed: [] }, { architecture, head: snapshot.commit, trailers: [] });
  const path = saved.written[0];
  const identifier = identifierOf(schemas.item, path);

  const text = noteText("item-added", identifier, new Date().toISOString().slice(0, 10), host.webLinks().file(path, defaultBranch));
  try {
    await host.commentOnIssue(issue.number, text);
  } catch (refused) {
    if (refused?.name !== "PermissionMissing" && refused?.name !== "NotSupported") throw refused;
    return { item: identifier, comment: { text, issue: issue.address } };
  }
  await host.setIssueLabels(issue.number, { add: [issueLabels.backlog] });
  return { item: identifier, comment: null };
}
