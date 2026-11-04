// The harness of the system and release tests of UC-033 (Move an issue into the backlog): the real route `issue` of MOD-maintenance-pages is drawn into the fixture DOM of tests/main-page-home-harness.mjs through the world of
// tests/uc-012-harness.mjs — its fake GitHub of alice/product (issues listed, read, commented, labelled, closed; trees and commits written), its fake Bridge, its model endpoints, the real MOD-issue-handling, MOD-job-runner, MOD-runtimes,
// MOD-spec-changes and MOD-repository-hosts — with a product whose architecture describes the modules MOD-store, MOD-pages and MOD-mail, whose backlog holds two items — the fixture's ITM-0900 and ITM-800 — and whose SPEC holds FIRST RULE and SECOND RULE. What the page writes stays in
// the fake repository, so that a later page of the same world reads it. A person's click is the page's own listener called with a trusted event. It holds no test and no expected result: what it builds are inputs, and every test states its own
// expected values.
// Imported by tests/system-uc-033-move-an-issue-into-the-backlog.test.mjs and tests/release-uc-033-move-an-issue-into-the-backlog.test.mjs.
//
// Module: MOD-maintenance-pages
// Module: MOD-issue-handling
// Module: MOD-work-plans
// Level: system
//
// Authored by developer-sonnet-j (ITM-804), who implemented none of ITM-582, ITM-583, ITM-584, ITM-617, ITM-1250 and ITM-1256. It implemented ITM-817, MOD-work-plans' `backlogFindings` (A BACKLOG ITEM NAMES THE MODULES IT CHANGES), whose result
// the form of the move shows: no release case written here exercises `backlogFindings`; developer-sonnet-l writes those.

import assert from "node:assert/strict";
import { artifactSchemas, readDocument } from "../src/documents/index.mjs";
import { itemStates, startable } from "../src/work-plans/index.mjs";
import { ADDRESS, PRODUCT_URL, analysed, buttonsOf, byClass, changeOf, decided, drafted, flush, issueNow, issueOf, issueWrites, one, open, queueFiles, restoreWorld, saved, start, textOf, trusted, waitFor, walk, writtenFiles } from "./uc-012-harness.mjs";

export { ADDRESS, PRODUCT_URL, analysed, buttonsOf, byClass, changeOf, decided, drafted, flush, issueNow, issueOf, issueWrites, one, open, queueFiles, restoreWorld, saved, textOf, trusted, waitFor, walk, writtenFiles };

const lines = (...rows) => `${rows.join("\n")}\n`;

// ---------------------------------------------------------------- the product's files

const moduleText = (id, folder) => lines("---", `id: ${id}`, `title: ${id}`, `folder: ${folder}`, "realises: []", "follows:", "  - ARC-001", "uses: []", "provides: []", "---", `# ${id} ${id}`, "",
  "## Responsibility", "", "It stores.", "", "## Parts", "", "- index.mjs", "", "## Data", "", "Nothing.", "", "## Interfaces", "", "None.", "", "## Files", "", "None.", "", "## Uses", "", "None.");

/** A backlog item of the item schema: the front matter of `fields`, then an outcome and an acceptance. */
export function itemText({ id, title, realises = ["FIRST RULE"], modules = ["MOD-store"], buildsOn = [], origin = ["https://github.com/alice/product/issues/1"] }) {
  const list = (key, values) => (values.length ? [`${key}:`, ...values.map((value) => `  - ${value}`)] : [`${key}: []`]);
  return lines("---", `id: ${id}`, `title: ${title}`, "level: module", ...list("realises", realises), ...list("modules", modules), ...(buildsOn.length ? list("builds_on", buildsOn) : []), "tests:", "  - unit", ...list("origin", origin), "---",
    `# ${id} ${title}`, "", "## Outcome", "", "The export keeps its first page.", "", "## Acceptance", "", "- A unit test passes.");
}
/** The path of an item's file. */
export const itemPath = (id, title) => `docs/backlog/${id}-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}.md`;

/** An item of the product's backlog before the issues are moved: ITM-800. */
export const EXISTING = { id: "ITM-800", title: "Keep the first page of an export", realises: ["FIRST RULE"], modules: ["MOD-store"] };

/** The product's files beyond tests/uc-012-harness.mjs's: the modules MOD-pages and MOD-mail, the backlog's one item, and the SPEC of FIRST RULE and SECOND RULE accepted by the harness' own approval of the SPEC. */
export const PRODUCT_EXTRA = {
  "docs/architecture/MOD-pages.md": moduleText("MOD-pages", "src/pages/"),
  "docs/architecture/MOD-mail.md": moduleText("MOD-mail", "src/mail/"),
  [itemPath(EXISTING.id, EXISTING.title)]: itemText(EXISTING),
};

