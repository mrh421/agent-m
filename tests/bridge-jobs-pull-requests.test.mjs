// MOD-bridge-jobs — a product's pull requests through the server's command-line client logged in as the person (ARC-054), as
// docs/architecture/MOD-bridge-jobs.md states it: on a Bridge the host of a product on GitHub adds `listPullRequests` and `openPullRequest` in
// MOD-repository-hosts' form through `gh`, run by the Bridge outside every enclosure with `--repo` naming the product; where `gh` is missing or not
// logged in, and for a product on GitLab, both fail with NotSupported.
// Run: node --test tests/bridge-jobs-pull-requests.test.mjs
//
// Module: MOD-bridge-jobs
// Guards: NO MODEL READS A CREDENTIAL; UC-011
// Level: unit
//
// Fast, no network: `gh` is a fixture shell script in a temporary folder that is the whole PATH; it records its arguments and its standard input and
// answers as gh 2 does — `pr create` with the new pull request's address, `pr view` and `pr list` with JSON. The values are synthetic.

import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pullRequestsThroughCli } from "../src/bridge-jobs/pull-requests.mjs";

const VIEW = { number: 7, title: "JOB-1: implement", headRefName: "agent/work", baseRefName: "main", headRefOid: "a".repeat(40), mergeCommit: null, state: "OPEN",
  isDraft: false, url: "https://github.com/acme/product-a/pull/7", createdAt: "2026-10-27T10:00:00Z", mergedAt: null, closedAt: null, body: "the description" };
const MERGED = { ...VIEW, number: 6, state: "MERGED", mergeCommit: { oid: "b".repeat(40) }, mergedAt: "2026-10-27T11:00:00Z", closedAt: "2026-10-27T11:00:00Z" };

function computer(t, { gh = true, loggedIn = true } = {}) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "am-gh-")));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const bin = join(root, "bin"), log = join(root, "log");
  mkdirSync(bin);
  writeFileSync(log, "");
  if (gh) {
    writeFileSync(join(bin, "gh"), `#!/bin/sh
printf 'args:%s\\n' "$*" >> ${log}
${loggedIn ? "" : "echo 'To get started with GitHub CLI, please run:  gh auth login' >&2; exit 4"}
case "$1 $2" in
  'pr create') printf 'stdin:' >> ${log}; /bin/cat >> ${log}; printf '\\n' >> ${log}; echo '${VIEW.url}';;
  'pr view') echo '${JSON.stringify(VIEW)}';;
  'pr list') echo '${JSON.stringify([MERGED])}';;
esac
`, { mode: 0o755 });
  }
  const prior = process.env.PATH;
  process.env.PATH = bin;
  t.after(() => { process.env.PATH = prior; });
  return { root, lines: () => readFileSync(log, "utf8").split("\n").filter(Boolean) };
}

// TST-1381101 · level: unit · module: MOD-bridge-jobs
// guards: UC-011; NO MODEL READS A CREDENTIAL
// given: a product on GitHub, https://github.com/acme/product-a, and gh logged in on the Bridge's computer
// input: openPullRequest({ branch: "agent/work", base: "main", title: "JOB-1: implement", body: "the description" }), then listPullRequests({ branch: "agent/work", state: "all" })
// expect: gh is run as `pr create --repo acme/product-a --head agent/work --base main --title JOB-1: implement --body-file -` with the body on its standard input, then `pr view` of the address it printed; the answer is the pull request in MOD-repository-hosts' form — number 7, branch agent/work, base main, state open, its address and its body —; the list runs `pr list --repo acme/product-a --head agent/work --state all` and answers the merged pull request with state merged and its merge commit; counter-proof: the body travels on the standard input, in no argument
test("TST-1381101: the Bridge opens and lists a GitHub product's pull requests with the person's gh", async (t) => {
  const m = computer(t);
  const host = pullRequestsThroughCli("https://github.com/acme/product-a", { cwd: m.root });
  const opened = await host.openPullRequest({ branch: "agent/work", base: "main", title: "JOB-1: implement", body: "the description" });
  assert.deepEqual(opened, { number: 7, title: "JOB-1: implement", branch: "agent/work", base: "main", head: "a".repeat(40), mergeCommit: null, state: "open", draft: false,
    url: VIEW.url, opened: VIEW.createdAt, merged: null, closed: null, body: "the description" });
  const lines = m.lines();
  assert.equal(lines[0], "args:pr create --repo acme/product-a --head agent/work --base main --title JOB-1: implement --body-file -");
  assert.equal(lines[1], "stdin:the description");
  assert.match(lines[2], /^args:pr view https:\/\/github\.com\/acme\/product-a\/pull\/7 --repo acme\/product-a --json /);
  assert.equal(lines.some((line) => line.startsWith("args:") && line.includes("the description")), false, "counter-proof: the body is in no argument");

  const listed = await host.listPullRequests({ branch: "agent/work", state: "all" });
  assert.match(m.lines().at(-1), /^args:pr list --repo acme\/product-a --head agent\/work --state all --json /);
  assert.deepEqual(listed.map(({ number, state, mergeCommit, merged }) => ({ number, state, mergeCommit, merged })), [{ number: 6, state: "merged", mergeCommit: "b".repeat(40), merged: MERGED.mergedAt }]);
});

// TST-1381102 · level: unit · module: MOD-bridge-jobs
// guards: UC-011
// given: three Bridges' computers: one without gh, one whose gh is not logged in, one with gh logged in; and a product on GitLab
// input: openPullRequest and listPullRequests on the GitHub product on the first two, and on the GitLab product on the third
// expect: each fails with the HostError NotSupported; for the GitLab product gh is not started; counter-proof: TST-1381101, gh logged in on GitHub, answers
test("TST-1381102: without gh, without its login, or for GitLab, the pull request functions are NotSupported", async (t) => {
  const request = { branch: "agent/work", base: "main", title: "T", body: "B" };
  const notSupported = (error) => error?.name === "NotSupported";
  for (const options of [{ gh: false }, { loggedIn: false }]) {
    const m = computer(t, options);
    const host = pullRequestsThroughCli("https://github.com/acme/product-a", { cwd: m.root });
    await assert.rejects(host.openPullRequest(request), notSupported, JSON.stringify(options));
    await assert.rejects(host.listPullRequests({ branch: "agent/work", state: "all" }), notSupported, JSON.stringify(options));
  }
  const m = computer(t);
  const gitlab = pullRequestsThroughCli("https://gitlab.example.org/group/product", { cwd: m.root });
  await assert.rejects(gitlab.openPullRequest(request), notSupported);
  await assert.rejects(gitlab.listPullRequests({ branch: "agent/work" }), notSupported);
  assert.deepEqual(m.lines(), [], "gh is not started for GitLab");
});
