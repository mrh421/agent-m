// Appending to a job's record, and taking a job (ITM-317) — MOD-job-ledger's appendToRecord and takeJob, as the accepted text of
// docs/architecture/MOD-job-ledger.md states them: appendToRecord(text, part) is the record with the part appended after its last
// section, every byte before it unchanged, each kind of part in the form the record's schema reads back, an End with its round
// record in MOD-job-runner's roundsText form, which the reader now reads back into the End's `rounds`; it throws RecordEnded for
// a record that has its end and NotWaiting for a resumption of a job that is not at a gate. takeJob(host, path, by, head) reads
// the record at `head`, appends `Taken` and commits only on that head; when the branch moved, it reads the record again and takes
// the job on the new head or reports who took it. The routes that call them (ITM-319, ITM-327, ITM-365) are not part of this item.
// Run: node --test tests/job-ledger-append.test.mjs
//
// Module: MOD-job-ledger
// Guards: UC-005; UC-007; UC-010; UC-011; UC-019; A JOB IS RECORDED IN ITS PRODUCT REPOSITORY; A RECORD IS EVIDENCE, NOT A PROPOSAL
// Guards: A REMOTE INTERFACE NAMES HOW IT FAILS; THE ROUNDS ARE COUNTED AND SHOWN
// Level: unit
//
// A record is made with startRecord and read back as every caller reads it, with recordsNewestFirst over a snapshot that holds
// it. The repository server is replaced by a fixture: a fake host that keeps to MOD-repository-hosts' interface as docs/
// architecture/MOD-repository-hosts.md states it — one repository in memory, whose default branch is `trunk`; repositoryInfo,
// readSnapshot (the repository at the branch or at a commit) and commitFiles, a commit of its files made only if the branch still
// stands at the expected head, else `Moved { head }` —; every commit attempt recorded, and a hook that lets another writer's
// commit land just before the first attempt. The module file does not say what an End's `rounds` hold when they are read back, nor
// what writes the lines of roundsText that a Round does not hold: this file reads back the rounds as `{ number, findings, answers
// }` (a Round's `changed` is not in the record's form), and takes of an End part the optional `stoppedBecause` and `forPerson`
// beside its `rounds` — without `stoppedBecause`, `passed` for rounds whose last has no finding, else `limit` —, what is left
// being the last round's findings unless the loop passed, as MOD-job-runner's loop leaves it. Nothing reaches the network. Each
// test states its input and its expected result before it runs (given / input / expect). The counter-proofs are recorded in the
// pull request.

import test, { mock } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import * as ledger from "../src/job-ledger/index.mjs";
import { roundsText } from "../src/job-runner/index.mjs";
import { finding } from "../src/text-tools/index.mjs";

// A name the module does not provide yet is undefined here, so that each test fails by itself and not the whole file at once.
const { startRecord, recordsNewestFirst, jobState, appendToRecord, takeJob } = ledger;

// ---------------------------------------------------------------- the record

const START = {
  id: "JOB-20261007-0900-a1b2", kind: "derive-use-cases", worksOn: ["EXPORT IS A PDF"], participant: "drafter-a",
  model: "example-model", route: "tab", run: null, retries: null, startedBy: "alice",
  start: new Date("2026-10-07T09:00:00Z"), agentM: { version: "2026.10.0", commit: "abc123def456" },
  inputs: ["SPEC.md@deadbeefcafe"], limit: 5,
  destinations: [{ participant: "drafter-a", place: "this machine", parts: ["the chosen requirements", "every use case"] }],
  params: { requirements: ["EXPORT IS A PDF"] },
};
const { path: PATH, text: QUEUED } = startRecord(START);
// A moment of that morning, to the minute: the record writes a time to the minute.
const at = (minute) => new Date(Date.UTC(2026, 9, 7, 9, minute));

// The record a text holds, read as every caller reads it.
async function recordOf(text) {
  for await (const record of recordsNewestFirst({ paths: [PATH], read: async () => text })) return record;
  return null;
}

