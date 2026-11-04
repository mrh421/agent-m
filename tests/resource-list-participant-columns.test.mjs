// A resource list with a participant's columns is rejected under A RESOURCE IS USED, A PARTICIPANT DEVELOPS (ITM-1154), as the accepted text of docs/architecture/MOD-resource-list.md states it: the Data table's optional
// columns Capabilities and Role, left out of a list as written there; `Resource` with `capabilities` and `role`, "the cells of the optional columns Capabilities and Role, `null` where the list has no such column or
// the cell is left out"; `resourceFindings` refusing "an entry that carries a participant's capabilities or role"; and a caller that makes a `Resource` of a row reading every column of it, so that `resourceFindings` sees
// an entry that fills one. The list is read with `resourceSchema` through MOD-documents, whose schema language marks a column optional.
// Run: node --test tests/resource-list-participant-columns.test.mjs
//
// Module: MOD-resource-list
// Guards: A RESOURCE IS USED, A PARTICIPANT DEVELOPS; A PRODUCT DECLARES ITS RESOURCES; THE RESOURCE KIND IS ONE OF A CLOSED SET
// Level: unit
//
// The caller that makes a `Resource` is the module's own reader (the recipes of `resourceStrategies`) and MOD-settings-pages' (tests/settings-pages-resources.test.mjs). Here the list is read through `readRegister`, and
// a `Resource` is made of a row as the callers make it, to show what the schema gives them. Each test states its input and its expected result before it runs (given / input / expect). The counter-proofs are run as
// mutations and recorded in the pull request.

import test from "node:test";
import assert from "node:assert/strict";
import { documentFindings, readRegister } from "../src/documents/index.mjs";
import { resourceFindings, resourceSchema } from "../src/resource-list/index.mjs";

const COLUMNS = ["Name", "Kind", "Address", "Pin", "Licence", "Maintainer", "Route", "Processing place", "Paid", "Secret"];
const AGENT = { Name: "coder", Kind: "agent", Address: "https://agents.example.org/coder", Pin: "coder-v1", Maintainer: "unknown", Route: "bridge workstation", "Processing place": "NHR@FAU, Erlangen", Paid: "no" };
const listOf = (rows, header = COLUMNS) =>
  ["# Resources of this product", "", `| ${header.join(" | ")} |`, `|${header.map(() => "---").join("|")}|`, ...rows.map((row) => `| ${header.map((column) => row[column] ?? "—").join(" | ")} |`), ""].join("\n");
const read = (text) => readRegister(resourceSchema(), "docs/resources.md", text);
const errorsOf = (text) => documentFindings(resourceSchema(), read(text).document).filter((found) => found.kind === "error");
// A Resource of a row as the callers make it from its cells.
const resourceOf = ({ cells: c }) => ({ name: c.Name, kind: c.Kind, address: c.Address, pin: c.Pin ?? null, licence: c.Licence ?? null, maintainer: c.Maintainer ?? null, route: c.Route ?? "",
  place: c["Processing place"] ?? null, paid: c.Paid === "yes" ? true : c.Paid === "no" ? false : null, secret: c.Secret ?? null, capabilities: c.Capabilities ?? null, role: c.Role ?? null });
const DEVELOPS = "A RESOURCE IS USED, A PARTICIPANT DEVELOPS", DECLARES = "A PRODUCT DECLARES ITS RESOURCES";

// TST-115401 · level: unit · module: MOD-resource-list
// guards: A RESOURCE IS USED, A PARTICIPANT DEVELOPS
// given: a docs/resources.md whose table has, besides its ten columns, the columns Capabilities and Role, and an agent entry that fills them
// input: the list read with the schema; documentFindings of it; resourceFindings of the Resource made of the row
// expect: the table is the resource table: the row is read with its cells Capabilities "draft text" and Role "Builders", and the schema finds nothing; resourceFindings refuses the entry, with the rule A RESOURCE IS USED, A PARTICIPANT DEVELOPS
test("a list whose table has the optional columns Capabilities and Role is read, and the entry that fills them is refused under A RESOURCE IS USED, A PARTICIPANT DEVELOPS", () => {
  const text = listOf([{ ...AGENT, Capabilities: "draft text", Role: "Builders" }], [...COLUMNS, "Capabilities", "Role"]);
  const rows = read(text).rows;
  assert.equal(rows.length, 1, "the row is read");
  assert.deepEqual([rows[0].cells.Capabilities, rows[0].cells.Role], ["draft text", "Builders"]);
  assert.deepEqual(errorsOf(text), []);
  const refused = resourceFindings(rows.map(resourceOf)).filter((found) => found.kind === "error");
  assert.deepEqual(refused.map((found) => found.rule), [DEVELOPS]);
});

