# Module: MOD-work-plans
# Guards: EVERY TEAM RUNS SPRINTS OF ITS OWN; A SPRINT HOLDS ITS ITEMS UNTIL THEY REACH THE DEFAULT BRANCH; SPRINTS OF DIFFERENT TEAMS CHANGE NO MODULE THE OTHER CHANGES OR USES; SPRINT PLANNING SHOWS WHAT THE OTHER TEAMS' SPRINTS HOLD; UC-032; UC-041
# Level: component
"""SPEC §13 — several teams of one product run sprints at the same time:

- EVERY TEAM RUNS SPRINTS OF ITS OWN — runs sprints of several teams of one product at the same time, and checks that each
  team's sprints are its own: numbered within the team, holding what the team selected, and unchanged by another team's
  sprint starting or closing;
- A SPRINT HOLDS ITS ITEMS UNTIL THEY REACH THE DEFAULT BRANCH — follows held items through their sprint's close, the
  merges into the default branch and an increment given up, and checks that an item stays held until its change is merged
  there, it returns to the backlog or its increment is given up;
- SPRINTS OF DIFFERENT TEAMS CHANGE NO MODULE THE OTHER CHANGES OR USES — plans a sprint while other teams' sprints hold
  items, compares the modules each item changes and uses with those of the held items, and checks that no item sharing a
  module is selectable and that each refusal names the holding sprint, the item and the module;
- SPRINT PLANNING SHOWS WHAT THE OTHER TEAMS' SPRINTS HOLD — checks that each item another team's sprint holds comes with
  its sprint, the modules it changes and the modules they use.

MOD-work-plans' heldItems, itemStates, conflicts, startSprint and closeSprint, asked through node over the fixture product of tests/parallel_sprints_fixture.py:
two teams, team1 running sprint 01, team2 having closed sprint 01 and running sprint 02. Every expectation is read from the
fixture's data, never from the code under test. A team closes and starts its sprints through closeSprint and startSprint,
over a fake of the repository host; its sprint planning is the Backlog page of the real dashboard with Plan sprint open.
"""
import json
import re
import unittest

from parallel_sprints_fixture import (CURRENT, ITEMS, PULL_REQUESTS, SELECTIONS, SPRINTS, FIX, all_ready, conflicts_of, held,
                                     host_prelude, planning_page, prelude, uses_of)
from jsrun import js

CLOSED = "docs/backlog/sprints/team2/01.md"
RUNNING_ON_ITS_BRANCH = "docs/backlog/sprints/team1/01.md"


def by_sprint(entries: list) -> dict:
    out = {}
    for entry in entries:
        out.setdefault(entry["sprint"], []).append(entry["item"])
    return out


def before_its_close(path: str) -> str:
    """A sprint record as it stood before its close appended its review, unfinished items and retrospective."""
    return (FIX / path).read_text(encoding="utf-8").split("\n## Review")[0] + "\n"


