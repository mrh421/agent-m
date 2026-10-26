// The tools a kind may offer, as data — MOD-job-catalogue's tools.md, read with tools.schema.md; toolsOf, and the `tools` and
// `toolLimit` that kindOf gives each kind (ITM-484).
// Run: node --test tests/job-catalogue-tools.test.mjs
//
// Module: MOD-job-catalogue
// Guards: ONE DEFINITION, THREE DRIVERS; A PARTICIPANT DECLARES ITS CAPABILITIES
// Level: unit
//
// The expected tools are stated in this file (name, capability, the required arguments of each); the catalogue is read as every
// caller reads it, through its index.mjs. Where a test asserts a refusal, the same call is first shown to succeed. Nothing
// reaches the network. The counter-proofs are recorded in the pull request.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as catalogue from "../src/job-catalogue/index.mjs";

const { kindOf, kindNames } = catalogue;
const MODULE = new URL("../src/job-catalogue/index.mjs", import.meta.url);

// The five tools of the module file's table, in its order: name, the capability it needs, the arguments its schema requires.
const FIVE = [
  { name: "list-files", needs: "read the repository", required: ["folder"] },
  { name: "read-file", needs: "read the repository", required: ["path"] },
  { name: "search-files", needs: "read the repository", required: ["text"] },
  { name: "propose-edit", needs: "draft text", required: ["path", "text"] },
  { name: "hand-over", needs: "draft text", required: ["kind", "works_on", "task"] },
];
const NAMES = FIVE.map((tool) => tool.name);
const READING = ["list-files", "read-file", "search-files"];

// TST-484001 · level: unit · module: MOD-job-catalogue
// guards: ONE DEFINITION, THREE DRIVERS; A PARTICIPANT DECLARES ITS CAPABILITIES
// given: the catalogue as shipped; the five tools stated in this file
// input: toolsOf of the five names, in the stated order
// expect: five definitions in that order; each with the stated name and capability, a description with text in it, and an input schema describing an object whose required arguments are the stated ones, each among its properties
test("toolsOf — the five tools, in the order named, each with its capability, description and argument schema", async () => {
  assert.equal(typeof catalogue.toolsOf, "function", "toolsOf is offered");
  const tools = await catalogue.toolsOf(NAMES);
  assert.deepEqual(tools.map((tool) => tool.name), NAMES);
  for (const [index, expected] of FIVE.entries()) {
    const tool = tools[index];
    assert.equal(tool.needs, expected.needs, expected.name);
    assert.match(tool.description, /\S{3,}/, `${expected.name} has a description`);
    assert.equal(tool.input.type, "object", expected.name);
    assert.deepEqual([...tool.input.required].sort(), [...expected.required].sort(), expected.name);
    for (const argument of expected.required) assert.ok(tool.input.properties[argument], `${expected.name} has ${argument}`);
  }
});

// TST-484002 · level: unit · module: MOD-job-catalogue
// guards: ONE DEFINITION, THREE DRIVERS
// given: the catalogue as shipped
// input: toolsOf(["hand-over", "list-files"]), and toolsOf([])
// expect: the first gives hand-over, then list-files — the order named, not the table's; the second gives an empty list
test("toolsOf — the tools in the order named, and none for no name", async () => {
  assert.deepEqual((await catalogue.toolsOf(["hand-over", "list-files"])).map((tool) => tool.name), ["hand-over", "list-files"]);
  assert.deepEqual(await catalogue.toolsOf([]), []);
});

// TST-484003 · level: unit · module: MOD-job-catalogue
// guards: ONE DEFINITION, THREE DRIVERS
// given: the catalogue as shipped; known positive: toolsOf(["read-file"]) gives read-file
// input: toolsOf(["read-file", "no-such-tool"])
// expect: refused with UnknownTool, whose tool is "no-such-tool"
test("toolsOf — a name tools.md lacks is refused as UnknownTool, naming it", async () => {
  assert.deepEqual((await catalogue.toolsOf(["read-file"])).map((tool) => tool.name), ["read-file"]);
  await assert.rejects(catalogue.toolsOf(["read-file", "no-such-tool"]),
    (error) => error.name === "UnknownTool" && error.tool === "no-such-tool");
});

