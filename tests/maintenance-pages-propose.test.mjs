// The route `mail` proposes issues through a participant at an allowed place (ITM-964) — MOD-maintenance-pages, UC-038 steps 4 to 6 and the alternative flows 4a, 4c, 5a, 5b, 6b and 6c, as the accepted text of
// docs/architecture/MOD-maintenance-pages.md states it (blob f21551157732): "`mail` — *Read mailbox*; the mails no issue lists and nobody marked *not an issue*, with sender, subject and date in this browser only; the participant for the proposals
// among those at places the mailbox allows, a place outside the EU named as not compliant, and the three checkers; the run panel and *Propose*; per mail, the mail in full beside the proposal, its text editable, every hit of the mail's people marked;
// *Create issue* — only without a hit —, *Add to #n*, *Not an issue*." (MOD-maintenance-pages.md, Interfaces, `mail`).
// Run: node --test tests/maintenance-pages-propose.test.mjs
//
// Module: MOD-maintenance-pages
// Guards: THE PLACES A MAILBOX'S MAIL MAY GO ARE CONFIGURED; A PLACE OUTSIDE THE EU IS NAMED AS NOT COMPLIANT
// Guards: THE PAGE NAMES WHERE IT SENDS; REPORT DATA LEAVES THE MAILBOX ONLY REWRITTEN WITHOUT PERSONS
// Guards: A REWRITTEN TEXT IS CHECKED BY THREE LLMS; A TEXT FROM A MAIL IS SEARCHED FOR THAT MAIL'S PEOPLE
// Guards: PSEUDONYMISATION IS ON UNLESS A PRODUCT SWITCHES IT OFF; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK; ONE CLICK PER DECISION
// Guards: UC-038
// Level: component
//
// The world is tests/maintenance-pages-world.mjs: the harness's browser and fake GitHub, the Bridge's mail operation `read` (the mails given) and its asks (an agent's answer), GitHub's issues of alice/product, the instance's participants, the model
// endpoints ep1 and ep2 (their answers given by the test). The real MOD-job-runner, MOD-runtimes, MOD-mail-handling, MOD-personal-data and MOD-participant-list run as they are. Readings the texts leave open, which the tests state (the pull request names them):
//   - After Read mailbox the page shows <section class="mail-step-propose"> above the list. Its participants are <li class="mail-participant" data-participant="<name>"> with <input class="participant"> (a radio), <span class="place"> and, for a place the
//     mailbox allows and records as outside the EU, <span class="not-compliant">. Only participants that draft text and whose place the mailbox allows are listed; with none, <p class="mail-no-participant"> names the allowed places and holds
//     <a class="places-link" href="#mailbox"> to the mailbox's processing places, and nothing is sent (UC-038 4c).
//   - <input class="person"> is the name of the person who presses Propose, as on the page replies. Once a participant is chosen and the name is entered, <ul class="mail-checkers"> lists the three checkers as <li class="mail-checker"> with their <span class="place">
//     and the sentence that each receives only the rewritten texts; with fewer than three, <p class="mail-missing-checkers"> gives the sentence checkersFor gives and links <a class="participants-link" href="#participants"> and the places link, no run panel
//     is drawn and nothing is sent (UC-038 6c). Otherwise <div class="mail-stage"> holds MOD-site-frame's run panel of the kind propose-issues, whose Run is *Propose* — one click for all listed mails —, as the page replies has it (ITM-966).
//   - The run is the person's click (isTrusted) and runs in this tab. Each mail with attachments has, per attachment with a text, <input class="attachment-tick" data-attachment="<name>"> (a checkbox, not ticked): the attachment's text is a part of the job only
//     when it is ticked (UC-038 5a). The proposal of a mail fills its product, kind, title and text and lists its possible duplicates in <ul class="mail-duplicates">; a kind `no issue` says so in <p class="mail-no-issue">; a product the proposal does not
//     name among the managed ones is said in <p class="mail-no-product"> and Create issue stays disabled until the person picks one (UC-038 5b). A hit of the mail's people in the proposal is marked as in the page without a proposal.
//   - Per attachment with a text, <button class="add-report-data" data-attachment="<name>"> adds it to the issue (UC-038 5a, 6): with pseudonymisation on, a run panel of the kind rewrite-without-persons with the chosen participant and the three checkers appears in
//     <div class="mail-report-stage">; its Run rewrites, the checkers' findings go back, and the corrected rewrite is added to the text of the issue, the attachment's own text never; with it off (docs/settings.md of the product), <div class="mail-report">
//     holds <p class="pseudonymisation-off"> and then <pre class="mail-report-data"> with the data unchanged, and the text of the issue gets it (UC-038 6b).
// The counter-proofs are recorded in the pull request.