class EveryTeamRunsSprintsOfItsOwn(unittest.TestCase):
    # TST-475018 · level: component · module: MOD-work-plans
    # guards: EVERY TEAM RUNS SPRINTS OF ITS OWN; A SPRINT HOLDS ITS ITEMS UNTIL THEY REACH THE DEFAULT BRANCH; SPRINTS OF DIFFERENT TEAMS CHANGE NO MODULE THE OTHER CHANGES OR USES; SPRINT PLANNING SHOWS WHAT THE OTHER TEAMS' SPRINTS HOLD; UC-032; UC-041
    # given: the sprint records of the fixture product of tests/parallel_sprints_fixture.py: two teams, team1 running sprint 01, team2 having closed sprint 01 and running sprint 02
    # input: the folder and number of each sprint path
    # expect: team1 has sprint 01; team2 has sprints 01 and 02; each numbered within its team
    def test_each_teams_sprints_stand_in_its_own_folder_numbered_within_the_team(self):
        teams = {}
        for path in SPRINTS:
            team, number = path.split("/")[-2], path.split("/")[-1][:-3]
            teams.setdefault(team, []).append(number)
        self.assertEqual(teams, {"team1": ["01"], "team2": ["01", "02"]})

    # TST-475019 · level: component · module: MOD-work-plans
    # guards: EVERY TEAM RUNS SPRINTS OF ITS OWN; A SPRINT HOLDS ITS ITEMS UNTIL THEY REACH THE DEFAULT BRANCH; SPRINTS OF DIFFERENT TEAMS CHANGE NO MODULE THE OTHER CHANGES OR USES; SPRINT PLANNING SHOWS WHAT THE OTHER TEAMS' SPRINTS HOLD; UC-032; UC-041
    # given: the running sprint of each team in the fixture product of tests/parallel_sprints_fixture.py: two teams, team1 running sprint 01, team2 having closed sprint 01 and running sprint 02
    # input: heldItems of the fixture
    # expect: each running sprint holds what its own team selected, and every entry's team is the team of its sprint
    def test_each_running_sprint_holds_what_its_own_team_selected(self):
        got = by_sprint(held())
        self.assertEqual(got, {f"{team}/{path.split('/')[-1][:-3]}": SELECTIONS[path] for team, path in CURRENT.items()})
        self.assertTrue(all(entry["team"] == entry["sprint"].split("/")[0] for entry in held()))

    # TST-475020 · level: component · module: MOD-work-plans
    # guards: EVERY TEAM RUNS SPRINTS OF ITS OWN; A SPRINT HOLDS ITS ITEMS UNTIL THEY REACH THE DEFAULT BRANCH; SPRINTS OF DIFFERENT TEAMS CHANGE NO MODULE THE OTHER CHANGES OR USES; SPRINT PLANNING SHOWS WHAT THE OTHER TEAMS' SPRINTS HOLD; UC-032; UC-041
    # given: team1 holds items in the fixture product of tests/parallel_sprints_fixture.py: two teams, team1 running sprint 01, team2 having closed sprint 01 and running sprint 02
    # input: heldItems with team2's close undone (sprint text before its review), and with team2's sprint 02 removed (start undone)
    # expect: team1's held items are the same as now; known positive: team1 holds items
    def test_another_team_starting_or_closing_a_sprint_changes_nothing_a_team_holds(self):
        team1 = lambda entries: [entry for entry in entries if entry["team"] == "team1"]
        now = team1(held())
        self.assertTrue(now, "known positive: team1 holds items")
        self.assertEqual(team1(held(texts={CLOSED: before_its_close(CLOSED)})), now, "team2's close")
        self.assertEqual(team1(held(paths=[p for p in SPRINTS if not p.endswith("team2/02.md")])), now, "team2's start")

    # TST-475021 · level: component · module: MOD-work-plans
    # guards: EVERY TEAM RUNS SPRINTS OF ITS OWN; A SPRINT HOLDS ITS ITEMS UNTIL THEY REACH THE DEFAULT BRANCH; SPRINTS OF DIFFERENT TEAMS CHANGE NO MODULE THE OTHER CHANGES OR USES; SPRINT PLANNING SHOWS WHAT THE OTHER TEAMS' SPRINTS HOLD; UC-032; UC-041
    # given: team2's sprint 02 running with two unfinished items, over a fake of the repository host
    # input: closeSprint of team2/02 (ITM-007 to next sprint, ITM-008 to backlog), then startSprint of team2 selecting ITM-007
    # expect: the new sprint is docs/backlog/sprints/team2/03.md on branch sprint/team2/03; team1's held items are unchanged; team2 holds only ITM-007 in team2/03
    def test_a_team_closes_its_sprint_and_starts_its_next_numbered_within_the_team_and_the_other_team_holds_the_same(self):
        got = js(prelude() + host_prelude() + f"""
            const team1 = (entries) => entries.filter((e) => e.team === 'team1');
            const before = team1(held);
            const facts = {{ increment: [], notDone: [{{ item: 'ITM-007', state: 'in progress', reason: 'its pull request is open' }},
              {{ item: 'ITM-008', state: 'ready', reason: null }}], numbers: {{}} }};
            await workPlans.closeSprint(host, {{ sprint: 'team2/02', review: {{ feedback: [], tookPart: ['alice'], sources: null }},
              unfinished: [{{ item: 'ITM-007', to: 'next sprint', reason: 'its review goes on' }},
                {{ item: 'ITM-008', to: 'backlog', reason: 'waits for sign-in' }}],
              retrospective: [{{ text: 'Review sooner.', kind: 'change', goes: 'team agreement' }}], newItems: [] }},
              {{ facts, architecture, head: HEAD, trailers: [] }});
            const started = await workPlans.startSprint(host, {{ team: 'team2', goal: 'Sign-in again', start: '2026-10-15',
              closer: 'alice', selection: ['ITM-007'] }}, {{ states: {json.dumps(all_ready())}, model, declaration, held,
              architecture, running: null, head: HEAD, trailers: [] }});
            const now = Object.keys(files).filter((p) => p.startsWith('docs/backlog/sprints/')).sort()
              .map((p) => documents.readDocument(workPlans.planSchemas.sprint, p, files[p]));
            const after = workPlans.heldItems(now, items, architecture, {json.dumps(PULL_REQUESTS)});
            return {{ path: started.path, branches: calls.filter((c) => c[0] === 'createBranch').map((c) => c[1]),
              team1Before: before, team1After: team1(after),
              team2After: after.filter((e) => e.team === 'team2').map((e) => [e.item, e.sprint]) }};""")
        self.assertEqual(got["path"], "docs/backlog/sprints/team2/03.md", "numbered within team2, after its 01 and 02")
        self.assertEqual(got["branches"], ["sprint/team2/03"])
        self.assertEqual(got["team1After"], got["team1Before"], "team2's close and start change nothing team1 holds")
        self.assertEqual(got["team2After"], [["ITM-007", "team2/03"]], "team2's closed sprint holds nothing; its new one ITM-007")


