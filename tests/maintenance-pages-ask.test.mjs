// Asking a reporter, an answer received, reopening and closing from the replies page (ITM-968) — MOD-maintenance-pages, UC-039 alternative flows 1a, 1b, 2a and 7a, as the accepted text of docs/architecture/MOD-maintenance-pages.md states it
// (:119-122, blob f21551157732): "*Ask the reporter* — a question drafted with *Draft question*, ... or written by hand — and *Send and wait*; removing the label `waiting-for-reporter`; *Reopen* and *Leave closed* for a mail that arrived in a
// closed issue's thread; *Close and reply*." (the question drafted by a participant is ITM-1026's.) MOD-mail-handling.md: `askReporter` sends a question as `sendReply` sends a reply, labels the issue `waiting-for-reporter` and notes `question-sent`;
// the issue stays open. MOD-repository-hosts: `setIssueState`, `setIssueLabels`.
// Run: node --test tests/maintenance-pages-ask.test.mjs
//
// Module: MOD-maintenance-pages
// Guards: AN ISSUE WAITING FOR A REPORTER IS LABELLED; A REPORTER'S ANSWER IS SHOWN AT ITS ISSUE; A CLOSED ISSUE IS REOPENED ONLY BY A PERSON; EVERY OUTGOING MAIL IS RELEASED BY A PERSON; ONE CLICK PER DECISION; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK; UC-039
// Level: unit
//
// The world is tests/maintenance-pages-world.mjs (the harness's browser and fake GitHub, the Bridge's mail operations, GitHub's issues of alice/product including the change of an issue's state and of its labels). Readings the texts leave open, which the tests
// state (the pull request names them):
//   - On an issue that is open (groups open and answer received) a mail that is found, sendable and not yet noted has <button class="ask-reporter"> "Ask the reporter": a click stores an empty draft of the question to that reporter alone, with the original
//     quoted (as a reply written by hand), and shows it with <button class="send-reply"> "Send and wait" (confirm "Send and wait" in the dialog, which repeats recipient and subject): the confirmation calls askReporter once; the draft of an open issue is a question.
//   - An issue under answer received marks each mail added after the last question as <p class="reply-new">, and offers <button class="remove-label"> "Remove the label" (setIssueLabels remove waiting-for-reporter, one click), Ask the reporter again and Close and reply.
//   - A mail added to a closed issue after it was closed (a mail-added note after the issue's closing note) is marked <p class="reply-arrived"> with <button class="reopen-issue"> "Reopen" (setIssueState open, one click, on the person's click only) and
//     <button class="leave-closed"> "Leave closed" (calls nothing, the offer leaves the page). Nothing reopens an issue by itself.
//   - An open issue has <button class="close-and-reply"> "Close and reply": one click closes the issue (setIssueState closed), the issues are read again and the page then shows the issue under to answer with its mails and drafts. A closed issue has neither this nor Ask the reporter.
// The counter-proofs are recorded in the pull request.

import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { PRODUCT_URL, SECRET, buttonsOf, byClass, flush, itemOf, mailOf, noteText, one, opened, read, restoreWorld, standard, textOf, trusted, waitFor, walk, world, ERIKA, issueRecord } from "./maintenance-pages-world.mjs";

afterEach(restoreWorld);

const dialog = () => byClass(document.body, "decision")[0];
const ops = (w, ...names) => w.kept.bridge.filter((call) => names.includes(call.operation));
const writes = (w) => w.kept.github.filter((request) => request.method !== "GET");
const day = () => new Date().toISOString().slice(0, 10);

/** The standard issues and, besides them: issue 8, closed, whose mail `arrived` was added after the closing note; issue 9, open, listing a mail that has a draft in Drafts. */
async function fixture(extra = {}) {
  const f = await standard();
  const [orig, early, arrived, qdraft] = [await mailOf("orig"), await mailOf("early"), await mailOf("arrived"), await mailOf("qdraft")];
  const draft = { ref: { route: "bridge", uid: 2, uidValidity: 7 }, inReplyTo: qdraft.messageId, mail: qdraft, to: ERIKA, subject: "Re: Subject qdraft", body: "Fixed in 1.5." };
  const eight = issueRecord(8, "closed", [orig], { comments: [noteText("mail-added", early.id, day()), "Closed with pull request https://github.com/alice/product/pull/11.", noteText("mail-added", arrived.id, day())] });
  const nine = issueRecord(9, "open", [qdraft]);
  const w = world({ mails: [...f.found, orig, early, arrived, qdraft], drafts: [...f.drafts, draft], issues: [...f.issues, eight, nine], ...extra });
  const target = await opened(w);
  await read(target);
  return { ...f, mails: { ...f.mails, orig, early, arrived, qdraft }, w, target };
}
async function issue(f, number) {
  const detail = await opened(f.w, { issue: String(number), product: PRODUCT_URL });
  await waitFor(() => byClass(detail, "reply-mails").length > 0);
  return detail;
}

