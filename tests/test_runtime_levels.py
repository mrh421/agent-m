# Module: MOD-runtimes
# Guards: AGENT M WORKS WITHOUT A LOCAL INSTALLATION; A HOSTED JOB AUTHENTICATES ITS AGENT WITH A CI SECRET
# Guards: A HOSTED JOB WRITES WITH THE PERSON'S TOKEN FROM A CI SECRET; A JOB RUNS ONLY WHERE ITS RESOURCES ARE REACHABLE
# Level: release
"""The check named tests/test_runtime_levels.py, for the three requirements whose Check line gives it:
AGENT M WORKS WITHOUT A LOCAL INSTALLATION ("every job kind whose definition names no local resource is runnable on the hosted-CI route;
counter-proof: a job needing a compute resource is not offered there"), A HOSTED JOB AUTHENTICATES ITS AGENT WITH A CI SECRET ("the generated
job workflow reads the key only from the named secret, and the part of it that runs the agent reads no other secret; counter-proof: a workflow
with the key written into it, or one whose agent part reads `AGENT_M_TOKEN` or another participant's key, fails") and A HOSTED JOB WRITES WITH
THE PERSON'S TOKEN FROM A CI SECRET ("the generated job workflow authenticates its pushes and pull requests with the named secret, on a runner
machine that runs no agent; counter-proof: a workflow that uses `GITHUB_TOKEN` for them, or that hands the secret to the machine the agent works
on, fails").

The cases live in tests/test_runtime_levels.md. This file only loads them and asks node to run the real code of src/runtimes/ and
src/job-catalogue/: routesFor over the participants and needs of a case, that sweep over every kind of the catalogue whose definition says
`resources: none`, and jobWorkflowFiles for GitHub and for GitLab. A workflow "fails" a check where the checks below, which are this
file's, find a line in the generated text: a key named anywhere but as the secret it reads or in the list of key names, and a use of the
workflow's own token (GITHUB_TOKEN, github.token, CI_JOB_TOKEN) or a push token that is not the named secret. The checks of the agent's part
and of the machine that reads the token read the generated file job by job: a job "runs the agent" where it runs the entry onDispatch or
onRecordsChanged or installs an agent; the agent's part reads no secret but the key of the participant it is the job for, never the token;
a job that reads the token runs no agent and, on GitHub, runs on the server's runners - a self-hosted runner is a machine the route's agent's
jobs work on - and the workflow grants its own token no write. On GitLab a job receives the CI/CD variables scoped to its
environment: each agent's job is in agent-m-key-<its key> (none for the 0th), the plan in none, the job that writes alone in
agent-m-write, to which the token is scoped, and no job inherits the product's default: or variables:. The counter-proofs plant what the SPEC describes into the generated text - the
key written into it, the built-in token used, the token or another participant's key handed to the agent's job, the writing job moved onto the
agent's runner - and the same checks must then find it.

Written for ITM-1134 by a participant who built none of MOD-runtimes' behaviour (RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER).
"""
import json
import re
import unittest
from pathlib import Path

from jsrun import js

DATA = Path(__file__).with_suffix(".md")
LOCAL = "AGENT M WORKS WITHOUT A LOCAL INSTALLATION"
KEY = "A HOSTED JOB AUTHENTICATES ITS AGENT WITH A CI SECRET"
TOKEN = "A HOSTED JOB WRITES WITH THE PERSON'S TOKEN FROM A CI SECRET"

