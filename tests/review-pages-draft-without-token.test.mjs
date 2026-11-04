// MOD-review-pages' two derivation pages without a token (ITM-861), as the accepted text of docs/architecture/MOD-review-pages.md states it: "`<k>/draft` — drafting: … for requirements,
// the linked source …; for the architecture, what the derivation covers, its preconditions, the drafting and the reviewing participant …; then the run panel and *Run*", and "Without a
// token for GitHub, *Accept* and *Edit* open GitHub's prefilled pages … for a GitLab product without a token, neither is offered, and the token's step is linked". A page that starts a job
// writes a job record with the person's token, so without a token the page offers no run panel and gives the step to store one, as the drafting page of use cases does: a paragraph
// "A job is recorded and its result written with your token. " followed by the link "Store the token" to the add-product page of the product (#add/<the product's address>).
// Run: node --test tests/review-pages-draft-without-token.test.mjs
//
// Module: MOD-review-pages
// Guards: WITHOUT A TOKEN, GITHUB'S WEB INTERFACE IS THE FALLBACK; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK
// Level: unit
//
// This imports the browser harness of tests/review-pages-harness.mjs and the fixtures of tests/review-pages-draft-world.mjs unchanged; it adds the linked source and the accepted use
// cases the two pages need to be drawn as far as the token's step. The product is a repository in memory behind a Host that keeps to MOD-repository-hosts' interface; the instance is
// a read-only snapshot with the register of participants and the register entry of the linked source. Nothing reaches the network: `fetch` is a spy that refuses.
// Where the module file leaves a reading open, the test states the one it takes, and the pull request names it:
//   - The requirements derivation is the route spec-entry with the id `draft` (#spec-entry/id=draft), the architecture derivation the route decision with the id `draft` (#decision/id=draft).
//   - The token's step is <a class="token-step"> in <p class="problem">; its address is "#add/" and the product's web address encoded; following it calls the frame's `go` with
//     "add-product" and the product's address.
// Each test states its input and its expected result before it runs (given / input / expect). The counter-proofs are recorded in the pull request.

import "./review-pages-harness.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { approvalSchema } from "../src/approvals/index.mjs";
import { writeDocument } from "../src/documents/index.mjs";
import { registerStrategies } from "../src/job-runner/index.mjs";
import { emptyStorage } from "./review-pages-harness.mjs";
import { pages, routeNamed, fakeProduct, contextOf, text, blobOf, GITHUB, REGISTER, INSTANCE_COMMIT, SPEC, UC7_PATH, UC8_PATH, UC7, UC8, byClass, fetched } from "./review-pages-draft-world.mjs";

(pages.view?.strategies ?? []).forEach((strategies, at) => registerStrategies(`tests/review-pages-draft-without-token.test.mjs#${at}`, strategies));
// The step due-diligence is registered by no module yet; a stub stands for it, and gives way when a module registers it.
try { registerStrategies("tests/review-pages-draft-without-token.test.mjs#stub", { steps: { "due-diligence": async (draft) => ({ draft, findings: [] }) } }); } catch { /* registered by a module */ }

// ---------------------------------------------------------------- the product and the linked source

const sha256Of = (body) => createHash("sha256").update(body).digest("hex");
const SOURCE = "SRC-policy", MAIN_FILE = "main.md";
const MAIN_TEXT = text("# Policy", "", "Chapter 1: loans state their due date.");
const MAIN_SHA = sha256Of(MAIN_TEXT);
const GOOD_HASH = sha256Of(`${MAIN_SHA}  ${MAIN_FILE}\n`);
const LINKS = text("# Requirement sources of the thesis tool", "", "| Source | Version | Hash | Part |", "|---|---|---|---|", `| ${SOURCE} | 2026-10-01 | ${GOOD_HASH} | Chapter 1 |`);
const SOURCE_ENTRY = text("---", `id: ${SOURCE}`, "title: Library Policy", "kind: document", "authority: normative", "licence: may be republished - fixture", "---", `# ${SOURCE} Library Policy`, "",
  "## Versions", "", "| Version | Date | Edition | Read from | Files |", "|---|---|---|---|---|",
  `| 2026-10-01 | 2026-10-01 | fixture | fixture | 1 file, listed below; version hash \`${GOOD_HASH}\` |`, "",
  "### Files of 2026-10-01", "", "| File | SHA-256 |", "|---|---|", `| \`${MAIN_FILE}\` | \`${MAIN_SHA}\` |`, "", "## Parts", "", "- Chapter 1");
const SOURCE_FILES = { [`docs/sources/${SOURCE}.md`]: SOURCE_ENTRY, [`docs/sources/${SOURCE}/2026-10-01/${MAIN_FILE}`]: MAIN_TEXT };

const accepted = (id, path, body) => ({ [`docs/approvals/${id}-${blobOf(body).slice(0, 12)}.md`]: writeDocument(approvalSchema, { fields: { kind: "use-case", file: path, blob: blobOf(body) } }) });
// Every use case accepted, no architecture, no SPEC change open, one linked source whose version can be read: a product whose two derivation pages are drawn in full.
const FILES = { "README.md": "# Thesis tool\n", "SPEC.md": SPEC, [UC7_PATH]: UC7, [UC8_PATH]: UC8, ...accepted("UC-007", UC7_PATH, UC7), ...accepted("UC-008", UC8_PATH, UC8), "docs/sources.md": LINKS };

