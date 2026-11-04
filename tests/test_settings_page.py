# Module: MOD-settings-pages
# Guards: EVERY SETTING IS REACHED FROM ONE PAGE; A BROWSER SETTING IS TESTED AND CLEARED WHERE IT IS SHOWN; A STORED SECRET IS HIDDEN UNTIL SHOWN; A TOKEN'S EXPIRY IS WARNED OF IN ADVANCE; THE JUMP HOST AND THE REMOTE SESSIONS ARE SETTINGS; THE DASHBOARD WRITES THE TUNNEL COMMANDS; A PRODUCT'S SETTINGS LIVE IN ITS REPOSITORY; UC-042
# Level: component
"""SPEC §7 EVERY SETTING IS REACHED FROM ONE PAGE · A BROWSER SETTING IS TESTED AND CLEARED WHERE IT IS SHOWN · A STORED SECRET IS
HIDDEN UNTIL SHOWN · A TOKEN'S EXPIRY IS WARNED OF IN ADVANCE (UC-042). A PRODUCT'S SETTINGS LIVE IN ITS REPOSITORY: changing a product
setting commits to the product's repository (the page's *Save* of the pseudonymisation), and the browser's store holds none.

The page is MOD-settings-pages' route `settings`, drawn in the DOM of tests/settings-pages-harness.mjs over a browser store the case
fills (tests/settings_pages_page.py). "Appears on the page" is checked on what that page shows.
"""
import datetime
import json
import re
import unittest

from jsrun import SRC, js
from settings_pages_page import live

STORE = SRC / "browser-store"
CATALOGUE = STORE / "catalogue.mjs"
SECRET = "github_pat_11SECRETVALUEabcdefghijklmnop"
TOKEN = {"value": SECRET, "name": "GitHub token", "expires": "2026-12-29", "stored": "2026-09-01"}
GL_KEY = "gitlab-token:gitlab.example.org/grp/sub/proj"
GL_ADDR = "https://gitlab.example.org/grp/sub/proj"
GL_SECRET = "glpat-GITLABSECRETvalue0123456789"
BRIDGE_SECRET = "bridgeSECRETtoken0123456789"
JUMP = {"hostname": "jump.example.org", "user": "agentm", "sshPort": 22, "portRange": [20001, 20010],
        "httpsAddress": "https://jump.example.org/agent-m"}

# A line of the page and the text of its status paragraph, by the title the line opens with.
LINE = """
const line = (t, title) => lines(t).find((l) => l.title === title);
const secrets = (l, value) => elements(l.node, (e) => e.localName === "input" && e.value === value).map((e) => e.type);
const status = (l) => elements(l.node, (e) => e.className.split(" ").some((c) => c.endsWith("-status"))).map((e) => e.textContent)[0] ?? null;
const shown = (l) => elements(l.node, (e) => e.localName === "button" && e.textContent === "Show")[0];
"""


def keys_written(catalogue_source: str) -> list[str]:
    """Every key MOD-browser-store can write: its literal keys, and each family as a key with a sample name after its prefix; a family
    whose value ends in `:[^:]+` (a key of two names) is sampled with both names."""
    literal = re.search(r"LITERAL_KEYS = new Set\(\[(.*?)\]\)", catalogue_source, re.S).group(1)
    families = re.search(r"KEY_FAMILIES = \[(.*?)\];", catalogue_source, re.S).group(1)
    return re.findall(r'"([^"]+)"', literal) + [p + "sample" + (":sample" if last else "")
                                                 for p, last in re.findall(r"/\^([a-z-]+:)\.\+(:\[\^:\]\+)?\$/", families)]


def keys_without_place(keys: list[str], places: dict) -> list[str]:
    """The keys the store writes for which the table of places names no place on the page."""
    return [k for k in keys if k not in places]


