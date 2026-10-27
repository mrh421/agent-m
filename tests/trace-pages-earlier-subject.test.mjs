// MOD-trace-pages' specification subject on the earlier version shown while the head's graph is stored (ITM-1235), as
// docs/architecture/MOD-trace-pages.md (Data: specification) states it: "Its subject for the prompt bar is context only (MOD-prompt-bar's `Subject`): the
// page and, at the current state — the default branch, or the earlier version shown while the head's graph is stored —, the open requirement, or the
// group with the names it holds, as `requirements`, the person's own source where the product links one, and the review pages' `draft` as its draft
// route (UC-019 step 1); at a released version, the requirement as it read there, and no draft route (UC-020 1a, UC-049 2a)".
//
// Run: node --test tests/trace-pages-earlier-subject.test.mjs
//
// Module: MOD-trace-pages
// Guards: UC-019; UC-049; THE PERSON WHO PROMPTS IS A SOURCE; A DRAFTED CHANGE IS SHOWN AGAINST THE CURRENT TEXT
// Level: unit
//
// The subject is built by MOD-trace-pages' subjectOf with what the view kept when drawn (`shown`), as tests/prompt-bar-one-kind.test.mjs (TST-1360005) builds
// it: the earlier version is the view drawn at an earlier commit, not on the default branch, with the line latestGraph gave (`asOf`); a released version is
// drawn at a tag with no such line. A reading the texts leave open, which the tests state: "the requirement" the subject carries is `requirements` in its
// parameters, as on the default branch.
// Each test states its input and its expected result before it runs (given / input / expect).

import test from "node:test";
import assert from "node:assert/strict";
import { subjectOf } from "../src/trace-pages/subject.mjs";

const EARLIER = "e".repeat(40);
const spec = { requirements: new Map([["FIRST REQUIREMENT", { source: "Source one", rule: "First rule.", check: "at review" }]]), sections: [] };
const params = { key: "specification", ref: "main" };
const context = { product: { address: "https://github.com/acme/library" } };
const shownAt = (ref, asOf, source, open) => ({ target: { textContent: "" }, ref, onDefaultBranch: false, asOf, source, spec, requirements: [], groups: [], ...open });

// TST-1235001 · level: unit · module: MOD-trace-pages
// guards: UC-019; UC-049; THE PERSON WHO PROMPTS IS A SOURCE
// given: the specification view kept while the head's graph is stored: the earlier version shown (ref an earlier commit, onDefaultBranch false, asOf set) with the person's source SRC-po-fixture and FIRST REQUIREMENT open; known positive: the same requirement open at the released version v2026.1.0 (asOf null, no source) gives no draft route
// input: subjectOf({ title, params, context, shown }), then its paramsFor({})
// expect: draftRoute starts "draft/subject=" and holds the encoded subject key, which holds requirement=FIRST%20REQUIREMENT; paramsFor gives requirements ["FIRST REQUIREMENT"] and source SRC-po-fixture; at the released version draftRoute null and no requirements
test("TST-1235001: on the earlier version shown while the head's graph is stored, the open requirement is the subject with the draft route and the source", () => {
  const subject = subjectOf({ title: "Current requirements", params, context,
    shown: shownAt(EARLIER, "As of eeeeeee: the trace graph of the newest commit is being stored.", "SRC-po-fixture", { requirements: ["FIRST REQUIREMENT"] }) });
  assert.ok(subject.key.includes("requirement=FIRST%20REQUIREMENT"), subject.key);
  assert.equal(subject.draftRoute, `draft/subject=${encodeURIComponent(subject.key)}`);
  const given = subject.paramsFor({});
  assert.deepEqual(given.requirements, ["FIRST REQUIREMENT"]);
  assert.equal(given.source, "SRC-po-fixture");
  const released = subjectOf({ title: "Current requirements", params: { key: "specification", ref: "v2026.1.0" }, context,
    shown: shownAt("v2026.1.0", null, null, { requirements: ["FIRST REQUIREMENT"] }) });
  assert.equal(released.draftRoute, null);
  assert.equal(released.paramsFor({}).requirements, undefined);
});

// TST-1235002 · level: unit · module: MOD-trace-pages
// guards: UC-019; UC-049; THE PERSON WHO PROMPTS IS A SOURCE
// given: the earlier version shown while the head's graph is stored, with the person's source SRC-po-fixture and the group "First group" (FIRST REQUIREMENT, SECOND REQUIREMENT) open and no requirement open
// input: subjectOf({ title, params, context, shown }), then its paramsFor({})
// expect: title "First group"; draftRoute "draft/subject=<the encoded key>"; paramsFor gives requirements ["FIRST REQUIREMENT", "SECOND REQUIREMENT"] and source SRC-po-fixture
test("TST-1235002: on the earlier version shown while the head's graph is stored, the open group is the subject with the draft route and the source", () => {
  const group = { heading: "First group", path: ["First group"], names: ["FIRST REQUIREMENT", "SECOND REQUIREMENT"] };
  const subject = subjectOf({ title: "Current requirements", params, context,
    shown: shownAt(EARLIER, "As of eeeeeee: the trace graph of the newest commit is being stored.", "SRC-po-fixture", { groups: [group] }) });
  assert.equal(subject.title, "First group");
  assert.equal(subject.draftRoute, `draft/subject=${encodeURIComponent(subject.key)}`);
  const given = subject.paramsFor({});
  assert.deepEqual(given.requirements, ["FIRST REQUIREMENT", "SECOND REQUIREMENT"]);
  assert.equal(given.source, "SRC-po-fixture");
});
