// An issue's mail list, handling-note text and the decisions that leave identifiers out of a proposal.
// Module: MOD-mail-records

const identifierPattern = "MAIL-[0-9a-fA-F]{16}";
const wholeIdentifier = new RegExp(`^${identifierPattern}$`);
const wholeItemIdentifier = /^ITM-\d{3,}$/;
const listedIdentifier = new RegExp("`(" + identifierPattern + ")`", "g");
const addedMail = new RegExp("^Mail `(" + identifierPattern + ")` added on \\d{4}-\\d{2}-\\d{2}\\.$");

/**
 * @param {string} text
 * @param {string[]} ids
 * @returns {string}
 */
export function withMailIds(text, ids) {
  if (ids.some((id) => wholeIdentifier.exec(id)?.[0] !== id)) {
    throw Object.assign(new Error("Use MAIL- followed by sixteen hexadecimal digits."), { name: "NotAnIdentifier" });
  }
  return `${text}\n\nMails: ${ids.map((id) => `\`${id}\``).join(", ")}`;
}

/**
 * @param {"mail-added" | "reply-sent" | "question-sent" | "no-reply" | "item-added" | "closed-with"} kind
 * @param {string | null} subject  null (or "") only for "closed-with" of a bug fix, which has no item
 * @param {string} date
 * @param {string} [link]
 * @returns {string}
 */
export function noteText(kind, subject, date, link) {
  if (kind === "closed-with" && (subject === null || subject === "")) return `Closed with ${link}.`;
  const identifier = kind === "item-added" || kind === "closed-with" ? wholeItemIdentifier : wholeIdentifier;
  if (identifier.exec(subject)?.[0] !== subject) {
    throw Object.assign(new Error("Use a mail or item identifier for this note."), { name: "NotAnIdentifier" });
  }
  switch (kind) {
    case "mail-added": return `Mail \`${subject}\` added on ${date}.`;
    case "reply-sent": return `Reply sent to \`${subject}\` on ${date}.`;
    case "question-sent": return `Question sent to \`${subject}\` on ${date}.`;
    case "no-reply": return `No reply to \`${subject}\`, decided on ${date}.`;
    case "item-added": return `Backlog item \`${subject}\` added: ${link}`;
    case "closed-with": return `Closed with ${link}; item \`${subject}\`.`;
  }
}

/**
 * @param {{number: number, body: string, comments: {body: string, createdAt: string}[]}} issue
 * @returns {string[]}
 */
export function listedMailIds(issue) {
  const ids = new Set();
  const line = issue.body.match(/^Mails: (.+)$/m)?.[1] ?? "";
  for (const match of line.matchAll(listedIdentifier)) ids.add(match[1]);
  for (const comment of issue.comments) {
    const match = addedMail.exec(comment.body);
    if (match) ids.add(match[1]);
  }
  return [...ids];
}

/**
 * @param {string[]} ids
 * @param {Set<string>} listed
 * @param {Set<string>} marked
 * @returns {string[]}
 */
export function undecided(ids, listed, marked) {
  return ids.filter((id) => !listed.has(id) && !marked.has(id));
}

const mailNotes = [
  ["mail-added", new RegExp("^Mail `(" + identifierPattern + ")` added on (\\d{4}-\\d{2}-\\d{2})\\.$")],
  ["reply-sent", new RegExp("^Reply sent to `(" + identifierPattern + ")` on (\\d{4}-\\d{2}-\\d{2})\\.$")],
  ["question-sent", new RegExp("^Question sent to `(" + identifierPattern + ")` on (\\d{4}-\\d{2}-\\d{2})\\.$")],
  ["no-reply", new RegExp("^No reply to `(" + identifierPattern + ")`, decided on (\\d{4}-\\d{2}-\\d{2})\\.$")],
];
const itemAdded = /^Backlog item `(ITM-\d{3,})` added: \S.*$/;
const closedWith = /^Closed with \S.*?(?:; item `(ITM-\d{3,})`)?\.$/;

/**
 * The texts of item-added and closed-with carry no date; their note takes the date of the comment's createdAt.
 * A closed-with text without an item names none; its subject is then the empty string.
 * @param {{number: number, body: string, comments: {body: string, createdAt: string}[]}} issue
 * @returns {{kind: "mail-added" | "reply-sent" | "question-sent" | "no-reply" | "item-added" | "closed-with", subject: string, date: string}[]}
 */
export function notesOf(issue) {
  const notes = [];
  for (const comment of issue.comments) {
    const created = comment.createdAt.slice(0, 10);
    let found = null;
    for (const [kind, pattern] of mailNotes) {
      const match = pattern.exec(comment.body);
      if (match) { found = { kind, subject: match[1], date: match[2] }; break; }
    }
    const item = itemAdded.exec(comment.body);
    if (!found && item) found = { kind: "item-added", subject: item[1], date: created };
    const closed = closedWith.exec(comment.body);
    if (!found && closed) found = { kind: "closed-with", subject: closed[1] ?? "", date: created };
    if (found) notes.push(found);
  }
  return notes;
}

export const issueLabels = Object.freeze({
  defect: "defect",
  change: "change",
  notReproducible: "not-reproducible",
  waitingForReporter: "waiting-for-reporter",
  backlog: "backlog",
});
