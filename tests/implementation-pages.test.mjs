// MOD-implementation-pages' route `process` — How this product is developed (UC-002), as docs/architecture/
// MOD-implementation-pages.md states it and ITM-222 builds it: the five catalogue models with what their `about` holds
// (step 2); the model's roles, each with how many fill it and the participants that hold every capability it needs and
// where they process data, a role no participant can hold named by its missing capability; the findings of
// declarationFindings beside the form's fields, among them a participant the declaration names, which disables Save — a
// declaration names roles, never a participant, and the role assignments fill them (UC-048); phases, gates and branches;
// practices; what the product's process requirements add, or that it has none (7a); the Definition of Done; Save, which
// writes the product's
// docs/process.md with saveFile as the person's own commit, naming model_version by the commit the catalogue's instance
// was read at (step 9); selecting another model lists the kinds of artifact the declared model's phases produce that
// the selected one's do not, deleting nothing (3b); and a refused save keeps the person's edit.
//
// Run: node --test tests/implementation-pages.test.mjs
//
// Module: MOD-implementation-pages
// Guards: UC-002; THE PROCESS MODEL IS DECLARED PER PRODUCT; A PERSON'S OWN INPUT IS COMMITTED DIRECTLY; ONE CLICK PER DECISION; EVERY STEP EXPLAINS ITSELF; A ROLE NAMES THE CAPABILITIES IT NEEDS; THE PROCESS NAMES ROLES, NOT PARTICIPANTS
// Level: unit
//
// Not part of ITM-222, and not tested here: the comparison of two versions of the declared model when the catalogue's
// version differs from the one the declaration names (UC-031 6a), and how the dashboard reaches this route.
//
// Each test names the requirement it guards and states its input and its expected result before it runs (given / input
// / expect). Node has no DOM: this file takes the small one of tests/site-frame-dom.mjs,
// so that schemaForm, its editors and explain run as they do in a browser. Nothing waits but the turn of the event loop
// in which a form answers, and nothing reaches the network: the repositories the route reads and writes are fixtures
// held in memory, through a Host of this file's own that answers MOD-repository-hosts' interface.

import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";

// The document is that of the frame's fixture DOM, tests/site-frame-dom.mjs, installed as the globals `document` and `window` when it is imported.
import "./site-frame-dom.mjs";

// The modules, loaded once the document is there. MOD-implementation-pages' route `process` is exercised through its
// Route; every other module is used as the route itself uses it.
const { route } = await import("../src/implementation-pages/process.mjs");
const { loadSchema, readDocument, writeDocument } = await import("../src/documents/index.mjs");
const { declarationSchema } = await import("../src/product-process/index.mjs");
const { participantSchema } = await import("../src/participant-list/index.mjs");
const { sourceSchemas } = await import("../src/source-register/index.mjs");
const { modelSchema, catalogue, modelFindings } = await import("../src/model-catalogue/index.mjs");

// ---------------------------------------------------------------- helpers: the DOM of a schemaForm (as tests/site-frame
// ---------------------------------------------------------------- .test.mjs reads it), and a fixture repository

// The elements below `root`, in tree order, that `match` accepts.
function elements(root, match) {
  const found = [];
  (function walk(n) { for (const k of n.childNodes) if (k.nodeType === 1) { if (match(k)) found.push(k); walk(k); } })(root);
  return found;
}
const byTag = (root, name) => elements(root, (e) => e.localName === name);
const byClass = (root, name) => elements(root, (e) => e.className.split(" ").includes(name));
const byData = (root, attr, value) => elements(root, (e) => e.getAttribute(attr) === value);
// What a person's typing does: the field holds the new text, and an input event follows.
const type = (field, text) => { field.value = text; field.dispatchEvent(new Event("input")); };
// The turn of the event loop in which a form answers what was done to it.
const turn = () => new Promise((resolve) => setImmediate(resolve));
// A person's click, and the turn in which the page answers it.
// A person's click: a browser marks it trusted (`isTrusted`); node marks every Event untrusted, as a script's.
const click = async (button) => { button.dispatchEvent(Object.defineProperty(new Event("click"), "isTrusted", { value: true })); await turn(); };

const fieldsOf = (form) => byClass(form, "field");
const nameOf = (field) => field.getAttribute("data-key") ?? field.getAttribute("data-section");
const fieldOf = (form, name) => fieldsOf(form).find((field) => nameOf(field) === name);
const inputOf = (form, key) => byTag(fieldOf(form, key), "input")[0];
const areaOf = (form, heading) => byTag(fieldOf(form, heading), "textarea")[0];
const besideOf = (field) => [...byClass(field, "findings")[0].children].map((finding) => finding.textContent);
// The form's own Save, as tests/site-frame.test.mjs finds it: each section's editor brings a Save of its own (not
// hooked up: "the form's one Save does"), appended before the fields that follow it, so the form's own Save — which
// schemaForm appends last, after every field — is the last button in tree order, even once this route's own panels,
// which hold none, are appended after it.
const saveOf = (form) => byTag(form, "button").at(-1);

