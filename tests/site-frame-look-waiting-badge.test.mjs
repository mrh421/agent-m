// MOD-site-frame's look.css colours the badge of a status by the class b-<status>. A SPEC entry in the state "waiting for its anchor" is drawn by the review pages
// with the class b-waiting-for-its-anchor (src/review-pages/spec-entries.mjs gives the status, src/review-pages/common.mjs badge makes the class); look.css has to colour it,
// in colours of its own and ones that meet the contrast WCAG 2.2 level AA asks of text (4.5:1, the ratio tests/site-accessibility.test.mjs checks the other badges against).
// Run: node --test tests/site-frame-look-waiting-badge.test.mjs
//
// Module: MOD-site-frame
// Guards: UC-006; THE SITE SERVES A SCREEN READER
// Level: unit
//
// The expected values are written here from the item's Acceptance ("a class that look.css colours, distinct from accepted") and from WCAG 2.2 success criterion 1.4.3 (4.5:1 for
// normal text), and none is read from a document. Readings taken where the texts leave one open:
//   - "colours" is read as the declarations `color` and `background` of the class's rule, given as hex literals, the form of the rules of .b-accepted and .b-superseded in look.css; a
//     colour given by a variable has no value look.css alone holds, so the contrast cannot be computed from it.
//   - "distinct from accepted" is read as: the text colour and the background are each different from those of .b-accepted.
// The rule is found by a reader of look.css's text that is shown on the rule of .b-accepted, which look.css has (the known positive), and on a planted stylesheet without the rule of the
// class under test (the counter-proof), so that a "not found" is a finding about the stylesheet and not about the reader.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const LOOK = readFileSync(fileURLToPath(new URL("../src/site-frame/look.css", import.meta.url)), "utf8");
const WAITING = ".b-waiting-for-its-anchor";
const ACCEPTED = ".b-accepted";
const MINIMUM_CONTRAST = 4.5;

// The colours `{ color, background }` of the first rule of `css` whose selector list names `selector` (a leading `body ` of a selector is the rule's weight and is ignored), or null.
function coloursOf(css, selector) {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, "");
  for (const [, selectors, body] of text.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (!selectors.split(",").map((each) => each.trim().replace(/^body\s+/, "")).includes(selector)) continue;
    const declaration = (property) => body.match(new RegExp(`(?:^|;|\\s)${property}\\s*:\\s*(#[0-9a-fA-F]{3,8})\\b`))?.[1]?.toLowerCase() ?? null;
    return { color: declaration("color"), background: declaration("background") };
  }
  return null;
}

// WCAG 2.2's relative luminance and contrast ratio of two opaque hex colours.
function luminance(hex) {
  const full = hex.length === 4 ? `#${[...hex.slice(1)].map((digit) => digit + digit).join("")}` : hex;
  const [red, green, blue] = [1, 3, 5].map((at) => parseInt(full.slice(at, at + 2), 16) / 255)
    .map((channel) => (channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4));
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}
const contrast = (a, b) => {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
};

// The finding about a stylesheet: what is wrong with its rule of `selector` as a coloured badge, or null when nothing is.
function findingAbout(css, selector) {
  const own = coloursOf(css, selector);
  if (!own) return `no rule colours ${selector}`;
  if (!own.color || !own.background) return `the rule of ${selector} gives no hex color and background: ${JSON.stringify(own)}`;
  return null;
}
function distinctFromAccepted(css, selector) {
  const own = coloursOf(css, selector), accepted = coloursOf(css, ACCEPTED);
  return own !== null && accepted !== null && own.color !== accepted.color && own.background !== accepted.background;
}
const contrastOf = (css, selector) => { const own = coloursOf(css, selector); return own?.color && own.background ? contrast(own.color, own.background) : 0; };

// The stylesheet without the rule of WAITING, and a stylesheet whose rule of WAITING repeats the colours of ACCEPTED, and one whose rule has too little contrast.
const without = LOOK.replace(/[^{}\n]*\.b-waiting-for-its-anchor[^{}]*\{[^{}]*\}\s*/g, "");
const asAccepted = `${without}\n${WAITING} { color: ${coloursOf(LOOK, ACCEPTED).color}; background: ${coloursOf(LOOK, ACCEPTED).background}; }\n`;
const pale = `${without}\n${WAITING} { color: #bbbbbb; background: #ffffff; }\n`;

