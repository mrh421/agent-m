// GitHub's pages without a token (ITM-335) — MOD-artifact-edits' fallbackEditLinks(files, snapshot), as
// docs/architecture/MOD-artifact-edits.md states it: "fallbackEditLinks(files: Array<{ path, text, existing }>, snapshot: Snapshot)
// -> Array<{ url, path, text, differs }> | { refused: 'gitlab' } — without a token, one GitHub page per file: the editor for an
// existing file, the new-file page for a new one; the link carries the path only and the text goes to the clipboard, never into
// the link (NO TEXT TRAVELS IN A URL, WITHOUT A TOKEN, GITHUB'S WEB INTERFACE IS THE FALLBACK). `differs` says that the file on
// the default branch is no longer what the edit started from. A GitLab product has no fallback (A GITLAB PRODUCT IS WRITTEN WITH
// A TOKEN)." The pages are those MOD-repository-hosts' webLinks gives (ITM-310), which it builds on `main`. For UC-018 4a, 4b and
// UC-008 3b.
// Run: node --test tests/artifact-edits-fallback.test.mjs
//
// Module: MOD-artifact-edits
// Guards: WITHOUT A TOKEN, GITHUB'S WEB INTERFACE IS THE FALLBACK; NO TEXT TRAVELS IN A URL; A GITLAB PRODUCT IS WRITTEN WITH A TOKEN; UC-018; UC-008; A REJECTION REMOVES THE PROPOSAL
// Level: unit
//
// `differs`: the function is given the files, each with `existing` — whether it existed when the edit started —, and the snapshot
// of the default branch as the caller reads it, and returns at once (it is given no host, and a text's blob SHA is asynchronous).
// So it is read as: the snapshot disagrees with `existing` about the file's being there — a file created since the edit
// started, or removed. A file changed in place cannot be told: the file gives the function no blob the edit started from.
//
// The repository server is replaced by a fixture: a fake host that keeps to MOD-repository-hosts' interface as
// docs/architecture/MOD-repository-hosts.md states it — one repository in memory, whose default branch is `main`; readSnapshot as
// the interface describes it, a snapshot of one commit with its paths, texts and blob SHAs. Another writer's commit lands with
// `land`. Nothing reaches the network. Each test states its input and its expected result before it runs. The counter-proofs are
// recorded in the pull request.

import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import * as edits from "../src/artifact-edits/index.mjs";

const { fallbackEditLinks } = edits;

const ON_GITHUB = { server: "github", origin: "https://github.com", path: "alice/thesis-tool",
  web: "https://github.com/alice/thesis-tool" };
const ON_GITLAB = { server: "gitlab", origin: "https://gitlab.rrze.fau.de", path: "fau-ai-taskforce/tools/thesis-tool",
  web: "https://gitlab.rrze.fau.de/fau-ai-taskforce/tools/thesis-tool" };

// A git blob SHA, as a snapshot's blob() gives it from the tree.
const blobSha = (text) => {
  const body = Buffer.from(text, "utf8");
  return createHash("sha1").update(`blob ${body.length}\0`).update(body).digest("hex");
};

// A failure as MOD-repository-hosts names it: an error with the failure's name and its fields.
const failure = (name, fields = {}) => Object.assign(new Error(`${name} ${JSON.stringify(fields)}`), { name }, fields);

// The fake host. files: the default branch `main` at its head, { path: text }. repository: the address it is connected to.
function fakeHost(files, repository = ON_GITHUB) {
  const trees = new Map();
  let made = 0;
  const commitOf = (tree) => {
    const sha = createHash("sha1").update(`commit ${++made}`).digest("hex");
    trees.set(sha, tree);
    return sha;
  };
  let head = commitOf(new Map(Object.entries(files)));
  return {
    // Another writer's commit on `main`: each path of `changed` set to its text, each path of `removed` deleted.
    land: (changed, removed = []) => {
      const tree = new Map([...trees.get(head), ...Object.entries(changed)]);
      for (const path of removed) tree.delete(path);
      head = commitOf(tree);
    },
    host: {
      async readSnapshot(ref) {
        if (ref !== "main") throw failure("NotFound", { what: ref });
        const commit = head, tree = trees.get(commit);
        return { repository, ref, commit, paths: [...tree.keys()].sort(),
          read: async (path) => tree.get(path) ?? null,
          blob: (path) => (tree.has(path) ? blobSha(tree.get(path)) : null) };
      },
    },
  };
}

