// sections.mjs — the extra sections a descriptor names (MOD-review-pages, Parts): ITM-441 builds the architecture's due diligence and
// its rounds.
//
// Module: MOD-review-pages
//
// A REUSE DECISION RECORDS ITS DUE DILIGENCE; THE ROUNDS ARE COUNTED AND SHOWN. Nothing here reads or writes the repository: a section
// is drawn from the text or the rounds it is given.

import { renderArtifact, showDifference } from "../markdown-render/index.mjs";
import { explain } from "../site-frame/index.mjs";
import { storedGraph, architectureImpact } from "../trace-graph/index.mjs";
import { asOfLine } from "./common.mjs";

function el(name, className, ...children) {
  const node = document.createElement(name);
  if (className) node.className = className;
  node.append(...children);
  return node;
}

// A decision's `## Due diligence` section, taken out of its text: { rest, section } — the text without the section, and the section
// (heading excluded), or null where the decision has none.
export function splitDueDiligence(body) {
  const found = /^## Due diligence[ \t]*\n([^]*?)(?=^## |(?![^]))/m.exec(body);
  if (!found) return { rest: body, section: null };
  return { rest: body.slice(0, found.index) + body.slice(found.index + found[0].length), section: found[1] };
}

// The due-diligence section as drawn on the review page: the candidates side by side in the table the decision holds, with the folded explanation of a due
// diligence; below the table, while a row's column of compatibility says other than `yes` (MOD-reuse-facts) — a licence missing, unknown or restrictive
// (UC-022 7c) —, the folded explanation of what a licence permits, once. The rows themselves stay as the table holds them.
const COMPATIBLE_COLUMN = /^Compatible/;
export function dueDiligenceSection(section) {
  const table = renderArtifact(section);
  const undecided = [...table.getElementsByTagName("td")].some((cell) => COMPATIBLE_COLUMN.test(cell.getAttribute("data-label") ?? "") && cell.textContent.trim() !== "yes");
  return el("section", "due-diligence", el("h4", null, "Due diligence"), explain("due-diligence"), table, ...(undecided ? [explain("licence-permits")] : []));
}

// The text of a section of a report, under its heading `## <heading>`, or null where the report has none.
const sectionOf = (body, heading) => new RegExp(`^## ${heading}[ \\t]*\\n([^]*?)(?=^## |(?![^]))`, "m").exec(body)?.[1] ?? null;

// The extra sections of a release test report (MOD-review-pages, the table of kinds): the changelog entry the report holds, which the person confirms by accepting,
// and, where the report names a failing test or a worse rate in its `## Limitations`, a field for the reason of each. { nodes, reasons } — the sections to draw, and
// `reasons()`, the reasons as typed so far, by the identifier of the test or rate: the `limitations` of MOD-release-evidence.acceptAndRelease's decision.
export function reportSections(body) {
  const ids = [...(sectionOf(body, "Limitations") ?? "").matchAll(/^- ([^\s:]+):/gm)].map((found) => found[1]);
  const fields = new Map(ids.map((id) => {
    const field = el("input", "reason");
    field.setAttribute("data-id", id);
    field.setAttribute("aria-label", `Reason for ${id}`);
    return [id, field];
  }));
  const nodes = [el("section", "changelog-entry", el("h3", null, "Changelog entry"), el("p", null, (sectionOf(body, "Changelog entry") ?? "").trim()))];
  if (ids.length) {
    const list = el("ul");
    for (const [id, field] of fields) list.append(el("li", null, el("label", null, `${id} `, field)));
    nodes.push(el("section", "limitations", el("h3", null, "Limitations"), el("p", null, "A reason is needed for every failing test and every rate worse than the running version's."), list));
  }
  return { nodes, reasons: () => Object.fromEntries([...fields].map(([id, field]) => [id, (field.value ?? "").trim()])) };
}

// A finding in the compiler's form, as MOD-text-tools writes it: <artifact>:<line>: <kind>: <what> [<rule>] — <fix>.
const findingText = (found) => `${found.artifact}:${found.line}: ${found.kind}: ${found.what} [${found.rule}] — ${found.fix}`;
const answerText = (answer) => (answer.text ? `${answer.how}: ${answer.text}` : answer.how);

// Why the loop stopped, as the record's `Left:` line states it: "Left: … · stopped because: <why> · limit: <n>". null where the record
// has no such line.
export function stoppedBecause(recordText) {
  return /^Left: .*? · stopped because: (.+?) · limit: /m.exec(recordText ?? "")?.[1] ?? null;
}

