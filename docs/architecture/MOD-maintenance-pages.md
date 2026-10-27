---
id: MOD-maintenance-pages
title: The pages of issues and mail
folder: src/maintenance-pages/
realises:
follows:
  - ARC-038
uses:
  - MOD-site-frame.View
  - MOD-site-frame.chosenProduct
  - MOD-site-frame.explain
  - MOD-site-frame.notice
  - MOD-site-frame.runPanel
  - MOD-site-frame.confirmDecision
  - MOD-site-frame.schemaForm
  - MOD-markdown-render.renderArtifact
  - MOD-markdown-render.openEditor
  - MOD-browser-store.readSetting
  - MOD-bridge-client.bridgeAt
  - MOD-repository-hosts.parseAddress
  - MOD-repository-hosts.connect
  - MOD-repository-hosts.readSnapshot
  - MOD-repository-hosts.repositoryInfo
  - MOD-repository-hosts.listIssues
  - MOD-repository-hosts.setIssueState
  - MOD-repository-hosts.setIssueLabels
  - MOD-repository-hosts.commentOnIssue
  - MOD-repository-hosts.webLinks
  - MOD-repository-hosts.pullRequestFacts
  - MOD-documents.artifactSchemas
  - MOD-documents.readRegister
  - MOD-documents.readDocument
  - MOD-test-document.isTestFile
  - MOD-test-document.testDeclarations
  - MOD-resource-list.resourceSchema
  - MOD-resource-list.reachableBy
  - MOD-mail-routes.mailbox
  - MOD-mail-routes.signIn
  - MOD-mail-records.listedMailIds
  - MOD-mail-records.notesOf
  - MOD-mail-records.noteText
  - MOD-personal-data.peopleIn
  - MOD-personal-data.personHits
  - MOD-personal-data.checkersFor
  - MOD-personal-data.pseudonymisationOf
  - MOD-personal-data.settingsSchemas
  - MOD-personal-data.privacyStrategies
  - MOD-mail-handling.readNewMail
  - MOD-mail-handling.decideMail
  - MOD-mail-handling.repliesDue
  - MOD-mail-handling.storeReplies
  - MOD-mail-handling.sendReply
  - MOD-mail-handling.askReporter
  - MOD-mail-handling.noReply
  - MOD-mail-handling.mailStrategies
  - MOD-issue-handling.confirmClass
  - MOD-issue-handling.backlogItemFrom
  - MOD-issue-handling.moveToBacklog
  - MOD-issue-handling.closeWithLinks
  - MOD-issue-handling.issueStrategies
  - MOD-work-plans.backlogFindings
  - MOD-spec-changes.queues
  - MOD-spec-changes.entryView
  - MOD-spec-changes.specStrategies
  - MOD-source-register.sourceSchemas
  - MOD-source-register.personSource
  - MOD-source-register.personAccount
  - MOD-participant-list.participantSchema
  - MOD-participant-list.eligible
  - MOD-participant-list.participantsOf
  - MOD-job-catalogue.kindOf
  - MOD-job-runner.prepareJob
  - MOD-job-runner.writeResult
  - MOD-job-ledger.newJobId
  - MOD-job-ledger.recordsNewestFirst
  - MOD-runtimes.routesFor
  - MOD-runtimes.queueJob
  - MOD-runtimes.runOnTab
  - MOD-runtimes.liveState
  - MOD-runtimes.jobTrail
  - MOD-runtimes.routeStrategies
  - MOD-prompt-bar.Subject
provides:
  - view
---
# MOD-maintenance-pages The pages of issues and mail

## Responsibility

It belongs to the Site (ARC-038). Its one responsibility is the menu entry Maintenance: a product's issues — their
analysis as bug, change or not reproducible, the confirmed class, the fix, the change through the SPEC, the move into the
backlog —; mail read into issues; and the replies to the mails of an issue, with the questions to reporters. Everything a
mail contains stays in the mailbox and on this page; what is written to an issue passes Issues and mail's search for the
mail's people first, and every outgoing mail is sent only on the person's click on the complete mail shown.

It serves UC-012, UC-033, UC-038 and UC-039, and gives the prompt bar the subject of its pages (UC-049).

It runs in a browser, loaded by `docs/index.html` through MOD-site-frame.

## Parts

- `index.mjs` — the interface: `view`.
- `issues.mjs` — issues, their analysis, class, fix, change and move into the backlog.
- `mail.mjs` — reading mail into issues.
- `replies.mjs` — replies to answer, answers received, drafts, sending, asking a reporter.

## Data

