// The routes `replies` and `replies/<issue>` — replies to answer (UC-039 steps 1 to 4, and 2b, 3a, 4a), as docs/architecture/MOD-maintenance-pages.md states them and ITM-966 builds them: closed issues with mails to answer, answers received, open
// issues; an issue with what solved it and each listed mail found in the mailbox with its draft; *Draft replies* with its run panel, or a reply written without a participant; each draft complete — recipient, subject, body, attachments — and
// editable (ITM-966); *Send* with its confirmation repeating recipient and subject, a reply sent but not noted and its note offered again, and *No reply* (ITM-967). *Ask the reporter* with *Send and wait*, *Draft question* by a participant, the answer received, removing the label, *Reopen* and *Leave closed*, and *Close and reply* (ITM-968).
//
// Module: MOD-maintenance-pages
//
// Readings the texts leave open, which this file takes (the pull request names them):
//   - Reading changes nothing without a click: the page draws *Read replies*, and the person's click calls repliesDue, which may note a reply found in Sent in its issue. The last reading is kept in memory for the route of one issue, and for nothing else.
//   - A mail has a draft to show when repliesDue found one in Drafts; it is shown as the mailbox's showDraft gives it, its body in an editable field, and *Save draft* saves the edit with updateDraft to the same recipient and subject.
//   - A mail whose reply address is missing or no address is *not sendable* (as storeReplies marks it); a mail with a note is *noted*; a mail the mailbox no longer holds is *not found in the mailbox*; none of these is offered a draft.
//   - The participants offered are those the register lists that can draft text and whose processing place the mailbox's connection allows (`places`); an allowed place the connection records as outside the EU is marked not compliant.
//   - The run panel is that of the kind `draft-replies` over the issue and the mails that have no draft and can be answered. Run is the person's click; the job runs in this tab (the route tab: its drafts are stored through the mailbox this tab holds),
//     its start record naming the issue and the product and no mail; the texts it returns are stored as drafts through the writer `mail-drafts`, and nothing is sent.
//   - *Send* reads the draft again (showDraft), shows it in MOD-site-frame's dialog of a decision — recipient, subject, attachments, body —, and only the dialog's confirmation calls sendReply, once, with the ShownMail the dialog showed. A failure the mailbox gives
//     (SendRefused with the server's answer, ConfirmationRefused, DraftChanged, a sign-in expired, a Bridge not running) leaves the draft and notes nothing; DraftChanged shows the draft again. A failure of the note after the send (Access's: a token refused,
//     a permission missing) names the reply as sent and not noted and offers the note again; where the failure's name does not tell (Unreachable is both), the draft's presence in Drafts tells.
//   - *No reply* is offered for every mail not yet noted, a mail not found in the mailbox and a mail not sendable included, and calls noReply once, on a click, without a dialog (one click per decision).
//   - On an open issue (groups open and answer received) the draft of a mail is a question: it is sent with *Send and wait* (askReporter) after the same confirmation, which labels the issue waiting-for-reporter and notes the question; the issue stays open.
//     A mail found, sendable and not noted has *Ask the reporter*, which stores an empty question draft with the original quoted (a question written by hand; a participant drafts it in ITM-1026). On a closed issue the draft is a reply, sent with *Send*.
//   - A mail is *new* under answer received when its mail-added note follows the last question-sent note; a mail *arrived* in a closed issue's thread when its mail-added note follows the issue's closing note (the order of the comments, which is the order of the notes).
//     *Reopen* (setIssueState open) is the person's click; *Leave closed* calls nothing and takes the offer away; no mail reopens an issue by itself. *Close and reply* closes an open issue with setIssueState, reads the issues again and shows it under to answer.
//   - *Draft question* (ITM-1026) opens, in the mail's item, the run panel of `draft-replies` with the person's point as the parameter `question` over the issue and that one mail: the participants are those of the drafting of replies (draft text, a place the mailbox allows),
//     the panel appears once the point, a participant and a name are given, and the question the participant returns is stored as a draft and shown with *Send and wait*; the start record names the issue and the product, not the point.
//   - The folded explanations are built here, not by the frame's `explain`: explanations.md holds no topic of this page and it is the frame's file (as mail.mjs does).

