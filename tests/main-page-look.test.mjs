// The main page's job table wears the site's one look (ITM-1450): the table `jobs` that the route `jobs` draws carries the frame's class list (look.css: ".list { ... }"), and every button that
// the routes `home`, `jobs` and `job` draw carries the frame's class btn (look.css: ".btn, ...").
// Run: node --test tests/main-page-look.test.mjs
//
// Module: MOD-main-page
// Guards: EVERY PAGE SHARES ONE LOOK AND WORKS ON A PHONE; THE SITE WEARS THE PATTERN RECOGNITION LAB'S LOOK
// Level: unit
//
// The expected results are written here from the item's Acceptance ("The table `jobs` carries `list`, and every button of the main page carries `btn`") and from the classes look.css styles, and
// none is read from the code. Readings taken where the texts leave one open:
//   - A button is an element <button>, a table an element <table>; the frame's class for a button is btn, for a table list. An element out of the look is named by its kind, its first class and,
//     for a button, its text.
//   - "The main page" is its three routes drawn as the frame draws them, in the world of tests/main-page-home-harness.mjs: `home` with a kept product and one that cannot be read (its card offers
//     the token's setting), and with no product kept (+ Add product); `jobs` with a failed job, which also waits for a person; `job` of a job waiting at a gate, for a holder of the deciding role
//     (Cancel, Pass gate and Reject).
//   - The known positive is the route `home`, whose buttons the look already styles.
// The counter-proofs are in the pull request.

import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { view } from "../src/main-page/index.mjs";
import { startRecord, appendToRecord } from "../src/job-ledger/index.mjs";
import { writeSetting } from "../src/browser-store/index.mjs";
import {
  INSTANCE, PRODUCT, PRODUCT_TOKEN, MISSING_URL, PRODUCT_URL, browser, draw, failedJob, find, headOf, instanceFiles, network, smallProduct, timers,
} from "./main-page-home-harness.mjs";

const routeOf = (name) => view.routes.find((candidate) => candidate.name === name);
let net;
afterEach(() => { net?.restore(); timers.restore(); document.body.replaceChildren(); });

const classes = (node) => String(node.className ?? "").split(/\s+/).filter(Boolean);
const buttons = (root) => find(root, (node) => node.localName === "button");
const tables = (root) => find(root, (node) => node.localName === "table");
const findings = (root) => [
  ...buttons(root).filter((node) => !classes(node).includes("btn")).map((node) => `button ${classes(node)[0] ?? ""} "${node.textContent.trim()}" has no class btn`),
  ...tables(root).filter((node) => !classes(node).includes("list")).map((node) => `table ${classes(node)[0] ?? ""} has no class list`),
];

// The job waiting at the gate Review → Done of the kanban model, decided by the role Reviewer, which carol holds; the Bridge lab-pc-4 lists it as running.
const WAITING = "JOB-20261016-1000-9a01";
const DECLARATION = ["---", "model: kanban", "model_file: src/model-catalogue/models/kanban.md", `model_version: ${headOf(INSTANCE)}`, "---", "# Process", "", "## Practices", "", "- none", "", "## Branches", "",
  "| Phase or time box | Branch |", "|---|---|", "| Development | work/<item> |", "", "## Definition of Done", "", "The job rules hold; no condition is added.", ""].join("\n");
const ASSIGNMENT = ["# Role assignment of the product", "", "## Roles", "", "| Role | Participants |", "|---|---|", "| Product owner | alice |", "| Developer | dev-cli |", "| Reviewer | carol, dev-cli |", ""].join("\n");
function waitingJob() {
  const { path, text } = startRecord({ id: WAITING, kind: "implement-item", worksOn: ["ITM-0900"], participant: "dev-cli", model: "model-x", route: "bridge lab-pc-4", run: null, retries: null,
    startedBy: "alice", start: new Date("2026-10-16T10:00:00Z"), agentM: { version: "2026.1.0", commit: "abc1234" }, inputs: [], limit: 5, task: "in parameters", conversation: null, destinations: [],
    params: {} });
  const taken = appendToRecord(text, { part: "taken", at: new Date("2026-10-16T10:00:00Z"), by: "lab-pc-4" });
  return { path, text: appendToRecord(taken, { part: "gate reached", at: new Date("2026-10-16T10:30:00Z"), gate: "Review → Done", decider: "Reviewer" }) };
}

