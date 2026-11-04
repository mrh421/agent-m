// Release tests of the requirements UC-018 "Edit a specification or a use case in the dashboard" realises, each checked from what an author reads on the dashboard's editors and from the requests the fixture
// servers received: the editor with its preview, a SPEC edit saved as a proposal and never into the SPEC, a save refused on a text that changed and the edit kept, the identifier kept, a rename withdrawn and
// added, the impact list, a use case entering as open, the marks of a requirement's fields, its single statement and a use case's sections, writing only on a person's click, GitHub's pages without a token
// and no text in a link, GitLab only with a token, one click, the folded explanations. TST-376301 maps every requirement UC-018 realises to the release tests that
// guard it, this file's or other writers'.
// Run: node --test tests/release-uc-018-edit-a-specification-or-use-case.test.mjs
//
// Module: MOD-review-pages
// Module: MOD-spec-changes
// Module: MOD-artifact-edits
// Module: MOD-trace-pages
// Guards: UC-018
// Level: release
//
// Written for the release testing of sprint 142 by developer-opus-e (ITM-376), who implemented none of ITM-302, ITM-307, ITM-309, ITM-335, ITM-341, ITM-343, ITM-358, ITM-359, ITM-360, ITM-394 and ITM-397, nor the
// behaviour any case of this file guards. Of the code UC-018's flow runs, developer-opus-e built ITM-1273 (an entry's page and a requirement's editor read their own queue and the waiting ones) and ITM-1266 (a
// review page reads only the folders it shows), and ITM-1314 (the last accepted text of a file put back); the requirements that behaviour serves are mapped in BUILT_BY_WRITER to the release tests other
// writers wrote, and no case here guards them (RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER). The world is tests/uc-018-harness.mjs' library on GitHub and tests/uc-008-harness.mjs' product on GitHub or
// a GitLab server: the real pages, MOD-spec-changes, MOD-artifact-edits and MOD-repository-hosts behind fixture servers; the release team works from the specification and the pages, so each case ends at
// what a person reads or at the request a fixture server received. Where the code and the SPEC or UC-018 disagree the case follows the text and is marked `todo` with the word FINDING. Readings the texts
// leave open, which the cases state:
//   - "takes one click once its inputs are complete" (ONE CLICK PER DECISION) is read for Save: the text edited and, for a requirement, the Why given.

import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { testDeclarations } from "../src/test-document/index.mjs";
import { queues } from "../src/spec-changes/index.mjs";
import { LENDING, LIBRARY_SPEC, LOAN, MEMBERSHIP, MEMBERSHIP_HEADING, SPEC_HEAD, SPEC_TOKEN, areaOf, byClass, click, explainedOf, fullUseCase, linksOf, marksOf, queueWrites, resultOf, saveOf, scripted,
  specWorld, textOf, typeInto, until, whyOf } from "./uc-018-harness.mjs";
import { P41, UC41, TOKENS, badgeOf, world as useCaseWorld } from "./uc-008-harness.mjs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const UC = "docs/use-cases/UC-018-edit-a-specification-or-use-case.md";
const SELF = "tests/release-uc-018-edit-a-specification-or-use-case.test.mjs";
const settle = () => new Promise((resolve) => setTimeout(resolve, 300));
const RENEWED = LENDING.replace("is returned.", "is returned, or renewed.");
const FULL41 = fullUseCase("UC-041", "Check out a book", [LOAN]);
const proposalsOf = (writes) => queueWrites(writes).filter(([path]) => /\/\d\d-[^/]+\.md$/.test(path) && !path.endsWith(".begruendung.md"));
/** The editor of A LOAN HAS A DUE DATE in `w` with `body` typed and a Why, saved by one click; -> the page, once a commit or an answer stands. */
async function saveRequirement(w, body = RENEWED, why = "A loan may be renewed.") {
  const target = await w.draw("requirement", { name: LOAN });
  typeInto(target, body);
  whyOf(target).value = why;
  const before = w.writes().length;
  click(saveOf(target));
  await until(() => w.writes().length > before || /Nothing was saved/.test(resultOf(target)), "the save's outcome");
  return target;
}

// ---------------------------------------------------------------- the map

