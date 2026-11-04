// The instance's workflow that applies approved SPEC changes runs MOD-workflow-entries' entry onApprovalsCommitted and nothing else (ITM-691), as the accepted text of
// docs/architecture/MOD-workflow-entries.md states it: "`apply-approvals.yml` runs `onApprovalsCommitted` … each and nothing else".
// Run: node --test tests/workflow-entries-apply-approvals-workflow.test.mjs
//
// Module: MOD-workflow-entries
// Guards: EVERY CODE FILE BELONGS TO A MODULE; WITHOUT A TOKEN, THE INSTANCE'S WORKFLOW WRITES THE CHANGE
// Level: unit
//
// Reads files of the repository; nothing runs. Where the text leaves a reading open, the test states the one it takes:
//   - "Runs the entry and nothing else": the only command the workflow's steps run besides checking the repository out, setting Node up and passing the workflow's token is
//     `node src/workflow-entries/main.mjs onApprovalsCommitted`; the workflow names no script of tools/ and no other entry, and writes and commits no file itself.
// Each test states its input and its expected result before it runs (given / input / expect).

import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// The commands a workflow file runs: its `run:` lines, a block's lines each.
function commands(text) {
  const lines = text.split("\n"), found = [];
  for (let i = 0; i < lines.length; i += 1) {
    const match = /^(\s*)(?:- )?run:\s*(.*)$/.exec(lines[i]);
    if (!match) continue;
    if (/^[|>]/.test(match[2])) {
      const indent = lines[i + 1]?.match(/^\s*/)[0].length ?? 0;
      for (let j = i + 1; j < lines.length && (lines[j].trim() === "" || lines[j].match(/^\s*/)[0].length >= indent); j += 1) if (lines[j].trim()) found.push(lines[j].trim());
    } else found.push(match[2].trim());
  }
  return found;
}
const runsOnlyTheEntry = (text) => {
  const ran = commands(text);
  return ran.length === 1 && ran[0] === "node src/workflow-entries/main.mjs onApprovalsCommitted";
};

// TST-691001 · level: unit · module: MOD-workflow-entries
// guards: WITHOUT A TOKEN, THE INSTANCE'S WORKFLOW WRITES THE CHANGE
// given: .github/workflows/apply-approvals.yml
// input: its text
// expect: it runs on a push to docs/approvals/ on main and on dispatch; its one command is `node src/workflow-entries/main.mjs onApprovalsCommitted`, with the workflow's token as GITHUB_TOKEN; it names no script of tools/; counter-proof: the text of the workflow before this item, which runs tools/apply_approvals.py, does not pass the same check
test("the apply-approvals workflow runs the entry onApprovalsCommitted and nothing else", () => {
  const text = readFileSync(join(ROOT, ".github/workflows/apply-approvals.yml"), "utf8");
  assert.deepEqual(commands(text), ["node src/workflow-entries/main.mjs onApprovalsCommitted"]);
  assert.ok(runsOnlyTheEntry(text));
  assert.match(text, /paths:\s*\["docs\/approvals\/\*\*"\]/);
  assert.match(text, /workflow_dispatch:/);
  assert.match(text, /GITHUB_TOKEN:\s*\$\{\{\s*secrets\.GITHUB_TOKEN\s*\}\}/);
  assert.doesNotMatch(text, /tools\//);
  const before = "jobs:\n  apply:\n    steps:\n      - name: Apply\n        run: |\n          python3 tools/apply_approvals.py | tee apply-report.txt\n      - name: Commit\n        run: |\n          git commit -F msg.txt\n";
  assert.equal(runsOnlyTheEntry(before), false);
});

// TST-691002 · level: unit · module: MOD-workflow-entries
// guards: EVERY CODE FILE BELONGS TO A MODULE
// given: the files the module files name as taken over for this item
// input: whether each exists
// expect: tools/apply_approvals.py and docs/assets/review-core/apply-approvals.mjs do not; the entry's own file and applyApproved's do (the known positive: the check finds a file that is there)
test("the files taken over for the apply-approvals entry are removed", () => {
  assert.equal(existsSync(join(ROOT, "tools/apply_approvals.py")), false);
  assert.equal(existsSync(join(ROOT, "docs/assets/review-core/apply-approvals.mjs")), false);
  assert.equal(existsSync(join(ROOT, "src/workflow-entries/instance.mjs")), true);
  assert.equal(existsSync(join(ROOT, "src/spec-changes/accept.mjs")), true);
});
