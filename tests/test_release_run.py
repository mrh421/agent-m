# Module: MOD-release-evidence
# Guards: A RELEASE RUNS EVERY TEST AT EVERY LEVEL; ACCEPTING THE RELEASE TEST REPORT RELEASES; A RED RELEASE IS ACCEPTED ONLY WITH ITS LIMITATIONS RECORDED
# Level: release
"""SPEC §12 — the check named tests/test_release_run.py.

The cases live in tests/test_release_run.md. This file loads them and drives one product in memory through tests/release-run-world.mjs: its release candidate started with MOD-release-evidence's startReleaseCandidate,
records of tests added, and the release test report accepted with acceptAndRelease or through the dashboard's release panel (MOD-test-pages' route `release`), so the check uses the code the release uses. It compares what
followed each step — the refusal, the tags and the commits they stand on, the commits written — with what the case states.

Written for the release testing of sprint 142 by developer-sonnet-l (ITM-1434), who built none of the behaviour it guards: the code of tagging, of the release run and of accepting the report (src/release-evidence/, the
release panel of src/test-pages/release.mjs and the release flow of src/review-pages/flow.mjs) carries the Agent-M-Participant trailers of developer-opus-e, developer-opus-f, developer-sonnet-a, developer-sonnet-b,
developer-sonnet-c, developer-sonnet-d, developer-sonnet-e, developer-sonnet-j, developer-sonnet-k and developer-terra-b, and none of developer-sonnet-l.
"""
import json
import re
import unittest
from pathlib import Path

from jsrun import ROOT, js

DATA = Path(__file__).with_suffix(".md")
WORLD = (ROOT / "tests" / "release-run-world.mjs").as_uri()
FIVE = [{"id": "TST-001", "level": "unit"}, {"id": "TST-002", "level": "component"}, {"id": "TST-003", "level": "system"},
        {"id": "TST-004", "level": "release"}, {"id": "TST-005", "level": "user"}]
TESTS = {"five": FIVE, "five+rate": FIVE + [{"id": "TST-006", "level": "unit", "rate": True}]}


def block(body: str, heading: str, required: bool = True):
    match = re.search(rf"^### {re.escape(heading)}\n\n```json\n(.*?)\n```", body, re.M | re.S)
    if not match:
        if required:
            raise AssertionError(f"missing block {heading}")
        return None
    return json.loads(match.group(1))


def cases() -> list[dict]:
    found = []
    for match in re.finditer(r"^## (?P<name>[^\n]+)\n(?P<body>.*?)(?=^## |\Z)", DATA.read_text(encoding="utf-8"), re.M | re.S):
        body = match.group("body")
        test = re.search(r"^test: (TST-\d+)$", body, re.M)
        if not test:
            continue
        found.append({"name": match.group("name"), "test": test.group(1), "case": block(body, "Case"), "expected": block(body, "Expected"), "each": block(body, "Each", False) or [{}]})
    if not found:
        raise AssertionError("no cases loaded")
    return found


def expand(case: dict) -> dict:
    """The case with its tests and the rows of its records written out."""
    tests = TESTS[case["tests"]]
    steps = []
    for step in case["steps"]:
        if step["do"] == "records":
            wanted = [t for t in tests if t["id"] not in step.get("omit", []) and (step["add"] != "only" or t["id"] in step["only"])]
            rows = [[t["id"], t["level"], step.get("set", {}).get(t["id"], "passed"), step.get("rates", {}).get(t["id"], "10 of 10" if t.get("rate") else "")] for t in wanted]
            step = {"do": "records", "on": step.get("on", "candidate"), "add": rows, "uncommitted": step.get("uncommitted", False)}
        steps.append(step)
    return {**case, "tests": tests, "steps": steps}


def substitute(value, entry: dict):
    text = json.dumps(value)
    for key, replacement in entry.items():
        text = text.replace("{" + key + "}", replacement)
    return json.loads(text)


def drive(case: dict) -> list[dict]:
    return js("const world = await import(%s); return await world.run(%s);" % (json.dumps(WORLD), json.dumps(expand(case))))


