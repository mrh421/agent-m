// The prompt bar sends every message as the one kind `converse`, whatever the page, and carries out the hand-over its participant proposes without a further click (UC-049 step 3, 4a), as
// docs/architecture/MOD-prompt-bar.md states it: "it sends each message as a job of its one kind, `converse`, on every page, with the page as its context only"; "A subject is context only: it
// never chooses the kind a message runs, which is always `converse`, nor what the participant may do beyond what `refuses` takes away"; "A hand-over the participant proposed (UC-049 4a) is shown
// with its kind, what it works on and its task, and goes on at once: the person's *Send* was the request, and no further click is asked for. Where the kind's `review` is `person` and `eligible`
// finds the participant able to do it, it runs in this tab, attended, as a message runs … its parameters are the subject's `paramsFor` less `page`, with what MOD-job-runner's `handOverParams`
// gives for what it works on, its task as `instruction` … nothing is written, and its result is kept as the `ConversationDraft` of that kind, which *Review the draft* leads to … A finding that
// keeps it from starting — a change of requirements without the person's own source among them — is named, and nothing runs." And MOD-trace-pages' specification subject: "context only … the
// page and, on the default branch, the open requirement, or the group with the names it holds, as `requirements`, the person's own source where the product links one".
// Run: node --test tests/prompt-bar-one-kind.test.mjs
//
// Module: MOD-prompt-bar · MOD-trace-pages · MOD-site-frame
// Guards: UC-049; UC-019; THE PERSON WHO PROMPTS IS A SOURCE; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK; A SPEC EDIT IS SAVED AS A PROPOSAL; A DRAFTED CHANGE IS SHOWN AGAINST THE CURRENT TEXT
// Level: component
//
// The small DOM, the store, the repositories in memory and the endpoint behind `fetch` are those of tests/prompt-bar.test.mjs, copied. The real MOD-job-runner, MOD-runtimes, MOD-job-catalogue,
// MOD-spec-changes' strategies (registered here, as the frame registers a view's), MOD-trace-pages' subject and MOD-site-frame's subjectOf run as they are; the book's chapters are a fixture
// recipe that gives no part. The endpoint answers in turn and keeps every request, so that the kind each request runs is read from the prompt it carries. Readings the texts leave open, which
// the tests state (the pull request names them): the prompt of a kind begins with its prompt.md's first sentence; the subjects of the requirements page are built by MOD-trace-pages' subjectOf
// with what the view has kept when drawn (`shown`), wrapped by MOD-site-frame's subjectOf as the frame wraps every route's subject.
// Each test states its input and its expected result before it runs (given / input / expect). The counter-proofs are recorded in the pull request.

import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { openStore, readTabValue, writeSetting } from "../src/browser-store/index.mjs";
import { registerStrategies } from "../src/job-runner/index.mjs";
import { latestDraft, startPromptBar } from "../src/prompt-bar/index.mjs";
import { specStrategies } from "../src/spec-changes/index.mjs";
import { parseSpec } from "../src/spec-document/index.mjs";
import { subjectOf as traceSubject } from "../src/trace-pages/subject.mjs";
import { subjectOf as frameSubject } from "../src/site-frame/subject.mjs";
import { tick, until } from "./prompt-bar.d/until.mjs";

// ---------------------------------------------------------------- the part of a browser's DOM that is used

class Text { constructor(data) { this.data = String(data); this.parentNode = null; } get textContent() { return this.data; } }
class Element extends EventTarget {
  constructor(name) {
    super();
    Object.assign(this, { localName: name, childNodes: [], className: "", value: "", type: "", hidden: false, disabled: false, parentNode: null, attrs: {}, html: "" });
  }
  append(...nodes) { for (const node of nodes.flat()) { const child = typeof node === "string" ? new Text(node) : node; this.childNodes.push(child); child.parentNode = this; } }
  replaceChildren(...nodes) { this.childNodes = []; this.append(...nodes); }
  setAttribute(name, value) { this.attrs[name] = String(value); }
  getAttribute(name) { return this.attrs[name] ?? null; }
  set innerHTML(value) { this.html = String(value); }
  get innerHTML() { return this.html; }
  get textContent() { return this.html + this.childNodes.map((child) => child.textContent).join(""); }
  focus() {}
}
globalThis.document = { createElement: (name) => new Element(name) };

