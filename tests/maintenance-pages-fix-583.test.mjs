// A confirmed bug is fixed by a participant that can run tests, and its issue is closed with links once the fix is merged (ITM-583) — MOD-maintenance-pages' route `issue/<number>` over MOD-issue-handling's recipe `fix-inputs` and closeWithLinks and MOD-job-catalogue's kind
// `fix-bug`, as the accepted text of docs/architecture/MOD-maintenance-pages.md (:109-116) states it: "for a bug, the fixing participant — one that can run tests — and its run panel, the job queued on its route; [...] closing an issue with links once its pull request is merged"
// and (:164-170) "an issue's fix: the newest `fix-bug` job whose `works_on` names the issue, and the pull request of its branch, which the job's trail gives"; UC-012 step 5, 5b and its first postcondition.
// Run: node --test tests/maintenance-pages-fix-583.test.mjs
//
// Module: MOD-maintenance-pages; MOD-issue-handling; MOD-job-catalogue; MOD-runtimes
// Guards: UC-012; AN IMPLEMENTATION JOB BEGINS WITH A FAILING TEST; A JOB RUNS ONLY WHERE ITS RESOURCES ARE REACHABLE; THE PAGE NAMES WHERE IT SENDS; ONE CLICK PER DECISION; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK
// Level: component
//
// The world is tests/maintenance-pages-world.mjs: its model endpoint ep1 is the participant local-llm, its fake GitHub holds the issues of alice/product and takes git commits to the product; to its register this file adds the CI agent ci-bot, which declares write to the repository
// and run code and tests and whose route is the server's own runners. The page, MOD-issue-handling, MOD-job-catalogue, MOD-job-runner, MOD-run-planner, MOD-runtimes and MOD-repository-hosts are the real ones. Readings the texts leave open, which the tests state (the pull request names them):
//   - The fix is a section of the issue's page, <section class="issue-fix">, shown for an open issue whose class is bug — by its label, or by the person's click on Bug — and for no other class. It has what the analysis has under its own class names: <input class="fix-participant"> (radio)
//     for each participant of the register that declares what the kind needs (write to the repository, run code and tests), <input class="fix-person">, and beside them <input class="fix-requirement"> (the requirement the fix restores) and <input class="fix-modules"> (the modules it changes, separated
//     by commas, prefilled with the modules whose folder holds a file the analysis names as wrong); once a participant and a name are given, the run panel of the kind fix-bug. Run is the person's click.
//   - Run queues the job on the participant's route — a start record under docs/jobs/ committed to the product — and runs nothing in the tab; the page then shows <p class="job-queued">. The job's parameters are `issue`, `violated` (the requirement typed, left out when blank), `wrong`
//     (the files the analysis proposed), `modules` and `route` (as the record writes the route). A route that is not available — here a product without the job workflow — is named with its reason and nothing is written.
//   - Without a participant that declares what the kind needs, the section says so, <p class="issue-no-fixer">, and offers <button class="uc-017"> that goes, on a click, to Agent M's own use case UC-017 (the context's `go("use-case", { id: "UC-017", product: "" })`, the empty product naming the instance itself); it offers no run panel.
//   - After the section, <div class="issue-fix-trail"> names the newest job of the kind fix-bug whose works_on names the issue's address (<p class="fix-job">) and the pull request of the branch named after the job (<a class="fix-pull-request">, <p class="fix-pull"> with its state);
//     once it is merged, <button class="close-with-links"> "Close with links" — the person's click — closes the issue with closeWithLinks: the note "Closed with <the pull request's address>." and the state closed.

import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { PRODUCT, PRODUCT_URL, draw } from "./main-page-home-harness.mjs";
import { startRecord } from "../src/job-ledger/index.mjs";
import { connect, parseAddress } from "../src/repository-hosts/index.mjs";
import { registerStrategies } from "../src/job-runner/index.mjs";
import { runStrategies } from "../src/run-planner/index.mjs";
import { resourceStrategies } from "../src/resource-list/index.mjs";
import { LOCAL, buttonsOf, byClass, flush, one, restoreWorld, textOf, trusted, waitFor, world, routeNamed, pages } from "./maintenance-pages-world.mjs";