// Each requirement UC-018 realises, with the release tests that guard it: this file's, and those other writers wrote.
const EVIDENCE = {
  "EDITS ARE PREPARED ON THE DASHBOARD": [[SELF, "TST-376302"], ["tests/release-uc-006-approve-a-specification-change.test.mjs", "TST-371313"]],
  "A SPEC EDIT IS SAVED AS A PROPOSAL": [[SELF, "TST-376303"], ["tests/release-uc-019-change-requirements-by-prompt.test.mjs", "TST-418110"]],
  "A SAVE IS REFUSED WHEN THE TEXT CHANGED MEANWHILE": [[SELF, "TST-376304"], ["tests/release-uc-019-change-requirements-by-prompt.test.mjs", "TST-418111"]],
  "A REFUSED SAVE KEEPS THE EDIT": [[SELF, "TST-376305"], ["tests/release-uc-019-change-requirements-by-prompt.test.mjs", "TST-418111"]],
  "AN EDITED FILE KEEPS ITS IDENTIFIER": [[SELF, "TST-376306"]],
  "A RENAMED REQUIREMENT IS WITHDRAWN AND ADDED": [[SELF, "TST-376307"], ["tests/release-uc-019-change-requirements-by-prompt.test.mjs", "TST-418118"]],
  "A SPECIFICATION CHANGE IS APPROVED BEFORE IT IS WRITTEN": [[SELF, "TST-376308"], ["tests/release-uc-006-approve-a-specification-change.test.mjs", "TST-371302"]],
  "NO PROPOSAL WITHOUT THE CURRENT TEXT BESIDE IT": [["tests/release-uc-006-approve-a-specification-change.test.mjs", "TST-371303"]],
  "A REQUIREMENT IS NOT CHANGED WITHOUT AN IMPACT LIST": [[SELF, "TST-376309"], ["tests/release-uc-006-batched-reads.test.mjs", "TST-479201"]],
  "A REVIEWED ARTIFACT ENTERS THE DEFAULT BRANCH AS OPEN": [[SELF, "TST-376310"], ["tests/release-uc-023-review-pages.test.mjs", "TST-739107"]],
  "STATUS IS DERIVED FROM THE RECORDS": [["tests/release-itm-690-approval-records.test.mjs", "TST-690001"], ["tests/release-itm-1266-review-folders.test.mjs", "TST-1266301"]],
  "THE NAME IS THE ID AND IT SURVIVES": [["tests/release-uc-023-review-pages.test.mjs", "TST-739114"], ["tests/release-uc-021-group-artifacts-into-a-hierarchy.test.mjs", "TST-738109"]],
  "A REQUIREMENT HAS FOUR FIELDS": [[SELF, "TST-376311"], ["tests/release-sprint-15-spec-toggles.test.mjs", "TST-472518"]],
  "ONE STATEMENT PER REQUIREMENT": [[SELF, "TST-376312"]],
  "A USE CASE HAS ACTOR, PRECONDITION, FLOW AND POSTCONDITION": [[SELF, "TST-376313"], ["tests/release-uc-007-derive-use-cases-from-requirements.test.mjs", "TST-580303"]],
  "THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK": [[SELF, "TST-376314"]],
  "WITHOUT A TOKEN, GITHUB'S WEB INTERFACE IS THE FALLBACK": [[SELF, "TST-376315"], ["tests/release-uc-008-review-and-accept-a-use-case.test.mjs", "TST-372304"]],
  "NO TEXT TRAVELS IN A URL": [[SELF, "TST-376316"], ["tests/release-uc-008-review-and-accept-a-use-case.test.mjs", "TST-372303"]],
  "A GITLAB PRODUCT IS WRITTEN WITH A TOKEN": [[SELF, "TST-376317"], ["tests/release-uc-008-review-and-accept-a-use-case.test.mjs", "TST-372305"]],
  "ONE CLICK PER DECISION": [[SELF, "TST-376318"]],
  "EVERY STEP EXPLAINS ITSELF": [[SELF, "TST-376319"]],
};
// The requirements whose behaviour on UC-018's path this file's writer built: guarded here only by the release tests other writers wrote.
const BUILT_BY_WRITER = {
  "NO PROPOSAL WITHOUT THE CURRENT TEXT BESIDE IT": "ITM-1273, the entry's page that reads its own queue and the requirement's editor that reads the waiting ones",
  "STATUS IS DERIVED FROM THE RECORDS": "ITM-1266, the folders a review page reads for its statuses, and ITM-1314, the last accepted text of a file put back",
};

