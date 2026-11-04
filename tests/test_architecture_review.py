# Module: MOD-job-runner
# Guards: NO REVIEWER IS THE DRAFTER; A CHANGE ACROSS MODULES IS CHECKED AS A WHOLE
# Level: component
"""SPEC NO REVIEWER IS THE DRAFTER: a reviewer that is the drafter, or uses its model, is refused before anything is sent;
counter-proof: another participant with another model is accepted, and so is the drafter of a change described in the prompt
bar.

SPEC A CHANGE ACROSS MODULES IS CHECKED AS A WHOLE: a change to two module files sends every file of the architecture to the
reviewer; counter-proof: with the recipe whole-architecture left out of the kind review-architecture, the files the change
leaves as they are are not sent. That case runs MOD-approvals' and MOD-spec-changes' own recipes over a fixture product.

A job of the catalogue's kind derive-architecture, reviewed by one participant of review-architecture, is prepared with
MOD-job-runner's prepareJob — which sends nothing — for one drafter and three reviewers in turn: the drafter itself, another
participant with the drafter's model, and another participant with another model; and once more with the drafter as its own
reviewer and `selfReview` set, as MOD-prompt-bar prepares a change described in the prompt bar. The strategies the kind names come from
modules that do not offer them yet, so stand-ins that give one small part each are registered first; a name a module already
registered keeps its own. Asked through node (tests/jsrun.py).
"""
import unittest

from jsrun import js

PREPARE = """
const standIn = { recipes: { "whole-spec": async () => [{ name: "SPEC.md", text: "the SPEC", sources: [], required: true, size: 0 }],
    "accepted-use-cases": async () => [], "whole-architecture": async () => [], "chapters-for-architecture": async () => [] },
  preconditions: { "architecture-ready": async () => null },
  checks: { "document-schema": () => [], "graph-checks": () => [], "candidate-classes": () => [] },
  steps: { "due-diligence": async (draft) => ({ draft, findings: [] }) },
  writers: { "open-files": async () => ({ commits: [], files: [], pullRequest: null, shown: null }) } };
for (const [category, strategies] of Object.entries(standIn)) for (const [name, strategy] of Object.entries(strategies)) {
  try { jobRunner.registerStrategies("tests/test_architecture_review.py", { [category]: { [name]: strategy } }); }
  catch (error) { if (error.name !== "DuplicateStrategy") throw error; }
}
const participant = (name, model) => ({ name, type: "CLI agent", model, context: 200000, price: null,
  capabilities: ["draft text"], place: "this machine", route: "bridge lab-pc agent claude" });
const drafter = participant("drafter-a", "example-model");
const reviewers = { itself: drafter, sameModel: participant("reviewer-s", "example-model"),
  otherModel: participant("reviewer-c", "other-model") };
const kind = await jobCatalogue.kindOf("derive-architecture");
const context = { kind, params: {}, product: { address: "https://github.com/alice/product", snapshot: null, host: null },
  instance: { snapshot: null, host: null }, connect: async () => null, participants: [drafter, ...Object.values(reviewers)],
  places: { sources: {}, mailbox: null }, gates: [], person: "alice", now: new Date(), agentM: { version: "unreleased",
  commit: "0".repeat(40) }, jobId: null };
const out = {};
for (const [which, reviewer] of Object.entries(reviewers)) {
  const job = await jobRunner.prepareJob("derive-architecture", context, { drafter, reviewers: [reviewer] });
  out[which] = job.blocking.map((f) => [f.kind, f.rule, f.what.includes(reviewer.name)]);
}
const own = await jobRunner.prepareJob("derive-architecture", context, { drafter, reviewers: [drafter], selfReview: true });
out.selfReview = own.blocking.map((f) => [f.kind, f.rule, f.what.includes(drafter.name)]);
return out;
"""

