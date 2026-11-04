# Module: MOD-spec-changes
# Guards: AN ARTIFACT RECORDS THE VERSION THAT PRODUCED IT
# Level: system
"""SPEC section 8 - the check named tests/test_artifact_provenance.py.

The commit that writes a generated artifact names the Agent M version, the participant and the model that produced it, and the
artifact's own text names none of them. The writers are asked through node (tests/jsrun.py) as a fixture CI agent's job calls
them: `open-files` (MOD-artifact-edits) for a changed use case and `queue-entries` (MOD-spec-changes) for a changed requirement,
over the fixture product and the fixture host of tests/test_prompted_change_context.py, whose helpers this file uses to run the
two jobs. The job runs as Agent M version 2026.10.0 at commit abc123def456, job JOB-20261016-0900-a1b2, with the participant
ci-drafter and its model ci-model-7; those values, and the commit message they must stand in, are stated below in this file.

The reading taken where the SPEC leaves one open: "the artifact" is the file the writer writes into the repository as the thing
asked for - the use case file, and the entry of a queue (the section as proposed). A queue's index.md and the rationale beside
an entry are records about the entry, not the entry; they are not judged here.

Counter-proof: a provenance line planted in the artifact's text is found by the same detector, in the text of a fixture and in
the text a writer wrote.
"""
import re
import unittest

from test_prompted_change_context import UC2_CHANGED, UC2_PATH, USE_CASE_DRAFT, ci_requirement_change, ci_use_case_change

VERSION = "2026.10.0"
COMMIT = "abc123def456"
JOB = "JOB-20261016-0900-a1b2"
PARTICIPANT = "ci-drafter"
MODEL = "ci-model-7"


def names_provenance(body):
    """What of the version, the commit, the job, the participant and the model a text names, and a trailer line of Agent M."""
    found = [value for value in (VERSION, COMMIT, JOB, PARTICIPANT, MODEL) if value in body]
    if re.search(r"^Agent-M-", body, re.MULTILINE):
        found.append("an Agent-M- line")
    return found


def trailer(kind):
    """The six lines that end the commit message of a job of this kind, as the SPEC and the writers' module files state them."""
    return [f"Agent-M-Version: {VERSION}, commit {COMMIT}", f"Agent-M-Job: {JOB}", f"Agent-M-Kind: {kind}",
            f"Agent-M-Participant: {PARTICIPANT}", f"Agent-M-Model: {MODEL}", "Agent-M-Rounds: 1"]


def entries_of(commit):
    """The queue entries of a commit: the proposals, not the index, the rationales or the decisions."""
    return [f for f in commit["files"] if re.search(r"/\d\d-[^/]+\.md$", f["path"]) and not f["path"].endswith(".begruendung.md")]


