---
id: ITM-1244
title: A Bridge's pair answer names it and its release
level: module
realises:
  - THE BRIDGE IS CONFIGURED IN ITS WINDOW OR FROM AN EXPORT
  - UC-044
  - UC-011
modules:
  - MOD-bridge-http
  - MOD-desktop-shell
  - MOD-bridge-client
builds_on: []
tests:
  - unit
origin:
  - the live test of the Bridge on akmaier's Mac — `GET /v1/pair` answered `{"bridge":{"name":"Bridge","version":"unreleased","platform":"darwin"}}` while the settings named it "Andreas-iMac-7.fritz.box"; the architecture a344de24, accepted in b775e120
---
# ITM-1244 A Bridge's pair answer names it and its release

**REGISTER**

## Outcome

MOD-bridge-http.md:84-91, as accepted: `serveBridge`'s config carries `name: () => string` and `version: string | null`,
and "`GET /v1/pair` answers with `name()` at the time of the request, with `version`, the release the Bridge runs or
`null` for a start that names none, and with the platform it runs on". MOD-desktop-shell.md:156-158: the start passes
"the name of the settings in force and the version of `build.json`, `null` for a start without it". MOD-bridge-client:
`testBridge`'s `version` is `string | null`. UC-044 step 4 and UC-011 step 1: the page stores the Bridge "under the
name it reports".

The code does otherwise: `src/bridge-http/server.mjs:38` answers the fixed `name: "Bridge", version: "unreleased"`;
`src/bridge-http/protocol.mjs:18` types the version `"string"`; `src/desktop-shell/compose.mjs:8-11` passes neither,
and `src/desktop-shell/main.mjs:83` gives `compose` no version (`config.version`, set from `build.json` at `:64`). So
`pair()` (`src/bridge-client/index.mjs:121-127`) stores every Bridge as "Bridge".

## Acceptance

- Unit tests naming the modules:
  - MOD-bridge-http: a server given `name` and `version` answers `GET /v1/pair` with them and the platform; with the name
    changed after the start, the next request carries the new name; `version: null` is answered as `null`; the
    protocol's pair answer allows a null version.
  - MOD-desktop-shell: the start passes the settings' name and the version it was given, `null` without one.
  - MOD-bridge-client: `testBridge` accepts a pair answer whose version is `null`, and `pair()` stores the name it reports.
  Counter-proof: before the change the pair answer is "Bridge" and "unreleased" whatever the settings say.
- The first commit holds only the tests, and CI is red on it. No stub is committed.
- Only `src/bridge-http/`, `src/desktop-shell/`, `src/bridge-client/` and the tests that name these modules change;
  preloads, where needed, in a commit of their own.
