---
id: ITM-1014
title: openEditor's options are the ones its module file states
level: unit
realises:
  - DEVELOP AGAINST INTERFACES
modules:
  - MOD-markdown-render
builds_on:
tests:
  - unit
origin:
  - ITM-672's draft (sprint team1/92), from developer-sonnet-b's finding
built_by:
  - 7749380ae3e59944210e6f39d38a86901b841980
  - debcf213fb3860c2f5a624076a1603e8e67e2d38
  - c0118156bd9754f7d64ddfb736649a682d794b85
---
# ITM-1014 openEditor's options are the ones its module file states

**REGISTER**

## Outcome

`src/markdown-render/editor.mjs` documents `openEditor` with an option `disabledReason` and no `linkFor`, while
MOD-markdown-render.md:62-63 lists `linkFor` and no `disabledReason`.

**First task:** read which options the callers pass. If the code is right, the item stops for a draft for akmaier.

## Acceptance

- `openEditor` takes the options its module file states, and a test names each, with a counter-proof.
- The first commit holds only the tests, and CI is red on it. No stub is committed.

**Read at sprint team1/93 (developer-sonnet-c): built.** The accepted text (`c0118156`) states what `editor.mjs` does:
`:25` takes `disabledReason`, `:51-54` disable Save with `Save is disabled: <reason>` and clear it, `:60-64` refuse a click.
`file-edit.mjs:130` and `file-drafts.mjs:59` pass it. Tests that check `Save is disabled` through these callers already
exist, among them `tests/review-pages-use-cases.test.mjs`. It is done.

