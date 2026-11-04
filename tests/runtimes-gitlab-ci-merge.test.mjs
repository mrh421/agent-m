// The job workflow is added to a product's .gitlab-ci.yml, every other line kept (ITM-548) — MOD-runtimes' jobWorkflowFiles(server,
// instance, secrets, runners, gitlabCi?), as the accepted text of docs/architecture/MOD-runtimes.md states it (Interfaces:
// jobWorkflowFiles): on GitLab, `gitlabCi` is the product's `.gitlab-ci.yml` at the head the caller read, `null` where it has none;
// the returned `.gitlab-ci.yml` is that text with three additions, each made only where it is missing — the inputs `job`, `task` and
// `endpoint` under its `spec:` header, with the header where the file has none; the entry `- local: .gitlab/agent-m-jobs.yml` under
// its `include:`, with the key where the file has none; the inputs that entry passes on —; every other line stays as it is; where the
// product has no `.gitlab-ci.yml`, the returned one is the whole file. The readings ITM-548 settles: a header gains each input it lacks
// under its `inputs:` with `default: ""`, a file without a header gets it, with its `---`, before its first line; the entry, with its
// `inputs:`, goes to the end of a list `include:`, a file without `include:` gets the key and the entry at its end; an `include:` that
// holds a single string or a map is refused with a RuntimeError named GitlabCiNotList, naming the file, and nothing is returned.
// Run: node --test tests/runtimes-gitlab-ci-merge.test.mjs
//
// Module: MOD-runtimes
// Guards: UC-010; UC-027; GITLAB PRODUCTS ARE SUPPORTED
// Level: unit
//
// jobWorkflowFiles is pure and gives text. No YAML parser stands in this repository, so the texts are compared as text: every
// expected text below is written in the test, none is read from a document or taken from the function under test. The GitLab
// files are the second of the two the function returns, at the path `.gitlab-ci.yml`. "Every other line stays as it is" is checked
// twice in the first test: by the exact expected text, and by removing the added lines from the result and finding the input again.
// Each test states its input and its expected result before it runs (given / input / expect). Nothing reaches the network. The
// counter-proofs are recorded in the pull request.

import test from "node:test";
import assert from "node:assert/strict";
import { jobWorkflowFiles, RuntimeError } from "../src/runtimes/index.mjs";

const COMMIT = "0123456789abcdef0123456789abcdef01234567";
const INSTANCE = { repository: "alice/agent-m", commit: COMMIT };
const SECRETS = { token: "AGENT_M_TOKEN", keys: ["CLAUDE_KEY"] };
const merged = (gitlabCi) => jobWorkflowFiles("gitlab", INSTANCE, SECRETS, [], gitlabCi).find((file) => file.path === ".gitlab-ci.yml").text;

// The header Agent M puts before a file that has none, and its three inputs.
const HEADER = 'spec:\n  inputs:\n    job:\n      default: ""\n    task:\n      default: ""\n    endpoint:\n      default: ""\n    secret:\n      default: ""\n---\n';
// The entry Agent M adds to an include list whose items stand two spaces in, and the key with it for a file that has none.
const ENTRY = '  - local: ".gitlab/agent-m-jobs.yml"\n    inputs:\n      job: $[[ inputs.job ]]\n      task: $[[ inputs.task ]]\n      endpoint: $[[ inputs.endpoint ]]\n      secret: $[[ inputs.secret ]]\n';
const ENTRY_LINES = ENTRY.split("\n").slice(0, -1);
// The entry of the file beside the job workflow, which runs onMainChanged and is passed nothing (ITM-1261): added to the end of the include list where missing.
const BESIDE = '  - local: ".gitlab/agent-m-main-changed.yml"\n';

