// A page of mail gives the prompt bar only what the mailbox allows (ITM-510) — MOD-maintenance-pages, UC-049 3b, as the accepted text of docs/architecture/MOD-maintenance-pages.md states it (:125-130, blob f21551157732): "Each route gives the prompt bar its
// subject, of the kind `converse` (UC-049 3b): on a route that shows mail, the page a participant is given holds the text of a mail, its sender and its attachments only for a participant whose processing place the mailbox allows and that does not declare
// *write to the repository* ..., and only the mail's `MAIL-` identifier for any other; its `refuses` names `propose-edit` and `hand-over` ...; and its `withhold` names, for a message to be recorded, each name, mail address, phone number or account of that
// mail's people found in it, with `personHits`, and a passage of the mail's own text".
// Run: node --test tests/maintenance-pages-subject.test.mjs
//
// Module: MOD-maintenance-pages
// Guards: THE PLACES A MAILBOX'S MAIL MAY GO ARE CONFIGURED; A PARTICIPANT THAT WRITES TO A REPOSITORY NEVER RECEIVES A MAIL; NO PERSONAL DATA FROM A MAIL ENTERS A REPOSITORY; MAIL STAYS IN THE MAILBOX; A TEXT FROM A MAIL IS SEARCHED FOR THAT MAIL'S PEOPLE; UC-049; UC-038; UC-039
// Level: unit
//
// The world is tests/maintenance-pages-world.mjs. The subject of a route is `route.subject(params, context)`, and `paramsFor(participant)` gives `{ page }` (MOD-prompt-bar's Subject). Readings the texts leave open, which the tests state (the pull request names them):
//   - The page of a mail's text holds, per listed mail: its identifier, `From:` its sender, `Subject:`, `Date:`, its text and each attachment's name, type, size and text; the page of any other participant holds the identifiers only. A participant "whose processing place
//     the mailbox allows" is one whose `place` is among the connection's `places`; one with no place, and a person, are not.
//   - The routes that show mail are `mail` (the mails listed after Read mailbox) and `replies` (the mails found in the last reading); before a reading no mail is listed and the page holds none.
//   - `withhold(text)` gives a reason (a text) when `text` holds a name, address, phone number or account of a listed mail's people (the finding of personHits over the people of MOD-personal-data's peopleIn) or a passage of a listed mail's own text — a run of at least
//     twenty characters of it, whatever the case and the spacing —, and null otherwise.
// The counter-proofs are recorded in the pull request.

import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { ERIKA, PRODUCT_URL, SECRET, byClass, itemOf, mailOf, one, opened, pages, read, restoreWorld, standard, trusted, waitFor, world } from "./maintenance-pages-world.mjs";
import { INSTANCE } from "./main-page-home-harness.mjs";

afterEach(restoreWorld);

const LOCAL = { name: "local-llm", place: "this machine", capabilities: ["draft text"] };
const WRITER = { name: "cli-writer", place: "this machine", capabilities: ["draft text", "write to the repository"] };
const FAR = { name: "cloud-llm", place: "a provider in the USA", capabilities: ["draft text"] };
const PERSON = { name: "alice", place: null, capabilities: [] };
const ATTACHMENT = { name: "log.txt", type: "text/plain", size: 7, text: "LOGTEXT-ATTACHED" };
const SIGNED = "Hello,\nthe export of my thesis fails with error E42.\nCall me on +49 170 1234567 or write @erika_m.\nKind regards\nErika Mustermann";
const routeOf = (name) => pages.view.routes.find((candidate) => candidate.name === name);

async function mailWorld() {
  const f = await standard();
  const fresh = await mailOf("fresh", { text: SIGNED, attachments: [ATTACHMENT] });
  const w = world({ mails: [...f.found, fresh], drafts: f.drafts, issues: f.issues });
  return { ...f, fresh, w };
}
const subjectOf = (name, w) => routeOf(name).subject({}, w.context);
const pageFor = (subject, participant) => String(subject.paramsFor(participant).page);
const ALL_OF_IT = ["Erika Mustermann", ERIKA.address, "Subject fresh", "the export of my thesis fails with error E42", "LOGTEXT-ATTACHED", "log.txt"];

async function mailRouteRead(f) {
  const target = await opened(f.w, {}, "mail");
  await trusted(one(target, "read-mailbox"));
  await waitFor(() => byClass(target, "mail").length > 0);
  return target;
}