// The strategies the page's own view hands the frame, and those the prompt bar hands it on the dashboard (the recipes `implementation-inputs` and `resource-pins`), which the harness does not register.
for (const [at, strategies] of [...(pages.view?.strategies ?? []), runStrategies, resourceStrategies].entries()) {
  try { registerStrategies(`tests/maintenance-pages-fix-583.test.mjs#${at}`, strategies); } catch { /* registered by the page's own view */ }
}

afterEach(restoreWorld);

const PRODUCT_TOKEN = "github_pat_HOME827PRODUCT0123456789abcdefg";
const ISSUE_BODY = "FIRST RULE is broken: the export is cut off after the second page.";
const issueRecord = (number, labels) => ({ number, title: `Export loses pages ${number}`, body: ISSUE_BODY, state: "open", labels, comments: [] });
const issuesOf = () => [issueRecord(5, []), issueRecord(6, ["defect"]), issueRecord(7, ["change"]), issueRecord(8, ["defect"])];
const ADDRESS = (number) => `${PRODUCT_URL}/issues/${number}`;

const CI_AGENT = "| ci-bot | CI agent | fixture-llm | 100000 | — | draft text, read the repository, write to the repository, run code and tests | GitHub's hosted runners | ci hosted secret FIXTURE_KEY |";
const WORKFLOW = { ".github/workflows/agent-m-jobs.yml": "name: agent-m-jobs\n" };
const moduleText = (id, folder) => ["---", `id: ${id}`, `title: ${id}`, `folder: ${folder}`, "realises: []", "follows:", "  - ARC-001", "uses: []", "provides: []", "---", `# ${id} ${id}`, "",
  "## Responsibility", "", "It stores.", "", "## Parts", "", "- index.mjs", "", "## Data", "", "Nothing.", "", "## Interfaces", "", "None.", "", "## Files", "", "None.", "", "## Uses", "", "None.", ""].join("\n");
const decision = ["---", "id: ARC-001", "title: The whole", "designs:", "  - MOD-store", "---", "# ARC-001 The whole", "", "## Context", "", "c", "", "## Decision", "", "d", "", "## Alternatives", "", "a", "", "## Consequences", "", "q", ""].join("\n");
const PRODUCT_FILES = { ...WORKFLOW, "docs/architecture/ARC-001-whole.md": decision, "docs/architecture/MOD-store.md": moduleText("MOD-store", "src/store/"), "src/store/read.mjs": "export const read = 1;\n" };
const PROPOSAL = { class: "bug", reasoning: "FIRST RULE holds, and the code breaks it: the export drops pages.", wrong: ["src/store/read.mjs", "tests/store.test.mjs"] };

// The instance, as its register holds the book (the recipe chapters-for-tests of the kind reads chapter 13), read from this repository.
const BOOK_FOLDER = "docs/sources/SRC-vibe-coding/2026-10-05/";
const onDisk = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const BOOK = { "docs/sources/SRC-vibe-coding.md": onDisk("docs/sources/SRC-vibe-coding.md"),
  ...Object.fromEntries(readdirSync(new URL(`../${BOOK_FOLDER}`, import.meta.url)).map((name) => [BOOK_FOLDER + name, onDisk(BOOK_FOLDER + name)])) };

/** The world with the product chosen. */
function start({ product = PRODUCT_FILES, rows = [LOCAL, CI_AGENT], ...over } = {}) {
  const w = world({ mails: [], issues: issuesOf(), rows, answer: () => ({ draft: PROPOSAL, answers: [] }), product, instance: BOOK, ...over });
  w.context.product = { address: PRODUCT_URL, kind: "github", host: connect(parseAddress(PRODUCT_URL), { token: PRODUCT_TOKEN }), tokenStored: true };
  return w;
}
const open = (w, number) => {
  assert.ok(routeNamed("issue"), `the route issue: ${pages.error?.message}`);
  return draw(routeNamed("issue"), w.context, { number: String(number) });
};
const fixOf = (detail) => byClass(detail, "issue-fix")[0];
const issueOf = (w, number) => w.kept.issues.find((each) => each.number === number);
/** The files the git requests of the product wrote, taken once by their path and text. */
const writtenFiles = (w) => [...new Map(w.kept.github.filter((request) => request.method === "POST" && request.path.endsWith("/git/trees")).flatMap((request) => JSON.parse(request.body).tree ?? [])
  .filter((entry) => typeof entry.content === "string").map((entry) => [`${entry.path}\n${entry.content}`, entry])).values()];
