// The recipes of issueStrategies (MOD-issue-handling, Parts: strategies.mjs; Interfaces: issueStrategies).
// Of it, ITM-582 builds the recipe `issue-context`; `fix-inputs` is another item's.
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

import { parseSpec } from "../spec-document/index.mjs";
import { kindOfIdentifier } from "../identifiers/index.mjs";
import { traceGraph } from "../trace-graph/index.mjs";

const SPEC_PATH = "SPEC.md";
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

async function issueContext(context, params) {
  const number = params?.issue;
  if (number === undefined || number === null) return [];
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
  return [...given.values()];
}

/**
 * issueStrategies — of MOD-job-runner's type `Strategies`: the recipe `issue-context`, for analysing an issue: one part with the issue's title, text and comments; parts with the requirements the issue names,
 * and the use cases, tests and modules it names together with the requirements the trace graph links to them, each with its text from the snapshot; the whole SPEC for an issue that names nothing.
 */
export const issueStrategies = { recipes: { "issue-context": issueContext } };
