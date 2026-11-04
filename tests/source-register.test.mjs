// Where a source's content may go (ITM-217) — MOD-source-register's interface as docs/architecture/MOD-source-register.md
// states it, for UC-002: sourceSchemas, which gives the schema of a register entry, and permittedPlaces, the processing
// places to which the content of a source may be given. The schema of a product's links file, sourceSchemas' `links`, is not
// part of ITM-217 and is not tested here; nor are registering, fetching and reading a source's content.
// Run: node --test tests/source-register.test.mjs
//
// Module: MOD-source-register
// Guards: UC-002; RESTRICTED CONTENT GOES ONLY WHERE ITS SOURCE PERMITS; A SOURCE DECLARES ITS LICENCE; THE SOURCE KIND IS ONE OF A CLOSED SET; A SOURCE DECLARES ITS AUTHORITY; A STANDARD IS REGISTERED BY ITS DESIGNATION; A SOURCE VERSION IS NEVER OVERWRITTEN
// Level: unit
//
// Every expected value is read from the module file. Its Data: a register entry `docs/sources/SRC-<slug>.md` with the front
// matter keys id, title, kind (one of seven), authority (one of three), licence (`may be republished`, `restricted`, or
// `unknown`, which counts as restricted, and the licence's name or terms), designation (for a standard), identifier,
// content_repository and places; its body `## Versions`, a table with one row per version, appended and never changed, and
// optionally `## Parts`. Its Interfaces: `permittedPlaces(entry: Document) -> string[] | "any"` — any for content that may be
// republished, its declared places otherwise, none when it declares none.
//
// The entries are read as every caller reads them: through MOD-documents' interface, with the schema sourceSchemas gives,
// whose file has the form ITM-213 settled (one ```json block in a *.schema.md file; a section named by its heading line, of
// which the first table is read). Where the module file names no column of `## Versions`, the columns are those of this
// instance's own entry, docs/sources/SRC-vibe-coding.md: Version, Date, Edition, Read from, Files. That entry is read as it
// stands and never changed.
//
// Each test states its input and its expected result before it runs (given / input / expect); where a test asserts that
// something is refused, the same call is first shown to succeed on a known positive. Nothing reaches the network. The
// counter-proofs are recorded in the pull request.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readDocument, writeDocument } from "../src/documents/index.mjs";
import { sourceSchemas, permittedPlaces } from "../src/source-register/index.mjs";
import * as register from "../src/source-register/index.mjs";

const MODULE = new URL("../src/source-register/index.mjs", import.meta.url);
const SCHEMA_FILE = new URL("../src/source-register/source.schema.md", import.meta.url);
const LINKS_FILE = new URL("../src/source-register/links.schema.md", import.meta.url);
const VIBE_CODING = new URL("../docs/sources/SRC-vibe-coding.md", import.meta.url);

// The schema of a register entry, as the module gives it.
const entrySchema = () => sourceSchemas().entry;

// The text of these lines, each ended by a line feed.
const linesOf = (...lines) => lines.map((line) => `${line}\n`).join("");

// ---------------------------------------------------------------- the entries

const SHA_2006 = "52ee955ca6c93192ddcd66803ab84f108824bdce218aea541d4633fcfd914991";
const SHA_AMD1 = "c624feca7f90ecf5b0ed0fe2b820c2e709cc6f4d5ac74da827eff8b91798f095";