class ASprintHoldsItsItemsUntilTheyReachTheDefaultBranch(unittest.TestCase):
    # TST-475022 · level: component · module: MOD-work-plans
    # guards: EVERY TEAM RUNS SPRINTS OF ITS OWN; A SPRINT HOLDS ITS ITEMS UNTIL THEY REACH THE DEFAULT BRANCH; SPRINTS OF DIFFERENT TEAMS CHANGE NO MODULE THE OTHER CHANGES OR USES; SPRINT PLANNING SHOWS WHAT THE OTHER TEAMS' SPRINTS HOLD; UC-032; UC-041
    # given: ITM-001's pull request merged into the sprint branch sprint/team1/01, and a pull request of that branch into main added with a merge time
    # input: heldItems with the branch merged before the item's merge, after it, and with it open
    # expect: ITM-001 stays held when the branch is merged before the item or not at all; it is not held when merged after; ITM-003 stays held with an open pull request
    def test_an_item_merged_into_its_sprints_branch_stays_held_until_that_branch_reaches_the_default_branch(self):
        merged_into_branch = next(pr for pr in PULL_REQUESTS if pr["branch"] == "work/ITM-001")
        self.assertEqual((merged_into_branch["state"], merged_into_branch["base"]), ("merged", "sprint/team1/01"))
        held_items = lambda prs: [entry["item"] for entry in held(prs) if entry["sprint"] == "team1/01"]
        self.assertIn("ITM-001", held_items(PULL_REQUESTS))
        branch = lambda merged: {"number": 9, "title": "The increment of team1's sprint 01", "branch": "sprint/team1/01",
                                 "base": "main", "head": "b" * 40, "state": "merged", "draft": False,
                                 "url": "https://github.com/alice/product/pull/9", "opened": "2026-10-08T12:00:00Z",
                                 "merged": merged, "closed": merged}
        self.assertIn("ITM-001", held_items(PULL_REQUESTS + [branch("2026-10-07T12:00:00Z")]), "merged before the item's merge")
        self.assertNotIn("ITM-001", held_items(PULL_REQUESTS + [branch("2026-10-09T12:00:00Z")]), "merged after it")
        self.assertIn("ITM-003", held_items(PULL_REQUESTS + [branch("2026-10-09T12:00:00Z")]), "an open pull request")

    # TST-475023 · level: component · module: MOD-work-plans
    # guards: EVERY TEAM RUNS SPRINTS OF ITS OWN; A SPRINT HOLDS ITS ITEMS UNTIL THEY REACH THE DEFAULT BRANCH; SPRINTS OF DIFFERENT TEAMS CHANGE NO MODULE THE OTHER CHANGES OR USES; SPRINT PLANNING SHOWS WHAT THE OTHER TEAMS' SPRINTS HOLD; UC-032; UC-041
    # given: the fixture, team2's sprint 01 closed with ITM-002 merged and ITM-006 back in the backlog
    # input: heldItems of the fixture, and with the pull requests 1 and 2 removed and sprint 01 as it stood before its close
    # expect: the closed sprint team2/01 holds nothing; before the merge and close it holds ITM-002 and ITM-006
    def test_an_item_whose_change_reached_the_default_branch_or_that_went_back_to_the_backlog_is_no_longer_held(self):
        self.assertNotIn(CLOSED.split("sprints/")[1][:-3], by_sprint(held()))
        before = held(pull_requests=[pr for pr in PULL_REQUESTS if pr["number"] not in (1, 2)],
                      texts={CLOSED: before_its_close(CLOSED)})
        self.assertEqual(by_sprint(before)["team2/01"], ["ITM-002", "ITM-006"], "known positive: held before merge and close")

    # TST-475024 · level: component · module: MOD-work-plans
    # guards: EVERY TEAM RUNS SPRINTS OF ITS OWN; A SPRINT HOLDS ITS ITEMS UNTIL THEY REACH THE DEFAULT BRANCH; SPRINTS OF DIFFERENT TEAMS CHANGE NO MODULE THE OTHER CHANGES OR USES; SPRINT PLANNING SHOWS WHAT THE OTHER TEAMS' SPRINTS HOLD; UC-032; UC-041
    # given: the fixture
    # input: heldItems with the pull requests unknown
    # expect: team2/01 holds ITM-002, and team1/01 holds its whole selection
    def test_with_the_pull_requests_unknown_every_selected_item_not_sent_back_is_held(self):
        got = by_sprint(held("unknown"))
        self.assertEqual(got["team2/01"], ["ITM-002"])
        self.assertEqual(got["team1/01"], SELECTIONS[CURRENT["team1"]])


    # TST-1232001 · level: component · module: MOD-work-plans
    # guards: A SPRINT HOLDS ITS ITEMS UNTIL THEY REACH THE DEFAULT BRANCH; UC-041
    # given: team1's sprint 01 of the fixture, on its own branch sprint/team1/01, ITM-001 merged into that branch (pull request 3), ITM-003 with an open pull request; its record closed (## Review, ## Unfinished items sending ITM-003 and ITM-005 back to the backlog, ## Retrospective), its branch not merged into main
    # input: heldItems with that closed record, and with that record followed by ## Increment given up (at, by, reason); itemStates of ITM-001 over the fixture's pull requests
    # expect: closed only, team1/01 still holds ITM-001 (known positive); given up, team1/01 holds none of its items; ITM-001 stays done
    def test_a_sprint_whose_increment_is_given_up_holds_none_of_its_items_and_its_done_items_stay_done(self):
        merged = next(pr for pr in PULL_REQUESTS if pr["branch"] == "work/ITM-001")
        self.assertEqual((merged["state"], merged["base"]), ("merged", "sprint/team1/01"))
        closed = (FIX / RUNNING_ON_ITS_BRANCH).read_text(encoding="utf-8") + (
            "\n## Review\n\nThe increment is ITM-001, merged into the sprint's branch.\n\n"
            "## Unfinished items\n\nto the backlog: ITM-003, ITM-005\ninto the next sprint:\n\n"
            "ITM-003 and ITM-005 wait for the mail's layout.\n\n## Retrospective\n\nThe team merges its branch sooner.\n")
        given_up = closed + "\n## Increment given up\n\nat: 2026-10-20\nby: Product Owner\nreason: the store is built anew\n"
        sprint = RUNNING_ON_ITS_BRANCH.split("sprints/")[1][:-3]
        self.assertEqual(by_sprint(held(texts={RUNNING_ON_ITS_BRANCH: closed})).get(sprint), ["ITM-001"],
                         "known positive: closed, its increment not merged, the sprint holds its done item")
        self.assertNotIn(sprint, by_sprint(held(texts={RUNNING_ON_ITS_BRANCH: given_up})), "given up, it holds none of its items")
        states = js(prelude({RUNNING_ON_ITS_BRANCH: given_up}) + f"""
            return workPlans.itemStates(items, null, {{ statuses: new Map(), queues: [], jobs: [],
              pullRequests: {json.dumps(PULL_REQUESTS)}, gates: [], workflow: null }});""")
        self.assertEqual(next(s["state"] for s in states if s["item"] == "ITM-001"), "done", "its done item stays done")


