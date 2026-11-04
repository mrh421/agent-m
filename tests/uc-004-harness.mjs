// The harness of the system and release tests of UC-004 (Register a requirement source in the library): the library page opened as a person opens it — MOD-site-frame's frame at a
// fragment over the module view of MOD-settings-pages (tests/settings-pages-sources.d/frame.mjs), against MOD-repository-hosts' real GitHub host answered by the GitHub fixture of
// tests/settings-pages-sources.d/github.mjs and, for the runs of the fetch workflow, tests/settings-pages-sources.d/dispatch.mjs —, a person's input found by what the person sees (a
// button's label, a field's label), and the instance's fetch workflow run as .github/workflows/fetch-sources.yml runs it, `node src/workflow-entries/main.mjs onSourcesCommitted`, in a
// checkout of a temporary git instance (tests/workflow-entries-sources.d/instance.mjs) whose files are those the page committed, with the EU's publication repository replaced by a
// fixture of fetch loaded into that process. Nothing reaches the network. Imported by tests/system-uc-004-register-a-requirement-source.test.mjs and
// tests/release-uc-004-register-a-requirement-source.test.mjs. It holds no test and no expected result: what it builds are inputs, and every test states its own expected values.
//
// Module: MOD-settings-pages
// Module: MOD-source-register
// Level: system
//
// Authored by developer-opus-f (ITM-370), who implemented none of ITM-313, ITM-314, ITM-345, ITM-350, ITM-385, ITM-400, ITM-401 and ITM-402.
//
// The world: the instance akmaier/agent-m, whose register holds `REGISTER` unless a test names other files; the repository akmaier/norms, empty, which this browser's store keeps a
// token for and which a person names for restricted content; the repository akmaier/guide, a source of kind repository at its head; this browser keeps the instance's token, those
// two repositories' tokens and no product.

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { byTag, elements, until } from "./settings-pages-harness.mjs";
import { isWrite, registerEntry, withClass } from "./settings-pages-sources.d/github.mjs";
import { withRuns } from "./settings-pages-sources.d/dispatch.mjs";
import { visit as visitFrame, click, go, settle } from "./settings-pages-sources.d/frame.mjs";
import { envOf, git, withInstance } from "./workflow-entries-sources.d/instance.mjs";

export { byTag, click, go, isWrite, registerEntry, settle, until, withClass };

export const INSTANCE = "akmaier/agent-m";
export const NORMS = "akmaier/norms", NORMS_WEB = "https://github.com/akmaier/norms";
export const GUIDE = "akmaier/guide", GUIDE_WEB = "https://github.com/akmaier/guide";
export const TOKEN = "github_pat_INSTANCE0123456789abcdefghij";
export const NORMS_TOKEN = "github_pat_NORMS0123456789abcdefghijklm";
export const GUIDE_TOKEN = "github_pat_GUIDE0123456789abcdefghijklm";
export const AI_ACT = "https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32024R1689";
export const AI_ACT_ELI = "https://eur-lex.europa.eu/eli/reg/2024/1689/oj";

export const sha = (text) => createHash("sha256").update(text).digest("hex");
const bytesOf = (text) => new TextEncoder().encode(text);
/** fileOf(name, text) -> a file as the browser's file field hands it over. */
export const fileOf = (name, text) => ({ name, text, size: bytesOf(text).length, arrayBuffer: async () => bytesOf(text).buffer.slice(0) });

/** The register the instance holds: IEC 62304 (a standard, only hashed) and the EU AI Act (an EU legal text, fetched). */
export const REGISTER = {
  "docs/sources/SRC-iec-62304.md": registerEntry({ id: "SRC-iec-62304", title: "IEC 62304", kind: "standard", authority: "normative", licence: "restricted - the publisher's terms",
    designation: "IEC 62304:2006+AMD1:2015", versions: [{ version: "IEC 62304:2006+AMD1:2015", date: "2026-10-02", hash: "2".repeat(64), notStored: ["iec-62304.pdf"],
      files: [{ name: "iec-62304.pdf", sha256: "b".repeat(64) }] }] }),
};

// ---------------------------------------------------------------- the page

let runs = null; // the workflow runs and dispatches of the page opened last
/**
 * visit(t, fragment, { files?, log?, settings? }) -> page — the frame opened at `fragment` (#library, #library/source=<id>) over the world above; `files` replaces the instance's
 * files; `log`, where given, makes the instance hold one failed run of fetch-sources.yml whose log is that text. `page.world` records every request and commit.
 */
export async function visit(t, fragment, { files = REGISTER, log, settings = {} } = {}) {
  const page = await visitFrame(t, fragment, {
    repositories: { [INSTANCE]: { files }, [NORMS]: { files: {}, visibility: "private" }, [GUIDE]: { files: { "README.md": "The guide.\n" } } },
    settings: { "github-token": { value: TOKEN, name: "Agent M - akmaier/agent-m", expires: "2027-01-01" }, products: [],
      [`github-token:${NORMS}`]: { value: NORMS_TOKEN, name: "Agent M - norms", expires: "2027-01-01" },
      [`github-token:${GUIDE}`]: { value: GUIDE_TOKEN, name: "Agent M - guide", expires: "2027-01-01" }, ...settings },
    serve: (world) => { runs = withRuns(world, INSTANCE, { log }); return runs.fetch; },
  });
  page.runs = runs;
  return page;
}

