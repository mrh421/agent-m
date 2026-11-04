# Module: MOD-work-plans
# Module: MOD-workflow-entries
# Guards: A SPRINT ENDS WITH A RETROSPECTIVE; CLOSING A SPRINT CAN BE ASSIGNED TO A PARTICIPANT; A SPRINT CLOSED BY AN AGENT STARTS BY ITSELF; UC-041
# Guards: AN AGENT'S REVIEW NAMES WHERE ITS FEEDBACK CAME FROM; AN AGENT'S RETROSPECTIVE CHANGES NO PROCESS BY ITSELF
# Level: release
"""SPEC §13 — a sprint is closed with its review and its retrospective, by the participant its close is assigned to:

- A SPRINT ENDS WITH A RETROSPECTIVE — an agent's close without a retrospective is sent back and, never corrected, records
  nothing; with one entry the record holds it;
- CLOSING A SPRINT CAN BE ASSIGNED TO A PARTICIPANT — a sprint whose close is assigned to an agent is closed with a review and
  a retrospective recorded by that agent, and one assigned to a person by that person's own commit;
- A SPRINT CLOSED BY AN AGENT STARTS BY ITSELF — the product's schedule queues the agent's close when the time box ends or,
  without one, when every selected item is done, and no close otherwise;
- AN AGENT'S REVIEW NAMES WHERE ITS FEEDBACK CAME FROM — the closer is sent its sources by name, a review without stakeholder
  says so, and one listing a stakeholder names where their feedback is recorded;
- AN AGENT'S RETROSPECTIVE CHANGES NO PROCESS BY ITSELF — after an agent's retrospective the process model, the Definition of
  Done, the participants, the job definitions and the SPEC are byte-identical, every change it recommends to the process is an
  open entry of a SPEC change queue, and a draft that would write a file of the process is refused.

The world is tests/uc-041-harness.mjs, asked through node (tests/jsrun.py): the real job of the kind close-sprint, run
unattended as CI and a Bridge run it, over a product held in memory, and MOD-workflow-entries' onSchedule over temporary git
repositories. Every expected value is stated here, never read from the code under test.

Written for the release testing of sprint 142 by developer-opus-e (ITM-991), who implemented none of ITM-618, ITM-619,
ITM-620, ITM-986, ITM-1032 and ITM-1033, nor the behaviour any case of this file guards. A SPRINT ENDS WITH A REVIEW OF ITS
INCREMENT, which the SPEC names this file for too, rests on ITM-987, which developer-opus-e built: its release tests are
other writers' (tests/release-uc-041-close-a-sprint.test.mjs, BUILT_BY_WRITER), and this file holds none of it.
TST-991406 was moved to the accepted texts of MOD-work-plans and MOD-spec-changes by developer-sonnet-l (ITM-1406), who built
none of the behaviour it guards: developer-opus-e did.
"""
import json
import unittest
from pathlib import Path

from jsrun import js

HARNESS = (Path(__file__).resolve().parent / "uc-041-harness.mjs").as_uri()
PRE = f"const h = await import({json.dumps(HARNESS)});"
RECORD = "docs/backlog/sprints/team1/02.md"


def run(code: str):
    return js(PRE + code)


