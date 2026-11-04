// MOD-site-frame shows a token's expiry and its refusal itself (notices.mjs: showTokenNotices, refusedNotice): the notice of a stored
// token whose recorded expiry is within fourteen days or past, counted in whole UTC days, and the notice of a token the server
// refused, each naming the token and linking the page where it is renewed.
//
// Run: node --test tests/site-frame-token-notices.test.mjs
//
// Module: MOD-site-frame
// Guards: A TOKEN'S EXPIRY IS WARNED OF IN ADVANCE; AN EXPIRED TOKEN IS NAMED AND ITS RENEWAL LINKED; UC-042
// Level: unit
//
// Each test names its input and states its expected values in its own text; none reads an expected result from the SPEC, a use
// case or an architecture file. The page is the small fixture DOM of tests/site-frame-start.d/dom.mjs with a fixture location and
// local storage, offline: nothing reaches the network. The counter-proofs (a planted fault in src/site-frame/ and the test's failing
// result) are recorded in the pull request.

import assert from "node:assert/strict";
import test from "node:test";
import { all, installPage, offline } from "./site-frame-start.d/dom.mjs";
import { openStore, writeSetting } from "../src/browser-store/index.mjs";
import { connect, parseAddress } from "../src/repository-hosts/index.mjs";

const { startPage } = await import("../src/site-frame/index.mjs");
const { noticePlace, showTokenNotices } = await import("../src/site-frame/notices.mjs");

const REVIEW = { hostname: "acme.github.io", pathname: "/instance/docs/index.html" };
const WIDGET = "https://github.com/acme/widget";
const APP = "https://gitlab.example.org/team/app";
const GITHUB_TOKENS = "https://github.com/settings/personal-access-tokens";
const settle = () => new Promise((resolve) => setImmediate(resolve));
// The UTC date `days` whole days from today.
const day = (days) => { const n = new Date(); return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()) + days * 864e5).toISOString().slice(0, 10); };

const VIEW = { routes: [{ name: "alpha", entry: "requirements", title: "alpha", async render(target) { target.textContent = "alpha"; } }], strategies: [] };

// Starts the review page; `tokens` are the stored settings { key: { name, expires } }, `tested` the last tests { key: outcome }.
async function start({ tokens = {}, tested = {}, products = [], fragment = "", views = [VIEW] } = {}) {
  const fixture = installPage({ ...REVIEW, hash: fragment });
  offline();
  globalThis.setInterval = () => 1;
  const store = openStore("acme/instance");
  if (products.length) writeSetting(store, "products", products);
  for (const [key, token] of Object.entries(tokens)) writeSetting(store, key, { value: "github_pat_X", name: "Agent M", stored: day(-1), ...token });
  for (const [key, outcome] of Object.entries(tested)) writeSetting(store, `last-test:${key}`, { at: day(0), outcome });
  await startPage({ page: "review", views });
  const notices = all(fixture.document.body, "p").filter((p) => p.className.startsWith("notice ")).map((p) => ({
    kind: p.className.slice("notice ".length), text: p.children[0], label: all(p, "a")[0]?.textContent ?? null, href: all(p, "a")[0]?.getAttribute("href") ?? null }));
  return { ...fixture, notices, store };
}

// TST-683001 · level: unit · module: MOD-site-frame
// guards: A TOKEN'S EXPIRY IS WARNED OF IN ADVANCE; UC-042
// given: the instance's token named "Agent M" whose recorded expiry is 14 days from today
// input: startPage
// expect: one notice of kind token-expiring whose text begins "Your GitHub token expires on <that date> (Agent M)." and tells where the new value is pasted, with a link labelled "Renew" to GitHub's list of tokens
test("TST-683001 a token that expires in 14 days is named with its date, and its renewal is linked", async () => {
  const page = await start({ tokens: { "github-token": { expires: day(14) } } });
  assert.equal(page.notices.length, 1);
  assert.equal(page.notices[0].kind, "token-expiring");
  assert.ok(page.notices[0].text.startsWith(`Your GitHub token expires on ${day(14)} (Agent M).`), page.notices[0].text);
  assert.match(page.notices[0].text, /paste the new value in Settings/);
  assert.equal(page.notices[0].label, "Renew");
  assert.equal(page.notices[0].href, GITHUB_TOKENS);
});

