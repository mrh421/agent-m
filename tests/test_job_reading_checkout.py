# Module: MOD-source-register
# Guards: A JOB IN A CHECKOUT OF THE INSTANCE READS THE CHAPTERS THERE; A REQUIREMENTS JOB RECEIVES THE CHAPTER ON REQUIREMENTS ENGINEERING; A TEST JOB RECEIVES THE CHAPTER ON TESTING; AN ARCHITECTURE JOB RECEIVES THE CHAPTERS ON MODELING, ARCHITECTURE, DESIGN AND IMPLEMENTATION; AN IMPLEMENTATION JOB RECEIVES THE CHAPTERS ON MODELING, DESIGN, IMPLEMENTATION AND TESTING
# Level: release
"""ITM-417: SPEC's release check for chapter input when a job runs in an instance checkout.

The cases live in tests/test_job_reading_checkout.md. This file is only the loader and adapter: it builds a temporary
checkout fixture, asks MOD-job-runner to prepare jobs through MOD-source-register's real chapter recipes, and compares
the returned paths with the source register's recorded chapter hashes.
"""
import hashlib
import json
import re
import shutil
import tempfile
import unittest
from pathlib import Path

from jsrun import js

ROOT = Path(__file__).resolve().parent.parent
DATA = Path(__file__).with_suffix(".md")
ENTRY = ROOT / "docs" / "sources" / "SRC-vibe-coding.md"
SOURCE = "SRC-vibe-coding"
COMMIT = "abc123def4567890abc123def4567890abc123de"

JS_CHECK = """
const fs = process.getBuiltinModule("node:fs");
const checkout = %s;
const commit = %s;
const read = async (path) => {
  try { return fs.readFileSync(`${checkout}/${path}`, "utf8"); } catch { return null; }
};
const snapshot = { repository: { server: "github", origin: "https://github.com", path: "akmaier/agent-m",
  web: "https://github.com/akmaier/agent-m" }, ref: "main", commit, paths: [], read, blob: () => null };
jobRunner.registerStrategies("MOD-source-register", { recipes: Object.fromEntries(
  Object.entries(sourceRegister.sourceStrategies.recipes).filter(([name]) => name.startsWith("chapters-for-"))) });
const empty = { recipes: async () => [], preconditions: async () => null, checks: () => [],
  steps: async (draft) => ({ draft, findings: [] }),
  writers: async () => ({ commits: [], files: [], pullRequest: null, shown: null, notes: [] }) };
const named = (kind) => ({ preconditions: kind.preconditions, recipes: kind.recipes.map((recipe) => recipe.name),
  checks: kind.checks, steps: kind.steps, writers: [kind.writer] });
for (const name of await jobCatalogue.kindNames()) {
  const kind = await jobCatalogue.kindOf(name);
  for (const [category, list] of Object.entries(named(kind))) for (const strategy of list) {
    try { jobRunner.registerStrategies("tests/test_job_reading_checkout.py", { [category]: { [strategy]: empty[category] } }); }
    catch (error) { if (error.name !== "DuplicateStrategy") throw error; }
  }
}
const drafter = { name: "reader", type: "CLI agent", model: "a-model", context: 10000000, price: null,
  capabilities: ["draft text", "read the repository", "write to the repository", "run code and tests", "use tools",
  "reach the web"], place: "this machine", route: "bridge lab-pc agent codex" };
async function prepare(kindName) {
  const kind = await jobCatalogue.kindOf(kindName);
  const context = { kind, params: {}, product: { address: "https://github.com/akmaier/agent-m", snapshot, host: null },
    instance: { snapshot, host: null, checkout }, connect: async () => null, participants: [drafter],
    places: { sources: {}, mailbox: null }, gates: [], person: null, now: new Date("2026-10-13T09:00:00Z"),
    agentM: { version: "unreleased", commit }, jobId: null };
  try {
    const job = await jobRunner.prepareJob(kindName, context, { drafter: kind.participant === "one" ? drafter : null, reviewers: [] });
    const parts = [];
    for (const part of job.parts.filter((each) => each.sources.includes("SRC-vibe-coding"))) {
      const bytes = fs.readFileSync(part.text);
      parts.push({ recipe: part.recipe, name: part.name, text: part.text,
        sha256: await textTools.sha256(bytes), isFile: fs.statSync(part.text).isFile() });
    }
    return { ok: true, parts };
  } catch (error) {
    return { ok: false, error: error.name, file: error.file ?? null, message: error.message };
  }
}
return await prepare(%s);
"""


