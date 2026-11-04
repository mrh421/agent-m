// The routes `replies` and `replies/<issue>` of MOD-maintenance-pages, up to the drafts (ITM-966) — UC-039 steps 1 to 4 and 2b, 3a, 4a — as the accepted text of docs/architecture/MOD-maintenance-pages.md states it (:111-117, blob f21551157732):
// "`replies`, `replies/<issue>` — closed issues with mails to answer, answers received, open issues; an issue with what solved it and each listed mail found in the mailbox with its draft; *Draft replies* with its run panel, or a reply
// written without a participant; each draft complete — recipient, subject, body, attachments — and editable". Sending, asking a reporter and reopening are other items' (ITM-967, ITM-968): this page offers no Send.
// Run: node --test tests/maintenance-pages-replies.test.mjs
//
// Module: MOD-maintenance-pages
// Guards: CLOSING AN ISSUE PREPARES ITS REPLIES; THE SEND DASHBOARD LISTS THE DRAFTS OF LISTED MAILS; A REPLY DRAFT IS KEPT IN THE MAILBOX'S DRAFTS FOLDER; THE PAGE NAMES WHERE IT SENDS; THE PLACES A MAILBOX'S MAIL MAY GO ARE CONFIGURED; A PLACE OUTSIDE THE EU IS NAMED AS NOT COMPLIANT; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK; MAIL STAYS IN THE MAILBOX; UC-039
// Level: unit
//
// The browser, the repositories and the clock are those of tests/main-page-home-harness.mjs. The real MOD-mail-routes (the Bridge route), MOD-mail-handling, MOD-mail-records, MOD-participant-list, MOD-job-catalogue, MOD-job-runner, MOD-runtimes,
// MOD-repository-hosts, MOD-bridge-client and MOD-browser-store run as they are; only `fetch` is faked, over the harness's fake GitHub, by this file: the Bridge lab-pc-4 on the loopback answers the mail operations (drafts, sent, find,
// show-draft, store-draft, update-draft), keeping the drafts it is given; GitHub's REST API answers alice/product's issues; the model endpoint ep1 (the "fake runner") answers a chat completion with the texts given. Nothing leaves the process.
// Readings the texts leave open, which the tests state (the pull request names them):
//   - Reading changes nothing without a click: the page draws <button class="read-replies"> "Read replies"; the person's click calls repliesDue (which may note a reply found in Sent) and draws <section class="replies-group" data-group="to-answer"|
//     "answer-received"|"open"> with <li class="reply-issue" data-issue="<n>"> per issue (its number, product and a button <button type="button" class="issue-link btn small"> "Open", which calls the ViewContext's go("replies", { issue, product }); the page writes no address); the route with the parameters { issue, product } draws that issue
//     from the last reading (kept in memory only) or says to read first.
//   - The issue: <p class="reply-solved"> "Solved by: <closedBy|not known> · Release: <release|not known>"; per listed mail <li class="reply-mail" data-mail="<MAIL-id>"> with .reply-reporter, .reply-date, .reply-subject; a mail found with a draft shows
//     <div class="reply-draft"> (the draft as showDraft gives it: .draft-to, .draft-subject, <textarea class="draft-body"> editable, <ul class="draft-attachments"> with name and size) and <button class="save-draft"> "Save draft";
//     a mail with mail: null says <p class="reply-missing"> "not found in the mailbox"; a mail without a usable reply address says <p class="reply-not-sendable"> "not sendable"; a mail with a note says <p class="reply-noted">. Send is ITM-967's and is offered by a draft alone.
//   - Drafting: <section class="reply-drafting"> lists <li class="reply-participant"> with <input type="radio" class="participant"> for the participants of the instance's register that can draft text AND whose processing place the mailbox allows
//     (the connection's `places`), the place named and, for an allowed place outside the EU, <span class="not-compliant">; <input class="person"> for the name; once a participant and a name are chosen, the run panel of MOD-site-frame (the kind
//     draft-replies, the recipe reply-inputs over the issue's mails that have no draft and can be answered) and its Run. A reply written without a participant: <button class="write-reply"> per mail without a draft, which stores an empty draft with the
//     original quoted below it and shows it.
//   - Run is the person's click (isTrusted); the job runs in this tab (the route tab), its start record naming the issue and not a mail; the texts the participant returns are stored as drafts through the mailbox, nothing is sent.
// The counter-proofs are recorded in the pull request.

