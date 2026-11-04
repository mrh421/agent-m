// GitHub's "Get a tree" as a fake answers it, for the tests whose fake GitHub holds a set of files: the tree of the commit or of
// "<commit>:<path>" — with recursive=1 every file below it, without it its own entries (a folder as a tree, a file as a blob). A path that
// is a file answers 422, a path the files do not hold 404. No test of its own.
//
// Module: MOD-repository-hosts
// Level: unit

// treeRequest(url) -> { commit, path, recursive } for a request of "Get a tree" of a repository on api.github.com, or null for any other.
export function treeRequest(url) {
  const m = url.host === "api.github.com" && /^\/repos\/[^/]+\/[^/]+\/git\/trees\/([^/:]+)(?::(.*))?$/.exec(url.pathname);
  if (!m) return null;
  return { commit: m[1], path: (m[2] ?? "").split("/").map(decodeURIComponent).join("/"), recursive: url.searchParams.get("recursive") === "1" };
}

// treeAnswer(files, { path, recursive }, shaOf) -> Response — files: { path: text }; shaOf(path) -> the blob SHA of that file.
export function treeAnswer(files, { path: folder, recursive }, shaOf) {
  const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  if (folder in files) return json(422, { message: "Invalid object requested. SHA must identify a commit or a tree." });
  const below = Object.keys(files).filter((path) => folder === "" || path.startsWith(`${folder}/`)).sort();
  if (!below.length) return json(404, { message: "Not Found" });
  const rest = (path) => (folder === "" ? path : path.slice(folder.length + 1));
  if (recursive) return json(200, { sha: "t".repeat(40), truncated: false, tree: below.map((path) => ({ path: rest(path), mode: "100644", type: "blob", sha: shaOf(path) })) });
  const entries = new Map();
  for (const path of below) {
    const [name, ...deeper] = rest(path).split("/");
    if (!entries.has(name)) entries.set(name, deeper.length ? { path: name, mode: "040000", type: "tree", sha: "t".repeat(40) } : { path: name, mode: "100644", type: "blob", sha: shaOf(path) });
  }
  return json(200, { sha: "t".repeat(40), truncated: false, tree: [...entries.values()] });
}
