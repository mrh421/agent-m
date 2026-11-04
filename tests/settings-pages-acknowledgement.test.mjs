// Module: MOD-settings-pages · MOD-browser-store
// Level: component
// Guards: UC-042; CONFIGURATION LIVES IN THE BROWSER; EVERY SETTING IS REACHED FROM ONE PAGE

import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDashboard, repoServer, richDocument, press, settle } from "./app-harness.mjs";

const INSTANCE = "akmaier/agent-m";
const key = (name) => `agent-m:${INSTANCE}:${name}`;
const controls = (root, className, found = []) => {
  for (const child of root?.children ?? []) {
    if (typeof child !== "object") continue;
    if (child.className?.split(" ").includes(className)) found.push(child);
    controls(child, className, found);
  }
  return found;
};

async function settings(entries) {
  const server = await repoServer({ files: {} });
  const page = await openDashboard({ server, hash: "#uc", entries });
  const dom = richDocument(), main = dom.byId("main"), replace = main.replaceChildren.bind(main);
  let mounted = [];
  main.replaceChildren = (...nodes) => { mounted = nodes; replace(...nodes); };
  await page.go("#settings");
  const repositories = mounted.find((node) => node.className === "settings-tab-panel" && /Repositories/.test(node.textContent));
  const github = controls(repositories, "settings-repository").find((node) => /GitHub token/.test(node.textContent));
  return { server, github, repositories, dom };
}

// Module (as the case stated it): MOD-settings-pages · MOD-browser-store
// TST-290128 · level: component · module: MOD-settings-pages
// guards: UC-042; CONFIGURATION LIVES IN THE BROWSER; EVERY SETTING IS REACHED FROM ONE PAGE
// given: this browser has the public Settings GitHub-token row and no shared-origin acknowledgement.
// input: the person presses Change, explicitly ticks I have read this, reloads Settings, presses Change again, then unchecks it.
// expect: the accepted canonical acknowledgement date is stored only by the tick, restores the checkbox on reload, and unchecking removes its browser record without a repository write.
test("TST-290128: shared-origin acknowledgement persists only for the explicit checkbox choice", async () => {
  const productAddress = "https://github.com/fixture/product";
  const first = await settings({
    [key("products")]: JSON.stringify([productAddress]),
    [key("github-token:fixture/product")]: JSON.stringify({ value: "github_pat_fixture0123456789abcdefghij", name: "Fixture product", expires: null }),
  });
  const change = controls(first.github, "settings-repository-change")[0];
  const acknowledgement = controls(first.github, "settings-repository-ack")[0];
  await press(first.server, change);
  assert.equal(globalThis.localStorage.getItem(key("acknowledged:shared-origin")), null, "opening Change does not store an acknowledgement");
  acknowledgement.checked = true;
  await acknowledgement.fire("change");
  await settle(first.server);
  const recorded = JSON.parse(globalThis.localStorage.getItem(key("acknowledged:shared-origin")));
  assert.match(recorded, /^\d{4}-\d{2}-\d{2}$/, "the explicit tick stores the canonical acknowledgement date");
  const productToken = controls(first.repositories, "settings-repository").find((row) => /GitHub token: fixture\/product/.test(row.textContent));
  await press(first.server, controls(productToken, "settings-repository-change")[0]);
  const productAcknowledgement = controls(productToken, "settings-repository-ack")[0];
  assert.equal(productAcknowledgement.checked, true, "Change rereads acknowledgement ticked in another repository row");
  assert.equal(first.dom.focused(), controls(productToken, "settings-repository-secret")[0], "the other repository row opens at its token without another write");
  const entries = Object.fromEntries(Array.from({ length: globalThis.localStorage.length }, (_, index) => {
    const stored = globalThis.localStorage.key(index); return [stored, globalThis.localStorage.getItem(stored)];
  }));
  const reloaded = await settings(entries);
  const restored = controls(reloaded.github, "settings-repository-ack")[0];
  assert.equal(restored.checked, true, "the public Settings row restores the recorded acknowledgement");
  await press(reloaded.server, controls(reloaded.github, "settings-repository-change")[0]);
  const token = controls(reloaded.github, "settings-repository-secret")[0];
  assert.equal(token.disabled, false, "an already acknowledged reload opens Change without another tick");
  assert.equal(reloaded.dom.focused(), token, "an already acknowledged reload focuses the replacement token");
  restored.checked = false;
  await restored.fire("change");
  assert.equal(globalThis.localStorage.getItem(key("acknowledged:shared-origin")), null, "unchecking removes the acknowledgement record");
});

