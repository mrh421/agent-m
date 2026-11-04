// The tests page of the trace Route (UC-029 steps 1 to 3, 1a, 2a): the tests of the version drawn as a tree by level, test file and test case, or grouped by
// requirement, by use case or by module; each test with its identifier, its title and its outcome on the commit of that version, read from the branch
// `test-results`; the filters; the Incomplete group; a guarded name that matches nothing, shown as a broken link with its test kept; and, at a release,
// the comparison with another release (step 6): the tests added, removed, changed in what they guard or expect, and changed in outcome. It reads the
// version's test files through the snapshot and writes nothing. A private repository no token reaches never gets here: the first read of the version fails
// in the route, which leaves it to the frame to say.
//
// Module: MOD-trace-pages

import { isTestFile, testDeclarations, unidentifiedDeclarations } from "../test-document/index.mjs";
import { resultsAt } from "../result-records/index.mjs";
import { showTestDetail } from "./test-detail.mjs";

const LEVELS = ["unit", "component", "system", "release", "user"];
const GROUPINGS = ["level", "requirement", "use case", "module"];
const FILTERS = ["all", "failed", "flaky", "not run", "model-dependent", "calls a paid service", "without counter-proof", "guards nothing"];
const RESULTS_BRANCH = "test-results";
const COUNTER_PROOFS = "docs/tests/counter-proofs/";

function el(name, className, ...children) {
  const node = document.createElement(name);
  if (className) node.className = className;
  node.append(...children);
  return node;
}

const guardsOf = (declaration) => [...new Set((declaration.guards ?? []).map((name) => String(name).trim()).filter(Boolean))];

// What a declaration lacks of the identifier, the level and the guards.
function missingOf(declaration) {
  return [...(declaration.id === null ? ["identifier"] : []), ...(LEVELS.includes(declaration.level) ? [] : ["level"]), ...(guardsOf(declaration).length ? [] : ["guards"])];
}

// Every test declaration of the version, in the order of the paths of the test files and then of the lines; with `read` unidentifiedDeclarations, every block written as one that names no identifier.
async function declarationsOf(snapshot, read = testDeclarations) {
  const paths = snapshot.paths.filter((path) => !path.startsWith(COUNTER_PROOFS) && isTestFile(path)).sort();
  if (paths.length) await snapshot.readMany?.(paths);
  const found = [];
  for (const path of paths) found.push(...read(path, (await snapshot.read(path)) ?? ""));
  return found;
}

// The outcome of each test on the commit of the version: resultsAt's, from the records of that commit on the branch test-results, read through a snapshot narrowed to their folder; none where the branch cannot be read.
async function outcomesOf(host, snapshot, declarations) {
  const outcomes = new Map();
  let problem = null;
  try {
    const results = await host.readSnapshot(RESULTS_BRANCH, { folders: [`runs/${snapshot.commit}`] });
    const asked = declarations.map((declaration) => ({ id: declaration.id, level: declaration.level ?? "none" }));
    for (const level of await resultsAt(results, snapshot.commit, asked)) for (const test of level.tests) outcomes.set(test.id, test);
  } catch (failure) {
    problem = failure;
  }
  return { outcomes, problem };
}

const outcomeText = (test) => `${test.outcome}${test.runs ? ` (${test.runs})` : ""}`;

const KEEP = {
  all: () => true,
  failed: (test) => test.outcome === "failed",
  flaky: (test) => test.outcome === "flaky",
  "not run": (test) => test.outcome === "not run",
  "model-dependent": (test) => test.declaration.runs != null,
  "calls a paid service": (test) => test.declaration.paid != null,
  "without counter-proof": (test) => !test.counterProof,
  "guards nothing": (test) => guardsOf(test.declaration).length === 0,
};

