// The adapter for GitLab's REST API v4: one project on the GitLab server its address names, read and written with its project
// access token, sent only to that project's API on that server (A TOKEN GOES ONLY TO THE SERVER THAT ISSUED IT); a public
// project is read without one.
//
// Module: MOD-repository-hosts
//
// Private to the module: index.mjs builds the host from what this returns — repositoryInfo(), snapshot(ref),
// readFile(commit, path), history(path, { ref, limit, changes }), listTags(), issueCounts(), listIssues(filter), readIssue(number), commitFiles(change), createTag(name, commit),
// createBranch(name, from), startWorkflow(workflow, ref, inputs), setPipelineSchedule(schedule), listCiRuns(filter), cancelCiRun(id), jobLogs(id), jobLabels(id), listPullRequests(filter), openPullRequest(request), pullRequestFacts(number) — and adds what both adapters share.

import { HostError, send, json, refusal } from "./failures.mjs";

const PAGE = 100, MAX_PAGES = 1000;
// The GraphQL query of a project's CI/CD variables (GraphQL reference: Query.project(fullPath: ID!), Project.ciVariables — a connection with the standard
// pagination arguments —, CiProjectVariable.key and .environmentScope, PageInfo.hasNextPage and .endCursor): the key and the scope of each, never the value.
const VARIABLE_SCOPES = "query($path: ID!, $after: String) { project(fullPath: $path) { ciVariables(first: 100, after: $after) "
  + "{ nodes { key environmentScope } pageInfo { hasNextPage endCursor } } } }";
// GitLab's role Maintainer: the access level that may push to a protected default branch (A GITLAB PRODUCT USES A PROJECT
// ACCESS TOKEN); GitLab's default branch protection lets no Developer push.
const MAINTAINER = 40;

// A pipeline's status as the run's state ("Create a new pipeline" answers the pipeline: its status, among GitLab's others).
const STATES = { created: "queued", waiting_for_resource: "queued", preparing: "queued", pending: "queued", scheduled: "queued", running: "running",
  manual: "waiting", success: "success", failed: "failure", canceled: "cancelled", canceling: "cancelled", skipped: "skipped" };

// A pipeline as the run: its sha the commit, its source — "api" where it names none — the event, its status the state, its web_url the address; `workflow` the workflow the caller names.
const ciRunOf = (p, workflow) => ({ id: String(p.id), workflow, commit: p.sha, event: p.source ?? "api", state: STATES[p.status] ?? "queued", url: p.web_url,
  started: p.started_at ?? null, ended: p.finished_at ?? null });

// A job's state ("List all jobs by pipeline": created, pending, preparing, waiting_for_resource, waiting_for_callback, scheduled, manual, running, success, failed, canceled, canceling,
// skipped) and a commit's ci from its newest pipeline's status (those of "List project pipelines"): a pipeline that failed or was cancelled failed, a skipped one says nothing.
const JOB_STATES = { running: "running", success: "success", failed: "failure", canceled: "cancelled", canceling: "cancelled", skipped: "skipped" };
const jobState = (status) => JOB_STATES[status] ?? "queued";
const PIPELINE_CI = { success: "success", failed: "failure", canceled: "failure", canceling: "failure", skipped: "none" };
// A merge request ("List project merge requests"): locked, one being merged, is still open.
const MR_STATES = { opened: "open", locked: "open", merged: "merged", closed: "closed" };
// mergeCommit: the merge commit, else the squash commit, else — a fast-forward — the head, which has landed on the target; null while the merge request is not merged.
const pullOf = (m) => ({ number: m.iid, title: m.title, branch: m.source_branch, base: m.target_branch, head: m.sha,
  mergeCommit: m.state === "merged" ? m.merge_commit_sha ?? m.squash_commit_sha ?? m.sha : null, state: MR_STATES[m.state] ?? "closed", draft: m.draft === true,
  url: m.web_url, opened: m.created_at, merged: m.merged_at ?? null, closed: m.closed_at ?? null, body: m.description ?? "" });

// An issue of "New issue" / "List project issues" as the Issue: iid its number, description its body, state opened is open, labels the names.
const issueOf = (i, comments = []) => ({ number: i.iid, title: i.title, body: i.description ?? "", labels: i.labels ?? [], state: i.state === "closed" ? "closed" : "open", url: i.web_url,
  opened: i.created_at, closed: i.state === "closed" ? i.closed_at ?? null : null, comments });

