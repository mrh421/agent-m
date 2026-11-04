// arrange.mjs — the arrangement of one kind (docs/architecture/MOD-review-pages.md, Parts: "arrange.mjs — the hierarchy of a group file, moves, pending changes"; Interfaces: the route `arrange/<group kind>`; UC-021): the hierarchy of the
// kind with every item once, moves and new and renamed groups, the pending changes beside the tree, and *Save arrangement*, which commits the group file `docs/groups/<kind>.md` and nothing else, through MOD-artifact-edits' saveGroupFile on
// the blob read when the route opened.
//
// Module: MOD-review-pages
//
// It writes only through saveGroupFile, and only on a person's click (THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK). The hierarchy, the moves and the file's text are MOD-group-document's: this file draws them and keeps the pending changes. Where the
// texts leave a reading open, this file takes the one it names:
//   - The address `arrange/<group kind>` is the route `arrange` with the parameter `kind` (`#arrange/kind=use-cases`), since the frame reads the first part of a fragment as a route's name and the others as `key=value`. The group kinds are the file
//     names requirements, use-cases, architecture, modules and tests.
//   - The items of a kind are the nodes of that kind in MOD-trace-graph's graph of the snapshot: a requirement's name, a use case's, a decision's, a module's or a test's identifier.
//   - The working tree is the group file as read; an item no group names is added to it, at the top level, when a move takes it, so that the file never lists an item the person did not place. A new group is put at the top level or in the group the
//     person names; a moved item or group goes last into its target. Each move is applied alone, in order, to the tree as it stands: a refused one is listed with its reason and is no pending change.
//   - A job record's `works_on` holds no test identifier (MOD-job-ledger, Data: "requirements, use cases, decisions, modules, items, sources —, an issue's address or a commit"), so *Propose groups* on the tests records the commit of the snapshot the page read; for the other kinds it records the items.
//   - On `changed meanwhile` the pending changes are applied again, in order, to the newer file: those that still apply stay pending, the others are named with their reasons.

import { fallbackEditLinks, saveGroupFile } from "../artifact-edits/index.mjs";
import { applyMoves, groupFileText, hierarchy, parseGroupFile } from "../group-document/index.mjs";
import { explain, readProblem } from "../site-frame/index.mjs";
import { storedGraph } from "../trace-graph/index.mjs";
import { button, el, handedPlace, link, openGithubEditor, parseServer, readPlace, tokenStep } from "./common.mjs";
import { fallbackPages } from "./file-edit.mjs";
import { byClassChecked, loadStage, panelOf, participantList } from "./jobs.mjs";
import { heads } from "./routes.mjs";

const KINDS = {
  requirements: { title: "requirements" },
  "use-cases": { title: "use cases" },
  architecture: { title: "architecture decisions" },
  modules: { title: "modules" },
  tests: { title: "tests" },
};
const pathOf = (kind) => `docs/groups/${kind}.md`;

// The topics behind the folded explanations of a drafting page that the run panel of *Propose groups* shares with the others.
const PROPOSE = { explain: { draft: { participant: "drafting-participant", panel: "run-panel", ci: "ci-agent-draft" } } };

// The kind of node, in MOD-trace-graph's graph, that the group file of each kind arranges (as MOD-artifact-edits' recipe items-of-kind and the check group-rules read them).
const NODE_KIND = { requirements: "requirement", "use-cases": "UC", architecture: "ARC", modules: "MOD", tests: "TST" };