// TST-548001 · level: unit · module: MOD-runtimes
// guards: UC-010; UC-027
// given: a product's .gitlab-ci.yml with stages, its own include list of two entries followed by a comment line, and a job
// input: jobWorkflowFiles("gitlab", …, that text)
// expect: the text is exactly: the header with the three inputs; every line of the input as it was; the entry with its three inputs as the third item of the include list, straight after the last item, then the entry `- local: ".gitlab/agent-m-main-changed.yml"`, before the comment; and removing the header, the lines of the entry and the line of the entry beside it from the result gives the input again, line for line
test("jobWorkflowFiles — a product's own .gitlab-ci.yml keeps every line and gains the header, the entry and its inputs", () => {
  const own = 'stages:\n  - build\n  - test\n\ninclude:\n  - local: ".gitlab/agent-m-tests.yml"\n  - template: Security/SAST.gitlab-ci.yml\n# the product\'s own job\nbuild:\n  stage: build\n  script:\n    - make\n';
  const result = merged(own);

  assert.equal(result, HEADER
    + 'stages:\n  - build\n  - test\n\ninclude:\n  - local: ".gitlab/agent-m-tests.yml"\n  - template: Security/SAST.gitlab-ci.yml\n'
    + ENTRY + BESIDE
    + '# the product\'s own job\nbuild:\n  stage: build\n  script:\n    - make\n');

  const rest = result.split("\n").slice(HEADER.split("\n").length - 1);
  const withoutEntry = [...rest.slice(0, rest.indexOf(ENTRY_LINES[0])), ...rest.slice(rest.indexOf(ENTRY_LINES[0]) + ENTRY_LINES.length + 1)];
  assert.equal(withoutEntry.join("\n"), own, "the input, line for line");
});

// TST-548002 · level: unit · module: MOD-runtimes
// guards: UC-010; UC-027
// given: a product's .gitlab-ci.yml with its own include list, and one with no include: key; the text each run returns, given again as the product's file
// input: jobWorkflowFiles("gitlab", …, the text), a second time on its own result
// expect: the first run changes the text; the second run returns the text given to it, byte for byte — installing again changes nothing
test("jobWorkflowFiles — running it again on its own result changes nothing", () => {
  const own = 'stages:\n  - build\n\ninclude:\n  - local: ".gitlab/agent-m-tests.yml"\n\nbuild:\n  script:\n    - make\n';
  const once = merged(own);
  assert.equal(once, HEADER + 'stages:\n  - build\n\ninclude:\n  - local: ".gitlab/agent-m-tests.yml"\n' + ENTRY + BESIDE + '\nbuild:\n  script:\n    - make\n',
    "the first run adds the header and the entry and keeps the rest");
  assert.equal(merged(once), once);

  const noInclude = 'build:\n  script:\n    - make\n';
  assert.equal(merged(merged(noInclude)), HEADER + 'build:\n  script:\n    - make\n' + 'include:\n' + ENTRY + BESIDE);
});

// TST-548003 · level: unit · module: MOD-runtimes
// guards: UC-010; UC-027
// given: a product's .gitlab-ci.yml with one job and no include: key
// input: jobWorkflowFiles("gitlab", …, that text)
// expect: the text is exactly: the header; the job's lines as they were; then at the end `include:`, the entry with its three inputs and the entry `- local: ".gitlab/agent-m-main-changed.yml"`
test("jobWorkflowFiles — a file without include: gets the key and the entry at its end", () => {
  assert.equal(merged('build:\n  script:\n    - make\n'), HEADER + 'build:\n  script:\n    - make\n' + 'include:\n' + ENTRY + BESIDE);
});

// TST-548004 · level: unit · module: MOD-runtimes
// guards: UC-010; UC-027
// given: a product's .gitlab-ci.yml whose include: list stands at the margin (`- local: …` in column 0), with a job after it
// input: jobWorkflowFiles("gitlab", …, that text)
// expect: the header; the input's lines; the entry after the last item at the margin's own indentation — `- local: ".gitlab/agent-m-jobs.yml"` in column 0, `inputs:` two spaces in, each input four —, then `- local: ".gitlab/agent-m-main-changed.yml"` in column 0, and the job after it
test("jobWorkflowFiles — a list written at the margin gets the entry at the margin", () => {
  assert.equal(merged('include:\n- local: "a.yml"\n\nbuild:\n  script: make\n'), HEADER
    + 'include:\n- local: "a.yml"\n'
    + '- local: ".gitlab/agent-m-jobs.yml"\n  inputs:\n    job: $[[ inputs.job ]]\n    task: $[[ inputs.task ]]\n    endpoint: $[[ inputs.endpoint ]]\n    secret: $[[ inputs.secret ]]\n'
    + '- local: ".gitlab/agent-m-main-changed.yml"\n'
    + '\nbuild:\n  script: make\n');
});

