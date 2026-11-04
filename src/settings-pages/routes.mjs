// settings-pages/routes.mjs — the routes of the view, which the frame loads at start (MOD-site-frame, View: loadView): each route's head, and its own
// file imported when the frame first shows it. The view's strategies are in index.mjs, imported only when a job is prepared (loadStrategies).
//
// Module: MOD-settings-pages

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
  settings: { name: "settings", entry: "settings", title: "Settings" },
  setup: { name: "setup", entry: "settings", title: "Finish setting up your instance" },
  addProduct: { name: "add-product", entry: "settings", title: "Add a product" },
  endpoints: { name: "endpoints", entry: "settings", title: "Model endpoint" },
  participants: { name: "participants", entry: "settings", title: "Participants" },
  bridge: { name: "bridge", entry: "settings", title: "Bridge" },
  mailbox: { name: "mailbox", entry: "settings", title: "Mailbox" },
  library: { name: "library", entry: "settings", title: "Library" },
  sources: { name: "sources", entry: "settings", title: "Requirement sources" },
  resources: { name: "resources", entry: "settings", title: "Resources" },
  getYourOwn: { name: "get-your-own", entry: "settings", title: "Get your own Agent M" },
};

const settings = headed(heads.settings, async () => (await import("./settings.mjs")).route, { subject: true });
const setup = headed(heads.setup, async () => (await import("./setup.mjs")).route);
const addProduct = headed(heads.addProduct, async () => (await import("./products.mjs")).route);
const endpoints = headed(heads.endpoints, async () => (await import("./endpoints.mjs")).route);
const participants = headed(heads.participants, async () => (await import("./participants.mjs")).route);
const bridge = headed(heads.bridge, async () => (await import("./bridge.mjs")).route);
const mailbox = headed(heads.mailbox, async () => (await import("./mailbox.mjs")).route);
const library = headed(heads.library, async () => (await import("./library.mjs")).route);
const sources = headed(heads.sources, async () => (await import("./sources.mjs")).route);
const resources = headed(heads.resources, async () => (await import("./resources.mjs")).route);
const getYourOwn = headed(heads.getYourOwn, async () => (await import("./get-your-own.mjs")).route);

export const routes = [settings, setup, addProduct, endpoints, participants, bridge, mailbox, library, sources, resources, getYourOwn];

// view: View — the routes, and the strategies of the view's kinds, imported from index.mjs when the runner first looks a strategy up.
export const view = { routes, loadStrategies: async () => (await import("./index.mjs")).view.strategies };
