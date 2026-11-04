// MOD-run-planner — runs over a selection, their next actions, and the inputs of an implementation job (docs/architecture/MOD-run-planner.md): its interface. Of it, this file
// has runStrategies, the recipe implementation-inputs (inputs.mjs), runOf (run.mjs) and nextActions (next.mjs), which gives the CI setup, the implementation jobs in the order of the modules'
// interfaces, the resumptions and the refusal of a cycle.
//
// Module: MOD-run-planner
//
// It belongs to Process (ARC-042). It runs unchanged in a browser and in Node. It reads the product's files through the snapshot a job's context carries and through MOD-trace-graph's
// traceGraph, and writes nothing. Every other file of this folder is private to it.

export { runStrategies } from "./inputs.mjs";
export { runOf } from "./run.mjs";
export { nextActions } from "./next.mjs";
