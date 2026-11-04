# Module: MOD-documents
# Guards: A CANDIDATE IS NEW, A CHANGE, A DUPLICATE OR A CONFLICT; EXACT DUPLICATES ARE FOUND WITHOUT A MODEL; A CHANGE IS PROPOSED UNDER THE EXISTING NAME; A DUPLICATE ADDS A SOURCE, NOT A REQUIREMENT; A CONFLICT IS DECIDED BY A PERSON; CANDIDATES ARE DEDUPLICATED AMONG THEMSELVES; THE DERIVATION RULES HOLD FOR ARCHITECTURE
# Level: release
"""SPEC section 8 - the check named tests/test_derivation_classes.py.

The cases live in tests/test_derivation_classes.md. This file loads them and asks MOD-documents, MOD-job-runner and
MOD-spec-changes for the classes and the queued entries over fixture candidates.
"""
import json
import re
import unittest
from pathlib import Path

from jsrun import js

DATA = Path(__file__).with_suffix(".md")

JS_CHECK = """
const writer = specChanges.specStrategies?.writers?.["queue-entries"];
const text = (...lines) => `${lines.join("\\n")}\\n`;

const CANDIDATES = { type: "object", required: ["candidates"], properties: { candidates: { type: "array", items: {
  type: "object", required: ["name", "rule", "check", "constrains", "passage", "class"], properties: {
    name: { type: "string" }, rule: { type: "string" }, check: { type: "string" },
    constrains: { type: "string", enum: ["product", "process"] }, passage: { type: "string" },
    class: { type: "string", enum: ["new", "change", "duplicate", "conflict"] }, of: { type: "string" } } } } } };
const FILES = { type: "object", required: ["files"], properties: { files: { type: "array", items: {
  type: "object", required: ["path", "text", "class"], properties: {
    path: { type: "string" }, text: { type: "string" },
    class: { type: "string", enum: ["new", "change", "duplicate", "conflict"] }, of: { type: "string" } } } } } };
const DRAFTER = { name: "fixture-drafter", type: "CLI agent", model: "fixture-model", context: 200000,
  capabilities: ["draft text"], place: "this machine", route: "fixture" };
const SOURCE_ENTRY = text("---", "id: SRC-fixture-book", "title: Fixture Book", "kind: document",
  "authority: normative", "licence: may be republished - fixture", "---", "# SRC-fixture-book Fixture Book", "",
  "## Versions", "", "| Version | Date | Edition | Read from | Files |", "|---|---|---|---|---|",
  `| \\`2026-10-01\\` | 2026-10-01 | fixture | fixture | one file |`);
const SOURCE_LINKS = text("# Requirement sources of the fixture", "",
  "| Source | Version | Hash | Part |", "|---|---|---|---|",
  `| SRC-fixture-book | 2026-10-01 | ${"1".repeat(64)} | |`);
const USE_CASE = text("---", "id: UC-001", "title: Read a file", "area: reading", "actors:", "  - Reader",
  "realises:", "  - A SAMPLE RULE", "---", "# UC-001 Read a file", "", "**Goal.** Read a file.");

function candidateForClassification(candidate) {
  return { ref: candidate.name, keys: [candidate.name, candidate.rule ?? ""],
    from: [candidate.passage].filter(Boolean), proposed: { class: candidate.class, of: candidate.of ?? null } };
}

function classificationCase(input) {
  return { classes: documents.classifyCandidates(input.candidates.map(candidateForClassification), input.existing ?? []) };
}

function artifactsOf(specText) {
  return [...specDocument.parseSpec(specText).requirements.values()]
    .map((requirement) => ({ id: requirement.name, keys: [requirement.name, requirement.rule ?? ""] }));
}

const snapshotOf = (files) => ({
  paths: Object.keys(files),
  blob: (path) => (Object.hasOwn(files, path) ? `blob-${path}` : null),
  read: async (path) => (Object.hasOwn(files, path) ? files[path] : null),
  commit: "h".repeat(40)
});

const hostOf = (name) => {
  const commits = [];
  return { commits,
    repositoryInfo: async () => ({ defaultBranch: "main", canWrite: true }),
    readSnapshot: async () => { throw new Error("the writer reads the snapshots the context carries"); },
    commitFiles: async (change) => {
      commits.push(change);
      return { commit: `${name}-commit-${commits.length}`.padEnd(40, "0"), url: "https://example.test/commit" };
    } };
};

function fixture(input) {
  const productFiles = { "SPEC.md": input.productSpec, "docs/sources.md": SOURCE_LINKS,
    "docs/use-cases/UC-001-read-a-file.md": USE_CASE };
  const instanceFiles = { "SPEC.md": input.productSpec, "docs/sources/SRC-fixture-book.md": SOURCE_ENTRY };
  const product = { address: "https://github.com/alice/product", snapshot: snapshotOf(productFiles), host: hostOf("product") };
  const instance = { snapshot: snapshotOf(instanceFiles), host: hostOf("instance"), checkout: null };
  const context = { kind: null, params: { source: input.source }, product, instance,
    now: new Date("2026-10-13T08:00:00Z"), agentM: { version: "unreleased", commit: "c".repeat(40) },
    jobId: "JOB-20261013-0800-itm415", person: "alice", participants: [], places: { sources: {}, mailbox: null },
    gates: [], connect: async () => { throw new Error("no repository is opened here"); } };
  return { context, product, instance };
}

const kindNaming = (checks) => ({ name: "derive-requirements", serves: [], participant: "one", needs: ["draft text"],
  resources: "none", preconditions: [], recipes: [{ name: "existing-requirements", optional: false }], checks,
  personDecides: [], reviewer: null, reviewers: 0, steps: [], gatePoints: [], review: "person", writer: "return-draft",
  limit: 5, purpose: "Derives requirements, for a test.", prompt: "Derive the requirements.\\n\\n{{existing-requirements}}",
  answer: CANDIDATES });
const architectureKind = (checks) => ({ name: "derive-architecture", serves: [], participant: "one", needs: ["draft text"],
  resources: "none", preconditions: [], recipes: [{ name: "whole-architecture", optional: false }], checks,
  personDecides: [], reviewer: null, reviewers: 0, steps: [], gatePoints: [], review: "person", writer: "return-draft",
  limit: 5, purpose: "Derives architecture, for a test.", prompt: "Derive architecture.\\n\\n{{whole-architecture}}",
  answer: FILES });

const filesOf = (commit) => Object.fromEntries(commit.files.map((file) => [file.path, file.text ?? ""]));
const folderOf = (commit) => [...new Set(commit.files.map((file) => file.path.split("/").slice(0, 3).join("/")))].at(0);
function sectionEntries(commit) {
  if (!commit) return [];
  const folder = folderOf(commit);
  return Object.entries(filesOf(commit))
    .filter(([path]) => /\\/\\d+-[^/]+\\.md$/.test(path) && !path.endsWith(".begruendung.md"))
    .map(([path, body]) => ({ name: path.slice(folder.length + 1), text: body }));
}

async function jobRunnerAndQueueCase(input) {
  if (!writer) throw new Error("queue-entries writer is not registered");
  const f = fixture(input);
  const kind = kindNaming(["candidate-classes"]);
  f.context.kind = kind;
  const parts = [{ name: "SPEC.md", size: input.productSpec.length, sources: [], required: true,
    recipe: "existing-requirements", artifacts: artifactsOf(input.productSpec), text: input.productSpec }];
  const job = { kind, params: {}, drafter: DRAFTER, reviewers: [], parts, destinations: [], fits: true,
    notFitting: [], leftOut: [], blocking: [], limit: 5 };
  const result = await jobRunner.runJob(job, { drafter: null, reviewers: [] },
    { attended: true, context: f.context, from: { candidates: input.candidates } });
  const outcome = await writer(result, f.context);
  const productCommit = f.product.host.commits[0] ?? null;
  const written = productCommit ? filesOf(productCommit) : {};
  return {
    run: { stoppedBecause: result.stoppedBecause, remaining: result.remaining, classes: result.classes },
    writer: { productCommits: f.product.host.commits.length, instanceCommits: f.instance.host.commits.length,
      sections: sectionEntries(productCommit), notes: outcome.notes,
      conflictWritten: Object.values(written).some((body) => body.includes("CONTRADICTS ANOTHER")
        || body.includes("A reader sees nothing.")) }
  };
}

async function architectureClassesCase(input) {
  const kind = architectureKind(["candidate-classes"]);
  const context = { kind, params: {}, product: { address: "https://github.com/alice/product", snapshot: null, host: null },
    instance: { snapshot: null, host: null, checkout: null }, connect: async () => null, participants: [],
    places: { sources: {}, mailbox: null }, gates: [], person: "alice", now: new Date("2026-10-13T11:00:00Z"),
    agentM: { version: "unreleased", commit: "d".repeat(40) }, jobId: "JOB-20261013-1100-itm447" };
  const parts = [{ name: "existing architecture", size: 0, sources: [], required: true,
    recipe: "whole-architecture", artifacts: input.existing, text: "" }];
  const job = { kind, params: {}, drafter: DRAFTER, reviewers: [], parts, destinations: [], fits: true,
    notFitting: [], leftOut: [], blocking: [], limit: 5 };
  const result = await jobRunner.runJob(job, { drafter: null, reviewers: [] },
    { attended: true, context, from: { files: input.files } });
  return { stoppedBecause: result.stoppedBecause, remaining: result.remaining, classes: result.classes };
}

async function derivationClassesResult(input) {
  if (input.kind === "classifier") return classificationCase(input);
  if (input.kind === "job-runner-and-queue") return await jobRunnerAndQueueCase(input);
  if (input.kind === "architecture-classes") return await architectureClassesCase(input);
  throw new Error(`unknown derivation class case ${input.kind}`);
}
"""