const all = (root, check) => { const found = []; (function visit(node) { for (const child of node.childNodes ?? []) if (child instanceof Element) { if (check(child)) found.push(child); visit(child); } })(root); return found; };
const byClass = (root, name) => all(root, (node) => node.className.split(" ").includes(name));
const one = (root, name) => byClass(root, name)[0];
const textOf = (node) => node.textContent;
const click = (node) => node.dispatchEvent(new Event("click"));
const trusted = () => Object.defineProperty(new Event("click"), "isTrusted", { value: true });

class Storage {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
  get length() { return this.values.size; }
  key(index) { return [...this.values.keys()][index] ?? null; }
}

// ---------------------------------------------------------------- the store, the hosts, the endpoint

const COLUMNS = "| Name | Type | Model | Context | Price | Capabilities | Processing place | Route |\n|---|---|---|---|---|---|---|---|";
const REGISTER = `# Participants of this instance\n\n${COLUMNS}\n| drafter-a | model endpoint | model-drafter-a | 200000 | — | draft text | Anthropic, USA | endpoint ep1 |\n`;
const failure = (name, fields = {}) => Object.assign(new Error(`${name} ${JSON.stringify(fields)}`), { name }, fields);
const sha = (n) => createHash("sha1").update(`commit ${n}`).digest("hex");

// One repository in memory whose default branch is `trunk`; every commit attempt is kept.
function fakeRepo(web, files) {
  const commits = new Map(), attempts = [];
  let made = 0;
  const commitOf = (tree) => { const id = sha(`${web}${++made}`); commits.set(id, tree); return id; };
  const head = commitOf(new Map(Object.entries(files)));
  const [owner, name] = web.replace("https://github.com/", "").split("/");
  const repository = { server: "github", origin: "https://github.com", path: `${owner}/${name}`, web };
  return {
    attempts,
    host: {
      async repositoryInfo() { return { defaultBranch: "trunk", visibility: "public", canWrite: true, archived: false, description: "" }; },
      async readSnapshot(ref) {
        const tree = commits.get(ref === "trunk" ? head : ref);
        if (!tree) throw failure("NotFound", { what: ref });
        return { repository, ref, commit: ref === "trunk" ? head : ref, paths: [...tree.keys()].sort(), read: async (path) => (tree.has(path) ? tree.get(path) : null), blob: () => null };
      },
      async listPullRequests() { return []; },
      async commitFiles(change) { attempts.push(structuredClone(change)); throw failure("Moved", { head }); },
      async startWorkflow(...args) { attempts.push({ startWorkflow: args }); },
    },
  };
}

const INSTANCE_WEB = "https://github.com/alice/agent-m";
const PRODUCT_WEB = "https://github.com/alice/thesis-tool";
const LOAN = "A LOAN HAS A DUE DATE", SHELF = "A BOOK IS SHELVED";
const SPEC = `# Thesis tool — Specification\n\n## 1. Lending\n\n**${LOAN}** *(SRC-alice)*\nEvery loan states the date by which the book is returned.\n*Check:* \`tests/loan.test.mjs\`\n\n**${SHELF}** *(SRC-alice)*\nEvery book stands on a shelf.\n*Check:* \`tests/shelf.test.mjs\`\n`;
const PERSON = "SRC-alice";

// The strategies the kinds name: MOD-spec-changes' own, and a fixture for the book's chapters that gives no part.
registerStrategies("tests/prompt-bar-one-kind.test.mjs:spec-changes", specStrategies);
registerStrategies("tests/prompt-bar-one-kind.test.mjs", { recipes: { "chapters-for-page": async () => [], "chapters-for-requirements": async () => [] } });

// The prompts by which a request is known: the first sentence of each kind's prompt.md.
const CONVERSE = "You answer a person's message about the page they are looking at";
const CHANGE_REQUIREMENTS = "You change requirements of a product";
const CHANGE_USE_CASE = "You change a use case of a product";