// What is left, as the record's writer counts it (MOD-job-ledger appendToRecord): the findings of the last round, answered or not,
// unless the loop passed or checked nothing. Without a stated reason the writer's own default holds: passed if the last round has no
// finding, else the limit.
export const isLeft = (stopped, round, last) => round === last && !["passed", "not checked"].includes(stopped ?? (last.findings.length === 0 ? "passed" : "limit"));

// The rounds of the job that drafted the architecture, as its record holds them: each round with its findings, each finding with the
// drafter's answer; the findings of the last round are left unless the loop passed or checked nothing (`stopped`, why it stopped).
export function roundsSection(rounds, stopped = null) {
  const section = el("section", "rounds", el("h3", null, "Rounds"));
  const last = rounds[rounds.length - 1];
  let left = 0;
  for (const round of rounds) {
    const list = el("ul");
    for (const found of round.findings) {
      const answer = round.answers.find((each) => each.finding === found || findingText(each.finding) === findingText(found));
      const isOne = isLeft(stopped, round, last);
      const item = el("li", isOne ? "finding left" : "finding", findingText(found), " ");
      if (answer) item.append(el("span", "answer", answerText(answer)), " ");
      if (isOne) { item.append(el("span", "left-mark", "left")); left += 1; }
      list.append(item);
    }
    const count = round.findings.length;
    const block = el("section", "round", el("h4", null, `Round ${round.number} — ${count === 0 ? "no finding" : count === 1 ? "1 finding" : `${count} findings`}`), list);
    block.setAttribute("data-number", String(round.number));
    section.append(block);
  }
  section.append(el("p", "left-count", `Left: ${left === 0 ? "none" : left === 1 ? "1 finding" : `${left} findings`}`));
  return section;
}

// A SPEC change entry's sections, drawn from its view as MOD-spec-changes gives it: the section that holds now, the proposal, their difference, the
// rationale, the impact list, the other open proposals on the same section — [{ id, state }], with the line As of while they are of the earlier commit `asOf` — and the queue's
// order — [{ number, anchor, state }].
export function entrySections(view, others, order, hrefOf, asOf = null) {
  const impact = el("ul", "impact");
  for (const each of view.impact) impact.append(el("li", null, `${each.name} — ${each.change}${each.referencedBy.length ? `, named by ${each.referencedBy.join(", ")}` : ""}`));
  const otherList = el("ul", "others");
  for (const other of others) {
    const a = el("a", null, other.id);
    a.setAttribute("href", hrefOf(other.id));
    otherList.append(el("li", null, a, ` — ${other.state}`));
  }
  const orderList = el("ol", "order");
  for (const each of order) orderList.append(el("li", null, `${String(each.number).padStart(2, "0")} — ${each.anchor} (${each.state})`));
  return [
    el("section", "current", el("h3", null, "Now in the SPEC"), view.current ? renderArtifact(view.current.text) : el("p", null, "There is no such section yet.")),
    el("section", "proposal", el("h3", null, "The proposal"), renderArtifact(view.proposal.text)),
    el("section", "difference", el("h3", null, "Difference"), showDifference(view.current?.text ?? "", view.proposal.text)),
    el("section", "rationale", el("h3", null, "Why"), renderArtifact(view.rationale)),
    el("section", "impact-list", el("h3", null, "Impact list"), impact),
    el("section", "others-list", el("h3", null, "Other open proposals on this section"), ...[asOfLine(asOf)].filter(Boolean), otherList),
    el("section", "queue-order", el("h3", null, "The queue's order"), orderList),
  ];
}

