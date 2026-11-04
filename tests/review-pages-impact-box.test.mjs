// The impact list of a changed architecture file stands in a box that scrolls (ITM-894): UC-023 step 4 shows the impact list beside the difference, and every other scrolling box of the site is
// a rule of src/site-frame/look.css (`.accepted-diff .diff`, `.editor .preview`) that the module drawing the box gives tabindex="0", so that a keyboard reaches it. The list is <section class="change-impact">,
// which MOD-review-pages' impactSection draws on the page of one file and on Review all.
// Run: node --test tests/review-pages-impact-box.test.mjs
//
// Module: MOD-site-frame; MOD-review-pages
// Guards: AN ARCHITECTURE CHANGE IS NOT ACCEPTED WITHOUT AN IMPACT LIST; THE SITE SERVES A SCREEN READER; UC-023
// Level: unit
//
// The expected results are written here, in the cases, and none is read from a document. Readings, each adding no word to the sentence it reads:
//   - "a vertical scrolling box, in the shape of the existing boxes' rules" (the item's Acceptance) is read as a rule of look.css, outside every @media block, whose selector is `.change-impact` and whose
//     declarations hold `max-height` in pixels and `overflow: auto`, as `.accepted-diff .diff` holds them. The known positive is that the same reading finds that rule of `.accepted-diff .diff`.
//   - "gives the section tabindex="0"" is read as the attribute tabindex with the string value "0" on the one <section class="change-impact"> of the page; the known positive is that the page draws exactly one.
// The DOM and the fakes are those of tests/review-pages-draft-world.mjs and tests/stored-graph-fake.mjs, imported unchanged; the product is a Host of this file's own over one repository in memory with a history.
// Nothing reaches the network. The counter-proofs of the stylesheet reading are the cases TST-894002 and TST-894003; those of the pages are recorded in the pull request.

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { blobOf, byClass, draw, failure, GITHUB, text, fetched } from "./review-pages-draft-world.mjs";
import { withStoredGraph } from "./stored-graph-fake.mjs";

test.afterEach(() => { assert.deepEqual(fetched.splice(0), [], "no request left the fixtures"); });

// ---------------------------------------------------------------- the stylesheet

// The declarations of every top-level rule of `css` whose selector list holds `selector`: [{ max-height: "420px", overflow: "auto" }, …]. A rule inside a block such as @media is not top level.
function rulesOf(css, selector) {
  const plain = css.replace(/\/\*[^]*?\*\//g, "");
  const found = [];
  let depth = 0, start = 0, head = "";
  for (let at = 0; at < plain.length; at += 1) {
    if (plain[at] === "{") {
      if (depth === 0) head = plain.slice(start, at).trim();
      depth += 1;
      start = at + 1;
    } else if (plain[at] === "}") {
      depth -= 1;
      if (depth === 0) {
        if (!head.startsWith("@") && head.split(",").some((each) => each.trim().replace(/\s+/g, " ") === selector)) {
          found.push(Object.fromEntries(plain.slice(start, at).split(";").map((each) => each.split(":").map((part) => part.trim())).filter(([name, value]) => name && value)));
        }
        start = at + 1;
      }
    }
  }
  return found;
}
// Whether the rules of `selector` in `css` make a vertical scrolling box in the shape of the existing boxes: a max-height in pixels and overflow: auto.
const scrollsIn = (css, selector) => rulesOf(css, selector).some((rule) => /^\d+px$/.test(rule["max-height"] ?? "") && rule.overflow === "auto");

const LOOK = readFileSync(new URL("../src/site-frame/look.css", import.meta.url), "utf8");

// TST-894001 · level: unit · module: MOD-site-frame
// guards: AN ARCHITECTURE CHANGE IS NOT ACCEPTED WITHOUT AN IMPACT LIST; UC-023
// given: src/site-frame/look.css as the repository holds it
// input: the rules of the selector .accepted-diff .diff (the known positive), then those of the selector .change-impact
// expect: .accepted-diff .diff makes a box with a max-height in pixels and overflow auto; .change-impact makes one as well
test("TST-894001: look.css gives .change-impact a box with a max-height in pixels and overflow auto, as .accepted-diff .diff has", () => {
  assert.equal(scrollsIn(LOOK, ".accepted-diff .diff"), true, "known positive: the reading finds the box of the difference");
  assert.equal(scrollsIn(LOOK, ".change-impact"), true, ".change-impact is a box that scrolls");
});

// TST-894002 · level: unit · module: MOD-site-frame
// guards: AN ARCHITECTURE CHANGE IS NOT ACCEPTED WITHOUT AN IMPACT LIST; UC-023
// given: stylesheets with the rule of .change-impact planted wrong: without overflow, with overflow hidden, with a max-height in em, without a max-height, only inside @media, and under another selector
// input: the reading of TST-894001 on each, and on a sheet with the rule right
// expect: none of the wrong ones makes a box; the right one does
test("TST-894002: the reading of the stylesheet refuses a rule that is no box in the shape of the existing ones", () => {
  const wrong = [".change-impact { max-height: 420px; }", ".change-impact { max-height: 420px; overflow: hidden; }", ".change-impact { max-height: 30em; overflow: auto; }",
    ".change-impact { overflow: auto; }", "@media (max-width: 599px) { .change-impact { max-height: 420px; overflow: auto; } }", ".change-impacts { max-height: 420px; overflow: auto; }"];
  for (const css of wrong) assert.equal(scrollsIn(css, ".change-impact"), false, css);
  assert.equal(scrollsIn(".other { color: red; }\n/* box */\n.change-impact { max-height: 420px; overflow: auto; }", ".change-impact"), true);
});

// TST-894003 · level: unit · module: MOD-site-frame
// guards: AN ARCHITECTURE CHANGE IS NOT ACCEPTED WITHOUT AN IMPACT LIST; UC-023
// given: the stylesheet of the repository with the rule of .change-impact taken out of it
// input: the reading of TST-894001 on the stylesheet without the rule
// expect: .change-impact makes no box, while .accepted-diff .diff still does
test("TST-894003: without its rule, look.css leaves .change-impact no box", () => {
  const without = LOOK.replace(/^\.change-impact\s*\{[^}]*\}\s*$/m, "");
  assert.equal(scrollsIn(without, ".accepted-diff .diff"), true);
  assert.equal(scrollsIn(without, ".change-impact"), false);
});

