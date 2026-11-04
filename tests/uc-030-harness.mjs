// The harness of the system and release tests of UC-030 (Audit the tests of a release): one product https://github.com/acme/ledger at the release tag v2026.4.0 (and the earlier v2026.3.0), its default branch
// that alone holds the release test report and its approval record, its branch `test-results`, the instance behind it (its SPEC with one process requirement and its register of two sources), all served by a Host
// in memory (tests/trace-pages-harness.mjs' treeHost, with the commit of each ref, the tags, the history of the approval record, the links to the server, the server's answer for a run's log and a log of every
// call of a method that writes), and the route `trace` of MOD-trace-pages called with the key "audit" as the frame calls it. Nothing reaches the network. It holds no test and no expected result: what it builds
// are inputs, and every test states its own expected values.
// Imported by tests/system-uc-030-audit-the-tests-of-a-release.test.mjs and tests/release-uc-030-audit-the-tests-of-a-release.test.mjs.
//
// Module: MOD-trace-pages
// Module: MOD-release-evidence
// Level: system
//
// Authored by developer-sonnet-k (ITM-775). The product at the tag v2026.4.0:
//   - its SPEC holds ENTRIES ARE POSTED (cites the book, advisory, and IEC 62304, normative), BALANCES ARE EXACT, REFUNDS ARE CAPPED, AUDIT TRAILS ARE KEPT, SUMMARIES ARE FAST, HINTS ARE RELEVANT and LATE FEES APPLY,
//     which its default branch has withdrawn since, where CHARGES ARE ITEMISED was added since; the instance's SPEC holds A PROCESS RULE, a process requirement the product's declared workflow adds a gate for;
//   - the tests: TST-701 (unit; ENTRIES ARE POSTED; passed; its counter-proof record), TST-702 (release; ENTRIES ARE POSTED; passed; written by dev-b) and TST-703 (release; ENTRIES ARE POSTED; passed; written by dev-a,
//     who implemented the item that realises it, and who wrote the unit tests of tests/unit.test.mjs too), TST-704 (unit; BALANCES ARE EXACT; failed), TST-705 (unit; AUDIT TRAILS ARE KEPT; passed in one record of the release commit and failed in another: flaky), TST-706
//     (unit, model-dependent; SUMMARIES ARE FAST; 9 of 10, where the last release had 8 of 10) and TST-707 (unit, model-dependent; HINTS ARE RELEVANT; 6 of 10, where the last release had 8 of 10: worse);
//     REFUNDS ARE CAPPED and LATE FEES APPLY have no test, and A PROCESS RULE is the instance's;
//   - the sources: SRC-vibe-coding (advisory, version 2026-10-05) and SRC-iec-62304 (normative, version 2015, class B), each with the hash of its version;
//   - the default branch holds the report docs/tests/releases/v2026.4.0.md, accepted by akmaier on 2026-10-12 08:30 UTC by the commit ACCEPTING that added the approval record, which records two limitations;
//   - the branch test-results holds the records of the release commit COMMIT (two of them) and of the last release's commit OLD.

import { createHash } from "node:crypto";
import { writeDocument } from "../src/documents/index.mjs";
import { approvalSchema } from "../src/approvals/index.mjs";
import { document, find, treeHost, until } from "./trace-pages-harness.mjs";

const { view } = await import("../src/trace-pages/index.mjs");
export const route = view.routes.find((candidate) => candidate.name === "trace");
export { document, find, until };

const hex = (text) => createHash("sha256").update(text, "utf8").digest("hex");
const versionHash = (files) => hex([...files].sort(([a], [b]) => (a < b ? -1 : 1)).map(([name, text]) => `${hex(text)}  ${name}\n`).join(""));
export const gitBlob = (text) => createHash("sha1").update(`blob ${Buffer.byteLength(text)}\0`).update(text).digest("hex");

export const TAG = "v2026.4.0", OLDER = "v2026.3.0", REPORT = `docs/tests/releases/${TAG}.md`;
export const COMMIT = "c".repeat(40), OLD = "e".repeat(40), HEAD = "f".repeat(40), ACCEPTING = "d".repeat(40), MODEL_COMMIT = "a1".repeat(20);
export const POSTED = "ENTRIES ARE POSTED", EXACT = "BALANCES ARE EXACT", CAPPED = "REFUNDS ARE CAPPED", KEPT = "AUDIT TRAILS ARE KEPT", FAST = "SUMMARIES ARE FAST", RELEVANT = "HINTS ARE RELEVANT";
export const LATE = "LATE FEES APPLY", ITEMISED = "CHARGES ARE ITEMISED", PROCESS = "A PROCESS RULE";
export const ADDRESS = "https://github.com/acme/ledger";
/** The rows of the audit, in the order of the product's SPEC at the tag, then the process requirement. */
export const ALL = [POSTED, EXACT, CAPPED, KEPT, FAST, RELEVANT, LATE, PROCESS];

