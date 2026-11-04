// The routes of the site that tests/site-usability.test.mjs and tests/site-accessibility.test.mjs draw, and how a route is drawn: the
// address to open, the text it must show, the script that records the last change of a document, and the wait until the page is drawn.
// It is test code; it holds no expected result beyond the text a route shows.
//
// Module: MOD-site-frame
// Level: system

import { again, until } from "./browser.mjs";

// testId(series, number) -> string — the identifier `TST-<nnn>` of a generated test: the series (904 for the look check, 905 for the accessibility check)
// and its number, which the route table or CASES holds (MOD-identifiers: the numbered kinds count up, and a number once used stays used).
export const testId = (series, number) => `TST-${series}${String(number).padStart(3, "0")}`;

// The checks of a route that have a number in each series, in the order a route is given its numbers.
const CHECKS = { 904: ["drawn", "sheets", "targets", "widths", "diagrams"], 905: ["drawn", "wcag", "diagrams"] };
// withRoute(table, route, cases = CASES) -> route[] — a copy of `table` with `route` at its front, given the next free numbers: each check of each series
// takes the next number above the highest the table and `cases` hold for that series, counted up in the order of CHECKS. The numbers of the others stay.
export function withRoute(table, route, cases = CASES) {
  const ids = {};
  for (const series of [904, 905]) {
    let next = Math.max(0, ...Object.values(cases[series]), ...table.flatMap((each) => Object.values(each.ids[series]))) + 1;
    ids[series] = Object.fromEntries(CHECKS[series].map((check) => [check, next++]));
  }
  return [{ ...route, ids }, ...table];
}

