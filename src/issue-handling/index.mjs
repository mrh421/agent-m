// MOD-issue-handling: an issue handled as a bug or a change (docs/architecture/MOD-issue-handling.md).
// This entry offers the classes of an issue and the person's one click on the class, with the closing of an issue with links (classes.mjs), the item prefilled from an issue and the move into the backlog (backlog.mjs), and the recipes that give a participant the issue with
// the requirements, use cases and tests it touches, for its analysis and for the fix of a bug (strategies.mjs).
// Module: MOD-issue-handling

export { backlogItemFrom, moveToBacklog } from "./backlog.mjs";
export { IssueClass, closeWithLinks, confirmClass } from "./classes.mjs";
export { issueStrategies } from "./strategies.mjs";
