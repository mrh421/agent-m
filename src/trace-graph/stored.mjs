// Stored — the graph of one commit as a text and back (MOD-trace-graph, Interfaces: graphText, graphFromText), the file
// `<commit>.json.gz` of the branch `trace-cache`: the text, gzipped by the workflow, so that a page transfers a tenth of it. graphText gives the same text for the same graph, and names the commit the graph was
// built for; graphFromText restores the graph from such a text for that commit, or gives null for a text that is no graphText or names
// another commit. Neither reads nor writes anything.
//
// Module: MOD-trace-graph

import { blobSha } from "../text-tools/index.mjs";
import { traceGraph } from "./build.mjs";
import { architectureImpact, coverageGaps, requirementImpact } from "./derive.mjs";

// The format mark of a stored graph: a text without it, or with another, is no graphText of this module.
const FORMAT = "agent-m-trace-graph";
const VERSION = 1;

/**
 * graphText(graph: Graph) -> string — the graph as one text, the same text for the same graph, that names the commit the graph was
 * built for. The nodes stand in the order of the graph's map, each with its identifier.
 * @param {object} graph
 * @returns {string}
 */
export function graphText(graph) {
  const { commit, nodes, edges, files, links, positions, unread } = graph;
  return `${JSON.stringify({ format: FORMAT, version: VERSION, commit, nodes: [...nodes], edges, files, links, positions, unread })}\n`;
}

/**
 * graphFromText(text: string, commit: string) -> Graph | null — the graph the text holds, or null for a text that is no graphText
 * or names a commit other than `commit`. Reads nothing.
 * @param {string} text
 * @param {string} commit
 * @returns {object | null}
 */
export function graphFromText(text, commit) {
  let held;
  try { held = JSON.parse(text); } catch { return null; }
  if (held === null || typeof held !== "object" || held.format !== FORMAT || held.version !== VERSION) return null;
  if (typeof commit !== "string" || commit === "" || held.commit !== commit) return null;
  const lists = [held.nodes, held.edges, held.files, held.links, held.positions, held.unread];
  if (!lists.every(Array.isArray) || !held.nodes.every((entry) => Array.isArray(entry) && entry.length === 2)) return null;
  return { commit: held.commit, nodes: new Map(held.nodes), edges: held.edges, files: held.files, links: held.links,
    positions: held.positions, unread: held.unread };
}

// The branch the graphs are stored on, and the files of a commit on it.
const BRANCH = "trace-cache";
export const fileOf = (commit) => `${commit}.json.gz`;
// The file of the branch that names the commit of the graph stored last: `{ commit }`, written with every commit that adds a graph (publishGraph), read by latestGraph.
export const LATEST = "latest.json";

// A text gzipped, and gzipped bytes as their text: the platform's CompressionStream, the same in a browser and in Node.
const through = (bytes, stream) => new Response(new Blob([bytes]).stream().pipeThrough(stream));
export const gzipped = async (text) => new Uint8Array(await through(new TextEncoder().encode(text), new CompressionStream("gzip")).arrayBuffer());
export const gunzipped = (bytes) => through(bytes, new DecompressionStream("gzip")).text();
const impactsOf = (commit) => `${commit}.impacts.json`;
const IMPACTS_FORMAT = "agent-m-trace-impacts";
// The coverage gaps of a commit's graph (coverageGaps), stored beside the graph, so that a page that only counts them transfers a few kilobytes, not the graph.
export const gapsOf = (commit) => `${commit}.gaps.json`;
const GAPS_FORMAT = "agent-m-trace-gaps";
// What names each requirement of a commit's graph, gzipped, stored beside the graph for the impact lists of the SPEC changes that wait.
export const referencesFile = (commit) => `${commit}.references.json.gz`;
const REFERENCES_FORMAT = "agent-m-trace-references";

