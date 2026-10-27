// A change from an issue is drafted and saved as a queue naming the issue (ITM-584) — MOD-maintenance-pages' route `issue/<number>` over MOD-issue-handling's recipe `issue-context` and MOD-job-catalogue's kind `change-requirements`, as the accepted text of
// docs/architecture/MOD-maintenance-pages.md (:117-126) states it: "for a change, the change of requirements drafted against the existing ones with the issue as its origin, run attended, its candidates shown by class beside the requirements they refer to and every conflict
// decided by the person, then *Save*, which writes them as a change queue naming the issue — the job of `change-requirements` given the issue's number as its parameter `issue` and the person's own source as its parameter `source`, which `personSource` names for
// `personAccount`'s account among the product's links and the instance's register, or, without one, the steps its precondition names"; UC-012 step 6 and its second postcondition.
// Run: node --test tests/maintenance-pages-save-584.test.mjs
//
// Module: MOD-maintenance-pages; MOD-issue-handling; MOD-job-catalogue
// Guards: THE PERSON WHO PROMPTS IS A SOURCE; EVOLUTION ENTERS THROUGH THE SPECIFICATION; EVERY ARTIFACT NAMES ITS ORIGIN; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK; UC-012
// Level: component
//
// The world is tests/maintenance-pages-world.mjs: its model endpoint ep1 is the participant local-llm, its fake GitHub holds the issues of alice/product, and the instance alice/agent-m, whose owner's account is github.com/alice. The page, MOD-issue-handling,
// MOD-job-catalogue, MOD-job-runner, MOD-spec-changes, MOD-source-register, MOD-runtimes and MOD-repository-hosts are the real ones. Readings the texts leave open, which the tests state (the pull request names them):
//   - The change is drafted and saved in a section of the issue's page, <section class="issue-change">, shown for an issue whose class is change — by its label, or by the person's click on Change — and for no other class. It has what the analysis has under its own class names: <input class="change-participant">
//     (radio) for each participant that declares draft text, <input class="change-person">, and, once both are given, the run panel of the kind change-requirements; Run is the person's click.
//   - The job's parameters are `issue` (the number) and `source` (the identifier of the person's register entry); the job's prompt carries the part of the issue-context recipe. Without a source the run panel lists the finding of the precondition person-source and offers no Run; nothing is sent.
//   - After Run the candidates are listed as <li class="candidate" data-class="new|change|duplicate|conflict"> and <button class="save-change"> "Save" is offered; Save is the person's click (`isTrusted`) and writes through the writer of the kind, MOD-job-runner's writeResult, as <p class="change-saved">.

import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { PRODUCT, PRODUCT_URL, draw } from "./main-page-home-harness.mjs";
import { connect, parseAddress } from "../src/repository-hosts/index.mjs";
import { readFileSync, readdirSync } from "node:fs";
import { registerStrategies } from "../src/job-runner/index.mjs";
import { buttonsOf, byClass, flush, one, restoreWorld, textOf, trusted, waitFor, world, routeNamed, pages } from "./maintenance-pages-world.mjs";

// The strategies the page's own view hands the frame, which the harness does not register.
for (const [at, strategies] of (pages.view?.strategies ?? []).entries()) {
  try { registerStrategies(`tests/maintenance-pages-save-584.test.mjs#${at}`, strategies); } catch { /* registered by the page's own view */ }
}

afterEach(restoreWorld);

const PRODUCT_TOKEN = "github_pat_HOME827PRODUCT0123456789abcdefg";
const ISSUE_BODY = "FIRST RULE says nothing about page counts: the export is cut off after the second page.";
const issueRecord = (number, labels) => ({ number, title: `Export loses pages ${number}`, body: ISSUE_BODY, state: "open", labels, comments: [] });
const ISSUES = [issueRecord(5, []), issueRecord(6, ["defect"]), issueRecord(7, ["change"])];

const lines = (...rows) => `${rows.join("\n")}\n`;
const SOURCE = "SRC-alice";
const LINKS = lines("# Requirement sources of the product", "", "| Source | Version | Hash | Part |", "|---|---|---|---|", `| ${SOURCE} | 2026-10-13 | ${"0".repeat(64)} | prompt |`);
const PERSON_SOURCE = lines("---", `id: ${SOURCE}`, "title: Alice", "kind: person", "identifier: github.com/alice", "authority: informative", "licence: may be republished - fixture", "---", `# ${SOURCE} Alice`, "",
  "## Versions", "", "| Version | Date | Edition | Read from | Files |", "|---|---|---|---|---|", "| `2026-10-13` | 2026-10-13 | fixture | this repository | one file, hashed only |");
