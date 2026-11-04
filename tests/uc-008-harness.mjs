// The harness of the system and release tests of UC-008 (Review and accept a use case): the page is MOD-site-frame's real review page (`open`), or the real route `use-case` of MOD-review-pages alone (`draw`), drawn into the fixture DOM over the real MOD-repository-hosts host
// (GitHub's adapter, or GitLab's) of the product, and over the real MOD-approvals, MOD-documents, MOD-job-runner, MOD-runtimes and MOD-work-plans. The servers are fixtures, in memory: GitHub's API and raw host
// (tests/app-harness.mjs' repoServer, with the deletion of a file added), a GitLab server's REST API v4 of this file's own, and one model endpoint; the global `fetch` is replaced by a router that answers them and
// refuses any other origin, so nothing reaches the network. Every request that writes is recorded with the token it carries. A person's click is the page's own listener called with a trusted event, a script's
// click one made by `scripted()`. It holds no test and no expected result: what it builds are inputs, and every test states its own expected values.
// Imported by tests/system-uc-008-review-and-accept-a-use-case.test.mjs and tests/release-uc-008-review-and-accept-a-use-case.test.mjs.
//
// Module: MOD-review-pages
// Module: MOD-approvals
// Level: system
//
// Authored by developer-sonnet-j (ITM-372), who implemented none of ITM-333, ITM-334, ITM-342, ITM-355, ITM-356, ITM-358, ITM-1266, ITM-1267, ITM-1319 or ITM-1323 and no UC-008 production behaviour.
//
// The product (`THESIS`, alice/thesis-tool) holds the SPEC with one requirement and the use cases UC-041 and UC-044 (never accepted: open), UC-042 (a record names its current text: accepted) and UC-043 (a record names
// an earlier text: changed since acceptance). The instance (akmaier/agent-m) holds the participant list, AGENTS.md and the shipped models. A world is built by `world({ ... })`; several worlds may stand in one test, and a
// world installs its own network and browser storage whenever one of its pages is drawn.

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { byClass, buttonsNamed, find, openStore, writeSetting, until } from "./review-pages-draft-world.mjs";
import { repoServer } from "./app-harness.mjs";
import { connect, parseAddress } from "../src/repository-hosts/index.mjs";
import { registerStrategies } from "../src/job-runner/index.mjs";
import { workStrategies } from "../src/work-plans/index.mjs";
import { view } from "../src/review-pages/index.mjs";

export { byClass, buttonsNamed, find, until };
export const text = (...lines) => `${lines.join("\n")}\n`;
/** The git blob SHA of a text, as GitHub and GitLab name it. */
export const blobOf = (body) => createHash("sha1").update(`blob ${Buffer.byteLength(body)}\0${body}`).digest("hex");
const ROOT = new URL("../", import.meta.url);
const onDisk = (path) => readFileSync(new URL(path, ROOT), "utf8");

// The strategies as the frame registers them at load: this view's, and MOD-work-plans', whose check, step and writer the kind check-affected-modules names.
[...(view.strategies ?? []), workStrategies].forEach((strategies, at) => registerStrategies(`tests/uc-008-harness.mjs#${at}`, strategies));

// ---------------------------------------------------------------- the product's files

export const SPEC = text("# Thesis tool — Specification", "", "## Lending", "", "**A LOAN HAS A DUE DATE** *(Product Owner)*", "Every loan states the date by which the book is returned.", "*Check:* `tests/loan.test.mjs`");
export const useCase = (id, title, sentence, extra = []) => text("---", `id: ${id}`, `title: ${title}`, "area: lending", "actors:", "  - Member", "realises:", "  - A LOAN HAS A DUE DATE", "---",
  `# ${id} ${title}`, "", `**Goal.** ${sentence}`, ...extra);
