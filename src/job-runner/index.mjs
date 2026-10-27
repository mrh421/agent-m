// MOD-job-runner — the one runner of every job kind (docs/architecture/MOD-job-runner.md): its interface — the registry of
// strategies (registry.mjs) with the built-in recipes `instruction` and `draft`, the writer `return-draft` and the checks
// `document-schema`, `requirement-form`, `test-declarations`, `candidate-classes`, `group-rules` and `graph-checks`
// (builtins.mjs), and taskRefusal, whether a kind takes a handed-over task; prepareJob (prepare.mjs), what a run panel shows before the person's click; runJob with the correction
// loop, and writeResult (loop.mjs); provenanceLines and roundsText (provenance.mjs), with the round record's schema
// rounds.schema.md; driverPrompt (driver-prompt.mjs), the sending boundary's canonical input text.
//
// Module: MOD-job-runner
//
// It belongs to Participants and jobs (ARC-046). It runs unchanged in a browser and in Node. It keeps the registry of the
// strategies of the program it runs in, in memory, filled once by the program that composes it; it keeps nothing else. It
// reads the kinds through MOD-job-catalogue's kindOf and writes nothing. It knows no kind and no service by name. Every
// other file of this folder is private to the module.

// KindDefinition is MOD-job-catalogue's type; Participant MOD-participant-list's; Finding MOD-text-tools'; Classified
// MOD-documents'; Snapshot and Host MOD-repository-hosts'.
import { builtins } from "./builtins.mjs";
import { registerStrategies } from "./registry.mjs";
import { tools } from "./tools.mjs";

export { registerStrategies } from "./registry.mjs";
export { estimate, prepareJob } from "./prepare.mjs";
export { failedBecause, runJob, writeResult } from "./loop.mjs";
export { driverPrompt } from "./driver-prompt.mjs";
export { sourcesOf, withheld } from "./tools.mjs";
export { provenanceLines, roundsText } from "./provenance.mjs";
export { handOverParams, refusedEdit } from "./tools.mjs";
export { taskRefusal } from "./builtins.mjs";

/**
 * The plug-in contract: the recipes, checks, preconditions, steps and writers a module offers, each under its name. A
 * strategy throws only for a failure of its own input or output, and names it; a finding is returned, never thrown. A check
 * is also handed the job's parts, as a third argument, for one that judges the draft against what they show.
 * @typedef {{ recipes: Record<string, (context: JobContext, params: Record<string, unknown>) => Promise<Part[]>>,
 *   checks: Record<string, (draft: unknown, context: JobContext, parts: Part[]) => Finding[] | Promise<Finding[]>>,
 *   preconditions: Record<string, (context: JobContext) => Promise<Finding | null>>,
 *   steps: Record<string, (draft: unknown, context: JobContext) => Promise<{ draft: unknown, findings: Finding[] }>>,
 *   writers: Record<string, (result: unknown, context: JobContext) => Promise<unknown>> }} Strategies
 */

/**
 * Everything a strategy may read: the kind, the job's parameters, the product and the instance, opening another
 * repository, the participants, the places every restricted source and the mailbox allow, the gates at this job's points,
 * the person, the time, Agent M's version, and the job's identifier. `instance.checkout` is the folder of a checkout of the
 * instance, at the commit `agentM.commit`, in which the participant works and from which the instance's snapshot is read; null in a
 * browser. `product.checkout` is the folder of the checkout of the product in which a model endpoint's tools work (MOD-checkout-tools); null or
 * absent where there is none.
 * @typedef {{ kind: KindDefinition, params: Record<string, unknown>, product: { address: string, snapshot: Snapshot,
 *   host: Host | null, checkout?: string | null }, instance: { snapshot: Snapshot, host: Host | null, checkout?: string | null }, connect: (address: string) => Promise<Host>,
 *   participants: Participant[], places: { sources: Record<string, string[]>, mailbox: string[] | null, contents?: { source: string, paths: string[] }[] },
 *   gates: Array<{ name: string, point: string, passed: boolean }>, person: string | null, now: Date,
 *   agentM: { version: string, commit: string }, jobId: string | null }} JobContext
 */