// The identifier of a test, as the link that opens it: `trace/tests/<TST>` at the version shown.
function idLink(id, ref) {
  const link = el("a", "tests-id", id);
  link.setAttribute("href", `#trace/key=tests/ref=${encodeURIComponent(ref)}/row=${encodeURIComponent(id)}`);
  return link;
}

function caseLine(test, withMissing, ref) {
  const line = el("div", "tests-case", idLink(test.declaration.id, ref), " ", el("span", "tests-title", test.declaration.title ?? ""), " ",
    el("span", "tests-outcome", outcomeText(test)));
  if (withMissing) line.append(" ", el("span", "tests-missing", test.missing.join(", ")));
  return line;
}

// A test whose declaration names no identifier: no link opens it and no record names it, so it is shown by its title and its place, `<path>:<line>`.
function unidentifiedLine(test) {
  const { title, path, line } = test.declaration;
  return el("div", "tests-unidentified", el("span", "tests-title", title ?? ""), " ", el("span", "tests-place", `${path}:${line}`), " ",
    el("span", "tests-missing", test.missing.join(", ")));
}

// The groups of a grouping, each { name, broken, tests }: the names the version holds in their order, then the names only a test guards, marked broken.
function groupsOf(grouping, tests, names) {
  const groups = new Map(names.known.map((name) => [name, { name, broken: false, tests: [] }]));
  const place = (name, test) => {
    if (!groups.has(name)) groups.set(name, { name, broken: true, tests: [] });
    groups.get(name).tests.push(test);
  };
  for (const test of tests) {
    if (grouping === "module") {
      place(test.declaration.module ?? "no module", test);
      continue;
    }
    for (const name of guardsOf(test.declaration)) if (/^UC-/.test(name) === (grouping === "use case")) place(name, test);
  }
  return [...groups.values()];
}

function levelsLine(group) {
  return el("ul", "tests-levels", ...LEVELS.map((level) => {
    const count = group.tests.filter((test) => test.declaration.level === level).length;
    return el("li", "tests-level", `${level}: ${count || "empty"}`);
  }));
}

function groupBox(group, ref) {
  const name = el("span", group.broken ? "tests-group-name tests-broken" : "tests-group-name", group.name);
  const head = el("h3", null, name);
  if (group.broken) head.append(" ", el("span", "tests-broken-note", "broken link: nothing of the version has this name"));
  return el("section", "tests-group", head, levelsLine(group), ...group.tests.map((test) => caseLine(test, false, ref)));
}

function treeBoxes(tests, ref) {
  const boxes = [];
  for (const level of LEVELS) {
    const inLevel = tests.filter((test) => test.declaration.level === level);
    if (!inLevel.length) continue;
    const files = [...new Set(inLevel.map((test) => test.declaration.path))];
    boxes.push(el("section", "tests-group", el("h3", null, el("span", "tests-group-name", level)),
      ...files.map((path) => el("section", "tests-file", el("h4", null, el("span", "tests-file-name", path)),
        ...inLevel.filter((test) => test.declaration.path === path).map((test) => caseLine(test, false, ref))))));
  }
  return boxes;
}

// ---------------------------------------------------------------- comparing two releases (UC-029 step 6)

// The tests of a version by identifier, each with its declaration and the outcome as the page shows it.
async function testsOf(host, snapshot) {
  const declarations = await declarationsOf(snapshot);
  const found = await outcomesOf(host, snapshot, declarations);
  return { tests: new Map(declarations.map((declaration) => [declaration.id, { declaration, outcome: outcomeText(found.outcomes.get(declaration.id) ?? { outcome: "not run", runs: null }) }])),
    problem: found.problem };
}

const expectOf = (declaration) => String(declaration.expect ?? "").trim();
const sameSet = (a, b) => a.length === b.length && a.every((name) => b.includes(name));

