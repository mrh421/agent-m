// The form built from a schema (MOD-site-frame, Parts: forms.mjs; Interfaces: schemaForm), over a document of the common
// shape as MOD-documents reads it.
//
// Module: MOD-site-frame
//
// One field per key of the schema's front matter, holding the key's value as one line of text — a list's items separated by
// commas, as MOD-documents writes a list on one line —, and one per section the schema names by its heading, whose text is
// edited in MOD-markdown-render's editor. The document the form hands over is the one it was given, with the person's edits:
// the keys in the schema's order, a key whose field is left empty left out — a value of front matter is its text, trimmed;
// that of a key the schema types as a list is the list of the parts of its text between commas, each trimmed, an empty
// part left out —; a section that did not stand joins once its field holds text, in its
// place in the schema's order; a section the person edited holds the text typed, ending in a line end so that the heading
// after it keeps a line of its own. Every other part — the sections the schema does not name, the title, the body the
// document was read from, the rows of every section not edited — is handed over as it was given.
//
// Each section stands on the line it would have in the file written from the document, its rows with it, so that every
// finding of documentFindings and of the caller's extraChecks falls on the line of one field: a finding on the line of a
// key is shown beside the key's field, one on a section's heading line beside the section's field, and one on a line of
// a section's text beside that line in its editor — a mark, counted from the editor's first line. A finding is placed by
// its line alone; no wording of it is read. documentFindings checks the document with each key of the schema whose field
// is empty standing with an empty value, which MOD-documents counts as left out, so that a finding on a key the document
// lacks falls on that key's own line and is shown beside its field; extraChecks, like onSave, is given the document with
// such a key left out. A finding on the line of no field — a section the document lacks, a key the schema does not know —
// is shown at the end of the form. An editor asks for its marks on each edit of its own text; the rest of the form is
// shown again on every edit.
//
// Not built, since no caller needs them: the options secretKeys and readOnly; a key whose value is a number, which a field
// shows as text and hands over as the text typed; the section under a document's title.
// The editor of a section brings a Save of its own; it hands nothing over, since the form's one Save does.

import { documentFindings, readDocument } from "../documents/index.mjs";
import { openEditor } from "../markdown-render/index.mjs";

// What the Save of a section's editor answers.
const SAVED_WITH_THE_FORM = { kind: "failed",
  reason: "a section is saved with its form — Save at the end of the form hands over the whole document" };

// The number of line ends in a text.
const lineEnds = (text) => text.split("\n").length - 1;

// The lines front matter takes as it is written: the line ---, each key on a line of its own and each item of a list on
// one more, the line ---; none without a key.
function frontLines(fields) {
  const values = Object.values(fields).filter((value) => value !== undefined);
  return values.length && 2 + values.reduce((lines, value) => lines + 1 + (Array.isArray(value) ? value.length : 0), 0);
}

// An element with its class and its children.
function element(name, className, ...children) {
  const made = document.createElement(name);
  if (className) made.className = className;
  made.append(...children);
  return made;
}

// A finding as it is shown beside its field: its kind, what is wrong, the correction expected, and the requirement.
const shown = (finding) => element("li", finding.kind,
  `${finding.kind}: ${finding.what} — ${finding.fix} [${finding.rule}]`);

/**
 * schemaForm(schema: Schema, document: Document | null, options: { onSave: (document: Document) -> Promise<void>,
 * extraChecks?: (document: Document) -> Finding[] }) -> Element — a form with one field per key and per section of a
 * schema of MOD-documents, a section edited in MOD-markdown-render's editor; the findings of documentFindings and of
 * extraChecks shown beside their fields while typing; Save offered only while no error remains, and on a person's click
 * handing the document over to onSave, once. It writes nothing itself. Once the caller has put the form into the page, in
 * the turn in which it was built, the focus is in its first field (A FORM OPENS WITH ITS FIRST FIELD FOCUSED).
 * @param {Schema} schema — a schema MOD-documents' loadSchema returned
 * @param {Document | null} opened — the document as MOD-documents' readDocument read it, or null for a new one
 * @returns {Element}
 */
