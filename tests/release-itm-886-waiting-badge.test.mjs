// Release tests of ITM-886 — UC-006 on the review pages of the SPEC change entries: an entry that waits for its anchor is drawn with a badge whose colours are its own, distinct from an accepted
// entry's, and that meet the contrast WCAG 2.2 level AA asks of text. The page is drawn in a real browser (the controlled Electron of tests/site-usability.d, over the site's own style sheets and the
// fixture product of tests/site-usability.d/product.mjs with one queue added), and every colour is the computed style of the badge as the browser resolved it, never a value read from look.css.
// Run: node --test tests/release-itm-886-waiting-badge.test.mjs
//
// Module: MOD-site-frame; MOD-review-pages
// Guards: UC-006; THE SITE SERVES A SCREEN READER
// Level: release
//
// Written for the release testing of sprint 121 by a participant who implemented none of ITM-886 (RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER). The expected values are written here from the
// item's Acceptance ("The badge of an entry waiting for its anchor carries a class that `look.css` colours, distinct from accepted") and from WCAG 2.2 success criterion 1.4.3 (4.5:1 for normal
// text), and none is read from a document or from look.css. Readings taken where the texts leave one open:
//   - "an entry waiting for its anchor" is the entry of a queue that no record or decision decides, whose anchor the SPEC does not hold and an earlier entry of the queue creates (queue 2026-10-19_waiting,
//     entry 02); the fixture queue is added to the fixture product of tests/site-usability.d, beside its own queue, as the site-usability tests' own routes draw it.
//   - "an accepted entry" is read twice, since the texts name the state two ways: the entry of the same queue that a decision row has written into the SPEC, whose badge the review page draws "in SPEC" (entry 03), and
//     the badge "accepted" that the review pages draw for an accepted file (ARC-001 on #arc), which the item names (`.b-accepted`). "Distinct from" is read as: the text colour and the background each differ.
//   - "the review page where such entries are drawn" is read as the three pages that draw an entry's badge: the list (#spec-entry), one entry (#spec-entry/id=<entry>) and Review all (#spec-entry/id=all).
//   - "meet WCAG 2.2 AA text contrast" is read as a ratio of at least 4.5:1 between the badge's computed text colour and its computed background (the badge's text is below 18.66 px bold, so the large-text 3:1 does
//     not apply), computed as WCAG 2.2 defines the relative luminance, and as axe-core's rule color-contrast, at the exact version of tests/site-usability.d/axe.mjs, finds it: no violation on the badge, and the badge among the nodes it passed.
//   - The conditions are the light scheme at a desktop's width (1280 px) and a phone's (390 px), and the dark scheme at a desktop's width: the colours of the rule are not scheme-dependent, the text and background of the page are.

import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { stageElectron, openWindow, configure, withStderr } from "./site-usability.d/browser.mjs";
import { serveSite, REPO } from "./site-usability.d/site.mjs";
import { files, history, pullsHandler, tagsHandler } from "./site-usability.d/product.mjs";
import { show, OBSERVE } from "./site-usability.d/routes.mjs";
import { axeSource } from "./site-usability.d/axe.mjs";

const WAITING = "b-waiting-for-its-anchor";
const MINIMUM_CONTRAST = 4.5;
const QUEUE = "docs/spec-freigaben/2026-10-19_waiting";
const ENTRY = "spec-2026-10-19_waiting-02";
const IN_SPEC_ENTRY = "spec-2026-10-19_waiting-03";
const LIST = "#spec-entry", ONE = `#spec-entry/id=${ENTRY}`, ALL = "#spec-entry/id=all", ARC = "#arc";
const CONDITIONS = [["light desktop", 1280, "light"], ["light phone", 390, "light"], ["dark desktop", 1280, "dark"]];

