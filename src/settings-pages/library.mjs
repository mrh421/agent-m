// MOD-settings-pages' routes `library` and `library/<source>` (UC-004 steps 1 to 6): the instance's register of sources with their versions, and + Register source by
// route — an EU legal text, a standard, documents, a repository —, the common fields in a form from the entry's schema, what becomes public stated before Save, and Save,
// which commits the plan MOD-source-register's registrationCommits gives, each file in its repository. The entry of a source (`library/<source>`) has + New version, which commits the
// plan versionCommits gives, and the products this browser keeps that still link an earlier version, each with Move (UC-016 steps 1 and 3 to 5). The download of an EU legal text after
// saving is not part of this page. For a product, a button leads back to its Requirement sources (the route `sources`, UC-015 2a).
//
// Module: MOD-settings-pages
//
// Where the texts leave a reading open, this file states the one it takes:
//   - + New version of a fetched EU legal text (an entry the page reads as one, with a version) starts the fetch run for the entry (startWorkflow with the input \`source\`) and offers no file; every other source:
//     + New version records files: a version's identifier and date, and the files hashed in the browser, as the registration of documents does; a file only hashed asks for its note. What
//     versionCommits refuses (SameBytes, NoteMissing) is shown as the module words it; the page adds no check of its own. A fetched EU legal text is given its versions by the fetch.
//   - A source whose `identifier` is a repository's address (and no EU legal text's) is a source of kind repository: its + New version offers no files and, when saved, reads the commit the
//     repository's default branch stands at now, as the registration of a repository does, and records it (versionCommits' `version.commit`); the same commit as an existing version is refused as SameBytes.
//   - The products on older versions are the products this browser keeps (the setting `products`), each read through its own host: the product's `docs/sources.md` is read once, when the
//     entry is opened. A product is on an older version when its link names a version of an earlier row of the entry's `## Versions` than the last, the newest.
//   - Move lists the requirements affectedRequirements names, read from the product's SPEC.md at the commit the links file was read at, and the passages of the two versions: for each file
//     name, changedPassages of the texts readContent reads. Passages are listed only when every file of both versions is stored; otherwise the page says which is not.
//   - Move writes the link through sources.mjs (movedRows, saveLinks); the commit's message ends with a line for the move and one for each requirement listed (saveFile's trailers).
//   - The routes preset the kind: an EU legal text `regulation`, a standard `standard`, documents `document`, a repository `system` (the closed set of kinds names no
//     `repository`); the person may change it in the form.
//   - The first version's identifier is the day of registration for documents and a repository, the designation for a standard; the Versions section is the person's to edit.
//   - An EU legal text is registered as its entry alone, with no version row: the later download (UC-004 7) records the version, and registrationCommits needs a first row.
//   - The content goes to its repository before the entry goes to the instance, so that an entry never names content that was not stored.
//   - A source is already in the library when its identifier, its title or, for a standard, its designation equals an entry's (as a requirement's source item names one).
//   - The form is MOD-site-frame's schemaForm over the entry's schema: the page's own checks (an unlinked or restricted source, a missing file or
//     pin, a source already in the library) are its extraChecks; the checks of the schema are documentFindings'.
//   - A choice outside the form (the route's own part, the files, the named repository) builds the form again, keeping what the person typed in it.
//   - The file of an entry's version is shown as stored or not as MOD-source-register's linkedVersion reads its note (`not stored:`), with the SHA-256 linkedVersion reads for it.

import { connect, parseAddress } from "../repository-hosts/index.mjs";
import { readSetting, secretValues } from "../browser-store/index.mjs";
import { readDocument, writeDocument } from "../documents/index.mjs";
import { affectedRequirements, changedPassages, linkedVersion, permittedPlaces, readContent, recogniseLegalText, registrationCommits, sourceSchemas, versionCommits }
  from "../source-register/index.mjs";
import { explain, schemaForm } from "../site-frame/index.mjs";
import { finding, sha256 } from "../text-tools/index.mjs";
import { credentialsFor } from "./products.mjs";
import { linkRow, linksText, movedRows, openLinks, saveLinks } from "./sources.mjs";
import { heads } from "./routes.mjs";

const { entry: ENTRY, links: LINKS } = sourceSchemas();
const REGISTER_PATH = /^docs\/sources\/SRC-[^/]+\.md$/;
const FETCH_WORKFLOW = "fetch-sources.yml";
const KIND_OF = { "legal-text": "regulation", standard: "standard", documents: "document", repository: "system" };
const ROUTES = {
  "legal-text": "An EU legal text — paste its EUR-Lex or ELI address, for example the AI Act's.",
  standard: "A standard — enter its full designation, for example IEC 62304:2006+AMD1:2015.",
  documents: "Documents — PDF, Word or Markdown files, or a zip file containing them, for example a customer's requirements specification.",
  repository: "A repository — the address of a repository, public or private, on GitHub or GitLab, for example https://github.com/owner/guidelines.",
};
const REPUBLISHABLE = /^may be republished(?![\p{L}\p{N}_])/u;

