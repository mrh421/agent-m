# Module: MOD-trace-graph
# Guards: A REFERENCE NAMES THE IDENTIFIER, NOT THE POSITION
# Level: unit
"""SPEC §1 A REFERENCE NAMES THE IDENTIFIER, NOT THE POSITION — a cross-reference names the identifier it points at,
never a section number or line number.

MOD-trace-graph traceGraph(source) links artifacts by the identifiers they state: a requirement by its name, a use case,
decision, module or test by its identifier, whatever section, line or file name it stands in. A reference by position — a
section number, a line number, a file and line — names no identifier, so it reaches no artifact and is kept among the
unknown names of coverageGaps, where the gaps show it. The files are the fixture product tests/fixtures/architecture/, its
test written here with a declaration.
"""
import json
import unittest
from pathlib import Path

from jsrun import js

FIX = Path(__file__).resolve().parent / "fixtures" / "architecture"
TEST = "tests/reader.test.js"
# The fixture's test, with one declaration that guards RULE ONE, written from parts so that this file declares no test by it.
TEST_TEXT = ("// Module: MOD-reader\n" + " ".join(["//", "TST-100001", "·", "level: unit", "·", "module: MOD-reader"])
             + "\n// guards: RULE ONE\n// given: nothing\n// input: nothing\n// expect: nothing\ntest(\"reads\", () => {});\n")
# The fixture keeps its test file as tests/reader.test.js.fixture, so that node --test tests/ does not run it; FILES builds it back under its name.
FILES = {**{p.relative_to(FIX).as_posix().removesuffix(".fixture"): p.read_text(encoding="utf-8") for p in sorted(FIX.rglob("*")) if p.is_file()},
         TEST: TEST_TEXT}
UC1, UC2 = "docs/use-cases/UC-001-read-a-file.md", "docs/use-cases/UC-002-show-the-status.md"
READER = "docs/architecture/MOD-reader.md"
NAMES = ["RULE ONE", "THE READER'S RULE"]


def edited(files: dict, path: str, old: str, new: str) -> dict:
    assert old in files[path], (path, old)
    return {**files, path: files[path].replace(old, new)}


def view(files: dict) -> dict:
    """What the graph links: each requirement's row, each requirement's impact list, and the unknown names with what names
    them."""
    return js(f"const files = {json.dumps(files)};"
              "const g = await traceGraph.traceGraph({ paths: Object.keys(files), read: async (p) => files[p] ?? null });"
              f"return {{ rows: Object.fromEntries({json.dumps(NAMES)}.map((n) => [n, traceGraph.tracesTo(g, n)])),"
              "  impact: Object.fromEntries(" + json.dumps(NAMES) + ".map((n) => [n, traceGraph.requirementImpact(g, n)])),"
              "  unknown: traceGraph.coverageGaps(g).unknownNames };")


class ReferencesByIdentifier(unittest.TestCase):
    def test_moving_a_requirement_or_renaming_a_file_moves_no_reference(self):
        before = view(FILES)
        # The SPEC renumbered and RULE ONE moved below THE READER'S RULE, into a section of its own.
        spec = FILES["SPEC.md"]
        rule_one = "**RULE ONE** *(PO, 2026-09-30)*\nThe first rule.\n*Check:* none\n\n"
        assert rule_one in spec
        moved = spec.replace("## 1. Rules", "## 3. Rules").replace(rule_one, "")
        moved = moved.replace("**OLD RULE**", "## 7. Moved\n\n" + rule_one + "**OLD RULE**")
        files = {**FILES, "SPEC.md": moved}
        # The use case's file renamed — its identifier stays.
        files[UC1.replace("read-a-file", "reading-files")] = files.pop(UC1)
        after = view(files)
        self.assertEqual(after["rows"], before["rows"])
        self.assertEqual([[(a["id"], a["via"]) for a in after["impact"][n]] for n in NAMES],
                         [[(a["id"], a["via"]) for a in before["impact"][n]] for n in NAMES])
        self.assertEqual(after["unknown"], before["unknown"])
        self.assertEqual([a["path"] for a in after["impact"]["RULE ONE"] if a["id"] == "UC-001"],
                         ["docs/use-cases/UC-001-reading-files.md"], "found under its new path, by its identifier")

    def test_counter_proof_a_reference_by_position_reaches_nothing(self):
        # RULE ONE stands in section 1 of the SPEC, at line 7 — a use case, a module and a test that point there by position
        # reach no requirement: the row of RULE ONE does not grow, and each position is an unknown name.
        files = edited(FILES, UC2, "  - THE READER'S RULE\n", "  - THE READER'S RULE\n  - §1\n")
        files = edited(files, READER, "  - RULE ONE\n", "  - RULE ONE\n  - SPEC.md:7\n")
        files = edited(files, TEST, "// guards: RULE ONE\n", "// guards: RULE ONE; section 1\n")
        v = view(files)
        self.assertEqual(v["rows"]["RULE ONE"], view(FILES)["rows"]["RULE ONE"])
        unknown = {u["name"]: [p["id"] for p in u["namedBy"]] for u in v["unknown"]}
        self.assertEqual(unknown["§1"], ["UC-002"])
        self.assertEqual(unknown["SPEC.md:7"], ["MOD-reader"])
        self.assertEqual(unknown["section 1"], ["TST-100001"])

    def test_counter_proof_a_name_spelled_otherwise_is_another_name(self):
        # The identifier is the name exactly as the SPEC writes it: a name in other letters or with its apostrophe changed
        # is not the requirement, wherever it stands.
        files = edited(FILES, UC2, "  - THE READER'S RULE\n", "  - THE READERS RULE\n")
        v = view(files)
        self.assertEqual(v["rows"]["THE READER'S RULE"]["useCases"], [])
        self.assertIn("THE READERS RULE", [u["name"] for u in v["unknown"]])


if __name__ == "__main__":
    unittest.main()
