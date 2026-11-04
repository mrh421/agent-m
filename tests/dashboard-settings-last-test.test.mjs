// UC-042 step 1 — each browser setting's line shows ✓ works with the date of the last successful test, or ✗ refused when the server
// refused it at the last use, also after a reload (ITM-136). The real app (src/site-frame/dashboard-app.mjs) runs in
// tests/app-harness.mjs; a reload is a new page load — the app imported afresh, with nothing in memory — on the same browser
// storage. The kept date and outcome are browser settings like the rest: shown on the settings page, removed by Clear and by Clear
// everything, carried by an export. Run: node --test tests/*.test.mjs
//
// Module: MOD-settings-pages
// Guards: A BROWSER SETTING IS TESTED AND CLEARED WHERE IT IS SHOWN; EVERY SETTING IS REACHED FROM ONE PAGE; A CLEAR IS A REAL CLEAR; SETTINGS ARE EXPORTED AND IMPORTED WITH THEIR SECRETS; AN EXPIRED TOKEN IS NAMED AND ITS RENEWAL LINKED; A USED-UP RATE LIMIT IS NAMED, NOT BLAMED ON THE TOKEN; UC-042
// Level: component
//
// The counter-proof of every test here (a planted fault and its red result): docs/measurements/2026-10-01_settings-last-test.md.

import test from "node:test";
import assert from "node:assert/strict";
import { repoServer, openDashboard, TOKEN, richDocument, press, settle, attrOf } from "./app-harness.mjs";
import { GL, GL_ADDR, GL_TOKEN } from "./review-core.d/helpers.mjs";

const API = "https://api.github.com";
const canonicalKey = (name) => `agent-m:akmaier/agent-m:${name}`;
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "Content-Type": "application/json" } });
const day = (days) => { const n = new Date(); return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()) + days * 864e5).toISOString().slice(0, 10); };
const TODAY = day(0);

// What the person answers to a confirmation.
globalThis.confirm = () => true;

// Agent M's entries of this browser's localStorage, { key: value }.
const agentEntries = () => {
  const out = {};
  for (let i = 0; i < globalThis.localStorage.length; i++) {
    const k = globalThis.localStorage.key(i);
    if (k && k.startsWith("agent-m:")) out[k] = globalThis.localStorage.getItem(k);
  }
  return out;
};

// The instance's repository on GitHub. While `world.refuseGitHub` is set, GitHub's API refuses every request that carries the
// stored token with 401, as it does a token that expired or was regenerated; a GitLab server answers its project's API — Test's
// request with the project token — with 401 while `world.refuseGitLab` is set; and localhost answers on the session ports in
// `world.up`.
async function instanceWorld(handlers = []) {
  const world = { refuseGitHub: false, refuseGitLab: false, up: new Set() };
  world.srv = await repoServer({ files: { "SPEC.md": "# S\n", "docs/use-cases/README.md": "# Use cases\n" }, handlers: [
    ...handlers,
    (url, init) => (world.refuseGitHub && url.origin === API && init.headers?.Authorization === `Bearer ${TOKEN}`
      ? json({ message: "Bad credentials" }, 401) : undefined),
    (url) => {
      if (url.origin !== GL || !url.pathname.startsWith("/api/v4/projects/")) return undefined;
      return world.refuseGitLab ? json({ message: "401 Unauthorized" }, 401)
        : json({ path_with_namespace: "grp/sub/proj", visibility: "private", default_branch: "main",
          permissions: { project_access: { access_level: 40 } } });
    },
    (url) => {
      if (url.hostname !== "localhost") return undefined;
      if (world.up.has(Number(url.port))) return new Response("", { status: 200 });
      throw new TypeError("Failed to fetch");
    },
  ] });
  return world;
}