# Every key MOD-browser-store writes, and the text the live page shows for it once it is stored. A key carried by another line is
# named with that line's text.
PLACES = {
    "github-token": "GitHub token", "products": "Products", "notifications": "Notifications", "notified": "Notifications",
    "bridge": "Bridge", "jump-host": "Jump host", "mailbox": "Mailbox", "browser": "Browser identifier", "not-an-issue": "Mails marked not an issue",
    "github-token:sample": "GitHub token: sample", "gitlab-token:sample": "GitLab token: sample", "endpoint:sample": "Endpoint: sample",
    "bridge:sample": "Bridge: sample", "remote-session:sample": "Remote session: sample", "session:sample:sample": "CLI session: sample:sample",
    "last-test:sample": "GitHub token", "acknowledged:sample": "GitHub token", "resource-key:sample": "Resource key: sample",
}
STORED = {
    "github-token": TOKEN, "products": ["https://github.com/alice/thesis"], "notifications": {"on": False}, "notified": ["docs/a.md"],
    "bridge": {"address": "https://bridge.example.test", "token": "bridgetok"}, "jump-host": JUMP,
    "mailbox": {"address": "me@example.org", "route": "imap", "imap": {"bridge": "lab"}, "folders": ["INBOX"], "places": []}, "browser": "0123456789abcdef", "not-an-issue": ["MAIL-0123456789abcdef"],
    "github-token:sample": TOKEN, "gitlab-token:sample": TOKEN,
    "endpoint:sample": {"url": "https://m.example/v1", "kind": "openai-compatible", "model": "m", "key": "k", "throughBridge": False},
    "bridge:sample": {"address": "http://localhost:8765", "token": "labtok"}, "remote-session:sample": {"port": 20001, "token": BRIDGE_SECRET},
    "session:sample:sample": {"place": "this computer", "context": 200000, "model": "claude-opus-5", "capabilities": ["read the repository"]},
    "last-test:sample": {"at": "2026-09-29T10:00:00.000Z", "outcome": "working"}, "acknowledged:sample": "2026-09-01",
    "resource-key:sample": {"value": "hub_KEY0123456789", "stored": "2026-09-01T00:00:00.000Z"},
}


class EverySettingOnOnePage(unittest.TestCase):
    def test_every_key_the_store_writes_has_a_place_on_the_page(self):
        keys = keys_written(CATALOGUE.read_text(encoding="utf-8"))
        self.assertGreaterEqual(len(keys), 3)
        self.assertEqual(keys_without_place(keys, PLACES), [], "every key MOD-browser-store writes is named in the table of places")
        # With everything stored, the page shows the text of each place; with a browser that holds nothing, the lines of the literal settings.
        shown = live("const t = await render(); return t.textContent;", STORED)
        for key, text in PLACES.items():
            self.assertIn(text, shown, f"{key} has its place on the page")
        empty = live("const t = await render(); return t.textContent;")
        for text in ("GitHub token", "Products", "Notifications"):
            self.assertIn(text, empty, f"{text} has its place in an empty browser")

    def test_the_store_writes_no_key_but_its_named_ones(self):
        # A key outside the catalogue would escape the check above: MOD-browser-store refuses to write one, and nothing is stored.
        v = js("""
const mem = new Map();
globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k),
  get length() { return mem.size; }, key: (i) => [...mem.keys()][i] ?? null };
const store = browserStore.openStore('a/agent-m');
let refused = null;
try { browserStore.writeSetting(store, 'bridge-token', 'x'); } catch (error) { refused = error.name; }
browserStore.writeSetting(store, 'products', ['https://github.com/alice/thesis']);
return { refused, keys: [...mem.keys()] };
""")
        self.assertEqual(v["refused"], "UnknownSetting")
        self.assertEqual(v["keys"], ["agent-m:a/agent-m:products"], "known positive: a key of the catalogue is written; the other is not")

    def test_counter_proof_a_key_without_a_place_fails(self):
        fixture = keys_written(CATALOGUE.read_text(encoding="utf-8")) + ["bridge-token"]
        self.assertEqual(keys_without_place(fixture, PLACES), ["bridge-token"])


