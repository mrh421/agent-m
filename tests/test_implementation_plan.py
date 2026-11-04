# Module: MOD-work-plans
# Module: MOD-implementation-pages
# Guards: AN IMPLEMENTATION PLAN ASSEMBLES THE SYSTEM FROM ITS MODULES; A PLAN STEP NAMES THE TESTS OF ITS LEVEL; A RUN FOLLOWS THE MODULES' INTERFACES; UC-045
# Level: release
"""SPEC section 13 - the check named tests/test_implementation_plan.py.

The cases live in tests/test_implementation_plan.md. This file loads them, writes the product of each as the files a product
keeps (the architecture under docs/architecture/, the steps and their order under docs/plan/) and asks MOD-work-plans'
planFindings, the check by which Agent M refuses a plan (UC-045 step 3), for its findings. Written by developer-sonnet-j
(ITM-1061), who implemented none of the plan's code.
"""
import json
import re
import unittest
from pathlib import Path

from jsrun import js

DATA = Path(__file__).with_suffix(".md")

JS_CHECK = """
const text = (...lines) => `${lines.join("\\n")}\\n`;
const list = (key, names) => (names.length ? [`${key}:`, ...names.map((name) => `  - ${name}`)] : [`${key}: []`]);
const module_ = (id, uses) => text("---", `id: ${id}`, `title: ${id}`, `folder: src/${id.slice(4)}/`, ...list("realises", []), "follows:", "  - ARC-002",
  ...list("uses", uses), ...list("provides", ["read"]), "---", `# ${id} ${id}`);
const step = (each) => text("---", `id: ${each.id}`, `title: ${each.title}`, `level: ${each.level}`, ...list("realises", ["UC-001"]), ...list("modules", each.modules),
  ...(each.integrates ? [`integrates: ${each.integrates}`] : []), ...list("tests", each.tests), ...list("origin", ["UC-001"]), "---", `# ${each.id} ${each.title}`,
  "", "## Outcome", "", "o", "", "## Acceptance", "", "a");

async function planCase(input) {
  const files = {
    "SPEC.md": "# Fixture\\n",
    "docs/architecture/ARC-001-whole.md": text("---", "id: ARC-001", "title: The whole", "forced_by: []", "---", "# ARC-001 The whole"),
    "docs/architecture/ARC-002-sub.md": text("---", "id: ARC-002", "title: Sub", "refines: ARC-001", "forced_by: []", ...list("designs", ["MOD-a", "MOD-b"]), "---", "# ARC-002 Sub"),
    "docs/architecture/MOD-a.md": module_("MOD-a", []),
    "docs/architecture/MOD-b.md": module_("MOD-b", ["MOD-a.read"]),
  };
  const stepFiles = {};
  for (const each of input.steps) stepFiles[`docs/plan/${each.id}-${each.title.toLowerCase()}.md`] = step(each);
  const phase = (id) => (input.steps.find((each) => each.id === id).level === "module" ? "Implementation" : "Testing");
  const orderText = text("## Order", "", "| Step | Phase |", "| --- | --- |", ...input.order.map((id) => `| ${id} | ${phase(id)} |`));
  Object.assign(files, stepFiles, { "docs/plan/order.md": orderText });
  const schemas = documents.artifactSchemas();
  const architecture = Object.keys(files).filter((path) => path.startsWith("docs/architecture/"))
    .map((path) => documents.readDocument(/\\/ARC-/.test(path) ? schemas.decision : schemas.module, path, files[path]));
  const steps = Object.keys(stepFiles).map((path) => documents.readDocument(schemas.item, path, files[path]));
  const order = documents.readDocument(workPlans.planSchemas.planOrder, "docs/plan/order.md", orderText);
  const workflow = { phases: [{ name: "Implementation" }, { name: "Testing" }] };
  const source = { paths: Object.keys(files), read: async (path) => (Object.hasOwn(files, path) ? files[path] : null) };
  const found = await workPlans.planFindings(order, steps, architecture, workflow, source);
  return { findings: found.map((each) => `${each.rule} | ${each.what}`) };
}
"""


def fence(body: str, heading: str) -> str:
    match = re.search(rf"^### {re.escape(heading)}\n\n```[a-z]*\n(.*?)\n```", body, re.M | re.S)
    if not match:
        raise AssertionError(f"missing fenced block under {heading}")
    return match.group(1)


def cases(group: str) -> list[dict]:
    text = DATA.read_text(encoding="utf-8")
    found = [{"name": m.group("name"), "case": json.loads(fence(m.group("body"), "Case"))}
             for m in re.finditer(r"^## (?P<name>[^\n]+)\n(?P<body>.*?)(?=^## |\Z)", text, re.M | re.S)]
    chosen = [item for item in found if group in item["case"]["groups"]]
    if not chosen:
        raise AssertionError(f"no cases of {group} loaded")
    return chosen


def findings(case_input: dict) -> dict:
    return js(JS_CHECK + "return await planCase(%s);" % json.dumps(case_input))


class TestImplementationPlan(unittest.TestCase):
    # TST-1061201 · level: release · module: system
    # guards: AN IMPLEMENTATION PLAN ASSEMBLES THE SYSTEM FROM ITS MODULES; A RUN FOLLOWS THE MODULES' INTERFACES; UC-045
    # given: Markdown fixture plans of a product with the system ARC-001, the subsystem ARC-002 and the modules MOD-a and MOD-b, which uses MOD-a's interface
    # input: planFindings of a plan that leaves a module, a subsystem or the system without a step, and of a plan that orders MOD-b before MOD-a
    # expect: each is refused and the gap named: MOD-b has no step, ARC-002 has no step for its integration, the system has no step, MOD-b is ordered before MOD-a; counter-proof: the plan in the order of the interfaces has no finding
    def test_a_plan_with_a_gap_or_out_of_order_is_refused_and_one_in_order_is_accepted(self):
        loaded = cases("assembly")
        self.assertEqual(len(loaded), 5, "known positive: the data holds five cases of the assembly")
        for item in loaded:
            with self.subTest(case=item["name"]):
                self.assertEqual(findings(item["case"]["input"]), item["case"]["expected"])

    # TST-1061202 · level: release · module: system
    # guards: A PLAN STEP NAMES THE TESTS OF ITS LEVEL; UC-045
    # given: Markdown fixture plans whose step of a module names component tests, and whose step of the system names unit tests; the accepted plan, whose steps name the tests of their level
    # input: planFindings of each
    # expect: the step with the tests of another level is refused and named with its level and the tests; counter-proof: the plan whose steps name the tests of their level, unit for a module, component for a subsystem, system and release for the system, has no finding
    def test_a_step_with_the_tests_of_another_level_is_refused_and_one_with_the_tests_of_its_level_is_accepted(self):
        loaded = cases("level")
        self.assertEqual(len(loaded), 3, "known positive: the data holds three cases of the levels")
        for item in loaded:
            with self.subTest(case=item["name"]):
                self.assertEqual(findings(item["case"]["input"]), item["case"]["expected"])


if __name__ == "__main__":
    unittest.main()
