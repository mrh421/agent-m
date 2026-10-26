// propose.mjs — the sections a draft of requirements changes and the writer of classified candidates (MOD-spec-changes, Parts: propose.mjs; Interfaces: entrySections, specStrategies).
//
// Module: MOD-spec-changes
//
// Pure: it reads only the texts it is given, and performs no input or output. A section's bytes are MOD-spec-document's: the slice of
// the SPEC from its heading line to the next heading of level two. A draft is `{ candidates }` as the kinds derive-requirements and
// change-requirements return it, and `classes` are MOD-documents' Classified, one for the candidates merged into it, whose first ref is
// the name of the candidate whose rule and check it takes. Where the module file leaves a reading open, this file states the one it takes:
//
//   - A `new` requirement is added at the end of the section of the requirement its class's `of` names when the SPEC holds it, else of the
//     last section; with no section in the SPEC there is no place, and it is a RangeError.
//   - A `change` replaces the requirement's block by its name as it stands, the sources it states with the job's added, and the
//     candidate's rule and check, each on one line; a `duplicate` adds the job's sources to the head line and touches no other byte. A
//     `change` or a `duplicate` of a requirement the SPEC does not hold is RequirementNotFound { requirements }, naming every such name
//     in the order of the classes. The sources of the rule a candidate points to are those the requirement states: they are kept.
//   - The job's source is one item for each passage of the class, `<source>, <passage>`, or the source alone for none; an item the
//     requirement names already is not added again.
//   - A candidate without a class, and a `conflict`, are not composed: a conflict is composed as the person resolved it, that is, as the
//     class they gave it. A section whose text the draft leaves as it is is not returned; the sections come in the order of the SPEC.
//   - Two candidates change one requirement when two of the classes composed are `change` with one `of`. That is TwoChanges, thrown after
//     RequirementNotFound: its `candidates` are the names of every such candidate in the order of the classes, its `requirement` the name
//     they change (the error's own `name` is its kind, as with every error of this module). A `change` and a `duplicate` of one requirement
//     are not two changes: the duplicate adds its source to the block the change left.
//   - The line end of a section is that of its first line.

import { classifyCandidates, documentFindings, readDocument } from "../documents/index.mjs";
import { provenanceLines } from "../job-runner/index.mjs";
import { linkedVersion, sourceSchemas } from "../source-register/index.mjs";
import { fallbackEditLinks } from "../artifact-edits/fallback.mjs";
import { parseSpec, sectionText } from "../spec-document/index.mjs";
import { blobSha } from "../text-tools/index.mjs";
import { requirementImpact } from "../trace-graph/index.mjs";
import { graphOf, impactOf } from "./accept.mjs";
import { queueRationaleSchema, queues, spanText } from "./queues.mjs";

const failure = (name, message, fields) => Object.assign(new Error(message), { name, ...fields });
const folded = (text) => String(text ?? "").replace(/\s+/g, " ").trim();
const HEADING = /^#{1,6}\s/;
const SOURCE_START = "*(";
const SOURCE_END = ")*";

// The lines of a text, each with its line end.
const linesOf = (text) => text.split(/(?<=\n)/);
const isBlank = (line) => line.trim() === "";

// The requirement `name` of a section's text: the places of its first and last line in `lines`, and the requirement.
function located(sectionText_, lines, name) {
  const spec = parseSpec(sectionText_);
  const requirement = spec.requirements.get(name);
  const others = new Set([...spec.requirements.values()].map((each) => each.line - 1));
  const first = requirement.line - 1;
  let end = first + 1;
  while (end < lines.length && !isBlank(lines[end]) && !HEADING.test(lines[end]) && !others.has(end)) end++;
  return { first, end, requirement };
}

// A head line block with the items added to its source: raw source text kept, items after it; a block without a source gets one
// after its name.
function withSources(block, name, items) {
  if (items.length === 0) return block;
  const head = `**${name}**`;
  const at = block.indexOf(SOURCE_START, head.length);
  const end = at < 0 ? -1 : block.indexOf(SOURCE_END, at);
  if (end < 0) return `${head} ${SOURCE_START}${items.join("; ")}${SOURCE_END}${block.slice(head.length)}`;
  return `${block.slice(0, end).trimEnd()}; ${items.join("; ")}${block.slice(end)}`;
}

