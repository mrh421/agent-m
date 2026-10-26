// The repository hosts — one interface to a repository on GitHub or on a GitLab server: parseAddress, connect, and the host it
// returns, with repositoryInfo, readSnapshot, readHistory, listTags, issueCounts, commitFiles, createTag, listReleaseAssets, createBranch, startWorkflow, setCiSecret, setPipelineSchedule, ciVariableScopes, listCiRuns,
// cancelCiRun, ciRunLog, ciRunLabels and webLinks. Every function of a host that reaches a server says so and names how it fails, as a HostError (A REMOTE INTERFACE
// NAMES HOW IT FAILS).
//
// Module: MOD-repository-hosts
//
// The interface of the module (docs/architecture/MOD-repository-hosts.md, Interfaces); every other file of this folder is
// private to it. The adapters are plug-ins: github.mjs for GitHub's REST API, gitlab.mjs for GitLab's REST API v4. A local clone
// (local-git.mjs, Node only) serves a host connected with a clone: its snapshot, its files and its commits; a browser's connect
// refuses a clone with NotSupported.

import { HostError } from "./failures.mjs";
import { githubAdapter, BATCH } from "./github.mjs";
import { gitlabAdapter } from "./gitlab.mjs";
import { webLinks } from "./web-links.mjs";
import { localAdapter } from "./local-git.mjs";

export { HostError };

// ---------------------------------------------------------------- parseAddress

const GITHUB_REPOSITORY = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})\/[A-Za-z0-9._-]{1,100}$/;
const GITLAB_SEGMENT = /^[A-Za-z0-9_][A-Za-z0-9_.-]*$/;

// parseAddress(url) -> RepositoryAddress { server: "github" | "gitlab", origin, path, web } — A PRODUCT IS NAMED BY ITS ADDRESS:
// the web address of a repository as a person copies it from the browser — a page of the repository, a trailing slash or
// ".git" included. An address on github.com is a GitHub repository, by its owner and name; one on any other server is taken
// for a GitLab project (GITLAB PRODUCTS ARE SUPPORTED), whose path is every group up to GitLab's "/-/" — whether the server
// answers as GitLab shows the first request. Throws a TypeError naming what is not a repository's address. No request is made.
export function parseAddress(url) {
  const s = String(url ?? "").trim();
  let u;
  try { u = new URL(s); } catch { throw new TypeError("Paste the repository's address, e.g. https://github.com/owner/name."); }
  if (u.protocol !== "https:") throw new TypeError("The address must use https.");
  if (u.username || u.password) {
    throw new TypeError("The address must not contain a user name or token (A CREDENTIAL IS NEVER PLACED IN A URL).");
  }
  const parts = u.pathname.split("/").filter(Boolean);
  if (u.hostname === "github.com") {
    if (parts.length < 2) throw new TypeError("The address names an owner and a repository: https://github.com/owner/name.");
    const path = `${parts[0]}/${parts[1].replace(/\.git$/, "")}`;
    if (!GITHUB_REPOSITORY.test(path) || path.includes("..")) throw new TypeError(`not a repository: ${path}`);
    return { server: "github", origin: "https://github.com", path, web: `https://github.com/${path}` };
  }
  const dash = parts.indexOf("-");
  const groups = dash >= 0 ? parts.slice(0, dash) : parts;
  if (groups.length) groups[groups.length - 1] = groups[groups.length - 1].replace(/\.git$/, "");
  if (groups.length < 2) throw new TypeError(`The address names a group and a project on ${u.host}, like ${u.origin}/group/project.`);
  if (!groups.every((g) => GITLAB_SEGMENT.test(g) && !g.includes(".."))) {
    throw new TypeError(`not a GitLab project path: ${groups.join("/")}`);
  }
  const path = groups.join("/");
  return { server: "gitlab", origin: u.origin, path, web: `${u.origin}/${path}` };
}

// ---------------------------------------------------------------- connect

// Tokens of the other kind of server, by the prefixes their servers give them: a GitHub token never goes to a GitLab server,
// a GitLab token never to GitHub.
const GITHUB_TOKEN = /^(github_pat_|gh[pousr]_)/;
const GITLAB_TOKEN = /^gl[a-z]+-/;
const HEAD = /^[0-9a-f]{40}(?:[0-9a-f]{24})?$/;

// The address connect is given is one parseAddress reads, field for field: the server a token goes to is never taken from a
// field that disagrees with the repository's own address.
function checkedAddress(address) {
  let read = null;
  try { read = parseAddress(address?.web); } catch { /* refused below */ }
  if (!read || ["server", "origin", "path", "web"].some((k) => read[k] !== address[k])) {
    throw new TypeError("connect needs a repository's address, as parseAddress reads it");
  }
  return Object.freeze(read);
}

