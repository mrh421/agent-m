// Release tests of UC-004 Register a requirement source in the library: one or more for each requirement UC-004 realises, each walked through the library page as the author
// uses it — MOD-settings-pages' route `library` in MOD-site-frame's frame, over MOD-repository-hosts' real GitHub host answered by the GitHub fixture — and, for an EU legal text,
// through the instance's fetch workflow with the EU's publication repository a fixture (tests/uc-004-harness.mjs). The cases read what the person sees and what the repositories
// receive, never the code files. UC-004's requirements guarded only at review (ONE CLICK PER DECISION's check is "at review of each use case") have a case here all the same,
// since the walk shows them.
// Run: node --test tests/release-uc-004-register-a-requirement-source.test.mjs
//
// Module: MOD-settings-pages
// Module: MOD-source-register
// Guards: UC-004; THE INSTANCE KEEPS THE SOURCE REGISTER; A SOURCE IS FILES, AN ARCHIVE OR A REPOSITORY; A SOURCE DECLARES ITS LICENCE; RESTRICTED CONTENT STAYS OUT OF THE PUBLIC INSTANCE; A SOURCE VERSION IS FIXED BY IDENTIFIER AND HASH; A STANDARD IS REGISTERED BY ITS DESIGNATION; AN EU LEGAL TEXT IS FETCHED FROM THE OFFICIAL REPOSITORY; THE SOURCE MODEL IS GENERIC; A SOURCE DECLARES ITS AUTHORITY; A LIVING SOURCE IS PINNED; THE SOURCE KIND IS ONE OF A CLOSED SET; EVERY ARTIFACT HAS AN IDENTIFIER; A PERSON'S OWN INPUT IS COMMITTED DIRECTLY; ONE CLICK PER DECISION; EVERY STEP EXPLAINS ITSELF
// Level: release
//
// Written by developer-opus-f (ITM-370), who implemented none of ITM-313, ITM-314, ITM-345, ITM-350, ITM-385, ITM-400, ITM-401 and ITM-402 (RELEASE TESTS ARE NOT WRITTEN BY THE
// IMPLEMENTER). Each test states its input and its expected values in its own text; none reads an expected result from a document when it runs. Readings the texts leave open, which
// the cases state:
//   - THE SOURCE MODEL IS GENERIC, "no particular organisation, standard or system is built into Agent M": the library of an instance whose register is empty lists no source, and
//     a source of any kind is registered by the same form.
//   - EVERY STEP EXPLAINS ITSELF, "written for someone new to GitHub": not checked; the case checks that each step that asks something carries an explanation that can be expanded.
//   - A PERSON'S OWN INPUT IS COMMITTED DIRECTLY, "under their own account": the commit is made with the token this browser keeps for the person, the only credential the page holds.

import test from "node:test";
import assert from "node:assert/strict";
import { installDocument } from "./settings-pages-harness.mjs";
import { AI_ACT_ELI, GUIDE, GUIDE_WEB, INSTANCE, NORMS, NORMS_WEB, REGISTER, TOKEN, byTag, choose, commitsOf, describe, enter, fieldLabelled, fileOf, folded,
  inputOf, listed, onlyHash, register, runFetchWorkflow, save, saveOf, sha, text, visit, writes } from "./uc-004-harness.mjs";

installDocument();

const TODAY = new Date().toISOString().slice(0, 10);
const filesOf = (commit) => Object.keys(commit.files).sort();
const rowOf = (entry, version) => entry.split("\n").find((line) => line.startsWith(`| \`${version}\``));
const COMMON = { authority: "advisory", licence: "may be republished - CC BY 4.0" };

// Documents registered through the page: + Register source, documents, the files, the fields, Save. -> the page.
async function registerDocuments(t, fields, files, { named } = {}) {
  const page = await visit(t, "#library");
  await register(page, "documents");
  await choose(page, files);
  await describe(page, { ...COMMON, ...fields });
  if (named) await enter(fieldLabelled(page, "Repository for restricted content"), named);
  await save(page);
  return page;
}

