// MOD-workflow-entries' entry onReleaseTagged and the workflow file that runs it (ITM-1049), as the accepted text of docs/architecture/MOD-workflow-entries.md states it:
// "onReleaseTagged(env) — in the instance, on a release tag: on each platform's runner, the Bridge's file of that platform, signed; then the files, checksums, signatures and
// update feed published as the release of the tag (`THE BRIDGE IS SIGNED BY ITS PUBLISHER`); nothing is published when a signature cannot be verified"; "`not run` names what was
// missing, such as a secret"; and "one file under `.github/workflows/` runs each of its entries … `onReleaseTagged` on a release tag … and does nothing but run it".
// Run: node --test tests/workflow-entries-release-tagged.test.mjs
//
// Module: MOD-workflow-entries
// Guards: THE BRIDGE IS SIGNED BY ITS PUBLISHER; THE BRIDGE IS ONE FILE PER PLATFORM
// Level: unit
//
// MOD-bridge-build's buildPlatform and publishRelease are faked: the entry is handed them as its second argument { buildPlatform, publishRelease }, and nothing reaches
// the network. The text leaves the way one entry runs "on each platform's runner" open; the readings, which the pull request names:
//   - The release workflow runs the entry on each platform's runner with RELEASE_PHASE=build and RELEASE_PLATFORM=<platform> (macos, windows or linux), then once on one runner
//     with RELEASE_PHASE=publish. CiEnvironment holds them as env.release = { tag, phase, platform, folder, folders, secrets }; the tag is GITHUB_REF_NAME.
//   - A build run calls buildPlatform({ platform, checkout, tag, folder }) once; a publish run calls publishRelease(host, { tag, folders }) once.
//   - The secrets a build needs, by MOD-bridge-build's Data: macos the BRIDGE_MACOS_* and BRIDGE_NOTARY_* ones and BRIDGE_UPDATE_KEY; windows the BRIDGE_WINDOWS_* ones and
//     BRIDGE_UPDATE_KEY; linux BRIDGE_UPDATE_KEY. A publish run needs BRIDGE_UPDATE_KEY and the workflow's token. A missing one ends the run `not run`, naming it, before a function is called.
// Each test states its input and its expected result before it runs (given / input / expect).

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const { onReleaseTagged } = await import("../src/workflow-entries/instance.mjs").then((module) => module, (error) => ({ onReleaseTagged: async () => { throw error; } }));
const { ciEnvironment } = await import("../src/workflow-entries/compose.mjs");

const SECRETS = { macos: ["BRIDGE_MACOS_CERTIFICATE", "BRIDGE_MACOS_CERTIFICATE_PASSWORD", "BRIDGE_NOTARY_KEY", "BRIDGE_NOTARY_KEY_ID", "BRIDGE_NOTARY_ISSUER", "BRIDGE_UPDATE_KEY"],
  windows: ["BRIDGE_WINDOWS_CERTIFICATE", "BRIDGE_WINDOWS_CERTIFICATE_PASSWORD", "BRIDGE_UPDATE_KEY"], linux: ["BRIDGE_UPDATE_KEY"] };
const ALL = [...new Set(Object.values(SECRETS).flat())];
const secrets = (without = []) => Object.fromEntries(ALL.map((name) => [name, without.includes(name) ? null : "secret"]));
const env = (release) => ({ entry: "onReleaseTagged", service: "github", event: { name: "push", payload: null }, checkout: "/work/instance", repository: "https://github.com/alice/agent-m",
  branch: "v2026.1.0", agentM: { commit: "a".repeat(40) }, token: `ghs_${"a".repeat(36)}`, now: new Date("2026-10-19T10:00:00Z"), job: {},
  release: { tag: "v2026.1.0", phase: "build", platform: null, folder: "/work/out", folders: [], secrets: secrets(), ...release } });
const fakes = ({ failBuild = null, failPublish = null } = {}) => {
  const calls = [];
  const bad = () => Object.assign(new Error("bad signature"), { name: "SignatureInvalid", file: "x.dmg" });
  return { calls,
    buildPlatform: async (config) => { calls.push(["buildPlatform", config]); if (failBuild === config.platform) throw bad(); return { platform: config.platform, version: "2026.1.0", folder: config.folder, files: [] }; },
    publishRelease: async (host, config) => { calls.push(["publishRelease", config]); if (failPublish) throw bad(); return { published: ["a", "a.sig"], facts: [] }; } };
};
const PLATFORMS = ["macos", "windows", "linux"];