// A change as commitFiles takes it: a branch, the commit it is made on, at least one file — each a path in the repository,
// named once, written as text, as bytes, or deleted —, and a message.
function checkedChange(change) {
  const { branch, expectedHead, files, message } = change ?? {};
  if (typeof branch !== "string" || !branch.trim()) throw new TypeError("a change names its branch");
  // null: the repository's first commit — it has none yet (an empty repository).
  if (expectedHead !== null && !HEAD.test(String(expectedHead))) throw new TypeError(`a change names the commit it is made on: ${expectedHead}`);
  if (!Array.isArray(files) || !files.length) throw new TypeError("a change holds at least one file");
  if (typeof message !== "string" || !message.trim()) throw new TypeError("a change has a message");
  const paths = new Set();
  for (const f of files) {
    const p = f?.path;
    if (typeof p !== "string" || !p || p.startsWith("/") || p.split("/").some((s) => s === "" || s === "." || s === "..")) {
      throw new TypeError(`not a path in the repository: ${p}`);
    }
    if (paths.has(p)) throw new TypeError(`a change names ${p} twice`);
    paths.add(p);
    if ([typeof f.text === "string", f.bytes instanceof Uint8Array, f.delete === true].filter(Boolean).length !== 1) {
      throw new TypeError(`${p}: a file is written as text, written as bytes, or deleted — exactly one of them`);
    }
  }
  return { branch, expectedHead, files, message };
}

// A pattern listTags takes, with * as its only wildcard (zero or more characters, e.g. "v*") -> a RegExp matching exactly what
// it allows; every other character is literal.
const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const globPattern = (pattern) => new RegExp(`^${pattern.split("*").map(escapeRegExp).join(".*")}$`);

// NO SECRET IN THE REPOSITORY: before anything is sent, a file whose text — or whose bytes, read as text — holds a configured
// secret or the host's own token refuses the whole commit, named by its file and never by the value.
function refuseSecrets(files, secrets) {
  if (!secrets.length) return;
  const decoder = new TextDecoder("utf-8", { fatal: false });
  for (const f of files) {
    const t = typeof f.text === "string" ? f.text : f.bytes ? decoder.decode(f.bytes) : null;
    if (t !== null && secrets.some((s) => t.includes(s))) {
      throw new HostError("SecretRefused", { path: f.path }, `${f.path} holds a configured secret — nothing was written.`);
    }
  }
}

const PR_STATES = ["open", "merged", "closed", "all"];

// The commits of a pull request oldest first: a commit comes after its parents that are among them, and among those ready, the earlier date, then the server's order, comes first.
function oldestFirst(commits) {
  const left = commits.map((c, at) => ({ ...c, at })), shas = new Set(commits.map((c) => c.sha)), done = new Set(), out = [];
  while (left.length) {
    const ready = left.filter((c) => c.parents.every((p) => !shas.has(p) || done.has(p)));
    const next = (ready.length ? ready : left).reduce((a, b) => (String(b.date) < String(a.date) || (b.date === a.date && b.at > a.at) ? b : a));
    left.splice(left.indexOf(next), 1);
    done.add(next.sha);
    out.push(next);
  }
  return out;
}

// The failures readSnapshot itself knows and readMany passes on; any other failure of a batch request reads nothing ahead.
const KNOWN_FAILURES = new Set(["TokenRefused", "PermissionMissing", "RateLimited", "Unreachable"]);

// A clone is worked in by the git command, which only Node runs: connect refuses a clone elsewhere, and the adapter, which
// touches Node's modules only when it runs a command, is never used there.
const IN_NODE = typeof process !== "undefined" && Boolean(process.versions?.node);

// A list of non-empty texts; an issue's number is a positive whole number.
const isTexts = (list) => Array.isArray(list) && list.every((text) => typeof text === "string" && text.trim() !== "");
const issueNumber = (number) => {
  if (!Number.isInteger(number) || number < 1) throw new TypeError(`an issue is named by its number, a positive whole number, not ${number}`);
};

