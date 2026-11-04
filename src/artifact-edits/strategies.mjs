// strategies.mjs — the check and the writer of editStrategies (MOD-artifact-edits, Parts; Interfaces: editStrategies): the check
// `identifier-kept` and the writer `open-files`. ITM-336 builds them; the recipe `items-of-kind` (UC-021) is ITM-723's.
//
// Module: MOD-artifact-edits
//
// A REVIEWED ARTIFACT ENTERS THE DEFAULT BRANCH AS OPEN; A GENERATED ARTIFACT IS A PROPOSAL; THE NAME IS THE ID AND IT SURVIVES; AN EDITED
// FILE KEEPS ITS IDENTIFIER; AN ARTIFACT RECORDS THE VERSION THAT PRODUCED IT. Strategies, JobContext, JobResult and WriteOutcome are
// MOD-job-runner's types. The writer reads the head it commits on at the time it is called, through the product's host. Where the module
// file leaves a reading open, this file states the one it takes:
//
//   - A class of the result refers to a drafted file by its `path` (`refs`); a file the result's classes do not mention has the class and
//     the `of` its drafter gave it. A file classed a change or a duplicate of an identifier whose file the head holds is written to that
//     file; one that names no such file is written as a new one.
//   - A new use case or decision gets the next free number of its kind, the numbers of the version history included, one after the other
//     in the order drafted; its path is `docs/use-cases/<id>-<slug>.md` or `docs/architecture/<id>-<slug>.md`, the slug that of the drafted
//     path. A new module keeps the identifier it declares, which MOD-identifiers' nextIdentifier refuses with IdentifierTaken when the
//     history holds it. Every mention of an identifier that a write replaces is replaced in every drafted text of the write.
//   - The identifiers the history holds are those in the paths of every change of the repository's history, and of the head.
//   - A requirement a use case may realise is one the head's SPEC holds. The notes read `<id> realised "<name>" which matches no
//     requirement; removed` and `<id> realises no requirement`; a note holds no comma.
//   - DueDiligenceMissing carries `decisions`, each `{ path, registry }`, the registry the mark's `what` names.

import { artifactSchemaOf, readDocument } from "../documents/index.mjs";
import { kindOfIdentifier, nextIdentifier } from "../identifiers/index.mjs";
import { parseSpec } from "../spec-document/index.mjs";
import { traceGraph } from "../trace-graph/index.mjs";
import { finding } from "../text-tools/index.mjs";
import { provenanceLines } from "../job-runner/index.mjs";
import { declaredId, keptIdentifier } from "./save.mjs";

const KEPT = "AN EDITED FILE KEEPS ITS IDENTIFIER";
const DUE_DILIGENCE = "A REUSE DECISION RECORDS ITS DUE DILIGENCE";
const FOLDER = { UC: "docs/use-cases/", ARC: "docs/architecture/", MOD: "docs/architecture/" };

const failure = (name, message, fields) => Object.assign(new Error(message), { name, ...fields });
const escaped = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// The identifier a reviewed file's path names — UC-<nnn>, ARC-<nnn> before the slug, MOD-<slug> as the file's name — or null.
function idOfPath(path) {
  const name = path.split("/").pop() ?? "";
  const numbered = /^((?:UC-\d{3,}|ARC-\d{3}))-/.exec(name);
  if (numbered) return numbered[1];
  const module_ = /^(MOD-[a-z0-9]+(?:-[a-z0-9]+)*)\.md$/.exec(name);
  return module_ ? module_[1] : null;
}
const slugOfPath = (path, id) => (path.split("/").pop() ?? "").replace(new RegExp(`^${escaped(id)}-?`), "").replace(/\.md$/, "");

// The path of the file of an identifier on the head, or null.
function pathOf(head, id) {
  const kind = kindOfIdentifier(id);
  if (!FOLDER[kind]) return null;
  return head.paths.find((path) => path.startsWith(FOLDER[kind]) && idOfPath(path) === id) ?? null;
}

// The line of the front matter's `id`, or 1.
const idLine = (text) => Math.max(1, text.split(/\r?\n/).findIndex((line) => /^id:/.test(line)) + 1);

// The head of the default branch, through the product's host.
async function headOf(host) {
  const { defaultBranch } = await host.repositoryInfo();
  return { branch: defaultBranch, head: await host.readSnapshot(defaultBranch) };
}

