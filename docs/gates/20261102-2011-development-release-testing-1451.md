---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - 268c6ef5bcbfaafec5de198a81c338e620c95d8e
  - https://github.com/akmaier/agent-m/pull/1758
date: 2026-11-02 20:11 UTC
---
# Development → Release testing: ITM-1451, #1758

**REGISTER**

## Reason

ITM-1451 (the rendered front matter and the editor's Save wear the site's one look) may go on. The pull request is #1758
into `sprint/team1/143`, at `268c6ef5b`. developer-sonnet-j wrote the tests-only commit `95e94b56a`, the code `c789967fe`,
and `08b588ba5`, which `25220cd6c` reverts. developer-sonnet-l wrote `268c6ef5b`, the release move, after the code (trailers
on each). I wrote none of it.
1. **The first commit holds only tests and is red for the item's reason.** It changes `markdown-render-look.test.mjs`
   (new) and `dashboard-shell.test.mjs`. In run 41502804716, only `unit (2)` fails, on TST-1451002 and 1451003, and
   `component (8)` fails on the moved `dashboard-shell` case.
2. **CI is green on the head:** run 41516107422 (`268c6ef5b`), at attempt 1. `git merge-tree` with the sprint branch's
   head `e19372cfc` is clean.
3. **Only the item's modules change:** one line each of `src/markdown-render/render.mjs` and `editor.mjs`
   (MOD-markdown-render), plus tests.
   - `renderArtifact` (`render.mjs:58`) draws `table.frontmatter.list`.
   - `openEditor`'s Save (`editor.mjs:32`) carries `btn`.
   - `dashboard-shell.test.mjs` changes one line, as ruled in 143.md. `release-uc-046` changes one line, sonnet-l's.
4. **The new tests name `EVERY PAGE SHARES ONE LOOK AND WORKS ON A PHONE` and MOD-markdown-render.** The pull request
   records five counter-proofs.
5. **The Acceptance holds:**
   - The front-matter table carries `list`, and the editor's Save carries `btn`.
   - TST-1062104 was red after the code (runs 41505484858 and 41508681225) and is green at the head.
   - sonnet-l moved TST-1062104 after the code, to the SPEC sentence it names, and built none of this. Every other
     assertion of the case is unchanged.

## Ruled

- **The reads stand.** sonnet-j's rework read AGENTS.md, the whole SPEC, chapters 9, 11, 12 and 13 and MOD-site-frame in
  full. sonnet-l read AGENTS.md, the whole SPEC and chapter 13 in full.
- **sonnet-l's gap:** UC-046's `realises` does not name `EVERY PAGE SHARES ONE LOOK AND WORKS ON A PHONE`. A SPEC rule
  binds every page whether a use case names it or not, so the move rests on the SPEC sentence. The gap is noted, not an
  item.
