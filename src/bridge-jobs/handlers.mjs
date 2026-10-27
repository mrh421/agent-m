import { agentDriver, installedAgents, testAgent } from "../agent-processes/index.mjs";
import { endpointDriver, endpointExchange, listModels as nodeListModels, testEndpoint as nodeTestEndpoint } from "../endpoint-calls/index.mjs";
import { listPartitions } from "./probes.mjs";
import { enclosureOf } from "./enclosures.mjs";
import { cancelJob, handOver, jobLog, listJobs } from "./watch.mjs";

function validEndpointConfig(value) {
  return value && typeof value === "object" && typeof value.name === "string"
    && ["openai-compatible", "anthropic"].includes(value.kind) && typeof value.baseUrl === "string"
    && typeof value.model === "string" && (typeof value.key === "string" || value.key === null);
}

function failure(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

// An ask's failure as the page reads it: the failure and, where the agent said anything, its last output.
const reasonOf = (error) => (error?.lastOutput ? `${error.message}: ${error.lastOutput}` : error?.message ?? "The agent failed.");

// An endpoint ask's failure as the page reads it: the endpoint's diagnosis — its reason and its own words — with the key, where the endpoint
// quotes it, replaced.
const endpointReason = (error, key) => {
  const said = error?.diagnosis ? `${error.diagnosis.reason}: ${error.diagnosis.message}` : error?.message ?? "The endpoint failed.";
  return key ? said.split(key).join("[key]") : said;
};

// A drafting request to a model endpoint, sent in Node with MOD-endpoint-calls' driver; the configuration lives in this call alone.
function asked({ name, kind, baseUrl, model, key }, prompt) {
  return endpointDriver({ name, kind, baseUrl, model, key }, { name }).send({ prompt, parts: [], output: null, findings: [], previous: null, workdir: null });
}

// A drafting request to an agent, in its working folder and its enclosure, through its driver: the answer and the usage, or the failure. The agent may
// write nothing of the working folder — its clones are the Bridge's —, only its own home and temporary files.
async function drafted({ name, folder }, prompt, enclosures) {
  const enclosure = await enclosureOf(enclosures, folder);
  await enclosure.prepare({ writable: [], readable: [] });
  const agent = (await installedAgents({ enclosure, workdir: folder })).find((candidate) => candidate.name === name);
  return agentDriver(agent, { workdir: folder, keyVariable: null, enclosure, writable: [] }, { name })
    .send({ prompt, parts: [], output: null, findings: [], previous: null, workdir: null });
}

/**
 * jobHandlers({ testEndpoint, listModels, partitions, agents, enclosures }) — the handlers of the jobs routes. `agents` are the agents the Bridge offers, as its
 * settings name them with their working folders: `{ name, folder }`; `enclosures(folder)` gives each its enclosure (ARC-054), without which none of them is
 * started. The asks in flight are kept in memory only.
 */
export function jobHandlers({ testEndpoint = nodeTestEndpoint, listModels = nodeListModels, partitions = listPartitions, agents = [], enclosures = null } = {}) {
  const offered = (name) => (typeof name === "string" ? agents.find((candidate) => candidate.name === name) : undefined);
  const asks = new Map();
  // Whether an offered agent with a working folder is logged in in its enclosure: false where the enclosure does not work.
  const loggedInEnclosed = async ({ name, folder }) => {
    try {
      const enclosure = await enclosureOf(enclosures, folder);
      await enclosure.prepare({ writable: [], readable: [] });
      return (await installedAgents({ enclosure, workdir: folder })).find((agent) => agent.name === name)?.loggedIn === true;
    } catch { return false; }
  };
  return {
    "GET /v1/agents": async () => {
      const found = await installedAgents();
      const listed = [];
      for (const agent of found.filter((each) => each.installed && offered(each.name))) {
        const { folder } = offered(agent.name);
        // An agent with a working folder is asked in its enclosure, where it will run; one without is not offered for work, and is said of as it is.
        const loggedIn = folder ? await loggedInEnclosed(offered(agent.name)) : agent.loggedIn;
        listed.push({ name: agent.name, version: agent.version, ready: loggedIn === true && Boolean(folder), loggedIn });
      }
      return { agents: listed, missing: found.filter((agent) => !agent.installed).map((agent) => ({ name: agent.name })) };
    },
    // The jobs this Bridge took since it started, with their live states, in the form MOD-bridge-client's bridgeJobs reads.
    "GET /v1/jobs": async () => ({ jobs: listJobs() }),
    // A job's log from a line on, as it grows; `from` is the index of the first line wanted.
    "GET /v1/jobs/{id}/log": async ({ params, query }) => {
      const from = query?.from === undefined ? 0 : Number(query.from);
      if (query?.from !== undefined && (String(query.from).trim() === "" || !Number.isInteger(from) || from < 0)) throw failure("invalid-request", "The first line wanted is a whole number of at least 0.");
      return jobLog(params.id, from);
    },
    // Stops the agent's process; answers once it has ended, after which the job commits nothing more.
    "POST /v1/jobs/{id}/cancel": async ({ params }) => cancelJob(params.id),
    "POST /v1/jobs": async ({ body }) => {
      if (![body?.product, body?.record, body?.commit].every((value) => typeof value === "string" && value)) {
        throw failure("invalid-request", "A job is handed over with its product, its record and its commit.");
      }
      return { accepted: await handOver({ product: body.product, record: body.record, commit: body.commit, task: body.task }) };
    },
    "POST /v1/probes/agent": async ({ body }) => {
      const wanted = offered(body?.args?.agent);
      if (!wanted) throw failure("invalid-request", "This Bridge does not offer that agent.");
      let enclosure;
      try {
        enclosure = await enclosureOf(enclosures, wanted.folder);
        await enclosure.prepare({ writable: [], readable: [] });
      } catch (error) {
        return { answer: { answered: false, reason: error.message } };
      }
      const found = (await installedAgents({ enclosure, workdir: wanted.folder })).find((agent) => agent.name === wanted.name);
      return { answer: await testAgent(found, { enclosure, workdir: wanted.folder }) };
    },
    "POST /v1/ask": async ({ body }) => {
      // Every answer names its calls: those an exchange of a tool loop made, [] for any other request (MOD-bridge-http's route table).
      const entry = { state: "running", text: null, calls: [], usage: null, error: null }, ask = globalThis.crypto.randomUUID();
      if (body?.endpoint !== undefined && body.exchange !== undefined) {
        if (!validEndpointConfig(body.endpoint) || !Array.isArray(body.exchange?.messages) || !Array.isArray(body.exchange?.tools)) {
          throw failure("invalid-request", "An exchange ask carries a valid endpoint configuration and an exchange of messages and tools, both lists.");
        }
        const key = body.endpoint.key;
        asks.set(ask, entry);
        // `cut` — the endpoint ended its answer at the output limit — travels with the answer, so that the page's loop continues it as MOD-endpoint-calls does.
        endpointExchange(body.endpoint, body.exchange).then(({ text, calls, usage, cut }) => Object.assign(entry, { state: "done", text, calls, usage, ...(cut ? { cut: true } : {}) }),
          (error) => Object.assign(entry, { state: "failed", error: endpointReason(error, key) }));
        return { ask };
      }
      if (body?.endpoint !== undefined) {
        if (!validEndpointConfig(body.endpoint) || typeof body.input !== "string") throw failure("invalid-request", "An endpoint ask carries a valid endpoint configuration and an input that is text.");
        const key = body.endpoint.key;
        asks.set(ask, entry);
        asked(body.endpoint, body.input).then(({ text, usage }) => Object.assign(entry, { state: "done", text, usage }),
          (error) => Object.assign(entry, { state: "failed", error: endpointReason(error, key) }));
        return { ask };
      }
      const wanted = offered(body?.agent);
      if (!wanted?.folder || typeof body.input !== "string") throw failure("invalid-request", "This Bridge offers no such agent with a working folder, or the input is no text.");
      asks.set(ask, entry);
      drafted(wanted, body.input, enclosures).then(({ text, usage }) => Object.assign(entry, { state: "done", text, usage }),
        (error) => Object.assign(entry, { state: "failed", error: reasonOf(error) }));
      return { ask };
    },
    "GET /v1/ask/{ask}": async ({ params }) => {
      if (!asks.has(params.ask)) throw failure("not-found", "This Bridge knows no such ask.");
      return { ...asks.get(params.ask) };
    },
    "POST /v1/probes/endpoint-test": async ({ body }) => {
      if (!validEndpointConfig(body?.args)) throw failure("invalid-request", "Endpoint-test configuration is invalid.");
      try {
        const config = { name: body.args.name, kind: body.args.kind, baseUrl: body.args.baseUrl, model: body.args.model, key: body.args.key };
        return { answer: await testEndpoint(config) };
      } catch (error) {
        throw failure("upstream-failed", error?.message ?? "Bridge endpoint-test handler failed.");
      }
    },
    "POST /v1/probes/endpoint-models": async ({ body }) => {
      if (!validEndpointConfig(body?.args)) throw failure("invalid-request", "Endpoint-models configuration is invalid.");
      try {
        const config = { name: body.args.name, kind: body.args.kind, baseUrl: body.args.baseUrl, model: body.args.model, key: body.args.key };
        return { answer: await listModels(config) };
      } catch (error) {
        throw failure("upstream-failed", error?.message ?? "Bridge endpoint-models handler failed.");
      }
    },
    "POST /v1/probes/partitions": async () => ({ answer: { partitions: await partitions() } }),
  };
}
