// Specification and design, its three modules together with the strategies that draft their artifacts (ITM-369) — the kinds `derive-use-cases`, `change-use-case` and
// `change-requirements` of the catalogue, prepared and run through MOD-job-runner's prepareJob, runJob and writeResult with the strategies of MOD-approvals (use-cases,
// use-case-with-neighbours, rests-on-accepted), MOD-spec-changes (chosen-requirements, named-requirements, spec-with-queues, the writer queue-entries) and MOD-artifact-edits
// (identifier-kept, the writer open-files), MOD-source-register's chapter recipe and the runner's built-in checks (document-schema, graph-checks, requirement-form, candidate-classes),
// a fixture participant and a fixture repository host: from the parts each recipe gives, through the finding sent back and fixed, to the writer's commit with its provenance lines.
// Run: node --test tests/specification-and-design-drafting-together.test.mjs
//
// Module: MOD-approvals · MOD-spec-changes · MOD-artifact-edits
// Level: component
// Guards: UC-007; UC-019; A DRAFT THAT FAILS A CHECK GOES BACK TO ITS PARTICIPANT; A REVIEWED ARTIFACT ENTERS THE DEFAULT BRANCH AS OPEN; A SPEC EDIT IS SAVED AS A PROPOSAL
// Guards: A PROMPTED REQUIREMENT CHANGE FOLLOWS THE DERIVATION RULES
//
// Written from UC-007, UC-019, ARC-041 and the three module files, not from the code, and with the use cases' own example data: the requirement EXPORT IS A PDF, the unknown name
// EXPORT AS PDF of UC-007 step 5 and UC-019 step 7, the instruction "add error handling to UC-007", the changed identifier UC-043, and the restated requirement classed new.
// The product is the small repository this file holds, behind a fake host that keeps to MOD-repository-hosts' interface (repositoryInfo, readSnapshot, readHistory, commitFiles
// only on the head that was read, else `Moved`); every commit is recorded. The instance is a read-only snapshot whose register entry of the book and its chapter 8 are read from
// this repository's disk, and whose register also holds the author's own source. The participant is a fixture driver that answers from a list and keeps every input it was sent.
// Nothing reaches the network. Readings the texts leave open, taken here and named in the pull request:
//   - The default scope of `chosen-requirements` (no choice) is the requirements no use case realises; the tests pass `requirements` where UC-007 step 1 lets the author choose.
//   - The provenance lines are the six `Agent-M-…` trailers of MOD-job-runner's provenanceLines, written out here, none naming the person's instruction.
//   - A new use case gets one more than the highest number the head and the history hold (nextIdentifier), its path `docs/use-cases/UC-<nnn>-<slug of the drafted path>.md`.
//   - A person's click on a kind they review is `writeResult(prepared, draft, { result, context })`; a CI agent's draft (UC-019 6b) is a run that is not attended.
// Each test states its input and its expected result before it runs (given / input / expect). The counter-proofs are recorded in the pull request.

import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { kindOf } from "../src/job-catalogue/index.mjs";
import { prepareJob, registerStrategies, runJob, writeResult } from "../src/job-runner/index.mjs";
import * as approvals from "../src/approvals/index.mjs";
import * as specChanges from "../src/spec-changes/index.mjs";
import * as artifactEdits from "../src/artifact-edits/index.mjs";
import * as sourceRegister from "../src/source-register/index.mjs";
import * as issueHandling from "../src/issue-handling/index.mjs";

for (const [owner, module, name] of [["MOD-approvals", approvals, "approvalStrategies"], ["MOD-spec-changes", specChanges, "specStrategies"],
  ["MOD-artifact-edits", artifactEdits, "editStrategies"], ["MOD-source-register", sourceRegister, "sourceStrategies"], ["MOD-issue-handling", issueHandling, "issueStrategies"]]) {
  try { registerStrategies(owner, module[name]); } catch (error) { if (error.name !== "DuplicateStrategy") throw error; }
}

// ---------------------------------------------------------------- the product

const text = (...lines) => `${lines.join("\n")}\n`;
const gitBlob = (body) => createHash("sha1").update(`blob ${Buffer.byteLength(body)}\0${body}`).digest("hex");
const ON_GITHUB = { server: "github", origin: "https://github.com", path: "alice/report-tool", web: "https://github.com/alice/report-tool" };

const EXPORT = "EXPORT IS A PDF", EXPORT_RULE = "A report can be exported as a PDF file.";
const TITLE = "A REPORT HAS A TITLE", TITLE_RULE = "Every report shows a title.";
const SECTION = text("## 3. Export", "", `**${EXPORT}** *(Product Owner)*`, EXPORT_RULE, "*Check:* `tests/export.test.mjs`", "",
  `**${TITLE}** *(Product Owner)*`, TITLE_RULE, "*Check:* no automatic check; at review");
const SPEC = text("# Report tool — Specification", "") + SECTION;

// A complete use case in the five parts, a diagram and the names it realises.
const useCase = ({ id, title, realises, goal, alternative = "- **1a. The report is empty.** Nothing is written." }) => text("---", `id: ${id}`, `title: ${title}`, "area: reports", "actors:",
  "  - Author", "realises:", ...realises.map((name) => `  - ${name}`), "---", `# ${id} ${title}`, "", `**Goal.** ${goal}`, "", "## Actors", "", "- **Author** — wants the report.", "",
  "## Precondition", "", "- The report exists.", "", "## Main flow", "", "1. The author presses **Export**.", "2. The dashboard writes the file.", "", "```mermaid", "sequenceDiagram",
  "    actor A as Author", "    participant D as Dashboard", "    A->>D: Export", "    D-->>A: file", "```", "", "## Alternative flows", "", alternative, "", "## Postcondition", "",
  "- The file holds the report.");
