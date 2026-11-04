// An issue closed with links — MOD-issue-handling's closeWithLinks (ITM-583), as the accepted text of docs/architecture/MOD-issue-handling.md states it: "`closeWithLinks(host, issue, links)` — the comment `closed-with` and the issue closed; run when the pull request of a bug fix
// or of an item from the issue is merged. Errors: Access's.", and the note as docs/architecture/MOD-mail-records.md states it: "`closed-with` | Closed with <the address of the pull request or commit>; item `ITM-…`. (the item part only where there is one)"; UC-012 step 5, its first postcondition.
// Run: node --test tests/issue-handling-close-with-links.test.mjs
//
// Module: MOD-issue-handling
// Guards: UC-012; ONE CLICK PER DECISION
// Level: unit
//
// The host is a fixture that keeps every call it receives, in order. Readings the texts leave open, which the tests state (the pull request names them):
//   - The note names one address: the pull request's where `links.pullRequest` is given, else the commit's (MOD-mail-records' text has room for one). It names an item only where `links.item` is given; a bug fix gives none.
//   - The comment is made before the issue is closed, so that a refused comment leaves the issue open (as `confirmClass` closes a rejected issue).
//   - An issue that is no positive whole number, and links that give neither a pull request nor a commit, are a TypeError thrown before the host is called.
//   - The host's failures pass unchanged.
//   - The issue is read first, with the host's readIssue (ITM-1292): an issue already closed with the very note it would write is left as it is, so that two routes that run the entry for one merge note it once. Another pull request's note, or an issue closed with no note, is noted and closed.
// The counter-proofs are recorded in the pull request.

import test from "node:test";
import assert from "node:assert/strict";

const handling = await import("../src/issue-handling/index.mjs").catch((error) => ({ error }));
const records = await import("../src/mail-records/index.mjs");
const closeWithLinks = (...given) => {
  assert.ok(typeof handling.closeWithLinks === "function", `MOD-issue-handling offers closeWithLinks: ${handling.error?.message}`);
  return handling.closeWithLinks(...given);
};

/**
 * A host that keeps its writes in `calls` and the numbers of the issues it was asked to read in `reads`; `refuse` names the call that throws the failure given. `readIssue` answers the issue as MOD-repository-hosts' `Issue` gives it, with the state and the comments' texts
 * `issue` names — open with no comment where none is given.
 */
function hostOf({ refuse = null, issue = { state: "open", comments: [] } } = {}) {
  const calls = [], reads = [];
  const call = (name) => async (...given) => {
    calls.push([name, ...given]);
    if (refuse?.call === name) throw refuse.failure;
  };
  const readIssue = async (number) => {
    reads.push(number);
    if (refuse?.call === "readIssue") throw refuse.failure;
    return { number, title: "An issue", body: "", labels: [], state: issue.state, url: `https://github.com/acme/product/issues/${number}`, opened: "2026-10-28T08:00:00Z", closed: issue.state === "closed" ? "2026-10-28T09:50:00Z" : null,
      comments: issue.comments.map((body) => ({ author: "alice", body, date: "2026-10-28T09:50:00Z" })) };
  };
  return { calls, reads, host: { readIssue, commentOnIssue: call("commentOnIssue"), setIssueState: call("setIssueState"), setIssueLabels: call("setIssueLabels") } };
}
const PULL = "https://github.com/acme/product/pull/9";
const COMMIT = "https://github.com/acme/product/commit/0123456789abcdef0123456789abcdef01234567";
const REFUSED = Object.assign(new Error("The token was refused."), { name: "TokenRefused" });

// TST-583101 · level: unit · module: MOD-issue-handling
// guards: UC-012
// given: a host that keeps its calls; known positive first — the fix of a bug has a merged pull request and no item
// input: closeWithLinks(host, 7, { pullRequest, commit: null, item: null })
// expect: the calls, in this order: commentOnIssue(7, "Closed with <the pull request's address>.") and setIssueState(7, "closed"); no label is touched; the comment names no item
test("closeWithLinks — the fix of a bug closes its issue with a note naming the pull request, and no item", async () => {
  const { host, calls } = hostOf();
  await closeWithLinks(host, 7, { pullRequest: PULL, commit: null, item: null });
  assert.deepEqual(calls, [["commentOnIssue", 7, `Closed with ${PULL}.`], ["setIssueState", 7, "closed"]]);
});