/** A change queue whose entry's rationale names the issue `issue` of the product, with one entry that replaces the section "## 1. Section" of SPEC.md by `rules`, each { name, text }. */
export function queueOf(folder, issue, rules, product = PRODUCT_URL) {
  const base = `docs/spec-freigaben/${folder}`;
  const section = ["## 1. Section", "", ...rules.flatMap(({ name, text, check = "no automatic check; at review." }) => [`**${name}** *(Product Owner)*`, text, `*Check:* ${check}`, ""])].join("\n");
  return {
    [`${base}/index.md`]: lines(`# SPEC approvals — queue ${folder.slice(0, 11)} · ${folder.slice(12)}`, "", "**Zieldatei aller Einträge:** `SPEC.md`", "",
      "| Nr | Datei | Anker (Überschrift, wortgetreu) | bis (exklusiv) | Commits |", "|---|---|---|---|---|", "| 01 | `SPEC.md` | ## 1. Section | — | |"),
    [`${base}/entscheidungen.md`]: "# Decisions\n\nAppend-only.\n",
    [`${base}/01-section.md`]: section,
    [`${base}/01-section.begruendung.md`]: `# Reason\n\nWhy.\n\n**Issue:** #${issue} of ${product}\n`,
  };
}

// ---------------------------------------------------------------- the issues

export const BODY = "The export is cut off after the second page; FIRST RULE says nothing about page counts.";
/** The issues of the world: 5 not classified, 6 a bug, 7 a change, 8 not reproducible, 9 a bug describing the same work as 6. */
export const issuesOf = () => [
  { number: 5, title: "Export loses pages", body: BODY, state: "open", labels: [], comments: [] },
  { number: 6, title: "Export drops the last page", body: BODY, state: "open", labels: ["defect"], comments: [] },
  { number: 7, title: "Export should keep all pages", body: BODY, state: "open", labels: ["change"], comments: [] },
  { number: 8, title: "Export is slow", body: BODY, state: "open", labels: ["not-reproducible"], comments: [] },
  { number: 9, title: "Last page missing in the export", body: BODY, state: "open", labels: ["defect"], comments: [] },
];

/** The world of UC-033: the product of this file, over tests/uc-012-harness.mjs' `start`; `product` adds files, `issues` replaces the issues. */
export function startWorld({ product = {}, issues = issuesOf(), ...over } = {}) {
  return start({ issues, product: { ...PRODUCT_EXTRA, ...product }, ...over });
}

// ---------------------------------------------------------------- what a person does on the page

export const moveOf = (detail) => byClass(detail, "issue-move")[0];
export const fieldOf = (root, key) => walk(walk(root, (node) => node.getAttribute?.("data-key") === key)[0], (node) => node.localName === "input")[0];
export const typed = async (field, value) => { field.value = value; field.dispatchEvent(new Event("input")); await flush(); };

/** The issue `number` opened, and its move section, or the line that says it is not offered, waited for; with `offered` false, only the page itself — for an issue whose class draws neither. */
export async function openIssue(w, number, { offered = true } = {}) {
  const detail = await open(w, number);
  await waitFor(() => byClass(detail, "issue-analysis").length > 0 && (!offered || moveOf(detail) !== undefined || byClass(detail, "move-not-offered").length > 0));
  await flush();
  return detail;
}
/** Move to backlog pressed by the person, and the form waited for. */
export async function moved(detail) {
  await trusted(buttonsOf(moveOf(detail), "Move to backlog")[0]);
  await waitFor(() => byClass(moveOf(detail), "schema-form").length > 0 || byClass(moveOf(detail), "issue-problem").length > 0);
  assert.equal(byClass(moveOf(detail), "issue-problem").length, 0, textOf(moveOf(detail)));
  return byClass(moveOf(detail), "schema-form")[0];
}
/** The form's Add button. */
export const addOf = (form) => buttonsOf(form, "Add")[0];
/** Add pressed by the person, and what it said waited for. */
export async function pressAdd(detail, form) {
  await trusted(addOf(form));
  await waitFor(() => byClass(moveOf(detail), "move-added").length > 0 || byClass(moveOf(detail), "issue-problem").length > 0);
  return detail;
}
/** The errors the form shows beside its fields, as text. */
export const errorsOf = (form) => walk(form, (node) => (node.className ?? "").split(" ").includes("error")).map(textOf).join(" | ");
/** The warnings the form shows beside its fields, as text. */
export const warningsOf = (form) => walk(form, (node) => (node.className ?? "").split(" ").includes("warning")).map(textOf).join(" | ");