// TST-376301 · level: release · module: system
// guards: UC-018
// given: UC-018 as committed text, whose `realises` lists twenty-one requirements, and the release tests named in EVIDENCE
// input: read UC-018's list of the requirements it realises, and the declarations of the test files named for each
// expect: known positive — UC-018 realises these twenty-one requirements; each has at least one release test named; each test named stands in its file with the level release and guards that requirement; no case of this file guards a requirement in BUILT_BY_WRITER
test("TST-376301: UC-018 every requirement it realises has a release test that guards it", () => {
  const front = /^realises:\n((?:  - .*\n)+)/m.exec(read(UC))?.[1] ?? "";
  const realised = front.split("\n").filter(Boolean).map((line) => line.replace(/^ {2}- /, ""));
  assert.equal(realised.length, 21, "known positive: UC-018 realises twenty-one requirements");
  assert.deepEqual([...realised].sort(), Object.keys(EVIDENCE).sort(), "the map holds exactly the requirements UC-018 realises");
  for (const [requirement, named] of Object.entries(EVIDENCE)) {
    assert.ok(named.length > 0, `${requirement}: a release test is named`);
    for (const [file, id] of named) {
      assert.ok(existsSync(new URL(`../${file}`, import.meta.url)), `${requirement}: ${file} exists`);
      const declared = testDeclarations(file, read(file)).find((each) => each.id === id);
      assert.ok(declared, `${requirement}: ${id} is declared in ${file}`);
      assert.equal(declared.level, "release", `${id} is a release test`);
      assert.ok((declared.guards ?? []).includes(requirement), `${id} guards ${requirement}`);
    }
  }
  const own = testDeclarations(SELF, read(SELF));
  for (const requirement of Object.keys(BUILT_BY_WRITER)) assert.deepEqual(own.filter((each) => (each.guards ?? []).includes(requirement)).map((each) => each.id), [], `${requirement} is left to other writers`);
});

// ---------------------------------------------------------------- the editor and its saves

// TST-376302 · level: release · module: system
// guards: EDITS ARE PREPARED ON THE DASHBOARD; UC-018
// given: the product alice/thesis-tool on GitHub, the author's token stored; UC-041 open
// input: the author opens UC-041's editor, types "at the desk, with a receipt." for "at the desk." and saves
// expect: the editor holds the file, and its preview shows each keystroke — after the typing the preview holds "with a receipt"; the save is one commit of the edited file, made with the author's own token
test("TST-376302: a use case is edited on the dashboard with a live preview, and saved under the author's own account", async () => {
  const w = await useCaseWorld();
  const target = await w.draw({ id: "UC-041", edit: "1" });
  await w.quiet();
  assert.equal(areaOf(target).value, UC41);
  assert.doesNotMatch(textOf(byClass(target, "div", "preview")[0]), /with a receipt/, "known positive: not before the typing");
  const edited = UC41.replace("at the desk.", "at the desk, with a receipt.");
  typeInto(target, edited);
  assert.match(textOf(byClass(target, "div", "preview")[0]), /with a receipt/);
  click(saveOf(target));
  await until(() => w.writes().length === 1, "the save");
  assert.deepEqual(w.writes()[0].files, { [P41]: edited });
  assert.deepEqual([...new Set(w.writers().map((each) => each.authorization))], [`Bearer ${TOKENS.github.value}`]);
});

// TST-376303 · level: release · module: system
// guards: A SPEC EDIT IS SAVED AS A PROPOSAL; UC-018
// given: the library alice/library on GitHub (tests/uc-018-harness.mjs), the author's token stored
// input: the author saves an edit of A LOAN HAS A DUE DATE with a Why
// expect: the commit holds files under docs/spec-freigaben/ only — among them the proposal, the section as edited —, and SPEC.md on the default branch is byte-identical to before
test("TST-376303: saving an edited requirement writes a queue entry and leaves SPEC.md byte-identical", async () => {
  const w = await specWorld();
  await saveRequirement(w);
  assert.equal(w.writes().length, 1);
  assert.deepEqual(Object.keys(w.writes()[0].files).filter((path) => !path.startsWith("docs/spec-freigaben/")), []);
  assert.deepEqual(proposalsOf(w.writes()).map(([, body]) => body), [RENEWED]);
  assert.equal(w.files()["SPEC.md"], LIBRARY_SPEC);
});

