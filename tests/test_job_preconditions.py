# Module: MOD-work-plans
# Guards: ARCHITECTURE IS DESIGNED ONLY AGAINST ACCEPTED USE CASES
# Level: release
"""SPEC section 8 - the check named tests/test_job_preconditions.py.

The cases live in tests/test_job_preconditions.md. This file loads them and asks MOD-job-runner to prepare an
architecture job with MOD-approvals' real architecture-ready precondition.
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
const DRAFTER = { name: "architect-a", type: "CLI agent", model: "fixture-model", context: 200000, price: null,
  capabilities: ["draft text"], place: "this machine", route: "fixture" };

try {
  jobRunner.registerStrategies("MOD-approvals", approvals.approvalStrategies);
} catch (error) {
  if (error.name !== "DuplicateStrategy") throw error;
}
try {
  jobRunner.registerStrategies("MOD-spec-changes", specChanges.specStrategies);
} catch (error) {
  if (error.name !== "DuplicateStrategy") throw error;
}
try {
  jobRunner.registerStrategies("tests/test_job_preconditions.py", {
    recipes: { "chapters-for-architecture": async () => [{ name: "chapters 9 to 12 fixture", text: "architecture chapters", sources: ["SRC-vibe-coding"] }] },
    steps: { "due-diligence": async (draft) => ({ draft, findings: [] }) },
    writers: { "open-files": async () => ({ commits: [], files: [], pullRequest: null, shown: null, notes: [] }) }
  });
} catch (error) {
  if (error.name !== "DuplicateStrategy") throw error;
}

const blobOf = (body) => createHash("sha1").update(`blob ${Buffer.byteLength(body)}\\0${body}`).digest("hex");
const useCase = (id, title) => text("---", `id: ${id}`, `title: ${title}`, "area: files", "actors:", "  - Reader",
  "realises:", "  - A SAMPLE RULE", "---", `# ${id} ${title}`, "", `**Goal.** ${title}.`);
const recordOf = (id, path, body) => [`docs/approvals/${id}-${blobOf(body).slice(0, 12)}.md`,
  text("kind: use-case", `file: ${path}`, `blob: ${blobOf(body)}`)];

function filesOf(input) {
  const files = { "SPEC.md": input.productSpec, "README.md": "# Fixture product\\n" };
  for (const each of input.useCases) files[each.path] = useCase(each.id, each.title);
  for (const id of input.accepted ?? []) {
    const each = input.useCases.find((item) => item.id === id);
    const body = useCase(each.id, each.title);
    const [path, record] = recordOf(id, each.path, body);
    files[path] = record;
  }
  return files;
}

async function contextOf(input) {
  const files = filesOf(input);
  const snapshot = { repository: { server: "github", origin: "https://github.com", path: "alice/product",
      web: "https://github.com/alice/product" }, ref: "main", commit: null, paths: Object.keys(files),
    read: async (path) => (Object.hasOwn(files, path) ? files[path] : null),
    blob: (path) => (Object.hasOwn(files, path) ? blobOf(files[path]) : null) };
  return { kind: await jobCatalogue.kindOf("derive-architecture"), params: {},
    product: { address: "https://github.com/alice/product", snapshot, host: null },
    instance: { snapshot, host: null, checkout: null }, connect: async () => null, participants: [DRAFTER],
    places: { sources: {}, mailbox: null }, gates: [], person: "alice", now: new Date("2026-10-13T10:00:00Z"),
    agentM: { version: "unreleased", commit: "0".repeat(40) }, jobId: "JOB-20261013-1000-itm445" };
}

const findingOf = (finding) => ({ artifact: finding.artifact, line: finding.line, kind: finding.kind,
  rule: finding.rule, what: finding.what, fix: finding.fix });

function summary(prepared) {
  return {
    fits: prepared.fits,
    blocking: prepared.blocking.map(findingOf),
    partOrder: prepared.parts.map((part) => ({ recipe: part.recipe, name: part.name })),
    acceptedUseCases: prepared.parts.filter((part) => part.recipe === "accepted-use-cases").map((part) => part.name)
  };
}

async function preconditionCase(input) {
  const context = await contextOf(input);
  const prepared = await jobRunner.prepareJob("derive-architecture", context, { drafter: DRAFTER, reviewers: [] });
  const out = summary(prepared);
  if (input.attemptRun) {
    const driver = { participant: DRAFTER, inputs: [], async send(value) { this.inputs.push(value); return { text: "{}", usage: null }; } };
    try {
      await jobRunner.runJob(prepared, { drafter: driver, reviewers: [] }, { attended: true, context });
      out.runError = null;
    } catch (error) {
      out.runError = error.name;
    }
    out.sent = driver.inputs.length;
  } else {
    out.runError = null;
    out.sent = null;
  }
  return out;
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
    return js(JS_CHECK + "return await preconditionCase(%s);" % json.dumps(case["input"]))


class TestJobPreconditions(unittest.TestCase):
    # TST-445100 · level: release · module: system
    # guards: ARCHITECTURE IS DESIGNED ONLY AGAINST ACCEPTED USE CASES
    # given: Markdown fixture products with use-case approval records present or absent
    # input: prepareJob("derive-architecture") with MOD-approvals' architecture-ready precondition
    # expect: an open use case blocks the job and is named before anything is sent; accepted use cases let preparation start
    def test_architecture_jobs_start_only_from_accepted_use_cases(self):
        loaded = cases()
        self.assertEqual([item["case"]["input"]["name"] for item in loaded], ["open-use-case", "accepted-use-cases"])
        for item in loaded:
            with self.subTest(case=item["name"]):
                self.assertEqual(result(item["case"]), item["case"]["expected"])

    # TST-445101 · level: release · module: system
    # guards: ARCHITECTURE IS DESIGNED ONLY AGAINST ACCEPTED USE CASES
    # given: the expected results in the Markdown fixture cases
    # input: the blocking finding and the accepted-use-cases parts
    # expect: the data states both the refusal path and the accepted path
    def test_cases_cover_the_blocking_and_starting_paths(self):
        loaded = {item["case"]["input"]["name"]: item["case"]["expected"] for item in cases()}
        self.assertEqual(loaded["open-use-case"]["runError"], "NotStartable")
        self.assertEqual(loaded["open-use-case"]["sent"], 0)
        self.assertTrue(any("UC-002" in finding["what"] for finding in loaded["open-use-case"]["blocking"]))
        self.assertEqual(loaded["accepted-use-cases"]["blocking"], [])
        self.assertEqual(len(loaded["accepted-use-cases"]["acceptedUseCases"]), 2)


if __name__ == "__main__":
    unittest.main()
