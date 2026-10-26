// The harness of the system and release tests of UC-019 (Change a specification or a use case by prompt): the page is MOD-site-frame's real `startPage` on the
// review page, over the real views of MOD-trace-pages and MOD-review-pages, the real MOD-prompt-bar, MOD-job-runner and MOD-runtimes and the real GitHub host. GitHub
// (the instance and the product) and the drafting participant are the app-harness's servers, in memory; the global `fetch` is replaced by a function that answers
// them and records any request to another origin (`outside`), which no test leaves: nothing reaches the network. The document is the one of
// tests/review-pages-draft-world.mjs, whose browser storage the scenario empties first. A person's actions are the clicks and the typing of the bar's and the pages'
// own controls.
// Imported by tests/system-uc-019-change-requirements-by-prompt.test.mjs, tests/system-uc-019-change-by-prompt.test.mjs, tests/release-uc-019-change-by-prompt.test.mjs and
// tests/release-uc-019-change-requirements-by-prompt.test.mjs. It holds no test and no expected result: the fixtures it builds are inputs, and every test states its own
// expected values.
// Authored by Developer developer-sonnet-e (ITM-514), who implemented none of ITM-507 (the route `draft`), ITM-508 (the specification browser's subject) or ITM-551; it
// implemented no UC-019 production behaviour.
//
// Module: MOD-review-pages; MOD-prompt-bar; MOD-trace-pages; MOD-site-frame; MOD-job-runner; MOD-runtimes
// Level: system
//
// Importing it registers the check after each test of the importing file that no request left the fixtures, and starts nothing else; `scenario()` opens a page.

import { afterEach } from "node:test";
// The tests that use this harness click as a script before they click as a person (THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK), so the
// review pages' document keeps node's untrusted Events here; a person's click is made trusted by the test (tests/review-pages-harness.mjs).
globalThis.reviewPagesScriptedWithin = ["hand-over"];
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { byClass, buttonsNamed, click, find, until } from "./review-pages-draft-world.mjs";
import { repoServer, settle } from "./app-harness.mjs";
import { openStore, readTabValue, writeSetting } from "../src/browser-store/index.mjs";
import { registerStrategies } from "../src/job-runner/index.mjs";
import { view as tracePages } from "../src/trace-pages/index.mjs";
import { view as reviewPages } from "../src/review-pages/index.mjs";

const { startPage } = await import("../src/site-frame/index.mjs");

export const INSTANCE = "akmaier/agent-m", SOURCE = "SRC-author";
export const LOAN = "A LOAN HAS A DUE DATE", SHELF = "A BOOK IS SHELVED";
export const CHANGED = "A DUE DATE IS VISIBLE", CONFLICT = "A DUE DATE MAY BE HIDDEN";
export const INSTRUCTION = "Make the due date visible.";
// The first sentence of the conversation's prompt (src/job-catalogue/kinds/converse/prompt.md), by which a request of the bar's one kind is known.
const CONVERSE_PROMPT = "You answer a person's message about the page they are looking at";
export const CURRENT_RULE = "Every loan states its due date.";
const txt = (...lines) => `${lines.join("\n")}\n`;
export const SPEC = txt("# Lending tool", "", "## Lending", "", `**${LOAN}** *(SRC-policy)*`, CURRENT_RULE,
  "*Check:* `tests/loan.test.mjs`", "", `**${SHELF}** *(SRC-policy)*`, "Every book has a shelf.", "*Check:* `tests/shelf.test.mjs`", "");
// The group file of the product: the group "Lending" holds both requirements, in the order of the SPEC (the specification browser draws the groups of this file).
export const GROUPS = txt(`- Lending`, `  - ${LOAN}`, `  - ${SHELF}`);
const ROOT = new URL("../", import.meta.url);
export const readOriginal = (path) => readFileSync(new URL(path, ROOT), "utf8");
const PERSON = txt("---", `id: ${SOURCE}`, "title: Author", "kind: person", "identifier: github.com/akmaier", "authority: advisory",
  "licence: may be republished - fixture", "---", `# ${SOURCE} Author`, "", "## Versions", "",
  "| Version | Date | Edition | Read from | Files |", "|---|---|---|---|---|",
  "| `2026-10-13` | 2026-10-13 | fixture | this repository | one file, hashed only |");
