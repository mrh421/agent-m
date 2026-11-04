// The harness of the system and release tests of UC-031 (Configure a process model) that tests/release-uc-031-configure-a-process-model.test.mjs does not hold: the route `models` of MOD-implementation-pages as the
// address #models and #models/name=<name> leads to it, drawn into a fixture DOM over the real MOD-repository-hosts GitHub host behind tests/app-harness.mjs' fake of GitHub's API (git-data commits included), and, for the
// products of this browser, a fake of GitHub of their own. A person's click is the page's own listener called with a trusted event, a script's click one whose isTrusted is false; a person types by calling the field's
// own input listener; no input event of the operating system is made and nothing reaches the network.
// Imported by tests/system-uc-031-configure-a-process-model.test.mjs and tests/release-uc-031-the-requirements-of-a-model.test.mjs. It holds no test and no expected result: what it builds are inputs, and every test states
// its own expected values. The reading of the form is that of the existing release file (a form part by its heading, a finding by the part it stands beside, a button by its text), kept here as a copy because that file holds
// tests and cannot be imported.
//
// Module: MOD-implementation-pages
// Module: MOD-model-catalogue
// Level: system
//
// Authored by developer-sonnet-l (ITM-802), who implemented none of ITM-776, ITM-777, ITM-778, ITM-779 or ITM-780 and no UC-031 production behaviour.

import { readFileSync } from "node:fs";
import "./site-frame-dom.mjs";
import { repoServer } from "./app-harness.mjs";
import { classed, declaration, open, settle, typeInto, walk, HEAD, lines, textOf } from "./uc-032-harness.mjs";
import { catalogue } from "../src/model-catalogue/index.mjs";
import { openStore, writeSetting } from "../src/browser-store/index.mjs";

export { classed, declaration, open, settle, typeInto, walk, HEAD, lines, textOf };

export const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
export const SHIPPED_NAMES = ["waterfall", "v-model", "reuse-oriented", "scrum", "kanban"];
export const SHIPPED = Object.fromEntries(SHIPPED_NAMES.map((name) => [`src/model-catalogue/models/${name}.md`, read(`src/model-catalogue/models/${name}.md`)]));
export const INSTANCE = { ...SHIPPED, "README.md": "# Agent M\n" };
export const PHASES = ["Concept", "Requirements", "Design", "Implementation", "Testing", "Validation & Verification", "Operation & Maintenance"];
export const ADAPTED = "docs/process-models/v-model-adapted.md";
export const LIBRARY = "https://github.com/alice/library";
export const BARE = "https://github.com/alice/bare";

// ---------------------------------------------------------------- the address: #models/name=<name> leads to the route `models` with the parameter name

