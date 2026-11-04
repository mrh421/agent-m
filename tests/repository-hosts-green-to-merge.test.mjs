// MOD-repository-hosts' RepositoryInfo `greenToMerge` and WebLinks `branchProtection` (ITM-1170), as docs/architecture/MOD-repository-hosts.md states them: "`greenToMerge` whether the server refuses a merge into the
// default branch until its required checks have passed — on GitHub a protection of that branch, or an active rule of a ruleset that applies to it, that requires status checks; on GitLab the project's setting that
// pipelines must succeed —, `null` where the stored token may not read it"; "`branchProtection` the page on which the rule behind `greenToMerge` is set".
// Run: node --test tests/repository-hosts-green-to-merge.test.mjs
//
// Module: MOD-repository-hosts
// Guards: UC-024; UC-042; CODE ENTERS THE DEFAULT BRANCH THROUGH A PULL REQUEST WITH GREEN CI; A BROWSER SETTING IS TESTED AND CLEARED WHERE IT IS SHOWN
// Level: unit
//
// Deterministic, no network: GitHub's REST API and GraphQL API and GitLab's REST API v4 are fakes of `fetch` that record every request. Readings the texts leave open, which the tests state (the pull request names them):
//   - ITM-1170, "The reading taken": repositoryInfo reads the repository's record over REST as before; on GitHub with a token it also sends one read-only request of the GraphQL API for greenToMerge alone,
//     together with the record's request, not after it. UC-042 step 2's "one harmless request" is read as one harmless test of the token, sent to its own server only.
//   - greenToMerge is read from the default branch's `refUpdateRule` — its protection as a reader sees it, with the contexts of its required status checks — and its `rules`, the active rules of the rulesets
//     that apply to it; GitHub gives `branchProtectionRule` to administrators only. Either requiring a check is true; both read and neither requiring one, false; a GraphQL answer that is refused, fails, does
//     not come, names an error on either field, or holds no default branch, null — while the record is still read.
//   - Without a token GitHub's GraphQL API takes no request, so only the record is read, and greenToMerge is null.
//   - On GitLab, greenToMerge is `only_allow_merge_if_pipeline_succeeds` of the project's record, and null where the record does not hold it; no further request is sent.
//   - branchProtection is GitHub's <repository>/settings/branches and GitLab's <project>/-/settings/merge_requests, where "Pipelines must succeed" is set.
// Each test states its input and its expected result before it runs. The counter-proofs are recorded in the pull request.

import test from "node:test";
import assert from "node:assert/strict";
import { parseAddress, connect } from "../src/repository-hosts/index.mjs";

const GITHUB_TOKEN = "github_pat_GREENtoMERGE0123456789abcdef";
const GITLAB_TOKEN = "glpat-GREENtoMERGE0123456789";
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

async function using(fetchFn, run) {
  const real = globalThis.fetch;
  globalThis.fetch = fetchFn;
  try { return await run(); } finally { globalThis.fetch = real; }
}

// The default branch of each fixture repository, as GitHub's GraphQL API gives `defaultBranchRef` with `refUpdateRule` and `rules` (docs.github.com/en/graphql/reference/objects#ref), and the errors it adds.
const REF = {
  protected: { ref: { refUpdateRule: { requiredStatusCheckContexts: ["agent-m tests"] }, rules: { nodes: [] } } },
  ruleset: { ref: { refUpdateRule: null, rules: { nodes: [{ type: "PULL_REQUEST" }, { type: "REQUIRED_STATUS_CHECKS" }] } } },
  "no-checks": { ref: { refUpdateRule: { requiredStatusCheckContexts: [] }, rules: { nodes: [{ type: "DELETION" }] } } },
  open: { ref: { refUpdateRule: null, rules: { nodes: [] } } },
  "rules-unread": { ref: { refUpdateRule: null, rules: null },
    errors: [{ type: "FORBIDDEN", path: ["repository", "defaultBranchRef", "rules"], message: "Resource not accessible by personal access token" }] },
  empty: { ref: null },
};

