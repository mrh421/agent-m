# Module: MOD-release-evidence
# Guards: THE AUDIT VIEW LISTS EVERY REQUIREMENT OF THE RELEASE
# Level: release
"""SPEC §12 — the check named tests/test_audit_view.py.

The cases live in tests/test_audit_view.md. This file loads them and asks MOD-release-evidence for the audit of the release (auditRows), so the release check uses the same derivation the audit page uses: one row for
each requirement valid at the release, with the tests that guard it and their outcomes on the release commit, and the acceptance of the release test report — a requirement with no test or no passing outcome included.

Written for the release testing of sprint 142 by developer-sonnet-k (ITM-775), who implemented none of the audit (its code carries the Agent-M-Participant trailers of developer-sonnet-a, developer-sonnet-b,
developer-sonnet-e and developer-opus-b; ITM-756 and ITM-757 carry none).
"""
import json
import re
import unittest
from pathlib import Path

from jsrun import js

DATA = Path(__file__).with_suffix(".md")
ROOT = Path(__file__).resolve().parents[1]
FAKE = (ROOT / "tests" / "stored-graph-fake.mjs").as_uri()
TAG, COMMIT = "v2026.4.0", "c" * 40
RESULTS = "runs/" + COMMIT + "/a.md"


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


def cases() -> list[dict]:
    found = []
    for name, body in sections(DATA.read_text(encoding="utf-8")):
        files, head, blocks = {}, {}, {}
        for block in re.finditer(r"^### (?P<head>[^\n]+)\n\n```[a-z]*\n(?P<text>.*?)\n```", body, re.M | re.S):
            title = block.group("head")
            if title.startswith("File "):
                files[title[5:].strip()] = block.group("text") + "\n"
            elif title.startswith("Head File "):
                head[title[10:].strip()] = block.group("text") + "\n"
            else:
                blocks[title] = json.loads(block.group("text"))
        approval = re.search(r"^approval: (.+)$", body, re.M)
        if not approval or "Records" not in blocks or "Expected" not in blocks:
            raise AssertionError(f"incomplete case {name}")
        found.append({"name": name, "approval": approval.group(1).strip(), "files": files, "head": head, "records": blocks["Records"], "expected": blocks["Expected"]})
    if not found:
        raise AssertionError("no cases loaded")
    return found


def audit(case: dict) -> dict:
    """auditRows over the case: the product at the tag, the branch test-results with one record of the release commit, the default branch with the report and, where the case says so, the approval record that names it."""
    return js(
        "const { createHash } = await import('node:crypto');"
        "const { storedGraphReadOn } = await import(%s);"
        "const files = %s, headFiles = %s, rows = %s, approval = %s, commit = %s, tag = %s, resultsPath = %s;"
        "const blobOf = (text) => createHash('sha1').update('blob ' + Buffer.byteLength(text) + '\\0').update(text).digest('hex');"
        "const snapshotOf = (all, at) => ({ repository: { path: 'fixture/product' }, commit: at, paths: Object.keys(all), read: async (p) => (p in all ? all[p] : null), blob: (p) => (p in all ? blobOf(all[p]) : null) });"
        "const reportPath = 'docs/tests/releases/' + tag + '.md', report = '# Report of the fixture release\\n\\nThe report as accepted.\\n';"
        "const head = { 'SPEC.md': files['SPEC.md'], ...headFiles };"
        "if (approval !== 'no report') head[reportPath] = report;"
        "if (approval === 'names the report') head['docs/approvals/release-' + tag + '-' + blobOf(report).slice(0, 12) + '.md'] = documents.writeDocument(approvals.approvalSchema, { fields: { kind: 'release-report', file: reportPath, blob: blobOf(report), limitation: [] } });"
        "const record = rows.length ? ['---', 'commit: ' + commit, 'levels:', '  - unit', '  - release', 'occasion: release-candidate', 'participant: ci', 'date: 2026-10-11 21:00 UTC', '---', '## Outcomes', '',"
        " '| Test | Level | Outcome | Runs |', '|---|---|---|---|', ...rows.map((row) => '| ' + row.join(' | ') + ' |'), ''].join('\\n') : null;"
        "const results = snapshotOf(record ? { [resultsPath]: record } : { 'README.md': 'none\\n' }, 'results');"
        "const at = { ...snapshotOf(files, commit), readOn: storedGraphReadOn({ paths: Object.keys(files), read: async (p) => files[p] ?? null, commit }) };"
        "const accepted = approval === 'names the report' ? { person: 'akmaier', date: '2026-10-12 08:30 UTC' } : null;"
        "const out = await releaseEvidence.auditRows(at, results, snapshotOf(head, 'head'), { tag, commit }, [], '', [], accepted);"
        "return { rows: out.rows.map((row) => [row.requirement, row.tests.map((t) => [t.id, t.outcome])]), passing: out.summary.passing, noTest: out.summary.noTest, notPassed: out.summary.notPassed,"
        " accepted: out.summary.accepted, limitations: out.summary.limitations,"
        " acceptance: out.evidence.acceptance ? { person: out.evidence.acceptance.person, date: out.evidence.acceptance.date, namesTheReport: out.evidence.acceptance.blob === blobOf(report) } : null };"
        % (json.dumps(FAKE), json.dumps(case["files"]), json.dumps(case["head"]), json.dumps(case["records"]), json.dumps(case["approval"]), json.dumps(COMMIT), json.dumps(TAG), json.dumps(RESULTS)))