const jobFiles = (w) => writtenFiles(w).filter((entry) => entry.path.startsWith("docs/jobs/"));

/** The issue opened, its fix section drawn, a participant and a name given, and the run panel drawn. */
async function ready(w, number = 6, { participant = "ci-bot", requirement = "" } = {}) {
  const detail = await open(w, number);
  await waitFor(() => byClass(detail, "issue-analysis").length > 0 && fixOf(detail) !== undefined);
  assert.ok(fixOf(detail), `issue ${number} shows the section to fix it`);
  const radio = byClass(fixOf(detail), "fix-participant").find((each) => each.value === participant);
  radio.checked = true;
  one(fixOf(detail), "fix-person").value = "Reviewer Rae";
  if (requirement) one(fixOf(detail), "fix-requirement").value = requirement;
  radio.dispatchEvent(new Event("change"));
  await waitFor(() => byClass(fixOf(detail), "run-panel").length > 0 || byClass(fixOf(detail), "issue-problem").length > 0);
  return detail;
}

// TST-583201 · level: component · module: MOD-maintenance-pages, MOD-issue-handling, MOD-job-catalogue, MOD-runtimes
// guards: UC-012; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK; THE PAGE NAMES WHERE IT SENDS; ONE CLICK PER DECISION
// given: known positive first — the issue 6 labelled defect; the register lists the model endpoint local-llm (draft text) and the CI agent ci-bot (write to the repository, run code and tests); the product has the job workflow
// input: the route issue 6; the participant ci-bot, the name "Reviewer Rae" and the requirement FIRST RULE; Run by a script and then by a person
// expect: the participants offered are ci-bot alone; the run panel states ci-bot's place and the parts it receives — the issue, the confirmed analysis and the instruction to write the regression test first among them; before the person's click nothing is written and no endpoint is asked; after it one file docs/jobs/JOB-….md is committed, a record of kind fix-bug working on the issue's address https://github.com/alice/product/issues/6, participant ci-bot, route ci hosted, with the parameters issue 6, violated FIRST RULE and route ci hosted; the page says the job is queued on the route ci hosted; nothing ran in the tab
test("issue — Fix offers the participants that can run tests, shows their run panel, and Run queues a fix-bug job of the issue on the participant's route", async () => {
  const w = start();
  const detail = await ready(w, 6, { requirement: "FIRST RULE" });
  assert.deepEqual(byClass(fixOf(detail), "fix-participant").map((radio) => radio.value), ["ci-bot"]);
  assert.equal(byClass(fixOf(detail), "issue-problem").length, 0, textOf(one(fixOf(detail), "issue-problem") ?? fixOf(detail)));
  const panel = one(fixOf(detail), "run-panel");
  assert.equal(byClass(panel, "blocking").length, 0, textOf(one(panel, "blocking") ?? panel));
  for (const wanted of ["ci-bot", "GitHub's hosted runners", "issue #6", "confirmed analysis", "regression test first"]) assert.ok(textOf(panel).includes(wanted), `the panel names ${wanted}`);
  assert.deepEqual(jobFiles(w), [], "nothing is written before Run");

  const run = buttonsOf(panel, "Run")[0];
  assert.ok(run, "Run is offered");
  run.dispatchEvent(new Event("click"));
  await flush();
  assert.deepEqual(jobFiles(w), [], "a click by a script writes nothing");
  await trusted(run);
  await waitFor(() => byClass(fixOf(detail), "job-queued").length > 0 || byClass(fixOf(detail), "issue-problem").length > 0);
  assert.equal(byClass(fixOf(detail), "issue-problem").length, 0, textOf(one(fixOf(detail), "issue-problem") ?? fixOf(detail)));
  const files = jobFiles(w);
  assert.equal(files.length, 1, files.map((entry) => entry.path).join(", "));
  const record = files[0].content;
  for (const wanted of ["kind: fix-bug", `${ADDRESS(6)}`, "ci-bot", "route: ci hosted", '"issue": 6', '"violated": "FIRST RULE"', '"route": "ci hosted"']) assert.ok(record.includes(wanted), `the record holds "${wanted}": ${record}`);
  assert.match(textOf(one(fixOf(detail), "job-queued")), /queued on the route ci hosted/);
  assert.equal(w.kept.endpoint.length, 0, "nothing was run in the tab: no endpoint was asked");
  assert.equal(issueOf(w, 6).state, "open");
});