// TST-583102 · level: unit · module: MOD-issue-handling
// guards: UC-012
// given: a host that keeps its calls; the pull request of an item built from the issue
// input: closeWithLinks(host, 7, { pullRequest, commit, item: "ITM-123" })
// expect: commentOnIssue(7, "Closed with <the pull request's address>; item `ITM-123`.") and then setIssueState(7, "closed"); the commit's address is not in the note
test("closeWithLinks — an item built from the issue is named in the note, after the pull request", async () => {
  const { host, calls } = hostOf();
  await closeWithLinks(host, 7, { pullRequest: PULL, commit: COMMIT, item: "ITM-123" });
  assert.deepEqual(calls, [["commentOnIssue", 7, `Closed with ${PULL}; item \`ITM-123\`.`], ["setIssueState", 7, "closed"]]);
});

// TST-583103 · level: unit · module: MOD-issue-handling
// guards: UC-012
// given: a fix that has a commit and no pull request
// input: closeWithLinks(host, 7, { pullRequest: null, commit, item: null })
// expect: commentOnIssue(7, "Closed with <the commit's address>.") and then setIssueState(7, "closed")
test("closeWithLinks — a fix with a commit and no pull request is closed with the commit's address", async () => {
  const { host, calls } = hostOf();
  await closeWithLinks(host, 7, { pullRequest: null, commit: COMMIT, item: null });
  assert.deepEqual(calls, [["commentOnIssue", 7, `Closed with ${COMMIT}.`], ["setIssueState", 7, "closed"]]);
});

// TST-583104 · level: unit · module: MOD-issue-handling, MOD-mail-records
// guards: UC-012; THE ISSUE IS THE ONLY RECORD OF A MAIL'S HANDLING
// given: the note closeWithLinks writes for a bug fix and for an item, read back as an issue's comment
// input: notesOf over an issue whose comments are those notes
// expect: each is a note of the kind closed-with — the first with no item, its subject the empty string, the second with the subject ITM-123 —, so that the replies page finds what solved the issue
test("closeWithLinks — the notes it writes are the notes MOD-mail-records reads back", async () => {
  const bug = hostOf(), built = hostOf();
  await closeWithLinks(bug.host, 7, { pullRequest: PULL, commit: null, item: null });
  await closeWithLinks(built.host, 7, { pullRequest: PULL, commit: null, item: "ITM-123" });
  const comments = [bug.calls[0][2], built.calls[0][2]].map((body) => ({ body, createdAt: "2026-10-28T09:00:00Z" }));
  assert.deepEqual(records.notesOf({ number: 7, body: "x", comments }).map(({ kind, subject }) => [kind, subject]), [["closed-with", ""], ["closed-with", "ITM-123"]]);
});

// TST-583105 · level: unit · module: MOD-issue-handling
// guards: UC-012
// given: known positive first — a pull request; then hosts that keep their calls
// input: closeWithLinks with the issue 0 and with 1.5; with links naming neither a pull request nor a commit (all null, empty strings) and with no links
// expect: each is a TypeError and the host is not called; the positive writes its two calls
test("closeWithLinks — an issue that is no number, or links with no address, are refused before anything is written", async () => {
  const good = hostOf();
  await closeWithLinks(good.host, 7, { pullRequest: PULL, commit: null, item: null });
  assert.equal(good.calls.length, 2);
  for (const [issue, links] of [[0, { pullRequest: PULL }], [1.5, { pullRequest: PULL }], [7, { pullRequest: null, commit: null, item: null }], [7, { pullRequest: "", commit: "", item: null }], [7, null]]) {
    const { host, calls } = hostOf();
    await assert.rejects(closeWithLinks(host, issue, links), TypeError, `${issue} ${JSON.stringify(links)}`);
    assert.deepEqual(calls, [], `${issue} ${JSON.stringify(links)}`);
  }
});

