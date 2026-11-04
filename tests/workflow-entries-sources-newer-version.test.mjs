// MOD-workflow-entries' instance entry onSourcesCommitted for a run started with the input `source` (ITM-900), as docs/architecture/MOD-workflow-entries.md states it: "for each register entry of an EU legal text that
// waits for its fetch … and for the entry a run started with the input `source` names, fetches the official text and commits it …; for an entry that already has versions, the text is appended as a further version, and
// nothing is written when its SHA-256 equals an existing version's (`A SOURCE VERSION IS NEVER OVERWRITTEN`)". Where the texts leave a reading open, the test states the reading it takes:
//   - The run's input is read from the event payload's `inputs` (src/workflow-entries/product.mjs reads a dispatch's inputs there), and GitHub rejects a dispatch whose input the workflow does not declare, so
//     .github/workflows/fetch-sources.yml, which the module file names, declares the input `source` under workflow_dispatch.
//   - "Its SHA-256 equals an existing version's" is the equality of the fetched file set with an existing version's, by each file's name and SHA-256, which is how MOD-source-register's versionCommits refuses SameBytes;
//     nothing is written then, and that is not a failure: the status is `nothing to do`, naming the entry and the version it equals.
//   - An input that names no register entry, or an entry that is no EU legal text, ends the entry `failed`, naming the source (nothing is guessed).
// Run: node --test tests/workflow-entries-sources-newer-version.test.mjs
//
// Module: MOD-workflow-entries
// Guards: UC-016; UC-004; A SOURCE VERSION IS NEVER OVERWRITTEN; AN EU LEGAL TEXT IS FETCHED FROM THE OFFICIAL REPOSITORY
// Level: unit
//
// Deterministic, no network: the instance is a temporary git repository (tests/workflow-entries-sources.d/instance.mjs) and global fetch is replaced by a fixture answer. Each test states its input and expected result
// before it runs. The counter-proofs (a planted fault in src/workflow-entries/ and the test's failing result) are recorded in the pull request.

import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { readDocument } from "../src/documents/index.mjs";
import { sourceSchemas } from "../src/source-register/index.mjs";
import { runEntry } from "../src/workflow-entries/main.mjs";
import { NOW, envOf, git, headOf, withInstance, withPublication } from "./workflow-entries-sources.d/instance.mjs";

const sha = (text) => createHash("sha256").update(text).digest("hex");
const BODY = "<html><body>AI Act, consolidated</body></html>\n";
const OLD = "<html><body>AI Act</body></html>\n";
const ADDRESS = "https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32024R1689";
const lines = (...rows) => `${rows.join("\n")}\n`;
// A register entry of a legal text; `versions` are the rows and file tables already recorded: [{ id, file, text }].
function entryOf(id, identifier, versions = [], kind = "regulation") {
  const rows = versions.map(({ id: version, file, text }) => `| \`${version}\` | 2024-07-12 | - | publication repository | 1 file, listed below; version hash \`${sha(`${sha(text)}  ${file}\n`)}\` |`);
  const tables = versions.flatMap(({ id: version, file, text }) => ["", `### Files of ${version}`, "", "| File | SHA-256 |", "|---|---|", `| \`${file}\` | \`${sha(text)}\` |`]);
  return lines("---", `id: ${id}`, `title: ${id} title`, `kind: ${kind}`, "authority: normative", "licence: may be republished - EU legal text", `identifier: ${identifier}`, "---",
    `# ${id} ${id} title`, "", "## Versions", "", "| Version | Date | Edition | Read from | Files |", "|---|---|---|---|---|", ...rows, ...tables);
}
const FIRST = [{ id: "cellar-existing", file: "32024R1689.xhtml", text: OLD }];
const files = (extra = {}) => ({ "README.md": "# Fixture instance\n", ...extra });
const entryAt = (instance, id, commit = "main") => readDocument(sourceSchemas().entry, `docs/sources/${id}.md`, `${git(instance.origin, "show", `${commit}:docs/sources/${id}.md`)}\n`);
const versionsOf = (entry) => entry.sections[0].rows.map((row) => row.cells.Version);
const run = (instance, inputs) => runEntry("onSourcesCommitted", envOf(instance, inputs), { now: NOW });