// The adapter of a host with a clone: the snapshot, the files and the commit through the clone; every
// other function through the REST adapter where a token is given (`rest`), else NotSupported.
function throughClone(repository, folder, rest) {
  const clone = localAdapter(repository, folder);
  const without = (what) => async () => {
    throw new HostError("NotSupported", { what }, `${what} needs the server's API, which a clone without a token does not reach; store a token first.`);
  };
  return {
    repositoryInfo: rest ? (...a) => rest.repositoryInfo(...a) : without("the repository's information"),
    history: rest ? (...a) => rest.history(...a) : (...a) => clone.history(...a),
    listTags: rest ? (...a) => rest.listTags(...a) : without("the tags"),
    issueCounts: rest ? (...a) => rest.issueCounts(...a) : without("the issue counts"),
    listIssues: rest ? (...a) => rest.listIssues(...a) : without("the issues"),
    commentOnIssue: rest ? (...a) => rest.commentOnIssue(...a) : without("a comment on an issue"),
    setIssueLabels: rest ? (...a) => rest.setIssueLabels(...a) : without("the labels of an issue"),
    setIssueState: rest ? (...a) => rest.setIssueState(...a) : without("the state of an issue"),
    createTag: rest ? (...a) => rest.createTag(...a) : without("a tag"),
    createIssue: rest ? (...a) => rest.createIssue(...a) : without("an issue"),
    releaseAssets: rest ? (...a) => rest.releaseAssets(...a) : without("a release's files"),
    publishRelease: rest ? (...a) => rest.publishRelease(...a) : without("publishing a release"),
    createBranch: rest ? (...a) => rest.createBranch(...a) : without("a branch"),
    startWorkflow: rest ? (...a) => rest.startWorkflow(...a) : without("starting a workflow"),
    setPipelineSchedule: rest ? (...a) => rest.setPipelineSchedule(...a) : without("a pipeline schedule"),
    ciVariableScopes: rest?.ciVariableScopes ? (...a) => rest.ciVariableScopes(...a) : without("the CI/CD variables"),
    listCiRuns: rest ? (...a) => rest.listCiRuns(...a) : without("the CI runs"),
    cancelCiRun: rest ? (...a) => rest.cancelCiRun(...a) : without("cancelling a CI run"),
    jobLogs: rest ? (...a) => rest.jobLogs(...a) : without("the log of a CI run"),
    jobLabels: rest ? (...a) => rest.jobLabels(...a) : without("the labels of a CI run"),
    listPullRequests: rest ? (...a) => rest.listPullRequests(...a) : without("the pull requests"),
    openPullRequest: rest ? (...a) => rest.openPullRequest(...a) : without("a pull request"),
    mergePullRequest: rest ? (...a) => rest.mergePullRequest(...a) : without("a merge"),
    pullRequestFacts: rest ? (...a) => rest.pullRequestFacts(...a) : without("the facts of a pull request"),
    containsCommit: (...a) => clone.containsCommit(...a),
    snapshot: (ref) => clone.snapshot(ref),
    readFile: (commit, path, options) => clone.readFile(commit, path, options),
    // Each commit read in the clone: a commit whose tree holds no such file is null.
    async readFileAt(path, commits) {
      const texts = new Map();
      for (const commit of commits) {
        const { commit: found, blobs } = await clone.snapshot(commit);
        texts.set(commit, blobs.has(path) ? await clone.readFile(found, path) : null);
      }
      return texts;
    },
    commitFiles: (change) => clone.commitFiles(change),
  };
}