// A restricted standard with its places, kept in a repository the person named; two versions, the files of each under a
// lower heading inside ## Versions, and ## Parts. Its licence names the words `may be republished` after its class.
const IEC_PATH = "docs/sources/SRC-iec-62304.md";
const IEC_VERSIONS = [
  "| Version | Date | Edition | Read from | Files |",                                                       // 19
  "|---|---|---|---|---|",                                                                                  // 20
  "| `2006` | 2006-05-09 | the first edition | — | 1 file, listed below |",                                 // 21
  "| `2006+AMD1:2015` | 2015-06-29 | the consolidated edition 1.1 | the IEC webstore, 2026-09-30 | 2 files, listed below |", // 22
  "",                                                                                                       // 23
  "### Files of `2006`",                                                                                    // 24
  "",                                                                                                       // 25
  "| File | SHA-256 |",                                                                                     // 26
  "|---|---|",                                                                                              // 27
  `| \`iec-62304-2006.pdf\` | \`${SHA_2006}\` |`,                                                           // 28
  "",                                                                                                       // 29
  "### Files of `2006+AMD1:2015`",                                                                          // 30
  "",                                                                                                       // 31
  "| File | SHA-256 |",                                                                                     // 32
  "|---|---|",                                                                                              // 33
  `| \`iec-62304-2006.pdf\` | \`${SHA_2006}\` |`,                                                           // 34
  `| \`iec-62304-amd1-2015.pdf\` | \`${SHA_AMD1}\` |`,                                                      // 35
  "",                                                                                                       // 36
];
const IEC_PARTS = [
  "| Part | Applies to |",                                                                                  // 39
  "|---|---|",                                                                                              // 40
  "| `class B` | software whose failure can lead to a non-serious injury |",                                // 41
];
const IEC = [
  "---",                                                                                                    // 1
  "id: SRC-iec-62304",                                                                                      // 2
  "title: IEC 62304",                                                                                       // 3
  "kind: standard",                                                                                         // 4
  "authority: normative",                                                                                   // 5
  "licence: restricted — the IEC's terms of use, under which only the abstract may be republished",         // 6
  "designation: IEC 62304:2006+AMD1:2015",                                                                  // 7
  "content_repository: https://gitlab.example.org/alice/standards",                                        // 8
  "places:",                                                                                                // 9 — a list,
  "  - this machine",                                                                                       // 10  one item
  "  - NHR@FAU, Erlangen",                                                                                  // 11  per line
  "---",                                                                                                    // 12
  "# SRC-iec-62304 IEC 62304",                                                                              // 13 — the body
  "",                                                                                                       // 14  begins here
  "The standard for the software life cycle of medical devices; its files lie in the repository the person named.", // 15
  "",                                                                                                       // 16
  "## Versions",                                                                                            // 17
  "",                                                                                                       // 18
  ...IEC_VERSIONS,                                                                                          // 19–36
  "## Parts",                                                                                               // 37
  "",                                                                                                       // 38
  ...IEC_PARTS,                                                                                             // 39–41
  "",
].join("\n");

const IEC_DOCUMENT = {
  kind: "source",
  path: IEC_PATH,
  id: "SRC-iec-62304",
  title: "SRC-iec-62304 IEC 62304",
  fields: {
    id: "SRC-iec-62304",
    title: "IEC 62304",
    kind: "standard",
    authority: "normative",
    licence: "restricted — the IEC's terms of use, under which only the abstract may be republished",
    designation: "IEC 62304:2006+AMD1:2015",
    content_repository: "https://gitlab.example.org/alice/standards",
    places: ["this machine", "NHR@FAU, Erlangen"],
  },
  sections: [
    { heading: "## Versions", line: 17, text: linesOf("", ...IEC_VERSIONS),
      rows: [
        { line: 21, cells: { Version: "`2006`", Date: "2006-05-09", Edition: "the first edition",
          Files: "1 file, listed below" } },
        { line: 22, cells: { Version: "`2006+AMD1:2015`", Date: "2015-06-29", Edition: "the consolidated edition 1.1",
          "Read from": "the IEC webstore, 2026-09-30", Files: "2 files, listed below" } },
      ] },
    { heading: "## Parts", line: 37, text: linesOf("", ...IEC_PARTS) },
  ],
  appended: [],
  body: IEC.slice(IEC.indexOf("# SRC-iec-62304 IEC 62304")),
};

// A register entry with these front matter lines after its id and title, and one version.
function entryText(id, title, front) {
  return [
    "---", `id: ${id}`, `title: ${title}`, ...front, "---",
    `# ${id} ${title}`, "",
    "## Versions", "",
    "| Version | Date | Edition | Read from | Files |",
    "|---|---|---|---|---|",
    "| `1` | 2026-10-01 | — | — | 1 file |",
    "",
  ].join("\n");
}

// Content that may be republished — whose entry also names a place.
const OPEN_HANDBOOK = entryText("SRC-open-handbook", "An open handbook",
  ["kind: document", "authority: advisory", "licence: may be republished — CC BY 4.0", "places:", "  - this machine"]);
