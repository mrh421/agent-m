# Module: MOD-work-plans
# Guards: AN IMPLEMENTATION JOB BEGINS WITH A FAILING TEST; A REFACTORING JOB BEGINS WITHOUT A FAILING TEST; A REFACTORING JOB CHANGES NO EXPECTED RESULT; AN IMPLEMENTATION JOB CHANGES ONLY ITS MODULES
# Level: release
"""SPEC section 13 - the check named tests/test_implementation_job.py.

The cases live in tests/test_implementation_job.md. This file loads them and asks MOD-product-process' doneCheck for
the findings over fixture pull-request facts.
"""
import json
import re
import unittest
from pathlib import Path

from jsrun import js

DATA = Path(__file__).with_suffix(".md")
RULES = {
    "AN IMPLEMENTATION JOB BEGINS WITH A FAILING TEST",
    "A REFACTORING JOB BEGINS WITHOUT A FAILING TEST",
    "A REFACTORING JOB CHANGES NO EXPECTED RESULT",
    "AN IMPLEMENTATION JOB CHANGES ONLY ITS MODULES",
}

JS_CHECK = """
const workflow = {
  phases: [],
  transitions: [],
  gates: [],
  done: ["ci", "first", "modules", "tests", "gates"]
};
const modules = [{ fields: { id: "MOD-product-process", folder: "src/product-process/" } }];
function factsOf(input) {
  const texts = input.facts.texts ?? {};
  return {
    ...input.facts,
    read: async (path, side) => texts[`${side}:${path}`] ?? null
  };
}
async function doneFindings(input) {
  return await productProcess.doneCheck(factsOf(input), workflow, modules, [], input.job);
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


def findings(case: dict) -> list[dict]:
    return js(JS_CHECK + "return await doneFindings(%s);" % json.dumps(case))


class TestImplementationJob(unittest.TestCase):
    # TST-413100 · level: release · module: system
    # guards: AN IMPLEMENTATION JOB BEGINS WITH A FAILING TEST; A REFACTORING JOB BEGINS WITHOUT A FAILING TEST; A REFACTORING JOB CHANGES NO EXPECTED RESULT; AN IMPLEMENTATION JOB CHANGES ONLY ITS MODULES
    # given: the Markdown pull-request fact cases beside this file
    # input: each case checked through MOD-product-process.doneCheck
    # expect: each case returns exactly its declared findings
    def test_each_pull_request_case_reports_the_expected_findings(self):
        for loaded in cases():
            with self.subTest(case=loaded["name"]):
                self.assertEqual(findings(loaded["case"]), loaded["case"]["expected"])

    # TST-413101 · level: release · module: system
    # guards: AN IMPLEMENTATION JOB BEGINS WITH A FAILING TEST; A REFACTORING JOB BEGINS WITHOUT A FAILING TEST; A REFACTORING JOB CHANGES NO EXPECTED RESULT; AN IMPLEMENTATION JOB CHANGES ONLY ITS MODULES
    # given: passing and refusing cases for implementation and refactoring pull requests
    # input: the cases loaded from Markdown
    # expect: every guarded rule has a counter-proof finding and at least one passing case exists
    def test_cases_cover_the_guarded_rules_and_passing_paths(self):
        loaded = [case["case"] for case in cases()]
        expected_rules = {finding["rule"] for case in loaded for finding in case["expected"]}
        self.assertTrue(any(not case["expected"] for case in loaded))
        self.assertLessEqual(RULES, expected_rules)


if __name__ == "__main__":
    unittest.main()
