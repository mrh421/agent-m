// Release tests of ITM-1067 — the review pages find the register's entries through MOD-source-register's `registerPaths`, so that a file under `docs/sources/` that is no `SRC-` entry is read as no entry of the register, and the files the SPEC entry page asks for in its batches are those `registerPaths` names. The behaviour is
// docs/architecture/MOD-source-register.md's (`registerPaths(paths)`: "the paths among `paths` that are register entries, `docs/sources/SRC-<slug>.md`, in their order: a caller that holds a tree's paths names the register's files without a copy of the pattern"; `personSource`: "the register entry of kind `person` whose `identifier` is the account [...] and which the product links")
// and docs/architecture/MOD-review-pages.md's (the SPEC entry's page and Review all; "a participant asked to change [...]: the subject's parameters carry the person's own source, which `personSource` names among the product's linked sources; without one, the change does not start and names the step that is missing (UC-004, UC-015, UC-019 4b)"), and the SPEC's DEVELOP AGAINST INTERFACES,
// THE INSTANCE KEEPS THE SOURCE REGISTER ("An instance lists every requirement source it knows in `docs/sources/` of its own repository, one file per source") and THE PERSON WHO PROMPTS IS A SOURCE.
// Run: node --test tests/release-itm-1067-register-entries.test.mjs
//
// Module: MOD-review-pages
// Module: MOD-source-register
// Guards: DEVELOP AGAINST INTERFACES; THE INSTANCE KEEPS THE SOURCE REGISTER; THE PERSON WHO PROMPTS IS A SOURCE; A PAGE LOAD READS THE REPOSITORY IN BATCHES; UC-006; UC-019
// Level: release
//
// Written for the release testing of sprint 125 by a participant who implemented none of ITM-1067 (RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER). The world is the one of the main page's tests (tests/main-page-home-harness.mjs: the counting fake GitHub behind the real MOD-repository-hosts, the browser of the instance alice/agent-m), with a product holding one queue
// of one open entry, and the instance holding a register; the route `spec-entry` of the real MOD-review-pages is drawn as a person opens a SPEC change entry, and the subject it gives the prompt bar is read in the context it was drawn in, as tests/release-itm-1273-entry-own-queue.test.mjs reads it. The implementer's cases (tests/review-pages-spec-entries-register-paths.test.mjs) call
// `sourcesOf` and `queueService.view` over snapshots of their own; these cases end at the requests the real host sends and at the source the page gives the prompt bar. The fake serves the register of the instance with files under docs/sources/ whose names do not begin with SRC-, one of them shaped like an entry of the person's own account.
// Readings the texts leave open, which the cases state:
//   - A file "is read as a register entry" when the page gives the prompt bar its identifier as the person's source, or asks the server for its text; a file under docs/sources/ is "no SRC- entry" when its name does not begin with SRC- (registerPaths: `docs/sources/SRC-<slug>.md`).
//   - The person is the owner of the instance's repository, the account github.com/alice (personAccount); the product links a source by a row of its docs/sources.md.
//   - A path is "asked for" when any request of the fake names it, in a batch or by itself; the tree request lists every path and names none.
//   - "The page's batches" are the requests of kind batch of the fake's log; the instance's own page is the page drawn with no product.

import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { INSTANCE, INSTANCE_TOKEN, INSTANCE_URL, PRODUCT, PRODUCT_TOKEN, PRODUCT_URL, browser, byClass, draw, find, instanceFiles, network, smallProduct, timers } from "./main-page-home-harness.mjs";
import { withStoredGraph } from "./stored-graph-fake.mjs";
import { connect, parseAddress } from "../src/repository-hosts/index.mjs";
import { registerPaths } from "../src/source-register/index.mjs";

const { view } = await import("../src/review-pages/index.mjs");
const entryRoute = view.routes.find((candidate) => candidate.name === "spec-entry");

const text = (...lines) => `${lines.join("\n")}\n`;
const TICK = "`";
const SPEC_DIR = "docs/spec-freigaben/";
const QUEUE = "2026-10-29_register";
const ID = `spec-${QUEUE}-01`;
const ANCHOR = "## 1. Section";

// A register entry of a person's account, as MOD-source-register's schema reads it.
const entry = (id, account) => text("---", `id: ${id}`, `title: ${id}`, "kind: person", `identifier: ${account}`, "authority: informational", "licence: may be republished - fixture",
  "---", `# ${id} ${id}`, "", "## Versions", "", "| Version | Date | Edition | Read from | Files |", "|---|---|---|---|---|", "| `2026-10-13` | 2026-10-13 | fixture | this repository | one file, hashed only |");