// The impact list of a change to an accepted decision or module (UC-023 step 4; AN ARCHITECTURE CHANGE IS NOT ACCEPTED WITHOUT AN IMPACT LIST),
// drawn from the ArchitectureImpact MOD-trace-graph's architectureImpact derives and from the graph it was derived from: each affected module — one that uses an
// interface the change alters or removes marked as breaking — with the code files in its folder and the tests that exercise it, and what they guard; then the
// requirements and use cases the file names now and no longer; the backlog items that name an affected module.
// Without the graph (graph null: a stored list), the code files and the tests of the whole list stand in one line each below the modules.
export function impactSection(impact, graph) {
  const list = (names) => (names.length ? names.join(", ") : "—");
  const testsLine = (tests) => (tests.length ? list(tests.map((t) => `${t.id}${t.guards.length ? ` (guards ${t.guards.join(", ")})` : ""}`)) : "none");
  const modules = el("ul", "names");
  for (const each of impact.modules) {
    const item = el("li", "module", el("span", "module-head", el("strong", null, each.id), ...(each.breaks ? [" ", el("span", "badge breaks", "breaks")] : []), ` — ${each.why}`));
    if (graph !== null) {
      const folder = graph.nodes.get(each.id)?.folder ?? null;
      const prefix = folder === null ? null : folder.endsWith("/") ? folder : `${folder}/`;
      const code = prefix === null ? [] : impact.codeFiles.filter((path) => path.startsWith(prefix));
      const exercising = new Set(graph.edges.filter((edge) => edge.via === "exercises" && edge.to === each.id).map((edge) => edge.from));
      item.append(el("p", "small code-files", `Code files — ${code.length ? list(code) : "no code yet"}`), el("p", "small tests", `Tests — ${testsLine(impact.tests.filter((t) => exercising.has(t.id)))}`));
    }
    item.setAttribute("data-id", each.id);
    modules.append(item);
  }
  if (impact.modules.length === 0) modules.append(el("li", null, "none — no module follows this decision"));
  const section = el("section", "change-impact", el("h3", null, "Impact of this change"),
    el("p", "small", el("strong", null, "Affected modules")), modules,
    ...(graph === null ? [el("p", "small code-files", `Code files — ${impact.codeFiles.length ? list(impact.codeFiles) : "no code yet"}`), el("p", "small tests", `Tests — ${testsLine(impact.tests)}`)] : []),
    el("p", "small", el("strong", null, "Requirements and use cases"), ` — newly named: ${list(impact.named.added)} · no longer named: ${list(impact.named.removed)}`),
    el("p", "small", el("strong", null, "Items"), ` — ${list(impact.items)}`));
  section.setAttribute("tabindex", "0"); // the box scrolls (look.css), so a keyboard must reach it
  return section;
}

// The impact list of a change to an accepted decision or module (AN ARCHITECTURE CHANGE IS NOT ACCEPTED WITHOUT AN IMPACT LIST), from the graph of the
// snapshot shown, the text accepted last and the text shown — null for a removed file: { shown } the section to show, or { problem } a paragraph
// saying why it could not be derived, in which case the change is not offered for acceptance. graphOf() gives the graph, built once for a page. A
// removed module has no node in the graph, so its folder is not the graph's: the code files and tests of a removal stand in one line each, as for a
// stored list. `impact` is the ArchitectureImpact shown.
export async function changeImpact(file, last, body, graphOf) {
  try {
    const graph = await graphOf();
    const impact = architectureImpact(graph, [{ path: file.path, before: last.text, after: body }]);
    const shown = impactSection(impact, body === null ? null : graph);
    shown.append(explain("impact-of-a-change"));
    return { shown, impact };
  } catch (failure) {
    return { problem: el("p", "problem", `The impact list could not be derived: ${failure.message} — without it, this change cannot be accepted.`) };
  }
}
export const graphOnce = (snapshot) => { let graph = null; return () => (graph ??= storedGraph(snapshot, snapshot.commit)); };

// After an acceptance (UC-023 step 6): the modules of the impact lists the page showed for the files the acceptance recorded, in their order, each with the plan steps and
// backlog items of those lists that name it in the graph of the commit shown — an item names a module, as in the impact list, by its `changes` edge. graphOf() gives that
// graph (graphOnce). Nothing where no list was shown for a recorded file or the lists name no module; a paragraph saying why where the graph cannot be read.
export async function affectedModules(impacts, graphOf) {
  const modules = [...new Set(impacts.flatMap((impact) => impact.modules.map((each) => each.id)))];
  if (modules.length === 0) return [];
  const items = [...new Set(impacts.flatMap((impact) => impact.items))];
  try {
    const graph = await graphOf();
    const list = el("ul", "names");
    for (const id of modules) {
      const naming = items.filter((each) => graph.edges.some((edge) => edge.via === "changes" && edge.from === each && edge.to === id));
      const entry = el("li", "module", `${id} — ${naming.length ? naming.join(", ") : "—"}`);
      entry.setAttribute("data-id", id);
      list.append(entry);
    }
    return [el("section", "affected-modules", el("h3", null, "Affected modules"), list)];
  } catch (failure) {
    return [el("p", "problem", `The affected modules cannot be listed: ${failure.message}`)];
  }
}
