// ITM-1127: the Settings page gives the prompt bar its subject, which names each setting and whether it is stored, and carries no value (MOD-settings-pages, Interfaces:
// "Each route gives the prompt bar its subject, of the kind `converse` (UC-049 3c): the page names each setting and whether it is stored, works or has expired, never a value,
// so that a secret shown on *Show* is never part of what a participant is given"; UC-049 3c: "The context names the settings and whether each is stored; it never carries a
// stored token, key or password"). The route is the real one; the store is the browser store of a small localStorage; nothing reaches the network.
// Run: node --test tests/settings-pages-subject.test.mjs
//
// Module: MOD-settings-pages
// Guards: UC-049; A STORED SECRET IS HIDDEN UNTIL SHOWN
// Level: unit
//
// Each test states its input and its expected result before it runs (given / input / expect). The counter-proofs are recorded in the pull request.

import test from "node:test";
import assert from "node:assert/strict";
import "./site-frame-dom.mjs";

const { view } = await import("../src/settings-pages/index.mjs");
const { openStore, writeSetting } = await import("../src/browser-store/index.mjs");
// The route as the frame asks it for its subject: the one its `module` gives (MOD-site-frame's Route).
const route = await view.routes.find((candidate) => candidate.name === "settings").module();

const storage = () => {
  const values = new Map();
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)), removeItem: (key) => values.delete(key),
    get length() { return values.size; }, key: (index) => [...values.keys()][index] ?? null };
};
const PRODUCT = "https://github.com/acme/product";
function context(settings, product = null) {
  const prior = globalThis.localStorage;
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: storage() });
  const store = openStore("acme/instance");
  for (const [key, value] of Object.entries(settings)) writeSetting(store, key, value);
  return { restore: () => Object.defineProperty(globalThis, "localStorage", { configurable: true, value: prior }),
    given: { store, instance: { repository: "acme/instance" }, product: product && { address: product } } };
}
const pageOf = (subject) => subject.paramsFor({}).page;

// TST-1127001 · level: unit · module: MOD-settings-pages
// guards: UC-049; A STORED SECRET IS HIDDEN UNTIL SHOWN
// given: a browser that stores the instance's GitHub token (github_pat_SECRET1), a model endpoint ep1 with the key k1-SECRET and a mailbox with the password mail-SECRET; no Bridge, no jump host
// input: the route's subject for the instance, and the page its paramsFor gives
// expect: the subject is of the kind converse, titled Settings; the page says of the GitHub token, of the endpoint's key and of the mailbox's password that it is stored, and of the Bridge that it is not set; no stored value is in it
// Planted fault: the page carries the drawn text only (no setting is named), or a value (github_pat_SECRET1) is written into a line.
test("TST-1127001 the subject of the Settings page names each setting and whether it is stored", () => {
  const { given, restore } = context({
    "github-token": { value: "github_pat_SECRET1", name: "t", expires: "2027-01-01" },
    "endpoint:ep1": { url: "https://ep1.example.test/v1", kind: "openai-compatible", model: "m", key: "k1-SECRET" },
    mailbox: { address: "reports@example.org", route: "imap", folders: ["INBOX"], imap: { bridge: "lab", account: "reports@example.org", password: "mail-SECRET" } },
  });
  try {
    assert.equal(typeof route.subject, "function", "the route gives a subject");
    const subject = route.subject({}, given);
    assert.equal(subject.kind, undefined, "a subject names no kind: the bar runs converse on every page");
    assert.equal(subject.title, "Settings");
    const page = pageOf(subject);
    assert.match(page, /GitHub token[^\n]*\bstored\b/i);
    assert.match(page, /key[^\n]*\bstored\b/i);
    assert.match(page, /password[^\n]*\bstored\b/i);
    assert.match(page, /Bridge[^\n]*\bnot set\b/i, "known negative: a setting that is not stored says so");
    for (const secret of ["github_pat_SECRET1", "k1-SECRET", "mail-SECRET"]) assert.ok(!page.includes(secret), `${secret} is not carried`);
  } finally { restore(); }
});