// One page load of the settings page on a browser that holds `entries` (a reload keeps every entry of the page before it).
async function settingsPage(world, entries = canonicalToken()) {
  const page = await openDashboard({ server: world.srv, hash: "#uc", token: null, entries });
  const dom = richDocument(), createElement = globalThis.document.createElement.bind(globalThis.document);
  globalThis.document.createElement = (name) => {
    const node = createElement(name);
    if (!("childNodes" in node)) Object.defineProperty(node, "childNodes", { get: () => node.children ?? [] });
    return node;
  };
  const main = dom.byId("main"), replace = main.replaceChildren.bind(main);
  let mounted = [];
  main.replaceChildren = (...children) => { mounted = children; replace(...children); };
  await page.go("#settings");
  const pane = (name) => mounted.find((node) => node.className?.split(" ").includes("settings-tab-panel") && node.textContent.includes(name));
  assert.ok(pane("Repositories"), "the dashboard mounts the public Repositories pane");
  assert.ok(pane("Endpoints & Agents"), "the dashboard mounts the public Endpoints & Agents pane");
  // Cases below are retained one-for-one from b099.  Their selectors still need
  // explicit per-control mapping; this route capture prevents any return to the
  // retired dashboard-owned browser-settings mount.
  const box = () => pane("Repositories");
  return { page, dom, box, general: () => pane("General"), endpointBox: () => pane("Endpoints & Agents") };
}
const reload = (world) => settingsPage(world, agentEntries());

// The line of one setting, by its row's name; the text of its state.
const row = (box, name) => box().innerHTML.split('<div class="setting"').find((r) => r.startsWith(` data-setting-row="${name}"`)) ?? "";
const stateOf = (html) => /<p class="state">([^]*?)<\/p>/.exec(html)?.[1] ?? null;
const gitlabLine = (box) => /<div class="gitlab-token">[^]*?<\/div>/.exec(box().innerHTML)?.[0] ?? "";
const sessionLine = (box) => /<div class="remote-session">[^]*?<\/div>/.exec(box().innerHTML)?.[0] ?? "";
// A control of the page found as the view finds it: by the selector the view asks for, or among those of one attribute by value.
const inBox = (box, sel) => box().querySelector(sel);
const among = (box, attr, value) => box().querySelectorAll(`[${attr}]`).find((c) => attrOf(c.tag, attr) === value) ?? null;
const publicControls = (root, name, out = []) => { for (const child of root?.children ?? []) { if (typeof child !== "object") continue; if (child.className?.split(" ").includes(name)) out.push(child); publicControls(child, name, out); } return out; };
const githubRow = (box) => publicControls(box(), "settings-repository").find((row) => /GitHub token/.test(row.textContent));
const repositoryControl = (box, name) => publicControls(githubRow(box), `settings-repository-${name}`)[0];
const canonicalToken = () => ({ ["agent-m:akmaier/agent-m:github-token"]: JSON.stringify({ value: TOKEN, name: "GitHub token", expires: day(90), stored: TODAY }) });
const gitlabName = "gitlab-token:gitlab.example.org/grp/sub/proj";
const canonicalGitlab = () => ({ [canonicalKey(gitlabName)]: JSON.stringify({ value: GL_TOKEN, name: "GitLab token: gitlab.example.org/grp/sub/proj", expires: day(60), stored: TODAY }) });
const gitlabRow = (box) => publicControls(box(), "settings-repository").find((row) => /GitLab token: gitlab\.example\.org\/grp\/sub\/proj/.test(row.textContent));
const gitlabControl = (box, name) => publicControls(gitlabRow(box), `settings-repository-${name}`)[0];

// ---------------------------------------------------------------- the GitHub token

const RESET_SECONDS = "1792022400";
const RESET_AT = new Date(Number(RESET_SECONDS) * 1000).toISOString();
const rateLimitResponse = (limit) => new Response(JSON.stringify({ message: "API rate limit exceeded" }), {
  status: 403,
  headers: { "Content-Type": "application/json", "X-RateLimit-Remaining": "0", "X-RateLimit-Limit": String(limit), "X-RateLimit-Reset": RESET_SECONDS },
});