class SprintsOfDifferentTeamsChangeNoModuleTheOtherChangesOrUses(unittest.TestCase):
    def expected(self, item: str, team: str, held_items: list) -> set:
        found = set()
        for entry in held_items:
            if entry["team"] == team:
                continue
            changes, uses = set(ITEMS[entry["item"]]), uses_of(entry["item"])
            shared = (changes & set(ITEMS[item])) | (changes & uses_of(item)) | (uses & set(ITEMS[item]))
            found |= {(entry["sprint"], entry["item"], module) for module in shared}
        return found

    # TST-475025 · level: component · module: MOD-work-plans
    # guards: EVERY TEAM RUNS SPRINTS OF ITS OWN; A SPRINT HOLDS ITS ITEMS UNTIL THEY REACH THE DEFAULT BRANCH; SPRINTS OF DIFFERENT TEAMS CHANGE NO MODULE THE OTHER CHANGES OR USES; SPRINT PLANNING SHOWS WHAT THE OTHER TEAMS' SPRINTS HOLD; UC-032; UC-041
    # given: the held items of the fixture product of tests/parallel_sprints_fixture.py: two teams, team1 running sprint 01, team2 having closed sprint 01 and running sprint 02
    # input: conflicts of every item for each team
    # expect: the conflicts are exactly the (sprint, item, module) triples where the item shares a module with another team's held item, each naming sprint, item and module; known positive: some item is kept
    def test_each_item_is_kept_from_a_teams_selection_exactly_when_it_shares_a_module_with_another_teams_held_item(self):
        held_items = held()
        refused = 0
        for team in CURRENT:
            for item in ITEMS:
                got = conflicts_of(item, team, held_items)
                with self.subTest(team=team, item=item):
                    self.assertEqual({(c["sprint"], c["item"], c["module"]) for c in got}, self.expected(item, team, held_items))
                    self.assertTrue(all(c["sprint"] and c["item"] and c["module"] for c in got))
                    refused += bool(got)
        self.assertTrue(refused, "known positive: some item is kept from a selection")

    # TST-475026 · level: component · module: MOD-work-plans
    # guards: EVERY TEAM RUNS SPRINTS OF ITS OWN; A SPRINT HOLDS ITS ITEMS UNTIL THEY REACH THE DEFAULT BRANCH; SPRINTS OF DIFFERENT TEAMS CHANGE NO MODULE THE OTHER CHANGES OR USES; SPRINT PLANNING SHOWS WHAT THE OTHER TEAMS' SPRINTS HOLD; UC-032; UC-041
    # given: ITM-002, which shares a module with an item team1's sprint holds, selected by team2
    # input: startSprint of team2 with the selection ITM-002
    # expect: startSprint is refused with SprintRefused, nothing is created or committed, and the reasons name the sprint, the item and the module
    def test_start_sprint_refuses_a_selection_that_shares_a_module_naming_the_sprint_the_item_and_the_module(self):
        candidate = "ITM-002"
        expected = self.expected(candidate, "team2", held())
        self.assertTrue(expected, "known positive: ITM-002 shares a module with an item team1's sprint holds")
        got = js(prelude() + host_prelude() + f"""
            try {{
              await workPlans.startSprint(host, {{ team: 'team2', goal: 'The pages', start: '2026-10-15', closer: 'alice',
                selection: [{json.dumps(candidate)}] }}, {{ states: {json.dumps(all_ready())}, model, declaration, held,
                architecture, running: null, head: HEAD, trailers: [] }});
              return {{ refused: null }};
            }} catch (error) {{
              return {{ refused: error.name, reasons: error.reasons ?? [], written: calls.filter((c) => c[0] !== 'readSnapshot') }};
            }}""")
        self.assertEqual(got["refused"], "SprintRefused")
        self.assertEqual(got["written"], [], "nothing created, nothing committed")
        text = " ".join(got["reasons"])
        for sprint, item, module in expected:
            self.assertTrue(sprint in text and item in text and module in text, (sprint, item, module, text))