// A 40-hex-digit sha1, as MOD-documents' type "sha" digits 40 needs for model_version, and a 64-hex-digit one for a
// link's Hash.
const sha1 = (text) => createHash("sha1").update(text).digest("hex");
const sha256 = (text) => createHash("sha256").update(text).digest("hex");

// A Snapshot of MOD-repository-hosts, over a fixed map of path -> text.
function fakeSnapshot(files, commit) {
  return {
    repository: { server: "github", origin: "https://github.com", path: "fixture/repo", web: "https://github.com/fixture/repo" },
    ref: "main", commit, paths: Object.keys(files),
    async read(path) { return Object.hasOwn(files, path) ? files[path] : null; },
    blob(path) { return Object.hasOwn(files, path) ? sha1(`blob:${path}:${files[path]}`) : null; },
  };
}

// A Host of MOD-repository-hosts over a fixture repository held in memory: readSnapshot, repositoryInfo and commitFiles,
// which is all saveFile and the route's own reads call. _setFile simulates a change made elsewhere, outside this page.
function fakeHost(files, commit) {
  let current = fakeSnapshot(files, commit);
  const commits = [];
  return {
    commits,
    async repositoryInfo() { return { defaultBranch: "main", visibility: "public", canWrite: true, archived: false, description: "" }; },
    async readSnapshot() { return current; },
    async commitFiles(change) {
      commits.push(change);
      const next = { ...current.paths.reduce((o, p) => ({ ...o, [p]: files[p] }), {}) };
      for (const f of change.files) { if (f.delete) delete next[f.path]; else next[f.path] = f.text; }
      files = next;
      current = fakeSnapshot(files, sha1(`commit:${commits.length}:${JSON.stringify(next)}`));
      return { commit: current.commit, url: "https://example.test/commit" };
    },
    _setFile(path, text) { files = { ...files, [path]: text }; current = fakeSnapshot(files, sha1(`external:${path}:${text}`)); },
  };
}

// ---------------------------------------------------------------- the fixture repositories: an instance and a product

const INSTANCE_COMMIT = sha1("fixture-instance-head");

const PARTICIPANTS = `# Participants of this instance

Fixture participants for a test.

| Name | Type | Model | Context | Price | Capabilities | Processing place | Route |
|---|---|---|---|---|---|---|---|
| alice | person | — | — | — | draft text, write to the repository, run code and tests | — | account github/alice |
| bot-a | CI agent | fixture-endpoint | — | — | write to the repository, run code and tests | a lab | ci hosted secret BOT_A |
| bot-b | CI agent | fixture-endpoint | — | — | draft text | NHR@FAU, Erlangen | ci hosted secret BOT_B |
`;

const FIXTURE_MODEL_PATH = "docs/process-models/fixture-model.md";
const FIXTURE_MODEL = `---
name: fixture-model
kind: planned
measure: plan entries per phase
---
# Fixture model

## About

manages: the fixture risk it manages
accepts: the fixture risk it accepts
example: a fixture project
chapter: 9, Fixtures

## Phases

| Name | Role | Produces |
|---|---|---|
| Design | Owner | ARC |
| Build | Developers | ITM |

## Transitions

| From | To | Kind |
|---|---|---|
| Design | Build | sequence |

## Verification pairs

| Phase | Checked by |
|---|---|

## Gates

| Between | Artifacts | Condition | Decider |
|---|---|---|---|
| Design → Build | ARC | accepted | Owner |

## Roles

| Name | Filled by | How many | Capabilities |
|---|---|---|---|
| Owner | person | one | draft text |
| Reviewer | either | several | use tools |
| Developers | either | several | write to the repository, run code and tests |
`;

const SPEC_TEXT = `# SPEC

## 1. Fixture

**A FIXTURE REQUIREMENT** *(PO Fixture)*
Fixture text for a test.
*Check:* no automatic check.
`;

// An instance snapshot with the participants, the fixture model, the instance's SPEC, and, when `practiceAdds` is given,
// a devops practice that adds it.
function instanceFiles({ practiceAdds = null, participants = PARTICIPANTS } = {}) {
  const files = { "docs/participants.md": participants, [FIXTURE_MODEL_PATH]: FIXTURE_MODEL, "SPEC.md": SPEC_TEXT };
  if (practiceAdds !== null) files["src/model-catalogue/practices/devops.md"] = `---
name: devops
fits:
  - scrum
  - kanban
---
# DevOps

## Adds

${practiceAdds}

## What it is

Fixture practice.
`;
  return files;
}

