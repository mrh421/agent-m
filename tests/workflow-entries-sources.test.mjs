// MOD-workflow-entries' instance entry onSourcesCommitted (ITM-401), as docs/architecture/MOD-workflow-entries.md
// states it: for each register entry of an EU legal text that waits for fetch, it fetches the official text through
// MOD-source-register and commits the completed source version; an entry with a version is left alone; a failed fetch
// writes nothing and ends failed.
// Run: node --test tests/workflow-entries-sources.test.mjs
//
// Module: MOD-workflow-entries
// Guards: UC-004; AN EU LEGAL TEXT IS FETCHED FROM THE OFFICIAL REPOSITORY; PROGRESS AND JOB STATE ARE DERIVED, NOT STORED
// Level: unit
//
// Deterministic, no network: the instance is a temporary git repository and global fetch is replaced by a fixture answer.
// Each test states its input and expected result before it runs. The counter-proofs are recorded in the sprint review.

import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readDocument } from "../src/documents/index.mjs";
import { sourceSchemas } from "../src/source-register/index.mjs";
import * as entries from "../src/workflow-entries/main.mjs";

process.env.GIT_CONFIG_GLOBAL = "/dev/null";
process.env.GIT_CONFIG_SYSTEM = "/dev/null";
process.env.GIT_TERMINAL_PROMPT = "0";

const { runEntry } = entries;
const NOW = new Date("2026-03-01T10:00:00Z");
const TOKEN = "ghp_fixtureWorkflowToken0123456789abcdef";
const BODY = "<html><body>AI Act</body></html>\n";

const text = (...lines) => `${lines.join("\n")}\n`;
const WAITING = text("---", "id: SRC-ai-act", "title: Artificial Intelligence Act", "kind: regulation",
  "authority: normative", "licence: may be republished - EU legal text",
  "identifier: https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32024R1689",
  "---", "# SRC-ai-act Artificial Intelligence Act", "", "## Versions", "",
  "| Version | Date | Edition | Read from | Files |", "|---|---|---|---|---|");
const WITH_VERSION = text("---", "id: SRC-ai-act", "title: Artificial Intelligence Act", "kind: regulation",
  "authority: normative", "licence: may be republished - EU legal text",
  "identifier: https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32024R1689",
  "---", "# SRC-ai-act Artificial Intelligence Act", "", "## Versions", "",
  "| Version | Date | Edition | Read from | Files |", "|---|---|---|---|---|",
  "| `cellar-existing` | 2024-07-12 | - | publication repository | 1 file, listed below; version hash `"
    + "0".repeat(64) + "` |", "", "### Files of cellar-existing", "", "| File | SHA-256 |", "|---|---|",
  "| `old.xhtml` | `" + "1".repeat(64) + "` |");
const OTHER = text("---", "id: SRC-book", "title: Book", "kind: document", "authority: advisory",
  "licence: may be republished - fixture", "identifier: https://example.org/book", "---", "# SRC-book Book", "",
  "## Versions", "", "| Version | Date | Edition | Read from | Files |", "|---|---|---|---|---|");

function git(cwd, ...args) {
  const r = spawnSync("git", args, { cwd, encoding: "utf8" });
  if (r.status !== 0) throw new Error(`git ${args.join(" ")} failed in ${cwd}: ${r.stderr}`);
  return r.stdout.trim();
}

function write(root, files) {
  for (const [path, body] of Object.entries(files)) {
    mkdirSync(join(root, path, ".."), { recursive: true });
    writeFileSync(join(root, path), body);
  }
}

function fixture(files) {
  const root = mkdtempSync(join(tmpdir(), "agent-m-sources-entry-"));
  const origin = join(root, "origin.git"), seed = join(root, "seed"), clone = join(root, "clone");
  git(root, "init", "-q", "--bare", "-b", "main", origin);
  git(root, "clone", "-q", origin, seed);
  git(seed, "config", "user.name", "Alice Source");
  git(seed, "config", "user.email", "alice@example.org");
  write(seed, files);
  git(seed, "add", "-A");
  git(seed, "commit", "-q", "-m", "source register fixture");
  git(seed, "push", "-q", "origin", "HEAD:refs/heads/main");
  git(root, "clone", "-q", origin, clone);
  git(clone, "config", "user.name", "agent-m sources");
  git(clone, "config", "user.email", "41898282+github-actions[bot]@users.noreply.github.com");
  return { root, origin, clone, head: git(clone, "rev-parse", "HEAD") };
}

async function withInstance(files, run) {
  const f = fixture(files);
  try { return await run(f); } finally { rmSync(f.root, { recursive: true, force: true }); }
}

async function withPublication(answer, run) {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    if (answer.throw) throw new Error(answer.throw);
    return new Response(answer.body ?? BODY, {
      status: answer.status ?? 200,
      headers: {
        "content-type": answer.contentType ?? "application/xhtml+xml",
        "content-disposition": "attachment; filename=\"32024R1689.xhtml\"",
        date: "Tue, 16 Jul 2024 12:00:00 GMT",
        etag: "\"cellar-2024-07-12\"",
      },
    });
  };
  try { return await run(() => calls); } finally { globalThis.fetch = original; }
}

const filesWith = (sourceText) => ({ "README.md": "# Fixture instance\n", "docs/sources/SRC-ai-act.md": sourceText,
  "docs/sources/SRC-book.md": OTHER });
