// Release tests of ITM-1272 — the specification's waiting entries and the dashboard's notification of what waits for acceptance take the change queues from the
// overview stored for the commit, with one read per commit. The behaviour is UC-047 steps 2 and 3 (a due check of the dashboard tells what waits) and UC-020 step 2 (the
// specification shows the open queues of the current version), as docs/architecture/MOD-progress-measures.md (`waitingQueues`, `storedOverview`, `waitingForAcceptance`)
// and docs/architecture/MOD-trace-pages.md (Files: "reads the change queues through MOD-progress-measures' `waitingQueues`") state it.
// Run: node --test tests/release-itm-1272-waiting-queues.test.mjs
//
// Module: MOD-progress-measures; MOD-trace-pages; MOD-notifications
// Guards: A PERSON IS TOLD WHAT WAITS FOR THEIR ACCEPTANCE; OPEN PROPOSALS ARE SHOWN IN THE BROWSER; A PAGE LOAD READS THE REPOSITORY IN BATCHES; UC-020; UC-047
// Level: release
//
// Written for the release testing of sprint 110 by a participant who implemented none of ITM-1272 (RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER). The world is the one of the
// main page's tests (tests/main-page-home-harness.mjs: the counting fake GitHub behind the real MOD-repository-hosts, the browser of the instance, the branch overview-cache) with
// the product's queues of the fixture below; the callers are the real MOD-notifications check and the real route `trace` of MOD-trace-pages, over one host, as the frame keeps one
// host for a product for the life of a page. The unit tests of the item (tests/progress-measures-waiting-queues.test.mjs, tests/trace-pages-waiting-changes.test.mjs) call
// waitingQueues and the route over fakes of a snapshot; these cases do not repeat them: they count what the callers send to the server.
// Readings the texts leave open, which the cases state: "one read per commit" is counted as the requests for `<commit>.json` of the branch overview-cache that one host receives in
// the life of a page, whichever of the two callers asks; a queue "is read" when its index.md or entscheidungen.md is named to the server (the proposals of the entries that wait are read
// by the specification page for their impact lists and by none else).

import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { INSTANCE, PRODUCT, PRODUCT_TOKEN, PRODUCT_URL, browser, byClass, draw, headOf, instanceFiles, network, smallProduct, timers } from "./main-page-home-harness.mjs";
import { withStoredGraph } from "./stored-graph-fake.mjs";
import { connect, parseAddress } from "../src/repository-hosts/index.mjs";
import { watchForAcceptance } from "../src/notifications/index.mjs";
import { queues } from "../src/spec-changes/index.mjs";
import { readSetting, writeSetting } from "../src/browser-store/index.mjs";

const { view } = await import("../src/trace-pages/index.mjs");
const route = view.routes.find((candidate) => candidate.name === "trace");

const TICK = "\u0060";
const SPEC_DIR = "docs/spec-freigaben/";
const WAITING = "2026-10-09_waiting";
const DECIDED = Array.from({ length: 12 }, (_, n) => `2026-09-${String(n + 1).padStart(2, "0")}_decided`);
const OLDER = "e".repeat(40);

// One queue of one entry, which replaces the section "## 1. Section" of SPEC.md; decided, its decision row names the commit that wrote it into the SPEC.
function queue(folder, decided) {
  const base = `${SPEC_DIR}${folder}`;
  return {
    [`${base}/index.md`]: [`# SPEC approvals — queue ${folder.slice(0, 10)} · ${folder}`, "", `**Zieldatei aller Einträge:** ${TICK}SPEC.md${TICK}`, "",
      "| Nr | Datei | Anker (Überschrift, wortgetreu) | bis (exklusiv) | Commits |", "|---|---|---|---|---|", `| 01 | ${TICK}SPEC.md${TICK} | ## 1. Section | — | — |`, ""].join("\n"),
    [`${base}/entscheidungen.md`]: [`# Decisions — queue ${folder.slice(0, 10)}`, "", "Append-only.", "", ...(decided ? [`| 2026-09-08 10:00 UTC | 1 | uebernommen | ${"c".repeat(40)} |`] : []), ""].join("\n"),
    [`${base}/01-entry.md`]: `## 1. Section\n\n**FIRST RULE** *(Product Owner)*\nThe first rule holds on every page.\n*Check:* ${TICK}tests/unit.test.mjs${TICK}\n`,
  };
}
// The product of the main page's tests, with twelve decided queues and one that waits.
const productFiles = () => ({ ...smallProduct({ accepted: ["UC-001", "UC-002"] }),...Object.assign({}, ...DECIDED.map((folder) => queue(folder, true))), ...queue(WAITING, false) });