// TST-583202 · level: component · module: MOD-maintenance-pages
// guards: UC-012; A PARTICIPANT DECLARES ITS CAPABILITIES
// given: known positive first (TST-583201's world offers ci-bot); a register that lists only the model endpoint local-llm, which declares draft text
// input: the route issue 6; the button UC-017 clicked
// expect: the section says that no participant that can run code and tests is configured and that a model endpoint cannot fix; it offers no participant, no name field and no run panel; the click goes to Agent M's own use case UC-017 (the context's go with the empty product), and before it nothing goes; nothing is written
test("issue — without a participant that can run tests the page says so and leads to UC-017 (UC-012 5b)", async () => {
  assert.deepEqual(byClass(await ready(start()), "fix-participant").length, 1, "known positive");
  restoreWorld();
  const w = start({ rows: [LOCAL] });
  const detail = await open(w, 6);
  await waitFor(() => byClass(detail, "issue-analysis").length > 0 && fixOf(detail) !== undefined);
  const said = textOf(one(fixOf(detail), "issue-no-fixer"));
  assert.match(said, /No participant that can run code and tests is configured/);
  assert.match(said, /model endpoint .* cannot fix/);
  for (const absent of ["fix-participant", "fix-person", "run-panel"]) assert.equal(byClass(fixOf(detail), absent).length, 0, absent);
  const lead = one(fixOf(detail), "uc-017");
  assert.equal(textOf(lead), "UC-017");
  assert.deepEqual(w.context.went, [], "nothing goes before the click");
  lead.dispatchEvent(new Event("click"));
  await flush();
  assert.deepEqual(w.context.went, [["use-case", { id: "UC-017", product: "" }]]);
  assert.deepEqual(jobFiles(w), []);
});

// TST-583203 · level: component · module: MOD-maintenance-pages
// guards: UC-012
// given: the issues 5 (no class), 6 (defect), 7 (change) and 8 (defect)
// input: the route issue for 6, 7 and 5; on 5 the person's click on Bug, and then on Change
// expect: 6 shows the fix section; 7 does not; 5 does not until the click on Bug, shows it after, and not after the click on Change
test("issue — the fix is offered for an issue whose class is bug, and for no other", async () => {
  const w = start();
  const six = await open(w, 6);
  await waitFor(() => byClass(six, "issue-analysis").length > 0 && fixOf(six) !== undefined);
  assert.equal(byClass(six, "issue-fix").length, 1);
  const seven = await open(w, 7);
  await waitFor(() => byClass(seven, "issue-analysis").length > 0);
  assert.equal(byClass(seven, "issue-fix").length, 0);
  const five = await open(w, 5);
  await waitFor(() => byClass(five, "set-class").length > 0);
  assert.equal(byClass(five, "issue-fix").length, 0);
  await trusted(byClass(five, "set-class").find((node) => node.getAttribute("data-class") === "bug"));
  await waitFor(() => byClass(five, "issue-fix").length > 0);
  assert.equal(byClass(five, "issue-fix").length, 1);
  await trusted(byClass(five, "set-class").find((node) => node.getAttribute("data-class") === "change"));
  await waitFor(() => byClass(five, "issue-fix").length === 0);
  assert.equal(byClass(five, "issue-fix").length, 0);
});

