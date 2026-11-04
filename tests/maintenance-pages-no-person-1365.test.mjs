// The run panels of the issue page offer no person of the register (ITM-1365) — MOD-maintenance-pages' route `issue/<number>`, as UC-012 names its actor: "Participant — the model endpoint or agent the author hands the work to",
// and as MOD-participant-list's `eligible` tells its caller (docs/architecture/MOD-participant-list.md): "a person holds roles and decides, but is no driver of a job, so a caller choosing who receives a job asks among the other four types".
// Run: node --test tests/maintenance-pages-no-person-1365.test.mjs
//
// Module: MOD-maintenance-pages
// Guards: A PROCESS MODEL ORGANISES PEOPLE AND AGENTS; A ROLE NAMES THE CAPABILITIES IT NEEDS; UC-012
// Level: unit
//
// The world is tests/maintenance-pages-world.mjs: its model endpoint ep1 is the participant local-llm and its fake GitHub holds the issues of alice/product. To its register these tests add the CI agent ci-bot and the person
// alice, who declares every capability a kind of this page needs (draft text, write to the repository, run code and tests). The page is the real one.

import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { PRODUCT_URL, draw } from "./main-page-home-harness.mjs";
import { connect, parseAddress } from "../src/repository-hosts/index.mjs";
import { byClass, restoreWorld, textOf, waitFor, world, routeNamed, one } from "./maintenance-pages-world.mjs";

afterEach(restoreWorld);

const LOCAL = "| local-llm | model endpoint | model-a | 200000 | — | draft text | this machine | endpoint ep1 |";
const CI_AGENT = "| ci-bot | CI agent | fixture-llm | 100000 | — | draft text, read the repository, write to the repository, run code and tests | GitHub's hosted runners | ci hosted secret FIXTURE_KEY |";
const ALICE = "| alice | person | — | — | — | draft text, read the repository, write to the repository, run code and tests | — | account github.com/alice |";
const issueRecord = (number, labels) => ({ number, title: `Export loses pages ${number}`, body: "FIRST RULE is broken: the export is cut off after the second page.", state: "open", labels, comments: [] });

/** The world with the product chosen and the issues 6 (a defect) and 7 (a change). */
function start(rows) {
  const w = world({ mails: [], issues: [issueRecord(6, ["defect"]), issueRecord(7, ["change"])], rows });
  w.context.product = { address: PRODUCT_URL, kind: "github", host: connect(parseAddress(PRODUCT_URL), { token: "github_pat_HOME827PRODUCT0123456789abcdefg" }), tokenStored: true };
  return w;
}
const SETTLED = ["issue-participant", "issue-problem", "issue-no-participant", "issue-no-fixer"];
const open = async (w, number, section) => {
  const detail = await draw(routeNamed("issue"), w.context, { number: String(number) });
  const shown = () => byClass(detail, section)[0];
  await waitFor(() => shown() !== undefined && SETTLED.some((name) => byClass(shown(), name).length > 0));
  return shown();
};
const offered = (section, radios) => byClass(section, radios).map((radio) => radio.value);

// TST-1365001 · level: unit · module: MOD-maintenance-pages
// guards: A PROCESS MODEL ORGANISES PEOPLE AND AGENTS; UC-012
// given: known positive first — the register lists local-llm (draft text), ci-bot (CI agent, every capability) and, in the second world, also alice (a person declaring every capability); the open issue 6, labelled defect
// input: the route issue 6, in each world
// expect: without alice the analysis is offered to local-llm and ci-bot and the fix to ci-bot; with alice the same, and alice is offered in neither run panel
test("issue — the analysis and the fix are offered to no person of the register (UC-012 Actors)", async () => {
  for (const [rows, label] of [[[LOCAL, CI_AGENT], "without a person"], [[LOCAL, CI_AGENT, ALICE], "with the person alice"]]) {
    const w = start(rows);
    const analysis = await open(w, 6, "issue-analysis");
    assert.deepEqual(offered(analysis, "participant"), ["local-llm", "ci-bot"], `the analysis, ${label}`);
    const fix = await open(w, 6, "issue-fix");
    assert.deepEqual(offered(fix, "fix-participant"), ["ci-bot"], `the fix, ${label}`);
    restoreWorld();
  }
});

// TST-1365002 · level: unit · module: MOD-maintenance-pages
// guards: A PROCESS MODEL ORGANISES PEOPLE AND AGENTS; UC-012
// given: the register lists local-llm, ci-bot and the person alice, each declaring draft text; the open issue 7, labelled change
// input: the route issue 7
// expect: the change is offered to local-llm and ci-bot, not to alice
test("issue — the change is drafted by no person of the register", async () => {
  const w = start([LOCAL, CI_AGENT, ALICE]);
  const change = await open(w, 7, "issue-change");
  assert.deepEqual(offered(change, "change-participant"), ["local-llm", "ci-bot"]);
});

// TST-1365003 · level: unit · module: MOD-maintenance-pages
// guards: A PROCESS MODEL ORGANISES PEOPLE AND AGENTS; UC-012
// given: known positive first — a register that lists local-llm alone; a register that lists the person alice alone, declaring every capability; the open issue 6, labelled defect
// input: the route issue 6, in each world
// expect: with local-llm the analysis offers it; with alice alone the analysis offers no participant and says that no participant that can draft text is listed, and the fix offers none and says that no participant that can run code and tests is configured
test("issue — where only a person is eligible, the page says that no participant is", async () => {
  const known = await open(start([LOCAL]), 6, "issue-analysis");
  assert.deepEqual(offered(known, "participant"), ["local-llm"], "known positive");
  restoreWorld();
  const w = start([ALICE]);
  const analysis = await open(w, 6, "issue-analysis");
  assert.deepEqual(offered(analysis, "participant"), []);
  assert.match(textOf(one(analysis, "issue-no-participant")), /No participant that can draft text is listed/);
  const fix = await open(w, 6, "issue-fix");
  assert.deepEqual(offered(fix, "fix-participant"), []);
  assert.match(textOf(one(fix, "issue-no-fixer")), /No participant that can run code and tests is configured/);
});