let net = null;
afterEach(() => { net?.restore(); net = null; timers.restore(); document.body?.replaceChildren(); });

/**
 * The world: the fake GitHub holding the product and the instance, and on the branch overview-cache of the product what `stored` says — "head": the overview of the head, with the
 * queues that have an entry not in the SPEC yet as MOD-spec-changes' `queues` gives them; "older": the overview of another commit and latest.json naming it; "none": nothing, no branch.
 * The overview is derived by a host of its own, whose reads are no read of the callers (the log is marked after it).
 */
async function worldWith(stored) {
  net = network({ [PRODUCT]: productFiles(), [INSTANCE]: instanceFiles() });
  net.install();
  const head = headOf(PRODUCT);
  const all = await queues(await connect(parseAddress(PRODUCT_URL), { token: PRODUCT_TOKEN }).readSnapshot("main"));
  const held = all.filter((each) => each.entries.some((entry) => entry.state !== "in SPEC"));
  assert.deepEqual(held.map((each) => each.folder.slice(each.folder.lastIndexOf("/") + 1)), [WAITING], "known positive: the queues derived from the files hold the one that waits");
  const overview = (commit) => JSON.stringify({ commit, shares: [], waiting: [], model: null, build: { states: [], records: [] }, queues: held });
  if (stored === "head") net.overviews[PRODUCT] = { [head]: overview(head) };
  if (stored === "older") net.overviews[PRODUCT] = { [OLDER]: overview(OLDER), latest: JSON.stringify({ commit: OLDER }) };
  const real = connect(parseAddress(PRODUCT_URL), { token: PRODUCT_TOKEN });
  // The frame's host of a product, whose snapshots serve the stored trace graph the workflow "main changed" would have stored (the pattern of tests/stored-graph-fake.mjs).
  const host = { ...real, readSnapshot: async (ref) => withStoredGraph(await real.readSnapshot(ref)) };
  return { host, head, mark: net.server.log.length };
}

const productRequests = () => net.requests.filter((request) => request.url.includes(`/repos/${PRODUCT}/`));
const overviewRequests = () => productRequests().filter((request) => request.url.includes("ref=overview-cache")).map((request) => /contents\/([^?]+)\?/.exec(request.url)[1]);
// The files of the queues the server was asked for since `mark`, and those of them that belong to a decided queue.
const queuesRead = (mark) => net.server.log.slice(mark).flatMap((entry) => entry.files).filter((path) => path.startsWith(SPEC_DIR));
const decidedRead = (mark) => queuesRead(mark).filter((path) => !path.startsWith(`${SPEC_DIR}${WAITING}/`));

// ---------------------------------------------------------------- the browser of a person who has notifications on

const minutesAgo = (n) => new Date(Date.now() - n * 60 * 1000).toISOString();
function installNotifications() {
  const prior = { Notification: Object.getOwnPropertyDescriptor(globalThis, "Notification"), navigator: Object.getOwnPropertyDescriptor(globalThis, "navigator"), setInterval: globalThis.setInterval };
  const shown = [];
  const registration = { showNotification: (title, options) => { shown.push({ title, ...options }); }, unregister: async () => {} };
  Object.defineProperty(globalThis, "Notification", { value: { permission: "granted" }, configurable: true, writable: true });
  Object.defineProperty(globalThis, "navigator", { value: { serviceWorker: { register: async () => registration, getRegistration: async () => registration }, userAgent: "node" }, configurable: true, writable: true });
  let tick = null;
  globalThis.setInterval = (run) => { tick = run; return 1; };
  return { shown, tick: () => tick(), restore() {
    if (prior.Notification) Object.defineProperty(globalThis, "Notification", prior.Notification); else delete globalThis.Notification;
    if (prior.navigator) Object.defineProperty(globalThis, "navigator", prior.navigator); else delete globalThis.navigator;
    globalThis.setInterval = prior.setInterval;
  } };
}
// A check ends when it has written the time of its end; the real timers wait for it.
async function checked(store, since) {
  for (let n = 0; n < 500 && readSetting(store, "notifications").checked === since; n += 1) await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
}
const addressOf = (name, params, repository) => `https://dashboard.test/${repository}/${name}${params.id ? `/${params.id}` : ""}`;

