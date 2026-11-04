// MOD-spec-changes — SPEC change queues, from proposal to the accepted section (docs/architecture/MOD-spec-changes.md):
// its interface: Queue, queues and queueAt, in queues.mjs; entryView, entryImpact, acceptEntries and applyApproved, in accept.mjs; rejectEntry, in reject.mjs; the recipes and the writer of
// specStrategies, in strategies.mjs and propose.mjs; entrySections, proposeSection and saveEntry, in propose.mjs. requirementHistory
// is not built yet.
//
// Module: MOD-spec-changes

export { queues, queueAt } from "./queues.mjs";
export { entryView, entryImpact, acceptEntries, applyApproved } from "./accept.mjs";
export { rejectEntry } from "./reject.mjs";
export { entrySections, proposeSection, saveEntry } from "./propose.mjs";
export { specStrategies } from "./strategies.mjs";
