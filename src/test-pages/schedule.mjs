// The route `schedule` — the schedule page (UC-027), as docs/architecture/MOD-test-pages.md states it. ITM-758 builds the part before Save: the table of
// levels by occasion with each row's number of tests, the book's default marked as such until one is saved, a folded "What is this?" per row and column
// naming the book's chapter, the cells that refuse with their reason, the form of the schedule's schema (the nightly time, the command, the levels) whose
// findings are those of scheduleFindings, the runner per row among the participants with "run code and tests", and the secrets needed by name with the
// server's secrets page — never a field for a value.
//
// ITM-850 adds UC-027 3b: for each row whose runner is a participant with the route `ci runner:<label>`, the server's runner page (webLinks().runners, which shows the command
// to run on the machine), the label, a folded explanation, and the default branch's runs in the state queued whose ciRunLabels hold the row's label (ITM-1081). The page reads no runner's state.
//
// ITM-759 adds Save and what follows it (UC-027 steps 5 to 7, 1a, 1b, 3a, 6a, 7a): Save writes the runner chosen per row into the schedule and opens one pull
// request through proposeSchedule; the pull request's CI, read with listCiRuns for its head, and Merge once it is green, through mergePullRequest at the head
// shown, after which applyPipelineSchedule sets the nightly pipeline schedule on a GitLab server and the page links it; a red CI is not merged. The pull
// request is kept only in the screen. Where the product holds a CI configuration, configurationDrift shows it against the schedule; where it holds the
// generated file, the last run per occasion, told by the run's event, and a nightly run that has not run, with its date beside the expected one.
//
// ITM-1223 draws the page in the site's one look (look.mjs): the frame's head with the Tests entry's views, its parts as panels, its buttons the frame's (btn).
// The levels by occasion are shown once: the table is the form's own input for the section ## Levels — a box per occasion cell, edited in place — beside a
// labelled row with its explanation for each key of the schedule's front matter, and one Save. The form is built here from the schedule's schema, its findings
// those of documentFindings and scheduleFindings: the frame's schemaForm edits a section only in the renderer's editor and draws a key without its explanation.
//
// ITM-1225: every folded explanation is the frame's `explain` of a topic of explanations.md — a level, an occasion, a field of the front matter, the secrets
// and a self-hosted runner —; the page builds no fold of its own.
//
// ITM-1265: each row's number of tests is taken from the counts stored for the commit shown (MOD-progress-measures' storedView with the page `schedule`), with the line
// storedView names while the head's are not stored yet; the test files are read only where the repository stores no view.
//
// ITM-1307: where no view is stored, the counts are those scheduleView gives for the declarations the route reads; the route keeps no counting rule of its own.
//
// ITM-1420: Save and Merge are the module's button (look.mjs), which answers only a click the browser marks as a person's.
//
// ITM-1418: the last runs show all five occasions. The release candidate's is the newest push run of the generated workflow on a commit that a candidate's tag
// v<version>-rc.<N> names (listTags, listCiRuns): CiRun names no ref, and a candidate's run is the push of its tag.
//
// Module: MOD-test-pages

import { scheduleSchema, defaultSchedule, scheduleFindings, secretsNeeded, configurationDrift, occasionsOf, proposeSchedule, applyPipelineSchedule } from "../test-schedule/index.mjs";
import { readDocument, documentFindings } from "../documents/index.mjs";
import { testsHead, readsAt, button, LEVEL_TOPIC, OCCASION_TOPIC } from "./look.mjs";
import { explain } from "../site-frame/index.mjs";
import { participantSchema, participantsOf, eligible } from "../participant-list/index.mjs";
import { resourceSchema } from "../resource-list/index.mjs";
import { isTestFile, testDeclarations } from "../test-document/index.mjs";
import { scheduleView, storedView } from "../progress-measures/index.mjs";
import { heads } from "./routes.mjs";

