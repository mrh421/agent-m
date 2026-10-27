// The route `runs` — the runs of a commit (UC-028 steps 1 to 4, 2a, 2b, 6a, 7a), as docs/architecture/MOD-test-pages.md states it and ITM-760 builds it: a commit chosen from the default
// branch's history, an open pull request or a release tag, shown by its SHA, message and date; one line per level — passed, failed, flaky, not run, a level without a record reading "not run
// on this commit" with the occasions that would run it —; a level's tests with outcome, rate and its runs (beside the last release's), what each guards as a link, the participant and date; a
// failed test's expected result beside the observed one, with its log; records that cannot be read, with the link to the server's page of runs; a record marked uncommitted, shown and not counted.
//
// ITM-762 adds the release candidate's checklist of user-level tests: for a commit with a tag v<version>-rc.<N>, each user-level test with its expected result, the people the schedule's row `user` assigns
// (none where it names none), the name field of the release panel's Accept and release, Passed and Failed buttons that append one result record (occasion release-candidate) through appendResult, and
// what is still missing. Readings: a failed outcome is entered with what the person saw, which goes into the record's Failures row with the declaration's expected result and the log cell "entered by hand"; a
// `|` or a line break in that text is written as `/` or a space, so that it stays one cell.
//
// The commit-detail page draws its folded explanation through the frame; its topic stays in MOD-site-frame's explanations.md.
//
// ITM-1223 draws the route in the site's one look: the frame's head with the Tests entry's views (look.mjs); the commits to choose, the tests of a level and the
// user-level tests of a release candidate as rows of the frame's table (class list), each cell labelled by its column (data-label); the groups and levels as
// panels; the buttons as the frame's (btn).
//
// Readings the texts leave open: the log of a failed test is asked of ciRunLog with the id that ends the record's `run` address, when webLinks().run(id) gives that address back; the last release
// is the highest tag v<major>.<minor>.<patch>; a record is read with readDocument and resultSchema.run, since readRegister refuses a schema of two tables.
//
// Module: MOD-test-pages

import { resultSchema, resultsAt, flakyTests, rateComparison, appendResult } from "../result-records/index.mjs";
import { scheduleSchema, defaultSchedule, occasionsOf, secretsNeeded } from "../test-schedule/index.mjs";
import { readDocument } from "../documents/index.mjs";
import { isTestFile, testDeclarations } from "../test-document/index.mjs";
import { storedGraph } from "../trace-graph/index.mjs";
import { kindOf } from "../job-catalogue/index.mjs";
import { prepareJob } from "../job-runner/index.mjs";
import { newJobId, listJobs } from "../job-ledger/index.mjs";
import { participantSchema, participantsOf, eligible } from "../participant-list/index.mjs";
import { queueJob, routesFor, liveState } from "../runtimes/index.mjs";
import { resourceSchema } from "../resource-list/index.mjs";
import { runPanel, explain } from "../site-frame/index.mjs";
import { testsHead, readsAt, column, listTable } from "./look.mjs";

const SCHEDULE_PATH = "docs/tests/schedule.md";
const PARTICIPANTS_PATH = "docs/participants.md";
const RESOURCES_PATH = "docs/resources.md";
const WORKFLOWS = [".github/workflows/agent-m-jobs.yml", ".gitlab/agent-m-jobs.yml"];
const JOB_FILE = /^docs\/jobs\/(JOB-[^/]+)\.md$/;
const RUN_KIND = "run-tests";
const EVERY = 5000;
const RESULTS_BRANCH = "test-results";
const LEVELS = ["unit", "component", "system", "release", "user"];
const RELEASE_TAG = /^v(\d+)\.(\d+)\.(\d+)$/;

function el(name, className, ...children) {
  const node = document.createElement(name);
  if (className) node.className = className;
  node.append(...children);
  return node;
}

const firstLine = (message) => String(message ?? "").split("\n")[0];

// The page of an artifact a guarded name leads to, in the form the frame reads; a name the graph does not hold, or of a kind without a page, has none.
function addressOf(graph, name) {
  const kind = graph.nodes.get(name)?.kind;
  const route = { requirement: ["requirement", "name"], UC: ["use-case", "id"], MOD: ["module", "id"], ARC: ["decision", "id"] }[kind];
  return route ? `#${route[0]}/${route[1]}=${encodeURIComponent(name)}` : null;
}