# UC-042 step 3: every setting the instance's and a product's repository keep, and the title of its line on the page.
REPOSITORY_PLACES = {
    "participants": "Participants", "source library": "Source library", "process models": "Process models", "instance resources": "Resources",
    "process model": "Process model", "role assignments": "Role assignments", "definition of done": "Definition of Done",
    "test schedule": "Test schedule", "linked sources": "Linked sources", "resources": "Resources",
}


def repository_settings_without_place(settings: list[str], places: dict) -> list[str]:
    """The repository settings for which the table of places names no line on the page."""
    return [name for name in settings if name not in places]


class EveryRepositorySettingHasALine(unittest.TestCase):
    def test_each_repository_setting_has_a_place_and_the_page_draws_its_line(self):
        source = (SRC / "settings-pages" / "settings.mjs").read_text(encoding="utf-8")
        self.assertEqual(repository_settings_without_place(list(REPOSITORY_PLACES), REPOSITORY_PLACES), [])
        self.assertEqual(len(REPOSITORY_PLACES), 10, "UC-042's table names ten repository settings besides the switch, pseudonymisation and collaborators")
        for setting, title in REPOSITORY_PLACES.items():
            self.assertIn(f'"{title}"', source, f"{setting} has a line titled {title} in the module that draws the page")

    def test_counter_proof_a_repository_setting_without_a_line_fails(self):
        fixture = list(REPOSITORY_PLACES) + ["retention"]
        self.assertEqual(repository_settings_without_place(fixture, REPOSITORY_PLACES), ["retention"])


class TestedAndCleared(unittest.TestCase):
    def test_each_browser_setting_has_test_and_clear(self):
        # A line is tested and cleared by its own Test and Clear; the mailbox is cleared by Disconnect, the notifications by Switch off,
        # the product list is tested address by address under Managed products.
        r = live("const t = await render(); return lines(t).map((l) => [l.title, l.buttons]);", STORED)
        buttons = {title: b for title, b in r}
        clears = ("Clear", "Disconnect", "Switch off")
        for title in ("GitHub token", "Products", "GitHub token: sample", "GitLab token: sample", "Jump host", "Remote session: sample",
                      "Bridge: sample", "Endpoint: sample", "CLI session: sample:sample", "Mailbox", "Notifications"):
            self.assertTrue(any(c in buttons[title] for c in clears), f"{title} can be cleared")
        for title in ("GitHub token", "GitHub token: sample", "GitLab token: sample", "Jump host", "Remote session: sample",
                      "Bridge: sample", "Endpoint: sample", "CLI session: sample:sample", "Mailbox", "Notifications"):
            self.assertIn("Test", buttons[title], f"{title} can be tested")
        self.assertIn("Test", buttons["Managed products"], "each product address is tested where the list is shown")

    def test_the_paired_bridge_can_be_tested(self):
        r = live("const t = await render(); return lines(t).find((l) => l.title === 'Bridge').buttons;", STORED)
        self.assertIn("Test", r, "the line of the paired Bridge has a Test")

    def test_the_last_test_is_read_from_the_browser(self):
        # UC-042 step 1 (ITM-136): the line shows the last test kept in this browser beside the token.
        worked = live(LINE + "return status(line(await render(), 'GitHub token'));", {"github-token": TOKEN,
                      "last-test:github-token": {"at": "2026-09-29T10:00:00.000Z", "outcome": "working"}}, now="2026-09-30")
        self.assertIn("Works. Last successful test: 2026-09-29", worked)
        refused = live(LINE + "return status(line(await render(), 'GitHub token'));", {"github-token": TOKEN,
                       "last-test:github-token": {"at": "2026-09-29T10:00:00.000Z", "outcome": "refused"}}, now="2026-09-30")
        self.assertIn("Refused.", refused)
        # Counter-proof: without a kept test the line names neither; without a token it says not set.
        untested = live(LINE + "return status(line(await render(), 'GitHub token'));", {"github-token": TOKEN}, now="2026-09-30")
        self.assertNotIn("Works", untested)
        self.assertNotIn("Refused", untested)
        self.assertEqual(live(LINE + "return status(line(await render(), 'GitHub token'));"), "Not set.")

    def test_counter_proof_a_line_without_clear_is_seen(self):
        lines_ = {"Test only": ["Test"], "Test and Clear": ["Test", "Clear"]}
        self.assertEqual([t for t, b in lines_.items() if "Clear" not in b], ["Test only"])


