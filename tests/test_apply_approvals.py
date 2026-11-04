# Module: MOD-workflow-entries
# Guards: A STALE APPROVAL IS NOT APPLIED; AN ACCEPTED SPEC CHANGE IS WRITTEN WITH ITS APPROVAL; WITHOUT A TOKEN, THE INSTANCE'S WORKFLOW WRITES THE CHANGE
# Level: unit
"""The workflow half of SPEC §10 — MOD-workflow-entries' entry onApprovalsCommitted writes the approved SPEC changes with MOD-spec-changes'
applyApproved, asked here through tests/spec_apply.py. Deterministic, no network.

Guards WITHOUT A TOKEN, THE INSTANCE'S WORKFLOW WRITES THE CHANGE and A STALE APPROVAL IS NOT APPLIED.
Each test builds a throwaway repository, so nothing here touches the real SPEC.
"""
from __future__ import annotations

import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

import spec_apply as ap  # noqa: E402

SPEC = """# S

**VERBINDLICH (SPEC)**

## 1. One

old one
## 2. Two

old two
"""
Q = "docs/spec-freigaben/2026-09-24_x"
PROPOSAL = "## 2. Two\n\nnew two, approved verbatim — äöü\n"


def git_hash(data: str) -> str:
    return subprocess.run(["git", "hash-object", "--stdin"], input=data.encode(),
                          capture_output=True, check=True).stdout.decode().strip()


