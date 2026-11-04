# Module: MOD-bridge-client
# Guards: THE MAILBOX PASSWORD LEAVES THE BROWSER ONLY TO THE BRIDGE
# Level: release
"""SPEC section 14 - the check named tests/test_mail_password_route.py.

The cases live in tests/test_mail_password_route.md. This file loads them and records every request made by a mailbox
test while two Bridges are stored in the fixture input.
"""
import json
import re
import unittest
from pathlib import Path

from jsrun import js

DATA = Path(__file__).with_suffix(".md")
RULE = "THE MAILBOX PASSWORD LEAVES THE BROWSER ONLY TO THE BRIDGE"

JS_CHECK = """
const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json", ...headers },
});

function headersOf(headers) {
  if (!headers) return {};
  if (typeof headers.entries === "function") return Object.fromEntries(headers.entries());
  return Object.fromEntries(Object.entries(headers));
}

async function mailPasswordRouteResult(input) {
  const calls = [];
  globalThis.fetch = async (address, init = {}) => {
    calls.push({ url: String(address), method: init.method ?? "GET", headers: headersOf(init.headers), body: init.body ?? null });
    return json(input.bridgeAnswer);
  };
  const selectedName = input.connection.imap.bridge;
  const selected = input.bridges[selectedName];
  const answer = await mailRoutes.mailbox(input.connection, bridgeClient.bridgeAt(selected)).test();
  const password = input.connection.imap.password;
  return {
    selectedBridge: selectedName,
    storedBridgeNames: Object.keys(input.bridges).sort(),
    answer,
    requests: calls.map((call) => {
      const parsed = JSON.parse(call.body);
      const selectedAddress = selected.address.replace(/\\/+$/, "");
      const unselectedAddresses = Object.entries(input.bridges).filter(([name]) => name !== selectedName)
        .map(([, bridge]) => bridge.address.replace(/\\/+$/, ""));
      return {
        url: call.url,
        method: call.method,
        selectedAddress: call.url.startsWith(selectedAddress),
        unselectedAddress: unselectedAddresses.some((address) => call.url.startsWith(address)),
        bodyBridge: parsed.connection.imap.bridge,
        bodyPassword: parsed.connection.imap.password,
        passwordInUrl: call.url.includes(password),
        passwordInHeaders: JSON.stringify(call.headers).includes(password),
        passwordInBody: call.body.includes(password),
        bridgeToken: call.headers["x-agent-m-bridge-token"] ?? null,
        jumpHostLogin: Boolean(call.headers.Authorization),
      };
    }),
  };
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
    return js(JS_CHECK + "return await mailPasswordRouteResult(%s);" % json.dumps(case["input"]))


class TestMailPasswordRoute(unittest.TestCase):
    # TST-532003 · level: release · module: system
    # guards: THE MAILBOX PASSWORD LEAVES THE BROWSER ONLY TO THE BRIDGE
    # given: the Markdown cases, each with two stored Bridges and an IMAP connection naming one of them
    # input: each connection tested through MOD-mail-routes with the selected MOD-bridge-client Bridge
    # expect: every outgoing request goes to the selected Bridge address, carries the selected Bridge name and password in the body, and carries no password in the URL or headers
    def test_each_password_route_case_matches_its_expected_request_trace(self):
        for loaded in cases():
            with self.subTest(case=loaded["name"]):
                self.assertEqual(result(loaded["case"]), loaded["case"]["expected"])

    # TST-532004 · level: release · module: system
    # guards: THE MAILBOX PASSWORD LEAVES THE BROWSER ONLY TO THE BRIDGE
    # given: the loaded password-route cases
    # input: their expected traces
    # expect: the selected Bridge changes while the stored Bridges stay two, and no expected request places the password in a URL, header or unselected Bridge request
    def test_cases_cover_two_stored_bridges_and_password_only_to_the_selected_bridge(self):
        expected = [case["case"]["expected"] for case in cases()]
        self.assertEqual({tuple(item["storedBridgeNames"]) for item in expected}, {("gpu-box", "laptop")})
        self.assertEqual({item["selectedBridge"] for item in expected}, {"gpu-box", "laptop"})
        for item in expected:
            self.assertEqual(len(item["requests"]), 1)
            request = item["requests"][0]
            self.assertTrue(request["selectedAddress"])
            self.assertFalse(request["unselectedAddress"])
            self.assertTrue(request["passwordInBody"])
            self.assertFalse(request["passwordInUrl"])
            self.assertFalse(request["passwordInHeaders"])


if __name__ == "__main__":
    unittest.main()
