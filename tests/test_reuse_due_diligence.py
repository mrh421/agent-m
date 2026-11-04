# Module: MOD-reuse-facts
# Guards: A REUSE DECISION RECORDS ITS DUE DILIGENCE; A PRODUCT DECLARES ITS LICENCE; A REUSED LICENCE IS SHOWN AGAINST THE PRODUCT'S; DUE DILIGENCE IS FETCHED, NOT RECALLED
# Level: release
"""SPEC §11 — the check named tests/test_reuse_due_diligence.py.

The cases live in tests/test_reuse_due_diligence.md. This file loads them and asks MOD-reuse-facts'
due-diligence step through jsrun.py, so the release check exercises the product module rather than a
Python twin of it.
"""
import json
import re
import unittest
from pathlib import Path

from jsrun import js

DATA = Path(__file__).with_suffix(".md")
RULE_FETCHED = "DUE DILIGENCE IS FETCHED, NOT RECALLED"


def block(body: str, heading: str) -> str:
    match = re.search(rf"^### {re.escape(heading)}\n\n(.*?)(?=^### |\Z)", body, re.M | re.S)
    if not match:
        raise AssertionError(f"missing section {heading}")
    text = match.group(1).strip()
    if not text:
        raise AssertionError(f"empty section {heading}")
    return text


def fence(body: str, heading: str) -> str:
    text = block(body, heading)
    match = re.fullmatch(r"```[a-z]*\n(.*?)\n```", text, re.S)
    if not match:
        raise AssertionError(f"missing fenced block under {heading}")
    return match.group(1)


def cases() -> list[dict]:
    text = DATA.read_text(encoding="utf-8")
    found = []
    in_fence = False
    current = None
    body = []
    for line in text.splitlines(keepends=True):
        if line.startswith("```"):
            in_fence = not in_fence
        if not in_fence and line.startswith("## "):
            if current:
                found.append({"name": current, "body": "".join(body)})
            current = line[3:].strip()
            body = []
            continue
        if current:
            body.append(line)
    if current:
        found.append({"name": current, "body": "".join(body)})
    for case in found:
        body = case["body"]
        kind = re.search(r"^kind: (.+)$", body, re.M)
        if not kind:
            raise AssertionError(f"missing kind in {case['name']}")
        case["kind"] = kind.group(1).strip()
    if not found:
        raise AssertionError("no cases loaded")
    return found


def step_cases() -> list[dict]:
    loaded = []
    for case in cases():
        if case["kind"] != "step":
            continue
        loaded.append({
            "name": case["name"],
            "precondition": block(case["body"], "Precondition"),
            "input": json.loads(fence(case["body"], "Input")),
            "draft": fence(case["body"], "Draft"),
            "expected": json.loads(fence(case["body"], "Expected Result")),
        })
    return loaded


def record_cases() -> list[dict]:
    loaded = []
    for case in cases():
        if case["kind"] != "record":
            continue
        loaded.append({
            "name": case["name"],
            "precondition": block(case["body"], "Precondition"),
            "input": json.loads(fence(case["body"], "Input")),
            "record": fence(case["body"], "Record"),
            "expected": json.loads(fence(case["body"], "Expected Result")),
        })
    return loaded


def step_record_cases() -> list[dict]:
    named = {case["name"]: case for case in step_cases()}
    loaded = []
    for case in cases():
        if case["kind"] != "step-record":
            continue
        source = re.search(r"^from: (.+)$", case["body"], re.M)
        if not source or source.group(1).strip() not in named:
            raise AssertionError(f"{case['name']} names no step case in from")
        loaded.append({
            "name": case["name"],
            "step": named[source.group(1).strip()],
            "precondition": block(case["body"], "Precondition"),
            "input": json.loads(fence(case["body"], "Input")),
            "expected": json.loads(fence(case["body"], "Expected Result")),
        })
    return loaded


def run_due_diligence(case: dict) -> dict:
    payload = {**case["input"], "draft": case["draft"]}
    return js("""
const input = %s;
const routes = input.routes ?? {};
const files = Object.hasOwn(input, "license") ? { LICENSE: input.license } : {};
const json = (status, body) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json" },
});
const fetches = [];
const fakeFetch = async (address) => {
  const href = String(address?.url ?? address);
  fetches.push(href);
  if (!Object.hasOwn(routes, href)) return json(404, { message: "not found" });
  return json(200, routes[href]);
};
const connections = [];
const fakeConnect = async (address) => {
  connections.push(address.web);
  const counts = input.issue_counts?.[address.web] ?? { open: 0, closed: 0 };
  return {
    repositoryInfo: async () => ({ defaultBranch: "main", visibility: "public", canWrite: false, archived: false, description: "" }),
    issueCounts: async () => counts,
  };
};
const draft = { files: [{ path: input.path, text: input.draft, class: "new" }] };
const context = {
  product: { snapshot: { read: async (path) => Object.hasOwn(files, path) ? files[path] : null } },
  fetch: fakeFetch,
  connect: fakeConnect,
  now: () => input.read,
};
const result = await reuseFacts.reuseStrategies.steps["due-diligence"](draft, context);
return {
  text: result.draft.files[0].text,
  findings: result.findings.map((finding) => ({
    artifact: finding.artifact,
    line: finding.line,
    kind: finding.kind,
    rule: finding.rule,
    what: finding.what,
    fix: finding.fix,
  })),
  fetches,
  connections,
};
""" % json.dumps(payload))