class ASprintEndsWithARetrospective(unittest.TestCase):
    # TST-991401 · level: release · module: system
    # guards: A SPRINT ENDS WITH A RETROSPECTIVE; UC-041
    # given: the product of tests/uc-041-harness.mjs: team1's sprint team1/02 has ended, its closer the agent closer-bot
    # input: the close job of team1/02 runs unattended; closer-bot answers every request with a close whose retrospective is empty; then, in the same product anew, with one entry "Review pull requests the same day"
    # expect: the second request carries the finding under A SPRINT ENDS WITH A RETROSPECTIVE; the empty close is refused with RetrospectiveMissing, nothing is committed and the record is unchanged; known positive — with one entry the record holds ## Retrospective with "change, to team agreement: Review pull requests the same day"
    def test_a_close_without_a_retrospective_is_returned_and_never_recorded(self):
        out = run("const w = await h.closeWorld(); const before = w.files[h.RECORD];"
                  "const empty = { ...h.CLOSE(), retrospective: [] };"
                  "const r = await w.run([empty, empty, empty, empty, empty]);"
                  "const v = await h.closeWorld(); const one = { ...h.CLOSE(), retrospective: [{ text: 'Review pull requests the same day', kind: 'change', goes: 'team agreement' }] };"
                  "const s = await v.run([one]);"
                  "return { rules: r.inputs[1].findings.map((f) => f.rule), failed: r.failed?.name, commits: w.commits.length, unchanged: w.files[h.RECORD] === before,"
                  " written: s.failed === null ? v.files[h.RECORD] : null };")
        self.assertEqual(out["rules"], ["A SPRINT ENDS WITH A RETROSPECTIVE"])
        self.assertEqual(out["failed"], "RetrospectiveMissing")
        self.assertEqual(out["commits"], 0)
        self.assertTrue(out["unchanged"])
        self.assertIn("## Retrospective\n\n- change, to team agreement: Review pull requests the same day\n", out["written"])


class ClosingASprintCanBeAssignedToAParticipant(unittest.TestCase):
    # TST-991402 · level: release · module: system
    # guards: CLOSING A SPRINT CAN BE ASSIGNED TO A PARTICIPANT; UC-041
    # given: team1/02 whose record names the agent closer-bot as its closer; the same sprint whose record names the person alice
    # input: closer-bot's close job runs; for alice's, alice closes it as her own input, with the facts the recipe derives and no job's lines
    # expect: the agent's close is one commit whose message ends with the job's lines naming Agent-M-Participant: closer-bot, its record holding ## Review and ## Retrospective; the person's close is one commit whose message is "Close sprint team1/02" alone, its record holding ## Review and ## Retrospective too
    def test_an_agent_and_a_person_each_close_the_sprint_assigned_to_them(self):
        out = run("const w = await h.closeWorld(); await w.run([h.CLOSE()]);"
                  "const files = await h.shop({ files: { [h.RECORD]: h.team1Sprint({ closer: 'alice' }) } });"
                  "const p = await h.closeWorld({ files }); const ctx = await p.context();"
                  "const facts = JSON.parse((await p.recipe()).find((x) => x.name === 'facts of sprint team1/02').text);"
                  "await workPlans.closeSprint(ctx.product.host, h.CLOSE(), { facts, architecture: [], head: ctx.product.snapshot.commit, trailers: [] });"
                  "return { agent: w.commits.map((c) => c.message), agentRecord: w.files[h.RECORD], person: p.commits.map((c) => c.message), personRecord: p.files[h.RECORD],"
                  " closer: /closer: (.*)/.exec(p.files[h.RECORD])[1] };")
        self.assertEqual(len(out["agent"]), 1)
        self.assertIn("\nAgent-M-Participant: closer-bot\n", out["agent"][0])
        for record in (out["agentRecord"], out["personRecord"]):
            self.assertIn("\n## Review\n", record)
            self.assertIn("\n## Retrospective\n", record)
        self.assertEqual(out["person"], ["Close sprint team1/02"])
        self.assertEqual(out["closer"], "alice")


SPRINT_01 = "docs/backlog/sprints/team1/01.md"


def sprint(end: str, closer: str) -> str:
    return (f"h.sprintText({{ n: 1, start: '2026-10-20', end: {json.dumps(end)}, closer: {json.dumps(closer)},"
            " selection: ['ITM-001', 'ITM-002'] })")


