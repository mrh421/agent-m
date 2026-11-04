// MOD-implementation-pages' route `backlog`: the notice of Start sprint names what the decision adds and removes (ITM-1327), as UC-032 6a states it: "Changing the sprint selection is a new
// **Start sprint** decision, and Agent M shows what it removes or adds", from MOD-work-plans' `startSprint`, whose result is `{ commit, path, added, removed }` and of which the accepted text of
// docs/architecture/MOD-work-plans.md says: "While a sprint runs, a new start decision is appended to its file as `## Selection`, and `added` and `removed` name what it changes".
// Run: node --test tests/implementation-pages-backlog-selection-notice.test.mjs
//
// Module: MOD-implementation-pages
// Guards: UC-032; A TIME BOX WORKS ONLY ON WHAT WAS SELECTED FOR IT; ONE CLICK PER DECISION
// Level: unit
//
// The product is the fixture of tests/implementation-pages-sprints.mjs, held in memory behind that file's host, which applies a commit to its files: team1's sprint 03 runs with ITM-001 — merged, so
// done, and not offered by the plan — and ITM-002; team2 has no running sprint. Nothing reaches the network. The route is drawn as that file's render draws it, with the instance's host given
// MOD-repository-hosts' readFileAt, which Start sprint reads the declared model with, answering the model's file at every commit; and this file adds the fixture DOM's
// insertAdjacentHTML("afterbegin"), which the page's notice uses, as tests/uc-032-harness.mjs adds it. Readings the texts leave open, which the tests state (the pull request names them): `added` and `removed` are read from startSprint's result as
// it stands — a done item the plan does not offer is among those `removed` because startSprint names it there, and the page adds no rule of its own —; the notice keeps "<path> is started" and
// "is changed" and names the items after them, as "Added: …" and "Removed: …". Each test states its input and its expected result before it runs (given / input / expect). The counter-proofs are
// recorded in the pull request.

import test from "node:test";
import assert from "node:assert/strict";
import { ADDRESS, TEAM1_RUNNING, found, hostOf, productFiles } from "./implementation-pages-sprints.mjs";

const { view } = await import("../src/implementation-pages/index.mjs");

globalThis.window.Element.prototype.insertAdjacentHTML ??= function insertAdjacentHTML(where, html) {
  const box = globalThis.document.createElement("div");
  box.innerHTML = html;
  const nodes = [...box.childNodes];
  if (where === "afterbegin") for (const node of nodes.reverse()) this.insertBefore(node, this.firstChild);
  else for (const node of nodes) this.appendChild(node);
};

// The route `backlog` drawn as tests/implementation-pages-sprints.mjs' render draws it, the instance's host answering readFileAt; press(element) is the person's click, awaited.
async function render() {
  const files = productFiles();
  const host = hostOf(files);
  const model = files["docs/process-models/fixture.md"];
  const instance = { ...hostOf({ "SPEC.md": "# Instance\n", "docs/process-models/fixture.md": model }, { pullRequests: [] }),
    async readFileAt(path, commits) { return new Map(commits.map((commit) => [commit, path === "docs/process-models/fixture.md" ? model : null])); } };
  const handlers = [];
  const Element = globalThis.window.Element, add = Element.prototype.addEventListener;
  Element.prototype.addEventListener = function (kind, listener, ...rest) { if (kind === "click") handlers.push([this, listener]); return add.call(this, kind, listener, ...rest); };
  globalThis.mermaid = { initialize() {}, mermaidAPI: { getDiagramFromText: async () => ({ db: { getVertices: () => ({}) } }) }, run: async () => {} };
  const target = globalThis.document.createElement("div");
  globalThis.document.body.append(target);
  const context = { page: "review", instance: { repository: "acme/agent-m", host: instance }, product: { address: ADDRESS, kind: "github", host, tokenStored: true }, store: {}, go() {} };
  await view.routes.find((route) => route.name === "backlog").render(target, context, {});
  const press = async (element) => {
    await handlers.filter(([at]) => at === element).at(-1)[1]({ isTrusted: true });
    await new Promise((resolve) => setTimeout(resolve, 30));
  };
  const done = () => { Element.prototype.addEventListener = add; delete globalThis.mermaid; };
  return { target, host, press, done, html: () => target.innerHTML };
}

