// ci.mjs — the CI route (docs/architecture/MOD-runtimes.md, Parts: "ci.mjs — the CI route: queueing, live state, log
// and cancel through the repository host"). Of it, ITM-253 builds queueing; ITM-535 adds the live state, the log and the cancel of a job taken on CI, through the host
// (runOfAddress, cancelRun, used by index.mjs). ITM-322 adds jobWorkflowFiles, the files of Agent M's job workflow for a product, from the
// templates workflow/github.yml and workflow/gitlab.yml, which it reads once, when it is loaded, from the disk, in Node; ITM-532 gives the GitLab files the inputs of a pipeline the API starts.
//
// Module: MOD-runtimes
//
// Gap (MOD-runtimes.md, front matter `uses:` and its "## Uses" section): neither lists MOD-repository-hosts.
// repositoryInfo, yet commitFiles' `branch` must be a real branch name — never a commit SHA (confirmed against
// src/repository-hosts/github.mjs's commitFiles, which resolves it through `heads(branch)` = `heads/<branch>`, the
// GitHub Git Data API's reference path) — and queueJob's own signature carries no branch. Every other place in this
// codebase that commits "to the default branch" reads it through repositoryInfo(), declared where it is used
// (MOD-artifact-edits.md `uses:`; MOD-notifications.md, Data: "each repository's default branch, read once per
// page"). queueOnCi calls host.repositoryInfo() the same way; the gap is noted here rather than by editing the
// architecture file.

import { startRecord } from "../job-ledger/index.mjs";

// RuntimeError — the failures MOD-runtimes throws of its own (MOD-runtimes, Interfaces: queueJob): WorkflowMissing
// { files }, for the CI route of a product without Agent M's job workflow at the head a job is queued on.
export class RuntimeError extends Error {
  constructor(name, fields, message) {
    super(message);
    this.name = name;
    Object.assign(this, fields ?? {});
  }
}

// Agent M's job workflow in a product (MOD-runtimes.md, Data), by the repository's server: one file.
const WORKFLOW_PATH = { github: ".github/workflows/agent-m-jobs.yml", gitlab: ".gitlab/agent-m-jobs.yml" };

// commitStart(host, start, head) -> Promise<{ path, commit, defaultBranch, workflow }> — the commit of the CI route
// (MOD-runtimes' queueJob, Interfaces): the job's start record (MOD-job-ledger's startRecord) at its path, on the head
// that was read, in one commit, as the person's commit — the host's commitFiles, on the branch its repositoryInfo names,
// with expectedHead the head given —; with it that branch and the server's job workflow file, for a caller that starts the
// workflow itself (hand-over.mjs). Refused with WorkflowMissing, naming the job workflow's file, while the snapshot at the
// head read does not hold it: nothing is committed then. Crosses the network through the host; fails as it fails — Moved,
// TokenRefused, PermissionMissing, RateLimited, Unreachable — unchanged, and with WorkflowMissing of its own.
export async function commitStart(host, start, head) {
  const [{ defaultBranch }, snapshot] = await Promise.all([host.repositoryInfo(), host.readSnapshot(head)]);
  const workflow = WORKFLOW_PATH[snapshot.repository.server];
  if (!snapshot.paths.includes(workflow)) {
    throw new RuntimeError("WorkflowMissing", { files: [workflow] },
      `${snapshot.repository.path} has no Agent M job workflow yet — add ${workflow}.`);
  }
  // The job runs the instance at the commit the product's job workflow pins (moving it is writing the file again, on a person's decision); the record names
  // that commit, which the run's checkout of the instance is then at — not the commit the page that queued the job was served from.
  const pinned = pinnedInstance(await snapshot.read(workflow));
  const { path, text } = startRecord(pinned ? { ...start, agentM: { ...start.agentM, version: pinned, commit: pinned } } : start);
  const { commit } = await host.commitFiles({
    branch: defaultBranch, expectedHead: head, files: [{ path, text }],
    message: `Queue job ${start.id}: ${start.kind}`,
  });
  // GitHub's dispatch call names a workflow by its file name alone (repository-hosts' github adapter encodes the name into the URL path); GitLab's is left as the path.
  return { path, commit, defaultBranch, workflow: snapshot.repository.server === "github" ? workflow.split("/").pop() : workflow };
}

// pinnedInstance(text) -> string | null — the instance commit a job workflow file pins: GitHub's checkout of the instance (`ref:` after its `repository:`),
// GitLab's AGENT_M_COMMIT; null where the file names none.
function pinnedInstance(text) {
  const found = /repository:\s*\S+\s*\n\s*ref:\s*([0-9a-f]{40})\b/.exec(text ?? "") ?? /AGENT_M_COMMIT:\s*"?([0-9a-f]{40})\b/.exec(text ?? "");
  return found ? found[1] : null;
}