import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { mailStrategies } from "../src/mail-handling/index.mjs";
import { readFileSync } from "node:fs";
import { BRIDGE, ERIKA, SECRET, PRODUCT_URL, buttonsOf, byClass, flush, itemOf, one, opened, pages, read, restoreNet, restoreWorld, route, standard, start, textOf, trusted, waitFor, walk, issuesIn, world } from "./maintenance-pages-world.mjs";

afterEach(restoreWorld);

// TST-966001 · level: unit · module: MOD-maintenance-pages
// guards: CLOSING AN ISSUE PREPARES ITS REPLIES; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK; UC-039
// given: a closed issue listing four mails none of which has a note, an issue labelled waiting-for-reporter with a newer mail, an open issue, and a closed issue whose one mail has a reply note
// input: the route replies drawn; the person's click on Read replies
// expect: drawing reads and writes nothing; the groups are drawn: to answer holds issue 4 alone (the answered issue 7 is in none), answer received holds 5, open holds 6; each issue has its Open, a <button type="button"> of the class issue-link and no link; GitHub received no write
test("the three groups are drawn, and a closed issue with an unnoted mail is under to answer", async () => {
  const { w, target } = await start();
  assert.deepEqual([w.kept.bridge, w.kept.github], [[], []], "drawing reads nothing");
  await read(target);
  assert.deepEqual([issuesIn(target, "to-answer"), issuesIn(target, "answer-received"), issuesIn(target, "open")], [[4], [5], [6]]);
  const opens = walk(target, (node) => (node.className ?? "").split(" ").includes("issue-link"));
  assert.deepEqual(opens.map((node) => [node.localName, node.getAttribute("type")]), [["button", "button"], ["button", "button"], ["button", "button"]]);
  assert.deepEqual(w.kept.github.filter((request) => request.method !== "GET"), []);
});

// TST-966002 · level: unit · module: MOD-maintenance-pages
// guards: CLOSING AN ISSUE PREPARES ITS REPLIES; THE SEND DASHBOARD LISTS THE DRAFTS OF LISTED MAILS; A REPLY DRAFT IS KEPT IN THE MAILBOX'S DRAFTS FOLDER; UC-039
// given: the closed issue 4 and its four mails: found without a draft, found with a draft, not in the mailbox, found with a sender that is no address
// input: the route replies/<4> drawn after the reading
// expect: the page shows what solved the issue (the pull request) and that the release is not known; each found mail with reporter, date and subject; the drafted mail shows its draft complete (recipient, subject, body in an editable field, the attachment with its name and size); the mail not in the mailbox says "not found in the mailbox"; the mail without an address says "not sendable"; no button Send anywhere
test("the issue shows what solved it and each mail with its draft, a missing mail and a mail that cannot be sent", async () => {
  const { mails, w, target } = await start();
  await read(target);
  const detail = await opened(w, { issue: "4", product: PRODUCT_URL });
  const solved = textOf(one(detail, "reply-solved"));
  assert.ok(solved.includes("pull/9") && /Release: not known/.test(solved), solved);
  const plain = itemOf(detail, mails.plain.id);
  const line = textOf(plain);
  assert.ok(line.includes("Erika Mustermann") && line.includes("2026-10-18") && line.includes("Subject plain"), line);
  assert.equal(byClass(plain, "reply-draft").length, 0, "no draft yet");
  const drafted = itemOf(detail, mails.drafted.id);
  const draft = one(drafted, "reply-draft");
  assert.match(textOf(one(draft, "draft-to")), /erika@example\.invalid/);
  assert.match(textOf(one(draft, "draft-subject")), /Re: Subject drafted/);
  assert.match(String(one(draft, "draft-body").value ?? one(draft, "draft-body").textContent), /fixed the export in version 1\.5/);
  assert.match(textOf(one(draft, "draft-attachments")), /log\.txt.*4/);
  assert.match(textOf(one(itemOf(detail, mails.absent.id), "reply-missing")), /not found in the mailbox/);
  assert.equal(byClass(itemOf(detail, mails.absent.id), "draft-body").length, 0);
  assert.match(textOf(one(itemOf(detail, mails.nowhere.id), "reply-not-sendable")), /not sendable/);
  assert.deepEqual([mails.absent.id, mails.nowhere.id, mails.plain.id].map((id) => buttonsOf(itemOf(detail, id), "Send").length), [0, 0, 0], "no Send for a mail that is missing, not sendable or without a draft (ITM-967 sends the drafted one)");
});

