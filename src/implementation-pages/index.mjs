// MOD-implementation-pages — the pages of implementation (docs/architecture/MOD-implementation-pages.md): its
// interface. Of it, the routes `progress` — what goes on now: each team's running sprint, the gates, what is blocked and who works on what (UC-035; ITM-1252), the first of
// the view's routes, which the entry Implementation opens —, `process` — How this product is developed (UC-002) —, `roles` — Roles (UC-048) — and `models` — the
// instance's process models, listed (UC-031 steps 1 and 2b) — and `models/<name>` — a model adapted or created, validated while typed, and saved (UC-031 steps 2 to 6; ITM-779) — and `plan` — the architecture beside the plan's steps and their states (UC-045 step 1, 1a, 1b; ITM-1057), and Draft the plan with Save plan (UC-045 steps 2 to 5; ITM-1058), without
// + Step — and `backlog` — the backlog, each
// team's last ended sprint and the planning, with Plan sprint and Start sprint (UC-032, UC-033; ITM-681, ITM-1252), Propose items with Add to backlog, and + Item (UC-032 steps 2 to 4, 2a; ITM-782) — are built, as are `board`
// — the board with Pull (UC-032 step 7; ITM-784) — and `implement` — the ready items started as jobs (UC-034 steps 1 to 4; ITM-789); this view hands the frame the strategies its kinds use in the tab.
//
// Module: MOD-implementation-pages

import { workStrategies } from "../work-plans/index.mjs";
import { runStrategies } from "../run-planner/index.mjs";
import { scheduleStrategies } from "../test-schedule/index.mjs";
import { resultStrategies } from "../result-records/index.mjs";
import { routeStrategies } from "../runtimes/index.mjs";
import { approvalStrategies } from "../approvals/index.mjs";
import { heads, routes } from "./routes.mjs";

export { heads };

export const view = { routes, strategies: [workStrategies, runStrategies, scheduleStrategies, resultStrategies, routeStrategies, approvalStrategies] };
