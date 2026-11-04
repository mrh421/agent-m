// The harness of the system and release tests of UC-018 (Edit a specification or a use case in the dashboard): the real routes of MOD-review-pages that edit — a use case's `use-case/id=<id>/edit=1`, a
// requirement's `requirement/name=<name>`, a new requirement's `requirements/section=<heading>` and an open SPEC entry's `spec-entry/id=<id>/edit=1` — and the specification view of MOD-trace-pages that leads to them,
// drawn into the fixture DOM over the real MOD-repository-hosts host of GitHub, MOD-spec-changes, MOD-artifact-edits, MOD-markdown-render and MOD-trace-graph. A use case is edited in tests/uc-008-harness.mjs'
// world (GitHub, or a GitLab server), imported unchanged; a requirement in this file's `specWorld`: tests/app-harness.mjs' repoServer for the product alice/library, with the history of a path answered as GitHub
// answers it — each commit that changed the path, newest first, by the account that made it, with the files it changed —, so that MOD-spec-changes finds the person who created a queue as on GitHub. The global
// `fetch` is replaced by a router that refuses any other origin, so nothing reaches the network. It holds no test and no expected result: what it builds are inputs, and every test states its own expected values.
// Imported by tests/system-uc-018-edit-a-specification-or-use-case.test.mjs and tests/release-uc-018-edit-a-specification-or-use-case.test.mjs.
//
// Module: MOD-review-pages
// Module: MOD-spec-changes
// Module: MOD-artifact-edits
// Module: MOD-trace-pages
// Level: system
//
// Authored by developer-opus-e (ITM-376). The product of `specWorld` (alice/library) holds a SPEC of two sections — "## 1. Lending" with A LOAN HAS A DUE DATE and A BOOK IS SHELVED, "## 2. Membership" with
// A MEMBER HAS A CARD —, the use case UC-001 that realises A LOAN HAS A DUE DATE, complete with its five sections and a Mermaid diagram, and the group file of the requirements. Its token is stored as the
// settings page stores a product's token, with the name "Agent M · library"; GitHub writes every commit made with it under the account alice.

import "./review-pages-harness.mjs";
import { createHash } from "node:crypto";
import { repoServer } from "./app-harness.mjs";
import { byClass, buttonsNamed, find, openStore, writeSetting, until } from "./review-pages-draft-world.mjs";
import { connect, parseAddress } from "../src/repository-hosts/index.mjs";
import { view } from "../src/review-pages/index.mjs";
import { view as traceView } from "../src/trace-pages/index.mjs";

export { byClass, buttonsNamed, find, until };
export { scripted } from "./review-pages-harness.mjs";
export const text = (...lines) => `${lines.join("\n")}\n`;
/** The git blob SHA of a text, as GitHub names it. */
export const blobOf = (body) => createHash("sha1").update(`blob ${Buffer.byteLength(body)}\0${body}`).digest("hex");
/** The day a queue started today is named by, as MOD-spec-changes names it: the UTC date of the save. */
export const today = () => new Date().toISOString().slice(0, 10);

// ---------------------------------------------------------------- a complete use case, for either world

/** A use case with its five sections and a Mermaid diagram, realising `realises`; `drop` names a section heading left out. */
export const fullUseCase = (id, title, realises, { drop = null, goal = "The member borrows a book at the desk." } = {}) => text("---", `id: ${id}`, `title: ${title}`, "area: lending", "actors:", "  - Member",
  "realises:", ...realises.map((name) => `  - ${name}`), "---", `# ${id} ${title}`, "", `**Goal.** ${goal}`, "",
  ...[["## Actors", "- **Member** — borrows books."], ["## Precondition", "- The member holds a card."], ["## Main flow", "1. The member brings a book to the desk.", "2. The desk lends it."],
    ["## Alternative flows", "- **2a. The book is reserved.** The desk says so."], ["## Postcondition", "- The loan is recorded."]]
    .filter(([heading]) => heading !== drop).flatMap((part) => [...part, ""]),
  "```mermaid", "sequenceDiagram", "    Member->>Desk: borrow", "```");

// ---------------------------------------------------------------- the library's SPEC

export const LOAN = "A LOAN HAS A DUE DATE", SHELF = "A BOOK IS SHELVED", CARD = "A MEMBER HAS A CARD";
export const LENDING_HEADING = "## 1. Lending", MEMBERSHIP_HEADING = "## 2. Membership";
export const LENDING = text(LENDING_HEADING, "", `**${LOAN}** *(Product Owner)*`, "Every loan states the date by which the book is returned.", "*Check:* `tests/loan.test.mjs`", "",
  `**${SHELF}** *(Product Owner)*`, "Every book stands on one shelf.", "*Check:* `tests/shelf.test.mjs`", "");
