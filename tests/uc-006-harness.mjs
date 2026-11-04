// The harness of the system and release tests of UC-006 (Approve a specification change) that read a SPEC entry through the real review pages: the route `spec-entry` of MOD-review-pages drawn into the fixture DOM over the real
// MOD-repository-hosts host of GitHub, MOD-spec-changes and MOD-approvals, behind a fixture server of GitHub's API (tests/app-harness.mjs' repoServer, with the deletion of a file added, as tests/uc-008-harness.mjs adds it).
// Every request that writes is recorded with the authorisation it carries, and the global `fetch` is replaced by a router that refuses any other origin, so nothing reaches the network. The instance workflow of UC-006 4c is
// run by `withGitInstance` from a temporary git origin and checkout, as tests/system-uc-006-approve-spec-change.test.mjs runs it. No expected result is computed here: what it builds are inputs, and every test states its own.
// Imported by tests/system-uc-006-decide-an-entry.test.mjs and tests/release-uc-006-approve-a-specification-change.test.mjs.
//
// Module: MOD-review-pages
// Module: MOD-spec-changes
// Level: system
//
// Authored by developer-sonnet-j (ITM-371). The fixture product's text is that of tests/system-uc-006-approve-spec-change.test.mjs (a fixture that file keeps inside itself, so that it is stated again here).
// A world is a product (mode "product": alice/spec-product, whose SPEC the reviewer's token writes, and the instance akmaier/agent-m, which holds the register of sources) or the instance itself (mode "instance": the
// repository holds its own SPEC, its queue and its register, and its workflow writes an approval committed without a token).

import "./review-pages-harness.mjs";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { repoServer } from "./app-harness.mjs";
import { byClass, buttonsNamed, find, openStore, writeSetting, until } from "./review-pages-draft-world.mjs";
import { connect, parseAddress } from "../src/repository-hosts/index.mjs";
import { view } from "../src/review-pages/index.mjs";

export { byClass, buttonsNamed, find, until };
export { scripted } from "./review-pages-harness.mjs";
export const text = (...lines) => `${lines.join("\n")}\n`;
export const pad2 = (n) => String(n).padStart(2, "0");
/** The git blob SHA of a text, as GitHub names it. */
export const blobOf = (body) => createHash("sha1").update(`blob ${Buffer.byteLength(body)}\0${body}`).digest("hex");

// ---------------------------------------------------------------- the fixture product's text

export const SAMPLE = "A SAMPLE RULE", ADDED_RULE = "AN ADDED RULE", WRITE_RULE = "A WRITE RULE";
export const READING = text("## 1. Reading", "", `**${SAMPLE}** *(Fixture PO)*`, "A reader reads a file whole.", "*Check:* `tests/sample.test.mjs`", "");
export const READING_NEW = READING.replace("whole.", "whole, or says why not.");
export const ADDED = text("## 1a. Added", "", `**${ADDED_RULE}** *(Fixture PO)*`, "A reader sees what was added.", "*Check:* no automatic check; at review", "");
export const ADDED_NEW = ADDED.replace("what was added.", "what was added, and when.");
export const WRITING = text("## 2. Writing", "", `**${WRITE_RULE}** *(Fixture PO)*`, "A writer writes a file whole.", "*Check:* no automatic check; at review");
export const WRITING_NEW = WRITING.replace("whole.", "entirely.");
export const WRITING_OTHER = WRITING.replace("whole.", "in one piece.");
export const HEAD = text("# Fixture product - Specification", "");
export const SPEC = HEAD + READING + WRITING;
const USE_CASE = text("---", "id: UC-001", "title: Read a file", "area: reading", "actors:", "  - Reader", "realises:", `  - ${SAMPLE}`, "---", "# UC-001 Read a file", "", `**Goal.** The reader reads a file whole, as ${SAMPLE} says.`);
const USE_CASE_WRITE = text("---", "id: UC-002", "title: Write a file", "area: writing", "actors:", "  - Writer", "realises:", `  - ${WRITE_RULE}`, "---", "# UC-002 Write a file", "", `**Goal.** The writer writes a file, as ${WRITE_RULE} says.`);
export const REGISTER_ENTRY = text("---", "id: SRC-fixture-po", "title: Fixture PO", "kind: document", "authority: normative", "licence: may be republished - fixture", "---", "# SRC-fixture-po Fixture PO", "", "A fixture source.");
export const LINKS = text("# The sources this product meets", "", "| Source | Version | Hash | Part |", "|---|---|---|---|", `| SRC-fixture-po | 2026-10-05 | ${"0".repeat(64)} | |`);