const BOOK_FILES = [["08_requirements-engineering.md", "Chapter 8 of the book.\n"]];
const IEC_FILES = [["iec-62304.txt", "5.5.5 Software unit verification.\n"]];
export const BOOK_HASH = versionHash(BOOK_FILES), IEC_HASH = versionHash(IEC_FILES);
export const BOOK_FILE_HASH = hex(BOOK_FILES[0][1]), IEC_FILE_HASH = hex(IEC_FILES[0][1]);
const entry = ({ id, title, kind, authority, extra = [], version, files }) => [
  "---", `id: ${id}`, `title: ${title}`, `kind: ${kind}`, `authority: ${authority}`, "licence: may be republished — fixture", ...extra, "---",
  `# ${id} ${title}`, "", "A fixture source.", "", "## Versions", "",
  "| Version | Date | Edition | Read from | Files |", "|---|---|---|---|---|",
  `| \`${version}\` | 2026-10-01 | fixture | fixture only | listed below |`, "",
  `### Files of ${version}`, "", "| File | SHA-256 |", "|---|---|",
  ...files.map(([name, text]) => `| \`${name}\` | \`${hex(text)}\` |`), "",
].join("\n");
export const BOOK = entry({ id: "SRC-vibe-coding", title: "Vibe Coding", kind: "document", authority: "advisory", version: "2026-10-05", files: BOOK_FILES });
export const IEC = entry({ id: "SRC-iec-62304", title: "Medical device software", kind: "standard", authority: "normative", extra: ["designation: IEC 62304:2006+AMD1:2015"], version: "2015", files: IEC_FILES });
export const LINKS = ["# The sources this product meets", "", "| Source | Version | Hash | Part |", "|---|---|---|---|",
  `| SRC-vibe-coding | 2026-10-05 | ${BOOK_HASH} | |`, `| SRC-iec-62304 | 2015 | ${IEC_HASH} | class B |`, ""].join("\n");

export const rule = (name, source, text, check) => [`**${name}** *(${source})*`, text, `*Check:* ${check}`, ""];
export const SPEC = ["# Ledger — Specification", "", "## Rules", "",
  ...rule(POSTED, "Vibe Coding, ch. 9; IEC 62304:2006+AMD1:2015, 5.5.5", "Every entry is posted.", "`tests/unit.test.mjs`"),
  ...rule(EXACT, "Vibe Coding", "A balance is exact.", "`tests/failing.test.mjs`"), ...rule(CAPPED, "Vibe Coding", "A refund is capped.", "no automatic check; at review"),
  ...rule(KEPT, "Vibe Coding", "An audit trail is kept.", "`tests/unit.test.mjs`"), ...rule(FAST, "Vibe Coding", "A summary is fast.", "`tests/unit.test.mjs`"),
  ...rule(RELEVANT, "Vibe Coding", "A hint is relevant.", "`tests/unit.test.mjs`"), ...rule(LATE, "Vibe Coding", "A late return costs a fee.", "no automatic check; at review")].join("\n");
const HEAD_SPEC = SPEC.replace(/\*\*LATE FEES APPLY\*\*[\s\S]*$/, "") + ["**CHARGES ARE ITEMISED** *(Vibe Coding)*", "A charge is itemised.", "*Check:* no automatic check; at review", ""].join("\n");
export const INSTANCE_SPEC = ["# Instance — Specification", "", "## Process", "", ...rule(PROCESS, "Vibe Coding", "The process rule.", "no automatic check; at review")].join("\n");

// A declaration as MOD-test-document reads it.
export const declared = (id, level, guards, module, extra = []) => [`// ${id} · level: ${level} · module: ${module}`, `// guards: ${guards}`, "// given: a fixture", "// input: a call", "// expect: a result", ...extra, ""].join("\n");
const jobRecord = ({ id, kind, worksOn, participant, results }) => ["---", `id: ${id}`, `kind: ${kind}`, "works_on:", `  - ${worksOn}`, `participant: ${participant}`, "route: tab", "started_by: akmaier",
  "start: 2026-10-01 09:00 UTC", "agent_m: fixture, commit fixture", "limit: 1", "---", "## Destinations", "", "## Parameters", "", "```json", "{}", "```", "", "## End", "", "at: 2026-10-01 10:00 UTC",
  "state: done", `results: ${results}`, ""].join("\n");