// TST-115402 · level: unit · module: MOD-resource-list
// guards: A RESOURCE IS USED, A PARTICIPANT DEVELOPS
// given: the same agent entry in a list without the two columns, in a list with the two columns whose cells are left out (—), and in a list with the column Capabilities alone
// input: each read, judged by documentFindings and by resourceFindings
// expect: counter-proof — the list without the two columns, and the list whose cells are left out, are accepted: the row is read, no error, and `capabilities` and `role` are null; the list with Capabilities alone and a filled cell is refused under the same rule
test("the same list without the two columns, or with them left out, is accepted", () => {
  for (const [what, text] of [["without the columns", listOf([AGENT])], ["with the columns left out", listOf([AGENT], [...COLUMNS, "Capabilities", "Role"])]]) {
    const rows = read(text).rows;
    assert.equal(rows.length, 1, `${what}: the row is read`);
    assert.deepEqual(errorsOf(text), [], what);
    assert.deepEqual(resourceFindings(rows.map(resourceOf)).filter((found) => found.kind === "error"), [], what);
    assert.deepEqual([resourceOf(rows[0]).capabilities, resourceOf(rows[0]).role], [null, null], what);
  }
  const one = listOf([{ ...AGENT, Capabilities: "draft text" }], [...COLUMNS, "Capabilities"]);
  assert.deepEqual(resourceFindings(read(one).rows.map(resourceOf)).map((found) => found.rule), [DEVELOPS]);
});

// TST-115403 · level: unit · module: MOD-resource-list
// guards: A PRODUCT DECLARES ITS RESOURCES
// given: lists whose header lacks the column Secret, names the columns in another order (Kind before Name), adds a column Notes, and names Role before Capabilities
// input: documentFindings of each
// expect: no other finding changes its rule: each header is refused under A PRODUCT DECLARES ITS RESOURCES, and none under A RESOURCE IS USED, A PARTICIPANT DEVELOPS; no row is read from any
test("a header that lacks a column, is out of order or adds another column keeps A PRODUCT DECLARES ITS RESOURCES", () => {
  const without = COLUMNS.filter((column) => column !== "Secret");
  const swapped = ["Kind", "Name", ...COLUMNS.slice(2)];
  const headers = [["lacks Secret", without], ["out of order", swapped], ["adds Notes", [...COLUMNS, "Notes"]], ["Role before Capabilities", [...COLUMNS, "Role", "Capabilities"]]];
  for (const [what, header] of headers) {
    const text = listOf([AGENT], header);
    assert.deepEqual(read(text).rows, [], `${what}: no row is read`);
    const errors = errorsOf(text);
    assert.ok(errors.length > 0, `${what}: refused`);
    assert.deepEqual([...new Set(errors.map((found) => found.rule))], [DECLARES], what);
  }
});

// TST-115404 · level: unit · module: MOD-resource-list
// guards: A PRODUCT DECLARES ITS RESOURCES; THE RESOURCE KIND IS ONE OF A CLOSED SET
// given: lists of the ten columns with a Name, an Address or a Route left out, and one with an unknown Kind
// input: each judged by documentFindings
// expect: the cell findings keep their rules: the three left-out cells are refused under A PRODUCT DECLARES ITS RESOURCES, the unknown kind under THE RESOURCE KIND IS ONE OF A CLOSED SET
test("the cell findings of the list keep their rules", () => {
  const cases = [["Name", { ...AGENT, Name: "" }, DECLARES], ["Address", { ...AGENT, Address: "" }, DECLARES], ["Route", { ...AGENT, Route: "" }, DECLARES],
    ["Kind", { ...AGENT, Kind: "gadget" }, "THE RESOURCE KIND IS ONE OF A CLOSED SET"]];
  for (const [what, row, rule] of cases) {
    const errors = errorsOf(listOf([row]));
    assert.ok(errors.length > 0, `known positive: ${what} left out or wrong is refused`);
    assert.deepEqual([...new Set(errors.map((found) => found.rule))], [rule], what);
  }
});