// TST-1049001 · level: unit · module: MOD-workflow-entries
// guards: THE BRIDGE IS ONE FILE PER PLATFORM; THE BRIDGE IS SIGNED BY ITS PUBLISHER
// given: a release tag, a build run on each of the three platforms' runners and then the publish run, every secret set
// input: onReleaseTagged for each run, with the faked functions
// expect: buildPlatform is called once per platform with the platform, the checkout, the tag and the folder, and publishRelease once with the tag and the folders; every run is done
test("a tag runs buildPlatform per platform and publishRelease once", async () => {
  const fake = fakes();
  for (const platform of PLATFORMS) {
    const status = await onReleaseTagged(env({ phase: "build", platform, folder: `/work/out/${platform}` }), fake);
    assert.equal(status.outcome, "done", status.summary);
  }
  const folders = PLATFORMS.map((platform) => `/work/out/${platform}`);
  const status = await onReleaseTagged(env({ phase: "publish", folders }), fake);
  assert.equal(status.outcome, "done", status.summary);
  assert.deepEqual(fake.calls.map(([name]) => name), ["buildPlatform", "buildPlatform", "buildPlatform", "publishRelease"]);
  assert.deepEqual(fake.calls.slice(0, 3).map(([, config]) => config), PLATFORMS.map((platform) => ({ platform, checkout: "/work/instance", tag: "v2026.1.0", folder: `/work/out/${platform}` })));
  assert.deepEqual(fake.calls[3][1], { tag: "v2026.1.0", folders });
});

// TST-1049002 · level: unit · module: MOD-workflow-entries
// guards: THE BRIDGE IS SIGNED BY ITS PUBLISHER
// given: for each platform, a run whose secret is missing — the notary key on macos, the Windows certificate on windows, the update key on linux and in the publish run
// input: onReleaseTagged for each
// expect: `not run`, the summary names the secret, and no function is called; counter-proof: a secret another platform needs does not stop a platform that does not need it
test("a missing secret ends the run not run, naming it, before anything is built or published", async () => {
  const fake = fakes();
  for (const [platform, name] of [["macos", "BRIDGE_NOTARY_KEY"], ["windows", "BRIDGE_WINDOWS_CERTIFICATE"], ["linux", "BRIDGE_UPDATE_KEY"]]) {
    const status = await onReleaseTagged(env({ phase: "build", platform, secrets: secrets([name]) }), fake);
    assert.equal(status.outcome, "not run");
    assert.match(status.summary, new RegExp(name));
  }
  const status = await onReleaseTagged(env({ phase: "publish", folders: ["/work/out/macos"], secrets: secrets(["BRIDGE_UPDATE_KEY"]) }), fake);
  assert.equal(status.outcome, "not run");
  assert.match(status.summary, /BRIDGE_UPDATE_KEY/);
  assert.deepEqual(fake.calls, []);
  assert.equal((await onReleaseTagged(env({ phase: "build", platform: "linux", secrets: secrets(["BRIDGE_NOTARY_KEY"]) }), fake)).outcome, "done");
});

// TST-1049003 · level: unit · module: MOD-workflow-entries
// guards: THE BRIDGE IS SIGNED BY ITS PUBLISHER
// given: buildPlatform throws SignatureInvalid on macos; and, in another case, publishRelease throws SignatureInvalid
// input: onReleaseTagged for the failing build run and for the publish run
// expect: both end `failed`, the summary names the error and the file, never `done`; the failed build run calls no publishRelease; the failed publish run says that nothing was published
test("a failed signature ends the run failed with nothing published", async () => {
  const fake = fakes({ failBuild: "macos" });
  const built = await onReleaseTagged(env({ phase: "build", platform: "macos" }), fake);
  assert.equal(built.outcome, "failed");
  assert.match(built.summary, /SignatureInvalid/);
  assert.match(built.summary, /x\.dmg/);
  assert.ok(!fake.calls.some(([name]) => name === "publishRelease"));
  const published = await onReleaseTagged(env({ phase: "publish", folders: ["/work/out/macos"] }), fakes({ failPublish: true }));
  assert.equal(published.outcome, "failed");
  assert.match(published.summary, /SignatureInvalid/);
  assert.match(published.summary, /Nothing was published/);
});