const envOf = (f, extra = {}) => ({ GITHUB_ACTIONS: "true", GITHUB_EVENT_NAME: "push", GITHUB_WORKSPACE: f.clone,
  GITHUB_SERVER_URL: "https://github.com", GITHUB_REPOSITORY: "alice/agent-m", GITHUB_REF_NAME: "main",
  GITHUB_SHA: f.head, GITHUB_TOKEN: TOKEN, ...extra });
const headOf = (f) => git(f.origin, "rev-parse", "main");
const run = (f, extra) => { assert.equal(typeof runEntry, "function", "runEntry is exported"); return runEntry("onSourcesCommitted", envOf(f, extra), { now: NOW }); };
const entryAt = (f, commit = "main") => readDocument(sourceSchemas().entry, "docs/sources/SRC-ai-act.md",
  git(f.origin, "show", `${commit}:docs/sources/SRC-ai-act.md`) + "\n");

// TST-401001 · level: unit · module: MOD-workflow-entries
// guards: AN EU LEGAL TEXT IS FETCHED FROM THE OFFICIAL REPOSITORY; UC-004
// given: an instance checkout with one EU legal-text source entry whose ## Versions table has no row, and one non-EU source entry
// input: onSourcesCommitted with a publication fixture returning one XHTML file, date 2024-07-16 and ETag cellar-2024-07-12
// expect: outcome done; one commit on main changes only SRC-ai-act and its fetched file; the new version row records the repository version, retrieved date and SHA-256 file table
// TST-584029 · level: unit · module: MOD-workflow-entries
// guards: AN EU LEGAL TEXT IS FETCHED FROM THE OFFICIAL REPOSITORY; UC-004
// given: an instance checkout with one EU legal-text source entry whose ## Versions table has no row, and one non-EU source entry
// input: onSourcesCommitted with a publication fixture returning one XHTML file, date 2024-07-16 and ETag cellar-2024-07-12
// expect: outcome done; one commit on main changes only SRC-ai-act and its fetched file; the new version row records the repository version, retrieved date and SHA-256 file table
test("onSourcesCommitted - completes one waiting EU legal text in one commit", async () => {
  await withInstance(filesWith(WAITING), async (f) => {
    await withPublication({}, async (calls) => {
      const status = await run(f);
      assert.equal(status.outcome, "done");
      assert.match(status.summary, /SRC-ai-act/);
      assert.equal(calls(), 1);
      const after = headOf(f);
      assert.notEqual(after, f.head);
      assert.deepEqual(git(f.origin, "diff", "--name-only", f.head, after).split("\n").sort(), [
        "docs/sources/SRC-ai-act.md",
        "docs/sources/SRC-ai-act/cellar-2024-07-12/32024R1689.xhtml",
      ]);
      assert.equal(git(f.origin, "show", `${after}:docs/sources/SRC-ai-act/cellar-2024-07-12/32024R1689.xhtml`) + "\n", BODY);
      const entry = entryAt(f, after);
      assert.deepEqual(entry.sections[0].rows[0].cells.Version, "`cellar-2024-07-12`");
      assert.equal(entry.sections[0].rows[0].cells.Date, "2024-07-16");
      assert.equal(entry.sections[0].rows[0].cells["Read from"],
        "publication repository, retrieved 2024-07-16, version cellar-2024-07-12");
      assert.match(entry.sections[0].text, /\| `32024R1689.xhtml` \| `[0-9a-f]{64}` \|/);
    });
  });
});

// TST-401002 · level: unit · module: MOD-workflow-entries
// guards: PROGRESS AND JOB STATE ARE DERIVED, NOT STORED; UC-004
// given: an EU legal-text source entry that already has one version
// input: onSourcesCommitted with a publication fixture
// expect: outcome nothing to do; fetch is not called; no commit is made
// TST-584030 · level: unit · module: MOD-workflow-entries
// guards: PROGRESS AND JOB STATE ARE DERIVED, NOT STORED; UC-004
// given: an EU legal-text source entry that already has one version
// input: onSourcesCommitted with a publication fixture
// expect: outcome nothing to do; fetch is not called; no commit is made
test("onSourcesCommitted - leaves an entry with a version alone", async () => {
  await withInstance(filesWith(WITH_VERSION), async (f) => {
    await withPublication({}, async (calls) => {
      const status = await run(f);
      assert.equal(status.outcome, "nothing to do");
      assert.equal(status.summary, "No EU legal text is waiting for its fetch.");
      assert.equal(calls(), 0);
      assert.equal(headOf(f), f.head);
    });
  });
});

// TST-401003 · level: unit · module: MOD-workflow-entries
// guards: AN EU LEGAL TEXT IS FETCHED FROM THE OFFICIAL REPOSITORY; UC-004
// given: a waiting EU legal-text entry and a publication fetch that fails
// input: onSourcesCommitted
// expect: outcome failed; summary names the source and the fetch failure; nothing is written
// TST-584031 · level: unit · module: MOD-workflow-entries
// guards: AN EU LEGAL TEXT IS FETCHED FROM THE OFFICIAL REPOSITORY; UC-004
// given: a waiting EU legal-text entry and a publication fetch that fails
// input: onSourcesCommitted
// expect: outcome failed; summary names the source and the fetch failure; nothing is written
test("onSourcesCommitted - a failed fetch writes nothing and names the entry", async () => {
  await withInstance(filesWith(WAITING), async (f) => {
    await withPublication({ throw: "publication offline" }, async () => {
      const status = await run(f);
      assert.equal(status.outcome, "failed");
      assert.match(status.summary, /SRC-ai-act/);
      assert.match(status.summary, /Unreachable|publication offline/);
      assert.equal(headOf(f), f.head);
      assert.equal(git(f.clone, "status", "--porcelain"), "");
    });
  });
});
