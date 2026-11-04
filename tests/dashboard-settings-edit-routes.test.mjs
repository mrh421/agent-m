// The live dashboard's ways from the Settings page to the pages where a repository setting is kept.
// Run: node --test tests/dashboard-settings-edit-routes.test.mjs
//
// Module: MOD-site-frame
// Level: component
// Guards: UC-042; UC-037; EVERY SETTING IS REACHED FROM ONE PAGE

import test from "node:test";
import assert from "node:assert/strict";
import { repoServer, openDashboard, richDocument } from "./app-harness.mjs";

// The text of <main>, without its tags.
const textOf = (page) => page.main().replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
// What the dashboard draws for an address no route answers: the use cases.
const USE_CASES = /Draft use cases/;

// Each line of the Settings page's repository sections, in the order the page draws them — the instance's, then the product's (here the
// instance itself) —, with the address its Edit leads to and what the page there shows.
const EDITS = [
  ["Participants", "#participants", /Participants/],
  ["Source library", "#library", /Library/],
  ["Process models", "#models", /Process models/],
  ["Instance resources", "#resources/product=", /Instance resources/],
  ["Process model", "#process", /Process model/],
  ["Role assignments", "#roles", /Roles/],
  ["Definition of Done", "#process", /Process model/],
  ["Test schedule", "#schedule", /Schedule/],
  ["Linked sources", "#sources", /Requirement sources/],
  ["Product resources", "#resources", /Resources/],
];

// TST-2026310201 · level: component · module: MOD-site-frame
// guards: UC-042; UC-037; EVERY SETTING IS REACHED FROM ONE PAGE
// given: the live dashboard of the instance, with a stored GitHub token, showing #settings.
// input: the person clicks each repository setting's Edit, the product section's Requirement sources and the mailbox line's Connect a mailbox, and the dashboard follows the address it writes.
// expect: each click writes the address of the route where that setting is kept, and that route draws its own page there, never the use cases.
test("TST-2026310201: every Edit on the Settings page leads to the page where its setting is kept", async () => {
  const server = await repoServer({ files: {} });
  const page = await openDashboard({ server, hash: "#uc" });
  const main = richDocument().byId("main");
  await page.go("#settings");
  assert.equal(main.querySelectorAll(".settings-repository-setting-edit").length, EDITS.length, "the Settings page draws one Edit for each repository setting");
  const clicks = [...EDITS.map(([title, hash, shown], at) => ({ title, hash, shown, button: () => main.querySelectorAll(".settings-repository-setting-edit")[at] })),
    { title: "Requirement sources", hash: "#sources", shown: /Requirement sources/, button: () => main.querySelector(".settings-product-sources") },
    { title: "Mailbox", hash: "#mailbox", shown: /Connect a mailbox/, button: () => main.querySelector(".mailbox-setting-open") }];
  for (const { title, hash, shown, button } of clicks) {
    await page.go("#settings");
    await button().fire("click");
    assert.equal(globalThis.location.hash, hash, `failure node: the Edit of ${title} writes ${hash} into the address (Settings' go in dashboard-app.mjs)`);
    await page.go(hash);
    const drawn = textOf(page);
    assert.doesNotMatch(drawn, USE_CASES, `failure node: the router of dashboard-app.mjs draws ${hash}, not the use cases`);
    assert.match(drawn, shown, `${hash} draws the page of ${title}`);
  }
});

// TST-2026310202 · level: component · module: MOD-site-frame
// guards: UC-042; UC-037; EVERY SETTING IS REACHED FROM ONE PAGE
// given: the live dashboard of the instance, with a stored GitHub token.
// input: a page load at #participants, #library, #resources/product=, #sources and #mailbox, each opened directly.
// expect: each address draws MOD-settings-pages' page of that route, never the use cases.
test("TST-2026310202: the settings pages' routes open directly on the live dashboard", async () => {
  for (const [hash, shown] of [["#participants", /Participants/], ["#library", /Library/], ["#resources/product=", /Instance resources/], ["#sources", /Requirement sources/], ["#mailbox", /Connect a mailbox/]]) {
    const server = await repoServer({ files: {} });
    const page = await openDashboard({ server, hash });
    const drawn = textOf(page);
    assert.doesNotMatch(drawn, USE_CASES, `failure node: the router of dashboard-app.mjs draws ${hash}, not the use cases`);
    assert.match(drawn, shown, `${hash} draws its page`);
  }
});

