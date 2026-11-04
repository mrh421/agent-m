// UC-049 "Talk to an agent in the prompt bar" on the pages of the main page that the review pages' harness does not open: the page of mail (alternative 3b) and the page of settings (alternative 3c). The page is MOD-site-frame's
// real `startPage` on the main page over the views of MOD-maintenance-pages and MOD-settings-pages, in the browser, the repositories, the model endpoints ep1 and ep2 and the mailbox (a Graph fixture) of tests/maintenance-pages-world.mjs
// and tests/uc-039-world.mjs, with the real MOD-prompt-bar. The other flows of UC-049 are walked in tests/system-uc-049-talk-to-an-agent-in-the-prompt-bar.test.mjs, whose harness installs another browser document, so that the two
// are two files.
// Run: node --test tests/system-uc-049-pages-of-mail-and-settings.test.mjs
//
// Module: MOD-prompt-bar; MOD-maintenance-pages; MOD-settings-pages; MOD-participant-list
// Guards: UC-049; A PARTICIPANT THAT WRITES TO A REPOSITORY NEVER RECEIVES A MAIL; THE PLACES A MAILBOX'S MAIL MAY GO ARE CONFIGURED; NO PERSONAL DATA FROM A MAIL ENTERS A REPOSITORY; A STORED SECRET IS HIDDEN UNTIL SHOWN
// Guards: NO SECRET IN THE REPOSITORY; THE PAGE NAMES WHERE IT SENDS
// Level: system
//
// Each test states its input and its expected result in its own text, from UC-049, before it runs. Where the page and UC-049 disagree the test follows UC-049 and is marked a finding with `todo`. The counter-proofs are recorded in the
// pull request.

import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { view as maintenance } from "../src/maintenance-pages/index.mjs";
import { view as settings } from "../src/settings-pages/index.mjs";
import { LOCAL, byClass, mailOf, one, restoreWorld, textOf, trusted, waitFor } from "./maintenance-pages-world.mjs";
import { startPage } from "../src/site-frame/index.mjs";
import { openReplies as openMainPage, rawMail } from "./uc-039-world.mjs";
import { registerLikeStart } from "./uc-049-world.mjs";

registerLikeStart([maintenance, settings]);

// The main page started with the views of the maintenance pages and of the settings pages: the world of UC-039 starts it with the first, and the page is started again with both.
async function openReplies(options) {
  const { views = [maintenance, settings], ...rest } = options;
  const p = await openMainPage(rest);
  await startPage({ page: "main", views });
  await waitFor(() => p.main() !== undefined && p.main().children.length > 0);
  return p;
}

afterEach(restoreWorld);

// What this browser declares for the bar to offer (UC-049 1); the bar reads no participant list, and the instance's list here is empty.
// - local-llm and cloud-llm: endpoints at "this machine" and "a provider in the USA", which draft text;
// - local-tools: an endpoint at "this machine" whose last test found that it uses tools;
// - lab-pc-4:writer: the CLI session the Bridge lab-pc-4 offers for its agent writer, at "this machine", which drafts text and writes to the repository.
const endpoint = (url, model, key, place) => ({ kind: "openai-compatible", url, model, key, place, context: 200000 });
const DECLARED = {
  "endpoint:local-llm": endpoint("https://ep1.example.test/v1", "model-a", "k1", "this machine"),
  "endpoint:cloud-llm": endpoint("https://ep2.example.test/v1", "model-b", "k2", "a provider in the USA"),
  "endpoint:local-tools": endpoint("https://ep1.example.test/v1", "model-t", "k1", "this machine"),
  "last-test:endpoint:local-tools": { at: "2026-10-19T12:00:00Z", outcome: "ok", tools: true },
  "session:lab-pc-4:writer": { place: "this machine", context: 200000, model: "model-w", capabilities: ["draft text", "write to the repository"] },
};
const OFFER = { rows: [], settings: DECLARED, agents: ["writer"] };
const mailPage = async (extra = {}) => {
  const p = await openReplies({ inbox: [rawMail("n1", { subject: "Help with the export", body: "My export of the thesis fails.\r\nKind regards\r\nErika Mustermann" })],
    fragment: "#mail", views: [maintenance, settings], ...OFFER, ...extra });
  await trusted(one(p.main(), "read-mailbox"));
  await waitFor(() => byClass(p.main(), "mail-sender").length > 0);
  return p;
};
async function ask(p, participant, text) {
  const bar = one(document.body, "prompt-bar");
  const selector = byClass(bar, "participant").find((node) => node.localName === "select");
  if (selector) selector.value = participant;
  one(bar, "instruction").value = text;
  // A CLI session of the Bridge receives the message as an ask; an endpoint is asked directly.
  const session = participant.startsWith("lab-pc-4:");
  const before = session ? p.state.asks.length : p.w.kept.endpoint.length;
  await trusted(one(bar, "send"));
  await waitFor(() => (session ? p.state.asks.length : p.w.kept.endpoint.length) > before);
  return session ? { body: { messages: [{ content: p.state.asks[before].input }] } } : p.w.kept.endpoint[before];
}
const sentBody = (request) => request.body.messages.map((message) => message.content).join("\n");