/**
 * entrySections(spec, draft, classes, source) -> Array<{ anchor, until, text }> — the sections of `spec` that the draft's candidates
 * change, each as the whole section's new text, composed by `classes`. Every other byte of a section stays as it is. Pure. Throws TwoChanges
 * { requirement, candidates } when two candidates change one requirement, and composes nothing.
 * @param {string} spec
 * @param {unknown} draft
 * @param {Array<{ refs: string[], from: string[], class: string, of: string | null }>} classes
 * @param {string} source the job's source
 */
export function entrySections(spec, draft, classes, source) {
  if (typeof source !== "string" || source.trim() === "") throw new TypeError("entrySections needs the job's source as text");
  const text = String(spec ?? "");
  const parsed = parseSpec(text);
  const drafted = Array.isArray(draft?.candidates) ? draft.candidates : [];
  const composed = (Array.isArray(classes) ? classes : []).map((each) => ({ each, candidate: drafted.find((item) => item?.name === each.refs?.[0]) }))
    .filter(({ each, candidate }) => candidate && each.class !== "conflict" && ["new", "change", "duplicate"].includes(each.class));

  const missing = composed.filter(({ each }) => each.class !== "new" && !parsed.requirements.has(each.of)).map(({ each }) => each.of);
  if (missing.length > 0) {
    const names = [...new Set(missing)];
    throw failure("RequirementNotFound", `the SPEC holds no requirement ${names.join(", ")}`, { requirements: names });
  }

  const changing = new Map();
  for (const { each, candidate } of composed) if (each.class === "change") changing.set(each.of, [...(changing.get(each.of) ?? []), candidate.name]);
  const twice = [...changing].find(([, names]) => names.length > 1);
  if (twice) {
    const [requirement, names] = twice;
    throw failure("TwoChanges", `${names.slice(0, -1).join(", ")} and ${names.at(-1)} change ${requirement}: one block would replace the other. Nothing was composed.`,
      { requirement, candidates: names });
  }

  const texts = new Map();
  const current = (heading) => (texts.has(heading) ? texts.get(heading) : sectionText(text, heading));
  for (const { each, candidate } of composed) {
    const held = parsed.requirements.get(each.of);
    const heading = each.class === "new"
      ? (held?.section ?? parsed.sections.at(-1)?.heading)
      : held.section;
    if (heading === undefined || heading === null) throw new RangeError("the SPEC has no section to add a requirement to");
    const section = current(heading);
    const eol = /\r\n/.test(section.split(/(?<=\n)/)[0] ?? "") ? "\r\n" : "\n";
    const items = (each.from.length > 0 ? each.from : [null]).map((passage) => (passage === null ? source : `${source}, ${passage}`));
    if (each.class === "new") {
      const block = `**${folded(candidate.name)}** ${SOURCE_START}${[...new Set(items)].join("; ")}${SOURCE_END}${eol}${folded(candidate.rule)}${eol}*Check:* ${folded(candidate.check)}`;
      const next = section.endsWith(`${eol}${eol}`) ? `${section}${block}${eol}${eol}`
        : section.endsWith("\n") ? `${section}${eol}${block}${eol}` : `${section}${eol}${eol}${block}`;
      texts.set(heading, next);
      continue;
    }
    const lines = linesOf(section);
    const { first, end, requirement } = located(section, lines, each.of);
    const added = [...new Set(items)].filter((item) => !requirement.sources.includes(item));
    const old = lines.slice(first, end).join("");
    const last = old.match(/(\r?\n)?$/)[0];
    const body = old.slice(0, old.length - last.length);
    const block = each.class === "duplicate" ? withSources(body, requirement.name, added)
      : withSources(`**${requirement.name}**${requirement.source === null ? "" : ` ${SOURCE_START}${requirement.source}${SOURCE_END}`}${eol}${folded(candidate.rule)}${eol}*Check:* ${folded(candidate.check)}`, requirement.name, added);
    texts.set(heading, [...lines.slice(0, first), `${block}${last}`, ...lines.slice(end)].join(""));
  }
  return parsed.sections.filter((section) => texts.has(section.heading) && texts.get(section.heading) !== sectionText(text, section.heading))
    .map((section) => ({ anchor: section.heading, until: null, text: texts.get(section.heading) }));
}

