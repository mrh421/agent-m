# Module: MOD-repository-hosts
# Guards: NO SERVER
# Level: unit
"""SPEC §0 NO SERVER — the built site contains no call to an origin other than the configured endpoints, the
repository servers of the instance and its products, the mail provider's API and sign-in, the local bridge, the jump
host's HTTPS address, and the package registries and resource hosts the page names before it calls them.

The built site is what Pages serves from the root of the repository (THE PAGES ROOT IS THE REPOSITORY ROOT) and a browser
runs. There is no build step, so it is the tracked files of the site: the main page index.html at the root, src/ with its
modules, style sheets and the lab's logo, and docs/ with the review pages, their modules, the vendored libraries, and the
Markdown files the review pages render — besides docs/, the root's README.md and PLAN.md; the SPEC is read by no test
on its own (KEIN SPEC-ZUGRIFF AUS PRODUKT-CODE). Three checks:

1. Every address written into the site's own code names a permitted host. Configured endpoints, the GitLab servers of
   products and the jump host come from the settings or from a product's address and are never written into the code,
   so the hosts that may stand there literally are GitHub's (the repository server of the instance and of GitHub
   products; github.com itself is navigation to GitHub's own pages), Microsoft Graph and its sign-in (the mail
   provider), the loopback names of the local bridge, and the two pages the site only links to — the lab's and the
   book's —, which no channel of check 2 may call. A package registry or resource host enters this list together with
   the notice that names it before it is called.
2. A request leaves the page only through a known channel, in the own code and in the vendored libraries alike: the
   repository hosts' request helper, whose origin gate admits only the addresses of the one repository a host is for —
   GitHub's API and raw hosts, or the product's own GitLab project (`prepare` in src/repository-hosts/failures.mjs, tested in
   tests/review-core.d/repository-hosts.test.mjs and tests/repository-hosts.test.mjs); the bridge probe on localhost; the dashboard's
   own view files and style sheets; MOD-spec-document's own skeleton.md, read from the address the module was loaded
   from; MOD-endpoint-calls' two senders, sentWithRetries and endpointResponse, given only requests whose address endpointUrl built
   from the configured baseUrl; MOD-checkout-tools' webfetch, which runs in Node only and which no module the site loads in a
   browser imports (a reading, stated at its entry below); and the own data files — schemas, models, practices —
   of the modules whose files state that they read them when
   they are loaded: MOD-documents, MOD-model-catalogue, MOD-participant-list, MOD-source-register, MOD-product-process,
   MOD-site-frame (its explanations.md), MOD-personal-data, MOD-resource-list, MOD-reuse-facts and MOD-prompt-bar,
   each at most once in its module's folder, in MOD-spec-document's form: `fetch(url)` in `ownFile(url)`, and every address the
   file builds resolved from a path beginning with `./` against the module's own address; and MOD-source-register's
   official EU publication repository fetch for legal texts, to publications.europa.eu. Every other fetch, XMLHttpRequest,
   WebSocket, EventSource, beacon, worker, dynamic import, created loading element, CSS import or url() is a finding,
   unless it is listed below with the reason it calls no other origin — a file's entry exactly as often as listed, a
   module folder's at most as often.
3. No Markdown file the site serves loads anything from an address of a host outside the list of check 1 — the
   dashboard renders these files, and an image or frame in them would be fetched from its host. Code spans and fenced
   blocks are rendered as text and are not read.

VENDOR lists the third-party library folders; check 1 does not count them as the site's own code. Check 2 still scans
every vendored library for request channels.

Only tracked files are read, so a scratch file in a working tree changes nothing. Counter-proofs:
docs/measurements/2026-10-01_product-rules-repository-checks.md."""
import posixpath
import re
import subprocess
import unittest
from pathlib import Path

from test_artifact_format import outside_code

ROOT = Path(__file__).resolve().parents[1]
VENDOR = ("src/markdown-render/vendor/", "src/mail-routes/vendor/", "src/repository-hosts/vendor/",
          "src/result-records/vendor/")
CODE = (".html", ".css", ".mjs", ".js")

PERMITTED_HOSTS = {
    # The repository server of the instance and of GitHub products: its API, its raw files, its upload host for a release's files, its own pages.
    "api.github.com", "raw.githubusercontent.com", "uploads.github.com", "github.com",
    # The mail provider: Microsoft Graph and its sign-in (Microsoft 365).
    "graph.microsoft.com", "login.microsoftonline.com",
    # The local bridge, on this machine or at the near end of a tunnel's forward.
    "localhost", "127.0.0.1", "[::1]",
    # Navigation only, never called: the Pattern Recognition Lab and the book, linked from the main page's footer.
    "lme.tf.fau.de", "link.springer.com",
    # The EU publication repository MOD-source-register fetches legal texts from.
    "publications.europa.eu",
}

# Pages a module's code names and only links to, never calls: the module's folder -> the hosts, besides PERMITTED_HOSTS, that may stand in
# its files. MOD-mail-routes' providerLinks() gives Microsoft's pages for registering the app and for withdrawing its access.
PERMITTED_LINKS = {
    "src/mail-routes/": {"entra.microsoft.com", "myapps.microsoft.com"},
}

ADDRESS = re.compile(r"\b(?:https?|wss?)://(\[[0-9a-f:]+\]|[a-z0-9.-]+)", re.I)

CHANNELS = [
    ("fetch", re.compile(r"(?<![\w$.])(?:(?:globalThis|window)\.)?fetch\s*\((?!\)\s*\{)")),  # a call, not a method named fetch being defined
    ("XMLHttpRequest", re.compile(r"\bXMLHttpRequest\b")),
    ("WebSocket", re.compile(r"\bWebSocket\b")),
    ("EventSource", re.compile(r"\bEventSource\b")),
    ("sendBeacon", re.compile(r"\bsendBeacon\b")),
    ("importScripts", re.compile(r"\bimportScripts\b")),
    ("Worker", re.compile(r"\bnew\s+(?:Shared)?Worker\b")),
    ("import()", re.compile(r"(?<![\w$.])import\(")),
    ("loading element", re.compile(
        r"createElement(?:NS)?\(\s*(?:[^,()]*,\s*)?[\"'](?:script|link|iframe|frame|img|image|object|embed|audio|video|source)[\"']")),
    ("loading tag", re.compile(
        r"<(?:script|link|iframe|frame|img|image|object|embed|audio|video|source|track)\b[^>]*?\b(?:src|href|data|srcset|poster)"
        r"\s*=\s*[\"']?\s*(?:[a-z][a-z0-9+.-]*:)?//", re.I)),
    ("@import", re.compile(r"@import\b", re.I)),
    ("url()", re.compile(r"url\(\s*[\"']?\s*(?:[a-z][a-z0-9+.-]*:)?//", re.I)),
]


def _mail_routes_lookup(text: str, at: int) -> bool:
    """MOD-mail-routes: routeFor asks Microsoft's sign-in service, the provider's one origin the page names, and only it."""
    return (text[at:].startswith("fetch(`${SIGN_IN_SERVICE}/")
            and 'const SIGN_IN_SERVICE = "https://login.microsoftonline.com";' in text)


GRAPH_ADDRESS = "https://graph.microsoft.com/v1.0"


def _mail_routes_graph(text: str, at: int) -> bool:
    """MOD-mail-routes: a request to Microsoft Graph, the mail provider's API, whose address begins with the file's constant for Graph's
    version 1.0 address, declared there once."""
    name = re.match(r"fetch\(`\$\{(\w+)\}", text[at:])
    return bool(name) and len(re.findall(rf'^const {name.group(1)} = "{re.escape(GRAPH_ADDRESS)}";$', text, re.M)) == 1


def _mail_routes_request(text: str, at: int) -> bool:
    return _mail_routes_lookup(text, at) or _mail_routes_graph(text, at)


def _prepared(text: str, at: int) -> bool:
    """src/repository-hosts/failures.mjs: the fetch sends the URL that prepare() returned in the lines just above it."""
    before = text[:at].split("\n")[-3:]
    return text[at:].startswith(("fetch(u,", "fetch(u)")) and any(re.search(r"const \[u,[^\]]*\] = prepare\(", l) for l in before)


def _own_origin(text: str, at: int) -> bool:
    """src/site-frame/dashboard-app.mjs: a view file or its style sheet, resolved against the module's own address."""
    window = text[at:at + 400]
    return "new URL(`../../docs/assets/dashboard/" in window and "import.meta.url" in window


FRAME_ASSET_LOADING = "the frame's own look.css or lettered brand asset, resolved from its module address"


def _site_frame_asset(text: str, at: int) -> bool:
    """MOD-site-frame: its three static header resources are adjacent own files, wired directly to their elements."""
    own = ('const LOOK = new URL("./look.css", import.meta.url).href;',
           'const PRL_LOGO = new URL("./brand/prl-lettered.png", import.meta.url).href;',
           'const PRL_LOGO_DARK = new URL("./brand/prl-lettered-white.png", import.meta.url).href;')
    if not all(item in text for item in own):
        return False
    window = text[at:at + 240]
    return ((window.startswith('createElement("link")') and 'look.setAttribute("href", LOOK)' in window)
            or (window.startswith('createElement("source")') and 'dark.setAttribute("srcset", PRL_LOGO_DARK)' in window)
            or (window.startswith('createElement("img")') and 'logo.setAttribute("src", PRL_LOGO)' in window))


