// The rules of a process model definition that a schema cannot express (MOD-model-catalogue, Parts: validate.mjs;
// Interfaces: modelFindings): a phase's own produced kinds against the kinds of artifact the module knows, since a
// phase's Produces may follow a kind with an explanation in parentheses that no type of the schema language sets apart
// from it; those that compare one part of a definition with another — the phases its transitions, verification pairs and
// gates name; the phases reached from the first one; the roles its phases and gates name; the kinds of artifact a gate
// checks against those its phase and the phases before it produce —; the flow control of pulled work, a stated Time
// box of none read, before it reaches here, as no time box; and the measure of pulled work against its flow control.
//
// Module: MOD-model-catalogue
//
// It compares the parts of a definition as index.mjs reads them from a document of the model's schema, each with the line
// it stands on — a phase's produced kinds already read with an explanation in parentheses dropped, and a Time box of none
// already read as null. What the schema decides — a value left out where it is required, a value not of its type, a
// measure that does not fit the kind of work as planned or pulled, a missing declaration of planned or pulled —
// MOD-documents' documentFindings names, and nothing here names it twice: a part that is left out is compared with nothing. Every finding is an error on
// the line of the part that causes it, made with MOD-text-tools' finding.

import { finding } from "../text-tools/index.mjs";

const PHASES_AND_GATES = "THE MODEL DETERMINES THE PHASES AND THE GATES";
const PEOPLE_AND_AGENTS = "A PROCESS MODEL ORGANISES PEOPLE AND AGENTS";
const WHAT_IT_CHECKS = "A GATE NAMES WHAT IT CHECKS";
const WHO_DECIDES = "A GATE NAMES WHO DECIDES IT";
const VALIDATED = "A MODEL DEFINITION IS VALIDATED BEFORE IT IS USED";
const MEASURE = "PROGRESS IS SHOWN IN THE MODEL'S OWN MEASURE";

// The two measures of pulled work (model.schema.md, the variants of measure).
const PER_TIME_BOX = "remaining items per time box";
const PER_STATE = "items per state over time";

// A decider that is an automated check, whose result decides: `check: <CI check name>`.
const CHECK = /^check:[ \t]*\S/;

const given = (value) => typeof value === "string" && value !== "";
const escaped = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// Whether a text names a kind of artifact: the kind's words, as a whole.
const names = (text, kind) => new RegExp(`(?<![A-Za-z0-9])${escaped(kind)}(?![A-Za-z0-9])`).test(text);

/**
 * validate(parts, kinds) -> Finding[] — the findings of the rules a schema cannot express, in the order of the parts:
 * - a transition naming a phase that is not defined, and a phase that no transition reaches from the first phase, along
 *   transitions of any kind (THE MODEL DETERMINES THE PHASES AND THE GATES);
 * - a verification pair naming a phase that is not defined (THE MODEL DETERMINES THE PHASES AND THE GATES);
 * - a phase naming a role the model does not define, one finding for each such role it names (A PROCESS MODEL ORGANISES
 *   PEOPLE AND AGENTS);
 * - a phase producing a word that is no kind of artifact the module knows, an explanation in parentheses after it already
 *   dropped by index.mjs (THE MODEL DETERMINES THE PHASES AND THE GATES);
 * - a gate whose decider is neither a role of the model nor `check: <CI check name>`, which leaves it without a decider
 *   (A GATE NAMES WHO DECIDES IT);
 * - a gate that checks a kind of artifact which neither the phase it follows nor any phase before it — along the
 *   transitions that are not `back` — produces (A GATE NAMES WHAT IT CHECKS);
 * - pulled work that names neither a time box nor a work-in-progress limit, or both (A MODEL DEFINITION IS VALIDATED
 *   BEFORE IT IS USED), on the line of its ## Flow control, or on line 1 without one;
 * - pulled work that names no time box and measures remaining items per time box: a measure that does not fit the kind
 *   of work, since its work has no time box (PROGRESS IS SHOWN IN THE MODEL'S OWN MEASURE), on the line of its measure.
 * @param {{ artifact: string, kind: string, measure: string, measureLine: number,
 *   phases: Array<{ line: number, name: string, roles: string[], produces: string[] }>,
 *   transitions: Array<{ line: number, from: string, to: string, kind: string }>,
 *   pairs: Array<{ line: number, phase: string, checkedBy: string }>,
 *   gates: Array<{ line: number, from: string, to: string, artifacts: string, decider: string }>,
 *   roles: Array<{ line: number, name: string }>,
 *   flow: { line: number, wip: number | string | null, timeBox: string | null } | null }} parts — a definition's parts as
 *   index.mjs reads them; a value left out is "", a list left out [], a flow value left out null; a phase's produces
 *   already has a kind's explanation in parentheses dropped, and a Time box of none already read as null
 * @param {string[]} kinds — the kinds of artifact a phase may produce, which the schema's own type of Produces cannot
 *   name, since it allows a kind to be followed by an explanation in parentheses
 * @returns {Finding[]}
 */