// A declaration text declaring fixture-model: it names the model's roles, never a participant; `done` is its Definition of
// Done.
function declarationText({ done = "The job rules hold; no condition is added." } = {}) {
  return `---
model: fixture-model
model_file: ${FIXTURE_MODEL_PATH}
model_version: ${INSTANCE_COMMIT}
---
# How the fixture product is developed

## Roles

The roles of fixture-model — Owner, Reviewer and Developers —, filled in the product's role assignment.

## Practices

- none

## Branches

| Phase or time box | Branch |
|---|---|

## Definition of Done

${done}
`;
}

// A ViewContext of MOD-site-frame over two fake hosts: the instance's and the product's.
function contextOf(instanceHost, productHost) {
  return {
    page: "review",
    instance: { repository: "fixture/instance", host: instanceHost },
    product: { address: "fixture/product", kind: "github", host: productHost },
    store: { async get() { return null; }, async set() {} },
    go() {},
  };
}

// A target connected to the document, as a route's render expects, removed after the test.
function connectedTarget() {
  const target = document.createElement("div");
  document.body.append(target);
  return target;
}

// ---------------------------------------------------------------- the five catalogue models (step 2)

// TST-472266 · level: unit · module: MOD-implementation-pages
// guards: UC-002
// given: a product without docs/process.md, an instance with no custom model of its own
// input: route.render(target, context)
// expect: the page shows a card for each of the five shipped models — waterfall, v-model and reuse-oriented in the plan-driven group, scrum and kanban in the agile one —, each naming what catalogue() itself gives for its about: the risk it manages, the risk it accepts, the example project and the chapter
test("process route — the five catalogue models, in two groups, each with what its about holds", async () => {
  const instanceHost = fakeHost({ "docs/participants.md": PARTICIPANTS, "SPEC.md": SPEC_TEXT }, INSTANCE_COMMIT);
  const productHost = fakeHost({}, sha1("product-head"));
  const target = connectedTarget();

  await route.render(target, contextOf(instanceHost, productHost));

  const cat = await catalogue(fakeSnapshot({ "docs/participants.md": PARTICIPANTS }, INSTANCE_COMMIT));
  const cards = byClass(target, "model-card");
  assert.deepEqual(cards.map((card) => card.getAttribute("data-model")).sort(),
    ["kanban", "reuse-oriented", "scrum", "v-model", "waterfall"].sort());
  for (const card of cards) {
    const model = cat.models.find((m) => m.name === card.getAttribute("data-model"));
    assert.ok(model.about, `known positive: the shipped model ${model.name} has an About`);
    for (const value of [model.about.manages, model.about.accepts, model.about.example, model.about.chapter]) {
      assert.ok(card.textContent.includes(value), `the card of ${model.name} shows "${value}"`);
    }
  }
  // assert.ok on a plain === , not assert.equal/notEqual: on a mismatch, these are DOM-like objects, not worth
  // formatting a diff of.
  const groups = byClass(target, "model-group");
  const groupOf = (name) => groups.find((g) => byClass(g, "model-card").some((c) => c.getAttribute("data-model") === name));
  assert.ok(groupOf("scrum") !== groupOf("waterfall"), "the agile and the plan-driven models stand in different groups");
  assert.ok(groupOf("v-model") === groupOf("waterfall"), "waterfall and v-model stand in the same, plan-driven group");
  assert.ok(groupOf("kanban") === groupOf("scrum"), "scrum and kanban stand in the same, agile group");

  target.remove();
});

// ---------------------------------------------------------------- a product without, and one with, a declaration (1)

// TST-472267 · level: unit · module: MOD-implementation-pages
// guards: UC-002
// given: a product whose repository holds no docs/process.md
// input: route.render(target, context)
// expect: no exception; the form shows an empty field for the declaration's keys, model among them, holding no value
test("process route — the page of a product without a declaration", async () => {
  const instanceHost = fakeHost(instanceFiles(), INSTANCE_COMMIT);
  const productHost = fakeHost({}, sha1("empty-product-head"));
  const target = connectedTarget();

  await route.render(target, contextOf(instanceHost, productHost));

  const form = byClass(target, "schema-form")[0];
  assert.ok(form, "the page holds a form");
  assert.equal(inputOf(form, "model").value, "");
  const offered = byClass(target, "model-card").map((card) => card.getAttribute("data-model"));
  for (const name of ["waterfall", "v-model", "reuse-oriented", "scrum", "kanban"]) {
    assert.ok(offered.includes(name), `${name} is offered to choose from`);
  }

  target.remove();
});

