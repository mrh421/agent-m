---
id: ITM-1177
title: OpenAI-compatible requests explicitly request non-streaming JSON
level: module
realises:
  - UC-003
  - UC-049
  - A RUNTIME IS INTERCHANGEABLE
  - AN UNSUPPORTED ENDPOINT SAYS SO
modules:
  - MOD-endpoint-calls
  - MOD-settings-pages
  - MOD-desktop-shell
  - MOD-bridge-jobs
builds_on:
  - ITM-487
tests:
  - unit
  - component
  - system
  - release
origin:
  - The human NVIDIA endpoint report and controlled JSON/SSE diagnostic on 87c4f1f8, recorded in the inputs of JOB-20261022-1245-a7b5
  - UC-003 main flow 4 and 5; UC-049 main flow 4; accepted MOD-endpoint-calls endpointExchange, endpointDriver and testEndpoint
---
# ITM-1177 OpenAI-compatible requests explicitly request non-streaming JSON

**REGISTER**

## Outcome

The shared OpenAI-compatible request body explicitly contains the literal `stream: false`, so an endpoint that
otherwise defaults to server-sent events supplies the single JSON answer the existing public callers parse.
The same owned builder is used by the short endpoint test, a tool exchange and the non-tool driver. Anthropic
requests, public interfaces, response formats, tool execution, usage, credentials and route selection are unchanged.

Production scope is only `src/endpoint-calls/index.mjs`, in the OpenAI-compatible branch of `providerRequest`.
The other listed modules are included solely for the exact existing test expectations below; none of their
production files changes. No SSE parser, provider-specific branch, retry, proxy, new dependency or browser workaround
is part of this item.

## Failure path and evidence boundary

At `87c4f1f8`, `testEndpoint` calls `requestFor` and then `providerRequest`, whose OpenAI-compatible body omits
`stream`. An HTTP-success response is read by `response.json()` before `exchangeAnswer`. A response beginning
with SSE `data:` fails JSON parsing; the catch returns `works: false` with the parser message diagnosed as
`not reachable`. `endpointExchange` and the ordinary driver's `send` use the same builder and JSON-reading convention.
The failure node is the negotiated response format, not proof that the server could not be reached.

The retained controlled diagnostic supplied with the refinement assignment has a JSON positive: the public test
returns `works: true` and the ordinary driver returns the literal `Known answer.`. With the constructed SSE-default
reply, the public test makes one intercepted request and returns `works: false`, `not reachable`, with the
`Unexpected token d` JSON-parser failure. This is offline evidence, not a successful request to live NVIDIA.
The assignment also records that NVIDIA's hosted reference defaults `stream` to true and supports false; the
implementation report names the exact official provider reference it uses, without a paid call.

The separate credential-free browser-origin comparison recorded by the Scrum Master found NHR's required
cross-origin permission and no required Access-Control-Allow-Origin header on NVIDIA's response. Explicit JSON
negotiation does not grant CORS permission. UC-003's browser-refusal diagnosis and existing Bridge alternative remain
unchanged; this item makes no claim that live NVIDIA becomes callable directly from Chrome.

## Existing Expected-Result Boundary

Only add the literal `stream: false` property to each named OpenAI-compatible expected provider body, with matching
case-description prose where needed. Keep the complete expected object; do not replace it by a partial match,
wildcard, copied production value or removal of the assertion. Every other literal and assertion is unchanged.

| Existing test file | Exact case and declared owner/level | Permitted maintenance |
|---|---|---|
| `tests/endpoint-calls.test.mjs` | TST-472213 (legacy TST-260-001), MOD-endpoint-calls, unit | Add `stream: false` to the expected probe body only. |
| `tests/endpoint-driver.test.mjs` | TST-472223 (legacy TST-316-001), MOD-endpoint-calls, unit | Add `stream: false` to the expected ordinary-driver body only. |
| `tests/endpoint-exchange.test.mjs` | TST-487003 and TST-487005, MOD-endpoint-calls, unit | Add `stream: false` to the OpenAI fixture-backed history body and the literal no-tool body only. |
| `tests/endpoint-tool-loop.test.mjs` | TST-488001, TST-488012 and TST-488014, MOD-endpoint-calls, unit | Add `stream: false` to both inline expected bodies of TST-488001 and the inline no-tools body passed to `withoutToolsCase` by each of TST-488012/014 only, with matching expected-body prose. |
| `tests/bridge-jobs-endpoint-ask.test.mjs` | TST-472084, MOD-bridge-jobs, unit | Add `stream: false` to the expected controlled model body only. |
| `tests/desktop-shell-endpoint-composition.test.mjs` | TST-268001, MOD-desktop-shell, unit | Add `stream: false` to the expected controlled model body only. |
| `tests/system-uc-003-direct-endpoint.test.mjs` | TST-292001, MOD-settings-pages, system | Add `stream: false` to the intercepted expected provider body only. |
| `tests/system-uc-003-dashboard-bridge.test.mjs` | TST-266001, MOD-settings-pages, system | Add `stream: false` to the expected controlled model body only. |
| `tests/component-itm-294-https-reverse-tunnel.test.mjs` | TST-294001, MOD-settings-pages, component | Add `stream: false` to both direct and bridged expected model bodies for Apache and nginx only. |
| `tests/release-itm-268-desktop-shell.test.mjs` | TST-268901, MOD-desktop-shell, release | Add `stream: false` to the expected controlled model body only. |
| `tests/release-itm-269-endpoint-route.test.mjs` | TST-269901, MOD-settings-pages, release | Add `stream: false` to the expected controlled model body only. |
| `tests/release-uc-003-dashboard-https-bridge.test.mjs` | TST-266002, MOD-settings-pages, release | Add `stream: false` to the expected controlled model body only. |
| `tests/release-sprint-15-bridge-jobs.test.mjs` | TST-472517, MOD-bridge-jobs, release | Add `stream: false` to the expected controlled model body only. |