// TST-370301 · level: release · module: system
// guards: UC-004; THE INSTANCE KEEPS THE SOURCE REGISTER
// given: the instance holds docs/sources/SRC-iec-62304.md and, outside the register's folder, docs/notes/SRC-stray.md, an entry written elsewhere (known positive: IEC 62304 is listed)
// input: the author opens #library; then registers documents SRC-guide (guide.md) through the page and opens #library again
// expect: the library lists IEC 62304 and not the stray entry; the registration adds exactly one file of the register, docs/sources/SRC-guide.md, to the instance — one file per source in docs/sources/ of the instance's own repository; the library then lists IEC 62304 and the guide
test("TST-370301: UC-004 the instance keeps the register in docs/sources/, one file per source", async (t) => {
  const stray = REGISTER["docs/sources/SRC-iec-62304.md"].replaceAll("SRC-iec-62304", "SRC-stray").replaceAll("IEC 62304", "Stray norm");
  const files = { ...REGISTER, "docs/notes/SRC-stray.md": stray };
  const before = await visit(t, "#library", { files });
  assert.ok(listed(before, "IEC 62304"), "known positive");
  assert.equal(listed(before, "Stray norm"), null);
  const page = await registerDocuments(t, { id: "SRC-guide", title: "Guide" }, [fileOf("guide.md", "# Guide\n")]);
  const entries = Object.keys(commitsOf(page, INSTANCE)[0].files).filter((path) => /^docs\/sources\/[^/]+\.md$/.test(path));
  assert.deepEqual(entries, ["docs/sources/SRC-guide.md"]);
  const after = await visit(t, "#library", { files: page.world.files(INSTANCE) });
  assert.ok(listed(after, "IEC 62304") && listed(after, "Guide"));
});

// TST-370302 · level: release · module: system
// guards: UC-004; A SOURCE IS FILES, AN ARCHIVE OR A REPOSITORY
// given: three sources: the files spec.md and spec.pdf; the zip archive rules.zip; the repository https://github.com/akmaier/guide at its head
// input: each registered through the page, may be republished
// expect: the files are stored as the two files of the version; the archive as the one file rules.zip of its version, its bytes unchanged; the repository as its address and the commit read, with no file
test("TST-370302: UC-004 a source is files, a zip archive, or a repository at a named commit", async (t) => {
  const files = await registerDocuments(t, { id: "SRC-spec", title: "Spec" }, [fileOf("spec.md", "# Spec\n"), fileOf("spec.pdf", "pdf bytes")]);
  assert.deepEqual(filesOf(commitsOf(files, INSTANCE)[0]), ["docs/sources/SRC-spec.md", `docs/sources/SRC-spec/${TODAY}/spec.md`, `docs/sources/SRC-spec/${TODAY}/spec.pdf`]);
  const archive = await registerDocuments(t, { id: "SRC-rules", title: "Rules" }, [fileOf("rules.zip", "PK archive bytes")]);
  assert.deepEqual(filesOf(commitsOf(archive, INSTANCE)[0]), ["docs/sources/SRC-rules.md", `docs/sources/SRC-rules/${TODAY}/rules.zip`]);
  assert.equal(commitsOf(archive, INSTANCE)[0].files[`docs/sources/SRC-rules/${TODAY}/rules.zip`], "PK archive bytes");
  const page = await visit(t, "#library");
  await register(page, "repository");
  await enter(fieldLabelled(page, "Repository address"), GUIDE_WEB);
  const head = /Pinned to commit ([0-9a-f]{40})/.exec(text(page))?.[1];
  assert.ok(head, text(page));
  await describe(page, { id: "SRC-guide", title: "Guide", ...COMMON });
  await save(page);
  const [commit] = commitsOf(page, INSTANCE);
  assert.deepEqual(filesOf(commit), ["docs/sources/SRC-guide.md"]);
  assert.match(rowOf(commit.files["docs/sources/SRC-guide.md"], TODAY), new RegExp(`${GUIDE_WEB} commit ${head} \\| 0 files`));
});

// TST-370303 · level: release · module: system
// guards: UC-004; A SOURCE DECLARES ITS LICENCE
// given: documents note.md, every field filled in but the licence, and the repository https://github.com/akmaier/norms named for its content, so that nothing but the licence is missing
// input: Save offered with no licence; then the licence "may be republished - CC BY-SA 4.0" typed and Save pressed
// expect: without a licence Save is disabled, the page naming the key licence, and nothing is written; with it the committed entry records "licence: may be republished - CC BY-SA 4.0", the terms under which the content may be copied
test("TST-370303: UC-004 every source records its licence", async (t) => {
  const page = await visit(t, "#library");
  await register(page, "documents");
  await choose(page, [fileOf("note.md", "# Note\n")]);
  await enter(fieldLabelled(page, "Repository for restricted content"), NORMS_WEB);
  await describe(page, { id: "SRC-note", title: "Note", authority: "advisory" });
  assert.equal(saveOf(page).disabled, true);
  assert.match(text(page), /key licence/);
  assert.deepEqual(writes(page), []);
  await describe(page, { licence: "may be republished - CC BY-SA 4.0" });
  assert.equal(saveOf(page).disabled, false);
  await save(page);
  assert.match(commitsOf(page, INSTANCE)[0].files["docs/sources/SRC-note.md"], /^licence: may be republished - CC BY-SA 4\.0$/m);
});

