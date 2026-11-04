// Checks — the checks across artifacts (MOD-trace-graph, Parts): graphFindings, which decides the rules that need several
// artifacts at once, and selfSufficiencyFindings, which decides what a link may reach, each from the graph that traceGraph builds
// and from nothing else, so that no file is read again. Every finding is made with MOD-text-tools' finding, an error that names the
// artifact and the line. What a finding says of a name or of a use — a `realises`, a `uses` — stands at the line of that value,
// under the identifier of the artifact that writes it (of a test, the line its declaration begins at); what it says of an artifact
// as a whole — a module's folder, the decision that designs it, a plan step's tests — stands at the line of the artifact's
// identifier, which its node keeps. The reference by position is not decided here: the graph keeps those warnings as
// MOD-identifiers' positionalReferences gives them, and graphFindings passes them on.
//
// Module: MOD-trace-graph

import { pagesAddress } from "../identifiers/index.mjs";
import { finding } from "../text-tools/index.mjs";
import { importsNotNamed, unmatchedNames } from "./derive.mjs";

const REALISES = "A USE CASE REALISES NAMED REQUIREMENTS";
const ORIGIN = "EVERY ARTIFACT NAMES ITS ORIGIN";
const INTERFACES = "DEVELOP AGAINST INTERFACES";
const CYCLE = "MODULES DEPEND ON EACH OTHER WITHOUT A CYCLE";
const NAME = "THE NAME IS THE ID AND IT SURVIVES";
const SUBSYSTEM = "A MODULE BELONGS TO ONE SUBSYSTEM";
const WHOLE = "ONE DECISION STATES THE WHOLE ARCHITECTURE";
const CHANGES = "A BACKLOG ITEM NAMES THE MODULES IT CHANGES";
const LEVEL = "A PLAN STEP NAMES THE TESTS OF ITS LEVEL";
const FOLDER = "A MODULE IS A FOLDER";
const GROUP = "A GROUP CARRIES NO IDENTIFIER";
const STATES = "A MODULE STATES ITS RESPONSIBILITY AND ITS INTERFACES";
const SELF_SUFFICIENT = "THE PRODUCT REPOSITORY IS SELF-SUFFICIENT";

const error = (artifact, line, rule, what, fix) => finding({ artifact, line, kind: "error", rule, what, fix });
const byText = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const nodesOf = (graph, kind) => [...graph.nodes.values()].filter((node) => node.kind === kind);
const edgesVia = (graph, via) => graph.edges.filter((edge) => edge.via === via);
// The module a `uses` edge points at: its `to` is the module file's text, `MOD-<slug>.<name>`.
const moduleOf = (edge) => edge.to.split(".")[0];

// A name where an identifier is expected is the `to` of an edge. One that is the title of a group is an error under A GROUP CARRIES
// NO IDENTIFIER, and is not also reported as a name that matches nothing. A name in `realises`, `forced_by` or `guards` that is
// neither a requirement nor a use case (unmatchedNames) is an error: a use case's `realises` under A USE CASE REALISES NAMED
// REQUIREMENTS, every other under the origin its artifact names.
function names(graph) {
  const titles = new Set(nodesOf(graph, "group").map((group) => group.title));
  const unmatched = new Set(unmatchedNames(graph));
  const found = [];
  for (const edge of graph.edges) {
    if (titles.has(edge.to)) {
      found.push(error(edge.from, edge.line, GROUP, `${edge.via} "${edge.to}" is the title of a group, which carries no identifier`,
        "name the artifact by its identifier, not by the title of a group"));
    } else if (unmatched.has(edge)) {
      const rule = edge.via === "realises" && graph.nodes.get(edge.from)?.kind === "UC" ? REALISES : ORIGIN;
      found.push(error(edge.from, edge.line, rule, `${edge.via} "${edge.to}" matches no requirement or use case`,
        "use an existing name or remove the line"));
    }
  }
  return found;
}

