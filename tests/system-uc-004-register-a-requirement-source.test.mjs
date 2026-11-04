// System coverage for UC-004 Register a requirement source in the library, walked through the dashboard: the main flow, steps 1 to 7, and the alternative flows 4a, 4b, 4c, 7a and
// 1a. The page is MOD-settings-pages' route `library` in MOD-site-frame's frame, over MOD-repository-hosts' real GitHub host answered by the GitHub fixture; the fetch is the
// instance's workflow fetch-sources.yml run over a git instance holding what the page committed, with the EU's publication repository a fixture (tests/uc-004-harness.mjs). No
// request leaves the process.
// Run: node --test tests/system-uc-004-register-a-requirement-source.test.mjs
//
// Module: MOD-settings-pages
// Module: MOD-source-register
// Guards: UC-004
// Level: system
//
// Authored by developer-opus-f (ITM-370), who implemented none of ITM-313, ITM-314, ITM-345, ITM-350, ITM-385, ITM-400, ITM-401 and ITM-402.
// Each test states its input and its expected values in its own text; none reads an expected result from the SPEC, a use case or an architecture file. A person's click is the
// page's own listener called through the event it dispatches, marked trusted as a browser marks it. Where the page and UC-004 disagree the case follows UC-004 and is marked
// { todo } with the finding it reports; no finding is open.
// Readings the texts leave open, which the cases state:
//   - Step 1 "opens Library on the dashboard": the route `library`, which the frame shows under the menu entry Settings (the Settings page's line *Source library* leads to it).
//   - Step 7 "the fetch workflow": the instance's workflow file .github/workflows/fetch-sources.yml, whose step runs `node src/workflow-entries/main.mjs onSourcesCommitted`; the
//     run's log is what that command prints, and the library reads it as the log of the run.
//   - 4c "shows how to extend the token, as in UC-001": a link to the server's page for a new token, which names the repository.

import test from "node:test";
import assert from "node:assert/strict";
import { installDocument } from "./settings-pages-harness.mjs";
import { AI_ACT, AI_ACT_ELI, GUIDE, GUIDE_TOKEN, GUIDE_WEB, INSTANCE, NORMS, NORMS_TOKEN, NORMS_WEB, REGISTER, TOKEN, buttonLabelled, byTag, choose, click, commitsOf, describe,
  enter, fieldLabelled, fileOf, folded, go, inputOf, listed, onlyHash, register, runFetchWorkflow, save, saveOf, sha, text, visit, writes } from "./uc-004-harness.mjs";

installDocument();

const TODAY = new Date().toISOString().slice(0, 10);
const PUBLICATION = "<html><body>Regulation (EU) 2024/1689</body></html>\n";
const filesOf = (commit) => Object.keys(commit.files).sort();
const rowOf = (entry, version) => entry.split("\n").find((line) => line.startsWith(`| \`${version}\``));

// Registers the AI Act as an EU legal text from `address`, through the page: + Register source, the route, the address, the common fields, Save. -> the page.
async function registerAiAct(t, address = AI_ACT) {
  const page = await visit(t, "#library");
  await register(page, "legal-text");
  await enter(fieldLabelled(page, "EUR-Lex or ELI address"), address);
  await describe(page, { id: "SRC-ai-act", title: "AI Act", authority: "normative", licence: "may be republished - EU law" });
  await save(page);
  return page;
}