// The real row sends its ordinary repositoryInfo request. Only that endpoint changes after the controlled 200 Test;
// navigation and reload use the same browser storage, with the server answering normally again.
async function inconclusiveRepositoryTest(answer, expected, { untested = false } = {}) {
  let failing = false, failures = 0;
  const world = await instanceWorld([(url, init) => {
    if (!failing || url.origin !== API || url.pathname !== "/repos/akmaier/agent-m" || init.method !== "GET") return undefined;
    failures += 1;
    return answer();
  }]);
  const { page, box } = await settingsPage(world, canonicalToken());
  const tokenKey = canonicalKey("github-token"), lastTestKey = canonicalKey("last-test:github-token");
  const secretBefore = globalThis.localStorage.getItem(tokenKey);
  if (!untested) {
    await repositoryControl(box, "test").fire("click");
    assert.match(repositoryControl(box, "result").textContent, /repository token is working/, "known positive: the actual Test succeeds on the controlled 200 endpoint");
    assert.equal(JSON.parse(globalThis.localStorage.getItem(lastTestKey)).outcome, "working");
  }
  const previous = globalThis.localStorage.getItem(lastTestKey);
  if (untested) assert.equal(previous, null, "known precondition: no prior test record exists");
  const statusBefore = repositoryControl(box, "status").textContent;
  const from = world.srv.requests.length;
  failing = true;
  await repositoryControl(box, "test").fire("click");
  assert.equal(failures, 1, "the actual Test reaches the controlled failure endpoint exactly once");
  // ITM-1170: beside the record, repositoryInfo sends the GraphQL request of greenToMerge, which the harness logs as a batch of no file.
  assert.deepEqual(world.srv.requests.slice(from).map((request) => request.replace(/^(handler|other) /, "")).sort(), ["GET https://api.github.com/repos/akmaier/agent-m", "batch 0"], "Test adds no other API call, including when fetch throws before the harness labels a response");
  const result = repositoryControl(box, "result").textContent;
  assert.match(result, expected, "the current error is shown separately at the public Test result");
  assert.doesNotMatch(result, /expired|regenerated|deleted|refused your/i, "this response does not diagnose a refused credential");
  assert.equal(globalThis.localStorage.getItem(tokenKey), secretBefore, "Test leaves the stored secret unchanged");
  assert.equal(globalThis.localStorage.getItem(lastTestKey), previous, "failure node: a noncredential failure preserves the exact prior record, or its absence");
  assert.equal(repositoryControl(box, "status").textContent, statusBefore, "the last conclusive status and successful timestamp are unchanged");
  failing = false;
  await page.go("#uc");
  assert.equal(page.el("token-banner"), "", "the actual next use-cases page shows no false token-expiry banner");
  const again = await reload(world);
  assert.equal(again.page.el("token-banner"), "", "a fresh app load on the same storage shows no false token-expiry banner");
  assert.equal(repositoryControl(again.box, "status").textContent, statusBefore, "the exact prior status survives reload");
  assert.equal(globalThis.localStorage.getItem(lastTestKey), previous, "reload does not rewrite prior evidence or create a pending/reason record");
  assert.equal(globalThis.localStorage.getItem(tokenKey), secretBefore, "reload leaves the stored secret unchanged");
  await again.page.go("#uc");
  assert.equal(again.page.el("token-banner"), "", "the reloaded app's use-cases page also shows no false expiry");
}

// TST-475201 · level: component · module: MOD-settings-pages
// guards: A USED-UP RATE LIMIT IS NAMED, NOT BLAMED ON THE TOKEN; UC-042
// given: the actual Test has succeeded with 200 and persisted its successful timestamp.
// input: the same GET /repos endpoint answers 403 with remaining 0, limit 5000 and a reset time.
// expect: the account limit and reset appear in the current result, prior evidence and secret stay verbatim, and #uc/reload show no refusal banner.
test("TST-475201: an account limit preserves the last successful token test and never creates an expiry banner", async () => {
  await inconclusiveRepositoryTest(() => rateLimitResponse(5000), new RegExp(`account.*resets at ${RESET_AT.replaceAll(".", "\\.")}`));
});

// TST-475202 · level: component · module: MOD-settings-pages
// guards: A USED-UP RATE LIMIT IS NAMED, NOT BLAMED ON THE TOKEN; UC-042
// given: a controlled 200 Test established working evidence; the server identifies its exhausted network limit by limit 60.
// input: Test receives the 403, remaining 0 and reset headers through the real repository host adapter.
// expect: the network limit and reset are named, with no credential diagnosis, changed timestamp, changed secret or false banner after #uc/reload.
test("TST-475202: a server-reported network limit preserves token evidence and names its reset", async () => {
  await inconclusiveRepositoryTest(() => rateLimitResponse(60), new RegExp(`this network.*resets at ${RESET_AT.replaceAll(".", "\\.")}`));
});

