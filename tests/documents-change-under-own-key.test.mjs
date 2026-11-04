// A change stands under the name of what it changes (ITM-1317) — MOD-documents' classifyCandidates, as the accepted text of
// docs/architecture/MOD-documents.md states it under Interfaces: "a candidate whose normalised key equals that of an existing artifact other
// than the one its participant proposed it as a change of is a duplicate of it, whatever class its participant proposed, decided by rule
// (EXACT DUPLICATES ARE FOUND WITHOUT A MODEL), since a change stands under the name of what it changes (A CHANGE IS PROPOSED UNDER THE
// EXISTING NAME); every other candidate keeps the class its participant proposed." A module's key is its identifier and a decision's its
// title (THE DERIVATION RULES HOLD FOR ARCHITECTURE), so a module changed under its own identifier, or a decision that keeps its title,
// has the key of the artifact it changes.
// Run: node --test tests/documents-change-under-own-key.test.mjs
//
// Module: MOD-documents
// Guards: A CHANGE IS PROPOSED UNDER THE EXISTING NAME; EXACT DUPLICATES ARE FOUND WITHOUT A MODEL; THE DERIVATION RULES HOLD FOR ARCHITECTURE; UC-023
// Level: unit
//
// The reading taken where the text leaves one open: a candidate is "proposed as a change of" an artifact when its proposed class is
// `change` and its `of` names that artifact; for candidates merged into one, the first of them proposes, as for the class itself.
// Each test states its input and its expected result before it runs (given / input / expect). Nothing is read from a file or from the network.

import test from "node:test";
import assert from "node:assert/strict";
import { classifyCandidates } from "../src/documents/index.mjs";

const NEW = { class: "new", of: null };
const change = (of) => ({ class: "change", of });
const candidate = (ref, keys, from, proposed = NEW) => ({ ref, keys, from, proposed });
const classified = (refs, from, cls, of, decidedBy) => ({ refs, from, class: cls, of, decidedBy });

const modules = [{ id: "MOD-sync", keys: ["MOD-sync"] }, { id: "MOD-cache", keys: ["MOD-cache"] }];
const decisions = [{ id: "ARC-021", keys: ["Keep the broker out of the browser"] }, { id: "ARC-022", keys: ["Cache reads in the page"] }];

// TST-1317001 · level: unit · module: MOD-documents
// guards: A CHANGE IS PROPOSED UNDER THE EXISTING NAME; THE DERIVATION RULES HOLD FOR ARCHITECTURE
// given: the existing modules MOD-sync and MOD-cache, keyed by their identifiers, and the existing decisions ARC-021 "Keep the broker out of the browser" and ARC-022, keyed by their titles; a module candidate keyed MOD-sync, proposed a change of MOD-sync; a decision candidate keyed by the title of ARC-021 in other letters, proposed a change of ARC-021
// input: classifyCandidates of the module candidate with the modules; classifyCandidates of the decision candidate with the decisions
// expect: for each, one class that is a change of the artifact it changes, decided by the participant — no duplicate of itself
test("classifyCandidates — a module changed under its own identifier, and a decision that keeps its title, keep the class change", () => {
  assert.deepEqual(
    classifyCandidates([candidate("m1", ["MOD-sync"], ["docs/architecture/MOD-sync.md"], change("MOD-sync"))], modules),
    [classified(["m1"], ["docs/architecture/MOD-sync.md"], "change", "MOD-sync", "participant")]);
  assert.deepEqual(
    classifyCandidates([candidate("d1", ["keep the BROKER out of the browser"], ["UC-022, step 4"], change("ARC-021"))], decisions),
    [classified(["d1"], ["UC-022, step 4"], "change", "ARC-021", "participant")]);
});