// The product's files: a use case, the index of an open queue of SPEC changes, and what the person edits into them.
const USE_CASE = "docs/use-cases/UC-041-check-out-a-book.md";
const QUEUE = "docs/spec-freigaben/2026-10-11a_lending";
const ENTRY = `${QUEUE}/02-loan-period.md`;
const BRANCH = { "README.md": "# Thesis tool\n", [USE_CASE]: "---\nid: UC-041\ntitle: Check out a book\n---\n# UC-041 Check out a book\n" };

const EDITED_USE_CASE = [
  "---", "id: UC-041", "title: Check out a book", "---", "# UC-041 Check out a book", "",
  "1. The member presents the book at the desk and the librarian scans the card.", ""].join("\n");
const ENTRY_TEXT = [
  "# Entry 02: the loan period", "", "The loan period is twenty-one days for every member, renewable once while nobody waits.", ""].join("\n");

// The files an edit of the use case and a new queue entry hands on.
const FILES = [
  { path: USE_CASE, text: EDITED_USE_CASE, existing: true },
  { path: ENTRY, text: ENTRY_TEXT, existing: false },
];

// TST-472026 · level: unit · module: MOD-artifact-edits
// guards: WITHOUT A TOKEN, GITHUB'S WEB INTERFACE IS THE FALLBACK; NO TEXT TRAVELS IN A URL; A GITLAB PRODUCT IS WRITTEN WITH A TOKEN; UC-018; UC-008
// given: a product on GitHub whose default branch `main` holds a README and the use case UC-041; the person edited the use case (an existing file) and wrote a new file for a queue entry; no token is stored
// input: fallbackEditLinks([the use case, existing; the entry, new], the snapshot of `main`)
// expect: two results, in the order of the files — for the use case GitHub's editor page of `main`, https://github.com/alice/thesis-tool/edit/main/docs/use-cases/UC-041-check-out-a-book.md; for the entry GitHub's new-file page of `main`, https://github.com/alice/thesis-tool/new/main, whose query holds the path as `filename` and an empty `value` — each with its path and its text as given, for the clipboard, and nothing else but `differs`, and no line of any text anywhere in its link, as written or decoded; none refused
test("fallbackEditLinks — the editor for an existing file, the new-file page for a new one, the link without the text, the text returned", async () => {
  const fake = fakeHost(BRANCH);
  const snapshot = await fake.host.readSnapshot("main");

  const links = fallbackEditLinks(FILES, snapshot);

  assert.ok(Array.isArray(links), "links, not a refusal");
  assert.equal(links.length, 2, "one page per file");
  assert.equal(links[0].url, "https://github.com/alice/thesis-tool/edit/main/docs/use-cases/UC-041-check-out-a-book.md", "the editor");
  const page = new URL(links[1].url);
  assert.equal(page.origin + page.pathname, "https://github.com/alice/thesis-tool/new/main", "the new-file page");
  assert.deepEqual([...page.searchParams], [["filename", ENTRY], ["value", ""]], "the path only; the record empty");
  for (const [i, file] of FILES.entries()) {
    assert.deepEqual(Object.keys(links[i]).sort(), ["differs", "path", "text", "url"], `${file.path}: a link, its path, its text, differs`);
    assert.equal(links[i].path, file.path, `${file.path}: its path`);
    assert.equal(links[i].text, file.text, `${file.path}: its text, for the clipboard`);
    for (const line of file.text.split("\n").filter((l) => l.length > 20)) {
      assert.ok(!links[i].url.includes(line) && !decodeURIComponent(links[i].url).includes(line), `${file.path}: "${line}" is not in the link`);
    }
  }
});