// An entry's title line, the pattern of the entry's schema (`# {id} {title}`) filled from its fields, a field left out leaving its place empty.
const titleLineOf = (fields) => ENTRY.title.replace(/\{(\w+)\}/g, (_, key) => fields[key] ?? "").trimEnd();
// The document with its title line made from its fields: the form hands over the body the page drafted, whose title line holds the id and title as they stood then.
function titled(document) {
  const lines = String(document.body ?? "").split("\n");
  const at = lines.findIndex((line) => /^#(?:[ \t].*)?$/.test(line));
  if (at < 0) lines.unshift(titleLineOf(document.fields));
  else lines[at] = titleLineOf(document.fields);
  return { ...document, body: lines.join("\n") };
}

function el(name, className, ...children) {
  const node = document.createElement(name);
  if (className) node.className = className;
  node.append(...children);
  return node;
}
export const unquoted = (text) => String(text ?? "").trim().replace(/^`|`$/g, "");
const today = () => new Date().toISOString().slice(0, 10);
const bytesToText = (bytes) => new TextDecoder().decode(bytes);

// The register of the instance: its entries in the order of their files. The entries' texts are told to the snapshot first (Snapshot.readMany), which reads them in batches of a hundred
// where the host can (GitHub, with a token) and reads nothing ahead elsewhere; a snapshot without readMany is read file by file.
export async function readRegisterOf(host) {
  const { defaultBranch } = await host.repositoryInfo();
  const snapshot = await host.readSnapshot(defaultBranch);
  const entries = [];
  const paths = snapshot.paths.filter((each) => REGISTER_PATH.test(each)).sort();
  await snapshot.readMany?.(paths);
  for (const path of paths) {
    const text = await snapshot.read(path);
    if (text !== null && text !== undefined) entries.push(readDocument(ENTRY, path, text));
  }
  return { entries, branch: defaultBranch };
}

export const versionsOf = (entry) => entry.sections.find((section) => section.heading === "## Versions")?.rows ?? [];
const namesOf = (fields, id) => [id, fields.title, fields.kind === "standard" ? fields.designation : null].filter((name) => typeof name === "string" && name.trim() !== "");
const isLegalText = (entry) => Boolean(recogniseLegalText(entry.fields.identifier));

// The version hash a version's row records in its Files cell, or null where it records none.
export const versionHashOf = (row) => /version hash `([0-9a-f]{64})`/.exec(String(row.cells.Files ?? ""))?.[1] ?? null;

// One version of an entry, its files each stored or not, as MOD-source-register's linkedVersion reads the entry's note; null where the entry records none of that name.
function sourceVersionOf(entry, row) {
  const version = unquoted(row.cells.Version);
  const hash = versionHashOf(row) ?? "0".repeat(64);
  const links = readDocument(LINKS, "docs/sources.md", ["# Requirement sources", "", "| Source | Version | Hash | Part |", "|---|---|---|---|", `| ${entry.id} | ${version} | ${hash} | |`, ""].join("\n"));
  return linkedVersion(links, [entry], entry.id)?.version ?? null;
}
const filesOfVersion = (entry, row) => sourceVersionOf(entry, row)?.files ?? [];

function entryView(entry, context) {
  const versions = versionsOf(entry).map((row) => el("li", "library-version",
    `${unquoted(row.cells.Version)} · ${row.cells.Date ?? ""}${row.cells.Edition && row.cells.Edition !== "—" ? ` · ${row.cells.Edition}` : ""} · read from ${row.cells["Read from"] ?? "—"}`,
    el("ul", null, ...filesOfVersion(entry, row).map((file) => el("li", "library-file-state", `${file.name} — ${file.stored ? "stored" : "not stored"} — SHA-256 ${file.sha256}`)))));
  const back = el("button", "library-back btn", "Back to the library");
  back.addEventListener("click", () => context.go("library", {}));
  const fields = Object.entries(entry.fields).map(([key, value]) => el("li", null, `${key}: ${Array.isArray(value) ? value.join(", ") : value}`));
  return el("section", "library-entry panel", el("h2", null, `${entry.fields.title} (${entry.id})`), el("ul", null, ...fields), el("h3", null, "Versions"),
    versions.length ? el("ul", null, ...versions) : el("p", null, "No version is recorded yet."), el("p", null, back));
}

// The error line of each waiting legal text: the logs of the failed runs of the fetch workflow, newest (by `started`) first, are read only while a waiting text lacks its line, and no run is read
// from the newest successful run that a push started back, since a push fetches every text then waiting. One listing; no log while no legal text waits.
async function fetchFailures(host, branch, entries) {
  if (typeof host.listCiRuns !== "function" || typeof host.ciRunLog !== "function") return new Map();
  let runs;
  try { runs = await host.listCiRuns({ workflow: FETCH_WORKFLOW, branch }); } catch { return new Map(); }
  const waiting = entries.filter((entry) => isLegalText(entry) && versionsOf(entry).length === 0);
  const failures = new Map();
  const newestFirst = [...runs].sort((a, b) => String(b.started ?? "").localeCompare(String(a.started ?? "")));
  for (const run of newestFirst) {
    if (waiting.every((entry) => failures.has(entry.id))) break;
    if (run.state === "success" && run.event === "push") break;
    if (run.state !== "failure") continue;
    const log = await host.ciRunLog(run.id);
    for (const entry of waiting) {
      if (failures.has(entry.id) || !String(log ?? "").includes(entry.id)) continue;
      const line = String(log).split("\n").find((each) => each.includes(entry.id)) ?? String(log);
      failures.set(entry.id, line);
    }
  }
  return failures;
}

function fetchState(entry, failures, startFetch) {
  if (!isLegalText(entry)) return null;
  if (versionsOf(entry).length) return el("p", "library-fetch-state", "Fetched.");
  const failed = failures.get(entry.id);
  const state = el("p", "library-fetch-state", failed ? `Fetch failed: ${failed}` : "Waiting for fetch.");
  const again = el("button", "library-fetch-again btn", "Fetch again");
  again.addEventListener("click", async () => {
    again.disabled = true;
    state.textContent = "Starting fetch workflow.";
    try {
      const run = await startFetch();
      state.textContent = run?.url ? `Fetch workflow started: ${run.url}` : "Fetch workflow started.";
    } catch (error) {
      again.disabled = false;
      state.textContent = `The fetch workflow could not be started: ${error?.message ?? error}.`;
    }
  });
  return el("div", "library-fetch", state, again);
}

// The commit a repository's default branch stands at, read through a host connected with the stored credentials and secrets (the registration of a repository pins it, + New version of one records it).
async function currentCommit(context, address) {
  const host = connect(address, { ...credentialsFor(context.store, address), secrets: secretValues(context.store) });
  const { defaultBranch } = await host.repositoryInfo();
  const snapshot = await host.readSnapshot(defaultBranch);
  return { commit: snapshot.commit, branch: defaultBranch };
}

// The repository address of a source of kind repository: its `identifier`, when it is a repository's address and no EU legal text's; null for any other source.
function repositoryOf(entry) {
  const identifier = entry.fields.identifier;
  if (typeof identifier !== "string" || isLegalText(entry)) return null;
  try { return parseAddress(identifier); } catch { return null; }
}

// The commit of one repository's files: the branch's head read just before, the commit made on it.
async function commitTo(host, files, message) {
  const { defaultBranch } = await host.repositoryInfo();
  const snapshot = await host.readSnapshot(defaultBranch);
  return host.commitFiles({ branch: defaultBranch, expectedHead: snapshot.commit ?? null, message,
    files: files.map((file) => (typeof file.content === "string" ? { path: file.path, text: file.content } : { path: file.path, bytes: file.content })) });
}

function tokenNotice(web, host, error) {
  const links = host.webLinks();
  const page = links.newToken ? links.newToken("Agent M · sources", `Agent M writes the restricted content of requirement sources to ${web}`, 90) : links.projectTokens;
  const notice = el("p", null, `✗ The stored token cannot reach ${web} (${error?.message ?? error}). Nothing was committed. Extend the token so that it can write to that repository: `);
  const anchor = el("a", null, "the server's token page ↗");
  anchor.setAttribute("href", page ?? "#");
  notice.append(anchor, ".");
  return notice;
}

const isRestricted = (licence) => !REPUBLISHABLE.test(String(licence ?? ""));
const parseWeb = (address) => { try { return parseAddress(address).path; } catch { return address; } };

// What becomes public when a source's entry and `files` are committed: the entry always, a kept file in the instance or in the named repository, a file only hashed nowhere; for an EU
// legal text (`fetched`), the official text the fetch workflow stores in the instance after Save, where its licence permits republishing, and else nothing of it.
function statementOf(fields, files, instanceRepo, fetched = false) {
  const lines = [`Becomes public: the register entry, always, in the instance repository ${instanceRepo}.`];
  if (fetched) {
    lines.push(isRestricted(fields.licence) ? "The official text is not stored in the public instance: the fetch workflow stores a text only where its licence permits republishing."
      : "Content, public in the instance repository: the official text the fetch workflow downloads from the EU's publication repository after Save.");
  }
  const names = (list) => list.map((file) => file.name).join(", ");
  const kept = files.filter((file) => !file.onlyHashed), hashed = files.filter((file) => file.onlyHashed);
  if (kept.length) {
    if (!isRestricted(fields.licence)) lines.push(`Content, public in the instance repository: ${names(kept)}.`);
    else if (fields.content_repository) lines.push(`Content, stored only in ${parseWeb(fields.content_repository)} and not in the public instance: ${names(kept)}.`);
    else lines.push(`Content: ${names(kept)} needs a repository to be named; until then nothing is stored.`);
  }
  if (hashed.length) lines.push(`Nothing of ${names(hashed)} is stored: only its SHA-256 is recorded, with a note.`);
  return lines.join(" ");
}

// The files a person chooses, hashed in the browser: each shown with its SHA-256, "Only hash it" and, for such a file, where its copy is kept. `state.files` holds them; `changed` is called when a choice changes.
async function chooseFiles(input, state, rows, changed) {
  state.files = [];
  rows.replaceChildren();
  for (const file of Array.from(input.files ?? [])) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const entryFile = { name: file.name, bytes, sha: await sha256(bytes), onlyHashed: false };
    state.files.push(entryFile);
    const only = el("input", "library-file-only-hashed");
    only.type = "checkbox";
    const keptAt = el("input", "library-file-kept-at");
    keptAt.autocomplete = "off"; keptAt.spellcheck = false;
    const keptAtLabel = el("label", "library-file-kept-at-label", " Where your copy is kept ", keptAt);
    keptAtLabel.hidden = true;
    only.addEventListener("change", () => { entryFile.onlyHashed = only.checked; keptAtLabel.hidden = !only.checked; changed(); });
    const rememberNote = () => { entryFile.note = keptAt.value; };
    keptAt.addEventListener("input", rememberNote);
    keptAt.addEventListener("change", rememberNote);
    rows.append(el("p", null, el("span", "library-file-hash", `${file.name}: ${entryFile.sha}`), " ", el("label", null, only, " Only hash it — store it nowhere"), " ", keptAtLabel));
  }
  changed();
}