// Restricted content that declares no place.
const CONTRACT = entryText("SRC-customer-contract", "The contract with the customer",
  ["kind: document", "authority: normative", "licence: restricted — confidential under the contract"]);
// Content whose licence is unknown, with a place.
const OLD_MANUAL = entryText("SRC-old-manual", "The old operating manual",
  ["kind: document", "authority: informational", "licence: unknown", "places:", "  - this machine"]);

// ---------------------------------------------------------------- sourceSchemas: where the schema is read from
//
// The module reads its own source.schema.md once, when it is loaded: from the disk where the platform offers
// `process.getBuiltinModule("node:fs")`, as Node does, and from its own address with `fetch` where it does not, as in a
// browser. Each case sets these two for one load of the module, loads it anew from its own address with a query of its own,
// `index.mjs?load=<n>`, and puts both back — as tests/spec-document-load.test.mjs loads MOD-spec-document. The real
// source.schema.md is read, never changed.

// One load of the module, anew: `disk` is what process.getBuiltinModule("node:fs") gives it — undefined, as in a browser —,
// `fetch` the browser's fetch. -> { module, error, reads } — the module's namespace, or the error its load failed with; and
// every read of the load, as "disk <address>" or "fetch <address>".
let loads = 0;
async function load({ disk, fetch }) {
  const saved = { getBuiltinModule: process.getBuiltinModule, fetch: globalThis.fetch };
  const reads = [];
  process.getBuiltinModule = (name) => (name === "node:fs" ? disk?.(reads) : saved.getBuiltinModule.call(process, name));
  globalThis.fetch = fetch ? (url) => { reads.push(`fetch ${url}`); return fetch(url); } : undefined;
  try {
    loads += 1;
    return { module: await import(new URL(`?load=${loads}`, MODULE)), error: null, reads };
  } catch (error) {
    return { module: null, error, reads };
  } finally {
    process.getBuiltinModule = saved.getBuiltinModule;
    globalThis.fetch = saved.fetch;
  }
}

// A disk that gives the real file's text for a read, noting each read.
const realDisk = (reads) => ({
  readFileSync: (url, encoding) => { reads.push(`disk ${url}`); return readFileSync(url, encoding); },
});

// TST-472935 · level: unit · module: MOD-source-register
// guards: UC-002
// given: the module loaded anew three times — (a) as in Node, with a disk that gives the real files; (b) as in a browser, without a disk, whose fetch answers the module's own address with the text of the real source.schema.md; (c) as in a browser whose fetch answers 404 Not Found
// input: (a), (b): sourceSchemas().entry, and readDocument with it of the entry IEC
// expect: (a) two reads from the disk, of src/source-register/source.schema.md, then links.schema.md; (b) both with fetch; each gives a schema deep-equal to the one of the module as this file loaded it, and reads IEC as the entry SRC-iec-62304 of the format `source`. (c) one read, of the same address; the module does not load — a schema that cannot be read stops its module (MOD-documents, loadSchema) — and the error names source.schema.md and 404
test("sourceSchemas — the entry's schema is read from the module's own source.schema.md: from the disk in Node, from its own address in a browser", async () => {
  const text = readFileSync(SCHEMA_FILE, "utf8");
  const onDisk = await load({ disk: realDisk });
  const atAddress = await load({ disk: undefined, fetch: async () => new Response(text, { status: 200 }) });
  for (const [where, loaded, read] of [["disk", onDisk, "disk"], ["address", atAddress, "fetch"]]) {
    assert.equal(loaded.error, null, `${where}: the module loads: ${loaded.error?.message}`);
    assert.deepEqual(loaded.reads, [`${read} ${SCHEMA_FILE.href}`, `${read} ${LINKS_FILE.href}`], where);
    const { entry } = loaded.module.sourceSchemas();
    assert.deepEqual(entry, entrySchema(), where);
    const iec = readDocument(entry, IEC_PATH, IEC);
    assert.deepEqual([iec.kind, iec.id], ["source", "SRC-iec-62304"], where);
  }
  const notServed = await load({ disk: undefined, fetch: async () => new Response("Not Found", { status: 404 }) });
  assert.deepEqual(notServed.reads, [`fetch ${SCHEMA_FILE.href}`]);
  assert.equal(notServed.module, null, "a schema that cannot be read stops the module");
  assert.ok(notServed.error instanceof Error && notServed.error.message.includes("source.schema.md")
    && notServed.error.message.includes("404"), `the error names source.schema.md and 404: ${notServed.error?.message}`);
});