const POLICY = PERSON.replaceAll(SOURCE, "SRC-policy").replace("kind: person", "kind: document")
  .replace("identifier: github.com/akmaier", "identifier: Lending policy").replace("authority: advisory", "authority: normative");
const LINKS = txt("# Sources", "", "| Source | Version | Hash | Part |", "|---|---|---|---|",
  `| ${SOURCE} | 2026-10-13 | ${"0".repeat(64)} | prompt |`, `| SRC-policy | 2026-10-13 | ${"0".repeat(64)} | lending |`);
const registerHead = readOriginal("docs/participants.md").split("\n");
const header = registerHead.slice(0, registerHead.findIndex((line) => line.startsWith("|---")) + 1).join("\n");
const register = (context) => txt(header,
  `| drafter | model endpoint | fixture-model | ${context} | - | draft text | this machine | endpoint fixture |`,
  "| observer | model endpoint | observer-model | 200000 | - | read repository | Anthropic, USA | endpoint fixture |",
  "| ci-drafter | CI agent | ci-model | 200000 | - | draft text | GitHub Actions in the USA | ci hosted secret CI_KEY |");

export const candidate = (fields = {}) => ({ name: CHANGED, rule: "Every loan visibly displays its due date.",
  check: "`tests/loan.test.mjs`", constrains: "product", passage: "make visible", class: "change", of: LOAN, ...fields });
export const draft = (...candidates) => ({ candidates: candidates.length ? candidates : [candidate()] });

// ---------------------------------------------------------------- the page and the servers

const FIXTURE_ORIGINS = ["https://api.github.com", "https://raw.githubusercontent.com", "https://fixture-endpoint.example.test", "http://127.0.0.1:9418"];
export const outside = [];
afterEach(() => { assert.deepEqual(outside.splice(0), [], "no request left the fixtures"); });

// The scenario's pages share the global document; the storage of the last one is emptied before the next opens.
function emptyStorage(storage) { while (storage.length > 0) storage.removeItem(storage.key(0)); }

/**
 * scenario({ owner, linked, answers, context, bridge, extraFiles, recording, hash }) -> the open page and its servers. The instance is akmaier/agent-m (its Pages
 * address is the location), the product `<owner>/lending-tool` with the SPEC above, the person's source linked unless `linked` is false, and the participant
 * `drafter` (draft text), `observer` (read the repository) and the CI agent `ci-drafter` (not offered by the bar). `answers` are the drafting endpoint's replies in
 * turn (a value, or a function of the requests so far); `hash` is the fragment the page opens at, none for the specification browser.
 */