// TST-1450001 · level: unit · module: MOD-main-page
// guards: EVERY PAGE SHARES ONE LOOK AND WORKS ON A PHONE
// given: the instance alice/agent-m and the kept products alice/product (readable, with its token) and carol/missing (which the fake GitHub does not hold); then no product kept
// input: the route home drawn for each; the check applied to each, and to a planted <button> and a planted <table>, both without a class
// expect: known positive — the first page draws the button Open the token's setting (token-setting) of carol/missing's card and Jobs (jobs-link), the second + Add product (add-product) and Jobs, and the check finds nothing on either; the planted pair gives two findings, `button  "Planted" has no class btn` and `table  has no class list`
test("TST-1450001: the main page's start, already in the look, passes the check, and a bare button and a bare table are findings", async () => {
  net = network({ [INSTANCE]: instanceFiles(), [PRODUCT]: smallProduct() });
  net.install();
  const withProducts = await draw(routeOf("home"), browser({ products: [PRODUCT_URL, MISSING_URL] }));
  assert.deepEqual(buttons(withProducts).map((node) => classes(node)[0]).sort(), ["jobs-link", "token-setting"]);
  assert.deepEqual(findings(withProducts), []);
  const without = await draw(routeOf("home"), browser({ products: [], tokens: {} }));
  assert.deepEqual(buttons(without).map((node) => classes(node)[0]).sort(), ["add-product", "jobs-link"]);
  assert.deepEqual(findings(without), []);
  const bare = document.createElement("div");
  const planted = document.createElement("button");
  planted.textContent = "Planted";
  bare.append(planted, document.createElement("table"));
  assert.deepEqual(findings(bare), ['button  "Planted" has no class btn', "table  has no class list"]);
});

// TST-1450002 · level: unit · module: MOD-main-page
// guards: EVERY PAGE SHARES ONE LOOK AND WORKS ON A PHONE
// given: the kept product alice/product with the failed job JOB-20261016-1000-ffff, which also waits for a person; a token for it and for the instance
// input: the route jobs drawn
// expect: the page draws one table, of the class jobs, and the buttons Open of what waits (wait-link) and the job's identifier (job-link); the table carries the class list and every button the class btn: no finding
test("TST-1450002: the table jobs carries the frame's class list, and every button of the page Jobs carries btn", async () => {
  const JOB = "JOB-20261016-1000-ffff";
  net = network({ [INSTANCE]: instanceFiles(), [PRODUCT]: smallProduct({ jobs: [failedJob({ id: JOB, by: "lab-pc-4" })] }) });
  net.install();
  const target = await draw(routeOf("jobs"), browser());
  assert.deepEqual(tables(target).map((node) => classes(node)[0]), ["jobs"]);
  assert.deepEqual([...new Set(buttons(target).map((node) => classes(node)[0]))].sort(), ["job-link", "wait-link"]);
  assert.deepEqual(findings(target), []);
});

// TST-1450003 · level: unit · module: MOD-main-page
// guards: EVERY PAGE SHARES ONE LOOK AND WORKS ON A PHONE
// given: the job JOB-20261016-1000-9a01 of alice/product, running on the Bridge lab-pc-4 and waiting at the gate Review → Done, decided by the role Reviewer; the person carol, a holder of Reviewer, whom the product's token names
// input: the route job drawn with id JOB-20261016-1000-9a01
// expect: the page draws Cancel (job-cancel), Pass gate (gate-pass) and Reject (gate-reject), and every button of the page carries the class btn: no finding
test("TST-1450003: every button of a job's page carries the frame's class btn", async () => {
  const files = { ...smallProduct({ jobs: [waitingJob()] }), "docs/process.md": DECLARATION, "docs/role-assignments/product.md": ASSIGNMENT };
  net = network({ [PRODUCT]: files, [INSTANCE]: instanceFiles() }, { bridgeLists: WAITING });
  net.install();
  const inner = globalThis.fetch;
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(typeof input === "object" && !(input instanceof URL) ? input.url : String(input));
    if (url.host === "api.github.com" && url.pathname === `/repos/${INSTANCE}/commits/${headOf(INSTANCE)}`) return inner(new URL(`https://api.github.com/repos/${INSTANCE}/commits/main`), init);
    return inner(input, init);
  };
  const context = browser();
  writeSetting(context.store, `github-token:${PRODUCT}`, { value: PRODUCT_TOKEN, name: "carol", expires: "2027-01-01" });
  const target = await draw(routeOf("job"), context, { id: WAITING });
  assert.deepEqual(buttons(target).map((node) => classes(node)[0]).sort(), ["gate-pass", "gate-reject", "job-cancel"]);
  assert.deepEqual(findings(target), []);
});
