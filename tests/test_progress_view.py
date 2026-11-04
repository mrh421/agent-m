# Module: MOD-implementation-pages
# Module: MOD-progress-measures
# Module: MOD-model-catalogue
# Guards: PROGRESS IS SHOWN IN THE MODEL'S OWN MEASURE; UC-035
# Level: release
"""SPEC section 13 - the check named tests/test_progress_view.py: a V-model, a Scrum and a Kanban fixture each render their
declared measure; a definition naming an unknown measure fails validation.

A release test of UC-035, authored by developer-opus-f (ITM-806), who implemented none of the items that realise UC-035
(RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER). The cases live in tests/test_progress_view.md. This file loads them and
asks node: a case of the kind `page` draws the real route `progress` of MOD-implementation-pages as the existing tests of
the route reach it (tests/implementation-pages-sprints.mjs: the product held in memory, the page drawn into a fixture DOM
with the review page's context); a case of the kind `validation` asks MOD-model-catalogue's modelFindings through its
index.mjs.

Reading the texts leave open, which the cases state: a model's declared measure is rendered when the page draws the thing
UC-035's table names for its kind — for plan entries per phase a grid of every requirement in every phase, for remaining
items per time box a burn-down of each team's running sprint, for items per state over time the board's cards with a
cumulative flow chart —, and none of the other two.
"""
import json
import re
import subprocess
import unittest
from pathlib import Path

TESTS = Path(__file__).resolve().parent
DATA = Path(__file__).with_suffix(".md")

PAGE = r"""
const { readFileSync } = await import("node:fs");
const { render, productFiles, found, sprint, TEAM1_RUNNING } = await import(__SPRINTS__);
const input = __INPUT__;
const overrides = { "docs/process-models/fixture.md": readFileSync(new URL(input.model, __SPRINTS__), "utf8") };
if (input.running_since === "yesterday") {
  const start = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  overrides[TEAM1_RUNNING] = sprint({ n: 3, start, goal: "Store and show", selection: ["ITM-001", "ITM-002"] });
}
const page = await render("progress", {}, { files: productFiles(overrides) });
try {
  const attr = (selector, name) => found(page.target, selector).map((each) => each.getAttribute(name));
  const phases = attr("[data-cell]", "data-phase");
  process.stdout.write(JSON.stringify({
    heading: found(page.target, "[data-part]").filter((each) => each.getAttribute("data-part") === "measure").map((each) => each.innerHTML.match(/<h3>([^<]*)<\/h3>/)?.[1] ?? null),
    cells: attr("[data-cell]", "data-requirement").map((requirement, at) => [requirement, phases[at].replace(/&amp;/g, "&")]),
    burnDowns: attr("[data-burn-down]", "data-burn-down"), cards: attr("[data-card]", "data-card").sort(), flowCharts: attr("[data-flow-chart]", "data-flow-chart").length }));
} finally { page.done(); }
"""

VALIDATION = r"""
const { readFileSync } = await import("node:fs");
const { readDocument } = await import(__DOCUMENTS__);
const { modelSchema, modelFindings } = await import(__CATALOGUE__);
const input = __INPUT__;
const text = readFileSync(new URL(input.model, __TESTS__), "utf8").replace(/^measure: .*$/m, `measure: ${input.measure}`);
const findings = modelFindings(readDocument(modelSchema.model, "docs/process-models/fixture.md", text));
process.stdout.write(JSON.stringify({ errors: findings.filter((finding) => finding.kind === "error").map((finding) => finding.rule) }));
"""


def fence(body: str, heading: str) -> str:
    match = re.search(rf"^### {re.escape(heading)}\n\n```[a-z]*\n(.*?)\n```", body, re.M | re.S)
    if not match:
        raise AssertionError(f"missing fenced block under {heading}")
    return match.group(1)


def case(name: str) -> dict:
    text = DATA.read_text(encoding="utf-8")
    for m in re.finditer(r"^## (?P<name>[^\n]+)\n(?P<body>.*?)(?=^## |\Z)", text, re.M | re.S):
        if m.group("name") == name:
            return json.loads(fence(m.group("body"), "Case"))
    raise AssertionError(f"no case named {name} in {DATA.name}")