// TST-548005 · level: unit · module: MOD-runtimes
// guards: UC-010; UC-027
// given: a product's .gitlab-ci.yml whose header already declares the input `stage` and the input `job` with the default "x", and whose include: list already holds the entry for .gitlab/agent-m-jobs.yml passing on `job` only, then a job
// input: jobWorkflowFiles("gitlab", …, that text)
// expect: the header keeps `stage` and `job: default "x"` as they are and gains `task` and `endpoint`, each `default: ""`, after `job`, before the `---`; the entry is not added a second time and gains `task` and `endpoint` after its `job` line; the entry `- local: ".gitlab/agent-m-main-changed.yml"` follows it; every other line is as it was
test("jobWorkflowFiles — a header with other inputs and an entry passing on one input gain only what is missing", () => {
  const own = 'spec:\n  inputs:\n    stage:\n      default: test\n    job:\n      default: "x"\n---\ninclude:\n  - local: ".gitlab/agent-m-jobs.yml"\n    inputs:\n      job: $[[ inputs.job ]]\ntest:\n  script: make\n';
  assert.equal(merged(own),
    'spec:\n  inputs:\n    stage:\n      default: test\n    job:\n      default: "x"\n    task:\n      default: ""\n    endpoint:\n      default: ""\n    secret:\n      default: ""\n---\n'
    + 'include:\n  - local: ".gitlab/agent-m-jobs.yml"\n    inputs:\n      job: $[[ inputs.job ]]\n      task: $[[ inputs.task ]]\n      endpoint: $[[ inputs.endpoint ]]\n      secret: $[[ inputs.secret ]]\n'
    + BESIDE
    + 'test:\n  script: make\n');
});

// TST-548006 · level: unit · module: MOD-runtimes
// guards: UC-010; UC-027
// given: a product's .gitlab-ci.yml with a header declaring no `inputs:` key but another key, and an include: list holding the entry for .gitlab/agent-m-jobs.yml with no `inputs:` under it
// input: jobWorkflowFiles("gitlab", …, that text)
// expect: the header gains `  inputs:` with the three inputs, each `default: ""`, after its own key and before the `---`; the entry gains `    inputs:` with the three inputs it passes on, straight after its `local:` line; the entry `- local: ".gitlab/agent-m-main-changed.yml"` follows it; nothing else changes
test("jobWorkflowFiles — a header without inputs: and an entry without inputs: gain them", () => {
  const own = 'spec:\n  description: mine\n---\ninclude:\n  - local: ".gitlab/agent-m-jobs.yml"\ntest:\n  script: make\n';
  assert.equal(merged(own),
    'spec:\n  description: mine\n  inputs:\n    job:\n      default: ""\n    task:\n      default: ""\n    endpoint:\n      default: ""\n    secret:\n      default: ""\n---\n'
    + 'include:\n  - local: ".gitlab/agent-m-jobs.yml"\n    inputs:\n      job: $[[ inputs.job ]]\n      task: $[[ inputs.task ]]\n      endpoint: $[[ inputs.endpoint ]]\n      secret: $[[ inputs.secret ]]\n'
    + BESIDE
    + 'test:\n  script: make\n');
});