class SecretHiddenUntilShown(unittest.TestCase):
    PROBE = LINE + """
const l = line(await render(), TITLE);
const before = { inputs: secrets(l, SECRET), inText: l.node.textContent.includes(SECRET) || l.node.textContent.includes(SECRET.slice(-4)) };
await pressed(shown(l));
return { before, after: secrets(l, SECRET) };
"""

    def probe(self, title, key, value, secret):
        return live(f"const TITLE = {json.dumps(title)}, SECRET = {json.dumps(secret)};" + self.PROBE, {key: value})

    def test_a_stored_secret_is_rendered_hidden(self):
        r = self.probe("GitHub token", "github-token", TOKEN, SECRET)
        self.assertEqual(r["before"]["inputs"], ["password"], "the secret is in one field, hidden")
        self.assertFalse(r["before"]["inText"], "not in the page's text, not even its last characters")

    def test_counter_proof_after_show_it_appears_in_full(self):
        r = self.probe("GitHub token", "github-token", TOKEN, SECRET)
        self.assertEqual(r["after"], ["text"])


class ExpiryWarnedInAdvance(unittest.TestCase):
    def test_default_expiry_is_the_links_90_days(self):
        v = live("""
const products = await import(%s);
const link = new URL(pages.view ? new URL(await (async () => { const host = (await import(%s)); return host.connect(host.parseAddress('https://github.com/a/agent-m'), {}).webLinks().newToken('n', 'd', 90); })()).href : '');
return [products.defaultExpiry(new Date('2026-09-30T08:00:00Z')), link.searchParams.get('expires_in')];
""" % (json.dumps((SRC / "settings-pages" / "products.mjs").as_uri()), json.dumps((SRC / "repository-hosts" / "index.mjs").as_uri())))
        self.assertEqual(v, ["2026-12-29", "90"])

    def test_warning_from_fourteen_days_before(self):
        # The frame's notice (MOD-site-frame, showTokenNotices): 15 days before, no notice yet; 14 days, today and past are named.
        w = frame_notices("2026-09-30", [{"expires": d} for d in ("2026-10-15", "2026-10-14", "2026-09-30", "2026-09-29", None)])
        self.assertEqual(w[0], [], "15 days before: no warning yet")
        self.assertEqual([n["kind"] for n in w[1]], ["token-expiring"])
        self.assertIn("expires on 2026-10-14", w[1][0]["text"])
        self.assertIn("GitHub token", w[1][0]["text"], "which token")
        self.assertEqual(w[1][0]["href"], "https://github.com/settings/personal-access-tokens", "where it is renewed")
        self.assertIn("expires on 2026-09-30", w[2][0]["text"], "today: not yet expired")
        self.assertIn("expired on 2026-09-29", w[3][0]["text"])
        self.assertEqual(w[4], [], "no date recorded: nothing to warn of")

    def test_the_banner_on_every_page_carries_renew(self):
        b = frame_notices("2026-09-30", [{"expires": "2026-10-10"}, {"expires": "2026-12-29"}, {"expires": None, "refused": True}])
        self.assertIn("2026-10-10", b[0][0]["text"])
        self.assertEqual(b[0][0]["label"], "Renew")
        self.assertEqual(b[0][0]["href"], "https://github.com/settings/personal-access-tokens")
        self.assertEqual(b[1], [], "counter-proof: far from expiry, no notice")
        self.assertEqual(b[2][0]["kind"], "token-refused")
        self.assertIn("GitHub token", b[2][0]["text"])
        self.assertEqual((b[2][0]["label"], b[2][0]["href"]), ("Renew", "https://github.com/settings/personal-access-tokens"))
        app = (SRC / "site-frame" / "dashboard-app.mjs").read_text(encoding="utf-8")
        route = re.search(r"async function route\(\).*?\n}\n", app, re.S).group(0)
        self.assertIn("showBanner(", route, "the notices are drawn in route(), which renders every view")

    def test_storing_a_token_asks_for_its_expiry(self):
        # UC-042 step 2: storing a token asks for its expiry date, preset to the 90 days of the prefilled link; the date is stored with it.
        r = live("""
const t = await render("setup");
const date = elements(t, (e) => e.localName === "input" && e.type === "date")[0];
const ack = byClass(t, "ack")[0], token = byClass(t, "token")[0], storeButton = byClass(t, "store")[0];
ack.checked = true; ack.dispatchEvent(new Event("change"));
token.value = "github_pat_PASTED0123456789abcdefghijklmn";
const preset = date.value;
globalThis.fetch = async () => new Response(JSON.stringify({ default_branch: "main", visibility: "private", private: true, permissions: { push: true } }), { status: 200, headers: { "content-type": "application/json" } });
await pressed(storeButton);
return { preset, stored: bs.readSetting(store, "github-token") };
""", now="2026-09-30")
        ninety = (datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=90)).date().isoformat()
        self.assertEqual(r["preset"], ninety, "preset to the 90 days of the prefilled link")
        self.assertEqual(r["stored"]["expires"], ninety, "the date is stored with the token")
        self.assertEqual(r["stored"]["value"], "github_pat_PASTED0123456789abcdefghijklmn")

    def test_the_state_line_names_the_expiry(self):
        near = live(LINE + "return status(line(await render(), 'GitHub token'));", {"github-token": TOKEN}, now="2026-12-20")
        self.assertIn("Expires on 2026-12-29", near)
        self.assertIn("renew soon", near)
        far = live(LINE + "return status(line(await render(), 'GitHub token'));", {"github-token": TOKEN}, now="2026-09-30")
        self.assertIn("Expires on 2026-12-29", far)
        self.assertNotIn("renew soon", far, "counter-proof: far from expiry, no warning")


