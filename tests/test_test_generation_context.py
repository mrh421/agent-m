# Module: MOD-result-records
# Guards: TEST GENERATION SEES THE EXISTING TESTS
# Level: release
"""SPEC §12 — the check named tests/test_test_generation_context.py.

The cases live in tests/test_test_generation_context.md. This file loads them and asks MOD-result-records for the part of the input that the generating participant receives, and MOD-job-catalogue for the kinds that name
it, so the release check uses the same recipe and the same kinds the product uses.
"""
import json
import re
import unittest
from pathlib import Path

from jsrun import js

DATA = Path(__file__).with_suffix(".md")


def sections(text: str) -> list[tuple[str, str]]:
    """The `## name` sections of the file; a line inside a fenced block starts none."""
    found, name, lines, fenced = [], None, [], False
    for line in text.split("\n"):
        if line.startswith("```"):
            fenced = not fenced
        if not fenced and line.startswith("## "):
            if name is not None:
                found.append((name, "\n".join(lines)))
            name, lines = line[3:].strip(), []
        elif name is not None:
            lines.append(line)
    if name is not None:
        found.append((name, "\n".join(lines)))
    return found


def blocks(body: str) -> tuple[dict, dict]:
    files, data = {}, {}
    for block in re.finditer(r"^### (?P<head>[^\n]+)\n\n```[a-z]*\n(?P<text>.*?)\n```", body, re.M | re.S):
        head = block.group("head")
        if head.startswith("File "):
            files[head[5:].strip()] = block.group("text") + "\n"
        else:
            data[head] = json.loads(block.group("text"))
    return files, data


def loaded() -> tuple[dict, list[dict]]:
    found = sections(DATA.read_text(encoding="utf-8"))
    product, _ = blocks(dict(found)["the product"])
    cases = []
    for name, body in found:
        if name == "the product":
            continue
        _, data = blocks(body)
        cases.append({"name": name, "params": data["Params"], "expected": data["Expected"]})
    if not product or not cases:
        raise AssertionError("no cases loaded")
    return product, cases


def selection(product: dict, params: dict) -> str:
    """The text of the part test-selection that the recipe of MOD-result-records gives for the selection."""
    return js(
        "const files = %s, params = %s;"
        "const snapshot = { paths: Object.keys(files), read: async (p) => files[p] ?? null };"
        "const context = { kind: null, params, product: { address: 'https://github.com/acme/product', snapshot, host: null }, instance: { snapshot, host: null, checkout: null },"
        " connect: async () => null, participants: [], places: { sources: {}, mailbox: null }, gates: [], person: 'alice', now: new Date('2026-11-01T09:00:00Z'),"
        " agentM: { version: 'unreleased', commit: 'a'.repeat(40) }, jobId: null };"
        "const parts = await resultRecords.resultStrategies.recipes['test-selection'](context, params);"
        "return parts.map((part) => part.text).join('\\n');" % (json.dumps(product), json.dumps(params)))


class TestTestGenerationContext(unittest.TestCase):
    # TST-771401 · level: release · module: system
    # guards: TEST GENERATION SEES THE EXISTING TESTS; UC-026
    # given: the Markdown cases beside this file: a product with four existing tests, two of them guarding a requirement, one a use case, one a module, and the selection a person made
    # input: the recipe test-selection of MOD-result-records on each selection
    # expect: the part holds every existing test that guards a selected requirement, use case or module — its declaration and its code — and none that guards only another name; known positive: a selected name that no test guards gives "(none)", never a test of another name
    def test_every_existing_test_that_guards_the_selection_is_part_of_the_input(self):
        product, cases = loaded()
        self.assertGreaterEqual(len(cases), 5)
        for case in cases:
            with self.subTest(case=case["name"]):
                text = selection(product, case["params"])
                for wanted in case["expected"]["holds"]:
                    self.assertIn(wanted, text)
                for unwanted in case["expected"]["lacks"]:
                    self.assertNotIn(unwanted, text)

    # TST-771402 · level: release · module: system
    # guards: TEST GENERATION SEES THE EXISTING TESTS; UC-026
    # given: the kinds propose-tests and write-tests of MOD-job-catalogue, and a case that has the guarded name, the input and the expected result of an existing test but is classed new
    # input: the recipes each kind names; the check test-proposals on the case and on the same case classed duplicate
    # expect: both kinds name the recipe test-selection, so that the participant receives the existing tests; the case classed new has one error under TEST GENERATION SEES THE EXISTING TESTS naming the existing test, found without a model; the same case classed duplicate has none
    def test_both_kinds_send_the_existing_tests_and_an_exact_duplicate_is_found_without_a_model(self):
        for kind in ("propose-tests", "write-tests"):
            names = js("return (await jobCatalogue.kindOf(%s)).recipes.map((recipe) => recipe.name);" % json.dumps(kind))
            self.assertIn("test-selection", names, kind)
        product, _ = loaded()
        case = {"identifier": "TST-975", "level": "unit", "guards": ["A ROUND RULE"], "precondition": "a widget", "input": "its shape", "expected": "round", "class": "new"}

        def found(one: dict) -> list[dict]:
            return js(
                "const files = %s, one = %s;"
                "const snapshot = { paths: Object.keys(files), read: async (p) => files[p] ?? null };"
                "const context = { kind: null, params: {}, product: { address: 'https://github.com/acme/product', snapshot, host: null }, instance: { snapshot, host: null, checkout: null },"
                " connect: async () => null, participants: [], places: { sources: {}, mailbox: null }, gates: [], person: 'alice', now: new Date('2026-11-01T09:00:00Z'),"
                " agentM: { version: 'unreleased', commit: 'a'.repeat(40) }, jobId: null };"
                "return (await resultRecords.resultStrategies.checks['test-proposals']({ cases: [one] }, context)).map((f) => ({ rule: f.rule, what: f.what, kind: f.kind }));"
                % (json.dumps(product), json.dumps(one)))

        flagged = found(case)
        self.assertEqual([one["rule"] for one in flagged], ["TEST GENERATION SEES THE EXISTING TESTS"])
        self.assertEqual(flagged[0]["kind"], "error")
        self.assertIn("TST-971", flagged[0]["what"])
        self.assertEqual(found({**case, "class": "duplicate", "of": "TST-971"}), [])


if __name__ == "__main__":
    unittest.main()