// The files of a commit plan committed, each repository's in its own commit: the content of the named repository before the entry, so that an entry never names content that was not
// stored. -> { done: web addresses committed to } | { notice } where the token cannot reach a named repository.
async function commitPlan(context, plan, label) {
  const instanceRepo = context.instance.repository;
  const ordered = [...plan.filter((item) => item.repository !== instanceRepo), ...plan.filter((item) => item.repository === instanceRepo)];
  const done = [];
  for (const item of ordered) {
    let host = context.instance.host, web = instanceRepo;
    if (item.repository !== instanceRepo) {
      const address = parseAddress(item.repository);
      host = connect(address, { ...credentialsFor(context.store, address), secrets: secretValues(context.store) });
      web = address.web;
      try { await commitTo(host, item.files, `${label}: its content (Agent M dashboard)`); } catch (error) {
        if (["PermissionMissing", "NotFound", "TokenRefused"].includes(error?.name)) return { notice: tokenNotice(web, host, error) };
        throw error;
      }
    } else {
      await commitTo(host, item.files, `${label} (Agent M dashboard)`);
    }
    done.push(web);
  }
  return { done };
}

// The host of the repository that holds an entry's content: the instance where the licence permits republishing, else the repository the entry names. A caller reads its snapshot once.
function holderOf(entry, context) {
  const named = permittedPlaces(entry) === "any" ? null : entry.fields.content_repository;
  let host = context.instance.host;
  if (named) { const address = parseAddress(named); host = connect(address, { ...credentialsFor(context.store, address), secrets: secretValues(context.store) }); }
  const asked = new Map();
  let info = null;
  return { repositoryInfo: () => (info ??= host.repositoryInfo()), readSnapshot: (ref) => { if (!asked.has(ref)) asked.set(ref, host.readSnapshot(ref)); return asked.get(ref); } };
}