const TITLE = heads.schedule.title;
const SCHEDULE_PATH = "docs/tests/schedule.md";
const RESOURCES_PATH = "docs/resources.md";
const PARTICIPANTS_PATH = "docs/participants.md";
const ROWS = ["unit", "component", "system", "paid", "release", "user"];
const COLUMNS = ["every commit", "pull request", "nightly", "release candidate", "on demand"];
const RELEASE_RULE = "A RELEASE RUNS EVERY TEST AT EVERY LEVEL";
const PAID_RULE = "COMMIT TESTS CALL NO PAID SERVICE";
// The CI configuration of a product, as configurationDrift compares it, and the file the schedule generates (MOD-test-schedule, Data).
const CONFIGURATION = /^(\.github\/workflows\/[^/]+\.ya?ml|\.gitlab-ci\.yml|\.gitlab\/[^/]+\.ya?ml)$/;
const GENERATED_WORKFLOW = "agent-m-tests.yml";
const GENERATED = { github: `.github/workflows/${GENERATED_WORKFLOW}`, gitlab: `.gitlab/${GENERATED_WORKFLOW}` };
// The occasion a run stands for, told by its event on GitHub or its pipeline source on GitLab; a release candidate's run is not told apart by its event.
const OCCASION_OF_EVENT = { push: "every commit", pull_request: "pull request", merge_request_event: "pull request", schedule: "nightly",
  workflow_dispatch: "on demand", web: "on demand" };
// The tags of a product's release candidates, v<version>-rc.<N>, as listTags takes a pattern (MOD-release-evidence, Data: "Tags of a product's line"). The candidate's
// tag is set on its commit before its run, and the release's v<version> later on the same commit.
const CANDIDATE_TAGS = "v*-rc.*";
// The events of each server that stand for an occasion, as OCCASION_OF_EVENT maps them.
const EVENTS_OF = { github: ["push", "pull_request", "schedule", "workflow_dispatch"], gitlab: ["push", "merge_request_event", "schedule", "web"] };
const DAY = 24 * 60 * 60 * 1000;

// The topics of the frame's explanations.md that explain each key of the schedule's front matter (ITM-1225).
const FIELD_TOPIC = { nightly: "schedule-field-nightly", command: "schedule-field-command", setup: "schedule-field-setup", cache: "schedule-field-cache",
  minutes: "schedule-field-minutes" };

function el(name, className, ...children) {
  const node = document.createElement(name);
  if (className) node.className = className;
  node.append(...children);
  return node;
}

function link(className, text, href) {
  const node = el("a", className, text);
  node.setAttribute("href", href);
  return node;
}

// What a failure says to the person: the host's reason where it names one, else its message.
const said = (error) => error?.reason ?? error?.message ?? String(error);

// The reason a cell refuses, or null: the release candidate column of every row, and the every commit and pull request cells of the row paid.
function refusal(row, column) {
  if (column === "release candidate") return `cannot be cleared: ${RELEASE_RULE}.`;
  if (row === "paid" && (column === "every commit" || column === "pull request")) {
    return `cannot be ticked: ${PAID_RULE}; use recorded responses on a commit or a pull request.`;
  }
  return null;
}

// The Facts of the snapshot whose tests are `tests`, for scheduleView, which reads `tests` and `snapshot`: every other field "unknown" where the type of Facts allows it,
// and empty where it does not (MOD-progress-measures, Interfaces: Facts).
const testFacts = (snapshot, tests) => ({
  address: "", info: "unknown", snapshot, graph: "unknown", requirements: "unknown", statuses: new Map(), queues: [], declaration: null, workflow: "unknown",
  model: "unknown", modelUnread: null, modelSince: "unknown", participants: [], plan: { order: null, items: [], states: [] }, sprints: [], assignments: [], held: [],
  gates: [], gateStates: [], jobs: [], pullRequests: "unknown", schedule: "unknown", ci: "unknown", tags: "unknown", results: "unknown", tests,
  resourceNeeds: "unknown", resultCommits: "unknown", own: false, modules: [],
});

