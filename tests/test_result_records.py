# Module: MOD-result-records
# Guards: EVERY TEST RUN LEAVES A RESULT RECORD; TEST RESULTS ARE KEPT IN THE REPOSITORY; A RESULT RECORD IS NEVER REWRITTEN
# Level: release
"""SPEC section 12 - the check named tests/test_result_records.py (ITM-773), written by developer-sonnet-a.

The cases live in tests/test_result_records.md. This file loads them. For each case of the groups `runs` and `refused` it runs
MOD-result-records' appendResult over a product repository held in memory and reads the branch back with resultsAt; for each
case of the group `history` it applies the check of the third rule to a branch history. Nothing reaches the network.

The three checks, from the SPEC's sentences:
- "Every test run leaves a record naming the commit, the levels run, the participant that ran it, the date, and each test's
  outcome": after a run the branch holds a record at the path given, whose front matter names the commit, the levels, the
  participant and the date, and resultsAt reads each test's outcome from it.
- "Every result record is committed to the branch `test-results` of the product repository": every commit appendResult makes
  names the branch test-results, and none names another.
- "The branch `test-results` only grows: no record on it is changed or deleted, and it is never force-pushed" - "the branch's
  history is checked for rewritten or deleted records; counter-proof with a fixture that amends one": a record added at the path
  of an existing record is refused and nothing is committed; a history in which a commit changes or deletes a record is found
  out by the check, and one that only adds is not.
"""
import json
import re
import unittest
from pathlib import Path

from jsrun import js

DATA = Path(__file__).with_suffix(".md")

JS_RUN = """
const input = %s;
const tree = new Map(Object.entries(input.existing));
const commits = [];
const host = {
  readSnapshot: async (ref) => {
    if (ref !== 'test-results') throw Object.assign(new Error('no branch ' + ref), { name: 'NotFound' });
    return { commit: 'h' + commits.length, paths: [...tree.keys()], read: async (path) => tree.get(path) ?? null };
  },
  commitFiles: async (change) => {
    commits.push({ branch: change.branch, paths: change.files.map((file) => file.path) });
    for (const file of change.files) tree.set(file.path, file.text);
    return { commit: 'h' + commits.length };
  },
};
const results = [];
let last = null;
for (const each of input.append) {
  try {
    const record = documents.readDocument(resultRecords.resultSchema.run, each.path, each.text);
    await resultRecords.appendResult(host, record);
    results.push('added');
    last = each.path;
  } catch (failure) {
    results.push(failure.name);
  }
}
const snapshot = { commit: 'h', paths: [...tree.keys()], read: async (path) => tree.get(path) ?? null };
const levels = await resultRecords.resultsAt(snapshot, input.commit, input.tests);
const outcomes = Object.fromEntries(levels.flatMap((level) => level.tests.map((one) => [one.id, one.outcome])));
const stored = last === null ? null : documents.readDocument(resultRecords.resultSchema.run, last, tree.get(last));
return { results, commits, paths: [...tree.keys()].filter((path) => !(path in input.existing)), existing: Object.fromEntries(Object.entries(input.existing).map(([path, text]) => [path, tree.get(path) === text])),
  outcomes, named: stored === null ? null : { commit: stored.fields.commit, levels: stored.fields.levels, participant: stored.fields.participant, date: stored.fields.date } };
"""


def sections() -> list[dict]:
    text = DATA.read_text(encoding="utf-8")
    found = []
    for match in re.finditer(r"^## (?P<name>[^\n]+)\n(?P<body>.*?)(?=^## |\Z)", text, re.M | re.S):
        block = re.search(r"^### Case\n\n```json\n(.*?)\n```", match.group("body"), re.M | re.S)
        if not block:
            raise AssertionError(f"missing Case block under {match.group('name')}")
        found.append({"name": match.group("name"), "case": json.loads(block.group(1))})
    if not found:
        raise AssertionError("no cases loaded")
    return found


def of_group(group: str) -> list[dict]:
    chosen = [s for s in sections() if s["case"]["group"] == group]
    if not chosen:
        raise AssertionError(f"no case of the group {group}")
    return chosen