// queueOnCi(host, start, head) -> Promise<{ path, commit }> — MOD-runtimes' queueJob (Interfaces), for the CI route:
// commitStart; the push starts the product's job workflow (Data).
export async function queueOnCi(host, start, head) {
  const { path, commit } = await commitStart(host, start, head);
  return { path, commit };
}

// ---------------------------------------------------------------- the job workflow's files

const disk = globalThis.process?.getBuiltinModule?.("node:fs");

// A template, read from the disk, in Node; null in a browser. Reading it there would be a fetch of the module's own data file,
// which the repository's check NO SERVER (tests/test_no_backend.py) allows only a module it lists, and it does not list this one:
// a browser gets a failure by name from jobWorkflowFiles, and the rest of the module loads.
const templateAt = (name) => disk?.readFileSync(new URL(`./workflow/${name}`, import.meta.url), "utf8") ?? null;

// A template is the head of the file, a line that begins `# --- one job`, and the lines of one job, written once for each route.
const TEMPLATES = { github: templateAt("github.yml"), gitlab: templateAt("gitlab.yml") };
const JOB_MARKER = /^# --- one job.*\n/m;
// GitHub's template then has, after its route's jobs, a line that begins `# --- the agent's job` and the lines of one agent's job, written once for each key and once for none.
const AGENT_MARKER = /^# --- the agent's job.*\n/m;

const SECRET_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/, LABEL = /^[A-Za-z0-9_.:-]+$/, COMMIT = /^[0-9a-f]{40}$/;
const REPOSITORY = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

// GitLab's environments of the job workflow: the agent's job of a key is of agent-m-key-<the key's name>, the job that writes of agent-m-write.
const WRITE_ENVIRONMENT = "agent-m-write";
const agentEnvironment = (key) => `agent-m-key-${key}`;

/**
 * gitlabVariableScopes(secrets: { token: string, keys: string[] }) -> { name: string, scopes: string[] }[] — on GitLab, the environment scopes each CI/CD
 * variable the job workflow reads must have, and no other (MOD-runtimes, Data): the person's token `agent-m-write` alone, each key `agent-m-key-<its name>`
 * and `agent-m-write`; the token first, then the keys in their order. Pure.
 */
export function gitlabVariableScopes(secrets) {
  return [{ name: secrets.token, scopes: [WRITE_ENVIRONMENT] }, ...secrets.keys.map((key) => ({ name: key, scopes: [agentEnvironment(key), WRITE_ENVIRONMENT] }))];
}

// A text with each @@name@@ of the template replaced by the value given.
const fill = (template, values) => template.replace(/@@([a-z-]+)@@/g, (_, name) => values[name]);

// ---------------------------------------------------------------- the product's own .gitlab-ci.yml

