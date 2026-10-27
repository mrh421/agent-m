// MOD-spec-changes — SPEC change queues, from proposal to the accepted section (docs/architecture/MOD-spec-changes.md):
// its interface: Queue and queues, in queues.mjs; entryView, acceptEntries and applyApproved, in accept.mjs; rejectEntry, in reject.mjs; the recipes and the writer of
// specStrategies, in strategies.mjs and propose.mjs; entrySections, openQueueOf, proposeSection and saveEntry, in propose.mjs. requirementHistory
// is not built yet.
//
// Module: MOD-spec-changes

export { queues } from "./queues.mjs";
export { entryView, acceptEntries, applyApproved } from "./accept.mjs";
export { rejectEntry } from "./reject.mjs";
export { entrySections, openQueueOf, proposeSection, saveEntry } from "./propose.mjs";
export { specStrategies } from "./strategies.mjs";
