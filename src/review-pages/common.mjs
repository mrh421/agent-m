// common.mjs — what the review pages of every kind share (MOD-review-pages, Parts): the elements of a page, the token this browser stores for the
// page's product and the kind of server a product is on.
//
// Module: MOD-review-pages

import { readSetting } from "../browser-store/index.mjs";
import { parseAddress } from "../repository-hosts/index.mjs";
import { readProblem, tokenKeyOf } from "../site-frame/index.mjs";
import { openEditor as openMarkdownEditor } from "../markdown-render/index.mjs";

// The panel's words for a refusal it shows: the refusal as MOD-spec-changes states it and, for two candidates that change one requirement (TwoChanges), how to go on — one of them can be
// made `new`, or the two merged.
export const refusalText = (failure) => `${failure.name}: ${failure.message}${failure.name === "TwoChanges" ? " To go on, give one of the two the class new, or merge them into one." : ""}`;

export const TOKEN_STEP = "#add";

// The line above the other proposals while they are of an earlier commit than the page's (MOD-progress-measures' waitingQueues, `asOf`), or null when they are of its own.
export const asOfLine = (asOf) => (asOf ? el("p", "muted as-of", `As of ${asOf.slice(0, 7)}: the overview of the newest commit is being stored.`) : null);

export function el(name, className, ...children) {
  const node = document.createElement(name);
  if (className) node.className = className;
  node.append(...children);
  return node;
}
// The status badge of a file or an entry: the class `b-<status>` is the one the frame's look colours (src/site-frame/look.css). A SPEC entry in the state
// "in SPEC" (status `in-SPEC`) is coloured by the rule `b-applied`.
const STYLED_AS = { "in-SPEC": "applied" };
export const badge = (status, text) => el("span", `badge b-${STYLED_AS[status] ?? status}`, text);
export const link = (href, className, text) => {
  const a = el("a", className, text);
  a.setAttribute("href", href);
  return a;
};
// The address of a route of the review pages as the page `context` shows it: `fragment` is the route's fragment with its leading `#`; on a product's page it ends in
// `/product=<the product's address, percent-encoded>`, the form MOD-site-frame's `chosenProduct` reads back, and on the instance's own page it is `fragment` itself.
export const reviewHref = (context, fragment) => (context.product ? `${fragment}/product=${encodeURIComponent(context.product.address)}` : fragment);
// A link to a route of the review pages that keeps the page's product.
export const reviewLink = (context, fragment, className, text) => link(reviewHref(context, fragment), className, text);
// The group kind whose arrangement a kind's list and its editor link (UC-021, UC-018 3e): the route `arrange` with the parameter `kind`.
const ARRANGED = { requirement: "requirements", "use-case": "use-cases", "architecture-decision": "architecture", module: "modules" };
// The link to the arrangement of `kind`'s group kind, keeping the page's product; null for a kind no group file arranges.
export const arrangeLink = (context, kind) => (ARRANGED[kind.kind] ? reviewLink(context, `#arrange/kind=${ARRANGED[kind.kind]}`, "arrange-link", "Arrange") : null);
// A listener that answers only a click the browser marks as a person's (`isTrusted`): the dashboard writes only as the direct result of a
// person's action (THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK), and a click a script makes is none.
export const byPerson = (listener) => (event) => (event?.isTrusted === true ? listener(event) : undefined);
// Makes the click listeners added to `node` listeners of a person's click only.
function answerPersonOnly(node) {
  const add = node.addEventListener.bind(node);
  node.addEventListener = (type, listener, ...rest) => add(type, type === "click" ? byPerson(listener) : listener, ...rest);
  return node;
}
// A button of the pages: it answers a person's click only.
export const button = (className, text) => {
  const b = answerPersonOnly(el("button", className, text));
  b.type = "button";
  return b;
};

/**
 * openEditor(target, text, options) — MOD-markdown-render's editor, whose Save answers a person's click only. The editor makes its Save button
 * itself and calls `save` in that button's click listener, so the buttons it makes while it opens are made to answer a person's click only.
 */
export function openEditor(target, text, options) {
  const make = document.createElement;
  document.createElement = function (name, ...rest) {
    const node = make.call(this, name, ...rest);
    return name === "button" ? answerPersonOnly(node) : node;
  };
  try {
    return openMarkdownEditor(target, text, options);
  } finally {
    document.createElement = make;
  }
}