const UC7_PATH = "docs/use-cases/UC-007-export-a-report.md";
const UC7 = useCase({ id: "UC-007", title: "Export a report", realises: [EXPORT], goal: "The author takes the report away as a PDF file." });
const UC3_PATH = "docs/use-cases/UC-003-print-a-report.md";
const UC3 = useCase({ id: "UC-003", title: "Print a report", realises: [EXPORT], goal: "The author prints the report." });
const recordOf = (id, path, body) => [`docs/approvals/${id}-${gitBlob(body).slice(0, 12)}.md`, text("kind: use-case", `file: ${path}`, `blob: ${gitBlob(body)}`)];

// The instance's register: the book (from the disk, with its chapter 8) and the author's own source, which the product links.
const ROOT = new URL("../", import.meta.url);
const onDisk = (path) => { try { return readFileSync(new URL(path, ROOT), "utf8"); } catch { return null; } };
const ALICE_ENTRY = text("---", "id: SRC-alice", "title: Alice", "kind: person", "authority: normative", "licence: may be republished — fixture", "---", "# SRC-alice Alice", "",
  "The author's own source.", "", "## Versions", "", "| Version | Date | Edition | Read from | Files |", "|---|---|---|---|---|",
  `| \`2026-10-12\` | 2026-10-12 | — | the fixture | 1 file, listed below; version hash \`${"2".repeat(64)}\` |`, "", "### Files of 2026-10-12", "", "| File | SHA-256 |", "|---|---|",
  `| \`alice.md\` | \`${"b".repeat(64)}\` |`);
const LINKS = text("# The sources this product meets", "", "| Source | Version | Hash | Part |", "|---|---|---|---|", `| SRC-alice | 2026-10-12 | ${"2".repeat(64)} | |`);
const REGISTER = ["docs/sources/SRC-vibe-coding.md", "docs/sources/SRC-alice.md"];
const instanceSnapshot = {
  repository: { server: "github", origin: "https://github.com", path: "alice/agent-m", web: "https://github.com/alice/agent-m" }, ref: "main", commit: "abc123def4567890abc123def4567890abc123de",
  paths: REGISTER, read: async (path) => (path === "docs/sources/SRC-alice.md" ? ALICE_ENTRY : onDisk(path)), blob: () => null,
};
const CHAPTER_8 = readdirSync(new URL("docs/sources/SRC-vibe-coding/2026-10-05/", ROOT)).find((name) => name.startsWith("08_"));

// ---------------------------------------------------------------- the fake host

const failure = (name, fields = {}) => Object.assign(new Error(`${name} ${JSON.stringify(fields)}`), { name }, fields);

// The product's repository: the default branch `trunk`; `history` the paths the version history once held (for the identifiers ever used).
function product(files, { history = [] } = {}) {
  const commits = new Map(), writes = [], log = [];
  let made = 0, head = null;
  const commitOf = (tree, changes) => {
    const sha = createHash("sha1").update(`commit ${++made}`).digest("hex");
    commits.set(sha, tree);
    log.push({ commit: sha, parents: log.length ? [log[log.length - 1].commit] : [], author: { account: "alice", name: "alice" }, date: new Date(Date.UTC(2026, 9, 12, 8, made)).toISOString(),
      message: "a commit", changes });
    return sha;
  };
  head = commitOf(new Map(Object.entries(files)), Object.keys(files).map((path) => ({ path, change: "added" })));
  const fake = {
    writes, head: () => head, files: () => Object.fromEntries(commits.get(head)),
    host: {
      async repositoryInfo() { return { defaultBranch: "trunk", visibility: "private", canWrite: true, archived: false, description: "" }; },
      async readSnapshot(ref) {
        const sha = ref === "trunk" ? head : ref;
        if (!commits.has(sha)) throw failure("NotFound", { what: ref });
        const tree = commits.get(sha);
        return { repository: ON_GITHUB, ref, commit: sha, paths: [...tree.keys()].sort(), read: async (path) => (tree.has(path) ? tree.get(path) : null),
          blob: (path) => (tree.has(path) ? gitBlob(tree.get(path)) : null) };
      },
      async readHistory(path, { ref = "trunk", limit } = {}) {
        const upTo = log.findIndex((entry) => entry.commit === (ref === "trunk" ? head : ref));
        const once = history.map((gone, at) => ({ commit: `${at}`.padEnd(40, "9"), parents: [], author: { account: "bob", name: "bob" }, date: "2026-10-01T09:00:00Z", message: "once",
          changes: [{ path: gone, change: "removed" }] }));
        const found = [...log.slice(0, upTo + 1), ...once].filter((entry) => path === null || entry.changes.some((change) => change.path === path)).reverse();
        return limit === undefined ? found : found.slice(0, limit);
      },
      async commitFiles(change) {
        writes.push(structuredClone(change));
        if (change.branch !== "trunk" || change.expectedHead !== head) throw failure("Moved", { head });
        const before = commits.get(head);
        head = commitOf(new Map([...before, ...change.files.map((file) => [file.path, file.text])]), change.files.map((file) => ({ path: file.path, change: before.has(file.path) ? "modified" : "added" })));
        return { commit: head, url: `${ON_GITHUB.web}/commit/${head}` };
      },
    },
  };
  return fake;
}
const PRODUCT = { "README.md": "# Report tool\n", "SPEC.md": SPEC, "docs/sources.md": LINKS, [UC7_PATH]: UC7, [UC3_PATH]: UC3, ...Object.fromEntries([recordOf("UC-007", UC7_PATH, UC7)]) };