// TST-370304 · level: release · module: system
// guards: UC-004; RESTRICTED CONTENT STAYS OUT OF THE PUBLIC INSTANCE
// given: the same file norm.pdf ("norm bytes") registered twice: restricted, with the private repository https://github.com/akmaier/norms named; and may be republished (the counter-proof)
// input: Save for each
// expect: restricted: no write to the instance carries norm.pdf — its one commit holds the entry alone — and norm.pdf lands in akmaier/norms; may be republished: norm.pdf lands in the instance, and nothing is written to akmaier/norms
test("TST-370304: UC-004 restricted content stays out of the public instance, in the repository the person names", async (t) => {
  const norm = fileOf("norm.pdf", "norm bytes");
  const restricted = await registerDocuments(t, { id: "SRC-norm", title: "Norm", licence: "restricted - the publisher's terms" }, [norm], { named: NORMS_WEB });
  assert.deepEqual(commitsOf(restricted, INSTANCE).map(filesOf), [["docs/sources/SRC-norm.md"]]);
  assert.deepEqual(commitsOf(restricted, NORMS).map(filesOf), [[`docs/sources/SRC-norm/${TODAY}/norm.pdf`]]);
  assert.deepEqual(Object.keys(restricted.world.files(INSTANCE)).filter((path) => path.endsWith("norm.pdf")), []);
  const open = await registerDocuments(t, { id: "SRC-norm", title: "Norm" }, [norm]);
  assert.ok(filesOf(commitsOf(open, INSTANCE)[0]).includes(`docs/sources/SRC-norm/${TODAY}/norm.pdf`), "counter-proof: republishable content goes to the instance");
  assert.deepEqual(writes(open).filter((request) => request.repository === NORMS), []);
});

// TST-370305 · level: release · module: system
// guards: UC-004; A SOURCE VERSION IS FIXED BY IDENTIFIER AND HASH
// given: documents a.md ("alpha\n") and b.md ("beta\n"); a standard IEC 60601-1:2005+AMD2:2020 whose copy c.pdf ("gamma") is only hashed, with a note
// input: each registered through the page
// expect: the documents' version row records its identifier (the day of registration), its date and "2 files", and the file table the SHA-256 of a.md and of b.md, each the SHA-256 of the bytes chosen; the standard's row records the designation as its identifier, the date, and the SHA-256 of c.pdf
test("TST-370305: UC-004 every version records its identifier, its date and the SHA-256 of every file read", async (t) => {
  const page = await registerDocuments(t, { id: "SRC-ab", title: "AB" }, [fileOf("a.md", "alpha\n"), fileOf("b.md", "beta\n")]);
  const entry = commitsOf(page, INSTANCE)[0].files["docs/sources/SRC-ab.md"];
  assert.match(rowOf(entry, TODAY), new RegExp(`^\\| \`${TODAY}\` \\| ${TODAY} \\| .* \\| 2 files`));
  for (const [name, bytes] of [["a.md", "alpha\n"], ["b.md", "beta\n"]]) assert.ok(entry.includes(`| \`${name}\` | \`${sha(bytes)}\``), name);
  const standard = await visit(t, "#library");
  await register(standard, "standard");
  await enter(fieldLabelled(standard, "Full designation"), "IEC 60601-1:2005+AMD2:2020");
  await choose(standard, [fileOf("c.pdf", "gamma")]);
  await onlyHash(standard, "c.pdf", "the lab's shelf");
  await describe(standard, { id: "SRC-iec-60601", title: "IEC 60601-1", authority: "normative" });
  await save(standard);
  const norm = commitsOf(standard, INSTANCE)[0].files["docs/sources/SRC-iec-60601.md"];
  assert.match(rowOf(norm, "IEC 60601-1:2005+AMD2:2020"), new RegExp(`\\| ${TODAY} \\|`));
  assert.ok(norm.includes(`| \`c.pdf\` | \`${sha("gamma")}\``));
});

