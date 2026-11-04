// A repository source gets a new version in the library (ITM-705) — MOD-settings-pages' route `library/<source>`, as docs/architecture/MOD-settings-pages.md and UC-016 step 1 state it: "+ New version
// — the same routes as in UC-004: … a newer commit of a repository", refused "when its bytes equal an existing version's"; the plan is MOD-source-register's versionCommits with `version.commit` (tests/source-register-
// version-commit.test.mjs). The route is rendered into the fixture DOM of tests/settings-pages-harness.mjs over MOD-repository-hosts' real GitHub host (connect) for the instance and for the repository, answered by a
// fake of fetch over repositories that hold files (tests/settings-pages-sources.d/github.mjs); nothing reaches the network.
// Run: node --test tests/settings-pages-library-repository-version.test.mjs
//
// Module: MOD-settings-pages
// Guards: UC-016; A LIVING SOURCE IS PINNED; A SOURCE VERSION IS NEVER OVERWRITTEN; A PERSON'S OWN INPUT IS COMMITTED DIRECTLY; ONE CLICK PER DECISION
// Level: unit
//
// Each test names its input and states its expected result in its own text (given / input / expect) before it runs; no expected value is read from a document, and none from the code. Where the texts leave a
// reading open, the test states the reading it takes, and the pull request names it with its source:
//   - A source of kind repository is a source whose `identifier` is a repository's address and no EU legal text's (MOD-source-register, Data: "`identifier` … a repository's address"; "A source of kind repository
//     is its repository at the pinned commit"). The library's repository route writes kind `system`, so the kind cannot tell it.
//   - + New version of such a source offers no file and, when saved, reads the commit the repository's default branch stands at, as the registration of a repository does, through a host connected with the repository's
//     stored token or, where it has none, the instance's.
//   - The requests counted are those of the GitHub host over the fake: the repository's information is one request, and its snapshot two (the head, then the tree).
// The fake's heads: the first commit of a repository in tests/settings-pages-sources.d/github.mjs is the SHA-1 of "<owner>/<name>#0", and each change of it the SHA-1 of "…#1", "…#2". The counter-proofs (a planted
// fault in src/settings-pages/ or src/source-register/ and the test's failing result) are recorded in the pull request.

import test from "node:test";
import assert from "node:assert/strict";
import { installDocument, byClass, click, type, until } from "./settings-pages-harness.mjs";
import { attachedTarget, freshStore } from "./settings-pages-setup.d/dom.mjs";
import { githubWorld, installWorld, isWrite } from "./settings-pages-sources.d/github.mjs";

installDocument();
const { view } = await import("../src/settings-pages/index.mjs");
const { writeSetting } = await import("../src/browser-store/index.mjs");
const { connect, parseAddress } = await import("../src/repository-hosts/index.mjs");
const { readDocument } = await import("../src/documents/index.mjs");
const { sourceSchemas, registrationCommits } = await import("../src/source-register/index.mjs");
const library = view.routes.find((candidate) => candidate.name === "library");

const INSTANCE = "akmaier/agent-m";
const GUIDE = "https://github.com/erin/guide", GUIDE_PATH = "erin/guide";
const TOKEN = "github_pat_INSTANCE0123456789abcdefghij", GUIDE_TOKEN = "github_pat_GUIDE00123456789abcdefghijkl";
const C1 = "96210fa4bf2c1cb0c5bc69339eb4c04c840f7f1b", C2 = "240ddc98fbd96ee987230e72d664cfd892e6574e";
const ELI_URL = "https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32024R1689";

const ENTRY_PATH = "docs/sources/SRC-guide.md";
const FRONT = (identifier, kind = "system") => ["---", "id: SRC-guide", "title: Erin's guide", `kind: ${kind}`, "authority: normative", "licence: may be republished — MIT", `identifier: ${identifier}`, "---",
  "# SRC-guide Erin's guide", "", "## Versions", "", "| Version | Date | Edition | Read from | Files |", "|---|---|---|---|---|"];