function chooser(target, context, { history, pulls, tags, branch }) {
  const choose = (commit, text) => {
    const choice = el("button", "btn choose", text);
    choice.setAttribute("type", "button");
    choice.addEventListener("click", () => context.go("runs", { commit }));
    return choice;
  };
  const group = (title, columns, rows) => el("section", "panel choices", el("h3", null, title),
    rows.length ? listTable(columns, rows) : el("p", "muted", "None."));
  target.replaceChildren(testsHead(context, { title: "Runs", shown: "Runs",
    reads: readsAt(context.product.address, branch, "read now from the repository, its pull requests and its tags; nothing here is stored.") }),
  group("Default branch", ["Commit", "Date"], history.map((entry) => el("tr", null, column("Commit", choose(entry.commit, `${entry.commit.slice(0, 7)} ${firstLine(entry.message)}`)),
    column("Date", entry.date ?? "")))),
  group("Open pull requests", ["Pull request", "Head"], pulls.map((pull) => el("tr", null, column("Pull request", choose(pull.head, `#${pull.number} ${pull.title}`)),
    column("Head", String(pull.head ?? "").slice(0, 7))))),
  group("Release tags", ["Tag", "Commit"], tags.map((tag) => el("tr", null, column("Tag", choose(tag.commit, tag.name)), column("Commit", tag.commit.slice(0, 7))))));
}

// The tag of the last release: the highest v<major>.<minor>.<patch>.
function lastReleaseOf(tags) {
  const releases = tags.filter((tag) => RELEASE_TAG.test(tag.name))
    .sort((a, b) => { const [x, y] = [a, b].map((tag) => RELEASE_TAG.exec(tag.name).slice(1).map(Number)); return y[0] - x[0] || y[1] - x[1] || y[2] - x[2]; });
  return releases[0]?.commit ?? null;
}

// The id that ends the address of a run, where the host's own page of that run is that address.
function runIdOf(host, address) {
  const id = String(address ?? "").split("/").filter(Boolean).at(-1);
  return id && host.webLinks().run(id) === address ? id : null;
}

async function logOf(host, address) {
  const id = runIdOf(host, address);
  return id === null ? null : host.ciRunLog(id);
}

async function failureBlock(host, rows) {
  const { row, document } = rows;
  const log = await logOf(host, document.fields.run);
  return el("div", "failure", el("div", "expected", row.cells.Expected ?? ""), el("div", "observed", row.cells.Observed ?? ""),
    el("div", "excerpt", row.cells.Log ?? ""), el("pre", "log", log ?? "The log is unavailable: the server no longer keeps it."));
}

const failureRow = (document, id) => document.sections.find((section) => section.heading === "## Failures")?.rows?.find((row) => row.cells.Test === id) ?? null;

async function testRow(host, test, declaration, { graph, documents, rate, flaky }) {
  const last = test.records.at(-1);
  const who = last ? documents.get(last) : null;
  const guards = (declaration?.guards ?? []).flatMap((name, at) => {
    const address = addressOf(graph, name);
    const item = address ? el("a", null, name) : el("span", null, name);
    if (address) item.setAttribute("href", address);
    return at ? [" ", item] : [item];
  });
  const rateText = test.runs ? `${test.runs} runs` : "";
  const comparison = rate
    ? [rate.then ? ` (last release: ${rate.then})` : "", rate.worse ? " worse than the last release" : ""].join("")
    : "";
  const outcome = [el("span", "outcome", test.outcome)];
  if (flaky) outcome.push(el("span", "flaky-runs", ` passed in ${flaky.passedIn.join(", ")}; failed in ${flaky.failedIn.join(", ")}`));
  if (test.outcome === "failed") {
    const path = [...test.records].reverse().find((candidate) => failureRow(documents.get(candidate), test.id));
    if (path) outcome.push(await failureBlock(host, { row: failureRow(documents.get(path), test.id), document: documents.get(path) }));
  }
  const row = el("tr", "test", column("Test", el("span", "id", test.id)), column("Outcome", ...outcome),
    column("Runs", ...(rateText ? [el("span", "rate", rateText + comparison)] : [])),
    column("Run by", ...(who ? [el("span", "who", `${who.fields.participant}, ${who.fields.date}`)] : [])),
    column("Guards", el("span", "guards", ...guards)));
  row.setAttribute("data-test", test.id);
  return row;
}
const TEST_COLUMNS = ["Test", "Outcome", "Runs", "Run by", "Guards"];

const RC_TAG = /^v\d+\.\d+\.\d+-rc\.\d+$/;
const cell = (text) => String(text ?? "").replace(/\|/g, "/").replace(/\s*\n\s*/g, " ").trim();

