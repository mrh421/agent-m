# Module: MOD-issue-handling; MOD-maintenance-pages; MOD-spec-changes
# Guards: UC-012; EVOLUTION ENTERS THROUGH THE SPECIFICATION
# Level: release
"""SPEC section 9 - the check named tests/test_issue_to_spec.py, for the requirement EVOLUTION ENTERS THROUGH THE SPECIFICATION:
"An issue that changes behaviour - on GitHub or on the product's GitLab server - becomes a specification change first and a code change second."

The cases live in tests/test_issue_to_spec.md. This file only loads them and asks node to open the real page of an issue (route `issue` of
MOD-maintenance-pages, over MOD-issue-handling, MOD-job-runner, MOD-spec-changes and MOD-repository-hosts) in the world of
tests/maintenance-pages-world.mjs: a fake GitHub holding the issues of the product alice/product and taking the git commits made to it, and a fake
model endpoint that answers with the candidates of the case. A case's steps are the person's clicks (`class`: the class of the issue; `draft`: a
participant, a name, Run, Save). The check then states what the product's repository holds and what the page offers: the writes made to the issue, the
paths committed to the product, the files of a queue and the issue it names, the kinds of the jobs that were started, and which sections of the page
are shown. A path committed outside docs/ is code, a test or SPEC.md itself.

The sentence is read through UC-012 (step 6 and its postcondition): "[Agent M] writes them as entries under `docs/spec-freigaben/`, each naming the issue"
and "A change is in the specification before any code implements it, and the accepted entry names the issue it came from." The check covers the
side of that order that precedes the acceptance of the queue: the change leaves the issue as a queue and nothing else is committed, and no fix is
offered for it. That no code job starts for a requirement not yet accepted is NOTHING IS IMPLEMENTED BEFORE IT IS ACCEPTED (tests/test_job_preconditions.py).

On a GitLab server the class of the issue is checked on the real GitLab adapter over a fake fetch (TST-1152003), and the queue written for a change on the
real page of the issue, whose product is the real GitLab adapter over a fake GitLab server that serves the project, its tree and files, the issue and GitLab's
commit API (TST-1283001); that fake stands in this file.

Written for ITM-1152 and ITM-1283 by participants who built none of the behaviour they check (RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER).
"""
import json
import re
import unittest
from pathlib import Path

from jsrun import js

DATA = Path(__file__).with_suffix(".md")
ROOT = Path(__file__).resolve().parents[1]
FIRST = "EVOLUTION ENTERS THROUGH THE SPECIFICATION - a change is written as a queue naming the issue"
SECOND = "EVOLUTION ENTERS THROUGH THE SPECIFICATION - the code is not changed by a change"
GITLAB = "EVOLUTION ENTERS THROUGH THE SPECIFICATION - on a GitLab server"
GITLAB_QUEUE = "EVOLUTION ENTERS THROUGH THE SPECIFICATION - a change is written as a queue on a GitLab server"

