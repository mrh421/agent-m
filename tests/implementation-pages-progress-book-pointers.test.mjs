// The folded "What is this?" of each panel of the route `progress` points to a chapter of the book (UC-035: "Each chart and panel carries a folded What is this? ... It points to book ch. 7 or
// ch. 15"). The panels are the `section.panel`s of the route: Gates, Blocked, Who works on what, and No team yet. The pointer names the chapter only; the page head is no panel.
// Run: node --test tests/implementation-pages-progress-book-pointers.test.mjs
//
// Module: MOD-implementation-pages
// Guards: EVERY STEP EXPLAINS ITSELF; UC-035
// Level: unit
//
// Reading taken: the panels are the parts `data-part="gates"`, `data-part="blocked"`, `data-part="who"` and `data-part="teams"`, the last drawn for a model with sprints and no role assignment.
// Counter-proof, recorded in the pull request: with the pointer taken out of one panel's explanation, that panel's case fails.

import test from "node:test";
import assert from "node:assert/strict";
import { render, part, productFiles } from "./implementation-pages-sprints.mjs";

const explanationOf = (html, marker) => (part(html, marker).match(/<details class="explain"><summary>What is this\?<\/summary>([\s\S]*?)<\/details>/) ?? [])[1] ?? "";
const pointsToBook = /book ch\. (7|15)\b/;

const pointsIn = async (name) => {
  const page = await render("progress");
  try {
    const html = page.html();
    assert.match(explanationOf(html, 'data-team="team1"'), pointsToBook, "known positive: the sprint's explanation points to a chapter");
    assert.ok(explanationOf(html, `data-part="${name}"`).length > 0, `${name} carries an explanation`);
    assert.match(explanationOf(html, `data-part="${name}"`), pointsToBook);
  } finally { page.done(); }
};

// TST-1340001 · level: unit · module: MOD-implementation-pages
// guards: EVERY STEP EXPLAINS ITSELF; UC-035
// given: the Scrum product of two teams with its fixture of running sprints and gates
// input: the route progress's render
// expect: the folded "What is this?" of the panel Gates names book ch. 7 or ch. 15
test("TST-1340001 #progress — the explanation of the panel gates points to book ch. 7 or ch. 15", () => pointsIn("gates"));

// TST-1340002 · level: unit · module: MOD-implementation-pages
// guards: EVERY STEP EXPLAINS ITSELF; UC-035
// given: the Scrum product of two teams with its fixture of running sprints and gates
// input: the route progress's render
// expect: the folded "What is this?" of the panel Blocked names book ch. 7 or ch. 15
test("TST-1340002 #progress — the explanation of the panel blocked points to book ch. 7 or ch. 15", () => pointsIn("blocked"));

// TST-1340003 · level: unit · module: MOD-implementation-pages
// guards: EVERY STEP EXPLAINS ITSELF; UC-035
// given: the Scrum product of two teams with its fixture of running sprints and gates
// input: the route progress's render
// expect: the folded "What is this?" of the panel Who works on what names book ch. 7 or ch. 15
test("TST-1340003 #progress — the explanation of the panel who points to book ch. 7 or ch. 15", () => pointsIn("who"));

// TST-1340004 · level: unit · module: MOD-implementation-pages
// guards: EVERY STEP EXPLAINS ITSELF; UC-035
// given: a product whose model works in sprints and whose role assignments and sprints name no team
// input: the route progress's render
// expect: the folded "What is this?" of the panel No team yet names book ch. 7 or ch. 15
test("TST-1340004 #progress — the explanation of the panel No team yet points to book ch. 7 or ch. 15", async () => {
  const files = productFiles();
  for (const path of Object.keys(files)) if (/^docs\/(role-assignments|backlog\/sprints|jobs)\//.test(path)) delete files[path];
  const page = await render("progress", {}, { files });
  try {
    const html = page.html();
    assert.match(html, /No team yet/, "known positive: the panel is drawn");
    assert.match(explanationOf(html, 'data-part="teams"'), pointsToBook);
  } finally { page.done(); }
});