/**
 * storedGaps(source: TextSource, commit: string) -> Promise<object | null> — coverageGaps of the graph stored for `commit`, as publishGraph stored
 * them beside it, read with the source's `readOn` in one request; null without `readOn`, or when the branch or the file is missing or holds another format.
 * @param {object} source @param {string} commit
 * @returns {Promise<object | null>}
 */
export async function storedGaps(source, commit) {
  if (typeof source?.readOn !== "function" || typeof commit !== "string" || commit === "") return null;
  let held;
  try { held = JSON.parse(await source.readOn(BRANCH, gapsOf(commit))); } catch { return null; }
  if (held === null || typeof held !== "object" || held.format !== GAPS_FORMAT || held.version !== VERSION || held.commit !== commit) return null;
  const gaps = held.gaps;
  const lists = ["requirementsWithoutUseCase", "requirementsWithoutModule", "requirementsWithoutTest", "useCasesWithoutRequirement", "unknownNames"];
  if (gaps === null || typeof gaps !== "object" || !lists.every((name) => Array.isArray(gaps[name]))) return null;
  return gaps;
}

/**
 * storedReferences(source: TextSource, commit: string) -> Promise<Map<string, string[]> | null> — for each requirement of the graph stored for `commit`, and
 * each name an edge of it leads to that no node is, the identifiers of what names it, as requirementImpact gives them (each once, in its order; none for a
 * requirement nothing names) — a name it holds no entry for is named by nothing —, from
 * `<commit>.references.json.gz`, which publishGraph stores beside the graph, read with the source's `readOn` in one request; null without `readOn`, or when
 * the branch or the file is missing or holds another format.
 * @param {object} source @param {string} commit
 * @returns {Promise<Map<string, string[]> | null>}
 */
// The references read in this page, by commit, once each however many entries ask: the promise is kept, so that entries asking at once share the one request, and
// so is a commit that holds none, whose entries then read the graph.
const REFERENCES = new Map();
export function storedReferences(source, commit) {
  if (typeof source?.readOn !== "function" || typeof commit !== "string" || commit === "") return Promise.resolve(null);
  if (!REFERENCES.has(commit)) {
    const reading = referencesAt(source, commit);
    REFERENCES.set(commit, reading);
    reading.catch(() => REFERENCES.delete(commit));
  }
  return REFERENCES.get(commit);
}

async function referencesAt(source, commit) {
  let held;
  try {
    const bytes = await source.readOn(BRANCH, referencesFile(commit), { bytes: true });
    held = JSON.parse(await gunzipped(bytes));
  } catch { return null; }
  if (held === null || typeof held !== "object" || held.format !== REFERENCES_FORMAT || held.version !== VERSION || held.commit !== commit) return null;
  const references = held.references;
  if (references === null || typeof references !== "object" || Array.isArray(references)
    || !Object.values(references).every((ids) => Array.isArray(ids) && ids.every((id) => typeof id === "string"))) return null;
  return new Map(Object.entries(references));
}

// What names each requirement of the graph, and each name an edge leads to that no node is — a requirement a change would add may be named already —:
// requirementImpact's identifiers, each once.
const referencesOf = (graph) => Object.fromEntries([...new Set([...[...graph.nodes.values()].filter((node) => node.kind === "requirement").map((node) => node.id),
  ...graph.edges.map((edge) => edge.to).filter((name) => !graph.nodes.has(name))])].sort()
  .map((name) => [name, [...new Set(requirementImpact(graph, name).map((place) => place.id))]]));

// The text of the impact lists of `commit`: for each changed file its path, its blob at the commit, the commit of the text it was last
// accepted at (null for a file never accepted) and architectureImpact of the graph for that change.
async function impactsText(graph, snapshot, commit, changed) {
  const entries = [];
  for (const { path, before } of changed) {
    const after = await snapshot.read(path);
    entries.push({ path, blob: after === null ? null : await blobSha(after), before: before?.commit ?? null,
      impact: architectureImpact(graph, [{ path, before: before?.text ?? null, after }]) });
  }
  return `${JSON.stringify({ format: IMPACTS_FORMAT, version: VERSION, commit, entries })}\n`;
}

