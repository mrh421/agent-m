// MOD-product-process — a product's process: its declaration, workflow, gates and Definition of Done
// (docs/architecture/MOD-product-process.md): its interface. Of it are built: Workflow; declarationSchema, the schema of a
// product's docs/process.md, and declarationFindings (declaration.mjs); roleAssignmentSchema, the schema of a product's
// docs/role-assignments/<name>.md, roleAssignmentFindings and holdsRole (assignments.mjs); workflowOf, branchesOf and productWorkflow (workflow.mjs); and
// mayDecide, gateStates and recordGateDecision (gates.mjs); doneCheck (done.mjs); and gateSchema, the schema of a gate record docs/gates/<…>.md. A declaration names roles and never a participant; its role assignments fill the roles, and
// roleAssignmentFindings names a holder lacking a capability its role needs, and warns of a holder at a processing place a
// linked source does not permit: both through MOD-participant-list's eligible, over the participants its participantsOf
// gives. workflowOf adds a practice's additions only from its explicit model tables: a shipped practice states its
// `## Adds` in words only.
//
// Module: MOD-product-process
//
// It belongs to Process (ARC-042). It runs unchanged in a browser and in Node. Its reads are those of its own data files
// declaration.schema.md, role-assignment.schema.md and gate-record.schema.md — the schemas, in MOD-documents' language —, once each, in that
// order, when the module is loaded: from the disk in Node, from the module's own address in a browser. A schema that cannot
// be read, or that breaks the language, stops the module's load, as MOD-documents' file says of a broken schema: it stops
// that module, never a single document. Nothing else is read here, and nothing is written: the declaration, the role
// assignments, the register of participants, the source entries and the instance's SPEC are given by the callers, and the
// declaration and the role assignments are committed by the page as the person's own input. It uses MOD-documents,
// MOD-spec-document and MOD-text-tools only through their index.mjs. Every other file of this folder is private to the
// module.

// Schema, in the types below, is MOD-documents' type of that name; Model is MOD-model-catalogue's.
import { loadSchema } from "../documents/index.mjs";

export { declarationFindings } from "./declaration.mjs";
export { roleAssignmentFindings, holdsRole } from "./assignments.mjs";
export { branchesOf, productWorkflow, workflowOf } from "./workflow.mjs";
export { mayDecide, gateStates, recordGateDecision } from "./gates.mjs";
export { doneCheck } from "./done.mjs";

/**
 * The workflow of a product: the model it follows; the practices its declaration names; the model's phases, the transitions
 * between them and its verification pairs; its gates — the model's, each named `<phase> → <phase>`, then those the product's
 * process requirements add, each named by its requirement and marked with that requirement and the source the instance's
 * SPEC names for it —, each with the phases it stands between, the artifacts it checks, its condition, its decider, and the
 * practice that added it, null for every gate here; the model's roles, each with who may fill it, whether one participant
 * fills it or several may, and the capabilities it needs — who fills it is the product's role assignment's —; the branch of
 * each phase or time box that has one; and the Definition of Done: the job rules, then the conditions the declaration adds.
 * @typedef {{ model: Model, practices: string[], phases: Array<{ name: string, roles: string[], produces: string[] }>,
 *   transitions: Array<{ from: string, to: string, kind: string }>, pairs: Array<{ phase: string, checkedBy: string }>,
 *   gates: Array<{ name: string, from: string, to: string, artifacts: string, condition: string, decider: string,
 *     addedBy: { requirement: string, source: string | null } | null, practice: string | null }>,
 *   roles: Array<{ name: string, filledBy: string, howMany: string, capabilities: string[] }>,
 *   branches: Record<string, string>, done: string[] }} Workflow
 */

const OWNER = "MOD-product-process";
const DECLARATION_FILE = new URL("./declaration.schema.md", import.meta.url);
const ROLE_ASSIGNMENT_FILE = new URL("./role-assignment.schema.md", import.meta.url);
const GATE_RECORD_FILE = new URL("./gate-record.schema.md", import.meta.url);
const disk = globalThis.process?.getBuiltinModule?.("node:fs");

/**
 * declarationSchema: Schema — the schema of a product's declaration docs/process.md, read from this module's data file
 * declaration.schema.md with MOD-documents' loadSchema: for reading, writing and checking the declaration through
 * MOD-documents, and for the form of UC-002.
 */
export const declarationSchema = loadSchema(disk ? disk.readFileSync(DECLARATION_FILE, "utf8") : await ownFile(DECLARATION_FILE),
  OWNER);

/**
 * roleAssignmentSchema: Schema — the schema of a product's role assignment docs/role-assignments/<name>.md, read from this
 * module's data file role-assignment.schema.md with MOD-documents' loadSchema: for reading, writing and checking a role
 * assignment through MOD-documents, and for the form of UC-048.
 */
export const roleAssignmentSchema = loadSchema(disk ? disk.readFileSync(ROLE_ASSIGNMENT_FILE, "utf8")
  : await ownFile(ROLE_ASSIGNMENT_FILE), OWNER);

/**
 * gateSchema: Schema — the schema of a gate record docs/gates/<…>.md, read from this module's data file gate-record.schema.md with MOD-documents'
 * loadSchema: for reading and writing a record through MOD-documents, and for gateStates, recordGateDecision and the pages that show a gate.
 */
export const gateSchema = loadSchema(disk ? disk.readFileSync(GATE_RECORD_FILE, "utf8") : await ownFile(GATE_RECORD_FILE), OWNER);

// In a browser: the module's own file, from the address the module itself was loaded from. Throws an Error naming the file
// and the server's status when it is not served.
async function ownFile(url) {
  const answer = await fetch(url);
  if (!answer.ok) throw new Error(`${OWNER}: its ${url.pathname} was not served (${answer.status})`);
  return answer.text();
}