// TST-475203 · level: component · module: MOD-settings-pages
// guards: A BROWSER SETTING IS TESTED AND CLEARED WHERE IT IS SHOWN; AN EXPIRED TOKEN IS NAMED AND ITS RENEWAL LINKED; UC-042
// given: the token's controlled 200 Test has persisted a working result.
// input: GET /repos answers 403 without exhausted-limit headers.
// expect: PermissionMissing names Metadata, but does not replace working evidence or its timestamp, alter the secret or create a refusal banner after #uc/reload.
test("TST-475203: a nonlimit 403 reports missing permission without marking the token expired", async () => {
  await inconclusiveRepositoryTest(() => json({ message: "Resource not accessible by personal access token" }, 403), /lacks Metadata/);
});

// TST-475204 · level: component · module: MOD-settings-pages
// guards: A BROWSER SETTING IS TESTED AND CLEARED WHERE IT IS SHOWN; AN EXPIRED TOKEN IS NAMED AND ITS RENEWAL LINKED; UC-042
// given: a successful controlled Test has persisted working evidence.
// input: GET /repos answers 503.
// expect: the current result names 503, while prior evidence, timestamp and secret survive unchanged and #uc/reload have no false expiry banner.
test("TST-475204: a 503 is shown separately without overwriting the last good token test", async () => {
  await inconclusiveRepositoryTest(() => json({ message: "Service unavailable" }, 503), /answered 503/);
});

// TST-475205 · level: component · module: MOD-settings-pages
// guards: A BROWSER SETTING IS TESTED AND CLEARED WHERE IT IS SHOWN; AN EXPIRED TOKEN IS NAMED AND ITS RENEWAL LINKED; UC-042
// given: the real Test has succeeded and stored its working timestamp.
// input: fetch of GET /repos throws a controlled network error.
// expect: Unreachable is shown as the current result, not persisted refusal; prior timestamp and secret survive, with no banner after #uc/reload.
test("TST-475205: a network failure preserves the prior successful test and secret", async () => {
  await inconclusiveRepositoryTest(() => { throw new TypeError("Controlled repository network failure"); }, /could not be reached: Controlled repository network failure/);
});

// TST-475206 · level: component · module: MOD-settings-pages
// guards: A USED-UP RATE LIMIT IS NAMED, NOT BLAMED ON THE TOKEN; UC-042
// given: a stored token has no prior last-test record.
// input: its first Test receives an account-limit 403 and reset headers.
// expect: the current limit is shown, no last-test record is created, the secret stays unchanged and #uc/reload show no false expiry banner.
test("TST-475206: an inconclusive first Test leaves absent token evidence absent", async () => {
  await inconclusiveRepositoryTest(() => rateLimitResponse(5000), /account.*resets at/, { untested: true });
});

test("UC-042 step 1: a successful Test of the GitHub token is shown after a reload — ✓ works with the date of that test", async () => {
  const world = await instanceWorld();
  const { box } = await settingsPage(world, canonicalToken());
  assert.match(repositoryControl(box, "status").textContent, /Expires on/);
  await repositoryControl(box, "test").fire("click");
  const stored = JSON.parse(globalThis.localStorage.getItem("agent-m:akmaier/agent-m:last-test:github-token"));
  assert.equal(stored.outcome, "working");
  assert.match(repositoryControl(box, "status").textContent, new RegExp(`Expires on ${day(90)}\\. Works\\. Last successful test: ${stored.at}\\.$`), "the public row preserves both expiry and the exact persisted successful-test date");
  assert.match(repositoryControl(box, "status").textContent, /Last successful test:/);
  const again = await settingsPage(world, agentEntries());
  assert.match(repositoryControl(again.box, "status").textContent, /Last successful test:/, "after the reload");
});

// A token GitHub refuses stays refused: the reload's own requests with it are refused again. Expected: its line and the line at
// the top name it refused after the reload as before it.
test("UC-042 step 1 · 1b: a token GitHub refused at its last use is shown refused after a reload — on its line and at the top", async () => {
  const world = await instanceWorld();
  const { box } = await settingsPage(world, canonicalToken());
  world.refuseGitHub = true;
  await repositoryControl(box, "test").fire("click");
  assert.equal(JSON.parse(globalThis.localStorage.getItem("agent-m:akmaier/agent-m:last-test:github-token")).outcome, "refused");
  const again = await settingsPage(world, agentEntries());
  assert.match(repositoryControl(again.box, "status").textContent, /Refused/, "after the reload");
  const banner = again.page.el("token-banner");
  assert.ok(banner.includes("The server refused your token GitHub token."), "the refused token is named");
  assert.ok(banner.includes('href="https://github.com/settings/personal-access-tokens">Renew</a>'), "with Renew");
  await again.page.go("#uc");
  assert.ok(again.page.el("token-banner").includes("The server refused your token GitHub token."), "on every page");
});

