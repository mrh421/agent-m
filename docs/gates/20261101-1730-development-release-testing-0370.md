---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - 6ef81b82477c9d0cf1802c61aa574b6aaa7d19ac
  - https://github.com/akmaier/agent-m/pull/1631
date: 2026-11-01 17:30 UTC
---
# Development → Release testing: ITM-370, #1631, the system and release tests of UC-004

**REGISTER**

## Reason

ITM-370 was written by developer-opus-f (`Agent-M-Participant` on `ec2fb9bc5`, `051447ca4` and `6eb591931`). No commit of
`src/source-register/`, `src/settings-pages/library.mjs` or `src/settings-pages/sources.mjs` carries that trailer; theirs
name developer-sonnet-a, sonnet-c, sonnet-d and sonnet-j. I wrote none of it.
1. **No failing first commit:** a battery adds no behaviour (141.md, *Readings taken*).
2. **CI is green on the head:** run 41293220790 (pull_request, `6ef81b824`), at the first attempt. The head is the Scrum
   Master's merge of the sprint branch, with #1634, onto `6eb591931`.
3. **Only new test files:**
   - `tests/uc-004-harness.mjs`;
   - `tests/system-uc-004-register-a-requirement-source.test.mjs`;
   - `tests/release-uc-004-register-a-requirement-source.test.mjs`.

   The system file runs over the existing GitHub fixture. For step 7 it uses the unchanged
   `tests/workflow-entries-sources.d/instance.mjs`, and it imports nothing of MOD-workflow-entries.
4. **MOD-test-document's reader:**
   - `testDeclarations` reads 14 system cases (TST-370201 to 370214) and 15 release cases (TST-370301 to 370315). Each
     declares `module: system`, and `testFindings` reports none.
   - `testHeader` gives MOD-settings-pages and MOD-source-register, with no finding.
   - The gate was first returned for one line. Line 94's regex held a raw backquote, so the reader took the rest of the
     file as a template string and read only TST-370201 and 202. `6eb591931` writes it as `\x60`, and nothing else
     changes. The control: the reader on the earlier head reads 2, and on this head 14.
5. **The Acceptance holds:**
   - Every requirement UC-004 realises has a release case.
   - The system file walks the main flow and the alternative flows.
   - The pull request records 24 planted faults, and every case that is not a `todo` fails on at least one of them.

## Findings, ruled

Each is a defect of MOD-settings-pages against accepted texts, and each can be built. They are registered (`bc6a72b23`):
- **UC004-S1 (TST-370213) → ITM-1361:** the library shows each version's files with their SHA-256.
- **UC004-S2 (TST-370214) → ITM-1362:** before an EU legal text is saved, the page states that its fetched text becomes
  public.
- **The bare `#` title line, untested → ITM-1363:** a registered source's entry carries `# {id} {title}`.

## Readings taken

- Step 7's "fetch workflow" is `fetch-sources.yml`, run through its command.
- Step 1's "Library" is the route `library` under Settings.
- "An example" is "for example" or "such as".
- 4c's "how to extend the token" is a link to the server's new-token page.
- The pull request also takes readings of THE SOURCE MODEL IS GENERIC, A PERSON'S OWN INPUT IS COMMITTED DIRECTLY and EVERY
  STEP EXPLAINS ITSELF.

All are taken.
