// MOD-settings-pages' route `sources` — a product's Requirement sources (UC-015 steps 1 to 4, with 2a, 2b, 2c and 3a): the instance's library, each source with its kind,
// authority and versions; the author ticks the sources that apply, chooses the version — preset to the newest — and may name the part that applies, suggested from the entry's
// `## Parts`; Save writes the product's `docs/sources.md` with MOD-artifact-edits' saveFile, on the blob it was opened on, as the person's own commit, in one commit. Before a
// link is removed, the requirements that name its source are listed, with MOD-source-register's affectedRequirements. A link to the library and, in the library, one back (2a).
// The folded What is this? is MOD-site-frame's topic requirement-sources, called through explain (EVERY STEP EXPLAINS ITSELF). A restricted source links like any other (3a):
// only its content needs access. The file's reading and writing (openLinks, linkRow, linkCells, movedRows, linksText, saveLinks) are exported: the library's Move of a product to a
// source's newer version (UC-016 5) writes the link through the same code.
//
// Module: MOD-settings-pages
//
// Where the texts leave a reading open, this file states the one it takes:
//   - The page is drawn for the chosen product; where the browser names none it says so and reads nothing. The register is read with library.mjs's readRegisterOf, the module's
//     own code, and the product's `docs/sources.md` and `SPEC.md` through the product's host, at its default branch's head.
//   - A version can be linked when the register's row for it records its version hash (the `version hash` of its Files cell); a source with no such version cannot be ticked.
//   - The version is preset to the version the link names, else to the last row of the entry's `## Versions`, its newest. A link that names a version the library does not record
//     keeps that version as a choice of its own, with the hash its link records.
//   - A part is suggested for each line of the entry's `## Parts` with a list marker taken off; the part is free text, and an empty part is written as the dash “—”, which MOD-documents' writeDocument leaves an empty cell as, and read back as empty.
//   - A link row whose source the library does not hold is kept as it is, and named; it cannot be edited here.
//   - A row the person leaves as it is keeps its cells as the file has them; Save with nothing changed writes nothing, and neither does Save with nothing ticked in a product that has
//     no `docs/sources.md`.
//   - The requirements that name a source are the ones affectedRequirements gives for the register and the entry's identifier: those one of whose source items names the entry by its
//     identifier, its title or a standard's designation, as MOD-source-register's file reads an item. The register is the one this page read; no read is added.
//   - Save acts on the person's own click only (THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK); a click the page itself dispatched writes nothing.

import { parseAddress } from "../repository-hosts/index.mjs";
import { readDocument, writeDocument } from "../documents/index.mjs";
import { saveFile } from "../artifact-edits/index.mjs";
import { affectedRequirements, permittedPlaces, sourceSchemas } from "../source-register/index.mjs";
import { explain } from "../site-frame/index.mjs";
import { readRegisterOf, unquoted, versionHashOf, versionsOf } from "./library.mjs";
import { heads } from "./routes.mjs";

const { links: LINKS } = sourceSchemas();
const PATH = "docs/sources.md";
const SPEC_PATH = "SPEC.md";

function el(name, className, ...children) {
  const node = document.createElement(name);
  if (className) node.className = className;
  node.append(...children);
  return node;
}

// A product's links file at the head of its default branch: the snapshot it was read from, its text (null: it does not exist yet) and the blob it was opened on. The library page reads it
// for each product this browser keeps, to show the products on an older version of a source.
export async function openLinks(host) {
  const { defaultBranch } = await host.repositoryInfo();
  const snapshot = await host.readSnapshot(defaultBranch);
  return { snapshot, text: await snapshot.read(PATH), blob: snapshot.blob(PATH) };
}

// The product's files this page reads, at the head of its default branch: the links file with the blob it was opened on (null: it does not exist yet), and the SPEC.
async function readProduct(host) {
  const { snapshot, text, blob } = await openLinks(host);
  return { text, blob, spec: (await snapshot.read(SPEC_PATH)) ?? "" };
}

// The parts an entry names: each line of its `## Parts`, without the marker of a list item.
const partsOf = (entry) => (entry.sections.find((section) => section.heading === "## Parts")?.text ?? "").split("\n")
  .map((line) => line.replace(/^\s*(?:[-*+]|\d+[.)])\s+/, "").trim()).filter(Boolean);

// The rows of the links file, in its order.
const rowsOf = (document_) => document_.sections[0]?.rows ?? [];
const sourceOf = (row) => unquoted(row.cells.Source);
// A row as the file says it, to tell a change from none.
const signature = (row) => [sourceOf(row), unquoted(row.cells.Version), unquoted(row.cells.Hash), String(row.cells.Part ?? "").trim()].join("\u0000");