// TST-475209 · level: component · module: MOD-settings-pages
// guards: AN EXPIRED TOKEN IS NAMED AND ITS RENEWAL LINKED; UC-042
// given: the public Settings Test succeeds on 200, then encounters a genuine GitHub 401.
// input: navigate to #uc and reload the actual dashboard on the same browser storage.
// expect: refused evidence, token identity and renewal survive, but the banner reports only rejected authentication, never an inferred expiry/regeneration/deletion cause.
test("TST-475209: a genuine 401 keeps named recovery without an invented cause on navigation and reload", async () => {
  const world = await instanceWorld();
  const { page, box } = await settingsPage(world, canonicalToken());
  await repositoryControl(box, "test").fire("click");
  assert.equal(JSON.parse(globalThis.localStorage.getItem(canonicalKey("last-test:github-token"))).outcome, "working", "known positive: actual Test succeeds on 200");
  world.refuseGitHub = true;
  await repositoryControl(box, "test").fire("click");
  assert.equal(JSON.parse(globalThis.localStorage.getItem(canonicalKey("last-test:github-token"))).outcome, "refused", "a genuine 401 still records refused evidence");
  await page.go("#uc");
  const assertBanner = (banner) => {
    assert.ok(banner.includes('href="https://github.com/settings/personal-access-tokens"'), "the existing renewal URL stays reachable");
    assert.ok(banner.includes("GitHub token"), "the rejected token stays identified");
    assert.ok(banner.includes("The server refused your token GitHub token."), "failure node: the actual banner reports rejection without asserting its cause");
    assert.doesNotMatch(/<p class="notice token-refused">([^<]*)/.exec(banner)?.[1] ?? "", /expired|expiry|regenerat|delet|rotat|revok/i);
  };
  assertBanner(page.el("token-banner"));
  const again = await reload(world);
  assertBanner(again.page.el("token-banner"));
  await again.page.go("#uc");
  assertBanner(again.page.el("token-banner"));
});

test("UC-042 step 1: a successful Test after a refusal replaces it — the line works again, and so does the next page load", async () => {
  const world = await instanceWorld();
  const { box } = await settingsPage(world, canonicalToken());
  world.refuseGitHub = true;
  await repositoryControl(box, "test").fire("click");
  world.refuseGitHub = false;
  await repositoryControl(box, "test").fire("click");
  const again = await settingsPage(world, agentEntries());
  assert.match(repositoryControl(again.box, "status").textContent, /Last successful test:/);
  assert.equal(again.page.el("token-banner"), "", "no refusal at the top");
});

test("UC-042 step 2: a new token stored with Change starts untested — the last test of the old token does not stick to it", async () => {
  const world = await instanceWorld();
  const { box } = await settingsPage(world, canonicalToken());
  await repositoryControl(box, "test").fire("click");
  await repositoryControl(box, "change").fire("click");
  const acknowledgement = repositoryControl(box, "ack"), secret = repositoryControl(box, "secret"), expiry = repositoryControl(box, "expiry");
  acknowledgement.checked = true; await acknowledgement.fire("change");
  secret.value = "github_pat_RENEWED0123456789abcdefghij"; expiry.value = day(90);
  await repositoryControl(box, "save").fire("click");
  assert.equal(globalThis.localStorage.getItem("agent-m:akmaier/agent-m:last-test:github-token"), null, "Change removes the old canonical outcome");
  const again = await settingsPage(world, agentEntries());
  assert.doesNotMatch(repositoryControl(again.box, "status").textContent, /Last successful test|Refused/, "after the reload too");
});

// ---------------------------------------------------------------- A CLEAR IS A REAL CLEAR · EVERY SETTING IS REACHED FROM ONE PAGE