def agrees(got: dict, expected: dict) -> list[str]:
    """The differences between what the audit gave and what the case expects; a limitation expected is the beginning of one given."""
    out = []
    for key in ("rows", "passing", "noTest", "notPassed", "accepted"):
        if got[key] != expected[key]:
            out.append(f"{key}: {got[key]!r} != {expected[key]!r}")
    if len(got["limitations"]) != len(expected["limitations"]) or not all(g.startswith(e) for g, e in zip(got["limitations"], expected["limitations"])):
        out.append(f"limitations: {got['limitations']!r} != {expected['limitations']!r}")
    if "acceptance" in expected and got["acceptance"] != expected["acceptance"]:
        out.append(f"acceptance: {got['acceptance']!r} != {expected['acceptance']!r}")
    return out


class TestAuditView(unittest.TestCase):
    # TST-775401 · level: release · module: system
    # guards: THE AUDIT VIEW LISTS EVERY REQUIREMENT OF THE RELEASE; UC-030
    # given: the Markdown cases beside this file: a product at v2026.4.0 whose SPEC has a requirement with a passing test, one with a failed test, one whose test has no record, one with no test; the same after a requirement was added to the SPEC; a requirement with a passed and an unrun test; a report accepted by akmaier; a report no approval record names; a release before the records
    # input: each case's tagged files, the records of the release commit and the default branch given to MOD-release-evidence's auditRows
    # expect: known positive — the first case gives four rows in the SPEC's order, with the outcomes passed, failed, not run and no test, and counts passing 1, without a test 1 and not passed 2; the requirement added later has no row; the requirement with a passed and an unrun test is not counted as passing; the accepted report names akmaier, the date and the text the approval names; the unnamed report is not accepted and the limitations say the record is missing; before the records the outcomes read "cannot be derived" and the limitations name the outcomes and the acceptance
    def test_each_case_gives_the_rows_it_expects(self):
        loaded = cases()
        self.assertGreaterEqual(len(loaded), 6)
        for case in loaded:
            with self.subTest(case=case["name"]):
                self.assertEqual(agrees(audit(case), case["expected"]), [])

    # TST-775402 · level: release · module: system
    # guards: THE AUDIT VIEW LISTS EVERY REQUIREMENT OF THE RELEASE; UC-030
    # given: the same cases
    # input: the cases loaded from Markdown
    # expect: a requirement with no test, one whose test failed and one whose test did not run each have a case that lists their row; a requirement added after the tag has a case that lists no row for it; a report that is accepted and one that is not each have a case; a release before the records has one
    def test_the_cases_cover_each_way_a_requirement_has_no_passing_evidence(self):
        loaded = cases()
        outcomes = {outcome for case in loaded for _, tests in case["expected"]["rows"] for _, outcome in tests}
        self.assertTrue({"passed", "failed", "not run", "cannot be derived"} <= outcomes)
        self.assertTrue(any(not tests for case in loaded for _, tests in case["expected"]["rows"]), "a requirement with no test")
        self.assertTrue(any("A LATER RULE" in case["head"].get("SPEC.md", "") and all(name != "A LATER RULE" for name, _ in case["expected"]["rows"]) for case in loaded))
        self.assertEqual({case["expected"]["accepted"] for case in loaded}, {True, False})
        self.assertTrue(any(case["approval"] == "no report" for case in loaded))


if __name__ == "__main__":
    unittest.main()