// TST-472268 · level: unit · module: MOD-implementation-pages
// guards: UC-002; THE PROCESS NAMES ROLES, NOT PARTICIPANTS
// given: a product declaring fixture-model, its roles named and no participant
// input: route.render(target, context), built and inserted in the one turn of its own microtask queue
// expect: the model and model_file fields hold the declared model; the form has no field that assigns participants to roles; each role of the model is shown with how many fill it; once the turn in which render awaited is over, the page's first field has the focus — known positive: before render, the document's active element is its body, not a form field
test("process route — the page of a product with a declaration, its first field focused", async () => {
  const instanceHost = fakeHost(instanceFiles(), INSTANCE_COMMIT);
  const productHost = fakeHost({ "docs/process.md": declarationText() }, sha1("product-head-2"));
  const target = connectedTarget();
  assert.notEqual(document.activeElement.localName, "input", "known positive: nothing is focused before the page renders");

  await route.render(target, contextOf(instanceHost, productHost));
  await turn();

  const form = byClass(target, "schema-form")[0];
  assert.equal(inputOf(form, "model").value, "fixture-model");
  assert.equal(inputOf(form, "model_file").value, FIXTURE_MODEL_PATH);
  assert.ok(!fieldOf(form, "sprint_close"), "the form has no field that names a participant");
  assert.ok(!byTag(form, "textarea").some((area) => /\| Role \| Participants \|/.test(area.value)),
    "no field of the form holds a table of roles and participants");
  assert.match(byClass(byData(target, "data-role", "Owner")[0], "how-many")[0].textContent, /one participant fills it/);
  assert.match(byClass(byData(target, "data-role", "Developers")[0], "how-many")[0].textContent, /several participants may fill it/);
  // assert.ok, not assert.equal: on a mismatch, formatting these DOM-like objects for a diff is not worth the cost.
  assert.ok(document.activeElement === inputOf(form, "model"), "the form's first field is focused");

  target.remove();
});

// ---------------------------------------------------------------- the page of a product with Agent M's own declaration
//
// This repository's own files as they stood on origin/sprint/06 — docs/participants.md, and, at the commit the
// declaration's model_version names (4c60cfe5a8bc8c00dcf6705b5decb42823b73a63), docs/process-models/scrum-wip.md with the
// column How many that the model schema now requires —, and its docs/process.md in the form a declaration has now: the
// model, practices, branches and Definition of Done, its roles named and no participant. The instance SPEC is fixture text
// (SPEC_TEXT, above): no test opens SPEC.md.

const AGENT_M_MODEL_VERSION = "4c60cfe5a8bc8c00dcf6705b5decb42823b73a63";
const AGENT_M_SCRUM_WIP_PATH = "docs/process-models/scrum-wip.md";

// docs/process-models/scrum-wip.md as it stood at commit 4c60cfe5a8bc8c00dcf6705b5decb42823b73a63 (git show), with the
// column How many of its roles.
const AGENT_M_SCRUM_WIP = `---
name: scrum-wip
kind: pulled
adapted_from: scrum
measure: items per state over time
---

# Scrum with a work-in-progress limit

**REGISTER**

A process model of this instance (UC-031), adapted from the shipped Scrum model: the flow is controlled by a
work-in-progress limit of 4 instead of a time box; sprints keep a selection the Product Owner makes and have no fixed
length; release tests have a role of their own.

An item counts as in progress from the moment its team starts it until its pull request is merged into the sprint
branch; an item waiting for review counts. A sprint works on the selection the Product Owner made at Sprint planning.
It ends when every selected item is done or the Product Owner ends it; then the review of its increment and the
retrospective are recorded, and then the Product Owner decides the merge of the sprint branch into \`main\`.

## Phases

| Name | Role | Produces |
|---|---|---|
| Sprint planning | Product Owner | ITM (the sprint's selection of backlog items) |
| Development | Developers | MOD (code of the item's modules), TST |
| Release testing | Release tester | TST (release tests of the selected items) |
| Sprint review | Product Owner | sprint record (the review of the increment) |
| Retrospective | Product Owner | sprint record (the retrospective) |

## Transitions

| From | To | Kind |
|---|---|---|
| Sprint planning | Development | sequence |
| Development | Release testing | sequence |
| Release testing | Development | back |
| Release testing | Sprint review | sequence |
| Sprint review | Retrospective | sequence |
| Retrospective | Sprint planning | sequence |

## Verification pairs

| Phase | Checked by |
|---|---|
| Development | Release testing |
| Sprint planning | Sprint review |

## Gates

| Between | Artifacts | Condition | Decider |
|---|---|---|---|
| Development → Release testing | the item's pull request into the sprint branch, with its code and TST | CI is green on it and the Definition of Done holds | Product Owner |
| Release testing → Sprint review | the release tests (TST) of the selected items | written by a participant other than the implementer of the behaviour they test, green on the sprint branch | Product Owner |
| Retrospective → Sprint planning | the pull request of the sprint branch into \`main\`; the sprint record | the review and the retrospective are recorded, CI is green on the pull request | Product Owner |

## Roles

| Name | Filled by | How many | Capabilities |
|---|---|---|---|
| Product Owner | either | one | read the repository, write to the repository |
| Scrum Master | either | one | read the repository |
| Developers | either | several | read the repository, write to the repository, run code and tests, use tools |
| Release tester | either | several | read the repository, write to the repository, run code and tests |

## Flow control

| Kind | Value |
|---|---|
| WIP limit | 4 |
| Time box | none |
| Sprints | yes |
`;

