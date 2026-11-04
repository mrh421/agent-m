# Module: MOD-review-pages
# Guards: ACCEPTING A USE CASE PUTS THE MODULES IT CHANGES INTO THE BACKLOG; UC-008
# Level: unit
"""SPEC section 13 - the check named tests/test_backlog_from_acceptance.py, for the requirement ACCEPTING A USE CASE PUTS THE MODULES IT CHANGES INTO THE
BACKLOG: in a model that pulls its work from a backlog, accepting a use case adds one backlog item for each module whose implementation its accepted text
changes, unless an item not yet done names that module.

This file asks node (tests/jsrun.py) to accept a fixture use case on MOD-review-pages' page of one use case, #use-case/id=UC-007, with one click on Accept,
in the world of tests/review-pages-draft-world.mjs: the product is a repository in memory behind a Host of the tests' own, which every commit of the page goes
through with the token the person stored for the product, so that a commit it records is made under the accepting person's account; the instance is that
file's, with a register whose one participant, drafter-a, is a model endpoint that drafts text at "this machine". The endpoint stands behind the global
`fetch`: asked anything, it answers the checking participant's draft, the two items of the modules the use case's text changes, as the kind
check-affected-modules answers (src/job-catalogue/kinds/check-affected-modules/). The product declares its process model in docs/process.md: Scrum of the
shipped catalogue (pulled), or the V-model (planned). The real MOD-review-pages, MOD-approvals, MOD-job-runner, MOD-runtimes, MOD-work-plans and
MOD-product-process run as they are, with the strategies the view hands the frame. What the world gives back: each commit's files and message, the items
written with what each realises and the modules it names, and how often the endpoint was asked.
"""
import json
import unittest
from pathlib import Path

from jsrun import js

ROOT = Path(__file__).resolve().parents[1]
RULE = "ACCEPTING A USE CASE PUTS THE MODULES IT CHANGES INTO THE BACKLOG"

# The world. `input`: `model` ("scrum" or "v-model", the shipped model the product declares) and `pending` (true: the product's backlog holds ITM-001, an item
# that no merged pull request names - not done - and that names MOD-shelf).
WORLD = r"""
const url = (path) => `file://${ROOT}/${path}`;
const world = await import(url("tests/review-pages-draft-world.mjs"));
const { registerStrategies } = await import(url("src/job-runner/index.mjs"));
const { writeSetting } = await import(url("src/browser-store/index.mjs"));
const { workStrategies } = await import(url("src/work-plans/index.mjs"));
// The strategies as the frame registers them at load, every view's (MOD-site-frame, register.mjs): MOD-review-pages' view's, and MOD-work-plans' workStrategies, which the
// view of MOD-implementation-pages hands it.
[...world.pages.view.strategies, workStrategies].forEach((strategies, at) => registerStrategies(`tests/test_backlog_from_acceptance.py#${at}`, strategies));

const { text, PRODUCT_FILES, MOD_READER, INSTANCE_COMMIT } = world;
const declaration = text("---", `model: ${input.model}`, `model_file: src/model-catalogue/models/${input.model}.md`, `model_version: ${INSTANCE_COMMIT}`, "---",
  "# How the thesis tool is developed", "", "## Practices", "", "- none", "", "## Definition of Done", "", "The job rules hold.");
const shelf = MOD_READER.replaceAll("MOD-reader", "MOD-shelf").replace("folder: src/reader/", "folder: src/shelf/").replace("Reading a book", "Shelving a book");
const files = { ...PRODUCT_FILES, "docs/process.md": declaration, "docs/architecture/MOD-shelf.md": shelf };
if (input.pending) files["docs/backlog/ITM-001-shelve-books.md"] = text("---", "id: ITM-001", "title: Shelve books", "level: module", "realises:", "  - A BOOK IS SHELVED",
  "modules:", "  - MOD-shelf", "builds_on: []", "tests:", "  - unit", "origin:", "  - A BOOK IS SHELVED", "---", "# ITM-001 Shelve books", "", "## Outcome", "", "Books are shelved.", "",
  "## Acceptance", "", "- unit tests of MOD-shelf.");
const fake = world.fakeProduct(files);
fake.host.listPullRequests = async () => [];

// The checking participant's draft: one item for each module the text of UC-007 changes.
const item = (module) => ({ title: `Derive use cases in ${module}`, outcome: `${module} does what UC-007 asks of it.`, realises: ["UC-007"], modules: [module],
  acceptance: [`unit tests of ${module}`] });
let asked = 0;
globalThis.fetch = async () => {
  asked += 1;
  return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ draft: { items: [item("MOD-reader"), item("MOD-shelf")] }, answers: [] }) } }],
    usage: { prompt_tokens: 10, completion_tokens: 5 } }), { status: 200, headers: { "content-type": "application/json" } });
};

const context = world.contextOf(fake);
writeSetting(context.store, "endpoint:ep1", { url: "https://ep1.example.test/v1", kind: "openai-compatible", model: "example-model" });
const { target } = await world.draw(fake, "use-case", { id: "UC-007" }, { context });
const accept = world.buttonsNamed(target, "Accept");
if (accept.length !== 1) throw new Error(`the page offers ${accept.length} Accept buttons`);
world.click(accept[0]);
const accepted = () => world.byClass(target, "p", "result").some((node) => node.textContent.startsWith("Accepted in commit"));
for (const limit = Date.now() + 20000; !accepted() && Date.now() < limit;) await new Promise((resolve) => setTimeout(resolve, 5));
if (!accepted()) throw new Error(`the acceptance did not end: ${target.textContent.slice(0, 600)}`);

const field = (body, key) => (new RegExp(`^${key}:\\n((?:  - .*\\n)*)`, "m").exec(body)?.[1] ?? "").split("\n").filter(Boolean).map((line) => line.slice(4));
const commits = fake.writes().map((change) => ({ paths: change.files.map((file) => file.path).sort(), message: change.message }));
const items = fake.writes().flatMap((change, at) => change.files.filter((file) => /^docs\/backlog\/ITM-\d+-/.test(file.path))
  .map((file) => ({ commit: at, path: file.path, realises: field(file.text, "realises"), modules: field(file.text, "modules") })));
return { commits, items, asked, page: target.textContent };
"""


