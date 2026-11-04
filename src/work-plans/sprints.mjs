// The items a team's sprints hold, and what keeps an item from a team's selection (docs/architecture/MOD-work-plans.md,
// Interfaces: Held, heldItems, conflicts, targetBranch; EVERY TEAM RUNS SPRINTS OF ITS OWN, A SPRINT HOLDS ITS ITEMS UNTIL THEY REACH THE
// DEFAULT BRANCH, SPRINTS OF DIFFERENT TEAMS CHANGE NO MODULE THE OTHER CHANGES OR USES). Pure: nothing is read or written
// here; the sprint records, the items, the architecture's module files and the pull requests are handed in.
//
// Module: MOD-work-plans
//
// A team's sprint is the record docs/backlog/sprints/<team>/<nn>.md, read with planSchemas.sprint; <team> is the name of the
// team's role assignment, and the sprint is named <team>/<nn>. A record that stands in no team's folder is no team's sprint
// and holds nothing. A sprint is closed once its record holds the ## Review its close appends, as closeSprint decides it; its
// increment is given up once its record holds the ## Increment given up giveUpIncrement appends (UC-041 7b).
// An item and a module file are Documents as MOD-documents' readDocument gives them: an item's `modules`
// are the modules it changes, a module file's `uses` the interfaces it uses, `MOD-<slug>.<name>`. A pull request is in the
// form of MOD-repository-hosts' PullRequest: `branch` its head branch, `base` the branch it goes into.

const SPRINT_PATH = /^docs\/backlog\/sprints\/([^/]+)\/([^/]+)\.md$/;

const text = (value) => (typeof value === "string" ? value : value === null || value === undefined ? "" : String(value));
// A list as a Document holds it — or as a comma-separated line, where a field was read as text. The module's one reader of a list-valued field: states.mjs and saves.mjs take it from here.
export const list = (value) => (Array.isArray(value) ? value.map(text)
  : text(value).split(",").map((part) => part.trim()).filter(Boolean));
const idOf = (document) => text(document?.id ?? document?.fields?.id);
const modulesOf = (document) => list(document?.fields?.modules);

/**
 * sprintOf(record: Document) -> { team: string, name: string } | null — the team a sprint record belongs to and the sprint's
 * name, `<team>/<nn>`, from its path; null for a record outside a team's folder.
 */
export function sprintOf(record) {
  const match = SPRINT_PATH.exec(text(record?.path));
  return match ? { team: match[1], name: `${match[1]}/${match[2]}` } : null;
}

/**
 * selectionOf(record: Document) -> string[] — the items a sprint selects now: those of the last `## Selection` appended to
 * its record when a new start decision changed it, else those of its front matter.
 */
export function selectionOf(record) {
  const decisions = (record?.appended ?? []).filter((section) => section?.heading === "## Selection" && section.fields?.selection);
  return list(decisions.length ? decisions.at(-1).fields.selection : record?.fields?.selection);
}

// The items a sprint's close sent on — back to the backlog, or into the team's next sprint: neither is held by it any more.
function sentOn(record) {
  const close = (record?.appended ?? []).find((section) => section?.heading === "## Unfinished items");
  return new Set([...list(close?.fields?.["to the backlog"]), ...list(close?.fields?.["into the next sprint"])]);
}

// Whether a sprint's close is recorded: its record holds the ## Review its close appends.
const closedRecord = (record) => (record?.appended ?? []).some((section) => section?.heading === "## Review");

// Whether the Product Owner gave up a sprint's increment: its record holds the ## Increment given up giveUpIncrement appends.
const givenUpRecord = (record) => (record?.appended ?? []).some((section) => section?.heading === "## Increment given up");

/**
 * sprintsToClose(sprints: Document[], states: ItemState[], today: string) -> Array<{ sprint: string, closer: string, because: "time box ended" | "every selected item done" | "ended by the Product Owner" }> —
 * every sprint of a team whose record holds no ## Review and that has ended: its `end` date is before or on `today` (`yyyy-mm-dd`); or, without a time box, its record holds ## Ended, or every
 * item of its selection is `done` in `states`; each with its `closer`, in the order given. The Product Owner's ## Ended is named before the items. Reads nothing; changes nothing.
 */
export function sprintsToClose(sprints, states, today) {
  const done = new Set((states ?? []).filter((each) => each?.state === "done").map((each) => text(each.item)));
  const due = [];
  for (const record of sprints ?? []) {
    const named = sprintOf(record);
    if (!named || closedRecord(record)) continue;
    const end = text(record.fields?.end).slice(0, 10);
    let because = null;
    if (end) because = end <= today ? "time box ended" : null;
    else if ((record.appended ?? []).some((section) => section?.heading === "## Ended")) because = "ended by the Product Owner";
    else if (selectionOf(record).every((item) => done.has(item))) because = "every selected item done";
    if (because) due.push({ sprint: named.name, closer: text(record.fields?.closer), because });
  }
  return due;
}

