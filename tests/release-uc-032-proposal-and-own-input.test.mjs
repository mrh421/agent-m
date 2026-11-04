// Release tests of UC-032 Maintain the backlog — what a participant drafts and what the person enters: that a generated item is a proposal until the person accepts it (A GENERATED ARTIFACT IS A PROPOSAL), that the person's
// own input is committed directly under their account (A PERSON'S OWN INPUT IS COMMITTED DIRECTLY), that the page names every destination before it sends (THE PAGE NAMES WHERE IT SENDS) and that each decision takes one click
// (ONE CLICK PER DECISION). The cases walk the Product Owner's path across the dashboard's routes `backlog` and `progress` over the real MOD-repository-hosts host behind a fake of GitHub's API that notes every request that
// writes, with the authorisation it carries, and read what the repository holds afterwards; they never read the code files.
// Run: node --test tests/release-uc-032-proposal-and-own-input.test.mjs
//
// Module: MOD-implementation-pages
// Module: MOD-work-plans
// Guards: UC-032; A GENERATED ARTIFACT IS A PROPOSAL; A PERSON'S OWN INPUT IS COMMITTED DIRECTLY; THE PAGE NAMES WHERE IT SENDS; ONE CLICK PER DECISION
// Level: release
//
// Written for the release testing of sprint 129 by developer-sonnet-l, who implemented none of ITM-681, ITM-782, ITM-783, ITM-784 or ITM-1316 (RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER). A person's click is the page's own
// listener called with a trusted event; a script's click one whose isTrusted is false; no input event of the operating system is made. Readings the texts leave open, which the cases state:
//   - "committed to the default branch under their own account" is read as: the page's writes are the git-data requests of one commit that moves the ref refs/heads/main, each carrying the token stored for the product, and
//     no pull request is opened.
//   - "names every destination before it sends" is read as the run panel, drawn before Run, naming the participant, its model and the place it processes data at.
//   - "one click" is read as: one trusted click on the decision's button makes exactly one commit (a sprint's own branch is created besides, as UC-032 step 6 says).

import test from "node:test";
import assert from "node:assert/strict";
import { TOKEN } from "./app-harness.mjs";
import { COMPLETE_ITEM, STORE, backlogWrites, buttons, choose, classed, clickOn, drafted, endpoints, entry, fillItem, found, itemForm, itemPath, open, planOf, product, specOf, sprintPath, textOf, tickOf, typeValue, waitFor, writerOf } from "./uc-032-harness.mjs";

const refMoves = (log) => log.filter((request) => request.method === "PATCH" && request.path.endsWith("/git/refs/heads/main"));
const opensPullRequest = (log) => log.some((request) => request.method === "POST" && /\/pulls$/.test(request.path));

// TST-803106 · level: release · module: MOD-implementation-pages
// guards: UC-032; A GENERATED ARTIFACT IS A PROPOSAL
// given: the product of tests/uc-032-harness.mjs; ep1 answers two drafts, one sound and one that realises nothing
// input: the Product Owner chooses Propose items and Run; reads the drafts; a script presses Add to backlog; the faulty draft is discarded and the person presses Add to backlog
// expect: after Run no file of docs/backlog/ is written — the job's record under docs/jobs/ is the only file committed — and the drafts are shown with their findings; Add to backlog is disabled while the faulty draft is kept; a script's click on it writes nothing; once the faulty draft is discarded and the person presses it, one commit adds the sound draft's file alone, and the faulty draft is in no file of the backlog
test("TST-803106: UC-032 a drafted item is a proposal: nothing of it is written to the backlog before the person's click, and a faulty one never", async () => {
  const { page } = await drafted(await product(), { items: [entry("A sound proposal"), entry("A faulty proposal", { realises: [] })] });
  try {
    assert.deepEqual(backlogWrites(page), [], "nothing is written to docs/backlog/ by Run");
    assert.ok(page.srv.writes.every((write) => Object.keys(write.files).every((path) => path.startsWith("docs/jobs/"))), "only the job's record is committed");
    const boxes = found(page.target, "[data-draft]");
    assert.equal(boxes.length, 2);
    assert.match(classed(boxes[1], "error").map(textOf).join(" "), /realises nothing/);
    const add = () => buttons(page.target, "Add to backlog")[0];
    assert.equal(add().disabled, true, "a draft kept has an error");
    await page.script(add());
    assert.deepEqual(backlogWrites(page), [], "a script's click writes nothing");
    const tick = found(boxes[1], "[data-draft-discard]")[0];
    tick.checked = true;
    tick.dispatchEvent(new Event("change"));
    await waitFor(() => add().disabled === false);
    await page.script(add());
    assert.deepEqual(backlogWrites(page), [], "and neither does it once the draft is sound");
    await page.press(add());
    await waitFor(() => classed(page.target, "drafts-added").length > 0);
    assert.equal(backlogWrites(page).length, 1, "one commit");
    assert.deepEqual(Object.keys(backlogWrites(page)[0].files), ["docs/backlog/ITM-011-a-sound-proposal.md"]);
    assert.ok(!Object.entries(page.srv.files).some(([path, text]) => path.startsWith("docs/backlog/") && text.includes("A faulty proposal")), "the faulty draft is in no file of the backlog");
  } finally { page.done(); }
});