// TST-370201 · level: system · module: system
// guards: UC-004
// given: the instance's register holds IEC 62304; this browser keeps the instance's token
// input: the author opens #library and presses + Register source
// expect: the frame shows the route headed "Library" under the menu entry Settings, listing IEC 62304; the question "What is the source?" offers legal-text, standard, documents and repository, with a sentence and an example ("for example") for each of an EU legal text, a standard, documents and a repository; the form has the fields id, title, kind, authority and licence, and the explanations of the kinds, the name, the authority and the licence are folded (closed) and each holds an example ("for example" or "such as")
test("TST-370201: UC-004 steps 1 to 3 — + Register source asks what the source is, with a sentence and an example for each, and the common fields with folded explanations", async (t) => {
  const page = await visit(t, "#library");
  assert.equal(byTag(page.main(), "h2")[0].textContent, "Library");
  assert.deepEqual(byTag(byTag(document.body, "nav")[0], "a").filter((entry) => entry.className === "active").map((entry) => entry.textContent), ["Settings"]);
  assert.match(listed(page, "IEC 62304"), /SRC-iec-62304/);
  await click(buttonLabelled(page, /^\+ Register source$/));
  const question = fieldLabelled(page, "What is the source?", "select");
  assert.deepEqual(byTag(question, "option").map((option) => option.value), ["legal-text", "standard", "documents", "repository"]);
  for (const kind of [/An EU legal text — [^.]*EUR-Lex or ELI address, for example/, /A standard — [^.]*designation, for example/, /Documents — [^—]*, for example/, /A repository — [^—]*, for example/]) {
    assert.match(text(page), kind);
  }
  for (const key of ["id", "title", "kind", "authority", "licence"]) assert.ok(inputOf(page, key), `the field ${key}`);
  for (const [topic, words] of [["kinds", /An \*?EU legal text/], ["name", /The name is how/], ["authority", /Authority says/], ["licence", /The licence says/]]) {
    const found = folded(page.main()).find((details) => words.test(details.textContent));
    assert.ok(found, `the explanation of the ${topic}`);
    assert.equal(found.hasAttribute("open"), false, `${topic}: folded`);
    assert.match(found.textContent, /for example|such as/, `${topic}: with an example`);
  }
});

// TST-370202 · level: system · module: system
// guards: UC-004
// given: the instance's register holds IEC 62304 only
// input: the route legal-text; the AI Act's EUR-Lex address https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32024R1689 pasted; id SRC-ai-act, title AI Act, authority normative, licence "may be republished - EU law"; Save pressed once
// expect: step 4: the CELEX number 32024R1689 is recognised, shown and filled in as the identifier; step 5: before Save nothing is written and the page states that the register entry becomes public; step 6: one click makes one commit to the instance's default branch, made with the person's token, holding only docs/sources/SRC-ai-act.md, whose identifier is 32024R1689 and which records no version yet; the library lists the AI Act as waiting for its fetch
test("TST-370202: UC-004 steps 4 to 6 — an EU legal text: its CELEX number recognised, what becomes public stated, and one click commits its entry", async (t) => {
  const page = await visit(t, "#library");
  await register(page, "legal-text");
  await enter(fieldLabelled(page, "EUR-Lex or ELI address"), AI_ACT);
  assert.match(text(page), /Recognised: CELEX 32024R1689/);
  assert.equal(inputOf(page, "identifier").value, "32024R1689");
  await describe(page, { id: "SRC-ai-act", title: "AI Act", authority: "normative", licence: "may be republished - EU law" });
  assert.match(text(page), /Becomes public: the register entry, always, in the instance repository akmaier\/agent-m\./);
  assert.deepEqual(writes(page), [], "nothing is written before Save");
  await save(page);
  const commits = commitsOf(page, INSTANCE);
  assert.equal(commits.length, 1, "one click, one commit");
  assert.deepEqual(filesOf(commits[0]), ["docs/sources/SRC-ai-act.md"]);
  assert.equal(commits[0].authorization, `Bearer ${TOKEN}`);
  const entry = commits[0].files["docs/sources/SRC-ai-act.md"];
  assert.match(entry, /^identifier: 32024R1689$/m);
  assert.equal(entry.split("\n").filter((line) => /^\| \x60/.test(line)).length, 0, "no version yet");
  assert.match(listed(page, "AI Act"), /Waiting for fetch\./);
});

