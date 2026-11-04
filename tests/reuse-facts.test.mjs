// MOD-reuse-facts' registryFacts and licenceVerdict (ITM-435), as docs/architecture/MOD-reuse-facts.md states them:
// registryFacts(candidate, productLicence) reads a package registry and the candidate's source repository, returning every
// fact with the address read and the read date; licenceVerdict(candidate, product) reads licences.md.
// Run: node --test tests/reuse-facts.test.mjs
//
// Module: MOD-reuse-facts
// Guards: UC-022; UC-040; DUE DILIGENCE IS FETCHED, NOT RECALLED; A REUSED LICENCE IS SHOWN AGAINST THE PRODUCT'S; A REUSE DECISION RECORDS ITS DUE DILIGENCE
// Level: unit
//
// Each test states its input and its expected result before it runs (given / input / expect). No test reaches the network:
// registries are fakes of fetch, and the source repository is a fake host that keeps to MOD-repository-hosts' issueCounts
// interface.

import test from "node:test";
import assert from "node:assert/strict";
import { registryFacts, hubFacts, licenceVerdict, reuseStrategies } from "../src/reuse-facts/index.mjs";

const READ = "2026-10-13";
const NPM_LEFT_PAD = "https://registry.npmjs.org/left-pad";
const NPM_LEFT_PAD_DOWNLOADS = "https://api.npmjs.org/downloads/point/last-month/left-pad";
const NPM_MISSING = "https://registry.npmjs.org/missing-lib";
const NPM_BLOCKED = "https://registry.npmjs.org/blocked-lib";
const PYPI_REPORT_HELPER = "https://pypi.org/pypi/report-helper/json";
const NPM_COPYLEFT = "https://registry.npmjs.org/copyleft-lib";
const NPM_COPYLEFT_DOWNLOADS = "https://api.npmjs.org/downloads/point/last-month/copyleft-lib";

function json(status, body) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function fakeRegistry(routes) {
  const requests = [];
  return {
    requests,
    fetch: async (input) => {
      const href = String(input?.url ?? input);
      requests.push(href);
      if (!Object.hasOwn(routes, href)) return json(404, { message: "not found" });
      const answer = routes[href];
      if (answer instanceof Error) throw answer;
      return json(200, answer);
    },
  };
}

function fakeRepositoryHost(counts) {
  const connected = [];
  return {
    connected,
    connect: async (address) => {
      connected.push(address.web);
      return {
        repositoryInfo: async () => ({ defaultBranch: "main", visibility: "public", canWrite: false, archived: false, description: "" }),
        issueCounts: async () => counts,
      };
    },
  };
}

async function usingFetch(fetch, run) {
  const real = globalThis.fetch;
  globalThis.fetch = fetch;
  try { return await run(); } finally { globalThis.fetch = real; }
}

function text(...lines) {
  return `${lines.join("\n")}\n`;
}

function lineOf(haystack, needle) {
  return haystack.split("\n").findIndex((line) => line.includes(needle)) + 1;
}

function snapshot(files) {
  return { read: async (path) => files[path] ?? null };
}

function context({ files = { LICENSE: "MIT License\n" }, counts = { open: 2, closed: 5 } } = {}) {
  return {
    product: { snapshot: snapshot(files) },
    connect: async () => ({
      repositoryInfo: async () => ({ defaultBranch: "main", visibility: "public", canWrite: false, archived: false, description: "" }),
      issueCounts: async () => counts,
    }),
    now: new Date(`${READ}T10:00:00Z`),
  };
}

function decisionWithRows(rows, title = "Pick a helper") {
  return text(
    "---",
    "id: ARC-900",
    `title: ${title}`,
    "forced_by:",
    "  - A REUSE DECISION RECORDS ITS DUE DILIGENCE",
    "---",
    `# ARC-900 ${title}`,
    "",
    "## Context",
    "",
    "The architecture needs a reused helper.",
    "",
    "## Decision",
    "",
    "| Candidate | Ecosystem | Repository | Role |",
    "|---|---|---|---|",
    ...rows.decision,
    "",
    "## Alternatives",
    "",
    "| Candidate | Ecosystem | Repository |",
    "|---|---|---|",
    ...rows.alternatives,
    "",
    "## Consequences",
    "",
    "The chosen package is reused."
  );
}

