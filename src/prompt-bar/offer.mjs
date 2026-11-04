// MOD-prompt-bar, offer.mjs — the endpoints and CLI sessions offered, read from this browser's configuration, and the place each is named with
// (docs/architecture/MOD-prompt-bar.md: Parts, Interfaces: startPromptBar). This browser's own endpoints that declare a place, a context and a model
// (endpointsOffered), and whether one runs through GitHub Actions (throughActions); and the CLI sessions this browser's Bridges offer, each agent a
// Bridge kept under `bridge:<name>` lists ready, whose `session:<bridge>:<agent>` declares a place, a context and a model (sessionsOffered) (UC-049
// Precondition, 1, 1a, 1b). No participant list is read for the offer. readParticipants and offeredAmong read the rows of the instance's
// docs/participants.md, which the job's preparation and a hand-over's route take (send.mjs, hand-over.mjs).
//
// Module: MOD-prompt-bar
//
// It reads settings of the store and the register of the instance, and sessionsOffered asks each Bridge the store keeps MOD-bridge-client's testBridge,
// its two requests `GET /v1/pair` and `GET /v1/agents`; it writes nothing.

import { listSettings, readSetting } from "../browser-store/index.mjs";
import { bridgeAt, settingsOf, testBridge } from "../bridge-client/index.mjs";
import { readRegister } from "../documents/index.mjs";
import { participantSchema, participantsOf, reachedThrough } from "../participant-list/index.mjs";

const REGISTER = "docs/participants.md";
const OFFERED_TYPES = new Set(["model endpoint", "CLI agent", "sandboxed agent"]);

/** The one kind every message of the bar runs, on every page (MOD-prompt-bar, Responsibility; UC-049 step 3). */
export const BAR_KIND = "converse";

/**
 * readParticipants(snapshot: Snapshot) -> Promise<Participant[]> — the participants of the instance's register at that snapshot, in its
 * order; none for an instance without the register.
 */
export async function readParticipants(snapshot) {
  const text = await snapshot.read(REGISTER);
  return text === null ? [] : participantsOf(readRegister(participantSchema(), REGISTER, text).document);
}

// Whether this browser reaches the participant by its route: the endpoint it names, and the Bridge that endpoint is called through, or the
// Bridge its agent is on, are among what the store keeps.
function reached(participant, store) {
  const route = participant.route ?? "";
  const endpoint = /^endpoint\s+(\S+)/.exec(route)?.[1];
  if (endpoint !== undefined) {
    const stored = readSetting(store, `endpoint:${endpoint}`);
    if (!stored) return false;
    return !stored.bridge || readSetting(store, `bridge:${stored.bridge}`) !== null;
  }
  const bridge = /^bridge\s+(\S+)\s+agent\s+\S+/.exec(route)?.[1];
  return bridge !== undefined && readSetting(store, `bridge:${bridge}`) !== null;
}

/**
 * offeredAmong(participants: Participant[], store: Store) -> Participant[] — the participants the bar offers, in the register's order.
 */
export function offeredAmong(participants, store) {
  return participants.filter((participant) => OFFERED_TYPES.has(participant.type) && reachedThrough(participant) === null
    && reached(participant, store));
}

/**
 * placeOf(participant: Participant) -> string — where the participant processes data, as the selector names it; a participant whose row
 * declares none is named as having none, never left unnamed (THE PAGE NAMES WHERE IT SENDS).
 */
export const placeOf = (participant) => participant.place ?? "no processing place declared";

/**
 * endpointsOffered(store: Store) -> Participant[] — this browser's model endpoints (`endpoint:<name>`, in the store's order) whose configuration
 * declares a place, a context and a model, each in MOD-participant-list's Participant shape (MOD-prompt-bar, Interfaces: startPromptBar): the type
 * *model endpoint*, its model, the capabilities *draft text* and *read the repository*, and *use tools* where its last test found that the model calls
 * tools, its context and place, and the route `endpoint <name>`, with ` secret <NAME>` where it names the CI secret of its key. One that lacks a place,
 * a context or a model is not offered (UC-049 1b), nor one named through a Bridge this browser does not keep.
 */