/**
 * One piece of a job's input: its size in tokens as estimated; the identifiers of the sources whose content it carries;
 * required false only where the kind says the part may be left out; the recipe that gave it, whose named place of the
 * prompt it fills — set by the runner, not by the recipe —; and the existing artifacts it shows the participant, each with its
 * identifier and the values of its format's key — for a requirement its name and its rule —, against which candidate-classes
 * classifies a draft. A part whose recipe gives none shows none.
 * @typedef {{ name: string, text: string, size: number, sources: string[], required: boolean, recipe: string,
 *   artifacts: Array<{ id: string, keys: string[] }> }} Part
 */

/**
 * One participant behind its route: send makes one exchange and returns the participant's answer as text and the usage its
 * runtime reported, or null; it throws the failure of its route by name, and never retries until an answer pleases.
 * @typedef {{ participant: Participant, send(input: DriverInput, options?: { onOutput?: (chunk: string) => void,
 *   signal?: AbortSignal }): Promise<{ text: string, usage: Usage | null }> }} Driver
 */

/**
 * What a driver sends: the kind's prompt with each recipe's parts in its named place, the parts, the output schema the
 * answer must follow, the findings of the last round with the draft they concern, and for an agent that works in a
 * folder, that folder.
 * @typedef {{ prompt: string, parts: Part[], output: object | null, findings: Finding[], previous: string | null,
 *   workdir: string | null }} DriverInput
 */

/**
 * Exactly what a runtime reported; nothing is estimated.
 * @typedef {{ inputTokens: number | null, outputTokens: number | null, minutes: number | null,
 *   cost: { amount: number, currency: string } | null }} Usage
 */

/**
 * One round of the correction loop: its findings, how the drafter answered them, and whether the draft changed.
 * @typedef {{ number: number, findings: Finding[], answers: Array<{ finding: Finding, how: "fixed" | "justified" |
 *   "answered", text: string | null }>, changed: boolean }} Round
 */

/**
 * What a writer did; `shown` is what return-draft hands back; `notes` what the writer changed of the draft while writing, one line
 * each, which the job's end record lists. A writer whose every file already stands on the head as it would write it commits nothing:
 * its outcome has no commit. The runner hands an outcome on as the writer gave it.
 * @typedef {{ commits: string[], files: string[], pullRequest: string | null, shown: unknown, notes: string[] }} WriteOutcome
 */

/**
 * A job's result: the draft as the output schema reads it; the raw answer, kept for a person when it could not be read;
 * the drafter; every round; what the loop left; what a person decides; what the kind's steps found; the classes of the last
 * round's candidates, null for a kind without the check candidate-classes; why the loop stopped; the gate it stopped at; the
 * usage of every exchange; what the writer did when it ran at once.
 * @typedef {{ draft: unknown, raw: string | null, drafter: Participant | null, rounds: Round[], remaining: Finding[],
 *   forPerson: Finding[], stepFindings: Finding[], classes: Classified[] | null, stoppedBecause: "passed" | "limit" |
 *   "unchanged" | "unusable" | "not checked" | "gate", gate: string | null, usage: Array<{ participant: string, usage:
 *   Usage | null }>, written: WriteOutcome | null }} JobResult
 */

/**
 * One participant that will receive something, and what.
 * @typedef {{ participant: Participant, role: "drafter" | "reviewer" | "checker", place: string, parts: string[],
 *   size: number }} Destination
 */

/**
 * What a run panel shows before the person's click: blocking holds the findings of preconditions, of eligibility and of a
 * check that needs what the context lacks — test-declarations without the product's host — that keep the job from starting.
 * rules is Agent M's AGENTS.md, from the instance — its text, or its path in a checkout of the instance —, with which every input to a model
 * begins; null where the instance has none.
 * @typedef {{ kind: KindDefinition, params: Record<string, unknown>, drafter: Participant | null, reviewers: Participant[], rules: Part | null,
 *   parts: Part[], destinations: Destination[], fits: boolean, notFitting: Array<{ participant: Participant, size: number,
 *   context: number | null }>, leftOut: Array<{ part: string, reason: string }>, blocking: Finding[], limit: number }} Prepared
 */

registerStrategies("MOD-job-runner", { ...builtins, tools });
