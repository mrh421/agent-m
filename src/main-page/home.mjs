// home.mjs — the route `home` (docs/architecture/MOD-main-page.md, Parts and Interfaces: `home`): one card per product this browser keeps — or Agent M's own card while it keeps none — with
// its bar of six stages and its build, and below the cards the link *Jobs* to the route `jobs`, where what waits for a person is listed (waits.mjs).
//
// Module: MOD-main-page
//
// THE MAIN PAGE SHOWS WHAT GOES ON IN THE INSTANCE; PROGRESS AND JOB STATE ARE DERIVED, NOT STORED; A TOKEN GOES ONLY TO THE SERVER THAT ISSUED IT. The page computes no share, no stage and no
// state: where the repository stores an overview of its head (MOD-progress-measures' storedOverview, computed by the workflow `main changed`), the card is drawn from that overview
// alone — its stages, its model, and the build's states with the records of the jobs working on them —, and no pull request, record or other file is read; elsewhere
// MOD-progress-measures derives them from the facts it gathers once for each product (productFacts, the scope `all`). MOD-job-ledger's listJobs derives the jobs' rows again with the
// live states their runtimes report for those jobs whose record has no end, asked once for the repository (MOD-runtimes' liveStates, as the route `jobs` asks them). It stores nothing. Each product is connected, through jobs.mjs's sourcesOf, by
// MOD-site-frame's chosenProduct with the token this browser keeps for it, and the instance with the frame's own host; a token reaches no other server. Once the cards are drawn, reread.mjs reads the
// jobs' states of the cards again at an interval, while the route is shown, and nothing else.
//
// Readings the module file leaves open, which this file takes:
//   - The fragment handed to chosenProduct is `#home/product=<the product's address, percent-encoded>`, the form the frame writes for a route with a product.
//   - A product's name on its card is its repository's path, `owner/name`; Agent M's own card is called Agent M.
//   - A card whose repository cannot be read says which, with the reason its host gives, and a button to the token's setting; while no product is kept, *+ Add product* stands below Agent M's
//     card; the link *Jobs* below the cards is a button too, as *+ Add product* is. Each calls the ViewContext's `go(route, params)`; no address is written here. The greeting is greeting.mjs's, with
//     *Get your own Agent M* at the address of the route `get-your-own` of the review pages ("docs/index.html#get-your-own"), a link and not a call of go(), since the main page loads no view of the review pages.

import { readSetting } from "../browser-store/index.mjs";
import { parseAddress } from "../repository-hosts/index.mjs";
import { menuOf } from "../site-frame/index.mjs";
import { productFacts, stageShares, currentStage, buildInProgress } from "../progress-measures/index.mjs";
import { listJobs } from "../job-ledger/index.mjs";
import { bridgesOf, liveStatesOf, sourcesOf } from "./sources.mjs";
import { el, productCard, readingCard, errorCard } from "./cards.mjs";
import { storedOf } from "./waits.mjs";
import { greeting } from "./greeting.mjs";
import { readAgain } from "./reread.mjs";

const reasonOf = (failure) => String(failure?.message ?? failure);

// The sources to draw a card for: each product this browser keeps, once, connected with its own token — or, while it keeps none, the instance itself as Agent M. The sources are those of
// jobs.mjs's sourcesOf for the route `home`; a card adds its title and, for the instance's own source (marked `own`), whether a token is stored for it.
async function cardSources(context) {
  const { store } = context;
  return (await sourcesOf(context, "home")).map((source) => (source.own === true
    ? { ...source, title: "Agent M", tokenStored: readSetting(store, "github-token") !== null }
    : { ...source, title: parseAddress(source.address).path }));
}

// The host a card reads through: the same host, whose repositoryInfo and readSnapshot are asked once for each branch, so that the head's commit and tree are read once for the card
// whatever it reads after the overview (A PAGE LOAD READS THE REPOSITORY IN BATCHES).
function once(host) {
  let info;
  const branches = new Map();
  return { ...host, repositoryInfo: () => (info ??= host.repositoryInfo()),
    readSnapshot: (ref) => { if (!branches.has(ref)) branches.set(ref, host.readSnapshot(ref)); return branches.get(ref); } };
}

// The head of the host's default branch and the overview stored for it, or while that is not stored yet the overview stored last, with the commit it is of (waits.mjs's storedOf, over
// MOD-progress-measures' storedOverview and latestOverview); null only for a repository that stores none, whose card is then derived as before. A failure of the host here is left to the
// scope `all`, which meets it again and gives the card its reason; any other error is a fault of the page.
const HOST_FAILURES = new Set(["NotFound", "NotSupported", "TokenRefused", "PermissionMissing", "RateLimited", "Unreachable"]);
async function storedFor(host) {
  try {
    const { defaultBranch } = await host.repositoryInfo();
    const snapshot = await host.readSnapshot(defaultBranch);
    return { snapshot, ...(await storedOf(snapshot)) };
  } catch (failure) {
    if (HOST_FAILURES.has(failure?.name)) return { snapshot: null, stored: null, asOf: null };
    throw failure;
  }
}

