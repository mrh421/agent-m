# Module: MOD-spec-document
# Guards: A REQUIREMENT HAS FOUR FIELDS
# Level: unit
"""The check named tests/test_requirement_fields.py, for A REQUIREMENT HAS FOUR FIELDS: "A requirement consists of a name, a
source, a rule, and a check."

The cases live in tests/test_requirement_fields.md. This file only loads them and asks node to run the real code of
MOD-spec-document: parseSpec reads each fixture SPEC, requirementFindings reports its findings, of which those under A REQUIREMENT
HAS FOUR FIELDS are compared. A requirement in the SPEC's form with its four fields - and nothing more, its source named as it is
written - is read with them and has no finding; the counter-proofs leave out its source, its rule or its check, and each is then
an error at the requirement's line naming the missing field. The texts are the cases' own, never Agent M's SPEC.md.
"""
import json
import re
import unittest
from pathlib import Path

from jsrun import js

DATA = Path(__file__).with_suffix(".md")
RULE = "A REQUIREMENT HAS FOUR FIELDS"


def cases(section: str, data: Path = DATA) -> list[dict]:
    text = data.read_text(encoding="utf-8")
    body = re.search(rf"^## {re.escape(section)}\n(.*?)(?=^## |\Z)", text, re.M | re.S)
    if not body:
        raise AssertionError(f"missing section {section}")
    found = [{"name": m.group(1), "case": json.loads(m.group(2))}
             for m in re.finditer(r"^### ([^\n]+)\n\n```json\n(.*?)\n```", body.group(1), re.M | re.S)]
    if not found:
        raise AssertionError(f"no cases under {section}")
    return found


def read(spec: str) -> dict:
    return js(f"const s = specDocument.parseSpec({json.dumps(spec)});"
              f"return {{ requirements: Object.fromEntries(s.requirements), findings: specDocument.requirementFindings(s)"
              f".filter((f) => f.rule === {json.dumps(RULE)}).map((f) => f.artifact + ':' + f.line + ': ' + f.kind + ': ' + f.what) }};")


def check(test: unittest.TestCase, section: str) -> None:
    for loaded in cases(section):
        with test.subTest(case=loaded["name"]):
            got = read(loaded["case"]["input"]["spec"])
            wanted = loaded["case"]["expected"]
            for name, fields in wanted.get("fields", {}).items():
                test.assertIn(name, got["requirements"])
                test.assertEqual({key: got["requirements"][name][key] for key in fields}, fields, name)
            test.assertEqual(got["findings"], wanted["findings"])


class RequirementFields(unittest.TestCase):
    # TST-1302011 · level: unit · module: MOD-spec-document
    # guards: A REQUIREMENT HAS FOUR FIELDS
    # given: the cases under "A requirement consists of a name, a source, a rule, and a check" in the Markdown file beside this one: requirements in the SPEC's form with exactly the four fields, a source named as it is written or by its identifier, a check over two lines
    # input: parseSpec and requirementFindings for each
    # expect: each requirement is read with its name, source, rule and check as written; no finding under A REQUIREMENT HAS FOUR FIELDS
    def test_a_requirement_with_name_source_rule_and_check_is_complete(self):
        check(self, "A requirement consists of a name, a source, a rule, and a check")

    # TST-1201002 · level: unit · module: MOD-spec-document
    # guards: A REQUIREMENT HAS FOUR FIELDS
    # given: the counter-proofs: the requirement of the first case with its source, its rule or its check left out
    # input: parseSpec and requirementFindings for each
    # expect: one error under A REQUIREMENT HAS FOUR FIELDS at the requirement's head line, naming the missing field
    def test_a_requirement_missing_one_of_the_four_fields_is_an_error(self):
        check(self, RULE + ": counter-proofs")


if __name__ == "__main__":
    unittest.main()
