// enclosures.mjs — the enclosure of an agent of this Bridge, or the refusal to start it (MOD-bridge-jobs, Data: No enclosure, no agent; ARC-054).
//
// Module: MOD-bridge-jobs
//
// NO MODEL READS A CREDENTIAL: the composing program gives the agents' enclosures, one per working folder. Without them, or where an agent's enclosure
// answers that it does not work, no process of that agent is started; the refusal names the enclosure's reason and its one-time step.

const refused = (message) => Object.assign(new Error(message), { name: "NotEnclosed" });

/**
 * enclosureOf(enclosures, folder) -> Promise<AgentEnclosure> — the working enclosure of the agent whose working folder is `folder`. Throws NotEnclosed,
 * naming why, where `enclosures` is not given or the enclosure does not work.
 */
export async function enclosureOf(enclosures, folder) {
  if (typeof enclosures !== "function") throw refused("no agent is started outside an enclosure, and this Bridge was composed without its agents' enclosures");
  const enclosure = enclosures(folder);
  const state = await enclosure.works();
  if (!state.works) throw refused(`the agent's enclosure does not work on this computer: ${state.reason} — the one-time step: ${state.setup}`);
  return enclosure;
}