// docs/process.md of origin/sprint/06 in the form a declaration has now: its roles named, and no participant.
const AGENT_M_PROCESS = `---
model: scrum-wip
model_file: ${AGENT_M_SCRUM_WIP_PATH}
model_version: ${AGENT_M_MODEL_VERSION}
---

# How Agent M is developed

**REGISTER**

The declaration of Agent M's process (UC-002, ARC-019): the model by name and version — the commit of this instance that
holds its file —, practices, branches and the Definition of Done. The role assignments under
\`docs/role-assignments/\` fill its roles from the instance's participants (\`docs/participants.md\`).

## Roles

- Product Owner
- Scrum Master
- Developers
- Release tester

## Practices

- none

## Branches

| Phase or time box | Branch |
|---|---|
| Sprint | \`sprint/<nn>\` |

## Definition of Done

The job rules hold for every pull request; no condition is added.

## Model

\`scrum-wip\` — Scrum with a work-in-progress limit of 4 and no time box, adapted from the shipped Scrum model.
`;

// docs/participants.md on origin/sprint/06, cut to its one table (the register's own prose above and below it is not
// read by any schema field this test checks).
const AGENT_M_PARTICIPANTS = `# Participants of this instance

Capabilities are those of \`A PARTICIPANT DECLARES ITS CAPABILITIES\`: draft text, read the repository, write to
the repository, run code and tests, use tools, reach the web.

| Name | Type | Model | Context | Price | Capabilities | Processing place | Route |
|---|---|---|---|---|---|---|---|
| akmaier | person | — | — | — | draft text, read the repository, write to the repository, run code and tests, use tools, reach the web | — | the GitHub account \`akmaier\`, on the dashboard and on GitHub's own pages |
| po-opus | CLI agent | claude-opus-5-5 | — | — | draft text, read the repository, write to the repository, run code and tests, use tools, reach the web | Anthropic, a provider in the USA | Claude Code on the Mac of \`akmaier\`, started by \`akmaier\`; reached without the Agent M Bridge until it exists (ITM-102) |
| scrum-master-session | CLI agent | claude-opus-5-5 | — | — | draft text, read the repository, write to the repository, run code and tests, use tools, reach the web | Anthropic, a provider in the USA | the Claude Code session on the Mac of \`akmaier\` that \`akmaier\` talks to and that starts the other agents; reached without the Agent M Bridge until it exists (ITM-102) |
| developer-sonnet-a | CLI agent | claude-sonnet-5 | — | — | draft text, read the repository, write to the repository, run code and tests, use tools, reach the web | Anthropic, a provider in the USA | Claude Code on the Mac of \`akmaier\`, in a git worktree of its own; reached without the Agent M Bridge until it exists (ITM-102) |
| developer-sonnet-b | CLI agent | claude-sonnet-5 | — | — | draft text, read the repository, write to the repository, run code and tests, use tools, reach the web | Anthropic, a provider in the USA | Claude Code on the Mac of \`akmaier\`, in a git worktree of its own; reached without the Agent M Bridge until it exists (ITM-102) |
| developer-sonnet-c | CLI agent | claude-sonnet-5 | — | — | draft text, read the repository, write to the repository, run code and tests, use tools, reach the web | Anthropic, a provider in the USA | Claude Code on the Mac of \`akmaier\`, in a git worktree of its own; reached without the Agent M Bridge until it exists (ITM-102) |
| developer-sonnet-d | CLI agent | claude-sonnet-5 | — | — | draft text, read the repository, write to the repository, run code and tests, use tools, reach the web | Anthropic, a provider in the USA | Claude Code on the Mac of \`akmaier\`, in a git worktree of its own; reached without the Agent M Bridge until it exists (ITM-102) |
| tester-opus | CLI agent | claude-opus-5-5 | — | — | draft text, read the repository, write to the repository, run code and tests, use tools, reach the web | Anthropic, a provider in the USA | Claude Code on the Mac of \`akmaier\`, in a git worktree of its own; reached without the Agent M Bridge until it exists (ITM-102) |
| reviewer-sonnet | CLI agent | claude-sonnet-5 | — | — | draft text, read the repository, write to the repository, run code and tests, use tools, reach the web | Anthropic, a provider in the USA | a Claude Code subagent that \`scrum-master-session\` starts on the Mac of \`akmaier\` to review architecture drafts, reading only; reached without the Agent M Bridge until it exists (ITM-102) |
`;

