# Module: MOD-spec-changes
# Guards: A PROMPTED USE-CASE CHANGE SEES ITS NEIGHBOURS; NO USE CASE IS LEFT OUT OF A PROMPT SILENTLY; A CI AGENT'S DRAFT ENTERS AS OPEN
# Level: system
"""SPEC sections 11 and 12 - the check named tests/test_prompted_change_context.py.

What it checks, with MOD-job-runner and the writers `open-files` (MOD-artifact-edits) and `queue-entries` (MOD-spec-changes)
asked through node (tests/jsrun.py), on a fixture product kept in memory behind a fixture repository host, with a fixture CI
agent and a stand-in driver that returns a fixed answer. Nothing reaches the network.

- A PROMPTED USE-CASE CHANGE SEES ITS NEIGHBOURS: a job of `change-use-case` is prepared; its parts hold the use case, every
  requirement it realises and every other use case of the product.
- NO USE CASE IS LEFT OUT OF A PROMPT SILENTLY: the same job for a drafter whose context cannot hold them is refused before
  anything is sent - the driver is never called - and the refusal names what does not fit.
- A CI AGENT'S DRAFT ENTERS AS OPEN: the fixture CI agent's prompted `change-use-case` and `change-requirements` yield an open
  use case and a queue entry, and SPEC.md is byte-identical. Counter-proof: neither is shown as accepted - no approval record
  names it, and the detector that says so does find a record where one is planted.

Every expected value stands in this file. The fixture product, the Python side of it, is also the source of the texts the
expectations compare with; no document of the repository is read when a test runs.

The reading taken where the SPEC leaves one open: "every requirement it realises" are those the use case names under `realises`
that the product's SPEC holds; "does not fit" is MOD-job-runner's `notFitting` (the participant, the size of what it would
receive, its context) with the names of the parts that destination would receive.
"""
import hashlib
import json
import re
import unittest

from jsrun import js

RULE = "A LOAN HAS A DUE DATE"
OTHER = "A BOOK IS SHELVED"
RULE_TEXT = "Every loan states the date by which the book is returned."
CHANGED_RULE_TEXT = "Every loan visibly displays its due date."
INSTRUCTION = "Make the due date visible."


def text(*lines):
    return "\n".join(lines) + "\n"


def blob(body):
    data = body.encode("utf-8")
    return hashlib.sha1(b"blob %d\0" % len(data) + data).hexdigest()


SPEC = text("# Thesis tool - Specification", "", "## Lending", "",
            f"**{RULE}** *(Product Owner)*", RULE_TEXT, "*Check:* `tests/loan.test.mjs`", "",
            f"**{OTHER}** *(Product Owner)*", "Every book stands on a shelf.", "*Check:* `tests/shelf.test.mjs`")


def use_case(uc, title, goal):
    return text("---", f"id: {uc}", f"title: {title}", "area: lending", "actors:", "  - Member", "realises:",
                f"  - {RULE}", "---", f"# {uc} {title}", "", f"**Goal.** {goal}", "",
                "## Actors", "", "The member.", "", "## Precondition", "", "The member is signed in.", "",
                "## Main flow", "", "1. The member asks.", "2. The system answers.", "", "## Alternative flows", "",
                "2a. The system refuses.", "", "## Postcondition", "", "The answer is shown.")


UC1 = use_case("UC-001", "Check out a book", "The member borrows a book.")
UC2 = use_case("UC-002", "Extend a loan", "The member extends a loan once.")
UC3 = use_case("UC-003", "Return a book", "The member returns a book.")
UC4 = use_case("UC-004", "Reserve a book", "The member reserves a book that is out.")
UC1_PATH = "docs/use-cases/UC-001-check-out-a-book.md"
UC2_PATH = "docs/use-cases/UC-002-extend-a-loan.md"
UC3_PATH = "docs/use-cases/UC-003-return-a-book.md"
UC4_PATH = "docs/use-cases/UC-004-reserve-a-book.md"
UC1_RECORD = f"docs/approvals/UC-001-{blob(UC1)[:12]}.md"

