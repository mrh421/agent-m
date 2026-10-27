# Module: MOD-agent-processes
# Guards: THE BRIDGE FINDS THE INSTALLED AGENTS; A LOCAL AGENT USES THE PERSON'S OWN LOGIN; UC-044
# Level: release
"""SPEC section 14 - the check named tests/test_bridge_agents.py.

The cases live in tests/test_bridge_agents.md. This file loads them, puts fixture executables of supported agents on the
path and asks MOD-agent-processes, in Node, which agents are installed and what command its driver starts. That only the
chosen agents are offered is MOD-bridge-jobs' and is not checked here.
"""
import json
import os
import re
import stat
import subprocess
import tempfile
import unittest
from pathlib import Path

DATA = Path(__file__).with_suffix(".md")
ROOT = Path(__file__).resolve().parents[1]
INDEX = (ROOT / "src" / "agent-processes" / "index.mjs").as_uri()
REGISTER = ROOT / "src" / "agent-processes" / "agents.md"

# What a fixture answers to the register's version and login commands (agents.md), per agent.
LOGIN = {
    "claude": ("auth status", "exit 0", "exit 1"),
    "codex": ("login status", "exit 0", "exit 1"),
    "opencode": ("models", "echo opencode/big-pickle", ":"),
}

# What a fixture prints as its answer "ok" to a task, in the output its register row reads (agents.md), per agent.
ANSWER = {
    "claude": """echo '{"type":"result","subtype":"success","is_error":false,"result":"ok"}'""",
    "codex": "echo ok",
    "opencode": "echo ok",
}

JS = """
import { installedAgents, agentDriver } from "__INDEX__";
import { readFileSync } from "node:fs";
const input = __INPUT__;
process.env.PATH = input.folder;
delete process.env.CI;
delete process.env.GITHUB_ACTIONS;
if (input.kind === "discovery") {
  process.stdout.write(JSON.stringify(await installedAgents()));
} else {
  for (const name of input.keyVariables) process.env[name] = "secret-value-of-" + name;
  process.env.AGENT_M_FIXTURE_MARKER = "present";
  const agent = (await installedAgents()).find((candidate) => candidate.name === input.agent);
  const participant = { name: "fixture", type: "CLI agent", model: "m", context: 1, price: null, capabilities: [],
    place: "fixture", route: "fixture" };
  const driver = agentDriver(agent, { workdir: input.folder, keyVariable: input.keyVariable, endpoint: null }, participant);
  const answer = await driver.send({ prompt: "Say ok.", parts: [], output: null, findings: [], previous: null, workdir: null });
  process.stdout.write(JSON.stringify({ answer: answer.text, args: readFileSync(input.folder + "/args", "utf8"),
    env: readFileSync(input.folder + "/env", "utf8") }));
}
"""


def fence(body: str, heading: str) -> str:
    match = re.search(rf"^### {re.escape(heading)}\n\n```[a-z]*\n(.*?)\n```", body, re.M | re.S)
    if not match:
        raise AssertionError(f"missing fenced block under {heading}")
    return match.group(1)


def cases() -> list[dict]:
    text = DATA.read_text(encoding="utf-8")
    found = [{"name": m.group("name"), "case": json.loads(fence(m.group("body"), "Case"))}
             for m in re.finditer(r"^## (?P<name>[^\n]+)\n(?P<body>.*?)(?=^## |\Z)", text, re.M | re.S)]
    if not found:
        raise AssertionError("no cases loaded")
    return found


def key_variables() -> list[str]:
    """The key variables of the register: the column 'Key variable' of agents.md, '—' excluded."""
    rows = [line.split("|")[1:-1] for line in REGISTER.read_text(encoding="utf-8").splitlines() if line.startswith("| ")]
    column = [cell.strip() for cell in rows[0]].index("Key variable")
    return [row[column].strip() for row in rows[1:] if row[column].strip() != "—"]


