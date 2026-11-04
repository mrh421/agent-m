// reread.mjs — the jobs' states of the route `home`, read again while it is open and its tab shown (docs/architecture/MOD-main-page.md, Data: "While the page is open it reads the jobs' states again at an
// interval the repository servers' rate limits allow, so the build stays current, except while its tab is hidden (`document.visibilityState` is `hidden`): then it starts no reading, and when
// `visibilitychange` shows the tab again it reads at once each card whose reading fell due meanwhile. … It stores nothing between readings").
//
// Module: MOD-main-page
//
// PROGRESS AND JOB STATE ARE DERIVED, NOT STORED; THE BUILD IS SHOWN AS IT HAPPENS; A USED-UP RATE LIMIT IS NAMED, NOT BLAMED ON THE TOKEN. A reading asks, for each card that was drawn, its host for the default
// branch's snapshot again (the commit and its tree: two requests, the branch named by that card's own snapshot), has MOD-job-ledger's listJobs derive the rows of the jobs the card was drawn with from it
// — the host holds every record it has read, so only a record that changed since is fetched —, asks MOD-runtimes' liveStates once for the jobs whose record has no end, as the route `jobs` does (jobs.mjs), and derives the rows again. It
// reads nothing else: the stages, the shares, the plan, the pull requests and what waits for a person stay as they were drawn, and only the build's rows move. It stores nothing but the rows of the last
// reading, for the cards to be drawn again.
//
// Where the module file leaves a reading open, this file takes the one it names (the pull request names the sentences they rest on):
//   - The interval is one minute, for a card whose repository this browser keeps a token for. A reading costs two requests for a card, so a card costs 120 an hour of the 5,000 an hour the account's limit
//     gives. A card without a token is not read again: the network's limit without one is 60 an hour, which a reading each minute would use up in half an hour.
//   - A reading that fails leaves the cards as drawn and says why below them. The card is read again at the next interval, as MOD-prompt-bar's followJob goes on after a failed poll — unless the failure is
//     `RateLimited` (MOD-repository-hosts) with the time it resets: that card is then not read again before that time, if it is later than the next interval. The other cards go on at the interval,
//     since each token has a limit of its own.
//   - The readings stop once the route is no longer the one shown: the frame draws another route into the same element, which then no longer holds these cards.
//   - While the tab is hidden a timer that fires starts no reading and sets no timer: the readings are paused, not postponed. When `visibilitychange` shows the tab, the cards whose time has come are read at
//     once and the timer is set for the next one due; a card not yet due keeps its time. A card being read is not read again by a second event (a reading in flight is not cancelled either). The listener is
//     removed by the first event or timer that finds the cards gone.

import { listJobs } from "../job-ledger/index.mjs";
import { buildInProgress } from "../progress-measures/index.mjs";
import { bridgesOf, liveStatesOf } from "./sources.mjs";
import { el, productCard } from "./cards.mjs";

/** EVERY — the time between two readings, in milliseconds. */
export const EVERY = 60000;

const reasonOf = (failure) => String(failure?.message ?? failure);

// When a card that failed with `failure` is read again: at the next interval, or later if its limit is used up until then.
const dueAfter = (failure, now) => {
  const reset = failure?.name === "RateLimited" && failure.resetsAt instanceof Date ? failure.resetsAt.getTime() : 0;
  return Math.max(now + EVERY, reset);
};

// One card's jobs read again through the host it was read through: its rows, derived with the live states of the jobs that have not ended.
async function jobsAgain({ source, facts, jobState = null }, store) {
  const snapshot = await source.host.readSnapshot(facts.snapshot.ref);
  // Only the records of the jobs the card was drawn with: the plan stays as drawn, so no other job can enter its build.
  const drawn = new Set(facts.jobs.map((row) => row.record.path));
  const paths = snapshot.paths.filter((path) => drawn.has(path));
  const prior = jobState ?? {
    blobs: new Map(facts.jobs.map((row) => [row.record.path, facts.snapshot.blob(row.record.path)])),
    texts: new Map(await Promise.all(facts.jobs.map(async (row) => [row.record.path, await facts.snapshot.read(row.record.path)]))),
  };
  const changed = paths.filter((path) => snapshot.blob(path) !== prior.blobs.get(path));
  await snapshot.readMany(changed);
  const texts = new Map(await Promise.all(paths.map(async (path) => [path, changed.includes(path) ? await snapshot.read(path) : prior.texts.get(path)])));
  // The texts are held already: its readMany, which listJobs names the records to, reads nothing ahead.
  const serving = { ...snapshot, paths, read: (path) => Promise.resolve(texts.get(path) ?? null), readMany: () => Promise.resolve() };
  const products = [{ address: facts.address, snapshot: serving }];
  const first = await listJobs(products, new Map());
  const lives = await liveStatesOf(first, new Map([[facts.address, source.host]]), bridgesOf(first, store));
  return { jobs: await listJobs(products, lives), jobState: { snapshot, blobs: new Map(paths.map((path) => [path, snapshot.blob(path)])), texts } };
}

/**
 * readAgain({ target, cards, nodes, held, store }) -> void — starts the readings: one at the end of each interval, while `cards` — the <section class="cards"> drawn into `target` — is still a child of `target`.
 * `nodes` are the cards as drawn, in the order of the sources, and `held` the entries { source, facts, shares, current, model } of those among them that were read, at the same places (a hole for a card that
 * was not); after a reading the cards of `held` whose source has a token (`source.tokenStored`) are drawn again, in `nodes`, with the build of the rows read.
 */
export function readAgain({ target, cards, nodes, held, store }) {
  const reading = held.map((entry) => (entry?.source.tokenStored === true ? { entry, due: Date.now() + EVERY } : undefined));
  if (!reading.some(Boolean)) return;
  const problems = new Map();
  const problem = el("p", "warn reread-problem");
  const document = globalThis.document;
  let timer = null;
  const shown = () => [...target.children].includes(cards);
  const hidden = () => document?.visibilityState === "hidden";
  const schedule = () => {
    globalThis.clearTimeout(timer);
    timer = globalThis.setTimeout(tick, Math.max(0, Math.min(...reading.filter(Boolean).map((card) => card.due)) - Date.now()));
  };
  const resume = () => { if (!hidden()) return tick(); };
  document?.addEventListener?.("visibilitychange", resume);
  async function tick() {
    if (!shown()) { document?.removeEventListener?.("visibilitychange", resume); return; }
    if (hidden()) return;
    const now = Date.now();
    await Promise.all(reading.map(async (card, at) => {
      if (!card || card.due > now || card.busy) return;
      card.busy = true;
      const { source, facts, shares, current, model } = card.entry;
      try {
        const next = await jobsAgain(card.entry, store);
        card.entry.facts = { ...facts, jobs: next.jobs };
        card.entry.jobState = next.jobState;
        nodes[at] = productCard({ title: source.title, address: source.address, model, shares, current, build: buildInProgress(card.entry.facts), own: source.own === true, asOf: card.entry.asOf ?? null });
        problems.delete(at);
        card.due = now + EVERY;
      } catch (failure) {
        problems.set(at, `${source.title}: ${reasonOf(failure)}`);
        card.due = dueAfter(failure, now);
      } finally {
        card.busy = false;
      }
    }));
    problem.textContent = `The jobs' states could not be read again. ${[...problems.values()].join(" ")}`;
    cards.replaceChildren(...nodes, ...(problems.size ? [problem] : []));
    schedule();
  }
  schedule();
}
