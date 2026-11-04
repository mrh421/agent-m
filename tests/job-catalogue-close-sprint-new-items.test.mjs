// ITM-1407 — the kind `close-sprint` asks its closer for the review's new items and accepts them, as docs/architecture/MOD-job-catalogue.md gives the kind its answer (the table of kinds: "`close-sprint` | UC-041 | ... | `sprint-facts` | `sprint-record-checks` | ... | `none` · `sprint-record` | the review, the retrospective, the proposed changes")
// and docs/architecture/MOD-work-plans.md takes the draft as `closeSprint`'s `close` ("newItems: Document[]": "adds the feedback's new items to the backlog as `saveItems` does ... all in one commit"). UC-041 step 6: the closer commits "the new backlog items from the feedback".
// Run: node --test tests/job-catalogue-close-sprint-new-items.test.mjs
//
// Module: MOD-job-catalogue
// Guards: UC-041; A SPRINT ENDS WITH A REVIEW OF ITS INCREMENT; THE CATALOGUE IS DATA
// Level: unit
//
// The kind is read with the catalogue's own `kindOf`; nothing runs. Readings the texts leave open, which the cases state (the pull request names them):
//   - The new items are part of "the review" the table names as the draft of the kind: the key is `newItems`, the name MOD-work-plans gives them in `close`, and each is a Document as `closeSprint` takes it, `{ fields, sections }`, as `saveItems` takes a new item.
//   - `newItems` may be left out: it is not among the schema's `required`, so that a draft written before the key existed, and a close whose feedback has no new item, keep their shape (`closeSprint` reads `close.newItems ?? []`).
//   - The prompt asks for them where it describes the review: its bullet of the review names `newItems`.
//   - Which fields an item must hold is `backlogFindings`' to refuse (MOD-work-plans); the schema names the fields of an item of the backlog and requires those every item needs.
// A draft is checked against the schema by `fits` below, which reads the five keywords as the job runner does: a property that is not required may be left out. The counter-proofs are recorded in the pull request.

import test from "node:test";
import assert from "node:assert/strict";
import { kindOf } from "../src/job-catalogue/index.mjs";

// Why a value does not fit a schema of the five keywords, or null.
function fits(value, schema, at = "draft") {
  if (schema.type === "object") {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return `${at} is not an object`;
    for (const key of schema.required ?? []) if (value[key] === undefined || value[key] === null) return `${at} has no ${key}`;
    for (const [key, property] of Object.entries(schema.properties ?? {})) {
      if (value[key] === undefined || value[key] === null) continue;
      const why = fits(value[key], property, `${at}.${key}`);
      if (why) return why;
    }
    return null;
  }
  if (schema.type === "array") {
    if (!Array.isArray(value)) return `${at} is not a list`;
    for (const [index, item] of value.entries()) {
      const why = fits(item, schema.items, `${at}[${index}]`);
      if (why) return why;
    }
    return null;
  }
  if (schema.type === "string") {
    if (typeof value !== "string") return `${at} is not a text`;
    return schema.enum && !schema.enum.includes(value) ? `${at} is not one of ${schema.enum.join(", ")}` : null;
  }
  return `${at} has a type this check does not know`;
}

// A close as the closer answers it in the form the kind gives (no sprint: the job names it), and the new item of TST-991206 as `closeSprint` takes it.
const ITEM = { fields: { title: "Write the export's header", level: "module", realises: ["RULE ONE"], modules: ["MOD-store"], builds_on: [], tests: ["unit"], origin: ["the issue 7"] },
  sections: [{ heading: "## Outcome", text: "The export has a header." }, { heading: "## Acceptance", text: "- a unit test." }] };
const CLOSE = {
  review: { feedback: [{ line: "The issue 7: the export misses its header", goes: "new item", item: null }], tookPart: [], sources: ["issue 7"] },
  unfinished: [], retrospective: [{ text: "Write the feedback down as it comes.", kind: "change", goes: "team agreement" }],
};

// TST-1407001 · level: unit · module: MOD-job-catalogue
// guards: UC-041; A SPRINT ENDS WITH A REVIEW OF ITS INCREMENT; THE CATALOGUE IS DATA
// given: the catalogue's kind close-sprint, whose answer schema already holds review, unfinished and retrospective (the known positive of the read)
// input: kindOf("close-sprint"), its answer schema and its prompt
// expect: the schema still holds review, unfinished and retrospective, and holds newItems, a list whose item is an object with fields (an object that holds title, level, realises, modules, builds_on, tests and origin) and sections (a list of objects with heading and text); required is exactly review, unfinished and retrospective, so that newItems may be left out; the prompt's bullet of the review names newItems
test("TST-1407001: close-sprint's answer has a list newItems of the review's new items, which may be left out, and its prompt asks the closer for them", async () => {
  const kind = await kindOf("close-sprint");
  assert.ok(kind.answer?.properties?.review && kind.answer.properties.unfinished && kind.answer.properties.retrospective, "known positive: the schema is read with its fields");
  const items = kind.answer.properties.newItems;
  assert.equal(items?.type, "array", "the schema holds a list newItems");
  assert.equal(items.items.type, "object");
  const { fields, sections } = items.items.properties;
  assert.equal(fields?.type, "object");
  for (const key of ["title", "level", "realises", "modules", "builds_on", "tests", "origin"]) assert.ok(fields.properties[key], `the item's fields hold ${key}`);
  assert.equal(sections?.type, "array");
  assert.deepEqual(Object.keys(sections.items.properties).sort(), ["heading", "text"]);
  assert.deepEqual([...kind.answer.required].sort(), ["retrospective", "review", "unfinished"]);
  const review = kind.prompt.split(/\n(?=- \*\*)/).find((part) => part.startsWith("- **Review.**"));
  assert.ok(review, "the prompt has the bullet of the review");
  assert.ok(review.includes("newItems"), `the prompt's bullet of the review names newItems: ${review}`);
});

// TST-1407002 · level: unit · module: MOD-job-catalogue
// guards: UC-041; A SPRINT ENDS WITH A REVIEW OF ITS INCREMENT; A BACKLOG ITEM NAMES WHAT IT REALISES
// given: the catalogue's kind close-sprint; a close without newItems (the known positive: it fits), the same close with the new item of TST-991206 under newItems, with newItems empty, and three closes that are not drafts of the kind — newItems a text, a new item without fields, a new item whose section has no heading
// input: each close checked against the kind's answer schema as the job runner reads it
// expect: the close without newItems fits (an old draft still reads); the close with the new item fits, and so does the one with an empty list; the close whose newItems is a text, the one whose item has no fields and the one whose section has no heading each do not fit, naming newItems
test("TST-1407002: close-sprint's answer schema accepts a close with the new items, with none and without the key, and refuses a malformed new item", async () => {
  const { answer } = await kindOf("close-sprint");
  assert.equal(fits(CLOSE, answer), null, "known positive: a close without newItems fits");
  assert.equal(fits({ ...CLOSE, newItems: [ITEM] }, answer), null, "a close with a new item fits");
  assert.equal(fits({ ...CLOSE, newItems: [] }, answer), null, "a close with no new item fits");
  const refused = [
    { ...CLOSE, newItems: "Write the export's header" },
    { ...CLOSE, newItems: [{ sections: ITEM.sections }] },
    { ...CLOSE, newItems: [{ fields: ITEM.fields, sections: [{ text: "The export has a header." }] }] },
  ];
  for (const close of refused) assert.match(fits(close, answer) ?? "", /newItems/, JSON.stringify(close).slice(0, 80));
});