// ---------------------------------------------------------------- the participant and the job

const DRAFTER = { name: "drafter-a", type: "model endpoint", model: "example-model", context: 200000, price: null, capabilities: ["draft text"], place: "this machine", route: "endpoint ep1" };
const USAGE = { inputTokens: 10, outputTokens: 5, minutes: null, cost: null };
// A driver that answers from `answers` in turn — an envelope { draft, answers } as the output schema states it — and keeps every input.
function driver(answers) {
  const inputs = [];
  return { participant: DRAFTER, inputs, async send(input) {
    inputs.push(structuredClone(input));
    const next = answers.shift();
    if (next === undefined) throw new Error(`the drafter was asked more often than the test expects; findings sent: ${JSON.stringify(input.findings)}`);
    return { text: JSON.stringify(next), usage: USAGE };
  } };
}
const AGENT_M = { version: "2026.10.0", commit: "0".repeat(40) };
const JOB = "JOB-20261012-0900-a1b2";
async function contextOf(name, fake, params) {
  return { kind: await kindOf(name), params, product: { address: "https://github.com/alice/report-tool", snapshot: await fake.host.readSnapshot("trunk"), host: fake.host },
    instance: { snapshot: instanceSnapshot, host: null }, connect: async () => null, participants: [DRAFTER], places: { sources: {}, mailbox: null }, gates: [], person: "alice",
    now: new Date("2026-10-12T09:00:00Z"), agentM: AGENT_M, jobId: JOB };
}
async function prepare(name, fake, params, limit) {
  const context = await contextOf(name, fake, params);
  return { context, job: await prepareJob(name, context, { drafter: DRAFTER, reviewers: [], limit }) };
}
const trailers = (message) => message.split("\n").filter((line) => line.startsWith("Agent-M-"));
const provenance = (kind, rounds) => [`Agent-M-Version: ${AGENT_M.version}, commit ${AGENT_M.commit}`, `Agent-M-Job: ${JOB}`, `Agent-M-Kind: ${kind}`, "Agent-M-Participant: drafter-a",
  "Agent-M-Model: example-model", `Agent-M-Rounds: ${rounds}`];
const answer = (draft, answers = []) => ({ draft, answers });
const lineOf = (f) => `${f.artifact}:${f.line}: ${f.kind}: ${f.what} [${f.rule}] — ${f.fix}`;
const unrecorded = (fake) => Object.keys(fake.files()).filter((path) => path.startsWith("docs/approvals/")).length;

// ---------------------------------------------------------------- derive-use-cases (UC-007)

// Module (as the file header stated it): MOD-approvals · MOD-spec-changes · MOD-artifact-edits
// TST-476056 · level: component · module: MOD-approvals
// guards: UC-007; A DRAFT THAT FAILS A CHECK GOES BACK TO ITS PARTICIPANT; A REVIEWED ARTIFACT ENTERS THE DEFAULT BRANCH AS OPEN
// given: the product of UC-007's example — the requirement EXPORT IS A PDF realised by UC-007 and UC-003, the requirement A REPORT HAS A TITLE realised by none, the version history once held UC-009 —; a drafter that first drafts a use case realising A REPORT HAS A TITLE and the unknown name EXPORT AS PDF, then the same without that name
// input: prepareJob of derive-use-cases for the requirement A REPORT HAS A TITLE; runJob unattended
// expect: the parts: the chosen requirement as the SPEC states it, both existing use cases each with its status and as an artifact, chapter 8 of the book; the first draft gets the finding that EXPORT AS PDF matches no requirement [A USE CASE REALISES NAMED REQUIREMENTS], sent back with the draft; two rounds, the second clean, stopped because passed; one commit on trunk holding the use case as an open file under UC-010 (one more than UC-009, which the history held), naming A REPORT HAS A TITLE only, no approval record added, the SPEC byte-identical, the message ending with the provenance lines (two rounds)
test("derive-use-cases — the parts of its recipes, a finding sent back and fixed, one commit of an open file with the provenance lines", async () => {
  const fake = product(PRODUCT, { history: ["docs/use-cases/UC-009-old.md"] });
  const { job, context } = await prepare("derive-use-cases", fake, { requirements: [TITLE] });

  assert.deepEqual(job.blocking, []);
  const byRecipe = (recipe) => job.parts.filter((part) => part.recipe === recipe);
  assert.deepEqual(byRecipe("chosen-requirements").map((part) => [part.name, part.text]),
    [[TITLE, text(`**${TITLE}** *(Product Owner)*`, TITLE_RULE, "*Check:* no automatic check; at review").trimEnd()]]);
  const existing = byRecipe("use-cases");
  assert.deepEqual(existing.map((part) => part.artifacts.map((artifact) => artifact.id)), [["UC-003"], ["UC-007"]]);
  assert.ok(existing[0].name.includes(UC3_PATH) && existing[0].name.includes("open"), existing[0].name);
  assert.ok(existing[1].name.includes(UC7_PATH) && existing[1].name.includes("accepted"), existing[1].name);
  assert.equal(existing[1].text, UC7);
  const [chapter] = byRecipe("chapters-for-requirements");
  assert.ok(chapter.name.startsWith(CHAPTER_8), chapter.name);
  assert.equal(chapter.text, onDisk(`docs/sources/SRC-vibe-coding/2026-10-05/${CHAPTER_8}`));

  const first = { files: [{ path: "docs/use-cases/UC-900-title-a-report.md", class: "new",
    text: useCase({ id: "UC-900", title: "Title a report", realises: [TITLE, "EXPORT AS PDF"], goal: "The author gives the report a title." }) }] };
  const second = { files: [{ ...first.files[0], text: useCase({ id: "UC-900", title: "Title a report", realises: [TITLE], goal: "The author gives the report a title." }) }] };
  const sender = driver([answer(first), answer(second)]);
  const result = await runJob(job, { drafter: sender, reviewers: [] }, { attended: false, context });

  assert.equal(result.stoppedBecause, "passed");
  assert.equal(result.rounds.length, 2);
  const unknown = result.rounds[0].findings.filter((f) => f.rule === "A USE CASE REALISES NAMED REQUIREMENTS");
  assert.equal(unknown.length, 1);
  assert.ok(unknown[0].what.includes("EXPORT AS PDF"), unknown[0].what);
  assert.deepEqual(result.rounds[1].findings, []);
  assert.equal(sender.inputs.length, 2, "the drafter was asked twice");
  assert.deepEqual(sender.inputs[1].findings.map(lineOf), unknown.map(lineOf), "the second time with the finding");
  assert.equal(JSON.parse(sender.inputs[1].previous).files[0].text, first.files[0].text, "and the draft it concerns");
  assert.ok(sender.inputs[0].prompt.includes(TITLE_RULE) && sender.inputs[0].prompt.includes(UC7) && sender.inputs[0].prompt.includes(onDisk(`docs/sources/SRC-vibe-coding/2026-10-05/${CHAPTER_8}`).slice(0, 200)));

  assert.equal(fake.writes.length, 1, "one commit");
  const path = "docs/use-cases/UC-010-title-a-report.md";
  assert.deepEqual(fake.writes[0].files.map((file) => file.path), [path]);
  assert.equal(fake.writes[0].expectedHead, context.product.snapshot.commit);
  assert.equal(fake.files()[path], second.files[0].text.replaceAll("UC-900", "UC-010"));
  assert.equal(fake.files()["SPEC.md"], SPEC);
  assert.equal(unrecorded(fake), 1, "no approval record added: UC-007's stays the only one");
  assert.deepEqual(trailers(fake.writes[0].message), provenance("derive-use-cases", 2));
  assert.deepEqual(result.written.files, [path]);
});

