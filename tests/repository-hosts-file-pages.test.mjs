// MOD-repository-hosts' webLinks().newFile and webLinks().editFile (ITM-310), as the accepted text of
// docs/architecture/MOD-repository-hosts.md states them: "WebLinks — { …, newFile(path: string, record: string) -> string | null,
// editFile(path: string) -> string, … }: the server's own pages; a page the server does not offer is null", and "A new-file page
// prepared for the fallback without a token carries at most a file's path and an approval record — never a reviewed text (NO TEXT
// TRAVELS IN A URL), and never a credential (A CREDENTIAL IS NEVER PLACED IN A URL)". Deterministic, no network: the pages are
// addresses, navigation only, so `fetch` is replaced by a recorder that must stay silent. The pages: GitHub's new-file page https://github.com/<owner>/<name>/new/<branch>
// with the parameters `filename` and `value`, and its editor https://github.com/<owner>/<name>/edit/<branch>/<path>; GitLab's
// single-file editor as GitLab links it itself, https://<server>/<project>/-/edit/<branch>/<path> (its handbook links
// https://gitlab.com/gitlab-com/content-sites/handbook/-/edit/main/.gitlab/CODEOWNERS, read 2026-10-11); GitLab has no new-file
// page that takes a record (UC-008 3c). The branch defaults to `main` when no caller has handed on the repository's reported
// default branch.
// Run: node --test tests/repository-hosts-file-pages.test.mjs
//
// Module: MOD-repository-hosts
// Guards: UC-006; UC-008; UC-018; WITHOUT A TOKEN, GITHUB'S WEB INTERFACE IS THE FALLBACK; NO TEXT TRAVELS IN A URL; A CREDENTIAL IS NEVER PLACED IN A URL; A REJECTION REMOVES THE PROPOSAL
// Level: unit
//
// Each test states its input and its expected result before it runs (given / input / expect).

import test from "node:test";
import assert from "node:assert/strict";
import { parseAddress, connect } from "../src/repository-hosts/index.mjs";

const GITHUB = parseAddress("https://github.com/alice/agent-m");
const GITLAB = parseAddress("https://gitlab.example.org/grp/sub/thesis-tool");

// The approval record of a module file — three lines — and the path it is committed at (MOD-approvals' approval record,
// docs/approvals/<ID>-<blob12>.md).
const RECORD_PATH = "docs/approvals/MOD-repository-hosts-25d0f9f517ea.md";
const RECORD = ["kind: module", "file: docs/architecture/MOD-repository-hosts.md", "blob: 25d0f9f517ea45fbce3262468b652bff6d172b55"]
  .join("\n") + "\n";

// Runs `run` with a `fetch` that records what it is asked for, and fails when any request was made; returns what `run` returns.
function withoutRequests(run) {
  const sent = [];
  const real = globalThis.fetch;
  globalThis.fetch = async (input) => { sent.push(String(input?.url ?? input)); return new Response("{}", { status: 200 }); };
  let result;
  try { result = run(); } finally { globalThis.fetch = real; }
  assert.deepEqual(sent, [], "no request is made");
  return result;
}

// ---------------------------------------------------------------- GitHub's new-file page

// TST-472538 · level: unit · module: MOD-repository-hosts
// guards: WITHOUT A TOKEN, GITHUB'S WEB INTERFACE IS THE FALLBACK; NO TEXT TRAVELS IN A URL; A CREDENTIAL IS NEVER PLACED IN A URL
// given: the GitHub repository alice/agent-m, connected without a token; the approval record of a module file, three lines, and the path it is committed at
// input: webLinks().newFile(path, record)
// expect: a string, GitHub's new-file page of the default branch, https://github.com/alice/agent-m/new/main, whose query holds exactly two parameters — `filename`, the path, and `value`, the record with its three lines and their line breaks — and nothing else: no other parameter, no fragment, no user name or password; no request is made
test("MOD-repository-hosts webLinks — GitHub's new-file page holds the path and the record, and nothing else (GitHub)", () => {
  const link = withoutRequests(() => connect(GITHUB).webLinks().newFile(RECORD_PATH, RECORD));
  assert.equal(typeof link, "string", "a page, not null");
  const page = new URL(link);
  assert.equal(page.origin + page.pathname, "https://github.com/alice/agent-m/new/main", "the new-file page of the default branch");
  assert.deepEqual([...page.searchParams.keys()].sort(), ["filename", "value"], "the path and the record, no other parameter");
  assert.equal(page.searchParams.get("filename"), RECORD_PATH, "the path");
  assert.equal(page.searchParams.get("value"), RECORD, "the record, its three lines");
  assert.deepEqual([page.hash, page.username, page.password], ["", "", ""], "no fragment, no user name, no password");
});