const plain = (html) => String(html).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
// The notice the page draws after a decision: the text of its sections of the class `flash`.
const notice = (page) => plain(found(page.target, "[class]").filter((node) => String(node.getAttribute("class")).split(/\s+/).includes("flash")).map((node) => node.innerHTML).join(" "));
const tick = (page, item, checked) => { found(page.target, `[data-select-item="${item}"]`)[0].checked = checked; };
const type = (page, selector, value) => { found(page.target, selector)[0].value = value; };

// TST-1327001 · level: unit · module: MOD-implementation-pages
// guards: UC-032; A TIME BOX WORKS ONLY ON WHAT WAS SELECTED FOR IT; ONE CLICK PER DECISION
// given: the fixture; team1's sprint docs/backlog/sprints/team1/03.md runs with ITM-001 (done, not offered by the plan) and ITM-002; team2 has no running sprint
// input: Change the selection of team1: ITM-002 untaken, ITM-005 ticked, the goal "Store and news" and the closer alice, Start sprint; then, on a page drawn anew, Plan sprint of team2: ITM-004 ticked, the goal "Feed" and the closer bob, Start sprint
// expect: known positive — team2's new sprint docs/backlog/sprints/team2/03.md is committed and its notice says "docs/backlog/sprints/team2/03.md is started" and names its selection ITM-004 as added, and nothing as removed; the change of team1 makes one commit of docs/backlog/sprints/team1/03.md, and its notice says "docs/backlog/sprints/team1/03.md is changed", names ITM-005 as added and ITM-001 and ITM-002 as removed, after those words; counter-proof — on the base the notice names neither
test("#backlog — the notice of Start sprint names each item the decision adds and each it removes", async () => {
  const fresh = await render("backlog");
  try {
    await fresh.press(found(fresh.target, '[data-plan="team2"]')[0]);
    tick(fresh, "ITM-004", true);
    type(fresh, "[data-sprint-goal]", "Feed");
    type(fresh, "[data-sprint-closer]", "bob");
    await fresh.press(found(fresh.target, '[data-start-sprint="team2"]')[0]);
    assert.equal(fresh.host.commits.length, 1, "known positive: one commit");
    const started = fresh.host.commits[0].files.map((file) => file.path)[0];
    assert.match(started, /^docs\/backlog\/sprints\/team2\/\d{2}\.md$/, "known positive: team2's new sprint is committed");
    const said = notice(fresh);
    assert.ok(said.includes(`${started} is started`), `known positive: the sprint is started: ${said}`);
    assert.match(said, /is started .*Added: ITM-004\b/, `a sprint started anew names its selection as added: ${said}`);
    assert.doesNotMatch(said, /Removed:/, `and removes nothing: ${said}`);
  } finally { fresh.done(); }

  const page = await render("backlog");
  try {
    await page.press(found(page.target, '[data-plan="team1"]')[0]);
    assert.equal(found(page.target, '[data-select-item="ITM-001"]').length, 0, "known positive: the done ITM-001 is not offered");
    tick(page, "ITM-002", false);
    tick(page, "ITM-005", true);
    type(page, "[data-sprint-goal]", "Store and news");
    type(page, "[data-sprint-closer]", "alice");
    await page.press(found(page.target, '[data-start-sprint="team1"]')[0]);
    assert.equal(page.host.commits.length, 1, JSON.stringify(page.host.calls));
    assert.deepEqual(page.host.commits[0].files.map((file) => file.path), [TEAM1_RUNNING], "known positive: the running sprint's record alone");
    const said = notice(page);
    assert.ok(said.includes(`${TEAM1_RUNNING} is changed`), `known positive: the selection is changed: ${said}`);
    assert.match(said, /is changed .*Added: ITM-005\b/, `the notice names the item the decision adds: ${said}`);
    assert.match(said, /is changed .*Removed: ITM-001, ITM-002\b/, `and each item it removes, the done one among them: ${said}`);
  } finally { page.done(); }
});
