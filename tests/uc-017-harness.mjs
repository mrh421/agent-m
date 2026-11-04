// The harness of the system and release tests of UC-017 (Configure the participants of the instance): the frame of MOD-site-frame started at the fragment #participants over the module view of MOD-settings-pages
// (tests/settings-pages-sources.d/frame.mjs), against MOD-repository-hosts' real GitHub host for the instance akmaier/agent-m and the products acme/alpha (private) and acme/open (public), answered by the fake of
// fetch over repositories that hold files (tests/settings-pages-sources.d/github.mjs); and the Bridges of this browser, each a real MOD-bridge-http server (serveBridge) over MOD-bridge-jobs' real jobHandlers, on a
// "computer" that is a folder of small shell scripts named claude, codex and opencode, which is the whole PATH of a test — no real agent starts, and each records what it was asked. A Bridge behind the jump
// host is reached at https://jump.example.test/bridge/<name>, where a fake of the jump host's web server asks its own login before it forwards. Nothing reaches the network. It holds no test and no expected
// result: what it builds are inputs, and every test states its own expected values.
// Imported by tests/system-uc-017-participants-through-the-frame.test.mjs and tests/release-uc-017-configure-participants.test.mjs.
//
// Module: MOD-settings-pages
// Module: MOD-bridge-jobs
// Level: system
//
// Authored by developer-sonnet-j (ITM-375).

import { createHash } from "node:crypto";
import { setMaxListeners } from "node:events";
import { createServer } from "node:net";
import { chmodSync, closeSync, mkdirSync, mkdtempSync, openSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { byClass, byTag, type } from "./settings-pages-harness.mjs";
import { visit as visitFrame, click as clickFrame, settle as settleFrame } from "./settings-pages-sources.d/frame.mjs";
import { openEnclosures } from "./enclosure-fixture.mjs";

export { byClass, byTag, type };

setMaxListeners(100); // each page opened starts a frame on a window of its own

let counter = null; // the network of the page opened last
// The time the answers take: the host's (the frame's settle) and those of the Bridges, which the host's world does not count.
export async function settle() {
  for (let quiet = 0; quiet < 2;) {
    await settleFrame();
    while (counter && counter.open > 0) await new Promise((resolve) => setTimeout(resolve, 10));
    await new Promise((resolve) => setTimeout(resolve, 10));
    quiet = counter && counter.open > 0 ? 0 : quiet + 1;
  }
}
/** A person's click, and the time the answers take. */
export async function click(button) { await clickFrame(button); await settle(); }

const native = globalThis.fetch;
export const INSTANCE = "akmaier/agent-m";
export const ORIGIN = "https://akmaier.github.io";
export const TOKEN = "github_pat_INSTANCE0123456789abcdefghij";
export const PRODUCT_TOKEN = "github_pat_PRODUCT0123456789abcdefghijk";
export const ALPHA = "https://github.com/acme/alpha";
export const BETA = "https://github.com/acme/beta";
export const OPEN = "https://github.com/acme/open";
export const PARTICIPANTS = "docs/participants.md";
export const JUMP = "https://jump.example.test";
export const LOGIN = { user: "alice", password: "proxy-password" };
export const HEADER = ["| Name | Type | Model | Context | Price | Capabilities | Processing place | Route |", "|---|---|---|---|---|---|---|---|"];
export const REGISTER = (...rows) => ["# Participants of this instance", "", ...HEADER, ...rows, ""].join("\n");
export const EMPTY = REGISTER();

// ---------------------------------------------------------------- the products and the instance's process model

// The head the world gives a repository at its first state: the SHA-1 of "<owner>/<name>#0" (tests/settings-pages-sources.d/github.mjs).
export const headOf = (repository) => createHash("sha1").update(`${repository}#0`).digest("hex");
const MODEL_PATH = "docs/process-models/scrum.md";
const SCRUM = readFileSync(new URL("../src/model-catalogue/models/scrum.md", import.meta.url), "utf8");
/** The instance's files: its SPEC, the shipped Scrum model as its process model, the register `register`, and `more`. */
export const instanceFiles = (register = EMPTY, more = {}) => ({ "SPEC.md": "# Fixture instance\n\n## Process\n\nNo process requirement.\n", [MODEL_PATH]: SCRUM, [PARTICIPANTS]: register, ...more });
const declaration = ["---", "model: scrum", `model_file: ${MODEL_PATH}`, `model_version: ${headOf(INSTANCE)}`, "---", "# How the fixture product is developed", "", "## Practices", "", "- none", "", "## Branches", "",
  "| Phase or time box | Branch |", "|---|---|", "", "## Definition of Done", "", "The job rules hold for every pull request; no condition is added.", ""].join("\n");
/** A product repository: its declaration and, for each team, a role assignment `rows` = [[role, [participants]]]. */
export const productOf = (teams, visibility = "private") => ({ visibility, files: { "docs/process.md": declaration,
  ...Object.fromEntries(Object.entries(teams).map(([team, rows]) => [`docs/role-assignments/${team}.md`,
    [`# ${team}`, "", "## Roles", "", "| Role | Participants |", "|---|---|", ...rows.map(([role, names]) => `| ${role} | ${names.join(", ")} |`), ""].join("\n")])) } });

// ---------------------------------------------------------------- a computer with agents, and the Bridge on it

const script = (folder, name, body) => { writeFileSync(join(folder, name), `#!/bin/sh\n${body}\n`); chmodSync(join(folder, name), 0o755); };
// Claude Code's answer to `claude -p --output-format json`: one `result` line (tests/fixtures/agent-processes/claude-result.json); the values are synthetic.
const CLAUDE_RESULT = JSON.stringify({ type: "result", subtype: "success", is_error: false, result: "ok", usage: { input_tokens: 5, output_tokens: 1 } });
/**
 * computer({ claude, codex, opencode }) -> { root, bin, folders, calls() } — a folder that is the whole PATH, with the agents given: claude: { loggedIn, answers }, codex: { loggedIn }, opencode: {}; each
 * script appends `<script> <arguments>` to the file of its calls, and the prompt it is given on its standard input; `calls()` lists them. `folders` holds the working folder of each agent.
 */
export function computer({ claude = null, codex = null, opencode = null } = {}) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "agent-m-375-"))), bin = join(root, "bin"), calls = join(root, "calls");
  mkdirSync(bin);
  writeFileSync(calls, "");
  const log = `printf '%s\\n' "$0 $*" >> ${calls}`;
  if (claude) {
    const login = claude.loggedIn === false ? "exit 1" : "echo '{\"authMethod\":\"claude.ai\"}'";
    script(bin, "claude", `${log}\ncase "$*" in '--version') echo '2.1.300';; 'auth status') ${login};; *) ${claude.answers === false ? "exit 2" : `printf '%s\\n' '${CLAUDE_RESULT}'`};; esac`);
  }
  if (codex) script(bin, "codex", `${log}\ncase "$*" in '--version') echo 'codex 1.2.3';; 'login status') ${codex.loggedIn === false ? "exit 1" : "echo 'Logged in'"};; *) /bin/cat > /dev/null; echo ok;; esac`);
  if (opencode) script(bin, "opencode", `${log}\ncase "$1" in --version) echo 1.4.0;; models) echo opencode/big-pickle;; *) /bin/cat > /dev/null; printf '%s\\n' '{"type":"text","part":{"text":"ok"}}';; esac`);
  const folders = { claude: join(root, "work-claude"), codex: join(root, "work-codex"), opencode: join(root, "work-opencode") };
  for (const folder of Object.values(folders)) mkdirSync(folder);
  return { root, bin, folders, calls: () => readFileSync(calls, "utf8").trim().split("\n").filter(Boolean) };
}