// ---------------------------------------------------------------- the writer of classified candidates (specStrategies: queue-entries)
//
// queue-entries(result, context) -> WriteOutcome — the candidates of the job's result written by the classes the person left them in, each as an entry of a new queue of the SPEC it belongs
// in: a candidate that constrains the development process in a queue of the instance's SPEC, every other in one of the product's; one queue and one commit for each of the two that gets one.
// Where the module file leaves a reading open, this file states the one it takes:
//   - A candidate's class is the one in `result.classes` for its name; one without a class is not written. A process candidate's class is decided anew with classifyCandidates over the
//     instance's SPEC and the requirements of its open queues, with the name and the rule as the key; a candidate that restates a requirement only an open entry holds, or that changes,
//     adds a source to or contradicts one its SPEC does not hold, is not written and the outcome's notes name it.
//   - A candidate's `source` names a source it points to; `linkedVersion` over the product's links and the instance's register gives none for one the product does not link, and the candidate
//     is not written: the note names the candidate and the source, as the hint to link it first (UC-005 5a).
//   - A queue's folder is `docs/spec-freigaben/<date><letter>_<slug>/`: the day of the job and the first letter, none, b, c …, that no queue of the day in the repository has, and the kind
//     and the job as the slug, the folders this call has named counted among those the repository has, so that a product that is its own instance keeps its two queues of the day in the day and the day with b. Its entries are named by their section, and `SPEC.md` is every entry's target. `entscheidungen.md` is written with no decision.
//   - The impact list of an entry names, for each requirement it changes, the artifacts MOD-trace-graph's requirementImpact finds that name it, or that none does; a new requirement has none.
//   - Nothing is written to a repository when every section already stands as written; the SPEC is never written.

const REGISTER_FILE = /^docs\/sources\/SRC-[^/]+\.md$/;
const QUEUE_DAY = /^docs\/spec-freigaben\/(\d{4}-\d{2}-\d{2})([a-z]?)_[^/]+\//;

const slugOf = (text) => String(text).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const headingText = (heading) => heading.replace(/^#+\s*/, "");
const entrySlug = (heading) => slugOf(headingText(heading).replace(/^\d+[.)]?\s*/, "")) || "section";
const pad2 = (n) => String(n).padStart(2, "0");

// The next folder name of the day in a repository: the date, and the first letter — none, b, c … — that no queue of the day has.
function folderFor(paths, date, slug) {
  const used = new Set(paths.map((path) => QUEUE_DAY.exec(path)).filter((found) => found?.[1] === date).map((found) => found[2]));
  const letter = !used.has("") ? "" : "bcdefghijklmnopqrstuvwxyz".split("").find((each) => !used.has(each));
  return { day: `${date}${letter ?? "z"}`, folder: `docs/spec-freigaben/${date}${letter ?? "z"}_${slug}` };
}

// What an entry changes: the requirements of its new section that the composed candidates account for, each as its candidate's class says.
function changesOf(section, composed, spec) {
  const names = new Set(parseSpec(section.text).requirements.keys());
  const found = [];
  for (const { each, candidate } of composed) {
    if (each.class === "new" && names.has(candidate.name)) found.push({ kind: "new", name: candidate.name, each });
    if (each.class === "change" && names.has(each.of)) found.push({ kind: "change", name: each.of, each });
    if (each.class === "duplicate" && names.has(each.of)) found.push({ kind: "duplicate", name: each.of, each });
  }
  return found.filter((change) => change.kind === "new" || spec.requirements.has(change.name));
}

const describeChange = (change) => (change.kind === "new" ? `adds ${change.name}` : change.kind === "change" ? `changes ${change.name}` : `adds a source to ${change.name}`);

// The origin a prompt names: a conversation in the prompt bar on its page, never a message of it.
const conversationOf = (page) => `a conversation in the prompt bar${page ? ` on ${page}` : ""}`;