// The model endpoint ep1 behind the global fetch: it answers the drafts given in turn (the last again), and keeps every request.
let requests = [];
const realFetch = globalThis.fetch;
function endpointAnswers(...drafts) {
  requests = [];
  const queue = [...drafts];
  globalThis.fetch = async (url, init) => {
    requests.push({ url: String(url), body: String(init?.body ?? "") });
    const draft = queue.length > 1 ? queue.shift() : queue[0];
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ draft, answers: [] }) } }], usage: { prompt_tokens: 10, completion_tokens: 5 } }),
      { status: 200, headers: { "content-type": "application/json" } });
  };
}
test.afterEach(() => { globalThis.fetch = realFetch; });

// ---------------------------------------------------------------- the pages

// The subject of the requirements page as the frame gives it: MOD-trace-pages' subject of the specification view with what it kept when drawn, wrapped by MOD-site-frame's subjectOf.
function requirementsPage({ requirements = [], groups = [], source = PERSON } = {}) {
  const shown = { target: { textContent: "Specification — 1. Lending: A LOAN HAS A DUE DATE, A BOOK IS SHELVED" }, ref: undefined, onDefaultBranch: true, spec: parseSpec(SPEC), source,
    requirements, groups };
  const context = { product: { address: PRODUCT_WEB }, instance: { repository: "alice/agent-m" } };
  const route = { name: "trace", title: "Specification", entry: "requirements", subject: (params, given) => traceSubject({ title: "Specification", params, context: given, shown }) };
  return frameSubject({ route, params: { key: "specification" }, context, drawn: () => shown.target.textContent });
}
// The subject of a use case's page as MOD-review-pages gives it, and — as a subject made before this change would — still naming a kind of its own, which the bar must not run.
const useCasePage = () => ({ key: `use-case/id=UC-007/product=${encodeURIComponent(PRODUCT_WEB)}`, title: "UC-007 Derive use cases", entry: "use-cases", kind: "change-use-case",
  paramsFor: () => ({ page: "The page shows UC-007 Derive use cases.", useCase: "UC-007", version: "0123456789abcdef0123456789abcdef01234567" }),
  draftRoute: `draft/subject=${encodeURIComponent(`use-case/id=UC-007/product=${encodeURIComponent(PRODUCT_WEB)}`)}`, withhold: null, refuses: [] });

// A page of a product: the instance with its register, a store keeping the endpoint ep1 and the product's token, and the bar started with the subject given.
function page(subject) {
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: new Storage() });
  Object.defineProperty(globalThis, "sessionStorage", { configurable: true, value: new Storage() });
  const store = openStore("alice/agent-m");
  writeSetting(store, "endpoint:ep1", { kind: "openai-compatible", url: "https://models.example/v1", model: "model-drafter-a", key: "sk-fixture" });
  writeSetting(store, "github-token:alice/thesis-tool", { value: "github_pat_FIXTURE0123456789abcdef", name: "alice", expires: "2027-01-01" });
  const instance = fakeRepo(INSTANCE_WEB, { "docs/participants.md": REGISTER });
  const product = fakeRepo(PRODUCT_WEB, { "SPEC.md": SPEC, ".github/workflows/agent-m-jobs.yml": "name: agent-m-jobs\n" });
  const target = document.createElement("div");
  const gone = [];
  startPromptBar(target, { page: "main", store, instance: { repository: "alice/agent-m", host: instance.host }, product: () => ({ address: PRODUCT_WEB, host: product.host }),
    subject: () => subject, explain: () => document.createElement("details"), go: (route, params) => gone.push({ route, params }) });
  return { store, instance, product, target, gone };
}
const drawn = (it) => until(() => it.target.childNodes.length > 0, "the bar is drawn");
async function sends(it, words) {
  one(it.target, "instruction").value = words;
  one(it.target, "send").dispatchEvent(trusted());
  await until(() => !one(it.target, "stop") || one(it.target, "stop").disabled, "the message has run");
  await tick();
}
const kindOfRequest = (request) => (request.body.includes(CHANGE_REQUIREMENTS) ? "change-requirements" : request.body.includes(CHANGE_USE_CASE) ? "change-use-case"
  : request.body.includes(CONVERSE) ? "converse" : "other");

// ---------------------------------------------------------------- one kind on every page