/** A run record of the branch test-results: `rows` are [test, level, outcome, runs]. */
export const run = (commit, rows, id = null) => ["---", `commit: ${commit}`, "levels:", "  - unit", "  - release", "occasion: release-candidate", "participant: ci", "date: 2026-10-11 21:00 UTC",
  ...(id ? [`run: ${ADDRESS}/actions/runs/${id}`] : []), "---", "## Outcomes", "",
  "| Test | Level | Outcome | Runs |", "|---|---|---|---|", ...rows.map((row) => `| ${row.join(" | ")} |`), ""].join("\n");

const PRIOR_REPORT = ["---", "version: 2026.3.0", "candidate: v2026.3.0-rc.1", `commit: ${OLD}`, "date: 2026-10-01", "---", "## Limitations", "", "## Levels", "", "| Level | Passed | Failed | Flaky | Not run |",
  "|---|---|---|---|---|", "| unit | 2 | 0 | 0 | 0 |", "", "## Tests", "", "| Test | Level | Outcome | Guards |", "|---|---|---|---|", `| TST-706 | unit | 8 of 10 | ${FAST} |`,
  `| TST-707 | unit | 8 of 10 | ${RELEVANT} |`, "", "## Requirements", "", "| Requirement | Level | Tests | Outcome |", "|---|---|---|---|", `| ${FAST} | unit | TST-706 | passed |`,
  `| ${RELEVANT} | unit | TST-707 | passed |`, "", "## Changelog entry", "", "Earlier.", ""].join("\n");

export const REPORT_TEXT = "# Report of the fixture release\n\nThe report as accepted.\n";
export const REPORT_BLOB = gitBlob(REPORT_TEXT);
export const LIMITATIONS = ["TST-705 — flaky on the CI runner", "TST-707 — the model answers worse than at the last release"];
export const approvalOf = (limitation, text = REPORT_TEXT) => writeDocument(approvalSchema, { fields: { kind: "release-report", file: REPORT, blob: gitBlob(text), limitation } });
export const RECORD = `docs/approvals/release-${TAG}-${REPORT_BLOB.slice(0, 12)}.md`;
export const COUNTER_PROOF_PATH = "docs/tests/counter-proofs/TST-701.md";
const COUNTER_PROOF = ["---", "test: TST-701", `commit: ${COMMIT}`, "participant: dev-a", "date: 2026-10-01 09:30 UTC", "outcome: failed", "---", "## Fault", "", "src/ledger/post.mjs: the posting removed.", "",
  "## Result", "", "Failed with the fault, passed without it.", ""].join("\n");

// The process the product declared: the instance's model at MODEL_COMMIT (phases Plan and Build, one gate between them) and one gate that A PROCESS RULE adds.
const MODEL_PATH = "docs/process-models/mini.md";
const MODEL = ["---", "name: mini", "kind: planned", "measure: plan entries per phase", "---", "# Mini", "", "## Phases", "", "| Name | Role | Produces |", "|---|---|---|", "| Plan | Lead | ITM |",
  "| Build | Lead | MOD |", "", "## Transitions", "", "| From | To | Kind |", "|---|---|---|", "| Plan | Build | sequence |", "", "## Verification pairs", "", "| Phase | Checked by |", "|---|---|",
  "| Plan | Build |", "", "## Gates", "", "| Between | Artifacts | Condition | Decider |", "|---|---|---|---|", "| Plan → Build | the plan | it is complete | Lead |", "", "## Roles", "",
  "| Name | Filled by | How many | Capabilities |", "|---|---|---|---|", "| Lead | either | one | read the repository |", "", "## Flow control", "", "| Kind | Value |", "|---|---|", "| WIP limit | — |",
  "| Time box | none |", "| Sprints | no |", ""].join("\n");
const PROCESS_MD = ["---", "model: mini", `model_file: ${MODEL_PATH}`, `model_version: ${MODEL_COMMIT}`, "---", "# Process", "", "## Practices", "", "- none", "", "## Branches", "",
  "| Phase or time box | Branch |", "|---|---|", "| Plan | plan |", "", "## Gates added by requirements", "", "| Requirement | Between | Artifacts | Condition | Decider |", "|---|---|---|---|---|",
  `| ${PROCESS} | Plan → Build | SPEC.md | the process rule holds | Lead |`, "", "## Definition of Done", "", "The job rules hold.", ""].join("\n");
