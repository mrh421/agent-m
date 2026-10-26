// Dashboard — the browser runtime's composition root and router. SPEC §10; ARC-003 (shells).
//
// Reads one pinned commit of the product — on GitHub or on a GitLab server (its REST API v4, at the same pinned commit) —
// through the public repository Host reads. The review addresses — #uc, #arc, #review, #spec and the routes' own names — are
// handed to MOD-review-pages' routes (reviewTargets), which render the use cases, the architecture and the SPEC change entries and
// make their decisions on a person's click; a GitLab product without its project token is read-only and links to the step that
// stores it. A page load reads the commit and its tree, then the files the route shows in batches (readAhead); the routes then take
// the files they show from that pinned Snapshot. Every read goes through a host of MOD-repository-hosts, and each token only to the API of
// the server that issued it.
//
// Module: MOD-dashboard-app
//
// The other views are files of their own, docs/assets/dashboard/<view>-view.mjs — each loaded by its name from one table
// (DASHBOARD, src/site/views.mjs, which the main page reads too). The menu above the views is the site's one menu, in the order of the process (src/site/menu.mjs).
// Which of the table's files are built is read from one data file beside them, docs/assets/dashboard/built.json, so that a page
// load asks for no file that is not there (one 404 each on GitHub Pages); a change that adds a view adds its file and its line
// there. A view module exports `routes`: { <route>: (app, …parts of the address) }, and may export `stylesheet`, a
// stylesheet of its own beside the site's style sheets. It gets `app`, this page's context: what is read, what is kept, and the helpers every
// view uses. The notices about a token — its expiry and its refusal — are the frame's (notices.mjs), drawn into the slot `token-banner`.
// Nothing here runs on import outside a page (no `document`), so that tests import the shell's own texts.

import { renderArtifact, renderMermaid as drawDiagram } from "../markdown-render/index.mjs";
import { registerPaths } from "../source-register/index.mjs";
import builtFiles from "../../docs/assets/dashboard/built.json" with { type: "json" };
import { DASHBOARD, builtViews } from "../site/views.mjs";
import { MENU, menuHtml, entryOf, stageView } from "../site/menu.mjs";
import { UPSTREAM, instanceOf } from "../site/instance-repository.mjs";
// The checks of what waits for acceptance, started on the review pages (UC-047; sprint 07's change between jobs: the
// dashboard reaches MOD-notifications, as ITM-236's Outcome names it) — through each module's own interface.
import { openStore, readSetting, writeSetting, secretValues } from "../browser-store/index.mjs";
import { parseAddress, connect, HostError } from "../repository-hosts/index.mjs";
import { watchForAcceptance } from "../notifications/index.mjs";
import { storedOverview } from "../progress-measures/index.mjs";
import { attachPromptBar, explain, pageStarted } from "./index.mjs";
import { subjectOf, entryShownOf } from "./subject.mjs";
import { foldMenu } from "./menu.mjs";
import { fragmentOf, instanceHostFollowingStore, loadView, routeOf, productHostFollowingStore, tokenKeyOf } from "./routing.mjs";
import { registerViews } from "./register.mjs";
import { noticePlace, showTokenNotices } from "./notices.mjs";

export { DASHBOARD, UPSTREAM };

