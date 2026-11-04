// Markdown to sanitised HTML (MOD-markdown-render, Interfaces: renderArtifact), with md() of src/site-frame/dashboard-app.mjs as
// its model: marked turns the Markdown into HTML, and DOMPurify sanitises it before it reaches the page (ARC-049).
//
// Module: MOD-markdown-render
//
// The sanitiser keeps only the elements and attributes that Markdown writes, so no script, event handler or `javascript:`
// address of a text runs, and nothing a text names is loaded (NO SERVER): an image is written as a link to its address, and an
// image or other embedded resource written in HTML is removed. A Mermaid block is drawn by the local Mermaid library; a parser
// failure is shown as its source with the reason. A whole text that cannot be rendered is also shown as source — renderArtifact
// never throws.

import { Marked } from "./vendor/marked.esm.js";
import DOMPurify from "./vendor/purify.es.mjs";
import { parseFrontMatter } from "../text-tools/index.mjs";
import { renderMermaid } from "./mermaid.mjs";

const h = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// A part of a text shown as its source, with the reason it is not rendered.
const unrendered = (source, reason) => `<div class="unrendered"><p>${h(reason)}</p><pre><code>${h(source)}</code></pre></div>`;

const NOT_DRAWN = "This diagram is not drawn: this page shows diagrams as their Mermaid source.";

const markdown = new Marked({
  renderer: {
    // An image is a link to its address: it is never loaded.
    image({ href, title, text }) {
      return `<a href="${h(href)}"${title ? ` title="${h(title)}"` : ""}>${h(text || href)}</a>`;
    },
    // A Mermaid block is shown as its source; every other block as marked writes it.
    code({ text, lang }) {
      if (!/^mermaid(?:\s|$)/.test(lang ?? "")) return false;
      if (typeof SVGElement === "undefined") return unrendered(text, NOT_DRAWN);
      return `<pre><code class="language-mermaid">${h(text)}</code></pre>`;
    },
  },
});

// What Markdown writes, and the source shown of a part that is not rendered, is all that may reach the page.
const SANITISE = {
  ALLOWED_TAGS: ["h1", "h2", "h3", "h4", "h5", "h6", "p", "br", "hr", "blockquote", "pre", "code", "em", "strong", "del", "a",
    "ul", "ol", "li", "input", "table", "thead", "tbody", "tr", "th", "td", "div"],
  ALLOWED_ATTR: ["href", "title", "class", "start", "align", "type", "checked", "disabled"],
};

// renderArtifact(text: string) -> Element — the text rendered, sanitised before it is inserted. It never throws: a text that
// cannot be rendered, or a browser that cannot sanitise, shows the text as its source with the reason.
export function renderArtifact(text, { frontMatter = "table" } = {}) {
  const rendered = document.createElement("div");
  rendered.className = "md";
  try {
    if (!DOMPurify.isSupported) throw new Error("this browser cannot sanitise HTML");
    const parsed = parseFrontMatter(text);
    const rows = parsed.order.map((key) => {
      const value = Array.isArray(parsed.fields[key]) ? parsed.fields[key].join(", ") : parsed.fields[key];
      return `<tr><th>${h(key)}</th><td>${h(value)}</td></tr>`;
    }).join("");
    const table = frontMatter === "hidden" || !parsed.order.length ? "" : `<table class="frontmatter list"><tbody>${rows}</tbody></table>`;
    rendered.innerHTML = table + DOMPurify.sanitize(markdown.parse(parsed.body), SANITISE);
    for (const table of rendered.getElementsByTagName("table")) {
      const header = table.getElementsByTagName("thead")[0];
      if (!header) continue;
      const labels = [...header.getElementsByTagName("th")].map((cell) => cell.textContent);
      for (const row of table.getElementsByTagName("tbody")[0]?.getElementsByTagName("tr") ?? []) {
        [...row.getElementsByTagName("td")].forEach((cell, index) => cell.setAttribute("data-label", labels[index] ?? ""));
      }
    }
    for (const code of rendered.getElementsByTagName("code")) {
      if (!/language-mermaid/.test(code.className)) continue;
      const parent = code.parentNode;
      renderMermaid(code.textContent).then((diagram) => {
        parent.parentNode.insertBefore(diagram, parent);
        parent.parentNode.removeChild(parent);
      });
    }
  } catch (e) {
    rendered.innerHTML = unrendered(text, `This text is not rendered: ${e?.message ?? e}`);
  }
  return rendered;
}
