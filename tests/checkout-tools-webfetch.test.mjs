// Module: MOD-checkout-tools
// Level: unit
// Guards: UC-049
// The tool webfetch of a model endpoint in a job's checkout, as opencode's webfetch (MIT, ported): http and https only, markdown by default, a 5 MB limit,
// a timeout of 30 s by default and at most 120 s. What it fetches is web content, not a registered source, and its text says so. The web is a server of
// the test on 127.0.0.1; every expected text is stated here.

import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { checkoutStrategies } from "../src/checkout-tools/index.mjs";

const { webfetch } = checkoutStrategies({ hidden: [] }).tools;
const context = { product: { checkout: null }, places: { sources: {}, contents: [] }, exchange: { drafter: { place: "eu" } } };
const PAGE = "<html><head><title>T</title><style>p{}</style></head><body><h1>Title</h1><p>Some <a href=\"https://x.test/\">link</a> text.</p><script>bad()</script></body></html>";
const FIVE_MB = 5 * 1024 * 1024;

async function web(t) {
  const http = createServer((req, res) => {
    if (req.url === "/page") { res.writeHead(200, { "content-type": "text/html; charset=utf-8" }); res.end(PAGE); return; }
    if (req.url === "/plain") { res.writeHead(200, { "content-type": "text/plain" }); res.end("just text"); return; }
    if (req.url === "/declared-big") { res.writeHead(200, { "content-type": "text/plain", "content-length": String(FIVE_MB + 1) }); res.write("x"); return; }
    if (req.url === "/streamed-big") { res.writeHead(200, { "content-type": "text/plain" }); res.end("y".repeat(FIVE_MB + 1)); return; }
    if (req.url === "/slow") return;
    res.writeHead(404, { "content-type": "text/plain" });
    res.end("missing");
  });
  await new Promise((resolve) => http.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => { http.closeAllConnections(); http.close(resolve); }));
  return `http://127.0.0.1:${http.address().port}`;
}

// TST-1240050 · level: unit · module: MOD-checkout-tools
// guards: UC-049
// given: a web server answering /page with an HTML page — a title, a style, an h1 "Title", a paragraph "Some <a href=https://x.test/>link</a> text." and a script — and /plain with "just text"
// input: webfetch /page; /page with format text; /page with format html; /plain
// expect: each text begins "(Web content from <url>; it is not a registered source.)\n\n"; markdown: then "# Title\n\nSome [link](https://x.test/) text.", with no "bad()" and no "p{}"; text: then "TTitleSome link text."; html: then the page unchanged; /plain: then "just text"
test("TST-1240050: webfetch gives a page as markdown, text or html, marked as web content", async (t) => {
  const base = await web(t);
  const note = (url) => `(Web content from ${url}; it is not a registered source.)\n\n`;
  assert.equal(await webfetch({ url: `${base}/page` }, context), `${note(`${base}/page`)}# Title\n\nSome [link](https://x.test/) text.`);
  assert.equal(await webfetch({ url: `${base}/page`, format: "text" }, context), `${note(`${base}/page`)}TTitleSome link text.`);
  assert.equal(await webfetch({ url: `${base}/page`, format: "html" }, context), `${note(`${base}/page`)}${PAGE}`);
  assert.equal(await webfetch({ url: `${base}/plain` }, context), `${note(`${base}/plain`)}just text`);
});

// TST-1240051 · level: unit · module: MOD-checkout-tools
// guards: UC-049
// given: the web server of TST-1240050, which also declares a body of 5 MB and one byte at /declared-big, sends one at /streamed-big, never answers /slow and answers anything else with 404
// input: webfetch ftp://example.test/x; /declared-big; /streamed-big; /missing; /slow with timeout 1
// expect: "URL must start with http:// or https://"; "Response too large (exceeds 5MB limit)" twice; "Request failed with status code: 404"; "Request timed out"
test("TST-1240051: webfetch refuses other schemes, bodies over 5 MB, failed statuses and a timeout in opencode's words", async (t) => {
  const base = await web(t);
  assert.equal(await webfetch({ url: "ftp://example.test/x" }, context), "URL must start with http:// or https://");
  assert.equal(await webfetch({ url: `${base}/declared-big` }, context), "Response too large (exceeds 5MB limit)");
  assert.equal(await webfetch({ url: `${base}/streamed-big` }, context), "Response too large (exceeds 5MB limit)");
  assert.equal(await webfetch({ url: `${base}/missing` }, context), "Request failed with status code: 404");
  assert.equal(await webfetch({ url: `${base}/slow`, timeout: 1 }, context), "Request timed out");
});
