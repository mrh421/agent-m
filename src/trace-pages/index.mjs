// MOD-trace-pages — its public View. Its route `trace` draws the views that views.mjs describes: the current specification, the
// gaps and the modules' component diagram.
//
// Module: MOD-trace-pages

import { heads, routes } from "./routes.mjs";

export { heads };

export const view = { routes, strategies: [] };
