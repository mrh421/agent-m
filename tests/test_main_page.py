# Module: MOD-main-page
# Guards: THE MAIN PAGE SHOWS WHAT GOES ON IN THE INSTANCE; THE MENU FOLLOWS THE PROCESS; THE MAIN PAGE SHOWS EACH PRODUCT'S PROGRESS BY STAGE; WITHOUT A PRODUCT, THE MAIN PAGE SHOWS AGENT M'S OWN PROGRESS; THE BUILD IS SHOWN AS IT HAPPENS
# Level: unit
"""SPEC §10 — the main page at the root of the instance's site (UC-046).

The root starts MOD-site-frame with MOD-main-page's View; its progress facts are MOD-progress-measures' public facts and
its menu is MOD-site-frame's menuOf. The fixture product is tests/fixtures/main-page/: a SPEC
of three requirements — one guarded by a test file that is there, one by a test file that is not, one at review —, one
decided SPEC change entry, four use cases of which three are accepted, an implementation plan of two steps, and one job
working on the first step. Its tree is computed here as git computes it: every file with its blob SHA. Node reads the files
itself, by path, from the fixture folder. Counter-proofs: docs/measurements/2026-10-05_main-page.md."""
import hashlib
import json
import re
import unittest
from pathlib import Path

from jsrun import js

TESTS = Path(__file__).resolve().parent
ROOT = TESTS.parent
FIX = TESTS / "fixtures" / "main-page"
PROCESS = ["Requirements", "Use cases", "Architecture", "Implementation", "Tests", "Releases", "Maintenance", "Settings"]
JOB = "docs/jobs/JOB-20261005-0900-a1b2.md"
NOW = "2026-10-05T10:30:00Z"


def blob(data: bytes) -> str:
    return hashlib.sha1(b"blob %d\0" % len(data) + data).hexdigest()


TREE = [{"path": p.relative_to(FIX).as_posix(), "sha": blob(p.read_bytes())} for p in sorted(FIX.rglob("*")) if p.is_file()]
UC4 = next(e for e in TREE if e["path"].startswith("docs/use-cases/UC-004-"))
UC4_RECORD = f"docs/approvals/UC-004-{UC4['sha'][:12]}.md"
JOB_ENDED = "native-ended-job"


def pr(number, item, state="open", merged_at=None):
    """A pull request in the shape of the git host's pullRequests, naming `item` in its head branch."""
    return {"number": number, "title": f"{item}: the work", "branch": f"job/{item}", "head": f"job/{item}", "base": "main", "state": state,
            "opened": "2026-10-05T09:05:00.000Z", "openedAt": "2026-10-05T09:05:00.000Z", "mergedAt": merged_at, "mergeCommit": None, "participantLine": None, "ci": None}