// TST-376304 · level: release · module: system
// guards: A SAVE IS REFUSED WHEN THE TEXT CHANGED MEANWHILE; UC-018
// given: the editor of A LOAN HAS A DUE DATE and the editor of UC-041, each opened with the author's token; known positive: the same saves with nothing changed meanwhile
// input: another writer changes the section, and UC-041, on the default branch; then the author saves each edit
// expect: known positive — without the change each save makes one commit; with it neither save writes anything, and each page says nothing was saved because the text was changed meanwhile
test("TST-376304: a save is refused, and nothing written, when the text changed on the default branch since the editor opened", async () => {
  const fresh = await specWorld();
  await saveRequirement(fresh);
  assert.equal(fresh.writes().length, 1, "known positive: the requirement is saved");
  const w = await specWorld();
  const target = await w.draw("requirement", { name: LOAN });
  typeInto(target, RENEWED);
  whyOf(target).value = "Renewal.";
  await w.land({ "SPEC.md": SPEC_HEAD + LENDING.replace("is returned.", "is returned on time.") + MEMBERSHIP });
  const landed = w.writes().length;
  click(saveOf(target));
  await until(() => /Nothing was saved/.test(resultOf(target)), "the refusal");
  assert.equal(w.writes().length, landed, "nothing is written");
  assert.match(resultOf(target), /the text was changed meanwhile/);
  const u = await useCaseWorld();
  const page = await u.draw({ id: "UC-041", edit: "1" });
  await u.quiet();
  typeInto(page, UC41.replace("at the desk.", "at the desk, with a receipt."));
  await u.land({ [P41]: UC41.replace("at the desk.", "at the front desk.") });
  click(saveOf(page));
  await until(() => /Nothing was saved/.test(resultOf(page)), "the refusal of the use case");
  assert.deepEqual(u.writes(), []);
  const known = await useCaseWorld();
  const ok = await known.draw({ id: "UC-041", edit: "1" });
  await known.quiet();
  typeInto(ok, UC41.replace("at the desk.", "at the desk, with a receipt."));
  click(saveOf(ok));
  await until(() => known.writes().length === 1, "known positive: the use case is saved");
});

// TST-376305 · level: release · module: system
// guards: A REFUSED SAVE KEEPS THE EDIT; UC-018
// given: the editor of A LOAN HAS A DUE DATE with the author's edit "… or renewed." and a Why; another writer has changed the rule to "… returned on time."
// input: the author clicks Save
// expect: the editor still holds the author's edit; beside it the newer version, with "returned on time.", and the difference between them
test("TST-376305: a refused save keeps the edit in the editor, beside the newer version", async () => {
  const w = await specWorld();
  const target = await w.draw("requirement", { name: LOAN });
  typeInto(target, RENEWED);
  whyOf(target).value = "Renewal.";
  await w.land({ "SPEC.md": SPEC_HEAD + LENDING.replace("is returned.", "is returned on time.") + MEMBERSHIP });
  click(saveOf(target));
  await until(() => /returned on time\./.test(textOf(byClass(target, "div", "newer")[0])), "the newer version");
  assert.equal(areaOf(target).value, RENEWED);
  assert.match(textOf(byClass(target, "div", "newer")[0]), /or renewed\./, "the edit beside the newer version");
  assert.match(textOf(byClass(target, "div", "newer")[0]), /Difference/);
});

// TST-376306 · level: release · module: system
// guards: AN EDITED FILE KEEPS ITS IDENTIFIER; UC-018
// given: UC-041 in alice/thesis-tool, the author's token stored
// input: the author changes its id to UC-099 and clicks Save; then sets the id back to UC-041, edits the goal and clicks Save
// expect: with UC-099 nothing is written and the page names both identifiers; known positive — with UC-041 kept, one commit of the file
test("TST-376306: a use case whose identifier differs from the one it was opened with is not saved", async () => {
  const w = await useCaseWorld();
  const target = await w.draw({ id: "UC-041", edit: "1" });
  await w.quiet();
  typeInto(target, UC41.replace("id: UC-041", "id: UC-099"));
  click(saveOf(target));
  await settle();
  assert.deepEqual(w.writes(), []);
  assert.match(resultOf(target), /UC-041.*UC-099|UC-099.*UC-041/);
  typeInto(target, UC41.replace("at the desk.", "at the desk, with a receipt."));
  click(saveOf(target));
  await until(() => w.writes().length === 1, "known positive: the save");
});

