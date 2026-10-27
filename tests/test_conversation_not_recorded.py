# Module: MOD-prompt-bar
# Guards: UC-049; A CONVERSATION IS WRITTEN TO A REPOSITORY ONLY WHEN RECORDING IS ON; A RECORDED CONVERSATION IS KEPT WHERE IT WAS HELD
# Guards: A RECORD IS EVIDENCE, NOT A PROPOSAL
# Level: release
"""SPEC section 14 - the check named tests/test_conversation_not_recorded.py, for the two requirements MOD-prompt-bar decides.

The cases live in tests/test_conversation_not_recorded.md. This file only loads them and asks node to start the real prompt bar
(startPromptBar of src/prompt-bar/) on a page of a product or of the instance, to send the messages of a case, to follow the hand-over
the participant proposes, which goes on without a further click, and to save an edit the way the review pages do, over a fake repository host for each of the two repositories and a
fake model endpoint. The fakes are the adapter: they hold the repositories' files, keep every commit attempt and every workflow
start, and answer the endpoint with the replies of the case. The check then looks for the needles the case lists - words that
appear in the Markdown file and nowhere else - in every commit message, every file of every commit, every job record, and, with
recording on, in the conversation records of each repository. A case's `plant` puts a needle into the job record after the run, and
`omit` takes a message out of the record before it is looked at: the counter-proofs.

Written for ITM-513 by a participant who built none of UC-049's behaviour (RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER).
"""
import json
import re
import unittest
from pathlib import Path

from jsrun import js

DATA = Path(__file__).with_suffix(".md")
OFF = "A CONVERSATION IS WRITTEN TO A REPOSITORY ONLY WHEN RECORDING IS ON"
KEPT = "A RECORDED CONVERSATION IS KEPT WHERE IT WAS HELD"

