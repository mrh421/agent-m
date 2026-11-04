# Module: MOD-work-plans
# Module: MOD-implementation-pages
# Guards: THE IMPLEMENTATION PLAN LIVES IN THE PRODUCT REPOSITORY; UC-045
# Level: release
"""SPEC section 13 - the check named tests/test_plan_layout.py.

A fixture product keeps the six steps of a plan and their order as Markdown. The plan is read by the facts of the plan page
(MOD-progress-measures' productFacts, which the route plan of MOD-implementation-pages draws), from the product's repository
through its host: from docs/plan/ it is found; the same files kept anywhere else are not. Written by developer-sonnet-j
(ITM-1061), who implemented none of the plan's code.
"""
import json
import unittest

from jsrun import js

JS_FACTS = """
const { createHash } = process.getBuiltinModule("node:crypto");
const text = (...lines) => `${lines.join("\\n")}\\n`;
const blobOf = (body) => createHash("sha1").update(`blob ${Buffer.byteLength(body)}\\0${body}`).digest("hex");
const step = (n) => text("---", `id: ITM-00${n}`, `title: Step ${n}`, "level: module", "realises:", "  - UC-001", "modules:", "  - MOD-a", "tests:", "  - unit",
  "origin:", "  - UC-001", "---", `# ITM-00${n} Step ${n}`);
const order = text("## Order", "", "| Step | Phase |", "| --- | --- |", ...[1, 2, 3, 4, 5, 6].map((n) => `| ITM-00${n} | Implementation |`));
const plan = (folder) => ({ [`${folder}/order.md`]: order, ...Object.fromEntries([1, 2, 3, 4, 5, 6].map((n) => [`${folder}/ITM-00${n}-step-${n}.md`, step(n)])) });

function snapshotOf(files, web) {
  return { repository: { server: "github", path: web.slice(19), web }, ref: "main", commit: "a".repeat(40), paths: Object.keys(files),
    blob: (path) => (Object.hasOwn(files, path) ? blobOf(files[path]) : null), read: async (path) => (Object.hasOwn(files, path) ? files[path] : null), readMany: async () => {} };
}

async function planOf(folder) {
  const product = { "SPEC.md": "# Fixture\\n", ...plan(folder) };
  const host = { async repositoryInfo() { return { defaultBranch: "main", visibility: "public", canWrite: true, archived: false, description: "" }; },
    async readSnapshot() { return snapshotOf(product, "https://github.com/alice/product"); }, async listPullRequests() { return []; } };
  const instance = snapshotOf({ "SPEC.md": "# Instance\\n" }, "https://github.com/akmaier/agent-m");
  const facts = await progressMeasures.productFacts(host, instance, async () => instance, new Date("2026-11-01T10:00:00Z"), { scope: "build" });
  return { steps: facts.plan.items.map((item) => item.id), order: facts.plan.order === null ? null : facts.plan.order.sections.flatMap((s) => s.rows ?? []).map((row) => row.cells.Step),
    states: facts.plan.states.map((state) => state.item) };
}
"""


def plan_in(folder: str) -> dict:
    return js(JS_FACTS + "return await planOf(%s);" % json.dumps(folder))


class TestPlanLayout(unittest.TestCase):
    # TST-1061301 · level: release · module: system
    # guards: THE IMPLEMENTATION PLAN LIVES IN THE PRODUCT REPOSITORY; UC-045
    # given: a fixture product whose repository keeps a plan of six steps and its order as Markdown under docs/plan/
    # input: the facts of the plan page for the product
    # expect: the six steps are found in the order of docs/plan/order.md, each with a derived state
    def test_a_plan_under_docs_plan_is_found(self):
        found = plan_in("docs/plan")
        ids = [f"ITM-00{n}" for n in range(1, 7)]
        self.assertEqual(found["steps"], ids)
        self.assertEqual(found["order"], ids)
        self.assertEqual(found["states"], ids)

    # TST-1061302 · level: release · module: system
    # guards: THE IMPLEMENTATION PLAN LIVES IN THE PRODUCT REPOSITORY; UC-045
    # given: the same files kept under docs/planning/, under plan/ and under docs/plans/ of the product
    # input: the facts of the plan page for each
    # expect: counter-proof of TST-1061301 - no step, no order and no state is found
    def test_a_plan_written_anywhere_else_is_not_found(self):
        for folder in ("docs/planning", "plan", "docs/plans"):
            with self.subTest(folder=folder):
                self.assertEqual(plan_in(folder), {"steps": [], "order": None, "states": []})


if __name__ == "__main__":
    unittest.main()
