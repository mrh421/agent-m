# Module: MOD-trace-graph
# Guards: A REQUIREMENT IS NOT CHANGED WITHOUT AN IMPACT LIST
# Level: unit
"""SPEC §3 A REQUIREMENT IS NOT CHANGED WITHOUT AN IMPACT LIST — before an existing requirement is changed, the artifacts
that reference it are listed, and the list is part of the proposal rather than a result reported afterwards.

MOD-trace-graph requirementImpact(graph, name) lists every place an artifact names a requirement — the use cases realising
it, the decisions it forces, the modules realising it and the tests guarding it —, over the graph traceGraph builds from the
files of the commit the proposal is shown at. The proposal carries that list: MOD-spec-changes' entryView, which shows an
open queue entry, names every requirement the entry changes, withdraws or adds with what references it, taken from
requirementImpact over the graph stored for the commit (tests/stored-graph-fake.mjs stores it as the workflow does). The files
are the fixture product tests/fixtures/architecture/, its test written here with a declaration, and one queue entry added.
"""
import json
import unittest
from pathlib import Path

from jsrun import js

FIX = Path(__file__).resolve().parent / "fixtures" / "architecture"
STORED_GRAPH_FAKE = (Path(__file__).resolve().parent / "stored-graph-fake.mjs").as_uri()
TEST = "tests/reader.test.js"
# The fixture's test, with one declaration on its second line, written from parts so that this file declares no test by it.
TEST_TEXT = ("// Module: MOD-reader\n" + " ".join(["//", "TST-100001", "·", "level: unit", "·", "module: MOD-reader"])
             + "\n// guards: RULE ONE\n// given: nothing\n// input: nothing\n// expect: nothing\ntest(\"reads\", () => {});\n")
# The fixture keeps its test file as tests/reader.test.js.fixture, so that node --test tests/ does not run it; FILES builds it back under its name.
FILES = {**{p.relative_to(FIX).as_posix().removesuffix(".fixture"): p.read_text(encoding="utf-8") for p in sorted(FIX.rglob("*")) if p.is_file()},
         TEST: TEST_TEXT}
UC1, UC2 = "docs/use-cases/UC-001-read-a-file.md", "docs/use-cases/UC-002-show-the-status.md"
QUEUE = "docs/spec-freigaben/2026-10-01_rules"
ENTRY = f"{QUEUE}/01-rules.md"
INDEX = f"{QUEUE}/index.md"
# The entry replaces the section: RULE ONE changed in its rule, THE READER'S RULE left out, RULE NEW added, OLD RULE as it is.
PROPOSAL = """## 1. Rules

**RULE ONE** *(PO, 2026-09-30, reworded 2026-10-01)*
The first rule, reworded.
*Check:* none

**RULE NEW** *(PO, 2026-10-01)*
A new rule.
*Check:* none

**OLD RULE** *(PO, 2026-09-29, reworded 2026-09-29 —
withdrawn 2026-09-30)*
*Withdrawn:* replaced by `RULE ONE`. The name is not reused.

**Form of a requirement** — prose in bold, not a requirement.
"""


def index_naming(anchor: str) -> str:
    """A queue index in the form the queues of this repository use, naming entry 01's anchor."""
    return ("# SPEC approvals — queue 2026-10-01_rules\n\n**Zieldatei aller Einträge:** `SPEC.md`\n\n"
            "| Nr | Datei | Anker (Überschrift, wortgetreu) | bis (exklusiv) | Commits |\n|---|---|---|---|---|\n"
            f"| 01 | `SPEC.md` | {anchor} | — | — |\n")


def with_entry(text: str, anchor: str = "## 1. Rules") -> dict:
    """The fixture with the queue: its index naming entry 01's anchor, the entry and its rationale."""
    return {**FILES, INDEX: index_naming(anchor), ENTRY: text,
            f"{QUEUE}/01-rules.begruendung.md": "# 1. Rules: a change\n\n**The change.** The rules are reworded.\n"}


def impact(files: dict, name: str) -> list:
    """requirementImpact of `name` over the graph traceGraph builds from `files`."""
    return js(f"const files = {json.dumps(files)};"
              "const g = await traceGraph.traceGraph({ paths: Object.keys(files), read: async (p) => files[p] ?? null });"
              f"return traceGraph.requirementImpact(g, {json.dumps(name)});")


def entry_impact(files: dict) -> list:
    """The impact list entryView shows beside entry 01 of the queue, at a commit whose graph is stored, as [name, change,
    referencedBy]."""
    return js(f"const files = {json.dumps(files)}; const {{ withStoredGraph }} = await import({json.dumps(STORED_GRAPH_FAKE)});"
              "const { createHash } = await import('node:crypto');"
              "const blob = (p) => (p in files ? createHash('sha1').update(`blob ${Buffer.byteLength(files[p])}\\0${files[p]}`).digest('hex') : null);"
              "const snapshot = withStoredGraph({ repository: { server: 'github', origin: 'https://github.com', path: 'po/product',"
              "  web: 'https://github.com/po/product' }, ref: 'main', commit: 'c'.repeat(40), paths: Object.keys(files).sort(),"
              "  read: async (p) => files[p] ?? null, blob });"
              f"const view = await specChanges.entryView({json.dumps(QUEUE)}, 1, snapshot);"
              "return view.impact.map((i) => [i.name, i.change, i.referencedBy]);")