class ArtifactProvenance(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.use_case = ci_use_case_change()
        cls.requirement = ci_requirement_change()
        for run in (cls.use_case, cls.requirement):
            assert run["error"] is None and run["stoppedBecause"] == "passed", run["remaining"]
            assert len(run["commits"]) == 1

    # TST-519011 · level: system · module: system
    # guards: AN ARTIFACT RECORDS THE VERSION THAT PRODUCED IT
    # given: the fixture CI agent ci-drafter (model ci-model-7) at Agent M 2026.10.0, commit abc123def456, job JOB-20261016-0900-a1b2
    # input: its change-use-case job run unattended; the message of the commit the writer open-files made
    # expect: the message ends with the six lines Agent-M-Version: 2026.10.0, commit abc123def456 / Agent-M-Job: JOB-20261016-0900-a1b2 / Agent-M-Kind: change-use-case / Agent-M-Participant: ci-drafter / Agent-M-Model: ci-model-7 / Agent-M-Rounds: 1; the detector names the version, the commit, the job, the participant, the model and a trailer line in that message
    def test_the_commit_of_a_written_use_case_names_the_version_the_participant_and_the_model(self):
        message = self.use_case["commits"][0]["message"]
        self.assertEqual(message.split("\n")[-6:], trailer("change-use-case"))
        self.assertEqual(names_provenance(message), [VERSION, COMMIT, JOB, PARTICIPANT, MODEL, "an Agent-M- line"])

    # TST-519012 · level: system · module: system
    # guards: AN ARTIFACT RECORDS THE VERSION THAT PRODUCED IT
    # given: the same fixture CI agent
    # input: its change-requirements job run unattended; the message of the commit the writer queue-entries made
    # expect: the message ends with the six lines Agent-M-Version: 2026.10.0, commit abc123def456 / Agent-M-Job: JOB-20261016-0900-a1b2 / Agent-M-Kind: change-requirements / Agent-M-Participant: ci-drafter / Agent-M-Model: ci-model-7 / Agent-M-Rounds: 1
    def test_the_commit_of_a_written_queue_entry_names_the_version_the_participant_and_the_model(self):
        message = self.requirement["commits"][0]["message"]
        self.assertEqual(message.split("\n")[-6:], trailer("change-requirements"))
        self.assertEqual(names_provenance(message), [VERSION, COMMIT, JOB, PARTICIPANT, MODEL, "an Agent-M- line"])

    # TST-519013 · level: system · module: system
    # guards: AN ARTIFACT RECORDS THE VERSION THAT PRODUCED IT
    # given: the commit the writer open-files made for the CI agent's use case UC-002
    # input: the detector over the text of every file of that commit
    # expect: the commit writes docs/use-cases/UC-002-extend-a-loan.md alone, and the detector finds nothing in its text, which is the text the driver returned, byte for byte
    def test_the_text_of_a_written_use_case_names_none_of_them(self):
        files = self.use_case["commits"][0]["files"]
        self.assertEqual([f["path"] for f in files], [UC2_PATH])
        self.assertEqual(names_provenance(files[0]["text"]), [])
        self.assertEqual(files[0]["text"], UC2_CHANGED)

    # TST-519014 · level: system · module: system
    # guards: AN ARTIFACT RECORDS THE VERSION THAT PRODUCED IT
    # given: the commit the writer queue-entries made for the CI agent's changed requirement
    # input: the detector over the text of every entry of that commit (the proposals, one per section the candidates touch)
    # expect: the commit holds one entry, the section ## Lending as proposed, and the detector finds nothing in its text
    def test_the_text_of_a_written_queue_entry_names_none_of_them(self):
        entries = entries_of(self.requirement["commits"][0])
        self.assertEqual(len(entries), 1)
        self.assertTrue(entries[0]["text"].startswith("## Lending\n"))
        self.assertEqual(names_provenance(entries[0]["text"]), [])

    # TST-519015 · level: system · module: system
    # guards: AN ARTIFACT RECORDS THE VERSION THAT PRODUCED IT
    # given: the unchanged text of UC-002 as the driver returns it, and three plants: an Agent-M-Participant line, a prose line naming the version, and the model in the first line
    # input: the detector over each text
    # expect: the unchanged text yields nothing; the plants yield the participant and a trailer line / the version / the model
    def test_counter_proof_a_provenance_line_planted_in_a_text_is_found(self):
        self.assertEqual(names_provenance(UC2_CHANGED), [])
        self.assertEqual(names_provenance(UC2_CHANGED + f"Agent-M-Participant: {PARTICIPANT}\n"), [PARTICIPANT, "an Agent-M- line"])
        self.assertEqual(names_provenance(UC2_CHANGED + f"Produced by Agent M {VERSION}.\n"), [VERSION])
        self.assertEqual(names_provenance(f"{MODEL}\n" + UC2_CHANGED), [MODEL])

    # TST-519016 · level: system · module: system
    # guards: AN ARTIFACT RECORDS THE VERSION THAT PRODUCED IT
    # given: the fixture CI agent whose stand-in driver returns UC-002 with the line "Agent-M-Model: ci-model-7" planted in it
    # input: its change-use-case job run unattended, and the detector over the text the writer wrote
    # expect: the written file is the planted text, and the detector finds the model and an Agent-M- line in it
    def test_counter_proof_a_line_planted_in_the_drafted_text_is_found_in_the_written_artifact(self):
        planted = UC2_CHANGED + f"Agent-M-Model: {MODEL}\n"
        draft = {"files": [{**USE_CASE_DRAFT["files"][0], "text": planted}]}
        run = ci_use_case_change(draft=draft)
        self.assertIsNone(run["error"], run["remaining"])
        written = run["commits"][0]["files"][0]["text"]
        self.assertEqual(written, planted)
        self.assertEqual(names_provenance(written), [MODEL, "an Agent-M- line"])


if __name__ == "__main__":
    unittest.main()