// The products this browser keeps, each with its links file read through its own host (the products' `docs/sources.md`, one snapshot and one read for each); a product that cannot be read keeps its error.
function readProducts(context) {
  return Promise.all((readSetting(context.store, "products") ?? []).map(async (web) => {
    try {
      const address = parseAddress(web);
      const host = connect(address, { ...credentialsFor(context.store, address), secrets: secretValues(context.store) });
      const opened = await openLinks(host);
      return { web: address.web, host, ...opened, links: opened.text === null ? null : readDocument(LINKS, "docs/sources.md", opened.text) };
    } catch (error) {
      return { web, error };
    }
  }));
}

// The products whose link names an earlier row of the entry's `## Versions` than the last, the newest: [{ product, linked: its version }].
function olderProducts(entry, products) {
  const versions = versionsOf(entry).map((row) => unquoted(row.cells.Version));
  return products.flatMap((product) => {
    const row = product.links ? linkRow(product.links, entry.id) : undefined;
    const at = row ? versions.indexOf(unquoted(row.cells.Version)) : -1;
    return at >= 0 && at < versions.length - 1 ? [{ product, linked: versions[at] }] : [];
  });
}

// The passages that changed between two versions' files, for each file name that either holds: [{ file, lines: ["+ text" | "- text"] }], those with a change.
function passagesBetween(before, after) {
  const textsOf = (files) => new Map(files.map((file) => [file.name, bytesToText(file.bytes)]));
  const [was, now] = [textsOf(before), textsOf(after)];
  return [...new Set([...was.keys(), ...now.keys()])].map((file) => ({ file, lines: changedPassages(was.get(file) ?? "", now.get(file) ?? "")
    .map((line) => `${line.op === "added" ? "+" : "-"} ${line.text}`) })).filter((each) => each.lines.length);
}

