// The audit page of the trace Route (UC-030 steps 1 to 4, alternative flows 1a and 2a to 2d): for a release tag the product at the tag's commit, its gate records
// under the process model its docs/process.md declared at the tag, and the instance's SPEC are handed to MOD-release-evidence's auditRows; the page draws what
// that gives. At the top stand the limitations, each that names a test of a row a link that opens the rows holding it, then the summary, each number that the
// rows alone can tell opening the rows it counts; under it the filters (normative sources, one source, one level, only gaps) and one row per requirement valid
// at the tag, with its sources, its tests with outcome, level and counter-proof, its gates and the acceptance of the report, and a detail that links the run on
// the server and the approval commit and names the blob of the accepted text. Where the server keeps the log of none of the runs the row's records cite, the
// run link is marked unavailable (ciRunLog, each run asked once, all at once, when the page is read). Where the report is not
// accepted every row says so and the page links to MOD-test-pages' route `release`, where Accept stands. Export saves the audit document in the browser and, for a person with write access, Commit export commits it to docs/audits/<tag>.md, on the
// person's click (export.mjs). It writes nothing else.
//
// Module: MOD-trace-pages

import { readDocument } from "../documents/index.mjs";
import { auditRows } from "../release-evidence/index.mjs";
import { declarationSchema, gateSchema, gateStates, productWorkflow } from "../product-process/index.mjs";
import { sourceSchemas } from "../source-register/index.mjs";
import { resultSchema, resultsAt } from "../result-records/index.mjs";
import { exportControls } from "./export.mjs";
import { instanceSnapshot } from "./subject.mjs";
import { runIdOf } from "./test-detail.mjs";

const RESULTS_BRANCH = "test-results";
const ON_ENTRY = /^(.+)@([0-9a-f]+)$/;
const KINDS = [["passing", "Passing evidence"], ["noTest", "No test"], ["notPassed", "A test did not pass"], ["flaky", "A flaky test"],
  ["worse", "Rate worse than the last release"], ["byImplementer", "Release tests written by the implementer"]];

function el(name, className, ...children) {
  const node = document.createElement(name);
  if (className) node.className = className;
  node.append(...children);
  return node;
}

// What the rows alone tell of the counts: a row with a test and only tests that passed (`passed`, which auditRows gives each test) is passing; one with no
// test is no test; one with a failed or not run outcome, or a model-dependent test — its outcome a rate — that did not pass at a rate no worse than the
// last release's, is not passed; one with a flaky outcome is flaky; worse and byImplementer are the flags their provider gives. A row that is not passing
// is a gap.
const RATE = /^\d+ of \d+$/;
const outcomes = (row) => row.tests.map((test) => test.outcome);
const COUNTED = {
  passing: (row) => row.tests.length > 0 && row.tests.every((test) => test.passed),
  noTest: (row) => row.tests.length === 0,
  notPassed: (row) => row.tests.some((test) => test.outcome === "failed" || test.outcome === "not run" || (RATE.test(test.outcome) && !test.passed && !test.worse)),
  flaky: (row) => outcomes(row).some((outcome) => outcome === "flaky"),
  worse: (row) => row.tests.some((test) => test.worse),
  byImplementer: (row) => row.tests.some((test) => test.byImplementer),
};

// The requirement-added gates of the workflow the product declared at the tag, with the records of docs/gates/ there: `gates`, those a record holds, as
// { requirement, gate, record, artifacts }, `artifacts` the ones that gate asks for (UC-002 7); and `unrecorded`, those no record holds, as { requirement, gate },
// which auditRows takes as its added input so that their requirement keeps its row. None where the product declared no process or the instance cannot be reached.
async function gatesOf(at, context, instanceSpec) {
  const none = { gates: [], unrecorded: [] };
  const text = await at.read("docs/process.md");
  if (text === null || !context.instance?.host) return none;
  const workflow = await productWorkflow(readDocument(declarationSchema, "docs/process.md", text),
    (commit) => context.instance.host.readSnapshot(commit), instanceSpec);
  if (!workflow) return none;
  const paths = at.paths.filter((path) => /^docs\/gates\/[^/]+\.md$/.test(path));
  const records = await Promise.all(paths.map(async (path) => readDocument(gateSchema, path, (await at.read(path)) ?? "")));
  const texts = {};
  for (const record of records) {
    for (const written of Array.isArray(record.fields.on) ? record.fields.on : []) {
      const named = ON_ENTRY.exec(String(written));
      if (named) texts[named[1]] = at.blob(named[1]);
    }
  }
  const added = gateStates(workflow, records, texts)
    .map((state) => ({ state, requirement: workflow.gates.find((each) => each.name === state.gate)?.addedBy?.requirement }))
    .filter(({ requirement }) => requirement);
  return {
    gates: added.filter(({ state }) => state.record).map(({ state, requirement }) => ({ requirement, gate: state.gate, record: state.record,
      artifacts: workflow.gates.find((each) => each.name === state.gate)?.artifacts ?? "" })),
    unrecorded: added.filter(({ state }) => !state.record).map(({ state, requirement }) => ({ requirement, gate: state.gate })),
  };
}

