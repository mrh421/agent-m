// MOD-agent-processes — process-backed Driver construction (ITM-321).

import { spawn } from "node:child_process";
import { driverPrompt } from "../job-runner/index.mjs";

function failure(name, message, details = {}) {
  return Object.assign(new Error(message), { name, ...details });
}

function isCi() {
  return process.env.CI === "true" || process.env.GITHUB_ACTIONS === "true";
}

function hasCiKey(keyVariable) {
  return isCi() && typeof keyVariable === "string";
}

function environmentFor(keyVariable, ownLoginEnvironment) {
  if (hasCiKey(keyVariable)) return undefined;
  return ownLoginEnvironment();
}

/**
 * stopTree(child, signal = "SIGKILL") -> Promise<void> — sends `signal` to the process group of a child started detached, so that every process it started
 * receives it; on Windows, ends the child's tree with taskkill, whatever the signal. A group that is already gone is no failure.
 */
export function stopTree(child, signal = "SIGKILL") {
  if (!child.pid) return Promise.resolve();
  if (process.platform !== "win32") {
    try {
      process.kill(-child.pid, signal);
      return Promise.resolve();
    } catch (error) {
      if (error?.code === "ESRCH") return Promise.resolve();
      return Promise.reject(error);
    }
  }
  return new Promise((resolve, reject) => {
    const killer = spawn("taskkill", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore", windowsHide: true });
    killer.once("error", reject);
    killer.once("close", (status) => {
      if (status === 0) resolve();
      else reject(Object.assign(new Error(`taskkill exited ${status}`), { exitCode: status }));
    });
  });
}

function endpointOptions(row, endpoint, keyVariable) {
  if (endpoint == null) return { args: [], env: {} };
  const configuration = row.endpoint?.[endpoint.kind];
  if (!configuration) throw failure("EndpointUnsupported", "the selected agent does not support this endpoint");
  const values = { baseUrl: endpoint.baseUrl, model: endpoint.model, node: process.execPath,
    keyVariableBase64: Buffer.from(keyVariable ?? "").toString("base64"),
    keyReference: hasCiKey(keyVariable) ? `{env:${keyVariable}}` : undefined };
  const render = (value) => {
    if (typeof value === "string") {
      if (value === "{keyReference}") return values.keyReference;
      return value.replace(/\{(baseUrl|model|node|keyVariableBase64)\}/g, (_, name) => values[name]);
    }
    if (Array.isArray(value)) return value.map(render);
    if (value && typeof value === "object") return Object.fromEntries(Object.entries(value)
      .map(([name, entry]) => [render(name), render(entry)]).filter(([, entry]) => entry !== undefined));
    return value;
  };
  const rendered = render(configuration);
  return {
    args: [...(rendered.args ?? []), ...(hasCiKey(keyVariable) ? rendered.keyArgs ?? [] : [])]
      .map((arg) => typeof arg === "string" ? arg : JSON.stringify(arg)),
    env: Object.fromEntries(Object.entries(rendered.env ?? {})
      .map(([name, value]) => [name, typeof value === "string" ? value : JSON.stringify(value)])),
  };
}

function started(command, args, workdir, keyVariable, options, ownLoginEnvironment, endpointEnvironment, input = null) {
  return new Promise((resolve) => {
    const environment = environmentFor(keyVariable, ownLoginEnvironment);
    if (Object.keys(endpointEnvironment).length) {
      // The child sets only non-secret settings and inherits credentials without copying their values in Agent M.
      args = ["-e", `
        const { spawn } = require("node:child_process");
        const [settings, command, ...args] = process.argv.slice(1);
        for (const [name, value] of Object.entries(JSON.parse(settings))) process.env[name] = value;
        const child = spawn(command, args, { stdio: "inherit" });
        child.on("error", (error) => { console.error(error.message); process.exitCode = 1; });
        child.on("exit", (code, signal) => {
          if (signal) process.kill(process.pid, signal);
          else process.exitCode = code;
        });
      `, JSON.stringify(endpointEnvironment), command, ...args];
      command = process.execPath;
    }
    const child = spawn(command, args, {
      cwd: workdir,
      stdio: [input == null ? "ignore" : "pipe", "pipe", "pipe"],
      detached: process.platform !== "win32",
      ...(environment ? { env: environment } : {}),
    });
    if (input != null) {
      // An agent that exits without reading its whole input closes the pipe; its exit status, not the write, decides.
      child.stdin.on("error", () => {});
      child.stdin.end(input);
    }
    let stdout = "", stderr = "", aborted = options.signal?.aborted === true, settled = false, stopping = null, stopError = null;
    const cancel = () => {
      aborted = true;
      stopping ??= stopTree(child).catch((error) => { stopError = error; });
    };
    const finish = async (result) => {
      if (settled) return;
      settled = true;
      options.signal?.removeEventListener("abort", cancel);
      await stopping;
      resolve({ ...result, stopError });
    };
    options.signal?.addEventListener("abort", cancel, { once: true });
    if (aborted) cancel();
    child.stdout.on("data", (chunk) => {
      const text = String(chunk);
      stdout += text;
      if (!aborted) options.onOutput?.(text);
    });
    child.stderr.on("data", (chunk) => { stderr += String(chunk); });
    child.on("error", (error) => finish({ status: null, stdout, stderr, error, aborted }));
    child.on("close", (status) => finish({ status, stdout, stderr, error: null, aborted }));
  });
}

/**
 * agentDriver(agent, options, participant) -> Driver — runs one supported Agent in the working folder of a prepared
 * DriverInput. The register supplies command, task and output interpretation; local runs omit every declared credential
 * name before values are copied, while CI inherits its named secret without this module reading its value.
 */
export function processDriver(agent, { workdir, keyVariable, endpoint }, participant, helpers) {
  return {
    participant,
    async send(input, options = {}) {
      if (options.signal?.aborted) throw failure("Cancelled", "the job was cancelled");
      if (!agent?.installed) throw failure("AgentMissing", "the selected agent is not installed");
      if (!agent.loggedIn && !hasCiKey(keyVariable)) throw failure("AgentNotLoggedIn", "the selected agent is not logged in");
      const row = helpers.configuration(agent.name);
      if (!row) throw failure("AgentMissing", "the selected agent is not supported");
      const configured = endpointOptions(row, endpoint, keyVariable);
      const result = await started(row.command, [...row.task.args, ...configured.args],
        input.workdir ?? workdir, keyVariable, options, helpers.ownLoginEnvironment, configured.env, driverPrompt(input));
      if (result.stopError) {
        throw failure("AgentFailed", "the agent process could not be stopped", {
          exitCode: result.stopError.exitCode ?? result.status,
          lastOutput: result.stopError.message,
        });
      }
      if (result.aborted) throw failure("Cancelled", "the job was cancelled");
      if (result.error || result.status !== 0) {
        const lastOutput = (result.stderr || result.stdout).trim();
        throw failure("AgentFailed", "the agent process failed", { exitCode: result.status, lastOutput });
      }
      try {
        return { text: helpers.answer(row.task, result.stdout), usage: helpers.usage(row.task, result.stdout) };
      } catch (error) {
        throw failure("AgentFailed", "the agent output cannot be read", {
          exitCode: result.status,
          lastOutput: error instanceof Error ? error.message : String(error),
        });
      }
    },
  };
}