// TST-583204 · level: component · module: MOD-maintenance-pages, MOD-issue-handling
// guards: UC-012; A BACKLOG ITEM NAMES THE MODULES IT CHANGES
// given: the issue 5, which the participant local-llm analyses as a bug naming the files src/store/read.mjs and tests/store.test.mjs as wrong; the product's module MOD-store has the folder src/store/
// input: Analyse by a person; the person's click on Confirm bug; the participant ci-bot, a name, the requirement FIRST RULE; Run by a person
// expect: the field of the modules holds MOD-store; the job's record holds the parameters issue 5, violated FIRST RULE, wrong with both files and modules [MOD-store]; the run panel names the module's file and its code among the parts it sends
test("issue — the modules the analysis names are prefilled, and the confirmed analysis travels with the job", async () => {
  const w = start();
  const detail = await open(w, 5);
  await waitFor(() => byClass(detail, "participant").length > 0);
  const analyst = byClass(detail, "participant").find((each) => each.value === "local-llm");
  analyst.checked = true;
  one(detail, "person").value = "Reviewer Rae";
  analyst.dispatchEvent(new Event("change"));
  await waitFor(() => byClass(detail, "run-panel").length > 0);
  await trusted(buttonsOf(one(detail, "run-panel"), "Run")[0]);
  await waitFor(() => byClass(detail, "issue-proposal").length > 0 || byClass(detail, "issue-problem").length > 0);
  await trusted(byClass(detail, "set-class").find((node) => node.getAttribute("data-class") === "bug"));
  await waitFor(() => fixOf(detail) !== undefined);
  assert.equal(one(fixOf(detail), "fix-modules").value, "MOD-store");
  const radio = byClass(fixOf(detail), "fix-participant").find((each) => each.value === "ci-bot");
  radio.checked = true;
  one(fixOf(detail), "fix-person").value = "Reviewer Rae";
  one(fixOf(detail), "fix-requirement").value = "FIRST RULE";
  radio.dispatchEvent(new Event("change"));
  await waitFor(() => byClass(fixOf(detail), "run-panel").length > 0 || byClass(fixOf(detail), "issue-problem").length > 0);
  assert.equal(byClass(fixOf(detail), "issue-problem").length, 0, textOf(one(fixOf(detail), "issue-problem") ?? fixOf(detail)));
  const panel = one(fixOf(detail), "run-panel");
  for (const wanted of ["docs/architecture/MOD-store.md", "src/store/read.mjs"]) assert.ok(textOf(panel).includes(wanted), `the panel names ${wanted}`);
  await trusted(buttonsOf(panel, "Run")[0]);
  await waitFor(() => byClass(fixOf(detail), "job-queued").length > 0 || byClass(fixOf(detail), "issue-problem").length > 0);
  const record = jobFiles(w).find((entry) => entry.content.includes("kind: fix-bug"))?.content ?? "";
  for (const wanted of ['"issue": 5', '"violated": "FIRST RULE"', '"src/store/read.mjs"', '"tests/store.test.mjs"', '"MOD-store"']) assert.ok(record.includes(wanted), `the record holds ${wanted}: ${record}`);
});

// TST-583205 · level: component · module: MOD-maintenance-pages
// guards: UC-012; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK
// given: known positive first — the product has the job workflow; a product without it; the issue 6
// input: the participant ci-bot and a name in each; Run by a person
// expect: with the workflow a record is committed; without it the page names the reason (the product has no Agent M job workflow yet) beside the run panel and nothing is written
test("issue — a route that is not available is named with its reason, and nothing is written", async () => {
  const good = start();
  await trusted(buttonsOf(one(fixOf(await ready(good)), "run-panel"), "Run")[0]);
  await waitFor(() => jobFiles(good).length > 0);
  assert.equal(jobFiles(good).length, 1, "known positive");
  restoreWorld();
  const w = start({ product: { "docs/architecture/MOD-store.md": moduleText("MOD-store", "src/store/") } });
  const detail = await ready(w);
  await trusted(buttonsOf(one(fixOf(detail), "run-panel"), "Run")[0]);
  await waitFor(() => byClass(fixOf(detail), "issue-problem").length > 0);
  assert.match(textOf(fixOf(detail)), /the product has no Agent M job workflow yet/);
  assert.equal(byClass(fixOf(detail), "job-queued").length, 0);
  assert.deepEqual(jobFiles(w), []);
});