// The entry of a repository source as the library's repository route registers it: the first version read from the repository at the commit C1, with no file.
async function registeredText() {
  const form = readDocument(sourceSchemas().entry, ENTRY_PATH, [...FRONT(GUIDE), `| \`2026-10-01\` | 2026-10-01 | — | ${GUIDE} commit ${C1} | pending |`, ""].join("\n"));
  const plan = await registrationCommits(form, [], INSTANCE);
  return plan.find((item) => item.repository === INSTANCE).files.find((file) => file.path === ENTRY_PATH).content;
}
const REGISTERED = await registeredText();

// The page: a world of the instance (the register entry) and of the repository (at its first commit, or at a later one when `newer`), the real hosts over it, a store keeping the tokens, a context as the frame
// hands it, and the route rendered for the source.
async function open(t, { entryText = REGISTERED, newer = false, repository = true, token = true } = {}) {
  const world = githubWorld({ [INSTANCE]: { files: { [ENTRY_PATH]: entryText } }, ...(repository ? { [GUIDE_PATH]: { files: { "README.md": "The guide.\n" } } } : {}) });
  installWorld(t, world);
  if (repository && newer) world.change(GUIDE_PATH, "README.md", "The guide, revised.\n");
  const store = freshStore();
  if (token) {
    writeSetting(store, "github-token", { value: TOKEN, name: "Agent M", expires: "2027-01-01" });
    writeSetting(store, `github-token:${GUIDE_PATH}`, { value: GUIDE_TOKEN, name: "guide", expires: "2027-01-01" });
  }
  const context = { page: "review", instance: { repository: INSTANCE, host: connect(parseAddress(`https://github.com/${INSTANCE}`), token ? { token: TOKEN } : {}) },
    product: null, store, went: [], go() {} };
  const target = attachedTarget();
  await library.render(target, context, { source: "SRC-guide" });
  return { world, target };
}
const one = (root, name) => { const found = byClass(root, name); assert.equal(found.length, 1, `exactly one .${name}`); return found[0]; };
const text = (root, name) => one(root, name).textContent;
const commitsOf = (page, repository) => page.world.commits(repository);
const requestsTo = (page, repository) => page.world.requests.filter((request) => request.repository === repository);
async function newVersion(page, version) {
  await click(one(page.target, "library-new-version"));
  type(one(page.target, "library-version-id"), version);
  type(one(page.target, "library-version-date"), version);
  await click(one(page.target, "library-version-save"));
}