// ---------------------------------------------------------------- the product

const SPEC = text("# Fixture - Specification", "", "## 1. Rules", "", "**RULE ONE** *(Product Owner)*", "First rule.", "*Check:* `tests/reader.test.mjs`");
const UC1 = text("---", "id: UC-001", "title: Read a book", "area: reading", "actors:", "  - Member", "realises:", "  - RULE ONE", "---", "# UC-001 Read a book", "", "**Goal.** Read.");
const decision = (id, designs, sentence) => text("---", `id: ${id}`, `title: ${id} title`, "forced_by:", "  - RULE ONE", "designs:", ...designs.map((name) => `  - ${name}`), "---",
  `# ${id} ${id} title`, "", "## Context", "", "Books are read.", "", "## Decision", "", sentence, "", "## Alternatives", "", "None.", "", "## Consequences", "", "Folders.");
const module_ = (id, folder, { follows = [], sentence = "It does one thing." } = {}) => text("---", `id: ${id}`, `title: ${id} title`, `folder: ${folder}`, "realises:", "  - RULE ONE",
  "follows:", ...follows.map((name) => `  - ${name}`), "uses:", "provides:", "  - lend", "---", `# ${id} ${id} title`, "", "## Responsibility", "", sentence, "", "## Parts", "", "- `index.mjs`", "",
  "## Data", "", "Nothing.", "", "## Interfaces", "", "- `lend(book) -> loan` - lends a book.", "", "## Files", "", "None.", "", "## Uses", "", "Nothing.");
const READER_PATH = "docs/architecture/MOD-reader.md", ARC1_PATH = "docs/architecture/ARC-001-reading.md";
const READER_BEFORE = module_("MOD-reader", "src/reader/", { follows: ["ARC-001"] });
const READER_AFTER = module_("MOD-reader", "src/reader/", { follows: ["ARC-001"], sentence: "It does one thing, and does it well." });
const ARC1_BEFORE = decision("ARC-001", ["MOD-reader"], "Reading is one module.");
const ARC1_AFTER = decision("ARC-001", ["MOD-reader"], "Reading is one module, and a small one.");
const BASE = { "README.md": "# Fixture\n", "SPEC.md": SPEC, "docs/use-cases/UC-001-read-a-book.md": UC1, [ARC1_PATH]: ARC1_BEFORE, [READER_PATH]: READER_BEFORE,
  "tests/reader.test.mjs": text("// TST-801 · level: unit · module: MOD-reader", "// guards: RULE ONE"), "src/reader/read.mjs": "export const read = 1;\n" };