// The row of a links file that links the source `id`, or undefined.
export const linkRow = (document_, id) => rowsOf(document_).find((row) => sourceOf(row) === id);

// The cells of a link when the person's choice is `record` ({ version, hash }) and `part`: the row's own cells where its version and part are the choice's.
export function linkCells(id, row, record, part) {
  const same = Boolean(row) && unquoted(row.cells.Version) === record.version;
  const kept = String(part).trim();
  return { Source: row ? row.cells.Source : id, Version: same ? row.cells.Version : record.version,
    Hash: same ? row.cells.Hash : record.hash, Part: row && kept === String(row.cells.Part ?? "").trim() ? row.cells.Part : kept };
}

// The rows of a links file with the link of `id` moved to `record`, its part kept.
export const movedRows = (document_, id, record) => rowsOf(document_)
  .map((row) => (sourceOf(row) === id ? { ...row, cells: linkCells(id, row, record, row.cells.Part ?? "") } : row));

// The text of a links file holding `rows`.
export const linksText = (document_, rows) => writeDocument(LINKS, { ...document_, sections: [{ ...document_.sections[0], rows }] });

// The links file saved on the blob it was opened on, as the person's own commit; `trailers` end the commit's message. -> saveFile's result.
export const saveLinks = (host, opened, text, trailers = []) => saveFile(host, { path: PATH, text, openedBlob: opened.blob, trailers });

