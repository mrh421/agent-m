# Job assignment cases

The data of tests/test_job_assignment.py. The product is the fixture of the parallel sprints (tests/fixtures/parallel-sprints/): the model works in sprints, two teams, team1 and team2, each with a role assignment of its own under docs/role-assignments/ — team1 gives the role Developers to dev-a, team2 to dev-b, and both give the Product Owner to alice —; team1's running sprint holds ITM-001, ITM-003 and ITM-005, team2's holds ITM-007 and ITM-008. The participants alice, dev-a and dev-b are the instance's; dev-a and dev-b have what the role Developers needs, alice has not.

- `jobs` are the jobs handed out: for each, the `team` whose running sprint holds the `item`.
- `assignments` replaces the text of a team's role assignment (`team1`, `team2`) where a case gives one.
- `expected` is, for each job in the order of `jobs`, the participants to which the job may go: those for which MOD-work-plans' `startable` admits the item under the job's own role assignment, the participants asked one at a time.

## each team's job goes to the holder of the role in that team's assignment

### Case

```json
{
  "group": "teams",
  "jobs": [{ "team": "team1", "item": "ITM-005" }, { "team": "team2", "item": "ITM-008" }],
  "assignments": {},
  "expected": [["dev-a"], ["dev-b"]]
}
```

## a role held by two participants of one team goes to either of them, and the other team's job still goes to its own holder

### Case

```json
{
  "group": "several",
  "jobs": [{ "team": "team1", "item": "ITM-005" }, { "team": "team2", "item": "ITM-008" }],
  "assignments": { "team1": "# team1\n\n## Roles\n\n| Role | Participants |\n|---|---|\n| Product Owner | alice |\n| Developers | dev-a, dev-b |\n" },
  "expected": [["dev-a", "dev-b"], ["dev-b"]]
}
```

## a participant that holds the role only in the other team receives no job of this team

### Case

```json
{
  "group": "other",
  "jobs": [{ "team": "team1", "item": "ITM-001" }, { "team": "team1", "item": "ITM-003" }, { "team": "team2", "item": "ITM-007" }],
  "assignments": { "team2": "# team2\n\n## Roles\n\n| Role | Participants |\n|---|---|\n| Product Owner | alice |\n| Developers | dev-b |\n" },
  "expected": [["dev-a"], ["dev-a"], ["dev-b"]]
}
```

## a role assignment that gives the role to a participant without what the role needs hands the job to no one

### Case

```json
{
  "group": "capable",
  "jobs": [{ "team": "team1", "item": "ITM-005" }, { "team": "team2", "item": "ITM-008" }],
  "assignments": { "team1": "# team1\n\n## Roles\n\n| Role | Participants |\n|---|---|\n| Product Owner | alice |\n| Developers | alice |\n" },
  "expected": [[], ["dev-b"]]
}
```

## the same assignments with the participants swapped hand each job to the other participant

### Case

```json
{
  "group": "swapped",
  "jobs": [{ "team": "team1", "item": "ITM-005" }, { "team": "team2", "item": "ITM-008" }],
  "assignments": {
    "team1": "# team1\n\n## Roles\n\n| Role | Participants |\n|---|---|\n| Product Owner | alice |\n| Developers | dev-b |\n",
    "team2": "# team2\n\n## Roles\n\n| Role | Participants |\n|---|---|\n| Product Owner | alice |\n| Developers | dev-a |\n"
  },
  "expected": [["dev-b"], ["dev-a"]]
}
```
