// The file beside Agent M's job workflow in a product, which stores what the pages read (ITM-1261) — MOD-runtimes' jobWorkflowFiles, as the accepted text of
// docs/architecture/MOD-runtimes.md states it (Data: "Beside it, the file that stores what the pages read"; Interfaces: jobWorkflowFiles "and, beside them,
// the file that runs `onMainChanged`, at the same commit"): on GitHub .github/workflows/agent-m-main-changed.yml, on GitLab .gitlab/agent-m-main-changed.yml;
// it names the same instance repository and commit as the job workflow, has one job on the server's runners, runs MOD-workflow-entries' onMainChanged, runs no
// agent and reads no key; on GitHub it writes with the workflow's own token (`permissions: contents: write`), on GitLab with the person's token, its job of the
// environment agent-m-write.
// Run: node --test tests/runtimes-main-changed-file.test.mjs
//
// Module: MOD-runtimes
// Guards: UC-020; UC-035; THE TRACEABILITY MATRIX IS DERIVED; NO SECRET IN THE REPOSITORY
// Level: unit
//
// jobWorkflowFiles is pure and gives text; the texts are read as text, since no YAML parser stands in this repository. A file "reads a secret" where a line
// holds `secrets.`; it "names a key" where a line holds a key's name. The entries a file runs are the names after `node src/workflow-entries/main.mjs`. Each
// case asserts its known positive or counter-proof itself. Nothing reaches the network.

import test from "node:test";
import assert from "node:assert/strict";
import { jobWorkflowFiles } from "../src/runtimes/index.mjs";

const COMMIT = "0123456789abcdef0123456789abcdef01234567";
const INSTANCE = { repository: "alice/agent-m", commit: COMMIT };
const SECRETS = { token: "AGENT_M_TOKEN", keys: ["CLAUDE_KEY", "OPENAI_KEY"] };
const PATHS = { github: ".github/workflows/agent-m-main-changed.yml", gitlab: ".gitlab/agent-m-main-changed.yml" };
const mainChanged = (server) => jobWorkflowFiles(server, INSTANCE, SECRETS, ["gpu"]).find((file) => file.path === PATHS[server]);
const entries = (text) => [...text.matchAll(/node src\/workflow-entries\/main\.mjs (\w+)/g)].map((match) => match[1]);
// What a file beside the job workflow must not hold: a line that names a key of the run.
const keyLines = (text) => text.split("\n").filter((line) => SECRETS.keys.some((key) => line.includes(key)));

// TST-1261101 · level: unit · module: MOD-runtimes
// guards: UC-020; THE TRACEABILITY MATRIX IS DERIVED; NO SECRET IN THE REPOSITORY
// given: the instance alice/agent-m at COMMIT, the token secret AGENT_M_TOKEN, the key secrets CLAUDE_KEY and OPENAI_KEY, the runner gpu
// input: jobWorkflowFiles("github", …)
// expect: among the files, .github/workflows/agent-m-main-changed.yml, which checks out alice/agent-m at COMMIT, asks `permissions:` `contents: write`, holds no line with `secrets.`, runs on ubuntu-latest, runs the entry onMainChanged and no other — neither chooseAgentKey nor an agent's entry —, and holds no line naming CLAUDE_KEY or OPENAI_KEY; counter-proof: the same text with a line `CLAUDE_KEY: ${{ secrets.CLAUDE_KEY }}` added names a key and reads a secret
test("jobWorkflowFiles on GitHub — the main-changed file at the instance commit asks contents: write, reads no secret and runs onMainChanged alone", () => {
  const file = mainChanged("github");
  assert.ok(file, "failure node: jobWorkflowFiles returns .github/workflows/agent-m-main-changed.yml");
  assert.match(file.text, /\n {10}repository: alice\/agent-m\n {10}ref: 0123456789abcdef0123456789abcdef01234567\n/, "the instance at the commit given");
  assert.match(file.text, /\npermissions:\n {2}contents: write\n/);
  assert.deepEqual(file.text.split("\n").filter((line) => line.includes("secrets.")), [], "it reads no secret");
  assert.match(file.text, /\n {4}runs-on: ubuntu-latest\n/);
  assert.deepEqual(entries(file.text), ["onMainChanged"]);
  assert.deepEqual(keyLines(file.text), []);

  const planted = file.text.replace("    runs-on: ubuntu-latest\n", "    runs-on: ubuntu-latest\n    env:\n      CLAUDE_KEY: ${{ secrets.CLAUDE_KEY }}\n");
  assert.notEqual(planted, file.text, "counter-proof: the line is planted");
  assert.deepEqual(keyLines(planted), ["      CLAUDE_KEY: ${{ secrets.CLAUDE_KEY }}"], "counter-proof: a file that names a key fails");
});

// TST-1261102 · level: unit · module: MOD-runtimes
// guards: UC-020; THE TRACEABILITY MATRIX IS DERIVED; NO SECRET IN THE REPOSITORY
// given: the same instance, secrets and runner
// input: jobWorkflowFiles("gitlab", …)
// expect: among the files, .gitlab/agent-m-main-changed.yml, whose one job agent-m-main-changed names alice/agent-m and COMMIT, is of the environment agent-m-write with the action verify, names the token variable AGENT_M_TOKEN as AGENT_M_TOKEN_NAME and reads it by that name (`printenv "$AGENT_M_TOKEN_NAME"`), has no `tags:`, runs the entry onMainChanged and no other, and holds no line naming CLAUDE_KEY or OPENAI_KEY; counter-proof: the same text with a line `    CLAUDE_KEY: $CLAUDE_KEY` added under its variables names a key
test("jobWorkflowFiles on GitLab — the main-changed file at the instance commit is of agent-m-write, reads the token by its name and runs onMainChanged alone", () => {
  const file = mainChanged("gitlab");
  assert.ok(file, "failure node: jobWorkflowFiles returns .gitlab/agent-m-main-changed.yml");
  assert.deepEqual([...file.text.matchAll(/^([A-Za-z0-9_-]+):$/gm)].map((match) => match[1]), ["agent-m-main-changed"], "one job");
  assert.match(file.text, /\n {4}AGENT_M_INSTANCE: "alice\/agent-m"\n {4}AGENT_M_COMMIT: "0123456789abcdef0123456789abcdef01234567"\n/);
  assert.match(file.text, /\n {2}environment:\n {4}name: agent-m-write\n {4}action: verify\n/);
  assert.match(file.text, /\n {4}AGENT_M_TOKEN_NAME: "AGENT_M_TOKEN"\n/);
  assert.ok(file.text.includes('printenv "$AGENT_M_TOKEN_NAME"'), "the token is read by its name");
  assert.doesNotMatch(file.text, /\n\s*tags:/, "no self-hosted runner");
  assert.deepEqual(entries(file.text), ["onMainChanged"]);
  assert.deepEqual(keyLines(file.text), []);

  const planted = file.text.replace('    AGENT_M_TOKEN_NAME: "AGENT_M_TOKEN"\n', '    AGENT_M_TOKEN_NAME: "AGENT_M_TOKEN"\n    CLAUDE_KEY: $CLAUDE_KEY\n');
  assert.notEqual(planted, file.text, "counter-proof: the line is planted");
  assert.deepEqual(keyLines(planted), ["    CLAUDE_KEY: $CLAUDE_KEY"], "counter-proof: a file that names a key fails");
});