FRAME_DOM = """
const element = (name) => ({ localName: name, className: "", children: [], attrs: {}, textContent: "",
  append(...items) { this.children.push(...items); }, setAttribute(k, v) { this.attrs[k] = v; } });
globalThis.document = { createElement: element };
const mem = new Map();
globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k),
  get length() { return mem.size; }, key: (i) => [...mem.keys()][i] ?? null };
"""


def frame_notices(now: str, tokens: list) -> list:
    """For each stored GitHub token { expires, refused? } the notices MOD-site-frame draws at `now`: [{ kind, text, label, href }]."""
    return js(FRAME_DOM + f"""
const out = [];
for (const token of {json.dumps(tokens)}) {{
  mem.clear();
  const store = browserStore.openStore('a/agent-m');
  browserStore.writeSetting(store, 'github-token', {{ value: 'github_pat_x', name: 'GitHub token', expires: token.expires, stored: '2026-09-01' }});
  if (token.refused) browserStore.writeSetting(store, 'last-test:github-token', {{ at: '2026-09-30', outcome: 'refused' }});
  const place = siteFrameNotices.noticePlace();
  const host = repositoryHosts.connect(repositoryHosts.parseAddress('https://github.com/a/agent-m'), {{}});
  siteFrameNotices.showTokenNotices({{ store, instance: {{ host }}, now: new Date('{now}T12:00:00Z') }});
  out.push(place.children.map((p) => ({{ kind: p.className.replace('notice ', ''), text: p.children[0], label: p.children[2].textContent, href: p.children[2].attrs.href }})));
}}
return out;
""")