import { readSetting } from "../browser-store/index.mjs";
import { newJobId } from "../job-ledger/index.mjs";
import { kindOf } from "../job-catalogue/index.mjs";
import { prepareJob } from "../job-runner/index.mjs";
import { askReporter, noReply, repliesDue, sendReply, storeReplies } from "../mail-handling/index.mjs";
import { issueLabels, noteText, notesOf } from "../mail-records/index.mjs";
import { participantSchema, participantsOf, eligible } from "../participant-list/index.mjs";
import { readRegister } from "../documents/index.mjs";
import { queueJob, runOnTab } from "../runtimes/index.mjs";
import { confirmDecision, runPanel } from "../site-frame/index.mjs";
import { peopleIn } from "../personal-data/index.mjs";
import { connectionsOf, mailboxOf, mailSubject, productsOf } from "./mail.mjs";

const REGISTER = "docs/participants.md";
const JOB_FILE = /^docs\/jobs\/(JOB-[^/]+)\.md$/;
const ADDRESS = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;
const GROUPS = [["to-answer", "toAnswer", "To answer"], ["answer-received", "answerReceived", "Answer received"], ["open", "open", "Open"]];

const STEP_TEXT = {
  read: "Read replies reads every issue of the products that lists mails, the mailbox's Drafts and Sent folders, and finds each listed mail by its identifier. A reply found in Sent that no issue notes yet is noted in its issue now. Nothing in the mailbox is changed. Book: ch. 14, Evolution Processes and Change Identification.",
  groups: "Three groups: closed issues with a listed mail that has no reply note (to answer), issues labelled waiting-for-reporter with a new mail (answer received), and the open ones. Open an issue to see what solved it and its mails.",
  issue: "The issue with what solved it, and per listed mail the mail itself, found in the mailbox through its identifier, with its draft in Drafts if there is one. A draft is shown complete and can be edited here; each edit is saved to the draft. Nothing is sent from this page.",
  question: "Draft question asks a participant to write one question to the reporter of this mail, from your point: what you want to know. Only participants whose processing place the mailbox allows are offered; the panel states where the participant processes data and exactly what it receives: the issue, your point and this mail. The question is stored as a draft in the mailbox's Drafts folder and nowhere else; you send it with Send and wait.",
  drafting: "Draft replies asks a participant for one text per mail: what the problem was, what was done, from which version the fix is live. Only participants whose processing place the mailbox allows are offered; the panel states where the participant processes data and exactly what it receives. The texts are stored as drafts in the mailbox's Drafts folder and nowhere else. Or write a reply yourself: an empty draft opens with the original quoted.",
};

function el(name, className, ...children) {
  const node = document.createElement(name);
  if (className) node.className = className;
  node.append(...children);
  return node;
}
const fold = (text) => el("details", "explain", el("summary", null, "What is this?"), el("p", null, text));
const link = (href, className, text) => { const anchor = el("a", className, text); anchor.setAttribute("href", href); return anchor; };
// A listener that answers only a click the browser marks as a person's (THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK).
function button(className, text, listener) {
  const node = el("button", className, text);
  node.setAttribute("type", "button");
  node.addEventListener("click", (event) => { if (event?.isTrusted === true && !node.disabled) listener(event); });
  return node;
}
const who = (address) => (address.name ? `${address.name} <${address.address}>` : address.address);
const failed = (failure) => `${failure?.name ?? "Error"}${failure?.reason ? ` (${failure.reason})` : ""}: ${failure?.message ?? failure}`;
// The address a reply to this mail goes to, as storeReplies reads it: its Reply-To, else its sender; none where it is missing or no address.
const replyAddress = (mail) => { const address = mail.replyTo?.[0] ?? mail.from; return address && ADDRESS.test(address.address) ? address : null; };

// The issue's address, which the job's record names it by (MOD-job-ledger: works_on holds an issue's address): GitHub's /issues/<n>, GitLab's /-/issues/<n>.
const issueAddress = (due) => `${due.product.replace(/\/$/, "")}${/github\.com/.test(due.product) ? "" : "/-"}/issues/${due.issue}`;

