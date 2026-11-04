// What this module's routes of Tests share of the site's one look (ITM-1223; EVERY PAGE SHARES ONE LOOK AND WORKS ON A PHONE), as
// docs/architecture/MOD-test-pages.md states it: the frame's head — the route's heading and the line of where it reads, the address, the ref read and how —
// with the Tests entry's views of views.mjs under it; and the frame's table (class list) whose cells carry their column's title as data-label, the one rule
// by which the frame's style sheet reflows a table on a phone (MOD-site-frame, look.css); and the frame's button, which answers a person's click only.
//
// Module: MOD-test-pages

import { testsViews } from "./views.mjs";

// The topics of the frame's explanations.md (ITM-1225) that explain a level of tests and an occasion on which they run, as the schedule and generate pages
// show them with the frame's explain.
export const LEVEL_TOPIC = { unit: "test-level-unit", component: "test-level-component", system: "test-level-system", paid: "test-level-paid",
  release: "test-level-release", user: "test-level-user" };
export const OCCASION_TOPIC = { "every commit": "test-occasion-every-commit", "pull request": "test-occasion-pull-request", nightly: "test-occasion-nightly",
  "release candidate": "test-occasion-release-candidate", "on demand": "test-occasion-on-demand" };

function el(name, className, ...children) {
  const node = document.createElement(name);
  if (className) node.className = className;
  node.append(...children);
  return node;
}

// testsHead(context, { title, shown, reads }) -> Element — <section class="head">: the heading `title`, the muted line `reads` (nodes or text) where one
// is given, and the Tests entry's views, `shown` (the label of the view drawn) marked.
export function testsHead(context, { title, shown, reads = null }) {
  return el("section", "head", el("h2", null, title), ...(reads ? [el("p", "muted", ...[].concat(reads))] : []), testsViews(context, shown));
}

// readsAt(address, ref, what?) -> Node[] — the line of where a page of a product reads: its address, the ref read, and how.
export function readsAt(address, ref, what = "read now from the repository; nothing here is stored.") {
  return [`${address} · `, el("code", null, ref), ` · ${what}`];
}

// column(label, ...children) -> <td data-label="label"> — a cell of the frame's table, labelled by its column's title.
export function column(label, ...children) {
  const node = el("td", null, ...children);
  node.setAttribute("data-label", label);
  return node;
}

// button(className, text, listener) -> <button type="button"> — the frame's button (btn) of a route, which answers only a click the browser marks as a
// person's (THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK): a click a script makes calls no `listener`.
export function button(className, text, listener) {
  const node = el("button", className, text);
  node.type = "button";
  node.addEventListener("click", (event) => (event?.isTrusted === true ? listener(event) : undefined));
  return node;
}

// listTable(columns, rows) -> <table class="list"> — the frame's table of `rows` under the column titles `columns`.
export const listTable = (columns, rows) => el("table", "list", el("thead", null, el("tr", null, ...columns.map((title) => el("th", null, title)))),
  el("tbody", null, ...rows));