const DIAGRAM = ["", "```mermaid", "sequenceDiagram", "    Member->>Desk: borrow", "```"];
export const P41 = "docs/use-cases/UC-041-check-out-a-book.md", P42 = "docs/use-cases/UC-042-extend-a-loan.md", P43 = "docs/use-cases/UC-043-return-a-book.md", P44 = "docs/use-cases/UC-044-reserve-a-book.md";
export const UC41 = useCase("UC-041", "Check out a book", "The member borrows a book at the desk.", DIAGRAM);
export const UC42 = useCase("UC-042", "Extend a loan", "The member extends a loan once.");
export const UC43_OLD = useCase("UC-043", "Return a book", "The member returns a book at the desk.");
export const UC43 = useCase("UC-043", "Return a book", "The member returns a book and the card at the desk.");
export const UC44 = useCase("UC-044", "Reserve a book", "The member reserves a book that is out.");
export const UC44_EDITED = useCase("UC-044", "Reserve a book", "The member reserves a book that is out, for a week.");

/** record(id, path, body) -> [the record's path, its text] — the approval record that names `body` as the text of `path`. */
export const record = (id, path, body) => [`docs/approvals/${id}-${blobOf(body).slice(0, 12)}.md`, text("kind: use-case", `file: ${path}`, `blob: ${blobOf(body)}`)];

const MODEL_FILES = { scrum: "src/model-catalogue/models/scrum.md", "v-model": "src/model-catalogue/models/v-model.md" };
const declaring = (model, commit) => text("---", `model: ${model}`, `model_file: ${MODEL_FILES[model]}`, `model_version: ${commit}`, "---", "# How the thesis tool is developed", "", "## Practices", "", "- none",
  "", "## Definition of Done", "", "The job rules hold.");
const SHELF_MODULE = text("---", "id: MOD-shelf", "title: Shelving a book", "folder: src/shelf/", "realises:", "  - A LOAN HAS A DUE DATE", "follows:", "  - ARC-001", "uses:", "provides:", "  - shelve", "---",
  "# MOD-shelf Shelving a book", "", "## Responsibility", "", "It shelves a book.", "", "## Parts", "", "- `index.mjs`", "", "## Data", "", "Nothing.", "", "## Interfaces", "", "- `shelve`", "", "## Files", "", "None.", "",
  "## Uses", "", "Nothing.");
const READER_MODULE = SHELF_MODULE.replaceAll("MOD-shelf", "MOD-reader").replace("src/shelf/", "src/reader/").replace("Shelving a book", "Reading a book").replace("shelve", "lend");
export const ARCHITECTURE = { "docs/architecture/MOD-shelf.md": SHELF_MODULE, "docs/architecture/MOD-reader.md": READER_MODULE };
export const backlogItem = (id, module) => text("---", `id: ${id}`, "title: Work on a module", "level: module", "realises:", "  - UC-042", "modules:", `  - ${module}`, "builds_on: []", "tests:", "  - unit", "origin:", "  - UC-042", "---",
  `# ${id} Work on a module`, "", "## Outcome", "", "The module does it.", "", "## Acceptance", "", "- unit tests.");

/** The files of the product at the start of a world: the use cases, their records, the SPEC. */
export const THESIS = () => ({ "README.md": "# Thesis tool\n", "SPEC.md": SPEC, [P41]: UC41, [P42]: UC42, [P43]: UC43, [P44]: UC44,
  ...Object.fromEntries([record("UC-042", P42, UC42), record("UC-043", P43, UC43_OLD)]) });

// ---------------------------------------------------------------- the servers

export const TOKENS = { github: { value: "github_pat_ALICEthesisTOOL0123456789abcdef", name: "github.com/alice", expires: "2027-01-01" },
  gitlab: { value: "glpat-ALICEthesisTOOL0123456789abcd", name: "gitlab.example.org/alice", expires: "2027-01-01" }, instance: { value: "github_pat_INSTANCEtoken0123456789abcdef", name: "github.com/akmaier", expires: "2027-01-01" } };