// The register of the instance at its default branch, as documents, and the instance's SPEC.
async function instanceOf(context) {
  if (!context.instance?.host) return { instanceSpec: "", register: [] };
  const instance = await instanceSnapshot(context);
  const entries = instance.paths.filter((path) => /^docs\/sources\/[^/]+\.md$/.test(path));
  await instance.readMany?.(entries);
  return { instanceSpec: (await instance.read("SPEC.md")) ?? "",
    register: await Promise.all(entries.map(async (path) => readDocument(sourceSchemas().entry, path, (await instance.read(path)) ?? ""))) };
}

// Who accepted the report and when: the author and date of the commit that added the approval record, which is the oldest commit that changed it. None where the
// default branch holds no report or the record has no history.
async function acceptanceOf(host, head, tag) {
  const blob = head.blob(`docs/tests/releases/${tag}.md`);
  if (!blob) return null;
  const record = `docs/approvals/release-${tag}-${blob.slice(0, 12)}.md`;
  const added = (await host.readHistory(record, { changes: false })).at(-1);
  return added ? { record, commit: added.commit, accepted: { person: added.author.account ?? added.author.name, date: added.date } } : null;
}

// The rows whose run link leads to no log any more (UC-030 2d): the runs that the records of the release commit holding a row's tests cite — their `run` address, read
// as the tests view reads it (runIdOf) — are asked of ciRunLog, each once and all at once; a row all of whose cited runs give null is in the set. Nothing is asked where
// the server offers no run page or the host no ciRunLog; a run whose asking fails counts as kept, a row whose records cite no run keeps its link, and so does every
// row where the records cannot be read (load).
async function logsGone(host, results, release, audit, links) {
  const tests = [...new Map(audit.rows.flatMap((row) => row.tests.map(({ id, level }) => [id, { id, level }]))).values()];
  if (!links?.commitRuns || typeof host.ciRunLog !== "function" || !tests.length) return new Set();
  const levels = await resultsAt(results, release.commit, tests);
  const recordsOf = new Map(levels.flatMap((level) => level.tests.map((test) => [test.id, test.records ?? []])));
  const paths = [...new Set([...recordsOf.values()].flat())];
  const runOf = new Map(await Promise.all(paths.map(async (path) => {
    const text = await results.read(path);
    const address = text == null ? null : readDocument(resultSchema.run, path, text).fields.run;
    return [path, address ? runIdOf(host, String(address)) : null];
  })));
  const ids = [...new Set([...runOf.values()].filter(Boolean))];
  const kept = new Map(await Promise.all(ids.map((id) => host.ciRunLog(id).then((log) => [id, log != null], () => [id, true]))));
  const gone = new Set();
  for (const row of audit.rows) {
    const cited = new Set(row.tests.flatMap((test) => (recordsOf.get(test.id) ?? []).map((path) => runOf.get(path)).filter(Boolean)));
    if (cited.size && [...cited].every((id) => kept.get(id) === false)) gone.add(row.requirement);
  }
  return gone;
}

async function load(host, context, tag, links) {
  const release = { tag, commit: (await host.listTags()).find((each) => each.name === tag)?.commit ?? tag };
  const at = await host.readSnapshot(tag);
  const results = await host.readSnapshot(RESULTS_BRANCH);
  const info = await host.repositoryInfo();
  const head = await host.readSnapshot(info.defaultBranch);
  const { instanceSpec, register } = await instanceOf(context);
  const acceptance = await acceptanceOf(host, head, tag);
  const { gates, unrecorded } = await gatesOf(at, context, instanceSpec);
  const audit = await auditRows(at, results, head, release, gates, instanceSpec, register, acceptance?.accepted ?? null, unrecorded);
  // A read of the records that fails leaves every link as it is: the audit is drawn whether or not the logs can be asked.
  const gone = await logsGone(host, results, release, audit, links).catch(() => new Set());
  return { release, audit, acceptance, head, canWrite: info.canWrite === true, gone };
}

function select(className, label, values, change) {
  const node = el("select", className);
  node.setAttribute("aria-label", label);
  for (const value of values) {
    const option = el("option", null, value);
    option.value = value;
    node.append(option);
  }
  node.value = values[0];
  node.addEventListener("change", change);
  return node;
}

// A cell of the table that names its column in `data-label`, which a phone shows above the cell's text when the table's rows stand as blocks (table.list).
function cell(label, className, ...children) {
  const td = el("td", className, ...children);
  td.setAttribute("data-label", label);
  return td;
}