// The text of one rationale, in the schema queue-rationale.
function rationaleOf(section, changes, graph, job) {
  const impact = changes.map((change) => {
    if (change.kind === "new") return `- ${change.name}: new; nothing names it yet.`;
    const names = requirementImpact(graph, change.name).map((entry) => `${entry.id} (${entry.via})`);
    return `- ${change.name}: ${names.length ? `named by ${names.join(", ")}` : "nothing names it"}.`;
  });
  const passages = [...new Set(changes.flatMap((change) => change.each.from))];
  const candidates = changes.map((change) => `${change.name}: ${change.candidate.rule}`);
  return [`# ${headingText(section.anchor)}: ${changes.map(describeChange).join("; ")}`, "",
    `**The change.** ${changes.map(describeChange).join("; ")}. The rest of the section is carried over byte for byte.`, "",
    `**Why.** Drafted from ${job.source}${job.prompted ? " on the person's instruction" : ""}: ${candidates.join(" · ")}`, "",
    "**Impact list.**", ...impact, "",
    `**Origin.** Source ${job.source}${passages.length ? `, passages: ${passages.join("; ")}` : ""}.${job.prompted ? ` Asked in ${conversationOf(job.page)}.` : ""}`, "",
    `**Provenance.** Agent M ${job.agentM.version}, commit ${job.agentM.commit}; participant ${job.participant.name}; model ${job.participant.model ?? "none"}; ${job.date}; correction rounds: ${job.rounds}.`, ""].join("\n");
}

// The requirements a SPEC holds and those the open entries of its queues hold, for classifyCandidates: { id, keys }, an open entry's tagged with its queue.
async function existingOf(snapshot, specText) {
  const inSpec = [...parseSpec(specText).requirements.values()].map((requirement) => ({ id: requirement.name, keys: [requirement.name, requirement.rule ?? ""] }));
  const open = [];
  for (const queue of await queues(snapshot)) {
    for (const entry of queue.entries.filter(({ state }) => state !== "in SPEC")) {
      const proposal = await snapshot.read(entry.proposal.path);
      for (const requirement of parseSpec(proposal ?? "").requirements.values()) open.push({ id: requirement.name, keys: [requirement.name, requirement.rule ?? ""], queue: queue.folder });
    }
  }
  return { inSpec, open };
}