def fenced(body: str, heading: str) -> str:
    match = re.search(rf"^### {re.escape(heading)}\n\n```[a-z]*\n(.*?)\n```", body, re.M | re.S)
    if not match:
        raise AssertionError(f"missing fenced block under {heading}")
    return match.group(1)


def cases() -> list[dict]:
    text = DATA.read_text(encoding="utf-8")
    found = []
    for match in re.finditer(r"^## (?P<name>[^\n]+)\n(?P<body>.*?)(?=^## |\Z)", text, re.M | re.S):
        found.append({"name": match.group("name"), "case": json.loads(fenced(match.group("body"), "Case"))})
    if not found:
        raise AssertionError("no cases loaded")
    return found


def version() -> str:
    rows = re.findall(r"^\| `([^`]+)` \| \d{4}-\d{2}-\d{2} \|", ENTRY.read_text(encoding="utf-8"), re.MULTILINE)
    if not rows:
        raise AssertionError("SRC-vibe-coding records no version")
    return rows[-1]


def registered_chapters() -> dict[int, dict]:
    text = ENTRY.read_text(encoding="utf-8")
    found = {}
    for name, digest in re.findall(r"^\| `(\d\d_[^`]+)` \| `([0-9a-f]{64})` \|", text, re.MULTILINE):
        found[int(name[:2])] = {"name": name, "sha256": digest}
    if not {8, 9, 10, 11, 12, 13} <= set(found):
        raise AssertionError("SRC-vibe-coding lacks a required chapter record")
    return found


def checkout(corrupt: str | None):
    tmp = tempfile.TemporaryDirectory()
    root = Path(tmp.name)
    source_dir = root / "docs" / "sources" / SOURCE
    shutil.copytree(ENTRY.parent / SOURCE, source_dir)
    register = root / "docs" / "sources"
    register.mkdir(parents=True, exist_ok=True)
    shutil.copy2(ENTRY, register / f"{SOURCE}.md")
    if corrupt:
        target = source_dir / version() / corrupt
        target.write_text(target.read_text(encoding="utf-8") + "\nchanged for the release-test counter-proof\n", encoding="utf-8")
    return tmp


def result(kind: str, checkout_path: Path) -> dict:
    return js(JS_CHECK % (json.dumps(str(checkout_path)), json.dumps(COMMIT), json.dumps(kind)))