/**
 * targetBranch(item: string, context: { sprints: Document[], order: Document | null, branches: Record<string, string>, defaultBranch: string }) -> string — the branch a plan
 * step's or backlog item's work is merged into: the `branch` of the sprint whose current selection names it (selectionOf) and whose record holds neither ## Review nor
 * ## Increment given up, where that record names one; else the branch `branches` gives the step's phase in `order` (its table's `Phase` of the row whose `Step` is the
 * item), as written; else `defaultBranch` (A PHASE OR A TIME BOX MAY HAVE A BRANCH OF ITS OWN, WORK MERGES INTO THE DEFAULT BRANCH UNLESS A BRANCH IS SET). `branches` is
 * the declaration's ## Branches as MOD-product-process' branchesOf gives it. Reads nothing.
 */
export function targetBranch(item, { sprints, order, branches, defaultBranch }) {
  const sprint = (sprints ?? []).find((record) => sprintOf(record) && !closedRecord(record) && !givenUpRecord(record) && selectionOf(record).includes(item));
  const own = text(sprint?.fields?.branch).trim();
  if (own) return own;
  const row = (order?.sections ?? []).flatMap((section) => section?.rows ?? []).find((each) => text(each?.cells?.Step) === item);
  return text(branches?.[text(row?.cells?.Phase)]).trim() || defaultBranch;
}

// The modules whose interfaces `modules` use, by the architecture's module files, in the order of their identifiers.
function usedBy(modules, architecture) {
  const files = new Map((architecture ?? []).map((file) => [idOf(file), file]));
  const used = new Set();
  for (const module of modules) for (const use of list(files.get(module)?.fields?.uses)) used.add(use.split(".")[0]);
  return [...used].sort();
}

// A pull request belongs to an item when its head branch or its title holds the item's identifier, not followed by a digit.
const naming = (pullRequest, id) => {
  const pattern = new RegExp(`(?<![A-Za-z0-9])${id}(?![0-9])`, "i");
  return pattern.test(text(pullRequest?.branch)) || pattern.test(text(pullRequest?.title));
};
const time = (value) => Date.parse(text(value));

// The default branch a chain of pull requests ends at; a repository whose default branch has another name is decided through
// `onDefault`.
const DEFAULT_BRANCH = "main";

// Whether a chain of merged pull requests that starts at `branch` ends at `target`.
function reaches(target, branch, after, pullRequests, seen = new Set()) {
  if (!branch) return false;
  if (branch === target) return true;
  if (seen.has(branch)) return false;
  const nextSeen = new Set(seen);
  nextSeen.add(branch);
  return pullRequests.some((pullRequest) => pullRequest?.state === "merged" && text(pullRequest.branch) === branch
    && time(pullRequest.merged) >= after
    && reaches(target, text(pullRequest.base), time(pullRequest.merged), pullRequests, nextSeen));
}
const reachesDefaultBranch = (branch, after, pullRequests) => reaches(DEFAULT_BRANCH, branch, after, pullRequests);

// Whether a pull request of the item is merged into the sprint's own branch, or into a branch merged on into it: the change of
// the sprint, not yet in the default branch. A sprint without a branch of its own has none.
const mergedIntoBranchOf = (id, record, pullRequests) => {
  const own = text(record?.fields?.branch);
  return own !== "" && pullRequests.some((pullRequest) => pullRequest?.state === "merged" && naming(pullRequest, id)
    && reaches(own, text(pullRequest.base), time(pullRequest.merged), pullRequests));
};

// Whether a merged pull request's chain of pull requests reaches the default branch.
const reachingChain = (pullRequest, pullRequests) => reachesDefaultBranch(text(pullRequest.base),
  time(pullRequest.merged), pullRequests);

// Whether an item's change is on the default branch: a merged pull request of the item into the default branch, or into a
// branch whose later merged pull request reaches the default branch, or whose head commit is in `onDefault`. A merge into
// another branch that reaches the default branch in neither way does not end the sprint's hold.
function inDefaultBranch(id, pullRequests, onDefault) {
  const merged = pullRequests.filter((pullRequest) => pullRequest?.state === "merged" && naming(pullRequest, id));
  return merged.some((pullRequest) => reachingChain(pullRequest, pullRequests) || onDefault.has(text(pullRequest.head)));
}

