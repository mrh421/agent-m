export const endpointDiagnosisReasons = ["cross-origin refused", "opt-in header missing", "blocked by the browser", "not reachable", "key refused", "model unknown", "too long", "rate limited", "endpoint error"];
const mailOperations = ["test", "read", "find", "drafts", "sent", "store-draft", "update-draft", "show-draft", "confirm-send", "send"];
const endpointConfiguration = { name: "string", kind: ["openai-compatible", "anthropic"], baseUrl: "string", model: "string", key: ["string", "null"] };

export const bridgeApi = {
  defaultPort: 4711,
  tokenHeader: "x-agent-m-bridge-token",
  endpointDiagnosisReasons,
  errors: {
    "token-refused": 401,
    "origin-refused": 403,
    "not-found": 404,
    "invalid-request": 422,
    "upstream-failed": 502,
    paused: 503,
  },
  routes: [
    { method: "GET", path: "/v1/pair", answer: { bridge: { name: "string", version: ["string", "null"], platform: "string" }, origin: "string" } },
    { method: "GET", path: "/v1/agents", answer: { agents: [{ name: "string", version: "string", ready: "boolean", loggedIn: "boolean" }], missing: [{ name: "string" }] } },
    { method: "POST", path: "/v1/jobs", request: { product: "string", record: "string", commit: "string", task: "string?" }, answer: { accepted: "string" } },
    { method: "GET", path: "/v1/jobs", answer: { jobs: [{ id: "string", product: "string", kind: "string", agent: "string", state: "string", started: "string", usage: "object" }] } },
    { method: "GET", path: "/v1/jobs/{id}/log", query: { from: "number" }, answer: { lines: ["string"], next: "number", ended: "boolean" } },
    { method: "POST", path: "/v1/jobs/{id}/cancel", answer: { confirmed: "boolean" } },
    { method: "POST", path: "/v1/ask", request: [{ agent: "string", input: "string" }, { endpoint: endpointConfiguration, input: "string" }, { endpoint: endpointConfiguration, exchange: { messages: ["object"], tools: ["object"] } }], answer: { ask: "string" } },
    { method: "GET", path: "/v1/ask/{ask}", answer: { state: ["running", "done", "failed"], text: ["string", "null"], calls: [{ id: "string", name: "string", args: "object" }], usage: ["object", "null"], error: ["string", "null"] } },
    { method: "POST", path: "/v1/probes/{kind}", kinds: ["agent", "endpoint-models", "endpoint-test", "partitions"], endpointTest: {
      args: endpointConfiguration,
      answer: { works: [true, false], model: "string", diagnosis: { reason: endpointDiagnosisReasons, message: "string", routes: ["ci", "bridge"] } },
    } },
    { method: "POST", path: "/v1/mail/{operation}", operations: mailOperations, request: { connection: "object", args: "object" }, answer: "object",
      confirmSend: { args: { ref: "string", sha256: "string" }, answer: { confirmation: "string" } },
      send: { args: { ref: "string", sha256: "string", confirmation: "string" } },
      errors: { "confirmation-refused": 409, "no-encryption": 502, "login-refused": 502, "upstream-failed": 502 } },
    { method: "GET", path: "/v1/tunnels", answer: { tunnels: [{ name: "string", kind: "string", state: "string", reason: ["string", "null"] }] } },
  ],
};

// A job's hand-over: product, record and commit are text; task is absent or text.
export function validJobRequest(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    && ["product", "record", "commit"].every((name) => typeof value[name] === "string")
    && (!Object.hasOwn(value, "task") || typeof value.task === "string");
}

export function validEndpointTest(value) {
  return value && typeof value === "object" && typeof value.name === "string" && ["openai-compatible", "anthropic"].includes(value.kind)
    && typeof value.baseUrl === "string" && typeof value.model === "string" && (typeof value.key === "string" || value.key === null);
}