def run(case: dict) -> dict:
    return js(JS_RUN % json.dumps({"existing": case["existing"], "append": case["append"], "tests": case["tests"], "commit": case["commit"]}))


def rewritten_or_deleted(history: list[dict]) -> dict:
    """The check of the rule that a record is never rewritten: the records a history changes, and the ones it deletes."""
    return {"rewritten": sorted({path for entry in history for path in entry["changed"]}),
            "deleted": sorted({path for entry in history for path in entry["deleted"]})}


class TestResultRecords(unittest.TestCase):
    # TST-773201 · level: release · module: MOD-result-records
    # guards: EVERY TEST RUN LEAVES A RESULT RECORD
    # given: the cases of the group runs beside this file: a product whose branch test-results holds the records of earlier runs, and runs that add theirs
    # input: appendResult for each run's record, then resultsAt over the branch for the commit
    # expect: each run is added; the newest record stands at its path and names the commit, the levels, the participant and the date it was given; resultsAt reads each test's outcome from the records
    def test_a_run_leaves_a_record_naming_commit_levels_participant_date_and_outcomes(self):
        for loaded in of_group("runs"):
            with self.subTest(case=loaded["name"]):
                case, result = loaded["case"], run(loaded["case"])
                self.assertEqual(result["results"], case["expected"]["results"])
                self.assertEqual(result["paths"], case["expected"]["paths"])
                self.assertEqual(result["named"], case["expected"]["named"])
                self.assertEqual(result["outcomes"], case["expected"]["outcomes"])

    # TST-773202 · level: release · module: MOD-result-records
    # guards: TEST RESULTS ARE KEPT IN THE REPOSITORY
    # given: the cases of the groups runs and refused beside this file
    # input: appendResult for each run's record
    # expect: every commit it makes names the branch test-results and no other; the records that stood on the branch before are still there with the very text they had
    def test_every_record_is_committed_to_the_branch_test_results(self):
        for loaded in of_group("runs") + of_group("refused"):
            with self.subTest(case=loaded["name"]):
                case, result = loaded["case"], run(loaded["case"])
                self.assertEqual([commit["branch"] for commit in result["commits"]], case["expected"]["branches"])
                self.assertEqual([path for commit in result["commits"] for path in commit["paths"]], case["expected"]["paths"])
                self.assertTrue(all(result["existing"].values()), result["existing"])
                seen = set(case["existing"])
                for commit in result["commits"]:
                    for path in commit["paths"]:
                        self.assertNotIn(path, seen, "a commit of the branch changes a record that stands")
                        seen.add(path)

    # TST-773203 · level: release · module: MOD-result-records
    # guards: A RESULT RECORD IS NEVER REWRITTEN
    # given: the case of the group refused beside this file: a record already stands at a path, and a run tries to add another there with other outcomes
    # input: appendResult for it
    # expect: it is refused with the error Exists, no commit is made, and the branch still reads the outcome of the record that stood
    def test_a_record_at_the_path_of_an_existing_record_is_refused(self):
        for loaded in of_group("refused"):
            with self.subTest(case=loaded["name"]):
                case, result = loaded["case"], run(loaded["case"])
                self.assertEqual(result["results"], case["expected"]["results"])
                self.assertEqual(result["commits"], [])
                self.assertEqual(result["outcomes"], case["expected"]["outcomes"])

    # TST-773204 · level: release · module: MOD-result-records
    # guards: A RESULT RECORD IS NEVER REWRITTEN
    # given: the histories of the group history beside this file: one that only adds records, and the fixture that amends one record and deletes another
    # input: the check of the rule over each history
    # expect: the history that only adds has no rewritten and no deleted record; the fixture that amends and deletes is found out, naming the amended record and the deleted one (the counter-proof)
    def test_the_check_finds_a_history_that_amends_or_deletes_a_record(self):
        for loaded in of_group("history"):
            with self.subTest(case=loaded["name"]):
                self.assertEqual(rewritten_or_deleted(loaded["case"]["history"]), loaded["case"]["expected"])


if __name__ == "__main__":
    unittest.main()