const isBlank = (line) => /^\s*(#.*)?$/.test(line);
const indentOf = (line) => line.length - line.trimStart().length;
const LIST_ITEM = /^\s*-(\s|$)/;
// A line that names the job file, as a `local:` value or as a plain string item.
const NAMES_JOB_FILE = /^\s*(-\s+)?(local:\s*)?["']?\/?\.gitlab\/agent-m-jobs\.yml["']?\s*(#.*)?$/;

// The sentence that ends a GitlabCiNotList message is the one of its own case: an include:, an inline inputs:, or an entry that is a plain string.
const INCLUDE_ENDING = "Agent M adds its entry only to an include: that is a list, and rewrites no line of the product's own — make it a list, then install again.";
const ENTRY_ENDING = "Agent M passes its inputs only through an entry written with local: and inputs:, and rewrites no line of the product's own — write the entry so, then install again.";
const INPUTS_ENDING = "Agent M adds its inputs only to an inputs: written as a block, and rewrites no line of the product's own — write it as a block, then install again.";
const notAList = (why, ending = INCLUDE_ENDING) => new RuntimeError("GitlabCiNotList", { file: ".gitlab-ci.yml" }, `.gitlab-ci.yml: ${why} ${ending}`);

// appendToBlock(lines, keyAt, limit, names, render) -> boolean — under the key at lines[keyAt], whose block ends before `limit`, adds render(name, pad) for each
// of `names` the block lacks, after the block's last line that holds anything; true where it added. `pad` is the indentation of the block's own entries.
function appendToBlock(lines, keyAt, limit, names, render) {
  const keyIndent = indentOf(lines[keyAt]);
  let last = keyAt, childIndent = null;
  for (let at = keyAt + 1; at < limit; at += 1) {
    if (isBlank(lines[at])) continue;
    if (indentOf(lines[at]) <= keyIndent) break;
    childIndent ??= indentOf(lines[at]);
    last = at;
  }
  const pad = " ".repeat(childIndent ?? keyIndent + 2);
  const lacking = names.filter((name) => !lines.slice(keyAt + 1, last + 1).some((line) => line.startsWith(`${pad}${name}:`)));
  lines.splice(last + 1, 0, ...lacking.flatMap((name) => render(name, pad)));
  return lacking.length > 0;
}

// mergeGitlabCi(text, names) -> string — the product's .gitlab-ci.yml with the three additions of MOD-runtimes' jobWorkflowFiles, each only where it is
// missing, and no other line touched; `text` itself where nothing is missing. Throws RuntimeError GitlabCiNotList for an include: that is not a list.
function mergeGitlabCi(text, names) {
  const lines = text === "" ? [] : text.replace(/\n$/, "").split("\n");
  let changed = false;
  const defaults = (name, pad) => [`${pad}${name}:`, `${pad}  default: ""`];
  const passed = (name, pad) => [`${pad}${name}: $[[ inputs.${name} ]]`];

  // 1. The `spec:` header, which ends at the first line `---`: each input it lacks under `inputs:`; the whole header before the first line where there is none.
  const dashAt = lines.findIndex((line) => /^---\s*$/.test(line));
  const specAt = lines.findIndex((line) => /^spec:\s*$/.test(line));
  if (specAt !== -1 && dashAt > specAt && lines.slice(0, specAt).every(isBlank)) {
    const inputsAt = lines.findIndex((line, at) => at > specAt && at < dashAt && /^\s+inputs:/.test(line));
    if (inputsAt !== -1 && !/^\s+inputs:\s*(#.*)?$/.test(lines[inputsAt])) throw notAList("the inputs: of the spec: header is not written as a block.", INPUTS_ENDING);
    if (inputsAt === -1) {
      lines.splice(dashAt, 0, "  inputs:", ...names.flatMap((name) => defaults(name, "    ")));
      changed = true;
    } else changed = appendToBlock(lines, inputsAt, dashAt, names, defaults);
  } else {
    lines.unshift("spec:", "  inputs:", ...names.flatMap((name) => defaults(name, "    ")), "---");
    changed = true;
  }

  // 2. The entry under `include:`: at the end of a list; the key with it at the end of the file where there is none. An entry that names the job file
  // already gains only the inputs it lacks.
  const entry = (pad) => [`${pad}- local: "${WORKFLOW_PATH.gitlab}"`, `${pad}  inputs:`, ...names.flatMap((name) => passed(name, `${pad}    `))];
  const includeAt = lines.findIndex((line) => /^include:/.test(line));
  if (includeAt === -1) {
    lines.push("include:", ...entry("  "));
    return `${lines.join("\n")}\n`;
  }
  const rest = lines[includeAt].slice("include:".length).trim();
  if (rest !== "" && !rest.startsWith("#")) throw notAList("include: holds a single string or an inline map.");
  let first = null, end = includeAt;
  for (let at = includeAt + 1; at < lines.length; at += 1) {
    if (isBlank(lines[at])) continue;
    if (indentOf(lines[at]) === 0 && !LIST_ITEM.test(lines[at])) break;
    first ??= at;
    end = at;
  }
  if (first !== null && !LIST_ITEM.test(lines[first])) throw notAList("include: holds a map.");
  const itemIndent = first === null ? 2 : indentOf(lines[first]), margin = " ".repeat(itemIndent);
  const starts = [];
  if (first !== null) for (let at = first; at <= end; at += 1) if (indentOf(lines[at]) === itemIndent && LIST_ITEM.test(lines[at])) starts.push(at);
  const named = starts.findIndex((start, i) => lines.slice(start, starts[i + 1] ?? end + 1).some((line) => NAMES_JOB_FILE.test(line)));
  if (named === -1) {
    lines.splice(end + 1, 0, ...entry(margin));
    changed = true;
  } else {
    const start = starts[named], stop = starts[named + 1] ?? end + 1;
    if (!lines.slice(start, stop).some((line) => /^\s*(-\s+)?local:/.test(line))) {
      throw notAList("the entry for .gitlab/agent-m-jobs.yml is a plain string, which cannot pass the inputs on.", ENTRY_ENDING);
    }
    const inputsAt = lines.findIndex((line, at) => at > start && at < stop && /^\s+inputs:/.test(line));
    if (inputsAt !== -1 && !/^\s+inputs:\s*(#.*)?$/.test(lines[inputsAt])) throw notAList("the inputs: of the entry for .gitlab/agent-m-jobs.yml is not written as a block.", INPUTS_ENDING);
    if (inputsAt === -1) {
      let last = stop - 1;
      while (isBlank(lines[last])) last -= 1;
      lines.splice(last + 1, 0, `${margin}  inputs:`, ...names.flatMap((name) => passed(name, `${margin}    `)));
      changed = true;
    } else changed = appendToBlock(lines, inputsAt, stop, names, passed) || changed;
  }
  return changed ? `${lines.join("\n")}\n` : text;
}

/**
 * jobWorkflowFiles(server: "github" | "gitlab", instance: { repository: string, commit: string }, secrets: { token: string, keys:
 * string[] }, runners: string[], gitlabCi?: string | null) -> { path: string, text: string }[] — the files of Agent M's job workflow in a product
 * (MOD-runtimes, Data), for the caller to commit on a person's click: on GitHub .github/workflows/agent-m-jobs.yml; on GitLab
 * .gitlab/agent-m-jobs.yml and, as the second file, the product's .gitlab-ci.yml. `gitlabCi` is the product's .gitlab-ci.yml at the head the caller
 * read, `null` where it has none: the second file is then the whole file the template gives — the `spec:inputs` header that declares the inputs `job`,
 * `task` and `endpoint` of a pipeline the API starts, each with an empty default, and the include of the job file that passes them on —, and otherwise
 * `gitlabCi` with those three things added, each only where it is missing, and every other line as it was. Throws RuntimeError GitlabCiNotList, naming
 * the file, where its `include:` holds a single string or a map. For each route of the product's CI agents — the server's runners, `hosted`, and each
 * self-hosted runner by its label in `runners` —, the plan `<route>-plan`, which receives no secret, the agent's jobs `<route>-agent-<n>`, the n-th receiving the
 * n-th key and no other, the 0th none, each working only where the plan names its n, and the job `<route>` that writes, which receives the token and every key and
 * runs no agent; on GitLab each id begins `agent-m-`, and what a job receives is decided by its environment (gitlabVariableScopes). `instance.repository` is `owner/name` on github.com and `instance.commit` a
 * 40-digit commit, at which each job checks out the instance. `secrets.token` is the name of the secret that holds the person's
 * Agent M token, `secrets.keys` the names of those that hold the agents' keys: the files name them and hold no value. Pure.
 * The templates are read from the disk, in Node: in a browser it throws an Error that says so. Throws TypeError for a server that is neither, a repository or commit of another form, or a name of a secret or a runner label
 * that is not a plain name.
 * @param {"github" | "gitlab"} server
 * @param {{ repository: string, commit: string }} instance
 * @param {{ token: string, keys: string[] }} secrets
 * @param {string[]} runners
 * @param {string | null} [gitlabCi]
 * @returns {Array<{ path: string, text: string }>}
 */
export function jobWorkflowFiles(server, instance, secrets, runners, gitlabCi = null) {
  if (!Object.hasOwn(WORKFLOW_PATH, server)) throw new TypeError(`the job workflow is written for GitHub or GitLab, not ${server}`);
  if (!REPOSITORY.test(instance.repository)) throw new TypeError(`the instance is owner/name: ${instance.repository}`);
  if (!COMMIT.test(instance.commit)) throw new TypeError(`the instance is at a commit of 40 hexadecimal digits: ${instance.commit}`);
  for (const name of [secrets.token, ...secrets.keys]) {
    if (!SECRET_NAME.test(name)) throw new TypeError(`a secret is named by a plain name: ${JSON.stringify(name)}`);
  }
  for (const label of runners) if (!LABEL.test(label)) throw new TypeError(`a runner is named by a plain label: ${JSON.stringify(label)}`);

  if (TEMPLATES[server] === null) throw new Error("MOD-runtimes: the job workflow's templates are read in Node; a browser cannot read them yet");
  const [head, routeJobs] = TEMPLATES[server].split(JOB_MARKER);
  const github = server === "github";
  const common = { repository: instance.repository, commit: instance.commit, token: secrets.token, "key-names": secrets.keys.join(" ") };
  // Every agent's job of every route names the model's user, as whom a model's run works on the agent's machine where that machine can make it (MOD-workflow-entries):
  // the templates hold its name.
  const routes = [{ runner: "hosted", id: "hosted", "runs-on": "ubuntu-latest", tags: "" },
    ...runners.map((label) => ({ runner: label, id: `runner-${label}`, "runs-on": `[self-hosted, ${JSON.stringify(label)}]`,
      tags: `  tags: [${JSON.stringify(label)}]\n` }))];
  const keyEnv = (names) => names.map((name) => `      ${name}: \${{ secrets.${name} }}\n`).join("");
  // A route is three kinds of job (MOD-runtimes, Data): the plan, one agent's job for each key and one, 0, for none, and the job that writes. On GitHub the n-th
  // agent's job reads the n-th key's secret and no other, and the job that writes reads the token and every key. On GitLab, which gives a job every variable not
  // scoped to an environment, the agent's job of a key is of the environment agent-m-key-<its name>, the 0th of none, the job that writes of agent-m-write, and
  // the plan of none: the person scopes the variables to them (gitlabVariableScopes).
  const [job, agentJob] = routeJobs.split(AGENT_MARKER);
  const jobs = routes.map((route) => {
    const id = github ? route.id : `agent-m-${route.id}`;
    const values = { ...common, ...route, runner: JSON.stringify(route.runner), route: route.runner, id, "key-env": keyEnv(secrets.keys) };
    const agents = [null, ...secrets.keys].map((name, at) => ({ id: `${id}-agent-${at}`, text: fill(agentJob, { ...values, agent: String(at),
      "agent-id": `${id}-agent-${at}`, "agent-key-env": name === null ? "" : keyEnv([name]),
      "agent-environment": name === null ? "" : `  environment:\n    name: ${agentEnvironment(name)}\n    action: verify\n` }) }));
    return fill(job, { ...values, "agent-jobs": agents.map((agent) => agent.text).join("").replace(/\n$/, ""), "agent-ids": agents.map((agent) => agent.id).join(", "),
      "agent-needs": agents.map((agent) => `    - job: ${agent.id}\n      optional: true\n`).join(""),
      "artifact-ids": agents.map((agent) => `\${{ needs.${agent.id}.outputs.artifact }}`).join(" ") });
  });
  const files = [{ path: WORKFLOW_PATH[server], text: `${fill(head, common)}${jobs.join("\n")}` }];
  if (!github) {
    // The inputs of a pipeline started through the API: GitLab takes them only from the `spec:inputs` header of the main .gitlab-ci.yml (docs.gitlab.com, "CI/CD
    // inputs"), which passes them to the included job file through `include:inputs`. The template starts with the header, the one place that declares them, and
    // so does this file; a push starts the pipeline without inputs, so each has an empty default there.
    const spec = head.slice(0, head.indexOf("---\n") + 4);
    const inputs = [...spec.matchAll(/^ {4}([a-z]+):$/gm)].map((match) => match[1]);
    // Where the product has a .gitlab-ci.yml, it is that text with what it lacks added (mergeGitlabCi); where it has none, the whole file.
    if (gitlabCi !== null && typeof gitlabCi !== "string") throw new TypeError("the product's .gitlab-ci.yml is given as its text, or as null where it has none");
    files.push({ path: ".gitlab-ci.yml", text: gitlabCi === null ? `${spec}include:\n  - local: "${WORKFLOW_PATH.gitlab}"\n    inputs:\n${inputs.map((name) => `      ${name}: $[[ inputs.${name} ]]\n`).join("")}`
      : mergeGitlabCi(gitlabCi, inputs) });
  }
  return files;
}

// ---------------------------------------------------------------- the live state, the log and the cancel of a job taken on CI

// The job workflow's file name, as GitHub's dispatch call names a workflow (hand-over.mjs): the filter of listCiRuns.
const JOB_WORKFLOW = "agent-m-jobs.yml";

/**
 * runOfAddress(host, address) -> Promise<CiRun | null> — the run among listCiRuns({ workflow }) whose url is the address a record's `## Taken` holds in `by:` (MOD-job-ledger, Data); null where the server lists
 * none. Crosses the network through the host and fails as it fails.
 */
export async function runOfAddress(host, address) {
  const runs = await host.listCiRuns({ workflow: JOB_WORKFLOW });
  return runs.find((run) => run.url === address) ?? null;
}

/**
 * cancelRun(host, address) -> Promise<{ cancelled: boolean, address: string }> — asks the server to cancel the run at the address (cancelCiRun), then reads the run once: `cancelled` where it is. Throws
 * RuntimeError NotFound { what: address } for a run the server does not list, before anything is asked. Fails as the host fails.
 */
export async function cancelRun(host, address) {
  const run = await runOfAddress(host, address);
  if (!run) throw new RuntimeError("NotFound", { what: address }, `the CI run ${address} is not listed`);
  await host.cancelCiRun(run.id);
  return { cancelled: (await runOfAddress(host, address))?.state === "cancelled", address: run.url };
}