export const ADDRESSES = { github: "https://github.com/alice/thesis-tool", gitlab: "https://gitlab.example.org/team/product" };
const INSTANCE = "akmaier/agent-m", PRODUCT = "alice/thesis-tool", ACCOUNT = "alice", COMMITTED = "2026-11-01T10:00:00Z";
const INSTANCE_HEAD = "1a2b3c".padEnd(40, "0"), PRODUCT_HEAD = "9f8e7d".padEnd(40, "0");
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const gone = () => new Response('{"message":"Not Found"}', { status: 404 });

/**
 * gitlabServer({ files, token }) -> { fetch, files(), writes, head() } — a GitLab server's REST API v4 for the project team/product: the project, its default branch, the tree and the files of a commit, the commit
 * of many files ("Create a commit with multiple files and actions"), and the commits that changed a path. A request that writes is recorded with the PRIVATE-TOKEN it carries; a write without the token of the
 * project is refused 401.
 */
function gitlabServer({ files, token }) {
  const commits = new Map(), writes = [];
  let made = 0, head = null;
  const commitOf = (tree, parent, message = "initial") => { const id = createHash("sha1").update(`gitlab commit ${++made}`).digest("hex"); commits.set(id, { tree, parent, message }); head = id; return id; };
  commitOf(new Map(Object.entries(files)), null);
  const treeOf = (ref) => commits.get(ref === "main" ? head : ref)?.tree;
  const lastChange = (path) => { for (let id = head; id; id = commits.get(id).parent) { const here = commits.get(id), before = here.parent ? commits.get(here.parent).tree.get(path) : undefined; if (here.tree.get(path) !== before) return id; } return head; };
  const api = "/api/v4/projects/team%2Fproduct";
  const fetchMock = async (input, init = {}) => {
    const url = new URL(String(input)), method = (init.method ?? "GET").toUpperCase(), p = url.pathname, sent = init.headers?.["PRIVATE-TOKEN"] ?? null;
    if (!p.startsWith(api)) return gone();
    const rest = p.slice(api.length);
    if (method !== "GET") {
      if (sent !== token) return json({ message: "401 Unauthorized" }, 401);
      if (rest === "/repository/commits") {
        const body = JSON.parse(init.body), tree = new Map(treeOf(body.branch));
        for (const action of body.actions) { if (action.action === "delete") tree.delete(action.file_path); else tree.set(action.file_path, action.content); }
        writes.push({ message: body.commit_message, token: sent, actions: body.actions.map((action) => ({ action: action.action, path: action.file_path })), files: Object.fromEntries(body.actions.filter((action) => action.action !== "delete").map((action) => [action.file_path, action.content])) });
        const id = commitOf(tree, head, body.commit_message);
        return json({ id, web_url: `https://gitlab.example.org/team/product/-/commit/${id}` }, 201);
      }
      return json({}, 404);
    }
    if (rest === "") return json({ default_branch: "main", visibility: "public", archived: false, description: "", permissions: { project_access: { access_level: sent === token ? 40 : 0 } } });
    if (rest === "/repository/branches/main") return json({ name: "main", commit: { id: head } });
    const commit = /^\/repository\/commits\/([^/]+)$/.exec(rest);
    if (commit) return commit[1] === "main" || commits.has(commit[1]) ? json({ id: commit[1] === "main" ? head : commit[1] }) : gone();
    if (rest === "/repository/tree") {
      const tree = treeOf(url.searchParams.get("ref")), page = Number(url.searchParams.get("page") ?? 1);
      return json(page === 1 ? [...tree].map(([path, body]) => ({ type: "blob", path, id: blobOf(body) })) : []);
    }
    const file = /^\/repository\/files\/([^/]+?)(\/raw)?$/.exec(rest);
    if (file) {
      const path = decodeURIComponent(file[1]), tree = treeOf(url.searchParams.get("ref"));
      if (!tree?.has(path)) return gone();
      return file[2] ? new Response(tree.get(path), { status: 200 }) : json({ file_path: path, last_commit_id: lastChange(path) });
    }
    if (rest === "/repository/commits") return json([]);
    return gone();
  };
  return { fetch: fetchMock, writes, head: () => head, files: () => Object.fromEntries(commits.get(head).tree) };
}