const one = (n) => finding({ artifact: "UC-007", line: 12, kind: "error", rule: "A USE CASE REALISES NAMED REQUIREMENTS",
  what: `realises "EXPORT AS PDF ${n}" matches no requirement`, fix: "use an existing name or remove the line" });
const two = finding({ artifact: "SPEC", line: 3, kind: "warning", rule: "ONE STATEMENT PER REQUIREMENT",
  what: 'rule contains "and"', fix: "split it, or keep it and give a one-line reason" });

// ---------------------------------------------------------------- appendToRecord: each kind of part

// TST-472291 · level: unit · module: MOD-job-ledger
// guards: A RECORD IS EVIDENCE, NOT A PROPOSAL; A JOB IS RECORDED IN ITS PRODUCT REPOSITORY; UC-010; UC-011
// given: the start of a record, and in turn each kind of part — Taken; a named gate reached; Resumed; a question to the author; Resumed; Job started; Limits raised with a cost and one without; End done with results, a draft, usage, a cost and a log
// input: appendToRecord(text, part) for each, on the text the one before gave
// expect: each time a text that begins with the whole text before it and is longer, whose reading gives the part back — taken { at, by }; the gate with its decider and, once resumed, the record that resumed it; the question as the record's question, until it is resumed; the job started; the limits, a missing cost as null; the End with its state, results, draft, usage, cost, no reason and its log — and a state `done` at the end
test("appendToRecord — each kind of part appended after the last section, the bytes before it unchanged, and read back as the same part", async () => {
  const cost = { known: true, amount: 0.42, currency: "EUR", basis: "reported" };
  const usage = { inputTokens: 1200, outputTokens: 300 };
  const steps = [
    [{ part: "taken", at: at(1), by: "tab" }, (r) => assert.deepEqual(r.taken, { at: at(1), by: "tab" })],
    [{ part: "gate reached", at: at(2), gate: "before-write", decider: "person" },
      (r) => assert.deepEqual(r.gates, [{ at: at(2), gate: "before-write", decider: "person", resumedBy: null }])],
    [{ part: "resumed", at: at(3), gateRecord: "docs/approvals/UC-007-0123456789ab.md" },
      (r) => assert.equal(r.gates[0].resumedBy, "docs/approvals/UC-007-0123456789ab.md")],
    [{ part: "question", at: at(4), question: "Which format should the export have?" },
      (r) => assert.equal(r.question, "Which format should the export have?")],
    [{ part: "resumed", at: at(5), gateRecord: "docs/approvals/UC-007-ba9876543210.md" }, (r) => assert.equal(r.question, null)],
    [{ part: "job started", at: at(6), job: "JOB-20261007-0906-beef", kind: "write-tests", worksOn: ["EXPORT IS A PDF", "UC-007"] },
      (r) => assert.deepEqual(r.jobs, [{ at: at(6), job: "JOB-20261007-0906-beef", kind: "write-tests",
        worksOn: ["EXPORT IS A PDF", "UC-007"] }])],
    [{ part: "limits raised", at: at(7), by: "alice", limits: { jobsAtOnce: 2, cost: 5, rounds: 3 } },
      (r) => assert.deepEqual(r.limitsRaised, [{ at: at(7), by: "alice", limits: { jobsAtOnce: 2, cost: 5, rounds: 3 } }])],
    [{ part: "limits raised", at: at(8), by: "bob", limits: { jobsAtOnce: 4, cost: null, rounds: 5 } },
      (r) => assert.deepEqual(r.limitsRaised[1], { at: at(8), by: "bob", limits: { jobsAtOnce: 4, cost: null, rounds: 5 } })],
    [{ part: "end", at: at(9), state: "done", results: ["0123abc", "waits for a person"], draft: { cases: [1, 2] }, rounds: [],
      usage, cost, reason: null, log: "https://github.com/alice/product/actions/runs/1" },
    (r) => assert.deepEqual(r.end, { at: at(9), state: "done", results: ["0123abc", "waits for a person"], draft: { cases: [1, 2] },
      rounds: [], usage, cost, reason: null, log: "https://github.com/alice/product/actions/runs/1" })],
  ];
  let text = QUEUED;
  for (const [part, check] of steps) {
    const next = appendToRecord(text, part);

    assert.ok(next.startsWith(text) && next.length > text.length, `${part.part}: the bytes before the part stand`);
    check(await recordOf(next));
    text = next;
  }
  assert.equal(jobState(await recordOf(text), null), "done");
});

