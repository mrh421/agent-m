// The checks a schema decides — whether a value fits its value specification (MOD-documents, Data: the value specification,
// its types, and the values that depend on other values), and the findings of documentFindings (Interfaces). writeDocument
// refuses a value that does not fit with DocumentError (ITM-213); documentFindings names it as a finding (ITM-227).
//
// Module: MOD-documents
//
// A value as the reader gives it: a text, a list of texts, or a number. A value is left out when it is absent, or an empty
// text — in a table an empty cell or `—`, in front matter a key with nothing after its colon. An empty list is a value: a
// list that holds nothing, which `nonEmpty` forbids.
//
// documentFindings finds what ITM-227 builds: front matter keys missing, unknown, out of order, required or forbidden by a
// condition; values not of their type or of the variant that holds, or empty where nonEmpty, or a list that names an item
// twice where unique; the rows of a table, cell by cell, in the same way; required sections missing, sections out of order,
// sections the schema forbids, and a document path that matches none of the schema's path patterns; the identifier in the
// front matter against the identifier its path gives; each front matter value that describedIn asks for and its section does
// not describe; and, for a schema that names `diagrams`, every image (DIAGRAMS ARE MERMAID IN MARKDOWN), a Mermaid block
// missing where `diagrams` is `required` — on line 1, under DIAGRAMS ARE MERMAID IN MARKDOWN — and each Mermaid block standing
// where it is `none` — at its opening fence, under the schema's own rule (ITM-1385). A Mermaid block is a fenced block whose
// info string is `mermaid`. For a schema whose `noHistory` is true, each mark of history MOD-text-tools' historyMarks finds
// is an error at its line under A DOCUMENT HOLDS NO HISTORY, in a document and in a record of `key: value` lines alike
// (ITM-1396). The title, the fields of a section, the keys of a record of `key: value` lines and appended sections are not
// checked yet. Each finding is an error, made with MOD-text-tools' finding, and names the rule of
// the part of the schema closest to it (Data, The requirement a finding names). A key or a section that is missing stands on
// no line: its finding names line 1.
// The section under the title (ITM-226) is the first section of a document with a title, and is missing from a document
// without one.

import { finding, formatFrontMatter, historyMarks } from "../text-tools/index.mjs";
import { KIND_FORMS, PATH, REQUIREMENT_NAME, compiledOf, effective, fences, holds, identifierOfPath, matchesPath, pathRule, sectionOf, textLines } from "./schema-language.mjs";

