# Module: MOD-bridge-http
# Guards: THE LOCAL BRIDGE REQUIRES A TOKEN; THE BRIDGE IS PAIRED ONCE
# Level: release
"""SPEC section 14 - the check named tests/test_bridge_token.py.

The cases live in tests/test_bridge_token.md. This file loads them and drives the real serveBridge and pairAnew of
MOD-bridge-http in Node on a temporary data folder.
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
import { mkdtempSync, rmSync, statSync } from "node:fs";
import http from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pairAnew, serveBridge } from "__BRIDGE_URL__";

const ORIGIN = "https://release-owner.github.io";
console.info = () => {};

const answerAll = () => new Proxy({}, { get: () => async () => ({}) });
const handlers = { jobs: answerAll(), mail: answerAll(), tunnels: answerAll() };

const call = (address, method, path, token) => new Promise((resolve, reject) => {
  const headers = { Origin: ORIGIN, connection: "close", "content-type": "application/json" };
  if (token !== null) headers["x-agent-m-bridge-token"] = token;
  const request = http.request(`${address}${path}`, { method, headers }, (response) => {
    let text = "";
    response.on("data", (chunk) => { text += chunk; });
    response.on("end", () => resolve({ status: response.statusCode, error: (() => { try { return JSON.parse(text).error; } catch { return undefined; } })() }));
  });
  request.on("error", reject);
  request.end(method === "POST" ? "{}" : undefined);
});

const start = (folder) => serveBridge({ name: () => "lab-pc", host: "127.0.0.1", port: 0, origin: ORIGIN, dataFolder: folder, paused: () => false }, handlers);

async function routes(input, folder) {
  const bridge = await start(folder);
  try {
    const refused = async (token) => {
      const failed = [];
      for (const [method, path] of input.routes) {
        const answer = await call(bridge.address, method, path, token);
        if (answer.status !== 401 || answer.error !== "token-refused") failed.push(`${method} ${path} -> ${answer.status}`);
      }
      return failed.length ? failed.join("; ") : "401 token-refused on every route";
    };
    const answered = [];
    for (const [method, path] of input.routes) {
      const answer = await call(bridge.address, method, path, bridge.token);
      if (answer.status === 401) answered.push(`${method} ${path}`);
    }
    const pair = await call(bridge.address, "GET", "/v1/pair", bridge.token);
    return {
      withoutToken: await refused(null),
      withAnotherToken: await refused(bridge.token + "x"),
      withToken: answered.length === 0 && pair.status === 200 ? "no route answers 401, and GET /v1/pair answers 200" : `401 on ${answered.join(", ")}; pair ${pair.status}`,
    };
  } finally { await bridge.close(); }
}

async function restart(_input, folder) {
  const first = await start(folder);
  const token = first.token;
  await first.close();
  const second = await start(folder);
  try {
    return {
      sameTokenAfterRestart: second.token === token,
      storedTokenAccepted: (await call(second.address, "GET", "/v1/pair", token)).status,
      fileMode: (statSync(join(folder, "pairing-token")).mode & 0o777).toString(8),
    };
  } finally { await second.close(); }
}

async function pairingAnew(_input, folder) {
  const bridge = await start(folder);
  try {
    const fresh = await pairAnew(folder, null);
    const old = await call(bridge.address, "GET", "/v1/pair", bridge.token);
    const now = await call(bridge.address, "GET", "/v1/pair", fresh);
    return { newTokenDiffers: fresh !== bridge.token, oldTokenStatus: old.status, oldTokenError: old.error, newTokenStatus: now.status };
  } finally { await bridge.close(); }
}

async function run(input) {
  const folder = mkdtempSync(join(tmpdir(), "agent-m-813-token-"));
  try {
    return await { routes, restart, "pair-anew": pairingAnew }[input.kind](input, folder);
  } finally { rmSync(folder, { recursive: true, force: true }); }
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


def of_kind(kind: str) -> list[dict]:
    return [loaded for loaded in cases() if loaded["case"]["input"]["kind"] == kind]


class TestBridgeToken(unittest.TestCase):
    # TST-813002 · level: release · module: MOD-bridge-http
    # guards: THE LOCAL BRIDGE REQUIRES A TOKEN
    # given: a running Bridge on 127.0.0.1 with its pairing token and handlers that answer every route; requests carry the instance's origin
    # input: a request to each route of the protocol and to an unknown route, without the token, with another token, and with the token
    # expect: without the token and with another one every route answers 401 token-refused; with the token none answers 401 and GET /v1/pair answers 200
    def test_every_route_refuses_a_request_without_the_paired_token(self):
        for loaded in of_kind("routes"):
            with self.subTest(case=loaded["name"]):
                self.assertEqual(result(loaded["case"]), loaded["case"]["expected"])

    # TST-813003 · level: release · module: MOD-bridge-http
    # guards: THE BRIDGE IS PAIRED ONCE
    # given: a Bridge that made its token on an empty data folder and was closed, then a second Bridge on the same folder
    # input: the second Bridge's token, a request carrying the stored token, and the mode of the token's file
    # expect: the token is the same, the request is answered 200, and the file is readable and writable by its owner only (mode 600)
    def test_the_stored_token_is_accepted_after_a_restart_and_its_file_is_private(self):
        for loaded in of_kind("restart"):
            with self.subTest(case=loaded["name"]):
                self.assertEqual(result(loaded["case"]), loaded["case"]["expected"])

    # TST-813004 · level: release · module: MOD-bridge-http
    # guards: THE BRIDGE IS PAIRED ONCE
    # given: a running Bridge with its token, and pairAnew called on its data folder while it keeps running
    # input: a request with the old token and one with the new token to the running server
    # expect: the new token differs; the old token is answered 401 token-refused, the new one 200
    def test_after_pairing_anew_the_old_token_is_refused_by_the_running_server(self):
        for loaded in of_kind("pair-anew"):
            with self.subTest(case=loaded["name"]):
                self.assertEqual(result(loaded["case"]), loaded["case"]["expected"])


if __name__ == "__main__":
    unittest.main()
