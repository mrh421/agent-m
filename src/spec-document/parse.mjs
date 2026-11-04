// The SPEC read in its form (docs/architecture/MOD-spec-document.md, Data): its title, its sections with their byte ranges,
// and its requirements, each with its name, its source and that source's items, its rule, its check and the paths of the
// tests the check names, its section and its line. ITM-214 builds it; index.mjs offers it as parseSpec.
//
// Module: MOD-spec-document
//
// Pure: it reads only the text it is given, keeps nothing, performs no input or output, and never throws on content. What a
// requirement constrains is not read here, since no line of a SPEC states it: it follows from the SPEC the caller read — the
// instance's own SPEC holds the requirements on the development process, a product's SPEC those on the product.

// Headings, outside a fenced code block: one of level one before the first section is the title, one of level two begins a
// section, and any heading ends a requirement.
const TITLE = /^#(?:[ \t]|$)/;
const SECTION = /^##(?:[ \t]|$)/;
const HEADING = /^#{1,6}(?:[ \t]|$)/;
// The line that opens or closes a fenced code block: three or more backticks or tildes, indented by three blanks at most. A
// fence closes with the character it opened with, at least as many times, and nothing after it.
const FENCE = /^ {0,3}(`{3,}|~{3,})(.*)$/;
// A name in bold, without a blank just inside the asterisks — Markdown makes no bold text of `** NAME**`. The name may be empty:
// `****` is the head of a requirement whose name is not written yet.
const BOLD_NAME = "\\*\\*([^*\\s](?:[^*\\n]*[^*\\s])?)?\\*\\*";
// A head line: the name in bold, then the source in italics in parentheses, which runs until `)*`, over further lines if need be.
const HEAD = new RegExp(`^${BOLD_NAME}[ \\t]+\\*\\(`);
const SOURCE_END = ")*";
// A name in bold alone on its line: the head line of a requirement whose source is missing, when its check follows and its name is
// in capitals or empty.
const BARE = new RegExp(`^${BOLD_NAME}[ \\t]*$`);
const BOLD_START = /^\*\*[^*\n]+\*\*/;
const CHECK = /^\*Check:\*[ \t]?/;
// A path the check names: a code span without a blank in it, at the check's start or after ` · `.
const PATH = /^`[ \t]*([^`\s]+)[ \t]*`/;
const PATH_SEPARATOR = /^\s*·\s*/;
// The identifiers of the other kinds of artifact, none of which is a requirement's name.
const OTHER_IDENTIFIER = /^(?:SRC|UC|ARC|MOD|TST|ITM|RES|JOB)-/;

// A name in capitals: a capital letter and no small one.
const inCapitals = (s) => /[A-Z]/.test(s) && !/[a-z]/.test(s);
// A requirement's name: in capitals, and not the identifier of another kind of artifact.
const isName = (s) => inCapitals(s) && !OTHER_IDENTIFIER.test(s);
// The name on a head line that has a source: a requirement's, or a name that is not in capitals, which is read as a requirement
// too so that the findings name it instead of passing over it (the module file, Data). Only the identifier of another kind of
// artifact, which is in capitals, is none.
const namesRequirement = (s) => !inCapitals(s) || isName(s);

const blank = (line) => !line.text.trim();

// The lines of a text: each as { text, start, number, fenced } — its text without its line end (LF, or CR LF), the position in
// the text where it begins, its number from 1, and whether it lies in a fenced code block, the fences included.
function linesOf(text) {
  const out = [];
  let fence = null;
  for (let start = 0, number = 1; start < text.length; number++) {
    const lf = text.indexOf("\n", start);
    const line = text.slice(start, lf < 0 ? text.length : lf).replace(/\r$/, "");
    const f = FENCE.exec(line);
    out.push({ text: line, start, number, fenced: fence !== null || f !== null });
    if (fence === null) {
      if (f) fence = f[1];
    } else if (f && f[1][0] === fence[0] && f[1].length >= fence.length && !f[2].trim()) {
      fence = null;
    }
    start = lf < 0 ? text.length : lf + 1;
  }
  return out;
}

// Whether a `*Check:*` line follows the bare name line at `i` before its requirement could have ended — at an empty line, a
// heading, a fenced line or another line that begins in bold. Bold prose in capitals is followed by none. After an empty line, a
// `*Check:*` line that opens the next paragraph follows too: that is how the editor opens a new requirement — `****`, an empty
// line and `*Check:*`.
function checkFollows(lines, i) {
  if (i + 1 < lines.length && blank(lines[i + 1])) {
    let next = i + 1;
    while (next < lines.length && blank(lines[next])) next++;
    return next < lines.length && !lines[next].fenced && CHECK.test(lines[next].text);
  }
  for (let j = i + 1; j < lines.length; j++) {
    const line = lines[j];
    if (blank(line) || line.fenced || HEADING.test(line.text) || BOLD_START.test(line.text)) return false;
    if (CHECK.test(line.text)) return true;
  }
  return false;
}

// The head of the requirement that begins at line `i`, or null: { name, rest } — `rest` is the head line after its `*(`, or
// null for a head line that names no source.
function headAt(lines, i) {
  const line = lines[i];
  if (line.fenced) return null;
  const head = HEAD.exec(line.text);
  if (head) {
    const name = head[1] ?? "";
    return namesRequirement(name) ? { name, rest: line.text.slice(head[0].length) } : null;
  }
  const bare = BARE.exec(line.text);
  const name = bare ? bare[1] ?? "" : null;
  return name !== null && (name === "" || isName(name)) && checkFollows(lines, i) ? { name, rest: null } : null;
}

// A field from its lines: joined by line feeds and trimmed; null when nothing is left.
function field(texts) {
  const text = texts.join("\n").trim();
  return text ? text : null;
}

// The paths of the tests a check names: the code spans at its start, separated by ` · `. A check at review names none.
function pathsOf(check) {
  const paths = [];
  let rest = check ?? "";
  for (let m = PATH.exec(rest); m; m = PATH.exec(rest)) {
    paths.push(m[1]);
    rest = rest.slice(m[0].length);
    const separator = PATH_SEPARATOR.exec(rest);
    if (!separator) break;
    rest = rest.slice(separator[0].length);
  }
  return paths;
}

// The requirement whose head line is line `i`, standing in the section `section` (its heading line, or null outside every
// section). It ends before an empty line, a heading or the next head line. Its source runs from `*(` to `)*`, over further
// lines if need be but never into its check; a source that is empty, or never closed, is missing. Its rule is every line
// after the source up to `*Check:*`, its check everything from there to the requirement's end.
function requirementAt(lines, heads, i, section) {
  const { name, rest } = heads[i];
  let end = i + 1;
  while (end < lines.length && !blank(lines[end]) && !heads[end]
    && !(HEADING.test(lines[end].text) && !lines[end].fenced)) end++;

  let source = null, body = i + 1, tail = [];
  if (rest !== null) {
    const parts = [rest];
    let k = i;
    while (!parts[parts.length - 1].includes(SOURCE_END) && k + 1 < end && !CHECK.test(lines[k + 1].text)) {
      parts.push(lines[++k].text);
    }
    const last = parts[parts.length - 1], at = last.indexOf(SOURCE_END);
    if (at >= 0) {
      parts[parts.length - 1] = last.slice(0, at);
      source = field(parts);
      tail = [last.slice(at + SOURCE_END.length)];
      body = k + 1;
    }
  }

  const texts = [...tail, ...lines.slice(body, end).map((line) => line.text)];
  const c = texts.findIndex((text) => CHECK.test(text));
  const rule = field(c < 0 ? texts : texts.slice(0, c));
  const check = c < 0 ? null : field([texts[c].replace(CHECK, ""), ...texts.slice(c + 1)]);
  return {
    name,
    source,
    sources: source === null ? [] : source.split(";").map((item) => item.trim()).filter(Boolean),
    rule,
    check,
    checkPaths: pathsOf(check),
    section,
    line: lines[i].number,
  };
}

// parseSpec(text: string) -> Spec — reads a SPEC, or the text of one section of it such as a change queue's proposal. The title
// is the text of the heading of level one before the first section, or "" when there is none. A section runs from its heading
// line up to the next heading of level two, or to the end: `text.slice(start, end)` is its exact text, and `heading` its
// heading line as written, without its line end. A requirement missing its source, rule or check is read with that field
// null, and with `sources` or `checkPaths` empty; so is one whose name is empty (`name` is "") or that is a name alone. Two
// requirements of the same name are both read, and both named in their sections; `requirements` holds the one read last under that
// name, at the place of the first.
export function parseSpec(text) {
  const all = String(text ?? "");
  const lines = linesOf(all);
  const heads = lines.map((_, i) => headAt(lines, i));
  const sections = [];
  const requirements = new Map();
  let title = null;
  lines.forEach((line, i) => {
    if (!line.fenced && SECTION.test(line.text)) {
      if (sections.length) sections[sections.length - 1].end = line.start;
      sections.push({ heading: line.text, line: line.number, start: line.start, end: all.length, requirements: [] });
    } else if (!line.fenced && title === null && !sections.length && TITLE.test(line.text)) {
      title = line.text.replace(TITLE, "").trim();
    }
    if (heads[i]) {
      const section = sections.length ? sections[sections.length - 1] : null;
      const requirement = requirementAt(lines, heads, i, section ? section.heading : null);
      if (section) section.requirements.push(requirement.name);
      requirements.set(requirement.name, requirement);
    }
  });
  return { title: title ?? "", sections, requirements };
}
