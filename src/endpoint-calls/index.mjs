// MOD-endpoint-calls — direct endpoint tests, diagnoses, and model drivers for browser and Node callers.

import { driverPrompt } from "../job-runner/index.mjs";
import { toolLoop } from "./loop.mjs";
import { RETRY_MAX_RETRIES, retryDelay, retryable, wait } from "./retries.mjs";

/**
 * @typedef {{ name: string, kind: "openai-compatible" | "anthropic", baseUrl: string, model: string, key: string | null }} EndpointConfig
 */

/**
 * @typedef {{ reason: "cross-origin refused" | "opt-in header missing" | "blocked by the browser" | "not reachable" | "key refused" | "model unknown" | "too long" | "rate limited" | "endpoint error", message: string, routes: ("ci" | "bridge")[] }} Diagnosis
 */

const PROBE_PROMPT = "Call agent_m_probe once. It is a harmless capability check.";
const PROBE_TOOL = {
  name: "agent_m_probe",
  description: "Report that tool calling works without changing anything.",
  input: { type: "object", properties: {}, additionalProperties: false },
};
const DRIVER_MAX_TOKENS = 1024;

class EndpointFailed extends Error {
  constructor(diagnosis) {
    super(diagnosis.message);
    this.name = "EndpointFailed";
    this.diagnosis = diagnosis;
  }
}

function endpointUrl(baseUrl, path) {
  return `${baseUrl.replace(/\/+$/, "")}${path}`;
}

function requestFor(config) {
  return providerRequest(config, PROBE_PROMPT, { maxTokens: 64, tools: [PROBE_TOOL] });
}

function openaiMessages(messages) {
  return messages.map((message) => {
    const result = { role: message.role, content: message.text };
    if (message.role === "tool") result.tool_call_id = message.callId;
    if (message.calls?.length) result.tool_calls = message.calls.map((call) => ({
      id: call.id, type: "function", function: { name: call.name, arguments: JSON.stringify(call.args ?? {}) },
    }));
    return result;
  });
}

function anthropicMessages(messages) {
  const result = [];
  for (const message of messages) {
    if (message.role === "assistant") {
      const content = [];
      if (message.text) content.push({ type: "text", text: message.text });
      for (const call of message.calls ?? []) content.push({ type: "tool_use", id: call.id, name: call.name, input: call.args ?? {} });
      result.push({ role: "assistant", content: message.calls?.length ? content : message.text });
      continue;
    }
    const content = message.role === "tool"
      ? { type: "tool_result", tool_use_id: message.callId, content: message.text }
      : { type: "text", text: message.text };
    const previous = result.at(-1);
    // Anthropic receives consecutive tool results and user text in one user turn.
    if (previous?.role === "user") {
      if (typeof previous.content === "string") previous.content = [{ type: "text", text: previous.content }];
      previous.content.push(content);
    } else result.push({ role: "user", content: message.role === "tool" ? [content] : message.text });
  }
  return result;
}

// One request in the endpoint's own form. `maxTokens` is the most the answer may hold — 1024 on Anthropic and none on an OpenAI-compatible endpoint where
// the caller names none —; `system` is sent as the endpoint's system prompt.
function providerRequest(config, prompt, { maxTokens = config.kind === "anthropic" ? DRIVER_MAX_TOKENS : null, signal, messages, tools = [], system = null } = {}) {
  if (config.kind === "anthropic") {
    const headers = {
      "content-type": "application/json",
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    };
    if (config.key !== null) headers["x-api-key"] = config.key;
    const body = { model: config.model, max_tokens: maxTokens,
      messages: messages ? anthropicMessages(messages) : [{ role: "user", content: prompt }] };
    if (system) body.system = system;
    if (tools.length) body.tools = tools.map((tool) => ({ name: tool.name, description: tool.description, input_schema: tool.input }));
    return {
      url: endpointUrl(config.baseUrl, "/messages"),
      init: { method: "POST", headers, signal,
        body: JSON.stringify(body) },
    };
  }

  const headers = { "content-type": "application/json" };
  if (config.key !== null) headers.Authorization = `Bearer ${config.key}`;
  const history = [...(system ? [{ role: "system", content: system }] : []), ...(messages ? openaiMessages(messages) : [{ role: "user", content: prompt }])];
  const body = maxTokens === null ? { model: config.model, messages: history } : { model: config.model, messages: history, max_tokens: maxTokens };
  if (tools.length) body.tools = tools.map((tool) => ({ type: "function", function: { name: tool.name, description: tool.description, parameters: tool.input } }));
  return {
    url: endpointUrl(config.baseUrl, "/chat/completions"),
    init: { method: "POST", headers, signal,
      body: JSON.stringify(body) },
  };
}