// TST-1302006 · level: unit · module: MOD-job-ledger
// guards: A JOB IS RECORDED IN ITS PRODUCT REPOSITORY; A RECORD IS EVIDENCE, NOT A PROPOSAL; UC-007
// given: one End with two writer notes, one of them holding commas and quotes; and one End without notes
// input: appendToRecord(QUEUED, End), then the record read back
// expect: the End with notes reads back both notes byte for byte, without splitting at commas or losing quotes; the End without notes reads as the old End shape, with no notes field added
test("appendToRecord — an End's writer notes keep commas and quotes, and no notes reads as before", async () => {
  const cost = { known: false, usage: null };
  const notes = [
    'UC-007 realised "EXPORT, PDF", which matches no requirement; removed',
    'UC-008 realises no requirement, "kept" by the writer',
  ];
  const end = { part: "end", at: at(9), state: "done", results: ["commit c0ffee"], draft: null, rounds: [],
    usage: null, cost, reason: null, log: null };

  const withNotes = await recordOf(appendToRecord(QUEUED, { ...end, notes }));
  assert.deepEqual(withNotes.end.results, ["commit c0ffee"]);
  assert.deepEqual(withNotes.end.notes, notes);

  const withoutNotes = await recordOf(appendToRecord(QUEUED, end));
  assert.deepEqual(withoutNotes.end, { at: at(9), state: "done", results: ["commit c0ffee"], draft: null, rounds: [],
    usage: null, cost, reason: null, log: null });
});

// TST-472292 · level: unit · module: MOD-job-ledger
// guards: THE ROUNDS ARE COUNTED AND SHOWN; A RECORD IS EVIDENCE, NOT A PROPOSAL; UC-019
// given: a record taken by its route; an End failed with a reason and no result, with rounds the correction loop made — (1) two rounds: the first with two findings, one fixed and one justified with its line, the second with none, and no stoppedBecause; (2) two rounds the second of which has a finding the drafter answered, the loop stopped at its limit, and a finding a person decides; (3) two rounds whose last still shows a warning the drafter justified before, and the loop passed
// input: appendToRecord(taken, End) for each, then the record read back
// expect: the End's text ends with MOD-job-runner's roundsText of those rounds, of what is left — none for (1) and (3), the last round's finding for (2) —, of what a person decides, of why the loop stopped (passed for (1) and (3), limit for (2)) and of the record's limit; read back, the End's rounds are the two rounds, each with its number, findings and answers — `justified` and `answered` with their text, `fixed` without —; the End's draft is still read, and an End with no round has no round record
test("appendToRecord — an End with two rounds writes the round record, and the reader reads the rounds back", async () => {
  const taken = appendToRecord(QUEUED, { part: "taken", at: at(1), by: "tab" });
  const end = { part: "end", at: at(9), state: "failed", results: [], draft: { cases: [] }, usage: null,
    cost: { known: false, usage: null }, reason: "the loop stopped", log: null };
  const first = [
    { number: 1, findings: [one(1), two], answers: [{ finding: one(1), how: "fixed", text: null },
      { finding: two, how: "justified", text: "the two clauses name one condition." }], changed: true },
    { number: 2, findings: [], answers: [], changed: true },
  ];
  const second = [
    { number: 1, findings: [one(1)], answers: [{ finding: one(1), how: "fixed", text: null }], changed: true },
    { number: 2, findings: [one(2)], answers: [{ finding: one(2), how: "answered", text: "the reviewer misread the rule." }],
      changed: true },
  ];
  const third = [
    { number: 1, findings: [two], answers: [{ finding: two, how: "justified", text: "the two clauses name one condition." }], changed: true },
    { number: 2, findings: [two], answers: [], changed: false },
  ];
  const decided = finding({ artifact: "SPEC", line: 9, kind: "warning", rule: "A REQUIREMENT HAS A REGISTERED SOURCE",
    what: "no source item names a source the product links", fix: "name one" });

  const passed = appendToRecord(taken, { ...end, rounds: first });
  const limited = appendToRecord(taken, { ...end, rounds: second, stoppedBecause: "limit", forPerson: [decided] });
  const settled = appendToRecord(taken, { ...end, rounds: third, stoppedBecause: "passed" });

  assert.ok(passed.endsWith(roundsText(first, [], [], "passed", START.limit)), "(1) the round record, as roundsText writes it");
  assert.ok(limited.endsWith(roundsText(second, [one(2)], [decided], "limit", START.limit)), "(2) the round record, as roundsText writes it");
  assert.ok(settled.endsWith(roundsText(third, [], [], "passed", START.limit)), "(3) a justified warning is not what is left");
  for (const [text, rounds] of [[passed, first], [limited, second], [settled, third]]) {
    const read = await recordOf(text);
    assert.deepEqual(read.end.rounds, rounds.map(({ number, findings, answers }) => ({ number, findings, answers })));
    assert.deepEqual(read.end.draft, { cases: [] });
    assert.equal(read.end.state, "failed");
    assert.equal(read.end.reason, "the loop stopped");
  }
  const bare = appendToRecord(taken, { ...end, rounds: [] });
  assert.ok(!bare.includes("## Rounds"), "an End with no round has no round record");
  assert.deepEqual((await recordOf(bare)).end.rounds, []);
});