// TST-370203 · level: system · module: system
// guards: UC-004
// given: the instance after TST-370202's walk: its register holds IEC 62304 and the AI Act's entry with no version; the EU's publication repository answers the AI Act as the file 32024R1689.xhtml, retrieved on 16 July 2024, at its version cellar-2024-07-12
// input: the push of the entry runs the fetch workflow; then the author opens #library and #library/source=SRC-ai-act
// expect: step 7: the workflow asks the publication repository, and nothing else, for the text; it ends successfully and its one commit changes docs/sources/SRC-ai-act.md and adds docs/sources/SRC-ai-act/cellar-2024-07-12/32024R1689.xhtml with the bytes answered; the entry's version row records cellar-2024-07-12, the retrieval date 2024-07-16 and the version, and its file table the SHA-256 of the text; the library shows the AI Act as fetched, with the version cellar-2024-07-12; the source's page lists that version, read from the publication repository
test("TST-370203: UC-004 step 7 — the fetch workflow downloads the official text, records date, version and SHA-256, and the library shows the source as fetched", async (t) => {
  const registered = await registerAiAct(t);
  const run = await runFetchWorkflow(registered.world.files(INSTANCE), { publication: PUBLICATION });
  assert.deepEqual(run.requested, ["https://publications.europa.eu/resource/celex/32024R1689?language=eng"]);
  assert.equal(run.exit, 0, run.log + run.stderr);
  assert.deepEqual(run.changed.sort(), ["docs/sources/SRC-ai-act.md", "docs/sources/SRC-ai-act/cellar-2024-07-12/32024R1689.xhtml"]);
  assert.equal(run.after["docs/sources/SRC-ai-act/cellar-2024-07-12/32024R1689.xhtml"], PUBLICATION);
  const entry = run.after["docs/sources/SRC-ai-act.md"];
  assert.match(rowOf(entry, "cellar-2024-07-12"), /\| 2024-07-16 \|.*retrieved 2024-07-16, version cellar-2024-07-12/);
  assert.ok(entry.includes(`| \`32024R1689.xhtml\` | \`${sha(PUBLICATION)}\``), "the SHA-256 of the text");
  const library = await visit(t, "#library", { files: run.after });
  assert.match(listed(library, "AI Act"), /Versions: cellar-2024-07-12/);
  assert.match(listed(library, "AI Act"), /Fetched\./);
  const source = await visit(t, "#library/source=SRC-ai-act", { files: run.after });
  assert.match(text(source), /cellar-2024-07-12 · 2024-07-16 · .* read from publication repository, retrieved 2024-07-16/);
});

// TST-370204 · level: system · module: system
// guards: UC-004
// given: the route standard
// input: the designation IEC 61508:2010+AMD1:2015 entered
// expect: step 4 "Standard": the designation stands in the form's field designation; its folded explanation names the norm's cover page and why the amendment matters; the licence is preset to restricted and the kind to standard
test("TST-370204: UC-004 step 4 — a standard: the full designation, explained, and the licence preset to restricted", async (t) => {
  const page = await visit(t, "#library");
  await register(page, "standard");
  await enter(fieldLabelled(page, "Full designation"), "IEC 61508:2010+AMD1:2015");
  assert.equal(inputOf(page, "designation").value, "IEC 61508:2010+AMD1:2015");
  const explanation = folded(page.main()).find((details) => /cover page/.test(details.textContent));
  assert.ok(explanation, "the explanation of the designation");
  assert.equal(explanation.hasAttribute("open"), false);
  assert.match(explanation.textContent, /amendment matters/);
  assert.equal(inputOf(page, "licence").value, "restricted");
  assert.equal(inputOf(page, "kind").value, "standard");
});

