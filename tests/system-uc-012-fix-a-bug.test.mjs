// UC-012 "Handle an issue: bug fix or specification change", the bug path, as a system path: the author opens an issue on the route `issue/<number>` of MOD-maintenance-pages, has a participant analyse it, confirms the class bug (steps 2 to 4), chooses a participant that can run code and
// tests and queues its job (step 5, the fix, with the confirmed analysis and the regression test first); the job's start record is the file the page committed to the product, which the product's job workflow then finds in its checkout when the fix's pull request is merged, and
// MOD-workflow-entries' onPullRequestClosed closes the issue with a note naming the pull request (step 5, "and the issue is closed with a link to the fix"; the first postcondition); and the alternative flow 5b, where no participant can run code and tests.
// Run: node --test tests/system-uc-012-fix-a-bug.test.mjs
//
// Module: MOD-maintenance-pages; MOD-issue-handling; MOD-workflow-entries
// Guards: UC-012; EVOLUTION ENTERS THROUGH THE SPECIFICATION; AN IMPLEMENTATION JOB BEGINS WITH A FAILING TEST; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK; ONE CLICK PER DECISION
// Level: system
//
// The page half runs in the browser of tests/maintenance-pages-world.mjs (its model endpoint ep1 is the participant local-llm, the CI agent ci-bot is added to its register, its fake GitHub holds the issues of alice/product); the entry half runs in the job workflow's checkout of tests/workflow-entries-pull-request-world.mjs
// with the record the page wrote, over a fake of GitHub's REST API that serves the merged pull request. Nothing between the two is stubbed: the file the page committed is the file the entry reads. Each test states its input and its expected result in its own text (given / input / expect) from UC-012, before it
// runs; none reads an expected value from the page. The classes of the page's elements are those of tests/maintenance-pages-issues.test.mjs and tests/maintenance-pages-fix-583.test.mjs. The counter-proofs are recorded in the pull request.

import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { PRODUCT_URL, draw } from "./main-page-home-harness.mjs";
import { connect, parseAddress } from "../src/repository-hosts/index.mjs";
import { registerStrategies } from "../src/job-runner/index.mjs";
import { runStrategies } from "../src/run-planner/index.mjs";
import { resourceStrategies } from "../src/resource-list/index.mjs";
import { LOCAL, buttonsOf, byClass, one, restoreWorld, textOf, trusted, waitFor, world, routeNamed, pages } from "./maintenance-pages-world.mjs";
import { fakeGitHub, onPullRequestClosed, withCheckout } from "./workflow-entries-pull-request-world.mjs";

for (const [at, strategies] of [...(pages.view?.strategies ?? []), runStrategies, resourceStrategies].entries()) {
  try { registerStrategies(`tests/system-uc-012-fix-a-bug.test.mjs#${at}`, strategies); } catch { /* registered by the page's own view */ }
}

afterEach(restoreWorld);

const PRODUCT_TOKEN = "github_pat_HOME827PRODUCT0123456789abcdefg";
const ISSUE_BODY = "FIRST RULE is broken: the export is cut off after the second page.";
const issuesOf = () => [{ number: 5, title: "Export loses pages", body: ISSUE_BODY, state: "open", labels: [], comments: [] }];
const CI_AGENT = "| ci-bot | CI agent | fixture-llm | 100000 | — | draft text, read the repository, write to the repository, run code and tests | GitHub's hosted runners | ci hosted secret FIXTURE_KEY |";
const moduleText = (id, folder) => ["---", `id: ${id}`, `title: ${id}`, `folder: ${folder}`, "realises: []", "follows:", "  - ARC-001", "uses: []", "provides: []", "---", `# ${id} ${id}`, "",
  "## Responsibility", "", "It stores.", "", "## Parts", "", "- index.mjs", "", "## Data", "", "Nothing.", "", "## Interfaces", "", "None.", "", "## Files", "", "None.", "", "## Uses", "", "None.", ""].join("\n");