// The queue: entry 01 replaces "## 1. Reading" and creates "## 1a. Added"; entry 02 starts with "## 1a. Added", which the SPEC does not hold yet, so it waits for entry 01; entry 03 is written into the SPEC by a decision row.
function queueFiles(base) {
  const spec = base["SPEC.md"];
  const reading = spec.slice(spec.indexOf("## 1. Reading"), spec.indexOf("## 2. Writing"));
  const added = "## 1a. Added\n\n**A THIRD RULE** *(PO A. Maier)*\nThe reader says what it added.\n*Check:* no automatic check; at review.\n";
  return {
    [`${QUEUE}/index.md`]: ["# SPEC approvals — queue 2026-10-19_waiting · waiting queue", "", "**Zieldatei aller Einträge:** `SPEC.md`", "",
      "| Nr | Datei | Anker (Überschrift, wortgetreu) | bis (exklusiv) | Commits |", "|---|---|---|---|---|",
      "| 1 | `SPEC.md` | ## 1. Reading | ## 2. Writing | — |", "| 2 | `SPEC.md` | ## 1a. Added | — | — |", "| 3 | `SPEC.md` | ## 2. Writing | — | — |", ""].join("\n"),
    [`${QUEUE}/01-reading.md`]: `${reading}\n${added}`,
    [`${QUEUE}/01-reading.begruendung.md`]: "# Why\n\nThe reading says what it added.\n",
    [`${QUEUE}/02-added.md`]: added.replace("added.", "added, and when."),
    [`${QUEUE}/02-added.begruendung.md`]: "# Why\n\nThe added rule says when.\n",
    [`${QUEUE}/03-writing.md`]: spec.slice(spec.indexOf("## 2. Writing")),
    [`${QUEUE}/03-writing.begruendung.md`]: "# Why\n\nThe writing is already in the SPEC.\n",
    [`${QUEUE}/entscheidungen.md`]: "# Decisions\n\nAppend-only.\n| 2026-10-19 10:00 UTC | 3 | uebernommen | abcdef1234567 |\n",
  };
}

// The badges of <main> as the browser resolved them.
const BADGES = `[...document.querySelectorAll("main .badge")].map((badge) => { const style = getComputedStyle(badge);
  return { className: badge.className, text: badge.textContent.replace(/\\s+/g, " ").trim(), row: badge.closest("tr")?.getAttribute("data-id") ?? null, color: style.color, background: style.backgroundColor }; })`;
// axe-core's rule color-contrast alone: the html of the nodes it found in violation and of those it passed.
const CONTRAST = `(async () => { const result = await axe.run(document, { runOnly: { type: "rule", values: ["color-contrast"] }, resultTypes: ["violations", "passes"] });
  const html = (list) => list.flatMap((rule) => rule.nodes.map((node) => node.html)); return { violations: html(result.violations), passes: html(result.passes) }; })()`;
const PLANT = `document.querySelector("main").insertAdjacentHTML("beforeend", '<p><span class="badge" id="planted-pale" style="color:#bbbbbb;background:#ffffff">pale</span></p>')`;

const found = new Map(); // "<condition> <route>" -> badges
const checks = new Map(); // condition -> { axe: { violations, passes }, planted: { violations, passes } }
let site = null, browser = null;

