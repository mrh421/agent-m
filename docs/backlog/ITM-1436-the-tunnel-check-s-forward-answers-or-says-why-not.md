---
id: ITM-1436
title: The tunnel check's forward answers, or says why not
level: module
realises:
  - THE BRIDGE OPENS ITS TUNNELS ITSELF
  - A TEST THAT FLIPS ON THE SAME COMMIT IS FLAKY
modules:
  - MOD-tunnels
  - MOD-bridge-build
builds_on:
  - ITM-1428
tests:
  - unit
origin:
  - the cause left open at ITM-1428's gate (#1724) in team1's sprint 142 (docs/gates/20261102-1117-development-release-testing-1428.md); the stall of TST-1082001 in run 41300967282 at sprint 141's close and of TST-961009 in run 41416171968
---
# ITM-1436 The tunnel check's forward answers, or says why not

**REGISTER**

## Outcome

Twice on CI, the tunnel check ended at its own deadline with "no request was answered through the forward within 60
seconds": TST-1082001 at sprint 141's close, and TST-961009 in this sprint. ITM-1428 took TST-961009 off the real check.
TST-961004, 961005, 961007 and 1082001 still need the real check, so the file can still flip. The stall's cause is not
shown. opus-f named two candidates from the code:
- `src/tunnels/index.mjs:114` reconnects on `close` only while the tunnel is `open`. A client that closes before `ready`,
  without `error`, stays `opening` for ever. Locally, ssh2 emits only `close` when a server ends the connection after its
  identification line.
- `check.mjs:105` `freePort` releases a port before the app binds it. Another process may take it, and MOD-tunnels then
  backs off for up to 30 s.

## Acceptance

- First, a probe shows the cause on CI or with a widened window, as a data-flow path to the failure, before any change. It
  names the module that owns the fix.
- Where the cause is MOD-tunnels' or MOD-bridge-build's code, a tunnel that cannot open is retried or named, as the module
  texts assign, and the tunnel check ends with its reason rather than at the deadline. A failing test shows it first.
- Where the probe finds the cause in another module, the item stops for the Product Owner and names that module.
- No other existing expected result changes, unless a probe names it and the accepted text allows it.
