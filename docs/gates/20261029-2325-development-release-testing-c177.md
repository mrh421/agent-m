---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - b562878c368cf43baefcee4866f9b00ae26d1802
  - https://github.com/akmaier/agent-m/pull/1477
date: 2026-10-29 23:25 UTC
---
# Development → Release testing: ITM-1177, OpenAI-compatible requests ask for one JSON answer

**REGISTER**

## Reason

ITM-1177, pull request #1477 into `sprint/team1/122`, passes on `b562878c`, its head when this was decided.

The condition is "CI is green on it and the Definition of Done holds" (`docs/process-models/scrum-wip.md:53`). The
Definition of Done is the default (SPEC.md:1869-1874).

1. **The first commit holds only tests, and CI is red on it for the item's reason.** `18029e29` changes only tests and
   the one JSON fixture. Run 40932408378 (`pull_request`) fails TST-1177001 to 004, and the cases of the item's table
   whose expected body now holds `stream: false`: TST-260-001 (TST-472213), TST-316-001 (TST-472223), TST-487003, TST-487005,
   TST-488001, TST-488012, TST-488014, the endpoint ask of `bridge-jobs-endpoint-ask`, TST-268001, TST-294001,
   TST-266001 and TST-292001. The other failures of that run are todos.
2. **CI is green on the head.** Run 40934895438 (`pull_request`, attempt 1) on `b562878c` succeeds: 58 jobs, 17 skipped,
   none failed.
   - On `759bdf8d`, before the release commit, run 40932725066 failed the four release cases of the table, as expected
     there, and TST-2026271023 of `tests/review-core.test.mjs`, "rejecting a SPEC change entry on its page takes it out of
     its queue". That file and its module are untouched by the item, and the case passes on the head. Two outcomes on two
     commits are no flip by `A TEST THAT FLIPS ON THE SAME COMMIT IS FLAKY`; it is noted, not registered.
3. **Only the item's files change, as its table names them.**
   - `src/endpoint-calls/index.mjs`: both forms of the OpenAI-compatible body in `providerRequest` gain `stream: false`,
     with a one-line comment. The Anthropic branch is unchanged.
   - The thirteen test files and `tests/fixtures/endpoint-calls/tool-exchanges.json` of the table: each changed line adds
     `stream: false` to an expected body. In `tests/endpoint-tool-loop.test.mjs` the prose of TST-488001, 012 and 014
     names it too, as the table allows. No other literal or assertion changes.
   - The four release cases (TST-268901, TST-269901, TST-266002, TST-472517) change in `b562878c` alone, whose trailer
     names developer-sonnet-l, who implemented none of the endpoint behaviour.
   - The new `tests/endpoint-calls-non-streaming-json.test.mjs`.
4. **The new and changed declarations**, read by MOD-test-document's reader on the head, 0 findings each:
   - TST-1177001 (unit, MOD-endpoint-calls). given: an OpenAI-compatible endpoint that answers the probe's agent_m_probe
     call as JSON only to a body with stream false, else in SSE; known negative: the SSE form is not read by
     response.json(). input: testEndpoint(config). expect: { works: true, model: "fixture-model", tools: true,
     toolMessage: null }; exactly one request, whose body holds stream false.
   - TST-1177002. given: an OpenAI-compatible endpoint that answers the text Known answer. as JSON only to a body with
     stream false, else in SSE. input: testEndpoint(config). expect: { works: true, model: "fixture-model", tools: false,
     toolMessage: "Known answer." }; exactly one request, whose body holds stream false.
   - TST-1177003. given: an OpenAI-compatible endpoint that answers Inspecting. with one read_file call on three.md and
     usage 13 in / 5 out as JSON only to a body with stream false, else in SSE. input: endpointExchange(config, { messages:
     [user Inspect the fixture.], tools: [read_file] }). expect: { text: "Inspecting.", calls: [{ id: "next-a", name:
     "read_file", args: { path: "three.md" } }], usage: { inputTokens: 13, outputTokens: 5, minutes: null, cost: null } };
     exactly one request, whose body holds stream false.
   - TST-1177004. given: an OpenAI-compatible endpoint that answers the text Known answer. without usage as JSON only to a
     body with stream false, else in SSE. input: endpointDriver(config, participant).send of a DriverInput whose prompt is
     Known positive. and which offers no tools. expect: { text: "Known answer.", usage: null }; exactly one request, whose
     body holds stream false.
   - TST-488012 and TST-488014 (changed). given: an OpenAI-compatible endpoint answering Plain answer. with usage 4 in /
     2 out; an input whose tools is null (012) or that has no tools property (014). input: send. expect: one request with
     body { model, messages: [user prompt], stream: false } and no tools key; { text: Plain answer., usage 4 in / 2 out }.
   - TST-488001 (changed). given: an OpenAI-compatible endpoint that first calls read_file on one.md and two.md in one
     answer, then answers Final answer. input: send a DriverInput carrying tools with limit 10 whose call returns "ONE" for
     one.md and "TWO" for two.md. expect, as the reader reads it: "text Final answer.; calls in order one.md then two.md,
     each after request 1 and before request 2; exactly two requests;". Its value continues onto the next comment line,
     where the change stands ("… max_tokens 32000 and stream false"), which the reader does not read. That continuation
     stood before this item; it is ITM-1304's concern, not this item's.
   - The release declarations of the four release files are unchanged. The reader's control,
     `tests/release-itm-1254-issue-move.test.mjs`, gives 4 declarations and 0 findings.
5. **The counter-proof is recorded in the pull request:** with `, stream: false` taken out of both body forms on
   `759bdf8d`, TST-1177001 to 004 all fail; with the file's bytes restored, by SHA-256, all four pass.
6. **Checked by me on `b562878c`.** The new file, the five MOD-endpoint-calls files, `bridge-jobs-endpoint-ask`,
   `system-uc-003-direct-endpoint`, `release-sprint-15-bridge-jobs` and `test-document-one-line`: 71 pass, 0 fail. My
   planning run had named the same ten cases that it could read, and none outside the table.

## Noted

- TST-2026271023 failed once on `759bdf8d` and passed on the head; for the review.
- TST-488001's `expect:` continues onto a second comment line, which the reader cuts; ITM-1304.
