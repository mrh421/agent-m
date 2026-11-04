// The harness of the system and release tests of UC-046 (See what goes on in the instance): the instance's start page as index.html serves it. The script tag of index.html (its `src`, `data-page` and `data-views`) is put into a
// fixture page and src/site-frame/start.mjs is loaded as a browser loads it, so that MOD-site-frame's real frame starts MOD-main-page's real view (routes.mjs, which imports each route's file when the frame first shows it), over the
// real MOD-progress-measures, MOD-job-ledger, MOD-runtimes, MOD-repository-hosts and MOD-browser-store. Only the network is faked: the counting fake of GitHub and the Bridges of tests/main-page-home-harness.mjs, with the tags, the
// pull requests, the test results and a server that does not answer added here. A person's click is the page's own listener called; the address a click writes is read from the fixture location. Nothing reaches the network;
// nothing sleeps: the one timer the page sets for reading the jobs' states again is held and fired by a test at a clock it names.
// Imported by tests/system-uc-046-see-what-goes-on-in-the-instance.test.mjs and tests/release-uc-046-menu-build-and-documents.test.mjs. It holds no test and no expected result: what it builds are inputs, and every test states its own
// expected values.
//
// Module: MOD-main-page
// Module: MOD-progress-measures
// Level: system

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { changeFragment } from "./site-frame-start.d/dom.mjs";
import { blobSha } from "../src/text-tools/index.mjs";
import { approvalPath, recordText, reviewedRecord } from "./approval-records.mjs";
import { INSTANCE, INSTANCE_TOKEN, NOW, PRODUCT, PRODUCT_TOKEN, PRODUCT_URL, atNow, browser, find, headOf, instanceFiles, network, smallProduct, timers } from "./main-page-home-harness.mjs";

export { INSTANCE, INSTANCE_TOKEN, NOW, PRODUCT, PRODUCT_TOKEN, PRODUCT_URL, atNow, find, headOf, timers };
export { OTHER, OTHER_TOKEN, OTHER_URL, MISSING_URL, buildOf, byClass, cardsOf, click, currentOf, endedJob, instanceFiles, runningJob, smallProduct, stagesOf, waitsOf, withEnd } from "./main-page-home-harness.mjs";

const ROOT = new URL("../", import.meta.url);
const text = (path) => readFileSync(new URL(path, ROOT), "utf8");