// Module (as the file header stated it): MOD-approvals · MOD-spec-changes · MOD-artifact-edits
// TST-476057 · level: component · module: MOD-approvals
// guards: UC-007; A REVIEWED ARTIFACT ENTERS THE DEFAULT BRANCH AS OPEN
// given: the same product; a drafter that, with a limit of one round, drafts a new use case realising A REPORT HAS A TITLE and EXPORT AS PDF, and a use case of the goal UC-007 already covers — classed a change of UC-007 and drafted as its whole new text — and one that realises nothing
// input: runJob unattended with the limit 1
// expect: stopped because of the limit with the finding left; one commit: the new use case under UC-008 without the name EXPORT AS PDF, the change in UC-007's own file under its own identifier — no UC-011 —, the use case that realises nothing written too; the outcome's notes name the removed name and the use case that realises nothing; the approval record of UC-007 now names an earlier text, so UC-007 counts as changed
test("derive-use-cases — a name left unknown after the last round is removed, a goal already covered becomes a change of its file", async () => {
  const fake = product(PRODUCT);
  const { job, context } = await prepare("derive-use-cases", fake, { requirements: [TITLE] }, 1);
  const changed = useCase({ id: "UC-007", title: "Export a report", realises: [EXPORT], goal: "The author takes the report away as a PDF file.", alternative: "- **2a. The disk is full.** The dashboard says so." });
  const draft = { files: [
    { path: "docs/use-cases/UC-900-title-a-report.md", class: "new", text: useCase({ id: "UC-900", title: "Title a report", realises: [TITLE, "EXPORT AS PDF"], goal: "The author titles a report." }) },
    { path: UC7_PATH, class: "change", of: "UC-007", text: changed },
    { path: "docs/use-cases/UC-901-note-a-report.md", class: "new", text: useCase({ id: "UC-901", title: "Note a report", realises: [], goal: "The author notes a report." }) },
  ] };
  const result = await runJob(job, { drafter: driver([answer(draft)]), reviewers: [] }, { attended: false, context });

  assert.equal(result.stoppedBecause, "limit");
  assert.ok(result.remaining.some((f) => f.what.includes("EXPORT AS PDF")), "the finding is left");
  assert.equal(fake.writes.length, 1);
  const files = Object.fromEntries(fake.writes[0].files.map((file) => [file.path, file.text]));
  assert.deepEqual(Object.keys(files).sort(), [UC7_PATH, "docs/use-cases/UC-008-title-a-report.md", "docs/use-cases/UC-009-note-a-report.md"]);
  assert.equal(files[UC7_PATH], changed);
  assert.ok(!files["docs/use-cases/UC-008-title-a-report.md"].includes("EXPORT AS PDF"));
  assert.ok(files["docs/use-cases/UC-008-title-a-report.md"].includes(`  - ${TITLE}`));
  assert.ok(result.written.notes.some((note) => note.includes("UC-008") && note.includes("EXPORT AS PDF")), result.written.notes.join("|"));
  assert.ok(result.written.notes.some((note) => note.includes("UC-009") && note.includes("realises no requirement")), result.written.notes.join("|"));
  const status = approvals.statuses(await fake.host.readSnapshot("trunk"));
  assert.equal(status.get(UC7_PATH).status, "changed");
  assert.equal(status.get("docs/use-cases/UC-008-title-a-report.md").status, "open");
});

