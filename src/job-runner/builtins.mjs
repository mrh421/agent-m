// The built-in strategies the runner registers itself (MOD-job-runner, Data: Built-in strategies): the recipes
// `instruction`, `conversation`, `page` and `draft`, the writer `return-draft` and the checks `document-schema`, `requirement-form`,
// `test-declarations`, `candidate-classes`, `group-rules` and `graph-checks`, what a built-in check needs of a job's context,
// and the classes `candidate-classes` finds.
//
// Module: MOD-job-runner

import { artifactSchemaOf, classifyCandidates, documentFindings, readDocument } from "../documents/index.mjs";
import { applyMoves, hierarchy, parseGroupFile } from "../group-document/index.mjs";
import { parseSpec, requirementFindings } from "../spec-document/index.mjs";
import { isTestFile, testDeclarations, testFindings } from "../test-document/index.mjs";
import { finding } from "../text-tools/index.mjs";
import { provenanceLines } from "./provenance.mjs";
import { refusedEdit } from "./tools.mjs";
import { graphFindings, selfSufficiencyFindings, traceGraph } from "../trace-graph/index.mjs";

const part = (name, text) => ({ name, text, size: 0, sources: [], required: true });

// A candidate written as the SPEC writes a requirement — its name and the job's source on the head line, then its rule, then
// its check — for MOD-spec-document to read as it reads one. White space is folded into single blanks: a candidate is one
// block of lines, whatever its rule and its check hold.
// Whether a file holds a test case, by its language's form of one at the start of a line (a comment, or a name that only ends in `test`, is none): JavaScript and TypeScript — `test(`, `it(`,
// `describe(` and their `.only` / `.skip` / `.todo` forms; Python — `def test…(`; Go — `func Test…(`; Rust — `#[test]`; Java and Kotlin — `@Test`. A Markdown file holds a test case where it has a
// `### TST-` heading, which is its declaration, so it never lacks one; a file of another language, or of data, holds none. A fixture or a helper added under `tests/` has nothing to declare.
const TEST_CASE_FORMS = [
  [/\.(?:[cm]?[jt]sx?)$/, /^[ \t]*(?:test|it|describe)(?:\.(?:only|skip|todo))?\(/m],
  [/\.py$/, /^[ \t]*(?:async[ \t]+)?def[ \t]+test\w*\(/m],
  [/\.go$/, /^func[ \t]+Test\w*\(/m],
  [/\.rs$/, /^[ \t]*#\[test\]/m],
  [/\.(?:java|kt)$/, /^[ \t]*@Test\b/m],
];
const holdsTestCase = (path, text) => TEST_CASE_FORMS.some(([name, form]) => name.test(path) && form.test(text));

const folded = (text) => String(text ?? "").replace(/\s+/g, " ").trim();
const written = ({ name, rule, check }, source) =>
  [`**${folded(name)}** *(${source})*`, folded(rule), `*Check:* ${folded(check)}`].filter(Boolean).join("\n");

const EXPECTED_RESULT = "A TEST STATES ITS EXPECTED RESULT BEFORE IT RUNS";
const GOES_BACK = "A DRAFT THAT FAILS A CHECK GOES BACK TO ITS PARTICIPANT";
const EXACT_DUPLICATE = "EXACT DUPLICATES ARE FOUND WITHOUT A MODEL";
const CLASS_NAMES_ARTIFACT = "A CANDIDATE IS NEW, A CHANGE, A DUPLICATE OR A CONFLICT";
// The kind of node, in MOD-trace-graph's graph, that the group file of each kind arranges.
const ARRANGED = { requirements: "requirement", "use-cases": "UC", architecture: "ARC", modules: "MOD", tests: "TST" };

// What the drafts of this check hold: each drafted thing with its reference, the values of its key, the passages it came from and the class its drafter gave, and the kind of artifact it is
// compared with. A requirement of a draft `{ candidates }` is keyed by its name and its rule, and is compared with every artifact a part carries; a document of a draft `{ files }` — read
// with the schema `artifactSchemaOf` names for its path and `readDocument` — by the values of that schema's `key` fields, and an item of a draft `{ items }` by its title, each compared with the
// artifacts of its own kind, by the prefix of their identifier. A file no schema with a key names — a test — has no key and is not classified.
function draftedOf(draft) {
  const drafted = [];
  for (const { name, rule, passage, class: proposed, of } of Array.isArray(draft?.candidates) ? draft.candidates : []) {
    drafted.push({ ref: name, shown: folded(name), keys: [name, rule], from: [passage].filter(Boolean), proposed, of: of ?? null, kind: null, states: "the name or the rule" });
  }
  for (const { path, text, class: proposed, of } of Array.isArray(draft?.files) ? draft.files : []) {
    const schema = typeof path === "string" ? artifactSchemaOf(path) : null;
    if (!schema?.key?.length) continue;
    const document = readDocument(schema, path, String(text ?? ""));
    const keys = schema.key.map((field) => String(document.fields?.[field] ?? ""));
    if (keys.every((value) => folded(value) === "")) continue;
    drafted.push({ ref: path, shown: path, keys, from: [path], proposed, of: of ?? null, kind: schema.identifier.kind, states: `the ${schema.key.join(" and ")}` });
  }
  for (const { title, class: proposed, of } of Array.isArray(draft?.items) ? draft.items : []) {
    if (folded(title) === "") continue;
    drafted.push({ ref: title, shown: folded(title), keys: [title], from: [], proposed, of: of ?? null, kind: "ITM", states: "the title" });
  }
  return drafted;
}

// The classes of a draft against the artifacts the job's parts carry, and the findings on the classes its drafter gave. A candidate that the rule finds a duplicate of an existing artifact while
// its drafter classed it otherwise than as a duplicate of that artifact is an error naming it; so is a change, a duplicate or a conflict that names no artifact a part carries. A draft whose
// parts carry no artifact has nothing to classify.
function classification(draft, parts) {
  const existing = parts.flatMap((part) => part.artifacts ?? []);
  const drafted = draftedOf(draft);
  if (existing.length === 0 || drafted.length === 0) return { classes: [], findings: [] };
  const classes = [], decisions = new Map();
  for (const kind of [...new Set(drafted.map((each) => each.kind))]) {
    const group = drafted.filter((each) => each.kind === kind);
    const known = kind === null ? existing : existing.filter((artifact) => String(artifact.id).startsWith(`${kind}-`));
    const decided = classifyCandidates(group.map(({ ref, keys, from, proposed, of }) => ({ ref, keys, from, proposed: { class: proposed, of } })), known);
    classes.push(...decided);
    for (const each of group) decisions.set(each, decided.find((one) => one.refs.includes(each.ref)));
  }
  const carried = new Set(existing.map((artifact) => artifact.id));
  const findings = drafted.flatMap((each) => {
    const { shown, proposed, of } = each;
    const classed = `${proposed}${of ? ` of "${folded(of)}"` : ""}`;
    const decided = decisions.get(each);
    if (decided.decidedBy === "rule" && !(proposed === "duplicate" && of === decided.of)) {
      return [finding({ artifact: shown, line: 1, kind: "error", rule: EXACT_DUPLICATE,
        what: `"${shown}" states ${each.states} of the existing "${decided.of}" and is classed ${classed}`,
        fix: `class it as duplicate of ${decided.of}` })];
    }
    if (["change", "duplicate", "conflict"].includes(proposed) && !carried.has(of)) {
      return [finding({ artifact: shown, line: 1, kind: "error", rule: CLASS_NAMES_ARTIFACT,
        what: of ? `"${shown}" is classed ${classed}, which no part of the job shows`
          : `"${shown}" is classed ${proposed} and names no existing artifact`,
        fix: "name an existing artifact that a part shows, or class it new" })];
    }
    return [];
  });
  return { classes, findings };
}

// The findings of MOD-trace-graph's two checks across artifacts on a repository: graphFindings, and selfSufficiencyFindings
// against the instance `owner/name`.
async function acrossArtifacts(source, instance) {
  const graph = await traceGraph(source);
  return [...graphFindings(graph), ...selfSufficiencyFindings(graph, instance)];
}

// The findings of `found` that the repository does not hold already: each finding of `held` covers one of `found` that has the
// same artifact, kind, rule and words, wherever it stands, so that a second one with the same words is not covered. The line is
// left out of the comparison, since a draft that changes a file moves its lines.
function notHeld(found, held) {
  const words = (each) => JSON.stringify([each.artifact, each.kind, each.rule, each.what]);
  const covered = new Map();
  for (const each of held) covered.set(words(each), (covered.get(words(each)) ?? 0) + 1);
  return found.filter((each) => {
    const left = covered.get(words(each)) ?? 0;
    if (left > 0) covered.set(words(each), left - 1);
    return left === 0;
  });
}

// The classes of the last round's draft, for a kind that names candidate-classes; null for any other.
export const classesOf = (kind, draft, parts) => (kind.checks.includes("candidate-classes")
  ? classification(draft, parts).classes : null);

export const builtins = {
  recipes: {
    // The person's words, from the job's parameters, as one part.
    instruction: async (context, params) => (typeof params.instruction === "string" && params.instruction.trim()
      ? [part("instruction", params.instruction)] : []),
    // The conversation so far, from the job's parameters, each message with who wrote it, as one part; none for the first message.
    conversation: async (context, params) => (Array.isArray(params.conversation) && params.conversation.length
      ? [part("conversation", params.conversation.map((message) => `${message.who}: ${message.text}`).join("\n\n"))] : []),
    // The page the person sees, as its route's subject gives it in the job's parameters, as one part.
    page: async (context, params) => (typeof params.page === "string" && params.page.trim() ? [part("page", params.page)] : []),
    // The draft the job is handed: the draft under review, for a reviewing kind; the cases as the person left them, for
    // write-tests. None while the job has no draft yet.
    draft: async (context, params) => (params.draft === undefined ? []
      : [part("draft", typeof params.draft === "string" ? params.draft : JSON.stringify(params.draft, null, 2))]),
  },
  checks: {
    // MOD-documents' documentFindings on every drafted document, read with the schema artifactSchemaOf names for its path; a
    // path no schema's pattern matches is not judged here. The drafted documents are the `files` of a draft and the `edits` of a
    // conversation, each { path, text }; a draft with neither has no document and no finding.
    "document-schema": (draft) => [...(draft.files ?? []), ...(draft.edits ?? [])].flatMap(({ path, text }) => {
      const schema = artifactSchemaOf(path);
      return schema ? documentFindings(schema, readDocument(schema, path, text)) : [];
    }),
    // MOD-spec-document's requirementFindings on every drafted requirement: the candidates of a draft written as one section
    // of a SPEC, each with the source the job names (its parameter `source`, as MOD-source-register's source-excerpt reads
    // it), and read by parseSpec. A finding's line is that of its candidate's head line in that text.
    "requirement-form": (draft, context) => {
      const source = folded(context.params.source);
      return requirementFindings(parseSpec(["## Candidates", ...draft.candidates.map((candidate) => written(candidate, source))]
        .join("\n\n")));
    },
    // MOD-test-document's testFindings on every declaration in the files that the branch the coding participant reports adds
    // or changes, and an error for a file the branch adds that isTestFile calls a test file, that holds a test case — told by its language's form of one — and that declares none: an added test, not a file. The branch
    // is read through the product's host with readSnapshot; a file counts as changed when its blob differs from its blob in
    // the product's own snapshot, where a file the branch adds has none. A branch the host does not hold is a finding sent
    // back, since the participant reported a branch it has not pushed; any other failure of the host is thrown.
    "test-declarations": async (draft, context) => {
      const { host, snapshot } = context.product;
      let branch;
      try {
        branch = await host.readSnapshot(draft.branch);
      } catch (error) {
        if (error.name !== "NotFound") throw error;
        return [finding({ artifact: "answer", line: 1, kind: "error", rule: GOES_BACK,
          what: `the branch ${draft.branch} is not on the host`, fix: "push the branch, then report it" })];
      }
      const found = [];
      for (const path of branch.paths) {
        const before = snapshot.blob(path);
        if (branch.blob(path) === before) continue;
        const text = await branch.read(path);
        const declarations = testDeclarations(path, text);
        for (const declaration of declarations) found.push(...testFindings(declaration));
        if (before === null && declarations.length === 0 && isTestFile(path) && holdsTestCase(path, text)) {
          found.push(finding({ artifact: path, line: 1, kind: "error", rule: EXPECTED_RESULT,
            what: "the test file holds a test case and declares no test",
            fix: "declare each test case in comment lines directly before it: its TST-<nnn> identifier, then level:, module:, "
              + "guards:, given:, input: and expect:" }));
        }
      }
      return found;
    },
    // MOD-documents' classifyCandidates of the drafted candidates against the existing artifacts the job's parts carry, which
    // runJob hands to a check as its third argument: the findings of `classification`. The classes of the last round are the
    // result's, which runJob asks of classesOf.
    "candidate-classes": (draft, context, parts = []) => classification(draft, parts).findings,
    // MOD-group-document's applyMoves of the drafted moves on the group file of the kind the job's parameter `kind` names,
    // read from the product's snapshot — a product with none yet has an empty one —: each refused move is an error under A
    // DRAFT THAT FAILS A CHECK GOES BACK TO ITS PARTICIPANT, on the place of the move in the answer; and then the findings
    // `hierarchy` reports for the result against the items of the kind, which the graph of the snapshot holds. No move puts a
    // member in two places or titles a group by an identifier, so those findings are of the file as it stands, and the moves
    // mend them.
    "group-rules": async (draft, context) => {
      const { snapshot } = context.product;
      const path = `docs/groups/${context.params.kind}.md`;
      const moves = Array.isArray(draft?.moves) ? draft.moves : [];
      const { tree, refused } = applyMoves(parseGroupFile(path, (await snapshot.read(path)) ?? ""), moves);
      const items = [...(await traceGraph(snapshot)).nodes.values()]
        .filter((node) => node.kind === ARRANGED[context.params.kind]).map((node) => node.id);
      return [
        ...refused.map(({ move, reason }) => finding({ artifact: "answer", line: moves.indexOf(move) + 1, kind: "error",
          rule: GOES_BACK, what: `the move ${JSON.stringify(move)} is refused: ${reason}`,
          fix: "correct the move, or leave it out" })),
        ...hierarchy(tree, items).findings,
      ];
    },
    // MOD-trace-graph's graphFindings on the product's snapshot with the drafted files put in place of their paths, and its
    // selfSufficiencyFindings there against the instance's repository, the `owner/name` of the context's instance snapshot. The
    // repository holds findings of its own, which the draft did not make and cannot mend, and A DRAFT THAT FAILS A CHECK GOES
    // BACK TO ITS PARTICIPANT with its own findings only: the same two functions run on the snapshot as it stands, and what they
    // find there is left out of what they find with the draft in place (notHeld).
    "graph-checks": async (draft, context) => {
      const { snapshot } = context.product;
      const instance = context.instance.snapshot.repository.path;
      const drafted = new Map((Array.isArray(draft?.files) ? draft.files : []).map(({ path, text }) => [path, text]));
      // A draft that changes no file leaves the graph as it is: nothing it holds is new, and the repository is not read.
      if (drafted.size === 0) return [];
      // The files read in batches, as the snapshot reads them; a drafted file is the draft's.
      const inPlace = { paths: [...new Set([...snapshot.paths, ...drafted.keys()])],
        readMany: async (paths) => snapshot.readMany?.(paths.filter((path) => !drafted.has(path))),
        read: async (path) => (drafted.has(path) ? drafted.get(path) : snapshot.read(path)) };
      return notHeld(await acrossArtifacts(inPlace, instance), await acrossArtifacts(snapshot, instance));
    },
  },
  writers: {
    // Writes nothing; hands the result to the caller.
    "return-draft": async (result) => ({ commits: [], files: [], pullRequest: null, shown: result.draft, notes: [] }),
    // The edits of a conversation's job nobody attends (UC-049 4f): those refusedEdit does not refuse, in one commit on a new branch agent-m/<job> from the commit the
    // job read, and a pull request of it into the default branch — never a commit on the default branch; a refused one named in a note. None: nothing written.
    "proposed-edits": async (result, context) => {
      const edits = Array.isArray(result.draft?.edits) ? result.draft.edits.filter((edit) => typeof edit?.path === "string" && typeof edit?.text === "string") : [];
      const notes = [], files = [];
      for (const { path, text } of edits) {
        const why = refusedEdit(path);
        if (why) notes.push(`${path} is not written: ${why.replace(/^refused: /, "")}`);
        else files.push({ path, text });
      }
      if (files.length === 0) return { commits: [], files: [], pullRequest: null, shown: result.draft, notes };
      const host = context.product.host;
      const lines = provenanceLines({ agentM: context.agentM, jobId: context.jobId, kind: context.kind.name, participant: result.drafter, rounds: result.rounds?.length ?? 0 });
      const branch = `agent-m/${context.jobId ?? "conversation"}`;
      const { commit } = await host.commitFiles({ branch, expectedHead: context.product.snapshot.commit, files,
        message: `propose ${files.map((file) => file.path).join(", ")}\n\n${lines.join("\n")}` });
      const { defaultBranch } = await host.repositoryInfo();
      const opened = await host.openPullRequest({ branch, base: defaultBranch, title: `${context.jobId ?? "conversation"}: ${context.kind.name}`, body: lines.join("\n") });
      return { commits: [commit], files: files.map((file) => file.path), pullRequest: opened.url, shown: result.draft, notes };
    },
  },
};

// What a built-in check needs of a job's context, for prepareJob to ask before the job starts: by the check's name, a function
// of the context and the kind that gives a finding while the context lacks it, else null.
export const needs = new Map([
  ["test-declarations", (context, kind) => (context.product.host ? null : finding({ artifact: context.product.address, line: 1,
    kind: "error", rule: EXPECTED_RESULT,
    what: `the job of ${kind.name} reads the branch the participant reports, and the product has no host to read it from`,
    fix: "connect the product's repository, with a token that can read it" }))],
]);