# The adapter. `input`: `server` (`gitlab` makes the product the project space/release-tool on a fake GitLab server, any other value the product alice/product on the fake GitHub; `issues` then holds the one issue), `issues` (the number and the labels of each issue of the product), `issue` (the number of the page opened), `steps` (`class`: a click on
# Change or Bug; `draft`: the participant drafts the change and the person saves it), `candidates` (what the participant answers). The value is what the case may state:
# `labels` (the labels of the issue at the end), `state` (its state), `issueWrites` (the writes made to the issue, sorted), `committed` (the paths committed to the product,
# sorted), `outsideDocs` (those that do not lie under docs/), `queueNames` (the issue named by the line `**Issue:** #<number> of <product address>` in the rationale of each entry under docs/spec-freigaben/, as MOD-spec-changes, Data, gives it), `queueHolds` (each of the
# case's `needles`: whether an entry of a queue holds it), `jobKinds` (the kind of each job record committed), `changeSection` and `fixSection` (whether the page shows the section that drafts the change
# and the one that fixes a bug), `unserved` (on a GitLab server, the requests of the project's API that the fake did not serve).
WORLD = r"""
const url = (path) => `file://${ROOT}/${path}`;
await import(url("tests/site-frame-dom.mjs"));
const harness = await import(url("tests/main-page-home-harness.mjs"));
const worldOf = await import(url("tests/maintenance-pages-world.mjs"));
const hosts = await import(url("src/repository-hosts/index.mjs"));
const runner = await import(url("src/job-runner/index.mjs"));
const { byClass, one, buttonsOf, textOf, waitFor, flush, trusted, routeNamed, pages, restoreWorld } = worldOf;
for (const [at, strategies] of (pages.view?.strategies ?? []).entries()) {
  try { runner.registerStrategies(`tests/test_issue_to_spec.py#${at}`, strategies); } catch { /* registered by the page's own view */ }
}
const { readFileSync, readdirSync } = await import("node:fs");
const { createHash } = await import("node:crypto");

const PRODUCT_TOKEN = "github_pat_HOME827PRODUCT0123456789abcdefg";
const ISSUE_BODY = "FIRST RULE says nothing about page counts: the export is cut off after the second page.";
const lines = (...rows) => `${rows.join("\n")}\n`;
const SOURCE = "SRC-alice";
const LINKS = lines("# Requirement sources of the product", "", "| Source | Version | Hash | Part |", "|---|---|---|---|", `| ${SOURCE} | 2026-10-13 | ${"0".repeat(64)} | prompt |`);
const PERSON_SOURCE = lines("---", `id: ${SOURCE}`, "title: Alice", "kind: person", "identifier: github.com/alice", "authority: informative", "licence: may be republished - fixture", "---", `# ${SOURCE} Alice`, "",
  "## Versions", "", "| Version | Date | Edition | Read from | Files |", "|---|---|---|---|---|", "| `2026-10-13` | 2026-10-13 | fixture | this repository | one file, hashed only |");
const BOOK_FOLDER = "docs/sources/SRC-vibe-coding/2026-10-05/";
const onDisk = (path) => readFileSync(`${ROOT}/${path}`, "utf8");
const BOOK = { "docs/sources/SRC-vibe-coding.md": onDisk("docs/sources/SRC-vibe-coding.md"),
  ...Object.fromEntries(readdirSync(`${ROOT}/${BOOK_FOLDER}`).map((name) => [BOOK_FOLDER + name, onDisk(BOOK_FOLDER + name)])) };

// A fake GitLab server holding the product `space/release-tool` (its files and its one issue) in front of the fetch of the world: the project, a branch and its head, a commit's tree and raw files, the issue,
// and GitLab's "Create a commit with multiple files and actions", which applies its create, update and delete actions and moves the head. Every other request is passed on, and every request the project's
// API receives that this fake does not serve is kept in `unserved`, answered 404. `written()` is every file a commit created or updated, with its text; `issueWrites()` every request that is not a read and names an issue.
const GITLAB_TOKEN = "glpat-SPACEreleaseTOOL0123456789";
function gitlabServer(files, held) {
  const WEB = "https://gitlab.example.org/space/release-tool", PREFIX = "/api/v4/projects/space%2Frelease-tool";
  const sha1 = (text) => createHash("sha1").update(text).digest("hex");
  const blobOf = (text) => createHash("sha1").update(`blob ${Buffer.byteLength(text)}\0`).update(text).digest("hex");
  const states = new Map();
  let head = sha1("space/release-tool@0");
  states.set(head, { ...files });
  const posted = [], unserved = [], issueWrites = [];
  const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  const inner = globalThis.fetch;
  globalThis.fetch = async (input, init = {}) => {
    const where = new URL(typeof input === "object" && !(input instanceof URL) ? input.url : String(input));
    if (where.origin !== "https://gitlab.example.org" || !where.pathname.startsWith(PREFIX)) return inner(input, init);
    const method = String(init.method ?? "GET").toUpperCase();
    const rest = where.pathname.slice(PREFIX.length);
    const at = (ref) => states.get(ref) ?? null;
    if (method !== "GET" && rest.startsWith("/issues/")) issueWrites.push(`${method} ${rest}`);
    if (method === "GET" && rest === "") return json({ visibility: "private", default_branch: "main", archived: false, description: "", permissions: { project_access: { access_level: 40 } } });
    if (method === "GET" && rest.startsWith("/repository/commits/")) return json({ id: head });
    if (method === "GET" && rest === "/repository/branches/main") return json({ commit: { id: head } });
    if (method === "GET" && rest === "/repository/tree") {
      const state = at(where.searchParams.get("ref"));
      return json(state && where.searchParams.get("page") === "1" ? Object.entries(state).map(([path, text]) => ({ type: "blob", path, id: blobOf(text) })) : []);
    }
    const file = /^\/repository\/files\/([^/]+?)(\/raw)?$/.exec(rest);
    if (method === "GET" && file) {
      const text = at(where.searchParams.get("ref"))?.[decodeURIComponent(file[1])];
      if (text === undefined) return json({ message: "404 File Not Found" }, 404);
      return file[2] ? new Response(text, { status: 200 }) : json({ last_commit_id: where.searchParams.get("ref") });
    }
    if (method === "POST" && rest === "/repository/commits") {
      const given = JSON.parse(init.body);
      const next = { ...at(head) };
      for (const action of given.actions) {
        if (action.action === "delete") delete next[action.file_path];
        else next[action.file_path] = action.content;
        if (action.action !== "delete") posted.push({ path: action.file_path, content: action.content });
      }
      head = sha1(`${head}:${given.commit_message}`);
      states.set(head, next);
      return json({ id: head, web_url: `${WEB}/-/commit/${head}` }, 201);
    }
    const issueJson = { iid: held.number, title: held.title, description: held.body, state: "opened", labels: held.labels, web_url: `${WEB}/-/issues/${held.number}`, user_notes_count: 0 };
    if (method === "GET" && rest === `/issues/${held.number}`) return json(issueJson);
    if (method === "GET" && rest === "/issues") return json(["opened", "all"].includes(where.searchParams.get("state")) ? [issueJson] : []);
    unserved.push(`${method} ${rest}`);
    return json({ message: "404 Not found" }, 404);
  };
  return { web: WEB, written: () => posted, issue: () => ({ labels: held.labels, state: held.state }), issueWrites: () => issueWrites.sort(), unserved: () => unserved };
}

const issues = input.issues.map(({ number, labels }) => ({ number, title: `Export loses pages ${number}`, body: ISSUE_BODY, state: "open", labels, comments: [] }));
const w = worldOf.world({ mails: [], issues, answer: () => ({ draft: { candidates: input.candidates }, answers: [] }),
  product: { "docs/sources.md": LINKS }, instance: { ...BOOK, [`docs/sources/${SOURCE}.md`]: PERSON_SOURCE } });
w.context.product = { address: harness.PRODUCT_URL, kind: "github", host: hosts.connect(hosts.parseAddress(harness.PRODUCT_URL), { token: PRODUCT_TOKEN }), tokenStored: true };
const gitlab = input.server === "gitlab" ? gitlabServer({ ...harness.smallProduct(), "docs/sources.md": LINKS }, issues.find((each) => each.number === input.issue)) : null;
if (gitlab) w.context.product = { address: gitlab.web, kind: "gitlab", host: hosts.connect(hosts.parseAddress(gitlab.web), { token: GITLAB_TOKEN }), tokenStored: true };

const detail = await harness.draw(routeNamed("issue"), w.context, { number: String(input.issue) });
await waitFor(() => byClass(detail, "issue-analysis").length > 0);
const shown = (name) => byClass(detail, name)[0];

for (const step of input.steps) {
  if (step.class) {
    await trusted(byClass(detail, "set-class").find((node) => node.getAttribute("data-class") === step.class));
    await waitFor(() => byClass(detail, "issue-classified").length > 0);
  } else if (step.draft) {
    const change = shown("issue-change");
    const radio = byClass(change, "change-participant").find((each) => each.value === "local-llm");
    radio.checked = true;
    one(change, "change-person").value = "Reviewer Rae";
    radio.dispatchEvent(new Event("change"));
    await waitFor(() => byClass(change, "run-panel").length > 0 || byClass(change, "issue-problem").length > 0);
    await trusted(buttonsOf(one(change, "run-panel"), "Run")[0]);
    await waitFor(() => byClass(change, "candidate").length > 0 || byClass(change, "issue-problem").length > 0);
    await trusted(buttonsOf(change, "Save")[0]);
    await waitFor(() => byClass(change, "change-saved").length > 0 || byClass(change, "issue-problem").length > 0);
    if (byClass(change, "issue-problem").length) throw new Error("the change could not be drafted: " + textOf(change));
  }
}
await flush();

const trees = w.kept.github.filter((request) => request.method === "POST" && request.path.endsWith("/git/trees")).flatMap((request) => JSON.parse(request.body).tree ?? []).filter((entry) => typeof entry.content === "string");
const files = [...new Map((gitlab ? gitlab.written() : trees).map((entry) => [entry.path, entry])).values()];
const committed = files.map((entry) => entry.path).sort();
const issue = gitlab ? gitlab.issue() : w.kept.issues.find((each) => each.number === input.issue);
const rationales = files.filter((entry) => /^docs\/spec-freigaben\/[^/]+\/\d+-[^/]*\.begruendung\.md$/.test(entry.path));
const out = {
  labels: issue.labels,
  state: issue.state,
  issueWrites: gitlab ? gitlab.issueWrites() : w.kept.github.filter((request) => request.method !== "GET" && request.path.includes("/issues/")).map((request) => `${request.method} ${request.path.replace("/repos/alice/product", "")}`).sort(),
  committed,
  outsideDocs: committed.filter((path) => !path.startsWith("docs/")),
  queueNames: rationales.map((entry) => /^\*\*Issue:\*\* (.*)$/m.exec(entry.content)?.[1] ?? null),
  queueHolds: Object.fromEntries((input.needles ?? []).map((needle) => [needle, files.some((entry) => /^docs\/spec-freigaben\/[^/]+\/\d+-[^/]*\.md$/.test(entry.path) && !entry.path.endsWith(".begruendung.md") && entry.content.includes(needle))])),
  jobKinds: files.filter((entry) => /^docs\/jobs\/JOB-.*\.md$/.test(entry.path)).map((entry) => /^kind: (.*)$/m.exec(entry.content)?.[1] ?? null),
  changeSection: byClass(detail, "issue-change").length > 0,
  fixSection: byClass(detail, "issue-fix").length + byClass(detail, "issue-no-fixer").length > 0,
  unserved: gitlab ? gitlab.unserved() : [],
};
restoreWorld();
return out;
"""

