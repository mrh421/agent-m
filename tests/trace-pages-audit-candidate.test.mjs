// The audit of a release candidate shows the candidate's rows (ITM-1227): the release panel embeds MOD-trace-pages' route `trace` with `key` `audit`, the
// candidate's tag as `ref` and its commit among the params (MOD-test-pages.md, `release`: "every requirement with its evidence — the audit of the candidate");
// that audit derives its rows at the candidate's tag, as the audit of a release does at the release's (MOD-trace-pages.md, the audit), while the choice of
// tags on Tests → Audit stays the releases' (UC-030 1: "picks a release tag").
//
// Run: node --test tests/trace-pages-audit-candidate.test.mjs
//
// Module: MOD-trace-pages
// Guards: THE AUDIT VIEW LISTS EVERY REQUIREMENT OF THE RELEASE; UC-013; UC-030
// Level: unit
//
// The route is called through its public Route.render with a Host/Snapshot-shaped fake (tests/trace-pages-harness.mjs): a product whose tags are a release
// candidate v2026.2.0-rc.1, holding two requirements, and an earlier release v2026.1.0, holding one; each tag's commit is its snapshot's, whose trace graph the
// fake stores. Every expected text is stated in the case; none is read from a document. The counter-proofs are recorded in the pull request.

import test from "node:test";
import assert from "node:assert/strict";
import { document, find, treeHost } from "./trace-pages-harness.mjs";

const { view } = await import("../src/trace-pages/index.mjs");
const route = view.routes.find((candidate) => candidate.name === "trace");

const ADDRESS = "https://github.com/acme/product";
const CANDIDATE = "v2026.2.0-rc.1", RELEASE = "v2026.1.0";
const spec = (names) => ["# Fixture product — Specification", "", "## Rules", "",
  ...names.flatMap((name) => [`**${name}** *(PO A. Maier)*`, "A rule.", "*Check:* no automatic check; at review.", ""])].join("\n");
const AT_CANDIDATE = { "SPEC.md": spec(["A FIRST RULE", "A SECOND RULE"]) };
const AT_RELEASE = { "SPEC.md": spec(["AN OLD RULE"]) };

function productHost() {
  const tags = [CANDIDATE, RELEASE];
  const base = treeHost({ trees: { main: AT_CANDIDATE, [CANDIDATE]: AT_CANDIDATE, [RELEASE]: AT_RELEASE, "test-results": {} }, tags });
  return { ...base, async listTags() { return tags.map((name) => ({ name, commit: base.commitOf(name) })); } };
}
const instanceHost = () => treeHost({ trees: { main: { "SPEC.md": "# Fixture instance — Specification\n" } } });
async function render(params) {
  const target = document.createElement("div");
  document.body.append(target);
  const host = productHost();
  await route.render(target, { product: { address: ADDRESS, host }, instance: { host: instanceHost() } }, params);
  return { target, host };
}
const withClass = (root, name) => find(root, (node) => String(node.className).split(" ").includes(name));
const rowNames = (root) => withClass(root, "audit-row").map((row) => row.getAttribute("data-requirement"));

// TST-1227001 · level: unit · module: MOD-trace-pages
// guards: THE AUDIT VIEW LISTS EVERY REQUIREMENT OF THE RELEASE; UC-013
// given: a product whose tags are the candidate v2026.2.0-rc.1 (two requirements) and the release v2026.1.0 (one)
// input: Route.render with the key "audit", the candidate's tag as ref and its commit, as the release panel embeds it
// expect: one row for each requirement at the candidate — A FIRST RULE, A SECOND RULE —, read at the candidate's tag; the page does not say that no release is tagged
// Planted fault: an audit that offers only release tags draws "No release is tagged yet" — or the release's row — instead.
test("TST-1227001 the audit of a release candidate draws the candidate's rows", async () => {
  const probe = productHost();
  const commit = (await probe.listTags()).find((tag) => tag.name === CANDIDATE).commit;
  const { target, host } = await render({ key: "audit", ref: CANDIDATE, commit });
  assert.doesNotMatch(target.textContent, /No release is tagged yet/);
  assert.deepEqual(rowNames(target), ["A FIRST RULE", "A SECOND RULE"]);
  assert.ok(host.log.snapshots.includes(CANDIDATE), "the rows are read at the candidate's tag");
});

// TST-1227002 · level: unit · module: MOD-trace-pages
// guards: UC-030
// given: the same product
// input: Route.render with the key "audit" at the ref main, as Tests → Audit opens it
// expect: the choice of tags offers the release v2026.1.0 only, not the candidate; its row, AN OLD RULE, is drawn
// Planted fault: offering every tag puts the candidate into the choice.
test("TST-1227002 the audit of Tests → Audit still offers release tags only", async () => {
  const { target } = await render({ key: "audit", ref: "main" });
  const select = withClass(target, "version-choice")[0];
  assert.deepEqual(find(select, (node) => node.localName === "option").map((node) => node.getAttribute("value") ?? node.value), [RELEASE]);
  assert.deepEqual(rowNames(target), ["AN OLD RULE"]);
});