export async function queueEntries(result, context) {
  const drafted = Array.isArray(result?.draft?.candidates) ? result.draft.candidates : [];
  const classes = Array.isArray(result?.classes) ? result.classes : [];
  const source = String(context.params?.source ?? "");
  const prompted = typeof context.params?.instruction === "string";
  const page = typeof context.params?.page === "string" && context.params.page.trim() ? context.params.page.trim() : null;
  const notes = [];

  // The sources the product links.
  const { entry: entrySchema, links: linksSchema } = sourceSchemas();
  let linked = null;
  const isLinked = async (name) => {
    if (linked === null) {
      const linksText = await context.product.snapshot.read("docs/sources.md");
      const register = [];
      for (const path of context.instance.snapshot.paths.filter((each) => REGISTER_FILE.test(each))) {
        const text = await context.instance.snapshot.read(path);
        if (text !== null) register.push(readDocument(entrySchema, path, text));
      }
      linked = (item) => linksText !== null && linkedVersion(readDocument(linksSchema, "docs/sources.md", linksText), register, item) !== null;
    }
    return linked(name);
  };
  const writable = [];
  for (const candidate of drafted) {
    if (typeof candidate.source === "string" && candidate.source !== "" && !(await isLinked(candidate.source))) {
      notes.push(`${candidate.name} points to ${candidate.source}, which the product does not link: link the source first (UC-015); the candidate is not written.`);
    } else writable.push(candidate);
  }

  const outcome = { commits: [], files: [], pullRequest: null, shown: null, notes };
  const date = context.now.toISOString().slice(0, 10);
  const job = { source, prompted, page, agentM: context.agentM, participant: result.drafter ?? { name: "none", model: null }, rounds: result.rounds?.length ?? 0, date };
  const slug = slugOf([context.kind?.name, context.jobId].filter(Boolean).join("-")) || "candidates";
  // A product that is its own instance may be held in two checkouts, as a hosted job holds it: its process queue is written through the product's
  // host too, the one whose commits the job's result carries.
  const web = (side) => side?.snapshot?.repository?.web ?? null;
  const ownInstance = web(context.product) !== null && web(context.product) === web(context.instance);
  const targets = [
    { where: context.product, mine: writable.filter((candidate) => candidate.constrains !== "process"), decide: false },
    { where: ownInstance ? { ...context.instance, host: context.product.host } : context.instance, mine: writable.filter((candidate) => candidate.constrains === "process"), decide: true },
  ];
  // Every target's sections are composed before any commit is made, so that a refusal of the second target (TwoChanges) leaves the first unwritten too.
  const plans = [];
  for (const { where, mine, decide } of targets) {
    if (mine.length === 0) continue;
    const specText = await where.snapshot.read("SPEC.md");
    if (specText === null) { notes.push(`${mine.map((candidate) => candidate.name).join(", ")}: the SPEC of the repository could not be read; nothing is written there.`); continue; }
    const spec = parseSpec(specText);
    let decided;
    if (decide) {
      const { inSpec, open } = await existingOf(where.snapshot, specText);
      decided = classifyCandidates(mine.map((candidate) => ({ ref: candidate.name, keys: [candidate.name, candidate.rule ?? ""], from: [candidate.passage].filter(Boolean),
        proposed: { class: candidate.class, of: candidate.of ?? null } })), [...inSpec, ...open]);
      for (const each of decided) {
        const held = open.find((item) => item.id === each.of && !spec.requirements.has(item.id));
        if (each.class !== "new" && held) notes.push(`${each.refs[0]} restates or changes ${held.id}, which only the open queue ${held.queue} holds; it is not written.`);
      }
    } else {
      decided = mine.map((candidate) => classes.find((each) => each.refs?.includes(candidate.name))).filter(Boolean);
    }
    const composable = decided.filter((each) => each.class === "new" || spec.requirements.has(each.of));
    for (const each of decided) {
      if (each.class !== "new" && !spec.requirements.has(each.of) && !notes.some((note) => note.startsWith(`${each.refs[0]} `))) {
        notes.push(`${each.refs[0]} is classed ${each.class} of ${each.of}, which the SPEC does not hold; it is not written.`);
      }
    }
    const sections = entrySections(specText, { candidates: mine }, composable, source);
    if (sections.length > 0) plans.push({ where, mine, spec, composable, sections });
  }

  // Every refusal that depends only on the draft and the context is raised before the first commit, so that a refusal of the second repository leaves the first unwritten too:
  // NoHost for every repository that gets a queue, then the composing of each queue, whose rationale breaks its schema or not. Moved is known only by committing and stays in the second loop.
  for (const { where } of plans) {
    if (!where.host) throw Object.assign(new Error("the repository the queue belongs to has no host to commit to"), { name: "NoHost" });
  }

  // The folders this call has named for a repository, so that a second queue of the day in it is not given the first's name before the first is written.
  const named = new Map();
  const prepared = [];
  for (const { where, mine, spec, composable, sections } of plans) {
    const graph = await graphOf(where.snapshot);
    const taken = named.get(where.snapshot) ?? [];
    const { day, folder } = folderFor([...where.snapshot.paths, ...taken.map((each) => `${each}/index.md`)], date, slug);
    named.set(where.snapshot, [...taken, folder]);
    const title = `Candidates of ${context.kind?.name ?? "a job"} from ${source}`;
    const composed = composable.map((each) => ({ each, candidate: mine.find((candidate) => candidate.name === each.refs[0]) })).filter(({ candidate }) => candidate);
    const files = [];
    const analysis = [];
    sections.forEach((section, at) => {
      const number = pad2(at + 1);
      const changes = changesOf(section, composed, spec).map((change) => ({ ...change, candidate: composed.find(({ each }) => each === change.each).candidate }));
      const base = `${folder}/${number}-${entrySlug(section.anchor)}`;
      const rationale = rationaleOf(section, changes, graph, job);
      const findings = documentFindings(queueRationaleSchema, readDocument(queueRationaleSchema, `${base}.begruendung.md`, rationale));
      if (findings.length) throw Object.assign(new Error(`the rationale of entry ${number} breaks its schema: ${findings[0].what}`), { name: "RationaleInvalid" });
      files.push({ path: `${base}.md`, text: section.text }, { path: `${base}.begruendung.md`, text: rationale });
      for (const change of changes) {
        const names = change.kind === "new" ? [] : requirementImpact(graph, change.name).map((entry) => `\`${entry.id}\``);
        analysis.push(`| \`${change.name}\` | ${change.kind === "new" ? "added" : change.kind === "change" ? "changed" : "source added"} | ${names.join(", ") || "—"} |`);
      }
    });
    const index = [`# SPEC approvals — queue ${day} · ${title}`, "",
      `**Decision:** drafted by ${job.participant.name} (${job.participant.model ?? "none"}) from ${source}${prompted ? ` on the person's instruction in ${conversationOf(page)}` : ""}; it enters open and waits for a person's acceptance.`, "",
      `**Size:** ${sections.length} ${sections.length === 1 ? "entry" : "entries"}, one for each section the candidates touch; every other byte of a section is carried over.`, "",
      "**Impact analysis** (names this queue adds, changes or adds a source to, and who references them):", "", "| Name | Change | Referenced by |", "|---|---|---|", ...analysis, "",
      "**Zieldatei aller Einträge:** `SPEC.md`", "", "| Nr | Datei | Anker (Überschrift, wortgetreu) | bis (exklusiv) | Commits |", "|---|---|---|---|---|",
      ...sections.map((section, at) => `| ${pad2(at + 1)} | \`SPEC.md\` | ${section.anchor} | — | — |`), ""].join("\n");
    const decisions = `# Decisions — queue ${day} ${title}\n\nAppend-only.\n`;
    const trailers = provenanceLines({ agentM: context.agentM, jobId: context.jobId ?? "none", kind: context.kind?.name ?? "none", participant: job.participant, rounds: job.rounds });
    const planned = [{ path: `${folder}/index.md`, text: index }, ...files, { path: `${folder}/entscheidungen.md`, text: decisions }];
    prepared.push({ where, planned, message: `Propose ${sections.length} SPEC ${sections.length === 1 ? "change" : "changes"} as queue ${day}\n\n${trailers.join("\n")}` });
  }

  // Two queues through one host follow each other: the second is committed on the first.
  let last = null;
  for (const { where, planned, message } of prepared) {
    const { defaultBranch } = await where.host.repositoryInfo();
    const head = last?.host === where.host ? last.commit : where.snapshot.commit ?? null;
    const committed = await where.host.commitFiles({ branch: defaultBranch, expectedHead: head, files: planned, message });
    last = { host: where.host, commit: committed.commit };
    outcome.commits.push(committed.commit);
    outcome.files.push(...planned.map((file) => file.path));
  }
  return outcome;
}