// TST-472293 · level: unit · module: MOD-job-ledger
// guards: A RECORD IS EVIDENCE, NOT A PROPOSAL; A REMOTE INTERFACE NAMES HOW IT FAILS; UC-010
// given: a record that has its End; a record not at a gate; a record whose gate is resumed; and, as the known positives, a record at a named gate and one at a question
// input: appendToRecord of a Taken, a Job started and a second End to the ended record; of a Resumed to each of the other three — and to each of the two at a gate
// expect: RecordEnded for each part to the ended record; NotWaiting for a Resumed to a record not at a gate and to one whose gate is resumed already; the Resumed is appended to a record at a named gate and to one at a question
test("appendToRecord — RecordEnded for a record that has its end, NotWaiting for a resumption of a job not at a gate", async () => {
  const taken = appendToRecord(QUEUED, { part: "taken", at: at(1), by: "tab" });
  const ended = appendToRecord(taken, { part: "end", at: at(2), state: "cancelled", results: [], draft: null, rounds: [], usage: null,
    cost: { known: false, usage: null }, reason: "cancelled by alice", log: null });
  const atGate = appendToRecord(taken, { part: "gate reached", at: at(3), gate: "before-write", decider: "person" });
  const atQuestion = appendToRecord(taken, { part: "question", at: at(3), question: "Which?" });
  const resume = { part: "resumed", at: at(4), gateRecord: "docs/approvals/UC-007-0123456789ab.md" };
  const resumed = appendToRecord(atGate, resume);

  assert.ok(appendToRecord(atGate, resume).length > atGate.length, "known positive: a named gate is resumed");
  assert.ok(appendToRecord(atQuestion, resume).length > atQuestion.length, "known positive: a question is resumed");
  for (const part of [{ part: "taken", at: at(5), by: "tab" }, { part: "job started", at: at(5), job: "JOB-20261007-0905-beef",
    kind: "write-tests", worksOn: ["UC-007"] }, { part: "end", at: at(5), state: "done", results: [], draft: null, rounds: [],
    usage: null, cost: { known: false, usage: null }, reason: null, log: null }]) {
    assert.throws(() => appendToRecord(ended, part), { name: "RecordEnded" }, `${part.part} to an ended record`);
  }
  assert.throws(() => appendToRecord(ended, resume), { name: "RecordEnded" }, "resumed to an ended record");
  assert.throws(() => appendToRecord(taken, resume), { name: "NotWaiting" }, "no gate reached");
  assert.throws(() => appendToRecord(resumed, resume), { name: "NotWaiting" }, "the gate is resumed already");
});

// ---------------------------------------------------------------- takeJob