// How many tests each row holds, -> { counts, asOf }: the counts stored for the snapshot's commit, or, while those are not stored yet, the counts stored last with their commit
// (asOf); where the repository stores none, the counts MOD-progress-measures' scheduleView gives for the declarations of the test files.
async function testCounts(snapshot) {
  const stored = await storedView(snapshot, "schedule");
  if (stored) return { counts: stored.view.counts, asOf: stored.asOf };
  // The test files are told to the snapshot first, to be read in batches.
  const paths = snapshot.paths.filter(isTestFile);
  await snapshot.readMany?.(paths);
  const declared = (await Promise.all(paths.map(async (path) => testDeclarations(path, (await snapshot.read(path)) ?? "")))).flat();
  return { counts: scheduleView(testFacts(snapshot, declared)).counts, asOf: null };
}

// A row's runner field, named for a screen reader by its row and its column (THE SITE SERVES A SCREEN READER).
function runnerChoice(row, offered, current) {
  const choice = el("select", "runner", ...["hosted", ...offered].map((name) => {
    const option = el("option", null, name);
    option.setAttribute("value", name);
    return option;
  }));
  choice.value = current;
  choice.setAttribute("aria-label", `${row} runs on`);
  return choice;
}

const levelsOf = (schedule) => schedule.sections.find((section) => section.heading === "## Levels")?.rows ?? [];

// A cell of a row, labelled by its column's title for the frame's narrow form of a table on a phone (MOD-site-frame, look.css).
function labelled(cell, label) {
  cell.setAttribute("data-label", label);
  return cell;
}

// The state a cell's rule holds: the release candidate ticked, the commit cells of paid unticked; null for a cell without a rule.
const ruled = (row, column) => (column === "release candidate" ? true : refusal(row, column) ? false : null);

// A cell's box for its tick, named by its row and its column (THE SITE SERVES A SCREEN READER); a box in the state its cell's rule holds cannot be
// changed, one that breaks the rule can, so that the person can mend it. Its change shows in the cell's mark and calls `changed`.
function tickBox(row, column, ticked, mark, changed) {
  const box = el("input", "tick");
  box.setAttribute("type", "checkbox");
  box.setAttribute("aria-label", `${row} on ${column}`);
  box.checked = ticked;
  box.disabled = ruled(row, column) === ticked;
  box.addEventListener("change", () => {
    mark.textContent = box.checked ? "✓" : "";
    changed();
  });
  return box;
}

// The table, the frame's table (class list) with no style of its own, and the form's own input for the section ## Levels; `choices` receives, per
// row, its runner field and the runner it was shown with, which Save compares, and `ticks`, per row, the box of each occasion.
function levelsTable(schedule, counts, offered, { choices, ticks, changed }) {
  const cells = (row) => levelsOf(schedule).find((candidate) => candidate.cells.Row === row)?.cells ?? {};
  const head = el("tr", null, el("th", null, "Level"), el("th", null, "tests"),
    ...COLUMNS.map((column) => {
      const th = el("th", null, column, explain(OCCASION_TOPIC[column]));
      th.setAttribute("data-column", column);
      return th;
    }), el("th", null, "runs on"));
  const body = ROWS.map((row) => {
    const select = runnerChoice(row, offered, cells(row)["runs on"] || "hosted");
    select.addEventListener("change", changed);
    choices.set(row, { select, shown: select.value });
    ticks.set(row, new Map());
    const tr = el("tr", null, labelled(el("th", null, row, explain(LEVEL_TOPIC[row])), "Level"), labelled(el("td", "tests", String(counts[row])), "tests"),
      ...COLUMNS.map((column) => {
        const reason = refusal(row, column);
        const ticked = cells(row)[column] === "✓";
        const mark = el("span", "mark", ticked ? "✓" : "");
        const box = tickBox(row, column, ticked, mark, changed);
        ticks.get(row).set(column, box);
        const td = el("td", reason ? "refused" : null, box, mark);
        if (reason) td.append(" ", el("span", "reason", reason));
        td.setAttribute("data-column", column);
        return labelled(td, column);
      }), labelled(el("td", null, select), "runs on"));
    tr.setAttribute("data-row", row);
    return tr;
  });
  return el("table", "list levels", el("thead", null, head), el("tbody", null, ...body));
}