// TST-510001 · level: unit · module: MOD-maintenance-pages
// guards: THE PLACES A MAILBOX'S MAIL MAY GO ARE CONFIGURED; A PARTICIPANT THAT WRITES TO A REPOSITORY NEVER RECEIVES A MAIL; MAIL STAYS IN THE MAILBOX; UC-049
// given: the route mail after Read mailbox, one mail listed with an attachment; a mailbox that allows the place "this machine"; participants: local-llm (this machine, draft text), cli-writer (this machine, also write to the repository), cloud-llm (a provider in the USA), and a person with no place
// input: the subject's paramsFor for each
// expect: for local-llm the page holds the mail's identifier, sender (name and address), subject, date, text and the attachment's name and text; for each of the others only the identifier, none of the rest; the subject is of the kind converse and refuses propose-edit and hand-over
test("the page of the route mail holds a mail's text only for a participant at an allowed place that does not write", async () => {
  const f = await mailWorld();
  await mailRouteRead(f);
  const subject = subjectOf("mail", f.w);
  assert.equal(subject.kind, undefined, "a subject names no kind: the bar runs converse on every page");
  assert.deepEqual([...subject.refuses].sort(), ["hand-over", "propose-edit"]);
  const text = pageFor(subject, LOCAL);
  assert.ok(text.includes(f.fresh.id), "the identifier");
  for (const wanted of ALL_OF_IT) assert.ok(text.includes(wanted), `the page of local-llm holds ${wanted}`);
  assert.ok(text.includes("2026-10-18"));
  for (const other of [WRITER, FAR, PERSON]) {
    const page = pageFor(subject, other);
    assert.ok(page.includes(f.fresh.id), `${other.name}: the identifier`);
    for (const forbidden of ALL_OF_IT) assert.equal(page.includes(forbidden), false, `${other.name}: not ${forbidden}`);
  }
});

// TST-510002 · level: unit · module: MOD-maintenance-pages
// guards: THE PLACES A MAILBOX'S MAIL MAY GO ARE CONFIGURED; A PARTICIPANT THAT WRITES TO A REPOSITORY NEVER RECEIVES A MAIL; UC-049
// given: the route replies after Read replies, the mails of issue 4 found in the mailbox
// input: the subject's paramsFor for local-llm, cli-writer and cloud-llm
// expect: local-llm's page holds a found mail's identifier, sender and text; the others' pages hold identifiers only; the subject refuses propose-edit and hand-over
test("the page of the route replies holds the mails' texts under the same rule", async () => {
  const f = await mailWorld();
  const target = await opened(f.w, {});
  await trusted(one(target, "read-replies"));
  await waitFor(() => byClass(target, "replies-group").length > 0);
  const subject = subjectOf("replies", f.w);
  assert.deepEqual([...subject.refuses].sort(), ["hand-over", "propose-edit"]);
  const allowed = pageFor(subject, LOCAL);
  assert.ok(allowed.includes(f.mails.plain.id) && allowed.includes("Erika Mustermann") && allowed.includes("Subject plain") && allowed.includes(SECRET), allowed);
  for (const other of [WRITER, FAR, PERSON]) {
    const page = pageFor(subject, other);
    assert.ok(page.includes(f.mails.plain.id), `${other.name}: the identifier`);
    for (const forbidden of ["Erika", ERIKA.address, "Subject plain", SECRET]) assert.equal(page.includes(forbidden), false, `${other.name}: not ${forbidden}`);
  }
});

// TST-510003 · level: unit · module: MOD-maintenance-pages
// guards: NO PERSONAL DATA FROM A MAIL ENTERS A REPOSITORY; MAIL STAYS IN THE MAILBOX; A TEXT FROM A MAIL IS SEARCHED FOR THAT MAIL'S PEOPLE; UC-049
// given: the route mail with the listed mail whose sender is Erika Mustermann <erika@example.invalid> and whose text names the phone number +49 170 1234567 and the account @erika_m
// input: withhold of a message that holds the name; the address; the phone number; the account; a passage of the mail's own text; a message that holds none of them
// expect: each of the first five gives a reason (a text); the last gives null
test("withhold finds a planted name, address, phone number, account and a passage of the mail's own text, and a clean message none", async () => {
  const f = await mailWorld();
  await mailRouteRead(f);
  const { withhold } = subjectOf("mail", f.w);
  assert.equal(typeof withhold, "function");
  for (const planted of ["Please ask Erika Mustermann about it.", `Write to ${ERIKA.address} please.`, "Call +49 170 1234567 tomorrow.", "Her handle is @erika_m on the forum.", "The report says: the export of my thesis fails with error E42, as quoted."]) {
    assert.equal(typeof withhold(planted), "string", planted);
  }
  assert.equal(withhold("Which version of the tool do you use, and on which system?"), null);
  assert.equal(typeof withhold("The EXPORT of   my thesis FAILS with error e42"), "string", "a passage whatever the case and the spacing");
});

// TST-510004 · level: unit · module: MOD-maintenance-pages
// guards: MAIL STAYS IN THE MAILBOX; UC-049
// given: the route mail drawn anew after an earlier reading, before any reading of its own
// input: the subject's paramsFor for local-llm; withhold of a message
// expect: the page holds the route's title and no mail; withhold finds nothing in a text that no listed mail's people occur in
test("before a reading no mail is listed, so the page holds none and nothing is withheld", async () => {
  const f = await mailWorld();
  await mailRouteRead(f);
  document.body.replaceChildren();
  await opened(f.w, {}, "mail");
  const subject = subjectOf("mail", f.w);
  const page = pageFor(subject, LOCAL);
  assert.ok(page.includes("Mail"));
  assert.equal(/MAIL-/.test(page), false);
  assert.equal(subject.withhold("Erika Mustermann writes from erika@example.invalid"), null);
});