// TST-966003 · level: unit · module: MOD-maintenance-pages
// guards: A REPLY DRAFT IS KEPT IN THE MAILBOX'S DRAFTS FOLDER; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK; UC-039
// given: the drafted mail of issue 4
// input: the text of the draft changed; a click a script makes on Save draft; the person's click on Save draft
// expect: the script's click saves nothing; the person's click calls the mailbox's update-draft once with the reference of the draft and the new body, the recipient and the subject unchanged, and the page shows the draft as stored (the new reference)
test("an edit of a draft is saved to the draft", async () => {
  const { mails, w, target } = await start();
  await read(target);
  const detail = await opened(w, { issue: "4", product: PRODUCT_URL });
  const draft = one(itemOf(detail, mails.drafted.id), "reply-draft");
  const body = one(draft, "draft-body");
  body.value = "Changed text of the reply.";
  body.dispatchEvent(new Event("input"));
  const save = one(draft, "save-draft");
  save.dispatchEvent(new Event("click"));
  await flush();
  assert.deepEqual(w.kept.bridge.filter((call) => call.operation === "update-draft"), []);
  await trusted(save);
  await waitFor(() => w.kept.bridge.some((call) => call.operation === "update-draft"));
  const updates = w.kept.bridge.filter((call) => call.operation === "update-draft");
  assert.equal(updates.length, 1);
  assert.deepEqual(updates[0].args.ref, { route: "bridge", uid: 1, uidValidity: 7 });
  assert.equal(updates[0].args.draft.body, "Changed text of the reply.");
  assert.equal(updates[0].args.draft.subject, "Re: Subject drafted");
  assert.equal(updates[0].args.draft.to.address, ERIKA.address);
  assert.equal(updates[0].args.draft.replyTo.id, mails.drafted.id);
});

// TST-966004 · level: unit · module: MOD-maintenance-pages
// guards: A REPLY DRAFT IS KEPT IN THE MAILBOX'S DRAFTS FOLDER; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK; UC-039
// given: the mail of issue 4 that has no draft
// input: the person's click on Write the reply myself
// expect: one draft is stored through the mailbox to that mail's reporter alone, subject Re: its subject, an empty reply above the original quoted line by line; the page then shows that draft, editable; nothing else is stored
test("a reply written without a participant opens an empty draft with the original quoted", async () => {
  const { mails, w, target } = await start();
  await read(target);
  const detail = await opened(w, { issue: "4", product: PRODUCT_URL });
  assert.deepEqual(w.kept.bridge.filter((call) => call.operation === "store-draft"), [], "known positive: nothing stored before the click");
  await trusted(one(itemOf(detail, mails.plain.id), "write-reply"));
  await waitFor(() => byClass(itemOf(detail, mails.plain.id), "reply-draft").length > 0);
  const stores = w.kept.bridge.filter((call) => call.operation === "store-draft");
  assert.equal(stores.length, 1);
  assert.equal(stores[0].args.draft.to.address, ERIKA.address);
  assert.equal(stores[0].args.draft.subject, "Re: Subject plain");
  assert.ok(stores[0].args.draft.body.includes(`> ${SECRET}.`) || stores[0].args.draft.body.includes(`> Hello,`), stores[0].args.draft.body);
  assert.ok(byClass(itemOf(detail, mails.plain.id), "reply-draft").length === 1);
});

