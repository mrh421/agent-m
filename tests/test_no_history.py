# Module: MOD-documents
# Guards: A DOCUMENT HOLDS NO HISTORY
# Level: release
"""SPEC section 1 - the check named tests/test_no_history.py.

The cases live in tests/test_no_history.md. This file loads them and asks MOD-documents, MOD-spec-document and
MOD-text-tools for the readings and marks, so the release check follows the product interfaces instead of duplicating
their document formats in Python.
"""
import json
import re
import subprocess
import unittest
from pathlib import Path

from jsrun import js

ROOT = Path(__file__).resolve().parents[1]
DATA = Path(__file__).with_suffix(".md")
RULE = "A DOCUMENT HOLDS NO HISTORY"
FIX = "remove it; the version history keeps what was changed, when and by whom"
SETTINGS = {
    "docs/settings.md",
    "docs/collaborators.md",
    "docs/participants.md",
    "docs/process.md",
    "docs/process_team2.md",
    "docs/sources.md",
    "docs/role-assignments/team1.md",
    "docs/role-assignments/team2.md",
}

JS_CHECK = """
const RULE = "A DOCUMENT HOLDS NO HISTORY";
const FIX = "remove it; the version history keeps what was changed, when and by whom";
const settingsSchemas = await personalData.settingsSchemas();
function schemaFor(path) {
  return documents.artifactSchemaOf(path)
    ?? (path === "docs/process.md" ? productProcess.declarationSchema : null)
    ?? (path.startsWith("docs/role-assignments/") ? productProcess.roleAssignmentSchema : null)
    ?? (path === "docs/participants.md" ? participantList.participantSchema() : null)
    ?? (path === "docs/sources.md" ? sourceRegister.sourceSchemas().links : null)
    ?? (path === "docs/settings.md" ? settingsSchemas.settings : null)
    ?? (path === "docs/collaborators.md" ? settingsSchemas.collaborators : null);
}
function findingFor(artifact, mark) {
  return textTools.finding({
    artifact,
    line: mark.line,
    kind: "error",
    rule: RULE,
    what: `the document holds a mark of history (${mark.kind}): "${mark.text}"`,
    fix: FIX
  });
}
function noHistoryFindings(path, text) {
  if (path === "SPEC.md") {
    return specDocument.requirementFindings(specDocument.parseSpec(text)).filter((finding) => finding.rule === RULE);
  }
  const schema = schemaFor(path);
  let artifact = path;
  if (schema) {
    const document = documents.readDocument(schema, path, text);
    documents.documentFindings(schema, document);
    artifact = document.id ?? path;
  }
  return textTools.historyMarks(text).map((mark) => findingFor(artifact, mark));
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
    pattern = r"^## (?P<name>[^\n]+)\n\nkind: (?P<kind>[^\n]+)\n(?P<body>.*?)(?=^## [^\n]+\n\nkind: |\Z)"
    for match in re.finditer(pattern, text, re.M | re.S):
        body = "kind: " + match.group("kind") + "\n" + match.group("body")
        found.append({"name": match.group("name"), "kind": match.group("kind").strip(), "body": body})
    if not found:
        raise AssertionError("no cases loaded")
    return found


def expected(section: dict) -> list[dict]:
    return json.loads(fence(section["body"], "Expected Findings"))


def fixture_cases() -> list[dict]:
    cases = []
    for section in sections():
        if section["kind"] != "fixture":
            continue
        path = re.search(r"^path: (.+)$", section["body"], re.M)
        if not path:
            raise AssertionError(f"missing path in {section['name']}")
        cases.append({
            "name": section["name"],
            "path": path.group(1).strip(),
            "text": fence(section["body"], "Text"),
            "expected": expected(section),
        })
    return cases


def repository_case() -> dict:
    loaded = [section for section in sections() if section["kind"] == "repository"]
    if len(loaded) != 1:
        raise AssertionError(f"expected one repository case, found {len(loaded)}")
    return {"name": loaded[0]["name"], "expected": expected(loaded[0])}


def excluded_case() -> dict:
    loaded = [section for section in sections() if section["kind"] == "excluded"]
    if len(loaded) != 1:
        raise AssertionError(f"expected one excluded case, found {len(loaded)}")
    return {
        "name": loaded[0]["name"],
        "files": json.loads(fence(loaded[0]["body"], "Files")),
        "expected": expected(loaded[0]),
    }


def included_path(path: str) -> bool:
    return (
        path == "SPEC.md"
        or re.match(r"^docs/use-cases/UC-[^/]+\.md$", path)
        or re.match(r"^docs/architecture/(ARC|MOD)-[^/]+\.md$", path)
        or re.match(r"^docs/backlog/ITM-[^/]+\.md$", path)
        or path in SETTINGS
    )


def tracked() -> list[str]:
    out = subprocess.run(["git", "-C", str(ROOT), "ls-files", "-z"], capture_output=True, text=True, check=True).stdout
    return [path for path in out.split("\0") if path]


def no_history_findings(path: str, text: str) -> list[dict]:
    return js(JS_CHECK + "return noHistoryFindings(%s, %s);" % (json.dumps(path), json.dumps(text)))


def scan_findings(files: dict[str, str]) -> list[dict]:
    return js(JS_CHECK
              + ("const files = Object.entries(%s);"
                 "return files.flatMap(([path, text]) => %s.includes(path) ? noHistoryFindings(path, text) : []);")
              % (json.dumps(files), json.dumps([path for path in files if included_path(path)])))


def repository_paths() -> list[str]:
    # This partial scan is not the whole-repository scan allowed to open the own SPEC.
    # The Markdown fixture exercises MOD-spec-document without reading that file.
    return [path for path in tracked() if path != "SPEC.md" and included_path(path)]


def repository_findings(paths: list[str]) -> list[dict]:
    encoded = json.dumps(paths).encode("utf-8").hex()
    return js(JS_CHECK
              + "const { readFileSync } = await import('node:fs');"
                "const paths = JSON.parse(Buffer.from(%s, 'hex').toString('utf8'));"
                "const root = %s;"
                "return paths.flatMap((path) => noHistoryFindings(path, readFileSync(new URL(path, root), 'utf8')));"
              % (json.dumps(encoded), json.dumps(ROOT.as_uri() + "/")))


class TestNoHistory(unittest.TestCase):
    # TST-412100 · level: release · module: system
    # guards: A DOCUMENT HOLDS NO HISTORY
    # given: the tracked use cases, architecture decisions, module files, backlog items and settings files
    # input: each included file read through its product document interface and checked for marks from MOD-text-tools
    # expect: no finding: none of these files carries a withdrawal note, an edit stamp or the date of a change (the Markdown data states the empty list)
    def test_current_repository_history_findings_are_named(self):
        paths = repository_paths()
        self.assertNotIn("SPEC.md", paths)
        self.assertTrue(any(path.startswith("docs/use-cases/") for path in paths))
        self.assertEqual(repository_findings(paths), repository_case()["expected"])

    # TST-412101 · level: release · module: system
    # guards: A DOCUMENT HOLDS NO HISTORY
    # given: fixture copies of a use case and the SPEC with planted marks of history
    # input: the fixtures checked through MOD-documents or MOD-spec-document and MOD-text-tools
    # expect: each planted withdrawal note, edit stamp and date of change is named with its file artifact and line
    def test_planted_history_marks_are_named_with_lines(self):
        cases = fixture_cases()
        self.assertGreaterEqual(len(cases), 2)
        all_findings = []
        for case in cases:
            with self.subTest(case=case["name"]):
                actual = no_history_findings(case["path"], case["text"])
                self.assertEqual(actual, case["expected"])
                all_findings.extend(actual)
        self.assertEqual({finding["what"].split("(")[1].split(")")[0] for finding in all_findings},
                         {"edit-stamp", "withdrawal", "dated-change"})

    # TST-412102 · level: release · module: system
    # guards: A DOCUMENT HOLDS NO HISTORY
    # given: record and dated measurement fixture files that carry date and change words
    # input: the release scan's path selection over those fixture paths
    # expect: records and dated measurements are not read as documents of this rule and produce no scan finding
    def test_records_and_dated_measurements_are_not_scanned(self):
        case = excluded_case()
        self.assertTrue(case["files"])
        self.assertTrue(all(not included_path(path) for path in case["files"]))
        self.assertEqual(scan_findings(case["files"]), case["expected"])


if __name__ == "__main__":
    unittest.main()
