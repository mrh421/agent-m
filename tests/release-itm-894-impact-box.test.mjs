// Release tests of ITM-894 — UC-023 on the review pages of a changed architecture file: the impact list stands in a box that scrolls. The behaviour is UC-023 and
// the SPEC's AN ARCHITECTURE CHANGE IS NOT ACCEPTED WITHOUT AN IMPACT LIST ("the modules it designs, their code files and tests, and the requirements that reference it are shown beside the change") and THE SITE
// SERVES A SCREEN READER (WCAG 2.2 level AA), as docs/architecture/MOD-review-pages.md (`<k>/<id>` and `<k>/all`: "the impact lists", a changed file's difference "in a box of its own that scrolls") and
// docs/architecture/MOD-site-frame.md (`look.css`) state the pages. The page is drawn in a real browser (the controlled Electron of tests/site-usability.d, over the site's own style sheets and the fixture product
// of tests/site-usability.d/product.mjs with its decision ARC-001 and its module MOD-reader both changed since they were accepted, and with a longer list of modules and of code files), and every value is what the
// browser computed or did: the computed style of the box and its measured heights.
// Run: node --test tests/release-itm-894-impact-box.test.mjs
//
// Module: MOD-site-frame; MOD-review-pages
// Guards: AN ARCHITECTURE CHANGE IS NOT ACCEPTED WITHOUT AN IMPACT LIST; THE SITE SERVES A SCREEN READER; UC-023
// Level: release
//
// Written for the release testing of sprint 123 by a participant who implemented none of ITM-894 (RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER). The expected values are written here from the item's
// Acceptance ("`look.css` holds a rule that gives `.change-impact` a vertical scrolling box, and the impact list on a file's page and on Review all is drawn in it"; "The box is reached by the keyboard, as the
// site's other scrolling boxes are"), from akmaier's request it quotes ("the impact also needs to go into a text box with slider") and from WCAG 2.2; none is read from a document or from
// look.css. Readings taken where the texts leave one open:
//   - "the impact list" is the element `section.change-impact` in <main>; "a file's page" is the page of one changed architecture file, of the two kinds that draw an impact list: a module file (#arc/MOD-reader) and a
//     decision (#arc/ARC-001); "Review all" is the page of the whole architecture (#review/arc), which draws one impact list for each changed file it shows, here two.
//   - "a vertical scrolling box" is read as a box whose computed overflow-y is auto, whose computed max-height is a length in pixels, and whose content really is taller than the box (scrollHeight above clientHeight),
//     so that a long list makes the box scroll instead of the page grow; the fixture's lists are long on purpose (twelve more modules follow ARC-001, ninety code files lie in the folder of MOD-reader).
//     The rule's "pixels" is read on the computed style, where the browser resolves any length to pixels: the case checks that the box has a pixel height of its own, not the unit the sheet wrote.
//   - "reached by the keyboard" and "text box with slider" (the item's second Acceptance sentence and akmaier's quoted request) are not asserted here. Real Tab, End and mouse wheel events sent in the controlled
//     Electron flip on the CI runner (runs 40993289807, 40995188818, 40995654794 and 40996089139), so no stable verdict could be held. What keeps guarding them: TST-894004 and TST-894005 (unit,
//     tests/review-pages-impact-box.test.mjs) guard that each impact list, on a file's page and on Review all, carries tabindex "0"; TST-894301 and TST-894302 (release, below) guard that it is a scrolling box
//     whose scrollHeight exceeds its clientHeight, so that there is something to scroll.
//   - The conditions are the light scheme at a desktop's width (1280 px) and a phone's (390 px).

import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { stageElectron, openWindow, configure, withStderr } from "./site-usability.d/browser.mjs";
import { serveSite, REPO } from "./site-usability.d/site.mjs";
import { files, history, pullsHandler, tagsHandler } from "./site-usability.d/product.mjs";
import { show, OBSERVE } from "./site-usability.d/routes.mjs";