import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { PRODUCT_URL, buttonsOf, byClass, flush, itemOf, mailOf, one, opened, restoreWorld, textOf, trusted, waitFor, walk, world, issueRecord } from "./maintenance-pages-world.mjs";

afterEach(restoreWorld);

const row = (name, model, place, route = "endpoint ep1", type = "model endpoint") => `| ${name} | ${type} | ${model} | 200000 | — | draft text | ${place} | ${route} |`;
const LOCAL = row("local-llm", "model-a", "this machine");
const CHECKS = [row("check-1", "model-b", "this machine"), row("check-2", "model-c", "this machine"), row("check-3", "model-d", "this machine")];
const CLOUD = row("cloud-llm", "model-e", "a provider in the USA", "endpoint ep2");
const AGENT = row("cli-agent", "model-f", "this machine", "bridge lab-pc-4 agent claude", "CLI agent");
const ROWS = [LOCAL, ...CHECKS, CLOUD];
const USA = [{ place: "this machine", outsideEu: false }, { place: "a provider in the USA", outsideEu: true }];

const LOG = "LOGLINE one: export fails with E42 in /home/erika/thesis";
const PROPOSE = "You turn mails into proposals";
const REWRITE = "You rewrite report data";
const CHECK = "You check a text";
const promptOf = (request) => JSON.stringify(request.body);
const requestsOf = (w, marker) => w.kept.endpoint.filter((request) => promptOf(request).includes(marker));

/** The proposals a participant returns for the mails (by identifier): the first mail a defect of the product with a neutral text, the second one naming the reporter's address. */
const proposals = (request, { one: one_, two }) => ({ draft: { proposals: [
  { mail: one_.id, product: PRODUCT_URL, kind: "defect", title: "Export fails with E42", text: "The export of a document fails with error E42 in version 1.4.", duplicates: [{ issue: 3, reason: "the same error" }] },
  { mail: two.id, product: PRODUCT_URL, kind: "change", title: "Add a dark theme", text: "The reporter erika@example.invalid asks for a dark theme.", duplicates: [] },
] }, answers: [] });

async function setup({ rows = ROWS, places, answer, product, withAttachments = true, only = null } = {}) {
  const one_ = await mailOf("one", { subject: "Export fails", text: "The export fails with error E42.", attachments: withAttachments ? [{ name: "log.txt", type: "text/plain", size: 60, text: LOG }, { name: "shot.png", type: "image/png", size: 9, text: null }] : [] });
  const two = await mailOf("two", { subject: "Dark theme", text: "Please add a dark theme." });
  const w = world({ mails: [one_, two], reading: only ? [one_, two].filter((mail) => only.includes(mail.id)) : [one_, two], issues: [issueRecord(3, "open", [])], rows, places, answer: (request) => (answer ?? proposals)(request, { one: one_, two }), product });
  const target = await opened(w, {}, "mail");
  await trusted(one(target, "read-mailbox"));
  await waitFor(() => byClass(target, "mail-decided").length > 0 || byClass(target, "mailbox-problem").length > 0);
  return { w, target, one: one_, two, item: (mail) => itemOf(target, mail.id) };
}
const participants = (target) => walk(target, (node) => node.getAttribute?.("data-participant")).map((node) => node.getAttribute("data-participant"));
const choose = async (target, name, person = "Anna Author") => {
  const input = one(target, "person");
  input.value = person;
  input.dispatchEvent(new Event("change"));
  const radio = one(walk(target, (node) => node.getAttribute?.("data-participant") === name)[0], "participant");
  radio.checked = true;
  radio.dispatchEvent(new Event("change"));
  await waitFor(() => byClass(target, "run-panel").length > 0 || byClass(target, "mail-missing-checkers").length > 0);
};
const propose = async (target) => {
  await trusted(buttonsOf(one(target, "mail-stage"), "Run")[0]);
  await waitFor(() => byClass(target, "mail-title").some((node) => node.value !== "" && node.value !== undefined));
};
const nothingSent = (w) => [w.kept.endpoint.length, w.kept.ask.length, w.kept.github.filter((request) => request.method !== "GET").length];