// TST-683002 · level: unit · module: MOD-site-frame
// guards: A TOKEN'S EXPIRY IS WARNED OF IN ADVANCE
// given: the instance's token with its expiry 15 days from today, then one with no recorded expiry, then one with an expiry that is no date
// input: startPage for each
// expect: no notice for any of the three
test("TST-683002 a token 15 days from its expiry, one with no recorded expiry and one with no date are not warned of", async () => {
  assert.deepEqual((await start({ tokens: { "github-token": { expires: day(15) } } })).notices, []);
  assert.deepEqual((await start({ tokens: { "github-token": { expires: null } } })).notices, []);
  assert.deepEqual((await start({ tokens: { "github-token": { expires: "next spring" } } })).notices, []);
});

// TST-683003 · level: unit · module: MOD-site-frame
// guards: A TOKEN'S EXPIRY IS WARNED OF IN ADVANCE
// given: the instance's token expiring today, then one that expired yesterday
// input: startPage for each
// expect: today's notice says "Your GitHub token expires on <today> (Agent M)."; yesterday's says "Your GitHub token expired on <yesterday> (Agent M)." and links GitHub's list of tokens
test("TST-683003 a token that expires today is still to expire; one that expired yesterday is named as expired", async () => {
  const today = await start({ tokens: { "github-token": { expires: day(0) } } });
  assert.ok(today.notices[0].text.startsWith(`Your GitHub token expires on ${day(0)} (Agent M).`), today.notices[0].text);
  const past = await start({ tokens: { "github-token": { expires: day(-1) } } });
  assert.equal(past.notices[0].kind, "token-expiring");
  assert.ok(past.notices[0].text.startsWith(`Your GitHub token expired on ${day(-1)} (Agent M).`), past.notices[0].text);
  assert.equal(past.notices[0].href, GITHUB_TOKENS);
});

// TST-683004 · level: unit · module: MOD-site-frame
// guards: A TOKEN'S EXPIRY IS WARNED OF IN ADVANCE
// given: a clock at 2026-10-17 23:59:59 UTC and the instance's token with an expiry of 2026-10-31, then 2026-11-01
// input: showTokenNotices with that clock
// expect: 2026-10-31 is 14 whole UTC days away and is named; 2026-11-01 is 15 and is not — the time of day moves neither
test("TST-683004 days are counted in whole UTC days, whatever the time of day", () => {
  installPage({ ...REVIEW });
  const instance = { host: connect(parseAddress("https://github.com/acme/instance"), {}) };
  const shown = (expires) => {
    const store = openStore("acme/instance");
    writeSetting(store, "github-token", { value: "github_pat_X", name: "Agent M", expires, stored: "2026-10-01" });
    const place = noticePlace();
    showTokenNotices({ store, instance, now: new Date("2026-10-17T23:59:59Z") });
    return place.children.map((p) => p.children[0]);
  };
  assert.deepEqual(shown("2026-10-31"), ["Your GitHub token expires on 2026-10-31 (Agent M). After renewing it, paste the new value in Settings."]);
  assert.deepEqual(shown("2026-11-01"), []);
});

// TST-683005 · level: unit · module: MOD-site-frame
// guards: AN EXPIRED TOKEN IS NAMED AND ITS RENEWAL LINKED
// given: the instance's token whose last test is a refusal, with an expiry 5 days away; the same token whose last test worked
// input: startPage for each
// expect: the refused one gives one notice of kind token-refused, "The server refused your token Agent M." with the renewal link, and no token-expiring notice; the one that worked gives the token-expiring notice only
test("TST-683005 a token the server refused is named with its renewal, and a refusal is not shown beside an expiry", async () => {
  const refused = await start({ tokens: { "github-token": { expires: day(5) } }, tested: { "github-token": "refused" } });
  assert.deepEqual(refused.notices.map((n) => n.kind), ["token-refused"]);
  assert.ok(refused.notices[0].text.startsWith("The server refused your token Agent M."), refused.notices[0].text);
  assert.equal(refused.notices[0].label, "Renew");
  assert.equal(refused.notices[0].href, GITHUB_TOKENS);
  const worked = await start({ tokens: { "github-token": { expires: day(5) } }, tested: { "github-token": "working" } });
  assert.deepEqual(worked.notices.map((n) => n.kind), ["token-expiring"]);
});

