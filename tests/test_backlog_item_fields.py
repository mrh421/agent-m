# Module: MOD-work-plans
# Guards: A BACKLOG ITEM NAMES WHAT IT REALISES; A BACKLOG ITEM NAMES THE MODULES IT CHANGES; EVERY ARTIFACT NAMES ITS ORIGIN; UC-032
# Level: unit
"""SPEC §13 A BACKLOG ITEM NAMES WHAT IT REALISES — every backlog item names at least one requirement or use case that
it realises; A BACKLOG ITEM NAMES THE MODULES IT CHANGES — every backlog item names the modules of the architecture that its
implementation changes; UC-032: every item names where it came from, a drafted item that realises nothing is rejected, one
that restates an existing item flagged, and an item naming what is not accepted waits for acceptance.

An item is a document of MOD-documents' item schema: documentFindings names an item whose realises is left out, empty or
names something that is neither a requirement's name nor a use case, whose modules are left out or empty, and one that names
no origin. MOD-work-plans' backlogFindings(items, architecture) names an item that realises nothing, one that names no module
the architecture describes, and, as a warning, one that restates another; its itemStates names what an item realises that
is not accepted.

Fixtures: tests/fixtures/backlog/ — the backlog of a small product, and the names it has accepted and the modules its
architecture describes (known.json). Agent M's own backlog is checked as it stands, its use cases by their files, its
modules by docs/architecture/; the SPEC is not read, so its requirement names are checked for their form only.
"""
import json
import re
import unittest
from pathlib import Path

from artifact_checks import DOCS
from jsrun import js

FIX = Path(__file__).resolve().parent / "fixtures" / "backlog"
BACKLOG = FIX / "docs" / "backlog"
KNOWN = json.loads((FIX / "known.json").read_text(encoding="utf-8"))

NAMES = "A BACKLOG ITEM NAMES WHAT IT REALISES"
MODULES = "A BACKLOG ITEM NAMES THE MODULES IT CHANGES"
ORIGIN = "EVERY ARTIFACT NAMES ITS ORIGIN"
ITEM = "docs/backlog/ITM-014-export-thesis-as-pdf.md"


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def files(backlog: Path) -> dict:
    return {f"docs/backlog/{p.name}": read(p) for p in sorted(backlog.glob("ITM-*.md"))}


def architecture_js(modules: list) -> str:
    """JavaScript holding `architecture`: a module file, as a Document, for each of `modules`."""
    return (f"const architecture = {json.dumps(modules)}.map((id) => ({{ kind: 'module', path: `docs/architecture/${{id}}.md`,"
            " id, fields: { id }, sections: [] }));")


def findings(path: str, text: str, others: dict | None = None, modules: list | None = None) -> dict:
    """{ form, backlog }: of one item text, the findings documentFindings gives with the item schema, and those
    backlogFindings gives of it among the other items `others` of its backlog — the fixture backlog's by default —, those of
    its own identifier left out, under the architecture describing `modules` (known.json's by default)."""
    return js("const schema = documents.artifactSchemas().item;"
              + architecture_js(KNOWN["modules"] if modules is None else modules)
              + f"const item = documents.readDocument(schema, {json.dumps(path)}, {json.dumps(text)});"
              f"const others = Object.entries({json.dumps(files(BACKLOG) if others is None else others)})"
              ".map(([p, t]) => documents.readDocument(schema, p, t)).filter((o) => o.id !== item.id);"
              "return { form: documents.documentFindings(schema, item),"
              " backlog: workPlans.backlogFindings([item, ...others], architecture).filter((f) => f.artifact === item.id) };")


def edited(text: str, old: str, new: str) -> str:
    assert text.count(old) == 1, old
    return text.replace(old, new)


def rules(found: list) -> list:
    return [(f["kind"], f["rule"]) for f in found]


TEXT = read(BACKLOG / "ITM-014-export-thesis-as-pdf.md")
REALISES = "realises:\n  - EXPORT IS A PDF\n  - UC-003\n"