// TST-966005 · level: unit · module: MOD-maintenance-pages
// guards: THE PLACES A MAILBOX'S MAIL MAY GO ARE CONFIGURED; A PLACE OUTSIDE THE EU IS NAMED AS NOT COMPLIANT; A ROLE NAMES THE CAPABILITIES IT NEEDS; UC-039
// given: a mailbox that allows the place "this machine"; a register with local-llm (draft text, this machine), cloud-llm (draft text, a provider in the USA) and checker (no draft text, this machine)
// input: the issue 4 drawn; and again with the mailbox also allowing the USA place, noted as outside the EU
// expect: first only local-llm is offered; then local-llm and cloud-llm, cloud-llm with the mark not compliant and its place named, local-llm without; checker is offered in neither
test("Draft replies offers only participants that can draft at a place the mailbox allows", async () => {
  const first = await start();
  await read(first.target);
  const detail = await opened(first.w, { issue: "4", product: PRODUCT_URL });
  await waitFor(() => byClass(detail, "reply-participant").length > 0);
  assert.deepEqual(byClass(detail, "participant").map((radio) => radio.value), ["local-llm"]);
  document.body.replaceChildren();
  restoreNet();
  const second = await start({ places: [{ place: "this machine", outsideEu: false }, { place: "a provider in the USA", outsideEu: true, notCompliantNoted: true }] });
  await read(second.target);
  const both = await opened(second.w, { issue: "4", product: PRODUCT_URL });
  await waitFor(() => byClass(both, "reply-participant").length > 1);
  assert.deepEqual(byClass(both, "participant").map((radio) => radio.value).sort(), ["cloud-llm", "local-llm"]);
  const cloud = walk(both, (node) => node.getAttribute?.("data-participant") === "cloud-llm")[0];
  assert.match(textOf(cloud), /a provider in the USA/);
  assert.equal(byClass(cloud, "not-compliant").length, 1);
  assert.equal(byClass(walk(both, (node) => node.getAttribute?.("data-participant") === "local-llm")[0], "not-compliant").length, 0);
});

// TST-966006 · level: unit · module: MOD-maintenance-pages
// guards: THE PAGE NAMES WHERE IT SENDS; MAIL STAYS IN THE MAILBOX; UC-039
// given: local-llm chosen with a name; issue 4 with one mail with a draft, one without
// input: the choice of the participant
// expect: the run panel names the destination local-llm, where it processes data, and the parts it receives: the issue and the mail without a draft (by identifier), and not the mail that has a draft; Run is offered; nothing is sent or written yet
test("the run panel names the participant, its place and what it receives", async () => {
  const { mails, w, target } = await start();
  await read(target);
  const detail = await opened(w, { issue: "4", product: PRODUCT_URL });
  await waitFor(() => byClass(detail, "participant").length > 0);
  const radio = one(detail, "participant");
  radio.checked = true;
  one(detail, "person").value = "Reviewer Rae";
  radio.dispatchEvent(new Event("change"));
  await waitFor(() => byClass(detail, "run-panel").length > 0);
  const panel = textOf(one(detail, "run-panel"));
  assert.ok(panel.includes("local-llm") && panel.includes("this machine"), panel);
  assert.ok(panel.includes(`mail ${mails.plain.id}`) && panel.includes("issue"), panel);
  assert.equal(panel.includes(`mail ${mails.drafted.id}`), false, "the mail that has a draft is not sent again");
  assert.equal(buttonsOf(one(detail, "run-panel"), "Run").length, 1);
  assert.deepEqual([w.kept.endpoint, w.kept.bridge.filter((call) => call.operation === "store-draft")], [[], []]);
});

