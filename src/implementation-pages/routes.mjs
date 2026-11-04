// implementation-pages/routes.mjs — the routes of the view, which the frame loads at start (MOD-site-frame, View: loadView): each route's head, and its own
// file imported when the frame first shows it. The view's strategies are in index.mjs, imported only when a job is prepared (loadStrategies).
//
// Module: MOD-implementation-pages

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
  progress: { name: "progress", entry: "implementation", title: "Progress" },
  process: { name: "process", entry: "implementation", title: "How this product is developed" },
  roles: { name: "roles", entry: "implementation", title: "Roles" },
  models: { name: "models", entry: "implementation", title: "Process models" },
  plan: { name: "plan", entry: "implementation", title: "Plan" },
  backlog: { name: "backlog", entry: "implementation", title: "Backlog" },
  board: { name: "board", entry: "implementation", title: "Board" },
  implement: { name: "implement", entry: "implementation", title: "Implement" },
};

// The files that hold two routes each, imported once for both.
const processFile = () => import("./process.mjs");
const backlogFile = () => import("./backlog.mjs");

const progress = headed(heads.progress, async () => (await import("./progress.mjs")).route);
const process = headed(heads.process, async () => (await processFile()).route);
const roles = headed(heads.roles, async () => (await import("./roles.mjs")).route);
const models = headed(heads.models, async () => (await processFile()).modelsRoute);
const plan = headed(heads.plan, async () => (await import("./plan.mjs")).route);
const backlog = headed(heads.backlog, async () => (await backlogFile()).route);
const board = headed(heads.board, async () => (await backlogFile()).boardRoute);
const implement = headed(heads.implement, async () => (await import("./implement.mjs")).route);

export const routes = [progress, process, roles, models, plan, backlog, board, implement];

// view: View — the routes, and the strategies of the view's kinds, imported from index.mjs when the runner first looks a strategy up.
export const view = { routes, loadStrategies: async () => (await import("./index.mjs")).view.strategies };