before(async () => {
  try {
    const axe = axeSource();
    const base = await files();
    site = await serveSite({ files: { ...base, ...queueFiles(base) }, history: await history(), handlers: [pullsHandler(REPO), tagsHandler(REPO)] });
    browser = await openWindow(await stageElectron(), `${site.address}/__blank`);
    const page = browser.page;
    await configure(page, "Page.addScriptToEvaluateOnNewDocument", { source: OBSERVE });
    for (const [name, width, scheme] of CONDITIONS) {
      await configure(page, "Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: width < 600 });
      await configure(page, "Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: scheme }] });
      for (const address of [ARC, ONE, ALL, LIST]) {
        await show(page, site, address);
        found.set(`${name} ${address}`, await page.evaluate(BADGES));
      }
      // The list is still shown: axe-core's rule color-contrast over it, then over it with a pale badge planted.
      await page.evaluate(`typeof axe === "undefined" ? (0, eval)(${JSON.stringify(axe)}) : 0`);
      const scanned = await page.evaluate(CONTRAST);
      await page.evaluate(PLANT);
      checks.set(name, { axe: scanned, planted: await page.evaluate(CONTRAST), plantedBadge: (await page.evaluate(BADGES)).find((badge) => badge.text === "pale") });
    }
  } catch (failure) { throw browser ? withStderr(failure, browser.stderr()) : failure; }
}, { timeout: 170000 });

after(async () => {
  browser?.close();
  await site?.close();
});

// The colours of the browser's computed style, `rgb(r, g, b)` or `rgba(r, g, b, a)`, as [r, g, b, a].
const parse = (value) => { const numbers = /^rgba?\(([^)]+)\)$/.exec(value)?.[1].split(",").map(Number); return numbers ? [numbers[0], numbers[1], numbers[2], numbers[3] ?? 1] : null; };
// WCAG 2.2's relative luminance and contrast ratio of two opaque colours.
const luminance = ([red, green, blue]) => { const [r, g, b] = [red, green, blue].map((channel) => channel / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const contrast = (a, b) => { const [light, dark] = [luminance(parse(a)), luminance(parse(b))].sort((x, y) => y - x); return (light + 0.05) / (dark + 0.05); };
const opaque = (value) => parse(value)?.[3] === 1;
const distinct = (a, b) => a.color !== b.color && a.background !== b.background;

const badges = (name, address) => found.get(`${name} ${address}`);
const waitingOn = (name, address) => badges(name, address).filter((badge) => badge.className.split(" ").includes(WAITING));
const acceptedBadge = (name) => badges(name, ARC).find((badge) => badge.text === "accepted");
const inSpecBadge = (name) => badges(name, LIST).find((badge) => badge.row === IN_SPEC_ENTRY);
const describe = (badge) => `${badge.className} "${badge.text}" ${badge.color} on ${badge.background}`;

// TST-886301 · level: release · module: MOD-site-frame, MOD-review-pages
// guards: UC-006; THE SITE SERVES A SCREEN READER
// given: the fixture product with a queue whose entry 02 waits for its anchor, its list #spec-entry drawn in a real browser over the site's style sheets, in the light scheme at 1280 px and 390 px and in the dark scheme at 1280 px
// input: the badges of <main> with their computed text colour and background; the known positive is the badge of the open entry 01 of the same queue
// expect: the row of entry 02 holds a badge of the class b-waiting-for-its-anchor reading "waiting for its anchor" whose computed background is opaque and differs from its text colour; the open entry's badge is opaque too
// Planted fault: look.css without the rule of .b-waiting-for-its-anchor leaves the badge a transparent background, and the case fails on it.
test("TST-886301 the review page draws a SPEC entry waiting for its anchor with a badge that has a colour of its own", () => {
  for (const [name] of CONDITIONS) {
    const open = badges(name, LIST).find((badge) => badge.row === "spec-2026-10-19_waiting-01");
    assert.ok(open && opaque(open.background) && open.color !== open.background, `${name}: known positive, the open entry 01 is drawn with a colour: ${open && describe(open)}`);
    const waiting = waitingOn(name, LIST).filter((badge) => badge.row === ENTRY);
    assert.ok(waiting.length > 0, `${name}: the list draws entry 02 with a badge of the class ${WAITING}: ${JSON.stringify(badges(name, LIST).map((badge) => badge.className))}`);
    for (const badge of waiting) {
      assert.equal(badge.text, "waiting for its anchor", `${name}: the badge's words`);
      assert.ok(opaque(badge.background), `${name}: ${describe(badge)} has no background colour`);
      assert.notEqual(badge.color, badge.background, `${name}: ${describe(badge)} has the colour of its own background`);
    }
  }
});

// TST-886302 · level: release · module: MOD-site-frame, MOD-review-pages
// guards: UC-006; THE SITE SERVES A SCREEN READER
// given: the list #spec-entry, with entry 03 decided into the SPEC (drawn "in SPEC"), and #arc with its accepted ARC-001 (drawn "accepted"), in the three conditions
// input: the computed text colour and background of the waiting badge, of the "in SPEC" badge and of the "accepted" badge; the known positive is that the two accepted badges are found, and the counter-proof compares a badge with itself
// expect: the waiting badge's text colour differs from the "in SPEC" badge's and from the "accepted" badge's, and so does its background; a badge compared with itself is not distinct
// Planted fault: look.css giving .b-waiting-for-its-anchor the colour and background of .b-accepted fails the comparison with the accepted badge.
test("TST-886302 the badge of an entry waiting for its anchor is distinct from the badge of an accepted entry", () => {
  for (const [name] of CONDITIONS) {
    const accepted = acceptedBadge(name), inSpec = inSpecBadge(name);
    assert.ok(accepted && inSpec, `${name}: known positive, both accepted badges are drawn: ${accepted && describe(accepted)}; ${inSpec && describe(inSpec)}`);
    assert.equal(distinct(accepted, accepted), false, "counter-proof: a badge is not distinct from itself");
    for (const waiting of waitingOn(name, LIST)) {
      assert.equal(distinct(waiting, accepted), true, `${name}: ${describe(waiting)} against the accepted badge ${describe(accepted)}`);
      assert.equal(distinct(waiting, inSpec), true, `${name}: ${describe(waiting)} against the "in SPEC" badge ${describe(inSpec)}`);
    }
  }
});

// TST-886303 · level: release · module: MOD-site-frame, MOD-review-pages
// guards: UC-006; THE SITE SERVES A SCREEN READER
// given: the list #spec-entry in the three conditions, and the same page with a badge planted whose style is #bbbbbb on #ffffff
// input: the contrast ratio of the computed text colour on the computed background, as WCAG 2.2 defines it, of the waiting badge, of the accepted badge (the known positive) and of the planted badge
// expect: the accepted badge's ratio is at least 4.5; the planted badge's is under 4.5; the waiting badge's is at least 4.5 in every condition
// Planted fault: look.css giving .b-waiting-for-its-anchor a pale colour such as #bbbbbb on #ffffff drops the ratio under 4.5, and the case fails on it.
test("TST-886303 the colours of the badge of an entry waiting for its anchor meet the contrast WCAG 2.2 AA asks of text", () => {
  for (const [name] of CONDITIONS) {
    const accepted = acceptedBadge(name), planted = checks.get(name).plantedBadge;
    assert.ok(accepted && contrast(accepted.color, accepted.background) >= MINIMUM_CONTRAST, `${name}: known positive, the accepted badge meets ${MINIMUM_CONTRAST}:1`);
    assert.ok(planted && contrast(planted.color, planted.background) < MINIMUM_CONTRAST, `${name}: counter-proof, ${planted && describe(planted)} is under ${MINIMUM_CONTRAST}:1`);
    const waiting = waitingOn(name, LIST);
    assert.ok(waiting.length > 0, `${name}: the list draws the waiting badge`);
    for (const badge of waiting) assert.ok(opaque(badge.background) && contrast(badge.color, badge.background) >= MINIMUM_CONTRAST, `${name}: ${describe(badge)} is ${opaque(badge.background) ? contrast(badge.color, badge.background).toFixed(2) : "not coloured"}:1, under ${MINIMUM_CONTRAST}:1`);
  }
});

// TST-886304 · level: release · module: MOD-site-frame
// guards: THE SITE SERVES A SCREEN READER
// given: the list #spec-entry in the three conditions, with axe-core's rule color-contrast run over the page, and over the page with a badge of #bbbbbb on #ffffff planted
// input: the nodes axe-core reports in violation of color-contrast and the nodes it passed
// expect: no violation names the waiting badge, and the waiting badge is among the passed nodes (so axe-core did check it); the planted pale badge is found in violation
// Planted fault: look.css giving .b-waiting-for-its-anchor a pale colour (#bbbbbb on #ffffff) makes axe-core report the badge, and the case fails on it.
test("TST-886304 axe-core finds no color-contrast violation on the badge of an entry waiting for its anchor", () => {
  for (const [name] of CONDITIONS) {
    const { axe, planted } = checks.get(name);
    assert.ok(planted.violations.some((html) => html.includes("planted-pale")), `${name}: counter-proof, axe-core reports the planted pale badge: ${JSON.stringify(planted.violations)}`);
    assert.deepEqual(axe.violations.filter((html) => html.includes(WAITING)), [], `${name}: axe-core finds the waiting badge in violation`);
    assert.ok(axe.passes.some((html) => html.includes(WAITING)), `${name}: axe-core checked the waiting badge and passed it: ${JSON.stringify(axe.passes.map((html) => html.slice(0, 80)))}`);
  }
});

// TST-886305 · level: release · module: MOD-site-frame, MOD-review-pages
// guards: UC-006; THE SITE SERVES A SCREEN READER
// given: the three pages that draw an entry's badge, the list #spec-entry, the entry's own page and Review all, in the three conditions
// input: the waiting badge each page draws, with its class, words and computed colours
// expect: the entry's page and Review all each draw a badge of the class b-waiting-for-its-anchor reading "waiting for its anchor" whose computed colours equal those of the list's badge
// Planted fault: look.css scoping the rule to tables (`table .b-waiting-for-its-anchor`) colours the list and leaves the entry's page and Review all uncoloured, and the case fails on them.
test("TST-886305 the entry's own page and Review all colour the waiting badge as the list does", () => {
  for (const [name] of CONDITIONS) {
    const [listed] = waitingOn(name, LIST).filter((badge) => badge.row === ENTRY);
    assert.ok(listed && opaque(listed.background), `${name}: known positive, the list's waiting badge is coloured: ${listed && describe(listed)}`);
    for (const address of [ONE, ALL]) {
      const drawn = waitingOn(name, address);
      assert.ok(drawn.length > 0, `${name}: ${address} draws a badge of the class ${WAITING}: ${JSON.stringify(badges(name, address).map((badge) => badge.className))}`);
      for (const badge of drawn) assert.deepEqual([badge.text, badge.color, badge.background], [listed.text, listed.color, listed.background], `${name}: ${address} draws ${describe(badge)}, the list ${describe(listed)}`);
    }
  }
});