// Each route: its address, and a text it must show — the known positive that the page was drawn with content before anything is said
// about its widths. `#` addresses are the review pages' fragments; `/` is the main page. `ids` holds the numbers of the route's generated tests in each
// series (904: the look check, 905: the accessibility check), assigned once and kept: a new route takes the next free numbers (`withRoute`).
const SECTION = encodeURIComponent("## 1. Reading");
const NAME = encodeURIComponent("A MISSING FILE IS NAMED, NEVER GUESSED AT");
export const ROUTES = [
  { address: "/", shows: "Jobs", ids: { 904: { drawn: 2, sheets: 34, targets: 35, widths: 36, diagrams: 134 }, 905: { drawn: 1, wcag: 33, diagrams: 72 } } },
  { address: "#uc", shows: "UC-001", ids: { 904: { drawn: 3, sheets: 37, targets: 38, widths: 39, diagrams: 135 }, 905: { drawn: 2, wcag: 34, diagrams: 73 } } },
  { address: "#uc/UC-001", shows: "UC-001 Read a file at a pinned commit", ids: { 904: { drawn: 4, sheets: 40, targets: 41, widths: 42, diagrams: 136, box: 168 }, 905: { drawn: 3, wcag: 35, diagrams: 74 } } },
  { address: "#review/uc", shows: "Review all — Use cases", ids: { 904: { drawn: 5, sheets: 43, targets: 44, widths: 45, diagrams: 137, box: 169 }, 905: { drawn: 4, wcag: 36, diagrams: 75 } } },
  { address: "#use-case/id=draft", shows: "Draft use cases", ids: { 904: { drawn: 6, sheets: 46, targets: 47, widths: 48, diagrams: 138 }, 905: { drawn: 5, wcag: 37, diagrams: 76 } } },
  { address: "#use-case/id=UC-002/edit=1", shows: "Edit UC-002", ids: { 904: { drawn: 7, sheets: 49, targets: 50, widths: 51, diagrams: 139 }, 905: { drawn: 6, wcag: 38, diagrams: 77 } } },
  { address: "#arc", shows: "Architecture decisions", ids: { 904: { drawn: 8, sheets: 52, targets: 53, widths: 54, diagrams: 140 }, 905: { drawn: 7, wcag: 39, diagrams: 78 } } },
  { address: "#arc/ARC-001", shows: "ARC-001 The pages are a static client", ids: { 904: { drawn: 9, sheets: 55, targets: 56, widths: 57, diagrams: 141 }, 905: { drawn: 8, wcag: 40, diagrams: 79 } } },
  { address: "#arc/MOD-reader", shows: "MOD-reader Reads files at a pinned commit", ids: { 904: { drawn: 10, sheets: 58, targets: 59, widths: 60, diagrams: 142 }, 905: { drawn: 9, wcag: 41, diagrams: 80 } } },
  { address: "#review/arc", shows: "Review all — the whole architecture", ids: { 904: { drawn: 11, sheets: 61, targets: 62, widths: 63, diagrams: 143 }, 905: { drawn: 10, wcag: 42, diagrams: 81 } } },
  { address: "#decision/id=draft", shows: "Draft the architecture", ids: { 904: { drawn: 12, sheets: 64, targets: 65, widths: 66, diagrams: 144 }, 905: { drawn: 11, wcag: 43, diagrams: 82 } } },
  { address: "#decision/id=ARC-001/edit=1", shows: "Edit ARC-001", ids: { 904: { drawn: 13, sheets: 67, targets: 68, widths: 69, diagrams: 145 }, 905: { drawn: 12, wcag: 44, diagrams: 83 } } },
  { address: "#module", shows: "Module files", ids: { 904: { drawn: 14, sheets: 70, targets: 71, widths: 72, diagrams: 146 }, 905: { drawn: 13, wcag: 45, diagrams: 84 } } },
  { address: "#module/id=MOD-reader/edit=1", shows: "Edit MOD-reader", ids: { 904: { drawn: 15, sheets: 73, targets: 74, widths: 75, diagrams: 147 }, 905: { drawn: 14, wcag: 46, diagrams: 85 } } },
  { address: "#spec", shows: "SPEC changes", ids: { 904: { drawn: 16, sheets: 76, targets: 77, widths: 78, diagrams: 148 }, 905: { drawn: 15, wcag: 47, diagrams: 86 } } },
  { address: "#spec/2026-10-18_sample/01", shows: "2026-10-18_sample · entry 01", ids: { 904: { drawn: 17, sheets: 79, targets: 80, widths: 81, diagrams: 149 }, 905: { drawn: 16, wcag: 48, diagrams: 87 } } },
  { address: "#spec-entry/id=all", shows: "Review all — SPEC changes", ids: { 904: { drawn: 18, sheets: 82, targets: 83, widths: 84, diagrams: 150 }, 905: { drawn: 17, wcag: 49, diagrams: 88 } } },
  { address: "#spec-entry/id=spec-2026-10-18_sample-01/edit=1", shows: "Edit entry 01 of 2026-10-18_sample", ids: { 904: { drawn: 19, sheets: 85, targets: 86, widths: 87, diagrams: 151 }, 905: { drawn: 18, wcag: 50, diagrams: 89 } } },
  { address: `#requirement/name=${NAME}`, shows: "Edit A MISSING FILE IS NAMED, NEVER GUESSED AT What is this? Other open proposals on this section", ids: { 904: { drawn: 20, sheets: 88, targets: 89, widths: 90, diagrams: 152 }, 905: { drawn: 19, wcag: 51, diagrams: 90 } } },
  { address: `#requirements/section=${SECTION}`, shows: "New requirement What is this? Other open proposals on this section", ids: { 904: { drawn: 21, sheets: 91, targets: 92, widths: 93, diagrams: 153 }, 905: { drawn: 20, wcag: 52, diagrams: 91 } } },
  { address: "#draft/subject=none", shows: "The draft of the conversation", ids: { 904: { drawn: 22, sheets: 94, targets: 95, widths: 96, diagrams: 154 }, 905: { drawn: 21, wcag: 53, diagrams: 92 } } },
  { address: "#how", shows: "How acceptance works", ids: { 904: { drawn: 23, sheets: 97, targets: 98, widths: 99, diagrams: 155 }, 905: { drawn: 22, wcag: 54, diagrams: 93 } } },
  { address: "#settings", shows: "Settings", ids: { 904: { drawn: 24, sheets: 100, targets: 101, widths: 102, diagrams: 156 }, 905: { drawn: 23, wcag: 55, diagrams: 94 } } },
  { address: "#add", shows: "Add a product", ids: { 904: { drawn: 25, sheets: 103, targets: 104, widths: 105, diagrams: 157 }, 905: { drawn: 24, wcag: 56, diagrams: 95 } } },
  { address: "#endpoints", shows: "Configure a model endpoint", ids: { 904: { drawn: 26, sheets: 106, targets: 107, widths: 108, diagrams: 158 }, 905: { drawn: 25, wcag: 57, diagrams: 96 } } },
  { address: "#setup", shows: "Finish setting up your instance", ids: { 904: { drawn: 27, sheets: 109, targets: 110, widths: 111, diagrams: 159 }, 905: { drawn: 26, wcag: 58, diagrams: 97 } } },
  { address: "#bridge", shows: "Connect a Bridge", ids: { 904: { drawn: 28, sheets: 112, targets: 113, widths: 114, diagrams: 160 }, 905: { drawn: 27, wcag: 59, diagrams: 98 } } },
  { address: "#backlog", shows: "Backlog", ids: { 904: { drawn: 29, sheets: 115, targets: 116, widths: 117, diagrams: 161 }, 905: { drawn: 28, wcag: 60, diagrams: 99 } } },
  { address: "#process", shows: "How this product is developed", ids: { 904: { drawn: 30, sheets: 118, targets: 119, widths: 120, diagrams: 162 }, 905: { drawn: 29, wcag: 61, diagrams: 100 } } },
  { address: "#release", shows: "New release", ids: { 904: { drawn: 31, sheets: 121, targets: 122, widths: 123, diagrams: 163 }, 905: { drawn: 30, wcag: 62, diagrams: 101 } } },
  { address: "#roles", shows: "Who fills the roles", ids: { 904: { drawn: 32, sheets: 124, targets: 125, widths: 126, diagrams: 164 }, 905: { drawn: 31, wcag: 63, diagrams: 102 } } },
  { address: "#release-report/id=all", shows: "Review all — Release test reports", ids: { 904: { drawn: 33, sheets: 127, targets: 128, widths: 129, diagrams: 165 }, 905: { drawn: 32, wcag: 64, diagrams: 103 } } },
  { address: "#arrange/kind=use-cases", shows: "Arrange the use cases", ids: { 904: { drawn: 170, sheets: 171, targets: 172, widths: 173, diagrams: 174 }, 905: { drawn: 113, wcag: 114, diagrams: 115 } } },
  { address: "#mail", shows: "Read mailbox", ids: { 904: { drawn: 175, sheets: 176, targets: 177, widths: 178, diagrams: 179 }, 905: { drawn: 116, wcag: 117, diagrams: 118 } } },
  { address: "#replies", shows: "Read replies", ids: { 904: { drawn: 180, sheets: 181, targets: 182, widths: 183, diagrams: 184 }, 905: { drawn: 119, wcag: 120, diagrams: 121 } } },
  { address: "#runs", shows: "Runs", ids: { 904: { drawn: 185, sheets: 186, targets: 187, widths: 188, diagrams: 189 }, 905: { drawn: 122, wcag: 123, diagrams: 124 } } },
  { address: "#schedule", shows: "This is the book's default schedule", ids: { 904: { drawn: 190, sheets: 191, targets: 192, widths: 193, diagrams: 194 }, 905: { drawn: 125, wcag: 126, diagrams: 127 } } },
  { address: "#generate", shows: "Generate tests", ids: { 904: { drawn: 195, sheets: 196, targets: 197, widths: 198, diagrams: 199 }, 905: { drawn: 128, wcag: 129, diagrams: 130 } } },
  { address: "#trace/key=tests", shows: "Tests", ids: { 904: { drawn: 200, sheets: 201, targets: 202, widths: 203, diagrams: 204 }, 905: { drawn: 131, wcag: 132, diagrams: 133 } } },
];