It keeps nothing but the screen, a mail's text only while it is shown, and the drafted change of an issue while the
person reviews it. Its formats are those of the modules it uses.

## Interfaces

- `view: View` — its routes, and the strategies its kinds use in the tab — `issueStrategies`, `mailStrategies`,
  `privacyStrategies`, `specStrategies`, `routeStrategies`:
  - `issues`, `issue/<number>` — the product's issues; *Analyse* with its run panel and the class proposed with its
    reasoning; the class confirmed or corrected, or the issue rejected with a reason, with `confirmClass`; for a bug, the
    fixing participant — one that can run tests — and its run panel, the job queued on its route; and, before its pull request is merged, for each existing test whose expected result the fix changes, the requirement it now checks correctly with the old and the new expectation side by side (UC-012 5a); for a change, the
    change of requirements drafted against the existing ones with the issue as its origin, run attended, its candidates
    shown by class beside the requirements they refer to and every conflict decided by the person, then *Save*, which
    writes them as a change queue naming the issue — the job of `change-requirements` given the issue's number as its
    parameter `issue` and the person's own source as its parameter `source`, which `personSource` names for
    `personAccount`'s account among the product's links and the instance's register, or, without one, the steps its
    precondition names —; *Move to backlog* with the item prefilled — its fields checked in a
    form while the person edits them —; *Add*, which writes the item and the issue's comment and label with
    `moveToBacklog`, or names the comment to copy
    when the token may not comment; closing an issue with links once its pull request is merged.
  - `mail` — *Read mailbox*; the mails no issue lists and nobody marked *not an issue*, with sender, subject and date in
    this browser only; the participant for the proposals among those at places the mailbox allows, a place outside the
    EU named as not compliant, and the three checkers; the run panel and *Propose*; per mail, the mail in full beside the
    proposal, its text editable, every hit of the mail's people marked; *Create issue* — only without a hit —, *Add to
    #n*, *Not an issue*.
  - `replies`, `replies/<issue>` — closed issues with mails to answer, answers received, open issues; an issue with what
    solved it and each listed mail found in the mailbox with its draft; *Draft replies* with its run panel, or a reply
    written without a participant; each draft complete — recipient, subject, body, attachments — and editable; *Send* with
    its confirmation repeating recipient and subject; a reply sent but not noted, its note offered again; *No reply*; *Ask
    the reporter* — a question drafted with *Draft question*, the run panel of `draft-replies` with the person's point as
    its parameter `question`, or written by hand — and *Send and wait*; removing the label `waiting-for-reporter`; *Reopen* and *Leave closed* for a mail
    that arrived in a closed issue's thread; *Close and reply*. Where the mailbox's last test (`last-test:mailbox`)
    recorded a `sending` other than `"works"` — present, and naming why sending does not work —, the page says so, with
    that reason, beside *Send* and *Send and wait*, and offers both as before (UC-037 7d); a record without `sending`
    says nothing about sending.

  Each route gives the prompt bar its subject (UC-049 3b): on a route that shows mail, the
  page a participant is given holds the text of a mail, its sender and its attachments only for a participant whose
  processing place the mailbox allows and that does not declare *write to the repository* (`THE PLACES A MAILBOX'S MAIL
  MAY GO ARE CONFIGURED`, `A PARTICIPANT THAT WRITES TO A REPOSITORY NEVER RECEIVES A MAIL`), and only the mail's `MAIL-`
  identifier for any other; its `refuses` names `propose-edit` and `hand-over`, so that nothing of a mail reaches a file
  or a participant that writes; and its `withhold` names, for a message to be recorded, each name, mail address, phone
  number or account of that mail's people found in it, with `personHits`, and a passage of the mail's own text (`NO
  PERSONAL DATA FROM A MAIL ENTERS A REPOSITORY`, `MAIL STAYS IN THE MAILBOX`). The issues' routes give the issue as the page.

## Files

It writes nothing in a repository itself: every decision is one call of Issues and mail, of the writer of a kind
through MOD-job-runner, or of the host — an issue's state, its labels, a note offered again. It writes a job's start
record through MOD-runtimes. It reads the product's issues, snapshot, resources and links, the mailbox through its route, and the
instance's participants and source register.

## Uses

- MOD-site-frame.View, MOD-site-frame.chosenProduct, MOD-site-frame.explain, MOD-site-frame.notice,
  MOD-site-frame.runPanel, MOD-site-frame.confirmDecision, MOD-site-frame.schemaForm — the frame's parts, the run panels,
  the dialog of every send, and the form of a backlog item.
