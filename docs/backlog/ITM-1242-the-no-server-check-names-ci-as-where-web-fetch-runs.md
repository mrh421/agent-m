---
id: ITM-1242
title: The NO SERVER check names CI as where web fetch runs
level: system
realises:
  - NO SERVER
modules:
  - MOD-checkout-tools
builds_on: []
tests:
  - system
origin:
  - the architecture accepted in 93062199 and b00f4d6e (akmaier): only the Workflows register the checkout's tools; akmaier: "No server: narrow reading is correct."
---
# ITM-1242 The NO SERVER check names CI as where web fetch runs

**REGISTER**

## Outcome

`tests/test_no_backend.py:249-250` (`WEBFETCH`) and the comment at `:378-382` say webfetch is "registered by the programs
that run jobs (src/workflow-entries/ in CI, or a Bridge)". MOD-checkout-tools (:21-26), MOD-job-catalogue (:131) and
ARC-046 (:141-143), as accepted, say only the Workflows register it. The check itself (no module the site loads in a
browser imports `src/checkout-tools/`) is right and stays; the two texts name CI only, and the comment keeps the reading
akmaier confirmed: NO SERVER's check concerns the built site a browser runs.

## Acceptance

- Only the text of `WEBFETCH` and the comment in `tests/test_no_backend.py` change; no check changes.
- `test_no_backend` passes locally and on CI, and its counter-proofs on planted texts still find what they plant.