// What differs between the older and the newer version of the tests: { added, removed, changed, outcome }, each a list of { declaration, changes } in the order of the identifiers. A test is
// changed in what it guards when its set of guarded names differs, in what it expects when its expected result does; in both ways it is in `changed` once, and in `outcome` as well when its outcome differs.
function comparison(older, newer) {
  const byId = (a, b) => (a.declaration.id < b.declaration.id ? -1 : 1);
  const found = { added: [], removed: [], changed: [], outcome: [] };
  for (const [id, now] of newer) {
    const was = older.get(id);
    if (!was) { found.added.push({ declaration: now.declaration, changes: [] }); continue; }
    const changes = [];
    if (!sameSet(guardsOf(was.declaration), guardsOf(now.declaration))) changes.push(`guards: ${guardsOf(was.declaration).join("; ")} → ${guardsOf(now.declaration).join("; ")}`);
    if (expectOf(was.declaration) !== expectOf(now.declaration)) changes.push(`expect: ${expectOf(was.declaration)} → ${expectOf(now.declaration)}`);
    if (changes.length) found.changed.push({ declaration: now.declaration, changes });
    if (was.outcome !== now.outcome) found.outcome.push({ declaration: now.declaration, changes: [`${was.outcome} → ${now.outcome}`] });
  }
  for (const [id, was] of older) if (!newer.has(id)) found.removed.push({ declaration: was.declaration, changes: [] });
  for (const list of Object.values(found)) list.sort(byId);
  return found;
}

function comparedSection(className, heading, entries) {
  const items = entries.map(({ declaration, changes }) => el("li", "tests-compared", el("span", "tests-compared-id", declaration.id), " ", el("span", "tests-compared-title", declaration.title ?? ""),
    ...changes.flatMap((change) => [" ", el("span", "tests-compared-change", change)])));
  return el("section", className, el("h3", null, heading), items.length ? el("ul", "list", ...items) : el("p", "none", "none"));
}

// The comparison of the version shown with another release: both versions' declarations and the records of both commits. The older of the two is the one that comes later in `tags`, which are newest first.
async function compareReleases(host, shown, current, other) {
  const [older, newer] = shown.tags.indexOf(shown.ref) > shown.tags.indexOf(other) ? [current, await testsOf(host, await host.readSnapshot(other))] : [await testsOf(host, await host.readSnapshot(other)), current];
  const found = comparison(older.tests, newer.tests);
  const problem = older.problem ?? newer.problem;
  return el("section", "tests-compare", el("h2", null, `Compared with ${other}`),
    ...(problem ? [el("p", "traces-problem", `The results could not be read: ${problem?.message ?? problem}`)] : []),
    comparedSection("tests-compare-added", "Added", found.added), comparedSection("tests-compare-removed", "Removed", found.removed),
    comparedSection("tests-compare-changed", "Changed in what they guard or expect", found.changed), comparedSection("tests-compare-outcome", "Changed in outcome", found.outcome));
}

/**
 * Draws the tests page into `place`: reads the version's test files, their outcomes and what the grouping needs, then the page whose grouping and filter
 * the two selects change without reading again.
 */