// TST-548007 · level: unit · module: MOD-runtimes
// guards: UC-010; UC-027
// given: a product's .gitlab-ci.yml whose include: is a single string, one whose include: is a block map (`local:` under it), one whose include: is written inline as a map, and one whose include: is a list holding the job file as a plain string
// input: jobWorkflowFiles("gitlab", …, each text)
// expect: each throws a RuntimeError whose name is GitlabCiNotList and whose message names `.gitlab-ci.yml`; no file is returned
test("jobWorkflowFiles — an include: that is not a list is refused as GitlabCiNotList", () => {
  const forms = {
    "a single string": 'include: ".gitlab/other.yml"\nbuild:\n  script: make\n',
    "a block map": 'include:\n  local: ".gitlab/other.yml"\nbuild:\n  script: make\n',
    "an inline map": 'include: { local: ".gitlab/other.yml" }\nbuild:\n  script: make\n',
    "the job file as a plain string": 'include:\n  - ".gitlab/agent-m-jobs.yml"\nbuild:\n  script: make\n',
  };
  for (const [form, own] of Object.entries(forms)) {
    let result = null;
    assert.throws(() => { result = merged(own); },
      (error) => error instanceof RuntimeError && error.name === "GitlabCiNotList" && /\.gitlab-ci\.yml/.test(error.message), form);
    assert.equal(result, null, `${form}: nothing is returned`);
  }
});

// TST-548008 · level: unit · module: MOD-runtimes
// guards: UC-010; UC-027
// given: no .gitlab-ci.yml of the product (gitlabCi null, and the parameter left out)
// input: jobWorkflowFiles("gitlab", …) both ways
// expect: both give, as the second file, exactly the whole file: the header with the three inputs, then `include:` with the entry and its three inputs and the entry `- local: ".gitlab/agent-m-main-changed.yml"`; and a text that holds all three additions already is returned unchanged
test("jobWorkflowFiles — with no .gitlab-ci.yml it gives the whole file", () => {
  const whole = HEADER + 'include:\n' + ENTRY + BESIDE;
  assert.equal(merged(null), whole);
  assert.equal(jobWorkflowFiles("gitlab", INSTANCE, SECRETS, []).find((file) => file.path === ".gitlab-ci.yml").text, whole);
  assert.equal(merged(whole), whole);
});

// TST-548009 · level: unit · module: MOD-runtimes
// guards: UC-010; UC-027
// given: a product's .gitlab-ci.yml whose spec: header writes `inputs: {}` inline, and one whose include: entry for .gitlab/agent-m-jobs.yml writes `inputs: { job: x }` inline
// input: jobWorkflowFiles("gitlab", …, each text)
// expect: each throws a RuntimeError named GitlabCiNotList whose message begins `.gitlab-ci.yml: the inputs: of the spec: header is not written as a block.` for the header and `.gitlab-ci.yml: the inputs: of the entry for .gitlab/agent-m-jobs.yml is not written as a block.` for the entry; no file is returned
test("jobWorkflowFiles — an inline inputs: in the header or in the entry is refused as GitlabCiNotList, naming the part", () => {
  const forms = {
    header: ['spec:\n  inputs: {}\n---\nbuild:\n  script: make\n', ".gitlab-ci.yml: the inputs: of the spec: header is not written as a block."],
    entry: ['include:\n  - local: ".gitlab/agent-m-jobs.yml"\n    inputs: { job: x }\nbuild:\n  script: make\n', ".gitlab-ci.yml: the inputs: of the entry for .gitlab/agent-m-jobs.yml is not written as a block."],
  };
  for (const [part, [own, message]] of Object.entries(forms)) {
    let result = null;
    assert.throws(() => { result = merged(own); },
      (error) => error instanceof RuntimeError && error.name === "GitlabCiNotList" && error.message.startsWith(message), part);
    assert.equal(result, null, `${part}: nothing is returned`);
  }
});

// The two endings of a GitlabCiNotList message (ITM-604), each written whole here.
const INCLUDE_ENDING = " Agent M adds its entry only to an include: that is a list, and rewrites no line of the product's own — make it a list, then install again.";
const INPUTS_ENDING = " Agent M adds its inputs only to an inputs: written as a block, and rewrites no line of the product's own — write it as a block, then install again.";
const messageOf = (gitlabCi) => { try { merged(gitlabCi); } catch (error) { return error.message; } return null; };