# The product: a SPEC of two requirements, four use cases, and an approval record that accepts UC-001 only.
PRODUCT = {
    "README.md": "# Thesis tool\n",
    "SPEC.md": SPEC,
    UC1_PATH: UC1, UC2_PATH: UC2, UC3_PATH: UC3, UC4_PATH: UC4,
    UC1_RECORD: text("kind: use-case", f"file: {UC1_PATH}", f"blob: {blob(UC1)}"),
}

# What the stand-in driver answers: UC-002 changed as the instruction says, and one changed requirement.
UC2_CHANGED = UC2.replace("extends a loan once.", "extends a loan once, and sees the due date.")
USE_CASE_DRAFT = {"files": [{"path": UC2_PATH, "text": UC2_CHANGED, "class": "change", "of": "UC-002"}]}
REQUIREMENT_DRAFT = {"candidates": [{
    "name": RULE, "rule": CHANGED_RULE_TEXT, "check": "`tests/loan.test.mjs`", "constrains": "product",
    "passage": "make visible", "class": "change", "of": RULE}]}

# The Agent M side, in node: the fixture host, the fixture participants, the registered strategies, one run.
WORLD = r"""
const { createHash } = process.getBuiltinModule("node:crypto");
const blobOf = (body) => createHash("sha1").update(`blob ${Buffer.byteLength(body)}\0${body}`).digest("hex");
const ON = { server: "github", origin: "https://github.com", path: "alice/thesis-tool", web: "https://github.com/alice/thesis-tool" };
const CI = { name: "ci-drafter", type: "CI agent", model: "ci-model-7", context: 200000, price: null,
  capabilities: ["draft text"], place: "GitHub Actions in the USA", route: "ci hosted secret CI_KEY" };
const SMALL = { ...CI, name: "small-drafter", model: "small-model", context: 10 };

jobRunner.registerStrategies("MOD-approvals", approvals.approvalStrategies);
jobRunner.registerStrategies("MOD-artifact-edits", artifactEdits.editStrategies);
jobRunner.registerStrategies("MOD-spec-changes", specChanges.specStrategies);
jobRunner.registerStrategies("MOD-issue-handling", issueHandling.issueStrategies);
jobRunner.registerStrategies("tests/test_prompted_change_context.py", { recipes: {
  "chapters-for-requirements": async () => [{ name: "chapter 8 stand-in", text: "requirements chapter", size: 0, sources: [], required: true }] } });

// One repository in memory with a history, default branch `trunk`; the functions the writers call, every write recorded.
function fixtureHost(files) {
  const commits = new Map(), order = [], written = [];
  let head = null, made = 0;
  const commitOf = (tree, changes) => {
    const sha = createHash("sha1").update(`commit ${++made}`).digest("hex");
    commits.set(sha, { tree, changes });
    order.unshift(sha);
    head = sha;
    return sha;
  };
  commitOf(new Map(Object.entries(files)), Object.keys(files).map((path) => ({ path, change: "added" })));
  const snapshotAt = (sha) => {
    const { tree } = commits.get(sha);
    return { repository: ON, ref: "trunk", commit: sha, paths: [...tree.keys()].sort(),
      read: async (path) => (tree.has(path) ? tree.get(path) : null), blob: (path) => (tree.has(path) ? blobOf(tree.get(path)) : null) };
  };
  return {
    snapshot: () => snapshotAt(head), written,
    host: {
      async repositoryInfo() { return { defaultBranch: "trunk", visibility: "public", canWrite: true, archived: false, description: "" }; },
      async readSnapshot(ref) {
        if (ref !== "trunk") throw Object.assign(new Error(`${ref} was not found`), { name: "NotFound" });
        return snapshotAt(head);
      },
      async readHistory(path, options = {}) {
        return order.map((sha) => ({ commit: sha, parents: [], author: { account: null, name: "x" }, date: "2026-10-16T09:00:00Z",
          message: "", changes: commits.get(sha).changes })).slice(0, options.limit ?? undefined);
      },
      async commitFiles(change) {
        if (change.branch !== "trunk" || change.expectedHead !== head) throw Object.assign(new Error("the branch moved"), { name: "Moved", head });
        written.push({ message: change.message, files: change.files.map(({ path, text }) => ({ path, text })) });
        const tree = new Map([...commits.get(head).tree, ...change.files.map((file) => [file.path, file.text])]);
        const sha = commitOf(tree, change.files.map((file) => ({ path: file.path, change: commits.get(head).tree.has(file.path) ? "modified" : "added" })));
        return { commit: sha, url: `${ON.web}/commit/${sha}` };
      },
    },
  };
}

async function contextOf(fixture, kindName, params) {
  const snapshot = fixture.snapshot();
  return { kind: await jobCatalogue.kindOf(kindName), params,
    product: { address: ON.web, snapshot, host: fixture.host }, instance: { snapshot, host: null, checkout: null },
    connect: async () => fixture.host, participants: [CI, SMALL], places: { sources: {}, mailbox: null }, gates: [], person: "alice",
    now: new Date("2026-10-16T09:00:00Z"), agentM: { version: "2026.10.0", commit: "abc123def456" },
    jobId: "JOB-20261016-0900-a1b2" };
}

// A stand-in driver: answers what it is given, and counts what it is sent.
function standIn(participant, draft) {
  const inputs = [];
  return { participant, inputs, async send(input) { inputs.push(input); return { text: JSON.stringify({ draft, answers: [] }), usage: null }; } };
}

const partOf = (part) => ({ recipe: part.recipe, name: part.name, text: part.text, size: part.size });

// The job prepared for a drafter; with `run`, also run unattended, as a CI agent's job is.
async function job(kindName, params, drafter, files, draft, run) {
  const fixture = fixtureHost(files);
  const before = fixture.snapshot();
  const context = await contextOf(fixture, kindName, params);
  const prepared = await jobRunner.prepareJob(kindName, context, { drafter, reviewers: [] });
  const driver = standIn(drafter, draft);
  let error = null, result = null;
  if (run) {
    try {
      result = await jobRunner.runJob(prepared, { drafter: driver, reviewers: [] }, { attended: false, context });
    } catch (caught) {
      error = { name: caught.name, notFitting: (caught.notFitting ?? []).map(({ participant, size, context: limit }) =>
        ({ participant: participant.name, size, context: limit })) };
    }
  }
  const after = fixture.snapshot();
  const changed = {};
  for (const path of after.paths) if ((await after.read(path)) !== (await before.read(path))) changed[path] = await after.read(path);
  return {
    parts: prepared.parts.map(partOf), fits: prepared.fits, blocking: prepared.blocking.map((found) => found.what),
    notFitting: prepared.notFitting.map(({ participant, size, context: limit }) => ({ participant: participant.name, size, context: limit })),
    destinations: prepared.destinations.map((each) => ({ participant: each.participant.name, parts: each.parts, size: each.size })),
    error, driverCalls: driver.inputs.length, stoppedBecause: result?.stoppedBecause ?? null,
    remaining: (result?.remaining ?? []).map((found) => `${found.rule}: ${found.what}`),
    commits: fixture.written, changed, removed: before.paths.filter((path) => !after.paths.includes(path)),
    status: Object.fromEntries([...approvals.statuses(after)].map(([path, each]) => [path, each.status])),
    queues: (await specChanges.queues(after)).map((queue) => ({ folder: queue.folder,
      entries: queue.entries.map((entry) => ({ state: entry.state, proposal: entry.proposal.path })) })),
  };
}
"""