export function validate(parts, kinds) {
  const found = [];
  const add = (line, rule, what, fix) => found.push(finding({ artifact: parts.artifact, line, kind: "error", rule, what, fix }));
  const phases = new Set(parts.phases.map((phase) => phase.name).filter(given));
  const roles = new Set(parts.roles.map((role) => role.name).filter(given));

  for (const t of parts.transitions) {
    for (const end of [t.from, t.to]) {
      if (given(end) && !phases.has(end)) {
        add(t.line, PHASES_AND_GATES, `the transition ${t.from} → ${t.to} names ${end}, which is no phase of the model`,
          `name a phase of ## Phases, or add ${end} there`);
      }
    }
  }

  const first = parts.phases[0]?.name;
  if (given(first)) {
    const reached = new Set([first]);
    for (let grown = true; grown;) {
      grown = false;
      for (const t of parts.transitions) {
        if (reached.has(t.from) && phases.has(t.to) && !reached.has(t.to)) {
          reached.add(t.to);
          grown = true;
        }
      }
    }
    for (const phase of parts.phases) {
      if (given(phase.name) && !reached.has(phase.name)) {
        add(phase.line, PHASES_AND_GATES, `no transition reaches the phase ${phase.name} from the first phase, ${first}`,
          `add a transition to ${phase.name} from a phase that ${first} reaches, or remove the phase`);
      }
    }
  }

  for (const pair of parts.pairs) {
    for (const end of [pair.phase, pair.checkedBy]) {
      if (given(end) && !phases.has(end)) {
        add(pair.line, PHASES_AND_GATES,
          `the verification pair ${pair.phase} ↔ ${pair.checkedBy} names ${end}, which is no phase of the model`,
          `name a phase of ## Phases, or add ${end} there`);
      }
    }
  }

  for (const phase of parts.phases) {
    for (const role of phase.roles.filter((named) => given(named) && !roles.has(named))) {
      add(phase.line, PEOPLE_AND_AGENTS, `the phase ${phase.name} names the role ${role}, which the model does not define`,
        `name a role of ## Roles, or add ${role} there`);
    }
  }

  for (const phase of parts.phases) {
    for (const produced of phase.produces) {
      if (!kinds.includes(produced)) {
        add(phase.line, PHASES_AND_GATES, `the phase ${phase.name} produces ${produced}, which is no kind of artifact`,
          `name one of ${kinds.join(", ")} before the explanation in parentheses, or correct it`);
      }
    }
  }

  // The phase a gate follows, and every phase before it along the transitions that are not back.
  const upTo = (phase) => {
    const before = new Set([phase]);
    for (let grown = true; grown;) {
      grown = false;
      for (const t of parts.transitions) {
        if (t.kind !== "back" && before.has(t.to) && given(t.from) && !before.has(t.from)) {
          before.add(t.from);
          grown = true;
        }
      }
    }
    return before;
  };
  for (const gate of parts.gates) {
    const gateName = `${gate.from} → ${gate.to}`;
    if (given(gate.decider) && !CHECK.test(gate.decider) && !roles.has(gate.decider)) {
      add(gate.line, WHO_DECIDES, `the gate ${gateName} is decided by ${gate.decider}, which is neither a role of the model nor a check`,
        "name a role of ## Roles, or a check whose result decides, as check: <CI check name>");
    }
    if (given(gate.artifacts) && given(gate.from)) {
      const before = upTo(gate.from);
      const produced = new Set(parts.phases.filter((phase) => before.has(phase.name)).flatMap((phase) => phase.produces));
      for (const kind of kinds) {
        if (names(gate.artifacts, kind) && !produced.has(kind)) {
          add(gate.line, WHAT_IT_CHECKS, `the gate ${gateName} checks ${kind}, which no phase up to ${gate.from} produces`,
            `let ${gate.from} or a phase before it produce ${kind}, or check what one of them produces`);
        }
      }
    }
  }

  if (parts.kind === "pulled") {
    const wip = parts.flow?.wip ?? null;
    const timeBox = parts.flow?.timeBox ?? null;
    if ((wip === null) === (timeBox === null)) {
      add(parts.flow?.line ?? 1, VALIDATED,
        wip === null ? "pulled work names neither a time box nor a work-in-progress limit"
          : "pulled work names both a time box and a work-in-progress limit",
        wip === null ? "name under ## Flow control a WIP limit or a time box"
          : "keep the WIP limit or the time box under ## Flow control, and leave the other out with —");
    }
    if (parts.measure === PER_TIME_BOX && timeBox === null) {
      add(parts.measureLine, MEASURE, `the measure ${PER_TIME_BOX} does not fit pulled work that names no time box`,
        `name a time box under ## Flow control, or measure ${PER_STATE}`);
    }
  }
  return found;
}
