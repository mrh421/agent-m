// MOD-prompt-bar, record.mjs — the recording switch and the conversation record (docs/architecture/MOD-prompt-bar.md: Parts,
// Data). recordingSchema and recordingOf read the switch docs/conversation-recording.md with recording.schema.md; conversationPath
// and appendToConversation write the conversation record docs/conversations/<yyyymmdd>-<hhmm>-<4 hex>.md with
// conversation.schema.md: started by the first message and then only appended to, one section per message, a withheld message
// naming why and nothing of its text, and a section for a job handed over. Each append is one commit on the head that was read,
// and again on a moved head.
//
// Module: MOD-prompt-bar
//
// It runs unchanged in a browser and in Node. Its reads of its own data files, once, when the module is loaded: from the disk in
// Node, from the module's own address in a browser; a schema that cannot be read, or that breaks the language, stops the module's
// load. It uses MOD-documents and MOD-repository-hosts' Host and Snapshot only through their interfaces, never through a private
// file of either.

import { loadSchema, readDocument, writeDocument } from "../documents/index.mjs";

const OWNER = "MOD-prompt-bar";
const disk = globalThis.process?.getBuiltinModule?.("node:fs");
export const SWITCH = "docs/conversation-recording.md";
// A moved head is read again at most this often within one append, so that a host that always answers Moved is not asked forever.
const ATTEMPTS = 10;

// In a browser: the module's own file, from the address the module itself was loaded from. Throws an Error naming the file and
// the server's status when it is not served.
async function ownFile(url) {
  const answer = await fetch(url);
  if (!answer.ok) throw new Error(`${OWNER}: its ${url.pathname} was not served (${answer.status})`);
  return answer.text();
}

const schemaFrom = async (name) => {
  const url = new URL(`./${name}`, import.meta.url);
  return loadSchema(disk ? disk.readFileSync(url, "utf8") : await ownFile(url), OWNER);
};

const RECORDING = await schemaFrom("recording.schema.md");
const CONVERSATION = await schemaFrom("conversation.schema.md");

/**
 * recordingSchema() -> Schema — the schema of the recording switch, read from this module's data file recording.schema.md, for
 * the settings page's form.
 * @returns {object}
 */
export function recordingSchema() {
  return RECORDING;
}

/**
 * recordingOf(instance: Snapshot) -> Promise<boolean> — whether the instance records conversations: true only for
 * docs/conversation-recording.md with `recording: on`; false for a missing file or key.
 * @param {{ read(path: string): Promise<string | null> }} instance
 * @returns {Promise<boolean>}
 */
export async function recordingOf(instance) {
  const text = await instance.read(SWITCH);
  return text !== null && readDocument(RECORDING, SWITCH, text).fields.recording === "on";
}

const pad = (n) => String(n).padStart(2, "0");
const day = (at) => `${at.getUTCFullYear()}${pad(at.getUTCMonth() + 1)}${pad(at.getUTCDate())}`;
const time = (at) => `${pad(at.getUTCHours())}${pad(at.getUTCMinutes())}`;
// A moment as the record writes it: `2026-10-07 09:00 UTC`.
const stamp = (at) => `${at.getUTCFullYear()}-${pad(at.getUTCMonth() + 1)}-${pad(at.getUTCDate())} ${pad(at.getUTCHours())}:${pad(at.getUTCMinutes())} UTC`;

/**
 * conversationPath(at: Date, hex?: string) -> string — the path of a conversation's record: docs/conversations/<yyyymmdd>-<hhmm>-<4 hex>.md,
 * the date and time those of its first message in UTC, the four hexadecimal digits random unless given.
 * @param {Date} at
 * @param {string} [hex]
 * @returns {string}
 */
export function conversationPath(at, hex = [...globalThis.crypto.getRandomValues(new Uint8Array(2))].map((b) => b.toString(16).padStart(2, "0")).join("")) {
  return `docs/conversations/${day(at)}-${time(at)}-${hex}.md`;
}

const REFUSED_FOR_SECRET = "the repository host refused the text: it holds a stored secret";

// The section an entry is: a hand-over, a withheld message (no text), or a message with its text as written.
function sectionOf(entry, withheld) {
  if (entry.job !== undefined) return `## ${stamp(entry.at)} — handed over\njob: ${entry.job}\n`;
  const lines = [`## ${stamp(entry.at)} — ${entry.who}`, `page: ${entry.page}`];
  if (withheld) return `${lines.join("\n")}\nwithheld: ${withheld}\n`;
  if (entry.model) lines.push(`model: ${entry.model}`);
  return `${lines.join("\n")}\n\n${entry.text}\n`;
}

// The record's text with the section after its last line, every byte before it as it was; a new record is its front matter and the
// section.
function withSection(text, conversation, entry, section) {
  if (text !== null) return `${text}${text.endsWith("\n\n") ? "" : text.endsWith("\n") ? "\n" : "\n\n"}${section}`;
  const head = writeDocument(CONVERSATION, { kind: CONVERSATION.schema, path: conversation.path, id: null, title: null,
    fields: { started: stamp(entry.at), started_by: conversation.startedBy }, sections: [], appended: [], body: "" });
  return `${head}${section}`;
}

/**
 * appendToConversation(host: Host, conversation: { path: string, startedBy: string }, entry) -> Promise<{ commit: string, withheld:
 * string | null }> — appends one entry to the conversation record at conversation.path, as one commit on the default branch with the
 * token of the host, on the head that was read, and again on a moved head. The first entry makes the record. An entry is
 * { at, who, page, model?, text, withheld? } — a message, `withheld` the reason its page withholds it with, in which case the
 * section names that and nothing of the text — or { at, job } — a job handed over. A commit the host refuses with SecretRefused
 * is made again with the message withheld, naming that reason. Any other failure is thrown, and nothing is appended.
 * @param {object} host
 * @param {{ path: string, startedBy: string }} conversation
 * @param {{ at: Date, who?: string, page?: string, model?: string, text?: string, withheld?: string, job?: string }} entry
 * @returns {Promise<{ commit: string, withheld: string | null }>}
 */
export async function appendToConversation(host, conversation, entry) {
  const { defaultBranch } = await host.repositoryInfo();
  let withheld = entry.withheld ?? null;
  let snapshot = await host.readSnapshot(defaultBranch);
  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    const text = withSection(await snapshot.read(conversation.path), conversation, entry, sectionOf(entry, withheld));
    try {
      const { commit } = await host.commitFiles({ branch: defaultBranch, expectedHead: snapshot.commit,
        files: [{ path: conversation.path, text }], message: `record the conversation ${conversation.path.replace(/^.*\/|\.md$/g, "")}` });
      return { commit, withheld };
    } catch (error) {
      if (error?.name === "SecretRefused" && withheld === null && entry.job === undefined) withheld = REFUSED_FOR_SECRET;
      else if (error?.name === "Moved" && error.head && error.head !== snapshot.commit) snapshot = await host.readSnapshot(error.head);
      else throw error;
    }
  }
  throw new Error(`${OWNER}: the conversation record ${conversation.path} could not be appended to: the head moved ${ATTEMPTS} times`);
}