// TST-803107 · level: release · module: MOD-implementation-pages
// guards: UC-032; A PERSON'S OWN INPUT IS COMMITTED DIRECTLY
// given: the product of tests/uc-032-harness.mjs and a second whose SPEC no longer holds RULE ONE (ITM-001 realises it and is done); the person's token stored for the product
// input: the Product Owner writes an item with + Item; plans team2's sprint and presses Start sprint; presses End sprint for team1; presses Point at beside ITM-001, and Remove beside it in a second reading of the second product
// expect: for each decision the requests that write move the ref refs/heads/main once, each with the product's token, and open no pull request; the files committed are the item's file under docs/backlog/, the sprint's record under docs/backlog/sprints/, team1's record, ITM-001's file — and none under docs/jobs/, since a person's own input is no job
test("TST-803107: UC-032 what the person enters — an item, a sprint, its end, a pointer at a requirement — is committed directly to the default branch with their token", async () => {
  const decide = async (route, files, act) => {
    const log = [];
    const page = await open(route, {}, { files, server: [writerOf(log)] });
    try { await act(page); } finally { page.done(); }
    return { log, writes: page.srv.writes };
  };
  const check = ({ log, writes }, paths, what) => {
    assert.equal(refMoves(log).length, 1, `${what}: the ref refs/heads/main is moved once`);
    assert.ok(log.length > 0 && log.every((request) => (request.authorization ?? "").includes(TOKEN)), `${what}: every request that writes carries the product's token: ${JSON.stringify(log)}`);
    assert.equal(opensPullRequest(log), false, `${what}: no pull request`);
    assert.deepEqual(writes.flatMap((write) => Object.keys(write.files)), paths, `${what}: the files committed`);
  };
  check(await decide("backlog", await product(), async (page) => {
    const form = await itemForm(page);
    await fillItem(form, COMPLETE_ITEM);
    await clickOn(form.add());
    await waitFor(() => classed(page.target, "item-added").length > 0);
  }), ["docs/backlog/ITM-011-show-the-second-rule-by-hand.md"], "+ Item");
  check(await decide("backlog", await product(), async (page) => {
    await planOf(page, "team2");
    typeValue(page, "[data-sprint-goal]", "Mail");
    typeValue(page, "[data-sprint-closer]", "bob");
    tickOf(page, "ITM-003").checked = true;
    await page.press(found(page.target, "[data-start-sprint]")[0]);
  }), ["docs/backlog/sprints/team2/01.md"], "Start sprint");
  check(await decide("progress", await product(), async (page) => { await page.press(found(page.target, "[data-end-sprint]")[0]); }), [sprintPath("team1", 2)], "End sprint");
  const renamed = () => product({ files: { "SPEC.md": specOf("RULE ONE TOO", "RULE TWO", "RULE THREE", "RULE FOUR") } });
  check(await decide("backlog", await renamed(), async (page) => {
    found(page.target, '[data-point-to="ITM-001"]')[0].value = "RULE ONE TOO";
    await page.press(found(page.target, '[data-point-at="ITM-001"]')[0]);
  }), [itemPath(1)], "Point at");
  check(await decide("backlog", await renamed(), async (page) => { await page.press(found(page.target, '[data-remove-item="ITM-001"]')[0]); }), [itemPath(1)], "Remove");
});