/**
 * startBridge(t, machine, { name, offered }) -> { name, address, port, token, close() } — a real Bridge (serveBridge over jobHandlers) on `machine`: it offers the agents `offered` with their working
 * folders and answers only the instance's Pages origin with its pairing token. The PATH of the process is the machine's for the length of the test `t`.
 */
export async function startBridge(t, machine, { name = "laptop", offered = ["claude", "codex"] } = {}) {
  const { serveBridge } = await import("../src/bridge-http/index.mjs");
  const { jobHandlers } = await import("../src/bridge-jobs/index.mjs");
  const prior = process.env.PATH, info = console.info;
  process.env.PATH = machine.bin;
  console.info = () => {};
  const dataFolder = join(machine.root, `data-${name}`);
  const handlers = jobHandlers({ enclosures: openEnclosures(), agents: offered.map((agent) => ({ name: agent, folder: machine.folders[agent] })) });
  const server = await serveBridge({ name: () => name, host: "127.0.0.1", port: 0, origin: ORIGIN, dataFolder, paused: () => false }, { jobs: handlers, mail: {}, tunnels: {} });
  const bridge = { name, address: server.address, port: Number(new URL(server.address).port), token: server.token, close: server.close };
  t.after(async () => { process.env.PATH = prior; console.info = info; await server.close(); rmSync(machine.root, { recursive: true, force: true }); });
  return bridge;
}

// ---------------------------------------------------------------- the network of the browser

/** A TCP forward on the loopback: what `ssh -L` or `ssh -R` does with the tunnel plan of MOD-bridge-client — the connections to `listen` go to `target`. -> { port, close() }. */
export async function forward(t, target, listen = 0) {
  const net = await import("node:net");
  const sockets = new Set();
  const server = createServer((from) => {
    const to = net.connect(target, "127.0.0.1");
    sockets.add(from).add(to);
    from.pipe(to); to.pipe(from);
    from.on("error", () => to.destroy()); to.on("error", () => from.destroy());
  });
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(listen, "127.0.0.1", resolve); });
  const port = server.address().port;
  const close = () => new Promise((resolve) => { for (const socket of sockets) socket.destroy(); server.close(resolve); });
  t.after(close);
  return { port, close };
}

/** A loopback port that nothing listens on. */
export async function freePort() {
  const net = await import("node:net");
  const server = net.createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  await new Promise((resolve) => server.close(resolve));
  return port;
}

