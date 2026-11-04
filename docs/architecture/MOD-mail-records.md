---
id: MOD-mail-records
title: Mail identifiers and the marks of a mail's handling in its issue
folder: src/mail-records/
realises:
follows:
  - ARC-044
uses:
  - MOD-text-tools.sha256
provides:
  - mailId
  - listedMailIds
  - withMailIds
  - noteText
  - notesOf
  - threadMatch
  - undecided
  - issueLabels
  - IssueText
  - Note
---
# MOD-mail-records Mail identifiers and the marks of a mail's handling in its issue

## Responsibility

It belongs to Issues and mail (ARC-044). It defines how a mail is named without naming anyone, and how an issue records
the handling of its mails — which mails it lists, which were answered, which question waits — so that the issue tracker
is the only record of a mail's handling (`THE ISSUE IS THE ONLY RECORD OF A MAIL'S HANDLING`). It consists of pure
functions over texts and runs in the browser and in Node: the page and the Bridge name and find mails by the same
identifier.

## Parts

- `index.mjs` — the interface.
- `identifier.mjs` — the identifier of a mail.
- `issue-marks.mjs` — the list of an issue's mails, the notes in its comments, the labels.
- `threads.mjs` — matching a mail to the thread of a listed mail.

## Data

It keeps nothing. It owns these formats:

**The mail identifier** (`A MAIL IS NAMED BY A PSEUDONYMOUS IDENTIFIER`). `MAIL-` followed by the first sixteen
lower-case hexadecimal digits of the SHA-256 of the mail's `Message-ID` — the value between its angle brackets, UTF-8
encoded — or, for a mail without a `Message-ID`, of the mail's complete bytes as the mailbox delivers them. Two readings
of the same mail give the same identifier; the identifier names no person. Example: `MAIL-3f2a9c0e1b7d4a56`.

**The list of an issue's mails** (`AN ISSUE FROM A MAIL NAMES ITS MAILS BY THEIR IDENTIFIERS`). An issue created from
mail ends its text with one line:

```markdown
Mails: `MAIL-3f2a9c0e1b7d4a56`, `MAIL-9b0c1d2e3f405162`
```

A mail added to an issue later is listed by a comment of its own — the issue's text is never rewritten:

```markdown
Mail `MAIL-77aa01b2c3d4e5f6` added on YYYY-MM-DD.
```

The mails an issue lists are those of its text's `Mails:` line and of its `added` comments.

**The notes** — the comments Agent M writes on an issue, each naming an identifier and a date and nothing of a mail's
text, sender or recipient (`A SENT REPLY IS NOTED IN THE ISSUE`):

| Kind | Text |
|---|---|
| `mail-added` | ``Mail `MAIL-…` added on YYYY-MM-DD.`` |
| `reply-sent` | ``Reply sent to `MAIL-…` on YYYY-MM-DD.`` |
| `question-sent` | ``Question sent to `MAIL-…` on YYYY-MM-DD.`` |
| `no-reply` | ``No reply to `MAIL-…`, decided on YYYY-MM-DD.`` |
| `item-added` | ``Backlog item `ITM-…` added: <the address of the item file in the product's repository>`` |
| `closed-with` | ``Closed with <the address of the pull request or commit>; item `ITM-…`.`` (the item part only where there is one) |

**The labels** Agent M sets on an issue: `defect` — a defect against the current SPEC, also an issue analysed as a bug
(`AN ISSUE FROM A MAIL IS A DEFECT OR A CHANGE`); `change` — a request for changed behaviour; `not-reproducible`;
`waiting-for-reporter` (`AN ISSUE WAITING FOR A REPORTER IS LABELLED`); `backlog` — the issue has a backlog item.

## Interfaces

- `mailId(mail: { messageId: string | null, bytes: Uint8Array | null }) -> Promise<string>` — the identifier of a mail,
  from its `Message-ID` when it has one, otherwise from its bytes. Errors: `NothingToName` when both are missing — the
  caller reads the mail's bytes and asks again.
- `IssueText` — `{ number: number, body: string, comments: { body: string, createdAt: string }[] }`: an issue as these
  functions read it.
- `listedMailIds(issue: IssueText) -> string[]` — the identifiers the issue lists, from its `Mails:` line and its `added`
  comments, each once, in the order they were listed.
- `withMailIds(text: string, ids: string[]) -> string` — the text of a new issue, ending with the `Mails:` line. Errors:
  `NotAnIdentifier` for an id that is not of the form `MAIL-` plus sixteen hexadecimal digits.
- `noteText(kind: "mail-added" | "reply-sent" | "question-sent" | "no-reply" | "item-added" | "closed-with", subject:
  string, date: string, link?: string) -> string` — the comment of that kind; `subject` is a mail or item identifier,
  `date` a calendar date `YYYY-MM-DD`, `link` an address where the kind names one. Errors: `NotAnIdentifier`.
- `Note` — `{ kind: "mail-added" | "reply-sent" | "question-sent" | "no-reply" | "item-added" | "closed-with", subject:
  string, date: string }`.
- `notesOf(issue: IssueText) -> Note[]` — the notes among an issue's comments; a comment in no form of the table is not a
  note and is left out.
- `threadMatch(mail: { inReplyTo: string | null, references: string[] }, listed: Map<string, number>) -> Promise<number |
  null>` — the number of the issue that lists a mail this mail answers: the identifiers of its `In-Reply-To` and
  `References` are derived as `mailId` derives them and looked up in `listed` (identifier → issue number). Decided
  without a model (`A MAIL IN A KNOWN THREAD IS MATCHED WITHOUT A MODEL`); `null` when none matches.
- `undecided(ids: string[], listed: Set<string>, marked: Set<string>) -> string[]` — the identifiers neither an issue
  lists nor this browser marked *not an issue* (`A MAIL ALREADY DECIDED IS NOT PROPOSED AGAIN`).
- `issueLabels` — the label names of the table above, as constants: `{ defect, change, notReproducible,
  waitingForReporter, backlog }`.

## Files

It reads and writes nothing itself. Its texts are written to issues by MOD-mail-handling and MOD-issue-handling through
Access; the marks *not an issue* are kept by Access in the browser (MOD-browser-store).

## Uses

- `MOD-text-tools.sha256` — the hash from which an identifier is cut.