// TST-370306 · level: release · module: system
// guards: UC-004; A STANDARD IS REGISTERED BY ITS DESIGNATION
// given: the route standard, every field filled in but the designation
// input: Save offered without a designation; then the full designation IEC 62366-1:2015+AMD1:2020, with its edition and amendment, entered and Save pressed
// expect: without the designation Save is disabled and the page names the designation as missing; with it the entry records "designation: IEC 62366-1:2015+AMD1:2020" and its version is that designation
test("TST-370306: UC-004 a standard is registered by its full designation, with edition and amendments", async (t) => {
  const page = await visit(t, "#library");
  await register(page, "standard");
  await describe(page, { id: "SRC-iec-62366", title: "IEC 62366-1", authority: "normative" });
  assert.equal(saveOf(page).disabled, true);
  assert.match(text(page), /designation/);
  await enter(fieldLabelled(page, "Full designation"), "IEC 62366-1:2015+AMD1:2020");
  await choose(page, [fileOf("iec.pdf", "usability")]);
  await onlyHash(page, "iec.pdf", "the office");
  await save(page);
  const entry = commitsOf(page, INSTANCE)[0].files["docs/sources/SRC-iec-62366.md"];
  assert.match(entry, /^designation: IEC 62366-1:2015\+AMD1:2020$/m);
  assert.ok(rowOf(entry, "IEC 62366-1:2015+AMD1:2020"), "the designation is the version");
});

// TST-370307 · level: release · module: system
// guards: UC-004; AN EU LEGAL TEXT IS FETCHED FROM THE OFFICIAL REPOSITORY
// given: the AI Act's ELI address https://eur-lex.europa.eu/eli/reg/2024/1689/oj; the EU's publication repository answers the text, retrieved 16 July 2024, version cellar-2024-07-12 (counter-proof: an address of no EU site, https://example.org/ai-act, is recognised as no legal text)
// input: the legal text registered through the page from its address; the instance's fetch workflow runs on the push
// expect: the address of no EU site leaves Save disabled; the ELI is recognised and recorded as the identifier http://data.europa.eu/eli/reg/2024/1689/oj; the workflow asks https://publications.europa.eu, and no other server, for that ELI; the entry's version records the retrieval date 2024-07-16 and the repository's version identifier cellar-2024-07-12
test("TST-370307: UC-004 an EU legal text is registered from its ELI address and fetched from the publication repository with retrieval date and version", async (t) => {
  const page = await visit(t, "#library");
  await register(page, "legal-text");
  await describe(page, { id: "SRC-ai-act", title: "AI Act", authority: "normative", licence: "may be republished - EU law" });
  await enter(fieldLabelled(page, "EUR-Lex or ELI address"), "https://example.org/ai-act");
  assert.equal(saveOf(page).disabled, true, "counter-proof: no legal text is recognised");
  await enter(fieldLabelled(page, "EUR-Lex or ELI address"), AI_ACT_ELI);
  assert.equal(inputOf(page, "identifier").value, "http://data.europa.eu/eli/reg/2024/1689/oj");
  await save(page);
  const run = await runFetchWorkflow(page.world.files(INSTANCE), { publication: "<html>AI Act</html>\n" });
  assert.equal(run.exit, 0, run.log + run.stderr);
  assert.deepEqual(run.requested.map((url) => new URL(url).origin), ["https://publications.europa.eu"]);
  assert.match(run.requested[0], /\/eli\/reg\/2024\/1689\/oj/);
  assert.match(rowOf(run.after["docs/sources/SRC-ai-act.md"], "cellar-2024-07-12"), /retrieved 2024-07-16, version cellar-2024-07-12/);
});