// TST-370205 · level: system · module: system
// guards: UC-004
// given: the route documents; the files handbook.md ("# Handbook\n") and annex.pdf ("annex bytes"); the licence "may be republished - CC BY 4.0"
// input: the files chosen; id SRC-handbook, title Handbook, authority advisory; Save pressed once
// expect: step 4 "Documents": each file is shown with its SHA-256, computed in the browser before anything is sent; step 5: the page states that the files become public in the instance; step 6: one commit to the instance holds docs/sources/SRC-handbook.md and the two files under docs/sources/SRC-handbook/<today>/ with their bytes, and the entry records each file's SHA-256; nothing is written to another repository
test("TST-370205: UC-004 steps 4 to 6 — documents that may be republished: hashed in the browser, stated public, and committed to the instance with their entry", async (t) => {
  const page = await visit(t, "#library");
  await register(page, "documents");
  const handbook = fileOf("handbook.md", "# Handbook\n"), annex = fileOf("annex.pdf", "annex bytes");
  await choose(page, [handbook, annex]);
  assert.match(text(page), new RegExp(`handbook\\.md: ${sha(handbook.text)}`));
  assert.match(text(page), new RegExp(`annex\\.pdf: ${sha(annex.text)}`));
  assert.deepEqual(writes(page), [], "hashed in the browser, nothing sent");
  await describe(page, { id: "SRC-handbook", title: "Handbook", authority: "advisory", licence: "may be republished - CC BY 4.0" });
  assert.match(text(page), /Content, public in the instance repository: handbook\.md, annex\.pdf\./);
  await save(page);
  const [commit] = commitsOf(page, INSTANCE);
  assert.deepEqual(filesOf(commit), [`docs/sources/SRC-handbook.md`, `docs/sources/SRC-handbook/${TODAY}/annex.pdf`, `docs/sources/SRC-handbook/${TODAY}/handbook.md`]);
  assert.equal(commit.files[`docs/sources/SRC-handbook/${TODAY}/handbook.md`], handbook.text);
  for (const file of [handbook, annex]) assert.ok(commit.files["docs/sources/SRC-handbook.md"].includes(sha(file.text)), file.name);
  assert.deepEqual(writes(page).filter((request) => request.repository !== INSTANCE), []);
});

// TST-370206 · level: system · module: system
// guards: UC-004
// given: the route documents; the file contract.pdf ("contract bytes"); the licence "restricted - internal"; this browser keeps a token for akmaier/norms
// input: the file chosen; id SRC-contract, title Contract, authority normative; the repository https://github.com/akmaier/norms named for the restricted content; Save pressed once
// expect: step 4: before the repository is named, Save is disabled; step 5: the page states that the content is stored only in akmaier/norms and not in the public instance; step 6: one click commits contract.pdf to akmaier/norms under docs/sources/SRC-contract/<today>/ with the token of akmaier/norms, and the entry alone to the instance with the instance's token, naming akmaier/norms as its content_repository
test("TST-370206: UC-004 steps 4 to 6 — restricted documents go to the repository the author chooses, the entry to the instance", async (t) => {
  const page = await visit(t, "#library");
  await register(page, "documents");
  const contract = fileOf("contract.pdf", "contract bytes");
  await choose(page, [contract]);
  await describe(page, { id: "SRC-contract", title: "Contract", authority: "normative", licence: "restricted - internal" });
  assert.equal(saveOf(page).disabled, true, "no repository chosen yet");
  await enter(fieldLabelled(page, "Repository for restricted content"), NORMS_WEB);
  assert.match(text(page), /Content, stored only in akmaier\/norms and not in the public instance: contract\.pdf\./);
  await save(page);
  const [content] = commitsOf(page, NORMS), [entry] = commitsOf(page, INSTANCE);
  assert.deepEqual(filesOf(content), [`docs/sources/SRC-contract/${TODAY}/contract.pdf`]);
  assert.equal(content.authorization, `Bearer ${NORMS_TOKEN}`);
  assert.deepEqual(filesOf(entry), ["docs/sources/SRC-contract.md"]);
  assert.equal(entry.authorization, `Bearer ${TOKEN}`);
  assert.match(entry.files["docs/sources/SRC-contract.md"], new RegExp(`^content_repository: ${NORMS_WEB}$`, "m"));
});

// TST-370207 · level: system · module: system
// guards: UC-004
// given: the route repository; the repository akmaier/guide, whose default branch main stands at a commit of the fixture; this browser keeps a token for akmaier/guide
// input: the address https://github.com/akmaier/guide pasted; id SRC-guide, title Guide, authority advisory, licence "may be republished - MIT"; Save
// expect: step 4 "Repository": the page reads the repository's current commit with the stored token of akmaier/guide — every request to akmaier/guide carries it — and shows "Pinned to commit <that commit> on main."; the committed entry's identifier is the address and its version row records the address and that commit
test("TST-370207: UC-004 step 4 — a repository: its current commit read with the stored token and pinned", async (t) => {
  const page = await visit(t, "#library");
  await register(page, "repository");
  await enter(fieldLabelled(page, "Repository address"), GUIDE_WEB);
  const asked = page.world.requests.filter((request) => request.repository === GUIDE);
  assert.ok(asked.length > 0, "known positive: the repository is read");
  assert.deepEqual([...new Set(asked.map((request) => request.authorization))], [`Bearer ${GUIDE_TOKEN}`]);
  const head = asked.map((request) => /\/git\/trees\/([0-9a-f]{40})$/.exec(request.url.pathname)?.[1]).find(Boolean);
  assert.match(text(page), new RegExp(`Pinned to commit ${head} on main\\.`));
  await describe(page, { id: "SRC-guide", title: "Guide", authority: "advisory", licence: "may be republished - MIT" });
  await save(page);
  const entry = commitsOf(page, INSTANCE)[0].files["docs/sources/SRC-guide.md"];
  assert.match(entry, new RegExp(`^identifier: ${GUIDE_WEB}$`, "m"));
  assert.match(rowOf(entry, TODAY), new RegExp(`${GUIDE_WEB} commit ${head}`));
});