def agrees(got: list[dict], expected: list[dict]) -> list[str]:
    """The differences between what followed each step and what the case states of it."""
    if len(got) != len(expected):
        return [f"{len(got)} steps followed, {len(expected)} expected"]
    out = []
    for at, (seen, want) in enumerate(zip(got, expected)):
        where = f"step {at + 1} ({seen['do']})"
        blob = seen.get("reportBlob") or ""
        for key in ("error", "tests", "tags", "writes", "order", "report"):
            if key in want and seen[key] != want[key]:
                out.append(f"{where}: {key} {seen[key]!r} != {want[key]!r}")
        if "lastWrite" in want:
            wanted = [p.replace("{blob12}", blob[:12]) for p in want["lastWrite"]]
            if seen["lastWrite"] != wanted:
                out.append(f"{where}: lastWrite {seen['lastWrite']!r} != {wanted!r}")
        for pattern in want.get("changelogHas", []):
            if not re.search(pattern, seen["changelog"], re.M):
                out.append(f"{where}: the changelog lacks {pattern!r}: {seen['changelog']!r}")
        for text in want.get("changelogLacks", []):
            if text in seen["changelog"]:
                out.append(f"{where}: the changelog holds {text!r}")
        if "approvalLines" in want:
            wanted = [line.replace("{blob}", blob) for line in want["approvalLines"]]
            got_lines = None if seen["approval"] is None else seen["approval"].rstrip("\n").split("\n")
            if got_lines != wanted:
                out.append(f"{where}: approval {got_lines!r} != {wanted!r}")
        if want.get("approvalNone") and seen["approval"] is not None:
            out.append(f"{where}: an approval record was written")
        ui = seen.get("ui") or {}
        for key, field in (("uiButtons", "buttons"), ("uiReasonIds", "reasonIds"), ("uiIncomplete", "incomplete")):
            if key in want and ui.get(field) != want[key]:
                out.append(f"{where}: {field} {ui.get(field)!r} != {want[key]!r}")
        if "uiResult" in want and not re.search(want["uiResult"], ui.get("result", "")):
            out.append(f"{where}: the answer {ui.get('result')!r} does not match {want['uiResult']!r}")
    return out


ROWS = ["unit", "component", "system", "paid", "release", "user"]


def levels_of_run(case: dict) -> list[str]:
    """The levels MOD-result-records' recipe commit-and-levels gives the run-tests job of a candidate, over a schedule whose release candidate column is ticked for every row but those the case lists."""
    schedule = ["---", "nightly: 02:00", "---", "## Levels", "", "| Row | every commit | pull request | nightly | release candidate | on demand | runs on |", "|---|---|---|---|---|---|---|",
                *[f"| {row} | | | | {'' if row in case['unticked'] else '✓'} | ✓ | |" for row in ROWS], ""]
    return js("const files = { 'docs/tests/schedule.md': %s }; const snapshot = { paths: Object.keys(files), read: async (p) => files[p] ?? null, blob: () => null };"
              "const parts = await resultRecords.resultStrategies.recipes['commit-and-levels']({ params: { candidate: { version: '2026.4.0', tag: 'v2026.4.0-rc.1', commit: 'c'.repeat(40) }, changelog: 'x' }, product: { snapshot } });"
              "return /The levels to run on it: (.*)/.exec(parts[0].text)[1].split(', ');" % json.dumps("\n".join(schedule)))


