# Module: MOD-settings-pages
# Guards: THE SHARED PAGES ORIGIN IS DISCLOSED; AN EXPORT STATES THAT IT CONTAINS SECRETS; AN EXPORT CAN BE LOCKED WITH A PASSPHRASE; SWITCHING PSEUDONYMISATION OFF STATES WHAT FOLLOWS; EVERY STEP EXPLAINS ITSELF; THE MAILBOX PASSWORD IS STORED ONLY AFTER ITS OWN DISCLOSURE; A MAILBOX THROUGH THE JUMP HOST IS NAMED AS READABLE THERE; A PLACE OUTSIDE THE EU IS NAMED AS NOT COMPLIANT; SWITCHING CONVERSATION RECORDING ON STATES WHAT FOLLOWS; UC-042
# Level: component
"""SPEC §7 THE SHARED PAGES ORIGIN IS DISCLOSED — stated before anything is stored.
"""
import json
import re
import unittest
from pathlib import Path

from jsrun import SRC, js
from settings_pages_page import live


def dashboard_text(shell: bool = True) -> str:
    """The settings page files outside MOD-settings-pages' routes: the shell, src/site-frame/dashboard-app.mjs; `shell=False`:
    none, since no view or settings section of the shell is a file of its own."""
    return "\n".join(f.read_text(encoding="utf-8") for f in ([SRC / "site-frame" / "dashboard-app.mjs"] if shell else []))


def mailbox_text() -> str:
    """MOD-settings-pages' mailbox route source, where the disclosure gates store the mailbox setting."""
    return (SRC / "settings-pages" / "mailbox.mjs").read_text(encoding="utf-8")


TOKEN_LINE = """
const l = lines(await render()).find((x) => x.title === "GitHub token");
const one = (name) => elements(l.node, (e) => e.className.split(" ").includes(name))[0];
const order = elements(l.node, () => true);
"""


class SettingsDisclosure(unittest.TestCase):
    def test_notice_names_the_owner_domain(self):
        n = live("const t = await render(); return byClass(t, 'settings-shared-origin')[0].textContent;")
        self.assertIn("akmaier.github.io", n)
        self.assertIn("every github pages site", n.lower())

    def test_the_page_shows_the_notice_before_the_input(self):
        r = live(TOKEN_LINE + """
const secret = one("settings-repository-secret"), notice = one("settings-repository-shared-origin"), ack = one("settings-repository-ack"), save = one("settings-repository-save");
const closed = { secretDisabled: secret.disabled, saveDisabled: save.disabled };
await pressed(elements(l.node, (e) => e.localName === "button" && e.textContent === "Change")[0]);
const opened = { noticeHidden: notice.hidden, secretDisabled: secret.disabled, saveDisabled: save.disabled };
const before = { notice: order.indexOf(notice), ack: order.indexOf(ack), save: order.indexOf(save) };
ack.checked = true; ack.dispatchEvent(new Event("change"));
return { closed, opened, before, ticked: { secretDisabled: secret.disabled, saveDisabled: save.disabled } };
""")
        self.assertTrue(r["closed"]["secretDisabled"], "the token input must start disabled")
        self.assertTrue(r["closed"]["saveDisabled"])
        self.assertFalse(r["opened"]["noticeHidden"], "Change shows the notice")
        self.assertTrue(r["opened"]["secretDisabled"], "still disabled until the notice is acknowledged")
        self.assertTrue(r["opened"]["saveDisabled"])
        self.assertLess(r["before"]["notice"], r["before"]["ack"])
        self.assertLess(r["before"]["notice"], r["before"]["save"])
        self.assertFalse(r["ticked"]["secretDisabled"], "counter-proof: acknowledged, the input opens")
        self.assertFalse(r["ticked"]["saveDisabled"])


def store_test_handler() -> str:
    src = mailbox_text()
    start = src.index('storeTest.addEventListener("click"')
    end = src.index('setup.addEventListener("click"', start)
    return src[start:end]


