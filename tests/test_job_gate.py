# Module: MOD-product-process
# Module: MOD-workflow-entries
# Guards: A JOB STOPS AT EVERY GATE; A GATE IS DECIDED WITHIN THE JOB'S ROLE ASSIGNMENT; A GATE IS NOT DECIDED BY THE PARTICIPANT WHOSE WORK IT CHECKS; A GATE NAMES WHO DECIDES IT; UC-034
# Level: release
"""SPEC section 13 - the check named tests/test_job_gate.py, for A JOB STOPS AT EVERY GATE, A GATE IS DECIDED WITHIN THE JOB'S ROLE ASSIGNMENT and A GATE IS NOT DECIDED BY THE PARTICIPANT WHOSE WORK IT CHECKS.

The cases live in tests/test_job_gate.md. This file loads them. For each case node builds the job workflow's workspace of a product of two teams in temporary git repositories - a product whose job of
the participant ci-bot has reached the gate Development -> Sprint Review of the model Scrum, or a gate that a requirement adds and a check decides -, tries each decision of the case through
MOD-product-process' recordGateDecision with the role assignment of the job's team, commits what stands to the product, lets MOD-workflow-entries' onCheckCompleted write the record of a completed check, and runs
the entry onRecordsChanged, which resumes the jobs of its route whose gate is decided. The check then reads what the product holds: the gate records that stand and whether the job was resumed.

Written for ITM-805 by developer-sonnet-j, who built none of the code it checks: src/product-process was built by developer-opus-e and without a trailer, src/workflow-entries by developer-opus-a, -b, -e and
-f and developer-sonnet-a, -b, -c, -d, -e, -k and developer-sol-b (RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER). Readings the texts leave open, which the cases state:
  - "nor on a record by anyone else" is read as: a decision of a participant who is not a holder of the deciding role in the job's role assignment is refused by recordGateDecision and leaves no record, so the job
    stays; gate-record.schema.md says that the decider held the role is recordGateDecision's and mayDecide's "at the time of the decision".
  - "a person's, an agent's or a CI check's" is read as the three kinds a decision has: a person on the job's page, an agent that holds the role, and the check a gate names, whose completed run
    onCheckCompleted turns into a record.
"""
import json
import re
import unittest
from pathlib import Path

from jsrun import js

DATA = Path(__file__).with_suffix(".md")
ROOT = Path(__file__).resolve().parents[1]