// The numbers of the generated tests that are no route's, by series: the planted cases and the tests over several routes at once.
export const CASES = {
  904: { routes: 1, plantedBefore: 130, plantedTable: 131, plantedButton: 132, plantedSheet: 133, diagramBefore: 166, diagramAfter: 167, closedDetails: 205, openDetails: 206 },
  905: { plantedBefore: 65, plantedButton: 66, plantedImage: 67, labels: 68, ticks: 69, tickBefore: 70, plantedTick: 71, diagramBefore: 104, diagramAfter: 105, scrollEdits: 106, scrollBefore: 107, plantedScroll: 108, changedKeyboard: 109, changedRule: 110, plantedDiff: 111, plantedBrand: 112 },
};

// In every document the browser opens, before its scripts: the time of the last change anywhere in the document.
export const OBSERVE = `window.__lastChange = performance.now(); new MutationObserver(() => { window.__lastChange = performance.now(); }).observe(document, { subtree: true, childList: true, attributes: true, characterData: true });`;
// The page is drawn when nothing changed for 400 ms, no request to GitHub is open, no placeholder is left and every diagram is drawn.
export const DRAWN = `(() => { const main = document.querySelector("main"); if (!main) return false;
  return window.__pending === 0 && performance.now() - window.__lastChange > 400 && !/(^|\\n)\\s*(Loading|Reading)…\\s*($|\\n)/.test(main.innerText)
    && [...document.querySelectorAll(".mermaid")].every((diagram) => diagram.querySelector("svg") !== null); })()`;
