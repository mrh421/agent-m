---
id: MOD-endpoint-calls
title: The driver of model endpoints
folder: src/endpoint-calls/
realises:
follows:
  - ARC-046
uses:
  - MOD-job-runner.Driver
  - MOD-job-runner.DriverInput
  - MOD-job-runner.driverPrompt
  - MOD-job-runner.estimate
  - MOD-job-runner.Usage
  - MOD-job-runner.ToolUse
  - MOD-participant-list.Participant
provides:
  - EndpointConfig
  - Diagnosis
  - endpointDriver
  - endpointExchange
  - testEndpoint
  - listModels
  - modelContext
  - diagnoseEndpoint
  - holdKey
---
# MOD-endpoint-calls The driver of model endpoints

## Responsibility

It belongs to Participants and jobs (ARC-046). It is the participant driver for model endpoints — OpenAI-compatible and
Anthropic, hosted or self-hosted — that a browser or Node calls directly: it sends a job's input and returns the answer
and the usage the endpoint reported — in one request, or, where the input offers tools, in the endpoint's own tool
calling, each call carried out by the runner, until the endpoint answers without one (the execution loop, Vibe Coding,
ch. 11); it sends the short test request of UC-003, which also tells whether the model calls a tool it is offered; and when a browser
cannot call an endpoint, it names the reason and the routes that would work instead (`AN UNSUPPORTED ENDPOINT SAYS SO`).
An endpoint the browser cannot call is called through the Bridge its configuration names, for UC-003's short test and
for the requests of jobs: MOD-bridge-jobs runs `testEndpoint` and `endpointDriver` in Node on that Bridge. Wherever it
runs, the driver calls the endpoint directly; it neither selects nor reaches a Bridge, which MOD-runtimes does. It runs
in a browser and in Node, and keeps nothing.

## Parts

- `index.mjs` — the interface.
- `openai-compatible.mjs` — requests and answers of OpenAI-compatible endpoints.
- `anthropic.mjs` — requests and answers of Anthropic endpoints.
- `diagnosis.mjs` — telling apart why a call failed.
- `loop.mjs` — the execution loop and its rules.
- `retries.mjs` — whether a failed request is sent again, and after how long.

## Data

**An endpoint's configuration**, as a browser keeps it in its store — where an endpoint the browser cannot call also
names its Bridge (MOD-browser-store) — and as CI gives it from the job's settings and secrets:

```json
{ "name": "nhr-hub", "kind": "openai-compatible", "baseUrl": "https://example.org/v1", "model": "example-model",
  "key": "…" }
```

The key is the endpoint's own, held in a browser's store or, in CI, read from the CI secret the participant names. A
direct call sends it only to the endpoint's own address in the request's authorisation header. For an endpoint called
through its Bridge — its test or a job's request —, the browser sends the configuration only in the body of the request
to that Bridge; the Bridge then sends the key only to the endpoint, in that endpoint request's authorisation header. It never appears in an
address and is never written anywhere (`A CREDENTIAL IS NEVER PLACED IN A URL`, `NO SECRET IN THE REPOSITORY`).

**The key holder** keeps a key out of a program that calls the endpoint: it holds the key, in Node, and forwards each
request it receives on `127.0.0.1` to the same path below the endpoint's `baseUrl`, adding the key in its kind's header —
`x-api-key` on Anthropic, `Authorization: Bearer` on an OpenAI-compatible endpoint, the one header every request of this
module carries it in, and sends each through this module's sender of a single request, so that the key goes only where
the module sends every request: the configured endpoint. A caller's own key headers are dropped; a request whose target
is not a path of that endpoint is answered 400 and sent nowhere; a redirect is answered, not followed. The program whose requests it forwards — the model's
user's side of a job's agent machine (MOD-workflow-entries), and a coding agent's CLI started there — is given the
holder's address as the endpoint's `baseUrl`, or as the CLI's base-URL setting with a placeholder for its key
(MOD-agent-processes), and no key (`NO MODEL READS A CREDENTIAL`).

## Interfaces

- `EndpointConfig` — `{ name: string, kind: "openai-compatible" | "anthropic", baseUrl: string, model: string, key: string
  | null }`.
