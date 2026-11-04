// routing.mjs — views by the address's fragment, and the address of a route for a repository (docs/architecture/MOD-site-frame.md,
// Parts). The fragment reads `#<route>/<key>=<value>/…`, every part percent-encoded; the parameter `product` names the chosen
// product by its address. Also here: the product that the fragment names, and the one place that loads a view module by its slug.
//
// Module: MOD-site-frame
// It uses MOD-browser-store (readSetting, secretValues) and MOD-repository-hosts (parseAddress, connect) through their index.mjs.
// Private to the module: index.mjs and start.mjs use it.

import { readSetting, secretValues } from "../browser-store/index.mjs";
import { parseAddress, connect } from "../repository-hosts/index.mjs";

const partsOf = (fragment) => String(fragment ?? "").replace(/^#/, "").split("/").filter(Boolean);

// routeOf(fragment) -> { name, params } — the first part is the route's name, the others `key=value` are its parameters.
export function routeOf(fragment) {
  const [name = "", ...given] = partsOf(fragment);
  const params = {};
  for (const part of given) {
    const at = part.indexOf("=");
    if (at > 0) params[decodeURIComponent(part.slice(0, at))] = decodeURIComponent(part.slice(at + 1));
  }
  return { name: decodeURIComponent(name), params };
}

// fragmentOf(route, params) -> the fragment that routeOf reads back as the same route and parameters.
export function fragmentOf(route, params = {}) {
  const supplied = Object.entries(params).map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
  return `#${[route, ...supplied].join("/")}`;
}

// productOf(fragment) -> the address the fragment's `product` names, or null when it names none (the instance itself).
export function productOf(fragment) {
  return routeOf(fragment).params.product ?? null;
}

// addressWriter(page, pageAddress, instance, products) -> (route, params, repository) -> string — the writing of the address of
// a route of the review pages for a repository: the instance's, or a product this browser keeps, which is named in the fragment by
// its address. `pageAddress` is the address of the page that writes ("main" or "review"); the main page's review pages stand at
// docs/index.html beside it. MOD-notifications' watchForAcceptance is handed the function this returns.
export function addressWriter(page, pageAddress, instance, products) {
  const here = String(pageAddress).split("#")[0];
  const review = page === "review" ? here : new URL("docs/index.html", here).href;
  return (route, params, repository) => {
    const product = repository === instance ? null
      : products.map((address) => parseAddress(address)).find((address) => address.path === repository)?.web ?? null;
    return `${review}${fragmentOf(route, product ? { ...params, product } : params)}`;
  };
}

// The key a product's own token is kept under (MOD-browser-store, Data).
export const tokenKeyOf = (address) => address.server === "gitlab" ? `gitlab-token:${new URL(address.origin).host}/${address.path}` : `github-token:${address.path}`;

// The host of each product this page has connected, by the store and the product's address: a navigation that keeps the product keeps its host, so that
// the blobs the host has read are not read again (MOD-repository-hosts keeps them for as long as a host it returned is used). A host is replaced when the
// product's token or any stored secret changed since it was connected (A CLEAR IS A REAL CLEAR; NO SECRET IN THE REPOSITORY).
const connected = new WeakMap();

function hostOf(store, address, token) {
  const secrets = secretValues(store);
  const stamp = JSON.stringify([token?.value ?? null, token?.name ?? null, secrets]);
  const held = connected.get(store) ?? new Map();
  connected.set(store, held);
  const had = held.get(address.web);
  if (had && had.stamp === stamp) return had.host;
  const host = connect(address, { token: token?.value ?? null, tokenName: token?.name ?? null, secrets });
  held.set(address.web, { stamp, host });
  return host;
}

// chosenProduct({ store, fragment }) -> Promise<ProductContext | null> — the product the fragment names among those this browser
// keeps, connected with its own token to its own server only, with `tokenStored` true when that token is kept; null when the
// fragment names none. Throws UnknownProduct { address }
// for a product this browser does not keep.
export async function chosenProduct({ store, fragment }) {
  const named = productOf(fragment);
  if (named === null) return null;
  const kept = (readSetting(store, "products") ?? []).map((address) => { try { return parseAddress(address); } catch { return null; } });
  let wanted = null;
  try { wanted = parseAddress(named).web; } catch { /* not an address: no product is kept under it */ }
  const address = kept.find((candidate) => candidate && candidate.web === wanted);
  if (!address) throw Object.assign(new Error(`This browser does not keep the product ${named}.`), { name: "UnknownProduct", address: named });
  const token = readSetting(store, tokenKeyOf(address));
  const host = hostOf(store, address, token);
  return { address: address.web, kind: address.server, host, tokenStored: token !== null };
}

// instanceHostFollowingStore({ store, address }) -> Host — the instance's host for the pages, which hand it to every route for the page's
// whole life: each call of its functions goes through a host connected with the GitHub token and the secrets stored at that moment,
// a new one when the token or a secret was stored, replaced or cleared since (A CLEAR IS A REAL CLEAR; NO SECRET IN THE REPOSITORY).
// The connection passes every option the frame's connection passes: token, tokenName and secrets.
export function instanceHostFollowingStore({ store, address }) {
  let held = null;
  let heldFor = null;
  const current = () => {
    const token = readSetting(store, "github-token");
    const secrets = secretValues(store);
    const stored = JSON.stringify([token?.value ?? null, token?.name ?? null, secrets]);
    if (held === null || stored !== heldFor) {
      held = connect(address, { token: token?.value ?? null, tokenName: token?.name ?? null, secrets });
      heldFor = stored;
    }
    return held;
  };
  return following(current);
}

// A host whose every function calls through the connection `current()` gives at that call.
function following(current) {
  return Object.freeze(Object.fromEntries(Object.entries(current()).map(([name, member]) =>
    [name, typeof member === "function" ? (...given) => current()[name](...given) : member])));
}

// productHostFollowingStore({ store }) -> (product: string) -> Host — the host of a product by its entry in `products`, handed to
// MOD-notifications' watchForAcceptance: each call of its functions goes through the connection made with the product's own token and the
// secrets stored at that moment (the connection the frame's chosenProduct makes), so that a token cleared or replaced since is not
// used (A CLEAR IS A REAL CLEAR; NO SECRET IN THE REPOSITORY). One host for each product, however often it is asked for.
export function productHostFollowingStore({ store }) {
  const hosts = new Map();
  return (product) => {
    const address = parseAddress(product);
    if (!hosts.has(address.web)) hosts.set(address.web, following(() => hostOf(store, address, readSetting(store, tokenKeyOf(address)))));
    return hosts.get(address.web);
  };
}

// viewAddress(slug) -> the address of a view module: `../<slug>/routes.mjs`, relative to the folder of the frame — the view's routes, whose
// strategies it imports only for a job (View: loadStrategies); preloads.mjs names the same address in an entry page's block.
const viewAddress = (slug) => new URL(`../${slug}/routes.mjs`, import.meta.url).href;
export { viewAddress };

// loadView(slug) -> Promise<View> — the `view` a view module provides. Rejects with the loader's error for a module that is not served.
export async function loadView(slug) {
  return (await import(viewAddress(slug))).view;
}

// What each route `module` of the page loads beyond the page's preloads, as the page's block holds it (preloads.mjs, the element
// `route-preloads`): by route name, its modules and the files they fetch, as paths relative to the page. Read once; a page without it,
// or with it empty, or outside a browser, has none.
let routeData = null;
function routePreloads(name) {
  if (routeData === null) {
    const element = globalThis.document?.getElementById?.("route-preloads") ?? null;
    routeData = element?.textContent ? JSON.parse(element.textContent) : {};
  }
  return routeData[name] ?? { modules: [], files: [] };
}

// The links the frame has put in the page's head, by address, so that each file is asked for once.
const linked = new Set();
function preloadLink(href, attributes) {
  if (linked.has(href) || !globalThis.document?.head) return;
  linked.add(href);
  const link = document.createElement("link");
  for (const [name, value] of Object.entries(attributes)) link.setAttribute(name, value);
  link.setAttribute("href", href);
  document.head.append(link);
}

// loadRoute(route) -> Promise<Route> — the route the frame shows, embeds or asks for its subject (MOD-site-frame's Route `module`): for a route that
// names `module`, every module and file it loads beyond the page's preloads asked for at once — a `modulepreload` and a `preload` link each —, then
// the route `module` gives; any other route as it is. Rejects with the loader's error for a route file that is not served.
export async function loadRoute(route) {
  if (typeof route?.module !== "function") return route;
  const { modules, files } = routePreloads(route.name);
  for (const href of modules) preloadLink(href, href.endsWith(".json") ? { rel: "modulepreload", as: "json" } : { rel: "modulepreload" });
  for (const href of files) preloadLink(href, { rel: "preload", as: "fetch", crossorigin: "" });
  return route.module();
}