/**
 * identifier-kept — an error finding for each drafted change of an existing file that carries another identifier than the file it
 * changes, naming the identifier to keep. A file is a change of an existing file when its drafter classed it a change or a duplicate of an
 * identifier whose file the head holds, or when its path is the path of a file the head holds and it is not classed new.
 */
async function identifierKept(draft, context) {
  const files = Array.isArray(draft?.files) ? draft.files : [];
  const head = context.product.snapshot ?? (await headOf(context.product.host)).head;
  const found = [];
  for (const { path, text, class: cls, of } of files) {
    const keep = ["change", "duplicate"].includes(cls) && of && pathOf(head, of) ? of : cls !== "new" && head.paths.includes(path) ? idOfPath(path) : null;
    if (!keep) continue;
    const now = declaredId(path, text);
    if (now !== keep) {
      found.push(finding({ artifact: path, line: idLine(text), kind: "error", rule: KEPT,
        what: `the change of ${keep} carries the identifier ${now ?? "none"}`, fix: `keep the identifier ${keep}` }));
    }
  }
  return found;
}

// The front matter's `realises` list without the names that no requirement matches: { text, removed }.
function withoutUnknownNames(text, known) {
  const lines = text.split("\n");
  const end = lines[0] === "---" ? lines.indexOf("---", 1) : -1;
  const at = end < 0 ? -1 : lines.findIndex((line, i) => i < end && /^realises:[ \t]*$/.test(line));
  if (at < 0) return { text, removed: [], left: null };
  const removed = [], kept = [];
  let i = at + 1;
  for (; i < end && /^[ \t]+-[ \t]/.test(lines[i]); i++) {
    const name = lines[i].replace(/^[ \t]+-[ \t]+/, "").trim();
    if (known.has(name)) kept.push(lines[i]); else removed.push(name);
  }
  return { text: [...lines.slice(0, at + 1), ...kept, ...lines.slice(i)].join("\n"), removed, left: kept.length };
}

/**
 * open-files — commits the drafted use cases or architecture files in one commit on the default branch, as open files: a change to an
 * existing identifier into its file, a new one under the next free identifier of its kind, never one the history holds; a drafted module
 * whose identifier the history holds is refused (IdentifierTaken). Returns MOD-job-runner's WriteOutcome; commits nothing, and returns
 * an outcome without a commit, when every file already stands on the head byte for byte. Throws DueDiligenceMissing { decisions } and
 * writes nothing while a step finding marks a drafted decision whose registry could not be read.
 */