// A failure as MOD-repository-hosts names it: an error with the failure's name and its fields.
const failure = (name, fields = {}) => Object.assign(new Error(`${name} ${JSON.stringify(fields)}`), { name }, fields);
const sha = (n) => createHash("sha1").update(`commit ${n}`).digest("hex");

// The fake host. files: the default branch `trunk` at its head, { path: text }. beforeFirstCommit(fake): called once, as the first
// commit attempt arrives — another writer's commit lands then.
function fakeHost({ files, beforeFirstCommit = null, refuse = null }) {
  const commits = new Map(), attempts = [];
  let made = 0, head = null, hook = beforeFirstCommit;
  const commitOf = (tree) => {
    const id = sha(++made);
    commits.set(id, tree);
    return id;
  };
  head = commitOf(new Map(Object.entries(files)));
  const fake = {
    attempts,
    head: () => head,
    firstHead: sha(1),
    textAt: (ref, path) => commits.get(ref === "trunk" ? head : ref).get(path),
    // Another writer's commit on `trunk`: each path set to the text its function gives of the text it holds.
    land(changes) {
      const tree = new Map(commits.get(head));
      for (const [path, change] of Object.entries(changes)) tree.set(path, change(tree.get(path)));
      head = commitOf(tree);
    },
    host: {
      async repositoryInfo() {
        return { defaultBranch: "trunk", visibility: "public", canWrite: true, archived: false, description: "" };
      },
      async readSnapshot(ref) {
        const id = ref === "trunk" ? head : ref;
        if (!commits.has(id)) throw failure("NotFound", { what: ref });
        const tree = commits.get(id);
        return { ref, commit: id, paths: [...tree.keys()].sort(), read: async (path) => (tree.has(path) ? tree.get(path) : null),
          blob: () => null };
      },
      async commitFiles(change) {
        attempts.push(structuredClone(change));
        if (attempts.length > 10) throw new Error("the host is asked again and again");
        if (hook) { const then = hook; hook = null; then(fake); }
        if (refuse) throw refuse;
        if (change.branch !== "trunk" || change.expectedHead !== head) throw failure("Moved", { head });
        head = commitOf(new Map([...commits.get(head), ...change.files.map((file) => [file.path, file.text])]));
        return { commit: head, url: `https://github.com/alice/product/commit/${head}` };
      },
    },
  };
  return fake;
}

const NOW = new Date("2026-10-12T08:30:45Z");

// TST-472294 · level: unit · module: MOD-job-ledger
// guards: A JOB IS RECORDED IN ITS PRODUCT REPOSITORY; A RECORD IS EVIDENCE, NOT A PROPOSAL; UC-010; UC-011
// given: a product on GitHub whose default branch `trunk` holds the record of a queued job, and the head the route read
// input: takeJob(host, path, "https://github.com/alice/product/actions/runs/7", head), with the clock at 08:30 UTC
// expect: { taken: true, commit: the commit the host made }; one commit attempt, on `trunk`, on the head that was read, holding the record alone — the text it had with a `## Taken` appended: at 08:30 and by the route, the bytes before unchanged —; read back, the job is taken by that route and is running
test("takeJob — a job taken with one commit on the head that was read", async () => {
  mock.timers.enable({ apis: ["Date"], now: NOW });
  try {
    const fake = fakeHost({ files: { "README.md": "# Product\n", [PATH]: QUEUED } });
    const by = "https://github.com/alice/product/actions/runs/7";

    const result = await takeJob(fake.host, PATH, by, fake.head());

    assert.deepEqual(result, { taken: true, commit: fake.head() });
    assert.equal(fake.attempts.length, 1, "one commit attempt");
    const [attempt] = fake.attempts;
    assert.equal(attempt.branch, "trunk");
    assert.equal(attempt.expectedHead, fake.firstHead);
    assert.deepEqual(attempt.files.map((file) => file.path), [PATH]);
    assert.equal(attempt.files[0].text, appendToRecord(QUEUED, { part: "taken", at: NOW, by }));
    assert.match(attempt.message, /\S/);
    const record = await recordOf(fake.textAt("trunk", PATH));
    assert.deepEqual(record.taken, { at: new Date("2026-10-12T08:30:00Z"), by });
    assert.equal(jobState(record, null), "running");
  } finally {
    mock.timers.reset();
  }
});

