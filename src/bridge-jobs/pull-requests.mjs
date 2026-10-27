// pull-requests.mjs — a product's pull requests through the server's command-line client logged in as the person (MOD-bridge-jobs, Parts; ARC-054).
//
// Module: MOD-bridge-jobs
//
// NO MODEL READS A CREDENTIAL: the agent no longer opens its pull request, since its enclosure hides the person's login; the Bridge does, outside every
// enclosure, with `gh` and the login it already has on this computer — the person's own, as the computer's git login is. `--repo` names the product, so
// that gh reads nothing of the folder it runs in. Without gh, without its login, and for a product on GitLab, both functions are NotSupported, as they
// are for any local clone (MOD-repository-hosts); the job's writer then records the branch without a pull request.

import { spawn } from "node:child_process";
import { HostError, parseAddress } from "../repository-hosts/index.mjs";

// The fields gh answers a pull request with, and their reading as MOD-repository-hosts' PullRequest.
const FIELDS = "number,title,headRefName,baseRefName,headRefOid,mergeCommit,state,isDraft,url,createdAt,mergedAt,closedAt,body";
const pullRequestOf = (pull) => ({ number: pull.number, title: pull.title, branch: pull.headRefName, base: pull.baseRefName, head: pull.headRefOid,
  mergeCommit: pull.state === "MERGED" ? pull.mergeCommit?.oid ?? null : null, state: String(pull.state).toLowerCase(), draft: Boolean(pull.isDraft), url: pull.url,
  opened: pull.createdAt, merged: pull.mergedAt ?? null, closed: pull.closedAt ?? null, body: pull.body ?? "" });

const notSupported = (why) => new HostError("NotSupported", { what: why }, `${why}: the Bridge opens no pull request; the branch is pushed without one.`);

// gh with its arguments, its input written to its standard input: its output, or the failure as MOD-repository-hosts names it.
function gh(args, { cwd, input = null }) {
  return new Promise((resolve, reject) => {
    let stdout = "", stderr = "";
    const child = spawn("gh", args, { cwd, stdio: [input == null ? "ignore" : "pipe", "pipe", "pipe"], env: { ...process.env, GH_PROMPT_DISABLED: "1" } });
    if (input != null) { child.stdin.on("error", () => {}); child.stdin.end(input); }
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", (error) => reject(error.code === "ENOENT" ? notSupported("gh is not installed on this computer") : new HostError("Unreachable", { reason: error.message }, error.message)));
    child.on("close", (status) => {
      if (status === 0) return resolve(stdout.trim());
      // gh exits 4 when it is not logged in.
      if (status === 4) return reject(notSupported("gh is not logged in on this computer"));
      reject(new HostError("Unreachable", { reason: stderr.trim() }, `gh ${args.slice(0, 2).join(" ")} failed: ${stderr.trim()}`));
    });
  });
}

/**
 * pullRequestsThroughCli(address, { cwd }) -> { listPullRequests(filter), openPullRequest(request) } — MOD-repository-hosts' two functions for the
 * product at `address`, through gh in `cwd`, a folder of the Bridge's own. For a product not on GitHub both throw NotSupported without starting gh.
 * Crosses the network to the server through gh.
 */
export function pullRequestsThroughCli(address, { cwd }) {
  const { server, path } = parseAddress(address);
  if (server !== "github") {
    const refused = async () => { throw notSupported(`${address} is not on GitHub`); };
    return { listPullRequests: refused, openPullRequest: refused };
  }
  return {
    async listPullRequests({ state = "open", branch } = {}) {
      const answer = await gh(["pr", "list", "--repo", path, ...(branch ? ["--head", branch] : []), "--state", state, "--json", FIELDS], { cwd });
      return JSON.parse(answer || "[]").map(pullRequestOf);
    },
    async openPullRequest({ branch, base, title, body, draft = false }) {
      const url = (await gh(["pr", "create", "--repo", path, "--head", branch, "--base", base, "--title", title, "--body-file", "-", ...(draft ? ["--draft"] : [])], { cwd, input: body ?? "" })).split("\n").pop().trim();
      return pullRequestOf(JSON.parse(await gh(["pr", "view", url, "--repo", path, "--json", FIELDS], { cwd })));
    },
  };
}