/**
 * storedImpacts(source: TextSource, commit: string) -> Promise<Map<string, { blob: string | null, before: string | null, impact: object }> | null> —
 * the impact lists stored for `commit` by publishGraph, keyed by path, read with the source's `readOn` in one request; null without `readOn`, or
 * when the branch or the file is missing or holds another format. A caller uses an entry only while the file's blob is the one stored.
 * @param {object} source @param {string} commit
 * @returns {Promise<Map<string, object> | null>}
 */
export async function storedImpacts(source, commit) {
  if (typeof source.readOn !== "function") return null;
  let held;
  try { held = JSON.parse(await source.readOn(BRANCH, impactsOf(commit))); } catch { return null; }
  if (held === null || typeof held !== "object" || held.format !== IMPACTS_FORMAT || held.version !== VERSION || held.commit !== commit) return null;
  const sound = (entry) => entry && typeof entry.path === "string" && entry.impact && typeof entry.impact === "object";
  if (!Array.isArray(held.entries) || !held.entries.every(sound)) return null;
  return new Map(held.entries.map(({ path, blob, before, impact }) => [path, { blob, before, impact }]));
}

/**
 * publishGraph(host: Host, snapshot: Snapshot, changed?: Array<{ path: string, before: { commit: string, text: string } | null }>) ->
 * Promise<{ commit: string, written: boolean }> — builds the graph of the snapshot's commit from its files and adds `<commit>.json.gz` (its graphText gzipped) to the
 * branch `trace-cache` by `commitFiles`, on the head it read, and beside it `<commit>.gaps.json`, the graph's coverageGaps, and `<commit>.references.json.gz`,
 * what names each requirement (storedReferences); `written` is false when the
 * branch holds the graph already, which it then leaves as it is. With `changed` it adds `<commit>.impacts.json` in the same commit. The commit that adds the graph also writes `latest.json` naming the commit; where it adds
 * nothing, `latest.json` is left as it is. Crosses the network; fails as `commitFiles` fails — `Moved` when
 * the branch moved meanwhile, so that the run can be made again —, and with `NotFound` naming the branch when the repository has none.
 * @param {object} host @param {object} snapshot @param {Array<{ path: string, before: { commit: string, text: string } | null }>} [changed]
 * @returns {Promise<{ commit: string, written: boolean }>}
 */
export async function publishGraph(host, snapshot, changed) {
  const commit = snapshot.commit;
  let branch;
  try {
    branch = await host.readSnapshot(BRANCH);
  } catch (error) {
    if (error?.name !== "NotFound") throw error;
    throw Object.assign(new Error(`The repository has no branch ${BRANCH} to add the graph of ${commit} to.`), { name: "NotFound", cause: error });
  }
  if (branch.paths.includes(fileOf(commit))) return { commit, written: false };
  // The graph is built from the files: a source without readOn never uses a stored graph.
  const graph = await traceGraph({ paths: snapshot.paths, read: (path) => snapshot.read(path), readMany: (paths) => snapshot.readMany?.(paths) }, { commit });
  const files = [{ path: fileOf(commit), bytes: await gzipped(graphText(graph)) },
    { path: gapsOf(commit), text: `${JSON.stringify({ format: GAPS_FORMAT, version: VERSION, commit, gaps: coverageGaps(graph) })}\n` },
    { path: referencesFile(commit), bytes: await gzipped(`${JSON.stringify({ format: REFERENCES_FORMAT, version: VERSION, commit, references: referencesOf(graph) })}\n`) }];
  if (changed) files.push({ path: impactsOf(commit), text: await impactsText(graph, snapshot, commit, changed) });
  files.push({ path: LATEST, text: `${JSON.stringify({ commit })}\n` });
  await host.commitFiles({ branch: BRANCH, expectedHead: branch.commit, files, message: `trace-cache: the graph of ${commit}\n` });
  return { commit, written: true };
}