// TST-376307 · level: release · module: system
// guards: A RENAMED REQUIREMENT IS WITHDRAWN AND ADDED; UC-018
// given: the library on GitHub; UC-001 realises A LOAN HAS A DUE DATE; the author's token stored
// input: the author renames A LOAN HAS A DUE DATE to A LOAN IS DUE, gives a Why and saves
// expect: the impact list shown and the saved rationale each name A LOAN HAS A DUE DATE as withdrawn and A LOAN IS DUE as added
test("TST-376307: a renamed requirement is proposed as the old name withdrawn and the new one added", async () => {
  const w = await specWorld();
  const target = await w.draw("requirement", { name: LOAN });
  typeInto(target, LENDING.replace(LOAN, "A LOAN IS DUE"));
  const impact = textOf(byClass(target, "ul", "impact")[0]);
  assert.match(impact, new RegExp(`${LOAN} — withdrawn`));
  assert.match(impact, /A LOAN IS DUE — added/);
  whyOf(target).value = "Shorter.";
  click(saveOf(target));
  await until(() => w.writes().length === 1, "the save");
  const rationale = queueWrites(w.writes()).find(([path]) => path.endsWith(".begruendung.md"))[1];
  assert.match(rationale, new RegExp(`${LOAN}: withdrawn`));
  assert.match(rationale, /A LOAN IS DUE: added/);
});

// TST-376308 · level: release · module: system
// guards: A SPECIFICATION CHANGE IS APPROVED BEFORE IT IS WRITTEN; UC-018
// given: the library on GitHub, the author's token stored
// input: the author saves an edit of A LOAN HAS A DUE DATE; then the queues of the default branch are read
// expect: SPEC.md still holds "is returned." and not "or renewed"; the queue of the requirement's section, Lending (`docs/spec-freigaben/lending`), holds one entry, open — not approved and not in SPEC
test("TST-376308: an edit of a requirement stays a proposal, open, until a person accepts it", async () => {
  const w = await specWorld();
  await saveRequirement(w);
  assert.ok(w.files()["SPEC.md"].includes("is returned.") && !w.files()["SPEC.md"].includes("or renewed"));
  const all = await queues(await w.host.readSnapshot("main"));
  const mine = all.filter((queue) => queue.folder === "docs/spec-freigaben/lending");
  assert.deepEqual(mine.flatMap((queue) => queue.entries.map((entry) => entry.state)), ["open"]);
});

// TST-376309 · level: release · module: system
// guards: A REQUIREMENT IS NOT CHANGED WITHOUT AN IMPACT LIST; UC-018
// given: the library on GitHub; UC-001 names A LOAN HAS A DUE DATE; the author's token stored
// input: the author changes the rule of A LOAN HAS A DUE DATE in its editor and saves with a Why
// expect: before the save the page lists A LOAN HAS A DUE DATE changed, named by UC-001; the saved rationale's impact list names it changed, named by UC-001
test("TST-376309: a changed requirement is listed with what names it before it is saved, and the proposal carries the list", async () => {
  const w = await specWorld();
  const target = await w.draw("requirement", { name: LOAN });
  typeInto(target, RENEWED);
  assert.match(textOf(byClass(target, "ul", "impact")[0]), new RegExp(`${LOAN} — changed, named by UC-001`));
  assert.deepEqual(w.writes(), [], "the list stands before anything is written");
  whyOf(target).value = "Renewal.";
  click(saveOf(target));
  await until(() => w.writes().length === 1, "the save");
  assert.match(queueWrites(w.writes()).find(([path]) => path.endsWith(".begruendung.md"))[1], new RegExp(`${LOAN}: changed; named by UC-001`));
});

