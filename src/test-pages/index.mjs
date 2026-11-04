// MOD-test-pages — the pages of tests and releases (docs/architecture/MOD-test-pages.md): its interface. Of it,
// ITM-256 builds the route `release` alone, as this item's own Outcome narrows it — the version and changelog entry,
// *Start release candidate*, the candidate and its queued run, the levels/rates/report once the run has ended, and
// *Accept and release*. ITM-758 builds the route `schedule` up to Save, ITM-759 its Save, merge, drift and last runs (schedule.mjs). ITM-760 builds the reading part of `runs` (runs.mjs). ITM-761 builds Run on this commit, for which the view hands the frame `routeStrategies`. ITM-763 builds the route `generate` up to the proposal (generate.mjs), for which the view hands the frame `resultStrategies` and `approvalStrategies`. ITM-1223 adds the route `tests-views`, the Tests entry's views (views.mjs).
//
// Module: MOD-test-pages

import { scheduleStrategies } from "../test-schedule/index.mjs";
import { resultStrategies } from "../result-records/index.mjs";
import { approvalStrategies } from "../approvals/index.mjs";
import { routeStrategies } from "../runtimes/index.mjs";
import { sourceStrategies } from "../source-register/index.mjs";
import { resourceStrategies } from "../resource-list/index.mjs";
import { heads, routes } from "./routes.mjs";

export { heads };

export const view = { routes, strategies: [scheduleStrategies, resultStrategies, approvalStrategies, routeStrategies, sourceStrategies, resourceStrategies] };
