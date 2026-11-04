// kinds.mjs — the descriptors of the reviewed kinds this module shows (MOD-review-pages, Data): one record for each kind, which
// the one review flow in flow.mjs is driven by. ITM-355 builds the descriptor of the use cases, ITM-440 those of the architecture decisions and the module files, ITM-441 the whole architecture's Review all.
//
// Module: MOD-review-pages

// ReviewKind { kind, route, entry, title, plural, noun, record, explain, change } — `kind` is the kind MOD-approvals gives a reviewed
// file; `route` the first part of the address's fragment; `entry` the menu entry; `record` the identifier-and-title heading of
// a file, from its text; `explain` the topics of the folded "What is this?"; `change` the kind of job a message in the prompt bar runs
// on one of its files and, where a file is addressed by its identifier, the job's parameter that names it (the subject, subjects.mjs).
const heading = (body) => /^# (.+)$/m.exec(body)?.[1] ?? "";
const explain = { list: "accepting", all: "accepting", one: "accepting", changed: "edit-after-acceptance", edit: "edit-after-acceptance",
  fallback: "github-page-without-token" };

// `folders` names the folders and files of the repository a page of the kind reads (MOD-site-frame's Route `folders`): `list` for the list of
// its files, `all` for Review all, `file` for one file. The list reads the kind's files, the approval records, whose names give each status, and
// the group files; one file also what it is shown with — the job records of a kind that is drafted (the notes of the job that wrote it), and,
// for a kind whose file names what it rests on, the use cases and the SPEC, which tell what of that is accepted. Every page of the entries of a change
// queue reads the SPEC, whose sections they would replace, and the product's links file and the register, whose sources their requirements name
// and an acceptance checks. Drafting, the history and an editor read across the repository: they name no folders, and are given the whole tree.
// The pages of the use cases also read what an Accept that checks which modules the use cases change (`affected`) reads when the page is drawn, so that the page reads
// its commit once: the product's declaration of its process, its SPEC and architecture, which the job's parts give; and, on the instance's own page, the instance's
// catalogue of models — its own and the shipped ones, which MOD-model-catalogue reads at their paths in the instance — and its AGENTS.md, which the job's input begins with.
const READ = { approvals: "docs/approvals", groups: "docs/groups", jobs: "docs/jobs", useCases: "docs/use-cases", spec: "SPEC.md", process: "docs/process.md",
  architecture: "docs/architecture", models: "docs/process-models", shipped: "src/model-catalogue", rules: "AGENTS.md" };
const listOf = (folder) => [folder, READ.approvals, READ.groups];
const USE_CASE_LIST = [...listOf(READ.useCases), READ.process, READ.spec, READ.architecture, READ.models, READ.shipped, READ.rules], ARCHITECTURE_LIST = listOf(READ.architecture);
const RESTS_ON = [READ.useCases, READ.spec];
const SPEC_READS = [READ.spec, ...listOf("docs/spec-freigaben"), "docs/sources.md", "docs/sources"];

// `whole` marks the kind whose Review all is the review page of the whole architecture: the kinds of the files it shows together.
// `restsOn` marks a kind whose file names what it rests on (a decision its forces, a module what it realises): its page shows the
// section of what is not accepted yet, and offers no Accept while there is any.
// `affected` marks the kind whose Accept, in a product whose model pulls its work, has a participant check which modules each file accepted changes (affected-modules.mjs).
export const USE_CASES = { kind: "use-case", route: "use-case", entry: "use-cases", title: "Use cases", plural: "use cases", noun: "use case",
  heading, explain: { ...explain, draft: { requirements: "requirements-to-cover", participant: "drafting-participant", panel: "run-panel", loop: "correction-loop",
    written: "drafted-use-cases", ci: "ci-agent-draft" } }, draft: "derive-use-cases", save: "file", affected: true,
  change: { kind: "change-use-case", parameter: "useCase" },
  folders: { list: USE_CASE_LIST, all: USE_CASE_LIST, file: [...USE_CASE_LIST, READ.jobs] } };
