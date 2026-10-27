// The recipe `issue-context` of MOD-issue-handling's `issueStrategies` (ITM-582), as the accepted text of docs/architecture/MOD-issue-handling.md states it: "recipe `issue-context` — for analysing an issue: one part with the issue's title, text and comments; parts with the requirements the issue names, and the use cases, tests and modules it names together with the requirements the trace graph links to them — each with its text from the snapshot. An issue that names nothing gets the whole SPEC. The issue's text from a mail is neutral by construction; no mail is ever a part." With UC-012 step 2 and MOD-job-runner's `Strategies`, `JobContext` and `Part`.
// Run: node --test tests/issue-handling-issue-context.test.mjs
//
// Module: MOD-issue-handling
// Guards: A PARTICIPANT THAT WRITES TO A REPOSITORY NEVER RECEIVES A MAIL; DERIVATION SEES THE EXISTING REQUIREMENTS; UC-012
// Level: unit
//
// The product is a fixture of this file: a SPEC.md of four requirements — two of them with names one of which begins like the other —, two use cases, a module and a test that guards a requirement. The host is a fixture that lists the issues given.
// Readings the texts leave open, which the tests state (the pull request names them):
//   - The recipe reads the issue number from the job's parameter `issue` and the issue from the product's host (`context.product.host`, `listIssues({ state: "all" })`); a number the host lists no issue under is IssueNotFound { issue }.
//   - A requirement is named by the issue where the issue's title, text or a comment holds its name as the SPEC writes it and the name is not a part of a longer name of the SPEC that the text holds; a use case, test or module where it holds the identifier. A name or an identifier the product does not hold is no part and no failure: the issue's own part holds the text.
//   - Parts, in this order: the issue (named `issue #<number>`); the requirements named, in the order of the SPEC; then, for each use case, test or module named in the order the text names them, its file named by its path, and the requirements the graph links to it — what it realises or guards, and for a module what the tests that exercise it guard — not given before. A part is given once.
//   - A requirement's part is named by the requirement and holds it as the SPEC states it: `**NAME** *(source)*`, the rule, `*Check:* …`.
//   - The issue's part holds title, text and the text of each comment, and no author and no date of a comment. The recipe makes no request of its own; the snapshot reads what the host holds.
// The counter-proofs are recorded in the pull request.

import test from "node:test";
import assert from "node:assert/strict";

const handling = await import("../src/issue-handling/index.mjs").catch((error) => ({ error }));
const recipe = () => {
  assert.ok(handling.issueStrategies, `MOD-issue-handling offers issueStrategies: ${handling.error?.message}`);
  const given = handling.issueStrategies.recipes?.["issue-context"];
  assert.equal(typeof given, "function", "issueStrategies holds the recipe issue-context");
  return given;
};

const lines = (...rows) => `${rows.join("\n")}\n`;
const EXPORT = "THE EXPORT IS A PDF";
const EXPORT_LONG = "THE EXPORT IS A PDF WITH A TITLE PAGE";
const MARGINS = "EVERY MARGIN IS WIDE";
const SERIF = "THE BODY TEXT IS SERIF";
const requirement = (name, source, rule, check) => lines(`**${name}** *(${source})*`, rule, `*Check:* \`${check}\``);
const SPEC = lines("# Fixture — Specification", "", "## 1. Export", "", requirement(EXPORT, "PO A", "The export is one PDF file.", "tests/reader.test.mjs"),
  requirement(EXPORT_LONG, "PO A", "The export starts with a title page.", "tests/reader.test.mjs"), "## 2. Layout", "",
  requirement(MARGINS, "PO B", "Every margin is at least 3 cm.", "tests/reader.test.mjs"), requirement(SERIF, "PO B", "The body text is set in a serif font.", "tests/reader.test.mjs"));
const useCase = (id, realises) => lines("---", `id: ${id}`, `title: ${id} case`, "area: x", "actors:", "  - A", "realises:", ...realises.map((name) => `  - ${name}`), "---", `# ${id} case`, "", `FILE-OF-${id}`);
const MODULE = lines("---", "id: MOD-reader", "title: reader", "folder: src/reader/", "realises:", "follows:", "uses: []", "provides:", "  - read", "---", "# MOD-reader reader", "", "FILE-OF-MOD-reader");
const FILES = {
  "SPEC.md": SPEC,
  "docs/use-cases/UC-001-export.md": useCase("UC-001", [EXPORT]),
  "docs/use-cases/UC-002-margins.md": useCase("UC-002", [MARGINS]),
  "docs/architecture/MOD-reader.md": MODULE,
  "src/reader/index.mjs": "export const read = 1;\n",
  "tests/reader.test.mjs": lines("// Module: MOD-reader", `// Guards: ${SERIF}`, "// Level: unit", "", "// TST-001 · level: unit · module: MOD-reader", `// guards: ${SERIF}`, "// given: a file", "// input: a call", "// expect: a result"),
};