export function endpointsOffered(store) {
  const offered = [];
  for (const { key } of listSettings(store)) {
    if (!key.startsWith("endpoint:")) continue;
    const name = key.slice("endpoint:".length);
    const setting = readSetting(store, key);
    if (!setting || typeof setting !== "object") continue;
    if (endpointLacks(setting).length) continue;
    const place = setting.place.trim();
    const context = Number(setting.context);
    const model = setting.model.trim();
    if (setting.bridge && readSetting(store, `bridge:${setting.bridge}`) === null) continue;
    const tools = readSetting(store, `last-test:${key}`)?.tools === true;
    const secret = typeof setting.secret === "string" && /^[A-Za-z_][A-Za-z0-9_]*$/.test(setting.secret) ? setting.secret : null;
    offered.push({ name, type: "model endpoint", model, context, price: null, place,
      capabilities: ["draft text", "read the repository", ...(tools ? ["use tools"] : [])],
      route: `endpoint ${name}${secret ? ` secret ${secret}` : ""}` });
  }
  return offered;
}

/**
 * sessionsOffered(store: Store) -> Promise<Participant[]> — the CLI sessions this browser's Bridges offer (MOD-prompt-bar, Interfaces: startPromptBar): for each
 * Bridge the store keeps under `bridge:<bridge>`, in the store's order, each agent MOD-bridge-client's testBridge lists ready whose `session:<bridge>:<agent>`
 * declares a place, a context and a model (endpointLacks finds nothing lacking), in MOD-participant-list's Participant shape: named `<bridge>:<agent>`, as its
 * setting is, the type *CLI agent*, the model, context, place and capabilities the declaration gives, and the route `bridge <bridge> agent <agent>`. One that
 * lacks a place, a context or a model is not offered (UC-049 1b). A Bridge that cannot be tested — no answer, a refused token, no jump host stored for one at a
 * port — offers none, and is not named here: the settings page tests it where it is configured. Crosses the network: testBridge's two requests per Bridge kept.
 */
export async function sessionsOffered(store) {
  const offered = [];
  for (const { key } of listSettings(store)) {
    if (!key.startsWith("bridge:")) continue;
    const bridge = key.slice("bridge:".length);
    const stored = readSetting(store, key);
    if (!stored || typeof stored !== "object") continue;
    let agents;
    try {
      agents = (await testBridge(bridgeAt(settingsOf({ name: bridge, ...stored }, readSetting(store, "jump-host"))))).agents;
    } catch {
      continue;
    }
    for (const agent of Array.isArray(agents) ? agents : []) {
      if (agent?.ready !== true || typeof agent.name !== "string") continue;
      const declared = readSetting(store, `session:${bridge}:${agent.name}`);
      if (!declared || typeof declared !== "object" || endpointLacks(declared).length) continue;
      const capabilities = Array.isArray(declared.capabilities) ? declared.capabilities.filter((each) => typeof each === "string") : [];
      offered.push({ name: `${bridge}:${agent.name}`, type: "CLI agent", model: declared.model.trim(), context: Number(declared.context), price: null,
        place: declared.place.trim(), capabilities, route: `bridge ${bridge} agent ${agent.name}` });
    }
  }
  return offered;
}

/**
 * endpointLacks(setting: object) -> string[] — what an endpoint's configuration, or a CLI session's declaration, lacks for the bar to offer it (UC-049 1b), each as
 * the settings page names it: the place where it processes data, its context in tokens, its model; empty when it lacks nothing.
 */
export function endpointLacks(setting) {
  const text = (value) => (typeof value === "string" ? value.trim() : "");
  const context = Number(setting?.context);
  return [!text(setting?.place) && "the place where it processes data", !(Number.isInteger(context) && context > 0) && "its context in tokens",
    !text(setting?.model) && "its model"].filter(Boolean);
}

/**
 * throughActions(participant: Participant, store: Store) -> boolean — whether a message to the participant runs through GitHub Actions: a model endpoint of
 * this browser whose configuration names the CI secret of its key and no Bridge, so that the tab does not call it and its work is
 * spawned as a job (UC-049 4a); the bar's button then reads *Spawn job*.
 */
export function throughActions(participant, store) {
  const name = /^endpoint\s+(\S+)\s+secret\s+\S+$/.exec(String(participant?.route ?? "").trim())?.[1];
  if (name === undefined) return false;
  const setting = readSetting(store, `endpoint:${name}`);
  return Boolean(setting?.secret) && !setting.bridge;
}
