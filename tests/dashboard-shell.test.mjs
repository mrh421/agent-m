// The dashboard shell — the site's menu written from the stages of the process and the table of views, each view loaded by its
// name, a view or settings section whose file is not there not shown, and not asked for, a view's own stylesheet, and the
// request handlers a view's tests bring to the harness.
// Run: node --test tests/
//
// Module: MOD-site-frame
// Guards: EVERY SETTING IS REACHED FROM ONE PAGE; THE MENU FOLLOWS THE PROCESS; UC-001; UC-006; UC-008; UC-014; UC-022; UC-023; UC-024; UC-042
// Level: component
//
// The real dashboard (the harness's APP_FILE) runs in tests/app-harness.mjs against a GitHub API mock. The counter-proofs
// are recorded in docs/measurements/2026-10-01_dashboard-shell.md and docs/measurements/2026-10-01_no-request-for-a-view-not-built.md.

import test from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { existsSync, mkdtempSync, cpSync, readFileSync, writeFileSync, rmSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { repoServer, openDashboard, APP_FILE } from "./app-harness.mjs";
import { MENU } from "../src/site/menu.mjs";

const { DASHBOARD } = await import(APP_FILE.href);

// What a page asks the server for below docs/assets/dashboard/: in a browser every import of a view or section file is a request
// to GitHub Pages, and one for a file that is not there is answered 404. Under node the harness's fetch does not see imports, so
// node's module resolution records them — every import, of a file that exists or not, by its path below docs/assets/dashboard/.
const VIEWS = new URL("../docs/assets/dashboard/", import.meta.url);
const imported = [];
registerHooks({
  resolve(specifier, context, next) {
    let url = null;
    try { url = new URL(specifier, context.parentURL); } catch { /* a bare specifier: no file of the site */ }
    if (url?.protocol === "file:" && url.href.startsWith(VIEWS.href)) imported.push(decodeURIComponent(url.pathname.slice(VIEWS.pathname.length)));
    return next(specifier, context);
  },
});

// Every string-rendered address of today: none, each view with a dashboard file — built or not —, the pages within the built
// views, and one that no view answers. UC-001's public settings-pages route has DOM integration coverage separately.
const ADDRESSES = ["", ...DASHBOARD.filter((x) => x.view && x.file).map((x) => `#${x.view}`), "#uc/UC-001", "#review/uc", "#review/arc",
  "#nothing"];
const isThere = (file) => existsSync(new URL(file, VIEWS));

const UC = "docs/use-cases/UC-001-add-a-product.md";
const FILES = {
  "SPEC.md": "# SPEC\n",
  [UC]: "---\nid: UC-001\ntitle: Add a product\narea: setup\nrealises:\n  - NO SERVER\n---\n# UC-001 Add a product\n",
};

// THE MENU FOLLOWS THE PROCESS: with the view files of today, the menu entry by entry — each stage of the process linking to the
// first of its views that is built, a stage none of whose views is built named without a link, then maintenance and settings.
const MENU_OF_TODAY = [
  '<a href="#spec" id="tab-spec" data-entry="requirements">Requirements</a>',
  '<a href="#uc" id="tab-uc" data-entry="use-cases">Use cases</a>',
  '<a href="#arc" id="tab-arc" data-entry="architecture">Architecture</a>',
  // Implementation leads to progress, a route a loaded view provides (ITM-1252).
  '<a href="#progress" id="tab-progress" data-entry="implementation">Implementation</a>',
  '<a href="#schedule" id="tab-schedule" data-entry="tests">Tests</a>',
  '<a href="#mail" id="tab-mail" data-entry="maintenance" title="Issues and mail">Maintenance</a>',
  '<a href="#settings" id="tab-settings" data-entry="settings" title="Every setting Agent M uses"><span aria-hidden="true">⚙</span> Settings</a>',
];

test("with every view file of today, the menu shows the stages of the process in their order, each linked to its page", async () => {
  const page = await openDashboard({ server: await repoServer({ files: FILES }) });
  const remaining = page.el("tabs").split("\n").filter((entry) => entry !== '<a href="#release" id="tab-release" data-entry="releases">Releases</a>');
  assert.deepEqual(remaining, MENU_OF_TODAY);
});

// The expected headings are those MOD-review-pages' routes give their pages (its Interfaces: the files of a kind, one file, Review all);
// How acceptance works is the folded explanation of the topic `accepting` (MOD-site-frame, explain).
test("every address of today is shown — use cases, architecture, SPEC changes, how acceptance works, settings, setup, review pages", async () => {
  const page = await openDashboard({ server: await repoServer({ files: FILES }) });
  const heading = async (hash) => { await page.go(hash); return (/<h2>([^<]*)/.exec(page.main()) || [])[1]?.trim(); };
  assert.equal(await heading("#uc"), "Use cases");
  assert.equal(await heading("#uc/UC-001"), "UC-001 Add a product");
  assert.equal(await heading("#arc"), "Architecture decisions");
  assert.equal(await heading("#spec"), "Current requirements");
  await page.go("#how");
  assert.match(page.main(), /<details class="explain"[^>]*><summary>How acceptance works<\/summary>/);
  assert.match(page.main(), /Accepting is a commit made under your own account/);
  assert.equal(await heading("#settings"), "Settings");
  assert.equal(await heading("#setup"), "Finish setting up your instance");
  assert.equal(await heading("#review/uc"), "Review all — Use cases");
  assert.equal(await heading("#review/arc"), "Review all — the whole architecture");
  // The addresses the review pages write themselves lead to their routes too.
  assert.equal(await heading("#use-case/id=UC-001"), "UC-001 Add a product");
  assert.equal(await heading("#decision"), "Architecture decisions");
  assert.equal(await heading("#spec-entry"), "SPEC changes");
});

test("a view or settings section whose file is not there yet is not shown, and its address shows the use cases", async () => {
  const views = new URL("../docs/assets/dashboard/", import.meta.url);
  const listed = JSON.parse(readFileSync(new URL("built.json", views), "utf8"));
  const missing = DASHBOARD.filter((x) => x.file && !existsSync(new URL(x.file, views)) && !listed.includes(x.file));
  const view = missing.find((x) => x.view && MENU.some((e) => e.views.includes(x.view))), section = missing.find((x) => x.section);
  assert.ok(view && section, "the table names a view of a menu stage and a settings section that have no file yet");
  const page = await openDashboard({ server: await repoServer({ files: FILES }) });
  assert.doesNotMatch(page.el("tabs"), new RegExp(`href="#${view.view}"|id="tab-${view.view}"`));
  await page.go(`#${view.view}`);
  assert.match(page.main(), /<h2>Use cases<\/h2>/);
  await page.go("#settings");
  assert.doesNotMatch(page.main(), new RegExp(`data-settings-section="${section.section}"`));
  // Counter-proof: a view whose file is there is linked from its stage, and the public Settings route is on the page.
  assert.match(page.el("tabs"), /<a href="#uc" id="tab-uc"/);
  assert.match(page.main(), /General.*Repositories.*Endpoints &(?:amp;)? Agents.*Usability/s);
});

// Guards: UC-024
test("a load of every address of today asks for no view or settings file that is not built — no 404 per planned view", async () => {
  const asked = new Map(); // address -> the files below docs/assets/dashboard/ its page load and its navigation asked for
  const server = await repoServer({ files: FILES });
  for (const hash of ADDRESSES) {
    const from = imported.length;
    const page = await openDashboard({ server, hash });
    await page.go("#settings"); // the settings page names every section of the table
    await page.go(hash);
    asked.set(hash || "(none)", imported.slice(from));
  }
  const missing = [...asked].flatMap(([hash, files]) => files.filter((f) => !isThere(f)).map((f) => `${hash}: ${f}`));
  assert.deepEqual(missing, [], "a page asked for files that are not there");
  // The recording sees what a page asks for: the list of built files is among it. The addresses of the routes of modules ask for no view:
  // the app hands them to MOD-review-pages', MOD-implementation-pages' and the other modules' routes before any file is loaded.
  const all = new Set([...asked.values()].flat());
  for (const f of ["built.json"]) {
    assert.ok(all.has(f), `the recording saw ${f}: ${[...all].join(", ")}`);
  }
});

// Guards: UC-024
test("the list of built files beside the views names exactly the files of the table that are there, or views a module answers", async () => {
  const built = JSON.parse(readFileSync(new URL("built.json", VIEWS), "utf8"));
  assert.ok(Array.isArray(built) && built.every((f) => typeof f === "string"), "a JSON list of file names below docs/assets/dashboard/");
  assert.equal(new Set(built).size, built.length, "each file once");
  const named = new Set(DASHBOARD.filter((x) => x.file).map((x) => x.file));
  assert.deepEqual(built.filter((f) => !named.has(f)), [], "the list names only files the table names");
  // A listed file that is not there belongs to views the app hands to a route of MOD-review-pages (the heading each shows is that route's).
  const handed = { "review-views.mjs": ["uc", "arc", "review"], "spec-changes-view.mjs": ["spec"], "how-view.mjs": ["how"] };
  assert.deepEqual(built.filter((f) => !isThere(f) && !handed[f]), [], "the list names only files that are there, or views handed to a module");
  const page = await openDashboard({ server: await repoServer({ files: FILES }) });
  const shows = { uc: /<h2>Use cases<\/h2>/, arc: /<h2>Architecture decisions<\/h2>/, review: /<h2>Use cases<\/h2>/, spec: /<h2>Current requirements<\/h2>/,
    how: /<summary>How acceptance works<\/summary>/ };
  for (const [file, views] of Object.entries(handed)) {
    if (isThere(file) || !built.includes(file)) continue;
    for (const view of views) {
      await page.go(`#${view}`);
      assert.match(page.main(), shows[view], `#${view}: the view of ${file}, which is not there, is shown by a module's route`);
    }
  }
  assert.deepEqual([...named].filter((f) => isThere(f) && !built.includes(f)), [], "every file of the table that is there is listed");
});

test("a request handler a test brings answers before the harness's own GitHub", async () => {
  const privateRepo = async (url, init) => (init.method === "GET" && url.pathname === "/repos/akmaier/agent-m"
    ? new Response(JSON.stringify({ private: true, default_branch: "main", permissions: { push: true } }), { status: 200 }) : null);
  const own = await openDashboard({ server: await repoServer({ files: FILES, handlers: [privateRepo] }), hash: "#settings" });
  assert.ok(own.requests.includes("handler GET https://api.github.com/repos/akmaier/agent-m"), own.requests.join(", "));
  assert.doesNotMatch(own.main(), /will be published/, "the handler's private repository is not warned of publication");
  const publicRepo = async (url, init) => (init.method === "GET" && url.pathname === "/repos/akmaier/agent-m"
    ? new Response(JSON.stringify({ private: false, default_branch: "main", permissions: { push: true } }), { status: 200 }) : null);
  const plain = await openDashboard({ server: await repoServer({ files: FILES, handlers: [publicRepo] }), hash: "#settings" });
  assert.ok(plain.requests.includes("handler GET https://api.github.com/repos/akmaier/agent-m"), plain.requests.join(", "));
  assert.match(plain.main(), /will be published/);
  const fallback = await openDashboard({ server: await repoServer({ files: FILES }), hash: "#settings" });
  assert.ok(!fallback.requests.some((request) => request.startsWith("handler ")),
    "without a test handler the harness answers its own GitHub requests");
});

test("a view may link a stylesheet of its own beside the site's style sheets — once, when it is first shown", async () => {
  // A copy of the site with a view of its own, the Jobs view, whose file names a stylesheet; the copy lists it among the built files. The copy keeps the site's
  // layout — docs/assets/ beside src/, which the dashboard's modules import from.
  const root = realpathSync(mkdtempSync(join(tmpdir(), "agent-m-assets-"))), dir = join(root, "docs", "assets");
  try {
    cpSync(new URL("../docs/assets/", import.meta.url), dir, { recursive: true });
    cpSync(new URL("../src/", import.meta.url), join(root, "src"), { recursive: true });
    writeFileSync(join(dir, "dashboard", "jobs-view.mjs"), 'export const stylesheet = "jobs-view.css";\nexport const routes = { jobs: async (app) => { app.main().innerHTML = "<p>The jobs.</p>"; } };\n');
    const listed = join(dir, "dashboard", "built.json");
    writeFileSync(listed, JSON.stringify([...JSON.parse(readFileSync(listed, "utf8")), "jobs-view.mjs"]));
    const assets = pathToFileURL(join(root, "src", "site-frame") + "/");
    const page = await openDashboard({ server: await repoServer({ files: FILES }), assets });
    assert.deepEqual(page.stylesheets(), [], "the use cases bring none");
    await page.go("#jobs");
    await page.go("#uc");
    await page.go("#jobs");
    assert.match(page.main(), /The jobs\./);
    assert.deepEqual(page.stylesheets(), [new URL("dashboard/jobs-view.css", pathToFileURL(dir + "/")).href]);
    // Counter-proof: the real site's Jobs view is not built, and nothing is linked.
    const real = await openDashboard({ server: await repoServer({ files: FILES }), hash: "#jobs" });
    assert.deepEqual(real.stylesheets(), []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// Guards: ARTIFACTS ARE MARKDOWN; NO SERVER
// given: the live page's app after a page load (so the harness's document is in place), and a text of front matter, an image and a Mermaid block.
// input: the app's md(text), the Markdown the live page writes into its pages.
// expect: the front matter as a table of its one key; the image as a link to its address and no <img>; the Mermaid block as a
//         language-mermaid code block holding its source, escaped — as MOD-markdown-render's renderArtifact draws a text.
test("the live page renders its Markdown with the renderer — front matter as a table, an image as a link, a Mermaid block as its source", async () => {
  await openDashboard({ server: await repoServer({ files: FILES }) });
  const { md } = await import(APP_FILE.href);
  const html = md("---\ntitle: Burn-down\n---\n![the chart](https://example.org/chart.png)\n\n```mermaid\nflowchart LR\n  A --> B\n```\n");
  assert.equal(html.includes('<table class="frontmatter list"><tbody><tr><th>title</th><td>Burn-down</td></tr></tbody></table>'), true, html);
  assert.equal(html.includes('<a href="https://example.org/chart.png">the chart</a>'), true, html);
  assert.equal(html.includes("<img"), false, html);
  assert.equal(html.includes('<code class="language-mermaid">flowchart LR\n  A --&gt; B</code>'), true, html);
});