const snapshotOf = (files) => ({ paths: Object.keys(files), read: async (path) => (Object.prototype.hasOwnProperty.call(files, path) ? files[path] : null) });
const issue = (number, title, body, comments = []) => ({ number, title, body, state: "open", labels: [], comments: comments.map((text) => ({ author: "dev-account", body: text, date: "2026-10-18T09:00:00Z" })),
  url: `https://github.com/acme/product/issues/${number}` });
const ISSUES = [
  issue(1, "Nothing named", "It does not work for me."),
  issue(2, "The export", `The rule ${EXPORT} is violated: the file is a PNG.`),
  issue(3, "The long rule", `${EXPORT_LONG} is not met.`),
  issue(4, "Use case and test", "UC-002 shows it, and TST-001 does not catch it."),
  issue(5, "Module", "MOD-reader drops a page."),
  issue(6, "Comment", "See the thread.", [`A comment names ${MARGINS}.`, "And UC-999 does not exist."]),
  issue(7, "From a mail", "The export fails with error E42.\n\n<!-- agent-m: mails MAIL-ca171c6d1e8e76f0 -->"),
  issue(8, "Unknown", "UC-999 and THE RULE NOBODY WROTE are named."),
];
const contextOf = (params, { files = FILES, issues = ISSUES } = {}) => ({
  kind: null, params, product: { address: "https://github.com/acme/product", snapshot: snapshotOf(files), host: { listIssues: async () => issues } }, instance: { snapshot: snapshotOf({}), host: null, checkout: null },
  connect: async () => null, participants: [], places: { sources: {}, mailbox: null, contents: [] }, gates: [], person: "alice", now: new Date("2026-10-19T08:00:00Z"),
  agentM: { version: "unreleased", commit: "a".repeat(40) }, jobId: null,
});
const partsOf = async (number, options) => recipe()(contextOf({ issue: number }, options), { issue: number });
const namesOf = (parts) => parts.map((part) => part.name);
const textOf = (parts, name) => parts.find((part) => part.name === name)?.text;
const STATED_EXPORT = `**${EXPORT}** *(PO A)*\nThe export is one PDF file.\n*Check:* \`tests/reader.test.mjs\``;

// Runs `body` with a fetch that fails the test if it is called.
async function offline(body) {
  const real = globalThis.fetch, calls = [];
  globalThis.fetch = async (...args) => { calls.push(args); throw new Error("the recipe must make no request"); };
  try {
    return await body();
  } finally {
    globalThis.fetch = real;
    assert.deepEqual(calls, [], "no request was made");
  }
}

// TST-582101 · level: unit · module: MOD-issue-handling
// guards: UC-012; DERIVATION SEES THE EXISTING REQUIREMENTS
// given: the issue 1, which names no requirement, use case, test or module; known positive first — the recipe is registered
// input: the recipe for issue 1
// expect: two parts: the issue's, naming title and text, and the whole SPEC, named SPEC.md, holding its bytes untouched
test("issue-context — an issue that names nothing gets the whole SPEC after its own part", async () => {
  const parts = await offline(() => partsOf(1));
  assert.deepEqual(namesOf(parts), ["issue #1", "SPEC.md"]);
  assert.ok(textOf(parts, "issue #1").includes("Nothing named") && textOf(parts, "issue #1").includes("It does not work for me."));
  assert.equal(textOf(parts, "SPEC.md"), SPEC);
});

// TST-582102 · level: unit · module: MOD-issue-handling
// guards: UC-012; DERIVATION SEES THE EXISTING REQUIREMENTS
// given: the issue 2, which names THE EXPORT IS A PDF in its text
// input: the recipe for issue 2
// expect: the parts "issue #2" and the requirement's, named by it and holding it as the SPEC states it; no other requirement and not the whole SPEC
test("issue-context — a requirement the issue names is a part with its text, and the SPEC is left out", async () => {
  const parts = await partsOf(2);
  assert.deepEqual(namesOf(parts), ["issue #2", EXPORT]);
  assert.equal(textOf(parts, EXPORT), STATED_EXPORT);
});

// TST-582103 · level: unit · module: MOD-issue-handling
// guards: UC-012
// given: the issue 3, which names THE EXPORT IS A PDF WITH A TITLE PAGE, a name that begins with another name of the SPEC
// input: the recipe for issue 3
// expect: the requirement named is the long one alone; the shorter name, which only its beginning matches, is no part
test("issue-context — a name that only begins another name is not named", async () => {
  assert.deepEqual(namesOf(await partsOf(3)), ["issue #3", EXPORT_LONG]);
});