const ARC_PATH = "docs/architecture/ARC-001-static-client.md", READER_PATH = "docs/architecture/MOD-reader.md";
const CONDITIONS = [["light desktop", 1280], ["light phone", 390]];
const FILE_PAGES = [["#arc/MOD-reader", 1], ["#arc/ARC-001", 1]], ALL = "#review/arc";
const SHOWN_ON_ALL = 2; // ARC-001 and MOD-reader, the two files of the fixture that changed since they were accepted

// The fixture product of tests/site-usability.d, with ARC-001 and MOD-reader changed since the approval records that name their accepted texts, twelve modules more that follow ARC-001, and ninety code files in the
// folder of MOD-reader, so that the impact list of each is longer than any box of 420 px.
const extraModule = (n) => `---\nid: MOD-extra-${n}\ntitle: Extra ${n}\nfolder: src/extra-${n}/\nrealises:\n  - THE READER READS A FILE AT A PINNED COMMIT\nfollows:\n  - ARC-001\nuses:\nprovides:\n  - read\n---\n# MOD-extra-${n} Extra ${n}\n\n## Responsibility\n\nExtra ${n}.\n\n## Interfaces\n\n- \`read(path) -> text | null\` — the exact text of one file.\n`;
async function fixture() {
  const base = await files();
  const extra = {};
  for (let n = 10; n < 22; n += 1) extra[`docs/architecture/MOD-extra-${n}.md`] = extraModule(n);
  for (let n = 100; n < 190; n += 1) extra[`src/reader/pinned-commit-reader-part-${n}.mjs`] = "export const part = 1;\n";
  const changed = {
    [ARC_PATH]: base[ARC_PATH].replace("through the Git server's API.", "through the Git server's API, and reads each file once."),
    [READER_PATH]: base[READER_PATH].replace("Reads files at a pinned commit.", "Reads files at a pinned commit, whole."),
  };
  assert.notEqual(changed[ARC_PATH], base[ARC_PATH]);
  assert.notEqual(changed[READER_PATH], base[READER_PATH]);
  return { files: { ...base, ...extra, ...changed }, history: [...(await history()), base[ARC_PATH], base[READER_PATH]] };
}

// The boxes of <main> as the browser resolved and drew them: the impact lists, with their style, their heights, their place and the bottom of their last line.
const MEASURE = `(() => { const boxes = [...document.querySelectorAll("main .change-impact")];
  const style = (box) => getComputedStyle(box), rect = (node) => node.getBoundingClientRect();
  return { width: window.innerWidth, pageScrollsSideways: document.documentElement.scrollWidth > window.innerWidth,
    boxes: boxes.map((box) => ({ tag: box.tagName, tabindex: box.getAttribute("tabindex"), overflowY: style(box).overflowY, maxHeight: style(box).maxHeight, scrollHeight: box.scrollHeight, clientHeight: box.clientHeight,
      height: rect(box).height, left: rect(box).left, right: rect(box).right, heading: box.querySelector("h3")?.textContent ?? null })) }; })()`;
// Boxes planted beside the impact lists, long and equal in their words: one with no rule at all, one with a rule and a tabindex, one with a rule and no tabindex. The planted boxes only give the judgement of a box that scrolls its known positive and its counter-proof.
const PLANT = `(() => { const lines = Array.from({ length: 40 }, (_, n) => "<p>planted line " + (n + 1) + "</p>").join("");
  document.querySelector("main").insertAdjacentHTML("beforeend",
    '<div id="planted-plain">' + lines + '</div>'
    + '<div id="planted-box" tabindex="0" style="max-height:100px;overflow:auto">' + lines + '<button type="button">planted button</button></div>'
    + '<div id="planted-untabbable" style="max-height:100px;overflow:auto">' + lines + '<button type="button">planted button</button></div>'); })()`;
