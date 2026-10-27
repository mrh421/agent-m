// model-user.mjs — the agent's machine of a hosted job workflow split by OS user (MOD-workflow-entries, Parts): a hand-over to a model endpoint runs as the model's
// own user, who holds no credential and may not use sudo, beside the key holder, which stays with the machine's user and adds the key to each request it forwards to
// the run's endpoint.
//
// Module: MOD-workflow-entries
//
// NO MODEL READS A CREDENTIAL. On a GitHub-hosted runner the machine's user, `runner`, may use sudo without a password, and every process of one user may read
// another's environment (/proc/<pid>/environ); so whatever a model's command can run as that user reaches the key. The model's user is another user, made for the run
// without any group, and works in a copy of the checkouts in its own home, whose files the machine's user reads back only as that user; nothing that holds the key runs
// a command the model's user can write. Node only.

import { holdKey } from "../endpoint-calls/index.mjs";

const builtin = (name) => globalThis.process.getBuiltinModule(`node:${name}`);

// The variables of the machine the model's user's side receives as they are: the CI service's, the route's and the machine's, and the names of the keys — never a
// key's value, a token or the model's user's name, so that the entry there does not split again.
const PASSED = ["PATH", "LANG", "GITHUB_ACTIONS", "GITHUB_EVENT_NAME", "GITHUB_SERVER_URL", "GITHUB_REPOSITORY", "GITHUB_REF_NAME", "GITHUB_SHA", "GITHUB_RUN_ID",
  "GITHUB_ACTOR", "AGENT_M_RUNNER", "AGENT_M_PART", "AGENT_M_KEY_NAMES", "AGENT_M_KEY"];
// The files of the result the model's user's side leaves in `<result>/out` (result.mjs' packResult), read back into the machine's result folder.
const RESULT_FILES = ["result.json", "result.bundle"];

/**
 * separates(name: string, ci: CiEnvironment) -> boolean — whether the entry runs as the model's user: `onDispatch` of a start that hands a job to a model endpoint
 * (the input `endpoint`), on the agent's machine of a route whose job workflow names the model's user — the one run in which a model works on the machine with the
 * tools of MOD-checkout-tools. Never on the model's user's own side, which is given no model's user.
 */
export function separates(name, ci) {
  return name === "onDispatch" && ci.job?.part === "agent" && Boolean(ci.job.modelUser) && !ci.job.keyHolder && Boolean(ci.event.payload?.inputs?.endpoint);
}

/**
 * modelUserCommands({ user, env, ci, holder, execPath, identity }) -> { home, prepare, entry(name), stop, read(path) } — the commands, each `[command, args]`, that
 * run an entry as the model's user `user`: `prepare` makes the user with a home of its own, `/home/<user>`, and no other group, copies the product's and the instance's
 * checkouts and the event's payload there, and gives that home to the user; `entry(name)` runs `node <home>/instance/src/workflow-entries/main.mjs <name>` as the user
 * with no variable but the PASSED ones of `env`, the home's folders in place of the machine's, `holder` as AGENT_M_KEY_HOLDER where there is one, and the committer
 * `identity` ({ name, email }, as the machine's git configuration names it); `stop` ends every process of the user; `read(path)` writes a file to standard output as
 * the user. Pure.
 */
export function modelUserCommands({ user, env, ci, holder, execPath, identity }) {
  const home = `/home/${user}`;
  const sudo = (...args) => ["sudo", ["-n", ...args]];
  const asUser = (...args) => sudo("-u", user, "--", ...args);
  const variables = {
    ...Object.fromEntries(PASSED.filter((name) => env[name] !== undefined).map((name) => [name, env[name]])),
    HOME: home, GITHUB_WORKSPACE: home, GITHUB_EVENT_PATH: `${home}/event.json`, GITHUB_STEP_SUMMARY: `${home}/summary.md`,
    AGENT_M_PRODUCT_DIR: `${home}/product`, AGENT_M_RESULT_DIR: `${home}/result`, ...(holder ? { AGENT_M_KEY_HOLDER: holder } : {}),
    ...(identity?.name ? { GIT_AUTHOR_NAME: identity.name, GIT_COMMITTER_NAME: identity.name } : {}),
    ...(identity?.email ? { GIT_AUTHOR_EMAIL: identity.email, GIT_COMMITTER_EMAIL: identity.email } : {}),
  };
  return {
    home,
    prepare: [
      sudo("useradd", "--create-home", "--home-dir", home, "--user-group", "--shell", "/bin/bash", user),
      sudo("cp", "-a", ci.job.productDir, `${home}/product`),
      sudo("cp", "-a", ci.job.instanceDir, `${home}/instance`),
      sudo("cp", env.GITHUB_EVENT_PATH, `${home}/event.json`),
      sudo("mkdir", "-p", `${home}/result`),
      sudo("chown", "-R", `${user}:${user}`, home),
    ],
    entry: (name) => asUser("/usr/bin/env", "-i", ...Object.entries(variables).map(([key, value]) => `${key}=${value}`), execPath,
      `${home}/instance/src/workflow-entries/main.mjs`, name),
    stop: sudo("pkill", "-KILL", "-u", user),
    read: (path) => asUser("cat", path),
  };
}