// TST-370208 · level: system · module: system
// guards: UC-004
// given: the route standard with the designation ISO 26262:2018; the author's local copy iso-26262.pdf ("the publisher's bytes"), which they do not want to upload
// input: the file chosen; "Only hash it" ticked with the note "cabinet 3, shelf B"; id SRC-iso-26262, title ISO 26262, authority normative; Save
// expect: 4a: the file's SHA-256 is shown, and the page states that nothing of it is stored; Save writes one commit, to the instance, holding the entry alone — no file is written anywhere, no repository but the instance is written to, and no write carries the file's bytes —; the entry records the designation, the file's SHA-256 and the note
test("TST-370208: UC-004 4a — a copy the author does not upload: hashed in the browser, and only designation, hash and note recorded", async (t) => {
  const page = await visit(t, "#library");
  await register(page, "standard");
  await enter(fieldLabelled(page, "Full designation"), "ISO 26262:2018");
  const copy = fileOf("iso-26262.pdf", "the publisher's bytes");
  await choose(page, [copy]);
  await onlyHash(page, "iso-26262.pdf", "cabinet 3, shelf B");
  await describe(page, { id: "SRC-iso-26262", title: "ISO 26262", authority: "normative" });
  assert.match(text(page), /Nothing of iso-26262\.pdf is stored: only its SHA-256 is recorded, with a note\./);
  await save(page);
  const commits = commitsOf(page, INSTANCE);
  assert.equal(commits.length, 1);
  assert.deepEqual(filesOf(commits[0]), ["docs/sources/SRC-iso-26262.md"]);
  assert.deepEqual(writes(page).filter((request) => request.repository !== INSTANCE), []);
  assert.deepEqual(writes(page).filter((request) => request.url.pathname.endsWith("/git/blobs")), [], "no file's bytes are sent");
  const entry = commits[0].files["docs/sources/SRC-iso-26262.md"];
  assert.doesNotMatch(entry, /the publisher's bytes/);
  assert.match(entry, /^designation: ISO 26262:2018$/m);
  assert.ok(entry.includes(`| \`iso-26262.pdf\` | \`${sha(copy.text)}\` | cabinet 3, shelf B |`));
});

// TST-370209 · level: system · module: system
// guards: UC-004
// given: the route documents; the file rules.md ("# Rules\n"); the licence unknown (known positive: the same file with the licence "may be republished - CC0" goes to the instance)
// input: the file chosen; id SRC-rules, title Rules, authority advisory, licence "unknown"; then the repository https://github.com/akmaier/norms named; Save
// expect: 4b: while no repository is named, Save is disabled and the page names the restricted content's need of a repository; the page states that the content is stored only in akmaier/norms and not in the public instance; Save commits rules.md to akmaier/norms alone and the entry, with no file, to the instance
test("TST-370209: UC-004 4b — a licence that is unknown is treated as restricted", async (t) => {
  const open = await visit(t, "#library");
  await register(open, "documents");
  await choose(open, [fileOf("rules.md", "# Rules\n")]);
  await describe(open, { id: "SRC-rules", title: "Rules", authority: "advisory", licence: "may be republished - CC0" });
  assert.match(text(open), /Content, public in the instance repository: rules\.md\./, "known positive");
  const page = await visit(t, "#library");
  await register(page, "documents");
  await choose(page, [fileOf("rules.md", "# Rules\n")]);
  await describe(page, { id: "SRC-rules", title: "Rules", authority: "advisory", licence: "unknown" });
  assert.equal(saveOf(page).disabled, true);
  assert.match(text(page), /restricted content needs a repository of its own/);
  await enter(fieldLabelled(page, "Repository for restricted content"), NORMS_WEB);
  assert.match(text(page), /Content, stored only in akmaier\/norms and not in the public instance: rules\.md\./);
  await save(page);
  assert.deepEqual(filesOf(commitsOf(page, NORMS)[0]), [`docs/sources/SRC-rules/${TODAY}/rules.md`]);
  assert.deepEqual(filesOf(commitsOf(page, INSTANCE)[0]), ["docs/sources/SRC-rules.md"]);
});

// TST-370210 · level: system · module: system
// guards: UC-004
// given: the route documents; restricted files; the named repository https://github.com/akmaier/missing, which the stored token cannot reach (the server answers it as not found)
// input: the file secret.md chosen; id SRC-secret, title Secret, authority normative, licence "restricted - internal", content_repository https://github.com/akmaier/missing; Save
// expect: 4c: the page says that the stored token cannot reach https://github.com/akmaier/missing and that nothing was committed, and links the server's page for a new token (https://github.com/settings/personal-access-tokens/new…) whose description names that repository; nothing is committed to the instance or anywhere else
test("TST-370210: UC-004 4c — a named repository the stored token cannot reach is named, with how to extend the token", async (t) => {
  const page = await visit(t, "#library");
  await register(page, "documents");
  await choose(page, [fileOf("secret.md", "# Secret\n")]);
  await describe(page, { id: "SRC-secret", title: "Secret", authority: "normative", licence: "restricted - internal", content_repository: "https://github.com/akmaier/missing" });
  await save(page);
  assert.match(text(page), /The stored token cannot reach https:\/\/github\.com\/akmaier\/missing .*Nothing was committed\./);
  const link = byTag(page.main(), "a").find((anchor) => /^https:\/\/github\.com\/settings\/personal-access-tokens\/new\?/.test(anchor.getAttribute("href")));
  assert.ok(link, "the server's token page is linked");
  assert.match(decodeURIComponent(link.getAttribute("href")), /https:\/\/github\.com\/akmaier\/missing/);
  assert.deepEqual(commitsOf(page, INSTANCE), []);
  assert.deepEqual(writes(page).filter((request) => request.url.pathname.endsWith("/git/refs/heads/main")), []);
});

// TST-370211 · level: system · module: system
// guards: UC-004
// given: the AI Act registered through the page from its ELI address https://eur-lex.europa.eu/eli/reg/2024/1689/oj; the EU's publication repository unreachable
// input: the fetch workflow runs on the push; the author opens #library with that run failed and its log; the author presses Fetch again; the run that press starts runs, the publication repository answering again
// expect: 7a: the failed run writes nothing and ends with a non-zero exit, its log naming SRC-ai-act and the failure; the library shows the AI Act with no version and "Fetch failed:" followed by the log's line, and a Fetch again button — nothing is guessed; Fetch again starts fetch-sources.yml on main with the input source SRC-ai-act; that run fetches the text and the library then shows the AI Act as fetched
test("TST-370211: UC-004 7a — a failed fetch is shown with its error and Fetch again, nothing is guessed, and Fetch again fetches", async (t) => {
  const registered = await registerAiAct(t, AI_ACT_ELI);
  const files = registered.world.files(INSTANCE);
  const failed = await runFetchWorkflow(files, { publication: "offline" });
  assert.notEqual(failed.exit, 0);
  assert.deepEqual(failed.changed, [], "nothing is written");
  const line = failed.log.split("\n").find((each) => each.includes("SRC-ai-act"));
  assert.match(line, /publication offline/);
  const page = await visit(t, "#library", { files, log: failed.log });
  assert.match(listed(page, "AI Act"), /No version recorded yet\./);
  assert.ok(listed(page, "AI Act").includes(`Fetch failed: ${line}`), listed(page, "AI Act"));
  assert.doesNotMatch(listed(page, "AI Act"), /Fetched\./);
  await click(buttonLabelled(page, /^Fetch again$/));
  assert.deepEqual(page.runs.dispatched, [{ ref: "main", inputs: { source: "SRC-ai-act" } }]);
  const again = await runFetchWorkflow(files, { publication: PUBLICATION, source: "SRC-ai-act" });
  assert.equal(again.exit, 0, again.log + again.stderr);
  const after = await visit(t, "#library", { files: again.after });
  assert.match(listed(after, "AI Act"), /Fetched\./);
});

// TST-370212 · level: system · module: system
// guards: UC-004
// given: the register holds IEC 62304, designation IEC 62304:2006+AMD1:2015 (known positive: a title no entry has, Other norm, is not named as in the library)
// input: the route standard; the title IEC 62304 typed; the offered button pressed
// expect: 1a: the page says the source is already in the library and offers "Add a new version of SRC-iec-62304", and Save is disabled; the button leads to #library/source=SRC-iec-62304, which shows the source with + New version
test("TST-370212: UC-004 1a — a source already in the library: Agent M offers to add a new version instead", async (t) => {
  const page = await visit(t, "#library");
  await register(page, "standard");
  await describe(page, { title: "Other norm" });
  assert.equal(buttonLabelled(page, /^Add a new version of/), undefined, "known positive");
  await describe(page, { title: "IEC 62304" });
  assert.match(text(page), /already in the library/);
  assert.equal(saveOf(page).disabled, true);
  await click(buttonLabelled(page, /^Add a new version of SRC-iec-62304$/));
  assert.equal(page.location.hash, "#library/source=SRC-iec-62304");
  await go(page, page.location.hash);
  assert.match(text(page), /IEC 62304 \(SRC-iec-62304\)/);
  assert.ok(buttonLabelled(page, /^\+ New version$/));
});

// TST-370213 · level: system · module: system
// guards: UC-004
// given: the documents of TST-370205 registered through the page (handbook.md and annex.pdf, may be republished)
// input: the author opens #library/source=SRC-handbook
// expect: the postcondition "The library lists the source with kind, authority, licence and at least one version, each version with identifier, date and the SHA-256 of every file read": the source's page shows kind document, authority advisory, the licence, the version <today> with its date, and the SHA-256 of handbook.md and of annex.pdf.
test("TST-370213: UC-004 postcondition — the library shows a source's kind, authority, licence and versions, each file with its SHA-256", async (t) => {
  const page = await visit(t, "#library");
  await register(page, "documents");
  const handbook = fileOf("handbook.md", "# Handbook\n"), annex = fileOf("annex.pdf", "annex bytes");
  await choose(page, [handbook, annex]);
  await describe(page, { id: "SRC-handbook", title: "Handbook", authority: "advisory", licence: "may be republished - CC BY 4.0" });
  await save(page);
  const source = await visit(t, "#library/source=SRC-handbook", { files: page.world.files(INSTANCE) });
  for (const shown of ["kind: document", "authority: advisory", "licence: may be republished - CC BY 4.0", `${TODAY} · ${TODAY}`]) assert.ok(text(source).includes(shown), shown);
  for (const file of [handbook, annex]) assert.ok(text(source).includes(sha(file.text)), `the SHA-256 of ${file.name}`);
});

// TST-370214 · level: system · module: system
// guards: UC-004
// given: the route legal-text with the AI Act's EUR-Lex address and the licence "may be republished - EU law"
// input: the form filled in, before Save
// expect: step 5 "Agent M states what becomes public: the register entry always; the content only if it may be republished": the statement names, besides the register entry, the official text the fetch will store as public in the instance.
test("TST-370214: UC-004 step 5 — before an EU legal text is saved, the page states that its text becomes public too", async (t) => {
  const page = await visit(t, "#library");
  await register(page, "legal-text");
  await enter(fieldLabelled(page, "EUR-Lex or ELI address"), AI_ACT);
  await describe(page, { id: "SRC-ai-act", title: "AI Act", authority: "normative", licence: "may be republished - EU law" });
  const statement = /Becomes public:[^]*?(?=What is this\?)/.exec(text(page))?.[0] ?? "";
  assert.match(statement, /register entry/);
  assert.match(statement, /text|content/i, statement);
});