export const QUEUE = "docs/spec-freigaben/2026-03-01_sample";
export const DECISIONS = text("# Decisions - queue 2026-03-01 sample", "", "Append-only.");
export const entry = (nr, anchor, proposal) => ({ nr, anchor, proposal, slug: `entry-${nr}` });
export const E05 = entry(5, "## 1. Reading", READING_NEW + ADDED);
export const E06 = entry(6, "## 1a. Added", ADDED_NEW);
export const E07 = entry(7, "## 2. Writing", WRITING_NEW);
export const proposalPath = (item) => `${QUEUE}/${pad2(item.nr)}-${item.slug}.md`;
export const rationalePath = (item) => `${QUEUE}/${pad2(item.nr)}-${item.slug}.begruendung.md`;
export const entryId = (item) => `spec-2026-03-01_sample-${pad2(item.nr)}`;
export const recordName = (item, blob = blobOf(item.proposal)) => `spec-2026-03-01_sample-${pad2(item.nr)}-${blob.slice(0, 12)}.md`;
export const recordPath = (item, blob) => `docs/approvals/${recordName(item, blob)}`;
export const recordText = (item, section) => text("kind: spec", `queue: ${QUEUE}`, `entry: ${pad2(item.nr)}`, `proposal: ${proposalPath(item)}`, `blob: ${blobOf(item.proposal)}`, "target: SPEC.md", `anchor: ${item.anchor}`, `section: ${blobOf(section)}`);
export const rowFor = (item, when, blob) => `| ${when} | ${item.nr} | uebernommen | approval:${recordName(item, blob)} |\n`;
/** The fields of a record or any `key: value` file. */
export const fieldsOf = (body) => Object.fromEntries(body.trim().split("\n").map((line) => { const at = line.indexOf(":"); return [line.slice(0, at), line.slice(at + 1).trim()]; }));

const queueIndex = (entries) => text("# SPEC approvals - queue 2026-03-01 · sample", "", "**Zieldatei aller Einträge:** `SPEC.md`", "", "| Nr | Datei | Anker (Überschrift, wortgetreu) | bis (exklusiv) | Commits |", "|---|---|---|---|---|",
  ...entries.map((item) => `| ${pad2(item.nr)} | \`SPEC.md\` | ${item.anchor} | — | — |`));
const rationale = (item) => text(`# ${item.anchor}: fixture change`, "", "**The change.** Changes a fixture requirement section.", "", "**Why.** The fixture reviewer needs a proposed wording beside the current section.", "", "**Impact list.**", "- fixture impact", "", "**Origin.** fixture source passage.");

/** The files of the queue of `entries` and of the SPEC they change. */
export function queueFiles({ entries = [E05, E06, E07], spec = SPEC, decisions = DECISIONS } = {}) {
  const files = { "SPEC.md": spec, "docs/use-cases/UC-001-read-a-file.md": USE_CASE, "docs/use-cases/UC-002-write-a-file.md": USE_CASE_WRITE, "docs/sources.md": LINKS,
    [`${QUEUE}/index.md`]: queueIndex(entries), [`${QUEUE}/entscheidungen.md`]: decisions };
  for (const item of entries) { files[proposalPath(item)] = item.proposal; files[rationalePath(item)] = rationale(item); }
  return files;
}

// ---------------------------------------------------------------- the servers

export const TOKENS = { product: { value: "github_pat_ALICEspecPRODUCT0123456789abcdef", name: "Agent M - spec-product", expires: "2027-01-01" },
  instance: { value: "github_pat_ALICEagentMINSTANCE0123456789abcd", name: "Agent M - agent-m", expires: "2027-01-01" } };
const PRODUCT = "alice/spec-product", INSTANCE = "akmaier/agent-m", ACCOUNT = "alice", COMMITTED = "2026-11-01T10:00:00Z";
const PRODUCT_HEAD = "9f8e7d".padEnd(40, "0"), INSTANCE_HEAD = "1a2b3c".padEnd(40, "0");
export const PRODUCT_ADDRESS = `https://github.com/${PRODUCT}`, INSTANCE_ADDRESS = `https://github.com/${INSTANCE}`;
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