# A change to two module files of a product whose architecture holds six files, run with the recipes MOD-approvals and
# MOD-spec-changes offer; the reviewer's input is read. The second run plants the fault: the recipe whole-architecture is taken
# out of the kind review-architecture, which this process holds once.
CHANGE = r"""
const text = (...lines) => `${lines.join("\n")}\n`;
const standIn = { recipes: { "chapters-for-architecture": async () => [] },
  steps: { "due-diligence": async (draft) => ({ draft, findings: [] }) } };
for (const [owner, strategies] of [["MOD-spec-changes", specChanges.specStrategies], ["MOD-approvals", approvals.approvalStrategies],
  ["MOD-artifact-edits", artifactEdits.editStrategies], ["tests/test_architecture_review.py", standIn]]) {
  for (const [category, named] of Object.entries(strategies)) for (const [name, strategy] of Object.entries(named)) {
    try { jobRunner.registerStrategies(owner, { [category]: { [name]: strategy } }); }
    catch (error) { if (error.name !== "DuplicateStrategy") throw error; }
  }
}
const decision = (id, designs) => text("---", `id: ${id}`, `title: Decision ${id}`, "forced_by:", "  - A LOAN HAS A DUE DATE", "designs:",
  ...designs.map((name) => `  - ${name}`), "---", `# ${id} Decision ${id}`, "", "## Context", "", "Books are lent.", "", "## Decision", "",
  `The decision ${id} stands.`, "", "```mermaid", "flowchart LR", "    A --> B", "```", "", "## Alternatives", "", "One module.", "",
  "## Consequences", "", "Folders.");
const module_ = (id, sentence) => text("---", `id: ${id}`, `title: Module ${id}`, `folder: src/${id.slice(4)}/`, "realises:",
  "  - A LOAN HAS A DUE DATE", "follows:", "  - ARC-001", "uses:", "provides:", `  - ${id.slice(4)}`, "---", `# ${id} Module ${id}`, "",
  "## Responsibility", "", sentence, "", "## Parts", "", "- `index.mjs`", "", "## Data", "", "Nothing.", "", "## Interfaces", "",
  `- \`${id.slice(4)}() -> text\` — gives a text.`, "", "## Files", "", "None.", "", "## Uses", "", "Nothing.");
const ARCHITECTURE = ["docs/architecture/ARC-001-lending.md", "docs/architecture/ARC-002-shelving.md", "docs/architecture/MOD-sync.md",
  "docs/architecture/MOD-desk.md", "docs/architecture/MOD-report.md", "docs/architecture/MOD-shelf.md"];
const files = { "SPEC.md": text("# Library", "", "## Lending", "", "**A LOAN HAS A DUE DATE** *(Product Owner)*", "A loan states its due date.",
    "*Check:* `tests/sync.test.mjs`"),
  "docs/use-cases/UC-001-lend.md": text("---", "id: UC-001", "title: Lend", "area: lending", "actors:", "  - Member", "realises:",
    "  - A LOAN HAS A DUE DATE", "---", "# UC-001 Lend", "", "**Goal.** Lend."),
  [ARCHITECTURE[0]]: decision("ARC-001", ["MOD-sync", "MOD-desk", "MOD-report"]), [ARCHITECTURE[1]]: decision("ARC-002", ["MOD-shelf"]),
  [ARCHITECTURE[2]]: module_("MOD-sync", "It synchronises the loans."), [ARCHITECTURE[3]]: module_("MOD-desk", "It lends at the desk."),
  [ARCHITECTURE[4]]: module_("MOD-report", "It reports the loans."), [ARCHITECTURE[5]]: module_("MOD-shelf", "It keeps the shelves.") };
const { createHash } = process.getBuiltinModule("node:crypto");
const blob = (body) => createHash("sha1").update(`blob ${Buffer.byteLength(body)}\0${body}`).digest("hex");
const useCase = files["docs/use-cases/UC-001-lend.md"];
files[`docs/approvals/UC-001-${blob(useCase).slice(0, 12)}.md`] = text("kind: use-case", "file: docs/use-cases/UC-001-lend.md", `blob: ${blob(useCase)}`);
const snapshot = { repository: { server: "github", origin: "https://github.com", path: "alice/product", web: "https://github.com/alice/product" },
  ref: "main", paths: Object.keys(files), blob: (path) => (Object.hasOwn(files, path) ? blob(files[path]) : null),
  read: async (path) => (Object.hasOwn(files, path) ? files[path] : null), commit: "0".repeat(40) };
const participant = (name, model) => ({ name, type: "CLI agent", model, context: 2000000, price: null,
  capabilities: ["draft text"], place: "this machine", route: "bridge lab-pc agent claude" });
const drafter = participant("drafter-a", "example-model"), reviewer = participant("reviewer-c", "other-model");
const driver = (who, answer) => { const inputs = []; return { participant: who, inputs, async send(input) {
  inputs.push(input); return { text: JSON.stringify(answer), usage: null }; } }; };
const changed = ["MOD-sync", "MOD-desk"].map((id) => ({ path: `docs/architecture/${id}.md`, class: "change", of: id,
  text: files[`docs/architecture/${id}.md`].replace("It ", "It well ") }));
async function reviewerIsSent() {
  const kind = await jobCatalogue.kindOf("change-architecture");
  const context = { kind, params: { target: "MOD-sync", instruction: "Change two modules" },
    product: { address: "https://github.com/alice/product", snapshot, host: null }, instance: { snapshot, host: null, checkout: null },
    connect: async () => null, participants: [drafter, reviewer], places: { sources: {}, mailbox: null }, gates: [], person: "alice",
    now: new Date(), agentM: { version: "unreleased", commit: "0".repeat(40) }, jobId: null };
  const prepared = await jobRunner.prepareJob("change-architecture", context, { drafter, reviewers: [reviewer] });
  const asked = driver(reviewer, { draft: { findings: [] } });
  await jobRunner.runJob(prepared, { drafter: driver(drafter, { draft: { files: changed } }), reviewers: [asked] }, { attended: true, context });
  const prompt = asked.inputs[0].prompt;
  return { blocking: prepared.blocking.map((found) => found.rule), asked: asked.inputs.length,
    architecture: Object.fromEntries(ARCHITECTURE.map((path) => [path, prompt.includes(files[path])])),
    changed: changed.map((file) => prompt.includes(JSON.stringify(file.text).slice(1, -1))), spec: prompt.includes(files["SPEC.md"]) };
}
const out = { whole: await reviewerIsSent() };
const reviewing = await jobCatalogue.kindOf("review-architecture");
reviewing.recipes = reviewing.recipes.filter((recipe) => recipe.name !== "whole-architecture");
out.leftOut = await reviewerIsSent();
return out;
"""