// TST-803108 · level: release · module: MOD-implementation-pages
// guards: UC-032; THE PAGE NAMES WHERE IT SENDS
// given: the product of tests/uc-032-harness.mjs and the instance's register with the drafting participants local-llm (model-a, this machine, ep1) and cloud-llm (model-b, a provider in the USA, ep2)
// input: the Product Owner chooses Propose items; reads the panel; chooses cloud-llm; reads it again; presses Run
// expect: before Run no endpoint is asked; the panel names local-llm with model-a and this machine, and, once chosen, cloud-llm with model-b and a provider in the USA and no longer local-llm; both panels name the requirements, the use cases, the architecture and the existing items they send; Run asks ep2 alone and ep1 receives nothing; what ep2 receives holds the requirement RULE TWO, the use case UC-001 and the title of an existing item
test("TST-803108: UC-032 the run panel names the participant, its model and the place it processes data at before anything is sent, and Run sends to the one named", async () => {
  const asked = [];
  const fresh = await open("backlog", {}, { files: await product(), server: [endpoints({ items: [entry("Show RULE TWO")] }, asked)], store: STORE });
  try {
    await fresh.press(found(fresh.target, "[data-propose-items]")[0]);
    await waitFor(() => classed(fresh.target, "run-panel").length > 0);
    const sends = ["RULE TWO", "UC-001", "MOD-store", "existing items"];
    const first = textOf(classed(fresh.target, "run-panel")[0]);
    for (const named of ["local-llm", "model-a", "this machine", ...sends]) assert.ok(first.includes(named), `the panel names ${named}: ${first}`);
    assert.equal(asked.length, 0, "nothing is sent before Run");
    await choose(found(fresh.target, "[data-propose-participant]")[0], "cloud-llm");
    const second = textOf(classed(fresh.target, "run-panel")[0]);
    for (const named of ["cloud-llm", "model-b", "a provider in the USA", ...sends]) assert.ok(second.includes(named), `the panel names ${named}: ${second}`);
    assert.doesNotMatch(second, /local-llm/);
    assert.equal(asked.length, 0, "and still nothing is sent");
    await fresh.press(buttons(classed(fresh.target, "run-panel")[0], "Run")[0]);
    await waitFor(() => found(fresh.target, "[data-draft]").length > 0);
    assert.deepEqual([...new Set(asked.map((request) => request.origin))], ["https://ep2.example.test"], "ep2 alone is asked");
    const received = JSON.stringify(asked[0].body);
    for (const named of ["RULE TWO", "UC-001", "The work of item 1"]) assert.ok(received.includes(named), `what ep2 receives holds ${named}`);
  } finally { fresh.done(); }
});

// TST-803109 · level: release · module: MOD-implementation-pages
// guards: UC-032; ONE CLICK PER DECISION
// given: the product of tests/uc-032-harness.mjs; ep1 answers two sound drafts; team2's plan is open with ITM-003 and ITM-004 selected, the goal and the closer typed
// input: the Product Owner presses Add to backlog; presses Start sprint; presses End sprint for team1
// expect: Add to backlog, once its inputs are complete, is one click and one commit of both drafts; Start sprint is one click, one commit of the sprint's record and the creation of its branch; End sprint is one click and one commit; nothing is asked of the person between the click and the commit
test("TST-803109: UC-032 each decision — add the drafts, start a sprint, end it — takes one click once its inputs are complete", async () => {
  const { page } = await drafted(await product(), { items: [entry("One draft"), entry("Another draft", { modules: ["MOD-pages"] })] });
  try {
    const before = backlogWrites(page).length;
    await page.press(buttons(page.target, "Add to backlog")[0]);
    await waitFor(() => classed(page.target, "drafts-added").length > 0);
    assert.equal(backlogWrites(page).length, before + 1, "Add to backlog: one commit");
    assert.equal(Object.keys(backlogWrites(page).at(-1).files).length, 2, "of both drafts");
  } finally { page.done(); }
  const sprint = await open("backlog", {}, { files: await product() });
  try {
    await planOf(sprint, "team2");
    typeValue(sprint, "[data-sprint-goal]", "Mail");
    typeValue(sprint, "[data-sprint-closer]", "bob");
    tickOf(sprint, "ITM-003").checked = true;
    tickOf(sprint, "ITM-004").checked = true;
    const writes = sprint.srv.writes.length;
    await sprint.press(found(sprint.target, "[data-start-sprint]")[0]);
    assert.equal(sprint.srv.writes.length, writes + 1, "Start sprint: one commit");
    assert.deepEqual(sprint.created.map((made) => made.ref), ["refs/heads/sprint/team2/01"], "and the sprint's own branch");
  } finally { sprint.done(); }
  const ending = await open("progress", {}, { files: await product() });
  try {
    const writes = ending.srv.writes.length;
    await ending.press(found(ending.target, "[data-end-sprint]")[0]);
    assert.equal(ending.srv.writes.length, writes + 1, "End sprint: one click, one commit");
  } finally { ending.done(); }
});
