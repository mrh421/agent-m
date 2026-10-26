// subject.mjs — the subject of the route shown, its own or the frame's default, with the menu entry of the page shown, the one the menu marks
// (docs/architecture/MOD-site-frame.md, Parts and Interfaces: Route). MOD-prompt-bar's `Subject` says what a message in the prompt bar is
// about; a route gives it with `subject(params, context)`, and a route that gives none, or whose `subject` gives `null`, has the frame's default below. Whichever gives
// the subject, its `entry` is the entry of the page shown (entryShownOf): the route's `entryShown(params)` where it gives one that is not `null`, else the
// route's `entry`, `null` for a route out of the menu.
//
// Module: MOD-site-frame
// Private to the module: index.mjs uses it. It reads nothing and writes nothing; the text a default subject gives is read when
// `paramsFor` is called, from what the route has drawn by then. A stored secret is shown only in a hidden field (A STORED SECRET IS
// HIDDEN UNTIL SHOWN), and `textContent` holds no input's value, so no stored secret is in it.

import { labelOf } from "./menu.mjs";
import { fragmentOf } from "./routing.mjs";

/**
 * entryShownOf(route, params) -> Route["entry"] — the menu entry of the page `route` shows for `params`: what its `entryShown(params)` gives, where it gives
 * one and that is not `null`, else its `entry`. Both the menu's mark and the subject's `entry` are this entry; `menuOf` counts only `entry`.
 */
export function entryShownOf(route, params) {
  const shown = typeof route.entryShown === "function" ? route.entryShown(params ?? {}) : null;
  return shown ?? route.entry;
}

/**
 * subjectOf({ route, params, context, drawn }) -> Subject — the subject of the route shown with these `params` and `context`; `drawn()` is
 * the `textContent` of what the route has drawn. The route's own `subject(params, context)` where it gives one — a route's `subject` may give `null` —, else the default: `key`
 * the route's fragment (its name with its parameters as the fragment writes them, without the leading `#`) with the chosen product's
 * address as the fragment writes it, none for the instance — the same route on another product is another subject —, `title` the route's title, `kind` `converse`,
 * `paramsFor` giving `{ page }` — the route's title, the label of the menu entry of the page shown (none for a route out of the menu), the chosen product's
 * address or the instance's, and what the route has drawn, one per line —, `draftRoute` and `withhold` `null`, `refuses` `[]`.
 */
export function subjectOf({ route, params, context, drawn }) {
  const entry = entryShownOf(route, params);
  const own = typeof route.subject === "function" ? route.subject(params, context) : null;
  if (own !== null) return { ...own, entry };
  const label = labelOf(entry);
  const address = context.product?.address ?? `https://github.com/${context.instance.repository}`;
  return {
    key: fragmentOf(route.name, context.product ? { ...params, product: context.product.address } : params).slice(1),
    title: route.title,
    kind: "converse",
    entry,
    paramsFor: () => ({ page: [route.title, ...(label === undefined ? [] : [label]), address, drawn()].join("\n") }),
    draftRoute: null,
    withhold: null,
    refuses: [],
  };
}