// TST-376310 · level: release · module: system
// guards: A REVIEWED ARTIFACT ENTERS THE DEFAULT BRANCH AS OPEN; UC-018
// given: UC-041 in alice/thesis-tool, open, the author's token stored
// input: the author saves an edit of UC-041
// expect: the commit goes to the default branch and holds the use case and no approval record; the page that follows shows UC-041 as open
test("TST-376310: a saved use case enters the default branch as open", async () => {
  const w = await useCaseWorld();
  const target = await w.draw({ id: "UC-041", edit: "1" });
  await w.quiet();
  typeInto(target, UC41.replace("at the desk.", "at the desk, with a receipt."));
  click(saveOf(target));
  await until(() => w.writes().length === 1 && !areaOf(target), "the save and the page shown again");
  await w.quiet();
  assert.deepEqual(Object.keys(w.writes()[0].files), [P41]);
  assert.ok(w.writers().every((each) => !each.path.includes("/git/refs/heads/") || each.path.endsWith("/git/refs/heads/main")), "the default branch");
  assert.equal(badgeOf(target), "open");
});

// ---------------------------------------------------------------- the marks

// TST-376311 · level: release · module: system
// guards: A REQUIREMENT HAS FOUR FIELDS; UC-018
// given: the editor of A LOAN HAS A DUE DATE in the library, whose requirements each hold their four fields
// input: the author removes the check of A BOOK IS SHELVED; then the source of A LOAN HAS A DUE DATE
// expect: known positive — before, no mark; then a mark "no check" under A REQUIREMENT HAS FOUR FIELDS; then also "no source"; Save stays offered
test("TST-376311: a requirement missing one of its four fields is marked in the editor", async () => {
  const w = await specWorld();
  const target = await w.draw("requirement", { name: LOAN });
  assert.deepEqual(marksOf(target), []);
  const noCheck = LENDING.replace("*Check:* `tests/shelf.test.mjs`\n", "");
  typeInto(target, noCheck);
  assert.match(marksOf(target).join("\n"), /no check \[A REQUIREMENT HAS FOUR FIELDS\]/);
  typeInto(target, noCheck.replace(`**${LOAN}** *(Product Owner)*`, `**${LOAN}**`));
  assert.match(marksOf(target).join("\n"), /no source \[A REQUIREMENT HAS FOUR FIELDS\]/);
  assert.equal(saveOf(target).disabled, false);
});

// TST-376312 · level: release · module: system
// guards: ONE STATEMENT PER REQUIREMENT; UC-018
// given: the editor of A LOAN HAS A DUE DATE in the library, the author's token stored
// input: the author writes its rule as "… is returned and the shelf it came from.", gives a Why and saves; known positive: the rule without "and"
// expect: the rule with "and" is marked as a warning under ONE STATEMENT PER REQUIREMENT, the rule without it is not; the mark does not block the save, which writes the proposal with "and"
test("TST-376312: a rule holding a conjunction is flagged for review and does not block the save", async () => {
  const w = await specWorld();
  const target = await w.draw("requirement", { name: LOAN });
  typeInto(target, RENEWED);
  assert.doesNotMatch(marksOf(target).join("\n"), /ONE STATEMENT PER REQUIREMENT/, "known positive");
  const joined = LENDING.replace("is returned.", "is returned and the shelf it came from.");
  typeInto(target, joined);
  assert.match(marksOf(target).join("\n"), /warning: the rule contains "and" \[ONE STATEMENT PER REQUIREMENT\]/);
  whyOf(target).value = "Together.";
  click(saveOf(target));
  await until(() => w.writes().length === 1, "the save");
  assert.deepEqual(proposalsOf(w.writes()).map(([, body]) => body), [joined]);
});

// TST-376313 · level: release · module: system
// guards: A USE CASE HAS ACTOR, PRECONDITION, FLOW AND POSTCONDITION; UC-018
// given: UC-041 in alice/thesis-tool with its actors and its five sections ## Actors, ## Precondition, ## Main flow, ## Alternative flows and ## Postcondition, and a Mermaid diagram
// input: the author removes each of the five sections in turn in the editor; then empties the list of actors
// expect: known positive — the complete use case carries no mark; each removal is marked "the section <heading> is required, and missing" under A USE CASE HAS ACTOR, PRECONDITION, FLOW AND POSTCONDITION; the empty actors are marked under the same rule
test("TST-376313: a use case missing its actors or one of its five sections is marked in the editor", async () => {
  const w = await useCaseWorld({ files: { [P41]: FULL41 } });
  const target = await w.draw({ id: "UC-041", edit: "1" });
  await w.quiet();
  assert.deepEqual(marksOf(target), [], "known positive");
  for (const heading of ["## Actors", "## Precondition", "## Main flow", "## Alternative flows", "## Postcondition"]) {
    typeInto(target, fullUseCase("UC-041", "Check out a book", [LOAN], { drop: heading }));
    assert.match(marksOf(target).join("\n"), new RegExp(`the section ${heading} is required, and missing \\[A USE CASE HAS ACTOR, PRECONDITION, FLOW AND POSTCONDITION\\]`), heading);
  }
  typeInto(target, FULL41.replace("actors:\n  - Member\n", "actors:\n"));
  assert.match(marksOf(target).join("\n"), /\[A USE CASE HAS ACTOR, PRECONDITION, FLOW AND POSTCONDITION\]/, "the empty actors");
});

