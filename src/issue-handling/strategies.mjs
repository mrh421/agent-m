// The recipes of issueStrategies (MOD-issue-handling, Parts: strategies.mjs; Interfaces: issueStrategies).
// Of it, ITM-582 builds the recipe `issue-context`, ITM-583 the recipe `fix-inputs`.
//
// Module: MOD-issue-handling
//
// Strategies, JobContext and Part are MOD-job-runner's types. The recipe reads the product through the job's snapshot and its host (`context.product`). Where the module file leaves a reading open,
// this file states the one it takes:
//   - The issue is the one of the job's parameter `issue` among `host.listIssues({ state: "all" })`; a number the host lists none under is IssueNotFound { issue }, and a parameter that is no number a TypeError.
//   - A requirement is named by the issue where its title, its text or a comment holds the requirement's name as the SPEC writes it and the name is not a part of a longer name of the SPEC that the text holds
//     (`requirementNamesIn` reads head lines only, which an issue seldom writes). A use case, a test or a module is named where the text holds its identifier. A name or an identifier the product does not
//     hold is no part and no failure: the issue's own part holds the text.
//   - A job without the parameter `issue` — undefined or null — gets no part (`draft?` gives none without a draft either): a change by prompt has no issue. A parameter that is no whole number is a TypeError.
//   - Parts, in this order: the issue, named `issue #<number>`; the requirements named, in the order of the SPEC; then, for each use case, test or module named, in the order the text names them, its file, named by its
//     path, and the requirements the graph links to it — what it realises or guards, and for a module what the tests that exercise it guard —, not given before. A part is given once.
//   - The issue's part holds its title, its text and the text of each comment, and no author and no date. The text of an issue from a mail is neutral by construction; the recipe makes no request but the host's
//     and the snapshot's, so that no mail is ever a part.
//   - A product without a SPEC.md is SpecNotFound { path }: a recipe never gives a part from less than the SPEC.
//
// The recipe `fix-inputs` (ITM-583) reads, besides the job's parameter `issue`, the confirmed analysis as the parameters `violated` (the name of the requirement the bug violates), `wrong` (the files the analysis names as wrong, a test or code, as `analyse-issue` answers
// them) and `modules` (the modules the fix changes); a parameter that is left out, null, empty or an empty list is not given. Where the texts leave a reading open, this file takes the one it names:
//   - The parts, in this order: those of `issue-context`; one part `confirmed analysis`, where the job gives a violated requirement, files or modules; those of MOD-run-planner's `implementation-inputs` for `modules`, where the job gives any, each part once; one part
//     `regression test first`, the instruction. A job without the parameter `issue` gets no part of `issue-context`, as there; the other parts do not depend on it.
//   - The part `confirmed analysis` states the requirement as the SPEC states it, and lists the files named as wrong and the modules. A violated requirement the SPEC does not hold is UnknownRequirement { requirement }, since the pull request is to name it.
//   - The part `regression test first` is the instruction to write first a regression test that fails on the reported behaviour, with invented data only; it names the issue's address, which the pull request links, and the requirement it restores, and, where the job's
//     identifier is known, the line `Job: <id>` the pull request's description begins with. It says how the product's pseudonymisation (MOD-personal-data's `pseudonymisationOf` over `docs/settings.md`; on where the product has no settings) left the issue's report data.

import { parseSpec } from "../spec-document/index.mjs";
import { kindOfIdentifier } from "../identifiers/index.mjs";
import { traceGraph } from "../trace-graph/index.mjs";
import { runStrategies } from "../run-planner/index.mjs";
import { readDocument } from "../documents/index.mjs";
import { pseudonymisationOf, settingsSchemas } from "../personal-data/index.mjs";