const decision = ["---", "id: ARC-001", "title: The whole", "designs:", "  - MOD-store", "---", "# ARC-001 The whole", "", "## Context", "", "c", "", "## Decision", "", "d", "", "## Alternatives", "", "a", "", "## Consequences", "", "q", ""].join("\n");
const PRODUCT_FILES = { ".github/workflows/agent-m-jobs.yml": "name: agent-m-jobs\n", "docs/architecture/ARC-001-whole.md": decision, "docs/architecture/MOD-store.md": moduleText("MOD-store", "src/store/"),
  "src/store/read.mjs": "export const read = 1;\n" };
const PROPOSAL = { class: "bug", reasoning: "FIRST RULE holds, and the code breaks it: the export drops pages.", wrong: ["src/store/read.mjs"] };
const BOOK_FOLDER = "docs/sources/SRC-vibe-coding/2026-10-05/";
const onDisk = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const BOOK = { "docs/sources/SRC-vibe-coding.md": onDisk("docs/sources/SRC-vibe-coding.md"),
  ...Object.fromEntries(readdirSync(new URL(`../${BOOK_FOLDER}`, import.meta.url)).map((name) => [BOOK_FOLDER + name, onDisk(BOOK_FOLDER + name)])) };

function start(over = {}) {
  const w = world({ mails: [], issues: issuesOf(), rows: [LOCAL, CI_AGENT], answer: () => ({ draft: PROPOSAL, answers: [] }), product: PRODUCT_FILES, instance: BOOK, ...over });
  w.context.product = { address: PRODUCT_URL, kind: "github", host: connect(parseAddress(PRODUCT_URL), { token: PRODUCT_TOKEN }), tokenStored: true };
  return w;
}
const writtenFiles = (w) => [...new Map(w.kept.github.filter((request) => request.method === "POST" && request.path.endsWith("/git/trees")).flatMap((request) => JSON.parse(request.body).tree ?? [])
  .filter((entry) => typeof entry.content === "string").map((entry) => [`${entry.path}\n${entry.content}`, entry])).values()];
const fixOf = (detail) => byClass(detail, "issue-fix")[0];

/** Steps 2 to 4: the issue 5 opened, analysed by local-llm as a bug, and confirmed as one by the person's click. */
async function confirmed(w) {
  assert.ok(routeNamed("issue"), `the route issue: ${pages.error?.message}`);
  const detail = await draw(routeNamed("issue"), w.context, { number: "5" });
  await waitFor(() => byClass(detail, "participant").length > 0);
  const analyst = byClass(detail, "participant").find((each) => each.value === "local-llm");
  analyst.checked = true;
  one(detail, "person").value = "Reviewer Rae";
  analyst.dispatchEvent(new Event("change"));
  await waitFor(() => byClass(detail, "run-panel").length > 0);
  await trusted(buttonsOf(one(detail, "run-panel"), "Run")[0]);
  await waitFor(() => byClass(detail, "issue-proposal").length > 0 || byClass(detail, "issue-problem").length > 0);
  assert.equal(textOf(one(detail, "proposed-class")), "The participant proposes: bug");
  await trusted(byClass(detail, "set-class").find((node) => node.getAttribute("data-class") === "bug"));
  await waitFor(() => fixOf(detail) !== undefined);
  return detail;
}