const COPYLEFT_PACKAGE = {
  license: "GPL-3.0",
  "dist-tags": { latest: "0.2.0" },
  versions: { "0.1.0": {}, "0.2.0": {} },
  time: {
    "0.1.0": "2022-01-01T00:00:00.000Z",
    "0.2.0": "2024-01-01T00:00:00.000Z",
  },
};

const npmCandidate = Object.freeze({ name: "left-pad", ecosystem: "npm", repository: "https://github.com/acme/left-pad" });
const pypiCandidate = Object.freeze({ name: "report-helper", ecosystem: "pypi",
  repository: "https://gitlab.example.org/acme/report-helper" });

// TST-435001 · level: unit · module: MOD-reuse-facts
// guards: UC-022; DUE DILIGENCE IS FETCHED, NOT RECALLED; A REUSE DECISION RECORDS ITS DUE DILIGENCE; A REUSED LICENCE IS SHOWN AGAINST THE PRODUCT'S
// given: npm holds left-pad with licence MIT, two releases, latest 1.2.0, 1234 downloads last month; its GitHub repository holds three open and seven closed issues
// input: registryFacts({ name: "left-pad", ecosystem: "npm", repository: "https://github.com/acme/left-pad" }, "MIT")
// expect: found true, blocked null, licence compatible, and exactly the facts read: exists, licence, first release, latest release, releases, open issues, closed issues, issues filed at and adoption, each with the address read and date 2026-10-13
test("MOD-reuse-facts registryFacts - npm candidate facts include registry, licence, release, issue and adoption facts", async () => {
  const registry = fakeRegistry({
    [NPM_LEFT_PAD]: {
      license: "MIT",
      "dist-tags": { latest: "1.2.0" },
      versions: { "1.0.0": {}, "1.2.0": {} },
      time: {
        created: "2020-01-01T00:00:00.000Z",
        modified: "2022-04-02T00:00:00.000Z",
        "1.0.0": "2020-01-02T00:00:00.000Z",
        "1.2.0": "2022-04-01T00:00:00.000Z",
      },
    },
    [NPM_LEFT_PAD_DOWNLOADS]: { downloads: 1234, start: "2026-09-13", end: READ, package: "left-pad" },
  });
  const host = fakeRepositoryHost({ open: 3, closed: 7 });

  const result = await registryFacts(npmCandidate, "MIT", { fetch: registry.fetch, connect: host.connect, now: () => READ });

  assert.deepEqual(result, {
    candidate: npmCandidate,
    facts: [
      { candidate: "left-pad", ecosystem: "npm", what: "exists", value: "yes", address: NPM_LEFT_PAD, read: READ },
      { candidate: "left-pad", ecosystem: "npm", what: "licence", value: "MIT", address: NPM_LEFT_PAD, read: READ },
      { candidate: "left-pad", ecosystem: "npm", what: "first release", value: "1.0.0 on 2020-01-02", address: NPM_LEFT_PAD, read: READ },
      { candidate: "left-pad", ecosystem: "npm", what: "latest release", value: "1.2.0 on 2022-04-01", address: NPM_LEFT_PAD, read: READ },
      { candidate: "left-pad", ecosystem: "npm", what: "releases", value: "2", address: NPM_LEFT_PAD, read: READ },
      { candidate: "left-pad", ecosystem: "npm", what: "open issues", value: "3", address: "https://github.com/acme/left-pad", read: READ },
      { candidate: "left-pad", ecosystem: "npm", what: "closed issues", value: "7", address: "https://github.com/acme/left-pad", read: READ },
      { candidate: "left-pad", ecosystem: "npm", what: "issues filed at", value: "https://github.com/acme/left-pad/issues", address: "https://github.com/acme/left-pad", read: READ },
      { candidate: "left-pad", ecosystem: "npm", what: "adoption", value: "1234 downloads last month", address: NPM_LEFT_PAD_DOWNLOADS, read: READ },
    ],
    licence: "compatible",
    found: true,
    blocked: null,
  });
  assert.deepEqual(registry.requests, [NPM_LEFT_PAD, NPM_LEFT_PAD_DOWNLOADS]);
  assert.deepEqual(host.connected, ["https://github.com/acme/left-pad"]);
});