FRAME_VIEW_IMPORT = "a view module of the site, loaded from its own origin: viewAddress(slug), resolved as ../<slug>/index.mjs against the module's own address"


def _site_frame_view_import(text: str, at: int) -> bool:
    """MOD-site-frame's routing.mjs loads a view module (its file: start.mjs "loads the named view modules from their folders"): the
    argument of the import() is viewAddress(slug), and the file's one viewAddress resolves ../<slug>/index.mjs against import.meta.url."""
    resolves = re.findall(r"^const viewAddress = \(slug\) => new URL\(`\.\./\$\{slug\}/index\.mjs`, import\.meta\.url\)\.href;$", text, re.M)
    return text[at:].startswith("import(viewAddress(slug))") and len(resolves) == 1 and len(re.findall(r"\bviewAddress\s*=", text)) == 1


MERMAID_LIBRARY_LOADING = "the diagram library beside MOD-markdown-render, resolved from the module address"


def _mermaid_library_script(text: str, at: int) -> bool:
    """MOD-markdown-render loads only its declared Mermaid vendor file from its own module address."""
    window = text[at:at + 300]
    return (window.startswith('createElement("script")')
            and 'script.setAttribute("src", new URL("./vendor/mermaid.min.js", import.meta.url).href);' in window
            and 'libraryScript = script;' in window
            and 'appendChild(script);' in text)


def _own_data_file(text: str, at: int) -> bool:
    """A module's own data file, read as MOD-spec-document reads its skeleton: the fetch is fetch(url) in ownFile(url), and
    every address the file builds is resolved from a path beginning with ./ against the module's own address — so what
    ownFile is given lies beside the module, on the origin it was loaded from."""
    if not text[at:].startswith("fetch(url)") or "async function ownFile(url)" not in text:
        return False
    own = re.findall(r"new URL\(([\"'`])\./[^\"'`]*\1, import\.meta\.url\)", text)
    return bool(own) and len(own) == len(re.findall(r"new URL\(", text))


def _source_register_request(text: str, at: int) -> bool:
    """MOD-source-register either reads its own data files or fetches a legal text from the official EU publication
    repository address its module file states."""
    if _own_data_file(text, at):
        return True
    return (text[at:].startswith("fetch(request.url,")
            and 'const PUBLICATIONS = "https://publications.europa.eu";' in text
            and "function requestOf(identifier)" in text
            and 'new URL(`/resource/celex/${encodeURIComponent(identifier.celex)}`, PUBLICATIONS)' in text
            and 'new URL(`/resource${eli.pathname.replace(/\\/$/, "")}`, PUBLICATIONS)' in text
            and 'url.searchParams.set("language", "eng");' in text)


ENDPOINT_URL = 'function endpointUrl(baseUrl, path) {\n  return `${baseUrl.replace(/\\/+$/, "")}${path}`;\n}'
PROVIDER_REQUEST = "function providerRequest(config, "
# A sender of MOD-endpoint-calls -> (its declaration, its one fetch), as the file writes them.
ENDPOINT_SENDERS = {
    "sentWithRetries": ("async function sentWithRetries(config, { url, init }, where, signal) {", "fetch(url, { ...init, signal })"),
    "endpointResponse": ("async function endpointResponse(config, { url, init }, where) {", "fetch(url, init)"),
}
# What a sender may be given as its request after `config, ` -> the declarations that must each stand once in the file for it: the job
# driver's driverRequest and the exchange's `request`, both providerRequest's; the short test's requestFor, providerRequest's too; and the
# model listings' address, which endpointUrl builds from the configuration's baseUrl.
ENDPOINT_REQUESTS = (
    ("driverRequest(config, ", ("function driverRequest(config, prompt, signal) {\n  return providerRequest(config, ",)),
    ("request, ", ("  const request = providerRequest(config, ",)),
    ("{ url, init }, ", ("  const { url, init } = requestFor(config);", "function requestFor(config) {\n  return providerRequest(config, ")),
    ("{ url: endpointUrl(config.baseUrl, ", ()),
)


def _function_body(text: str, head: str) -> str:
    """The text of the top-level function the file declares with `head`, up to its closing brace at the line's start."""
    start = text.find(head)
    end = text.find("\n}\n", start)
    return text[start:end if end >= 0 else len(text)]


def _configured_endpoint_transport(text: str, at: int) -> bool:
    """MOD-endpoint-calls (docs/architecture/MOD-endpoint-calls.md) sends a request to the configured endpoint only through its two
    senders — sentWithRetries, which sends a failed request again (MOD-endpoint-calls: at most five times), and endpointResponse, which
    sends once —: the fetch is the one of a sender's own function, which the file declares once and does not export or pass on. Every call
    of a sender gives it a request whose address endpointUrl built from the configuration's baseUrl — driverRequest's, the exchange's or
    requestFor's, all providerRequest's, or the model listings' —; every address providerRequest returns and every `url:` the file writes
    is endpointUrl(config.baseUrl, …), and endpointUrl only joins the baseUrl and a path."""
    own = [name for name, (head, call) in ENDPOINT_SENDERS.items()
           if text[at:].startswith(call) and text.count(head) == 1 and f"export {head}" not in text
           and text.rfind("function ", 0, at) == text.find(head) + len("async ")]
    if not own or text.count(ENDPOINT_URL) != 1 or text.count(PROVIDER_REQUEST) != 1:
        return False
    if text.count("url:") != text.count("url: endpointUrl(config.baseUrl, "):
        return False
    provider = _function_body(text, PROVIDER_REQUEST)
    returns = re.findall(r"\breturn\b\s*(\S)", provider)
    if not returns or set(returns) != {"{"} or len(returns) != provider.count("url: endpointUrl(config.baseUrl, "):
        return False
    for name, (head, _) in ENDPOINT_SENDERS.items():
        rest = text.replace(head, "")
        for m in re.finditer(rf"(?<![\w$.]){name}\b", rest):
            argument = rest[m.end():m.end() + 160]
            if not argument.startswith("(config, "):
                return False  # the sender passed on, aliased or called with another configuration
            argument = argument[len("(config, "):]
            if not any(argument.startswith(form) and all(text.count(need) == 1 for need in needs) for form, needs in ENDPOINT_REQUESTS):
                return False
    return True


CHECKOUT_TOOLS = "src/checkout-tools/"
WEBFETCH = ("its webfetch tool, which runs in Node only, registered only by the Workflows (src/workflow-entries/, in CI): no module "
            "the site loads in a browser imports src/checkout-tools/")
IMPORT_SPECIFIER = re.compile(r"""(?:\bimport|\bexport)\s*(?:[\w$*{}\s,]*?\bfrom\s*)?(["'])(\.{1,2}/[^"'`]+)\1"""
                              r"""|\bimport\(\s*(["'`])(\.{1,2}/[^"'`$]+)\3\s*\)""")


def browser_modules(files: dict[str, str]) -> set[str]:
    """The modules the site loads in a browser: the module each script tag of a page names, the view modules its data-views name —
    MOD-site-frame's viewAddress(slug), ../<slug>/index.mjs against src/site-frame/, that is src/<slug>/index.mjs —, and every module these
    import, statically or by an import() of a relative address written out. A page's address of another origin is check 1's and 2's."""
    def resolve(base: str, specifier: str) -> str:
        return posixpath.normpath(posixpath.join(posixpath.dirname(base), specifier))
    queue = []
    for path, text in files.items():
        if not path.endswith(".html"):
            continue
        for tag in re.finditer(r"<script\b[^>]*>", text, re.I):
            src = re.search(r"""\bsrc\s*=\s*["']([^"']+)["']""", tag.group(0))
            if src and not re.match(r"(?:[a-z][a-z0-9+.-]*:)?//", src.group(1), re.I):
                queue.append(resolve(path, src.group(1)))
            views = re.search(r"""\bdata-views\s*=\s*["']([^"']*)["']""", tag.group(0))
            queue += [f"src/{slug}/index.mjs" for slug in (views.group(1).split() if views else [])]
    seen = set()
    while queue:
        path = queue.pop()
        if path in seen or path not in files:
            continue
        seen.add(path)
        queue += [resolve(path, m.group(2) or m.group(4)) for m in IMPORT_SPECIFIER.finditer(files[path])]
    return seen


def _webfetch_in_node_only(text: str, at: int, files: dict[str, str]) -> bool:
    """MOD-checkout-tools' webfetch (docs/architecture/MOD-checkout-tools.md, ARC-046): "It runs in Node only: the programs that run such
    jobs register its strategies; the browser does not". NO SERVER's check concerns the built site a browser runs; the tool's fetch is
    allowed when a page of the site exists and no module the site loads in a browser lies in src/checkout-tools/."""
    loaded = browser_modules(files)
    return text[at:].startswith("fetch(url, {") and bool(loaded) and not any(f.startswith(CHECKOUT_TOOLS) for f in loaded)


_webfetch_in_node_only.site = True  # the evidence reads the whole site, not the file alone


