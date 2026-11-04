// The detail of an opened test of the tests view, `trace/tests/<TST>` (UC-029 steps 4, 5 and 5a): the test as it declares itself — level, guarded identifiers, precondition, input and expected result —, when the schedule runs it,
// its counter-proof record and the participant that wrote the test, a link to its code, and its history: one mark per commit of the default branch that ran it, one row per release tag, a flaky commit marked, a model-dependent test's rate
// per release as a line with its runs, and, for a test that was removed, the commit that removed it. Each part is read when the detail is drawn (a run's log only when the person opens its link), from the version shown and the branch `test-results`; a part that cannot
// be read is named in a line and leaves the others. It writes nothing.
//
// Module: MOD-trace-pages
// Private to the module: tests.mjs uses it.

import { renderArtifact } from "../markdown-render/index.mjs";
import { readDocument } from "../documents/index.mjs";
import { testDeclarations } from "../test-document/index.mjs";
import { defaultSchedule, occasionsOf, scheduleSchema } from "../test-schedule/index.mjs";
import { resultSchema, resultsAt, testHistory } from "../result-records/index.mjs";

const COUNTER_PROOFS = "docs/tests/counter-proofs/";
const SCHEDULE_PATH = "docs/tests/schedule.md";
const RESULTS_BRANCH = "test-results";
// How many commits of the branch `test-results` a page of the history reads, and the record files it names: `runs/<commit>/<file>.md`.
const HISTORY_PAGE = 10;
const RECORD = /^runs\/([^/]+)\/[^/]+\.md$/;
// How many commits of a test file's history are read first for the commit that removed a test; the reading doubles until the commit is found or the history ends.
const FIRST_PAGE = 30;

function el(name, className, ...children) {
  const node = document.createElement(name);
  if (className) node.className = className;
  node.append(...children);
  return node;
}

const problemLine = (what, failure) => el("p", "traces-problem", `${what} could not be read: ${failure?.message ?? failure}`);
const short = (commit) => String(commit).slice(0, 7);
const field = (className, label, value) => el("p", className, el("strong", null, `${label} `), el("span", null, value ?? ""));

// The row of the schedule a test is run under: its level, and `paid` for a test that declares a paid service.
const rowOf = (declaration) => (declaration.paid != null ? "paid" : declaration.level);

function declarationPart(declaration) {
  const guards = [...new Set((declaration.guards ?? []).map((name) => String(name).trim()).filter(Boolean))];
  return el("section", "test-declaration",
    el("p", null, el("strong", null, "Level "), el("span", "test-level", declaration.level ?? "")),
    el("p", null, el("strong", null, "Guards "), el("span", "test-guards", ...guards.flatMap((name, at) => [...(at ? [", "] : []), el("span", "test-guards-item", name)]))),
    el("p", null, el("strong", null, "Precondition "), el("span", "test-given", declaration.given ?? "")),
    el("p", null, el("strong", null, "Input "), el("span", "test-input", declaration.input ?? "")),
    el("p", null, el("strong", null, "Expected result "), el("span", "test-expect", declaration.expect ?? "")));
}

// When the schedule runs the test: the product's schedule at the version shown, the book's default where it has none.
async function schedulePart(snapshot, declaration) {
  try {
    const text = await snapshot.read(SCHEDULE_PATH);
    const schedule = text == null ? defaultSchedule() : readDocument(scheduleSchema, SCHEDULE_PATH, text);
    const occasions = occasionsOf(rowOf(declaration), schedule);
    return el("section", "test-schedule-part", el("p", null, el("strong", null, "Runs "),
      el("span", "test-schedule", `${occasions.length ? occasions.join(", ") : "on no occasion"}${text == null ? " (the book's default schedule)" : ""}`)));
  } catch (failure) {
    return problemLine("The schedule", failure);
  }
}

// The counter-proof record as its file reads, and the participant it names as the one that wrote the test.
async function counterProofPart(snapshot, declaration) {
  try {
    const path = `${COUNTER_PROOFS}${declaration.id}.md`;
    const text = await snapshot.read(path);
    if (text == null) return el("p", "test-counter-proof-none", "No counter-proof record.");
    const participant = readDocument(resultSchema.counterProof, path, text).fields?.participant;
    return el("section", "test-counter-proof-part", ...(participant ? [el("p", null, el("strong", null, "Written by "), el("span", "test-participant", participant))] : []),
      el("div", "test-counter-proof", renderArtifact(text)));
  } catch (failure) {
    return problemLine("The counter-proof", failure);
  }
}

function codePart(host, shown, declaration) {
  const links = host.webLinks?.();
  if (!links?.file) return null;
  const link = el("a", "test-code", declaration.path);
  link.setAttribute("href", links.file(declaration.path, shown.ref));
  return el("p", null, el("strong", null, "Code "), link);
}

