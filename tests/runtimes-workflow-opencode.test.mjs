// The job workflow installs no opencode — MOD-runtimes' jobWorkflowFiles and its templates workflow/github.yml and workflow/gitlab.yml, as docs/architecture/MOD-runtimes.md
// states it (Data: Agent M's job workflow in a product): "It reads the product with the workflow's own read access … and clones the instance without a token; it installs no
// coding agent: a model endpoint's job runs in Agent M's own loop with the tools of MOD-checkout-tools (MOD-workflow-entries)". The agent's machine runs Agent M's entries with
// Node alone, on a dispatch that names an endpoint as on any other start.
// Run: node --test tests/runtimes-workflow-opencode.test.mjs
//
// Module: MOD-runtimes
// Guards: UC-010; UC-049; A HOSTED JOB AUTHENTICATES ITS AGENT WITH A CI SECRET; NO SECRET IN THE REPOSITORY
// Level: unit

import test from "node:test";
import assert from "node:assert/strict";
import { jobWorkflowFiles } from "../src/runtimes/index.mjs";

const INSTANCE = { repository: "akmaier/agent-m", commit: "c0ffee0000000000000000000000000000000000" };
const SECRETS = { token: "AGENT_M_TOKEN", keys: ["NVIDIA_API_KEY", "HOSTED_KEY"] };

// TST-1200301 · level: unit · module: MOD-runtimes
// guards: UC-049; A HOSTED JOB AUTHENTICATES ITS AGENT WITH A CI SECRET; NO SECRET IN THE REPOSITORY
// given: the GitHub job workflow for the keys NVIDIA_API_KEY and HOSTED_KEY
// input: jobWorkflowFiles("github", INSTANCE, { token: "AGENT_M_TOKEN", keys: ["NVIDIA_API_KEY", "HOSTED_KEY"] }, [])
// expect: no line of the file names opencode or installs a package with npm; each agent's job still sets Node up and runs onDispatch — the known positive that the search reads the agent's jobs —; NVIDIA_API_KEY is read only as `NVIDIA_API_KEY: ${{ secrets.NVIDIA_API_KEY }}`, in the agent's job of that key and in the job that writes, and listed in AGENT_M_KEY_NAMES; no other line names it
test("the GitHub job workflow installs no opencode, and reads NVIDIA_API_KEY only from its secret", () => {
  const [file] = jobWorkflowFiles("github", INSTANCE, SECRETS, []);
  const jobs = file.text.slice(file.text.indexOf("\njobs:\n") + 7).split(/\n(?=  [A-Za-z0-9_-]+:\n)/);
  const agents = jobs.filter((job) => /-agent-\d+:/.test(job.split("\n")[0]));
  assert.ok(agents.length >= 3, "the route's agent's jobs are read");
  for (const job of agents) {
    assert.ok(job.includes("actions/setup-node"), "known positive: the agent's job sets Node up");
    assert.ok(job.includes("main.mjs onDispatch"), "known positive: the agent's job runs onDispatch");
  }
  assert.deepEqual(file.text.split("\n").filter((line) => /opencode|npm install/.test(line)), [], "no line installs opencode");
  const naming = file.text.split("\n").filter((line) => line.includes("NVIDIA_API_KEY")).map((line) => line.trim());
  assert.deepEqual([...new Set(naming)], ['AGENT_M_KEY_NAMES: "NVIDIA_API_KEY HOSTED_KEY"', "NVIDIA_API_KEY: ${{ secrets.NVIDIA_API_KEY }}"]);
  assert.equal(naming.filter((line) => line.startsWith("NVIDIA_API_KEY:")).length, 2);
});

// TST-1200302 · level: unit · module: MOD-runtimes
// guards: UC-049
// given: the GitLab job workflow for the same keys, with no .gitlab-ci.yml of the product's
// input: jobWorkflowFiles("gitlab", INSTANCE, SECRETS, [], null)
// expect: no line of any file names opencode or installs a package with npm; the agent's jobs still run the entry Node runs with AGENT_M_ENTRY — the known positive that the search reads them
test("the GitLab job workflow installs no opencode", () => {
  const files = jobWorkflowFiles("gitlab", INSTANCE, SECRETS, [], null);
  const all = files.map((file) => file.text).join("\n");
  assert.match(all, /node src\/workflow-entries\/main\.mjs "\$AGENT_M_ENTRY"/, "known positive: the agent's jobs run the entry with Node");
  assert.deepEqual(all.split("\n").filter((line) => /opencode|npm install/.test(line)), [], "no line installs opencode");
});
