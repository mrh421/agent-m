// The kind `fix-bug` through the job runner (ITM-583) — MOD-job-catalogue's definition and prompt of the kind and MOD-issue-handling's recipe `fix-inputs`, prepared by MOD-job-runner, as docs/architecture/MOD-job-catalogue.md states the kind ("`fix-bug` | UC-012 | write to the
// repository, run code and tests | | `instruction?`, `fix-inputs`, `chapters-for-tests`, `resource-pins` | | | | `none` · `branch-and-pull-request` | the agent's report") and docs/architecture/MOD-issue-handling.md the recipe; UC-012 step 5.
// Run: node --test tests/job-catalogue-fix-bug.test.mjs
//
// Module: MOD-job-catalogue; MOD-issue-handling; MOD-job-runner
// Guards: AN IMPLEMENTATION JOB BEGINS WITH A FAILING TEST; A TEST JOB RECEIVES THE CHAPTER ON TESTING; A PARTICIPANT DECLARES ITS CAPABILITIES; UC-012
// Level: component
//
// The kind and its prompt are the catalogue's own, the recipes are those of MOD-issue-handling, MOD-run-planner, MOD-source-register, MOD-resource-list and MOD-runtimes (the writer) registered with the runner, the runner is the real one. The product is a fixture of this file, its host a fixture that lists
// one issue; the instance's register is the book's, read from this repository's files. Readings the texts leave open, which the tests state (the pull request names them):
//   - The kind is prepared for a participant that declares write to the repository and run code and tests, whose parts are, in the order of the kind's recipes, those of `fix-inputs`, then the chapter 13 of the book (`chapters-for-tests`), and none of `resource-pins` where the product
//     declares no resource a route reaches.
//   - The participant of the job is not offered the issue's mail: the issue's part holds the issue's text and nothing else of an issue created from a mail.
// The counter-proofs are recorded in the pull request.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { kindOf } from "../src/job-catalogue/index.mjs";
import { prepareJob, registerStrategies } from "../src/job-runner/index.mjs";
import { sourceStrategies } from "../src/source-register/index.mjs";
import { runStrategies } from "../src/run-planner/index.mjs";
import { resourceStrategies } from "../src/resource-list/index.mjs";
import { routeStrategies } from "../src/runtimes/index.mjs";

const handling = await import("../src/issue-handling/index.mjs").catch((error) => ({ error }));
for (const strategies of [handling.issueStrategies, sourceStrategies, runStrategies, resourceStrategies, routeStrategies].filter(Boolean)) {
  try { registerStrategies("tests/job-catalogue-fix-bug.test.mjs", strategies); } catch (error) { if (error.name !== "DuplicateStrategy") throw error; }
}

const participant = (name, capabilities, route = "bridge lab-pc-4 agent claude") => ({ name, type: "CLI agent", model: "example-model", context: 1000000, price: null, capabilities, place: "this machine", route });
const FIXER = participant("fixer-a", ["draft text", "read the repository", "write to the repository", "run code and tests"]);
const WRITER = participant("writer-b", ["draft text", "read the repository", "write to the repository"]);

const lines = (...rows) => `${rows.join("\n")}\n`;
const RULE = "THE EXPORT IS A PDF";
const MODULE = lines("---", "id: MOD-reader", "title: reader", "folder: src/reader/", "realises:", "follows:", "uses: []", "provides:", "  - read", "---", "# MOD-reader reader", "", "## Interfaces", "", "- `read`");
const PRODUCT_FILES = {
  "SPEC.md": lines("# Fixture — Specification", "", "## 1. Export", "", `**${RULE}** *(PO A)*`, "The export is one PDF file.", "*Check:* `tests/reader.test.mjs`"),
  "docs/architecture/MOD-reader.md": MODULE, "src/reader/index.mjs": "export const read = 1;\n", "tests/reader.test.mjs": lines("// TST-001", "// level: unit", "// module: MOD-reader", `// guards: ${RULE}`, "", "// the case follows"),
};
const BODY = `The rule ${RULE} is violated: the export is cut off after the second page.`;
const issue = { number: 5, title: "Export is cut off", body: BODY, state: "open", labels: ["defect"], comments: [], url: "https://github.com/acme/product/issues/5" };

// The instance, as its register holds the book: the entry and the files of the version, read from this repository.
const ROOT = new URL("../", import.meta.url);
const BOOK_FOLDER = "docs/sources/SRC-vibe-coding/2026-10-05/";
const BOOK = { "docs/sources/SRC-vibe-coding.md": readFileSync(new URL("docs/sources/SRC-vibe-coding.md", ROOT), "utf8"),
  ...Object.fromEntries(readdirSync(new URL(BOOK_FOLDER, ROOT)).map((name) => [BOOK_FOLDER + name, readFileSync(new URL(BOOK_FOLDER + name, ROOT), "utf8")])) };
const snapshotOf = (files) => ({ paths: Object.keys(files), read: async (path) => (Object.prototype.hasOwnProperty.call(files, path) ? files[path] : null), blob: () => null, readMany: async () => {} });

