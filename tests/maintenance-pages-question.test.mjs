// A participant drafts the question to a reporter (ITM-1026) — MOD-maintenance-pages, UC-039 flow 1a, as the accepted text of docs/architecture/MOD-maintenance-pages.md states it (:119-122, blob f21551157732): "*Ask the reporter* — a question drafted with
// *Draft question*, the run panel of `draft-replies` with the person's point as its parameter `question`, or written by hand — and *Send and wait*". ITM-968 builds the question written by hand and *Send and wait*.
// Run: node --test tests/maintenance-pages-question.test.mjs
//
// Module: MOD-maintenance-pages
// Guards: THE PAGE NAMES WHERE IT SENDS; THE PLACES A MAILBOX'S MAIL MAY GO ARE CONFIGURED; A REPLY DRAFT IS KEPT IN THE MAILBOX'S DRAFTS FOLDER; EVERY OUTGOING MAIL IS RELEASED BY A PERSON; NO PERSONAL DATA FROM A MAIL ENTERS A REPOSITORY; UC-039
// Level: unit
//
// The world is tests/maintenance-pages-world.mjs (the fake runner is its model endpoint ep1). Readings the texts leave open, which the tests state (the pull request names them):
//   - On an open issue a mail that is found, sendable, not noted and without a draft has <button class="draft-question"> "Draft question" beside Ask the reporter; its click opens <section class="question-drafting"> in the mail's item with
//     <textarea class="question-point"> for the person's point, the participants (<input class="participant">, those that can draft text at a place the mailbox allows), <input class="person"> and, once the point, a participant and a name are given, the run panel of the
//     kind draft-replies with the parameter `question` over the issue and that one mail. Run (the person's click) runs the job in this tab; the question the participant returns is stored as a draft through the mailbox, to that reporter alone, and shown with
//     Send and wait. Nothing is sent. The start record names the issue and the product, and neither the point nor a mail.
// The counter-proofs are recorded in the pull request.

import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { ERIKA, PRODUCT_URL, SECRET, buttonsOf, byClass, flush, itemOf, one, opened, read, restoreWorld, start, textOf, trusted, waitFor } from "./maintenance-pages-world.mjs";

afterEach(restoreWorld);
const ops = (w, ...names) => w.kept.bridge.filter((call) => names.includes(call.operation));
const POINT = "Which version of the tool do you use, and on which system?";

async function openIssue(f, number) {
  const detail = await opened(f.w, { issue: String(number), product: PRODUCT_URL });
  await waitFor(() => byClass(detail, "reply-mails").length > 0);
  return detail;
}
async function ready(texts = []) {
  const f = await start({ texts });
  await read(f.target);
  const detail = await openIssue(f, 6);
  const item = itemOf(detail, f.mails.open.id);
  return { ...f, texts, detail, item };
}

// TST-1026201 · level: unit · module: MOD-maintenance-pages
// guards: THE PAGE NAMES WHERE IT SENDS; THE PLACES A MAILBOX'S MAIL MAY GO ARE CONFIGURED; UC-039
// given: the open issue 6 and its mail, found, without a draft; a mailbox that allows the place "this machine"; a register with local-llm there and cloud-llm in the USA
// input: the person's click on Draft question; the point typed, local-llm chosen, a name given
// expect: a section opens with a field for the point and the participants — local-llm alone —; no run panel before the point, a participant and a name are given; then the run panel names local-llm and its place and the parts it receives: the issue, the person's point and the mail by its identifier, and no "Solved by"; nothing is sent or stored yet
test("Draft question asks for the person's point and a participant at an allowed place, and its run panel names what the participant receives", async () => {
  const f = await ready();
  await trusted(one(f.item, "draft-question"));
  await waitFor(() => byClass(f.item, "question-drafting").length > 0 && byClass(f.item, "participant").length > 0);
  assert.deepEqual(byClass(f.item, "participant").map((radio) => radio.value), ["local-llm"]);
  const radio = one(f.item, "participant");
  radio.checked = true;
  one(f.item, "person").value = "Reviewer Rae";
  radio.dispatchEvent(new Event("change"));
  await flush();
  assert.equal(byClass(f.item, "run-panel").length, 0, "no panel before the point, though a participant and a name are given");
  const point = one(f.item, "question-point");
  point.value = POINT;
  point.dispatchEvent(new Event("input"));
  await waitFor(() => byClass(f.item, "run-panel").length > 0);
  const panel = textOf(one(f.item, "run-panel"));
  assert.ok(panel.includes("local-llm") && panel.includes("this machine"), panel);
  assert.ok(panel.includes("issue") && panel.includes("question") && panel.includes(`mail ${f.mails.open.id}`), panel);
  assert.equal(/Solved by/.test(panel), false);
  assert.deepEqual([f.w.kept.endpoint, ops(f.w, "store-draft", "confirm-send", "send")], [[], []]);
});