// The last reading, kept in memory for the route of one issue: { due, products, box, connection }.
let last = null;

// The failures that are the mailbox's (nothing was sent) and those that are Access's (the note failed after the send, or the issue could not be read).
const MAILBOX_FAILURES = new Set(["DraftChanged", "ConfirmationRefused", "SendRefused", "SignInExpired", "PermissionDeclined", "Throttled", "BridgeUnavailable", "NoEncryption", "LoginRefused", "FolderNotFound", "NoReplyAddress"]);
const NOTE_FAILURES = new Set(["TokenRefused", "PermissionMissing", "RateLimited", "Moved", "NotFound", "NotSupported"]);
const today = () => new Date().toISOString().slice(0, 10);

// Beside Send and Send and wait, and on the page of the groups where a reply would be sent from: that the mailbox's last test found sending not working, with its reason (UC-037 7d). A record without `sending`, or with "works", says nothing; both buttons stay offered.
function sendingNotice(store) {
  const sending = readSetting(store, "last-test:mailbox")?.sending;
  if (typeof sending !== "string" || sending === "works") return [];
  return [el("p", "sending-notice", `The last test of the mailbox found that sending does not work: ${sending}`)];
}

// A draft as the mailbox shows it, complete and editable; *Save draft* saves the edit to the draft; *Send* sends it only on the confirmation of the mail shown.
function draftBlock(box, mail, initial, ctx) {
  const block = el("div", "reply-draft");
  let ref = initial;
  async function show(shownRef, said = []) {
    const shown = await box.showDraft(shownRef);
    ref = shown.ref ?? shownRef;
    const body = el("textarea", "draft-body");
    body.value = shown.body;
    body.textContent = shown.body;
    const edited = el("p", "draft-saved");
    const save = button("save-draft", "Save draft", async () => {
      try {
        const saved = await box.updateDraft(ref, { replyTo: mail, to: shown.to[0], subject: shown.subject, body: body.value });
        await show(saved, [el("p", "draft-saved", "Saved to the draft.")]);
      } catch (failure) {
        edited.textContent = `The draft could not be saved: ${failed(failure)}`;
      }
    });
    const outcome = el("div", "reply-outcome", ...said);
    const send = button("send-reply", ctx.mode === "ask" ? "Send and wait" : "Send", async () => {
      outcome.replaceChildren();
      let mailShown;
      try {
        mailShown = await box.showDraft(ref);
      } catch (failure) {
        outcome.append(el("p", "reply-problem", `The draft could not be read: ${failed(failure)}`));
        return;
      }
      const asking = ctx.mode === "ask";
      const decision = await confirmDecision({ title: `Send the ${asking ? "question" : "reply"} to ${mailShown.to.map(who).join(", ")}?`,
        lines: [`To: ${mailShown.to.map(who).join(", ")}`, ...(mailShown.cc?.length ? [`Cc: ${mailShown.cc.map(who).join(", ")}`] : []), `Subject: ${mailShown.subject}`,
          `Attachments: ${(mailShown.attachments ?? []).map((each) => `${each.name} (${each.size} bytes)`).join(", ") || "none"}`, mailShown.body], confirm: asking ? "Send and wait" : "Send" });
      if (!decision.confirmed) return;
      send.disabled = true;
      try {
        await (asking ? askReporter : sendReply)(box, ctx.host, ctx.due.issue, mail.id, mailShown);
        block.replaceChildren(el("p", "reply-sent", asking ? `The question was sent to ${mailShown.to.map(who).join(", ")}; the issue is labelled ${issueLabels.waitingForReporter} and stays open.`
          : `The reply was sent to ${mailShown.to.map(who).join(", ")} and is noted in the issue.`));
      } catch (failure) {
        send.disabled = false;
        const kept = MAILBOX_FAILURES.has(failure?.name) ? true : NOTE_FAILURES.has(failure?.name) ? false : await box.showDraft(ref).then(() => true, () => false);
        if (kept) {
          const problem = el("p", "reply-problem", failure?.name === "SendRefused" ? `The mail server refused the mail: ${failure.answer ?? failure.message}. The draft stays.`
            : failure?.name === "DraftChanged" ? "The draft changed since it was shown: it is shown again; check it and send again." : `The reply was not sent: ${failed(failure)}. The draft stays.`);
          if (failure?.name === "DraftChanged") await show(ref, [problem]); else outcome.append(problem);
          return;
        }
        const again = button("note-again", "Note the reply again", async () => {
          again.disabled = true;
          try {
            await ctx.host.commentOnIssue(ctx.due.issue, noteText(ctx.mode === "ask" ? "question-sent" : "reply-sent", mail.id, today()));
            block.replaceChildren(el("p", "reply-sent", "The reply was sent and is noted in the issue now."));
          } catch (error) {
            again.disabled = false;
            problem.textContent = `The reply was sent but is not noted in the issue: ${failed(error)}`;
          }
        });
        const problem = el("p", "reply-not-noted", `The reply was sent, but the note could not be written in the issue: ${failed(failure)}`);
        block.replaceChildren(problem, el("p", null, again));
      }
    });
    block.replaceChildren(el("p", null, "To: ", el("span", "draft-to", shown.to.map(who).join(", ")), shown.cc?.length ? ` · Cc: ${shown.cc.map(who).join(", ")}` : ""),
      el("p", null, "Subject: ", el("span", "draft-subject", shown.subject)), el("p", null, body),
      el("ul", "draft-attachments", ...(shown.attachments ?? []).map((each) => el("li", null, `${each.name} (${each.size} bytes)`))), el("p", null, save, " ", send), ...sendingNotice(ctx.store), edited, outcome);
  }
  show(initial).catch((failure) => block.replaceChildren(el("p", "draft-problem", `The draft could not be read: ${failed(failure)}`)));
  return block;
}