class MailboxSettingsDisclosure(unittest.TestCase):
    """SPEC §14 mailbox disclosures before a mailbox connection is stored."""

    # TST-532005 · level: release · module: system
    # guards: THE MAILBOX PASSWORD IS STORED ONLY AFTER ITS OWN DISCLOSURE
    # given: MOD-settings-pages' mailbox source, with the IMAP Store and test handler and the password notice text
    # input: the password notice gate and the first write of the mailbox setting on the IMAP path
    # expect: the notice names the owner Pages origin, reading all mail, sending mail in the mailbox name and the named Bridge; the handler returns before the mailbox write when the notice is unread or the password is empty
    # TST-584026 · level: release · module: system
    # guards: THE MAILBOX PASSWORD IS STORED ONLY AFTER ITS OWN DISCLOSURE
    # given: MOD-settings-pages' mailbox source, with the IMAP Store and test handler and the password notice text
    # input: the password notice gate and the first write of the mailbox setting on the IMAP path
    # expect: the notice names the owner Pages origin, reading all mail, sending mail in the mailbox name and the named Bridge; the handler returns before the mailbox write when the notice is unread or the password is empty
    def test_mailbox_password_disclosure_stands_before_the_password_is_stored(self):
        src = mailbox_text()
        notice = re.search(r'el\("p", "notice mailbox-password-notice", `([^`]+)`\)', src, re.S)
        self.assertIsNotNone(notice, "password notice missing")
        for words in ["Every GitHub Pages site under", "can read it", "read all mail", "send mail in its name",
                      "no server except the Bridge this connection names"]:
            self.assertIn(words, notice.group(1))
        body = store_test_handler()
        store = body.index('writeSetting(store, "mailbox", connection);')
        self.assertLess(body.index("if (!passwordRead.checked)"), store)
        self.assertLess(body.index("if (!password.value)"), store)
        self.assertIn("Nothing was stored", body[:store])

    # TST-532006 · level: release · module: system
    # guards: A MAILBOX THROUGH THE JUMP HOST IS NAMED AS READABLE THERE
    # given: MOD-settings-pages' mailbox source, with Bridges that may or may not be reached through the jump host
    # input: the jump-host notice, the Bridge selection visibility rule and the first mailbox write on the IMAP path
    # expect: only a jump-host Bridge shows the notice, the notice names that the password and mails pass it and can be read by its administrator, and the handler returns before storing until that notice is read
    # TST-584027 · level: release · module: system
    # guards: A MAILBOX THROUGH THE JUMP HOST IS NAMED AS READABLE THERE
    # given: MOD-settings-pages' mailbox source, with Bridges that may or may not be reached through the jump host
    # input: the jump-host notice, the Bridge selection visibility rule and the first mailbox write on the IMAP path
    # expect: only a jump-host Bridge shows the notice, the notice names that the password and mails pass it and can be read by its administrator, and the handler returns before storing until that notice is read
    def test_mailbox_jump_host_disclosure_blocks_only_the_jump_host_route(self):
        src = mailbox_text()
        notice = re.search(r'const jumpNotice = el\("p", "notice mailbox-jump-notice", "([^"]+)"\);', src)
        self.assertIsNotNone(notice, "jump-host notice missing")
        for words in ["password and the mails pass the jump host", "administers the jump host can read them"]:
            self.assertIn(words, notice.group(1))
        self.assertIn("jumpNotice.hidden = !chosen()?.throughJumpHost", src)
        self.assertIn("jumpRead.hidden = jumpNotice.hidden", src)
        body = store_test_handler()
        store = body.index('writeSetting(store, "mailbox", connection);')
        self.assertLess(body.index("if (bridge.throughJumpHost && !jumpRead.checked)"), store)
        self.assertIn("jumpHostNoted: bridge.throughJumpHost", body)

    # TST-532007 · level: release · module: system
    # guards: A PLACE OUTSIDE THE EU IS NAMED AS NOT COMPLIANT
    # given: MOD-settings-pages' mailbox source and fixture processing places inside and outside the EU
    # input: isOutsideEu for this machine, an EU data centre and a USA provider; the outside-EU notice gate and the first mailbox write
    # expect: this machine and the EU data centre are inside the EU, the USA provider is outside it, the notice names non-compliance with GDPR and the EU AI Act, and the handler returns before storing until that notice is read
    # TST-584028 · level: release · module: system
    # guards: A PLACE OUTSIDE THE EU IS NAMED AS NOT COMPLIANT
    # given: MOD-settings-pages' mailbox source and fixture processing places inside and outside the EU
    # input: isOutsideEu for this machine, an EU data centre and a USA provider; the outside-EU notice gate and the first mailbox write
    # expect: this machine and the EU data centre are inside the EU, the USA provider is outside it, the notice names non-compliance with GDPR and the EU AI Act, and the handler returns before storing until that notice is read
    def test_mailbox_outside_eu_disclosure_blocks_the_store_until_read(self):
        src = mailbox_text()
        notice = re.search(r'const PLACE_NOTICE = "([^"]+)"', src)
        self.assertIsNotNone(notice, "outside-EU notice missing")
        for words in ["does not comply", "GDPR", "EU AI Act"]:
            self.assertIn(words, notice.group(1))
        self.assertEqual(js("return [settingsPagesMailbox.isOutsideEu('this machine'), "
                            "settingsPagesMailbox.isOutsideEu('FAU data centre (EU)'), "
                            "settingsPagesMailbox.isOutsideEu('Anthropic, a provider in the USA')];"),
                         [False, False, True])
        body = store_test_handler()
        store = body.index('writeSetting(store, "mailbox", connection);')
        self.assertLess(body.index("ticked.some(isOutsideEu) && !placeRead.checked"), store)
        self.assertIn("Nothing was stored", body[:store])