// TST-582104 · level: unit · module: MOD-issue-handling
// guards: UC-012; DERIVATION SEES THE EXISTING REQUIREMENTS
// given: the issue 4, which names UC-002 and TST-001; UC-002 realises EVERY MARGIN IS WIDE and TST-001 guards THE BODY TEXT IS SERIF
// input: the recipe for issue 4
// expect: the parts, in this order: the issue's, UC-002's file (named by its path, holding it whole), the requirement it realises, the test's file (named by its path) and the requirement it guards; the requirements are stated as the SPEC states them; no part twice
test("issue-context — a use case and a test the issue names are parts with the requirements the graph links to them", async () => {
  const parts = await partsOf(4);
  assert.deepEqual(namesOf(parts), ["issue #4", "docs/use-cases/UC-002-margins.md", MARGINS, "tests/reader.test.mjs", SERIF]);
  assert.equal(textOf(parts, "docs/use-cases/UC-002-margins.md"), FILES["docs/use-cases/UC-002-margins.md"]);
  assert.equal(textOf(parts, MARGINS), `**${MARGINS}** *(PO B)*\nEvery margin is at least 3 cm.\n*Check:* \`tests/reader.test.mjs\``);
  assert.equal(textOf(parts, SERIF), `**${SERIF}** *(PO B)*\nThe body text is set in a serif font.\n*Check:* \`tests/reader.test.mjs\``);
});

// TST-582105 · level: unit · module: MOD-issue-handling
// guards: UC-012
// given: the issue 5, which names MOD-reader; the test tests/reader.test.mjs exercises it and guards THE BODY TEXT IS SERIF
// input: the recipe for issue 5
// expect: the issue's part, the module's file and the requirement the test that exercises it guards
test("issue-context — a module the issue names is a part with the requirements its tests guard", async () => {
  assert.deepEqual(namesOf(await partsOf(5)), ["issue #5", "docs/architecture/MOD-reader.md", SERIF]);
});

// TST-582106 · level: unit · module: MOD-issue-handling
// guards: UC-012
// given: the issue 6, whose comments name EVERY MARGIN IS WIDE and UC-999, which the product does not hold
// input: the recipe for issue 6
// expect: the issue's part holds both comments and neither the author nor the date of a comment; the requirement of a comment is a part; UC-999 is no part and no failure
test("issue-context — the comments are read, without their authors and dates, and a name the product does not hold is no part", async () => {
  const parts = await partsOf(6);
  assert.deepEqual(namesOf(parts), ["issue #6", MARGINS]);
  const text = textOf(parts, "issue #6");
  assert.ok(text.includes(`A comment names ${MARGINS}.`) && text.includes("And UC-999 does not exist."));
  assert.equal(text.includes("dev-account") || text.includes("2026-10-18"), false);
});

// TST-582107 · level: unit · module: MOD-issue-handling
// guards: A PARTICIPANT THAT WRITES TO A REPOSITORY NEVER RECEIVES A MAIL; UC-012
// given: the issue 7, created from a mail: neutral text and the marker that lists the mail's identifier; the issue 8, which names only things the product does not hold
// input: the recipe for each, with every fetch failing the test
// expect: issue 7: the issue's part holds its text as the issue has it, and no part is named for a mail; issue 8: the issue's part and the whole SPEC
test("issue-context — an issue from a mail gives no mail as a part, and an issue that names nothing the product holds gets the whole SPEC", async () => {
  const mail = await offline(() => partsOf(7));
  assert.deepEqual(namesOf(mail), ["issue #7", "SPEC.md"]);
  assert.ok(textOf(mail, "issue #7").includes("The export fails with error E42."));
  const unknown = await partsOf(8);
  assert.deepEqual(namesOf(unknown), ["issue #8", "SPEC.md"]);
});

// TST-582108 · level: unit · module: MOD-issue-handling
// guards: UC-012
// given: known positive first — issue 2; then a number the host lists no issue under, and a job without the parameter
// input: the recipe for issue 2, for 99, and with no issue — the parameters empty, the issue undefined, and the issue null
// expect: issue 2 gives its parts; 99 is IssueNotFound { issue: 99 }; a job without the parameter `issue` gets no part (MOD-issue-handling, issueStrategies: "A job without the parameter `issue` gets no part, as `draft?` gives none without a draft")
test("issue-context — an issue the host does not list is IssueNotFound, and a job without an issue gets no part", async () => {
  assert.equal((await partsOf(2)).length, 2);
  await assert.rejects(partsOf(99), (error) => error.name === "IssueNotFound" && error.issue === 99);
  for (const params of [{}, { issue: undefined }, { issue: null }]) {
    assert.deepEqual(await recipe()(contextOf(params), params), [], JSON.stringify(params));
  }
  // A parameter that is present but no whole number is still a TypeError.
  await assert.rejects(recipe()(contextOf({ issue: "7" }), { issue: "7" }), TypeError);
});

// TST-582109 · level: unit · module: MOD-issue-handling
// guards: UC-012
// given: a product whose SPEC.md is missing and an issue that names nothing
// input: the recipe for issue 1
// expect: it fails with the snapshot's own answer rather than giving a part from less than the SPEC: SpecNotFound { path: "SPEC.md" }
test("issue-context — a product without a SPEC.md is SpecNotFound, never a context from less than the SPEC", async () => {
  const { "SPEC.md": _gone, ...without } = FILES;
  await assert.rejects(partsOf(1, { files: without }), (error) => error.name === "SpecNotFound" && error.path === "SPEC.md");
});
