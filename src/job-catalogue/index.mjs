// MOD-job-catalogue — every kind of job, as data (docs/architecture/MOD-job-catalogue.md): its interface — KindDefinition,
// ToolDefinition, kindNames, kindOf and toolsOf.
//
// Module: MOD-job-catalogue
//
// It belongs to Participants and jobs (ARC-046). It runs unchanged in a browser and in Node, and reads only its own data
// files: the schema of a definition, definition.schema.md, the schema of its index, kinds.schema.md, and the schema of the
// register of tools, tools.schema.md, each once, when the module is loaded; the index kinds.md and the register tools.md, each
// once, at the first call that needs it; and each kind's three files — kind.md,
// prompt.md, answer.schema.json —, once, at the first kindOf of that kind. Each is read from the disk in Node and from the
// module's own address in a browser. A schema that cannot be read, or that breaks the language, stops the module's load, as
// MOD-documents' file says of a broken schema. It writes nothing. It uses MOD-documents and MOD-text-tools only through
// their index.mjs. Every other file of this folder is data.

// Capability, in the types below, is MOD-participant-list's type of that name.
import { documentFindings, loadSchema, readDocument, readRegister } from "../documents/index.mjs";
import { finding } from "../text-tools/index.mjs";

/**
 * A kind's definition as read, its prompt and the schema of its draft loaded with it. `prompt` is "" and `answer` null for
 * a kind without a participant, which has neither. `toolLimit` is null wherever the definition leaves `tool_limit` out,
 * whether or not it names tools.
 * @typedef {{ name: string, serves: string[], participant: "one" | "none", needs: Capability[], resources: "none" |
 *   "product", preconditions: string[], recipes: Array<{ name: string, optional: boolean }>, checks: string[],
 *   personDecides: string[], reviewer: string | null, reviewers: number, steps: string[], gatePoints: Array<"before-write" |
 *   "before-merge" | "question">, review: "person" | "none", writer: string, limit: number, tools: string[], toolLimit: number | null, purpose: string,
 *   prompt: string, answer: object | null }} KindDefinition
 */

/**
 * One row of tools.md, its argument schema read from its JSON.
 * @typedef {{ name: string, needs: Capability, description: string, input: object }} ToolDefinition
 */

const OWNER = "MOD-job-catalogue";
const RULE = "ONE DEFINITION, THREE DRIVERS";
const INDEX_PATH = "src/job-catalogue/kinds.md";
const TOOLS_PATH = "src/job-catalogue/tools.md";
// The platform's ways to read, as the module is loaded: the disk in Node, fetch in a browser.
const disk = globalThis.process?.getBuiltinModule?.("node:fs");
const web = disk ? null : globalThis.fetch;

// One of the module's own files, by its address relative to this one: from the disk in Node, from the module's own address
// in a browser.
const own = (relative) => {
  const url = new URL(relative, import.meta.url);
  return disk ? disk.readFileSync(url, "utf8") : ownFile(url);
};

// In a browser: the module's own file, from the address the module itself was loaded from. Throws an Error naming the file
// and the server's status when it is not served.
async function ownFile(url) {
  const answer = await web(url);
  if (!answer.ok) throw new Error(`${OWNER}: its ${url.pathname} was not served (${answer.status})`);
  return answer.text();
}

// A failure of its own, by name, with the fields the module file gives it.
const failure = (name, message, fields) => Object.assign(new Error(message), { name, ...fields });

// The schemas of a definition and of the index, each loaded once, as the module is loaded.
const DEFINITION = loadSchema(await own("./definition.schema.md"), OWNER);
const INDEX = loadSchema(await own("./kinds.schema.md"), OWNER);
const TOOLS = loadSchema(await own("./tools.schema.md"), OWNER);

let index = null;
const kinds = new Map();

// The index: each kind's name with its folder, in the index's order, read once.
const indexOf = () => (index ??= (async () => {
  const { rows } = readRegister(INDEX, INDEX_PATH, await own("./kinds.md"));
  return new Map(rows.map(({ cells }) => [String(cells.Kind), String(cells.Folder)]));
})());

