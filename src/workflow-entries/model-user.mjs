// model-user.mjs — the agent's machine of a job workflow split by OS user (MOD-workflow-entries, Parts): a run in which a model works — a hand-over to a model endpoint,
// or a coding agent's CLI whose key the machine holds — runs as the model's own user, who holds no credential and may not use sudo, beside the key holder, which stays
// with the machine's user and adds the key to each request it forwards to the run's endpoint or the agent's provider.
//
// Module: MOD-workflow-entries
//
// NO MODEL READS A CREDENTIAL. On a GitHub-hosted runner the machine's user, `runner`, may use sudo without a password, and every process of one user may read
// another's environment (/proc/<pid>/environ); so whatever a model's command can run as that user reaches the key. In a GitLab job the machine's user is root in the
// job's container, whose variables hold the job's token. The model's user is another user, made for the run without any group, and works in a copy of the checkouts in
// its own home, whose files the machine's user reads back only as that user; nothing that holds the key runs a command the model's user can write. The user is made
// where the machine allows it — on Linux, as root or with sudo without a password (separationOf) —; elsewhere the entry runs as the machine's user, and says so.
// Node only.

import { holdKey } from "../endpoint-calls/index.mjs";
import { keyProvider } from "../agent-processes/index.mjs";

const builtin = (name) => globalThis.process.getBuiltinModule(`node:${name}`);

// The variables of the machine the model's user's side receives as they are: the CI service's, the route's and the machine's, the inputs of a GitLab pipeline, and the
// names of the keys — never a key's value, a token or the model's user's name, so that the entry there does not split again.
const PASSED = ["PATH", "LANG", "GITHUB_ACTIONS", "GITHUB_EVENT_NAME", "GITHUB_SERVER_URL", "GITHUB_REPOSITORY", "GITHUB_REF_NAME", "GITHUB_SHA", "GITHUB_RUN_ID",
  "GITHUB_ACTOR", "GITLAB_CI", "CI_PIPELINE_SOURCE", "CI_PROJECT_URL", "CI_COMMIT_REF_NAME", "CI_COMMIT_SHA", "CI_PIPELINE_URL", "GITLAB_USER_LOGIN",
  "AGENT_M_INPUT_JOB", "AGENT_M_INPUT_TASK", "AGENT_M_INPUT_ENDPOINT", "AGENT_M_INPUT_SECRET", "AGENT_M_RUNNER", "AGENT_M_PART", "AGENT_M_KEY_NAMES", "AGENT_M_KEY"];
// The files of the result the model's user's side leaves in `<result>/out` (result.mjs' packResult), read back into the machine's result folder.
const RESULT_FILES = ["result.json", "result.bundle"];
// The entries in which a model works on the agent's machine.
const WORKING = ["onDispatch", "onRecordsChanged"];

/**
 * separates(name: string, ci: CiEnvironment) -> boolean — whether the entry runs as the model's user: on the agent's machine of a route whose job workflow names the
 * model's user, `onDispatch` of a start that hands a job to a model endpoint (the input `endpoint`), and `onDispatch` or `onRecordsChanged` where the machine's key is
 * the key variable of a coding agent that reaches its provider through a key holder (MOD-agent-processes' `keyProvider`). Never on the model's user's own side, which is
 * given no model's user.
 */
export function separates(name, ci) {
  if (ci.job?.part !== "agent" || !ci.job.modelUser || ci.job.keyHolder) return false;
  if (name === "onDispatch" && ci.event.payload?.inputs?.endpoint) return true;
  return WORKING.includes(name) && Boolean(keyProvider(ci.job.agentKey));
}

/**
 * separationOf({ platform, root, sudo }) -> "root" | "sudo" | null — how the machine's user makes the model's user: directly where it is root, with `sudo -n` where it
 * may use sudo without a password (`sudo`, whether `sudo -n true` succeeded), on Linux only; null where neither holds, and the entry then runs as the machine's user. Pure.
 */