if __name__ == "__main__":
    unittest.main()


PRODUCT = """
const productHost = (visibility, writes) => ({
  async repositoryInfo() { return { defaultBranch: "main", canWrite: true, visibility }; },
  async readSnapshot() { return { commit: "1".repeat(40), paths: [], blob: () => null, async read() { return null; } }; },
  async commitFiles(change) { writes.push(change); return { commit: "2".repeat(40), url: "https://github.com/alice/thesis/commit/" + "2".repeat(40) }; },
});
async function productPage(visibility) {
  const writes = [];
  const t = await render("settings", { product: { address: "https://github.com/alice/thesis", kind: "github", host: productHost(visibility, writes), tokenStored: true } });
  const section = elements(t, (e) => e.localName === "section" && e.className.split(" ").includes("settings-product"))[0];
  const one = (name) => elements(section, (e) => e.className.split(" ").includes(name))[0];
  return { t, section, writes, one, notices: elements(section, (e) => e.className.split(" ").includes("notice")).map((e) => e.textContent) };
}
"""
SETUP = {"github-token": {"value": "github_pat_11SECRETVALUEabcdefghijklmnop", "name": "GitHub token", "expires": "2027-12-29", "stored": "2026-09-01"}}


class PseudonymisationOffDisclosure(unittest.TestCase):
    """SPEC §14 SWITCHING PSEUDONYMISATION OFF STATES WHAT FOLLOWS: the product section of the Settings page."""

    def test_the_notice_states_what_follows(self):
        n = live(PRODUCT + "const p = await productPage('private'); return p.notices.join(' ');", SETUP)
        self.assertIn("unchanged", n)
        self.assertIn("issues", n)
        self.assertIn("protected, non-public", n)
        self.assertNotIn("published", n, "a private repository is not warned of publication")

    def test_a_public_repository_is_warned_of_publication(self):
        n = live(PRODUCT + "const p = await productPage('public'); return p.notices.join(' ');", SETUP)
        self.assertIn("public", n)
        self.assertIn("will be published", n)

    def test_the_page_shows_the_notice_before_saving(self):
        r = live(PRODUCT + """
const p = await productPage('private');
const order = elements(p.section, () => true);
const off = p.one("settings-pseudonymisation-off"), ack = p.one("settings-pseudonymisation-ack"), save = p.one("settings-pseudonymisation-save");
const notice = order.find((e) => e.className === "notice" && e.textContent.includes("With pseudonymisation off"));
off.checked = true;
await pressed(save);
const unticked = p.writes.length;
ack.checked = true;
await pressed(save);
return { notice: order.indexOf(notice), save: order.indexOf(save), unticked, ticked: p.writes.length };
""", SETUP)
        self.assertLess(r["notice"], r["save"])
        self.assertEqual(r["unticked"], 0, "Save before the tick writes nothing")
        self.assertEqual(r["ticked"], 1, "known positive: Save after the tick commits once")