const recordOf = (id, kind, path, body) => [`docs/approvals/${id}-${blobOf(body).slice(0, 12)}.md`, text(`kind: ${kind}`, `file: ${path}`, `blob: ${blobOf(body)}`)];
// Accepted: UC-001, ARC-001 and MOD-reader at the texts of BASE; ARC-001 and MOD-reader are then changed.
const STEPS = [BASE,
  Object.fromEntries([recordOf("UC-001", "use-case", "docs/use-cases/UC-001-read-a-book.md", UC1), recordOf("ARC-001", "architecture-decision", ARC1_PATH, ARC1_BEFORE),
    recordOf("MOD-reader", "module", READER_PATH, READER_BEFORE)]),
  { [READER_PATH]: READER_AFTER, [ARC1_PATH]: ARC1_AFTER }];

let commitsMade = 0;
function fakeProduct() {
  const commits = new Map();
  let made = 0, head = null;
  for (const files of STEPS) {
    const sha = createHash("sha1").update(`commit ${++made} of the box file's ${++commitsMade}`).digest("hex");
    commits.set(sha, { tree: new Map([...(head ? commits.get(head).tree : []), ...Object.entries(files)]), parent: head, date: `2026-10-0${made}T10:00:00Z` });
    head = sha;
  }
  const snapshotAt = (sha, ref) => {
    const { tree } = commits.get(sha);
    return withStoredGraph({ repository: GITHUB, ref, commit: sha, paths: [...tree.keys()].sort(), read: async (path) => (tree.has(path) ? tree.get(path) : null),
      blob: (path) => (tree.has(path) ? blobOf(tree.get(path)) : null) });
  };
  return {
    host: {
      async repositoryInfo() { return { defaultBranch: "main", visibility: "public", canWrite: true, archived: false, description: "" }; },
      async readFileAt(path, shas) {
        return new Map(shas.map((sha) => [sha, commits.get(sha)?.tree.get(path) ?? null]));
      },
      async readSnapshot(ref) {
        if (ref === "main") return snapshotAt(head, "main");
        if (commits.has(ref)) return snapshotAt(ref, ref);
        throw failure("NotFound", `${ref} was not found`);
      },
      async readHistory(path, { ref = "main", limit } = {}) {
        const found = [];
        for (let sha = ref === "main" ? head : ref; sha; sha = commits.get(sha).parent) {
          const here = commits.get(sha), before = here.parent ? commits.get(here.parent).tree.get(path) : undefined;
          if (here.tree.get(path) !== before) found.push({ commit: sha, parents: here.parent ? [here.parent] : [], date: here.date, message: "", author: { account: null, name: "x" }, changes: [] });
        }
        return limit ? found.slice(0, limit) : found;
      },
      async commitFiles() { throw failure("Unexpected", "nothing is written"); },
    },
  };
}

const impactsIn = (target) => byClass(target, "section", "change-impact");

// ---------------------------------------------------------------- the pages

// TST-894004 · level: unit · module: MOD-review-pages
// guards: AN ARCHITECTURE CHANGE IS NOT ACCEPTED WITHOUT AN IMPACT LIST; THE SITE SERVES A SCREEN READER; UC-023
// given: the accepted MOD-reader and ARC-001 both changed since
// input: the routes module for MOD-reader and decision for ARC-001, each drawn for one file
// expect: each page draws exactly one section.change-impact (the known positive), and its tabindex is the string "0"
test("TST-894004: the impact list on the page of a changed module file and of a changed decision carries tabindex 0", async () => {
  for (const [route, id] of [["module", "MOD-reader"], ["decision", "ARC-001"]]) {
    const impacts = impactsIn((await draw(fakeProduct(), route, { id })).target);
    assert.equal(impacts.length, 1, `known positive: the page of ${id} draws its impact list`);
    assert.equal(impacts[0].getAttribute("tabindex"), "0", id);
  }
});

// TST-894005 · level: unit · module: MOD-review-pages
// guards: AN ARCHITECTURE CHANGE IS NOT ACCEPTED WITHOUT AN IMPACT LIST; THE SITE SERVES A SCREEN READER; UC-023
// given: the same repository; Review all of the architecture shows every changed file of the whole architecture, ARC-001 and MOD-reader
// input: the routes module and decision, each drawn with the id all (Review all)
// expect: Review all draws one section.change-impact for each changed file it shows (the known positive: one on module, two on decision), and each has the tabindex "0"
test("TST-894005: the impact list on Review all carries tabindex 0", async () => {
  for (const [route, shown] of [["module", 1], ["decision", 2]]) {
    const impacts = impactsIn((await draw(fakeProduct(), route, { id: "all" })).target);
    assert.equal(impacts.length, shown, `known positive: Review all of ${route} draws the impact list of each changed file it shows`);
    assert.deepEqual(impacts.map((each) => each.getAttribute("tabindex")), Array(shown).fill("0"), route);
  }
});
