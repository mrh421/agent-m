// A Mermaid diagram is drawn in a page: renderMermaid and renderArtifact, run in a real browser with the vendored Mermaid, give an
// svg for a flowchart and for a sequence diagram, and the element left detached is what does not draw.
// Run: node --test tests/markdown-render-918-diagram-drawn.test.mjs
//
// Module: MOD-markdown-render
// Guards: DIAGRAMS ARE MERMAID IN MARKDOWN
// Level: component
//
// The expected results are written here, in the cases, from the contract of renderMermaid ("one diagram, drawn") and none is read from a
// document. Readings, each adding no word to the sentence it reads:
//   - "drawn" is the element holding an `svg` and the element not being, and not holding, an `.unrendered` block; the block is what
//     the module returns for a diagram that does not draw.
//   - The engine is the controlled Electron of tests/site-usability.d/browser.mjs (a helper, not a test file; the only thing taken from
//     MOD-site-frame's tests), because Mermaid measures what it draws and needs a browser's layout. The page is a blank page served
//     from this repository's own files; nothing else is served and nothing leaves the machine.
//   - The counter-proof of the whole file is the element left detached: the same library, given the same sources on an element that
//     is not in the document, throws (the known positive of the failure), and the same sources on an element in the document
//     draw an svg. Planted in src/markdown-render/mermaid.mjs, leaving the element out of the document fails the draw cases; the run is
//     recorded in the pull request.

import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { join, normalize } from "node:path";
import { stageElectron, openWindow, until } from "./site-usability.d/browser.mjs";

const root = new URL("..", import.meta.url).pathname;
const TYPES = { ".mjs": "text/javascript", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".html": "text/html" };

const FLOWCHART = 'flowchart LR\n  A["Plan"] --> B["Build"]\n  B --> C["Test"]\n';
const SEQUENCE = "sequenceDiagram\n  participant U as User\n  participant S as System\n  U->>S: Login\n  S-->>U: Shown\n";
const BROKEN = "flowchart LR\n  A[\n";
const ARTIFACT = `Before.\n\n\`\`\`mermaid\n${FLOWCHART}\`\`\`\n\nBetween.\n\n\`\`\`mermaid\n${SEQUENCE}\`\`\`\n\nAfter.\n`;

let server = null, address = "", browser = null, page = null;
const found = {};

// In the page: what a drawn element holds, as booleans and strings (never the node).
const DESCRIBE = `(el) => ({ svg: el.querySelector("svg") !== null, sized: (el.querySelector("svg")?.viewBox.baseVal.width ?? 0) > 0 && (el.querySelector("svg")?.viewBox.baseVal.height ?? 0) > 0, unrendered: el.classList.contains("unrendered") || el.querySelector(".unrendered") !== null,
  message: (el.querySelector("p")?.textContent ?? ""), connected: el.isConnected })`;
// What stands in the body besides the library's own script and its one tooltip element (the library creates it on its first draw and keeps it).
// A drawing may keep one empty element of its own in the body to draw in; what it must not keep is a diagram, so the finding is the body's other
// children that are not empty, and any svg anywhere in the body.
const STRAYS = `({ filled: [...document.body.children].filter((node) => node.tagName !== "SCRIPT" && !node.classList.contains("mermaidTooltip") && node.childNodes.length > 0)
  .map((node) => node.tagName + "." + node.className), svgInBody: document.body.querySelector("svg") !== null })`;

