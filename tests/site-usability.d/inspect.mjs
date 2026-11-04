// What tests/site-usability.test.mjs asks of a page drawn in a browser, written as functions that run in the page: which style sheets
// it uses, which of its buttons and links are smaller than the minimum target size, and which of its elements are wider than the
// window. Each function is self-contained, since it is sent to the page as text (`${fn}`); each gives the findings as short texts that
// name the element. The rules are those of the requirement's check and of WCAG 2.2 success criteria 2.5.8 and 1.4.10; the expected
// results are stated by the test that calls them, not here.
//
// Module: MOD-site-frame
// Level: system

// styleSheetFindings() -> string[] — a style sheet of the page that is not one of the site's files. The site's style sheets are the
// files its pages link from their own address; so a `<style>` element, a style sheet constructed in script and a sheet linked from
// another address are findings. A `<style>` inside an SVG is the diagram's own and no sheet of the page.
export function styleSheetFindings() {
  const found = [];
  for (const sheet of document.styleSheets) {
    const owner = sheet.ownerNode;
    if (owner && typeof owner.closest === "function" && owner.closest("svg")) continue;
    if (owner && owner.localName === "style") { found.push("an embedded <style> element"); continue; }
    const href = sheet.href ? new URL(sheet.href, location.href) : null;
    if (!href) found.push("a style sheet without an address");
    else if (href.origin !== location.origin) found.push(`a style sheet from another address: ${href.href}`);
  }
  if (document.adoptedStyleSheets.length) found.push(`${document.adoptedStyleSheets.length} style sheet(s) constructed in script`);
  return [...new Set(found)];
}

// targetFindings(minimum) -> string[] — each button and link smaller than `minimum` CSS px in either direction, and not excused by
// WCAG 2.2 success criterion 2.5.8's exceptions that a page shows without a person's judgement:
//   Inline — the link or button is in a sentence: it is displayed inline and the text block around it holds text that is no target's;
//   Spacing — a circle of `minimum` px diameter centred on the target's box meets no other target and no circle of another undersized
//   target.
// The exceptions "equivalent", "user agent control" and "essential" are not applied. A button or link is a target only where the page
// displays it: one that is hidden, or that stands in a closed <details> outside its <summary>, is none, and takes no part in another
// target's spacing.
export function targetFindings(minimum) {
  const selector = "a[href], button, [role=button], [role=link], input[type=button], input[type=submit], input[type=reset], input[type=image]";
  // A closed <details> displays its <summary> only; the browser skips the layout of the rest, and the box it still reports for an element
  // there lies over whatever follows the <details>.
  const closedAway = (element) => {
    for (let box = element.closest("details"); box; box = box.parentElement?.closest("details")) {
      if (!box.open && ![...box.children].some((child) => child.localName === "summary" && child.contains(element))) return true;
    }
    return false;
  };
  const shown = (element) => {
    const rect = element.getBoundingClientRect();
    if (!rect.width || !rect.height) return false;
    const style = getComputedStyle(element);
    return style.visibility !== "hidden" && style.display !== "none" && !closedAway(element);
  };
  const targets = [...document.querySelectorAll(selector)].filter(shown).map((element) => ({ element, rect: element.getBoundingClientRect() }));
  const small = targets.filter(({ rect }) => rect.width < minimum || rect.height < minimum);
  const textOutsideTargets = (block) => {
    let text = "";
    const walk = (node) => {
      if (node.nodeType === 3) text += node.nodeValue;
      else if (node.nodeType === 1 && !node.matches(selector)) node.childNodes.forEach(walk);
    };
    block.childNodes.forEach(walk);
    return text.trim().length > 0;
  };
  const inSentence = (element) => {
    if (getComputedStyle(element).display !== "inline") return false;
    let block = element.parentElement;
    while (block && getComputedStyle(block).display === "inline") block = block.parentElement;
    return Boolean(block) && textOutsideTargets(block);
  };
  const centre = ({ rect }) => ({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
  const circleMeetsBox = (c, rect) => {
    const dx = Math.max(rect.left - c.x, 0, c.x - rect.right), dy = Math.max(rect.top - c.y, 0, c.y - rect.bottom);
    return dx * dx + dy * dy < (minimum / 2) ** 2;
  };
  const label = (element) => (element.getAttribute("aria-label") || element.textContent || element.getAttribute("title") || element.getAttribute("href") || "").replace(/\s+/g, " ").trim().slice(0, 40);
  const found = [];
  for (const target of small) {
    if (inSentence(target.element)) continue;
    const c = centre(target);
    const others = targets.filter((other) => other !== target);
    const meetsTarget = others.some((other) => circleMeetsBox(c, other.rect));
    const meetsCircle = small.filter((other) => other !== target).some((other) => Math.hypot(centre(other).x - c.x, centre(other).y - c.y) < minimum);
    if (!meetsTarget && !meetsCircle) continue;
    found.push(`${target.element.localName} "${label(target.element)}" is ${Math.round(target.rect.width)} x ${Math.round(target.rect.height)} px`);
  }
  return [...new Set(found)];
}

// unrenderedFindings() -> string[] — each block of the page that did not render: MOD-markdown-render's `renderMermaid` and `render` show a diagram
// that fails, and a part they cannot render, as a `.unrendered` block with the reason in its first paragraph. Each finding names the reason.
export function unrenderedFindings() {
  return [...document.querySelectorAll(".unrendered")]
    .map((block) => `a block that did not render: "${(block.querySelector("p")?.textContent ?? block.textContent).replace(/\s+/g, " ").trim().slice(0, 120)}"`);
}

// widthFindings(windowWidth) -> string[] — each outermost element wider than the window (an element inside an SVG is its drawing's, and the
// drawing is the element), and the document itself when it can be scrolled sideways.
export function widthFindings(windowWidth) {
  const found = [];
  const name = (element) => `${element.localName}${element.id ? "#" + element.id : ""}${element.classList.length ? "." + [...element.classList].join(".") : ""}`;
  const wide = (element) => element.getBoundingClientRect().width > windowWidth + 0.5;
  for (const element of document.body.querySelectorAll("*")) {
    if (element.closest("svg") !== null && element.localName !== "svg") continue;
    if (!wide(element)) continue;
    const parent = element.parentElement;
    if (parent && parent !== document.body && wide(parent)) continue;
    found.push(`${name(element)} is ${Math.round(element.getBoundingClientRect().width)} px wide`);
  }
  if (document.documentElement.scrollWidth > windowWidth) found.push(`the page scrolls sideways: ${document.documentElement.scrollWidth} px of content`);
  return [...new Set(found)];
}