// TST-966007 · level: unit · module: MOD-maintenance-pages
// guards: A REPLY DRAFT IS KEPT IN THE MAILBOX'S DRAFTS FOLDER; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK; MAIL STAYS IN THE MAILBOX; UC-039
// given: the run panel of TST-966006 and a model endpoint (the fake runner) that returns one text for the mail without a draft
// input: the person's click on Run
// expect: the endpoint is asked once, at ep1; the text is stored as a draft through the mailbox, to that reporter alone, subject Re: its subject, the text above the original quoted; the page then shows that draft; the job's start record names the issue and no mail text or address; nothing is sent to any other mail
test("Run drafts a reply with the participant and stores it as a draft, which the page then shows", async () => {
  const texts = [];
  const { mails, w, target } = await start({ texts });
  await read(target);
  const detail = await opened(w, { issue: "4", product: PRODUCT_URL });
  await waitFor(() => byClass(detail, "participant").length > 0);
  const radio = one(detail, "participant");
  radio.checked = true;
  one(detail, "person").value = "Reviewer Rae";
  radio.dispatchEvent(new Event("change"));
  await waitFor(() => byClass(detail, "run-panel").length > 0);
  texts.push({ mail: mails.plain.id, text: "The export problem was fixed in version 1.5." });
  const run = buttonsOf(one(detail, "run-panel"), "Run")[0];
  run.dispatchEvent(new Event("click"));
  await flush();
  assert.deepEqual(w.kept.endpoint, [], "a click a script makes asks nothing");
  await trusted(run);
  await waitFor(() => w.kept.bridge.some((call) => call.operation === "store-draft") || byClass(detail, "reply-problem").length > 0);
  assert.equal(byClass(detail, "reply-problem").length, 0, textOf(one(detail, "reply-run-result") ?? detail));
  assert.equal(w.kept.endpoint.length, 1);
  await waitFor(() => byClass(detail, "reply-drafted").length > 0 || byClass(detail, "reply-problem").length > 0);
  assert.equal(byClass(detail, "reply-problem").length, 0, textOf(detail).slice(-300));
  assert.equal(byClass(detail, "reply-drafted").length, 1, "the page says the replies are stored as drafts");
  await waitFor(() => byClass(itemOf(detail, mails.plain.id), "reply-draft").length > 0);
  assert.equal(byClass(itemOf(detail, mails.plain.id), "reply-draft").length, 1, "the page then shows the stored draft");
  const stores = w.kept.bridge.filter((call) => call.operation === "store-draft");
  assert.equal(stores.length, 1);
  assert.equal(stores[0].args.draft.to.address, ERIKA.address);
  assert.equal(stores[0].args.draft.subject, "Re: Subject plain");
  assert.ok(stores[0].args.draft.body.startsWith("The export problem was fixed in version 1.5."));
  assert.ok(stores[0].args.draft.body.includes("> Hello,"));
  const records = w.kept.github.filter((request) => request.method === "POST" && request.path.includes("/git/"));
  assert.equal(records.map((request) => String(request.body ?? "")).some((body) => body.includes(SECRET) || body.includes(ERIKA.address)), false, "no mail text or address reaches the repository");
  assert.equal(w.kept.bridge.some((call) => /^(send|confirm-send)$/.test(call.operation)), false, "nothing is sent");
});

// TST-966008 · level: unit · module: MOD-maintenance-pages
// guards: CLOSING AN ISSUE PREPARES ITS REPLIES; READING THE MAILBOX CHANGES NOTHING IN IT; UC-039
// given: the Bridge does not answer
// input: the person's click on Read replies
// expect: no group is drawn; the page names why in .replies-problem; nothing is written to GitHub
test("a mailbox that cannot be reached is named and nothing is written", async () => {
  const f = await standard();
  const w = world({ mails: f.found, drafts: f.drafts, issues: f.issues });
  const inner = globalThis.fetch;
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(typeof input === "object" && !(input instanceof URL) ? input.url : String(input));
    if (url.origin === BRIDGE) throw new TypeError("connect ECONNREFUSED 127.0.0.1:4711");
    return inner(input, init);
  };
  const target = await read(await opened(w));
  assert.equal(byClass(target, "replies-group").length, 0);
  assert.ok(textOf(one(target, "replies-problem")).length > 20);
  assert.deepEqual(w.kept.github.filter((request) => request.method !== "GET"), []);
});

// TST-966009 · level: unit · module: MOD-maintenance-pages
// guards: EVERY STEP EXPLAINS ITSELF; UC-039
// given: the page before and after the reading, and an issue
// input: the folded explanations
// expect: the reading, the groups, the issue and the drafting each carry a folded <details class="explain">
test("every step of the replies page carries its folded explanation", async () => {
  const { w, target } = await start();
  assert.ok(byClass(one(target, "replies-step-read") ?? target, "explain").length >= 1, "the reading step");
  await read(target);
  const groups = one(target, "replies-step-groups");
  assert.ok(groups && byClass(groups, "explain").length >= 1, "the groups");
  const detail = await opened(w, { issue: "4", product: PRODUCT_URL });
  await waitFor(() => byClass(detail, "reply-drafting").length > 0);
  assert.ok(byClass(one(detail, "replies-step-issue"), "explain").length >= 1, "the issue");
  assert.ok(byClass(one(detail, "reply-drafting"), "explain").length >= 1, "the drafting");
});

