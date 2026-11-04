// MOD-progress-measures — a product's facts gathered once, and its progress in every measure
// (docs/architecture/MOD-progress-measures.md): its interface. Built: productFacts with the scopes `build`, `work` and `all` (facts.mjs; a fact
// a scope does not read is "unknown"), progressIn for a planned model, for a model with sprints and for a model with a work-in-progress limit
// (measures.mjs), and stageShares, currentStage, buildInProgress, waitingForAPerson and
// waitingForAcceptance (stages.mjs). gateOverview, whoWorksOnWhat and blocked (overviews.mjs) too, and the views of the progress, the backlog and the schedule page,
// progressView, backlogView, scheduleView and storedView (views.mjs).
//
// Module: MOD-progress-measures

export { waitingForAcceptance, stageShares, currentStage, buildInProgress, waitingForAPerson, publishOverview, storedOverview, latestOverview, waitingQueues } from "./stages.mjs";
export { progressIn } from "./measures.mjs";
export { productFacts } from "./facts.mjs";
export { blocked, gateOverview, whoWorksOnWhat } from "./overviews.mjs";
export { backlogView, progressView, scheduleView, storedView } from "./views.mjs";