def facts(*, extra_paths=(), texts=None, prs=(), ci="passed", tags=(), own=False, live=False) -> str:
    """A node expression that binds `f` to MOD-progress-measures' public productFacts. extra_paths: paths added to the
    snapshot (a record planted for the counter-proof); texts: { path: text } read instead of the fixture's file."""
    tree = TREE + [{"path": p, "sha": "0" * 40} for p in extra_paths]
    return ("const fs = await import('node:fs');"
            "const RealDate = globalThis.Date; class FixtureDate extends RealDate { constructor(...given) { super(...(given.length ? given : ['2026-10-05T10:30:00Z'])); } static now() { return RealDate.parse('2026-10-05T10:30:00Z'); } }; globalThis.Date = FixtureDate;"
            f"const FIX = {json.dumps(str(FIX))}; const tree = {json.dumps(tree)}; const over = {json.dumps(texts or {})};"
            f"const outcome = {json.dumps('passed' if ci == 'passed' else 'failed')}; const commit = 'a'.repeat(40);"
            "const processText = '---\\nmodel: scrum\\nmodel_file: src/model-catalogue/models/scrum.md\\nmodel_version: 0000000000000000000000000000000000000000\\n---\\n# Process\\n\\n## Practices\\n\\n- none\\n\\n## Branches\\n\\n| Phase or time box | Branch |\\n|---|---|\\n| Sprint | sprint/<team>/<nn> |\\n';"
            "const testText = '# TST-000001 · level: unit · module: MOD-reader\\n# guards: THE READER READS\\n';"
            "const text = async (p) => p === 'docs/process.md' ? processText : p === 'tests/test_reader.py' ? testText : p in over ? over[p] : tree.some((e) => e.path === p) ? fs.readFileSync(FIX + '/' + p, 'utf8') : null;"
            f"const address = {json.dumps('https://github.com/fixture/agent-m' if own else 'https://github.com/fixture/product')};"
            "const snapshot = { repository: { web: address }, commit, paths: tree.map((e) => e.path),"
            " blob: (p) => tree.find((e) => e.path === p)?.sha ?? null, read: text, readMany: async () => [] };"
            "const resultPath = `runs/${commit}/20261005-1030-commit-0001.md`;"
            "const resultText = `---\\ncommit: ${commit}\\nlevels:\\n  - unit\\noccasion: commit\\nparticipant: fixture\\ndate: 2026-10-05 10:30 UTC\\n---\\n## Outcomes\\n\\n| Test | Level | Outcome | Runs |\\n|---|---|---|---|\\n| TST-000001 | unit | ${outcome} | |\\n`;"
            "const results = { paths: [resultPath], read: async (p) => p === resultPath ? resultText : null };"
            "const jobStart = () => jobLedger.startRecord({ id: 'JOB-20261005-0900-a1b2', kind: 'implement-item', worksOn: ['ITM-201'], participant: 'coder-a', model: 'fixture-model', route: 'bridge fixture', run: null, retries: null, startedBy: 'fixture', start: new Date(Date.now() - 5400 * 1000), agentM: { version: 'fixture', commit: '0'.repeat(40) }, inputs: [], limit: 1, task: 'in parameters', conversation: null, destinations: [], params: {} }).text;"
            "const runningJob = () => jobLedger.appendToRecord(jobStart(), { part: 'taken', at: new Date(Date.now() - 5400 * 1000), by: 'fixture' });"
            "const endedJob = () => jobLedger.appendToRecord(runningJob(), { part: 'end', at: new Date(), state: 'done', results: [], draft: null, rounds: [], usage: null, cost: { known: false, usage: null }, reason: null, log: null });"
            "const instance = { repository: { web: 'https://github.com/fixture/agent-m' }, paths: ['SPEC.md', 'src/model-catalogue/models/scrum.md'],"
            " blob: (p) => p === 'src/model-catalogue/models/scrum.md' ? '1'.repeat(40) : null,"
            f" read: async (p) => p === 'src/model-catalogue/models/scrum.md' ? fs.readFileSync({json.dumps(str(ROOT))} + '/' + p, 'utf8') : null, readMany: async () => [] }};"
            f"const fixtureText = text; const textOf = async (p) => p === {json.dumps(JOB)} ? (p in over && over[p] === 'native-ended-job' ? endedJob() : runningJob()) : fixtureText(p);"
            "snapshot.read = textOf;"
            f"const host = {{ repositoryInfo: async () => ({{ defaultBranch: 'main' }}), readSnapshot: async (ref) => ref === 'test-results' ? results : snapshot, pullRequests: async () => {json.dumps(list(prs))}, listPullRequests: async () => {json.dumps(list(prs))}, listTags: async () => {json.dumps([{'name': tag} for tag in tags])}, readHistory: async () => [{{ commit, date: '2026-10-05T10:00:00Z' }}], readFileAt: async (path, commits) => new Map(commits.map((c) => [c, processText])), listCiRuns: async () => [] }};"
            "const f = await progressMeasures.productFacts(host, instance, async () => instance, new Date('2026-10-05T10:30:00Z'), { scope: 'all' });"
            + ("f.jobs = await jobLedger.listJobs([{ address, snapshot }], new Map([['JOB-20261005-0900-a1b2', { reachable: true, reason: null, known: true, running: true, cancelling: false, log: null, usage: null, writtenAfterCancel: [] }]]));" if live else "")
            + "globalThis.Date = RealDate;")


