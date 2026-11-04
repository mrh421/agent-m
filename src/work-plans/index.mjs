// MOD-work-plans — implementation plans, backlogs and sprints, and the state of each item
// (docs/architecture/MOD-work-plans.md): its interface. Of it, these are built: planSchemas, which gives the schema of the
// implementation plan's order, planOrder, and the schema of a team's sprint, sprint; ItemState, itemStates and startable;
// Held, heldItems, undecidedHeads and conflicts, the items the teams' sprints hold and what keeps an item from a team's selection; targetBranch, the branch an item's work is merged into;
// startSprint; endSprint; closeSprint, which adds the feedback's new items as saveItems does, in its one commit; giveUpIncrement; backlogFindings and planFindings, the findings of a backlog and of a plan
// (checks.mjs); savePlan and saveItems (saves.mjs); sprintFacts (facts.mjs); and workStrategies (strategies.mjs). A backlog keeps no order of its own:
// its items are listed after the items they build on.
//
// Module: MOD-work-plans
//
// It belongs to Process (ARC-042). It runs unchanged in a browser and in Node. Its own data file sprint.schema.md — the
// sprint's schema, in MOD-documents' language — is read once, when the module is loaded (schemas.mjs). heldItems, conflicts, targetBranch
// and states/startability read nothing themselves; startSprint, endSprint, closeSprint and giveUpIncrement read the product at the head they are given
// and commit through the host they are given (saves.mjs). It uses MOD-documents, MOD-text-tools and MOD-product-process only through their
// index.mjs. Every other file of this folder is private to it.

// Schema, in the type below, is MOD-documents' type of that name.
import { planOrderSchema, sprintSchema } from "./schemas.mjs";

export { backlogFindings, planFindings } from "./checks.mjs";
export { conflicts, heldItems, sprintsToClose, targetBranch, undecidedHeads } from "./sprints.mjs";
export { sprintFacts } from "./facts.mjs";
export { itemStates, startable } from "./states.mjs";
export { closeSprint, endSprint, giveUpIncrement, saveItems, savePlan, startSprint, WorkPlansError } from "./saves.mjs";
export { workStrategies } from "./strategies.mjs";

/**
 * planSchemas: { planOrder: Schema, sprint: Schema } — the schemas MOD-work-plans gives MOD-documents and the page's forms:
 * planOrder, the schema of docs/plan/order.md, and sprint, the schema of a team's sprint,
 * docs/backlog/sprints/<team>/<nn>.md, read from this module's data files with MOD-documents' loadSchema.
 */
export const planSchemas = { planOrder: planOrderSchema, sprint: sprintSchema };