/**
 * modelServer(t) -> { url, requests } — a model server on the loopback that answers an OpenAI-compatible chat request with the text "ok" and records each request as { path, authorization, body }.
 */
export async function modelServer(t) {
  const http = await import("node:http");
  const requests = [];
  const server = http.createServer(async (request, response) => {
    let text = "";
    for await (const chunk of request) text += chunk;
    requests.push({ path: request.url, authorization: request.headers.authorization, body: JSON.parse(text) });
    response.writeHead(200, { "content-type": "application/json", "access-control-allow-origin": "*" });
    response.end(JSON.stringify({ choices: [{ message: { content: "ok" } }] }));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => { server.closeAllConnections?.(); server.close(resolve); }));
  return { url: `http://127.0.0.1:${server.address().port}/v1`, requests };
}

/**
 * network(world, { jump }) -> fetch — the fetch the browser meets: a request to the loopback goes to what listens there, with the Origin a browser adds; a request to the jump host's HTTPS address
 * `https://jump.example.test/bridge/<name>/…` is answered 401 with `www-authenticate` unless it carries the web server's own login, and otherwise forwarded to the loopback port `jump[name]`, with the path
 * after `/bridge/<name>`; everything else is GitHub's, the world's. `seen` lists every request that reached a loopback address or the jump host, as { url, authorization }.
 */
export function network(world, { jump = {} } = {}) {
  const seen = [];
  counter = { open: 0 };
  const open = counter;
  const basic = `Basic ${Buffer.from(`${LOGIN.user}:${LOGIN.password}`).toString("base64")}`;
  const toLoopback = (url, init) => native(url, { ...init, headers: { ...Object.fromEntries(new Headers(init.headers ?? {})), origin: ORIGIN } });
  const fetch = async (input, init = {}) => {
    open.open += 1;
    try { return await answer(input, init); } finally { open.open -= 1; }
  };
  const answer = async (input, init) => {
    const url = new URL(typeof input === "object" && !(input instanceof URL) ? input.url : String(input));
    const headers = new Headers(init.headers ?? {});
    if (["127.0.0.1", "localhost"].includes(url.hostname) && url.port) {
      seen.push({ url: String(url), authorization: headers.get("authorization") });
      return toLoopback(url, init);
    }
    if (url.origin === JUMP) {
      seen.push({ url: String(url), authorization: headers.get("authorization") });
      if (headers.get("authorization") !== basic) return new Response("login required", { status: 401, headers: { "www-authenticate": 'Basic realm="Agent M"' } });
      const [, , name, ...rest] = url.pathname.split("/");
      const port = jump[name];
      if (port === undefined) return new Response(JSON.stringify({ error: "not-found" }), { status: 502 });
      return toLoopback(`http://127.0.0.1:${port}/${rest.join("/")}${url.search}`, init);
    }
    return world.fetch(input, init);
  };
  return Object.assign(fetch, { seen });
}

// ---------------------------------------------------------------- the page

/**
 * page(t, { instance, products, settings, jump, fragment }) -> { world, main, location, network } — the frame started at `fragment` (#participants), the instance akmaier/agent-m holding `instance` (files by
 * path; docs/participants.md among them as given), the products `products` ({ "owner/name": { files, visibility } }), this browser's store holding `settings` plus the instance's token; `jump` maps a Bridge's
 * name to the loopback port the jump host forwards it to.
 */
export async function page(t, { instance = instanceFiles(), products = {}, settings = {}, jump = {}, fragment = "#participants", visibility = "private" } = {}) {
  let net;
  const shown = await visitFrame(t, fragment, {
    repositories: { [INSTANCE]: { files: instance, visibility }, ...products },
    settings: { "github-token": { value: TOKEN, name: "Agent M · akmaier/agent-m", expires: "2027-01-01" }, ...settings },
    serve: (world) => (net = network(world, { jump })),
  });
  return { ...shown, network: net };
}

// ---------------------------------------------------------------- what a person sees and presses

export const one = (root, className) => {
  const found = byClass(root, className);
  if (found.length !== 1) throw new Error(`${found.length} elements of class ${className}, not one`);
  return found[0];
};
/** Types `value` into the field of class `className` under `root`. */
export async function put(root, className, value) { type(one(root, className), value); await settle(); }
/** Chooses `value` in the select of class `className` under `root`, as a person does. */
export async function choose(root, className, value) {
  const select = one(root, className);
  select.value = value;
  select.dispatchEvent(new Event("change"));
  await settle();
}
export const saveButton = (root) => byTag(one(root, "participants-form-box"), "button").filter((button) => button.textContent === "Save").at(-1);
/** The person opens + Add participant and picks the type. -> the form box. */
export async function addParticipant(main, kind) {
  await click(one(main, "participants-add"));
  await choose(main, "participant-type", kind);
  return one(main, "participants-form-box");
}
/** The person presses Save in the form. */
export async function save(main) { await click(saveButton(main)); }
/** The text of docs/participants.md in the world's instance repository. */
export const registerOf = (shown) => shown.world.files(INSTANCE)[PARTICIPANTS];
/** The commits of the instance's repository. */
export const commitsOf = (shown, repository = INSTANCE) => shown.world.commits(repository);
