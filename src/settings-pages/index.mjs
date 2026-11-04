// MOD-settings-pages — the public settings routes for browser-held product, endpoint, and Bridge configuration.
//
// Module: MOD-settings-pages

import { resourceStrategies } from "../resource-list/index.mjs";
import { heads, routes } from "./routes.mjs";

export { heads };

export const view = { routes, strategies: [resourceStrategies] };