// ---------------------------------------------------------------- what the world received

/** The items the product's server received as new files of the backlog, once each by path and text, in the order written. */
export const itemFiles = (w) => writtenFiles(w).filter((entry) => /^docs\/backlog\/ITM-\d+-[^/]+\.md$/.test(entry.path));
/** Every non-GET request of the product's server, as "METHOD path". */
export const writeLog = (w) => w.kept.github.filter((request) => request.method !== "GET").map((request) => `${request.method} ${request.path.replace(/^\/repos\/alice\/product/, "")}`);
/** The item an item file holds, read with the item schema of MOD-documents. */
export const itemOfFile = (entry) => readDocument(artifactSchemas().item, entry.path, entry.content);

/**
 * Records, until `stop()`, every request the page sends to GitHub that changes something — the method, the path below the repository and the Authorization header — as `writes`. The world's fake replaces `fetch` while it serves a commit,
 * so the recorder stands in front of whatever `fetch` is when the page asks for it. Reads, among them GraphQL's POSTs, are not recorded.
 */
export function recordWrites() {
  let current = globalThis.fetch;
  const writes = [];
  Object.defineProperty(globalThis, "fetch", { configurable: true, get() {
    const target = current;
    return async (input, init = {}) => {
      const url = new URL(typeof input === "object" && !(input instanceof URL) ? input.url : String(input));
      const method = String(init.method ?? "GET").toUpperCase();
      if (method !== "GET" && url.host === "api.github.com" && !url.pathname.endsWith("/graphql")) writes.push({ method, path: url.pathname.replace(/^\/repos\/alice\/product/, ""), authorization: init.headers?.Authorization ?? null, body: init.body ?? null });
      return target(input, init);
    };
  }, set(value) { current = value; } });
  return { writes, stop() { delete globalThis.fetch; globalThis.fetch = current; } };
}

/** The pull request of the branch `branch` as MOD-repository-hosts gives it: number 9 of the product, in `state`. */
export const pullOf = (branch, state) => ({ number: 9, title: `${branch}: work`, branch, base: "main", head: "2".repeat(40), mergeCommit: state === "merged" ? "3".repeat(40) : null, state, draft: false,
  url: `${PRODUCT_URL}/pull/9`, opened: "2026-10-29T09:10:00Z", merged: state === "merged" ? "2026-10-29T09:50:00Z" : null, closed: state === "merged" ? "2026-10-29T09:50:00Z" : null, body: `Job: ${branch}` });

/** The record of a job of kind `kind` that works on `worksOn` (an item's identifier or an issue's address), started by the person, taken by a CI agent. */
export const jobRecord = (id, kind, worksOn) => lines("---", `id: ${id}`, `kind: ${kind}`, "works_on:", `  - ${worksOn}`, "participant: ci-bot", "model: fixture-llm", "route: ci hosted", "run:", "retries:", "started_by: Reviewer Rae",
  "start: 2026-10-29 09:00 UTC", "agent_m: 0fb048a1bac50be9beb68fb798e226f8ca2c7f00, commit 0fb048a1bac50be9beb68fb798e226f8ca2c7f00", "inputs:", "  - issue #6", "limit: 5", "task: in parameters", "conversation:", "---",
  "## Destinations", "", "- ci-bot, at GitHub's hosted runners: issue #6.", "", "## Parameters", "", "```json", "{", "  \"issue\": 6", "}", "```", "");

// ---------------------------------------------------------------- the state of an item (UC-033 step 5)

/**
 * The state MOD-work-plans' itemStates derives for the item `item`, and why a job for it cannot start, given the requirements and use cases the product has accepted: `accepted` are their names. The backlog is `others` — items beside it.
 * Nothing is stored: the function reads the item's document and the names alone.
 */
export function stateOf(item, accepted, others = []) {
  const statuses = new Map(accepted.map((name) => [name, { id: name, kind: /^UC-/.test(name) ? "use-case" : "requirement", status: "accepted" }]));
  const states = itemStates([...others, item], null, { statuses, queues: [], jobs: [], pullRequests: [], gates: [], workflow: null });
  const mine = states.find((each) => each.item === item.id);
  const verdict = startable(item.id, states, { workflow: null, assignment: null, sprint: null, held: [], wip: null, participants: [] });
  return { state: mine.state, reason: mine.reason, verdict };
}