// ---------------------------------------------------------------- a person's edit of one section
//
// openQueueOf and proposeSection (ITM-341). Where the module file leaves a reading open, this file takes the one it names:
//   - The day of a queue is the date its folder name starts with; the newest queue of a day is the one with the later letter, a folder without a letter being the first.
//   - The person of a queue is the `author.account` of the oldest commit of its index.md's history that adds the file, else of the oldest commit of that history.
//   - An entry is replaced when the person's open queue holds an entry, not in SPEC, for the same target file and anchor; `alsoReplacing` names such entries of the other queues.
//   - A host with no token is one whose repositoryInfo says `canWrite: false`; the server is the snapshot's repository.server.

const queueDay = (folder) => QUEUE_DAY.exec(`${folder}/`);
const newestFirst = (a, b) => `${queueDay(b.folder)[1]}${queueDay(b.folder)[2] || "a"}`.localeCompare(`${queueDay(a.folder)[1]}${queueDay(a.folder)[2] || "a"}`);

async function creatorOf(host, folder) {
  const history = await host.readHistory(`${folder}/index.md`);
  const created = history.filter((entry) => entry.changes?.some((change) => change.path === `${folder}/index.md` && change.change === "added"));
  return (created.at(-1) ?? history.at(-1))?.author?.account ?? null;
}

async function openQueueIn(host, snapshot, person, date) {
  const today = (await queues(snapshot)).filter((queue) => queueDay(queue.folder)?.[1] === date && queue.entries.every((entry) => entry.state !== "in SPEC")).sort(newestFirst);
  for (const queue of today) if ((await creatorOf(host, queue.folder)) === person) return queue;
  return null;
}

export async function openQueueOf(person, date, host) {
  const { defaultBranch } = await host.repositoryInfo();
  const queue = await openQueueIn(host, await host.readSnapshot(defaultBranch), person, date);
  return queue?.folder ?? null;
}

// The rationale of an edit of one section: the change, the Why, the impact list and the origin, in the schema queue-rationale.
function sectionRationale(change, impact, origin = `${folded(change.origin)}; saved by ${change.person}.`) {
  const named = impact.length ? impact.map((item) => item.name).join(", ") : "no requirement";
  const what = impact.length ? impact.map((item) => `${item.change} ${item.name}`).join("; ") : "changes the text of the section";
  const lines = impact.length
    ? impact.map((item) => `- ${item.name}: ${item.change}; ${item.referencedBy.length ? `named by ${item.referencedBy.join(", ")}` : "nothing names it"}.`)
    : ["- no requirement of the section changes."];
  return [`# ${headingText(change.anchor)}: ${named}`, "", `**The change.** ${what[0].toUpperCase()}${what.slice(1)}; the rest of the section is as the person wrote it.`, "",
    `**Why.** ${folded(change.why)}`, "", "**Impact list.**", ...lines, "", `**Origin.** ${origin}`, ""].join("\n");
}