// The text of a result record of one user-level test's outcome, at runs/<commit>/<yyyymmdd>-<hhmm>-release-candidate-<4 hex>.md.
function userRecord(commit, who, declaration, outcome, seen) {
  const now = new Date();
  const iso = now.toISOString().replace(/\.\d+Z$/, "Z");
  const hex = [...crypto.getRandomValues(new Uint8Array(2))].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  const path = `runs/${commit}/${iso.slice(0, 10).replaceAll("-", "")}-${iso.slice(11, 16).replace(":", "")}-release-candidate-${hex}.md`;
  const failure = outcome === "failed"
    ? `\n## Failures\n\n| Test | Expected | Observed | Log |\n|---|---|---|---|\n| ${declaration.id} | ${cell(declaration.expect)} | ${cell(seen)} | entered by hand |\n` : "";
  const text = `---\ncommit: ${commit}\nlevels:\n  - user\noccasion: release-candidate\nparticipant: ${cell(who)}\ndate: ${iso}\n---\n`
    + `## Outcomes\n\n| Test | Level | Outcome | Runs |\n|---|---|---|---|\n| ${declaration.id} | user | ${outcome} | |\n${failure}`;
  return readDocument(resultSchema.run, path, text);
}

function checklistOf(host, { declarations, levels, schedule, commit, again }) {
  const assigned = (schedule.sections.find((section) => section.heading === "## Levels")?.rows ?? []).find((row) => row.cells.Row === "user")?.cells["runs on"] ?? "";
  const outcomes = new Map((levels.find((level) => level.level === "user")?.tests ?? []).map((test) => [test.id, test.outcome]));
  const tests = declarations.filter((declaration) => declaration.level === "user");
  const missing = tests.filter((declaration) => (outcomes.get(declaration.id) ?? "not run") === "not run");
  const person = el("input", "person");
  person.placeholder = "Your name";
  const result = el("p", "result");
  const items = tests.map((declaration) => {
    const seen = el("input", "seen");
    seen.placeholder = "What you saw (for Failed)";
    const record = async (outcome) => {
      if (!(person.value ?? "").trim()) { result.textContent = "Enter your name first."; return; }
      if (outcome === "failed" && !(seen.value ?? "").trim()) { result.textContent = "Say what you saw first."; return; }
      try {
        await appendResult(host, userRecord(commit, person.value, declaration, outcome, seen.value));
        await again();
      } catch (error) {
        result.textContent = error?.message ?? String(error);
      }
    };
    const passed = el("button", "btn passed", "Passed");
    const failed = el("button", "btn failed", "Failed");
    passed.setAttribute("type", "button");
    failed.setAttribute("type", "button");
    seen.setAttribute("aria-label", `What you saw in ${declaration.id}`);
    passed.addEventListener("click", () => record("passed"));
    failed.addEventListener("click", () => record("failed"));
    const item = el("tr", "user-test", column("Test", el("span", "id", declaration.id)), column("Outcome", el("span", "outcome", outcomes.get(declaration.id) ?? "not run")),
      column("Expected", el("div", "expected", declaration.expect ?? "")), column("What you saw", seen), column("Record", passed, failed));
    item.setAttribute("data-checklist", declaration.id);
    return item;
  });
  return el("section", "panel checklist", el("h3", null, "Checklist of user-level tests"),
    el("p", "assigned", assigned ? `Assigned to: ${assigned}` : "No one assigned: the schedule's row user names no one."),
    el("p", "missing", missing.length ? `Still missing: ${missing.map((declaration) => declaration.id).join(", ")}` : "Nothing is missing."),
    el("label", null, "Your name ", person), listTable(["Test", "Outcome", "Expected", "What you saw", "Record"], items), result);
}

// ---------------------------------------------------------------- Run on this commit (ITM-761; UC-028 steps 5 to 7, 5a, 5b)
//
// Readings the texts leave open: the levels offered are those the page lists, the preset ones those with no outcome on the commit; the participants are those `eligible` admits for the capabilities of the kind
// `run-tests`; a participant on the tab's route (a model endpoint) runs no code, so the first other route routesFor offers is the one used; the run panel is drawn once a participant and the person's name are chosen
// (no identity setting exists, as the route `release` asks for the name directly); the job is queued with the parameters { commit, levels, occasion: "on-demand" }; progress is read again with setTimeout every 5 s while it
// is in the page (liveState), and a job that has ended redraws the page, so that the new record shows and the reading stops; without a token, the reviewer is sent to the server's page of workflows (webLinks().actions)
// with the commit and the levels named, since webLinks has no page of one workflow.