// The id of the row at `index` among the audit's rows, which a limitation's link names.
const rowId = (index) => `audit-row-${index}`;

// The rows a limitation concerns: those holding the test its line names before " — " (MOD-approvals' `limitation`: `<TST-<nnn> or rate> — <reason>`).
const concerned = (rows, line) => {
  const named = String(line).split(" — ")[0].trim();
  return rows.filter((row) => row.tests.some((test) => test.id === named)).map((row) => row.requirement);
};

// One row: the requirement and what it constrains, its sources, its tests, its gates — each record in `audit-gate`, and the artifacts that gate asked for
// in an element of their own, `audit-gate-artifacts`, and each gate no record holds in `audit-gate-unrecorded`, never in `audit-gate` —, the acceptance of the report, and the detail with the links and the blob of the accepted text.
function rowOf(row, { release, audit, acceptance, gone }, links) {
  const accepted = audit.summary.accepted;
  const evidence = accepted
    ? `accepted${audit.evidence.acceptance ? ` by ${audit.evidence.acceptance.person} on ${audit.evidence.acceptance.date}` : ""}`
    : "evidence not accepted";
  const tests = row.tests.length
    ? row.tests.map((test) => {
      const link = el("a", "audit-test", test.id);
      link.setAttribute("href", `#trace/key=tests/row=${encodeURIComponent(test.id)}`);
      return el("div", "audit-test-line", link, " ", el("span", "audit-level", test.level), " ", el("span", "audit-outcome", test.outcome),
        ...(test.lastRate ? [" ", el("span", "audit-last-rate", `against ${test.lastRate} at the last release`)] : []),
        ...(RATE.test(test.outcome) ? [" ", el("span", "audit-passed", test.passed ? "passed" : "not passed")] : []),
        ...(test.counterProof ? [" ", el("span", "audit-counter-proof", test.counterProof)] : []));
    })
    : [el("span", "audit-no-test", "no test")];
  const runPage = gone?.has(row.requirement) ? null : links?.commitRuns?.(release.commit);
  const run = runPage ? el("a", "audit-run", "Run on the server") : el("span", "audit-run-unavailable", "unavailable");
  if (runPage) run.setAttribute("href", runPage);
  const detail = el("details", "audit-detail", el("summary", null, "Detail"));
  if (row.tests.length) detail.append(run, " ");
  if (acceptance && accepted && links?.file) {
    const approval = el("a", "audit-approval", "Approval commit");
    approval.setAttribute("href", links.file(acceptance.record, acceptance.commit));
    detail.append(approval);
  }
  if (accepted && audit.evidence.acceptance?.blob) detail.append(" Accepted text: blob ", el("code", "audit-accepted-blob", audit.evidence.acceptance.blob));
  const tr = el("tr", "audit-row",
    cell("Requirement", null, el("span", "audit-requirement", row.requirement), " ", el("span", "audit-constrains", row.constrains)),
    cell("Sources", null, ...row.sources.flatMap((source) => [el("span", "audit-source", source.id), ` (${source.authority}, ${source.version}) `])),
    cell("Tests", null, ...tests),
    cell("Gates", null, ...row.gates.flatMap((gate, index) => [el("span", "audit-gate", gate),
      ...(row.artifacts?.[index] ? [" artifacts: ", el("span", "audit-gate-artifacts", row.artifacts[index])] : [])]),
      ...(row.unrecorded ?? []).map((gate) => el("span", "audit-gate-unrecorded", `${gate}: no record holds it`))),
    cell("Acceptance", "audit-evidence", evidence),
    cell("Detail", null, detail));
  tr.setAttribute("data-requirement", row.requirement);
  tr.setAttribute("id", rowId(audit.rows.indexOf(row)));
  return tr;
}