export const MEMBERSHIP = text(MEMBERSHIP_HEADING, "", `**${CARD}** *(Product Owner)*`, "Every member holds a card.", "*Check:* `tests/card.test.mjs`");
export const SPEC_HEAD = text("# Library — Specification", "");
export const LIBRARY_SPEC = SPEC_HEAD + LENDING + MEMBERSHIP;
export const UC1_PATH = "docs/use-cases/UC-001-check-out-a-book.md";
export const UC1 = fullUseCase("UC-001", "Check out a book", [LOAN]);
export const GROUPS_PATH = "docs/groups/requirements.md";
export const GROUPS = text("- Lending", `  - ${LOAN}`, `  - ${SHELF}`, "- Membership", `  - ${CARD}`);
export const LIBRARY = () => ({ "README.md": "# Library\n", "SPEC.md": LIBRARY_SPEC, [UC1_PATH]: UC1, [GROUPS_PATH]: GROUPS });

/**
 * queueFiles(folder, entries) -> the files of a change queue `docs/spec-freigaben/<folder>`: its index, its decisions and, for each entry { nr, anchor, proposal }, its proposal and rationale. An entry with
 * `inSpec` has a decision row `uebernommen`.
 */
export function queueFiles(folder, entries) {
  const base = `docs/spec-freigaben/${folder}`, pad = (n) => String(n).padStart(2, "0");
  const files = {
    [`${base}/index.md`]: text(`# SPEC approvals — queue ${folder.slice(0, 10)} · fixture`, "", "**Zieldatei aller Einträge:** `SPEC.md`", "", "| Nr | Datei | Anker (Überschrift, wortgetreu) | bis (exklusiv) | Commits |",
      "|---|---|---|---|---|", ...entries.map((each) => `| ${pad(each.nr)} | \`SPEC.md\` | ${each.anchor} | — | — |`)),
    [`${base}/entscheidungen.md`]: text(`# Decisions — queue ${folder} fixture`, "", "Append-only.", "",
      ...entries.filter((each) => each.inSpec).map((each) => `| 2026-10-01 10:00 UTC | ${each.nr} | uebernommen | approval:spec-${folder}-${pad(each.nr)}-aaaaaaaaaaaa.md |`)),
  };
  for (const each of entries) {
    files[`${base}/${pad(each.nr)}-entry.md`] = each.proposal;
    files[`${base}/${pad(each.nr)}-entry.begruendung.md`] = text(`# ${each.anchor.replace(/^#+ /, "")}: a fixture change`, "", "**The change.** Changes the section.", "", "**Why.** A fixture reason.", "",
      "**Impact list.**", "- no requirement of the section changes.", "", "**Origin.** the dashboard; saved by bob.");
  }
  return files;
}

// ---------------------------------------------------------------- the requirement's world

export const LIBRARY_ADDRESS = "https://github.com/alice/library";
export const SPEC_TOKEN = { value: "github_pat_ALICElibrary0123456789abcdefgh", name: "Agent M · library", expires: "2027-01-01" };
const INSTANCE_TOKEN = { value: "github_pat_INSTANCEtoken0123456789abcdef", name: "Agent M", expires: "2027-01-01" };
const PRODUCT = "alice/library", INSTANCE = "akmaier/agent-m", ACCOUNT = "alice";
const PRODUCT_HEAD = "5eed00".padEnd(40, "0"), INSTANCE_HEAD = "1a2b3c".padEnd(40, "0");
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

/**
 * specWorld({ token, files, authors, denyWrites, refuseWrites }) -> the library on GitHub behind fixture servers, drawn by `draw` (a route of the review pages) or `trace` (the specification view).
 *   token         whether this browser stores the product's token (default true); the instance's own token is stored in every world and is no token of the product.
 *   files         laid over LIBRARY(); a path set to null is left out.
 *   authors       the account of the commit that added a path of `files`, by its path (default: the account seed); GitHub's history of that path names it.
 *   denyWrites    the repository reports no push permission and GitHub refuses every write of a commit with 403, as it refuses a token that may not write.
 *   refuseWrites  the repository reports the push permission, and GitHub still refuses every write of a commit with 403: the refusal comes only with the commit.
 */
