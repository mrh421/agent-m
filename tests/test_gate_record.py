# Module: MOD-product-process
# Guards: THE GATE IS RECORDED; UC-034
# Level: release
"""SPEC section 9 - the check named tests/test_gate_record.py, for THE GATE IS RECORDED: every passed gate records who decided, when, and on which text.

The cases live in tests/test_gate_record.md. This file loads them. For each case node builds the workflow of a product that declares the model Scrum - with the gate that a requirement adds and a check decides,
where the case is one of a check -, lets the decider of the case pass the gate through MOD-product-process' recordGateDecision over a fake host that keeps the commit it receives, reads the record as the dashboard
reads it (readDocument with the gate record's schema), and asks gateStates for the gate once with the text the record names and once with that text changed. The check states what the record holds - the decider,
the role, the decision, the checked text as <path>@<blob>, the date - and what the commit holds.

Written for ITM-805 by developer-sonnet-j, who built none of the code it checks (src/product-process was built by developer-opus-e and without a trailer; RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER).
Readings the texts leave open, which the cases state:
  - "on which text" is read as the line `on` of the record: the artifact the gate checks as `<path>@<blob>`, the blob the git blob SHA-1 of the text the decider saw, which the case computes itself.
  - "when" is read as the record's `date`, the moment of the decision to the minute, in UTC.
"""
import json
import re
import unittest
from pathlib import Path

from jsrun import js

DATA = Path(__file__).with_suffix(".md")
ROOT = Path(__file__).resolve().parents[1]