// TST-705003 · level: unit · module: MOD-settings-pages
// guards: UC-016; A LIVING SOURCE IS PINNED; A SOURCE VERSION IS NEVER OVERWRITTEN; A PERSON'S OWN INPUT IS COMMITTED DIRECTLY; ONE CLICK PER DECISION
// given: SRC-guide, a repository source (identifier https://github.com/erin/guide) registered with its version 2026-10-01 read at the commit 96210fa4…; the repository now stands at a newer commit, 240ddc98…; the token of erin/guide stored
// input: render library/SRC-guide; press + New version; type the version 2026-11-01 and the same date; choose no file; press Save new version
// expect: the panel offers no field for files; its statement reads "Becomes public: the register entry, always, in the instance repository akmaier/agent-m. No file is stored: the commit https://github.com/erin/guide stands at when you save is recorded."; one commit in the instance and none in erin/guide, holding exactly docs/sources/SRC-guide.md, made with the instance's token, its message "New version 2026-11-01 of SRC-guide (Agent M dashboard)"; the entry keeps the row of 2026-10-01 line for line and has the row `| `2026-11-01` | 2026-11-01 | - | https://github.com/erin/guide commit 240ddc98fbd96ee987230e72d664cfd892e6574e | …`; the result reads "✓ 2026-11-01 is recorded for SRC-guide: committed to akmaier/agent-m."; the entry lists 2026-10-01 and 2026-11-01, the second "read from https://github.com/erin/guide commit 240ddc98fbd96ee987230e72d664cfd892e6574e"; erin/guide was read with its own token and written nowhere
test("new version — a repository source records the commit the repository stands at now, with no file", async (t) => {
  const page = await open(t, { newer: true });
  await click(one(page.target, "library-new-version"));
  assert.equal(byClass(page.target, "library-version-files").length, 0, "no field for files");
  assert.equal(text(page.target, "library-version-public"),
    `Becomes public: the register entry, always, in the instance repository ${INSTANCE}. No file is stored: the commit ${GUIDE} stands at when you save is recorded.`);
  type(one(page.target, "library-version-id"), "2026-11-01");
  type(one(page.target, "library-version-date"), "2026-11-01");
  await click(one(page.target, "library-version-save"));
  await until(() => commitsOf(page, INSTANCE).length === 1 && text(page.target, "library-version-result") !== "", "the version is committed");
  const commit = commitsOf(page, INSTANCE)[0];
  assert.deepEqual(Object.keys(commit.files), [ENTRY_PATH]);
  assert.equal(commit.authorization, `Bearer ${TOKEN}`);
  assert.equal(commit.message, "New version 2026-11-01 of SRC-guide (Agent M dashboard)");
  const kept = REGISTERED.split("\n").find((line) => line.startsWith("| `2026-10-01`"));
  assert.equal(commit.files[ENTRY_PATH].includes(kept), true, "the row of 2026-10-01 stays as it was");
  assert.equal(commit.files[ENTRY_PATH].includes(`| \`2026-11-01\` | 2026-11-01 | - | ${GUIDE} commit ${C2} | `), true, "the row of 2026-11-01 records the commit");
  assert.equal(text(page.target, "library-version-result"), "✓ 2026-11-01 is recorded for SRC-guide: committed to akmaier/agent-m.");
  assert.deepEqual(byClass(page.target, "library-version").map((node) => node.textContent.slice(0, 10)), ["2026-10-01", "2026-11-01"]);
  assert.equal(byClass(page.target, "library-version")[1].textContent.includes(`read from ${GUIDE} commit ${C2}`), true);
  assert.deepEqual(commitsOf(page, GUIDE_PATH), [], "erin/guide is written nowhere");
  assert.equal(page.world.requests.filter(isWrite).every((request) => request.repository === INSTANCE), true);
  assert.equal(requestsTo(page, GUIDE_PATH).every((request) => request.authorization === `Bearer ${GUIDE_TOKEN}`), true, "erin/guide is read with its own token");
});

// TST-705004 · level: unit · module: MOD-settings-pages
// guards: UC-016; A SOURCE VERSION IS NEVER OVERWRITTEN; A LIVING SOURCE IS PINNED
// given: the same source with a second version, 2026-11-01, read at the commit 240ddc98…; the repository stands at that commit, the one 2026-11-01 records (and not the one 2026-10-01 records)
// input: + New version 2026-12-01, Save
// expect: the result reads "✗ SRC-guide already records the same bytes as 2026-11-01 — nothing was recorded." (it names the version that records the commit, not the first); nothing is committed anywhere and the page sent no write; the entry lists 2026-10-01 and 2026-11-01 only
test("new version — the commit an existing version records is refused as the same bytes, naming that version, and nothing is recorded", async (t) => {
  const lines = REGISTERED.split("\n");
  const at = lines.findIndex((line) => line.startsWith("| `2026-10-01`"));
  const files = lines[at].split(" | ").at(-1).replace(/ \|$/, "");
  lines.splice(at + 1, 0, `| \`2026-11-01\` | 2026-11-01 | - | ${GUIDE} commit ${C2} | ${files} |`);
  const twice = [...lines.filter((line, index) => index < lines.length - 1 || line !== ""), "### Files of 2026-11-01", "", "| File | SHA-256 | Kept at |", "|---|---|---|", ""].join("\n");
  const page = await open(t, { entryText: twice, newer: true });
  await newVersion(page, "2026-12-01");
  await until(() => text(page.target, "library-version-result") !== "", "the refusal is shown");
  assert.equal(text(page.target, "library-version-result"), "✗ SRC-guide already records the same bytes as 2026-11-01 — nothing was recorded.");
  assert.deepEqual([commitsOf(page, INSTANCE), commitsOf(page, GUIDE_PATH)], [[], []]);
  assert.deepEqual(page.world.requests.filter(isWrite), []);
  assert.deepEqual(byClass(page.target, "library-version").map((node) => node.textContent.slice(0, 10)), ["2026-10-01", "2026-11-01"]);
});

