// test-pages/routes.mjs — the routes of the view, which the frame loads at start (MOD-site-frame, View: loadView): each route's head, and its own
// file imported when the frame first shows it. The view's strategies are in index.mjs, imported only when a job is prepared (loadStrategies).
//
// Module: MOD-test-pages

// A route given by its head (MOD-site-frame's Route `module`): its `name`, `entry`, `entryShown` and `title` here, the rest in the route's own
// file, which `module` imports once, when the frame first shows the route, embeds it or asks it for its subject. Its `render` imports the
// route and calls the route's own; its `subject`, where the route has one, is the route's own once it is imported, and none before.
function headed(head, load, { subject = false } = {}) {
  let full = null;
  let imported = null;
  const module = () => (imported ??= load().then((route) => (full = route)));
  return { ...head, module, render: async (target, context, params) => (await module()).render(target, context, params),
    ...(subject ? { subject: (params, context) => (full ? full.subject(params, context) : null) } : {}) };
}

// Each route's head, written here once; the route's own file takes its head from here.
export const heads = {
  release: { name: "release", entry: "releases", title: "Release" },
  schedule: { name: "schedule", entry: "tests", title: "Schedule" },
  runs: { name: "runs", entry: "tests", title: "Runs" },
  generate: { name: "generate", entry: "tests", title: "Generate tests" },
  testsViews: { name: "tests-views", entry: null, title: "Tests" },
};

const release = headed(heads.release, async () => (await import("./release.mjs")).route);
const schedule = headed(heads.schedule, async () => (await import("./schedule.mjs")).route);
const runs = headed(heads.runs, async () => (await import("./runs.mjs")).route);
const generate = headed(heads.generate, async () => (await import("./generate.mjs")).route);
const testsViews = headed(heads.testsViews, async () => (await import("./views.mjs")).route);

export const routes = [release, schedule, runs, generate, testsViews];

// view: View — the routes, and the strategies of the view's kinds, imported from index.mjs when the runner first looks a strategy up.
export const view = { routes, loadStrategies: async () => (await import("./index.mjs")).view.strategies };