// The paths the repository held when the edit was opened on the commit `openedHead`: none for an edit opened on no commit (an empty repository), those of `snapshot` — the one the save has
// read — where it stands at that commit, else those of the repository at that commit, read for the purpose.
async function pathsWhenOpened(host, snapshot, openedHead) {
  if (openedHead === null) return new Set();
  if (openedHead === snapshot.commit) return new Set(snapshot.paths);
  return new Set((await host.readSnapshot(openedHead)).paths);
}

// The pages of GitHub's web interface for the files of an entry, each marked as differing where its file exists on the default branch otherwise than at the commit the edit was opened on.
async function pagesFor(host, snapshot, openedHead, files) {
  const began = await pathsWhenOpened(host, snapshot, openedHead);
  return fallbackEditLinks(files.map((file) => ({ ...file, existing: began.has(file.path) })), snapshot);
}

// The commit of an entry, or, where GitHub refuses it for a missing write permission (`PermissionMissing`), nothing written and GitHub's pages instead, as for a person with no token (UC-018 6b).
// On GitLab, which has no such fallback, and for every other failure, the failure is thrown as it came.
async function commitOrPages(host, snapshot, openedHead, files, commit) {
  try {
    return await host.commitFiles(commit);
  } catch (failure) {
    if (failure?.name !== "PermissionMissing" || snapshot.repository.server === "gitlab") throw failure;
    return { fallback: await pagesFor(host, snapshot, openedHead, files) };
  }
}

export async function proposeSection(host, change) {
  const info = await host.repositoryInfo();
  const snapshot = await host.readSnapshot(info.defaultBranch);
  const targetText = await snapshot.read(change.target);
  const before = typeof targetText === "string" ? spanText(targetText, change.anchor, change.until) : null;
  if ((before === null ? null : await blobSha(before)) !== change.openedBlob) return { refused: "changed meanwhile", current: before };
  if (!info.canWrite && snapshot.repository.server === "gitlab") throw failure("TokenRequired", "a GitLab product is written with a token");

  const date = new Date().toISOString().slice(0, 10);
  const all = await queues(snapshot);
  const mine = await openQueueIn(host, snapshot, change.person, date);
  const sameSection = (entry) => entry.file === change.target && entry.anchor === change.anchor && entry.state !== "in SPEC";
  const replaced = mine?.entries.find(sameSection) ?? null;
  const alsoReplacing = all.flatMap((queue) => (queue.folder === mine?.folder ? [] : queue.entries.filter(sameSection).map((entry) => ({ queue: queue.folder, entry: entry.number }))));

  const impact = await impactOf(snapshot, before ?? "", change.text, before === null && typeof targetText === "string" ? parseSpec(targetText).requirements : null);
  const files = [];
  let folder, number, day, proposalPath, rationalePath;
  if (mine) {
    folder = mine.folder;
    number = replaced?.number ?? Math.max(0, ...mine.entries.map((entry) => entry.number)) + 1;
    proposalPath = replaced?.proposal.path ?? `${folder}/${pad2(number)}-${entrySlug(change.anchor)}.md`;
    rationalePath = replaced?.rationale || proposalPath.replace(/\.md$/, ".begruendung.md");
    if (!replaced) {
      const index = (await snapshot.read(`${folder}/index.md`)) ?? "";
      files.push({ path: `${folder}/index.md`, text: `${index}${index === "" || index.endsWith("\n") ? "" : "\n"}| ${pad2(number)} | \`${change.target}\` | ${change.anchor} | ${change.until ?? "—"} | — |\n` });
    }
    day = queueDay(folder)[1] + queueDay(folder)[2];
  } else {
    ({ day, folder } = folderFor(snapshot.paths, date, `edits-of-${slugOf(change.person) || "a-person"}`));
    number = 1;
    proposalPath = `${folder}/01-${entrySlug(change.anchor)}.md`;
    rationalePath = proposalPath.replace(/\.md$/, ".begruendung.md");
    files.push({ path: `${folder}/index.md`, text: [`# SPEC approvals — queue ${day} · Edits of ${change.person}`, "",
      `**Zieldatei aller Einträge:** \`${change.target}\``, "", "| Nr | Datei | Anker (Überschrift, wortgetreu) | bis (exklusiv) | Commits |", "|---|---|---|---|---|",
      `| 01 | \`${change.target}\` | ${change.anchor} | ${change.until ?? "—"} | — |`, ""].join("\n") },
    { path: `${folder}/entscheidungen.md`, text: `# Decisions — queue ${day} Edits of ${change.person}\n\nAppend-only.\n` });
  }
  const rationale = sectionRationale(change, impact);
  const findings = documentFindings(queueRationaleSchema, readDocument(queueRationaleSchema, rationalePath, rationale));
  if (findings.length) throw failure("RationaleInvalid", `the rationale of the entry breaks its schema: ${findings[0].what}`);
  files.push({ path: proposalPath, text: change.text }, { path: rationalePath, text: rationale });

  if (!info.canWrite) return { fallback: await pagesFor(host, snapshot, change.openedHead, files) };
  const trailers = change.trailers?.length ? `\n\n${change.trailers.join("\n")}` : "";
  const committed = await commitOrPages(host, snapshot, change.openedHead, files, { branch: info.defaultBranch, expectedHead: snapshot.commit, files,
    message: `Propose an edit of ${headingText(change.anchor)} as entry ${pad2(number)} of queue ${day}${trailers}` });
  return committed.fallback ? committed : { commit: committed.commit, queue: folder, entry: number, alsoReplacing };
}