// TST-683006 · level: unit · module: MOD-site-frame
// guards: A TOKEN'S EXPIRY IS WARNED OF IN ADVANCE; AN EXPIRED TOKEN IS NAMED AND ITS RENEWAL LINKED
// given: a GitHub product https://github.com/acme/widget and a GitLab product https://gitlab.example.org/team/app, each with a token of its own expiring in 5 days, and the instance's token expiring in 60 days
// input: startPage on the widget's pages, on the app's pages, and on the instance's pages
// expect: the widget's pages show "Your GitHub token expires on <date> (Agent M for https://github.com/acme/widget)" with GitHub's list of tokens; the app's pages show "Your GitLab project token expires on <date> (Agent M for https://gitlab.example.org/team/app)" with https://gitlab.example.org/team/app/-/settings/access_tokens; the instance's pages name neither (counter-proof)
test("TST-683006 a product's own token is named on that product's pages only, with its server's renewal page", async () => {
  const tokens = { "github-token": { expires: day(60) }, "github-token:acme/widget": { expires: day(5) }, "gitlab-token:gitlab.example.org/team/app": { value: "glpat-X", expires: day(5) } };
  const widget = await start({ tokens, products: [WIDGET, APP], fragment: `#alpha/product=${encodeURIComponent(WIDGET)}` });
  assert.deepEqual(widget.notices.map((n) => [n.kind, n.text.replace(/\. After renewing.*$/, ""), n.href]), [["token-expiring", `Your GitHub token expires on ${day(5)} (Agent M for ${WIDGET})`, GITHUB_TOKENS]]);
  const app = await start({ tokens, products: [WIDGET, APP], fragment: `#alpha/product=${encodeURIComponent(APP)}` });
  assert.deepEqual(app.notices.map((n) => [n.kind, n.text.replace(/\. After renewing.*$/, ""), n.href]),
    [["token-expiring", `Your GitLab project token expires on ${day(5)} (Agent M for ${APP})`, "https://gitlab.example.org/team/app/-/settings/access_tokens"]]);
  const instance = await start({ tokens, products: [WIDGET, APP], fragment: "#alpha" });
  assert.deepEqual(instance.notices, [], "counter-proof: the instance's pages name neither product's token");
});

// TST-683007 · level: unit · module: MOD-site-frame
// guards: AN EXPIRED TOKEN IS NAMED AND ITS RENEWAL LINKED
// given: a view whose route fails with MOD-repository-hosts' TokenRefused { tokenName: "Agent M for acme/widget", renewal: "https://example.test/renew" } and a view whose route fails with another error, Error("something else")
// input: startPage with each
// expect: the first page starts and shows one notice of kind token-refused, "The server refused your token Agent M for acme/widget.", linked to https://example.test/renew; the second start resolves, shows no notice, and its main area reads first, in plain words, "Something went wrong while this page was being drawn, so it cannot be shown. Reload the page to try again. If it happens again, report it, together with the message below." and then the message, "This page could not be drawn: something else" (ITM-865: it rejected with that error before; ITM-1401: the message stood alone before)
test("TST-683007 a route that fails with TokenRefused shows the refusal as a notice; another failure is shown as a fault of the page", async () => {
  const failing = (error) => ({ routes: [{ name: "alpha", entry: "requirements", title: "alpha", async render() { throw error; } }], strategies: [] });
  const refusal = Object.assign(new Error("rejected"), { name: "TokenRefused", tokenName: "Agent M for acme/widget", renewal: "https://example.test/renew" });
  const kept = { "github-token": { expires: day(60) } };
  const page = await start({ tokens: kept, views: [failing(refusal)] });
  await settle();
  assert.deepEqual(page.notices.map((n) => [n.kind, n.label, n.href]), [["token-refused", "Renew", "https://example.test/renew"]]);
  assert.ok(page.notices[0].text.startsWith("The server refused your token Agent M for acme/widget."), page.notices[0].text);
  const other = await start({ tokens: kept, views: [failing(new Error("something else"))] });
  await settle();
  assert.deepEqual(other.notices.filter((n) => n.kind === "token-refused"), []);
  assert.equal(all(other.document.body, "main")[0].textContent, "Something went wrong while this page was being drawn, so it cannot be shown. Reload the page to try again. "
    + "If it happens again, report it, together with the message below.This page could not be drawn: something else");
});