// The instance's register entry of the book, which the kind's recipe `chapters-for-requirements` reads (MOD-source-register), and the files of its version, as this repository holds them.
const BOOK_FOLDER = "docs/sources/SRC-vibe-coding/2026-10-05/";
const onDisk = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const BOOK = { "docs/sources/SRC-vibe-coding.md": onDisk("docs/sources/SRC-vibe-coding.md"),
  ...Object.fromEntries(readdirSync(new URL(`../${BOOK_FOLDER}`, import.meta.url)).map((name) => [BOOK_FOLDER + name, onDisk(BOOK_FOLDER + name)])) };
const PERSON = { [`docs/sources/${SOURCE}.md`]: PERSON_SOURCE };
const WITH_SOURCE = { product: { "docs/sources.md": LINKS }, instance: { ...BOOK, ...PERSON } };
const WITHOUT_LINK = { instance: { ...BOOK, ...PERSON } };
const WITHOUT_ANY = { instance: BOOK };

const CANDIDATE = { name: "EVERY EXPORT KEEPS ALL PAGES", rule: "An export holds every page of the document.", check: "tests/unit.test.mjs", constrains: "product", passage: "the export is cut off after the second page", class: "new" };
const CONFLICT = { name: "THE EXPORT MAY DROP PAGES", rule: "An export may drop pages.", check: "tests/unit.test.mjs", constrains: "product", passage: "the export is cut off", class: "conflict" };

/** The world with the product chosen. */
function start(over = {}) {
  const w = world({ mails: [], issues: ISSUES, answer: () => ({ draft: { candidates: [CANDIDATE, CONFLICT] }, answers: [] }), ...over });
  w.context.product = { address: PRODUCT_URL, kind: "github", host: connect(parseAddress(PRODUCT_URL), { token: PRODUCT_TOKEN }), tokenStored: true };
  return w;
}
const open = (w, number) => {
  assert.ok(routeNamed("issue"), `the route issue: ${pages.error?.message}`);
  return draw(routeNamed("issue"), w.context, { number: String(number) });
};
const changeOf = (detail) => byClass(detail, "issue-change")[0];
/** The change section of the issue, a participant and a name given, and the run panel drawn. */
async function ready(w, number = 7) {
  const detail = await open(w, number);
  await waitFor(() => byClass(detail, "issue-analysis").length > 0 && changeOf(detail) !== undefined);
  assert.ok(changeOf(detail), `issue ${number} shows the section to draft and save its change`);
  const radio = byClass(changeOf(detail), "change-participant").find((each) => each.value === "local-llm");
  radio.checked = true;
  one(changeOf(detail), "change-person").value = "Reviewer Rae";
  radio.dispatchEvent(new Event("change"));
  await waitFor(() => byClass(changeOf(detail), "run-panel").length > 0 || byClass(changeOf(detail), "issue-problem").length > 0);
  assert.equal(byClass(changeOf(detail), "issue-problem").length, 0, textOf(one(changeOf(detail), "issue-problem") ?? changeOf(detail)));
  return detail;
}
/** What the git requests of the product wrote, as { path, content } over all trees. */
const writtenFiles = (w) => w.kept.github.filter((request) => request.method === "POST" && request.path.endsWith("/git/trees")).flatMap((request) => JSON.parse(request.body).tree ?? [])
  .filter((entry) => typeof entry.content === "string");
const queueFiles = (w) => writtenFiles(w).filter((entry) => entry.path.startsWith("docs/spec-freigaben/"));

