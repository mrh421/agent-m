// The page's client for the Bridge API used by UC-003 endpoint tests.
//
// Module: MOD-bridge-client
// Public: BridgeError, settingsOf, bridgeAt, pair, testBridge, handOver, ask, bridgeJobs, bridgeJobLog, cancelOnBridge, mailCall, probe

import { bridgeApi } from "../bridge-http/index.mjs";
import { bridgePath } from "./paths.mjs";
export { allocatePort, tunnelCommands } from "./tunnels.mjs";
export { proxyConfiguration } from "./proxy.mjs";

export class BridgeError extends Error {
  constructor(name, fields = {}, message = name) {
    super(message);
    this.name = name;
    Object.assign(this, fields);
  }
}

const privateSettings = new WeakMap();
const requestTimeoutMs = 15_000;

function addressOf(address) {
  let url;
  try { url = new URL(address); } catch { throw new TypeError("a Bridge address is an HTTP or HTTPS address"); }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
    throw new TypeError("a Bridge address is HTTP or HTTPS and carries no credential");
  }
  return url.toString().replace(/\/$/, "");
}

function routeOf(address) {
  const { protocol, hostname } = new URL(address);
  if (protocol === "https:") return "jump-host";
  return hostname === "localhost" ? "forward" : "loopback";
}

function neededToken(token) {
  if (typeof token !== "string" || !token) throw new BridgeError("TokenMissing", {}, "The Bridge has no pairing token.");
  return token;
}

function likelyNoAnswer(bridge) {
  const likely = ["not running", "wrong address", "another instance"];
  if (bridge.route === "jump-host") likely.push("certificate not trusted");
  else likely.unshift("blocked by the browser");
  return likely;
}

function basic(login) {
  return `Basic ${btoa(`${login.user}:${login.password}`)}`;
}

function requestHeaders(bridge, contentType = false) {
  const settings = privateSettings.get(bridge);
  const headers = { [bridgeApi.tokenHeader]: neededToken(settings?.token) };
  if (contentType) headers["Content-Type"] = "application/json";
  if (settings?.login) headers.Authorization = basic(settings.login);
  return headers;
}

// Whether `code` is one of the Bridge's error codes: bridgeApi's own, or those of a route (the mail route's).
function isBridgeErrorCode(code) {
  return Object.hasOwn(bridgeApi.errors, code) || bridgeApi.routes.some((route) => route.errors && Object.hasOwn(route.errors, code));
}

async function answerJson(answer) {
  const text = await answer.text();
  try { return JSON.parse(text); } catch { return null; }
}

async function call(bridge, path, init) {
  const address = `${bridge.address}${path}`;
  const headers = requestHeaders(bridge, init.body !== undefined);
  const signal = AbortSignal.timeout(requestTimeoutMs);
  let answer;
  let body;
  try {
    answer = await fetch(address, { ...init, headers, signal, credentials: "omit", cache: "no-store" });
    body = await answerJson(answer);
  } catch (error) {
    if (error?.name === "TimeoutError") throw new BridgeError("Timeout", {}, "The Bridge request timed out.");
    const likely = likelyNoAnswer(bridge);
    const httpsRoute = bridge.route === "loopback" ? " Use the HTTPS route through the jump host." : "";
    throw new BridgeError("NoAnswer", { likely }, `The Bridge gave no answer: ${String(error?.message ?? error)}${httpsRoute}`);
  }
  if (answer.ok) return body;
  if (answer.status === 401) {
    if (bridge.route === "jump-host" && privateSettings.get(bridge)?.login && answer.headers.get("www-authenticate")) {
      throw new BridgeError("JumpHostLoginRefused", {}, "The jump host refused its login.");
    }
    throw new BridgeError("TokenRefused", {}, "The Bridge refused its pairing token.");
  }
  const error = body?.error;
  if (typeof error === "string" && isBridgeErrorCode(error)) {
    throw new BridgeError("BridgeFailed", { error }, typeof body.message === "string" ? body.message : error);
  }
  throw new BridgeError("BridgeFailed", { error: "upstream-failed" }, `The Bridge answered ${answer.status}.`);
}

export function bridgeAt(settings) {
  const address = addressOf(settings?.address);
  const bridge = Object.freeze({ address, route: routeOf(address) });
  privateSettings.set(bridge, Object.freeze({ token: settings?.token, ...(settings?.login ? { login: { ...settings.login } } : {}) }));
  return bridge;
}

// settingsOf(entry, jumpHost) -> BridgeSettings — the settings of a stored Bridge. A Bridge with an address keeps it and carries no login. A Bridge
// at a port is reached at the jump host's HTTPS address with its path (bridgePath, in paths.mjs, which proxyConfiguration uses as well) and the web
// server's login, or, where the jump host has no HTTPS address, by the forward of its port. Throws JumpHostMissing without a jump host. No request.
export function settingsOf(entry, jumpHost) {
  const { name, token } = entry;
  if (typeof entry.address === "string") return { name, address: entry.address, token };
  if (!jumpHost) throw new BridgeError("JumpHostMissing", {}, `Bridge ${name} is reached through the jump host, and none is stored.`);
  if (typeof jumpHost.httpsAddress !== "string" || !jumpHost.httpsAddress) return { name, address: `http://localhost:${entry.port}`, token };
  return { name, address: `${jumpHost.httpsAddress.replace(/\/+$/, "")}${bridgePath(name)}`, token,
    ...(jumpHost.login ? { login: { ...jumpHost.login } } : {}) };
}