class SprintPlanningShowsWhatTheOtherTeamsSprintsHold(unittest.TestCase):
    # TST-475027 · level: component · module: MOD-work-plans
    # guards: EVERY TEAM RUNS SPRINTS OF ITS OWN; A SPRINT HOLDS ITS ITEMS UNTIL THEY REACH THE DEFAULT BRANCH; SPRINTS OF DIFFERENT TEAMS CHANGE NO MODULE THE OTHER CHANGES OR USES; SPRINT PLANNING SHOWS WHAT THE OTHER TEAMS' SPRINTS HOLD; UC-032; UC-041
    # given: team2's sprint 02 holds items; the fixture product of tests/parallel_sprints_fixture.py: two teams, team1 running sprint 01, team2 having closed sprint 01 and running sprint 02
    # input: heldItems entries of other teams than team1
    # expect: each entry names sprint team2/02, the modules the item changes and the modules it uses; known positive: team2 holds items
    def test_each_item_another_teams_sprint_holds_comes_with_its_sprint_and_the_modules_it_changes_and_uses(self):
        others = [entry for entry in held() if entry["team"] != "team1"]
        self.assertTrue(others, "known positive: team2's sprint holds items")
        for entry in others:
            with self.subTest(item=entry["item"]):
                self.assertEqual(entry["sprint"], "team2/02")
                self.assertEqual(entry["changes"], ITEMS[entry["item"]])
                self.assertEqual(entry["uses"], sorted(uses_of(entry["item"])))

    # TST-475028 · level: component · module: MOD-work-plans
    # guards: EVERY TEAM RUNS SPRINTS OF ITS OWN; A SPRINT HOLDS ITS ITEMS UNTIL THEY REACH THE DEFAULT BRANCH; SPRINTS OF DIFFERENT TEAMS CHANGE NO MODULE THE OTHER CHANGES OR USES; SPRINT PLANNING SHOWS WHAT THE OTHER TEAMS' SPRINTS HOLD; UC-032; UC-041
    # given: team1 plans in the Backlog page of the real dashboard with Plan sprint open, while team2's sprint 02 holds what it selected
    # input: the planning page rendered for team1
    # expect: the held list has one row per item team2's sprint 02 holds with its sprint, the modules it changes and the modules they use; known positive: team2 holds items
    def test_a_teams_sprint_planning_lists_every_item_the_other_teams_sprints_hold(self):
        # team1 plans while team2's sprint 02 holds what it selected; team2's closed sprint 01 holds nothing any more — ITM-002
        # is merged into the default branch with the sprint's branch, ITM-006 went back to the backlog. Each row of the list
        # gives the item, its title, its sprint, the modules it changes and the modules they use.
        html = planning_page("team1")
        self.assertIn('data-part="held"', html, "the page lists what the other teams' sprints hold")
        listed = html[html.index('data-part="held"'):]
        listed = listed[:listed.find('<section class="panel"')] if '<section class="panel"' in listed else listed
        rows = {item: [re.sub(r"<[^>]+>", "", cell).strip() for cell in re.findall(r"<td[^>]*>(.*?)</td>", row, re.S)][2:]
                for item, row in re.findall(r'<tr data-held="([^"]+)">(.*?)</tr>', listed, re.S)}
        sprint = CURRENT["team2"].removeprefix("docs/backlog/sprints/").removesuffix(".md")
        expected = {item: [sprint, ", ".join(ITEMS[item]) or "—", ", ".join(sorted(uses_of(item))) or "—"]
                    for item in SELECTIONS[CURRENT["team2"]]}
        self.assertTrue(expected, "known positive: team2's sprint holds items")
        self.assertEqual(rows, expected)


if __name__ == "__main__":
    unittest.main()