// The views of the page: the slugs its script tag names in `data-views`, loaded from their folders (MOD-site-frame, Data: the page setup). The tag is the one whose `src`, read against the
// page's address, is this module's address, as start.mjs finds its own; the app names no view module itself.
const withoutQuery = (address) => String(address).split(/[?#]/)[0];
// Outside a browser (a test that imports this file for the functions it exports) there is no page, so no tag and no views.
const inPage = typeof document !== "undefined";
const ownTag = !inPage ? null : [...document.getElementsByTagName("script")].find((candidate) => {
  const src = candidate.getAttribute("src");
  return src !== null && withoutQuery(new URL(src, document.baseURI).href) === withoutQuery(import.meta.url);
});
if (inPage && !ownTag) throw new Error("dashboard-app.mjs: no script tag of this page loads it.");
const loaded = new Map();
for (const slug of (ownTag?.getAttribute("data-views") ?? "").split(/\s+/).filter(Boolean)) {
  try {
    loaded.set(slug, await loadView(slug));
  } catch (failure) {
    throw new Error(`dashboard-app.mjs: the view module ${slug} named in data-views could not be loaded: ${failure.message}`);
  }
}
// Every view's strategies and the prompt bar's, registered at load (register.mjs), so that a job any route prepares — a review page's, or the test job of an endpoint on the
// Settings page — finds every recipe of the page's views.
if (inPage) registerViews([...loaded]);
// The routes of the views it loads, reachable by embedRoute with the context of the route shown now, recorded as startPage records its page (pageStarted), so that
// one view shows another's part here as on a page startPage starts: the tests browser and the audit the Tests entry's views, the release panel its candidate's audit.
// The context is the one the route shown was rendered with (shownContext), none while a route renders without one of the frame's.
let shownContext = null;
if (inPage) pageStarted("review", [...loaded.values()].flatMap((view) => view.routes ?? []), () => shownContext);
const NO_VIEW = { routes: [], strategies: [] };
const viewOf = (slug) => {
  if (loaded.has(slug)) return loaded.get(slug);
  if (!inPage) return NO_VIEW;
  throw new Error(`dashboard-app.mjs: data-views names no ${slug}`);
};
const settingsPages = viewOf("settings-pages"), reviewPages = viewOf("review-pages"), tracePages = viewOf("trace-pages"), testPages = viewOf("test-pages"),
  maintenancePages = viewOf("maintenance-pages"), implementationPages = viewOf("implementation-pages");


const h = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// The table's files that are built (dashboard/built.json). Whether a view or section is there is read from this list, never by
// asking the server for its file: each file that is not there would cost one 404 per page load.
const built = new Set(builtFiles);
// A view's file, loaded once per page. A file the list names that is not there after all: a browser's import of it fails with a
// TypeError, node's with ERR_MODULE_NOT_FOUND. A file that is there but fails otherwise is shown, so that opening it names the
// error.
const modules = new Map();
function loadFile(file) {
  if (!modules.has(file)) modules.set(file, import(new URL(`../../docs/assets/dashboard/${file}`, import.meta.url).href));
  return modules.get(file);
}
const notThere = (e) => e?.code === "ERR_MODULE_NOT_FOUND" || e instanceof TypeError;
async function present(file) {
  return built.has(file);
}

// A view may bring a stylesheet of its own beside the site's style sheets: its module exports `stylesheet`, a file name in
// docs/assets/dashboard/, which is linked into the page once, when the view is first shown.
const linked = new Set();
function linkStylesheet(file) {
  if (!file || linked.has(file)) return;
  linked.add(file);
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = new URL(`../../docs/assets/dashboard/${file}`, import.meta.url).href;
  document.head.append(link);
}

// ---------------------------------------------------------------- texts and HTML every view uses

// EVERY STEP EXPLAINS ITSELF: the only way to render a step, and it refuses one without explanation.
export function stepHtml({ title, body, explain }) {
  if (!explain || !String(explain).trim()) throw new Error(`step "${title}" has no \"explain\" text (EVERY STEP EXPLAINS ITSELF)`);
  return `<section class="step"><h3>${h(title)}</h3>${body}` +
    `<details class="explain"><summary>What is this?</summary><div>${explain}</div></details></section>`;
}

// The failure of a host this page connected (MOD-repository-hosts' HostError) by its name, or null for any other error.
const hostFailure = (e, name) => (e instanceof HostError && e.name === name ? e : null);

// A write refused for a missing permission. What GitLab answers 403 for here: a push to a protected branch by a role it does not
// allow — the default protection lets Maintainers push ("Fully protected - Default value. Developers cannot push new commits, but
// maintainers can." — doc/user/project/repository/branches/default.md), but a project may allow no one —, and a token without
// the scope the request needs (Gitlab::Auth::InsufficientScopeError → Bearer::Forbidden, lib/api/api_guard.rb). MOD-repository-hosts
// names this refusal PermissionMissing; an expired or revoked token it names TokenRefused instead.
export function gitlabWriteRefusal(e, product) {
  if (!hostFailure(e, "PermissionMissing")) return null;
  return `GitLab refused the write (403). With a project token of role Maintainer and scope api this means that the branch is ` +
    `protected even against Maintainers on ${product.address} — Settings → Repository → Protected branches → “Allowed to push and merge” — or ` +
    "that the token lacks scope api or was created with a lower role. Check the setting, and the token's role and scopes on the " +
    "project's Access tokens page.";
}

// A USED-UP RATE LIMIT IS NAMED, NOT BLAMED ON THE TOKEN: which limit — the account's, or the network's for requests without a
// token — and when it resets, where the server tells the page (MOD-repository-hosts' RateLimited); null for any other refusal. The
// account's text names no token: every token of the account counts against the same limit, so none of them is at fault.
// product: the product the request went to — a GitLab one by its server; null or a GitHub product for GitHub.
export function rateLimitText(e, product = null, now = new Date()) {
  const gl = isGitLab(product) ? product : null;
  const l = hostFailure(e, "RateLimited");
  if (!l) return null;
  const server = gl ? gl.host : "GitHub";
  const which = l.limit === "network"
    ? `${server}'s request limit for this network, for requests made without a token, is used up.`
    : gl ? `${server}'s request limit for the account these requests are made with is used up.`
      : "GitHub's hourly request limit for your account is used up — it counts every request made in your account's name, " +
        "from this page and from any other program.";
  let when;
  if (l.resetsAt) {
    const minutes = Math.ceil((l.resetsAt.getTime() - now.getTime()) / 60000);
    const time = l.resetsAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    when = minutes > 0 ? ` It resets at ${time} (in ${minutes} minute${minutes === 1 ? "" : "s"}); reload then.`
      : ` It reset at ${time}; reload.`;
  } else when = ` ${server} does not tell this page when it resets — try again in a few minutes.`;
  const after = l.limit !== "network" ? " Nothing in Settings needs to change."
    : gl ? "" : " A GitHub token in Settings gives this page your account's own, higher limit.";
  return which + when + after;
}

// UC-008 4a: a write GitHub refused because the token cannot write to the repository — MOD-repository-hosts' PermissionMissing,
// GitHub's 403 or 404 —, and not because a rate limit is used up (A USED-UP RATE LIMIT IS NAMED, NOT BLAMED ON THE TOKEN) or the
// token itself was refused (TokenRefused). Never a GitLab product's: there is no GitHub page to fall back to (A GITLAB PRODUCT IS
// WRITTEN WITH A TOKEN).
export function writeAccessRefused(e, product) {
  return !isGitLab(product) && Boolean(hostFailure(e, "PermissionMissing"));
}

// Why a write was refused, in the product's terms — a used-up limit first, then GitLab's refusal, then GitHub's as the token's
// missing permission; null when none of these applies (the caller then shows errorText). githubPage: GitHub's new-file page
// prefilled with the approval record, which the caller shows beside the text as a link (UC-008 4a); without it the GitHub path is
// named only.
export function writeRefusalText(e, product, now = new Date(), { githubPage = null } = {}) {
  const limit = rateLimitText(e, product, now);
  if (limit) return limit;
  if (isGitLab(product)) return gitlabWriteRefusal(e, product);
  if (!writeAccessRefused(e, product)) return null;
  return `Your token cannot write to ${product.repo} (${e.message}). ` + (githubPage
    ? "Extend it in Settings, or commit the record on GitHub's page instead: without write access GitHub makes your commit a " +
      "pull request, and the acceptance counts once a maintainer merges it."
    : "Extend it in Settings, or remove it to use GitHub's page instead.");
}

// The page shown when the product's commit cannot be read: the host's failure, and what it means here. A used-up rate limit
// is named instead (A USED-UP RATE LIMIT IS NAMED, NOT BLAMED ON THE TOKEN); a refused token is named with the page where it is
// renewed, as MOD-repository-hosts' TokenRefused names both (AN EXPIRED TOKEN IS NAMED AND ITS RENEWAL LINKED). hasToken: whether a
// token for this product is stored.
export function loadErrorHtml({ error: e, product, ref, hasToken, now = new Date() }) {
  const gl = isGitLab(product), name = gl ? product.address : product.repo;
  const limit = rateLimitText(e, product, now);
  if (limit) return `<p class="warn">Could not read ${h(name)} @ ${h(ref)}: ${h(limit)}</p>`;
  const refused = hostFailure(e, "TokenRefused"), missing = hostFailure(e, "NotFound");
  const forbidden = !gl && hasToken && hostFailure(e, "PermissionMissing");
  return `<p class="warn">Could not read ${h(name)} @ ${h(ref)}: ${h(e?.message || "")}</p>
      ${gl && hostFailure(e, "Unreachable") ? `<p class="muted">${h(product.host)} could not be reached from this page — it must accept requests
        from this address, and your network must reach it.</p>` : ""}
      ${gl && missing && !hasToken ? `<p class="muted">A private GitLab project is read only with its project token —
        <a href="${h(`#add/${encodeURIComponent(product.address)}`)}">store it</a>.</p>` : ""}
      ${gl && missing && hasToken ? `<p class="muted">The stored project token does not reach this project — check the address,
        or <a href="${h(`#add/${encodeURIComponent(product.address)}`)}">store another token</a>.</p>` : ""}
      ${forbidden ? `<p class="muted">GitHub refused reading ${h(name)} with the stored token: it lacks a permission for this repository. Extend it on github.com, or check the name.</p>` : ""}
      ${!gl && missing && !hasToken ? `<p class="muted">A private repository cannot be read without a token — add one in <a href="#settings">Settings</a>.</p>` : ""}
      ${!gl && missing && hasToken ? `<p class="muted">The stored token does not reach this repository. Extend it on github.com or check the name.</p>` : ""}
      ${refused ? `<p><a class="btn small" href="${h(refused.renewal)}" target="_blank" rel="noopener">Renew ↗</a></p>
        <p class="muted small">Then paste the renewed token in <a href="#settings">Settings</a>.</p>` : ""}`;
}

// ---------------------------------------------------------------- instance, product, token

// A product of this page by its address, as MOD-repository-hosts' parseAddress reads it (A PRODUCT IS NAMED BY ITS ADDRESS):
// { address, host, repo } for a GitHub repository; { address, host, repo, server, kind: "gitlab" } for a GitLab project, `repo`
// its whole path; { error } with parseAddress's reason for anything that is no repository's address.
export function productOf(url) {
  let a;
  try { a = parseAddress(url); } catch (e) { return { error: e.message }; }
  const named = { address: a.web, host: new URL(a.origin).host, repo: a.path };
  return a.server === "gitlab" ? { ...named, server: a.origin, kind: "gitlab" } : named;
}
const isGitLab = (p) => p?.kind === "gitlab";

// AN INSTANCE IS A FORK OF AGENT M: the instance is the repository of the Pages address this page is served from
// (<owner>.github.io/<name>/), else Agent M itself (src/site/instance-repository.mjs). The product is chosen with ?repo=owner/name (GitHub), ?product=<address>
// (GitHub or GitLab), or the review route's existing product fragment when the query names neither. A GitLab product adds `product` (productOf) and `refGiven` (false: its default branch is read
// from GitLab). It reads the page's own address.
export function deriveTarget({ hostname, pathname, search, hash }) {
  const instance = instanceOf({ hostname, pathname });
  const q = new URLSearchParams(search || "");
  const refOk = q.get("ref") && /^[A-Za-z0-9._\/-]{1,200}$/.test(q.get("ref")) && !q.get("ref").includes("..");
  const ref = refOk ? q.get("ref") : "main";
  const named = q.get("product") || (q.get("repo") ? null : routeOf(hash).params.product);
  const chosen = named ? productOf(named) : null;
  if (chosen && !chosen.error && chosen.kind === "gitlab") return { instance, repo: chosen.repo, ref, product: chosen, refGiven: Boolean(refOk) };
  const wanted = chosen && !chosen.error ? chosen.repo : q.get("repo");
  // ?repo= names a GitHub repository by owner and name: it stands only where it is that repository's whole path.
  const repo = wanted && productOf(`https://github.com/${wanted}`).repo === wanted ? wanted : instance;
  return { instance, repo, ref };
}

// The instance is the fork this page is served from; the product is chosen with ?repo= or ?product= (SPEC §10). Set by start().
let T, GITLAB, SERVER, store, host, hostAddress, hostToken, snapshot, snapshotHost;
// `store` is this browser's MOD-browser-store store of the instance (openStore), read by its catalogue's keys.
// The GitHub token (the instance's key, UC-014): the value of the setting `github-token`.
const ghToken = () => readSetting(store, "github-token")?.value ?? null;
// The setting of a product's own token, under the key MOD-site-frame's tokenKeyOf names for its address, or null.
const ownToken = (p) => (p?.address && !p.error ? readSetting(store, tokenKeyOf(parseAddress(p.address))) : null);
// The token that writes to the product shown: a GitLab product's own project token (A GITLAB PRODUCT USES A PROJECT ACCESS
// TOKEN), never the GitHub token; a GitHub product's own token, or the instance's while it has none (A GITHUB PRODUCT USES A
// TOKEN OF ITS OWN).
const token = () => ownToken(T.product)?.value ?? (parseAddress(T.product.address).server === "github" ? ghToken() : null);
// The values of every secret stored at this moment, which no commit made through a host the app connects may hold (NO SECRET IN THE REPOSITORY).
const secrets = () => secretValues(openStore(T.instance));
// A Host retains the credential it was connected with. Reuse its Snapshot and blob memory while the selected repository and
// actual credential are unchanged; create a new Host after Settings changes or clears that credential.
function currentHost() {
  const address = T.product.address;
  const currentToken = JSON.stringify([token() || null, secrets()]);
  if (!host || hostAddress !== address || hostToken !== currentToken) {
    const changed = Boolean(host);
    // A refusal names the token that was used: a GitHub product's own by its product (A GITHUB PRODUCT USES A TOKEN OF ITS OWN).
    const tokenName = !isGitLab(T.product) && ownTokenOf(T.product) ? `GitHub token for ${address}` : null;
    host = connect(parseAddress(address), { token: token() || null, tokenName, secrets: secrets() });
    hostAddress = address;
    hostToken = currentToken;
    if (changed) {
      snapshot = null;
      snapshotHost = null;
      memo = new Map();
    }
  }
  return host;
}
// The product whose own token a request to `p` carries — a GitLab product, or a GitHub product with a token of its own —, so that
// a refusal names that token; null where the instance's token was used.
const ownTokenOf = (p) => (isGitLab(p) || ownToken(p)?.value ? p : null);
// The pinned commit and its tree (every file with its blob SHA). Everything else is read by the view that shows it (`once`).
const state = { commit: null, tree: [], byPath: new Map(), products: [] };
let flash = null; // the outcome of the last acceptance, shown once above the next view

// ---------------------------------------------------------------- loading
//
// A page load reads the commit the branch points at and that commit's tree — two requests. The tree names every file with its
// blob SHA. The files the route shows are read in batches (readAhead); each view then takes what it shows once per commit
// (`once`): a file by its blob SHA through the pinned Snapshot, whose texts the batches have brought.
// The status of a reviewed file comes from the names of the approval records in the tree (MOD-approvals' statuses, which the
// routes call); no record is read for it.

let memo = new Map(); // what this page has read or derived at state.commit
function once(key, f) {
  if (!memo.has(key)) memo.set(key, f().catch((e) => { memo.delete(key); throw e; }));
  return memo.get(key);
}

async function loadSnapshot() {
  const before = state.commit;
  const activeHost = currentHost();
  // GITLAB PRODUCTS ARE SUPPORTED: its default branch unless ?ref= names one, resolved to one commit.
  if (GITLAB && !T.refGiven) T.ref = (await activeHost.repositoryInfo()).defaultBranch || T.ref;
  const snap = await activeHost.readSnapshot(T.ref);
  snapshot = snap;
  snapshotHost = activeHost;
  state.commit = snap.commit;
  state.tree = snap.paths.map((path) => ({ path, sha: snap.blob(path) }));
  state.byPath = new Map(state.tree.map((e) => [e.path, e]));
  if (state.commit !== before) memo = new Map();
}

// A page load reads the files a route shows in batches, ahead of the reads of the views (Snapshot.readMany): each route's
// paths are taken from the tree, so no view changes. A route whose list of files depends on files it has read — the open
// queues' proposals — reads them through the snapshot itself, in a batch of its own. Each wave is one batch per hundred
// files; a path the tree does not hold is left out, and a file the batch could not give is read by its own fileText.
const USE_CASE_PATH = /^docs\/use-cases\/UC-\d{3}-[^/]+\.md$/;
const QUEUE_INDEX_PATH = /^docs\/spec-freigaben\/[^/]+\/index\.md$/;
const QUEUE_HEAD_PATH = /^docs\/spec-freigaben\/[^/]+\/(?:index|entscheidungen)\.md$/;
const ITEM_PATH = /^docs\/backlog\/ITM-\d{3,}-[a-z0-9]+(?:-[a-z0-9]+)*\.md$/;
const SPRINT_PATH = /^docs\/backlog\/sprints\/([^/]+)\/\d+\.md$/;
const ASSIGNMENT_PATH = /^docs\/role-assignments\/([^/]+)\.md$/;
const MODULE_PATH = /^docs\/architecture\/MOD-[^/]+\.md$/;
const DECISION_PATH = /^docs\/architecture\/ARC-\d{3}-[^/]+\.md$/;
const pathsOf = (...res) => state.tree.map((e) => e.path).filter((p) => res.some((re) => re.test(p)));
async function readWave(paths) {
  const wanted = [...new Set(paths)].filter((p) => state.byPath.has(p));
  if (wanted.length) await (await pinned()).readMany(wanted);
}
async function readAhead(kind) {
  if (kind === "" || kind === "uc") {
    await readWave(pathsOf(USE_CASE_PATH));
  } else if (kind === "arc") {
    await readWave(pathsOf(DECISION_PATH, MODULE_PATH));
  } else if (kind === "use-case") {
    await readWave(pathsOf(USE_CASE_PATH));
  } else if (kind === "decision") {
    await readWave(pathsOf(DECISION_PATH));
  } else if (kind === "module") {
    await readWave(pathsOf(MODULE_PATH));
  } else if (kind === "spec") {
    // The links file and the register's entries (MOD-source-register's registerPaths) are read with the SPEC, in the first wave, beside the overview stored for the commit
    // (MOD-progress-measures' storedOverview). The change queues it holds — those with an entry not in the SPEC yet — are what the specification lists as waiting: their files are
    // read in a second wave, and no other queue is read. Where no overview is stored, every queue's index and decisions are read in the second wave, by their paths; the
    // specification (MOD-trace-pages) finds the entries waiting from them and reads their proposals through the snapshot in a batch. A tree without a queue asks for no overview.
    const queued = pathsOf(QUEUE_INDEX_PATH).length > 0;
    const [, stored] = await Promise.all([readWave(["SPEC.md", "docs/sources.md", ...registerPaths(state.tree.map((e) => e.path))]),
      queued ? pinned().then((snap) => storedOverview(snap)).catch(() => null) : null]);
    if (stored) {
      await readWave(stored.queues.flatMap((queue) => [`${queue.folder}/index.md`, `${queue.folder}/entscheidungen.md`,
        ...queue.entries.filter((entry) => entry.state !== "in SPEC").flatMap((entry) => [entry.proposal?.path, entry.rationale, entry.file, entry.record])]).filter(Boolean));
    } else {
      await readWave(pathsOf(QUEUE_HEAD_PATH));
    }
  } else if (kind === "backlog") {
    // The module files are read for a product with more than one team (the route backlog of MOD-implementation-pages reads them).
    const teams = new Set([...pathsOf(ASSIGNMENT_PATH).map((p) => ASSIGNMENT_PATH.exec(p)[1]), ...pathsOf(SPRINT_PATH).map((p) => SPRINT_PATH.exec(p)[1])]);
    await readWave(["docs/process.md", "SPEC.md", ...pathsOf(ITEM_PATH, SPRINT_PATH, ASSIGNMENT_PATH), ...(teams.size > 1 ? pathsOf(MODULE_PATH) : [])]);
  }
}

// The product shown, for a write (writeFiles): a GitLab product by itself, a GitHub one by its repository.
const writeTarget = () => (GITLAB ? { product: T.product } : { repo: T.repo });

// THE DASHBOARD KEEPS ITS PRODUCTS IN THE BROWSER: the list is this browser's, by address; the instance
// repository names no product. Another browser starts with an empty list.
function loadProducts() {
  state.products = (readSetting(store, "products") ?? []).map(productOf).filter((p) => !p.error);
}
const paths = (re) => state.tree.filter((e) => re.test(e.path));

// A file of the pinned commit — "" for a file the tree does not hold. Snapshot.read is the public Host interface for this
// address and credential lifetime.
// The load's one snapshot: the one loadSnapshot read, or, after Settings changed the host, the same commit read through the new one.
async function pinned() {
  const activeHost = currentHost();
  if (snapshotHost !== activeHost) {
    snapshot = await activeHost.readSnapshot(state.commit);
    snapshotHost = activeHost;
  }
  return snapshot;
}
function fileText(path) {
  if (!state.byPath.has(path)) return Promise.resolve("");
  currentHost();
  return once(`file:${path}`, async () => {
    const text = await (await pinned()).read(path);
    if (text === null && !GITLAB) throw Object.assign(new Error(`404 Not Found — ${path} at ${state.commit}`), { status: 404 });
    return text ?? "";
  });
}

// A view renders only while it is still the one asked for: reading may take long enough for the person to have moved on.
let routeSeq = 0;

// ---------------------------------------------------------------- rendering helpers

const main = () => document.getElementById("main");

// The live page's Markdown, rendered by MOD-markdown-render's renderArtifact: front matter as a table, images as links. A Mermaid
// block is left as its source here and drawn by renderMermaid(root) once the HTML stands in the page.
export function md(text) {
  return renderArtifact(text).innerHTML;
}

async function renderMermaid(root) {
  for (const code of [...root.querySelectorAll("pre > code.language-mermaid")]) {
    code.parentElement.replaceWith(await drawDiagram(code.textContent));
  }
}

async function reloadAndRoute() {
  await loadSnapshot();
  await route();
}

// Why a write was refused, in the product's terms (writeRefusalText); githubPage: the GitHub path the caller links beside it.
const writeErrorText = (e, githubPage = null) => writeRefusalText(e, T.product, new Date(), { githubPage }) || errorText(e);

// ---------------------------------------------------------------- tokens refused or expiring (SPEC §7)

const shownSecrets = new Set(); // keys revealed by Show on this page; any other view hides them again

// AN EXPIRED TOKEN IS NAMED AND ITS RENEWAL LINKED: a refused token anywhere (TokenRefused) marks the token that was used as refused —
// the GitHub token, or the project token of the GitLab product (`product`) — and the line at the top of every
// view says which token and where it is renewed. The mark is the token's last test, kept in this browser as the setting
// `last-test:<the token's key>` (MOD-browser-store), so that it holds after a reload too (UC-042 step 1); a successful Test, a new
// value or a Clear replace it. A token that is not stored has no test to keep.
function noteRefusal(e, product = T.product) {
  if (hostFailure(e, "TokenRefused")) {
    const key = ownTokenOf(product) ? tokenKeyOf(parseAddress(product.address)) : "github-token";
    if (readSetting(store, key)?.value) writeSetting(store, `last-test:${key}`, { at: new Date().toISOString(), outcome: "refused" });
    showBanner();
  }
  return e;
}
// Any refusal, in words: a used-up rate limit by its name, else the failure's own message — a refused token's names the token and
// the page where it is renewed (MOD-repository-hosts' TokenRefused).
const errorText = (e, product = T.product) => rateLimitText(e, product) || e.message;
const gitlabShown = () => {
  const own = GITLAB ? ownToken(T.product) : null;
  return own?.value ? { token: own.value, expires: own.expires ?? null } : null;
};
// The notices at the top of every view: the frame's own notices (MOD-site-frame, showTokenNotices) of the GitHub token and of the
// shown product's own token, each expiring or refused at its last use (its kept last test). Their place is the page's slot
// `token-banner`, made at the start of the page.
let tokenNotices = null;
function showBanner() {
  if (!tokenNotices) return;
  const slot = document.getElementById("token-banner");
  tokenNotices.replaceChildren();
  const address = parseAddress(T.product.address);
  const isInstance = address.server === "github" && address.path === T.instance;
  showTokenNotices({ store: openStore(T.instance), instance: { host: connect(parseAddress(`https://github.com/${T.instance}`), { secrets: secrets() }) },
    product: isInstance ? null : { address: T.product.address, host: connect(address, { secrets: secrets() }) } });
  // The slot holds the place only while it holds a notice, so that it stays empty (and hidden by the page's style) otherwise.
  slot.replaceChildren(...(tokenNotices.children.length ? [tokenNotices] : []));
}

// ---------------------------------------------------------------- the product selector

// The dashboard's address for a product: ?repo=owner/name on GitHub, ?product=<address> on GitLab.
function productHref(p) {
  const q = new URLSearchParams();
  if (isGitLab(p)) q.set("product", p.address);
  else if (p.repo !== T.instance) q.set("repo", p.repo);
  return `?${q}`;
}

function renderProductSelector() {
  const sel = document.getElementById("product");
  // A PRODUCT IS NAMED BY ITS ADDRESS; the instance is always offered first and is not in the list.
  const instance = productOf(`https://github.com/${T.instance}`);
  const options = [{ p: instance, label: `${T.instance} — this instance` },
    ...state.products.filter((p) => p.address !== instance.address).map((p) => ({ p, label: p.address }))];
  sel.innerHTML = options.map(({ p, label }) => `<option value="${h(p.address)}" ${p.address === T.product.address ? "selected" : ""}>${h(label)}</option>`).join("")
    + `<option value="__add">+ Add product…</option>`;
  sel.onchange = () => {
    if (sel.value === "__add") {
      sel.value = T.product.address;
      location.hash = "#add";
      return;
    }
    location.search = productHref(productOf(sel.value)).slice(1);
  };
}

// ---------------------------------------------------------------- notifications (UC-047)
//
// Change between jobs, sprint 07 (SPEC.md WHAT NO MODULE OWNS IS CHANGED BETWEEN JOBS): ITM-236's own header named
// making the dashboard's pages start the checks as not part of that item. This wires MOD-notifications' watchForAcceptance
// into the review pages with MOD-browser-store's store of the instance, as sprint 07's record (docs/backlog/sprints/team1/07.md)
// names, and builds the one thing watchForAcceptance needs that the module does not provide itself: the address of a
// notification's review-pages route, confirmed against the routes this file and its views already serve (the PO's gate
// record of ITM-236 names addressOf's routes as this change's reading to confirm) — #uc(/<id>), #arc(/<id>) for both an
// architecture decision and a module ("ONE ARCHITECTURE DECISION, ONE FILE · ONE MODULE, ONE FILE"),
// #spec/<queue>/<nn> for one SPEC change entry (MOD-progress-measures' id "spec-<queue>-<nn>"),
// #release always for a release test report (MOD-test-pages' route release, which route() renders).
let notificationsStore = null;

// MOD-notifications' checks.mjs route key for one of its waiting kinds, turned into this file's own route — "uc", "arc"
// or "spec", with the file's id where one file is named; "release" always, regardless of id (MOD-test-pages' one route,
// no id of its own).
function notificationView(route, id) {
  if (route === "use-case") return id ? `uc/${id}` : "uc";
  if (route === "decision" || route === "module") return id ? `arc/${id}` : "arc";
  if (route === "spec-entry") {
    const m = id && /^spec-(.+)-(\d+)$/.exec(id);
    return m ? `spec/${m[1]}/${m[2]}` : "spec";
  }
  return "release";
}

// addressOf(route, params, repository) -> string (MOD-notifications, Interfaces: watchForAcceptance) — the instance's
// own address with no query (as renderProductSelector's own instance option, and productHref, already resolve it), or a
// kept product's by its repository path; absolute, since the worker opens it from its own scope, not this page's
// (src/notifications/worker.mjs).
function addressOfNotification(route, params, repository) {
  const p = repository === T.instance ? productOf(`https://github.com/${T.instance}`)
    : state.products.find((x) => x.repo === repository) ?? null;
  const query = p ? productHref(p) : "";
  return new URL(`${query}#${notificationView(route, params.id)}`, document.baseURI).href;
}

// Opens this browser's MOD-browser-store store of the instance, connects the instance's host with the dashboard's own
// stored GitHub token — ghToken(), the setting `github-token` of that store, as the connect() of the routes of MOD-implementation-pages
// uses it (ITM-238 F2, sprint 08's change between jobs, docs/backlog/sprints/team1/08.md: MOD-browser-store's own
// "github-token" setting is never written, so the instance was always checked with no token) — and starts the
// checks — only where this browser could ever show one at all: real browsers always define Notification
// (permission.mjs's own available() already tells "no" apart by the same check, for a browser that offers no
// notifications); without it the checks would only run uselessly, and watchForAcceptance's own interval would never be
// cleared (no page of this kind is ever closed from here) — exactly what every test that loads this page without faking
// a browser's Notification must not be left running after it.
function startNotifications() {
  try {
    notificationsStore = openStore(T.instance);
  } catch {
    return; // StorageUnavailable: a browser that refuses storage holds no switch, and no check runs
  }
  if (typeof globalThis.Notification === "undefined") return;
  watchForAcceptance({ store: notificationsStore, instance: { repository: T.instance, host: instanceHostFollowingToken() }, productHost: productHostFollowingStore({ store: notificationsStore }), addressOf: addressOfNotification });
}

// The instance's host for the checks, which keep it for the page's whole life: each call of its functions goes through a host connected
// with the GitHub token stored at that moment, a new one when the token was cleared, replaced or stored since (A CLEAR IS A REAL CLEAR).
function instanceHostFollowingToken() {
  const address = parseAddress(`https://github.com/${T.instance}`);
  let held = null, heldToken = null;
  const current = () => {
    const stored = JSON.stringify([ghToken() || null, secrets()]);
    if (!held || stored !== heldToken) {
      held = connect(address, { token: ghToken() || null, secrets: secrets() });
      heldToken = stored;
    }
    return held;
  };
  return Object.freeze(Object.fromEntries(Object.entries(current()).map(([name, member]) =>
    [name, typeof member === "function" ? (...given) => current()[name](...given) : member])));
}

// ---------------------------------------------------------------- this page's context, handed to every view

let app = null;
function context() {
  return {
    T, GITLAB, SERVER, store, state, DASHBOARD,
    ghToken, token, once, loadSnapshot, writeTarget, loadProducts, paths, fileText, shownSecrets,
    main, h, md, renderMermaid, rateLimitText, reloadAndRoute, writeErrorText,
    noteRefusal, errorText, showBanner, gitlabShown, productHref, renderProductSelector, loadFile, present, notThere,
    seq: () => routeSeq,
    setFlash: (text) => { flash = text; },
  };
}

// ---------------------------------------------------------------- the review pages' routes (MOD-review-pages)
//
// The live addresses lead where they led, through MOD-review-pages' routes: #uc, #uc/<id>, #arc, #arc/<id>, #review/uc, #review/arc,
// #spec and #spec/<queue>/<nn>; the routes' own names (#use-case/id=…, #decision, #module/id=…, #spec-entry/id=…, #requirement/name=…,
// #requirements/section=…, #draft/subject=…) are served as they are, since the pages' links use them.

const REVIEW_ROUTES = new Set(reviewPages.routes.map((route) => route.name));
const decoded = (part) => decodeURIComponent(part);

// The routes the address shows, each { name, params }, or null for an address that is no review address.
function reviewTargets(kind, a, b) {
  if (kind === "uc") return [{ name: "use-case", params: a ? { id: decoded(a) } : {} }];
  if (kind === "arc") {
    if (!a) return [{ name: "decision", params: {} }, { name: "module", params: {} }];
    return [{ name: decoded(a).startsWith("MOD-") ? "module" : "decision", params: { id: decoded(a) } }];
  }
  if (kind === "review") {
    if (a === "uc") return [{ name: "use-case", params: { id: "all" } }];
    if (a === "arc") return [{ name: "decision", params: { id: "all" } }];
    return [{ name: "use-case", params: {} }];
  }
  if (kind === "spec") return a && b ? [{ name: "spec-entry", params: { id: `spec-${decoded(a)}-${b}` } }] : [];
  if (REVIEW_ROUTES.has(kind)) return [{ name: kind, params: routeOf(location.hash).params }];
  return null;
}

// The host the review pages read through: the app's own. While a page is being loaded it hands the snapshot this load read, whose texts the
// batches brought, so that the page asks the server for neither the commit nor the tree again (A PAGE LOAD READS THE REPOSITORY IN BATCHES);
// a click after the load — a decision — reads the branch as it is then. Its repository information is read once. A commit it makes reads the new
// head, so that the next page shows it.
let pagesHosts = null; // { of, host }
let loading = 0; // pages being loaded
let written = null; // the snapshot read after a commit the pages made, until the page shown again has taken it
function pagesHost() {
  const real = currentHost();
  if (pagesHosts?.of === real) return pagesHosts.host;
  let info = null;
  // A refusal of the token by the server marks the token that was used, as every other view marks it (AN EXPIRED TOKEN IS NAMED AND ITS RENEWAL LINKED).
  const noted = (call) => async (...given) => {
    try {
      return await call(...given);
    } catch (e) {
      throw noteRefusal(e);
    }
  };
  const host = Object.freeze({
    ...Object.fromEntries(Object.entries(real).map(([name, member]) => [name, typeof member === "function" ? noted(member) : member])),
    repositoryInfo: noted(() => (info ??= real.repositoryInfo().catch((e) => { info = null; throw e; }))),
    readSnapshot: noted(async (ref) => {
      if (ref === T.ref && snapshot && snapshotHost === real && (loading > 0 || written === snapshot)) {
        written = null;
        return snapshot;
      }
      return real.readSnapshot(ref);
    }),
    // The head a commit made is read once, for the app; the page shown again after it takes that read (the next one) and does not read it anew.
    commitFiles: noted(async (change) => {
      const made = await real.commitFiles(change);
      await loadSnapshot();
      written = snapshot;
      return made;
    }),
  });
  pagesHosts = { of: real, host };
  return host;
}

// The ViewContext of the review pages for the product shown: the product is the instance itself when the address names the instance.
function reviewContext() {
  const address = parseAddress(T.product.address);
  const shown = pagesHost();
  const isInstance = address.server === "github" && address.path === T.instance;
  return {
    page: "review",
    instance: { repository: T.instance, host: isInstance ? shown : connect(parseAddress(`https://github.com/${T.instance}`), { token: ghToken(), secrets: secrets() }) },
    product: isInstance ? null : { address: T.product.address, kind: address.server, host: shown, tokenStored: Boolean(token()) },
    store: openStore(T.instance),
    // The step that stores a product's token is this page's #add; any other route is written as the frame writes it.
    go(route, params = {}) {
      if (route === "add-product") location.hash = params.address ? `#add/${encodeURIComponent(params.address)}` : "#add";
      else location.hash = `#${[route, ...Object.entries(params).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)].join("/")}`;
    },
  };
}

// The ViewContext of the routes of MOD-implementation-pages for the product shown: the product is always the one shown, the instance itself included, since these routes work on a product's files; the hosts are the app's
// own, which serve the snapshot the load read.
function implementationContext() {
  const address = parseAddress(T.product.address);
  const shown = pagesHost();
  const isInstance = address.server === "github" && address.path === T.instance;
  return {
    page: "review",
    instance: { repository: T.instance, host: isInstance ? shown : connect(parseAddress(`https://github.com/${T.instance}`), { token: ghToken(), secrets: secrets() }) },
    product: { address: T.product.address, kind: address.server, host: shown, tokenStored: Boolean(token()), ref: T.ref },
    store: openStore(T.instance),
    go(route, params = {}) { location.hash = fragmentOf(route, params); },
  };
}

// A route that works on the product shown — MOD-test-pages' runs, schedule and generate, MOD-trace-pages' trace —, drawn into <main> with implementationContext(), as the
// backlog is, reading through the snapshot this load read.
async function renderProductRoute(view, name, params) {
  loading += 1;
  try {
    shownContext = implementationContext();
    await view.routes.find((route) => route.name === name).render(main(), shownContext, params);
  } finally {
    loading -= 1;
  }
}

// Each route draws into an element of its own in <main>: a route that was left meanwhile draws into an element no longer there.
async function renderReviewPages(targets, lead = []) {
  const context = reviewContext();
  const boxes = targets.map(() => document.createElement("div"));
  main().replaceChildren(...lead, ...boxes);
  loading += 1;
  try {
    if (!targets.length) await renderSpecification(context);
    for (const [at, { name, params }] of targets.entries()) {
      await reviewPages.routes.find((route) => route.name === name).render(boxes[at], context, params);
      if (name === "module" && !params.id) await renderComponents(context);
    }
  } finally {
    loading -= 1;
  }
}

// The component diagram under the lists of the architecture (UC-025 step 5): MOD-trace-pages' route `trace` with its view `modules`, read through the same host.
async function renderComponents(context) {
  const box = document.createElement("div");
  main().append(box);
  await tracePages.routes.find((route) => route.name === "trace").render(box,
    { instance: { host: context.instance.host }, product: { host: (context.product ?? context.instance).host } }, { key: "modules", ref: T.ref });
}

// The specification browser under the open SPEC changes (MOD-trace-pages' route `trace`), read through the same host. Its context and parameters are
// kept, so that the prompt bar's subject on #spec is the route's own — the open requirement or group, to change (barSubject).
let specificationShown = null;
async function renderSpecification(context) {
  const box = document.createElement("div");
  main().append(box);
  const trace = tracePages.routes.find((route) => route.name === "trace");
  const shown = { context: { instance: { host: context.instance.host }, product: { host: (context.product ?? context.instance).host } }, params: { key: "specification", ref: T.ref } };
  specificationShown = shown;
  await trace.render(box, shown.context, shown.params);
}

// UC-014 step 6: while this browser holds no key for the instance, the start page opens with Finish setting up your instance.
function setupBanner() {
  const node = (name, className, ...children) => {
    const made = document.createElement(name);
    if (className) made.className = className;
    made.append(...children);
    return made;
  };
  const link = (className, href, text) => {
    const made = node("a", className, text);
    made.setAttribute("href", href);
    return made;
  };
  return node("section", "panel setup-banner", node("h3", null, "Finish setting up your instance"),
    node("p", null, "This browser has no key for ", node("strong", null, T.instance), " yet. Without one you can read and review; accepting and editing " +
      "then go through GitHub's own pages, and products cannot be added."),
    node("p", null, link("btn primary", "#setup", "Set up now"), " ", link("btn", "#settings", "Import settings"), " ",
      node("span", "muted small", "— from a file exported in another browser (Settings → Export settings).")));
}
const showsSetup = (kind, a) => (kind === "" || kind === "uc") && !a && !GITLAB && !ghToken();

// How acceptance works: the topic `accepting`, folded.
function renderHow() {
  const fold = explain("accepting", "How acceptance works");
  fold.open = true;
  main().replaceChildren(fold);
}

// ---------------------------------------------------------------- routing

// THE MENU FOLLOWS THE PROCESS: the site's menu, each entry leading to the first of its views whose file is built; the entry of
// the page shown is marked.
let available = null;
// A route of a loaded view named as it is — #trace, #use-case/…, #decision — is under the entry of the page it shows, by the frame's rule (MOD-site-frame's
// Route): its `entryShown(params)`, else its `entry`. Any other view of the app is under the menu entry that lists it.
const loadedRoute = (kind) => [...loaded.values()].flatMap((view) => view.routes ?? []).find((route) => route.name === kind) ?? null;
function markTab(kind) {
  const route = loadedRoute(kind);
  const entry = route ? entryShownOf(route, routeOf(location.hash).params) : entryOf(kind || "uc");
  document.querySelectorAll(".tabs [data-entry]").forEach((t) => t.classList.toggle("active", t.dataset.entry === entry));
}
async function renderTabs() {
  const el = document.getElementById("tabs");
  if (el) el.innerHTML = menuHtml({ built: builtViews(builtFiles), tabs: true }).replaceAll(' role="tab"', "");
  const [kind, a] = location.hash.replace(/^#/, "").split("/");
  markTab(kind === "review" ? a : kind);
}

async function route() {
  routeSeq += 1;
  shownContext = null;
  let [kind, a, b] = location.hash.replace(/^#/, "").split("/");
  const entry = MENU.find((candidate) => candidate.key === kind);
  const params = routeOf(location.hash).params;
  let unavailableEntry = null;
  if (entry && (a === undefined || (b === undefined && Object.keys(params).length > 0 && Object.keys(params).every((key) => key === "product")))) {
    const view = stageView(entry, builtViews(builtFiles));
    if (view) kind = view;
    else unavailableEntry = entry;
    a = undefined;
    b = undefined;
  }
  markTab(kind === "review" ? a : kind);
  // The views of the repository read what they show first.
  if (state.commit && ["", "uc", "arc", "spec", "review"].includes(kind || "")) main().innerHTML = `<p class="muted">Reading…</p>`;
  try {
    await available;
    if (unavailableEntry) {
      main().innerHTML = `<p class="muted">The ${h(unavailableEntry.label)} entry is not built yet.</p>`;
      showBanner();
      return;
    }
    loadProducts();
    renderProductSelector();
    if (state.commit && !a && ["", "uc", "arc", "spec", "backlog", "use-case", "decision", "module"].includes(kind || "")) await readAhead(kind || "");
    const reviewed = reviewTargets(kind, a, b);
    if (reviewed) {
      await renderReviewPages(reviewed, showsSetup(kind, a) ? [setupBanner()] : []);
    } else if (kind === "how") {
      renderHow();
    } else if (kind === "settings") {
      const settings = settingsPages.routes.find((r) => r.name === "settings");
      const settingsStore = openStore(T.instance);
      const address = parseAddress(T.product.address);
      await settings.render(main(), {
        instance: {
          repository: T.instance,
          host: connect(parseAddress(`https://github.com/${T.instance}`), { token: ghToken(), secrets: secrets() }),
        },
        product: { address: T.product.address, kind: address.server, host: connect(address, { token: token(), secrets: secrets() }) },
        store: settingsStore,
        go(route, params = {}) {
          if (route === "add-product") location.hash = params.address ? `#add/${encodeURIComponent(params.address)}` : "#add";
          if (route === "endpoints") location.hash = params.name ? `#endpoints/${encodeURIComponent(params.name)}` : "#endpoints";
          if (route === "bridge") location.hash = "#bridge";
          if (route === "main") location.search = productHref(productOf(params.product)).slice(1);
        },
      }, {});
    } else if (kind === "add" || kind === "add-product") {
      const addProduct = settingsPages.routes.find((r) => r.name === "add-product");
      await addProduct.render(main(), {
        instance: { repository: T.instance }, product: null, store: openStore(T.instance),
        go(_route, { product }) { location.search = productHref(productOf(product)).slice(1); },
      }, {});
      if (a) {
        const input = main().querySelector("input.address");
        input.value = decodeURIComponent(a);
        input.dispatchEvent(new Event("input"));
      }
      return;
    } else if (kind === "get-your-own") {
      const getYourOwn = settingsPages.routes.find((r) => r.name === "get-your-own");
      await getYourOwn.render(main(), {
        instance: { repository: T.instance }, product: null, store: openStore(T.instance),
        go(route) {
          if (route === "settings") location.hash = "#settings";
          if (route === "add-product") location.hash = "#add";
          if (route === "main") location.hash = "#uc";
        },
      }, routeOf(location.hash).params);
    }
    else if (kind === "endpoints") {
      const endpoints = settingsPages.routes.find((r) => r.name === "endpoints");
      await endpoints.render(main(), {
        instance: { repository: T.instance }, product: null, store: openStore(T.instance),
        go(route, params = {}) {
          if (route === "endpoints") location.hash = params.name ? `#endpoints/${encodeURIComponent(params.name)}` : "#endpoints";
          if (route === "bridge") location.hash = "#bridge";
        },
      }, { name: a ? decodeURIComponent(a) : "" });
    } else if (kind === "setup") {
      const setup = settingsPages.routes.find((r) => r.name === "setup");
      await setup.render(main(), {
        instance: { repository: T.instance }, product: null, store: openStore(T.instance),
        go(route) {
          if (route === "settings") location.hash = "#settings";
          if (route === "add-product") location.hash = "#add";
          if (route === "main") location.hash = "#uc";
        },
      }, {});
    } else if (kind === "release") {
      const releasePanel = testPages.routes.find((r) => r.name === "release");
      shownContext = {
        instance: { host: connect(parseAddress(`https://github.com/${T.instance}`), { token: ghToken() }) },
        product: { host: connect(parseAddress(T.product.address), { token: token() }) },
      };
      await releasePanel.render(main(), shownContext, {});
    } else if (kind === "runs" || kind === "schedule" || kind === "generate") {
      await renderProductRoute(testPages, kind, routeOf(location.hash).params);
    } else if (kind === "trace") {
      // The tests browser and the audit (UC-029, UC-030), and every other view of the route: the version the fragment names, or the one the page shows.
      await renderProductRoute(tracePages, "trace", { ref: T.ref, ...routeOf(location.hash).params });
    } else if (kind === "mail") {
      const mailRoute = maintenancePages.routes.find((r) => r.name === "mail");
      await mailRoute.render(main(), {
        page: "review", instance: { repository: T.instance }, product: null, store: openStore(T.instance),
        go(route, params = {}) {
          if (route === "add-product") location.hash = "#add";
          else location.hash = params.id ? `#${route}/${encodeURIComponent(params.id)}` : `#${route}`;
        },
      }, {});
    } else if (kind === "replies") {
      const repliesRoute = maintenancePages.routes.find((r) => r.name === "replies");
      await repliesRoute.render(main(), {
        page: "review", instance: { repository: T.instance }, product: null, store: openStore(T.instance),
        go(route, params = {}) {
          if (route === "add-product") location.hash = "#add";
          else location.hash = fragmentOf(route, params);
        },
      }, routeOf(location.hash).params);
    } else if (kind === "process" || kind === "roles") {
      // The product and the instance, each connected with its own token: the route reads and builds everything the page shows.
      const route = implementationPages.routes.find((r) => r.name === kind);
      const hosts = { instance: { host: connect(parseAddress(`https://github.com/${T.instance}`), { token: ghToken() }) }, product: { host: connect(parseAddress(T.product.address), { token: token() }) } };
      await route.render(main(), hosts);
      if (kind === "process") main().insertAdjacentHTML("afterbegin", `<section class="head"><h2>${h(route.title)}</h2></section>`);
    } else if (kind === "backlog") {
      loading += 1;
      try {
        await implementationPages.routes.find((r) => r.name === "backlog").render(main(), implementationContext(), {});
      } finally {
        loading -= 1;
      }
    } else if (kind === "bridge") {
      const bridge = settingsPages.routes.find((r) => r.name === "bridge");
      await bridge.render(main(), {
        instance: { repository: T.instance }, product: null, store: openStore(T.instance),
        go(route, params = {}) {
          if (route === "endpoints") location.hash = params.name ? `#endpoints/${encodeURIComponent(params.name)}` : "#endpoints";
          if (route === "bridge") location.hash = "#bridge";
        },
      }, {});
    } else {
      // A view by its name; an address no view answers — or a view whose file is not there yet — shows the use cases.
      const v = DASHBOARD.find((x) => x.view && x.view === kind);
      const views = v && built.has(v.file) ? await loadFile(v.file).catch((e) => { if (notThere(e)) return null; throw e; }) : null;
      if (views?.routes?.[v.view]) {
        linkStylesheet(views.stylesheet);
        await views.routes[v.view](app, a, b);
      } else {
        await renderReviewPages(reviewTargets("uc"), GITLAB || ghToken() ? [] : [setupBanner()]);
      }
    }
    // A TOKEN'S EXPIRY IS WARNED OF IN ADVANCE · AN EXPIRED TOKEN IS NAMED AND ITS RENEWAL LINKED — on every view.
    showBanner();
    if (flash) {
      main().insertAdjacentHTML("afterbegin", `<section class="panel notice flash"><p>${flash}</p></section>`);
      flash = null;
    }
  } catch (e) {
    main().innerHTML = `<p class="warn">${h(errorText(noteRefusal(e)))}</p>`;
  }
  window.scrollTo(0, 0);
}

// The Cache Storage `agent-m-file-texts`, where an earlier version of this page kept the texts of the files it read, is removed at
// the start of the page, so that no entry of Agent M outlives a clear there (A CLEAR IS A REAL CLEAR); other caches stay. It is
// no setting and no part of MOD-browser-store's store (its Files: localStorage and sessionStorage): only this live app, which
// once kept it, removes it. The start fails while an available Cache Storage still holds it.
async function retireFileTexts() {
  const cacheStorage = globalThis.caches;
  if (!cacheStorage) return;
  await cacheStorage.delete("agent-m-file-texts");
  if (await cacheStorage.has("agent-m-file-texts")) throw new Error("Could not remove retired CacheStorage agent-m-file-texts.");
}

async function start() {
  T = deriveTarget(location);
  T.product = T.product || productOf(`https://github.com/${T.repo}`);
  GITLAB = isGitLab(T.product);
  SERVER = GITLAB ? T.product.host : "GitHub";
  store = openStore(T.instance);
  tokenNotices = noticePlace();
  currentHost();
  await retireFileTexts();
  startNotifications(); // UC-047: the review pages start the checks, with MOD-browser-store's store of the instance
  app = context();
  // The menu of docs/index.html's header folds behind its button on a narrow screen, as the main page's does (foldMenu); a page whose menu
  // stands in no header has none to fold.
  const tabs = document.getElementById("tabs");
  if (tabs?.parentNode) tabs.parentNode.insertBefore(foldMenu(tabs), tabs);
  available = renderTabs();
  loadProducts();
  renderProductSelector();
  const early = /^#(settings|add(?:-product)?|setup|get-your-own)/.test(location.hash);
  if (early) {
    addEventListener("hashchange", route);
    route();
  }
  try {
    await loadSnapshot();
    document.getElementById("repo-line").innerHTML =
      `<a href="${h(T.product.address)}" target="_blank" rel="noopener">${h(GITLAB ? T.product.address : T.repo)}</a> · ${h(T.ref)} · <code>${h(state.commit.slice(0, 12))}</code>`;
  } catch (e) {
    noteRefusal(e);
    state.loadError = e;
    if (early) return;
    main().innerHTML = loadErrorHtml({ error: e, product: T.product, ref: T.ref, hasToken: Boolean(token()) });
    addEventListener("hashchange", route);
    return;
  }
  if (!early) { addEventListener("hashchange", route); route(); }
  // The bar is started once the load has read the instance, so that it reads through what this load holds.
  startBar();
}

// The prompt bar on every review page (UC-049 step 1: "On every page of the dashboard"), in a footer of its own fixed to the bottom of the window, as startPage attaches
// it on the main page: this browser's endpoints and the instance's participants, the instance read through the host that follows the store, the product shown unless it is the
// instance itself, and the subject of what the page shows.
function startBar() {
  const foot = document.createElement("footer");
  foot.className = "site-frame-prompt-bar";
  document.body.append(foot);
  const barStore = openStore(T.instance);
  const isInstance = () => { const address = parseAddress(T.product.address); return address.server === "github" && address.path === T.instance; };
  attachPromptBar(foot, { page: "review", store: barStore,
    // The instance shown is read through the app's own host, which holds what this load read; another instance through the host that follows the store.
    instance: { repository: T.instance, host: isInstance() ? pagesHost() : instanceHostFollowingStore({ store: barStore, address: parseAddress(`https://github.com/${T.instance}`) }) },
    product: () => (isInstance() ? null : { address: T.product.address, host: pagesHost() }),
    subject: barSubject,
    // The snapshot this load read, where the product shown is the instance and no other branch than its default is named (?ref=): the bar reads no commit and no tree
    // again (A PAGE LOAD READS THE REPOSITORY IN BATCHES).
    instanceSnapshot: () => (isInstance() && !new URLSearchParams(location.search).get("ref") && snapshot && snapshotHost === currentHost() ? snapshot : null),
    explain,
    go: (name, given = {}) => { location.hash = fragmentOf(name, given); } });
}

// The subject of what the page shows (MOD-site-frame's subjectOf): a review route's own, with the review pages' context; for any other page, the default subject of
// the menu entry of the page shown — for a route of a loaded view, the entry its `entryShown` gives, else its `entry` (markTab) —, keyed by the fragment.
function barSubject() {
  const [kind, a, b] = location.hash.replace(/^#/, "").split("/");
  const context = reviewContext();
  const drawn = () => main()?.textContent ?? "";
  const targets = reviewTargets(kind, a, b);
  const route = targets?.length ? reviewPages.routes.find((candidate) => candidate.name === targets[0].name) : null;
  if (route) return subjectOf({ route, params: targets[0].params, context, drawn });
  if (kind === "spec" && !a && specificationShown) {
    const trace = tracePages.routes.find((candidate) => candidate.name === "trace");
    return subjectOf({ route: trace, params: specificationShown.params, context: specificationShown.context, drawn });
  }
  const params = routeOf(location.hash).params;
  const loadedShown = loadedRoute(kind);
  const entry = loadedShown ? MENU.find((candidate) => candidate.key === entryShownOf(loadedShown, params))
    : MENU.find((candidate) => candidate.key === (kind || "uc") || candidate.views.includes(kind || "uc"));
  return subjectOf({ route: { name: kind || "uc", title: entry?.label ?? document.title, entry: entry?.key ?? null }, params, context, drawn });
}

if (globalThis.document) start();
