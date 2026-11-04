// The workflow of a product (MOD-product-process, Interfaces: Workflow, workflowOf): what its declared model, practices,
// and process requirements add — and nothing else (THE MODEL DETERMINES THE PHASES AND THE GATES, A PRACTICE IS NOT A MODEL,
// A PROCESS REQUIREMENT ADDS TO THE MODEL). index.mjs offers workflowOf and branchesOf.
//
// Module: MOD-product-process
//
// A practice contributes only explicit model-table data below ## Adds. Its prose stays readable on the page but creates no
// workflow entry. The Definition of Done is the job rules of the module file's Data, then the conditions the declaration
// adds (THE DEFAULT DEFINITION OF DONE IS THE JOB RULES).

import { readDocument } from "../documents/index.mjs";
import { catalogue, modelSchema } from "../model-catalogue/index.mjs";
import { parseSpec } from "../spec-document/index.mjs";
import { addedGatesOf, branchesOf as branchRowsOf, conditionsOf, practicesOf } from "./declaration.mjs";

/**
 * branchesOf(declaration: Document) -> Record<string, string> — the declaration's ## Branches, each phase or time box with its branch as
 * written; empty without the section. The one reader of ## Branches: workflowOf gives it as Workflow.branches.
 */
export const branchesOf = (declaration) => Object.fromEntries(branchRowsOf(declaration).map(({ at, branch }) => [at, branch]));

// The job rules, which every Definition of Done holds, as the module file states them.
const JOB_RULES = [
  "CI is green",
  "the job's first commit holds only tests and CI was red on it — for a refactoring job, CI was green on every commit and "
    + "no test's expected result changed",
  "every changed code file lies in the folder of one of the job's modules",
  "every new test names a requirement and a module",
  "every gate the workflow places before the merge is recorded",
];

const text = (value) => (typeof value === "string" ? value : "");
const EXPLAINED = /[ \t]*\([^()]*\)\s*$/;
const kindOf = (produced) => produced.replace(EXPLAINED, "").trim();
// The names a cell lists, separated by commas.
const namesOf = (cell) => text(cell).split(",").map((name) => name.trim()).filter(Boolean);

