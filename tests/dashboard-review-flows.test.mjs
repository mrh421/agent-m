// The flows the dashboard already carries out, one test per main and alternative flow of UC-001, UC-006 and UC-008 and of the
// built parts of UC-014 (Finish setting up) and UC-042 (browser settings, export and import, pseudonymisation, collaborators).
// Characterisation tests: they pin what the dashboard does today. The real app (the harness's APP_FILE) runs in
// tests/app-harness.mjs against GitHub and GitLab fakes that record
// every request; every write is started by a click on the button that names it, with the event a person's click carries
// (isTrusted), and each write test has a counter-proof with a click a script makes. Run: node --test tests/*.test.mjs
//
// Module: MOD-settings-pages
// Guards: UC-001; UC-006; UC-008; UC-014; UC-042; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK; ONE CLICK PER DECISION; EVERY STEP EXPLAINS ITSELF; AN APPROVAL NAMES THE EXACT TEXT; STATUS IS DERIVED FROM THE RECORDS; EDITS ARE PREPARED ON THE DASHBOARD; A SAVE IS REFUSED WHEN THE TEXT CHANGED MEANWHILE; AN EDITED FILE KEEPS ITS IDENTIFIER; WITHOUT A TOKEN, GITHUB'S WEB INTERFACE IS THE FALLBACK; A GITLAB PRODUCT IS WRITTEN WITH A TOKEN; AN ACCEPTED SPEC CHANGE IS WRITTEN WITH ITS APPROVAL; A STALE APPROVAL IS NOT APPLIED; A QUEUE IS ACCEPTED IN ITS ORDER; SEVERAL FILES ARE ACCEPTED IN ONE CLICK; A SPEC EDIT IS SAVED AS A PROPOSAL; ADDING A PRODUCT CREATES ITS LAYOUT; THE DASHBOARD KEEPS ITS PRODUCTS IN THE BROWSER; NO PRODUCT IS NAMED IN THE INSTANCE REPOSITORY; A GITLAB PRODUCT USES A PROJECT ACCESS TOKEN; A TOKEN GOES ONLY TO THE SERVER THAT ISSUED IT; THE SHARED PAGES ORIGIN IS DISCLOSED; THE TOKEN LINK IS PREFILLED; THE REPOSITORY CHOICE IS SPELLED OUT; A BROWSER SETTING IS TESTED AND CLEARED WHERE IT IS SHOWN; A STORED SECRET IS HIDDEN UNTIL SHOWN; A CLEAR IS A REAL CLEAR; A TOKEN'S EXPIRY IS WARNED OF IN ADVANCE; AN EXPIRED TOKEN IS NAMED AND ITS RENEWAL LINKED; SETTINGS ARE EXPORTED AND IMPORTED WITH THEIR SECRETS; AN EXPORT STATES THAT IT CONTAINS SECRETS; AN EXPORT CAN BE LOCKED WITH A PASSPHRASE; A PRODUCT'S SETTINGS LIVE IN ITS REPOSITORY; SWITCHING PSEUDONYMISATION OFF STATES WHAT FOLLOWS; A PERSON IS NAMED BY ACCOUNT OR WITH CONSENT; THE JUMP HOST AND THE REMOTE SESSIONS ARE SETTINGS
// Level: component
//
// Which flows are not carried out, and the counter-proof of every test here: docs/measurements/2026-10-01_built-flows-characterised.md.

import test from "node:test";
import assert from "node:assert/strict";
import {
  repoServer, fakeCaches, openDashboard, REPO, TOKEN, richDocument, press, settle, reEsc, unesc, setting, tokenSetting,
} from "./app-harness.mjs";
import { blobSha } from "../src/text-tools/index.mjs";
import { recordText, approvalPath, reviewedRecord } from "./approval-records.mjs";
import { B_SPEC, B_P05, B_P06, B_INDEX, QD, GL, GL_ADDR, GL_TOKEN, fakeGitLab } from "./review-core.d/helpers.mjs";
import { parseAddress, connect } from "../src/repository-hosts/index.mjs";
import { reviewLayoutCommit } from "../src/artifact-edits/index.mjs";
import { readDocument } from "../src/documents/index.mjs";
import { settingsSchemas } from "../src/personal-data/index.mjs";

const TRUSTED = { isTrusted: true }, SCRIPTED = { isTrusted: false };
const API = "https://api.github.com";
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "Content-Type": "application/json" } });
const GL_TOKEN_KEY = `gitlab-token:${new URL(GL_ADDR).host}${new URL(GL_ADDR).pathname}`;

// richDocument and press — what the harness's document lacks for these flows, and a person's click on what it adds — are in
// tests/app-harness.mjs, beside the harness, so that other tests of the dashboard's editor use them too.

// A checkbox ticked (or unticked) by a person.
async function tick(server, el, on = true) {
  el.checked = on;
  el.fire("change", {});
  await settle(server);
}
const inMain = (sel) => globalThis.document.getElementById("main").querySelector(sel);
const writesOf = (requests) => requests.filter((r) => /^write /.test(r));

// GitHub's contents API in its JSON form — what the write path asks for a file's current blob before it writes over it
// (A SAVE IS REFUSED WHEN THE TEXT CHANGED MEANWHILE); the harness serves the raw form only.
const contentsJson = (srv, repo) => (url, init) => {
  if (init.method !== "GET" || url.origin !== API || init.headers?.Accept !== "application/vnd.github+json") return undefined;
  const m = new RegExp(`^/repos/${reEsc(repo)}/contents/(.+)$`).exec(url.pathname);
  if (!m) return undefined;
  const sha = srv().shas[m[1].split("/").map(decodeURIComponent).join("/")];
  return sha ? json({ sha }) : json({ message: "Not Found" }, 404);
};
// Every request's method, address and Authorization header, in order (answers nothing itself).
const recorder = (seen) => (url, init) => { seen.push({ method: init.method, url: url.href, auth: init.headers?.Authorization ?? null }); };

// The instance's repository on GitHub: the harness's server, with the contents API and a record of every request.
async function instance({ files, history = [], handlers = [] }) {
  const seen = [];
  let srv = null;
  srv = await repoServer({ files, history, handlers: [recorder(seen), ...handlers, contentsJson(() => srv, REPO)] });
  srv.seen = seen;
  return srv;
}

// ---------------------------------------------------------------- the instance's files

const ucText = (id, title, step) => `---\nid: ${id}\ntitle: ${title}\narea: review\nactors:\n  - Reviewer\nrealises: []\n---\n` +
  `# ${id} ${title}\n\n## Main flow\n\n1. ${step}\n\n\`\`\`mermaid\nflowchart LR\n  R[Reviewer] --> D[Dashboard]\n\`\`\`\n`;
const UC1 = "docs/use-cases/UC-001-read-a-file.md", UC2 = "docs/use-cases/UC-002-show-the-status.md";
const UC3 = "docs/use-cases/UC-003-edit-a-file.md";
const UC3_ACCEPTED = ucText("UC-003", "Edit a file", "The reviewer edits the file.");
const QNAME = QD.split("/").pop();

// UC-001 accepted; UC-002 never accepted; UC-003 accepted in an earlier text and changed since. The SPEC and one queue: entry
// 05 replaces section 10 and creates the heading of section 11, which entry 06 replaces.
async function instanceFiles(over = {}) {
  const f = {
    "SPEC.md": B_SPEC,
    [`${QD}/index.md`]: B_INDEX, [`${QD}/05-a.md`]: B_P05, [`${QD}/05-a.begruendung.md`]: "# Why 05\n\nSection ten is out of date.\n",
    [`${QD}/06-b.md`]: B_P06, [`${QD}/entscheidungen.md`]: "# Decisions\n\nAppend-only.\n\n",
    "docs/use-cases/README.md": "# Use cases\n", "docs/approvals/README.md": "# Approval records\n",
    [UC1]: ucText("UC-001", "Read a file", "The reviewer opens the file."),
    [UC2]: ucText("UC-002", "Show the status", "The dashboard shows the status."),
    [UC3]: ucText("UC-003", "Edit a file", "The reviewer edits the file and saves it."),
    ...over,
  };
  for (const [p, t] of [[UC1, f[UC1]], [UC3, UC3_ACCEPTED]]) {
    const b = await blobSha(t);
    f[approvalPath(p === UC1 ? "UC-001" : "UC-003", b)] = recordText(reviewedRecord(p, b));
  }
  return f;
}
const ucServer = async (over = {}, handlers = []) => instance({ files: await instanceFiles(over), history: [UC3_ACCEPTED], handlers });

// ================================================================ UC-008 Review and accept a use case

// TST-474001 · level: component · module: MOD-settings-pages
// guards: UC-001; UC-006; UC-008; UC-014; UC-042; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK; ONE CLICK PER DECISION; EVERY STEP EXPLAINS ITSELF; AN APPROVAL NAMES THE EXACT TEXT; STATUS IS DERIVED FROM THE RECORDS; EDITS ARE PREPARED ON THE DASHBOARD; A SAVE IS REFUSED WHEN THE TEXT CHANGED MEANWHILE; AN EDITED FILE KEEPS ITS IDENTIFIER; WITHOUT A TOKEN, GITHUB'S WEB INTERFACE IS THE FALLBACK; A GITLAB PRODUCT IS WRITTEN WITH A TOKEN; AN ACCEPTED SPEC CHANGE IS WRITTEN WITH ITS APPROVAL; A STALE APPROVAL IS NOT APPLIED; A QUEUE IS ACCEPTED IN ITS ORDER; SEVERAL FILES ARE ACCEPTED IN ONE CLICK; A SPEC EDIT IS SAVED AS A PROPOSAL; ADDING A PRODUCT CREATES ITS LAYOUT; THE DASHBOARD KEEPS ITS PRODUCTS IN THE BROWSER; NO PRODUCT IS NAMED IN THE INSTANCE REPOSITORY; A GITLAB PRODUCT USES A PROJECT ACCESS TOKEN; A TOKEN GOES ONLY TO THE SERVER THAT ISSUED IT; THE SHARED PAGES ORIGIN IS DISCLOSED; THE TOKEN LINK IS PREFILLED; THE REPOSITORY CHOICE IS SPELLED OUT; A BROWSER SETTING IS TESTED AND CLEARED WHERE IT IS SHOWN; A STORED SECRET IS HIDDEN UNTIL SHOWN; A CLEAR IS A REAL CLEAR; A TOKEN'S EXPIRY IS WARNED OF IN ADVANCE; AN EXPIRED TOKEN IS NAMED AND ITS RENEWAL LINKED; SETTINGS ARE EXPORTED AND IMPORTED WITH THEIR SECRETS; AN EXPORT STATES THAT IT CONTAINS SECRETS; AN EXPORT CAN BE LOCKED WITH A PASSPHRASE; A PRODUCT'S SETTINGS LIVE IN ITS REPOSITORY; SWITCHING PSEUDONYMISATION OFF STATES WHAT FOLLOWS; A PERSON IS NAMED BY ACCOUNT OR WITH CONSENT; THE JUMP HOST AND THE REMOTE SESSIONS ARE SETTINGS
// given: an instance with UC-001 accepted, UC-002 never accepted, UC-003 accepted in an earlier text and changed since
// input: the dashboard opened at #uc
// expect: each row carries the badge accepted, open and changed respectively (MOD-review-pages' badges)
test("UC-008 step 1: the use cases are listed with the status derived from the records — open, accepted, changed since acceptance", async () => {
  const page = await openDashboard({ server: await ucServer(), hash: "#uc" });
  const row = (id) => page.main().split("<tr>").find((r) => r.includes(`href="#use-case/id=${id}"`));
  assert.match(row("UC-001"), /class="badge b-accepted"/);
  assert.match(row("UC-002"), /class="badge b-open"/);
  assert.match(row("UC-003"), /class="badge b-changed"/);
});

// TST-474002 · level: component · module: MOD-settings-pages
// guards: UC-001; UC-006; UC-008; UC-014; UC-042; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK; ONE CLICK PER DECISION; EVERY STEP EXPLAINS ITSELF; AN APPROVAL NAMES THE EXACT TEXT; STATUS IS DERIVED FROM THE RECORDS; EDITS ARE PREPARED ON THE DASHBOARD; A SAVE IS REFUSED WHEN THE TEXT CHANGED MEANWHILE; AN EDITED FILE KEEPS ITS IDENTIFIER; WITHOUT A TOKEN, GITHUB'S WEB INTERFACE IS THE FALLBACK; A GITLAB PRODUCT IS WRITTEN WITH A TOKEN; AN ACCEPTED SPEC CHANGE IS WRITTEN WITH ITS APPROVAL; A STALE APPROVAL IS NOT APPLIED; A QUEUE IS ACCEPTED IN ITS ORDER; SEVERAL FILES ARE ACCEPTED IN ONE CLICK; A SPEC EDIT IS SAVED AS A PROPOSAL; ADDING A PRODUCT CREATES ITS LAYOUT; THE DASHBOARD KEEPS ITS PRODUCTS IN THE BROWSER; NO PRODUCT IS NAMED IN THE INSTANCE REPOSITORY; A GITLAB PRODUCT USES A PROJECT ACCESS TOKEN; A TOKEN GOES ONLY TO THE SERVER THAT ISSUED IT; THE SHARED PAGES ORIGIN IS DISCLOSED; THE TOKEN LINK IS PREFILLED; THE REPOSITORY CHOICE IS SPELLED OUT; A BROWSER SETTING IS TESTED AND CLEARED WHERE IT IS SHOWN; A STORED SECRET IS HIDDEN UNTIL SHOWN; A CLEAR IS A REAL CLEAR; A TOKEN'S EXPIRY IS WARNED OF IN ADVANCE; AN EXPIRED TOKEN IS NAMED AND ITS RENEWAL LINKED; SETTINGS ARE EXPORTED AND IMPORTED WITH THEIR SECRETS; AN EXPORT STATES THAT IT CONTAINS SECRETS; AN EXPORT CAN BE LOCKED WITH A PASSPHRASE; A PRODUCT'S SETTINGS LIVE IN ITS REPOSITORY; SWITCHING PSEUDONYMISATION OFF STATES WHAT FOLLOWS; A PERSON IS NAMED BY ACCOUNT OR WITH CONSENT; THE JUMP HOST AND THE REMOTE SESSIONS ARE SETTINGS
// given: the instance with UC-002 never accepted, the dashboard opened at #uc/UC-002 with the reviewer's token
// input: open the use case, then one click on Accept
// expect: text and diagram are shown, opening writes nothing; one commit (tree, commit, ref) with a three-line record naming the shown blob, under the reviewer's token; the page then shows UC-002 accepted
test("UC-008 main flow: a use case is shown with its text and diagram; one click on Accept commits the record naming the shown text, and the page shows it accepted", async () => {
  const srv = await ucServer();
  const page = await openDashboard({ server: srv, hash: "#uc/UC-002" });
  const html = page.main();
  assert.match(html, /<h2>UC-002 Show the status<\/h2><span class="badge b-open">open<\/span>/);
  assert.match(html, /The dashboard shows the status\./, "the text");
  assert.match(html, /<code class="language-mermaid">[^]*flowchart LR/, "the diagram, drawn by the renderer as a Mermaid block");
  assert.match(html, /<button class="btn accept" type="button">Accept<\/button>/);
  assert.deepEqual(srv.writes, [], "opening writes nothing");
  const made = await page.click(".accept");
  const blob = await blobSha(srv.files[UC2]);
  assert.equal(srv.writes.length, 1, "one commit");
  assert.deepEqual(srv.writes[0].files, { [approvalPath("UC-002", blob)]: recordText(reviewedRecord(UC2, blob)) });
  assert.equal(recordText(reviewedRecord(UC2, blob)).trim().split("\n").length, 3, "a three-line record");
  assert.match(srv.writes[0].message, /UC-002/);
  assert.deepEqual(writesOf(made), ["write tree", "write commit", "write ref"]);
  // The new head is read once to show the page again, and the head before the commit once (A PAGE LOAD READS THE REPOSITORY IN BATCHES).
  const afterWrite = made.slice(made.indexOf("write ref") + 1);
  assert.equal(afterWrite.filter((r) => r === "commit").length, 1, `the new head is read once: ${afterWrite}`);
  assert.equal(made.slice(0, made.indexOf("write tree")).filter((r) => r === "commit").length, 1, `the head is read once before the commit: ${made}`);
  // Under the reviewer's own account: every request of the commit carries the stored token.
  // GitHub's GraphQL queries are reads sent as POST — the folders a load reads its snapshot with (ITM-1266) —, no request of the commit.
  const commitRequests = srv.seen.filter((r) => r.method !== "GET" && r.url !== `${API}/graphql`);
  assert.ok(commitRequests.length === 3 && commitRequests.every((r) => r.auth === `Bearer ${TOKEN}`), JSON.stringify(commitRequests));
  // The page reads the new commit and shows the use case accepted, without an Accept.
  assert.match(page.main(), /<span class="badge b-accepted">accepted<\/span>/);
  assert.doesNotMatch(page.main(), /<button class="btn accept"/);
  assert.match(page.main(), /Accepted in commit [0-9a-f]{7}\./);
});

// TST-680207 · level: component · module: MOD-review-pages
// guards: THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK
// given: UC-002 open on its page; the list with UC-002 and UC-003 ticked
// input: a click a script makes (isTrusted false) on Accept, and on Accept ticked
// expect: no request is made and nothing is written; the person's click on Accept then commits
test("UC-008 counter-proof: a click a script makes on Accept, and on Accept ticked, writes and reads nothing", async () => {
  const srv = await ucServer();
  const page = await openDashboard({ server: srv, hash: "#uc/UC-002" });
  assert.deepEqual(await page.click(".accept", SCRIPTED), []);
  assert.deepEqual(srv.writes, []);
  await page.go("#uc");
  const boxes = globalThis.document.getElementById("main").querySelectorAll(".tick");
  for (const box of boxes) await tick(srv, box);
  assert.deepEqual(await page.click(".accept-ticked", SCRIPTED), []);
  assert.deepEqual(srv.writes, []);
  await page.click(".accept-ticked");
  assert.equal(srv.writes.length, 1, "known positive: the person's click on the same button writes");
});

// TST-474004 · level: component · module: MOD-settings-pages
// guards: UC-001; UC-006; UC-008; UC-014; UC-042; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK; ONE CLICK PER DECISION; EVERY STEP EXPLAINS ITSELF; AN APPROVAL NAMES THE EXACT TEXT; STATUS IS DERIVED FROM THE RECORDS; EDITS ARE PREPARED ON THE DASHBOARD; A SAVE IS REFUSED WHEN THE TEXT CHANGED MEANWHILE; AN EDITED FILE KEEPS ITS IDENTIFIER; WITHOUT A TOKEN, GITHUB'S WEB INTERFACE IS THE FALLBACK; A GITLAB PRODUCT IS WRITTEN WITH A TOKEN; AN ACCEPTED SPEC CHANGE IS WRITTEN WITH ITS APPROVAL; A STALE APPROVAL IS NOT APPLIED; A QUEUE IS ACCEPTED IN ITS ORDER; SEVERAL FILES ARE ACCEPTED IN ONE CLICK; A SPEC EDIT IS SAVED AS A PROPOSAL; ADDING A PRODUCT CREATES ITS LAYOUT; THE DASHBOARD KEEPS ITS PRODUCTS IN THE BROWSER; NO PRODUCT IS NAMED IN THE INSTANCE REPOSITORY; A GITLAB PRODUCT USES A PROJECT ACCESS TOKEN; A TOKEN GOES ONLY TO THE SERVER THAT ISSUED IT; THE SHARED PAGES ORIGIN IS DISCLOSED; THE TOKEN LINK IS PREFILLED; THE REPOSITORY CHOICE IS SPELLED OUT; A BROWSER SETTING IS TESTED AND CLEARED WHERE IT IS SHOWN; A STORED SECRET IS HIDDEN UNTIL SHOWN; A CLEAR IS A REAL CLEAR; A TOKEN'S EXPIRY IS WARNED OF IN ADVANCE; AN EXPIRED TOKEN IS NAMED AND ITS RENEWAL LINKED; SETTINGS ARE EXPORTED AND IMPORTED WITH THEIR SECRETS; AN EXPORT STATES THAT IT CONTAINS SECRETS; AN EXPORT CAN BE LOCKED WITH A PASSPHRASE; A PRODUCT'S SETTINGS LIVE IN ITS REPOSITORY; SWITCHING PSEUDONYMISATION OFF STATES WHAT FOLLOWS; A PERSON IS NAMED BY ACCOUNT OR WITH CONSENT; THE JUMP HOST AND THE REMOTE SESSIONS ARE SETTINGS
// given: UC-003 accepted in an earlier text and changed since
// input: the dashboard opened at #uc/UC-003
// expect: badge changed and the difference to the text its last record names, with the deleted and the added line
test("UC-008 2a: a use case changed since acceptance is shown with the difference to the text its last record names", async () => {
  const page = await openDashboard({ server: await ucServer(), hash: "#uc/UC-003" });
  assert.match(page.main(), /<h2>UC-003 Edit a file<\/h2><span class="badge b-changed">changed since acceptance<\/span>/);
  assert.match(page.main(), /<h3>Changed since it was last accepted<\/h3>/);
  assert.match(page.main(), /<span class="ddel">- 1\. The reviewer edits the file\.<\/span>/);
  assert.match(page.main(), /<span class="dadd">\+ 1\. The reviewer edits the file and saves it\.<\/span>/);
});

// TST-474005 · level: component · module: MOD-settings-pages
// guards: UC-001; UC-006; UC-008; UC-014; UC-042; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK; ONE CLICK PER DECISION; EVERY STEP EXPLAINS ITSELF; AN APPROVAL NAMES THE EXACT TEXT; STATUS IS DERIVED FROM THE RECORDS; EDITS ARE PREPARED ON THE DASHBOARD; A SAVE IS REFUSED WHEN THE TEXT CHANGED MEANWHILE; AN EDITED FILE KEEPS ITS IDENTIFIER; WITHOUT A TOKEN, GITHUB'S WEB INTERFACE IS THE FALLBACK; A GITLAB PRODUCT IS WRITTEN WITH A TOKEN; AN ACCEPTED SPEC CHANGE IS WRITTEN WITH ITS APPROVAL; A STALE APPROVAL IS NOT APPLIED; A QUEUE IS ACCEPTED IN ITS ORDER; SEVERAL FILES ARE ACCEPTED IN ONE CLICK; A SPEC EDIT IS SAVED AS A PROPOSAL; ADDING A PRODUCT CREATES ITS LAYOUT; THE DASHBOARD KEEPS ITS PRODUCTS IN THE BROWSER; NO PRODUCT IS NAMED IN THE INSTANCE REPOSITORY; A GITLAB PRODUCT USES A PROJECT ACCESS TOKEN; A TOKEN GOES ONLY TO THE SERVER THAT ISSUED IT; THE SHARED PAGES ORIGIN IS DISCLOSED; THE TOKEN LINK IS PREFILLED; THE REPOSITORY CHOICE IS SPELLED OUT; A BROWSER SETTING IS TESTED AND CLEARED WHERE IT IS SHOWN; A STORED SECRET IS HIDDEN UNTIL SHOWN; A CLEAR IS A REAL CLEAR; A TOKEN'S EXPIRY IS WARNED OF IN ADVANCE; AN EXPIRED TOKEN IS NAMED AND ITS RENEWAL LINKED; SETTINGS ARE EXPORTED AND IMPORTED WITH THEIR SECRETS; AN EXPORT STATES THAT IT CONTAINS SECRETS; AN EXPORT CAN BE LOCKED WITH A PASSPHRASE; A PRODUCT'S SETTINGS LIVE IN ITS REPOSITORY; SWITCHING PSEUDONYMISATION OFF STATES WHAT FOLLOWS; A PERSON IS NAMED BY ACCOUNT OR WITH CONSENT; THE JUMP HOST AND THE REMOTE SESSIONS ARE SETTINGS
// given: UC-001 accepted
// input: the file is edited on the server after acceptance, the page opened again
// expect: the use case shows as changed with an Accept again; no status was reset by anyone
test("UC-008 5a: a file edited after acceptance shows as changed — no status was reset by anyone", async () => {
  const srv = await ucServer();
  const page = await openDashboard({ server: srv, hash: "#uc/UC-001" });
  assert.match(page.main(), /badge b-accepted/);
  await srv.change(UC1, srv.files[UC1] + "\nOne more line.\n");
  const again = await openDashboard({ server: srv, hash: "#uc/UC-001" });
  assert.match(again.main(), /<h2>UC-001 Read a file<\/h2><span class="badge b-changed">changed since acceptance<\/span>/);
  assert.match(again.main(), /<button class="btn accept"/, "it can be accepted again");
});

