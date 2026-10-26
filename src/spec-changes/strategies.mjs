// strategies.mjs — the recipes of requirements of specStrategies (MOD-spec-changes, Parts: strategies.mjs; Interfaces: specStrategies).
// Of it, ITM-337 builds the recipes `chosen-requirements`, `named-requirements` and `spec-with-queues`, ITM-438 the recipe `whole-spec`, and ITM-338 the writer `queue-entries` (propose.mjs).
//
// Module: MOD-spec-changes
//
// Strategies, JobContext and Part are MOD-job-runner's types. A recipe reads the product of the job's context through its snapshot: its
// SPEC, `SPEC.md`, and its change queues; a file the snapshot cannot read fails the recipe with the snapshot's own failure, unchanged,
// so that a requirement is never left out silently. The job's parameter `requirements` is the list of names that `chosen-requirements`
// and `named-requirements` read — as MOD-approvals' `rests-on-accepted` reads it for the same job: a value that is not a list names none.
// Where the module file leaves a reading open, this file states the one it takes:
//
//   - A name the SPEC does not hold, one that stands only in an open entry among them, is RequirementNotFound { requirements }, naming
//     every such name in the order given.
//   - A requirement's part is named by it and holds it as the SPEC states it, without its neighbours, and shows no artifact; for
//     `named-requirements` it holds the whole section the requirement stands in instead, byte for byte, or the requirement as the SPEC
//     states it where it stands in none. The job runner sets a part's size and the recipe it fills.
//   - Without a choice, `chosen-requirements` gives the requirements in the order MOD-trace-graph's coverageGaps lists them.
//   - `spec-with-queues` gives one part, or none where the product has no requirement at all. Its text is blocks separated by an empty
//     line, one for each requirement: the state, the heading line of the section it stands in where it stands in one, and the
//     requirement as the SPEC states it. The SPEC's requirements come first, in the order they stand, with the state `in SPEC`; then
//     those of the entries that are not in SPEC, queues newest first as `queues` gives them, each queue's entries in the order of its
//     index and each proposal's requirements in the order they stand, with the state of their entry: an entry that is not in SPEC is a
//     proposal the product does not hold yet, and one that is in SPEC is the SPEC's already.

import { parseSpec, sectionText } from "../spec-document/index.mjs";
import { coverageGaps, traceGraph } from "../trace-graph/index.mjs";
import { queueEntries } from "./propose.mjs";
import { queues } from "./queues.mjs";
import { finding } from "../text-tools/index.mjs";

const SPEC_PATH = "SPEC.md";
const IN_SPEC = "in SPEC";

// A failure of the module's own, by name, with the fields its message names.
const failure = (name, message, fields) => Object.assign(new Error(message), { name, ...fields });

// The requirement as the SPEC states it: its name and source, its rule, its check; a field it lacks is left out.
const stated = ({ name, source, rule, check }) => [`**${name}**${source === null ? "" : ` *(${source})*`}`, rule,
  check === null ? null : `*Check:* ${check}`].filter((line) => line !== null).join("\n");

// A part: the job runner sets its size and the recipe it fills.
const partOf = (name, text) => ({ name, text, size: 0, sources: [], required: true });

// The requirements of `spec` that `names` name, in the order given. Throws RequirementNotFound { requirements } for the names it does not hold.
function named(spec, names) {
  const missing = names.filter((name) => !spec.requirements.has(name));
  if (missing.length > 0) {
    throw failure("RequirementNotFound", `the SPEC holds no requirement ${missing.join(", ")}`, { requirements: missing });
  }
  return names.map((name) => spec.requirements.get(name));
}

const namesOf = (params) => (Array.isArray(params.requirements) ? params.requirements : []);

// The requirements the person chose, or without a choice those that no use case realises.
async function chosen(context, params) {
  const { snapshot } = context.product;
  const spec = parseSpec(await snapshot.read(SPEC_PATH));
  const choice = namesOf(params);
  const names = choice.length > 0 ? choice : coverageGaps(await traceGraph(snapshot)).requirementsWithoutUseCase;
  return named(spec, names).map((requirement) => partOf(requirement.name, stated(requirement)));
}