// TST-435002 · level: unit · module: MOD-reuse-facts
// guards: UC-022; DUE DILIGENCE IS FETCHED, NOT RECALLED; A REUSED LICENCE IS SHOWN AGAINST THE PRODUCT'S
// given: PyPI holds report-helper with licence BSD-3-Clause, two releases, latest 2.0.0, 321 downloads last month; its GitLab repository holds one open and four closed issues
// input: registryFacts({ name: "report-helper", ecosystem: "pypi", repository: "https://gitlab.example.org/acme/report-helper" }, "MIT")
// expect: found true, blocked null, licence compatible, and exactly the facts read, with PyPI's package address and the GitLab repository address on issue facts
test("MOD-reuse-facts registryFacts - PyPI candidate facts include registry, licence, release, issue and adoption facts", async () => {
  const registry = fakeRegistry({
    [PYPI_REPORT_HELPER]: {
      info: { license: "BSD-3-Clause", version: "2.0.0", downloads: { last_month: 321 } },
      releases: {
        "1.0.0": [{ upload_time_iso_8601: "2021-03-04T00:00:00Z" }],
        "2.0.0": [{ upload_time_iso_8601: "2024-05-06T00:00:00Z" }],
      },
    },
  });
  const host = fakeRepositoryHost({ open: 1, closed: 4 });

  const result = await registryFacts(pypiCandidate, "MIT", { fetch: registry.fetch, connect: host.connect, now: () => READ });

  assert.deepEqual(result, {
    candidate: pypiCandidate,
    facts: [
      { candidate: "report-helper", ecosystem: "pypi", what: "exists", value: "yes", address: PYPI_REPORT_HELPER, read: READ },
      { candidate: "report-helper", ecosystem: "pypi", what: "licence", value: "BSD-3-Clause", address: PYPI_REPORT_HELPER, read: READ },
      { candidate: "report-helper", ecosystem: "pypi", what: "first release", value: "1.0.0 on 2021-03-04", address: PYPI_REPORT_HELPER, read: READ },
      { candidate: "report-helper", ecosystem: "pypi", what: "latest release", value: "2.0.0 on 2024-05-06", address: PYPI_REPORT_HELPER, read: READ },
      { candidate: "report-helper", ecosystem: "pypi", what: "releases", value: "2", address: PYPI_REPORT_HELPER, read: READ },
      { candidate: "report-helper", ecosystem: "pypi", what: "open issues", value: "1", address: "https://gitlab.example.org/acme/report-helper", read: READ },
      { candidate: "report-helper", ecosystem: "pypi", what: "closed issues", value: "4", address: "https://gitlab.example.org/acme/report-helper", read: READ },
      { candidate: "report-helper", ecosystem: "pypi", what: "issues filed at", value: "https://gitlab.example.org/acme/report-helper/-/issues", address: "https://gitlab.example.org/acme/report-helper", read: READ },
      { candidate: "report-helper", ecosystem: "pypi", what: "adoption", value: "321 downloads last month", address: PYPI_REPORT_HELPER, read: READ },
    ],
    licence: "compatible",
    found: true,
    blocked: null,
  });
  assert.deepEqual(registry.requests, [PYPI_REPORT_HELPER]);
  assert.deepEqual(host.connected, ["https://gitlab.example.org/acme/report-helper"]);
});

// TST-435003 · level: unit · module: MOD-reuse-facts
// guards: UC-022; DUE DILIGENCE IS FETCHED, NOT RECALLED
// given: npm answers 404 for missing-lib
// input: registryFacts({ name: "missing-lib", ecosystem: "npm", repository: null }, "MIT")
// expect: found false, blocked null, one exists fact saying the name may be invented, with the exact address queried; no licence is checked because no candidate licence was read
test("MOD-reuse-facts registryFacts - an unknown registry candidate is not found with the address queried", async () => {
  const registry = fakeRegistry({});

  const result = await registryFacts({ name: "missing-lib", ecosystem: "npm", repository: null },
    "MIT", { fetch: registry.fetch, connect: async () => assert.fail("no repository host is reached"), now: () => READ });

  assert.deepEqual(result, {
    candidate: { name: "missing-lib", ecosystem: "npm", repository: null },
    facts: [
      { candidate: "missing-lib", ecosystem: "npm", what: "exists", value: "not found - the name may be invented",
        address: NPM_MISSING, read: READ },
    ],
    licence: "not checked",
    found: false,
    blocked: null,
  });
  assert.deepEqual(registry.requests, [NPM_MISSING]);
});