// The register of tools: each tool by its name, in the register's order, read once.
let tools = null;
const toolTable = () => (tools ??= (async () => {
  const { rows } = readRegister(TOOLS, TOOLS_PATH, await own("./tools.md"));
  return new Map(rows.map(({ cells }) => [String(cells.Tool), { name: String(cells.Tool), needs: String(cells.Needs),
    description: String(cells.Description), input: JSON.parse(String(cells.Input)) }]));
})());

const list = (value) => (Array.isArray(value) ? value.map(String) : []);

// The definition of `name` in `folder`, its prompt and the schema of its draft. Throws InvalidKind { kind, findings } for a
// definition at odds with the definition schema, or one that does not name itself as its index row does.
async function read(name, folder) {
  const path = `src/job-catalogue/${folder}/kind.md`;
  const text = await own(`./${folder}/kind.md`);
  const document = readDocument(DEFINITION, path, text);
  const findings = documentFindings(DEFINITION, document).filter((f) => f.kind === "error");
  const fields = document.fields;
  if (typeof fields.name === "string" && fields.name !== name) {
    const line = text.split("\n").findIndex((each) => each.startsWith("name:")) + 1;
    findings.push(finding({ artifact: path, line, kind: "error", rule: RULE,
      what: `the definition names itself ${fields.name}, but its folder and the index name it ${name}`, fix: `name it ${name}` }));
  }
  if (findings.length) {
    throw failure("InvalidKind", `the definition of the kind ${name} is at odds with the definition schema`, { kind: name, findings });
  }
  const participant = fields.participant;
  const purpose = document.sections.find((section) => section.heading === "## Purpose")?.text.trim() ?? "";
  return {
    name, serves: list(fields.serves), participant, needs: list(fields.needs), resources: fields.resources,
    preconditions: list(fields.preconditions),
    recipes: list(fields.recipes).map((recipe) => ({ name: recipe.replace(/\?$/, ""), optional: recipe.endsWith("?") })),
    checks: list(fields.checks), personDecides: list(fields.person_decides),
    reviewer: typeof fields.reviewer === "string" ? fields.reviewer : null,
    reviewers: typeof fields.reviewers === "number" ? fields.reviewers : 0,
    steps: list(fields.steps), gatePoints: list(fields.gate_points), review: fields.review, writer: fields.writer,
    limit: fields.limit, tools: list(fields.tools), toolLimit: typeof fields.tool_limit === "number" ? fields.tool_limit : null,
    purpose,
    prompt: participant === "one" ? await own(`./${folder}/prompt.md`) : "",
    answer: participant === "one" ? JSON.parse(await own(`./${folder}/answer.schema.json`)) : null,
  };
}

/**
 * kindNames() -> Promise<string[]> — the names of every kind in the index, in its order.
 * @returns {Promise<string[]>}
 */
export async function kindNames() {
  return [...(await indexOf()).keys()];
}

/**
 * kindOf(name: string) -> Promise<KindDefinition> — the kind's definition, prompt and answer schema, read once per program
 * and kept. Throws UnknownKind { kind } for a name the index does not hold, and InvalidKind { kind, findings } for a
 * definition MOD-documents finds at odds with the definition schema. It does not check that the strategies a definition
 * names exist: MOD-job-runner does, when a job is prepared.
 * @param {string} name
 * @returns {Promise<KindDefinition>}
 */
export function kindOf(name) {
  if (!kinds.has(name)) {
    kinds.set(name, indexOf().then((folders) => {
      if (!folders.has(name)) throw failure("UnknownKind", `the catalogue holds no kind ${name}`, { kind: name });
      return read(name, folders.get(name));
    }));
  }
  return kinds.get(name);
}

/**
 * toolsOf(names: string[]) -> Promise<ToolDefinition[]> — the named tools, in the order named. Throws UnknownTool { tool } for
 * a name tools.md does not hold.
 * @param {string[]} names
 * @returns {Promise<ToolDefinition[]>}
 */
export async function toolsOf(names) {
  const table = await toolTable();
  return names.map((name) => {
    if (!table.has(name)) throw failure("UnknownTool", `the catalogue holds no tool ${name}`, { tool: name });
    return table.get(name);
  });
}
