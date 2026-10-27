// The replies page says when the mailbox's last test found sending not working (ITM-1249) — MOD-maintenance-pages, UC-037 alternative 7d and UC-039, as the accepted text of docs/architecture/MOD-maintenance-pages.md states it for the route `replies`:
// "Where the mailbox's last test (`last-test:mailbox`) recorded a `sending` other than "works" — present, and naming why sending does not work —, the page says so, with that reason, beside *Send* and *Send and wait*, and offers both as before
// (UC-037 7d); a record without `sending` says nothing about sending." The record is MOD-browser-store's `last-test:<key>`: `{ at, outcome, tools?, sending? }`.
// Run: node --test tests/maintenance-pages-sending-notice.test.mjs
//
// Module: MOD-maintenance-pages
// Guards: THE PAGE NAMES WHERE IT SENDS; EVERY OUTGOING MAIL IS RELEASED BY A PERSON; UC-037; UC-039
// Level: unit
//
// The world is tests/maintenance-pages-world.mjs; the record of the last test is written into its browser's store before the route is drawn. Reading the texts leave open, which the tests state (the pull request names it):
//   - The route `replies/<issue>` draws the drafts, and so *Send* (a closed issue) and *Send and wait* (an open one); the notice is <p class="sending-notice"> in the item of each draft, holding the recorded reason; the page of the groups
//     (`replies`) has neither button and so no notice.
// The counter-proof is the same page before the change: the record holds a `sending` and the page says nothing.

import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { writeSetting } from "../src/browser-store/index.mjs";
import { ERIKA, PRODUCT_URL, buttonsOf, byClass, itemOf, one, opened, read, restoreWorld, standard, textOf, waitFor, world } from "./maintenance-pages-world.mjs";

afterEach(restoreWorld);

const REASON = "the sign-in did not grant Mail.Send";

// The issue 4 (closed; its drafted mail has Send) and the issue 6 (open; its mail has a draft, so Send and wait), with the record of the last test given.
async function pages(record) {
  const f = await standard();
  const question = { ref: { route: "bridge", uid: 2, uidValidity: 7 }, inReplyTo: f.mails.open.messageId, mail: f.mails.open, to: ERIKA, subject: "Re: Subject open", body: "What version do you use?" };
  const w = world({ mails: f.found, drafts: [...f.drafts, question], issues: f.issues });
  if (record !== undefined) writeSetting(w.context.store, "last-test:mailbox", record);
  const target = await opened(w);
  await read(target);
  const closed = await opened(w, { issue: "4", product: PRODUCT_URL });
  await waitFor(() => byClass(itemOf(closed, f.mails.drafted.id), "send-reply").length > 0);
  const open = await opened(w, { issue: "6", product: PRODUCT_URL });
  await waitFor(() => byClass(itemOf(open, f.mails.open.id), "send-reply").length > 0);
  return { target, closed: itemOf(closed, f.mails.drafted.id), open: itemOf(open, f.mails.open.id) };
}

// TST-1249104 · level: unit · module: MOD-maintenance-pages
// guards: THE PAGE NAMES WHERE IT SENDS; UC-037; UC-039
// given: the record of the mailbox's last test `{ at, outcome: "working", sending: "the sign-in did not grant Mail.Send" }`; the draft of a closed issue's mail and the draft of an open issue's mail
// input: the route replies/<issue> drawn for each
// expect: beside Send, and beside Send and wait, the page says that sending does not work, with the recorded reason; both buttons are still offered
test("a recorded sending that does not work is said beside Send and beside Send and wait, and both are offered", async () => {
  const { closed, open } = await pages({ at: "2026-10-26T08:00:00.000Z", outcome: "working", sending: REASON });
  for (const [item, label] of [[closed, "Send"], [open, "Send and wait"]]) {
    const notice = one(item, "sending-notice");
    assert.ok(notice, `a notice beside ${label}`);
    assert.match(textOf(notice), /sending does not work/i);
    assert.ok(textOf(notice).includes(REASON), textOf(notice));
    assert.equal(buttonsOf(item, label).length, 1, `${label} is still offered`);
  }
});

// TST-1249105 · level: unit · module: MOD-maintenance-pages
// guards: THE PAGE NAMES WHERE IT SENDS; UC-037; UC-039
// given: the record of the last test with `sending` "works"; a record without `sending` (what an endpoint's or an older test leaves); no record at all
// input: the route replies/<issue> drawn for the closed and the open issue, for each
// expect: nothing is said about sending (no notice), and Send and Send and wait are offered
test("with sending recorded as working, with no sending recorded, or with no record, nothing is said about sending", async () => {
  for (const record of [{ at: "2026-10-26T08:00:00.000Z", outcome: "working", sending: "works" }, { at: "2026-10-26T08:00:00.000Z", outcome: "working" }, undefined]) {
    const { closed, open } = await pages(record);
    assert.equal(buttonsOf(closed, "Send").length, 1, "known positive: the page of the draft is drawn");
    assert.equal(buttonsOf(open, "Send and wait").length, 1, "known positive: the page of the question is drawn");
    for (const item of [closed, open]) {
      assert.deepEqual(byClass(item, "sending-notice"), [], JSON.stringify(record));
      assert.doesNotMatch(textOf(item), /sending does not work/i, JSON.stringify(record));
    }
  }
});