// TST-604001 · level: unit · module: MOD-runtimes
// guards: UC-010; UC-027
// given: a product's .gitlab-ci.yml whose include: is a single string, one whose include: is a block map, and one whose include: is written inline as a map
// input: jobWorkflowFiles("gitlab", …, each text)
// expect: each throws a GitlabCiNotList whose whole message is `.gitlab-ci.yml: include: holds a single string or an inline map.` (the single string and the inline map) or `.gitlab-ci.yml: include: holds a map.` (the block map), followed by the include: ending: ` Agent M adds its entry only to an include: that is a list, and rewrites no line of the product's own — make it a list, then install again.`
test("jobWorkflowFiles — an include: that is not a list says the include: case and nothing about inputs:", () => {
  const forms = {
    "a single string": ['include: ".gitlab/other.yml"\nbuild:\n  script: make\n', ".gitlab-ci.yml: include: holds a single string or an inline map."],
    "a block map": ['include:\n  local: ".gitlab/other.yml"\nbuild:\n  script: make\n', ".gitlab-ci.yml: include: holds a map."],
    "an inline map": ['include: { local: ".gitlab/other.yml" }\nbuild:\n  script: make\n', ".gitlab-ci.yml: include: holds a single string or an inline map."],
  };
  for (const [form, [own, why]] of Object.entries(forms)) assert.equal(messageOf(own), why + INCLUDE_ENDING, form);
});

// TST-604002 · level: unit · module: MOD-runtimes
// guards: UC-010; UC-027
// given: a product's .gitlab-ci.yml whose spec: header writes `inputs: {}` inline, and one whose include: entry for .gitlab/agent-m-jobs.yml writes `inputs: { job: x }` inline
// input: jobWorkflowFiles("gitlab", …, each text)
// expect: each throws a GitlabCiNotList whose whole message is `.gitlab-ci.yml: the inputs: of the spec: header is not written as a block.` for the header and `.gitlab-ci.yml: the inputs: of the entry for .gitlab/agent-m-jobs.yml is not written as a block.` for the entry, followed by the inputs: ending: ` Agent M adds its inputs only to an inputs: written as a block, and rewrites no line of the product's own — write it as a block, then install again.`
test("jobWorkflowFiles — an inline inputs: says the inputs: case and nothing about an include: list", () => {
  const forms = {
    header: ['spec:\n  inputs: {}\n---\nbuild:\n  script: make\n', ".gitlab-ci.yml: the inputs: of the spec: header is not written as a block."],
    entry: ['include:\n  - local: ".gitlab/agent-m-jobs.yml"\n    inputs: { job: x }\nbuild:\n  script: make\n', ".gitlab-ci.yml: the inputs: of the entry for .gitlab/agent-m-jobs.yml is not written as a block."],
  };
  for (const [part, [own, why]] of Object.entries(forms)) assert.equal(messageOf(own), why + INPUTS_ENDING, part);
});

// TST-604003 · level: unit · module: MOD-runtimes
// guards: UC-010; UC-027
// given: a product's .gitlab-ci.yml whose include: is a list holding the job file as a plain string
// input: jobWorkflowFiles("gitlab", …, that text)
// expect: a GitlabCiNotList whose whole message is `.gitlab-ci.yml: the entry for .gitlab/agent-m-jobs.yml is a plain string, which cannot pass the inputs on.` followed by the entry ending: ` Agent M passes its inputs only through an entry written with local: and inputs:, and rewrites no line of the product's own — write the entry so, then install again.` (the include: ending, which says the include: must be a list, is not in it)
const ENTRY_ENDING = " Agent M passes its inputs only through an entry written with local: and inputs:, and rewrites no line of the product's own — write the entry so, then install again.";
test("jobWorkflowFiles — the job file as a plain string in the include: says its own case, the entry", () => {
  assert.equal(messageOf('include:\n  - ".gitlab/agent-m-jobs.yml"\nbuild:\n  script: make\n'),
    ".gitlab-ci.yml: the entry for .gitlab/agent-m-jobs.yml is a plain string, which cannot pass the inputs on." + ENTRY_ENDING);
});
