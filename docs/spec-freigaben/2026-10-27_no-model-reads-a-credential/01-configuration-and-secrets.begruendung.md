# 7. Configuration and secrets: no model reads a credential

**The change.** One new requirement, before `THE SHARED PAGES ORIGIN IS DISCLOSED`: `NO MODEL READS A CREDENTIAL` — no
token, key or password Agent M, its Bridge or its CI holds reaches a model, neither in what is sent to it nor through a
tool it calls.

**Why.** akmaier, 2026-10-27: "Generally, We should avoid that LLMs have access to the tokens if possible by design."
`A TOKEN GOES ONLY TO THE SERVER THAT ISSUED IT` holds the browser's tokens on the wire, and `A HOSTED JOB AUTHENTICATES
ITS AGENT WITH A CI SECRET` keeps every other secret off the agent's machine; neither says what the model may read on
that machine. There, the checkout tools (`bash`, `read`) reach the runner's `GITHUB_TOKEN`, which `actions/checkout`
leaves in `.git/config`, and the endpoint key in the driver's environment (`/proc/<parent>/environ`, `sudo`).

**Design principles** (AGENTS.md §2):
- Nothing the SPEC already says: the two requirements above stay; this one adds what reaches the model, which neither
  covers.
- No special first case: one sentence for every credential and every place a model works — tab, CI, Bridge.

**Impact list.**
- Requirements: the one above, new. Check: `tests/checkout-tools-credentials.test.mjs`.
- Architecture: ARC-046 and MOD-checkout-tools (the tools run as a user that cannot read the driver), MOD-workflow-entries
  (the agent machine's checkouts keep no credentials); open for acceptance with the fix.
- Code: `src/runtimes/workflow/github.yml` and the generated `.github/workflows/agent-m-jobs.yml`;
  `src/checkout-tools/` (`shell.mjs`, `paths.mjs`).

**Origin.** SRC-po-a-maier (registered person github.com/akmaier).