/** The script tag of a page's HTML file that loads the frame: its `src` and its attributes, as the file writes them. */
export function scriptOf(path) {
  const tag = /<script type="module" src="([^"]+start\.mjs)"([^>]*)><\/script>/.exec(text(path));
  return { src: tag[1], attributes: Object.fromEntries([...tag[2].matchAll(/([\w-]+)="([^"]*)"/g)].map((m) => [m[1], m[2]])) };
}

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const blobOf = (body) => createHash("sha1").update(`blob ${Buffer.byteLength(body)}\0`).update(body).digest("hex");
const githubPull = (p) => ({ number: p.number, title: p.title, head: { ref: p.branch, sha: p.head }, base: { ref: "main" }, state: p.state === "open" ? "open" : "closed", merged_at: p.merged ?? null,
  merge_commit_sha: p.merged ? "f".repeat(40) : null, created_at: p.opened, updated_at: p.merged ?? p.opened, closed_at: p.merged ?? null, draft: false, html_url: `https://github.com/pull/${p.number}`, body: "" });

/** A pull request of the item `item` as GitHub lists it: open, or merged at `merged` (an ISO time). */
export const pullOf = (number, item, { merged = null } = {}) => ({ number, title: `${item}: the work`, branch: `work/${item}`, head: String(number).repeat(40).slice(0, 40), state: merged ? "closed" : "open",
  opened: "2026-10-16T09:30:00Z", merged });

/** The result record of one run of the test TST-001 on the commit `commit`, its outcome `outcome` ("passed" or "failed"), as MOD-result-records writes a record. */
export const resultRecord = (commit, outcome) => ["---", `commit: ${commit}`, "levels:", "  - unit", "occasion: commit", "participant: fixture", "date: 2026-10-16 10:30 UTC", "---", "## Outcomes", "",
  "| Test | Level | Outcome | Runs |", "|---|---|---|---|", `| TST-001 | unit | ${outcome} | |`, ""].join("\n");
const RESULTS_HEAD = "9".repeat(40);
const recordPath = (repository) => `runs/${headOf(repository)}/20261016-1000-commit-0001.md`;

// The answers added over the counting fake, each for the repositories it names:
//   tags     { "owner/name": ["v2026.1.0"] }       the repository's tags;
//   pulls    { "owner/name": [pullOf(…)] }         its pull requests;
//   results  { "owner/name": "passed" | "failed" } its branch test-results, holding one record of the test TST-001 on the head of its default branch, and the history of the default branch that lists that head;
//   down     { "owner/name": true }                a server that does not answer: every request to its repository fails as a network failure does.
function overlay(net, { tags, pulls, results, down }) {
  const below = globalThis.fetch;
  const noted = (url) => net.requests.push({ url: url.href, host: url.host, authorization: null });
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(typeof input === "object" && !(input instanceof URL) ? input.url : String(input));
    const repo = url.host === "api.github.com" ? /^\/repos\/([^/]+\/[^/]+)(\/.*)?$/.exec(url.pathname) : null;
    if (repo && down[repo[1]]) {
      noted(url);
      throw new TypeError("Failed to fetch");
    }
    if (repo) {
      const [, name, rest = ""] = repo;
      // The commit a repository's head is, asked for by its identifier (the instance at the commit a product's declaration names).
      const commit = /^\/commits\/([0-9a-f]{40})$/.exec(rest);
      if (commit && headOf(name) === commit[1]) { noted(url); return json({ sha: commit[1] }); }
      if (rest === "/tags" && tags[name]) { noted(url); return json(tags[name].map((tag) => ({ name: tag, commit: { sha: "e".repeat(40) } }))); }
      if (rest === "/pulls" && pulls[name]) { noted(url); return json(pulls[name].map(githubPull)); }
      if (results[name]) {
        const body = resultRecord(headOf(name), results[name]);
        if (rest === "/commits/test-results") { noted(url); return json({ sha: RESULTS_HEAD }); }
        if (rest === `/git/trees/${RESULTS_HEAD}`) { noted(url); return json({ sha: "t".repeat(40), truncated: false, tree: [{ path: recordPath(name), mode: "100644", type: "blob", sha: blobOf(body) }] }); }
        if (rest === "/commits" && !url.searchParams.has("path")) {
          noted(url);
          return json([{ sha: headOf(name), parents: [], author: { login: "alice" }, commit: { author: { name: "Alice" }, committer: { date: "2026-10-16T10:00:00Z" }, message: "the head" } }]);
        }
        if (rest === `/contents/${recordPath(name)}`) { noted(url); return new Response(body, { status: 200 }); }
      }
    }
    if (url.host === "api.github.com" && url.pathname === "/graphql" && init.method === "POST") {
      const asks = [...JSON.parse(init.body).query.matchAll(/(f\d+):object\(expression:("(?:[^"\\]|\\.)*")\)/g)].map((m) => [m[1], JSON.parse(m[2])]);
      const named = Object.keys(results).find((name) => asks.length > 0 && asks.every(([, expression]) => expression === `${RESULTS_HEAD}:${recordPath(name)}`));
      if (named) {
        noted(url);
        return json({ data: { repository: Object.fromEntries(asks.map(([alias]) => [alias, { text: resultRecord(headOf(named), results[named]), isTruncated: false }])) } });
      }
    }
    return below(input, init);
  };
}

// ---------------------------------------------------------------- the files of the products

const front = (fields) => ["---", ...Object.entries(fields).flatMap(([key, value]) => (Array.isArray(value) ? (value.length ? [`${key}:`, ...value.map((entry) => `  - ${entry}`)] : [`${key}: []`]) : [`${key}: ${value}`])), "---"].join("\n");
const useCaseText = (n) => `${front({ id: `UC-00${n}`, title: `Use case ${n}`, area: "shelf", actors: ["Reader"], realises: ["FIRST RULE"] })}\n# UC-00${n} Use case ${n}\n`;
const moduleText = (slug) => `${front({ id: `MOD-${slug}`, title: `The module ${slug}`, folder: `src/${slug}/`, realises: ["FIRST RULE"], follows: ["ARC-001"], uses: [], provides: ["read"] })}\n# MOD-${slug} The module ${slug}\n`;
const itemText = (id) => `${front({ id, title: "The work", level: "module", realises: ["UC-001"], modules: ["MOD-store"] })}\n# ${id} The work\n`;
const MODEL = readFileSync(new URL("tests/fixtures/flow/scrum-wip.md", ROOT), "utf8");
const DECLARATION = ["---", "model: fixture-scrum-wip", "model_file: docs/process-models/fixture.md", `model_version: ${headOf(INSTANCE)}`, "---", "# How the product is developed", "", "## Practices", "", "- none", "", "## Branches", "",
  "| Phase or time box | Branch |", "|---|---|", "| Sprint | `sprint/<team>/<nn>` |", "", "## Definition of Done", "", "The job rules hold.", ""].join("\n");

/** The instance alice/agent-m: its participant list, SPEC and the process model that the products of `shelf` declare. */
export const instanceWithModel = () => ({ ...instanceFiles(), "docs/process-models/fixture.md": MODEL });

/**
 * shelf({ useCases, modules, jobs, queue, declared }) -> the files of the product alice/product (tests/main-page-home-harness.mjs' smallProduct) with two requirements, FIRST RULE guarded by the test TST-001 of tests/unit.test.mjs; four use cases, the first
 * `useCases` of which are accepted by an approval record naming their text; two module files MOD-store and MOD-pages, the first `modules` of which are accepted; two backlog items ITM-0900 (the job records in `jobs` work on it) and ITM-0901; a
 * change queue with one open entry where `queue` is true; and, where `declared` is true, the declaration of the process model that instanceWithModel holds.
 */
export async function shelf({ useCases = 3, modules = 1, jobs = [], queue = false, declared = true } = {}) {
  const files = { ...smallProduct({ accepted: [], jobs, queue }), "docs/use-cases/UC-003-third.md": useCaseText(3), "docs/use-cases/UC-004-fourth.md": useCaseText(4),
    "docs/architecture/MOD-store.md": moduleText("store"), "docs/architecture/MOD-pages.md": moduleText("pages"), "docs/backlog/ITM-0901-more-work.md": itemText("ITM-0901"),
    ...(declared ? { "docs/process.md": DECLARATION } : {}) };
  const accepted = [...[1, 2, 3, 4].slice(0, useCases).map((n) => [`UC-00${n}`, Object.keys(files).find((path) => path.startsWith(`docs/use-cases/UC-00${n}-`))]),
    ...["MOD-store", "MOD-pages"].slice(0, modules).map((id) => [id, `docs/architecture/${id}.md`])];
  for (const [id, path] of accepted) files[approvalPath(id, await blobSha(files[path]))] = recordText(reviewedRecord(path, await blobSha(files[path])));
  return files;
}

let started = 0;
const settle = async () => { for (let n = 0; n < 40; n += 1) await new Promise((resolve) => setImmediate(resolve)); };

/**
 * startMain({ repos, products, tokens, instanceToken, overviews, tags, pulls, results, down, bridgeLists, refusing, fragment, html }) -> Promise<page> — the page at `html` (index.html, the root of the instance's site) started as the
 * browser starts it: the fixture page of alice.github.io/agent-m, its browser keeping `products` (addresses) with the `tokens` of tests/main-page-home-harness.mjs' `browser` and the instance's token (none with null), the fake GitHub
 * serving `repos` ({ "owner/name": { path: text } }) with `overviews` ({ "owner/name": { "<commit>": text, latest: text } }) on each repository's branch overview-cache and the answers `overlay` names, and the Bridge lab-pc-4
 * listing `bridgeLists` as running. The page: { net, context, window, location, document, body, menu, selector, route (the element the route is drawn into), go(fragment), change(repository, files), fire(at), stop() }.
 */
export async function startMain({ repos, products = [PRODUCT_URL], tokens = { [PRODUCT]: PRODUCT_TOKEN }, instanceToken = INSTANCE_TOKEN, overviews = {}, tags = {}, pulls = {}, results = {}, down = {}, bridgeLists = null,
  refusing = null, fragment = "", html = "index.html" } = {}) {
  const answers = { tags, pulls, results, down };
  const net = network(repos, { bridgeLists });
  Object.assign(net.overviews, overviews);
  net.refusing = refusing;
  net.install();
  overlay(net, answers);
  const context = browser({ products, tokens, instanceToken });
  const { document, location, window } = globalThis;
  location.hash = fragment;
  const script = scriptOf(html);
  document.baseURI = new URL(html, ROOT).href;
  const tag = document.createElement("script");
  tag.setAttribute("type", "module");
  tag.setAttribute("src", script.src);
  for (const [name, value] of Object.entries(script.attributes)) tag.setAttribute(name, value);
  document.head.append(tag);
  const intervals = [];
  globalThis.setInterval = (run, delay) => { intervals.push(delay); return intervals.length; };
  // The one timer of a minute that the page sets to read the jobs' states again is held (a timer of ten seconds or more); any shorter timer runs as it is set.
  const real = { setTimeout: globalThis.setTimeout, clearTimeout: globalThis.clearTimeout };
  globalThis.setTimeout = (run, delay, ...rest) => {
    if (delay < 10000) return real.setTimeout(run, delay, ...rest);
    const timer = { run, delay };
    timers.waiting.push(timer);
    return timer;
  };
  globalThis.clearTimeout = (timer) => { if (timer && typeof timer === "object") timers.waiting = timers.waiting.filter((held) => held !== timer); else real.clearTimeout(timer); };
  started += 1;
  await atNow(() => import(`../src/site-frame/start.mjs?uc046-${started}`));
  await settle();
  const first = (name) => find(document.body, (node) => node.localName === name)[0];
  return {
    net, context, window, location, document, intervals, body: document.body, menu: first("nav"), selector: first("select"), route: first("main"),
    /** A person (or a link) changes the fragment; the page draws what it names. */
    async go(next) { await atNow(async () => { changeFragment({ window, location }, next); await settle(); }); },
    /** The page draws what the fragment its last click wrote names (a click on a button of the page writes the fragment, the browser announces the change). */
    async follow() { await this.go(location.hash); },
    /** The files `repository` holds from now on. */
    change(repository, files) { net.change(repository, files); overlay(net, answers); },
    /** The timer the page set for reading the jobs' states again fires at the clock `at`. */
    async fire(at = NOW + 60000) { await timers.fire(at); await settle(); },
    stop() { timers.restore(); net.restore(); },
  };
}