/**
 * world({ mode, token, entries, spec, decisions, files, history, denyWrites }) -> a repository behind fixture servers, drawn by `draw`.
 *   mode        "product" (default): the product alice/spec-product holds the SPEC and the queue, the instance akmaier/agent-m the register of sources; "instance": the instance holds all of it.
 *   token       whether this browser stores the token of the repository that holds the SPEC (default true).
 *   entries, spec, decisions   the queue's entries (E05, E06, E07 by default), the SPEC they change and the queue's decision file; files: laid over the repository's files, a path set to null left out.
 *   denyWrites  the repository reports no push permission and GitHub refuses every write of a commit with 403.
 */
export async function world({ mode = "product", token = true, entries = [E05, E06, E07], spec = SPEC, decisions = DECISIONS, files = {}, denyWrites = false } = {}) {
  const inProduct = mode === "product";
  const own = inProduct ? PRODUCT : INSTANCE;
  const base = { "README.md": "# Fixture\n", ...queueFiles({ entries, spec, decisions }), ...(inProduct ? {} : { "docs/sources/SRC-fixture-po.md": REGISTER_ENTRY }), ...files };
  for (const path of Object.keys(base)) if (base[path] === null) delete base[path];
  const log = [], accepts = [], deletions = { byTree: new Map(), byCommit: new Map() }, outside = [];
  const written = await repoServer({ repo: own, files: base, head: inProduct ? PRODUCT_HEAD : INSTANCE_HEAD });
  const register = inProduct ? await repoServer({ repo: INSTANCE, head: INSTANCE_HEAD, files: { "README.md": "# Agent M\n", "docs/sources/SRC-fixture-po.md": REGISTER_ENTRY } }) : null;
  const authorization = (init) => init?.headers?.Authorization ?? init?.headers?.authorization ?? null;
  const writtenFetch = async (url, init, method) => {
    const isWrite = method !== "GET" && !(method === "POST" && url.pathname === "/graphql");
    if (isWrite) log.push({ method, path: url.pathname, authorization: authorization(init), body: typeof init.body === "string" ? JSON.parse(init.body) : null });
    if (isWrite && denyWrites) return json({ message: "Resource not accessible by personal access token" }, 403);
    if (method === "GET" && url.pathname === `/repos/${own}`) return json({ private: false, default_branch: "main", permissions: { push: Boolean(authorization(init)) && !denyWrites } });
    // The commits that added approval records, as GitHub lists them for the folder docs/approvals: newest first, each by the account of the token that made it, with the day it was committed.
    if (method === "GET" && url.pathname === `/repos/${own}/commits` && url.searchParams.get("path") === "docs/approvals") {
      return json([...accepts].reverse().map((each) => ({ sha: each.sha, parents: [], author: { login: ACCOUNT }, commit: { author: { name: "Alice" }, committer: { date: COMMITTED }, message: each.message } })));
    }
    const commitOfAccept = new RegExp(`^/repos/${own}/commits/([0-9a-f]{40})$`).exec(url.pathname);
    if (method === "GET" && commitOfAccept && accepts.some((each) => each.sha === commitOfAccept[1])) {
      return json({ sha: commitOfAccept[1], files: accepts.find((each) => each.sha === commitOfAccept[1]).files.map((filename) => ({ filename, status: "added" })) });
    }
    // GitHub's git-data endpoints knew no deletion in the fake: a tree entry whose sha is null is taken out of the request, and the file is deleted once the branch has moved on.
    if (method === "POST" && url.pathname === `/repos/${own}/git/trees`) {
      const body = JSON.parse(init.body), removed = body.tree.filter((each) => each.sha === null).map((each) => each.path);
      if (removed.length === 0) return written.fetch(url, init);
      const made = await written.fetch(url, { ...init, body: JSON.stringify({ ...body, tree: body.tree.filter((each) => each.sha !== null) }) });
      deletions.byTree.set((await made.clone().json()).sha, removed);
      return made;
    }
    if (method === "POST" && url.pathname === `/repos/${own}/git/commits`) {
      const made = await written.fetch(url, init), removed = deletions.byTree.get(JSON.parse(init.body).tree);
      if (removed) deletions.byCommit.set((await made.clone().json()).sha, removed);
      return made;
    }
    if (method === "PATCH" && url.pathname === `/repos/${own}/git/refs/heads/main`) {
      const made = await written.fetch(url, init), removed = deletions.byCommit.get(JSON.parse(init.body).sha);
      if (removed && made.ok) { for (const path of removed) delete written.files[path]; written.writes.at(-1).deleted = removed; }
      if (made.ok) accepts.push({ sha: JSON.parse(init.body).sha, files: Object.keys(written.writes.at(-1).files).filter((path) => path.startsWith("docs/approvals/")), message: written.writes.at(-1).message });
      return made;
    }
    return written.fetch(url, init);
  };
  const router = async (input, init = {}) => {
    const url = new URL(String(input)), method = (init.method ?? "GET").toUpperCase(), body = typeof init.body === "string" ? init.body : "";
    if (url.origin !== "https://api.github.com" && url.origin !== "https://raw.githubusercontent.com") { outside.push(url.href); throw new TypeError(`the test's network refuses ${url.href}`); }
    const ofRegister = register && (url.pathname.startsWith(`/repos/${INSTANCE}`) || url.pathname.startsWith(`/${INSTANCE}/`) || (url.pathname === "/graphql" && body.includes(INSTANCE_HEAD)));
    return ofRegister ? register.fetch(url, { ...init, method }) : writtenFetch(url, { ...init, method }, method);
  };
  let pending = 0;
  const routed = async (input, init) => { pending += 1; try { return await router(input, init); } finally { pending -= 1; } };
  const kept = new Map();
  const storage = { getItem: (k) => (kept.has(k) ? kept.get(k) : null), setItem: (k, v) => { kept.set(k, String(v)); }, removeItem: (k) => { kept.delete(k); }, key: (i) => [...kept.keys()][i] ?? null, get length() { return kept.size; } };
  const install = () => { globalThis.fetch = routed; globalThis.localStorage = storage; };
  install();
  const store = openStore(INSTANCE);
  const address = inProduct ? PRODUCT_ADDRESS : INSTANCE_ADDRESS, stored = inProduct ? TOKENS.product : TOKENS.instance;
  if (token) writeSetting(store, inProduct ? `github-token:${PRODUCT}` : "github-token", stored);
  if (inProduct) writeSetting(store, "github-token", TOKENS.instance);
  const hostOf = (addr, withToken) => connect(parseAddress(addr), withToken ? { token: (addr === PRODUCT_ADDRESS ? TOKENS.product : TOKENS.instance).value, tokenName: (addr === PRODUCT_ADDRESS ? TOKENS.product : TOKENS.instance).name } : {});
  const host = hostOf(address, token);
  const instanceHost = inProduct ? hostOf(INSTANCE_ADDRESS, true) : host;
  const went = [];
  const context = { page: "review", instance: { repository: INSTANCE, host: instanceHost }, store, go(...where) { went.push(where); }, went,
    ...(inProduct ? { product: { address, kind: "github", host, tokenStored: token } } : {}) };
  const quiet = async () => { for (let calm = 0; calm < 6;) { await new Promise((resolve) => setTimeout(resolve, 5)); calm = pending === 0 ? calm + 1 : 0; } };
  const route = (name) => view.routes.find((candidate) => candidate.name === name);
  return {
    address, context, log, outside, store, host, quiet, went,
    /** The route `name` (default `spec-entry`) drawn with `params` into a fresh target; -> the target. */
    async draw(params = {}, name = "spec-entry") {
      install();
      const target = document.createElement("div");
      document.body.append(target);
      await route(name).render(target, context, params);
      return target;
    },
    route,
    /** Another writer's commit on the default branch: each path of `changed` gets its text. */
    async land(changed) { for (const [path, body] of Object.entries(changed)) await written.change(path, body); },
    files: () => ({ ...written.files }),
    /** Every commit that was written to the repository: { message, files }, a deletion with its paths in `deleted`. */
    writes: () => written.writes.map((write) => ({ ...write })),
    /** The requests that wrote, with the authorisation each carried. */
    writers: () => log.filter((each) => each.method !== "GET"),
    requests: () => [...written.requests],
    head: () => written.head,
  };
}