async function responseMessage(response) {
  try {
    const body = await response.json();
    return body?.error?.message ?? body?.message ?? `Endpoint returned HTTP ${response.status}.`;
  } catch {
    return `Endpoint returned HTTP ${response.status}.`;
  }
}

function driverRequest(config, prompt, signal) {
  return providerRequest(config, prompt, { signal });
}

function usageOf(usage) {
  if (!usage) return null;
  const inputTokens = usage.prompt_tokens ?? usage.input_tokens ?? null;
  const outputTokens = usage.completion_tokens ?? usage.output_tokens ?? null;
  if (inputTokens === null && outputTokens === null) return null;
  return { inputTokens, outputTokens, minutes: null, cost: null };
}

function answerOf(body, kind) {
  return kind === "anthropic" ? body?.content?.find((part) => part.type === "text")?.text : body?.choices?.[0]?.message?.content;
}

// A call whose arguments are not JSON keeps them as `invalid: { text, message }` — the text it sent and why it cannot be read —, for the loop to answer.
function argumentsOf(call) {
  try {
    return { id: call.id, name: call.function.name, args: JSON.parse(call.function.arguments) };
  } catch (error) {
    return { id: call.id, name: call.function.name, args: null, invalid: { text: String(call.function.arguments), message: error.message } };
  }
}

// The answer of one request: its text, the calls it makes, the usage reported, and `cut` where it ended at the output limit — finish_reason `length`,
// stop_reason `max_tokens`.
function exchangeAnswer(body, kind) {
  const calls = kind === "anthropic"
    ? (body?.content ?? []).filter((part) => part.type === "tool_use").map((part) => ({ id: part.id, name: part.name, args: part.input }))
    : (body?.choices?.[0]?.message?.tool_calls ?? []).map(argumentsOf);
  const text = kind === "anthropic"
    ? (body?.content ?? []).filter((part) => part.type === "text").map((part) => part.text).join("")
    : body?.choices?.[0]?.message?.content ?? "";
  const cut = kind === "anthropic" ? body?.stop_reason === "max_tokens" : body?.choices?.[0]?.finish_reason === "length";
  return { text, calls, usage: usageOf(body?.usage), ...(cut ? { cut } : {}) };
}

// A request sent, and sent again where it failed as opencode retries — a rate limit, a server error or a network error, up to five times, after the delay
// retries.mjs gives; never a context overflow. Returns the response that is ok; throws EndpointFailed with the last failure's diagnosis.
async function sentWithRetries(config, { url, init }, where, signal) {
  for (let attempt = 1; ; attempt++) {
    let diagnosis, status, headers = null;
    try {
      const response = await fetch(url, { ...init, signal });
      if (response.ok) return response;
      status = response.status;
      headers = response.headers;
      diagnosis = diagnoseEndpoint({ status, message: await responseMessage(response) }, config, where);
    } catch (error) {
      if (error?.name === "AbortError") throw error;
      diagnosis = diagnoseEndpoint(error, config, where);
    }
    if (attempt > RETRY_MAX_RETRIES || !retryable(status, diagnosis)) throw new EndpointFailed(diagnosis);
    await wait(retryDelay(attempt, headers), signal);
  }
}