# The adapter. `input` is the case's input; the value is what the case may state: `found` (each needle: where it was found in what
# was written; `foundCount` how many places), `conversationFiles` (the paths under docs/conversations/ of each repository), `jobRecords` (the paths of the job records
# in the product), `workflowStarts` (how many times the job workflow was started), `recorded` (each needle: in which repository's
# conversation record it was found), `commits` (the number of commits made to each repository) and `missingFromRecord`.
WORLD = r"""
const sleep = () => new Promise((resolve) => setImmediate(resolve));
const until = async (condition, what) => { const limit = Date.now() + 10000; while (Date.now() < limit) { if (condition()) return; await sleep(); } throw new Error("never: " + what); };
const settle = async () => { for (let at = 0; at < 60; at += 1) await sleep(); };

// ---------------------------------------------------------------- the part of a browser's DOM that is used
class Text { constructor(data) { this.data = String(data); this.parentNode = null; } get textContent() { return this.data; } }
class Element extends EventTarget {
  constructor(name) {
    super();
    Object.assign(this, { localName: name, childNodes: [], className: "", value: "", type: "", hidden: false, disabled: false, parentNode: null, attrs: {}, html: "" });
  }
  append(...nodes) { for (const node of nodes.flat()) { const child = typeof node === "string" ? new Text(node) : node; this.childNodes.push(child); child.parentNode = this; } }
  replaceChildren(...nodes) { this.childNodes = []; this.append(...nodes); }
  setAttribute(name, value) { this.attrs[name] = String(value); }
  getAttribute(name) { return this.attrs[name] ?? null; }
  set innerHTML(value) { this.html = String(value); }
  get innerHTML() { return this.html; }
  get textContent() { return this.html + this.childNodes.map((child) => child.textContent).join(""); }
  focus() {}
}
globalThis.document = { createElement: (name) => new Element(name) };
class Storage {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
  get length() { return this.values.size; }
  key(index) { return [...this.values.keys()][index] ?? null; }
}
Object.defineProperty(globalThis, "localStorage", { configurable: true, value: new Storage() });
Object.defineProperty(globalThis, "sessionStorage", { configurable: true, value: new Storage() });
const all = (root, test) => { const found = []; (function visit(node) { for (const child of node.childNodes ?? []) if (child instanceof Element) { if (test(child)) found.push(child); visit(child); } })(root); return found; };
const byClass = (root, name) => all(root, (node) => node.className.split(" ").includes(name));
const one = (root, name) => byClass(root, name)[0];
const personal = () => Object.defineProperty(new Event("click"), "isTrusted", { value: true });

// ---------------------------------------------------------------- the two repositories (default branch trunk)
const sha1 = async (text) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-1", new TextEncoder().encode(text)))).map((byte) => byte.toString(16).padStart(2, "0")).join("");
function repoOf(web, files) {
  const commits = new Map(), attempts = [], starts = [];
  let made = 0;
  const commitOf = (tree) => { const id = String(++made).padStart(40, "0"); commits.set(id, tree); return id; };
  let head = commitOf(new Map(Object.entries(files)));
  const [, , , owner, name] = web.split("/");
  const repository = { server: "github", origin: "https://github.com", path: owner + "/" + name, web };
  const snapshotAt = (id) => {
    const tree = commits.get(id);
    return { repository, ref: id === head ? "trunk" : id, commit: id, paths: [...tree.keys()].sort(), blob: () => null, read: async (path) => (tree.has(path) ? tree.get(path) : null) };
  };
  return {
    attempts, starts, head: () => head, files: () => Object.fromEntries(commits.get(head)),
    host: {
      async repositoryInfo() { return { defaultBranch: "trunk", visibility: "public", canWrite: true, archived: false, description: "" }; },
      async readSnapshot(ref) { return snapshotAt(ref === "trunk" ? head : commits.has(ref) ? ref : head); },
      async listPullRequests() { return []; },
      async containsCommit() { return false; },
      async commitFiles(change) {
        attempts.push(structuredClone(change));
        if (change.branch !== "trunk" || change.expectedHead !== head) throw Object.assign(new Error("Moved"), { name: "Moved", head });
        head = commitOf(new Map([...commits.get(head), ...change.files.map((file) => [file.path, file.text])]));
        return { commit: head, url: web + "/commit/" + head };
      },
      async startWorkflow(workflow, ref, inputs) { starts.push({ workflow, ref, inputs: structuredClone(inputs) }); return null; },
      async listCiRuns() { return []; },
      async ciRunLog() { return null; },
      webLinks: () => ({ secrets: web + "/settings/secrets/actions" }),
      async cancelCiRun() {},
    },
  };
}

const INSTANCE_WEB = "https://github.com/alice/agent-m", PRODUCT_WEB = "https://github.com/alice/thesis-tool";
const COLUMNS = "| Name | Type | Model | Context | Price | Capabilities | Processing place | Route |\n|---|---|---|---|---|---|---|---|";
const WORKERS = "draft text, read the repository, write to the repository, run code and tests, use tools";
const REGISTER = "# Participants of this instance\n\n**REGISTER**\n\nThe fixture instance.\n\n" + COLUMNS + "\n"
  + "| alice | person | — | — | — | read the repository, write to the repository | — | account github.com/alice |\n"
  + "| tooler | model endpoint | model-t | 200000 | — | " + WORKERS + " | Anthropic, USA | endpoint ep1 secret KEY_A |\n";

// ---------------------------------------------------------------- the model endpoint behind fetch
const replies = [...input.replies];
const completion = (message) => new Response(JSON.stringify({ choices: [{ message }], usage: { prompt_tokens: 10, completion_tokens: 5 } }), { status: 200, headers: { "content-type": "application/json" } });
const stray = [];
globalThis.fetch = async (url) => {
  const where = new URL(String(url));
  if (where.origin !== "https://models.example") { stray.push(String(url)); return new Response("{}", { status: 404 }); }
  const next = replies.shift();
  if (!next) throw new Error("the endpoint was asked more often than the case says");
  if (next.calls) return completion({ content: null, tool_calls: next.calls.map(({ id, name, args }) => ({ id, type: "function", function: { name, arguments: JSON.stringify(args) } })) });
  return completion({ content: JSON.stringify({ draft: { answer: next.answer, ...(next.handOver ? { handOver: next.handOver } : {}) }, answers: [] }) });
};
jobRunner.registerStrategies("tests/test_conversation_not_recorded.py", { recipes: { "chapters-for-page": async () => [] } });

// ---------------------------------------------------------------- the page and the bar
const onInstance = input.page === "instance";
const instance = repoOf(INSTANCE_WEB, { "SPEC.md": "# Instance spec\n", "docs/participants.md": REGISTER,
  ...(input.recording ? { "docs/conversation-recording.md": "---\nrecording: on\n---\n# Recording of conversations\n" } : {}) });
const product = repoOf(PRODUCT_WEB, { "SPEC.md": "# Spec\n", "docs/notes.md": "# Notes\n\nOld text.\n", ".github/workflows/agent-m-jobs.yml": "name: agent-m-jobs\n" });
const store = browserStore.openStore("alice/agent-m");
browserStore.writeSetting(store, "endpoint:ep1", { kind: "openai-compatible", url: "https://models.example/v1", model: "model-t", key: "sk-fixture-KEY" });
browserStore.writeSetting(store, "github-token", { value: "github_pat_INSTANCE0123456789abcdef", name: "alice", expires: "2027-01-01" });
browserStore.writeSetting(store, "github-token:alice/thesis-tool", { value: "github_pat_PRODUCT0123456789abcdefg", name: "alice", expires: "2027-01-01" });
const subject = { key: "page", title: "The lending tool", kind: "converse", entry: "requirements", paramsFor: () => ({ page: "The page shows the lending tool." }), draftRoute: null, withhold: null, refuses: [] };
const target = document.createElement("div");
const bar = promptBar.startPromptBar(target, { page: "main", store, instance: { repository: "alice/agent-m", host: instance.host },
  product: () => (onInstance ? null : { address: PRODUCT_WEB, host: product.host }), subject: () => subject, explain: () => document.createElement("details"), go: () => {} });
await until(() => one(target, "instruction") !== undefined, "the bar is drawn");

const person = [], said = [];
for (const step of input.steps) {
  if (step.send !== undefined) {
    person.push(step.send);
    one(target, "participant").value = step.to ?? "tooler";
    one(target, "instruction").value = step.send;
    const asked = replies.length;
    one(target, "send").dispatchEvent(personal());
    await until(() => !one(target, "send").disabled && replies.length <= asked && byClass(target, "status").length > 0, "the message has run");
    await settle();
    said.push(...byClass(target, "answer").map((node) => node.textContent));
  } else if (step.handOver) {
    // The person's Send was the request: the hand-over goes on without a further click (UC-049, MOD-prompt-bar), and the job is followed.
    await until(() => byClass(target, "following").some((node) => node.textContent.includes("State:")), "the job is followed");
  } else if (step.save) {
    // The person saves an edit the participant proposed, as the review pages do: one commit with the edit and the job's provenance lines, which name no message.
    const trailers = jobRunner.provenanceLines({ agentM: { version: "2026.10.0", commit: "c0ffee" }, jobId: null, kind: "converse", participant: { name: "tooler", model: "model-t" }, rounds: 1 });
    const repo = onInstance ? instance : product;
    await repo.host.commitFiles({ branch: "trunk", expectedHead: repo.head(), files: [{ path: step.save.path, text: step.save.text }], message: "Save " + step.save.path + "\n\n" + trailers.join("\n") });
  }
}
await settle();
bar.stop();

// ---------------------------------------------------------------- what the case may state
const repos = { instance, product };
const jobRecords = Object.keys(product.files()).filter((path) => /^docs\/jobs\/JOB-.*\.md$/.test(path));
const written = [];
for (const [name, repo] of Object.entries(repos)) for (const attempt of repo.attempts) {
  written.push({ where: name + ": commit message", text: attempt.message });
  for (const file of attempt.files) written.push({ where: name + ": " + file.path, text: file.text });
}
if (input.plant && jobRecords.length) written.push({ where: "product: " + jobRecords[0] + " (planted)", text: input.plant });
const conversationFiles = Object.fromEntries(Object.entries(repos).map(([name, repo]) => [name, Object.keys(repo.files()).filter((path) => path.startsWith("docs/conversations/")).sort()]));
const recordText = (name) => Object.entries(repos[name].files()).filter(([path]) => path.startsWith("docs/conversations/")).map(([, text]) => text).join("\n");
const needles = input.needles ?? [];
const out = {
  found: Object.fromEntries(needles.map((needle) => [needle, written.filter((entry) => entry.text.includes(needle)).map((entry) => entry.where)])),
  foundCount: Object.fromEntries(needles.map((needle) => [needle, written.filter((entry) => entry.text.includes(needle)).length])),
  conversationFiles: Object.fromEntries(Object.entries(conversationFiles).map(([name, paths]) => [name, paths.length])),
  conversationPaths: Object.fromEntries(Object.entries(conversationFiles).map(([name, paths]) => [name, paths.every((path) => /^docs\/conversations\/\d{8}-\d{4}-[0-9a-f]{4}\.md$/.test(path))])),
  jobRecords: jobRecords.length,
  workflowStarts: product.starts.length + instance.starts.length,
  recorded: Object.fromEntries(["instance", "product"].map((name) => [name, Object.fromEntries(needles.map((needle) => [needle, recordText(name).replace(input.omit ?? "\u0000", "").includes(needle)]))])),
  commits: { instance: instance.attempts.length, product: product.attempts.length },
  strayRequests: stray.length,
  answersShown: said.length,
};
return out;
"""