export const GATE_PATH = "docs/gates/20261010-1000-a-process-rule-alic.md";
export const gateRecordOf = (gate) => ["---", `gate: ${gate}`, "job:", "decider: alice", "role: Lead", "decision: passed", "on:", `  - SPEC.md@${gitBlob(SPEC)}`, "date: 2026-10-10 10:00 UTC", "---", `# ${PROCESS}: the fixture`, "",
  "**REGISTER**", ""].join("\n");
const GATE_RECORD = gateRecordOf(PROCESS);

/** The product at the tag. */
export const productFiles = () => ({
  "SPEC.md": SPEC, "docs/sources.md": LINKS,
  "tests/unit.test.mjs": [declared("TST-701", "unit", POSTED, "MOD-ledger"), declared("TST-705", "unit", KEPT, "MOD-ledger"), declared("TST-706", "unit", FAST, "MOD-ledger", ["// runs: 10", "// phrasings: 2"]),
    declared("TST-707", "unit", RELEVANT, "MOD-ledger", ["// runs: 10", "// phrasings: 2"])].join("\n"),
  "tests/failing.test.mjs": declared("TST-704", "unit", EXACT, "MOD-ledger"),
  "tests/release-a.test.mjs": declared("TST-702", "release", POSTED, "system"), "tests/release-b.test.mjs": declared("TST-703", "release", POSTED, "system"),
  "docs/backlog/ITM-900-ledger.md": ["---", "id: ITM-900", "title: The ledger", "level: module", "realises:", `  - ${POSTED}`, "modules:", "  - MOD-ledger", "tests:", "  - unit", "origin:", "  - akmaier", "---",
    "# ITM-900 The ledger", ""].join("\n"),
  "docs/jobs/JOB-20261001-0900-aaaa.md": jobRecord({ id: "JOB-20261001-0900-aaaa", kind: "implement", worksOn: "ITM-900", participant: "dev-a", results: "src/ledger/post.mjs" }),
  "docs/jobs/JOB-20261001-0901-bbbb.md": jobRecord({ id: "JOB-20261001-0901-bbbb", kind: "write-tests", worksOn: "UC-001", participant: "dev-b", results: "tests/release-a.test.mjs" }),
  "docs/jobs/JOB-20261001-0902-cccc.md": jobRecord({ id: "JOB-20261001-0902-cccc", kind: "write-tests", worksOn: "UC-001", participant: "dev-a", results: "tests/release-b.test.mjs" }),
  "docs/jobs/JOB-20261001-0904-eeee.md": jobRecord({ id: "JOB-20261001-0904-eeee", kind: "write-tests", worksOn: "UC-001", participant: "dev-a", results: "tests/unit.test.mjs" }),
  [COUNTER_PROOF_PATH]: COUNTER_PROOF, [`docs/tests/releases/${OLDER}.md`]: PRIOR_REPORT, "docs/process.md": PROCESS_MD, [GATE_PATH]: GATE_RECORD,
});
/** The default branch: the report, and, where `accepted`, the approval record that names its text. */
export const headFiles = (accepted = true, limitations = LIMITATIONS) => ({ "SPEC.md": HEAD_SPEC, [REPORT]: REPORT_TEXT, ...(accepted ? { [RECORD]: approvalOf(limitations) } : {}) });
/** The branch test-results: TST-705 passed in one record of COMMIT and failed in another; the rates of the two model-dependent tests at COMMIT and at OLD. */
export const resultFiles = () => ({
  [`runs/${COMMIT}/a.md`]: run(COMMIT, [["TST-701", "unit", "passed", ""], ["TST-702", "release", "passed", ""], ["TST-703", "release", "passed", ""], ["TST-705", "unit", "passed", ""],
    ["TST-706", "unit", "passed", "9 of 10"], ["TST-707", "unit", "passed", "6 of 10"]], 5001),
  [`runs/${COMMIT}/b.md`]: run(COMMIT, [["TST-705", "unit", "failed", ""], ["TST-704", "unit", "failed", ""]], 5002),
  [`runs/${OLD}/old.md`]: run(OLD, [["TST-701", "unit", "passed", ""], ["TST-706", "unit", "passed", "8 of 10"], ["TST-707", "unit", "passed", "8 of 10"]]),
});
/** The product at the earlier tag v2026.3.0: ENTRIES ARE POSTED, guarded by TST-701, and LATE FEES APPLY; the default branch holds no report of it. */
export const olderFiles = () => ({ "SPEC.md": ["# Ledger — Specification", "", "## Rules", "", ...rule(POSTED, "Vibe Coding", "Every entry is posted.", "`tests/unit.test.mjs`"),
  ...rule(LATE, "Vibe Coding", "A late return costs a fee.", "no automatic check; at review")].join("\n"), "docs/sources.md": LINKS,
  "tests/unit.test.mjs": declared("TST-701", "unit", POSTED, "MOD-ledger") });