// TST-1302016 · level: unit · module: MOD-repository-hosts
// guards: WITHOUT A TOKEN, GITHUB'S WEB INTERFACE IS THE FALLBACK; A CREDENTIAL IS NEVER PLACED IN A URL
// given: the GitHub repository alice/agent-m, connected without a token; the repository default branch the server reports, once `master` and once `main`; the approval record of a module file, three lines, and a path with spaces
// input: webLinks().newFile(path, record) and webLinks().editFile(path)
// expect: the new-file page and editor page name the reported default branch — `master` or `main` — and no request is made
test("MOD-repository-hosts webLinks — GitHub's file pages name the repository default branch, with no request", () => {
  const path = "docs/use-cases/UC-001 the first.md";
  for (const branch of ["master", "main"]) {
    const [newFile, editFile] = withoutRequests(() => {
      const links = connect(GITHUB, { defaultBranch: branch }).webLinks();
      return [links.newFile(RECORD_PATH, RECORD), links.editFile(path)];
    });
    const page = new URL(newFile);
    assert.equal(page.origin + page.pathname, `https://github.com/alice/agent-m/new/${branch}`, `${branch}: new-file page`);
    assert.equal(page.searchParams.get("filename"), RECORD_PATH, `${branch}: new-file path`);
    assert.equal(page.searchParams.get("value"), RECORD, `${branch}: new-file record`);
    assert.equal(editFile, `https://github.com/alice/agent-m/edit/${branch}/docs/use-cases/UC-001%20the%20first.md`, `${branch}: editor page`);
  }
});

// ---------------------------------------------------------------- the editor page of a file

// TST-472539 · level: unit · module: MOD-repository-hosts
// guards: WITHOUT A TOKEN, GITHUB'S WEB INTERFACE IS THE FALLBACK; A CREDENTIAL IS NEVER PLACED IN A URL
// given: the path docs/use-cases/UC-001 the first.md, spaces in its file name; the GitHub repository alice/agent-m and the GitLab project grp/sub/thesis-tool on gitlab.example.org, connected without a token
// input: webLinks().editFile(path) on each
// expect: GitHub's editor of the default branch, https://github.com/alice/agent-m/edit/main/docs/use-cases/UC-001%20the%20first.md, and GitLab's single-file editor, https://gitlab.example.org/grp/sub/thesis-tool/-/edit/main/docs/use-cases/UC-001%20the%20first.md: the folders' slashes stay, each space is %20, and the address holds nothing else; no request is made
test("MOD-repository-hosts webLinks — the editor page of a path with spaces (GitHub, GitLab)", () => {
  const path = "docs/use-cases/UC-001 the first.md";
  const [github, gitlab] = withoutRequests(() => [connect(GITHUB).webLinks().editFile(path), connect(GITLAB).webLinks().editFile(path)]);
  assert.equal(github, "https://github.com/alice/agent-m/edit/main/docs/use-cases/UC-001%20the%20first.md", "GitHub");
  assert.equal(gitlab, "https://gitlab.example.org/grp/sub/thesis-tool/-/edit/main/docs/use-cases/UC-001%20the%20first.md", "GitLab");
});

// ---------------------------------------------------------------- no new-file page on GitLab

// TST-472540 · level: unit · module: MOD-repository-hosts
// guards: WITHOUT A TOKEN, GITHUB'S WEB INTERFACE IS THE FALLBACK; NO TEXT TRAVELS IN A URL
// given: the GitLab project grp/sub/thesis-tool, connected without a token; the same path and record as above
// input: webLinks().newFile(path, record) on the GitLab project, and, as the known positive, on the GitHub repository
// expect: null on GitLab — it has no page that could be prefilled with the record (UC-008 3c) — and a string, a page, on GitHub for the same path and record; no request is made
test("MOD-repository-hosts webLinks — a GitLab project has no new-file page (GitHub, GitLab)", () => {
  const [github, gitlab] = withoutRequests(() => [connect(GITHUB).webLinks().newFile(RECORD_PATH, RECORD),
    connect(GITLAB).webLinks().newFile(RECORD_PATH, RECORD)]);
  assert.equal(typeof github, "string", "known positive: GitHub offers the page for this path and record");
  assert.equal(gitlab, null, "GitLab offers none");
});

// ---------------------------------------------------------------- the page that deletes a file

// TST-2026271031 · level: unit · module: MOD-repository-hosts
// guards: WITHOUT A TOKEN, GITHUB'S WEB INTERFACE IS THE FALLBACK; A REJECTION REMOVES THE PROPOSAL
// given: the path docs/use-cases/UC-001 the first.md; the GitHub repository alice/agent-m and the GitLab project grp/sub/thesis-tool, connected without a token; known positive: GitHub's editor of the path is https://github.com/alice/agent-m/edit/main/… (TST-472539)
// input: webLinks().deleteFile(path) on each
// expect: GitHub's page that deletes the file from the default branch, https://github.com/alice/agent-m/delete/main/docs/use-cases/UC-001%20the%20first.md (it answers a person who is not signed in by sending them to sign in, as the editor does, read 2026-10-27); null on GitLab, which has no such page; no request is made
test("MOD-repository-hosts webLinks — the page that deletes a file (GitHub, GitLab)", () => {
  const path = "docs/use-cases/UC-001 the first.md";
  const [github, gitlab] = withoutRequests(() => [connect(GITHUB).webLinks().deleteFile(path), connect(GITLAB).webLinks().deleteFile(path)]);
  assert.equal(github, "https://github.com/alice/agent-m/delete/main/docs/use-cases/UC-001%20the%20first.md", "GitHub");
  assert.equal(gitlab, null, "GitLab");
});