/** A merged pull request that names the item `id`, as GitHub's list of pull requests gives it. */
export const mergedPull = (id, number) => ({ number, title: `${id}: the work of ${id}`, branch: `work/${id}`, merged: "2026-10-13T09:00:00Z" });
const githubPull = (p) => ({ number: p.number, title: p.title, head: { ref: p.branch, sha: "a".repeat(40) }, base: { ref: "main" }, state: "closed", merged_at: p.merged, merge_commit_sha: "f".repeat(40),
  created_at: "2026-10-13T08:00:00Z", updated_at: p.merged, closed_at: p.merged, draft: false, html_url: `https://github.com/${PRODUCT}/pull/${p.number}`, body: "" });

// ---------------------------------------------------------------- the world

/**
 * world({ server, token, files, history, dates, model, answers, denyWrites, private, pulls }) -> a product behind fixture servers, drawn by `draw` (one route) or `open` (the dashboard's page).
 *   server    "github" (default) or "gitlab"; the product is alice/thesis-tool on GitHub, team/product on gitlab.example.org.
 *   token     whether this browser stores the product's token (default true); the instance's own token is stored in every world and is no token of the product.
 *   files     files laid over THESIS(); a path set to null is left out. history: earlier texts that approval records name; dates: the day a record was committed, by its path.
 *   pulls     merged pull requests (mergedPull) GitHub lists.
 *   model     "scrum" (pulled) or "v-model" (planned): the product declares it in docs/process.md; the instance holds the shipped models. Default: no declaration.
 *   answers   the items the checking participant (endpoint ep1, at "this machine") answers, whatever it is sent: [{ module, realises }]; `asked` counts its requests.
 *   denyWrites  the repository reports no push permission and GitHub refuses every write of a commit with 403, as it refuses a token that may not write.
 *   private    a token value: GitHub answers every read that does not carry it 404, as it answers a private repository.
 */