export const instanceFiles = () => ({ "SPEC.md": INSTANCE_SPEC, "docs/sources/SRC-vibe-coding.md": BOOK, "docs/sources/SRC-iec-62304.md": IEC });
export const ACCEPTED_BY = { commit: ACCEPTING, parents: [], author: { account: "akmaier", name: "Andreas Maier" }, date: "2026-10-12 08:30 UTC", message: "", changes: [] };
/** A run record the server cites for the release commit: its id, and the address of its page. */
export const runPage = (commit) => `${ADDRESS}/commit/${commit}/checks`;

/**
 * productHost({ product, older, head, results, tags, links, recordHistory, canWrite, logs }) -> Host — the product: the tag holds `product`, the default branch `head`, the branch test-results `results`; `links`
 * false leaves out the server's run page; `recordHistory` is the history of the approval record; with `canWrite` the person may write; `logs` maps a run's id to the log the server keeps, a run not named has none (null). Its `log` notes the
 * run pages and file pages asked for, `commits` every commitFiles, `releaseCommit` the commit of the tag (COMMIT for the fixture's own product, a commit of its own for a product that differs from it), `writes` every call of another method that writes, and `logged` every run whose log was asked.
 */
export function productHost({ product = productFiles(), older = olderFiles(), head = headFiles(), results = resultFiles(), tags = [TAG, OLDER, "nightly"], links = true, recordHistory = [ACCEPTED_BY], canWrite = false, logs = { 5001: "log of run 5001", 5002: "log of run 5002" } } = {}) {
  // The page keeps a commit's stored trace graph for the whole run (MOD-trace-graph's storedGraph), so a product that differs from the fixture is tagged at a commit of its own; the records of the
  // release commit are then written for that commit.
  const same = JSON.stringify(product) === JSON.stringify(productFiles());
  const commit = same ? COMMIT : createHash("sha1").update(JSON.stringify(product)).digest("hex");
  const swap = (text) => text.replaceAll(COMMIT, commit);
  const base = treeHost({ trees: { [TAG]: product, [OLDER]: older, main: head, "test-results": same ? results : Object.fromEntries(Object.entries(results).map(([path, text]) => [swap(path), swap(text)])) }, tags });
  const commits = { [TAG]: commit, [OLDER]: OLD, main: HEAD };
  const log = { runs: [], files: [], histories: [] }, changes = [], writes = [], logged = [];
  const writing = (name) => async (...args) => { writes.push([name, args]); throw Object.assign(new Error(`${name} is not for this page`), { name: "Refused" }); };
  return { ...base, log, commits: changes, writes, logged, releaseCommit: commit,
    async ciRunLog(id) { logged.push(String(id)); return logs[id] ?? null; },
    async readSnapshot(ref) { const snapshot = await base.readSnapshot(ref); return { ...snapshot, commit: commits[ref] ?? ref, repository: { path: "acme/ledger", web: ADDRESS } }; },
    async listTags() { return tags.map((name) => ({ name, commit: name === TAG ? commit : name === OLDER ? OLD : `commit-of-${name}` })); },
    async readHistory(path, options = {}) { log.histories.push([path, options]); return path === RECORD && head[RECORD] !== undefined ? recordHistory : []; },
    async repositoryInfo() { return { defaultBranch: "main", visibility: "public", canWrite, archived: false, description: "" }; },
    async commitFiles(change) { changes.push(change); return { commit: "e".repeat(40) }; },
    createBranch: writing("createBranch"), openPullRequest: writing("openPullRequest"), createTag: writing("createTag"), writeFile: writing("writeFile"),
    webLinks: links ? () => ({ commitRuns: (commit) => { log.runs.push(commit); return runPage(commit); }, file: (path, ref) => { log.files.push([path, ref]); return `${ADDRESS}/blob/${ref}/${path}`; } }) : undefined };
}
/** The instance: its SPEC, its register of two sources and the process model at MODEL_COMMIT; `files` replaces the files of its default branch. */
export const instanceHost = (files = instanceFiles()) => treeHost({ trees: { main: files, [MODEL_COMMIT]: { [MODEL_PATH]: MODEL } } });

