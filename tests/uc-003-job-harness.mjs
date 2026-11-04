// The prompt bar of UC-003 (Configure a model endpoint), the way a job's request reaches the endpoint the author configured: tests/uc-003-harness.mjs configures an endpoint on Settings (the real dashboard), and this file opens the
// page that holds the prompt bar (tests/uc-019-prompt-bar-harness.mjs' `scenario`: MOD-site-frame's real `startPage` over the real MOD-prompt-bar, MOD-job-runner and MOD-runtimes) over the very records Settings stored in
// localStorage — the endpoint's record and the Bridges' — and lets the person send a message, which is a job of the kind `converse`. The Bridge is the real composed program of tests/uc-003-harness.mjs; the page's
// request to the Bridge's address is passed on to it with the Origin header a browser adds. Nothing reaches the network. It holds no test and no expected result.
// Imported by tests/system-uc-003-a-job-through-the-bridge.test.mjs and tests/release-uc-003-a-job-through-the-https-route.test.mjs.
//
// Module: MOD-prompt-bar
// Module: MOD-runtimes
// Module: MOD-site-frame
// Level: system
//
// Authored by developer-sonnet-k (ITM-266). The page of the prompt bar opens its Bridges at the loopback address http://127.0.0.1:9418, the only Bridge address its fixture network lets through: the address of the
// stored Bridge record is replaced by it and its requests are passed on to the real Bridge (`forward`), and nothing else of the records changes. A Bridge reached through the jump host's HTTPS address (UC-044) keeps its record as
// Settings stored it, and `forward` stands for the jump host's web server in front of the real Bridge, as tests/release-uc-003-dashboard-https-bridge.test.mjs' controlled proxy does.

import { all, barOf, one, outside, scenario, send, statusOf } from "./uc-019-prompt-bar-harness.mjs";
import { ORIGIN, PREFIX, nativeFetch } from "./uc-003-harness.mjs";

export { all, barOf, one, outside, statusOf };
/** The lines of the bar's conversation, as the person reads them. */
export const conversationLines = (s) => all(barOf(s), "li").filter((node) => node.parentNode?.className === "conversation").map((node) => node.textContent);
// The page the bar is drawn on is the fixture DOM of the review pages; the dashboard's harness replaces the globals, so they are put back before the bar's page is opened.
const bar = { document: globalThis.document, window: globalThis.window, setInterval: globalThis.setInterval };
const FIXTURE_BRIDGE = "http://127.0.0.1:9418";

/** recordsOf(entries) -> { key: value } — the settings (`endpoint:*`, `bridge:*`, `jump-host`, `last-test:*`) of a dump of localStorage, parsed, without the instance's prefix. */
export function recordsOf(entries) {
  const records = {};
  for (const [key, value] of Object.entries(entries)) if (key.startsWith(PREFIX) && !/^(github-token|products)/.test(key.slice(PREFIX.length))) records[key.slice(PREFIX.length)] = JSON.parse(value);
  return records;
}

/**
 * barOver(records, { forward }) -> Promise<{ s, seen }> — the prompt bar's page over `records` (the Bridge records at the fixture address) with no other endpoint and no other Bridge. `forward(url, init)` answers the page's requests to the
 * Bridge, passing them on to the real one; `seen` holds each request the page sent to the Bridge, `{ method, path, headers, body }`.
 */
export async function barOver(records, { forward }) {
  Object.defineProperty(globalThis, "document", { configurable: true, writable: true, value: bar.document });
  Object.defineProperty(globalThis, "window", { configurable: true, writable: true, value: bar.window });
  globalThis.setInterval = bar.setInterval;
  const seen = [];
  const settings = Object.fromEntries(Object.entries(records).map(([key, value]) => [key, key.startsWith("bridge:") && typeof value.address === "string" ? { ...value, address: FIXTURE_BRIDGE } : value]));
  const s = await scenario({ drafting: false, keepBridge: false, settings, bridgeFetch: async (url, init) => {
    seen.push({ method: init.method ?? "GET", path: url.pathname, headers: { ...init.headers }, body: init.body ?? null });
    return forward(url, init);
  } });
  return { s, seen };
}

/**
 * inFrontOf(front) -> restore — the page's fetch asks `front(url, init)` first (a handler answering a Response, or null): the jump host's web server at its HTTPS address, which the prompt bar's fixture network does not otherwise let through.
 * Whatever page opens afterwards sets its own fetch behind it; `restore()` puts the plain fetch back.
 */
export function inFrontOf(front) {
  let behind = globalThis.fetch;
  Object.defineProperty(globalThis, "fetch", { configurable: true, get: () => async (input, init = {}) => {
    const url = new URL(typeof input === "object" && !(input instanceof URL) ? input.url : String(input));
    return (await front(url, init)) ?? behind(input, init);
  }, set: (fetcher) => { behind = fetcher; } });
  return () => Object.defineProperty(globalThis, "fetch", { configurable: true, writable: true, value: behind });
}

/** toTheBridge(bridge) -> forward — the page's request to the fixture address, passed on to the real Bridge at its address with the Origin header a browser adds. */
export const toTheBridge = (bridge) => (url, init) => nativeFetch(`${bridge.address}${url.pathname}${url.search}`, { ...init, headers: { ...init.headers, Origin: ORIGIN } });

/** sendMessage(s, participant, text) — the person chooses `participant` in the bar, writes `text` and presses Send; resolves once the bar is free again. */
export const sendMessage = (s, participant, text) => send(s, text, { participant });