// A `uses` edge must name an interface its module's node provides; a module no file describes provides none.
function interfaces(graph) {
  const found = [];
  for (const edge of edgesVia(graph, "uses")) {
    const used = graph.nodes.get(moduleOf(edge));
    if (used?.provides?.includes(edge.interface)) continue;
    found.push(error(edge.from, edge.line, INTERFACES,
      used === undefined ? `uses ${edge.to}, but the architecture describes no module ${moduleOf(edge)}`
        : `uses ${edge.to}, which ${used.id} does not provide`,
      used === undefined ? "use a module that the architecture describes" : "use an interface that the module provides"));
  }
  return found;
}

// A cycle among the modules' uses: the modules that reach themselves through their uses, one error for each set of modules that
// use each other, at the module of it whose identifier comes first and the first of its uses that stays among them.
function cycles(graph) {
  const uses = new Map();
  for (const edge of edgesVia(graph, "uses")) {
    uses.set(edge.from, [...(uses.get(edge.from) ?? []), { to: moduleOf(edge), line: edge.line }]);
  }
  const reach = (start) => {
    const seen = new Set(), todo = [start];
    while (todo.length) {
      for (const { to } of uses.get(todo.pop()) ?? []) if (!seen.has(to)) { seen.add(to); todo.push(to); }
    }
    return seen;
  };
  const found = [], reported = new Set();
  for (const id of [...uses.keys()].sort(byText)) {
    if (reported.has(id)) continue;
    const ahead = reach(id);
    if (!ahead.has(id)) continue;
    const members = [id, ...[...ahead].filter((other) => other !== id && reach(other).has(id))].sort(byText);
    members.forEach((member) => reported.add(member));
    found.push(error(id, uses.get(id).find((use) => members.includes(use.to)).line, CYCLE,
      `the uses of ${members.join(", ")} form a cycle`, "remove a use, or move what they share into a module of its own"));
  }
  return found;
}

// A test identifier declared at more than one place: the places are the path and line of its node and of its `guards` and
// `exercises` edges, each the place of the declaration it was read from, once each. With two or more, an error at each place, the
// path as its artifact, naming the other places by path and line.
function repeatedTests(graph) {
  const places = new Map();
  for (const test of nodesOf(graph, "TST")) places.set(test.id, new Set([`${test.path}:${test.line}`]));
  for (const edge of graph.edges) {
    if ((edge.via === "guards" || edge.via === "exercises") && places.has(edge.from)) places.get(edge.from).add(`${edge.path}:${edge.line}`);
  }
  const found = [];
  for (const [id, own] of places) {
    if (own.size < 2) continue;
    const all = [...own].map((place) => ({ place, path: place.slice(0, place.lastIndexOf(":")), line: Number(place.slice(place.lastIndexOf(":") + 1)) }))
      .sort((a, b) => byText(a.path, b.path) || a.line - b.line);
    for (const { place, path, line } of all) {
      const others = all.filter((other) => other.place !== place).map((other) => other.place);
      found.push(error(path, line, NAME, `${id} is declared here and also at ${others.join(", ")}`,
        "give this test an identifier of its own, one that no other test holds or held"));
    }
  }
  return found;
}

// A module belongs to the subsystem of the one decision that designs it, and follows that decision.
function subsystems(graph) {
  const designs = edgesVia(graph, "designs"), follows = edgesVia(graph, "follows");
  const found = [];
  for (const module of nodesOf(graph, "MOD")) {
    const designers = designs.filter((edge) => edge.to === module.id).map((edge) => edge.from).sort(byText);
    if (designers.length === 0) {
      found.push(error(module.id, module.line, SUBSYSTEM, `${module.id} is designed by no decision`,
        "name it under designs in the decision of its subsystem"));
    } else if (designers.length > 1) {
      found.push(error(module.id, module.line, SUBSYSTEM, `${module.id} is designed by more than one decision: ${designers.join(", ")}`,
        "name it under designs in one decision only"));
    } else if (!follows.some((edge) => edge.from === module.id && edge.to === designers[0])) {
      found.push(error(module.id, module.line, SUBSYSTEM, `${module.id} does not follow ${designers[0]}, the decision that designs it`,
        `name ${designers[0]} under follows`));
    }
  }
  return found;
}

