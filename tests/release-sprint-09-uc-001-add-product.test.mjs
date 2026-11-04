// Release coverage of UC-001 through the dashboard's real #add route.
// Module: MOD-settings-pages
// Guards: UC-001; EVERY STEP EXPLAINS ITSELF; A MANAGED PRODUCT NEEDS NO PAGES SITE; ONE REVIEW LAYOUT FOR EVERY PRODUCT; THE PRODUCT REPOSITORY IS SELF-SUFFICIENT; EVERY PRODUCT HAS ITS OWN VERSION LINE; CONFIGURATION LIVES IN THE BROWSER; THE GITHUB TOKEN IS PASTED, NOT OBTAINED BY LOGIN; THE TOKEN LINK IS PREFILLED; THE REPOSITORY CHOICE IS SPELLED OUT; ONE GITHUB TOKEN SERVES EVERY FEATURE; A PRODUCT'S TOKEN IS NAMED AFTER THE PRODUCT; A TOKEN IS SCOPED TO WHAT IT WRITES; THE SHARED PAGES ORIGIN IS DISCLOSED; THE PAGE NAMES WHERE IT SENDS; A PRODUCT IS NAMED BY ITS ADDRESS; GITLAB PRODUCTS ARE SUPPORTED; A GITLAB PRODUCT USES A PROJECT ACCESS TOKEN
// Level: release

import test from "node:test";
import assert from "node:assert/strict";
import { repoServer, openDashboard, richDocument, press, settle, REPO, TOKEN } from "./app-harness.mjs";

const PRODUCT = "alice/thesis-tool";
const GH = `https://github.com/${PRODUCT}`;
const GL = "https://gitlab.rrze.fau.de/fau-ai-taskforce/tools/thesis-tool";
const API = "https://api.github.com";
const PREFIX = `agent-m:${REPO}:`;
const PRODUCT_TOKEN = "github_pat_RELEASE0010123456789";
const GL_TOKEN = "glpat-RELEASE001";
const textOf = (html) => String(html).replace(/<[^>]*>/g, " ").replace(/&quot;/g, '"').replace(/\s+/g, " ").trim();
const sectionBefore = (html, heading, nextHeading) => {
  const start = html.indexOf(heading);
  const end = nextHeading ? html.indexOf(nextHeading, start + heading.length) : -1;
  return html.slice(start, end < 0 ? html.length : end);
};

async function page(address) {
  const server = await repoServer({ files: {} });
  await openDashboard({ server, hash: "#add" });
  const main = richDocument().byId("main");
  const input = main.querySelector("input.address");
  input.value = address;
  input.fire("input", { isTrusted: true });
  return main;
}

async function releaseWorld(files = { "README.md": "# Product\n" }) {
  const requests = [];
  const product = await repoServer({ repo: PRODUCT, files, handlers: [
    (url) => url.pathname === `/repos/${PRODUCT}`
      ? new Response(JSON.stringify({ visibility: "public", private: false, default_branch: "main", permissions: { push: true } }), { headers: { "Content-Type": "application/json" } })
      : undefined,
  ] });
  const instance = await repoServer({ files: {}, handlers: [
    (url, init) => {
      requests.push({ url: url.href, method: init.method ?? "GET", body: String(init.body ?? ""), authorization: new Headers(init.headers ?? {}).get("Authorization") });
      return url.origin === API && url.pathname.startsWith(`/repos/${PRODUCT}`) ? product.fetch(url.href, init) : undefined;
    },
  ] });
  return { instance, product, requests };
}

async function addProduct(world) {
  await openDashboard({ server: world.instance, hash: "#add" });
  const main = richDocument().byId("main"), address = main.querySelector("input.address");
  address.value = GH; address.fire("input", { isTrusted: true });
  const ack = main.querySelector("input.ack"), token = main.querySelector("input.token");
  ack.checked = true; ack.fire("change", { isTrusted: true }); token.value = PRODUCT_TOKEN;
  await press(world.instance, main.querySelector("button.store"));
  return main;
}