// TST-583401 · level: system · module: MOD-maintenance-pages, MOD-issue-handling, MOD-workflow-entries
// guards: UC-012; AN IMPLEMENTATION JOB BEGINS WITH A FAILING TEST; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK; ONE CLICK PER DECISION
// given: the open issue 5 of alice/product, which names FIRST RULE; the register lists local-llm (draft text) and ci-bot (write to the repository, run code and tests); the product has the job workflow and the module MOD-store; local-llm analyses the issue as a bug that src/store/read.mjs causes
// input: the author analyses the issue with local-llm and confirms the class bug (steps 2 to 4); chooses ci-bot, names the requirement FIRST RULE and presses Run (step 5); the fix's pull request #7 is merged and the product's job workflow runs onPullRequestClosed on the commit that holds the job's record
// expect: step 5: one job record is committed to the product — kind fix-bug, working on https://github.com/alice/product/issues/5, participant ci-bot, route ci hosted, parameters issue 5, violated FIRST RULE, wrong [src/store/read.mjs], modules [MOD-store] —, the issue is still open and the model endpoint was asked once (the analysis, not the fix: nothing runs in the tab); on the merge: onPullRequestClosed ends `done`, the issue 5 receives the comment "Closed with https://github.com/alice/product/pull/7." and is closed, in this order and with the person's token
test("UC-012 — a bug is confirmed, its fix is queued on the participant's route, and once the fix's pull request is merged the issue is closed with a link to it", async () => {
  const w = start();
  const detail = await confirmed(w);
  const radio = byClass(fixOf(detail), "fix-participant").find((each) => each.value === "ci-bot");
  radio.checked = true;
  one(fixOf(detail), "fix-person").value = "Reviewer Rae";
  one(fixOf(detail), "fix-requirement").value = "FIRST RULE";
  radio.dispatchEvent(new Event("change"));
  await waitFor(() => byClass(fixOf(detail), "run-panel").length > 0 || byClass(fixOf(detail), "issue-problem").length > 0);
  assert.equal(byClass(fixOf(detail), "issue-problem").length, 0, textOf(one(fixOf(detail), "issue-problem") ?? fixOf(detail)));
  await trusted(buttonsOf(one(fixOf(detail), "run-panel"), "Run")[0]);
  await waitFor(() => byClass(fixOf(detail), "job-queued").length > 0 || byClass(fixOf(detail), "issue-problem").length > 0);
  assert.equal(byClass(fixOf(detail), "issue-problem").length, 0, textOf(one(fixOf(detail), "issue-problem") ?? fixOf(detail)));

  const fixes = writtenFiles(w).filter((entry) => entry.path.startsWith("docs/jobs/") && entry.content.includes("kind: fix-bug"));
  assert.equal(fixes.length, 1);
  const record = fixes[0];
  for (const wanted of [`${PRODUCT_URL}/issues/5`, "participant: ci-bot", "route: ci hosted", '"issue": 5', '"violated": "FIRST RULE"', '"src/store/read.mjs"', '"MOD-store"']) assert.ok(record.content.includes(wanted), `the record holds ${wanted}`);
  assert.equal(w.kept.endpoint.length, 1, "the endpoint was asked once, for the analysis");
  assert.equal(w.kept.issues.find((issue) => issue.number === 5).state, "open");
  restoreWorld();

  const id = /^docs\/jobs\/(JOB-[^/]+)\.md$/.exec(record.path)[1];
  await withCheckout([{ path: record.path, text: record.content }], async (checkout) => {
    const server = fakeGitHub({ repository: "alice/product", title: `${id}: fix-bug`, body: `Job: ${id}\nKind: fix-bug\nRequirements guarded by the new tests: FIRST RULE`, branch: id });
    const status = await onPullRequestClosed(checkout, server);
    assert.equal(status.outcome, "done", status.summary);
    assert.deepEqual(server.writes(), [["POST", "/issues/5/comments", { body: `Closed with ${PRODUCT_URL}/pull/7.` }], ["PATCH", "/issues/5", { state: "closed" }]]);
  }, { repository: "alice/product" });
});

// TST-583402 · level: system · module: MOD-maintenance-pages
// guards: UC-012; A PARTICIPANT DECLARES ITS CAPABILITIES
// given: alternative flow 5b — the register lists only local-llm, a model endpoint that declares draft text; the issue 5 analysed as a bug and confirmed
// input: the author opens the fix section after confirming the class
// expect: the page says that no participant that can run code and tests is configured, and that a model endpoint may analyse but cannot fix; it offers the button UC-017 and no run panel; no job record is committed
test("UC-012 5b — with no participant that can run code and tests the page says so and links UC-017, and starts no job", async () => {
  const w = start({ rows: [LOCAL] });
  const detail = await confirmed(w);
  assert.match(textOf(one(fixOf(detail), "issue-no-fixer")), /No participant that can run code and tests is configured/);
  assert.equal(textOf(one(fixOf(detail), "uc-017")), "UC-017");
  assert.equal(byClass(fixOf(detail), "run-panel").length, 0);
  assert.deepEqual(writtenFiles(w).filter((entry) => entry.path.startsWith("docs/jobs/") && entry.content.includes("kind: fix-bug")), []);
});