const linksTo = (id) => text("# Requirement sources of the product", "", "| Source | Version | Hash | Part |", "|---|---|---|---|", `| ${id} | 2026-10-13 | ${"0".repeat(64)} | |`);
// One queue of one open entry, on the section of smallProduct's SPEC.
const queue = () => ({
  [`${SPEC_DIR}${QUEUE}/index.md`]: text(`# SPEC approvals — queue 2026-10-29 · register`, "", `**Zieldatei aller Einträge:** ${TICK}SPEC.md${TICK}`, "",
    "| Nr | Datei | Anker (Überschrift, wortgetreu) | bis (exklusiv) | Commits |", "|---|---|---|---|---|", `| 01 | ${TICK}SPEC.md${TICK} | ${ANCHOR} | — | — |`),
  [`${SPEC_DIR}${QUEUE}/entscheidungen.md`]: text("# Decisions — queue 2026-10-29", "", "Append-only."),
  [`${SPEC_DIR}${QUEUE}/01-entry.md`]: text(ANCHOR, "", "**FIRST RULE** *(Product Owner)*", "The first rule holds on every page.", "*Check:* no automatic check; at review.", "",
    "**SECOND RULE** *(Product Owner)*", "The second rule holds.", "*Check:* no automatic check; at review."),
  [`${SPEC_DIR}${QUEUE}/01-entry.begruendung.md`]: text(`# ${ANCHOR}: a change`, "", "**The change.** A fixture.", "", "**Why.** Clearer."),
});
// Files under docs/sources/ that are no register entry: no SRC- in the name.
const README = { "docs/sources/README.md": "# The register\n\nOne file per source.\n" };

let net = null;
afterEach(() => { net?.restore(); net = null; timers.restore(); document.body?.replaceChildren(); });

/** The world: the fake GitHub holding the product and the instance; `own` draws the instance's own page (no product). The host of the page serves the trace graph the workflow "main changed" stores. */
function worldWith({ product, instance, own = false }) {
  net = network({ [PRODUCT]: product, [INSTANCE]: instance });
  net.install();
  const context = browser();
  const real = connect(parseAddress(own ? INSTANCE_URL : PRODUCT_URL), { token: own ? INSTANCE_TOKEN : PRODUCT_TOKEN });
  const host = { ...real, readSnapshot: async (ref) => withStoredGraph(await real.readSnapshot(ref)) };
  if (own) context.instance = { ...context.instance, host };
  else context.product = { address: PRODUCT_URL, kind: "github", host, tokenStored: true };
  return { context, mark: net.server.log.length };
}
// The paths under docs/sources/ that a request of the fake named since `mark`, once each; `kind` limits them to the requests of that kind.
const askedFor = (mark, kind) => [...new Set(net.server.log.slice(mark).filter((request) => kind === undefined || request.kind === kind).flatMap((request) => request.files)
  .filter((path) => path.startsWith("docs/sources/")))].sort();
// The source the page gives the prompt bar for the entry, in the context the entry's page was drawn in.
const sourceOf = (context) => entryRoute.subject({ id: ID }, context)?.paramsFor().source;

// TST-1067301 · level: release · module: MOD-review-pages
// guards: DEVELOP AGAINST INTERFACES; THE INSTANCE KEEPS THE SOURCE REGISTER; THE PERSON WHO PROMPTS IS A SOURCE; UC-019
// given: the product has an open entry and links the source SRC-notes in its docs/sources.md; the instance alice/agent-m holds under docs/sources/ the register entry SRC-bob, README.md, and notes.md, which is no SRC- entry but is shaped like one: id SRC-notes, kind person, identifier github.com/alice, the instance owner's account; known positive first — the same instance with that text in docs/sources/SRC-notes.md in place of notes.md
// input: a person opens the entry's page on the product (the route spec-entry with id=spec-2026-10-29_register-01); the subject the page gives the prompt bar is read in that context
// expect: with the text in SRC-notes.md the subject's source is SRC-notes (known positive) and the server is asked for both of the register's entries, docs/sources/SRC-bob.md and docs/sources/SRC-notes.md; with it in notes.md the subject has no source — the change names the missing step — and the server is asked for docs/sources/SRC-bob.md and for no other file of docs/sources/, README.md and notes.md not among them
// Planted fault: the old rule back in sourcesOf (`registerPaths(holder.paths)` replaced by `holder.paths.filter((path) => /^docs\/sources\/[^/]+\.md$/.test(path))` in src/review-pages/spec-entries.mjs) reads notes.md as an entry, gives the prompt bar the source SRC-notes, asks for README.md and notes.md, and the case fails on the source (TST-1067302 fails on the files asked for).
// Planted fault: registerPaths itself taking any file of docs/sources/ (the pattern REGISTER_ENTRY of src/source-register/index.mjs loosened to `^docs/sources/[^/]+\.md$`) names README.md and notes.md as entries too, and the case fails on its known positive (the files asked for), as TST-1067302 does on its own.
test("TST-1067301 the entry page reads no file of docs/sources/ that is no SRC- entry as the person's source, and asks the server for no such file", async () => {
  const product = { ...smallProduct({ accepted: ["UC-001", "UC-002"] }), ...queue(), "docs/sources.md": linksTo("SRC-notes") };
  const register = { ...instanceFiles(), ...README, "docs/sources/SRC-bob.md": entry("SRC-bob", "github.com/bob") };

  const named = worldWith({ product, instance: { ...register, "docs/sources/SRC-notes.md": entry("SRC-notes", "github.com/alice") } });
  const positive = await draw(entryRoute, named.context, { id: ID });
  assert.equal(byClass(positive, "badge")[0]?.textContent, "open", "known positive: the entry is drawn");
  assert.equal(sourceOf(named.context), "SRC-notes", "known positive: an entry named SRC-notes.md is the person's source");
  assert.deepEqual(askedFor(named.mark).filter((path) => registerPaths([path]).length), ["docs/sources/SRC-bob.md", "docs/sources/SRC-notes.md"], "known positive: the register's two entries are asked for");
  net.restore(); net = null; timers.restore(); document.body.replaceChildren();

  const stray = worldWith({ product, instance: { ...register, "docs/sources/notes.md": entry("SRC-notes", "github.com/alice") } });
  const page = await draw(entryRoute, stray.context, { id: ID });
  assert.equal(byClass(page, "badge")[0]?.textContent, "open", "the entry is drawn");
  assert.equal(sourceOf(stray.context), undefined, "failure node: a file that is no SRC- entry was read as the person's source");
  assert.deepEqual(askedFor(stray.mark), ["docs/sources/SRC-bob.md"], "failure node: the server was asked for a file of docs/sources/ that registerPaths does not name");
});