# The adapter. `input` is the case; the value is { refused, recorded, resumed, resumedBy }.
WORLD = r"""
const [fs, os, path, childProcess] = await Promise.all([import("node:fs"), import("node:os"), import("node:path"), import("node:child_process")]);
process.env.GIT_CONFIG_GLOBAL = "/dev/null"; process.env.GIT_CONFIG_SYSTEM = "/dev/null"; process.env.GIT_TERMINAL_PROMPT = "0";
const text = (...lines) => `${lines.join("\n")}\n`;
const git = (cwd, ...args) => {
  const r = childProcess.spawnSync("git", args, { cwd, encoding: "utf8" });
  if (r.status !== 0) throw new Error(`git ${args.join(" ")} failed in ${cwd}: ${r.stderr}`);
  return r.stdout.trim();
};
const write = (root, files) => { for (const [p, body] of Object.entries(files)) { fs.mkdirSync(path.join(root, p, ".."), { recursive: true }); fs.writeFileSync(path.join(root, p), body); } };
// Git starts `git maintenance run --auto --detach` after a push, a commit and a fetch; the repositories of these cases need none.
const NO_MAINTENANCE = ["-c", "gc.auto=0", "-c", "maintenance.auto=false", "-c", "receive.autogc=false"];
const quiet = (dir) => { for (const [k, v] of [["gc.auto", "0"], ["maintenance.auto", "false"], ["receive.autogc", "false"]]) git(dir, "config", k, v); };
function repository(root, name, files, folder) {
  const origin = path.join(root, `${name}.git`), seed = path.join(root, `${name}-seed`);
  git(root, "init", "-q", "--bare", "-b", "main", origin); quiet(origin);
  git(root, "clone", "-q", ...NO_MAINTENANCE, origin, seed); quiet(seed);
  git(seed, "config", "user.name", "Seed"); git(seed, "config", "user.email", "seed@example.org");
  write(seed, files); git(seed, "add", "-A"); git(seed, "commit", "-q", "-m", "first"); git(seed, "push", "-q", "origin", "HEAD:refs/heads/main");
  fs.mkdirSync(path.join(folder, ".."), { recursive: true });
  git(root, "clone", "-q", ...NO_MAINTENANCE, origin, folder); quiet(folder);
  git(folder, "config", "user.name", "Alice Agent M token"); git(folder, "config", "user.email", "alice@example.org");
  return origin;
}

const TOKEN = "ghp_ALICEagentMtoken0123456789abcdef", KEY = "sk-FIXTURE-KEY-0123456789abcdef";
const NOW = new Date("2026-10-08T09:00:00Z");
const ROLE_GATE = "Development → Sprint Review", ADDED_GATE = "A GREEN BUILD GATES THE MERGE";
const JOB = "JOB-20261008-0800-a1b2";
const SHA = "0123456789abcdef0123456789abcdef01234567";
const person = (name) => `| ${name} | person | — | — | — | read the repository, write to the repository | — | account github.com/${name} |`;
const bot = (name) => `| ${name} | CI agent | fixture-llm | 100000 | — | read the repository, write to the repository, run code and tests | GitHub's hosted runners | ci hosted secret FIXTURE_KEY |`;
const PARTICIPANTS = text("# Participants of this instance", "", "| Name | Type | Model | Context | Price | Capabilities | Processing place | Route |", "|---|---|---|---|---|---|---|---|",
  person("alice"), person("bob"), person("carol"), bot("ci-bot"), bot("po-bot"));
const assignmentOf = (team, who) => text(`# ${team}`, "", "## Roles", "", "| Role | Participants |", "|---|---|", `| Product Owner | ${who.po} |`, `| Scrum Master | ${who.dev} |`, `| Developers | ${who.dev} |`);
const declaration = (version, added) => text("---", "model: scrum", "model_file: src/model-catalogue/models/scrum.md", `model_version: ${version}`, "---", "# Process", "", "## Practices", "", "- none", "", "## Branches", "",
  "| Phase or time box | Branch |", "|---|---|", "| Sprint | sprint/<team>/<nn> |", "",
  ...(added ? ["## Gates added by requirements", "", "| Requirement | Between | Artifacts | Condition | Decider |", "|---|---|---|---|---|",
    `| ${ADDED_GATE} | Development → Sprint Review | the pull request | the build is green | check: build |`, ""] : []),
  "## Definition of Done", "", "The job rules hold; no condition is added.");
const item = (id) => text("---", `id: ${id}`, "title: The work", "level: module", "realises:", "  - FIRST RULE", "modules:", "  - MOD-store", "builds_on: []", "tests:", "  - unit", "origin:", "  - the fixture", "---",
  `# ${id} The work`, "", "## Outcome", "", "The work.", "", "## Acceptance", "", "- a unit test.");
const sprint = (n, team, selection) => text("---", `sprint: ${n}`, "goal: A goal", "start: 2026-10-01", "end:", "closer: alice", `branch: sprint/${team}/01`, "selection:", ...selection.map((each) => `  - ${each}`), "---", `# Sprint ${n}`);

const added = input.gate === "check";
const gateName = added ? ADDED_GATE : ROLE_GATE;
const worksOn = input.jobTeam === "team1" ? "ITM-001" : "ITM-002";
const root = fs.mkdtempSync(path.join(os.tmpdir(), "agent-m-gate-"));
try {
  const workspace = path.join(root, "ws");
  const spec = added ? text("# Spec", "", `**${ADDED_GATE}** *(Product Owner)*`, "", "A merge needs a green build.", "*Check:* no automatic check; at review.") : "# Spec\n";
  repository(root, "instance", { "README.md": "# Instance\n", "SPEC.md": spec, "docs/participants.md": PARTICIPANTS }, path.join(workspace, "instance"));
  const agentM = { version: "2026.10.0", commit: git(path.join(workspace, "instance"), "rev-parse", "HEAD") };
  const start = jobLedger.startRecord({ id: JOB, kind: "implement", worksOn: [worksOn], participant: "ci-bot", model: "fixture-llm", route: "ci hosted", run: null, retries: null, startedBy: "alice",
    start: new Date("2026-10-08T08:00:00Z"), agentM, inputs: [], limit: 2, destinations: [{ participant: "ci-bot", place: "GitHub's hosted runners", parts: [] }], params: { items: [worksOn] } });
  const taken = jobLedger.appendToRecord(start.text, { part: "taken", at: new Date("2026-10-08T08:30:00Z"), by: "https://github.com/alice/thesis-tool/actions/runs/1" });
  const waiting = jobLedger.appendToRecord(taken, { part: "gate reached", at: new Date("2026-10-08T08:40:00Z"), gate: gateName, decider: added ? "check: build" : "Product Owner" });
  const origin = repository(root, "product", { "README.md": "# Thesis tool\n", "docs/process.md": declaration(agentM.commit, added),
    "docs/role-assignments/team1.md": assignmentOf("team1", input.assignments.team1), "docs/role-assignments/team2.md": assignmentOf("team2", input.assignments.team2),
    "docs/backlog/ITM-001-the-work.md": item("ITM-001"), "docs/backlog/ITM-002-the-work.md": item("ITM-002"),
    "docs/backlog/sprints/team1/01.md": sprint(1, "team1", ["ITM-001"]), "docs/backlog/sprints/team2/01.md": sprint(1, "team2", ["ITM-002"]), [start.path]: waiting }, path.join(workspace, "product"));
  const productDir = path.join(workspace, "product");
  const head = () => git(productDir, "rev-parse", "HEAD");
  const environment = (event, extra = {}) => ({ GITHUB_ACTIONS: "true", GITHUB_EVENT_NAME: event, GITHUB_WORKSPACE: workspace, GITHUB_SERVER_URL: "https://github.com", GITHUB_REPOSITORY: "alice/thesis-tool",
    GITHUB_REF_NAME: "main", GITHUB_SHA: head(), GITHUB_RUN_ID: "4711", GITHUB_ACTOR: "alice", AGENT_M_RUNNER: "hosted", AGENT_M_PRODUCT_DIR: productDir, AGENT_M_TOKEN_NAME: "AGENT_M_TOKEN",
    AGENT_M_KEY_NAMES: "FIXTURE_KEY", AGENT_M_TOKEN: TOKEN, FIXTURE_KEY: KEY, ...extra });

  // The decisions tried through recordGateDecision, with the role assignment of the job's team.
  const refused = [];
  if (input.attempts.length) {
    const declared = documents.readDocument(productProcess.declarationSchema, "docs/process.md", declaration(agentM.commit, added));
    const empty = { repository: { server: "github", origin: "https://github.com", path: "alice/agent-m", web: "https://github.com/alice/agent-m" }, ref: agentM.commit, commit: agentM.commit, paths: [],
      read: async () => null, blob: () => null };
    const workflow = await productProcess.productWorkflow(declared, async () => empty, spec);
    const assignment = documents.readDocument(productProcess.roleAssignmentSchema, `docs/role-assignments/${input.jobTeam}.md`, assignmentOf(input.jobTeam, input.assignments[input.jobTeam]));
    const files = {};
    const host = { async repositoryInfo() { return { defaultBranch: "main" }; }, async commitFiles(change) { for (const file of change.files) files[file.path] = file.text; return { commit: "c".repeat(40) }; } };
    for (const [n, attempt] of input.attempts.entries()) {
      try {
        await productProcess.recordGateDecision(host, { gate: gateName, job: JOB, decider: { name: attempt.by, kind: attempt.kind }, role: "Product Owner", decision: attempt.decision, reason: attempt.reason ?? null, on: [head()] },
          { workflow, assignment, workBy: ["ci-bot"], head: head(), now: new Date(Date.UTC(2026, 9, 8, 8, 50 + n)), trailers: [] });
      } catch (failure) { refused.push([attempt.by, failure.name === "MayNotDecide" ? failure.reason : failure.name]); }
    }
    if (Object.keys(files).length) {
      write(productDir, files);
      git(productDir, "add", "-A"); git(productDir, "commit", "-q", "-m", "the gate records"); git(productDir, "push", "-q", "origin", "HEAD:refs/heads/main");
    }
  }
  // The completed check, turned into a record by the entry that CI runs on it.
  if (input.check) {
    const payload = path.join(root, "event.json");
    fs.writeFileSync(payload, JSON.stringify({ action: "completed", check_run: { status: "completed", head_sha: SHA, name: input.check.name, conclusion: input.check.conclusion } }));
    await main.runEntry("onCheckCompleted", environment("check_run", { GITHUB_EVENT_PATH: payload }), { now: NOW });
  }
  // The push of what stands starts the job workflow of the product anew, on a checkout of the branch as it is now.
  git(productDir, "pull", "-q", "--ff-only", "origin", "main");
  const status = await main.runEntry("onRecordsChanged", environment("push"), { now: new Date("2026-10-08T09:30:00Z") });

  // What the product holds now.
  const recordsOf = git(origin, "ls-tree", "-r", "--name-only", "main", "docs/gates/").split("\n").filter(Boolean);
  const field = (body, key) => new RegExp(`^${key}:[ \\t]*(.*)$`, "m").exec(body)?.[1].trim() ?? null;
  const deciderOf = Object.fromEntries(recordsOf.map((p) => [p, git(origin, "show", `main:${p}`)]).map(([p, body]) => [p, `${field(body, "decider")} ${field(body, "decision")}`]));
  const job = git(origin, "show", `main:${start.path}`);
  const resumedBy = /gate record: (\S+)/.exec(job.split("## Resumed")[1] ?? "")?.[1] ?? null;
  return { refused, recorded: Object.values(deciderOf).sort(), resumed: job.includes("## Resumed"), resumedBy: resumedBy ? (deciderOf[resumedBy] ?? resumedBy).split(" ").slice(0, -1).join(" ") : null, outcome: status.outcome };
} finally { fs.rmSync(root, { recursive: true, force: true }); }
"""