const INTERFACE = /^MOD-[a-z0-9]+(?:-[a-z0-9]+)*\.[A-Za-z_][A-Za-z0-9_]*$/;
const NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;
const HTTPS_ADDRESS = /^https:\/\/[^\s/?#]+(?:[/?#]\S*)?$/;
const IDENTIFIER = Object.fromEntries(Object.entries(KIND_FORMS).map(([kind, form]) => [kind, new RegExp(`^${kind}-${form}$`)]));
const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const ISO_TIME = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(?:Z|[+-](\d{2}):(\d{2}))$/;
const UTC_TIME = /^(\d{4}-\d{2}-\d{2}) (\d{2}):(\d{2}) UTC$/;

// leftOut(value) -> whether a value is left out: absent, or an empty text.
export const leftOut = (value) => value === undefined || value === null || value === "";

// textOf(value) -> the text a condition compares: a text that is not empty, or a number as written; undefined for a value
// left out and for a list.
export const textOf = (value) => (typeof value === "number" ? String(value) : typeof value === "string" && value ? value : undefined);

const shown = (value) => JSON.stringify(value);

function isDate(text) {
  const m = DATE.exec(text);
  if (!m) return false;
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function isTime(text) {
  const iso = ISO_TIME.exec(text);
  if (iso) {
    return isDate(iso[1]) && Number(iso[2]) < 24 && Number(iso[3]) < 60 && (iso[4] === undefined || Number(iso[4]) < 60)
      && (iso[5] === undefined || (Number(iso[5]) < 24 && Number(iso[6]) < 60));
  }
  const utc = UTC_TIME.exec(text);
  return Boolean(utc) && isDate(utc[1]) && Number(utc[2]) < 24 && Number(utc[3]) < 60;
}

// A path in a repository, relative to its root: no leading /, no backslash, no empty segment and no segment `..`.
const isPath = (text) => text === text.trim() && !text.startsWith("/") && !/[\\]/.test(text) && !text.includes("//")
  && !text.split("/").includes("..");

const TYPE_WORDS = {
  text: "a text", number: "a number", date: "a date YYYY-MM-DD", time: "a time", path: "a path", url: "an https address",
  requirement: "a requirement's name", interface: "an interface MOD-<slug>.<name>", name: "an interface's name",
};
const describe = (spec) => (typeof spec === "string" ? TYPE_WORDS[spec] : spec.type === "identifier"
  ? `an identifier ${spec.of.join(" or ")}` : spec.type === "enum" ? `one of ${spec.values.join(", ")}` : TYPE_WORDS[spec.type] ?? spec.type);

// Why one value — not a list — does not fit a type, or null. `where` is where it stands: "front matter" or "record" (a key:
// value line of a record of the shape lines), where an item of a list has a line of its own, "line" (a key: value line of a
// section) or "cell"; `inList` whether it is an item of a list, which a section's line or a cell separates by commas.
function itemProblem(value, spec, where, inList) {
  if (spec.type === "number") return typeof value === "number" && Number.isFinite(value) ? null : `${shown(value)} is not a number`;
  if (typeof value !== "string") return `${shown(value)} is not ${describe(spec)}`;
  if (/[\r\n]/.test(value)) return `${shown(value)} holds a line break`;
  if (inList && where !== "front matter" && where !== "record" && value.includes(",")) {
    return `the item ${shown(value)} holds a comma, which separates the items of a list in a ${where}`;
  }
  switch (spec.type) {
    case "text": return null;
    case "enum": return spec.values.includes(value) ? null : `${shown(value)} is not one of ${spec.values.join(", ")}`;
    case "date": return isDate(value) ? null : `${shown(value)} is not a date YYYY-MM-DD`;
    case "time": return isTime(value) ? null : `${shown(value)} is not a time in ISO 8601 with its offset, or YYYY-MM-DD HH:MM UTC`;
    case "sha": return new RegExp(`^[0-9a-f]{${spec.digits}}$`).test(value) ? null
      : `${shown(value)} is not ${spec.digits} lowercase hexadecimal digits`;
    case "path": return isPath(value) ? null : `${shown(value)} is not a path relative to the repository's root`;
    case "url": return HTTPS_ADDRESS.test(value) ? null : `${shown(value)} is not an https address`;
    case "identifier": return spec.of.some((kind) => IDENTIFIER[kind].test(value)) ? null
      : `${shown(value)} is not an identifier ${spec.of.join(" or ")}`;
    case "requirement": return REQUIREMENT_NAME.test(value) ? null : `${shown(value)} is not a requirement's name in capitals`;
    case "interface": return INTERFACE.test(value) ? null : `${shown(value)} is not an interface MOD-<slug>.<name>`;
    case "name": return NAME.test(value) ? null : `${shown(value)} is not a name [A-Za-z_][A-Za-z0-9_]*`;
    case "either": return spec.of.some((member) => !itemProblem(value, typeof member === "string" ? { type: member } : member,
      where, inList)) ? null : `${shown(value)} is none of ${spec.of.map(describe).join(", ")}`;
    default: return `${shown(value)} is of no type of the language`;
  }
}

// Why a value does not fit the type and constraints of a specification — the variant that holds already chosen —, or null.
function typeProblem(value, spec, where) {
  if (spec.type !== "list") return itemProblem(value, spec, where, false);
  if (!Array.isArray(value)) return `${shown(value)} is not a list`;
  if (spec.nonEmpty && value.length === 0) return "the list is empty, and it holds at least one item";
  for (const item of value) {
    const why = itemProblem(item, spec.item, where, true);
    if (why) return why;
  }
  const twice = spec.unique ? value.find((item, index) => value.indexOf(item) !== index) : undefined;
  if (twice !== undefined) return `the list names ${shown(twice)} twice, and it names each item once`;
  return null;
}

const conditionText = (condition) => (condition.all ? condition.all.map(conditionText).join(" and ")
  : condition.any ? condition.any.map(conditionText).join(" or ")
    : condition.path ? `the document stands at ${condition.path.join(" or ")}`
      : `${condition.field} is ${condition.in ? "" : "not "}${(condition.in ?? condition.notIn).join(" or ")}`);

// valueCheck(value, spec, lookup, where) -> null when a value fits its value specification, else { why, condition }: why it
// does not — left out where it is required, always or where its requiredWhen condition holds; given where its forbiddenWhen
// condition holds; not of the type and constraints of the variant that holds, or of the specification; an empty list where
// nonEmpty —, and the condition that requires or forbids it, or null. lookup(field) gives the text of another value of the
// same document or row, as conditions compare it.
function valueCheck(value, spec, lookup, where) {
  if (leftOut(value)) {
    if (spec.required === true) return { why: "is required, and left out", condition: null };
    if (spec.requiredWhen && holds(spec.requiredWhen, lookup)) {
      return { why: `is required where ${conditionText(spec.requiredWhen)}, and left out`, condition: spec.requiredWhen };
    }
    return null;
  }
  if (spec.forbiddenWhen && holds(spec.forbiddenWhen, lookup)) {
    return { why: `is left out where ${conditionText(spec.forbiddenWhen)}, and it is ${shown(value)}`,
      condition: spec.forbiddenWhen };
  }
  const why = typeProblem(value, effective(spec, lookup), where);
  return why ? { why: `does not fit: ${why}`, condition: null } : null;
}

// valueProblem(value, spec, lookup, where) -> why a value does not fit its value specification, as valueCheck says it, or
// null.
export function valueProblem(value, spec, lookup, where) {
  return valueCheck(value, spec, lookup, where)?.why ?? null;
}

// ---------------------------------------------------------------- documentFindings

// The rule of a condition that holds: of combined conditions, the first part that holds and names one — a part combined in
// turn searched the same way —, before the combination's own.
function conditionRule(condition, lookup) {
  for (const part of condition.all ?? condition.any ?? []) {
    const rule = holds(part, lookup) ? conditionRule(part, lookup) : undefined;
    if (rule) return rule;
  }
  return condition.rule;
}

// The rules of the parts of the schema closest to a value that does not fit, closest first: the condition that requires or
// forbids it, the variant that holds for it, its value specification.
const valueRules = (check, spec, lookup) => [check.condition && conditionRule(check.condition, lookup),
  (spec.variants ?? []).find((variant) => holds(variant.when, lookup))?.rule, spec.rule];

// What a finding on a value asks for — the value left out, given where it is forbidden, or not fitting —, where it stands:
// under a key of the front matter, or in a column of a row.
const FIX = {
  key: { missing: (key) => `give the key ${key} a value`, forbidden: (key) => `remove the key ${key}`,
    misfit: (key) => `correct the value of the key ${key}` },
  cell: { missing: (column) => `fill in the column ${column} of this row`,
    forbidden: (column) => `leave the column ${column} of this row empty`,
    misfit: (column) => `correct the column ${column} of this row` },
};
const fixOf = (words, name, value, check) => (leftOut(value) ? words.missing(name)
  : check.condition ? words.forbidden(name) : words.misfit(name));

// The line of each front matter key that stands, counted as the front matter is written: the line --- first, then each key
// on a line of its own, and each item of a list on one more. A Document keeps no line of a key; a line its reader passed
// over among the keys is not counted.
function keyLines(fields, keys) {
  const lines = {};
  let line = 2;
  for (const key of keys) {
    lines[key] = line;
    line += 1 + (Array.isArray(fields[key]) ? fields[key].length : 0);
  }
  return lines;
}

const levelOf = (heading) => /^#*/.exec(heading)[0].length;

// describedIn: the values a section describes — the names that begin its bullets, each `- ` followed by the value in backticks,
// as a module's ## Interfaces describes the interfaces it provides (`- `name(…) -> …` — …`). A value is described when a bullet
// begins with it in backticks, followed by the end of the backticks or by a character that cannot continue a name.
function describes(sectionText, value) {
  const { inBlock } = fences(textLines(sectionText ?? ""));
  return textLines(sectionText ?? "").some((line, index) => !inBlock[index] && line.startsWith(`- \`${value}`)
    && !/^[A-Za-z0-9_.-]/.test(line.slice(3 + value.length)));
}

// The section under the title, as findings name it: it has no heading of its own in the schema.
const UNDER_TITLE = "the section under the title";

/**
 * documentFindings(schema: Schema, document: Document) -> Finding[] — the findings the schema decides on a document read by
 * it (see the head of this file), in the order of their lines; on one line, in the order they are found: the keys of the
 * front matter, then their values, then the sections, each row's cells in the order of its columns. Each is an
 * error naming the document's identifier, or its path when it has none, the line it concerns and the rule of the part of the
 * schema closest to it: a condition's — of combined conditions, the first part that holds and names one, before the
 * combination's own —, the variant's that holds, the value specification's, the section's, and last the schema's own,
 * which alone a key the schema does not list, keys out of order and a section the schema forbids name. Throws TypeError when
 * `schema` is not a loaded schema, and, through MOD-text-tools' finding, for a finding no part of the schema names a rule
 * for.
 */
// The cells of a table's line, split at every | that is not escaped (read-write.mjs reads a section's table with it as well).
export function cellsOf(line) {
  let text = line.trim();
  if (text.startsWith("|")) text = text.slice(1);
  if (text.endsWith("|") && !text.endsWith("\\|")) text = text.slice(0, -1);
  return text.split(/(?<!\\)\|/).map((cell) => cell.trim().replace(/\\\|/g, "|"));
}

// The columns of a table that a header row names — the table's columns in their order, each column marked optional that the header leaves out left out —, or null where the header is not the table's:
// it names a column the table does not, names them in another order, or leaves out a column that is not optional.
export function headerColumns(table, header) {
  const named = [];
  let at = 0;
  for (const column of table.columns) {
    if (header[at] === column.name) { named.push(column); at += 1; }
    else if (!column.optional) return null;
  }
  return at === header.length ? named : null;
}

export const isSeparator = (line) => cellsOf(line).every((cell) => /^:?-+:?$/.test(cell));

// The section's table among a text's lines: { from, to, columns }, to exclusive, `columns` the columns its header names, or null — the first table whose header row names the table's columns, in their
// order, an optional column named or left out; for a table without a header row, the first table.
export function sectionTable(table, lines) {
  const { inBlock } = fences(lines);
  const isRow = (i) => !inBlock[i] && /^[ \t]*\|/.test(lines[i]);
  let from = 0;
  while (from < lines.length) {
    if (!isRow(from)) { from += 1; continue; }
    let to = from;
    while (to < lines.length && isRow(to)) to += 1;
    const columns = table.header === false ? table.columns : headerColumns(table, cellsOf(lines[from]));
    if (columns) return { from, to, columns };
    from = to;
  }
  return null;
}

// The rows of a section's table that have cells beyond the columns its header names — { index, cells } of each, the index among the section's lines — when a beyond cell holds something (an empty cell, or the dash
// of a value left out, holds nothing and loses nothing). The section's table is found as the reader finds it; none found, none named.
function overlongRows(table, lines) {
  const at = sectionTable(table, lines);
  if (!at) return [];
  let from = at.from;
  if (table.header !== false) {
    from += 1;
    if (from < at.to && isSeparator(lines[from])) from += 1;
  }
  const found = [];
  for (let i = from; i < at.to; i += 1) {
    const cells = cellsOf(lines[i]);
    if (cells.length > at.columns.length && cells.slice(at.columns.length).some((cell) => cell !== "" && cell !== "—")) found.push({ index: i, cells });
  }
  return found;
}

// The first table of a section's lines when the section holds a table and none of its tables has a header row that names the table's columns, in their order (an optional column named or left out) — the section's table is then found
// nowhere and its rows are not read: { index, header } of that first table's header row; { columns } — the columns the header names — where a table names the columns; null where the section holds no table.
function unreadTable(table, lines) {
  const { inBlock } = fences(lines);
  const isRow = (i) => !inBlock[i] && /^[ \t]*\|/.test(lines[i]);
  const names = table.columns.map((column) => column.name);
  let first = null, from = 0;
  while (from < lines.length) {
    if (!isRow(from)) { from += 1; continue; }
    const header = cellsOf(lines[from]);
    const named = headerColumns(table, header);
    if (named !== null) return { columns: named };
    first ??= { index: from, header };
    while (from < lines.length && isRow(from)) from += 1;
  }
  return first;
}

// The line on which a document's body begins, counted as its front matter is written (keyLines): line 1 without front matter,
// else the line after the closing --- that follows the last key and its items.
function bodyLine(fields) {
  const standing = Object.keys(fields).filter((key) => fields[key] !== undefined);
  if (!standing.length) return 1;
  const last = standing.at(-1);
  return keyLines(fields, standing)[last] + 1 + (Array.isArray(fields[last]) ? fields[last].length : 0) + 1;
}

// DIAGRAMS ARE MERMAID IN MARKDOWN: an image is a Markdown image, or an HTML <img>, whose address — without its query and its
// fragment — names a file of an image type; one written inside a fenced block is an example, and no image of the document.
const DIAGRAMS = "DIAGRAMS ARE MERMAID IN MARKDOWN";
const MARKDOWN_IMAGE = /!\[[^\]]*\]\(\s*<?([^\s)>]+)/g;
const HTML_IMAGE = /<img\b[^>]*?\bsrc\s*=\s*["']?([^"'\s>]+)/gi;
const IMAGE_FILE = /\.(?:png|jpe?g|gif|svg|webp|bmp|tiff?)$/i;

// The images of a body's lines, each { address, index } — the address as written, the index of its line —, in the order of
// the text.
function images(lines) {
  const { inBlock } = fences(lines);
  const found = [];
  lines.forEach((line, index) => {
    if (inBlock[index]) return;
    const onLine = [MARKDOWN_IMAGE, HTML_IMAGE].flatMap((re) => [...line.matchAll(re)])
      .filter((m) => IMAGE_FILE.test(m[1].replace(/[?#].*$/, ""))).sort((a, b) => a.index - b.index);
    for (const m of onLine) found.push({ address: m[1], index });
  });
  return found;
}

// A DOCUMENT HOLDS NO HISTORY: the text a document was read from, as far as a Document keeps it, with its lines where they
// stood — for a record of key: value lines its body, which is its whole text; for a document its front matter written as
// keyLines counts it, then its body. historyMarks counts its lines from 1 in that text. A value that holds a line break,
// which a form may give and which has its own finding, stands on its key's line with a blank in place of the break.
const NO_HISTORY = "A DOCUMENT HOLDS NO HISTORY";
const oneLine = (value) => String(value).replace(/[\r\n]+/g, " ");
function historyText(schema, document) {
  if (schema.shape === "lines") return document.body ?? "";
  const fields = document.fields ?? {};
  const standing = Object.keys(fields).filter((key) => fields[key] !== undefined);
  const texts = Object.fromEntries(standing.map((key) => [key, Array.isArray(fields[key]) ? fields[key].map(oneLine) : oneLine(fields[key])]));
  return formatFrontMatter(texts, standing, document.body ?? "");
}

export function documentFindings(schema, document) {
  const compiled = compiledOf(schema);
  const artifact = document.id ?? document.path;
  const found = [];
  const add = (line, rules, what, fix) => found.push(finding({ artifact, line, kind: "error",
    rule: [...rules, pathRule(compiled, document.path) ?? schema.rule].find(Boolean), what, fix }));
  const fields = document.fields;
  const frontLookup = (name) => (name === PATH ? document.path : textOf(fields[name]));

  if (compiled.patterns.length && !matchesPath(compiled, document.path)) {
    add(1, [], `the path ${document.path} does not match a path of the format ${schema.schema}`,
      `move the document to a path the format ${schema.schema} names`);
  }

  if (schema.shape === "document") {
    const specs = schema.frontMatter ?? {};
    const keys = Object.keys(specs);
    const standing = Object.keys(fields).filter((key) => fields[key] !== undefined);
    const lineOf = keyLines(fields, standing);
    let lastKey = null; // the listed key that stands furthest along the format's order so far
    for (const key of standing) {
      if (!Object.hasOwn(specs, key)) {
        add(lineOf[key], [], `the key ${key} is not a key of the format ${schema.schema}`,
          `remove the key ${key}, or use one the format lists: ${keys.join(", ")}`);
      } else if (lastKey !== null && keys.indexOf(key) < keys.indexOf(lastKey)) {
        add(lineOf[key], [], `the key ${key} stands after the key ${lastKey}, which the format ${schema.schema} puts after it`,
          `put the keys in the order of the format: ${keys.join(", ")}`);
      } else {
        lastKey = key;
      }
    }
    for (const [key, spec] of Object.entries(specs)) {
      const check = valueCheck(fields[key], spec, frontLookup, "front matter");
      if (check) {
        add(lineOf[key] ?? 1, valueRules(check, spec, frontLookup), `the key ${key} ${check.why}`,
          fixOf(FIX.key, key, fields[key], check));
      }
    }
    // The identifier against the one its path gives: a finding on the value of the identifier's key, where that value is an
    // identifier at all — one that does not fit its type has its finding above.
    const idKey = schema.identifier?.field;
    const own = idKey ? fields[idKey] : undefined, given = idKey ? identifierOfPath(compiled, document.path) : null;
    if (typeof own === "string" && own && given !== null && own !== given && !valueCheck(own, specs[idKey] ?? {}, frontLookup, "front matter")) {
      add(lineOf[idKey] ?? 1, valueRules({ condition: null }, specs[idKey] ?? {}, frontLookup),
        `the key ${idKey} is ${own}, and the identifier its path gives is ${given}`,
        `write ${idKey}: ${given}, or move the document to the path of ${own}`);
    }
    // describedIn: each value the key holds is described by a bullet of the section it names.
    for (const [key, spec] of Object.entries(specs)) {
      if (!spec.describedIn || leftOut(fields[key])) continue;
      const section = document.sections.find((each) => each.heading === spec.describedIn);
      for (const value of Array.isArray(fields[key]) ? fields[key] : [fields[key]]) {
        if (typeof value !== "string" || !value || describes(section?.text, value)) continue;
        add(lineOf[key] ?? 1, valueRules({ condition: null }, spec, frontLookup),
          `the key ${key} names ${value}, which ${spec.describedIn} does not describe`,
          `add to ${spec.describedIn} a bullet that begins with \`${value}\`, or remove ${value} from ${key}`);
      }
    }
  }

  if (schema.diagrams !== undefined) {
    const lines = textLines(document.body ?? "");
    const first = bodyLine(fields);
    for (const { address, index } of images(lines)) {
      add(first + index, [DIAGRAMS], `the image ${address} stands where a diagram is written as a \`\`\`mermaid block`,
        "replace the image by the same diagram as a fenced ```mermaid block in this document");
    }
    const mermaid = fences(lines).blocks.filter((block) => block.info === "mermaid");
    if (schema.diagrams === "required" && !mermaid.length) {
      add(1, [DIAGRAMS], `the document holds no diagram, which the format ${schema.schema} requires as a \`\`\`mermaid block`,
        "add the diagram as a fenced ```mermaid block in this document");
    }
    for (const block of schema.diagrams === "none" ? mermaid : []) {
      add(first + block.from, [], `a \`\`\`mermaid block stands where the format ${schema.schema} holds no diagram`,
        "remove the ```mermaid block");
    }
  }

  if (schema.noHistory === true) {
    for (const mark of historyMarks(historyText(schema, document))) {
      add(mark.line, [NO_HISTORY], `the document holds a mark of history (${mark.kind}): "${mark.text}"`,
        "remove it; the version history keeps what was changed, when and by whom");
    }
  }

  const headings = (schema.sections ?? []).map((spec) => (spec.underTitle ? UNDER_TITLE : spec.heading));
  let lastSection = null; // the named section that stands furthest along the format's order so far
  for (const [place, section] of document.sections.entries()) {
    const named = sectionOf(compiled, section, place, document.title);
    if (!named) {
      if (schema.otherSections === "forbidden" && levelOf(section.heading) === compiled.level) {
        add(section.line, [], `the section ${section.heading} is not a section of the format ${schema.schema}, which allows no other`,
          `remove the section ${section.heading}, or move its text into a section the format names: ${headings.join(", ")}`);
      }
      continue;
    }
    if (lastSection !== null && named.index < lastSection.index) {
      const what = `the section ${section.heading} stands after the section ${lastSection.spec.heading}, which the format `
        + `${schema.schema} puts after it`;
      add(section.line, [named.spec.rule], what, `put the sections in the order of the format: ${headings.join(", ")}`);
    } else {
      lastSection = named;
    }
    const table = named.spec.table;
    const unread = table && table.header !== false ? unreadTable(table, textLines(section.text ?? "")) : null;
    if (unread?.header) {
      const names = table.columns.map((column) => column.name);
      const added = unread.header.filter((cell) => !names.includes(cell)), lacks = table.columns.filter((column) => !column.optional && !unread.header.includes(column.name)).map((column) => column.name);
      const says = [...(added.length ? [`adds ${added.join(", ")}`] : []), ...(lacks.length ? [`lacks ${lacks.join(", ")}`] : []),
        ...(!added.length && !lacks.length ? ["puts the columns out of order"] : [])].join("; ");
      add(section.line + 1 + unread.index, [named.spec.rule], `the header of the table under ${section.heading} names ${unread.header.join(", ")}, where the format ${schema.schema} names ${names.join(", ")} in that order: it ${says}, so no row of the table is read`,
        `make the header row name ${table.columns.some((column) => column.optional) ? "the columns" : "exactly the columns"} ${names.join(", ")}, in that order${table.columns.some((column) => column.optional)
          ? `, of which ${table.columns.filter((column) => column.optional).map((column) => column.name).join(", ")} may be left out` : ""}`);
    }
    for (const { index, cells } of table ? overlongRows(table, textLines(section.text ?? "")) : []) {
      const beyond = cells.slice(table.columns.length);
      add(section.line + 1 + index, [named.spec.rule], `the row has ${cells.length} cells where the table under ${section.heading} has ${table.columns.length} columns: the ${beyond.length === 1 ? "cell" : "cells"} beyond the last column, ${table.columns.at(-1).name}, ${beyond.length === 1 ? "is" : "are"} ${beyond.map((cell) => `“${cell}”`).join(", ")}, and no column reads ${beyond.length === 1 ? "it" : "them"}`,
        `remove the ${beyond.length === 1 ? "cell" : "cells"}, or add the column to the table's header and to the format ${schema.schema}`);
    }
    for (const row of table ? section.rows ?? [] : []) {
      const names = table.columns.map((column) => column.name);
      const lookup = (name) => (names.includes(name) ? textOf(row.cells[name]) : frontLookup(name));
      for (const column of table.columns) {
        if (unread?.columns && !unread.columns.includes(column)) continue;
        const check = valueCheck(row.cells[column.name], column.value, lookup, "cell");
        if (check) {
          add(row.line, [...valueRules(check, column.value, lookup), named.spec.rule], `the column ${column.name} ${check.why}`,
            fixOf(FIX.cell, column.name, row.cells[column.name], check));
        }
      }
    }
  }
  for (const spec of schema.sections ?? []) {
    const stands = document.sections.some((section, place) => sectionOf(compiled, section, place, document.title)?.spec === spec);
    if (!spec.required || stands) continue;
    if (spec.underTitle) {
      add(1, [spec.rule], `${UNDER_TITLE} is required, and missing`, "add the document's title, and the section under it");
    } else {
      add(1, [spec.rule], `the section ${spec.heading} is required, and missing`, `add the section ${spec.heading}`);
    }
  }
  return found.sort((a, b) => a.line - b.line);
}
