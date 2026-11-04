// Release test of ITM-818 — the old settings view and its endpoints section are gone and the pages the module serves in their place still show
// (CODE OUTSIDE THE ARCHITECTURE IS MOVED INTO IT, SPEC.md; the files are those that MOD-settings-pages and MOD-site-frame took over).
// Written for the release testing of sprint team1/138 by a participant who implemented none of ITM-818 (RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER).
// The requirement says what happens to a file that belongs to no module once its module provides what it did: it is removed. Observable in the finished product:
//   - docs/assets/dashboard/settings-view.mjs and docs/assets/dashboard/settings/endpoints.mjs do not exist and no code file or page of the product loads them;
//   - the settings page and its endpoints section are shown by MOD-settings-pages' public routes `settings` and `endpoints`, reached as tests/settings-pages-endpoints.test.mjs reaches them.
// Reading the text leaves open: "no file reads" is read as no import, dynamic import or script tag of a .mjs/.js/.html file names the two paths; a comment or a fixture backlog item that names them is no reader.
// Run: node --test tests/release-itm-818-code-outside-moved.test.mjs
//
// Module: MOD-settings-pages
// Guards: CODE OUTSIDE THE ARCHITECTURE IS MOVED INTO IT
// Level: release

import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { installDocument } from "./settings-pages-harness.mjs";
import { openStore } from "../src/browser-store/index.mjs";

installDocument();
const { view } = await import("../src/settings-pages/index.mjs");
const ROOT = fileURLToPath(new URL("../", import.meta.url));

/** The code and page files of the product: src/, tests/ (without fixtures), docs/ and the index page. */
function codeFiles() {
  const found = [];
  (function walk(dir) {
    for (const name of readdirSync(dir)) {
      if (name === "node_modules" || name === ".git" || name === "fixtures" || name === "worktrees") continue;
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path);
      else if (/\.(mjs|js|html)$/.test(name)) found.push(path);
    }
  })(ROOT);
  return found.filter((path) => !relative(ROOT, path).startsWith(".agent") && !relative(ROOT, path).startsWith(".claude"));
}
/** Paths a file loads: `from "x"`, `import("x")`, `import "x"`, `src="x"`. */
function loadedPaths(text) {
  return [...text.matchAll(/(?:\bfrom\s*|\bimport\s*\(?\s*|\bsrc\s*=\s*)["']([^"']+)["']/g)].map((m) => m[1]);
}
const OLD = /(^|\/)(settings-view\.mjs|settings\/endpoints\.mjs)$/;

// TST-818101 · level: release · module: MOD-settings-pages
// guards: CODE OUTSIDE THE ARCHITECTURE IS MOVED INTO IT
// given: the repository's code and page files; known positive: tests/settings-pages-endpoints.test.mjs, which loads ../src/settings-pages/index.mjs; an instance owner/instance with an empty browser store
// input: look for docs/assets/dashboard/settings-view.mjs and docs/assets/dashboard/settings/endpoints.mjs, list every path each code file loads, and render the routes settings and endpoints of MOD-settings-pages' public view
// expect: neither file exists; no code file loads a path ending in settings-view.mjs or settings/endpoints.mjs, and the scan does find the known positive's load of src/settings-pages/index.mjs; both routes exist (endpoints under the entry settings) and each shows a page with text
test("the old settings view and its endpoints section are removed, no file loads them, and the module's routes show the pages in their place", async () => {
  const files = codeFiles();
  const known = files.find((path) => path.endsWith("tests/settings-pages-endpoints.test.mjs"));
  assert.ok(known, "known positive: the walk lists the endpoints test");
  assert.ok(loadedPaths(readFileSync(known, "utf8")).includes("../src/settings-pages/index.mjs"), "known positive: the scan reads a load from that file");
  assert.equal(existsSync(join(ROOT, "docs/assets/dashboard/settings-view.mjs")), false, "settings-view.mjs is removed");
  assert.equal(existsSync(join(ROOT, "docs/assets/dashboard/settings/endpoints.mjs")), false, "settings/endpoints.mjs is removed");
  const readers = files.filter((path) => path !== fileURLToPath(import.meta.url) && loadedPaths(readFileSync(path, "utf8")).some((p) => OLD.test(p)));
  assert.deepEqual(readers.map((path) => relative(ROOT, path)), [], "no file loads either");

  const route = (name) => view.routes.find((candidate) => candidate.name === name);
  assert.ok(route("settings"), "the settings route exists");
  assert.ok(route("endpoints"), "the endpoints route exists");
  assert.equal(route("endpoints").entry, "settings");
  class Storage { constructor() { this.m = new Map(); } getItem(k) { return this.m.get(k) ?? null; } setItem(k, v) { this.m.set(k, String(v)); } removeItem(k) { this.m.delete(k); } get length() { return this.m.size; } key(i) { return [...this.m.keys()][i] ?? null; } }
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: new Storage() });
  for (const name of ["settings", "endpoints"]) {
    const target = document.createElement("div");
    document.body.append(target);
    await route(name).render(target, { page: "settings", instance: { repository: "owner/instance", host: {} }, product: null, store: openStore("owner/instance"), go() {} }, {});
    assert.ok(target.textContent.trim().length > 0, `${name} shows a page`);
  }
});