const recordRoute = (route) => (route.kind === "ci" ? (route.runner === "hosted" ? "ci hosted" : `ci runner:${route.runner}`) : `bridge ${route.bridge}`);
const checked = (box) => box.checked === true;

function levelBoxes(levels, preset) {
  return levels.map((level) => {
    const box = el("input", "level");
    box.setAttribute("type", "checkbox");
    box.value = level.level;
    box.checked = preset.has(level.level);
    return box;
  });
}

async function progressOf(host, id) {
  const { defaultBranch } = await host.repositoryInfo();
  const snapshot = await host.readSnapshot(defaultBranch);
  const row = (await listJobs([{ address: snapshot.repository?.web ?? "", snapshot }], new Map())).find((each) => each.record.id === id);
  if (!row) return { text: "its record is not on the default branch yet", ended: false };
  if (row.record.end) return { text: `ended, ${row.record.end.state}`, ended: true };
  const live = await liveState(row.record, { host }, {});
  if (live.reachable === false) return { text: `its runtime cannot be reached: ${live.reason}`, ended: false };
  return { text: live.running ? "running" : live.known ? "taken, not running" : "queued", ended: false };
}

async function prepareRun(state, chosen, levelsChosen, person) {
  const { host, context, commit, definition, participants, register, head, product, schedule } = state;
  const now = new Date();
  const params = { commit, levels: levelsChosen, occasion: "on-demand" };
  const id = newJobId(now, new Set(head.paths.map((path) => JOB_FILE.exec(path)?.[1]).filter(Boolean)));
  const agentM = { version: register.commit ?? "unknown", commit: register.commit ?? "unknown" };
  const jobContext = { kind: definition, params, product: { address: head.repository?.web ?? "", snapshot: head, host }, instance: { snapshot: register, host: context.instance.host, checkout: null },
    connect: async () => host, participants, places: { sources: {}, mailbox: null }, gates: [], person, now, agentM, jobId: id };
  const prepared = await prepareJob(RUN_KIND, jobContext, { drafter: chosen, reviewers: [] });
  const offer = routesFor(chosen, participants, product, []).filter((each) => each.route.kind !== "tab")[0];
  void schedule;
  return { prepared, offer, params, id, now, agentM };
}

async function queueRun(state, chosen, ready, person, out) {
  const { host, head } = state;
  const { prepared, offer, params, id, now, agentM } = ready;
  const record = { id, kind: RUN_KIND, worksOn: [state.commit], participant: chosen.name, model: chosen.model, route: recordRoute(offer.route), run: null, retries: null, startedBy: person,
    start: now, agentM, inputs: prepared.parts.map((part) => part.name), limit: prepared.limit,
    destinations: prepared.destinations.map((each) => ({ participant: each.participant.name, place: each.place, parts: each.parts })), params };
  await queueJob(host, record, offer.route, head.commit);
  const progress = el("p", "progress", `Job ${id}: queued`);
  // The progress is read again every EVERY ms while the progress is in the page; once the job has ended the page is drawn again, so that the new record shows, and the reading stops.
  const read = async () => {
    if (!progress.isConnected) return;
    let ended = false;
    try {
      const found = await progressOf(host, id);
      progress.textContent = `Job ${id}: ${found.text}`;
      ended = found.ended;
    } catch (failure) {
      progress.textContent = `Job ${id}: ${failure?.message ?? failure}`;
    }
    if (ended) await state.again();
    else setTimeout(read, EVERY);
  };
  setTimeout(read, EVERY);
  out.replaceChildren(el("p", "job-queued", `Job ${id} is queued on the route ${record.route}.`), progress);
}

