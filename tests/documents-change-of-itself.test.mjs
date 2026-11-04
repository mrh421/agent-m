// A requirement proposed as a change of itself with its rule unchanged is a duplicate (ITM-1335) — MOD-documents' classifyCandidates, as
// the accepted text of docs/architecture/MOD-documents.md states it under Interfaces: "a requirement whose normalised rule equals that of
// the requirement it is proposed as a change of is a duplicate of that requirement all the same". A requirement's key is its name and its
// rule; a module's key is its identifier (THE DERIVATION RULES HOLD FOR ARCHITECTURE), so a module changed under its own identifier stays
// a change (ITM-1317).
// Run: node --test tests/documents-change-of-itself.test.mjs
//
// Module: MOD-documents
// Guards: EXACT DUPLICATES ARE FOUND WITHOUT A MODEL; A CHANGE IS PROPOSED UNDER THE EXISTING NAME; UC-005
// Level: unit
//
// The reading taken, as the item names it: "a requirement" is a candidate whose key has more than one value, and its rule is the last.
// Each test states its input and its expected result before it runs (given / input / expect). Nothing is read from a file or from the network.

import test from "node:test";
import assert from "node:assert/strict";
import { classifyCandidates } from "../src/documents/index.mjs";

const change = (of) => ({ class: "change", of });
const candidate = (ref, keys, from, proposed) => ({ ref, keys, from, proposed });
const classified = (refs, from, cls, of, decidedBy) => ({ refs, from, class: cls, of, decidedBy });

// TST-1335001 · level: unit · module: MOD-documents
// guards: EXACT DUPLICATES ARE FOUND WITHOUT A MODEL; A CHANGE IS PROPOSED UNDER THE EXISTING NAME
// given: the existing requirement A SYNC IS LOGGED with the rule "Every sync writes one log line." and the existing module MOD-sync keyed by its identifier; a candidate under that name with its rule in other letters, proposed a change of it; a candidate under that name with another rule, proposed a change of it; a module candidate keyed MOD-sync, proposed a change of MOD-sync
// input: classifyCandidates of each requirement candidate with the requirement; classifyCandidates of the module candidate with the module
// expect: the candidate restating the rule is a duplicate of A SYNC IS LOGGED, decided by rule; counter-proof: the one with another rule stays a change of A SYNC IS LOGGED, decided by the participant; known positive: the module candidate stays a change of MOD-sync, decided by the participant
test("classifyCandidates — a requirement proposed as a change of itself with its rule in other letters is a duplicate of it", () => {
  const name = "A SYNC IS LOGGED", rule = "Every sync writes one log line.";
  const requirements = [{ id: name, keys: [name, rule] }];
  assert.deepEqual(
    classifyCandidates([candidate("r1", [name, "  EVERY sync  writes one LOG line. "], ["SRC-b, p. 1"], change(name))], requirements),
    [classified(["r1"], ["SRC-b, p. 1"], "duplicate", name, "rule")]);
  assert.deepEqual(
    classifyCandidates([candidate("r2", [name, "Every sync writes one log line per file."], ["SRC-b, p. 2"], change(name))], requirements),
    [classified(["r2"], ["SRC-b, p. 2"], "change", name, "participant")]);
  assert.deepEqual(
    classifyCandidates([candidate("m1", ["MOD-sync"], ["docs/architecture/MOD-sync.md"], change("MOD-sync"))], [{ id: "MOD-sync", keys: ["MOD-sync"] }]),
    [classified(["m1"], ["docs/architecture/MOD-sync.md"], "change", "MOD-sync", "participant")]);
});
