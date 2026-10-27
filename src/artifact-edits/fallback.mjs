// GitHub's pages for an edit without a token — WITHOUT A TOKEN, GITHUB'S WEB INTERFACE IS THE FALLBACK · NO TEXT TRAVELS IN A
// URL · A GITLAB PRODUCT IS WRITTEN WITH A TOKEN (UC-018 4a, 4b; UC-008 3b). Part of MOD-artifact-edits (docs/architecture/
// MOD-artifact-edits.md): one page of GitHub's web interface for each file, the editor for a file that exists, the new-file
// page for one that does not, and the page that deletes a file whose text is null (A REJECTION REMOVES THE PROPOSAL, UC-008 3f);
// each link carrying the path and nothing else, and the text returned beside it for the clipboard.
//
// Module: MOD-artifact-edits
//
// The pages are those of MOD-repository-hosts' webLinks: its editFile, newFile and deleteFile.

import { connect } from "../repository-hosts/index.mjs";

// fallbackEditLinks(files: Array<{ path: string, text: string | null, existing: boolean }>, snapshot: Snapshot) ->
// Array<{ url: string, path: string, text: string | null, differs: boolean }> | { refused: "gitlab" }
// — for a product on GitHub, one page per file, in the order of the files: for a text null, the page that deletes the file; else the
// editor of the file where it existed when the edit started, the new-file page where it did not; the link carrying the path only,
// never the text, which is returned as given. A product on a GitLab server is refused: it has no fallback. `differs` says that the default branch, as the snapshot
// holds it, no longer has the file as the edit started: the file is there where it did not exist, or not there where it did.
// The pages name the repository's default branch: the callers hand in the snapshot they read at `RepositoryInfo`'s `defaultBranch`, so its `ref` names it
// and is passed to `connect`; a `ref` that is a commit (forty hexadecimal digits) names no branch, and connect's own default, `main`, stands. No request is made.
const COMMIT = /^[0-9a-f]{40}$/;
export function fallbackEditLinks(files, snapshot) {
  const { repository } = snapshot;
  if (repository.server === "gitlab") return { refused: "gitlab" };
  const named = typeof snapshot.ref === "string" && snapshot.ref !== "" && !COMMIT.test(snapshot.ref) ? { defaultBranch: snapshot.ref } : {};
  const pages = connect(repository, named).webLinks();
  const held = new Set(snapshot.paths);
  return files.map(({ path, text, existing }) => ({
    url: text === null ? pages.deleteFile(path) : existing ? pages.editFile(path) : pages.newFile(path, ""),
    path,
    text,
    differs: held.has(path) !== existing,
  }));
}