class TestAnItemNamesWhatItRealises(unittest.TestCase):
    def test_the_items_of_the_fixture_backlog_have_no_finding(self):
        backlog = files(BACKLOG)
        for path, text in backlog.items():
            self.assertEqual(findings(path, text, backlog), {"form": [], "backlog": []}, path)

    def test_counter_proof_an_item_that_realises_nothing_is_an_error(self):
        for label, text in (("realises: []", edited(TEXT, REALISES, "realises: []\n")),
                            ("no realises", edited(TEXT, REALISES, ""))):
            got = findings(ITEM, text)
            self.assertIn(("error", NAMES), rules(got["form"]), label)
            self.assertEqual([(f["kind"], f["rule"], f["what"]) for f in got["backlog"]],
                             [("error", NAMES, "the item realises nothing")], label)

    def test_counter_proof_a_name_that_is_neither_a_requirement_nor_a_use_case_is_an_error(self):
        for name in ("export is a pdf", "MOD-export", "ARC-003", "ITM-016"):
            got = findings(ITEM, edited(TEXT, REALISES, f"realises:\n  - {name}\n"))
            self.assertEqual(rules(got["form"]), [("error", NAMES)], name)
            self.assertIn(name, got["form"][0]["what"], name)

    def test_counter_proof_realises_that_is_no_list_is_an_error(self):
        got = findings(ITEM, edited(TEXT, REALISES, "realises: EXPORT IS A PDF\n"))
        self.assertEqual(rules(got["form"]), [("error", NAMES)])

    def test_an_item_realising_one_requirement_or_one_use_case_has_no_finding(self):
        for name in ("EXPORT IS A PDF", "UC-003"):
            self.assertEqual(findings(ITEM, edited(TEXT, REALISES, f"realises:\n  - {name}\n")), {"form": [], "backlog": []}, name)

    def test_checking_leaves_the_item_as_it_was(self):
        alone = edited(edited(TEXT, REALISES, "realises: []\n"), "builds_on:\n  - ITM-016\n", "builds_on: []\n")
        out = js("const schema = documents.artifactSchemas().item;" + architecture_js(KNOWN["modules"])
                 + f"const i = documents.readDocument(schema, {json.dumps(ITEM)}, {json.dumps(alone)});"
                 "const before = JSON.stringify(i); const a = workPlans.backlogFindings([i], architecture);"
                 "const b = workPlans.backlogFindings([i], architecture); return [before === JSON.stringify(i), a.length, b.length];")
        self.assertEqual(out, [True, 1, 1])


class TestAnItemNamesTheModulesItChanges(unittest.TestCase):
    """A BACKLOG ITEM NAMES THE MODULES IT CHANGES: an item that names no module, or a module the architecture does not
    describe, is reported; counter-proof: an item naming modules the architecture describes passes."""

    MODULES_LINE = "modules:\n  - MOD-export\n"

    def test_counter_proof_an_item_that_names_no_module_is_reported(self):
        for label, text in (("modules: []", edited(TEXT, self.MODULES_LINE, "modules: []\n")),
                            ("no modules", edited(TEXT, self.MODULES_LINE, ""))):
            got = findings(ITEM, text)
            self.assertIn(("error", MODULES), rules(got["form"]), label)
            self.assertEqual(rules(got["backlog"]), [("error", MODULES)], label)

    def test_counter_proof_an_item_naming_a_module_the_architecture_does_not_describe_is_reported(self):
        got = findings(ITEM, edited(TEXT, self.MODULES_LINE, "modules:\n  - MOD-printing\n"))
        self.assertEqual(got["form"], [])
        self.assertEqual([(f["kind"], f["rule"], f["what"]) for f in got["backlog"]],
                         [("error", MODULES, "the item names no module the architecture describes")])
        self.assertEqual(rules(findings(ITEM, TEXT, modules=["MOD-reader"])["backlog"]), [("error", MODULES)])

    def test_an_item_naming_modules_the_architecture_describes_passes(self):
        self.assertEqual(findings(ITEM, TEXT), {"form": [], "backlog": []})
        self.assertEqual(findings(ITEM, edited(TEXT, self.MODULES_LINE, "modules:\n  - MOD-export\n  - MOD-reader\n")),
                         {"form": [], "backlog": []})


