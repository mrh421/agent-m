// Every route of the instance's site, drawn in a browser and checked against WCAG 2.2 level A and AA by axe-core: no violation. The routes
// that violate a rule today are named as todos, each with its route and its rules; a planted button without a name and a planted image
// without a text alternative each fail the same check.
// Run: node --test tests/site-accessibility.test.mjs
//
// Module: MOD-site-frame
// Guards: THE SITE SERVES A SCREEN READER
// Level: system
//
// The expected results are written here from the requirement's check — "an automatic check of each route against WCAG 2.2 level AA finds
// no violation; counter-proof: a planted button without a name fails" — and none is read from a document. Readings taken where the
// check leaves one open, each adding no word to it:
//   - "Each route" is read as tests/site-usability.test.mjs reads it: the routes of tests/site-usability.d/routes.mjs, drawn in the
//     same engine (tests/site-usability.d/browser.mjs) over the same fixture product, at a phone's width (390 px) and a desktop's (1280 px).
//   - "An automatic check ... against WCAG 2.2 level AA" is axe-core, at the exact version of tests/site-usability.d/axe.mjs, run with the
//     tags wcag2a, wcag2aa, wcag21a, wcag21aa and wcag22aa — level A is part of "level AA". Only violations count; axe-core's
//     "incomplete" results, which it leaves to a person, are not violations.
//   - The checker reaches the test as Electron does: `npm install --no-save` into a folder of the test run's temporary directory. It is no
//     file of the site, so NO SERVER's channels do not apply, and no list of packages of the repository names it.
// A route's violation is a todo: the test of the route asserts that there is none, fails today, and names the rules. Each fix is an item
// of the route's module.

import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { stageElectron, openWindow, configure, withStderr } from "./site-usability.d/browser.mjs";
import { serveSite, REPO } from "./site-usability.d/site.mjs";
import { files, history, pullsHandler, tagsHandler } from "./site-usability.d/product.mjs";
import { ROUTES, CASES, OBSERVE, show, testId } from "./site-usability.d/routes.mjs";
import { axeSource, AXE_VERSION, RUN_AXE } from "./site-usability.d/axe.mjs";
import { unrenderedFindings } from "./site-usability.d/inspect.mjs";

const WIDTHS = [["phone", 390], ["desktop", 1280]];

// What the pages violate today, as measured in the controlled Electron (the CI's run is the reference): the rules of axe-core, each with
// what it found, and per route the rules it violates at one width or the other. Each is a todo until the module of its route fixes it.
const RULE = {
  contrast: "color-contrast: the text of a superseded status badge (.b-superseded) is below the contrast AA asks",
  scroll: "scrollable-region-focusable: a box that scrolls cannot be reached with the keyboard",
  target: "target-size: a return link is smaller than 24 px",
};
const PER_ROUTE = {
  "/": [],
  "#use-case/id=draft": [],
  "#spec-entry/id=spec-2026-10-18_sample-01/edit=1": [],
  "#backlog": [],
};
const TODAY = Object.fromEntries(ROUTES.map((route) => [route.address, (PER_ROUTE[route.address] ?? ["menu"]).map((rule) => RULE[rule]).join("; ")]));

// Each tick box of the page in <main>: the identifier of its row, and its name as a browser takes it for a checkbox — its aria-label, else the text of the label it stands in.
const TICKS = `[...document.querySelectorAll("main input[type=checkbox]")].map((box) => ({ row: box.closest("tr")?.getAttribute("data-id") ?? "",
  name: (box.getAttribute("aria-label") ?? box.closest("label")?.textContent ?? "").trim() }))`;
// The two standalone return controls are measured beside the existing axe result, in this test's own collector: their exact
// public label, fragment and rendered presence make the focused target-size assertions non-vacuous.
const RETURN_CONTROLS = `[...document.querySelectorAll("main a[href]")].map((anchor) => {
  const box = anchor.getBoundingClientRect(), style = getComputedStyle(anchor);
  return { href: anchor.getAttribute("href"), label: anchor.textContent.replace(/\\s+/g, " ").trim(),
    visible: style.display !== "none" && style.visibility !== "hidden" && box.width > 0 && box.height > 0 };
})`;
const READ_FIRST = { "#uc": "#review/uc", "#arc": "#review/arc", "#module": "#review/arc" };
const found = new Map(); // "<address> <width name>" -> { violations: [{ id, impact, nodes, first }], text, ticks, returnControls }
const planted = {};
let site = null, browser = null;
const started = Date.now();
const progress = (step) => console.log(`site-accessibility ${((Date.now() - started) / 1000).toFixed(1)} s: ${step}`);

