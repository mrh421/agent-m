// Module: MOD-trace-pages
// MOD-trace-pages' specification view leads to the review pages' editing (ITM-360), as the accepted text of docs/architecture/MOD-trace-pages.md states it: for the
// specification, "to the review pages, on the default branch only: *Edit* on a requirement, *+ Requirement* once for each section of the SPEC, listed beside the tree and not within it,
// each of which opens `requirements/new` for that section (UC-018 3d)"; and "Editing, the draft of a change asked for in the prompt bar, and arranging are the review pages' routes, which its links lead to".
// The specification view offers no *Change by prompt*: a change is asked for in the prompt bar (ITM-551); *Arrange* (UC-021) is not part of this file. For UC-018 (step 1, 3d) and UC-019 (step 1).
// Run: node --test tests/trace-pages-edit-links.test.mjs
//
// This imports the shared small DOM of tests/site-frame-dom.mjs unchanged, as the other tests of the views do, and calls the public trace/specification route with a Host of the
// test's own that keeps to MOD-repository-hosts' interface (repositoryInfo, readSnapshot) and has no write. The fixture is the SPEC of the review pages' tests of UC-018:
// the requirements A LOAN HAS A DUE DATE and A BOOK IS SHELVED in the section "## 1. Lending", A MEMBER HAS A CARD in "## 2. Membership", and one before every section
// (UC-018 itself gives no requirement text). Where the file leaves a reading open, the test states the one it takes, and the pull request names it:
//   - The default branch is on view when the route's `ref` is the branch the Host's repositoryInfo names as the default; a tag, or any other ref, is not; a Host that cannot say
//     (no repositoryInfo, or it fails) is read as not on the default branch, and no link is offered.
//   - The links are anchors in the address form the frame reads and the review pages' routes take: `#requirement/name=<NAME>` for Edit and
//     `#requirements/section=<the section's heading line>` for + Requirement, each part encoded as the frame's fragmentOf encodes it. Edit stands in the requirement's own row
//     beside its name; + Requirement stands once for each section of the SPEC in a list beside the group tree (ITM-595), none for the requirements before the first section.
// Each test case carries its declaration (given / input / expect); where a test expects a link to be absent, the same page is first shown to hold it. The counter-proofs are
// recorded in the pull request.

import "./site-frame-dom.mjs";
import test from "node:test";
import assert from "node:assert/strict";

const { view } = await import("../src/trace-pages/index.mjs");
const route = view.routes.find((candidate) => candidate.name === "trace");

const OUTSIDE = "A LIBRARY LENDS BOOKS", LOAN = "A LOAN HAS A DUE DATE", SHELF = "A BOOK IS SHELVED", CARD = "A MEMBER HAS A CARD";
const SPEC = `# Library — Specification

**${OUTSIDE}** *(Product Owner)*
The library lends books to its members.
*Check:* at review.

## 1. Lending

**${LOAN}** *(Product Owner)*
Every loan states the date by which the book is returned.
*Check:* \`tests/loan.test.mjs\`

**${SHELF}** *(Product Owner)*
Every book stands on one shelf.
*Check:* \`tests/shelf.test.mjs\`

## 2. Membership

**${CARD}** *(Product Owner)*
Every member holds a card.
*Check:* \`tests/card.test.mjs\`
`;

// The group file of the library: the Lending group holds A LOAN HAS A DUE DATE then A BOOK IS SHELVED, the Membership group A MEMBER HAS A CARD, and A LIBRARY LENDS BOOKS stands in no group.
const GROUPS = `- Lending\n  - ${LOAN}\n  - ${SHELF}\n- Membership\n  - ${CARD}\n`;

