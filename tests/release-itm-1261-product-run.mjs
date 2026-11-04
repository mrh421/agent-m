// The run of a product's workflow "main changed", for the release tests of ITM-1261 — a helper, no test of its own. It makes a temporary git repository of a product (a bare origin whose
// `main` holds the files a test gives and whose branches `trace-cache` and `overview-cache` hold a first commit each), the workspace the file agent-m-main-changed.yml lays out (the
// product's checkout in product/, the instance's in instance/), runs MOD-workflow-entries' onMainChanged in it as the step does, with the workflow's own token, and gives back what the
// two branches of the product's origin then hold for main's commit. The GitHub API, which the entry reaches for the repository's information and a path's history, is a fake `fetch` over
// the origin. Nothing reaches the network.
//
// Module: MOD-workflow-entries
// Level: release

import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runEntry } from "../src/workflow-entries/main.mjs";

const INSTANCE = { "SPEC.md": "# Agent M\n\n**AN INSTANCE RULE** *(Product Owner)*\n\nIt holds.\n*Check:* at review.\n" };
const git = (cwd, ...args) => {
  const r = spawnSync("git", args, { cwd, encoding: "utf8" });
  if (r.status !== 0) throw new Error(`git ${args.join(" ")} failed in ${cwd}: ${r.stderr}`);
  return r.stdout.trim();
};
const bytes = (cwd, object) => {
  const r = spawnSync("git", ["show", object], { cwd });
  return r.status === 0 ? new Uint8Array(r.stdout) : null;
};
const write = (root, files) => { for (const [path, body] of Object.entries(files)) { mkdirSync(join(root, path, ".."), { recursive: true }); writeFileSync(join(root, path), body); } };
const configure = (dir) => { for (const [key, value] of [["user.name", "Alice"], ["user.email", "alice@example.org"]]) git(dir, "config", key, value); };

// runInProduct(files) -> Promise<{ outcome, head, graph: Uint8Array, overview: string }> — the product alice/library holding `files` on main; `graph` is trace-cache's
// "<head>.json.gz", `overview` overview-cache's "<head>.json", both as the run left them, null where it left none.
export async function runInProduct(files) {
  const root = mkdtempSync(join(tmpdir(), "agent-m-release-1261-"));
  const origin = join(root, "origin.git"), seed = join(root, "seed"), workspace = join(root, "workspace");
  const product = join(workspace, "product"), instance = join(workspace, "instance");
  const saved = globalThis.fetch;
  try {
    git(root, "init", "-q", "--bare", "-b", "main", origin);
    git(root, "clone", "-q", origin, seed);
    configure(seed);
    write(seed, files);
    git(seed, "add", "-A");
    git(seed, "commit", "-q", "-m", "the product");
    git(seed, "push", "-q", "origin", "HEAD:refs/heads/main");
    for (const branch of ["trace-cache", "overview-cache"]) {
      git(seed, "checkout", "-q", "--orphan", branch);
      git(seed, "rm", "-rq", "--cached", ".");
      write(seed, { "README.md": "The files of the commits of the default branch, one each.\n" });
      git(seed, "add", "README.md");
      git(seed, "commit", "-q", "-m", `${branch}: the branch of the stored files`);
      git(seed, "push", "-q", "origin", `HEAD:refs/heads/${branch}`);
    }
    mkdirSync(workspace);
    git(workspace, "clone", "-q", origin, product);
    configure(product);
    for (const branch of ["trace-cache", "overview-cache"]) git(product, "fetch", "-q", "origin", `+${branch}:${branch}`);
    git(workspace, "init", "-q", "-b", "main", instance);
    configure(instance);
    write(instance, INSTANCE);
    git(instance, "add", "-A");
    git(instance, "commit", "-q", "-m", "the instance");
    const head = git(product, "rev-parse", "HEAD");
    const json = (value) => new Response(JSON.stringify(value), { status: 200, headers: { "content-type": "application/json" } });
    globalThis.fetch = async (address) => {
      const url = new URL(String(address));
      const path = url.pathname.replace("/repos/alice/library", "");
      if (path === "") return json({ default_branch: "main", private: false, permissions: { push: true }, archived: false, description: "" });
      if (path === "/commits") {
        const args = ["--git-dir", origin, "log", "--format=%H", url.searchParams.get("sha")];
        if (url.searchParams.get("path")) args.push("--", url.searchParams.get("path"));
        return json(git(root, ...args).split("\n").filter(Boolean).map((sha) => ({ sha, parents: [], author: { login: "alice" },
          commit: { message: "", author: { name: "Alice" }, committer: { date: git(root, "--git-dir", origin, "log", "-1", "--format=%cI", sha) } } })));
      }
      if (path === "/actions/runs") return json({ workflow_runs: [] });
      return json([]);
    };
    const status = await runEntry("onMainChanged", { GITHUB_ACTIONS: "true", GITHUB_EVENT_NAME: "push", GITHUB_WORKSPACE: workspace, GITHUB_SERVER_URL: "https://github.com",
      GITHUB_REPOSITORY: "alice/library", GITHUB_REF_NAME: "main", GITHUB_SHA: head, GITHUB_TOKEN: "ghp_ALICEworkflowTOKEN0123456789abcdef", AGENT_M_PRODUCT_DIR: product },
    { now: new Date("2026-10-31T10:00:00Z") });
    const overview = bytes(origin, `overview-cache:${head}.json`);
    return { outcome: status.outcome, summary: status.summary, head, graph: bytes(origin, `trace-cache:${head}.json.gz`), overview: overview && Buffer.from(overview).toString("utf8") };
  } finally {
    globalThis.fetch = saved;
    rmSync(root, { recursive: true, force: true });
  }
}