# Guards: EVERY STEP EXPLAINS ITSELF; SWITCHING PSEUDONYMISATION OFF STATES WHAT FOLLOWS; UC-042
class PseudonymisationExplained(unittest.TestCase):
    """The product setting *Pseudonymisation* (UC-042 step 4) states what follows from switching it off, and no longer speaks of
    stand-ins (surrogates were withdrawn)."""

    STALE = re.compile(r"stand-?ins?\b|surrogat", re.I)

    def test_the_section_states_what_the_requirement_says_and_no_stand_ins(self):
        # SWITCHING PSEUDONYMISATION OFF STATES WHAT FOLLOWS: unchanged into the issues and the repository; advisable only on a
        # protected, non-public data space; and for a public repository, published. The words of the old explanation text
        # ("three", "different models", "default", "mentions no person") are in no sentence of the requirement.
        e = live(PRODUCT + "const p = await productPage('private'); return p.section.textContent;", SETUP).lower()
        self.assertIn("unchanged", e)
        self.assertIn("issues and the repository", e)
        self.assertIn("advisable only on a protected, non-public data space", e)
        self.assertIsNone(self.STALE.search(e), "no stand-ins: surrogates are withdrawn")

    def test_the_dashboard_says_neither_stand_in_nor_surrogate(self):
        pages = "\n".join(f.read_text(encoding="utf-8") for f in sorted((SRC / "settings-pages").glob("*.mjs")))
        hit = self.STALE.search(dashboard_text() + pages + (SRC / "site-frame" / "explanations.md").read_text(encoding="utf-8"))
        self.assertIsNone(hit, f"the dashboard still says {hit.group(0)!r}" if hit else "")

    def test_the_setting_shows_a_folded_explanation(self):
        r = live(PRODUCT + "const p = await productPage('private');"
                 " return elements(p.section, (e) => e.localName === 'details' && e.className === 'explain').map((e) => e.textContent);", SETUP)
        self.assertTrue(any(t.startswith("What is this?") for t in r), "the setting has a folded explanation")