// A Host of the test's own: the default branch main, a SPEC and a group file at every ref, and no write.
function host({ defaultBranch = "main", info = true } = {}) {
  const files = { "SPEC.md": SPEC, "docs/groups/requirements.md": GROUPS };
  const fake = { async readSnapshot(ref) { return { ref, commit: ref, paths: Object.keys(files), read: async (path) => files[path] ?? null, blob: () => null }; }, async listTags() { return []; } };
  if (info === true) fake.repositoryInfo = async () => ({ defaultBranch, visibility: "public", canWrite: false, archived: false, description: "" });
  else if (info === "fails") fake.repositoryInfo = async () => { throw Object.assign(new Error("unreachable"), { name: "Unreachable" }); };
  return fake;
}
const find = (root, match) => {
  const found = [];
  (function walk(node) { for (const kid of node.childNodes) { if (kid.nodeType === 1) { if (match(kid)) found.push(kid); walk(kid); } } })(root);
  return found;
};
async function render(productHost, ref) {
  const target = document.createElement("div");
  document.body.append(target);
  await route.render(target, { product: { address: "https://github.com/acme/library", kind: "github", host: productHost } }, { key: "specification", ref });
  return target;
}
const links = (target, className) => find(target, (node) => node.localName === "a" && node.className.split(/\s+/).includes(className));

// TST-360001 · level: unit · module: MOD-trace-pages
// guards: EDITS ARE PREPARED ON THE DASHBOARD; UC-018
// given: the specification of a library on the default branch main, with one requirement before every section, two in "## 1. Lending" and one in "## 2. Membership"
// input: the public trace/specification route rendered at the ref main
// expect: Edit beside each of the four requirements, in its own row, each an anchor to #requirement/name=<its name, encoded>/product=<the product's address, encoded>, in the order of the SPEC
test("TST-360001 Edit stands beside each requirement on the default branch and leads to the requirement's edit route", async () => {
  const target = await render(host(), "main");
  const edits = links(target, "requirement-edit");
  assert.deepEqual(edits.map((node) => node.textContent), ["Edit", "Edit", "Edit", "Edit"]);
  assert.deepEqual(edits.map((node) => node.getAttribute("href")), [OUTSIDE, LOAN, SHELF, CARD].map((name) => `#requirement/name=${encodeURIComponent(name)}/product=${encodeURIComponent("https://github.com/acme/library")}`));
  for (const [edit, name] of edits.map((node, at) => [node, [OUTSIDE, LOAN, SHELF, CARD][at]])) {
    const row = edit.parentNode.parentNode;
    assert.equal(row.localName, "tr");
    assert.equal(find(row, (node) => node.localName === "button")[0].textContent, name, `${name}: its Edit is in its own row`);
  }
});

// TST-360002 · level: unit · module: MOD-trace-pages
// guards: EDITS ARE PREPARED ON THE DASHBOARD; UC-018
// given: the same specification on the default branch, whose groups are Lending and Membership
// input: the route rendered at main
// expect: + Requirement once for each of the two sections of the SPEC, an anchor to #requirements/section=<the section's heading line, encoded>/product=<the product's address, encoded> — "## 1. Lending", "## 2. Membership" —, in a list beside the tree, in no group of it, each in an item that names its section; none for the requirement before the first section
test("TST-360002 + Requirement stands once for each SPEC section, beside the tree, and opens requirements/new for that section", async () => {
  const target = await render(host(), "main");
  const groups = find(target, (node) => node.localName === "section" && node.className.includes("spec-group"));
  assert.equal(groups.length, 2, "known positive: the tree holds the two groups of the group file");
  const added = links(target, "requirement-new");
  assert.deepEqual(added.map((node) => node.textContent), ["+ Requirement", "+ Requirement"]);
  assert.deepEqual(added.map((node) => node.getAttribute("href")), ["## 1. Lending", "## 2. Membership"].map((heading) => `#requirements/section=${encodeURIComponent(heading)}/product=${encodeURIComponent("https://github.com/acme/library")}`));
  for (const group of groups) assert.deepEqual(links(group, "requirement-new"), [], "no group holds a + Requirement");
  const list = find(target, (node) => node.localName === "ul" && node.className.includes("spec-add-requirements"));
  assert.equal(list.length, 1, "one list holds them");
  assert.deepEqual(find(list[0], (node) => node.localName === "li").map((item) => item.textContent), ["1. Lending + Requirement", "2. Membership + Requirement"]);
  assert.equal(find(list[0], (node) => node.localName === "a" && node.className.includes("requirement-new")).length, 2);
  assert.equal(find(target, (node) => node.localName === "a").length, 9, "four Edit, two + Requirement, the Gaps link, the links to the history of SPEC changes and Arrange, nothing else");
});

