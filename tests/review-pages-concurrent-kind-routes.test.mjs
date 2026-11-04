// Two kind routes of MOD-review-pages loaded at once both draw: #arc shows the decisions and the module files, so the page imports both routes' own file, flow.mjs,
// concurrently (the live app's foldersOf asks both routes for their folders together). WebKit resolved the second concurrent import() of flow.mjs before the module
// had run, so the route of the module files read flow.mjs's SERVICES uninitialised and the page showed "Cannot access 'SERVICES' before initialization.". Every kind
// route of routes.mjs now takes flow.mjs from the first import, which every route awaits.
// Run: node --test tests/review-pages-concurrent-kind-routes.test.mjs
//
// Module: MOD-review-pages
// Guards: UC-022; UC-023
// Level: unit
//
// Node's V8 does not resolve a second concurrent import() before the module has run, so the failure cannot be shown by importing the real flow.mjs twice. The test
// therefore stands in for WebKit at the one place it differs: a module hook (node:module's registerHooks) answers each import() of ./flow.mjs that routes.mjs makes with
// a module of its own. The first is the route's file as it is once it has run, after a top-level await, as the real file awaits its dependencies; every later one is
// what WebKit handed the second import, a flow.mjs whose reviewRoute meets a constant not yet initialised and throws that ReferenceError. The routes, their heads and
// how they load are routes.mjs's own, unchanged. The test states its input and expected result in its own text; it reads none from the SPEC, a use case or an
// architecture file. The counter-proof (routes.mjs with each route importing flow.mjs for itself, as before the fix) is recorded in the pull request.

import assert from "node:assert/strict";
import test from "node:test";
import { registerHooks } from "node:module";

const ROUTES = new URL("../src/review-pages/routes.mjs", import.meta.url).href;
const FLOW = new URL("../src/review-pages/flow.mjs", import.meta.url).href;
const UNINITIALISED = "Cannot access 'SERVICES' before initialization.";

// Each import() of ./flow.mjs that routes.mjs makes, numbered in the order it is made.
let imports = 0;
registerHooks({
  resolve(specifier, context, next) {
    if (specifier !== "./flow.mjs" || context.parentURL !== ROUTES) return next(specifier, context);
    imports += 1;
    return { url: `${FLOW}?import=${imports}`, shortCircuit: true };
  },
  load(url, context, next) {
    if (!url.startsWith(`${FLOW}?import=`)) return next(url, context);
    const first = new URL(url).searchParams.get("import") === "1";
    const source = first
      ? "await new Promise((resolve) => setTimeout(resolve, 10));\n"
        + "export const reviewRoute = (kind) => ({ name: kind.route, async render(target) { target.drawn = kind.route; }, subject: () => null });\n"
      : `export const reviewRoute = () => { throw new ReferenceError(${JSON.stringify(UNINITIALISED)}); };\n`;
    return { format: "module", source, shortCircuit: true };
  },
});

const { routes } = await import(ROUTES);

// TST-1401001 · level: unit · module: MOD-review-pages
// guards: UC-022; UC-023
// given: the routes of routes.mjs, each importing flow.mjs once it is first shown; a module hook that answers the first import() of ./flow.mjs with the route's file after a top-level await of 10 ms, and every later one with a flow.mjs not yet run, whose reviewRoute throws ReferenceError "Cannot access 'SERVICES' before initialization." (what WebKit handed the second of two concurrent imports)
// input: the routes `decision` and `module` rendered at once, as #arc loads them, each into a target of its own
// expect: known positive: routes.mjs made two import() calls of ./flow.mjs, so the second concurrent import is the one WebKit resolved early; both renders fulfil; the decision's target is drawn "decision" and the module's "module". Counter-proof: with each route importing flow.mjs for itself (routes.mjs before the fix), the render of `module` rejects with that ReferenceError and its target stays undrawn
test("TST-1401001 the decisions and the module files loaded at once both draw, though a second concurrent import of flow.mjs is resolved before it has run", async () => {
  const decision = routes.find((route) => route.name === "decision");
  const module = routes.find((route) => route.name === "module");
  assert.ok(decision && module, "routes.mjs serves the routes decision and module");
  const targets = { decision: {}, module: {} };
  const outcomes = await Promise.allSettled([decision.render(targets.decision, {}, {}), module.render(targets.module, {}, {})]);
  assert.equal(imports, 2, "known positive: each route made its own import() of ./flow.mjs, the second while the first had not run");
  assert.deepEqual(outcomes.map((outcome) => (outcome.status === "fulfilled" ? "fulfilled" : `rejected: ${outcome.reason?.message}`)), ["fulfilled", "fulfilled"]);
  assert.deepEqual([targets.decision.drawn, targets.module.drawn], ["decision", "module"]);
});