// Whether `control` is shown within `row`: no node between the row and the control is hidden. The tab that holds the row is
// judged apart, by the tab tests.
const shownWithin = (row, control) => {
  const path = (node, trail) => {
    if (node === control) return [...trail, node];
    for (const child of node?.children ?? []) {
      if (typeof child !== "object") continue;
      const found = path(child, [...trail, node]);
      if (found) return found;
    }
    return null;
  };
  const found = path(row, []);
  assert.ok(found, "the control is part of the row");
  return found.every((node) => !node.hidden);
};

// TST-472729 · level: component · module: MOD-settings-pages
// guards: UC-042; THE SHARED PAGES ORIGIN IS DISCLOSED; A FORM OPENS WITH ITS FIRST FIELD FOCUSED
// given: the public Settings page with a stored token and no shared-origin acknowledgement in this browser.
// input: the person looks at the token's line, then presses Change.
// expect: before Change the line shows neither the shared-origin notice nor I have read this, nor Save: nothing the person cannot use yet. Change shows the notice, I have read this — enabled, focused, and ticked by the person's click — and Save, in place.
test("UC-042 step 2: a token line shows its notice and I have read this only when Change opens them, and the box can be ticked", async () => {
  const page = await settings({
    [key("products")]: JSON.stringify(["https://github.com/fixture/product"]),
    [key("github-token:fixture/product")]: JSON.stringify({ value: "github_pat_fixture0123456789abcdefghij", name: "Fixture product", expires: null }),
  });
  const row = page.github;
  const acknowledgement = controls(row, "settings-repository-ack")[0];
  const notice = controls(row, "settings-repository-shared-origin")[0];
  const save = controls(row, "settings-repository-save")[0];
  assert.equal(shownWithin(row, acknowledgement), false, "before Change, I have read this is not shown");
  assert.equal(shownWithin(row, notice), false, "before Change, the notice of the form is not shown");
  assert.equal(shownWithin(row, save), false, "before Change, Save is not shown");

  await press(page.server, controls(row, "settings-repository-change")[0]);
  assert.equal(shownWithin(row, notice), true, "Change shows the shared-origin notice in place");
  assert.equal(shownWithin(row, acknowledgement), true, "Change shows I have read this in place");
  assert.equal(shownWithin(row, save), true, "Change shows Save in place");
  assert.equal(acknowledgement.disabled, false, "the shown box can be ticked");
  assert.equal(page.dom.focused(), acknowledgement, "Change opens at the box while it is not ticked");
  acknowledgement.checked = true;
  await acknowledgement.fire("change");
  assert.equal(controls(row, "settings-repository-secret")[0].disabled, false, "ticked, the paste field opens");
});

