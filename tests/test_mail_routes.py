# Module: MOD-bridge-client
# Guards: A MAILBOX IS REACHED THROUGH ITS PROVIDER'S WEB API OR THROUGH THE BRIDGE; AN API MAILBOX IS OPENED BY THE PROVIDER'S SIGN-IN; THE MAIL SIGN-IN ASKS ONLY FOR READING, DRAFTING AND SENDING
# Level: release
"""SPEC section 14 - the check named tests/test_mail_routes.py.

The cases live in tests/test_mail_routes.md. This file loads them and asks MOD-mail-routes, with MOD-bridge-client for
Bridge connections, for the mailbox route and sign-in behaviour the release check names.
"""
import json
import re
import unittest
from pathlib import Path

from jsrun import js

DATA = Path(__file__).with_suffix(".md")
SCOPES = ["Mail.ReadWrite", "Mail.Send", "offline_access"]
RULES = {
    "A MAILBOX IS REACHED THROUGH ITS PROVIDER'S WEB API OR THROUGH THE BRIDGE",
    "AN API MAILBOX IS OPENED BY THE PROVIDER'S SIGN-IN",
    "THE MAIL SIGN-IN ASKS ONLY FOR READING, DRAFTING AND SENDING",
}

JS_CHECK = """
const GRAPH = "https://graph.microsoft.com/v1.0";
const SIGN_IN_SERVICE = "https://login.microsoftonline.com";
const DEFAULT_SCOPES = ["Mail.ReadWrite", "Mail.Send", "offline_access"];
globalThis.location = { hostname: "alice.github.io", pathname: "/agent-m/", origin: "https://alice.github.io", href: "https://alice.github.io/agent-m/" };

const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json", ...headers },
});

function headersOf(headers) {
  if (!headers) return {};
  if (typeof headers.entries === "function") return Object.fromEntries(headers.entries());
  return Object.fromEntries(Object.entries(headers));
}

function fakeMsal(input = {}) {
  const seen = { configs: [], logins: [], silent: [] };
  const account = input.account ?? "reports@contoso.example";
  const scopes = input.scopes ?? DEFAULT_SCOPES;
  const accessToken = input.token ?? "constructed-graph-token";
  globalThis.msal = {
    createStandardPublicClientApplication: async (config) => {
      seen.configs.push({
        clientId: config.auth.clientId,
        authority: config.auth.authority,
        redirectUri: config.auth.redirectUri,
        cacheLocation: config.cache.cacheLocation,
      });
      return {
        loginPopup: async (request) => {
          seen.logins.push(structuredClone(request));
          return { account: { username: account }, accessToken, scopes };
        },
        getAllAccounts: () => [{ username: account }],
        acquireTokenSilent: async (request) => {
          seen.silent.push({ scopes: [...request.scopes], account: request.account?.username ?? null });
          return { accessToken, scopes, account: { username: account } };
        },
      };
    },
  };
  return seen;
}

function graphAnswer(input, address) {
  const url = new URL(address);
  const path = decodeURIComponent(url.pathname).replace("/v1.0", "");
  const graph = input.graph ?? {};
  const folders = graph.folders ?? {};
  if (path === "/me/mailFolders/inbox") return json({ id: "inbox", totalItemCount: graph.inbox ?? 0 });
  if (path === "/me/mailFolders/drafts") return json({ id: "drafts" });
  if (path === "/me/mailFolders/sentitems") return json({ id: "sent" });
  if (path === "/me/mailFolders") {
    const name = /displayName eq '(.*)'/.exec(url.searchParams.get("$filter") ?? "")?.[1]?.replaceAll("''", "'");
    return json({ value: Object.hasOwn(folders, name) ? [{ id: `folder-${name}`, displayName: name, totalItemCount: folders[name] }] : [] });
  }
  return json({ error: { code: "not-found" } }, 404);
}

function installFetch(input) {
  const calls = [];
  globalThis.fetch = async (address, init = {}) => {
    const url = String(address);
    calls.push({ url, method: init.method ?? "GET", headers: headersOf(init.headers), body: init.body ?? null });
    if (url.startsWith(SIGN_IN_SERVICE)) {
      const domain = url.slice(SIGN_IN_SERVICE.length + 1).split("/")[0];
      return (input.tenants ?? []).includes(domain) ? json({ issuer: `tenant-${domain}` }) : json({ error: "invalid_tenant" }, 400);
    }
    if (url.startsWith(GRAPH)) return graphAnswer(input, url);
    return json(input.bridgeAnswer ?? { counts: { INBOX: 1 }, drafts: true, sent: true, sending: "works", route: "imap", encryption: "TLS" });
  };
  return calls;
}

function traceCall(call) {
  const parsed = (() => { try { return call.body ? JSON.parse(call.body) : null; } catch { return null; } })();
  if (call.url.startsWith(GRAPH)) {
    const url = new URL(call.url);
    return {
      kind: "graph",
      method: call.method,
      path: decodeURIComponent(url.pathname.replace("/v1.0", "") + url.search),
      bearerToken: String(call.headers.Authorization ?? "").startsWith("Bearer "),
    };
  }
  if (call.url.includes("/v1/mail/")) {
    return {
      kind: "bridge",
      method: call.method,
      url: call.url,
      bridge: parsed?.connection?.imap?.bridge ?? null,
      token: call.headers["x-agent-m-bridge-token"] ?? null,
    };
  }
  return { kind: "other", method: call.method, url: call.url };
}

async function mailRoutesResult(input) {
  const calls = installFetch(input);
  const seen = fakeMsal(input.msal ?? {});
  if (input.kind === "route-for") {
    const answer = await mailRoutes.routeFor(input.address);
    return { route: answer.route, servers: answer.servers, requests: calls.map((call) => call.url) };
  }
  if (input.kind === "sign-in") {
    const answer = await mailRoutes.signIn(input.clientId, input.address);
    return { answer, configs: seen.configs, logins: seen.logins };
  }
  if (input.kind === "mailbox-test") {
    const bridge = input.bridge ? bridgeClient.bridgeAt(input.bridge) : null;
    const answer = await mailRoutes.mailbox(input.connection, bridge).test();
    const traced = calls.map(traceCall);
    return {
      answer,
      connectionHasPassword: JSON.stringify(input.connection).includes("password"),
      graphRequests: traced.filter((call) => call.kind === "graph"),
      bridgeRequests: traced.filter((call) => call.kind === "bridge"),
      silentScopes: seen.silent.map((request) => request.scopes),
    };
  }
  throw new Error(`unknown case kind ${input.kind}`);
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
        body = match.group("body")
        found.append({"name": match.group("name"), "case": json.loads(fence(body, "Case"))})
    if not found:
        raise AssertionError("no cases loaded")
    return found


def result(case: dict) -> dict:
    return js(JS_CHECK + "return await mailRoutesResult(%s);" % json.dumps(case["input"]))


class TestMailRoutes(unittest.TestCase):
    # TST-532001 · level: release · module: system
    # guards: A MAILBOX IS REACHED THROUGH ITS PROVIDER'S WEB API OR THROUGH THE BRIDGE; AN API MAILBOX IS OPENED BY THE PROVIDER'S SIGN-IN; THE MAIL SIGN-IN ASKS ONLY FOR READING, DRAFTING AND SENDING
    # given: the mailbox route, mailbox test and Microsoft sign-in cases in the Markdown file beside this one
    # input: each case run through MOD-mail-routes and, for IMAP, MOD-bridge-client
    # expect: each case returns exactly its declared route, request trace, password presence and scope result
    def test_each_mail_route_case_matches_its_expected_trace(self):
        for loaded in cases():
            with self.subTest(case=loaded["name"]):
                self.assertEqual(result(loaded["case"]), loaded["case"]["expected"])

    # TST-532002 · level: release · module: system
    # guards: A MAILBOX IS REACHED THROUGH ITS PROVIDER'S WEB API OR THROUGH THE BRIDGE; AN API MAILBOX IS OPENED BY THE PROVIDER'S SIGN-IN; THE MAIL SIGN-IN ASKS ONLY FOR READING, DRAFTING AND SENDING
    # given: the loaded release cases
    # input: their preconditions, inputs and expected traces
    # expect: the battery covers a Graph mailbox with no Bridge request, Gmail and another IMAP mailbox through different Bridges, Graph without a password, IMAP with a password, and exactly the three Microsoft scopes
    def test_cases_cover_the_required_routes_and_permissions(self):
        loaded = [case["case"] for case in cases()]
        expectations = [case["expected"] for case in loaded]
        self.assertTrue(any(item.get("connectionHasPassword") is False and item.get("bridgeRequests") == [] for item in expectations),
                        "the Microsoft route has no mailbox password and no Bridge request")
        bridge_cases = [item for item in expectations if item.get("bridgeRequests")]
        self.assertGreaterEqual(len(bridge_cases), 2, "at least two IMAP fixture mailboxes")
        bridge_urls = {request["url"].rsplit("/v1/mail/test", 1)[0] for item in bridge_cases for request in item["bridgeRequests"]}
        self.assertGreaterEqual(len(bridge_urls), 2, "the IMAP fixtures name different Bridges")
        self.assertTrue(any(case["input"].get("address", "").endswith("@gmail.com") or case["input"].get("connection", {}).get("address", "").endswith("@gmail.com")
                            for case in loaded), "Gmail is included")
        self.assertTrue(any(item.get("connectionHasPassword") is True for item in expectations), "the IMAP route carries a password")
        sign_in = next(item for item in expectations if "logins" in item)
        self.assertEqual(sign_in["logins"][0]["scopes"], SCOPES)


if __name__ == "__main__":
    unittest.main()