def ask(call, files=None, **given):
    """Run `job(...)` in node over a fixture product; `call` is its arguments after the files, as JavaScript."""
    args = json.dumps({"files": PRODUCT if files is None else files, **given})
    return js(f"const given = {args};\n{WORLD}\nreturn await job({call});")


def prepare(drafter, files=None, run=False, draft=USE_CASE_DRAFT):
    return ask(f'"change-use-case", {{ useCase: "UC-002", instruction: given.instruction }}, {drafter}, given.files, given.draft, {str(run).lower()}',
               files, instruction=INSTRUCTION, draft=draft)


def ci_use_case_change(files=None, draft=USE_CASE_DRAFT):
    return prepare("CI", files, run=True, draft=draft)


def ci_requirement_change(files=None):
    return ask('"change-requirements", { requirements: [given.rule], source: "SRC-author", instruction: given.instruction, '
               'page: "#requirement" }, CI, given.files, given.draft, true',
               files, rule=RULE, instruction=INSTRUCTION, draft=REQUIREMENT_DRAFT)


def named_by_an_approval_record(paths, uc=None, entry=None):
    """Whether a record under docs/approvals/ names a use case (by its identifier) or a queue entry (by its queue and number)."""
    for path in paths:
        if not path.startswith("docs/approvals/"):
            continue
        name = path.rsplit("/", 1)[1]
        if uc is not None and name.startswith(f"{uc}-"):
            return True
        if entry is not None and re.match(rf"spec-{re.escape(entry[0])}-{entry[1]}-[0-9a-f]{{12}}\.md$", name):
            return True
    return False


