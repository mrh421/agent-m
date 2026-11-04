---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - f4102347b8a37ab95a76becd8bbaffc29b5ef8f7
  - https://github.com/akmaier/agent-m/pull/1492
date: 2026-10-30 04:28 UTC
---
# Development → Release testing: ITM-1111, the replies page's Open goes through the frame

**REGISTER**

## Reason

ITM-1111, pull request #1492 into `sprint/team1/124`, passes on `f4102347`, its head when this was decided.

The condition is "CI is green on it and the Definition of Done holds" (`docs/process-models/scrum-wip.md:53`). The
Definition of Done is the default (SPEC.md:1869-1874).

1. **CI.**
   - **Tests-only commit `2b9d3aac`:** run 41002332421 fails, only in `tests/maintenance-pages-replies.test.mjs`. It fails
     on the three cases the item names: TST-966001, TST-1108001 and TST-1111001. That is the item's reason: the page still
     draws an `<a href="#replies/…">`.
   - **Head:** run 41002459963 (`pull_request`, attempt 1) succeeds.
2. **Only the item's files change:**
   - `src/maintenance-pages/replies.mjs`. *Open* is a `<button type="button" class="issue-link btn small">` whose click
     calls `ctx.context.go("replies", { issue, product })`. The hand-written address and the helper `link`, which nothing
     else used, go.
   - `tests/maintenance-pages-replies.test.mjs`, the test the item's planning run named.
   - Both are MOD-maintenance-pages'. MOD-site-frame, which the item also names, changes no code, as the planning run
     said.
3. **No expectation is weakened.**
   - TST-966001 asserted that the first issue link's `href` begins with `#replies`. It now asserts that each of the three
     issues' *Open* is a button of type `button`. That checks every issue, not the first.
   - TST-1108001 asserted that each link is `fragmentOf("replies", …)` and that following it shows the issue. It now
     clicks each *Open* and asserts the calls of `go`, in order. It then draws the route with the parameters `go` was
     given, and finds issue #5 of `alice/product`. The route and its parameters are still checked; only the frame writes
     the address now.
   - TST-1111001 is new, and is the Acceptance's "a hand-written address fails it".
4. **It builds the item's Acceptance and nothing beyond it.**
   - "*Open* … goes to `replies` with `issue` and `product` through `go`": TST-1108001.
   - "The page's text holds no address `#replies/…`": TST-1111001, over the drawn groups, the drawn issue and the module's
     source.
   - "The control keeps an accessible name": its text, *Open*, asserted in TST-1108001 and TST-1111001.
   - `go` is a member of `ViewContext` (MOD-site-frame.md:187), which the route is given. No interface changes.
5. **The pull request's three readings are right.**
   - The name is the button's text, as `waitsList`'s *Open* on the main page has it. A button's text is its accessible name
     under THE SITE SERVES A SCREEN READER (SPEC.md:967-972), so no `aria-label` is needed.
   - "The page's text" is read as both what is drawn and the source file. That is stricter than either alone. Each half
     has its own planted counter-proof in the test.
   - The click is a plain `click` listener. It only navigates and writes nothing, so THE DASHBOARD WRITES ONLY ON A
     PERSON'S CLICK (SPEC.md:1022-1025) does not reach it. The person's-click listener of `replies.mjs:59-65` guards the
     page's writes.
6. **Counter-proofs.**
   - On the head, I planted the old form again: *Open* as `<a class="issue-link" href="#replies/issue=…">`. The file then
     gives 9 pass and 3 fail. Restored, it gives 12 of 12.
   - TST-1111001's planted element and source line are found by its own search, its known positive.
7. **MOD-test-document's reader:**
   - `tests/maintenance-pages-replies.test.mjs` gives 12 declarations, 0 findings. Its header gives MOD-maintenance-pages,
     level `unit`, and no finding.
   - The control, `tests/release-itm-1254-issue-move.test.mjs`, gives 4 declarations, 0 findings.
   - The `given`, `input` and `expect` of each changed or new declaration, as the reader reads them:
     - **TST-966001** —
       - given: "a closed issue listing four mails none of which has a note, an issue labelled waiting-for-reporter with
         a newer mail, an open issue, and a closed issue whose one mail has a reply note";
       - input: "the route replies drawn; the person's click on Read replies";
       - expect: "drawing reads and writes nothing; the groups are drawn: to answer holds issue 4 alone (the answered
         issue 7 is in none), answer received holds 5, open holds 6; each issue has its Open, a <button type="button"> of
         the class issue-link and no link; GitHub received no write".
     - **TST-1108001** —
       - given: "the replies read: the issues 4, 5 and 6 of alice/product listed in their groups";
       - input: "the Open of each issue clicked; the route replies drawn with the parameters the click gave to go for issue
         5";
       - expect: "each Open is a button with a text as its accessible name and calls go once with the route "replies" and
         the parameters issue (the number as a string) and product alice/product, in the order clicked; drawn with the
         parameters of issue 5, the page shows issue #5 of that product".
     - **TST-1111001** —
       - given: "the replies read and the route of issue 4 drawn; the source text of the page; a planted hand-written
         address in an element and in a source line";
       - input: "every element of both pages and the page's source text searched for an address #replies/…";
       - expect: "no element of the groups or of the issue carries such an href and the page's source text writes none;
         the same search finds the planted <a href="#replies/issue=9"> and the planted source line (counter-proof); each
         Open has a text as its name".
8. **Locally on the head:** the file and `tests/test-document-one-line.test.mjs` give 14 pass, 0 fail. My planning run of
   the same change, over 89 files, found no case that fails only with it beyond the two of this file it changes.
9. **Reads:** none change. The click calls `go`, which reads nothing of the repository itself.

## Noted

- The pull request's description names no runs. The runs are those above.
- TST-1111001 reads `src/maintenance-pages/replies.mjs` by its path. That is a code file, not the SPEC, a use case or an
  architecture file, so A TEST DOES NOT TAKE ITS EXPECTED RESULT FROM A DOCUMENT (SPEC.md:1515-1520) does not list it.