The sole existing JSON-fixture change is the literal property `stream: false` in `openai.request` of
`tests/fixtures/endpoint-calls/tool-exchanges.json`, used by TST-487003. Its exchange input, all response/answer data
and the entire Anthropic branch remain unchanged. The fixture is data, not a production-derived oracle.

TST-488001/012/014 do not read that JSON fixture: they state their own complete inline body objects.
Their expected tool definitions, user/assistant/tool message history, call order, request counts, text and usage
remain unchanged; TST-488012/014 still assert that the body has no `tools` key. The shared `withoutToolsCase` and
all other helpers remain unchanged. The Anthropic TST-488002/013 bodies and every other tool-loop assertion are
outside this maintenance boundary. The complete old-body scope is thirteen test files and the one JSON fixture.

TST-294001's case declaration names MOD-settings-pages; its file header lists the integration participants.
Neither is relabelled. All named test IDs, levels, guards, authorship, fixtures, route inputs, helpers and staging
remain unchanged. In particular, the request count, complete message/tool history, token and tool-result correlation,
reported and unknown usage, pairing/origin/TLS/tunnel checks, no-secret and no-storage assertions remain intact.
Unrelated expectations, TODOs and the frozen TST-922001 body are outside this item.

The four release-case edits are made in an author-preserving commit by a Developer who implements none of the
endpoint behaviour. Developer-terra-e is a possible independent writer only after the currently active109 release
assignment ends and the Scrum Master records a fresh assignment; this item assigns or starts nobody.

## Readiness and nonduplication

ITM-260, ITM-316 and ITM-487 describe the existing endpoint test, ordinary driver and tool exchange. Their implemented
public callers already exist in the default-branch source; their outcomes do not specifically repair an SSE-default
endpoint's response negotiation. This item is the residual compatibility defect, not a replay of those implementations
or a claim that all of their historical job-ledger states were reconciled. ITM-1137 concerns the diagnosis check, not
request-body negotiation. No existing item or result record is rewritten.

The accepted EndpointCalls contract returns an answer, tool calls and usage through the existing JSON-based public
path. Requesting the provider's non-streaming form makes that outcome possible without changing the contract.
No SPEC, use-case or architecture change is needed, and the separate open Settings-first bar proposals are not inputs
to this repair. This refinement selects no item and starts no work. A fresh authorized planning decision may add the
item to still-open109 through public `startSprint` with `context.running` naming109, or select it for a later sprint,
subject to the actual native prerequisite, hold, conflict, ordering and WIP guards. Starting110 is not a prerequisite
for this repair; any amendment preserves the published109 Selection history and serializes overlapping writers.

## Acceptance

- A focused regression uses the public endpoint test, public exchange and ordinary driver against constructed
  responses: the controlled transport supplies the literal JSON answer when the body contains `stream: false`,
  otherwise the recorded SSE form. The intended positive values, including `Known answer.`, are literals in the test.
  Each public invocation sends one request with no retry; successful text-only and tool-call answers retain their
  existing typed values. The test verifies the failure node, not only the source string or presence of a function.
- The generic OpenAI-compatible branch sets `stream: false` for all three callers. The full old-body maintenance is
  limited to the exact table and the single JSON-fixture property above. Anthropic and every other assertion stay
  unchanged; no live provider, new SSE implementation or CORS workaround is required for the regression.
- The future implementation follows the existing tests-only first-commit and actual red-CI rule, final green CI,
  effective owned-code counter-proof/exact restoration for each new case, truthful native result records and
  independent release authorship. Maintaining the named old body literals imposes no new-case proof replay or quota.
  No test, probe, source change, retry, assignment or selection is authorized by this REGISTER refinement itself.
- **The planning run** (sprint team1/122, on `main` at `0e928b61b`). A stand-in added `stream: false` to both forms of
  the OpenAI-compatible body in `providerRequest`. Over 341 files that name MOD-endpoint-calls or a module whose code
  calls it (MOD-bridge-client, MOD-bridge-jobs, MOD-runtimes, MOD-settings-pages, MOD-workflow-entries,
  MOD-desktop-shell), ten cases fail only with it, each a case of the table above: TST-472213, TST-472223, TST-487003,
  TST-487005, TST-488001, TST-488012, TST-488014, TST-472084, TST-292001 and TST-472517. No case outside the table
  fails.
  - The other cases of the table could not be read on that machine: TST-268001 and TST-268901 fail there with and
    without the change (Electron), TST-269901 fails there with and without it, TST-294001 is skipped there, and
    `system-uc-003-dashboard-bridge` and `release-uc-003-dashboard-https-bridge` hang there and were left out. CI reads
    them.
  - The four release cases of the table (TST-268901, TST-269901, TST-266002, TST-472517) are changed by
    developer-sonnet-l, who implements none of the endpoint behaviour, on the item's branch in a commit of its own.

## Design Reading

SRP keeps response negotiation in its existing request builder. DRY changes that one shared path rather than the
probe, exchange, driver and Bridge separately. KISS requests the existing JSON response instead of adding an SSE
parser; YAGNI excludes provider-specific code and unrelated CORS work. Chapter13's interface-misunderstanding and
partition-testing principles support the controlled JSON positive/SSE failure while preserving complete body
oracles, independent release testing and the distinction between offline evidence and actual browser reachability.
