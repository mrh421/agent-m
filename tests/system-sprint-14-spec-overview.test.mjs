// The current requirement overview through the actual #spec dashboard route (ITM-277).
//
// Module: MOD-trace-pages
// Guards: UC-020; A REQUIREMENT HAS FOUR FIELDS
// Level: system

import assert from "node:assert/strict";
import test from "node:test";
import { TOKEN, openDashboard, repoServer, writeRequests } from "./app-harness.mjs";

const QUEUE = "2026-10-08_wording";
const OLD = `# Fixture specification

**OUTSIDE REQUIREMENT** *(Outside source)*
Outside rule.
*Check:* \`tests/outside.test.mjs\`

## First section

**FIRST REQUIREMENT** *(First source)*
First rule.
*Check:* \`tests/first.test.mjs\`

## Second section

**SECOND REQUIREMENT** *(Second source)*
Second rule.
*Check:* \`tests/second.test.mjs\`
`;
const CURRENT = OLD.replace("SECOND REQUIREMENT", "FRESH REQUIREMENT").replace("Second rule.", "Fresh current rule.");
const PROPOSAL = OLD.replace("SECOND REQUIREMENT", "PROPOSED ONLY REQUIREMENT").replace("Second rule.", "Proposal text only.");

function files(spec = OLD) {
  return {
    ...(spec === null ? {} : { "SPEC.md": spec }),
    [`docs/spec-freigaben/${QUEUE}/index.md`]: [
      "# Queue",
      "",
      "**Zieldatei aller Einträge:** `SPEC.md`",
      "",
      "| Nr | Datei | Anker (Überschrift, wortgetreu) | bis (exklusiv) | Commits |",
      "|---|---|---|---|---|",
      "| 01 | `SPEC.md` | ## Second section | — | — |",
      "",
    ].join("\n"),
    [`docs/spec-freigaben/${QUEUE}/entscheidungen.md`]: "# Decisions\n\nAppend-only.\n",
    [`docs/spec-freigaben/${QUEUE}/01-proposal.md`]: PROPOSAL,
  };
}

// CASE ITM-277-SYSTEM-02
// TST-473080 · level: system · module: MOD-trace-pages
// guards: UC-020; A REQUIREMENT HAS FOUR FIELDS
// given: a fresh dashboard load after current SPEC bytes change, then fixtures with an empty and an absent SPEC
// input: open #spec for each fixture
// expect: only fresh current text appears, as "in SPEC" or as what the open entry would do to it; the entry's proposed requirement appears by its name, marked not yet placed, as "proposed" and its text does not; empty and absent SPECs name their empty state while queue history remains usable
test("#spec reads fresh current SPEC bytes and keeps queue history for empty or absent SPEC", async () => {
  const changing = await repoServer({ files: files() });
  await openDashboard({ server: changing, hash: "#spec" });
  await changing.change("SPEC.md", CURRENT);
  const fresh = await openDashboard({ server: changing, hash: "#spec" });
  assert.match(fresh.main(), /FRESH REQUIREMENT/, "known positive: a fresh page reads the changed current SPEC");
  assert.match(fresh.main(), /FRESH REQUIREMENT<\/button>[^]*?<td class="requirement-status">removal proposed<\/td>/, "the open entry would withdraw the fresh requirement it anchors");
  // The fixture holds no docs/groups/requirements.md, so no group names it: it is marked not yet placed (MOD-trace-pages, UC-021 3b).
  assert.match(fresh.main(), /<td>PROPOSED ONLY REQUIREMENT <span class="requirement-unplaced">not yet placed<\/span><\/td><td class="requirement-status">proposed<\/td>/, "the requirement the entry would add is shown as proposed");
  assert.doesNotMatch(fresh.main(), /SECOND REQUIREMENT|Proposal text only/, "neither old bytes nor proposal text replace current SPEC");

  for (const [label, spec] of [["empty", ""], ["absent", null]]) {
    const server = await repoServer({ files: files(spec) });
    const page = await openDashboard({ server, hash: "#spec" });
    assert.match(page.main(), /No current requirements are recorded in SPEC\.md\./, `${label} SPEC states the explicit empty result`);
    assert.match(page.main(), new RegExp(`href="#spec-entry/id=spec-${QUEUE}-01"`), `${label} SPEC preserves the queue history`);
    assert.equal(writeRequests(server).length, 0, `${label} overview writes nothing`);
  }
});