export function separationOf({ platform, root, sudo }) {
  if (platform !== "linux") return null;
  return root ? "root" : sudo ? "sudo" : null;
}

/**
 * modelUserCommands({ user, env, ci, holder, execPath, identity, root }) -> { home, clear, prepare, entry(name), stop, read(path), closes, close(mode) } — the
 * commands, each `[command, args]`, that run an entry as the model's user `user`, under `sudo -n`, or directly where `root` is true, the user's commands then through
 * `runuser`: `clear` ends every process of the user and removes the user with its home, which a run before may have left; `prepare` makes the user with a home of its
 * own, `/home/<user>`, and no other group, copies the product's and the instance's checkouts — and on GitHub the event's payload — there, gives that home to the user,
 * and on GitLab closes `closes`, the folder that holds the project's clone and the files GitLab writes beside it, to every other user; `entry(name)` runs
 * `node <home>/instance/src/workflow-entries/main.mjs <name>` as the user with no variable but the PASSED ones of `env`, the home's folders in place of the machine's,
 * `holder` as AGENT_M_KEY_HOLDER where there is one, and the committer `identity` ({ name, email }, as the machine's git configuration names it); `stop` ends every
 * process of the user; `read(path)` writes a file to standard output as the user; `close(mode)` sets `closes` back to `mode`. Pure.
 */