// TST-1049004 · level: unit · module: MOD-workflow-entries
// guards: THE BRIDGE IS SIGNED BY ITS PUBLISHER
// given: a run that names no tag, a build run that names no platform, and a publish run without the workflow's token
// input: onReleaseTagged for each
// expect: `not run` naming what is missing, and no function is called
test("a run without its tag, platform or token is not run", async () => {
  const fake = fakes();
  const noTag = await onReleaseTagged(env({ tag: null }), fake);
  const noPlatform = await onReleaseTagged(env({ phase: "build", platform: null }), fake);
  const noToken = await onReleaseTagged({ ...env({ phase: "publish", folders: ["/work/out/macos"] }), token: null }, fake);
  assert.deepEqual([noTag, noPlatform, noToken].map((status) => status.outcome), ["not run", "not run", "not run"]);
  assert.match(noTag.summary, /tag/);
  assert.match(noPlatform.summary, /RELEASE_PLATFORM/);
  assert.match(noToken.summary, /GITHUB_TOKEN/);
  assert.deepEqual(fake.calls, []);
});

// TST-1049005 · level: unit · module: MOD-workflow-entries
// guards: THE BRIDGE IS SIGNED BY ITS PUBLISHER
// given: the variables the release workflow sets: GITHUB_REF_NAME, RELEASE_PHASE, RELEASE_PLATFORM, RELEASE_FOLDER, RELEASE_FOLDERS and the BRIDGE_* secrets, one of them empty
// input: ciEnvironment
// expect: env.release holds the tag, phase, platform, folder, folders (split at blanks) and each secret by its name, an empty one as null
test("the CiEnvironment holds the release's tag, phase, platform, folders and secrets by name", () => {
  const read = ciEnvironment("onReleaseTagged", { GITHUB_REF_NAME: "v2026.1.0", RELEASE_PHASE: "publish", RELEASE_PLATFORM: "", RELEASE_FOLDER: "/o", RELEASE_FOLDERS: "/o/macos /o/linux",
    BRIDGE_UPDATE_KEY: "pem", BRIDGE_NOTARY_KEY: "" }, new Date());
  const { secrets: held, ...rest } = read.release;
  assert.deepEqual(rest, { tag: "v2026.1.0", phase: "publish", platform: null, folder: "/o", folders: ["/o/macos", "/o/linux"] });
  assert.equal(held.BRIDGE_UPDATE_KEY, "pem");
  assert.equal(held.BRIDGE_NOTARY_KEY, null);
});

// TST-1049006 · level: unit · module: MOD-workflow-entries
// guards: THE BRIDGE IS ONE FILE PER PLATFORM
// given: .github/workflows/release.yml
// input: its text
// expect: it runs on a pushed tag; builds on a macOS, a Windows and a Linux runner; runs nothing but the entry (node src/workflow-entries/main.mjs onReleaseTagged); its publish job needs the builds; counter-proof: a file that builds on one runner only does not pass the same check
const releaseWorkflow = (text) => ({
  onTag: /^on:\s*\n\s+push:\s*\n\s+tags:/m.test(text),
  runners: ["macos-latest", "windows-latest", "ubuntu-latest"].every((runner) => text.includes(runner)),
  runs: text.includes("main.mjs onReleaseTagged") && [...text.matchAll(/main\.mjs (\w+)/g)].every((match) => match[1] === "onReleaseTagged"),
  publishNeeds: /needs:\s*\[?\s*build/.test(text),
});
test("the release workflow runs the entry on each platform's runner and once to publish", () => {
  const found = releaseWorkflow(readFileSync(join(ROOT, ".github/workflows/release.yml"), "utf8"));
  assert.deepEqual(found, { onTag: true, runners: true, runs: true, publishNeeds: true });
  const one = "on:\n  push:\n    tags: ['v*']\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - run: node src/workflow-entries/main.mjs onReleaseTagged\n";
  assert.notDeepEqual(releaseWorkflow(one), { onTag: true, runners: true, runs: true, publishNeeds: true });
});