// Module (as the file header stated it): MOD-approvals · MOD-spec-changes · MOD-artifact-edits
// TST-476058 · level: component · module: MOD-approvals
// guards: UC-007; NOTHING IS IMPLEMENTED BEFORE IT IS ACCEPTED
// given: the same product, whose UC-003 is open (no record names its text) and UC-007 accepted
// input: prepareJob of derive-use-cases for the requirement A REPORT HAS A TITLE with the use cases UC-007 and UC-003 as what the job rests on; then for a requirement the SPEC does not hold
// expect: with UC-007 alone it starts (known positive); with UC-003 blocking holds one error under NOTHING IS IMPLEMENTED BEFORE IT IS ACCEPTED naming UC-003; for AN UNWRITTEN RULE the job does not start: preparing rejects with RequirementNotFound naming it
test("derive-use-cases — a job does not start on use cases that are not accepted or on a requirement the SPEC does not hold", async () => {
  const fake = product(PRODUCT);
  assert.deepEqual((await prepare("derive-use-cases", fake, { requirements: [TITLE], useCases: ["UC-007"] })).job.blocking, [], "known positive");
  const { job } = await prepare("derive-use-cases", fake, { requirements: [TITLE], useCases: ["UC-007", "UC-003"] });
  assert.equal(job.blocking.length, 1);
  assert.equal(job.blocking[0].kind, "error");
  assert.equal(job.blocking[0].rule, "NOTHING IS IMPLEMENTED BEFORE IT IS ACCEPTED");
  assert.ok(job.blocking[0].what.includes("UC-003") && !job.blocking[0].what.includes("UC-007"), job.blocking[0].what);
  await assert.rejects(prepare("derive-use-cases", fake, { requirements: ["AN UNWRITTEN RULE"] }), (error) => error.name === "RequirementNotFound" && error.requirements.includes("AN UNWRITTEN RULE"));
});

// ---------------------------------------------------------------- change-use-case (UC-019)

const INSTRUCTION = "add error handling to UC-007";
const WITH_ERRORS = useCase({ id: "UC-007", title: "Export a report", realises: [EXPORT], goal: "The author takes the report away as a PDF file.",
  alternative: "- **1a. The report is empty.** Nothing is written.\n- **2a. The file cannot be written.** The dashboard says why and keeps the report." });

// Module (as the file header stated it): MOD-approvals · MOD-spec-changes · MOD-artifact-edits
// TST-476059 · level: component · module: MOD-artifact-edits
// guards: UC-019; A DRAFT THAT FAILS A CHECK GOES BACK TO ITS PARTICIPANT; AN EDITED FILE KEEPS ITS IDENTIFIER; A REVIEWED ARTIFACT ENTERS THE DEFAULT BRANCH AS OPEN
// given: UC-007 accepted on its text; the instruction "add error handling to UC-007"; a drafter that first returns the use case with the identifier UC-043, then with UC-007 and the alternative flow
// input: prepareJob of change-use-case for UC-007; runJob attended; then writeResult with the draft as the person left it
// expect: parts: the instruction, UC-007 and the requirement it realises with its text from the SPEC, then every other use case, chapter 8; the first draft gets the finding that the identifier changed from UC-007 to UC-043 [AN EDITED FILE KEEPS ITS IDENTIFIER] with the fix keep UC-007, and the check document-schema's finding that UC-043 is not the identifier its path gives [EVERY ARTIFACT HAS AN IDENTIFIER], both sent back; the loop passes in two rounds and, attended, writes nothing; the click writes one commit holding UC-007's file with the drafted text, an open (changed) file whose last accepted text is still the accepted one; the message ends with the six provenance lines, none naming the instruction
test("change-use-case — a changed identifier is sent back, nothing is written until the click, then one open file with the provenance lines", async () => {
  const fake = product(PRODUCT);
  const { job, context } = await prepare("change-use-case", fake, { useCase: "UC-007", instruction: INSTRUCTION });

  assert.deepEqual(job.blocking, []);
  assert.deepEqual(job.parts.map((part) => part.recipe), ["instruction", "use-case-with-neighbours", "use-case-with-neighbours", "use-case-with-neighbours", "chapters-for-requirements"]);
  assert.equal(job.parts[0].text, INSTRUCTION);
  assert.equal(job.parts[1].text, UC7);
  assert.equal(job.parts[2].name, EXPORT);
  assert.ok(job.parts[2].text.includes(EXPORT_RULE));
  assert.equal(job.parts[3].text, UC3);

  const wrongId = WITH_ERRORS.replaceAll("UC-007", "UC-043");
  const drafter = driver([answer({ files: [{ path: UC7_PATH, class: "change", of: "UC-007", text: wrongId }] }),
    answer({ files: [{ path: UC7_PATH, class: "change", of: "UC-007", text: WITH_ERRORS }] })]);
  const result = await runJob(job, { drafter, reviewers: [] }, { attended: true, context });

  assert.equal(result.stoppedBecause, "passed");
  const kept = result.rounds[0].findings.filter((f) => f.rule === "AN EDITED FILE KEEPS ITS IDENTIFIER");
  assert.equal(kept.length, 1);
  assert.ok(kept[0].what.includes("UC-007") && kept[0].what.includes("UC-043"), kept[0].what);
  assert.ok(kept[0].fix.includes("keep the identifier UC-007"), kept[0].fix);
  const againstPath = result.rounds[0].findings.filter((f) => f.rule === "EVERY ARTIFACT HAS AN IDENTIFIER");
  assert.equal(againstPath.length, 1, "MOD-documents' identifier against the path, through the check document-schema");
  assert.ok(againstPath[0].what.includes("UC-043") && againstPath[0].what.includes("UC-007"), againstPath[0].what);
  assert.deepEqual(drafter.inputs[1].findings.map(lineOf), [...againstPath, ...kept].map(lineOf));
  assert.deepEqual(result.rounds[1].findings, []);
  assert.equal(fake.writes.length, 0, "attended, the loop writes nothing");
  assert.equal(result.written, null);

  const written = await writeResult(job, result.draft, { result, context });

  assert.equal(fake.writes.length, 1, "one commit, on the click");
  assert.deepEqual(fake.writes[0].files, [{ path: UC7_PATH, text: WITH_ERRORS }]);
  assert.deepEqual(written.files, [UC7_PATH]);
  assert.deepEqual(trailers(fake.writes[0].message), provenance("change-use-case", 2));
  assert.equal(approvals.statuses(await fake.host.readSnapshot("trunk")).get(UC7_PATH).status, "changed");
  assert.deepEqual(await approvals.lastAcceptedText("UC-007", fake.host), { text: UC7, blob: gitBlob(UC7), path: UC7_PATH });
});

