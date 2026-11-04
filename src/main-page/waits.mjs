// waits.mjs — what waits for a person, on the route `jobs` (docs/architecture/MOD-main-page.md, Parts and Interfaces: `jobs`): above the list of jobs, what waits across the instance — the open
// use cases, the open SPEC changes, the gates a person decides and the failed jobs of the instance and of each product this browser keeps —, each item with its kind and its identifier, its
// product where there are several sources, and a button to the page where it is decided. It also gives the reading of the overview stored for a repository's head, which the cards of the
// route `home` read too.
//
// Module: MOD-main-page
//
// PROGRESS AND JOB STATE ARE DERIVED, NOT STORED. The items are MOD-progress-measures' waitingForAPerson as it gives them, or as the overview stored for the commit holds them; this file adds nothing
// to them and drops nothing.
//
// Readings the module file leaves open, which this file takes (the pull request names the sentences they rest on):
//   - "Across the instance" covers the instance and each product it keeps. Each repository's list is read as its card on `home` reads its overview: the overview stored for the head
//     (MOD-progress-measures' storedOverview, one request), else the one stored last (latestOverview, two requests more), else waitingForAPerson of its facts of the scope `all`, read through
//     the host whose head's commit and tree the route has read already, so that they are not read again.

import { productFacts, waitingForAPerson, storedOverview, latestOverview } from "../progress-measures/index.mjs";
import { el } from "./cards.mjs";

/**
 * storedOf(snapshot) -> Promise<{ stored, asOf: string | null }> — the overview stored for the snapshot's commit, and asOf null; while that is not stored yet, the overview stored last
 * (latestOverview), and asOf its commit; { stored: null, asOf: null } for a repository that stores neither. Fails with the snapshot's host's errors but NotFound.
 */
export async function storedOf(snapshot) {
  const own = await storedOverview(snapshot);
  if (own) return { stored: own, asOf: null };
  const latest = await latestOverview(snapshot);
  return { stored: latest, asOf: latest ? latest.commit : null };
}

/**
 * waitingOf({ host, info, snapshot }, instance, instanceAt) -> Promise<Array<{ kind, id, path }>> — what waits for a person in one repository whose head `snapshot` was read through `host`, with
 * `info` its repository's information: the waiting of its stored overview (storedOf), else MOD-progress-measures' waitingForAPerson of its facts of the scope `all`, which take the instance's
 * snapshot — `instance()` gives it, and throws where the instance could not be read — and `instanceAt` as productFacts names them. Fails with the host's errors.
 */
export async function waitingOf({ host, info, snapshot }, instance, instanceAt) {
  const { stored } = await storedOf(snapshot);
  if (stored) return stored.waiting;
  const read = { ...host, repositoryInfo: () => Promise.resolve(info), readSnapshot: (ref) => (ref === snapshot.ref ? Promise.resolve(snapshot) : host.readSnapshot(ref)) };
  return waitingForAPerson(await productFacts(read, instance(), instanceAt, new Date(), { scope: "all" }));
}

// The route of the page where an item is decided, with its parameters: a route of the review pages (MOD-review-pages' `use-case` and `spec-entry`, MOD-implementation-pages' `process`) or this
// module's `job`. The frame's `go` adds nothing for a product the page does not choose, so the product's address is handed in.
function placeOf({ kind, id, path }) {
  if (kind === "use case") return ["use-case", { id }];
  if (kind === "SPEC change") return ["spec-entry", { id }];
  if (kind === "failed job") return ["job", { id }];
  const job = /^docs\/jobs\/(JOB-[^/]+)\.md$/.exec(path);
  return job ? ["job", { id: job[1] }] : ["process", {}];
}

/**
 * waitsList(items, { several }) -> Element — a <section class="waits"> with an <h2> and, for each of `items` — { kind, id, path, product } —, an <li class="wait"> naming its kind and its
 * identifier, and `product` where `several` says there is more than one source. Each item is also a <button class="wait-link"> that calls `go(route, params)` of the ViewContext for the page
 * where it is decided, with `product` — the item's address — among the params unless the item is Agent M's own (`own`). Without an item it says that nothing waits for a person.
 */
export function waitsList(items, { several, go }) {
  const section = el("section", "waits", el("h2", null, "What waits for a person"));
  if (items.length === 0) {
    section.append(el("p", "muted", "Nothing waits for a person."));
    return section;
  }
  const list = el("ul", "wait-items");
  for (const item of items) {
    const { kind, id, path, product, address, own } = item;
    const [route, params] = placeOf(item);
    const open = el("button", "wait-link btn small", "Open");
    open.setAttribute("type", "button");
    open.addEventListener("click", () => go(route, own ? params : { ...params, product: address }));
    const line = el("li", "wait", el("span", "wait-kind", kind), ": ", el("strong", null, id));
    if (several && product) line.append(" ", el("span", "wait-product", `· ${product}`));
    line.append(" ", open);
    line.setAttribute("data-path", path);
    list.append(line);
  }
  section.append(list);
  return section;
}
