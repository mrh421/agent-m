// The folded explanations of the Tests pages in the frame's file (ITM-1225) — MOD-site-frame's explanations.md and explain, as docs/architecture/MOD-site-frame.md
// states them: one topic per level of the schedule (unit, component, system, paid, release, user), per occasion (every commit, pull request, nightly, release
// candidate, on demand), per field of the schedule's front matter (nightly, command, setup, cache, minutes), and the schedule's secrets and self-hosted runner,
// each holding the text the schedule and generate pages showed in folds of their own; explain(topic) returns the frame's fold of each.
// Run: node --test tests/site-frame-test-topics.test.mjs
//
// Module: MOD-site-frame
// Guards: EVERY STEP EXPLAINS ITSELF; UC-026; UC-027
// Level: unit
//
// The document is the small DOM of tests/site-frame-dom.mjs; the real explain runs over the real explanations.md, the data under test. Readings the item leaves open,
// which the pull request names:
//   - The topics are lower-case slugs: test-level-<level>, test-occasion-<occasion with hyphens>, schedule-field-<key>, schedule-secrets, schedule-self-hosted-runner.
//   - A level both pages explain keeps both texts the pages showed: the schedule's sentence, then the generate page's, as two paragraphs of one topic.
// Every expected text stands in this file. The counter-proofs are recorded in the pull request.

import "./site-frame-dom.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { topicsHeld } from "./site-frame-topics.mjs";

const { explain } = await import("../src/site-frame/index.mjs");
const HELD = topicsHeld(readFileSync(new URL("../src/site-frame/explanations.md", import.meta.url), "utf8"));

// Each topic with a passage of the text the pages showed, which its fold must hold.
const TOPIC_TEXTS = {
  "test-level-unit": ["Tests of one function or class in isolation, fast and without external services. Book: ch. 13, Unit Testing.",
    "The level unit checks one function, class or small module in isolation; derived from a module; automated, external services mocked."],
  "test-level-component": ["Tests of the interface between modules. Book: ch. 13, Component Testing.",
    "The level component checks the interface between units that work together; derived from an architecture element and its modules; automated, misuse, misunderstanding and timing cases."],
  "test-level-system": ["Tests that walk a use case end to end, with recorded responses in place of paid services. Book: ch. 13, System Testing and ch. 13 on mocking.",
    "The level system checks the integrated product along a use case; derived from a use case; automated, end to end."],
  "test-level-paid": ["Tests that call a paid service or a model, which cut across the levels; they run nightly, not on every commit. Book: ch. 13 on mocking and the nightly integration test."],
  "test-level-release": ["Tests written by a participant other than the implementer, for each requirement. Book: ch. 13, Release Testing.",
    "The level release checks a release candidate against the specification; derived from a requirement; automated or manual, written by someone other than the implementer."],
  "test-level-user": ["Manual tests whose outcome the people assigned enter. Book: ch. 13, User Testing and Acceptance Decisions.",
    "The level user checks the product in real use: alpha, beta, acceptance; derived from a requirement or acceptance criterion; manual, the outcome entered by a person."],
  "test-occasion-every-commit": ["Runs on each push to the default branch, so a break shows at once. Book: ch. 12, Test Automation and Continuous Integration."],
  "test-occasion-pull-request": ["Runs on each pull request before its merge. Book: ch. 12, Test Automation and Continuous Integration."],
  "test-occasion-nightly": ["Runs once a night, for what is too slow or too costly for every commit, such as the integration test against real services. Book: ch. 13 on mocking and the nightly integration test."],
  "test-occasion-release-candidate": ["Runs on a release candidate, and must run every test at every level; it cannot be cleared. Book: ch. 13, Release Testing."],
  "test-occasion-on-demand": ["Runs when a person starts it, naming the rows to run. Book: ch. 12, Test Automation and Continuous Integration."],
  "schedule-field-nightly": ["The time of the nightly run, HH:MM in UTC. Book: ch. 13 on mocking and the nightly integration test."],
  "schedule-field-command": ["The command that runs the test files a job is given; leave it empty where the tests run with node's own test runner. Book: ch. 12, Automated Build Systems."],
  "schedule-field-setup": ["A command run in every test job before its tests, such as installing what they need; leave it empty where nothing is installed. Book: ch. 12, Automated Build Systems."],
  "schedule-field-cache": ["The paths on the runner that setup fills and the CI service keeps between runs, one path per line; leave it empty where nothing is kept. Book: ch. 12, Test Automation and Continuous Integration."],
  "schedule-field-minutes": ["The time limit of every job on every commit and on a pull request, in whole minutes; leave it empty where none is set. Book: ch. 12, Test Automation and Continuous Integration."],
  "schedule-secrets": ["The tests that call a paid service or a model read their key from the CI's secrets. Open the server's secrets page for this product, add a secret there under the name shown, and paste its value into the server's form, never into Agent M. Book: ch. 13 on mocking and the nightly integration test."],
  "schedule-self-hosted-runner": ["A row on a self-hosted runner waits until a machine of yours is registered to this repository with the label shown. Open the server's runner page: it shows the command to run on that machine, with a short-lived token of its own, which Agent M never sees. Until a runner with the label is online, the runs of the row stay queued. Book: ch. 12, Test Automation and Continuous Integration."],
};

const flat = (text) => text.replace(/\s+/g, " ").trim();
const kids = (node) => [...node.childNodes].filter((child) => child.nodeType === 1);

// TST-1302001 · level: unit · module: MOD-site-frame
// guards: EVERY STEP EXPLAINS ITSELF; UC-026; UC-027
// given: the frame's explanations.md
// input: its topics
// expect: it holds each of the eighteen topics test-level-unit … test-level-user, test-occasion-every-commit … test-occasion-on-demand, schedule-field-nightly … schedule-field-minutes, schedule-secrets and schedule-self-hosted-runner
test("TST-1302001 — explanations.md holds a topic for each level, occasion and field of the Tests pages, and for the secrets and the runner", () => {
  const missing = Object.keys(TOPIC_TEXTS).filter((topic) => !HELD.has(topic));
  assert.deepEqual(missing, []);
});

// TST-1302002 · level: unit · module: MOD-site-frame
// guards: EVERY STEP EXPLAINS ITSELF; UC-026; UC-027
// given: the same eighteen topics
// input: explain(topic) for each
// expect: a details element of the class explain whose summary reads "What is this?" and whose text holds each passage the pages showed for that topic
test("TST-1302002 — explain returns the frame's fold of each of those topics, with the text the pages showed", () => {
  for (const [topic, passages] of Object.entries(TOPIC_TEXTS)) {
    const fold = explain(topic);
    assert.equal(fold.localName, "details", `${topic} is a fold`);
    assert.equal(fold.className, "explain", topic);
    assert.equal(kids(fold)[0]?.textContent, "What is this?", topic);
    for (const passage of passages) assert.ok(flat(fold.textContent).includes(passage), `${topic} holds: ${passage}`);
  }
});
