// Module: MOD-trace-pages
// MOD-trace-pages' specification view links *Arrange* (ITM-737), as the accepted text of docs/architecture/MOD-trace-pages.md states it: for the specification, "to the review pages, on the default
// branch only: *Edit* on a requirement, *+ Requirement* in each section, …, and *Arrange*"; the review pages' route `arrange/<group kind>` (MOD-review-pages) arranges the requirements. UC-021 step 1:
// "In the specification browser (UC-020) … the author presses **Arrange**".
// Run: node --test tests/trace-pages-arrange-link.test.mjs
//
// Guards: ARTIFACTS ARE ARRANGED IN NESTED GROUPS; UC-021
// Level: unit
//
// This imports the shared small DOM of tests/site-frame-dom.mjs unchanged, as the other tests of the views do, and calls the public trace/specification route with a Host of the test's own that keeps to
// MOD-repository-hosts' interface (repositoryInfo, readSnapshot) and has no write. Where the file leaves a reading open, the test states the one it takes, and the pull request names it:
//   - The link is one anchor with the text "Arrange" and the class arrange-link, to #arrange/kind=requirements/product=<the product's address, encoded> (`/product=` is the form MOD-site-frame's chosenProduct reads back), which is the address form the frame reads for the review pages' route `arrange/<group kind>` (routeOf takes the parts after the name as key=value, and the route arrange reads its parameter `kind`: a link to #arrange/requirements would open the page that asks which kind).
//   - The default branch is on view when the route's `ref` is the branch the Host's repositoryInfo names as the default (as tests/trace-pages-edit-links.test.mjs reads it); a tag is not.
// Each test states its input and its expected result before it runs; where a test expects the link to be absent, the same page is first shown to hold it. The counter-proofs are recorded in the pull request.

import "./site-frame-dom.mjs";
import test from "node:test";
import assert from "node:assert/strict";

const { view } = await import("../src/trace-pages/index.mjs");
const route = view.routes.find((candidate) => candidate.name === "trace");

const SPEC = `# Library — Specification

## 1. Lending

**A LOAN HAS A DUE DATE** *(Product Owner)*
Every loan states the date by which the book is returned.
*Check:* \`tests/loan.test.mjs\`
`;

// A Host of the test's own: the default branch main, a SPEC at every ref, and no write.
function host({ info = true } = {}) {
  const fake = { async readSnapshot(ref) { return { ref, commit: ref, paths: ["SPEC.md"], read: async (path) => (path === "SPEC.md" ? SPEC : null), blob: () => null }; }, async listTags() { return []; } };
  if (info) fake.repositoryInfo = async () => ({ defaultBranch: "main", visibility: "public", canWrite: false, archived: false, description: "" });
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

// TST-737001 · level: unit · module: MOD-trace-pages
// guards: ARTIFACTS ARE ARRANGED IN NESTED GROUPS; UC-021
// given: the specification of a library on the default branch main
// input: the public trace/specification route rendered at the ref main
// expect: one anchor "Arrange" of the class arrange-link, to #arrange/kind=requirements/product=https%3A%2F%2Fgithub.com%2Facme%2Flibrary
test("TST-737001 the specification view on the default branch links Arrange to arrange/requirements (#arrange/kind=requirements)", async () => {
  const target = await render(host(), "main");
  const arrange = links(target, "arrange-link");
  assert.deepEqual(arrange.map((node) => [node.textContent, node.getAttribute("href")]), [["Arrange", "#arrange/kind=requirements/product=https%3A%2F%2Fgithub.com%2Facme%2Flibrary"]]);
});

// TST-737002 · level: unit · module: MOD-trace-pages
// guards: ARTIFACTS ARE ARRANGED IN NESTED GROUPS; UC-021
// given: the same specification; known positive: the page at main holds the link, and the links of the view beside it (+ Requirement)
// input: the route rendered at the tag v1.0, at a commit of forty digits, and with a Host that cannot name its default branch (no repositoryInfo)
// expect: the specification is shown (its requirement is listed), and no Arrange is offered
test("TST-737002 Arrange is not offered on a tag, on a commit, or where the default branch is not known", async () => {
  const onMain = await render(host(), "main");
  assert.equal(links(onMain, "arrange-link").length, 1, "known positive: main offers it");
  assert.equal(links(onMain, "requirement-new").length, 1, "known positive: the view's other links to the review pages are there");
  for (const [productHost, ref] of [[host(), "v1.0"], [host(), "0123456789abcdef0123456789abcdef01234567"], [host({ info: false }), "main"]]) {
    const target = await render(productHost, ref);
    assert.match(target.textContent, /A LOAN HAS A DUE DATE/, `${ref}: the specification is shown`);
    assert.equal(links(target, "arrange-link").length, 0, ref);
  }
});