// TST-484004 · level: unit · module: MOD-job-catalogue
// guards: ONE DEFINITION, THREE DRIVERS; A PARTICIPANT DECLARES ITS CAPABILITIES
// given: the catalogue as shipped
// input: kindOf("converse"), and kindOf of change-requirements, change-use-case and change-architecture
// expect: converse has the five tools in the stated order and a toolLimit of 30; each of the other three has the three reading tools in the stated order and then hand-over, and a toolLimit that is a positive whole number
test("kindOf — converse offers all five tools with a limit of 30, the change kinds the three that read and hand-over", async () => {
  const converse = await kindOf("converse");
  assert.deepEqual([converse.tools, converse.toolLimit], [NAMES, 30]);
  for (const name of ["change-requirements", "change-use-case", "change-architecture"]) {
    const kind = await kindOf(name);
    assert.deepEqual(kind.tools, [...READING, "hand-over"], name);
    assert.ok(Number.isInteger(kind.toolLimit) && kind.toolLimit > 0, `${name} has a limit of tool calls`);
  }
});

// TST-484005 · level: unit · module: MOD-job-catalogue
// guards: ONE DEFINITION, THREE DRIVERS
// given: the catalogue as shipped; known positive: the four kinds above name tools
// input: kindOf of every kind of kindNames()
// expect: every kind but those four has tools [] and a toolLimit of 0
test("kindOf — a kind that names no tools has an empty list and a limit of 0", async () => {
  const offering = ["converse", "change-requirements", "change-use-case", "change-architecture"];
  let seen = 0;
  for (const name of await kindNames()) {
    const kind = await kindOf(name);
    if (offering.includes(name)) { assert.ok(kind.tools.length > 0, name); continue; }
    seen += 1;
    assert.deepEqual([kind.tools, kind.toolLimit], [[], 0], name);
  }
  assert.equal(seen, 22, "the other 22 kinds were looked at");
});

// TST-484006 · level: unit · module: MOD-job-catalogue
// guards: THE CATALOGUE IS DATA
// given: the catalogue as shipped; the description and the argument names that toolsOf gives for the five tools
// input: the text of index.mjs
// expect: it holds no tool's description, no tool's name and none of the argument names stated in this file
test("no tool's description or schema stands in code", async () => {
  const code = readFileSync(MODULE, "utf8");
  const tools = await catalogue.toolsOf(NAMES);
  assert.equal(tools.length, 5, "known positive: the descriptions were read from the data");
  for (const tool of tools) {
    assert.ok(!code.includes(tool.description), `${tool.name}: description`);
    assert.ok(!code.includes(`"${tool.name}"`) && !code.includes(`'${tool.name}'`), `${tool.name}: name`);
  }
  for (const argument of ["folder", "task"]) assert.ok(!code.includes(`"${argument}"`), argument);
});

// TST-524001 · level: unit · module: MOD-job-catalogue
// guards: ONE DEFINITION, THREE DRIVERS
// given: the catalogue as shipped
// input: toolsOf(["hand-over"])
// expect: an input schema with the properties kind, works_on and task, kind and task of type string, works_on an array whose items are of type string, and all three required
test("hand-over — its arguments name what the job works on, as a required list of texts", async () => {
  const [tool] = await catalogue.toolsOf(["hand-over"]);
  const { properties, required } = tool.input;
  assert.deepEqual(Object.keys(properties).sort(), ["kind", "task", "works_on"]);
  assert.equal(properties.kind.type, "string");
  assert.equal(properties.task.type, "string");
  assert.equal(properties.works_on.type, "array");
  assert.equal(properties.works_on.items.type, "string");
  assert.deepEqual([...required].sort(), ["kind", "task", "works_on"]);
});

// TST-524002 · level: unit · module: MOD-job-catalogue
// guards: ONE DEFINITION, THREE DRIVERS
// given: the catalogue as shipped; known positive: the description of list-files is a text that does not mention works_on
// input: the description of hand-over, and that of list-files
// expect: the description of hand-over names works_on and says that it names the existing requirements, use cases, decisions, modules or items the job works on, and is empty for something new; that of list-files does not name works_on
test("hand-over — its description tells the drafter what works_on names", async () => {
  const [handOver, listFiles] = await catalogue.toolsOf(["hand-over", "list-files"]);
  assert.ok(!listFiles.description.includes("works_on"), "known positive: another description does not name it");
  assert.ok(handOver.description.includes("works_on"), "names works_on");
  assert.match(handOver.description, /existing requirements \(by their names\), use cases, decisions, modules or items the job works on/);
  assert.match(handOver.description, /empty for something new, such as a new requirement/);
});
