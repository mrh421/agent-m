// checks.mjs — watchForAcceptance: the checks of one page (docs/architecture/MOD-notifications.md, Interfaces, Data).
// Every minute, whether a check is due: the switch on, the browser's permission granted, and this browser's last
// check five minutes old or older, or never run — so that a page opened after a pause checks at once (UC-047 2a). A
// due check reads the snapshot of the default branch of the instance and of each product this browser keeps, each
// with its own host — the instance's as the frame connected it, a product's as the frame's productHost gives it, through
// its own token and the secrets stored at each call (A CLEAR IS A REAL CLEAR; A TOKEN GOES ONLY TO THE SERVER THAT ISSUED IT) —, takes from each what waits for
// acceptance with waitingForAcceptance, and compares it with what was notified: up to three of one kind in one
// repository notified one by one, more than three by one notification of their number; the first check after the
// switch is turned on (`checked` still null) records what waits then and notifies nothing (A PERSON IS TOLD WHAT
// WAITS FOR THEIR ACCEPTANCE). A repository that cannot be read is skipped until the next check, its entries in
// `notified` kept as they were (UC-047 2c). Each repository's default branch is read once per page and its host kept
// for the page's whole life, so that a blob already read is not read again (MOD-notifications, Data; MOD-repository-
// hosts.repositoryInfo).
//
// Module: MOD-notifications

import { readSetting, writeSetting } from "../browser-store/index.mjs";
import { parseAddress } from "../repository-hosts/index.mjs";
import { currentRegistration } from "./permission.mjs";

const CHECK_EVERY_MS = 60 * 1000; // every minute, the page looks whether a check is due
const DUE_AFTER_MS = 5 * 60 * 1000; // this browser's last check five minutes old or older

// The review pages' route key a kind of waiting file is shown under (MOD-notifications, Data): the single-file row's
// "<k>/<id>" and the more-than-three row's "<k>", both built by the frame's own addressOf; a release test report's
// route is "release" regardless (MOD-test-pages' release panel).
const ROUTE_KEY = {
  "SPEC change": "spec-entry",
  "use case": "use-case",
  "architecture decision": "decision",
  module: "module",
  "release test report": "release",
};

// watchForAcceptance(page) -> void — started by the frame on the main and the review pages with this page's store,
// the instance as the frame connected it, productHost, and the frame's writing of a review-pages address (MOD-notifications,
// Interfaces). Throws nothing: a store the browser refuses holds no switch, and no check runs.
export function watchForAcceptance(page) {
  const repoState = new Map(); // repository path -> { host, defaultBranch }, kept for the page's whole life
  const run = () => { check(page, repoState).catch(() => {}); };
  run(); // a page opened after a pause checks at once (UC-047 2a), rather than waiting for the first minute
  globalThis.setInterval(run, CHECK_EVERY_MS);
}

// Whether a check is due now: the switch on, the browser's permission granted, and the last check never run or old
// enough.
function due(notifications) {
  if (!notifications) return false; // switched off
  if (globalThis.Notification?.permission !== "granted") return false;
  if (notifications.checked === null) return true;
  return Date.now() - new Date(notifications.checked).getTime() >= DUE_AFTER_MS;
}

async function check(page, repoState) {
  const { store } = page;
  const notifications = readSetting(store, "notifications");
  if (!due(notifications)) return;
  // What waits is read with MOD-progress-measures, imported only for a check that is due: a page with the switch off loads none of it.
  const { waitingForAcceptance } = await import("../progress-measures/index.mjs");

  const firstCheck = notifications.checked === null;
  const notifiedAll = readSetting(store, "notified") ?? {};
  const nextNotified = { ...notifiedAll };
  const products = readSetting(store, "products") ?? [];

  const targets = [
    { repository: page.instance.repository, makeHost: () => page.instance.host },
    ...products.map((url) => {
      const address = parseAddress(url);
      return { repository: address.path, makeHost: () => page.productHost(url) };
    }),
  ];

  for (const { repository, makeHost } of targets) {
    try {
      let entry = repoState.get(repository);
      if (!entry) { entry = { host: makeHost(), defaultBranch: null }; repoState.set(repository, entry); }
      if (entry.defaultBranch === null) entry.defaultBranch = (await entry.host.repositoryInfo()).defaultBranch;

      const snapshot = await entry.host.readSnapshot(entry.defaultBranch);
      const waiting = await waitingForAcceptance(entry.host, snapshot);
      nextNotified[repository] = Object.fromEntries(waiting.map((w) => [w.path, w.blob]));
      if (firstCheck) continue; // records what waits then, notifies nothing (A PERSON IS TOLD WHAT WAITS FOR THEIR ACCEPTANCE)

      const already = notifiedAll[repository] ?? {};
      const fresh = waiting.filter((w) => already[w.path] !== w.blob);
      for (const notice of noticesOf(fresh, repository, page.addressOf)) await show(notice);
    } catch {
      // a repository that cannot be read is skipped until the next check (UC-047 2c): its entries in `notified` stay
      // untouched, above, and nothing is notified for it this round.
    }
  }

  writeSetting(store, "notified", nextNotified);
  writeSetting(store, "notifications", { checked: new Date().toISOString() });
}

// Up to three of one kind notified one by one, by name and address; more than three by one notification of their
// number (MOD-notifications, Data).
function noticesOf(fresh, repository, addressOf) {
  const byKind = new Map();
  for (const item of fresh) {
    if (!byKind.has(item.kind)) byKind.set(item.kind, []);
    byKind.get(item.kind).push(item);
  }
  const notices = [];
  for (const [kind, items] of byKind) {
    const route = ROUTE_KEY[kind];
    if (items.length > 3) {
      notices.push({
        title: `${items.length} ${kind}s wait for your acceptance`,
        body: repository,
        tag: `${repository}:${kind}`,
        url: addressOf(route, {}, repository),
      });
    } else {
      for (const item of items) {
        notices.push({
          title: `${item.id} waits for your acceptance`,
          body: repository,
          tag: `${repository}:${item.path}:${item.blob}`,
          url: addressOf(route, { id: item.id }, repository),
        });
      }
    }
  }
  return notices;
}

async function show({ title, body, tag, url }) {
  let registration;
  try { registration = await currentRegistration(); } catch { return; }
  if (!registration) return;
  await registration.showNotification(title, { body, tag, data: { url } });
}
