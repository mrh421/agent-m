// The record of a job that ended `failed` at a rejected gate — a helper of the tests of MOD-implementation-pages' route `implement` (ITM-1421), no test of its own. The End is the one MOD-runtimes writes
// (ITM-1412), written here with MOD-job-ledger's appendToRecord, so that the pages read what the ledger hands over.
//
// Module: MOD-implementation-pages
// Level: unit

import { startRecord, appendToRecord } from "../src/job-ledger/index.mjs";

export const GATE_RECORD = "docs/gates/20261102-0900-building-checking-1421.md";
export const WHY = "The review found no test.";
export const REJECTED = `the gate Building → Checking was rejected by ${GATE_RECORD}: ${WHY}`;
export const JOB_ID = "JOB-20261102-0800-a1b2";

// { <path>: <text> } — the record of a job of dev-a on `item` that ended failed with `reason`.
export function endedJob(item, reason, jobId = JOB_ID) {
  const start = startRecord({ id: jobId, kind: "implement", worksOn: [item], participant: "dev-a", model: "model-a", route: "ci hosted", run: null, retries: null, startedBy: "alice", start: new Date("2026-11-02T08:00:00Z"),
    agentM: { version: "2026.11.0", commit: "c".repeat(40) }, inputs: [], limit: 5, destinations: [], params: { items: [item], merges: "agent" } });
  return { [start.path]: appendToRecord(start.text, { part: "end", at: new Date("2026-11-02T09:00:00Z"), state: "failed", results: [], draft: null, rounds: [], usage: null, cost: { known: false, usage: null }, reason, log: null }) };
}
