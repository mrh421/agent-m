# Module: MOD-product-process
# Guards: A PRODUCT DECLARES ITS DEFINITION OF DONE; THE DEFAULT DEFINITION OF DONE IS THE JOB RULES; A PULL REQUEST IS MERGED ONLY WHEN THE DEFINITION OF DONE HOLDS
# Level: release
"""SPEC section 13 - the check named tests/test_definition_of_done.py (ITM-788).

The cases live in tests/test_definition_of_done.md. This file loads them. For each case it asks MOD-product-process'
workflowOf for the workflow of this repository's own docs/process.md (read as it stands, with the case's declared
condition lines added under its Definition of Done), and doneCheck for the findings over the case's fixture
pull-request facts and the pull request's own gate records. Nothing reaches the network.
"""
import json
import re
import unittest
from pathlib import Path

from jsrun import js

ROOT = Path(__file__).resolve().parents[1]
DATA = Path(__file__).with_suffix(".md")
PROCESS = "docs/process.md"
LEAD = "The job rules hold for every pull request; no condition is added."
JOB_RULES = 5

JS_CHECK = """
const input = %s;
const files = input.files;
const declared = documents.readDocument(productProcess.declarationSchema, 'docs/process.md', files['docs/process.md']);
const snapshot = { repository: { server: 'github', origin: 'https://github.com', path: 'instance/agent-m', web: 'https://github.com/instance/agent-m' },
  ref: 'main', commit: '0'.repeat(40), paths: Object.keys(files), read: async (p) => files[p] ?? null, blob: () => null };
const cat = await modelCatalogue.catalogue(snapshot);
const model = cat.models.find((m) => m.path === declared.fields.model_file);
const workflow = productProcess.workflowOf(declared, model, [], '');
const gate = workflow.gates.find((g) => g.from === 'Development' && g.to === 'Release testing').name;
const records = input.gates.map((decision, i) => documents.readDocument(productProcess.gateSchema, `docs/gates/20261018-010${i}-development-release-testing-abcd.md`,
  ['---', `gate: ${gate}`, 'job:', 'decider: po-opus-b', 'role: Product Owner', `decision: ${decision}`, 'on:',
   '  - ' + 'c'.repeat(40), '  - https://github.com/instance/agent-m/pull/834', `date: 2026-10-18 01:0${i} UTC`, '---', '# gate', '', '**REGISTER**', ''].join('\\n')));
const texts = input.case.facts.texts;
const facts = { ...input.case.facts, pullRequest: { ...input.case.facts.pullRequest, url: 'https://github.com/instance/agent-m/pull/834' }, read: async (path, side) => texts[`${side}:${path}`] ?? null };
const modules = [{ fields: { id: 'MOD-product-process', folder: 'src/product-process/' } }];
const found = await productProcess.doneCheck(facts, workflow, modules, records, input.case.job);
return { done: workflow.done, findings: found.map((f) => [f.artifact, f.rule, f.what]) };
"""


def sections() -> list[dict]:
    text = DATA.read_text(encoding="utf-8")
    found = []
    for match in re.finditer(r"^## (?P<name>[^\n]+)\n(?P<body>.*?)(?=^## |\Z)", text, re.M | re.S):
        block = re.search(r"^### Case\n\n```json\n(.*?)\n```", match.group("body"), re.M | re.S)
        if not block:
            raise AssertionError(f"missing Case block under {match.group('name')}")
        found.append({"name": match.group("name"), "case": json.loads(block.group(1))})
    if not found:
        raise AssertionError("no cases loaded")
    return found


def process_text(declared: list) -> str:
    """The repository's own docs/process.md with the declared condition lines under its Definition of Done."""
    text = (ROOT / PROCESS).read_text(encoding="utf-8")
    assert LEAD in text, "docs/process.md no longer says that no condition is added"
    return text.replace(LEAD, "\n".join([LEAD, *declared]) if declared else LEAD)


def run(case: dict) -> dict:
    files = {path.relative_to(ROOT).as_posix(): path.read_text(encoding="utf-8")
             for path in sorted((ROOT / "docs" / "process-models").glob("*.md"))}
    files[PROCESS] = process_text(case["declare"])
    return js(JS_CHECK % json.dumps({"files": files, "gates": case["gates"], "case": case}))


def of_group(group: str) -> list[dict]:
    chosen = [s for s in sections() if s["case"]["group"] == group]
    if not chosen:
        raise AssertionError(f"no case of the group {group}")
    return chosen


class TestDefinitionOfDone(unittest.TestCase):
    # TST-788001 · level: release · module: MOD-product-process
    # guards: THE DEFAULT DEFINITION OF DONE IS THE JOB RULES
    # given: this repository's docs/process.md, which declares no condition, and the pull-request cases of the group default beside this file
    # input: workflowOf of the declaration, then doneCheck over each case's facts and its own gate records
    # expect: the workflow's Definition of Done is the five job rules and nothing added; each case returns exactly its declared findings
    def test_without_a_declared_condition_the_job_rules_apply(self):
        for loaded in of_group("default"):
            with self.subTest(case=loaded["name"]):
                result = run(loaded["case"])
                self.assertEqual(len(result["done"]), JOB_RULES, result["done"])
                self.assertEqual(result["findings"], loaded["case"]["expected"])

    # TST-788002 · level: release · module: MOD-product-process
    # guards: A PRODUCT DECLARES ITS DEFINITION OF DONE
    # given: a copy of docs/process.md with the line `check: lint` (no list dash) under its Definition of Done, and the cases of the group declared
    # input: workflowOf of the declaration, then doneCheck over each case's facts
    # expect: the workflow's Definition of Done is the five job rules and then the declared condition; a case whose head lacks a successful lint check returns exactly the finding that the condition does not hold, and one with it returns none
    def test_a_declared_condition_is_added_to_the_job_rules(self):
        for loaded in of_group("declared"):
            with self.subTest(case=loaded["name"]):
                result = run(loaded["case"])
                self.assertEqual(result["done"][JOB_RULES:], loaded["case"]["workflowDoneExtra"])
                self.assertEqual(result["findings"], loaded["case"]["expected"])

    # TST-788003 · level: release · module: MOD-product-process
    # guards: A PULL REQUEST IS MERGED ONLY WHEN THE DEFINITION OF DONE HOLDS
    # given: every case beside this file, each missing exactly one condition or meeting all of them
    # input: doneCheck over each case's facts
    # expect: a case missing one condition gives exactly one finding and is not mergeable; a case with all conditions met gives none and is mergeable
    def test_a_pull_request_missing_one_condition_is_not_mergeable(self):
        for loaded in sections():
            with self.subTest(case=loaded["name"]):
                found = run(loaded["case"])["findings"]
                if loaded["case"]["mergeable"]:
                    self.assertEqual(found, [])
                else:
                    self.assertEqual(len(found), 1, found)