// ---------------------------------------------------------------- sourceSchemas: a register entry read with its schema

// TST-472936 · level: unit · module: MOD-source-register
// guards: UC-002; A SOURCE DECLARES ITS LICENCE
// given: IEC — a register entry with every front matter key of the module file's Data but `identifier`; `places` a list of two, one of them holding a comma; ## Versions with two rows, one cell left out as —, and the files of each version under a lower heading inside the section; ## Parts
// input: readDocument(sourceSchemas().entry, "docs/sources/SRC-iec-62304.md", IEC)
// expect: exactly IEC_DOCUMENT — the format `source`; the identifier SRC-iec-62304; the title, the text of the first heading; every front matter value by its key, the licence as written, `places` a list of its two items; the sections ## Versions (line 17) and ## Parts (line 37), each with its text, the two ### headings inside ## Versions; the rows of ## Versions' first table by the columns Version, Date, Edition, Read from, Files, each with its line, the cell left out absent; no rows for ## Parts, whose text is kept as it stands; the body every byte after the front matter
test("sourceSchemas — a register entry read through MOD-documents with the entry's schema: its front matter, ## Versions, ## Parts", () => {
  assert.deepEqual(readDocument(entrySchema(), IEC_PATH, IEC), IEC_DOCUMENT);
});

// TST-472937 · level: unit · module: MOD-source-register
// guards: A SOURCE DECLARES ITS LICENCE; THE SOURCE KIND IS ONE OF A CLOSED SET; A SOURCE DECLARES ITS AUTHORITY; A STANDARD IS REGISTERED BY ITS DESIGNATION; A SOURCE VERSION IS NEVER OVERWRITTEN
// given: known positive first — IEC as read; then IEC as read with one change each: its licence left out; its kind `repository`, which is not among the seven; its authority `binding`, which is not among the three; its designation left out, while its kind is `standard`; its first version removed from ## Versions
// input: writeDocument(sourceSchemas().entry, the entry)
// expect: IEC written back byte for byte. Each change refused: DocumentError naming the field licence, kind, authority and designation; NotAppendable naming row 1 of ## Versions, line 21 — a version is never removed or changed
test("sourceSchemas — the entry's schema holds the module file's rules: a licence, the closed kinds, three authorities, a standard's designation, versions that only grow", () => {
  const read = () => readDocument(entrySchema(), IEC_PATH, IEC);
  assert.equal(writeDocument(entrySchema(), read()), IEC, "known positive: IEC as read is written back byte for byte");
  const fields = {
    licence: (d) => { delete d.fields.licence; },
    kind: (d) => { d.fields.kind = "repository"; },
    authority: (d) => { d.fields.authority = "binding"; },
    designation: (d) => { delete d.fields.designation; },
  };
  for (const [field, change] of Object.entries(fields)) {
    const entry = read();
    change(entry);
    assert.throws(() => writeDocument(entrySchema(), entry), (e) => e.name === "DocumentError" && e.field === field, field);
  }
  const entry = read();
  entry.sections[0].rows.shift();
  assert.throws(() => writeDocument(entrySchema(), entry),
    (e) => e.name === "NotAppendable" && e.section === "## Versions" && e.row === 1 && e.line === 21, "the first version removed");
});

// ---------------------------------------------------------------- permittedPlaces