export async function specWorld({ token = true, files = {}, authors = {}, denyWrites = false, refuseWrites = false } = {}) {
  const base = { ...LIBRARY(), ...files };
  for (const path of Object.keys(base)) if (base[path] === null) delete base[path];
  const srv = await repoServer({ repo: PRODUCT, files: base, head: PRODUCT_HEAD });
  const instance = await repoServer({ repo: INSTANCE, head: INSTANCE_HEAD, files: { "README.md": "# Agent M\n" } });
  // The commits of the product, newest last: { sha, account, date, files: [{ filename, status }] }. The first holds every file; a path of `authors` is added by a commit of its own, by that account.
  const commits = [{ sha: PRODUCT_HEAD, account: "seed", date: "2026-10-01T09:00:00Z", files: Object.keys(base).filter((path) => !(path in authors)).map((filename) => ({ filename, status: "added" })) }];
  Object.entries(authors).forEach(([path, account], at) => commits.push({ sha: `a${String(at).padStart(5, "0")}`.padEnd(40, "0"), account, date: "2026-10-01T10:00:00Z", files: [{ filename: path, status: "added" }] }));
  const log = [], outside = [];
  const authorization = (init) => init?.headers?.Authorization ?? init?.headers?.authorization ?? null;
  const api = `/repos/${PRODUCT}`;
  const productFetch = async (url, init, method) => {
    const isWrite = method !== "GET" && !(method === "POST" && url.pathname === "/graphql");
    if (isWrite) log.push({ method, path: url.pathname, authorization: authorization(init) });
    if (isWrite && (denyWrites || refuseWrites)) return json({ message: "Resource not accessible by personal access token" }, 403);
    if (method === "GET" && url.pathname === api) return json({ private: false, default_branch: "main", permissions: { push: Boolean(authorization(init)) && !denyWrites } });
    // GitHub's "List commits" of a path: the commits that changed it, newest first, each by the account of the token that made it.
    if (method === "GET" && url.pathname === `${api}/commits` && url.searchParams.has("path")) {
      const path = url.searchParams.get("path"), page = Number(url.searchParams.get("page") ?? "1");
      const touching = commits.filter((each) => each.files.some((file) => file.filename === path)).reverse();
      return json(page === 1 ? touching.map((each) => ({ sha: each.sha, parents: [], author: { login: each.account }, commit: { author: { name: each.account }, committer: { date: each.date }, message: "a commit" } })) : []);
    }
    // GitHub's "Get a commit" with its files, for a commit this world logged.
    const one = new RegExp(`^${api}/commits/([0-9a-f]{40})$`).exec(url.pathname);
    if (method === "GET" && one && url.searchParams.has("per_page") && commits.some((each) => each.sha === one[1])) {
      const page = Number(url.searchParams.get("page") ?? "1");
      return json({ sha: one[1], files: page === 1 ? commits.find((each) => each.sha === one[1]).files : [] });
    }
    if (method === "PATCH" && url.pathname === `${api}/git/refs/heads/main`) {
      const before = new Set(Object.keys(srv.files));
      const made = await srv.fetch(url, init);
      if (made.ok) commits.push({ sha: srv.head, account: ACCOUNT, date: new Date().toISOString(), files: Object.keys(srv.writes.at(-1).files).map((filename) => ({ filename, status: before.has(filename) ? "modified" : "added" })) });
      return made;
    }
    return srv.fetch(url, init);
  };
  const router = async (input, init = {}) => {
    const url = new URL(String(input)), method = (init.method ?? "GET").toUpperCase(), body = typeof init.body === "string" ? init.body : "";
    if (url.origin !== "https://api.github.com" && url.origin !== "https://raw.githubusercontent.com") { outside.push(url.href); throw new TypeError(`the test's network refuses ${url.href}`); }
    const ofInstance = url.pathname.startsWith(`/repos/${INSTANCE}`) || url.pathname.startsWith(`/${INSTANCE}/`) || (url.pathname === "/graphql" && body.includes(INSTANCE_HEAD));
    return ofInstance ? instance.fetch(url, { ...init, method }) : productFetch(url, { ...init, method }, method);
  };
  let pending = 0;
  const routed = async (input, init) => { pending += 1; try { return await router(input, init); } finally { pending -= 1; } };
  const kept = new Map();
  const storage = { getItem: (k) => (kept.has(k) ? kept.get(k) : null), setItem: (k, v) => { kept.set(k, String(v)); }, removeItem: (k) => { kept.delete(k); }, key: (i) => [...kept.keys()][i] ?? null, get length() { return kept.size; } };
  const install = () => { globalThis.fetch = routed; globalThis.localStorage = storage; };
  install();
  const store = openStore(INSTANCE);
  writeSetting(store, "github-token", INSTANCE_TOKEN);
  if (token) writeSetting(store, `github-token:${PRODUCT}`, SPEC_TOKEN);
  const host = connect(parseAddress(LIBRARY_ADDRESS), token ? { token: SPEC_TOKEN.value, tokenName: SPEC_TOKEN.name } : {});
  const instanceHost = connect(parseAddress(`https://github.com/${INSTANCE}`), { token: INSTANCE_TOKEN.value, tokenName: INSTANCE_TOKEN.name });
  const went = [];
  const context = { page: "review", instance: { repository: INSTANCE, host: instanceHost }, store, go(...where) { went.push(where); }, went,
    product: { address: LIBRARY_ADDRESS, kind: "github", host, tokenStored: Boolean(token) } };
  const quiet = async () => { for (let calm = 0; calm < 6;) { await new Promise((resolve) => setTimeout(resolve, 5)); calm = pending === 0 ? calm + 1 : 0; } };
  const drawn = async (route, params) => {
    install();
    const target = document.createElement("div");
    document.body.append(target);
    await route.render(target, context, params);
    await quiet();
    return target;
  };
  return {
    address: LIBRARY_ADDRESS, context, outside, store, host, quiet, went,
    /** The review pages' route `name` drawn with `params` into a fresh target; -> the target. */
    draw: (name, params = {}) => drawn(view.routes.find((candidate) => candidate.name === name), params),
    /** The route `name` of the review pages as the frame holds it once it has shown it, with its `leave`. */
    route: (name) => view.routes.find((candidate) => candidate.name === name).module(),
    /** The specification view of MOD-trace-pages on the default branch; -> the target. */
    trace: (params = { key: "specification", ref: "main" }) => drawn(traceView.routes.find((candidate) => candidate.name === "trace"), params),
    /** Another writer's commit on the default branch (by the account bob): each path of `changed` gets its text. */
    async land(changed) {
      const before = new Set(Object.keys(srv.files));
      for (const [path, body] of Object.entries(changed)) await srv.change(path, body);
      commits.push({ sha: srv.head, account: "bob", date: new Date().toISOString(), files: Object.keys(changed).map((filename) => ({ filename, status: before.has(filename) ? "modified" : "added" })) });
    },
    files: () => ({ ...srv.files }),
    /** Every commit written to the product: { message, files }. */
    writes: () => srv.writes.map((write) => ({ ...write })),
    /** The requests that wrote, with the authorisation each carried. */
    writers: () => [...log],
    head: () => srv.head,
  };
}