// TST-886001 · level: unit · module: MOD-site-frame
// guards: UC-006; THE SITE SERVES A SCREEN READER
// given: src/site-frame/look.css as committed, and the rule of .b-accepted, which it has
// input: the reader of look.css's rules, asked for the colours of .b-accepted (the known positive) and of .b-waiting-for-its-anchor
// expect: .b-accepted is found with a hex color and a hex background; .b-waiting-for-its-anchor is found with a hex color and a hex background (no finding)
test("TST-886001 look.css colours b-waiting-for-its-anchor, the class a SPEC entry waiting for its anchor is drawn with", () => {
  assert.equal(findingAbout(LOOK, ACCEPTED), null, "the reader finds the rule of .b-accepted, which look.css has");
  assert.equal(findingAbout(LOOK, WAITING), null, "look.css colours .b-waiting-for-its-anchor");
});

// TST-886002 · level: unit · module: MOD-site-frame
// guards: UC-006; THE SITE SERVES A SCREEN READER
// given: a planted stylesheet holding the rule of .b-accepted only, and the same stylesheet with a rule of .b-waiting-for-its-anchor added (a comment names the class in the first, as look.css's comments name classes)
// input: the reader of rules, asked for the colours of .b-waiting-for-its-anchor in each
// expect: the first gives the finding "no rule colours .b-waiting-for-its-anchor" although its comment names the class, and still finds .b-accepted; the second gives no finding
test("TST-886002 counter-proof: a stylesheet without a rule of b-waiting-for-its-anchor is found to have none", () => {
  const planted = "/* .b-waiting-for-its-anchor { color: #000000; background: #ffffff; } */\nbody .b-accepted { color: #155724; background: #d4edda; }\n";
  assert.equal(findingAbout(planted, ACCEPTED), null, "the reader finds .b-accepted in the planted stylesheet");
  assert.equal(findingAbout(planted, WAITING), `no rule colours ${WAITING}`);
  assert.equal(findingAbout(`${planted}.b-stale, ${WAITING} { color: #5c4300; background: #fff3cd; }\n`, WAITING), null);
});

// TST-886003 · level: unit · module: MOD-site-frame
// guards: UC-006; THE SITE SERVES A SCREEN READER
// given: src/site-frame/look.css as committed; for the counter-proof a copy whose rule of .b-waiting-for-its-anchor repeats the color and background of .b-accepted
// input: whether the rule of .b-waiting-for-its-anchor has a color and a background that both differ from those of .b-accepted
// expect: true for the committed look.css; false for the copy that repeats accepted's colours
test("TST-886003 the colours of b-waiting-for-its-anchor are distinct from those of b-accepted", () => {
  assert.equal(distinctFromAccepted(asAccepted, WAITING), false, "counter-proof: a rule with accepted's colours is not distinct");
  assert.equal(distinctFromAccepted(LOOK, WAITING), true, "look.css gives .b-waiting-for-its-anchor colours of its own");
});

// TST-886004 · level: unit · module: MOD-site-frame
// guards: UC-006; THE SITE SERVES A SCREEN READER
// given: src/site-frame/look.css as committed; for the counter-proof a copy whose rule gives #bbbbbb on #ffffff, a ratio under 4.5:1
// input: the contrast ratio of the color on the background of the rule of .b-waiting-for-its-anchor, computed as WCAG 2.2 defines it; the known positive is the ratio of .b-accepted
// expect: the ratio of .b-accepted is at least 4.5; the pale copy's ratio is under 4.5; the committed rule's ratio is at least 4.5
test("TST-886004 the colours of b-waiting-for-its-anchor meet the contrast WCAG 2.2 AA asks of text", () => {
  assert.ok(contrastOf(LOOK, ACCEPTED) >= MINIMUM_CONTRAST, "known positive: the badge of .b-accepted meets 4.5:1");
  assert.ok(contrastOf(pale, WAITING) < MINIMUM_CONTRAST, "counter-proof: #bbbbbb on #ffffff is under 4.5:1");
  assert.ok(contrastOf(LOOK, WAITING) >= MINIMUM_CONTRAST, `look.css colours .b-waiting-for-its-anchor at ${contrastOf(LOOK, WAITING).toFixed(2)}:1, under ${MINIMUM_CONTRAST}:1 or not at all`);
});