// The id at the end of a record's run address (MOD-trace-pages, Files: "the last part of the address's path, as `WebLinks`' `run` builds it"), only where the host makes that exact address
// for it; a host whose links build no run address leaves the last part unchecked. The audit (audit.mjs) asks its runs' logs by it too.
export function runIdOf(host, address) {
  let id;
  try { id = new URL(address).pathname.split("/").filter(Boolean).at(-1); }
  catch { return null; }
  const run = host.webLinks?.()?.run;
  return id && (typeof run !== "function" || run(id) === address) ? id : null;
}

// The run-log link of one history mark, or none where none of its contributing records names a host run. It leads to the run's page and reads "log"; whether the server still keeps the log is asked
// when the person opens it (a click), with ciRunLog for that run alone, and a run whose log the server gives as null then reads "no longer available". A failed asking leaves the link as it was.
async function historyLogLink(host, results, commit, declaration) {
  const levels = await resultsAt(results, commit, [{ id: declaration.id, level: declaration.level }]);
  const recordPaths = levels.flatMap((level) => level.tests).find((test) => test.id === declaration.id)?.records ?? [];
  for (const path of recordPaths) {
    const text = await results.read(path);
    if (text == null) continue;
    const address = readDocument(resultSchema.run, path, text).fields.run;
    const id = runIdOf(host, address);
    if (id == null) continue;
    const link = el("a", "test-history-log", "log");
    link.setAttribute("href", address);
    link.setAttribute("target", "_blank");
    link.setAttribute("rel", "noopener noreferrer");
    let asked = null;
    link.addEventListener("click", () => {
      asked ??= host.ciRunLog(id).then((log) => { if (log == null) link.textContent = "no longer available"; }, () => { asked = null; });
    });
    return link;
  }
  return null;
}

// One page of the branch `test-results`: the record files that the ten commits from `ref` on added (newest commit first; `readHistory` with their changes), the commits those records belong to, and `next`, the parent of the
// page's last commit where the history goes on (the ref of the next page, as the review pages' history is paged), else null. The page's snapshot of the branch is narrowed (`folders`) to those records and to `folders`, the
// folders of the release tags' commits, and all it holds is fetched in one batch.
async function runsPage(host, ref, folders = []) {
  const entries = await host.readHistory(null, { ref, limit: HISTORY_PAGE, changes: true });
  const records = entries.flatMap(({ changes }) => changes.filter(({ change, path }) => change === "added" && RECORD.test(path)).map(({ path }) => path));
  const commits = [...new Set(records.map((path) => RECORD.exec(path)[1]))];
  const next = entries.length === HISTORY_PAGE ? entries.at(-1).parents[0] ?? null : null;
  if (!records.length && !folders.length) return { results: { paths: [], read: async () => null }, commits, next };
  const results = await host.readSnapshot(RESULTS_BRANCH, { folders: [...records, ...folders] });
  await results.readMany?.(results.paths);
  return { results, commits, next };
}

// Whether a commit is one of the default branch (UC-029 step 5): the host's containsCommit about the branch repositoryInfo names, asked once for each commit and kept for the pages of "Earlier runs".
function onDefaultBranch(host) {
  const branch = (async () => (await host.repositoryInfo()).defaultBranch)();
  const asked = new Map();
  return (commit) => {
    if (!asked.has(commit)) asked.set(commit, branch.then((name) => host.containsCommit(name, commit)));
    return asked.get(commit);
  };
}