# The Settings page in a small DOM, as tests/settings-pages-recording.test.mjs renders it (its fixture shapes, written again here):
# the instance fixture/instance is a fixture host keeping to MOD-repository-hosts' interface (repositoryInfo, readSnapshot, commitFiles;
# every commit recorded), and the products this browser keeps are read through the real GitHub host over a fixture fetch that answers
# GET /repos/<owner>/<name> from memory. Nothing reaches the network.
RECORDING_PAGE = r"""
class Element {
  constructor(name) { this.localName = name; this.childNodes = []; this.className = ""; this.value = ""; this.type = ""; this.checked = false; this.disabled = false; this.hidden = false; this.attributes = new Map(); this.listeners = []; }
  append(...nodes) { for (const node of nodes.flat()) this.childNodes.push(typeof node === "string" ? new Text(node) : node); }
  replaceChildren(...nodes) { this.childNodes = []; this.append(...nodes); }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  addEventListener(type, listener) { this.listeners.push([type, listener]); }
  fire(type, event = {}) { return Promise.all(this.listeners.filter(([kind]) => kind === type).map(([, listener]) => listener({ type, target: this, currentTarget: this, ...event }))); }
  focus() {}
  get textContent() { return this.childNodes.map((child) => child.textContent).join(""); }
  set textContent(value) { this.replaceChildren(String(value)); }
}
class Text { constructor(value) { this.value = String(value); } get textContent() { return this.value; } }
class Storage {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
  get length() { return this.values.size; }
  key(index) { return [...this.values.keys()][index] ?? null; }
}
globalThis.document = { createElement: (name) => new Element(name) };
const storage = new Storage();
Object.defineProperty(globalThis, "localStorage", { configurable: true, value: storage });
const descendants = (root, test) => {
  const found = [];
  (function visit(node) { for (const child of node.childNodes ?? []) { if (child instanceof Element) { if (test(child)) found.push(child); visit(child); } } })(root);
  return found;
};
const all = (root, name) => descendants(root, (node) => node.className.split(" ").includes(name));
const one = (root, name) => all(root, name)[0];
const stored = () => JSON.stringify([...storage.values.entries()]);
const instanceHost = (visibility) => {
  const writes = [];
  const files = { "README.md": "# Instance\n" };
  return {
    writes,
    async repositoryInfo() { return { defaultBranch: "main", canWrite: true, visibility }; },
    async readSnapshot() { return { commit: "1".repeat(40), paths: Object.keys(files), blob: () => null, async read(path) { return files[path] ?? null; } }; },
    async commitFiles(change) { writes.push(change); return { commit: "2".repeat(40), url: "https://github.com/fixture/instance/commit/" + "2".repeat(40) }; },
  };
};
const servers = (visibilities) => async (url) => {
  const hit = /^https:\/\/api\.github\.com\/repos\/([^/]+\/([^/]+))$/.exec(String(url));
  const visibility = hit && visibilities[hit[2]];
  const answer = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  if (!visibility) return answer({ message: "Not Found" }, 404);
  return answer({ default_branch: "main", visibility, private: visibility !== "public", permissions: { push: true }, archived: false, description: "" });
};
// The Settings page of fixture/instance (its server reports it `instanceVisibility`) over the products named (each with what its
// server reports), opened on its tab Repositories; what the person sees and what is stored at each step of the switch.
async function recordingSwitch({ instanceVisibility, products, visibilities }) {
  globalThis.fetch = servers(visibilities);
  const host = instanceHost(instanceVisibility);
  const store = browserStore.openStore("fixture/instance");
  browserStore.writeSetting(store, "products", products);
  const target = document.createElement("div");
  await settingsPagesSettings.route.render(target, { instance: { repository: "fixture/instance", host }, product: null, store, go() {} }, {});
  await all(target, "settings-tab")[1].fire("click", { isTrusted: true });
  for (let turn = 0; turn < 5; turn += 1) await new Promise((resolve) => setImmediate(resolve));
  const line = one(target, "settings-recording");
  const beforeSwitchOn = { stored: stored(), writes: host.writes.length };
  await one(line, "settings-recording-on").fire("click", { isTrusted: true });
  const notice = one(line, "settings-recording-notice");
  const shown = { noticeText: notice.textContent, publicLine: one(notice, "settings-recording-public").textContent, noticeHidden: notice.hidden };
  const save = one(line, "settings-recording-save");
  await save.fire("click", { isTrusted: true });
  const afterUnacknowledgedSave = { stored: stored(), writes: host.writes.length };
  const box = one(line, "settings-recording-ack");
  box.checked = true;
  await box.fire("change");
  await save.fire("click", { isTrusted: true });
  return { beforeSwitchOn, shown, afterUnacknowledgedSave, writesAfterAcknowledgedSave: host.writes.length };
}
"""