export async function scenario({ owner = "akmaier", linked = true, answers = [draft()], context = 200000, bridge = false, extraFiles = {}, instanceFiles = {},
  recording = false, hash = null } = {}) {
  const repo = `${owner}/lending-tool`, address = `https://github.com/${repo}`, endpointRequests = [], bridgeRequests = [];
  let answerNumber = 0;
  const endpointAnswer = () => {
    const value = answers[Math.min(answerNumber++, answers.length - 1)];
    return typeof value === "function" ? value(endpointRequests, bridgeRequests) : value;
  };
  const answerText = () => {
    const value = endpointAnswer();
    return typeof value === "string" ? value : JSON.stringify(value && Object.hasOwn(value, "draft") ? value : { draft: value, answers: [] });
  };
  const response = (value) => new Response(JSON.stringify(value), { status: 200, headers: { "content-type": "application/json" } });
  const handOnRequests = [];
  let asked = null;
  const strings = (value) => (typeof value === "string" ? [value] : value && typeof value === "object" ? Object.values(value).flatMap(strings) : []);
  const textOfRequest = (body) => strings(body).join("\n");
  const next = () => answers[Math.min(answerNumber, answers.length - 1)];
  const conversational = (value) => typeof value === "string" || (value && typeof value === "object" && (Object.hasOwn(value, "draft") ? conversational(value.draft) : ["answer", "edits", "handOver"].some((key) => Object.hasOwn(value, key))));
  const handsOn = (body) => textOfRequest(body).includes(CONVERSE_PROMPT) && !conversational(next());
  // The kind the change is handed on to: by the scripted draft's shape where it is a value, else by the page shown; what it works on comes from the page's subject.
  const handOverOf = (body) => {
    const value = next(), shown = typeof value === "function" ? null : (value && Object.hasOwn(value, "draft") ? value.draft : value);
    const files = Array.isArray(shown?.files) ? shown.files.map((file) => file.path) : [];
    const hash = globalThis.location?.hash ?? "";
    const kind = Array.isArray(shown?.candidates) ? "change-requirements" : files.some((path) => path.startsWith("docs/architecture/")) || /^#(decision|module)\//.test(hash)
      ? "change-architecture" : files.length > 0 || /^#use-case\//.test(hash) ? "change-use-case" : "change-requirements";
    const task = /## The person's message\n\n(?:### [^\n]*\n\n)?([^]*?)\n\n## /.exec(textOfRequest(body))?.[1] ?? "";
    return { answer: `Handed on to ${kind}.`, handOver: { kind, works_on: [], task } };
  };
  const handler = async (url, init) => {
    if (url.origin === "https://fixture-endpoint.example.test") {
      const body = JSON.parse(init.body);
      // Every message of the bar is the conversation (MOD-prompt-bar: the one kind `converse`). Where the scenario scripts a change's draft — or a function — for its next
      // answer, the participant first hands the change on to the kind that owns it, as UC-049 4a says; that answer is kept apart (`handOnRequests`), and the scripted
      // answers and `endpointRequests` remain those of the change.
      if (handsOn(body)) {
        handOnRequests.push({ url: url.href, body, headers: init.headers });
        return response({ choices: [{ message: { content: JSON.stringify({ draft: handOverOf(body), answers: [] }) } }], usage: { prompt_tokens: 10, completion_tokens: 5 } });
      }
      endpointRequests.push({ url: url.href, body, headers: init.headers });
      return response({ choices: [{ message: { content: answerText() } }], usage: { prompt_tokens: 10, completion_tokens: 5 } });
    }
    if (url.origin === "http://127.0.0.1:9418") {
      bridgeRequests.push({ url: url.href, method: init.method, body: init.body && JSON.parse(init.body), headers: init.headers });
      if (init.method === "POST" && url.pathname === "/v1/ask") { asked = JSON.parse(init.body); return response({ ask: "fixture-ask" }); }
      // Through the Bridge as through the endpoint: the conversation hands a scripted change on first.
      if (init.method === "GET" && url.pathname === "/v1/ask/fixture-ask" && asked && handsOn(asked)) {
        const handing = asked;
        asked = null;
        return response({ state: "done", text: JSON.stringify({ draft: handOverOf(handing), answers: [] }), usage: { inputTokens: 10, outputTokens: 5 }, error: null });
      }
      if (init.method === "GET" && url.pathname === "/v1/ask/fixture-ask") return response({ state: "done", text: answerText(), usage: { inputTokens: 10, outputTokens: 5 }, error: null });
      return new Response(JSON.stringify({ error: "not-found" }), { status: 404 });
    }
    if (url.origin === "https://api.github.com" && (init.method ?? "GET") === "GET" && /^\/repos\/[^/]+\/[^/]+\/tags$/.test(url.pathname)) return response([]);
    return null;
  };
  const product = await repoServer({ repo, files: { "README.md": "# Lending tool\n", "SPEC.md": SPEC, "docs/groups/requirements.md": GROUPS,
    "docs/sources.md": linked ? LINKS : LINKS.split("\n").filter((line) => !line.startsWith(`| ${SOURCE} |`)).join("\n"),
    ".github/workflows/agent-m-jobs.yml": "name: Agent M jobs\n", ...extraFiles } });
  const chapterFolder = "docs/sources/SRC-vibe-coding/2026-10-05/";
  const chapters = Object.fromEntries(readdirSync(new URL(chapterFolder, ROOT)).filter((path) => path.endsWith(".md"))
    .map((path) => [chapterFolder + path, readOriginal(chapterFolder + path)]));
  const instance = await repoServer({ files: { "docs/participants.md": register(context), [`docs/sources/${SOURCE}.md`]: PERSON,
    "docs/sources/SRC-policy.md": POLICY, "docs/sources/SRC-vibe-coding.md": readOriginal("docs/sources/SRC-vibe-coding.md"),
    ...(recording ? { "docs/conversation-recording.md": txt("---", "recording: on", "---", "# Recording of conversations") } : {}),
    ...chapters, ...instanceFiles }, handlers: [handler, (url, init) => url.pathname === `/repos/${repo}`
      ? response({ default_branch: "main", private: false, archived: false, permissions: { push: true }, description: "" })
      : url.pathname.startsWith(`/repos/${repo}/`) ? product.fetch(url, init) : null] });
  globalThis.fetch = (input, init) => {
    const url = new URL(String(input));
    if (!FIXTURE_ORIGINS.includes(url.origin)) { outside.push(url.href); return Promise.reject(new TypeError(`the test's network refuses ${url.href}`)); }
    return instance.fetch(input, init);
  };
  // The browser: the window announces a change of the fragment, as a browser does, the storage is empty, the page's timers do not run.
  const events = new EventTarget();
  let fragment = "";
  const location = { hostname: "akmaier.github.io", host: "akmaier.github.io", protocol: "https:", pathname: "/agent-m/docs/index.html",
    get hash() { return fragment; }, set hash(value) { fragment = value; queueMicrotask(() => events.dispatchEvent(new Event("hashchange"))); } };
  Object.defineProperty(globalThis, "location", { configurable: true, value: location });
  Object.assign(globalThis.window, { addEventListener: events.addEventListener.bind(events), dispatchEvent: events.dispatchEvent.bind(events) });
  globalThis.setInterval = () => 1;
  emptyStorage(globalThis.localStorage);
  emptyStorage(globalThis.sessionStorage);
  const store = openStore(INSTANCE);
  writeSetting(store, "github-token", { value: "github_pat_FIXTURE_INSTANCE_0123456789", name: "github.com/akmaier", expires: "2027-01-01" });
  writeSetting(store, `github-token:${repo}`, { value: "github_pat_FIXTURE0123456789", name: "github.com/akmaier", expires: "2027-01-01" });
  writeSetting(store, "products", [address]);
  writeSetting(store, "endpoint:fixture", { url: "https://fixture-endpoint.example.test/v1", kind: "openai-compatible", model: "fixture-model", ...(bridge ? { bridge: "release-bridge" } : {}) });
  if (bridge) writeSetting(store, "bridge:release-bridge", { address: "http://127.0.0.1:9418", token: "fixture-pairing-token" });
  const named = encodeURIComponent(address);
  fragment = hash ?? `#trace/key=specification/ref=main/product=${named}`;
  const s = { product, instance, repo, address, store, location, endpointRequests, bridgeRequests, handOnRequests, chapter: readOriginal(`${chapterFolder}08_requirements-engineering.md`) };
  await startPage({ page: "review", views: [tracePages, reviewPages], menuViews: [] });
  await rest(s);
  s.body = document.body;
  s.target = find(document.body, (node) => node.localName === "main")[0];
  s.footer = find(document.body, (node) => node.localName === "footer" && node.className === "site-frame-prompt-bar")[0];
  await until(() => byClass(s.footer, "section", "prompt-bar").length === 1, "the prompt bar is drawn");
  return s;
}

