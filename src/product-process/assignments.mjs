// The role assignments of a product: who fills which role of its process (MOD-product-process, Data: Schema
// `role-assignment`; Interfaces: roleAssignmentFindings, holdsRole). index.mjs offers both; gates.mjs asks holdersOf who
// holds the deciding role of a gate.
//
// Module: MOD-product-process
//
// A role assignment is a Document as MOD-documents reads it with roleAssignmentSchema: its section `## Roles` with the rows
// of its table, each a role and its participants. The schema names front matter and any other section; what it cannot say
// — a role the product's process does not have, more participants than a role takes, a name the instance's list does not
// hold, text besides the table — is found here. A holder's capabilities and place are judged through MOD-participant-list's
// `eligible`, over the participants its `participantsOf` gives, as the declaration's holders were before the role
// assignments held them.

import { finding } from "../text-tools/index.mjs";
import { participantsOf, eligible } from "../participant-list/index.mjs";
import { permittedPlaces } from "../source-register/index.mjs";
import { bodyLine } from "./declaration.mjs";

const ONE_OR_PER_TEAM = "A PRODUCT HAS ONE ROLE ASSIGNMENT, OR ONE PER TEAM";
const FILLS = "A ROLE ASSIGNMENT FILLS THE ROLES";
const HOW_MANY = "A ROLE NAMES HOW MANY FILL IT";
const ONCE_PER_INSTANCE = "PARTICIPANTS ARE CONFIGURED ONCE PER INSTANCE";
const PEOPLE_AND_AGENTS = "A PROCESS MODEL ORGANISES PEOPLE AND AGENTS";
const CAPABILITY = "A ROLE NAMES THE CAPABILITIES IT NEEDS";
const PERMITTED = "RESTRICTED CONTENT GOES ONLY WHERE ITS SOURCE PERMITS";

const ROLES = "## Roles";
const TITLE = /^#[ \t]+\S/;
const TABLE_LINE = /^[ \t]*\|/;

const text = (value) => (typeof value === "string" ? value : "");
const list = (value) => (Array.isArray(value) ? [...value] : []);

const rolesSection = (assignment) => assignment.sections.find((section) => section.heading === ROLES);

// The rows of an assignment's ## Roles: each role with its participants, and the line of its row.
const rowsOf = (assignment) => (rolesSection(assignment)?.rows ?? [])
  .map(({ line, cells }) => ({ line, role: text(cells.Role), holders: list(cells.Participants) }));

/**
 * holdersOf(assignment: Document, role: string) -> string[] — the participants the role assignment gives the role, in the
 * order its rows name them.
 */
export const holdersOf = (assignment, role) => [...new Set(rowsOf(assignment)
  .filter((row) => row.role === role).flatMap((row) => row.holders))];

// The lines of an assignment that are no part of its roles table, each with its number in the file: before its first
// section, every line but blank ones and the file's title; in ## Roles, every line but blank ones and those of its first
// table. The schema names front matter and any other section itself, so their lines are not read here.
function strayLines(assignment) {
  const lines = assignment.body.split("\n").map((line) => line.replace(/\r$/, ""));
  const first = bodyLine(assignment);
  const section = rolesSection(assignment);
  const leadEnd = assignment.sections.length ? assignment.sections[0].line - first : lines.length;
  const stray = [];
  let titled = false;
  lines.slice(0, leadEnd).forEach((line, i) => {
    if (!line.trim()) return;
    if (!titled && TITLE.test(line)) { titled = true; return; }
    stray.push({ line: first + i, text: line.trim() });
  });
  if (section) {
    let table = "before"; // before, in or after the section's first table
    section.text.split("\n").map((line) => line.replace(/\r$/, "")).forEach((line, i) => {
      const isRow = TABLE_LINE.test(line);
      if (table === "before" && isRow) table = "in";
      else if (table === "in" && !isRow) table = "after";
      if (!line.trim() || (table === "in" && isRow)) return;
      stray.push({ line: section.line + 1 + i, text: line.trim() });
    });
  }
  return stray;
}

/**
 * holdsRole(assignment: Document, participant: string, role: string) -> boolean — whether the role assignment gives the
 * participant the role (A JOB GOES ONLY TO A HOLDER OF ITS ROLE). A job's role assignment is its team's in a model with
 * sprints, and the product's one otherwise.
 * @param {Document} assignment — a role assignment, as readDocument returns it with roleAssignmentSchema
 * @param {string} participant — a participant's name in the instance's list
 * @param {string} role — a role of the product's process
 * @returns {boolean}
 */
export const holdsRole = (assignment, participant, role) => holdersOf(assignment, role).includes(participant);