// ---------------------------------------------------------------- the fix's trail and the issue closed with links

const FIX_JOB = "JOB-20261028-0900-a1b2";
const FIX_RECORD = startRecord({ id: FIX_JOB, kind: "fix-bug", worksOn: [ADDRESS(6)], participant: "ci-bot", model: "fixture-llm", route: "ci hosted", run: null, retries: null, startedBy: "alice", start: new Date("2026-10-28T09:00:00Z"),
  agentM: { version: "unreleased", commit: "f".repeat(40) }, inputs: [], limit: 2, destinations: [{ participant: "ci-bot", place: "GitHub's hosted runners", parts: [] }], params: { issue: 6 } });
const OTHER_RECORD = startRecord({ id: "JOB-20261028-0800-0000", kind: "fix-bug", worksOn: [ADDRESS(7)], participant: "ci-bot", model: "fixture-llm", route: "ci hosted", run: null, retries: null, startedBy: "alice", start: new Date("2026-10-28T08:00:00Z"),
  agentM: { version: "unreleased", commit: "f".repeat(40) }, inputs: [], limit: 2, destinations: [{ participant: "ci-bot", place: "GitHub's hosted runners", parts: [] }], params: { issue: 7 } });
const WITH_FIX = { ...PRODUCT_FILES, [FIX_RECORD.path]: FIX_RECORD.text, [OTHER_RECORD.path]: OTHER_RECORD.text };