/** The route `trace` drawn with the key "audit" at `ref` over `host`, as the frame draws it. */
export async function render(host = productHost(), params = { key: "audit", ref: TAG }, instance = instanceHost()) {
  const target = document.createElement("div");
  document.body.append(target);
  await route.render(target, { product: { address: ADDRESS, host }, instance: { host: instance } }, params);
  return target;
}
export const withClass = (root, name) => find(root, (node) => String(node.className).split(" ").includes(name));
export const textsOf = (root, name) => withClass(root, name).map((node) => node.textContent);
export const rows = (root) => withClass(root, "audit-row");
export const names = (root) => rows(root).map((row) => row.getAttribute("data-requirement"));
export const rowOf = (root, name) => rows(root).find((row) => row.getAttribute("data-requirement") === name);
export const countOf = (root, kind) => withClass(root, "audit-count").find((node) => node.getAttribute("data-kind") === kind);
export const numbers = (root) => Object.fromEntries(["passing", "noTest", "notPassed", "flaky", "worse", "byImplementer"].map((kind) => [kind, countOf(root, kind).textContent]));
export const optionsOf = (root, className) => find(withClass(root, className)[0], (node) => node.localName === "option").map((node) => node.value);
export const buttonNamed = (root, label) => find(root, (node) => node.localName === "button" && node.textContent === label)[0];
const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

/** Chooses `value` in the select of class `className` under `target`, as a person does, and waits for the page to draw it. */
export async function choose(target, className, value) {
  const select = withClass(target, className)[0];
  select.value = value;
  select.dispatchEvent(new Event("change"));
  await until(() => select.value === value);
  await settle();
}
/** Clicks `node` as a person does, and waits for what the click asks to be answered. */
export async function press(node) { node.dispatchEvent(new Event("click")); await settle(); }
/** Ticks or unticks the checkbox `only gaps`. */
export async function tickGaps(target, on) {
  const box = withClass(target, "audit-filter-gaps")[0];
  box.checked = on;
  box.dispatchEvent(new Event("change"));
  await settle();
}

/**
 * renderExportable(host) -> { target, press(button, trusted), downloads, restore } — the audit drawn with every click listener kept by node until `restore()` and a fake browser download: `downloads.blobs` holds each Blob handed to
 * createObjectURL and `downloads.clicked` each anchor clicked. `press` calls the listener the page registered, with the click's trust; `restore()` puts the browser back.
 */
export async function renderExportable(host, instance = instanceHost()) {
  const listeners = [], add = EventTarget.prototype.addEventListener;
  EventTarget.prototype.addEventListener = function (type, listener, ...rest) { if (type === "click") listeners.push([this, listener]); return add.call(this, type, listener, ...rest); };
  const downloads = { blobs: [], clicked: [] }, realUrl = globalThis.URL, anchors = Object.getPrototypeOf(document.createElement("a"));
  const had = Object.hasOwn(anchors, "click"), realClick = anchors.click;
  globalThis.URL = Object.assign(function URLFake(...args) { return new realUrl(...args); }, { createObjectURL(blob) { downloads.blobs.push(blob); return "blob:fake-audit"; }, revokeObjectURL() {} });
  anchors.click = function click() { downloads.clicked.push({ href: this.href ?? this.getAttribute?.("href"), download: this.download ?? this.getAttribute?.("download") }); };
  let target;
  try { target = await render(host, { key: "audit", ref: TAG }, instance); } catch (failure) { EventTarget.prototype.addEventListener = add; throw failure; }
  const restore = () => { EventTarget.prototype.addEventListener = add; globalThis.URL = realUrl; if (had) anchors.click = realClick; else delete anchors.click; };
  const pressTrusted = async (button, trusted = true) => { await listeners.filter(([node]) => node === button).at(-1)[1]({ isTrusted: trusted }); await settle(); };
  return { target, press: pressTrusted, downloads, restore };
}
/** The text of the audit document Export saves for `host`, and what the page did on the way. */
export async function exported(host, instance = instanceHost()) {
  const world = await renderExportable(host, instance);
  try {
    await world.press(buttonNamed(world.target, "Export"));
    return { text: await world.downloads.blobs[0].text(), ...world };
  } finally { world.restore(); }
}
