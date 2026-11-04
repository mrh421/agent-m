// Within MOD-work-plans, each rule of the backlog stands once (ITM-1255, AGENTS.md §2 principle 2, "Nothing twice"): the file of a backlog
// item, the two rules that take an item's identifier from a path, the architecture's module files found and read, and the reader of a
// list-valued field. The test reads the module's own code files, src/work-plans/*.mjs, and counts each rule's definitions there.
// Run: node --test tests/work-plans-one-definition.test.mjs
//
// Module: MOD-work-plans
// Guards: A BACKLOG ITEM NAMES THE MODULES IT CHANGES
// Level: unit
//
// Each case is its own counter-proof: the same count, over the module's files with a second copy of the rule planted in another file of
// the module, finds two. A rule is found by its text, its whitespace folded to single spaces.

import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";

const FOLDER = new URL("../src/work-plans/", import.meta.url);
const files = new Map(readdirSync(FOLDER).filter((name) => name.endsWith(".mjs")).map((name) => [name, readFileSync(new URL(name, FOLDER), "utf8").replace(/\s+/g, " ")]));

// Where `rule` stands in `texts`, file by file, once for each time it stands.
const placesOf = (texts, rule) => [...texts].flatMap(([name, text]) => [...text.matchAll(rule)].map(() => name));
// The files with `copy` planted at the end of a file other than `home`.
const planted = (home, copy) => {
  const other = [...files.keys()].find((name) => name !== home);
  return new Map([...files].map(([name, text]) => [name, name === other ? `${text} ${copy}` : text]));
};

// That `rule` stands once in the module, in `home`, and twice with `copy` planted in another file of the module.
function standsOnce(home, rule, copy) {
  assert.deepEqual(placesOf(files, rule), [home]);
  assert.equal(placesOf(planted(home, copy), rule).length, 2, "the counter-proof: a planted second copy is found");
}

// TST-1255001 · level: unit · module: MOD-work-plans
// guards: A BACKLOG ITEM NAMES THE MODULES IT CHANGES
// given: the code files of src/work-plans/
// input: the places of the pattern ^docs/backlog/ITM-<n>-<slug>.md$, with or without the group around the identifier
// expect: it stands once, in saves.mjs; counter-proof: with a copy planted in another file of the module, it stands twice
test("the file of a backlog item is defined once in MOD-work-plans, in saves.mjs", () => {
  standsOnce("saves.mjs", /\/\^docs\\\/backlog\\\/\(?ITM-\\d\{3,\}\)?-\[\^\/\]\+\\\.md\$\//g, "const BACKLOG_ITEM = /^docs\\/backlog\\/ITM-\\d{3,}-[^/]+\\.md$/;");
});

// TST-1255002 · level: unit · module: MOD-work-plans
// guards: A BACKLOG ITEM NAMES THE MODULES IT CHANGES
// given: the code files of src/work-plans/
// input: the places of the pattern (?:^|/)(ITM-<n>)-[^/]*.md$, an item's identifier from a file path ending .md
// expect: it stands once, in saves.mjs; counter-proof: with a copy planted in another file of the module, it stands twice
test("an item's identifier from a file path ending .md is defined once in MOD-work-plans, in saves.mjs", () => {
  standsOnce("saves.mjs", /\/\(\?:\^\|\\\/\)\(ITM-\\d\{3,\}\)-\[\^\/\]\*\\\.md\$\//g, "const ANY = /(?:^|\\/)(ITM-\\d{3,})-[^/]*\\.md$/;");
});

// TST-1255003 · level: unit · module: MOD-work-plans
// guards: A BACKLOG ITEM NAMES THE MODULES IT CHANGES
// given: the code files of src/work-plans/
// input: the places of the pattern (?:^|/)(ITM-<n>)-, an item's identifier from any path, also one that does not end in .md
// expect: it stands once, in strategies.mjs; counter-proof: with a copy planted in another file of the module, it stands twice
test("an item's identifier from any path is defined once in MOD-work-plans, in strategies.mjs", () => {
  standsOnce("strategies.mjs", /\/\(\?:\^\|\\\/\)\(ITM-\\d\{3,\}\)-\//g, "const ID = /(?:^|\\/)(ITM-\\d{3,})-/;");
});

// TST-1255004 · level: unit · module: MOD-work-plans
// guards: A BACKLOG ITEM NAMES THE MODULES IT CHANGES
// given: the code files of src/work-plans/
// input: the places where the paths are filtered for the architecture's module files: MODULE_FILE.test(…), documents(MODULE_FILE, …) or /\/MOD-/.test(…)
// expect: it stands once, in strategies.mjs; counter-proof: with a copy planted in another file of the module, it stands twice
test("the architecture's module files are found in one place of MOD-work-plans, in strategies.mjs", () => {
  standsOnce("strategies.mjs", /MODULE_FILE\.test\(|\(MODULE_FILE,|\/\\\/MOD-\/\.test\(/g, "snapshot.paths.filter((each) => MODULE_FILE.test(each));");
});

// TST-1255005 · level: unit · module: MOD-work-plans
// guards: A BACKLOG ITEM NAMES THE MODULES IT CHANGES
// given: the code files of src/work-plans/
// input: the places of the reader of a list-valued field: a list as it is, or a comma-separated text, each part trimmed and none blank
// expect: it stands once, in sprints.mjs; counter-proof: with a copy planted in another file of the module, it stands twice
test("the reader of a list-valued field is defined once in MOD-work-plans, in sprints.mjs", () => {
  standsOnce("sprints.mjs", /\(Array\.isArray\(value\) \? value\.map\(text\) : text\(value\)\.split\(","\)\.map\(\(part\) => part\.trim\(\)\)\.filter\(Boolean\)\)/g,
    'const list = (value) => (Array.isArray(value) ? value.map(text) : text(value).split(",").map((part) => part.trim()).filter(Boolean));');
});
