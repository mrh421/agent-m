// main-page/routes.mjs — the routes of the view, which the frame loads at start (MOD-site-frame, View: loadView): each route's head, and its own
// file imported when the frame first shows it. The view's strategies are in index.mjs, imported only when a job is prepared (loadStrategies).
//
// Module: MOD-main-page

// A route given by its head (MOD-site-frame's Route `module`): its `name`, `entry` and `title` here, the rest in the route's own file, which
// `module` imports once, when the frame first shows the route, embeds it or asks it for its subject. Its `render` imports the route and calls
// the route's own; its `subject`, where the route has one, is the route's own once it is imported, and none before.
function headed(head, load, { subject = false } = {}) {
  let full = null;
  let imported = null;
  const module = () => (imported ??= load().then((route) => (full = route)));
  return { ...head, module, render: async (target, context, params) => (await module()).render(target, context, params),
    ...(subject ? { subject: (params, context) => (full ? full.subject(params, context) : null) } : {}) };
}

// The files that hold two routes each, imported once for both.
const jobsFile = () => import("./jobs.mjs");

export const routes = [
  headed({ name: "home", entry: null, title: "Agent M" }, async () => (await import("./home.mjs")).home),
  headed({ name: "jobs", entry: null, title: "Every job" }, async () => (await jobsFile()).jobs),
  headed({ name: "job", entry: null, title: "Job" }, async () => (await jobsFile()).job, { subject: true }),
];

// view: View — the routes `home`, the first, which the frame shows for an address that names none, `jobs` and `job`; and the strategies, imported
// from index.mjs when the runner first looks a strategy up.
export const view = { routes, loadStrategies: async () => (await import("./index.mjs")).view.strategies };
