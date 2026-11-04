// Release coverage for UC-038 "Turn mails into issues". The release-level guard that every requirement UC-038 realises with an automatic check is covered by executable evidence, that the system tests walk the main flow and every
// alternative flow the item names — 2a, 4b, 4c, 6a, 6c, 7a, 7b and 8a — and, for the requirements that concern what a whole session does with a mailbox, its mails, its participants and the tracker, release cases that run the page over the fixtures:
// a whole session leaves the mails in the mailbox and in no write of Agent M that names a sender, a name, a subject or a sentence of a mail, the issues carry the identifiers and the labels, and a participant at a place the mailbox does not allow
// receives nothing.
// Run: node --test tests/release-uc-038-turn-mails-into-issues.test.mjs
//
// Module: MOD-maintenance-pages
// Guards: UC-038
// Level: release
//
// Input: docs/use-cases/UC-038-turn-mails-into-issues.md, SPEC.md, the two system tests of UC-038, the files that already check the requirements, and the fixtures of tests/uc-039-world.mjs and tests/maintenance-pages-world.mjs. Written for ITM-965 by
// a participant who built none of ITM-963 and ITM-964 (RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER). Where a file the SPEC names as a check does not exist, the finding is marked a todo, as the release tests of UC-049 mark theirs.
// The counter-proofs are recorded in the pull request.

import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { testDeclarations } from "../src/test-document/index.mjs";
import { PRODUCT_URL, buttonsOf, byClass, flush, issueRecord, itemOf, mailOf, one, restoreWorld, textOf, trusted, waitFor, walk } from "./maintenance-pages-world.mjs";
import { graphWrites, lastly, openReplies, rawMail, writes } from "./uc-039-world.mjs";

afterEach(() => { if (globalThis.document) restoreWorld(); });

const ROOT = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, ROOT), "utf8");
const GRAPH_SYSTEM = "tests/system-uc-038-turn-mails-into-issues.test.mjs";
const BRIDGE_SYSTEM = "tests/system-uc-038-bridge-route.test.mjs";

function ucRealises() {
  const names = [];
  let inRealises = false;
  for (const line of read("docs/use-cases/UC-038-turn-mails-into-issues.md").split("\n")) {
    if (line === "realises:") { inRealises = true; continue; }
    if (!inRealises) continue;
    if (line.startsWith("  - ")) names.push(line.slice(4));
    else if (line === "---") break;
  }
  return names;
}