const SPEC_PATH = "SPEC.md";
const SETTINGS_PATH = "docs/settings.md";
const NAMED_KINDS = new Set(["UC", "TST", "MOD"]);
const IDENTIFIER = /\b(?:UC|TST|MOD)-[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*/g;

// A failure of the module's own, by name, with the fields its message names.
const failure = (name, message, fields) => Object.assign(new Error(message), { name, ...fields });
const partOf = (name, text) => ({ name, text, size: 0, sources: [], required: true });
const unique = (values) => [...new Set(values)];

// The requirement as the SPEC states it: its name and source, its rule, its check; a field it lacks is left out.
const stated = ({ name, source, rule, check }) => [`**${name}**${source === null ? "" : ` *(${source})*`}`, rule, check === null ? null : `*Check:* ${check}`]
  .filter((line) => line !== null).join("\n");

// The title, the text and the comments of an issue.
const issueText = (issue) => [`Issue #${issue.number}: ${issue.title}`, "", issue.body, ...issue.comments.flatMap((comment, at) => ["", `Comment ${at + 1}:`, comment.body])].join("\n");

// The names among `names` that `text` holds, a name that only stands in a longer name that the text holds not counted.
function namesIn(text, names) {
  const found = new Set();
  let rest = text;
  for (const name of [...names].sort((a, b) => b.length - a.length)) {
    if (!rest.includes(name)) continue;
    found.add(name);
    rest = rest.split(name).join(" ");
  }
  return found;
}

// The requirements the graph links to a use case, test or module: what it realises or guards, and for a module what the tests that exercise it guard.
function linkedTo(graph, id, spec) {
  const guards = (from) => graph.edges.filter((edge) => edge.from === from && ["realises", "guards"].includes(edge.via)).map((edge) => edge.to);
  const tests = graph.nodes.get(id).kind === "MOD" ? graph.edges.filter((edge) => edge.via === "exercises" && edge.to === id).flatMap((edge) => guards(edge.from)) : [];
  return unique([...guards(id), ...tests]).filter((name) => spec.requirements.has(name));
}

// The issue of the job's parameter `issue` and the parts of `issue-context` for it; none for a job without the parameter.
async function issueAndParts(context, params) {
  const number = params?.issue;
  if (number === undefined || number === null) return null;
  if (!Number.isInteger(number)) throw new TypeError("issue-context: a job needs the number of the issue to analyse as its parameter issue");
  const { snapshot, host } = context.product;
  const issue = (await host.listIssues({ state: "all" })).find((each) => each.number === number);
  if (!issue) throw failure("IssueNotFound", `the product lists no issue ${number}`, { issue: number });
  const specText = await snapshot.read(SPEC_PATH);
  if (specText === null || specText === undefined) throw failure("SpecNotFound", `the product holds no ${SPEC_PATH}`, { path: SPEC_PATH });
  const spec = parseSpec(specText);

  const text = [issue.title, issue.body, ...issue.comments.map((comment) => comment.body)].join("\n");
  const identifiers = unique(text.match(IDENTIFIER) ?? []).filter((id) => NAMED_KINDS.has(kindOfIdentifier(id)));
  const graph = identifiers.length > 0 ? await traceGraph(snapshot) : null;
  const artifacts = identifiers.filter((id) => graph.nodes.has(id));

  const named = namesIn(text, spec.requirements.keys());
  const given = new Map();
  const give = (name, body) => { if (!given.has(name)) given.set(name, partOf(name, body)); };
  const requirement = (name) => give(name, stated(spec.requirements.get(name)));

  give(`issue #${number}`, issueText(issue));
  for (const name of spec.requirements.keys()) if (named.has(name)) requirement(name);
  for (const id of artifacts) {
    const { path } = graph.nodes.get(id);
    give(path, await snapshot.read(path));
    for (const name of linkedTo(graph, id, spec)) requirement(name);
  }
  if (given.size === 1) give(SPEC_PATH, specText);
  return { issue, parts: [...given.values()] };
}

const issueContext = async (context, params) => (await issueAndParts(context, params))?.parts ?? [];

// The names a parameter lists, as strings; none for a parameter that is left out or null.
const listed = (value) => (Array.isArray(value) ? value.map(String).filter(Boolean) : []);

// What the product's pseudonymisation did to the report data in the issue, in the words of the instruction.
async function pseudonymisation(snapshot) {
  const text = await snapshot.read(SETTINGS_PATH);
  const setting = pseudonymisationOf(text == null ? null : readDocument((await settingsSchemas()).settings, SETTINGS_PATH, text));
  return setting === "off"
    ? "The product switched pseudonymisation off, so the report data in the issue entered it unchanged: it may name persons. Put no name, address or account of a person into the test, the fix or the pull request."
    : "The product rewrites report data without persons: the report data in the issue is only as that rewriting left it, and names no person. It describes the behaviour to reproduce; it is not data for the fixtures, which you invent.";
}

async function fixInputs(context, params) {
  const { snapshot } = context.product;
  const parts = new Map();
  const give = (part) => { if (!parts.has(part.name)) parts.set(part.name, part); };
  const read = await issueAndParts(context, params);
  for (const part of read?.parts ?? []) give(part);

  const violated = typeof params?.violated === "string" && params.violated !== "" ? params.violated : null;
  const wrong = listed(params?.wrong), modules = listed(params?.modules);
  let restored = null;
  if (violated !== null) {
    const specText = await snapshot.read(SPEC_PATH);
    if (specText === null || specText === undefined) throw failure("SpecNotFound", `the product holds no ${SPEC_PATH}`, { path: SPEC_PATH });
    restored = parseSpec(specText).requirements.get(violated);
    if (!restored) throw failure("UnknownRequirement", `${violated} is no requirement of the product's ${SPEC_PATH}`, { requirement: violated });
  }
  if (restored || wrong.length || modules.length) {
    give(partOf("confirmed analysis", [
      "The analysis of the issue, as the person confirmed it:",
      ...(restored ? ["", "The requirement the bug violates:", stated(restored)] : []),
      ...(wrong.length ? ["", "Files the analysis names as wrong, each a test or code:", ...wrong.map((file) => `- ${file}`)] : []),
      ...(modules.length ? ["", "Modules the fix changes:", ...modules.map((module) => `- ${module}`)] : []),
    ].join("\n")));
  }
  if (modules.length) for (const part of await runStrategies.recipes["implementation-inputs"](context, { modules })) give(part);

  const address = read?.issue.url ?? null;
  give(partOf("regression test first", [
    "Write first a regression test that fails on the reported behaviour. Use invented data in its fixtures only — never the reporter's. If it passes before you change anything, stop and ask.",
    await pseudonymisation(snapshot),
    "Then fix the code, or the test where the test was wrong, until it passes and every other test with it.",
    `Open a pull request that links the issue${address ? ` by its address, ${address},` : ""} and names the requirement it restores${violated ? `, ${violated}` : ""}.${context.jobId ? ` Begin its description with the line \`Job: ${context.jobId}\`.` : ""}`,
  ].join("\n\n")));
  return [...parts.values()];
}

/**
 * issueStrategies — of MOD-job-runner's type `Strategies`: the recipe `issue-context`, for analysing an issue: one part with the issue's title, text and comments; parts with the requirements the issue names,
 * and the use cases, tests and modules it names together with the requirements the trace graph links to them, each with its text from the snapshot; the whole SPEC for an issue that names nothing.
 * And the recipe `fix-inputs`, for fixing a bug: the parts of `issue-context`; the confirmed analysis — the violated requirement, the files named as wrong, the modules —; the implementation inputs of those modules, as MOD-run-planner's `implementation-inputs` gives
 * them for its parameter `modules`; and the instruction to write a regression test first, with invented data only.
 */
export const issueStrategies = { recipes: { "issue-context": issueContext, "fix-inputs": fixInputs } };