// TST-472938 · level: unit · module: MOD-source-register
// guards: RESTRICTED CONTENT GOES ONLY WHERE ITS SOURCE PERMITS; A SOURCE DECLARES ITS LICENCE; UC-002
// given: four entries, each read with the entry's schema — OPEN_HANDBOOK, licence `may be republished — CC BY 4.0`, which also names the place `this machine`; IEC, licence `restricted — …, under which only the abstract may be republished`, places `this machine` and `NHR@FAU, Erlangen`; CONTRACT, licence `restricted — confidential under the contract`, no places; OLD_MANUAL, licence `unknown`, place `this machine`
// input: permittedPlaces(entry) of each
// expect: OPEN_HANDBOOK "any" — its place does not narrow content that may be republished; IEC its two places, in their order — its licence's class is its first word, `restricted`, whatever its terms say later; CONTRACT [], none; OLD_MANUAL ["this machine"] — `unknown` counts as restricted, so it gets its declared places, not any
test("permittedPlaces — four entries: may be republished, any; restricted with places, those; restricted with none, none; unknown, as restricted", () => {
  const read = (id, text) => readDocument(entrySchema(), `docs/sources/${id}.md`, text);
  assert.equal(permittedPlaces(read("SRC-open-handbook", OPEN_HANDBOOK)), "any");
  assert.deepEqual(permittedPlaces(read("SRC-iec-62304", IEC)), ["this machine", "NHR@FAU, Erlangen"]);
  assert.deepEqual(permittedPlaces(read("SRC-customer-contract", CONTRACT)), []);
  assert.deepEqual(permittedPlaces(read("SRC-old-manual", OLD_MANUAL)), ["this machine"]);
});

// TST-472939 · level: unit · module: MOD-source-register
// guards: RESTRICTED CONTENT GOES ONLY WHERE ITS SOURCE PERMITS; A SOURCE DECLARES ITS LICENCE; UC-002
// given: this instance's register entry docs/sources/SRC-vibe-coding.md as it stands, whose licence permits republishing
// input: readDocument(sourceSchemas().entry, "docs/sources/SRC-vibe-coding.md", its text); permittedPlaces of it
// expect: the entry SRC-vibe-coding, of kind `document`, licence `may be republished — CC BY 4.0`; its sections ## Versions and ## Parts, the ### heading of its files inside the first; its first version — which is never changed — read by the columns Version, Date, Edition, Read from, Files as the entry writes them; and permittedPlaces "any"
test("permittedPlaces — this instance's entry SRC-vibe-coding, whose licence permits republishing, permits any place", () => {
  const entry = readDocument(entrySchema(), "docs/sources/SRC-vibe-coding.md", readFileSync(VIBE_CODING, "utf8"));
  assert.deepEqual([entry.id, entry.fields.kind, entry.fields.licence],
    ["SRC-vibe-coding", "document", "may be republished — CC BY 4.0"]);
  assert.deepEqual(entry.sections.map((section) => section.heading), ["## Versions", "## Parts"]);
  assert.ok(entry.sections[0].text.includes("\n### Files of 2026-10-05\n"), "the ### heading of its files stays in ## Versions");
  assert.deepEqual(entry.sections[0].rows[0].cells, {
    Version: "`2026-10-05`",
    Date: "2026-10-05",
    Edition: "the manuscript before publication, in Markdown",
    "Read from": "`out/vhb-vibe-coding/` of the repository `lectures/TeachingMD` on `git5.cs.fau.de`, commit "
      + "`d26da6d2061be147a2ba0721bbd7899db5eb44ac`",
    Files: "the 17 chapters below; version hash `d4dff41c996d8a3f00c2b9323fc36bbeeb608bbbedd0ff301b2c8ac13ca667b3`",
  });
  assert.equal(permittedPlaces(entry), "any");
});

// TST-1429038 · level: unit · module: MOD-source-register
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES
// given: the paths of a tree — the SPEC, the links file docs/sources.md, three register entries (docs/sources/SRC-z.md, SRC-a.md, SRC-vibe-coding.md) in a mixed order, a README, a .bak file and a nested file in docs/sources/
// input: registerPaths(those paths); then registerPaths([])
// expect: the three entries, in the order given — no README, no nested file, no .bak, not the links file; [] for no paths. No request is made.
test("TST-1429038: registerPaths — the register's entries among a tree's paths, in their order", () => {
  const paths = ["SPEC.md", "docs/sources/SRC-z.md", "docs/sources.md", "docs/sources/README.md", "docs/sources/SRC-a.md",
    "docs/sources/SRC-a.md.bak", "docs/sources/SRC-vibe-coding/2026-10-05/01.md", "docs/sources/SRC-vibe-coding.md"];
  assert.deepEqual(register.registerPaths(paths), ["docs/sources/SRC-z.md", "docs/sources/SRC-a.md", "docs/sources/SRC-vibe-coding.md"]);
  assert.deepEqual(register.registerPaths([]), []);
});