def executable(folder: Path, name: str, body: str) -> None:
    path = folder / name
    path.write_text(f"#!/bin/sh\n{body}\n", encoding="utf-8")
    path.chmod(path.stat().st_mode | stat.S_IXUSR)


def fixture_agent(folder: Path, name: str, version: str, logged_in: bool) -> None:
    login, yes, no = LOGIN[name]
    executable(folder, name, f"""case "$*" in
  '--version') echo '{version}';;
  '{login}') {yes if logged_in else no};;
  *) printf '%s' "$*" > "{folder}/args"; /usr/bin/env > "{folder}/env"; {ANSWER[name]};;
esac""")


def run(case_input: dict, folder: Path) -> dict:
    data = {**case_input, "folder": str(folder), "keyVariables": key_variables()}
    code = JS.replace("__INDEX__", INDEX).replace("__INPUT__", json.dumps(data))
    done = subprocess.run(["node", "--input-type=module", "-e", code], cwd=ROOT, capture_output=True, text=True,
                          env={"PATH": os.environ["PATH"], "HOME": str(folder)})
    if done.returncode != 0:
        raise AssertionError(done.stderr.strip()[-1200:])
    return json.loads(done.stdout)


def discovery(case: dict):
    with tempfile.TemporaryDirectory() as tmp:
        folder = Path(tmp)
        for name, spec in case["input"]["fixtures"].items():
            fixture_agent(folder, name, spec["version"], spec["loggedIn"])
        return run(case["input"], folder)


def own_login(case: dict) -> dict:
    with tempfile.TemporaryDirectory() as tmp:
        folder = Path(tmp)
        fixture_agent(folder, case["input"]["agent"], "2.1.300", True)
        got = run(case["input"], folder)
    keys = key_variables()
    environment = {line.split("=", 1)[0] for line in got["env"].splitlines() if "=" in line}
    return {
        "answer": got["answer"],
        "keysSetInParent": len(keys) > 0,
        "environmentRecorded": "AGENT_M_FIXTURE_MARKER" in environment,
        "keyValueInCommand": any(f"secret-value-of-{key}" in got["args"] for key in keys),
        "keyVariableNameInCommand": any(key in got["args"] for key in keys),
        "keyVariablesInEnvironment": sorted(environment & set(keys)),
    }


class TestBridgeAgents(unittest.TestCase):
    # TST-815001 · level: release · module: MOD-agent-processes
    # guards: THE BRIDGE FINDS THE INSTALLED AGENTS; UC-044
    # given: the Markdown discovery cases beside this file, each with fixture executables of some supported agents alone on the path
    # input: installedAgents() asks the path which supported agents are there
    # expect: exactly the agents with a fixture are installed, each with the version its fixture reports, the others missing with their installation page; an installed agent not logged in is marked so with its login step
    def test_exactly_the_installed_agents_are_listed_with_their_versions(self):
        for loaded in cases():
            if loaded["case"]["input"]["kind"] != "discovery":
                continue
            with self.subTest(case=loaded["name"]):
                self.assertEqual(discovery(loaded["case"]), loaded["case"]["expected"])

    # TST-815002 · level: release · module: MOD-agent-processes
    # guards: A LOCAL AGENT USES THE PERSON'S OWN LOGIN; UC-044
    # given: outside CI, a logged-in fixture agent that records its arguments and environment, and every key variable of the register set in the bridge's own process
    # input: agentDriver(agent, { keyVariable: null }) sends a task
    # expect: the agent answers, its recorded command carries no key value and no key variable name, and its recorded environment holds no key variable of the register
    def test_the_command_the_driver_starts_carries_no_key(self):
        for loaded in cases():
            if loaded["case"]["input"]["kind"] != "own-login":
                continue
            with self.subTest(case=loaded["name"]):
                self.assertEqual(own_login(loaded["case"]), loaded["case"]["expected"])


if __name__ == "__main__":
    unittest.main()
