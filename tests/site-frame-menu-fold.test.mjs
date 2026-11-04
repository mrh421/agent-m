// MOD-site-frame's menu.mjs draws the button that folds the menu on a narrow screen (foldMenu): a button named Menu, which the entry pages put
// right before the menu, which controls it and states its fold in aria-expanded, turned by each click. Where the button is shown and the menu hidden is look.css's, measured
// in a browser by TST-920001, TST-920002 and TST-1191002 (tests/site-usability.test.mjs).
//
// Run: node --test tests/site-frame-menu-fold.test.mjs
//
// Module: MOD-site-frame
// Guards: UC-046; EVERY PAGE SHARES ONE LOOK AND WORKS ON A PHONE
// Level: unit
//
// The expected values are written here from UC-046 step 2 — "a click unfolds the eight entries, and a second click folds them again" — and none
// is read from a document. The page is the fixture DOM of tests/site-frame-dom.mjs.

import assert from "node:assert/strict";
import test from "node:test";
import { document } from "./site-frame-dom.mjs";

const { foldMenu } = await import("../src/site-frame/menu.mjs");

// A header as both entry pages have it: an inner box holding the brand and the menu.
function header(menuId = null) {
  const inner = document.createElement("div");
  const brand = document.createElement("a");
  const menu = document.createElement("nav");
  menu.setAttribute("class", "menu");
  if (menuId) menu.setAttribute("id", menuId);
  inner.append(brand, menu);
  return { inner, menu };
}
const click = (node) => node.dispatchEvent(new Event("click"));
const name = (button) => button.childNodes.filter((node) => !(node.nodeType === 1 && node.getAttribute("aria-hidden") === "true"))
  .map((node) => node.textContent).join("").trim();

// TST-1191001 · level: unit · module: MOD-site-frame
// guards: UC-046
// given: a header whose menu has the id "tabs", as the review pages' has
// input: foldMenu(menu), its button put before the menu as docs/index.html's start does; the button clicked once, then again
// expect: a <button type="button" class="menu-button btn"> named "Menu", with aria-controls "tabs" and aria-expanded "false"; after the first click aria-expanded is "true", after the second "false"
test("TST-1191001 foldMenu makes the Menu button that controls the menu and turns aria-expanded with each click", () => {
  const { inner, menu } = header("tabs");
  const button = foldMenu(menu);
  inner.insertBefore(button, menu);
  assert.equal(button.localName, "button");
  assert.equal(button.getAttribute("type"), "button");
  assert.equal(button.getAttribute("class"), "menu-button btn");
  assert.equal(name(button), "Menu");
  assert.equal(button.getAttribute("aria-controls"), "tabs");
  assert.equal(button.getAttribute("aria-expanded"), "false");
  click(button);
  assert.equal(button.getAttribute("aria-expanded"), "true");
  click(button);
  assert.equal(button.getAttribute("aria-expanded"), "false");
});

// TST-1191003 · level: unit · module: MOD-site-frame
// guards: UC-046
// given: a header whose menu has no id, as the main page's is drawn
// input: foldMenu(menu)
// expect: the menu is given the id "site-menu", and the button's aria-controls names it
test("TST-1191003 foldMenu gives a menu without an id the id site-menu, which the button controls", () => {
  const { menu } = header();
  const button = foldMenu(menu);
  assert.equal(menu.getAttribute("id"), "site-menu");
  assert.equal(button.getAttribute("aria-controls"), "site-menu");
});