// TST-968001 · level: unit · module: MOD-maintenance-pages
// guards: AN ISSUE WAITING FOR A REPORTER IS LABELLED; EVERY OUTGOING MAIL IS RELEASED BY A PERSON; ONE CLICK PER DECISION; UC-039
// given: the open issue 6 and its mail, found, without a draft
// input: the person's click on Ask the reporter; the dialog of Send and wait declined; the person's click on Send and wait and the dialog's confirmation
// expect: a question draft to that reporter alone is stored (subject Re: its subject, the original quoted) and shown with Send and wait, not Send; declining sends nothing; the confirmation sends once; the issue is labelled waiting-for-reporter and a question-sent note is written; no change of the issue's state is made: it stays open
test("Ask the reporter opens a question draft, Send and wait sends only after the confirmation, and the issue stays open", async () => {
  const f = await fixture();
  const detail = await issue(f, 6);
  const item = itemOf(detail, f.mails.open.id);
  assert.deepEqual(buttonsOf(item, "Send"), []);
  await trusted(one(item, "ask-reporter"));
  await waitFor(() => byClass(item, "reply-draft").length > 0);
  const stores = ops(f.w, "store-draft");
  assert.equal(stores.length, 1);
  assert.equal(stores[0].args.draft.to.address, ERIKA.address);
  assert.equal(stores[0].args.draft.subject, "Re: Subject open");
  assert.ok(stores[0].args.draft.body.includes("> Hello,"));
  assert.equal(buttonsOf(item, "Send and wait").length, 1);
  await trusted(buttonsOf(item, "Send and wait")[0]);
  await waitFor(() => dialog() !== undefined);
  assert.ok(textOf(dialog()).includes(ERIKA.address) && textOf(dialog()).includes("Re: Subject open"), textOf(dialog()));
  await trusted(buttonsOf(dialog(), "Cancel")[0]);
  assert.deepEqual(ops(f.w, "confirm-send", "send"), []);
  await trusted(buttonsOf(item, "Send and wait")[0]);
  await waitFor(() => dialog() !== undefined);
  await trusted(buttonsOf(dialog(), "Send and wait")[0]);
  await waitFor(() => ops(f.w, "send").length > 0 && f.w.kept.github.some((request) => request.path.endsWith("/issues/6/labels")));
  assert.equal(ops(f.w, "send").length, 1);
  const labelled = f.w.kept.github.filter((request) => request.method === "POST" && request.path.endsWith("/issues/6/labels"));
  assert.deepEqual(JSON.parse(labelled[0].body).labels, ["waiting-for-reporter"]);
  assert.ok(f.w.kept.github.some((request) => request.method === "POST" && request.path.endsWith("/issues/6/comments") && String(request.body).includes("Question sent")));
  assert.deepEqual(f.w.kept.github.filter((request) => request.method === "PATCH"), [], "the issue stays open");
  assert.equal(f.w.kept.issues.find((each) => each.number === 6).state, "open");
});

// TST-968002 · level: unit · module: MOD-maintenance-pages
// guards: A REPORTER'S ANSWER IS SHOWN AT ITS ISSUE; AN ISSUE WAITING FOR A REPORTER IS LABELLED; UC-039
// given: issue 5, open, labelled waiting-for-reporter, whose mail was added after the question
// input: the issue drawn; the person's click on Remove the label
// expect: the new mail is shown in full and marked new; Remove the label, Ask the reporter and Close and reply are offered; the click removes the label waiting-for-reporter once; nothing else is written
test("an issue under answer received shows the new mail and offers to remove the label, ask again or close", async () => {
  const f = await fixture();
  const detail = await issue(f, 5);
  const item = itemOf(detail, f.mails.waiting.id);
  assert.equal(byClass(item, "reply-new").length, 1);
  assert.ok(textOf(item).includes("Subject waiting"));
  assert.equal(byClass(detail, "close-and-reply").length, 1);
  assert.equal(byClass(item, "ask-reporter").length, 1);
  assert.deepEqual(writes(f.w).filter((request) => request.method !== "POST" || !request.path.includes("/git/")), []);
  const remove = one(detail, "remove-label");
  remove.dispatchEvent(new Event("click"));
  await flush();
  assert.equal(f.w.kept.github.filter((request) => request.method === "DELETE").length, 0, "a click a script makes does nothing");
  await trusted(remove);
  await waitFor(() => f.w.kept.github.some((request) => request.method === "DELETE"));
  const removed = f.w.kept.github.filter((request) => request.method === "DELETE");
  assert.equal(removed.length, 1);
  assert.ok(removed[0].path.endsWith("/issues/5/labels/waiting-for-reporter"), removed[0].path);
  assert.equal(f.w.kept.issues.find((each) => each.number === 5).labels.includes("waiting-for-reporter"), false);
});