export function modelUserCommands({ user, env, ci, holder, execPath, identity, root = false }) {
  const home = `/home/${user}`;
  const gitlab = ci.service === "gitlab";
  const privileged = (command, ...args) => (root ? [command, args] : ["sudo", ["-n", command, ...args]]);
  const asUser = (...args) => (root ? ["runuser", ["-u", user, "--", ...args]] : privileged("-u", user, "--", ...args));
  const closes = gitlab ? builtin("path").dirname(ci.checkout) : null;
  const variables = {
    ...Object.fromEntries(PASSED.filter((name) => env[name] !== undefined).map((name) => [name, env[name]])),
    HOME: home,
    ...(gitlab ? { CI_PROJECT_DIR: `${home}/product` }
      : { GITHUB_WORKSPACE: home, GITHUB_EVENT_PATH: `${home}/event.json`, GITHUB_STEP_SUMMARY: `${home}/summary.md` }),
    AGENT_M_PRODUCT_DIR: `${home}/product`, AGENT_M_RESULT_DIR: `${home}/result`, ...(holder ? { AGENT_M_KEY_HOLDER: holder } : {}),
    ...(identity?.name ? { GIT_AUTHOR_NAME: identity.name, GIT_COMMITTER_NAME: identity.name } : {}),
    ...(identity?.email ? { GIT_AUTHOR_EMAIL: identity.email, GIT_COMMITTER_EMAIL: identity.email } : {}),
  };
  const stop = privileged("pkill", "-KILL", "-u", user);
  return {
    home,
    clear: [stop, privileged("userdel", "--force", "--remove", user)],
    prepare: [
      privileged("useradd", "--create-home", "--home-dir", home, "--user-group", "--shell", "/bin/bash", user),
      privileged("cp", "-a", ci.job.productDir, `${home}/product`),
      privileged("cp", "-a", ci.job.instanceDir, `${home}/instance`),
      ...(gitlab ? [] : [privileged("cp", env.GITHUB_EVENT_PATH, `${home}/event.json`)]),
      privileged("mkdir", "-p", `${home}/result`),
      privileged("chown", "-R", `${user}:${user}`, home),
      ...(closes ? [privileged("chmod", "0700", closes)] : []),
    ],
    entry: (name) => asUser("/usr/bin/env", "-i", ...Object.entries(variables).map(([key, value]) => `${key}=${value}`), execPath,
      `${home}/instance/src/workflow-entries/main.mjs`, name),
    stop,
    read: (path) => asUser("cat", path),
    closes,
    close: (mode) => privileged("chmod", mode.toString(8).padStart(4, "0"), closes),
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

/**
 * heldOf(ci: CiEnvironment) -> { kind, baseUrl, key } | null — the endpoint and the key the key holder holds: for a start with the input `endpoint`, that endpoint — the
 * JSON text of { kind, baseUrl } — and the key of the secret the input `secret` names, which the job workflow names among its keys; otherwise the provider of the coding
 * agent whose key variable the machine's key is (MOD-agent-processes' `keyProvider`), with that key. null where the endpoint or the key is missing or the endpoint cannot
 * be read, which the model's user's side then reports as it does without a holder. Pure.
 */
export function heldOf(ci) {
  const inputs = ci.event.payload?.inputs ?? {};
  if (inputs.endpoint) {
    const key = typeof inputs.secret === "string" && Object.hasOwn(ci.job.keys, inputs.secret) ? ci.job.keys[inputs.secret] : null;
    let endpoint = null;
    try { endpoint = JSON.parse(inputs.endpoint); } catch { return null; }
    if (!key || typeof endpoint?.kind !== "string" || typeof endpoint?.baseUrl !== "string") return null;
    return { kind: endpoint.kind, baseUrl: endpoint.baseUrl, key };
  }
  const provider = keyProvider(ci.job.agentKey);
  const key = ci.job.agentKey ? ci.job.keys[ci.job.agentKey] : null;
  return provider && key ? { ...provider, key } : null;
}

/**
 * runAsModelUser(name: string, env: Record<string, string | undefined>, ci: CiEnvironment, entry: (ci) => Promise<EntryStatus>) -> Promise<EntryStatus> — the entry
 * `name`, then `leaveResult`, run as the model's user (modelUserCommands) beside a key holder (MOD-endpoint-calls' `holdKey`) for what heldOf names, where the machine
 * has that key; their output goes to the step's log. A user that a run before left is cleared first. Afterwards every process of the user is ended, and the result's
 * files and the summary the user's side left are read back as that user into the machine's result folder and step summary, so that the job workflow's own
 * `leaveResult` finds the result left and `nothing to do`; then the folder closed is set back to its mode and the user removed. `done` where the entry ended with 0, else
 * `failed`; a command that prepares the user and fails ends it `failed`, naming it. Where the machine cannot make the user (separationOf), `entry` runs as the machine's
 * user, and its summary says so.
 */
export async function runAsModelUser(name, env, ci, entry) {
  const fs = builtin("fs"), path = builtin("path");
  const root = globalThis.process.getuid?.() === 0;
  const how = separationOf({ platform: globalThis.process.platform, root,
    sudo: globalThis.process.platform === "linux" && !root && ran(["sudo", ["-n", "true"]]).status === 0 });
  if (!how) {
    const status = await entry(ci);
    return { ...status, summary: `${status.summary} — ran as the machine's own user, since it can make no model's user here (Linux, as root or with sudo without a password)` };
  }
  const user = ci.job.modelUser;
  const held = heldOf(ci);
  const holder = held ? await holdKey(held) : null;
  let commands = null, mode = null;
  try {
    commands = modelUserCommands({ user, env, ci, holder: holder?.address ?? null, execPath: globalThis.process.execPath, identity: identityOf(), root });
    for (const command of commands.clear) ran(command);
    if (commands.closes) mode = fs.statSync(commands.closes).mode & 0o7777;
    for (const command of commands.prepare) {
      const done = ran(command);
      if (done.status !== 0) return { outcome: "failed", summary: `The model's user ${user} could not be prepared: ${(root ? [command[0], ...command[1]] : command[1].slice(1)).join(" ")} — ${done.stderr}`, findings: [] };
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
    if (commands && mode !== null) ran(commands.close(mode));
    if (commands) for (const command of commands.clear) ran(command);
    await holder?.close();
  }
}