// The jobs' rows of a source, derived again with the live states of the jobs among them that have not ended.
async function withLiveStates(host, store, address, snapshot, rows) {
  const lives = await liveStatesOf(rows, new Map([[address, host]]), bridgesOf(rows, store));
  return listJobs([{ address, snapshot }], lives);
}

// The instance's commit and tree, read when a card first needs them — a card drawn from the scope `all`, which takes the participants and the process models from them, or Agent M's own card — and
// once for all such cards; while every card has an overview, nothing of the instance is read (MOD-main-page, Interfaces: `home`). A failure is the reason of each card that needed them.
function instanceOnce(instance) {
  let held = null;
  return () => (held ??= (async () => {
    try {
      const info = await instance.host.repositoryInfo();
      return { info, snapshot: await instance.host.readSnapshot(info.defaultBranch) };
    } catch (failure) {
      throw new Error(`Agent M's own repository could not be read: ${reasonOf(failure)}`);
    }
  })());
}

// One source's facts where no overview is stored: everything (the scope `all`), with the jobs' rows derived again with the live states.
async function factsOf(host, { store, instance, instanceAt }) {
  const { snapshot: instanceSnapshot } = await instance();
  const facts = await productFacts(host, instanceSnapshot, instanceAt, new Date(), { scope: "all" });
  return { ...facts, jobs: await withLiveStates(host, store, facts.address, facts.snapshot, facts.jobs) };
}

// The facts of the build an overview holds: the states of its steps or items in progress, and the rows of the jobs working on them, which MOD-job-ledger's listJobs derives from the
// records the overview holds, with the live states of those that have not ended. The records are served from the overview: no record file, no pull request and no other file is read.
// The snapshot is the head's, its paths narrowed to those records, so that the readings again compare their blobs (reread.mjs).
async function buildOf(host, store, snapshot, stored) {
  const texts = new Map(stored.build.records.map(({ path, text }) => [path, text]));
  // The texts are held already: its readMany, which listJobs names the records to, reads nothing ahead.
  const records = { ...snapshot, paths: [...texts.keys()], read: (path) => Promise.resolve(texts.get(path) ?? null), readMany: () => Promise.resolve() };
  const address = snapshot.repository?.web ?? "";
  const rows = await listJobs([{ address, snapshot: records }], new Map());
  return { address, snapshot: records, plan: { states: stored.build.states }, jobs: await withLiveStates(host, store, address, records, rows) };
}

async function cardOf(source, reading, go) {
  try {
    // Agent M's own card is the instance: read through the instance's commit and tree, which the scope `all` of the card shares.
    const known = source.own === true ? await reading.instance() : null;
    const raw = known === null ? source.host : { ...source.host, repositoryInfo: () => Promise.resolve(known.info),
      readSnapshot: (ref) => (ref === known.snapshot.ref ? Promise.resolve(known.snapshot) : source.host.readSnapshot(ref)) };
    const host = once(raw);
    const { snapshot, stored, asOf } = await storedFor(host);
    const facts = stored ? await buildOf(host, reading.store, snapshot, stored) : await factsOf(host, reading);
    const shares = stored ? stored.shares : await stageShares(facts);
    const model = stored ? stored.model : facts.model?.name ?? null, current = currentStage(shares);
    return { card: productCard({ title: source.title, address: source.address, model, shares, current, build: buildInProgress(facts), own: source.own === true, asOf }),
      held: { source, facts, shares, current, model, asOf } };
  } catch (failure) {
    return { card: errorCard({ title: source.title, address: source.address, reason: reasonOf(failure), go }) };
  }
}

async function render(target, context) {
  const { instance } = context;
  const sources = await cardSources(context);
  const nodes = sources.map((source) => (source.reason === undefined ? readingCard(source) : errorCard({ ...source, go: context.go })));
  const cards = el("section", "cards", ...nodes);
  const entries = menuOf("main", []);
  // The route get-your-own is served by the review pages, under the entry Settings: the address of that entry with the route's name in its place.
  const getYourOwnHref = entries.find((entry) => entry.key === "settings").href.replace(/settings$/, "get-your-own");
  const greet = greeting({ useCasesHref: entries.find((entry) => entry.key === "use-cases").href, getYourOwnHref });
  const add = el("button", "add-product btn", "+ Add product");
  add.setAttribute("type", "button");
  add.addEventListener("click", () => context.go("add-product"));
  const adding = sources[0]?.own === true ? [add] : [];
  const jobs = el("button", "jobs-link btn", "Jobs");
  jobs.setAttribute("type", "button");
  jobs.addEventListener("click", () => context.go("jobs"));
  target.replaceChildren(greet, cards, ...adding, el("p", "jobs-entry", jobs));

  const reading = { store: context.store, instance: instanceOnce(instance), instanceAt: (commit) => instance.host.readSnapshot(commit) };
  const held = [];
  await Promise.all(sources.map(async (source, at) => {
    if (source.reason !== undefined) return;
    const result = await cardOf(source, reading, context.go);
    nodes[at] = result.card;
    held[at] = result.held;
    cards.replaceChildren(...nodes);
  }));
  readAgain({ target, cards, nodes, held, store: context.store });
}

/**
 * home: Route — { name: "home", entry: null, title: "Agent M", render }; the frame's default subject.
 */
export const home = { name: "home", entry: null, title: "Agent M", render };