# The adapter. `input` is the case; the value holds the record's text and fields, the commit's message and, for gateStates, the gate's state with the text the record names, with the text changed and without a record.
WORLD = r"""
const text = (...lines) => `${lines.join("\n")}\n`;
const ADDED = "A GREEN BUILD GATES THE MERGE", ROLE_GATE = "Development → Sprint Review";
const added = input.gate === ADDED;
const spec = added ? text("# Spec", "", `**${ADDED}** *(Product Owner)*`, "", "A merge needs a green build.", "*Check:* no automatic check; at review.") : "# Spec\n";
const declaration = text("---", "model: scrum", "model_file: src/model-catalogue/models/scrum.md", `model_version: ${"a".repeat(40)}`, "---", "# Process", "", "## Practices", "", "- none", "", "## Branches", "",
  "| Phase or time box | Branch |", "|---|---|", "| Sprint | sprint/<team>/<nn> |", "",
  ...(added ? ["## Gates added by requirements", "", "| Requirement | Between | Artifacts | Condition | Decider |", "|---|---|---|---|---|",
    `| ${ADDED} | ${ROLE_GATE} | the pull request | the build is green | check: build |`, ""] : []),
  "## Definition of Done", "", "The job rules hold; no condition is added.");
const empty = { repository: { server: "github", origin: "https://github.com", path: "alice/agent-m", web: "https://github.com/alice/agent-m" }, ref: "main", commit: "a".repeat(40), paths: [], read: async () => null, blob: () => null };
const workflow = await productProcess.productWorkflow(documents.readDocument(productProcess.declarationSchema, "docs/process.md", declaration), async () => empty, spec);
const assignment = input.assignment === null ? null : documents.readDocument(productProcess.roleAssignmentSchema, "docs/role-assignments/team1.md",
  text("# team1", "", "## Roles", "", "| Role | Participants |", "|---|---|", `| Product Owner | ${input.assignment} |`, "| Scrum Master | dev-a |", "| Developers | dev-a |"));
const commits = [];
const host = { async repositoryInfo() { return { defaultBranch: "main" }; }, async commitFiles(change) { commits.push(change); return { commit: "c".repeat(40) }; } };
const blob = await textTools.blobSha(input.checked.text);
const head = "b".repeat(40);
await productProcess.recordGateDecision(host, { gate: input.gate, job: input.job, decider: input.decider, role: input.role, decision: "passed", reason: input.reason, on: [`${input.checked.path}@${blob}`] },
  { workflow, assignment, workBy: ["dev-a"], head, now: new Date(Date.UTC(2026, 9, 8, 8, 50, 30)), trailers: input.trailers });
const change = commits[0], file = change.files[0];
const record = documents.readDocument(productProcess.gateSchema, file.path, file.text);
const stateOf = (records, texts) => productProcess.gateStates(workflow, records, texts).find((each) => each.gate === input.gate);
const missing = documents.readDocument(productProcess.gateSchema, file.path, file.text.replace(/^on:\n(?:  - .*\n)+/m, ""));
return {
  commits: commits.length, files: change.files.length, path: file.path, branch: change.branch, expectedHead: change.expectedHead, subject: change.message.split("\n")[0], message: change.message, text: file.text,
  fields: record.fields, findings: documents.documentFindings(productProcess.gateSchema, record).map((f) => [f.kind, f.what]),
  same: stateOf([record], { [input.checked.path]: blob }), changed: stateOf([record], { [input.checked.path]: "f".repeat(40) }), none: stateOf([], { [input.checked.path]: blob }),
  withoutOn: documents.documentFindings(productProcess.gateSchema, missing).map((f) => [f.kind, f.what]),
};
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


def of_group(group: str) -> dict:
    chosen = [s for s in sections() if s["case"]["group"] == group]
    if len(chosen) != 1:
        raise AssertionError(f"expected one case of the group {group}, found {len(chosen)}")
    return chosen[0]


def run(case: dict) -> dict:
    return js(f"const input = {json.dumps(case)}; const ROOT = {json.dumps(str(ROOT))};\n{WORLD}")


def record_matches(test: unittest.TestCase, loaded: dict) -> dict:
    """The record of the case holds what the case expects; -> the result."""
    got, want = run(loaded["case"]), loaded["case"]["expected"]
    test.assertEqual((got["commits"], got["files"]), (1, 1), "one commit with one file")
    test.assertRegex(got["path"], r"^docs/gates/20261008-0850-[a-z0-9-]+-[0-9a-f]{4}\.md$")
    test.assertEqual(got["branch"], "main")
    test.assertEqual(got["expectedHead"], "b" * 40, "written on the head that was read")
    fields = got["fields"]
    test.assertEqual({k: fields[k] for k in ("gate", "decider", "role", "decision", "on", "date")},
                     {"gate": loaded["case"]["gate"], "decider": want["decider"], "role": want["role"], "decision": want["decision"], "on": want["on"], "date": want["date"]})
    test.assertEqual(fields["job"] or None, loaded["case"]["job"])
    test.assertEqual(got["subject"], want["subject"])
    test.assertEqual(any(line.startswith("Agent-M-") for line in got["message"].split("\n")[1:]), want["trailers"])
    if want["reason"]:
        test.assertIn(f"## Reason\n\n{want['reason']}", got["text"])
    else:
        test.assertNotIn("## Reason", got["text"])
    test.assertEqual(got["findings"], [], "the record meets the gate record's schema")
    return got


class TestGateRecord(unittest.TestCase):
    # TST-805501 · level: release · module: MOD-product-process
    # guards: THE GATE IS RECORDED
    # given: the case person: the Product Owner alice, a holder of the role in the job's role assignment, passes the gate Development -> Sprint Review of the model Scrum for the job JOB-20261008-0800-a1b2 at 08:50 UTC after reading docs/backlog/ITM-001-the-work.md
    # input: recordGateDecision over a host that keeps the commit it receives, then the record read with the gate record's schema
    # expect: one commit on the head that was read holds one record naming the gate, the job, the decider alice, the role Product Owner, the decision passed, the checked text as docs/backlog/ITM-001-the-work.md@4d2ee9550ce934113275f1daf38f333510f18197 and the date 2026-10-08 08:50 UTC; the commit's subject is "gates: Development -> Sprint Review passed by alice" with no trailer; the record meets its schema
    def test_a_passed_gate_records_who_decided_when_and_on_which_text(self):
        record_matches(self, of_group("person"))

    # TST-805502 · level: release · module: MOD-product-process
    # guards: THE GATE IS RECORDED
    # given: the case agent: the agent po-bot, which holds the Product Owner in the job's role assignment, passes the same gate with the reasoning "Every selected item meets its acceptance criteria." and the job's provenance lines as trailers
    # input: recordGateDecision, then the record read with the gate record's schema
    # expect: the record names the decider po-bot, the role, the decision, the checked text and the date as for a person, holds the reasoning under ## Reason, and its commit's message carries the trailers after an empty line
    def test_an_agents_decision_is_recorded_as_a_persons_is_with_its_reasoning_and_provenance(self):
        got = record_matches(self, of_group("agent"))
        self.assertIn("Agent-M-Participant: po-bot", got["message"])

    # TST-805503 · level: release · module: MOD-product-process
    # guards: THE GATE IS RECORDED
    # given: the case check: the gate that the requirement A GREEN BUILD GATES THE MERGE adds, decided by the check build, which passes it for the commit
    # input: recordGateDecision as the entry of a completed check calls it, then the record read
    # expect: the record names the decider as `check: build`, the role check, the decision passed, the checked text and the date; its job is empty, since the case names none; its commit's subject is "gates: A GREEN BUILD GATES THE MERGE passed by build"
    def test_a_passed_gate_decided_by_a_check_records_the_check_and_the_text(self):
        record_matches(self, of_group("check"))

    # TST-805504 · level: release · module: MOD-product-process
    # guards: THE GATE IS RECORDED
    # given: the three cases; the text of the checked artifact is changed after the decision; a copy of each record without its line `on`; the gate with no record at all
    # input: gateStates for the gate with the text the record names, with the text changed, and with no record; the gate record's findings for the copy without `on`
    # expect: with the text the record names the gate is passed; with the text changed it is passed on an earlier text and the difference names the artifact; with no record it is pending and never passed; a record without the text it was decided on is a finding of the schema, so a passed gate always names its text
    def test_a_passed_gate_is_passed_on_the_text_its_record_names_and_not_on_another(self):
        for loaded in sections():
            with self.subTest(case=loaded["name"]):
                got = run(loaded["case"])
                path = loaded["case"]["checked"]["path"]
                self.assertEqual((got["same"]["state"], got["same"]["difference"]), ("passed", None))
                self.assertEqual(got["changed"]["state"], "passed on an earlier text")
                self.assertIn(path, got["changed"]["difference"])
                self.assertEqual((got["none"]["state"], got["none"]["record"]), ("pending", None))
                self.assertTrue(any(kind == "error" for kind, _ in got["withoutOn"]), got["withoutOn"])


if __name__ == "__main__":
    unittest.main()