// A due check of the dashboard on the product's host, the person's last check six minutes old; returns what the browser showed.
async function dueCheck(world, notifications) {
  const context = browser();
  const since = minutesAgo(6);
  writeSetting(context.store, "notifications", { checked: since });
  const page = { store: context.store, instance: context.instance, productHost: () => world.host, addressOf };
  watchForAcceptance(page);
  await checked(context.store, since);
  return { context, page, again: async () => {
    const before = readSetting(context.store, "notifications").checked;
    writeSetting(context.store, "notifications", { checked: minutesAgo(6) });
    notifications.tick();
    await checked(context.store, minutesAgo(6));
    return before;
  } };
}

const draws = async (world, context) => {
  context.product = { address: PRODUCT_URL, kind: "github", host: world.host, tokenStored: true };
  return draw(route, context, { key: "specification", ref: "main" });
};
const waitingSection = (target) => byClass(target, "spec-waiting")[0];
const linksOf = (section) => byClass(section, "spec-waiting-entry").map((anchor) => anchor.getAttribute("href"));

// TST-1272301 · level: release · module: MOD-notifications, MOD-progress-measures
// guards: A PERSON IS TOLD WHAT WAITS FOR THEIR ACCEPTANCE; UC-047
// given: this browser keeps alice/product, whose 13 change queues hold one that waits (12 are decided) and whose branch overview-cache holds the overview of its head; notifications are on and the last check was six minutes ago
// input: the due check of the page, and then a second due check six minutes later on the same page
// expect: one notification names the waiting entry (spec-2026-10-09_waiting-01) and links the page where it is accepted; the product's server received one request for the head's overview and was asked for no index or decisions file of any of the 13 queues; the second check shows nothing again and asks for the overview no more (once for the commit)
// Planted fault: waitingForAcceptance reading `queues(snapshot)` in place of `waitingQueues(snapshot).queues` (src/progress-measures/stages.mjs) asks for the 26 files of the 13 queues and for no overview, and the case fails on the assertion that the server received one request for the head's overview.
// Planted fault: storedOverview keeping the overview by the snapshot (`const scope = snapshot`) in place of the repository and the commit asks for the head's overview again at the second check, and the case fails on the assertion that the commit's overview is read once.
test("TST-1272301 a due check of the dashboard tells the waiting SPEC change from the stored overview, reading no queue and the overview once", async () => {
  const world = await worldWith("head");
  const notifications = installNotifications();
  try {
    const { again } = await dueCheck(world, notifications);
    assert.deepEqual(notifications.shown.map(({ title, body, data }) => [title, body, data.url]),
      [[`spec-${WAITING}-01 waits for your acceptance`, PRODUCT, `https://dashboard.test/${PRODUCT}/spec-entry/spec-${WAITING}-01`]]);
    assert.deepEqual(overviewRequests(), [`${world.head}.json`]);
    assert.deepEqual(queuesRead(world.mark), [], "no file of any queue is asked for");
    await again();
    assert.equal(notifications.shown.length, 1, "a SPEC change already notified is not notified again");
    assert.deepEqual(overviewRequests(), [`${world.head}.json`], "the commit's overview is read once");
    assert.deepEqual(queuesRead(world.mark), []);
  } finally { notifications.restore(); }
});

