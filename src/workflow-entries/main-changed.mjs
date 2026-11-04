// main-changed.mjs — onMainChanged, the one entry run alike in the instance and in a product (MOD-workflow-entries, Parts): the instance's
// .github/workflows/main-changed.yml runs it, and in a product the file MOD-runtimes writes beside the job workflow,
// .github/workflows/agent-m-main-changed.yml or .gitlab/agent-m-main-changed.yml.
//
// Module: MOD-workflow-entries
//
// THE TRACEABILITY MATRIX IS DERIVED. The entry keeps nothing between runs.

import { lastAcceptedText, statuses } from "../approvals/index.mjs";
import { productFacts, publishOverview } from "../progress-measures/index.mjs";
import { publishGraph } from "../trace-graph/index.mjs";
import { composeInstance, composeMainChanged } from "./compose.mjs";

/**
 * onMainChanged(env: CiEnvironment) -> Promise<EntryStatus> — in the instance and in a product alike, on every push to the default branch: on the commit's
 * snapshot, read once, adds the commit's graph and the impact lists of its decision and module files that are not accepted to the branch trace-cache through
 * MOD-trace-graph's publishGraph — each such file with the text it was last accepted at (MOD-approvals' lastAcceptedText, read once for the file) and that text's
 * commit, which is the commit that added the approval record naming the text —, and the commit's overview of the main page with the views of the progress and the
 * backlog page to the branch overview-cache through MOD-progress-measures' publishOverview, from the facts of the scope `all`, naming both in its summary. In a
 * product (`job.productDir` set) the repository is the product's checkout, and the instance is read through its checkout at the commit the file names, as
 * productFacts' instanceAt; it writes with the workflow's own token on GitHub and the person's token on GitLab. A file a branch holds already is left as it is
 * (`nothing to do`). A missing token ends the entry at once as `not run`; a failure — a branch missing, or moved meanwhile, so that the run can be made again —
 * leaves the other record written and ends the entry `failed`, naming it.
 */
export async function onMainChanged(env) {
  const inProduct = Boolean(env.job?.productDir);
  const token = inProduct && env.service === "gitlab" ? env.job.personToken : env.token;
  if (!token) {
    const name = inProduct && env.service === "gitlab" ? env.job.tokenName : "GITHUB_TOKEN";
    const given = name === "GITHUB_TOKEN" ? "the workflow's own token is passed to the step as GITHUB_TOKEN" : `the person's token is read from the CI/CD variable ${name}`;
    return { outcome: "not run", summary: `${name} is missing: ${given}. Nothing was written.`, findings: [] };
  }
  if (!env.branch) {
    const name = env.service === "gitlab" ? "CI_COMMIT_REF_NAME" : "GITHUB_REF_NAME";
    return { outcome: "not run", summary: `${name} is missing: the branch the workflow runs for. Nothing was written.`, findings: [] };
  }
  const { host, instanceAt, instanceSnapshot } = inProduct ? await productParts(env, token) : instanceParts(env);
  const snapshot = await host.readSnapshot(env.branch);
  const commit = snapshot.commit;
  const moved = (error) => (error?.name === "Moved" ? " The branch moved on meanwhile: run the entry again." : "");
  const done = [], failed = [];
  let written = false;
  try {
    const graph = await publishGraph(host, snapshot, await notAccepted(host, snapshot));
    written ||= graph.written;
    done.push(graph.written ? `Added the graph and the impact lists of ${commit} to trace-cache.` : `trace-cache holds the graph of ${commit} already.`);
  } catch (error) {
    failed.push(`The graph of ${commit} was not added to trace-cache: ${error?.message ?? error}${moved(error)}`);
  }
  try {
    // The facts are read from the snapshot already read: the host answers it for the branch the entry runs for.
    const same = { ...host, readSnapshot: (ref) => (ref === "HEAD" || ref === env.branch ? Promise.resolve(snapshot) : host.readSnapshot(ref)) };
    const facts = await productFacts(same, instanceSnapshot ?? snapshot, instanceAt, env.now, { scope: "all" });
    const overview = await publishOverview(host, snapshot, facts);
    written ||= overview.written;
    done.push(overview.written ? `Added the overview and the views of progress and backlog of ${commit} to overview-cache.`
      : `overview-cache holds the overview and the views of progress and backlog of ${commit} already.`);
  } catch (error) {
    failed.push(`The overview of ${commit} was not added to overview-cache: ${error?.message ?? error}${moved(error)}`);
  }
  const summary = [...failed, ...done].join(" ");
  return { outcome: failed.length ? "failed" : written ? "done" : "nothing to do", summary, findings: [] };
}

// In the instance: its checkout is the repository, and the instance at any commit is read from it.
function instanceParts(env) {
  const { host } = composeInstance(env);
  return { host, instanceAt: (at) => host.readSnapshot(at), instanceSnapshot: null };
}

// In a product: the product's checkout is the repository; the instance is its checkout at the commit the file names, and productFacts' instanceAt.
async function productParts(env, token) {
  const { product, instance } = composeMainChanged(env, token);
  return { host: product, instanceAt: (at) => instance.readSnapshot(at), instanceSnapshot: await instance.readSnapshot("HEAD") };
}

// The decision and module files of the snapshot that are not accepted, each as publishGraph takes it: its path and the text it was last accepted at with
// the commit of that text — null for a file never accepted. MOD-approvals' statuses names the files; lastAcceptedText gives the text, and the commit is
// the one that added the approval record docs/approvals/<id>-<blob12>.md, at which lastAcceptedText read it.
async function notAccepted(host, snapshot) {
  const changed = [];
  for (const [path, { id, kind, status }] of [...statuses(snapshot)].sort(([a], [b]) => (a < b ? -1 : 1))) {
    if (!["architecture-decision", "module"].includes(kind) || status === "accepted") continue;
    const last = status === "open" ? null : await lastAcceptedText(id, host);
    if (last === null) { changed.push({ path, before: null }); continue; }
    const [adding] = await host.readHistory(`docs/approvals/${id}-${last.blob.slice(0, 12)}.md`, { ref: snapshot.commit, limit: 1, changes: false });
    changed.push({ path, before: { commit: adding.commit, text: last.text } });
  }
  return changed;
}
