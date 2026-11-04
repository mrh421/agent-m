# Module: MOD-approvals
# Guards: ACCEPTANCE IS A COMMIT BY THE ACCEPTING PERSON; AN APPROVAL NAMES THE EXACT TEXT; THE NAME IS THE ID AND IT SURVIVES
# Level: unit
"""SPEC §10 ACCEPTANCE IS A COMMIT BY THE ACCEPTING PERSON · AN APPROVAL NAMES THE EXACT TEXT.

That the applier (MOD-spec-changes' applyApproved) passes over architecture records is checked in
tests/test_apply_approvals.py.

The records are checked by MOD-approvals, asked of node the way tests/test_progress_derived.py does: its
approvalSchema read with MOD-documents' readDocument, documentFindings and writeDocument, and its statuses for the reviewed
file a record names — whether it exists under the identifier the file's name gives, and of which kind it is.
"""
import json
import subprocess
import unittest
from pathlib import Path

from artifact_checks import DOCS, ROOT

FIXTURE = Path(__file__).resolve().parent / "fixtures" / "architecture"
ARC_FILE = "docs/architecture/ARC-001-static-client.md"
MOD_FILE = "docs/architecture/MOD-reader.md"

# The problems of each record, for a list of [name, text, root] — the name of the record, its text, the root of the tree whose
# reviewed files it names —, given to node on its standard input: a list of the problems each record has, empty for a sound one.
CHECK = r"""
const approvals = await import(__APPROVALS__), documents = await import(__DOCUMENTS__);
const { readFileSync, readdirSync, existsSync } = await import("node:fs");
const { join, basename, dirname } = await import("node:path");
const schema = approvals.approvalSchema;
const trees = {};
const tree = (root) => trees[root] ??= approvals.statuses({
  paths: ["docs/use-cases", "docs/architecture", "docs/tests/releases"].flatMap((dir) =>
    existsSync(join(root, dir)) ? readdirSync(join(root, dir)).filter((f) => f.endsWith(".md")).map((f) => `${dir}/${f}`) : []),
  blob: () => null });
process.stdout.write(JSON.stringify(JSON.parse(readFileSync(0, "utf8")).map(([name, text, root]) => {
  const doc = documents.readDocument(schema, `docs/approvals/${name}`, text), f = doc.fields, p = [];
  const problem = (what) => p.push(`${name}: ${what}`);
  for (const found of documents.documentFindings(schema, doc)) problem(found.what);
  try { documents.writeDocument(schema, { fields: f }); } catch (e) { problem(e.message); }
  if (typeof f.blob === "string" && f.blob && !name.includes(f.blob.slice(0, 12))) problem("file name does not carry the blob prefix");
  if (f.kind === "spec") {
    // A record of a queue the tree no longer holds names a proposal the history keeps (THE REPLACED TEXT STAYS REACHABLE), as applyApproved leaves it alone.
    if (f.proposal && f.queue && existsSync(join(root, f.queue)) && !existsSync(join(root, f.proposal))) problem(`${f.proposal} does not exist`);
  } else if (typeof f.file === "string" && f.file) {
    const held = [...tree(root)].filter(([path]) => dirname(path) === dirname(f.file));
    const own = held.find(([path]) => path === f.file) ?? held.find(([, e]) =>
      basename(f.file) === `${e.id}.md` || (!e.id.startsWith("MOD-") && basename(f.file).startsWith(`${e.id}-`)));
    if (!own) problem(`${f.file} does not exist`);
    else if (own[1].kind !== f.kind) problem(`${f.file} is not the file of a ${f.kind}`);
    else if (f.kind !== "use-case" && !name.startsWith(`${own[1].id}-`)) problem(`the record's name does not start with the identifier ${own[1].id}`);
  }
  return p;
})));
"""


def problems(cases) -> list:
    code = (CHECK.replace("__APPROVALS__", json.dumps((ROOT / "src" / "approvals" / "index.mjs").as_uri()))
            .replace("__DOCUMENTS__", json.dumps((ROOT / "src" / "documents" / "index.mjs").as_uri())))
    r = subprocess.run(["node", "--input-type=module", "-e", code], input=json.dumps([[n, t, str(root)] for n, t, root in cases]),
                       capture_output=True, text=True)
    if r.returncode != 0:
        raise AssertionError(r.stderr.strip()[-1500:])
    return json.loads(r.stdout)