// Module (as the file header stated it): MOD-approvals · MOD-spec-changes · MOD-artifact-edits
// TST-476060 · level: component · module: MOD-artifact-edits
// guards: UC-019; AN EDITED FILE KEEPS ITS IDENTIFIER; A DRAFT THAT FAILS A CHECK GOES BACK TO ITS PARTICIPANT
// given: the same job with a limit of one round and a drafter that keeps the identifier UC-043
// input: runJob attended; the identifier restored with keptIdentifier before the editor opens; writeResult
// expect: the finding is left; keptIdentifier gives the text with `id: UC-007` and every other byte as drafted; the commit holds exactly that text
test("change-use-case — a changed identifier the loop left is restored by keptIdentifier before the file is written", async () => {
  const fake = product(PRODUCT);
  const { job, context } = await prepare("change-use-case", fake, { useCase: "UC-007", instruction: INSTRUCTION }, 1);
  const wrongId = WITH_ERRORS.replace("id: UC-007", "id: UC-043");
  const result = await runJob(job, { drafter: driver([answer({ files: [{ path: UC7_PATH, class: "change", of: "UC-007", text: wrongId }] })]), reviewers: [] }, { attended: true, context });

  assert.equal(result.stoppedBecause, "limit");
  assert.equal(result.remaining.filter((f) => f.rule === "AN EDITED FILE KEEPS ITS IDENTIFIER").length, 1);
  const restored = artifactEdits.keptIdentifier(result.draft.files[0].text, "UC-007");
  assert.equal(restored, WITH_ERRORS);
  await writeResult(job, { files: [{ ...result.draft.files[0], text: restored }] }, { result, context });

  assert.equal(fake.writes.length, 1);
  assert.deepEqual(fake.writes[0].files, [{ path: UC7_PATH, text: WITH_ERRORS }]);
});

// Module (as the file header stated it): MOD-approvals · MOD-spec-changes · MOD-artifact-edits
// TST-476061 · level: component · module: MOD-artifact-edits
// guards: UC-019; A CI AGENT'S DRAFT ENTERS AS OPEN; A REVIEWED ARTIFACT ENTERS THE DEFAULT BRANCH AS OPEN
// given: the same job, run as a CI agent's — not attended — with a drafter that answers the right draft at once
// input: runJob
// expect: the writer commits at once: one commit holding UC-007's file with the drafted text and a provenance line of one round, no approval record added
test("change-use-case — a CI agent's draft is committed at once as an open file", async () => {
  const fake = product(PRODUCT);
  const { job, context } = await prepare("change-use-case", fake, { useCase: "UC-007", instruction: INSTRUCTION });
  const result = await runJob(job, { drafter: driver([answer({ files: [{ path: UC7_PATH, class: "change", of: "UC-007", text: WITH_ERRORS }] })]), reviewers: [] }, { attended: false, context });

  assert.equal(result.stoppedBecause, "passed");
  assert.equal(fake.writes.length, 1);
  assert.deepEqual(fake.writes[0].files, [{ path: UC7_PATH, text: WITH_ERRORS }]);
  assert.deepEqual(trailers(fake.writes[0].message), provenance("change-use-case", 1));
  assert.equal(unrecorded(fake), 1);
});

// ---------------------------------------------------------------- change-requirements (UC-019)

const REQUIREMENTS_INSTRUCTION = "state the export once more";
const OPEN_QUEUE = "docs/spec-freigaben/2026-10-10_pdf-a";
const OPEN_ENTRY = text("## 3. Export", "", "**EXPORT IS A PDF/A** *(Product Owner)*", "A report can be exported as a PDF/A file.", "*Check:* `tests/export-a.test.mjs`");
const QUEUED = { ...PRODUCT,
  [`${OPEN_QUEUE}/index.md`]: text("# SPEC approvals — queue 2026-10-10 · an archive export", "", "**Zieldatei aller Einträge:** `SPEC.md`", "",
    "| Nr | Datei | Anker (Überschrift, wortgetreu) | bis (exklusiv) | Commits |", "|---|---|---|---|---|", "| 01 | `SPEC.md` | ## 3. Export | — | — |"),
  [`${OPEN_QUEUE}/entscheidungen.md`]: text("# Decisions — queue 2026-10-10 pdf-a", "", "Append-only."),
  [`${OPEN_QUEUE}/01-export.md`]: OPEN_ENTRY, [`${OPEN_QUEUE}/01-export.begruendung.md`]: "# 3. Export: an archive export\n" };