const ROOT = new URL("../", import.meta.url);
const onDisk = (path) => { try { return readFileSync(new URL(path, ROOT), "utf8"); } catch { return null; } };
function instanceHost() {
  const snapshot = { repository: { server: "github", origin: "https://github.com", path: "alice/agent-m", web: "https://github.com/alice/agent-m" }, ref: "main", commit: INSTANCE_COMMIT,
    paths: Object.keys(SOURCE_FILES).sort(), read: async (path) => (path === "docs/participants.md" ? REGISTER : path in SOURCE_FILES ? SOURCE_FILES[path] : onDisk(path)), blob: () => null };
  return { async repositoryInfo() { return { defaultBranch: "main", visibility: "public", canWrite: false, archived: false, description: "" }; }, async readSnapshot() { return snapshot; } };
}

// ---------------------------------------------------------------- the page

// The page `name` with the id `draft`, in a context whose frame records where `go` is asked to go; the store holds the product's token, or none.
async function drawDraft(name, { token }) {
  emptyStorage();
  const fake = fakeProduct(FILES);
  const context = contextOf(fake, { token });
  context.instance = { ...context.instance, host: instanceHost() };
  const went = [];
  context.go = (to, params) => { went.push({ to, params }); };
  const route = routeNamed(name);
  assert.ok(route, `the route ${name}: ${pages.error?.message}`);
  const target = document.createElement("div");
  document.body.append(target);
  await route.render(target, context, { id: "draft" });
  return { target, went, fake };
}
const stepOf = (target) => byClass(target, "a", "token-step");
const STEP_TEXT = "A job is recorded and its result written with your token. Store the token";
const STEP_HREF = `#add/${encodeURIComponent(GITHUB.web)}`;

for (const [name, route, drawn] of [
  ["the derivation of requirements", "spec-entry", (target) => byClass(target, "section", "source-selection").length],
  ["the derivation of the architecture", "decision", (target) => byClass(target, "section", "covers").length],
]) {
  // TST-1429035 · level: unit · module: MOD-review-pages
  // guards: WITHOUT A TOKEN, GITHUB'S WEB INTERFACE IS THE FALLBACK; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK
  // given: a product with a linked source whose version can be read, accepted use cases, and no token stored for it; the page of the token's step is the add-product page
  // input: the page `route`/id=draft, drawn
  // expect: the render finishes without a throw; the page is drawn (the known positive: its selection section is there); a paragraph reads exactly "A job is recorded and its result written with your token. Store the token"; one link of class token-step with the address #add/<the product's address, encoded> and the text "Store the token"; no button that shows the run panel, no run panel; nothing written; nothing fetched
  test(`TST-1429035: ${route}/draft — without a token the page of ${name} gives the step to store one, and offers no run panel`, async () => {
    const { target, fake } = await drawDraft(route, { token: false });
    assert.equal(drawn(target), 1, "known positive: the page is drawn");
    const steps = stepOf(target);
    assert.equal(steps.length, 1);
    assert.equal(steps[0].getAttribute("href"), STEP_HREF);
    assert.equal(steps[0].textContent, "Store the token");
    const problems = byClass(target, "p", "problem").filter((paragraph) => paragraph.textContent.includes("context is not defined") || paragraph.textContent.includes("A job is recorded"));
    assert.deepEqual(problems.map((paragraph) => paragraph.textContent), [STEP_TEXT]);
    assert.equal(byClass(target, "button", "prepare").length, 0);
    assert.equal(byClass(target, "section", "run-panel").length, 0);
    assert.equal(fake.writes().length, 0);
    assert.deepEqual(fetched, []);
  });

  // TST-1429036 · level: unit · module: MOD-review-pages
  // guards: WITHOUT A TOKEN, GITHUB'S WEB INTERFACE IS THE FALLBACK; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK
  // given: the same product with the product's token stored
  // input: the page `route`/id=draft, drawn
  // expect: the page is drawn; no token step; the button that shows the run panel is there — the fixture reaches the stage the token's step stands in place of
  test(`TST-1429036: ${route}/draft — with a token the page of ${name} offers the run panel and no token step`, async () => {
    const { target } = await drawDraft(route, { token: true });
    assert.equal(drawn(target), 1, "known positive: the page is drawn");
    assert.equal(stepOf(target).length, 0);
    assert.equal(byClass(target, "button", "prepare").length, 1);
  });

  // TST-1429037 · level: unit · module: MOD-review-pages
  // guards: WITHOUT A TOKEN, GITHUB'S WEB INTERFACE IS THE FALLBACK; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK
  // given: the page of the token's step, drawn without a token
  // input: a click on the link "Store the token"
  // expect: the frame is asked to go to "add-product" with the product's address, once, and the click's default (the address change) is prevented
  test(`TST-1429037: ${route}/draft — following the token's step of ${name} goes to the add-product page of the product`, async () => {
    const { target, went } = await drawDraft(route, { token: false });
    const [step] = stepOf(target);
    assert.ok(step, "known positive: the step is drawn");
    let prevented = false;
    const event = new Event("click");
    event.preventDefault = () => { prevented = true; };
    step.dispatchEvent(event);
    assert.deepEqual(went, [{ to: "add-product", params: { address: GITHUB.web } }]);
    assert.equal(prevented, true);
  });
}
