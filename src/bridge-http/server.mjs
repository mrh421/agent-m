import { bridgeApi, validEndpointTest, validJobRequest } from "./protocol.mjs";
import { currentToken, pairingRenewals } from "./pairing.mjs";

const loopback = new Set(["127.0.0.1", "::1", "localhost"]);
const reply = (response, status, value, origin) => {
  response.writeHead(status, { "content-type": "application/json", ...(origin ? { "access-control-allow-origin": origin, vary: "Origin" } : {}) });
  response.end(JSON.stringify(value));
};
const error = (response, status, code, message, origin) => reply(response, status, { error: code, message }, origin);
const match = (route, method, path) => {
  if (route.method !== method) return null;
  const names = [], expression = route.path.replace(/\{([^}]+)\}/g, (_all, name) => { names.push(name); return "([^/]+)"; });
  const found = new RegExp(`^${expression}$`).exec(path);
  return found && Object.fromEntries(names.map((name, index) => [name, decodeURIComponent(found[index + 1])]));
};

export async function serveBridge(config, handlers) {
  if (!loopback.has(config.host)) { const rejected = new Error(`Bridge bind refused: ${config.host}`); rejected.name = "BindRefused"; throw rejected; }
  const token = await currentToken(config.dataFolder);
  const http = globalThis.process?.getBuiltinModule?.("node:http");
  if (!http) throw new Error("Bridge server requires Node.");
  let paired = null; // { origin, renewals }: the first request since the start or the last pairAnew that carried the token in force; memory only
  const server = http.createServer(async (request, response) => {
    const started = Date.now(), path = new URL(request.url, "http://localhost").pathname;
    const origin = request.headers.origin;
    const log = (status) => console.info(JSON.stringify({ method: request.method, path, status, duration: Date.now() - started }));
    if (origin !== config.origin) { error(response, 403, "origin-refused", "Bridge origin refused."); log(403); return; }
    if (request.method === "OPTIONS") {
      const headers = { "access-control-allow-origin": config.origin, "access-control-allow-methods": "GET, POST, OPTIONS", "access-control-allow-headers": "content-type, x-agent-m-bridge-token", vary: "Origin" };
      if (request.headers["access-control-request-private-network"] === "true") headers["access-control-allow-private-network"] = "true";
      response.writeHead(204, headers);
      response.end(); log(204); return;
    }
    if (request.headers[bridgeApi.tokenHeader] !== await currentToken(config.dataFolder)) { error(response, 401, "token-refused", "Bridge token refused.", config.origin); log(401); return; }
    if (paired?.renewals !== pairingRenewals(config.dataFolder)) paired = { origin, renewals: pairingRenewals(config.dataFolder) };
    const startsWork = request.method === "POST" && (path === "/v1/jobs" || path === "/v1/ask" || path.startsWith("/v1/probes/") || path.startsWith("/v1/mail/"));
    if (config.paused() && startsWork) { error(response, 503, "paused", "Bridge is paused.", config.origin); log(503); return; }
    if (request.method === "GET" && path === "/v1/pair") { reply(response, 200, { bridge: { name: config.name(), version: config.version ?? null, platform: process.platform }, origin: config.origin }, config.origin); log(200); return; }
    const selected = bridgeApi.routes.map((candidate) => [candidate, match(candidate, request.method, path)]).find(([_candidate, params]) => params !== null);
    const route = selected?.[0], params = selected?.[1];
    if (route?.path === "/v1/tunnels") {
      const handler = handlers.tunnels?.[`${request.method} ${path}`];
      if (!handler) { error(response, 404, "not-found", "Bridge handler not found.", config.origin); log(404); return; }
      try { reply(response, 200, await handler({ params: {}, body: {} }), config.origin); log(200); }
      catch (failure) {
        const code = Object.hasOwn(bridgeApi.errors, failure.code) ? failure.code : "upstream-failed";
        error(response, bridgeApi.errors[code], code, failure.message || "Bridge handler failed.", config.origin);
        log(bridgeApi.errors[code]);
      }
      return;
    }
    if (!route) { error(response, 404, "not-found", "Bridge route not found.", config.origin); log(404); return; }
    if (route.path === "/v1/mail/{operation}") {
      const handler = route.operations.includes(params.operation) ? handlers.mail?.[`POST /v1/mail/${params.operation}`] : undefined;
      let text = ""; for await (const chunk of request) text += chunk;
      if (!handler) { error(response, 404, "not-found", "Bridge handler not found.", config.origin); log(404); return; }
      let body;
      try { body = JSON.parse(text); } catch { error(response, 422, "invalid-request", "Bridge request is not JSON.", config.origin); log(422); return; }
      const errors = { ...bridgeApi.errors, ...route.errors };
      try { reply(response, 200, await handler({ params, body }), config.origin); log(200); }
      catch (failure) {
        const code = Object.hasOwn(errors, failure.code) ? failure.code : "upstream-failed";
        error(response, errors[code], code, failure.message || "Bridge handler failed.", config.origin);
        log(errors[code]);
      }
      return;
    }
    if (route.path !== "/v1/probes/{kind}") {
      let body = {};
      if (request.method === "POST") {
        let text = ""; for await (const chunk of request) text += chunk;
        try { body = text ? JSON.parse(text) : {}; } catch { error(response, 422, "invalid-request", "Bridge request is not JSON.", config.origin); log(422); return; }
      }
      if (route.path === "/v1/jobs" && request.method === "POST" && !validJobRequest(body)) { error(response, 422, "invalid-request", "Job hand-over is invalid.", config.origin); log(422); return; }
      const key = `${route.method} ${route.path}`, handler = handlers.jobs?.[key];
      if (!handler) { error(response, 404, "not-found", "Bridge handler not found.", config.origin); log(404); return; }
      try { reply(response, 200, await handler({ params, query: Object.fromEntries(new URL(request.url, "http://localhost").searchParams), body }), config.origin); log(200); }
      catch (failure) { const code = Object.hasOwn(bridgeApi.errors, failure.code) ? failure.code : "upstream-failed"; error(response, bridgeApi.errors[code], code, failure.message || "Bridge handler failed.", config.origin); log(bridgeApi.errors[code]); }
      return;
    }
    if (request.method !== "POST" || !path.startsWith("/v1/probes/")) { error(response, 404, "not-found", "Bridge route not found.", config.origin); log(404); return; }
    const kind = decodeURIComponent(path.slice("/v1/probes/".length));
    const probeRoute = bridgeApi.routes.find((candidate) => candidate.method === "POST" && candidate.path === "/v1/probes/{kind}" && candidate.kinds?.includes(kind));
    if (!probeRoute) { error(response, 404, "not-found", "Bridge probe not found.", config.origin); log(404); return; }
    let body = "";
    for await (const chunk of request) body += chunk;
    let parsed;
    try { parsed = JSON.parse(body); } catch { error(response, 422, "invalid-request", "Bridge request is not JSON.", config.origin); log(422); return; }
    if (kind === "endpoint-test" && !validEndpointTest(parsed?.args)) { error(response, 422, "invalid-request", "Endpoint-test configuration is invalid.", config.origin); log(422); return; }
    const handler = handlers.jobs?.[`${request.method} ${path}`] ?? handlers.jobs?.[`POST /v1/probes/${kind}`];
    if (!handler) { error(response, 404, "not-found", "Bridge handler not found.", config.origin); log(404); return; }
    try { reply(response, 200, await handler({ params: { kind }, body: parsed }), config.origin); log(200); }
    catch (failure) {
      const code = Object.hasOwn(bridgeApi.errors, failure.code) ? failure.code : "upstream-failed";
      error(response, bridgeApi.errors[code], code, failure.message || "Bridge handler failed.", config.origin);
      log(bridgeApi.errors[code]);
    }
  });
  await new Promise((resolve, reject) => {
    const started = () => { server.off("error", failed); resolve(); };
    const failed = (failure) => {
      server.off("listening", started);
      if (failure.code === "EADDRINUSE") failure.name = "PortInUse";
      reject(failure);
    };
    server.once("error", failed);
    server.once("listening", started);
    server.listen(config.port, config.host);
  });
  const address = server.address(), host = address.family === "IPv6" ? `[${address.address}]` : address.address;
  const pairedWith = () => (paired?.renewals === pairingRenewals(config.dataFolder) ? paired.origin : null);
  return { address: `http://${host}:${address.port}`, token, pairedWith, close: () => new Promise((resolve, reject) => {
    server.close((failure) => failure ? reject(failure) : resolve());
    server.closeIdleConnections?.();
    server.closeAllConnections?.();
  }) };
}