// Exactly one decision refines none and states the whole architecture, and every other decision refines it. With two or more that
// refine none, each is an error; with decisions that all refine another, the one whose identifier comes first; with no decision,
// as when use cases are drafted before any architecture exists, none.
function wholeArchitecture(graph) {
  const decisions = nodesOf(graph, "ARC").sort((a, b) => byText(a.id, b.id));
  const refining = edgesVia(graph, "refines");
  const refines = (from, to) => refining.some((edge) => edge.from === from && (to === undefined || edge.to === to));
  const roots = decisions.filter((decision) => !refines(decision.id));
  if (decisions.length === 0) return [];
  if (roots.length === 0) {
    return [error(decisions[0].id, decisions[0].line, WHOLE, "every decision refines another, so none states the whole architecture",
      "leave the decision that states the whole architecture without refines")];
  }
  if (roots.length > 1) {
    return roots.map((root) => error(root.id, root.line, WHOLE,
      `${roots.map((other) => other.id).join(", ")} refine no decision; exactly one states the whole architecture`,
      "make every decision but one refine the one that states the whole architecture"));
  }
  return decisions.filter((decision) => decision !== roots[0] && !refines(decision.id, roots[0].id))
    .map((decision) => error(decision.id, decision.line, WHOLE,
      `${decision.id} does not refine ${roots[0].id}, the decision that states the whole architecture`,
      `name ${roots[0].id} under refines`));
}

// An item, a plan step or a backlog item, names modules the architecture describes.
function changedModules(graph) {
  return edgesVia(graph, "changes").filter((edge) => graph.nodes.get(edge.to)?.kind !== "MOD")
    .map((edge) => error(edge.from, edge.line, CHANGES, `changes ${edge.to}, which the architecture does not describe`,
      "name a module that the architecture describes"));
}

// A plan step — an item under docs/plan/; a backlog item names whatever tests its work needs — names tests, and only those of its
// level: unit tests for a module, component tests for a subsystem, system and release tests for the system. A level the item
// schema does not list, or none, is MOD-documents' finding.
const TESTS_OF = { module: ["unit"], subsystem: ["component"], system: ["system", "release"] };
const PLAN_STEP = /^docs\/plan\//;
function planSteps(graph) {
  const found = [];
  for (const step of nodesOf(graph, "ITM")) {
    const own = TESTS_OF[step.level];
    if (!own || !PLAN_STEP.test(step.path)) continue;
    const other = step.tests.filter((test) => !own.includes(test));
    const fix = `name the tests of level ${step.level}: ${own.join(", ")}`;
    if (step.tests.length === 0) {
      found.push(error(step.id, step.line, LEVEL, `${step.id} is of level ${step.level} and names no tests`, fix));
    } else if (other.length > 0) {
      found.push(error(step.id, step.line, LEVEL,
        `${step.id} is of level ${step.level} and names tests of another level: ${other.join(", ")}`, fix));
    }
  }
  return found;
}

// A module's folder is named after its identifier, `src/text-tools/` for MOD-text-tools, and lies in no other module's folder. A
// module file without a folder is MOD-documents' finding.
function folders(graph) {
  const modules = nodesOf(graph, "MOD").filter((module) => module.folder);
  const where = (module) => module.folder.replace(/\/+$/, "");
  const found = [];
  for (const module of modules) {
    const slug = module.id.slice("MOD-".length);
    if (where(module).split("/").pop() !== slug) {
      found.push(error(module.id, module.line, FOLDER,
        `${module.id} has the folder ${module.folder}, which is not named after its identifier`, `name the folder ${slug}`));
    }
    const outer = modules.find((other) => other !== module && where(module).startsWith(`${where(other)}/`));
    if (outer) {
      found.push(error(module.id, module.line, FOLDER,
        `the folder ${module.folder} of ${module.id} lies inside the folder ${outer.folder} of ${outer.id}`,
        "give each module a folder of its own, outside the others'"));
    }
  }
  return found;
}