function page(loaded, links, host) {
  const { audit, release, head: defaultBranch, canWrite } = loaded;
  const state = { count: null, limitation: null, normative: "all", source: "all", level: "all", gaps: false };
  const tbody = el("tbody");
  const keep = (row) => (state.count === null || COUNTED[state.count](row))
    && (state.limitation === null || concerned(audit.rows, state.limitation).includes(row.requirement))
    && (state.normative === "all" || row.sources.some((source) => source.authority === "normative"))
    && (state.source === "all" || row.sources.some((source) => source.id === state.source))
    && (state.level === "all" || row.tests.some((test) => test.level === state.level))
    && (!state.gaps || !COUNTED.passing(row));
  const draw = () => tbody.replaceChildren(...audit.rows.filter(keep).map((row) => rowOf(row, loaded, links)));

  const summary = el("div", "audit-summary panel");
  for (const [kind, label] of KINDS) {
    const number = String(audit.summary[kind]);
    if (COUNTED[kind]) {
      const button = el("button", "audit-count btn small", number);
      button.setAttribute("type", "button");
      button.setAttribute("data-kind", kind);
      button.addEventListener("click", () => { state.count = state.count === kind ? null : kind; draw(); });
      summary.append(el("p", "audit-summary-item", el("span", "audit-label", `${label}: `), button));
    } else {
      const plain = el("span", "audit-count", number);
      plain.setAttribute("data-kind", kind);
      summary.append(el("p", "audit-summary-item", el("span", "audit-label", `${label}: `), plain));
    }
  }

  const sources = [...new Set(audit.rows.flatMap((row) => row.sources.map((source) => source.id)))].sort();
  const levels = [...new Set(audit.rows.flatMap((row) => row.tests.map((test) => test.level)))];
  const gaps = el("input", "audit-filter-gaps");
  gaps.setAttribute("type", "checkbox");
  gaps.checked = false;
  gaps.addEventListener("change", () => { state.gaps = gaps.checked; draw(); });
  const filters = el("div", "audit-filters panel",
    select("audit-filter-normative", "Sources", ["all", "normative"], (event) => { state.normative = event.target.value; draw(); }),
    select("audit-filter-source", "Source", ["all", ...sources], (event) => { state.source = event.target.value; draw(); }),
    select("audit-filter-level", "Level", ["all", ...levels], (event) => { state.level = event.target.value; draw(); }),
    el("label", null, gaps, " only gaps"));

  // A limitation that names a test of a row is a link to the first row holding it; pressed, it opens the rows it concerns, and pressed again every row, as a number does.
  const limitationOf = (text) => {
    const names = concerned(audit.rows, text);
    if (!names.length) return text;
    const link = el("a", "audit-limitation", text);
    link.setAttribute("href", `#${rowId(audit.rows.findIndex((row) => row.requirement === names[0]))}`);
    link.addEventListener("click", (event) => {
      event?.preventDefault?.();
      state.limitation = state.limitation === text ? null : text;
      draw();
    });
    return link;
  };
  const accept = el("a", "audit-accept", "Accept the report");
  accept.setAttribute("href", "#release");
  const head = el("tr", null, ...["Requirement", "Sources", "Tests", "Gates", "Acceptance", "Detail"].map((text) => el("th", null, text)));
  draw();
  return [
    ...(audit.summary.accepted ? [] : [el("p", "audit-not-accepted", "The release test report has not been accepted: evidence not accepted. ", accept)]),
    ...(audit.summary.limitations.length ? [el("ul", "audit-limitations", ...audit.summary.limitations.map((text) => el("li", null, limitationOf(text))))] : []),
    exportControls(el, { audit, release, host, head: defaultBranch, canWrite }),
    summary, filters, el("table", "audit-table list", el("thead", null, head), tbody)];
}

/**
 * drawAudit(target, context, host, ref, descriptor, tags, tagsProblem, underHeading) — draws the audit of the release tag `ref` (the newest of `tags`, the release tags newest first, where
 * `ref` is none of them) into `target`; the choice offers `tags` and nothing else, and choosing one draws the page again at it. Where a read fails the page names it;
 * `tagsProblem`, when the tags could not be read, is the element that says so, and stands in place of the audit. `underHeading`, the elements flow.mjs hands — the
 * Tests entry's views for the audit of a release tag, none for a candidate's —, stand under the heading, whatever the page shows below it.
 */
export async function drawAudit(target, context, host, ref, descriptor, tags, tagsProblem = null, underHeading = []) {
  const place = el("div", "audit-body");
  const section = el("section", "audit head", el("h2", null, descriptor.title), ...underHeading, place);
  if (tagsProblem) {
    target.replaceChildren(section);
    place.append(tagsProblem);
    return;
  }
  if (!tags.length) {
    target.replaceChildren(section);
    place.append(el("p", "version-none", "No release is tagged yet (UC-013); there is nothing to audit."));
    return;
  }
  const choice = select("version-choice", "Version", tags, () => show(choice.value));
  choice.value = tags.includes(ref) ? ref : tags[0];
  target.replaceChildren(el("div", "version-bar", el("label", null, "Release ", choice)), section);
  let latest = 0;
  async function show(tag) {
    const mine = ++latest;
    place.replaceChildren(el("p", "traces-reading", "Reading the audit…"));
    let nodes;
    try {
      const links = host.webLinks?.() ?? null;
      nodes = page(await load(host, context, tag, links), links, host);
    } catch (failure) {
      nodes = [el("p", "traces-problem", `The audit of ${tag} could not be read: ${failure?.message ?? failure}`)];
    }
    if (mine === latest) place.replaceChildren(...nodes);
  }
  await show(choice.value);
}