// connect(address, credentials) -> Host — a host for one repository. credentials:
// { token, tokenName, clone, secrets, defaultBranch }: the token and the name the person stored it under; the values of every
// configured secret, which no commit may contain; and the default branch handed on from repositoryInfo for navigation pages. The
// token goes only into the authorisation header of requests to the API of the server that issued it, for this repository; a
// token of the other kind of server is refused with a TypeError. No request is made yet.
export function connect(address, credentials = {}) {
  const repository = checkedAddress(address);
  const { token = null, tokenName = null, clone = null, secrets = [], defaultBranch = address?.defaultBranch ?? "main" } = credentials ?? {};
  if (clone !== null && clone !== undefined) {
    if (typeof clone !== "string" || !clone.trim()) throw new TypeError("a clone is the folder of a local clone");
    if (!IN_NODE) {
      throw new HostError("NotSupported", { what: "working in a local clone" }, "A local clone is worked in by the git command, " +
        "which only Node runs; this host reads and writes through the server's API.");
    }
  }
  if (token !== null && token !== "" && typeof token !== "string") throw new TypeError("a token is a text");
  const github = repository.server === "github";
  if (token && (github ? GITLAB_TOKEN : GITHUB_TOKEN).test(token)) {
    throw new TypeError(github ? "That is a GitLab token; a GitHub repository is reached with the GitHub token."
      : "That is a GitHub token; a GitLab project is reached with its own project access token.");
  }
  if (token && !GITHUB_TOKEN.test(token) && !GITLAB_TOKEN.test(token)) throw new TypeError("That is no token of either server.");
  if (!Array.isArray(secrets) || secrets.some((s) => typeof s !== "string")) throw new TypeError("the secrets are a list of texts");
  const links = webLinks(repository, defaultBranch);
  const name = tokenName || (github ? "GitHub token" : `GitLab project token for ${repository.web}`);
  const rest = (github ? githubAdapter : gitlabAdapter)(repository, { token: token || null, tokenName: name }, links);
  const adapter = clone ? throughClone(repository, clone, token ? rest : null) : rest;
  // A write to the repository's tracker is made only with a token that may write: without one it is NotSupported, before any request.
  const withToken = (what) => {
    if (!token) throw new HostError("NotSupported", { what: `${what} without a token` }, `${what[0].toUpperCase()}${what.slice(1)} needs a token that may write to the repository; store one first.`);
  };
  const refused = [...secrets, ...(token ? [token] : [])].filter((s) => s.length > 0);
  // The texts of the blobs read through this host, by their blob SHA: each blob is read once.
  const texts = new Map();

  return Object.freeze({
    // repositoryInfo() -> RepositoryInfo { defaultBranch, visibility, canWrite, archived, description }. Crosses the network;
    // fails with NotFound, TokenRefused, PermissionMissing, RateLimited, Unreachable.
    repositoryInfo: () => adapter.repositoryInfo(),

    // readSnapshot(ref) -> Snapshot { repository, ref, commit, paths, read(path), readMany(paths), blob(path) } — the repository at one commit.
    // Crosses the network, and so does read(path); fail with NotFound, TokenRefused, PermissionMissing, RateLimited, Unreachable.
    async readSnapshot(ref) {
      if (typeof ref !== "string" || !ref.trim()) throw new TypeError("readSnapshot names a branch, a tag or a commit");
      const { commit, blobs } = await adapter.snapshot(ref);
      return Object.freeze({
        repository, ref, commit, paths: Object.freeze([...blobs.keys()]),
        blob: (path) => blobs.get(path) ?? null,
        // Fetches many files' texts ahead of their reads where the adapter has a batch request (GitHub, with a token); otherwise
        // nothing. A failure readSnapshot knows is passed on; any other failure of a batch leaves its files to their own reads.
        async readMany(paths) {
          if (!adapter.readFiles || commit === null) return;
          const wanted = new Map();
          for (const path of paths) {
            const sha = blobs.get(path);
            if (sha && !texts.has(sha) && !wanted.has(sha)) wanted.set(sha, path);
          }
          const list = [...wanted];
          for (let at = 0; at < list.length; at += BATCH) {
            const batch = list.slice(at, at + BATCH);
            let got;
            try { got = await adapter.readFiles(commit, batch.map(([, path]) => path)); } catch (e) {
              if (e instanceof HostError && KNOWN_FAILURES.has(e.name)) throw e;
              return;
            }
            for (const [sha, path] of batch) if (got.has(path) && !texts.has(sha)) texts.set(sha, Promise.resolve(got.get(path)));
          }
        },
        // readOn(branch, path) -> the text of a file on another branch of the same repository, in one request (the API's contents with a
        // token, the raw host without), or null when the branch or the file does not exist; with `{ bytes: true }` its bytes. Not kept: the branch moves on.
        async readOn(branch, path, options) {
          if (typeof branch !== "string" || !branch.trim() || typeof path !== "string" || !path) throw new TypeError("readOn names a branch and a path");
          try {
            return await adapter.readFile(branch, path, options);
          } catch (e) {
            if (clone && !(e instanceof HostError)) return null; // a clone holds no such branch or file
            throw e;
          }
        },
        read(path) {
          const sha = blobs.get(path);
          if (!sha) return Promise.resolve(null);
          if (!texts.has(sha)) {
            texts.set(sha, adapter.readFile(commit, path).catch((e) => { texts.delete(sha); throw e; }));
          }
          return texts.get(sha);
        },
      });
    },

    // readHistory(path, { ref, limit, changes }) -> HistoryEntry[] — the commits that changed a path, or, for a null path, the repository,
    // newest first, from the branch, tag or commit `ref` (the default branch where none is given), at most `limit` of them (all
    // where none is given). Each is { commit, parents, author: { account, name }, date, message, changes }: the account the
    // server names for the author, or null; the date the commit was committed; every file it changed, as added, modified,
    // deleted or renamed — with the path it came from — or, with `changes: false`, none. Crosses the network; fails as readSnapshot.
    readHistory: (path, options) => adapter.history(path ?? null, options ?? {}),

    // readFileAt(path, commits) -> Map(commit -> text | null) — the text of one file at each of several commits, in the order given, null where a commit does not hold it, a commit named twice read once. It reads in
    // batches, not one snapshot for each commit: with a token on GitHub, one request for each hundred commits through the GraphQL API, as readMany reads; without a token, one raw read for each commit, outside the
    // API; on a GitLab server one request for each commit; in a clone, in the clone. Crosses the network; fails as readSnapshot. A path that is empty or a commit that is no commit identifier is a TypeError.
    async readFileAt(path, commits) {
      if (typeof path !== "string" || !path.trim()) throw new TypeError("readFileAt names the file to read");
      if (!Array.isArray(commits) || commits.some((commit) => !HEAD.test(String(commit)))) throw new TypeError("readFileAt names the commits to read the file at, as commit identifiers");
      return adapter.readFileAt(path, [...new Set(commits)]);
    },

    // listTags(pattern) -> { name, commit }[] — the tags of the repository, every one of them across however many pages the
    // server answers in, optionally only those whose name matches pattern, a glob with * as its only wildcard (e.g. "v*").
    // Crosses the network; fails as readSnapshot.
    async listTags(pattern) {
      if (pattern !== undefined && typeof pattern !== "string") throw new TypeError("a pattern is a text");
      const tags = await adapter.listTags();
      return pattern === undefined ? tags : tags.filter((t) => globPattern(pattern).test(t.name));
    },

    // listReleaseAssets(tag) -> Release — a release, the latest or the one of a tag, and its files: name, size, download address and the SHA-256 the server reports for each, null where it reports none (the
    // caller then links the release's checksum file). Crosses the network; fails with NotFound when the release does not exist, TokenRefused, RateLimited, Unreachable, and NotSupported through a
    // clone without a token.
    async listReleaseAssets(tag) {
      if (typeof tag !== "string" || !tag.trim()) throw new TypeError("a release is named by its tag, or by latest");
      return adapter.releaseAssets(tag);
    },

    // publishRelease(tag, { name, notes, files }) -> Release — on GitHub, the release of a tag that stands, created as a draft, each file uploaded to it, then published, so that no release is seen with only
    // part of its files; the Release carries each file's address and the SHA-256 the server reports. An existing release of the tag is never replaced (A VERSION IS NOT REWRITTEN). On a GitLab server and through a
    // clone without a token it fails with NotSupported, before any request. Crosses the network; fails with NotFound (the tag does not stand), ReleaseExists { tag }, UploadFailed { file } — the draft is then left
    // unpublished and nothing is published —, PermissionMissing, TokenRefused, RateLimited, Unreachable.
    async publishRelease(tag, release) {
      if (typeof tag !== "string" || !tag.trim()) throw new TypeError("publishRelease names the tag to release");
      const { name, notes, files } = release ?? {};
      if (typeof name !== "string" || typeof notes !== "string" || !Array.isArray(files)) throw new TypeError("a release is { name, notes, files }");
      for (const file of files) {
        if (typeof file?.name !== "string" || !file.name.trim() || !(file.bytes instanceof Uint8Array) || typeof file.contentType !== "string") {
          throw new TypeError("a release's file is { name, bytes: Uint8Array, contentType }");
        }
      }
      return adapter.publishRelease(tag, { name, notes, files });
    },

    // issueCounts() -> { open, closed } — the numbers of open and closed issues of the repository, pull requests not counted,
    // no issue listed: on GitHub through its search, on a GitLab server through the project's issue statistics, without a token
    // where the repository is public. Crosses the network; fails with RateLimited — on GitHub with the limit `search` —,
    // NotFound, TokenRefused, Unreachable.
    issueCounts: () => adapter.issueCounts(),

    // listIssues(filter) -> Issue[] — the issues of the repository, each with its comments: those of a state (open unless the filter says closed or all), carrying every label of `labels`, and, with `search`, found
    // by the server's own search; pull requests are no issues. Every page is read. Crosses the network; fails as readSnapshot, and with NotSupported through a clone without a token. A filter that is not
    // { state?: "open" | "closed" | "all", labels?: texts, search?: text } is a TypeError.
    async listIssues(filter = {}) {
      const { state = "open", labels = [], search } = filter ?? {};
      if (!["open", "closed", "all"].includes(state)) throw new TypeError(`listIssues lists open, closed or all issues, not ${state}`);
      if (!isTexts(labels)) throw new TypeError("listIssues gives the labels as a list of texts");
      if (search !== undefined && (typeof search !== "string" || !search.trim())) throw new TypeError("listIssues gives the search as a text");
      return adapter.listIssues({ state, labels: [...labels], search });
    },

    // commentOnIssue(number, body) -> void — a comment on an issue, with the person's token. Crosses the network; fails with TokenRefused, PermissionMissing, RateLimited, Unreachable, and NotSupported without
    // a token, before any request. A number that is no positive whole number, or a body that is empty, is a TypeError.
    async commentOnIssue(number, body) {
      issueNumber(number);
      if (typeof body !== "string" || !body.trim()) throw new TypeError("commentOnIssue gives the comment as a text");
      withToken("commenting on an issue");
      return adapter.commentOnIssue(number, body);
    },

    // setIssueLabels(number, { add?, remove? }) -> void — labels put on an issue and taken off it; a label the issue does not carry is not a failure. Fails as commentOnIssue. A change that names neither list of texts is a TypeError.
    async setIssueLabels(number, change) {
      issueNumber(number);
      const { add, remove } = change ?? {};
      if ((add === undefined && remove === undefined) || !isTexts(add ?? []) || !isTexts(remove ?? [])) throw new TypeError("setIssueLabels gives the labels to add and to remove as lists of texts");
      withToken("labelling an issue");
      return adapter.setIssueLabels(number, { add: [...(add ?? [])], remove: [...(remove ?? [])] });
    },

    // setIssueState(number, state) -> void — an issue closed or opened again. Fails as commentOnIssue. A state other than open or closed is a TypeError.
    async setIssueState(number, state) {
      issueNumber(number);
      if (state !== "open" && state !== "closed") throw new TypeError(`setIssueState sets open or closed, not ${state}`);
      withToken("closing or opening an issue");
      return adapter.setIssueState(number, state);
    },

    // commitFiles({ branch, expectedHead, files, message }) -> { commit, url } — one commit of all the files, made only if the
    // branch still stands at expectedHead; expectedHead null makes an empty repository's first commit — on GitHub two, the first
    // file and then the others —; the message is written as given. Crosses the network; fails with Moved,
    // SecretRefused, TokenRefused, PermissionMissing, RateLimited, Unreachable. Nothing is written on any failure.
    async commitFiles(change) {
      const c = checkedChange(change);
      refuseSecrets(c.files, refused);
      return adapter.commitFiles(c);
    },

    // createTag(name, commit) -> void — sets a tag on a commit; an existing tag is never moved and fails with TagExists
    // { commit }, naming the commit it already stands on (A VERSION IS NOT REWRITTEN). Crosses the network; fails also with
    // PermissionMissing, TokenRefused, RateLimited, Unreachable.
    async createTag(name, commit) {
      if (typeof name !== "string" || !name.trim()) throw new TypeError("createTag names a tag");
      if (!HEAD.test(String(commit))) throw new TypeError(`createTag names the commit to tag: ${commit}`);
      return adapter.createTag(name, commit);
    },

    // createIssue({ title, body, labels }) -> Issue — a new issue in the repository's tracker, with the person's token, with its title, body and labels. Crosses the network; fails with TokenRefused,
    // PermissionMissing, RateLimited, Unreachable, and NotSupported without a token, before any request. An issue that is not { title: text, body: text, labels: texts } is a TypeError.
    async createIssue(issue) {
      if (typeof issue?.title !== "string" || !issue.title.trim()) throw new TypeError("createIssue names the issue's title");
      if (typeof issue.body !== "string") throw new TypeError("createIssue gives the issue's body as a text");
      if (!Array.isArray(issue.labels) || issue.labels.some((label) => typeof label !== "string" || !label.trim())) throw new TypeError("createIssue gives the issue's labels as a list of texts");
      if (!token) {
        throw new HostError("NotSupported", { what: "creating an issue without a token" }, "An issue is created only with a token that may write to the repository; store one first.");
      }
      return adapter.createIssue({ title: issue.title, body: issue.body, labels: [...issue.labels] });
    },

    // createBranch(name, from) -> void — a branch at a commit; one that stands already is left where it stands, never moved.
    // Crosses the network; fails with TokenRefused, PermissionMissing, RateLimited, Unreachable, and NotSupported without a
    // token, before any request.
    async createBranch(name, from) {
      if (typeof name !== "string" || !name.trim()) throw new TypeError("createBranch names a branch");
      if (!HEAD.test(String(from))) throw new TypeError(`createBranch names the commit the branch stands at: ${from}`);
      if (!token) {
        throw new HostError("NotSupported", { what: "creating a branch without a token" },
          "A branch is created only with a token that may write to the repository; store one first.");
      }
      return adapter.createBranch(name, from);
    },

    // startWorkflow(workflow, ref, inputs) -> CiRun | null — starts a workflow or a pipeline with its inputs, which hold no credential: an input that holds
    // the token or a configured secret is SecretRefused before any request. The run where the server names it at once, else null, for listCiRuns. Crosses
    // the network; fails with TokenRefused, PermissionMissing, RateLimited, Unreachable, and NotSupported without a token, before any request, and for
    // a workflow that cannot be started.
    async startWorkflow(workflow, ref, inputs) {
      if (typeof workflow !== "string" || !workflow.trim()) throw new TypeError("startWorkflow names a workflow");
      if (typeof ref !== "string" || !ref.trim()) throw new TypeError("startWorkflow names the ref to start it on");
      if (!inputs || typeof inputs !== "object" || Array.isArray(inputs) || Object.values(inputs).some((v) => typeof v !== "string")) {
        throw new TypeError("the inputs of a workflow are texts, by name");
      }
      if (!token) {
        throw new HostError("NotSupported", { what: "starting a workflow without a token" }, "A workflow is started only with a token that may do so; store one first.");
      }
      for (const [key, value] of Object.entries(inputs)) {
        if (refused.some((s) => value.includes(s))) {
          throw new HostError("SecretRefused", { path: `inputs.${key}` }, `inputs.${key} holds a configured secret — nothing was started.`);
        }
      }
      return adapter.startWorkflow(workflow, ref, inputs);
    },

    // setCiSecret(name, value) -> void — on GitHub, stores `value` as the Actions secret `name` of this repository, sealed to the repository's
    // public key, the value only in the body of the one request that stores it, never in an address (A TOKEN GOES ONLY TO THE SERVER THAT ISSUED IT).
    // A person's click starts it: it is what the person stores, not what Agent M keeps (CONFIGURATION LIVES IN THE BROWSER). On a GitLab server and without
    // a token it fails with NotSupported, before any request. Crosses the network; fails with PermissionMissing { permission: "Secrets" } for a token that may
    // not write the repository's secrets, TokenRefused, RateLimited, Unreachable. A name that is no plain name, or begins with GITHUB_, is a TypeError.
    async setCiSecret(name, value) {
      if (!github) throw new HostError("NotSupported", { what: "storing a CI secret on a GitLab server" }, "A CI variable of a GitLab project is set on the project's own page.");
      if (!token || !rest.setCiSecret) throw new HostError("NotSupported", { what: "storing a CI secret without a token" }, "A CI secret is stored only with a token that may write the repository's secrets; store one first.");
      return rest.setCiSecret(name, value);
    },

    // setPipelineSchedule(schedule) -> { id, url } — on a GitLab server, creates the project's pipeline schedule with this description or updates the one that has it, so that saving again
    // never adds a second; its variables hold no credential: one that holds the token or a configured secret is SecretRefused before any request. On GitHub NotSupported (a workflow's
    // schedule is part of its file), and without a token before any request. Crosses the network; fails with TokenRefused, PermissionMissing, RateLimited, Unreachable.
    async setPipelineSchedule(schedule) {
      const { description, cron, timezone, ref, active, variables = {} } = schedule ?? {};
      const text = (v) => typeof v === "string" && v.trim() !== "";
      if (!text(description) || !text(cron) || !text(timezone) || !text(ref) || typeof active !== "boolean") {
        throw new TypeError("setPipelineSchedule names a schedule by its description, cron, timezone and ref, and whether it is active");
      }
      if (!variables || typeof variables !== "object" || Array.isArray(variables) || Object.values(variables).some((v) => typeof v !== "string")) {
        throw new TypeError("the variables of a schedule are texts, by name");
      }
      if (github) {
        throw new HostError("NotSupported", { what: "a pipeline schedule on GitHub" }, "A workflow's schedule is part of the workflow's file, not a setting of the server.");
      }
      if (!token) {
        throw new HostError("NotSupported", { what: "a pipeline schedule without a token" }, "A pipeline schedule is set only with a token that may do so; store one first.");
      }
      for (const [key, value] of Object.entries(variables)) {
        if (refused.some((s) => value.includes(s))) {
          throw new HostError("SecretRefused", { path: `variables.${key}` }, `variables.${key} holds a configured secret — nothing was set.`);
        }
      }
      return adapter.setPipelineSchedule(schedule);
    },

    // ciVariableScopes() -> { name, scope }[] — on a GitLab server, each CI/CD variable of the project by its name and environment scope, never its value. On GitHub
    // NotSupported (an Actions secret has no environment scope), and without a token before any request. Crosses the network; fails with PermissionMissing — a token
    // without the role Maintainer —, TokenRefused, RateLimited, Unreachable.
    async ciVariableScopes() {
      if (github) throw new HostError("NotSupported", { what: "CI/CD variable scopes on GitHub" }, "An Actions secret of a GitHub repository has no environment scope.");
      if (!token) throw new HostError("NotSupported", { what: "the CI/CD variables without a token" }, "The CI/CD variables are listed only with a token of the role Maintainer; store one first.");
      return adapter.ciVariableScopes();
    },

    // listPullRequests(filter) -> PullRequest[] — the pull requests of GitHub or the merge requests of GitLab, every page, optionally only those of a state (open, merged, closed, all — the
    // default) or of a source branch. Crosses the network; fails as readSnapshot — a failure is never an empty list. Through a clone, the server's answer where a token is given, else NotSupported.
    async listPullRequests(filter = {}) {
      const { state = "all", branch } = filter ?? {};
      if (!PR_STATES.includes(state)) throw new TypeError(`a pull request's state is one of ${PR_STATES.join(", ")}: ${String(state)}`);
      if (branch !== undefined && (typeof branch !== "string" || !branch.trim())) throw new TypeError("a branch is a name");
      return adapter.listPullRequests({ state, branch });
    },

    // containsCommit(branch, commit) -> boolean — whether the branch's history holds the commit: through the server's comparison of the two, in a clone with
    // the git command's merge-base --is-ancestor. A commit the server does not know is not contained. Crosses the network; fails as readSnapshot.
    async containsCommit(branch, commit) {
      if (typeof branch !== "string" || !branch.trim()) throw new TypeError("a branch is a name");
      if (typeof commit !== "string" || !commit.trim()) throw new TypeError("a commit is an identifier");
      return adapter.containsCommit(branch, commit);
    },

    // pullRequestFacts(number) -> PullRequestFacts — the pull request, its commits oldest first (by their parents, then their dates: neither server's page states an order) with the paths each changed
    // and its ci, the files of the request, the reviews, the checks of the head commit, and read(path, side) for the text of a path at the request's "base" or "head" commit: by that commit, null
    // where it does not hold the path, each text read once. Crosses the network; fails as readSnapshot, whole.
    async pullRequestFacts(number) {
      if (!Number.isSafeInteger(number) || number < 1) throw new TypeError(`a pull request is named by its number: ${String(number)}`);
      const { pullRequest, baseCommit, headCommit, commits, files, reviews, checks, readFile } = await adapter.pullRequestFacts(number);
      return Object.freeze({
        pullRequest, files, reviews, checks, commits: oldestFirst(commits).map(({ sha, message, files: changed, ci }) => ({ sha, message, files: changed, ci })),
        async read(path, side) {
          if (side !== "base" && side !== "head") throw new TypeError(`a side is "base" or "head": ${String(side)}`);
          const commit = side === "base" ? baseCommit : headCommit;
          if (!commit) throw new HostError("NotFound", { what: `the ${side} commit of pull request #${number}` }, `The server names no ${side} commit for pull request #${number}.`);
          const key = `${commit}:${path}`;
          if (!texts.has(key)) texts.set(key, readFile(commit, path).catch((e) => { texts.delete(key); throw e; }));
          return texts.get(key);
        },
      });
    },

    // openPullRequest({ branch, base, title, body, draft }) -> PullRequest — a pull request on GitHub, a merge request on GitLab, as the server answers it. Crosses the network; fails with TokenRefused,
    // PermissionMissing, RateLimited, Unreachable, and NotSupported without a token, before any request. Through a clone, the server's call where a token is given, else NotSupported.
    async openPullRequest(request) {
      const { branch, base, title, body, draft } = request ?? {};
      for (const [key, value] of Object.entries({ branch, base, title })) {
        if (typeof value !== "string" || !value.trim()) throw new TypeError(`openPullRequest names its ${key}`);
      }
      if (typeof body !== "string") throw new TypeError("a pull request's body is a text");
      if (draft !== undefined && typeof draft !== "boolean") throw new TypeError("draft is true or false");
      if (!token) {
        throw new HostError("NotSupported", { what: clone ? "a pull request through a local clone without a token" : "opening a pull request without a token" },
          "A pull request is opened on the server, with a token that may write to the repository; store one first.");
      }
      return adapter.openPullRequest({ branch, base, title, body, draft });
    },

    // mergePullRequest(number, expectedHead) -> { commit } — merges the pull request only while its head is still expectedHead, and the server allows it (its branch protection stays in force). Crosses the
    // network; fails with Moved, TokenRefused, PermissionMissing, RateLimited, Unreachable, NotMergeable { reason }, and NotSupported without a token, before any request. Through a clone, the server's call where a token is given.
    async mergePullRequest(number, expectedHead) {
      if (!Number.isSafeInteger(number) || number < 1) throw new TypeError(`a pull request is named by its number: ${String(number)}`);
      if (typeof expectedHead !== "string" || !expectedHead.trim()) throw new TypeError("mergePullRequest names the head it expects");
      if (!token) {
        throw new HostError("NotSupported", { what: clone ? "a merge through a local clone without a token" : "a merge without a token" },
          "A pull request is merged on the server, with a token that may write to the repository; store one first.");
      }
      return adapter.mergePullRequest(number, expectedHead);
    },

    // listCiRuns({ commit, branch, workflow }) -> CiRun[] — the GitHub Actions runs or GitLab pipelines, every page, optionally only those of a commit, of a branch, and — on GitHub — of a workflow. Crosses the
    // network; fails as readSnapshot — a failure is never an empty list. Through a clone, the server's answer where a token is given, else NotSupported.
    async listCiRuns(filter = {}) {
      if (typeof filter !== "object" || filter === null || Array.isArray(filter)) throw new TypeError("a filter of CI runs is an object");
      const { workflow, branch, commit } = filter;
      for (const [key, value] of Object.entries({ workflow, branch, commit })) {
        if (value !== undefined && (typeof value !== "string" || !value.trim())) throw new TypeError(`the ${key} of a filter of CI runs is a name`);
      }
      return adapter.listCiRuns({ workflow, branch, commit });
    },

    // cancelCiRun(id) -> void — asks the server to cancel a run; one that has ended already is no failure, and its state shows that it has. Crosses the network; fails with TokenRefused, PermissionMissing,
    // RateLimited, Unreachable. Through a clone, the server's call where a token is given, else NotSupported.
    async cancelCiRun(id) {
      if (typeof id !== "string" || !id.trim()) throw new TypeError("a CI run is named by its identifier");
      return adapter.cancelCiRun(id);
    },

    // ciRunLog(id) -> string | null — the texts of the run's jobs in the order the server lists them, each preceded by a line with the job's name and ending in a line break; null where the server keeps the log
    // of none of them. Crosses the network; fails as readSnapshot — a run the server does not know is NotFound. Through a clone, the server's answer where a token is given, else NotSupported.
    async ciRunLog(id) {
      if (typeof id !== "string" || !id.trim()) throw new TypeError("a CI run is named by its identifier");
      const logs = await adapter.jobLogs(id);
      return logs.length ? logs.map(({ name, text }) => `${name}\n${text === "" || text.endsWith("\n") ? text : `${text}\n`}`).join("") : null;
    },

    // ciRunLabels(id) -> string[] — the runner labels the jobs of the run ask for: on GitHub the `labels` of each job of the workflow run, on GitLab the tags of each job of the pipeline; each once, [] for a run whose
    // jobs ask for none. Crosses the network; fails as readSnapshot — a run the server does not know is NotFound. Through a clone, the server's answer where a token is given, else NotSupported.
    async ciRunLabels(id) {
      if (typeof id !== "string" || !id.trim()) throw new TypeError("a CI run is named by its identifier");
      return adapter.jobLabels(id);
    },

    // webLinks() -> WebLinks — the server's own pages for this repository. No request is made.
    webLinks: () => links,
  });
}