// ---------------------------------------------------------------- reading and clicking a page

/** A click the browser marks as a person's (tests/review-pages-harness.mjs marks every event it dispatches as trusted, except `scripted()`'s). */
export const click = (node) => node.dispatchEvent(new Event("click"));
export const textOf = (node) => node?.textContent ?? "";
/** The editor's text area: the first one that is neither the Why field nor a reason's field. */
export const areaOf = (target) => find(target, (node) => node.localName === "textarea" && !["why", "reject-reason"].some((name) => node.className.split(" ").includes(name)))[0];
export const whyOf = (target) => byClass(target, "textarea", "why")[0];
export const saveOf = (target) => buttonsNamed(target, "Save")[0];
export const typeInto = (target, body) => { const area = areaOf(target); area.value = body; area.dispatchEvent(new Event("input")); };
/** The marks of the editor, one text per finding. */
export const marksOf = (target) => find(byClass(target, "ol", "marks")[0] ?? target, (node) => node.localName === "div").map((node) => node.textContent);
export const resultOf = (target) => byClass(target, "p", "result").map((node) => node.textContent).join(" ");
export const linksOf = (target, className = null) => find(target, (node) => node.localName === "a" && (className === null || node.className.split(" ").includes(className)));
/** The folded "What is this?" of a page: the text of each <details class="explain">. */
export const explainedOf = (target) => byClass(target, "details", "explain").map((node) => node.textContent);
/** The route and parameters of a link the pages write, `#<route>/<key>=<value>/…`, its parts decoded as the frame decodes them. */
export function paramsOf(href) {
  const [route, ...parts] = href.replace(/^#/, "").split("/");
  return { route, params: Object.fromEntries(parts.map((part) => { const at = part.indexOf("="); return [decodeURIComponent(part.slice(0, at)), decodeURIComponent(part.slice(at + 1))]; })) };
}
/** The files of `writes` under `docs/spec-freigaben/`, by their paths. */
export const queueWrites = (writes) => writes.flatMap((write) => Object.entries(write.files)).filter(([path]) => path.startsWith("docs/spec-freigaben/"));