def sections() -> list[dict]:
    text = DATA.read_text(encoding="utf-8")
    found = []
    for match in re.finditer(r"^## (?P<name>[^\n]+)\n(?P<body>.*?)(?=^## |\Z)", text, re.M | re.S):
        block = re.search(r"^### Case\n\n```json\n(.*?)\n```", match.group("body"), re.M | re.S)
        if not block:
            raise AssertionError(f"missing Case block under {match.group('name')}")
        found.append({"name": match.group("name"), "case": json.loads(block.group(1))})
    if not found:
        raise AssertionError("no cases loaded")
    return found


def of_group(group: str) -> list[dict]:
    chosen = [s for s in sections() if s["case"]["group"] == group]
    if not chosen:
        raise AssertionError(f"no case of the group {group}")
    return chosen


def run(case: dict) -> dict:
    return js(f"const input = {json.dumps(case)}; const ROOT = {json.dumps(str(ROOT))};\n{WORLD}")


def expect(test: unittest.TestCase, loaded: dict) -> dict:
    got = run(loaded["case"])
    want = loaded["case"]["expected"]
    test.assertEqual({k: got[k] for k in want}, want)
    return got


class TestJobGate(unittest.TestCase):
    # TST-805401 · level: release · module: MOD-workflow-entries
    # guards: A JOB STOPS AT EVERY GATE
    # given: a job of ci-bot waiting at the gate Development -> Sprint Review of the model Scrum, decided by the Product Owner, in a product of two teams; the cases of the group stops: no decision recorded, a person who holds no role, the Product Owner of the other team, a rejection by the deciding role, a completed check that failed on a gate it decides
    # input: the decisions of each case through recordGateDecision, or the completed check through onCheckCompleted, then the entry onRecordsChanged on the push of what stands
    # expect: in every case the entry resumes no job: the job's record gains no Resumed part; the refused decisions leave no gate record, a rejection stands as a record of decision rejected, and a failed check as a record of the check rejected
    def test_a_job_waits_at_its_gate_while_no_decision_of_its_decider_is_recorded(self):
        for loaded in of_group("stops"):
            with self.subTest(case=loaded["name"]):
                self.assertFalse(expect(self, loaded)["resumed"])

    # TST-805402 · level: release · module: MOD-workflow-entries
    # guards: A JOB STOPS AT EVERY GATE; A GATE NAMES WHO DECIDES IT; A PROCESS REQUIREMENT ADDS TO THE MODEL
    # given: the same job at the same gate; the cases of the group proceeds, in which the deciding role's holder is a person, an agent, and in which the gate is one a requirement adds and the check build decides, completed with success
    # input: the decision of each case, then the entry onRecordsChanged
    # expect: the entry resumes the job on the record of its decider - the person's, the agent's, the check's -, which the job's record names as the gate record of its Resumed part; known positive for TST-805401: the same world with no decision resumes nothing
    def test_a_job_proceeds_on_the_record_of_its_decider_whether_a_person_an_agent_or_a_check(self):
        for loaded in of_group("proceeds"):
            with self.subTest(case=loaded["name"]):
                self.assertTrue(expect(self, loaded)["resumed"])

    # TST-805403 · level: release · module: MOD-product-process
    # guards: A GATE IS NOT DECIDED BY THE PARTICIPANT WHOSE WORK IT CHECKS
    # given: the cases of the group work: the participant ci-bot, whose job the gate checks, holds the Product Owner in the job's assignment; then another agent, po-bot, holds it beside it
    # input: ci-bot passes the gate; then po-bot passes it
    # expect: ci-bot's decision is refused as the work this gate checks, writes no record and leaves the job waiting; po-bot's, another holder of the role, stands and the job proceeds on it - counter-proof: the second case resumes the job
    def test_the_implementing_agents_own_record_leaves_the_job_waiting_and_a_second_holder_passes_it(self):
        for loaded in of_group("work"):
            with self.subTest(case=loaded["name"]):
                expect(self, loaded)

    # TST-805404 · level: release · module: MOD-product-process
    # guards: A GATE IS DECIDED WITHIN THE JOB'S ROLE ASSIGNMENT
    # given: the cases of the group within: a product of two teams, alice the Product Owner of team1, bob of team2; a job of team1's item and a job of team2's
    # input: the Product Owner of the other team passes the gate, then the Product Owner of the job's team
    # expect: the first is refused as not a holder of the deciding role, in the job's own assignment, and writes no record; the second stands and the job proceeds on it
    def test_only_a_holder_of_the_deciding_role_in_the_jobs_own_assignment_passes_the_gate(self):
        for loaded in of_group("within"):
            with self.subTest(case=loaded["name"]):
                expect(self, loaded)


if __name__ == "__main__":
    unittest.main()