def accept(model: str, pending: bool = False) -> dict:
    return js(f"const input = {json.dumps({'model': model, 'pending': pending})}; const ROOT = {json.dumps(str(ROOT))};\n{WORLD}")


def item_commits(got: dict) -> list:
    return sorted({each["commit"] for each in got["items"]})


class AcceptingAUseCasePutsTheModulesItChangesIntoTheBacklog(unittest.TestCase):
    # TST-1319004 · level: unit · module: MOD-review-pages
    # guards: ACCEPTING A USE CASE PUTS THE MODULES IT CHANGES INTO THE BACKLOG; UC-008
    # given: a Scrum product whose use case UC-007 is open, whose architecture describes MOD-reader and MOD-shelf and whose backlog is empty; a checking fixture participant that names those two modules as the ones the text of UC-007 changes; the person's token
    # input: one click on Accept of #use-case/id=UC-007
    # expect: the acceptance's commit holds UC-007's approval record; then one commit, through the same host and the person's token, holds exactly two backlog items, each realising UC-007 and naming one of MOD-reader and MOD-shelf; the participant was asked
    def test_accepting_a_use_case_in_a_scrum_product_commits_one_item_for_each_module_its_text_changes(self):
        got = accept("scrum")
        self.assertTrue(any(path.startswith("docs/approvals/UC-007-") for path in got["commits"][0]["paths"]), got["commits"])
        self.assertGreater(got["asked"], 0, "the checking participant was asked")
        self.assertEqual(len(item_commits(got)), 1, f"the items stand in one commit: {got['commits']}")
        self.assertEqual(sorted((each["realises"], each["modules"]) for each in got["items"]),
                         [(["UC-007"], ["MOD-reader"]), (["UC-007"], ["MOD-shelf"])], got["items"])

    # TST-1319005 · level: unit · module: MOD-review-pages
    # guards: ACCEPTING A USE CASE PUTS THE MODULES IT CHANGES INTO THE BACKLOG; UC-008
    # given: the product of TST-1319004, whose backlog also holds ITM-001, an item no merged pull request names - not done - that names MOD-shelf; the same participant naming MOD-reader and MOD-shelf
    # input: one click on Accept of #use-case/id=UC-007
    # expect: counter-proof: one item is committed, realising UC-007 and naming MOD-reader; no item names MOD-shelf
    def test_counter_proof_a_module_that_an_item_not_yet_done_names_gets_no_item(self):
        got = accept("scrum", pending=True)
        self.assertEqual([(each["realises"], each["modules"]) for each in got["items"]], [(["UC-007"], ["MOD-reader"])], got["items"])

    # TST-1319006 · level: unit · module: MOD-review-pages
    # guards: ACCEPTING A USE CASE PUTS THE MODULES IT CHANGES INTO THE BACKLOG; UC-008
    # given: the product of TST-1319004, declaring the V-model, a planned model
    # input: one click on Accept of #use-case/id=UC-007
    # expect: counter-proof: one commit, the approval record of UC-007; no item is committed and the participant is never asked
    def test_counter_proof_accepting_the_same_use_case_in_a_v_model_product_adds_none(self):
        got = accept("v-model")
        self.assertEqual(len(got["commits"]), 1, got["commits"])
        self.assertTrue(got["commits"][0]["paths"][0].startswith("docs/approvals/UC-007-"), got["commits"])
        self.assertEqual((got["items"], got["asked"]), ([], 0))


if __name__ == "__main__":
    unittest.main()