async function openFiles(result, context) {
  const drafts = result.draft.files;
  const marks = (result.stepFindings ?? []).filter((each) => each.kind === "error" && each.rule === DUE_DILIGENCE && drafts.some((file) => file.path === each.artifact));
  if (marks.length > 0) {
    const decisions = [...new Map(marks.map((mark) => [mark.artifact, { path: mark.artifact, registry: /registry (\S+) could not be read/.exec(mark.what)?.[1] ?? null }])).values()];
    throw failure("DueDiligenceMissing", `The due diligence is missing for ${decisions.map((each) => each.path).join(", ")}; nothing was written.`, { decisions });
  }
  const host = context.product.host;
  const { branch, head } = await headOf(host);
  const used = new Set(head.paths.map(idOfPath).filter(Boolean));
  for (const entry of await host.readHistory(null, { ref: branch })) {
    for (const { path, from } of entry.changes) for (const each of [path, from]) if (each && idOfPath(each)) used.add(idOfPath(each));
  }
  const spec = parseSpec((await head.read("SPEC.md")) ?? "");
  const known = new Set(spec.requirements.keys());

  // Where each drafted file goes, and under which identifier.
  const plan = drafts.map((file) => {
    const given = result.classes?.find((each) => each.refs.includes(file.path));
    const cls = given?.class ?? file.class, of = given ? given.of : (file.of ?? null);
    const declared = declaredId(file.path, file.text) ?? idOfPath(file.path);
    const kind = kindOfIdentifier(declared ?? "") ?? kindOfIdentifier(idOfPath(file.path) ?? "");
    if (!FOLDER[kind]) throw new TypeError(`${file.path} is no use case, architecture decision or module file`);
    const existing = ["change", "duplicate"].includes(cls) && of ? pathOf(head, of) : null;
    if (existing) return { file, declared, kind, id: of, path: existing };
    if (kind === "MOD") {
      const id = nextIdentifier("MOD", used, declared.replace(/^MOD-/, ""));
      used.add(id);
      return { file, declared, kind, id, path: `${FOLDER.MOD}${id}.md` };
    }
    const id = nextIdentifier(kind, used);
    used.add(id);
    return { file, declared, kind, id, path: `${FOLDER[kind]}${id}-${slugOfPath(file.path, declared) || "draft"}.md` };
  });

  // The identifiers a write replaces, replaced in every text of it in one pass.
  const renamed = new Map(plan.filter((each) => each.declared && each.declared !== each.id).map((each) => [each.declared, each.id]));
  const rename = (body) => (renamed.size === 0 ? body : body.replace(new RegExp(`(?<![A-Za-z0-9-])(${[...renamed.keys()].map(escaped).join("|")})(?![A-Za-z0-9-])`, "g"), (id) => renamed.get(id)));
  const notes = [], written = new Map();
  for (const { file, kind, id, path } of plan) {
    let body = keptIdentifier(rename(file.text), id);
    if (kind === "UC") {
      const { text: cleaned, removed, left } = withoutUnknownNames(body, known);
      body = cleaned;
      // A note is one item of the End's `results`, in which a comma separates items: it holds none, a comma of the name shown as a semicolon.
      for (const name of removed) notes.push(`${id} realised "${name.replaceAll(",", ";")}" which matches no requirement; removed`);
      if (left === 0) notes.push(`${id} realises no requirement`);
    }
    if ((await head.read(path)) !== body) written.set(path, body);
  }
  if (written.size === 0) return { commits: [], files: [], pullRequest: null, shown: null, notes };
  const files = [...written].map(([path, text]) => ({ path, text }));
  const lines = provenanceLines({ agentM: context.agentM, jobId: context.jobId, kind: context.kind.name, participant: result.drafter ?? { name: "none", model: null },
    rounds: result.rounds.length, instruction: context.params?.instruction ?? null });
  const names = files.map((file) => idOfPath(file.path)).join(", ");
  const { commit } = await host.commitFiles({ branch, expectedHead: head.commit, files, message: `draft ${names} as open files\n\n${lines.join("\n")}` });
  return { commits: [commit], files: files.map((file) => file.path), pullRequest: null, shown: null, notes };
}

// The kind of node, in MOD-trace-graph's graph, that the group file of each kind arranges (as the check group-rules reads them).
const ARRANGED = { requirements: "requirement", "use-cases": "UC", architecture: "ARC", modules: "MOD", tests: "TST" };

/**
 * recipe items-of-kind — for the kind the job's parameter `kind` names (requirements, use-cases, architecture, modules or tests), two parts: `the <kind>`, one line
 * `- <identifier> — <title>` for each item of that kind in the product's graph, sorted by identifier — an item with no title, a test, is `- <identifier>`; a requirement is
 * `- <name>` with its whole text on the lines after it, MOD-spec-document's parseSpec giving the rule —; and, where the product has one, `docs/groups/<kind>.md`, the group
 * file as it stands. Reads the product's snapshot. An unknown kind gives no part.
 */
async function itemsOfKind(context, params) {
  const kind = params?.kind ?? context.params?.kind;
  if (!Object.hasOwn(ARRANGED, kind)) return [];
  const { snapshot } = context.product;
  const rules = kind === "requirements" ? new Map([...parseSpec((await snapshot.read("SPEC.md")) ?? "").requirements].map(([name, each]) => [name, each.rule])) : null;
  const nodes = [...(await traceGraph(snapshot)).nodes.values()].filter((node) => node.kind === ARRANGED[kind])
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const lines = nodes.flatMap((node) => [`- ${node.id}${node.title ? ` — ${node.title}` : ""}`, ...(rules ? [String(rules.get(node.id) ?? "").trim()].filter(Boolean) : [])]);
  const parts = [{ name: `the ${kind}`, text: `${lines.join("\n")}${lines.length ? "\n" : ""}`, size: 0, sources: [], required: true }];
  const path = `docs/groups/${kind}.md`;
  const group = await snapshot.read(path);
  if (group !== null && group !== undefined) parts.push({ name: path, text: group, size: 0, sources: [], required: true });
  return parts;
}

/** editStrategies — the strategies this module offers the job runner (ARC-046). */
export const editStrategies = { recipes: { "items-of-kind": itemsOfKind }, checks: { "identifier-kept": identifierKept }, preconditions: {}, steps: {}, writers: { "open-files": openFiles } };