// TST-360003 · level: unit · module: MOD-trace-pages
// guards: EDITS ARE PREPARED ON THE DASHBOARD; UC-018
// given: the same specification, read at the tag v1.0 and at a commit — not the default branch main —; the page at main shown to hold the links first
// input: the route rendered at v1.0 and at a commit of forty digits
// expect: every requirement and every section is listed as at main, and neither Edit nor + Requirement is offered
test("TST-360003 neither Edit nor + Requirement is offered on a tag or any ref but the default branch", async () => {
  const onMain = await render(host(), "main");
  assert.equal(links(onMain, "requirement-edit").length + links(onMain, "requirement-new").length, 6, "known positive: main offers them");
  for (const ref of ["v1.0", "0123456789abcdef0123456789abcdef01234567"]) {
    const target = await render(host(), ref);
    assert.deepEqual(find(target, (node) => node.localName === "button" && node.className.includes("requirement-name")).map((node) => node.textContent), [OUTSIDE, LOAN, SHELF, CARD], ref);
    assert.deepEqual([links(target, "requirement-edit").length, links(target, "requirement-new").length], [0, 0], ref);
  }
});

// TST-360004 · level: unit · module: MOD-trace-pages
// guards: EDITS ARE PREPARED ON THE DASHBOARD
// given: a Host whose default branch is trunk, the page rendered at trunk and at main; a Host that cannot name its default branch (no repositoryInfo) and one whose repositoryInfo fails
// input: the route rendered at trunk and at main on the first; at main on the others
// expect: links at trunk, none at main on the first — the default branch is the Host's, not a name assumed —; none on the others, whose requirements are still listed
test("TST-360004 the default branch is the Host's own, and a Host that cannot name it offers no link", async () => {
  const trunk = host({ defaultBranch: "trunk" });
  assert.equal(links(await render(trunk, "trunk"), "requirement-edit").length, 4, "known positive: trunk is the default branch");
  assert.equal(links(await render(trunk, "main"), "requirement-edit").length, 0);
  for (const info of [false, "fails"]) {
    const target = await render(host({ info }), "main");
    assert.equal(find(target, (node) => node.localName === "button" && node.className.includes("requirement-name")).length, 4, `${info}: the requirements are listed`);
    assert.deepEqual([links(target, "requirement-edit").length, links(target, "requirement-new").length], [0, 0], String(info));
  }
});

// TST-399001 · level: unit · module: MOD-trace-pages
// guards: EDITS ARE PREPARED ON THE DASHBOARD; UC-019
// given: the specification of the library on its default branch, with four requirements
// input: the route rendered at main, then each requirement opened through its requirement-name control
// expect: each of the four opened requirements shows its detail (a section.requirement-detail headed by its name) and Edit beside its name as the known positive; no opened requirement offers Change by prompt: no anchor of the class requirement-prompt, no text "Change by prompt" on the page, no anchor whose address ends with /prompt=1
test("TST-399001 an opened requirement offers no Change by prompt", async () => {
  const target = await render(host(), "main");
  const requirements = find(target, (node) => node.localName === "button" && node.className.includes("requirement-name"));
  requirements.forEach((button) => button.dispatchEvent(new Event("click")));

  const details = find(target, (node) => node.localName === "section" && node.className.includes("requirement-detail"));
  assert.deepEqual(details.map((node) => node.childNodes[0].textContent), [OUTSIDE, LOAN, SHELF, CARD], "known positive: each opened requirement shows its detail");
  assert.equal(links(target, "requirement-edit").length, 4, "known positive: Edit stays");
  assert.equal(links(target, "requirement-prompt").length, 0);
  assert.equal(target.textContent.includes("Change by prompt"), false);
  assert.deepEqual(find(target, (node) => node.localName === "a").map((node) => node.getAttribute("href")).filter((href) => /\/prompt=1$/.test(href ?? "")), []);
});