// TST-513020 · level: system · module: MOD-prompt-bar · MOD-maintenance-pages · MOD-participant-list
// guards: UC-049; A PARTICIPANT THAT WRITES TO A REPOSITORY NEVER RECEIVES A MAIL; THE PLACES A MAILBOX'S MAIL MAY GO ARE CONFIGURED; NO PERSONAL DATA FROM A MAIL ENTERS A REPOSITORY; THE PAGE NAMES WHERE IT SENDS
// given: the page of mail shows one mail from Erika Mustermann with the subject "Help with the export"; the mailbox allows "this machine"; this browser declares the endpoints local-llm (this machine, draft text) and cloud-llm (a provider in the USA, draft text) and the CLI session lab-pc-4:writer (this machine, draft text and write to the repository)
// input: the same question sent to local-llm, to lab-pc-4:writer and to cloud-llm
// expect: the text of the mail (sender, subject and text) is given only to local-llm — an endpoint whose place the mailbox allows and that does not write to the repository; lab-pc-4:writer and cloud-llm are given the mail's MAIL- identifier only and nothing of the mail (flow: UC-049 alternative 3b)
test("alternative 3b: the text of a mail is given only to a participant the mailbox allows that does not write to the repository", async () => {
  const p = await mailPage();
  try {
    const { id } = await mailOf("n1");
    assert.match(id, /^MAIL-[0-9a-f]{16}$/);
    assert.ok(textOf(p.main()).includes("Help with the export"), "known positive: the page lists the mail");
    const readable = sentBody(await ask(p, "local-llm", "What does this mail ask?"));
    for (const part of [id, "Help with the export", "My export of the thesis fails.", "erika@example.invalid"]) assert.ok(readable.includes(part), `local-llm is given ${part}`);
    for (const who of ["lab-pc-4:writer", "cloud-llm"]) {
      const given = sentBody(await ask(p, who, "What does this mail ask?"));
      assert.ok(given.includes(id), `${who} is given the identifier`);
      for (const part of ["Help with the export", "My export of the thesis fails.", "erika@example.invalid", "Erika Mustermann"]) assert.ok(!given.includes(part), `${who} is not given ${part}`);
    }
  } finally { await p.stop(); }
});

// TST-513021 · level: system · module: MOD-prompt-bar · MOD-maintenance-pages
// guards: UC-049; A PARTICIPANT THAT WRITES TO A REPOSITORY NEVER RECEIVES A MAIL
// given: the page of mail as in TST-513020, and local-tools, an endpoint at "this machine" whose last test found that it uses tools
// input: a message sent to local-tools on the page of mail
// expect: the tools the participant is offered are those that read — list-files, read-file, search-files — and not propose-edit and hand-over, so that nothing of a mail can reach a file or a job; (known positive: read-file is among the tools offered) (flow: UC-049 alternative 3b)
test("alternative 3b: on a page of mail the tools that write are not offered", async () => {
  const p = await mailPage();
  try {
    const request = await ask(p, "local-tools", "Draft a file about this mail.");
    const tools = (request.body.tools ?? []).map((tool) => tool.function?.name);
    assert.ok(tools.includes("read-file"), `known positive: the participant is offered tools (${tools.join(", ")})`);
    assert.ok(!tools.includes("propose-edit") && !tools.includes("hand-over"), `no writing tool among ${tools.join(", ")}`);
  } finally { await p.stop(); }
});