// TST-435004 · level: unit · module: MOD-reuse-facts
// guards: UC-022; DUE DILIGENCE IS FETCHED, NOT RECALLED; A REUSE DECISION RECORDS ITS DUE DILIGENCE
// given: npm refuses a browser's request for blocked-lib with TypeError("Failed to fetch")
// input: registryFacts({ name: "blocked-lib", ecosystem: "npm", repository: null }, "MIT")
// expect: blocked names npm, the address and the reason; found false; no facts are returned
test("MOD-reuse-facts registryFacts - a registry refused by the browser returns blocked with no facts", async () => {
  const registry = fakeRegistry({ [NPM_BLOCKED]: new TypeError("Failed to fetch") });

  const result = await registryFacts({ name: "blocked-lib", ecosystem: "npm", repository: null },
    "MIT", { fetch: registry.fetch, connect: async () => assert.fail("no repository host is reached"), now: () => READ });

  assert.deepEqual(result, {
    candidate: { name: "blocked-lib", ecosystem: "npm", repository: null },
    facts: [],
    licence: "not checked",
    found: false,
    blocked: "npm at https://registry.npmjs.org/blocked-lib: Failed to fetch",
  });
  assert.deepEqual(registry.requests, [NPM_BLOCKED]);
});

// TST-435005 · level: unit · module: MOD-reuse-facts
// guards: A REUSED LICENCE IS SHOWN AGAINST THE PRODUCT'S
// given: licences.md lists MIT as compatible with MIT but does not list GPL-3.0 as compatible with MIT, and a product may have no licence
// input: licenceVerdict("MIT", "MIT"), licenceVerdict("GPL-3.0", "MIT"), licenceVerdict("MIT", null)
// expect: compatible, not known to be compatible, not checked
test("MOD-reuse-facts licenceVerdict - compatible, not known and not checked are read from licences.md", () => {
  assert.equal(licenceVerdict("MIT", "MIT"), "compatible");
  assert.equal(licenceVerdict("GPL-3.0", "MIT"), "not known to be compatible");
  assert.equal(licenceVerdict("MIT", null), "not checked");
});

// TST-436001 · level: unit · module: MOD-reuse-facts
// guards: UC-022; A REUSE DECISION RECORDS ITS DUE DILIGENCE; DUE DILIGENCE IS FETCHED, NOT RECALLED; A REUSED LICENCE IS SHOWN AGAINST THE PRODUCT'S
// given: a drafted architecture decision with a chosen npm candidate left-pad and an alternative npm candidate copyleft-lib; the product LICENSE is MIT; fake registries return every fact with read date 2026-10-13 and fake source repositories return two open and five closed issues
// input: reuseStrategies.steps["due-diligence"](draft, context)
// expect: the decision gains a ## Due diligence section before ## Consequences; the chosen MIT candidate is compatible, the GPL-3.0 alternative is marked not known to be compatible, and each row carries the registry/repository addresses and read date
test("MOD-reuse-facts due-diligence step - a decision with two candidates gains its facts table and licence marks", async () => {
  const decision = decisionWithRows({
    decision: ["| left-pad | npm | https://github.com/acme/left-pad | chosen |"],
    alternatives: ["| copyleft-lib | npm | https://github.com/acme/copyleft-lib |"],
  });
  const registry = fakeRegistry({
    [NPM_LEFT_PAD]: {
      license: "MIT",
      "dist-tags": { latest: "1.2.0" },
      versions: { "1.0.0": {}, "1.2.0": {} },
      time: { "1.0.0": "2020-01-02T00:00:00.000Z", "1.2.0": "2022-04-01T00:00:00.000Z" },
    },
    [NPM_LEFT_PAD_DOWNLOADS]: { downloads: 1234 },
    [NPM_COPYLEFT]: COPYLEFT_PACKAGE,
    [NPM_COPYLEFT_DOWNLOADS]: { downloads: 11 },
  });

  const result = await usingFetch(registry.fetch, () => reuseStrategies.steps["due-diligence"]({
    files: [{ path: "docs/architecture/ARC-900-pick-a-helper.md", text: decision, class: "new" }],
  }, context()));

  assert.deepEqual(result.findings, []);
  const withDiligence = result.draft.files[0].text;
  assert.ok(withDiligence.indexOf("## Due diligence") < withDiligence.indexOf("## Consequences"));
  assert.match(withDiligence, /\| left-pad \(npm\) - chosen \| MIT \| yes \| 1\.0\.0 on 2020-01-02 \| 1\.2\.0 on 2022-04-01 \| 2 \| 2 \/ 5 \| 1234 downloads last month \| .*https:\/\/registry\.npmjs\.org\/left-pad.*https:\/\/github\.com\/acme\/left-pad.*https:\/\/api\.npmjs\.org\/downloads\/point\/last-month\/left-pad.* \| 2026-10-13 \|/);
  assert.match(withDiligence, /\| copyleft-lib \(npm\) \| GPL-3\.0 \| not known to be compatible \| 0\.1\.0 on 2022-01-01 \| 0\.2\.0 on 2024-01-01 \| 2 \| 2 \/ 5 \| 11 downloads last month \| .*https:\/\/registry\.npmjs\.org\/copyleft-lib.*https:\/\/github\.com\/acme\/copyleft-lib.*https:\/\/api\.npmjs\.org\/downloads\/point\/last-month\/copyleft-lib.* \| 2026-10-13 \|/);
});

