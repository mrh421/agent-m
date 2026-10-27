// A test helper: the agents' enclosures of a Bridge in tests whose subject is not the enclosure (MOD-bridge-jobs' `enclosures`). Each one
// starts the agent as it is, with the test's environment, and records what it was asked; what the real enclosure does is
// tests/agent-enclosure.test.mjs's. It is a fixture: no program of Agent M offers an enclosure that encloses nothing.
//
// Module: MOD-bridge-jobs
// Level: unit

import { join } from "node:path";

/**
 * openEnclosures({ works?, asked? }) -> (folder) -> AgentEnclosure — `works` is what `works()` answers, `{ works: true }` by default; `asked`, where
 * given, receives `{ folder, call: "wrap" | "prepare" | "works", ... }` for each call.
 */
export function openEnclosures({ works = { works: true }, asked = null } = {}) {
  return (folder) => ({
    home: join(folder, "home"),
    async works() { asked?.push({ folder, call: "works" }); return works; },
    async prepare(at) { asked?.push({ folder, call: "prepare", at }); },
    wrap(command, args, at) {
      asked?.push({ folder, call: "wrap", command, args, at });
      return { command, args, env: { ...process.env }, input: null };
    },
  });
}