class ProductSettingsInTheRepository(unittest.TestCase):
    def test_the_store_has_no_product_setting(self):
        sources = sorted(STORE.glob("*.mjs"))
        self.assertTrue(any("writeSetting" in f.read_text(encoding="utf-8") for f in sources), "known positive: the store's own files are read")
        for f in sources:
            for word in ("pseudonym", "collaborator", "settings.md"):
                self.assertNotIn(word, f.read_text(encoding="utf-8").lower(), f.name)
        # The product section of the page: pseudonymisation switched off, the tick under the notice, and Save pressed by a person.
        v = live("""
const commits = [];
const product = { address: "https://github.com/alice/thesis", kind: "github", tokenStored: true, host: {
  async repositoryInfo() { return { defaultBranch: "main", canWrite: true, visibility: "private" }; },
  async readSnapshot() { return { commit: "1".repeat(40), paths: [], blob: () => null, async read() { return null; } }; },
  async commitFiles(change) { commits.push(change); return { commit: "2".repeat(40), url: "https://github.com/alice/thesis/commit/" + "2".repeat(40) }; } } };
const t = await render("settings", { product });
const one = (name) => elements(t, (e) => e.className.split(" ").includes(name))[0];
one("settings-pseudonymisation-off").checked = true;
one("settings-pseudonymisation-ack").checked = true;
await pressed(one("settings-pseudonymisation-save"));
return [commits.map((c) => c.files.map((f) => [f.path, f.text])), [...mem.keys()]];
""", {"github-token": TOKEN})
        commits, keys = v
        self.assertEqual([[path for path, _ in files] for files in commits], [["docs/settings.md"]],
                         "changing a product setting commits to the product")
        self.assertIn("pseudonymisation: off", commits[0][0][1])
        self.assertTrue(keys, "known positive: the browser's store holds the token")
        for key in keys:
            for word in ("pseudonym", "collaborator", "settings.md"):
                self.assertNotIn(word, key.lower(), "counter-proof: localStorage holds no product setting")


GL_SETUP = {GL_KEY: {"value": GL_SECRET, "name": "p", "expires": "2026-12-29", "stored": "2026-09-01"}}


class GitLabTokensOnThePage(unittest.TestCase):
    """UC-042: one line per GitLab project token — hidden with Show, Test, Change, Clear, its expiry date and where it is renewed."""

    TITLE = "GitLab token: gitlab.example.org/grp/sub/proj"

    def test_one_line_per_token_with_test_change_clear(self):
        r = live(LINE + "const l = line(await render(), %s); const renew = elements(l.node, (e) => e.className === 'settings-repository-renew')[0];"
                 " return { buttons: l.buttons, status: status(l), renew: renew.href };" % json.dumps(self.TITLE), GL_SETUP, now="2026-09-30")
        for control in ("Test", "Change", "Clear"):
            self.assertIn(control, r["buttons"], control)
        self.assertIn("2026-12-29", r["status"], "the expiry date recorded with the token")
        self.assertEqual(r["renew"], f"{GL_ADDR}/-/settings/access_tokens", "where it is renewed")

    def test_the_token_is_hidden_until_shown(self):
        r = SecretHiddenUntilShown().probe(self.TITLE, GL_KEY, GL_SETUP[GL_KEY], GL_SECRET)
        self.assertEqual(r["before"]["inputs"], ["password"])
        self.assertFalse(r["before"]["inText"])
        self.assertEqual(r["after"], ["text"])

    def test_expiry_warned_and_refusal_named(self):
        near = live(LINE + "return status(line(await render(), %s));" % json.dumps(self.TITLE),
                    {GL_KEY: {**GL_SETUP[GL_KEY], "expires": "2026-10-05"}}, now="2026-09-30")
        self.assertIn("renew soon", near)
        refused = live(LINE + "return status(line(await render(), %s));" % json.dumps(self.TITLE),
                       {**GL_SETUP, "last-test:" + GL_KEY: {"at": "2026-09-30T10:00:00.000Z", "outcome": "refused"}}, now="2026-09-30")
        self.assertIn("Refused.", refused)

    def test_counter_proof_no_token_no_line_but_the_setting_is_reached(self):
        # With no GitLab token stored the page shows no line for one; a GitLab product's token is set up on the page for adding a product,
        # which the line Products opens.
        r = live("const t = await render(); return [lines(t).map((l) => l.title), lines(t).find((l) => l.title === 'Products').buttons];")
        self.assertEqual([t for t in r[0] if t.startswith("GitLab token")], [])
        self.assertIn("Add or remove products", r[1])


