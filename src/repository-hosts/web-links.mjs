// The addresses of the servers' own pages for one repository — the pages UC-001 opens: the page for a new token, the list of
// the person's tokens, a GitLab project's Access tokens page, the page for a new repository; the pages of CI secrets, of the workflow runs or pipelines and of one run (UC-010); and the pages of the fallback
// without a token (UC-006 4a, 4b, UC-008 3b, 3f, UC-018 4a): GitHub's new-file page with a path and a record filled in, the editor
// page of a file, and the page that deletes a file. Navigation only; nothing here is requested, and no page carries a credential (A CREDENTIAL IS NEVER PLACED IN
// A URL).
//
// Module: MOD-repository-hosts
//
// A page the server does not offer is null.

// ONE GITHUB TOKEN SERVES EVERY FEATURE: the permissions of the one fine-grained token, as the parameters and access levels of
// GitHub's prefilled token page ("Pre-filling fine-grained personal access token details using URL parameters", table
// "Repository permissions": pull_requests read/write, workflows write only, secrets read/write, metadata read only; write always includes read).
const GITHUB_PERMISSIONS = Object.freeze([["contents", "write"], ["issues", "write"], ["pull_requests", "write"],
  ["actions", "write"], ["workflows", "write"], ["secrets", "write"], ["metadata", "read"]]);

const GITHUB_TOKENS = "https://github.com/settings/personal-access-tokens";

// The branch the pages of a file are for where no caller has handed on the repository's reported default branch.
const DEFAULT_BRANCH = "main";

// A path in an address: each folder and file name encoded, the slashes kept.
const encodedPath = (path) => path.split("/").map(encodeURIComponent).join("/");

// address: a RepositoryAddress -> WebLinks, with the pages this item needs.
export function webLinks(address, defaultBranch = DEFAULT_BRANCH) {
  if (typeof defaultBranch !== "string" || !defaultBranch.trim()) throw new TypeError(`a default branch is a text: ${defaultBranch}`);
  const branch = encodedPath(defaultBranch);
  if (address.server === "github") {
    return Object.freeze({
      // THE TOKEN LINK IS PREFILLED: name, description, expiry in days and the permissions. THE REPOSITORY CHOICE IS SPELLED OUT:
      // the repositories to select are named beside the link, never in it. The repository's owner owns the token (target_name):
      // "Each token is limited to access resources owned by a single user or organization" (GitHub, read 2026-10-06).
      newToken(name, description, days) {
        if (typeof name !== "string" || !name || typeof description !== "string") throw new TypeError("a token is given a name and a description");
        if (!Number.isInteger(days) || days < 1 || days > 366) throw new TypeError(`a token expires after 1 to 366 days: ${days}`);
        const fields = new URLSearchParams({ name, description, target_name: address.path.split("/")[0], expires_in: String(days),
          ...Object.fromEntries(GITHUB_PERMISSIONS) });
        return `${GITHUB_TOKENS}/new?${fields}`;
      },
      // The list of the person's fine-grained tokens: where a token is opened, extended to a repository, and regenerated.
      tokens: GITHUB_TOKENS,
      projectTokens: null,
      newRepository: "https://github.com/new",
      // WITHOUT A TOKEN, GITHUB'S WEB INTERFACE IS THE FALLBACK: the new-file page of the default branch with the file's path and an
      // approval record filled in, and nothing else — no reviewed text (NO TEXT TRAVELS IN A URL) and no credential travels in the
      // address.
      newFile: (path, record) => `${address.web}/new/${branch}?filename=${encodeURIComponent(path)}&value=${encodeURIComponent(record)}`,
      // The editor page of a file.
      editFile: (path) => `${address.web}/edit/${branch}/${encodedPath(path)}`,
      // The page that deletes a file from the default branch, where the person presses *Commit changes* (A REJECTION REMOVES THE PROPOSAL, UC-008 3f).
      deleteFile: (path) => `${address.web}/delete/${branch}/${encodedPath(path)}`,
      // The page that shows one file as it stands at a branch, a tag or a commit, to read it.
      file: (path, ref) => `${address.web}/blob/${encodedPath(ref)}/${encodedPath(path)}`,
      // UC-010: the repository's Settings > Secrets and variables > Actions, where the person stores a secret's value — the address names
      // no secret and carries no value (A CREDENTIAL IS NEVER PLACED IN A URL) —, its workflow runs, and one run.
      secrets: `${address.web}/settings/secrets/actions`,
      actions: `${address.web}/actions`,
      run: (id) => `${address.web}/actions/runs/${encodeURIComponent(id)}`,
      // ITM-889: the checks of one commit, a branch's files, and the page that shows the command to run on a self-hosted runner's machine.
      commitRuns: (commit) => `${address.web}/commit/${encodeURIComponent(commit)}/checks`,
      branch: (name) => `${address.web}/tree/${encodedPath(name)}`,
      runners: `${address.web}/settings/actions/runners/new`,
      // UC-014: the fork page of the repository, and its Settings > Pages. GitHub has no page of pipeline schedules.
      fork: `${address.web}/fork`,
      pagesSettings: `${address.web}/settings/pages`,
      pipelineSchedules: null,
    });
  }
  // A GITLAB PRODUCT USES A PROJECT ACCESS TOKEN: the project's Access tokens page, where the person creates the project access
  // token with role Maintainer and scope api, and rotates it; GitLab offers no page that could be prefilled for it.
  const projectTokens = `${address.web}/-/settings/access_tokens`;
  return Object.freeze({
    newToken: () => projectTokens,
    tokens: projectTokens,
    projectTokens,
    newRepository: `${address.origin}/projects/new`,
    // GitLab has no new-file page that takes a record (UC-008 3c): null. Its single-file editor, as GitLab links it itself.
    newFile: () => null,
    editFile: (path) => `${address.web}/-/edit/${branch}/${encodedPath(path)}`,
    // GitLab has no page of its own that deletes a file: null.
    deleteFile: () => null,
    // The page that shows one file as it stands at a branch, a tag or a commit, to read it.
    file: (path, ref) => `${address.web}/-/blob/${encodedPath(ref)}/${encodedPath(path)}`,
    // UC-010: the project's Settings > CI/CD, where its Variables are, its pipelines, and one pipeline.
    secrets: `${address.web}/-/settings/ci_cd`,
    actions: `${address.web}/-/pipelines`,
    run: (id) => `${address.web}/-/pipelines/${encodeURIComponent(id)}`,
    // ITM-889: the pipelines of one commit, a branch's files, and Settings > CI/CD, where a project runner is created.
    commitRuns: (commit) => `${address.web}/-/commit/${encodeURIComponent(commit)}/pipelines`,
    branch: (name) => `${address.web}/-/tree/${encodedPath(name)}`,
    runners: `${address.web}/-/settings/ci_cd`,
    // UC-014 and UC-027: the project's fork page, its Deploy > Pages, and its pipeline schedules.
    fork: `${address.web}/-/forks/new`,
    pagesSettings: `${address.web}/-/pages`,
    pipelineSchedules: `${address.web}/-/pipeline_schedules`,
  });
}