class ImpactOfARequirementChange(unittest.TestCase):
    def test_every_artifact_naming_the_requirement_is_listed(self):
        self.assertEqual(impact(FILES, "RULE ONE"), [
            {"id": "UC-001", "kind": "UC", "path": UC1, "line": 8, "via": "realises"},
            {"id": "ARC-001", "kind": "ARC", "path": "docs/architecture/ARC-001-static-client.md", "line": 5,
             "via": "forced_by"},
            {"id": "MOD-reader", "kind": "MOD", "path": "docs/architecture/MOD-reader.md", "line": 6, "via": "realises"},
            {"id": "TST-100001", "kind": "TST", "path": TEST, "line": 2, "via": "guards"},
        ])
        self.assertEqual([a["id"] for a in impact(FILES, "THE READER'S RULE")], ["UC-002", "MOD-review"])

    def test_the_open_entry_is_shown_with_what_it_would_change_and_the_list_of_each_existing_name(self):
        self.assertEqual(entry_impact(with_entry(PROPOSAL)), [
            ["THE READER'S RULE", "withdrawn", ["UC-002", "MOD-review"]],
            ["RULE ONE", "changed", ["UC-001", "ARC-001", "MOD-reader", "TST-100001"]],
            ["RULE NEW", "added", []],
        ])
        # The list is derived at the commit the proposal is shown at: the queue entry changes no list, the SPEC is unchanged.
        self.assertEqual(impact(with_entry(PROPOSAL), "RULE ONE"), impact(FILES, "RULE ONE"))

    def test_a_name_the_spec_no_longer_holds_lists_what_still_names_it(self):
        files = {**FILES, UC2: FILES[UC2].replace("  - THE READER'S RULE\n", "  - THE READER'S RULE\n  - GONE RULE\n")}
        self.assertEqual(impact(files, "GONE RULE"), [{"id": "UC-002", "kind": "UC", "path": UC2, "line": 9, "via": "realises"}])

    def test_counter_proof_what_does_not_name_it_is_not_listed(self):
        self.assertEqual(impact(FILES, "RULE NEW"), [], "nothing names a requirement no artifact states")
        ids = [a["id"] for a in impact(FILES, "THE READER'S RULE")]
        self.assertNotIn("UC-001", ids)
        self.assertNotIn("TST-100001", ids)


# An entry replaces its whole section byte for byte (UC-006 step 6), so a requirement of that section the entry no longer states
# leaves the SPEC when it is accepted — renamed in place or left out —, and is shown as withdrawn with its list (A RENAMED
# REQUIREMENT IS WITHDRAWN AND ADDED: the old name leaves, the new one is added). The section is the one the queue's index names.
READERS_RULE = ("**THE READER'S RULE** *(PO, 2026-09-30, extended\n2026-09-30)*\n"
                "A rule whose source runs over two lines and whose name has an apostrophe.\n*Check:* none\n")
RULE_ONE = "**RULE ONE** *(PO, 2026-09-30)*\nThe first rule.\n*Check:* none\n"
# RULE ONE renamed in place; THE READER'S RULE as the SPEC states it; OLD RULE left out.
RENAMED = ("## 1. Rules\n\n**RULE ONE, RENAMED** *(PO, 2026-10-01)*\nThe first rule, under another name.\n*Check:* none\n\n"
           + READERS_RULE)
# The heading renamed too — the index's anchor, not the entry's first line, names the section; THE READER'S RULE left out.
HEADING_RENAMED = "## 1. Rules of reading\n\n" + RULE_ONE


class AnEntryThatLeavesARequirementOutOfItsSection(unittest.TestCase):
    def test_a_requirement_renamed_in_place_is_shown_as_withdrawn_with_its_list(self):
        rows = {name: (change, by) for name, change, by in entry_impact(with_entry(RENAMED))}
        self.assertEqual(rows["RULE ONE"], ("withdrawn", ["UC-001", "ARC-001", "MOD-reader", "TST-100001"]))
        self.assertEqual(rows["RULE ONE, RENAMED"], ("added", []))
        self.assertNotIn("THE READER'S RULE", rows, "a requirement the entry states as the SPEC does is not touched")

    def test_the_section_is_the_one_the_index_names_not_the_entrys_first_line(self):
        rows = {name: (change, by) for name, change, by in entry_impact(with_entry(HEADING_RENAMED))}
        self.assertEqual(rows.get("THE READER'S RULE"), ("withdrawn", ["UC-002", "MOD-review"]))
        self.assertNotIn("RULE ONE", rows)


if __name__ == "__main__":
    unittest.main()