// TST-472269 · level: unit · module: MOD-implementation-pages
// guards: UC-002
// given: Agent M's own docs/process.md and docs/participants.md, and, at the commit its model_version names, docs/process-models/scrum-wip.md — five Produces cells carrying a kind's explanation in parentheses, and Flow control naming a WIP limit of 4 and a stated (not dashed) Time box of none
// input: route.render(target, context)
// expect: the model and model_file fields hold scrum-wip and its path; scrum-wip is offered beside the shipped five; its four roles are shown; no participant is named in the declaration. Known positive, run directly against this same text: modelFindings names no error — MOD-model-catalogue, as akmaier's accepted change states it, reads a kind's explanation in parentheses as the kind alone, so the gate Retrospective → Sprint planning finds the sprint record it checks produced, and reads a stated Time box of none as no time box, so Flow control names only the WIP limit. declarationFindings therefore names no error finding beside model_file, and Save is enabled: this settles the review's point that Agent M's own Save stayed disabled (ITM-258).
test("process route — the page of a product with Agent M's own declaration", async () => {
  const instanceHost = fakeHost({
    "docs/participants.md": AGENT_M_PARTICIPANTS,
    [AGENT_M_SCRUM_WIP_PATH]: AGENT_M_SCRUM_WIP,
    "SPEC.md": SPEC_TEXT,
  }, AGENT_M_MODEL_VERSION);
  const productHost = fakeHost({ "docs/process.md": AGENT_M_PROCESS }, sha1("agent-m-product-head"));
  const target = connectedTarget();

  const direct = modelFindings(readDocument(modelSchema.model, AGENT_M_SCRUM_WIP_PATH, AGENT_M_SCRUM_WIP))
    .filter((f) => f.kind === "error");
  assert.equal(direct.length, 0, "known positive: scrum-wip.md has no error finding as it stands");

  await route.render(target, contextOf(instanceHost, productHost));

  const form = byClass(target, "schema-form")[0];
  assert.equal(inputOf(form, "model").value, "scrum-wip");
  assert.equal(inputOf(form, "model_file").value, AGENT_M_SCRUM_WIP_PATH);
  assert.ok(byClass(target, "model-card").some((card) => card.getAttribute("data-model") === "scrum-wip"),
    "scrum-wip is offered beside the shipped five");
  for (const role of ["Product Owner", "Scrum Master", "Developers", "Release tester"]) {
    assert.ok(byData(target, "data-role", role)[0], `the role ${role} is shown`);
  }

  const beside = besideOf(fieldOf(form, "model_file"));
  assert.deepEqual(beside, [], "declarationFindings names no error finding beside model_file");
  assert.equal(saveOf(form).disabled, false, "Save is enabled now that the declared model has no error finding");

  target.remove();
});

// ---------------------------------------------------------------- roles: what each needs; who fills it is the Roles page's (4b)

// TST-472270 · level: unit · module: MOD-implementation-pages
// guards: A ROLE NAMES THE CAPABILITIES IT NEEDS; UC-002
// given: fixture-model's Developers, needing "write to the repository" and "run code and tests" — alice and bot-a have both —, and Reviewer, needing "use tools", which no fixture participant declares
// input: route.render(target, context)
// expect: Developers shown with what it needs and how many fill it, and no participant — not alice, not bot-a, who hold its capabilities —; Reviewer shown with "use tools", and no notice of a missing participant; each role links to the Roles page, #roles, where its participants are chosen
test("process route — a role shows who may fill it, how many and what it needs; who fills it is the Roles page's", async () => {
  const instanceHost = fakeHost(instanceFiles(), INSTANCE_COMMIT);
  const productHost = fakeHost({ "docs/process.md": declarationText() }, sha1("product-head-3"));
  const target = connectedTarget();

  await route.render(target, contextOf(instanceHost, productHost));

  const developers = byData(target, "data-role", "Developers")[0];
  const reviewer = byData(target, "data-role", "Reviewer")[0];
  assert.ok(developers && reviewer, "both roles are shown");
  assert.ok(developers.textContent.includes("run code and tests"), "what Developers need");
  assert.ok(!developers.textContent.includes("alice") && !developers.textContent.includes("bot-a"), "no participant is offered here");
  assert.ok(reviewer.textContent.includes("use tools"), "what Reviewer needs");
  for (const role of [developers, reviewer]) {
    const link = byTag(role, "a")[0];
    assert.ok(link, "the role links to where it is filled");
    assert.equal(link.getAttribute("href") ?? link.href, "#roles");
  }

  target.remove();
});

// ---------------------------------------------------------------- findings beside the fields: a participant named