// TST-583106 · level: unit · module: MOD-issue-handling
// guards: UC-012
// given: hosts whose call named refuses with a TokenRefused
// input: closeWithLinks against a host whose commentOnIssue refuses; against one whose setIssueState refuses
// expect: both reject with that very error; the issue is not closed after its comment was refused (the calls are the comment alone), and the comment was made before the refused closing
test("closeWithLinks — the host's failure passes unchanged, and a refused comment leaves the issue open", async () => {
  const comment = hostOf({ refuse: { call: "commentOnIssue", failure: REFUSED } });
  await assert.rejects(closeWithLinks(comment.host, 7, { pullRequest: PULL, commit: null, item: null }), (error) => error === REFUSED);
  assert.deepEqual(comment.calls.map(([name]) => name), ["commentOnIssue"]);
  const state = hostOf({ refuse: { call: "setIssueState", failure: REFUSED } });
  await assert.rejects(closeWithLinks(state.host, 7, { pullRequest: PULL, commit: null, item: null }), (error) => error === REFUSED);
  assert.deepEqual(state.calls.map(([name]) => name), ["commentOnIssue", "setIssueState"]);
});

const OTHER_PULL = "https://github.com/acme/product/pull/8";

// TST-1292001 · level: unit · module: MOD-issue-handling
// guards: UC-012
// given: known positive first — the issue 7 closed with the note of another pull request, and closed by hand with no note; then the issue 7 closed with the note "Closed with <the pull request's address>.", and closed with the note naming that pull request and the item ITM-123
// input: closeWithLinks(host, 7, { pullRequest, commit: null, item: null }) for the first three, closeWithLinks(host, 7, { pullRequest, commit: null, item: "ITM-123" }) for the last
// expect: each reads the issue 7 once; the two positives each write commentOnIssue(7, "Closed with <the pull request's address>.") and then setIssueState(7, "closed"); the two issues already closed with the note it would write are left as they are: no write
test("closeWithLinks — an issue already closed with the note it would write is left as it is; another pull request still notes", async () => {
  const positives = [];
  for (const comments of [[`Closed with ${OTHER_PULL}.`], []]) {
    const positive = hostOf({ issue: { state: "closed", comments } });
    await closeWithLinks(positive.host, 7, { pullRequest: PULL, commit: null, item: null });
    assert.deepEqual(positive.calls, [["commentOnIssue", 7, `Closed with ${PULL}.`], ["setIssueState", 7, "closed"]], `known positive: ${comments}`);
    positives.push(positive);
  }
  for (const [note, item] of [[`Closed with ${PULL}.`, null], [`Closed with ${PULL}; item \`ITM-123\`.`, "ITM-123"]]) {
    const { host, calls, reads } = hostOf({ issue: { state: "closed", comments: ["Thanks for the report.", note] } });
    await closeWithLinks(host, 7, { pullRequest: PULL, commit: null, item });
    assert.deepEqual(calls, [], note);
    assert.deepEqual(reads, [7], note);
  }
  for (const positive of positives) assert.deepEqual(positive.reads, [7], "each positive read the issue once");
});

// TST-1292002 · level: unit · module: MOD-issue-handling
// guards: UC-012
// given: a host whose readIssue refuses with a TokenRefused
// input: closeWithLinks(host, 7, { pullRequest, commit: null, item: null })
// expect: it rejects with that very error, and nothing is written: the issue is read before it is noted
test("closeWithLinks — the issue is read before anything is written, and a refused read writes nothing", async () => {
  const { host, calls, reads } = hostOf({ refuse: { call: "readIssue", failure: REFUSED } });
  await assert.rejects(closeWithLinks(host, 7, { pullRequest: PULL, commit: null, item: null }), (error) => error === REFUSED);
  assert.deepEqual(reads, [7]);
  assert.deepEqual(calls, []);
});