test("UC-042 step 2 · A CLEAR IS A REAL CLEAR: Clear removes the kept date and outcome with the token from localStorage", async () => {
  const world = await instanceWorld();
  const prior = globalThis.confirm; globalThis.confirm = () => true;
  try {
    const { box } = await settingsPage(world, canonicalToken());
    await repositoryControl(box, "test").fire("click");
    assert.ok(globalThis.localStorage.getItem("agent-m:akmaier/agent-m:last-test:github-token"));
    await repositoryControl(box, "clear").fire("click");
    assert.equal(globalThis.localStorage.getItem("agent-m:akmaier/agent-m:github-token"), null);
    assert.equal(globalThis.localStorage.getItem("agent-m:akmaier/agent-m:last-test:github-token"), null, "token Clear removes its outcome");
    const again = await settingsPage(world, canonicalToken());
    assert.doesNotMatch(repositoryControl(again.box, "status").textContent, /Last successful test|Refused/, "the same token added again starts untested");
  } finally { globalThis.confirm = prior; }
});

test("UC-042 step 6 · A CLEAR IS A REAL CLEAR: Clear everything removes every kept test result", async () => {
  const world = await instanceWorld();
  const { general } = await settingsPage(world, { ...canonicalToken(), ["agent-m:akmaier/agent-m:last-test:github-token"]: JSON.stringify({ at: new Date().toISOString(), outcome: "working" }), ["agent-m:akmaier/agent-m:last-test:endpoint:campus"]: JSON.stringify({ at: new Date().toISOString(), outcome: "refused" }) });
  const clear = publicControls(general(), "settings-clear-everything")[0], acknowledgement = publicControls(general(), "settings-clear-ack")[0];
  acknowledgement.checked = true; await acknowledgement.fire("change"); await clear.fire("click");
  assert.equal(globalThis.localStorage.getItem("agent-m:akmaier/agent-m:last-test:github-token"), null);
  assert.equal(globalThis.localStorage.getItem("agent-m:akmaier/agent-m:last-test:endpoint:campus"), null, "Clear everything removes every outcome");
});

test("EVERY SETTING IS REACHED FROM ONE PAGE: after the tests, every entry Agent M keeps in localStorage has its place on the settings page", async () => {
  const world = await instanceWorld();
  const entries = { ...canonicalToken(), ...canonicalGitlab(),
    [canonicalKey("products")]: JSON.stringify([GL_ADDR]),
    [canonicalKey("jump-host")]: JSON.stringify({ hostname: "jump.example.org", user: "agentm", sshPort: 22, portRange: [20001, 20003] }),
    [canonicalKey("remote-session:lab-pc")]: JSON.stringify({ port: 20001, token: "bridgeTOKEN-0123456789abcdef" }) };
  const { box, endpointBox } = await settingsPage(world, entries);
  await repositoryControl(box, "test").fire("click");
  await gitlabControl(box, "test").fire("click");
  const remote = publicControls(endpointBox(), "settings-remote-session")[0];
  assert.ok(remote, "remote session has its public Endpoints & Agents line");
  const remoteTest = publicControls(remote, "settings-remote-session-test")[0];
  await remoteTest.fire("click");
  const again = await settingsPage(world, agentEntries());
  assert.ok(repositoryControl(again.box, "status"), "GitHub token and its outcome remain reachable in Repositories");
  assert.ok(gitlabControl(again.box, "status"), "GitLab token and its outcome remain reachable in Repositories");
  assert.match(again.box().textContent, /Managed products/, "Managed products is reached from its public Repositories pane");
  const endpoints = again.endpointBox().textContent;
  for (const visible of ["Jump host", "lab-pc"]) assert.match(endpoints, new RegExp(visible), `${visible} is not stranded from its public Endpoints & Agents pane`);
});

// ---------------------------------------------------------------- a GitLab project token

test("UC-042 step 1: a GitLab project token's last test — works, then refused — is shown after a reload", async () => {
  const world = await instanceWorld();
  const { box } = await settingsPage(world, canonicalGitlab());
  await gitlabControl(box, "test").fire("click");
  assert.equal(JSON.parse(globalThis.localStorage.getItem(canonicalKey(`last-test:${gitlabName}`))).outcome, "working");
  let again = await settingsPage(world, agentEntries());
  assert.match(gitlabControl(again.box, "status").textContent, /Last successful test:/, "works, after the reload");
  world.refuseGitLab = true;
  await gitlabControl(again.box, "test").fire("click");
  assert.equal(gitlabControl(again.box, "result").textContent, "✗ gitlab.example.org rejected authentication with your GitLab token: gitlab.example.org/grp/sub/proj. Renew it on https://gitlab.example.org/grp/sub/proj/-/settings/access_tokens.");
  again = await settingsPage(world, agentEntries());
  assert.match(gitlabControl(again.box, "status").textContent, /Refused/, "refused, after the reload");
});