// TST-968003 · level: unit · module: MOD-maintenance-pages
// guards: A CLOSED ISSUE IS REOPENED ONLY BY A PERSON; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK; UC-039
// given: the closed issue 8 and a mail added to it after it was closed
// input: the issue drawn; a click a script makes on Reopen; Leave closed; then the page drawn again and the person's click on Reopen
// expect: drawing and the script's click change nothing; the arrived mail is marked and offers Reopen and Leave closed; Leave closed calls nothing and takes the offer away; the person's click on Reopen makes exactly one change of state, to open
test("a mail that arrived in a closed issue's thread offers Reopen and Leave closed, and only Reopen reopens", async () => {
  const f = await fixture();
  const detail = await issue(f, 8);
  const item = itemOf(detail, f.mails.arrived.id);
  assert.equal(byClass(item, "reply-arrived").length, 1);
  assert.equal(byClass(itemOf(detail, f.mails.early.id), "reply-arrived").length, 0, "a mail added before the closing is no arrival");
  assert.deepEqual(f.w.kept.github.filter((request) => request.method === "PATCH"), [], "drawing reopens nothing");
  const reopen = one(item, "reopen-issue");
  reopen.dispatchEvent(new Event("click"));
  await flush();
  assert.deepEqual(f.w.kept.github.filter((request) => request.method === "PATCH"), []);
  await trusted(one(item, "leave-closed"));
  assert.equal(byClass(item, "reopen-issue").length, 0, "the offer leaves the page");
  assert.deepEqual(f.w.kept.github.filter((request) => request.method === "PATCH"), [], "Leave closed calls nothing");
  const again = await issue(f, 8);
  await trusted(one(itemOf(again, f.mails.arrived.id), "reopen-issue"));
  await waitFor(() => f.w.kept.github.some((request) => request.method === "PATCH"));
  const patches = f.w.kept.github.filter((request) => request.method === "PATCH");
  assert.equal(patches.length, 1);
  assert.deepEqual(JSON.parse(patches[0].body), { state: "open" });
  assert.ok(patches[0].path.endsWith("/issues/8"));
});

// TST-968004 · level: unit · module: MOD-maintenance-pages
// guards: CLOSING AN ISSUE PREPARES ITS REPLIES; ONE CLICK PER DECISION; UC-039
// given: the open issue 9, whose mail has a draft in Drafts; and the closed issue 4
// input: the issue 9 drawn; the person's click on Close and reply; the issue 4 drawn
// expect: Close and reply is offered on 9 and not on 4 (nor is Ask the reporter on 4); the click closes issue 9 once (state closed); the page then shows that issue under to answer with its mail and its draft complete
test("Close and reply closes the open issue and shows its drafts", async () => {
  // The server answers the change of state slowly, as a loaded machine does: the page's earlier draw of issue 9 (an open issue, its draft a question) stands meanwhile.
  const f = await fixture({ stateDelay: 80 });
  const four = await issue(f, 4);
  assert.deepEqual([byClass(four, "close-and-reply").length, byClass(four, "ask-reporter").length], [0, 0]);
  const detail = await issue(f, 9);
  assert.equal(f.w.kept.issues.find((each) => each.number === 9).state, "open");
  await trusted(one(detail, "close-and-reply"));
  // What the test asserts below is what it waits for: the state kept as closed, and the redrawn draft complete (its body shown, Send offered).
  const draftNow = () => itemOf(detail, f.mails.qdraft.id);
  await waitFor(() => f.w.kept.issues.find((each) => each.number === 9).state === "closed" && byClass(draftNow(), "draft-body").length > 0 && buttonsOf(draftNow(), "Send").length > 0);
  const patches = f.w.kept.github.filter((request) => request.method === "PATCH");
  assert.equal(patches.length, 1);
  assert.deepEqual(JSON.parse(patches[0].body), { state: "closed" });
  assert.equal(f.w.kept.issues.find((each) => each.number === 9).state, "closed");
  assert.match(textOf(one(itemOf(detail, f.mails.qdraft.id), "draft-body")) + String(one(itemOf(detail, f.mails.qdraft.id), "draft-body").value), /Fixed in 1\.5/);
  assert.equal(buttonsOf(itemOf(detail, f.mails.qdraft.id), "Send").length, 1, "a closed issue's draft is a reply");
});

// TST-1107001 · level: unit · module: MOD-maintenance-pages
// guards: A REPORTER'S ANSWER IS SHOWN AT ITS ISSUE; UC-039
// given: the issue 5, labelled waiting-for-reporter, whose mail was added after the question; the issue 6, open, whose mail came before any question
// input: the issue 5 opened; the issue 6 opened
// expect: UC-039 1b — "The issue appears under *answer received*, with the new mail shown in full" —: the new mail of issue 5 shows its whole text, every line of it, beside reporter, date and subject; the mail of issue 6, not a new one, has no text shown
test("An issue under answer received shows the new mail in full", async () => {
  const f = await fixture();
  const answered = itemOf(await issue(f, 5), f.mails.waiting.id);
  assert.ok(byClass(answered, "reply-new").length === 1, "the mail is the new one");
  const text = textOf(one(answered, "reply-text"));
  for (const line of ["Hello,", SECRET, "Kind regards", "Erika Mustermann"]) assert.ok(text.includes(line), `${line}: ${text}`);
  const earlier = itemOf(await issue(f, 6), f.mails.open.id);
  assert.equal(byClass(earlier, "reply-text").length, 0);
});
