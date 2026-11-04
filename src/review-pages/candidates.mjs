// candidates.mjs — the candidates of a draft of requirements, as the author reviews them (MOD-review-pages, Parts): each candidate with its class, the requirement it refers to beside it, and its
// rule and check, which the author may change; and the draft and the classes as the author left them. Used by the page of a draft of the conversation (requirements-draft.mjs); `showCurrent`, `flagged`, `splitCandidate`, `splitProblem` and `editedResult` are also the panel of a derivation's (jobs.mjs): the current text of the requirement, the candidate a finding the loop left names, its split into parts of its own, and the draft as the author left it.
//
// Module: MOD-review-pages
//
// A CANDIDATE IS NEW, A CHANGE, A DUPLICATE OR A CONFLICT; A CONFLICT IS DECIDED BY A PERSON. Nothing is read or written here.

import { renderArtifact, showDifference } from "../markdown-render/index.mjs";
import { el } from "./common.mjs";

export const inputsOf = (root, name, className) => {
  const found = [];
  (function walk(node) {
    for (const child of node.childNodes) {
      if (child.nodeType !== 1) continue;
      if (child.localName === name && child.className.split(" ").includes(className)) found.push(child);
      walk(child);
    }
  })(root);
  return found;
};

function classSelect(value) {
  const select = el("select", "class");
  for (const name of ["new", "change", "duplicate", "conflict"]) {
    const option = el("option", null, name);
    option.value = name;
    option.selected = name === value;
    select.append(option);
  }
  select.value = value;
  return select;
}

export const classOf = (candidate, classes) => classes?.find((each) => each.refs?.includes(candidate.name)) ?? {
  refs: [candidate.name], from: [candidate.passage].filter(Boolean), class: candidate.class, of: candidate.of ?? null,
};

/**
 * shownOnPanel(candidate, classes) -> boolean — whether the panel shows `candidate`: a class of the last round that merged candidates of one rule (CANDIDATES ARE DEDUPLICATED AMONG THEMSELVES) is shown
 * as its first candidate, and the others it names are not.
 */
export const shownOnPanel = (candidate, classes) => classOf(candidate, classes).refs[0] === candidate.name;

/** passagesLine(decided) -> Element | "" — the line that names every passage of a class that merged candidates; nothing for a class of one candidate. */
export const passagesLine = (decided) => (decided.refs.length > 1 && decided.from.length ? el("p", "candidate-passages", `Passages: ${decided.from.join(", ")}.`) : "");

const sourceText = (item, register) => {
  const id = item.split(",")[0].trim();
  const entry = register.find((each) => each.id === id);
  return `${item} (${entry?.fields.authority ?? "authority not registered"})`;
};

/**
 * showCurrent(current, held, register) — fills the section `current` with the current requirement `held` (a requirement of MOD-spec-document's parseSpec, or undefined) as the SPEC holds it:
 * name, rule, each source with the authority `register` records for it, and check; without `held`, the sentence that the candidate refers to no current requirement. Both pages of a candidate call it.
 */
export function showCurrent(current, held, register) {
  current.replaceChildren(el("h5", null, "Current requirement"), held
    ? renderArtifact(`**${held.name}**\n\n${held.rule ?? ""}\n\n*Sources:* ${held.sources.map((item) => sourceText(item, register)).join("; ")}\n\n*Check:* ${held.check ?? ""}`)
    : el("p", "none", "This candidate refers to no current requirement."));
}

export function candidateRows(panel, outcome, parsed, source, register, onChange) {
  const candidates = Array.isArray(outcome.draft?.candidates) ? outcome.draft.candidates : [];
  for (const candidate of candidates.filter((each) => shownOnPanel(each, outcome.classes))) {
    const decided = classOf(candidate, outcome.classes);
    const select = classSelect(decided.class);
    const of = el("input", "of");
    of.value = decided.of ?? "";
    const rule = el("textarea", "candidate-rule");
    rule.value = candidate.rule ?? "";
    const check = el("textarea", "candidate-check");
    check.value = candidate.check ?? "";
    const current = el("section", "current-requirement"), difference = el("section", "candidate-difference");
    const refresh = () => {
      const held = parsed.requirements.get(of.value.trim());
      showCurrent(current, held, register);
      difference.replaceChildren(el("h5", null, "Difference"), showDifference(held?.rule ?? "", rule.value));
    };
    const changed = () => { refresh(); onChange(); };
    select.addEventListener("change", changed);
    of.addEventListener("input", changed);
    rule.addEventListener("input", changed);
    check.addEventListener("input", onChange);
    refresh();
    const item = el("li", "candidate", el("section", "candidate-draft", el("span", "candidate-name", candidate.name),
      el("label", null, " Class ", select), el("label", null, " of ", of), el("label", null, "Rule", rule),
      el("label", null, "Check", check), el("p", "candidate-source", `Source: ${sourceText(candidate.source ?? source, register)}.`), passagesLine(decided)), current, difference);
    item.setAttribute("data-name", candidate.name);
    panel.append(item);
  }
}