export const DECISIONS = { kind: "architecture-decision", route: "decision", entry: "architecture", title: "Architecture decisions",
  plural: "architecture decisions", noun: "architecture decision", heading, restsOn: true, whole: ["architecture-decision", "module"], draft: "derive-architecture", save: "file",
  change: { kind: "change-architecture", parameter: "target" },
  folders: { list: ARCHITECTURE_LIST, all: [...ARCHITECTURE_LIST, ...RESTS_ON, READ.jobs], file: [...ARCHITECTURE_LIST, ...RESTS_ON, READ.jobs] },
  explain: { ...explain, draft: { whole: "what-is-an-architecture", participant: "drafting-participant", reviewer: "architecture-reviewer", panel: "run-panel",
    loop: "architecture-reviewer", ci: "ci-agent-draft" } } };
export const MODULES = { kind: "module", route: "module", entry: "architecture", title: "Module files", plural: "module files",
  noun: "module file", heading, explain, restsOn: true, save: "file", change: { kind: "change-architecture", parameter: "target" },
  folders: { list: ARCHITECTURE_LIST, all: [...ARCHITECTURE_LIST, ...RESTS_ON], file: [...ARCHITECTURE_LIST, ...RESTS_ON] } };

// The descriptor of the SPEC change entries (ITM-357): a file of a change queue, not a reviewed file with a record of its own kind; its files are
// the entries of docs/spec-freigaben/<queue>/, accepted through MOD-spec-changes.
export const SPEC_ENTRIES = { kind: "spec-entry", route: "spec-entry", entry: "requirements", title: "SPEC changes", plural: "SPEC change entries", noun: "SPEC change entry",
  explain: { list: "change-queue", one: "spec-edit-waits-for-approval", fallback: "github-page-without-token", edit: "spec-edit-waits-for-approval",
    draft: { source: "source-selection", participant: "drafting-participant", panel: "run-panel", loop: "correction-loop", ci: "ci-agent-draft" } },
  accept: "queue", draft: "derive-requirements",
  save: "entry", change: { kind: "change-requirements", parameter: "target" },
  folders: { list: SPEC_READS, all: SPEC_READS, file: SPEC_READS } };

// The descriptor of the release test reports (ITM-910): the files docs/tests/releases/v<version>.md, never edited, accepted through MOD-release-evidence, which releases on the acceptance.
// A report has no heading of its own; the page gives it its identifier, release-v<version>, and the title of its kind.
const reportHeading = (body) => { const version = /^version: (\S+)$/m.exec(body)?.[1]; return version ? `release-v${version} Release test report` : ""; };
export const RELEASE_REPORTS = { kind: "release-report", route: "release-report", entry: "releases", title: "Release test reports", plural: "release test reports",
  noun: "release test report", heading: reportHeading, accept: "release", limitations: true,
  explain: { list: "accepting", all: "accepting", one: "accepting", changed: "accepting", fallback: "github-page-without-token" } };

// The descriptors of editing a requirement (ITM-359): a requirement is a section of the SPEC, not a reviewed file; `edit` names the editing of its section, saved as an entry of
// the person's open queue of the day. REQUIREMENT_NEW is the same with the four fields empty, in the section handed in.
const requirementExplain = { edit: "spec-edit-waits-for-approval",
  draft: { participant: "drafting-participant", panel: "run-panel", loop: "correction-loop", ci: "ci-agent-draft" } };
export const REQUIREMENT = { kind: "requirement", route: "requirement", entry: "requirements", title: "Requirement", plural: "requirements", noun: "requirement",
  explain: requirementExplain, edit: "section", fresh: false, change: { kind: "change-requirements" } };
export const REQUIREMENT_NEW = { ...REQUIREMENT, route: "requirements", title: "New requirement", fresh: true };