// The schedule as the person has left the table: each occasion as its box holds it, and the runner chosen for each row whose choice the person changed.
function withTable(schedule, { choices, ticks }) {
  const chosen = structuredClone(schedule);
  for (const row of levelsOf(chosen)) {
    for (const [column, box] of ticks.get(row.cells.Row) ?? []) row.cells[column] = box.checked ? "✓" : "";
    const choice = choices.get(row.cells.Row);
    if (choice && choice.select.value !== choice.shown) row.cells["runs on"] = choice.select.value;
  }
  return chosen;
}

// The form of the schedule's schema: one labelled row per key of its front matter, each with its explanation, the table of levels as the input of its
// section ## Levels, the findings of the schema and of scheduleFindings while the person edits, and one Save, offered only while no error remains. It
// writes nothing itself: `onSave` does.
function scheduleForm(schedule, table, state, { participants, findings, onSave }) {
  const inputs = new Map();
  // A key the schema holds as a list is a field of one item per line, as schedule.schema.md describes `cache`: one path per line.
  const isList = (key) => scheduleSchema.frontMatter[key].type === "list";
  const fields = Object.keys(scheduleSchema.frontMatter ?? {}).map((key) => {
    const input = el(isList(key) ? "textarea" : "input");
    const value = schedule.fields?.[key];
    input.value = Array.isArray(value) ? value.join("\n") : String(value ?? "");
    inputs.set(key, input);
    const field = el("div", "field", el("label", null, `${key} `, input), explain(FIELD_TOPIC[key]));
    field.setAttribute("data-key", key);
    return field;
  });
  // Save answers a person's click only (THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK).
  const save = button("btn primary", "Save", async () => {
    save.disabled = true;
    try {
      await onSave(documentNow());
    } finally {
      check();
    }
  });
  const documentNow = () => {
    const now = withTable(schedule, state);
    for (const [key, input] of inputs) {
      const typed = input.value.trim();
      if (typed === "") delete now.fields[key];
      else now.fields[key] = isList(key) ? typed.split("\n").map((each) => each.trim()).filter(Boolean) : typed;
    }
    return now;
  };
  const check = () => {
    const now = documentNow();
    const found = [...documentFindings(scheduleSchema, now), ...scheduleFindings(now, participants)];
    findings.replaceChildren(...found.map((finding) => el("li", finding.kind, `${finding.what} — ${finding.fix} [${finding.rule}]`)));
    save.disabled = found.some((finding) => finding.kind === "error");
  };
  state.changed = check;
  for (const input of inputs.values()) input.addEventListener("input", check);
  return { form: el("div", "schedule-form", table, ...fields, findings, el("p", null, save)), check };
}

// The label a CI agent's route `ci runner:<label> ...` names, or null.
const runnerLabel = (route) => /^ci runner:(\S+)/.exec(route ?? "")?.[1] ?? null;

// The rows whose chosen runner is a self-hosted runner of the register, each with its label.
function selfHostedRows(schedule, participants) {
  return levelsOf(schedule).flatMap((row) => {
    const label = runnerLabel(participantsOf(participants).find((each) => each.name === row.cells["runs on"])?.route);
    return label === null ? [] : [{ row: row.cells.Row, label }];
  });
}

// The runs of the default branch that wait, each with the runner labels it asks for: unreadable runs or labels are said so, the registration stays.
async function queuedRuns(host) {
  try {
    const { defaultBranch } = await host.repositoryInfo();
    const queued = (await host.listCiRuns({ branch: defaultBranch })).filter((run) => run.state === "queued");
    return await Promise.all(queued.map(async (run) => ({ run, labels: await host.ciRunLabels(run.id) })));
  } catch {
    return null;
  }
}

function runnerBlocks(rows, runnersPage, asked) {
  return rows.map(({ row, label }) => {
    const queued = asked === null ? null : asked.filter(({ labels }) => labels.includes(label)).map(({ run }) => run);
    const waiting = queued === null ? el("p", "runs-unreadable", "The runs of this repository cannot be read, so the queued ones are not shown.")
      : queued.length === 0 ? el("p", "no-queued", "No run waits for a runner.")
        : el("ul", "queued-runs", ...queued.map((run) => el("li", null, link(null, `${run.workflow} ${run.commit.slice(0, 7)} (queued)`, run.url))));
    const block = el("div", "runner-registration", el("h3", null, `Row ${row}: a self-hosted runner`),
      el("p", null, "The runner must carry the label ", el("span", "runner-label", label), ". ", link("runner-page", "Open the server's runner page", runnersPage)), waiting, explain("schedule-self-hosted-runner"));
    block.setAttribute("data-row", row);
    return block;
  });
}

