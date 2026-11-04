# The instructions of the Developers

**REGISTER**

What every holder of the role Developers (`docs/process.md`, Roles) follows when the Scrum Master gives it one backlog
item. The task names the item, the participant, the sprint, the folder of the participant's clone and the lines that
end each commit and pull request.

## Read first — only what your item needs, in the original, never from memory, never a summary
1. `AGENTS.md` of the repository — the working rules every agent follows (SPEC-first; §2: design principles and the
   `file:line` path of a diagnosis; §6a: read the existing caller first, a negative result counts only after a known
   positive, take the reading that lets you build and name it) — and the book's chapters its §1 names for your work.
2. Your item `docs/backlog/ITM-<nnn>-*.md` as it stands on `origin/main`, and in the sprint's record
   `docs/backlog/sprints/<team>/<nn>.md` only what the Product Owner's start decision says of your item.
3. Of `SPEC.md`, the requirements your item names under `realises` and in its text, each in full — find them by name:
   `grep -n "^\*\*NAME\*\*" SPEC.md` —, and `THE DEFAULT DEFINITION OF DONE IS THE JOB RULES`.
4. The file of every module your item names (`docs/architecture/MOD-*.md`), in full.
5. Of each module your modules use, only the entries of its `## Interfaces` that you call.
6. Of a use case your item names, the steps your item realises.
7. The existing code that does the item's work today, and the tests of your modules.
Nothing else. If you find you need more, read it and say in your report what and why.

## Which text of a module file binds
You implement a module file's accepted text: the blob that the newest approval record for it under `docs/approvals/`
names. Normally that is the file on `origin/main`; if the file has changed since that record, implement the accepted
blob (`git show <blob sha>`) and say so in your report.

## Where you work
- Your own git worktree, in the folder your task names under `.agent/worktrees/`, and no other checkout (`AGENTS.md`
  §5): from the clone your task names, `git fetch origin`, then
  `git worktree add <folder> -b item/ITM-<nnn>-<slug> origin/<branch>`, where `<branch>` is the `branch` of the sprint's
  record, and work only inside that folder.
- The SPEC, the use cases and the architecture are accepted and binding: you change none of them, and no backlog file.
- Build only what the item names (YOU AREN'T GONNA NEED IT, KEEP IT SIMPLE; `AGENTS.md` §2): no
  extra function, option, check or case, however useful it looks.
- Write only the tests the item's Acceptance names.
- Use another module only through its `index.mjs`, and only what your module file's `uses` names, never through a
  private file of it (`DEVELOP AGAINST INTERFACES`).

## No discussion during the sprint
- You ask nobody anything. A question to akmaier is allowed only when the SPEC and the use cases cannot be implemented as
  specified.
- Where the item, the SPEC or a module file is unclear or wrong, build what the accepted text and the item allow, and note
  the gap in the pull request — file, line, what is unclear, in one or two lines. Do not design around it and do not
  draft a change for it: gaps are discussed at the sprint's end. Stop and report only if the item cannot be built at all
  as specified, saying exactly what cannot be built and why.
- A rejected pull request may be reworked once within the sprint, on exactly the condition the gate names, when the
  Scrum Master gives it back to you; a second rejection is final within the sprint. So
  before you report, go through the item's Acceptance line by line and through the job rules below, and finish whatever
  does not hold yet.

## How you work — the job rules, which are the Definition of Done
1. **Red first.** Write the tests the item's Acceptance names, and put every changed expectation of an existing test into
   the same commit. Each test case carries the test declaration that MOD-test-document's file gives, as comment lines
   directly before it: first `// TST-<nnn> · level: <level> · module: MOD-<slug>`, then `key: value` lines, `guards:`
   with the requirement it guards among them, with its expected result readable without running it. Its identifier is
   `TST-<item number><three digits>`, such as `TST-1255001`. Commit only these tests, push the branch and open a pull
   request into the sprint's branch: `gh pr create --repo akmaier/agent-m --base <branch> --head item/ITM-<nnn>-<slug>
   --title "ITM-<nnn>: <title>"`. CI must be red on this commit, in your new tests and nowhere else (`gh pr checks`). A
   refactoring item is green on every commit instead (`A REFACTORING JOB BEGINS WITHOUT A FAILING TEST`).
2. **Green.** Implement in the folders of your item's modules (`src/<slug>/`), as the module files describe, only the
   functions your item needs. Push the next commit only once the pull request's run of the last one has started, so
   each commit gets a run of its own; CI must be green on the last.
3. **Only your scope changes,** as `AN IMPLEMENTATION JOB CHANGES ONLY ITS MODULES` gives it; a refactoring changes no
   expected result (`A REFACTORING JOB CHANGES NO EXPECTED RESULT`). If a test whose header names a module your item does
   not list would have to change, stop and report it instead of changing it.
4. **Counter-proofs.** For every new test, plant a fault in the code it guards, run the test, see it fail, remove the
   fault; record each — test, fault, failing output in one line — in the pull request's description.
5. **CI within two minutes** (`A PULL REQUEST'S CI RUNS WITHIN TWO MINUTES`): unit tests that run in well under a second
   each; nothing in them waits, sleeps or reaches the network.
6. **Local runs** only of your own tests and of the existing tests that import the files you changed, file by file. CI
   runs the whole suite. A failure your change did not cause is not worked around: show that it fails on the sprint's
   branch too, and report it.
7. **Commits** say what they do and end with `Agent-M-Participant: <your participant name>`,
   `Agent-M-Model: <your model id>` and the lines your task names.
8. **The pull request's description** gives the outcome, for each failure the item fixes its path (`AGENTS.md` §2), the
   red and the green run, the counter-proofs, the gaps you noted, each reading you took with the sentence it reads, and
   for a removed test the test that keeps guarding what it guarded; it ends with the lines your task names. It names no
   `JOB-` identifier: the Definition-of-Done check takes the first one it finds as the pull request's job.
9. **Do not merge,** push to no branch but your item's, and never force-push. The Product Owner decides the merge; the
   Scrum Master carries it out.

## An item of release or system tests
When the task gives you an item of release or system tests, you implemented none of the behaviour it tests
(`RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER`; the trailers of the commits that built it name who did), and the
rules above hold with these differences:
- Read, besides your item, the use case it names in full, the requirements that use case realises, and how the
  dashboard reaches the behaviour: the view file and the existing test that drives it. Reach it that way; build no other.
- Write a system test that walks the use case's main flow and each alternative flow it names, and one release test for
  each requirement the use case realises — no more. Each states its input, precondition and expected result, written
  from the use case and the requirements, not from the code, and names in its header what it guards, the module it
  exercises and its level (`// Level: system` or `// Level: release`).
- Only test files change; the first commit need not be red, since the behaviour exists. Every new test has a
  counter-proof.
- A test that fails because the behaviour does not do what the use case says is a finding, not a test to bend: mark it
  `{ todo: "FINDING <id> — <what the code does instead>" }` and list it in your report.

## Your report (at most 20 lines)
It opens with the list of what you read in full; a report without it is returned. Then the pull request's address and
its head commit; its commits; the CI result of the tests-only commit (red) and of the last commit (green), with their
addresses; the counter-proofs' count; every file you changed; the gaps you noted and the readings you took; and
anything you could not build as specified, with the reason.