function mailItem(entry, due, box, host, extra) {
  const { id, mail, draft, noted } = entry;
  const { group, arrived, fresh, redraw } = extra;
  const ctx = { due, host, store: extra.ctx.context.store, mode: group === "to-answer" ? "reply" : "ask" };
  const item = el("li", "reply-mail");
  item.setAttribute("data-mail", id);
  const noteOnly = () => item.replaceChildren(el("p", "reply-noted", "A reply, or the decision not to answer, is noted in the issue."));
  const none = () => button("no-reply", "No reply", async () => {
    try {
      await noReply(host, due.issue, id);
      noteOnly();
    } catch (failure) {
      item.append(el("p", "reply-problem", `The decision could not be noted: ${failed(failure)}`));
    }
  });
  if (mail === null) {
    item.append(el("p", "reply-missing", `${id}: not found in the mailbox. Name the folder in the mailbox connection, or decide not to reply.`), el("p", null, none()));
    return item;
  }
  item.append(el("p", null, el("span", "reply-reporter", who(mail.from)), " · ", el("span", "reply-date", mail.date), " · ", el("span", "reply-subject", mail.subject)));
  if (fresh.has(id)) item.append(el("p", "reply-new", "New: this mail came after your question."));
  if (fresh.has(id)) item.append(el("pre", "reply-text", mail.text));
  if (arrived.has(id)) {
    const offer = el("p", "reply-arrived", "This mail arrived in the thread after the issue was closed. The issue stays closed until you reopen it. ");
    offer.append(button("reopen-issue", "Reopen", async () => {
      try { await host.setIssueState(due.issue, "open"); await redraw(); } catch (failure) { offer.append(el("span", "reply-problem", ` The issue could not be reopened: ${failed(failure)}`)); }
    }), " ", button("leave-closed", "Leave closed", () => offer.remove()));
    item.append(offer);
  }
  if (noted) { item.append(el("p", "reply-noted", "A reply, or the decision not to answer, is noted in the issue.")); return item; }
  if (replyAddress(mail) === null) item.append(el("p", "reply-not-sendable", "not sendable: the mail has no usable reply address."));
  else if (draft) item.append(draftBlock(box, mail, draft, ctx));
  else {
    const asking = ctx.mode === "ask";
    const write = button(asking ? "ask-reporter" : "write-reply", asking ? "Ask the reporter" : "Write the reply myself", async () => {
      write.disabled = true;
      try {
        const [{ draft: stored, problem }] = await storeReplies(box, [{ mail, body: "" }]);
        if (problem) item.append(el("p", "reply-not-sendable", `${problem}.`));
        else { write.remove(); item.append(draftBlock(box, mail, stored, ctx)); }
      } catch (failure) {
        write.disabled = false;
        item.append(el("p", "reply-problem", `The draft could not be stored: ${failed(failure)}`));
      }
    });
    item.append(el("p", null, write));
    if (asking) {
      const question = button("draft-question", "Draft question", async () => {
        question.disabled = true;
        item.append(await draftingSection(due, extra.ctx, redraw, { question: true, entry }));
      });
      item.append(el("p", null, question));
    }
  }
  item.append(el("p", null, none()));
  return item;
}

