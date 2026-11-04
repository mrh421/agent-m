// A change drafted from an issue shows its candidates beside their requirements, and each conflict is decided (ITM-1256) — MOD-maintenance-pages' route `issue/<number>`, as the accepted text of
// docs/architecture/MOD-maintenance-pages.md states it: "for a change, the change of requirements drafted against the existing ones with the issue as its origin, run attended, its candidates shown by
// class beside the requirements they refer to and every conflict decided by the person, then *Save*"; UC-012 step 6.
// Run: node --test tests/maintenance-pages-conflict-1256.test.mjs
//
// Module: MOD-maintenance-pages
// Guards: A CONFLICT IS DECIDED BY A PERSON; A CANDIDATE IS NEW, A CHANGE, A DUPLICATE OR A CONFLICT; UC-012
// Level: unit
//
// The world is tests/maintenance-pages-world.mjs, as tests/maintenance-pages-save-584.test.mjs sets it up: the product alice/product, whose SPEC holds FIRST RULE ("The first rule holds.") and SECOND
// RULE ("The second rule holds."), links the source SRC-alice of the instance's owner; the participant local-llm answers the draft a case gives. Readings the texts leave open, which the tests state
// (the pull request names them):
//   - The requirement a candidate refers to is the one its class names in `of`; its rule is the one the prepared job's parts give for that name (MOD-job-runner's Part, `artifacts`: "for a requirement
//     its name and its rule"). It stands in the candidate's item as <p class="candidate-refers">, naming the requirement and its rule; a candidate that refers to none has no such line.
//   - A conflict's decision is <select class="conflict-decision"> in its item: an empty choice while undecided, then `new`, `change` and `duplicate`, the classes a conflict may be decided as —
//     "a conflict decided as the class the person gives it", which `writeResult` writes "with its `classes` replaced by theirs" (MOD-job-runner).
//   - Save, <button class="save-change">, is disabled while a conflict is undecided, and enabled once every conflict is decided.

import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { PRODUCT_URL, draw } from "./main-page-home-harness.mjs";
import { connect, parseAddress } from "../src/repository-hosts/index.mjs";
import { readFileSync, readdirSync } from "node:fs";
import { registerStrategies } from "../src/job-runner/index.mjs";
import { buttonsOf, byClass, flush, one, restoreWorld, textOf, trusted, waitFor, world, routeNamed, pages } from "./maintenance-pages-world.mjs";

// The strategies the page's own view hands the frame, which the harness does not register.
for (const [at, strategies] of (pages.view?.strategies ?? []).entries()) {
  try { registerStrategies(`tests/maintenance-pages-conflict-1256.test.mjs#${at}`, strategies); } catch { /* registered by the page's own view */ }
}

afterEach(restoreWorld);

const PRODUCT_TOKEN = "github_pat_HOME827PRODUCT0123456789abcdefg";
const ISSUE = { number: 7, title: "Export loses pages 7", body: "FIRST RULE says nothing about page counts: the export is cut off after the second page.", state: "open", labels: ["change"], comments: [] };

const lines = (...rows) => `${rows.join("\n")}\n`;
const SOURCE = "SRC-alice";
const LINKS = lines("# Requirement sources of the product", "", "| Source | Version | Hash | Part |", "|---|---|---|---|", `| ${SOURCE} | 2026-10-13 | ${"0".repeat(64)} | prompt |`);
const PERSON_SOURCE = lines("---", `id: ${SOURCE}`, "title: Alice", "kind: person", "identifier: github.com/alice", "authority: informative", "licence: may be republished - fixture", "---", `# ${SOURCE} Alice`, "",
  "## Versions", "", "| Version | Date | Edition | Read from | Files |", "|---|---|---|---|---|", "| `2026-10-13` | 2026-10-13 | fixture | this repository | one file, hashed only |");
const BOOK_FOLDER = "docs/sources/SRC-vibe-coding/2026-10-05/";
const onDisk = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const BOOK = { "docs/sources/SRC-vibe-coding.md": onDisk("docs/sources/SRC-vibe-coding.md"),
  ...Object.fromEntries(readdirSync(new URL(`../${BOOK_FOLDER}`, import.meta.url)).map((name) => [BOOK_FOLDER + name, onDisk(BOOK_FOLDER + name)])) };