// UC-016 steps 4 and 5 for one product: Move to the new version lists the requirements that name the source and the passages that changed, then Move writes the link.
function movePanel(entry, entries, item, context, moved) {
  const { product, linked } = item;
  const versions = versionsOf(entry);
  const newest = unquoted(versions.at(-1).cells.Version);
  const record = { version: newest, hash: versionHashOf(versions.at(-1)) };
  const panel = el("div", "library-move-panel");
  const result = el("p", "library-move-result");
  const listing = async () => {
    try {
      const names = affectedRequirements((await product.snapshot.read("SPEC.md")) ?? "", entries, entry.id);
      const was = sourceVersionOf(entry, versions.find((row) => unquoted(row.cells.Version) === linked));
      const now = sourceVersionOf(entry, versions.at(-1));
      const unstored = [...was.files, ...now.files].find((file) => !file.stored);
      let passages;
      if (unstored) passages = el("p", "library-move-passages-none", `The passages are not listed: ${unstored.name} is not stored.`);
      else {
        const holder = holderOf(entry, context);
        const [before, after] = [await readContent(was, async () => holder), await readContent(now, async () => holder)];
        const changed = passagesBetween(before, after);
        passages = el("div", "library-move-passages", ...(changed.length ? changed.flatMap((each) => [el("h4", "library-passages-file", each.file),
          el("ul", null, ...each.lines.map((line) => el("li", "library-passage", line)))]) : [el("p", null, "No passage changed.")]));
      }
      const move = el("button", "library-move-confirm btn primary", "Move");
      move.disabled = !record.hash;
      move.addEventListener("click", async (event) => {
        if (!event.isTrusted || !record.hash) return;
        result.textContent = "";
        const text = linksText(product.links, movedRows(product.links, entry.id, record));
        const trailers = [`Source moved: ${entry.id} ${linked} to ${newest}`, ...names.map((name) => `Requirement affected: ${name}`)];
        try {
          const saved = await saveLinks(product.host, product, text, trailers);
          if (saved.refused) { result.textContent = `docs/sources.md changed since this page read it; nothing was written. Open the entry again to read the newer file.`; return; }
          Object.assign(product, { text, blob: saved.blob, links: readDocument(LINKS, "docs/sources.md", text) });
          moved(`✓ ${product.web} links ${entry.id} at ${newest} (commit ${String(saved.commit).slice(0, 7)}).`);
        } catch (error) {
          result.textContent = `✗ ${error?.message ?? error} — nothing was written.`;
        }
      });
      panel.replaceChildren(explain("source-move"),
        el("p", "library-move-requirements", names.length ? `Requirements that name ${entry.id}: ${names.join(", ")}.` : `No requirement of this product names ${entry.id}.`),
        passages, ...(record.hash ? [] : [el("p", "library-move-nohash", `${newest} records no version hash, so a link cannot name it.`)]),
        el("p", "library-move-where", `Move writes docs/sources.md in ${product.web} as your own commit, and writes nothing else.`), el("p", null, move), result);
    } catch (error) {
      panel.replaceChildren(el("p", "library-move-unreadable", `✗ The move could not be prepared: ${error?.message ?? error}.`));
    }
  };
  return { panel, listing };
}