// What the notes of an issue say of its mails: those added after the last question (new), and those added after the issue was closed (arrived).
async function arrivalsOf(host, due) {
  const found = (await host.listIssues({ state: "all" })).find((each) => each.number === due.issue);
  const notes = found ? notesOf({ number: found.number, body: found.body, comments: found.comments.map((comment) => ({ body: comment.body, createdAt: comment.date })) }) : [];
  const after = (kind) => notes.slice(notes.findLastIndex((note) => note.kind === kind) + 1).filter((note) => note.kind === "mail-added").map((note) => note.subject);
  const closed = notes.findLastIndex((note) => note.kind === "closed-with");
  return { fresh: new Set(notes.findLastIndex((note) => note.kind === "question-sent") < 0 ? [] : after("question-sent")),
    arrived: new Set(closed < 0 ? [] : after("closed-with")) };
}

// Draft replies: the participants the mailbox allows, the run panel and Run.
async function draftingSection(due, ctx, redraw, opts = {}) {
  const section = el("section", opts.question ? "question-drafting" : "reply-drafting", el("h3", null, opts.question ? "Draft question" : "Draft replies"), fold(opts.question ? STEP_TEXT.question : STEP_TEXT.drafting));
  const { context, connection, box, products } = ctx;
  try {
    const definition = await kindOf("draft-replies");
    const instanceHost = context.instance.host;
    const info = await instanceHost.repositoryInfo();
    const instanceSnapshot = await instanceHost.readSnapshot(info.defaultBranch);
    const register = await instanceSnapshot.read(REGISTER);
    const participants = register == null ? [] : participantsOf(readRegister(participantSchema(), REGISTER, register).document);
    const allowed = (connection.places ?? []).map((each) => each.place);
    const admitted = eligible(participants, { capabilities: definition.needs, places: [{ from: "the mailbox", allowed }] }).eligible;
    const host = products.get(due.product)?.host;
    const draftable = opts.question ? [opts.entry] : due.mails.filter((each) => each.mail && !each.noted && !each.draft && replyAddress(each.mail) !== null);
    if (draftable.length === 0 || !host) { section.append(el("p", "muted", "No mail of this issue is left to draft.")); return section; }
    if (admitted.length === 0) { section.append(el("p", "reply-no-participant", `No participant that can draft text works at a place this mailbox allows (${allowed.join(", ") || "none"}).`)); return section; }
    const radios = admitted.map((participant) => {
      const radio = el("input", "participant");
      radio.setAttribute("type", "radio");
      radio.setAttribute("name", "participant");
      radio.value = participant.name;
      const outside = (connection.places ?? []).find((each) => each.place === participant.place)?.outsideEu === true;
      const item = el("li", "reply-participant", el("label", null, radio, ` ${participant.name} `), el("span", "place", participant.place ?? "no processing place declared"),
        ...(outside ? [" ", el("span", "not-compliant", "outside the EU: not compliant with the GDPR and the EU AI Act")] : []));
      item.setAttribute("data-participant", participant.name);
      return { radio, item, participant };
    });
    const person = el("input", "person");
    person.setAttribute("placeholder", "Your name");
    const point = opts.question ? el("textarea", "question-point") : null;
    const stage = el("div", "reply-stage");

    async function refresh() {
      stage.replaceChildren();
      const chosen = radios.find((each) => each.radio.checked === true)?.participant;
      const name = String(person.value ?? "").trim();
      if (!chosen || !name || (point && String(point.value ?? "").trim() === "")) { stage.append(el("p", "muted", point ? "Write your point, choose a participant and enter your name to see the run panel." : "Choose a participant and enter your name to see the run panel.")); return; }
      try {
        const head = await host.readSnapshot((await host.repositoryInfo()).defaultBranch);
        const now = new Date();
        const id = newJobId(now, new Set(head.paths.map((path) => JOB_FILE.exec(path)?.[1]).filter(Boolean)));
        const agentM = { version: instanceSnapshot.commit ?? "unknown", commit: instanceSnapshot.commit ?? "unknown" };
        const params = { due: { ...due, mails: draftable }, host, mailbox: box, ...(point ? { question: String(point.value).trim() } : {}) };
        const jobContext = { kind: definition, params, product: { address: due.product, snapshot: head, host }, instance: { snapshot: instanceSnapshot, host: instanceHost, checkout: null },
          connect: async () => host, participants, places: { sources: {}, mailbox: allowed }, gates: [], person: name, now, agentM, jobId: id };
        const prepared = await prepareJob("draft-replies", jobContext, { drafter: chosen, reviewers: [] });
        const result = el("div", "reply-run-result");
        const panel = runPanel(prepared, { onRun: async () => {
          try {
            const record = { id, kind: "draft-replies", worksOn: [issueAddress(due)], participant: chosen.name, model: chosen.model, route: "tab", run: null, retries: null, startedBy: name, start: now, agentM,
              inputs: prepared.parts.map((part) => part.name), limit: prepared.limit, destinations: prepared.destinations.map((each) => ({ participant: each.participant.name, place: each.place, parts: each.parts })),
              params: { issue: due.issue, product: due.product } };
            const { path } = await queueJob(host, record, { kind: "tab" }, head.commit);
            const outcome = await runOnTab(prepared, jobContext, connectionsOf(chosen, context.store), { host, record: { ...record, path } });
            const notes = outcome.written?.notes ?? [];
            await redraw([el("p", "reply-drafted", "The replies are stored as drafts in the mailbox's Drafts folder. Nothing was sent."), ...notes.map((note) => el("p", "reply-note", note))]);
          } catch (failure) {
            result.replaceChildren(el("p", "reply-problem", `The replies could not be drafted: ${failed(failure)}`));
          }
        } });
        stage.append(panel, result);
      } catch (failure) {
        stage.append(el("p", "reply-problem", failed(failure)));
      }
    }
    for (const input of [...radios.map((each) => each.radio), person]) input.addEventListener("change", refresh);
    point?.addEventListener("input", refresh);
    section.append(...(point ? [el("p", null, el("label", null, "Your point to ask ", point))] : []), el("ul", "reply-participants", ...radios.map((each) => each.item)), el("label", null, "Your name ", person), stage);
  } catch (failure) {
    section.append(el("p", "reply-problem", failed(failure)));
  }
  return section;
}