// TST-1360001 · level: component · module: MOD-prompt-bar
// guards: UC-049; UC-019
// given: the requirements page with nothing open; the requirements page with the group "1. Lending" open (A LOAN HAS A DUE DATE, A BOOK IS SHELVED); the page of the use case UC-007, whose subject still names the kind change-use-case; an endpoint that answers "Noted."
// input: Send "what does this page say?" on each
// expect: on each, exactly one request, and it carries the prompt of `converse` and no prompt of a change kind; its page holds what is open — the group's names, the use case —; the answer "Noted." is shown; nothing is written
test("TST-1360001: the bar sends converse on the requirements page with nothing open, with a group open, and on a use case page", async () => {
  const group = { heading: "1. Lending", path: "docs/groups/requirements.md", names: [LOAN, SHELF] };
  const cases = [["nothing open", requirementsPage(), "Specification"], ["a group open", requirementsPage({ groups: [group] }), SHELF], ["a use case", useCasePage(), "UC-007"]];
  for (const [name, subject, onThePage] of cases) {
    endpointAnswers({ answer: "Noted." });
    const it = page(subject);
    await drawn(it);
    await sends(it, "what does this page say?");
    assert.deepEqual(requests.map(kindOfRequest), ["converse"], `${name}: one request, of converse`);
    assert.ok(requests[0].body.includes(onThePage), `${name}: the page given holds ${onThePage}`);
    assert.ok(textOf(one(it.target, "answer")).includes("Noted."), name);
    assert.deepEqual([...it.instance.attempts, ...it.product.attempts], [], `${name}: nothing is written`);
  }
});

// ---------------------------------------------------------------- a hand-over carried out in the tab

// TST-1360002 · level: component · module: MOD-prompt-bar
// guards: UC-049; UC-019; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK; A DRAFTED CHANGE IS SHOWN AGAINST THE CURRENT TEXT; A SPEC EDIT IS SAVED AS A PROPOSAL
// given: the requirements page with nothing open, the person's own source SRC-alice linked; an endpoint that answers the conversation with a hand-over { kind change-requirements, works_on [A LOAN HAS A DUE DATE], task "say when it is overdue" }, and the change of requirements with one candidate that changes it
// input: Send "the loan should say when it is overdue" — one click — and nothing else
// expect: the conversation's request, then change-requirements' — as many rounds as its correction loop takes —, whose first text holds the task and the requirement —, with no button "Hand over" ever shown; a button "Review the draft"; pressing it goes to "draft/subject=<the subject's key, encoded>" and the tab keeps the draft of kind change-requirements, its parameters naming the requirement and the source SRC-alice, its draft the candidate; nothing was written to any repository
test("TST-1360002: a hand-over to change-requirements runs in the tab without a further click, and its draft waits for the person's Save", async () => {
  const candidate = { name: LOAN, rule: "Every loan states its due date and says when it is overdue.", check: "`tests/loan.test.mjs`", constrains: "product", passage: "the instruction", class: "change", of: LOAN };
  endpointAnswers({ answer: "I hand this to the change of requirements.", handOver: { kind: "change-requirements", works_on: [LOAN], task: "say when it is overdue" } }, { candidates: [candidate] });
  const subject = requirementsPage();
  const it = page(subject);
  await drawn(it);
  await sends(it, "the loan should say when it is overdue");
  await until(() => one(it.target, "review"), "the draft of the hand-over is ready");
  assert.equal(kindOfRequest(requests[0]), "converse");
  assert.ok(requests.length >= 2 && requests.slice(1).every((each) => kindOfRequest(each) === "change-requirements"), requests.map(kindOfRequest).join(", "));
  assert.ok(requests[1].body.includes("say when it is overdue") && requests[1].body.includes(LOAN));
  assert.equal(byClass(it.target, "queue").length, 0, "no Hand over is asked for");
  click(one(it.target, "review"));
  assert.deepEqual(it.gone, [{ route: `draft/subject=${encodeURIComponent(subject.key)}`, params: undefined }]);
  const draft = latestDraft(it.store, subject.key);
  assert.equal(draft.kind, "change-requirements");
  assert.deepEqual(draft.params.requirements, [LOAN]);
  assert.equal(draft.params.source, PERSON);
  assert.deepEqual(draft.result.draft.candidates.map((each) => each.name), [LOAN]);
  assert.deepEqual([...it.instance.attempts, ...it.product.attempts], [], "nothing is written before the person saves");
});