// TST-964001 · level: component · module: MOD-maintenance-pages
// guards: THE PLACES A MAILBOX'S MAIL MAY GO ARE CONFIGURED; A PLACE OUTSIDE THE EU IS NAMED AS NOT COMPLIANT; UC-038
// given: a register of five participants that draft text, four at this machine and one in the USA; a mailbox that allows this machine; then one that allows the USA too, recorded as outside the EU
// input: the mail route drawn and the mailbox read
// expect: the first page offers the four at this machine and not the one in the USA; the second offers all five, and marks the one in the USA as not compliant and no other
test("Only participants at a place the mailbox allows are offered, and a place outside the EU is named as not compliant", async () => {
  const f = await setup();
  assert.deepEqual(participants(f.target), ["local-llm", "check-1", "check-2", "check-3"]);
  assert.equal(byClass(f.target, "not-compliant").length, 0);
  restoreWorld();
  const g = await setup({ places: USA });
  assert.deepEqual(participants(g.target), ["local-llm", "check-1", "check-2", "check-3", "cloud-llm"]);
  const marked = walk(g.target, (node) => node.getAttribute?.("data-participant")).filter((node) => byClass(node, "not-compliant").length > 0).map((node) => node.getAttribute("data-participant"));
  assert.deepEqual(marked, ["cloud-llm"]);
  assert.match(textOf(byClass(g.target, "not-compliant")[0]), /GDPR/);
});

// TST-964002 · level: component · module: MOD-maintenance-pages
// guards: THE PAGE NAMES WHERE IT SENDS; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK; UC-038
// given: two mails listed; the participant local-llm chosen and the name entered
// input: nothing more
// expect: the run panel names local-llm, where it processes data (this machine) and the parts it receives — each listed mail by its identifier, the products and their open issues —; the three checkers are listed with their places and the sentence that each receives only the rewritten texts; Run is offered once; nothing was sent to any endpoint and nothing was written
test("The run panel names the participant's place, what it receives, and the three checkers' places", async () => {
  const f = await setup();
  await choose(f.target, "local-llm");
  const panel = textOf(one(f.target, "run-panel"));
  assert.match(panel, /local-llm/);
  assert.match(panel, /this machine/);
  assert.ok(panel.includes(`mail ${f.one.id}`) && panel.includes(`mail ${f.two.id}`), "each listed mail is a part");
  assert.ok(panel.includes("products") && panel.includes("open issues"));
  assert.equal(byClass(f.target, "mail-checker").length, 3);
  for (const [at, checker] of byClass(f.target, "mail-checker").entries()) {
    assert.match(textOf(checker), new RegExp(`check-${at + 1}`));
    assert.match(textOf(checker), /this machine/);
    assert.match(textOf(checker), /only the rewritten texts/);
  }
  assert.equal(buttonsOf(one(f.target, "mail-stage"), "Run").length, 1);
  assert.deepEqual(nothingSent(f.w), [0, 0, 0], "nothing is sent before the click");
});