function groupsOf(out, ctx) {
  const sections = GROUPS.map(([key, field, title]) => {
    const list = el("ul", "reply-issues", ...ctx.due[field].map((each) => {
      const item = el("li", "reply-issue", `#${each.issue} of ${ctx.products.get(each.product)?.name ?? each.product} · ${each.mails.length} mail${each.mails.length === 1 ? "" : "s"} · `,
        link(`#replies/issue=${each.issue}/product=${encodeURIComponent(each.product)}`, "issue-link", "Open"));
      item.setAttribute("data-issue", String(each.issue));
      item.querySelector?.("a")?.addEventListener("click", (event) => { event?.preventDefault?.(); ctx.context.go("replies", { issue: String(each.issue), product: each.product }); });
      return item;
    }));
    const section = el("section", "replies-group", el("h3", null, title), list);
    section.setAttribute("data-group", key);
    return section;
  });
  out.replaceChildren(el("section", "replies-step-groups", ...sections, fold(STEP_TEXT.groups)));
}

async function issueOf(out, ctx, params, redraw) {
  const due = GROUPS.flatMap(([, field]) => ctx.due[field]).find((each) => String(each.issue) === String(params.issue) && (!params.product || each.product === params.product));
  if (!due) { out.replaceChildren(el("p", "reply-problem", `Issue ${params.issue} is in none of the groups of the last reading.`)); return; }
  const group = GROUPS.find(([, field]) => ctx.due[field].includes(due))[0];
  const host = ctx.products.get(due.product)?.host;
  const { fresh, arrived } = host ? await arrivalsOf(host, due).catch(() => ({ fresh: new Set(), arrived: new Set() })) : { fresh: new Set(), arrived: new Set() };
  const list = el("ul", "reply-mails", ...due.mails.map((entry) => mailItem(entry, due, ctx.box, host, { group, arrived, fresh, redraw, ctx })));
  const controls = [];
  const act = (className, text, run) => {
    const node = button(className, text, async () => {
      node.disabled = true;
      try { await run(); await redraw(); } catch (failure) { node.disabled = false; out.append(el("p", "reply-problem", `${text}: ${failed(failure)}`)); }
    });
    return node;
  };
  if (group === "answer-received") controls.push(act("remove-label", "Remove the label", () => host.setIssueLabels(due.issue, { remove: [issueLabels.waitingForReporter] })), " ");
  if (group !== "to-answer") controls.push(act("close-and-reply", "Close and reply", () => host.setIssueState(due.issue, "closed")));
  out.replaceChildren(el("section", "replies-step-issue", el("h3", null, `Issue #${due.issue} of ${ctx.products.get(due.product)?.name ?? due.product}`),
    el("p", "reply-solved", `Solved by: ${due.closedBy ?? "not known"} · Release: ${due.release ?? "not known"}`), ...(controls.length ? [el("p", "reply-issue-controls", ...controls)] : []), list, fold(STEP_TEXT.issue)));
  if (group === "to-answer") out.append(await draftingSection(due, ctx, redraw));
}