// TST-436002 · level: unit · module: MOD-reuse-facts
// guards: UC-022; DUE DILIGENCE IS FETCHED, NOT RECALLED
// given: a drafted architecture decision with an npm candidate missing-lib; the fake registry answers 404
// input: due-diligence step over the draft
// expect: the decision still gains a due-diligence section whose row says not found, and the step returns a warning on the line naming the candidate with the address queried
test("MOD-reuse-facts due-diligence step - an unknown candidate leaves a not-found row and a warning", async () => {
  const decision = decisionWithRows({ decision: ["| missing-lib | npm |  | chosen |"], alternatives: [] }, "Unknown helper");

  const result = await usingFetch(fakeRegistry({}).fetch, () => reuseStrategies.steps["due-diligence"]({
    files: [{ path: "docs/architecture/ARC-901-unknown-helper.md", text: decision, class: "new" }],
  }, context()));

  assert.match(result.draft.files[0].text, /missing-lib \(npm\) - chosen \| not found - the name may be invented/);
  assert.deepEqual(result.findings, [{
    artifact: "docs/architecture/ARC-901-unknown-helper.md",
    line: lineOf(decision, "| missing-lib |"),
    kind: "warning",
    rule: "DUE DILIGENCE IS FETCHED, NOT RECALLED",
    what: "missing-lib was not found at https://registry.npmjs.org/missing-lib",
    fix: "check the candidate's name or choose another candidate",
  }]);
});

// TST-436003 · level: unit · module: MOD-reuse-facts
// guards: UC-022; A REUSE DECISION RECORDS ITS DUE DILIGENCE
// given: a drafted architecture decision with an npm candidate blocked-lib; the fake registry refuses the browser call
// input: due-diligence step over the draft
// expect: the decision text is unchanged, no due-diligence section is added, and the step returns the error mark that open-files refuses
test("MOD-reuse-facts due-diligence step - a blocked registry leaves the decision unmodified and marks it", async () => {
  const decision = decisionWithRows({ decision: ["| blocked-lib | npm |  | chosen |"], alternatives: [] }, "Blocked helper");
  const registry = fakeRegistry({ [NPM_BLOCKED]: new TypeError("Failed to fetch") });

  const result = await usingFetch(registry.fetch, () => reuseStrategies.steps["due-diligence"]({
    files: [{ path: "docs/architecture/ARC-902-blocked-helper.md", text: decision, class: "new" }],
  }, context()));

  assert.equal(result.draft.files[0].text, decision);
  assert.deepEqual(result.findings, [{
    artifact: "docs/architecture/ARC-902-blocked-helper.md",
    line: lineOf(decision, "| blocked-lib |"),
    kind: "error",
    rule: "A REUSE DECISION RECORDS ITS DUE DILIGENCE",
    what: "the registry npm could not be read at https://registry.npmjs.org/blocked-lib: Failed to fetch",
    fix: "fetch the facts through a participant that can reach the web",
  }]);
});