class TestAnItemNamesItsOrigin(unittest.TestCase):
    def test_counter_proof_an_item_without_an_origin_is_an_error(self):
        text = edited(TEXT, "origin:\n  - https://github.com/alice/thesis-tool/issues/57\n", "")
        self.assertEqual(rules(findings(ITEM, text)["form"]), [("error", ORIGIN)])


class TestWhatAnItemRealisesIsAccepted(unittest.TestCase):
    """UC-032 step 1: an item that names a requirement or use case that is not accepted waits for acceptance, naming it."""

    def state(self, text: str, accepted: list) -> dict:
        return js("const schema = documents.artifactSchemas().item;"
                  f"const item = documents.readDocument(schema, {json.dumps(ITEM)}, {json.dumps(text)});"
                  f"const statuses = new Map({json.dumps(accepted)}.map((id) => [id, {{ id, kind: 'requirement', status: 'accepted' }}]));"
                  "return workPlans.itemStates([item], null, { statuses, queues: [], jobs: [], pullRequests: [], gates: [],"
                  " workflow: null })[0];")

    def test_an_item_naming_a_requirement_or_use_case_the_product_has_not_accepted_waits_for_it(self):
        text = edited(TEXT, "builds_on:\n  - ITM-016\n", "builds_on: []\n")
        for name, accepted in (("EXPORT AS PDF", ["UC-003"]), ("UC-009", ["EXPORT IS A PDF"])):
            got = self.state(edited(text, REALISES, f"realises:\n  - {name}\n"), accepted)
            self.assertEqual(got["state"], "waiting for acceptance", name)
            self.assertIn(name, got["reason"], name)
        self.assertEqual(self.state(text, ["EXPORT IS A PDF", "UC-003"])["state"], "ready", "counter-proof: both accepted")


class TestAnItemThatRestatesAnother(unittest.TestCase):
    """UC-032 step 3: a draft that restates an existing item is flagged — a warning, the person decides."""

    COPY = "docs/backlog/ITM-018-export-as-pdf-again.md"

    def copy(self, title: str) -> str:
        text = edited(TEXT, "id: ITM-014\n", "id: ITM-018\n")
        text = edited(text, "# ITM-014 Export the thesis as PDF", f"# ITM-018 {title}")
        return edited(text, "title: Export the thesis as PDF\n", f"title: {title}\n")

    def test_an_item_with_the_title_of_another_is_flagged(self):
        got = findings(self.COPY, self.copy("Export the thesis as PDF"), files(BACKLOG))
        self.assertEqual(got["form"], [])
        self.assertEqual([(f["kind"], f["what"]) for f in got["backlog"]], [("warning", "the item restates ITM-014")])

    def test_counter_proof_an_item_is_not_compared_with_itself_nor_flagged_for_a_different_title(self):
        self.assertEqual(findings(ITEM, TEXT, files(BACKLOG)), {"form": [], "backlog": []})
        self.assertEqual(findings(self.COPY, self.copy("PDF export"), files(BACKLOG)), {"form": [], "backlog": []})


class TestTheJobThatDraftsItems(unittest.TestCase):
    """UC-032 steps 2 and 3: a job definition drafts items for uncovered requirements; a draft that realises nothing is
    rejected and one that restates an existing item flagged."""

    def test_counter_proof_a_draft_that_realises_nothing_is_rejected_and_one_restating_an_item_flagged(self):
        nothing = edited(edited(TEXT, REALISES, "realises: []\n"), "title: Export the thesis as PDF\n", "title: Export faster\n")
        nothing = edited(edited(nothing, "id: ITM-014\n", "id: ITM-018\n"), "# ITM-014 Export the thesis as PDF", "# ITM-018 Export faster")
        got = findings("docs/backlog/ITM-018-export-faster.md", nothing, files(BACKLOG))
        self.assertEqual(rules(got["backlog"]), [("error", NAMES)])
        again = edited(edited(TEXT, "id: ITM-014\n", "id: ITM-018\n"), "# ITM-014 ", "# ITM-018 ")
        got = findings("docs/backlog/ITM-018-export-again.md", again, files(BACKLOG))
        self.assertEqual([(f["kind"], f["what"]) for f in got["backlog"]], [("warning", "the item restates ITM-014")])