const candidate = (fields) => ({ name: EXPORT, rule: EXPORT_RULE, check: "`tests/export.test.mjs`", constrains: "product", passage: "§3 of the instruction", class: "new", of: null,
  source: "SRC-alice", ...fields });

// Module (as the file header stated it): MOD-approvals · MOD-spec-changes · MOD-artifact-edits
// TST-476062 · level: component · module: MOD-spec-changes
// guards: UC-019; A PROMPTED REQUIREMENT CHANGE FOLLOWS THE DERIVATION RULES; A SPEC EDIT IS SAVED AS A PROPOSAL; A DRAFT THAT FAILS A CHECK GOES BACK TO ITS PARTICIPANT
// given: the product with its SPEC and an open queue holding a proposal EXPORT IS A PDF/A; the instruction; the author's own source SRC-alice, which the product links; a drafter that first returns the requirement EXPORT IS A PDF restated word for word and classed new, then that class corrected to a duplicate of EXPORT IS A PDF
// input: prepareJob of change-requirements for EXPORT IS A PDF and A REPORT HAS A TITLE; runJob attended; then writeResult
// expect: parts: the instruction, each named requirement with its whole section byte for byte, the SPEC with its open queue as one part carrying all three requirements as artifacts — the queue's with the state open —, chapter 8; the first round's finding that EXPORT IS A PDF restates the existing requirement but is classed new [EXACT DUPLICATES ARE FOUND WITHOUT A MODEL] with the fix class it as duplicate of EXPORT IS A PDF, sent back with the draft; passed in two rounds, the class a duplicate of EXPORT IS A PDF; nothing written until the click; the click writes one commit holding a new queue under docs/spec-freigaben/ — index, decisions, an entry for the section and its rationale — and no other file: SPEC.md byte-identical, the entry's section the SPEC's own with the source SRC-alice added to EXPORT IS A PDF and no new requirement; the message ending with the provenance lines with the instruction
test("change-requirements — a restated requirement classed new is sent back, the duplicate adds a source in a queue entry, SPEC.md stays", async () => {
  const fake = product(QUEUED);
  const { job, context } = await prepare("change-requirements", fake, { requirements: [EXPORT, TITLE], source: "SRC-alice", instruction: REQUIREMENTS_INSTRUCTION });

  assert.deepEqual(job.blocking, []);
  assert.deepEqual(job.parts.map((part) => part.recipe), ["instruction", "named-requirements", "named-requirements", "spec-with-queues", "chapters-for-requirements"]);
  assert.deepEqual(job.parts.filter((part) => part.recipe === "named-requirements").map((part) => [part.name, part.text]), [[EXPORT, SECTION], [TITLE, SECTION]]);
  const [withQueues] = job.parts.filter((part) => part.recipe === "spec-with-queues");
  assert.deepEqual(withQueues.artifacts.map((artifact) => artifact.id), [EXPORT, TITLE, "EXPORT IS A PDF/A"]);
  assert.ok(withQueues.text.includes("State: open") && withQueues.text.includes("A report can be exported as a PDF/A file."), withQueues.text);

  const drafter = driver([answer({ candidates: [candidate({})] }), answer({ candidates: [candidate({ class: "duplicate", of: EXPORT })] })]);
  const result = await runJob(job, { drafter, reviewers: [] }, { attended: true, context });

  assert.equal(result.stoppedBecause, "passed");
  const duplicate = result.rounds[0].findings.filter((f) => f.rule === "EXACT DUPLICATES ARE FOUND WITHOUT A MODEL");
  assert.equal(duplicate.length, 1);
  assert.ok(duplicate[0].what.includes(EXPORT) && duplicate[0].fix.includes(`class it as duplicate of ${EXPORT}`), lineOf(duplicate[0]));
  assert.deepEqual(drafter.inputs[1].findings.map(lineOf), duplicate.map(lineOf));
  assert.equal(JSON.parse(drafter.inputs[1].previous).candidates[0].class, "new", "with the draft it concerns");
  assert.deepEqual(result.rounds[1].findings, []);
  assert.deepEqual(result.classes.map((each) => [each.refs[0], each.class, each.of]), [[EXPORT, "duplicate", EXPORT]]);
  assert.equal(fake.writes.length, 0, "nothing is written before the click");

  await writeResult(job, result.draft, { result, context });

  assert.equal(fake.writes.length, 1, "one commit");
  const files = Object.fromEntries(fake.writes[0].files.map((file) => [file.path, file.text]));
  assert.ok(Object.keys(files).every((path) => path.startsWith("docs/spec-freigaben/2026-10-12")), Object.keys(files).join(", "));
  assert.ok(Object.keys(files).some((path) => path.endsWith("/index.md")) && Object.keys(files).some((path) => path.endsWith("/entscheidungen.md")));
  assert.equal(fake.files()["SPEC.md"], SPEC, "SPEC.md is byte-identical");
  const proposal = Object.entries(files).find(([path]) => /\/01-[^/]*\.md$/.test(path) && !path.endsWith(".begruendung.md"))[1];
  assert.ok(proposal.startsWith("## 3. Export\n"));
  assert.ok(/\*\*EXPORT IS A PDF\*\* \*\(Product Owner[^)]*SRC-alice[^)]*\)\*/.test(proposal), `the source SRC-alice added to EXPORT IS A PDF:\n${proposal}`);
  assert.equal(proposal.replace(/\*\*EXPORT IS A PDF\*\* \*\([^)]*\)\*/, `**${EXPORT}** *(Product Owner)*`), SECTION, "every other byte of the section as it was");
  assert.deepEqual(trailers(fake.writes[0].message), provenance("change-requirements", 2));
});