async function openRun(state, section) {
  const { host, context, commit, levels, schedule } = state;
  const preset = new Set(levels.filter((level) => level.passed + level.failed + level.flaky === 0).map((level) => level.level));
  if (!context.product.tokenStored) {
    const link = el("a", "workflow-page", "Open the server's page of workflows");
    link.setAttribute("href", host.webLinks().actions);
    section.replaceChildren(el("p", "no-token", `Without a token Agent M cannot start the run. Open the server's page of workflows and start the tests there on the commit ${commit}, for the levels ${[...preset].join(", ") || "you choose"}. `, link));
    return;
  }
  const form = el("section", "run-on-commit-form");
  section.replaceChildren(form);
  try {
    const definition = await kindOf(RUN_KIND);
    const info = await context.instance.host.repositoryInfo();
    const register = await context.instance.host.readSnapshot(info.defaultBranch);
    const registerText = await register.read(PARTICIPANTS_PATH);
    const participants = registerText == null ? [] : participantsOf(readDocument(participantSchema(), PARTICIPANTS_PATH, registerText));
    const head = await host.readSnapshot((await host.repositoryInfo()).defaultBranch);
    const product = { visibility: (await host.repositoryInfo()).visibility, jobWorkflow: WORKFLOWS.some((path) => head.paths.includes(path)) };
    const admitted = eligible(participants, { capabilities: definition.needs }).eligible;
    Object.assign(state, { definition, participants, register, head, product });
    if (admitted.length === 0) {
      // It leads to UC-017 only through the context's go, as the frame's button (MOD-test-pages; views.mjs does the same).
      const uc = el("button", "uc-017 btn", "UC-017");
      uc.setAttribute("type", "button");
      uc.addEventListener("click", () => context.go("use-case", { id: "UC-017" }));
      form.append(el("p", "missing-capability", `No participant can run the levels: none declares ${definition.needs.join(", ")}. Declare it for a participant — `, uc, "."));
      return;
    }
    const boxes = levelBoxes(levels, preset);
    const radios = admitted.map((participant) => {
      const radio = el("input", "participant");
      radio.setAttribute("type", "radio");
      radio.setAttribute("name", "participant");
      radio.value = participant.name;
      return radio;
    });
    const person = el("input", "person");
    person.setAttribute("placeholder", "Your name");
    const box = el("div", "run-stage");
    const refresh = async () => {
      box.replaceChildren();
      const chosen = admitted.find((participant) => radios.some((radio) => radio.value === participant.name && checked(radio)));
      const levelsChosen = boxes.filter(checked).map((each) => each.value);
      const name = (person.value ?? "").trim();
      if (!chosen || !name) { box.append(el("p", "muted", "Choose a participant and enter your name to see the run panel.")); return; }
      if (levelsChosen.length === 0) { box.append(el("p", "problem", "Choose at least one level.")); return; }
      try {
        const ready = await prepareRun(state, chosen, levelsChosen, name);
        if (!ready.offer || !ready.offer.available) { box.append(el("p", "problem", ready.offer ? ready.offer.reason : "the participant has no route that runs tests")); return; }
        const resources = await head.read(RESOURCES_PATH);
        const needed = resources == null ? [] : secretsNeeded(schedule, readDocument(resourceSchema(), RESOURCES_PATH, resources));
        const out = el("div", "run-result");
        box.append(el("p", "where", `The run happens on the route ${recordRoute(ready.offer.route)}, on the commit ${commit}, for the levels ${levelsChosen.join(", ")}.`),
          el("p", "paid-services", `Paid services it calls: ${[...new Set(needed.map((each) => each.for))].join(", ") || "none"}.`),
          el("p", "secrets-used", `Secrets it uses, by name: ${needed.map((each) => each.name).join(", ") || "none"}.`),
          runPanel(ready.prepared, { onRun: async () => { try { await queueRun(state, chosen, ready, name, out); } catch (failure) { out.replaceChildren(el("p", "problem", `${failure.name}: ${failure.message}`)); } } }), out);
      } catch (failure) {
        box.append(el("p", "problem", `${failure.name}: ${failure.message}`));
      }
    };
    for (const input of [...boxes, ...radios, person]) input.addEventListener("change", refresh);
    form.append(el("h3", null, "Run on this commit"), el("ul", "levels", ...boxes.map((each) => el("li", null, el("label", null, each, ` ${each.value}`)))),
      el("ul", "participants", ...radios.map((each) => el("li", null, el("label", null, each, ` ${each.value}`)))), el("label", null, "Your name ", person), box);
  } catch (failure) {
    form.append(el("p", "problem", `${failure.name}: ${failure.message}`));
  }
}

function runOnCommit(state) {
  const section = el("section", "panel run-section");
  const open = el("button", "btn run-on-commit", "Run on this commit");
  open.setAttribute("type", "button");
  open.addEventListener("click", () => openRun(state, section));
  section.append(open);
  return section;
}