// The requirements the job's parameters name, each with the whole section it stands in; one that stands in none, as the SPEC states it.
async function sectionsOfNamed(context, params) {
  const text = await context.product.snapshot.read(SPEC_PATH);
  return named(parseSpec(text), namesOf(params)).map((requirement) =>
    partOf(requirement.name, sectionText(text, requirement.section) ?? stated(requirement)));
}

// A block of the part of `spec-with-queues`: the state and the section of a requirement, and the requirement.
const blockOf = ({ requirement, state }) =>
  `State: ${state}${requirement.section === null ? "" : ` · Section: ${requirement.section}`}\n${stated(requirement)}`;

// Every requirement of the SPEC and of every entry of every queue that is not in SPEC, each with its state, as one part.
async function withQueues(context) {
  const { snapshot } = context.product;
  const listed = [...parseSpec(await snapshot.read(SPEC_PATH)).requirements.values()]
    .map((requirement) => ({ requirement, state: IN_SPEC }));
  const open = (await queues(snapshot)).flatMap((queue) => queue.entries.filter(({ state }) => state !== IN_SPEC));
  // The proposals are named to Snapshot.readMany first, in one batch, so that the reads below find their texts held (A PAGE LOAD READS THE REPOSITORY IN BATCHES).
  await snapshot.readMany?.(open.map((entry) => entry.proposal.path));
  for (const entry of open) {
    const proposal = parseSpec(await snapshot.read(entry.proposal.path));
    listed.push(...[...proposal.requirements.values()].map((requirement) => ({ requirement, state: entry.state })));
  }
  return listed.length === 0 ? [] : [{ ...partOf("SPEC.md with its open queues", listed.map(blockOf).join("\n\n")),
    artifacts: listed.map(({ requirement }) => ({ id: requirement.name, keys: [requirement.name, requirement.rule ?? ""] })) }];
}

// The SPEC as it stands, as one part: its bytes, untouched. The job runner sets the part's size. A product without a SPEC.md is
// SpecNotFound { path }: a recipe never gives a part from less than the SPEC.
async function wholeSpec(context) {
  const text = await context.product.snapshot.read(SPEC_PATH);
  if (text === null || text === undefined) throw failure("SpecNotFound", `the product holds no ${SPEC_PATH}`, { path: SPEC_PATH });
  return [partOf(SPEC_PATH, text)];
}

/**
 * specStrategies: Partial<Strategies> — the strategies this module offers the job runner (ARC-046):
 * - recipe `chosen-requirements`: the requirements the job's parameter `requirements` names, in the order given, one part each, named by
 *   the requirement and holding it as the SPEC states it; without a choice, every requirement of the SPEC that no use case realises
 *   (MOD-trace-graph's coverageGaps). Throws RequirementNotFound { requirements } for names the SPEC does not hold;
 * - recipe `named-requirements`: the requirements the parameter names, in the order given, one part each, named by the requirement and
 *   holding the whole section it stands in, byte for byte. Throws as `chosen-requirements` does;
 * - recipe `spec-with-queues`: every requirement of the SPEC and of every open entry of every queue, each with its section and state, as
 *   one part, which carries each of them as an artifact — its name as the identifier, its name and its rule as the key — against which
 *   `candidate-classes` classifies a draft; no part for a product without a requirement;
 * - recipe `whole-spec`: the SPEC as it stands, byte for byte, as one part named SPEC.md. Throws SpecNotFound { path } for a product without one.
 */
// The precondition `person-source`: an error under THE PERSON WHO PROMPTS IS A SOURCE where the job's parameter `source` names no source, naming the two steps that are missing
// (UC-019 4b); none otherwise, so that a change of requirements by prompt starts only with the person's own source, wherever it runs.
async function personSource(context) {
  const source = context.params?.source;
  if (typeof source === "string" && source.trim() !== "") return null;
  return finding({ artifact: context.product?.address ?? SPEC_PATH, line: 1, kind: "error", rule: "THE PERSON WHO PROMPTS IS A SOURCE",
    what: "the person who asks for this change has no source of their own that the product links",
    fix: "register the person as a source (#library) and link that source to the product (#sources), then ask again" });
}

export const specStrategies = {
  preconditions: {
    "person-source": personSource,
  },
  recipes: {
    "chosen-requirements": chosen,
    "named-requirements": sectionsOfNamed,
    "spec-with-queues": withQueues,
    "whole-spec": wholeSpec,
  },
  writers: {
    "queue-entries": queueEntries,
  },
};