// One provider request: return calls to the caller without executing or following them. A failed request is sent again as retries.mjs says.
export async function endpointExchange(config, exchange, { signal } = {}) {
  const where = typeof window === "undefined" ? "node" : "browser";
  const request = providerRequest(config, null, { messages: exchange.messages, tools: exchange.tools, system: exchange.system ?? null,
    ...(exchange.maxTokens ? { maxTokens: exchange.maxTokens } : {}) });
  const response = await sentWithRetries(config, request, where, signal);
  try {
    return exchangeAnswer(await response.json(), config.kind);
  } catch (error) {
    throw new EndpointFailed(diagnoseEndpoint({ status: response.status, message: error.message }, config, where));
  }
}

// endpointDriver(config, participant, exchange?, { system }?) -> Driver — one direct exchange for a prepared job prompt, or, where the input offers tools,
// the requests of the execution loop (loop.mjs) — each one call of `exchange`, which is endpointExchange unless the caller gives its own —, `system` sent as
// the endpoint's system prompt in the loop. A failed request is sent again as retries.mjs says; no route selection, input cutting or part duplication
// belongs here.
export function endpointDriver(config, participant, exchange = endpointExchange, { system = null } = {}) {
  return { participant, async send(input, options = {}) {
    if (input.tools?.definitions?.length) {
      return toolLoop(config, input, { exchange: exchange ?? endpointExchange, signal: options.signal, system,
        context: Number.isInteger(participant?.context) ? participant.context : null });
    }
    const where = typeof window === "undefined" ? "node" : "browser";
    const response = await sentWithRetries(config, driverRequest(config, driverPrompt(input), options.signal), where, options.signal);
    const body = await response.json();
    return { text: answerOf(body, config.kind), usage: usageOf(body?.usage) };
  } };
}

// The probe observes a harmless proposed call; it never carries that call out.
// It changes no setting and retries nothing: one invocation constructs exactly one fetch request.
export async function testEndpoint(config) {
  const { url, init } = requestFor(config);
  const where = typeof window === "undefined" ? "node" : "browser";
  try {
    const response = await endpointResponse(config, { url, init }, where);
    if (response.ok) {
      const answer = exchangeAnswer(await response.json(), config.kind);
      const tools = answer.calls.some((call) => call.name === PROBE_TOOL.name);
      return { works: true, model: config.model, tools, toolMessage: tools ? null : answer.text || null };
    }
    const message = await responseMessage(response);
    const toolRefusal = [400, 422, 501].includes(response.status)
      && /(?:tools?|function calling).*(?:not support|unsupported|not allowed)|(?:not support|unsupported).*(?:tools?|function calling)/i.test(message);
    if (toolRefusal) return { works: true, model: config.model, tools: false, toolMessage: message };
    return { works: false, diagnosis: diagnoseEndpoint({ status: response.status, message }, config, where) };
  } catch (error) {
    return { works: false, diagnosis: error.diagnosis ?? diagnoseEndpoint(error, config, where) };
  }
}

// listModels(config) -> { models } | { diagnosis } — the identifiers of the models the endpoint serves, by GET <baseUrl>/models with the key where the
// configuration has one; config.model is not read. One request, nothing stored; a failure is the diagnosis testEndpoint gives.
export async function listModels(config) {
  const where = typeof window === "undefined" ? "node" : "browser";
  const headers = config.kind === "anthropic"
    ? { "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true", ...(config.key === null ? {} : { "x-api-key": config.key }) }
    : (config.key === null ? {} : { Authorization: `Bearer ${config.key}` });
  try {
    const response = await endpointResponse(config, { url: endpointUrl(config.baseUrl, "/models"), init: { method: "GET", headers } }, where);
    if (response.ok) return { models: ((await response.json())?.data ?? []).map((model) => model?.id).filter((id) => typeof id === "string") };
    return { diagnosis: diagnoseEndpoint({ status: response.status, message: await responseMessage(response) }, config, where) };
  } catch (error) {
    return { diagnosis: error.diagnosis ?? diagnoseEndpoint(error, config, where) };
  }
}