// TST-472027 · level: unit · module: MOD-artifact-edits
// guards: WITHOUT A TOKEN, GITHUB'S WEB INTERFACE IS THE FALLBACK; NO TEXT TRAVELS IN A URL; A GITLAB PRODUCT IS WRITTEN WITH A TOKEN; UC-018; UC-008
// given: the product above, and the files of the first test — the use case existing, the entry new — as the edit started, when `main` held the use case and no entry; the caller reads `main` and hands the snapshot on; (1) nothing changed on `main` since; (2) another writer's commit removed the use case; (3) another writer's commit created the entry file
// input: fallbackEditLinks(files, the snapshot of `main` as read then)
// expect: `differs` for the use case and for the entry — (1) false, false; (2) true, false; (3) false, true
test("fallbackEditLinks — differs once the branch moved: a file removed, a file created", async () => {
  for (const [label, move, expected] of [
    ["nothing changed", null, [false, false]],
    ["the use case removed", { changed: {}, removed: [USE_CASE] }, [true, false]],
    ["the entry created", { changed: { [ENTRY]: "# Entry 02, written by another person\n" }, removed: [] }, [false, true]],
  ]) {
    const fake = fakeHost(BRANCH);
    if (move) fake.land(move.changed, move.removed);
    const snapshot = await fake.host.readSnapshot("main");

    const links = fallbackEditLinks(FILES, snapshot);

    assert.deepEqual(links.map((l) => l.differs), expected, label);
  }
});

// TST-472028 · level: unit · module: MOD-artifact-edits
// guards: WITHOUT A TOKEN, GITHUB'S WEB INTERFACE IS THE FALLBACK; NO TEXT TRAVELS IN A URL; A GITLAB PRODUCT IS WRITTEN WITH A TOKEN; UC-018; UC-008
// given: a product on a GitLab server, whose default branch `main` holds a README and the use case UC-041; the same files; no token is stored — and, as the known positive, the same product on GitHub
// input: fallbackEditLinks(files, the snapshot of `main`) on each
// expect: { refused: "gitlab" } for the GitLab product — there is no fallback, and no link —; links for the GitHub product
test("fallbackEditLinks — a GitLab product is refused (GitHub, GitLab)", async () => {
  const github = await fakeHost(BRANCH, ON_GITHUB).host.readSnapshot("main");
  const gitlab = await fakeHost(BRANCH, ON_GITLAB).host.readSnapshot("main");

  assert.ok(Array.isArray(fallbackEditLinks(FILES, github)), "known positive: GitHub gets its pages");
  assert.deepEqual(fallbackEditLinks(FILES, gitlab), { refused: "gitlab" }, "GitLab is refused");
});

// TST-2026271032 · level: unit · module: MOD-artifact-edits
// guards: WITHOUT A TOKEN, GITHUB'S WEB INTERFACE IS THE FALLBACK; NO TEXT TRAVELS IN A URL; A REJECTION REMOVES THE PROPOSAL
// given: the product above, whose `main` holds the use case UC-041; known positive: an existing file with a text gets GitHub's editor (TST-472026)
// input: fallbackEditLinks([the use case, existing, with the text null — to be deleted]) on GitHub, and the same on GitLab
// expect: GitHub's page that deletes the file from `main`, https://github.com/alice/thesis-tool/delete/main/docs/use-cases/UC-041-check-out-a-book.md, with its path, the text null and `differs` false; on GitLab the refusal { refused: "gitlab" }
test("fallbackEditLinks — a file whose text is null gets GitHub's page that deletes it", async () => {
  const deleted = [{ path: USE_CASE, text: null, existing: true }];
  const links = fallbackEditLinks(deleted, await fakeHost(BRANCH).host.readSnapshot("main"));
  assert.deepEqual(links, [{ url: "https://github.com/alice/thesis-tool/delete/main/docs/use-cases/UC-041-check-out-a-book.md", path: USE_CASE, text: null, differs: false }]);
  assert.deepEqual(fallbackEditLinks(deleted, await fakeHost(BRANCH, ON_GITLAB).host.readSnapshot("main")), { refused: "gitlab" });
});