async function gitlabReleaseWorld() {
  const base = `/api/v4/projects/${encodeURIComponent("fau-ai-taskforce/tools/thesis-tool")}`;
  const files = { "README.md": "# Product\n" }, requests = [], writes = [];
  const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
  const instance = await repoServer({ files: {}, handlers: [(url, init = {}) => {
    const token = new Headers(init.headers ?? {}).get("private-token");
    requests.push({ url: url.href, token, authorization: new Headers(init.headers ?? {}).get("Authorization") });
    if (url.origin !== "https://gitlab.rrze.fau.de" || !url.pathname.startsWith(base)) return undefined;
    const rest = url.pathname.slice(base.length), method = (init.method ?? "GET").toUpperCase();
    if (method === "GET" && !rest) return json({ id: 7, path_with_namespace: "fau-ai-taskforce/tools/thesis-tool", default_branch: "main", visibility: "private", permissions: { project_access: { access_level: 40 }, group_access: null } });
    if (method === "GET" && rest === "/repository/branches/main") return json({ name: "main", commit: { id: "a".repeat(40) } });
    if (method === "GET" && rest.startsWith("/repository/commits/")) return json({ id: "a".repeat(40) });
    if (method === "GET" && rest === "/repository/tree") return json(Object.keys(files).map((path) => ({ type: "blob", path, id: "b".repeat(40) })));
    if (method === "POST" && rest === "/repository/commits") { const body = JSON.parse(init.body); for (const action of body.actions) files[action.file_path] = action.content; writes.push(body); return json({ id: "c".repeat(40), web_url: `${GL}/-/commit/${"c".repeat(40)}` }); }
    return json({ message: "not found" }, 404);
  }] });
  return { instance, files, requests, writes };
}