def stages(**kw) -> dict:
    return {s["stage"].lower().replace(" ", "-"): s for s in js(facts(**kw) + "return progressMeasures.stageShares(f);")}


def card(**kw) -> dict:
    """The product's card as the main page shows it."""
    return js(facts(**kw) + f"const {{ installPage }} = await import({json.dumps((TESTS / 'site-frame-start.d' / 'dom.mjs').as_uri())});"
                            "installPage({ hostname: 'fixture.github.io', pathname: '/' }); const shares = await progressMeasures.stageShares(f);"
                            "const card = mainPageCards.productCard({ title: 'fixture/product', address: 'https://github.com/fixture/product',"
                            "model: f.model?.name ?? null, shares, current: progressMeasures.currentStage(shares), build: progressMeasures.buildInProgress(f), own: false });"
                            "return { text: card.textContent, current: card.getElementsByTagName('li').filter((row) => row.className.includes('is-current')).map((row) => row.getAttribute('data-stage')) };")


def text_of(html: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", html)).strip()


def labels(html: str) -> list:
    """The labels of a menu's entries, in the order they stand."""
    return [text_of(m[1]) for m in re.findall(r"<(a|span)\b[^>]*\bdata-entry=\"[^\"]+\"[^>]*>(.*?)</\1>", html, re.S)]


def rendered_main_menu() -> list:
    """The actual Frame render of MOD-main-page's View, on the existing fixture DOM."""
    return js(f"const {{ all, installPage, offline }} = await import({json.dumps((TESTS / 'site-frame-start.d' / 'dom.mjs').as_uri())});"
              f"const {{ openStore }} = await import({json.dumps((ROOT / 'src' / 'browser-store' / 'index.mjs').as_uri())});"
              "installPage({ hostname: 'fixture.github.io', pathname: '/agent-m/' }); offline(); openStore('fixture/agent-m');"
              "globalThis.setInterval = () => 1; await siteFrame.startPage({ page: 'main', views: [mainPage.view] });"
              "return all(document.body, 'nav')[0].children.map((entry) => ({ name: entry.localName, label: entry.textContent, href: entry.getAttribute('href'), key: entry.getAttribute('data-entry') }));")


def rendered_review_menu() -> list:
    """The Frame's rendered review menu keeps unbuilt entries as names, not links."""
    return js(f"const {{ all, installPage, offline }} = await import({json.dumps((TESTS / 'site-frame-start.d' / 'dom.mjs').as_uri())});"
              f"const {{ openStore }} = await import({json.dumps((ROOT / 'src' / 'browser-store' / 'index.mjs').as_uri())});"
              "installPage({ hostname: 'fixture.github.io', pathname: '/agent-m/docs/index.html' }); offline(); openStore('fixture/agent-m');"
              "globalThis.setInterval = () => 1; const route = { name: 'use-cases', entry: 'use-cases', title: 'Use cases', render: async (target) => { target.textContent = 'Use cases'; } };"
              "await siteFrame.startPage({ page: 'review', views: [{ routes: [route], strategies: [] }] });"
              "return all(document.body, 'nav')[0].children.map((entry) => ({ name: entry.localName, label: entry.textContent, href: entry.getAttribute('href'), key: entry.getAttribute('data-entry') }));")


def rendered_home(products=True, hash="") -> dict:
    """The root's actual Frame entry and MainPage view with the repository's existing test-owned browser and GitHub server, at the route `hash` names (the route home where it names none)."""
    return js(f"const {{ all }} = await import({json.dumps((TESTS / 'site-frame-start.d' / 'dom.mjs').as_uri())});"
              f"const {{ browser, cardsOf, waitsOf, network, smallProduct, instanceFiles, INSTANCE, PRODUCT, PRODUCT_URL, timers }} = await import({json.dumps((TESTS / 'main-page-home-harness.mjs').as_uri())});"
              f"const {{ store }} = browser({{ products: {json.dumps(['https://github.com/alice/product'] if products else [])} }}); const net = network({{ [PRODUCT]: smallProduct(), [INSTANCE]: instanceFiles() }}); net.install(); timers.install();"
              f"location.hash = {json.dumps(hash)};"
              "globalThis.setInterval = () => 1; try { await siteFrame.startPage({ page: 'main', views: [mainPage.view] }); const target = all(document.body, 'main')[0];"
              "return { cards: cardsOf(target).map((card) => card.textContent), waits: waitsOf(target) }; } finally { timers.restore(); net.restore(); }")


class TheMenuFollowsTheProcess(unittest.TestCase):
    def assert_follows_process(self, entries):
        self.assertEqual([e.replace("⚙", "").strip() for e in entries], PROCESS)

    def test_the_menu_lists_the_stages_in_the_order_of_the_process(self):
        self.assert_follows_process(js("return siteFrame.menuOf('main', []).map((e) => e.label);"))

    def test_the_rendered_menu_stands_in_the_same_order(self):
        self.assert_follows_process([entry["label"] for entry in rendered_main_menu()])

    def test_counter_proof_a_menu_with_two_stages_swapped_fails(self):
        swapped = js("const m = siteFrame.menuOf('main', []).map((e) => e.label); [m[1], m[2]] = [m[2], m[1]]; return m;")
        with self.assertRaises(AssertionError):
            self.assert_follows_process(swapped)

    def test_a_stage_whose_page_is_built_links_to_it_and_one_not_built_is_named_without_a_link(self):
        entries = rendered_review_menu()
        self.assertEqual(next(e for e in entries if e["key"] == "use-cases")["href"], "#use-cases")
        self.assertIsNone(next(e for e in entries if e["key"] == "tests")["href"])

    def test_the_main_page_and_the_review_pages_carry_the_menu(self):
        self.assertRegex((ROOT / "index.html").read_text(encoding="utf-8"),
                         r'<script type="module" src="src/site-frame/start\.mjs" data-page="main" data-views="main-page">')
        self.assertRegex((ROOT / "docs/index.html").read_text(encoding="utf-8"), r'<nav [^>]*id="tabs"')


class TheMainPageShowsWhatGoesOnInTheInstance(unittest.TestCase):
    def test_the_root_of_the_site_is_the_main_page(self):
        html = (ROOT / "index.html").read_text(encoding="utf-8")
        self.assertRegex(html, r'<script type="module" src="src/site-frame/start\.mjs" data-page="main" data-views="main-page"></script>')
        self.assertNotRegex(html, r'src/home/home\.mjs|src/home/home\.css')
        self.assertEqual(len(rendered_home()["cards"]), 1)

    def test_what_waits_for_a_person_is_listed_with_the_page_where_it_is_decided(self):
        """What waits is listed on the page Jobs, which the main page links (UC-046 step 5): the root's route `jobs` lists the product's open use case, and the route `home` lists none."""
        waits = js(facts() + "return progressMeasures.waitingForAPerson(f);")
        self.assertEqual(waits, [{"kind": "use case", "id": "UC-004", "path": UC4["path"]}])
        self.assertIn("use case: UC-002 · alice/product", rendered_home(hash="#jobs")["waits"])
        self.assertEqual(rendered_home()["waits"], [])


class EachProductsProgressByStage(unittest.TestCase):
    def test_three_of_four_use_cases_accepted_show_the_use_case_stage_at_75_percent(self):
        self.assertEqual(stages()["use-cases"]["share"], 0.75)
        self.assertRegex(card()["text"], r"Use cases 75 % 3 of 4 accepted")

    def test_counter_proof_with_all_four_accepted_the_stage_is_at_100_percent(self):
        self.assertEqual(stages(extra_paths=[UC4_RECORD])["use-cases"]["share"], 1)
        self.assertRegex(card(extra_paths=[UC4_RECORD])["text"], r"Use cases 100 % 4 of 4 accepted")

    def test_the_six_stages_stand_in_their_order(self):
        self.assertEqual([s["stage"] for s in js(facts() + "return progressMeasures.stageShares(f);")],
                         ["Requirements", "Use cases", "Architecture", "Implementation", "Tests", "Release"])

    def test_each_stage_is_filled_by_the_share_of_its_work_that_is_accepted_or_done(self):
        got = {k: s["share"] for k, s in stages().items()}
        # Requirements: the one change entry is decided and the SPEC holds requirements. Architecture: no file yet.
        # Implementation: neither step's pull request is merged. Tests: one of three requirements names a test file that is
        # there, and CI passed. Release: no tag.
        self.assertEqual(got, {"requirements": 1, "use-cases": 0.75, "architecture": 0, "implementation": 0,
                               "tests": 1 / 3, "release": 0})

    def test_counter_proof_a_red_ci_guards_no_requirement(self):
        self.assertEqual(stages(ci="failed")["tests"]["share"], 0)

    def test_the_stage_the_product_is_in_is_marked(self):
        self.assertEqual(card()["current"], ["Use cases"])


class WithoutAProductTheMainPageShowsAgentMsOwnProgress(unittest.TestCase):
    def test_without_a_product_the_bar_shows_agent_m(self):
        self.assertIn("Agent M", rendered_home(products=False)["cards"][0])

    def test_counter_proof_with_one_product_the_bar_shows_the_product(self):
        self.assertIn("alice/product", rendered_home()["cards"][0])

    def test_agent_ms_bar_is_full_once_its_first_release_is_tagged(self):
        got = js(facts(tags=["v2026.1.0"], own=True) + "return (await progressMeasures.stageShares(f)).map((s) => s.share);")
        self.assertEqual(got, [1, 1, 1, 1, 1, 1])
        self.assertEqual(js(facts(tags=["v2026.1.0"], own=True) + "return (await progressMeasures.stageShares(f)).every((s) => s.share === 1);"), True)

    def test_counter_proof_before_its_first_release_the_bar_shows_the_shares(self):
        got = js(facts(own=True) + "return (await progressMeasures.stageShares(f)).map((s) => s.share);")
        self.assertEqual(got, [1, 0.75, 0, 0, 1 / 3, 0])


class TheBuildIsShownAsItHappens(unittest.TestCase):
    def test_a_running_job_is_shown_beside_its_step(self):
        rows = js(facts(prs=[pr(7, "ITM-201")], live=True) + "return progressMeasures.buildInProgress(f);")
        self.assertEqual(rows, [{"item": "ITM-201", "job": "JOB-20261005-0900-a1b2", "participant": "coder-a",
                                 "state": "running", "elapsed": 5400, "reachable": True}])
        self.assertRegex(card(prs=[pr(7, "ITM-201")], live=True)["text"], r"ITM-201 JOB-20261005-0900-a1b2 coder-a running 1h 30m 0s")

    def test_counter_proof_once_the_job_has_ended_the_step_shows_done(self):
        ended = js(facts(texts={JOB: JOB_ENDED}) + "return progressMeasures.buildInProgress(f);")
        self.assertEqual(ended, [{"item": "ITM-201", "job": "JOB-20261005-0900-a1b2", "participant": "coder-a",
                                  "state": "done", "elapsed": 5400, "reachable": True}])
        self.assertRegex(card(texts={JOB: JOB_ENDED})["text"], r"ITM-201 JOB-20261005-0900-a1b2 coder-a done")
        merged = [pr(7, "ITM-201", state="merged", merged_at="2026-10-05T10:05:00.000Z")]
        rows = js(facts(prs=merged, texts={JOB: JOB_ENDED}) + "return progressMeasures.buildInProgress(f);")
        self.assertEqual(rows, [])
        self.assertNotRegex(card(prs=merged, texts={JOB: JOB_ENDED})["text"], r"ITM-201 JOB-20261005-0900-a1b2")
        self.assertEqual(stages(prs=merged, texts={JOB: JOB_ENDED})["implementation"]["share"], 0.5)


if __name__ == "__main__":
    unittest.main()
