// workfolders.mjs — the clones in an agent's working folder (MOD-bridge-jobs, Parts: workfolders.mjs; Data): a clone of the instance, one
// clone per served product, and one working clone per running job, removed when the job ends.
//
// Module: MOD-bridge-jobs
//
// A LOCAL AGENT USES THE PERSON'S OWN LOGIN: every clone is made and fetched by git with the login git finds on this computer — its credential
// helper, its SSH key, its configuration —, and no token is entered anywhere. Access's local clone (MOD-repository-hosts' connect with a `clone`)
// reads files and makes commits in these clones; through a clone, repositoryInfo needs a token, which a Bridge has none of, so the default branch
// it reports is the one the clone's origin names.

import { execFile } from "node:child_process";
import { mkdir, rm, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { connect, parseAddress } from "../repository-hosts/index.mjs";
import { pullRequestsThroughCli } from "./pull-requests.mjs";

const TIMEOUT_MS = 120_000;

// One git command in `cwd` -> its output; a command that fails is an Error that says what git said.
function git(cwd, args) {
  return new Promise((resolve, reject) => {
    execFile("git", args, { cwd, encoding: "utf8", timeout: TIMEOUT_MS, maxBuffer: 1 << 26, env: { ...process.env, GIT_TERMINAL_PROMPT: "0" } },
      (error, stdout, stderr) => {
        if (!error) return resolve(stdout.trim());
        reject(new Error(String(stderr ?? "").trim() || (error.killed ? "git did not answer in time" : error.message)));
      });
  });
}

// The folder name a repository's address makes.
export const slugOf = (address) => address.replace(/^[a-z]+:\/\//i, "").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

// The Bridge's folders for one agent.
export const foldersOf = (folder) => ({ instance: join(folder, "instance"), product: (address) => join(folder, "products", slugOf(address)),
  job: (id) => join(folder, "jobs", id) });

// Work on one key — a clone, a product's taking — runs one after another: a clone's refs are one writer's at a time.
const queues = new Map();
export function exclusively(folder, work) {
  const run = (queues.get(folder) ?? Promise.resolve()).then(work, work);
  queues.set(folder, run.catch(() => {}));
  return run;
}

const exists = (path) => stat(path).then(() => true, () => false);

/** A clone of `address` in `folder`, made if it is not there, else brought up to what the origin holds. */
export function cloneOrFetch(address, folder) {
  return exclusively(folder, async () => {
    if (await exists(join(folder, ".git"))) {
      await git(folder, ["fetch", "--quiet", "--prune", "--tags", "origin"]);
      return folder;
    }
    await mkdir(dirname(folder), { recursive: true });
    await rm(folder, { recursive: true, force: true });
    await git(dirname(folder), ["clone", "--quiet", "--", address, folder]);
    return folder;
  });
}

/** The branch the clone's origin names as its default, and its head as the clone last fetched it. */
export async function defaultHead(folder) {
  const branch = (await git(folder, ["symbolic-ref", "--short", "refs/remotes/origin/HEAD"])).replace(/^origin\//, "");
  return { branch, commit: await git(folder, ["rev-parse", "--verify", `refs/remotes/origin/${branch}^{commit}`]) };
}

/**
 * MOD-repository-hosts' host for `address` through the clone in `folder`, its repositoryInfo answering the default branch the origin names, and its
 * commits one at a time with the clone's fetches: a push updates the clone's remote-tracking ref, which a fetch at the same moment would also lock.
 */
export async function hostOf(address, folder) {
  const host = connect(parseAddress(address), { clone: folder });
  const { branch } = await defaultHead(folder);
  // The pull requests through the person's gh, outside every enclosure (pull-requests.mjs); NotSupported where gh cannot open them.
  const pulls = pullRequestsThroughCli(address, { cwd: folder });
  return Object.freeze({ ...host, commitFiles: (change) => exclusively(folder, () => host.commitFiles(change)), repositoryInfo: async () => ({ defaultBranch: branch, visibility: null, canWrite: null, archived: false, description: null }),
    listPullRequests: pulls.listPullRequests, openPullRequest: pulls.openPullRequest });
}

/** The clone at one commit, detached, its files as that commit holds them. */
export function checkoutAt(folder, commit) {
  return exclusively(folder, () => git(folder, ["checkout", "--quiet", "--force", "--detach", commit]).then(() => folder));
}

/** A working clone of `address` for one job, holding the branch the origin names as its default. */
export async function workingClone(address, folder) {
  await mkdir(dirname(folder), { recursive: true });
  await rm(folder, { recursive: true, force: true });
  await git(dirname(folder), ["clone", "--quiet", "--", address, folder]);
  return folder;
}

/** The working clone removed. */
export const removeClone = (folder) => rm(folder, { recursive: true, force: true });

// The branches of a repository: { "<name>": commit }.
async function branchesOf(folder, prefix = "refs/heads/") {
  const listed = await git(folder, ["for-each-ref", "--format=%(refname) %(objectname)", prefix]);
  return Object.fromEntries(listed.split("\n").filter(Boolean).map((line) => line.split(" ")).map(([ref, commit]) => [ref.slice(prefix.length), commit]));
}

/**
 * makeOutbox(working) -> Promise<{ path, base }> — the job's outbox (MOD-bridge-jobs, Data): a bare repository `<working>.out.git` cloned from the working
 * clone, set as the working clone's push address, so that the agent's pushes land there; `base` its branches now. Made before the agent starts: the Bridge
 * runs git in the working clone only then.
 */
export async function makeOutbox(working) {
  const path = `${working}.out.git`;
  await rm(path, { recursive: true, force: true });
  await git(dirname(working), ["clone", "--bare", "--quiet", "--", working, path]);
  await git(working, ["remote", "set-url", "--push", "origin", path]);
  return { path, base: await branchesOf(path) };
}

/**
 * publish({ outbox, clone, job }) -> Promise<{ branch, commit }[]> — after the agent has answered: the outbox's branches fetched into the Bridge's clone of
 * the product, under `refs/agent-m/<job>/`; every branch new or moved against the outbox's base pushed to the origin under its name, never forced, with the
 * clone's own credentials; and the clone's branch of that name pointed at it, unless it is the branch checked out there. Fetching from the outbox runs no
 * command its configuration names. Throws, naming the branch and what git said, where the origin refuses a push.
 */
export function publish({ outbox, clone, job }) {
  return exclusively(clone, async () => {
    const space = `refs/agent-m/${job}/`;
    await git(clone, ["fetch", "--quiet", "--no-tags", "--", outbox.path, `+refs/heads/*:${space}*`]);
    const fetched = await branchesOf(clone, space);
    const current = await git(clone, ["symbolic-ref", "--quiet", "--short", "HEAD"]).catch(() => null);
    const pushed = [];
    try {
      for (const [branch, commit] of Object.entries(fetched)) {
        if (outbox.base[branch] === commit) continue;
        await git(clone, ["push", "--quiet", "origin", `${commit}:refs/heads/${branch}`]).catch((error) => {
          throw new Error(`the Bridge could not push the agent's branch ${branch}: ${error.message}`);
        });
        if (branch !== current) await git(clone, ["update-ref", `refs/heads/${branch}`, commit]);
        pushed.push({ branch, commit });
      }
    } finally {
      for (const branch of Object.keys(fetched)) await git(clone, ["update-ref", "-d", `${space}${branch}`]).catch(() => {});
    }
    return pushed;
  });
}