class TestJobReadingCheckout(unittest.TestCase):
    # TST-417100 · level: release · module: MOD-source-register
    # guards: A JOB IN A CHECKOUT OF THE INSTANCE READS THE CHAPTERS THERE; A REQUIREMENTS JOB RECEIVES THE CHAPTER ON REQUIREMENTS ENGINEERING; A TEST JOB RECEIVES THE CHAPTER ON TESTING; AN ARCHITECTURE JOB RECEIVES THE CHAPTERS ON MODELING, ARCHITECTURE, DESIGN AND IMPLEMENTATION; AN IMPLEMENTATION JOB RECEIVES THE CHAPTERS ON MODELING, DESIGN, IMPLEMENTATION AND TESTING
    # given: Markdown fixture cases, a temporary checkout of the instance with SRC-vibe-coding's register entry and chapter files, and real MOD-source-register chapter recipes
    # input: prepareJob for every listed job kind with context.instance.checkout naming the checkout
    # expect: each SRC-vibe-coding part is the path of its chapter file in the checkout, and that file's SHA-256 equals the source register's recorded hash
    # TST-584024 · level: release · module: MOD-source-register
    # guards: A JOB IN A CHECKOUT OF THE INSTANCE READS THE CHAPTERS THERE; A REQUIREMENTS JOB RECEIVES THE CHAPTER ON REQUIREMENTS ENGINEERING; A TEST JOB RECEIVES THE CHAPTER ON TESTING; AN ARCHITECTURE JOB RECEIVES THE CHAPTERS ON MODELING, ARCHITECTURE, DESIGN AND IMPLEMENTATION; AN IMPLEMENTATION JOB RECEIVES THE CHAPTERS ON MODELING, DESIGN, IMPLEMENTATION AND TESTING
    # given: Markdown fixture cases, a temporary checkout of the instance with SRC-vibe-coding's register entry and chapter files, and real MOD-source-register chapter recipes
    # input: prepareJob for every listed job kind with context.instance.checkout naming the checkout
    # expect: each SRC-vibe-coding part is the path of its chapter file in the checkout, and that file's SHA-256 equals the source register's recorded hash
    def test_jobs_in_a_checkout_receive_chapter_paths_with_recorded_hashes(self):
        case = next(item["case"] for item in cases() if item["case"]["expected"]["ok"])
        chapters = registered_chapters()
        version_name = version()
        with checkout(case["input"]["corrupt"]) as tmp:
            checkout_path = Path(tmp)
            for work, spec in case["input"]["work"].items():
                expected = {chapter: chapters[chapter] for chapter in spec["chapters"]}
                for kind in spec["kinds"]:
                    with self.subTest(work=work, kind=kind):
                        got = result(kind, checkout_path)
                        self.assertTrue(got["ok"], got)
                        by_chapter = {}
                        for part in got["parts"]:
                            numbers = [number for number, chapter in expected.items() if chapter["name"] in part["name"]]
                            self.assertEqual(len(numbers), 1, f"{kind}: part {part['name']} names one expected chapter")
                            number = numbers[0]
                            wanted_path = checkout_path / "docs" / "sources" / SOURCE / version_name / expected[number]["name"]
                            self.assertEqual(Path(part["text"]), wanted_path)
                            self.assertTrue(part["isFile"])
                            self.assertEqual(part["sha256"], expected[number]["sha256"])
                            by_chapter[number] = part["sha256"]
                        self.assertEqual(by_chapter, {number: chapter["sha256"] for number, chapter in expected.items()})

    # TST-417101 · level: release · module: MOD-source-register
    # guards: A JOB IN A CHECKOUT OF THE INSTANCE READS THE CHAPTERS THERE
    # given: a temporary checkout of the instance whose chapter 13 file differs from the hash recorded in SRC-vibe-coding.md
    # input: prepareJob for write-tests with context.instance.checkout naming that checkout
    # expect: preparation fails before anything is sent, with HashMismatch naming 13_software-testing.md
    # TST-584025 · level: release · module: MOD-source-register
    # guards: A JOB IN A CHECKOUT OF THE INSTANCE READS THE CHAPTERS THERE
    # given: a temporary checkout of the instance whose chapter 13 file differs from the hash recorded in SRC-vibe-coding.md
    # input: prepareJob for write-tests with context.instance.checkout naming that checkout
    # expect: preparation fails before anything is sent, with HashMismatch naming 13_software-testing.md
    def test_a_changed_chapter_file_in_the_checkout_is_refused_by_name(self):
        case = next(item["case"] for item in cases() if not item["case"]["expected"]["ok"])
        with checkout(case["input"]["corrupt"]) as tmp:
            got = result(case["input"]["kind"], Path(tmp))
        self.assertEqual(got["ok"], False)
        self.assertEqual(got["error"], case["expected"]["error"])
        self.assertEqual(got["file"], case["expected"]["file"])


if __name__ == "__main__":
    unittest.main()