# The class of an issue on a GitLab server. `input`: `issue` (its number), `cls` (the class the person clicks). The value is what the case may state:
# `writes` (every request that is not a read, as "METHOD path body", the project's prefix left out), `requests` (how many requests the fake server received).
GITLAB_WORLD = r"""
const url = (path) => `file://${ROOT}/${path}`;
const issueHandling = await import(url("src/issue-handling/index.mjs"));
const hosts = await import(url("src/repository-hosts/index.mjs"));
const WEB = "https://gitlab.example.org/space/release-tool", PREFIX = "/api/v4/projects/space%2Frelease-tool";
const requests = [];
globalThis.fetch = async (target, init = {}) => {
  const where = new URL(String(target));
  const method = String(init.method ?? "GET").toUpperCase();
  requests.push({ method, path: where.pathname + where.search, body: init.body ?? null });
  const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  if (where.origin === "https://gitlab.example.org" && where.pathname === `${PREFIX}/issues/${input.issue}` && method === "PUT") return json(200, { iid: input.issue });
  return json(404, { message: "404 Not found" });
};
const host = hosts.connect(hosts.parseAddress(WEB), { token: "glpat-SPACEreleaseTOOL0123456789" });
await issueHandling.confirmClass(host, input.issue, input.cls, null);
return { writes: requests.filter((request) => request.method !== "GET").map((request) => `${request.method} ${request.path.replace(PREFIX, "")} ${request.body}`), requests: requests.length };
"""