function specChecks() {
  const checks = new Map();
  const pattern = /^\*\*(.+?)\*\*[\s\S]*?\*Check:\* ([^\n]*(?:\n(?!\*\*|## ).*)*)/gm;
  let match;
  while ((match = pattern.exec(read("SPEC.md")))) checks.set(match[1], match[2].replace(/\s+/g, " ").trim());
  return checks;
}

// The files the SPEC names as the check of a requirement of UC-038 and that this repository does not hold.
const MISSING_CHECKS = {};
const REVIEW_ONLY = ["ONE CLICK PER DECISION"];

// TST-965201 · level: release · module: MOD-maintenance-pages
// guards: UC-038; RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER
// given: UC-038's `realises` list, SPEC's current Check lines, the two system tests of UC-038 and the files that check the requirements
// input: compare the realised requirements with the SPEC's Check lines; read the declarations of the system tests
// expect: every realised requirement is checked at review only, or its Check names files that exist — a system test of UC-038 among the evidence, each with a level — or a file listed as missing; the system tests declare the main flow and each alternative flow the item names: 2a, 4b, 4c, 6a, 6c, 7a, 7b, 8a
test("TST-965201: UC-038 release coverage names every automatic requirement and the system tests walk every flow", () => {
  const realised = ucRealises();
  const checks = specChecks();
  assert.equal(realised.length, 29, "known positive: the use case realises twenty-nine requirements");
  assert.deepEqual([...new Set(realised)].sort(), realised.toSorted(), "the use case realises each requirement once");
  const reviewOnly = realised.filter((name) => /^no automatic check; at review/.test(checks.get(name) ?? ""));
  assert.deepEqual(REVIEW_ONLY.toSorted(), reviewOnly.toSorted());
  const missing = Object.values(MISSING_CHECKS).flat();
  for (const requirement of realised.filter((name) => !reviewOnly.includes(name))) {
    const named = (checks.get(requirement) ?? "").match(/tests\/[A-Za-z0-9_.-]+/g) ?? [];
    assert.ok(named.length > 0, `${requirement}: the SPEC names a check`);
    for (const file of named) {
      if (Object.hasOwn(MISSING_CHECKS, file)) {
        assert.ok(!existsSync(new URL(file, ROOT)), `${file} is listed as missing, but exists: list it as evidence of ${requirement}`);
        assert.ok(MISSING_CHECKS[file].includes(requirement));
        continue;
      }
      assert.ok(existsSync(new URL(file, ROOT)), `${requirement}: ${file} exists`);
      assert.match(read(file), /Level: (unit|component|system|release)|level: (unit|component|system|release)/i, `${file} declares its level`);
    }
  }
  assert.deepEqual(missing, [], "no requirement of UC-038 names a check that is listed as missing");
  const declarations = [GRAPH_SYSTEM, BRIDGE_SYSTEM].flatMap((file) => testDeclarations(file, read(file)));
  assert.ok(declarations.length >= 12, "known positive: the declarations of the system tests are found");
  const declared = declarations.map((one) => `${one.guards.join("; ")} ${one.given ?? ""} ${one.input ?? ""} ${one.expect ?? ""}`).join("\n");
  for (const phrase of ["UC-038 main flow", ...["2a", "4b", "4c", "6a", "6c", "7a", "7b", "8a"].map((flow) => `UC-038 alternative ${flow}`)]) {
    assert.ok(declared.includes(phrase), `the system tests declare ${phrase}`);
  }
  assert.ok(declarations.every((one) => one.level === "system"), "every declaration of the system tests is level system");
});

// TST-965202 · level: release · module: MOD-maintenance-pages
// guards: UC-038
// given: the SPEC's Check lines of the requirements UC-038 realises
// input: look for each file they name
// expect: every file exists
test("TST-965202: the checks the SPEC names for the requirements of UC-038 exist", () => {
  const checks = specChecks();
  const files = new Set(ucRealises().flatMap((name) => (checks.get(name) ?? "").match(/tests\/[A-Za-z0-9_.-]+/g) ?? []));
  assert.ok(files.size > 10, "known positive: the use case names checks");
  for (const file of files) assert.ok(existsSync(new URL(file, ROOT)), `${file} exists`);
});

// The needles: a sender's name and address, a subject and a sentence that appear in the mails and in nothing Agent M writes.
const NEEDLES = ["Erika", "Mustermann", "erika@example.invalid", "NEEDLE-SUBJECT-965", "NEEDLE-SENTENCE-965", "Kind regards"];
const row = (name, model, place, route = "endpoint ep1") => `| ${name} | model endpoint | ${model} | 200000 | — | draft text | ${place} | ${route} |`;
const ROWS = [row("local-llm", "model-a", "this machine"), row("check-1", "model-b", "this machine"), row("check-2", "model-c", "this machine"), row("check-3", "model-d", "this machine"), row("cloud-llm", "model-e", "a provider in the USA", "endpoint ep2")];

async function session(extra = {}) {
  const [A, B, LISTED] = [await mailOf("a"), await mailOf("b"), await mailOf("listed")];
  const inbox = [
    rawMail("a", { subject: "NEEDLE-SUBJECT-965 export", body: "NEEDLE-SENTENCE-965 the export fails with error E42.\r\nKind regards\r\nErika Mustermann" }),
    rawMail("b", { subject: "NEEDLE-SUBJECT-965 dark", body: "NEEDLE-SENTENCE-965 please add a dark theme.\r\nKind regards\r\nErika Mustermann" }),
    rawMail("listed"),
  ];
  const answer = () => ({ draft: { proposals: [
    { mail: A.id, product: PRODUCT_URL, kind: "defect", title: "Export fails with E42", text: "The export of a document fails with error E42 in version 1.4.", duplicates: [] },
    { mail: B.id, product: PRODUCT_URL, kind: "change", title: "Dark theme", text: "A dark theme is asked for.", duplicates: [{ issue: 3, reason: "the same wish" }] }] }, answers: [] });
  const p = await openReplies({ route: "graph", fragment: "#mail", rows: ROWS, answer, inbox, issues: [issueRecord(3, "open", [LISTED])], ...extra });
  return { p, A, B, inbox };
}
const readMailbox = async (p) => { await trusted(one(p.main(), "read-mailbox")); await waitFor(() => byClass(p.main(), "mail-decided").length > 0 || byClass(p.main(), "mailbox-problem").length > 0); };

// TST-965203 · level: release · module: MOD-maintenance-pages
// guards: UC-038; MAIL STAYS IN THE MAILBOX; THE PRODUCT ISSUE CARRIES NO PERSONAL DATA; NO PERSONAL DATA FROM A MAIL ENTERS A REPOSITORY; AN ISSUE FROM A MAIL NAMES ITS MAILS BY THEIR IDENTIFIERS; READING THE MAILBOX CHANGES NOTHING IN IT
// given: the mailbox on the Microsoft route holds two new mails from Erika Mustermann, with needle words in subject and text, and a mail an issue lists; local-llm proposes
// input: a whole session: Read mailbox twice, local-llm chosen, Propose, Create issue for the first mail, Add to #3 for the second, Read mailbox again
// expect: the mails of INBOX are the very bytes they were and Agent M's requests to Graph are only reads; besides the job record of the proposal the tracker is written twice — the creation of the issue and the comment that lists the second mail —, each with the MAIL identifier of its mail, and no write holds a needle; the issue is labelled defect; the third reading lists neither mail
test("TST-965203: a whole session leaves the mails in the mailbox and writes only neutral text and identifiers", async () => {
  const { p, A, B, inbox } = await session();
  await lastly(p, async () => {
    await readMailbox(p);
    const first = byClass(p.main(), "mail").map((node) => node.getAttribute("data-mail"));
    await readMailbox(p);
    assert.deepEqual(byClass(p.main(), "mail").map((node) => node.getAttribute("data-mail")), first);
    assert.deepEqual(first.sort(), [A.id, B.id].sort());
    const input = one(p.main(), "person");
    input.value = "Anna Author";
    input.dispatchEvent(new Event("change"));
    const radio = one(walk(p.main(), (node) => node.getAttribute?.("data-participant") === "local-llm")[0], "participant");
    radio.checked = true;
    radio.dispatchEvent(new Event("change"));
    await waitFor(() => byClass(p.main(), "run-panel").length > 0);
    await trusted(buttonsOf(one(p.main(), "mail-stage"), "Run")[0]);
    await waitFor(() => byClass(p.main(), "mail-title").some((node) => node.value !== "" && node.value !== undefined));
    await trusted(one(itemOf(p.main(), A.id), "create-issue"));
    await waitFor(() => p.w.kept.issues.some((issue) => issue.number >= 100));
    const second = itemOf(p.main(), B.id);
    one(second, "mail-issue-number").value = "3";
    one(second, "mail-issue-number").dispatchEvent(new Event("input"));
    await flush();
    await trusted(one(second, "add-to-issue"));
    await waitFor(() => p.w.kept.github.some((request) => request.method === "POST" && request.path.endsWith("/issues/3/comments")));
    assert.deepEqual(p.graph.folders.inbox.map((message) => message.raw), inbox, "the mails of INBOX are the very bytes they were");
    assert.deepEqual(graphWrites(p), [], "Agent M's requests to Graph are only reads");
    const made = writes(p).filter((request) => request.method === "POST");
    const record = (request) => /\/git\/(trees|commits)$/.test(request.path);
    assert.deepEqual(made.filter((request) => !record(request)).map((request) => `${request.method} ${request.path}`).sort(), ["POST /repos/alice/product/issues", "POST /repos/alice/product/issues/3/comments"], "besides the job record of the proposal, the tracker is written twice");
    assert.ok(made.some(record), "known positive: the job record of the proposal was committed");
    for (const request of made) for (const needle of NEEDLES) assert.ok(!String(request.body).includes(needle), `${needle} is not in a write to the repository (${request.path})`);
    for (const request of made.filter((each) => !record(each))) assert.match(String(request.body), /MAIL-[0-9a-f]{16}/, "an issue and a comment name their mail by an identifier");
    assert.deepEqual(JSON.parse(made.find((request) => request.path.endsWith("/issues")).body).labels, ["defect"]);
    await readMailbox(p);
    assert.deepEqual(byClass(p.main(), "mail").map((node) => node.getAttribute("data-mail")), [], "the third reading lists neither mail");
    assert.deepEqual(graphWrites(p), [], "still only reads");
  });
});

// TST-965204 · level: release · module: MOD-maintenance-pages
// guards: UC-038; THE PLACES A MAILBOX'S MAIL MAY GO ARE CONFIGURED; THE PAGE NAMES WHERE IT SENDS; A PLACE OUTSIDE THE EU IS NAMED AS NOT COMPLIANT
// given: a register with participants at this machine and one in the USA (outside the EU), and a mailbox that allows this machine only
// input: Read mailbox; the participants offered; local-llm chosen; Propose
// expect: the participant in the USA is not offered; the panel names where local-llm processes data; every request a model endpoint received went to the endpoint of the participants at this machine and none to the one in the USA; no mail text reached any other place
test("TST-965204: with a mailbox that allows this machine only, nothing is sent to a participant elsewhere", async () => {
  const { p, A } = await session();
  await lastly(p, async () => {
    await readMailbox(p);
    const offered = walk(p.main(), (node) => node.getAttribute?.("data-participant")).map((node) => node.getAttribute("data-participant"));
    assert.ok(offered.includes("local-llm") && !offered.includes("cloud-llm"), `offered: ${offered.join(", ")}`);
    const input = one(p.main(), "person");
    input.value = "Anna Author";
    input.dispatchEvent(new Event("change"));
    const radio = one(walk(p.main(), (node) => node.getAttribute?.("data-participant") === "local-llm")[0], "participant");
    radio.checked = true;
    radio.dispatchEvent(new Event("change"));
    await waitFor(() => byClass(p.main(), "run-panel").length > 0);
    assert.match(textOf(one(p.main(), "run-panel")), /this machine/);
    await trusted(buttonsOf(one(p.main(), "mail-stage"), "Run")[0]);
    await waitFor(() => byClass(p.main(), "mail-title").some((node) => node.value !== "" && node.value !== undefined));
    assert.ok(p.w.kept.endpoint.length > 0, "known positive: the participant was asked");
    assert.ok(p.w.kept.endpoint.every((request) => request.origin === "https://ep1.example.test"), "every request went to the endpoint of a participant at this machine");
    assert.ok(itemOf(p.main(), A.id), "the mail is reviewed beside its proposal");
  });
});
