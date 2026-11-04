// preloads.mjs — the block of preloads each entry page carries in its <head> (docs/architecture/MOD-site-frame.md, Parts).
// Without a build, a browser finds a page's files level by level: it learns a module's imports only once that module has
// arrived, and a file a module reads as it is loaded only once that module runs. The block names every such file of the page,
// so that the browser asks for all of them at once, as the page arrives:
//   - `<link rel="modulepreload">` for each module the page loads as it starts: the static import closure of its module script
//     and of the view module of every slug its `data-views` names, which the frame loads on every start (routing.mjs'
//     viewAddress), a JSON module with `as="json"`. A module the page imports only when a route is shown is not among them.
//   - `<link rel="preload" as="fetch" crossorigin>` for each file of the repository those modules fetch as they are evaluated —
//     a module's schema, register or explanations, which it fetches from its own address in a browser. Which files those are is
//     found by evaluating the modules in a separate Node process as a browser runs them (evaluated).
//   - for each route of those views that names `module`, as data — the JSON of the element `route-preloads` —, the modules its `module`
//     imports and the files they fetch beyond the block, which the frame asks for at once before it imports the route (routing.mjs' loadRoute).
//
// Run in the repository's root: `node src/site-frame/preloads.mjs` writes the block of every entry page; with `--check` it writes
// nothing and exits with 1, naming the page, when a page's block differs from what this file computes.
// tests/site-frame-preloads.test.mjs runs the same comparison, so that a pull request whose block is stale fails.
//
// Module: MOD-site-frame
// Runs in Node only. Throws for an entry page without a module script, for an import a browser cannot load, and for an import of
// a module that is not in the repository.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, relative, sep } from "node:path";
import { viewAddress } from "./routing.mjs";

const ROOT = new URL("../../", import.meta.url);

/** The entry pages of the instance's site, by their path from the repository's root (ARC-038). */
export const ENTRY_PAGES = ["index.html", "docs/index.html"];

export const BEGIN = "<!-- preloads: written by `node src/site-frame/preloads.mjs`; tests/site-frame-preloads.test.mjs fails when they are stale -->";
export const END = "<!-- /preloads -->";