// UC-016 steps 1 and 3: the entry of a source with + New version and the products on older versions. The products are read after the entry is drawn, once; a new version recorded
// from this page is drawn from the plan that recorded it, with no read.
async function entryPage(target, first, entries, context, branch) {
  const instanceRepo = context.instance.repository;
  let entry = first;
  let products = null;
  const top = el("div", "library-entry-top");
  const older = el("div", "library-older");
  const state = { files: [] };
  const open = el("button", "library-new-version btn primary", "+ New version");
  const panel = el("section", "library-new-version-panel panel");
  panel.hidden = true;
  const versionId = el("input", "library-version-id"), versionDate = el("input", "library-version-date");
  const filesInput = el("input", "library-version-files");
  filesInput.type = "file"; filesInput.multiple = true;
  const fileRows = el("div", "library-file-rows");
  const statement = el("p", "library-version-public notice");
  const result = el("p", "library-version-result");
  const save = el("button", "library-version-save btn primary", "Save new version");
  for (const input of [versionId, versionDate]) { input.autocomplete = "off"; input.spellcheck = false; }
  const repository = repositoryOf(entry);
  const files = () => (repository ? [] : state.files.map((file) => ({ name: file.name, bytes: file.bytes, keep: !file.onlyHashed, note: file.note })));
  const describe = () => {
    statement.textContent = repository ? `Becomes public: the register entry, always, in the instance repository ${instanceRepo}. No file is stored: the commit ${repository.web} stands at when you save is recorded.`
      : statementOf(entry.fields, state.files, instanceRepo);
  };

  const drawOlder = (message) => {
    if (products === null) { older.replaceChildren(el("p", "library-older-reading", "Reading the products this browser keeps.")); return; }
    const items = olderProducts(entry, products);
    const unreadable = products.filter((product) => product.error).map((product) => el("p", "library-older-unreadable", `${product.web} could not be read: ${product.error?.message ?? product.error}.`));
    older.replaceChildren(el("h3", null, "Products on an older version"), ...(message ? [el("p", "library-move-done", message)] : []),
      ...(items.length ? [el("ul", "library-older-list", ...items.map((item) => {
        const row = el("li", "library-older-product");
        const move = movePanel(entry, entries, item, context, (done) => drawOlder(done));
        const start = el("button", "library-move-open btn", "Move to the new version");
        start.addEventListener("click", () => move.listing());
        row.append(`${item.product.web} links ${item.linked}; the newest is ${unquoted(versionsOf(entry).at(-1).cells.Version)}. `, start, move.panel);
        return row;
      }))] : [el("p", "library-older-none", "No product this browser keeps links an earlier version of this source.")]), ...unreadable);
  };
  const drawTop = () => top.replaceChildren(entryView(entry, context));

  // + New version of a fetched EU legal text starts the fetch run for the entry, which appends the newer text it fetches; the other sources get the panel.
  const fetchRun = isLegalText(first) && versionsOf(first).length > 0;
  open.addEventListener("click", async (event) => {
    if (!fetchRun) { panel.hidden = false; versionDate.value = today(); describe(); versionId.focus(); return; }
    if (!event.isTrusted) return;
    result.textContent = "";
    try {
      await context.instance.host.startWorkflow(FETCH_WORKFLOW, branch, { source: entry.id });
      result.textContent = `✓ The fetch workflow was started for ${entry.id}: a newer text is recorded as a further version, the same text is not recorded again.`;
    } catch (error) {
      result.textContent = `✗ The fetch workflow could not be started for ${entry.id}: ${error?.message ?? error}.`;
    }
  });
  filesInput.addEventListener("change", () => chooseFiles(filesInput, state, fileRows, describe));
  save.addEventListener("click", async (event) => {
    if (!event.isTrusted) return;
    result.textContent = "";
    const id = versionId.value.trim();
    try {
      const commit = repository ? (await currentCommit(context, repository)).commit : undefined;
      const plan = await versionCommits(entry, files(), { version: id, date: versionDate.value.trim(), repository: instanceRepo, commit });
      const committed = await commitPlan(context, plan, `New version ${id} of ${entry.id}`);
      if (committed.notice) { result.append(committed.notice); return; }
      const written = plan.find((item) => item.repository === instanceRepo).files.find((file) => file.path === entry.path).content;
      entry = readDocument(ENTRY, entry.path, written);
      entries.splice(entries.findIndex((each) => each.id === entry.id), 1, entry);
      state.files = []; fileRows.replaceChildren(); filesInput.value = ""; versionId.value = "";
      drawTop(); describe();
      result.textContent = `✓ ${id} is recorded for ${entry.id}: committed to ${committed.done.join(" and ")}.`;
      drawOlder();
    } catch (error) {
      result.textContent = `✗ ${error?.message ?? error} — nothing was recorded.`;
    }
  });

  panel.append(el("h3", null, "Add a new version"), explain("source-new-version"), el("p", null, el("label", null, "Version, its official identifier or edition ", versionId)),
    el("p", null, el("label", null, "Date ", versionDate)), ...(repository ? [] : [el("p", null, el("label", null, "Files ", filesInput)), fileRows, explain("file-only-hashed")]), statement, explain("source-public"),
    el("p", null, save), result);
  drawTop(); drawOlder();
  target.replaceChildren(top, el("p", null, open), ...(fetchRun ? [explain("source-new-version"), result] : [panel]), older);
  products = await readProducts(context);
  drawOlder();
}