// A fake GitHub: the REST API answers the repository's record ("Get a repository"); the GraphQL API answers the default branch's fields of each fixture. `graphql(name, body)` overrides the GraphQL answer
// (a Response, or a thrown error). The record waits up to 200 ms for the GraphQL request to arrive, so that `together` tells whether that request was sent before the record was answered.
function fakeGitHub({ graphql = null } = {}) {
  const requests = [];
  let seen = null;
  const asked = new Promise((resolve) => { seen = resolve; });
  const state = { together: false };
  const fetch = async (input, init = {}) => {
    const url = new URL(String(input));
    const body = init.body ? JSON.parse(init.body) : null;
    requests.push({ method: init.method ?? "GET", path: url.pathname, query: body?.query ?? null, authorization: new Headers(init.headers).get("authorization") });
    if (url.pathname === "/graphql") {
      seen();
      const name = body.variables.name;
      if (graphql) return graphql(name, body);
      const fixture = REF[name];
      if (!fixture) return json({ data: { repository: null }, errors: [{ type: "NOT_FOUND", path: ["repository"], message: "Could not resolve to a Repository" }] });
      return json({ data: { repository: { defaultBranchRef: fixture.ref } }, ...(fixture.errors ? { errors: fixture.errors } : {}) });
    }
    const [, , owner, name] = url.pathname.split("/");
    if (!REF[name]) return json({ message: "Not Found" }, 404);
    if (init.headers && new Headers(init.headers).get("authorization")) {
      state.together = await Promise.race([asked.then(() => true), new Promise((resolve) => setTimeout(() => resolve(false), 200))]);
    }
    return json({ default_branch: "main", visibility: name === "open" ? "public" : "private", private: name !== "open", archived: false, description: `${owner}'s ${name}`, permissions: { push: name !== "open" } });
  };
  return { fetch, requests, state };
}
const github = (name, token = GITHUB_TOKEN) => connect(parseAddress(`https://github.com/acme/${name}`), token ? { token, tokenName: "acme's token" } : {});
const sent = (fake) => fake.requests.map((r) => `${r.method} ${r.path}`).sort();

