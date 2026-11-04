---
id: ITM-1204
title: The prompt bar shows what its tool loop does while it runs
level: module
realises:
  - UC-049
modules:
  - MOD-prompt-bar
builds_on:
tests:
  - unit
origin:
  - 68a0809e and bbc3a0b0 (2026-10-25), "The prompt bar's conversation froze": a tool loop running for minutes with nothing shown
---
# ITM-1204 The prompt bar shows what its tool loop does while it runs

**REGISTER**

## Outcome

A model endpoint that can use tools works in a loop in the tab (UC-049 step 4): it asks for a tool, Agent M carries the
call out and returns its result, until the endpoint answers. The bar shows "the text, the rounds and the findings the loop
left" once it has ended (MOD-prompt-bar, `startPromptBar`); while the loop runs it shows nothing of it.
- `68a0809e`: search-files read 6 484 files and "froze the tab".
- `bbc3a0b0`: "The prompt bar's conversation froze again" while graph-checks built the trace graph twice.
- In both, the person saw no sign of which tool ran.
- MOD-runtimes' `runOnTab` takes `onOutput` (`docs/architecture/MOD-runtimes.md:249-251`), and hands it to MOD-job-runner's
  loop, which also takes `onRound` (`src/job-runner/loop.mjs:117`, `:201`). The bar calls `runMessage` without either
  (`src/prompt-bar/bar.mjs:309`, `:367`).

**First task:** read whether UC-049 or MOD-prompt-bar states what the bar shows while the loop runs, and whether
`onOutput` reaches a tool call as it happens. Where the texts give it, build it and name the reading. Where
they do not, the item stops for a draft to akmaier.

## Acceptance

- While a tool call of the loop runs, the bar names the tool and what it was asked for. Once the answer is shown, that
  line goes, and the answer stands once in the conversation (`410238c4`).
- Counter-proof: a loop of two tool calls shows each in turn, in a test with a fake endpoint.
- The first commit holds only the tests, and CI is red on it.
