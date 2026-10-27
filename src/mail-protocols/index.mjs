import { createRequire } from "node:module";
import { OWN_DRAFT_MARK, connectionParts, testImap, readMails, findMail, markedFolder, storeDraft, showDraft, sendDraft } from "./imap.mjs";
import { testSmtp, sendBytes } from "./smtp.mjs";
import { confirm, spend } from "./confirmations.mjs";

const requireBridgePackage = createRequire(new URL("../bridge-build/package.json", import.meta.url));
const { ImapFlow } = requireBridgePackage("imapflow");
const nodemailer = requireBridgePackage("nodemailer");

// UC-037 7d: a refused or failed SMTP step is the answer's `sending`, beside the reading; `no-encryption` still fails the
// test, since no login was sent (THE MAIL SERVER IS REACHED ONLY OVER TLS).
const SENDING_ANSWERS = new Set(["login-refused", "upstream-failed"]);

async function sendingResult(parts, mailer) {
  try {
    await testSmtp(parts, mailer);
    return "works";
  } catch (error) {
    if (SENDING_ANSWERS.has(error?.code)) return error.message;
    throw error;
  }
}

async function testMailbox(connection, libraries) {
  const parts = connectionParts(connection);
  const imap = await testImap(parts, libraries.ImapFlow);
  const sending = await sendingResult(parts, libraries.nodemailer);
  return { counts: imap.counts, drafts: imap.drafts, sent: imap.sent, sending, route: "imap", encryption: imap.encryption };
}

// The reply as one message: threaded on the reporter's Message-ID, addressed to the reporter only.
async function replyBytes({ account }, mailer, { replyTo, to, subject, body }) {
  const built = await mailer.createTransport({ streamTransport: true, buffer: true, newline: "windows" }).sendMail({
    from: account,
    to: { name: to.name ?? "", address: to.address },
    subject,
    text: body,
    headers: { [OWN_DRAFT_MARK]: "1" },
    inReplyTo: replyTo.messageId,
    references: [...replyTo.references, replyTo.messageId],
  });
  return built.message;
}

const shownMail = ({ sha256, mail }, ref) => ({
  ref, sha256, from: mail.from, to: mail.to, cc: mail.cc, subject: mail.subject, body: mail.text,
  attachments: mail.attachments.map(({ name, type, size }) => ({ name, type, size })),
});

export function mailHandlers(libraries = {}) {
  const resolved = { ImapFlow, nodemailer, ...libraries };
  return {
    "POST /v1/mail/test": async ({ body }) => testMailbox(body?.connection, resolved),
    "POST /v1/mail/read": async ({ body }) => readMails(connectionParts(body?.connection), resolved.ImapFlow, body?.args?.since ?? null),
    "POST /v1/mail/find": async ({ body }) => findMail(connectionParts(body?.connection), resolved.ImapFlow, body?.args?.id),
    "POST /v1/mail/drafts": async ({ body }) => (await markedFolder(connectionParts(body?.connection), resolved.ImapFlow, "\\Drafts", null))
      .map(({ uid, uidValidity, mail }) => ({ ref: { route: "bridge", uid, uidValidity }, inReplyTo: mail.inReplyTo, mail })),
    "POST /v1/mail/sent": async ({ body }) => (await markedFolder(connectionParts(body?.connection), resolved.ImapFlow, "\\Sent", body?.args?.since ?? null))
      .map(({ mail }) => mail),
    "POST /v1/mail/store-draft": async ({ body }) => {
      const parts = connectionParts(body?.connection);
      return storeDraft(parts, resolved.ImapFlow, await replyBytes(parts, resolved.nodemailer, body?.args?.draft));
    },
    "POST /v1/mail/update-draft": async ({ body }) => {
      const parts = connectionParts(body?.connection);
      return storeDraft(parts, resolved.ImapFlow, await replyBytes(parts, resolved.nodemailer, body?.args?.draft), body?.args?.ref);
    },
    "POST /v1/mail/show-draft": async ({ body }) => shownMail(await showDraft(connectionParts(body?.connection), resolved.ImapFlow, body?.args?.ref), body?.args?.ref),
    "POST /v1/mail/confirm-send": async ({ body }) => confirm(body?.args?.ref, body?.args?.sha256),
    "POST /v1/mail/send": async ({ body }) => {
      const parts = connectionParts(body?.connection);
      const { ref, sha256 } = spend(body?.args?.confirmation);
      await sendDraft(parts, resolved.ImapFlow, ref, sha256, (bytes, recipients) => sendBytes(parts, resolved.nodemailer, bytes, recipients));
      return { sentAt: new Date().toISOString() };
    },
  };
}
