// The preamble's entry is accepted — MOD-spec-changes, Data: "for the preamble, whose anchor is the title line". The span of such an entry is the text from the
// title line up to the section its `until` names, and accepting it replaces that span byte for byte (`THE APPROVED TEXT IS TAKEN VERBATIM`).
// Run: node --test tests/spec-changes-preamble.test.mjs
//
// Module: MOD-spec-changes
// Guards: THE APPROVED TEXT IS TAKEN VERBATIM; A QUEUE IS ACCEPTED IN ITS ORDER
// Level: unit
//
// The fixture SPEC is small and ours. The title line is no section of MOD-spec-document (a section begins with a heading of level two), so the span is read here.

import test from "node:test";
import assert from "node:assert/strict";
import { spanText, replaceSpan } from "../src/spec-changes/queues.mjs";

const SPEC = "# Lib — Specification\n\nOld preamble.\n\n---\n\n## 0. Rules\n\n**A RULE**\nText.\n\n## 1. More\n\nMore text.\n";
const TITLE = "# Lib — Specification";

// TST-1414001 · level: unit · module: MOD-spec-changes
// guards: THE APPROVED TEXT IS TAKEN VERBATIM
// given: a SPEC whose title line is followed by a preamble and the sections ## 0. Rules and ## 1. More; a proposal of the preamble
// input: spanText and replaceSpan with the title line as anchor and ## 0. Rules as until
// expect: the span is the text from the title line up to ## 0. Rules; the result is the proposal followed by every byte from ## 0. Rules on, unchanged; known positive: a level-two anchor still gives its section, and a title line the SPEC lacks gives null
test("TST-1414001: the preamble's entry, anchored at the title line, spans the text up to its until and is replaced byte for byte", () => {
  const span = spanText(SPEC, TITLE, "## 0. Rules");
  assert.equal(span, "# Lib — Specification\n\nOld preamble.\n\n---\n\n");
  const proposal = "# Lib — Specification\n\nNew preamble.\n\n---\n\n";
  assert.equal(replaceSpan(SPEC, TITLE, "## 0. Rules", proposal), proposal + SPEC.slice(span.length));
  assert.equal(spanText(SPEC, "## 1. More", null), "## 1. More\n\nMore text.\n", "known positive: a section's span is unchanged");
  assert.equal(spanText(SPEC, "# Other — Specification", "## 0. Rules"), null, "a title line the SPEC lacks names nothing");
});