// A failure after the window opened carries the tail of the browser child's stderr (withStderr), which nothing else writes.
const setUp = async () => {
  const axe = axeSource();
  progress(`axe-core ${AXE_VERSION} is staged`);
  site = await serveSite({ files: await files(), history: await history(), handlers: [pullsHandler(REPO), tagsHandler(REPO)] });
  const executable = await stageElectron();
  browser = await openWindow(executable, `${site.address}/__blank`);
  const page = browser.page;
  await configure(page, "Page.addScriptToEvaluateOnNewDocument", { source: OBSERVE });
  // axe-core is added to the document after the page has drawn, so that its script is no part of what is checked.
  const check = async () => {
    await page.evaluate(`typeof axe === "undefined" ? (0, eval)(${JSON.stringify(axe)}) : 0`);
    return await page.evaluate(RUN_AXE);
  };
  for (const [kind, width] of WIDTHS) {
    await configure(page, "Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: kind === "phone" });
    for (const route of ROUTES) {
      // A list offers a tick for a file its page has shown: the lists with ticks are drawn after the review page that shows their files.
      if (READ_FIRST[route.address]) await show(page, site, READ_FIRST[route.address]);
      await show(page, site, route.address);
      found.set(`${route.address} ${kind}`, { violations: await check(), text: await page.evaluate(`(document.querySelector("main")?.innerText ?? "").replace(/\\s+/g, " ")`),
        ticks: await page.evaluate(TICKS), diagrams: await page.evaluate(`(${unrenderedFindings})()`),
        boxes: await page.evaluate(`[...document.querySelectorAll("main pre.diff")].map((box) => box.getAttribute("tabindex"))`),
        supersededBadges: await page.evaluate(`[...document.querySelectorAll("main .b-superseded")].map((badge) => badge.textContent.replace(/\\s+/g, " ").trim())`),
        returnControls: await page.evaluate(RETURN_CONTROLS) });
    }
    progress(`every route is checked at a ${kind}'s width`);
  }
  // The counter-proofs: a page as it is, then the same page with a button without a name and an image without a text alternative planted.
  await configure(page, "Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
  await show(page, site, "#how");
  planted.before = await check();
  await page.evaluate(`document.querySelector("main").insertAdjacentHTML("beforeend",
    '<p><button id="planted-button"></button> <img id="planted-image" src="data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw=="></p>')`);
  planted.after = await check();
  // The same page with a tick box without a name planted besides: the counter-proof of the tick boxes' name.
  await page.evaluate(`document.querySelector("main").insertAdjacentHTML("beforeend", '<p><input type="checkbox" id="planted-tick"></p>')`);
  planted.afterTick = await check();
  // The same page with a block that did not render planted, as `renderMermaid` returns one for a diagram that fails.
  planted.diagramsBefore = await page.evaluate(`(${unrenderedFindings})()`);
  await page.evaluate(`document.querySelector("main").insertAdjacentHTML("beforeend",
    '<div id="planted-unrendered" class="unrendered"><p>Diagram error: planted</p><pre><code>flowchart LR</code></pre></div>')`);
  planted.diagramsAfter = await page.evaluate(`(${unrenderedFindings})()`);
  // The same page with a box that scrolls and cannot take focus planted besides: the counter-proof of the rule scrollable-region-focusable.
  await page.evaluate(`document.querySelector("main").insertAdjacentHTML("beforeend",
    '<div id="planted-scroll" style="height:40px;overflow:auto"><p>one</p><p>two</p><p>three</p><p>four</p><p>five</p><p>six</p><p>seven</p><p>eight</p></div>')`);
  planted.afterScroll = await check();
  // The counter-proof of the difference box: the same page with a difference box that scrolls and has no tabindex planted besides.
  await page.evaluate(`document.querySelector("main").insertAdjacentHTML("beforeend",
    '<pre class="diff" id="planted-diff" style="overflow:auto;width:80px;height:24px">a line of a difference that is much longer than the box that holds it, so that the box scrolls</pre>')`);
  planted.afterBox = await check();
  // The same page with a link planted besides whose accessible name is not its visible text: the counter-proof of the rule label-content-name-mismatch.
  await page.evaluate(`document.querySelector("main").insertAdjacentHTML("beforeend",
    '<p><a id="planted-brand" href="#how" aria-label="The main page — Agent M">Agent M requirements-driven software engineering</a></p>')`);
  planted.afterBrand = await check();
  progress("the counter-proofs are checked");
  for (const [key, value] of found) console.log(`site-accessibility ${key}: ${value.violations.map((each) => `${each.id}/${each.impact}/${each.nodes}[${each.first.slice(0, 70)}]`).join(" ")}`);
};
before(async () => { try { await setUp(); } catch (failure) { throw browser ? withStderr(failure, browser.stderr()) : failure; } }, { timeout: 110000 });

after(async () => {
  browser?.close();
  await site?.close();
});

for (const route of ROUTES) {
  test(`${testId(905, route.ids[905].drawn)}: ${route.address} was drawn, with its content, at both widths`, () => {
    for (const [kind] of WIDTHS) {
      const result = found.get(`${route.address} ${kind}`);
      assert.ok(result.text.includes(route.shows), `${route.address} at a ${kind}'s width shows "${route.shows}"; it shows: ${result.text.slice(0, 200)}`);
    }
  });
}

// TST-1174001 · level: system · module: MOD-site-frame
// guards: THE SITE SERVES A SCREEN READER
// given: the live #backlog route at the existing 390 px phone and 1280 px desktop widths
// input: axe-core color-contrast violations and the rendered .b-superseded status badge
// expect: the badge is present and color-contrast is [] at both widths
test("TST-1174001 the backlog's waiting-state badge is present and has no axe color-contrast violation at both widths", () => {
  for (const [kind] of WIDTHS) {
    const result = found.get(`#backlog ${kind}`);
    assert.ok(result.supersededBadges.length > 0, `#backlog at a ${kind}'s width renders a .b-superseded waiting-state badge`);
    assert.deepEqual(result.violations.filter((violation) => violation.id === "color-contrast"), [], `#backlog at a ${kind}'s width violates color-contrast`);
  }
});

for (const route of ROUTES) {
  const today = TODAY[route.address];
  test(`${testId(905, route.ids[905].wcag)}: ${route.address} meets WCAG 2.2 level AA`,
    today ? { todo: `FINDING ${route.address} - ${today}` } : {}, () => {
      for (const [kind] of WIDTHS) {
        const violations = found.get(`${route.address} ${kind}`).violations;
        assert.deepEqual(violations.map((each) => `${each.id} (${each.nodes}: ${each.first})`), [], `${route.address} at a ${kind}'s width violates`);
      }
    });
}

// TST-1173003 · level: system · module: MOD-review-pages
// guards: EVERY PAGE SHARES ONE LOOK AND WORKS ON A PHONE; THE SITE SERVES A SCREEN READER
// given: the live #use-case/id=draft route at the existing 390 px phone and 1280 px desktop widths
// input: axe-core target-size violations and the rendered All use cases return control
// expect: the literal href #use-case, label All use cases, visible true, and target-size [] at both widths
test("TST-1173003 the use-case drafting page's All use cases return control is visible and has no axe target-size violation at both widths", () => {
  for (const [kind] of WIDTHS) {
    const result = found.get(`#use-case/id=draft ${kind}`);
    const control = result.returnControls.find((entry) => entry.label === "All use cases");
    assert.deepEqual(control, { href: "#use-case", label: "All use cases", visible: true }, `#use-case/id=draft at a ${kind}'s width renders its return control`);
    assert.deepEqual(result.violations.filter((violation) => violation.id === "target-size"), [], `#use-case/id=draft at a ${kind}'s width violates target-size`);
  }
});

// TST-1173004 · level: system · module: MOD-review-pages
// guards: EVERY PAGE SHARES ONE LOOK AND WORKS ON A PHONE; THE SITE SERVES A SCREEN READER
// given: the live #spec-entry/id=spec-2026-10-18_sample-01/edit=1 route at the existing 390 px phone and 1280 px desktop widths
// input: axe-core target-size violations and the rendered Back to the entry return control
// expect: the literal href #spec-entry/id=spec-2026-10-18_sample-01, label Back to the entry, visible true, and target-size [] at both widths
test("TST-1173004 the specification-entry editor's Back to the entry control is visible and has no axe target-size violation at both widths", () => {
  for (const [kind] of WIDTHS) {
    const result = found.get(`#spec-entry/id=spec-2026-10-18_sample-01/edit=1 ${kind}`);
    const control = result.returnControls.find((entry) => entry.label === "Back to the entry");
    assert.deepEqual(control, { href: "#spec-entry/id=spec-2026-10-18_sample-01", label: "Back to the entry", visible: true }, `#spec-entry/id=spec-2026-10-18_sample-01/edit=1 at a ${kind}'s width renders its return control`);
    assert.deepEqual(result.violations.filter((violation) => violation.id === "target-size"), [], `#spec-entry/id=spec-2026-10-18_sample-01/edit=1 at a ${kind}'s width violates target-size`);
  }
});

// TST-922001 · level: system · module: MOD-site-frame
// guards: THE SITE SERVES A SCREEN READER
// given: the public Frame routes at phone and desktop widths in the existing Electron and axe check
// input: aria-required-children in the menu on every route, color-contrast on #arc, #module and #backlog, and target-size on the phone-width explanation summaries of #use-case/id=UC-002/edit=1, #decision/id=ARC-001/edit=1 and #module/id=MOD-reader/edit=1
// expect: the menu, those accepted badges and those three explanation summaries have no named violation
test("TST-922001 the shared menu, accepted badges and folded explanations have no remaining Frame accessibility violation", () => {
  for (const route of ROUTES) {
    for (const [kind] of WIDTHS) {
      const rules = ["aria-required-children"];
      if (["#arc", "#module", "#backlog"].includes(route.address)) rules.push("color-contrast");
      if (kind === "phone" && ["#use-case/id=UC-002/edit=1", "#decision/id=ARC-001/edit=1", "#module/id=MOD-reader/edit=1"].includes(route.address)) rules.push("target-size");
      const violations = found.get(`${route.address} ${kind}`).violations.filter((each) => rules.includes(each.id)
        && (each.id !== "color-contrast" || each.first.includes(".b-accepted")));
      assert.deepEqual(violations.map((each) => `${each.id} (${each.nodes}: ${each.first})`), [], `${route.address} at a ${kind}'s width violates`);
    }
  }
});

// The page the counter-proofs plant in, as it is, has no violation of the two rules the plants break — the known positive.
test(`${testId(905, CASES[905].plantedBefore)}: the page before the planting has no violation of button-name or image-alt`, () => {
  assert.equal(planted.before.some((each) => each.id === "button-name" || each.id === "image-alt"), false);
});

test(`${testId(905, CASES[905].plantedButton)}: a planted button without a name fails the check with the rule button-name`, () => {
  const rule = planted.after.find((each) => each.id === "button-name");
  assert.ok(rule, `violations: ${planted.after.map((each) => each.id).join(", ")}`);
  assert.ok(rule.first.includes("planted-button"), `the first node is ${rule.first}`);
});

test(`${testId(905, CASES[905].plantedImage)}: a planted image without a text alternative fails the check with the rule image-alt`, () => {
  const rule = planted.after.find((each) => each.id === "image-alt");
  assert.ok(rule, `violations: ${planted.after.map((each) => each.id).join(", ")}`);
});

// ITM-921: the tick boxes of the review pages' lists (MOD-review-pages). The routes whose lists draw them; `#spec` draws none in this fixture.
const LISTS = ["#uc", "#arc", "#module", "#spec"];
const TICKED = ["#uc", "#arc", "#module"];

// TST-905068 · level: system · module: MOD-site-frame
// guards: THE SITE SERVES A SCREEN READER
// given: every list route drawn at both widths
// input: axe-core's rule `label` over each
// expect: no violation of it (the whole-page tests above stay todos while the menu, a badge or a box violates)
test(`${testId(905, CASES[905].labels)}: the tick boxes of the lists ${LISTS.join(", ")} have an accessible name (rule label)`, () => {
  for (const address of LISTS) {
    for (const [kind] of WIDTHS) {
      const violations = found.get(`${address} ${kind}`).violations.filter((each) => each.id === "label").map((each) => `${each.id} (${each.nodes}: ${each.first})`);
      assert.deepEqual(violations, [], `${address} at a ${kind}'s width violates`);
    }
  }
});

// TST-905069 · level: system · module: MOD-site-frame
// guards: THE SITE SERVES A SCREEN READER
// given: the lists #uc, #arc and #module, which hold open files
// input: the tick boxes in <main>
// expect: the list draws at least one (the known positive that the rule above has something to check), and each one's name holds the identifier of its row, the file it accepts
test(`${testId(905, CASES[905].ticks)}: each tick box of the lists ${TICKED.join(", ")} names the file it accepts`, () => {
  for (const address of TICKED) {
    for (const [kind] of WIDTHS) {
      const ticks = found.get(`${address} ${kind}`).ticks;
      assert.ok(ticks.length > 0, `${address} at a ${kind}'s width draws a tick box`);
      assert.deepEqual(ticks.filter((tick) => !tick.name.includes(tick.row)).map((tick) => `${tick.row}: "${tick.name}"`), [], `${address} at a ${kind}'s width`);
    }
  }
});

// The counter-proof: the page before the planting has no violation of label; with a tick box without a name planted, the rule label finds it.
test(`${testId(905, CASES[905].tickBefore)}: the page before the planting has no violation of label`, () => {
  assert.equal(planted.before.some((each) => each.id === "label"), false);
});

test(`${testId(905, CASES[905].plantedTick)}: a planted tick box without a name fails the check with the rule label`, () => {
  const rule = planted.afterTick.find((each) => each.id === "label");
  assert.ok(rule, `violations: ${planted.afterTick.map((each) => each.id).join(", ")}`);
  assert.ok(rule.first.includes("planted-tick"), `the first node is ${rule.first}`);
});

// A diagram that failed (ITM-927). A page whose diagram fails shows its source and the reason in a block with the class `unrendered`; a screen
// reader meets that text where the diagram should be, so the route's check names each such block.
// given: every route drawn at both widths; input: the blocks of the page with the class `unrendered`; expect: none
for (const route of ROUTES) {
  test(`${testId(905, route.ids[905].diagrams)}: ${route.address} holds no block that did not render, such as a diagram that failed`, () => {
    for (const [kind] of WIDTHS) {
      const blocks = found.get(`${route.address} ${kind}`).diagrams;
      assert.deepEqual(blocks, [], `${route.address} at a ${kind}'s width: ${blocks.join("; ")}`);
    }
  });
}

// The counter-proof: the page before the planting has no such block; with a failed diagram planted, the check names it with its reason.
test(`${testId(905, CASES[905].diagramBefore)}: the page before the planting holds no block that did not render`, () => {
  assert.deepEqual(planted.diagramsBefore, []);
});

test(`${testId(905, CASES[905].diagramAfter)}: a planted failed diagram fails the check and is named with its reason`, () => {
  assert.deepEqual(planted.diagramsAfter, ['a block that did not render: "Diagram error: planted"']);
});

// ITM-931: the editor's preview (MOD-markdown-render) is the box that scrolls on the edit pages.
const EDITS = ["#use-case/id=UC-002/edit=1", "#decision/id=ARC-001/edit=1", "#module/id=MOD-reader/edit=1"];

// TST-905106 · level: system · module: MOD-site-frame
// guards: THE SITE SERVES A SCREEN READER
// given: the edit pages of a use case, an architecture decision and a module file, drawn at both widths
// input: axe-core's rule `scrollable-region-focusable` over each
// expect: no violation of it (the whole-page tests above stay todos while the menu or a summary violates)
test(`${testId(905, CASES[905].scrollEdits)}: no box that scrolls on the edit pages ${EDITS.join(", ")} is out of the keyboard's reach (rule scrollable-region-focusable)`, () => {
  for (const address of EDITS) {
    for (const [kind] of WIDTHS) {
      const violations = found.get(`${address} ${kind}`).violations.filter((each) => each.id === "scrollable-region-focusable").map((each) => `${each.id} (${each.nodes}: ${each.first})`);
      assert.deepEqual(violations, [], `${address} at a ${kind}'s width violates`);
    }
  }
});

// The counter-proof: the page before the planting has no violation of scrollable-region-focusable; with a box that scrolls and has no tabindex planted, the rule finds it.
test(`${testId(905, CASES[905].scrollBefore)}: the page before the planting has no violation of scrollable-region-focusable`, () => {
  assert.equal(planted.before.some((each) => each.id === "scrollable-region-focusable"), false);
});

test(`${testId(905, CASES[905].plantedScroll)}: a planted box that scrolls and cannot be focused fails the check with the rule scrollable-region-focusable`, () => {
  const rule = planted.afterScroll.find((each) => each.id === "scrollable-region-focusable");
  assert.ok(rule, `violations: ${planted.afterScroll.map((each) => each.id).join(", ")}`);
  assert.ok(rule.first.includes("planted-scroll"), `the first node is ${rule.first}`);
});

// The difference box of a changed file (ITM-933). The fixture holds a use case changed since it was accepted, so that its page and Review all draw
// the box of its difference to the last accepted text (`pre.diff`), which a person with a keyboard must be able to reach (ITM-921: tabindex 0).
const CHANGED = ["#uc/UC-001", "#review/uc"];

// TST-905109 · level: system · module: MOD-site-frame
// guards: THE SITE SERVES A SCREEN READER
// given: the routes that draw the changed use case, at both widths
// input: each `pre.diff` in <main>
// expect: the route draws at least one (the known positive that the whole-page checks meet the box), and each has tabindex "0"
test(`${testId(905, CASES[905].changedKeyboard)}: the pages of the changed use case draw a difference box that the keyboard reaches`, () => {
  for (const address of CHANGED) {
    for (const [kind] of WIDTHS) {
      const boxes = found.get(`${address} ${kind}`).boxes;
      assert.equal(boxes.length > 0, true, `${address} at a ${kind}'s width draws a difference box`);
      assert.deepEqual(boxes.filter((tabindex) => tabindex !== "0"), [], `${address} at a ${kind}'s width: boxes without tabindex 0`);
    }
  }
});

// TST-905110 · level: system · module: MOD-site-frame
// guards: THE SITE SERVES A SCREEN READER
// given: the routes that draw the box, at both widths
// input: axe-core's rule scrollable-region-focusable over each
// expect: no violation of it
test(`${testId(905, CASES[905].changedRule)}: the difference box of the changed use case meets the rule scrollable-region-focusable`, () => {
  for (const address of CHANGED) {
    for (const [kind] of WIDTHS) {
      const violations = found.get(`${address} ${kind}`).violations.filter((each) => each.id === "scrollable-region-focusable").map((each) => `${each.id} (${each.nodes}: ${each.first})`);
      assert.deepEqual(violations, [], `${address} at a ${kind}'s width violates`);
    }
  }
});

// The counter-proof: with a difference box that scrolls and has no tabindex planted beside the planted scrolling box, the rule finds one node more.
test(`${testId(905, CASES[905].plantedDiff)}: a planted difference box that scrolls and cannot be focused is found by the rule scrollable-region-focusable`, () => {
  const before = planted.afterScroll.find((each) => each.id === "scrollable-region-focusable");
  const after = planted.afterBox.find((each) => each.id === "scrollable-region-focusable");
  assert.ok(before && after, "the rule finds the planted boxes");
  assert.equal(after.nodes, before.nodes + 1);
});

// The brand link (ITM-923). Its accessible name must hold the text it shows (WCAG 2.5.3, the rule label-content-name-mismatch), so that a person who speaks to the page by what they read can reach it.
// The counter-proof: the page before the planting has no violation of the rule; with a link planted whose aria-label does not begin with the text it shows, the rule finds it.
test(`${testId(905, CASES[905].plantedBrand)}: a planted link whose accessible name lacks its visible text is found by the rule label-content-name-mismatch`, () => {
  assert.equal(planted.afterBox.some((each) => each.id === "label-content-name-mismatch"), false, "known positive: the page before the planting has no violation of the rule");
  const rule = planted.afterBrand.find((each) => each.id === "label-content-name-mismatch");
  assert.ok(rule, `violations: ${planted.afterBrand.map((each) => each.id).join(", ")}`);
  assert.ok(rule.first.includes("planted-brand"), `the first node is ${rule.first}`);
});