// TST-900001 · level: unit · module: MOD-workflow-entries
// guards: UC-016; A SOURCE VERSION IS NEVER OVERWRITTEN; AN EU LEGAL TEXT IS FETCHED FROM THE OFFICIAL REPOSITORY
// given: SRC-ai-act, an EU legal text with the version cellar-existing (32024R1689.xhtml holding the old text), and SRC-other-law, another legal text with a version; the publication repository answers a newer text (ETag cellar-2024-07-12)
// input: onSourcesCommitted in a run started by hand with the input source = SRC-ai-act
// expect: outcome done, its summary naming SRC-ai-act; the publication repository is asked once; one commit on main, changing exactly docs/sources/SRC-ai-act.md and docs/sources/SRC-ai-act/cellar-2024-07-12/32024R1689.xhtml (the new bytes); the entry lists cellar-existing and then cellar-2024-07-12 and keeps the row of cellar-existing line for line; SRC-other-law is untouched
test("onSourcesCommitted — a run started for an entry that has a version appends the newer text as a further version, and leaves the other entries alone", async () => {
  const first = entryOf("SRC-ai-act", ADDRESS, FIRST);
  await withInstance(files({ "docs/sources/SRC-ai-act.md": first, "docs/sources/SRC-other-law.md": entryOf("SRC-other-law", ADDRESS, FIRST) }), async (instance) => {
    await withPublication({ body: BODY }, async (calls) => {
      const status = await run(instance, { source: "SRC-ai-act" });
      assert.equal(status.outcome, "done", status.summary);
      assert.match(status.summary, /SRC-ai-act/);
      assert.equal(calls(), 1);
      const after = headOf(instance);
      assert.deepEqual(git(instance.origin, "diff", "--name-only", instance.head, after).split("\n").sort(),
        ["docs/sources/SRC-ai-act.md", "docs/sources/SRC-ai-act/cellar-2024-07-12/32024R1689.xhtml"]);
      assert.equal(`${git(instance.origin, "show", `${after}:docs/sources/SRC-ai-act/cellar-2024-07-12/32024R1689.xhtml`)}\n`, BODY);
      const written = git(instance.origin, "show", `${after}:docs/sources/SRC-ai-act.md`);
      assert.equal(written.includes(first.split("\n").find((line) => line.startsWith("| `cellar-existing`"))), true, "the row of cellar-existing stays as it was");
      assert.deepEqual(versionsOf(entryAt(instance, "SRC-ai-act")), ["`cellar-existing`", "`cellar-2024-07-12`"]);
      assert.match(entryAt(instance, "SRC-ai-act").sections[0].text, new RegExp(`\\| \`32024R1689.xhtml\` \\| \`${sha(BODY)}\` \\|`));
    });
  });
});

// TST-900002 · level: unit · module: MOD-workflow-entries
// guards: UC-016; A SOURCE VERSION IS NEVER OVERWRITTEN
// given: SRC-ai-act with the version cellar-existing, whose file 32024R1689.xhtml has the SHA-256 of the text the publication repository answers now
// input: onSourcesCommitted in a run started with the input source = SRC-ai-act
// expect: outcome "nothing to do", its summary naming SRC-ai-act and cellar-existing; the publication repository is asked once; no commit is made and the working tree is clean
test("onSourcesCommitted — a fetched text whose SHA-256 equals an existing version's writes nothing, and is no failure", async () => {
  await withInstance(files({ "docs/sources/SRC-ai-act.md": entryOf("SRC-ai-act", ADDRESS, [{ id: "cellar-existing", file: "32024R1689.xhtml", text: BODY }]) }), async (instance) => {
    await withPublication({ body: BODY }, async (calls) => {
      const status = await run(instance, { source: "SRC-ai-act" });
      assert.equal(status.outcome, "nothing to do", status.summary);
      assert.equal(status.summary.includes("SRC-ai-act") && status.summary.includes("cellar-existing"), true, status.summary);
      assert.equal(calls(), 1);
      assert.equal(headOf(instance), instance.head);
      assert.equal(git(instance.clone, "status", "--porcelain"), "");
    });
  });
});

// TST-900003 · level: unit · module: MOD-workflow-entries
// guards: UC-004; UC-016; AN EU LEGAL TEXT IS FETCHED FROM THE OFFICIAL REPOSITORY
// given: SRC-ai-act, an EU legal text whose identifier is the bare CELEX number 32024R1689 as the library's form writes it, with no version row; and SRC-ai-act-2, the same with the version cellar-existing
// input: onSourcesCommitted in a push run (no input); then, in a fresh instance, in a run with the input source = SRC-ai-act-2
// expect: the push run completes SRC-ai-act (outcome done, one commit, SRC-ai-act-2 untouched, the publication repository asked once); the run with the input appends cellar-2024-07-12 to SRC-ai-act-2 as a further version after cellar-existing (outcome done)
test("onSourcesCommitted — an entry whose identifier is a bare CELEX number is fetched when it waits, and gets a further version when a run names it", async () => {
  const entries = () => files({ "docs/sources/SRC-ai-act.md": entryOf("SRC-ai-act", "32024R1689"), "docs/sources/SRC-ai-act-2.md": entryOf("SRC-ai-act-2", "32024R1689", FIRST) });
  await withInstance(entries(), async (instance) => {
    await withPublication({ body: BODY }, async (calls) => {
      const status = await run(instance);
      assert.equal(status.outcome, "done", status.summary);
      assert.equal(calls(), 1);
      assert.deepEqual(git(instance.origin, "diff", "--name-only", instance.head, headOf(instance)).split("\n").sort(),
        ["docs/sources/SRC-ai-act.md", "docs/sources/SRC-ai-act/cellar-2024-07-12/32024R1689.xhtml"]);
    });
  });
  await withInstance(entries(), async (instance) => {
    await withPublication({ body: BODY }, async () => {
      const status = await run(instance, { source: "SRC-ai-act-2" });
      assert.equal(status.outcome, "done", status.summary);
      assert.deepEqual(versionsOf(entryAt(instance, "SRC-ai-act-2")), ["`cellar-existing`", "`cellar-2024-07-12`"]);
    });
  });
});