// TST-370308 · level: release · module: system
// guards: UC-004; THE SOURCE MODEL IS GENERIC
// given: an instance whose register is empty (known positive: with IEC 62304 in the register it is listed); then a source of kind organisation, the Example Society's bylaws, an identifier and a body Agent M knows nothing of
// input: the author opens #library; then registers the bylaws through the documents route with the kind organisation
// expect: the empty register's library lists no source — none is built in; the bylaws are registered by the same form as a typed record: the entry records id SRC-example-society, kind organisation and authority informational
test("TST-370308: UC-004 the source model is generic: nothing is built in, and any source is a typed record", async (t) => {
  assert.ok(listed(await visit(t, "#library"), "IEC 62304"), "known positive");
  const empty = await visit(t, "#library", { files: { "README.md": "An instance.\n" } });
  assert.equal(byTag(empty.main(), "section").filter((section) => /SRC-/.test(section.textContent)).length, 0);
  const page = await registerDocuments(t, { id: "SRC-example-society", title: "Example Society bylaws", kind: "organisation", authority: "informational" }, [fileOf("bylaws.md", "# Bylaws\n")]);
  const entry = commitsOf(page, INSTANCE)[0].files["docs/sources/SRC-example-society.md"];
  for (const line of ["id: SRC-example-society", "kind: organisation", "authority: informational"]) assert.match(entry, new RegExp(`^${line}$`, "m"));
});

// TST-370309 · level: release · module: system
// guards: UC-004; A SOURCE DECLARES ITS AUTHORITY
// given: documents x.md, every field filled in; the authority typed as "mandatory", which is none of the three, and then as each of normative, advisory and informational
// input: the form; Save with each declared authority
// expect: "mandatory" leaves Save disabled, the page naming normative, advisory and informational; each of the three is committed as declared, "authority: <it>"
test("TST-370309: UC-004 a source declares its authority, one of normative, advisory and informational", async (t) => {
  const page = await visit(t, "#library");
  await register(page, "documents");
  await choose(page, [fileOf("x.md", "# X\n")]);
  await describe(page, { id: "SRC-x", title: "X", ...COMMON, authority: "mandatory" });
  assert.equal(saveOf(page).disabled, true);
  assert.match(text(page), /normative, advisory, informational/);
  for (const authority of ["normative", "advisory", "informational"]) {
    const done = await registerDocuments(t, { id: "SRC-x", title: "X", authority }, [fileOf("x.md", "# X\n")]);
    assert.match(commitsOf(done, INSTANCE)[0].files["docs/sources/SRC-x.md"], new RegExp(`^authority: ${authority}$`, "m"));
  }
});