const contextOf = (kind, participants, params = { issue: 5, violated: RULE, wrong: ["src/reader/index.mjs"], modules: ["MOD-reader"], route: "bridge lab-pc-4" }) => ({
  kind, params, product: { address: "https://github.com/acme/product", snapshot: snapshotOf(PRODUCT_FILES), host: { listIssues: async () => [issue] } }, instance: { snapshot: snapshotOf(BOOK), host: null, checkout: null },
  connect: async () => null, participants, places: { sources: {}, mailbox: null, contents: [] }, gates: [], person: "alice", now: new Date("2026-10-28T08:00:00Z"),
  agentM: { version: "unreleased", commit: "0".repeat(40) }, jobId: "JOB-20261028-0900-a1b2",
});
async function prepared(drafter = FIXER, params) {
  assert.ok(handling.issueStrategies, `MOD-issue-handling offers issueStrategies: ${handling.error?.message}`);
  const context = contextOf(await kindOf("fix-bug"), [drafter], params);
  return { context, job: await prepareJob("fix-bug", context, { drafter, reviewers: [] }) };
}

// TST-583151 · level: component · module: MOD-job-catalogue
// guards: A TEST JOB RECEIVES THE CHAPTER ON TESTING; AN IMPLEMENTATION JOB BEGINS WITH A FAILING TEST; UC-012
// given: known positive first — the kind is read; the strategies of MOD-issue-handling, MOD-run-planner, MOD-source-register, MOD-resource-list and MOD-runtimes are registered; a participant that declares write to the repository and run code and tests
// input: prepareJob of fix-bug for issue 5 with the confirmed analysis (the violated requirement, the file wrong, the module MOD-reader), with that participant as the drafter
// expect: the kind is prepared — its recipe fix-inputs is registered, no UnknownStrategy —, nothing blocks, and the parts are, by recipe in the order of the kind's: those of fix-inputs (the issue, the requirement it names, the confirmed analysis, the module's inputs, the instruction), then the one of chapters-for-tests, chapter 13
test("fix-bug — is prepared over the recipe fix-inputs: the issue, the confirmed analysis, the module's inputs, the instruction and chapter 13 are the participant's parts", async () => {
  const { job } = await prepared();
  assert.equal(job.kind.name, "fix-bug");
  assert.deepEqual(job.blocking, []);
  const fixInputs = job.parts.filter((part) => part.recipe === "fix-inputs").map((part) => part.name);
  assert.deepEqual(fixInputs, ["issue #5", RULE, "confirmed analysis", "docs/architecture/MOD-reader.md", "SPEC.md", "src/reader/index.mjs", "tests/reader.test.mjs", "regression test first"]);
  const chapters = job.parts.filter((part) => part.recipe === "chapters-for-tests");
  assert.equal(chapters.length, 1);
  assert.match(chapters[0].name, /^13_software-testing\.md/);
  assert.deepEqual(job.parts.map((part) => part.recipe), [...fixInputs.map(() => "fix-inputs"), "chapters-for-tests"]);
  assert.deepEqual(job.destinations.map((each) => [each.participant.name, each.role, each.place]), [["fixer-a", "drafter", "this machine"]]);
});

// TST-583152 · level: component · module: MOD-job-catalogue
// guards: A PARTICIPANT DECLARES ITS CAPABILITIES; UC-012
// given: a participant that declares write to the repository and not run code and tests
// input: prepareJob of fix-bug for issue 5 with it as the drafter
// expect: one error under A PARTICIPANT DECLARES ITS CAPABILITIES naming writer-b, which keeps the job from starting; the known positive is TST-583151's
test("fix-bug — a participant that cannot run code and tests is not eligible", async () => {
  const { job } = await prepared(WRITER);
  assert.deepEqual(job.blocking.map((found) => [found.kind, found.rule]), [["error", "A PARTICIPANT DECLARES ITS CAPABILITIES"]]);
  assert.ok(job.blocking[0].what.includes("writer-b"), job.blocking[0].what);
});

// TST-583153 · level: component · module: MOD-job-catalogue
// guards: UC-012; A PARTICIPANT THAT WRITES TO A REPOSITORY NEVER RECEIVES A MAIL
// given: the kind prepared for the issue 5 and its confirmed analysis
// input: the text of the parts the prompt is filled with
// expect: the prompt's place for the recipe fix-inputs is filled with the issue's text, the requirement as the SPEC states it, the instruction to write the regression test first and the line `Job: JOB-20261028-0900-a1b2`; the places of the other recipes are filled too
test("fix-bug — the prompt is filled with the issue, the confirmed analysis and the instruction to write the regression test first", async () => {
  const { job } = await prepared();
  const all = job.parts.map((part) => part.text).join("\n");
  for (const wanted of [BODY, "The export is one PDF file.", "Write first a regression test that fails on the reported behaviour", "Job: JOB-20261028-0900-a1b2", "src/reader/index.mjs"]) {
    assert.ok(all.includes(wanted), `the parts hold "${wanted}"`);
  }
  const kind = await kindOf("fix-bug");
  for (const place of ["{{fix-inputs}}", "{{chapters-for-tests}}", "{{resource-pins}}"]) assert.ok(kind.prompt.includes(place), `the prompt has the place ${place}`);
});
