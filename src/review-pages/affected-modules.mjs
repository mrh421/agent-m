// affected-modules.mjs — what an Accept of use cases does in a product whose workflow's model pulls its work from a backlog (MOD-review-pages, Interfaces; UC-008 step 6):
// beside Accept, the participant that will check which modules each use case changes, with the place where it processes data, as prepareJob of the kind
// check-affected-modules gives it; and, once the acceptance's commit is written, one job of that kind in this tab for each use case the acceptance recorded, naming that
// use case in its parameters, whose writer commits the items under the person's account. In a model that plans its work, or without a declaration, it names none and
// runs nothing.
//
// Module: MOD-review-pages
//
// THE PAGE NAMES WHERE IT SENDS: nothing is sent while the page is drawn — prepareJob sends nothing —; ONE CLICK PER DECISION: the jobs run on the click of Accept, with
// the token the person stored for the page's product. The participant is chosen as on the drafting page (jobs.mjs): among those of the instance's register that can do
// what the kind needs, the first whose route is this tab, since the job runs here.

import { readDocument } from "../documents/index.mjs";
import { declarationSchema, productWorkflow } from "../product-process/index.mjs";
import { queueJob, routesFor, runOnTab } from "../runtimes/index.mjs";
import { defaultSnapshot, el } from "./common.mjs";
import { connectionsOf, loadStage, preparedRun, startRecord } from "./jobs.mjs";

const KIND = "check-affected-modules";
const PROCESS = "docs/process.md";
const SPEC = "SPEC.md";
// What the job's recipes read of the product (use-case-with-neighbours, whole-architecture), and of the instance (Agent M's AGENTS.md, the register).
const INPUT = /^docs\/(?:use-cases|architecture)\/[^/]+\.md$/;
const INSTANCE_FILES = ["AGENTS.md", "docs/participants.md"];

// The page's host as the jobs the click runs take it: a branch is read whole, at the commit the page's host gives for it. A page reads only the folders it shows, and after a commit the
// frame gives that page's own snapshot for the branch, which holds neither the architecture nor the job records a job reads.
const wholeHost = (host) => ({ ...host, readSnapshot: async (ref, options) => {
  const read = await host.readSnapshot(ref, options);
  return options?.folders || read.commit === ref ? read : host.readSnapshot(read.commit);
} });

/**
 * affectedCheck(where, useCase) -> Promise<null | { note: Element, run: (ids: string[]) => Promise<Element[]> }> — for the page `where` (the flow's) with a token, in a
 * product whose docs/process.md declares a model of kind `pulled`: the note that names, beside Accept, the participant and its place, as the destination of the job of
 * check-affected-modules prepared for `useCase`, the first use case the page offers; and `run`, which the click calls with the identifiers of the use cases its commit
 * recorded and which gives what each job came to. Null without a token, without a declaration, or for a model that plans its work. Reads only the page's own
 * snapshot, in batches, and, for a product, the instance at its default branch; fails as they fail.
 */
export async function affectedCheck(where, useCase) {
  const { token, snapshot, context } = where;
  if (!token) return null;
  // Everything is read from the page's own snapshot, whose folders hold what the check reads (kinds.mjs), in batches: the page reads its commit once.
  if (!snapshot.paths.includes(PROCESS)) return null;
  await snapshot.readMany?.([PROCESS]);
  const declared = await snapshot.read(PROCESS);
  if (declared === null) return null;
  const instanceHost = context.product ? context.instance.host : where.host;
  const instance = context.product ? await defaultSnapshot(instanceHost) : snapshot;
  await instance.readMany?.([SPEC]);
  // The model is read from the instance at the declaration's model_version, read again only where that is another commit than the one at hand.
  const instanceAt = (commit) => (commit === instance.commit ? instance : instanceHost.readSnapshot(commit));
  const workflow = await productWorkflow(readDocument(declarationSchema, PROCESS, declared), instanceAt, (await instance.read(SPEC)) ?? "");
  if (workflow?.model?.kind !== "pulled") return null;
  // The parts of the job's preparation and the register, in one batch where the instance is the page's own repository.
  const own = snapshot.paths.filter((path) => path === SPEC || INPUT.test(path));
  const theirs = INSTANCE_FILES.filter((path) => instance.paths.includes(path));
  if (instance === snapshot) await snapshot.readMany?.([...own, ...theirs]);
  else await Promise.all([snapshot.readMany?.(own), instance.readMany?.(theirs)]);
  const stage = await loadStage(where, KIND, instance);
  const chosen = stage.drafters.find((each) => {
    const offer = routesFor(each, stage.participants, stage.product, stage.needs)[0];
    return offer?.available && offer.route.kind === "tab";
  });
  if (!chosen) {
    return { note: el("p", "affected-check problem", `No participant that can ${stage.definition.needs.join(", ")} works in this tab: accepting adds no backlog item.`), run: async () => [] };
  }
  const run = { ...where, ...stage, host: wholeHost(where.host), chosen, jobKind: KIND };
  const [destination] = (await preparedRun(run, snapshot, { useCase })).prepared.destinations;
  const note = el("p", "affected-check", "Accept also has ", el("span", "participant", destination.participant.name), " at ",
    el("span", "place", destination.place || "no processing place declared"), " check which modules each use case accepted changes, and adds a backlog item for each of them that no item not yet done names.");
  return { note, run: (ids) => checkEach(run, ids) };
}

// One job of check-affected-modules for each use case of `ids`, one after the other, each on the head the one before left, run in this tab: what each came to, a paragraph each.
async function checkEach(run, ids) {
  const shown = [];
  for (const id of ids) {
    try {
      const { defaultBranch } = await run.host.repositoryInfo();
      const head = await run.host.readSnapshot(defaultBranch);
      const ready = await preparedRun(run, head, { useCase: id });
      const keeping = [...ready.prepared.blocking.map((found) => found.what), ...ready.prepared.notFitting.map((each) => `${each.participant.name} cannot take ${each.size} tokens`)];
      if (keeping.length) { shown.push(el("p", "affected-result problem", `${id}: no job was started: ${keeping.join("; ")}.`)); continue; }
      const record = startRecord({ ...ready, worksOn: [id] });
      const { path, commit } = await queueJob(run.host, record, ready.offer.route, head.commit);
      const queued = await run.host.readSnapshot(commit);
      const outcome = await runOnTab(ready.prepared, { ...ready.jobContext, product: { ...ready.jobContext.product, snapshot: queued } },
        connectionsOf([ready.prepared.drafter], run.context.store), { host: run.host, record: { ...record, path } });
      const files = outcome.written?.files ?? [];
      shown.push(el("p", "affected-result", `${id}: job ${ready.id} ${files.length ? `added ${files.join(", ")}` : "added no backlog item"}.`,
        ...outcome.stepFindings.map((found) => ` ${found.artifact}: ${found.what}.`)));
    } catch (failure) {
      shown.push(el("p", "affected-result problem", `${id}: ${failure.name}: ${failure.message}`));
    }
  }
  return shown;
}
