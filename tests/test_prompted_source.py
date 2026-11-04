# Module: MOD-spec-changes
# Guards: THE PERSON WHO PROMPTS IS A SOURCE
# Level: release
"""SPEC section 1 - the check named tests/test_prompted_source.py.

The cases live in tests/test_prompted_source.md. This file loads them and asks MOD-source-register for the prompting
person's source and MOD-spec-changes for the sections that would be saved.
"""
import json
import re
import unittest
from pathlib import Path

from jsrun import js

DATA = Path(__file__).with_suffix(".md")

JS_CHECK = """
const schemas = sourceRegister.sourceSchemas();
const SHA = "0".repeat(64);
const text = (...lines) => `${lines.join("\\n")}\\n`;
function entryText(entry) {
  return text("---", `id: ${entry.id}`, `title: ${entry.title}`, `kind: ${entry.kind}`,
    "authority: normative", "licence: may be republished - fixture",
    ...(entry.identifier === null || entry.identifier === undefined ? [] : [`identifier: ${entry.identifier}`]),
    "---", `# ${entry.id} ${entry.title}`, "", "A fixture source.", "", "## Versions", "",
    "| Version | Date | Edition | Read from | Files |", "|---|---|---|---|---|",
    "| `2026-10-13` | 2026-10-13 | fixture | this repository | one file, hashed only |");
}
function entryDocument(entry) {
  return documents.readDocument(schemas.entry, `docs/sources/${entry.id}.md`, entryText(entry));
}
function linksDocument(linked) {
  const rows = linked.map((id) => `| ${id} | 2026-10-13 | ${SHA} | |`);
  return documents.readDocument(schemas.links, "docs/sources.md", text("# The sources this product meets", "",
    "| Source | Version | Hash | Part |", "|---|---|---|---|", ...rows));
}
function promptedSourceResult(input) {
  const links = linksDocument(input.linked ?? []);
  const register = (input.entries ?? []).map(entryDocument);
  const source = sourceRegister.personSource(links, register, input.account);
  if (source === null) return { source, sections: [] };
  return {
    source,
    sections: specChanges.entrySections(input.spec, { candidates: input.candidates ?? [] }, input.classes ?? [], source)
  };
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
    return js(JS_CHECK + "return promptedSourceResult(%s);" % json.dumps(case))


class TestPromptedSource(unittest.TestCase):
    # TST-416100 · level: release · module: system
    # guards: THE PERSON WHO PROMPTS IS A SOURCE
    # given: Markdown fixture cases with source register entries, links, a product SPEC and prompted candidates
    # input: personSource followed by entrySections when the prompting person has a linked source
    # expect: a linked person's source is added to every drafted requirement, and an unlinked person sends no sections
    def test_prompted_requirement_changes_use_the_persons_linked_source(self):
        loaded = cases()
        self.assertEqual(len(loaded), 2)
        for item in loaded:
            with self.subTest(case=item["name"]):
                self.assertEqual(result(item["case"]), item["case"]["expected"])

    # TST-416101 · level: release · module: system
    # guards: THE PERSON WHO PROMPTS IS A SOURCE
    # given: the linked and unlinked prompt cases
    # input: the loaded expected results
    # expect: the data contains both the positive source path and the no-send path for a person without a linked source
    def test_cases_cover_linked_source_and_no_send_path(self):
        expected = [case["case"]["expected"] for case in cases()]
        linked = next(item for item in expected if item["source"] == "SRC-alice")
        self.assertTrue(linked["sections"])
        self.assertTrue(all("SRC-alice, prompt" in section["text"] for section in linked["sections"]))
        self.assertIn({"source": None, "sections": []}, expected)


if __name__ == "__main__":
    unittest.main()