// TST-436004 · level: unit · module: MOD-reuse-facts
// guards: UC-022; A REUSED LICENCE IS SHOWN AGAINST THE PRODUCT'S; A PRODUCT DECLARES ITS LICENCE
// given: a drafted architecture decision with one MIT npm candidate, but the product snapshot has no LICENSE
// input: due-diligence step over the draft
// expect: the due-diligence section says why licence compatibility is not checked, and every row says not checked
test("MOD-reuse-facts due-diligence step - without LICENSE every candidate is not checked", async () => {
  const decision = decisionWithRows({
    decision: ["| left-pad | npm | https://github.com/acme/left-pad | chosen |"],
    alternatives: [],
  }, "Unlicensed product");
  const registry = fakeRegistry({
    [NPM_LEFT_PAD]: {
      license: "MIT",
      "dist-tags": { latest: "1.0.0" },
      versions: { "1.0.0": {} },
      time: { "1.0.0": "2020-01-02T00:00:00.000Z" },
    },
    [NPM_LEFT_PAD_DOWNLOADS]: { downloads: 1234 },
  });

  const result = await usingFetch(registry.fetch, () => reuseStrategies.steps["due-diligence"]({
    files: [{ path: "docs/architecture/ARC-903-unlicensed-product.md", text: decision, class: "new" }],
  }, context({ files: {} })));

  assert.deepEqual(result.findings, []);
  assert.match(result.draft.files[0].text, /No product LICENSE was found; the product's licence decides what it may reuse\./);
  assert.match(result.draft.files[0].text, /\| left-pad \(npm\) - chosen \| MIT \| not checked \|/);
});

// ---------------------------------------------------------------- hubFacts (ITM-996)
//
// MOD-reuse-facts: "`hubFacts(id: string, key?: string) -> Promise<Fact[]>` — a model's or dataset's revision, licence and whether it is gated
// or private, read from the Hugging Face Hub, across the network, each with its address and date; `key` … is sent only to the Hub's own origin
// `https://huggingface.co`, in its `Authorization` header, and nowhere else; a Hub that does not answer a browser is named in the failure
// `HubBlocked { reason }`, and `NotFound { address }` for an unknown identifier." The readings these tests state (the pull request names them):
//   - The identifier is the Hub's own path: `owner/name` (or a bare `name`) for a model, `datasets/owner/name` for a dataset; the addresses read are
//     https://huggingface.co/api/models/<id> and https://huggingface.co/api/datasets/<owner/name>.
//   - The facts are `revision` (the answer's `sha`), `licence` (the card's `license`, else the tag `license:<x>`; no fact where the Hub declares none: a fact
//     not read is never filled in) and `access` (`public`, `gated (auto)` / `gated (manual)`, or `private`), each with candidate = the identifier,
//     ecosystem `huggingface`, the address and the date read.
//   - `NotFound` is the Hub's 404; `HubBlocked` is a call the browser could not make, an answer that is no success (a private resource asked without
//     its key answers 401) or an answer that is no JSON, its `reason` never holding the key.
//   - A text that is no Hub identifier is a TypeError, before any request.

const HUB = "https://huggingface.co";
const SHA = "0123456789abcdef0123456789abcdef01234567";
const today = () => new Date().toISOString().slice(0, 10);

async function reading(fetch, run) {
  const before = today();
  const answer = await usingFetch(fetch, run);
  return { answer, days: new Set([before, today()]) };
}

function fakeHub(routes) {
  const requests = [];
  return {
    requests,
    fetch: async (input, init = {}) => {
      const href = String(input?.url ?? input);
      requests.push({ href, authorization: new Headers(init.headers ?? input?.headers ?? {}).get("authorization") });
      if (!Object.hasOwn(routes, href)) return json(404, { error: "Repository not found" });
      const answer = routes[href];
      if (answer instanceof Error) throw answer;
      if (typeof answer === "number") return json(answer, { error: "refused" });
      return json(200, answer);
    },
  };
}

// TST-996001 · level: unit · module: MOD-reuse-facts
// guards: UC-040; DUE DILIGENCE IS FETCHED, NOT RECALLED
// given: a Hub (a fake of fetch) that holds the model acme/small-model, public, not gated, licence apache-2.0 in its card, at revision 0123…4567
// input: hubFacts("acme/small-model")
// expect: exactly three facts, in this order — revision "0123456789abcdef0123456789abcdef01234567", licence "apache-2.0", access "public" —, each with candidate "acme/small-model", ecosystem "huggingface", the address https://huggingface.co/api/models/acme/small-model and the date read (today); one request, to that address, with no Authorization header
test("TST-996001 hubFacts gives a model's revision, licence and access, each with its address and the date read", async () => {
  const hub = fakeHub({ [`${HUB}/api/models/acme/small-model`]: { id: "acme/small-model", sha: SHA, private: false, gated: false, cardData: { license: "apache-2.0" }, tags: ["license:apache-2.0"] } });
  const { answer, days } = await reading(hub.fetch, () => hubFacts("acme/small-model"));
  assert.deepEqual(answer.map((each) => [each.what, each.value]), [["revision", SHA], ["licence", "apache-2.0"], ["access", "public"]]);
  for (const each of answer) {
    assert.deepEqual([each.candidate, each.ecosystem, each.address], ["acme/small-model", "huggingface", `${HUB}/api/models/acme/small-model`]);
    assert.ok(days.has(each.read), `the date read is today: ${each.read}`);
  }
  assert.deepEqual(hub.requests, [{ href: `${HUB}/api/models/acme/small-model`, authorization: null }]);
});

// TST-996002 · level: unit · module: MOD-reuse-facts
// guards: UC-040; DUE DILIGENCE IS FETCHED, NOT RECALLED
// given: a Hub that holds the dataset acme/corpus, gated by manual approval, whose card declares no licence but whose tags hold license:cc-by-4.0; and the dataset acme/unlicensed, public, with neither
// input: hubFacts("datasets/acme/corpus"); hubFacts("datasets/acme/unlicensed")
// expect: the first gives revision, licence "cc-by-4.0" (from the tag) and access "gated (manual)", with the address https://huggingface.co/api/datasets/acme/corpus; the second gives revision and access "public" only — no licence fact, since the Hub declared none and none is filled in
test("TST-996002 hubFacts reads a dataset from the datasets address, the licence from the tag where the card has none, and invents none", async () => {
  const hub = fakeHub({
    [`${HUB}/api/datasets/acme/corpus`]: { id: "acme/corpus", sha: SHA, private: false, gated: "manual", tags: ["task:x", "license:cc-by-4.0"] },
    [`${HUB}/api/datasets/acme/unlicensed`]: { id: "acme/unlicensed", sha: SHA, private: false, gated: false, tags: [] },
  });
  const gated = await usingFetch(hub.fetch, () => hubFacts("datasets/acme/corpus"));
  assert.deepEqual(gated.map((each) => [each.what, each.value, each.address]), [
    ["revision", SHA, `${HUB}/api/datasets/acme/corpus`], ["licence", "cc-by-4.0", `${HUB}/api/datasets/acme/corpus`], ["access", "gated (manual)", `${HUB}/api/datasets/acme/corpus`]]);
  const bare = await usingFetch(hub.fetch, () => hubFacts("datasets/acme/unlicensed"));
  assert.deepEqual(bare.map((each) => [each.what, each.value]), [["revision", SHA], ["access", "public"]]);
});

// TST-996003 · level: unit · module: MOD-reuse-facts
// guards: UC-040
// given: a Hub that holds acme/hidden-model as private, answering with the key
// input: hubFacts("acme/hidden-model", "hf_secret_key")
// expect: the access fact reads "private"; the request carries Authorization "Bearer hf_secret_key" and goes to https://huggingface.co only; no fact holds the key
test("TST-996003 a private resource is read with the key, which goes to the Hub's own origin in Authorization and is in no fact", async () => {
  const hub = fakeHub({ [`${HUB}/api/models/acme/hidden-model`]: { id: "acme/hidden-model", sha: SHA, private: true, gated: false, cardData: { license: "mit" } } });
  const facts = await usingFetch(hub.fetch, () => hubFacts("acme/hidden-model", "hf_secret_key"));
  assert.deepEqual(facts.map((each) => [each.what, each.value]), [["revision", SHA], ["licence", "mit"], ["access", "private"]]);
  assert.deepEqual(hub.requests, [{ href: `${HUB}/api/models/acme/hidden-model`, authorization: "Bearer hf_secret_key" }]);
  assert.equal(hub.requests.every((request) => new URL(request.href).origin === HUB), true);
  assert.equal(JSON.stringify(facts).includes("hf_secret_key"), false);
});

// TST-996004 · level: unit · module: MOD-reuse-facts
// guards: UC-040; DUE DILIGENCE IS FETCHED, NOT RECALLED
// given: a Hub that holds nothing under acme/nothing-here (it answers 404), and a model and a dataset of that name
// input: hubFacts("acme/nothing-here"); hubFacts("datasets/acme/nothing-here")
// expect: each rejects with an error named NotFound whose address is the one queried — https://huggingface.co/api/models/acme/nothing-here, https://huggingface.co/api/datasets/acme/nothing-here —; no fact
test("TST-996004 an identifier the Hub does not know is NotFound with the address queried", async () => {
  const hub = fakeHub({});
  await assert.rejects(usingFetch(hub.fetch, () => hubFacts("acme/nothing-here")), { name: "NotFound", address: `${HUB}/api/models/acme/nothing-here` });
  await assert.rejects(usingFetch(hub.fetch, () => hubFacts("datasets/acme/nothing-here")), { name: "NotFound", address: `${HUB}/api/datasets/acme/nothing-here` });
});

// TST-996005 · level: unit · module: MOD-reuse-facts
// guards: UC-040
// given: a Hub the browser cannot reach (fetch rejects with "Failed to fetch"); a Hub that answers 500; one that answers 401 for a private resource asked without its key; one that answers 200 with text that is no JSON
// input: hubFacts("acme/blocked") against each; and, with the key "hf_secret_key", against the unreachable one
// expect: each rejects with an error named HubBlocked whose reason is a text: "Failed to fetch" for the first, containing 500 for the second, containing 401 for the third, naming the invalid JSON for the fourth; the reason of the keyed call holds the failure and not the key
test("TST-996005 a Hub that does not answer the browser, or answers no success, is HubBlocked with its reason, never with the key", async () => {
  const href = `${HUB}/api/models/acme/blocked`;
  await assert.rejects(usingFetch(fakeHub({ [href]: new TypeError("Failed to fetch") }).fetch, () => hubFacts("acme/blocked")), (error) => error.name === "HubBlocked" && error.reason === "Failed to fetch");
  await assert.rejects(usingFetch(fakeHub({ [href]: 500 }).fetch, () => hubFacts("acme/blocked")), (error) => error.name === "HubBlocked" && /500/.test(error.reason));
  await assert.rejects(usingFetch(fakeHub({ [href]: 401 }).fetch, () => hubFacts("acme/blocked")), (error) => error.name === "HubBlocked" && /401/.test(error.reason));
  await assert.rejects(usingFetch(async () => new Response("<html>", { status: 200 }), () => hubFacts("acme/blocked")), (error) => error.name === "HubBlocked" && /JSON/i.test(error.reason));
  await assert.rejects(usingFetch(fakeHub({ [href]: new TypeError("Failed to fetch") }).fetch, () => hubFacts("acme/blocked", "hf_secret_key")),
    (error) => error.name === "HubBlocked" && !error.reason.includes("hf_secret_key") && !error.message.includes("hf_secret_key"));
});

// TST-996006 · level: unit · module: MOD-reuse-facts
// guards: UC-040
// given: texts that are no Hub identifier: "", "a/b/c", "../etc", "acme/name?x=1", "datasets/onlyowner/a/b", and a non-text
// input: hubFacts of each, with a fetch that records every call
// expect: each rejects with a TypeError, and fetch was never called (nothing is sent for them)
test("TST-996006 a text that is no Hub identifier is a TypeError before any request", async () => {
  const hub = fakeHub({});
  for (const id of ["", "a/b/c", "../etc", "acme/name?x=1", "datasets/onlyowner/a/b", 5, null]) {
    await assert.rejects(usingFetch(hub.fetch, () => hubFacts(id)), { name: "TypeError" }, String(id));
  }
  assert.deepEqual(hub.requests, []);
});