// pair(address, pairingToken, login?) -> the settings it was given, { address, token, login? }, which carry in addition, not enumerable, the name
// the Bridge reports (`name`) and the settings to store under it (`settings`: { name, address, token, login? }).
export async function pair(address, pairingToken, login) {
  const bridge = bridgeAt({ address, token: pairingToken, login });
  const answer = await call(bridge, "/v1/pair", { method: "GET" });
  const given = { address: bridge.address, token: pairingToken, ...(login ? { login: { ...login } } : {}) };
  const name = answer?.bridge?.name;
  return Object.defineProperties(given, { name: { value: name }, settings: { value: { name, ...given } } });
}

function apiRoute(method, path) {
  const route = bridgeApi.routes.find((candidate) => candidate.method === method && candidate.path === path);
  if (!route) throw new TypeError(`bridgeApi does not define ${method} ${path}`);
  return route;
}

export async function testBridge(bridge) {
  const pairRoute = apiRoute("GET", "/v1/pair");
  const paired = await call(bridge, pairRoute.path, { method: pairRoute.method });
  const route = apiRoute("GET", "/v1/agents");
  const agents = await call(bridge, route.path, { method: route.method });
  return { ...paired, ...agents };
}

export async function handOver(bridge, job) {
  const route = apiRoute("POST", "/v1/jobs");
  return call(bridge, route.path, { method: route.method, body: JSON.stringify({ product: job.product, record: job.record, commit: job.commit, ...(job.task === undefined ? {} : { task: job.task }) }) });
}

export async function ask(bridge, target, input) {
  const start = apiRoute("POST", "/v1/ask");
  const { ask: id } = await call(bridge, start.path, { method: start.method, body: JSON.stringify({ ...target, input }) });
  const follow = apiRoute("GET", "/v1/ask/{ask}");
  for (;;) {
    const answer = await call(bridge, follow.path.replace("{ask}", id), { method: follow.method });
    if (answer.state === "done") {
      // An exchange the endpoint ended at the output limit keeps its `cut`, which MOD-endpoint-calls' loop continues.
      const done = { text: answer.text, calls: answer.calls ?? [], usage: answer.usage ?? null };
      return answer.cut === true ? { ...done, cut: true } : done;
    }
    if (answer.state === "failed") throw new BridgeError("AskFailed", {}, answer.error ?? "The Bridge ask failed.");
  }
}

// bridgeJobs(bridge) -> the Bridge's jobs — GET /v1/jobs, the `jobs` of its answer. Sent as handOver is sent (call: the Bridge's address and its pairing token).
export async function bridgeJobs(bridge) {
  const route = apiRoute("GET", "/v1/jobs");
  const answer = await call(bridge, route.path, { method: route.method });
  return answer?.jobs;
}

// A job's identifier is one segment of the path of its routes: percent-encoded, as the Bridge decodes it.
const jobPath = (route, id) => route.path.replace("{id}", encodeURIComponent(id));

// bridgeJobLog(bridge, id, from) -> { lines, next, ended } — GET /v1/jobs/{id}/log?from={from}: a job's log from a line on. A job the Bridge does not know is
// BridgeFailed `not-found`, as call() reads the Bridge's error.
export async function bridgeJobLog(bridge, id, from) {
  const route = apiRoute("GET", "/v1/jobs/{id}/log");
  return call(bridge, `${jobPath(route, id)}?from=${from}`, { method: route.method });
}

// cancelOnBridge(bridge, id) -> { confirmed } — POST /v1/jobs/{id}/cancel, which bridgeApi gives no request: nothing travels in a body.
export async function cancelOnBridge(bridge, id) {
  const route = apiRoute("POST", "/v1/jobs/{id}/cancel");
  return call(bridge, jobPath(route, id), { method: route.method });
}

// mailCall(bridge, operation, connection, args) -> the Bridge's answer — POST /v1/mail/{operation} with { connection, args }: the connection with its
// password travels only in that body. The operations and the route's own error codes are bridgeApi's. Throws TypeError for another operation.
export async function mailCall(bridge, operation, connection, args) {
  const route = apiRoute("POST", "/v1/mail/{operation}");
  if (!route.operations.includes(operation)) throw new TypeError(`bridgeApi has no mail operation ${operation}`);
  return call(bridge, route.path.replace("{operation}", operation), { method: route.method, body: JSON.stringify({ connection, args }) });
}

export async function probe(bridge, kind, args) {
  const route = bridgeApi.routes.find((candidate) => candidate.method === "POST" && candidate.path === "/v1/probes/{kind}" && candidate.kinds.includes(kind));
  if (!route) throw new TypeError(`bridgeApi does not define ${kind}`);
  const body = await call(bridge, route.path.replace("{kind}", kind), { method: route.method, body: JSON.stringify({ args }) });
  return body?.answer;
}