function secretsBlock(names, secretsPage) {
  return el("section", "panel secrets", el("h3", null, "Secrets needed"),
    el("ul", null, ...names.map(({ name, for: service }) => el("li", null, `${name} (for ${service})`))),
    el("p", null, link("secrets-page", "Open the server's secrets page", secretsPage), " Agent M never asks for a secret's value."), explain("schedule-secrets"));
}

// ---------------------------------------------------------------- the configuration against the schedule (UC-027 1a, 1b)

function driftBlock(files, schedule, target, resources, participants) {
  const block = el("section", "panel drift", el("h3", null, "The configuration against the schedule"));
  let found;
  try {
    found = configurationDrift(files, schedule, target, resources, participants);
  } catch (error) {
    block.append(el("p", "drift-unknown", `The configuration cannot be compared with the schedule: ${said(error)}`));
    return block;
  }
  if (found.length === 0) {
    block.append(el("p", "drift-none", "The committed configuration agrees with the schedule."));
    return block;
  }
  block.append(el("ul", null, ...found.map(({ path, difference }) => {
    const item = el("li", null, el("code", null, path), ` — ${difference}`);
    item.setAttribute("data-path", path);
    return item;
  })), el("p", null, "Save generates Agent M's file from the schedule again. A configuration Agent M did not generate stays beside it; removing it is your decision in that pull request."));
  return block;
}

// ---------------------------------------------------------------- the last runs (UC-027 step 7, 7a)

// The run started last, or null.
const newestOf = (runs) => runs.reduce((last, run) => (last === null || (run.started ?? "") > (last.started ?? "") ? run : last), null);

// The run of an occasion started last, or null.
const lastRun = (runs, occasion) => newestOf(runs.filter((run) => OCCASION_OF_EVENT[run.event] === occasion));

// The release candidate's last run: the newest push run of the generated workflow on a commit a candidate's tag names, one request for the tags and then one
// for each commit they name, at once. -> { run } (null where none has run), or { unread } naming what cannot be read.
async function candidateRun(host) {
  let tags;
  try { tags = await host.listTags(CANDIDATE_TAGS); } catch { return { unread: "the release tags cannot be read" }; }
  const commits = [...new Set(tags.map((tag) => tag.commit))];
  try {
    return { run: newestOf((await Promise.all(commits.map((commit) => host.listCiRuns({ workflow: GENERATED_WORKFLOW, commit, event: "push", newest: 1 })))).flat()) };
  } catch {
    return { unread: "the runs of the release tags cannot be read" };
  }
}

const dateOf = (iso) => (iso ?? "").slice(0, 10);

// The date of the last nightly time, `HH:MM` in UTC, that has passed by `now`.
function expectedNightly(time, now) {
  const [hours, minutes] = String(time ?? "").split(":").map(Number);
  const today = new Date(now);
  const at = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), hours || 0, minutes || 0);
  return new Date(at <= now ? at : at - DAY).toISOString().slice(0, 10);
}

function lastRunsBlock(runs, candidate, schedule, server, links) {
  const block = el("section", "panel last-runs-block", el("h3", null, "The last run per occasion"));
  if (runs === null) {
    block.append(el("p", "runs-unreadable", "The runs of this repository cannot be read, so the last runs are not shown."));
    return block;
  }
  block.append(el("table", "list last-runs", el("tbody", null, ...COLUMNS.map((occasion) => {
    const { run, unread } = occasion === "release candidate" ? candidate : { run: lastRun(runs, occasion) };
    const tr = el("tr", null, labelled(el("th", null, occasion), "Occasion"),
      labelled(el("td", null, run ? link(null, `${run.state}, ${dateOf(run.started) || "not started"}`, run.url) : unread ?? "no run yet"), "Last run"));
    tr.setAttribute("data-occasion", occasion);
    return tr;
  }))));
  const nightly = ROWS.some((row) => occasionsOf(row, schedule).includes("nightly"));
  if (nightly) {
    const expected = expectedNightly(schedule.fields?.nightly, Date.now());
    const last = lastRun(runs, "nightly");
    if (!last || dateOf(last.started) < expected) {
      const missed = el("p", "nightly-missed", "The nightly run has not run: ",
        last ? `its last run was on ${dateOf(last.started) || "a date the server does not name"}` : "there has been no nightly run", `, expected on ${expected}. `);
      if (server === "github") missed.append("On GitHub, the scheduled workflows of a public repository are disabled after a period without activity; the workflow's page shows whether it is, and enables it again. ");
      missed.append(link("workflow-page", "Open the workflow's page", links.actions));
      block.append(missed);
    }
  }
  return block;
}