- MOD-markdown-render.renderArtifact, MOD-markdown-render.openEditor — issues, mails and drafts, and their editing.
- MOD-prompt-bar.Subject — the subject its routes give the prompt bar.
- MOD-browser-store.readSetting — the mailbox connection and its last test, the endpoints' configurations and the
  Bridges' settings;
  MOD-bridge-client.bridgeAt — a handle for each Bridge, handed to the runtimes.
- MOD-repository-hosts.parseAddress, MOD-repository-hosts.connect — the hosts of the instance's products, whose issues a
  mail may concern; MOD-repository-hosts.readSnapshot, MOD-repository-hosts.repositoryInfo,
  MOD-repository-hosts.listIssues — issues and what a job's context needs; MOD-repository-hosts.setIssueState —
  *Close and reply*, *Reopen*; MOD-repository-hosts.setIssueLabels — the label `waiting-for-reporter` removed;
  MOD-repository-hosts.commentOnIssue — a note offered again; MOD-repository-hosts.webLinks — an issue's page.
- MOD-job-ledger.recordsNewestFirst, MOD-runtimes.jobTrail — an issue's fix: the newest `fix-bug` job whose `works_on`
  names the issue, and the pull request of its branch, which the job's trail gives; the same link serves *closing an
  issue with links once its pull request is merged*. MOD-repository-hosts.pullRequestFacts — that pull request before it
  is merged, with the texts of its changed files on both sides; MOD-test-document.isTestFile,
  MOD-test-document.testDeclarations — the existing tests among those files, and each one's requirement and expected
  result, old and new, side by side (UC-012 5a).
- MOD-documents.artifactSchemas — the item's schema for its form; MOD-documents.readRegister — the participant list
  and the product's resources; MOD-documents.readDocument — the product's `docs/settings.md`, with `settingsSchemas`;
  MOD-resource-list.resourceSchema, MOD-resource-list.reachableBy — the routes that reach the product's resources, for
  the route of `fix-bug`.
- MOD-mail-routes.mailbox, MOD-mail-routes.signIn — the mailbox, and signing in again when the provider's sign-in has
  expired.
- MOD-mail-records.listedMailIds, MOD-mail-records.notesOf, MOD-mail-records.noteText — an issue's mails, its notes, and
  the text of a note offered again.
- MOD-personal-data.peopleIn — the people of a mail `repliesDue` gives, which carries none;
  MOD-personal-data.personHits, MOD-personal-data.checkersFor, MOD-personal-data.pseudonymisationOf — the hits of the
  mail's people, the three checkers, and whether the product rewrites report data; MOD-personal-data.settingsSchemas —
  the schema `docs/settings.md` is read with, for `pseudonymisationOf`.
- MOD-mail-handling.readNewMail, MOD-mail-handling.decideMail, MOD-mail-handling.repliesDue,
  MOD-mail-handling.storeReplies, MOD-mail-handling.sendReply, MOD-mail-handling.askReporter,
  MOD-mail-handling.noReply — every decision on a mail and a reply.
- MOD-issue-handling.confirmClass, MOD-issue-handling.backlogItemFrom, MOD-issue-handling.moveToBacklog,
  MOD-issue-handling.closeWithLinks — every decision on an issue.
- MOD-work-plans.backlogFindings — the item's marks while the person edits it; MOD-spec-changes.queues — the change's
  queues, those whose `issue` names the number of the issue shown and the address of the product the frame has chosen;
  MOD-spec-changes.entryView — the requirements each of their entries changes or adds, its `impact`, given to
  `backlogItemFrom` as `changed`, since an entry's anchor is the heading of a whole section, not a requirement's name.
- MOD-source-register.sourceSchemas, MOD-source-register.personSource, MOD-source-register.personAccount — the product's
  links file and the instance's register, and in them the person's own source, the parameter `source` of a change.
- MOD-participant-list.participantSchema, MOD-participant-list.participantsOf, MOD-participant-list.eligible — the
  participants of the register, and who may analyse, fix, propose, rewrite, check or draft.
- MOD-job-catalogue.kindOf, MOD-job-runner.prepareJob — the run panels; MOD-job-runner.writeResult — the drafted change
  written on the person's click; MOD-job-ledger.newJobId, MOD-runtimes.routesFor, MOD-runtimes.queueJob,
  MOD-runtimes.runOnTab, MOD-runtimes.liveState — running the kinds of this page on their routes.
- MOD-issue-handling.issueStrategies, MOD-mail-handling.mailStrategies, MOD-personal-data.privacyStrategies,
  MOD-spec-changes.specStrategies, MOD-runtimes.routeStrategies — the strategies of its kinds, handed to the frame.