// A static `import … from "x"`, `import "x"` or `export … from "x"` that begins a line, the pattern MOD-trace-graph's code.mjs
// reads imports with; the clause before `from` holds no other import or export.
const STATIC = /^[ \t]*(?:import|export)\b(?:(?:(?!\b(?:import|export)\b)[^'"`;()=])*?\bfrom)?\s*(["'])([^"'\r\n]+)\1/gm;

const isModule = (url) => /\.(?:m|c)?js$/.test(url.pathname);
const isJson = (url) => /\.json$/.test(url.pathname);
const fromRoot = (url) => relative(fileURLToPath(ROOT), fileURLToPath(url)).split(sep).join("/");

/**
 * The modules a module imports statically, as file URLs: its JavaScript modules and its JSON modules.
 * @param {URL} file
 * @returns {URL[]}
 */
export function staticImports(file) {
  const found = [];
  for (const [, , specifier] of readFileSync(file, "utf8").matchAll(STATIC)) {
    if (!/^\.{0,2}\//.test(specifier)) throw new Error(`preloads.mjs: ${fromRoot(file)} imports "${specifier}", which a browser cannot load`);
    const url = new URL(specifier, file);
    if (!isModule(url) && !isJson(url)) continue;
    if (!existsSync(url)) throw new Error(`preloads.mjs: ${fromRoot(file)} imports ${specifier}, which is not in the repository`);
    found.push(url);
  }
  return found;
}

/**
 * The static import closure of the given modules, breadth first, each with its level: 0 for a given module, one more than the
 * module that first names it otherwise — the round trip in which a browser without the block asks for it.
 * @param {URL[]} starts
 * @returns {Map<string, number>} file URL → level
 */
export function closure(starts) {
  const level = new Map(starts.map((url) => [url.href, 0]));
  const queue = [...starts];
  while (queue.length) {
    const file = queue.shift();
    for (const next of isJson(file) ? [] : staticImports(file)) {
      if (level.has(next.href)) continue;
      level.set(next.href, level.get(file.href) + 1);
      queue.push(next);
    }
  }
  return level;
}

// The page's module script and its `data-views`.
function moduleScript(page, html) {
  const tag = /<script\b[^>]*\btype="module"[^>]*>/.exec(html)?.[0];
  const src = tag && /\bsrc="([^"]+)"/.exec(tag)?.[1];
  if (!src) throw new Error(`preloads.mjs: ${page} has no module script`);
  const views = (/\bdata-views="([^"]*)"/.exec(tag)?.[1] ?? "").split(/\s+/).filter(Boolean);
  return { script: new URL(src, new URL(page, ROOT)), views };
}

// The files of the repository, other than modules, that the given modules fetch as they are evaluated in a browser, and, for each route
// of the given views that names `module`, the modules its `module` imports and the files they fetch. A separate Node process imports the
// modules as a browser runs them: Node's built-in modules are hidden from them, so that each module's own-file helper takes its browser
// branch and fetches the file from the module's own address, and `fetch` answers such an address from the disk and records it with the
// modules on its stack. The recorder is preloaded with --import; the modules are imported statically after it, in their order; then each
// route's `module` is called in turn, and the modules resolved meanwhile are recorded for that route (a resolve hook). What was found is
// written when the process exits.
const RECORDER = `
import { readFileSync, writeSync } from "node:fs";
import { registerHooks } from "node:module";
Error.stackTraceLimit = Infinity;
const found = { fetched: [], routes: {} };
globalThis.__preloads = found;
registerHooks({ resolve(specifier, context, next) {
  const resolved = next(specifier, context);
  if (found.route) found.routes[found.route].push(resolved.url);
  return resolved;
} });
globalThis.fetch = async (address) => {
  const url = new URL(String(address instanceof Request ? address.url : address));
  if (url.protocol !== "file:") throw new Error("preloads.mjs: a module fetched " + url.href + " as it was evaluated");
  const stack = [...new Error().stack.matchAll(/file:\\/\\/[^\\s)]+?\\.m?js(?=:\\d)/g)].map(([href]) => href);
  found.fetched.push({ href: url.href, route: found.route ?? null, stack });
  return new Response(readFileSync(url));
};
process.getBuiltinModule = () => undefined;
process.on("exit", (code) => { if (code === 0) writeSync(1, JSON.stringify(found)); });
`;
function evaluated(modules, views) {
  const importing = [...modules.map((href) => `import ${JSON.stringify(href)};`),
    ...views.map((href, at) => `import * as view${at} from ${JSON.stringify(href)};`),
    `for (const { view } of [${views.map((_, at) => `view${at}`).join(", ")}]) for (const route of view.routes ?? []) {`,
    "  if (typeof route.module !== \"function\") continue;",
    "  globalThis.__preloads.route = route.name; globalThis.__preloads.routes[route.name] = [];",
    "  await route.module();",
    "  globalThis.__preloads.route = null;",
    "}"].join("\n");
  return JSON.parse(execFileSync(process.execPath,
    ["--no-warnings", "--import", `data:text/javascript,${encodeURIComponent(RECORDER)}`, "--input-type=module", "-e", importing],
    { cwd: fileURLToPath(ROOT), encoding: "utf8", maxBuffer: 1 << 26 }));
}

const inRepository = (href) => href.startsWith(ROOT.href);

/**
 * What an entry page loads as it starts, and what each route `module` of its views loads beyond that when it is first imported.
 * @param {string} page — path from the repository's root
 * @param {string} [html] — the page's text
 * @returns {{ modules: string[], files: string[], depth: number, routes: Record<string, { modules: string[], files: string[], depth: number }> }}
 *   modules and the other files they read as they are evaluated, as paths relative to the page, sorted; depth — the levels of modules a
 *   browser without the block asks for one after the other; routes — by route name, the modules and files beyond the block, and the levels
 *   in which a browser asks for them when the frame preloads them at once
 */
export function pageLoads(page, html = readFileSync(new URL(page, ROOT), "utf8")) {
  const { script, views } = moduleScript(page, html);
  const first = closure([script]);
  const firstDepth = Math.max(...first.values());
  const viewUrls = views.map((slug) => new URL(viewAddress(slug)));
  const later = closure(viewUrls);
  let depth = firstDepth;
  for (const [href, n] of later) if (!first.has(href)) depth = Math.max(depth, firstDepth + 1 + n);
  const modules = [...new Set([...first.keys(), ...later.keys()])];
  // The page's own module script runs only in the page; the modules it imports are evaluated without it.
  const found = evaluated(modules.filter((href) => href !== script.href && isModule(new URL(href))), viewUrls.map((url) => url.href));
  const other = ({ href }) => inRepository(href) && !isModule(new URL(href)) && !modules.includes(href);
  const files = [...new Set(found.fetched.filter((fetch) => fetch.route === null).filter(other).map(({ href }) => href))];
  const pageDir = dirname(fileURLToPath(new URL(page, ROOT)));
  const fromPage = (href) => relative(pageDir, fileURLToPath(href)).split(sep).join("/");
  const routes = {};
  const attributed = new Set();
  for (const [name, resolved] of Object.entries(found.routes)) {
    const own = [...closure(resolved.filter(inRepository).map((href) => new URL(href))).keys()].filter((href) => !modules.includes(href));
    const read = found.fetched.filter((fetch) => fetch.route !== null && other(fetch) && !files.includes(fetch.href) && fetch.stack.some((href) => own.includes(href)));
    for (const fetch of read) attributed.add(fetch);
    routes[name] = { modules: own.map(fromPage).sort(), files: [...new Set(read.map(({ href }) => fromPage(href)))].sort(), depth: 1 };
  }
  const lost = found.fetched.filter((fetch) => fetch.route !== null && other(fetch) && !files.includes(fetch.href) && !attributed.has(fetch));
  if (lost.length) throw new Error(`preloads.mjs: ${fromPage(lost[0].href)} is fetched by no module of the route ${lost[0].route}`);
  return { modules: modules.map(fromPage).sort(), files: files.map(fromPage).sort(), depth: depth + 1, routes };
}

/** The id of the element of an entry page's block that holds, as JSON, what each route `module` loads beyond the block. */
export const ROUTE_DATA = "route-preloads";

/**
 * The block an entry page carries, indented as the page's `<head>` is: the preloads, and, where a view of the page has a route `module`,
 * the data of what each such route loads beyond them, one route to a line.
 * @param {string} page
 * @param {string} [html]
 * @returns {string}
 */
export function preloadBlock(page, html) {
  const { modules, files, routes } = pageLoads(page, html);
  const names = Object.keys(routes).sort();
  const data = names.length === 0 ? [] : [`<script type="application/json" id="${ROUTE_DATA}">{`,
    ...names.map((name, at) => `${JSON.stringify(name)}: ${JSON.stringify({ modules: routes[name].modules, files: routes[name].files })}${at < names.length - 1 ? "," : ""}`),
    "}</script>"];
  return [BEGIN,
    ...modules.map((path) => `<link rel="modulepreload"${path.endsWith(".json") ? ' as="json"' : ""} href="${path}">`),
    ...files.map((path) => `<link rel="preload" as="fetch" crossorigin href="${path}">`),
    ...data,
    END].map((line) => `  ${line}`).join("\n");
}

const literally = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const BLOCK = new RegExp(`[ \\t]*${literally(BEGIN)}[\\s\\S]*?${literally(END)}`);

/**
 * The page with its block as this file computes it: the block replaced where the page has one, put before `</head>` otherwise.
 * @param {string} page
 * @param {string} html
 * @returns {string}
 */
export function withBlock(page, html) {
  const block = preloadBlock(page, html);
  if (BLOCK.test(html)) return html.replace(BLOCK, () => block);
  if (!html.includes("</head>")) throw new Error(`preloads.mjs: ${page} has no </head>`);
  return html.replace("</head>", () => `${block}\n</head>`);
}

/**
 * The entry pages whose block differs from what this file computes.
 * @returns {string[]}
 */
export function stalePages() {
  return ENTRY_PAGES.filter((page) => {
    const html = readFileSync(new URL(page, ROOT), "utf8");
    return withBlock(page, html) !== html;
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.includes("--check")) {
    const stale = stalePages();
    for (const page of stale) console.error(`${page}: its preloads are stale; run node src/site-frame/preloads.mjs`);
    process.exit(stale.length ? 1 : 0);
  }
  for (const page of ENTRY_PAGES) {
    const file = new URL(page, ROOT);
    const html = readFileSync(file, "utf8");
    const next = withBlock(page, html);
    if (next !== html) writeFileSync(file, next);
    const { modules, files, depth } = pageLoads(page, next);
    console.log(`${page}: ${modules.length} modules, ${files.length} files they read; ${depth} levels of modules without the block`);
  }
}