// The composition root registers the strategies of the views once, as src/site-frame/start.mjs does for the page's views.
for (const [slug, view] of [["trace-pages", tracePages], ["review-pages", reviewPages]]) for (const strategies of view.strategies ?? []) registerStrategies(slug, strategies);

// Until the servers have had nothing in flight for a while.
export async function rest(s) { await settle(s.instance); }
// The page goes to a fragment, as a person's link or the bar's navigation does, and the route is drawn.
export async function goTo(s, fragment) {
  s.location.hash = fragment;
  await rest(s);
}

export const all = (root, tag, className = null) => find(root, (node) => (!tag || node.localName === tag) && (!className || node.className.split(/\s+/).includes(className)));
export const one = (root, tag, className) => { const nodes = all(root, tag, className); assert.equal(nodes.length, 1, `one ${tag}.${className}: ${root?.textContent ?? ""}`); return nodes[0]; };
export const namedButton = (root, text) => { const found = buttonsNamed(root, text); assert.ok(found.length > 0, `${text} is offered: ${root.textContent}`); return found[0]; };
export const row = (s, name = CHANGED) => { const found = all(s.target, "li", "candidate").find((node) => node.getAttribute("data-name") === name); assert.ok(found, `candidate ${name} is shown: ${s.target.textContent}`); return found; };
export const proposalWrites = (s) => s.product.writes.filter((write) => Object.keys(write.files).some((path) => path.endsWith(".begruendung.md")));
export const proposalTexts = (s) => proposalWrites(s).flatMap((write) => Object.entries(write.files).filter(([path]) => /\/\d\d-[^/]+\.md$/.test(path) && !path.endsWith(".begruendung.md")).map(([, text]) => text));
export const recordTexts = (s) => Object.entries(s.product.files).filter(([path]) => /^docs\/jobs\/JOB-.*\.md$/.test(path)).map(([, text]) => text);
export const conversationRecords = (s) => Object.entries(s.instance.files).concat(Object.entries(s.product.files)).filter(([path]) => path.startsWith("docs/conversations/"));