// The history through testHistory: the commits of the newest ten runs of the branch `test-results` that ran the test, with their optional run logs, the rate of a model-dependent test per release and the release tags'
// outcomes; *Earlier runs* adds the marks of the next ten runs below.
async function historyPart(host, id, declaration) {
  try {
    const tags = (await host.listTags()).map(({ name, commit }) => ({ tag: name, commit }));
    const first = await runsPage(host, RESULTS_BRANCH, tags.map(({ commit }) => `runs/${commit}`));
    const list = el("ul", "test-history-commits");
    const slot = el("div", "test-history-more");
    const shown = new Set();
    const onDefault = onDefaultBranch(host);
    // The marks of one page, in the order of its commits, a commit already marked by an earlier page left out; the release tags' outcomes are the first page's.
    const addMarks = async (page, releaseTags) => {
      const { commits, releases } = await testHistory(page.results, id, releaseTags);
      const outcomes = new Map(commits.map(({ commit, outcome }) => [commit, outcome]));
      const candidates = page.commits.filter((commit) => outcomes.has(commit) && !shown.has(commit));
      const onBranch = await Promise.all(candidates.map(onDefault));
      const marks = candidates.filter((commit, at) => onBranch[at]);
      const logs = new Map(await Promise.all(marks.map(async (commit) => [commit, await historyLogLink(host, page.results, commit, declaration)])));
      for (const commit of marks) {
        shown.add(commit);
        const outcome = outcomes.get(commit);
        list.append(el("li", `test-history-commit${outcome === "flaky" ? " test-history-flaky" : ""}`, `${short(commit)} ${outcome}`, ...(logs.get(commit) ? [" ", logs.get(commit)] : [])));
      }
      return releases;
    };
    const releases = await addMarks(first, tags);
    const offer = (next) => {
      slot.replaceChildren();
      if (!next) return;
      const button = el("button", "test-history-earlier btn", "Earlier runs");
      button.setAttribute("type", "button");
      let reading = false;
      button.addEventListener("click", async () => {
        if (reading) return;
        reading = true;
        try {
          const page = await runsPage(host, next);
          await addMarks(page, []);
          offer(page.next);
        } catch (failure) {
          reading = false;
          slot.append(problemLine("The earlier runs", failure));
        }
      });
      slot.append(button);
    };
    offer(first.next);
    const rates = releases.filter((release) => release.runs);
    return el("section", "test-history",
      el("h3", null, "History"),
      list,
      slot,
      el("ul", "test-history-releases", ...releases.map(({ tag, outcome }) => el("li", "test-history-release", `${tag} ${outcome}`))),
      ...(rates.length ? [el("ul", "test-rate-line", ...rates.map(({ tag, runs }) => el("li", "test-rate-point", `${tag}: ${runs}`)))] : []));
  } catch (failure) {
    return problemLine("The history", failure);
  }
}

// The test of a release that declares `id`, newest release first: its declaration (and so the file it stood in).
async function declaredAtARelease(host, id, declarationsOf) {
  for (const { name } of await host.listTags()) {
    const found = (await declarationsOf(await host.readSnapshot(name))).find((declaration) => declaration.id === id);
    if (found) return found;
  }
  return null;
}

// The commit that removed a test: the first, in the history of its file, whose version no longer declares it. The commits are newest first; the history is read to a limit that doubles until a commit that
// declares the test has an newer one that does not, or the history is read to its end. The history is read again for each limit, since readHistory has a limit and no offset; the text of the file at a
// commit is read once, the commits of an earlier round being kept.
async function removedAt(host, shown, declaration) {
  const declares = (text) => text != null && testDeclarations(declaration.path, text).some((each) => each.id === declaration.id);
  const texts = new Map();
  for (let limit = FIRST_PAGE; ; limit *= 2) {
    const commits = await host.readHistory(declaration.path, { ref: shown.ref, limit, changes: false });
    const unread = commits.map(({ commit }) => commit).filter((commit) => !texts.has(commit));
    if (unread.length) for (const [commit, text] of await host.readFileAt(declaration.path, unread)) texts.set(commit, text);
    let seen = false;
    for (let at = commits.length - 1; at >= 0; at -= 1) {
      if (declares(texts.get(commits[at].commit))) seen = true;
      else if (seen) return commits[at];
    }
    if (commits.length < limit) return null;
  }
}

async function removedPart(host, shown, declaration) {
  try {
    const commit = await removedAt(host, shown, declaration);
    if (!commit) return el("p", "test-removed", "Removed (no commit of its file's history is found that declares it and one after it that does not)");
    return el("p", "test-removed", `Removed at commit ${short(commit.commit)} (${String(commit.date).slice(0, 10)})`);
  } catch (failure) {
    return problemLine("The commit that removed the test", failure);
  }
}

/**
 * showTestDetail({ host, shown, id, declarations, declarationsOf }) -> Promise<Element> — the detail of the test `id` of the version shown: `declarations` are the version's, `declarationsOf(snapshot)` reads those of
 * another snapshot (a release, for a test removed since).
 */
export async function showTestDetail({ host, shown, id, declarations, declarationsOf }) {
  const { snapshot } = shown;
  let declaration = declarations.find((each) => each.id === id);
  let removed = null;
  if (!declaration) {
    try {
      declaration = await declaredAtARelease(host, id, declarationsOf);
    } catch (failure) {
      return el("section", "test-detail", el("h2", null, id), problemLine("The releases", failure));
    }
    if (!declaration) return el("section", "test-detail", el("h2", null, id), el("p", "test-unknown", `No test ${id} is declared at this version or at a release.`));
    removed = await removedPart(host, shown, declaration);
  }
  const parts = [declarationPart(declaration), ...(removed ? [removed] : []), await schedulePart(snapshot, declaration), await counterProofPart(snapshot, declaration), codePart(host, shown, declaration),
    await historyPart(host, id, declaration)];
  return el("section", "test-detail", el("h2", null, `${id} ${declaration.title ?? ""}`.trim()), ...parts.filter(Boolean));
}
