// Release test of UC-046 See what goes on in the instance, for the requirement DOCUMENTS ARE REVIEWED AND EDITED UNDER DOCS, which no release test guarded: the menu of the main page opens the page under docs/, and a document is reviewed and edited there.
// Run: node --test tests/release-uc-046-documents-under-docs.test.mjs
//
// Module: MOD-main-page
// Guards: DOCUMENTS ARE REVIEWED AND EDITED UNDER DOCS; UC-046
// Level: release
//
// Written by developer-sonnet-k (ITM-1062), who built none of UC-046's items (RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER; no commit of src/main-page/ or src/progress-measures/ carries the trailer `Agent-M-Participant: developer-sonnet-k`; known
// positive: ITM-1190's commit carries developer-opus-e's), from the SPEC's requirement and its check and from UC-046 step 2 ("each entry opens the page under `docs/` where that stage's work is reviewed and done"). The review page is the real app
// (src/site-frame/dashboard-app.mjs) loaded by tests/app-harness.mjs over its fake of GitHub, which keeps a repository's files and takes a commit as the real server does; it sets the globals of a page that tests/uc-046-harness.mjs' start page
// sets otherwise, so that this case has a file of its own. Reading the text leaves open, which the case states:
//   - "Documents are reviewed and edited on the page under docs/ of the instance's Pages site" is read of the page docs/index.html: it lists the use cases with their status; the page of a use case accepts it by a commit that adds its approval record and
//     offers an editor with a live preview and Save, which writes nothing while it is only shown.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { repoServer, openDashboard, writeRequests } from "./app-harness.mjs";
import { shelf } from "./uc-046-harness.mjs";

const text = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

// TST-1062104 · level: release · module: system
// guards: DOCUMENTS ARE REVIEWED AND EDITED UNDER DOCS; UC-046
// given: the instance's site with its main page at the root (index.html) and its review page under docs/ (docs/index.html); the instance's repository holds four use cases, UC-001 to UC-003 accepted and UC-004 open
// input: the visitor follows the link the main page's menu gives for Use cases (docs/index.html#use-cases); reads the list; opens UC-004; opens its editor; and, on the use case's page, presses Accept
// expect: the root page is the main page (data-page="main") and docs/index.html another page, the review page, which loads the dashboard app; the link the main page's menu gives for Use cases is docs/index.html#use-cases; the page there lists UC-001 to UC-004, UC-004 open and the others accepted, and offers Accept ticked; the page of UC-004 offers Accept, Reject and Edit (a link to #use-case/id=UC-004/edit=1); the editor holds the file's text with a live preview and a Save, and nothing was written until now; Accept makes one commit that adds the one file docs/approvals/UC-004-<the first twelve digits of the text's blob>.md, which names docs/use-cases/UC-004-fourth.md
// Planted fault: the page under docs/ not the review page (the script tag of docs/index.html loading ../src/site-frame/start.mjs in place of ../src/site-frame/dashboard-app.mjs) fails the case at the page that loads the dashboard app; the menu's Use cases entry not leading under docs/ (`linkOf` of src/site-frame/menu.mjs answering `${key}` for the main page) fails it at the link.
test("TST-1062104: DOCUMENTS ARE REVIEWED AND EDITED UNDER DOCS a document is reviewed, accepted and edited on the page under docs/ that the main page's menu opens", async () => {
  const root = text("index.html"), review = text("docs/index.html");
  assert.match(root, /<script type="module" src="src\/site-frame\/start\.mjs" data-page="main" data-views="main-page"><\/script>/, "the root page is the main page");
  assert.match(review, /<script type="module" src="\.\.\/src\/site-frame\/dashboard-app\.mjs"/, "the page under docs/ is the review page");
  const { menuOf } = await import("../src/site-frame/index.mjs");
  assert.equal(menuOf("main", []).find((entry) => entry.key === "use-cases").href, "docs/index.html#use-cases", "the main page's Use cases opens the page under docs/");
  const srv = await repoServer({ files: await shelf({ declared: false }) });
  const list = await openDashboard({ server: srv, hash: "#use-cases" });
  const rows = [...list.main().matchAll(/<a href="#use-case\/id=(UC-\d{3})">[^<]*<\/a><\/td><td>[^<]*<\/td><td><span class="badge b-([a-z]+)">/g)].map((m) => [m[1], m[2]]);
  assert.deepEqual(Object.fromEntries(rows), { "UC-001": "accepted", "UC-002": "accepted", "UC-003": "accepted", "UC-004": "open" });
  assert.match(list.main(), /Accept ticked/);
  const one = await openDashboard({ server: srv, hash: "#use-case/id=UC-004" });
  assert.match(one.main(), /<button class="btn accept" type="button">Accept<\/button>/);
  assert.match(one.main(), /<button class="btn reject" type="button">Reject<\/button>/);
  assert.match(one.main(), /<a class="edit-link" href="#use-case\/id=UC-004\/edit=1">Edit<\/a>/);
  const editor = await openDashboard({ server: srv, hash: "#use-case/id=UC-004/edit=1" });
  assert.match(editor.main(), /<h2>Edit UC-004<\/h2>/);
  assert.match(editor.main(), /<textarea value="---\nid: UC-004\n/, "the editor holds the file's text");
  assert.match(editor.main(), /<div class="preview">/, "with a live preview");
  assert.match(editor.main(), /<button class="btn" type="button">Save<\/button>/);
  assert.deepEqual(writeRequests(srv), [], "nothing was written before the click");
  const accepting = await openDashboard({ server: srv, hash: "#use-case/id=UC-004" });
  await accepting.click("button.accept");
  assert.equal(srv.writes.length, 1, "one commit");
  const blob12 = /blob ([0-9a-f]{12})/.exec(one.main())[1];
  assert.deepEqual(Object.keys(srv.writes[0].files), [`docs/approvals/UC-004-${blob12}.md`], "the one file is UC-004's approval record");
  assert.match(srv.writes[0].files[`docs/approvals/UC-004-${blob12}.md`], /file: docs\/use-cases\/UC-004-fourth\.md/);
});