# The adapter. `input` is the case's input; the value is what the case may state: `available` (routes), `kinds` and `unavailable` (kinds),
# `findings`, `flagged` and `files` (workflow; the key check for the requirement about the agent's key, the token check for the one about the person's token).
WORLD = r"""
const participantOf = (route) => ({ name: "ci-agent", type: "CI agent", model: "example-model", context: 200000, price: null, capabilities: ["draft text"], place: "GitHub Actions", route });
const hostedOffer = (offers) => offers.find((offer) => offer.route.kind === "ci");
const INSTANCE = { repository: "alice/agent-m", commit: "c0ffee0000000000000000000000000000000000" };

// The checks of the generated text. A comment line says what a file does and names no value.
const codeLines = (text) => text.split("\n").filter((line) => line.trim() !== "" && !line.trim().startsWith("#"));
function keyFindings(text, keys) {
  const found = [];
  for (const line of codeLines(text)) for (const key of keys) {
    if (!line.includes(key)) continue;
    const reads = line.trim() === key + ": ${{ secrets." + key + " }}";
    const names = /AGENT_M_KEY_NAMES/.test(line);
    // On GitLab a key is a CI/CD variable scoped to the environment of its agent's job, which is named after it.
    const scope = line.trim() === "name: agent-m-key-" + key;
    if (!reads && !names && !scope) found.push("key " + key + " is not read from the secret of that name: " + line.trim());
  }
  for (const line of codeLines(text)) if (/\bsk-[A-Za-z0-9-]{8,}/.test(line)) found.push("a key value is written into the workflow: " + line.trim());
  return found;
}
function tokenFindings(text, server, token) {
  const found = [];
  for (const line of codeLines(text)) if (/secrets\.GITHUB_TOKEN|github\.token|\bGITHUB_TOKEN\b|CI_JOB_TOKEN/.test(line)) found.push("the workflow's own token is used: " + line.trim());
  const lines = codeLines(text).map((line) => line.trim());
  if (server === "github") {
    const checkouts = lines.filter((line) => line.startsWith("token:"));
    if (checkouts.length < 2) found.push("fewer than two checkouts carry a token");
    for (const line of checkouts) if (line !== "token: ${{ secrets." + token + " }}") found.push("a checkout does not authenticate with the named secret: " + line);
    if (!lines.includes("AGENT_M_TOKEN: ${{ secrets." + token + " }}")) found.push("the entry is not given the named secret as its token");
  } else {
    if (!lines.some((line) => line.includes('printenv "$AGENT_M_TOKEN_NAME"'))) found.push("the token is not read from the variable the job names");
    if (!lines.some((line) => line.includes("AGENT_M_TOKEN_NAME") && line.includes('"' + token + '"'))) found.push("the job does not name the token variable");
    // The product's checkout pushes with the token through a credential helper of that checkout.
    if (!lines.some((line) => line.includes("credential.helper") && line.includes("password=$AGENT_M_TOKEN"))) found.push("the product's checkout does not push with the token");
  }
  return found;
}

if (input.check === "routes") {
  const me = participantOf(input.participantRoute);
  const offer = hostedOrRunner(runtimes.routesFor(me, [me], input.product, input.needs));
  return { available: offer.available };
}
if (input.check === "kinds") {
  const me = participantOf(input.participantRoute);
  const names = await jobCatalogue.kindNames();
  const unavailable = [];
  let seen = 0;
  for (const name of names) {
    const kind = await jobCatalogue.kindOf(name);
    if (kind.resources !== "none") continue;
    seen += 1;
    if (!hostedOrRunner(runtimes.routesFor(me, [me], input.product, [])).available) unavailable.push(name);
  }
  return { kinds: seen > 0, unavailable };
}
const files = runtimes.jobWorkflowFiles(input.server, INSTANCE, { token: input.token, keys: input.keys }, input.runners);
// The checks of the key and token sentences read the generated job workflow's files: the file beside it, which runs onMainChanged, runs no agent and no job of Agent M.
let text = files.filter((file) => !/agent-m-main-changed\.yml$/.test(file.path)).map((file) => file.text).join("\n");
if (input.plant === "key-literal") {
  const key = input.keys[0];
  text = input.server === "github" ? text.replace("      " + key + ": ${{ secrets." + key + " }}", "      " + key + ": sk-ant-LITERAL-0123456789") : text.replace("  variables:\n", "  variables:\n    " + key + ": sk-ant-LITERAL-0123456789\n");
}
if (input.plant === "builtin-token") {
  text = input.server === "github" ? text.replace("token: ${{ secrets." + input.token + " }}", "token: ${{ secrets.GITHUB_TOKEN }}") : text.replace("password=$AGENT_M_TOKEN", "password=$CI_JOB_TOKEN");
}
if (input.plant === "token-in-agent") {
  // On GitLab, the agent's job for the first key placed in the environment the token is scoped to.
  if (input.server === "gitlab") text = text.replace("    name: agent-m-key-" + input.keys[0] + "\n", "    name: agent-m-write\n");
  else text = text.replace('      AGENT_M_KEY: "1"\n', '      AGENT_M_KEY: "1"\n      ' + input.token + ": ${{ secrets." + input.token + " }}\n");
}
if (input.plant === "other-key-in-agent") {
  const [first, second] = input.keys;
  // On GitLab, the agent's job for the first key placed in the environment of the second.
  if (input.server === "gitlab") text = text.replace("    name: agent-m-key-" + first + "\n", "    name: agent-m-key-" + second + "\n");
  else text = text.replace('      AGENT_M_KEY: "1"\n      ' + first + ": ${{ secrets." + first + " }}\n",
    '      AGENT_M_KEY: "1"\n      ' + first + ": ${{ secrets." + first + " }}\n      " + second + ": ${{ secrets." + second + " }}\n");
}
if (input.plant === "writer-on-runner") {
  const label = input.runners.find((runner) => runner !== "hosted");
  text = text.replace(new RegExp("(\\n  runner-" + label + ":\\n(?:    .*\\n)*?    runs-on: )ubuntu-latest"), '$1[self-hosted, "' + label + '"]');
}
if (input.plant === "inherited-variables") {
  text = text.replace("  inherit:\n    default: false\n    variables: false\n", "  inherit:\n    default: false\n    variables: true\n");
}
if (input.plant === "write-permission") {
  text = text.replace("permissions:\n  contents: read", "permissions:\n  contents: write");
}
const RULES = { key: () => keyFindings(text, input.keys), token: () => tokenFindings(text, input.server, input.token),
  "agent-part": () => agentPartFindings(text, input.server, input.token, input.keys),
  "token-machine": () => tokenMachineFindings(text, input.server, input.token) };
const findings = RULES[input.rule]();
return { findings, flagged: findings.length > 0, files: files.length };

// The jobs of the generated job file, each with what this file's checks read of it: the secrets it reads, whether it runs an agent - an entry that runs a
// job's participant (onDispatch, onRecordsChanged) or the install of an agent -, whether it uses the person's token, its runner, and on GitHub the place of
// the key it is the agent's job for. On GitHub a job is a key two spaces in under `jobs:`; on GitLab a key at the start of a line of the job file.
function jobsOf(text, server) {
  const lines = text.split("\n");
  const start = server === "github" ? lines.findIndex((line) => /^jobs:\s*$/.test(line)) + 1 : lines.findIndex((line) => /^---\s*$/.test(line)) + 1;
  const head = server === "github" ? /^  ([A-Za-z0-9_.-]+):\s*$/ : /^([A-Za-z0-9_.-]+):\s*$/;
  const jobs = [];
  let current = null;
  for (const line of lines.slice(start)) {
    const found = head.exec(line);
    if (found) { current = { id: found[1], lines: [] }; jobs.push(current); continue; }
    if (server === "github" && /^\S/.test(line) && !line.startsWith("#")) current = null;
    if (current) current.lines.push(line);
  }
  // On GitLab the text ends with the product's .gitlab-ci.yml, whose keys spec: and include: are no jobs.
  return jobs.filter((job) => server === "github" || !["spec", "include"].includes(job.id)).map((job) => {
    const body = codeLines(job.lines.join("\n")).join("\n");
    const environment = /^\s*environment:\s*\n\s*name:\s*(\S+)/m.exec(body)?.[1] ?? null;
    const scoped = server === "github" ? [] : environment === "agent-m-write" ? [input.token] : environment?.startsWith("agent-m-key-") ? [environment.slice("agent-m-key-".length)] : [];
    return {
      id: job.id,
      secrets: [...new Set([...scoped, ...[...body.matchAll(/secrets\.([A-Za-z_][A-Za-z0-9_]*)/g)].map((match) => match[1])])],
      // On GitLab what a job receives is the variables scoped to its environment (each key to agent-m-key-<its name>, the token to agent-m-write).
      runsAgent: /main\.mjs (onDispatch|onRecordsChanged)\b|AGENT_M_ENTRY: (onDispatch|onRecordsChanged)\b|opencode/.test(body),
      usesToken: /\$AGENT_M_TOKEN\b|printenv "\$AGENT_M_TOKEN_NAME"/.test(body),
      runsOn: /^\s*runs-on:\s*(.+)$/m.exec(body)?.[1].trim() ?? null,
      key: /AGENT_M_KEY: "(\d+)"/.exec(body)?.[1] ?? null,
      environment: /^\s*environment:\s*\n\s*name:\s*(\S+)/m.exec(body)?.[1] ?? null,
      inheritsNothing: /^\s*inherit:\s*\n\s*default: false\s*\n\s*variables: false\s*$/m.test(body),
    };
  });
}

// A HOSTED JOB AUTHENTICATES ITS AGENT WITH A CI SECRET: "the part of it that runs the agent reads no other secret" than the key of the participant the job
// names - on GitHub the agent's job for the n-th key reads that key's secret and none other, the 0th none -, never the person's token.
function agentPartFindings(text, server, token, keys) {
  const found = [];
  const agents = jobsOf(text, server).filter((job) => job.runsAgent);
  if (agents.length === 0) found.push("no job of the workflow runs the agent");
  for (const job of agents) {
    if (job.secrets.includes(token) || job.usesToken) found.push("the agent's part " + job.id + " reads the person's token " + token);
    if (job.key === null) { found.push("the agent's part " + job.id + " names no key it is the job for"); continue; }
    const own = Number(job.key) === 0 ? [] : [keys[Number(job.key) - 1]];
    for (const secret of job.secrets) if (secret !== token && !own.includes(secret)) found.push("the agent's part " + job.id + " reads another secret: " + secret);
  }
  if (server === "gitlab") {
    // GitLab gives a job the product's global variables: and default: unless it says not to inherit them, and the plan, which reads no secret, has no environment.
    for (const job of jobsOf(text, server)) {
      if (!job.inheritsNothing) found.push("the job " + job.id + " inherits the product's default: or variables:");
      if (/-plan$/.test(job.id) && job.environment !== null) found.push("the plan " + job.id + " has the environment " + job.environment);
    }
  }
  return found;
}

// A HOSTED JOB WRITES WITH THE PERSON'S TOKEN FROM A CI SECRET: the token is read "on a runner machine that runs no agent", and the workflow's own token cannot
// be what writes. A job that reads the token runs no agent and, on GitHub, runs on the server's runners (ubuntu-latest), never on a self-hosted runner an agent's
// job of the same route may use; the workflow grants its own token no write.
function tokenMachineFindings(text, server, token) {
  const found = [];
  const writers = jobsOf(text, server).filter((job) => job.secrets.includes(token) || job.usesToken);
  if (writers.length === 0) found.push("no job of the workflow reads the person's token");
  for (const job of writers) {
    if (job.runsAgent) found.push("the job " + job.id + " reads the person's token and runs the agent");
    if (server === "gitlab" && job.environment !== "agent-m-write") found.push("the job " + job.id + " reads the person's token outside the environment agent-m-write");
    if (server === "github" && job.runsOn !== "ubuntu-latest") found.push("the job " + job.id + " reads the person's token on the runner " + job.runsOn);
  }
  if (server === "github") for (const line of codeLines(text)) if (/:\s*write(-all)?\s*$|permissions:\s*write-all/.test(line)) found.push("the workflow's own token may write: " + line.trim());
  return found;
}

function hostedOrRunner(offers) { return offers[0]; }
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


def run_world(argument: dict) -> dict:
    return js(f"const input = {json.dumps(argument)};\n{WORLD}")


def check(test: unittest.TestCase, section: str, rule: str | None = None) -> None:
    for loaded in cases(section):
        with test.subTest(case=loaded["name"]):
            got = run_world({**loaded["case"]["input"], "rule": rule})
            wanted = loaded["case"]["expected"]
            test.assertEqual({key: got[key] for key in wanted}, wanted)


class TestRuntimeLevels(unittest.TestCase):
    # TST-1134001 · level: release · module: MOD-runtimes
    # guards: AGENT M WORKS WITHOUT A LOCAL INSTALLATION
    # given: the cases under that requirement in the Markdown file beside this one: a CI agent on the server's own runners and a product with the job workflow, with every kind of the catalogue whose definition names no local resource, and with a job whose resources need neither a Bridge nor a runner
    # input: routesFor for the agent, with no needs
    # expect: the hosted-CI route is offered for every such kind (the sweep read kinds and none is unavailable) and for the job that needs no Bridge and no runner
    def test_every_job_without_a_local_resource_is_runnable_on_the_hosted_ci_route(self):
        check(self, LOCAL)

    # TST-1134002 · level: release · module: MOD-runtimes
    # guards: AGENT M WORKS WITHOUT A LOCAL INSTALLATION; A JOB RUNS ONLY WHERE ITS RESOURCES ARE REACHABLE
    # given: the counter-proofs: a job needing a compute resource reached by a Bridge, and one reached by a self-hosted runner, for the same agent and product; the agent on that runner
    # input: routesFor with the need
    # expect: the hosted-CI route is not offered for either; the runner that reaches the resource is offered
    def test_a_job_needing_a_compute_resource_is_not_offered_on_the_hosted_ci_route(self):
        check(self, LOCAL + ": counter-proofs")

    # TST-1134003 · level: release · module: MOD-runtimes
    # guards: A HOSTED JOB AUTHENTICATES ITS AGENT WITH A CI SECRET
    # given: the cases under that requirement: the generated job workflow for GitHub and for GitLab, with the agent keys KEY_A and KEY_B named as CI secrets
    # input: jobWorkflowFiles for each server
    # expect: the check of this file finds no line that names a key other than as the secret it reads or in the list of key names, and no key value
    def test_the_generated_workflow_reads_the_agent_key_only_from_the_named_secret(self):
        check(self, KEY, "key")

    # TST-1134004 · level: release · module: MOD-runtimes
    # guards: A HOSTED JOB AUTHENTICATES ITS AGENT WITH A CI SECRET
    # given: the counter-proofs: the generated workflow in which a key value is written in place of the secret, for GitHub and for GitLab
    # input: the same check over the changed text
    # expect: the check finds it (flagged)
    def test_a_workflow_with_the_key_written_into_it_fails(self):
        check(self, KEY + ": counter-proofs", "key")

    # TST-1134005 · level: release · module: MOD-runtimes
    # guards: A HOSTED JOB WRITES WITH THE PERSON'S TOKEN FROM A CI SECRET
    # given: the cases under that requirement: the generated workflow for GitHub and for GitLab, with the token secret AGENT_M_TOKEN
    # input: jobWorkflowFiles for each server
    # expect: every checkout of the GitHub workflow takes the named secret and the entry is given it; the GitLab job reads the named variable and clones with it; neither uses the workflow's own token (GITHUB_TOKEN, github.token, CI_JOB_TOKEN)
    def test_the_generated_workflow_authenticates_with_the_named_token_secret(self):
        check(self, TOKEN, "token")

    # TST-1134006 · level: release · module: MOD-runtimes
    # guards: A HOSTED JOB WRITES WITH THE PERSON'S TOKEN FROM A CI SECRET
    # given: the counter-proofs: the generated GitHub workflow in which a checkout takes GITHUB_TOKEN, and the GitLab job in which the clone takes CI_JOB_TOKEN
    # input: the same check over the changed text
    # expect: the check finds it (flagged)
    def test_a_workflow_that_uses_the_built_in_token_fails(self):
        check(self, TOKEN + ": counter-proofs", "token")

    # TST-1134007 · level: release · module: MOD-runtimes
    # guards: A HOSTED JOB AUTHENTICATES ITS AGENT WITH A CI SECRET
    # given: the cases under "the part that runs the agent" in the Markdown file: the generated job workflow for GitHub and for GitLab, with the agent keys KEY_A and KEY_B and the token secret AGENT_M_TOKEN
    # input: jobWorkflowFiles for each server; the check of this file over every job that runs an agent (onDispatch, onRecordsChanged, the install of an agent)
    # expect: no finding: each such job reads only the key it is the job for (on GitHub the n-th key for the n-th agent's job, none for the 0th), and none reads AGENT_M_TOKEN
    def test_the_part_that_runs_the_agent_reads_no_other_secret(self):
        check(self, KEY + ": the part that runs the agent", "agent-part")

    # TST-1134008 · level: release · module: MOD-runtimes
    # guards: A HOSTED JOB AUTHENTICATES ITS AGENT WITH A CI SECRET
    # given: the counter-proofs: the generated GitHub workflow whose agent's job for KEY_A also reads AGENT_M_TOKEN, and one whose agent's job for KEY_A also reads KEY_B, another participant's key
    # input: the same check over the changed text
    # expect: the check finds it (flagged)
    def test_an_agent_part_that_reads_the_token_or_another_key_fails(self):
        check(self, KEY + ": the part that runs the agent, counter-proofs", "agent-part")

    # TST-1134009 · level: release · module: MOD-runtimes
    # guards: A HOSTED JOB WRITES WITH THE PERSON'S TOKEN FROM A CI SECRET
    # given: the cases under "the machine that reads the token" in the Markdown file: the generated job workflow for GitHub and for GitLab
    # input: jobWorkflowFiles for each server; the check of this file over every job that reads the token
    # expect: no finding: each job that reads the token runs no agent and, on GitHub, runs on the server's runners, never on a self-hosted one; the workflow grants its own token no write
    def test_the_token_is_read_only_on_a_machine_that_runs_no_agent(self):
        check(self, TOKEN + ": the machine that reads the token", "token-machine")

    # TST-1134010 · level: release · module: MOD-runtimes
    # guards: A HOSTED JOB WRITES WITH THE PERSON'S TOKEN FROM A CI SECRET
    # given: the counter-proofs: the generated GitHub workflow that hands the token secret to the agent's job, one whose writing job runs on the self-hosted runner its agents use, and one that grants the workflow's own token write access
    # input: the same check over the changed text
    # expect: the check finds it (flagged)
    def test_a_workflow_that_hands_the_token_to_the_agent_machine_fails(self):
        check(self, TOKEN + ": the machine that reads the token, counter-proofs", "token-machine")


if __name__ == "__main__":
    unittest.main()