/** The world with the fix job of issue 6 and the pull requests the server lists for the branches: `pulls` maps a branch to the pull request as GitHub gives it, or to nothing. */
function withPulls(pulls) {
  const w = start({ product: WITH_FIX });
  const inner = globalThis.fetch;
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(typeof input === "object" && !(input instanceof URL) ? input.url : String(input));
    if (url.host === "api.github.com" && url.pathname === `/repos/${PRODUCT}/pulls`) {
      const branch = decodeURIComponent(url.searchParams.get("head") ?? "").split(":")[1];
      const found = url.searchParams.get("page") === "1" || url.searchParams.get("page") === null ? pulls[branch] ?? [] : [];
      return new Response(JSON.stringify(found), { status: 200, headers: { "content-type": "application/json" } });
    }
    // The facts of a listed pull request (pullRequestFacts): the request itself, with no commit, no changed file, no review and no check.
    const facts = new RegExp(`^/repos/${PRODUCT}/(?:pulls/(\\d+)(?:/(commits|files|reviews))?|commits/[0-9a-f]{40}/(check-runs|statuses))$`).exec(url.pathname);
    if (url.host === "api.github.com" && facts) {
      const [, number, list, check] = facts;
      const found = Object.values(pulls).flat().find((each) => String(each.number) === number);
      if (number && !found) return new Response(JSON.stringify({ message: "Not Found" }), { status: 404, headers: { "content-type": "application/json" } });
      return new Response(JSON.stringify(number && !list ? found : check === "check-runs" ? { check_runs: [] } : []), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (url.host === "api.github.com" && url.pathname === `/repos/${PRODUCT}/commits` && url.searchParams.get("sha") === FIX_JOB) return new Response(JSON.stringify({ message: "Not Found" }), { status: 404, headers: { "content-type": "application/json" } });
    return inner(input, init);
  };
  return w;
}
const pull = (state, merged) => ({ number: 9, title: `${FIX_JOB}: fix-bug`, body: `Job: ${FIX_JOB}`, state, draft: false, html_url: `${PRODUCT_URL}/pull/9`, created_at: "2026-10-28T09:10:00Z",
  merged_at: merged ? "2026-10-28T09:50:00Z" : null, closed_at: state === "closed" ? "2026-10-28T09:50:00Z" : null, merge_commit_sha: merged ? "3".repeat(40) : null, head: { ref: FIX_JOB, sha: "2".repeat(40) }, base: { ref: "main", sha: "b".repeat(40) } });

// TST-583206 · level: component · module: MOD-maintenance-pages, MOD-issue-handling
// guards: UC-012; ONE CLICK PER DECISION; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK
// given: known positive first — the fix job of the issue 6 (and another fix job, of the issue 7) is in the product's records, and the server lists no pull request for its branch; then the server lists the merged pull request #9 for the branch JOB-20261028-0900-a1b2
// input: the route issue 6; then, with the merged pull request, the route issue 6 again; Close with links by a script and then by a person
// expect: without a pull request the trail names the job and says that it has opened none, with no Close button; with the merged pull request it names the job and links the pull request as merged and offers Close with links; the script's click writes nothing; the person's adds the comment "Closed with https://github.com/alice/product/pull/9." to the issue 6 and closes it, and the page says so; the issue 7 is untouched
test("issue — the fix's pull request is named, and once it is merged Close with links closes the issue with a note naming it", async () => {
  const waiting = withPulls({});
  const first = await open(waiting, 6);
  await waitFor(() => byClass(first, "issue-fix-trail").length > 0);
  assert.match(textOf(one(first, "fix-job")), new RegExp(FIX_JOB));
  assert.equal(byClass(first, "fix-no-pull-request").length, 1);
  assert.deepEqual(buttonsOf(first, "Close with links"), []);
  restoreWorld();

  const w = withPulls({ [FIX_JOB]: [pull("closed", true)] });
  const detail = await open(w, 6);
  await waitFor(() => buttonsOf(detail, "Close with links").length > 0 || byClass(detail, "issue-problem").length > 0);
  assert.equal(byClass(detail, "issue-problem").length, 0, textOf(one(detail, "issue-problem") ?? detail));
  assert.match(textOf(one(detail, "fix-job")), new RegExp(FIX_JOB));
  assert.equal(one(detail, "fix-pull-request").getAttribute("href"), `${PRODUCT_URL}/pull/9`);
  assert.match(textOf(one(detail, "fix-pull")), /pull request #9 is merged/);
  const close = buttonsOf(detail, "Close with links")[0];
  close.dispatchEvent(new Event("click"));
  await flush();
  assert.deepEqual(issueOf(w, 6).comments, [], "a click by a script writes nothing");
  await trusted(close);
  await waitFor(() => byClass(detail, "fix-closed").some((node) => textOf(node) !== ""));
  assert.deepEqual(issueOf(w, 6).comments, [`Closed with ${PRODUCT_URL}/pull/9.`]);
  assert.equal(issueOf(w, 6).state, "closed");
  assert.match(textOf(one(detail, "fix-closed")), /closed with/);
  assert.deepEqual(issueOf(w, 7).comments, []);
  assert.equal(issueOf(w, 7).state, "open");
});

// TST-583207 · level: component · module: MOD-maintenance-pages
// guards: UC-012
// given: the fix job of the issue 6 and an open pull request #9 for its branch, which the fake host gives its facts (the request, and no commit, changed file, review or check); and the server's merged pull request of TST-583206 as known positive
// input: the route issue 6
// expect: the trail links the pull request as open, draws no issue-problem, and offers no Close with links; the issue is not closed
test("issue — a fix whose pull request is not merged yet is not closed", async () => {
  const w = withPulls({ [FIX_JOB]: [pull("open", false)] });
  const detail = await open(w, 6);
  await waitFor(() => byClass(detail, "fix-no-expectation").length > 0 || byClass(detail, "issue-problem").length > 0);
  assert.match(textOf(one(detail, "fix-pull")), /pull request #9 is open/);
  assert.deepEqual(buttonsOf(detail, "Close with links"), []);
  assert.equal(byClass(detail, "issue-problem").length, 0, textOf(one(detail, "issue-problem") ?? detail));
  assert.equal(issueOf(w, 6).state, "open");
});
