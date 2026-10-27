// Reject on the review pages — MOD-review-pages: beside Accept, the page of an open use case, an architecture decision and a SPEC change entry offers
// Reject with a field for the reason; Reject writes nothing until a reason is typed, and then one commit through MOD-approvals' rejectShown or
// MOD-spec-changes' rejectEntry; without a token, GitHub's pages are offered instead (UC-006 4a, UC-008 3f, UC-023 5b).
// Run through tests/review-core.test.mjs, which SPEC.md names for these checks: node --test tests/*.test.mjs
//
// Module: MOD-review-pages
// Guards: A PROPOSAL IS REJECTED WITH A REASON; A REJECTION REMOVES THE PROPOSAL; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK; WITHOUT A TOKEN, GITHUB'S WEB INTERFACE IS THE FALLBACK; A FORM OPENS WITH ITS FIRST FIELD FOCUSED; UC-006; UC-008; UC-023
// Level: component
//
// The pages run in the browser harness of tests/review-pages-harness.mjs (its document and its localStorage), installed only for the one test below,
// which runs inside the process of tests/review-core.test.mjs and puts back the globals it set when it ends. The repository is the instance itself, held
// by tests/memory-host.mjs: SPEC.md and the queue QD of tests/review-core.d/helpers.mjs with a rationale for each entry, UC-001 open, UC-002 accepted, and
// ARC-001 open, forced by UC-002. A click is a person's, as the harness marks it. Each case states its input and its expected result.

import test from "node:test";
import assert from "node:assert/strict";
import { blobSha } from "../../src/text-tools/index.mjs";
import { memoryHost } from "../memory-host.mjs";
import { approvalPath, recordText } from "../approval-records.mjs";
import { QD, B_SPEC, B_P05, B_P06, B_INDEX, B_UC1, B_UC2 } from "./helpers.mjs";

const GLOBALS = ["document", "window", "localStorage"];
const REASON = "Out of scope for this release.";
const UC1 = "docs/use-cases/UC-001-a.md", UC2 = "docs/use-cases/UC-002-b.md", ARC1 = "docs/architecture/ARC-001-one.md";
const ARC1_TEXT = "---\nid: ARC-001\ntitle: One\nforced_by:\n  - UC-002\n---\n# ARC-001 One\n\nOne decision.\n";
const TOKEN = { value: "github_pat_REJECT0123456789abcdefghij", name: "alice", expires: "2027-01-01" };
const RATIONALE = "# A change\n\n**The change.** A change.\n\n**Why.** A reason.\n\n**Impact list.**\n- none.\n\n**Origin.** a test.\n";

async function repository() {
  return memoryHost({ "SPEC.md": B_SPEC, [`${QD}/index.md`]: B_INDEX, [`${QD}/entscheidungen.md`]: "# Decisions\n\nAppend-only.\n",
    [`${QD}/05-a.md`]: B_P05, [`${QD}/05-a.begruendung.md`]: RATIONALE, [`${QD}/06-b.md`]: B_P06, [`${QD}/06-b.begruendung.md`]: RATIONALE,
    [UC1]: B_UC1, [UC2]: B_UC2, [approvalPath("UC-002", await blobSha(B_UC2))]: recordText({ kind: "use-case", file: UC2, blob: await blobSha(B_UC2) }),
    [ARC1]: ARC1_TEXT });
}

function find(root, match) {
  const found = [];
  (function walk(node) { for (const kid of node.childNodes) if (kid.nodeType === 1) { if (match(kid)) found.push(kid); walk(kid); } })(root);
  return found;
}
const byClass = (root, name, className) => find(root, (node) => node.localName === name && String(node.className).split(" ").includes(className));
async function until(condition, what) {
  for (let turn = 0; turn < 400; turn++) {
    if (condition()) return;
    await new Promise((resolve) => setImmediate(resolve));
  }
  assert.fail(`waited for ${what}`);
}