// The identifiers (a requirement's name for requirements) of the items of a kind in a snapshot, from the nodes of that kind in MOD-trace-graph's graph, sorted by identifier.
async function itemsOf(kind, snapshot) {
  return [...(await storedGraph(snapshot, snapshot.commit)).nodes.values()].filter((node) => node.kind === NODE_KIND[kind]).map((node) => node.id)
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

// ---------------------------------------------------------------- the tree and the moves

const clone = (tree) => structuredClone(tree);
function walkGroups(groups, path, visit) {
  for (const group of groups) {
    const here = [...path, group.title];
    visit(group, here);
    walkGroups(group.groups, here, visit);
  }
}
const placesOf = (tree) => {
  const ids = [];
  const take = (members) => members.forEach((member) => ids.push(member.id));
  take(tree.members);
  walkGroups(tree.groups, [], (group) => take(group.members));
  return ids;
};

// The path of the group that holds an item, [] for the top level, where an item no group names stands too; a group's origin is the path of its parent.
function originOf(tree, move) {
  if (move.op === "move-group") return move.group.slice(0, -1);
  let found = null;
  walkGroups(tree.groups, [], (group, here) => { if (found === null && group.members.some((member) => member.id === move.item)) found = here; });
  return tree.members.some((member) => member.id === move.item) ? [] : (found ?? []);
}

// A pending move names where the item or group came from, given as `origin` (UC-021 step 3); a refused move is described without one.
function describe(move, origin) {
  const where = (path) => (path.length ? `“${path.join(" › ")}”` : "the top level");
  if (move.op === "create") return `Add the group “${move.title}”${move.in.length ? ` in ${where(move.in)}` : ""}`;
  if (move.op === "rename") return `Rename the group “${move.group.join(" › ")}” to “${move.title}”`;
  if (move.op === "move") return `Move ${move.item}${origin ? ` from ${where(origin)}` : ""} to ${where(move.to)}`;
  if (move.op === "move-group") return `Move the group “${move.group.join(" › ")}”${origin ? ` from ${where(origin)} to` : " into"} ${where(move.to)}`;
  if (move.op === "delete") return `Delete the empty group “${move.group.join(" › ")}”`;
  return `Move the content of “${move.group.join(" › ")}” up one level`;
}

// The moves applied one by one to the tree: { tree, applied, refused }. An item no group names is first added at the top level, so that the move can take it.
function replay(base, moves) {
  let tree = clone(base);
  const applied = [], refused = [];
  for (const move of moves) {
    const trial = clone(tree);
    if (move.op === "move" && !placesOf(trial).includes(move.item)) trial.members.push({ id: move.item, line: 0 });
    const result = applyMoves(trial, [move]);
    if (result.refused.length) refused.push({ move, reason: result.refused[0].reason });
    else { tree = result.tree; applied.push(move); }
  }
  return { tree, applied, refused };
}

// ---------------------------------------------------------------- the page

// The snapshot the frame hands the route's `reads` before it calls `render` (common.mjs handedPlace).
const place = handedPlace();

async function render(target, context, params) {
  const kind = params?.kind;
  if (!Object.hasOwn(KINDS, kind ?? "")) {
    target.replaceChildren(el("h2", null, "Arrange"), el("p", "problem", `Arrange which kind? Open the arrangement of ${Object.keys(KINDS).join(", ")}: #arrange/kind=<kind>.`));
    return;
  }
  const where = await readPlace(target, context, place);
  if (where === null) return;
  try {
    await show(where, kind);
  } catch (failure) {
    target.append(readProblem(failure, Boolean(where.token)));
  }
}

async function show(where, kind) {
  const { target, snapshot, token, host, context } = where;
  const path = pathOf(kind);
  const items = await itemsOf(kind, snapshot);
  let openedBlob = snapshot.blob(path);
  let base = parseGroupFile(path, (await snapshot.read(path)) ?? "");
  let moves = [];
  let tree = clone(base);
  let refusedNow = [];

  const page = el("section", "arrange");
  const treeBox = el("div", "arrange-tree-box");
  const sideBox = el("div", "arrange-side");
  const resultBox = el("div", "arrange-result-box");
  target.append(el("h2", null, `Arrange the ${KINDS[kind].title}`), explain("group-is-a-heading"), page);
  page.append(treeBox, sideBox, resultBox);

  function groupOptions() {
    const options = [{ label: "Top level", path: [] }];
    walkGroups(tree.groups, [], (group, here) => options.push({ label: here.join(" › "), path: here }));
    return options;
  }
  const select = (className, label) => {
    const choice = el("select", className);
    choice.setAttribute("aria-label", label);
    for (const option of groupOptions()) {
      const node = el("option", null, option.label);
      node.value = JSON.stringify(option.path);
      choice.append(node);
    }
    return choice;
  };

  function applyOne(move) {
    const result = replay(tree, [move]);
    if (result.refused.length) { refusedNow = [...refusedNow, ...result.refused]; draw(); return; }
    tree = result.tree;
    moves = [...moves, move];
    draw();
  }

  // The marks: the members that stand in two places, the items no group names, the members that match no item.
  function marks() {
    const places = placesOf(tree);
    const seen = new Set(), twice = new Set();
    for (const id of places) (seen.has(id) ? twice : seen).add(id);
    const view = hierarchy(tree, items);
    const unplaced = items.filter((id) => !places.includes(id));
    return { twice, unplaced, unknown: new Set(view.unknown) };
  }

  const dragged = { value: null };
  function dropOn(path) {
    const key = dragged.value;
    dragged.value = null;
    if (!key) return;
    if (key.group) applyOne({ op: "move-group", group: key.group, to: path });
    else applyOne({ op: "move", item: key.item, to: path });
  }

  function draggable(node, key) {
    node.setAttribute("draggable", "true");
    node.addEventListener("dragstart", (event) => {
      event.stopPropagation?.();
      dragged.value = key;
      event.dataTransfer?.setData?.("text/plain", key.item ?? key.group.join(" › "));
    });
  }
  const dropTarget = (node, path) => {
    node.addEventListener("dragover", (event) => event.preventDefault?.());
    node.addEventListener("drop", (event) => { event.preventDefault?.(); event.stopPropagation?.(); dropOn(path); });
  };

  function moveControls(key) {
    const choice = select("arrange-move", `Move ${key.item ?? key.group.join(" › ")} to`);
    const go = button("arrange-move-to", "Move to …");
    go.addEventListener("click", () => {
      const to = JSON.parse(choice.value || "[]");
      applyOne(key.group ? { op: "move-group", group: key.group, to } : { op: "move", item: key.item, to });
    });
    return [choice, go];
  }

  function itemNode(member, mark) {
    const node = el("li", "arrange-item", el("span", "id", member.id));
    node.setAttribute("data-id", member.id);
    for (const text of mark) node.append(" ", el("span", "mark", text));
    node.append(" ", ...moveControls({ item: member.id }));
    draggable(node, { item: member.id });
    return node;
  }

  function groupNode(group, here, m) {
    const node = el("li", "arrange-group");
    node.setAttribute("data-title", group.title);
    const rename = el("input", "arrange-rename");
    rename.setAttribute("aria-label", `New title of ${group.title}`);
    rename.value = group.title;
    const renameGo = button("arrange-rename-go", "Rename");
    renameGo.addEventListener("click", () => { if (rename.value.trim() && rename.value !== group.title) applyOne({ op: "rename", group: here, title: rename.value.trim() }); });
    const lift = button("arrange-lift", "Move content up one level");
    lift.addEventListener("click", () => applyOne({ op: "lift", group: here }));
    const remove = button("arrange-delete", "Delete");
    remove.addEventListener("click", () => applyOne({ op: "delete", group: here }));
    node.append(el("strong", "title", group.title), " ", rename, renameGo, " ", lift, " ", remove, " ", ...moveControls({ group: here }),
      el("ul", null, ...group.groups.map((child) => groupNode(child, [...here, child.title], m)), ...group.members.map((member) => itemNode(member, markOf(member.id, m)))));
    draggable(node, { group: here });
    dropTarget(node, here);
    return node;
  }
  const markOf = (id, m) => [...(m.twice.has(id) ? ["named twice"] : []), ...(m.unknown.has(id) ? ["unknown member"] : [])];

  function drawTree() {
    const m = marks();
    const list = el("ul", "arrange-tree", ...tree.groups.map((group) => groupNode(group, [group.title], m)), ...tree.members.map((member) => itemNode(member, markOf(member.id, m))),
      ...m.unplaced.map((id) => itemNode({ id }, ["not yet placed"])));
    dropTarget(list, []);
    const title = el("input", "arrange-group-title");
    title.setAttribute("aria-label", "Title of the new group");
    const into = select("arrange-group-in", "Put the new group in");
    const add = button("arrange-new-group", "+ Group");
    add.addEventListener("click", () => {
      if (!title.value.trim()) return;
      applyOne({ op: "create", title: title.value.trim(), in: JSON.parse(into.value || "[]") });
    });
    treeBox.replaceChildren(list, el("p", "arrange-add", title, " in ", into, " ", add));
  }

  function drawSide() {
    const save = button("arrange-save", "Save arrangement");
    save.addEventListener("click", () => saveNow());
    // Each pending move is described against the tree as it stood before it: the moves replayed on the base, in order.
    let before = base;
    const lines = moves.map((move) => {
      const line = describe(move, originOf(before, move));
      before = replay(before, [move]).tree;
      return line;
    });
    sideBox.replaceChildren(el("h3", null, "Pending changes"), el("ol", "arrange-pending", ...lines.map((line) => el("li", "arrange-pending-item", line))),
      el("ul", "arrange-refused", ...refusedNow.map(({ move, reason }) => el("li", "arrange-refused-item", `${describe(move)}: ${reason}`))), el("p", null, save));
  }

  function draw() {
    drawTree();
    drawSide();
  }

  // The moves of a proposal arrive as pending changes, each applied alone, in order, to the tree as it stands; those the tree refuses are listed with their reasons (UC-021 1b, 3).
  function adopt(proposed) {
    const result = replay(tree, proposed);
    tree = result.tree;
    moves = [...moves, ...result.applied];
    refusedNow = [...refusedNow, ...result.refused];
    draw();
    return result;
  }

  async function saveNow() {
    resultBox.replaceChildren();
    const text = groupFileText(tree);
    if (!token) {
      if (parseServer(context) === "gitlab") {
        resultBox.replaceChildren(el("p", "problem arrange-result", "A GitLab product is written with the project's own token. ", tokenStep(context)));
        return;
      }
      const pages = fallbackEditLinks([{ path, text, existing: openedBlob !== null }], snapshot);
      const box = el("div", "arrange-fallback");
      resultBox.append(box);
      if (fallbackPages(box, pages)) await openGithubEditor({ ...pages[0], text });
      return;
    }
    try {
      const outcome = await saveGroupFile(host, { kind, text, openedBlob });
      if (outcome.refused === "changed meanwhile") {
        base = parseGroupFile(path, outcome.current ?? "");
        openedBlob = outcome.currentBlob;
        const result = replay(base, moves);
        tree = result.tree;
        moves = result.applied;
        refusedNow = result.refused.map((each) => ({ move: each.move, reason: `no longer applies — ${each.reason}` }));
        draw();
        resultBox.replaceChildren(el("p", "problem arrange-result", `The group file changed meanwhile, so nothing was written. The newer arrangement is shown with ${moves.length ? "the changes that still apply" : "no change that still applies"}${result.refused.length ? "; the others are named beside the tree" : ""}.`));
        return;
      }
      if (outcome.refused === "not one place") {
        resultBox.replaceChildren(el("p", "problem arrange-result", `Nothing was written: ${outcome.items.join(", ")} would stand in more than one place.`));
        return;
      }
      base = parseGroupFile(path, text);
      tree = clone(base);
      moves = [];
      refusedNow = [];
      openedBlob = outcome.blob;
      draw();
      const commit = `${snapshot.repository.web}/commit/${outcome.commit}`;
      resultBox.replaceChildren(el("p", "arrange-result", "Saved in ", link(commit, "commit-link", `commit ${outcome.commit.slice(0, 7)}`), "."));
    } catch (failure) {
      if (failure.name === "PermissionMissing") {
        const pages = fallbackEditLinks([{ path, text, existing: openedBlob !== null }], snapshot);
        const box = el("div", "arrange-fallback");
        resultBox.replaceChildren(el("p", "problem arrange-result", failure.message), box);
        if (!pages.refused && fallbackPages(box, pages)) await openGithubEditor({ ...pages[0], text });
        return;
      }
      resultBox.replaceChildren(el("p", "problem arrange-result", `${failure.name}: ${failure.message} — nothing was written.`));
    }
  }

  draw();
  target.append(await proposeGroups(where, kind, items, adopt));
}

// *Propose groups* (UC-021 1b): the participants that can draft text, and a button that shows the run panel of the kind propose-groups for the one chosen — what is sent where, and Run. The job
// writes nothing; its moves are handed to `adopt`, which makes them pending changes.
async function proposeGroups(where, kind, items, adopt) {
  const { token, context, snapshot } = where;
  const box = el("section", "arrange-propose", el("h3", null, "Propose groups"), explain(PROPOSE.explain.draft.participant));
  const stage = el("div", "stage");
  let loaded;
  try {
    loaded = await loadStage(where, "propose-groups");
  } catch (failure) {
    box.append(readProblem(failure, Boolean(token)));
    return box;
  }
  const { definition, participants, instanceSnapshot, product, needs, drafters } = loaded;
  const offered = participantList(drafters, participants, product, needs);
  const show = button("btn arrange-propose-run", "Propose groups");
  async function presentMoves(outcome, result) {
    const proposed = Array.isArray(outcome.draft?.moves) ? outcome.draft.moves : [];
    const done = adopt(proposed);
    result.append(el("p", "proposed", `${proposed.length} move${proposed.length === 1 ? "" : "s"} proposed, ${done.applied.length} pending; nothing is written until Save arrangement.`));
    if (outcome.remaining?.length) result.append(el("ul", "left", ...outcome.remaining.map((finding) => el("li", "left", `${finding.rule}: ${finding.what} — ${finding.fix}`))));
  }
  show.addEventListener("click", async () => {
    stage.replaceChildren();
    if (!token) { stage.append(el("p", "problem", "A job is recorded and its result written with your token. ", tokenStep(context))); return; }
    const chosen = drafters.find((participant) => byClassChecked(offered, participant.name));
    if (!chosen) { stage.append(el("p", "problem", "Choose the participant that drafts.")); return; }
    await panelOf({ ...where, definition, kind: PROPOSE, jobKind: "propose-groups", params: { kind }, worksOn: kind === "tests" ? [snapshot.commit] : items, present: presentMoves, chosen, participants, instanceSnapshot, product, needs, stage });
  });
  box.append(offered, show, stage);
  return box;
}

export const arrangeRoute = { ...heads.arrangeRoute, render, reads: place.reads };