// TST-399002 · level: unit · module: MOD-trace-pages
// guards: EDITS ARE PREPARED ON THE DASHBOARD; UC-019
// given: the same specification on the default branch, whose Lending group holds LOAN then SHELF and whose Membership group holds CARD
// input: the route rendered at main, then each group opened through its spec-group-toggle control
// expect: both groups are opened (their lists no longer hidden) with + Requirement for each section as the known positive; no group offers Change by prompt: no anchor of the class requirement-group-prompt, no text "Change by prompt", no anchor whose address starts with #requirements/requirements=
test("TST-399002 an opened requirement group offers no Change by prompt", async () => {
  const target = await render(host(), "main");
  find(target, (node) => node.localName === "button" && node.className.includes("spec-group-toggle")).forEach((button) => button.dispatchEvent(new Event("click")));

  const groups = find(target, (node) => node.localName === "section" && node.className.includes("spec-group"));
  assert.deepEqual(groups.map((group) => find(group, (node) => node.localName === "div" && node.className.includes("spec-group-body") && node.getAttribute("hidden") === null).length), [1, 1], "known positive: both groups are opened");
  assert.equal(links(target, "requirement-new").length, 2, "known positive: + Requirement stays");
  assert.equal(links(target, "requirement-group-prompt").length, 0);
  assert.equal(target.textContent.includes("Change by prompt"), false);
  assert.deepEqual(find(target, (node) => node.localName === "a").map((node) => node.getAttribute("href")).filter((href) => (href ?? "").startsWith("#requirements/requirements=")), []);
});

// TST-399003 · level: unit · module: MOD-trace-pages
// guards: EDITS ARE PREPARED ON THE DASHBOARD; UC-019
// given: the same specification on the default branch main and at the tag v1.0
// input: on each ref, every requirement and group is opened through its existing control
// expect: main has four Edit and two + Requirement as the known positive and no Change by prompt control; the tag has none of them, while all four requirements remain readable
test("TST-399003 neither the default branch nor a tag offers Change by prompt on requirements or groups", async () => {
  const openAll = async (ref) => {
    const target = await render(host(), ref);
    find(target, (node) => node.localName === "button" && (node.className.includes("requirement-name") || node.className.includes("spec-group-toggle"))).forEach((button) => button.dispatchEvent(new Event("click")));
    return target;
  };
  const prompts = (target) => [links(target, "requirement-prompt").length, links(target, "requirement-group-prompt").length, target.textContent.includes("Change by prompt") ? 1 : 0];
  const onMain = await openAll("main");
  assert.deepEqual([links(onMain, "requirement-edit").length, links(onMain, "requirement-new").length], [4, 2], "known positive: the default branch offers Edit and + Requirement");
  assert.deepEqual(prompts(onMain), [0, 0, 0]);

  const onTag = await openAll("v1.0");
  assert.deepEqual(find(onTag, (node) => node.localName === "button" && node.className.includes("requirement-name")).map((node) => node.textContent), [OUTSIDE, LOAN, SHELF, CARD]);
  assert.deepEqual(prompts(onTag), [0, 0, 0]);
});

// TST-515003 · level: unit · module: MOD-trace-pages
// guards: THE SITE WEARS THE PATTERN RECOGNITION LAB'S LOOK; UC-020
// given: the specification of a library on the default branch main, two sections
// input: the route rendered at main
// expect: each + Requirement is the last child of its list item, no table is its sibling, and the list follows the tree (the section that holds the requirements), so that no table stands against it
test("TST-515003 + Requirement stands in a list after the tree and touches no table", async () => {
  const target = await render(host(), "main");
  const added = links(target, "requirement-new");
  assert.equal(added.length, 2, "known positive: both sections offer + Requirement");
  for (const link of added) {
    assert.equal(link.parentNode.localName, "li", `${link.getAttribute("href")}: it stands in a list item`);
    assert.equal(link.nextSibling, null, "nothing follows it in its item");
    assert.deepEqual(find(link.parentNode, (node) => node.localName === "table"), []);
    assert.equal(link.parentNode.parentNode.previousSibling.className.includes("current-requirements"), true, "the list follows the tree");
  }
});