export async function world({ server = "github", token = true, files = {}, history = [], dates = {}, model = null, answers = [], denyWrites = false, private: hidden = false, pulls = [] } = {}) {
  const kind = server, address = ADDRESSES[kind];
  const base = { ...THESIS(), ...(model ? { "docs/process.md": declaring(model, INSTANCE_HEAD), ...ARCHITECTURE } : {}), ...files };
  for (const path of Object.keys(base)) if (base[path] === null) delete base[path];
  const log = [], accepts = [], asked = { endpoint: 0, bodies: [] }, deletions = { byTree: new Map(), byCommit: new Map(), paths: [] };
  const github = kind === "github" ? await repoServer({ repo: PRODUCT, files: base, history: [UC43_OLD, ...history], dates, head: PRODUCT_HEAD }) : null;
  const gitlab = kind === "gitlab" ? gitlabServer({ files: base, token: TOKENS.gitlab.value }) : null;
  const header = onDisk("docs/participants.md").split("\n").filter((line, at, all) => at <= all.findIndex((each) => each.startsWith("|---"))).join("\n");
  const models = Object.fromEntries(Object.entries(MODEL_FILES).map(([name, path]) => [path, onDisk(path)]));
  const instance = await repoServer({ repo: INSTANCE, head: INSTANCE_HEAD, files: { "AGENTS.md": onDisk("AGENTS.md"), ...models,
    "docs/participants.md": `${header}\n| drafter-a | model endpoint | example-model | 200000 | - | draft text | this machine | endpoint ep1 |\n` } });
  const item = ({ module, realises }) => ({ title: `Do the work in ${module}`, outcome: `${module} does what the use case asks.`, realises: [realises], modules: [module], acceptance: [`unit tests of ${module}`] });
  const authorization = (init) => init?.headers?.Authorization ?? init?.headers?.authorization ?? init?.headers?.["PRIVATE-TOKEN"] ?? null;
  // GitHub knows no deletion in the git-data endpoints the fake serves: a tree entry whose sha is null is taken out of the request, and the file is deleted once the branch has moved on.
  const githubFetch = async (url, init, method) => {
    const isWrite = method !== "GET" && !(method === "POST" && url.pathname === "/graphql");
    if (isWrite) log.push({ method, path: url.pathname, authorization: authorization(init), body: typeof init.body === "string" ? JSON.parse(init.body) : null });
    if (isWrite && denyWrites) return json({ message: "Resource not accessible by personal access token" }, 403);
    if (hidden && authorization(init) !== `Bearer ${hidden}` && method === "GET") return gone();
    if (method === "GET" && url.pathname === `/repos/${PRODUCT}`) return json({ private: Boolean(hidden), default_branch: "main", permissions: { push: Boolean(authorization(init)) && !denyWrites } });
    if (method === "GET" && url.pathname === `/repos/${PRODUCT}/pulls`) return json(pulls.map(githubPull));
    // The commits that added approval records, as GitHub lists them for the folder docs/approvals: newest first, each by the account of the token that made it, with the day it was committed.
    if (method === "GET" && url.pathname === `/repos/${PRODUCT}/commits` && url.searchParams.get("path") === "docs/approvals") {
      return json([...accepts].reverse().map((each) => ({ sha: each.sha, parents: [], author: { login: ACCOUNT }, commit: { author: { name: "Alice" }, committer: { date: COMMITTED }, message: each.message } })));
    }
    const commitOfAccept = /^\/repos\/alice\/thesis-tool\/commits\/([0-9a-f]{40})$/.exec(url.pathname);
    if (method === "GET" && commitOfAccept && accepts.some((each) => each.sha === commitOfAccept[1])) {
      return json({ sha: commitOfAccept[1], files: accepts.find((each) => each.sha === commitOfAccept[1]).files.map((filename) => ({ filename, status: "added" })) });
    }
    if (method === "POST" && url.pathname === `/repos/${PRODUCT}/git/trees`) {
      const body = JSON.parse(init.body), removed = body.tree.filter((entry) => entry.sha === null).map((entry) => entry.path);
      if (removed.length === 0) return github.fetch(url, init);
      const made = await github.fetch(url, { ...init, body: JSON.stringify({ ...body, tree: body.tree.filter((entry) => entry.sha !== null) }) });
      deletions.byTree.set((await made.clone().json()).sha, removed);
      return made;
    }
    if (method === "POST" && url.pathname === `/repos/${PRODUCT}/git/commits`) {
      const made = await github.fetch(url, init), removed = deletions.byTree.get(JSON.parse(init.body).tree);
      if (removed) deletions.byCommit.set((await made.clone().json()).sha, removed);
      return made;
    }
    if (method === "PATCH" && url.pathname === `/repos/${PRODUCT}/git/refs/heads/main`) {
      const made = await github.fetch(url, init), removed = deletions.byCommit.get(JSON.parse(init.body).sha);
      if (removed && made.ok) { for (const path of removed) delete github.files[path]; github.writes.at(-1).deleted = removed; deletions.paths.push(...removed); }
      if (made.ok) {
        const written = github.writes.at(-1);
        accepts.push({ sha: JSON.parse(init.body).sha, files: Object.keys(written.files).filter((path) => path.startsWith("docs/approvals/")), message: written.message });
      }
      return made;
    }
    return github.fetch(url, init);
  };
  const router = async (input, init = {}) => {
    const url = new URL(String(input)), method = (init.method ?? "GET").toUpperCase();
    if (url.origin === "https://ep1.example.test") {
      asked.endpoint += 1;
      asked.bodies.push(JSON.parse(init.body));
      return json({ choices: [{ message: { content: JSON.stringify({ draft: { items: answers.map(item) }, answers: [] }) } }], usage: { prompt_tokens: 10, completion_tokens: 5 } });
    }
    if (url.origin === "https://gitlab.example.org") {
      if (!gitlab) return gone();
      if (method !== "GET") log.push({ method, path: url.pathname, authorization: authorization(init), body: typeof init.body === "string" ? JSON.parse(init.body) : null });
      return gitlab.fetch(url, { ...init, method });
    }
    const body = typeof init.body === "string" ? init.body : "";
    const isProduct = url.pathname.startsWith(`/repos/${PRODUCT}`) || url.pathname.startsWith(`/${PRODUCT}/`) || (url.pathname === "/graphql" && !body.includes(INSTANCE_HEAD));
    if (url.origin === "https://api.github.com" || url.origin === "https://raw.githubusercontent.com") {
      if (isProduct && github) return githubFetch(url, { ...init, method }, method);
      return instance.fetch(url, { ...init, method });
    }
    outside.push(url.href);
    throw new TypeError(`the test's network refuses ${url.href}`);
  };
  const outside = [];
  let pending = 0;
  // Until no request has been in flight for a few turns: the page, the frame and the prompt bar have drawn what they read.
  const quiet = async () => { for (let calm = 0; calm < 6;) { await new Promise((resolve) => setTimeout(resolve, 5)); calm = pending === 0 ? calm + 1 : 0; } };
  const routed = async (input, init) => { pending += 1; try { return await router(input, init); } finally { pending -= 1; } };
  // The browser's store: the instance's own token, the product's if `token`, and the endpoint ep1.
  const kept = new Map();
  const storage = { getItem: (k) => (kept.has(k) ? kept.get(k) : null), setItem: (k, v) => { kept.set(k, String(v)); }, removeItem: (k) => { kept.delete(k); }, key: (i) => [...kept.keys()][i] ?? null, get length() { return kept.size; } };
  // The browser and the network of this world: installed when the world is built and again whenever a page of it is drawn, since several worlds may stand in one test.
  const install = () => { globalThis.fetch = routed; globalThis.localStorage = storage; };
  install();
  const store = openStore(INSTANCE);
  writeSetting(store, "github-token", TOKENS.instance);
  if (token) writeSetting(store, kind === "github" ? `github-token:${PRODUCT}` : "gitlab-token:gitlab.example.org/team/product", TOKENS[kind]);
  writeSetting(store, "endpoint:ep1", { url: "https://ep1.example.test/v1", kind: "openai-compatible", model: "example-model" });
  const productHost = connect(parseAddress(address), token ? { token: TOKENS[kind].value, tokenName: TOKENS[kind].name } : {});
  const instanceHostObject = connect(parseAddress(`https://github.com/${INSTANCE}`), { token: TOKENS.instance.value, tokenName: TOKENS.instance.name });
  const route = (name) => view.routes.find((candidate) => candidate.name === name);
  const went = [];
  const context = { page: "review", instance: { repository: INSTANCE, host: instanceHostObject }, store, go(...where) { went.push(where); }, went,
    product: { address, kind, host: productHost, tokenStored: Boolean(token) } };
  const self = {
    address, kind, context, went, log, asked, outside, store, host: productHost, quiet,
    /** The route `name` (default `use-case`) drawn with `params` into a fresh target; -> the target. */
    async draw(params = {}, name = "use-case") {
      install();
      const target = document.createElement("div");
      document.body.append(target);
      await route(name).render(target, context, params);
      return target;
    },
    /**
     * open(fragment) -> { target, select, go } — the dashboard's own page, MOD-site-frame's `startPage` on the review page, over the same servers and this browser's store: the product is chosen by
     * the fragment (`#use-case/product=<address>`) or by the frame's selector, and the frame draws the route of the fragment.
     */
    async open(fragment = `#use-case/product=${encodeURIComponent(address)}`) {
      install();
      const events = new EventTarget();
      let current = fragment;
      const location = { hostname: "akmaier.github.io", host: "akmaier.github.io", protocol: "https:", pathname: "/agent-m/docs/index.html",
        get hash() { return current; }, set hash(value) { current = value; queueMicrotask(() => events.dispatchEvent(new Event("hashchange"))); } };
      Object.defineProperty(globalThis, "location", { configurable: true, value: location });
      Object.assign(globalThis.window, { addEventListener: events.addEventListener.bind(events), dispatchEvent: events.dispatchEvent.bind(events) });
      globalThis.setInterval = () => 1;
      writeSetting(store, "products", [address]);
      const { startPage } = await import("../src/site-frame/index.mjs");
      await startPage({ page: "review", views: [view], menuViews: [] });
      await quiet();
      const page = { location, target: find(document.body, (node) => node.localName === "main")[0], select: find(document.body, (node) => node.localName === "select" && node.className === "product")[0],
        async go(next) { location.hash = next; await quiet(); } };
      return page;
    },
    /** Another writer's commit on the default branch: each path of `changed` gets its text. */
    async land(changed) {
      if (github) for (const [path, body] of Object.entries(changed)) await github.change(path, body);
      else throw new Error("land is for a GitHub world");
    },
    files: () => (github ? { ...github.files } : gitlab.files()),
    /** Every commit that was written to the product: { message, files } (GitHub) or { message, token, files } (GitLab); a deletion lists its paths in `deleted`. */
    writes: () => (github ? github.writes.map((write) => ({ ...write })) : gitlab.writes.map((write) => ({ message: write.message, files: write.files, token: write.token, deleted: write.actions.filter((a) => a.action === "delete").map((a) => a.path) }))),
    head: () => (github ? github.head : gitlab.head()),
    /** The requests that wrote, with the authorisation each carried. */
    writers: () => log.filter((entry) => entry.method !== "GET"),
    requests: () => (github ? [...github.requests] : []),
  };
  return self;
}