export const route = {
  ...heads.sources,
  async render(target, context) {
    const product = context.product;
    if (!product) {
      target.replaceChildren(el("section", "head", el("h2", null, "Requirement sources")),
        el("p", "sources-no-product", "Choose a product: the sources a product must meet are linked in the product's own repository, so this page is drawn for one."));
      return;
    }

    let entries, files;
    try {
      ({ entries } = await readRegisterOf(context.instance.host));
    } catch (error) {
      target.replaceChildren(el("section", "head", el("h2", null, "Requirement sources")), el("p", "sources-unreadable", `The library could not be read: ${error?.message ?? error}.`));
      return;
    }
    try {
      files = await readProduct(product.host);
    } catch (error) {
      target.replaceChildren(el("section", "head", el("h2", null, "Requirement sources")), el("p", "sources-unreadable", `The product's repository could not be read: ${error?.message ?? error}.`));
      return;
    }
    const name = parseAddress(product.address).path.split("/").pop();
    let opened = { blob: files.blob, text: files.text,
      document: readDocument(LINKS, PATH, files.text ?? `# Requirement sources of ${name}\n`) };
    const inLibrary = new Set(entries.map((entry) => entry.id));
    const orphans = rowsOf(opened.document).map(sourceOf).filter((id) => !inLibrary.has(id));

    // ------------------------------------------------------------ one section for each source of the library
    const items = entries.map((entry) => {
      const row = rowsOf(opened.document).find((each) => sourceOf(each) === entry.id);
      const versions = versionsOf(entry).map((each) => ({ version: unquoted(each.cells.Version), date: each.cells.Date ?? "", hash: versionHashOf(each), recorded: true }))
        .filter((each) => each.hash);
      if (row && !versions.some((each) => each.version === unquoted(row.cells.Version))) {
        versions.push({ version: unquoted(row.cells.Version), date: "", hash: unquoted(row.cells.Hash), recorded: false });
      }
      const tick = el("input", "sources-tick");
      tick.type = "checkbox";
      tick.checked = Boolean(row);
      tick.disabled = versions.length === 0;
      const select = el("select", "sources-version", ...versions.map((each) => {
        const option = el("option", null, `${each.version}${each.date ? ` · ${each.date}` : ""}${each.recorded ? "" : " · not recorded in the library"}`);
        option.value = each.version;
        return option;
      }));
      select.value = row ? unquoted(row.cells.Version) : versions.at(-1)?.version ?? "";
      const part = el("input", "sources-part");
      part.value = row ? String(row.cells.Part ?? "") : "";
      part.autocomplete = "off";
      const hash = el("p", "sources-hash");
      const showHash = () => { hash.textContent = `Hash of this version: ${versions.find((each) => each.version === select.value)?.hash ?? "none"}`; };
      showHash();
      select.addEventListener("change", showHash);
      const suggestions = el("span", "sources-part-suggestions", ...partsOf(entry).map((suggested) => {
        const button = el("button", "sources-part-suggestion btn", suggested);
        button.addEventListener("click", () => { part.value = suggested; });
        return button;
      }));
      const removal = el("p", "sources-removal");
      const item = { entry, row, versions, tick, select, part, removal };
      tick.addEventListener("change", () => {
        const linked = rowsOf(opened.document).some((each) => sourceOf(each) === entry.id);
        if (tick.checked || !linked) { removal.textContent = ""; return; }
        const names = affectedRequirements(files.spec, entries, entry.id);
        removal.textContent = names.length
          ? `Removing ${entry.id}: the requirements that name it — ${names.join(", ")} — would lose that source. They are listed, not deleted.`
          : `Removing ${entry.id}: no requirement of this product names it.`;
      });
      const section = el("section", "sources-entry panel",
        el("h3", null, el("label", null, tick, ` ${entry.fields.title ?? entry.id}`)),
        el("p", "sources-meta", `${entry.id} · ${entry.fields.kind} · ${entry.fields.authority}`),
        ...(permittedPlaces(entry) === "any" ? [] : [el("p", "sources-restricted",
          "Restricted: its content needs access. Linking needs none — the entry, its versions and their hashes are public.")]),
        ...(versions.length ? [el("p", null, el("label", null, "Version ", select)), hash]
          : [el("p", "sources-no-version", "No version is recorded yet; a source without a version cannot be linked.")]),
        el("p", null, el("label", null, "Part ", part), " ", suggestions), removal);
      section.setAttribute("data-source", entry.id);
      return { ...item, section };
    });

    // ------------------------------------------------------------ Save
    const result = el("p", "sources-result");
    const save = el("button", "sources-save btn primary", "Save");
    const cellsOf = (item, row) => linkCells(item.entry.id, row, item.versions.find((each) => each.version === item.select.value), item.part.value);
    const rowsNow = () => {
      const byId = new Map(items.map((item) => [item.entry.id, item]));
      const kept = rowsOf(opened.document).flatMap((row) => {
        const item = byId.get(sourceOf(row));
        if (!item) return [row];
        return item.tick.checked ? [{ ...row, cells: cellsOf(item, row) }] : [];
      });
      const known = new Set(rowsOf(opened.document).map(sourceOf));
      return [...kept, ...items.filter((item) => item.tick.checked && !known.has(item.entry.id)).map((item) => ({ line: null, cells: cellsOf(item, null) }))];
    };
    save.addEventListener("click", async (event) => {
      if (!event.isTrusted) return;
      result.textContent = "";
      const rows = rowsNow();
      const before = rowsOf(opened.document);
      if (rows.map(signature).join("\n") === before.map(signature).join("\n") || (opened.text === null && rows.length === 0)) {
        result.textContent = "Nothing changed; nothing was written.";
        return;
      }
      const text = linksText(opened.document, rows);
      try {
        const saved = await saveLinks(product.host, opened, text);
        if (saved.refused) {
          result.textContent = `${PATH} changed since this page read it; nothing was written. Your choices stay here; open the page again to read the newer file.`;
          return;
        }
        opened = { blob: saved.blob, text, document: readDocument(LINKS, PATH, text) };
        for (const item of items) item.removal.textContent = "";
        result.textContent = `✓ ${PATH} is saved in ${product.address} (commit ${String(saved.commit).slice(0, 7)}).`;
      } catch (error) {
        result.textContent = `✗ ${error?.message ?? error} — nothing was written.`;
      }
    });

    // ------------------------------------------------------------ the page
    const open = el("button", "sources-library btn", "Open the library");
    open.addEventListener("click", () => context.go("library", {}));
    target.replaceChildren(
      el("section", "head", el("h2", null, "Requirement sources")),
      el("p", "muted", `Product: ${product.address}`),
      el("p", "sources-where", `Save writes ${PATH} in ${product.address} as your own commit, and writes nothing else.`),
      explain("requirement-sources"),
      el("p", null, open, " A needed source is not in the library? Register it there, then come back."),
      ...(entries.length ? [] : [el("p", "sources-empty", "The library holds no source yet.")]),
      ...(orphans.length ? [el("p", "sources-orphans", `Linked, but not in the library: ${orphans.join(", ")} — kept as they are.`)] : []),
      el("div", "sources-list", ...items.map((item) => item.section)),
      el("p", null, save), result);
    // A FORM OPENS WITH ITS FIRST FIELD FOCUSED: the first box that can be ticked.
    items.find((item) => !item.tick.disabled)?.tick.focus();
  },
};