/** routeAt(fragment) -> { name, params } — the first part of the fragment is the route, the parts `key=value` its parameters, each percent-encoded (MOD-site-frame's reading of an address). */
export function routeAt(fragment) {
  const [name = "", ...given] = String(fragment).replace(/^#/, "").split("/").filter(Boolean);
  const params = {};
  for (const part of given) {
    const at = part.indexOf("=");
    if (at > 0) params[decodeURIComponent(part.slice(0, at))] = decodeURIComponent(part.slice(at + 1));
  }
  return { name: decodeURIComponent(name), params };
}
/** The links of a page whose text is `label`, as { href, text }. */
export const linksNamed = (target, label) => walk(target, (node) => node.localName === "a" && node.textContent.trim() === label).map((node) => ({ href: node.getAttribute("href"), text: node.textContent.trim() }));

// ---------------------------------------------------------------- the page, as a person reads and fills it

export const heading = (page) => walk(page.target, (node) => node.localName === "h2")[0]?.textContent;
export const withText = (page, name, test) => walk(page.target, (node) => node.localName === name && test(node.textContent.trim()));
export const partTitled = (page, title) => walk(page.target, (node) => node.localName === "section" && [...node.childNodes].some((kid) => kid.localName === "h3" && kid.textContent === title))[0];
export const fieldOf = (page, key) => walk(page.target, (node) => node.getAttribute("data-key") === key)[0];
export const valueOf = (page, key) => fieldOf(page, key).getElementsByTagName("input")[0].value;
export const sectionOf = (page, part) => walk(page.target, (node) => node.getAttribute("data-section") === part)[0];
export const areaOf = (page, part) => sectionOf(page, part).getElementsByTagName("textarea")[0];
// The findings standing beside a part: the lines of its marks and its list of findings, not the text of the part itself.
export const findingsIn = (field) => [...classed(field, "marks"), ...classed(field, "findings")].map((list) => list.textContent).join("\n").trim();
export const besideSection = (page, part) => findingsIn(sectionOf(page, part));
export const besideKey = (page, key) => findingsIn(fieldOf(page, key));
// The form's own Save is the last Save of the page, after the Save of each section's editor.
export const saveOf = (page) => withText(page, "button", (text) => text === "Save").at(-1);
export const disabledOf = (control) => control.disabled === true || control.getAttribute("disabled") !== null;
export const typeSection = (page, part, text) => typeInto(areaOf(page, part), text);
export const typeKey = (page, key, text) => typeInto(fieldOf(page, key).getElementsByTagName("input")[0], text);
export const addRow = (page, part, row) => typeSection(page, part, `${areaOf(page, part).value.trimEnd()}\n${row}\n`);
export async function replaceIn(page, part, from, to) {
  const before = areaOf(page, part).value;
  const after = before.replace(from, to);
  if (after === before) throw new Error(`known positive: "${from}" stands in ${part}`);
  await typeSection(page, part, after);
}
export const diagramOf = (page) => classed(page.target, "mermaid").map((node) => node.textContent).join("\n");
export const previewOf = (page) => partTitled(page, "The plan for a product");
export const kindButton = (page, kind) => withText(page, "button", (text) => text === kind)[0];
export const previewButton = (page, address) => withText(page, "button", (text) => text === address)[0];
// The preview's count ("N requirements × P phases = E plan entries"), and its phases: each an h4 with the requirements listed under it.
export const countOf = (page) => walk(previewOf(page), (node) => node.localName === "p" && /^\d+ requirements? × \d+ phases? = \d+ plan entries?$/.test(node.textContent))[0]?.textContent;
export const phasesOf = (page) => walk(previewOf(page), (node) => node.localName === "h4").map((node) => ({ name: node.textContent, entries: walk(node.parentNode, (inner) => inner.localName === "li").map((entry) => entry.textContent) }));
export const commitsOf = (page) => page.srv.writes;
// The harness's fake fast-forwards the ref refs/heads/main with the one request it counts as "write ref".
export const movedMain = (page) => page.srv.requests.filter((what) => what === "write ref");

// The list: one entry per model, found by its name; its kind of work, its products and its findings.
export const entryOf = (page, name) => walk(page.target, (node) => node.localName === "li" && node.getAttribute("data-model") === name)[0];
export const kindOfEntry = (entry) => classed(entry, "kind")[0]?.textContent;
export const productsOfEntry = (entry) => classed(entry, "products")[0] ? walk(classed(entry, "products")[0], (node) => node.localName === "li").map((node) => node.textContent) : [];
export const namesIn = (page) => walk(page.target, (node) => node.localName === "li" && node.getAttribute("data-model") !== null).map((node) => node.getAttribute("data-model"));

// ---------------------------------------------------------------- this browser: its storage, its store, the products it manages and the token of each

export class Storage {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
  get length() { return this.values.size; }
  key(index) { return [...this.values.keys()][index] ?? null; }
}
export function browserStore(products = [LIBRARY, BARE]) {
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: new Storage() });
  const store = openStore("akmaier/agent-m");
  writeSetting(store, "products", products);
  for (const address of products) {
    const name = address.split("/").at(-1);
    writeSetting(store, `github-token:alice/${name}`, { value: `github_pat_${name.toUpperCase()}0123456789abcdefghij`, name, expires: "2027-01-01" });
  }
  return store;
}

// ---------------------------------------------------------------- the products the page reads

export const requirement = (name) => [`**${name}** *(PO A. Maier)*`, `The rule ${name}.`, "*Check:* no automatic check; at review.", ""];
export const specOf = (...names) => ["# SPEC", "", "## 1. Rules", "", ...names.flatMap(requirement)].join("\n");
const json = (body) => new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
export const NOTHING = (url) => (/\/(pulls|tags|commits)$/.test(url.pathname) ? json([]) : /\/actions\/runs$/.test(url.pathname) ? json({ total_count: 0, workflow_runs: [] }) : undefined);