// Module (as the case stated it): MOD-settings-pages · MOD-browser-store
// TST-290129 · level: component · module: MOD-settings-pages
// guards: UC-042; CONFIGURATION LIVES IN THE BROWSER; EVERY SETTING IS REACHED FROM ONE PAGE
// given: GitHub Ubuntu CI and an isolated source copy.
// input: the acknowledgement readback in repositoryLine is faulted, then restored byte-for-byte.
// expect: TST-290128 fails in the faulted copy and passes after exact restoration.
test("TST-290129: CI counter-proof restores acknowledgement readback for TST-290128", () => {
  if (process.env.GITHUB_ACTIONS !== "true" || process.env.AGENT_M_290_ACK_FAULT_CHILD) return;
  const temporary = mkdtempSync(join(tmpdir(), "agent-m-290-ack-fault-")), copied = join(temporary, "repo");
  try {
    cpSync(process.cwd(), copied, { recursive: true, filter: (path) => !path.includes("/.git") && !path.includes("/node_modules") });
    const source = join(copied, "src/settings-pages/settings.mjs"), testPath = "tests/settings-pages-acknowledgement.test.mjs";
    const original = readFileSync(source), needle = 'const alreadyAcknowledged = Boolean(readSetting(context.store, "acknowledged:shared-origin"));';
    assert.equal(original.toString().split(needle).length - 1, 1, "the acknowledgement readback fault target is unique");
    const argv = [process.execPath, "--test", "--test-name-pattern", "TST-290128", testPath];
    const childEnv = { AGENT_M_290_ACK_FAULT_CHILD: "1", NODE_TEST_CONTEXT: null };
    const invoke = () => {
      const env = { ...process.env, ...childEnv }; delete env.NODE_TEST_CONTEXT;
      return spawnSync(argv[0], argv.slice(1), { cwd: copied, encoding: "utf8", timeout: 60_000, env });
    };
    const originalHash = createHash("sha256").update(original).digest("hex");
    const testHash = createHash("sha256").update(readFileSync(join(copied, testPath))).digest("hex");
    const faultStarted = new Date().toISOString(); writeFileSync(source, original.toString().replace(needle, "const alreadyAcknowledged = false;"));
    const faultHash = createHash("sha256").update(readFileSync(source)).digest("hex"), failed = invoke(), faultEnded = new Date().toISOString();
    const restoreStarted = new Date().toISOString();
    writeFileSync(source, original);
    const restoredHash = createHash("sha256").update(readFileSync(source)).digest("hex"), passed = invoke(), restoreEnded = new Date().toISOString();
    console.log("TST-290129-counterproof " + JSON.stringify({
      argv, cwd: copied, childEnv, source, testPath, testHash, originalHash, faultHash, restoredHash, faultStarted, faultEnded, restoreStarted, restoreEnded,
      failed: { status: failed.status, signal: failed.signal, error: failed.error?.message ?? null, stdout: failed.stdout, stderr: failed.stderr },
      passed: { status: passed.status, signal: passed.signal, error: passed.error?.message ?? null, stdout: passed.stdout, stderr: passed.stderr },
    }));
    assert.equal(failed.status, 1, `${failed.stdout}\n${failed.stderr}`);
    assert.match(`${failed.stdout}\n${failed.stderr}`, /not ok \d+ - TST-290128:/);
    assert.equal(restoredHash, originalHash, "source bytes are restored exactly");
    assert.equal(passed.status, 0, `${passed.stdout}\n${passed.stderr}`);
    assert.match(`${passed.stdout}\n${passed.stderr}`, /ok \d+ - TST-290128:/);
    assert.notEqual(faultHash, originalHash, "the copied source received the fault");
  } finally { rmSync(temporary, { recursive: true, force: true }); }
});

// TST-1021004 · level: component · module: MOD-settings-pages
// guards: UC-042; NO SECRET IN THE REPOSITORY; A TOKEN GOES ONLY TO THE SERVER THAT ISSUED IT
// given: the public Settings GitHub-token row, with a stored GitHub token and the record of its last test, and the shared-origin notice acknowledged
// input: the person presses Change, pastes a GitLab token (glpat-…) and presses Save; then pastes a GitHub token and presses Save
// expect: for the GitLab token the stored token and the record of its last test stand as they were, and the row shows a line that names github-token and does not hold the pasted token; known positive: the GitHub token replaces the stored one and the last test is forgotten
test("TST-1021004: Change refuses a token of the other kind of server before it stores anything", async () => {
  const WRONG = "glpat-WRONG0123456789abcdef", RIGHT = "github_pat_NEW0123456789abcdefghijkl";
  const OLD = { value: "github_pat_OLD0123456789abcdefghijkl", name: "GitHub token", expires: "2027-06-01", stored: "2026-09-01" };
  const TESTED = { at: "2026-09-02T10:00:00.000Z", outcome: "working" };
  const page = await settings({
    [key("github-token")]: JSON.stringify(OLD),
    [key("last-test:github-token")]: JSON.stringify(TESTED),
    [key("acknowledged:shared-origin")]: JSON.stringify("2026-10-01"),
  });
  await press(page.server, controls(page.github, "settings-repository-change")[0]);
  const secret = controls(page.github, "settings-repository-secret")[0];
  const save = controls(page.github, "settings-repository-save")[0];
  const result = controls(page.github, "settings-repository-result")[0];
  secret.value = WRONG;
  await press(page.server, save);
  assert.deepEqual(JSON.parse(globalThis.localStorage.getItem(key("github-token"))), OLD, "failure node: settings.mjs stores the pasted token before connect");
  assert.deepEqual(JSON.parse(globalThis.localStorage.getItem(key("last-test:github-token"))), TESTED);
  assert.match(result.textContent, /github-token/);
  assert.match(result.textContent, /GitLab token/);
  assert.equal(result.textContent.includes(WRONG), false, "the line never holds the token");
  secret.value = RIGHT;
  await press(page.server, save);
  assert.equal(JSON.parse(globalThis.localStorage.getItem(key("github-token"))).value, RIGHT, "known positive");
  assert.equal(globalThis.localStorage.getItem(key("last-test:github-token")), null);
});