export function schemaForm(schema, opened, { onSave, extraChecks = () => [] }) {
  const given = opened ?? { kind: schema.schema, path: schema.path, id: null, title: null, fields: {}, sections: [],
    appended: [], body: "" };
  const keys = Object.keys(schema.frontMatter ?? {});
  // A section under the title has no heading of its own: the document's title line stands for it.
  const headings = (schema.sections ?? []).map((spec) => (spec.underTitle ? given.sections[0]?.heading : spec.heading)).filter((heading) => heading !== undefined);
  const values = { ...given.fields }; // each key as its field holds it, undefined where the field is left empty
  const edits = new Map(); // the text of each section the person changed, by its heading
  // The lines between the front matter and the first section, the title among them, as the document given holds them.
  const lead = given.sections.length ? given.sections[0].line - frontLines(given.fields) - 1 : lineEnds(given.body);

  // A section the person edited: the text typed and, where the schema names a table for it, the rows of that table read again from the text typed — as MOD-documents reads a file —, so that the checks see them; each
  // row on the line it has below the section's heading at `line`.
  function editedSection(heading, line, text) {
    const read = readDocument(schema, given.path ?? schema.path, `${heading}\n${text}`).sections.find((section) => section.heading === heading);
    return read?.rows ? { heading, line, text, rows: read.rows.map((row) => ({ ...row, line: row.line - read.line + line })) } : { heading, line, text };
  }

  // Where the document stands: a new one — given without the identifier its schema names — at the path its identifier puts it
  // once the person has typed one, the file Save writes; any other where it was given.
  const idKey = schema.identifier?.field;
  const isNew = typeof idKey === "string" && given.fields?.[idKey] === undefined && typeof given.id === "string" && given.id !== ""
    && typeof given.path === "string" && given.path.includes(given.id);
  const pathOf = (fields) => (isNew && typeof fields[idKey] === "string" && fields[idKey] ? given.path.replace(given.id, fields[idKey]) : given.path);

  // The document as the person has left the form; with `standing`, each key of the schema whose field is empty stands with
  // an empty value, on a line of its own, as the document documentFindings checks.
  function documentNow(standing = false) {
    const fields = {};
    for (const key of [...keys, ...Object.keys(given.fields)]) {
      if (values[key] !== undefined) fields[key] = values[key];
      else if (standing && keys.includes(key)) fields[key] = "";
    }
    const sections = given.sections.map((section) => (edits.has(section.heading) ? editedSection(section.heading, section.line, edits.get(section.heading)) : section));
    for (const [heading, text] of edits) {
      if (sections.some((section) => section.heading === heading)) continue;
      const later = sections.findIndex((section) => headings.indexOf(section.heading) > headings.indexOf(heading));
      sections.splice(later < 0 ? sections.length : later, 0, editedSection(heading, 0, text));
    }
    let line = frontLines(fields) + 1 + lead;
    return { ...given, path: pathOf(fields), fields, sections: sections.map((section) => {
      const at = line;
      line += 1 + lineEnds(section.text);
      if (at === section.line) return section;
      const moved = { ...section, line: at };
      if (section.rows) moved.rows = section.rows.map((row) => ({ ...row, line: row.line + at - section.line }));
      return moved;
    }) };
  }

  // Every finding of the document as the person has left the form, each where it is shown: beside a field, as a mark of a
  // section's editor, or at the end of the form.
  function placed() {
    const now = documentNow(), checked = documentNow(true);
    const beside = new Map([...keys, ...headings].map((name) => [name, []]));
    const marks = new Map(headings.map((heading) => [heading, []]));
    const end = [];
    // Each finding of a document placed by its line, as that document's keys and sections stand.
    function place(doc, findings) {
      const keyAt = new Map();
      let line = 2;
      for (const [key, value] of Object.entries(doc.fields)) {
        keyAt.set(line, key);
        line += 1 + (Array.isArray(value) ? value.length : 0);
      }
      for (const finding of findings) {
        const key = keyAt.get(finding.line);
        const section = doc.sections.findLast((candidate) => candidate.line <= finding.line);
        if (beside.has(key)) beside.get(key).push(finding);
        else if (marks.has(section?.heading) && finding.line > section.line) {
          marks.get(section.heading).push({ ...finding, line: finding.line - section.line });
        } else if (beside.has(section?.heading)) beside.get(section.heading).push(finding);
        else end.push(finding);
      }
      return findings;
    }
    const found = [...place(checked, documentFindings(schema, checked)), ...place(now, extraChecks(now))];
    return { found, beside, marks, end };
  }

  const lists = new Map(); // the list of findings beside each field, by its key or its heading
  const endList = element("ul", "findings");
  const save = element("button", "btn", "Save");
  save.setAttribute("type", "button");

  // The findings shown again where they fall, and Save offered only while no error remains.
  function show() {
    const now = placed();
    for (const [name, list] of lists) list.replaceChildren(...now.beside.get(name).map(shown));
    endList.replaceChildren(...now.end.map(shown));
    save.disabled = now.found.some((finding) => finding.kind === "error");
    return now;
  }

  const form = element("div", "schema-form");
  for (const key of keys) {
    const input = element("input");
    const isList = schema.frontMatter[key].type === "list";
    input.value = Array.isArray(values[key]) ? values[key].join(", ") : String(values[key] ?? "");
    input.addEventListener("input", () => {
      const typed = input.value.trim();
      const items = typed.split(",").map((part) => part.trim()).filter(Boolean);
      values[key] = isList ? (items.length ? items : undefined) : typed || undefined;
      show();
    });
    const list = element("ul", "findings");
    lists.set(key, list);
    const field = element("div", "field", element("label", null, key, input), list);
    field.setAttribute("data-key", key);
    form.append(field);
  }
  const targets = new Map();
  for (const heading of headings) {
    const list = element("ul", "findings"), target = element("div", "section");
    lists.set(heading, list);
    targets.set(heading, target);
    const field = element("div", "field", element("p", "label", heading.replace(/^#+[ \t]*/, "")), target, list);
    field.setAttribute("data-section", heading);
    form.append(field);
  }
  form.append(endList, element("p", null, save));

  for (const [heading, target] of targets) {
    const initial = given.sections.find((section) => section.heading === heading)?.text ?? "";
    openEditor(target, initial, {
      marks: (text) => {
        if (text === initial) edits.delete(heading);
        else edits.set(heading, text === "" || text.endsWith("\n") ? text : `${text}\n`);
        return show().marks.get(heading);
      },
      save: async () => SAVED_WITH_THE_FORM,
    });
  }
  show();

  // Answers only a click the browser marks as a person's (THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK).
  save.addEventListener("click", async (event) => {
    if (event?.isTrusted !== true || save.disabled) return;
    save.disabled = true;
    try {
      await onSave(documentNow());
    } finally {
      show();
    }
  });
  queueMicrotask(() => (form.getElementsByTagName("input")[0] ?? form.getElementsByTagName("textarea")[0])?.focus());
  return form;
}