// The link to the step that stores the token of the page's product: a link of the route `add-product`, which the frame's `go` reaches — the
// address of that route is the frame's to write (MOD-site-frame, ViewContext) —, with the product's address when the page shows a product.
export function tokenStep(context, text = "Store the token") {
  const a = link(context.product ? `${TOKEN_STEP}/${encodeURIComponent(context.product.address)}` : TOKEN_STEP, "token-step", text);
  a.addEventListener("click", (event) => {
    event?.preventDefault?.();
    context.go("add-product", context.product ? { address: context.product.address } : {});
  });
  return a;
}

// Without a token, an edit is made on GitHub: the text goes on the clipboard and GitHub's editor opens for the file, with only the path in the
// address (WITHOUT A TOKEN, GITHUB'S WEB INTERFACE IS THE FALLBACK, NO TEXT TRAVELS IN A URL). A browser that refuses the clipboard or the window
// leaves the page's link and text to do it by hand. `page` is one of MOD-artifact-edits' fallback pages: { url, text }.
export async function openGithubEditor(page) {
  try { await globalThis.navigator?.clipboard?.writeText?.(page.text); } catch { /* the text is on the page */ }
  try { globalThis.open?.(page.url, "_blank", "noopener"); } catch { /* the link is on the page */ }
}

// The token this browser stores for the page's product — its own, never the instance's (A GITHUB PRODUCT USES A TOKEN OF ITS OWN) —,
// or, on the page that shows the instance itself, the instance's.
export function storedToken(context) {
  const keys = [];
  try {
    if (context.product) keys.push(tokenKeyOf(parseAddress(context.product.address)));
    else keys.push("github-token");
    for (const key of keys) {
      const token = readSetting(context.store, key);
      if (token) return { name: token.name ?? "a reviewer" };
    }
  } catch { /* a store that cannot be read holds no token */ }
  return null;
}

export const parseServer = (context) => { try { return parseAddress(context.product.address).server; } catch { return null; } };

/** defaultSnapshot(host) — the repository at its default branch now. */
export async function defaultSnapshot(host) {
  const { defaultBranch } = await host.repositoryInfo();
  return host.readSnapshot(defaultBranch);
}

/**
 * handedPlace() — what a route keeps of the repository it draws: the snapshot the frame hands its `reads` (MOD-site-frame's Route: "the repository the route
 * shows as the frame has read it for the page"), which the frame calls before `render`, and the commit a decision written on the page named. `reads` keeps the
 * snapshot and names no file of its own: the frame's first wave reads them. `take()` gives the render that follows `reads` that snapshot, a render after a write
 * the commit the write named (MOD-review-pages, `<k>/<id>`: "drawn again with the commit named"), and any other render nothing.
 */
export function handedPlace() {
  let handed = null, written = null;
  return {
    reads: async (_params, snapshot) => { handed = snapshot; written = null; return []; },
    wrote: (commit, context) => { written = { commit, context }; },
    take: (context) => {
      const given = handed ? { snapshot: handed } : written?.context === context ? { commit: written.commit } : null;
      handed = null;
      written = null;
      return given;
    },
  };
}

// The snapshot a route draws from: the one the frame handed it; after a write on the page drawn in `context`, the commit the write named; otherwise — a
// route the frame did not hand one, or a page drawn again after a decision that wrote nothing — the default branch now.
async function snapshotOf(host, place, context) {
  const given = place?.take(context) ?? null;
  if (given?.snapshot) return given.snapshot;
  if (given?.commit) return host.readSnapshot(given.commit);
  return defaultSnapshot(host);
}

// The page's host as the route's decisions write through it: each commit it makes is the commit the page is drawn again with.
const notingWrites = (host, place, context) => (place && typeof host.commitFiles === "function"
  ? { ...host, commitFiles: async (change) => { const made = await host.commitFiles(change); if (made?.commit) place.wrote(made.commit, context); return made; } }
  : host);

/**
 * readPlace(target, context, place) — what every route reads before it draws: the host of the page's repository (the product's, else the instance's), the token this
 * browser stores for it, and the snapshot the route draws from (`place`, handedPlace). Returns { host, token, snapshot, context, target } with `target` emptied; a read
 * that fails draws the problem into `target` and returns null.
 */
export async function readPlace(target, context, place = null) {
  const shown = (context.product ?? context.instance).host;
  const host = notingWrites(shown, place, context);
  const token = storedToken(context);
  target.replaceChildren();
  try {
    return { host, token, snapshot: await snapshotOf(shown, place, context), context, target };
  } catch (failure) {
    target.append(readProblem(failure, Boolean(token)));
    return null;
  }
}