const folded = (text) => String(text ?? "").replace(/\s+/g, " ").trim();

/**
 * flagged(remaining, candidate) -> boolean — whether a finding the correction loop left (`remaining` of its result) names the candidate as its artifact: the candidate the panel offers to split.
 */
export const flagged = (remaining, candidate) => (remaining ?? []).some((finding) => finding.artifact === folded(candidate.name));

// A part of a split candidate: a candidate of the panel after it, of the class and `of` it is given, with a name and a rule of its own for the person to fill.
function splitPart(origin, class_, of, onChange) {
  const select = classSelect(class_);
  const ofInput = el("input", "of");
  ofInput.value = of;
  const name = el("input", "candidate-name"), rule = el("textarea", "candidate-rule");
  name.value = "";
  rule.value = "";
  const part = el("li", "candidate split-part", el("label", null, "Name ", name), el("label", null, " Class ", select), el("label", null, " of ", ofInput), el("label", null, "Rule", rule));
  part.setAttribute("data-split-of", origin);
  select.addEventListener("change", onChange);
  return part;
}

/**
 * splitCandidate(item, candidate, onChange) — splits the candidate whose item `item` is in the panel: its rule becomes a field the person may edit, and a part of its own stands after it (after
 * its parts, if it has some). The part shows the class and `of` the candidate shows, except for a `change`: a second change of one requirement is refused (TwoChanges), so the part shows `new`
 * with an empty `of`. Nothing is written. `onChange` is called when a class of the panel may have changed.
 */
export function splitCandidate(item, candidate, onChange) {
  const name = item.getAttribute("data-name");
  const shown = inputsOf(item, "p", "candidate-rule")[0];
  if (shown) {
    const rule = el("textarea", "candidate-rule");
    rule.value = candidate.rule ?? "";
    item.insertBefore(rule, shown);
    item.removeChild(shown);
  }
  let last = item;
  while (last.nextSibling?.getAttribute?.("data-split-of") === name) last = last.nextSibling;
  const class_ = inputsOf(item, "select", "class")[0].value;
  const part = class_ === "change" ? splitPart(name, "new", "", onChange) : splitPart(name, class_, inputsOf(item, "input", "of")[0].value.trim(), onChange);
  item.parentNode.insertBefore(part, last.nextSibling);
  onChange();
}

/**
 * splitProblem(panel) -> string | null — what keeps the parts of the panel from being written: a part without a name or a rule, or bearing the name of another candidate; null when none does. Two candidates
 * that change one requirement are refused by MOD-spec-changes' entrySections (TwoChanges), not here.
 */
export function splitProblem(panel) {
  const items = inputsOf(panel, "li", "candidate");
  const taken = items.map((item) => item.getAttribute("data-name")).filter(Boolean).map(folded);
  const parts = items.filter((item) => item.getAttribute("data-split-of"));
  for (const part of parts) {
    const name = folded(inputsOf(part, "input", "candidate-name")[0].value), rule = folded(inputsOf(part, "textarea", "candidate-rule")[0].value);
    if (!name || !rule) return `A split part of ${part.getAttribute("data-split-of")} needs a name and a rule: nothing was written.`;
    if (taken.includes(name)) return `The split part ${name} has the name of another candidate: nothing was written.`;
    taken.push(name);
  }
  return null;
}

// The value of a field of a candidate's item; the candidate's own when the item shows none (the panel of a derivation shows the rule of an unsplit candidate as text).
const fieldOf = (item, name, className, held) => inputsOf(item, name, className)[0]?.value ?? held;

export function editedResult(panel, outcome) {
  const items = inputsOf(panel, "li", "candidate");
  const candidates = [], classes = [];
  const take = (candidate, item, from, refs = [candidate.name]) => {
    const class_ = inputsOf(item, "select", "class")[0].value;
    const of = inputsOf(item, "input", "of")[0].value.trim();
    const edited = { ...candidate, rule: fieldOf(item, "textarea", "candidate-rule", candidate.rule), check: fieldOf(item, "textarea", "candidate-check", candidate.check), class: class_ };
    if (of) edited.of = of;
    else delete edited.of;
    candidates.push(edited);
    classes.push({ refs, from, class: class_, of: of || null });
    return edited;
  };
  for (const candidate of (outcome.draft?.candidates ?? []).filter((each) => shownOnPanel(each, outcome.classes))) {
    const item = items.find((node) => node.getAttribute("data-name") === candidate.name);
    const { from = [], refs } = classOf(candidate, outcome.classes);
    const edited = take(candidate, item, from, refs);
    for (const part of items.filter((node) => node.getAttribute("data-split-of") === candidate.name)) take({ ...edited, name: inputsOf(part, "input", "candidate-name")[0].value.trim() }, part, from);
  }
  return { draft: { candidates }, classes };
}