// TST-900004 · level: unit · module: MOD-workflow-entries
// guards: UC-016; AN EU LEGAL TEXT IS FETCHED FROM THE OFFICIAL REPOSITORY
// given: SRC-ai-act with a version, a push run's environment with no input; and the same entry with a run that names it
// input: onSourcesCommitted in the push run; and in the run with the input, with a publication repository that cannot be reached
// expect: the push run is "nothing to do" with the summary "No EU legal text is waiting for its fetch.", the publication repository not asked and nothing committed; the run with the input is failed, its summary naming SRC-ai-act and the failure ("publication offline"), and nothing is committed
test("onSourcesCommitted — without the input an entry with a version is left alone; a named entry whose fetch fails writes nothing and is named", async () => {
  await withInstance(files({ "docs/sources/SRC-ai-act.md": entryOf("SRC-ai-act", ADDRESS, FIRST) }), async (instance) => {
    await withPublication({ body: BODY }, async (calls) => {
      const status = await run(instance);
      assert.equal(status.outcome, "nothing to do");
      assert.equal(status.summary, "No EU legal text is waiting for its fetch.");
      assert.equal(calls(), 0);
      assert.equal(headOf(instance), instance.head);
    });
    await withPublication({ throw: "publication offline" }, async () => {
      const status = await run(instance, { source: "SRC-ai-act" });
      assert.equal(status.outcome, "failed");
      assert.equal(status.summary.includes("SRC-ai-act") && status.summary.includes("publication offline"), true, status.summary);
      assert.equal(headOf(instance), instance.head);
      assert.equal(git(instance.clone, "status", "--porcelain"), "");
    });
  });
});

// TST-900005 · level: unit · module: MOD-workflow-entries
// guards: AN EU LEGAL TEXT IS FETCHED FROM THE OFFICIAL REPOSITORY
// given: an instance holding SRC-ai-act (an EU legal text with a version) and SRC-book (kind document, identifier https://example.org/book)
// input: onSourcesCommitted in a run with the input source = SRC-nope; and in another with the input source = SRC-book
// expect: both outcomes are failed, the first summary naming SRC-nope and the second SRC-book; the publication repository is not asked; nothing is committed
test("onSourcesCommitted — an input that names no entry, or an entry that is no EU legal text, fails naming it and writes nothing", async () => {
  await withInstance(files({ "docs/sources/SRC-ai-act.md": entryOf("SRC-ai-act", ADDRESS, FIRST), "docs/sources/SRC-book.md": entryOf("SRC-book", "https://example.org/book", [], "document") }), async (instance) => {
    await withPublication({ body: BODY }, async (calls) => {
      for (const source of ["SRC-nope", "SRC-book"]) {
        const status = await run(instance, { source });
        assert.equal(status.outcome, "failed", source);
        assert.equal(status.summary.includes(source), true, status.summary);
      }
      assert.equal(calls(), 0);
      assert.equal(headOf(instance), instance.head);
    });
  });
});

// TST-900006 · level: unit · module: MOD-workflow-entries
// guards: UC-016; AN EU LEGAL TEXT IS FETCHED FROM THE OFFICIAL REPOSITORY
// given: the workflow file .github/workflows/fetch-sources.yml, which the module file names
// input: its text, read
// expect: under `workflow_dispatch:` it declares `inputs:` with an input `source:` (GitHub refuses a dispatch carrying an input a workflow does not declare), and it still runs `node src/workflow-entries/main.mjs onSourcesCommitted`
test("fetch-sources.yml declares the input source of a dispatch and runs the entry", () => {
  const yaml = readFileSync(new URL("../.github/workflows/fetch-sources.yml", import.meta.url), "utf8");
  assert.match(yaml, /workflow_dispatch:\s*\n\s+inputs:\s*\n\s+source:/);
  assert.match(yaml, /node src\/workflow-entries\/main\.mjs onSourcesCommitted/);
});
