// The correction loop (MOD-job-runner, Parts: loop.mjs): runJob, and writeResult for a result that waited for a person.
//
// Module: MOD-job-runner
//
// A round sends the drafter its input — the kind's prompt with each recipe's parts in that recipe's named place, the output
// schema, and from the second round the findings left open with the draft they concern —, reads its answer by the
// envelope every answer has, `{ "draft": …, "answers": [ { "finding", "how", "text" } ] }`, runs the kind's checks and
// asks each reviewing participant, whose draft is a list of findings and whose every finding is a warning. A finding whose
// rule the kind leaves to a person is kept for the person and never sent back. An error stays open until a round no longer
// finds it; a warning the drafter justified, or a reviewer's finding it answered with its reason, is settled. The loop
// stops when nothing is open, at the limit, or when a round leaves the open findings as they were. A round after which
// only a reviewer's answer could not be read asks that reviewer again, without sending the drafter anything.

import { finding, formatFinding } from "../text-tools/index.mjs";
import { kindOf } from "../job-catalogue/index.mjs";
import { classesOf } from "./builtins.mjs";
import { failure, strategyOf } from "./registry.mjs";
import { offerTools, withHeld } from "./tools.mjs";

const line = (f) => formatFinding(f);
const same = (a, b) => a.length === b.length && a.every((f, at) => line(f) === line(b[at]));

// The envelope of an answer whose draft has `draft`'s schema.
const envelopeOf = (draft) => ({ type: "object", required: ["draft"], properties: { draft, answers: { type: "array",
  items: { type: "object", required: ["finding", "how"], properties: { finding: { type: "string" },
    how: { type: "string", enum: ["fixed", "justified", "answered"] }, text: { type: "string" } } } } } });

// Why a value does not have the shape a schema of the five keywords — type, properties, required, items, enum — gives, or
// null. A property that is not required may be left out, or be null.
export function misfit(value, schema, at) {
  if (!schema) return null;
  if (schema.type === "object") {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return `${at} is not an object`;
    for (const key of schema.required ?? []) if (value[key] === undefined || value[key] === null) return `${at} has no ${key}`;
    for (const [key, property] of Object.entries(schema.properties ?? {})) {
      if (value[key] === undefined || value[key] === null) continue;
      const why = misfit(value[key], property, `${at}.${key}`);
      if (why) return why;
    }
    return null;
  }
  if (schema.type === "array") {
    if (!Array.isArray(value)) return `${at} is not a list`;
    for (const [index, item] of value.entries()) {
      const why = misfit(item, schema.items, `${at}[${index}]`);
      if (why) return why;
    }
    return null;
  }
  if (schema.type === "string") {
    if (typeof value !== "string") return `${at} is not a text`;
    return schema.enum && !schema.enum.includes(value) ? `${at} is not one of ${schema.enum.join(", ")}` : null;
  }
  if (schema.type === "number") return typeof value === "number" && Number.isFinite(value) ? null : `${at} is not a number`;
  return null;
}

// An answer read by its envelope: { value } or { why } it cannot be read. A text fenced as JSON is read inside its fence.
function readAnswer(text, envelope) {
  const body = text.trim().replace(/^```(?:json)?[ \t]*\n([\s\S]*)\n```$/, "$1");
  let value;
  try {
    value = JSON.parse(body);
  } catch {
    return { why: "it is not JSON" };
  }
  const why = misfit(value, envelope, "the answer");
  return why ? { why } : { value };
}

const unreadable = (why) => finding({ artifact: "answer", line: 1, kind: "error",
  rule: "A DRAFT THAT FAILS A CHECK GOES BACK TO ITS PARTICIPANT", what: `the answer cannot be read: ${why}`,
  fix: "answer with one JSON object of the form the output schema gives" });

// A reviewing participant's findings, each a warning, or null when its answer cannot be read.
function reviewed(text, kind) {
  const read = readAnswer(text, envelopeOf(kind.answer));
  if (read.why || !Array.isArray(read.value.draft?.findings)) return null;
  try {
    return read.value.draft.findings.map((f) => finding({ artifact: String(f.artifact), line: f.line, kind: "warning",
      rule: f.rule, what: String(f.what), fix: String(f.fix) }));
  } catch {
    return null;
  }
}