def _bridge_client_transport(text: str, at: int) -> bool:
    """MOD-bridge-client sends one request to the Bridge handle, only through its accepted pairing or endpoint-test path."""
    before = text[:at]
    direct = text[at:].startswith('fetch(address, { ...init, headers, credentials: "omit", cache: "no-store" })')
    finite = (text[at:].startswith('fetch(address, { ...init, headers, signal, credentials: "omit", cache: "no-store" })')
              and re.search(r"const requestTimeoutMs = [1-9][0-9_]*;", before)
              and "const signal = AbortSignal.timeout(requestTimeoutMs);" in before)
    return ((direct or finite)
            and "async function call(bridge, path, init)" in before
            and "const address = `${bridge.address}${path}`;" in before
            and "const headers = requestHeaders(bridge, init.body !== undefined);" in before
            and "const headers = { [bridgeApi.tokenHeader]: neededToken(" in before
            and "if (settings?.login) headers.Authorization = basic(settings.login);" in before
            and "await call(bridge, \"/v1/pair\", { method: \"GET\" });" in text
            and "candidate.path === \"/v1/probes/{kind}\"" in text
            and "route.path.replace(\"{kind}\", kind)" in text
            and "body: JSON.stringify({ args })" in text)


MAIL_ROUTES_LOOKUP = ("the one lookup at Microsoft's sign-in service, login.microsoftonline.com, and the one request function to Microsoft Graph, "
                      "graph.microsoft.com")
MSAL_VERSION = ('Il="@azure/msal-browser",wl="5.24.0";',)


def _msal_browser(text: str, at: int, starts: tuple[str, ...], before: str = "") -> bool:
    """MOD-mail-routes' vendored @azure/msal-browser 5.24.0 (ARC-053): the channel here is one of the library's own, read from
    its file — the version is the one whose file was read, and the channel starts as that file writes it."""
    return (all(version in text for version in MSAL_VERSION) and text[at:].startswith(starts)
            and (not before or before in text[max(0, at - 160):at]))


def _msal_fetch(text: str, at: int) -> bool:
    """The library's network client: the GET of sendGetRequestAsync (the authority's configuration) and the POST of
    sendPostRequestAsync (the token endpoint), to the address the library is given, with no credentials."""
    get = _msal_browser(text, at, ("fetch(e,{method:oa,headers:i})",), "async sendGetRequestAsync(e,t){")
    post = _msal_browser(text, at, ("fetch(e,{method:ia,headers:n,body:r})",), "async sendPostRequestAsync(e,t){")
    return get or post


def _msal_element(text: str, at: int) -> bool:
    """The library's preconnect link to the origin of its authority, and the hidden iframe of its silent sign-in."""
    return (_msal_browser(text, at, ('createElement("link");t.rel="preconnect",t.href=new URL(e).origin,t.crossOrigin="anonymous"',),
                          "function Pc(e){const t=document.")
            or _msal_browser(text, at, ('createElement("iframe");return e.className="msalSilentIframe"',), "function Mh(){const e=document."))


OWN_DATA_FILES = "its own data files, from the address the module itself was loaded from"
ENDPOINT_TRANSPORT = "a sender of the request endpointUrl built from the configured baseUrl"
BRIDGE_CLIENT_TRANSPORT = "the Bridge-handle pairing or bridgeApi endpoint-test transport"
MSAL_BROWSER_FETCH = "the network client of @azure/msal-browser 5.24.0, vendored in MOD-mail-routes: the authority's configuration and the token endpoint"
MSAL_BROWSER_ELEMENT = "the preconnect link and the silent sign-in iframe of @azure/msal-browser 5.24.0, vendored in MOD-mail-routes"
MERMAID_VENDOR_CHANNELS = {
    "Worker": (1, "elkjs builds a worker only from a workerUrl option, which the dashboard never sets", None),
    "loading element": (1, "KaTeX's \\includegraphics, rendered only when trusted; mermaid renders KaTeX untrusted", None),
    "@import": (1, "the name of the at-rule in mermaid's CSS parser, not a style sheet", None),
}

IMPORT_FORMS = "MOD-trace-graph reads the import forms of code files; a comment or the reader's pattern, never a request"


def _in_comment(text: str, at: int) -> bool:
    """The match stands in a `//` comment line or between `/*` and `*/`."""
    line_start = text.rfind("\n", 0, at) + 1
    return text[line_start:at].lstrip().startswith("//") or text.rfind("/*", 0, at) > text.rfind("*/", 0, at)


def _trace_graph_comment(text: str, at: int) -> bool:
    """src/trace-graph/code.mjs names `import("x")` in a comment, as the module file names the form; it calls no import()."""
    return _in_comment(text, at)


def _trace_graph_css_form(text: str, at: int) -> bool:
    """src/trace-graph/code.mjs names `@import` in a comment, or in the one pattern CSS_IMPORT it declares for the form."""
    line_start = text.rfind("\n", 0, at) + 1
    declared = text.startswith("const CSS_IMPORT = /", line_start) and len(re.findall(r"^const CSS_IMPORT = /", text, re.M)) == 1
    return _in_comment(text, at) or declared


# (file or module folder, channel) -> (how often, why it calls no other origin, evidence(text, offset) -> bool or None).
# An entry for a folder allows the channel at most as often as listed, counted over every file in it: it allows a module's
# read of its own data files and requires none.
PERMITTED_CHANNELS = {
    ("src/repository-hosts/failures.mjs", "fetch"): (1, "the repository hosts' request helper sends only what its origin gate prepare() let through", _prepared),
    ("src/spec-document/index.mjs", "fetch"): (1, "its own skeleton.md, from the address the module itself was loaded from",
                                               lambda t, i: t[i:].startswith("fetch(url)") and 'new URL("./skeleton.md", import.meta.url)' in t),
    ("src/endpoint-calls/index.mjs", "fetch"): (2, ENDPOINT_TRANSPORT, _configured_endpoint_transport),
    # A reading taken, not a rule of NO SERVER's own: its check concerns the built site a browser runs (this file's docstring);
    # MOD-checkout-tools, MOD-job-catalogue and ARC-046 say webfetch runs in Node only, registered only by the Workflows — in CI —,
    # never by the browser; and A PARTICIPANT DECLARES ITS CAPABILITIES grants a participant "reach the web". Its two fetches (the page, and
    # the page again with an honest user agent where Cloudflare challenged the first) are allowed while no module the site loads in a
    # browser imports src/checkout-tools/.
    ("src/checkout-tools/webfetch.mjs", "fetch"): (2, WEBFETCH, _webfetch_in_node_only),
    ("src/bridge-client/", "fetch"): (1, BRIDGE_CLIENT_TRANSPORT, _bridge_client_transport),
    ("src/mail-routes/", "fetch"): (2, MAIL_ROUTES_LOOKUP, _mail_routes_request),
    # The modules whose files state that they read their own data files when they are loaded (their ## Files and ## Parts).
    ("src/documents/", "fetch"): (1, OWN_DATA_FILES, _own_data_file),
    ("src/model-catalogue/", "fetch"): (1, OWN_DATA_FILES, _own_data_file),
    ("src/participant-list/", "fetch"): (1, OWN_DATA_FILES, _own_data_file),
    ("src/source-register/", "fetch"): (2, "its own data files, and the official EU publication repository for legal texts",
                                        _source_register_request),
    ("src/product-process/", "fetch"): (1, OWN_DATA_FILES, _own_data_file),
    ("src/site-frame/", "fetch"): (1, OWN_DATA_FILES, _own_data_file),
    ("src/personal-data/", "fetch"): (1, OWN_DATA_FILES, _own_data_file),
    ("src/resource-list/", "fetch"): (1, OWN_DATA_FILES, _own_data_file),
    ("src/reuse-facts/", "fetch"): (1, OWN_DATA_FILES, _own_data_file),
    ("src/site-frame/", "loading element"): (3, FRAME_ASSET_LOADING, _site_frame_asset),  # link, source and img
    ("src/markdown-render/mermaid.mjs", "loading element"): (1, MERMAID_LIBRARY_LOADING, _mermaid_library_script),
    # MOD-mail-routes' sign-in library: Microsoft's sign-in service is the mail provider's, which NO SERVER permits; its requests are
    # the library's two fetches (GET, POST), its preconnect link and its silent iframe — four, read from the library's file.
    ("src/mail-routes/vendor/msal-browser.min.js", "fetch"): (2, MSAL_BROWSER_FETCH, _msal_fetch),
    ("src/mail-routes/vendor/msal-browser.min.js", "loading element"): (2, MSAL_BROWSER_ELEMENT, _msal_element),
    ("src/approvals/", "fetch"): (1, OWN_DATA_FILES, _own_data_file),
    ("src/spec-changes/", "fetch"): (1, OWN_DATA_FILES, _own_data_file),
    ("src/work-plans/", "fetch"): (1, OWN_DATA_FILES, _own_data_file),
    ("src/test-schedule/", "fetch"): (1, OWN_DATA_FILES, _own_data_file),
    ("src/result-records/", "fetch"): (1, OWN_DATA_FILES, _own_data_file),
    ("src/job-ledger/", "fetch"): (1, OWN_DATA_FILES, _own_data_file),
    ("src/prompt-bar/", "fetch"): (1, OWN_DATA_FILES, _own_data_file),
    ("src/site-frame/dashboard-app.mjs", "import()"): (1, "a view file of the dashboard, from its own origin", _own_origin),
    ("src/site-frame/dashboard-app.mjs", "loading element"): (1, "a view's style sheet, from its own origin", _own_origin),
    ("src/site-frame/routing.mjs", "import()"): (1, FRAME_VIEW_IMPORT, _site_frame_view_import),
    ("src/trace-graph/code.mjs", "import()"): (1, IMPORT_FORMS, _trace_graph_comment),
    ("src/trace-graph/code.mjs", "@import"): (3, IMPORT_FORMS, _trace_graph_css_form),
    **{("src/markdown-render/vendor/mermaid.min.js", channel): rule for channel, rule in MERMAID_VENDOR_CHANNELS.items()},
}