// TST-1272302 · level: release · module: MOD-notifications, MOD-progress-measures, MOD-trace-pages
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES; OPEN PROPOSALS ARE SHOWN IN THE BROWSER; UC-020; UC-047
// given: the product of TST-1272301 with the overview of its head stored; one host of the product for the page, as the frame keeps it; the dashboard's due check has run on it
// input: the route trace (the specification) drawn on the same host, and drawn a second time
// expect: the specification lists the waiting entry once, linked as #spec-entry/id=spec-2026-10-09_waiting-01/product=<the product's address, percent-encoded> (ITM-1364), with its status open, and none of the 12 decided queues; the server received one request for the head's overview in all (the check's and both draws'); no index or decisions file of any queue was asked for; the proposal of the waiting entry alone was read from the queues' folder
// Planted fault: storedOverview keeping the overview by the snapshot (`const scope = snapshot` in src/progress-measures/stages.mjs) asks for the head's overview a second time for the draw's snapshot, and the case fails on the assertion of one request in all.
// Planted fault: waitingEntries in src/trace-pages/flow.mjs reading `queues(snapshot)` in place of `waitingQueues(snapshot).queues` reads the index and decisions of the 12 decided queues, and the case fails on the assertion that no file of a decided queue is asked for.
test("TST-1272302 the specification takes the waiting entries from the overview the due check read, which the page reads once for its commit", async () => {
  const world = await worldWith("head");
  const notifications = installNotifications();
  try {
    const { context } = await dueCheck(world, notifications);
    assert.deepEqual(overviewRequests(), [`${world.head}.json`], "known positive: the check read the overview");
    const first = await draws(world, context);
    const section = waitingSection(first);
    assert.ok(section, "the section of the waiting entries is drawn");
    assert.deepEqual(linksOf(section), [`#spec-entry/id=spec-${WAITING}-01/product=${encodeURIComponent(PRODUCT_URL)}`]);
    assert.match(section.textContent, /open/);
    assert.equal(section.textContent.includes("decided"), false, "no decided queue is listed");
    await draws(world, context);
    assert.deepEqual(overviewRequests(), [`${world.head}.json`], "one request for the commit's overview in all");
    assert.deepEqual(decidedRead(world.mark), [], "no file of a decided queue is asked for");
    assert.ok(queuesRead(world.mark).includes(`${SPEC_DIR}${WAITING}/01-entry.md`), "known positive: the count sees the reads of the waiting queue's own files");
  } finally { notifications.restore(); }
});

// TST-1272303 · level: release · module: MOD-trace-pages, MOD-progress-measures
// guards: OPEN PROPOSALS ARE SHOWN IN THE BROWSER; A PAGE LOAD READS THE REPOSITORY IN BATCHES; UC-020
// given: the product of TST-1272301 in three states of its branch overview-cache: the overview of the head stored; only the overview of an older commit stored, with latest.json naming it (the minutes after a push, before the workflow stores the head's); no branch at all
// input: the route trace drawn at the default branch in each state
// expect: the same entry is listed in all three, linked as #spec-entry/id=spec-2026-10-09_waiting-01/product=<the product's address, percent-encoded> (ITM-1364); with the head's overview the queue files are not asked for; with the older one they are not asked for either, and the requests for the branch are the head's overview, latest.json and the older commit's overview, in this order; with no branch they all are — the index and decisions files of the 12 decided queues (24) — and the entry is still listed
// Planted fault: waitingQueues leaving out the overview stored last (`const last = null` in src/progress-measures/stages.mjs) reads the 12 decided queues in the state "older", and the case fails on that state's counts (24 files read, no latest.json asked for).
// Planted fault: waitingEntries in src/trace-pages/flow.mjs reading `queues(snapshot)` in place of `waitingQueues(snapshot).queues` reads the decided queues with the head's overview stored, and the case fails on that state's count.
test("TST-1272303 the specification lists the waiting entries from the head's overview, else the one stored last, else from every queue", async () => {
  const outcomes = {};
  for (const state of ["head", "older", "none"]) {
    const world = await worldWith(state);
    try {
      const context = browser();
      const target = await draws(world, context);
      const section = waitingSection(target);
      assert.ok(section, `${state}: the waiting entry is listed`);
      assert.deepEqual(linksOf(section), [`#spec-entry/id=spec-${WAITING}-01/product=${encodeURIComponent(PRODUCT_URL)}`], state);
      outcomes[state] = { read: decidedRead(world.mark).length, branch: overviewRequests() };
    } finally { net.restore(); net = null; timers.restore(); document.body.replaceChildren(); }
  }
  assert.deepEqual(outcomes.head, { read: 0, branch: [`${headOf(PRODUCT)}.json`] });
  assert.deepEqual(outcomes.older, { read: 0, branch: [`${headOf(PRODUCT)}.json`, "latest.json", `${OLDER}.json`] });
  assert.equal(outcomes.none.read, 24, "known positive: without any stored overview the 12 decided queues are read, two files each");
  assert.deepEqual(outcomes.none.branch, [`${headOf(PRODUCT)}.json`, "latest.json"]);
});
