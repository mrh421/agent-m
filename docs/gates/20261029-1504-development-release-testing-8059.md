---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: rejected
on:
  - d874dd11ce2e910e46b7666ed6a9828420ed8681
  - https://github.com/akmaier/agent-m/pull/1459
  - docs/backlog/ITM-1302-every-test-identifier-is-held-by-one-declaration.md
date: 2026-10-29 15:04 UTC
---
# Development → Release testing: ITM-1302, every test identifier is held by one declaration

**REGISTER**

## Reason

ITM-1302, pull request #1459 into `sprint/team1/119`, is returned on `d874dd11`, its head when this was decided.
- One pair is renumbered on the wrong side: TST-1225001 and 1225002. The item's rule did not foresee the counter-proof
  records, so the cause lies in my planning, not with the developer.
- Everything else holds, as listed below.

The Definition of Done is the default (SPEC.md:1869-1874).

1. **The open point: two counter-proof records name the identifiers that moved.**
   - `docs/tests/counter-proofs/TST-1225001.md` and `-002.md` record planted faults in `src/agent-processes/processes.mjs`
     at `9482a66b`, "MOD-agent-processes: write the prompt to the agent's standard input". They are the cases of
     `agent-processes-prompt-delivery`.
   - MOD-trace-pages (`src/trace-pages/tests.mjs:18`) and MOD-release-evidence (`src/release-evidence/audit.mjs:76`) find a
     test's counter-proof by its identifier, at `docs/tests/counter-proofs/<id>.md`.
   - On `d874dd11`, TST-1225001 and 002 are `site-frame-test-topics`' cases. So these records would be shown as theirs,
     and TST-1302001 and 002, the prompt-delivery cases, would be shown with none.
   - A record is written once and never changed (`A RECORD IS EVIDENCE, NOT A PROPOSAL`, SPEC.md:831-833). Its identifier
     therefore stays with the declaration it names, as THE NAME IS THE ID AND IT SURVIVES asks (SPEC.md:57-59).
   - **Ruling:** `agent-processes-prompt-delivery` keeps TST-1225001 and 002. `site-frame-test-topics` takes the two new
     identifiers in their place: its declarations, titles and every naming in its file. Item ITM-1302 now states this
     exception.
2. **The readings ruled.**
   - **"Added later", by the history, is right.** I checked each pair with `git log -S` on `sprint/team1/119`. The first
     commit naming the identifier in each file gives the developer's side in every pair, among them the five where the
     item's list order differed:
     - TST-1225001/2: `agent-processes-prompt-delivery`, `d7baab9b`, later than `ae6151ca`;
     - TST-472244: `identifiers-kind`, `82d13a72`, later than `ec47138b`;
     - TST-1300005: `implementation-pages-plan-stored-graph`, `e479fed2`, later than `bb26aa37`;
     - TST-472718: `job-ledger-append`, `9ab15a19`, later than `ec47138b`;
     - TST-472541: `repository-hosts-file-pages`, `9ab15a19`, later than `ec47138b`.
     - Only TST-1225001/2 changes side, by ruling 1.
   - **TST-1110001/2: one commit (`40508dc0`) adds both declarations,** so the history gives no order. Either side keeps
     the rule, and the list's order is a fair choice.
   - **`trace-graph-impacts`' TST-939001 `expect:` names "(TST-1300004)",** the case of `trace-graph-publish` that is now
     TST-1302015. The reference follows its case, in a file of MOD-trace-graph, one of the item's modules. It changes no
     expected result. Right.
3. **The rest, checked by me on `d874dd11`.**
   - CI: run 40896746394, `pull_request`, succeeds.
   - Only identifiers change. With every `TST-<digits>` set alike, the 25 removed lines equal the 25 added ones. 14 test
     files change, each named by one of the item's modules. No test is removed.
   - The 17 pairs go to TST-1302001 to 017, each named in the pull request with its commit.
   - A reader over every test file, fixtures and Markdown left out, finds 5,553 identifiers and none held twice. On
     `main` before, 17 were held twice.
   - MOD-test-document's reader: the 13 changed Node files give 0 findings. The known positive,
     `release-itm-1254-issue-move`, gives 4 and 0.
   - Every file of the pairs and every test naming one by its path, with `test-document-one-line`: 181 pass and 1 fail.
     The failure is TST-1281004, a Bridge case this machine cannot run, which fails without the change too. The Python
     checks `test_requirement_fields`, `test_references`, `test_test_battery` and `test_identifier_stability` are OK.

## The mend

- One commit on #1459's branch, with no force-push. In `agent-processes-prompt-delivery` TST-1302001/2 go back to
  TST-1225001/2, and in `site-frame-test-topics` TST-1225001/2 become TST-1302001/2.
- The pull request names the swap.
- The duplicate scan and the reader are run again on the new head.