// ---------------------------------------------------------------- the person's actions

export const barOf = (s) => one(s.footer, "section", "prompt-bar");
export const statusOf = (s) => one(barOf(s), "section", "status");
// A person clicks (the page's controls listen for a click), and the servers settle.
export async function press(s, node) {
  assert.ok(node, "nothing to click");
  assert.ok(!node.disabled, `disabled — a person cannot click ${node.textContent}`);
  click(node);
  await rest(s);
}
// The specification browser, as the frame draws it for the product, with the group "Lending" unfolded and, unless `group`, A LOAN HAS A DUE DATE opened.
export async function fromTrace(s, group = false) {
  await press(s, one(s.target, "button", "spec-group-toggle"));
  if (!group) await press(s, all(s.target, "button", "requirement-name").find((button) => button.textContent === LOAN));
}
// The review pages' page of the requirement LOAN (the route `requirement`), where the bar's subject names the requirement and the route `draft`.
export async function onRequirementPage(s, name = LOAN) {
  await goTo(s, `#requirement/name=${encodeURIComponent(name)}/product=${encodeURIComponent(s.address)}`);
  await until(() => all(s.target, "textarea").length > 0, "the requirement's page");
}
// The person writes `text` in the bar, chooses `participant` where the bar offers several, and presses Send; resolves once the bar is free again.
/** A click the browser marks as a person's (isTrusted), which *Send* takes (THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK). */
export const trustedClick = () => Object.defineProperty(new Event("click"), "isTrusted", { value: true });
export async function send(s, text = INSTRUCTION, { participant = null } = {}) {
  const bar = barOf(s);
  if (participant !== null) {
    // The bar offers only the participants that can do the page's kind: several are chosen among, one is only named (UC-019 2).
    const selector = all(bar, "select", "participant")[0];
    if (selector) selector.value = participant;
    else assert.match(one(bar, "span", "participant").textContent, new RegExp(`^${participant} — `), `the bar offers ${participant}`);
  }
  one(bar, "textarea", "instruction").value = text;
  const sent = one(bar, "button", "send");
  sent.dispatchEvent(trustedClick());
  await rest(s);
  await until(() => sent.disabled === false, "the message has run");
  await rest(s);
}
// "Review the draft": the bar writes the address of the draft route; the page draws it. -> the fragment.
export async function review(s) {
  await press(s, one(barOf(s), "button", "review"));
  await rest(s);
  return s.location.hash;
}
export const save = (s) => press(s, namedButton(s.target, "Save"));
// The whole path of a draft of requirements from the requirement's page: the bar, Send, Review the draft; the draft is on the page.
export async function run(s, options = {}) {
  await onRequirementPage(s);
  await send(s, options.instruction ?? INSTRUCTION, options);
  await review(s);
  await until(() => all(s.target, "section", "requirements-result").length === 1, `the draft of the requirements: ${s.target.textContent}`);
}