before(async () => {
  server = createServer((request, response) => {
    const raw = decodeURIComponent(new URL(request.url, "http://site").pathname);
    if (raw === "/__blank") { response.writeHead(200, { "content-type": "text/html" }); response.end("<!doctype html><title>blank</title><body></body>"); return; }
    const file = normalize(join(root, raw));
    if (!file.startsWith(root) || !existsSync(file) || statSync(file).isDirectory()) { response.writeHead(404); response.end(); return; }
    response.writeHead(200, { "content-type": TYPES[file.slice(file.lastIndexOf("."))] ?? "application/octet-stream" });
    createReadStream(file).pipe(response);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  address = `http://127.0.0.1:${server.address().port}`;
  const executable = await stageElectron();
  browser = await openWindow(executable, `${address}/__blank`);
  page = browser.page;
  await page.evaluate(`import("/src/markdown-render/index.mjs").then((module) => { window.__module = module; return true; })`);

  const describe = `const describe = ${DESCRIBE};`;
  found.flowchart = await page.evaluate(`(async () => { ${describe} return describe(await window.__module.renderMermaid(${JSON.stringify(FLOWCHART)})); })()`);
  found.sequence = await page.evaluate(`(async () => { ${describe} return describe(await window.__module.renderMermaid(${JSON.stringify(SEQUENCE)})); })()`);
  found.broken = await page.evaluate(`(async () => { ${describe} return describe(await window.__module.renderMermaid(${JSON.stringify(BROKEN)})); })()`);
  found.strays = await page.evaluate(STRAYS);

  // The counter-proof: the library the module loaded (now initialised), on an element in no document, and on the same in the document.
  found.control = await page.evaluate(`(async () => {
    const run = async (source, attached) => {
      const element = document.createElement("div");
      element.className = "mermaid";
      element.textContent = source;
      if (attached) document.body.appendChild(element);
      let error = "";
      try { await globalThis.mermaid.run({ nodes: [element] }); } catch (failure) { error = String(failure?.message ?? failure); }
      const svg = element.querySelector("svg") !== null;
      element.remove();
      return attached ? { svg, failed: error !== "" } : { failed: error !== "" };
    };
    return { flowDetached: await run(${JSON.stringify(FLOWCHART)}, false), flowAttached: await run(${JSON.stringify(FLOWCHART)}, true),
      sequenceDetached: await run(${JSON.stringify(SEQUENCE)}, false), sequenceAttached: await run(${JSON.stringify(SEQUENCE)}, true) };
  })()`);

  // The boundary the drawing keeps: the real library draws, and a style that would load a resource is planted in its svg before the
  // module takes the drawing. The library is wrapped for these three draws only and put back after them.
  found.hostile = await page.evaluate(`(async () => {
    const real = globalThis.mermaid, outcomes = {};
    for (const [name, css] of [["import", "@import url(https://outside.example/a.css);"],
      ["font", "@font-face{font-family:x;src:url(https://outside.example/f.woff)}"],
      ["keyframes", "@keyframes x{from{background:url(https://outside.example/i.png)}}"]]) {
      let planted = false;
      globalThis.mermaid = { initialize: real.initialize, mermaidAPI: real.mermaidAPI, async run({ nodes }) {
        await real.run({ nodes });
        nodes[0].querySelector("svg").insertAdjacentHTML("afterbegin", "<style>" + css + "</style>");
        planted = nodes[0].innerHTML.includes("outside.example");
      } };
      const drawn = await window.__module.renderMermaid(${JSON.stringify(FLOWCHART)});
      outcomes[name] = { planted, leaks: drawn.innerHTML.includes("outside.example") };
    }
    globalThis.mermaid = real;
    return outcomes;
  })()`);

  // The whole path: renderArtifact on a text with both diagrams, inserted in the page; it draws them after it has returned.
  await page.evaluate(`(() => { const root = window.__module.renderArtifact(${JSON.stringify(ARTIFACT)}); root.id = "artifact"; document.body.appendChild(root); return true; })()`);
  found.artifact = await until("the artifact's two diagrams are drawn or failed", () => page.evaluate(`(() => {
    const root = document.getElementById("artifact");
    const svgs = root.querySelectorAll(".mermaid svg").length, failed = root.querySelectorAll(".unrendered").length;
    return svgs + failed === 2 ? { svgs, failed, prose: root.textContent.includes("Between.") } : null; })()`), 30000);
}, { timeout: 110000 });

after(async () => {
  browser?.close();
  await new Promise((resolve) => (server ? server.close(resolve) : resolve()));
});

// TST-918001 · level: component · module: MOD-markdown-render
// guards: DIAGRAMS ARE MERMAID IN MARKDOWN
// given: the vendored Mermaid in a browser
// input: a flowchart of three nodes through renderMermaid
// expect: the element holds an svg whose viewBox is wider and higher than 0 (the library measured what it drew), is not an `.unrendered` block, and stands in no document
test("TST-918001: a flowchart is drawn: the element holds an svg and no .unrendered block", () => {
  assert.deepEqual(found.flowchart, { svg: true, sized: true, unrendered: false, message: "", connected: false });
});

// TST-918002 · level: component · module: MOD-markdown-render
// guards: DIAGRAMS ARE MERMAID IN MARKDOWN
// given: the same
// input: a sequence diagram of two participants (Mermaid measures it with getBBox)
// expect: the element holds an svg whose viewBox is wider and higher than 0 (the library measured what it drew), is not an `.unrendered` block, and stands in no document
test("TST-918002: a sequence diagram is drawn: the element holds an svg and no .unrendered block", () => {
  assert.deepEqual(found.sequence, { svg: true, sized: true, unrendered: false, message: "", connected: false });
});

// TST-918003 · level: component · module: MOD-markdown-render
// guards: DIAGRAMS ARE MERMAID IN MARKDOWN
// given: the same
// input: the two sources through the library on an element in no document, and on an element in the document
// expect: detached, each fails (the known positive of the fault: the library throws); in the document, each draws an svg and does not fail
test("TST-918003: the counter-proof: the library draws the sources in the document and not on a detached element", () => {
  assert.deepEqual(found.control, {
    flowDetached: { failed: true }, flowAttached: { svg: true, failed: false },
    sequenceDetached: { failed: true }, sequenceAttached: { svg: true, failed: false },
  });
});

// TST-918004 · level: component · module: MOD-markdown-render
// guards: DIAGRAMS ARE MERMAID IN MARKDOWN
// given: the same
// input: a source that does not parse
// expect: an `.unrendered` block with the parser's message and no svg; and after all three draws no diagram stands in the document's body
test("TST-918004: a diagram that does not parse is shown with its message, and the drawing leaves no diagram in the document", () => {
  assert.equal(found.broken.svg, false);
  assert.equal(found.broken.unrendered, true);
  assert.match(found.broken.message, /^Diagram error: \S/);
  assert.deepEqual(found.strays, { filled: [], svgInBody: false }, "after the three draws no diagram stands in the document's body");
});

// TST-918006 · level: component · module: MOD-markdown-render
// guards: DIAGRAMS ARE MERMAID IN MARKDOWN
// given: the vendored Mermaid in a browser, wrapped for three draws so that it plants a style in the drawn svg that loads a resource: an @import, an @font-face and a url inside an @keyframes
// input: a flowchart of three nodes through renderMermaid, once for each planted style
// expect: in each case the planting happened (the known positive) and the element the module returns holds no reference to the outside address
test("TST-918006: a style planted in a drawn svg that would load a resource never reaches the element", () => {
  assert.deepEqual(found.hostile, {
    import: { planted: true, leaks: false }, font: { planted: true, leaks: false }, keyframes: { planted: true, leaks: false },
  });
});

// TST-918005 · level: component · module: MOD-markdown-render
// guards: DIAGRAMS ARE MERMAID IN MARKDOWN
// given: the same
// input: renderArtifact on a text with prose, a flowchart and a sequence diagram, inserted in the page
// expect: both diagrams are drawn (two svg, no .unrendered block) and the prose between them stays
test("TST-918005: renderArtifact draws both diagrams of a text", () => {
  assert.deepEqual(found.artifact, { svgs: 2, failed: 0, prose: true });
});