export async function showTests(place, shown, params = {}) {
  const { snapshot, spec, context } = shown;
  let declarations, unidentified, found;
  try {
    declarations = await declarationsOf(snapshot);
    unidentified = await declarationsOf(snapshot, unidentifiedDeclarations);
    found = await outcomesOf(context.product.host, snapshot, declarations);
  } catch (failure) {
    place.replaceChildren(el("p", "traces-problem", `The tests could not be read: ${failure?.message ?? failure}`));
    return;
  }
  const tests = declarations.map((declaration) => ({
    declaration, missing: missingOf(declaration), counterProof: snapshot.paths.includes(`${COUNTER_PROOFS}${declaration.id}.md`),
    ...(found.outcomes.get(declaration.id) ?? { outcome: "not run", runs: null }),
  }));
  const complete = tests.filter((test) => !test.missing.length);
  const incomplete = tests.filter((test) => test.missing.length);
  const nameless = unidentified.map((declaration) => ({ declaration, missing: missingOf(declaration), counterProof: false, outcome: "not run", runs: null }));
  const idOf = (path) => /\/([^/]+)\.md$/.exec(path)?.[1];
  const names = {
    requirement: { known: [...spec.requirements.keys()] },
    "use case": { known: snapshot.paths.map((path) => /^docs\/use-cases\/(UC-\d+)/.exec(path)?.[1]).filter(Boolean).sort() },
    module: { known: [...snapshot.paths.filter((path) => /^docs\/architecture\/MOD-[^/]+\.md$/.test(path)).map(idOf).sort(), "system"] },
  };

  const state = { grouping: "level", filter: "all" };
  const body = el("div", "tests-body");
  const choice = (className, label, values, key) => {
    const select = el("select", className);
    select.setAttribute("aria-label", label);
    for (const value of values) {
      const option = el("option", null, value);
      option.value = value;
      select.append(option);
    }
    select.value = state[key];
    select.addEventListener("change", () => { state[key] = select.value; draw(); });
    return el("label", null, `${label} `, select);
  };
  function draw() {
    const keep = KEEP[state.filter] ?? KEEP.all;
    const boxes = state.grouping === "level" ? treeBoxes(complete.filter(keep), shown.ref) : groupsOf(state.grouping, complete.filter(keep), names[state.grouping]).map((group) => groupBox(group, shown.ref));
    const left = [...incomplete.filter(keep).map((test) => caseLine(test, true, shown.ref)), ...nameless.filter(keep).map(unidentifiedLine)];
    body.replaceChildren(...boxes, ...(left.length ? [el("section", "tests-incomplete", el("h3", null, "Incomplete"), ...left)] : []));
    if (!boxes.length && !left.length) body.append(el("p", "none", "No test matches."));
  }
  draw();
  const compared = el("div", "tests-compared-box");
  const bar = el("div", "tests-bar", choice("tests-grouping", "Group by", GROUPINGS, "grouping"), " ", choice("tests-filter", "Show", FILTERS, "filter"),
    ...(found.problem ? [el("p", "traces-problem", `The results could not be read: ${found.problem?.message ?? found.problem}`)] : []));
  const others = (shown.tags ?? []).filter((tag) => tag !== shown.ref);
  if ((shown.tags ?? []).includes(shown.ref) && others.length) {
    const select = el("select", "tests-compare-with");
    select.setAttribute("aria-label", "Compare with");
    for (const value of ["none", ...others]) {
      const option = el("option", null, value);
      option.value = value;
      select.append(option);
    }
    let latest = 0;
    const compare = async () => {
      const mine = ++latest;
      if (select.value === "none") { compared.replaceChildren(); return; }
      compared.replaceChildren(el("p", "traces-reading", "Comparing…"));
      let drawn;
      try {
        drawn = await compareReleases(context.product.host, shown, { tests: new Map(tests.map((test) => [test.declaration.id, { declaration: test.declaration, outcome: outcomeText(test) }])), problem: found.problem }, select.value);
      } catch (failure) {
        drawn = el("p", "traces-problem", `The comparison could not be read: ${failure?.message ?? failure}`);
      }
      if (mine === latest) compared.replaceChildren(drawn);
    };
    select.value = others.includes(params.compare) ? params.compare : "none";
    select.addEventListener("change", compare);
    bar.append(" ", el("label", null, "Compare with ", select));
    if (select.value !== "none") compare();
  }
  place.replaceChildren(bar, compared, body);
  // A test opened by the param `row` (`trace/tests/<TST>`) is shown above the tree.
  if (typeof params.row === "string" && params.row !== "") {
    const detail = el("div", "test-detail-box", el("p", "traces-reading", "Reading the test…"));
    place.insertBefore(detail, bar);
    detail.replaceChildren(await showTestDetail({ host: context.product.host, shown, id: params.row, declarations, declarationsOf }));
  }
}