async function render(target, context, params = {}) {
  const out = el("div", "replies-out");
  async function draw() {
    if (!last) { out.replaceChildren(el("p", "muted", "Read the replies first.")); return; }
    if (params.issue) await issueOf(out, { ...last, context }, params, redrawAfterDraft);
    else groupsOf(out, { ...last, context });
  }
  // After drafts were stored: the issues are read again, so that the new drafts show, and what came of the run stays above them.
  async function redrawAfterDraft(said = []) {
    last = { ...last, due: await repliesDue(last.box, [...last.products.values()].map((each) => ({ address: each.address, host: each.host }))) };
    await draw();
    out.append(...said);
  }
  const read = button("read-replies", "Read replies", async () => {
    out.replaceChildren(el("p", "muted", "Reading the issues and the mailbox…"));
    const products = productsOf(context.store);
    const have = mailboxOf(context.store);
    if (!have) { out.replaceChildren(el("p", "replies-problem", "No mailbox is connected in this browser. Connect one on the Settings page first.")); return; }
    try {
      const due = await repliesDue(have.box, [...products.values()].map((each) => ({ address: each.address, host: each.host })));
      last = { due, products, box: have.box, connection: have.connection };
    } catch (failure) {
      last = null;
      out.replaceChildren(el("p", "replies-problem", `The mailbox could not be read, so nothing was read: ${failed(failure)}`));
      return;
    }
    await draw();
  });
  target.replaceChildren(el("h2", null, "Replies"), el("section", "replies-step-read", el("p", null, read), fold(STEP_TEXT.read)), ...(params.issue ? [] : sendingNotice(context.store)), out);
  await draw();
}

// The mails the last reading found, with their people: what the subject of this route gives the prompt bar (the mails are kept in memory only, while shown).
const shownMails = () => (last ? GROUPS.flatMap(([, field]) => last.due[field]).flatMap((due) => due.mails).filter((entry) => entry.mail).map(({ mail }) => ({ mail,
  people: peopleIn({ addresses: [mail.from, ...(mail.replyTo ?? []), ...(mail.to ?? []), ...(mail.cc ?? [])], text: mail.text }) })) : []);
const subject = (params, context) => mailSubject({ key: "replies", title: "Replies", entries: shownMails, store: context.store });

export const route = { name: "replies", entry: "maintenance", title: "Replies", render, subject };