// TST-1026202 · level: unit · module: MOD-maintenance-pages
// guards: A REPLY DRAFT IS KEPT IN THE MAILBOX'S DRAFTS FOLDER; EVERY OUTGOING MAIL IS RELEASED BY A PERSON; NO PERSONAL DATA FROM A MAIL ENTERS A REPOSITORY; UC-039
// given: the run panel of TST-1026201 and a model endpoint that returns a question for the mail
// input: a click a script makes on Run; the person's click on Run
// expect: the script's click asks nothing; the endpoint is asked once and its request holds the person's point; the question is stored as a draft through the mailbox, to that reporter alone, subject Re: its subject, the text above the original quoted; the item then shows that draft with Send and wait (not Send); nothing is sent; the repository's requests hold neither the point, the mail's text nor its address
test("Run drafts the question with the participant and stores it as a draft shown with Send and wait, and nothing is sent", async () => {
  const texts = [];
  const f = await ready(texts);
  await trusted(one(f.item, "draft-question"));
  await waitFor(() => byClass(f.item, "participant").length > 0);
  const point = one(f.item, "question-point");
  point.value = POINT;
  point.dispatchEvent(new Event("input"));
  const radio = one(f.item, "participant");
  radio.checked = true;
  one(f.item, "person").value = "Reviewer Rae";
  radio.dispatchEvent(new Event("change"));
  await waitFor(() => byClass(f.item, "run-panel").length > 0);
  texts.push({ mail: f.mails.open.id, text: "Could you tell us which version you use, and on which system?" });
  const run = buttonsOf(one(f.item, "run-panel"), "Run")[0];
  run.dispatchEvent(new Event("click"));
  await flush();
  assert.deepEqual(f.w.kept.endpoint, []);
  await trusted(run);
  await waitFor(() => ops(f.w, "store-draft").length > 0);
  assert.equal(f.w.kept.endpoint.length, 1);
  assert.ok(JSON.stringify(f.w.kept.endpoint[0].body).includes(POINT), "the request holds the person's point");
  const stores = ops(f.w, "store-draft");
  assert.equal(stores.length, 1);
  assert.equal(stores[0].args.draft.to.address, ERIKA.address);
  assert.equal(stores[0].args.draft.subject, "Re: Subject open");
  assert.ok(stores[0].args.draft.body.startsWith("Could you tell us which version") && stores[0].args.draft.body.includes("> Hello,"));
  await waitFor(() => byClass(f.item, "reply-draft").length > 0);
  const item = itemOf(f.detail, f.mails.open.id);
  assert.equal(buttonsOf(item, "Send and wait").length, 1);
  assert.equal(buttonsOf(item, "Send").length, 0);
  assert.deepEqual(ops(f.w, "confirm-send", "send"), []);
  const written = f.w.kept.github.filter((request) => request.method !== "GET").map((request) => String(request.body ?? "")).join("\n");
  for (const forbidden of [POINT, SECRET, ERIKA.address]) assert.equal(written.includes(forbidden), false, forbidden);
});

// TST-1026203 · level: unit · module: MOD-maintenance-pages
// guards: UC-039
// given: the closed issue 4 and the open issue 6
// input: the issues drawn
// expect: Draft question is offered on the open issue's mail and not on the closed issue's (a closed issue's mail is answered, not asked)
test("Draft question is offered on an open issue only", async () => {
  const f = await ready();
  assert.equal(byClass(f.item, "draft-question").length, 1);
  const closed = await openIssue(f, 4);
  assert.equal(byClass(closed, "draft-question").length, 0);
});