// TST-966010 · level: unit · module: MOD-maintenance-pages
// guards: UC-039
// given: the view of MOD-maintenance-pages
// input: its routes and strategies read
// expect: it holds the route replies in the menu entry maintenance, and hands the frame MOD-mail-handling's mailStrategies, which the kind draft-replies names
test("the view holds the route replies and hands the frame mailStrategies", () => {
  assert.ok(pages.view, `the view: ${pages.error?.message}`);
  assert.deepEqual([route()?.entry, route()?.title], ["maintenance", "Replies"]);
  assert.ok(pages.view.strategies.includes(mailStrategies));
});

// TST-1108001 · level: unit · module: MOD-maintenance-pages
// guards: UC-039
// given: the replies read: the issues 4, 5 and 6 of alice/product listed in their groups
// input: the Open of each issue clicked; the route replies drawn with the parameters the click gave to go for issue 5
// expect: each Open is a button with a text as its accessible name and calls go once with the route "replies" and the parameters issue (the number as a string) and product alice/product, in the order clicked; drawn with the parameters of issue 5, the page shows issue #5 of that product
test("the Open of an issue goes to the route replies through go, and that route shows that issue of that product", async () => {
  const { w, target } = await start();
  await read(target);
  const opens = new Map(walk(target, (node) => (node.getAttribute?.("data-issue") ?? null) !== null && (node.className ?? "").includes("reply-issue"))
    .map((item) => [Number(item.getAttribute("data-issue")), walk(item, (node) => node.localName === "button" && (node.className ?? "").split(" ").includes("issue-link"))[0]]));
  assert.deepEqual([...opens.keys()].sort(), [4, 5, 6]);
  for (const [number, open] of [...opens].sort((a, b) => a[0] - b[0])) {
    assert.ok(open, `issue ${number} has an Open button`);
    assert.match(String(open.getAttribute("aria-label") ?? open.textContent).trim(), /\S/, `issue ${number}: the control has an accessible name`);
    open.dispatchEvent(new Event("click"));
  }
  assert.deepEqual(w.context.went, [4, 5, 6].map((number) => ["replies", { issue: String(number), product: PRODUCT_URL }]));
  const detail = await opened(w, w.context.went[1][1]);
  await waitFor(() => /Issue #\d/.test(textOf(detail)) || byClass(detail, "reply-problem").length > 0);
  assert.match(textOf(detail), /Issue #5 of alice\/product/);
});

// An address of the route replies written by hand: an href with `#replies/`.
const HAND_WRITTEN = /#replies\//;
const addressesIn = (root) => walk(root, (node) => HAND_WRITTEN.test(String(node.getAttribute?.("href") ?? "")));

// TST-1111001 · level: unit · module: MOD-maintenance-pages
// guards: UC-039; THE SITE SERVES A SCREEN READER
// given: the replies read and the route of issue 4 drawn; the source text of the page; a planted hand-written address in an element and in a source line
// input: every element of both pages and the page's source text searched for an address #replies/…
// expect: no element of the groups or of the issue carries such an href and the page's source text writes none; the same search finds the planted <a href="#replies/issue=9"> and the planted source line (counter-proof); each Open has a text as its name
test("the replies page writes no address #replies/…: the frame writes it from go", async () => {
  const { w, target } = await start();
  await read(target);
  const detail = await opened(w, { issue: "4", product: PRODUCT_URL });
  await waitFor(() => /Issue #\d/.test(textOf(detail)) || byClass(detail, "reply-problem").length > 0);
  assert.equal(addressesIn(target).length, 0, "the groups hold no address");
  assert.equal(addressesIn(detail).length, 0, "the issue holds no address");
  assert.ok(walk(target, (node) => (node.className ?? "").split(" ").includes("issue-link")).every((node) => textOf(node).trim().length > 0), "each Open has its name");
  const source = readFileSync(new URL("../src/maintenance-pages/replies.mjs", import.meta.url), "utf8");
  assert.equal(HAND_WRITTEN.test(source), false, "the page's source writes no address");
  const planted = document.createElement("div");
  const anchor = document.createElement("a");
  anchor.setAttribute("href", "#replies/issue=9");
  planted.append(anchor);
  assert.equal(addressesIn(planted).length, 1, "counter-proof: a hand-written address is found");
  assert.equal(HAND_WRITTEN.test("link(`#replies/issue=${each.issue}`, \"issue-link\", \"Open\")"), true, "counter-proof: a source line that writes one is found");
});

