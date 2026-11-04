# Module: MOD-result-records
# Guards: A NEW TEST IS SHOWN TO FAIL ON A PLANTED FAULT
# Level: release
"""SPEC §12 — the check named tests/test_counter_proof.py.

The cases live in tests/test_counter_proof.md. This file loads them and asks MOD-result-records for the findings of its check `test-proposals` on the report of a write-tests job, so the release check uses the same reader and
checker the product uses: a branch whose new automated test has no counter-proof — a fault planted in the code it guards and the test failing on it — is sent back.
"""
import json
import re
import unittest
from pathlib import Path

from jsrun import js

DATA = Path(__file__).with_suffix(".md")
RULE = "A NEW TEST IS SHOWN TO FAIL ON A PLANTED FAULT"
BASE = {"src/widget.mjs": "export const shape = 'round';\n"}


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
    text = DATA.read_text(encoding="utf-8")
    found = []
    for name, body in sections(text):
        match = re.match(r"(?P<name>.*)", name)
        blocks = {}
        files = {}
        for block in re.finditer(r"^### (?P<head>[^\n]+)\n\n```[a-z]*\n(?P<text>.*?)\n```", body, re.M | re.S):
            head = block.group("head")
            if head.startswith("File "):
                files[head[5:].strip()] = block.group("text") + "\n"
            else:
                blocks[head] = json.loads(block.group("text"))
        branch = re.search(r"^branch: (.+)$", body, re.M)
        if not branch or "Report" not in blocks or "Expected" not in blocks:
            raise AssertionError(f"incomplete case {match.group('name')}")
        found.append({"name": match.group("name"), "branch": branch.group(1).strip(), "files": files, "report": blocks["Report"],
                      "cases": blocks.get("Cases"), "expected": blocks["Expected"]})
    if not found:
        raise AssertionError("no cases loaded")
    return found


def findings(case: dict) -> list[dict]:
    """The findings of the check test-proposals on the case's report, over a product that holds BASE and, on the case's branch, BASE and its files."""
    return js(
        "const base = %s, extra = %s, branch = %s, report = %s, reviewed = %s;"
        "const snapshotOf = (files) => ({ paths: Object.keys(files), read: async (p) => files[p] ?? null, blob: (p) => (p in files ? 'blob:' + files[p] : null) });"
        "const context = { kind: null, params: reviewed === null ? {} : { draft: { cases: reviewed } }, product: { address: 'https://github.com/acme/product', snapshot: snapshotOf(base),"
        " host: { readSnapshot: async (ref) => { if (ref !== branch || Object.keys(extra).length === 0) throw Object.assign(new Error('no branch'), { name: 'NotFound' }); return snapshotOf({ ...base, ...extra }); } } },"
        " instance: { snapshot: snapshotOf({}), host: null, checkout: null }, connect: async () => null, participants: [], places: { sources: {}, mailbox: null }, gates: [],"
        " person: 'alice', now: new Date('2026-11-01T09:00:00Z'), agentM: { version: 'unreleased', commit: 'a'.repeat(40) }, jobId: null };"
        "return (await resultRecords.resultStrategies.checks['test-proposals'](report, context)).map((f) => ({ artifact: f.artifact, kind: f.kind, rule: f.rule, what: f.what, fix: f.fix }));"
        % (json.dumps(BASE), json.dumps(case["files"]), json.dumps(case["branch"]), json.dumps(case["report"]), json.dumps(case["cases"])))


def summary(found: list[dict]) -> list[dict]:
    out = []
    for one in found:
        named = re.search(r"TST-\d+", one["what"]) or re.search(r"branch (\S+)", one["what"])
        out.append({"test": named.group(0) if named and named.group(0).startswith("TST-") else (named.group(1) if named else None), "rule": one["rule"]})
    return out


class TestCounterProof(unittest.TestCase):
    # TST-771411 · level: release · module: system
    # guards: A NEW TEST IS SHOWN TO FAIL ON A PLANTED FAULT; UC-026
    # given: the Markdown cases beside this file: a branch whose new unit test has a counter-proof record of outcome failed; one whose test has none; one whose record says the test passed with the fault planted; one whose record names no fault; a test reported failing on the current code; a test of the level user; a branch the host does not hold
    # input: each case's report checked by MOD-result-records' check test-proposals, over a product whose default branch holds no such test
    # expect: known positive — the test with a valid counter-proof, the one awaiting implementation and the one of level user have no finding; the test without a record, the one whose record says it passed and the one whose record names no fault each have one error under A NEW TEST IS SHOWN TO FAIL ON A PLANTED FAULT naming the test; the missing branch has one error naming it
    def test_each_case_gives_the_findings_it_expects(self):
        loaded = cases()
        self.assertGreaterEqual(len(loaded), 7)
        for case in loaded:
            with self.subTest(case=case["name"]):
                found = findings(case)
                self.assertTrue(all(one["kind"] == "error" and one["fix"] for one in found))
                self.assertEqual(summary(found), case["expected"])

    # TST-771412 · level: release · module: system
    # guards: A NEW TEST IS SHOWN TO FAIL ON A PLANTED FAULT; UC-026
    # given: the same cases
    # input: the cases loaded from Markdown
    # expect: the passing case is present, and every way a counter-proof can be missing or wrong has a failing case under the rule this check guards: no record, a record of outcome passed, a record without a fault, an unpushed branch; and the two exceptions pass — a test awaiting implementation (reported failed) and a test of level user
    def test_the_cases_cover_the_passing_proof_and_each_way_it_is_missing(self):
        loaded = cases()
        failing = [case for case in loaded if case["expected"]]
        self.assertGreaterEqual(len(failing), 4)
        self.assertTrue(all(one["rule"] == RULE for case in failing for one in case["expected"]))
        passing = [case["name"] for case in loaded if not case["expected"]]
        self.assertEqual(len(passing), 3)
        self.assertTrue(any("awaits" in name for name in passing) and any("user" in name for name in passing))


if __name__ == "__main__":
    unittest.main()