// TST-1127002 · level: unit · module: MOD-settings-pages
// guards: UC-049
// given: a browser that stores nothing, then the same browser with a product's token stored for the product https://github.com/acme/product
// input: the subject for the instance, and for the product
// expect: with nothing stored the GitHub token is said to be not set and the endpoint key and the mailbox password are not said to be stored; the product's subject is another subject (another key) and names the product's token as stored
// Planted fault: every setting said to be stored, or the same key for the instance and the product.
test("TST-1127002 a setting that is not stored is said not to be, and the product's page is another subject", () => {
  const empty = context({});
  try {
    const page = pageOf(route.subject({}, empty.given));
    assert.match(page, /GitHub token[^\n]*\bnot set\b/i);
    assert.doesNotMatch(page, /(key|password)[^\n]*\bstored\b/i);
  } finally { empty.restore(); }
  const kept = context({ products: [PRODUCT], [`github-token:${PRODUCT}`]: { value: "github_pat_PRODUCT", name: "t", expires: "2027-01-01" } });
  try {
    const instance = route.subject({}, kept.given), product = route.subject({}, { ...kept.given, product: { address: PRODUCT } });
    assert.notEqual(instance.key, product.key);
    assert.match(pageOf(product), new RegExp(`${PRODUCT.replaceAll(".", "\\.")}[^\\n]*\\bstored\\b`, "i"));
    assert.ok(!pageOf(product).includes("github_pat_PRODUCT"));
  } finally { kept.restore(); }
});

const GRAPH = { address: "reports@example.org", route: "graph", folders: ["INBOX"], graph: { clientId: "11111111-2222-3333-4444-555555555555", account: "reports@example.org" } };
const IMAP = (password) => ({ address: "reports@example.org", route: "imap", folders: ["INBOX"], imap: { bridge: "lab", account: "reports@example.org", password } });
const mailboxLines = (page) => page.split("\n").filter((line) => /^Mailbox/.test(line));

// TST-1127003 · level: unit · module: MOD-settings-pages
// guards: UC-049; A STORED SECRET IS HIDDEN UNTIL SHOWN
// given: a mailbox of the route IMAP whose password is stored; then the same route with an empty password
// input: the subject's page for each
// expect: the mailbox's line names its password and says stored, then not set; the page names no sign-in for the mailbox, and carries no password
// Planted fault: one line for any route ("its password or sign-in"), or "stored" for an empty password.
test("TST-1127003 the line of an IMAP mailbox names its password and whether it is stored", () => {
  for (const [password, state] of [["imap-SECRET", "stored"], ["", "not set"]]) {
    const { given, restore } = context({ mailbox: IMAP(password) });
    try {
      const page = pageOf(route.subject({}, given));
      assert.deepEqual(mailboxLines(page), [`Mailbox password: ${state}`]);
      assert.ok(!page.includes("imap-SECRET"));
    } finally { restore(); }
  }
});

// TST-1127004 · level: unit · module: MOD-settings-pages
// guards: UC-049; A STORED SECRET IS HIDDEN UNTIL SHOWN
// given: a mailbox of the route Microsoft (graph) with its account recorded, which stores no password; then the same route with no account recorded
// input: the subject's page for each
// expect: the mailbox's line names its sign-in and says stored, then not set; the page does not speak of a password for the mailbox
// Planted fault: the line of the route IMAP for every route ("Mailbox password"), which says of the Graph mailbox that a password is stored or not set.
test("TST-1127004 the line of a Microsoft mailbox names its sign-in and not a password", () => {
  for (const [graph, state] of [[GRAPH.graph, "stored"], [{ clientId: GRAPH.graph.clientId }, "not set"]]) {
    const { given, restore } = context({ mailbox: { ...GRAPH, graph } });
    try {
      assert.deepEqual(mailboxLines(pageOf(route.subject({}, given))), [`Mailbox sign-in: ${state}`]);
    } finally { restore(); }
  }
});

// TST-1127005 · level: unit · module: MOD-settings-pages
// guards: UC-049
// given: a browser with no mailbox
// input: the subject's page
// expect: one mailbox line, "Mailbox: not set", naming neither a password nor a sign-in
// Planted fault: a password line for a mailbox that is not there.
test("TST-1127005 a browser with no mailbox says the mailbox is not set", () => {
  const { given, restore } = context({});
  try {
    assert.deepEqual(mailboxLines(pageOf(route.subject({}, given))), ["Mailbox: not set"]);
  } finally { restore(); }
});