export function assertProposal(s) {
  assert.equal(s.product.files["SPEC.md"], SPEC, "SPEC stays byte-identical before acceptance");
  assert.equal(proposalWrites(s).length, 1, "one Save produces one proposal commit for the affected section");
  const text = proposalTexts(s).join("\n");
  assert.match(text, /SRC-author, make visible/, "the prompting source reaches the saved proposal");
  assert.ok(!Object.keys(s.product.files).some((path) => path.startsWith("docs/approvals/")), "the generated proposal carries no acceptance");
  return text;
}

// Two use cases in their five parts, UC-007 realising LOAN and UC-008 realising SHELF, to add to the product (`extraFiles: useCases`), a draft that adds an alternative flow
// 2b to one of them, and the page of a use case.
const useCase = (id, title, realises, alternative = "- **2a. The book is out.** Agent M says so.") => txt("---", `id: ${id}`, `title: ${title}`, "area: lending", "actors:", "  - Author",
  "realises:", ...realises.map((name) => `  - ${name}`), "---", `# ${id} ${title}`, "", `**Goal.** ${title}.`, "", "## Actors", "", "- **Author**", "", "## Precondition", "",
  "- The product is managed.", "", "## Main flow", "", "1. The author starts.", "2. Agent M answers.", "", "## Alternative flows", "", alternative, "", "## Postcondition", "",
  "- Nothing is written.");
export const UC7_PATH = "docs/use-cases/UC-007-derive-use-cases.md", UC8_PATH = "docs/use-cases/UC-008-review-use-cases.md";
export const UC7 = useCase("UC-007", "Derive use cases", [LOAN]), UC8 = useCase("UC-008", "Review use cases", [SHELF]);
export const useCases = { [UC7_PATH]: UC7, [UC8_PATH]: UC8 };
const NEW_FLOW = "- **2a. The book is out.** Agent M says so.\n- **2b. The service fails.** Agent M reports the error and writes nothing.";
export const changed = (id, path, base) => ({ path, class: "change", of: id, text: base.replace(/- \*\*2a\..*$/m, NEW_FLOW) });
export async function onUseCase(s, id = "UC-007") {
  await goTo(s, `#use-case/id=${id}/product=${encodeURIComponent(s.address)}`);
}
// What the participant was sent from the heading "The use case, the requirements it realises, and every other use case" on: the target first, then the requirements it
// realises, then the other use cases.
export const useCaseSection = (s, at = 0) => sentText(s, at).split("## The use case, the requirements it realises, and every other use case")[1] ?? "";

// The text the participant was sent in its n-th request, and the requirements that request names to change: the headings under "The requirements to change".
export const sentText = (s, at = 0) => s.endpointRequests[at].body.messages.map((message) => message.content).join("\n");
export const targetsOf = (s, at = 0) => {
  const from = sentText(s, at).split("## The requirements to change, each with its whole section")[1] ?? "";
  return [...from.split("\n## Every requirement of the product")[0].matchAll(/^### (.+)$/gm)].map((match) => match[1]);
};
// The draft the bar keeps in the tab for the page's subject, the address of the route `draft` for a subject's key, and the lines of a commit message.
export const keptDraft = (s) => readTabValue(s.store, "prompt-bar:draft");
export const draftAddress = (s, key) => `#draft/subject=${encodeURIComponent(key)}/product=${encodeURIComponent(s.address)}`;
export const messageLines = (write) => write.message.split("\n");
