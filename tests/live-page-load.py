# Module: MOD-site-frame
# Level: user
"""EVERY PAGE LOADS IN UNDER THREE SECONDS (SPEC queue 2026-11-01): every page of the live site, opened in a browser with a window, ends its
last request — every module, file and request to a repository server it sends to draw what it shows — less than three seconds after its
navigation began.

Run: python3 tests/live-page-load.py [site]   (site: the instance's Pages address, https://akmaier.github.io/agent-m/ unless given)

It reads the live site and GitHub over the network, so it runs over night, never on a pull request.

With a token: GITHUB_TOKEN, else the token `gh auth token` gives. The page is handed a placeholder in its place, and the token is put on the
requests to api.github.com at the network layer — the page never holds it, and nothing prints it. A request that writes is refused.
Each page is opened in a browser context of its own and waited for until no request is open and its text has not changed for two seconds,
at most twenty seconds; it fails where its last request ended at three seconds or later. Without a token the same pages are opened once more.
"""

import json
import os
import subprocess
import sys
import time

from playwright.sync_api import sync_playwright

SITE = (sys.argv[1] if len(sys.argv) > 1 else "https://akmaier.github.io/agent-m/").rstrip("/") + "/"
LIMIT = 3.0
REVIEW = ["spec", "uc", "arc", "review", "process", "roles", "backlog", "progress", "runs", "schedule", "generate", "release",
          "trace", "issues", "mail", "replies", "settings", "add", "setup", "get-your-own"]
PAGES = [""] + [f"docs/index.html#{route}" for route in REVIEW]


def token():
    given = os.environ.get("GITHUB_TOKEN")
    if given:
        return given
    try:
        return subprocess.run(["gh", "auth", "token"], capture_output=True, text=True, check=True).stdout.strip() or None
    except (OSError, subprocess.CalledProcessError):
        return None


def load(browser, page_address, real):
    context = browser.new_context()
    if real:
        seed = json.dumps({"value": "github_pat_placeholder", "name": "page load", "expires": "2099-12-31", "stored": "2026-11-01"})
        context.add_init_script("try{localStorage.setItem('agent-m:akmaier/agent-m:github-token', %s)}catch(e){}" % json.dumps(seed))

        def api(route):
            request = route.request
            writes = request.method not in ("GET", "HEAD") and not (request.method == "POST" and request.url.endswith("/graphql")
                                                                    and "mutation" not in (request.post_data or ""))
            if writes:
                return route.abort()
            headers = {k: v for k, v in request.headers.items() if k.lower() != "authorization"}
            headers["authorization"] = "Bearer " + real
            route.continue_(headers=headers)
        context.route("https://api.github.com/**", api)
    page = context.new_page()
    open_requests, ended = {}, []
    start = time.time()
    page.on("request", lambda r: open_requests.__setitem__(r, True))
    page.on("requestfinished", lambda r: (open_requests.pop(r, None), ended.append(time.time() - start)))
    page.on("requestfailed", lambda r: (open_requests.pop(r, None), ended.append(time.time() - start)))
    page.goto(SITE + page_address, wait_until="load", timeout=60000)
    last_text, changed = None, time.time()
    while time.time() - start < 20:
        text = page.evaluate("document.body.innerText")
        if text != last_text:
            last_text, changed = text, time.time()
        if not open_requests and time.time() - changed > 2:
            break
        page.wait_for_timeout(200)
    context.close()
    return max(ended, default=0.0)


def main():
    real = token()
    failed = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        for credentials in ([real] if real else []) + [None]:
            for address in PAGES:
                took = load(browser, address, credentials)
                line = f"{'token' if credentials else 'no token'} {address or 'main page'}: {took:.1f} s"
                print(line, flush=True)
                if took >= LIMIT:
                    failed.append(line)
        browser.close()
    if failed:
        print(f"{len(failed)} page loads took {LIMIT:.0f} s or more:\n" + "\n".join(failed))
        sys.exit(1)


if __name__ == "__main__":
    main()