/**
 * @typedef {{ item: string, sprint: string, team: string, changes: string[], uses: string[] }} Held — an item a team's sprint
 *   holds, with the modules it changes and the modules whose interfaces those use.
 */

/**
 * heldItems(sprints: Document[], items: Document[], architecture: Document[], pullRequests: PullRequest[] | "unknown",
 * onDefault?: Set<string>) -> Held[] — every item a team's sprint holds, in the order of the sprints and of their selections: from its selection until a
 * pull request with its change is merged into the default branch — through the pull requests that merge its base on, or with
 * its head commit in `onDefault`, the head commits a caller found on the default branch —, or until its sprint's close sends it back to the backlog or
 * on to the next sprint — once the close is recorded, every item none of whose pull requests is merged into the sprint's own branch —, or until the
 * Product Owner gives up its sprint's increment — a record that holds ## Increment given up holds none of its items (A SPRINT HOLDS ITS
 * ITEMS UNTIL THEY REACH THE DEFAULT BRANCH; UC-041 7b). With the pull requests "unknown" — a host that could not read them —, a
 * selected item counts as held. An item the backlog lacks is held with no module.
 * @param {object[]} sprints @param {object[]} items @param {object[]} architecture @param {object[] | "unknown"} pullRequests
 * @param {Set<string>} [onDefault]
 * @returns {Held[]}
 */
export function heldItems(sprints, items, architecture, pullRequests, onDefault = new Set()) {
  const known = pullRequests === "unknown" ? null : (pullRequests ?? []);
  const found = onDefault instanceof Set ? onDefault : new Set();
  const byId = new Map((items ?? []).map((item) => [idOf(item), item]));
  const held = [];
  for (const record of sprints ?? []) {
    const of = sprintOf(record);
    if (!of || givenUpRecord(record)) continue;
    const gone = sentOn(record);
    const closed = closedRecord(record);
    for (const item of selectionOf(record)) {
      if (gone.has(item) || (known && inDefaultBranch(item, known, found))) continue;
      if (known && closed && !mergedIntoBranchOf(item, record, known)) continue;
      const changes = modulesOf(byId.get(item));
      held.push({ item, sprint: of.name, team: of.team, changes, uses: usedBy(changes, architecture) });
    }
  }
  return held;
}

/**
 * undecidedHeads(sprints: Document[], pullRequests: PullRequest[]) -> string[] — the head commits of the merged pull requests
 * that name an item `heldItems(sprints, [], [], pullRequests)` holds and whose chain of pull requests reaches no `main`, in the
 * order of the pull requests, each once: the only commits a caller needs to ask the host's `containsCommit` about before
 * calling `heldItems` with `onDefault`. Pure; no request.
 * @param {object[]} sprints @param {object[]} pullRequests
 * @returns {string[]}
 */
export function undecidedHeads(sprints, pullRequests) {
  const known = pullRequests ?? [];
  const held = heldItems(sprints, [], [], known).map((entry) => entry.item);
  const heads = new Set();
  for (const pullRequest of known) {
    // A merged pull request of a held item reaches no main: one that did would end the item's hold.
    if (pullRequest?.state !== "merged") continue;
    if (held.some((id) => naming(pullRequest, id))) heads.add(text(pullRequest.head));
  }
  return [...heads];
}

/**
 * conflicts(item: Document, team: string, held: Held[], architecture: Document[]) -> Array<{ sprint: string, team: string,
 * item: string, module: string }> — what keeps an item from `team`'s selection: for each item another team's sprint holds,
 * every module that item changes and the item changes or uses, and every module it uses that the item changes, one entry
 * each, in the order of the modules' identifiers; the item itself, held by another team, names its modules — `module` empty
 * when it names none (SPRINTS OF DIFFERENT TEAMS CHANGE NO MODULE THE OTHER CHANGES OR USES).
 * @param {object} item @param {string} team @param {Held[]} held @param {object[]} architecture
 * @returns {Array<{ sprint: string, team: string, item: string, module: string }>}
 */
export function conflicts(item, team, held, architecture) {
  const id = idOf(item);
  const changes = modulesOf(item);
  const uses = usedBy(changes, architecture);
  const found = [];
  for (const other of held ?? []) {
    if (other.team === team) continue;
    const shared = new Set([
      ...other.changes.filter((module) => changes.includes(module) || uses.includes(module)),
      ...other.uses.filter((module) => changes.includes(module)),
    ]);
    const modules = [...shared].sort();
    if (!modules.length && other.item === id) modules.push("");
    for (const module of modules) found.push({ sprint: other.sprint, team: other.team, item: other.item, module });
  }
  return found;
}