const NEW = { name: "EVERY EXPORT KEEPS ALL PAGES", rule: "An export holds every page of the document.", check: "tests/unit.test.mjs", constrains: "product", passage: "the export is cut off after the second page", class: "new" };
const CHANGE = { name: "SECOND RULE", rule: "The second rule holds for every export.", check: "tests/unit.test.mjs", constrains: "product", passage: "the export is cut off", class: "change", of: "SECOND RULE" };
const CONFLICT = { name: "THE EXPORT MAY DROP PAGES", rule: "An export may drop pages.", check: "tests/unit.test.mjs", constrains: "product", passage: "the export is cut off", class: "conflict", of: "FIRST RULE" };

/** The world with the product chosen, the issue 7 labelled change, and the participant answering `candidates`. */
function start(candidates) {
  const w = world({ mails: [], issues: [ISSUE], answer: () => ({ draft: { candidates }, answers: [] }), product: { "docs/sources.md": LINKS }, instance: { ...BOOK, [`docs/sources/${SOURCE}.md`]: PERSON_SOURCE } });
  w.context.product = { address: PRODUCT_URL, kind: "github", host: connect(parseAddress(PRODUCT_URL), { token: PRODUCT_TOKEN }), tokenStored: true };
  return w;
}
const changeOf = (detail) => byClass(detail, "issue-change")[0];
const itemOf = (detail, name) => byClass(changeOf(detail), "candidate").find((node) => node.getAttribute("data-name") === name);
const queueFiles = (w) => w.kept.github.filter((request) => request.method === "POST" && request.path.endsWith("/git/trees")).flatMap((request) => JSON.parse(request.body).tree ?? [])
  .filter((entry) => typeof entry.content === "string" && entry.path.startsWith("docs/spec-freigaben/"));

/** The issue 7 drafted: a participant and a name given, Run by a person, and the candidates listed. */
async function drafted(w) {
  assert.ok(routeNamed("issue"), `the route issue: ${pages.error?.message}`);
  const detail = await draw(routeNamed("issue"), w.context, { number: "7" });
  await waitFor(() => changeOf(detail) !== undefined && byClass(changeOf(detail), "change-participant").length > 0);
  const radio = byClass(changeOf(detail), "change-participant").find((each) => each.value === "local-llm");
  radio.checked = true;
  one(changeOf(detail), "change-person").value = "Reviewer Rae";
  radio.dispatchEvent(new Event("change"));
  await waitFor(() => byClass(changeOf(detail), "run-panel").length > 0 || byClass(changeOf(detail), "issue-problem").length > 0);
  assert.equal(byClass(changeOf(detail), "issue-problem").length, 0, textOf(one(changeOf(detail), "issue-problem") ?? changeOf(detail)));
  await trusted(buttonsOf(one(changeOf(detail), "run-panel"), "Run")[0]);
  await waitFor(() => byClass(changeOf(detail), "candidate").length > 0 || byClass(changeOf(detail), "issue-problem").length > 0);
  assert.equal(byClass(changeOf(detail), "issue-problem").length, 0, textOf(changeOf(detail)));
  return detail;
}

// TST-1256001 · level: unit · module: MOD-maintenance-pages
// guards: UC-012; A CANDIDATE IS NEW, A CHANGE, A DUPLICATE OR A CONFLICT
// given: the issue 7 labelled change; the participant answers a new candidate, a change of SECOND RULE and a conflict with FIRST RULE; the SPEC holds FIRST RULE "The first rule holds." and SECOND RULE "The second rule holds."
// input: the route issue 7; a participant and a name; Run by a person
// expect: each candidate is listed with its class; the change's item names SECOND RULE beside its rule "The second rule holds.", the conflict's names FIRST RULE beside "The first rule holds.", and the new candidate's names no requirement. Counter-proof: before the change no item shows the rule of the requirement it refers to
test("issue — each drafted candidate is shown with its class beside the requirement it refers to", async () => {
  const w = start([NEW, CHANGE, CONFLICT]);
  const detail = await drafted(w);
  assert.deepEqual(byClass(changeOf(detail), "candidate").map((node) => [node.getAttribute("data-name"), node.getAttribute("data-class")]),
    [[NEW.name, "new"], [CHANGE.name, "change"], [CONFLICT.name, "conflict"]]);
  const refers = (name) => byClass(itemOf(detail, name), "candidate-refers").map(textOf);
  assert.equal(refers(CHANGE.name).length, 1, "the change is shown beside the requirement it changes");
  assert.ok(refers(CHANGE.name)[0].includes("SECOND RULE") && refers(CHANGE.name)[0].includes("The second rule holds."), refers(CHANGE.name)[0]);
  assert.equal(refers(CONFLICT.name).length, 1, "the conflict is shown beside the requirement it contradicts");
  assert.ok(refers(CONFLICT.name)[0].includes("FIRST RULE") && refers(CONFLICT.name)[0].includes("The first rule holds."), refers(CONFLICT.name)[0]);
  assert.deepEqual(refers(NEW.name), [], "a new candidate refers to no requirement");
});