// TST-584101 · level: component · module: MOD-maintenance-pages, MOD-issue-handling, MOD-job-catalogue
// guards: UC-012; EVERY ARTIFACT NAMES ITS ORIGIN; THE PERSON WHO PROMPTS IS A SOURCE; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK
// given: known positive first — the issue 7 labelled change; the product links the source SRC-alice, whose register entry in the instance is of the account github.com/alice, the account of the instance's owner; the participant answers a new candidate and a conflict
// input: the route issue 7; a participant and a name; Run by a person; Save by a script and then by a person
// expect: the run panel offers Run; the job's first request to the endpoint carries the issue's title and text; the candidates are listed by class, the new one and the conflict; before the person's click nothing is written under docs/spec-freigaben/; after it a queue whose index names
//   `**Issue:** #7 of https://github.com/alice/product` and whose rationale names the issue and the source SRC-alice; the conflict is not written
test("issue — Save runs change-requirements with the issue and the person's source and writes a queue naming the issue", async () => {
  const w = start(WITH_SOURCE);
  const detail = await ready(w);
  const panel = one(changeOf(detail), "run-panel");
  assert.equal(byClass(panel, "blocking").length, 0, "nothing blocks the job");
  await trusted(buttonsOf(panel, "Run")[0]);
  await waitFor(() => byClass(changeOf(detail), "candidate").length > 0 || byClass(changeOf(detail), "issue-problem").length > 0);
  assert.equal(byClass(changeOf(detail), "issue-problem").length, 0, textOf(changeOf(detail)));
  assert.ok(w.kept.endpoint.length >= 1, "the participant was asked");
  const sent = JSON.stringify(w.kept.endpoint[0].body);
  assert.ok(sent.includes("Export loses pages 7") && sent.includes("the export is cut off after the second page"), "the prompt carries the issue's part");
  assert.deepEqual(byClass(changeOf(detail), "candidate").map((node) => node.getAttribute("data-class")), ["new", "conflict"]);
  assert.ok(textOf(byClass(changeOf(detail), "candidate")[0]).includes(CANDIDATE.name));
  assert.deepEqual(queueFiles(w), [], "nothing is written before Save");

  const save = buttonsOf(changeOf(detail), "Save")[0];
  assert.ok(save, "Save is offered");
  save.dispatchEvent(new Event("click"));
  await flush();
  assert.deepEqual(queueFiles(w), [], "a click by a script writes nothing");
  await trusted(save);
  await waitFor(() => byClass(changeOf(detail), "change-saved").length > 0 || byClass(changeOf(detail), "issue-problem").length > 0);
  assert.equal(byClass(changeOf(detail), "issue-problem").length, 0, textOf(changeOf(detail)));
  const files = queueFiles(w);
  const index = files.find((entry) => entry.path.endsWith("/index.md"));
  assert.ok(index, `a queue index is written: ${files.map((entry) => entry.path)}`);
  assert.ok(index.content.includes("**Issue:** #7 of https://github.com/alice/product"), index.content);
  const rationale = files.find((entry) => entry.path.endsWith(".begruendung.md"));
  assert.ok(rationale.content.includes("issue #7 of https://github.com/alice/product") && rationale.content.includes(SOURCE), rationale.content);
  assert.ok(!files.some((entry) => entry.content.includes(CONFLICT.name)), "a conflict nobody decided is not written");
  assert.equal(w.kept.issues.find((issue) => issue.number === 7).state, "open");
});

// TST-584102 · level: component · module: MOD-maintenance-pages, MOD-job-catalogue
// guards: THE PERSON WHO PROMPTS IS A SOURCE; UC-012
// given: known positive first (TST-584101's world offers Run); the issue 7 labelled change; the product links no source; and a second world where the instance's register holds the person's entry but the product's links file does not link it
// input: the route issue 7, a participant and a name, in each
// expect: the run panel lists the finding of the precondition person-source, naming the two steps (register the person as a source, link that source to the product), and offers no Run; no request reaches the endpoint; nothing is written under docs/spec-freigaben/
test("issue — without a source of the person the page shows the steps the precondition names and runs nothing", async () => {
  for (const over of [WITHOUT_ANY, WITHOUT_LINK]) {
    const w = start(over);
    const detail = await ready(w);
    const panel = one(changeOf(detail), "run-panel");
    assert.match(textOf(one(panel, "blocking")), /register the person as a source \(#library\) and link that source to the product \(#sources\)/);
    assert.deepEqual(buttonsOf(panel, "Run"), []);
    assert.equal(w.kept.endpoint.length, 0);
    assert.deepEqual(queueFiles(w), []);
    restoreWorld();
  }
});

// TST-584103 · level: component · module: MOD-maintenance-pages
// guards: EVOLUTION ENTERS THROUGH THE SPECIFICATION; UC-012
// given: the issues 5 (no class), 6 (defect) and 7 (change)
// input: the route issue for 7, 6 and 5; on 5 the person's click on Change, and then on Bug
// expect: 7 shows the change section; 6 does not; 5 does not until the click on Change, shows it after, and not after the click on Bug
test("issue — the change is drafted for an issue whose class is change, and for no other", async () => {
  const w = start(WITH_SOURCE);
  const seven = await open(w, 7);
  await waitFor(() => byClass(seven, "issue-analysis").length > 0);
  assert.equal(byClass(seven, "issue-change").length, 1);
  assert.deepEqual(buttonsOf(changeOf(seven), "Save"), [], "Save waits for a draft");
  const six = await open(w, 6);
  await waitFor(() => byClass(six, "issue-analysis").length > 0);
  assert.equal(byClass(six, "issue-change").length, 0);
  const five = await open(w, 5);
  await waitFor(() => byClass(five, "set-class").length > 0);
  assert.equal(byClass(five, "issue-change").length, 0);
  await trusted(byClass(five, "set-class").find((node) => node.getAttribute("data-class") === "change"));
  await waitFor(() => byClass(five, "issue-change").length > 0);
  assert.equal(byClass(five, "issue-change").length, 1);
  await trusted(byClass(five, "set-class").find((node) => node.getAttribute("data-class") === "bug"));
  await waitFor(() => byClass(five, "issue-change").length === 0);
  assert.equal(byClass(five, "issue-change").length, 0);
});