/**
 * products({ library, bare }) -> { library, bare, answers } — the fake GitHub of alice/library (its SPEC holds three requirements, plus `library` laid over its files) and of alice/bare (no SPEC, plus `bare`), and the
 * request handler that hands the requests for either of them to its fake; the instance's fake is handed `answers` as one of its `server` handlers.
 */
export async function products({ library = {}, bare = {} } = {}) {
  const one = await repoServer({ repo: "alice/library", head: "1".repeat(40), files: { "SPEC.md": specOf("A LOAN HAS A DUE DATE", "A LATE LOAN IS NAMED", "A RETURN IS RECORDED"), ...library }, handlers: [NOTHING] });
  const two = await repoServer({ repo: "alice/bare", head: "2".repeat(40), files: { "README.md": "# A product with no SPEC yet\n", ...bare }, handlers: [NOTHING] });
  const answers = (url, init) => (url.pathname.startsWith("/repos/alice/library") || url.pathname.startsWith("/alice/library/") || String(init.body ?? "").includes('"name":"library"') ? one.fetch(url, init)
    : url.pathname.startsWith("/repos/alice/bare") || url.pathname.startsWith("/alice/bare/") || String(init.body ?? "").includes('"name":"bare"') ? two.fetch(url, init) : undefined);
  return { library: one, bare: two, answers };
}

/** The docs/process.md of a product that declares the model at `modelFile` as it stood at the instance's head. */
export const declares = (modelFile) => ({ "docs/process.md": declaration(modelFile) });

/** The route `models` drawn for the address `fragment`, with the instance's `files` and the products around it (`around`, from products()). */
export async function reach(fragment, { files = INSTANCE, around = null, products: kept = [LIBRARY, BARE] } = {}) {
  const { name, params } = routeAt(fragment);
  const page = await open(name, params, { files, store: browserStore(kept), server: around ? [around.answers] : [] });
  await settle();
  return Object.assign(page, { around, address: fragment });
}
/** The editor of the model `name` as the address #models/name=<name> leads to it. */
export const edit = (name, options = {}) => reach(`#models/name=${encodeURIComponent(name)}`, options);

// The catalogue as UC-002 reads it from the instance's files after a commit.
export function snapshotOf(files) {
  const held = { ...files };
  return { repository: { server: "github", path: "akmaier/agent-m" }, ref: "main", commit: "9".repeat(40), paths: Object.keys(held), read: async (path) => held[path] ?? null, readMany: async () => {}, blob: () => null };
}
/** The catalogue of the instance after the commits of `page`. */
export const catalogueAfter = (page, base = SHIPPED) => catalogue(snapshotOf(Object.assign({}, base, ...commitsOf(page).map((commit) => commit.files))));

// A minimal planned model of two phases, typed into + New model: every part of the definition, nothing more.
export const TINY = {
  name: "tiny-plan",
  "## Phases": "| Name | Role | Produces |\n|---|---|---|\n| Specify | Owner | requirements |\n| Build | Builder | MOD |\n",
  "## Transitions": "| From | To | Kind |\n|---|---|---|\n| Specify | Build | sequence |\n",
  "## Verification pairs": "| Phase | Checked by |\n|---|---|\n| Specify | Build |\n",
  "## Gates": "| Between | Artifacts | Condition | Decider |\n|---|---|---|---|\n| Specify → Build | the requirements | every requirement states how it is checked | Owner |\n",
  "## Roles": "| Name | Filled by | How many | Capabilities |\n|---|---|---|---|\n| Owner | person | one | read the repository |\n| Builder | either | several | read the repository, write to the repository |\n",
};
/** + New model of the kind `kind`, with TINY typed into it. */
export async function typedNew(kind = "planned", options = {}) {
  const page = await reach("#models/name=", options);
  await page.press(kindButton(page, kind));
  await typeKey(page, "name", TINY.name);
  for (const part of ["## Phases", "## Transitions", "## Verification pairs", "## Gates", "## Roles"]) await typeSection(page, part, TINY[part]);
  return page;
}