// The fields in which a model listing states a model's context in tokens: OpenRouter's context_length, vLLM's max_model_len, LiteLLM's and
// Anthropic's max_input_tokens, and the names other providers use for it.
const CONTEXT_FIELDS = ["context_length", "max_model_len", "max_input_tokens", "context_window", "max_context_length"];
const contextOf = (entry) => {
  for (const value of [...CONTEXT_FIELDS.map((field) => entry?.[field]), entry?.top_provider?.context_length]) {
    if (Number.isInteger(value) && value > 0) return value;
  }
  return null;
};

// modelContext(config) -> number | null — the context in tokens of config.model as the endpoint states it: its entry in GET <baseUrl>/models, else,
// for an OpenAI-compatible gateway, its entry in LiteLLM's GET <baseUrl>/model/info (model_info). With the key where the configuration has one; null
// where the endpoint states none, or a request fails. Nothing is stored.
export async function modelContext(config) {
  const where = typeof window === "undefined" ? "node" : "browser";
  const headers = config.kind === "anthropic"
    ? { "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true", ...(config.key === null ? {} : { "x-api-key": config.key }) }
    : (config.key === null ? {} : { Authorization: `Bearer ${config.key}` });
  const listed = async (path) => {
    try {
      const response = await endpointResponse(config, { url: endpointUrl(config.baseUrl, path), init: { method: "GET", headers } }, where);
      return response.ok ? (await response.json())?.data ?? [] : [];
    } catch { return []; }
  };
  const model = (await listed("/models")).find((entry) => entry?.id === config.model);
  if (contextOf(model)) return contextOf(model);
  if (config.kind === "anthropic") return null;
  const info = (await listed("/model/info")).find((entry) => entry?.model_name === config.model);
  return contextOf(info?.model_info) ?? (Number.isInteger(info?.model_info?.max_tokens) && info.model_info.max_tokens > 0 ? info.model_info.max_tokens : null);
}

async function endpointResponse(config, { url, init }, where) {
  try {
    return await fetch(url, init);
  } catch (error) {
    if (error?.name === "AbortError") throw error;
    throw new EndpointFailed(diagnoseEndpoint(error, config, where));
  }
}

// diagnoseEndpoint(error, config, where) -> Diagnosis — preserve provider/browser wording where it exists. Browser fetch
// failures deliberately remain generic unless their observable message identifies CORS or the direct-browser opt-in.
export function diagnoseEndpoint(error, config, where) {
  const status = Number(error?.status ?? error?.response?.status);
  const message = String(error?.message ?? error ?? "Endpoint request failed.");
  if (status === 401 || status === 403) return { reason: "key refused", message, routes: [] };
  if (status === 404) return { reason: "model unknown", message, routes: [] };
  if (status === 413 || /too (large|long)|maximum context|context length/i.test(message)) return { reason: "too long", message, routes: [] };
  if (status === 429 || /rate limit/i.test(message)) return { reason: "rate limited", message, routes: [] };
  if (Number.isFinite(status)) return { reason: "endpoint error", message, routes: [] };

  if (where === "browser") {
    const routes = ["ci", "bridge"];
    if (/anthropic-dangerous-direct-browser-access|opt.?in.*header|header.*opt.?in/i.test(message)) {
      return { reason: "opt-in header missing", message, routes };
    }
    if (/cors|cross.origin|access-control-allow-origin/i.test(message)) {
      return { reason: "cross-origin refused", message, routes };
    }
    return { reason: "blocked by the browser", message, routes };
  }

  return { reason: "not reachable", message, routes: [] };
}