// TST-1256002 · level: unit · module: MOD-maintenance-pages
// guards: A CONFLICT IS DECIDED BY A PERSON; UC-012
// given: the issue 7 labelled change; the participant answers a new candidate and a conflict with FIRST RULE
// input: the route issue 7; a participant and a name; Run by a person; then Save by a person while the conflict is undecided
// expect: the conflict's item offers its decision, a choice among new, change and duplicate, undecided at first; the new candidate's item offers none; Save is shown and disabled; the click on it writes nothing under docs/spec-freigaben/. Counter-proof: before the change the conflict offers no decision and Save is enabled
test("issue — a conflict offers the person's decision, and Save waits for it", async () => {
  const w = start([NEW, CONFLICT]);
  const detail = await drafted(w);
  const decision = byClass(itemOf(detail, CONFLICT.name), "conflict-decision");
  assert.equal(decision.length, 1, "the conflict offers a decision");
  assert.deepEqual(decision[0].children.filter((node) => typeof node !== "string").map((option) => option.value), ["", "new", "change", "duplicate"]);
  assert.equal(decision[0].value, "", "the conflict is undecided until the person decides it");
  assert.equal(byClass(itemOf(detail, NEW.name), "conflict-decision").length, 0, "a candidate that is no conflict offers no decision");
  const save = buttonsOf(changeOf(detail), "Save")[0];
  assert.ok(save, "Save is shown");
  assert.equal(save.disabled, true, "Save is not offered while a conflict is undecided");
  await trusted(save);
  await flush();
  assert.deepEqual(queueFiles(w), [], "nothing is written while a conflict is undecided");
});

// TST-1256003 · level: unit · module: MOD-maintenance-pages
// guards: A CONFLICT IS DECIDED BY A PERSON; UC-012
// given: known positive first (TST-1256002's world, Save disabled while the conflict is undecided); the issue 7 labelled change; the participant answers a new candidate and a conflict with FIRST RULE
// input: the route issue 7; a participant and a name; Run by a person; the conflict decided as new; Save by a person
// expect: once the conflict is decided Save is enabled; after Save a queue naming the issue is written, and its proposal holds the new candidate and the conflict as the person decided it, a new requirement THE EXPORT MAY DROP PAGES with its rule. Counter-proof: before the change the conflict cannot be decided and is not written
test("issue — Save writes a conflict as the person decided it", async () => {
  const w = start([NEW, CONFLICT]);
  const detail = await drafted(w);
  const save = buttonsOf(changeOf(detail), "Save")[0];
  assert.equal(save?.disabled, true, "known positive: Save waits while the conflict is undecided");
  const decision = one(itemOf(detail, CONFLICT.name), "conflict-decision");
  assert.ok(decision, "the conflict offers a decision");
  decision.value = "new";
  decision.dispatchEvent(new Event("change"));
  await flush();
  assert.equal(save.disabled, false, "Save is offered once every conflict is decided");
  await trusted(save);
  await waitFor(() => byClass(changeOf(detail), "change-saved").length > 0 || byClass(changeOf(detail), "issue-problem").length > 0);
  assert.equal(byClass(changeOf(detail), "issue-problem").length, 0, textOf(changeOf(detail)));
  const files = queueFiles(w);
  assert.ok(files.find((entry) => entry.path.endsWith(".begruendung.md"))?.content.includes("**Issue:** #7 of https://github.com/alice/product"), "the entry's rationale names the issue");
  const proposal = files.find((entry) => !entry.path.endsWith("/index.md") && !entry.path.endsWith(".begruendung.md") && !entry.path.endsWith("/entscheidungen.md"));
  assert.ok(proposal, `a proposal is written: ${files.map((entry) => entry.path)}`);
  assert.ok(proposal.content.includes(`**${NEW.name}**`), proposal.content);
  assert.ok(proposal.content.includes(`**${CONFLICT.name}**`) && proposal.content.includes(CONFLICT.rule), "the conflict is written as the person decided it");
});