// TST-1360003 · level: component · module: MOD-prompt-bar
// guards: UC-049; UC-019 4b; THE PERSON WHO PROMPTS IS A SOURCE
// given: the requirements page, and no source of the person that the product links; the same hand-over to change-requirements
// input: Send "the loan should say when it is overdue"
// expect: one request only, the conversation's — its answer shown —; the page names the finding under THE PERSON WHO PROMPTS IS A SOURCE; no draft is kept and nothing is written
test("TST-1360003: a hand-over to change-requirements without the person's own source names the finding and runs nothing", async () => {
  endpointAnswers({ answer: "I hand this on.", handOver: { kind: "change-requirements", works_on: [LOAN], task: "say when it is overdue" } }, { candidates: [] });
  const subject = requirementsPage({ source: null });
  const it = page(subject);
  await drawn(it);
  await sends(it, "the loan should say when it is overdue");
  await until(() => textOf(it.target).includes("THE PERSON WHO PROMPTS IS A SOURCE"), "the finding is named");
  assert.deepEqual(requests.map(kindOfRequest), ["converse"]);
  assert.ok(textOf(one(it.target, "answer")).includes("I hand this on."));
  assert.equal(readTabValue(it.store, "prompt-bar:draft"), null);
  assert.deepEqual([...it.instance.attempts, ...it.product.attempts], []);
});

// TST-1360004 · level: component · module: MOD-prompt-bar · MOD-job-runner
// guards: UC-049 3b; A PARTICIPANT THAT WRITES TO A REPOSITORY NEVER RECEIVES A MAIL
// given: a page whose subject refuses propose-edit and hand-over, as a page of mail does; an endpoint whose answer holds, in its JSON, an edit and a hand-over to change-use-case
// input: Send "answer the reporter"
// expect: one request only; no hand-over is shown or carried out, no "Review the draft" is offered, no draft is kept, nothing is written
test("TST-1360004: on a page that refuses hand-over and propose-edit, an answer that holds them hands nothing on", async () => {
  endpointAnswers({ answer: "Here is a reply.", edits: [{ path: "docs/x.md", text: "# X\n" }], handOver: { kind: "change-use-case", works_on: ["UC-007"], task: "change it" } });
  const it = page({ ...useCasePage(), kind: undefined, refuses: ["propose-edit", "hand-over"] });
  await drawn(it);
  await sends(it, "answer the reporter");
  for (let turn = 0; turn < 20; turn += 1) await tick();
  assert.deepEqual(requests.map(kindOfRequest), ["converse"]);
  assert.equal(byClass(it.target, "hand-over").length, 0);
  assert.equal(byClass(it.target, "review").length, 0);
  assert.equal(readTabValue(it.store, "prompt-bar:draft"), null);
  assert.deepEqual([...it.instance.attempts, ...it.product.attempts], []);
});

// TST-1360005 · level: unit · module: MOD-trace-pages; MOD-prompt-bar
// guards: UC-049; THE PERSON WHO PROMPTS IS A SOURCE
// given: the specification view kept while the head's graph is stored: the earlier version shown (onDefaultBranch false, asOf set) with the person's own source SRC-po-fixture, nothing open; known positive: the same at a released version the person chose, whose page read no source, gives none
// input: MOD-trace-pages' subjectOf, then its paramsFor
// expect: paramsFor gives source SRC-po-fixture — a message spawned in the read-only minutes after a push hands its change on with the person's source (JOB-20261026-2011-8761 was refused without it) —; at the released version no source
test("TST-1360005: the person's own source is given while the earlier version is shown after a push", () => {
  const spec = { requirements: new Map(), sections: [] };
  const base = { target: { textContent: "" }, spec, requirements: [], groups: [] };
  const earlier = traceSubject({ title: "Current requirements", params: { key: "specification", ref: "main" }, context: { product: null },
    shown: { ...base, ref: "e".repeat(40), onDefaultBranch: false, asOf: "As of eeeeeee: …", source: "SRC-po-fixture" } });
  assert.equal(earlier.paramsFor({}).source, "SRC-po-fixture");
  const released = traceSubject({ title: "Current requirements", params: { key: "specification", ref: "v2026.1.0" }, context: { product: null },
    shown: { ...base, ref: "v2026.1.0", onDefaultBranch: false, asOf: null, source: null } });
  assert.equal(released.paramsFor({}).source, undefined);
});