class TestAnItemOfFourDigitsNamesWhatItRealises(unittest.TestCase):
    """ITM-<nnn> takes three or more digits (MOD-identifiers, Data)."""

    # The item it builds on, ITM-016, is its only other item: ITM-014, whose title it keeps, is not in its backlog.
    OTHERS = {"docs/backlog/ITM-016-read-the-chapters.md": read(BACKLOG / "ITM-016-read-the-chapters.md")}

    def numbered(self, number) -> str:
        return edited(edited(TEXT, "id: ITM-014\n", f"id: ITM-{number}\n"), "# ITM-014 ", f"# ITM-{number} ")

    def test_an_item_of_four_digits_with_its_names_has_no_finding(self):
        self.assertEqual(findings("docs/backlog/ITM-1000-export-thesis-as-pdf.md", self.numbered(1000), self.OTHERS),
                         {"form": [], "backlog": []})

    def test_an_item_of_three_digits_has_still_no_finding(self):
        self.assertEqual(findings("docs/backlog/ITM-999-export-thesis-as-pdf.md", self.numbered(999), self.OTHERS),
                         {"form": [], "backlog": []})

    def test_counter_proof_an_item_of_two_digits_is_a_finding(self):
        found = findings("docs/backlog/ITM-99-export-thesis-as-pdf.md", self.numbered(99))["form"]
        self.assertTrue(found)
        self.assertTrue(all(f["kind"] == "error" for f in found))


@unittest.skipUnless(any((DOCS / "backlog").glob("ITM-*.md")), "this repository has no backlog items")
class TestAgentMsOwnBacklog(unittest.TestCase):
    OWN = DOCS / "backlog"

    def test_every_item_of_this_repository_names_what_it_realises_the_modules_it_changes_and_where_it_came_from(self):
        use_cases = sorted({re.match(r"UC-\d{3}", p.name).group(0) for p in (DOCS / "use-cases").glob("UC-*.md")})
        self.assertIn("UC-032", use_cases)
        # The module files are read by node with its own fs: their names, written into the expression, would make
        # tests/jsrun.py import the modules they name.
        found = js(f"const fs = await import('node:fs'); const dir = {json.dumps(str(self.OWN))};"
                   "const schema = documents.artifactSchemas().item;"
                   "const items = fs.readdirSync(dir).filter((n) => /^ITM-.*\\.md$/.test(n)).sort()"
                   ".map((n) => documents.readDocument(schema, 'docs/backlog/' + n, fs.readFileSync(dir + '/' + n, 'utf8')));"
                   f"const architecture = fs.readdirSync({json.dumps(str(DOCS / 'architecture'))})"
                   ".filter((n) => /^MOD-.*\\.md$/.test(n)).map((n) => n.slice(0, -3))"
                   ".map((id) => ({ kind: 'module', path: `docs/architecture/${id}.md`, id, fields: { id }, sections: [] }));"
                   f"const rules = new Set({json.dumps([NAMES, MODULES, ORIGIN])});"
                   "const form = items.flatMap((i) => documents.documentFindings(schema, i)"
                   ".filter((f) => f.kind === 'error' && rules.has(f.rule)).map((f) => [i.path, f.what]));"
                   "const backlog = workPlans.backlogFindings(items, architecture).filter((f) => f.kind === 'error'"
                   " && rules.has(f.rule)).map((f) => [f.artifact, f.what]);"
                   "return { count: items.length, modules: architecture.length, form, backlog,"
                   " realised: items.flatMap((i) => i.fields.realises ?? []) };")
        self.assertEqual(found["modules"], len(list((DOCS / "architecture").glob("MOD-*.md"))), "node read every module file")
        self.assertIn("MOD-work-plans.md", [p.name for p in (DOCS / "architecture").glob("MOD-*.md")])
        self.assertEqual(found["form"], [])
        self.assertEqual(found["backlog"], [])
        self.assertEqual(sorted({n for n in found["realised"] if re.match(r"^UC-", n)} - set(use_cases)), [],
                         "every use case an item realises is one of docs/use-cases/")
        self.assertEqual(found["count"], len(files(self.OWN)), "node read every item file Python sees")


if __name__ == "__main__":
    unittest.main()