SITE = ("index.html", "src", "docs", "README.md", "PLAN.md")


def tracked(*paths: str) -> list[str]:
    out = subprocess.run(["git", "-C", str(ROOT), "ls-files", "-z", "--", *(paths or SITE)], capture_output=True, text=True,
                         check=True).stdout
    return [f for f in out.split("\0") if f and (ROOT / f).is_file()]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8", errors="replace")


def foreign_hosts(text: str, path: str = "") -> set[str]:
    linked = set().union(*(hosts for folder, hosts in PERMITTED_LINKS.items() if path.startswith(folder)))
    return {h.lower() for h in ADDRESS.findall(text)} - PERMITTED_HOSTS - linked


def foreign_by_file(files: dict[str, str]) -> dict[str, list[str]]:
    """Check 1 over the given site files: { path: the hosts written in its own code that are not permitted there }."""
    return {f: sorted(foreign_hosts(t, f)) for f, t in files.items() if not f.startswith(VENDOR) and foreign_hosts(t, f)}


def _entry(path: str, name: str, permitted) -> tuple[str, str]:
    """The entry a channel of a file falls under: the file's own, or that of the module folder the file lies in."""
    if (path, name) in permitted:
        return (path, name)
    return next(((p, n) for p, n in permitted if n == name and p.endswith("/") and path.startswith(p)), (path, name))


def _present(entry: str, files) -> bool:
    return entry in files or (entry.endswith("/") and any(f.startswith(entry) for f in files))


def channel_findings(files: dict[str, str], permitted=PERMITTED_CHANNELS) -> list[str]:
    """Every request channel of the given site files that is not a permitted one, and every permitted one whose count or
    evidence does not hold. files: { path: text }."""
    found, seen = [], {}
    for path, text in sorted(files.items()):
        for name, rx in CHANNELS:
            for m in rx.finditer(text):
                key = _entry(path, name, permitted)
                seen[key] = seen.get(key, 0) + 1
                line = text.count("\n", 0, m.start()) + 1
                if key not in permitted:
                    found.append(f"{path}:{line}: {name}: {text[m.start():m.start() + 60].splitlines()[0]}")
                    continue
                evidence = permitted[key][2]
                holds = evidence and (evidence(text, m.start(), files) if getattr(evidence, "site", False) else evidence(text, m.start()))
                if evidence and not holds:
                    found.append(f"{path}:{line}: {name}: not {permitted[key][1]}")
    for key, (count, why, _) in permitted.items():
        n, folder = seen.get(key, 0), key[0].endswith("/")
        if _present(key[0], files) and (n > count if folder else n != count):
            found.append(f"{key[0]}: {key[1]} found {n} times, permitted {'at most ' if folder else ''}{count} ({why})")
    return found


def markdown_loads(text: str) -> list[str]:
    """Addresses a rendered Markdown text would load from: images, and tags that load (script, frame, embed …). Code spans
    and fenced blocks are shown as text and load nothing."""
    text = outside_code(text)[0]
    image = re.findall(r"!\[[^\]]*\]\(\s*<?((?:[a-z][a-z0-9+.-]*:)?//[^)\s>]+)", text, re.I)
    tags = re.findall(r"<(?:script|link|iframe|frame|img|image|object|embed|audio|video|source|track)\b[^>]*?\b"
                      r"(?:src|href|data|srcset|poster)\s*=\s*[\"']?\s*((?:[a-z][a-z0-9+.-]*:)?//[^\"'\s>]+)", text, re.I)
    return image + tags


def host_of(address: str) -> str:
    m = re.match(r"^(?:[a-z][a-z0-9+.-]*:)?//(\[[0-9a-f:]+\]|[^/:?#]+)", address, re.I)
    return m.group(1).lower() if m else ""


