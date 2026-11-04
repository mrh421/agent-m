# Module: MOD-work-plans
# Module: MOD-product-process
# Guards: A JOB GOES ONLY TO A HOLDER OF ITS ROLE; UC-034
# Level: release
"""SPEC section 13 - the check named tests/test_job_assignment.py, for A JOB GOES ONLY TO A HOLDER OF ITS ROLE.

The cases live in tests/test_job_assignment.md. This file loads them. The product is the fixture of the parallel sprints of tests/parallel_sprints_fixture.py: two teams, each with its own role assignment and its own
running sprint, and the participants alice, dev-a and dev-b. For each job of a case - an item of a team's running sprint - node asks MOD-work-plans' startable, which decides whether a job starts for an item and
to whom it goes, once for each participant of the product on its own, with the role assignment of the job's team (MOD-product-process' holdsRole decides who holds a role in it), and the check compares the
participants the job may go to with the case's, which the case states itself.

Written for ITM-805 by developer-sonnet-j, who built none of the code it checks in MOD-product-process (built by developer-opus-e and without a trailer); of MOD-work-plans' startable it built nothing - developer-sonnet-j's
two commits in src/work-plans are backlogFindings (ITM-817) and teamSprint (ITM-1330), which this check does not run (RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER).
Reading the text leaves open: "hands out jobs" is read as the participants that MOD-work-plans' startable admits for the job's item, since the page offers a job only to those (MOD-implementation-pages,
Interfaces: implement) and a start record names one of them.
"""
import json
import re
import unittest
from pathlib import Path

from jsrun import js
from parallel_sprints_fixture import CURRENT, prelude

DATA = Path(__file__).with_suffix(".md")


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


def of_group(group: str) -> dict:
    chosen = [s for s in sections() if s["case"]["group"] == group]
    if len(chosen) != 1:
        raise AssertionError(f"expected one case of the group {group}, found {len(chosen)}")
    return chosen[0]


def holders(case: dict) -> list:
    """For each job of the case, the participants startable admits for it, asked one at a time under the job's role assignment."""
    texts = {f"docs/role-assignments/{team}.md": text for team, text in case["assignments"].items()}
    return js(prelude(texts) + f"""
      const jobs = {json.dumps(case["jobs"])}; const current = {json.dumps(CURRENT)};
      const states = items.map((item) => ({{ item: item.id, state: 'ready', reason: null, job: null, pullRequest: null }}));
      const held = workPlans.heldItems(sprints, items, architecture, []);
      return jobs.map(({{ team, item }}) => participants.filter((each) => workPlans.startable(item, states,
        {{ workflow, assignment: assignment(team), sprint: sprintAt(current[team]), held, wip: null, participants: [each] }}).startable).map((each) => each.name));""")


class TestJobAssignment(unittest.TestCase):
    # TST-805601 · level: release · module: MOD-work-plans
    # guards: A JOB GOES ONLY TO A HOLDER OF ITS ROLE
    # given: the fixture product of two teams, team1's Developers dev-a, team2's dev-b, and the case teams: ITM-005 of team1's running sprint and ITM-008 of team2's
    # input: startable for each job once for each participant alone, under the role assignment of the job's own team
    # expect: ITM-005 may go to dev-a alone; ITM-008 to dev-b alone: each job goes only to a holder of its role in its team's assignment, and dev-b, a holder in the other team, is not offered team1's job
    def test_each_teams_job_goes_to_the_holder_of_the_role_in_that_teams_assignment(self):
        loaded = of_group("teams")
        self.assertEqual(holders(loaded["case"]), loaded["case"]["expected"])

    # TST-805602 · level: release · module: MOD-work-plans
    # guards: A JOB GOES ONLY TO A HOLDER OF ITS ROLE
    # given: the cases several, other, capable and swapped: team1's assignment giving Developers to dev-a and dev-b; team2's giving them to dev-b alone; to alice, who cannot run tests; and the two teams' holders swapped
    # input: startable for each job once for each participant alone
    # expect: a role held by two participants of a team lets the job go to either, and the other team's job still to its own holder; the assignment decides, not the participant's name or team: swapped, the jobs go to the other participants; a holder without the capabilities the role needs is offered no job, and the other team's job still goes to dev-b; alice, the Product Owner, is offered none
    def test_the_assignment_of_the_job_decides_who_receives_it(self):
        for group in ("several", "other", "capable", "swapped"):
            loaded = of_group(group)
            with self.subTest(case=loaded["name"]):
                self.assertEqual(holders(loaded["case"]), loaded["case"]["expected"])

    # TST-805603 · level: release · module: MOD-work-plans
    # guards: A JOB GOES ONLY TO A HOLDER OF ITS ROLE
    # given: the case teams, and the same product asked for every participant at once: startable with dev-a, dev-b and alice together under team1's assignment
    # input: startable of ITM-005 and of ITM-008 with all participants, and with only the participant that is no holder of the role in the job's team
    # expect: with all participants the jobs start - the assignment has a holder -; with dev-b alone ITM-005 does not start and the reason names the role Developers and team1, with dev-a alone ITM-008 does not start and the reason names team2
    def test_a_job_whose_team_has_no_holder_among_those_asked_does_not_start_and_says_which_team(self):
        got = js(prelude() + f"""
          const states = items.map((item) => ({{ item: item.id, state: 'ready', reason: null, job: null, pullRequest: null }}));
          const held = workPlans.heldItems(sprints, items, architecture, []);
          const current = {json.dumps(CURRENT)};
          const ask = (team, item, who) => workPlans.startable(item, states, {{ workflow, assignment: assignment(team), sprint: sprintAt(current[team]), held, wip: null,
            participants: participants.filter((each) => who.includes(each.name)) }});
          return {{ all: [ask('team1', 'ITM-005', ['alice', 'dev-a', 'dev-b']).startable, ask('team2', 'ITM-008', ['alice', 'dev-a', 'dev-b']).startable],
            wrong: [ask('team1', 'ITM-005', ['dev-b']), ask('team2', 'ITM-008', ['dev-a'])] }};""")
        self.assertEqual(got["all"], [True, True])
        self.assertFalse(got["wrong"][0]["startable"])
        self.assertIn("Developers has no holder in team1", " ".join(got["wrong"][0]["reasons"]))
        self.assertFalse(got["wrong"][1]["startable"])
        self.assertIn("Developers has no holder in team2", " ".join(got["wrong"][1]["reasons"]))


if __name__ == "__main__":
    unittest.main()
