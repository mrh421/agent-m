// sources.mjs — the sources of the main page's routes, and the live states of their jobs (MOD-main-page, Parts): shared by the routes `home` and `jobs`,
// apart from jobs.mjs, so that the start page reads its cards without the modules of the job page. MOD-runtimes is imported only where a job has not ended.
//
// Module: MOD-main-page

import { readSetting } from "../browser-store/index.mjs";
import { bridgeAt, settingsOf } from "../bridge-client/index.mjs";
import { parseAddress } from "../repository-hosts/index.mjs";
import { chosenProduct } from "../site-frame/index.mjs";

const runtimes = () => import("../runtimes/index.mjs");

// The sources of a route, each with the host the frame connected: the products this browser keeps (the setting `products`), each address that parses once, connected through MOD-site-frame's
// chosenProduct — with its own token to its own server only and with the stored secrets the host refuses to write —, and the instance's own (the ViewContext's) where the route lists it: always on the
// route `jobs`, and on the route `home` only while this browser keeps no product (then it is Agent M's own card). A product equal to a source already listed is not read again. A product the frame
// cannot connect is { address, reason }; one it can carries its host and whether a token is stored for it. `route` names the route whose address (`#<route>/product=…`) the frame connects the product for.
export async function sourcesOf(context, route = "jobs") {
  const { store, instance } = context;
  const own = parseAddress(`https://github.com/${instance.repository}`).web;
  const kept = [...new Set((readSetting(store, "products") ?? []).flatMap((text) => { try { return [parseAddress(text).web]; } catch { return []; /* an address that is none names no source */ } }))];
  const listsInstance = route === "jobs" || kept.length === 0;
  const products = await Promise.all(kept.filter((web) => !(listsInstance && web === own)).map(async (web) => {
    try {
      const product = await chosenProduct({ store, fragment: `#${route}/product=${encodeURIComponent(web)}` });
      return { address: web, host: product.host, tokenStored: product.tokenStored };
    } catch (failure) {
      return { address: web, reason: String(failure?.message ?? failure) };
    }
  }));
  return [...(listsInstance ? [{ address: own, host: instance.host, own: true }] : []), ...products];
}

// A handle for each Bridge a record's `by:` names that this browser keeps under `bridge:<name>`; a name it does not keep, or cannot reach through the jump host, has none.
export function bridgesOf(rows, store) {
  const bridges = {};
  for (const { record } of rows) {
    const name = record.taken?.by;
    if (record.end || !name || Object.hasOwn(bridges, name)) continue;
    try {
      const stored = readSetting(store, `bridge:${name}`);
      if (stored) bridges[name] = bridgeAt(settingsOf({ name, ...stored }, readSetting(store, "jump-host")));
    } catch { /* not a Bridge's name, or no jump host: the live state then says why it is not reachable */ }
  }
  return bridges;
}

// The live state of each job whose record has no end and whose source was read: a Map from the job's identifier. MOD-runtimes' liveStates is asked once for each repository, with the records of
// that repository, so that it lists the repository's runs of the job workflow once (MOD-main-page, Interfaces: `jobs`). A failure is the state `reachable: false` with its reason, for each job of
// that repository.
export async function liveStatesOf(rows, hostOf, bridges) {
  const lives = new Map();
  const byProduct = new Map();
  for (const row of rows) if (!row.record.end && row.source.reachable) byProduct.set(row.product, [...(byProduct.get(row.product) ?? []), row]);
  await Promise.all([...byProduct].map(async ([product, held]) => {
    try {
      for (const [id, live] of await (await runtimes()).liveStates(held.map((row) => row.record), { host: hostOf.get(product) }, bridges)) lives.set(id, live);
    } catch (failure) {
      for (const row of held) lives.set(row.record.id, { reachable: false, reason: String(failure?.message ?? failure), known: false });
    }
  }));
  return lives;
}
