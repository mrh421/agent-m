// The current requirement controls remain read-only with and without dashboard credentials (ITM-278), on the specification view as a tree of the requirement groups (ITM-595).
//
// Module: MOD-trace-pages
// Guards: UC-020; A REQUIREMENT HAS FOUR FIELDS
// Level: release

import assert from "node:assert/strict";
import test from "node:test";
import { TOKEN, openDashboard, repoServer, writeRequests } from "./app-harness.mjs";

const SPEC = `# Read-only toggles

## A section

**READ-ONLY REQUIREMENT** *(Source)*
The current rule is readable.
*Check:* \`tests/read-only.test.mjs\`
`;
const QUEUE = "2026-10-08_toggle-release";
const FILES = {
  "SPEC.md": SPEC,
  // The group file the specification view draws its tree from (MOD-group-document): one group, holding the requirement.
  "docs/groups/requirements.md": "- Reading\n  - READ-ONLY REQUIREMENT\n",
  [`docs/spec-freigaben/${QUEUE}/index.md`]: "# Queue\n\n**Zieldatei aller Einträge:** `SPEC.md`\n",
  [`docs/spec-freigaben/${QUEUE}/entscheidungen.md`]: "# Decisions\n",
};

// The group of the tree, the body that holds its requirements, the control that opens it and the requirement's own control.
function controls() {
  const main = globalThis.document.getElementById("main");
  const group = main.querySelector("section.spec-group");
  const body = group.querySelector("div.spec-group-body");
  body.removeAttribute = (name) => { delete body[name]; };
  return { group, body, toggle: group.querySelector("button.spec-group-toggle"), requirement: main.querySelector("button.requirement-name") };
}

// CASE ITM-278-RELEASE-01
// TST-472518 · level: release · module: MOD-trace-pages
// guards: UC-020; A REQUIREMENT HAS FOUR FIELDS
// given: the public #spec dashboard over a SPEC with one requirement in the group Reading of docs/groups/requirements.md, once with its stored token and once with no token
// input: look at the tree, open the group, then open, close, and reopen its current requirement
// expect: the tree shows the group Reading with the number of requirements it holds, collapsed; opening it shows the requirement once, and both views expose the same current detail; neither interaction writes a repository
test("the release dashboard toggles current requirements without writes with or without a token", async () => {
  for (const [label, token] of [["stored token", TOKEN], ["no token", null]]) {
    const server = await repoServer({ files: FILES });
    const page = await openDashboard({ server, hash: "#spec", token });
    const { group, body, toggle, requirement } = controls();
    const detail = globalThis.document.getElementById("main").querySelector("tr.requirement-opened");
    assert.equal(toggle?.textContent, "Reading", `${label}: the tree names the group of the group file`);
    assert.match(group.querySelector("span.spec-group-held")?.textContent ?? "", /^1 requirement$/, `${label}: the group says how many requirements it holds`);
    assert.equal(body.hidden, "hidden", `${label}: known positive, a fresh group begins collapsed`);
    assert.ok(toggle && requirement, `${label}: known positive, the public controls are rendered`);
    await page.click("button.spec-group-toggle");
    assert.equal(body.hidden, undefined, `${label}: the group's title opens its requirements`);
    assert.equal(group.querySelectorAll("button.requirement-name").length, 1, `${label}: the requirement stands once`);
    await requirement.fire("click", { isTrusted: true });
    assert.match(detail?.textContent ?? "", /The current rule is readable\./,
      `${label}: the first requirement click opens its readable detail`);
    await requirement.fire("click", { isTrusted: true });
    assert.equal(detail?.textContent, "", `${label}: the second requirement click closes its detail`);
    await requirement.fire("click", { isTrusted: true });
    assert.match(detail?.textContent ?? "", /The current rule is readable\./,
      `${label}: the third requirement click reopens its detail`);
    assert.deepEqual(writeRequests(server), [], `${label}: the overview and its controls make no write request`);
    assert.deepEqual(server.writes, [], `${label}: the repository remains unchanged`);
  }
});