// TST-472271 · level: unit · module: MOD-implementation-pages
// guards: THE PROCESS NAMES ROLES, NOT PARTICIPANTS; UC-002
// given: known positive first — fixture-model declared, naming no participant; then the same declaration whose Definition of Done names bot-a, a participant of the instance's list
// input: route.render(target, context) of each
// expect: for the first, Save is offered; for the second, Save is disabled, and a finding beside ## Definition of Done names bot-a and THE PROCESS NAMES ROLES, NOT PARTICIPANTS
test("process route — the declaration's findings are shown before Save: a participant it names disables Save and is named beside its field", async () => {
  const instanceHost = fakeHost(instanceFiles(), INSTANCE_COMMIT);
  const clean = connectedTarget();
  await route.render(clean, contextOf(instanceHost, fakeHost({ "docs/process.md": declarationText() }, sha1("product-head-4"))));
  assert.equal(saveOf(byClass(clean, "schema-form")[0]).disabled, false, "known positive: a declaration naming no participant can be saved");
  clean.remove();

  const productHost = fakeHost({ "docs/process.md": declarationText({ done: "The job rules hold; bot-a reviews every pull request." }) },
    sha1("product-head-5"));
  const target = connectedTarget();

  await route.render(target, contextOf(instanceHost, productHost));

  const form = byClass(target, "schema-form")[0];
  assert.equal(saveOf(form).disabled, true, "Save is disabled");
  const field = fieldOf(form, "## Definition of Done");
  const shown = [...[...byClass(field, "marks")[0]?.children ?? []].map((m) => m.textContent), ...besideOf(field)].join("\n");
  assert.match(shown, /bot-a/);
  assert.match(shown, /THE PROCESS NAMES ROLES, NOT PARTICIPANTS/);

  target.remove();
});

// ---------------------------------------------------------------- a product with no process requirements yet (7a)

// TST-472272 · level: unit · module: MOD-implementation-pages
// guards: UC-002
// given: fixture-model declared, its declaration naming no gate added by a requirement
// input: route.render(target, context)
// expect: the process-requirements panel says the product has none yet
test("process route — a product without process requirements is told so", async () => {
  const instanceHost = fakeHost(instanceFiles(), INSTANCE_COMMIT);
  const productHost = fakeHost({ "docs/process.md": declarationText() }, sha1("product-head-6"));
  const target = connectedTarget();

  await route.render(target, contextOf(instanceHost, productHost));

  const panel = byClass(target, "process-requirements")[0];
  assert.ok(panel, "the panel is shown");
  assert.match(panel.textContent, /no process requirement/i);

  target.remove();
});

// ---------------------------------------------------------------- selecting another model (3b)

// TST-472273 · level: unit · module: MOD-implementation-pages
// guards: UC-002
// given: fixture-model declared — phases producing ARC and ITM —; waterfall, a shipped model that produces requirements, ARC, MOD and TST, but not ITM
// input: route.render(target, context); the author chooses waterfall's card
// expect: the lost-artifacts notice names ITM, which fixture-model's phases produce and waterfall's do not, and not ARC, which both produce
test("process route — selecting another model lists the kinds of artifact the declared model's phases produce and the selected one's do not", async () => {
  const instanceHost = fakeHost(instanceFiles(), INSTANCE_COMMIT);
  const productHost = fakeHost({ "docs/process.md": declarationText() }, sha1("product-head-7"));
  const target = connectedTarget();

  await route.render(target, contextOf(instanceHost, productHost));

  const waterfallCard = byClass(target, "model-card").find((c) => c.getAttribute("data-model") === "waterfall");
  assert.ok(waterfallCard, "known positive: waterfall is offered");
  await click(byTag(waterfallCard, "button")[0]);

  const lost = byClass(target, "lost-artifacts")[0];
  assert.match(lost.textContent, /ITM/);
  assert.ok(!lost.textContent.includes("ARC"), "ARC, which both models produce, is not named as lost");

  target.remove();
});

// ---------------------------------------------------------------- Save (step 9) and a refused save

// TST-472274 · level: unit · module: MOD-implementation-pages
// guards: A PERSON'S OWN INPUT IS COMMITTED DIRECTLY; ONE CLICK PER DECISION; UC-002
// given: a product without a declaration; the author picks fixture-model and fills in the required sections
// input: typing the practices, branches and Definition of Done, then one click on Save
// expect: nothing is committed before the click; after it, exactly one commit of docs/process.md, whose model_version is the instance commit the route read the catalogue at
test("process route — Save commits docs/process.md once, naming model_version by the commit the catalogue was read at", async () => {
  const instanceHost = fakeHost(instanceFiles(), INSTANCE_COMMIT);
  const productHost = fakeHost({}, sha1("new-product-head"));
  const target = connectedTarget();

  await route.render(target, contextOf(instanceHost, productHost));
  const form = byClass(target, "schema-form")[0];

  const card = byClass(target, "model-card").find((c) => c.getAttribute("data-model") === "fixture-model");
  byTag(card, "button")[0].dispatchEvent(new Event("click"));
  type(areaOf(form, "## Practices"), "\n- none\n");
  type(areaOf(form, "## Branches"), "\n| Phase or time box | Branch |\n|---|---|\n");
  type(areaOf(form, "## Definition of Done"), "\nThe job rules hold; no condition is added.\n");
  await turn();

  assert.equal(productHost.commits.length, 0, "nothing is committed before the click");
  assert.equal(saveOf(form).disabled, false, "known positive: Save is offered once the required fields are filled");

  await click(saveOf(form));

  assert.equal(productHost.commits.length, 1, "committed once");
  const written = productHost.commits[0].files.find((f) => f.path === "docs/process.md").text;
  const saved = readDocument(declarationSchema, "docs/process.md", written);
  assert.equal(saved.fields.model, "fixture-model");
  assert.equal(saved.fields.model_file, FIXTURE_MODEL_PATH);
  assert.equal(saved.fields.model_version, INSTANCE_COMMIT);

  target.remove();
});