def with_planted_record(files, path, uc):
    """The same product with an approval record that accepts the text at `path` - the planted fault of the counter-proofs."""
    body = files[path]
    return {**files, f"docs/approvals/{uc}-{blob(body)[:12]}.md": text("kind: use-case", f"file: {path}", f"blob: {blob(body)}")}


class PromptedChangeContext(unittest.TestCase):
    # TST-519001 · level: system · module: system
    # guards: A CI AGENT'S DRAFT ENTERS AS OPEN
    # given: the fixture product, whose approval record accepts UC-001 and no other use case
    # input: the approval-record detector of this file over the product's paths, and MOD-approvals' statuses over its snapshot
    # expect: the detector names UC-001 and not UC-002; statuses gives UC-001 accepted and UC-002, UC-003, UC-004 open
    def test_known_positive_the_detector_finds_an_approval_record_where_one_stands(self):
        paths = list(PRODUCT)
        self.assertTrue(named_by_an_approval_record(paths, uc="UC-001"))
        self.assertFalse(named_by_an_approval_record(paths, uc="UC-002"))
        status = prepare("CI")["status"]
        self.assertEqual(status, {UC1_PATH: "accepted", UC2_PATH: "open", UC3_PATH: "open", UC4_PATH: "open"})

    # TST-519002 · level: system · module: system
    # guards: A PROMPTED USE-CASE CHANGE SEES ITS NEIGHBOURS
    # given: the fixture product (UC-001 to UC-004; UC-002 realises A LOAN HAS A DUE DATE) and a drafter whose context holds them
    # input: prepareJob of change-use-case with the parameter useCase UC-002
    # expect: the job fits; the part of its recipe use-case-with-neighbours are, in order, the file UC-002, the requirement A LOAN
    #         HAS A DUE DATE as the SPEC states it, and the files UC-001, UC-003 and UC-004, each as the repository holds it
    def test_a_change_use_case_job_holds_the_use_case_its_requirement_and_every_other_use_case(self):
        prepared = prepare("CI")
        self.assertTrue(prepared["fits"])
        self.assertEqual(prepared["blocking"], [])
        parts = [(p["name"], p["text"]) for p in prepared["parts"] if p["recipe"] == "use-case-with-neighbours"]
        requirement = "\n".join([f"**{RULE}** *(Product Owner)*", RULE_TEXT, "*Check:* `tests/loan.test.mjs`"])
        self.assertEqual(parts, [
            (f"{UC2_PATH} — open", UC2),
            (RULE, requirement),
            (f"{UC1_PATH} — accepted", UC1),
            (f"{UC3_PATH} — open", UC3),
            (f"{UC4_PATH} — open", UC4),
        ])

    # TST-519003 · level: system · module: system
    # guards: A PROMPTED USE-CASE CHANGE SEES ITS NEIGHBOURS
    # given: the fixture product with a fifth use case UC-005 added, and a drafter whose context holds them
    # input: prepareJob of change-use-case with the parameter useCase UC-002, then the same on the product without UC-005
    # expect: the neighbours include UC-005's file when it stands in the product and do not when it does not (the neighbours are
    #         read from the product, not fixed)
    def test_the_neighbours_follow_the_product(self):
        path = "docs/use-cases/UC-005-pay-a-fine.md"
        uc5 = use_case("UC-005", "Pay a fine", "The member pays a fine.")
        with_five = prepare("CI", {**PRODUCT, path: uc5})
        names = [p["name"] for p in with_five["parts"] if p["recipe"] == "use-case-with-neighbours"]
        self.assertIn(f"{path} — open", names)
        names = [p["name"] for p in prepare("CI")["parts"] if p["recipe"] == "use-case-with-neighbours"]
        self.assertNotIn(f"{path} — open", names)

    # TST-519004 · level: system · module: system
    # guards: NO USE CASE IS LEFT OUT OF A PROMPT SILENTLY
    # given: the fixture product and a drafter whose context is 10 tokens; the same job for a drafter of 200000 tokens as the control
    # input: prepareJob and runJob (unattended) of change-use-case for UC-002 with a stand-in driver that counts what it is sent
    # expect: the 10-token job does not fit, runJob throws NotStartable, the driver is called 0 times; the refusal names
    #         small-drafter, its context 10 and a size above 10, and the destination lists the five parts it would have received,
    #         use case, requirement and every other use case; the 200000-token job fits
    def test_a_drafter_too_small_for_the_neighbours_is_refused_before_anything_is_sent(self):
        small = prepare("SMALL", run=True)
        self.assertFalse(small["fits"])
        self.assertEqual(small["driverCalls"], 0, "the driver was sent the job")
        self.assertIsNotNone(small["error"], "the job was started")
        self.assertEqual(small["error"]["name"], "NotStartable")
        refused = small["error"]["notFitting"]
        self.assertEqual([(each["participant"], each["context"]) for each in refused], [("small-drafter", 10)])
        self.assertGreater(refused[0]["size"], 10)
        self.assertEqual(small["notFitting"], refused)
        destination = small["destinations"][0]
        self.assertEqual(destination["participant"], "small-drafter")
        for needle in (f"{UC2_PATH} — open", RULE, f"{UC1_PATH} — accepted", f"{UC3_PATH} — open", f"{UC4_PATH} — open"):
            self.assertIn(needle, destination["parts"])
        self.assertTrue(prepare("CI")["fits"])

    # TST-519005 · level: system · module: system
    # guards: A CI AGENT'S DRAFT ENTERS AS OPEN
    # given: the fixture product and the fixture CI agent, whose stand-in driver answers UC-002 changed as the instruction says
    # input: prepareJob and runJob (unattended, as a CI agent's job is) of change-use-case for UC-002
    # expect: one commit on the default branch that writes only docs/use-cases/UC-002-extend-a-loan.md, with the changed text;
    #         SPEC.md is byte-identical; no file is removed; the use case is open (not accepted) and no approval record names it,
    #         while UC-001 stays accepted
    def test_a_ci_agents_changed_use_case_enters_as_open_and_the_spec_is_untouched(self):
        run = ci_use_case_change()
        self.assertIsNone(run["error"], run["remaining"])
        self.assertEqual(run["stoppedBecause"], "passed", run["remaining"])
        self.assertEqual(len(run["commits"]), 1)
        self.assertEqual([f["path"] for f in run["commits"][0]["files"]], [UC2_PATH])
        self.assertEqual(run["changed"], {UC2_PATH: UC2_CHANGED})
        self.assertNotIn("SPEC.md", run["changed"])
        self.assertEqual(run["removed"], [])
        self.assertEqual(run["status"][UC2_PATH], "open")
        self.assertEqual(run["status"][UC1_PATH], "accepted")

    # TST-519006 · level: system · module: system
    # guards: A CI AGENT'S DRAFT ENTERS AS OPEN
    # given: the run of the CI agent's change-use-case job, and the fixture product with an approval record planted for UC-002's text
    # input: the approval-record detector over the paths after the run, and the same over the planted product
    # expect: the detector names no record for UC-002 after the run, and does name the planted one (so that "no record" is
    #         the finding of a detector that finds a record where one stands); the planted product shows UC-002 as accepted
    def test_counter_proof_no_approval_record_names_the_ci_agents_use_case(self):
        run = ci_use_case_change()
        paths = [p for p in PRODUCT if p not in run["removed"]] + [p for p in run["changed"] if p not in PRODUCT]
        self.assertFalse(named_by_an_approval_record(paths, uc="UC-002"))
        planted = with_planted_record(PRODUCT, UC2_PATH, "UC-002")
        self.assertTrue(named_by_an_approval_record(list(planted), uc="UC-002"))
        self.assertEqual(prepare("CI", planted)["status"][UC2_PATH], "accepted")

    # TST-519007 · level: system · module: system
    # guards: A CI AGENT'S DRAFT ENTERS AS OPEN
    # given: the fixture product and the fixture CI agent, whose stand-in driver answers a changed rule for A LOAN HAS A DUE DATE
    # input: prepareJob and runJob (unattended) of change-requirements for that requirement, source SRC-author, with an instruction
    # expect: one commit on the default branch that writes only files below docs/spec-freigaben/ (an index, one entry with its
    #         rationale, entscheidungen.md); SPEC.md is byte-identical and is no file of the commit; the queue has one entry whose
    #         state is "open"; no record under docs/approvals/ is added
    def test_a_ci_agents_changed_requirement_enters_as_a_queue_entry_and_the_spec_is_untouched(self):
        run = ci_requirement_change()
        self.assertIsNone(run["error"], run["remaining"])
        self.assertEqual(run["stoppedBecause"], "passed", run["remaining"])
        self.assertEqual(len(run["commits"]), 1)
        paths = [f["path"] for f in run["commits"][0]["files"]]
        self.assertEqual(len(paths), 4, paths)
        self.assertTrue(all(p.startswith("docs/spec-freigaben/") for p in paths), paths)
        self.assertNotIn("SPEC.md", run["changed"])
        self.assertEqual(run["removed"], [])
        self.assertEqual(len(run["queues"]), 1)
        entries = run["queues"][0]["entries"]
        self.assertEqual([e["state"] for e in entries], ["open"])
        self.assertTrue(entries[0]["proposal"] in paths)
        self.assertFalse([p for p in run["changed"] if p.startswith("docs/approvals/")])

    # TST-519008 · level: system · module: system
    # guards: A CI AGENT'S DRAFT ENTERS AS OPEN
    # given: the run of the CI agent's change-requirements job
    # input: the approval-record detector over the paths after the run, for the queue's entry 01, and over the same paths with a record planted whose name follows docs/approvals/spec-<queue>-01-<blob12>.md
    # expect: the detector names no record for the entry after the run, and does name the planted one
    def test_counter_proof_no_approval_record_names_the_ci_agents_queue_entry(self):
        run = ci_requirement_change()
        queue = run["queues"][0]["folder"].rsplit("/", 1)[1]
        paths = list(PRODUCT) + list(run["changed"])
        self.assertFalse(named_by_an_approval_record(paths, entry=(queue, "01")))
        proposal = run["queues"][0]["entries"][0]["proposal"]
        planted = paths + [f"docs/approvals/spec-{queue}-01-{blob(run['changed'][proposal])[:12]}.md"]
        self.assertTrue(named_by_an_approval_record(planted, entry=(queue, "01")))


if __name__ == "__main__":
    unittest.main()
