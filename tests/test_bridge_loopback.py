# Module: MOD-bridge-http
# Guards: THE LOCAL BRIDGE BINDS TO LOOPBACK ONLY
# Level: release
"""SPEC section 14 - the check named tests/test_bridge_loopback.py.

The cases live in tests/test_bridge_loopback.md. This file loads them and drives the real serveBridge of MOD-bridge-http
in Node on a temporary data folder.
"""
import json
import re
import subprocess
import unittest
from pathlib import Path

DATA = Path(__file__).with_suffix(".md")
ROOT = Path(__file__).resolve().parents[1]
BRIDGE = (ROOT / "src" / "bridge-http" / "index.mjs").as_uri()

JS_CHECK = r"""
import { mkdtempSync, rmSync } from "node:fs";
import http from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { serveBridge } from "__BRIDGE_URL__";

const ORIGIN = "https://release-owner.github.io";
console.info = () => {};

const pair = (address, token) => new Promise((resolve, reject) => {
  const request = http.request(`${address}/v1/pair`, { headers: { Origin: ORIGIN, "x-agent-m-bridge-token": token, connection: "close" } }, (response) => {
    response.resume();
    response.on("end", () => resolve(response.statusCode));
  });
  request.on("error", reject);
  request.end();
});

async function run(input) {
  const folder = mkdtempSync(join(tmpdir(), "agent-m-813-loopback-"));
  let bridge;
  try {
    bridge = await serveBridge({ name: () => "lab-pc", host: input.host, port: 0, origin: ORIGIN, dataFolder: folder, paused: () => false }, {});
    return {
      outcome: "started",
      addressIsLoopback: /^http:\/\/(127\.0\.0\.1|\[::1\]):\d+$/.test(bridge.address),
      answersPairWithToken: (await pair(bridge.address, bridge.token)) === 200,
    };
  } catch (error) {
    return { outcome: error.name };
  } finally {
    await bridge?.close();
    rmSync(folder, { recursive: true, force: true });
  }
}
"""


def fence(body: str, heading: str) -> str:
    match = re.search(rf"^### {re.escape(heading)}\n\n```[a-z]*\n(.*?)\n```", body, re.M | re.S)
    if not match:
        raise AssertionError(f"missing fenced block under {heading}")
    return match.group(1)


def cases() -> list[dict]:
    text = DATA.read_text(encoding="utf-8")
    found = []
    for match in re.finditer(r"^## (?P<name>[^\n]+)\n(?P<body>.*?)(?=^## |\Z)", text, re.M | re.S):
        found.append({"name": match.group("name"), "case": json.loads(fence(match.group("body"), "Case"))})
    if not found:
        raise AssertionError("no cases loaded")
    return found


def result(case: dict) -> dict:
    code = (JS_CHECK.replace("__BRIDGE_URL__", BRIDGE)
            + f"\nconst input = {json.dumps(case['input'])};"
              "\nprocess.stdout.write(JSON.stringify(await run(input)));")
    run = subprocess.run(["node", "--input-type=module", "-e", code], cwd=ROOT, capture_output=True, text=True)
    if run.returncode != 0:
        raise AssertionError(run.stderr.strip()[-1200:])
    return json.loads(run.stdout)


class TestBridgeLoopback(unittest.TestCase):
    # TST-813001 · level: release · module: MOD-bridge-http
    # guards: THE LOCAL BRIDGE BINDS TO LOOPBACK ONLY
    # given: the Markdown cases beside this file, each starting the real serveBridge on a temporary data folder with a host
    # input: serveBridge is started with 127.0.0.1, ::1, localhost, 0.0.0.0, the empty host, 192.168.1.20 and ::
    # expect: the three loopback hosts start a server on a loopback address that answers with the token; every other host is refused with BindRefused
    def test_each_host_is_accepted_or_refused_as_the_requirement_says(self):
        for loaded in cases():
            with self.subTest(case=loaded["name"]):
                self.assertEqual(result(loaded["case"]), loaded["case"]["expected"])


if __name__ == "__main__":
    unittest.main()