test("UC-042 step 2: a GitLab project token changed or cleared takes its last test with it", async () => {
  const world = await instanceWorld();
  const prior = globalThis.confirm; globalThis.confirm = () => true;
  try {
    const { box } = await settingsPage(world, canonicalGitlab());
    await gitlabControl(box, "test").fire("click");
    await gitlabControl(box, "change").fire("click");
    const ack = gitlabControl(box, "ack"), secret = gitlabControl(box, "secret"), expiry = gitlabControl(box, "expiry");
    ack.checked = true; await ack.fire("change"); secret.value = "glpat-renewedTOKENvalue0123456789"; expiry.value = day(80);
    await gitlabControl(box, "save").fire("click");
    assert.equal(globalThis.localStorage.getItem(canonicalKey(`last-test:${gitlabName}`)), null, "Change removes the prior GitLab outcome");
    let again = await settingsPage(world, agentEntries());
    assert.doesNotMatch(gitlabControl(again.box, "status").textContent, /Last successful test|Refused/, "the replacement starts untested after reload");
    await gitlabControl(again.box, "test").fire("click");
    const replacementTest = JSON.parse(globalThis.localStorage.getItem(canonicalKey(`last-test:${gitlabName}`)));
    assert.equal(replacementTest.outcome, "working", "the replacement is tested through the public control before Clear");
    again = await settingsPage(world, agentEntries());
    assert.match(gitlabControl(again.box, "status").textContent, new RegExp(`Expires on ${day(80)}\\. Works\\. Last successful test: ${replacementTest.at}\\.$`), "the replacement's expiry and own test persist after reload");
    await gitlabControl(again.box, "clear").fire("click");
    assert.equal(globalThis.localStorage.getItem(canonicalKey(gitlabName)), null);
    assert.equal(globalThis.localStorage.getItem(canonicalKey(`last-test:${gitlabName}`)), null, "Clear removes its outcome");
    again = await settingsPage(world, agentEntries());
    assert.equal(gitlabRow(again.box), undefined, "no row for a cleared token");
  } finally { globalThis.confirm = prior; }
});

// ---------------------------------------------------------------- a remote session

test("UC-042 step 1: a remote session's last test — something answered, or nothing — is shown after a reload", async () => {
  const world = await instanceWorld();
  const entries = { [canonicalKey("jump-host")]: JSON.stringify({ hostname: "jump.example.org", user: "agentm", sshPort: 22, portRange: [20001, 20003] }),
    [canonicalKey("remote-session:lab-pc")]: JSON.stringify({ port: 20001, token: "bridgeTOKEN-0123456789abcdef" }) };
  const { endpointBox } = await settingsPage(world, entries);
  const session = publicControls(endpointBox(), "settings-remote-session")[0];
  const test = publicControls(session, "settings-remote-session-test")[0];
  const result = publicControls(session, "settings-remote-session-result")[0];
  world.up.add(20001);
  await test.fire("click");
  assert.match(result.textContent, /answers at localhost:20001|something answered/, "the public Test establishes the controlled working result");
  assert.ok(globalThis.localStorage.getItem(canonicalKey("last-test:remote-session:lab-pc")), "required working outcome persists for reload");
  let again = await settingsPage(world, agentEntries());
  assert.match(again.endpointBox().textContent, /Works\. Last successful test: .*\./,
    "the public setting line shows the persisted working outcome and its recorded date after reload");
  world.up.clear();
  const retry = publicControls(publicControls(again.endpointBox(), "settings-remote-session")[0], "settings-remote-session-test")[0];
  await retry.fire("click");
  assert.match(publicControls(again.endpointBox(), "settings-remote-session-result")[0].textContent, /nothing|gave no answer|Failed/, "refusal is visible at the public Test control");
  assert.ok(globalThis.localStorage.getItem(canonicalKey("last-test:remote-session:lab-pc")), "required refused outcome persists for reload");
  const clear = publicControls(publicControls(again.endpointBox(), "settings-remote-session")[0], "settings-remote-session-clear")[0];
  await clear.fire("click");
  assert.equal(globalThis.localStorage.getItem(canonicalKey("remote-session:lab-pc")), null, "cleared with its session");
  assert.equal(globalThis.localStorage.getItem(canonicalKey("last-test:remote-session:lab-pc")), null, "Clear removes the persisted outcome");
});
