// MOD-site-frame's schemaForm: "It writes nothing itself: `onSave` does" (docs/architecture/MOD-site-frame.md, schemaForm), and THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK:
// "The dashboard writes to a repository only as the direct result of a person's action on it". So the form's *Save* calls `onSave` only for a click a person made.
// Run: node --test tests/site-frame-schema-form-click.test.mjs
//
// Module: MOD-site-frame
// Guards: THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK
// Level: unit
//
// The form is built over the real schema of the participants register. The small DOM of tests/site-frame-dom.mjs stands for the browser; node marks every Event untrusted, as a script's, and a person's click is the one
// the browser marks trusted (`isTrusted`), made here as tests/review-pages-architecture.test.mjs makes it. The reading, named in the pull request: "a click a person made" is a click event with `isTrusted === true`,
// as src/maintenance-pages/mail.mjs and replies.mjs read it. Nothing reaches the network.

import test from "node:test";
import assert from "node:assert/strict";
import { document } from "./site-frame-dom.mjs";

const { schemaForm } = await import("../src/site-frame/index.mjs");
const { readDocument } = await import("../src/documents/index.mjs");
const { participantSchema } = await import("../src/participant-list/index.mjs");

function elements(root, match) {
  const found = [];
  (function walk(n) { for (const k of n.childNodes) if (k.nodeType === 1) { if (match(k)) found.push(k); walk(k); } })(root);
  return found;
}
const byTag = (root, name) => elements(root, (e) => e.localName === name);
const turn = () => new Promise((resolve) => setImmediate(resolve));
const saveOf = (form) => byTag(form, "button").at(-1);
const scripted = async (node) => { node.dispatchEvent(new Event("click")); await turn(); };
const persons = async (node) => { node.dispatchEvent(Object.defineProperty(new Event("click"), "isTrusted", { value: true })); await turn(); };

const HEAD = "| Name | Type | Model | Context | Price | Capabilities | Processing place | Route |\n|---|---|---|---|---|---|---|---|\n";
const REGISTER = `# Participants of this instance\n\nThe participants.\n\n${HEAD}| ci-bot | CI agent | fixture-llm | 100000 | — | draft text | GitHub's hosted runners | ci hosted secret FIXTURE_KEY |\n`;

const formOver = (handed) => {
  const schema = participantSchema();
  return schemaForm(schema, readDocument(schema, "docs/participants.md", REGISTER), { onSave: async (given) => { handed.push(given); } });
};

// TST-1253001 · level: unit · module: MOD-site-frame
// guards: THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK
// given: a form over a valid participants register, whose Save is offered
// input: a click a script makes on Save (an event node marks untrusted); then once more
// expect: onSave is never called, and Save stays offered so that the person's own click can still save. Counter-proof: before the change the script-made click calls onSave
test("schemaForm — a click a script makes on Save calls no onSave", async () => {
  const handed = [];
  const form = formOver(handed);
  assert.equal(saveOf(form).disabled, false, "Save is offered");
  await scripted(saveOf(form));
  await scripted(saveOf(form));
  assert.deepEqual(handed, [], "a script-made click hands nothing over");
  assert.equal(saveOf(form).disabled, false, "Save is still offered");
});

// TST-1253002 · level: unit · module: MOD-site-frame
// guards: THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK
// given: a form over a valid participants register
// input: a script-made click on Save, then a person's click (marked trusted)
// expect: onSave is called exactly once, by the person's click, with the document of the form
test("schemaForm — a person's click on Save calls onSave once with the document", async () => {
  const handed = [];
  const form = formOver(handed);
  await scripted(saveOf(form));
  assert.equal(handed.length, 0, "nothing before the person's click");
  await persons(saveOf(form));
  assert.equal(handed.length, 1, "handed over once");
  assert.equal(handed[0].path, "docs/participants.md", "the document of the form is handed over");
});