// TST-283 · level: release · module: MOD-settings-pages
// guards: UC-001; EVERY STEP EXPLAINS ITSELF; A MANAGED PRODUCT NEEDS NO PAGES SITE; ONE REVIEW LAYOUT FOR EVERY PRODUCT; THE PRODUCT REPOSITORY IS SELF-SUFFICIENT; EVERY PRODUCT HAS ITS OWN VERSION LINE; CONFIGURATION LIVES IN THE BROWSER; THE GITHUB TOKEN IS PASTED, NOT OBTAINED BY LOGIN; THE TOKEN LINK IS PREFILLED; THE REPOSITORY CHOICE IS SPELLED OUT; ONE GITHUB TOKEN SERVES EVERY FEATURE; A GITHUB PRODUCT USES A TOKEN OF ITS OWN; A PRODUCT'S TOKEN IS NAMED AFTER THE PRODUCT; A TOKEN IS SCOPED TO WHAT IT WRITES; THE SHARED PAGES ORIGIN IS DISCLOSED; THE PAGE NAMES WHERE IT SENDS; A PRODUCT IS NAMED BY ITS ADDRESS; GITLAB PRODUCTS ARE SUPPORTED; A GITLAB PRODUCT USES A PROJECT ACCESS TOKEN; A TOKEN GOES ONLY TO THE SERVER THAT ISSUED IT
// given: an instance dashboard, a GitHub product address and a GitLab product address
// input: type each address in the actual Add product route
// expect: server-specific key steps disclose the required scope, storage, destinations, layout and GitLab project-token route before any credential can be stored
test("TST-283 UC-001 release disclosure covers GitHub and GitLab product routes", async () => {
  const gh = await page(GH);
  const ghText = textOf(gh.innerHTML);
  const stepA = gh.innerHTML.slice(gh.innerHTML.indexOf("Step A · A key for the product"), gh.innerHTML.indexOf("Step B · Check"));
  const repository = gh.innerHTML.slice(0, gh.innerHTML.indexOf('<div class="steps">'));
  assert.match(stepA, /<details class="explain">/, "Step A itself has the folded product-key explanation");
  assert.match(repository, /<details class="explain">[\s\S]*A \*repository\* is the folder on GitHub/, "the address field itself has the folded repository explanation");
  assert.match(ghText, /Open GitHub's token page \(prefilled\)/);
  assert.match(ghText, /Only select repositories/);
  assert.match(ghText, /alice\/thesis-tool.*nothing else/);
  const tokenLink = gh.querySelector("a");
  const prefilled = new URL(tokenLink.href).searchParams;
  assert.equal(prefilled.get("name"), "Agent M · alice/thesis-tool");
  assert.equal(prefilled.get("description"), "Agent M for the product alice/thesis-tool: reviews, commits, issues, pull requests and runs of the work you start in it.");
  assert.equal(prefilled.get("target_name"), "alice", "the product owner scopes the token page");
  assert.equal(prefilled.get("expires_in"), "90");
  assert.deepEqual(Object.fromEntries([...prefilled].filter(([key]) => !["name", "description", "target_name", "expires_in"].includes(key))), {
    contents: "write", issues: "write", pull_requests: "write", actions: "write", workflows: "write", secrets: "write", metadata: "read",
  }, "the prefilled product token grants every and only UC-014 feature permission");
  const long = await page("https://github.com/owner-with-a-long-name/repository-name-that-is-longer-than-github-allows");
  const longParams = new URL(long.querySelector("a").href).searchParams;
  assert.equal(longParams.get("name"), "Agent M · repository-name-that-is-longer-than-github-allows".slice(0, 40), "a long token name drops the owner then truncates only the repository end");
  assert.equal(longParams.get("description"), "Agent M for the product owner-with-a-long-name/repository-name-that-is-longer-than-github-allows: reviews, commits, issues, pull requests and runs of the work you start in it.");
  assert.match(gh.querySelector("input.expires").value, /^\d{4}-\d\d-\d\d$/, "the pasted token has an expiry date to confirm");
  assert.match(ghText, /kept in this browser for this product only/i);
  assert.match(ghText, /sent only to GitHub's API/i);
  assert.match(ghText, /Everything Agent M stores in this browser is stored for the address https:\/\/akmaier\.github\.io — every GitHub Pages site under that same akmaier\.github\.io domain can read it\./);
  assert.match(ghText, /missing review layout.*default branch/i);
  assert.match(ghText, /nothing is written to the instance repository/i);
  const ghStepB = sectionBefore(gh.innerHTML, "Step B · Check", "Step C · Add the product");
  const ghStepC = sectionBefore(gh.innerHTML, "Step C · Add the product");
  assert.match(ghStepB, /<details class="explain">[\s\S]*The product gets a key of its own/, "GitHub Step B itself explains why this product needs its own key");
  assert.match(ghStepC, /<details class="explain">[\s\S]*Pressing \*Add product\* writes one commit/, "Step C explains the contents of its review-layout commit");
  assert.match(ghStepC, /<details class="explain">[\s\S]*ordinary commit[\s\S]*revert it/, "Step C explains how its layout commit can be reverted");
  assert.match(ghStepC, /<details class="explain">[\s\S]*kept only in this browser&#39;s own storage[\s\S]*instance repository/, "Step C explains why its product list stays in this browser");

  const gl = await page(GL);
  const glText = textOf(gl.innerHTML);
  const glStepA = sectionBefore(gl.innerHTML, "Step A · Create a key for this project", "Step B · Give the key to Agent M");
  const glStepB = sectionBefore(gl.innerHTML, "Step B · Give the key to Agent M", "Step C · Add the product");
  assert.match(glStepA, /<details class="explain">[\s\S]*The product gets a key of its own/, "GitLab Step A itself explains why this project needs its own key");
  assert.match(glStepB, /<details class="explain">[\s\S]*The product gets a key of its own/, "GitLab Step B itself explains why this project needs its own key");
  assert.match(glText, /Create a key for this project/);
  assert.match(glText, /Settings → Access tokens/);
  assert.match(glText, /Maintainer/);
  assert.match(glText, /scope: api/);
  assert.match(glText, /personal access token with api scope reaches every project you can reach/i);
  assert.match(glText, /only to this project's own API/i);
  assert.match(glText, /never to GitHub/i);
});

// TST-286 · level: release · module: MOD-settings-pages
// guards: UC-001; ONE CLICK PER DECISION; ADDING A PRODUCT CREATES ITS LAYOUT; THE DASHBOARD KEEPS ITS PRODUCTS IN THE BROWSER; NO PRODUCT IS NAMED IN THE INSTANCE REPOSITORY; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK
// given: a browser with its instance token and a public GitHub product containing no review layout
// input: store the product token, fire a synthetic Add product event, then make one trusted Add product click
// expect: only the trusted click writes the complete missing layout and canonical browser list; the instance repository remains untouched; the product token goes to the product's API only — its repository requests and the read-only POST /graphql for greenToMerge (ITM-1170), which names the product — and the instance token to none of them
test("TST-286 UC-001 release transaction guards product writes and browser state", async () => {
  const synthetic = await releaseWorld();
  let main = await addProduct(synthetic);
  main.querySelector("button.add").fire("click", { isTrusted: false });
  await settle(synthetic.instance);
  assert.equal(synthetic.product.writes.length, 0, "a synthetic event cannot write the product layout");
  assert.equal(globalThis.localStorage.getItem(`${PREFIX}products`), null, "a synthetic event cannot change the product list");

  const trusted = await releaseWorld({ "README.md": "# Product\n", "CHANGELOG.md": "# Changelog of alice/thesis-tool\n\n## 1.0\n" });
  main = await addProduct(trusted);
  await press(trusted.instance, main.querySelector("button.add"));
  assert.equal(trusted.product.writes.length, 1, "one trusted decision creates one layout commit");
  for (const path of ["docs/use-cases/README.md", "docs/architecture/README.md", "docs/approvals/README.md", "docs/spec-freigaben/README.md", "SPEC.md", "CHANGELOG.md"])
    assert.ok(trusted.product.files[path], `the product receives required review-layout part ${path}`);
  assert.match(trusted.product.files["docs/use-cases/README.md"], /status is derived from the approval records/i, "the layout is self-sufficient rather than a product-site placeholder");
  assert.equal(trusted.product.files["CHANGELOG.md"], "# Changelog of alice/thesis-tool\n\n## 1.0\n", "an existing product keeps its independent version line");
  assert.equal(trusted.product.files["README.md"], "# Product\n", "the existing product content is preserved");
  assert.ok(!Object.keys(trusted.product.files).some((path) => /CNAME|pages|\.github\/workflows/i.test(path)), "adding the review layout creates no product Pages-site setup");
  assert.deepEqual(JSON.parse(globalThis.localStorage.getItem(`${PREFIX}products`)), [GH], "the dashboard keeps only the product address in this browser");
  assert.equal(JSON.parse(globalThis.localStorage.getItem(`${PREFIX}github-token:${PRODUCT}`)).value, PRODUCT_TOKEN, "the canonical browser store keeps the product key with its product address");
  const greenRequests = trusted.requests.filter((request) => request.url === `${API}/graphql`);
  assert.ok(greenRequests.length > 0 && greenRequests.every((request) => request.method === "POST" && request.authorization === `Bearer ${PRODUCT_TOKEN}` && JSON.stringify(JSON.parse(request.body).variables) === JSON.stringify({ owner: PRODUCT.split("/")[0], name: PRODUCT.split("/")[1] })),
    "the read-only POST /graphql for greenToMerge (ITM-1170) names the product and carries its token");
  assert.ok(trusted.requests.filter((request) => request.url.includes(`/repos/${PRODUCT}`)).every((request) => request.authorization === `Bearer ${PRODUCT_TOKEN}`), "the product credential is sent only on product API requests");
  const tokenRequests = trusted.requests.filter((request) => request.authorization === `Bearer ${PRODUCT_TOKEN}`);
  assert.ok(tokenRequests.length > 0 && tokenRequests.every((request) => request.url.startsWith(`${API}/repos/${PRODUCT}`) || greenRequests.includes(request)), "every GitHub product-token request stays at its issuing product API, the read-only greenToMerge request included");
  assert.ok(!trusted.requests.some((request) => request.authorization === `Bearer ${TOKEN}` && request.url.includes(`/repos/${PRODUCT}`)), "the instance key is absent from product requests");
  assert.deepEqual(trusted.instance.writes, [], "the instance repository is never named or written during Add product");
  assert.equal(JSON.parse(globalThis.localStorage.getItem(`${PREFIX}github-token`)).value, TOKEN,
    "the canonical instance credential remains distinct from the product credential");
});

// TST-287 · level: release · module: MOD-settings-pages
// guards: UC-001; GITLAB PRODUCTS ARE SUPPORTED; A GITLAB PRODUCT USES A PROJECT ACCESS TOKEN; A TOKEN GOES ONLY TO THE SERVER THAT ISSUED IT
// given: a GitLab product and an instance whose GitHub token is present
// input: paste its project token and expiry, Store and check, then trusted Add product
// expect: the project token alone reads and writes GitLab, is kept under its canonical project key, and the instance token never reaches GitLab
test("TST-287 UC-001 release GitLab transaction keeps its project token at its issuer", async () => {
  const world = await gitlabReleaseWorld();
  await openDashboard({ server: world.instance, hash: "#add" });
  const main = richDocument().byId("main"), address = main.querySelector("input.address");
  address.value = GL; address.fire("input", { isTrusted: true });
  const ack = main.querySelector("input.ack"), token = main.querySelector("input.token");
  ack.checked = true; ack.fire("change", { isTrusted: true }); token.value = GL_TOKEN;
  await press(world.instance, main.querySelector("button.store"));
  await press(world.instance, main.querySelector("button.add"));
  assert.equal(world.writes.length, 1, "the actual GitLab product receives one layout commit");
  assert.ok(world.files["SPEC.md"] && world.files["docs/approvals/README.md"], "the GitLab product receives the review layout");
  assert.deepEqual(JSON.parse(globalThis.localStorage.getItem(`${PREFIX}products`)), [GL]);
  const storedRaw = globalThis.localStorage.getItem(`${PREFIX}gitlab-token:gitlab.rrze.fau.de/fau-ai-taskforce/tools/thesis-tool`);
  assert.ok(storedRaw, `canonical GitLab key exists: ${Array.from({ length: globalThis.localStorage.length }, (_, i) => globalThis.localStorage.key(i)).join(",")}`);
  const stored = JSON.parse(storedRaw);
  assert.equal(stored.value, GL_TOKEN); assert.match(stored.expires, /^\d{4}-\d\d-\d\d$/);
  const gitlabRequests = world.requests.filter((request) => request.url.startsWith("https://gitlab.rrze.fau.de/api/v4/"));
  assert.ok(gitlabRequests.length > 0 && gitlabRequests.every((request) => request.token === GL_TOKEN && request.authorization === null), "every token-bearing request stays at the issuing GitLab API");
  assert.ok(!gitlabRequests.some((request) => request.token === TOKEN || request.authorization === `Bearer ${TOKEN}`), "the instance GitHub token never leaks to GitLab");
});