- `Diagnosis` — `{ reason: "cross-origin refused" | "opt-in header missing" | "blocked by the browser" | "not reachable" |
  "key refused" | "model unknown" | "too long" | "rate limited" | "endpoint error", message: string, routes: ("ci" |
  "bridge")[] }`: why a call failed, in the endpoint's or the browser's own words where there are any, and the routes on
  which the same job would work — GitHub Actions (UC-010) or the Bridge (UC-011) — where the browser was the obstacle.
- `endpointDriver(config: EndpointConfig, participant: Participant, exchange?: (config: EndpointConfig, exchange: {
  messages: object[], tools: object[], maxTokens: number, system?: string }, options: { signal?: AbortSignal }) ->
  Promise<{ text: string, calls: object[], usage: Usage | null, cut?: true }>, options?: { system?: string }) -> Driver` — a
  driver whose `send` turns the
  `DriverInput` into a chat request to the endpoint, using `driverPrompt` once for its message text, crosses the network
  to it, and returns the answer's text and the
  usage the endpoint reported, or `null` usage where it reports none; it estimates nothing. Where the input carries
  `tools` (MOD-job-runner's `ToolUse`), it offers their definitions in the endpoint's own form — tools of an
  OpenAI-compatible endpoint, tool use of an Anthropic one —, hands each call the endpoint makes to `tools.call` and
  returns its result to the endpoint, and goes on until the endpoint answers without a call; that answer is the text it
  returns, and the usage is the sum of what each request reported. `options.system`, where given, is sent with every
  request of the loop as the endpoint's system prompt — MOD-checkout-tools' `checkoutPrompt` for an endpoint that works
  in a checkout. The driver decides nothing about a call: what a tool may do, and what it refuses, is the runner's. The
  loop keeps these rules, which follow opencode's:
  - **Every call gets one result**, in the order the endpoint made its calls, a refusal included.
  - **Arguments that cannot be read** — not JSON — are answered, not thrown: the call is not carried out, and its result
    is opencode's `The arguments provided to the tool are invalid: Invalid input for tool <name>: JSON parsing failed:
    Text: <the arguments>.` followed by the parser's message. A tool's name the endpoint gives in another case than an
    offered tool's is read as that tool's.
  - **The same call three times in a row** — the same tool with the same arguments — is not carried out the third time;
    its result says so and asks for other arguments or another way.
  - **The limit.** Where `tools.limit` is a number, it makes at most that many calls, a refused one counted; at the limit
    it asks the endpoint once more without offering tools, adding opencode's maximum-steps text, which asks for a summary
    of what is done and what remains. Where it is `null`, no number of calls ends the loop: it ends when the endpoint
    answers without a call, or when it is cancelled through the signal.
  - **The output limit.** Every request of the loop asks for at most 32000 tokens, or, for a participant with a declared
    `context`, at most what the context leaves. An answer the endpoint ended at that limit — finish reason `length`, stop
    reason `max_tokens` — is followed by a message that tells it so and asks it to continue where it stopped or to make
    smaller edits; the continuation counts as one call of the limit, where there is one, and the answer returned is the
    parts joined.
  - **A full context.** For a participant with a declared `context`, each message's size estimated as MOD-job-runner's
    `estimate` does: once what the conversation uses leaves less than a quarter of the context, at most 32000 tokens, the
    oldest tool results beyond the newest 40000 tokens of them are replaced by the visible marker `[old tool result
    cleared]`, where that frees more than 20000 tokens — so nothing is left out silently (UC-049 3a): the endpoint sees
    where a result was cleared and can ask for it again. A call's result that still would carry the conversation past the
    context is not returned: the endpoint is told instead how large it is and how much of the context is left, so that it
    asks for a smaller part. A participant without a declared context sets no such bound.
  Each request of the loop is one `endpointExchange` — or one call of `exchange` where the caller gives it: MOD-runtimes'
  `bridgeDriver` gives the Bridge's `ask` of one exchange, so that the loop of an endpoint a Bridge calls is this same
  loop, run in the tab.
- `endpointExchange(config: EndpointConfig, exchange: { messages: { role: "user" | "assistant" | "tool", text: string,
  calls?: { id: string, name: string, args: object }[], callId?: string }[], tools: { name: string, description: string,
  input: object }[], maxTokens?: number, system?: string }, options?: { signal?: AbortSignal }) -> Promise<{ text: string,
  calls: { id: string, name: string, args: object | null, invalid?: { text: string, message: string } }[], usage: Usage |
  null, cut?: true }>` — one request of the loop, in the endpoint's own form: the messages so far, the tools offered, the
  most tokens the answer may hold — 1024 on Anthropic and none on an OpenAI-compatible endpoint where `maxTokens` is not
  given —, and `system` as the system prompt; and back the endpoint's text, the tool calls it makes — one whose arguments
  are not JSON with `args` null and `invalid` holding the text it sent and why it cannot be read —, the usage it reported,
  and `cut` where the endpoint ended the answer at the output limit. It carries no call out. The Bridge calls it for an
  endpoint it reaches (MOD-bridge-jobs), so that the loop of a bridged endpoint runs in the tab, each request through the
  Bridge (MOD-runtimes' `bridgeDriver`). Crosses the network; throws `EndpointFailed { diagnosis }` as `endpointDriver`
  does. It throws `EndpointFailed {
  diagnosis }`: the endpoint answered with an error — its message kept, a refused key among them (UC-003) —, the browser
  blocked the call before it reached the endpoint, the network failed, or the endpoint refused the request for its length,
  which the runner reports as not fitting and never answers by cutting the input. One `send` is one exchange — one
  request, or the requests of its tool calls. A request of `send` or of `endpointExchange` that fails is sent again as
  opencode retries it: at most five times, for a rate limit (429), a server error (5xx), or a network error that left
  the endpoint not reachable — never for a context overflow, and never for a call a browser blocked —, after the delay
  the endpoint names in `retry-after-ms` or `retry-after`, else 2 s doubled for each earlier retry with up to 25 % jitter,
  at most 30 s; the last failure is the one thrown. A cancel through the signal aborts the request and the wait.
- `testEndpoint(config: EndpointConfig) -> Promise<{ works: true, model: string, tools: boolean, toolMessage: string | null }
  | { works: false, diagnosis: Diagnosis }>` — sends one short request that offers the model one harmless tool and asks it
  to call it, across the network, and says whether the configuration works and whether the model called the tool —
  `tools` false where the endpoint refused the tool or answered without calling it, with its message where it gave one
  (UC-003 step 5, 5a); it changes nothing stored.
- `listModels(config: EndpointConfig) -> Promise<{ models: string[] } | { diagnosis: Diagnosis }>` — the identifiers of the
  models the endpoint serves, by its kind's own listing request (`GET <baseUrl>/models` for both kinds), with the key where
  the configuration has one; `config.model` is not read. It changes nothing stored. A failure is its `Diagnosis`, as
  `testEndpoint` gives it (UC-040, an endpoint's *Check*).
- `modelContext(config: EndpointConfig) -> Promise<number | null>` — the context in tokens of `config.model` as the endpoint
  states it: its entry in `GET <baseUrl>/models` (`context_length`, `max_model_len`, `max_input_tokens`, `context_window`,
  `max_context_length`, `top_provider.context_length`), else, for an OpenAI-compatible gateway, its entry in LiteLLM's
  `GET <baseUrl>/model/info`; with the key as `listModels` sends it. Null where the endpoint states none or a request
  fails. It changes nothing stored.
- `diagnoseEndpoint(error: unknown, config: EndpointConfig, where: "browser" | "node") -> Diagnosis` — names the reason of a
  failed call: a call a browser refused for want of a cross-origin permission or of the opt-in header a provider requires
  for calls from a browser, with the routes that would work instead; a refused key; an unknown model; a used-up rate
  limit; an unreachable address.
- `holdKey({ kind, baseUrl, key }: { kind: "openai-compatible" | "anthropic", baseUrl: string, key: string | null }) ->
  Promise<{ address: string, close() -> Promise<void> }>` — the key holder, listening at `address`
  (`http://127.0.0.1:<port>`), as *Data* describes it; the endpoint's status, headers and body are its answer, 502 where
  the endpoint does not answer. Node only; crosses the network to the endpoint alone.

## Files

It reads and writes no file.

## Uses

- `MOD-job-runner.Driver`, `MOD-job-runner.DriverInput`, `MOD-job-runner.Usage` — the driver type it implements, its
  input, and the usage it returns; `MOD-job-runner.ToolUse` — the tools an input offers and how a call is carried out.
- `MOD-job-runner.driverPrompt` — the prepared prompt, current draft and canonical findings sent as one message.
- `MOD-participant-list.Participant` — the participant the driver stands for.