class ASprintClosedByAnAgentStartsByItself(unittest.TestCase):
    # TST-991403 · level: release · module: system
    # guards: A SPRINT CLOSED BY AN AGENT STARTS BY ITSELF; UC-041
    # given: a product whose schedule runs on 2026-10-31, the instance's participants closer-bot (a CI agent) and alice (a person), and team1's sprint 01 selecting ITM-001 and ITM-002: (a) its time box ended on 2026-10-26, closer closer-bot; (b) without a time box, both items done, closer closer-bot; counter-proofs — (c) without a time box, ITM-002 not done; (d) its time box ends on 2026-11-30; (e) ended on 2026-10-26, closer alice
    # input: the product's schedule runs onSchedule once in each
    # expect: (a) and (b) end done with one new job record each, of kind close-sprint, for closer-bot, started by the schedule, its parameter sprint team1/01, queued and not taken, naming the time box ended and every selected item done; (c), (d) and (e) end nothing to do with no record
    def test_the_schedule_starts_an_agents_close_when_the_sprint_ends_and_at_no_other_time(self):
        done = "{ [h.itemPath(1)]: h.itemText(1, { modules: ['MOD-store'], extra: ['built_by:', '  - ' + 'b'.repeat(40)] }), [h.itemPath(2)]: h.itemText(2, { modules: ['MOD-pages'], extra: ['built_by:', '  - ' + 'b'.repeat(40)] }) }"
        one = "{ [h.itemPath(1)]: h.itemText(1, { modules: ['MOD-store'], extra: ['built_by:', '  - ' + 'b'.repeat(40)] }), [h.itemPath(2)]: h.itemText(2, { modules: ['MOD-pages'] }) }"
        out = run(f"const at = (s, items) => h.scheduled({{ sprints: {{ {json.dumps(SPRINT_01)}: s }}, ...(items ? {{ items }} : {{}}) }});"
                  f"const a = await at({sprint('2026-10-26', 'closer-bot')}); const b = await at({sprint('', 'closer-bot')}, {done});"
                  f"const c = await at({sprint('', 'closer-bot')}, {one}); const d = await at({sprint('2026-11-30', 'closer-bot')});"
                  f"const e = await at({sprint('2026-10-26', 'alice')});"
                  "return [a, b, c, d, e].map((x) => ({ outcome: x.status.outcome, summary: x.status.summary, records: x.records }));")
        for case, because in ((out[0], "time box ended"), (out[1], "every selected item done")):
            self.assertEqual(case["outcome"], "done", case["summary"])
            self.assertIn(because, case["summary"])
            self.assertEqual(len(case["records"]), 1)
            record = case["records"][0]
            for line in ("kind: close-sprint", "participant: closer-bot", "started_by: schedule", '"sprint": "team1/01"'):
                self.assertIn(line, record)
            self.assertNotIn("## Taken", record)
        for case in out[2:]:
            self.assertEqual(case["outcome"], "nothing to do", case["summary"])
            self.assertEqual(case["records"], [])