// ---------------------------------------------------------------- reading and clicking the page

export const click = (node) => node.dispatchEvent(new Event("click"));
export const tick = (box, on = true) => { box.checked = on; box.dispatchEvent(new Event("change")); };
export const buttonOf = (target, label) => buttonsNamed(target, label)[0];
export const rowOf = (target, id) => find(target, (node) => node.localName === "tr" && node.getAttribute("data-id") === id)[0];
export const boxOf = (target, id) => find(rowOf(target, id), (node) => node.localName === "input")[0];
export const badgeOf = (node) => (node ? byClass(node, "span", "badge")[0]?.textContent : undefined);
export const areaOf = (target) => find(target, (node) => node.localName === "textarea" && !["why", "reject-reason"].some((name) => node.className.split(" ").includes(name)))[0];
export const whyOf = (target) => byClass(target, "textarea", "why")[0];
export const reasonOf = (target) => byClass(target, "textarea", "reject-reason")[0];
export const typeInto = (area, body) => { area.value = body; area.dispatchEvent(new Event("input")); };
export const resultOf = (target) => byClass(target, "p", "result").map((node) => node.textContent).join(" ");
export const sectionText = (target, name) => byClass(target, "section", name)[0]?.textContent;
export const linksOf = (target) => find(target, (node) => node.localName === "a");