def due_diligence_rows(text: str) -> list[dict]:
    lines = text.splitlines()
    start = next((at for at, line in enumerate(lines) if line.strip() == "## Due diligence"), None)
    if start is None:
        return []
    header = None
    rows = []
    for at in range(start + 1, len(lines)):
        line = lines[at].strip()
        if at > start + 1 and line.startswith("## "):
            break
        if not line.startswith("|") or not line.endswith("|"):
            continue
        cells = [cell.strip() for cell in line[1:-1].split("|")]
        if all(re.fullmatch(r":?-{3,}:?", cell) for cell in cells):
            continue
        if header is None:
            header = cells
            continue
        rows.append({**dict(zip(header, cells)), "line": at + 1})
    return rows


def rows_without_lines(rows: list[dict]) -> list[dict]:
    return [{key: value for key, value in row.items() if key != "line"} for row in rows]


def with_empty_cell(text: str, row: int, column: str) -> str:
    """The text with one cell of one due-diligence row emptied."""
    rows = due_diligence_rows(text)
    names = [name for name in rows[0] if name != "line"]
    lines = text.splitlines()
    at = rows[row]["line"] - 1
    cells = [cell.strip() for cell in lines[at].strip()[1:-1].split("|")]
    cells[names.index(column)] = ""
    lines[at] = "| " + " | ".join(cells) + " |"
    return "\n".join(lines)


def record_findings(path: str, text: str) -> list[dict]:
    findings = []
    for row in due_diligence_rows(text):
        candidate = row.get("Candidate", "candidate")
        if row.get("Read from", "").strip() in {"", "-"}:
            findings.append({
                "artifact": path,
                "line": row["line"],
                "kind": "error",
                "rule": RULE_FETCHED,
                "what": f"{candidate} has a due-diligence fact row without Read from",
                "fix": "record the registry or repository address read",
            })
        if row.get("Read on", "").strip() in {"", "-"}:
            findings.append({
                "artifact": path,
                "line": row["line"],
                "kind": "error",
                "rule": RULE_FETCHED,
                "what": f"{candidate} has a due-diligence fact row without Read on",
                "fix": "record the date the fact was read",
            })
    return findings


class TestReuseDueDiligence(unittest.TestCase):
    # TST-446100 · level: release · module: system
    # guards: A REUSE DECISION RECORDS ITS DUE DILIGENCE; A PRODUCT DECLARES ITS LICENCE; A REUSED LICENCE IS SHOWN AGAINST THE PRODUCT'S; DUE DILIGENCE IS FETCHED, NOT RECALLED
    # given: the Markdown step cases beside this file, each with fixture registry and source-repository facts
    # input: MOD-reuse-facts reuseStrategies.steps["due-diligence"] through jsrun.py
    # expect: each fixture decision gains the expected due-diligence rows and findings, including the chosen candidate, alternatives, licence marks, not-checked rows and not-found warning
    def test_due_diligence_step_cases_match_the_release_expectations(self):
        loaded = step_cases()
        self.assertEqual(len(loaded), 3)
        for case in loaded:
            with self.subTest(case=case["name"]):
                actual = run_due_diligence(case)
                self.assertEqual(rows_without_lines(due_diligence_rows(actual["text"])), case["expected"]["rows"])
                self.assertEqual(actual["findings"], case["expected"]["findings"])
                self.assertEqual(actual["fetches"], case["expected"]["fetches"])
                self.assertEqual(actual["connections"], case["expected"]["connections"])

    # TST-446101 · level: release · module: system
    # guards: DUE DILIGENCE IS FETCHED, NOT RECALLED
    # given: the Markdown record cases beside this file
    # input: each due-diligence record table as it would stand in an architecture decision
    # expect: a row lacking the address or the date read is named with the decision path and row line
    def test_due_diligence_record_rows_without_address_or_date_are_findings(self):
        loaded = record_cases()
        self.assertEqual(len(loaded), 1)
        for case in loaded:
            with self.subTest(case=case["name"]):
                self.assertEqual(record_findings(case["input"]["path"], case["record"]), case["expected"]["findings"])

    # TST-446103 · level: release · module: system
    # guards: DUE DILIGENCE IS FETCHED, NOT RECALLED
    # given: the due-diligence section MOD-reuse-facts' step writes for a fixture draft (an MIT product, a chosen and an alternative npm candidate)
    # input: the record check over the written text, then over the same text with the date read of the first row emptied, and with the address read of the second row emptied
    # expect: the written text has no finding; each emptied cell gives exactly one finding naming the decision path, the row line and the empty column
    def test_written_due_diligence_record_passes_and_an_emptied_fact_fails(self):
        loaded = step_record_cases()
        self.assertEqual(len(loaded), 1)
        for case in loaded:
            with self.subTest(case=case["name"]):
                path = case["step"]["input"]["path"]
                written = run_due_diligence(case["step"])["text"]
                self.assertEqual(record_findings(path, written), case["expected"]["written_findings"])
                self.assertEqual(len(case["input"]["mutations"]), len(case["expected"]["mutated_findings"]))
                for mutation, expected in zip(case["input"]["mutations"], case["expected"]["mutated_findings"]):
                    mutated = with_empty_cell(written, mutation["row"], mutation["column"])
                    self.assertNotEqual(mutated, written)
                    self.assertEqual(record_findings(path, mutated), expected)

    # TST-446102 · level: release · module: system
    # guards: A TEST STATES ITS EXPECTED RESULT BEFORE IT RUNS
    # given: the Markdown cases beside this file
    # input: the case loader
    # expect: every case states a precondition, an input and an expected result in the data file
    def test_each_markdown_case_states_precondition_input_and_expected_result(self):
        for case in cases():
            with self.subTest(case=case["name"]):
                self.assertTrue(block(case["body"], "Precondition"))
                self.assertTrue(block(case["body"], "Input"))
                self.assertTrue(block(case["body"], "Expected Result"))


if __name__ == "__main__":
    unittest.main()