// TST-964003 · level: component · module: MOD-maintenance-pages
// guards: A MAIL BECOMES AN ISSUE ONLY BY A PERSON'S CLICK; A GENERATED ARTIFACT IS A PROPOSAL; ONE CLICK PER DECISION; UC-038
// given: two listed mails; local-llm chosen; its answer: a proposal for each, the first a defect with one possible duplicate
// input: a click a script makes on Run; then the person's click on Run
// expect: the script's click sends nothing; the person's click sends one request that holds both mails; each proposal is shown in its mail's review — product, kind, title, text — and the duplicate #3 with its reason beside the first; nothing was created in any tracker: Create issue is still the person's click
test("One Propose sends all listed mails in one job, and each proposal is shown beside its mail", async () => {
  const f = await setup();
  await choose(f.target, "local-llm");
  const run = buttonsOf(one(f.target, "mail-stage"), "Run")[0];
  run.dispatchEvent(new Event("click"));
  await flush();
  assert.equal(requestsOf(f.w, PROPOSE).length, 0, "a click a script makes does nothing");
  await propose(f.target);
  const sent = requestsOf(f.w, PROPOSE);
  assert.equal(sent.length, 1, "one job for all listed mails");
  assert.ok(promptOf(sent[0]).includes(f.one.id) && promptOf(sent[0]).includes(f.two.id));
  const first = f.item(f.one), second = f.item(f.two);
  assert.equal(one(first, "mail-title").value, "Export fails with E42");
  assert.match(one(first, "mail-body").value, /error E42 in version 1\.4/);
  assert.equal(one(first, "mail-kind").value, "defect");
  assert.equal(one(first, "mail-product").value, PRODUCT_URL);
  assert.equal(one(second, "mail-title").value, "Add a dark theme");
  assert.equal(one(second, "mail-kind").value, "change");
  assert.match(textOf(one(first, "mail-duplicates")), /#3.*the same error/);
  assert.equal(byClass(second, "mail-duplicates").length === 0 || byClass(second, "mail-duplicates")[0].children.length === 0, true);
  assert.equal(f.w.kept.github.filter((request) => request.method === "POST" && /\/issues$/.test(request.path)).length, 0, "no issue is created by a proposal");
});

// TST-964004 · level: component · module: MOD-maintenance-pages
// guards: A TEXT FROM A MAIL IS SEARCHED FOR THAT MAIL'S PEOPLE; THE PRODUCT ISSUE CARRIES NO PERSONAL DATA; UC-038
// given: the proposal for the second mail names the reporter's address in its text, the first does not
// input: Propose
// expect: the second mail shows a hit of the address and its Create issue is disabled; the first shows no hit and its Create issue is enabled
test("A proposal whose text names a person of the mail is marked and cannot be created", async () => {
  const f = await setup();
  await choose(f.target, "local-llm");
  await propose(f.target);
  assert.ok(byClass(f.item(f.two), "mail-hit").length > 0);
  assert.equal(one(f.item(f.two), "create-issue").disabled, true);
  assert.equal(byClass(f.item(f.one), "mail-hit").length, 0);
  assert.equal(one(f.item(f.one), "create-issue").disabled, false);
});

// TST-964005 · level: component · module: MOD-maintenance-pages
// guards: MAIL STAYS IN THE MAILBOX; THE PAGE NAMES WHERE IT SENDS; UC-038
// given: the first mail has an attachment log.txt with a text and one without a text
// input: Propose without ticking; then Propose with log.txt ticked (in a fresh page)
// expect: only the attachment with a text has a tick, and it is not ticked; the first job receives no word of the log; the second does, and its run panel names the part
test("An attachment reaches the participant only when ticked", async () => {
  const f = await setup();
  assert.deepEqual(byClass(f.item(f.one), "attachment-tick").map((node) => node.getAttribute("data-attachment")), ["log.txt"]);
  assert.notEqual(one(f.item(f.one), "attachment-tick").checked, true);
  await choose(f.target, "local-llm");
  await propose(f.target);
  assert.ok(!promptOf(requestsOf(f.w, PROPOSE)[0]).includes("LOGLINE"), "an unticked attachment is not sent");
  restoreWorld();
  const g = await setup();
  const tick = one(g.item(g.one), "attachment-tick");
  tick.checked = true;
  tick.dispatchEvent(new Event("change"));
  await choose(g.target, "local-llm");
  assert.match(textOf(one(g.target, "run-panel")), /Attachment 1 of|mail /);
  await propose(g.target);
  assert.ok(promptOf(requestsOf(g.w, PROPOSE)[0]).includes("LOGLINE"), "a ticked attachment is sent");
});

// TST-964006 · level: component · module: MOD-maintenance-pages
// guards: A GENERATED ARTIFACT IS A PROPOSAL; A MAIL BECOMES AN ISSUE ONLY BY A PERSON'S CLICK; UC-038
// given: the proposal for the first mail is of the kind `no issue`; the one for the second names a product that is not managed
// input: Propose; then the person picks the managed product for the second mail
// expect: the first mail says no issue was found; the second says that no matching product was found and its Create issue is disabled although its title and text are filled; after the pick it is enabled
test("A proposal without a managed product asks the person for it", async () => {
  const f = await setup({ answer: (request, { one: first, two }) => ({ draft: { proposals: [
    { mail: first.id, product: PRODUCT_URL, kind: "no issue", title: "", text: "", duplicates: [] },
    { mail: two.id, product: "https://github.com/nobody/else", kind: "change", title: "Add a dark theme", text: "A dark theme is asked for.", duplicates: [] },
  ] }, answers: [] }) });
  await choose(f.target, "local-llm");
  await propose(f.target);
  assert.match(textOf(one(f.item(f.one), "mail-no-issue")), /no issue/i);
  const second = f.item(f.two);
  assert.match(textOf(one(second, "mail-no-product")), /no matching product/i);
  assert.equal(one(second, "create-issue").disabled, true);
  const select = one(second, "mail-product");
  select.value = PRODUCT_URL;
  select.dispatchEvent(new Event("change"));
  await flush();
  assert.equal(one(second, "create-issue").disabled, false);
});

/** A rewrite that names a nickname the people-search cannot know, a checker that finds it, and the corrected rewrite. */
const rewriting = (request, { one: first, two }) => {
  const prompt = promptOf(request);
  if (prompt.includes(CHECK)) {
    const named = prompt.includes("Ricky");
    return { draft: { findings: named ? [{ artifact: "the rewritten text", line: 1, rule: "A PERSON IS NAMED BY ACCOUNT OR WITH CONSENT", what: "names the nickname Ricky", fix: "write the user instead" }] : [] }, answers: [] };
  }
  if (prompt.includes(REWRITE)) {
    return { draft: { text: prompt.includes("write the user instead") ? "LOGLINE one: export fails with E42 in the user's home folder" : "LOGLINE one: Ricky sees export fail with E42 in the user's home folder" }, answers: [] };
  }
  return proposals(request, { one: first, two });
};

// TST-964007 · level: component · module: MOD-maintenance-pages
// guards: REPORT DATA LEAVES THE MAILBOX ONLY REWRITTEN WITHOUT PERSONS; A REWRITTEN TEXT IS CHECKED BY THREE LLMS; UC-038
// given: local-llm chosen; the checkers check-1 to check-3; the first rewrite names Ricky, which one checker finds; the rewrite that follows the finding does not
// input: the person's click on Add to the issue for log.txt of the first mail, then on Run of its panel
// expect: the panel names local-llm and the three checkers; the rewriter is asked twice and the second request carries the finding; each round is read by the three checkers; the text of the issue holds the corrected rewrite and neither Ricky nor the attachment's own text; nothing is created in any tracker
test("With three checkers a finding goes back, and only the corrected rewrite is added to the issue", async () => {
  const f = await setup({ answer: rewriting });
  await choose(f.target, "local-llm");
  await trusted(one(f.item(f.one), "add-report-data"));
  await waitFor(() => byClass(f.item(f.one), "run-panel").length > 0);
  const panel = textOf(one(f.item(f.one), "run-panel"));
  for (const name of ["local-llm", "check-1", "check-2", "check-3"]) assert.ok(panel.includes(name), name);
  assert.deepEqual(nothingSent(f.w).slice(0, 2), [0, 0], "nothing is sent before Run");
  await trusted(buttonsOf(one(f.item(f.one), "mail-report-stage"), "Run")[0]);
  await waitFor(() => /home folder/.test(String(one(f.item(f.one), "mail-body").value)));
  const asked = requestsOf(f.w, REWRITE);
  assert.equal(asked.length, 2, "the rewriter is asked again after the finding");
  assert.ok(promptOf(asked[1]).includes("names the nickname Ricky"), "the finding goes back to the rewriter");
  assert.equal(requestsOf(f.w, CHECK).length, 6, "three checkers read each round");
  const text = String(one(f.item(f.one), "mail-body").value);
  assert.ok(text.includes("in the user's home folder") && !text.includes("Ricky") && !text.includes("/home/erika"), text);
  assert.equal(f.w.kept.github.filter((request) => request.method === "POST" && /\/issues$/.test(request.path)).length, 0);
});

// TST-964008 · level: component · module: MOD-maintenance-pages
// guards: A REWRITTEN TEXT IS CHECKED BY THREE LLMS; THE PAGE NAMES WHERE IT SENDS; UC-038
// given: a register in which only one participant besides local-llm drafts text at this machine
// input: local-llm chosen; the person's click on Add to the issue
// expect: the page names that three checking participants are needed and how many were found, and links the participants and the mailbox's places; no run panel is drawn for Propose or for the report data; nothing is sent
test("With fewer than three checkers the missing ones are named and nothing is sent", async () => {
  const f = await setup({ rows: [LOCAL, CHECKS[0]] });
  await choose(f.target, "local-llm");
  const missing = one(f.target, "mail-missing-checkers");
  assert.match(textOf(missing), /Three checking participants are needed.*only 1 found/);
  assert.equal(byClass(missing, "participants-link")[0].getAttribute("href"), "#participants");
  assert.equal(byClass(missing, "places-link")[0].getAttribute("href"), "#mailbox");
  assert.equal(byClass(f.target, "run-panel").length, 0);
  await trusted(one(f.item(f.one), "add-report-data"));
  assert.equal(byClass(f.target, "run-panel").length, 0);
  assert.deepEqual(nothingSent(f.w), [0, 0, 0]);
});

// TST-964009 · level: component · module: MOD-maintenance-pages
// guards: PSEUDONYMISATION IS ON UNLESS A PRODUCT SWITCHES IT OFF; UC-038
// given: the product's docs/settings.md switches pseudonymisation off
// input: local-llm chosen; the person's click on Add to the issue for log.txt
// expect: no rewriting job is offered or run; the report data stands unchanged in the text of the issue and in <pre class="mail-report-data">, with the notice that pseudonymisation is off above it; the notice is not shown where it is on
test("With pseudonymisation off the report data is shown unchanged with the notice above it", async () => {
  const f = await setup({ product: { "docs/settings.md": "---\npseudonymisation: off\n---\n\n# Settings\n" } });
  await choose(f.target, "local-llm");
  await trusted(one(f.item(f.one), "add-report-data"));
  await waitFor(() => byClass(f.item(f.one), "mail-report-data").length > 0);
  const report = one(f.item(f.one), "mail-report");
  const order = report.children.map((node) => node.className);
  assert.ok(order.indexOf("pseudonymisation-off") >= 0 && order.indexOf("pseudonymisation-off") < order.indexOf("mail-report-data"), order.join(","));
  assert.match(textOf(one(report, "pseudonymisation-off")), /off/);
  assert.equal(textOf(one(report, "mail-report-data")).includes("LOGLINE one"), true);
  assert.ok(String(one(f.item(f.one), "mail-body").value).includes(LOG));
  assert.equal(byClass(f.item(f.one), "run-panel").length, 0);
  assert.equal(requestsOf(f.w, REWRITE).length, 0);
  restoreWorld();
  const g = await setup();
  await choose(g.target, "local-llm");
  await trusted(one(g.item(g.one), "add-report-data"));
  assert.equal(byClass(g.target, "pseudonymisation-off").length, 0);
});

// TST-964010 · level: component · module: MOD-maintenance-pages
// guards: THE PLACES A MAILBOX'S MAIL MAY GO ARE CONFIGURED; THE PAGE NAMES WHERE IT SENDS; UC-038
// given: a register whose participants all process data at places the mailbox does not allow
// input: the mailbox read
// expect: the page says that no participant works at a place the mailbox allows and links the mailbox's places; no participant is offered; nothing is sent; the mails can still be decided by hand (Create issue is there)
test("With no participant at an allowed place nothing is sent and the mailbox's places are linked", async () => {
  const f = await setup({ rows: [CLOUD, row("far-llm", "model-g", "another provider in the USA", "endpoint ep2")] });
  assert.deepEqual(participants(f.target), []);
  const none = one(f.target, "mail-no-participant");
  assert.match(textOf(none), /this machine/);
  assert.equal(byClass(none, "places-link")[0].getAttribute("href"), "#mailbox");
  assert.equal(byClass(f.target, "run-panel").length, 0);
  assert.equal(byClass(f.item(f.one), "create-issue").length, 1);
  assert.deepEqual(nothingSent(f.w), [0, 0, 0]);
});

// TST-964011 · level: component · module: MOD-maintenance-pages
// guards: THE PAGE NAMES WHERE IT SENDS; THE PLACES A MAILBOX'S MAIL MAY GO ARE CONFIGURED; UC-038
// given: the participant is a CLI agent that the Bridge lab-pc-4 runs, at this machine
// input: the agent chosen; Propose
// expect: the run panel names the agent and this machine; the Bridge receives one ask for the agent claude holding both mails; no model endpoint is called for the proposals; the proposals are shown
test("A CLI agent receives the job through the Bridge it names", async () => {
  const f = await setup({ rows: [AGENT, ...CHECKS] });
  await choose(f.target, "cli-agent");
  assert.match(textOf(one(f.target, "run-panel")), /cli-agent.*this machine/);
  await propose(f.target);
  assert.equal(f.w.kept.ask.length, 1);
  assert.equal(f.w.kept.ask[0].body.agent, "claude");
  assert.ok(JSON.stringify(f.w.kept.ask[0].body).includes(f.one.id) && JSON.stringify(f.w.kept.ask[0].body).includes(f.two.id));
  assert.equal(requestsOf(f.w, PROPOSE).length, 0);
  assert.equal(one(f.item(f.one), "mail-title").value, "Export fails with E42");
});