class TestReleaseRun(unittest.TestCase):
    def check(self, test: str, at_least: int = 1):
        loaded = [case for case in cases() if case["test"] == test]
        self.assertGreaterEqual(len(loaded), at_least, f"no case of {test}")
        for case in loaded:
            for entry in case["each"]:
                with self.subTest(case=case["name"], entry=entry):
                    self.assertEqual(agrees(drive(substitute(case["case"], entry)), substitute(case["expected"], entry)), [])

    # TST-1434001 · level: release · module: system
    # guards: A RELEASE RUNS EVERY TEST AT EVERY LEVEL; UC-013
    # given: a product with a test at each of the five levels (unit, component, system, release, user), whose release candidate is started and whose branch test-results holds a passing record of each test for the candidate's commit
    # input: the person accepts the release test report (acceptAndRelease)
    # expect: known positive — starting the candidate tags v2026.4.0-rc.1 on the commit and sets no release tag; the acceptance sets v2026.4.0 on that same commit, after the one commit that writes the report
    def test_a_release_is_tagged_once_every_test_of_every_level_has_run(self):
        self.check("TST-1434001")

    # TST-1434002 · level: release · module: system
    # guards: A RELEASE RUNS EVERY TEST AT EVERY LEVEL; UC-013
    # given: the same product, five times, with the record of the test of one level left out (unit, component, system, release, user in turn)
    # input: the person accepts the report; then the missing record is added and the person accepts it again
    # expect: each time the first acceptance is refused as Incomplete, writes nothing and sets no release tag; once the test of that level has run on the commit, the second releases — the known positive of the same case
    def test_a_test_of_any_one_level_that_has_not_run_stops_the_release(self):
        self.check("TST-1434002")

    # TST-1434003 · level: release · module: system
    # guards: A RELEASE RUNS EVERY TEST AT EVERY LEVEL; UC-028
    # given: records of every test for another commit, and for the candidate's commit records of all but the system test
    # input: the person accepts the report; then the system test's record of the candidate's commit is added and the person accepts again
    # expect: the first acceptance is refused as Incomplete and sets no tag — a run of another commit is no run of this one; the second releases
    def test_a_record_of_another_commit_is_no_run_on_the_candidates_commit(self):
        self.check("TST-1434003")

    # TST-1434004 · level: release · module: system
    # guards: A RELEASE RUNS EVERY TEST AT EVERY LEVEL; UC-013
    # given: records of every test, but no release candidate started
    # input: the person accepts the report; then the candidate is started and the person accepts again
    # expect: the first acceptance is refused as Incomplete, writes nothing and sets no tag; after the start, the second releases on the candidate's commit — the known positive of the same case
    def test_nothing_is_released_while_no_candidate_was_started(self):
        self.check("TST-1434004")

    # TST-1434005 · level: release · module: system
    # guards: A RELEASE RUNS EVERY TEST AT EVERY LEVEL; UC-013
    # given: a product whose default branch took an unrelated commit; a candidate started on its head, and started again
    # input: startReleaseCandidate twice with the version 2026.4.0
    # expect: v2026.4.0-rc.1 and then v2026.4.0-rc.2, each on the head of its start; one commit each, which queues the run; no release tag v2026.4.0 and no report
    def test_starting_a_candidate_tags_the_candidate_and_queues_its_run_and_releases_nothing(self):
        self.check("TST-1434005")

    # TST-1434006 · level: release · module: system
    # guards: ACCEPTING THE RELEASE TEST REPORT RELEASES; UC-013
    # given: a green, complete candidate; the default branch took an unrelated commit after the candidate was tested
    # input: the person accepts the report
    # expect: one commit writes the report, its approval record naming the report's blob, and the changelog entry dated and worded as chosen, with no limitation; then v2026.4.0 is set on the candidate's commit, not on the commit just written
    def test_accepting_a_green_report_commits_the_entry_and_tags_the_tested_commit(self):
        self.check("TST-1434006")

    # TST-1434007 · level: release · module: system
    # guards: ACCEPTING THE RELEASE TEST REPORT RELEASES; UC-013
    # given: the same candidate, with the report as the person was shown it altered since
    # input: the person accepts that report; then accepts the report as it stands
    # expect: the first acceptance is refused as Moved: no commit, no approval record, no tag; the second releases — the known positive of the same case
    def test_a_report_that_changed_since_it_was_shown_releases_nothing(self):
        self.check("TST-1434007")

    # TST-1434008 · level: release · module: system
    # guards: ACCEPTING THE RELEASE TEST REPORT RELEASES; UC-013
    # given: a candidate released by an acceptance
    # input: the person accepts the report a second time
    # expect: the first acceptance releases; the second is refused as TagExists and writes nothing, and v2026.4.0 stays on the candidate's commit
    def test_an_accepted_report_is_not_released_a_second_time(self):
        self.check("TST-1434008")

    # TST-1434009 · level: release · module: system
    # guards: ACCEPTING THE RELEASE TEST REPORT RELEASES; UC-013
    # given: a green, complete candidate, and the tag v2026.4.0 standing already on another commit
    # input: the person accepts the report
    # expect: refused as TagExists with nothing committed — no report, no approval record, no changelog entry — and the tag stays where it was
    def test_a_tag_that_stands_is_not_moved_and_nothing_is_committed(self):
        self.check("TST-1434009")

    # TST-1434010 · level: release · module: system
    # guards: ACCEPTING THE RELEASE TEST REPORT RELEASES; UC-013
    # given: the dashboard's release panel of a product with a test at each of the five levels; the person starts the candidate, the records come in, and Check results shows the complete report
    # input: one click on Accept and release
    # expect: before the click the panel offers Accept and release and no reason field, and only the candidate's tag stands; after it, one commit writes the report, its approval record and the changelog entry, v2026.4.0 stands on the candidate's commit, and the panel says "Released v2026.4.0"
    def test_the_dashboards_accept_and_release_releases_in_one_click(self):
        self.check("TST-1434010")

    # TST-1434011 · level: release · module: system
    # guards: ACCEPTING THE RELEASE TEST REPORT RELEASES; UC-013
    # given: the same panel and complete report; the person looks at it again and does not accept
    # input: Check results pressed twice; then Accept and release pressed
    # expect: counter-proof — until the press, no commit and no tag beyond the candidate's, no approval record, and the panel offers no way to reject the report; the press releases — the known positive of the same case
    def test_a_report_not_accepted_sets_no_tag_and_the_dashboard_offers_no_reject(self):
        self.check("TST-1434011")

    # TST-1434012 · level: release · module: system
    # guards: A RED RELEASE IS ACCEPTED ONLY WITH ITS LIMITATIONS RECORDED; UC-013
    # given: a complete run in which the component test failed
    # input: the person accepts the report without a reason; then with the reason "known flaky fixture"
    # expect: the first is refused as LimitationMissing naming TST-002, with nothing written and no tag; the second releases, its approval record holds the line "limitation: TST-002 — known flaky fixture" and the changelog entry lists the known limitation
    def test_a_failing_test_is_released_only_with_its_reason_recorded(self):
        self.check("TST-1434012")

    # TST-1434013 · level: release · module: system
    # guards: A RED RELEASE IS ACCEPTED ONLY WITH ITS LIMITATIONS RECORDED; UC-028
    # given: a system test that passed in one record of the candidate's commit and failed in another
    # input: the person accepts the report without a reason; then with one
    # expect: the first is refused as LimitationMissing naming TST-003 — a flaky test is no pass —; the second releases with its limitation line
    def test_a_test_that_flips_on_the_candidates_commit_needs_its_reason(self):
        self.check("TST-1434013")

    # TST-1434014 · level: release · module: system
    # guards: A RED RELEASE IS ACCEPTED ONLY WITH ITS LIMITATIONS RECORDED; UC-013
    # given: a model-dependent test whose rate on the candidate's commit, 6 of 10, is worse than the last release's 8 of 10
    # input: the person accepts the report without a reason; then with one
    # expect: the first is refused as LimitationMissing naming TST-006; the second releases, its approval record holds "limitation: TST-006 — model drift, accepted"
    def test_a_worse_rate_is_released_only_with_its_reason_recorded(self):
        self.check("TST-1434014")

    # TST-1434015 · level: release · module: system
    # guards: A RED RELEASE IS ACCEPTED ONLY WITH ITS LIMITATIONS RECORDED; UC-013
    # given: the same model-dependent test at 8 of 10, as in the last release
    # input: the person accepts the report without a reason
    # expect: counter-proof — it releases, its approval record holds no limitation line and the changelog entry lists none; a rate no worse is no limitation
    def test_a_rate_no_worse_needs_no_reason(self):
        self.check("TST-1434015")

    # TST-1434016 · level: release · module: system
    # guards: A RED RELEASE IS ACCEPTED ONLY WITH ITS LIMITATIONS RECORDED; UC-013
    # given: a complete run in which the component test and the system test failed
    # input: the person accepts with a reason for the component test only; then with a blank reason for the system test; then with a reason for each
    # expect: the first two are refused as LimitationMissing naming TST-003 alone, with nothing written; the third releases, its approval record holding one limitation line for each, in order
    def test_every_failing_test_needs_a_reason_of_its_own(self):
        self.check("TST-1434016")

    # TST-1434017 · level: release · module: system
    # guards: A RED RELEASE IS ACCEPTED ONLY WITH ITS LIMITATIONS RECORDED; UC-013
    # given: the dashboard's release panel with a complete report in which the component test failed
    # input: Accept and release pressed with no reason typed; then with one typed
    # expect: the panel offers a reason field for TST-002; the first press is answered "Enter a reason for every failing test and worse rate before releasing: TST-002." with nothing written and no tag; the second releases with the limitation recorded
    def test_the_dashboard_asks_a_reason_for_every_failing_test_before_it_releases(self):
        self.check("TST-1434017")

    def levels(self, test: str):
        (case,) = [case for case in cases() if case["test"] == test]
        got = levels_of_run(case["case"])
        # known positive: the rows the recipe gives today are given
        for row in case["expected"]["known"]:
            self.assertIn(row, got)
        self.assertEqual(got, case["expected"]["levels"])

    # TST-1434018 · level: release · module: system
    # guards: A RELEASE RUNS EVERY TEST AT EVERY LEVEL; UC-028
    # given: a complete run whose one record, of the candidate's commit, is marked as made in a working tree with uncommitted changes
    # input: the person accepts the report; then a record of the committed state is added and the person accepts again
    # expect: the first acceptance is refused as Incomplete and sets no tag — the record is shown, not counted —; the second releases
    def test_a_record_with_uncommitted_changes_is_no_run_on_the_commit(self):
        self.check("TST-1434018")

    # TST-1434021 · level: release · module: system
    # guards: A RELEASE RUNS EVERY TEST AT EVERY LEVEL; UC-013
    # given: the schedule that ticks every row for a release candidate, and one that leaves system and user empty
    # input: the levels MOD-result-records' recipe commit-and-levels gives the run-tests job queued for a candidate
    # expect: the levels the schedule ticks are named — unit, component, system, release and user for the first; unit, component and release for the second —, the known positive of TST-1434019 and TST-1434020
    def test_the_run_of_a_candidate_names_the_levels_the_schedule_ticks(self):
        loaded = [case for case in cases() if case["test"] in ("TST-1434019", "TST-1434020")]
        self.assertEqual(len(loaded), 2)
        for case in loaded:
            got = levels_of_run(case["case"])
            for row in case["expected"]["known"]:
                self.assertIn(row, got, case["name"])

    # TST-1434019 · level: release · module: system
    # guards: A RELEASE RUNS EVERY TEST AT EVERY LEVEL; UC-013
    # given: the schedule that ticks every row for a release candidate, the row paid included
    # input: the levels MOD-result-records' recipe commit-and-levels gives the run-tests job that startReleaseCandidate queues for a candidate
    # expect: known positive — unit, component, system, release and user are named; and the row paid, which holds the tests that call a paid service, is named too, so that every test runs on the candidate
    def test_the_run_of_a_candidate_names_the_row_of_the_tests_that_call_a_paid_service(self):
        self.levels("TST-1434019")

    # TST-1434020 · level: release · module: system
    # guards: A RELEASE RUNS EVERY TEST AT EVERY LEVEL; UC-028
    # given: a schedule whose release candidate column is empty for the rows system and user
    # input: the levels the recipe commit-and-levels gives the run-tests job queued for a candidate
    # expect: known positive — unit, component and release are named; and system, user and paid are named too, "whatever the schedule's other columns say"
    def test_the_run_of_a_candidate_names_every_row_whatever_the_schedule_says(self):
        self.levels("TST-1434020")


if __name__ == "__main__":
    unittest.main()