// The explicit model-table data in a practice's ## Adds, optionally under its matching level-three heading. Its explanation
// is otherwise free text, so only a table with exactly the model-table columns becomes workflow data.
function additionsTable(document, heading, columns) {
  const adds = document.sections.find((section) => section.heading === "## Adds")?.text ?? "";
  const lines = adds.split("\n");
  const start = lines.findIndex((line) => line.trim() === `### ${heading}`);
  const end = lines.findIndex((line, index) => index > start && /^###[#]?[ \t]/.test(line));
  const cells = (line) => line.trim().replace(/^\||\|$/g, "").split("|").map((cell) => cell.trim());
  const rowsOf = (block) => {
    const header = block.findIndex((line) => line.trim().startsWith("|") && JSON.stringify(cells(line)) === JSON.stringify(columns));
    if (header < 0 || !/^\|?\s*:?-+:?\s*(?:\|\s*:?-+:?\s*)+\|?$/.test(block[header + 1] ?? "")) return [];
    const body = [];
    for (const line of block.slice(header + 2)) {
      if (!line.trim().startsWith("|")) break;
      body.push(line);
    }
    return body.map(cells).filter((row) => row.length === columns.length)
      .map((row) => Object.fromEntries(columns.map((column, index) => [column, row[index]])));
  };
  return rowsOf(start < 0 ? lines : lines.slice(start + 1, end < 0 ? lines.length : end));
}

function additionsOf(practices) {
  return practices.map((document) => ({
    practice: text(document.fields.name),
    phases: additionsTable(document, "Phases", ["Name", "Role", "Produces"]),
    gates: additionsTable(document, "Gates", ["Between", "Artifacts", "Condition", "Decider"]),
    roles: additionsTable(document, "Roles", ["Name", "Filled by", "How many", "Capabilities"]),
  }));
}

function between(written) {
  const at = written.indexOf("→");
  return at < 0 ? { from: written, to: "" } : { from: written.slice(0, at).trim(), to: written.slice(at + 1).trim() };
}

/**
 * workflowOf(declaration: Document, model: Model, practices: Document[], instanceSpec: string) -> Workflow — the model's
 * phases, transitions, verification pairs and gates, each gate named `<phase> → <phase>`; then the gates and their artifacts
 * that the process requirements add, as the declaration's `## Gates added by requirements` names them, each named by its
 * requirement and marked with it and the source that requirement names in the instance's SPEC — a gate whose requirement
 * that SPEC does not hold stays, with the source null, and declarationFindings names it —; nothing else enters the workflow.
 * With them: the practices the declaration names, the model's roles — each with who may fill it, how many fill it and the
 * capabilities it needs; who fills it is the product's role assignment's —, the branch `## Branches` sets for each phase or
 * time box, and the Definition of Done — the job rules, then each condition the declaration adds. A selected practice contributes only its explicit `### Phases`, `### Gates` and `### Roles` model tables
 * below `## Adds`; a phase's `Produces` is its artifact addition, and a practice gate names its practice.
 * @param {Document} declaration — the product's docs/process.md, as readDocument returns it with declarationSchema
 * @param {Model} model — the declared model, as the catalogue at the commit the declaration names gives it
 * @param {Document[]} practices — the declared practices' files, read with MOD-model-catalogue's practice schema
 * @param {string} instanceSpec — the text of the instance's SPEC.md, whose requirements are the process requirements
 * @returns {Workflow}
 */
export function workflowOf(declaration, model, practices, instanceSpec) {
  const requirements = parseSpec(instanceSpec).requirements;
  const selected = new Set(practicesOf(declaration).map((practice) => practice.name));
  const additions = additionsOf(practices.filter((practice) => selected.has(text(practice.fields.name))));
  return {
    model,
    practices: [...selected],
    phases: [
      ...model.phases.map(({ name, roles: working, produces }) => ({ name, roles: [...working], produces: [...produces] })),
      ...additions.flatMap(({ phases }) => phases.map((phase) =>
        ({ name: phase.Name, roles: namesOf(phase.Role), produces: phase.Produces.split(",").map(kindOf).filter(Boolean) }))),
    ],
    transitions: model.transitions.map(({ from, to, kind }) => ({ from, to, kind })),
    pairs: model.pairs.map(({ phase, checkedBy }) => ({ phase, checkedBy })),
    gates: [
      ...model.gates.map(({ from, to, artifacts, condition, decider }) =>
        ({ name: `${from} → ${to}`, from, to, artifacts, condition, decider, addedBy: null, practice: null })),
      ...addedGatesOf(declaration).map(({ requirement, from, to, artifacts, condition, decider }) =>
        ({ name: requirement, from, to, artifacts, condition, decider,
          addedBy: { requirement, source: requirements.get(requirement)?.source ?? null }, practice: null })),
      ...additions.flatMap(({ practice, gates }) => gates.map((gate) => {
        const { from, to } = between(gate.Between);
        return { name: `${from} → ${to}`, from, to, artifacts: gate.Artifacts, condition: gate.Condition,
          decider: gate.Decider, addedBy: null, practice };
      })),
    ],
    roles: [
      ...model.roles.map(({ name, filledBy, howMany, capabilities }) => ({ name, filledBy, howMany,
        capabilities: [...capabilities] })),
      ...additions.flatMap(({ roles: added }) => added.map((role) => ({ name: role.Name, filledBy: role["Filled by"],
        howMany: role["How many"], capabilities: namesOf(role.Capabilities) }))),
    ],
    branches: branchesOf(declaration),
    done: [...JOB_RULES, ...conditionsOf(declaration)],
  };
}

/**
 * productWorkflow(declaration, instanceAt, instanceSpec) -> Promise<Workflow | null> — the product's workflow as it declared it: the catalogue
 * of the instance at the commit the declaration's `model_version` names (`instanceAt`), the model it holds at `model_file`, the practices the
 * declaration names, read with MOD-model-catalogue's practice schema from the instance at that commit, and `workflowOf` of them; null where that
 * catalogue holds no model at `model_file`. Fails as `instanceAt` fails.
 * @param {Document} declaration — the product's docs/process.md
 * @param {(commit: string) => Promise<Snapshot>} instanceAt — the instance repository at one commit
 * @param {string} instanceSpec — the text of the instance's SPEC.md
 * @returns {Promise<Workflow | null>}
 */
export async function productWorkflow(declaration, instanceAt, instanceSpec) {
  const at = await instanceAt(text(declaration.fields.model_version));
  const held = await catalogue(at);
  const model = held.models.find((candidate) => candidate.path === text(declaration.fields.model_file)) ?? null;
  if (model === null) return null;
  const named = new Set(practicesOf(declaration).map((practice) => practice.name));
  const practices = (await Promise.all(held.practices.filter((practice) => named.has(practice.name)).map(async (practice) => {
    const practiceText = await at.read(practice.path);
    return practiceText === null ? null : readDocument(modelSchema.practice, practice.path, practiceText);
  }))).filter(Boolean);
  return workflowOf(declaration, model, practices, instanceSpec);
}
