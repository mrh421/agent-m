// The subject the specification view gives the prompt bar (docs/architecture/MOD-trace-pages.md, Data: specification; Interfaces: view),
// MOD-prompt-bar's `Subject`, for UC-049, UC-019 (step 1) and UC-020 (1a). A subject is context only: the bar runs `converse` on every page.
// - at the current state — the default branch, or the earlier version shown while the head's graph is stored — the open requirement, or the group
//   with the names it holds, as `requirements`, the person's own source where the product
//   links one, and the review pages' `draft` as its draft route, `draft/subject=<key, encoded>`, in the form the review pages' own subjects give;
//   with nothing open, the page and the person's own source where there is one; a missing source refuses nothing here — a change of requirements
//   refuses by its own precondition (UC-019 4b);
// - at a released version, the requirement as it read there, and no draft route, since a change is drafted only against the current text;
// - every other view the frame's default with the version shown among its page.
// "The open requirement" is the one whose detail was opened last and is still open; "the open group" the group of the group file whose list was opened last
// and is still open; an open requirement is the narrower subject and wins. The subject is read at each Send, so what is open is kept as
// the person opens and closes it, and the person's source is read when the page is drawn: a subject reads nothing and sends nothing.
//
// Module: MOD-trace-pages
// Private to the module: flow.mjs uses it.

import { personAccount, personSource, sourceSchemas } from "../source-register/index.mjs";
import { readDocument } from "../documents/index.mjs";

const DRAFT_ROUTE = "draft";

/** opening(list, item, open, same) — `item` in `list` as the last one opened while `open`, and out of it once closed. */
export function opening(list, item, open, same = (a, b) => a === b) {
  const at = list.findIndex((each) => same(each, item));
  if (at >= 0) list.splice(at, 1);
  if (open) list.push(item);
}

const instanceSnapshots = new WeakMap();

/**
 * instanceSnapshot(context) -> Promise<Snapshot> — the instance's snapshot at its default branch, through the host the frame gave the route
 * (`context.instance.host`), read once for the context and handed to every caller of it, however often the version is drawn again
 * (A PAGE LOAD READS THE REPOSITORY IN BATCHES: the commit and its tree once). A read that failed is not kept: the next caller reads again.
 */
export function instanceSnapshot(context) {
  let held = instanceSnapshots.get(context);
  if (held === undefined) {
    const { host } = context.instance;
    held = (async () => host.readSnapshot((await host.repositoryInfo()).defaultBranch))();
    instanceSnapshots.set(context, held);
    held.catch(() => { if (instanceSnapshots.get(context) === held) instanceSnapshots.delete(context); });
  }
  return held;
}

/**
 * personsSource(context, snapshot) -> Promise<string | null> — the identifier of the register entry of the person who prompts, which the
 * product links (THE PERSON WHO PROMPTS IS A SOURCE): the product's links file at `snapshot`, and the instance's register at its default branch,
 * read through the hosts the frame gave the route. Null when there is none, and when a host or the context cannot say.
 */
export async function personsSource(context, snapshot) {
  try {
    const { entry, links } = sourceSchemas();
    const instance = await instanceSnapshot(context);
    const entries = instance.paths.filter((path) => /^docs\/sources\/[^/]+\.md$/.test(path));
    // The files are named to Snapshot.readMany before they are read (as MOD-trace-pages' moduleFilesOf does): one batch where the links file and the
    // register are one snapshot, the register's own where they are not; a host that cannot batch reads nothing ahead.
    if (instance === snapshot) await snapshot.readMany?.(["docs/sources.md", ...entries]);
    else await instance.readMany?.(entries);
    const linked = readDocument(links, "docs/sources.md", (await snapshot.read("docs/sources.md")) ?? "");
    const register = await Promise.all(entries.map(async (path) => readDocument(entry, path, (await instance.read(path)) ?? "")));
    return personSource(linked, register, personAccount(instance));
  } catch {
    return null;
  }
}

const encoded = encodeURIComponent;

const lines = (...parts) => parts.filter((part) => typeof part === "string" && part !== "").join("\n");

/**
 * subjectOf({ title, params, context, shown }) -> Subject — the subject of the route `trace` shown with these `params` and this `context`;
 * `shown` is what the route has kept while it was drawn: `target` (what it has drawn), `ref` (the version shown, which the version choice may have changed from `params.ref`), `onDefaultBranch`, `spec` (as parseSpec reads it),
 * `source` (the person's, or null), and `requirements` (names) and `groups` ({ heading, path, names }) in the order they were opened; null where
 * the route was not drawn with this context. `key` tells the view, the version, what is open and the product apart.
 */
export function subjectOf({ title, params, context, shown }) {
  const ref = shown?.ref ?? params.ref;
  const address = context.product?.address;
  const version = typeof ref === "string" && ref !== "" ? `Version: ${ref}` : "";
  const keyOf = (...parts) => ["trace", `key=${encoded(params.key ?? "")}`, ...(version ? [`ref=${encoded(ref)}`] : []), ...parts,
    ...(address ? [`product=${encoded(address)}`] : [])].join("/");
  const pageText = () => lines(title, address, version, shown?.target.textContent);
  const own = () => (typeof shown?.source === "string" ? { source: shown.source } : {});
  const frames = () => ({ key: keyOf(), title, paramsFor: () => ({ page: pageText(), ...(params.key === "specification" ? own() : {}) }),
    draftRoute: null, withhold: null, refuses: [] });
  if (params.key !== "specification" || !shown?.spec) return frames();

  const name = shown.requirements.at(-1);
  const group = shown.groups.at(-1);
  const changing = (part, names, about) => {
    const key = keyOf(part);
    return { key, title: about,
      paramsFor: () => ({ page: lines(pageText(), `Open: ${about}`, ...names), requirements: [...names], ...own() }),
      draftRoute: `${DRAFT_ROUTE}/subject=${encoded(key)}`, withhold: null, refuses: [] };
  };
  if (name !== undefined && shown.onDefaultBranch) return changing(`requirement=${encoded(name)}`, [name], name);
  if (name === undefined && group !== undefined && shown.onDefaultBranch) {
    return changing(`requirements=${encoded(JSON.stringify(group.names))}`, group.names, group.heading);
  }
  const requirement = name === undefined ? undefined : shown.spec.requirements.get(name);
  if (requirement === undefined) return frames();
  return { key: keyOf(`requirement=${encoded(name)}`), title: `${name} at ${ref}`,
    paramsFor: () => ({ page: lines(title, address, version, `Requirement ${name}`, `Source: ${requirement.source ?? ""}`,
      `Rule: ${requirement.rule ?? ""}`, `Check: ${requirement.check ?? ""}`) }),
    draftRoute: null, withhold: null, refuses: [] };
}