// One command, waited for: -> { status, stdout } — its output a Buffer.
function ran([command, args]) {
  const done = builtin("child_process").spawnSync(command, args, { cwd: "/", maxBuffer: 1 << 30 });
  return { status: done.status, stdout: done.stdout ?? Buffer.alloc(0), stderr: String(done.stderr ?? "").trim() };
}

// One command whose output goes to this step's log as it comes: -> its exit code.
function logged([command, args]) {
  return new Promise((resolve) => {
    const child = builtin("child_process").spawn(command, args, { cwd: "/", stdio: ["ignore", "inherit", "inherit"] });
    child.once("error", () => resolve(null));
    child.once("exit", (code) => resolve(code));
  });
}

// The committer the machine's git configuration names, which the job workflow sets for the run's actor: { name, email }, each null where it names none.
function identityOf() {
  const value = (key) => {
    try { return builtin("child_process").execFileSync("git", ["config", "--global", key], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim() || null; } catch { return null; }
  };
  return { name: value("user.name"), email: value("user.email") };
}

// The endpoint and its key that the key holder holds: the input `endpoint` and the key of the secret the input `secret` names, which the job workflow names among its
// keys; null where either is missing or the endpoint is not the JSON text of { kind, baseUrl }, which the model's user's side then reports as it does without a holder.
function heldOf(ci) {
  const inputs = ci.event.payload?.inputs ?? {};
  const key = typeof inputs.secret === "string" && Object.hasOwn(ci.job.keys, inputs.secret) ? ci.job.keys[inputs.secret] : null;
  let endpoint = null;
  try { endpoint = JSON.parse(inputs.endpoint); } catch { return null; }
  if (!key || typeof endpoint?.kind !== "string" || typeof endpoint?.baseUrl !== "string") return null;
  return { kind: endpoint.kind, baseUrl: endpoint.baseUrl, key };
}

/**
 * runAsModelUser(name: string, env: Record<string, string | undefined>, ci: CiEnvironment) -> Promise<EntryStatus> — the entry `name`, then
 * `leaveResult`, run as the model's user (modelUserCommands) beside a key holder (MOD-endpoint-calls' `holdKey`) for the run's endpoint and key, where the machine has
 * that key; their output goes to the step's log. Afterwards every process of the user is ended, and the result's files and the summary the user's side left are read
 * back as that user into the machine's result folder and step summary, so that the job workflow's own `leaveResult` finds the result left and `nothing to do`. `done`
 * where the entry ended with 0, else `failed`; a command that prepares the user and fails ends it `failed`, naming it.
 */
export async function runAsModelUser(name, env, ci) {
  const fs = builtin("fs"), path = builtin("path");
  const user = ci.job.modelUser;
  const held = heldOf(ci);
  const holder = held ? await holdKey(held) : null;
  try {
    const commands = modelUserCommands({ user, env, ci, holder: holder?.address ?? null, execPath: globalThis.process.execPath, identity: identityOf() });
    for (const command of commands.prepare) {
      const done = ran(command);
      if (done.status !== 0) return { outcome: "failed", summary: `The model's user ${user} could not be prepared: ${command[1].slice(1).join(" ")} — ${done.stderr}`, findings: [] };
    }
    const code = await logged(commands.entry(name));
    ran(commands.stop);
    await logged(commands.entry("leaveResult"));
    ran(commands.stop);
    const out = path.join(ci.job.resultDir, "out");
    for (const file of RESULT_FILES) {
      const read = ran(commands.read(`${commands.home}/result/out/${file}`));
      if (read.status !== 0) continue;
      fs.mkdirSync(out, { recursive: true });
      fs.writeFileSync(path.join(out, file), read.stdout);
    }
    const summary = ran(commands.read(`${commands.home}/summary.md`));
    if (summary.status === 0 && ci.job.summaryFile) fs.appendFileSync(ci.job.summaryFile, summary.stdout);
    return { outcome: code === 0 ? "done" : "failed", findings: [],
      summary: `${name} ran as the model's user ${user}${holder ? ", beside the key holder of its endpoint" : ""}; its own status is the line above.` };
  } finally {
    await holder?.close();
  }
}
