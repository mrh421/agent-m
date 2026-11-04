// The live review pages (src/site-frame/dashboard-app.mjs, which MOD-site-frame takes over) show a page that cannot be drawn as a fault of the page in plain words: what
// happened and what the person can do — reload the page, and report it if it happens again —, with the error's message below that text, not in its place. akmaier's
// report of the live site: the Architecture page showed only the menu and "Cannot access 'SERVICES' before initialization." — "This is not very useful and the user
// does not understand this. … It should say so."
// Run: node --test tests/site-frame-dashboard-page-fault.test.mjs
//
// Module: MOD-site-frame
// Guards: UC-022; UC-023
// Level: unit
//
// The real dashboard runs in tests/app-harness.mjs against its fake GitHub. The failure the live site showed is made where it arose: a module hook (node:module's
// registerHooks) answers MOD-review-pages' import of its route file flow.mjs with one whose reviewRoute throws that ReferenceError, so that every kind route of the
// review pages cannot be drawn; every other module is the real one. A host's failure is no fault of the page: the counter-proof of TST-1401004 shows that it is still
// named as the failed read it is. Each test states its input and expected result in its own text; none reads one from the SPEC, a use case or an architecture file.
// The counter-proofs (the app as it was) are recorded in the pull request.

import assert from "node:assert/strict";
import test from "node:test";
import { registerHooks } from "node:module";
import { openDashboard, repoServer } from "./app-harness.mjs";

const ROUTES = new URL("../src/review-pages/routes.mjs", import.meta.url).href;
const FLOW = new URL("../src/review-pages/flow.mjs", import.meta.url).href;
const UNINITIALISED = "Cannot access 'SERVICES' before initialization.";
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === "./flow.mjs" && context.parentURL === ROUTES) return { url: `${FLOW}?uninitialised`, shortCircuit: true };
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url !== `${FLOW}?uninitialised`) return next(url, context);
    return { format: "module", shortCircuit: true, source: `export const reviewRoute = () => { throw new ReferenceError(${JSON.stringify(UNINITIALISED)}); };\n` };
  },
});

const FILES = { "README.md": "# Fixture\n", "SPEC.md": "# Fixture\n\n## Rules\n\n**A RULE** *(Source)*\nA rule.\n*Check:* `tests/rule.test.mjs`\n" };
// The fault of the page, as <main> holds it: the plain words first, the message below them.
const FAULT = "<div class=\"page-fault\"><p class=\"page-fault-words\">Something went wrong while this page was being drawn, so it cannot be shown. Reload the page to try again. "
  + "If it happens again, report it, together with the message below.</p>"
  + `<p class="problem">This page could not be drawn: ${UNINITIALISED}</p></div>`;

// TST-1401003 · level: unit · module: MOD-site-frame
// guards: UC-022; UC-023
// given: the live dashboard of the instance with a token, opened at #settings, whose review pages' route file flow.mjs throws the ReferenceError "Cannot access 'SERVICES' before initialization." when a kind route is made from it
// input: the address changes to #arc, the Architecture entry of the menu
// expect: <main> holds exactly the fault of the page: <div class="page-fault"> with first <p class="page-fault-words"> "Something went wrong while this page was being drawn, so it cannot be shown. Reload the page to try again. If it happens again, report it, together with the message below." and below it <p class="problem"> "This page could not be drawn: Cannot access 'SERVICES' before initialization.". Counter-proof: the app as it was shows only <p class="warn">Cannot access 'SERVICES' before initialization.</p>
test("TST-1401003 the Architecture page that cannot be drawn says in plain words what happened and what to do, with the message below", async () => {
  const server = await repoServer({ files: FILES });
  const page = await openDashboard({ server, hash: "#settings" });
  assert.doesNotMatch(page.main(), /page-fault|could not be drawn/, "known positive: #settings is drawn");
  await page.go("#arc");
  assert.equal(page.main(), FAULT);
});

// TST-1401004 · level: unit · module: MOD-site-frame
// guards: UC-022; UC-023
// given: the same dashboard and route file; and, for the counter-proof, a fake GitHub that answers every request for the instance with 404
// input: the dashboard opened at #arc directly, so that its first load meets the failure; then the dashboard opened at #trace, a page whose first load asks no review route, against a server that answers every request for the instance with 404
// expect: <main> holds exactly the fault of the page of TST-1401003, plain words first and "This page could not be drawn: Cannot access 'SERVICES' before initialization." below them, and no "Could not read". Counter-proof: a host's failure is still named as the failed read it is — "Could not read akmaier/agent-m @ main:" — and holds no fault of the page; the app as it was shows the ReferenceError as "Could not read akmaier/agent-m @ main: Cannot access 'SERVICES' before initialization."
test("TST-1401004 the Architecture page opened directly says the same, and a failed read of the branch is still named as one", async () => {
  const page = await openDashboard({ server: await repoServer({ files: FILES }), hash: "#arc" });
  assert.equal(page.main(), FAULT);
  const notFound = (url) => (url.origin === "https://api.github.com" && url.pathname.startsWith("/repos/akmaier/agent-m")
    ? new Response(JSON.stringify({ message: "Not Found" }), { status: 404, headers: { "Content-Type": "application/json" } }) : null);
  const unread = await openDashboard({ server: await repoServer({ files: FILES, handlers: [notFound] }), hash: "#trace" });
  assert.match(unread.main(), /Could not read akmaier\/agent-m @ main:/);
  assert.doesNotMatch(unread.main(), /page-fault/);
});