class AnAgentsReviewNamesWhereItsFeedbackCameFrom(unittest.TestCase):
    # TST-991404 · level: release · module: system
    # guards: AN AGENT'S REVIEW NAMES WHERE ITS FEEDBACK CAME FROM; UC-041
    # given: team1/02, ended, with the issue 7 opened within it and the issue 8 before it, a failed job of ITM-002 and a result record of ITM-001's head; its closer closer-bot
    # input: (a) the close job runs, closer-bot first answering with a review that says nothing of who took part, then with the clean close, whose line says that no stakeholder took part and whose sources name issue #7, the job records and the result records; (b) in the same product anew, closer-bot names carol among those who took part, her feedback recorded in issue #7
    # expect: (a) the closer is sent its sources by name — the issues of the sprint holding issue #7 and not #8, its job records and its result records —, and no part holds a mail; the second request carries the finding under AN AGENT'S REVIEW NAMES WHERE ITS FEEDBACK CAME FROM; the record holds the line "No stakeholder took part" and "Sources of the feedback: issue #7, the job records of sprint team1/02 and the result records of sprint team1/02."; (b) passes at once, and the record holds "Took part: carol." and the source "issue #7 (carol's feedback)"
    def test_the_review_names_its_sources_and_who_took_part(self):
        out = run("const w = await h.closeWorld(); const silent = h.CLOSE(); silent.review.feedback = [{ line: 'The export misses its header', goes: 'noted', item: null }];"
                  "const r = await w.run([silent, h.CLOSE()]);"
                  "const v = await h.closeWorld(); const carol = h.CLOSE();"
                  "carol.review = { feedback: [{ line: 'carol asks for a header in the export', goes: 'noted', item: null }], tookPart: ['carol'], sources: [\"issue #7 (carol's feedback)\"] };"
                  "const s = await v.run([carol]);"
                  "return { parts: r.inputs[0].parts.map((p) => [p.name, p.text]), rules: r.inputs[1].findings.map((f) => f.rule), failed: r.failed, record: w.files[h.RECORD],"
                  " carolRounds: s.inputs.length, carolFailed: s.failed, carolRecord: v.files[h.RECORD] };")
        parts = dict((name, text) for name, text in out["parts"])
        self.assertIn("issue #7 The export misses its header", parts["issues of sprint team1/02"])
        self.assertNotIn("#8", parts["issues of sprint team1/02"])
        self.assertIn("docs/jobs/", parts["job records of sprint team1/02"])
        self.assertIn("runs/", parts["result records of sprint team1/02"])
        self.assertFalse([name for name in parts if "mail" in name.lower()])
        self.assertEqual(out["rules"], ["AN AGENT'S REVIEW NAMES WHERE ITS FEEDBACK CAME FROM"])
        self.assertIsNone(out["failed"])
        self.assertIn("- No stakeholder took part", out["record"])
        self.assertIn("Sources of the feedback: issue #7, the job records of sprint team1/02 and the result records of sprint team1/02.", out["record"])
        self.assertEqual(out["carolRounds"], 1)
        self.assertIsNone(out["carolFailed"])
        self.assertIn("Took part: carol.", out["carolRecord"])
        self.assertIn("Sources of the feedback: issue #7 (carol's feedback).", out["carolRecord"])


