// index.mjs — the interface of the main page (docs/architecture/MOD-main-page.md, Parts and Interfaces: `view`): the routes of the main page and the
// strategies the prompt bar's conversations on it need. The routes `home`, `jobs` and `job` are built.
//
// Module: MOD-main-page
// It uses MOD-source-register (sourceStrategies) through its index.mjs. The frame loads routes.mjs (MOD-site-frame, start.mjs), and this file only for the strategies.

import { sourceStrategies } from "../source-register/index.mjs";
import { routes } from "./routes.mjs";

/**
 * view: View — { routes: Route[], strategies: Strategies[] } as MOD-site-frame defines them: the routes `home`, the first, which the frame shows for an address that names none, `jobs` and `job`; and
 * `sourceStrategies`, so that a conversation on the main page receives the book's chapters of its page.
 */
export const view = { routes, strategies: [sourceStrategies] };
