// The tool webfetch of a model endpoint in a job's checkout (MOD-checkout-tools, Parts: webfetch.mjs): one web page, as markdown, text or html.
//
// Module: MOD-checkout-tools
//
// Ported from opencode v1.19.0, packages/opencode/src/tool/webfetch.ts (https://github.com/anomalyco/opencode): http and https only, the Accept header of
// each format, the retry with an honest user agent after a Cloudflare challenge, a timeout of 30 s by default and at most 120 s, the 5 MB limit, and its
// error texts. Changed: plain JavaScript and Node's fetch; the body is read up to the limit, not whole; HTML becomes markdown or text by a few rules of
// this file instead of turndown and htmlparser2; an image is refused; every text says that it is web content, not a registered source.
//
// MIT License
//
// Copyright (c) 2025 opencode
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.

const MAX_RESPONSE_SIZE = 5 * 1024 * 1024;
const DEFAULT_TIMEOUT = 30 * 1000;
const MAX_TIMEOUT = 120 * 1000;
const TOO_LARGE = "Response too large (exceeds 5MB limit)";
const ACCEPT = {
  markdown: "text/markdown;q=1.0, text/x-markdown;q=0.9, text/plain;q=0.8, text/html;q=0.7, */*;q=0.1",
  text: "text/plain;q=1.0, text/markdown;q=0.9, text/html;q=0.8, */*;q=0.1",
  html: "text/html;q=1.0, application/xhtml+xml;q=0.9, text/plain;q=0.8, text/markdown;q=0.7, */*;q=0.1",
};
const SKIPPED = "script|style|noscript|iframe|object|embed";

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: "\"", apos: "'", nbsp: " " };
const decode = (text) => text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, name) => {
  if (name[0] === "#") return String.fromCodePoint(name[1] === "x" || name[1] === "X" ? parseInt(name.slice(2), 16) : Number(name.slice(1)));
  return ENTITIES[name.toLowerCase()] ?? whole;
});
const withoutSkipped = (html) => html.replace(new RegExp(`<(${SKIPPED})\\b[\\s\\S]*?<\\/\\1\\s*>`, "gi"), "");

// The text of an HTML page: every text outside script, style, noscript, iframe, object and embed, joined as it stands, trimmed.
function extractTextFromHTML(html) {
  return decode(withoutSkipped(html).replace(/<!--[\s\S]*?-->/g, "").replace(/<[^>]*>/g, "")).trim();
}

// An HTML page as markdown: its head left out; headings, links, emphasis, code, lists and paragraphs in markdown's form; every other tag dropped.
function convertHTMLToMarkdown(html) {
  let text = withoutSkipped(html.replace(/<head\b[\s\S]*?<\/head\s*>/gi, "")).replace(/<!--[\s\S]*?-->/g, "").replace(/<(meta|link)\b[^>]*>/gi, "");
  text = text
    .replace(/<pre\b[^>]*>([\s\S]*?)<\/pre\s*>/gi, (_, code) => `\n\n\`\`\`\n${code.replace(/<[^>]*>/g, "")}\n\`\`\`\n\n`)
    .replace(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1\s*>/gi, (_, level, inner) => `\n\n${"#".repeat(Number(level))} ${inner.trim()}\n\n`)
    .replace(/<a\b[^>]*?href\s*=\s*"([^"]*)"[^>]*>([\s\S]*?)<\/a\s*>/gi, "[$2]($1)")
    .replace(/<(strong|b)\b[^>]*>([\s\S]*?)<\/\1\s*>/gi, "**$2**")
    .replace(/<(em|i)\b[^>]*>([\s\S]*?)<\/\1\s*>/gi, "*$2*")
    .replace(/<code\b[^>]*>([\s\S]*?)<\/code\s*>/gi, "`$1`")
    .replace(/<li\b[^>]*>/gi, "\n- ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<hr\s*\/?>/gi, "\n\n---\n\n")
    .replace(/<\/?(p|div|section|article|header|footer|main|nav|ul|ol|table|tr|blockquote|h[1-6])\b[^>]*>/gi, "\n\n")
    .replace(/<[^>]*>/g, "");
  return decode(text).split("\n").map((line) => line.replace(/[ \t]+/g, " ").trim()).join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

// The body of a response, read until it ends or passes the limit; null when it passes it.
async function bodyOf(response) {
  const chunks = [];
  let size = 0;
  for await (const chunk of response.body ?? []) {
    size += chunk.byteLength;
    if (size > MAX_RESPONSE_SIZE) return null;
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

/**
 * webfetch({ url, format?, timeout? }, context) -> Promise<string> — the page at `url`, http or https, as markdown (the default), text or html, at most
 * 5 MB, fetched within `timeout` seconds (30 by default, at most 120); its text begins by saying that it is web content, not a registered source.
 */
export async function webfetch({ url, format = "markdown", timeout }) {
  if (!String(url).startsWith("http://") && !String(url).startsWith("https://")) return "URL must start with http:// or https://";
  const limit = Math.min((timeout ?? DEFAULT_TIMEOUT / 1000) * 1000, MAX_TIMEOUT);
  const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36",
    Accept: ACCEPT[format] ?? "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
  };
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, limit);
  try {
    let response = await fetch(url, { headers, signal: controller.signal });
    // Retry with an honest user agent if blocked by Cloudflare's bot detection.
    if (response.status === 403 && response.headers.get("cf-mitigated") === "challenge") {
      response = await fetch(url, { headers: { ...headers, "User-Agent": "opencode" }, signal: controller.signal });
    }
    if (!response.ok) return `Request failed with status code: ${response.status}`;
    const contentLength = response.headers.get("content-length");
    if (contentLength && parseInt(contentLength, 10) > MAX_RESPONSE_SIZE) return TOO_LARGE;
    const body = await bodyOf(response);
    if (body === null) return TOO_LARGE;
    const contentType = response.headers.get("content-type") || "";
    const mime = contentType.split(";")[0]?.trim().toLowerCase() || "";
    if (mime.startsWith("image/")) return `refused: ${url} is an image (${mime}), which this tool cannot show`;
    const content = new TextDecoder().decode(body);
    const html = contentType.includes("text/html");
    const shown = format === "markdown" && html ? convertHTMLToMarkdown(content) : format === "text" && html ? extractTextFromHTML(content) : content;
    return `(Web content from ${url}; it is not a registered source.)\n\n${shown}`;
  } catch (error) {
    if (timedOut) return "Request timed out";
    return `Request failed: ${error?.cause?.message ?? error?.message ?? error}`;
  } finally {
    clearTimeout(timer);
    controller.abort();
  }
}