// TST-1067302 · level: release · module: MOD-review-pages
// guards: DEVELOP AGAINST INTERFACES; THE INSTANCE KEEPS THE SOURCE REGISTER; A PAGE LOAD READS THE REPOSITORY IN BATCHES; UC-006
// given: the instance's own SPEC with a queue of one open entry; under docs/sources/ the register entries SRC-alice and SRC-bob, README.md, and notes.md, which is no SRC- entry; known positive first — registerPaths over the instance's paths names SRC-alice.md and SRC-bob.md
// input: a person opens the entry's page on the instance's own page (no product), and then Review all (id=all)
// expect: on both pages the batches the page sends name, of docs/sources/, exactly the files registerPaths names, docs/sources/SRC-alice.md and docs/sources/SRC-bob.md, and no request of any kind names README.md or notes.md
// Planted fault: the old rule back in sourcePaths (`registerPaths(snapshot.paths)` replaced by `snapshot.paths.filter((path) => /^docs\/sources\/[^/]+\.md$/.test(path))` in src/review-pages/spec-entries.mjs) puts README.md and notes.md into the batch, and the case fails on the batch of the entry page (TST-1067301 passes: a product's page does not batch the register).
// Planted fault: the register left out of the batch (`...(context.product ? [] : registerPaths(snapshot.paths))` of sourcePaths replaced by `...[]`) names neither entry in the batch, and the case fails on the batch of the entry page.
test("TST-1067302 the batches of the entry page and of Review all name, of docs/sources/, the files registerPaths names", async () => {
  const instance = { ...smallProduct({ accepted: ["UC-001", "UC-002"] }), ...instanceFiles(), ...queue(), "docs/sources.md": linksTo("SRC-alice"), ...README,
    "docs/sources/SRC-alice.md": entry("SRC-alice", "github.com/alice"), "docs/sources/SRC-bob.md": entry("SRC-bob", "github.com/bob"), "docs/sources/notes.md": entry("SRC-notes", "github.com/alice") };
  const expected = registerPaths(Object.keys(instance));
  assert.deepEqual(expected, ["docs/sources/SRC-alice.md", "docs/sources/SRC-bob.md"], "known positive: registerPaths names the two entries");

  // Each page is opened in a world of its own: a file whose blob the host has read already is not read again, so a second page in one world would ask for none.
  const entryPage = worldWith({ product: {}, instance, own: true });
  const page = await draw(entryRoute, entryPage.context, { id: ID });
  assert.equal(byClass(page, "badge")[0]?.textContent, "open", "the entry page is drawn");
  assert.deepEqual(askedFor(entryPage.mark, "batch"), expected, "failure node: the entry page's batch is not the files of docs/sources/ that registerPaths names");
  assert.deepEqual(askedFor(entryPage.mark), expected, "failure node: a file of docs/sources/ that is no SRC- entry was asked for");
  net.restore(); net = null; timers.restore(); document.body.replaceChildren();

  const reviewAll = worldWith({ product: {}, instance, own: true });
  const all = await draw(entryRoute, reviewAll.context, { id: "all" });
  assert.deepEqual(find(all, (node) => node.localName === "h2").map((node) => node.textContent), ["Review all — SPEC changes"], "Review all is drawn");
  assert.deepEqual(askedFor(reviewAll.mark, "batch"), expected, "failure node: Review all's batch is not the files of docs/sources/ that registerPaths names");
  assert.deepEqual(askedFor(reviewAll.mark), expected, "failure node: Review all asked for a file of docs/sources/ that is no SRC- entry");
});