def fence(body: str, heading: str) -> str:
    match = re.search(rf"^### {re.escape(heading)}\n\n```[a-z]*\n(.*?)\n```", body, re.M | re.S)
    if not match:
        raise AssertionError(f"missing fenced block under {heading}")
    return match.group(1)


def sections() -> list[dict]:
    text = DATA.read_text(encoding="utf-8")
    found = []
    for match in re.finditer(r"^## (?P<name>[^\n]+)\n(?P<body>.*?)(?=^## |\Z)", text, re.M | re.S):
        found.append({"name": match.group("name"), "body": match.group("body")})
    if not found:
        raise AssertionError("no cases loaded")
    return found


def cases() -> list[dict]:
    return [{"name": section["name"], "case": json.loads(fence(section["body"], "Case"))} for section in sections()]


def result(case: dict) -> dict:
    return js(JS_CHECK + "return await derivationClassesResult(%s);" % json.dumps(case["input"]))


class TestDerivationClasses(unittest.TestCase):
    # TST-415100 · level: release · module: system
    # guards: A CANDIDATE IS NEW, A CHANGE, A DUPLICATE OR A CONFLICT; EXACT DUPLICATES ARE FOUND WITHOUT A MODEL; A CHANGE IS PROPOSED UNDER THE EXISTING NAME; A DUPLICATE ADDS A SOURCE, NOT A REQUIREMENT; A CONFLICT IS DECIDED BY A PERSON; CANDIDATES ARE DEDUPLICATED AMONG THEMSELVES
    # given: Markdown fixture cases that state their preconditions, inputs and expected results
    # input: each case checked through MOD-documents, MOD-job-runner or MOD-spec-changes
    # expect: the executable product behaviour equals the expected class and queue-entry result stated in the data file
    def test_derivation_class_cases_match_their_expected_results(self):
        loaded = cases()
        self.assertEqual([item["case"]["input"]["kind"] for item in loaded], ["classifier", "job-runner-and-queue", "architecture-classes"])
        for item in loaded:
            with self.subTest(case=item["name"]):
                self.assertEqual(result(item["case"]), item["case"]["expected"])

    # TST-415101 · level: release · module: system
    # guards: A CANDIDATE IS NEW, A CHANGE, A DUPLICATE OR A CONFLICT; EXACT DUPLICATES ARE FOUND WITHOUT A MODEL; A CHANGE IS PROPOSED UNDER THE EXISTING NAME; A DUPLICATE ADDS A SOURCE, NOT A REQUIREMENT; A CONFLICT IS DECIDED BY A PERSON; CANDIDATES ARE DEDUPLICATED AMONG THEMSELVES
    # given: the expected results in the Markdown fixture cases
    # input: the stated expected class list and written queue sections
    # expect: the cases cover every selected class rule and the writer paths for change, duplicate and undecided conflict
    def test_cases_cover_the_required_derivation_paths(self):
        loaded = {item["case"]["input"]["kind"]: item["case"] for item in cases()}
        classes = loaded["classifier"]["expected"]["classes"]
        self.assertLessEqual({"new", "change", "duplicate", "conflict"}, {item["class"] for item in classes})
        self.assertTrue(any(item["class"] == "duplicate" and item["decidedBy"] == "rule" for item in classes))
        self.assertTrue(any(len(item["refs"]) == 2 and len(item["from"]) == 2 for item in classes))

        written = "\n".join(section["text"] for section in loaded["job-runner-and-queue"]["expected"]["writer"]["sections"])
        self.assertIn("**A SAMPLE RULE** *(Product Owner; SRC-fixture-book, ch. 8)*", written)
        self.assertNotIn("**A BETTER READING RULE**", written)
        self.assertIn("**A WRITE RULE** *(Product Owner; SRC-fixture-book, ch. 9)*", written)
        self.assertNotIn("**RESTATES THE WRITE RULE**", written)
        self.assertFalse(loaded["job-runner-and-queue"]["expected"]["writer"]["conflictWritten"])

        architecture = loaded["architecture-classes"]["expected"]["classes"]
        self.assertLessEqual({"new", "change", "duplicate", "conflict"}, {item["class"] for item in architecture})
        self.assertTrue(any(item["of"] == "ARC-001" and item["decidedBy"] == "rule" for item in architecture))
        self.assertTrue(any(item["of"] == "MOD-reader" and item["decidedBy"] == "rule" for item in architecture))
        self.assertTrue(any(len(item["refs"]) == 2 and item["class"] == "new" for item in architecture))


if __name__ == "__main__":
    unittest.main()