class AnAgentsRetrospectiveChangesNoProcessByItself(unittest.TestCase):
    # TST-991406 · level: release · module: system
    # guards: AN AGENT'S RETROSPECTIVE CHANGES NO PROCESS BY ITSELF; UC-041
    # given: team1/02, ended, its closer closer-bot; the product's docs/process.md (the model and the Definition of Done), docs/process-models/, docs/participants.md, docs/role-assignments/ and SPEC.md, whose requirements all stand in the section "## 1. Rules", among them THE PROCESS MODEL IS DECLARED PER PRODUCT, A PRODUCT DECLARES ITS DEFINITION OF DONE and AN AGENT'S RETROSPECTIVE CHANGES NO PROCESS BY ITSELF; docs/spec-freigaben/ holds no queue
    # input: (a) closer-bot's retrospective recommends a change to the process model "Add a review phase", one to the Definition of Done "A release test for every item" and one to a participant's instructions "closer-bot reads the issues first"; the close job runs; (b) counter-proof — closer-bot answers with a draft that also writes docs/process.md, under the key files, and then without it
    # expect: (a) the sprint's record holds the three changes, each with where it goes; the first commit holds the record alone; every file but the record and those under docs/spec-freigaben/ is byte-identical — docs/process.md, the model file, docs/participants.md, both role assignments and SPEC.md among them —; docs/spec-freigaben/rules/ holds a queue of the section "## 1. Rules", every entry of it open (no approval record, no decision), whose proposals each begin with the section as SPEC.md holds it and together hold the three texts after it; (b) the second request carries a finding under AN AGENT'S RETROSPECTIVE CHANGES NO PROCESS BY ITSELF naming files, and the commit holds the sprint's record alone, docs/process.md byte-identical
    def test_after_an_agents_retrospective_every_file_of_the_process_is_byte_identical(self):
        out = run("const w = await h.closeWorld(); const before = { ...w.files };"
                  "const changes = [['Add a review phase', 'process model'], ['A release test for every item', 'Definition of Done'], [\"closer-bot reads the issues first\", \"a participant's instructions\"]];"
                  "const close = { ...h.CLOSE(), retrospective: changes.map(([text, goes]) => ({ text, kind: 'change', goes })) };"
                  "const a = await w.run([close]);"
                  "const changed = Object.keys({ ...before, ...w.files }).filter((p) => before[p] !== w.files[p]);"
                  "const { createHash } = await import('node:crypto');"
                  "const blob = (t) => createHash('sha1').update(`blob ${Buffer.byteLength(t)}\\0`).update(t).digest('hex');"
                  "const snapshot = { ref: 'main', commit: 'f'.repeat(40), paths: Object.keys(w.files), blob: (p) => (p in w.files ? blob(w.files[p]) : null), read: async (p) => w.files[p] ?? null };"
                  "const queues = await specChanges.queues(snapshot);"
                  "const entries = queues.flatMap((q) => q.entries.map((e) => ({ folder: q.folder, anchor: e.anchor, state: e.state, proposal: w.files[e.proposal.path] ?? null })));"
                  "const section = before['SPEC.md'].slice(before['SPEC.md'].indexOf('## 1. Rules'));"
                  "const v = await h.closeWorld(); const process = v.files['docs/process.md'];"
                  "const writes = { ...h.CLOSE(), files: [{ path: 'docs/process.md', text: 'model: none' }] };"
                  "const s = await v.run([writes, h.CLOSE()]);"
                  "return { failed: a.failed, record: w.files[h.RECORD], first: w.commits[0].files.map((f) => f.path), later: w.commits.slice(1).flatMap((c) => c.files.map((f) => f.path)), changed,"
                  " kept: Object.keys(before).filter((p) => p !== h.RECORD && w.files[p] !== before[p]), entries, section, texts: changes.map(([t]) => t),"
                  " findings: s.inputs[1].findings.map((f) => [f.rule, f.what]), second: v.commits.map((c) => c.files.map((f) => f.path)), same: v.files['docs/process.md'] === process };")
        self.assertIsNone(out["failed"])
        for text, goes in (("Add a review phase", "process model"), ("A release test for every item", "Definition of Done"),
                           ("closer-bot reads the issues first", "a participant's instructions")):
            self.assertIn(f"- change, to {goes}: {text}\n", out["record"])
        self.assertEqual(out["first"], [RECORD])
        self.assertEqual(out["kept"], [])
        self.assertTrue(out["later"] and all(path.startswith("docs/spec-freigaben/") for path in out["later"]), out["later"])
        self.assertTrue(all(path == RECORD or path.startswith("docs/spec-freigaben/") for path in out["changed"]), out["changed"])
        self.assertTrue(out["entries"], "an entry of a SPEC change queue is written")
        for entry in out["entries"]:
            self.assertEqual(entry["folder"], "docs/spec-freigaben/rules")
            self.assertEqual(entry["anchor"], "## 1. Rules")
            self.assertEqual(entry["state"], "open")
            self.assertTrue(entry["proposal"].startswith(out["section"]), entry["proposal"])
        added = "\n".join(entry["proposal"][len(out["section"]):] for entry in out["entries"])
        for text in out["texts"]:
            self.assertIn(text, added)
        self.assertTrue(any(rule == "AN AGENT'S RETROSPECTIVE CHANGES NO PROCESS BY ITSELF" and "files" in what for rule, what in out["findings"]), out["findings"])
        self.assertEqual(out["second"], [[RECORD]])
        self.assertTrue(out["same"])


if __name__ == "__main__":
    unittest.main()