// TST-705005 · level: unit · module: MOD-settings-pages
// guards: UC-016; A PAGE LOAD READS THE REPOSITORY IN BATCHES; A TOKEN GOES ONLY TO THE SERVER THAT ISSUED IT
// given: the same source with the repository at the newer commit; once with the tokens stored and once with none
// input: render library/SRC-guide; + New version 2026-11-01, Save
// expect: opening sends no request to erin/guide; the press of Save sends 3 to it without a token and 4 with one — the repository's information 1, with a token greenToMerge's GraphQL request beside it 1 (ITM-1170), its head 1, its tree 1 —, none of them a write; with the token stored the version is recorded ("✓"), and with none the instance refuses the commit, nothing is recorded and the result begins with ✗
test("new version — one Save reads the repository in 3 requests without a token and 4 with one, and opening reads it not at all", async (t) => {
  for (const token of [true, false]) {
    const label = token ? "with a token" : "without a token";
    const page = await open(t, { newer: true, token });
    assert.equal(requestsTo(page, GUIDE_PATH).length, 0, `${label}: opening`);
    await newVersion(page, "2026-11-01");
    await until(() => text(page.target, "library-version-result") !== "", `${label}: the result is shown`);
    // ITM-1170: with a token, the GraphQL request of greenToMerge beside the repository's information.
    assert.equal(requestsTo(page, GUIDE_PATH).length, token ? 4 : 3, `${label}: Save`);
    assert.equal(requestsTo(page, GUIDE_PATH).some(isWrite), false, `${label}: no write`);
    assert.equal(text(page.target, "library-version-result").startsWith(token ? "✓" : "✗"), true, `${label}: the result`);
    assert.equal(commitsOf(page, INSTANCE).length, token ? 1 : 0, `${label}: the commit`);
  }
});

// TST-705006 · level: unit · module: MOD-settings-pages
// guards: UC-016; A SOURCE VERSION IS NEVER OVERWRITTEN
// given: the same source whose repository the server does not know
// input: + New version 2026-11-01, Save
// expect: the result begins "✗ ", names erin/guide as not found and ends " — nothing was recorded." — it does not speak of the same bytes, since no commit was read to compare —; nothing is committed and the page sent no write
test("new version — a repository that cannot be read records nothing, and the page names it", async (t) => {
  const page = await open(t, { repository: false });
  await newVersion(page, "2026-11-01");
  await until(() => text(page.target, "library-version-result") !== "", "the failure is shown");
  const result = text(page.target, "library-version-result");
  assert.equal(result.startsWith("✗ ") && result.endsWith(" — nothing was recorded."), true, result);
  assert.equal(result.includes("erin/guide") && result.includes("not found"), true, result);
  assert.equal(result.includes("same bytes"), false, result);
  assert.deepEqual(commitsOf(page, INSTANCE), []);
  assert.deepEqual(page.world.requests.filter(isWrite), []);
});

// TST-705007 · level: unit · module: MOD-settings-pages
// guards: UC-016; A SOURCE VERSION IS FIXED BY IDENTIFIER AND HASH
// given: SRC-guide as an EU legal text: kind regulation, identifier https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32024R1689 (an address that reads as a GitLab project's), no version row yet (it waits for its fetch; a fetched one starts the fetch run instead, tests/settings-pages-library-legal-text-version.test.mjs)
// input: render library/SRC-guide; press + New version
// expect: the panel offers the field for files, as for any source that is no repository (the page reads the repository of no EU legal text), and its statement begins "Becomes public: the register entry, always" without the words "No file is stored"; the page sent no request to eur-lex.europa.eu
test("new version — an EU legal text whose identifier reads as a repository's address is no repository source", async (t) => {
  const legal = [...FRONT(ELI_URL, "regulation"), ""].join("\n");
  const page = await open(t, { entryText: legal, repository: false });
  await click(one(page.target, "library-new-version"));
  assert.equal(byClass(page.target, "library-version-files").length, 1, "the field for files");
  assert.equal(text(page.target, "library-version-public").includes("No file is stored"), false);
  assert.equal(page.world.requests.some((request) => request.url.hostname === "eur-lex.europa.eu"), false);
});