def record_problems(name: str, text: str, root: Path = ROOT) -> list:
    return problems([(name, text, root)])[0]


GOOD_UC = "kind: use-case\nfile: docs/use-cases/{f}\nblob: " + "a" * 40 + "\n"


class ApprovalRecords(unittest.TestCase):
    def test_every_record_is_well_formed(self):
        records = [f for f in sorted((DOCS / "approvals").glob("*.md")) if f.name != "README.md"]
        found = problems([(f.name, f.read_text(encoding="utf-8"), ROOT) for f in records])
        self.assertEqual([p for each in found for p in each], [])

    def test_counter_proof(self):
        uc = sorted((DOCS / "use-cases").glob("UC-*.md"))[0].name
        good = GOOD_UC.format(f=uc)
        self.assertEqual(record_problems("UC-x-" + "a" * 12 + ".md", good), [])
        for name, text in {
            "a.md": good,                                                   # no blob prefix in name
            "x-" + "a" * 12 + ".md": good.replace("kind: use-case", "kind: other"),
            "y-" + "a" * 12 + ".md": good.replace(uc, "UC-999-missing.md"),
            "z-" + "a" * 12 + ".md": good.replace("a" * 40, "a" * 39),
            "w-" + "a" * 12 + ".md": good.replace(uc, uc[:7] + "renamed-away.md").replace("UC-", "UC-9", 1),
        }.items():
            self.assertTrue(record_problems(name, text), name)

    def test_a_record_of_a_renamed_use_case_stays_valid(self):
        # A record names the file as it was called when it was accepted; a use case keeps its ID when
        # its file is renamed (UC-010: run-a-stage → run-a-job), so the record still names that use case.
        uc = sorted((DOCS / "use-cases").glob("UC-*.md"))[0].name
        old_name = uc[:7] + "an-earlier-name.md"
        self.assertEqual(record_problems("UC-x-" + "a" * 12 + ".md", GOOD_UC.format(f=old_name)), [])
        # Counter-proof: no use case with that ID exists any more.
        self.assertTrue(record_problems("UC-x-" + "a" * 12 + ".md", GOOD_UC.format(f="UC-999-an-earlier-name.md")))


    def test_records_of_architecture_decisions_and_modules(self):
        # Same three lines as a use case's record; the kind says which, the file name carries the identifier.
        arc = "kind: architecture-decision\nfile: " + ARC_FILE + "\nblob: " + "a" * 40 + "\n"
        mod = "kind: module\nfile: " + MOD_FILE + "\nblob: " + "b" * 40 + "\n"
        self.assertEqual(record_problems("ARC-001-" + "a" * 12 + ".md", arc, FIXTURE), [])
        self.assertEqual(record_problems("MOD-reader-" + "b" * 12 + ".md", mod, FIXTURE), [])
        # A decision's file renamed since keeps its identifier (THE NAME IS THE ID AND IT SURVIVES).
        self.assertEqual(record_problems("ARC-001-" + "a" * 12 + ".md",
                                         arc.replace("static-client", "an-earlier-name"), FIXTURE), [])
        for name, text in {
            "ARC-001-" + "a" * 12 + ".md#kind": arc.replace("architecture-decision", "module"),       # kind and file disagree
            "MOD-reader-" + "b" * 12 + ".md#kind": mod.replace("kind: module", "kind: use-case"),
            "ARC-001-" + "a" * 12 + ".md#gone": arc.replace("ARC-001-static-client", "ARC-009-static-client"),
            "MOD-reader-" + "b" * 12 + ".md#gone": mod.replace("MOD-reader", "MOD-writer"),
            "MOD-other-" + "b" * 12 + ".md": mod,                                                       # name carries another id
            "MOD-reader.md": mod,                                                                       # no blob prefix
            "ARC-001-" + "a" * 12 + ".md#file": arc.replace("file: ", "path: "),
        }.items():
            self.assertTrue(record_problems(name.split("#")[0], text, FIXTURE), name)



if __name__ == "__main__":
    unittest.main()