test("TST-2026271021..24: Reject on the review pages", async (t) => {
  const before = new Map(GLOBALS.map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  try {
    const { emptyStorage } = await import("../review-pages-harness.mjs");
    const { installDocument } = await import("../site-frame-dom.mjs");
    installDocument();
    const { openStore, writeSetting } = await import("../../src/browser-store/index.mjs");
    const { view } = await import("../../src/review-pages/index.mjs");
    const route = (name) => view.routes.find((each) => each.name === name);

    // The page of `route` with `params`, for the instance itself, with or without a token stored in this browser. Without one, the host is connected
    // without a token, and GitHub answers that it may not be written (MOD-repository-hosts, RepositoryInfo.canWrite).
    async function show(repo, name, params, { token = true } = {}) {
      emptyStorage();
      const store = openStore("alice/agent-m");
      if (token) writeSetting(store, "github-token", TOKEN);
      const host = token ? repo.host : { ...repo.host, repositoryInfo: async () => ({ defaultBranch: "main", canWrite: false }) };
      const target = document.createElement("main");
      document.body.append(target);
      await route(name).render(target, { page: "review", instance: { repository: "alice/agent-m", host }, store, go() {}, product: null }, params);
      return target;
    }
    const rejectOf = (page) => byClass(page, "button", "reject")[0];
    const reasonOf = (page) => byClass(page, "textarea", "reject-reason")[0];
    const type = (page, text) => { reasonOf(page).value = text; reasonOf(page).dispatchEvent(new Event("input")); };

    // TST-2026271021 · level: component · module: MOD-review-pages
    // guards: A PROPOSAL IS REJECTED WITH A REASON
    // given: UC-001 open, ARC-001 open and resting on accepted UC-002, entry 05 of QD open; a token stored; known contrast: UC-002 accepted
    // input: the pages use-case/UC-001, decision/ARC-001, spec-entry/spec-2026-09-24g_x-05, use-case/UC-002
    // expect: on each of the three, Accept and beside it Reject with a reason field whose label names it; on UC-002 neither; nothing written
    await t.test("TST-2026271021: an open use case, an architecture decision and a SPEC change entry each offer Reject", async () => {
      const repo = await repository();
      for (const [name, id] of [["use-case", "UC-001"], ["decision", "ARC-001"], ["spec-entry", "spec-2026-09-24g_x-05"]]) {
        const page = await show(repo, name, { id });
        assert.equal(byClass(page, "button", "accept").length, 1, `${id}: Accept`);
        assert.equal(rejectOf(page)?.textContent, "Reject", `${id}: Reject beside it`);
        const label = find(page, (node) => node.localName === "label" && node.childNodes.includes(reasonOf(page)))[0];
        assert.match(label?.textContent ?? "", /Reason for rejecting/, `${id}: the field's label`);
      }
      const accepted = await show(repo, "use-case", { id: "UC-002" });
      assert.equal(byClass(accepted, "button", "accept").length + byClass(accepted, "button", "reject").length, 0, "an accepted use case: neither");
      assert.equal(repo.commits().length, 0, "nothing written");
    });

    // TST-2026271022 · level: component · module: MOD-review-pages
    // guards: A PROPOSAL IS REJECTED WITH A REASON; A REJECTION REMOVES THE PROPOSAL; A FORM OPENS WITH ITS FIRST FIELD FOCUSED
    // given: UC-001 open, with a token stored
    // input: Reject with the reason field empty, then with blanks; then the reason typed and Reject
    // expect: nothing written for the first two, a note that says so, the focus in the reason field; then one commit that removes UC-001 and holds the reason, and the page says which commit
    await t.test("TST-2026271022: Reject without a reason writes nothing; with one, it removes the never-accepted use case", async () => {
      const repo = await repository();
      const page = await show(repo, "use-case", { id: "UC-001" });
      rejectOf(page).dispatchEvent(new Event("click"));
      type(page, "   ");
      rejectOf(page).dispatchEvent(new Event("click"));
      await new Promise((resolve) => setImmediate(resolve));
      assert.equal(repo.commits().length, 0, "nothing written without a reason");
      assert.match(byClass(page, "p", "problem").map((p) => p.textContent).join(" "), /reason/i, "the page says a reason is needed");
      assert.equal(document.activeElement, reasonOf(page), "the focus in the reason field");
      type(page, REASON);
      rejectOf(page).dispatchEvent(new Event("click"));
      await until(() => repo.commits().length === 1, "the rejection commit");
      const [commit] = repo.commits();
      assert.deepEqual(commit.files, [{ path: UC1, delete: true }]);
      assert.ok(commit.message.includes(REASON));
      await until(() => /Rejected in commit/.test(page.textContent), "the page names the commit");
    });

    // TST-2026271023 · level: component · module: MOD-review-pages
    // guards: A REJECTION REMOVES THE PROPOSAL
    // given: entry 05 of QD open, with a token stored
    // input: the reason typed and Reject on its page
    // expect: one commit that removes 05's proposal and rationale and its row of the index, with the reason in its message
    await t.test("TST-2026271023: rejecting a SPEC change entry on its page takes it out of its queue", async () => {
      const repo = await repository();
      const page = await show(repo, "spec-entry", { id: "spec-2026-09-24g_x-05" });
      type(page, REASON);
      rejectOf(page).dispatchEvent(new Event("click"));
      await until(() => repo.commits().length === 1, "the rejection commit");
      const [commit] = repo.commits();
      assert.deepEqual(commit.files.map((f) => f.path).sort(), [`${QD}/05-a.begruendung.md`, `${QD}/05-a.md`, `${QD}/index.md`]);
      assert.ok(commit.message.includes(REASON));
    });

    // TST-2026271024 · level: component · module: MOD-review-pages
    // guards: WITHOUT A TOKEN, GITHUB'S WEB INTERFACE IS THE FALLBACK; NO TEXT TRAVELS IN A URL
    // given: UC-001 open, no token stored
    // input: the reason typed and Reject
    // expect: nothing written; a link to GitHub's page that deletes UC-001, carrying no text, and the reason shown to be used as the commit's message
    await t.test("TST-2026271024: without a token, Reject offers GitHub's page and the reason for its commit", async () => {
      const repo = await repository();
      const page = await show(repo, "use-case", { id: "UC-001" }, { token: false });
      type(page, REASON);
      rejectOf(page).dispatchEvent(new Event("click"));
      const section = byClass(page, "section", "reject")[0];
      await until(() => byClass(section, "pre", "commit-message").length > 0, "GitHub's page and the message");
      assert.deepEqual(byClass(section, "a", "github-page").map((a) => a.getAttribute("href")),
        [`https://github.com/memory-owner/memory-repository/delete/main/${UC1}`], "the page that deletes UC-001, beside Accept's own page of the record");
      assert.ok(byClass(section, "pre", "commit-message").some((pre) => pre.textContent.includes(REASON)), "the reason for the commit's message");
      assert.equal(repo.commits().length, 0, "nothing written");
    });
  } finally {
    for (const [key, descriptor] of before) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; }
  }
});
