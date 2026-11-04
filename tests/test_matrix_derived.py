# Module: MOD-trace-graph
# Guards: THE TRACEABILITY MATRIX IS DERIVED
# Level: unit
"""SPEC §1 THE TRACEABILITY MATRIX IS DERIVED — the traceability matrix is computed from the artifacts and is never
stored as a separately edited document.

MOD-trace-graph traceGraph(source) builds one graph from the files of one commit, handed as a TextSource: the requirements
of the SPEC, the use cases, the decisions and modules, and the test declarations of the test files. tracesTo(graph, name) is
one row of the matrix — everything that names one requirement. The files are the fixture product
tests/fixtures/architecture/, never Agent M's own, its test written here with a declaration; each case edits a copy of it.
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
NOTHING = {"sources": [], "useCases": [], "decisions": [], "modules": [], "tests": [], "items": []}

# The graph `g` traceGraph builds from the files `files`, for the expression that follows.
GRAPH = "const g = await traceGraph.traceGraph({ paths: Object.keys(files), read: async (p) => files[p] ?? null });"


def edited(files: dict, path: str, old: str, new: str) -> dict:
    """A copy of `files` with one replacement in one file; the replaced text must be there."""
    assert old in files[path], (path, old)
    return {**files, path: files[path].replace(old, new)}


def matrix(files: dict, names=("RULE ONE", "THE READER'S RULE")) -> dict:
    """{ name: tracesTo } for each requirement — the rows of the matrix, from one graph of the files."""
    return js(f"const files = {json.dumps(files)};" + GRAPH +
              f"return Object.fromEntries({json.dumps(list(names))}.map((n) => [n, traceGraph.tracesTo(g, n)]));")


class MatrixDerived(unittest.TestCase):
    def test_each_row_is_what_the_artifacts_name(self):
        m = matrix(FILES)
        self.assertEqual(m["RULE ONE"], {"sources": ["PO, 2026-09-30"], "useCases": ["UC-001"], "decisions": ["ARC-001"],
                                         "modules": ["MOD-reader"], "tests": ["TST-100001"], "items": []})
        self.assertEqual(m["THE READER'S RULE"], {"sources": ["PO, 2026-09-30, extended\n2026-09-30"], "useCases": ["UC-002"],
                                                  "decisions": [], "modules": ["MOD-review"], "tests": [], "items": []},
                         "a source that runs over two lines is kept as written")

    def test_an_edited_artifact_changes_the_row_it_names(self):
        # Derived, not stored: a use case that names one more requirement, and a test that guards one more, are in the row at
        # once; nothing else had to be edited.
        files = edited(FILES, UC2, "realises:\n  - THE READER'S RULE\n", "realises:\n  - THE READER'S RULE\n  - RULE ONE\n")
        files = edited(files, TEST, "// guards: RULE ONE\n", "// guards: RULE ONE; THE READER'S RULE\n")
        m = matrix(files)
        self.assertEqual(m["RULE ONE"]["useCases"], ["UC-001", "UC-002"])
        self.assertEqual(m["THE READER'S RULE"]["tests"], ["TST-100001"])
        # And an artifact removed leaves the row.
        gone = {p: t for p, t in FILES.items() if p != UC1}
        self.assertEqual(matrix(gone)["RULE ONE"]["useCases"], [])

    def test_counter_proof_a_stored_matrix_is_not_read(self):
        # A matrix kept by hand beside the artifacts — and a matrix table in a use case — claims links nobody stated. The graph
        # reads the names the artifacts state, so the rows stay as the artifacts give them.
        stored = ("# Traceability matrix\n\n| Requirement | Use case | Module | Test |\n|---|---|---|---|\n"
                  "| RULE ONE | UC-002 | MOD-page | TST-100002 |\n| THE READER'S RULE | UC-001 | MOD-reader | |\n")
        files = {**FILES, "docs/traceability.md": stored, "docs/matrix.md": stored,
                 UC1: FILES[UC1] + "\n" + stored}
        self.assertEqual(matrix(files), matrix(FILES))

    def test_the_graph_is_a_value_of_the_files_alone(self):
        # The same files give the same graph, the files are not changed by building it, and nothing is kept between two
        # builds: a graph of other files does not remember the first.
        r = js(f"const files = {json.dumps(FILES)}; const copy = JSON.stringify(files);"
               "const build = (f) => traceGraph.traceGraph({ paths: Object.keys(f), read: async (p) => f[p] ?? null });"
               "const a = await build(files), b = await build(files), other = await build({});"
               "return [traceGraph.graphText(a) === traceGraph.graphText(b), JSON.stringify(files) === copy,"
               "  traceGraph.tracesTo(a, 'RULE ONE').useCases, traceGraph.tracesTo(other, 'RULE ONE'),"
               "  a.nodes.get('RULE ONE').kind];")
        self.assertEqual(r, [True, True, ["UC-001"], NOTHING, "requirement"])


if __name__ == "__main__":
    unittest.main()