export const route = {
  ...heads.library,
  async render(target, context, params = {}) {
    const instanceRepo = context.instance.repository;
    let entries, branch, failures;
    try {
      ({ entries, branch } = await readRegisterOf(context.instance.host));
      failures = await fetchFailures(context.instance.host, branch, entries);
    } catch (error) {
      target.replaceChildren(el("section", "head", el("h2", null, "Library")), el("p", "library-unreadable", `The library could not be read: ${error?.message ?? error}.`));
      return;
    }
    if (typeof params.source === "string" && params.source) {
      const entry = entries.find((each) => each.id === params.source);
      if (entry) await entryPage(target, entry, entries, context, branch);
      else target.replaceChildren(el("p", null, `The library holds no source ${params.source}.`));
      return;
    }

    // ------------------------------------------------------------ the list
    const list = el("div", "library-sources");
    const showList = () => list.replaceChildren(...entries.map((entry) => {
      const name = el("button", "library-source-name btn", entry.fields.title ?? entry.id);
      name.addEventListener("click", () => context.go("library", { source: entry.id }));
      const startFetch = () => context.instance.host.startWorkflow(FETCH_WORKFLOW, branch, { source: entry.id });
      return el("section", "library-source panel", el("h3", null, name), el("p", null, `${entry.id} · ${entry.fields.kind} · ${entry.fields.authority}`),
        el("p", null, versionsOf(entry).length ? `Versions: ${versionsOf(entry).map((row) => unquoted(row.cells.Version)).join(", ")}` : "No version recorded yet."),
        fetchState(entry, failures, startFetch) ?? "");
    }));
    showList();

    // ------------------------------------------------------------ + Register source
    const state = { route: "legal-text", identifier: "", designation: "", repo: null, files: [] };
    let remembered = {};
    let already = null;
    const open = el("button", "library-register btn primary", "+ Register source");
    const panel = el("section", "library-register-panel panel");
    panel.hidden = true;
    const routeSelect = el("select", "library-route", ...Object.keys(ROUTES).map((name) => el("option", null, name)));
    for (const option of routeSelect.childNodes) option.value = option.textContent;
    routeSelect.value = state.route;
    const help = el("p", "library-route-help", ...Object.values(ROUTES).flatMap((sentence) => [sentence, el("br")]));

    const legalAddress = el("input", "library-legal-address"), legalIdentifier = el("p", "library-legal-identifier");
    const designation = el("input", "library-standard-designation");
    const repositoryAddress = el("input", "library-repository-address"), repositoryCommit = el("p", "library-repository-commit");
    const filesInput = el("input", "library-files");
    filesInput.type = "file"; filesInput.multiple = true;
    const fileRows = el("div", "library-file-rows");
    const contentRepository = el("input", "library-content-repository");
    const filesBox = el("div", "library-files-box", el("p", null, el("label", null, "Files ", filesInput)), fileRows,
      el("p", null, el("label", null, "Repository for restricted content ", contentRepository)), explain("file-only-hashed"));
    const partLegal = el("div", "library-route-legal-text", el("p", null, el("label", null, "EUR-Lex or ELI address ", legalAddress)), legalIdentifier);
    const partStandard = el("div", "library-route-standard", el("p", null, el("label", null, "Full designation, with edition and amendments ", designation)), explain("standard-designation"));
    const partDocuments = el("div", "library-route-documents");
    const partRepository = el("div", "library-route-repository", el("p", null, el("label", null, "Repository address ", repositoryAddress)), repositoryCommit);
    const parts = { "legal-text": partLegal, standard: partStandard, documents: partDocuments, repository: partRepository };
    for (const input of [legalAddress, designation, repositoryAddress, contentRepository]) { input.value = ""; input.autocomplete = "off"; input.spellcheck = false; }
    const formBox = el("div", "library-form-box");
    const publicStatement = el("p", "library-public notice");
    const alreadyBox = el("div", "library-already-box");
    const result = el("div", "library-result");

    const showRoute = () => {
      for (const [name, part] of Object.entries(parts)) part.hidden = name !== state.route;
      (state.route === "standard" ? partStandard : partDocuments).append(filesBox);
      filesBox.hidden = !(state.route === "standard" || state.route === "documents");
    };

    const keptFiles = () => state.files.filter((file) => !file.onlyHashed);

    function checks(document) {
      const { fields } = document;
      remembered = { ...fields };
      publicStatement.textContent = statementOf(fields, state.files, instanceRepo, state.route === "legal-text");
      const found = [];
      const add = (rule, what, fix) => found.push(finding({ artifact: "library", line: 1, kind: "error", rule, what, fix }));
      const names = namesOf(fields, fields.id).map((name) => name.toLowerCase());
      const same = entries.find((entry) => namesOf(entry.fields, entry.id).some((name) => names.includes(name.toLowerCase())));
      if (same !== already) {
        already = same ?? null;
        if (already) {
          const go = el("button", "library-already btn", `Add a new version of ${already.id}`);
          go.addEventListener("click", () => context.go("library", { source: already.id }));
          alreadyBox.replaceChildren(go);
        } else alreadyBox.replaceChildren();
      }
      if (same) add("THE INSTANCE KEEPS THE SOURCE REGISTER", `this source is already in the library as ${same.id}`, `add a new version of it instead — + New version on its entry —, or name another source`);
      if (keptFiles().length && isRestricted(fields.licence) && !fields.content_repository) {
        add("RESTRICTED CONTENT STAYS OUT OF THE PUBLIC INSTANCE", "restricted content needs a repository of its own", "name the repository for the content in content_repository, or only hash the files");
      }
      if (state.route === "documents" && !state.files.length) add("THE SOURCE MODEL IS GENERIC", "no file is selected", "select the files or the zip file");
      if (state.route === "legal-text" && !fields.identifier) add("THE SOURCE MODEL IS GENERIC", "no EU legal text is recognised yet", "paste its EUR-Lex or ELI address");
      if (state.route === "repository" && !state.repo) add("A LIVING SOURCE IS PINNED", "the repository is not pinned to a commit yet", "paste its address so that its current commit is read");
      return found;
    }

    function versionRow() {
      if (state.route === "legal-text") return "";
      const readFrom = state.route === "repository" && state.repo ? `${state.repo.address} commit ${state.repo.commit}` : state.files.length ? "the selected files" : "—";
      const version = state.route === "standard" ? (state.designation || today()) : today();
      return `| \`${version}\` | ${today()} | ${state.route === "standard" ? "—" : "—"} | ${readFrom} | pending |`;
    }

    function draft(carried) {
      const fields = { ...carried, kind: carried.kind ?? KIND_OF[state.route] };
      if (state.route === "standard") { fields.licence ??= "restricted"; if (state.designation) fields.designation = state.designation; }
      if (state.route === "legal-text" && state.identifier) fields.identifier = state.identifier;
      if (state.route === "repository" && state.repo) fields.identifier = state.repo.address;
      if (contentRepository.value.trim()) fields.content_repository = contentRepository.value.trim();
      const front = Object.entries(fields).filter(([, value]) => value !== undefined && value !== "").map(([key, value]) => `${key}: ${value}`);
      const text = [...(front.length ? ["---", ...front, "---"] : []), titleLineOf(fields), "", "## Versions", "",
        "| Version | Date | Edition | Read from | Files |", "|---|---|---|---|---|", versionRow(), ""].join("\n");
      return readDocument(ENTRY, `docs/sources/${fields.id ?? "SRC-new"}.md`, text);
    }

    async function save(document) {
      result.replaceChildren();
      const id = document.fields.id;
      const text = writeDocument(ENTRY, titled(document));
      const entry = readDocument(ENTRY, `docs/sources/${id}.md`, text);
      try {
        const plan = state.route === "legal-text"
          ? [{ repository: instanceRepo, files: [{ path: `docs/sources/${id}.md`, content: text }] }]
          : await registrationCommits(entry, state.files.map((file) => ({ name: file.name, bytes: file.bytes, keep: !file.onlyHashed, note: file.note })), instanceRepo);
        const committed = await commitPlan(context, plan, `Register source ${id}`);
        if (committed.notice) { result.append(committed.notice); return; }
        ({ entries } = await readRegisterOf(context.instance.host));
        showList();
        const open = el("button", "library-open-entry btn", `Open ${id}`);
        open.addEventListener("click", () => context.go("library", { source: id }));
        result.append(el("p", null, `✓ ${id} is registered: committed to ${committed.done.join(" and ")}. `), open);
      } catch (error) {
        result.append(el("p", null, `✗ ${error?.message ?? error} — nothing more was written.`));
      }
    }

    function buildForm(fresh = false) {
      if (fresh) { remembered = {}; already = null; alreadyBox.replaceChildren(); }
      formBox.replaceChildren(schemaForm(ENTRY, draft(remembered), { onSave: save, extraChecks: checks }));
    }

    const openPanel = () => { panel.hidden = false; showRoute(); buildForm(true); };
    open.addEventListener("click", openPanel);
    routeSelect.addEventListener("change", () => { state.route = routeSelect.value; state.identifier = ""; state.designation = ""; state.repo = null; state.files = []; fileRows.replaceChildren(); showRoute(); buildForm(true); });
    legalAddress.addEventListener("change", () => {
      const found = recogniseLegalText(legalAddress.value.trim());
      state.identifier = found ? (found.celex ?? found.eli) : "";
      legalIdentifier.textContent = found ? `Recognised: ${found.celex ? `CELEX ${found.celex}` : `ELI ${found.eli}`}` : "No EU legal text is recognised in this address; use its EUR-Lex or ELI address.";
      buildForm();
    });
    designation.addEventListener("change", () => { state.designation = designation.value.trim(); buildForm(); });
    contentRepository.addEventListener("change", () => buildForm());
    filesInput.addEventListener("change", () => chooseFiles(filesInput, state, fileRows, () => buildForm()));
    repositoryAddress.addEventListener("change", async () => {
      state.repo = null;
      try {
        const address = parseAddress(repositoryAddress.value.trim());
        const { commit, branch } = await currentCommit(context, address);
        state.repo = { address: address.web, commit };
        repositoryCommit.textContent = `Pinned to commit ${commit} on ${branch}.`;
      } catch (error) {
        repositoryCommit.textContent = `The repository could not be read: ${error?.message ?? error}.`;
      }
      buildForm();
    });

    panel.append(el("h3", null, "Register a source"), el("p", null, el("label", null, "What is the source? ", routeSelect)), help, explain("source-kinds"),
      partLegal, partStandard, partDocuments, partRepository,
      explain("source-name"), explain("source-authority"), explain("source-licence"),
      formBox, alreadyBox, publicStatement, explain("source-public"), result);
    showRoute();
    // UC-015 2a: for a product, a way back to its Requirement sources.
    const back = el("button", "library-back-to-sources btn", "Back to Requirement sources");
    back.addEventListener("click", () => context.go("sources", {}));
    target.replaceChildren(el("section", "head", el("h2", null, "Library")), el("p", null, open, ...(context.product ? [" ", back] : [])), panel, list);
  },
};