// show(page, site, address, { answerWithin = 3000, limit = 30000 }) — opens the address and waits until it is drawn. A call or an evaluation in the page is
// given `answerWithin` ms to answer and is sent again when it does not, until `limit` ms of the wait are over: one sent while the document is replaced is
// sometimes never answered, and a single one that is given the whole wait cannot be sent again. The navigation is sent again until it is answered, and the
// wait for the load is the same wait: the address asked for twice is the same address.
export async function show(page, site, address, { answerWithin = 3000, limit = 30000 } = {}) {
  const ask = (name, expression) => again(name, (within) => page.evaluate(expression, within), { answerWithin, limit });
  const here = await ask(`${address} asks where the page is`, "location.pathname + location.hash");
  if (address.startsWith("#") && here.startsWith("/docs/")) {
    await ask(`${address} is set`, `window.__lastChange = performance.now(); location.hash = ${JSON.stringify(address)}`);
  } else {
    const target = address === "/" ? `${site.address}/` : `${site.address}/docs/${address}`;
    let navigated = false;
    await until(`${address} is loaded`, async () => {
      if (!navigated) { await page.call("Page.navigate", { url: target }, answerWithin); navigated = true; }
      return await page.evaluate(`location.href === ${JSON.stringify(target)} && document.readyState === "complete"`, answerWithin);
    }, limit);
  }
  try {
    await until(`${address} is drawn`, () => page.evaluate(DRAWN, answerWithin), Math.min(limit, 20000));
  } catch (failure) {
    const state = await page.evaluate(`({ href: location.href, ready: document.readyState, pending: window.__pending, quiet: performance.now() - window.__lastChange,
      text: (document.querySelector("main")?.innerText ?? "no main").replace(/\\s+/g, " ").slice(0, 300) })`, answerWithin).catch((error) => String(error));
    throw new Error(`${failure.message}; the page: ${JSON.stringify(state)}`);
  }
}

