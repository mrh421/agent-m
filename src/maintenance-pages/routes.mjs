// maintenance-pages/routes.mjs — the routes of the view, which the frame loads at start (MOD-site-frame, View: loadView): each route's head, and its own
// file imported when the frame first shows it. The view's strategies are in index.mjs, imported only when a job is prepared (loadStrategies).
//
// Module: MOD-maintenance-pages

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
  mail: { name: "mail", entry: "maintenance", title: "Mail" },
  replies: { name: "replies", entry: "maintenance", title: "Replies" },
  issues: { name: "issues", entry: "maintenance", title: "Issues" },
  issue: { name: "issue", entry: null, title: "Issue" },
};

// The file that holds the routes issues and issue, imported once for both.
const issuesFile = () => import("./issues.mjs");

const mail = headed(heads.mail, async () => (await import("./mail.mjs")).route, { subject: true });
const replies = headed(heads.replies, async () => (await import("./replies.mjs")).route, { subject: true });
const issues = headed(heads.issues, async () => (await issuesFile()).routes.find((route) => route.name === "issues"));
const issue = headed(heads.issue, async () => (await issuesFile()).routes.find((route) => route.name === "issue"));

export const routes = [mail, replies, issues, issue];

// view: View — the routes, and the strategies of the view's kinds, imported from index.mjs when the runner first looks a strategy up.
export const view = { routes, loadStrategies: async () => (await import("./index.mjs")).view.strategies };
