// MOD-bridge-jobs — the job's outbox, and the branches the Bridge publishes from it (ARC-054), as docs/architecture/MOD-bridge-jobs.md states it: "The
// Bridge runs git in the working clone and the outbox only before the agent starts; afterwards it only fetches the outbox's objects from its own clone,
// which runs no command the outbox's configuration names: a hook or a command written there would run with the person's rights."
// Run: node --test tests/bridge-jobs-outbox.test.mjs
//
// Module: MOD-bridge-jobs
// Guards: NO MODEL READS A CREDENTIAL
// Level: unit
//
// Fast, no network: the origin, the Bridge's clone, the job's working clone and its outbox are repositories in a temporary folder; the agent is the
// test, which commits in the working clone, pushes into the outbox, and then writes into the outbox's configuration every command git could be made to
// run — a credential helper, an fsmonitor, an SSH command, the hook of pack-objects and a folder of hooks —, each of which leaves a mark when it runs.

import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { makeOutbox, publish } from "../src/bridge-jobs/workfolders.mjs";

const git = (cwd, ...args) => {
  const done = spawnSync("git", args, { cwd, encoding: "utf8", env: { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_SYSTEM: "/dev/null", GIT_AUTHOR_NAME: "A",
    GIT_AUTHOR_EMAIL: "a@example.org", GIT_COMMITTER_NAME: "A", GIT_COMMITTER_EMAIL: "a@example.org", GIT_TERMINAL_PROMPT: "0" } });
  if (done.status !== 0) throw new Error(`git ${args.join(" ")}: ${done.stderr}`);
  return done.stdout.trim();
};

// TST-1381004 · level: unit · module: MOD-bridge-jobs
// guards: NO MODEL READS A CREDENTIAL
// given: an origin with main, the Bridge's clone of it, the job's working clone with its outbox made by makeOutbox; the agent commits on agent/work, pushes it into the outbox, and then plants in the outbox's configuration a credential helper, core.fsmonitor, core.sshCommand, uploadpack.packObjectsHook and core.hooksPath with every hook, each touching its own mark
// input: publish({ outbox, clone, job: "JOB-1" })
// expect: agent/work is on the origin at the agent's commit and the clone's agent/work points there; main is not moved; no mark exists; the clone holds no ref below refs/agent-m/; counter-proof: git asked for a credential inside the outbox runs the planted helper, whose mark then exists
test("TST-1381004: the Bridge publishes the agent's branch from the outbox and runs nothing the outbox's configuration names", (t) => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "am-outbox-")));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const origin = join(root, "origin.git"), seed = join(root, "seed"), clone = join(root, "clone"), working = join(root, "jobs", "JOB-1"), marks = join(root, "marks");
  mkdirSync(marks);
  mkdirSync(join(root, "jobs"));
  git(root, "init", "-q", "--bare", "-b", "main", origin);
  git(root, "clone", "-q", origin, seed);
  writeFileSync(join(seed, "README.md"), "product\n");
  git(seed, "add", "README.md");
  git(seed, "commit", "-q", "-m", "first");
  git(seed, "push", "-q", "origin", "HEAD:refs/heads/main");
  const main = git(seed, "rev-parse", "HEAD");
  git(root, "clone", "-q", origin, clone);
  git(root, "clone", "-q", origin, working);

  const prior = { GIT_CONFIG_GLOBAL: process.env.GIT_CONFIG_GLOBAL, GIT_CONFIG_SYSTEM: process.env.GIT_CONFIG_SYSTEM };
  Object.assign(process.env, { GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_SYSTEM: "/dev/null" });
  t.after(() => { for (const [key, value] of Object.entries(prior)) if (value === undefined) delete process.env[key]; else process.env[key] = value; });
  return (async () => {
    const outbox = await makeOutbox(working);
    git(working, "checkout", "-q", "-b", "agent/work");
    writeFileSync(join(working, "change.txt"), "change\n");
    git(working, "add", "change.txt");
    git(working, "commit", "-q", "-m", "change");
    git(working, "push", "-q", "origin", "agent/work");
    const commit = git(working, "rev-parse", "HEAD");

    const mark = (name) => `touch ${join(marks, name)}`;
    const hooks = join(root, "planted-hooks");
    mkdirSync(hooks);
    for (const hook of ["pre-receive", "post-receive", "update", "post-update", "reference-transaction", "pre-push", "post-checkout", "fsmonitor-watchman", "push-to-checkout"]) {
      writeFileSync(join(hooks, hook), `#!/bin/sh\n${mark(hook)}\n`, { mode: 0o755 });
    }
    git(outbox.path, "config", "credential.helper", `!${mark("credential")}; :`);
    git(outbox.path, "config", "core.fsmonitor", `${mark("fsmonitor")}; :`);
    git(outbox.path, "config", "core.sshCommand", `${mark("ssh")}; :`);
    git(outbox.path, "config", "uploadpack.packObjectsHook", join(hooks, "post-update"));
    git(outbox.path, "config", "core.hooksPath", hooks);

    const pushed = await publish({ outbox, clone, job: "JOB-1" });
    assert.deepEqual(pushed, [{ branch: "agent/work", commit }]);
    assert.equal(git(root, "--git-dir", origin, "rev-parse", "agent/work"), commit);
    assert.equal(git(root, "--git-dir", origin, "rev-parse", "main"), main, "main is not moved");
    assert.equal(git(clone, "rev-parse", "refs/heads/agent/work"), commit, "the clone's branch points at what was pushed");
    assert.equal(git(clone, "for-each-ref", "refs/agent-m/"), "", "nothing is left below refs/agent-m/");
    assert.equal(spawnSync("ls", [marks], { encoding: "utf8" }).stdout.trim(), "", "no planted command ran");

    spawnSync("git", ["-C", outbox.path, "credential", "fill"], { input: "protocol=https\nhost=example.org\n\n", encoding: "utf8", env: { ...process.env, GIT_TERMINAL_PROMPT: "0" } });
    assert.equal(existsSync(join(marks, "credential")), true, "counter-proof: git asked for a credential inside the outbox runs the planted helper");
  })();
});