// Module (as the file header stated it): MOD-approvals · MOD-spec-changes · MOD-artifact-edits
// TST-476063 · level: component · module: MOD-spec-changes
// guards: UC-019; A CHANGE IS PROPOSED UNDER THE EXISTING NAME; A PROMPTED REQUIREMENT CHANGE FOLLOWS THE DERIVATION RULES; A SPEC EDIT IS SAVED AS A PROPOSAL
// given: the same job; a drafter that returns, at once, A REPORT HAS A TITLE with a new rule under its existing name, classed a change of A REPORT HAS A TITLE (the prompt asks for a change to "keep that name")
// input: runJob attended; writeResult
// expect: the loop passes in one round — a change keeps the name of the requirement it changes, so the name alone is no finding —; the click writes a queue entry whose section holds the new rule under the existing name; SPEC.md byte-identical
test("change-requirements — a change under the existing name passes the loop and is written as a queue entry", { todo: "FINDING ITM-369-1 — classifyCandidates (src/documents/candidates.mjs) takes a name that equals an existing requirement's as an exact duplicate, whatever class was proposed: candidate-classes (src/job-runner/builtins.mjs) sends every change back with 'class it as duplicate of <its own name>', and the writer composes a duplicate (a source added) not the new rule, so no change under the existing name can pass the loop or be written; EXACT DUPLICATES ARE FOUND WITHOUT A MODEL (name or rule) and A CHANGE IS PROPOSED UNDER THE EXISTING NAME cannot both hold" }, async () => {
  const fake = product(QUEUED);
  const { job, context } = await prepare("change-requirements", fake, { requirements: [TITLE], source: "SRC-alice", instruction: REQUIREMENTS_INSTRUCTION });
  const change = candidate({ name: TITLE, rule: "Every report shows its title on the first page.", check: "no automatic check; at review", class: "change", of: TITLE });
  const result = await runJob(job, { drafter: driver([1, 2, 3, 4, 5].map(() => answer({ candidates: [change] }))), reviewers: [] }, { attended: true, context });

  assert.equal(result.stoppedBecause, "passed", JSON.stringify(result.rounds.map((round) => round.findings.map(lineOf))));
  assert.equal(result.rounds.length, 1);
  await writeResult(job, result.draft, { result, context });
  assert.equal(fake.writes.length, 1);
  const proposal = fake.writes[0].files.find((file) => /\/01-[^/]*\.md$/.test(file.path) && !file.path.endsWith(".begruendung.md")).text;
  assert.ok(proposal.includes(`**${TITLE}**`) && proposal.includes("Every report shows its title on the first page."));
  assert.ok(!proposal.includes(TITLE_RULE));
  assert.equal(fake.files()["SPEC.md"], SPEC);
});

// Module (as the file header stated it): MOD-approvals · MOD-spec-changes · MOD-artifact-edits
// TST-476064 · level: component · module: MOD-spec-changes
// guards: UC-019; A CI AGENT'S DRAFT ENTERS AS OPEN; A SPEC EDIT IS SAVED AS A PROPOSAL; A PROMPTED REQUIREMENT CHANGE FOLLOWS THE DERIVATION RULES
// given: the same job run as a CI agent's — not attended — with a drafter that answers at once the duplicate of EXPORT IS A PDF with the author's source, and a new requirement that points to a source the product does not link
// input: runJob
// expect: the writer commits at once a new queue and nothing else, SPEC.md byte-identical; the new requirement that points to SRC-unlinked is not written and the outcome's notes name it with that source
test("change-requirements — a CI agent's draft enters as a queue, and a candidate from a source the product does not link is not written", async () => {
  const fake = product(QUEUED);
  const { job, context } = await prepare("change-requirements", fake, { requirements: [EXPORT], source: "SRC-alice", instruction: REQUIREMENTS_INSTRUCTION });
  const duplicate = candidate({ class: "duplicate", of: EXPORT });
  const stranger = candidate({ name: "A REPORT HAS A FOOTER", rule: "Every report shows a footer.", check: "no automatic check; at review", source: "SRC-unlinked" });
  const result = await runJob(job, { drafter: driver([answer({ candidates: [duplicate, stranger] })]), reviewers: [] }, { attended: false, context });

  assert.equal(result.stoppedBecause, "passed");
  assert.equal(fake.writes.length, 1);
  assert.ok(fake.writes[0].files.every((file) => file.path.startsWith("docs/spec-freigaben/")));
  assert.equal(fake.files()["SPEC.md"], SPEC);
  assert.ok(fake.writes[0].files.every((file) => !file.text.includes("A REPORT HAS A FOOTER")), "the stranger is not written");
  assert.ok(result.written.notes.some((note) => note.includes("A REPORT HAS A FOOTER") && note.includes("SRC-unlinked")), result.written.notes.join("|"));
  assert.deepEqual(trailers(fake.writes[0].message), provenance("change-requirements", 1));
});