// ---------------------------------------------------------------- the pull request, its CI and its merge (UC-027 steps 5, 6, 3a, 6a)

// green, red, running or none, from the runs of the pull request's head.
function verdict(runs) {
  if (runs.length === 0) return "none";
  if (runs.some((run) => run.state === "failure" || run.state === "cancelled")) return "red";
  if (runs.every((run) => run.state === "success" || run.state === "skipped") && runs.some((run) => run.state === "success")) return "green";
  return "running";
}
const VERDICT_TEXT = { green: "The CI is green.", red: "The CI is red.", running: "The CI is running.", none: "No CI run has started for the pull request yet." };

async function drawProposal(place, host, pullRequest, schedule) {
  const box = el("div", "schedule-proposal", el("h3", null, "The schedule's pull request"),
    el("p", null, link("pull-request", `Pull request #${pullRequest.number}: ${pullRequest.title}`, pullRequest.url)));
  let runs = null;
  try {
    runs = await host.listCiRuns({ commit: pullRequest.head });
  } catch (error) {
    box.append(el("p", "ci-state", `The CI of the pull request cannot be read: ${said(error)}`));
  }
  if (runs !== null) {
    const state = verdict(runs);
    box.append(el("p", "ci-state", VERDICT_TEXT[state]),
      el("ul", "ci-runs", ...runs.map((run) => el("li", null, link(null, `${run.workflow}: ${run.state}`, run.url)))));
    if (state === "red") {
      box.append(el("p", "ci-red", "The pull request is not merged while its CI is red. Fix the tests or the schedule first; ",
        link("failing-runs", "the runs of the pull request", host.webLinks().commitRuns(pullRequest.head)), "."));
    }
    if (state === "green") {
      // Merge answers a person's click only (THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK).
      const merge = button("btn primary merge", "Merge", () => mergeAndSchedule(box, merge, host, pullRequest, schedule));
      box.append(merge);
    }
  }
  const again = el("button", "btn refresh", "Check CI again");
  again.setAttribute("type", "button");
  again.addEventListener("click", () => drawProposal(place, host, pullRequest, schedule));
  box.append(again);
  place.replaceChildren(box);
}

// The person's Merge: the pull request merged at the head shown, then, on a GitLab server, the nightly pipeline schedule set and linked.
async function mergeAndSchedule(box, button, host, pullRequest, schedule) {
  button.disabled = true;
  let commit;
  try {
    ({ commit } = await host.mergePullRequest(pullRequest.number, pullRequest.head));
  } catch (error) {
    const text = error?.name === "Moved" ? "The pull request moved since its CI was shown; check its CI again." : `The pull request was not merged: ${said(error)}`;
    box.append(el("p", "merge-failed", text));
    button.disabled = false;
    return;
  }
  const merged = el("p", "merged", `Merged as ${commit.slice(0, 7)}.`);
  box.append(merged);
  try {
    const pipeline = await applyPipelineSchedule(host, schedule);
    if (pipeline) merged.append(" The nightly run is set as the project's pipeline schedule: ", link("pipeline-schedules", "the project's pipeline schedules", pipeline.url), ".");
  } catch (error) {
    merged.append(` The nightly pipeline schedule could not be set: ${said(error)}`);
  }
}

// ---------------------------------------------------------------- the route