// TST-474006 · level: component · module: MOD-settings-pages
// guards: UC-001; UC-006; UC-008; UC-014; UC-042; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK; ONE CLICK PER DECISION; EVERY STEP EXPLAINS ITSELF; AN APPROVAL NAMES THE EXACT TEXT; STATUS IS DERIVED FROM THE RECORDS; EDITS ARE PREPARED ON THE DASHBOARD; A SAVE IS REFUSED WHEN THE TEXT CHANGED MEANWHILE; AN EDITED FILE KEEPS ITS IDENTIFIER; WITHOUT A TOKEN, GITHUB'S WEB INTERFACE IS THE FALLBACK; A GITLAB PRODUCT IS WRITTEN WITH A TOKEN; AN ACCEPTED SPEC CHANGE IS WRITTEN WITH ITS APPROVAL; A STALE APPROVAL IS NOT APPLIED; A QUEUE IS ACCEPTED IN ITS ORDER; SEVERAL FILES ARE ACCEPTED IN ONE CLICK; A SPEC EDIT IS SAVED AS A PROPOSAL; ADDING A PRODUCT CREATES ITS LAYOUT; THE DASHBOARD KEEPS ITS PRODUCTS IN THE BROWSER; NO PRODUCT IS NAMED IN THE INSTANCE REPOSITORY; A GITLAB PRODUCT USES A PROJECT ACCESS TOKEN; A TOKEN GOES ONLY TO THE SERVER THAT ISSUED IT; THE SHARED PAGES ORIGIN IS DISCLOSED; THE TOKEN LINK IS PREFILLED; THE REPOSITORY CHOICE IS SPELLED OUT; A BROWSER SETTING IS TESTED AND CLEARED WHERE IT IS SHOWN; A STORED SECRET IS HIDDEN UNTIL SHOWN; A CLEAR IS A REAL CLEAR; A TOKEN'S EXPIRY IS WARNED OF IN ADVANCE; AN EXPIRED TOKEN IS NAMED AND ITS RENEWAL LINKED; SETTINGS ARE EXPORTED AND IMPORTED WITH THEIR SECRETS; AN EXPORT STATES THAT IT CONTAINS SECRETS; AN EXPORT CAN BE LOCKED WITH A PASSPHRASE; A PRODUCT'S SETTINGS LIVE IN ITS REPOSITORY; SWITCHING PSEUDONYMISATION OFF STATES WHAT FOLLOWS; A PERSON IS NAMED BY ACCOUNT OR WITH CONSENT; THE JUMP HOST AND THE REMOTE SESSIONS ARE SETTINGS
// given: UC-002 open
// input: open the use case, follow Edit
// expect: Edit is the link to the editor's route, #use-case/id=UC-002/edit=1; that route is shown under the heading Edit UC-002, writes nothing, and holds the file's text for the editor. The editor itself — its preview, Save, the refusals — is MOD-review-pages' own (tests/review-pages-use-cases.test.mjs), which the removed view's tests of it are kept by
test("UC-008 3a: Edit leads to the editor of the use case's route; opening it writes nothing", async () => {
  const srv = await ucServer();
  const page = await openDashboard({ server: srv, hash: "#uc/UC-002" });
  assert.match(page.main(), /<a class="edit-link" href="#use-case\/id=UC-002\/edit=1">Edit<\/a>/);
  await page.go("#use-case/id=UC-002/edit=1");
  assert.match(page.main(), /<h2>Edit UC-002<\/h2>/);
  assert.deepEqual(srv.writes, []);
});

// TST-474010 · level: component · module: MOD-settings-pages
// guards: UC-001; UC-006; UC-008; UC-014; UC-042; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK; ONE CLICK PER DECISION; EVERY STEP EXPLAINS ITSELF; AN APPROVAL NAMES THE EXACT TEXT; STATUS IS DERIVED FROM THE RECORDS; EDITS ARE PREPARED ON THE DASHBOARD; A SAVE IS REFUSED WHEN THE TEXT CHANGED MEANWHILE; AN EDITED FILE KEEPS ITS IDENTIFIER; WITHOUT A TOKEN, GITHUB'S WEB INTERFACE IS THE FALLBACK; A GITLAB PRODUCT IS WRITTEN WITH A TOKEN; AN ACCEPTED SPEC CHANGE IS WRITTEN WITH ITS APPROVAL; A STALE APPROVAL IS NOT APPLIED; A QUEUE IS ACCEPTED IN ITS ORDER; SEVERAL FILES ARE ACCEPTED IN ONE CLICK; A SPEC EDIT IS SAVED AS A PROPOSAL; ADDING A PRODUCT CREATES ITS LAYOUT; THE DASHBOARD KEEPS ITS PRODUCTS IN THE BROWSER; NO PRODUCT IS NAMED IN THE INSTANCE REPOSITORY; A GITLAB PRODUCT USES A PROJECT ACCESS TOKEN; A TOKEN GOES ONLY TO THE SERVER THAT ISSUED IT; THE SHARED PAGES ORIGIN IS DISCLOSED; THE TOKEN LINK IS PREFILLED; THE REPOSITORY CHOICE IS SPELLED OUT; A BROWSER SETTING IS TESTED AND CLEARED WHERE IT IS SHOWN; A STORED SECRET IS HIDDEN UNTIL SHOWN; A CLEAR IS A REAL CLEAR; A TOKEN'S EXPIRY IS WARNED OF IN ADVANCE; AN EXPIRED TOKEN IS NAMED AND ITS RENEWAL LINKED; SETTINGS ARE EXPORTED AND IMPORTED WITH THEIR SECRETS; AN EXPORT STATES THAT IT CONTAINS SECRETS; AN EXPORT CAN BE LOCKED WITH A PASSPHRASE; A PRODUCT'S SETTINGS LIVE IN ITS REPOSITORY; SWITCHING PSEUDONYMISATION OFF STATES WHAT FOLLOWS; A PERSON IS NAMED BY ACCOUNT OR WITH CONSENT; THE JUMP HOST AND THE REMOTE SESSIONS ARE SETTINGS
// given: the use cases UC-001 (accepted), UC-002 (open), UC-003 (changed)
// input: open the pages of UC-002 and UC-003, then the list; tick UC-002 and UC-003 on the list, then Accept ticked
// expect: the accepted use case has no tick and Accept ticked (0) is disabled; ticked, the button says (2); one commit with one record per ticked file, each naming the text shown
test("UC-008 3d: ticks on the list; Accept ticked writes one commit with one record per ticked file, naming the text shown", async () => {
  const srv = await ucServer();
  const page = await openDashboard({ server: srv, hash: "#uc/UC-002" });
  await page.go("#uc/UC-003");
  await page.go("#uc");
  assert.match(page.main(), /<button class="btn accept-ticked" type="button" disabled>Accept ticked \(0\)<\/button>/);
  const boxes = globalThis.document.getElementById("main").querySelectorAll(".tick");
  assert.equal(boxes.length, 2, "UC-001 is accepted and has no tick");
  for (const box of boxes) await tick(srv, box);
  assert.match(page.main(), /Accept ticked \(2\)/);
  await press(srv, inMain(".accept-ticked"));
  assert.equal(srv.writes.length, 1, "one commit");
  const want = {};
  for (const [id, p] of [["UC-002", UC2], ["UC-003", UC3]]) {
    const b = await blobSha(srv.files[p]);
    want[approvalPath(id, b)] = recordText(reviewedRecord(p, b));
  }
  assert.deepEqual(srv.writes[0].files, want);
});

// TST-474011 · level: component · module: MOD-settings-pages
// guards: UC-001; UC-006; UC-008; UC-014; UC-042; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK; ONE CLICK PER DECISION; EVERY STEP EXPLAINS ITSELF; AN APPROVAL NAMES THE EXACT TEXT; STATUS IS DERIVED FROM THE RECORDS; EDITS ARE PREPARED ON THE DASHBOARD; A SAVE IS REFUSED WHEN THE TEXT CHANGED MEANWHILE; AN EDITED FILE KEEPS ITS IDENTIFIER; WITHOUT A TOKEN, GITHUB'S WEB INTERFACE IS THE FALLBACK; A GITLAB PRODUCT IS WRITTEN WITH A TOKEN; AN ACCEPTED SPEC CHANGE IS WRITTEN WITH ITS APPROVAL; A STALE APPROVAL IS NOT APPLIED; A QUEUE IS ACCEPTED IN ITS ORDER; SEVERAL FILES ARE ACCEPTED IN ONE CLICK; A SPEC EDIT IS SAVED AS A PROPOSAL; ADDING A PRODUCT CREATES ITS LAYOUT; THE DASHBOARD KEEPS ITS PRODUCTS IN THE BROWSER; NO PRODUCT IS NAMED IN THE INSTANCE REPOSITORY; A GITLAB PRODUCT USES A PROJECT ACCESS TOKEN; A TOKEN GOES ONLY TO THE SERVER THAT ISSUED IT; THE SHARED PAGES ORIGIN IS DISCLOSED; THE TOKEN LINK IS PREFILLED; THE REPOSITORY CHOICE IS SPELLED OUT; A BROWSER SETTING IS TESTED AND CLEARED WHERE IT IS SHOWN; A STORED SECRET IS HIDDEN UNTIL SHOWN; A CLEAR IS A REAL CLEAR; A TOKEN'S EXPIRY IS WARNED OF IN ADVANCE; AN EXPIRED TOKEN IS NAMED AND ITS RENEWAL LINKED; SETTINGS ARE EXPORTED AND IMPORTED WITH THEIR SECRETS; AN EXPORT STATES THAT IT CONTAINS SECRETS; AN EXPORT CAN BE LOCKED WITH A PASSPHRASE; A PRODUCT'S SETTINGS LIVE IN ITS REPOSITORY; SWITCHING PSEUDONYMISATION OFF STATES WHAT FOLLOWS; A PERSON IS NAMED BY ACCOUNT OR WITH CONSENT; THE JUMP HOST AND THE REMOTE SESSIONS ARE SETTINGS
// given: the pages of UC-002 and UC-003 shown, then both ticked on the list
// input: UC-003's file changes after it was shown, then Accept ticked
// expect: only UC-002 is written; UC-003 is left out and named as changed after it was shown
test("UC-008 3d counter-proof: a ticked use case changed after it was shown is left out and named; the other is accepted", async () => {
  const srv = await ucServer();
  const page = await openDashboard({ server: srv, hash: "#uc/UC-002" });
  await page.go("#uc/UC-003");
  await page.go("#uc");
  for (const box of globalThis.document.getElementById("main").querySelectorAll(".tick")) await tick(srv, box);
  await srv.change(UC3, srv.files[UC3] + "\nEdited meanwhile.\n");
  await press(srv, inMain(".accept-ticked"));
  const b2 = await blobSha(srv.files[UC2]);
  assert.deepEqual(Object.keys(srv.writes[0].files), [approvalPath("UC-002", b2)]);
  assert.match(page.main(), /UC-003 was left out: /);
});

// TST-474012 · level: component · module: MOD-settings-pages
// guards: UC-001; UC-006; UC-008; UC-014; UC-042; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK; ONE CLICK PER DECISION; EVERY STEP EXPLAINS ITSELF; AN APPROVAL NAMES THE EXACT TEXT; STATUS IS DERIVED FROM THE RECORDS; EDITS ARE PREPARED ON THE DASHBOARD; A SAVE IS REFUSED WHEN THE TEXT CHANGED MEANWHILE; AN EDITED FILE KEEPS ITS IDENTIFIER; WITHOUT A TOKEN, GITHUB'S WEB INTERFACE IS THE FALLBACK; A GITLAB PRODUCT IS WRITTEN WITH A TOKEN; AN ACCEPTED SPEC CHANGE IS WRITTEN WITH ITS APPROVAL; A STALE APPROVAL IS NOT APPLIED; A QUEUE IS ACCEPTED IN ITS ORDER; SEVERAL FILES ARE ACCEPTED IN ONE CLICK; A SPEC EDIT IS SAVED AS A PROPOSAL; ADDING A PRODUCT CREATES ITS LAYOUT; THE DASHBOARD KEEPS ITS PRODUCTS IN THE BROWSER; NO PRODUCT IS NAMED IN THE INSTANCE REPOSITORY; A GITLAB PRODUCT USES A PROJECT ACCESS TOKEN; A TOKEN GOES ONLY TO THE SERVER THAT ISSUED IT; THE SHARED PAGES ORIGIN IS DISCLOSED; THE TOKEN LINK IS PREFILLED; THE REPOSITORY CHOICE IS SPELLED OUT; A BROWSER SETTING IS TESTED AND CLEARED WHERE IT IS SHOWN; A STORED SECRET IS HIDDEN UNTIL SHOWN; A CLEAR IS A REAL CLEAR; A TOKEN'S EXPIRY IS WARNED OF IN ADVANCE; AN EXPIRED TOKEN IS NAMED AND ITS RENEWAL LINKED; SETTINGS ARE EXPORTED AND IMPORTED WITH THEIR SECRETS; AN EXPORT STATES THAT IT CONTAINS SECRETS; AN EXPORT CAN BE LOCKED WITH A PASSPHRASE; A PRODUCT'S SETTINGS LIVE IN ITS REPOSITORY; SWITCHING PSEUDONYMISATION OFF STATES WHAT FOLLOWS; A PERSON IS NAMED BY ACCOUNT OR WITH CONSENT; THE JUMP HOST AND THE REMOTE SESSIONS ARE SETTINGS
// given: no token stored, UC-002 open
// input: open the use case
// expect: Accept is GitHub's new-file page prefilled with the record, with the record and path to copy and no write buttons; nothing is written by the dashboard. Editing without a token (GitHub's editor with the text on the clipboard) is MOD-review-pages' own (tests/review-pages-use-cases.test.mjs)
test("UC-008 3b: without a token, Accept is GitHub's new-file page prefilled with the record, with the record and path to copy", async () => {
  const srv = await ucServer();
  const page = await openDashboard({ server: srv, hash: "#uc/UC-002", token: null });
  const blob = await blobSha(srv.files[UC2]);
  const path = approvalPath("UC-002", blob), rec = recordText(reviewedRecord(UC2, blob));
  const html = page.main();
  const href = `https://github.com/${REPO}/new/main?filename=${encodeURIComponent(path)}&amp;value=${encodeURIComponent(rec)}`;
  assert.ok(html.includes(href), "the prefilled new-file page");
  assert.match(html, /Open GitHub&nbsp;?'?s page to commit the record|Open GitHub(&#39;|')s page to commit the record|Open GitHub.{0,8}s page to commit the record/);
  assert.ok(html.includes(`<code class="record-path">${path}</code>`), "the path to copy");
  assert.ok(html.includes(`<pre class="record">${rec.replace(/\n$/, "")}`), "the record, shown");
  assert.doesNotMatch(html, /<button class="btn accept"/);
  assert.deepEqual(srv.writes, [], "nothing is written by the dashboard");
  assert.ok(srv.requests.every((r) => !/^write /.test(r)));
});

// TST-474013 · level: component · module: MOD-settings-pages
// guards: UC-001; UC-006; UC-008; UC-014; UC-042; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK; ONE CLICK PER DECISION; EVERY STEP EXPLAINS ITSELF; AN APPROVAL NAMES THE EXACT TEXT; STATUS IS DERIVED FROM THE RECORDS; EDITS ARE PREPARED ON THE DASHBOARD; A SAVE IS REFUSED WHEN THE TEXT CHANGED MEANWHILE; AN EDITED FILE KEEPS ITS IDENTIFIER; WITHOUT A TOKEN, GITHUB'S WEB INTERFACE IS THE FALLBACK; A GITLAB PRODUCT IS WRITTEN WITH A TOKEN; AN ACCEPTED SPEC CHANGE IS WRITTEN WITH ITS APPROVAL; A STALE APPROVAL IS NOT APPLIED; A QUEUE IS ACCEPTED IN ITS ORDER; SEVERAL FILES ARE ACCEPTED IN ONE CLICK; A SPEC EDIT IS SAVED AS A PROPOSAL; ADDING A PRODUCT CREATES ITS LAYOUT; THE DASHBOARD KEEPS ITS PRODUCTS IN THE BROWSER; NO PRODUCT IS NAMED IN THE INSTANCE REPOSITORY; A GITLAB PRODUCT USES A PROJECT ACCESS TOKEN; A TOKEN GOES ONLY TO THE SERVER THAT ISSUED IT; THE SHARED PAGES ORIGIN IS DISCLOSED; THE TOKEN LINK IS PREFILLED; THE REPOSITORY CHOICE IS SPELLED OUT; A BROWSER SETTING IS TESTED AND CLEARED WHERE IT IS SHOWN; A STORED SECRET IS HIDDEN UNTIL SHOWN; A CLEAR IS A REAL CLEAR; A TOKEN'S EXPIRY IS WARNED OF IN ADVANCE; AN EXPIRED TOKEN IS NAMED AND ITS RENEWAL LINKED; SETTINGS ARE EXPORTED AND IMPORTED WITH THEIR SECRETS; AN EXPORT STATES THAT IT CONTAINS SECRETS; AN EXPORT CAN BE LOCKED WITH A PASSPHRASE; A PRODUCT'S SETTINGS LIVE IN ITS REPOSITORY; SWITCHING PSEUDONYMISATION OFF STATES WHAT FOLLOWS; A PERSON IS NAMED BY ACCOUNT OR WITH CONSENT; THE JUMP HOST AND THE REMOTE SESSIONS ARE SETTINGS; A PAGE LOAD READS THE REPOSITORY IN BATCHES
// given: a private repository, answering 404 without the token
// input: open #uc with the token and without it
// expect: with the token the files are read through the API, never the raw host; without it the page says the repository was not found, that a private repository is found only with a token that reaches it, and shows no use case
test("UC-008 1a: a private repository is read with the stored token through the API; without a token the page says so and shows no use case", async () => {
  // A private repository: GitHub answers 404 to every request without the token.
  const priv = (url, init) => (!init.headers?.Authorization && ((url.origin === API && url.pathname.startsWith(`/repos/${REPO}`))
    || (url.origin === "https://raw.githubusercontent.com" && url.pathname.startsWith(`/${REPO}/`)))
    ? json({ message: "Not Found" }, 404) : undefined);
  const srv = await ucServer({}, [priv]);
  const withToken = await openDashboard({ server: srv, hash: "#uc" });
  assert.match(withToken.main(), /UC-002/);
  assert.ok(srv.batches.some((paths) => paths.includes(UC1)), "a batch request names UC-001's file");
  const batchRequests = srv.seen.filter((r) => r.url === `${API}/graphql`);
  assert.ok(batchRequests.length > 0 && batchRequests.every((r) => r.auth === `Bearer ${TOKEN}`), "the batch request carries the token");
  assert.ok(srv.seen.filter((r) => r.url.startsWith(`${API}/repos/${REPO}/contents/`)).every((r) => r.auth === `Bearer ${TOKEN}`),
    "through the API, with the token");
  assert.ok(!srv.seen.some((r) => r.url.startsWith("https://raw.githubusercontent.com/")), "never through the raw host");
  const without = await openDashboard({ server: await ucServer({}, [priv]), hash: "#uc", token: null });
  assert.match(without.main(), /Could not read akmaier\/agent-m @ main: https:\/\/github\.com\/akmaier\/agent-m at main was not found/i);
  assert.match(without.main(), /private repository is found only with a token that reaches it/i);
  assert.doesNotMatch(without.main(), /UC-002/);
});