// ---------------------------------------------------------------- clicks, tokens, servers

// TST-376314 · level: release · module: system
// guards: THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK; UC-018
// given: the editor of A LOAN HAS A DUE DATE in the library and of UC-041 in alice/thesis-tool, each with an edit typed (and a Why), the author's token stored
// input: a script clicks Save on each; then the author does
// expect: the script's clicks write nothing and send no request that writes; the author's clicks make one commit each
test("TST-376314: a click a script makes on Save writes nothing; the person's click writes", async () => {
  const w = await specWorld();
  const target = await w.draw("requirement", { name: LOAN });
  typeInto(target, RENEWED);
  whyOf(target).value = "Renewal.";
  saveOf(target).dispatchEvent(scripted());
  await settle();
  assert.deepEqual(w.writes(), []);
  assert.deepEqual(w.writers(), []);
  click(saveOf(target));
  await until(() => w.writes().length === 1, "the person's save");
  const u = await useCaseWorld();
  const page = await u.draw({ id: "UC-041", edit: "1" });
  await u.quiet();
  typeInto(page, UC41.replace("at the desk.", "at the desk, with a receipt."));
  saveOf(page).dispatchEvent(scripted());
  await settle();
  assert.deepEqual(u.writes(), []);
  click(saveOf(page));
  await until(() => u.writes().length === 1, "the person's save of the use case");
});

// TST-376315 · level: release · module: system
// guards: WITHOUT A TOKEN, GITHUB'S WEB INTERFACE IS THE FALLBACK; UC-018
// given: the library on GitHub with no token of its own stored
// input: the author saves an edit of A LOAN HAS A DUE DATE with a Why
// expect: nothing is written; the page offers GitHub's new-file page of https://github.com/alice/library for each of the entry's four files, and says there is no token so nothing was committed from here
test("TST-376315: without a token, saving an edited requirement opens GitHub's pages for its files", async () => {
  const w = await specWorld({ token: false });
  const target = await saveRequirement(w);
  assert.deepEqual(w.writes(), []);
  const pages = linksOf(target, "github-page").map((link) => link.getAttribute("href"));
  assert.equal(pages.length, 4);
  for (const page of pages) assert.ok(page.startsWith("https://github.com/alice/library/new/main?filename=docs%2Fspec-freigaben%2F"), page);
  assert.match(resultOf(target), /there is no token, so nothing was committed from here/);
});

// TST-376316 · level: release · module: system
// guards: NO TEXT TRAVELS IN A URL; UC-018
// given: the library with no token of its own stored; alice/thesis-tool with no token of its own stored; a window whose `open` records the addresses it is given
// input: the author saves an edit of A LOAN HAS A DUE DATE ("… or renewed.") and an edit of UC-041 ("with a receipt")
// expect: every link the pages draw, and every address opened, carries at most a file's path: none holds "renewed", "receipt" or any other word of the edited texts
test("TST-376316: no link or address opened for GitHub holds the edited text", async () => {
  const opened = [], open = globalThis.open;
  globalThis.open = (url) => { opened.push(String(url)); return null; };
  try {
    const w = await specWorld({ token: false });
    const target = await saveRequirement(w);
    const u = await useCaseWorld({ token: false });
    const page = await u.draw({ id: "UC-041", edit: "1" });
    await u.quiet();
    typeInto(page, UC41.replace("at the desk.", "at the desk, with a receipt."));
    click(saveOf(page));
    await until(() => linksOf(page, "github-page").length === 1, "GitHub's editor");
    const addresses = [...linksOf(target), ...linksOf(page)].map((link) => decodeURIComponent(link.getAttribute("href"))).concat(opened.map(decodeURIComponent));
    assert.ok(addresses.some((href) => href.includes("01-lending.md")) && addresses.some((href) => href.includes(P41)), "known positive: the paths are there");
    for (const word of ["renewed", "receipt", "Every loan", "borrows a book"]) assert.deepEqual(addresses.filter((href) => href.includes(word)), [], word);
  } finally { globalThis.open = open; }
});