async function detail(target, context, commit) {
  const { host } = context.product;
  const entry = (await host.readHistory(null, { ref: commit, limit: 1, changes: false }))[0];
  const shown = el("p", "commit", `${commit} ${firstLine(entry?.message)} ${entry?.date ?? ""}`);
  const head = testsHead(context, { title: "Runs", shown: "Runs",
    reads: readsAt(context.product.address, commit.slice(0, 7), `and the records of its runs on the branch ${RESULTS_BRANCH}, read now; nothing here is stored.`) });
  head.append(shown);
  let results;
  try {
    results = await host.readSnapshot(RESULTS_BRANCH);
  } catch {
    const links = host.webLinks();
    const branch = el("a", null, `Open the branch ${RESULTS_BRANCH} on the server`);
    branch.setAttribute("href", links.branch(RESULTS_BRANCH));
    const runs = el("a", null, "Open the runs of this commit on the server");
    runs.setAttribute("href", links.commitRuns(commit));
    target.replaceChildren(head, el("p", "unreadable", "The result records cannot be read from the browser, for example in a private repository without a token. ",
      branch, " ", runs));
    return;
  }
  const snapshot = await host.readSnapshot(commit);
  const declarations = (await Promise.all(snapshot.paths.filter(isTestFile).map(async (path) => testDeclarations(path, (await snapshot.read(path)) ?? "")))).flat();
  const [graph, saved, tags] = await Promise.all([storedGraph(snapshot, commit), snapshot.read(SCHEDULE_PATH), host.listTags()]);
  const schedule = saved == null ? defaultSchedule() : readDocument(scheduleSchema, SCHEDULE_PATH, saved);
  const tests = declarations.map(({ id, level }) => ({ id, level }));
  const [levels, flaky, rates] = await Promise.all([resultsAt(results, commit, tests), flakyTests(results, commit), rateComparison(results, commit, lastReleaseOf(tags))]);
  const documents = new Map();
  for (const path of results.paths.filter((candidate) => candidate.startsWith(`runs/${commit}/`) && candidate.endsWith(".md"))) {
    documents.set(path, readDocument(resultSchema.run, path, (await results.read(path)) ?? ""));
  }
  const byId = new Map(declarations.map((declaration) => [declaration.id, declaration]));
  const sections = [];
  for (const level of [...levels].sort((a, b) => LEVELS.indexOf(a.level) - LEVELS.indexOf(b.level))) {
    const ran = level.passed + level.failed + level.flaky > 0;
    const summary = ran
      ? `${level.passed} passed, ${level.failed} failed, ${level.flaky} flaky, ${level.notRun} not run`
      : `not run on this commit — runs on: ${occasionsOf(level.level, schedule).join(", ") || "no occasion of the schedule"}`;
    const rows = await Promise.all(level.tests.map((test) => testRow(host, test, byId.get(test.id),
      { graph, documents, rate: rates.find((rate) => rate.test === test.id), flaky: flaky.find((each) => each.test === test.id) })));
    const section = el("section", "panel level", el("h3", null, level.level), el("p", "summary", summary),
      rows.length ? listTable(TEST_COLUMNS, rows) : el("p", "muted", "No test of this level."));
    section.setAttribute("data-level", level.level);
    sections.push(section);
  }
  const uncommitted = [...documents.entries()].filter(([, document]) => document.fields.uncommitted === "true")
    .map(([path, document]) => el("p", "uncommitted", `${document.fields.participant}, ${document.fields.date}: uncommitted changes, not counted (${path})`));
  const candidate = tags.some((tag) => tag.commit === commit && RC_TAG.test(tag.name));
  const checklist = candidate ? [checklistOf(host, { declarations, levels, schedule, commit, again: () => detail(target, context, commit) })] : [];
  const levelsShown = [...levels].sort((a, b) => LEVELS.indexOf(a.level) - LEVELS.indexOf(b.level));
  const run = runOnCommit({ host, context, commit, levels: levelsShown, schedule, again: () => detail(target, context, commit) });
  head.append(explain("test-runs"));
  target.replaceChildren(head, ...sections, ...uncommitted, ...checklist, run);
}

async function render(target, context, params = {}) {
  if (!context.product) {
    target.replaceChildren(testsHead(context, { title: "Runs", shown: "Runs" }), el("p", null, "Choose a product to see the runs of its commits."));
    return;
  }
  if (params.commit) return detail(target, context, params.commit);
  const { host } = context.product;
  const info = await host.repositoryInfo();
  const [history, pulls, tags] = await Promise.all([host.readHistory(null, { ref: info.defaultBranch, limit: 20, changes: false }), host.listPullRequests({ state: "open" }), host.listTags()]);
  chooser(target, context, { history, pulls, tags, branch: info.defaultBranch });
}

export const route = { name: "runs", entry: "tests", title: "Runs", render };