// TST-1170001 · level: unit · module: MOD-repository-hosts
// guards: UC-042; A BROWSER SETTING IS TESTED AND CLEARED WHERE IT IS SHOWN
// given: a fake GitHub that answers the REST API and the GraphQL API; the repository acme/protected, whose default branch requires the status check "agent-m tests"; a host with a token
// input: repositoryInfo()
// expect: two requests, both to GitHub's API with the token as Authorization — GET /repos/acme/protected, the record as before, and one POST /graphql that asks for the default branch's refUpdateRule and rules and for no field of the record —, the GraphQL request sent before the record was answered; the answer is { defaultBranch: "main", visibility: "private", canWrite: true, archived: false, description: "acme's protected", greenToMerge: true }; counter-proof: a GraphQL request sent only after the record's answer is not together
test("repositoryInfo on GitHub with a token reads the record as before and, together with it, one GraphQL request for greenToMerge", async () => {
  const fake = fakeGitHub();
  const info = await using(fake.fetch, () => github("protected").repositoryInfo());
  assert.deepEqual(info, { defaultBranch: "main", visibility: "private", canWrite: true, archived: false, description: "acme's protected", greenToMerge: true });
  assert.deepEqual(sent(fake), ["GET /repos/acme/protected", "POST /graphql"]);
  for (const r of fake.requests) assert.equal(r.authorization, `Bearer ${GITHUB_TOKEN}`, `${r.method} ${r.path}`);
  const query = fake.requests.find((r) => r.path === "/graphql").query;
  assert.match(query, /refUpdateRule\s*\{\s*requiredStatusCheckContexts/);
  assert.match(query, /rules\(/);
  assert.doesNotMatch(query, /visibility|viewerPermission|description|isArchived/, "the GraphQL request asks for greenToMerge alone");
  assert.equal(fake.state.together, true, "the GraphQL request is sent together with the record's, not after it");
});

// TST-1170002 · level: unit · module: MOD-repository-hosts
// guards: UC-024; CODE ENTERS THE DEFAULT BRANCH THROUGH A PULL REQUEST WITH GREEN CI
// given: GitHub repositories whose default branch is protected with a required check (protected), covered by a ruleset with a rule REQUIRED_STATUS_CHECKS and no protection (ruleset), protected without a required check (no-checks), neither protected nor covered (open), with rules the token may not read (rules-unread), and without any branch (empty)
// input: repositoryInfo() of each, with a token
// expect: greenToMerge true, true, false, false, null, null; each with the record's request and one GraphQL request; known positive: open is read from its record as public and not writable, its default branch main
test("greenToMerge on GitHub: a required check of the branch's protection or of a ruleset is true, neither is false, what cannot be read is null", async () => {
  const expected = { protected: true, ruleset: true, "no-checks": false, open: false, "rules-unread": null, empty: null };
  for (const [name, green] of Object.entries(expected)) {
    const fake = fakeGitHub();
    const info = await using(fake.fetch, () => github(name).repositoryInfo());
    assert.equal(info.greenToMerge, green, name);
    assert.deepEqual(sent(fake), [`GET /repos/acme/${name}`, "POST /graphql"], name);
    if (name === "open") assert.deepEqual([info.defaultBranch, info.visibility, info.canWrite], ["main", "public", false], "known positive: the record's fields");
  }
});

// TST-1170003 · level: unit · module: MOD-repository-hosts
// guards: UC-042
// given: the fake GitHub; the repository acme/open read without a token; the repository acme/missing, which the fake does not hold, read with a token
// input: repositoryInfo() of acme/open without a token; repositoryInfo() of acme/missing with one
// expect: without a token, one request to the REST record of the repository, without authorisation, none to the GraphQL API, and greenToMerge null, the default branch main; acme/missing fails with NotFound, as its record is not found
test("repositoryInfo on GitHub without a token reads only the record, with greenToMerge null, and a repository whose record is not found is NotFound", async () => {
  const fake = fakeGitHub();
  const info = await using(fake.fetch, () => github("open", null).repositoryInfo());
  assert.deepEqual(sent(fake), ["GET /repos/acme/open"]);
  assert.equal(fake.requests[0].authorization, null);
  assert.deepEqual([info.defaultBranch, info.canWrite, info.greenToMerge], ["main", false, null]);
  const failure = await using(fakeGitHub().fetch, () => github("missing").repositoryInfo().then(() => null, (error) => error));
  assert.equal(failure?.name, "NotFound");
});

// TST-1170009 · level: unit · module: MOD-repository-hosts
// guards: UC-042; UC-024
// given: the repository acme/protected, whose record the fake GitHub serves, while its GraphQL API answers 404, answers 500, refuses with 403 and a used-up limit, answers 200 with the error RATE_LIMITED, answers a repository without fields ({ data: { repository: {} } }), answers no repository, or fails to answer at all (fetch throws)
// input: repositoryInfo() with a token, once for each
// expect: each gives greenToMerge null and the record's fields as before — default branch main, private, writable —, and none throws; known positive: with the GraphQL answer of TST-1170001, true
test("a GraphQL answer that is refused, fails or does not come gives greenToMerge null, and the record is still read", async () => {
  const failing = {
    "404": () => json({ message: "Not Found" }, 404),
    "500": () => json({ message: "Server Error" }, 500),
    "403 limit": () => new Response("{}", { status: 403, headers: { "x-ratelimit-remaining": "0", "x-ratelimit-limit": "5000", "x-ratelimit-reset": "1790000000" } }),
    "RATE_LIMITED": () => json({ data: null, errors: [{ type: "RATE_LIMITED", message: "API rate limit exceeded" }] }),
    "no fields": () => json({ data: { repository: {} } }),
    "no repository": () => json({ data: { repository: null }, errors: [{ type: "NOT_FOUND", path: ["repository"] }] }),
    "no answer": () => { throw new TypeError("Failed to fetch"); },
  };
  for (const [how, answer] of Object.entries(failing)) {
    const fake = fakeGitHub({ graphql: answer });
    const info = await using(fake.fetch, () => github("protected").repositoryInfo());
    assert.deepEqual(info, { defaultBranch: "main", visibility: "private", canWrite: true, archived: false, description: "acme's protected", greenToMerge: null }, how);
  }
  assert.equal((await using(fakeGitHub().fetch, () => github("protected").repositoryInfo())).greenToMerge, true, "known positive");
});

// A fake GitLab server: "Get a single project" with the setting `only_allow_merge_if_pipeline_succeeds` as `pipelines` gives it (absent where undefined).
function fakeGitLab(pipelines) {
  const requests = [];
  const fetch = async (input) => {
    requests.push(new URL(String(input)).pathname);
    return json({ id: 7, default_branch: "main", visibility: "private", archived: false, description: "", permissions: { project_access: { access_level: 40 } },
      ...(pipelines === undefined ? {} : { only_allow_merge_if_pipeline_succeeds: pipelines }) });
  };
  return { fetch, requests };
}

// TST-1170004 · level: unit · module: MOD-repository-hosts
// guards: UC-024; UC-042
// given: a GitLab project whose setting "Pipelines must succeed" is on, one where it is off, and one whose record does not hold the setting; a host with the project's token
// input: repositoryInfo() of each
// expect: greenToMerge true, false, null; each in one request, to the project's record; known positive: the default branch main and canWrite true for a Maintainer
test("greenToMerge on GitLab is the project's setting that pipelines must succeed, null where its record does not hold it", async () => {
  for (const [pipelines, green] of [[true, true], [false, false], [undefined, null]]) {
    const fake = fakeGitLab(pipelines);
    const info = await using(fake.fetch, () => connect(parseAddress("https://gitlab.example.org/acme/tool"), { token: GITLAB_TOKEN }).repositoryInfo());
    assert.equal(info.greenToMerge, green, String(pipelines));
    assert.deepEqual(fake.requests, ["/api/v4/projects/acme%2Ftool"]);
    assert.deepEqual([info.defaultBranch, info.canWrite], ["main", true], "known positive");
  }
});

// TST-1170005 · level: unit · module: MOD-repository-hosts
// guards: UC-024
// given: the repository https://github.com/acme/product and the GitLab project https://gitlab.example.org/space/group/tool, each connected with a token; known positive: each one's Actions or pipelines page
// input: webLinks().branchProtection of each
// expect: https://github.com/acme/product/settings/branches and https://gitlab.example.org/space/group/tool/-/settings/merge_requests; neither holds the token; no request is made
test("webLinks gives the page on which the rule behind greenToMerge is set", async () => {
  const requests = [];
  await using(async (input) => { requests.push(String(input)); throw new Error("webLinks reaches no server"); }, () => {
    const gh = connect(parseAddress("https://github.com/acme/product"), { token: GITHUB_TOKEN }).webLinks();
    const gl = connect(parseAddress("https://gitlab.example.org/space/group/tool"), { token: GITLAB_TOKEN }).webLinks();
    assert.equal(gh.actions, "https://github.com/acme/product/actions", "known positive");
    assert.equal(gl.actions, "https://gitlab.example.org/space/group/tool/-/pipelines", "known positive");
    assert.equal(gh.branchProtection, "https://github.com/acme/product/settings/branches");
    assert.equal(gl.branchProtection, "https://gitlab.example.org/space/group/tool/-/settings/merge_requests");
    assert.ok(!gh.branchProtection.includes(GITHUB_TOKEN) && !gl.branchProtection.includes(GITLAB_TOKEN));
  });
  assert.deepEqual(requests, []);
});