def cases(section: str, data: Path = DATA) -> list[dict]:
    text = data.read_text(encoding="utf-8")
    body = re.search(rf"^## {re.escape(section)}\n(.*?)(?=^## |\Z)", text, re.M | re.S)
    if not body:
        raise AssertionError(f"missing section {section}")
    found = [{"name": m.group(1), "case": json.loads(m.group(2))}
             for m in re.finditer(r"^### ([^\n]+)\n\n```json\n(.*?)\n```", body.group(1), re.M | re.S)]
    if not found:
        raise AssertionError(f"no cases under {section}")
    return found


def run_world(argument: dict, world: str = WORLD) -> dict:
    return js(f"const input = {json.dumps(argument)}; const ROOT = {json.dumps(str(ROOT))};\n{world}")


def check(test: unittest.TestCase, section: str, world: str = WORLD) -> None:
    for loaded in cases(section):
        with test.subTest(case=loaded["name"]):
            got = run_world(loaded["case"]["input"], world)
            wanted = loaded["case"]["expected"]
            test.assertEqual({key: got.get(key) for key in wanted}, wanted)


class TestIssueToSpec(unittest.TestCase):
    # TST-1152001 · level: release · module: MOD-issue-handling, MOD-maintenance-pages, MOD-spec-changes
    # guards: EVOLUTION ENTERS THROUGH THE SPECIFICATION; UC-012
    # given: the cases under "a change is written as a queue naming the issue" in the Markdown file beside this one: an issue classed as a change, with a participant that answers a new requirement, and a person who saves the draft
    # input: each case's steps, carried out on the real page of the issue over the fake GitHub and the fake endpoint
    # expect: the saved draft is a queue under docs/spec-freigaben/ whose entry's rationale carries the line `**Issue:** #7 of` the product's address, and whose entry holds the new requirement; the only job started is of the kind change-requirements; nothing is committed outside docs/; the issue stays open and offers no fix
    # Planted fault: a rationale without the line `**Issue:**` fails queueNames; the line moved into the index instead fails it too; an extra file src/export/index.mjs in the queue's commit fails outsideDocs; the fix offered for a change fails fixSection.
    def test_a_change_is_written_as_a_queue_naming_the_issue(self):
        check(self, FIRST)

    # TST-1152002 · level: release · module: MOD-issue-handling, MOD-maintenance-pages
    # guards: EVOLUTION ENTERS THROUGH THE SPECIFICATION; UC-012
    # given: the cases under "the code is not changed by a change": an issue without a class, and an issue labelled defect as the known positive of the sections
    # input: the person's click on Change on the first; the page of the second
    # expect: after the click the issue carries the label change and no other class, nothing is committed, the page offers the draft of the change and no fix; the issue labelled defect offers the fix and not the draft
    # Planted fault: the change class mapped to the label defect fails labels; the fix offered for a change fails fixSection; the draft offered for a bug fails changeSection; the draft withheld from a change fails changeSection.
    def test_the_code_is_not_changed_by_a_change(self):
        check(self, SECOND)

    # TST-1152003 · level: release · module: MOD-issue-handling, MOD-repository-hosts
    # guards: EVOLUTION ENTERS THROUGH THE SPECIFICATION; UC-012
    # given: the case under "on a GitLab server": a product on a GitLab server, whose issue 7 is classed by the person's click
    # input: confirmClass with the class change on the real GitLab adapter over a fake fetch
    # expect: the one request is a PUT on the issue that adds the label change and removes defect and not-reproducible; nothing else is requested, so no commit, branch or merge request is made
    # Planted fault: the change class mapped to the label defect fails writes.
    def test_on_a_gitlab_server_the_class_of_a_change_is_only_a_label(self):
        check(self, GITLAB, GITLAB_WORLD)

    # TST-1283001 · level: release · module: MOD-issue-handling, MOD-maintenance-pages, MOD-spec-changes
    # guards: EVOLUTION ENTERS THROUGH THE SPECIFICATION; UC-012
    # given: the case under "a change is written as a queue on a GitLab server": a product on a GitLab server whose issue 7 is labelled change, a participant that answers a new requirement, and a person who saves the draft
    # input: the steps of the case, carried out on the real page of the issue, whose product is the real GitLab adapter over a fake GitLab server that serves the project, its tree and files, the issue and GitLab's commit API
    # expect: the saved draft is a queue under docs/spec-freigaben/ whose entry's rationale carries the line `**Issue:** #7 of` the product's GitLab address, and whose entry holds the new requirement; the only job started is of the kind change-requirements; nothing is committed outside docs/; no write is made to the issue; every request the fake received was one it serves
    # Planted fault: the files under docs/spec-freigaben/ left out of the actions of GitLab's commitFiles fail queueNames and queueHolds; a file src/export/index.mjs added to those actions fails outsideDocs.
    def test_a_change_is_written_as_a_queue_on_a_gitlab_server(self):
        check(self, GITLAB_QUEUE)


if __name__ == "__main__":
    unittest.main()