// The kind's prompt with each recipe's parts in its named place, each under its name; "(none)" where a recipe gave none.
// The prepared prompt: the kind's prompt with each recipe's parts in its place, followed by the form of the answer — the envelope the runner reads every answer
// by (envelopeOf), as a JSON schema — so that a participant is told the form before its first answer, not only by a finding after an answer that does not have it.
// It begins with Agent M's AGENTS.md, the job's `rules`, as prepareJob gave it.
const promptOf = (kind, parts, rules) => `${rules ? `${rules.text}\n\n` : ""}${kind.prompt.replace(/\{\{([a-z-]+)\}\}/g, (place, recipe) => {
  const given = parts.filter((part) => part.recipe === recipe);
  return given.length ? given.map((part) => `### ${part.name}\n\n${part.text}`).join("\n\n") : "(none)";
})}\n\n${answerForm(kind)}`;

const answerForm = (kind) => "## The form of your answer\n\nAnswer with exactly one JSON object and nothing else, of the form this JSON schema gives: your work under "
  + "`draft`, and under `answers` one entry for each finding you were given — `fixed`, `justified` with its one-line `text`, or `answered`.\n\n"
  + "```json\n" + JSON.stringify(envelopeOf(kind.answer), null, 2) + "\n```";

const draftText = (draft) => (typeof draft === "string" ? draft : JSON.stringify(draft, null, 2));
const partsFor = (kind, parts) => parts.filter((part) => kind.recipes.some((recipe) => recipe.name === part.recipe));

/**
 * runJob(prepared: Prepared, drivers: { drafter: Driver | null, reviewers: Driver[] }, options: { attended: boolean,
 * context: JobContext, from?: unknown, refine?: unknown, onRound?: (round: Round) => void, onOutput?: (chunk: string) => void, onGate?:
 * (gate: string) => Promise<void>, signal?: AbortSignal }) -> Promise<JobResult> — refuses to start while prepared's
 * blocking or notFitting is not empty (NotStartable). It runs the correction loop — or, with `from`, begins with that
 * draft, and without a drafter only returns the findings on it; with `refine`, the drafter's first exchange carries that draft as
 * `previous`, with no finding, beside the parts, among which is the person's follow-up instruction, and the loop then runs on what the
 * drafter returns —, then the kind's steps; each check is handed the job's
 * parts, and the result's classes are those of the kind's candidate-classes in the last round, null for a kind without it;
 * at a gate point of the kind whose gate in context.gates is not passed, it calls onGate and stops with that gate. A kind
 * whose result a person reviews, when a person attends, ends with its draft and writes nothing; any other calls the kind's
 * writer at once. Throws a driver's failure by name, and Cancelled when the signal is aborted — after a cancel, nothing
 * more is written.
 */
export async function runJob(prepared, drivers, options) {
  const { attended, context, from, refine, onRound, onOutput, onGate, signal } = options;
  if (prepared.blocking.length || prepared.notFitting.length) {
    throw failure("NotStartable", "the job has findings that keep it from starting, or a participant it does not fit",
      { blocking: prepared.blocking, notFitting: prepared.notFitting });
  }
  const cancelled = () => {
    if (signal?.aborted) throw failure("Cancelled", "the job was cancelled", {});
  };
  const kind = prepared.kind;
  const reviewing = kind.reviewer === null ? null : await kindOf(kind.reviewer);
  const drafterParts = partsFor(kind, prepared.parts);
  const reviewerParts = reviewing ? partsFor(reviewing, prepared.parts) : [];
  const envelope = envelopeOf(kind.answer);

  const rounds = [], usage = [], forPerson = [], settled = new Set();
  let draft = from === undefined ? null : from, readable = from !== undefined, lastText = null;
  let open = [], last = null, stoppedBecause = null, recheck = false;

  for (let number = 1; ; number += 1) {
    cancelled();
    let changed = number === 1;
    const fresh = !(number === 1 && from !== undefined) && !recheck;
    if (fresh) {
      // The first exchange of a refinement carries the draft to change, with no finding.
      const previous = number === 1 ? (refine === undefined ? null : draftText(refine)) : (readable ? draftText(draft) : lastText);
      // Where the kind names tools, this exchange carries the ToolUse the drafter may have; what the exchange holds goes into the draft.
      const offered = await offerTools(kind, drivers.drafter.participant, context);
      const sent = await drivers.drafter.send({ prompt: promptOf(kind, drafterParts, prepared.rules), parts: drafterParts, output: envelope,
        findings: number === 1 ? [] : open, previous, workdir: null, tools: offered?.use ?? null }, { onOutput, signal });
      usage.push({ participant: drivers.drafter.participant.name, usage: sent.usage });
      cancelled();
      lastText = sent.text;
      const read = readAnswer(sent.text, envelope);
      readable = !read.why;
      if (readable) {
        const answers = (read.value.answers ?? []).map((answer) => ({ ...answer,
          found: last?.findings.find((f) => line(f) === answer.finding) })).filter((answer) => answer.found);
        if (last) last.answers = answers.map(({ found, how, text }) => ({ finding: found, how, text: text ?? null }));
        for (const { found, how } of answers) if (found.kind === "warning" && how !== "fixed") settled.add(line(found));
        const drafted = withHeld(read.value.draft, offered?.held, Array.isArray(context.params?.refuses) ? context.params.refuses : []);
        changed = number === 1 || JSON.stringify(drafted) !== JSON.stringify(draft);
        draft = drafted;
      }
    }

    const found = [];
    let unchecked = false;
    if (readable) {
      for (const check of kind.checks) found.push(...await strategyOf("checks", check)(draft, context, prepared.parts));
      for (const reviewer of drivers.reviewers) {
        cancelled();
        const parts = [...reviewerParts, { name: "draft", text: draftText(draft), size: 0, sources: [], required: true,
          recipe: "draft" }];
        const sent = await reviewer.send({ prompt: promptOf(reviewing, parts, prepared.rules), parts, output: envelopeOf(reviewing.answer),
          findings: [], previous: null, workdir: null, tools: null }, { onOutput, signal });
        usage.push({ participant: reviewer.participant.name, usage: sent.usage });
        const findings = reviewed(sent.text, reviewing);
        if (findings === null) unchecked = true;
        else found.push(...findings);
      }
    } else {
      found.push(unreadable(readAnswer(lastText, envelope).why));
    }

    for (const f of found.filter((each) => kind.personDecides.includes(each.rule))) {
      if (!forPerson.some((g) => line(g) === line(f))) forPerson.push(f);
    }
    const findings = found.filter((f) => !kind.personDecides.includes(f.rule));
    const now = findings.filter((f) => !(f.kind === "warning" && settled.has(line(f))));
    const round = { number, findings, answers: [], changed };
    rounds.push(round);
    onRound?.(round);

    if (now.length === 0 && !unchecked) stoppedBecause = "passed";
    else if (!drivers.drafter) stoppedBecause = now.length ? "limit" : "not checked";
    else if (number > 1 && now.length && same(now, open)) stoppedBecause = "unchanged";
    else if (number >= prepared.limit) stoppedBecause = now.length ? "limit" : "not checked";
    recheck = now.length === 0 && unchecked;
    open = now;
    last = round;
    if (stoppedBecause) break;
  }

  if (!readable) stoppedBecause = "unusable";
  const classes = stoppedBecause === "unusable" ? null : classesOf(kind, draft, prepared.parts);
  const remaining = ["passed", "not checked"].includes(stoppedBecause) ? [] : open;
  const stepFindings = [];
  if (stoppedBecause !== "unusable") {
    for (const step of kind.steps) {
      cancelled();
      const out = await strategyOf("steps", step)(draft, context);
      draft = out.draft;
      stepFindings.push(...out.findings);
    }
  }
  const result = { draft: stoppedBecause === "unusable" ? null : draft, raw: readable ? null : lastText,
    drafter: prepared.drafter, rounds, remaining, forPerson, stepFindings, classes, stoppedBecause, gate: null, usage,
    written: null };
  if ((kind.review === "person" && attended) || stoppedBecause === "unusable") return result;

  const notPassed = (point) => (kind.gatePoints.includes(point)
    ? context.gates.find((gate) => gate.point === point && !gate.passed) : undefined);
  const beforeWrite = notPassed("before-write");
  if (beforeWrite) {
    await onGate?.(beforeWrite.name);
    return { ...result, stoppedBecause: "gate", gate: beforeWrite.name };
  }
  cancelled();
  const written = await strategyOf("writers", kind.writer)(result, context);
  const beforeMerge = notPassed("before-merge");
  if (beforeMerge) {
    await onGate?.(beforeMerge.name);
    return { ...result, written, stoppedBecause: "gate", gate: beforeMerge.name };
  }
  return { ...result, written };
}

/**
 * writeResult(prepared: Prepared, draft: unknown, options: { result: JobResult, context: JobContext }) ->
 * Promise<WriteOutcome> — writes a result that waited for a person, on their click: runs the kind's steps again on the
 * draft as the person left it, then calls the kind's writer with `result`, its draft replaced by theirs and its
 * stepFindings by those the steps return now. Throws what the writer throws by name.
 */
export async function writeResult(prepared, draft, { result, context }) {
  let current = draft;
  const stepFindings = [];
  for (const step of prepared.kind.steps) {
    const out = await strategyOf("steps", step)(current, context);
    current = out.draft;
    stepFindings.push(...out.findings);
  }
  return strategyOf("writers", prepared.kind.writer)({ ...result, draft: current, stepFindings }, context);
}