// TST-513022 · level: system · module: MOD-prompt-bar · MOD-settings-pages · MOD-site-frame
// guards: UC-049; A STORED SECRET IS HIDDEN UNTIL SHOWN; NO SECRET IN THE REPOSITORY
// given: the settings page of a browser that stores the instance's GitHub token, a model endpoint's key and a mailbox password
// input: a message sent to local-llm on the settings page
// expect: the context names the settings; it carries no stored token, key or password (none of github_pat_…, the endpoint's key k1 or the mailbox password mail-password-966) (flow: UC-049 alternative 3c)
test("alternative 3c: the context of the settings page never carries a stored token, key or password", async () => {
  const p = await openReplies({ inbox: [rawMail("n1")], fragment: "#settings", views: [maintenance, settings], ...OFFER });
  try {
    await waitFor(() => textOf(p.main()).length > 200);
    const request = await ask(p, "local-llm", "What is stored here?");
    const given = sentBody(request);
    assert.ok(/settings/i.test(given), "the context names the settings page");
    for (const secret of ["github_pat_", "mail-password-966", "k1", "pairing-token-four"]) {
      if (secret === "k1") assert.ok(!/\bk1\b/.test(given), "the endpoint's key is not carried");
      else assert.ok(!given.includes(secret), `${secret} is not carried`);
    }
  } finally { await p.stop(); }
});

// TST-513023 · level: system · module: MOD-prompt-bar · MOD-settings-pages
// guards: UC-049
// given: the settings page of a browser that stores a GitHub token, an endpoint key and a mailbox connection that signs in to Microsoft 365 (the world of tests/uc-039-world.mjs, route graph, stores the sign-in and no password)
// input: a message sent on the settings page
// expect: UC-049 3c says "The context names the settings and whether each is stored": the context says of the GitHub token, of the endpoint key and of the mailbox, by its line's name ("Mailbox sign-in" for Microsoft 365, "Mailbox password" for IMAP), that it is stored. FINDING: the context is the text the page has drawn, which names the settings but nowhere says, per setting, whether it is stored, so this case is red on main until the subject of the settings page gives that (flow: UC-049 alternative 3c; UC-049 main flow (3))
test("alternative 3c: the context names each setting and whether it is stored", async () => {
  const p = await openReplies({ inbox: [rawMail("n1")], fragment: "#settings", views: [maintenance, settings], ...OFFER });
  try {
    await waitFor(() => textOf(p.main()).length > 200);
    const given = sentBody(await ask(p, "local-llm", "What is stored here?"));
    assert.match(given, /(GitHub token|github-token)[^\n]*\bstored\b/i, "the GitHub token is said to be stored");
    assert.match(given, /(key)[^\n]*\bstored\b/i, "the endpoint key is said to be stored");
    assert.match(given, /Mailbox sign-in[^\n]*\bstored\b/i, "the mailbox, by its line's name, is said to be stored");
  } finally { await p.stop(); }
});

// TST-513025 · level: system · module: MOD-prompt-bar · MOD-settings-pages
// guards: UC-049; EVERY STEP EXPLAINS ITSELF
// given: the settings pages of a browser that declares an endpoint, with the instance's participant list holding one participant
// input: the page of the endpoint configuration read, and the page of the participants read
// expect: UC-049 1a says "The settings page says that it appears once an endpoint is configured or a Bridge offers a CLI session": the endpoint configuration carries a folded explanation (details.explain, summary "What is this?") that names the prompt bar and says it appears once an endpoint is configured or a Bridge offers a CLI session; the participants page carries no such sentence
test("alternative 1a: the endpoint configuration says that the prompt bar appears once an endpoint is configured or a Bridge offers a CLI session", async () => {
  const said = /prompt bar appears once an endpoint is configured[^.]*Bridge[^.]*offers a CLI session/i;
  const endpoints = await openReplies({ inbox: [rawMail("n1")], fragment: "#endpoints", views: [maintenance, settings], rows: [LOCAL] });
  try {
    await waitFor(() => textOf(endpoints.main()).length > 100);
    const folded = byClass(endpoints.main(), "explain").filter((node) => node.localName === "details" && /^What is this\?/.test(textOf(node)) && said.test(textOf(node)));
    assert.equal(folded.length, 1, "the endpoint configuration folds the explanation (details.explain, summary What is this?)");
    assert.match(textOf(endpoints.main()), said, "and says when the prompt bar appears");
  } finally { await endpoints.stop(); }
  const participants = await openReplies({ inbox: [rawMail("n1")], fragment: "#participants", views: [maintenance, settings], rows: [LOCAL] });
  try {
    await waitFor(() => textOf(participants.main()).length > 100);
    assert.doesNotMatch(textOf(participants.main()), said, "the participants page does not carry the sentence");
  } finally { await participants.stop(); }
});