// TST-376317 · level: release · module: system
// guards: A GITLAB PRODUCT IS WRITTEN WITH A TOKEN; UC-018
// given: the product team/product on gitlab.example.org; once with no token for it stored, once with the project's token
// input: the author opens the editors of A LOAN HAS A DUE DATE and of UC-041 without the token; and, with it, edits UC-041 and saves
// expect: without the token no editor and no Save, and no link to GitHub; with it the save is one commit on the GitLab server, carrying the project's token
test("TST-376317: a GitLab product is edited only with its token", async () => {
  const bare = await useCaseWorld({ server: "gitlab", token: false });
  for (const [params, name] of [[{ name: LOAN }, "requirement"], [{ id: "UC-041", edit: "1" }, "use-case"]]) {
    const target = await bare.draw(params, name);
    await bare.quiet();
    assert.equal(saveOf(target), undefined, name);
    assert.equal(areaOf(target), undefined, name);
    assert.deepEqual(linksOf(target).filter((link) => /github\.com/.test(link.getAttribute("href"))), [], name);
  }
  assert.deepEqual(bare.writes(), []);
  const w = await useCaseWorld({ server: "gitlab" });
  const page = await w.draw({ id: "UC-041", edit: "1" });
  await w.quiet();
  typeInto(page, UC41.replace("at the desk.", "at the desk, with a receipt."));
  click(saveOf(page));
  await until(() => w.writes().length === 1, "the save on GitLab");
  assert.equal(w.writes()[0].token, TOKENS.gitlab.value);
  assert.match(w.writes()[0].files[P41], /with a receipt/);
});

// TST-376318 · level: release · module: system
// guards: ONE CLICK PER DECISION; UC-018
// given: the editor of A LOAN HAS A DUE DATE with the edit typed and the Why given; the editor of UC-041 with its edit typed
// input: one click on Save in each, and nothing else
// expect: each click is the whole decision: one commit each, with the entry linked or the use case shown again, and no further control to press
test("TST-376318: saving an edit takes one click once the text and the Why are given", async () => {
  const w = await specWorld();
  const target = await saveRequirement(w);
  assert.equal(w.writes().length, 1);
  assert.equal(byClass(target, "p", "entry").length, 1, "the entry is linked");
  const u = await useCaseWorld();
  const page = await u.draw({ id: "UC-041", edit: "1" });
  await u.quiet();
  typeInto(page, UC41.replace("at the desk.", "at the desk, with a receipt."));
  click(saveOf(page));
  await until(() => u.writes().length === 1 && !areaOf(page), "the save and the page shown again");
});

// TST-376319 · level: release · module: system
// guards: EVERY STEP EXPLAINS ITSELF; UC-018
// given: the library on GitHub with the author's token
// input: the author opens the editor of A LOAN HAS A DUE DATE, the editor of a new requirement in "## 2. Membership", and the editor of UC-001
// expect: each page carries a folded What is this? whose text explains what the step asks: for a requirement and a new one, why a SPEC edit is written as a proposal into a change queue; for the use case, the blob SHA and the review an edit reopens
test("TST-376319: each editor carries a folded explanation of its step", async () => {
  const w = await specWorld();
  for (const [name, params, pattern] of [["requirement", { name: LOAN }, /never writes it straight into SPEC\.md/], ["requirements", { section: MEMBERSHIP_HEADING }, /never writes it straight into SPEC\.md/],
    ["use-case", { id: "UC-001", edit: "1" }, /blob SHA/]]) {
    const folded = explainedOf(await w.draw(name, params));
    assert.equal(folded.length, 1, name);
    assert.match(folded[0], /^What is this\?/, name);
    assert.match(folded[0], pattern, name);
  }
});
