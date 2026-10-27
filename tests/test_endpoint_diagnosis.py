# Module: MOD-endpoint-calls
# Guards: AN UNSUPPORTED ENDPOINT SAYS SO; UC-003
# Level: release
"""SPEC section 14 - the check named tests/test_endpoint_diagnosis.py, for AN UNSUPPORTED ENDPOINT SAYS SO: "When a configured endpoint
cannot be called from the browser, Agent M names the reason and the runtimes that would work instead; it does not report a generic
failure."

The cases live in tests/test_endpoint_diagnosis.md. This file only loads them and asks node to run the real calls of src/endpoint-calls/
that report a diagnosis - testEndpoint, listModels and endpointExchange - over a fake network: `fetch` rejects as a browser's does or answers
with a status, and `window` exists or not, which is how the module tells a page from the Bridge or a runner. The SPEC's Check line names this
file and says nothing more, so the cases are read from the requirement's sentence and from the accepted `Diagnosis` of MOD-endpoint-calls
(the reasons, and the routes `ci` and `bridge` that would work instead); a case that a reading of the SPEC does not carry is not here. The
counter-proofs show the other side: a failure of the endpoint itself, or outside a browser, offers no runtime and is named by its own reason;
only an error the diagnosis has no name for is the generic one.

Written for ITM-1137 by a participant who built none of the diagnosis (ITM-398, ITM-488, ITM-497): RELEASE TESTS ARE NOT WRITTEN BY THE
IMPLEMENTER.
"""
import json
import re
import unittest
from pathlib import Path

from jsrun import js

DATA = Path(__file__).with_suffix(".md")
SECTION = "AN UNSUPPORTED ENDPOINT SAYS SO"
COUNTER = "AN UNSUPPORTED ENDPOINT SAYS SO: counter-proofs"

# The adapter. `input` is the case's input; the value is, per entry (`test`, `models`, `exchange`), the Diagnosis the call reported with `named`
# (the reason is not the generic `endpoint error` and its message is not empty) and `messageHas` (the case's wording found in the message).
WORLD = r"""
const saved = { window: globalThis.window, fetch: globalThis.fetch, setTimeout: globalThis.setTimeout };
if (input.where === "browser") globalThis.window = {}; else delete globalThis.window;
// MOD-endpoint-calls sends a request that failed with a server error or a network error again, at most five times, 2 s doubled each time,
// at most 30 s: a wait of a second or more is collapsed to none, so that the diagnosis of the last failure is read without the waits.
globalThis.setTimeout = (callback, ms, ...rest) => saved.setTimeout(callback, ms >= 1000 ? 0 : ms, ...rest);
globalThis.fetch = async () => {
  if (input.fetch.rejects !== undefined) throw new TypeError(input.fetch.rejects);
  return new Response(JSON.stringify({ error: { message: input.fetch.body } }), { status: input.fetch.status, headers: { "content-type": "application/json" } });
};
const out = {};
try {
  for (const entry of input.entries) {
    let diagnosis;
    if (entry === "test") { const answer = await endpointCalls.testEndpoint(input.config); diagnosis = answer.works === false ? answer.diagnosis : null; }
    else if (entry === "models") { const answer = await endpointCalls.listModels(input.config); diagnosis = answer.diagnosis ?? null; }
    else {
      try { await endpointCalls.endpointExchange(input.config, { messages: [{ role: "user", text: "hello" }], tools: [] }); diagnosis = null; }
      catch (error) { diagnosis = error.diagnosis ?? { reason: "no diagnosis: " + String(error?.message), message: "", routes: [] }; }
    }
    out[entry] = diagnosis === null ? null : { reason: diagnosis.reason, routes: diagnosis.routes, named: diagnosis.reason !== "endpoint error" && String(diagnosis.message).trim() !== "",
      messageHas: input.fetch.body === undefined ? null : String(diagnosis.message).includes(input.fetch.body) ? input.fetch.body : null, message: diagnosis.message };
  }
} finally {
  if (saved.window === undefined) delete globalThis.window; else globalThis.window = saved.window;
  globalThis.fetch = saved.fetch;
  globalThis.setTimeout = saved.setTimeout;
}
return out;
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


def check(test: unittest.TestCase, section: str) -> None:
    for loaded in cases(section):
        got = run_world(loaded["case"]["input"])
        wanted = loaded["case"]["expected"]
        for entry in loaded["case"]["input"]["entries"]:
            with test.subTest(case=loaded["name"], entry=entry):
                test.assertIsNotNone(got[entry], "the call reported a diagnosis")
                seen = {key: got[entry][key] for key in wanted if key != "messageHas"}
                test.assertEqual(seen, {key: value for key, value in wanted.items() if key != "messageHas"})
                if "messageHas" in wanted:
                    test.assertEqual(got[entry]["messageHas"], wanted["messageHas"], "the endpoint's own words are kept")


class TestEndpointDiagnosis(unittest.TestCase):
    # TST-1137001 · level: release · module: MOD-endpoint-calls
    # guards: AN UNSUPPORTED ENDPOINT SAYS SO
    # given: the cases under that requirement in the Markdown file beside this one: an endpoint called from the browser that is refused for a cross-origin permission, one the browser refuses with no more words than "Failed to fetch", and an Anthropic endpoint that needs the provider's opt-in header
    # input: testEndpoint, listModels and endpointExchange over a fake network that rejects as the browser does, with `window` present
    # expect: each call reports a diagnosis whose reason names why (cross-origin refused, blocked by the browser, opt-in header missing), whose message is not empty, and whose routes are ci and bridge: the runtimes that would work instead; none reports the generic reason endpoint error
    def test_an_endpoint_the_browser_cannot_call_names_the_reason_and_the_runtimes(self):
        check(self, SECTION)

    # TST-1137002 · level: release · module: MOD-endpoint-calls
    # guards: AN UNSUPPORTED ENDPOINT SAYS SO
    # given: the counter-proofs: a refused key answered by the endpoint to a browser, a refused call made from node, and an error of the endpoint the diagnosis has no name for
    # input: the same three calls over the fake network
    # expect: a refused key is named key refused, with no runtime offered; a refusal from node is named not reachable, with no runtime offered; only the unnamed error of the endpoint is the generic endpoint error, with the endpoint's words kept
    def test_a_failure_that_is_not_the_browsers_offers_no_runtime(self):
        check(self, COUNTER)


if __name__ == "__main__":
    unittest.main()