class NoServer(unittest.TestCase):
    def setUp(self):
        self.files = {f: read(f) for f in tracked() if f.endswith(CODE)}

    def test_the_site_has_code_to_check(self):
        # A scan that finds no file proves nothing: the page, the dashboard's modules and the vendored libraries are there.
        for f in ("index.html", "src/site-frame/start.mjs", "src/main-page/home.mjs", "docs/index.html", "src/site-frame/dashboard-app.mjs", "src/repository-hosts/failures.mjs",
                  "src/markdown-render/vendor/mermaid.min.js"):
            self.assertIn(f, self.files)

    def test_every_address_in_the_own_code_names_a_permitted_host(self):
        self.assertEqual(foreign_by_file(self.files), {})

    def test_requests_leave_only_through_the_known_channels(self):
        self.assertEqual(channel_findings(self.files), [])

    def test_the_dashboard_sets_no_worker_address_for_mermaid(self):
        # The evidence for the one Worker in mermaid: elkjs constructs it only from a workerUrl option.
        own = [f for f, t in self.files.items() if not f.startswith(VENDOR) and "workerUrl" in t]
        self.assertEqual(own, [])

    def test_mermaid_renders_katex_untrusted(self):
        # The evidence for KaTeX's image element: \includegraphics is rendered only when the trust setting allows it.
        path = "src/markdown-render/vendor/mermaid.min.js"
        self.assertIn(path, self.files)
        calls = re.findall(r"renderToString\([^,]+,\{([^}]*)\}", self.files[path])
        self.assertTrue(calls, f"{path}: no renderToString call found — the evidence would be vacuous")
        self.assertEqual([c for c in calls if "trust" in c], [])

    def test_no_served_markdown_loads_from_another_host(self):
        found = {}
        for f in tracked():
            if f.endswith(".md"):
                bad = [a for a in markdown_loads(read(f)) if host_of(a) not in PERMITTED_HOSTS]
                if bad:
                    found[f] = bad
        self.assertEqual(found, {})

    # ---------------------------------------------------------------- counter-proofs, on planted texts

    def test_counter_proof_a_foreign_address_is_found(self):
        self.assertEqual(foreign_hosts('fetchText("https://api.github.com/repos")'), set())
        self.assertEqual(foreign_hosts("http://127.0.0.1:8765/ and http://[::1]:8765/ and https://graph.microsoft.com/v1.0/me"), set())
        self.assertEqual(foreign_hosts('<script src="https://cdn.jsdelivr.net/npm/x"></script>'), {"cdn.jsdelivr.net"})
        self.assertEqual(foreign_hosts("const BASE = 'wss://telemetry.example.org/s';"), {"telemetry.example.org"})

    def test_counter_proof_an_unknown_channel_is_found(self):
        planted = {
            "docs/assets/new-view.mjs": "await fetch(url);\nnavigator.sendBeacon(u, d);\nnew WebSocket(u);\nconst x = new XMLHttpRequest();\n"
                                        "await import(`https://esm.sh/x`);\nnew Worker(u);\nconst s = document.createElement('script');\n"
                                        "el.innerHTML = `<img src=\"//pixel.example/p.gif\">`;\n",
            "src/site-frame/look.css": "@import url('https://fonts.example/f.css');\nbody { background: url(//img.example/b.png); }\n",
            "docs/index.html": '<link rel="stylesheet" href="https://cdn.example/x.css">\n',
        }
        kinds = sorted({f.split(": ")[1] for f in channel_findings(planted)})
        self.assertEqual(kinds, ["@import", "WebSocket", "Worker", "XMLHttpRequest", "fetch", "import()", "loading element",
                                 "loading tag", "sendBeacon", "url()"])

    def test_counter_proof_a_permitted_channel_without_its_evidence_is_found(self):
        helper = "src/repository-hosts/failures.mjs"
        prepared = {helper: "export async function send(url, options, gate) {\n  const [u, init] = prepare(url, options, gate);\n"
                            "  return fetch(u, init);\n}\n"}
        self.assertEqual(channel_findings(prepared), [], "known positive: the helper's prepared request passes")
        unprepared = {helper: "export async function send(url) {\n  return fetch(url);\n}\n"}
        self.assertEqual(channel_findings(unprepared),
                         [f"{helper}:2: fetch: not the repository hosts' request helper sends only what its origin gate "
                          "prepare() let through"])
        elsewhere = {"src/approvals/x.mjs": "await fetch(`https://jump.example/${port}/`);\n"}
        self.assertEqual(len(channel_findings(elsewhere)), 1)
        twice = {"src/markdown-render/vendor/mermaid.min.js": "new Worker(a);new Worker(b);var k='@import';"
                                                      "document.createElement(\"img\");"}
        self.assertEqual(channel_findings(twice),
                         ["src/markdown-render/vendor/mermaid.min.js: Worker found 2 times, permitted 1 (elkjs builds a worker only from "
                          "a workerUrl option, which the dashboard never sets)"])

    def test_counter_proof_a_method_named_fetch_or_a_comment_is_no_call(self):
        self.assertEqual(channel_findings({"docs/assets/x.mjs": "class P { fetch(){ return this.t } }\nthis.parser.fetch().text;\n"
                                                                "// the settings by name, export and import (UC-042)\nfetchText(u);\n"}), [])

    def test_counter_proof_only_the_configured_endpoint_transport_is_allowed(self):
        # MOD-endpoint-calls in the form its file writes it: its two senders sentWithRetries (line 16) and endpointResponse (line 37),
        # fed only by driverRequest's, the exchange's, requestFor's and the listings' requests, all built by endpointUrl from config.baseUrl.
        path = "src/endpoint-calls/index.mjs"
        accepted = ("function endpointUrl(baseUrl, path) {\n"
                    "  return `${baseUrl.replace(/\\/+$/, \"\")}${path}`;\n"
                    "}\n"
                    "function requestFor(config) {\n"
                    "  return providerRequest(config, PROBE_PROMPT, { maxTokens: 64 });\n"
                    "}\n"
                    "function providerRequest(config, prompt, { signal } = {}) {\n"
                    "  if (config.key !== null) headers.Authorization = `Bearer ${config.key}`;\n"
                    "  return { url: endpointUrl(config.baseUrl, \"/chat/completions\"), init: { method: \"POST\", headers, signal } };\n"
                    "}\n"
                    "function driverRequest(config, prompt, signal) {\n"
                    "  return providerRequest(config, prompt, { signal });\n"
                    "}\n"
                    "async function sentWithRetries(config, { url, init }, where, signal) {\n"
                    "  for (let attempt = 1; ; attempt++) {\n"
                    "    const response = await fetch(url, { ...init, signal });\n"
                    "    if (response.ok) return response;\n"
                    "  }\n"
                    "}\n"
                    "export async function endpointExchange(config, exchange, { signal } = {}) {\n"
                    "  const request = providerRequest(config, null, { signal });\n"
                    "  return sentWithRetries(config, request, \"node\", signal);\n"
                    "}\n"
                    "export function endpointDriver(config, participant) {\n"
                    "  return { async send(input, options = {}) {\n"
                    "    return sentWithRetries(config, driverRequest(config, driverPrompt(input), options.signal), \"node\", options.signal);\n"
                    "  } };\n"
                    "}\n"
                    "export async function testEndpoint(config) {\n"
                    "  const { url, init } = requestFor(config);\n"
                    "  return endpointResponse(config, { url, init }, \"node\");\n"
                    "}\n"
                    "export async function listModels(config) {\n"
                    "  return endpointResponse(config, { url: endpointUrl(config.baseUrl, \"/models\"), init: { method: \"GET\", headers } }, \"node\");\n"
                    "}\n"
                    "async function endpointResponse(config, { url, init }, where) {\n"
                    "  return await fetch(url, init);\n"
                    "}\n")
        # Known positive: the accepted form passes, with its two fetches.
        self.assertEqual(channel_findings({path: accepted}), [])
        both = [f"{path}:16: fetch: not {ENDPOINT_TRANSPORT}", f"{path}:37: fetch: not {ENDPOINT_TRANSPORT}"]
        # Planted: a request whose address is not endpointUrl's of the configured baseUrl, given to a sender or returned by providerRequest;
        # an endpointUrl that does not join the baseUrl; a sender exported, passed on, or called with another configuration. Each leaves
        # both senders' fetches without their evidence.
        for planted, note in (
            (accepted.replace("sentWithRetries(config, request,", "sentWithRetries(config, { url: telemetry, init: {} },"), "an arbitrary request"),
            (accepted.replace("endpointResponse(config, { url, init },", "endpointResponse(config, { url: location.href, init },"), "another address"),
            (accepted.replace("url: endpointUrl(config.baseUrl, \"/chat/completions\")", "url: TELEMETRY"), "providerRequest's address"),
            (accepted.replace("url: endpointUrl(config.baseUrl, \"/models\")", "url: endpointUrl(TELEMETRY, \"/models\")"), "another base"),
            (accepted.replace("${baseUrl.replace(/\\/+$/, \"\")}${path}", "https://collector.example${path}"), "endpointUrl without the baseUrl"),
            (accepted + "export const send = sentWithRetries;\n", "a sender passed on"),
            (accepted.replace("sentWithRetries(config, request,", "sentWithRetries(other, request,"), "another configuration"),
            (accepted.replace("  const { url, init } = requestFor(config);\n", "  const { url, init } = { url: telemetry, init: {} };\n"),
             "the short test's request from elsewhere"),
        ):
            with self.subTest(note):
                self.assertEqual(channel_findings({path: planted}), both)
        # A sender exported, which another module could give any address: its own fetch is found.
        exported = accepted.replace("async function endpointResponse(", "export async function endpointResponse(")
        self.assertEqual(channel_findings({path: exported}), [f"{path}:37: fetch: not {ENDPOINT_TRANSPORT}"])
        # providerRequest returning an address it did not build with endpointUrl, by shorthand (each fetch one line further down).
        shorthand = accepted.replace("  return { url: endpointUrl(config.baseUrl, \"/chat/completions\"), init:",
                                     "  const url = TELEMETRY;\n  return { url, init:")
        self.assertEqual(channel_findings({path: shorthand}),
                         [f"{path}:17: fetch: not {ENDPOINT_TRANSPORT}", f"{path}:38: fetch: not {ENDPOINT_TRANSPORT}"])
        # A fetch in another function of the file: found, and counted.
        beacon = accepted + "async function beacon(url) {\n  return fetch(url, { ...init, signal });\n}\n"
        self.assertEqual(channel_findings({path: beacon}),
                         [f"{path}:40: fetch: not {ENDPOINT_TRANSPORT}", f"{path}: fetch found 3 times, permitted 2 ({ENDPOINT_TRANSPORT})"])
        # A second fetch in a sender: counted.
        twice = accepted.replace("    const response = await fetch(url, { ...init, signal });\n",
                                 "    const response = await fetch(url, { ...init, signal });\n    await fetch(url, { ...init, signal });\n")
        self.assertEqual(channel_findings({path: twice}), [f"{path}: fetch found 3 times, permitted 2 ({ENDPOINT_TRANSPORT})"])
        # What the module is allowed is the file's alone: the same text in another module is found, each fetch.
        self.assertEqual(channel_findings({"src/text-tools/index.mjs": accepted}),
                         ["src/text-tools/index.mjs:16: fetch: fetch(url, { ...init, signal });",
                          "src/text-tools/index.mjs:37: fetch: fetch(url, init);"])

    def test_counter_proof_webfetch_is_allowed_only_while_no_browser_module_imports_the_checkout_tools(self):
        # MOD-checkout-tools' webfetch: its two fetches are allowed while a page of the site exists and no module the site loads in a browser
        # — a page's script, a view its data-views names, and what they import — lies in src/checkout-tools/.
        webfetch = ("export async function webfetch({ url }) {\n"
                    "  let response = await fetch(url, { headers, signal: controller.signal });\n"
                    "  if (response.status === 403) response = await fetch(url, { headers: { ...headers, \"User-Agent\": \"opencode\" }, signal: controller.signal });\n"
                    "}\n")
        site = {"index.html": '<script type="module" src="src/site-frame/start.mjs" data-page="main" data-views="main-page"></script>\n',
                "src/site-frame/start.mjs": 'import { loadView } from "./views.mjs";\n',
                "src/site-frame/views.mjs": "export const loadView = () => null;\n",
                "src/main-page/index.mjs": 'import { home } from "./home.mjs";\n',
                "src/main-page/home.mjs": "export const home = 1;\n",
                "src/workflow-entries/compose.mjs": 'import { checkoutStrategies } from "../checkout-tools/index.mjs";\n',
                "src/checkout-tools/index.mjs": 'export { webfetch } from "./webfetch.mjs";\n',
                "src/checkout-tools/webfetch.mjs": webfetch}
        # Known positives: the closure holds the page's script, what it imports, the view and what the view imports — not the program
        # that runs jobs, nor the tools; and the real site's closure holds its frame, its views and the modules they import.
        self.assertEqual(browser_modules(site), {"src/site-frame/start.mjs", "src/site-frame/views.mjs", "src/main-page/index.mjs",
                                                 "src/main-page/home.mjs"})
        loaded = browser_modules(self.files)
        for module in ("src/site-frame/start.mjs", "src/site-frame/dashboard-app.mjs", "src/main-page/index.mjs", "src/prompt-bar/index.mjs",
                       "src/endpoint-calls/index.mjs", "src/job-runner/index.mjs"):
            self.assertIn(module, loaded)
        self.assertEqual(channel_findings(site), [])
        # Planted: a browser-loaded module — the frame, a view, or a module a view imports, by a static import, a re-export or a
        # literal import() — that imports the tools; then both of webfetch's fetches are found.
        path = "src/checkout-tools/webfetch.mjs"
        both = [f"{path}:2: fetch: not {WEBFETCH}", f"{path}:3: fetch: not {WEBFETCH}"]
        for module, line, own in (("src/site-frame/start.mjs", 'import { checkoutPrompt } from "../checkout-tools/index.mjs";\n', []),
                                  ("src/main-page/index.mjs", 'export { webfetch } from "../checkout-tools/webfetch.mjs";\n', []),
                                  ("src/main-page/home.mjs", 'const tools = await import("../checkout-tools/index.mjs");\n',
                                   ['src/main-page/home.mjs:2: import(): import("../checkout-tools/index.mjs");']),  # itself a finding too
                                  ("src/site-frame/views.mjs", 'import "../workflow-entries/compose.mjs";\n', [])):
            with self.subTest(module=module, line=line):
                self.assertEqual(channel_findings({**site, module: site[module] + line}), both + own)
        # A view named in data-views that is the tools' own folder, and a site without a page to start from.
        self.assertEqual(channel_findings({**site, "index.html": site["index.html"].replace('"main-page"', '"main-page checkout-tools"')}), both)
        self.assertEqual(channel_findings({path: webfetch}), both)
        # The same fetches anywhere else are found; a third fetch in the file is counted.
        self.assertEqual(len(channel_findings({**site, "src/workflow-entries/fetch.mjs": webfetch})), 2)
        self.assertEqual(channel_findings({**site, path: webfetch + "fetch(url, { headers });\n"}),
                         [f"{path}: fetch found 3 times, permitted 2 ({WEBFETCH})"])

    def test_counter_proof_only_the_mail_routes_lookup_and_links_are_allowed(self):
        # MOD-mail-routes (docs/architecture/MOD-mail-routes.md): routeFor asks Microsoft's sign-in service, the provider's one origin the page
        # names; providerLinks() gives the addresses of Microsoft's pages for registering the app and for withdrawing its access, linked only.
        path = "src/mail-routes/index.mjs"
        accepted = ('const SIGN_IN_SERVICE = "https://login.microsoftonline.com";\n'
                    'export async function routeFor(address) {\n'
                    '  const status = (await fetch(`${SIGN_IN_SERVICE}/${encodeURIComponent(domain)}/v2.0/.well-known/openid-configuration`, '
                    '{ credentials: "omit", cache: "no-store" })).status;\n}\n'
                    'export function providerLinks() {\n'
                    '  return { appRegistration: "https://entra.microsoft.com", accessWithdrawal: "https://myapps.microsoft.com" };\n}\n')
        self.assertEqual(channel_findings({path: accepted}), [])
        self.assertEqual(foreign_by_file({path: accepted}), {})
        # The lookup at another origin, the lookup with a second call, and a link to another page are found.
        other_origin = accepted.replace('"https://login.microsoftonline.com"', '"https://login.example.org"')
        self.assertEqual(len(channel_findings({path: other_origin})), 1)
        self.assertEqual(foreign_by_file({path: other_origin}), {path: ["login.example.org"]})
        extra = accepted + "fetch(address);\n"
        self.assertEqual(len(channel_findings({path: extra})), 1)  # the fetch is a second one, which the folder allows to Graph's address alone
        other_link = accepted.replace("https://myapps.microsoft.com", "https://tracker.example")
        self.assertEqual(foreign_by_file({path: other_link}), {path: ["tracker.example"]})
        # What the module is allowed is the module's alone: the same text in another module's folder is found, in its lookup and its links.
        elsewhere = {"src/home/home.mjs": accepted}
        self.assertEqual(len(channel_findings(elsewhere)), 1)
        self.assertEqual(foreign_by_file(elsewhere), {"src/home/home.mjs": ["entra.microsoft.com", "myapps.microsoft.com"]})

    def test_counter_proof_trace_graph_import_forms_are_comments_or_the_one_pattern(self):
        # MOD-trace-graph (docs/architecture/MOD-trace-graph.md, Data) reads the import forms of code files: `import("x")` and `@import`
        # are named in its comments and, for CSS, in the one pattern CSS_IMPORT it declares; none is a request. The file's one `import(`
        # match and three `@import` matches are allowed, each only in a comment or, for `@import`, in that pattern.
        path = "src/trace-graph/code.mjs"
        accepted = ('// An `import("x")` is a dynamic import.\n'
                    '// CSS: `@import "x"` and `@import url("x")`.\n'
                    'const CSS_IMPORT = /@import\\s+(["\'])x\\1/g;\n')
        self.assertEqual(channel_findings({path: accepted}), [])
        # Planted: a real import() call, a CSS @import string outside the pattern, and one more match than the count are found.
        call = accepted + 'const lazy = await import("./x.mjs");\n'
        self.assertEqual(channel_findings({path: call}), [f"{path}:4: import(): not {IMPORT_FORMS}",
                                                           f"{path}: import() found 2 times, permitted 1 ({IMPORT_FORMS})"])
        string = accepted + 'const css = "@import \'x\';";\n'
        self.assertEqual(channel_findings({path: string}), [f"{path}:4: @import: not {IMPORT_FORMS}",
                                                             f"{path}: @import found 4 times, permitted 3 ({IMPORT_FORMS})"])
        above = accepted + "// another `import(\"x\")` in a comment\n"
        self.assertEqual(channel_findings({path: above}), [f"{path}: import() found 2 times, permitted 1 ({IMPORT_FORMS})"])
        # What the file is allowed is the file's alone: the same text in another file is found, each match.
        self.assertEqual(len(channel_findings({"src/home/home.mjs": accepted})), 4)

    def test_counter_proof_mail_routes_graph_requests_are_allowed_beside_the_lookup(self):
        # MOD-mail-routes (docs/architecture/MOD-mail-routes.md, Mailbox: "Every operation crosses the network — to Microsoft Graph") and ITM-425
        # (the Microsoft route "through Microsoft Graph, the token ... only in the authorisation header of those requests"): the module's requests
        # to Microsoft Graph, the mail provider's API that NO SERVER permits, beside the one lookup at the sign-in service. A Graph request is a
        # fetch whose address begins with the module's constant for Graph's version 1.0 address, declared once in the file; the module sends them
        # through one request function, and the check allows two fetches in the folder: that one and the lookup.
        path = "src/mail-routes/index.mjs"
        lookup = ('const SIGN_IN_SERVICE = "https://login.microsoftonline.com";\n'
                  'export async function routeFor(address) {\n'
                  '  const status = (await fetch(`${SIGN_IN_SERVICE}/${encodeURIComponent(domain)}/v2.0/.well-known/openid-configuration`, '
                  '{ credentials: "omit", cache: "no-store" })).status;\n}\n')
        graph = ('const GRAPH = "https://graph.microsoft.com/v1.0";\n'
                 'async function graphRequest(token, path) {\n'
                 '  return fetch(`${GRAPH}${path}`, { headers: { Authorization: `Bearer ${token}` }, credentials: "omit", cache: "no-store" });\n}\n')
        accepted = lookup + graph
        # Known positives: the lookup alone is allowed as before; the same fetch in another module's folder is found; the Graph address is no
        # foreign host.
        self.assertEqual(channel_findings({path: lookup}), [])
        self.assertEqual(len(channel_findings({"src/home/home.mjs": graph})), 1)
        self.assertEqual(foreign_by_file({path: graph}), {})
        self.assertEqual(channel_findings({path: accepted}), [])
        self.assertEqual(channel_findings({path: graph}), [])
        # Planted: a fetch whose address is not Graph's constant, one to another origin, a constant of another address, a lookalike host, an
        # insecure address, a version that is not 1.0, a second request function, and the constant declared nowhere are found.
        for planted, note in (
            (accepted.replace("fetch(`${GRAPH}${path}`", "fetch(path"), "an address from a variable"),
            (accepted.replace("fetch(`${GRAPH}${path}`", "fetch(`https://example.org${path}`"), "another origin"),
            (accepted.replace('"https://graph.microsoft.com/v1.0"', '"https://graph.example.org/v1.0"'), "a constant of another host"),
            (accepted.replace('"https://graph.microsoft.com/v1.0"', '"https://graph.microsoft.com.example.org/v1.0"'), "a lookalike host"),
            (accepted.replace('"https://graph.microsoft.com/v1.0"', '"http://graph.microsoft.com/v1.0"'), "an insecure address"),
            (accepted.replace('"https://graph.microsoft.com/v1.0"', '"https://graph.microsoft.com/beta"'), "a version that is not 1.0"),
            (accepted.replace("const GRAPH = ", "const OTHER = "), "the constant declared nowhere"),
            (accepted + 'const GRAPH = "https://graph.microsoft.com/v1.0";\n', "the constant declared twice"),
            (accepted + "async function again(path) { return fetch(`${GRAPH}${path}`); }\n", "a second request function"),
            (accepted + "fetch(address);\n", "a fetch at a variable address"),
            (graph + graph.replace("graphRequest", "second") + lookup, "the request function twice"),
        ):
            with self.subTest(note):
                self.assertTrue(channel_findings({path: planted}), note)
        # The constant is read by name from the file, not assumed: another name for it is allowed.
        renamed = accepted.replace("GRAPH", "GRAPH_API")
        self.assertEqual(channel_findings({path: renamed}), [])
        # Only fetch is opened: the other channels stay findings in the folder, and a link to another Microsoft page does too.
        for channel in ("new WebSocket(`wss://graph.microsoft.com`);\n", "navigator.sendBeacon(GRAPH);\n", "new XMLHttpRequest();\n"):
            self.assertTrue(channel_findings({path: accepted + channel}), channel)
        self.assertEqual(foreign_by_file({path: accepted + 'const page = "https://tracker.example/";\n'}), {path: ["tracker.example"]})

    def test_counter_proof_only_the_bridge_handle_transport_is_allowed(self):
        accepted = ('import { bridgeApi } from "../bridge-http/index.mjs";\n'
                    'function requestHeaders(bridge, contentType = false) {\n'
                    '  const headers = { [bridgeApi.tokenHeader]: neededToken(settings?.token) };\n'
                    '  if (settings?.login) headers.Authorization = basic(settings.login);\n'
                    '  return headers;\n}\n'
                    'async function call(bridge, path, init) {\n'
                    '  const address = `${bridge.address}${path}`;\n'
                    '  const headers = requestHeaders(bridge, init.body !== undefined);\n'
                    '  return fetch(address, { ...init, headers, credentials: "omit", cache: "no-store" });\n}\n'
                    'export async function pair(address, pairingToken) {\n'
                    '  await call(bridge, "/v1/pair", { method: "GET" });\n}\n'
                    'export async function probe(bridge, kind, args) {\n'
                    '  const route = bridgeApi.routes.find((candidate) => candidate.path === "/v1/probes/{kind}");\n'
                    '  return call(bridge, route.path.replace("{kind}", kind), { body: JSON.stringify({ args }) });\n}\n')
        path = "src/bridge-client/index.mjs"
        self.assertEqual(channel_findings({path: accepted}), [])
        wrong_destination = accepted.replace("`${bridge.address}${path}`", "args.baseUrl")
        self.assertEqual(channel_findings({path: wrong_destination}),
                         [f"{path}:10: fetch: not {BRIDGE_CLIENT_TRANSPORT}"])
        wrong_evidence = accepted.replace("JSON.stringify({ args })", "JSON.stringify(args)")
        self.assertEqual(channel_findings({path: wrong_evidence}),
                         [f"{path}:10: fetch: not {BRIDGE_CLIENT_TRANSPORT}"])
        extra = accepted + 'fetch(address, init);\n'
        self.assertEqual(channel_findings({path: extra}),
                         [f"{path}:19: fetch: not {BRIDGE_CLIENT_TRANSPORT}",
                          f"src/bridge-client/: fetch found 2 times, permitted at most 1 ({BRIDGE_CLIENT_TRANSPORT})"])
        indirect = accepted.replace("fetch(address", "globalThis.fetch(address")
        self.assertEqual(channel_findings({path: indirect}),
                         [f"{path}:10: fetch: not {BRIDGE_CLIENT_TRANSPORT}"])
        finite = ("const requestTimeoutMs = 15000;\n" + accepted.replace(
            '  return fetch(address, { ...init, headers, credentials: "omit", cache: "no-store" });',
            '  const signal = AbortSignal.timeout(requestTimeoutMs);\n'
            '  return fetch(address, { ...init, headers, signal, credentials: "omit", cache: "no-store" });'))
        self.assertEqual(channel_findings({path: finite}), [])
        missing_signal = finite.replace('  const signal = AbortSignal.timeout(requestTimeoutMs);\n', "")
        self.assertEqual(channel_findings({path: missing_signal}),
                         [f"{path}:11: fetch: not {BRIDGE_CLIENT_TRANSPORT}"])

    def test_counter_proof_a_modules_own_data_files(self):
        # The form MOD-spec-document reads its skeleton in, in a module whose file states that it reads its own data files.
        own = ('const SCHEMAS = ["use-case", "module"].map((n) => new URL(`./schemas/${n}.schema.md`, import.meta.url));\n'
               "async function ownFile(url) {\n  const answer = await fetch(url);\n  return answer.text();\n}\n")
        self.assertEqual(channel_findings({"src/documents/index.mjs": own}), [])
        # An address the file builds that is not its own module's: ownFile could be given it.
        elsewhere = own + "const OTHER = new URL(name, location.href);\n"
        self.assertEqual(channel_findings({"src/documents/index.mjs": elsewhere}),
                         [f"src/documents/index.mjs:3: fetch: not {OWN_DATA_FILES}"])
        # A second fetch in the module's folder, in another file: found as a fetch without the evidence, and as a count.
        twice = {"src/model-catalogue/index.mjs": own, "src/model-catalogue/read.mjs": "export const read = (url) => fetch(url);\n"}
        self.assertEqual(channel_findings(twice),
                         [f"src/model-catalogue/read.mjs:1: fetch: not {OWN_DATA_FILES}",
                          f"src/model-catalogue/: fetch found 2 times, permitted at most 1 ({OWN_DATA_FILES})"])
        # A module that reads no data file of its own gets no entry: the same code there is a finding.
        self.assertEqual(channel_findings({"src/text-tools/index.mjs": own}), ["src/text-tools/index.mjs:3: fetch: fetch(url);"])
        # A listed module whose code reads no data file of its own yet: the entry allows the read and requires none.
        self.assertEqual(channel_findings({"src/participant-list/index.mjs": "export const x = 1;\n"}), [])

    def test_counter_proof_a_resource_lists_own_schema_file(self):
        # MOD-resource-list's file says "It reads its own schema file": the form of the other modules that read theirs, at most once in its folder.
        own = ('const SCHEMA = new URL("./resource.schema.md", import.meta.url);\n'
               "async function ownFile(url) {\n  const answer = await fetch(url);\n  return answer.text();\n}\n")
        self.assertEqual(channel_findings({"src/resource-list/index.mjs": own}), [])
        # Elsewhere the same text is found, and so is a second fetch in the folder, and an address that is not the module's own.
        self.assertEqual(channel_findings({"src/text-tools/index.mjs": own}), ["src/text-tools/index.mjs:3: fetch: fetch(url);"])
        twice = {"src/resource-list/index.mjs": own, "src/resource-list/read.mjs": "export const read = (url) => fetch(url);\n"}
        self.assertEqual(channel_findings(twice),
                         [f"src/resource-list/read.mjs:1: fetch: not {OWN_DATA_FILES}",
                          f"src/resource-list/: fetch found 2 times, permitted at most 1 ({OWN_DATA_FILES})"])
        elsewhere = own + "const OTHER = new URL(name, location.href);\n"
        self.assertEqual(channel_findings({"src/resource-list/index.mjs": elsewhere}), [f"src/resource-list/index.mjs:3: fetch: not {OWN_DATA_FILES}"])

    def test_counter_proof_the_prompt_bars_own_schema_files(self):
        # MOD-prompt-bar's Parts name conversation.schema.md and recording.schema.md as its own data files: read through the one
        # ownFile(url), from addresses resolved against the module's own.
        own = ('const schemaFrom = (name) => ownFile(new URL(`./${name}`, import.meta.url));\n'
               "async function ownFile(url) {\n  const answer = await fetch(url);\n  return answer.text();\n}\n")
        self.assertEqual(channel_findings({"src/prompt-bar/record.mjs": own}), [])
        # Elsewhere the same text is found.
        self.assertEqual(channel_findings({"src/text-tools/record.mjs": own}), ["src/text-tools/record.mjs:3: fetch: fetch(url);"])
        # An address that is not the module's own, a second fetch in the folder, and a fetch of anything but ownFile's url.
        elsewhere = own + "const OTHER = new URL(name, location.href);\n"
        self.assertEqual(channel_findings({"src/prompt-bar/record.mjs": elsewhere}), [f"src/prompt-bar/record.mjs:3: fetch: not {OWN_DATA_FILES}"])
        twice = {"src/prompt-bar/record.mjs": own, "src/prompt-bar/send.mjs": "export const send = (url) => fetch(url);\n"}
        self.assertEqual(channel_findings(twice),
                         [f"src/prompt-bar/send.mjs:1: fetch: not {OWN_DATA_FILES}",
                          f"src/prompt-bar/: fetch found 2 times, permitted at most 1 ({OWN_DATA_FILES})"])
        foreign = own.replace("fetch(url)", 'fetch("https://tracker.example/x")')
        self.assertEqual(len(channel_findings({"src/prompt-bar/record.mjs": foreign})), 1)

    def test_counter_proof_the_site_frames_view_import_is_viewaddress_of_its_own_origin(self):
        # MOD-site-frame's routing.mjs loads a view module by its slug: the one import() takes viewAddress(slug), which resolves
        # ../<slug>/index.mjs against the module's own address.
        path = "src/site-frame/routing.mjs"
        own = ("const viewAddress = (slug) => new URL(`../${slug}/index.mjs`, import.meta.url).href;\n"
               "export async function loadView(slug) {\n  return (await import(viewAddress(slug))).view;\n}\n")
        self.assertEqual(channel_findings({path: own}), [])  # expected: no finding
        # Elsewhere the same text is found (expected: the import() at line 3 is not a permitted channel there).
        self.assertEqual(channel_findings({"src/text-tools/routing.mjs": own}),
                         ["src/text-tools/routing.mjs:3: import(): import(viewAddress(slug))).view;"])
        # Another address in that file (expected: one finding each, at line 3, "not" the permitted form).
        for argument in ('"https://example.org/x.mjs"', "url"):
            other = own.replace("import(viewAddress(slug))", f"import({argument})")
            self.assertEqual(channel_findings({path: other}), [f"{path}:3: import(): not {FRAME_VIEW_IMPORT}"])
        # A viewAddress that does not resolve ../<slug>/index.mjs against the module's own address (expected: the import() at
        # line 3 is found, once each).
        for foreign in (own.replace("import.meta.url", "location.href"),
                        own.replace("`../${slug}/index.mjs`", "`https://example.org/${slug}.mjs`")):
            self.assertEqual(channel_findings({path: foreign}), [f"{path}:3: import(): not {FRAME_VIEW_IMPORT}"])
        # A second import() in the file (expected: a count finding, the file's entry permits one).
        twice = own + "export const again = (slug) => import(viewAddress(slug));\n"
        self.assertEqual(channel_findings({path: twice}),
                         [f"{path}: import() found 2 times, permitted 1 ({FRAME_VIEW_IMPORT})"])

    def test_counter_proof_only_the_site_frames_own_static_header_assets_load(self):
        path = "src/site-frame/index.mjs"
        accepted = ('const LOOK = new URL("./look.css", import.meta.url).href;\n'
                    'const PRL_LOGO = new URL("./brand/prl-lettered.png", import.meta.url).href;\n'
                    'const PRL_LOGO_DARK = new URL("./brand/prl-lettered-white.png", import.meta.url).href;\n'
                    'const look = document.createElement("link"); look.setAttribute("href", LOOK);\n'
                    'const dark = document.createElement("source"); dark.setAttribute("srcset", PRL_LOGO_DARK);\n'
                    'const logo = document.createElement("img"); logo.setAttribute("src", PRL_LOGO);\n')
        self.assertEqual(channel_findings({path: accepted}), [])
        wrong_destination = accepted.replace('"./look.css"', '"./elsewhere.css"')
        self.assertEqual(len(channel_findings({path: wrong_destination})), 3)
        foreign = accepted.replace('"./brand/prl-lettered.png"', '"https://tracker.example/logo.png"')
        self.assertEqual(len(channel_findings({path: foreign})), 4)
        indirect = accepted.replace('logo.setAttribute("src", PRL_LOGO)', 'logo.setAttribute("src", target)')
        self.assertEqual(channel_findings({path: indirect})[0], f"{path}:6: loading element: not {FRAME_ASSET_LOADING}")
        extra = accepted + 'const again = document.createElement("img"); again.setAttribute("src", PRL_LOGO);\n'
        self.assertEqual(channel_findings({path: extra})[-1],
                         f"src/site-frame/: loading element found 4 times, permitted at most 3 ({FRAME_ASSET_LOADING})")

    def test_counter_proof_a_vendored_librarys_addresses_are_not_the_own_codes(self):
        # MOD-markdown-render's vendored folder is skipped by check 1, as the other vendored folders are; its own code is not.
        text = 'const ns = "http://www.w3.org/2000/svg";\n'
        own = {f: sorted(foreign_hosts(t)) for f, t in {"src/markdown-render/vendor/purify.min.js": text,
                                                        "src/markdown-render/index.mjs": text}.items()
               if not f.startswith(VENDOR) and foreign_hosts(t)}
        self.assertEqual(own, {"src/markdown-render/index.mjs": ["www.w3.org"]})
        loader = ('const script = document.createElement("script");\n'
                  'script.setAttribute("src", new URL("./vendor/mermaid.min.js", import.meta.url).href);\n'
                  'libraryScript = script;\n(document.body ?? document.documentElement).appendChild(script);\n')
        vendor = 'new Worker(a); document.createElement("img"); var css = "@import";'
        files = {"src/markdown-render/mermaid.mjs": loader, "src/markdown-render/vendor/mermaid.min.js": vendor}
        self.assertEqual(channel_findings(files), [])
        self.assertEqual(len(channel_findings({**files, "src/markdown-render/extra.mjs": loader})), 1)
        foreign = loader.replace('"./vendor/mermaid.min.js"', '"https://tracker.example/mermaid.js"')
        findings = channel_findings({"src/markdown-render/mermaid.mjs": foreign})
        self.assertEqual(len(findings), 2)
        self.assertEqual(findings[0], f"src/markdown-render/mermaid.mjs:1: loading element: not {MERMAID_LIBRARY_LOADING}")
        self.assertTrue(findings[1].startswith('src/markdown-render/mermaid.mjs:2: url(): URL("https://tracker.example/mermaid.js"'))

        # The report parser's W3 citations are source text, not permission to call W3 or another host.
        parser = "src/result-records/vendor/parse-xml.mjs"
        citation = "// @see https://www.w3.org/TR/2008/REC-xml-20081126/\n"
        self.assertNotIn("www.w3.org", PERMITTED_HOSTS)
        self.assertEqual(foreign_by_file({parser: citation, "src/result-records/junit.mjs": citation,
                                          "src/other/vendor/parse-xml.mjs": citation}),
                         {"src/result-records/junit.mjs": ["www.w3.org"],
                          "src/other/vendor/parse-xml.mjs": ["www.w3.org"]})
        self.assertEqual(channel_findings({parser: citation}), [])
        for destination in ("https://www.w3.org/TR/", "https://tracker.example/x"):
            planted = f'fetch("{destination}");\n'
            self.assertEqual(channel_findings({parser: planted}),
                             [f"{parser}:1: fetch: not {OWN_DATA_FILES}"])

    def test_counter_proof_msal_browsers_sign_in_requests_are_allowed_only_in_its_vendored_file(self):
        # MOD-mail-routes vendors @azure/msal-browser 5.24.0 in src/mail-routes/vendor/ (ARC-053). Planted text with the library's four
        # channels, each as the library's file writes it: the GET and the POST of its network client (the authority's configuration and
        # the token endpoint), the preconnect link to the authority's origin, and the hidden iframe of the silent sign-in.
        library = ('Il="@azure/msal-browser",wl="5.24.0";\n'
                   'function Pc(e){const t=document.createElement("link");t.rel="preconnect",t.href=new URL(e).origin,'
                   't.crossOrigin="anonymous",document.head.appendChild(t)}\n'
                   'function Mh(){const e=document.createElement("iframe");return e.className="msalSilentIframe",'
                   'e.title="Microsoft Authentication",e.style.visibility="hidden",e}\n'
                   'class N{async sendGetRequestAsync(e,t){let r,n={};try{r=await fetch(e,{method:oa,headers:i})}catch(e){throw e}'
                   'return r.json()}async sendPostRequestAsync(e,t){let s;for(let t=1;t<=2;t++)try{s=await fetch(e,{method:ia,headers:n,body:r});break}'
                   'catch(e){}return s}}\n')
        path = "src/mail-routes/vendor/msal-browser.min.js"
        self.assertEqual(channel_findings({path: library}), [])
        # The same text anywhere else is found: next to the vendored folder, in another module's, in the dashboard's.
        for elsewhere in ("src/mail-routes/msal-browser.min.js", "src/mail-routes/index.mjs", "src/other/vendor/msal-browser.min.js",
                          "src/other-module/vendor/msal-browser.min.js", "src/mail-routes/vendor/other.min.js"):
            found = channel_findings({elsewhere: library})
            self.assertGreaterEqual(len(found), 4, elsewhere)
            self.assertTrue(all(line.startswith(elsewhere) for line in found[:4]), elsewhere)
        # Another version is not the one whose channels were read.
        self.assertEqual(len(channel_findings({path: library.replace("5.24.0", "5.25.0")})), 4)
        self.assertEqual(len(channel_findings({path: library.replace('Il="@azure/msal-browser",', 'Il="other",')})), 4)
        # Another destination, another method, a third request and another kind of channel are found.
        other_host = library.replace("fetch(e,{method:oa,headers:i})", 'fetch("https://tracker.example/x",{method:oa,headers:i})')
        self.assertEqual(len(channel_findings({path: other_host})), 1)
        self.assertTrue(channel_findings({path: other_host})[0].startswith(f"{path}:"))
        self.assertEqual(len(channel_findings({path: library.replace("{method:ia,headers:n,body:r}", "{method:ia,headers:n,body:r,credentials:'include'}")})), 1)
        self.assertEqual(len(channel_findings({path: library + "fetch(e,{method:oa,headers:i});\n"})), 2)
        self.assertEqual(len(channel_findings({path: library.replace('"iframe"', '"script"')})), 1)
        self.assertEqual(len(channel_findings({path: library + "navigator.sendBeacon(u,d);\n"})), 1)
        self.assertEqual(len(channel_findings({path: library + "new WebSocket(u);\n"})), 1)
        # The vendored folder is skipped by check 1 as the other two are; the module's own code is not.
        text = 'const a = "https://login.chinacloudapi.cn/";\n'
        self.assertEqual(foreign_by_file({path: text, "src/mail-routes/index.mjs": text}),
                         {"src/mail-routes/index.mjs": ["login.chinacloudapi.cn"]})

    def test_counter_proof_a_markdown_file_that_loads_from_another_host(self):
        text = ("![flow](https://tracker.example/p.png)\n<img src='//cdn.example/x.svg'>\n<iframe src=\"https://embed.example/\"></iframe>\n"
                "![badge](https://github.com/o/r/actions/workflows/t.yml/badge.svg)\n![local](diagram.png)\n[a link](https://example.org/)\n"
                "Shown as text: `![](https://code.example/p.png)`\n```html\n<script src=\"https://fence.example/x.js\"></script>\n```\n")
        self.assertEqual([host_of(a) for a in markdown_loads(text)],
                         ["tracker.example", "github.com", "cdn.example", "embed.example"])


if __name__ == "__main__":
    unittest.main()