def outcome(input_: dict) -> dict:
    uri = lambda path: json.dumps(path.as_uri())
    script = PAGE if input_["kind"] == "page" else VALIDATION
    code = (script.replace("__SPRINTS__", uri(TESTS / "implementation-pages-sprints.mjs")).replace("__TESTS__", json.dumps(TESTS.as_uri() + "/"))
            .replace("__DOCUMENTS__", uri(TESTS.parent / "src" / "documents" / "index.mjs"))
            .replace("__CATALOGUE__", uri(TESTS.parent / "src" / "model-catalogue" / "index.mjs")).replace("__INPUT__", json.dumps(input_)))
    r = subprocess.run(["node", "--input-type=module", "-e", code], capture_output=True, text=True, cwd=TESTS, timeout=60)
    if r.returncode != 0:
        raise AssertionError(r.stderr.strip()[-1500:])
    return json.loads(r.stdout)


class ProgressIsShownInTheModelsOwnMeasure(unittest.TestCase):
    def check(self, name: str):
        loaded = case(name)
        self.assertEqual(outcome(loaded["input"]), loaded["expected"])

    # TST-806201 · level: release · module: MOD-implementation-pages
    # guards: PROGRESS IS SHOWN IN THE MODEL'S OWN MEASURE
    # given: the fixture product of one requirement, RULE ONE, with the V-model, whose measure is plan entries per phase (tests/test_progress_view.md)
    # input: the reader opens Progress
    # expect: the measure panel is headed "plan entries per phase" and holds a grid cell for RULE ONE in each of the seven phases, in their order; no burn-down, no card and no flow chart stand on the page
    def test_the_v_model_renders_plan_entries_per_phase(self):
        self.check("The V-model renders plan entries per phase")

    # TST-806202 · level: release · module: MOD-implementation-pages
    # guards: PROGRESS IS SHOWN IN THE MODEL'S OWN MEASURE
    # given: the same product with the Scrum fixture, whose measure is remaining items per time box: team1 runs its sprint 03 since yesterday, within its two-week time box; team2 runs none
    # input: the reader opens Progress
    # expect: one burn-down, team1's; no measure panel, no grid cell, no card and no flow chart stand on the page
    def test_scrum_renders_remaining_items_per_time_box(self):
        self.check("Scrum renders remaining items per time box")

    # TST-806203 · level: release · module: MOD-implementation-pages
    # guards: PROGRESS IS SHOWN IN THE MODEL'S OWN MEASURE
    # given: the same product with the Kanban fixture, whose measure is items per state over time; the backlog holds ITM-001 to ITM-005
    # input: the reader opens Progress
    # expect: the measure panel is headed "items per state over time" and holds a card for each of ITM-001 to ITM-005 and one cumulative flow chart; no grid cell and no burn-down stand on the page
    def test_kanban_renders_items_per_state_over_time(self):
        self.check("Kanban renders items per state over time")

    # TST-806204 · level: release · module: MOD-model-catalogue
    # guards: PROGRESS IS SHOWN IN THE MODEL'S OWN MEASURE
    # given: the instance's V-model whose measure is set to lines of code per week, which no model kind names
    # input: MOD-model-catalogue's modelFindings over the definition read with its model schema
    # expect: one error finding, under PROGRESS IS SHOWN IN THE MODEL'S OWN MEASURE
    def test_a_definition_naming_an_unknown_measure_fails_validation(self):
        self.check("A definition naming an unknown measure fails validation")

    # TST-806205 · level: release · module: MOD-model-catalogue
    # guards: PROGRESS IS SHOWN IN THE MODEL'S OWN MEASURE
    # given: the instance's V-model with its own measure, plan entries per phase — the known positive of TST-806204
    # input: MOD-model-catalogue's modelFindings over the definition read with its model schema
    # expect: no error finding
    def test_the_same_definition_with_its_own_measure_passes_validation(self):
        self.check("The same definition with its own measure passes validation")


if __name__ == "__main__":
    unittest.main()