export const text = (page) => String(page.main().textContent).replace(/\s+/g, " ");
export const buttonLabelled = (page, pattern) => byTag(page.main(), "button").find((button) => pattern.test(button.textContent));
/** The field inside the label whose text begins with `start`. */
export const fieldLabelled = (page, start, tag = "input") => {
  const label = byTag(page.main(), "label").find((each) => each.textContent.trim().startsWith(start));
  return label ? byTag(label, tag)[0] : undefined;
};
/** The form built from the entry's schema: the field of a key, its Save. */
export const formOf = (page) => withClass(page.main(), "library-form-box")[0];
const keyed = (form, key) => elements(form, (node) => node.getAttribute?.("data-key") === key)[0];
export const inputOf = (page, key) => byTag(keyed(formOf(page), key), "input")[0];
export const saveOf = (page) => byTag(formOf(page), "button").filter((button) => button.textContent === "Save").at(-1);
/** The folded explanations (details elements) inside `root`. */
export const folded = (root) => byTag(root, "details");

/** A person types `value` into a field: the field takes it and reports the input and the change. */
export async function enter(field, value) {
  field.value = value;
  field.dispatchEvent(new Event("input"));
  field.dispatchEvent(new Event("change"));
  await settle();
}
/** + Register source, and the answer to "What is the source?": legal-text, standard, documents or repository. */
export async function register(page, route) {
  await click(buttonLabelled(page, /^\+ Register source$/));
  await enter(fieldLabelled(page, "What is the source?", "select"), route);
}
/** The common fields typed into the form, one after the other. */
export async function describe(page, fields) {
  for (const [key, value] of Object.entries(fields)) await enter(inputOf(page, key), value);
}
/** The files chosen in the field "Files"; the page shows each with its SHA-256 before the test goes on. */
export async function choose(page, files) {
  const input = fieldLabelled(page, "Files");
  input.files = files;
  input.dispatchEvent(new Event("change"));
  await until(() => files.every((file) => text(page).includes(`${file.name}: ${sha(file.text)}`)), "the files are hashed");
  await settle();
}
/** "Only hash it" ticked for the file named `name`, and the note where its copy is kept typed beside it. */
export async function onlyHash(page, name, note) {
  const row = byTag(page.main(), "p").find((each) => each.textContent.startsWith(`${name}: `));
  const [tick] = byTag(row, "input").filter((input) => input.type === "checkbox");
  tick.checked = true;
  tick.dispatchEvent(new Event("change"));
  await settle();
  if (note !== undefined) await enter(byTag(row, "input").find((input) => input.type !== "checkbox"), note);
}
/** Save pressed, and the time the commits take. */
export async function save(page) {
  await click(saveOf(page));
  await until(() => /✓|✗/.test(text(page)), "the result of Save");
  await settle();
}

export const commitsOf = (page, repository) => page.world.commits(repository);
export const writes = (page) => page.world.requests.filter(isWrite);
/** What the library's list shows of the source titled `title`: the text of the smallest section that holds it, or null. */
export const listed = (page, title) => {
  const section = byTag(page.main(), "section").filter((each) => each.textContent.includes(title)).sort((a, b) => a.textContent.length - b.textContent.length)[0];
  return section ? String(section.textContent).replace(/\s+/g, " ") : null;
};

// ---------------------------------------------------------------- the fetch workflow

// The EU's publication repository, loaded into the workflow's process before its entry: every request is written to stderr as `publication request <url>`; a request to any other
// origin is refused; UC004_PUBLICATION "offline" makes the repository unreachable, any other value is the text it answers, an XHTML file 32024R1689.xhtml retrieved on 16 July 2024
// at the version cellar-2024-07-12.
const PUBLICATION = `data:text/javascript,${encodeURIComponent(`
globalThis.fetch = async (input) => {
  const url = String(input?.url ?? input);
  process.stderr.write("publication request " + url + "\\n");
  if (new URL(url).origin !== "https://publications.europa.eu") throw new Error("unscripted request: " + url);
  if (process.env.UC004_PUBLICATION === "offline") throw new Error("publication offline");
  return new Response(process.env.UC004_PUBLICATION, { status: 200, headers: { "content-type": "application/xhtml+xml",
    "content-disposition": 'attachment; filename="32024R1689.xhtml"', date: "Tue, 16 Jul 2024 12:00:00 GMT", etag: '"cellar-2024-07-12"' } });
};`)}`;

/**
 * runFetchWorkflow(files, { publication, source? }) -> { exit, log, requested, before, after, changed } — the instance's workflow fetch-sources.yml run once over an instance
 * whose default branch holds `files`: on a push, or, with `source`, started by hand with that input. `log` is what the run prints, `requested` the addresses the publication
 * repository was asked for, `before` and `after` the files of the default branch before and after the run, `changed` the paths the run's commit changed.
 */
export async function runFetchWorkflow(files, { publication, source } = {}) {
  return withInstance(files, async (instance) => {
    const env = { ...process.env, ...envOf(instance, source === undefined ? undefined : { source }), UC004_PUBLICATION: publication };
    const run = spawnSync(process.execPath, ["--import", PUBLICATION, "src/workflow-entries/main.mjs", "onSourcesCommitted"], { env, cwd: fileURLToPath(new URL("..", import.meta.url)), encoding: "utf8", timeout: 30000 });
    const head = git(instance.origin, "rev-parse", "main");
    const changed = head === instance.head ? [] : git(instance.origin, "diff", "--name-only", instance.head, head).split("\n").filter(Boolean);
    const after = { ...files };
    for (const path of changed) after[path] = `${git(instance.origin, "show", `main:${path}`)}\n`;
    const requested = String(run.stderr).split("\n").filter((line) => line.startsWith("publication request ")).map((line) => line.slice("publication request ".length));
    return { exit: run.status, log: String(run.stdout), stderr: String(run.stderr), requested, before: files, after, changed };
  });
}
