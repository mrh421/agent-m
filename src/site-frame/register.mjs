// register.mjs — the strategies of the views a page loads, and the prompt bar's, registered with the job runner once per load (docs/architecture/MOD-site-frame.md).
//
// Module: MOD-site-frame
//
// It uses MOD-job-runner (registerStrategies, registerLater) and MOD-prompt-bar (loadHandOverStrategies) through their index.mjs; a view's strategies and the bar's are imported
// only when the runner first looks a strategy up (registerLater), so that a page loads their modules only for a job. A set is registered once per load, however many views or the
// bar hand it: a set object already registered on this load is skipped. A second evaluation in one process finds its sets registered, and a DuplicateStrategy whose first
// owner is the owner now registering counts as a set already registered and is skipped; any other DuplicateStrategy is thrown.

import { registerStrategies, registerLater } from "../job-runner/index.mjs";

const handled = new Set();
function registerOnce(owner, strategies) {
  if (handled.has(strategies)) return;
  try {
    registerStrategies(owner, strategies);
  } catch (error) {
    if (error.name !== "DuplicateStrategy" || error.owners[0] !== owner) throw error;
  }
  handled.add(strategies);
}

/**
 * registerViews(views: Array<[slug: string, view: View]>) -> void — every strategy set of the views, each under its view's slug, and the prompt bar's hand-over sets, so that a
 * job any route of the page prepares finds every recipe, check and writer of the page's views, whichever route the page shows first. A view gives its sets as `strategies`, or
 * as `loadStrategies`, which imports them; those, and the bar's, are registered before the runner first looks a strategy up.
 */
export function registerViews(views) {
  for (const [slug, view] of views) {
    for (const strategies of view.strategies ?? []) registerOnce(slug, strategies);
    if (typeof view.loadStrategies === "function") registerLater(async () => { for (const strategies of await view.loadStrategies()) registerOnce(slug, strategies); });
  }
  registerLater(async () => {
    const { loadHandOverStrategies } = await import("../prompt-bar/index.mjs");
    for (const strategies of await loadHandOverStrategies()) registerOnce("MOD-prompt-bar", strategies);
  });
}