/**
 * roleAssignmentFindings(assignments: Document[], workflow: Workflow, participants: Document, sources: Document[]) ->
 * Finding[] — the findings of a product's role assignments, read together: for each assignment in the order given, its
 * findings in the order of their lines, each naming the assignment's path — it has no identifier — and the requirement it
 * applies. Each an error:
 * - more than one role assignment where the model works without sprints, on line 1 of each (A PRODUCT HAS ONE ROLE
 *   ASSIGNMENT, OR ONE PER TEAM);
 * - a role the workflow does not have, on its row; a line besides the roles table and the file's title, on that line (A
 *   ROLE ASSIGNMENT FILLS THE ROLES);
 * - more than one participant for a role that one participant fills, on its row (A ROLE NAMES HOW MANY FILL IT);
 * - a name the instance's list does not hold, on its row (PARTICIPANTS ARE CONFIGURED ONCE PER INSTANCE);
 * - a role that needs a person, of which no holder is a person of the list, on its row, or on the heading ## Roles where no
 *   row names it, and a person of the list holding a role that an agent fills, on its row, naming the role and the person;
 *   a role that either may fill takes both (A PROCESS MODEL ORGANISES PEOPLE AND AGENTS);
 * - a holder that lacks a capability its role needs, on its row, naming the holder, the role and the capability, decided by
 *   MOD-participant-list's `eligible` called once per capability (A ROLE NAMES THE CAPABILITIES IT NEEDS).
 * A warning: a holder, of those that declare a processing place, at a place one of `sources` does not permit, on its row,
 * naming the holder, the role and the source, decided by `eligible` called once per source whose `permittedPlaces` is not
 * `"any"` (RESTRICTED CONTENT GOES ONLY WHERE ITS SOURCE PERMITS). A holder with no declared place — every person — is
 * judged by its capabilities alone. The same participant in the role assignments of several teams is no finding (A
 * PARTICIPANT MAY SERVE SEVERAL TEAMS).
 * @param {Document[]} assignments — the product's docs/role-assignments/*.md, as readDocument returns them with
 *   roleAssignmentSchema
 * @param {Workflow} workflow — the product's workflow, as workflowOf gives it
 * @param {Document} participants — the instance's docs/participants.md, as readDocument returns it with
 *   MOD-participant-list's participantSchema
 * @param {Document[]} sources — the register entries of the sources the product links
 * @returns {Finding[]}
 */
export function roleAssignmentFindings(assignments, workflow, participants, sources) {
  const listed = participantsOf(participants);
  const names = new Set(listed.map((p) => p.name).filter(Boolean));
  const persons = new Set(listed.filter((p) => p.type === "person").map((p) => p.name));
  const sprints = Boolean(workflow.model?.flow?.sprints);
  const paths = assignments.map((assignment) => assignment.id ?? assignment.path);
  return assignments.flatMap((assignment, place) => {
    const artifact = paths[place];
    const found = [];
    const add = (line, rule, what, fix) => found.push(finding({ artifact, line, kind: "error", rule, what, fix }));
    const warn = (line, rule, what, fix) => found.push(finding({ artifact, line, kind: "warning", rule, what, fix }));

    if (!sprints && assignments.length > 1) {
      add(1, ONE_OR_PER_TEAM, `the model ${workflow.model?.name} works without sprints, so the product has one role `
        + `assignment, not ${assignments.length}: ${paths.join(", ")}`, "keep one role assignment, and remove the others");
    }
    for (const { line, text: written } of strayLines(assignment)) {
      add(line, FILLS, `the role assignment holds "${written}", which is no part of its roles table`,
        "remove the line: a role assignment only gives the roles of the process their participants");
    }

    const rows = rowsOf(assignment);
    for (const row of rows) {
      const role = workflow.roles.find((candidate) => candidate.name === row.role);
      if (!role) {
        add(row.line, FILLS, `the role ${row.role} is no role of the product's process`,
          `name a role of the process: ${workflow.roles.map((candidate) => candidate.name).join(", ")}`);
        continue;
      }
      if (role.howMany === "one" && row.holders.length > 1) {
        add(row.line, HOW_MANY, `one participant fills the role ${row.role}, and the assignment gives it `
          + `${row.holders.length}: ${row.holders.join(", ")}`, `give ${row.role} one participant`);
      }
      for (const holder of row.holders.filter((name) => !names.has(name))) {
        add(row.line, ONCE_PER_INSTANCE, `the participant ${holder} is not in the instance's list docs/participants.md`,
          `name a participant of docs/participants.md, or add ${holder} there`);
      }
      if (role.filledBy === "agent") {
        for (const holder of row.holders.filter((name) => persons.has(name))) {
          add(row.line, PEOPLE_AND_AGENTS, `the role ${row.role} is filled by an agent, and the person ${holder} holds it`,
            `assign to ${row.role} an agent of the instance's list instead of ${holder}`);
        }
      }
    }

    const headingLine = rolesSection(assignment)?.line ?? 1;
    for (const role of workflow.roles.filter((candidate) => candidate.filledBy === "person")) {
      const roleRows = rows.filter((row) => row.role === role.name);
      if (!roleRows.some((row) => row.holders.some((holder) => persons.has(holder)))) {
        add(roleRows[0]?.line ?? headingLine, PEOPLE_AND_AGENTS, `the role ${role.name} needs a person, and no person holds it`,
          `assign to ${role.name} a participant of the type person`);
      }
    }

    for (const role of workflow.roles) {
      for (const row of rows.filter((candidate) => candidate.role === role.name)) {
        const holders = listed.filter((p) => row.holders.includes(p.name));
        for (const capability of role.capabilities) {
          for (const { participant } of eligible(holders, { capabilities: [capability] }).leftOut) {
            add(row.line, CAPABILITY, `the holder ${participant.name} of the role ${role.name} lacks the capability ${capability}`,
              `give ${participant.name} the capability ${capability}, or assign ${role.name} a holder that has it`);
          }
        }
        const placed = holders.filter((p) => p.place);
        for (const source of sources) {
          const allowed = permittedPlaces(source);
          if (allowed === "any") continue;
          const from = source.id ?? source.path;
          for (const { participant } of eligible(placed, { capabilities: [], places: [{ from, allowed }] }).leftOut) {
            warn(row.line, PERMITTED, `the holder ${participant.name} of the role ${role.name} processes data at `
              + `${participant.place}, which the source ${from} does not permit`,
              `move ${participant.name} to a place ${from} permits, or assign ${role.name} a different holder`);
          }
        }
      }
    }
    return found.sort((a, b) => a.line - b.line);
  });
}