PUBLIC_PRODUCT = "https://github.com/fixture/public-product"
PRIVATE_PRODUCT = "https://github.com/fixture/private-product"


class RecordingConversationsDisclosure(unittest.TestCase):
    """SPEC §13 SWITCHING CONVERSATION RECORDING ON STATES WHAT FOLLOWS: the line *Recording conversations* of the Settings page
    (UC-042 step 3), reached through settingsPagesSettings.route over fixture hosts, as tests/settings-pages-recording.test.mjs
    reaches it. Fixture: an instance whose server reports it public, and two products this browser keeps, fixture/public-product
    whose server reports it public and fixture/private-product whose server reports it private."""

    @staticmethod
    def switch() -> dict:
        given = {"instanceVisibility": "public", "products": [PUBLIC_PRODUCT, PRIVATE_PRODUCT],
                 "visibilities": {"public-product": "public", "private-product": "private"}}
        return js(RECORDING_PAGE + f"return await recordingSwitch({json.dumps(given)});")

    # TST-1429039 · level: component · module: MOD-settings-pages
    # guards: SWITCHING CONVERSATION RECORDING ON STATES WHAT FOLLOWS
    # given: the fixture above, opened on the tab Repositories
    # input: the person presses Switch on; presses Save before ticking I have read this; then ticks it and presses Save
    # expect: Switch on shows the notice and stores nothing; Save before the tick stores nothing (no commit, no browser setting changed); Save after the tick commits once (the known positive that shows the check sees a commit)
    def test_the_switch_stores_nothing_before_the_notice_is_acknowledged(self):
        r = self.switch()
        self.assertFalse(r["shown"]["noticeHidden"], "Switch on shows the notice")
        self.assertEqual(r["beforeSwitchOn"]["writes"], 0)
        self.assertEqual(r["afterUnacknowledgedSave"]["writes"], 0, "Save before the tick commits nothing")
        self.assertEqual(r["afterUnacknowledgedSave"]["stored"], r["beforeSwitchOn"]["stored"],
                         "Switch on and Save before the tick change no browser setting")
        self.assertEqual(r["writesAfterAcknowledgedSave"], 1, "known positive: Save after the tick commits once")

    # TST-1429040 · level: component · module: MOD-settings-pages
    # guards: SWITCHING CONVERSATION RECORDING ON STATES WHAT FOLLOWS
    # given: the fixture above
    # input: the person presses Switch on
    # expect: the notice states that every message of a conversation will be committed under docs/conversations/, that it stays in that repository's history and that conversations held on a public repository's pages will be published; the line of public repositories names fixture/instance (as published) and the address https://github.com/fixture/public-product
    def test_the_notice_names_the_public_product_and_the_instance_as_published(self):
        r = self.switch()
        notice, public = r["shown"]["noticeText"], r["shown"]["publicLine"]
        for words in ["Every message of a conversation", "will be committed", "docs/conversations/",
                      "stays in that repository's history", "will be published"]:
            self.assertIn(words, notice)
        self.assertIn("fixture/instance", public)
        self.assertIn(PUBLIC_PRODUCT, public)

    # TST-1429041 · level: component · module: MOD-settings-pages
    # guards: SWITCHING CONVERSATION RECORDING ON STATES WHAT FOLLOWS
    # given: the fixture above
    # input: the person presses Switch on
    # expect: the address https://github.com/fixture/private-product, whose server reports it private, is in no part of the notice, so it is not named as public
    def test_a_private_product_is_not_named_as_public(self):
        r = self.switch()
        self.assertNotIn(PRIVATE_PRODUCT, r["shown"]["publicLine"])
        self.assertNotIn("private-product", r["shown"]["noticeText"])
