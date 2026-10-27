# Module: MOD-spec-changes
# Guards: DERIVATION SEES THE EXISTING REQUIREMENTS; NO REQUIREMENT IS LEFT OUT OF THE CONTEXT SILENTLY; A PROMPTED REQUIREMENT CHANGE FOLLOWS THE DERIVATION RULES
# Level: release
"""SPEC section 8 - the check named tests/test_derivation_context.py.

The cases live in tests/test_derivation_context.md. This file loads them and asks MOD-job-runner to prepare the
requirements jobs with MOD-spec-changes' real requirement recipes over fixture SPEC and queue files.
"""
import json
import re
import unittest
from pathlib import Path

from jsrun import js

DATA = Path(__file__).with_suffix(".md")

JS_CHECK = """
const { createHash } = process.getBuiltinModule("node:crypto");
const text = (...lines) => `${lines.join("\\n")}\\n`;
const DRAFTER = { name: "drafter-a", type: "CLI agent", model: "fixture-model", context: 200000, price: null,
  capabilities: ["draft text"], place: "this machine", route: "fixture" };
const REVIEWER = { ...DRAFTER, name: "reviewer-b", model: "review-model" };
const SMALL = { ...DRAFTER, name: "small-d", context: 10 };
const blobOf = (body) => createHash("sha1").update(`blob ${Buffer.byteLength(body)}\\0${body}`).digest("hex");

try {
  jobRunner.registerStrategies("MOD-spec-changes", specChanges.specStrategies);
} catch (error) {
  if (error.name !== "DuplicateStrategy") throw error;
}
try {
  jobRunner.registerStrategies("MOD-issue-handling", issueHandling.issueStrategies);
} catch (error) {
  if (error.name !== "DuplicateStrategy") throw error;
}
try {
  jobRunner.registerStrategies("MOD-approvals", approvals.approvalStrategies);
} catch (error) {
  if (error.name !== "DuplicateStrategy") throw error;
}
try {
  jobRunner.registerStrategies("tests/test_derivation_context.py", { recipes: {
    "source-excerpt": async () => [{ name: "SRC-fixture-book excerpt", text: "source excerpt", sources: ["SRC-fixture-book"] }],
    "chapters-for-requirements": async () => [{ name: "chapter 8 fixture", text: "requirements chapter", sources: ["SRC-vibe-coding"] }],
    "chapters-for-architecture": async () => [{ name: "chapters 9 to 12 fixture", text: "architecture chapters", sources: ["SRC-vibe-coding"] }]
  },
  steps: { "due-diligence": async (draft) => ({ draft, findings: [] }) },
  writers: { "open-files": async () => ({ commits: [], files: [], pullRequest: null, shown: null, notes: [] }) } });
} catch (error) {
  if (error.name !== "DuplicateStrategy") throw error;
}

function queueFiles(input) {
  if (!input.openQueueProposal) return {};
  return {
    "docs/spec-freigaben/2026-10-12_context/index.md": text("# SPEC approvals - queue 2026-10-12 - context", "",
      "**Zieldatei aller Eintr\\u00e4ge:** `SPEC.md`", "",
      "| Nr | Datei | Anker (\\u00dcberschrift, wortgetreu) | bis (exklusiv) | Commits |",
      "|---|---|---|---|---|", "| 01 | `SPEC.md` | ## 1. Reading | \\u2014 | \\u2014 |"),
    "docs/spec-freigaben/2026-10-12_context/entscheidungen.md": text("# Decisions - queue 2026-10-12 context", "",
      "Append-only."),
    "docs/spec-freigaben/2026-10-12_context/01-reading.md": input.openQueueProposal
  };
}

const useCase = (id, title) => text("---", `id: ${id}`, `title: ${title}`, "area: files", "actors:", "  - Reader",
  "realises:", "  - A SAMPLE RULE", "---", `# ${id} ${title}`, "", `**Goal.** ${title}.`);
const recordOf = (id, path, body) => [`docs/approvals/${id}-${blobOf(body).slice(0, 12)}.md`,
  text("kind: use-case", `file: ${path}`, `blob: ${blobOf(body)}`)];

function snapshotOf(input) {
  const files = { "SPEC.md": input.productSpec, ...queueFiles(input) };
  for (const each of input.useCases ?? []) files[each.path] = useCase(each.id, each.title);
  for (const id of input.accepted ?? []) {
    const each = (input.useCases ?? []).find((item) => item.id === id);
    const body = useCase(each.id, each.title);
    const [path, record] = recordOf(id, each.path, body);
    files[path] = record;
  }
  return { repository: { server: "github", origin: "https://github.com", path: "alice/product",
      web: "https://github.com/alice/product" }, ref: "main",
    paths: Object.keys(files), blob: (path) => (Object.hasOwn(files, path) ? blobOf(files[path]) : null),
    read: async (path) => (Object.hasOwn(files, path) ? files[path] : null), commit: "0".repeat(40) };
}

async function contextOf(kindName, input) {
  const snapshot = snapshotOf(input);
  return { kind: await jobCatalogue.kindOf(kindName), params: input.params ?? {},
    product: { address: "https://github.com/alice/product", snapshot, host: null },
    instance: { snapshot, host: null, checkout: null }, connect: async () => null,
    participants: [DRAFTER, REVIEWER, SMALL], places: { sources: {}, mailbox: null }, gates: [], person: "alice",
    now: new Date("2026-10-13T09:00:00Z"), agentM: { version: "unreleased", commit: "0".repeat(40) },
    jobId: "JOB-20261013-0900-itm414" };
}

function blockSummary(part) {
  return part.text.split(/\\n{2,}/).filter((block) => block.trim() !== "").map((block) => {
    const first = block.split("\\n")[0];
    const state = /^State: (.*?)(?: \\u00b7 Section: (.*))?$/.exec(first);
    return { name: /\\*\\*([^*]+)\\*\\*/.exec(block)?.[1] ?? null,
      state: state?.[1] ?? null, section: state?.[2] ?? null };
  });
}

function summary(prepared) {
  const withQueues = prepared.parts.find((part) => part.recipe === "spec-with-queues") ?? null;
  const named = prepared.parts.find((part) => part.recipe === "named-requirements") ?? null;
  return {
    fits: prepared.fits,
    blocking: prepared.blocking.map((finding) => [finding.kind, finding.rule]),
    leftOut: prepared.leftOut,
    partOrder: prepared.parts.map((part) => ({ recipe: part.recipe, name: part.name })),
    context: withQueues === null ? null : { name: withQueues.name,
      artifacts: (withQueues.artifacts ?? []).map((artifact) => artifact.id), blocks: blockSummary(withQueues) },
    namedRequirementText: named?.text ?? null,
    notFitting: prepared.notFitting.map(({ participant, size, context }) =>
      ({ participant: participant.name, context, sizeGreaterThanContext: size > context }))
  };
}

function architectureSummary(prepared) {
  const wholeSpec = prepared.parts.find((part) => part.recipe === "whole-spec") ?? null;
  return {
    fits: prepared.fits,
    blocking: prepared.blocking.map((finding) => [finding.kind, finding.rule]),
    leftOut: prepared.leftOut,
    params: prepared.params,
    partOrder: prepared.parts.map((part) => ({ recipe: part.recipe, name: part.name })),
    wholeSpecText: wholeSpec?.text ?? null,
    acceptedUseCases: prepared.parts.filter((part) => part.recipe === "accepted-use-cases")
      .map((part) => part.name),
    destinations: prepared.destinations.map((destination) => ({ role: destination.role,
      participant: destination.participant.name, parts: destination.parts })),
    notFitting: prepared.notFitting.map(({ participant, size, context }) =>
      ({ participant: participant.name, context, sizeGreaterThanContext: size > context }))
  };
}

function inputSummary(input) {
  if (!input) return null;
  const draft = input.parts.find((part) => part.recipe === "draft") ?? null;
  return {
    partOrder: input.parts.map((part) => ({ recipe: part.recipe, name: part.name })),
    wholeSpecText: input.parts.find((part) => part.recipe === "whole-spec")?.text ?? null,
    acceptedUseCases: input.parts.filter((part) => part.recipe === "accepted-use-cases").map((part) => part.name),
    draftFiles: draft ? JSON.parse(draft.text).files.map((file) => file.path) : []
  };
}

function driver(participant, answers) {
  const inputs = [];
  return { participant, inputs, async send(input) {
    inputs.push(input);
    const next = answers.shift();
    if (next === undefined) throw new Error(`${participant.name} was asked more often than expected`);
    return { text: JSON.stringify(next), usage: null };
  } };
}

async function prepareCase(input) {
  const context = await contextOf(input.kind, input);
  const prepared = await jobRunner.prepareJob(input.kind, context, { drafter: DRAFTER, reviewers: input.reviewers ? [REVIEWER] : [] });
  return summary(prepared);
}

async function architectureCase(input) {
  const context = await contextOf(input.kind, input);
  const prepared = await jobRunner.prepareJob(input.kind, context, { drafter: DRAFTER, reviewers: input.reviewers ? [REVIEWER] : [] });
  const out = architectureSummary(prepared);
  if (input.attemptRun || input.draftFiles) {
    const drafter = driver(DRAFTER, [{ draft: { files: input.draftFiles ?? [] } }]);
    const reviewer = driver(REVIEWER, [{ draft: { findings: [] } }]);
    try {
      const run = await jobRunner.runJob(prepared, { drafter, reviewers: input.reviewers ? [reviewer] : [] },
        { attended: true, context });
      out.runError = null;
      out.stoppedBecause = run.stoppedBecause;
      out.remaining = run.remaining.map((finding) => [finding.kind, finding.rule]);
    } catch (error) {
      out.runError = error.name;
      out.stoppedBecause = null;
      out.remaining = null;
    }
    out.sent = { drafter: drafter.inputs.length, reviewer: reviewer.inputs.length };
    out.drafterInput = inputSummary(drafter.inputs[0]);
    out.reviewerInput = inputSummary(reviewer.inputs[0]);
  }
  return out;
}

async function smallContextCase(input) {
  const context = await contextOf(input.kind, input);
  const fitting = await jobRunner.prepareJob(input.kind, context, { drafter: DRAFTER, reviewers: [] });
  const small = await jobRunner.prepareJob(input.kind, context, { drafter: SMALL, reviewers: [] });
  const driver = { participant: SMALL, inputs: [], async send(value) { this.inputs.push(value); return { text: "{}", usage: null }; } };
  let runError = null;
  try {
    await jobRunner.runJob(small, { drafter: driver, reviewers: [] }, { attended: true, context });
  } catch (error) {
    runError = error.name;
  }
  const show = input.kind === "derive-architecture" ? architectureSummary : summary;
  const same = input.kind === "derive-architecture"
    ? JSON.stringify(show(fitting).partOrder) === JSON.stringify(show(small).partOrder)
    : JSON.stringify(summary(fitting).context) === JSON.stringify(summary(small).context);
  return { small: { ...show(small), runError, sent: driver.inputs.length },
    ...(input.kind === "derive-architecture" ? { sameContextParts: same } : { sameContextRequirements: same }) };
}

async function derivationContextResult(input) {
  if (input.case === "prepare") return await prepareCase(input);
  if (input.case === "architecture-prepare") return await architectureCase(input);
  if (input.case === "small-context") return await smallContextCase(input);
  throw new Error(`unknown derivation context case ${input.case}`);
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
    return js(JS_CHECK + "return await derivationContextResult(%s);" % json.dumps(case["input"]))


class TestDerivationContext(unittest.TestCase):
    # TST-414100 - level: release - module: system
    # guards: DERIVATION SEES THE EXISTING REQUIREMENTS; A PROMPTED REQUIREMENT CHANGE FOLLOWS THE DERIVATION RULES
    # given: Markdown fixture cases that state the SPEC, the open queue and the expected prepared input
    # input: prepareJob for derive-requirements and change-requirements with MOD-spec-changes' real spec-with-queues recipe
    # expect: every SPEC requirement and every open-queue requirement is in the job context, and prompted changes also get the named requirement section
    def test_requirements_jobs_receive_the_spec_and_open_queue_requirements(self):
        loaded = [item for item in cases() if item["case"]["input"]["case"] == "prepare"]
        self.assertEqual([item["case"]["input"]["kind"] for item in loaded], ["derive-requirements", "change-requirements"])
        for item in loaded:
            with self.subTest(case=item["name"]):
                self.assertEqual(result(item["case"]), item["case"]["expected"])

    # TST-447100 - level: release - module: system
    # guards: THE FIRST ARCHITECTURE IS DESIGNED AS A WHOLE; THE ARCHITECTURE'S PARTICIPANTS RECEIVE THE WHOLE PROJECT
    # given: Markdown fixture architecture cases with accepted use cases and no selection
    # input: prepareJob("derive-architecture") with MOD-approvals and MOD-spec-changes real recipes
    # expect: the whole case sends the whole SPEC, every accepted use case, architecture chapters and the draft to the right participants; the part case is refused before sending
    def test_architecture_derivation_receives_the_whole_project(self):
        loaded = [item for item in cases() if item["case"]["input"]["case"] == "architecture-prepare"]
        self.assertEqual([item["case"]["input"]["name"] for item in loaded], ["whole-project", "open-use-case-refused"])
        for item in loaded:
            with self.subTest(case=item["name"]):
                self.assertEqual(result(item["case"]), item["case"]["expected"])

    # TST-414101 - level: release - module: system
    # guards: NO REQUIREMENT IS LEFT OUT OF THE CONTEXT SILENTLY; NOTHING IS LEFT OUT OF AN ARCHITECTURE PROMPT SILENTLY
    # given: a small participant and the same fixture context that fits the normal participant
    # input: prepareJob, then runJob on the not-fitting prepared job with a driver that records sends
    # expect: the participant is named as not fitting, the full context is still present, runJob refuses to start, and nothing is sent
    def test_a_participant_that_cannot_hold_the_context_is_named_before_anything_is_sent(self):
        loaded = [item for item in cases() if item["case"]["input"]["case"] == "small-context"]
        self.assertGreaterEqual(len(loaded), 1)
        for item in loaded:
            with self.subTest(case=item["name"]):
                self.assertEqual(result(item["case"]), item["case"]["expected"])


if __name__ == "__main__":
    unittest.main()
