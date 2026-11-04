// The route `setup` — finishing the setup of an instance in this browser (UC-014 steps 6 to 8 and 7a), as docs/architecture/MOD-settings-pages.md
// states it: "Finish setting up": the prefilled token page, Only select repositories and the instance named, the shared-origin notice with its tick,
// the token and its expiry, Store and check, and Import settings beside it. Step A links MOD-repository-hosts' prefilled page for a new token (THE
// TOKEN LINK IS PREFILLED, ONE GITHUB TOKEN SERVES EVERY FEATURE) and names the instance as the only repository to select (THE REPOSITORY CHOICE IS
// SPELLED OUT, A TOKEN IS SCOPED TO WHAT IT WRITES). Step B states the shared Pages origin before a token is stored (THE SHARED PAGES ORIGIN IS
// DISCLOSED); the person ticks it, pastes the token and confirms its expiry, and Store and check keeps both in this browser's store, forgets the last
// test of an earlier token, and reads the instance with the new one through MOD-repository-hosts (the page says first where the token goes). The
// instance is shown ready only when that read succeeds. Import settings, beside Store and check, goes to the route `settings`, where an export is
// imported (SETTINGS ARE EXPORTED AND IMPORTED WITH THEIR SECRETS). Each step carries its folded "What is this?" (EVERY STEP EXPLAINS ITSELF),
// MOD-site-frame's explain of the topics setup-key (Step A) and setup-store (Step B), and Step A a folded "Why these?" of its permissions
// (UC-014 step 7), explain("setup-key-permissions", "Why these?"); the texts are in its explanations.md.
//
// Module: MOD-settings-pages
//
// Not part of this route: `get-your-own` (the fork, Pages and Actions steps), which the module file names beside it, and how the dashboard reaches
// this route — a change between jobs.

import { parseAddress, connect } from "../repository-hosts/index.mjs";
import { readSetting, writeSetting, clearSetting } from "../browser-store/index.mjs";
import { explain } from "../site-frame/index.mjs";
import { repositoryChoiceSteps, sharedPagesNotice, defaultExpiry, tokenRefusal, TOKEN_DAYS } from "./products.mjs";
import { heads } from "./routes.mjs";

const EXPIRY_WARN_DAYS = 14;
const INSTANCE_TOKEN_KEY = "github-token";
const ACKNOWLEDGEMENT_KEY = "acknowledged:shared-origin";

function el(name, className, ...children) {
  const node = document.createElement(name);
  if (className) node.className = className;
  node.append(...children);
  return node;
}

// What is missing from a pasted token and its expiry date, or null. The form of the token is not judged here: `connect` alone tells it (tokenRefusal).
function tokenProblem(value, expires) {
  if (!value) return "Paste the token first.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(expires)) return "Enter the date the token expires — GitHub showed it when you created the token.";
  return null;
}

// Step A: the prefilled token page and the repository to pick on it.
function stepA(repository, link) {
  const anchor = el("a", null, "Open GitHub's token page (prefilled) ↗");
  anchor.href = link;
  anchor.target = "_blank";
  anchor.rel = "noopener";
  return el("section", "step",
    el("h3", null, "Step A · Create your key on GitHub"),
    el("p", null, anchor),
    el("p", null, "On that page:"),
    el("ol", "choices", ...repositoryChoiceSteps(repository).map((text) => el("li", null, text))),
    explain("setup-key"), explain("setup-key-permissions", "Why these?"));
}

export const route = {
  ...heads.setup,
  async render(target, context) {
    const store = context.store;
    const repository = context.instance.repository;
    const address = parseAddress(`https://github.com/${repository}`);
    const tokenName = `Agent M · ${repository}`;
    const link = connect(address, {}).webLinks().newToken(tokenName,
      `Agent M dashboard of ${repository}: commits, issues, pull requests and runs of the work you start.`, TOKEN_DAYS);

    const acknowledged = Boolean(readSetting(store, ACKNOWLEDGEMENT_KEY));
    const ack = el("input", "ack");
    ack.type = "checkbox";
    ack.checked = acknowledged;
    const token = el("input", "token");
    token.type = "password";
    token.value = "";
    token.placeholder = "github_pat_…";
    token.autocomplete = "off";
    token.spellcheck = false;
    const expires = el("input", "expires");
    expires.type = "date";
    expires.value = defaultExpiry();
    const storeButton = el("button", "store btn primary", "Store and check");
    const importButton = el("button", "import btn", "Import settings");
    const check = el("p", "check muted");
    const done = el("p", "done");
    const open = (yes) => { token.disabled = expires.disabled = storeButton.disabled = !yes; };
    open(acknowledged);

    ack.addEventListener("change", () => {
      if (ack.checked) writeSetting(store, ACKNOWLEDGEMENT_KEY, new Date().toISOString().slice(0, 10));
      else clearSetting(store, ACKNOWLEDGEMENT_KEY);
      open(ack.checked);
      if (ack.checked) token.focus();
    });
    importButton.addEventListener("click", () => context.go("settings", {}));

    storeButton.addEventListener("click", async () => {
      if (!ack.checked) return;
      const value = token.value.trim();
      const problem = tokenProblem(value, expires.value);
      if (problem) { check.textContent = problem; return; }
      const refused = tokenRefusal(store, address, INSTANCE_TOKEN_KEY, value, tokenName);
      if (refused) { check.textContent = `Nothing was stored: ${refused}`; return; }
      // A new token starts untested: storing it forgets the last test of the one before.
      writeSetting(store, INSTANCE_TOKEN_KEY, { value, name: tokenName, expires: expires.value, stored: new Date().toISOString().slice(0, 10) });
      clearSetting(store, `last-test:${INSTANCE_TOKEN_KEY}`);
      token.value = "";
      done.replaceChildren();
      check.textContent = `Reading ${repository}…`;
      try {
        const info = await connect(address, { token: value, tokenName }).repositoryInfo();
        check.textContent = `✓ ${repository} reachable` +
          (info.visibility === "public" ? " — public, so write access is confirmed only by the first write" : "");
        const ready = el("button", "ready btn primary", "Your instance is ready →");
        const add = el("button", "add btn", "+ Add a product");
        ready.addEventListener("click", () => context.go("main", {}));
        add.addEventListener("click", () => context.go("add-product", {}));
        done.append(ready, " ", add);
      } catch (error) {
        check.textContent = `✗ ${repository}: ${error.message}`;
      }
    });

    target.replaceChildren(
      el("section", "head", el("h2", null, "Finish setting up your instance"),
        el("p", "muted", "Two steps, once per browser. They give this dashboard a key that can write to ", el("strong", null, repository),
          " — and nothing else. Each product gets a key of its own when you add it.")),
      stepA(repository, link),
      el("section", "step",
        el("h3", null, "Step B · Give the key to Agent M"),
        el("p", "notice", sharedPagesNotice(context)),
        el("p", null, el("label", null, ack, " I have read this.")),
        el("p", null, token),
        el("p", null, el("label", null, "Expires on ", expires), " ",
          el("span", "muted small", `Preset to the ${TOKEN_DAYS} days of the prefilled link — correct it if you changed it on GitHub. ` +
            `Agent M warns ${EXPIRY_WARN_DAYS} days before.`)),
        el("p", "muted", `Store and check sends the token to GitHub's API, to read ${repository}, and nowhere else.`),
        el("p", null, storeButton, " ", importButton),
        check,
        explain("setup-store")),
      done);
    // A FORM OPENS WITH ITS FIRST FIELD FOCUSED: the box to tick, or, once ticked, the token field.
    (acknowledged ? token : ack).focus();
  },
};