JUMP_SETUP = {"jump-host": JUMP, "remote-session:lab-pc": {"port": 20001, "token": BRIDGE_SECRET}}


class JumpHostAndRemoteSessions(unittest.TestCase):
    """SPEC §7 THE JUMP HOST AND THE REMOTE SESSIONS ARE SETTINGS (UC-042, UC-011 1c): tested, cleared, the bridge token hidden until
    shown; §6 THE DASHBOARD WRITES THE TUNNEL COMMANDS — on the Bridge page the line's Change opens."""

    def test_the_jump_host_is_shown_with_test_change_clear(self):
        r = live(LINE + "const t = await render(); const l = line(t, 'Jump host'); const b = await render('bridge');"
                 " const v = elements(b, (e) => e.localName === 'input').map((e) => e.value);"
                 " return { text: l.node.textContent, buttons: l.buttons, form: v };", JUMP_SETUP)
        self.assertIn("jump.example.org", r["text"])
        self.assertIn("https://jump.example.org/agent-m", r["text"])
        for control in ("Test", "Change", "Clear"):
            self.assertIn(control, r["buttons"])
        # What the line does not show — the SSH user and the port range — is in the form its Change opens.
        for kept in ("agentm", "20001", "20010"):
            self.assertIn(kept, r["form"], kept)

    def test_each_session_has_its_test_and_clear_and_its_commands_on_the_bridge_page(self):
        r = live(LINE + "const t = await render(); const l = line(t, 'Remote session: lab-pc');"
                 " const b = await render('bridge'); return { buttons: l.buttons, text: l.node.textContent, bridge: b.textContent };", JUMP_SETUP)
        for control in ("Test", "Change", "Clear"):
            self.assertIn(control, r["buttons"])
        self.assertIn("20001", r["text"], "its port")
        self.assertIn("no tunnel is started here", r["text"])
        for command in ("-R 127.0.0.1:20001:127.0.0.1:", "-L 127.0.0.1:20001:127.0.0.1:20001", "agentm@jump.example.org"):
            self.assertIn(command, live("""
const commands = await import(%s);
const c = commands.tunnelCommands(%s, { name: 'lab-pc', port: 20001 }, undefined, { remote: '~/.ssh/agent-m-jump', local: '~/.ssh/id_ed25519' });
return c.reverse + ' | ' + c.forward;
""" % (json.dumps((SRC / "bridge-client" / "index.mjs").as_uri()), json.dumps(JUMP))), command)

    def test_the_bridge_token_is_hidden_until_shown(self):
        r = SecretHiddenUntilShown().probe("Remote session: lab-pc", "remote-session:lab-pc", JUMP_SETUP["remote-session:lab-pc"], BRIDGE_SECRET)
        self.assertEqual(r["before"]["inputs"], ["password"])
        self.assertFalse(r["before"]["inText"], "not in a command or a label")

    def test_counter_proof_after_show_the_bridge_token_appears_in_full(self):
        r = SecretHiddenUntilShown().probe("Remote session: lab-pc", "remote-session:lab-pc", JUMP_SETUP["remote-session:lab-pc"], BRIDGE_SECRET)
        self.assertEqual(r["after"], ["text"])

    def test_without_a_jump_host_no_command_is_written(self):
        r = live("const t = await render(); const b = await render('bridge'); return [t.textContent, b.textContent];",
                 {"remote-session:lab-pc": JUMP_SETUP["remote-session:lab-pc"]})
        self.assertNotIn("ssh -N", r[0])
        self.assertNotIn("ssh -N", r[1])


if __name__ == "__main__":
    unittest.main()