// TST-1317002 · level: unit · module: MOD-documents
// guards: EXACT DUPLICATES ARE FOUND WITHOUT A MODEL; THE DERIVATION RULES HOLD FOR ARCHITECTURE
// given: the same existing modules and decisions; the same two candidates, proposed new instead of a change; and a candidate keyed MOD-sync that its participant proposed a duplicate of MOD-sync, and one proposed a conflict with MOD-sync
// input: classifyCandidates of each with the modules or the decisions
// expect: the counter-proof of TST-1317001: the module candidate proposed new is a duplicate of MOD-sync and the decision candidate proposed new a duplicate of ARC-021, each decided by rule; the candidate proposed a duplicate and the one proposed a conflict are duplicates of MOD-sync decided by rule too — only a change is a candidate for what it changes
test("classifyCandidates — the same candidates proposed new, as a duplicate or as a conflict are duplicates of the artifact, decided by rule", () => {
  assert.deepEqual(classifyCandidates([candidate("m1", ["MOD-sync"], ["p1"])], modules),
    [classified(["m1"], ["p1"], "duplicate", "MOD-sync", "rule")]);
  assert.deepEqual(classifyCandidates([candidate("d1", ["keep the BROKER out of the browser"], ["p2"])], decisions),
    [classified(["d1"], ["p2"], "duplicate", "ARC-021", "rule")]);
  assert.deepEqual(classifyCandidates([candidate("m2", ["MOD-sync"], ["p3"], { class: "duplicate", of: "MOD-sync" })], modules),
    [classified(["m2"], ["p3"], "duplicate", "MOD-sync", "rule")]);
  assert.deepEqual(classifyCandidates([candidate("m3", ["MOD-sync"], ["p4"], { class: "conflict", of: "MOD-sync" })], modules),
    [classified(["m3"], ["p4"], "duplicate", "MOD-sync", "rule")]);
});

// TST-1317003 · level: unit · module: MOD-documents
// guards: A CHANGE IS PROPOSED UNDER THE EXISTING NAME; EXACT DUPLICATES ARE FOUND WITHOUT A MODEL; THE DERIVATION RULES HOLD FOR ARCHITECTURE
// given: the existing modules MOD-sync and MOD-cache; a candidate keyed MOD-cache that its participant proposed a change of MOD-sync; the existing decisions ARC-021 and ARC-022 and a candidate with the title of ARC-022 proposed a change of ARC-021
// input: classifyCandidates of the module candidate with the modules; classifyCandidates of the decision candidate with the decisions
// expect: the known positive: leaving out the artifact it changes leaves every other artifact in the search — the module candidate is a duplicate of MOD-cache and the decision candidate a duplicate of ARC-022, each decided by rule
test("classifyCandidates — a change whose key equals another existing artifact's is a duplicate of that other artifact", () => {
  assert.deepEqual(classifyCandidates([candidate("m1", ["MOD-cache"], ["p1"], change("MOD-sync"))], modules),
    [classified(["m1"], ["p1"], "duplicate", "MOD-cache", "rule")]);
  assert.deepEqual(classifyCandidates([candidate("d1", ["Cache reads in the page"], ["p2"], change("ARC-021"))], decisions),
    [classified(["d1"], ["p2"], "duplicate", "ARC-022", "rule")]);
});

// TST-1317004 · level: unit · module: MOD-documents
// guards: A CHANGE IS PROPOSED UNDER THE EXISTING NAME; EXACT DUPLICATES ARE FOUND WITHOUT A MODEL
// given: the existing requirement A REPORT HAS A TITLE with the rule "Every report shows a title."; a candidate under its name with another rule, proposed a change of it; a candidate under its name with its rule in other letters, proposed a change of it; and a candidate under another name with its rule, proposed new
// input: classifyCandidates of the three with the requirement
// expect: the requirement changed under its name with another rule keeps the class change, decided by the participant; the one under its name that restates its own rule in other letters is a duplicate of A REPORT HAS A TITLE, decided by rule (ITM-1335); the true restatement under another name is still a duplicate of the requirement, decided by rule
test("classifyCandidates — a requirement changed under its name keeps its class; a restatement under another name is still a duplicate", () => {
  const name = "A REPORT HAS A TITLE", rule = "Every report shows a title.";
  const requirements = [{ id: name, keys: [name, rule] }];
  assert.deepEqual(
    classifyCandidates([candidate("r1", [name, "Every report shows its title on the first page."], ["SRC-a, p. 1"], change(name))], requirements),
    [classified(["r1"], ["SRC-a, p. 1"], "change", name, "participant")]);
  assert.deepEqual(
    classifyCandidates([candidate("r2", [name, "  EVERY report  shows a TITLE. "], ["SRC-a, p. 2"], change(name))], requirements),
    [classified(["r2"], ["SRC-a, p. 2"], "duplicate", name, "rule")]);
  assert.deepEqual(
    classifyCandidates([candidate("r3", ["EACH REPORT IS TITLED", rule], ["SRC-a, p. 3"])], requirements),
    [classified(["r3"], ["SRC-a, p. 3"], "duplicate", name, "rule")]);
});