class Repo:
    def __init__(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        (self.root / Q).mkdir(parents=True)
        (self.root / "docs/approvals").mkdir(parents=True)
        (self.root / "SPEC.md").write_text(SPEC, encoding="utf-8")
        (self.root / Q / "index.md").write_text(
            "# SPEC approvals — queue 2026-09-24 · x\n\n**Zieldatei aller Einträge:** `SPEC.md`\n\n"
            "| Nr | Datei | Anker (Überschrift, wortgetreu) | bis (exklusiv) | Commits |\n|---|---|---|---|---|\n"
            "| 01 | `SPEC.md` | ## 2. Two | — | — |\n", encoding="utf-8")
        (self.root / Q / "01-zwei.md").write_text(PROPOSAL, encoding="utf-8")
        (self.root / Q / "entscheidungen.md").write_text("# D\n\n", encoding="utf-8")

    def section_sha(self):
        return ap.blob_sha(ap.section_text(ap.extract_section((self.root / "SPEC.md").read_text(), "## 2. Two")))

    def record(self, **over):
        rec = {"kind": "spec", "queue": Q, "entry": "01", "proposal": f"{Q}/01-zwei.md",
               "blob": git_hash(PROPOSAL), "target": "SPEC.md", "anchor": "## 2. Two",
               "section": self.section_sha()}
        rec.update(over)
        name = f"spec-{os.path.basename(Q)}-01-{rec['blob'][:12]}.md"
        (self.root / "docs/approvals" / name).write_text(ap.record_text(rec), encoding="utf-8")
        return name

    def spec(self):
        return (self.root / "SPEC.md").read_text(encoding="utf-8")

    def decisions(self):
        return (self.root / Q / "entscheidungen.md").read_text(encoding="utf-8")


class ApplyTests(unittest.TestCase):
    def setUp(self):
        self.r = Repo()

    def tearDown(self):
        self.r.tmp.cleanup()

    def test_blob_sha_equals_git(self):
        for s in ["", "a\n", "äöü — ✓\n", "x" * 3000]:
            self.assertEqual(ap.blob_sha(s), git_hash(s))

    def test_approved_proposal_is_written_verbatim(self):
        name = self.r.record()
        rc, report = ap.apply(self.r.root)
        self.assertEqual(rc, 0, report)
        self.assertEqual(self.r.spec(), "# S\n\n**VERBINDLICH (SPEC)**\n\n## 1. One\n\nold one\n" + PROPOSAL)
        self.assertIn(f"| 1 | uebernommen | approval:{name} |", self.r.decisions())

    def test_second_run_changes_nothing(self):
        self.r.record()
        ap.apply(self.r.root)
        spec, dec = self.r.spec(), self.r.decisions()
        rc, _ = ap.apply(self.r.root)
        self.assertEqual((rc, self.r.spec(), self.r.decisions()), (0, spec, dec))

    def test_stale_proposal_is_not_applied(self):
        self.r.record()
        (self.r.root / Q / "01-zwei.md").write_text(PROPOSAL + "edited after approval\n", encoding="utf-8")
        rc, report = ap.apply(self.r.root)
        self.assertEqual(rc, 1)
        self.assertEqual(self.r.spec(), SPEC)
        self.assertNotIn("uebernommen", self.r.decisions())
        self.assertIn("proposal changed", report)

    def test_stale_section_is_not_applied(self):
        self.r.record()
        (self.r.root / "SPEC.md").write_text(SPEC.replace("old two", "changed meanwhile"), encoding="utf-8")
        rc, report = ap.apply(self.r.root)
        self.assertEqual(rc, 1)
        self.assertIn("changed meanwhile", self.r.spec())
        self.assertIn("SPEC section changed", report)

    def test_record_anchor_must_match_the_queue(self):
        self.r.record(anchor="## 1. One")
        rc, report = ap.apply(self.r.root)
        self.assertEqual((rc, self.r.spec()), (1, SPEC))
        self.assertIn("anchor", report)

    def test_record_outside_a_queue_is_refused(self):
        self.r.record(proposal="SPEC.md")
        rc, report = ap.apply(self.r.root)
        self.assertEqual((rc, self.r.spec()), (1, SPEC))
        self.assertIn("proposal", report)

    def test_readme_with_example_records_is_not_a_record(self):
        # Found end-to-end on 2026-09-23: docs/approvals/README.md documents the record format
        # with example lines and was read as a record.
        (self.r.root / "docs/approvals/README.md").write_text(
            "# Records\n\n```\nkind: spec\nqueue: docs/spec-freigaben/<queue>\nentry: 01\n"
            "proposal: docs/spec-freigaben/<queue>/01-x.md\nblob: <sha>\ntarget: SPEC.md\n"
            "anchor: ## x\nsection: <sha>\n```\n", encoding="utf-8")
        rc, report = ap.apply(self.r.root)
        self.assertEqual((rc, report, self.r.spec()), (0, "", SPEC))

    # TST-1397001 · level: unit · module: MOD-spec-changes
    # guards: WITHOUT A TOKEN, THE INSTANCE'S WORKFLOW WRITES THE CHANGE; THE REPLACED TEXT STAYS REACHABLE
    # given: a record of kind spec naming the queue docs/spec-freigaben/missing, which the repository does not hold, beside the fixture queue
    # input: the workflow's apply over the repository
    # expect: the record is left alone, as applyApproved works only on records whose queue the snapshot holds: rc 0, no report, SPEC.md unchanged, no crash
    def test_unknown_queue_is_left_alone_not_crashed(self):
        self.r.record(queue="docs/spec-freigaben/missing", proposal="docs/spec-freigaben/missing/01-x.md")
        rc, report = ap.apply(self.r.root)
        self.assertEqual((rc, report, self.r.spec()), (0, "", SPEC))

    def test_use_case_records_are_left_alone(self):
        (self.r.root / "docs/approvals/UC-001-aaaaaaaaaaaa.md").write_text(
            "kind: use-case\nfile: docs/use-cases/UC-001-x.md\nblob: " + "a" * 40 + "\n", encoding="utf-8")
        rc, _ = ap.apply(self.r.root)
        self.assertEqual((rc, self.r.spec()), (0, SPEC))


class DashboardCommitTests(unittest.TestCase):
    """AN ACCEPTED SPEC CHANGE IS WRITTEN WITH ITS APPROVAL: with a token, the dashboard commits the record,
    the SPEC section and the decision row together. The workflow then runs on that commit (it touches
    docs/approvals/) and must not apply the record a second time."""

    def setUp(self):
        self.a, self.b = Repo(), Repo()

    def tearDown(self):
        self.a.tmp.cleanup()
        self.b.tmp.cleanup()

    def dashboard_commit(self, repo: Repo) -> list:
        """The dashboard's acceptance commit of entry 01 as shown (MOD-spec-changes' acceptEntries), written into `repo` -> its paths."""
        shown = {"queue": Q, "entry": 1, "proposalBlob": git_hash(PROPOSAL), "sectionBlob": repo.section_sha()}
        refused, paths = ap.accept(repo.root, [shown], "2026-09-29T16:03:00Z")
        self.assertEqual(refused, [])
        return paths

    def test_dashboard_writes_what_the_workflow_writes(self):
        self.dashboard_commit(self.a)
        name = self.b.record()
        rc, _ = ap.apply(self.b.root)
        self.assertEqual(rc, 0)
        self.assertEqual(self.a.spec(), self.b.spec())
        self.assertEqual([p.name for p in (self.a.root / "docs/approvals").iterdir()], [name])
        strip = lambda t: [l.split("|", 2)[2] for l in t.splitlines() if l.startswith("| 20")]  # noqa: E731
        self.assertEqual(strip(self.a.decisions()), strip(self.b.decisions()))

    def test_record_whose_decision_row_exists_is_skipped(self):
        # After the dashboard's commit the SPEC section no longer has the SHA the record names — it
        # holds the proposal now. Applied again, the workflow would refuse it as stale and fail.
        self.dashboard_commit(self.a)
        spec, dec = self.a.spec(), self.a.decisions()
        rc, report = ap.apply(self.a.root)
        self.assertEqual((rc, report, self.a.spec(), self.a.decisions()), (0, "", spec, dec))


ARC_FILE = "docs/architecture/ARC-001-static-client.md"
MOD_FILE = "docs/architecture/MOD-reader.md"


class ApplierPassesOverArchitectureRecords(unittest.TestCase):
    """Moved from tests/test_approval_records.py (MOD-artifacts) when it was split by module: the applier is MOD-spec-changes' applyApproved."""
    def test_the_applier_passes_over_architecture_records(self):
        # applyApproved writes SPEC changes only; an architecture record must neither be applied nor refused.
        import tempfile
        with tempfile.TemporaryDirectory() as d:
            (Path(d) / "docs" / "approvals").mkdir(parents=True)
            (Path(d) / "docs" / "approvals" / ("ARC-001-" + "a" * 12 + ".md")).write_text(
                "kind: architecture-decision\nfile: " + ARC_FILE + "\nblob: " + "a" * 40 + "\n", encoding="utf-8")
            (Path(d) / "docs" / "approvals" / ("MOD-reader-" + "b" * 12 + ".md")).write_text(
                "kind: module\nfile: " + MOD_FILE + "\nblob: " + "b" * 40 + "\n", encoding="utf-8")
            self.assertEqual(ap.apply(Path(d)), (0, ""))


if __name__ == "__main__":
    unittest.main()
