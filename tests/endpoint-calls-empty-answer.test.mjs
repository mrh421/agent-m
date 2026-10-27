// Module: MOD-endpoint-calls
// Level: unit
// Guards: A DRAFT THAT FAILS A CHECK GOES BACK TO ITS PARTICIPANT
// A local HTTP endpoint on 127.0.0.1 answers with constructed bodies; no paid service, no document-derived oracle.
// Every expected value is stated in the test's own text.

import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { endpointDriver } from "../src/endpoint-calls/index.mjs";
import { runJob } from "../src/job-runner/index.mjs";
import { kindOf } from "../src/job-catalogue/index.mjs";

const BODIES = {
  "/openai-null/chat/completions": { choices: [{ index: 0, finish_reason: "stop", message: { role: "assistant", content: null } }],
    usage: { prompt_tokens: 5, completion_tokens: 0 } },
  "/anthropic-empty/messages": { type: "message", role: "assistant", content: [], stop_reason: "end_turn", usage: { input_tokens: 5, output_tokens: 0 } },
  "/anthropic-two/messages": { type: "message", role: "assistant", content: [{ type: "text", text: "first " }, { type: "text", text: "second" }],
    stop_reason: "end_turn", usage: { input_tokens: 5, output_tokens: 2 } },
};
const PARTICIPANT = { name: "fixture-endpoint", type: "model endpoint", model: "fixture-model", capabilities: ["draft text"], place: "this machine" };
const INPUT = { prompt: "Prepared prompt.", parts: [], output: null, findings: [], previous: null, workdir: null };

let server, base;
before(async () => {
  server = http.createServer((request, response) => {
    request.resume();
    request.on("end", () => {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify(BODIES[request.url] ?? {}));
    });
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

const config = (kind, path) => ({ name: path, kind, baseUrl: `${base}/${path}`, model: "fixture-model", key: null });

// TST-1231001 · level: unit · module: MOD-endpoint-calls
// guards: A DRAFT THAT FAILS A CHECK GOES BACK TO ITS PARTICIPANT
// given: a local OpenAI-compatible endpoint answering choices[0].message.content null.
// input: one direct send (no tools) of a DriverInput through endpointDriver.
// expect: text is the empty string "", usage { inputTokens: 5, outputTokens: 0, minutes: null, cost: null }.
test("TST-1231001: an OpenAI-compatible answer with content null is the text \"\"", async () => {
  const sent = await endpointDriver(config("openai-compatible", "openai-null"), PARTICIPANT).send(INPUT);
  assert.equal(sent.text, "");
  assert.deepEqual(sent.usage, { inputTokens: 5, outputTokens: 0, minutes: null, cost: null });
});

// TST-1231002 · level: unit · module: MOD-endpoint-calls
// guards: A DRAFT THAT FAILS A CHECK GOES BACK TO ITS PARTICIPANT
// given: a local Anthropic endpoint answering content [].
// input: one direct send (no tools) of a DriverInput through endpointDriver.
// expect: text is the empty string "".
test("TST-1231002: an Anthropic answer with content [] is the text \"\"", async () => {
  const sent = await endpointDriver(config("anthropic", "anthropic-empty"), PARTICIPANT).send(INPUT);
  assert.equal(sent.text, "");
});

// TST-1231003 · level: unit · module: MOD-endpoint-calls
// guards: A DRAFT THAT FAILS A CHECK GOES BACK TO ITS PARTICIPANT
// given: a local Anthropic endpoint answering two text parts, "first " and "second".
// input: one direct send (no tools) of a DriverInput through endpointDriver.
// expect: text is the parts joined, "first second".
test("TST-1231003: an Anthropic answer of two text parts is their text joined", async () => {
  const sent = await endpointDriver(config("anthropic", "anthropic-two"), PARTICIPANT).send(INPUT);
  assert.equal(sent.text, "first second");
});

// TST-1231004 · level: unit · module: MOD-endpoint-calls
// guards: A DRAFT THAT FAILS A CHECK GOES BACK TO ITS PARTICIPANT
// given: the kind derive-use-cases with limit 2 and a drafter endpointDriver whose endpoint answers empty (content null; content []).
// input: runJob attended, without reviewers, once for each endpoint kind.
// expect: no TypeError; stoppedBecause "unusable", raw "", draft null; two rounds, each with the one finding "the answer cannot be read: it is not JSON".
test("TST-1231004: runJob over an endpoint that answers empty ends unusable with the finding", async () => {
  const kind = await kindOf("derive-use-cases");
  for (const [endpointKind, path] of [["openai-compatible", "openai-null"], ["anthropic", "anthropic-empty"]]) {
    const prepared = { kind, parts: [], rules: null, blocking: [], notFitting: [], limit: 2, drafter: PARTICIPANT };
    const result = await runJob(prepared, { drafter: endpointDriver(config(endpointKind, path), PARTICIPANT), reviewers: [] },
      { attended: true, context: { gates: [], params: {} } });
    assert.equal(result.stoppedBecause, "unusable", endpointKind);
    assert.equal(result.raw, "", endpointKind);
    assert.equal(result.draft, null, endpointKind);
    assert.equal(result.rounds.length, 2, endpointKind);
    for (const round of result.rounds) {
      assert.deepEqual(round.findings.map((f) => f.what), ["the answer cannot be read: it is not JSON"], endpointKind);
    }
  }
});
