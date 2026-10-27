// MOD-agent-processes — the supported coding-agent CLIs on this machine. Command options, login interpretation,
// installation guidance and credential-variable names are rows of agents.md; this module only reads and executes them.

import { readFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { documentFindings, loadSchema, readRegister } from "../documents/index.mjs";
import { processDriver } from "./processes.mjs";
export { stopTree } from "./processes.mjs";

const OWNER = "MOD-agent-processes";
const SCHEMA_FILE = new URL("./agents.schema.md", import.meta.url);
const REGISTER_FILE = new URL("./agents.md", import.meta.url);
const schema = loadSchema(readFileSync(SCHEMA_FILE, "utf8"), OWNER);
const register = readRegister(schema, "src/agent-processes/agents.md", readFileSync(REGISTER_FILE, "utf8"));
const findings = documentFindings(schema, register.document).filter((finding) => finding.kind === "error");
if (findings.length || !register.rows.length) {
  const reasons = findings.map((finding) => finding.what);
  if (!register.rows.length) reasons.push("the supported-agent register has no readable rows");
  throw new Error(`${OWNER}: agent register is invalid: ${reasons.join("; ")}`);
}

/** @typedef {{ name: string, installed: boolean, version: string | null, loggedIn: boolean | null, login: string,
 *   install: Record<"macos" | "windows" | "linux", string> }} Agent */

function json(value, column) {
  try { return JSON.parse(value); } catch { throw new Error(`${OWNER}: ${column} in agents.md is not JSON`); }
}
function rowOf(cells) {
  return {
    name: cells.Agent,
    command: cells.Command,
    version: json(cells.Version, "Version"),
    task: json(cells.Task, "Task"),
    login: json(cells["Login check"], "Login check"),
    keyVariable: cells["Key variable"] ?? null,
    endpoint: cells.Endpoint == null ? null : json(cells.Endpoint, "Endpoint"),
    install: { macos: cells["Install macos"], windows: cells["Install windows"], linux: cells["Install linux"] },
  };
}
const rows = register.rows.map(({ cells }) => rowOf(cells));

function invoke(command, args, env = ownLoginEnvironment(), input = null) {
  return new Promise((resolve) => {
    let stdout = "", stderr = "";
    const child = spawn(command, args, { stdio: [input == null ? "ignore" : "pipe", "pipe", "pipe"], env });
    if (input != null) {
      child.stdin.on("error", () => {}); // an agent that exits unread is judged by its exit status
      child.stdin.end(input);
    }
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", (error) => resolve({ ok: false, status: null, stdout, stderr, error }));
    child.on("close", (status) => resolve({ ok: status === 0, status, stdout, stderr, error: null }));
  });
}

const versionOf = (row, output) => (new RegExp(row.version.pattern).exec(output)?.[1] ?? output.trim()) || null;
function loginMatches(login, result) {
  if (login.loggedIn.exitCode !== undefined) return result.status === login.loggedIn.exitCode;
  if (login.loggedIn.contains !== undefined) return result.stdout.includes(login.loggedIn.contains);
  if (login.loggedIn.countPattern !== undefined) {
    const count = Number(new RegExp(login.loggedIn.countPattern).exec(result.stdout)?.[1] ?? 0);
    return count >= login.loggedIn.minimumCount;
  }
  return false;
}
const missingAgent = (row) => ({ name: row.name, installed: false, version: null, loggedIn: null, login: row.login.login, install: row.install });
function ownLoginEnvironment() {
  const credentials = new Set(rows.map((row) => row.keyVariable).filter((name) => name && name !== "—"));
  const environment = {};
  for (const name of Object.keys(process.env)) {
    if (!credentials.has(name)) environment[name] = process.env[name];
  }
  return environment;
}
function valueAt(value, path) {
  return path.reduce((part, key) => part?.[key], value);
}
function answerFor(task, stdout) {
  if (task.finalAnswer.format === "text") return stdout.trim();
  const events = stdout.split("\n").filter(Boolean).map((line) => JSON.parse(line));
  const values = events.filter((event) => event.type === task.finalAnswer.eventType)
    .map((event) => valueAt(event, task.finalAnswer.path)).filter((value) => typeof value === "string");
  return values.at(-1)?.trim() ?? "";
}
function usageFor(task, stdout) {
  if (!task.usage) return null;
  const events = stdout.split("\n").filter(Boolean).map((line) => JSON.parse(line));
  const reports = events.filter((event) => event.type === task.usage.eventType)
    .map((event) => valueAt(event, task.usage.path)).filter((value) => value && typeof value === "object");
  if (!reports.length) return null;
  // An agent that reports per step (opencode's step_finish) reports each step's own tokens: the job used their sum.
  const total = (key) => {
    const counts = reports.map((tokens) => tokens[key]).filter((count) => typeof count === "number");
    return counts.length ? counts.reduce((sum, count) => sum + count, 0) : null;
  };
  return { inputTokens: total(task.usage.input), outputTokens: total(task.usage.output), minutes: null, cost: null };
}
const agentConfiguration = (name) => rows.find((row) => row.name === name) ?? null;

export function agentDriver(agent, options, participant) {
  return processDriver(agent, options, participant, {
    configuration: agentConfiguration,
    answer: answerFor,
    usage: usageFor,
    ownLoginEnvironment,
  });
}

/** @returns {Promise<Agent[]>} */
export async function installedAgents() {
  return Promise.all(rows.map(async (row) => {
    const version = await invoke(row.command, row.version.args);
    if (version.error?.code === "ENOENT") return missingAgent(row);
    const login = await invoke(row.command, row.login.args);
    const loggedIn = loginMatches(row.login, login);
    return { name: row.name, installed: true, version: versionOf(row, version.stdout), loggedIn, login: row.login.login, install: row.install };
  }));
}

/** @param {Agent} agent */
export async function testAgent(agent) {
  const row = rows.find((candidate) => candidate.name === agent?.name);
  if (!row || !agent.installed) return { answered: false, reason: "agent is not installed" };
  const result = await invoke(row.command, row.task.args, ownLoginEnvironment(), "Reply with one word: ok.");
  if (!result.ok) return { answered: false, reason: (result.stderr || result.error?.message || `exit ${result.status}`).trim() };
  let answer;
  try {
    answer = answerFor(row.task, result.stdout);
  } catch (error) {
    return { answered: false, reason: error instanceof Error ? error.message : String(error) };
  }
  if (row.task.finalAnswer.oneWord && !/^\S+$/.test(answer)) return { answered: false, reason: "agent did not answer with one word" };
  return { answered: true, version: agent.version };
}
