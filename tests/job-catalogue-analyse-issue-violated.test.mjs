// ITM-1374 — the answer of the kind `analyse-issue` names, for a bug, the requirement the participant finds violated, as docs/architecture/MOD-job-catalogue.md gives the kind its answer ("the class and its reasoning") and
// docs/architecture/MOD-issue-handling.md reads that analysis (`backlogItemFrom`'s `analysis: { violated: string | null, modules: string[] }`; the recipe `fix-inputs`: "the confirmed analysis — the violated requirement, whether code or a test is
// wrong, the modules"). UC-012 step 3: a bug — "the specification is right; the code or a test is wrong"; UC-033 step 2: a bug's item realises "the requirement that UC-012's analysis named as violated".
// Run: node --test tests/job-catalogue-analyse-issue-violated.test.mjs
//
// Module: MOD-job-catalogue
// Guards: THE CATALOGUE IS DATA; A BACKLOG ITEM NAMES WHAT IT REALISES; UC-012
// Level: unit
//
// The kind is read with the catalogue's own `kindOf`; nothing runs. Readings the texts leave open, which the case states (the pull request names them):
//   - The violated requirement is part of "the class and its reasoning" (the item's reading, ruled at the gate of ITM-804). Its key in the draft is `violated`, the name MOD-issue-handling gives it in `backlogItemFrom`'s `analysis`; it holds
//     the requirement's name, a text.
//   - An answer without it still reads: `violated` is not among the schema's `required`, so that an answer of a class other than bug, and every answer written before the key existed, keeps its shape.
//   - The prompt asks for it where it asks a bug to name what is wrong: the line of `bug` names `violated`.
// The counter-proofs are recorded in the pull request.

import test from "node:test";
import assert from "node:assert/strict";
import { kindOf } from "../src/job-catalogue/index.mjs";

// TST-1374001 · level: unit · module: MOD-job-catalogue
// guards: THE CATALOGUE IS DATA; A BACKLOG ITEM NAMES WHAT IT REALISES; UC-012
// given: the catalogue's kind analyse-issue, whose answer schema already holds class, reasoning and wrong (the known positive of the read)
// input: kindOf("analyse-issue"), its answer schema and its prompt
// expect: the schema still holds class, reasoning and wrong, and holds violated of type string; required is exactly class and reasoning, so that violated may be left out; the prompt's line of `bug` names `violated`
test("TST-1374001: analyse-issue's answer has a field violated for the requirement a bug violates, which may be left out, and its prompt asks a bug for it", async () => {
  const kind = await kindOf("analyse-issue");
  assert.ok(kind.answer?.properties?.class && kind.answer.properties.reasoning && kind.answer.properties.wrong, "known positive: the schema is read with its fields");
  assert.deepEqual(kind.answer.properties.violated, { type: "string" });
  assert.deepEqual([...kind.answer.required].sort(), ["class", "reasoning"]);
  const bugLine = kind.prompt.split("\n").find((line) => line.startsWith("- `bug`"));
  assert.ok(bugLine, "the prompt has a line for the class bug");
  assert.ok(bugLine.includes("`violated`"), bugLine);
});