// ---------------------------------------------------------------- reading and clicking the page

export const rowOf = (target, id) => find(target, (node) => node.localName === "tr" && node.getAttribute("data-id") === id)[0];
export const badgeOf = (node) => (node ? byClass(node, "span", "badge")[0]?.textContent : undefined);
/** The address `href` of a link a route writes, with the product the page shows named in it. */
export const withProduct = (href, address) => `${href}/product=${encodeURIComponent(address)}`;
export const idsIn = (root) => find(root, (node) => node.localName === "tr" && node.getAttribute("data-id")).map((row) => row.getAttribute("data-id"));
export const tickOf = (target, id) => byClass(rowOf(target, id), "input", "tick")[0];
export const tick = (box, on = true) => { box.checked = on; box.dispatchEvent(new Event("change")); };
/** A click the browser marks as a person's (the review pages' harness marks every event it dispatches as trusted, except `scripted()`'s). */
export const click = (node) => node.dispatchEvent(new Event("click"));
export { scripted } from "./review-pages-harness.mjs";
export const pageText = (target) => target.textContent;
export const linksOf = (target) => find(target, (node) => node.localName === "a");
export const areaOf = (target) => find(target, (node) => node.localName === "textarea" && !node.className.split(" ").includes("reject-reason"))[0];
export const saveButton = (target) => buttonsNamed(target, "Save")[0];
export const typeInto = (area, body) => { area.value = body; area.dispatchEvent(new Event("input")); };
export const reasonField = (target) => byClass(target, "textarea", "reject-reason")[0];
/** The front-matter list `key` of a committed file. */
export const listOf = (body, key) => (new RegExp(`^${key}:\\n((?:  - .*\\n)*)`, "m").exec(body)?.[1] ?? "").split("\n").filter(Boolean).map((line) => line.slice(4));
