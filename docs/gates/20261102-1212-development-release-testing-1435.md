---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - 892e1cb2821431a9a9a1c1e09d7b695726ca9376
  - https://github.com/akmaier/agent-m/pull/1735
date: 2026-11-02 12:12 UTC
---
# Development → Release testing: ITM-1435, #1735

**REGISTER**

## Reason

ITM-1435 (a regular expression with a backquote hides no declaration) may go on. The pull request is #1735 into
`sprint/team1/142`, at `892e1cb28`. developer-sonnet-k wrote the tests-only commits `cf3ba40a1` and `8bb02578d` and the code
`892e1cb28` (`Agent-M-Participant` on each). I wrote none of it.
1. **The first commit holds only tests and is red for the item's reason.**
   - `cf3ba40a1` adds `tests/test-document-regex-backquote.test.mjs` (MOD-test-document). In run 41439794890 only that file
     fails.
   - The second tests-only commit `8bb02578d` came after a planted fault, an escape not skipped, failed no case. It makes
     TST-1435004 a single backquote and adds TST-1435005 for an escaped slash; the known positives are renumbered.
   - Its run 41440146867 was still running at this decision. Locally five of its seven cases fail and the two known
     positives pass. The Scrum Master confirms that the run is red in that file only before the merge.
2. **CI is green on the head:** run 41440241552 (`892e1cb28`), at the first attempt. No job failed or was cancelled.
   `git merge-tree` with the sprint branch's head is clean.
3. **Only the item's module changes:** `src/test-document/declarations.mjs`.
   - `commentDeclarations` (:124) read a line's backquote through `templateOpenAfter` (:104). In a line such as
     `const RE = /`/g;` it opened a template (:111) and skipped every later line (:131-134).
   - Now a `/` outside quotes and templates, which is neither `//` nor `/*` and follows a token that allows a regular
     expression, skips to its closing `/`, reading an escape and a `[...]` class as part of it. After a name, a number, `)`,
     `]` or `}` it divides, and so does one left open on its line.
4. **The Acceptance holds:**
   - A file with a regular-expression literal holding a backquote gives every declaration after it.
   - The eight counter-proofs each fail at least one case.
   - Over `tests/`, the declarations read go from 7148 to 7189: the 7 new ones, and 34 that a regular expression with a
     backquote had hidden. None is removed, changed, held twice, or found wanting. The 468 consumers' tests pass.

## Ruled

- **The 34 declarations found are the fix's intended effect, not moved expectations.** They are in
  `release-evidence-audit`, `source-register-chapters`, `source-register-hashed-only` and `workflow-entries-hand-over`.
  No asserted value changes, and each of them now reads with no finding.
- **A second tests-only commit instead of a force-push** stands: it keeps the first red run as the item's evidence.

## Readings taken

- The usual previous-token rule of JavaScript decides between a regular expression and a division, and `}` divides.
- A `/` left open on its line divides. The reader parses no further than the line, as its file says it is no JavaScript
  parser.
- `/*` is never a regular expression.

All are taken.