// TST-472275 · level: unit · module: MOD-implementation-pages
// guards: UC-002; A PRACTICE IS NOT A MODEL; ONE CLICK PER DECISION; A PERSON'S OWN INPUT IS COMMITTED DIRECTLY
// given: one valid Scrum declaration rendered through the public route with no selected practice; the same instance snapshot carries devops' explicit gate table, and the route's normal form caller edits ## Practices
// input: select devops, deselect it, then press the form's one Save
// expect: the live workflow gains then loses the marked gate before any write; the one save writes docs/process.md only and preserves the final no-practice selection
test("process route — changing a practice in one live form updates the workflow before Save and Save preserves the selection", async () => {
  const practiceAdds = `| Between | Artifacts | Condition | Decider |
|---|---|---|---|
| Development → Evidence review | evidence TST | evidence is reviewed | Product Owner |`;
  const declaration = `---
model: scrum
model_file: src/model-catalogue/models/scrum.md
model_version: ${INSTANCE_COMMIT}
---
# How the fixture product is developed

## Roles

The roles of Scrum — Product Owner, Scrum Master and Developers —, filled in the product's role assignment.

## Practices

- none

## Branches

| Phase or time box | Branch |
|---|---|

## Definition of Done

The job rules hold; no condition is added.
`;
  const instanceHost = fakeHost(instanceFiles({ practiceAdds }), INSTANCE_COMMIT);
  const productHost = fakeHost({ "docs/process.md": declaration }, sha1("live-practice-selection"));
  const target = connectedTarget();

  await route.render(target, contextOf(instanceHost, productHost));
  const form = byClass(target, "schema-form")[0];
  const phases = () => byClass(target, "phases-panel")[0].textContent;
  assert.doesNotMatch(phases(), /practice: devops/, "known positive: no practice gate starts in the workflow");
  assert.equal(saveOf(form).disabled, false, "known positive: the valid declaration can be saved");

  type(areaOf(form, "## Practices"), "\n- devops\n");
  await turn();
  assert.match(phases(), /practice: devops/, "the selected practice gate enters before Save");
  assert.equal(productHost.commits.length, 0, "selection writes nothing before Save");

  type(areaOf(form, "## Practices"), "\n- none\n");
  await turn();
  assert.doesNotMatch(phases(), /practice: devops/, "deselecting removes the practice gate before Save");
  assert.equal(productHost.commits.length, 0, "deselection still writes nothing before Save");

  await click(saveOf(form));
  assert.equal(productHost.commits.length, 1, "one Save writes once");
  assert.deepEqual(productHost.commits[0].files.map((file) => file.path), ["docs/process.md"], "Save writes the declaration only");
  assert.match(productHost.commits[0].files[0].text, /## Practices\n\n- none/, "Save preserves the final practice selection");
  target.remove();
});

// TST-472276 · level: unit · module: MOD-implementation-pages
// guards: A PERSON'S OWN INPUT IS COMMITTED DIRECTLY
// given: a product declaring fixture-model; after the page opened, the file is changed elsewhere, outside this page
// input: typing a condition into ## Definition of Done, then one click on Save
// expect: nothing new is committed; the typed text stays in the field
test("process route — a refused save keeps the person's edit", async () => {
  const instanceHost = fakeHost(instanceFiles(), INSTANCE_COMMIT);
  const productHost = fakeHost({ "docs/process.md": declarationText() }, sha1("product-head-8"));
  const target = connectedTarget();

  await route.render(target, contextOf(instanceHost, productHost));
  const form = byClass(target, "schema-form")[0];
  const typed = "\nreview: 1 by participants other than the implementer\n";
  type(areaOf(form, "## Definition of Done"), typed);
  await turn();
  assert.equal(saveOf(form).disabled, false, "known positive: the edited declaration can be saved");

  // Changed elsewhere, after the page opened it.
  productHost._setFile("docs/process.md", declarationText({ done: "The job rules hold for every pull request." }));

  await click(saveOf(form));

  assert.equal(productHost.commits.length, 0, "nothing is committed on a refused save");
  assert.equal(areaOf(form, "## Definition of Done").value, typed, "the person's edit stays in the field");

  target.remove();
});