// saveEntry (ITM-394): an open entry saved in its own queue. Where the module file leaves a reading open, this file takes the one it names:
//   - The entry's state is read before its text: an entry that is not open is refused naming its state, whatever its proposal's blob; one the queue does not hold is a RangeError.
//   - The rationale is made anew from the edit — title, change and impact list from the new text against the section that holds now, the Why from `why` —; its Origin, and its Provenance
//     where a job drafted the entry, are kept as they stood. The index is not written.
export async function saveEntry(host, edit) {
  const info = await host.repositoryInfo();
  const snapshot = await host.readSnapshot(info.defaultBranch);
  const queue = (await queues(snapshot)).find((each) => each.folder === edit.queue);
  const entry = queue?.entries.find((each) => each.number === edit.entry);
  if (!entry) throw new RangeError(`saveEntry: the snapshot holds no entry ${edit.entry} of the queue ${edit.queue}`);
  if (entry.state !== "open") return { refused: "not open", state: entry.state };
  const held = (await snapshot.read(entry.proposal.path)) ?? "";
  if (entry.proposal.blob !== edit.openedBlob) return { refused: "changed meanwhile", current: held };
  if (!info.canWrite && snapshot.repository.server === "gitlab") throw failure("TokenRequired", "a GitLab product is written with a token");

  const targetText = await snapshot.read(entry.file);
  const before = typeof targetText === "string" ? spanText(targetText, entry.anchor, entry.until) : null;
  const old = (await snapshot.read(entry.rationale)) ?? "";
  const origin = /\*\*Origin\.\*\* ([^\n]*)/.exec(old)?.[1] ?? `an edit of the entry; saved by ${edit.person}.`;
  const provenance = /\n\*\*Provenance\.\*\*[^\n]*\n/.exec(old)?.[0] ?? "";
  const impact = await impactOf(snapshot, before ?? "", edit.text, before === null && typeof targetText === "string" ? parseSpec(targetText).requirements : null);
  const rationale = `${sectionRationale({ anchor: entry.anchor, why: edit.why }, impact, origin)}${provenance}`;
  const findings = documentFindings(queueRationaleSchema, readDocument(queueRationaleSchema, entry.rationale, rationale));
  if (findings.length) throw failure("RationaleInvalid", `the rationale of the entry breaks its schema: ${findings[0].what}`);
  const files = [{ path: entry.proposal.path, text: edit.text }, { path: entry.rationale, text: rationale }];

  if (!info.canWrite) return { fallback: await pagesFor(host, snapshot, edit.openedHead, files) };
  const committed = await commitOrPages(host, snapshot, edit.openedHead, files, { branch: info.defaultBranch, expectedHead: snapshot.commit, files,
    message: `Save the edit of entry ${pad2(entry.number)} of the queue ${edit.queue.split("/").pop()}` });
  return committed.fallback ? committed : { commit: committed.commit };
}