// Every route a page of MOD-settings-pages hands to its context's `go` (src/settings-pages/*.mjs), with the page of the live dashboard it is handed
// from: [the page's address, its route, the route and parameters it hands to go, the address go writes, what that address draws]. The Edit lines are
// TST-2026310201's; `main` with a product, which opens the product's own dashboard by the page's query, is checked after them.
const PRODUCT = "https://github.com/fixture/product";
const HANDED = [
  ["#settings", "settings", "sources", {}, "#sources", /Requirement sources/],
  ["#settings", "settings", "mailbox", {}, "#mailbox", /Connect a mailbox/],
  ["#settings", "settings", "endpoints", {}, "#endpoints", /Configure a model endpoint/],
  ["#settings", "settings", "endpoints", { name: "campus" }, "#endpoints/campus", /Configure a model endpoint/],
  ["#settings", "settings", "bridge", {}, "#bridge", /Connect a Bridge/],
  ["#settings", "settings", "bridge", { name: "lab" }, "#bridge", /Connect a Bridge/],
  ["#settings", "settings", "add-product", {}, "#add", /Add a product/],
  ["#settings", "settings", "add-product", { address: PRODUCT }, `#add/${encodeURIComponent(PRODUCT)}`, /Add a product/],
  ["#endpoints", "endpoints", "bridge", {}, "#bridge", /Connect a Bridge/],
  ["#endpoints", "endpoints", "bridge", { name: "lab" }, "#bridge", /Connect a Bridge/],
  ["#setup", "setup", "settings", {}, "#settings", /Endpoints & Agents/],
  ["#setup", "setup", "add-product", {}, "#add", /Add a product/],
  ["#setup", "setup", "main", {}, "#uc", USE_CASES],
  ["#library", "library", "library", {}, "#library", /Register source/],
  ["#library", "library", "library", { source: "SRC-x" }, "#library/source=SRC-x", /The library holds no source SRC-x/],
  ["#library", "library", "sources", {}, "#sources", /Requirement sources/],
  ["#sources", "sources", "library", {}, "#library", /Register source/],
  ["#resources/product=", "resources", "participants", { type: "model endpoint", address: "https://models.example.test/v1" },
    "#participants/type=model%20endpoint/address=https%3A%2F%2Fmodels.example.test%2Fv1", /Add participant/],
  ["#mailbox", "mailbox", "bridge", {}, "#bridge", /Connect a Bridge/],
];

// The context the live dashboard renders the route `name` of MOD-settings-pages with, while `run` shows it: the view's route, which the app loads by
// the same address, records it.
async function contextOf(name, run) {
  const { routes } = await import("../src/settings-pages/routes.mjs");
  const route = routes.find((candidate) => candidate.name === name);
  const render = route.render;
  let given = null;
  route.render = (target, context, params) => { given = context; return render(target, context, params); };
  try {
    await run();
  } finally {
    route.render = render;
  }
  assert.ok(given, `the live dashboard renders the route ${name}`);
  return given;
}

// TST-2026310203 · level: component · module: MOD-site-frame
// guards: UC-042; UC-001; UC-003; UC-004; UC-014; UC-015; UC-017; UC-037; UC-040; UC-044; EVERY SETTING IS REACHED FROM ONE PAGE
// given: the live dashboard of the instance, with a stored GitHub token, showing each page of MOD-settings-pages that hands a route to its context's go.
// input: each route and parameters the page's own file hands to go, handed to the go the dashboard rendered that page with; the dashboard follows the address it writes.
// expect: go writes the address of that route, and that address draws the route's page — the use cases only for `main`, the instance's own start page; `main` with a product opens the product's dashboard by the page's query.
test("TST-2026310203: every route a settings page hands to go reaches a drawn page", async () => {
  const server = await repoServer({ files: {} });
  const page = await openDashboard({ server, hash: "#uc" });
  richDocument();
  for (const [from, name, route, params, hash, shown] of HANDED) {
    const context = await contextOf(name, () => page.go(from));
    context.go(route, params);
    assert.equal(globalThis.location.hash, hash, `failure node: go of ${name} on ${from} writes ${hash} for ${route} ${JSON.stringify(params)}`);
    await page.go(hash);
    const drawn = textOf(page);
    if (shown !== USE_CASES) assert.doesNotMatch(drawn, USE_CASES, `failure node: the router of dashboard-app.mjs draws ${hash}, not the use cases`);
    assert.match(drawn, shown, `${hash} draws the page of ${route}`);
  }
  for (const [from, name] of [["#settings", "settings"], ["#add", "add-product"]]) {
    const context = await contextOf(name, () => page.go(from));
    globalThis.location.search = "";
    context.go("main", { product: PRODUCT });
    assert.equal(globalThis.location.search, `repo=${encodeURIComponent("fixture/product")}`, `go of ${name} opens the product's own dashboard`);
  }
});