const PLANTED = `(() => ["planted-plain", "planted-box", "planted-untabbable"].map((id) => { const node = document.getElementById(id), style = getComputedStyle(node);
  return { id, tabindex: node.getAttribute("tabindex"), overflowY: style.overflowY, maxHeight: style.maxHeight, scrollHeight: node.scrollHeight, clientHeight: node.clientHeight }; }))()`;

const measured = new Map(); // "<condition> <address>" -> MEASURE
const planted = new Map(); // condition -> { styles }
let site = null, browser = null;

before(async () => {
  try {
    const product = await fixture();
    site = await serveSite({ files: product.files, history: product.history, handlers: [pullsHandler(REPO), tagsHandler(REPO)] });
    browser = await openWindow(await stageElectron(), `${site.address}/__blank`);
    const page = browser.page;
    await configure(page, "Page.addScriptToEvaluateOnNewDocument", { source: OBSERVE });
    for (const [name, width] of CONDITIONS) {
      await configure(page, "Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: width < 600 });
      for (const [address] of [...FILE_PAGES, [ALL]]) {
        await show(page, site, address);
        measured.set(`${name} ${address}`, await page.evaluate(MEASURE));
      }
      // Review all is still shown: the planted boxes beside the impact lists.
      await page.evaluate(PLANT);
      planted.set(name, { styles: await page.evaluate(PLANTED) });
    }
  } catch (failure) { throw browser ? withStderr(failure, browser.stderr()) : failure; }
}, { timeout: 280000 });

after(async () => {
  browser?.close();
  await site?.close();
});

// A box that scrolls as the item asks: overflow-y auto, a max-height in pixels, and a list taller than the box.
const pixels = (value) => /^\d+(\.\d+)?px$/.test(value);
const scrolls = (box) => box.overflowY === "auto" && pixels(box.maxHeight) && box.scrollHeight > box.clientHeight;
const describe = (box) => `${box.tag ?? box.id} overflow-y ${box.overflowY}, max-height ${box.maxHeight}, scrollHeight ${box.scrollHeight}, clientHeight ${box.clientHeight}`;
const pageOf = (name, address) => measured.get(`${name} ${address}`);
const boxesOf = (name, address) => pageOf(name, address).boxes;
const plantedBox = (name, id) => planted.get(name).styles.find((each) => each.id === id);

// TST-894301 · level: release · module: MOD-site-frame, MOD-review-pages
// guards: AN ARCHITECTURE CHANGE IS NOT ACCEPTED WITHOUT AN IMPACT LIST; UC-023
// given: the pages of the changed module file MOD-reader and of the changed decision ARC-001, drawn in a real browser over the site's style sheets, in the light scheme at 1280 px and 390 px; the fixture's impact lists are longer than 420 px; beside the lists of Review all three long boxes planted, one with no rule, one with overflow auto and a max-height, one with the same and no tabindex
// input: the section.change-impact of each page with its computed overflow-y, its computed max-height and its heights; the known positive is the planted box with the rule, the counter-proof the planted box with none
// expect: each page draws exactly one impact list, and it is a box that scrolls: overflow-y auto, a max-height in pixels, scrollHeight above clientHeight; the planted box with the rule is judged a box that scrolls, the planted box with no rule is not
// Planted fault: look.css without the rule of .change-impact leaves overflow visible and no max-height, and the case fails on both pages; the rule only inside @media (max-width: 599px) fails it at 1280 px; the rule under `table .change-impact` fails it everywhere; overflow: hidden fails the overflow-y; max-height: 4000px leaves the list no taller than the box and fails the heights.
test("TST-894301 the impact list on the page of a changed module file and of a changed decision is a box that scrolls", () => {
  for (const [name] of CONDITIONS) {
    assert.equal(scrolls(plantedBox(name, "planted-box")), true, `${name}: known positive, the planted box with the rule is judged a box that scrolls: ${describe(plantedBox(name, "planted-box"))}`);
    assert.equal(scrolls(plantedBox(name, "planted-plain")), false, `${name}: counter-proof, the planted box with no rule is judged no box: ${describe(plantedBox(name, "planted-plain"))}`);
    for (const [address, shown] of FILE_PAGES) {
      const boxes = boxesOf(name, address);
      assert.equal(boxes.length, shown, `${name}: ${address} draws ${shown} impact list: ${JSON.stringify(boxes.map(describe))}`);
      for (const box of boxes) assert.equal(scrolls(box), true, `${name}: ${address}: ${describe(box)}`);
    }
  }
});

// TST-894302 · level: release · module: MOD-site-frame, MOD-review-pages
// guards: AN ARCHITECTURE CHANGE IS NOT ACCEPTED WITHOUT AN IMPACT LIST; UC-023
// given: Review all of the architecture (#review/arc), which shows the changed decision ARC-001 and the changed module MOD-reader, drawn in the light scheme at 1280 px and 390 px
// input: each section.change-impact of the page with its computed overflow-y, its computed max-height and its heights; the known positive is the count of two lists for the two changed files
// expect: Review all draws one impact list for each of its two changed files, and each is a box that scrolls: overflow-y auto, a max-height in pixels, scrollHeight above clientHeight
// Planted fault: look.css without the rule of .change-impact, with it only inside @media (max-width: 599px), with it under `table .change-impact`, with overflow: hidden, or with max-height: 4000px leaves the lists of Review all no box that scrolls and the case fails on both lists.
test("TST-894302 the impact lists on Review all are boxes that scroll", () => {
  for (const [name] of CONDITIONS) {
    const boxes = boxesOf(name, ALL);
    assert.equal(boxes.length, SHOWN_ON_ALL, `known positive: ${name}: Review all draws the impact list of each changed file it shows: ${JSON.stringify(boxes.map(describe))}`);
    for (const box of boxes) assert.equal(scrolls(box), true, `${name}: Review all: ${describe(box)}`);
  }
});

// TST-894305 · level: release · module: MOD-site-frame, MOD-review-pages
// guards: AN ARCHITECTURE CHANGE IS NOT ACCEPTED WITHOUT AN IMPACT LIST; EVERY PAGE SHARES ONE LOOK AND WORKS ON A PHONE; UC-023
// given: the two files' pages and Review all, in the light scheme at 1280 px and 390 px
// input: each impact list's drawn height and its right edge, and whether the page scrolls sideways
// expect: the list is no taller than its computed max-height, lies inside the window's width, and the page has no sideways scroll; the planted box with no rule is taller than 420 px (the known positive that a list without the rule grows the page)
// Planted fault: look.css without the rule of .change-impact, with the rule only inside @media (max-width: 599px) or under `table .change-impact` lets the list grow to its full height and the case fails on the height; overflow: hidden and max-height: 4000px leave this case as it is.
test("TST-894305 the impact list keeps within its max-height and the window's width", () => {
  for (const [name, width] of CONDITIONS) {
    const plain = plantedBox(name, "planted-plain");
    assert.equal(plain.scrollHeight > 420, true, `${name}: known positive, a long list with no rule grows to ${plain.scrollHeight} px`);
    for (const [address] of [...FILE_PAGES, [ALL]]) {
      const page = pageOf(name, address);
      assert.equal(page.pageScrollsSideways, false, `${name}: ${address} scrolls sideways`);
      for (const box of page.boxes) {
        assert.equal(box.height <= Number.parseFloat(box.maxHeight) + 0.5, true, `${name}: ${address}: the list is ${box.height} px high, its max-height is ${box.maxHeight}`);
        assert.equal(box.right <= width && box.left >= 0, true, `${name}: ${address}: the list lies from ${box.left} to ${box.right} in a window ${width} px wide`);
      }
    }
  }
});