// An entry of the diff of a commit as the change the commit made to the file: added, deleted, renamed — with the path it came
// from — or modified.
const changeOf = (d) => (d.new_file ? { path: d.new_path, change: "added" }
  : d.deleted_file ? { path: d.old_path, change: "deleted" }
    : d.renamed_file ? { path: d.new_path, change: "renamed", from: d.old_path } : { path: d.new_path, change: "modified" });

function base64(bytes) {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

// address: a RepositoryAddress on a GitLab server; token: the project's access token, or none; tokenName: the name it was
// stored under; links: the host's WebLinks, whose Access tokens page is where the token is renewed.
export function gitlabAdapter(address, { token, tokenName }, links) {
  const host = new URL(address.origin).host;
  const api = `${address.origin}/api/v4/projects/${encodeURIComponent(address.path)}`;
  // The server's GraphQL API, which ciVariableScopes alone calls: it answers only the fields a query names.
  const graphql = `${address.origin}/api/graphql`;
  const gate = { allowed: [api, graphql], tokenAt: api, header: "PRIVATE-TOKEN", value: token || null, token };
  const context = { server: "gitlab", host, web: address.web, authenticated: Boolean(token), tokenName,
    renewal: links.projectTokens, permission: "the role Maintainer with the scope api", what: address.web };

  // One request to the project's API -> its answer when the server served it; `on` as in github.mjs.
  async function call(method, url, { body, on = {}, ...more } = {}) {
    const answer = await send(url, { method, headers: body ? { "Content-Type": "application/json" } : {},
      body: body === undefined ? undefined : JSON.stringify(body) }, gate);
    if (answer.ok) return answer;
    if (on[answer.status]) return on[answer.status](answer);
    throw await refusal(answer, { ...context, write: method !== "GET", ...more });
  }
  const notMergeable = async (answer) => {
    const said = await answer.json().catch(() => null);
    const reason = said?.message ?? `${answer.status} ${answer.statusText}`.trim();
    throw new HostError("NotMergeable", { reason }, `${host} refuses the merge: ${reason}`);
  };
  const read = async (url, options) => {
    const answer = await call("GET", url, options);
    return answer instanceof Response ? json(answer, address.origin) : answer;
  };

  // The commit the branch stands at now, or null when there is no such branch.
  const branchHead = async (branch) =>
    (await read(`${api}/repository/branches/${encodeURIComponent(branch)}`, { on: { 404: () => null } }))?.commit?.id ?? null;
  const moved = (branch, head) => new HostError("Moved", { head },
    `${branch} has moved on${head ? ` to ${head.slice(0, 12)}` : ""} since it was read — nothing was written; read it again.`);

  // "Get a single repository tag", read after a refused creation, to name the commit the tag already stands on.
  const tagExists = async (name) => {
    const r = await read(`${api}/repository/tags/${encodeURIComponent(name)}`, { on: { 404: () => null } });
    const commit = r?.commit?.id ?? null;
    return new HostError("TagExists", { commit },
      `${name} exists already, on ${commit ? commit.slice(0, 12) : "a commit this page could not read"} — a release is never ` +
      "re-tagged (A VERSION IS NOT REWRITTEN).");
  };

  // The files a commit changed (the diff of a commit, up to 100 to a page, read page by page).
  const commitChanges = async (sha) => {
    const changes = [];
    for (let page = 1; page <= MAX_PAGES; page++) {
      const diffs = await read(`${api}/repository/commits/${sha}/diff?per_page=${PAGE}&page=${page}`, { what: `${address.web} at ${sha}` });
      changes.push(...diffs.map(changeOf));
      if (diffs.length < PAGE) break;
    }
    return changes;
  };
  // Every item of a list the server pages (100 to a page), read page by page; a page that brings nothing new ends the list, for an endpoint that takes no page.
  const everyPage = async (url, options = {}, key = (item) => JSON.stringify(item)) => {
    const out = [], known = new Set();
    for (let page = 1; page <= MAX_PAGES; page++) {
      const got = (await read(`${url}${url.includes("?") ? "&" : "?"}per_page=${PAGE}&page=${page}`, options)).filter((item) => !known.has(key(item)));
      for (const item of got) known.add(key(item));
      out.push(...got);
      if (got.length < PAGE) break;
    }
    return out;
  };
  // Every item of a list the server pages, its pages asked for at once: page 1 first, then, once its X-Total-Pages header says how many there are ("Pagination", docs.gitlab.com/api/rest/),
  // every other page together, the items in the order of the pages, each once. A server that leaves the header out — GitLab does for more than 10,000 — is read on page after page, as
  // everyPage reads.
  const allPages = async (url, options = {}, key = (item) => JSON.stringify(item)) => {
    const at = (page) => `${url}${url.includes("?") ? "&" : "?"}per_page=${PAGE}&page=${page}`;
    const first = await call("GET", at(1), options);
    const items = await json(first, address.origin);
    const total = Number(first.headers.get("x-total-pages") ?? 0);
    const known = new Set();
    const once = (list) => list.filter((item) => !known.has(key(item)) && known.add(key(item)));
    if (total > 1) {
      const rest = await Promise.all(Array.from({ length: Math.min(total, MAX_PAGES) - 1 }, (_, i) => read(at(i + 2), options)));
      return once([...items, ...rest.flat()]);
    }
    const out = once(items);
    for (let page = 2, got = items; total !== 1 && got.length >= PAGE && page <= MAX_PAGES; page++) {
      got = once(await read(at(page), options));
      out.push(...got);
    }
    return out;
  };
  // The comments of an issue ("List project issue notes", 100 to a page, page by page; the system notes, which GitLab writes for its own changes, are not comments), none asked for where its count of notes is 0.
  const commentsOf = async (i) => {
    const comments = [];
    for (let page = 1; i.user_notes_count !== 0 && page <= MAX_PAGES; page++) {
      const items = await read(`${api}/issues/${i.iid}/notes?per_page=${PAGE}&page=${page}`);
      comments.push(...items.filter((n) => !n.system).map((n) => ({ author: n.author?.username ?? "", body: n.body ?? "", date: n.created_at })));
      if (items.length < PAGE) break;
    }
    return comments;
  };
  // The newest pipeline of a commit ("List project pipelines": sha, order_by id, sort desc), or null.
  const pipelineOf = async (sha) => (await read(`${api}/pipelines?sha=${sha}&order_by=id&sort=desc&per_page=1`, { what: `${address.web} at ${sha}` }))[0] ?? null;

  return {
    // An answer that names neither a visibility nor a default branch did not come from a GitLab server.
    async repositoryInfo() {
      const r = await read(api);
      if (!r || typeof r !== "object" || (!r.visibility && !r.default_branch)) {
        const reason = `${host} did not answer as a GitLab server`;
        throw new HostError("Unreachable", { reason }, reason);
      }
      const level = Math.max(r.permissions?.project_access?.access_level ?? 0, r.permissions?.group_access?.access_level ?? 0);
      return { defaultBranch: r.default_branch ?? null, visibility: r.visibility, canWrite: Boolean(token) && level >= MAINTAINER,
        archived: r.archived === true, description: r.description ?? "",
        // The project's setting "Pipelines must succeed" (`only_allow_merge_if_pipeline_succeeds` of "Get a single project"), null where the answer does not hold it.
        greenToMerge: typeof r.only_allow_merge_if_pipeline_succeeds === "boolean" ? r.only_allow_merge_if_pipeline_succeeds : null };
    },

    // The branch, tag or commit resolved to one commit, then that commit's tree, page by page: every file, by its blob SHA.
    async snapshot(name) {
      const what = `${address.web} at ${name}`;
      const commit = (await read(`${api}/repository/commits/${encodeURIComponent(name)}`, { what })).id;
      const blobs = new Map();
      for (let page = 1; page <= MAX_PAGES; page++) {
        const items = await read(`${api}/repository/tree?ref=${commit}&recursive=true&per_page=${PAGE}&page=${page}`, { what });
        for (const e of items) if (e.type === "blob") blobs.set(e.path, e.id);
        if (items.length < PAGE) break;
      }
      return { commit, blobs };
    },

    // Every tag of the project, with the commit it points to, page by page ("List project repository tags": commit.id is the
    // commit an annotated tag is already dereferenced to; at most 100 a page, the next page named in X-Next-Page, empty on the
    // last page — a project with more tags than that is read page by page, exactly as snapshot above reads its tree).
    async listTags() {
      const tags = [];
      for (let page = 1; page <= MAX_PAGES; page++) {
        const items = await read(`${api}/repository/tags?per_page=${PAGE}&page=${page}`);
        for (const t of items) tags.push({ name: t.name, commit: t.commit.id });
        if (items.length < PAGE) break;
      }
      return tags;
    },

    // A release and its files ("Get a release by a tag name", "Get the latest release" at releases/permalink/latest): the links of its assets, each with its name and its address — direct_asset_url where the
    // release has one, else url. GitLab reports neither a size nor a checksum for a link, so both are null. A release that does not exist is NotFound.
    async releaseAssets(tag) {
      const what = `the release ${tag} of ${address.web}`;
      const r = await read(`${api}/releases/${tag === "latest" ? "permalink/latest" : encodeURIComponent(tag)}`, { what });
      return { tag: r.tag_name, name: r.name ?? r.tag_name, published: r.released_at ?? "", notes: r.description ?? "",
        assets: (r.assets?.links ?? []).map((l) => ({ name: l.name, size: null, url: l.direct_asset_url ?? l.url, sha256: null })) };
    },

    // A release is published whole as a draft first on GitHub only; a GitLab server has no draft release. No request is made.
    async publishRelease() {
      throw new HostError("NotSupported", { what: "publishing a release" }, `${address.web} is on a GitLab server, which has no draft release to publish whole; publish the release on GitHub.`);
    },

    // The numbers of open and closed issues, from the project's issue statistics ("Retrieve issues statistics for a project":
    // counts.opened and counts.closed). They count issues alone: a merge request is no issue. A public project serves them
    // without a token.
    async issueCounts() {
      const { counts } = (await read(`${api}/issues_statistics`)).statistics;
      return { open: counts.opened, closed: counts.closed };
    },

    // The issues of a state, labels and search text ("List project issues": state opened, closed or all; labels; search; per_page 100, page by page). Each issue that may have comments is given them
    // (commentsOf), unless `comments` is false: then no note is asked for and each issue's comments are empty.
    async listIssues({ state, labels, search, comments: withComments }) {
      const found = [];
      for (let page = 1; page <= MAX_PAGES; page++) {
        const items = await read(`${api}/issues?${new URLSearchParams({ state: state === "open" ? "opened" : state, per_page: String(PAGE), page: String(page),
          ...(labels.length ? { labels: labels.join(",") } : {}), ...(search ? { search } : {}) })}`);
        found.push(...items);
        if (items.length < PAGE) break;
      }
      const issues = [];
      for (const i of found) issues.push(issueOf(i, withComments ? await commentsOf(i) : []));
      return issues;
    },

    // One issue ("Get a single project issue") with its comments. An iid no issue has — a merge request's among them, whose iids are counted apart — is answered 404: NotFound.
    async readIssue(number) {
      const i = await read(`${api}/issues/${number}`, { what: `issue #${number} of ${address.web}` });
      return issueOf(i, await commentsOf(i));
    },

    // A comment on an issue ("Create new issue note").
    async commentOnIssue(number, body) {
      await call("POST", `${api}/issues/${number}/notes`, { body: { body } });
    },

    // Labels added and removed in one call ("Edit an issue": add_labels, remove_labels as comma-separated texts).
    async setIssueLabels(number, { add, remove }) {
      await call("PUT", `${api}/issues/${number}`, { body: { ...(add.length ? { add_labels: add.join(",") } : {}), ...(remove.length ? { remove_labels: remove.join(",") } : {}) } });
    },

    // An issue closed or reopened ("Edit an issue": state_event close or reopen).
    async setIssueState(number, state) {
      await call("PUT", `${api}/issues/${number}`, { body: { state_event: state === "closed" ? "close" : "reopen" } });
    },

    // The commits that changed a path — the project where the path is null —, newest first, from `ref` (the default branch where
    // none is given), at most `limit` of them (all where none is given), each with the files it changed. "List repository
    // commits" (ref_name, path, follow, per_page up to 100, page) names the commits, page by page; the diff of a commit gives
    // its files, up to 100 to a page, read page by page for a commit that changed more. A server of GitLab 18.10 or later
    // follows a file across a rename unless `follow` is false: the commits asked for are those of the path itself, as GitHub's
    // `path` gives them. A commit's author is named by name and e-mail, not by account: the entry's account is null.
    // With `changes: false` no commit's diff is read: every entry's changes is empty and the history costs one request per page of commits.
    async history(path, { ref, limit, changes: withChanges } = {}) {
      const what = ref ? `${address.web} at ${ref}` : address.web;
      const per = limit === undefined ? PAGE : Math.max(1, Math.min(PAGE, limit));
      const query = `per_page=${per}${ref ? `&ref_name=${encodeURIComponent(ref)}` : ""}${path ? `&path=${encodeURIComponent(path)}&follow=false` : ""}`;
      const listed = [];
      for (let page = 1; page <= MAX_PAGES && (limit === undefined || listed.length < limit); page++) {
        const items = await read(`${api}/repository/commits?${query}&page=${page}`, { what });
        listed.push(...items);
        if (items.length < per) break;
      }
      const entries = [];
      for (const c of limit === undefined ? listed : listed.slice(0, limit)) {
        const changes = withChanges === false ? [] : await commitChanges(c.id);
        entries.push({ commit: c.id, parents: c.parent_ids, author: { account: null, name: c.author_name },
          date: c.committed_date, message: c.message, changes });
      }
      return entries;
    },

    // One file's text at a commit, or null where the commit does not hold it. With `bytes` its bytes.
    async readFile(commit, path, { bytes = false } = {}) {
      const answer = await call("GET", `${api}/repository/files/${encodeURIComponent(path)}/raw?ref=${commit}`,
        { what: `${path} at ${commit}`, on: { 404: () => null } });
      if (answer === null) return null;
      return bytes ? new Uint8Array(await answer.arrayBuffer()) : answer.text();
    },

    // One file's text at each of many commits -> Map(commit -> text | null), in the order given: GitLab has no batch query, so one read of the raw file for each commit.
    async readFileAt(path, commits) {
      const texts = new Map();
      for (const commit of commits) texts.set(commit, await this.readFile(commit, path));
      return texts;
    },

    // One commit of all the files, through "Create a commit with multiple files and actions". GitLab has no write that holds
    // only if the branch still stands at a commit, so: the branch is checked to stand at expectedHead before the files are
    // read, and again just before the write; each file is created where expectedHead does not hold it — GitLab refuses that
    // if the file exists by then —, and updated or deleted with `last_commit_id`, the commit that last changed it as of
    // expectedHead — GitLab refuses that if the file changed on the branch since (validate_file_status!). Each refusal is
    // Moved, and nothing is written. What remains, and what no write of GitLab's API can close: a commit that lands after the
    // last check of the head and before GitLab's own write, and touches none of these files; this one is then written on top
    // of it, without losing any change.
    async commitFiles({ branch, expectedHead, files, message }) {
      // A project without a commit is refused, with the advice to push a first commit to it (MOD-repository-hosts commitFiles).
      if (expectedHead === null) {
        throw new HostError("NotFound", { what: address.web }, `${address.web} has no commit yet — push a first commit to it, then add it here.`);
      }
      const now = await branchHead(branch);
      if (now !== expectedHead) throw moved(branch, now);
      const actions = [];
      for (const f of files) {
        const meta = await read(`${api}/repository/files/${encodeURIComponent(f.path)}?ref=${expectedHead}`, { on: { 404: () => null } });
        const content = f.bytes ? { content: base64(f.bytes), encoding: "base64" } : { content: f.text, encoding: "text" };
        if (f.delete) {
          if (meta) actions.push({ action: "delete", file_path: f.path, last_commit_id: meta.last_commit_id });
        } else if (meta) actions.push({ action: "update", file_path: f.path, ...content, last_commit_id: meta.last_commit_id });
        else actions.push({ action: "create", file_path: f.path, ...content });
      }
      // The head again, just before the write: a commit that landed while the files were read is found here, whether or not
      // it touches them.
      const last = await branchHead(branch);
      if (last !== expectedHead) throw moved(branch, last);
      const refused =/changed since you started editing|already exists|doesn't exist|does not exist/i;
      const answer = await call("POST", `${api}/repository/commits`, { body: { branch, commit_message: message, actions },
        on: { 400: async (a) => {
          const said = await a.clone().json().then((j) => String(j.message ?? j.error ?? ""), () => "");
          if (refused.test(said)) throw moved(branch, await branchHead(branch).catch(() => null));
          throw await refusal(a, { ...context, write: true });
        } } });
      const c = await json(answer, address.origin);
      return { commit: c.id, url: c.web_url ?? `${address.web}/-/commit/${c.id}` };
    },

    // Sets a tag on a commit ("Create a new tag", tag_name + ref). A GitLab server answers an existing tag's creation with 400
    // "Tag <name> already exists": that tag's current commit is then read and the call fails with TagExists, the tag never
    // moved (A VERSION IS NOT REWRITTEN).
    async createTag(name, commit) {
      await call("POST", `${api}/repository/tags`, { body: { tag_name: name, ref: commit },
        on: { 400: async (a) => {
          const said = await a.clone().json().then((j) => String(j.message ?? j.error ?? ""), () => "");
          if (!/already exists/i.test(said)) throw await refusal(a, { ...context, write: true });
          throw await tagExists(name);
        } } });
    },

    // Starts a pipeline ("Create a new pipeline": POST …/pipeline, ref and inputs in the JSON body). The answer is the pipeline, which is the run: its
    // sha the commit, its source — "api" where the answer names none — the event, its status the state, its web_url the address.
    async startWorkflow(workflow, ref, inputs) {
      return ciRunOf(await json(await call("POST", `${api}/pipeline`, { body: { ref, inputs } }), address.origin), workflow);
    },

    // Sets the project's pipeline schedule named by its description ("Pipeline schedules": GET …/pipeline_schedules, 100 to a page, read page by page, finds the first with the description; POST creates
    // it — description, ref, cron, cron_timezone, active —, PUT …/pipeline_schedules/:id updates it, GET …/pipeline_schedules/:id names its variables). Its variables become those given: each given is
    // set (PUT where the schedule has it, else POST …/variables), each other it has is deleted. Every request is a write that needs the role Maintainer, so a 404 is PermissionMissing.
    async setPipelineSchedule({ description, cron, timezone, ref, active, variables = {} }) {
      const options = { write: true, what: `the pipeline schedules of ${address.web}` };
      const schedules = `${api}/pipeline_schedules`;
      const fields = { ref, cron, cron_timezone: timezone, active };
      const found = (await everyPage(schedules, options, (s) => s.id)).find((s) => s.description === description);
      let id, had = [];
      if (found) {
        id = found.id;
        had = (await read(`${schedules}/${id}`, options)).variables?.map((v) => v.key) ?? [];
        await call("PUT", `${schedules}/${id}`, { ...options, body: fields });
      } else {
        id = (await json(await call("POST", schedules, { ...options, body: { description, ...fields } }), address.origin)).id;
      }
      for (const [key, value] of Object.entries(variables)) {
        if (had.includes(key)) await call("PUT", `${schedules}/${id}/variables/${encodeURIComponent(key)}`, { ...options, body: { value } });
        else await call("POST", `${schedules}/${id}/variables`, { ...options, body: { key, value } });
      }
      for (const key of had.filter((k) => !(k in variables))) await call("DELETE", `${schedules}/${id}/variables/${encodeURIComponent(key)}`, options);
      return { id: String(id), url: `${address.web}/-/pipeline_schedules` };
    },

    // The pipelines ("List project pipelines": ref and sha from the filter's branch and commit, 100 to a page, read page by page). A project has one pipeline definition, which startWorkflow starts
    // whatever workflow it is given: the filter's workflow narrows nothing, and is each run's workflow, "" where the filter names none. The filter's event is the pipelines' `source`;
    // with `newest`, only the first page, that many pipelines long, the newest first.
    async listCiRuns({ workflow, branch, commit, event, newest } = {}) {
      const query = new URLSearchParams();
      if (branch) query.set("ref", branch);
      if (commit) query.set("sha", commit);
      if (event) query.set("source", event);
      if (newest) {
        query.set("per_page", String(Math.min(newest, PAGE)));
        return (await read(`${api}/pipelines?${query}`, {})).slice(0, newest).map((p) => ciRunOf(p, workflow ?? ""));
      }
      return (await everyPage(`${api}/pipelines${query.size ? `?${query}` : ""}`, {}, (p) => p.id)).map((p) => ciRunOf(p, workflow ?? ""));
    },

    // Each CI/CD variable of the project by its key and environment scope, through the server's GraphQL API, which answers only the fields asked for: the query asks
    // for `key` and `environmentScope` of `Project.ciVariables` and never for `value`, so no value leaves the server. The connection is read 100 nodes to a page (the
    // default maximum page size), following `pageInfo.endCursor` while `hasNextPage`. The token goes to the server's own /api/graphql as the header
    // `Authorization: Bearer`, which GraphQL documents. A query field the token may not read is `null` (GraphQL "Authorization": "Query fields return `null` when you
    // do not have permission to access a resource"): `ciVariables` or `project` null is PermissionMissing; listing a project's variables needs the role Maintainer.
    async ciVariableScopes() {
      const options = { ...context, write: false, what: `the CI/CD variables of ${address.web}` };
      const scopes = [];
      let after = null;
      for (let page = 1; page <= MAX_PAGES; page++) {
        const answer = await send(graphql, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ query: VARIABLE_SCOPES, variables: { path: address.path, after } }) }, gate);
        if (!answer.ok) throw await refusal(answer, options);
        const said = await json(answer, address.origin);
        const variables = said?.data?.project?.ciVariables;
        if (!variables) {
          if (Array.isArray(said?.errors) && said.errors.length) {
            const reason = said.errors.map((error) => error?.message).filter(Boolean).join("; ") || "an error";
            throw new HostError("Unreachable", { reason }, `${host} answered the list of CI/CD variables with ${reason}`);
          }
          throw new HostError("PermissionMissing", { permission: context.permission, renewal: context.renewal },
            `${host} lists no CI/CD variables of ${address.web} for this token: they are listed for ${context.permission}. Renew it on ${context.renewal}.`);
        }
        scopes.push(...(variables.nodes ?? []).map((node) => ({ name: node.key, scope: node.environmentScope ?? "*" })));
        if (!variables.pageInfo?.hasNextPage) break;
        after = variables.pageInfo.endCursor;
      }
      return scopes;
    },

    // Cancels a pipeline's jobs ("Cancel a pipeline's jobs": POST …/pipelines/:pipeline_id/cancel, which answers the pipeline, one that has finished already included).
    async cancelCiRun(id) {
      await call("POST", `${api}/pipelines/${encodeURIComponent(id)}/cancel`, { what: `pipeline ${id} of ${address.web}` });
    },

    // The jobs of a pipeline in the order the server lists them ("List pipeline jobs", page by page), each with its log ("Get a log file": …/jobs/:job_id/trace) -> [{ name, text }] of the jobs that have
    // one; a log answered 404 or 410 is not kept.
    async jobLogs(id) {
      const options = { what: `pipeline ${id} of ${address.web}` };
      const logs = [];
      for (const job of await everyPage(`${api}/pipelines/${encodeURIComponent(id)}/jobs`, options, (j) => j.id)) {
        const answer = await call("GET", `${api}/jobs/${encodeURIComponent(job.id)}/trace`, { ...options, on: { 404: () => null, 410: () => null } });
        if (answer !== null) logs.push({ name: job.name, text: await answer.text() });
      }
      return logs;
    },

    // The tags the jobs of a pipeline ask for ("List pipeline jobs": each job's `tag_list`), in the order the server lists the jobs and their tags, each once; a pipeline with no tag gives [].
    async jobLabels(id) {
      const options = { what: `pipeline ${id} of ${address.web}` };
      const jobs = await everyPage(`${api}/pipelines/${encodeURIComponent(id)}/jobs`, options, (j) => j.id);
      return [...new Set(jobs.flatMap((job) => job.tag_list ?? []))];
    },

    // The merge requests ("List project merge requests": state opened, closed, merged or all, source_branch, 100 to a page, the pages asked for at once).
    async listPullRequests({ state = "all", branch } = {}) {
      const ask = state === "open" ? "opened" : state;
      const listed = await allPages(`${api}/merge_requests?state=${ask}${branch ? `&source_branch=${encodeURIComponent(branch)}` : ""}`, {}, (m) => m.iid);
      return listed.map(pullOf).filter((p) => state === "all" || p.state === state);
    },

    // Opens a merge request ("Create MR": POST …/merge_requests, source_branch, target_branch, title, description; 201 with the merge request, read with pullOf as listPullRequests reads it). The page lists no
    // draft parameter: a draft is GitLab's draft marker, the title prefix "Draft: ". Every refusal is the host's own failure (failures.mjs).
    async openPullRequest({ branch, base, title, body, draft }) {
      const made = await call("POST", `${api}/merge_requests`, { body: { source_branch: branch, target_branch: base, title: draft === true ? `Draft: ${title}` : title, description: body } });
      return pullOf(await json(made, address.origin));
    },

    // Merges a merge request at the head that was read ("Get single MR" for the head, then "Merge a merge request": PUT …/merge_requests/:iid/merge, sha — the head the source branch must still
    // have —; 200 with merge_commit_sha; 405 and 422 the merge cannot be performed; 409 the sha did not match). See github.mjs.
    async mergePullRequest(number, expectedHead) {
      const what = `merge request !${number} of ${address.web}`;
      const now = (await read(`${api}/merge_requests/${number}`, { what })).sha;
      if (now !== expectedHead) throw new HostError("Moved", { head: now }, `Merge request !${number} has moved on to ${now.slice(0, 12)} since it was read — nothing was merged; read it again.`);
      const made = await call("PUT", `${api}/merge_requests/${number}/merge`, { body: { sha: expectedHead }, what,
        on: { 405: notMergeable, 422: notMergeable, 409: async () => { throw new HostError("Moved", { head: null }, `Merge request !${number} has moved on since it was read — nothing was merged; read it again.`); } } });
      return { commit: (await json(made, address.origin)).merge_commit_sha };
    },

    // Whether the branch's history holds the commit ("Get a merge base": GET …/repository/merge_base?refs[]=…&refs[]=…): the common ancestor of
    // the commit and the branch is the commit itself when the branch holds it. The page names no status for a ref the server does not know;
    // GitLab answers 400 or 404, here a commit it does not know: not contained.
    async containsCommit(branch, commit) {
      const base = await read(`${api}/repository/merge_base?refs[]=${encodeURIComponent(commit)}&refs[]=${encodeURIComponent(branch)}`,
        { on: { 400: () => null, 404: () => null } });
      return base !== null && base.id === commit;
    },

    // What a Definition-of-Done check sees of one merge request (the merge request, its commits, diffs and approvals, and for a commit its files and newest pipeline, for the head the
    // jobs of that pipeline). The approvals carry no commit: each is given on the merge request's head commit. See github.mjs.
    async pullRequestFacts(number) {
      const what = `merge request !${number} of ${address.web}`;
      const mr = await read(`${api}/merge_requests/${number}`, { what });
      const listed = await everyPage(`${api}/merge_requests/${number}/commits`, { what }, (c) => c.id);
      const commits = [];
      for (const c of listed) {
        const pipeline = await pipelineOf(c.id);
        commits.push({ sha: c.id, message: c.message, files: (await commitChanges(c.id)).map((change) => change.path), ci: pipeline ? PIPELINE_CI[pipeline.status] ?? "running" : "none",
          parents: c.parent_ids ?? [], date: c.committed_date ?? c.created_at ?? "" });
      }
      const files = (await everyPage(`${api}/merge_requests/${number}/diffs`, { what }, (d) => `${d.old_path}>${d.new_path}`)).map((d) => { const { path, change } = changeOf(d); return { path, change }; });
      const approvals = await read(`${api}/merge_requests/${number}/approvals`, { what });
      const reviews = (approvals.approved_by ?? []).map((a) => ({ reviewer: a.user?.username ?? "", verdict: "approved", commit: mr.sha, date: a.approved_at }));
      const head = await pipelineOf(mr.sha);
      const checks = head ? (await everyPage(`${api}/pipelines/${head.id}/jobs`, { what }, (j) => j.id ?? j.name)).map((j) => ({ name: j.name, state: jobState(j.status), url: j.web_url })) : [];
      return { pullRequest: pullOf(mr), baseCommit: mr.diff_refs?.base_sha ?? null, headCommit: mr.sha, commits, files, reviews, checks,
        readFile: (commit, path) => this.readFile(commit, path) };
    },

    // A new issue ("New issue": title, description, labels as a comma-separated text; the answer is the issue).
    async createIssue({ title, body, labels }) {
      return issueOf(await json(await call("POST", `${api}/issues`, { body: { title, description: body, labels: labels.join(",") } }), address.origin));
    },

    // Creates a branch at a commit ("Create repository branch"). A branch that stands already — 400 "Branch already exists" —
    // is left where it stands, never moved; any other 400 stays the failure it is.
    async createBranch(name, from) {
      await call("POST", `${api}/repository/branches`, { body: { branch: name, ref: from },
        on: { 400: async (a) => {
          const said = await a.clone().json().then((j) => String(j.message ?? j.error ?? ""), () => "");
          if (!/already exists/i.test(said)) throw await refusal(a, { ...context, write: true });
          return null;
        } } });
    },
  };
}