// TST-472295 · level: unit · module: MOD-job-ledger
// guards: A JOB IS RECORDED IN ITS PRODUCT REPOSITORY; A RECORD IS EVIDENCE, NOT A PROPOSAL; A REMOTE INTERFACE NAMES HOW IT FAILS; UC-010; UC-011
// given: the same product, in which another writer's commit lands on `trunk` just before the route's commit — (1) one that appends a gate to the record, which does not take the job; (2) one that appends a Taken by the Bridge "bridge-a"; and (3) a record that the Bridge had taken already at the head the route read; and (4) a host that refuses the commit with TokenRefused; and (5) a host that answers every commit with Moved naming the head the commit was made on
// input: takeJob(host, path, "tab", the head first read)
// expect: (1) { taken: true, commit }, after a first attempt on the old head that the host refused with Moved and a second on the new head, whose record text is the new head's with `## Taken` appended — the gate stays —; (2) { taken: false, by: "bridge-a" } after the one refused attempt, and no second; (3) { taken: false, by: "bridge-a" } with no attempt at all; (4) it rejects with that TokenRefused; (5) it rejects with that Moved after the one attempt, and does not ask again
test("takeJob — on a moved head, taken on the new head, or reported as taken by the participant that did", async () => {
  mock.timers.enable({ apis: ["Date"], now: NOW });
  try {
    const gate = { part: "gate reached", at: at(20), gate: "before-write", decider: "person" };
    const bridge = { part: "taken", at: at(21), by: "bridge-a" };

    const moved = fakeHost({ files: { [PATH]: QUEUED }, beforeFirstCommit: (f) => f.land({ [PATH]: (text) => appendToRecord(text, gate) }) });
    const first = await takeJob(moved.host, PATH, "tab", moved.firstHead);
    assert.deepEqual(first, { taken: true, commit: moved.head() });
    assert.equal(moved.attempts.length, 2, "(1) the refused attempt and the one on the new head");
    assert.equal(moved.attempts[0].expectedHead, moved.firstHead);
    assert.equal(moved.attempts[1].expectedHead, sha(2), "(1) on the head the branch had moved to");
    const withGate = appendToRecord(QUEUED, gate);
    assert.equal(moved.attempts[1].files[0].text, appendToRecord(withGate, { part: "taken", at: NOW, by: "tab" }));

    const lost = fakeHost({ files: { [PATH]: QUEUED }, beforeFirstCommit: (f) => f.land({ [PATH]: (text) => appendToRecord(text, bridge) }) });
    assert.deepEqual(await takeJob(lost.host, PATH, "tab", lost.firstHead), { taken: false, by: "bridge-a" });
    assert.equal(lost.attempts.length, 1, "(2) no second attempt");
    assert.equal((await recordOf(lost.textAt("trunk", PATH))).taken.by, "bridge-a", "(2) the record is the Bridge's");

    const already = fakeHost({ files: { [PATH]: appendToRecord(QUEUED, bridge) } });
    assert.deepEqual(await takeJob(already.host, PATH, "tab", already.firstHead), { taken: false, by: "bridge-a" });
    assert.equal(already.attempts.length, 0, "(3) nothing is committed");

    const refusal = failure("TokenRefused", { tokenName: "Agent M · alice/product", renewal: "https://github.com/settings/personal-access-tokens" });
    const refused = fakeHost({ files: { [PATH]: QUEUED }, refuse: refusal });
    await assert.rejects(takeJob(refused.host, PATH, "tab", refused.firstHead), (error) => error === refusal);

    const stuck = failure("Moved", { head: sha(1) });
    const broken = fakeHost({ files: { [PATH]: QUEUED }, refuse: stuck });
    await assert.rejects(takeJob(broken.host, PATH, "tab", broken.firstHead), (error) => error === stuck);
    assert.equal(broken.attempts.length, 1, "(5) one attempt");
  } finally {
    mock.timers.reset();
  }
});