// TST-370310 · level: release · module: system
// guards: UC-004; A LIVING SOURCE IS PINNED
// given: the repository akmaier/guide, maintained elsewhere, which moves on by one commit (README.md changed) after the fixture is set up
// input: its address pasted on the route repository; Save
// expect: the commit pinned is the one its default branch stands at when it is read, after the change — not the earlier one —, and the version row records it
test("TST-370310: UC-004 a living source records the exact commit that was read", async (t) => {
  const page = await visit(t, "#library");
  const before = page.world.requests.length;
  page.world.change(GUIDE, "README.md", "The guide, revised.\n");
  await register(page, "repository");
  await enter(fieldLabelled(page, "Repository address"), GUIDE_WEB);
  const tree = page.world.requests.slice(before).find((request) => request.repository === GUIDE && /\/git\/trees\//.test(request.url.pathname));
  const head = /\/git\/trees\/([0-9a-f]{40})$/.exec(tree.url.pathname)[1];
  assert.match(text(page), new RegExp(`Pinned to commit ${head} on main\\.`));
  await describe(page, { id: "SRC-guide", title: "Guide", ...COMMON });
  await save(page);
  assert.match(commitsOf(page, INSTANCE)[0].files["docs/sources/SRC-guide.md"], new RegExp(`commit ${head} \\|`));
});

// TST-370311 · level: release · module: system
// guards: UC-004; THE SOURCE KIND IS ONE OF A CLOSED SET
// given: documents k.md, every field filled in; the kind typed as "repository", which is not among the set, and then as each of organisation, person, standard (with a designation), regulation, document, system and measurement
// input: the form
// expect: "repository" leaves Save disabled, the page naming the seven kinds; each of the seven enables Save
test("TST-370311: UC-004 a source's kind is one of organisation, person, standard, regulation, document, system and measurement", async (t) => {
  const page = await visit(t, "#library");
  await register(page, "documents");
  await choose(page, [fileOf("k.md", "# K\n")]);
  await describe(page, { id: "SRC-k", title: "K", ...COMMON, kind: "repository" });
  assert.equal(saveOf(page).disabled, true);
  assert.match(text(page), /organisation, person, standard, regulation, document, system, measurement/);
  for (const kind of ["organisation", "person", "standard", "regulation", "document", "system", "measurement"]) {
    await describe(page, { kind, designation: kind === "standard" ? "K 1:2026" : "" });
    assert.equal(saveOf(page).disabled, false, kind);
  }
});

// TST-370312 · level: release · module: system
// guards: UC-004; EVERY ARTIFACT HAS AN IDENTIFIER
// given: documents i.md, every field filled in; the identifier typed as "handbook", which is no SRC- identifier, then as SRC-handbook
// input: the form; Save with SRC-handbook
// expect: "handbook" leaves Save disabled; with SRC-handbook the entry is written as docs/sources/SRC-handbook.md and carries "id: SRC-handbook"
test("TST-370312: UC-004 a registered source carries its SRC- identifier", async (t) => {
  const page = await visit(t, "#library");
  await register(page, "documents");
  await choose(page, [fileOf("i.md", "# I\n")]);
  await describe(page, { id: "handbook", title: "Handbook", ...COMMON });
  assert.equal(saveOf(page).disabled, true);
  await describe(page, { id: "SRC-handbook" });
  await save(page);
  const [commit] = commitsOf(page, INSTANCE);
  assert.match(commit.files["docs/sources/SRC-handbook.md"], /^id: SRC-handbook$/m);
});

// TST-370313 · level: release · module: system
// guards: UC-004; A PERSON'S OWN INPUT IS COMMITTED DIRECTLY
// given: this browser keeps the person's token for the instance
// input: documents p.md registered through the page, Save once
// expect: the entry is committed to the instance's default branch main — the branch moves to the new commit — with the person's token, and the page opens no branch and no pull request: every write is a blob, a tree, a commit or the move of refs/heads/main
test("TST-370313: UC-004 the person's registration is committed to the default branch under their own token, without a pull request", async (t) => {
  const page = await registerDocuments(t, { id: "SRC-p", title: "P" }, [fileOf("p.md", "# P\n")]);
  const [commit] = commitsOf(page, INSTANCE);
  assert.equal(commit.authorization, `Bearer ${TOKEN}`);
  assert.ok(page.world.files(INSTANCE)["docs/sources/SRC-p.md"], "on main");
  const kinds = writes(page).map((request) => `${request.method} ${request.url.pathname.replace(/^\/repos\/[^/]+\/[^/]+/, "")}`);
  assert.ok(kinds.length > 0, "known positive: the save writes");
  for (const kind of kinds) assert.match(kind, /^(POST \/git\/(blobs|trees|commits)|PATCH \/git\/refs\/heads\/main)$/, kind);
});

// TST-370314 · level: release · module: system
// guards: UC-004; ONE CLICK PER DECISION
// given: restricted documents q.md with the repository https://github.com/akmaier/norms named, every field filled in
// input: one press of Save
// expect: before the press nothing is written; the one press commits q.md to akmaier/norms and the entry to the instance, with no further click; the page says the source is registered
test("TST-370314: UC-004 one click on Save does everything that follows", async (t) => {
  const page = await visit(t, "#library");
  await register(page, "documents");
  await choose(page, [fileOf("q.md", "# Q\n")]);
  await describe(page, { id: "SRC-q", title: "Q", authority: "normative", licence: "restricted - internal" });
  await enter(fieldLabelled(page, "Repository for restricted content"), NORMS_WEB);
  assert.deepEqual(writes(page), []);
  await save(page);
  assert.equal(commitsOf(page, NORMS).length, 1);
  assert.equal(commitsOf(page, INSTANCE).length, 1);
  assert.match(text(page), /✓ SRC-q is registered/);
});

// TST-370315 · level: release · module: system
// guards: UC-004; EVERY STEP EXPLAINS ITSELF
// given: the route standard with a file chosen
// input: the page as the author meets it
// expect: each step that asks something carries its explanation folded, a closed details element the author may expand: the kind of source, the name, the authority, the licence, the designation, the file only hashed, and what becomes public
test("TST-370315: UC-004 every step that asks something carries a folded explanation", async (t) => {
  const page = await visit(t, "#library");
  await register(page, "standard");
  await choose(page, [fileOf("n.pdf", "n")]);
  for (const [step, words] of [["the kind of source", /An \*?EU legal text/], ["the name", /The name is how/], ["the authority", /Authority says/], ["the licence", /The licence says/],
    ["the designation", /full designation/], ["the file only hashed", /printed or local copy/], ["what becomes public", /states what becomes public/]]) {
    const found = folded(page.main()).find((details) => words.test(details.textContent));
    assert.ok(found, step);
    assert.equal(found.hasAttribute("open"), false, `${step}: folded`);
  }
});