class ArchitectureReview(unittest.TestCase):
    # TST-475001 · level: component · module: MOD-job-runner
    # guards: NO REVIEWER IS THE DRAFTER
    # given: a derive-architecture job reviewed by one participant, prepared with prepareJob (sends nothing), for a drafter and three reviewers
    # input: reviewer is the drafter itself; another participant with the drafter's model; another participant with another model
    # expect: the drafter itself and the same-model reviewer each give one blocking error NO REVIEWER IS THE DRAFTER naming the reviewer; the other-model reviewer gives none (counter-proof)
    def test_a_reviewer_that_is_the_drafter_or_uses_its_model_is_refused_before_anything_is_sent(self):
        blocking = js(PREPARE)
        self.assertEqual(blocking["otherModel"], [], "counter-proof: another participant with another model is accepted")
        refused = ["error", "NO REVIEWER IS THE DRAFTER", True]
        self.assertEqual(blocking["itself"], [refused])
        self.assertEqual(blocking["sameModel"], [refused])

    # TST-1320005 · level: component · module: MOD-job-runner
    # guards: NO REVIEWER IS THE DRAFTER
    # given: the derive-architecture job of TST-475001, prepared with prepareJob (sends nothing); known positive: the drafter as its own reviewer without selfReview gives one blocking error
    # input: the drafter as its own one reviewer, with selfReview set, as the prompt bar prepares a change described in it
    # expect: no blocking error (the counter-proof: the drafter of a change described in the prompt bar is accepted)
    def test_the_drafter_of_a_change_described_in_the_prompt_bar_is_accepted_as_its_reviewer(self):
        blocking = js(PREPARE)
        self.assertEqual(blocking["itself"], [["error", "NO REVIEWER IS THE DRAFTER", True]], "known positive")
        self.assertEqual(blocking["selfReview"], [], "the drafter of a change described in the prompt bar is accepted")

    # TST-1318001 · level: component · module: MOD-job-runner
    # guards: A CHANGE ACROSS MODULES IS CHECKED AS A WHOLE
    # given: a product whose architecture holds six files (ARC-001, ARC-002, MOD-sync, MOD-desk, MOD-report, MOD-shelf) and one accepted use case; a change-architecture job with a drafter and a reviewer of another model, whose drafter changes the two module files MOD-sync and MOD-desk
    # input: the job is run and the reviewer's input is read; then the same with the recipe whole-architecture left out of the kind review-architecture (the planted fault)
    # expect: the reviewer's input holds the whole text of all six files of the architecture, the changed ones among them, with the two changed files of the draft and the SPEC (known positives); with the recipe left out it holds the two changed files and the SPEC but none of the six files as the architecture holds them (counter-proof)
    def test_a_change_to_two_module_files_sends_every_file_of_the_architecture_to_the_reviewer(self):
        out = js(CHANGE)
        whole, left_out = out["whole"], out["leftOut"]
        for which in (whole, left_out):
            self.assertEqual((which["blocking"], which["asked"]), ([], 1))
            self.assertEqual(which["changed"], [True, True], "known positive: the two changed files of the draft are sent")
            self.assertTrue(which["spec"], "known positive: the SPEC is sent")
        self.assertEqual(sorted(whole["architecture"]), sorted(left_out["architecture"]))
        self.assertEqual(len(whole["architecture"]), 6)
        self.assertEqual(whole["architecture"], {path: True for path in whole["architecture"]}, "every file of the architecture is sent")
        self.assertEqual(left_out["architecture"], {path: False for path in left_out["architecture"]},
                         "counter-proof: without the recipe the files the change leaves as they are are not sent")


if __name__ == "__main__":
    unittest.main()