def cases(section: str, data: Path = DATA) -> list[dict]:
    text = data.read_text(encoding="utf-8")
    body = re.search(rf"^## {re.escape(section)}\n(.*?)(?=^## |\Z)", text, re.M | re.S)
    if not body:
        raise AssertionError(f"missing section {section}")
    found = [{"name": m.group(1), "case": json.loads(m.group(2))}
             for m in re.finditer(r"^### ([^\n]+)\n\n```json\n(.*?)\n```", body.group(1), re.M | re.S)]
    if not found:
        raise AssertionError(f"no cases under {section}")
    return found


def run_world(argument: dict) -> dict:
    return js(f"const input = {json.dumps(argument)};\n{WORLD}")


def check(test: unittest.TestCase, section: str) -> None:
    for loaded in cases(section):
        with test.subTest(case=loaded["name"]):
            got = run_world(loaded["case"]["input"])
            wanted = loaded["case"]["expected"]
            test.assertEqual({key: got[key] for key in wanted}, wanted)


class TestConversationNotRecorded(unittest.TestCase):
    # TST-513301 · level: release · module: MOD-prompt-bar
    # guards: A CONVERSATION IS WRITTEN TO A REPOSITORY ONLY WHEN RECORDING IS ON
    # given: the cases under that requirement in the Markdown file beside this one: recording off, a conversation in which the participant reads files, proposes an edit that the person saves and hands its task to CI; and the counter-proof that plants a message in the job record
    # input: each case's steps, carried out by the real prompt bar over the fake repositories and the fake endpoint
    # expect: with recording off no message's text is in any commit, commit message or job record, no file is under docs/conversations/, and the hand-over wrote its job record and started the workflow; the planted message is found
    def test_with_recording_off_no_message_is_written(self):
        check(self, OFF)

    # TST-513302 · level: release · module: MOD-prompt-bar
    # guards: A RECORDED CONVERSATION IS KEPT WHERE IT WAS HELD; A RECORD IS EVIDENCE, NOT A PROPOSAL
    # given: the cases under that requirement in the Markdown file beside this one: recording on, a conversation on a page of a product, one on a page of the instance, and the counter-proof that takes a message out of the record
    # input: each case's steps, carried out by the real prompt bar
    # expect: each message of a conversation on a product's page is found in a conversation record of that product and in none of the instance's; one on an instance page in the instance's and in none of the product's; the record's path has the form docs/conversations/<yyyymmdd>-<hhmm>-<4 hex>.md; a message taken out is not found
    def test_with_recording_on_each_message_is_kept_where_it_was_held(self):
        check(self, KEPT)


if __name__ == "__main__":
    unittest.main()