async function render(target, context) {
  if (!context.product) {
    target.replaceChildren(testsHead(context, { title: TITLE, shown: "Schedule" }), el("p", null, "Choose a product to see its test schedule."));
    return;
  }
  const { host, kind: server } = context.product;
  const instanceHost = context.instance.host;
  const [snapshot, instance] = await Promise.all([host.readSnapshot((await host.repositoryInfo()).defaultBranch),
    instanceHost.readSnapshot((await instanceHost.repositoryInfo()).defaultBranch)]);
  const [saved, resourcesText, participantsText, { counts, asOf }] = await Promise.all([snapshot.read(SCHEDULE_PATH), snapshot.read(RESOURCES_PATH),
    instance.read(PARTICIPANTS_PATH), testCounts(snapshot)]);
  const schedule = saved === null || saved === undefined ? defaultSchedule() : readDocument(scheduleSchema, SCHEDULE_PATH, saved);
  const participants = readDocument(participantSchema(), PARTICIPANTS_PATH, participantsText);
  const resources = readDocument(resourceSchema(), RESOURCES_PATH, resourcesText ?? "");
  // The target of the generated configuration: the product's server, the instance as its snapshot names it — its path on GitHub, its address on GitLab,
  // where the pipeline clones it — and the commit of the instance's default branch.
  const targetOf = () => ({ server, instance: server === "github" ? instance.repository.path : instance.repository.web, instanceCommit: instance.commit });
  const offered = eligible(participantsOf(participants), { capabilities: ["run code and tests"] }).eligible.map(({ name }) => name);
  const findings = el("ul", "schedule-findings");
  const proposal = el("div", "proposal-place");
  const state = { choices: new Map(), ticks: new Map(), changed: null };
  const table = levelsTable(schedule, counts, offered, { ...state, changed: () => state.changed?.() });
  const { form, check } = scheduleForm(schedule, table, state, {
    participants, findings,
    onSave: async (chosen) => {
      try {
        const { pullRequest } = await proposeSchedule(host, chosen, { ...targetOf(), resources, participants, head: snapshot.commit, trailers: [] });
        await drawProposal(proposal, host, pullRequest, chosen);
      } catch (error) {
        proposal.replaceChildren(el("p", "save-failed", `Nothing was saved: ${said(error)}`));
      }
    },
  });
  check();
  const secrets = resourcesText ? secretsNeeded(schedule, resources) : [];
  const selfHosted = selfHostedRows(schedule, participants);
  const links = host.webLinks();
  const runners = selfHosted.length ? runnerBlocks(selfHosted, links.runners, await queuedRuns(host)) : [];
  const configuration = snapshot.paths.filter((path) => CONFIGURATION.test(path));
  const configured = [];
  if (configuration.length) {
    const files = Object.fromEntries(await Promise.all(configuration.map(async (path) => [path, (await snapshot.read(path)) ?? ""])));
    configured.push(driftBlock(files, schedule, targetOf(), resources, participants));
  }
  if (snapshot.paths.includes(GENERATED[server])) {
    let runs = null;
    const candidate = candidateRun(host);
    // The newest run of each event that stands for an occasion, one request each, at once: no page of older runs is read.
    try { runs = (await Promise.all(EVENTS_OF[server].map((event) => host.listCiRuns({ workflow: GENERATED_WORKFLOW, event, newest: 1 })))).flat(); } catch { runs = null; }
    configured.push(lastRunsBlock(runs, await candidate, schedule, server, links));
  }
  const { defaultBranch } = await host.repositoryInfo();
  target.replaceChildren(
    testsHead(context, { title: TITLE, shown: "Schedule", reads: readsAt(context.product.address, defaultBranch,
      "read now from the repository; nothing is written before Save, which opens a pull request.") }),
    el("section", "panel levels-step", el("h3", null, "The levels, what each checks, and when each runs"),
      ...(schedule.default ? [el("p", "default-schedule", "This is the book's default schedule, not yet saved for this product.")] : []),
      ...(asOf ? [el("p", "as-of", `As of ${asOf.slice(0, 7)}: the view of the newest commit is being stored.`)] : []),
      form, proposal, ...runners),
    secretsBlock(secrets, links.secrets), ...configured);
}

export const route = { ...heads.schedule, render };
