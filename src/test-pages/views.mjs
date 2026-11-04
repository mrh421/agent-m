// The route `tests-views` — the Tests entry's views (ITM-1223), as docs/architecture/MOD-test-pages.md states it: titled Tests, outside the menu (entry null),
// made to be shown inside the routes that embed it with the frame's embedRoute — the trace pages' tests browser and audit —, and drawn by look.mjs under the
// head of this module's own routes of Tests; opened by its own address it draws the same navigation and nothing else. The views stand in the order of a
// person's audit, the setup of the batteries first and then their results: Schedule, Browser, Runs, Audit, Generate (UC-027 1, UC-029 1, UC-028 1,
// UC-030 1, UC-026 1). Each is a button of the frame whose click calls `go` of the context the route is rendered with, so that the frame alone writes the
// address; the one its param `shown` names is marked as the page shown (aria-current="page") and drawn as the frame's primary button. It reads nothing.
//
// Module: MOD-test-pages

import { heads } from "./routes.mjs";

const TESTS_VIEWS = [
  { label: "Schedule", name: "schedule", params: {} },
  { label: "Browser", name: "trace", params: { key: "tests" } },
  { label: "Runs", name: "runs", params: {} },
  { label: "Audit", name: "trace", params: { key: "audit" } },
  { label: "Generate", name: "generate", params: {} },
];

// testsViews(context, shown) -> Element — <nav aria-label="Tests"> with the five views as the frame's buttons, `shown` (a view's label) marked.
export function testsViews(context, shown) {
  const buttons = TESTS_VIEWS.map((view) => {
    const current = view.label === shown;
    const button = document.createElement("button");
    button.className = current ? "btn primary" : "btn";
    button.setAttribute("type", "button");
    button.append(view.label);
    if (current) button.setAttribute("aria-current", "page");
    button.addEventListener("click", () => context.go(view.name, view.params));
    return button;
  });
  const views = document.createElement("nav");
  views.className = "tests-views";
  views.setAttribute("aria-label", "Tests");
  views.append(...buttons);
  return views;
}

async function render(target, context, params = {}) {
  target.replaceChildren(testsViews(context, params.shown ?? null));
}

export const route = { ...heads.testsViews, render };