// TST-474014 · level: component · module: MOD-settings-pages
// guards: UC-001; UC-006; UC-008; UC-014; UC-042; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK; ONE CLICK PER DECISION; EVERY STEP EXPLAINS ITSELF; AN APPROVAL NAMES THE EXACT TEXT; STATUS IS DERIVED FROM THE RECORDS; EDITS ARE PREPARED ON THE DASHBOARD; A SAVE IS REFUSED WHEN THE TEXT CHANGED MEANWHILE; AN EDITED FILE KEEPS ITS IDENTIFIER; WITHOUT A TOKEN, GITHUB'S WEB INTERFACE IS THE FALLBACK; A GITLAB PRODUCT IS WRITTEN WITH A TOKEN; AN ACCEPTED SPEC CHANGE IS WRITTEN WITH ITS APPROVAL; A STALE APPROVAL IS NOT APPLIED; A QUEUE IS ACCEPTED IN ITS ORDER; SEVERAL FILES ARE ACCEPTED IN ONE CLICK; A SPEC EDIT IS SAVED AS A PROPOSAL; ADDING A PRODUCT CREATES ITS LAYOUT; THE DASHBOARD KEEPS ITS PRODUCTS IN THE BROWSER; NO PRODUCT IS NAMED IN THE INSTANCE REPOSITORY; A GITLAB PRODUCT USES A PROJECT ACCESS TOKEN; A TOKEN GOES ONLY TO THE SERVER THAT ISSUED IT; THE SHARED PAGES ORIGIN IS DISCLOSED; THE TOKEN LINK IS PREFILLED; THE REPOSITORY CHOICE IS SPELLED OUT; A BROWSER SETTING IS TESTED AND CLEARED WHERE IT IS SHOWN; A STORED SECRET IS HIDDEN UNTIL SHOWN; A CLEAR IS A REAL CLEAR; A TOKEN'S EXPIRY IS WARNED OF IN ADVANCE; AN EXPIRED TOKEN IS NAMED AND ITS RENEWAL LINKED; SETTINGS ARE EXPORTED AND IMPORTED WITH THEIR SECRETS; AN EXPORT STATES THAT IT CONTAINS SECRETS; AN EXPORT CAN BE LOCKED WITH A PASSPHRASE; A PRODUCT'S SETTINGS LIVE IN ITS REPOSITORY; SWITCHING PSEUDONYMISATION OFF STATES WHAT FOLLOWS; A PERSON IS NAMED BY ACCOUNT OR WITH CONSENT; THE JUMP HOST AND THE REMOTE SESSIONS ARE SETTINGS
// given: a GitLab product without its project token
// input: open UC-002 of the product without a token, then follow the link to the step that stores the token
// expect: the use case is read but offers no Accept and no Edit-save, says that a GitLab product is written with the project's own token, and the link leads to the step that stores it, #add/<the product's address>; only GETs go to GitLab, nothing to GitHub
test("UC-008 3c: a GitLab product without its project token is read, but offers no Accept — it links to the step that stores the token", async () => {
  const gl = await fakeGitLab({ files: { [UC2]: ucText("UC-002", "Show the status", "The dashboard shows the status.") } });
  const srv = await instance({ files: await instanceFiles(), handlers: [(url, init) => (url.origin === GL ? gl.fetchMock(url.href, init) : undefined)] });
  const page = await openDashboard({ server: srv, hash: "#uc/UC-002", token: null, search: `?product=${encodeURIComponent(GL_ADDR)}` });
  const html = page.main();
  assert.match(html, /UC-002 Show the status/);
  assert.match(html, /A GitLab product is written with the project's own token\./);
  assert.doesNotMatch(html, /<button class="btn accept"|github\.com\/[^"]*\/new\//);
  const step = inMain(".token-step");
  assert.ok(step, "the link to the step that stores the token");
  step.fire("click", { isTrusted: true, preventDefault() {} });
  assert.equal(globalThis.location.hash, `#add/${encodeURIComponent(GL_ADDR)}`);
  assert.ok(gl.calls.every((c) => c.method === "GET"), "only read");
  assert.ok(!srv.seen.some((r) => r.url.startsWith(`${API}/repos/grp`)), "nothing of the product goes to GitHub");
});

// TST-474015 · level: component · module: MOD-settings-pages
// guards: UC-001; UC-006; UC-008; UC-014; UC-042; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK; ONE CLICK PER DECISION; EVERY STEP EXPLAINS ITSELF; AN APPROVAL NAMES THE EXACT TEXT; STATUS IS DERIVED FROM THE RECORDS; EDITS ARE PREPARED ON THE DASHBOARD; A SAVE IS REFUSED WHEN THE TEXT CHANGED MEANWHILE; AN EDITED FILE KEEPS ITS IDENTIFIER; WITHOUT A TOKEN, GITHUB'S WEB INTERFACE IS THE FALLBACK; A GITLAB PRODUCT IS WRITTEN WITH A TOKEN; AN ACCEPTED SPEC CHANGE IS WRITTEN WITH ITS APPROVAL; A STALE APPROVAL IS NOT APPLIED; A QUEUE IS ACCEPTED IN ITS ORDER; SEVERAL FILES ARE ACCEPTED IN ONE CLICK; A SPEC EDIT IS SAVED AS A PROPOSAL; ADDING A PRODUCT CREATES ITS LAYOUT; THE DASHBOARD KEEPS ITS PRODUCTS IN THE BROWSER; NO PRODUCT IS NAMED IN THE INSTANCE REPOSITORY; A GITLAB PRODUCT USES A PROJECT ACCESS TOKEN; A TOKEN GOES ONLY TO THE SERVER THAT ISSUED IT; THE SHARED PAGES ORIGIN IS DISCLOSED; THE TOKEN LINK IS PREFILLED; THE REPOSITORY CHOICE IS SPELLED OUT; A BROWSER SETTING IS TESTED AND CLEARED WHERE IT IS SHOWN; A STORED SECRET IS HIDDEN UNTIL SHOWN; A CLEAR IS A REAL CLEAR; A TOKEN'S EXPIRY IS WARNED OF IN ADVANCE; AN EXPIRED TOKEN IS NAMED AND ITS RENEWAL LINKED; SETTINGS ARE EXPORTED AND IMPORTED WITH THEIR SECRETS; AN EXPORT STATES THAT IT CONTAINS SECRETS; AN EXPORT CAN BE LOCKED WITH A PASSPHRASE; A PRODUCT'S SETTINGS LIVE IN ITS REPOSITORY; SWITCHING PSEUDONYMISATION OFF STATES WHAT FOLLOWS; A PERSON IS NAMED BY ACCOUNT OR WITH CONSENT; THE JUMP HOST AND THE REMOTE SESSIONS ARE SETTINGS
// given: UC-002 open, the server refusing POST /git/trees with 403
// input: press Accept
// expect: nothing is written, Accept can be pressed again, the page says why the commit was refused and offers GitHub's new-file page as a link
test("UC-008 4a: a commit the server refuses (no write access) writes nothing; the page says so and offers the way through GitHub's page as a link", async () => {
  const refuse = (url, init) => (init.method === "POST" && url.pathname.endsWith("/git/trees")
    ? json({ message: "Resource not accessible by personal access token" }, 403) : undefined);
  const srv = await ucServer({}, [refuse]);
  const page = await openDashboard({ server: srv, hash: "#uc/UC-002" });
  await page.click(".accept");
  assert.deepEqual(srv.writes, []);
  const accept = inMain(".accept");
  assert.equal(accept.disabled, false, "Accept can be pressed again");
  assert.match(page.main(), /<p class="result">Your GitHub token may not write to https:\/\/github\.com\/akmaier\/agent-m: it lacks Contents\./);
  assert.match(page.main(), new RegExp(`href="https://github\\.com/${reEsc(REPO)}/new/main\\?filename=docs%2Fapprovals%2FUC-002-`));
});

// ================================================================ UC-006 Approve a specification change

const SECTION_10 = "## 10. R\n\nold ten\n";
const SPEC_HEAD = "# S\n\n**VERBINDLICH (SPEC)**\n\n## 9. G\n\nold nine\n";
const P05 = `${QD}/05-a.md`, P06 = `${QD}/06-b.md`, DECISIONS = `${QD}/entscheidungen.md`;
const ROW = /^\| \d{4}-\d{2}-\d{2} \d{2}:\d{2} UTC \| (\d+) \| uebernommen \| approval:(spec-[^ ]+\.md) \|$/;
const rowsOf = (text) => text.split("\n").filter((l) => l.startsWith("| 2")).map((l) => ROW.exec(l)).map((m) => m && [m[1], m[2]]);
// The record of an entry as MOD-approvals' approvalSchema writes it: the kind and the blob first, then the entry's own fields.
async function specRecordFor(nr, proposalPath, proposalText, anchor, section) {
  const blob = await blobSha(proposalText);
  const nn = String(nr).padStart(2, "0");
  return { path: approvalPath(`spec-${QNAME}-${nn}`, blob), text: `kind: spec\nblob: ${blob}\nqueue: ${QD}\nentry: ${nn}\nproposal: ${proposalPath}\n` +
    `target: SPEC.md\nanchor: ${anchor}\nsection: ${await blobSha(section)}\n` };
}

// TST-474016 · level: component · module: MOD-settings-pages
// guards: UC-001; UC-006; UC-008; UC-014; UC-042; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK; ONE CLICK PER DECISION; EVERY STEP EXPLAINS ITSELF; AN APPROVAL NAMES THE EXACT TEXT; STATUS IS DERIVED FROM THE RECORDS; EDITS ARE PREPARED ON THE DASHBOARD; A SAVE IS REFUSED WHEN THE TEXT CHANGED MEANWHILE; AN EDITED FILE KEEPS ITS IDENTIFIER; WITHOUT A TOKEN, GITHUB'S WEB INTERFACE IS THE FALLBACK; A GITLAB PRODUCT IS WRITTEN WITH A TOKEN; AN ACCEPTED SPEC CHANGE IS WRITTEN WITH ITS APPROVAL; A STALE APPROVAL IS NOT APPLIED; A QUEUE IS ACCEPTED IN ITS ORDER; SEVERAL FILES ARE ACCEPTED IN ONE CLICK; A SPEC EDIT IS SAVED AS A PROPOSAL; ADDING A PRODUCT CREATES ITS LAYOUT; THE DASHBOARD KEEPS ITS PRODUCTS IN THE BROWSER; NO PRODUCT IS NAMED IN THE INSTANCE REPOSITORY; A GITLAB PRODUCT USES A PROJECT ACCESS TOKEN; A TOKEN GOES ONLY TO THE SERVER THAT ISSUED IT; THE SHARED PAGES ORIGIN IS DISCLOSED; THE TOKEN LINK IS PREFILLED; THE REPOSITORY CHOICE IS SPELLED OUT; A BROWSER SETTING IS TESTED AND CLEARED WHERE IT IS SHOWN; A STORED SECRET IS HIDDEN UNTIL SHOWN; A CLEAR IS A REAL CLEAR; A TOKEN'S EXPIRY IS WARNED OF IN ADVANCE; AN EXPIRED TOKEN IS NAMED AND ITS RENEWAL LINKED; SETTINGS ARE EXPORTED AND IMPORTED WITH THEIR SECRETS; AN EXPORT STATES THAT IT CONTAINS SECRETS; AN EXPORT CAN BE LOCKED WITH A PASSPHRASE; A PRODUCT'S SETTINGS LIVE IN ITS REPOSITORY; SWITCHING PSEUDONYMISATION OFF STATES WHAT FOLLOWS; A PERSON IS NAMED BY ACCOUNT OR WITH CONSENT; THE JUMP HOST AND THE REMOTE SESSIONS ARE SETTINGS
// given: the queue with entry 05 open, replacing SPEC section 10
// input: the dashboard opened at #spec/<queue>/05
// expect: the current section beside the proposal, the difference (deleted and added line) and the rationale are shown, with Accept; nothing is written
test("UC-006 steps 1–2: an open entry is shown beside the SPEC section it replaces, with the difference and the rationale", async () => {
  const srv = await ucServer();
  const page = await openDashboard({ server: srv, hash: `#spec/${QNAME}/05` });
  const html = page.main();
  assert.match(html, /<span class="badge b-open">open<\/span>/);
  const now = html.indexOf("<h3>Now in the SPEC</h3>"), proposed = html.indexOf("<h3>The proposal</h3>");
  assert.ok(now > 0 && proposed > now, "the current section beside the proposal");
  assert.match(html.slice(now, proposed), /old ten/);
  assert.match(html.slice(proposed), /new ten/);
  assert.match(html, /<span class="ddel">- old ten<\/span>/);
  assert.match(html, /<span class="dadd">\+ new ten<\/span>/);
  assert.match(html, /<h3>Why<\/h3>[^]*Section ten is out of date\./);
  assert.match(html, /<button class="btn accept" type="button">Accept<\/button>/);
  assert.deepEqual(srv.writes, []);
});

// TST-474017 · level: component · module: MOD-settings-pages
// guards: UC-001; UC-006; UC-008; UC-014; UC-042; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK; ONE CLICK PER DECISION; EVERY STEP EXPLAINS ITSELF; AN APPROVAL NAMES THE EXACT TEXT; STATUS IS DERIVED FROM THE RECORDS; EDITS ARE PREPARED ON THE DASHBOARD; A SAVE IS REFUSED WHEN THE TEXT CHANGED MEANWHILE; AN EDITED FILE KEEPS ITS IDENTIFIER; WITHOUT A TOKEN, GITHUB'S WEB INTERFACE IS THE FALLBACK; A GITLAB PRODUCT IS WRITTEN WITH A TOKEN; AN ACCEPTED SPEC CHANGE IS WRITTEN WITH ITS APPROVAL; A STALE APPROVAL IS NOT APPLIED; A QUEUE IS ACCEPTED IN ITS ORDER; SEVERAL FILES ARE ACCEPTED IN ONE CLICK; A SPEC EDIT IS SAVED AS A PROPOSAL; ADDING A PRODUCT CREATES ITS LAYOUT; THE DASHBOARD KEEPS ITS PRODUCTS IN THE BROWSER; NO PRODUCT IS NAMED IN THE INSTANCE REPOSITORY; A GITLAB PRODUCT USES A PROJECT ACCESS TOKEN; A TOKEN GOES ONLY TO THE SERVER THAT ISSUED IT; THE SHARED PAGES ORIGIN IS DISCLOSED; THE TOKEN LINK IS PREFILLED; THE REPOSITORY CHOICE IS SPELLED OUT; A BROWSER SETTING IS TESTED AND CLEARED WHERE IT IS SHOWN; A STORED SECRET IS HIDDEN UNTIL SHOWN; A CLEAR IS A REAL CLEAR; A TOKEN'S EXPIRY IS WARNED OF IN ADVANCE; AN EXPIRED TOKEN IS NAMED AND ITS RENEWAL LINKED; SETTINGS ARE EXPORTED AND IMPORTED WITH THEIR SECRETS; AN EXPORT STATES THAT IT CONTAINS SECRETS; AN EXPORT CAN BE LOCKED WITH A PASSPHRASE; A PRODUCT'S SETTINGS LIVE IN ITS REPOSITORY; SWITCHING PSEUDONYMISATION OFF STATES WHAT FOLLOWS; A PERSON IS NAMED BY ACCOUNT OR WITH CONSENT; THE JUMP HOST AND THE REMOTE SESSIONS ARE SETTINGS
// given: entry 05 of the queue open
// input: one click on Accept
// expect: one commit with the record, SPEC.md with the section replaced byte for byte and the decision appended, under the reviewer's token; the entry is then shown as in SPEC without Accept
test("UC-006 steps 4–7: one click on Accept writes the record, the SPEC section byte for byte and the decision in one commit; the entry is then in SPEC", async () => {
  const srv = await ucServer();
  const page = await openDashboard({ server: srv, hash: `#spec/${QNAME}/05` });
  await page.click(".accept");
  assert.equal(srv.writes.length, 1, "one commit");
  const w = srv.writes[0].files, rec = await specRecordFor(5, P05, B_P05, "## 10. R", SECTION_10);
  assert.deepEqual(Object.keys(w).sort(), [DECISIONS, "SPEC.md", rec.path].sort());
  assert.equal(w[rec.path], rec.text, "the record names the proposal and the section shown, by their blob SHAs");
  assert.equal(w["SPEC.md"], SPEC_HEAD + B_P05, "the section replaced by the proposal, byte for byte; the rest unchanged");
  assert.deepEqual(rowsOf(w[DECISIONS]), [["5", rec.path.split("/").pop()]]);
  assert.ok(w[DECISIONS].startsWith("# Decisions\n\nAppend-only.\n\n"), "the decision appended");
  assert.ok(srv.seen.filter((r) => r.method !== "GET").every((r) => r.auth === `Bearer ${TOKEN}`), "under the reviewer's own token");
  assert.match(page.main(), /<span class="badge b-applied">in SPEC<\/span>/);
  assert.doesNotMatch(page.main(), /<button class="btn accept"/);
});

// TST-474019 · level: component · module: MOD-settings-pages
// guards: UC-001; UC-006; UC-008; UC-014; UC-042; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK; ONE CLICK PER DECISION; EVERY STEP EXPLAINS ITSELF; AN APPROVAL NAMES THE EXACT TEXT; STATUS IS DERIVED FROM THE RECORDS; EDITS ARE PREPARED ON THE DASHBOARD; A SAVE IS REFUSED WHEN THE TEXT CHANGED MEANWHILE; AN EDITED FILE KEEPS ITS IDENTIFIER; WITHOUT A TOKEN, GITHUB'S WEB INTERFACE IS THE FALLBACK; A GITLAB PRODUCT IS WRITTEN WITH A TOKEN; AN ACCEPTED SPEC CHANGE IS WRITTEN WITH ITS APPROVAL; A STALE APPROVAL IS NOT APPLIED; A QUEUE IS ACCEPTED IN ITS ORDER; SEVERAL FILES ARE ACCEPTED IN ONE CLICK; A SPEC EDIT IS SAVED AS A PROPOSAL; ADDING A PRODUCT CREATES ITS LAYOUT; THE DASHBOARD KEEPS ITS PRODUCTS IN THE BROWSER; NO PRODUCT IS NAMED IN THE INSTANCE REPOSITORY; A GITLAB PRODUCT USES A PROJECT ACCESS TOKEN; A TOKEN GOES ONLY TO THE SERVER THAT ISSUED IT; THE SHARED PAGES ORIGIN IS DISCLOSED; THE TOKEN LINK IS PREFILLED; THE REPOSITORY CHOICE IS SPELLED OUT; A BROWSER SETTING IS TESTED AND CLEARED WHERE IT IS SHOWN; A STORED SECRET IS HIDDEN UNTIL SHOWN; A CLEAR IS A REAL CLEAR; A TOKEN'S EXPIRY IS WARNED OF IN ADVANCE; AN EXPIRED TOKEN IS NAMED AND ITS RENEWAL LINKED; SETTINGS ARE EXPORTED AND IMPORTED WITH THEIR SECRETS; AN EXPORT STATES THAT IT CONTAINS SECRETS; AN EXPORT CAN BE LOCKED WITH A PASSPHRASE; A PRODUCT'S SETTINGS LIVE IN ITS REPOSITORY; SWITCHING PSEUDONYMISATION OFF STATES WHAT FOLLOWS; A PERSON IS NAMED BY ACCOUNT OR WITH CONSENT; THE JUMP HOST AND THE REMOTE SESSIONS ARE SETTINGS
// given: entry 05 open
// input: the SPEC section changes on the server after the entry was opened, then Accept
// expect: nothing is written; the page names the entry as left out because the SPEC section changed
test("UC-006 5a: the SPEC section changed after the entry was opened — nothing is written, and the page names the entry", async () => {
  const srv = await ucServer();
  const page = await openDashboard({ server: srv, hash: `#spec/${QNAME}/05` });
  await srv.change("SPEC.md", B_SPEC.replace("old ten", "ten as someone else wrote it"));
  await page.click(".accept");
  assert.deepEqual(srv.writes, []);
  assert.match(page.main(), /entry 05 of [^:]+: the SPEC section changed after it was shown/);
});

// TST-474020 · level: component · module: MOD-settings-pages
// guards: UC-001; UC-006; UC-008; UC-014; UC-042; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK; ONE CLICK PER DECISION; EVERY STEP EXPLAINS ITSELF; AN APPROVAL NAMES THE EXACT TEXT; STATUS IS DERIVED FROM THE RECORDS; EDITS ARE PREPARED ON THE DASHBOARD; A SAVE IS REFUSED WHEN THE TEXT CHANGED MEANWHILE; AN EDITED FILE KEEPS ITS IDENTIFIER; WITHOUT A TOKEN, GITHUB'S WEB INTERFACE IS THE FALLBACK; A GITLAB PRODUCT IS WRITTEN WITH A TOKEN; AN ACCEPTED SPEC CHANGE IS WRITTEN WITH ITS APPROVAL; A STALE APPROVAL IS NOT APPLIED; A QUEUE IS ACCEPTED IN ITS ORDER; SEVERAL FILES ARE ACCEPTED IN ONE CLICK; A SPEC EDIT IS SAVED AS A PROPOSAL; ADDING A PRODUCT CREATES ITS LAYOUT; THE DASHBOARD KEEPS ITS PRODUCTS IN THE BROWSER; NO PRODUCT IS NAMED IN THE INSTANCE REPOSITORY; A GITLAB PRODUCT USES A PROJECT ACCESS TOKEN; A TOKEN GOES ONLY TO THE SERVER THAT ISSUED IT; THE SHARED PAGES ORIGIN IS DISCLOSED; THE TOKEN LINK IS PREFILLED; THE REPOSITORY CHOICE IS SPELLED OUT; A BROWSER SETTING IS TESTED AND CLEARED WHERE IT IS SHOWN; A STORED SECRET IS HIDDEN UNTIL SHOWN; A CLEAR IS A REAL CLEAR; A TOKEN'S EXPIRY IS WARNED OF IN ADVANCE; AN EXPIRED TOKEN IS NAMED AND ITS RENEWAL LINKED; SETTINGS ARE EXPORTED AND IMPORTED WITH THEIR SECRETS; AN EXPORT STATES THAT IT CONTAINS SECRETS; AN EXPORT CAN BE LOCKED WITH A PASSPHRASE; A PRODUCT'S SETTINGS LIVE IN ITS REPOSITORY; SWITCHING PSEUDONYMISATION OFF STATES WHAT FOLLOWS; A PERSON IS NAMED BY ACCOUNT OR WITH CONSENT; THE JUMP HOST AND THE REMOTE SESSIONS ARE SETTINGS
// given: entry 05 open
// input: the proposal changes on the server after the entry was opened, then Accept
// expect: nothing is written; the page names the entry as left out because the proposal changed
test("UC-006 5a: the proposal changed after the entry was opened — nothing is written", async () => {
  const srv = await ucServer();
  const page = await openDashboard({ server: srv, hash: `#spec/${QNAME}/05` });
  await srv.change(P05, B_P05.replace("new ten", "newer ten"));
  await page.click(".accept");
  assert.deepEqual(srv.writes, []);
  assert.match(page.main(), /entry 05 of [^:]+: the proposal changed after it was shown/);
});

// TST-474021 · level: component · module: MOD-settings-pages
// guards: UC-001; UC-006; UC-008; UC-014; UC-042; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK; ONE CLICK PER DECISION; EVERY STEP EXPLAINS ITSELF; AN APPROVAL NAMES THE EXACT TEXT; STATUS IS DERIVED FROM THE RECORDS; EDITS ARE PREPARED ON THE DASHBOARD; A SAVE IS REFUSED WHEN THE TEXT CHANGED MEANWHILE; AN EDITED FILE KEEPS ITS IDENTIFIER; WITHOUT A TOKEN, GITHUB'S WEB INTERFACE IS THE FALLBACK; A GITLAB PRODUCT IS WRITTEN WITH A TOKEN; AN ACCEPTED SPEC CHANGE IS WRITTEN WITH ITS APPROVAL; A STALE APPROVAL IS NOT APPLIED; A QUEUE IS ACCEPTED IN ITS ORDER; SEVERAL FILES ARE ACCEPTED IN ONE CLICK; A SPEC EDIT IS SAVED AS A PROPOSAL; ADDING A PRODUCT CREATES ITS LAYOUT; THE DASHBOARD KEEPS ITS PRODUCTS IN THE BROWSER; NO PRODUCT IS NAMED IN THE INSTANCE REPOSITORY; A GITLAB PRODUCT USES A PROJECT ACCESS TOKEN; A TOKEN GOES ONLY TO THE SERVER THAT ISSUED IT; THE SHARED PAGES ORIGIN IS DISCLOSED; THE TOKEN LINK IS PREFILLED; THE REPOSITORY CHOICE IS SPELLED OUT; A BROWSER SETTING IS TESTED AND CLEARED WHERE IT IS SHOWN; A STORED SECRET IS HIDDEN UNTIL SHOWN; A CLEAR IS A REAL CLEAR; A TOKEN'S EXPIRY IS WARNED OF IN ADVANCE; AN EXPIRED TOKEN IS NAMED AND ITS RENEWAL LINKED; SETTINGS ARE EXPORTED AND IMPORTED WITH THEIR SECRETS; AN EXPORT STATES THAT IT CONTAINS SECRETS; AN EXPORT CAN BE LOCKED WITH A PASSPHRASE; A PRODUCT'S SETTINGS LIVE IN ITS REPOSITORY; SWITCHING PSEUDONYMISATION OFF STATES WHAT FOLLOWS; A PERSON IS NAMED BY ACCOUNT OR WITH CONSENT; THE JUMP HOST AND THE REMOTE SESSIONS ARE SETTINGS
// given: entry 05 open
// input: open the entry, follow Edit
// expect: Edit is the link to the entry's editor, #spec-entry/id=<id>/edit=1; that route is shown under the heading Edit and writes nothing. The editor — its Why field, its Save in the entry's own queue, its refusals — is MOD-review-pages' own (tests/review-pages-edit-entry.test.mjs)
test("UC-006 3a: Edit leads to the editor of the entry's route; opening it writes nothing", async () => {
  const srv = await ucServer();
  const page = await openDashboard({ server: srv, hash: `#spec/${QNAME}/05` });
  assert.match(page.main(), /<a class="edit-link" href="#spec-entry\/id=spec-[^"]+-05\/edit=1">Edit<\/a>/);
  await page.go(`#spec-entry/id=spec-${QNAME}-05/edit=1`);
  assert.match(page.main(), /<h2>Edit /);
  assert.deepEqual(srv.writes, []);
  assert.equal(srv.files["SPEC.md"], B_SPEC, "SPEC.md byte-identical");
});

// TST-474023 · level: component · module: MOD-settings-pages
// guards: UC-001; UC-006; UC-008; UC-014; UC-042; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK; ONE CLICK PER DECISION; EVERY STEP EXPLAINS ITSELF; AN APPROVAL NAMES THE EXACT TEXT; STATUS IS DERIVED FROM THE RECORDS; EDITS ARE PREPARED ON THE DASHBOARD; A SAVE IS REFUSED WHEN THE TEXT CHANGED MEANWHILE; AN EDITED FILE KEEPS ITS IDENTIFIER; WITHOUT A TOKEN, GITHUB'S WEB INTERFACE IS THE FALLBACK; A GITLAB PRODUCT IS WRITTEN WITH A TOKEN; AN ACCEPTED SPEC CHANGE IS WRITTEN WITH ITS APPROVAL; A STALE APPROVAL IS NOT APPLIED; A QUEUE IS ACCEPTED IN ITS ORDER; SEVERAL FILES ARE ACCEPTED IN ONE CLICK; A SPEC EDIT IS SAVED AS A PROPOSAL; ADDING A PRODUCT CREATES ITS LAYOUT; THE DASHBOARD KEEPS ITS PRODUCTS IN THE BROWSER; NO PRODUCT IS NAMED IN THE INSTANCE REPOSITORY; A GITLAB PRODUCT USES A PROJECT ACCESS TOKEN; A TOKEN GOES ONLY TO THE SERVER THAT ISSUED IT; THE SHARED PAGES ORIGIN IS DISCLOSED; THE TOKEN LINK IS PREFILLED; THE REPOSITORY CHOICE IS SPELLED OUT; A BROWSER SETTING IS TESTED AND CLEARED WHERE IT IS SHOWN; A STORED SECRET IS HIDDEN UNTIL SHOWN; A CLEAR IS A REAL CLEAR; A TOKEN'S EXPIRY IS WARNED OF IN ADVANCE; AN EXPIRED TOKEN IS NAMED AND ITS RENEWAL LINKED; SETTINGS ARE EXPORTED AND IMPORTED WITH THEIR SECRETS; AN EXPORT STATES THAT IT CONTAINS SECRETS; AN EXPORT CAN BE LOCKED WITH A PASSPHRASE; A PRODUCT'S SETTINGS LIVE IN ITS REPOSITORY; SWITCHING PSEUDONYMISATION OFF STATES WHAT FOLLOWS; A PERSON IS NAMED BY ACCOUNT OR WITH CONSENT; THE JUMP HOST AND THE REMOTE SESSIONS ARE SETTINGS
// given: no token stored, entry 05 open
// input: open the entry
// expect: Accept is GitHub's new-file page prefilled with the record, with no write buttons; nothing is written
test("UC-006 4b: without a token, Accept opens GitHub's new-file page prefilled with the record", async () => {
  const srv = await ucServer();
  const page = await openDashboard({ server: srv, hash: `#spec/${QNAME}/05`, token: null });
  const rec = await specRecordFor(5, P05, B_P05, "## 10. R", SECTION_10);
  const html = page.main();
  assert.ok(html.includes(`https://github.com/${REPO}/new/main?filename=${encodeURIComponent(rec.path)}&amp;value=${encodeURIComponent(rec.text)}`));
  assert.doesNotMatch(html, /<button class="btn accept"/);
  assert.deepEqual(srv.writes, []);
});

// TST-474100 · level: component · module: MOD-settings-pages
// guards: UC-006; STATUS IS DERIVED FROM THE RECORDS; WITHOUT A TOKEN, THE INSTANCE'S WORKFLOW WRITES THE CHANGE
// given: entry 05 whose approval record is committed (on GitHub's page) but whose section the workflow has not written into the SPEC
// input: open the entry
// expect: it is shown approved, not in SPEC, with why: the record is committed, the section is not yet written, the apply workflow writes it; no Accept
test("UC-006 4c: an approval committed on GitHub's page and not yet written is shown approved, with why", async () => {
  const rec = await specRecordFor(5, P05, B_P05, "## 10. R", SECTION_10);
  const page = await openDashboard({ server: await ucServer({ [rec.path]: rec.text }), hash: `#spec/${QNAME}/05` });
  assert.match(page.main(), /<span class="badge b-approved">approved<\/span><p class="approved-note">Approval recorded, not yet written into the SPEC — the apply workflow writes it/);
  assert.doesNotMatch(page.main(), /<button class="btn accept" type="button">Accept<\/button>/);
});

// TST-474024 · level: component · module: MOD-settings-pages
// guards: UC-001; UC-006; UC-008; UC-014; UC-042; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK; ONE CLICK PER DECISION; EVERY STEP EXPLAINS ITSELF; AN APPROVAL NAMES THE EXACT TEXT; STATUS IS DERIVED FROM THE RECORDS; EDITS ARE PREPARED ON THE DASHBOARD; A SAVE IS REFUSED WHEN THE TEXT CHANGED MEANWHILE; AN EDITED FILE KEEPS ITS IDENTIFIER; WITHOUT A TOKEN, GITHUB'S WEB INTERFACE IS THE FALLBACK; A GITLAB PRODUCT IS WRITTEN WITH A TOKEN; AN ACCEPTED SPEC CHANGE IS WRITTEN WITH ITS APPROVAL; A STALE APPROVAL IS NOT APPLIED; A QUEUE IS ACCEPTED IN ITS ORDER; SEVERAL FILES ARE ACCEPTED IN ONE CLICK; A SPEC EDIT IS SAVED AS A PROPOSAL; ADDING A PRODUCT CREATES ITS LAYOUT; THE DASHBOARD KEEPS ITS PRODUCTS IN THE BROWSER; NO PRODUCT IS NAMED IN THE INSTANCE REPOSITORY; A GITLAB PRODUCT USES A PROJECT ACCESS TOKEN; A TOKEN GOES ONLY TO THE SERVER THAT ISSUED IT; THE SHARED PAGES ORIGIN IS DISCLOSED; THE TOKEN LINK IS PREFILLED; THE REPOSITORY CHOICE IS SPELLED OUT; A BROWSER SETTING IS TESTED AND CLEARED WHERE IT IS SHOWN; A STORED SECRET IS HIDDEN UNTIL SHOWN; A CLEAR IS A REAL CLEAR; A TOKEN'S EXPIRY IS WARNED OF IN ADVANCE; AN EXPIRED TOKEN IS NAMED AND ITS RENEWAL LINKED; SETTINGS ARE EXPORTED AND IMPORTED WITH THEIR SECRETS; AN EXPORT STATES THAT IT CONTAINS SECRETS; AN EXPORT CAN BE LOCKED WITH A PASSPHRASE; A PRODUCT'S SETTINGS LIVE IN ITS REPOSITORY; SWITCHING PSEUDONYMISATION OFF STATES WHAT FOLLOWS; A PERSON IS NAMED BY ACCOUNT OR WITH CONSENT; THE JUMP HOST AND THE REMOTE SESSIONS ARE SETTINGS
// given: entry 06 replacing a heading that entry 05 creates
// input: open entry 06 and entry 05, then the list (#spec-entry); tick both entries, then Accept ticked
// expect: entry 06 has no Accept of its own and names entry 05; ticked together they are written in one commit in the queue's order with both records and decisions
test("UC-006 4d: an entry whose heading another creates is offered only together with it, naming it; Accept ticked writes both in the queue's order in one commit", async () => {
  const srv = await ucServer();
  const page = await openDashboard({ server: srv, hash: `#spec/${QNAME}/06` });
  const html = page.main();
  assert.match(html, /entry 05/, "it names the entry it needs");
  assert.doesNotMatch(html, /<button class="btn accept" type="button">Accept<\/button>/, "no Accept of its own");
  await page.go(`#spec/${QNAME}/05`);
  await page.go("#spec-entry");
  const boxes = globalThis.document.getElementById("main").querySelectorAll(".tick");
  assert.equal(boxes.length, 2, "both entries can be ticked");
  for (const box of boxes) await tick(srv, box);
  assert.match(page.main(), /Accept ticked \(2\)/);
  await press(srv, inMain(".accept-ticked"));
  assert.equal(srv.writes.length, 1, "one commit");
  const w = srv.writes[0].files;
  const r05 = await specRecordFor(5, P05, B_P05, "## 10. R", SECTION_10);
  const r06 = await specRecordFor(6, P06, B_P06, "## 11. X", "## 11. X\n\n*(not yet approved)*\n");
  assert.equal(w["SPEC.md"], `${SPEC_HEAD}## 10. R\n\nnew ten\n\n${B_P06}`, "both sections, in the queue's order");
  assert.equal(w[r05.path], r05.text);
  assert.equal(w[r06.path], r06.text);
  assert.deepEqual(rowsOf(w[DECISIONS]).map(([nr]) => nr), ["5", "6"]);
});

// TST-474025 · level: component · module: MOD-settings-pages
// guards: UC-001; UC-006; UC-008; UC-014; UC-042; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK; ONE CLICK PER DECISION; EVERY STEP EXPLAINS ITSELF; AN APPROVAL NAMES THE EXACT TEXT; STATUS IS DERIVED FROM THE RECORDS; EDITS ARE PREPARED ON THE DASHBOARD; A SAVE IS REFUSED WHEN THE TEXT CHANGED MEANWHILE; AN EDITED FILE KEEPS ITS IDENTIFIER; WITHOUT A TOKEN, GITHUB'S WEB INTERFACE IS THE FALLBACK; A GITLAB PRODUCT IS WRITTEN WITH A TOKEN; AN ACCEPTED SPEC CHANGE IS WRITTEN WITH ITS APPROVAL; A STALE APPROVAL IS NOT APPLIED; A QUEUE IS ACCEPTED IN ITS ORDER; SEVERAL FILES ARE ACCEPTED IN ONE CLICK; A SPEC EDIT IS SAVED AS A PROPOSAL; ADDING A PRODUCT CREATES ITS LAYOUT; THE DASHBOARD KEEPS ITS PRODUCTS IN THE BROWSER; NO PRODUCT IS NAMED IN THE INSTANCE REPOSITORY; A GITLAB PRODUCT USES A PROJECT ACCESS TOKEN; A TOKEN GOES ONLY TO THE SERVER THAT ISSUED IT; THE SHARED PAGES ORIGIN IS DISCLOSED; THE TOKEN LINK IS PREFILLED; THE REPOSITORY CHOICE IS SPELLED OUT; A BROWSER SETTING IS TESTED AND CLEARED WHERE IT IS SHOWN; A STORED SECRET IS HIDDEN UNTIL SHOWN; A CLEAR IS A REAL CLEAR; A TOKEN'S EXPIRY IS WARNED OF IN ADVANCE; AN EXPIRED TOKEN IS NAMED AND ITS RENEWAL LINKED; SETTINGS ARE EXPORTED AND IMPORTED WITH THEIR SECRETS; AN EXPORT STATES THAT IT CONTAINS SECRETS; AN EXPORT CAN BE LOCKED WITH A PASSPHRASE; A PRODUCT'S SETTINGS LIVE IN ITS REPOSITORY; SWITCHING PSEUDONYMISATION OFF STATES WHAT FOLLOWS; A PERSON IS NAMED BY ACCOUNT OR WITH CONSENT; THE JUMP HOST AND THE REMOTE SESSIONS ARE SETTINGS
// given: entry 06, whose heading entry 05 creates
// input: open the pages of entry 05 and entry 06, tick entry 06 alone on the list, then press Accept ticked
// expect: nothing is written, and the page names the entry it needs
test("UC-006 4d counter-proof: the dependent entry ticked alone cannot be accepted — the page names the entry it needs", async () => {
  const srv = await ucServer();
  const page = await openDashboard({ server: srv, hash: `#spec/${QNAME}/05` });
  await page.go(`#spec/${QNAME}/06`);
  await page.go("#spec-entry");
  const [first, second] = globalThis.document.getElementById("main").querySelectorAll(".tick");
  assert.ok(first && second);
  // The list is in the queue's order: 05 then 06.
  await tick(srv, second);
  await press(srv, inMain(".accept-ticked"));
  assert.deepEqual(srv.writes, []);
  assert.match(page.main(), /entry 05/, "the entry it needs is named");
});

// ================================================================ UC-001 Add a managed product

const PRODUCT = "alice/thesis", PRODUCT_ADDR = `https://github.com/${PRODUCT}`;
const stored = (key) => globalThis.localStorage.getItem(key);

// The product's repository, a second server behind the instance's: GitHub's API under /repos/alice/thesis goes to it.
// refuse: its server refuses a write (403); missing: it does not exist (404 to everything); empty: it has no commit yet.
async function withProduct(files, { refuse = false, missing = false, empty = false } = {}) {
  let ps = null;
  const tree = (url, init) => (init.method === "GET" && url.pathname === `/repos/${PRODUCT}/git/trees/main`
    ? ps.fetch(`${API}/repos/${PRODUCT}/git/trees/${ps.head}?recursive=1`, init) : undefined);
  const refused = (url, init) => (refuse && init.method === "POST" && url.pathname === `/repos/${PRODUCT}/git/trees`
    ? json({ message: "Resource not accessible by personal access token" }, 403) : undefined);
  const gone = () => (missing ? json({ message: "Not Found" }, 404) : undefined);
  ps = await repoServer({ repo: PRODUCT, files, handlers: [gone, refused, tree], empty });
  const srv = await instance({ files: await instanceFiles(),
    handlers: [(url, init) => (url.origin === API && url.pathname.startsWith(`/repos/${PRODUCT}`) ? ps.fetch(url.href, init) : undefined)] });
  return { srv, ps };
}
const addHash = (address) => `#add/${encodeURIComponent(address)}`;

// The whole review layout, as MOD-artifact-edits knows it: the parts reviewLayoutCommit writes into a product that has none of
// it — an empty product behind this file's GitHub fake, reached through MOD-repository-hosts.
async function layoutParts() {
  const empty = await repoServer({ repo: PRODUCT, files: { "README.md": "# Thesis\n" } });
  const real = globalThis.fetch;
  globalThis.fetch = empty.fetch;
  try {
    return (await reviewLayoutCommit(connect(parseAddress(PRODUCT_ADDR), { token: TOKEN }))).written;
  } finally {
    globalThis.fetch = real;
  }
}

const ownKey = (key, expires = null) => ({ ...setting("products", [PRODUCT_ADDR]), ...tokenSetting(`github-token:${PRODUCT}`, key, { expires }) });
const day = (days) => { const n = new Date(); return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()) + days * 864e5).toISOString().slice(0, 10); };

// TST-474026 · level: component · module: MOD-settings-pages
// guards: UC-001; UC-006; UC-008; UC-014; UC-042; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK; ONE CLICK PER DECISION; EVERY STEP EXPLAINS ITSELF; AN APPROVAL NAMES THE EXACT TEXT; STATUS IS DERIVED FROM THE RECORDS; EDITS ARE PREPARED ON THE DASHBOARD; A SAVE IS REFUSED WHEN THE TEXT CHANGED MEANWHILE; AN EDITED FILE KEEPS ITS IDENTIFIER; WITHOUT A TOKEN, GITHUB'S WEB INTERFACE IS THE FALLBACK; A GITLAB PRODUCT IS WRITTEN WITH A TOKEN; AN ACCEPTED SPEC CHANGE IS WRITTEN WITH ITS APPROVAL; A STALE APPROVAL IS NOT APPLIED; A QUEUE IS ACCEPTED IN ITS ORDER; SEVERAL FILES ARE ACCEPTED IN ONE CLICK; A SPEC EDIT IS SAVED AS A PROPOSAL; ADDING A PRODUCT CREATES ITS LAYOUT; THE DASHBOARD KEEPS ITS PRODUCTS IN THE BROWSER; NO PRODUCT IS NAMED IN THE INSTANCE REPOSITORY; A GITLAB PRODUCT USES A PROJECT ACCESS TOKEN; A TOKEN GOES ONLY TO THE SERVER THAT ISSUED IT; THE SHARED PAGES ORIGIN IS DISCLOSED; THE TOKEN LINK IS PREFILLED; THE REPOSITORY CHOICE IS SPELLED OUT; A BROWSER SETTING IS TESTED AND CLEARED WHERE IT IS SHOWN; A STORED SECRET IS HIDDEN UNTIL SHOWN; A CLEAR IS A REAL CLEAR; A TOKEN'S EXPIRY IS WARNED OF IN ADVANCE; AN EXPIRED TOKEN IS NAMED AND ITS RENEWAL LINKED; SETTINGS ARE EXPORTED AND IMPORTED WITH THEIR SECRETS; AN EXPORT STATES THAT IT CONTAINS SECRETS; AN EXPORT CAN BE LOCKED WITH A PASSPHRASE; A PRODUCT'S SETTINGS LIVE IN ITS REPOSITORY; SWITCHING PSEUDONYMISATION OFF STATES WHAT FOLLOWS; A PERSON IS NAMED BY ACCOUNT OR WITH CONSENT; THE JUMP HOST AND THE REMOTE SESSIONS ARE SETTINGS
// given: a GitHub product with a key of its own and one without
// input: open the product's pages (?repo=) with and without its own key
// expect: the product is read with its own key and the instance with the instance's; a product without a key of its own is read with the instance's
test("A GITHUB PRODUCT USES A TOKEN OF ITS OWN — a product's pages are read with its own key, the instance with the instance's; counter-proof: a product without a key of its own is read with the instance's", async () => {
  const key = "github_pat_PRODUCT0123456789abcdefghij";
  const own = await withProduct({ "README.md": "# Thesis\n", "SPEC.md": "# Thesis\n" });
  await openDashboard({ server: own.srv, search: `?repo=${encodeURIComponent(PRODUCT)}`, hash: "#uc", entries: ownKey(key) });
  const read = own.srv.seen.filter((r) => r.url.startsWith(`${API}/repos/${PRODUCT}`));
  assert.ok(read.length && read.every((r) => r.auth === `Bearer ${key}`), "the product, with its own key");
  assert.ok(own.srv.seen.filter((r) => r.url.startsWith(`${API}/repos/${REPO}`)).every((r) => r.auth === `Bearer ${TOKEN}`),
    "the instance, with the instance's");
  const none = await withProduct({ "README.md": "# Thesis\n", "SPEC.md": "# Thesis\n" });
  await openDashboard({ server: none.srv, search: `?repo=${encodeURIComponent(PRODUCT)}`, hash: "#uc",
    entries: setting("products", [PRODUCT_ADDR]) });
  const read2 = none.srv.seen.filter((r) => r.url.startsWith(`${API}/repos/${PRODUCT}`));
  assert.ok(read2.length && read2.every((r) => r.auth === `Bearer ${TOKEN}`), "without a key of its own, the instance's");
});

// TST-474027 · level: component · module: MOD-settings-pages
// guards: UC-001; UC-006; UC-008; UC-014; UC-042; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK; ONE CLICK PER DECISION; EVERY STEP EXPLAINS ITSELF; AN APPROVAL NAMES THE EXACT TEXT; STATUS IS DERIVED FROM THE RECORDS; EDITS ARE PREPARED ON THE DASHBOARD; A SAVE IS REFUSED WHEN THE TEXT CHANGED MEANWHILE; AN EDITED FILE KEEPS ITS IDENTIFIER; WITHOUT A TOKEN, GITHUB'S WEB INTERFACE IS THE FALLBACK; A GITLAB PRODUCT IS WRITTEN WITH A TOKEN; AN ACCEPTED SPEC CHANGE IS WRITTEN WITH ITS APPROVAL; A STALE APPROVAL IS NOT APPLIED; A QUEUE IS ACCEPTED IN ITS ORDER; SEVERAL FILES ARE ACCEPTED IN ONE CLICK; A SPEC EDIT IS SAVED AS A PROPOSAL; ADDING A PRODUCT CREATES ITS LAYOUT; THE DASHBOARD KEEPS ITS PRODUCTS IN THE BROWSER; NO PRODUCT IS NAMED IN THE INSTANCE REPOSITORY; A GITLAB PRODUCT USES A PROJECT ACCESS TOKEN; A TOKEN GOES ONLY TO THE SERVER THAT ISSUED IT; THE SHARED PAGES ORIGIN IS DISCLOSED; THE TOKEN LINK IS PREFILLED; THE REPOSITORY CHOICE IS SPELLED OUT; A BROWSER SETTING IS TESTED AND CLEARED WHERE IT IS SHOWN; A STORED SECRET IS HIDDEN UNTIL SHOWN; A CLEAR IS A REAL CLEAR; A TOKEN'S EXPIRY IS WARNED OF IN ADVANCE; AN EXPIRED TOKEN IS NAMED AND ITS RENEWAL LINKED; SETTINGS ARE EXPORTED AND IMPORTED WITH THEIR SECRETS; AN EXPORT STATES THAT IT CONTAINS SECRETS; AN EXPORT CAN BE LOCKED WITH A PASSPHRASE; A PRODUCT'S SETTINGS LIVE IN ITS REPOSITORY; SWITCHING PSEUDONYMISATION OFF STATES WHAT FOLLOWS; A PERSON IS NAMED BY ACCOUNT OR WITH CONSENT; THE JUMP HOST AND THE REMOTE SESSIONS ARE SETTINGS
// given: a GitHub product whose own key expires in five days
// input: open the product's pages and the instance's pages
// expect: the product's pages name the expiry with Renew at GitHub's list of tokens and where to paste the new value; the instance's pages do not name it
test("A TOKEN'S EXPIRY IS WARNED OF IN ADVANCE — a product's own key that expires within fourteen days is named on the product's pages, with Renew at GitHub's list of tokens and where to paste the new value; counter-proof: the instance's pages do not name it", async () => {
  const soon = new Date(Date.now() + 5 * 864e5).toISOString().slice(0, 10);
  const own = await withProduct({ "README.md": "# Thesis\n" });
  const page = await openDashboard({ server: own.srv, search: `?repo=${encodeURIComponent(PRODUCT)}`, hash: "#uc",
    entries: ownKey("github_pat_PRODUCT0123456789abcdefghij", soon) });
  const banner = page.el("token-banner");
  assert.ok(banner.includes(`Your GitHub token expires on ${soon} (Agent M for ${PRODUCT_ADDR}).`), banner);
  assert.ok(banner.includes('href="https://github.com/settings/personal-access-tokens">Renew</a>'), "Renew at GitHub's list of tokens");
  assert.ok(banner.includes("paste the new value in Settings"), "where the new value is pasted");
  const other = await withProduct({ "README.md": "# Thesis\n" });
  const inst = await openDashboard({ server: other.srv, hash: "#uc", entries: ownKey("github_pat_PRODUCT0123456789abcdefghij", soon) });
  assert.doesNotMatch(inst.el("token-banner"), /for https:\/\/github\.com\//, "counter-proof: the instance's pages do not name the product's key");
});

// TST-474028 · level: component · module: MOD-settings-pages
// guards: UC-001; UC-006; UC-008; UC-014; UC-042; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK; ONE CLICK PER DECISION; EVERY STEP EXPLAINS ITSELF; AN APPROVAL NAMES THE EXACT TEXT; STATUS IS DERIVED FROM THE RECORDS; EDITS ARE PREPARED ON THE DASHBOARD; A SAVE IS REFUSED WHEN THE TEXT CHANGED MEANWHILE; AN EDITED FILE KEEPS ITS IDENTIFIER; WITHOUT A TOKEN, GITHUB'S WEB INTERFACE IS THE FALLBACK; A GITLAB PRODUCT IS WRITTEN WITH A TOKEN; AN ACCEPTED SPEC CHANGE IS WRITTEN WITH ITS APPROVAL; A STALE APPROVAL IS NOT APPLIED; A QUEUE IS ACCEPTED IN ITS ORDER; SEVERAL FILES ARE ACCEPTED IN ONE CLICK; A SPEC EDIT IS SAVED AS A PROPOSAL; ADDING A PRODUCT CREATES ITS LAYOUT; THE DASHBOARD KEEPS ITS PRODUCTS IN THE BROWSER; NO PRODUCT IS NAMED IN THE INSTANCE REPOSITORY; A GITLAB PRODUCT USES A PROJECT ACCESS TOKEN; A TOKEN GOES ONLY TO THE SERVER THAT ISSUED IT; THE SHARED PAGES ORIGIN IS DISCLOSED; THE TOKEN LINK IS PREFILLED; THE REPOSITORY CHOICE IS SPELLED OUT; A BROWSER SETTING IS TESTED AND CLEARED WHERE IT IS SHOWN; A STORED SECRET IS HIDDEN UNTIL SHOWN; A CLEAR IS A REAL CLEAR; A TOKEN'S EXPIRY IS WARNED OF IN ADVANCE; AN EXPIRED TOKEN IS NAMED AND ITS RENEWAL LINKED; SETTINGS ARE EXPORTED AND IMPORTED WITH THEIR SECRETS; AN EXPORT STATES THAT IT CONTAINS SECRETS; AN EXPORT CAN BE LOCKED WITH A PASSPHRASE; A PRODUCT'S SETTINGS LIVE IN ITS REPOSITORY; SWITCHING PSEUDONYMISATION OFF STATES WHAT FOLLOWS; A PERSON IS NAMED BY ACCOUNT OR WITH CONSENT; THE JUMP HOST AND THE REMOTE SESSIONS ARE SETTINGS
// given: Settings with a GitHub product that has its own key stored with name and expiry
// input: hide/show, Test, Change with the notice ticked, Clear, and Remove
// expect: the key is hidden until shown with its expiry; Test reads the product with it and stores the result; Change focuses the notice then the field and stores the new value for the product only; Clear asks first and removes it; Remove takes it with the product
test("UC-042 · A GITHUB PRODUCT USES A TOKEN OF ITS OWN — Settings lists each GitHub product's own key: hidden until shown, its expiry, Test reads the product with it, Change opens with its field focused and stores a new value, Clear removes it after a confirmation; Remove takes it with the product", async () => {
  const key = "github_pat_PRODUCT0123456789abcdefghij";
  const own = await withProduct({ "README.md": "# Thesis\n" });
  const { srv, box, dom } = await publicSettingsPage({ server: own.srv, settings: { products: [PRODUCT_ADDR], [`github-token:${PRODUCT}`]: { value: key, name: "Agent M", expires: "2026-12-29", stored: day(0) } } });
  const label = `GitHub token: ${PRODUCT}`;
  const secret = publicRepositoryControl(box, label, "secret");
  assert.equal(secret.type, "password", "hidden until shown");
  assert.equal(publicRepositoryControl(box, label, "expiry").value, "2026-12-29", "the product key's expiry");
  await publicPress(srv, publicRepositoryControl(box, label, "test"));
  assert.ok(srv.seen.some((r) => r.url === `${API}/repos/${PRODUCT}` && r.auth === `Bearer ${key}`), "Test reads the product with its own key");
  assert.match(publicRepositoryControl(box, label, "status").textContent, /Last successful test/);
  const productLastTest = JSON.parse(globalThis.localStorage.getItem(`agent-m:akmaier/agent-m:last-test:github-token:${PRODUCT}`));
  assert.equal(productLastTest.outcome, "working", "its successful test result is stored beside this product key");
  assert.match(productLastTest.at, new RegExp(`^${day(0)}`), "its successful test date is stored beside this product key");
  await publicPress(srv, publicRepositoryControl(box, label, "change"));
  const acknowledgement = publicRepositoryControl(box, label, "ack");
  assert.equal(dom.focused(), acknowledgement, "Change opens with the notice focused");
  acknowledgement.checked = true; acknowledgement.fire("change", {});
  assert.equal(dom.focused(), secret, "the new key's field is focused after the notice");
  const newer = "github_pat_NEWER0123456789abcdefghij";
  secret.value = newer;
  await publicPress(srv, publicRepositoryControl(box, label, "save"));
  assert.equal(JSON.parse(globalThis.localStorage.getItem(`agent-m:akmaier/agent-m:github-token:${PRODUCT}`)).value, newer, "the new value, for the product");
  assert.equal(JSON.parse(globalThis.localStorage.getItem("agent-m:akmaier/agent-m:github-token")).value, TOKEN, "the instance's key is untouched");
  await publicPress(srv, publicRepositoryControl(box, label, "clear"));
  assert.ok(confirms.length >= 1, "Clear asks first");
  assert.equal(globalThis.localStorage.getItem(`agent-m:akmaier/agent-m:github-token:${PRODUCT}`), null, "the key is gone from this browser");
  // Remove: the product leaves the list with its key.
  globalThis.localStorage.setItem(`agent-m:akmaier/agent-m:github-token:${PRODUCT}`, JSON.stringify({ value: key, name: "Agent M", expires: null }));
  await publicPress(srv, publicControls(box(), "settings-product-remove")[0]);
  assert.equal(globalThis.localStorage.getItem(`agent-m:akmaier/agent-m:github-token:${PRODUCT}`), null, "removed with the product");
  assert.deepEqual(JSON.parse(globalThis.localStorage.getItem("agent-m:akmaier/agent-m:products")), []);
});

// A GitLab server behind the instance's: requests to its origin go to it.
async function withGitLab(files = { "README.md": "# proj\n" }) {
  const gl = await fakeGitLab({ files });
  const srv = await instance({ files: await instanceFiles(), handlers: [(url, init) => (url.origin === GL ? gl.fetchMock(url.href, init) : undefined)] });
  return { srv, gl };
}

// TST-474029 · level: component · module: MOD-settings-pages
// guards: UC-001; UC-006; UC-008; UC-014; UC-042; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK; ONE CLICK PER DECISION; EVERY STEP EXPLAINS ITSELF; AN APPROVAL NAMES THE EXACT TEXT; STATUS IS DERIVED FROM THE RECORDS; EDITS ARE PREPARED ON THE DASHBOARD; A SAVE IS REFUSED WHEN THE TEXT CHANGED MEANWHILE; AN EDITED FILE KEEPS ITS IDENTIFIER; WITHOUT A TOKEN, GITHUB'S WEB INTERFACE IS THE FALLBACK; A GITLAB PRODUCT IS WRITTEN WITH A TOKEN; AN ACCEPTED SPEC CHANGE IS WRITTEN WITH ITS APPROVAL; A STALE APPROVAL IS NOT APPLIED; A QUEUE IS ACCEPTED IN ITS ORDER; SEVERAL FILES ARE ACCEPTED IN ONE CLICK; A SPEC EDIT IS SAVED AS A PROPOSAL; ADDING A PRODUCT CREATES ITS LAYOUT; THE DASHBOARD KEEPS ITS PRODUCTS IN THE BROWSER; NO PRODUCT IS NAMED IN THE INSTANCE REPOSITORY; A GITLAB PRODUCT USES A PROJECT ACCESS TOKEN; A TOKEN GOES ONLY TO THE SERVER THAT ISSUED IT; THE SHARED PAGES ORIGIN IS DISCLOSED; THE TOKEN LINK IS PREFILLED; THE REPOSITORY CHOICE IS SPELLED OUT; A BROWSER SETTING IS TESTED AND CLEARED WHERE IT IS SHOWN; A STORED SECRET IS HIDDEN UNTIL SHOWN; A CLEAR IS A REAL CLEAR; A TOKEN'S EXPIRY IS WARNED OF IN ADVANCE; AN EXPIRED TOKEN IS NAMED AND ITS RENEWAL LINKED; SETTINGS ARE EXPORTED AND IMPORTED WITH THEIR SECRETS; AN EXPORT STATES THAT IT CONTAINS SECRETS; AN EXPORT CAN BE LOCKED WITH A PASSPHRASE; A PRODUCT'S SETTINGS LIVE IN ITS REPOSITORY; SWITCHING PSEUDONYMISATION OFF STATES WHAT FOLLOWS; A PERSON IS NAMED BY ACCOUNT OR WITH CONSENT; THE JUMP HOST AND THE REMOTE SESSIONS ARE SETTINGS
// given: a start page with and without a token
// input: open #uc without a token, then with one
// expect: without a token Finish setting up is shown with Set up now and Import settings; with a token it is not
test("UC-014 step 6: without a token the start page shows Finish setting up, with Set up now and Import settings; with one it does not", async () => {
  const page = await openDashboard({ server: await ucServer(), hash: "#uc", token: null });
  assert.match(page.main(), /<h3>Finish setting up your instance<\/h3>/);
  assert.match(page.main(), /<a class="btn primary" href="#setup">Set up now<\/a> <a class="btn" href="#settings">Import settings<\/a>/);
  const set = await openDashboard({ server: await ucServer(), hash: "#uc" });
  assert.doesNotMatch(set.main(), /Finish setting up/);
});

// ================================================================ UC-042 Manage settings in one place

const confirms = [];
let confirmAnswer = true;
globalThis.confirm = (text) => { confirms.push(text); return confirmAnswer; };
const publicControls = (root, name, out = []) => { for (const child of root?.children ?? []) { if (typeof child !== "object") continue; if (child.className?.split(" ").includes(name)) out.push(child); publicControls(child, name, out); } return out; };
const publicRepositoryRow = (box, label) => publicControls(box(), "settings-repository").find((row) => row.textContent.includes(label));
const publicRepositoryControl = (box, label, name) => publicControls(publicRepositoryRow(box, label), `settings-repository-${name}`)[0];
async function publicSettingsPage({ server = null, token = TOKEN, settings = {}, caches = null, writableProduct = false } = {}) {
  confirms.length = 0;
  confirmAnswer = true;
  const storedSettings = { "github-token": { value: TOKEN, name: "GitHub token", expires: day(90), stored: day(0) }, ...settings };
  const entries = Object.fromEntries(Object.entries(storedSettings).map(([key, value]) => [`agent-m:akmaier/agent-m:${key}`, JSON.stringify(value)]));
  const writable = (url) => url.href === `${API}/repos/${REPO}` ? json({ private: false, default_branch: "main", permissions: { push: true } }) : undefined;
  const srv = server ?? await ucServer({}, writableProduct ? [writable] : []), page = await openDashboard({ server: srv, hash: "#uc", token, entries, ...(caches ? { caches } : {}) });
  const dom = richDocument(), createElement = globalThis.document.createElement.bind(globalThis.document), main = dom.byId("main"), replace = main.replaceChildren.bind(main); let mounted = [];
  globalThis.document.createElement = (name) => {
    const node = createElement(name);
    if (!("childNodes" in node)) Object.defineProperty(node, "childNodes", { get: () => node.children ?? [] });
    return node;
  };
  main.replaceChildren = (...children) => { mounted = children; replace(...children); };
  await page.go("#settings");
  const pane = (name) => mounted.find((node) => node.className === "settings-tab-panel" && node.textContent.includes(name));
  return { srv, page, dom, tabs: () => mounted.find((node) => node.className === "settings-tabs"), box: () => pane("Repositories"), general: () => pane("General"), endpoints: () => pane("Endpoints & Agents"), usability: () => pane("Usability") };
}
async function publicBridgePage(options = {}) {
  const settings = await publicSettingsPage(options);
  const main = settings.dom.byId("main"), replace = main.replaceChildren.bind(main);
  let mounted = [];
  main.replaceChildren = (...children) => { mounted = children; replace(...children); };
  await settings.page.go("#bridge");
  return { ...settings, mounted: () => ({ children: mounted }) };
}
// Until `cond` holds — for work that waits on the browser's cryptography rather than on a request.
async function until(cond, what) {
  for (let i = 0; i < 4000; i++) { if (cond()) return; await new Promise((r) => setTimeout(r, 5)); }
  throw new Error(`waited in vain for ${what}`);
}

// TST-474033 · level: component · module: MOD-settings-pages
// guards: UC-001; UC-006; UC-008; UC-014; UC-042; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK; ONE CLICK PER DECISION; EVERY STEP EXPLAINS ITSELF; AN APPROVAL NAMES THE EXACT TEXT; STATUS IS DERIVED FROM THE RECORDS; EDITS ARE PREPARED ON THE DASHBOARD; A SAVE IS REFUSED WHEN THE TEXT CHANGED MEANWHILE; AN EDITED FILE KEEPS ITS IDENTIFIER; WITHOUT A TOKEN, GITHUB'S WEB INTERFACE IS THE FALLBACK; A GITLAB PRODUCT IS WRITTEN WITH A TOKEN; AN ACCEPTED SPEC CHANGE IS WRITTEN WITH ITS APPROVAL; A STALE APPROVAL IS NOT APPLIED; A QUEUE IS ACCEPTED IN ITS ORDER; SEVERAL FILES ARE ACCEPTED IN ONE CLICK; A SPEC EDIT IS SAVED AS A PROPOSAL; ADDING A PRODUCT CREATES ITS LAYOUT; THE DASHBOARD KEEPS ITS PRODUCTS IN THE BROWSER; NO PRODUCT IS NAMED IN THE INSTANCE REPOSITORY; A GITLAB PRODUCT USES A PROJECT ACCESS TOKEN; A TOKEN GOES ONLY TO THE SERVER THAT ISSUED IT; THE SHARED PAGES ORIGIN IS DISCLOSED; THE TOKEN LINK IS PREFILLED; THE REPOSITORY CHOICE IS SPELLED OUT; A BROWSER SETTING IS TESTED AND CLEARED WHERE IT IS SHOWN; A STORED SECRET IS HIDDEN UNTIL SHOWN; A CLEAR IS A REAL CLEAR; A TOKEN'S EXPIRY IS WARNED OF IN ADVANCE; AN EXPIRED TOKEN IS NAMED AND ITS RENEWAL LINKED; SETTINGS ARE EXPORTED AND IMPORTED WITH THEIR SECRETS; AN EXPORT STATES THAT IT CONTAINS SECRETS; AN EXPORT CAN BE LOCKED WITH A PASSPHRASE; A PRODUCT'S SETTINGS LIVE IN ITS REPOSITORY; SWITCHING PSEUDONYMISATION OFF STATES WHAT FOLLOWS; A PERSON IS NAMED BY ACCOUNT OR WITH CONSENT; THE JUMP HOST AND THE REMOTE SESSIONS ARE SETTINGS
// given: Settings with a GitHub product, a GitLab product, a jump host, a remote session and an endpoint stored
// input: open #settings
// expect: the tabs General, Repositories, Endpoints & Agents and Usability keep every scope and control reachable: the token controls, the export and import controls and the four repository rows
test("UC-042 step 1: public component tabs keep every settings scope and existing control reachable", async () => {
  const { page, tabs, box, general, endpoints, usability } = await publicSettingsPage({ settings: {
    products: [PRODUCT_ADDR, GL_ADDR], [`github-token:${PRODUCT}`]: { value: "github_pat_PRODUCT0123456789abcdefghij", name: "Agent M", expires: day(60), stored: day(0) },
    [GL_TOKEN_KEY]: { value: GL_TOKEN, name: "Agent M", expires: day(60), stored: day(0) },
    "jump-host": { hostname: "jump.example.org", user: "agentm", sshPort: 22, portRange: [20001, 20003] },
    "remote-session:lab-pc": { port: 20001, token: "bridgeTOKEN-0123456789abcdef" }, "endpoint:main": { url: "https://models.example.test/v1", model: "small", key: "endpoint-key" },
  } });
  assert.match(page.main(), /<h2>Settings<\/h2>/);
  assert.deepEqual(tabs().children.map((tab) => tab.textContent), ["General", "Repositories", "Endpoints & Agents", "Usability"]);
  assert.match(general().textContent, /every GitHub Pages site under that same akmaier\.github\.io domain can read it/i);
  assert.equal(publicRepositoryControl(box, "GitHub token", "secret").type, "password");
  assert.equal(publicControls(box(), "settings-repository").length, 4, "instance, product list, GitHub product, GitLab product");
  for (const control of ["show", "test", "change", "clear", "renew"]) assert.ok(publicRepositoryControl(box, "GitHub token", control), control);
  assert.ok(publicControls(general(), "settings-export-download")[0]);
  assert.ok(publicControls(general(), "settings-import-file")[0]);
  assert.ok(publicControls(general(), "settings-clear-everything")[0]);
  assert.match(publicControls(box(), "settings-product")[0].textContent, /Pseudonymisation is on\.[\s\S]*Collaborators/);
  assert.doesNotMatch(publicControls(box(), "settings-collaborator-records")[0].textContent, /@/, "no collaborator is named by default");
  assert.ok(publicControls(endpoints(), "settings-endpoint-configure")[0]);
  assert.ok(publicControls(endpoints(), "settings-bridge-configure")[0]);
  assert.ok(publicControls(endpoints(), "settings-endpoint")[0]);
  assert.ok(publicControls(endpoints(), "settings-jump-host")[0]);
  assert.ok(publicControls(endpoints(), "settings-remote-session")[0]);
  assert.ok(publicControls(general(), "settings-browser-explanation")[0]);
  assert.ok(publicControls(box(), "settings-repository-shared-origin").length >= 3);
  assert.ok(publicControls(endpoints(), "settings-endpoint-explanation")[0]);
  assert.ok(publicControls(usability(), "settings-notifications-on")[0]);
});

// TST-474034 · level: component · module: MOD-settings-pages
// guards: UC-001; UC-006; UC-008; UC-014; UC-042; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK; ONE CLICK PER DECISION; EVERY STEP EXPLAINS ITSELF; AN APPROVAL NAMES THE EXACT TEXT; STATUS IS DERIVED FROM THE RECORDS; EDITS ARE PREPARED ON THE DASHBOARD; A SAVE IS REFUSED WHEN THE TEXT CHANGED MEANWHILE; AN EDITED FILE KEEPS ITS IDENTIFIER; WITHOUT A TOKEN, GITHUB'S WEB INTERFACE IS THE FALLBACK; A GITLAB PRODUCT IS WRITTEN WITH A TOKEN; AN ACCEPTED SPEC CHANGE IS WRITTEN WITH ITS APPROVAL; A STALE APPROVAL IS NOT APPLIED; A QUEUE IS ACCEPTED IN ITS ORDER; SEVERAL FILES ARE ACCEPTED IN ONE CLICK; A SPEC EDIT IS SAVED AS A PROPOSAL; ADDING A PRODUCT CREATES ITS LAYOUT; THE DASHBOARD KEEPS ITS PRODUCTS IN THE BROWSER; NO PRODUCT IS NAMED IN THE INSTANCE REPOSITORY; A GITLAB PRODUCT USES A PROJECT ACCESS TOKEN; A TOKEN GOES ONLY TO THE SERVER THAT ISSUED IT; THE SHARED PAGES ORIGIN IS DISCLOSED; THE TOKEN LINK IS PREFILLED; THE REPOSITORY CHOICE IS SPELLED OUT; A BROWSER SETTING IS TESTED AND CLEARED WHERE IT IS SHOWN; A STORED SECRET IS HIDDEN UNTIL SHOWN; A CLEAR IS A REAL CLEAR; A TOKEN'S EXPIRY IS WARNED OF IN ADVANCE; AN EXPIRED TOKEN IS NAMED AND ITS RENEWAL LINKED; SETTINGS ARE EXPORTED AND IMPORTED WITH THEIR SECRETS; AN EXPORT STATES THAT IT CONTAINS SECRETS; AN EXPORT CAN BE LOCKED WITH A PASSPHRASE; A PRODUCT'S SETTINGS LIVE IN ITS REPOSITORY; SWITCHING PSEUDONYMISATION OFF STATES WHAT FOLLOWS; A PERSON IS NAMED BY ACCOUNT OR WITH CONSENT; THE JUMP HOST AND THE REMOTE SESSIONS ARE SETTINGS
// given: Settings with a stored token
// input: press Show, then Hide
// expect: the secret is hidden by default, shown in full after Show and hidden again after Hide
test("UC-042 step 1: a stored secret is hidden until Show, which reveals it in full; Hide hides it again", async () => {
  const { srv, box } = await publicSettingsPage();
  const secret = publicRepositoryControl(box, "GitHub token", "secret");
  const show = publicRepositoryControl(box, "GitHub token", "show");
  await publicPress(srv, show);
  assert.equal(secret.type, "text");
  assert.equal(secret.value, TOKEN, "Show reveals the complete stored token");
  assert.equal(show.textContent, "Hide");
  await publicPress(srv, show);
  assert.equal(secret.type, "password");
  assert.equal(show.textContent, "Show");
});

// TST-474035 · level: component · module: MOD-settings-pages
// guards: UC-001; UC-006; UC-008; UC-014; UC-042; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK; ONE CLICK PER DECISION; EVERY STEP EXPLAINS ITSELF; AN APPROVAL NAMES THE EXACT TEXT; STATUS IS DERIVED FROM THE RECORDS; EDITS ARE PREPARED ON THE DASHBOARD; A SAVE IS REFUSED WHEN THE TEXT CHANGED MEANWHILE; AN EDITED FILE KEEPS ITS IDENTIFIER; WITHOUT A TOKEN, GITHUB'S WEB INTERFACE IS THE FALLBACK; A GITLAB PRODUCT IS WRITTEN WITH A TOKEN; AN ACCEPTED SPEC CHANGE IS WRITTEN WITH ITS APPROVAL; A STALE APPROVAL IS NOT APPLIED; A QUEUE IS ACCEPTED IN ITS ORDER; SEVERAL FILES ARE ACCEPTED IN ONE CLICK; A SPEC EDIT IS SAVED AS A PROPOSAL; ADDING A PRODUCT CREATES ITS LAYOUT; THE DASHBOARD KEEPS ITS PRODUCTS IN THE BROWSER; NO PRODUCT IS NAMED IN THE INSTANCE REPOSITORY; A GITLAB PRODUCT USES A PROJECT ACCESS TOKEN; A TOKEN GOES ONLY TO THE SERVER THAT ISSUED IT; THE SHARED PAGES ORIGIN IS DISCLOSED; THE TOKEN LINK IS PREFILLED; THE REPOSITORY CHOICE IS SPELLED OUT; A BROWSER SETTING IS TESTED AND CLEARED WHERE IT IS SHOWN; A STORED SECRET IS HIDDEN UNTIL SHOWN; A CLEAR IS A REAL CLEAR; A TOKEN'S EXPIRY IS WARNED OF IN ADVANCE; AN EXPIRED TOKEN IS NAMED AND ITS RENEWAL LINKED; SETTINGS ARE EXPORTED AND IMPORTED WITH THEIR SECRETS; AN EXPORT STATES THAT IT CONTAINS SECRETS; AN EXPORT CAN BE LOCKED WITH A PASSPHRASE; A PRODUCT'S SETTINGS LIVE IN ITS REPOSITORY; SWITCHING PSEUDONYMISATION OFF STATES WHAT FOLLOWS; A PERSON IS NAMED BY ACCOUNT OR WITH CONSENT; THE JUMP HOST AND THE REMOTE SESSIONS ARE SETTINGS
// given: Settings with a stored token
// input: press Test
// expect: one harmless test of the token goes to its own server — the GraphQL request of greenToMerge (ITM-1170) and, with it, the repository's record, both with the token — and the page shows that it works
test("UC-042 step 2: Test sends one harmless request with the token to its own server and shows that it works", async () => {
  const { srv, box } = await publicSettingsPage();
  const from = srv.seen.length;
  await publicPress(srv, publicRepositoryControl(box, "GitHub token", "test"));
  // ITM-1170: beside the record, the one GraphQL request of greenToMerge, to the same server with the same token.
  assert.deepEqual(srv.seen.slice(from).map((r) => [r.method, r.url, r.auth]), [["POST", `${API}/graphql`, `Bearer ${TOKEN}`], ["GET", `${API}/repos/${REPO}`, `Bearer ${TOKEN}`]]);
  assert.match(publicRepositoryControl(box, "GitHub token", "status").textContent, new RegExp(`Last successful test: ${day(0)}`));
  assert.equal(publicRepositoryControl(box, "GitHub token", "result").textContent, "✓ The repository token is working.");
});

// TST-474036 · level: component · module: MOD-settings-pages
// guards: UC-001; UC-006; UC-008; UC-014; UC-042; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK; ONE CLICK PER DECISION; EVERY STEP EXPLAINS ITSELF; AN APPROVAL NAMES THE EXACT TEXT; STATUS IS DERIVED FROM THE RECORDS; EDITS ARE PREPARED ON THE DASHBOARD; A SAVE IS REFUSED WHEN THE TEXT CHANGED MEANWHILE; AN EDITED FILE KEEPS ITS IDENTIFIER; WITHOUT A TOKEN, GITHUB'S WEB INTERFACE IS THE FALLBACK; A GITLAB PRODUCT IS WRITTEN WITH A TOKEN; AN ACCEPTED SPEC CHANGE IS WRITTEN WITH ITS APPROVAL; A STALE APPROVAL IS NOT APPLIED; A QUEUE IS ACCEPTED IN ITS ORDER; SEVERAL FILES ARE ACCEPTED IN ONE CLICK; A SPEC EDIT IS SAVED AS A PROPOSAL; ADDING A PRODUCT CREATES ITS LAYOUT; THE DASHBOARD KEEPS ITS PRODUCTS IN THE BROWSER; NO PRODUCT IS NAMED IN THE INSTANCE REPOSITORY; A GITLAB PRODUCT USES A PROJECT ACCESS TOKEN; A TOKEN GOES ONLY TO THE SERVER THAT ISSUED IT; THE SHARED PAGES ORIGIN IS DISCLOSED; THE TOKEN LINK IS PREFILLED; THE REPOSITORY CHOICE IS SPELLED OUT; A BROWSER SETTING IS TESTED AND CLEARED WHERE IT IS SHOWN; A STORED SECRET IS HIDDEN UNTIL SHOWN; A CLEAR IS A REAL CLEAR; A TOKEN'S EXPIRY IS WARNED OF IN ADVANCE; AN EXPIRED TOKEN IS NAMED AND ITS RENEWAL LINKED; SETTINGS ARE EXPORTED AND IMPORTED WITH THEIR SECRETS; AN EXPORT STATES THAT IT CONTAINS SECRETS; AN EXPORT CAN BE LOCKED WITH A PASSPHRASE; A PRODUCT'S SETTINGS LIVE IN ITS REPOSITORY; SWITCHING PSEUDONYMISATION OFF STATES WHAT FOLLOWS; A PERSON IS NAMED BY ACCOUNT OR WITH CONSENT; THE JUMP HOST AND THE REMOTE SESSIONS ARE SETTINGS
// given: Settings with a stored token
// input: press Clear and confirm
// expect: one confirmation saying what no longer works, then the token is removed from localStorage
test("UC-042 step 2: Clear removes the token from localStorage after one confirmation that says what no longer works", async () => {
  const { srv, box } = await publicSettingsPage({ settings: { "github-token": { value: TOKEN, name: "GitHub token", expires: day(60), stored: day(0) } } });
  await publicPress(srv, publicRepositoryControl(box, "GitHub token", "clear"));
  assert.deepEqual(confirms, ["Clear this token from this browser? Without it, accepting and editing go through GitHub's own pages, " +
    "products cannot be added, and private repositories cannot be read."]);
  assert.equal(globalThis.localStorage.getItem("agent-m:akmaier/agent-m:github-token"), null);
  assert.equal(globalThis.localStorage.getItem("agent-m:akmaier/agent-m:last-test:github-token"), null, "its test date with it");
  assert.match(publicRepositoryControl(box, "GitHub token", "status").textContent, /Cleared from this browser/);
});

// TST-474037 · level: component · module: MOD-settings-pages
// guards: UC-001; UC-006; UC-008; UC-014; UC-042; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK; ONE CLICK PER DECISION; EVERY STEP EXPLAINS ITSELF; AN APPROVAL NAMES THE EXACT TEXT; STATUS IS DERIVED FROM THE RECORDS; EDITS ARE PREPARED ON THE DASHBOARD; A SAVE IS REFUSED WHEN THE TEXT CHANGED MEANWHILE; AN EDITED FILE KEEPS ITS IDENTIFIER; WITHOUT A TOKEN, GITHUB'S WEB INTERFACE IS THE FALLBACK; A GITLAB PRODUCT IS WRITTEN WITH A TOKEN; AN ACCEPTED SPEC CHANGE IS WRITTEN WITH ITS APPROVAL; A STALE APPROVAL IS NOT APPLIED; A QUEUE IS ACCEPTED IN ITS ORDER; SEVERAL FILES ARE ACCEPTED IN ONE CLICK; A SPEC EDIT IS SAVED AS A PROPOSAL; ADDING A PRODUCT CREATES ITS LAYOUT; THE DASHBOARD KEEPS ITS PRODUCTS IN THE BROWSER; NO PRODUCT IS NAMED IN THE INSTANCE REPOSITORY; A GITLAB PRODUCT USES A PROJECT ACCESS TOKEN; A TOKEN GOES ONLY TO THE SERVER THAT ISSUED IT; THE SHARED PAGES ORIGIN IS DISCLOSED; THE TOKEN LINK IS PREFILLED; THE REPOSITORY CHOICE IS SPELLED OUT; A BROWSER SETTING IS TESTED AND CLEARED WHERE IT IS SHOWN; A STORED SECRET IS HIDDEN UNTIL SHOWN; A CLEAR IS A REAL CLEAR; A TOKEN'S EXPIRY IS WARNED OF IN ADVANCE; AN EXPIRED TOKEN IS NAMED AND ITS RENEWAL LINKED; SETTINGS ARE EXPORTED AND IMPORTED WITH THEIR SECRETS; AN EXPORT STATES THAT IT CONTAINS SECRETS; AN EXPORT CAN BE LOCKED WITH A PASSPHRASE; A PRODUCT'S SETTINGS LIVE IN ITS REPOSITORY; SWITCHING PSEUDONYMISATION OFF STATES WHAT FOLLOWS; A PERSON IS NAMED BY ACCOUNT OR WITH CONSENT; THE JUMP HOST AND THE REMOTE SESSIONS ARE SETTINGS
// given: Settings with a stored token
// input: press Clear and refuse the confirmation
// expect: the token is kept
test("UC-042 step 2 counter-proof: a Clear that is not confirmed keeps the token", async () => {
  const { srv, box } = await publicSettingsPage();
  confirmAnswer = false;
  await publicPress(srv, publicRepositoryControl(box, "GitHub token", "clear"));
  assert.equal(confirms.length, 1);
  assert.equal(JSON.parse(globalThis.localStorage.getItem("agent-m:akmaier/agent-m:github-token")).value, TOKEN);
});

// TST-474038 · level: component · module: MOD-settings-pages
// guards: UC-001; UC-006; UC-008; UC-014; UC-042; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK; ONE CLICK PER DECISION; EVERY STEP EXPLAINS ITSELF; AN APPROVAL NAMES THE EXACT TEXT; STATUS IS DERIVED FROM THE RECORDS; EDITS ARE PREPARED ON THE DASHBOARD; A SAVE IS REFUSED WHEN THE TEXT CHANGED MEANWHILE; AN EDITED FILE KEEPS ITS IDENTIFIER; WITHOUT A TOKEN, GITHUB'S WEB INTERFACE IS THE FALLBACK; A GITLAB PRODUCT IS WRITTEN WITH A TOKEN; AN ACCEPTED SPEC CHANGE IS WRITTEN WITH ITS APPROVAL; A STALE APPROVAL IS NOT APPLIED; A QUEUE IS ACCEPTED IN ITS ORDER; SEVERAL FILES ARE ACCEPTED IN ONE CLICK; A SPEC EDIT IS SAVED AS A PROPOSAL; ADDING A PRODUCT CREATES ITS LAYOUT; THE DASHBOARD KEEPS ITS PRODUCTS IN THE BROWSER; NO PRODUCT IS NAMED IN THE INSTANCE REPOSITORY; A GITLAB PRODUCT USES A PROJECT ACCESS TOKEN; A TOKEN GOES ONLY TO THE SERVER THAT ISSUED IT; THE SHARED PAGES ORIGIN IS DISCLOSED; THE TOKEN LINK IS PREFILLED; THE REPOSITORY CHOICE IS SPELLED OUT; A BROWSER SETTING IS TESTED AND CLEARED WHERE IT IS SHOWN; A STORED SECRET IS HIDDEN UNTIL SHOWN; A CLEAR IS A REAL CLEAR; A TOKEN'S EXPIRY IS WARNED OF IN ADVANCE; AN EXPIRED TOKEN IS NAMED AND ITS RENEWAL LINKED; SETTINGS ARE EXPORTED AND IMPORTED WITH THEIR SECRETS; AN EXPORT STATES THAT IT CONTAINS SECRETS; AN EXPORT CAN BE LOCKED WITH A PASSPHRASE; A PRODUCT'S SETTINGS LIVE IN ITS REPOSITORY; SWITCHING PSEUDONYMISATION OFF STATES WHAT FOLLOWS; A PERSON IS NAMED BY ACCOUNT OR WITH CONSENT; THE JUMP HOST AND THE REMOTE SESSIONS ARE SETTINGS
// given: Settings with a stored token and the notice at the top
// input: tick the notice, press Change, enter a new token with an expiry date and store it
// expect: the new token is stored with its expiry date
test("UC-042 step 2: Change stores a new token with its expiry date, after the notice at the top is ticked", async () => {
  const { srv, box } = await publicSettingsPage({ settings: { "github-token": { value: TOKEN, name: "GitHub token", expires: null, stored: day(0) } } });
  const row = publicRepositoryRow(box, "GitHub token");
  const acknowledgement = publicRepositoryControl(box, "GitHub token", "ack");
  const save = publicRepositoryControl(box, "GitHub token", "save");
  assert.equal(acknowledgement.disabled, true, "acknowledgement stays hidden until Change");
  assert.equal(save.disabled, true, "storing waits for Change and the notice");
  await publicPress(srv, publicRepositoryControl(box, "GitHub token", "change"));
  assert.equal(acknowledgement.disabled, false);
  assert.equal(publicRepositoryControl(box, "GitHub token", "expiry").value, day(90), "preset to the 90 days of the prefilled link");
  acknowledgement.checked = true; acknowledgement.fire("change", {});
  const key = "github_pat_RENEWED0123456789abcdefghij";
  publicRepositoryControl(box, "GitHub token", "secret").value = key;
  await publicPress(srv, save);
  assert.equal(JSON.parse(globalThis.localStorage.getItem("agent-m:akmaier/agent-m:github-token")).value, key);
  assert.equal(JSON.parse(globalThis.localStorage.getItem("agent-m:akmaier/agent-m:github-token")).expires, day(90));
  assert.equal(publicRepositoryControl(box, "GitHub token", "result").textContent, "Saved in this browser. Test it before using it.");
});

// TST-474039 · level: component · module: MOD-settings-pages
// guards: UC-001; UC-006; UC-008; UC-014; UC-042; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK; ONE CLICK PER DECISION; EVERY STEP EXPLAINS ITSELF; AN APPROVAL NAMES THE EXACT TEXT; STATUS IS DERIVED FROM THE RECORDS; EDITS ARE PREPARED ON THE DASHBOARD; A SAVE IS REFUSED WHEN THE TEXT CHANGED MEANWHILE; AN EDITED FILE KEEPS ITS IDENTIFIER; WITHOUT A TOKEN, GITHUB'S WEB INTERFACE IS THE FALLBACK; A GITLAB PRODUCT IS WRITTEN WITH A TOKEN; AN ACCEPTED SPEC CHANGE IS WRITTEN WITH ITS APPROVAL; A STALE APPROVAL IS NOT APPLIED; A QUEUE IS ACCEPTED IN ITS ORDER; SEVERAL FILES ARE ACCEPTED IN ONE CLICK; A SPEC EDIT IS SAVED AS A PROPOSAL; ADDING A PRODUCT CREATES ITS LAYOUT; THE DASHBOARD KEEPS ITS PRODUCTS IN THE BROWSER; NO PRODUCT IS NAMED IN THE INSTANCE REPOSITORY; A GITLAB PRODUCT USES A PROJECT ACCESS TOKEN; A TOKEN GOES ONLY TO THE SERVER THAT ISSUED IT; THE SHARED PAGES ORIGIN IS DISCLOSED; THE TOKEN LINK IS PREFILLED; THE REPOSITORY CHOICE IS SPELLED OUT; A BROWSER SETTING IS TESTED AND CLEARED WHERE IT IS SHOWN; A STORED SECRET IS HIDDEN UNTIL SHOWN; A CLEAR IS A REAL CLEAR; A TOKEN'S EXPIRY IS WARNED OF IN ADVANCE; AN EXPIRED TOKEN IS NAMED AND ITS RENEWAL LINKED; SETTINGS ARE EXPORTED AND IMPORTED WITH THEIR SECRETS; AN EXPORT STATES THAT IT CONTAINS SECRETS; AN EXPORT CAN BE LOCKED WITH A PASSPHRASE; A PRODUCT'S SETTINGS LIVE IN ITS REPOSITORY; SWITCHING PSEUDONYMISATION OFF STATES WHAT FOLLOWS; A PERSON IS NAMED BY ACCOUNT OR WITH CONSENT; THE JUMP HOST AND THE REMOTE SESSIONS ARE SETTINGS
// given: Settings on a phone with the notice at the top not ticked
// input: open the token form and tick I have read this beside the paste field
// expect: the form carries the notice and its own box; ticked there, the field and Store token open and the notice at the top is ticked with it
test("UC-042 step 2 on a phone: the token form carries the notice and its own I have read this beside the paste field; ticked there, the field and Store token open, and the notice at the top is ticked with it", async () => {
  const { srv, box, dom } = await publicSettingsPage();
  const acknowledgement = publicRepositoryControl(box, "GitHub token", "ack");
  const secret = publicRepositoryControl(box, "GitHub token", "secret");
  const save = publicRepositoryControl(box, "GitHub token", "save");
  assert.match(publicControls(publicRepositoryRow(box, "GitHub token"), "settings-repository-shared-origin")[0].textContent, /every GitHub Pages site under that same akmaier\.github\.io domain can read it/i, "the notice is beside the paste field");
  assert.equal(acknowledgement.disabled, true, "the notice beside the paste field waits for Change");
  await publicPress(srv, publicRepositoryControl(box, "GitHub token", "change"));
  assert.equal(dom.focused(), acknowledgement, "Change opens at the notice beside the paste field");
  assert.equal(secret.disabled, true, "the paste field waits for the notice");
  acknowledgement.checked = true; acknowledgement.fire("change", {});
  assert.equal(secret.disabled, false, "ticked beside the paste field, the field opens");
  assert.equal(save.disabled, false, "and Store token");
  assert.equal(dom.focused(), secret, "the paste field receives focus after the tick");
  const key = "github_pat_PHONE0123456789abcdefghijk";
  secret.value = key;
  await publicPress(srv, save);
  assert.equal(JSON.parse(globalThis.localStorage.getItem("agent-m:akmaier/agent-m:github-token")).value, key);
});

// A FORM OPENS WITH ITS FIRST FIELD FOCUSED: after each control that opens a form, the focus is in its first field open for
// the person's input — on the token form the notice's box while it is not ticked, the paste field once it is.
// TST-474040 · level: component · module: MOD-settings-pages
// guards: UC-001; UC-006; UC-008; UC-014; UC-042; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK; ONE CLICK PER DECISION; EVERY STEP EXPLAINS ITSELF; AN APPROVAL NAMES THE EXACT TEXT; STATUS IS DERIVED FROM THE RECORDS; EDITS ARE PREPARED ON THE DASHBOARD; A SAVE IS REFUSED WHEN THE TEXT CHANGED MEANWHILE; AN EDITED FILE KEEPS ITS IDENTIFIER; WITHOUT A TOKEN, GITHUB'S WEB INTERFACE IS THE FALLBACK; A GITLAB PRODUCT IS WRITTEN WITH A TOKEN; AN ACCEPTED SPEC CHANGE IS WRITTEN WITH ITS APPROVAL; A STALE APPROVAL IS NOT APPLIED; A QUEUE IS ACCEPTED IN ITS ORDER; SEVERAL FILES ARE ACCEPTED IN ONE CLICK; A SPEC EDIT IS SAVED AS A PROPOSAL; ADDING A PRODUCT CREATES ITS LAYOUT; THE DASHBOARD KEEPS ITS PRODUCTS IN THE BROWSER; NO PRODUCT IS NAMED IN THE INSTANCE REPOSITORY; A GITLAB PRODUCT USES A PROJECT ACCESS TOKEN; A TOKEN GOES ONLY TO THE SERVER THAT ISSUED IT; THE SHARED PAGES ORIGIN IS DISCLOSED; THE TOKEN LINK IS PREFILLED; THE REPOSITORY CHOICE IS SPELLED OUT; A BROWSER SETTING IS TESTED AND CLEARED WHERE IT IS SHOWN; A STORED SECRET IS HIDDEN UNTIL SHOWN; A CLEAR IS A REAL CLEAR; A TOKEN'S EXPIRY IS WARNED OF IN ADVANCE; AN EXPIRED TOKEN IS NAMED AND ITS RENEWAL LINKED; SETTINGS ARE EXPORTED AND IMPORTED WITH THEIR SECRETS; AN EXPORT STATES THAT IT CONTAINS SECRETS; AN EXPORT CAN BE LOCKED WITH A PASSPHRASE; A PRODUCT'S SETTINGS LIVE IN ITS REPOSITORY; SWITCHING PSEUDONYMISATION OFF STATES WHAT FOLLOWS; A PERSON IS NAMED BY ACCOUNT OR WITH CONSENT; THE JUMP HOST AND THE REMOTE SESSIONS ARE SETTINGS
// given: the Store a token form, the notice not ticked
// input: open the form
// expect: the focus is on the notice's box I have read this
test("A FORM OPENS WITH ITS FIRST FIELD FOCUSED — Store a token: the notice's box I have read this, while it is not ticked", async () => {
  const { srv, box, dom } = await publicSettingsPage();
  const acknowledgement = publicRepositoryControl(box, "GitHub token", "ack");
  await publicPress(srv, publicRepositoryControl(box, "GitHub token", "change"));
  assert.equal(dom.focused(), acknowledgement, "the acknowledgement beside the paste field, not the control that opened the form");
});

// TST-474041 · level: component · module: MOD-settings-pages
// guards: UC-001; UC-006; UC-008; UC-014; UC-042; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK; ONE CLICK PER DECISION; EVERY STEP EXPLAINS ITSELF; AN APPROVAL NAMES THE EXACT TEXT; STATUS IS DERIVED FROM THE RECORDS; EDITS ARE PREPARED ON THE DASHBOARD; A SAVE IS REFUSED WHEN THE TEXT CHANGED MEANWHILE; AN EDITED FILE KEEPS ITS IDENTIFIER; WITHOUT A TOKEN, GITHUB'S WEB INTERFACE IS THE FALLBACK; A GITLAB PRODUCT IS WRITTEN WITH A TOKEN; AN ACCEPTED SPEC CHANGE IS WRITTEN WITH ITS APPROVAL; A STALE APPROVAL IS NOT APPLIED; A QUEUE IS ACCEPTED IN ITS ORDER; SEVERAL FILES ARE ACCEPTED IN ONE CLICK; A SPEC EDIT IS SAVED AS A PROPOSAL; ADDING A PRODUCT CREATES ITS LAYOUT; THE DASHBOARD KEEPS ITS PRODUCTS IN THE BROWSER; NO PRODUCT IS NAMED IN THE INSTANCE REPOSITORY; A GITLAB PRODUCT USES A PROJECT ACCESS TOKEN; A TOKEN GOES ONLY TO THE SERVER THAT ISSUED IT; THE SHARED PAGES ORIGIN IS DISCLOSED; THE TOKEN LINK IS PREFILLED; THE REPOSITORY CHOICE IS SPELLED OUT; A BROWSER SETTING IS TESTED AND CLEARED WHERE IT IS SHOWN; A STORED SECRET IS HIDDEN UNTIL SHOWN; A CLEAR IS A REAL CLEAR; A TOKEN'S EXPIRY IS WARNED OF IN ADVANCE; AN EXPIRED TOKEN IS NAMED AND ITS RENEWAL LINKED; SETTINGS ARE EXPORTED AND IMPORTED WITH THEIR SECRETS; AN EXPORT STATES THAT IT CONTAINS SECRETS; AN EXPORT CAN BE LOCKED WITH A PASSPHRASE; A PRODUCT'S SETTINGS LIVE IN ITS REPOSITORY; SWITCHING PSEUDONYMISATION OFF STATES WHAT FOLLOWS; A PERSON IS NAMED BY ACCOUNT OR WITH CONSENT; THE JUMP HOST AND THE REMOTE SESSIONS ARE SETTINGS
// given: the Change form of the token
// input: open Change and tick the notice
// expect: the focus is on the paste field
test("A FORM OPENS WITH ITS FIRST FIELD FOCUSED — Change of the token: the paste field, once the notice is ticked", async () => {
  const { srv, box, dom } = await publicSettingsPage();
  const acknowledgement = publicRepositoryControl(box, "GitHub token", "ack");
  const secret = publicRepositoryControl(box, "GitHub token", "secret");
  await publicPress(srv, publicRepositoryControl(box, "GitHub token", "change"));
  assert.equal(dom.focused(), acknowledgement, "the notice's box opens first");
  acknowledgement.checked = true; acknowledgement.fire("change", {});
  assert.equal(dom.focused(), secret, "the paste field opens once the notice is ticked");
});

// TST-474042 · level: component · module: MOD-settings-pages
// guards: UC-001; UC-006; UC-008; UC-014; UC-042; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK; ONE CLICK PER DECISION; EVERY STEP EXPLAINS ITSELF; AN APPROVAL NAMES THE EXACT TEXT; STATUS IS DERIVED FROM THE RECORDS; EDITS ARE PREPARED ON THE DASHBOARD; A SAVE IS REFUSED WHEN THE TEXT CHANGED MEANWHILE; AN EDITED FILE KEEPS ITS IDENTIFIER; WITHOUT A TOKEN, GITHUB'S WEB INTERFACE IS THE FALLBACK; A GITLAB PRODUCT IS WRITTEN WITH A TOKEN; AN ACCEPTED SPEC CHANGE IS WRITTEN WITH ITS APPROVAL; A STALE APPROVAL IS NOT APPLIED; A QUEUE IS ACCEPTED IN ITS ORDER; SEVERAL FILES ARE ACCEPTED IN ONE CLICK; A SPEC EDIT IS SAVED AS A PROPOSAL; ADDING A PRODUCT CREATES ITS LAYOUT; THE DASHBOARD KEEPS ITS PRODUCTS IN THE BROWSER; NO PRODUCT IS NAMED IN THE INSTANCE REPOSITORY; A GITLAB PRODUCT USES A PROJECT ACCESS TOKEN; A TOKEN GOES ONLY TO THE SERVER THAT ISSUED IT; THE SHARED PAGES ORIGIN IS DISCLOSED; THE TOKEN LINK IS PREFILLED; THE REPOSITORY CHOICE IS SPELLED OUT; A BROWSER SETTING IS TESTED AND CLEARED WHERE IT IS SHOWN; A STORED SECRET IS HIDDEN UNTIL SHOWN; A CLEAR IS A REAL CLEAR; A TOKEN'S EXPIRY IS WARNED OF IN ADVANCE; AN EXPIRED TOKEN IS NAMED AND ITS RENEWAL LINKED; SETTINGS ARE EXPORTED AND IMPORTED WITH THEIR SECRETS; AN EXPORT STATES THAT IT CONTAINS SECRETS; AN EXPORT CAN BE LOCKED WITH A PASSPHRASE; A PRODUCT'S SETTINGS LIVE IN ITS REPOSITORY; SWITCHING PSEUDONYMISATION OFF STATES WHAT FOLLOWS; A PERSON IS NAMED BY ACCOUNT OR WITH CONSENT; THE JUMP HOST AND THE REMOTE SESSIONS ARE SETTINGS
// given: a GitLab product with a project token stored
// input: open Change of the project token
// expect: the focus is on the field for the new token
test("A FORM OPENS WITH ITS FIRST FIELD FOCUSED — Change of a GitLab project token: the field for the new token", async () => {
  const { srv, box, dom } = await publicSettingsPage({ settings: { products: [GL_ADDR], [GL_TOKEN_KEY]: { value: GL_TOKEN, name: "Agent M", expires: day(60), stored: day(0) } } });
  const acknowledgement = publicRepositoryControl(box, "GitLab token", "ack");
  const secret = publicRepositoryControl(box, "GitLab token", "secret");
  await publicPress(srv, publicRepositoryControl(box, "GitLab token", "change"));
  assert.equal(dom.focused(), acknowledgement, "the GitLab notice's box opens first");
  acknowledgement.checked = true; acknowledgement.fire("change", {});
  assert.equal(dom.focused(), secret, "the field for the new GitLab token opens after the notice is ticked");
});

// TST-474043 · level: component · module: MOD-settings-pages
// guards: UC-001; UC-006; UC-008; UC-014; UC-042; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK; ONE CLICK PER DECISION; EVERY STEP EXPLAINS ITSELF; AN APPROVAL NAMES THE EXACT TEXT; STATUS IS DERIVED FROM THE RECORDS; EDITS ARE PREPARED ON THE DASHBOARD; A SAVE IS REFUSED WHEN THE TEXT CHANGED MEANWHILE; AN EDITED FILE KEEPS ITS IDENTIFIER; WITHOUT A TOKEN, GITHUB'S WEB INTERFACE IS THE FALLBACK; A GITLAB PRODUCT IS WRITTEN WITH A TOKEN; AN ACCEPTED SPEC CHANGE IS WRITTEN WITH ITS APPROVAL; A STALE APPROVAL IS NOT APPLIED; A QUEUE IS ACCEPTED IN ITS ORDER; SEVERAL FILES ARE ACCEPTED IN ONE CLICK; A SPEC EDIT IS SAVED AS A PROPOSAL; ADDING A PRODUCT CREATES ITS LAYOUT; THE DASHBOARD KEEPS ITS PRODUCTS IN THE BROWSER; NO PRODUCT IS NAMED IN THE INSTANCE REPOSITORY; A GITLAB PRODUCT USES A PROJECT ACCESS TOKEN; A TOKEN GOES ONLY TO THE SERVER THAT ISSUED IT; THE SHARED PAGES ORIGIN IS DISCLOSED; THE TOKEN LINK IS PREFILLED; THE REPOSITORY CHOICE IS SPELLED OUT; A BROWSER SETTING IS TESTED AND CLEARED WHERE IT IS SHOWN; A STORED SECRET IS HIDDEN UNTIL SHOWN; A CLEAR IS A REAL CLEAR; A TOKEN'S EXPIRY IS WARNED OF IN ADVANCE; AN EXPIRED TOKEN IS NAMED AND ITS RENEWAL LINKED; SETTINGS ARE EXPORTED AND IMPORTED WITH THEIR SECRETS; AN EXPORT STATES THAT IT CONTAINS SECRETS; AN EXPORT CAN BE LOCKED WITH A PASSPHRASE; A PRODUCT'S SETTINGS LIVE IN ITS REPOSITORY; SWITCHING PSEUDONYMISATION OFF STATES WHAT FOLLOWS; A PERSON IS NAMED BY ACCOUNT OR WITH CONSENT; THE JUMP HOST AND THE REMOTE SESSIONS ARE SETTINGS
// given: tokens expiring within and after fourteen days
// input: open the pages
// expect: a token that expires within fourteen days is named on every page with Renew; one that expires later is not
test("UC-042 1a: a token that expires within fourteen days is named on every page, with Renew; one that expires later is not", async () => {
  const near = await publicSettingsPage({ settings: { "github-token": { value: TOKEN, name: "GitHub token", expires: day(5), stored: day(0) } } });
  assert.equal(publicRepositoryControl(near.box, "GitHub token", "status").textContent, `Expires on ${day(5)}; renew soon.`);
  assert.equal(publicRepositoryControl(near.box, "GitHub token", "renew").href, "https://github.com/settings/personal-access-tokens");
  await near.page.go("#spec");
  assert.ok(near.page.el("token-banner").includes(`Your GitHub token expires on ${day(5)} (GitHub token).`), "the token and its expiry are named at the top of every dashboard page");
  assert.ok(near.page.el("token-banner").includes('href="https://github.com/settings/personal-access-tokens">Renew</a>'), "Renew at GitHub's list of tokens");
  const later = await publicSettingsPage({ settings: { "github-token": { value: TOKEN, name: "GitHub token", expires: day(30), stored: day(0) } } });
  assert.equal(publicRepositoryControl(later.box, "GitHub token", "status").textContent, `Expires on ${day(30)}.`);
  assert.doesNotMatch(publicRepositoryControl(later.box, "GitHub token", "status").textContent, /renew soon/i);
  await later.page.go("#uc");
  assert.equal(later.page.el("token-banner"), "", "a later expiry is not named on other dashboard pages");
});

// TST-474044 · level: component · module: MOD-settings-pages
// guards: UC-001; UC-006; UC-008; UC-014; UC-042; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK; ONE CLICK PER DECISION; EVERY STEP EXPLAINS ITSELF; AN APPROVAL NAMES THE EXACT TEXT; STATUS IS DERIVED FROM THE RECORDS; EDITS ARE PREPARED ON THE DASHBOARD; A SAVE IS REFUSED WHEN THE TEXT CHANGED MEANWHILE; AN EDITED FILE KEEPS ITS IDENTIFIER; WITHOUT A TOKEN, GITHUB'S WEB INTERFACE IS THE FALLBACK; A GITLAB PRODUCT IS WRITTEN WITH A TOKEN; AN ACCEPTED SPEC CHANGE IS WRITTEN WITH ITS APPROVAL; A STALE APPROVAL IS NOT APPLIED; A QUEUE IS ACCEPTED IN ITS ORDER; SEVERAL FILES ARE ACCEPTED IN ONE CLICK; A SPEC EDIT IS SAVED AS A PROPOSAL; ADDING A PRODUCT CREATES ITS LAYOUT; THE DASHBOARD KEEPS ITS PRODUCTS IN THE BROWSER; NO PRODUCT IS NAMED IN THE INSTANCE REPOSITORY; A GITLAB PRODUCT USES A PROJECT ACCESS TOKEN; A TOKEN GOES ONLY TO THE SERVER THAT ISSUED IT; THE SHARED PAGES ORIGIN IS DISCLOSED; THE TOKEN LINK IS PREFILLED; THE REPOSITORY CHOICE IS SPELLED OUT; A BROWSER SETTING IS TESTED AND CLEARED WHERE IT IS SHOWN; A STORED SECRET IS HIDDEN UNTIL SHOWN; A CLEAR IS A REAL CLEAR; A TOKEN'S EXPIRY IS WARNED OF IN ADVANCE; AN EXPIRED TOKEN IS NAMED AND ITS RENEWAL LINKED; SETTINGS ARE EXPORTED AND IMPORTED WITH THEIR SECRETS; AN EXPORT STATES THAT IT CONTAINS SECRETS; AN EXPORT CAN BE LOCKED WITH A PASSPHRASE; A PRODUCT'S SETTINGS LIVE IN ITS REPOSITORY; SWITCHING PSEUDONYMISATION OFF STATES WHAT FOLLOWS; A PERSON IS NAMED BY ACCOUNT OR WITH CONSENT; THE JUMP HOST AND THE REMOTE SESSIONS ARE SETTINGS
// given: a token the server refused
// input: open the pages
// expect: the token is named with its renewal at the top and on its line
test("UC-042 1b: a token the server refused is named, with its renewal, at the top and on its line", async () => {
  let refuse = false;
  const srv = await ucServer({}, [(url) => (refuse && url.href === `${API}/repos/${REPO}` ? json({ message: "Bad credentials" }, 401) : undefined)]);
  const { page, box } = await publicSettingsPage({ server: srv });
  refuse = true;
  await publicPress(srv, publicRepositoryControl(box, "GitHub token", "test"));
  assert.equal(publicRepositoryControl(box, "GitHub token", "status").textContent, "Expires on " + day(90) + ". Refused.");
  assert.equal(publicRepositoryControl(box, "GitHub token", "renew").href, "https://github.com/settings/personal-access-tokens");
  assert.equal(publicRepositoryControl(box, "GitHub token", "result").textContent, "✗ GitHub rejected authentication with your GitHub token. Renew it on https://github.com/settings/personal-access-tokens.");
  await page.go("#uc");
  assert.ok(page.el("token-banner").includes("The server refused your token GitHub token."), "the refused token is named at the top");
  assert.ok(page.el("token-banner").includes('href="https://github.com/settings/personal-access-tokens">Renew</a>'), "with its renewal");
});

// TST-474045 · level: component · module: MOD-settings-pages
// guards: UC-001; UC-006; UC-008; UC-014; UC-042; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK; ONE CLICK PER DECISION; EVERY STEP EXPLAINS ITSELF; AN APPROVAL NAMES THE EXACT TEXT; STATUS IS DERIVED FROM THE RECORDS; EDITS ARE PREPARED ON THE DASHBOARD; A SAVE IS REFUSED WHEN THE TEXT CHANGED MEANWHILE; AN EDITED FILE KEEPS ITS IDENTIFIER; WITHOUT A TOKEN, GITHUB'S WEB INTERFACE IS THE FALLBACK; A GITLAB PRODUCT IS WRITTEN WITH A TOKEN; AN ACCEPTED SPEC CHANGE IS WRITTEN WITH ITS APPROVAL; A STALE APPROVAL IS NOT APPLIED; A QUEUE IS ACCEPTED IN ITS ORDER; SEVERAL FILES ARE ACCEPTED IN ONE CLICK; A SPEC EDIT IS SAVED AS A PROPOSAL; ADDING A PRODUCT CREATES ITS LAYOUT; THE DASHBOARD KEEPS ITS PRODUCTS IN THE BROWSER; NO PRODUCT IS NAMED IN THE INSTANCE REPOSITORY; A GITLAB PRODUCT USES A PROJECT ACCESS TOKEN; A TOKEN GOES ONLY TO THE SERVER THAT ISSUED IT; THE SHARED PAGES ORIGIN IS DISCLOSED; THE TOKEN LINK IS PREFILLED; THE REPOSITORY CHOICE IS SPELLED OUT; A BROWSER SETTING IS TESTED AND CLEARED WHERE IT IS SHOWN; A STORED SECRET IS HIDDEN UNTIL SHOWN; A CLEAR IS A REAL CLEAR; A TOKEN'S EXPIRY IS WARNED OF IN ADVANCE; AN EXPIRED TOKEN IS NAMED AND ITS RENEWAL LINKED; SETTINGS ARE EXPORTED AND IMPORTED WITH THEIR SECRETS; AN EXPORT STATES THAT IT CONTAINS SECRETS; AN EXPORT CAN BE LOCKED WITH A PASSPHRASE; A PRODUCT'S SETTINGS LIVE IN ITS REPOSITORY; SWITCHING PSEUDONYMISATION OFF STATES WHAT FOLLOWS; A PERSON IS NAMED BY ACCOUNT OR WITH CONSENT; THE JUMP HOST AND THE REMOTE SESSIONS ARE SETTINGS
// given: Settings with products and GitLab products' tokens stored
// input: press Remove on one product, then Clear on the list, each confirmed
// expect: Remove takes one product off this browser's list after a confirmation; Clear takes all with the GitLab products' tokens; no repository changes
test("UC-042 step 2: products — Remove takes one off this browser's list after a confirmation; Clear takes all, with the GitLab products' tokens; no repository changes", async () => {
  const { srv, page, box } = await publicSettingsPage({ settings: { products: [PRODUCT_ADDR, GL_ADDR], [`github-token:${PRODUCT}`]: { value: "github_pat_PRODUCT0123456789abcdefghij", name: "Agent M", expires: day(60), stored: day(0) }, [GL_TOKEN_KEY]: { value: GL_TOKEN, name: "Agent M", expires: day(60), stored: day(0) } } });
  assert.equal(publicControls(box(), "settings-product-list-item").length, 2);
  await publicPress(srv, publicControls(box(), "settings-product-remove")[0]);
  assert.deepEqual(JSON.parse(globalThis.localStorage.getItem("agent-m:akmaier/agent-m:products")), [GL_ADDR]);
  assert.ok(JSON.parse(globalThis.localStorage.getItem(`agent-m:akmaier/agent-m:${GL_TOKEN_KEY}`)).value === GL_TOKEN, "another product's token stays");
  await publicPress(srv, publicRepositoryControl(box, "Products", "clear"));
  assert.equal(globalThis.localStorage.getItem("agent-m:akmaier/agent-m:products"), null);
  assert.equal(globalThis.localStorage.getItem(`agent-m:akmaier/agent-m:${GL_TOKEN_KEY}`), null);
  assert.equal(confirms.length, 2, "Remove and Clear each require their own confirmation");
  assert.deepEqual(srv.writes, []);
  assert.equal(publicControls(box(), "settings-product-list-item").length, 0, "the product list follows");
  await page.go("#uc");
  assert.doesNotMatch(page.el("product"), /alice\/thesis|gitlab\.example/, "the global product selector follows");
});

// TST-474046 · level: component · module: MOD-settings-pages
// guards: UC-001; UC-006; UC-008; UC-014; UC-042; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK; ONE CLICK PER DECISION; EVERY STEP EXPLAINS ITSELF; AN APPROVAL NAMES THE EXACT TEXT; STATUS IS DERIVED FROM THE RECORDS; EDITS ARE PREPARED ON THE DASHBOARD; A SAVE IS REFUSED WHEN THE TEXT CHANGED MEANWHILE; AN EDITED FILE KEEPS ITS IDENTIFIER; WITHOUT A TOKEN, GITHUB'S WEB INTERFACE IS THE FALLBACK; A GITLAB PRODUCT IS WRITTEN WITH A TOKEN; AN ACCEPTED SPEC CHANGE IS WRITTEN WITH ITS APPROVAL; A STALE APPROVAL IS NOT APPLIED; A QUEUE IS ACCEPTED IN ITS ORDER; SEVERAL FILES ARE ACCEPTED IN ONE CLICK; A SPEC EDIT IS SAVED AS A PROPOSAL; ADDING A PRODUCT CREATES ITS LAYOUT; THE DASHBOARD KEEPS ITS PRODUCTS IN THE BROWSER; NO PRODUCT IS NAMED IN THE INSTANCE REPOSITORY; A GITLAB PRODUCT USES A PROJECT ACCESS TOKEN; A TOKEN GOES ONLY TO THE SERVER THAT ISSUED IT; THE SHARED PAGES ORIGIN IS DISCLOSED; THE TOKEN LINK IS PREFILLED; THE REPOSITORY CHOICE IS SPELLED OUT; A BROWSER SETTING IS TESTED AND CLEARED WHERE IT IS SHOWN; A STORED SECRET IS HIDDEN UNTIL SHOWN; A CLEAR IS A REAL CLEAR; A TOKEN'S EXPIRY IS WARNED OF IN ADVANCE; AN EXPIRED TOKEN IS NAMED AND ITS RENEWAL LINKED; SETTINGS ARE EXPORTED AND IMPORTED WITH THEIR SECRETS; AN EXPORT STATES THAT IT CONTAINS SECRETS; AN EXPORT CAN BE LOCKED WITH A PASSPHRASE; A PRODUCT'S SETTINGS LIVE IN ITS REPOSITORY; SWITCHING PSEUDONYMISATION OFF STATES WHAT FOLLOWS; A PERSON IS NAMED BY ACCOUNT OR WITH CONSENT; THE JUMP HOST AND THE REMOTE SESSIONS ARE SETTINGS
// given: Settings with a GitLab project token stored
// input: Show, Change after the notice, Clear after a confirmation
// expect: the token is hidden until Show, changed after the notice and cleared after a confirmation
test("UC-042 step 2: a GitLab project token — hidden until Show, changed after the notice, cleared after a confirmation", async () => {
  const { srv, box } = await publicSettingsPage({ settings: { products: [GL_ADDR], [GL_TOKEN_KEY]: { value: GL_TOKEN, name: "Agent M", expires: day(60), stored: day(0) } } });
  const label = `GitLab token: ${GL_TOKEN_KEY.slice("gitlab-token:".length)}`;
  const secret = publicRepositoryControl(box, label, "secret");
  assert.equal(secret.type, "password");
  await publicPress(srv, publicRepositoryControl(box, label, "show"));
  assert.equal(secret.type, "text");
  assert.equal(secret.value, GL_TOKEN);
  await publicPress(srv, publicRepositoryControl(box, label, "change"));
  assert.equal(publicRepositoryControl(box, label, "result").textContent, "Read the shared-browser notice, then acknowledge it before saving a replacement token.");
  const acknowledgement = publicRepositoryControl(box, label, "ack");
  acknowledgement.checked = true; acknowledgement.fire("change", {});
  const renewed = "glpat-renewedTOKENvalue0123456789";
  secret.value = renewed;
  publicRepositoryControl(box, label, "expiry").value = day(80);
  await publicPress(srv, publicRepositoryControl(box, label, "save"));
  assert.deepEqual(JSON.parse(globalThis.localStorage.getItem(`agent-m:akmaier/agent-m:${GL_TOKEN_KEY}`)), { value: renewed, name: "Agent M", expires: day(80), stored: day(0) });
  await publicPress(srv, publicRepositoryControl(box, label, "clear"));
  assert.equal(globalThis.localStorage.getItem(`agent-m:akmaier/agent-m:${GL_TOKEN_KEY}`), null);
  assert.deepEqual(JSON.parse(globalThis.localStorage.getItem("agent-m:akmaier/agent-m:products")), [GL_ADDR], "the product stays in the list");
});

// TST-474047 · level: component · module: MOD-settings-pages
// guards: UC-001; UC-006; UC-008; UC-014; UC-042; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK; ONE CLICK PER DECISION; EVERY STEP EXPLAINS ITSELF; AN APPROVAL NAMES THE EXACT TEXT; STATUS IS DERIVED FROM THE RECORDS; EDITS ARE PREPARED ON THE DASHBOARD; A SAVE IS REFUSED WHEN THE TEXT CHANGED MEANWHILE; AN EDITED FILE KEEPS ITS IDENTIFIER; WITHOUT A TOKEN, GITHUB'S WEB INTERFACE IS THE FALLBACK; A GITLAB PRODUCT IS WRITTEN WITH A TOKEN; AN ACCEPTED SPEC CHANGE IS WRITTEN WITH ITS APPROVAL; A STALE APPROVAL IS NOT APPLIED; A QUEUE IS ACCEPTED IN ITS ORDER; SEVERAL FILES ARE ACCEPTED IN ONE CLICK; A SPEC EDIT IS SAVED AS A PROPOSAL; ADDING A PRODUCT CREATES ITS LAYOUT; THE DASHBOARD KEEPS ITS PRODUCTS IN THE BROWSER; NO PRODUCT IS NAMED IN THE INSTANCE REPOSITORY; A GITLAB PRODUCT USES A PROJECT ACCESS TOKEN; A TOKEN GOES ONLY TO THE SERVER THAT ISSUED IT; THE SHARED PAGES ORIGIN IS DISCLOSED; THE TOKEN LINK IS PREFILLED; THE REPOSITORY CHOICE IS SPELLED OUT; A BROWSER SETTING IS TESTED AND CLEARED WHERE IT IS SHOWN; A STORED SECRET IS HIDDEN UNTIL SHOWN; A CLEAR IS A REAL CLEAR; A TOKEN'S EXPIRY IS WARNED OF IN ADVANCE; AN EXPIRED TOKEN IS NAMED AND ITS RENEWAL LINKED; SETTINGS ARE EXPORTED AND IMPORTED WITH THEIR SECRETS; AN EXPORT STATES THAT IT CONTAINS SECRETS; AN EXPORT CAN BE LOCKED WITH A PASSPHRASE; A PRODUCT'S SETTINGS LIVE IN ITS REPOSITORY; SWITCHING PSEUDONYMISATION OFF STATES WHAT FOLLOWS; A PERSON IS NAMED BY ACCOUNT OR WITH CONSENT; THE JUMP HOST AND THE REMOTE SESSIONS ARE SETTINGS
// given: Settings with no jump host and no remote session
// input: set the jump host and a remote session, then clear each
// expect: their commands are written and each is cleared, all in this browser
test("UC-042 step 2: the jump host and a remote session are set, their commands written, and each is cleared — all in this browser", async () => {
  const { srv, page, mounted } = await publicBridgePage();
  const control = (name) => publicControls(mounted(), name)[0];
  for (const [name, value] of Object.entries({ "jump-host-name": "jump.example.org", "jump-host-user": "agentm", "jump-host-ssh-port": "22", "jump-host-port-first": "20001", "jump-host-port-last": "20003" })) control(name).value = value;
  await publicPress(srv, control("jump-host-save"));
  assert.deepEqual(JSON.parse(globalThis.localStorage.getItem("agent-m:akmaier/agent-m:jump-host")), { hostname: "jump.example.org", user: "agentm", sshPort: 22, portRange: [20001, 20003] });
  assert.equal(control("remote-session-name").value, "");
  control("remote-session-name").value = "lab-pc";
  control("remote-session-token").value = "bridgeTOKEN-0123456789abcdef";
  await publicPress(srv, control("remote-session-save"));
  assert.deepEqual(JSON.parse(globalThis.localStorage.getItem("agent-m:akmaier/agent-m:remote-session:lab-pc")), { port: 20001, token: "bridgeTOKEN-0123456789abcdef" });
  assert.match(control("remote-session-commands").textContent, /127\.0\.0\.1:20001/, "the commands are written from the settings");
  assert.doesNotMatch(control("remote-session-commands").textContent, /bridgeTOKEN/, "the bridge token is in no command");
  await page.go("#settings");
  const endpoints = () => publicControls(mounted(), "settings-tab-panel").find((pane) => pane.textContent.includes("Endpoints & Agents"));
  await publicPress(srv, publicControls(endpoints(), "settings-remote-session-clear")[0]);
  assert.equal(globalThis.localStorage.getItem("agent-m:akmaier/agent-m:remote-session:lab-pc"), null);
  await publicPress(srv, publicControls(endpoints(), "settings-jump-host-clear")[0]);
  assert.equal(globalThis.localStorage.getItem("agent-m:akmaier/agent-m:jump-host"), null);
  assert.deepEqual(srv.writes, []);
});

// TST-474048 · level: component · module: MOD-settings-pages
// guards: UC-001; UC-006; UC-008; UC-014; UC-042; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK; ONE CLICK PER DECISION; EVERY STEP EXPLAINS ITSELF; AN APPROVAL NAMES THE EXACT TEXT; STATUS IS DERIVED FROM THE RECORDS; EDITS ARE PREPARED ON THE DASHBOARD; A SAVE IS REFUSED WHEN THE TEXT CHANGED MEANWHILE; AN EDITED FILE KEEPS ITS IDENTIFIER; WITHOUT A TOKEN, GITHUB'S WEB INTERFACE IS THE FALLBACK; A GITLAB PRODUCT IS WRITTEN WITH A TOKEN; AN ACCEPTED SPEC CHANGE IS WRITTEN WITH ITS APPROVAL; A STALE APPROVAL IS NOT APPLIED; A QUEUE IS ACCEPTED IN ITS ORDER; SEVERAL FILES ARE ACCEPTED IN ONE CLICK; A SPEC EDIT IS SAVED AS A PROPOSAL; ADDING A PRODUCT CREATES ITS LAYOUT; THE DASHBOARD KEEPS ITS PRODUCTS IN THE BROWSER; NO PRODUCT IS NAMED IN THE INSTANCE REPOSITORY; A GITLAB PRODUCT USES A PROJECT ACCESS TOKEN; A TOKEN GOES ONLY TO THE SERVER THAT ISSUED IT; THE SHARED PAGES ORIGIN IS DISCLOSED; THE TOKEN LINK IS PREFILLED; THE REPOSITORY CHOICE IS SPELLED OUT; A BROWSER SETTING IS TESTED AND CLEARED WHERE IT IS SHOWN; A STORED SECRET IS HIDDEN UNTIL SHOWN; A CLEAR IS A REAL CLEAR; A TOKEN'S EXPIRY IS WARNED OF IN ADVANCE; AN EXPIRED TOKEN IS NAMED AND ITS RENEWAL LINKED; SETTINGS ARE EXPORTED AND IMPORTED WITH THEIR SECRETS; AN EXPORT STATES THAT IT CONTAINS SECRETS; AN EXPORT CAN BE LOCKED WITH A PASSPHRASE; A PRODUCT'S SETTINGS LIVE IN ITS REPOSITORY; SWITCHING PSEUDONYMISATION OFF STATES WHAT FOLLOWS; A PERSON IS NAMED BY ACCOUNT OR WITH CONSENT; THE JUMP HOST AND THE REMOTE SESSIONS ARE SETTINGS
// given: no token, a product's settings
// input: open the product's settings
// expect: they are read-only and link to the token step of UC-001
test("UC-042 3a: without a token the product's settings are read-only, and link to the token step of UC-001", async () => {
  const { srv, box } = await publicSettingsPage({ token: null, settings: { "github-token": null } });
  const product = publicControls(box(), "settings-product")[0];
  assert.match(publicControls(product, "settings-product-read-only")[0].textContent, /Read-only: This browser has no token that can write to this product\./);
  const tokenStep = publicControls(product, "settings-product-token-step")[0];
  assert.ok(tokenStep);
  await publicPress(srv, tokenStep);
  assert.equal(globalThis.location.hash, `#add/${encodeURIComponent(`https://github.com/${REPO}`)}`, "the token-step control selects this product's public route");
  assert.equal(publicControls(product, "settings-pseudonymisation-off").length, 0);
  assert.equal(publicControls(product, "settings-pseudonymisation-save").length, 0);
  assert.equal(publicControls(product, "settings-collaborator-save").length, 0);
  assert.equal(publicControls(product, "settings-collaborator-remove").length, 0);
});

// TST-474049 · level: component · module: MOD-settings-pages
// guards: UC-001; UC-006; UC-008; UC-014; UC-042; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK; ONE CLICK PER DECISION; EVERY STEP EXPLAINS ITSELF; AN APPROVAL NAMES THE EXACT TEXT; STATUS IS DERIVED FROM THE RECORDS; EDITS ARE PREPARED ON THE DASHBOARD; A SAVE IS REFUSED WHEN THE TEXT CHANGED MEANWHILE; AN EDITED FILE KEEPS ITS IDENTIFIER; WITHOUT A TOKEN, GITHUB'S WEB INTERFACE IS THE FALLBACK; A GITLAB PRODUCT IS WRITTEN WITH A TOKEN; AN ACCEPTED SPEC CHANGE IS WRITTEN WITH ITS APPROVAL; A STALE APPROVAL IS NOT APPLIED; A QUEUE IS ACCEPTED IN ITS ORDER; SEVERAL FILES ARE ACCEPTED IN ONE CLICK; A SPEC EDIT IS SAVED AS A PROPOSAL; ADDING A PRODUCT CREATES ITS LAYOUT; THE DASHBOARD KEEPS ITS PRODUCTS IN THE BROWSER; NO PRODUCT IS NAMED IN THE INSTANCE REPOSITORY; A GITLAB PRODUCT USES A PROJECT ACCESS TOKEN; A TOKEN GOES ONLY TO THE SERVER THAT ISSUED IT; THE SHARED PAGES ORIGIN IS DISCLOSED; THE TOKEN LINK IS PREFILLED; THE REPOSITORY CHOICE IS SPELLED OUT; A BROWSER SETTING IS TESTED AND CLEARED WHERE IT IS SHOWN; A STORED SECRET IS HIDDEN UNTIL SHOWN; A CLEAR IS A REAL CLEAR; A TOKEN'S EXPIRY IS WARNED OF IN ADVANCE; AN EXPIRED TOKEN IS NAMED AND ITS RENEWAL LINKED; SETTINGS ARE EXPORTED AND IMPORTED WITH THEIR SECRETS; AN EXPORT STATES THAT IT CONTAINS SECRETS; AN EXPORT CAN BE LOCKED WITH A PASSPHRASE; A PRODUCT'S SETTINGS LIVE IN ITS REPOSITORY; SWITCHING PSEUDONYMISATION OFF STATES WHAT FOLLOWS; A PERSON IS NAMED BY ACCOUNT OR WITH CONSENT; THE JUMP HOST AND THE REMOTE SESSIONS ARE SETTINGS
// given: a public repository with pseudonymisation on and the token
// input: switch pseudonymisation off, with and without the tick, then one trusted click on Save
// expect: what follows is shown (published for a public repository), the tick is needed, and one trusted click commits docs/settings.md
test("UC-042 step 4: switching pseudonymisation off shows what follows — published for a public repository —, needs the tick, and one trusted click commits docs/settings.md", async () => {
  const originalSettings = "# Settings of akmaier/agent-m\n\nUnrelated introductory text stays.\n";
  const { srv, box } = await publicSettingsPage({ server: await ucServer({ "docs/settings.md": originalSettings }, [(url) => url.href === `${API}/repos/${REPO}` ? json({ private: false, default_branch: "main", permissions: { push: true } }) : undefined]), writableProduct: true });
  const product = publicControls(box(), "settings-product")[0];
  const off = publicControls(product, "settings-pseudonymisation-off")[0];
  const acknowledgement = publicControls(product, "settings-pseudonymisation-ack")[0];
  const save = publicControls(product, "settings-pseudonymisation-save")[0];
  const settingsBefore = [...Array(globalThis.localStorage.length).keys()].map((index) => globalThis.localStorage.key(index)).filter((key) => key.startsWith("agent-m:akmaier/agent-m:")).sort();
  off.checked = true;
  assert.ok(product.textContent.includes("With pseudonymisation off, report data from mails — the names, addresses and other details of the people who write — enters the issues and the repository of akmaier/agent-m unchanged. This is advisable only on a protected, non-public data space. Issue texts themselves stay neutral either way. GitHub reports akmaier/agent-m as public: the data will be published — anyone on the internet can read it."));
  await publicPress(srv, save);
  assert.equal(publicControls(product, "settings-pseudonymisation-result")[0].textContent, "Tick I have read this before switching pseudonymisation off.");
  acknowledgement.checked = true; acknowledgement.fire("change", {});
  await publicPress(srv, save);
  assert.equal(srv.writes.length, 1);
  assert.deepEqual(Object.keys(srv.writes[0].files), ["docs/settings.md"]);
  const writtenSettings = srv.writes[0].files["docs/settings.md"];
  const { settings } = await settingsSchemas();
  assert.equal(readDocument(settings, settings.path, writtenSettings).fields.pseudonymisation, "off", "the parsed Settings value is off");
  assert.match(writtenSettings, /Unrelated introductory text stays\./, "unrelated Settings text is retained");
  assert.equal(srv.writes[0].message, "edit settings.md (Agent M dashboard)");
  assert.deepEqual([...Array(globalThis.localStorage.length).keys()].map((index) => globalThis.localStorage.key(index)).filter((key) => key.startsWith("agent-m:akmaier/agent-m:")).sort(), settingsBefore, "no product or Settings record is written in this browser");
  assert.equal(publicControls(product, "settings-pseudonymisation-state")[0].textContent, "Pseudonymisation is off.");
});

// TST-474050 · level: component · module: MOD-settings-pages
// guards: UC-001; UC-006; UC-008; UC-014; UC-042; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK; ONE CLICK PER DECISION; EVERY STEP EXPLAINS ITSELF; AN APPROVAL NAMES THE EXACT TEXT; STATUS IS DERIVED FROM THE RECORDS; EDITS ARE PREPARED ON THE DASHBOARD; A SAVE IS REFUSED WHEN THE TEXT CHANGED MEANWHILE; AN EDITED FILE KEEPS ITS IDENTIFIER; WITHOUT A TOKEN, GITHUB'S WEB INTERFACE IS THE FALLBACK; A GITLAB PRODUCT IS WRITTEN WITH A TOKEN; AN ACCEPTED SPEC CHANGE IS WRITTEN WITH ITS APPROVAL; A STALE APPROVAL IS NOT APPLIED; A QUEUE IS ACCEPTED IN ITS ORDER; SEVERAL FILES ARE ACCEPTED IN ONE CLICK; A SPEC EDIT IS SAVED AS A PROPOSAL; ADDING A PRODUCT CREATES ITS LAYOUT; THE DASHBOARD KEEPS ITS PRODUCTS IN THE BROWSER; NO PRODUCT IS NAMED IN THE INSTANCE REPOSITORY; A GITLAB PRODUCT USES A PROJECT ACCESS TOKEN; A TOKEN GOES ONLY TO THE SERVER THAT ISSUED IT; THE SHARED PAGES ORIGIN IS DISCLOSED; THE TOKEN LINK IS PREFILLED; THE REPOSITORY CHOICE IS SPELLED OUT; A BROWSER SETTING IS TESTED AND CLEARED WHERE IT IS SHOWN; A STORED SECRET IS HIDDEN UNTIL SHOWN; A CLEAR IS A REAL CLEAR; A TOKEN'S EXPIRY IS WARNED OF IN ADVANCE; AN EXPIRED TOKEN IS NAMED AND ITS RENEWAL LINKED; SETTINGS ARE EXPORTED AND IMPORTED WITH THEIR SECRETS; AN EXPORT STATES THAT IT CONTAINS SECRETS; AN EXPORT CAN BE LOCKED WITH A PASSPHRASE; A PRODUCT'S SETTINGS LIVE IN ITS REPOSITORY; SWITCHING PSEUDONYMISATION OFF STATES WHAT FOLLOWS; A PERSON IS NAMED BY ACCOUNT OR WITH CONSENT; THE JUMP HOST AND THE REMOTE SESSIONS ARE SETTINGS
// given: pseudonymisation switched off in the settings
// input: a click a script makes on Save; a Save without the tick
// expect: nothing is written and the page says why
test("UC-042 step 4 counter-proofs: a click a script makes writes nothing; a Save without the tick writes nothing and says why", async () => {
  const { srv, box } = await publicSettingsPage({ writableProduct: true });
  const product = publicControls(box(), "settings-product")[0];
  const off = publicControls(product, "settings-pseudonymisation-off")[0];
  const acknowledgement = publicControls(product, "settings-pseudonymisation-ack")[0];
  const save = publicControls(product, "settings-pseudonymisation-save")[0];
  off.checked = true; acknowledgement.checked = true; acknowledgement.fire("change", {});
  await publicPress(srv, save, SCRIPTED);
  assert.deepEqual(srv.writes, []);
  acknowledgement.checked = false; acknowledgement.fire("change", {});
  await publicPress(srv, save);
  assert.deepEqual(srv.writes, []);
  assert.equal(publicControls(product, "settings-pseudonymisation-result")[0].textContent, "Tick I have read this before switching pseudonymisation off.");
});

// TST-474051 · level: component · module: MOD-settings-pages
// guards: UC-001; UC-006; UC-008; UC-014; UC-042; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK; ONE CLICK PER DECISION; EVERY STEP EXPLAINS ITSELF; AN APPROVAL NAMES THE EXACT TEXT; STATUS IS DERIVED FROM THE RECORDS; EDITS ARE PREPARED ON THE DASHBOARD; A SAVE IS REFUSED WHEN THE TEXT CHANGED MEANWHILE; AN EDITED FILE KEEPS ITS IDENTIFIER; WITHOUT A TOKEN, GITHUB'S WEB INTERFACE IS THE FALLBACK; A GITLAB PRODUCT IS WRITTEN WITH A TOKEN; AN ACCEPTED SPEC CHANGE IS WRITTEN WITH ITS APPROVAL; A STALE APPROVAL IS NOT APPLIED; A QUEUE IS ACCEPTED IN ITS ORDER; SEVERAL FILES ARE ACCEPTED IN ONE CLICK; A SPEC EDIT IS SAVED AS A PROPOSAL; ADDING A PRODUCT CREATES ITS LAYOUT; THE DASHBOARD KEEPS ITS PRODUCTS IN THE BROWSER; NO PRODUCT IS NAMED IN THE INSTANCE REPOSITORY; A GITLAB PRODUCT USES A PROJECT ACCESS TOKEN; A TOKEN GOES ONLY TO THE SERVER THAT ISSUED IT; THE SHARED PAGES ORIGIN IS DISCLOSED; THE TOKEN LINK IS PREFILLED; THE REPOSITORY CHOICE IS SPELLED OUT; A BROWSER SETTING IS TESTED AND CLEARED WHERE IT IS SHOWN; A STORED SECRET IS HIDDEN UNTIL SHOWN; A CLEAR IS A REAL CLEAR; A TOKEN'S EXPIRY IS WARNED OF IN ADVANCE; AN EXPIRED TOKEN IS NAMED AND ITS RENEWAL LINKED; SETTINGS ARE EXPORTED AND IMPORTED WITH THEIR SECRETS; AN EXPORT STATES THAT IT CONTAINS SECRETS; AN EXPORT CAN BE LOCKED WITH A PASSPHRASE; A PRODUCT'S SETTINGS LIVE IN ITS REPOSITORY; SWITCHING PSEUDONYMISATION OFF STATES WHAT FOLLOWS; A PERSON IS NAMED BY ACCOUNT OR WITH CONSENT; THE JUMP HOST AND THE REMOTE SESSIONS ARE SETTINGS
// given: pseudonymisation off in docs/settings.md
// input: switch it back on and save
// expect: it is saved without a notice and the page says already written data needs a history rewrite to be removed
test("UC-042 4a: switching pseudonymisation back on is saved without a notice — the page says already written data needs a history rewrite to be removed", async () => {
  const off = "# Settings of akmaier/agent-m\n\nintro\n\n- pseudonymisation: off\n";
  const { srv, box } = await publicSettingsPage({ server: await ucServer({ "docs/settings.md": off }, [(url) => url.href === `${API}/repos/${REPO}` ? json({ private: false, default_branch: "main", permissions: { push: true } }) : undefined]), writableProduct: true });
  const product = publicControls(box(), "settings-product")[0];
  assert.equal(publicControls(product, "settings-pseudonymisation-state")[0].textContent, "Pseudonymisation is off.");
  assert.match(product.textContent, /Data already written remains in history; removing that data requires a history rewrite\./);
  const toggle = publicControls(product, "settings-pseudonymisation-off")[0];
  assert.equal(toggle.checked, true);
  toggle.checked = false;
  await publicPress(srv, publicControls(product, "settings-pseudonymisation-save")[0]);
  assert.deepEqual(srv.writes.map((w) => w.files), [{ "docs/settings.md": "# Settings of akmaier/agent-m\n\nintro\n\n" }]);
  assert.equal(publicControls(product, "settings-pseudonymisation-state")[0].textContent, "Pseudonymisation is on.");
});

const COLLABORATORS_HEAD = "# Collaborators of akmaier/agent-m\n\nPeople who agreed to be named in this repository, with the date they agreed. Anyone else is\n" +
  "named only by their account. Changed on the Agent M dashboard (Settings).\n\n| Name | Account | Agreed on |\n|---|---|---|\n";
const NEW_COLLABORATORS_HEAD = "# Collaborators of akmaier/agent-m\n\n| Name | Account | Agreed |\n|---|---|---|\n";

// TST-474052 · level: component · module: MOD-settings-pages
// guards: UC-001; UC-006; UC-008; UC-014; UC-042; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK; ONE CLICK PER DECISION; EVERY STEP EXPLAINS ITSELF; AN APPROVAL NAMES THE EXACT TEXT; STATUS IS DERIVED FROM THE RECORDS; EDITS ARE PREPARED ON THE DASHBOARD; A SAVE IS REFUSED WHEN THE TEXT CHANGED MEANWHILE; AN EDITED FILE KEEPS ITS IDENTIFIER; WITHOUT A TOKEN, GITHUB'S WEB INTERFACE IS THE FALLBACK; A GITLAB PRODUCT IS WRITTEN WITH A TOKEN; AN ACCEPTED SPEC CHANGE IS WRITTEN WITH ITS APPROVAL; A STALE APPROVAL IS NOT APPLIED; A QUEUE IS ACCEPTED IN ITS ORDER; SEVERAL FILES ARE ACCEPTED IN ONE CLICK; A SPEC EDIT IS SAVED AS A PROPOSAL; ADDING A PRODUCT CREATES ITS LAYOUT; THE DASHBOARD KEEPS ITS PRODUCTS IN THE BROWSER; NO PRODUCT IS NAMED IN THE INSTANCE REPOSITORY; A GITLAB PRODUCT USES A PROJECT ACCESS TOKEN; A TOKEN GOES ONLY TO THE SERVER THAT ISSUED IT; THE SHARED PAGES ORIGIN IS DISCLOSED; THE TOKEN LINK IS PREFILLED; THE REPOSITORY CHOICE IS SPELLED OUT; A BROWSER SETTING IS TESTED AND CLEARED WHERE IT IS SHOWN; A STORED SECRET IS HIDDEN UNTIL SHOWN; A CLEAR IS A REAL CLEAR; A TOKEN'S EXPIRY IS WARNED OF IN ADVANCE; AN EXPIRED TOKEN IS NAMED AND ITS RENEWAL LINKED; SETTINGS ARE EXPORTED AND IMPORTED WITH THEIR SECRETS; AN EXPORT STATES THAT IT CONTAINS SECRETS; AN EXPORT CAN BE LOCKED WITH A PASSPHRASE; A PRODUCT'S SETTINGS LIVE IN ITS REPOSITORY; SWITCHING PSEUDONYMISATION OFF STATES WHAT FOLLOWS; A PERSON IS NAMED BY ACCOUNT OR WITH CONSENT; THE JUMP HOST AND THE REMOTE SESSIONS ARE SETTINGS
// given: Settings with a collaborator list
// input: press + Collaborator, enter consent, name and account, tick and save
// expect: the canonical new document is created with affirmative consent, name, account and one list row
test("UC-042 step 5: + Collaborator creates the canonical new document with affirmative consent, name, account and one list row", async () => {
  const { srv, box } = await publicSettingsPage({ writableProduct: true });
  const product = publicControls(box(), "settings-product")[0];
  publicControls(product, "settings-collaborator-name")[0].value = "Jane Doe";
  publicControls(product, "settings-collaborator-account")[0].value = "jdoe";
  const consentDate = publicControls(product, "settings-collaborator-agreed-date")[0];
  assert.ok(consentDate, "the chosen consent date remains a Settings control");
  consentDate.value = "2026-09-30";
  const agreed = publicControls(product, "settings-collaborator-agreed")[0]; agreed.checked = true; agreed.fire("change", {});
  await publicPress(srv, publicControls(product, "settings-collaborator-save")[0]);
  assert.deepEqual(srv.writes.map((w) => w.files), [{ "docs/collaborators.md": `${NEW_COLLABORATORS_HEAD}| Jane Doe | jdoe | yes |\n` }]);
  assert.equal(srv.writes[0].message, "edit collaborators.md (Agent M dashboard)");
  assert.match(publicControls(product, "settings-collaborator-records")[0].textContent, /Jane Doe · @jdoe · agreed on recorded/);
  assert.equal(publicControls(product, "settings-collaborator-records")[0].children.length, 1, "one collaborator row is shown");
});

// TST-474053 · level: component · module: MOD-settings-pages
// guards: UC-001; UC-006; UC-008; UC-014; UC-042; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK; ONE CLICK PER DECISION; EVERY STEP EXPLAINS ITSELF; AN APPROVAL NAMES THE EXACT TEXT; STATUS IS DERIVED FROM THE RECORDS; EDITS ARE PREPARED ON THE DASHBOARD; A SAVE IS REFUSED WHEN THE TEXT CHANGED MEANWHILE; AN EDITED FILE KEEPS ITS IDENTIFIER; WITHOUT A TOKEN, GITHUB'S WEB INTERFACE IS THE FALLBACK; A GITLAB PRODUCT IS WRITTEN WITH A TOKEN; AN ACCEPTED SPEC CHANGE IS WRITTEN WITH ITS APPROVAL; A STALE APPROVAL IS NOT APPLIED; A QUEUE IS ACCEPTED IN ITS ORDER; SEVERAL FILES ARE ACCEPTED IN ONE CLICK; A SPEC EDIT IS SAVED AS A PROPOSAL; ADDING A PRODUCT CREATES ITS LAYOUT; THE DASHBOARD KEEPS ITS PRODUCTS IN THE BROWSER; NO PRODUCT IS NAMED IN THE INSTANCE REPOSITORY; A GITLAB PRODUCT USES A PROJECT ACCESS TOKEN; A TOKEN GOES ONLY TO THE SERVER THAT ISSUED IT; THE SHARED PAGES ORIGIN IS DISCLOSED; THE TOKEN LINK IS PREFILLED; THE REPOSITORY CHOICE IS SPELLED OUT; A BROWSER SETTING IS TESTED AND CLEARED WHERE IT IS SHOWN; A STORED SECRET IS HIDDEN UNTIL SHOWN; A CLEAR IS A REAL CLEAR; A TOKEN'S EXPIRY IS WARNED OF IN ADVANCE; AN EXPIRED TOKEN IS NAMED AND ITS RENEWAL LINKED; SETTINGS ARE EXPORTED AND IMPORTED WITH THEIR SECRETS; AN EXPORT STATES THAT IT CONTAINS SECRETS; AN EXPORT CAN BE LOCKED WITH A PASSPHRASE; A PRODUCT'S SETTINGS LIVE IN ITS REPOSITORY; SWITCHING PSEUDONYMISATION OFF STATES WHAT FOLLOWS; A PERSON IS NAMED BY ACCOUNT OR WITH CONSENT; THE JUMP HOST AND THE REMOTE SESSIONS ARE SETTINGS
// given: the + Collaborator form filled in
// input: save without the tick; a click a script makes
// expect: nothing is written and the page says why
test("UC-042 step 5 counter-proofs: without the tick nothing is written and the page says why; a click a script makes writes nothing", async () => {
  const { srv, box } = await publicSettingsPage({ writableProduct: true });
  const product = publicControls(box(), "settings-product")[0];
  publicControls(product, "settings-collaborator-name")[0].value = "Jane Doe";
  publicControls(product, "settings-collaborator-account")[0].value = "jdoe";
  const save = publicControls(product, "settings-collaborator-save")[0];
  await publicPress(srv, save);
  assert.deepEqual(srv.writes, []);
  assert.equal(publicControls(product, "settings-collaborator-result")[0].textContent, "Tick that this person has agreed to be named.");
  const agreed = publicControls(product, "settings-collaborator-agreed")[0]; agreed.checked = true; agreed.fire("change", {});
  await publicPress(srv, save, SCRIPTED);
  assert.deepEqual(srv.writes, []);
});

// TST-474054 · level: component · module: MOD-settings-pages
// guards: UC-001; UC-006; UC-008; UC-014; UC-042; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK; ONE CLICK PER DECISION; EVERY STEP EXPLAINS ITSELF; AN APPROVAL NAMES THE EXACT TEXT; STATUS IS DERIVED FROM THE RECORDS; EDITS ARE PREPARED ON THE DASHBOARD; A SAVE IS REFUSED WHEN THE TEXT CHANGED MEANWHILE; AN EDITED FILE KEEPS ITS IDENTIFIER; WITHOUT A TOKEN, GITHUB'S WEB INTERFACE IS THE FALLBACK; A GITLAB PRODUCT IS WRITTEN WITH A TOKEN; AN ACCEPTED SPEC CHANGE IS WRITTEN WITH ITS APPROVAL; A STALE APPROVAL IS NOT APPLIED; A QUEUE IS ACCEPTED IN ITS ORDER; SEVERAL FILES ARE ACCEPTED IN ONE CLICK; A SPEC EDIT IS SAVED AS A PROPOSAL; ADDING A PRODUCT CREATES ITS LAYOUT; THE DASHBOARD KEEPS ITS PRODUCTS IN THE BROWSER; NO PRODUCT IS NAMED IN THE INSTANCE REPOSITORY; A GITLAB PRODUCT USES A PROJECT ACCESS TOKEN; A TOKEN GOES ONLY TO THE SERVER THAT ISSUED IT; THE SHARED PAGES ORIGIN IS DISCLOSED; THE TOKEN LINK IS PREFILLED; THE REPOSITORY CHOICE IS SPELLED OUT; A BROWSER SETTING IS TESTED AND CLEARED WHERE IT IS SHOWN; A STORED SECRET IS HIDDEN UNTIL SHOWN; A CLEAR IS A REAL CLEAR; A TOKEN'S EXPIRY IS WARNED OF IN ADVANCE; AN EXPIRED TOKEN IS NAMED AND ITS RENEWAL LINKED; SETTINGS ARE EXPORTED AND IMPORTED WITH THEIR SECRETS; AN EXPORT STATES THAT IT CONTAINS SECRETS; AN EXPORT CAN BE LOCKED WITH A PASSPHRASE; A PRODUCT'S SETTINGS LIVE IN ITS REPOSITORY; SWITCHING PSEUDONYMISATION OFF STATES WHAT FOLLOWS; A PERSON IS NAMED BY ACCOUNT OR WITH CONSENT; THE JUMP HOST AND THE REMOTE SESSIONS ARE SETTINGS
// given: a collaborator on the list
// input: press Remove
// expect: one commit takes the collaborator off the list, and the page says that earlier commits keep the name
test("UC-042 5a: Remove takes a collaborator off the list with one commit, and says that earlier commits keep the name", async () => {
  const two = `${COLLABORATORS_HEAD}| Jane Doe | @jdoe | 2026-09-30 |\n| Max Müller | @max-m | 2026-10-01 |\n`;
  const { srv, box } = await publicSettingsPage({ server: await ucServer({ "docs/collaborators.md": two }, [(url) => url.href === `${API}/repos/${REPO}` ? json({ private: false, default_branch: "main", permissions: { push: true } }) : undefined]), writableProduct: true });
  const product = publicControls(box(), "settings-product")[0];
  publicControls(product, "settings-collaborator-remove-name")[0].value = "Jane Doe";
  publicControls(product, "settings-collaborator-remove-account")[0].value = "jdoe";
  await publicPress(srv, publicControls(product, "settings-collaborator-remove")[0]);
  assert.deepEqual(srv.writes.map((w) => w.files), [{ "docs/collaborators.md": `${COLLABORATORS_HEAD}| Max Müller | @max-m | 2026-10-01 |\n` }], "the retained legacy Max row keeps its exact bytes");
  const committed = await connect(parseAddress(`https://github.com/${REPO}`), { token: TOKEN }).readSnapshot("main");
  const historyLink = publicControls(product, "settings-collaborator-withdrawal-commit")[0];
  assert.ok(historyLink, "the removal exposes the returned commit");
  assert.equal(historyLink.href, `https://github.com/${REPO}/commit/${committed.commit}`);
  assert.equal(historyLink.textContent, "View removal commit");
  assert.match(product.textContent, /Max Müller · @max-m · agreed on 2026-10-01/);
});

// TST-474055 · level: component · module: MOD-settings-pages
// guards: UC-001; UC-006; UC-008; UC-014; UC-042; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK; ONE CLICK PER DECISION; EVERY STEP EXPLAINS ITSELF; AN APPROVAL NAMES THE EXACT TEXT; STATUS IS DERIVED FROM THE RECORDS; EDITS ARE PREPARED ON THE DASHBOARD; A SAVE IS REFUSED WHEN THE TEXT CHANGED MEANWHILE; AN EDITED FILE KEEPS ITS IDENTIFIER; WITHOUT A TOKEN, GITHUB'S WEB INTERFACE IS THE FALLBACK; A GITLAB PRODUCT IS WRITTEN WITH A TOKEN; AN ACCEPTED SPEC CHANGE IS WRITTEN WITH ITS APPROVAL; A STALE APPROVAL IS NOT APPLIED; A QUEUE IS ACCEPTED IN ITS ORDER; SEVERAL FILES ARE ACCEPTED IN ONE CLICK; A SPEC EDIT IS SAVED AS A PROPOSAL; ADDING A PRODUCT CREATES ITS LAYOUT; THE DASHBOARD KEEPS ITS PRODUCTS IN THE BROWSER; NO PRODUCT IS NAMED IN THE INSTANCE REPOSITORY; A GITLAB PRODUCT USES A PROJECT ACCESS TOKEN; A TOKEN GOES ONLY TO THE SERVER THAT ISSUED IT; THE SHARED PAGES ORIGIN IS DISCLOSED; THE TOKEN LINK IS PREFILLED; THE REPOSITORY CHOICE IS SPELLED OUT; A BROWSER SETTING IS TESTED AND CLEARED WHERE IT IS SHOWN; A STORED SECRET IS HIDDEN UNTIL SHOWN; A CLEAR IS A REAL CLEAR; A TOKEN'S EXPIRY IS WARNED OF IN ADVANCE; AN EXPIRED TOKEN IS NAMED AND ITS RENEWAL LINKED; SETTINGS ARE EXPORTED AND IMPORTED WITH THEIR SECRETS; AN EXPORT STATES THAT IT CONTAINS SECRETS; AN EXPORT CAN BE LOCKED WITH A PASSPHRASE; A PRODUCT'S SETTINGS LIVE IN ITS REPOSITORY; SWITCHING PSEUDONYMISATION OFF STATES WHAT FOLLOWS; A PERSON IS NAMED BY ACCOUNT OR WITH CONSENT; THE JUMP HOST AND THE REMOTE SESSIONS ARE SETTINGS
// given: Settings with Agent M localStorage entries
// input: press Clear everything and confirm
// expect: every Agent M localStorage entry is removed after a confirmation
test("UC-042 step 6: Clear everything removes every Agent M localStorage entry after a confirmation", async () => {
  const caches = fakeCaches();
  const retired = await caches.open("agent-m-file-texts");
  await retired.put("old-file-text", new Response("retired persistent file text"));
  const srv = await ucServer();
  const { general } = await publicSettingsPage({ server: srv, caches, settings: { products: [PRODUCT_ADDR], [GL_TOKEN_KEY]: { value: GL_TOKEN, name: "Agent M", expires: null }, "jump-host": { hostname: "jump.example.org", user: "agentm", sshPort: 22, portRange: [20001, 20003] } } });
  globalThis.localStorage.setItem("another-site.setting", "kept");
  assert.equal(caches.stores.size, 0, "the retired file-text cache is absent after dashboard boot");
  const before = [...Array(globalThis.localStorage.length).keys()].map((index) => globalThis.localStorage.key(index)).filter((key) => key.startsWith("agent-m:akmaier/agent-m:"));
  assert.ok(before.length > 0);
  const acknowledgement = publicControls(general(), "settings-clear-ack")[0];
  const clear = publicControls(general(), "settings-clear-everything")[0];
  assert.equal(clear.disabled, true, "Clear everything waits for its confirmation");
  assert.deepEqual([...Array(globalThis.localStorage.length).keys()].map((index) => globalThis.localStorage.key(index)).filter((key) => key.startsWith("agent-m:akmaier/agent-m:")).sort(), before.sort(), "without acknowledgement every Agent M record stays");
  acknowledgement.checked = true; acknowledgement.fire("change", {});
  await publicPress(srv, clear);
  assert.deepEqual([...Array(globalThis.localStorage.length).keys()].map((index) => globalThis.localStorage.key(index)).filter((key) => key.startsWith("agent-m:akmaier/agent-m:")), []);
  assert.equal(stored("another-site.setting"), "kept", "only Agent M's entries");
  assert.equal(caches.stores.size, 0, "the retired file-text cache remains absent after Clear everything");
  assert.equal(publicControls(general(), "settings-clear-result")[0].textContent, "Every Agent M setting for this instance is cleared from this browser.");
});

async function publicPress(srv, control, event = TRUSTED) {
  assert.ok(control, "the public Settings control exists");
  control.fire("click", event);
  await settle(srv);
}