// ---------------------------------------------------------------- the instance workflow of UC-006 4c, from a temporary git repository

function git(cwd, ...args) {
  const result = spawnSync("git", args, { cwd, encoding: "utf8", env: { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_SYSTEM: "/dev/null", GIT_TERMINAL_PROMPT: "0" } });
  if (result.status !== 0) throw new Error(`git ${args.join(" ")} failed in ${cwd}: ${result.stderr}`);
  return result.stdout.trim();
}
export { git };
/** gitStatus(cwd, ...args) -> { status, stdout } — a git command whose failure is an answer, such as `git grep` finding nothing (status 1). */
export function gitStatus(cwd, ...args) {
  const result = spawnSync("git", args, { cwd, encoding: "utf8", env: { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_SYSTEM: "/dev/null", GIT_TERMINAL_PROMPT: "0" } });
  return { status: result.status, stdout: result.stdout };
}

/** withGitInstance(files, run) — a bare origin holding `files` as the commit a person made through GitHub's page, and a checkout of it as the workflow has; `run({ root, origin, clone, head })`, then everything is removed. */
export async function withGitInstance(files, run) {
  const root = mkdtempSync(join(tmpdir(), "agent-m-uc006-"));
  try {
    const origin = join(root, "origin.git"), seed = join(root, "seed"), clone = join(root, "clone");
    git(root, "init", "-q", "--bare", "-b", "main", origin);
    git(root, "clone", "-q", origin, seed);
    git(seed, "config", "user.name", "Alice Approver");
    git(seed, "config", "user.email", "alice@example.org");
    for (const [path, body] of Object.entries(files)) { mkdirSync(dirname(join(seed, path)), { recursive: true }); writeFileSync(join(seed, path), body); }
    git(seed, "add", "-A");
    git(seed, "commit", "-q", "-m", "approval committed without the dashboard");
    git(seed, "push", "-q", "origin", "HEAD:refs/heads/main");
    git(root, "clone", "-q", origin, clone);
    git(clone, "config", "user.name", "agent-m apply-approvals");
    git(clone, "config", "user.email", "41898282+github-actions[bot]@users.noreply.github.com");
    return await run({ root, origin, clone, head: git(clone, "rev-parse", "HEAD") });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

/** The CiEnvironment of a push to docs/approvals of the instance, in `fixture`'s checkout. */
export const workflowEnv = (fixture, extra = {}) => ({ GITHUB_ACTIONS: "true", GITHUB_EVENT_NAME: "push", GITHUB_WORKSPACE: fixture.clone, GITHUB_SERVER_URL: "https://github.com", GITHUB_REPOSITORY: INSTANCE,
  GITHUB_REF_NAME: "main", GITHUB_SHA: fixture.head, GITHUB_TOKEN: "ghp_ALICEworkflowTOKEN0123456789abcdef", ...extra });