// A code file's import of a module that the file's own module names no interface of among its `uses`, at the file and line of the import, with the module imported — the imports moduleRows lists as a gap.
function imports(graph) {
  return importsNotNamed(graph).map(({ edge, own }) => error(edge.path, edge.line, STATES,
    `${edge.path}:${edge.line} imports ${edge.to}, which the file of ${own} does not name among the interfaces it uses`,
    `name an interface of ${edge.to} among the uses of ${own}, or remove the import`));
}

// graphFindings(graph: Graph) -> Finding[] — the checks across artifacts, each decided from the graph alone, one after the other,
// and last the graph's positions, the warnings of references by position, as they stand in the graph.
export function graphFindings(graph) {
  return [...names(graph), ...interfaces(graph), ...cycles(graph), ...repeatedTests(graph), ...subsystems(graph), ...wholeArchitecture(graph),
    ...changedModules(graph), ...planSteps(graph), ...folders(graph), ...imports(graph), ...graph.positions];
}

// A link target is read as a reference from the file that writes it, against the root of the repository's files: a relative target,
// a target from the root and a fragment of the file itself end at a path of the repository, an address at its host.
const ROOT = "file:///";
const decoded = (text) => {
  try {
    return decodeURIComponent(text);
  } catch {
    return text;
  }
};

// selfSufficiencyFindings(graph: Graph, instance: string) -> Finding[] — an error for each link of the graph whose target is a path
// of the repository that `files` does not hold — a file, or a folder some file lies below, the percent-encoding of the target
// read as it is written —, the instance's repository `owner/name` — github.com/<owner>/<name> and what lies below it —, or its
// dashboard at the address MOD-identifiers' pagesAddress gives — that address and what lies below it. Any other address is no
// concern of this check, and neither is one that cannot be read.
export function selfSufficiencyFindings(graph, instance) {
  const dashboard = new URL(pagesAddress(instance));
  const [owner, name] = instance.toLowerCase().split("/");
  const held = new Set();
  for (const file of graph.files) {
    for (let at = file.length; at > 0; at = file.lastIndexOf("/", at - 1)) held.add(file.slice(0, at));
  }
  const problemWith = (link, url) => {
    if (url.protocol === "file:" && url.host === "") {
      const path = decoded(url.pathname.slice(1)).replace(/\/+$/, "");
      return path === "" || held.has(path) ? null : {
        what: `links to ${link.target}, a path that the repository does not hold`,
        fix: "link a file the repository holds, or remove the link",
      };
    }
    const fix = "remove the link, or copy what it points to into the product repository";
    const [first, second] = url.pathname.toLowerCase().split("/").slice(1);
    if (url.hostname === "github.com" && first === owner && second === name) {
      return { what: `links to ${link.target}, in the repository of the Agent M instance ${instance}`, fix };
    }
    if (url.hostname === dashboard.hostname && `${url.pathname.toLowerCase()}/`.startsWith(dashboard.pathname.toLowerCase())) {
      return { what: `links to ${link.target}, the dashboard of the Agent M instance ${instance}`, fix };
    }
    return null;
  };
  const found = [];
  for (const link of graph.links) {
    let url;
    try {
      url = new URL(link.target, ROOT + link.path);
    } catch {
      continue;
    }
    const problem = problemWith(link, url);
    if (problem) found.push(error(link.from, link.line, SELF_SUFFICIENT, problem.what, problem.fix));
  }
  return found;
}
